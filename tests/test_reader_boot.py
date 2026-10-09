"""Notebook boot, mounting and leaks (2026-10-09 speed push, "readerboot").

What these pin, each a measured cost the owner felt:

* cards are VISIBLE from the first paint -- they started at opacity:0 and
  waited for every script on the page and a scroll observer (load-app #1);
* every notebook but the first arrives hidden and is wired the first time
  it is shown (load-app #4), the boot filters and renders the tabs once
  (load-app #9), and the page is first laid out the way app.js will leave
  it, so nothing jumps when it boots (load-static #8);
* a long note is measured when it nears the screen, held at the clamp's
  height until then (load-app #8);
* the card controls answer through ONE delegated listener per shell, in
  the order and with the stops the per-element listeners had (#12);
* a shell that goes lets go of everything that reached it (session #2);
* a note added with the pencil goes in in place when it is the only
  change (critic #3) -- and the page re-mounts, as before, whenever it
  is not;
* Plotly figures are drawn one per task, the nearest first (load-static
  #6).

Pure parts run in node (helpers_js); the rendered page is driven in a real
Chromium with ``JUNOVIEW_BROWSER_TESTS=1``.
"""

from __future__ import annotations

import copy
import http.server
import json
import os
import re
import subprocess
import tempfile
import threading
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets
from junoview.notebook.parser import parse_notebook
from junoview.render.page import (
    FIRST_CHROME_H,
    _first_layout,
    join_shells,
    render_page,
)
from junoview.server.notebook_edit import insert_note_cell, note_in_place
from junoview.server.shells import local_source

NB = {"cells": [
    {"cell_type": "markdown", "id": "h1", "source": "# Report"},
    {"cell_type": "markdown", "id": "intro", "source": "An opening note."},
    {"cell_type": "code", "id": "c0",
     "source": "#| id: load\nload()", "outputs": []},
    {"cell_type": "markdown", "id": "mid", "source": "A note between."},
    {"cell_type": "code", "id": "c1",
     "source": "#| display: figure\n#| id: figx\nplot()",
     "outputs": [{"output_type": "display_data",
                  "data": {"image/png": "aGk="}}]},
    {"cell_type": "markdown", "id": "end", "source": "A closing note."},
]}


def _run_js(code: str):
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


def _insert(nb: dict, after: str, source: str):
    nb = copy.deepcopy(nb)
    old = parse_notebook(nb, render_raw=False)
    nb, idx, cid = insert_note_cell(nb, after, source, doc=old)
    new = parse_notebook(nb)
    return old, new, nb, idx, cid


# ---------------------------------------------------------------- the page


def test_cards_are_visible_without_any_script():
    css = assets.load("css/core.css")
    card = css.split("/* ---------- cards ---------- */")[1].split("}")[0]
    card = re.sub(r"/\*.*?\*/", "", card, flags=re.S)
    assert "opacity:0" not in card and "translateY" not in card
    assert ".card.in{" not in css
    # the long-note clamp is held until measured, in a notebook's own
    # feed only (not a trace's or a collection's clones)
    assert (".nbshell:not(.tracetab) .content .card[data-note=\"1\"]>"
            ".cardbody:not([data-mdclamp]){\n  max-height:440px;"
            "overflow:clip;}") in css


def test_every_notebook_but_the_first_arrives_hidden():
    a = parse_notebook(copy.deepcopy(NB))
    a.source_name = "first"
    b = parse_notebook(copy.deepcopy(NB))
    b.source_name = "second"
    page = render_page([a, b], mode="app")
    assert '<div class="shell nbshell" data-nb="first"' in page
    assert '<div hidden class="shell nbshell" data-nb="second"' in page
    # text (an export) and bytes (the app joins the shells it keeps)
    assert join_shells(['<div class="a">x</div>', '<div class="b">y</div>']) \
        == '<div class="a">x</div><div hidden class="b">y</div>'
    assert join_shells([b'<div class="a">', b'<div class="b">',
                        b'<div class="c">']) \
        == b'<div class="a"><div hidden class="b"><div hidden class="c">'
    assert join_shells([]) == ""
    with pytest.raises(ValueError):
        join_shells(['<div class="a">', "<section>"])
    with pytest.raises(TypeError):
        join_shells(['<div class="a">', b'<div class="b">'])  # type: ignore


