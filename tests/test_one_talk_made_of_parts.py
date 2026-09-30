"""One talk made of parts (T601).

The user, 2026-09-30: "like how you can with overleaf, where you can have
multiple documents feed into the one that are linked so you don't have to
have them open all at once, it would be good to have something like this
... it would be cool if there was a view to have something like this."

A section can be a PART: its link names another presentation and its
slides are that presentation's, copied and kept up to date -- brought up
to date when the talk opens, if the part changed since, and never over
copies that were changed here too. The Parts view lists the talk as its
parts and adds, makes, updates, unlinks, reorders and removes them.

What is copied, what counts as a change, when a part is replaced and what
it replaces RUN here against stubs: each is a decision, and a substring
cannot check a decision.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

_MODEL = ("partLink", "partOfSlide", "partHash", "partMastBody", "partSig",
          "partSource", "partLinksOf", "partReaches", "partLockAnnot",
          "partUnlockAnnot", "partFree", "partCopies", "partMasters",
          "partMastersPrune", "partNorm", "partLook", "partApply",
          "partsRefresh", "partIds", "lockMode")

_STUB = """
var PART_KEYS_OFF={oid:1,sid:1,lock:1,lkLock:1,sec:1,lk:1,mast:1};
var partState={},draftsLoaded=true,cur=0,pres=null,DECKS={};
function deep(o){return JSON.parse(JSON.stringify(o));}
function isViewPres(p){return !!(p&&p.kind==='view');}
function presentationByName(n){return DECKS[n]?deep(DECKS[n]):null;}
function mastStore(){if(!pres.masters) pres.masters={};return pres.masters;}
function nextMastId(){var n=1;while(mastStore()['m'+n]) n++;return 'm'+n;}
function normSections(){if(typeof partNorm==='function') partNorm();}
function sectionRuns(){
  var out=[],last=null;
  (pres.slides||[]).forEach(function(s,i){
    var id=s.sec||'';
    if(!last||last.id!==id){last={id:id,at:i,n:0};out.push(last);}
    last.n++;
  });
  return out;
}
function T(s){return {layout:'blank',panes:[],annots:[{k:'text',x:1,y:1,
  w:5,h:5,text:s,oid:'o'+s}]};}
function words(){return pres.slides.map(function(s){
  return (s.lk?'*':'')+((s.annots||[])[0]||{}).text;});}
"""


def _run(script: str, fns: tuple[str, ...] = _MODEL):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    pre = "\n".join(lift_fn(src, f) for f in fns) + "\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_STUB + pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


# --------------------------------------------------------------- the copy


def test_a_part_arrives_as_its_slides_marked_and_locked():
    got = _run("""
      var src={name:'Methods',sections:{a:{name:'A',trans:'fade'}},
        slides:[T('one'),T('two')]};
      src.slides[0].sec='a';src.slides[0].cuts=['k1'];
      src.slides[1].trans='';
      src.slides[1].annots.push({k:'text',text:'pinned',lock:'pos'});
      src.slides[1].annots.push({k:'text',text:'held',lock:1});
      var c=partCopies(src,'s9');
      console.log(JSON.stringify({c:c,src:src}));
    """)
    one, two = got["c"]
    assert one["sec"] == "s9" and one["lk"] == "s9"
    assert "cuts" not in one          # the part's named versions stay there
    assert one["trans"] == "fade"     # its section's arrival, onto the slide
    assert two["trans"] == ""         # a slide's own "cut" is kept
    a, pinned, held = two["annots"]
    assert (a["lock"], a["lkLock"]) == (1, 1)
    # the lock it had is remembered, to be given back on Unlink
    assert (pinned["lock"], pinned["lkLock"]) == (1, "pos")
    # one the part locked itself is the part's, and not marked
    assert held == {"k": "text", "text": "held", "lock": 1}
    # and the part itself is not touched
    assert "lk" not in got["src"]["slides"][0]


def test_unlink_gives_back_exactly_the_locks_the_part_had():
    got = _run("""
      var s={lk:'s9',annots:[{lock:1,lkLock:1},{lock:1,lkLock:'pos'},
        {lock:1}]};
      partFree(s);
      console.log(JSON.stringify(s));
    """)
    assert got == {"annots": [{}, {"lock": "pos"}, {"lock": 1}]}


def test_the_hash_sees_content_and_not_the_names_the_editor_mints():
    got = _run("""
      var a=[T('one')],b=deep(a);
      b[0].annots[0].oid='other';b[0].sid='sx';b[0].sec='q';b[0].lk='q';
      b[0].annots[0].lock=1;b[0].annots[0].lkLock=1;
      var c=deep(a);c[0].annots[0].text='ONE';
      /* a master is compared by what it looks like, not by its id */
      var m1={m1:{name:'Dark',bg:'#000'}},m2={m7:{name:'Mine',bg:'#000'}};
      var d=deep(a);d[0].mast='m1';var e=deep(a);e[0].mast='m7';
      var f=deep(a);f[0].mast='m7';
      console.log(JSON.stringify({same:partSig(a)===partSig(b),
        text:partSig(a)===partSig(c),
        mast:partSig(d,m1)===partSig(e,m2),
        look:partSig(d,m1)===partSig(f,{m7:{bg:'#fff'}})}));
    """)
    assert got == {"same": True, "text": False, "mast": True, "look": False}


# -------------------------------------------------------------- the update


_TALK = """
  DECKS.Methods={name:'Methods',slides:[T('m1'),T('m2')]};
  pres={name:'Talk',slides:[T('title')],
    sections:{s9:{name:'Methods',link:{deck:'Methods',sig:'',at:0}}}};
  partApply('s9',partLook('s9'));
  pres.slides.push(T('questions'));
