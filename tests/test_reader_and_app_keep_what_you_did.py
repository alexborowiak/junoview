"""Six reader and app bugs found by the load-cost and T613 reviewers, each
reproduced in Chromium on 27be2a9 before it was fixed (2026-10-11).

1. Save as view threw "Cannot read properties of undefined (reading '0')":
   the new view was built by hand without `slides`, and its first change
   reached the size readout, which reads pres.slides[cur].
2. The reader called a toast that is not there: APP.toast (Pages on a
   notebook of one section) was never defined, and the Variables pane
   called the editor's bare `toast`, out of scope in app.js -- it threw.
3. Find's smooth scroll was aimed at the page as laid out when it began;
   the cards it passed were laid out on the way, and at 1280x600 an
   ordinary match landed at y 95, under the ribbon.
4. Reload with Find open started Find again from the first match, a
   screen and more away, while the reading hold kept the page where it
   was: "1 / 23" for a match off screen.
5. An edit made just before a reload or a tab close was lost: the draft
   write went to IndexedDB from pagehide and the page was gone first; and
   a collection reordered three seconds before a reload came back drawn
   from the project's older copy.
6. Closing the last notebook with a collection's or a presentation's
   tab open went Home, the address still naming the notebook closed.

The pure halves run here -- the real functions lifted out of app.js and
the deck, run in node over small stand-ins -- or as checks on the source.
Each is driven end to end in Chromium by
test_reader_and_app_keep_what_you_did_in_a_browser.py (opt-in).
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets


def _run(code: str):
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(code, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


# ------------------------------------------------- 1. a view has slides


def _literals(src: str, head: str) -> list[str]:
    """every object literal assigned by `head` (e.g. "pres={"), whole"""
    out = []
    for m in re.finditer(re.escape(head), src):
        i = m.end() - 1
        depth = 0
        for k in range(i, len(src)):
            if src[k] == "{":
                depth += 1
            elif src[k] == "}":
                depth -= 1
                if depth == 0:
                    out.append(src[i:k + 1])
                    break
    return out


def test_every_deck_the_editor_puts_on_screen_has_slides():
    """`pres` is read as pres.slides[cur] by every readout markDirty
    reaches; a deck made by hand without them threw on its first change
    (Save as view). A literal must carry slides, or be made by normPres,
    which gives every kind its slides (a view's are [])."""
    deck = assets.deck_js()
    lits = _literals(deck, "pres={")
    assert len(lits) >= 2      # the new deck and the new poster
    for lit in lits:
        assert "slides:" in lit, lit[:120]
    view = lift_fn(deck, "newCustomView")
    assert "pres=normPres({name:name,kind:'view'" in view


def test_a_view_normalised_has_the_slides_a_deck_has():
    deck = assets.deck_js()
    out = _run(lift_fn(deck, "normPres") + r"""
function deep(o){return JSON.parse(JSON.stringify(o));}
function colNorm(){throw new Error('not a collection');}
var v=normPres({name:'custom view',kind:'view',nb:'nb',style:{},
  view:{def:{plot:'hidden'}}});
console.log(JSON.stringify([Array.isArray(v.slides),v.slides.length,
  v.kind,v.nb,v.view.def.plot]));
""")
    assert out == [True, 0, "view", "nb", "hidden"]


def test_a_view_the_old_build_kept_without_slides_still_opens():
    """the build with the bug wrote the view's draft as it had built it,
    with no `slides`, and loadDraft refused it: listed as a deck, it
    opened the automatic presentation (2026-10-12 review)"""
    deck = assets.deck_js()
    out = _run(lift_fn(deck, "loadDraft") + lift_fn(deck, "normPres")
               + r"""
function deep(o){return JSON.parse(JSON.stringify(o));}
function colNorm(){throw new Error('not a collection');}
var DRAFTS={old:JSON.stringify({name:'old',kind:'view',nb:'nb',style:{},
  view:{def:{plot:'hidden'}}}),junk:JSON.stringify({name:'junk'})};
function draftGet(n){return DRAFTS[n]==null?null:DRAFTS[n];}
var v=loadDraft('old');
console.log(JSON.stringify([v&&v.kind,v&&v.slides,v&&v.view.def.plot,
  loadDraft('junk')]));
""")
    assert out == ["view", [], "hidden", None]


# ------------------------------------------ 2. the reader's own toast


def test_every_app_method_the_reader_calls_is_one_something_defines():
    """APP.toast was called and never defined: Pages on a notebook of one
    section said nothing at all. Every APP.x( call in app.js names a
    method app.js or the editor assigns (the editor's are guarded where
    it may not have loaded -- test_the_editor_loads_on_first_use)."""
    app = assets.app_js()
    deck = assets.deck_js()
    called = set(re.findall(r"(?<![\w.])APP\.(\w+)\s*\(", app))
    defined = set(re.findall(
        r"(?<![\w.])(?:window\.)?(?:APP|SemApp)\.(\w+)\s*=(?!=)",
        app + deck))
    assert len(called) > 20
    assert called <= defined, sorted(called - defined)


def test_the_reader_never_calls_the_editors_toast():
    """`toast` is the editor's (60-saving-and-export.js), not in scope in
    app.js: the Variables pane's `toast?toast(...):0` threw "toast is not
    defined" on a notebook with no variables. The reader's is docToast."""
    app = assets.app_js()
    assert "function toast(" not in app
    bare = re.findall(r"(?<![\w.$'\"-])toast\s*[(?]", app)
    assert bare == []
    pages = lift_fn(app, "togglePages")
    assert "docToast('This notebook has one section" in pages


# ----------------------------------- 3. where a Find match lands


FIND_SHOW = r"""
var L={},T={},tid=0;
var window={innerHeight:600,
  addEventListener:function(t,f){(L[t]=L[t]||[]).push(f);},
  removeEventListener:function(t,f){
    L[t]=(L[t]||[]).filter(function(g){return g!==f;});}};
function fire(t){(L[t]||[]).slice().forEach(function(f){f({type:t});});}
function heard(){return Object.keys(L).reduce(function(n,k){
  return n+L[k].length;},0);}
function setTimeout(f){T[++tid]=f;return tid;}
function clearTimeout(id){delete T[id];}
function quiet(){var fs=Object.keys(T).map(function(k){return T[k];});
  T={};fs.forEach(function(f){f();});}
function $(s){
  if(s==='#apptop') return {getBoundingClientRect:function(){
    return {bottom:126};}};
  if(s==='#docfind') return {hidden:false,getBoundingClientRect:function(){
    return {bottom:168};}};
  return null;}
/* a match that lands at tops[0] after its first glide, tops[1] after
   the next... (the last again after that) */
function mark(tops){var m={glides:0,isConnected:true,
  getClientRects:function(){return [1];},
  getBoundingClientRect:function(){
    var t=tops[Math.min(m.glides-1,tops.length-1)];
    return {top:t,bottom:t+16};},
  scrollIntoView:function(o){m.glides++;m.how=o.block+' '+o.behavior;}};
  return m;}
var findLand=null,out=[];
/* 1. lands under the Find bar (the page settled under the glide): it is
      glided to again, from close by, and then left alone */
var m=mark([95,292]);findShow(m);
fire('scroll');fire('scroll');fire('scrollend');   /* the first glide */
fire('scrollend');                                 /* the second */
out.push([m.glides,m.how,findLand===null,heard()]);
/* 2. lands where it should: one glide, nothing more */
m=mark([292]);findShow(m);fire('scrollend');
out.push([m.glides,findLand===null,heard()]);
/* 3. never lands (a match the page cannot bring below the chrome):
      three more tries, then left -- and no scrollend at all is fine */
m=mark([95]);findShow(m);quiet();quiet();quiet();quiet();quiet();
out.push([m.glides,findLand===null,heard()]);
/* 4. off the bottom of the window: glided to again */
m=mark([590,300]);findShow(m);fire('scrollend');fire('scrollend');
out.push([m.glides,findLand===null]);
/* 5. the reader's wheel meanwhile: the page stays where they put it */
m=mark([95]);findShow(m);fire('wheel');fire('scrollend');quiet();
out.push([m.glides,findLand===null,heard()]);
/* 6. the match goes (findClear): nowhere to land */
m=mark([95]);findShow(m);m.isConnected=false;fire('scrollend');
out.push([m.glides,findLand===null,heard()]);
/* 7. the next match takes over from one still landing */
var a=mark([95]),b=mark([95,300]);findShow(a);findShow(b);
fire('scrollend');fire('scrollend');
out.push([a.glides,b.glides,findLand===null,heard()]);
console.log(JSON.stringify(out));
"""


def test_a_find_match_is_glided_to_again_until_it_lands_below_the_chrome():
    """the glide is aimed at the page as laid out when it starts; where it
    landed is looked at once the page is still, and a match not wholly
    on screen below the header and the Find bar is glided to again"""
    app = assets.app_js()
    out = _run(lift_fn(app, "findBandTop") + lift_fn(app, "findShow")
               + FIND_SHOW)
    assert out == [[2, "center smooth", True, 0],
                   [1, True, 0],
                   [4, True, 0],
                   [2, True],
                   [1, True, 0],
                   [1, True, 0],
                   [1, 2, True, 0]]
    # every match Find goes to lands this way
    go = lift_fn(app, "findGo")
    assert "findShow(m);" in go and "scrollIntoView" not in go


# ------------------------------------------ 4. Find across a Reload


FIND_AGAIN = r"""
var bar={hidden:false},inp={value:' blocking '};
function $(s){return s==='#docfind'?bar:s==='#docfind-in'?inp:null;}
var runs=[];function findRun(t,keep){runs.push([t,keep]);}
var findRoot,findStem,findAt;
var out=[];
function go(rootConnected,stem,ev){
  findRoot={isConnected:rootConnected};findStem='nb';findAt=3;runs=[];
  findAgain(ev);out.push(runs[0]);}
go(false,'nb',{detail:{stem:'nb'}});     /* Reload: the same notebook again */
go(true,'nb',{detail:{stem:'nb'}});      /* ...unchanged on disk: not remounted */
go(true,'other',{detail:{stem:'other'}}); /* a tab switch */
go(false,'other',{detail:{stem:'other'}});/* another notebook mounted */
go(false,'nb',undefined);                 /* Raw left (findFollow) */
bar.hidden=true;runs=[];findAgain({detail:{stem:'nb'}});out.push(runs.length);
console.log(JSON.stringify(out));
"""


def test_find_stays_on_its_match_when_the_notebook_is_mounted_again():
    """Reload re-runs Find over the new cards: it is the match you were
    on that stays current (and is taken on screen), not the first"""
    out = _run(lift_fn(assets.app_js(), "findAgain") + FIND_AGAIN)
    assert out == [["blocking", 3], ["blocking", 3], ["blocking", -1],
                   ["blocking", -1], ["blocking", -1], 0]


def test_the_match_kept_is_clamped_to_the_matches_there_are_now():
    out = _run(lift_fn(assets.app_js(), "findMarkAll") + r"""
var nEl={textContent:''};function $(){return nEl;}
var findHits=[],findAt=-1,findTerm='x',went=[];
function findMark(sh,t){return new Array(sh.n).fill(0);}
function findGo(d){findAt+=d;went.push(findAt);}
[[5,3],[5,-1],[2,3],[5,0]].forEach(function(c){
  findAt=-1;findMarkAll({n:c[0]},c[1]);});
console.log(JSON.stringify(went));
""")
    assert out == [3, 0, 1, 0]


def test_the_reading_hold_yields_to_a_find_landing():
    """a Reload holds the card being read in place every frame for a
    second; with Find taking you to its match that hold stopped the
    glide where it stood"""
    rb = lift_fn(assets.app_js(), "readingBack")
    assert "if(!mine||findLand||!c.isConnected" in rb
    assert "if(y&&!findLand){" in rb


# ------------------------------------- 5. the page's last chance, kept


LAST_CHANCE = r"""
var PFX='sempres:x:';
var DRAFTS={},draftsDbFull=false,draftsUnsure={},draftsInLs={};
var LS={};
var localStorage={setItem:function(k,v){LS[k]=String(v);},
  getItem:function(k){return k in LS?LS[k]:null;},
  removeItem:function(k){delete LS[k];}};
function lsDel(k){delete LS[k];}
var puts=[];
function idbPut(k,v){return new Promise(function(res,rej){
  puts.push({k:k,v:v,res:res,rej:rej});});}
function idbDel(){return Promise.resolve();}
function tick(){return new Promise(function(r){setTimeout(r,0);});}
var K=PFX+'talk',out=[];
(async function(){
  draftSet('talk','v1');
  out.push(LS[K]===undefined);         /* nothing written per edit */
  draftsLastChance();
  out.push(LS[K]);                     /* not confirmed: kept now */
  puts[0].res();await tick();
  out.push(LS[K]===undefined);         /* confirmed: the copy goes */
  draftsLastChance();
  out.push(LS[K]===undefined);         /* nothing left unsure */
  draftSet('talk','v2');draftsLastChance();
  draftSet('talk','v3');
  out.push(LS[K]===undefined);         /* a later write drops the copy */
  puts[1].res();await tick();          /* v2 lands, v3 still out */
  draftsLastChance();
  out.push(LS[K]);
  draftSet('other','o1');puts[3].rej(new Error('refused'));await tick();
  draftsLastChance();
  out.push(LS[PFX+'other']);           /* refused: kept here instead */
  draftDel('talk');draftsLastChance();
  out.push(LS[K]===undefined);         /* deleted on purpose: gone */
  localStorage.setItem=function(){throw new Error('QuotaExceeded');};
  draftSet('big','b1');draftsLastChance();
  out.push(LS[PFX+'big']===undefined); /* a full browser is no throw */
  console.log(JSON.stringify(out));
})();
"""


def test_a_draft_indexeddb_has_not_confirmed_is_kept_at_the_last_chance():
    deck = assets.deck_js()
    body = "\n".join(lift_fn(deck, n) for n in
                     ("draftSet", "draftDel", "draftsLastChance"))
    out = _run(body + LAST_CHANCE)
    assert out == [True, "v1", True, True, True, "v3", "o1", True, True]


def test_the_last_chance_keeps_the_drafts_after_flushing_them():
    """pagehide and the tab hidden: the text still in the DOM, then the
    debounced draft, then what IndexedDB has not confirmed -- in that
    order, each feeding the next"""
    deck = assets.deck_js()
    lc = lift_fn(deck, "lastChance")
    order = [lc.index(s) for s in ("flushTextEdits();", "flushDraftWrite();",
                                   "draftsLastChance();")]
    assert order == sorted(order)
    # nothing extra per keystroke: the edit path only notes the string
    assert "draftsLastChance" not in lift_fn(deck, "markDirty")
    assert "draftsLastChance" not in lift_fn(deck, "writeDraftNow")


def test_a_collection_open_when_its_draft_arrives_is_drawn_from_it():
    """boot opens a deck before IndexedDB has answered; when the draft
    turns out newer, it replaces the copy -- and a collection's feed,
    which the deck stage's refresh() does not draw, is drawn again"""
    init = lift_fn(assets.deck_js(), "initFirstPresentation")
    swap = init.split("loadPresentation(want);")[1].split("\n      }")[0]
    assert "else if(isColPres(pres)) colRefresh(pres.name);" in swap


# -------------------------------- 6. closing a tab is not going Home


CLOSE = r"""
var calls=[];
function mk(stem,o){var el={parentNode:{removeChild:function(){}}};
  return Object.assign({el:el,path:'/p/'+stem+'.ipynb'},o||{});}
var APP,saveFor={},defBy={},scopeSeeded={},secF={},secScope={},scopeOpen={};
var atHome=false;   /* app.js: Home is showing */
function saveLayout(){}function shellTeardown(){}
function activate(k){calls.push('activate '+k);APP.active=k;}
function updateHash(){calls.push('address');}
function renderRawBtn(){}function renderViewBtns(){}function renderTabs(){}
function api(){return Promise.resolve();}function webUnnote(){}
var document={dispatchEvent:function(e){calls.push(e.type);}};
function CustomEvent(t){this.type=t;}
/* deck: the editor's hooks (it has loaded), or none (it has not) */
function setup(o,deck){
  APP=Object.assign({mode:'app',shells:{},order:[],traces:[],active:null},o);
  if(deck){
    APP.deckState=function(){return deck.on||null;};
    APP.deckLastTab=function(){return deck.last||'';};
    APP.deckChoose=function(n){calls.push('choose '+n);};
  }
  calls=[];}
var out=[];
/* the last notebook, a collection's tab open beside it */
setup({order:['nb'],active:'nb'},{last:'c1'});APP.shells.nb=mk('nb');
closeNotebook('nb');out.push(calls.slice());
/* ...or a presentation's */
setup({order:['nb'],active:'nb'},{last:'talk'});APP.shells.nb=mk('nb');
closeNotebook('nb');out.push(calls.slice());
/* another notebook open too: the last notebook, as before */
setup({order:['a','nb'],active:'nb'},{last:'c1'});
APP.shells.a=mk('a');APP.shells.nb=mk('nb');
closeNotebook('nb');out.push(calls.slice());
/* nothing else open: Home, and the address says so */
setup({order:['nb'],active:'nb'},{});APP.shells.nb=mk('nb');
closeNotebook('nb');out.push(calls.slice());
/* ...the same with the editor not loaded */
setup({order:['nb'],active:'nb'});APP.shells.nb=mk('nb');
closeNotebook('nb');out.push(calls.slice());
/* a deck on screen owns the window: it stays */
setup({order:['nb'],active:'nb'},{on:{name:'talk'},last:'talk'});
APP.shells.nb=mk('nb');
closeNotebook('nb');out.push(calls.slice());
/* a notebook not on screen closed: the screen stays */
setup({order:['a','nb'],active:'a'},{last:'c1'});
APP.shells.a=mk('a');APP.shells.nb=mk('nb');
closeNotebook('nb');out.push(calls.slice());
/* a trace tab closed: back to its notebook */
setup({order:['nb'],traces:['tr'],active:'tr'},{last:'c1'});
APP.shells.nb=mk('nb');APP.shells.tr=mk('tr',{trace:true,source:'nb'});
closeNotebook('tr');out.push(calls.slice());
/* closed from Home, a collection's tab open: Home stays, and so does
   its address -- this opened the collection, or a deck's slide editor */
setup({order:['nb'],active:'nb'},{last:'c1'});APP.shells.nb=mk('nb');
atHome=true;closeNotebook('nb');atHome=false;out.push(calls.slice());
console.log(JSON.stringify(out));
"""


def test_closing_the_last_notebook_goes_to_the_tab_left_not_home():
    """with no notebook left, the last of the editor's tabs in the row is
    pressed -- after sem:shellclosed, so the editor has let the notebook
    go -- and Home is where closing the last tab of all leads"""
    out = _run(lift_fn(assets.app_js(), "closeNotebook") + CLOSE)
    assert out == [["sem:shellclosed", "choose c1"],
                   ["sem:shellclosed", "choose talk"],
                   ["activate a", "sem:shellclosed"],
                   ["sem:shellclosed", "address"],
                   ["sem:shellclosed", "address"],
                   ["sem:shellclosed", "address"],
                   ["sem:shellclosed"],
                   ["activate nb"],
                   ["sem:shellclosed"]]


def test_the_tab_left_is_the_last_open_one_a_notebook_is_not_needed_for():
    """a custom view is a notebook's own and goes with it; a collection,
    a presentation or a poster is a document of its own"""
    deck = assets.deck_js()
    out = _run(lift_fn(deck, "deckLastTab") + lift_fn(deck, "isViewPres")
               + r"""
var KIND={talk:'',c1:'collection',v1:'view',poster:''},open=[];
function openPresentationNames(){return open;}
function presFacts(nm){return {name:nm,kind:KIND[nm]};}
var out=[];
[['talk','c1'],['c1','talk'],['talk','v1'],['v1'],[]].forEach(function(o){
  open=o;out.push(deckLastTab());});
console.log(JSON.stringify(out));
""")
    assert out == ["c1", "talk", "talk", "", ""]
    assert "window.SemApp.deckLastTab=deckLastTab;" in deck