def test_the_app_hides_them_without_touching_the_shells_it_keeps(tmp_path):
    # the app's page is put together from shells kept between builds
    # (server/shells.py): the attribute goes on in the page, never into
    # the kept copy that Reload and Open serve on their own
    from junoview.server.shells import local_shell
    from junoview.server.state import _app_page, _AppState

    st = _AppState(tmp_path)
    for name in ("one", "two", "three"):
        f = tmp_path / f"{name}.ipynb"
        f.write_text(json.dumps(NB), encoding="utf-8")
        st.note_open(f)
    page = _app_page(st).decode("utf-8")
    assert page.count('<div class="shell nbshell" data-nb="one"') == 1
    assert page.count('<div hidden class="shell nbshell" data-nb=') == 2
    for name in ("two", "three"):
        f = tmp_path / f"{name}.ipynb"
        kept = local_shell(local_source(f, name, str(f)), lenient=True)
        assert kept.html.startswith('<div class="shell nbshell"')
        assert kept.html in page.replace("<div hidden ", "<div ")


def test_the_first_layout_is_the_one_the_boot_arrives_at():
    a = parse_notebook(copy.deepcopy(NB))
    page = render_page([a])
    assert f'<html lang="en" style="--chrome-h:{FIRST_CHROME_H}px">' in page
    assert '<body class="files-top tabs-row-on">' in page
    assert '<div class="nb-filebar" id="nb-filebar">' in page
    assert '<div class="open-tabs-row" id="open-tabs-row">' in page
    # nothing open: the welcome decides, as it always did
    empty = render_page([], mode="app")
    assert '<html lang="en">' in empty and "<body>\n" in empty
    assert '<div class="nb-filebar" id="nb-filebar" hidden>' in empty
    assert _first_layout(False)["body_attrs"] == ""
    # and app.js keeps them by the same names it always wrote
    app = assets.app_js()
    assert "document.body.classList.toggle('tabs-row-on',on);" in app
    assert "cl.toggle('files-top',at==='top');" in app


def test_boot_registers_hidden_notebooks_and_wires_them_when_shown():
    app = assets.app_js()
    boot = app[app.index("  BOOTING=true;\n  $$('.nbshell')"):]
    assert "if(sh.hidden) registerLazyShell(sh); else initShell(sh);" in boot
    assert "if(APP.order.length){applyFilters();activate(APP.order[0]);}" \
        in boot
    act = lift_fn(app, "activate")
    assert act.index("tabList().forEach(function(s){APP.shells[s].el."
                     "hidden=(s!==stem);});") < act.index("wakeShell(stem);")
    assert act.index("wakeShell(stem);") < act.index("renderTabs();")
    init = lift_fn(app, "initShell")
    assert "if(!BOOTING) applyFilters();" in init
    assert "if(!BOOTING&&!woke) renderTabs();" in init
    # a wake is not announced: the deck reads sem:shell as "cards changed"
    assert "if(!woke) document.dispatchEvent(new CustomEvent('sem:shell'," \
        in init
    assert "if(APP.shells[stem]&&APP.shells[stem].lazy) return;" in \
        lift_fn(app, "applyFilters")


def test_a_registered_shell_is_filed_under_its_stem_and_woken_once():
    app = assets.app_js()
    code = (
        "var APP={shells:{},order:[]};var events=[],inits=[];\n"
        "function $(s,r){return r.q[s]||null;}\n"
        "var document={dispatchEvent:function(e){events.push(e.detail.stem);}};\n"
        "function CustomEvent(t,o){this.type=t;this.detail=o.detail;}\n"
        "function initShell(el){inits.push(el.dataset.nb);"
        "delete APP.shells[el.dataset.nb].lazy;}\n"
        + lift_fn(app, "shellIdent") + "\n"
        + lift_fn(app, "registerLazyShell") + "\n"
        + lift_fn(app, "wakeShell") + "\n"
        "var sh={dataset:{nb:'b',path:'/x/b.ipynb'},q:{'.nb-data':"
        "{textContent:JSON.stringify({title:'B',items:[1]})}}};\n"
        "registerLazyShell(sh);\n"
        "var e=APP.shells.b;\n"
        "var before={lazy:e.lazy,title:e.title,path:e.path,items:e.data.items,"
        "order:APP.order.slice()};\n"
        "wakeShell('b');wakeShell('b');wakeShell('nope');\n"
        "console.log(JSON.stringify({before:before,inits:inits,events:events,"
        "lazy:!!APP.shells.b.lazy}));")
    got = _run_js(code)
    assert got["before"] == {"lazy": True, "title": "B", "path": "/x/b.ipynb",
                             "items": [1], "order": ["b"]}
    assert got["inits"] == ["b"]          # once, however often it is shown
    assert got["events"] == ["b"]         # the registration's, not a wake's
    assert got["lazy"] is False


# -------------------------------------------------------- boot-time layout


