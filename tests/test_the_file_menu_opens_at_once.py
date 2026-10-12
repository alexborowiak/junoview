"""The reader's File menu opens at once (2026-10-11 review).

Its toggle was the slide editor's (wireMenuToggle, wired by the editor's
boot), so once the editor came to load on first use (app.js jvDeck) File
was one of the doors that wait for it, and the first click on File waited
for the whole editor to be fetched, compiled and booted: 187 ms became
429 ms at 4x CPU on the user's machine, 310 -> 50 ms median here. The menu
is app.js's markup and most of its rows are app.js's, so app.js opens it
(fileMenuBoot). New's rows and Open a presentation are the editor's and
stay doors: a click on one before the editor is there is held and made
again once it has booted. Driven in Chromium, the editor held back, by
tests/test_the_editor_loads_on_first_use_in_a_browser.py (opt-in); here
the doors are read and fileMenuBoot runs against a small fake page.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(script: str):
    from helpers_js import js_engine
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines()
                if ln.startswith("{") or ln.startswith("[")][-1]
        return json.loads(line)


def _doors() -> list[str]:
    from helpers_js import lift_var
    src = lift_var(assets.app_js(), "DOORS")
    return _run(src + "\nconsole.log(JSON.stringify(DOORS.split(',')));")


def test_file_is_not_a_door_and_its_editor_rows_are():
    doors = _doors()
    assert "#app-file" not in doors
    # the rows whose answer is the editor's still wait for it
    assert "#app-file-menu .dc-mi[data-for]" in doors
    assert "#ot-open" in doors
    # ...and nothing else of the menu is one
    assert not [d for d in doors if "app-file" in d
                and d != "#app-file-menu .dc-mi[data-for]"]


def test_the_editor_no_longer_wires_the_readers_file():
    deck = assets.deck_js()
    assert "wireMenuToggle('app-filewrap'" not in deck
    assert "#app-file'" not in deck and "'app-file'" not in deck
    # the editor's own File still closes on a pick, through its owner
    assert ("  if(fileMenu) $$('.dc-mi',fileMenu).forEach(function(b){\n"
            "    b.addEventListener('click',function(){overlayHide(fileMenu);"
            "});\n  });") in deck


def test_app_js_boots_it():
    app = assets.app_js()
    assert app.count("  fileMenuBoot();") == 1
    assert app.index("  function fileMenuBoot(){") < app.index(
        "  fileMenuBoot();")


# A page just big enough for fileMenuBoot: the button, the menu with two
# rows, and the listeners on document and window, kept so the test can
# dispatch to them -- capture first, as the browser would.
_PAGE = r"""
var L={doc:[],win:[],btn:[],menu:[]};
function on(list){return function(t,f,cap){list.push({t:t,f:f,cap:!!cap});};}
function off(list){return function(t,f,cap){
  for(var i=list.length-1;i>=0;i--)
    if(list[i].t===t&&list[i].f===f&&list[i].cap===!!cap) list.splice(i,1);};}
var document={addEventListener:on(L.doc),removeEventListener:off(L.doc),
  activeElement:null};
var window={addEventListener:on(L.win),removeEventListener:off(L.win),
  innerWidth:1366,innerHeight:657};
var obs=[];
function MutationObserver(f){this.f=f;obs.push(this);}
MutationObserver.prototype.observe=function(){};
window.MutationObserver=MutationObserver;
var aria='false';
var btn={id:'app-file',addEventListener:on(L.btn),
  setAttribute:function(k,v){if(k==='aria-expanded') aria=v;},
  getBoundingClientRect:function(){return {left:14,top:40,bottom:64};},
  contains:function(t){return t===btn;},
  focus:function(){document.activeElement=btn;}};
function row(id){return {id:id,closest:function(s){
  return s==='.dc-mi'?this:null;}};}
var theme=row('scheme-btn'),newRow=row('new');
var menu={hidden:true,style:{},offsetWidth:214,offsetHeight:399,
  addEventListener:on(L.menu),
  contains:function(t){return t===menu||t===theme||t===newRow;}};
var page={id:'page',closest:function(){return null;}};
function $(s){return s==='#app-file'?btn:s==='#app-file-menu'?menu:null;}
/* a click: window and document capture, the menu's own capture when it
   is inside, then the target's listeners */
