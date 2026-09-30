"""T539: measure the gestures, and fix what is slow.

Measured on the example deck at 1440x900 in headless Edge, with a
requestAnimationFrame frame log and CPU profiles of real input:

- slide changes and typing: no frame over 17ms -- nothing to fix;
- a drag's moves: p95 17ms -- the gesture path (2026-08-23 perf pass) holds;
- but the MOUSEDOWN that selects: one 180-210ms frame, every time. The
  profile put it in showFmt (175ms): selecting carries the ribbon to a
  contextual tab, and fitEditRibbon's single-entry key missed on every
  tab move, so the climb re-ran (150ms, `over` alone 121ms of forced
  layout); and fitFilmMax re-ran ribbonMinW's eight-tab walk (98ms)
  whenever the kind of selection changed.

Now: the fit's outcome is kept per key and replayed (checked against the
recorded result, falling back to the climb), the strip's floor is kept
per ribbon state and a new state is measured after the gesture, never
while a button is down. Selecting costs 41ms of script; a deselect,
select and drag held every frame within 33ms.
"""

from __future__ import annotations


def test_the_fit_is_replayed_per_state(out):
    fit = out.split("  function fitEditRibbon(){")[1].split("\n  }\n")[0]
    assert "var memo=ribbonFitMemo[fitKey];" in fit
    assert "if(memo&&ribbonFitReplay(bar,memo,fitKey)) return;" in fit
    assert "ribbonFitRecord(fitKey,bar);" in out
    rep = out.split("  function ribbonFitReplay(bar,m,key){")[1] \
        .split("\n  }\n")[0]
    # a replay that does not reproduce the climb's own result falls back
    assert "if(bar._fitKey===m.after) return true;" in rep
    assert "delete ribbonFitMemo[key];" in rep


def test_the_strip_floor_waits_for_the_gesture(out):
    """T539 kept the strip's floor per ribbon state and measured a new
    state after the gesture. T582 removed the floor and its 98ms walk
    outright (the ribbon no longer shares a row with the strip), so a
    selection has no strip measurement to wait for at all."""
    assert "function fitFilmLater(){" not in out
    assert "filmPtrDown" not in out
    # selecting re-judges the ribbon's density and nothing else
    sel = out.split("    /* groups appearing or leaving changes the width")[1] \
        .split("\n  }\n")[0]
    assert "fitFilmMax" not in sel.split("*/", 1)[1]
    assert "    fitEditRibbon();" in sel
