"""Moving between a notebook, a deck, Home, the library and a talk does each
piece of work once, and the decisions that make that so RUN here, lifted
out of the deck IIFE (2026-10-09, the owner: "if this is not able to load
quick, and not be laggy, then no matter how good the features are no one
will ever use this").

* a mode switch fits the page and the ribbon once (zoomHold,
  ribbonFitHold): every step that changes the stage or the ribbon used
  to re-fit and re-render on its own, the old slide included;
* going back to a deck that is still open in its tab resumes it -- the
  undo history survives, the strip is reused -- and a deck closed with
  its X comes back fresh, as before (choosePresentation);
* whatever reaches a hidden deck moves deckViewGen, which the strip's
  reuse checks, so a way back never shows a stale figure;
* the lists of decks read a deck's facts once per stored draft, never a
  deep copy (presFacts, savedNameList);
* a talk's address is written when its clicks pause; nothing is typed
  into a talk, and the switch into one commits what was being typed;
* the version clock reads exactly as toLocaleTimeString did;
* a collection is drawn again only when what it was drawn from changed.

The DOM halves (the library's keyboard, its lazy preview, the presenter's
pair, the drawer, the focus coming back) are driven in Chromium by
test_switching_in_the_browser.py.
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


# ------------------------------------------------- one fit per mode switch

# applyZoom's real body runs while its stage reports no slide (counted),
# and fitEditRibbon's real body runs until it asks for the bar (counted).
_HOLD = """
var deckEl={hidden:false},mode='edit',zoomHold=0,zoomOwed=false;
var ribbonFitHold=false,ribbonFitOwed=false,modeSwitching=false;
var zooms=0,fits=0;
var stage={querySelector:function(s){if(s==='.slide') zooms++;return null;}};
function $(s){if(s==='#edit-tools') fits++;return null;}
var plan=null;
function setUIModeRun(m,outer){plan(m,outer);}
"""
_HOLD_FNS = ("applyZoom", "ribbonFitRelease", "fitEditRibbon", "setUIMode")


def test_a_mode_switch_fits_the_page_and_the_ribbon_once():
    got = _run(_HOLD, _HOLD_FNS, r"""
      var out={};
      // entering the editor: four steps re-fit the stage, five the ribbon,
      // then the hold on the ribbon lets go, the slide renders (fitting
      // the page itself) and the group pass fits once more
      plan=function(m,outer){
        applyZoom();applyZoom();applyZoom();applyZoom();
        fitEditRibbon();fitEditRibbon();fitEditRibbon();fitEditRibbon();
        fitEditRibbon();
        out.heldZooms=zooms;out.heldFits=fits;
        if(outer) ribbonFitRelease();
        out.afterRelease=fits;
        applyZoom(true);
        fitEditRibbon();
      };
      setUIMode('edit');
      out.edit={zooms:zooms,fits:fits,owed:zoomOwed,hold:zoomHold,
        rhold:ribbonFitHold,switching:modeSwitching};
      // the builder renders no slide: the page is fitted once, at the end
      zooms=0;fits=0;
      plan=function(){applyZoom();applyZoom();fitEditRibbon();};
      setUIMode('create');
      out.create={zooms:zooms,fits:fits};
      // a switch that throws still lets go, once, and the error is not lost
      zooms=0;fits=0;
      plan=function(){applyZoom();fitEditRibbon();throw new Error('boom');};
      try{setUIMode('edit');out.thrown=false;}catch(e){out.thrown=e.message;}
      out.after={zooms:zooms,fits:fits,hold:zoomHold,rhold:ribbonFitHold,
        switching:modeSwitching};
      // a switch inside a switch runs under the outer one's hold
      zooms=0;fits=0;
      plan=function(m,outer){
        if(outer){
          applyZoom();fitEditRibbon();
          setUIMode('edit');            // the inner call
          out.innerLeft={zooms:zooms,fits:fits,rhold:ribbonFitHold};
        } else {applyZoom();fitEditRibbon();}
      };
      setUIMode('view');
      out.nested={zooms:zooms,fits:fits};
      // outside a switch nothing is held
      zooms=0;fits=0;applyZoom();fitEditRibbon();
      out.free={zooms:zooms,fits:fits};
      console.log(JSON.stringify(out));
    """)
    # held: nothing measured or rendered until the switch lets go
    assert got["heldZooms"] == 0 and got["heldFits"] == 0
    assert got["afterRelease"] == 1          # the ribbon, once, before render
    assert got["edit"] == {"zooms": 1, "fits": 2, "owed": False, "hold": 0,
                           "rhold": False, "switching": False}
    assert got["create"] == {"zooms": 1, "fits": 1}
    assert got["thrown"] == "boom"
    assert got["after"] == {"zooms": 1, "fits": 1, "hold": 0,
                            "rhold": False, "switching": False}
    assert got["innerLeft"] == {"zooms": 0, "fits": 0, "rhold": True}
    assert got["nested"] == {"zooms": 1, "fits": 1}
    assert got["free"] == {"zooms": 1, "fits": 1}


def test_the_switch_commits_typing_lets_go_before_the_strip_and_hands_focus_last():
    """The order inside setUIModeRun is what the lifted holds rely on."""
    src = assets.deck_js()
    from helpers_js import lift_fn
    run = lift_fn(src, "setUIModeRun")
    body = run[run.index("{") + 1:].lstrip()
    # a word still being typed is committed before anything changes: the
    # renders that used to commit it on the way are the held ones
    assert body.startswith("/*") and body.index("flushTextEdits();") \
        < body.index("initEditorTools();")
    rel = run.index("if(outer) ribbonFitRelease();")
    assert rel < run.index("renderCreate();") < run.index("renderSlide();")
    # the strip is offered the mark-only path on the way into the editor
    assert "filmNav=true;\n        try{renderCreate();}finally{filmNav=false;}" \
        in run
    # where the keyboard was is read with the isolation; it is handed over
    # after the last group pass, before the talk's own hand-offs
    assert run.index("var takeFocus=full&&deckFocusNote();") \
        < run.index("if(takeFocus&&!deckEl.hidden) deckFocusTake();") \
        < run.index("if(startingTalk||endingTalk) presenterSync();")
    assert run.index("syncRibbonGroups();\n    /* the editor is laid out "
                     "once") < run.index("deckFocusTake();")


# ------------------------------------------------ going back to a deck

_CHOOSE = """
var window={SemApp:{}};
var pres={name:'talk'},deckEl={hidden:true},mode='edit',cur=4,activePane=2;
var open=['talk','other'],calls=[];
var PFX='p:';
function rawOpenNames(){return open.slice();}
function lsSet(){}
function noteSessionOpen(n){calls.push('note:'+n);}
function loadPresentation(n){calls.push('load:'+n);pres={name:n};}
function isViewPres(){return false;}
function isColPres(){return false;}
function dropPick(){calls.push('drop');}
function openDeck(m,resume){calls.push('open:'+m+':'+(resume===true));}
"""


def test_going_back_to_a_deck_still_open_resumes_it():
    got = _run(_CHOOSE, ("choosePresentation",), r"""
      var out={};
      function trial(name,setup){
        calls=[];pres={name:'talk'};deckEl={hidden:true};mode='edit';
        open=['talk','other'];
        if(setup) setup();
        choosePresentation(name);
        out[name+(setup?':'+setup.label:'')]=calls.join(' ');
      }
      trial('talk');                                  // its tab, Home's Recent
      var x=function(){open=['other'];};x.label='closedX';trial('talk',x);
      var v=function(){deckEl.hidden=false;};v.label='onscreen';trial('talk',v);
      var t=function(){mode='view';};t.label='talkmode';trial('talk',t);
      trial('other');                                 // another deck
      console.log(JSON.stringify(out));
    """)
    # the same session: undo kept, a running pick dropped as a fresh
    # open drops one
    assert got["talk"] == "note:talk drop open:edit:true"
    # closed with its X: fresh, as before (openDeck drops a pick itself)
    assert got["talk:closedX"] == "note:talk open:edit:false"
    assert got["talk:onscreen"] == "note:talk open:edit:false"
    assert got["talk:talkmode"] == "note:talk open:edit:false"
    assert got["other"] == "load:other note:other open:edit:false"


# ---------------------------------- what reaches a hidden deck is counted

_GEN = """
var deckViewGen=0,frameNodeCache={'nb::a::auto':1,'other::b::auto':2};
var cardElMemo=new Map();   /* the strip package's: dropFrameCache empties it */
var viewGens={n:0,all:0,of:Object.create(null)};   /* ...and counts where */
var ITEMS={},SHELLITEMS={},nbPres=[];
function nsKey(s,a){return s+'::'+a;}
function normPres(p){return JSON.parse(JSON.stringify(p));}
var mode='edit',lateFrom=-1,filmGen=3,altOpen={},pres={sections:null};
function filmMode(){return 'thumb';}
function activeCut(){return '';}
"""


def test_whatever_reaches_a_hidden_deck_moves_the_view_generation():
    got = _run(_GEN, ("deckViewChanged", "dropFrameCache", "registerShell",
                      "unregisterShell", "filmStampKey"), r"""
      var out={},k0=filmStampKey();
      dropFrameCache('nb');out.drop=deckViewGen;
      out.kept=Object.keys(frameNodeCache);
      registerShell('nb',{items:[{anchor:'a',kind:'figure'}]});
      out.reg=deckViewGen;
      unregisterShell('nb');out.unreg=deckViewGen;
      dropFrameCache();out.all=deckViewGen;
      out.keyMoved=filmStampKey()!==k0;
      var k1=filmStampKey();out.keyStill=filmStampKey()===k1;
      console.log(JSON.stringify(out));
    """)
    assert got["drop"] == 1 and got["kept"] == ["other::b::auto"]
    assert got["reg"] == 2 and got["unreg"] == 3 and got["all"] == 4
    # the strip's reuse key moves with it, and only with it
    assert got["keyMoved"] and got["keyStill"]


def test_every_hidden_deck_branch_counts_its_change():
    """The deck skips a refresh while hidden; each such change has to be
    one that moves deckViewGen (directly or through dropFrameCache)."""
    src = assets.deck_js()
    from helpers_js import lift_fn
    # embedded copies (embPut -> dropFrameCache), notebooks
    # opened/reloaded/closed, a version's cards arriving
    assert "dropFrameCache(key);" in lift_fn(src, "embPut")
    # (the strip package names WHERE: the notebook, or the card)
    for fn in ("registerShell", "unregisterShell"):
        assert "deckViewChanged(stem);" in lift_fn(src, fn)
    assert "deckViewChanged();   /* a locked frame can be drawn now */" in src
    assert "deckViewChanged(stemOrRef);" in lift_fn(src, "dropFrameCache")
    assert "filmGen,deckViewGen," in lift_fn(src, "filmStampKey")


# -------------------------------------------- a list reads facts, once

_FACTS = """
var pres={name:'live',page:'a0',kind:'',slides:[1,2,3],folder:'f'};
var DRAFTS={},parsed=0;
var projectPres=[{name:'proj',slides:[1],page:'',kind:'view',folder:''},
  {name:'clash',slides:[1,2],kind:'',folder:''}];