"""


def test_a_part_changed_there_is_brought_up_to_date_where_it_was():
    got = _run(_TALK + """
      var before=words();
      var quiet=partsRefresh(false);               /* nothing changed */
      DECKS.Methods.slides.push(T('m3'));
      DECKS.Methods.slides[0].annots[0].text='m1!';
      var up=partsRefresh(false);
      console.log(JSON.stringify({before:before,quiet:quiet,up:up,
        after:words(),state:partState.s9.why}));
    """)
    assert got["before"] == ["title", "*m1", "*m2", "questions"]
    assert got["quiet"] == []
    assert got["up"] == ["Methods"]
    assert got["after"] == ["title", "*m1!", "*m2", "*m3", "questions"]
    assert got["state"] == "updated"


def test_copies_changed_here_are_never_overwritten_unasked():
    got = _run(_TALK + """
      pres.slides.splice(2,1);                      /* deleted here */
      var here=partsRefresh(false),s1=partState.s9.why;
      DECKS.Methods.slides[0].annots[0].text='m1!'; /* and changed there */
      var both=partsRefresh(false),s2=partState.s9.why,w=words();
      var forced=partsRefresh(true);                /* Update */
      console.log(JSON.stringify({here:here,s1:s1,both:both,s2:s2,w:w,
        forced:forced,after:words()}));
    """)
    assert got["here"] == [] and got["s1"] == "here"
    assert got["both"] == [] and got["s2"] == "both"
    assert got["w"] == ["title", "*m1", "questions"]
    assert got["forced"] == ["Methods"]
    assert got["after"] == ["title", "*m1!", "*m2", "questions"]


def test_the_talks_own_slides_in_a_parts_section_survive_an_update():
    got = _run(_TALK + """
      var mine=T('mine');mine.sec='s9';
      pres.slides.splice(3,0,mine);                 /* after the part's */
      DECKS.Methods.slides.push(T('m3'));
      partsRefresh(false);
      console.log(JSON.stringify(words()));
    """)
    assert got == ["title", "*m1", "*m2", "*m3", "mine", "questions"]


def test_a_part_that_cannot_be_found_keeps_its_slides_and_says_so():
    got = _run(_TALK + """
      delete DECKS.Methods;
      draftsLoaded=false;partsRefresh(false);var w1=partState.s9.why;
      draftsLoaded=true;partsRefresh(true);var w2=partState.s9.why;
      console.log(JSON.stringify({w1:w1,w2:w2,slides:words()}));
    """)
    # still loading is not missing
    assert got["w1"] == "waiting" and got["w2"] == "missing"
    assert got["slides"] == ["title", "*m1", "*m2", "questions"]


def test_a_part_never_contains_the_talk_it_is_part_of():
    got = _run("""
      DECKS.A={name:'A',slides:[],sections:{x:{link:{deck:'B'}}}};
      DECKS.B={name:'B',slides:[],sections:{y:{link:{deck:'C'}}}};
      DECKS.C={name:'C',slides:[]};
      pres={name:'C',slides:[]};
      console.log(JSON.stringify([partReaches('A','C'),partReaches('B','A'),
        partReaches('C','A')]));
    """)
    assert got == [True, False, False]


def test_a_master_comes_with_its_slides_once_and_goes_with_them():
    got = _run("""
      DECKS.P={name:'P',masters:{m1:{name:'Dark',bg:'#000'}},
        slides:[T('a'),T('b')]};
      DECKS.P.slides[0].mast='m1';DECKS.P.slides[1].mast='m1';
      pres={name:'Talk',masters:{m1:{name:'Mine',bg:'#fff'}},
        slides:[T('own')],sections:{s9:{name:'P',link:{deck:'P'}}}};
      pres.slides[0].mast='m1';
      partApply('s9',partLook('s9'));
      var once=JSON.stringify(pres.masters),worn=pres.slides.map(
        function(s){return s.mast;});
      partApply('s9',partLook('s9'));                /* again: no second */
      var twice=JSON.stringify(pres.masters);
      pres.slides=pres.slides.filter(function(s){return !s.lk;});
      partMastersPrune();
      console.log(JSON.stringify({once:JSON.parse(once),worn:worn,
        same:once===twice,pruned:pres.masters}));
    """)
    assert got["once"] == {"m1": {"name": "Mine", "bg": "#fff"},
                           "m2": {"name": "Dark", "bg": "#000", "lk": 1}}
    assert got["worn"] == ["m1", "m2", "m2"]
    assert got["same"] is True
    assert got["pruned"] == {"m1": {"name": "Mine", "bg": "#fff"}}


def test_a_parts_slide_that_leaves_its_section_is_the_talks_own():
    got = _run(_TALK + """
      pres.slides[2].sec='';                        /* merged up, say */
      partNorm();
      console.log(JSON.stringify({lk:pres.slides.map(function(s){
        return s.lk||'';}),locks:pres.slides[2].annots}));
    """)
    assert got["lk"] == ["", "s9", "", ""]
    assert got["locks"] == [{"k": "text", "x": 1, "y": 1, "w": 5, "h": 5,
                             "text": "m2", "oid": "om2"}]


# ------------------------------------------------------------- the wiring


def test_a_talk_opens_showing_its_parts_as_they_are(out):
    load = out.split("  function loadPresentation(name){")[1] \
        .split("\n  }\n")[0]
    assert ("    if(typeof partsOnLoad==='function'&&partsOnLoad()) "
            "histReset();") in load
    on = out.split("  function partsOnLoad(){")[1].split("\n  }\n")[0]
    # not before the draft store has answered (T494's trap)
    assert "    if(!pres||!draftsLoaded) return false;" in on
    # ...and the talk the page opened on, once it has
    boot = out.split("  function initFirstPresentation(){")[1] \
        .split("\n  }\n")[0]
    assert "      if(typeof partsAfterDrafts==='function') partsAfterDrafts();" \
        in boot


def test_the_link_and_the_mark_survive_every_load_and_undo(out):
    norm = out.split("  function normPres(p,stem){")[1]
    assert "        if(typeof s.lk==='string'&&s.lk) o.lk=s.lk;" in norm
    assert "          keep[k].link={deck:d.link.deck,sig:String(d.link.sig||'')," \
        in norm
    assert "        if(m[k].link) out[k].link=m[k].link;" in out
    assert "        if(!pres.sections[k].link) delete pres.sections[k].link;" \
        in out
    ns = out.split("  function normSections(){")[1].split("\n  }\n")[0]
    assert "    if(typeof partNorm==='function') partNorm();" in ns


def test_a_part_keeps_its_order_and_takes_no_slide_in(out):
    drop = out.split("      var tgt=filmDropTarget(row,e.clientY);")[1] \
        .split("      var to=tgt.to;")[0]
    assert "partGuardMove(from,tgt.sec)" in drop
    mv = out.split("  function moveSlide(i,d){")[1].split("\n  }\n")[0]
    assert "&&(partGuardMove(i)||partGuardMove(j))) return;" in mv
    nv = out.split("  function newVersion(lay,arr){")[1].split("\n  }\n")[0]
    assert "    if(typeof partSafeAt==='function') at=partSafeAt(at);" in nv
    cp = out.split("  function putSlideCopy(source,i){")[1] \
        .split("\n  }\n")[0]
    assert "      if(cp.lk) partFree(cp);" in cp
    assert "      at=partSafeAt(at);" in cp
    sec = out.split("  function newSection(at,name,quiet){")[1] \
        .split("\n  }\n")[0]
    assert "partOfSlide(pres.slides[at])" in sec


def test_the_parts_view_has_its_doors(out):
    deck = assets.deck_html()
    assert 'id="mi-parts"' in deck and ">Parts of this talk&#8230;<" in deck
    assert 'id="where-part"' in deck
    assert "['parts','Parts of this talk…','Parts…']" in out
    assert "      if(m==='parts'){openParts();return;}" in out
    assert "  partsBoot();" in out
    # the divider of a part says so, in words
    assert "      pb.innerHTML=bic('link')+' part';" in out
    # its questions come up over it
    assert "    if($('#deck-parts')) host=document.body;" in out
    assert "'mi-parts':'parts include input subfile" in out
    assert "57-parts" in assets.DECK_PARTS


def test_a_renamed_part_is_followed(out):
    assert out.count("partRenamed(old,nm);") == 2


def test_the_help_says_how():
    help_html = assets.help_html()
    assert "One talk made of parts." in help_html
    assert "File &rarr; Parts of this\ntalk&hellip;" in help_html
    assert "\\input" in help_html
