"""The editor's save path does only the work an edit actually needs, and
the decisions that make that so RUN here, lifted out of the deck IIFE.

2026-10-09 (the owner: "if this is not able to load quick, and not be
laggy, then no matter how good the features are no one will ever use
this"):

* undo snapshots NAME a picture instead of copying it -- fifty snapshots
  of a 3.6 MB deck held 180 MB, and each edit spent 85-90 ms at 4x
  serialising pictures that had not changed (histBigRep / histParse);
* the 20-second consolidation re-sends only the decks whose copies the
  project file may not hold as this window would write them -- it used
  to re-embed every deck in the project, a 3.8 s freeze with 31 decks
  (embDiffers / embNeedsSend);
* the saved decks' copies arrive after the page, and a copy absorbed
  before them gives way to the project's the way the boot order used to
  make it, while one you made yourself stays (embApply);
* "is the deck still what was sent" is an edit count, not a second
  serialisation of the deck (stillSaved);
* a click that never moved is not an edit, and a box flushed with the
  same words is not committed again (source pins: their behaviour is
  driven in the browser checks of the same change).
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(prelude: str, fns: tuple[str, ...], script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    body = "\n".join(lift_fn(src, f) for f in fns)
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(prelude + "\n" + body + "\n" + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines()
                if ln.startswith("{") or ln.startswith("[")][-1]
        return json.loads(line)


# ------------------------------------------------------------ undo

_HIST = """
var HIST_BIG=8192,histBig=new Map(),histBigBack=new Map(),histBigN=0;
var undoStack=[],redoStack=[],histSnap=null;
"""
_HIST_FNS = ("histBigRep", "histParse", "histBigForget", "histBigPrune")


def test_a_snapshot_names_each_picture_once_and_gives_it_back():
    got = _run(_HIST, _HIST_FNS, r"""
      var pic='data:image/png;base64,'+'Q'.repeat(300000);
      var pic2='data:image/png;base64,'+'R'.repeat(20000);
      var deck={slides:[{annots:[{k:'image',src:pic},{k:'text',text:'hi \u0000x'}]},
                        {annots:[{k:'image',src:pic},{k:'image',src:pic2}]}],
                notes:'n'.repeat(9000)};
      var s1=JSON.stringify(deck,histBigRep);
      var s2=JSON.stringify(deck,histBigRep);
      var back=histParse(s1);
      console.log(JSON.stringify({
        small: s1.length<60000, same: s1===s2,
        exact: JSON.stringify(back)===JSON.stringify(deck),
        names: histBigBack.size,
        plain: JSON.stringify(histParse('{"a":"\\u0000jvpic999"}'))}));
    """)
    assert got["small"], "the pictures were copied into the snapshot"
    assert got["same"], "the same deck must serialise to the same snapshot"
    assert got["exact"], "a picture did not come back byte for byte"
    # long words (the 9000-character notes) are named too -- any string
    assert got["names"] == 3
    # a name nobody minted is left alone, never turned into a picture
    assert got["plain"] == '{"a":"\\u0000jvpic999"}'


def test_names_no_snapshot_uses_are_let_go():
    got = _run(_HIST, _HIST_FNS, r"""
      var made=[];
      for(var i=0;i<40;i++){
        made.push(JSON.stringify({src:'p'+i+'x'.repeat(9000)},histBigRep));}
      undoStack=made.slice(-10);histSnap=made[made.length-1];
      histBigPrune();
      var ok=undoStack.every(function(s){
        return histParse(s).src.length===9000+String(undoStack.indexOf(s)).length+1
          ||histParse(s).src.indexOf('p')===0;});
      console.log(JSON.stringify({left:histBigBack.size,ok:ok,
        first:histParse(made[30]).src.slice(0,3)}));
    """)
    assert got["left"] == 10 and got["ok"]
    assert got["first"] == "p30"


def test_a_deck_of_words_is_written_plain_and_says_the_same():
    """The replacer costs every snapshot V8's fast path, so a deck with
    nothing to name is written without it -- and that is only safe if
    the plain text is EXACTLY what the replacer would have written, or
    histPush would see an edit where there was none."""
    got = _run(_HIST + "var histBigLast=null,pres=null;\n",
               _HIST_FNS + ("histHasBig", "histJson"), r"""
      var Q='x'.repeat(8191);
      var decks=[
        {slides:[{t:'hello'},{t:'a "quoted" word \\ and a slash\\'}]},
        {slides:[{t:Q}]},                                  // just short
        {slides:[{t:Q+'yy'}]},                             // just long
        {slides:[{t:'"'.repeat(5000)}]},                   // long, all quotes
        {slides:[{t:'\\'.repeat(4100)+'"'+'\\'.repeat(4100)}]},
        {slides:[{pts:Array.from({length:4000},(_,i)=>i)}]},  // a long run, no string
        {slides:[{src:'data:image/png;base64,'+'Q'.repeat(30000)}]},
        {slides:[{t:'\u0000jvpic1 is just words'}]},
      ];
      var out=decks.map(function(d){
        pres={};histBigLast=null;
        var a=histJson(d), plain=histBigLast!==pres;
        var b=histJson(d);
        return {same:a===JSON.stringify(d,histBigRep)&&a===b,
                plain:plain,
                back:JSON.stringify(histParse(a))===JSON.stringify(d)};});
      console.log(JSON.stringify(out));
    """)
    assert all(r["same"] for r in got), got
    assert all(r["back"] for r in got), got
    plain = [r["plain"] for r in got]
    # words, the just-short string and a run that is no string stay
    # plain; a string the replacer would name never does
    assert plain[0] and plain[1] and plain[7]
    assert not plain[2] and not plain[3] and not plain[4] and not plain[6]


def test_histstate_and_every_reader_go_through_the_names():
    js = assets.deck_js()
    assert "    return histJson({slides:pres.slides||[]," in js
    assert "      cropMarks:pres.cropMarks||0});" in js
    assert "    return JSON.stringify(o,histBigRep);" in js
    assert "var d;try{d=histParse(snap);}catch(e){return;}" in js     # undo
    assert "var d;try{d=histParse(js);}catch(e){return;}" in js       # history
    reset = js.split("  function histReset(){", 1)[1].split("\n  }", 1)[0]
    assert reset.index("histBigForget();") < reset.index("histSnap=histState();")


# ------------------------------------------------------- consolidation

_SEND = """
var embDirtyAt={},embSentAt={},embHeld={},embHeldClips={},MEDIA={};
var ITEMS={},EMBED={},LIVE={};
function resolveRef(r){return ITEMS[r]||(EMBED[r]?{emb:true}:null);}
function embFor(r){return EMBED[r]||null;}
function refIsLive(r){return !!LIVE[r];}
function isColPres(p){return p&&p.kind==='collection';}
function colRefsOf(p){return (p.items||[]).map(function(i){return i.ref;});}
function flipFrames(a){return a.frames||[];}
function mediaStore(){return MEDIA;}
function deck(name,refs,extra){
  var d={name:name,slides:refs.map(function(r){
    return {annots:[{k:'cell',ref:r}]};})};
  for(var k in (extra||{})) d[k]=extra[k];
  return d;}
