"""T446: a motion plays in the editor as well as the show.

The user, 2026-09-14: "just applied some motions to things and they
did not work. Hmmmmm."

Wobble, Float and Pulse played in the show only, so applying one
changed nothing on screen and read as broken (in the show it did
play: driven, the wobbling shape reported animation-name an-wobble).
Now the class goes on in the editor too; the selected item alone stays
still so it can still be grabbed. And an item with both an entrance
and a motion used to get only the motion, because both classes set
`animation` and the later rule won -- the fifteen pairs now list both,
the entrance first and the motion from where it ends.
"""

from __future__ import annotations


def test_the_editor_moves_too_but_not_the_selected_item(out):
    assert "    if(s.annots&&s.annots.some(function(a){" in out
    assert "          el.classList.add('an-move-'+ma.motion);" in out
    # T445: !important (an inline `animation` would otherwise beat it)
    # and :not(.an-mo-preview), so previewing a movement on the selected
    # item still plays it
    assert ('body.slide-editing .an-item.sel[class*="an-move-"]'
            ':not(.an-mo-preview){\n  animation:none!important;}') in out
    assert "      el.classList.add('an-move-'+v,'an-mo-preview');" in out


def test_an_entrance_and_a_motion_both_play(out):
    """T446 shipped one CSS rule per entrance-and-movement pair, because
    two classes cannot compose one `animation` property. T445 made the
    movement's numbers per-object -- sixty-five pairs -- so motionPaint
    writes both layers into the element's own `animation` instead, the
    entrance first and the movement delayed to where it ends."""
    fn = out.split("  function motionPaint(el,a){")[1].split("\n  }")[0]
    assert "      if(!el.classList.contains('an-anim-'+t)) return;" in fn
    assert "      inL=e[0]+' '+e[1]+'s '+e[2];" in fn
    assert "      +(o.ease||b[3])+' '+(inSec+o.dl).toFixed(2)+'s '" in fn
    assert "    el.style.animation=(inL?(inL+','):'')+layer;" in fn
    for e in ("fade", "rise", "zoom", "slide", "turn"):
        for m in ("wobble", "bob", "pulse"):
            assert f".an-anim-{e}.an-move-{m}{{animation:" not in out, (e, m)
