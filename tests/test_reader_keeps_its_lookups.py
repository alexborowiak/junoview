"""The reader keeps what it looked up, and asks again only when what it
was looked up from changed (2026-10-09, speed: reader findings 1-17).

The real functions are lifted out of app.js and the deck and run in node
over small stand-ins for the page, so what is checked is what ships. The
whole of each mechanism in a real page is driven in Chromium by
test_reader_in_the_browser.py (opt-in).
"""

from __future__ import annotations

import json
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


def _app(*names: str) -> str:
    src = assets.app_js()
    return "\n".join(lift_fn(src, n) for n in names)


def test_the_tree_routes_its_edges_once_a_frame_and_once_late():
    """reader #9: every caller queued a frame pass and a timer pass of its
    own; a host now has one of each waiting, the timer pushed back."""
    got = _run(r"""
var frames=[],timers=[],now=0,routed=0;
function requestAnimationFrame(f){frames.push(f);return frames.length;}
function setTimeout(f,ms){timers.push({f:f,at:now+ms});return timers.length;}
function clearTimeout(id){if(id&&timers[id-1]) timers[id-1].f=null;}
function frame(){var f=frames;frames=[];f.forEach(function(x){x();});}
function tick(ms){now+=ms;timers.forEach(function(t){
  if(t.f&&t.at<=now){var f=t.f;t.f=null;f();}});}
function treeLayoutEdges(host){routed++;}
""" + _app("relayoutTreeHost") + r"""
var host={},out={};
for(var i=0;i<5;i++) relayoutTreeHost(host);   /* the build + 4 observers */
out.queuedFrames=frames.length;
frame();out.afterFrame=routed;
tick(60);relayoutTreeHost(host);   /* late content: the timer moves back */
frame();out.secondFrame=routed;
tick(100);out.notYet=routed;
tick(30);out.late=routed;
tick(500);out.end=routed;
relayoutTreeHost(null);
console.log(JSON.stringify(out));
""")
    assert got == {"queuedFrames": 1, "afterFrame": 1, "secondFrame": 2,
                   "notYet": 2, "late": 3, "end": 3}


def test_switching_tabs_keeps_the_tabs_when_only_the_highlight_moves():
    """reader #10: the tabs' key is what makeTab draws from, and the tab on
    screen is not part of it."""
    got = _run(r"""
var APP={mode:'app',order:['a','b'],traces:['t1'],cols:[],active:'a',
  shells:{a:{title:'A',path:'/x/a.ipynb'},b:{title:'B',path:'/x/b.ipynb'},
    t1:{title:'trace',trace:true,source:'a'}}};
""" + _app("tabStems", "tabsKeyOf") + r"""
var out={};
out.stems=tabStems();
var k0=tabsKeyOf(tabStems());
APP.active='b';out.activeOnly=tabsKeyOf(tabStems())===k0;
APP.shells.b.version='git:abc';out.version=tabsKeyOf(tabStems())===k0;
delete APP.shells.b.version;out.back=tabsKeyOf(tabStems())===k0;
APP.shells.a.title='A2';out.title=tabsKeyOf(tabStems())===k0;
APP.shells.a.title='A';APP.order=['b','a'];
out.order=tabsKeyOf(tabStems())===k0;
APP.order=['a','b'];APP.mode='web';out.mode=tabsKeyOf(tabStems())===k0;
console.log(JSON.stringify(out));
""")
    assert got == {"stems": ["a", "t1", "b"], "activeOnly": True,
                   "version": False, "back": True, "title": False,
                   "order": False, "mode": False}


def test_the_decks_tabs_care_which_notebook_is_on_screen_only_for_collections():
    src = assets.deck_js()
    got = _run(lift_fn(src, "colKey") + "\nvar COL_PFX='col::';\n"
               + lift_fn(src, "presTabsColActive") + r"""
console.log(JSON.stringify([presTabsColActive('example'),
  presTabsColActive(null),presTabsColActive('col::My things')]));
""")
    assert got == ["", "", "col::My things"]
    inputs = lift_fn(src, "presTabsInputs")
    assert "presTabsColActive(A.active)" in inputs
    assert "\n      A.active," not in inputs


