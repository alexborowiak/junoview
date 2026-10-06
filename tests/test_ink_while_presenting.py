"""Pen, highlighter and eraser in the show, kept only if you say so (T558).

Ink is not the deck: it is held per slide for one run of the show, drawn
in an overlay in the slide's own percentages, and when the show ends with
ink on any slide the editor asks whether to keep it. Kept, each stroke is
an ordinary freehand drawing on its slide (one undo step); discarded, it
is gone. I / H / X pick the pen, the highlighter and the eraser; E wipes
the slide; Escape puts the tool down.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets


def test_ink_is_held_for_the_run_not_written_into_slides():
    js = assets.deck_js()
    assert "var inkTool='',inkStore=new Map(),inkSvg=null,inkBar=null," in js
    down = lift_fn(js, "inkDown")
    # drawing touches the store and the overlay, never s.annots
    assert "annots" not in down and "markDirty" not in down
    assert "inkStore.get(at).push(st);" in down
    # the ink goes back on after every render of the slide
    assert ("    /* T558: the talk's ink goes back on over the slide it was "
            "drawn on */\n    if(typeof inkMount==='function') inkMount();"
            ) in js


def test_the_show_ending_asks_and_keeping_is_one_undo_step():
    js = assets.deck_js()
    assert ("    if(endingTalk&&typeof inkLeave==='function') inkLeave();"
            in js)
    leave = lift_fn(js, "inkLeave")
    assert "ok:'Keep ink',cancel:'Discard'" in leave
    # the store is emptied whatever the answer, so nothing lingers
    assert "inkStore=new Map();inkCur=null;" in leave
    # one markDirty for every slide's strokes: one undo step
    assert leave.count("markDirty(") == 1


def test_the_keys():
    js = assets.deck_js()
    key = lift_fn(js, "talkToolKey")
    for k, call in (("i", "setInkTool('pen')"), ("h", "setInkTool('hl')"),
                    ("x", "setInkTool('erase')"), ("e", "inkClearHere()")):
        assert f"if(k==='{k}'||k==='{k.upper()}'){{{call};return true;}}" \
            in key, k
    assert "talkTool||talkBlackEl||inkTool" in key


def test_a_kept_stroke_is_the_drawing_the_draw_tool_makes():
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    js = assets.deck_js()
    src = ("var INK_HL_OP=0.4;\n" + lift_fn(js, "inkToDraw") + "\n"
           "console.log(JSON.stringify([\n"
           " inkToDraw({t:'pen',c:'#ff3b30',sw:4,pts:[[10,20],[30,20],"
           "[30,60]]}),\n"
           " inkToDraw({t:'hl',c:'#ffd60a',sw:22,pts:[[50,50],[80,50]]}),\n"
           " inkToDraw({t:'pen',c:'#fff',sw:4,pts:[]})]));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.js"
        p.write_text(src, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    pen, hl, none = json.loads(r.stdout.strip().splitlines()[-1])
    assert pen["k"] == "draw" and pen["color"] == "#ff3b30" and pen["sw"] == 4
    assert (pen["x"], pen["y"], pen["w"], pen["h"]) == (10, 20, 20, 40)
    assert pen["pts"] == [[0, 0], [1, 0], [1, 1]]
    assert "op" not in pen and pen["name"] == "Ink"
    # a flat stroke gets the draw tool's floor on its thin axis, centred
    assert hl["h"] == 1.5 and hl["y"] == 49.25
    assert hl["pts"] == [[0, 0.5], [1, 0.5]]
    assert hl["op"] == 0.4 and hl["name"] == "Highlighter ink"
    assert none is None


def test_the_talk_panel_and_the_bar():
    html = assets.deck_html()
    for i in ("talk-pen", "talk-hl", "talk-erase"):
        assert f'id="{i}"' in html, i
    css = assets.deck_css()
    # out of the way: bottom-left, faint until you reach for it
    assert ".jv-inkbar{position:fixed;left:14px;bottom:14px;" in css
    assert ".jv-ink.jv-ink-live{pointer-events:auto;cursor:crosshair;" in css


def test_the_help_says_so():
    h = assets.help_html()
    assert "<b>Ink while you talk.</b>" in h


# ---- 2026-10-06 review fixes ---------------------------------------------

def test_a_stroke_belongs_to_the_slide_it_began_on():
    down = lift_fn(assets.deck_js(), "inkDown")
    assert "var at=pres.slides[cur];" in down
    assert ("if(at){if(!inkStore.has(at)) inkStore.set(at,[]);"
            "inkStore.get(at).push(st);}") in down
    assert "inkHere().push(st)" not in down


def test_taking_the_layer_down_drops_a_half_drawn_stroke():
    mount = lift_fn(assets.deck_js(), "inkMount")
    assert ("      if(inkSvg){inkSvg.remove();inkSvg=null;}\n"
            "      inkCur=null;\n      return;") in mount


def test_leaving_the_show_by_any_door_puts_the_pen_down_and_asks():
    close = lift_fn(assets.deck_js(), "closeDeck")
    assert "if(wasTalk){rehStop();talkToolsReset();}" in close
    # asked once the deck is hidden, so the question is on the page
    assert close.index("deckEl.hidden=true;") < close.index(
        "if(wasTalk) inkLeave();")