def test_a_note_is_measured_once_and_says_so_either_way():
    app = assets.app_js()
    code = (
        "function $(s,r){return r.note||null;}\n"
        "var made=[];var document={createElement:function(t){"
        "var b={tag:t,addEventListener:function(){}};made.push(b);return b;}};\n"
        "function body(h,off){var cls={};return {dataset:{},note:{scrollHeight:h,"
        "getClientRects:function(){return off?[]:[{}];}},"
        "classList:{add:function(c){cls[c]=1;},toggle:function(){}},cls:cls,"
        "parentNode:{insertBefore:function(n){this.n=(this.n||0)+1;}},"
        "nextSibling:null};}\n"
        + lift_fn(app, "mdClamp") + "\n"
        "var a=body(120),b=body(900),c=body(900);c.dataset.mdclamp='0';\n"
        "var none=body(0);none.note=null;\n"
        # a Collapsed note's body is not laid out: undecided, not short
        "var shut=body(0,true);\n"
        "mdClamp([a,b,c,none,shut]);mdClamp([a,b]);\n"
        "console.log(JSON.stringify({a:a.dataset.mdclamp,b:b.dataset.mdclamp,"
        "bcls:b.cls,c:c.dataset.mdclamp,none:none.dataset.mdclamp,"
        "shut:shut.dataset.mdclamp||'undecided',"
        "buttons:made.length,bIns:b.parentNode.n}));")
    got = _run_js(code)
    assert got == {"a": "0", "b": "1", "bcls": {"mdclamp": 1}, "c": "0",
                   "none": "0", "shut": "undecided", "buttons": 1,
                   "bIns": 1}
    watch = lift_fn(app, "mdClampWatch")
    assert "rootMargin:'100% 0px 100% 0px'" in watch
    assert "shellObserver(shell,io);" in watch


def test_the_tab_strip_is_measured_once_per_frame():
    app = assets.app_js()
    code = (
        "var frames=[];var window={requestAnimationFrame:function(f)"
        "{frames.push(f);return frames.length;}};\n"
        "var reads=0,scrolled=0;var topTabstrip={scrollWidth:900,"
        "clientWidth:300,scrollLeft:0,"
        "querySelector:function(){return {getBoundingClientRect:function()"
        "{reads++;return {left:500,right:640};}};},"
        "getBoundingClientRect:function(){reads++;return {left:0,right:300,"
        "width:300};}};\n"
        "var document={body:{classList:{contains:function(){return false;}}}};\n"
        "var tabViewFrame=0;\n" + lift_fn(app, "keepTabInView") + "\n"
        "keepTabInView();keepTabInView();keepTabInView();\n"
        "var queued=frames.length,before=reads;frames[0]();\n"
        "keepTabInView();\n"
        "console.log(JSON.stringify({queued:queued,before:before,reads:reads,"
        "left:topTabstrip.scrollLeft,again:frames.length}));")
    got = _run_js(code)
    assert got == {"queued": 1, "before": 0, "reads": 2, "left": 340,
                   "again": 2}


# ---------------------------------------------------- delegated card controls


def test_one_listener_answers_in_the_order_bubbling_did():
    app = assets.app_js()
    code = (
        lift_fn(app, "shellDelegate") + "\n"
        "function node(cls,parent){return {nodeType:1,cls:cls,parentNode:parent,"
        "matches:function(s){return s.split(',').some(function(x){"
        "return x.trim()==='.'+cls;});}};}\n"
        "var root={listeners:{},"
        "addEventListener:function(t,f){this.listeners[t]=f;}};\n"
        "var card=node('card',root),head=node('cardhead',card),"
        "btn=node('cell-eye',head),txt={nodeType:3,parentNode:btn};\n"
        "var log=[];\n"
        "shellDelegate(root,'click',[\n"
        " ['.cell-eye',function(e,n){log.push('eye');"
        "if(e.stop)e.stopPropagation();}],\n"
        " ['.cardhead',function(e,n){log.push('head');}],\n"
        " ['.card',function(e,n){log.push('card');}]]);\n"
        "function ev(t,stop){return {target:t,stop:stop,cancelBubble:false,"
        "stopPropagation:function(){this.cancelBubble=true;}};}\n"
        "root.listeners.click(ev(txt,false));log.push('|');\n"
        "root.listeners.click(ev(txt,true));log.push('|');\n"
        "root.listeners.click(ev(head,false));log.push('|');\n"
        # a clone wired as its own root inside this one (a tree-view
        # node): its listener runs first, and the outer one stays out
        "var inner={nodeType:1,cls:'card',parentNode:card,listeners:{},"
        "matches:function(){return false;},"
        "addEventListener:function(t,f){this.listeners[t]=f;}};\n"
        "var ih=node('cardhead',inner),ib=node('cell-eye',ih);\n"
        "shellDelegate(inner,'click',[\n"
        " ['.cell-eye',function(e,n){log.push('inner eye');}]]);\n"
        "var e2=ev(ib,false);inner.listeners.click(e2);"
        "root.listeners.click(e2);\n"
        "console.log(JSON.stringify(log));")
    assert _run_js(code) == ["eye", "head", "card", "|", "eye", "|",
                             "head", "card", "|", "inner eye"]


