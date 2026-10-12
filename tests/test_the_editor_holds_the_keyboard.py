"""Where the keyboard is after the editor takes it (2026-10-11 review).

Three findings, one cause: the editor handed the keyboard to its first
visible CONTROL, and a control answers Enter and Space by pressing itself.

1. Opening a deck left the keyboard on Save (#dc-save), so Enter or Space
   straight after opening pressed Save -- with a file target, a picker.
2. F5 from the editor with the keyboard on the page (after a click on the
   slide canvas) put it on the show's Exit (#deck-exit), so Space ended
   the talk instead of advancing it.
3. Escape on the Open dialog with the editor up left the keyboard on the
   page (BODY): closing the dialog hid the control it was on, and nothing
   gave it back.

The editor's keyboard is the SLIDE STAGE now (deck.html gives it
tabindex -1): every deck key is the document's and the stage is no field
they skip, so PageDown, Ctrl+Z and the show's Space work from it at once,
and it answers Enter and Space with nothing of its own. Closing the Open
dialog gives the keyboard back -- to the editor when it is up. Driven in
Chromium by tests/test_the_editor_keyboard_in_a_browser.py (opt-in); the
decisions themselves run here, lifted out of the deck.
"""

from __future__ import annotations

import json
import re
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


# A page small enough to answer the questions deckFocusTake asks: the
# editor (#deck), its stage, Save (the first visible control) and the
# show's Exit. `shown` says whether an element has a box.
_PAGE = r"""
var document={activeElement:null,body:{id:'BODY'}};
function el(id,tag,shown){
  return {id:id,tagName:tag,hidden:false,shown:shown,
    offsetParent:shown?{}:null,
    getClientRects:function(){return this.shown?[1]:[];},
    closest:function(){return null;},
    hasAttribute:function(){return false;},
    setAttribute:function(){},
    focus:function(){if(this.shown) document.activeElement=this;}};
}
var stage=el('deck-stage','DIV',true);
var save=el('dc-save','BUTTON',true);
var exitb=el('deck-exit','BUTTON',true);
var deckEl=el('deck','DIV',true);
var inDeck=[stage,save,exitb];
deckEl.contains=function(e){return e===deckEl||inDeck.indexOf(e)>=0;};
deckEl.querySelectorAll=function(){return [save,exitb];};
"""


def _take(setup: str) -> str:
    fn = __import__("helpers_js").lift_fn(assets.deck_js(), "deckFocusTake")
    return _run(_PAGE + fn + setup
                + "\ndeckFocusTake();console.log(JSON.stringify("
                  "[document.activeElement&&document.activeElement.id]));"
                )[0]


def test_opening_a_deck_gives_the_keyboard_to_the_stage_not_save():
    # the keyboard on the page, as every door into the editor leaves it
    assert _take("") == "deck-stage"


def test_a_show_started_from_the_page_does_not_land_on_exit():
    # F5 with the keyboard on the page: the show's first control is Exit
    assert _take("inDeck=[stage,exitb];"
                 "deckEl.querySelectorAll=function(){return [exitb];};") \
        == "deck-stage"


def test_with_no_stage_on_screen_the_first_control_still_takes_it():
    # a fallback, not a dead end: the editor still has the keyboard
    assert _take("stage.shown=false;") == "dc-save"


def test_the_keyboard_already_in_the_editor_stays_where_it_is():
    assert _take("document.activeElement=save;") == "dc-save"


def test_the_stage_is_focusable_and_out_of_the_tab_order():
    html = assets.deck_html()
    m = re.search(r'<div class="deck-stage" id="deck-stage"[^>]*>', html)
    assert m, "the stage is not where it was"
    assert 'tabindex="-1"' in m.group(0)
    # ...and holding it rings nothing: the selection says where you are
    assert ".deck-stage:focus{outline:none;}" in assets.deck_css()


# closePresentationHub, with the dialog's neighbours stubbed to the shape
# that matters: what is open, and who is handed the keyboard.
_HUB = r"""
var document={activeElement:null,body:{id:'BODY'}};
var took=[];
function deckFocusTake(){took.push('editor');}
function presentationHubDeckInert(){}
function pvForget(){}
var hubPvName='',hubDirRows=null,hubDirH=null;
var root={hidden:false,kids:[],contains:function(e){
  return this.kids.indexOf(e)>=0;}};
function $(s){return s==='#presentation-hub'?root:null;}
var deckEl={hidden:false},mode='edit';
var inHub={id:'presentation-hub-file'};root.kids.push(inHub);
var opener={id:'pr-library',isConnected:true,shown:true,
  closest:function(){return null;},
  getClientRects:function(){return this.shown?[1]:[];},
  focus:function(){took.push(this.id);}};
"""