function copyOf(h,c,t){return {title:t||'T',kind:'figure',html:h,code:c||''};}
"""
_SEND_FNS = ("embRefsOf", "embDiffers", "embNeedsSend")


def test_only_a_deck_the_file_may_not_hold_is_re_sent():
    got = _run(_SEND, _SEND_FNS, r"""
      EMBED['nb::a']=copyOf('<a>');EMBED['nb::b']=copyOf('<b>');
      EMBED['gone::c']=copyOf('<c>');
      // the notebook holding a and b is closed: the copies are all there is
      var held={'nb::a':copyOf('<a>'),'nb::b':copyOf('<b>')};
      embHeld={clean:held,stale:{'nb::a':copyOf('<old a>'),'nb::b':held['nb::b']},
               partial:{'nb::a':held['nb::a']},
               closed:{'gone::c':copyOf('<c>')}};
      var r={};
      r.clean=embNeedsSend(deck('clean',['nb::a','nb::b']));
      r.stale=embNeedsSend(deck('stale',['nb::a','nb::b']));
      r.partial=embNeedsSend(deck('partial',['nb::a','nb::b']));
      r.never=embNeedsSend(deck('never',['nb::a']));
      r.closed=embNeedsSend(deck('closed',['gone::c']));
      r.view=embNeedsSend({name:'v',kind:'view',slides:[]});
      embDirtyAt.clean=5;embSentAt.clean=4;
      r.edited=embNeedsSend(deck('clean',['nb::a','nb::b']));
      embSentAt.clean=5;
      r.sent=embNeedsSend(deck('clean',['nb::a','nb::b']));
      // a figure nobody holds a copy of: nothing this window could add
      r.nothing=embNeedsSend(deck('clean',['nb::zz']));
      console.log(JSON.stringify(r));
    """)
    assert got == {"clean": False, "stale": True, "partial": True,
                   "never": True, "closed": False, "view": False,
                   "edited": True, "sent": False, "nothing": False}


def test_a_figure_an_open_notebook_can_give_follows_the_save_rules():
    """embedAssets writes such a figure with the CARD's title and kind,
    the kept body, and the code facet when the card has one -- so a held
    copy that differs in any of those is owed, and one that matches is
    not."""
    got = _run(_SEND, _SEND_FNS, r"""
      ITEMS['nb::a']={title:'Card',kind:'figure',hasCode:true};
      EMBED['nb::a']={title:'Card',kind:'figure',html:'<a>',code:'<c>'};
      var r={};
      function held(h){embHeld={d:{'nb::a':h}};
        return embNeedsSend(deck('d',['nb::a']));}
      r.same=held({title:'Card',kind:'figure',html:'<a>',code:'<c>'});
      r.title=held({title:'Old',kind:'figure',html:'<a>',code:'<c>'});
      r.nocode=held({title:'Card',kind:'figure',html:'<a>'});
      r.body=held({title:'Card',kind:'figure',html:'<b>',code:'<c>'});
      LIVE['nb::a']=1;
      r.live=held({title:'Card',kind:'figure',html:'<a>',code:'<c>'});
      LIVE={};delete EMBED['nb::a'];
      r.uncaptured=held(null);
      console.log(JSON.stringify(r));
    """)
    assert got == {"same": False, "title": True, "nocode": True,
                   "body": True, "live": True, "uncaptured": True}


def test_a_clip_and_a_collection_are_owed_too():
    got = _run(_SEND, _SEND_FNS, r"""
      MEDIA['med:v']={src:'data:video/mp4;base64,AA'};
      var clipDeck={name:'c',slides:[{annots:[{k:'video',vkey:'med:v'}],
        narr:{vkey:'med:n'}}]};
      var r={};
      r.clipOwed=embNeedsSend(clipDeck);
      embHeldClips={c:{'med:v':1}};
      r.clipHeld=embNeedsSend(clipDeck);
      EMBED['nb::x']=copyOf('<x>');
      var col={name:'g',kind:'collection',slides:[],items:[{ref:'nb::x'}]};
      r.colOwed=embNeedsSend(col);
      embHeld={g:{'nb::x':copyOf('<x>')}};
      r.colHeld=embNeedsSend(col);
      console.log(JSON.stringify(r));
    """)
    assert got == {"clipOwed": True, "clipHeld": False, "colOwed": True,
                   "colHeld": False}


def test_the_consolidation_sends_owed_decks_whole_and_the_rest_lean():
    js = assets.deck_js()
    save = js.split("  function saveToProject(silent,embed){", 1)[1]
    save = save.split("\n  /* one conflict notice", 1)[0]
    assert "if(silent&&!embNeedsSend(p)) return;" not in save
    assert "if(whole.indexOf(p)>=0||!embNeedsSend(p)) return;" in save
    assert "embedAssets(now,{project:1});" in save
    # what landed is what the next consolidation compares against
    assert "whole.forEach(function(p){embNoteHeld(p,sentGen);});" in save
    # and nothing at all goes out when nothing is owed or asked for
    assert ("if(silent&&embed&&!whole.length&&projAsked===projAnswered)"
            in save)
    # one autosave at a time: a second in flight would 409 against the first
    assert "if(silent&&projSaving){" in save


# ------------------------------------------------- the copies arrive late

_APPLY = """
var EMBED={},embItems={},embWeak={},embHeld={},embHeldClips={};
var embLoaded=false,settled=0,saved=0,dropped=[],absorbedMedia=[];
function embSettle(){settled++;}
function embSaveSoon(){saved++;}
function dropFrameCache(k){dropped.push(k);}
function mediaAbsorb(p){absorbedMedia.push(Object.keys(p.media).sort().join());}
"""
_APPLY_FNS = ("embApply", "embPut", "embKeyRaw")


def test_the_projects_copies_take_the_place_of_a_weak_one_only():
    got = _run(_APPLY, _APPLY_FNS, r"""
      // absorbed before they came: a notebook's own deck (weak) and a
      // capture you made (strong), plus a plain-anchor copy
      EMBED['nb::a']={title:'',kind:'',html:'<nb a>',code:''};embWeak['nb::a']=1;
      EMBED['nb::b']={title:'',kind:'',html:'<mine b>',code:''};
      EMBED['nb::p']={title:'',kind:'',html:'<p>',code:''};
      embApply({snaps:[{html:'<proj a>',title:'A'},{html:'<proj b>'},
                       {html:'<proj c>'},{html:'<plain>'}],
                clips:[{src:'data:x'}],
                decks:[{name:'talk',emb:{'nb::a':0,'nb::b':1,'nb::c':2,'p':3},
                        media:{'med:1':0}},
                       {name:'poster',emb:{'nb::c':1}}]});
      console.log(JSON.stringify({
        a:EMBED['nb::a'].html,b:EMBED['nb::b'].html,c:EMBED['nb::c'].html,
        plain:EMBED['nb::p'].html, extraKey:!!EMBED['p'],
        loaded:embLoaded,weak:Object.keys(embWeak),settled:settled,
        held:Object.keys(embHeld.talk).sort(),poster:embHeld.poster['nb::c'].html,
        clips:embHeldClips.talk,media:absorbedMedia}));
    """)
    assert got["a"] == "<proj a>", "a weak copy gives way to the project's"
    assert got["b"] == "<mine b>", "a copy you made since boot is fresher"
    # first deck in the file wins, as the boot absorb always did
    assert got["c"] == "<proj c>"
    # a plain anchor finds its namespaced copy, as at eval time
    assert got["plain"] == "<p>" and not got["extraKey"]
    assert got["loaded"] and got["weak"] == [] and got["settled"] == 1
    assert got["held"] == ["nb::a", "nb::b", "nb::c", "p"]
    assert got["poster"] == "<proj b>"
    # every deck's clips go to the clip store's own first-kept absorb
    assert got["clips"] == {"med:1": 1} and got["media"] == ["med:1", ""]


def test_a_store_of_the_same_copy_keeps_what_was_built_from_it():
    got = _run("""