function click(t){
  var e={target:t,type:'click',stopped:false,
    preventDefault:function(){},stopPropagation:function(){this.stopped=true;}};
  L.win.filter(function(l){return l.t==='click'&&l.cap;}).forEach(
    function(l){l.f(e);});
  L.doc.filter(function(l){return l.t==='click'&&l.cap;}).forEach(
    function(l){l.f(e);});
  if(menu.contains(t)&&t!==menu) L.menu.filter(function(l){
    return l.t==='click'&&l.cap;}).forEach(function(l){l.f(e);});
  if(t===btn) L.btn.forEach(function(l){if(l.t==='click') l.f(e);});
  obs.forEach(function(o){o.f([]);});
}
function key(k){
  var e={key:k,stopped:false,prevented:false,
    preventDefault:function(){this.prevented=true;},
    stopPropagation:function(){this.stopped=true;}};
  L.win.filter(function(l){return l.t==='keydown'&&l.cap;}).forEach(
    function(l){l.f(e);});
  return e;
}
function state(){return {open:!menu.hidden,aria:aria,
  listening:L.doc.length+L.win.length,
  focus:document.activeElement&&document.activeElement.id};}
"""


def _menu(steps: str) -> list:
    from helpers_js import lift_fn
    fn = lift_fn(assets.app_js(), "fileMenuBoot")
    return _run(_PAGE + fn + "\nfileMenuBoot();var out=[state()];\n"
                + steps + "\nconsole.log(JSON.stringify(out));")


def test_a_click_opens_it_under_its_button_and_another_shuts_it():
    got = _menu("click(btn);out.push(state());"
                "out.push([menu.style.position,menu.style.left,"
                "menu.style.top,menu.style.zIndex]);"
                "click(btn);out.push(state());")
    shut, opened, placed, again = got
    # shut, nothing is listened for on the page
    assert shut == {"open": False, "aria": "false", "listening": 0,
                    "focus": None}
    assert opened["open"] and opened["aria"] == "true"
    assert opened["listening"] == 2          # a click outside, and Escape
    # floated under File, as the editor's floatMenu places its menus
    assert placed == ["fixed", "14px", "68px", "240"]
    assert again == shut


def test_a_click_anywhere_else_shuts_it():
    got = _menu("click(btn);click(page);out.push(state());")
    assert got[-1] == {"open": False, "aria": "false", "listening": 0,
                       "focus": None}


def test_escape_shuts_it_goes_no_further_and_gives_file_the_keyboard():
    got = _menu("click(btn);var e=key('Escape');"
                "out.push(state());out.push([e.stopped,e.prevented]);"
                "var e2=key('Escape');out.push([e2.stopped]);")
    assert got[1] == {"open": False, "aria": "false", "listening": 0,
                      "focus": "app-file"}
    assert got[2] == [True, True]
    # shut, Escape is nobody's business here
    assert got[3] == [False]


def test_a_pick_shuts_it_before_the_row_acts():
    got = _menu("click(btn);click(theme);out.push(state());")
    assert got[-1]["open"] is False and got[-1]["aria"] == "false"


def test_shut_by_the_editor_its_button_says_so():
    # a New row is the editor's: it hides the menu through its owner
    got = _menu("click(btn);menu.hidden=true;"
                "obs.forEach(function(o){o.f([]);});out.push(state());")
    assert got[-1] == {"open": False, "aria": "false", "listening": 0,
                       "focus": None}


def test_escape_with_the_keyboard_gone_on_is_not_the_menus():
    # Ctrl+K opened the Open dialog over the open menu and the keyboard
    # is in it: Escape is the dialog's (it closes it), and the menu under
    # it goes too -- it did not take the key, leaving the dialog up and
    # putting the keyboard on File behind it (2026-10-12 review)
    got = _menu("click(btn);document.activeElement={id:'hub-find'};"
                "var e=key('Escape');out.push(state());"
                "out.push([e.stopped,e.prevented]);")
    assert got[1] == {"open": False, "aria": "false", "listening": 0,
                      "focus": "hub-find"}
    assert got[2] == [False, False]