var nbPres=[{name:'nbdeck',origin:'nb1',slides:[1,2,3,4],kind:'collection',
  items:[1,2],folder:'g'},{name:'clash',origin:'nb2',slides:[9],kind:''}];
var presFactsMemo={};
function draftGet(n){var v=DRAFTS[n];return v==null?null:v;}
function normPres(d){return d;}
function loadDraft(name){
  var raw=draftGet(name);if(!raw) return null;parsed++;
  try{var d=JSON.parse(raw);return (d&&Array.isArray(d.slides))?d:null;}
  catch(e){return null;}
}
function deep(o){return JSON.parse(JSON.stringify(o));}
"""
_FACTS_FNS = ("presFactsOf", "savedRawByName", "savedNameList", "presFacts",
              "allSaved", "savedByName", "presentationByName")


def test_a_list_reads_each_deck_once_per_draft_and_never_copies():
    got = _run(_FACTS, _FACTS_FNS, r"""
      var out={},names=['live','proj','clash','clash (nb2)','nbdeck','drafted',
        'broken','missing'];
      DRAFTS.drafted=JSON.stringify({name:'drafted',slides:[1,2],page:'a1',
        kind:'',folder:'h'});
      DRAFTS.broken='{not json';
      DRAFTS.proj=JSON.stringify({name:'proj',slides:[1,1,1,1,1]});
      // what presentationByName would give, field by field
      function viaDeck(n){
        var p=presentationByName(n); if(!p) return null;
        return {page:p.page||'',kind:p.kind||'',slides:(p.slides||[]).length,
          folder:p.folder||'',
          items:Array.isArray(p.items)?p.items.length:0};
      }
      function viaFacts(n){
        var f=presFacts(n); if(!f) return null;
        return {page:f.page,kind:f.kind,slides:f.slides,folder:f.folder,
          items:f.items};
      }
      out.same=names.every(function(n){
        return JSON.stringify(viaDeck(n))===JSON.stringify(viaFacts(n));});
      out.diff=names.filter(function(n){
        return JSON.stringify(viaDeck(n))!==JSON.stringify(viaFacts(n));});
      presFactsMemo={};parsed=0;
      for(var i=0;i<5;i++) names.forEach(presFacts);
      out.parsesForFiveLists=parsed;      // drafted, proj, broken: once each
      DRAFTS.drafted=JSON.stringify({name:'drafted',slides:[1,2,3,4,5,6]});
      parsed=0;out.after=presFacts('drafted').slides;out.reparsed=parsed;
      delete DRAFTS.proj;out.backToSaved=presFacts('proj').slides;
      out.names=JSON.stringify(savedNameList())===
        JSON.stringify(allSaved().map(function(p){return p.name;}));
      out.list=savedNameList();
      console.log(JSON.stringify(out));
    """)
    assert got["same"], got["diff"]
    assert got["parsesForFiveLists"] == 3
    assert got["after"] == 6 and got["reparsed"] == 1
    assert got["backToSaved"] == 1
    assert got["names"] and got["list"] == ["proj", "clash", "nbdeck",
                                            "clash (nb2)"]


def test_the_tabs_and_rows_ask_for_facts_not_decks():
    src = assets.deck_js()
    from helpers_js import lift_fn
    assert "var p=presFacts(name);" in lift_fn(src, "presentationSummary")
    assert "presFacts(nm)||{name:nm}" in lift_fn(src, "presItem")
    for fn in ("renderTopPresTabs", "renderPresTabs"):
        body = lift_fn(src, fn)
        assert "savedNameList()" in body and "allSaved()" not in body
    assert "!!presFacts(n)" in lift_fn(src, "openPresentationNames")


# ----------------------------------------- a talk's address, a talk's keys

_ROUTE = """
var timers=[],now=0,writes=0;
function setTimeout(f,ms){timers.push({f:f,at:now+ms});return timers.length;}
function clearTimeout(id){if(id&&timers[id-1]) timers[id-1].f=null;}
function tick(ms){now+=ms;timers.forEach(function(t){
  if(t.f&&t.at<=now){var f=t.f;t.f=null;f();}});}