def _close(setup: str):
    from helpers_js import lift_fn, lift_var
    deck = assets.deck_js()
    src = (_HUB + lift_var(deck, "hubOpener") + "\n"
           + lift_fn(deck, "closePresentationHub") + "\n")
    return _run(src + setup + "\nclosePresentationHub();"
                "console.log(JSON.stringify([took,root.hidden]));")


def test_escape_on_open_with_the_editor_up_gives_the_editor_the_keyboard():
    got = _close("document.activeElement=inHub;hubOpener=opener;")
    assert got == [["editor"], True]


def test_a_shade_click_with_the_keyboard_on_the_page_still_gives_it_back():
    got = _close("document.activeElement=document.body;")
    assert got == [["editor"], True]


def test_over_a_notebook_the_keyboard_goes_back_to_what_opened_it():
    got = _close("deckEl.hidden=true;document.activeElement=inHub;"
                 "hubOpener=opener;")
    assert got == [["pr-library"], True]
    # ...unless that has gone from the screen (a menu row, now shut)
    got = _close("deckEl.hidden=true;document.activeElement=inHub;"
                 "opener.shown=false;hubOpener=opener;")
    assert got == [[], True]


def test_a_closer_that_hands_the_keyboard_on_is_left_to_do_so():
    # the keyboard already elsewhere (a picker's button, a field outside)
    got = _close("document.activeElement={id:'elsewhere'};"
                 "hubOpener=opener;")
    assert got == [[], True]


def test_the_dialog_remembers_who_opened_it_only_as_it_opens():
    body = __import__("helpers_js").lift_fn(assets.deck_js(),
                                            "openPresentationHub")
    head = body[:body.index("root.hidden=false;")]
    # read before it is shown, and not again while it is up (a second
    # door pressed inside it is not where the keyboard came from)
    assert "if(root.hidden){" in head
    assert "hubOpener=(from&&from!==document.body&&!root.contains(from))" \
        in head


# openPresentationHub's first half, with what it calls stubbed: who it
# remembers as the one to give the keyboard back to.
_OPEN = r"""
var document={activeElement:null,body:{id:'BODY'}};
function closeDeckPresentationDrawer(){}
function pvForget(){}
function renderPresentationHub(){}
function presentationHubDeckInert(){}
function permReadOK(){return Promise.resolve(false);}
function setTimeout(){}
var deckDir=null,APP={mode:'app'},mode='edit',deckEl={hidden:true};
var root={hidden:true,contains:function(){return false;}};
function $(s){return s==='#presentation-hub'?root:null;}
var fileBtn={id:'app-file'};
var menu={parentNode:{querySelector:function(s){
  return s==='[aria-haspopup="true"]'?fileBtn:null;}}};
var row={id:'ot-open',closest:function(s){return s==='.dc-menu'?menu:null;}};
var rail={id:'pr-library',closest:function(){return null;}};
"""


def _opened_by(setup: str):
    from helpers_js import lift_fn, lift_var
    deck = assets.deck_js()
    src = (_OPEN + lift_var(deck, "hubOpener") + "\n"
           + lift_fn(deck, "openPresentationHub") + "\n")
    return _run(src + setup + "\nopenPresentationHub();"
                "console.log(JSON.stringify([hubOpener&&hubOpener.id]));")[0]


def test_a_menu_row_that_opened_the_dialog_hands_back_to_its_menu():
    # File > Open a presentation...: the row is hidden with its menu by
    # the pick, so the keyboard comes back to File (2026-10-12 review)
    assert _opened_by("document.activeElement=row;") == "app-file"
    # a door that stays on screen is remembered as itself
    assert _opened_by("document.activeElement=rail;") == "pr-library"
    assert _opened_by("document.activeElement=document.body;") is None


def test_the_object_walk_lets_the_keyboard_out_at_its_ends():
    # the stage holds the keyboard, and Tab walks the slide's objects: a
    # walk that went round for ever left no way to the ribbon by keyboard
    fn = __import__("helpers_js").lift_fn(assets.deck_js(), "pptEditKey")
    assert "if(at>=0&&at===(e.shiftKey?0:ring.length-1)) return false;" \
        in fn


def test_a_stage_the_side_panel_hides_hands_the_keyboard_on():
    # Escape back to the side panel hides the stage that held the
    # keyboard; it fell to the page, where it used to stay on Save
    # (2026-10-12 review)
    assert _take("document.activeElement=stage;stage.shown=false;") \
        == "dc-save"
    # ...and a stage still on screen keeps it
    assert _take("document.activeElement=stage;") == "deck-stage"
    run = __import__("helpers_js").lift_fn(assets.deck_js(), "setUIModeRun")
    assert "var stageHad=document.activeElement===stage;" in run
    assert "if(stageHad&&creating&&!deckEl.hidden) takeFocus=true;" in run
    # ...through the one hand-over, after the open files' row is placed
    assert run.count("deckFocusTake();") == 1