def test_the_card_controls_are_delegated_and_their_buttons_still_made():
    app = assets.app_js()
    wire = lift_fn(app, "wireCardBehaviors")
    for sel in ("'.cell-eye'", "'.cell-pin'", "'.cell-mark'",
                "'.codetoggle'", "'.navitem-eye'", "'.plot-trace-btn'",
                "'.depchip'", "'.sec-chev'", "'.navsec-chev'",
                "'.sectionhead'", "'.sec-eye'", "'.sec-hideall'",
                "'.navsec-eye'", "'.navsec-hideall'", "'.card>.cardhead'",
                "'.cb-fig .figzoom .fz-copy'", "'.cb-fig .figzoom'",
                "'.cb-fig'", "'.cb-out'", "'.cell-collect'",
                "'.cell-history-btn'"):
        assert "[" + sel + ",function(" in wire, sel
    # the figure bar's own buttons come before the bar, the bar before the
    # figure: a click on + must never fold the figure under it
    assert wire.index("['.cb-fig .figzoom .fz-in'") \
        < wire.index("['.cb-fig .figzoom',") < wire.index("['.cb-fig',")
    assert "shell.__jvCardsWired=true;" in wire
    # the outline link leaves a click on its eye to the eye
    init = lift_fn(app, "initShell")
    assert ("if(e.target.closest&&e.target.closest('.navitem-eye')) return;"
            in init)
    buttons = lift_fn(app, "wireCardButtons")
    for made in ("hb.className='cell-history-btn';",
                 "b.className='cell-collect';",
                 "bc.className='fz-btn fz-copy';"):
        assert made in buttons


# ------------------------------------------------------------ leaks (session #2)


def test_a_shell_that_goes_lets_go_of_what_reached_it():
    app = assets.app_js()
    code = (
        "var removed=[],aborted=0,disc=0,cleared=[],forgot=[];\n"
        "function plotForget(r){forgot.push(r.name);}\n"
        "function bar(home){return {__jvHome:home,parentNode:{removeChild:"
        "function(){removed.push(home.name);}}};}\n"
        "var A={name:'A'},B={name:'B'};\n"
        "var dock={bars:[bar(A),bar(B)]};\n"
        "function $(s){return s==='#file-dock'?dock:null;}\n"
        "function $$(s,r){return r.bars;}\n"
        # the equations go through jvMath.forget (the MathJax package's
        # one door: it skips the clear while a typeset is running)
        "var jvMath={forget:function(r){cleared.push(r.name);}};\n"
        "A.__jvAc={abort:function(){aborted++;}};\n"
        "A.__jvObs=[{disconnect:function(){disc++;}},{disconnect:function(){disc++;}}];\n"
        + lift_fn(app, "shellTeardown") + "\n"
        "shellTeardown(A);shellTeardown(null);\n"
        "console.log(JSON.stringify({removed:removed,aborted:aborted,disc:disc,"
        "cleared:cleared,obs:A.__jvObs.length,ac:A.__jvAc,forgot:forgot}));")
    got = _run_js(code)
    assert got == {"removed": ["A"], "aborted": 1, "disc": 2,
                   "cleared": ["A"], "obs": 0, "ac": None, "forgot": ["A"]}
    # and the figures it had waiting to be drawn go with it
    code = (
        "var plotIO={un:[],unobserve:function(d){this.un.push(d.n);}};\n"
        "function d(n,inA){return {n:n,__jvPlotQ:1,inA:inA};}\n"
        "var plotQ=[d('a1',1),d('b1',0),d('a2',1)];\n"
        "var A={contains:function(x){return !!x.inA;}};\n"
        + lift_fn(app, "plotForget") + "\n"
        "var gone=plotQ.filter(function(x){return x.inA;});\n"
        "plotForget(A);\n"
        "console.log(JSON.stringify({left:plotQ.map(function(x){return x.n;}),"
        "un:plotIO.un.sort(),flags:gone.map(function(x){return x.__jvPlotQ;})}));")
    assert _run_js(code) == {"left": ["b1"], "un": ["a1", "a2"],
                             "flags": [0, 0]}
    # the bar goes back only into the shell it came from
    dock = lift_fn(app, "dockFileBar")
    assert "b.__jvHome===sh.el" in dock
    info = lift_fn(app, "wireFileInfo")
    assert "bar.__jvHome=shell;" in info
    assert "var sig=shellSignal(shell);" in info and "},sig);" in info
    mount = lift_fn(app, "mountShellHTML")
    assert "if(old) shellTeardown(old.el);" in mount
    assert "shellTeardown(sh.el);" in lift_fn(app, "closeNotebook")