var window={SemApp:{updateHash:function(){writes++;}}};
var mode='view',deckEl={hidden:false},routeT=null,ROUTE_TALK_MS=250;
"""


def test_a_talk_writes_its_address_when_its_clicks_pause():
    got = _run(_ROUTE, ("routeSync", "routeSyncNow", "routeFlush"), r"""
      var out={};
      for(var i=0;i<5;i++){routeSync();tick(100);}
      out.during=writes;
      tick(300);out.paused=writes;
      routeSync();routeFlush();out.flushed=writes;tick(400);
      out.noDouble=writes;
      mode='edit';routeSync();out.editing=writes;
      mode='view';deckEl.hidden=true;routeSync();out.hidden=writes;
      deckEl.hidden=false;routeSync();
      deckEl.hidden=true;routeSync();    // closing writes at once, once
      tick(400);out.closed=writes;
      console.log(JSON.stringify(out));
    """)
    assert got == {"during": 0, "paused": 1, "flushed": 2, "noDouble": 2,
                   "editing": 3, "hidden": 4, "closed": 5}


_FLUSH = """
var mode='view',asked=0,flushed=0,liveEds=new Set(),quietOwed=[];
var document={querySelectorAll:function(){asked++;return [];}};
var ed={isConnected:true,getAttribute:function(){return 'true';},
  __jvFlush:function(){flushed++;}};