def test_a_notebooks_pages_are_worked_out_once_and_handed_out_as_copies():
    """reader #11: pageRuns is kept with the notebook's index."""
    got = _run(r"""
var made=0;
function sec(id,lv,t){return {dataset:{sec:id,level:String(lv)},
  querySelector:function(){return {childNodes:[{textContent:t}]};}};}
var IX={secs:[sec('a',1,'Title'),sec('b',2,'One'),sec('c',3,'One.1'),
  sec('d',2,'Two')]};
function shellIdx(sh){return IX;}
""" + _app("pageRuns", "pageRunsOf").replace(
        "function pageRunsOf(rows){",
        "function pageRunsOf(rows){made++;") + r"""
var r1=pageRuns({});r1[0].sids.push('zz');r1.pop();
var r2=pageRuns({});
console.log(JSON.stringify({made:made,runs:r2}));
""")
    assert got["made"] == 1
    assert got["runs"] == [
        {"sid": "b", "sids": ["a", "b", "c"], "title": "One"},
        {"sid": "d", "sids": ["d"], "title": "Two"}]


def test_attributes_are_written_only_when_they_differ():
    got = _run(r"""
var writes=0;
var el={a:{'aria-pressed':'true'},getAttribute:function(k){
  return k in this.a?this.a[k]:null;},
  setAttribute:function(k,v){writes++;this.a[k]=v;}};
""" + _app("setAttrIf") + r"""
setAttrIf(el,'aria-pressed','true');setAttrIf(el,'title','x');
setAttrIf(el,'title','x');setAttrIf(el,'aria-pressed','false');
console.log(JSON.stringify({writes:writes,a:el.a}));
""")
    assert got == {"writes": 2,
                   "a": {"aria-pressed": "false", "title": "x"}}


def test_the_filters_reach_the_notebook_asked_for_or_every_registered_one():
    got = _run(r"""
function sh(c){return {el:{isConnected:c}};}
var APP={order:['a','b','gone'],traces:['t'],cols:['c'],
  shells:{a:sh(true),b:sh(true),gone:sh(false),t:sh(true),c:sh(true)}};
function tabList(){return APP.order.concat(APP.traces,APP.cols);}
""" + _app("filterShells") + r"""
var all=filterShells();
console.log(JSON.stringify({one:filterShells('b').map(function(e){
    return e===APP.shells.b.el;}),
  none:filterShells('nope').length,gone:filterShells('gone').length,
  all:all.length}));
""")
    assert got == {"one": [True], "none": 0, "gone": 0, "all": 4}


def test_a_notebook_not_shown_yet_is_not_indexed_by_an_all_notebook_pass():
    """its wake indexes it (initShell drops any index and refilters it):
    one made before, at boot and every all-notebook pass, was thrown away
    (review, 2026-10-10)"""
    got = _run(r"""
function sh(stem,lazy){return {el:{isConnected:true,dataset:{nb:stem}},
  lazy:lazy};}
var APP={order:['a','b'],traces:[],cols:[],
  shells:{a:sh('a',false),b:sh('b',true)}};
function tabList(){return APP.order.concat(APP.traces,APP.cols);}
var secF={},indexed=[];
function fkey(s,i){return s+'::'+i;}
function shellIdx(el){indexed.push(el.dataset.nb);return {secs:[]};}
""" + _app("filterShells", "markSecOverrides") + r"""
markSecOverrides();
console.log(JSON.stringify(indexed));
""")
    assert got == ["a"]

def test_a_layout_change_is_saved_for_the_notebook_it_was_made_in():
    """reader #17: the save waits for the page to be idle; switching tabs
    inside the wait no longer saves the tab switched to instead."""
    got = _run(r"""
var timers=[],now=0,idle=[],saved=[],synced=0;
function setTimeout(f,ms){timers.push({f:f,at:now+ms});return timers.length;}
function clearTimeout(id){if(id&&timers[id-1]) timers[id-1].f=null;}
function tick(ms){now+=ms;timers.forEach(function(t){
  if(t.f&&t.at<=now){var f=t.f;t.f=null;f();}});}
var window={requestIdleCallback:function(f){idle.push(f);return idle.length;},
  cancelIdleCallback:function(id){if(idle[id-1]) idle[id-1]=null;}};
var APP={active:'a',shells:{a:{},b:{}},syncStylingView:function(){synced++;}};
function saveLayout(stem){saved.push(stem);}
var saveT=null,saveIdle=0,saveFor={};
""" + _app("saveLayoutsNow", "scheduleSaveLayout") + r"""
var out={};
scheduleSaveLayout();tick(100);APP.active='b';
tick(400);out.beforeIdle=saved.slice();
idle.forEach(function(f){if(f) f();});idle=[];
out.afterIdle=saved.slice();out.synced=synced;
/* leaving the page with one still waiting saves it then */
saved=[];APP.active='a';scheduleSaveLayout();saveLayoutsNow();
out.flushed=saved.slice();tick(1000);
idle.forEach(function(f){if(f) f();});out.once=saved.slice();
console.log(JSON.stringify(out));
""")
    assert got == {"beforeIdle": [], "afterIdle": ["a", "b"], "synced": 1,
                   "flushed": ["a"], "once": ["a"]}