# --------------------------------------------------------------- Plotly queue


def test_figures_are_drawn_nearest_first_one_at_a_time():
    app = assets.app_js()
    code = (
        "var plotIO=null,plotQ=[];\n"
        + lift_fn(app, "plotNext") + "\n"
        + lift_fn(app, "plotOffScreen") + "\n"
        "function shell(hidden,cls){return {hidden:hidden,classList:"
        "{contains:function(c){return c===cls;}}};}\n"
        "var shown=shell(false,''),away=shell(true,''),raw=shell(false,'raw');\n"
        "function d(n,q,c,sh){return {n:n,__jvPlotQ:q,isConnected:c!==false,"
        "closest:function(){return sh||shown;}};}\n"
        "plotQ=[d('a',1),d('gone',1,false),d('hid',2,true,away),d('b',1),"
        "d('near',2),d('inraw',1,true,raw),d('c',1)];\n"
        "var out=[],x;while((x=plotNext())) out.push(x.n);\n"
        # the ones whose notebook is not on screen wait, still queued
        "out.push('|');plotQ.forEach(function(q){out.push(q.n);});\n"
        "away.hidden=false;raw.classList.contains=function(){return false;};\n"
        "while((x=plotNext())) out.push(x.n);\n"
        "console.log(JSON.stringify(out));")
    assert _run_js(code) == ["near", "a", "b", "c", "|", "hid", "inraw",
                             "hid", "inraw"]
    # and what changes the screen gives them their turn
    assert "plotPump();" in lift_fn(app, "renderViewBtns")


def test_plotly_for_a_notebook_not_shown_yet_loads_when_idle():
    app = assets.app_js()
    code = (
        "var loads=0,idles=[],later=[];\n"
        "function ensurePlotly(cb){loads++;}\n"
        "var document={readyState:'complete'};\n"
        "var window={requestIdleCallback:function(f,o){idles.push(o.timeout);"
        "later.push(f);},addEventListener:function(){}};\n"
        "function shell(lazy,plots){return {lazy:lazy,el:{querySelector:"
        "function(){return plots?{}:null;}}};}\n"
        "var APP={order:['a','b'],shells:{a:shell(false,true),"
        "b:shell(true,false)}};\n"
        + lift_fn(app, "plotWarmLater") + "\n"
        # the shown notebook's figures load plotly.js anyway; a lazy one
        # without figures needs nothing
        "plotWarmLater();var none=later.length;\n"
        "APP.shells.b=shell(true,true);plotWarmLater();\n"
        "var queued=later.length,before=loads;later.forEach(function(f){f();});\n"
        "console.log(JSON.stringify({none:none,queued:queued,before:before,"
        "loads:loads,idles:idles}));")
    assert _run_js(code) == {"none": 0, "queued": 1, "before": 0,
                             "loads": 1, "idles": [5000]}
    boot = app[app.index("  BOOTING=true;\n  $$('.nbshell')"):]
    assert "plotWarmLater();" in boot
    act = lift_fn(app, "activateOutputs")
    assert "if(!jsonOnly){plotQueue(pe);return;}" in act
    # whatever must see every figure drawn asks for it
    assert "if(sh.el) plotFlush(sh.el);" in lift_fn(app, "autoPlan")
    assert "window.addEventListener('beforeprint',function(){" in app
    # ...and every note decided: the print is all of them at once
    assert "if(a&&a.el) mdClampScan(a.el);" in app


# ------------------------------------------------- a note added in place


def test_a_plain_note_goes_in_place_named_as_a_fresh_load_names_it():
    old, new, nb, idx, cid = _insert(NB, "load", "Fresh words.")
    got = note_in_place(old, new, cid, idx, nb)
    assert got is not None
    assert got["after"] == "load" and got["index"] == idx == 3
    # notes are numbered in order: the new one is the second, and the two
    # after it move up one -- a mark is kept against a card's id
    assert 'id="card-note-2"' in got["card"]
    assert got["renames"] == [["note-2", "note-3"], ["note-3", "note-4"]]
    assert f'data-anchor="cell:{cid}"' in got["card"]
    assert f'data-noteidx="{idx}"' in got["card"]
    assert 'data-item="note-2"' in got["nav"]
    assert got["item"]["card"] == "note-2"
    assert got["item"]["anchor"] == f"cell:{cid}"
    assert 'class="rawcell md"' in got["raw"] and "Fresh words." in got["raw"]
    # the raw view renders markdown and code cells, in order
    assert got["rawpos"] == 3 and got["rawcount"] == 7
    # first in its section: after nothing
    old, new, nb, idx, cid = _insert(NB, "", "Appended.")
    tail = note_in_place(old, new, cid, idx, nb)
    assert tail is not None and tail["after"] == "cell:end"
    assert tail["item"]["card"] == "note-4" and tail["renames"] == []