"""


def test_nothing_is_typed_into_a_talk():
    # (since 2026-10-09 the open editors are a kept list, liveEditors,
    # and no flush asks the page at all: `asked` stays 0)
    got = _run(_FLUSH, ("liveEdOn", "liveEditors", "quietSettle",
                        "flushTextEdits"), r"""
      var out={};liveEdOn(ed);
      flushTextEdits();out.view=[asked,flushed];
      mode='edit';flushTextEdits();out.edit=[asked,flushed];
      mode='create';flushTextEdits();out.create=[asked,flushed];
      console.log(JSON.stringify(out));
    """)
    assert got == {"view": [0, 0], "edit": [0, 1], "create": [0, 2]}
    src = assets.deck_js()
    # every way out of the page still writes a pending address
    assert "routeFlush();" in src[src.index("function lastChance(e){"):][:400]
    # go() (the talk's slide change) asks through routeSync too
    assert "routeSync();   /* a talk's address is written when its clicks " \
        "pause */" in src


# --------------------------------------------------------- the clock

def test_the_version_clock_reads_as_before():
    got = _run("var histClockFmt=null;", ("histClock",), r"""
      var ms=[0,1700000000000,1760000000000,1760003600000+59*60000,
        Date.UTC(2026,9,9,23,5)];
      console.log(JSON.stringify(ms.map(function(m){
        return [histClock(m),new Date(m).toLocaleTimeString([],
          {hour:'2-digit',minute:'2-digit'})];})));
    """)
    for mine, theirs in got:
        assert mine == theirs


# --------------------------------------------- a collection, drawn once

_COL = """
var window={SemApp:{activate:function(){},refilter:function(){}}};
var deckViewGen=0,draws=0,sh={el:{}};
var pres={name:'col',kind:'collection',items:[{id:'a',k:'cell',ref:'nb::x'}]};
function colShell(){return sh;}
function colKey(n){return 'col:'+n;}
function renderPresTabs(){}
function colRender(s,model){draws++;
  s._colDrawn={model:model,view:deckViewGen,sig:colDrawSig(model)};}
"""


def test_going_back_to_a_collection_draws_it_only_when_it_changed():
    got = _run(_COL, ("colDrawSig", "colShow"), r"""
      var out=[];
      colShow();out.push(draws);            // first time: drawn
      colShow();out.push(draws);            // back to it: kept
      pres.items[0].fold=1;colShow();out.push(draws);   // its items changed
      deckViewGen++;colShow();out.push(draws);   // a notebook moved under it
      pres={name:'col',kind:'collection',items:pres.items};
      colShow();out.push(draws);            // another copy of it
      pres.live={'nb::x':1};colShow();out.push(draws);  // a live link
      colShow();out.push(draws);
      console.log(JSON.stringify(out));
    """)
    assert got == [1, 1, 2, 3, 4, 5, 5]
    src = assets.deck_js()
    from helpers_js import lift_fn
    # the real renderer records what it drew, at its end
    assert lift_fn(src, "colRender").rstrip()[:-1].rstrip().endswith(
        "sh._colDrawn={model:model,view:deckViewGen,sig:colDrawSig(model)};")
