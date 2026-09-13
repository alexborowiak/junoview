"""T405: a move may leave the page.

The user, 2026-09-13: "it is useful sometimes to be able to drag objects
outside of the slide and leave them there, but that isn't really an
option here." The layer already spilled while editing and the stage
already grew scrollbars for a stray (2026-08-20), but the drag's pointer
was pinned to the page, so its delta could never carry an object past
the edge. The move reads an unclamped point now; drawing tools keep the
clamp. Playback and every export clip to the page, so a parked object is
out of the show until it is dragged back.
"""

from __future__ import annotations


def test_the_move_reads_an_unclamped_point(out):
    assert "  function pctPointFree(layer,ev){" in out
    assert "    return {x:(ev.clientX-r.left)/(r.width||1)*100," in out
    assert ("    var start=pctPointFree(layer,ev0);"
            "   /* T405: a move may leave the page */") in out
    assert "      var p=pctPointFree(layer,ev);   /* T405 */" in out


def test_drawing_still_stays_on_the_page(out):
    assert "  function pctPoint(layer,ev){" in out
    assert ("    return {x:Math.max(0,Math.min(100,"
            "(ev.clientX-r.left)/r.width*100)),") in out
    assert ("      if(tool!=='select') "
            "startDraw(layer,s,tool,pctPoint(layer,ev));") in out


def test_a_stray_is_reachable_and_the_show_clips_it(out):
    # the editor's spill (2026-08-20) is what makes the parked object
    # visible and draggable; playback has no spill class
    assert ".annot-layer.an-spill{overflow:visible;}" in out
    assert ".deck.editing .deck-stage.spill{overflow:auto;}" in out
    assert "if(mode==='edit') layer.classList.add('an-spill');" in out
    assert "      stage.classList.toggle('spill',spill);" in out