def test_anything_more_than_one_note_re_mounts_instead():
    # a heading opens a section
    old, new, nb, idx, cid = _insert(NB, "load", "## A new section\n\ntext")
    assert note_in_place(old, new, cid, idx, nb) is None
    # a #### kicker regroups the outline rows after it
    old, new, nb, idx, cid = _insert(NB, "load", "#### Kicker\n\ntext")
    assert note_in_place(old, new, cid, idx, nb) is None
    # the first note of a notebook adds the outline key's markdown dot
    bare = {"cells": [c for c in NB["cells"] if c["cell_type"] == "code"]}
    old, new, nb, idx, cid = _insert(bare, "load", "First note.")
    assert note_in_place(old, new, cid, idx, nb) is None
    # cells with no id are anchored by POSITION (code) or by their order
    # (notes): a note inserted before them moves them
    noid = copy.deepcopy(NB)
    for c in noid["cells"]:
        c.pop("id", None)
    noid["cells"][2]["source"] = "load()"
    old, new, nb, idx, cid = _insert(noid, "cell:p2", "Between.")
    assert idx == 3
    assert note_in_place(old, new, cid, idx, nb) is None
    # ...while one added after all of them moves nothing
    old, new, nb, idx, cid = _insert(noid, "", "At the end.")
    assert note_in_place(old, new, cid, idx, nb) is not None


def test_the_route_sends_it_only_while_the_page_matches_the_disk(tmp_path):
    # `have` is the tab's data-ver -- the conditional Reload's version of
    # exactly what the tab was rendered from (server/shells.py)
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    f = tmp_path / "report.ipynb"
    f.write_text(json.dumps(NB), encoding="utf-8")

    def ver():
        return local_source(f, "report", str(f)).ver

    shown = ver()
    handler = _make_handler(_AppState(tmp_path))
    h = handler.__new__(handler)
    r = h._add_note({"path": str(f), "after": "load", "source": "One.",
                     "have": shown})
    # the tab now holds the new file's version, and needs no shell
    assert r["note"] and r["ver"] == ver() != shown
    assert "shell" not in r
    # the page's copy is stale (the file moved on): re-mount, as before
    r2 = h._add_note({"path": str(f), "after": "load", "source": "Two.",
                      "have": shown})
    assert "note" not in r2 and r2["shell"] and r2["ver"] == ver()
    assert f'data-ver="{r2["ver"]}"' in r2["shell"]
    # no version sent (an older page, a tab that cannot be versioned)
    r3 = h._add_note({"path": str(f), "after": "load", "source": "Three."})
    assert "note" not in r3 and r3["shell"]
    # a heading is more than one note: re-mount, even though current
    r4 = h._add_note({"path": str(f), "after": "load",
                      "source": "## New part\n\ntext", "have": r3["ver"]})
    assert "note" not in r4 and r4["shell"]
    # nothing is lost either way: every note is in the file, in order
    cells = json.loads(f.read_text(encoding="utf-8"))["cells"]
    srcs = [c["source"] for c in cells if c["cell_type"] == "markdown"]
    assert srcs[:3] == ["# Report", "An opening note.",
                        "## New part\n\ntext"]
    assert {"One.", "Two.", "Three."} <= set(srcs)
    # a deck file beside it is part of what the tab was built from
    v = ver()
    (tmp_path / "report.deck.json").write_text(
        json.dumps({"presentations": []}), encoding="utf-8")
    r5 = h._add_note({"path": str(f), "after": "load", "source": "Five.",
                      "have": v})
    assert "note" not in r5


def test_the_kept_copy_is_rendered_for_the_next_page_build(tmp_path):
    # no shell goes back to the page, but the next GET / or Reload of the
    # file still finds its rendering kept (server/shells.py)
    import time

    from junoview.server import shells
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    f = tmp_path / "report.ipynb"
    f.write_text(json.dumps(NB), encoding="utf-8")
    h = _make_handler(_AppState(tmp_path))
    h = h.__new__(h)
    shown = local_source(f, "report", str(f)).ver
    r = h._add_note({"path": str(f), "after": "load", "source": "One.",
                     "have": shown})
    assert r["note"]
    key = local_source(f, "report", str(f)).key
    deadline = time.monotonic() + 20
    while key not in shells._SHELLS._data and time.monotonic() < deadline:
        time.sleep(0.05)
    kept = shells._SHELLS._data[key][1]
    assert kept.ver == r["ver"] and "One." in kept.html


