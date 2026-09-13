"""T407: a crop handle goes as far as the opposite edge allows.

The user, 2026-09-13: "cropping an object stops halfway, you cannot crop
an object more than half way." Each side was capped at 45%, so the
right-hand third of a figure could never be all that was kept. A handle
(and the Trim edges % box) may now go up to the opposite edge's trim,
leaving a sliver of the picture.
"""

from __future__ import annotations


def test_the_room_is_the_opposite_edge_less_a_sliver(out):
    assert "  var CROP_KEEP=4;" in out
    assert "  function cropRoom(a,side){" in out
    assert "    var opp={t:'b',b:'t',l:'r',r:'l'}[side];" in out
    assert "    return Math.max(0,100-o-CROP_KEEP);" in out


def test_the_handle_and_the_box_both_use_it(out):
    assert ("          v=Math.max(0,Math.min(cropRoom(a,side),"
            "Math.round(v*10)/10));") in out
    assert "      inp.type='number';inp.min='0';inp.max=String(100-CROP_KEEP);" in out
    assert "          var v=Math.min(v0,cropRoom(a,p[0]));   /* T407 */" in out
    # the old half-way cap is gone from the handle and the box (the
    # frame-ratio presets keep theirs: a symmetric trim never passes 50)
    assert "Math.min(45,Math.round(v))" not in out
    assert "inp.max='45'" not in out
