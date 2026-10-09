"""Nothing eats the whole screen that does not need it (T607).

The user, 2026-10-03: "Please make sure layouts are good and not eating
up the entire screen which seems to be common. I think this gets missed
as this is ok for you but not humans."

Driven at the sizes people actually have -- 1366x657 (a 1366x768 laptop
less the browser's own bars) and 1280x600 (a 1080p laptop at 150%) --
rather than the 1440x900 earlier passes measured at. What that found:

* the editor's work views (History, the Style system, the deck in words,
  the bigger notes editor, the card lists T209/T214 opened full screen)
  were each the whole window in the page colour, mostly empty, with
  nothing of the deck in sight -- now centred sheets as tall as their
  content over the dimmed editor, closed by a press outside;
* building, the slide panel's top row pushed Autosave and undo/redo out
  of its 430px, and its big view drew a placed note as a white card of
  clipped grey words with no heading;
* the reader's Variables pane covered the notebook's right 200px and its
  filter field was squeezed to an empty box;
* File > Theme in the reader hung from the Theme row and ran off the
  bottom of the screen;
* the Notes pane's five tabs overran it, the slide sorter's buttons broke
  into two lines under their own boxes, and the editor's toasts sat on
  the status row.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets

SHEETS = (".deck-history", ".deck-design", ".deck-review",
          ".deck-notesed", ".img-ov", ".vfull", ".sh-menu.lay-ideas")


def _sheet_block(css: str) -> str:
    at = css.index("/* ---- T607: A WORK VIEW IS A SHEET")
    return css[at:]


def test_the_work_views_are_sheets_not_the_window():
    css = assets.deck_css()
    block = _sheet_block(css)
    head = block[block.index("*/") + 2:block.index("{")]
    for sel in SHEETS:
        assert sel in head, sel
    assert "inset:24px;margin:auto;" in block
    assert "width:min(1180px,calc(100vw - 48px));height:fit-content;" in block
    assert "max-height:calc(100vh - 48px);" in block
    # the editor stays in sight, dimmed, round the sheet
    assert "0 0 0 100vmax rgb(3 8 13 / .58)" in block
    # the writing surfaces keep the full height
    assert ".deck-review,.deck-notesed,.vfull{height:calc(100vh - 48px);}" \
        in block


def test_the_sorter_and_the_shows_keep_the_window():
    """PowerPoint's sorter and a show are the window; they stay it."""
    css = assets.deck_css()
    block = _sheet_block(css)
    for full in (".deck-overview", ".deck-scroll", ".jv-spot-wrap"):
        assert full not in block, full
    assert ".deck-overview{position:fixed;inset:0;z-index:400;" in css


def test_a_press_outside_a_sheet_closes_it_and_goes_no_further():
    js = assets.deck_js()
    assert "  sheetBoot();" in js
    # capture: the editor under the dimming never sees the press
    assert ("    ['pointerdown','mousedown','mouseup'].forEach(function(k){"
            in js)
    assert "      sheetClose(sh);\n    },true);" in js
    # every sheet's own way out is found: Close, or the notes editor's Done
    assert "sh.querySelector('[id$=\"-close\"],[id$=\"-done\"]')" in js


def _run_outside(cases: list[dict]) -> list[bool] | None:
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    js = assets.deck_js()
    body = lift_fn(js, "sheetOutside")
    sheets = js[js.index("  var SHEETS="):js.index("  function sheetOutside(")]
    runner = sheets + body + r"""
const cases = JSON.parse(process.argv[2]);
const out = cases.map(c => {
  const sheet = {nodeType: 1, tag: 'sheet',
    matches: s => s.split(',').indexOf(c.cls) >= 0,
    getBoundingClientRect: () => ({left: 100, top: 50, right: 900,
                                   bottom: 450})};
  const child = {nodeType: 1, matches: () => false};
  const t = c.onChild ? child : sheet;
  return sheetOutside({target: t, clientX: c.x, clientY: c.y}) === sheet;
});
console.log(JSON.stringify(out));
"""
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(runner, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p), json.dumps(cases)],
                           capture_output=True, text=True, env=env,
                           timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_only_a_press_beyond_the_sheets_edge_counts_as_outside():
    got = _run_outside([
        # on the dimmed editor: the sheet's own layer, outside its box
        {"cls": ".deck-history", "x": 20, "y": 20},
        {"cls": ".img-ov", "x": 950, "y": 300},
        # inside the box, on the sheet's own background
        {"cls": ".deck-history", "x": 500, "y": 300},
        # on something inside the sheet
        {"cls": ".deck-design", "x": 20, "y": 20, "onChild": True},
        # not a sheet at all (a menu, the canvas)
        {"cls": ".sh-menu", "x": 20, "y": 20},
    ])
    if got is None:
        pytest.skip("no JS engine")
    assert got == [True, True, False, False, False]