def test_the_page_inserts_it_and_falls_back_to_the_remount():
    app = assets.app_js()
    save = app[app.index("    e.save.addEventListener('click',function(){"):]
    save = save[:save.index("\n  })();")]
    assert "have:shellVer(stem)})" in save
    assert save.index("var card=noteInPlace(j,stem);") \
        < save.index("mountShellHTML(k.shell,k.path||j.path);")
    # no shell sent (the server expected it in place): read it again
    assert ":api('/api/open',{path:j.path,stem:j.stem})" in save
    fn = lift_fn(app, "noteInPlace")
    # every check before the first write
    assert fn.index("return null") < fn.index("/* ---- writes ---- */")
    assert "return null" not in fn[fn.index("/* ---- writes ---- */"):]
    for step in ("wireCardButtons(shell,stem,[card]);",
                 "wireAddNote(shell,stem);", "shell.__jvAddCard(card,nav);",
                 "applyFilters();", "replaced:false",
                 # the tab holds the new version: a Reload keeps it
                 "shell.dataset.ver=j.ver||'';",
                 # the raw view may still be its inert template
                 "var rawHost=tpl?tpl.content:raw;"):
        assert step in fn, step


# ------------------------------------------------------- in a real browser


def _browser_page(pw, url, js=True):
    try:
        browser = pw.chromium.launch()
    except Exception as e:   # no browser installed for playwright
        pytest.skip(f"Chromium unavailable: {e}")
    ctx = browser.new_context(viewport={"width": 1366, "height": 657},
                              java_script_enabled=js)
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
    pg = ctx.new_page()
    pg.route("https://cdn.jsdelivr.net/**",
             lambda r: r.fulfill(status=404, body=b""))
    errors: list[str] = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    return browser, pg, errors


def _browser_opt_in():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the real-browser checks")
    return pytest.importorskip("playwright.sync_api")


def test_two_notebooks_in_a_real_browser(tmp_path):
    sync_api = _browser_opt_in()
    a = parse_notebook(copy.deepcopy(NB))
    a.source_name = "first"
    b = parse_notebook(copy.deepcopy(NB))
    b.source_name = "second"
    path = tmp_path / "page.html"
    path.write_text(render_page([a, b]), encoding="utf-8")
    with sync_api.sync_playwright() as pw:
        # no script at all: the cards are there to read
        browser, pg, errors = _browser_page(pw, path.as_uri(), js=False)
        pg.goto(path.as_uri())
        assert pg.evaluate(
            "[...document.querySelectorAll('.nbshell:not([hidden]) .card')]"
            ".every(c=>getComputedStyle(c).opacity==='1')")
        assert pg.evaluate("document.querySelectorAll('.nbshell[hidden]')"
                           ".length") == 1
        browser.close()
        browser, pg, errors = _browser_page(pw, path.as_uri())
        pg.add_init_script(
            "window.__shellEvents=[];document.addEventListener('sem:shell',"
            "e=>window.__shellEvents.push(e.detail.stem));")
        pg.goto(path.as_uri())
        pg.wait_for_selector(".nbshell .card")
        st = pg.evaluate(
            "(()=>{const A=window.SemApp;return {lazy:!!A.shells.second.lazy,"
            "first:A.shells.first.el.querySelectorAll('.cell-collect').length,"
            "second:A.shells.second.el.querySelectorAll('.cell-collect').length,"
            "body:document.body.className,"
            "chrome:getComputedStyle(document.documentElement)"
            ".getPropertyValue('--chrome-h')}})()")
        assert st["lazy"] and st["first"] > 0 and st["second"] == 0
        assert "files-top" in st["body"] and "tabs-row-on" in st["body"]
        before = pg.evaluate("window.__shellEvents.slice()")
        pg.evaluate("window.SemApp.activate('second')")
        woke = pg.evaluate(
            "(()=>{const A=window.SemApp;return {lazy:!!A.shells.second.lazy,"
            "hidden:A.shells.second.el.hidden,"
            "collect:A.shells.second.el.querySelectorAll('.cell-collect').length,"
            "events:window.__shellEvents.slice()}})()")
        assert not woke["lazy"] and not woke["hidden"] and woke["collect"] > 0
        assert woke["events"] == before          # a wake is not a reload
        # its controls answer: the eye hides the cell, the chevron folds
        pg.evaluate("document.querySelector('.nbshell[data-nb=second] "
                    ".content .card .cell-eye').click()")
        assert pg.evaluate("document.querySelector('.nbshell[data-nb=second] "
                           ".content .card').classList.contains('cell-off')")
        browser.close()
        assert not errors, errors