var EMBED={},embItems={},embWeak={},EMBPREV={},dropped=[];
function dropFrameCache(k){dropped.push(k);}
""", ("embStore", "embPut"), r"""
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>',code:''});
      EMBED['nb::a']._node='parsed';embItems['nb::a']='item';
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>'});
      var kept=EMBED['nb::a']._node==='parsed'&&embItems['nb::a']==='item';
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>',code:'<c>'});
      console.log(JSON.stringify({kept:kept,dropped:dropped.length,
        code:EMBED['nb::a'].code,prev:!!EMBPREV['nb::a']}));
    """)
    assert got == {"kept": True, "dropped": 2, "code": "<c>", "prev": False}


# ------------------------------------------------------- still saved?

def test_still_saved_is_the_same_deck_at_the_same_count():
    got = _run("var pres={name:'a'},deckGen=3;", ("deckGenSig", "stillSaved"),
               r"""
      var sig=deckGenSig(),r={};
      r.same=stillSaved('a',sig);
      deckGen++;r.edited=stillSaved('a',sig);
      deckGen--;pres.name='b';r.renamed=stillSaved('a',sig);
      pres={name:'a'};r.other=stillSaved('a',sig);
      r.none=stillSaved('a',null);
      console.log(JSON.stringify(r));
    """)
    assert got == {"same": True, "edited": False, "renamed": False,
                   "other": False, "none": False}


def test_every_door_that_changes_the_deck_counts():
    js = assets.deck_js()
    mark = js.split("  function markDirty(quiet){", 1)[1].split("\n  }", 1)[0]
    assert "deckChanged();" in mark
    restore = js.split("  function histRestore(snap){", 1)[1]
    restore = restore.split("\n  function ", 1)[0]
    assert "deckChanged();" in restore
    assert "deckSaveSig(pres)" not in js
    assert js.count("savedSig=deckGenSig();") == 4


# ------------------------------------------------- clicks and flushes

def test_a_click_that_never_moved_is_not_an_edit():
    js = assets.deck_js()
    move = js.split("  function startMove(layer,s,idx,ev0){", 1)[1]
    mu = move.split("    function mu(){", 1)[1].split("\n    }\n", 1)[0]
    assert "      if(movedAny) markDirty();" in mu
    assert "      markDirty();\n" not in mu.split("if(movedAny) markDirty();")[1]


def test_a_flush_with_the_same_words_commits_nothing():
    js = assets.deck_js()
    commit = js.split("    function commitNow(quiet){", 1)[1]
    commit = commit.split("\n    }", 1)[0]
    assert "if(sig===lastCommit) return;" in commit
    assert commit.index("lastCommit=sig;") < commit.index("markDirty(quiet);")
    cell = js.split("    function flushCell(){", 1)[1].split("\n    }", 1)[0]
    assert "if(v===cellWas) return;" in cell


def test_no_project_write_runs_during_a_talk():
    js = assets.deck_js()
    auto = js.split("  function autoSaveNow(){", 1)[1].split("\n  }", 1)[0]
    assert "if(saveTarget!=='browser'&&presenting()){holdSave(false);return;}" \
        in auto
    sched = js.split("  function scheduleAutosave(){", 1)[1]
    sched = sched.split("\n  var embedTimer=null;", 1)[0]
    assert "if(presenting()){holdSave(true);return;}" in sched
    mode = js.split("  function setUIMode(m){", 1)[1].split("\n    mode=m;", 1)[0]
    assert "releaseSaves();" in mode.split("else if(endingTalk){", 1)[1]
    close = js.split("  function closeDeck(){", 1)[1].split("\n  }", 1)[0]
    assert "if(wasTalk) releaseSaves();" in close


# --------------------------------------------- from the review (2026-10-09)

def test_a_picture_new_in_the_last_snapshot_keeps_its_name():
    # the review of the save package: histBigPrune ran BEFORE the new
    # snapshot became histSnap, so a picture (or a long text box) that
    # first appeared in it was named nowhere yet and its name was let go
    # -- and undo then put the bare name, '\0jvpicN', into the deck and
    # the next save wrote it to the project file
    got = _run(_HIST + """
      var histHeadMarks=[],deck={src:'p0'+'x'.repeat(9000)};
      function histMarksShift(){}
      function updateUndoBtns(){}
      function histState(){return JSON.stringify(deck,histBigRep);}
    """, _HIST_FNS + ("histPush",), r"""
      histSnap=histState();
      for(var i=1;i<80;i++){
        deck={src:'p'+i+'x'.repeat(9000),n:i};histPush();}
      var all=undoStack.concat([histSnap]),bad=0;
      all.forEach(function(s){
        var src=histParse(s).src;
        if(src.charCodeAt(0)===0||src.length<9000) bad++;});
      console.log(JSON.stringify({bad:bad,n:all.length,
        last:histParse(histSnap).src.slice(0,3)}));
    """)
    assert got == {"bad": 0, "n": 51, "last": "p79"}


def test_the_edit_before_present_reaches_the_project_as_the_show_starts():
    # a talk ended by closing the tab never reaches releaseSaves, so the
    # pending autosave is written once the first slide has painted -- not
    # through autoSaveNow, which would hold it for the end of the talk
    js = assets.deck_js()
    mode = js.split("  function setUIMode(m){", 1)[1].split("\n    mode=m;", 1)[0]
    assert "if(startingTalk) saveBeforeShow();" in mode
    assert mode.index("flushDraftWrite();") < mode.index("saveBeforeShow();")
    fn = js.split("  function saveBeforeShow(){", 1)[1].split("\n  }\n", 1)[0]
    assert "cancelAutosave();" in fn and "autoSaveNow" not in fn
    assert "saveToProject(true);" in fn and "saveToFile(true);" in fn


def test_a_rename_waits_for_the_copies_it_has_to_carry():
    # the project keeps a deck's copies under its NAME: a rename written
    # before the lean boot's copies arrived dropped every one of them
    js = assets.deck_js()
    for head in ("  function renamePresentation(nm){",
                 "  function renamePresByName(old,nm){"):
        body = js.split(head, 1)[1].split("\n  }\n", 1)[0]
        assert "if(renameNeedsCopies()) return false;" in body, head
    need = js.split("  function renameNeedsCopies(){", 1)[1].split("\n  }", 1)[0]
    assert "if(embEnsure()) return false;" in need


def test_the_copies_arriving_redraw_only_what_went_without():
    # the idle arrival used to redraw whenever a deck was on screen, which
    # threw the caret out of a box being typed in; now only a reader that
    # was refused (or a clip that gained its bytes) asks for it, and a
    # box being typed in redraws on its blur
    js = assets.deck_js()
    fetch = js.split("  function embFetch(){", 1)[1].split("\n  }\n", 1)[0]
    assert "refresh()" not in fetch
    assert "if(!was&&(embMissed||embClipsShown()>clips)) embRedraw();" in fetch
    ens = js.split("  function embEnsure(){", 1)[1].split("\n  }\n", 1)[0]
    assert ens.count("embMissed=true") == 3
    redraw = js.split("  function embRedraw(){", 1)[1].split("\n  }\n", 1)[0]
    assert "ae.isContentEditable&&deckEl.contains(ae)" in redraw
    assert "addEventListener('blur'" in redraw