def test_the_building_panel_keeps_its_buttons():
    css = assets.deck_css()
    assert ".deck.creating .deck-qat .qat-name{flex:0 1 auto;min-width:72px;}" \
        in css
    # the presentation's own tab is lit beside the panel; the name steps aside
    assert ("body.tabs-row-on .deck.creating .deck-qat .qat-name"
            "{display:none;}") in css


def test_the_building_view_draws_the_slide_behind_its_frames():
    js = assets.deck_js()
    assert "    var back=slideBackdrop(s);" in js
    assert "    if(back){ed.appendChild(back);ed.classList.add('has-back');}" \
        in js
    # the frames do not draw a second copy over it
    assert "        var b=back?null:framePart(it.ns,a.part);" in js
    # drawn by the strip's renderer at the big view's own height
    fn = lift_fn(js, "slideBackdrop")
    assert "var mh=miniHNow,d;miniHNow=H;" in fn
    assert "try{d=miniDiagram(s);}finally{miniHNow=mh;}" in fn
    css = assets.deck_css()
    assert (".pane-editor.has-back .pane.filled .an-cell{background:none;"
            in css)


def test_the_variables_pane_neither_covers_nor_squeezes():
    css = assets.app_css()
    assert ".var-controls .var-chips{order:3;flex:1 0 100%;" in css
    # a class app.js sets with the pane, not a body:has() (speed)
    assert ("  body.vars-open .stage{\n"
            "    padding-right:calc(14px + 280px + 12px);}}") in css


def test_small_rows_that_overran():
    css = assets.deck_css()
    assert ".anim-tabs.np-tabs{padding:0 4px;gap:0;}" in css
    assert ".ovw-head .dbtn{flex:none;white-space:nowrap;}" in css
    # T619 took the status and zoom row off the canvas, so the lift
    # T607 gave the editor's toasts went with it
    assert ".deck.editing .deck-toast{max-width:min(80vw,760px);}" in css
    assert "bottom:58px" not in css


def test_a_drag_from_inside_let_go_over_the_shade_keeps_the_sheet():
    """2026-10-06 review: selecting words in Review and letting go past
    the sheet's edge clicks the sheet itself, which read as outside."""
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    js = assets.deck_js()
    src = (js[js.index("  var SHEETS="):js.index("  function sheetOutside(")]
           + lift_fn(js, "sheetOutside") + "\nvar sheetDown=null;\n"
           + lift_fn(js, "sheetBoot") + r"""
var L={},closed=0,stopped=[];
var document={addEventListener:function(k,f){(L[k]=L[k]||[]).push(f);}};
function sheetClose(){closed++;}
sheetBoot();
var sheet={nodeType:1,matches:function(s){return /deck-review/.test(s);},
  getBoundingClientRect:function(){return {left:100,top:50,right:900,bottom:450};}};
var word={nodeType:1,matches:function(){return false;}};
function fire(k,t,x,y){
  var e={type:k,target:t,clientX:x,clientY:y,
    preventDefault:function(){},stopPropagation:function(){stopped.push(k);}};
  (L[k]||[]).forEach(function(f){f(e);});
}
/* a drag: pressed on a word inside, let go over the shade */
fire('pointerdown',word,300,200);fire('mousedown',word,300,200);
fire('mouseup',sheet,20,20);fire('click',sheet,20,20);
var afterDrag=[closed,stopped.slice()];
/* a press on the shade */
stopped=[];
fire('pointerdown',sheet,20,20);fire('click',sheet,20,20);
console.log(JSON.stringify([afterDrag,closed,stopped]));
""")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.js"
        p.write_text(src, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    after_drag, closed, stopped = json.loads(r.stdout.strip().splitlines()[-1])
    assert after_drag == [0, []]          # kept, and nothing swallowed
    assert closed == 1                    # a real press outside still closes
    assert stopped == ["pointerdown", "click"]
