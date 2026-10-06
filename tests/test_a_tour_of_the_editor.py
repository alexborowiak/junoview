"""The slide editor has its own short tour, shown once (T567).

The welcome tour is the notebook's. The slide editor -- where a talk is
made -- had none, so a first visit met a ribbon of seven tabs and a canvas
with nothing to say where to start. It gets nine steps in the order a talk
is made, on the first entry to the editor, through the same spotlight and
tooltip as the notebook's tour; Take a tour runs whichever belongs to what
is open.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine
from junoview import assets


def _steps_src() -> str:
    js = assets.app_js()
    at = js.index("  var EDITOR_TOUR_STEPS=[")
    end = js.index("\n  ];\n", at) + 4
    return js[at:end].replace("var EDITOR_TOUR_STEPS=", "const S=", 1)


def _steps() -> list[dict] | None:
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "steps.js"
        p.write_text(_steps_src() + "\nconsole.log(JSON.stringify(S));\n",
                     encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_steps_follow_how_a_talk_is_made():
    steps = _steps()
    if steps is None:
        pytest.skip("no JS engine")
    titles = [s["title"] for s in steps]
    assert titles == [
        "The slide editor", "The ribbon", "Your figures", "Your slides",
        "The slide", "Find any command", "Saving", "Where you are",
        "Present",
    ]
    # short enough for the 400px tip at a laptop's height
    for s in steps:
        assert len(s["text"]) <= 260, s["title"]


def test_every_step_points_at_something_the_editor_has(out):
    steps = _steps()
    if steps is None:
        pytest.skip("no JS engine")
    for s in steps:
        if "sel" not in s:
            continue
        for sel in s["sel"].split(","):
            m = re.match(r"#([\w-]+)", sel.strip())
            assert m, sel
            assert f'id="{m.group(1)}"' in out, sel


def test_take_a_tour_tours_what_is_open():
    js = assets.app_js()
    assert "  function tourStart(which){" in js
    assert ("    var ed=which==='editor'||(which!=='notebook'\n"
            "      &&document.body.classList.contains('slide-editing'));") in js
    assert "    tourSteps=ed?EDITOR_TOUR_STEPS:TOUR_STEPS;" in js
    # each tour is shown once, under its own flag; the notebook's keeps the
    # flag it has always had, so nobody is re-shown it
    assert "    tourKey=ed?EDITOR_TOUR_KEY:'plotline-tour';" in js
    assert "  var EDITOR_TOUR_KEY='plotline-tour-editor';" in js
    assert "    try{localStorage.setItem(tourKey,'1');}catch(e){}" in js
    # no step list is read by name inside the machine any more
    machine = js[js.index("  function tourEl(step){"):
                 js.index("  APP.startTour=tourStart;")]
    assert "TOUR_STEPS.length" not in machine


def test_the_first_entry_to_the_editor_starts_it():
    js = assets.app_js()
    fn = js[js.index("  function maybeEditorTour(){"):]
    fn = fn[:fn.index("\n  }\n") + 4]
    assert "slide-editing" in fn
    assert "localStorage.getItem(EDITOR_TOUR_KEY)" in fn
    # never over the notebook's tour while that is still showing
    assert "var t=$('#tour'); if(!t||!t.hidden) return;" in fn
    assert "tourStart('editor');" in fn
    assert ("  if(window.MutationObserver) new MutationObserver(maybeEditorTour)\n"
            "    .observe(document.body,{attributes:true,"
            "attributeFilter:['class']});") in js


def test_the_help_says_so():
    assert "walks you round\nitself in nine short steps" in assets.help_html()


# ---- 2026-10-06 review fixes ---------------------------------------------

def test_the_tours_keys_stop_before_the_deck_hears_them():
    app = assets.load("js/app.js")
    keys = app.split("    window.addEventListener('keydown',function(e){\n"
                     "      var t=$('#tour'); if(!t||t.hidden) return;", 1)
    assert len(keys) == 2, "the tour's keys are on window"
    body = keys[1].split("},true);", 1)[0]
    # Escape skips the tour and stops: the deck's Escape ladder would
    # otherwise leave the editor
    assert "if(e.key==='Escape'){e.preventDefault();e.stopPropagation();" \
        "tourEnd();}" in body
    assert body.count("e.stopPropagation();") == 3


def test_the_editor_tour_waits_for_a_question_to_be_answered():
    app = assets.load("js/app.js")
    fn = app.split("  function maybeEditorTour(){", 1)[1].split(
        "\n  }\n", 1)[0]
    assert ("if(document.querySelector('.save-ask:not([hidden]),'\n"
            "        +'.aa-dlg:not([hidden])')){\n"
            "        edTourArmed=true;setTimeout(fire,900);return;}") in fn
    assert fn.index("setTimeout(fire,900)") < fn.index("tourStart('editor')")
