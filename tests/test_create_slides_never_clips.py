"""T523: Create slides never clips its words.

The 2026-09-29 audit: the first slide of the example deck cut the
descenders off its last line, and a live count found four of fourteen
notes clipped -- slide 13 by two whole lines -- plus a display equation
cut off at the right edge of the column beside its figure. The builder
estimated a note's height from the notebook's own layout; the import now
renders each note at the slide width, off screen, and hands the builder
the real height and how much wider than its column it is drawn.

The builder is still pure: the measurer rides on the plan, and a plan
without one takes the old estimate (the existing auto-slide tests pin
that path). These tests run the lifted builder with a fake measurer.
Driven live: all fourteen slides report scrollHeight == clientHeight and
no descendant past the frame's right edge.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _build(plan: dict, measure_js: str, wide_js: str = "") -> dict:
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    script = ("var AUTO_KINDS={note:1,figure:1,diagnostic:1};\n"
              + lift_fn(src, "autoDeckBuild") + "\n"
              "var plan=" + json.dumps(plan) + ";\n"
              "plan.measure=" + measure_js + ";\n"
              + ("plan.measureWide=" + wide_js + ";\n" if wide_js else "")
              + "console.log(JSON.stringify(autoDeckBuild(plan)));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


def _cells(slide):
    return [a for a in slide["annots"] if a["k"] == "cell"]


def test_the_measured_height_is_the_frame(tmp_path):
    plan = {"name": "t", "sections": [{"title": "One", "items": [
        {"ref": "nb::a", "kind": "note"}]}]}
    # the estimate would have made this 14% (no metrics at all)
    pr = _build(plan, "function(it,w){return 31.5;}")
    note = _cells(pr["slides"][0])[0]
    assert note["h"] == 31.5
    assert "ts" not in note


def test_a_note_longer_than_the_slide_shrinks_its_words():
    plan = {"name": "t", "sections": [{"title": "One", "items": [
        {"ref": "nb::long", "kind": "note"}]}]}
    pr = _build(plan, "function(it,w){return 120;}")
    note = _cells(pr["slides"][0])[0]
    assert note["h"] == 76          # the room under a title
    assert note["ts"] == round(76 / 120, 3)


def test_the_shrink_stops_at_sixty_percent():
    plan = {"name": "t", "sections": [{"title": "One", "items": [
        {"ref": "nb::huge", "kind": "note"}]}]}
    pr = _build(plan, "function(it,w){return 400;}")
    assert _cells(pr["slides"][0])[0]["ts"] == 0.6


def test_a_note_too_wide_for_the_column_is_not_put_beside_a_figure():
    plan = {"name": "t", "sections": [{"title": "Eq", "items": [
        {"ref": "nb::eq", "kind": "note"},
        {"ref": "nb::fig", "kind": "figure", "aspect": 1.5}]}]}
    wide = "function(it,w){return (it.ref==='nb::eq'&&w<50)?1.3:1;}"
    pr = _build(plan, "function(it,w){return 30;}", wide)
    assert len(pr["slides"]) == 2
    assert [a["ref"] for a in _cells(pr["slides"][0])] == ["nb::eq"]
    assert [a["ref"] for a in _cells(pr["slides"][1])] == ["nb::fig"]
    # ...and without the width problem the same pair shares one slide
    pr = _build(plan, "function(it,w){return 30;}",
                "function(it,w){return 1;}")
    assert len(pr["slides"]) == 1


def test_too_wide_even_alone_shrinks_to_the_width():
    plan = {"name": "t", "sections": [{"title": "Eq", "items": [
        {"ref": "nb::eq", "kind": "note"}]}]}
    pr = _build(plan, "function(it,w){return 20;}",
                "function(it,w){return 1.25;}")
    assert _cells(pr["slides"][0])[0]["ts"] == 0.8


def test_the_import_measures_off_screen_and_cleans_up(out):
    fn = out.split("  function autoNoteMeasurer(){")[1] \
        .split("\n  function autoDeckImport(plan){")[0]
    assert "position:fixed;left:-30000px;top:0;width:1280px;" in fn
    assert "c.className='an-cell an-auto-note';" in fn
    assert "return (memo[key]=px?(px+3)/7.2+0.8:0);" in fn
    imp = out.split("  function autoDeckImport(plan){")[1] \
        .split("\n  }\n")[0]
    assert "if(plan){plan.measure=measure;plan.measureWide=measure.wide;}" \
        in imp
    assert "} finally {\n      measure.done();" in imp
