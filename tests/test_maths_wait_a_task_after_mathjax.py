"""What is on screen is typeset in a task of its own once MathJax arrives,
not in the task it arrived in (2026-10-10, load cost).

MathJax's own startup runs in the task its script ran in -- its page-ready
hangs off the window's load, which fires in that same task when MathJax
is the last thing the page waited for. jvMath's first on-screen pass used
to chain straight on, so the three were one task of 0.8-1.1 s at 4x CPU,
the longest of the load once the slide editor stopped loading with the
page (DOMContentLoaded and load came earlier, next to MathJax). The next
animation frame was tried and measured worse: the pass and that frame's
layout of the whole page became one task of 0.65-0.72 s. A task of its
own keeps each of the three apart.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import ASSETS, js_engine, lift_fn

APP_JS = (ASSETS / "js" / "app.js").read_text(encoding="utf-8")


def _run(body: str) -> list:
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine (node or VS Code) here")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(body, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_first_pass_is_a_task_of_its_own():
    got = _run(
        "var calls=[],tasks=[];\n"
        "function requestAnimationFrame(f){calls.push('frame');f();}\n"
        "function setTimeout(f,ms){calls.push('task '+ms);tasks.push(f);}\n"
        "function pump(n){calls.push('pump '+n);}\n"
        + lift_fn(APP_JS, "arrived") + "\n"
        "arrived();\n"
        "calls.push('arrived returned');\n"
        "tasks.forEach(function(f){f();});\n"
        "console.log(JSON.stringify(calls));\n")
    # queued, not run in the arrival's own task -- and not in a frame
    assert got == ["task 0", "arrived returned", "pump -1"]


def test_mathjax_arriving_goes_through_it():
    pump = lift_fn(APP_JS, "pump")
    assert "if(!ready){if(!dead) ensure().then(arrived,noop);return;}" in pump
    # ...and only the arrival: once MathJax is here, what is on screen is
    # still typeset at once (the on-screen pass of a scroll)
    assert pump.count("ensure().then(") == 1
    assert "if(b.length){now(b);lastSoon=Date.now();}" in pump