@pytest.mark.parametrize("raw_first", [False, True])
def test_a_note_added_in_place_reads_like_a_fresh_load(tmp_path, raw_first):
    sync_api = _browser_opt_in()
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    f = tmp_path / "report.ipynb"
    f.write_text(json.dumps(NB), encoding="utf-8")
    state = _AppState(tmp_path)
    state.note_open(f)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0),
                                            _make_handler(state))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/?t={state.token}"
    # the raw view as it reads, built (Raw pressed) or still its template
    shape = ("(()=>{const A=window.SemApp,sh=A.shells[A.active],el=sh.el;"
             "const rv=el.querySelector('.rawview'),"
             "t=rv.querySelector(':scope > template.rawtpl'),"
             "host=t?t.content:rv;"
             "return {cards:[...el.querySelectorAll('.content .card')]"
             ".map(c=>c.dataset.anchor),"
             "ids:[...el.querySelectorAll('.content .card')].map(c=>c.id),"
             "navids:[...el.querySelectorAll('.nav .navitem')]"
             ".map(n=>n.dataset.item+n.getAttribute('href')),"
             "cardids:sh.data.items.map(i=>i.card),"
             "nav:[...el.querySelectorAll('.nav .navitem-t')].map(n=>n.textContent),"
             "raw:[...host.children].filter(r=>r.classList.contains('rawcell'))"
             ".map(r=>r.textContent.replace(/\\s+/g,' ').slice(0,30)),"
             "index:sh.data.items.map(i=>i.anchor+'@'+i.section),"
             "noteidx:[...el.querySelectorAll('.card[data-note=\"1\"]')]"
             ".map(c=>c.dataset.noteidx)}})()")
    try:
        with sync_api.sync_playwright() as pw:
            browser, pg, errors = _browser_page(pw, url)
            pg.goto(url)
            pg.wait_for_selector(".nbshell .card")
            if raw_first:            # the raw view built, then left
                pg.evaluate("document.getElementById('view-raw').click()")
                assert pg.evaluate("!document.querySelector("
                                   "'.rawview template')")
                pg.evaluate("document.getElementById('view-raw').click()")
            # a Tree view built before the note is drawn again with it
            pg.evaluate("window.SemView.tree()")
            pg.evaluate("window.SemView.tree()")
            pg.evaluate("(()=>{const A=window.SemApp;"
                        "A.shells[A.active].el.__kept=1;})()")
            ver0 = pg.evaluate("window.SemApp.shells.report.el.dataset.ver")
            pg.evaluate("document.querySelector('.card[data-anchor=load] "
                        ".card-addnote').click()")
            pg.fill("#note-dlg-src", "Added *here*.")
            pg.click("#note-dlg-save")
            pg.wait_for_function("document.querySelector('#note-dlg').hidden")
            pg.wait_for_timeout(400)
            kept = pg.evaluate("(()=>{const A=window.SemApp;"
                               "return !!A.shells[A.active].el.__kept})()")
            ver1 = pg.evaluate("window.SemApp.shells.report.el.dataset.ver")
            after = pg.evaluate(shape)
            pg.evaluate("window.SemView.tree()")
            tree = pg.evaluate(
                "(()=>{const A=window.SemApp,sh=A.shells[A.active];"
                "return [sh.el.querySelectorAll('.treeview .tree-node').length,"
                "sh.data.items.length]})()")
            pg.evaluate("window.SemView.tree()")
            # Reload: the disk says what the tab says -- nothing remounts
            res = pg.evaluate("window.SemApp.reloadTab('report')")
            assert res["ok"] and res["unchanged"], res
            reloaded = pg.evaluate(shape)
            still = pg.evaluate("(()=>{const A=window.SemApp;"
                                "return !!A.shells[A.active].el.__kept})()")
            pg.goto(url)
            pg.wait_for_selector(".nbshell .card")
            fresh = pg.evaluate(shape)
            ver2 = pg.evaluate("window.SemApp.shells.report.el.dataset.ver")
            browser.close()
            assert not errors, errors
    finally:
        httpd.shutdown()
    assert kept, "the notebook was re-mounted, not added to"
    assert ver0 and ver1 and ver0 != ver1 == ver2
    assert after == fresh
    assert still and reloaded == after
    assert tree[0] == tree[1] == len(after["cards"])
    # intro, load, the new note, mid, figx, end
    assert re.match(r"cell:[0-9a-f]{8}$", after["cards"][2])
    assert after["raw"][3] == "markdownAdded here."