def test_a_notebook_takes_the_feed_sizes_when_it_is_shown():
    """reader #15: only the notebook on screen is sized on a step; one
    shown later catches up, and one never sized wears the server's 1."""
    got = _run(r"""
function card(){return {cl:{},classList:{contains:function(k){
  return k==='has-fig';}}};}
function shell(){var props={};return {props:props,style:{
  setProperty:function(k,v){props[k]=String(v);},
  removeProperty:function(k){delete props[k];}},
  __jvIdx:{cards:[card(),card()]}};}
var zoomed=0;function syncZoomed(c){zoomed++;}
function $$(){return [];}
var figAll=1,mdAll=1;
""" + _app("syncShellSizes") + r"""
var a=shell(),out={};
out.fresh=syncShellSizes(a);out.freshProps=Object.keys(a.props).length;
out.freshZoomed=zoomed;
figAll=1.3;mdAll=1.2;
out.sized=syncShellSizes(a);out.props=Object.assign({},a.props);
out.zoomed=zoomed;
out.again=syncShellSizes(a);out.zoomedAgain=zoomed;
figAll=1;mdAll=1;out.reset=syncShellSizes(a);out.resetProps=a.props;
console.log(JSON.stringify(out));
""")
    assert got == {"fresh": False, "freshProps": 0, "freshZoomed": 0,
                   "sized": True,
                   "props": {"--fzall": "1.3", "--mdscale": "1.2"},
                   "zoomed": 2, "again": False, "zoomedAgain": 2,
                   "reset": True, "resetProps": {}}


def test_the_hidden_notebooks_are_not_resized_and_plotly_is_told_directly():
    app = assets.app_js()
    fig = lift_fn(app, "applyFigAll")
    assert "$$('.nbshell')" not in fig and "syncShellSizes(el)" in fig
    md = lift_fn(app, "applyMdAll")
    assert "$$('.nbshell')" not in md
    act = lift_fn(app, "activate")
    assert act.index("wakeShell(stem);") < act.index("APP.syncShellSizes(")
    emb = lift_fn(app, "resizeEmbeds")
    assert "Plotly.Plots.resize(g)" in emb
    assert "if(other) try{window.dispatchEvent(new Event('resize'));}" in emb


def test_the_spy_looks_up_once_and_lights_only_on_a_move():
    """reader #1: no whole-notebook query inside the observer's callback
    or the two functions it calls."""
    init = lift_fn(assets.app_js(), "initShell")
    spy = init[init.index("function setActiveSection(id){"):
               init.index("if(spy) shellObserver(shell,spy);")]
    assert "$$(" not in spy and "querySelector" not in spy
    assert "if(id===litSec&&litSecEl===(navSecs[id]||null)) return;" in spy
    assert "if(item===litItem&&nav===litNav) return;" in spy
    assert "var card=cardById[bestC];" in spy


def test_find_walks_without_a_filter_and_puts_back_what_it_recorded():
    app = assets.app_js()
    mark = lift_fn(app, "findMark")
    assert "acceptNode" not in mark
    assert "if(!v||v.toLowerCase().indexOf(low)<0) continue;" in mark
    restore = lift_fn(app, "findRestore")
    assert "$$(" not in restore
    clear = lift_fn(app, "findClear")
    assert "$$(" not in clear
    assert "if(marked) findSweep(unwrap,marks);" in clear


def test_find_asks_the_page_for_copies_once_and_only_after_marking():
    """reader #6: what find recorded is put back without asking the page;
    copies of a mark (a tree node, a slide) are swept by ONE query, and
    none is run when nothing was marked since the last clear."""
    code = _app("findSweep", "findRestore", "findClear") + r"""
var queries=[],kicked=0;
function el(tag,cls,parent){
  var e={tagName:tag,parentNode:parent||null,textContent:'w',
    classList:{s:new Set(cls),contains(c){return this.s.has(c);},
      remove(){for(var i=0;i<arguments.length;i++) this.s.delete(arguments[i]);},
      toggle(c,on){on?this.s.add(c):this.s.delete(c);}}};
  return e;
}
var host={replaceChild(n,m){m.parentNode=null;},normalize(){}};
var pageCopies=[];
var document={querySelectorAll(sel){queries.push(sel);return pageCopies;},
  createTextNode(t){return {t:t};}};
var jvMath={kick(){kicked++;}};
var findTok=0,findHits=[],findAt=-1,findOpened=[],findOpenedParts=[],
    findOpenedNotes=[];
/* 1. nothing marked: no query at all */
findClear();
var none=queries.length;
/* 2. one mark, one opened card and part recorded, and a copy of each
   somewhere else on the page */
var mk=el('MARK',['jv-hit','jv-doc'],host);
var card=el('ARTICLE',['card','jv-hitcard','expanded']);
var part=el('DIV',['code-off','jv-hitopen']);
findHits=[mk];findOpened=[{el:card,hidden:true,expanded:false}];
findOpenedParts=[part];
var copyMark=el('MARK',['jv-hit','jv-doc'],host),
    copyCard=el('ARTICLE',['card','jv-hitcard']),
    varMark=el('MARK',['jv-hit'],host);
pageCopies=[copyMark,copyCard];
findClear();
console.log(JSON.stringify({none:none,queries:queries,
  markOut:mk.parentNode===null,copyOut:copyMark.parentNode===null,
  varKept:varMark.parentNode===host,
  card:[...card.classList.s].sort(),part:[...part.classList.s].sort(),
  copyCard:[...copyCard.classList.s].sort(),
  left:[findHits.length,findOpened.length,findOpenedParts.length],
  kicked:kicked}));
"""
    out = _run(code)
    assert out["none"] == 0
    assert out["queries"] == ["mark.jv-doc,.jv-hitcard,.jv-hitopen"]
    assert out["markOut"] and out["copyOut"] and out["varKept"]
    assert out["card"] == ["card", "is-hidden"]
    assert out["part"] == ["code-off"]
    assert out["copyCard"] == ["card"]
    assert out["left"] == [0, 0, 0] and out["kicked"] == 1


def test_no_click_anywhere_walks_the_page_for_a_menu():
    """reader #16"""
    app = assets.app_js()
    assert "$$('.ab-foldmenu')" not in app
    deck = assets.deck_js()
    assert "$$('.vo-fmenu')" not in deck
    assert "if(!voMenus.length) return;" in deck   # (voMenusLive, gestures)


def test_versions_is_shown_without_making_the_page_inert():
    """reader #8: showModal restyled every element of the page twice."""
    app = assets.app_js()
    hist = lift_fn(app, "openCellHistory")
    # an ordinary dialog -- the modal only over a full screen (Present),
    # where nothing but the top layer is drawn (review, 2026-10-10)
    assert "var modal=!!document.fullscreenElement;" in hist
    assert "if(modal) dialog.showModal(); else dialog.show();" in hist
    assert "backdrop.className='ch-backdrop';" in hist
    # ...and the page behind kept from a screen reader, as the modal did
    assert "n.setAttribute('aria-hidden','true');muted.push(n);" in hist
    assert "muted.forEach(function(n){n.removeAttribute('aria-hidden');});" \
        in hist
    css = assets.load("css/core.css")
    assert "dialog.cell-history{position:fixed;inset:0;margin:auto;" in css
    assert ".ch-backdrop{position:fixed;inset:0;" in css


def test_the_raw_view_and_the_cards_skip_what_costs_and_shows_nothing():
    app_css = assets.load("css/app.css")
    assert (".rawview .rawcell{content-visibility:auto;"
            "contain-intrinsic-size:auto 160px;}") in app_css
    assert "@media print{.rawview .rawcell{content-visibility:visible" \
        in app_css
    core = assets.load("css/core.css")
    card = core[core.index(".card{background:var(--paper);"):]
    card = card[:card.index("}")]
    assert "transition" not in card
    assert ".provedge{fill:none;stroke:var(--amber-soft);stroke-width:1.4;\n" \
        "  transition:stroke .2s;}" in core
    assert ".jv-scrollshield{position:fixed;inset:0;z-index:50;display:none;}" \
        in app_css
