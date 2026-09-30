"""T588: resizing a cropped picture resizes it.

The user, 2026-09-30: "when trying to re-size and image a lot of the time
it just ends up cropping it if it gets too small, which is definently not
what i want."

A picture with a crop resized free-form -- "the box IS the crop window
and reshaping it is the whole point" -- but it is drawn object-fit:cover,
so every drag that changed the box's shape cut more of the picture away,
and one shrunk until an edge met the size floor was cropped by the other.
It now holds the shape it has (read off the box, not the source picture,
which is not what it shows), Shift still frees it, and reshaping the crop
is the Crop button's job.

Driven: a cropped 307x141 picture dragged down to 84x38 -- ratio 2.18
before, 2.21 after (pixel rounding) -- with nothing more cut away.
"""

from __future__ import annotations


def test_a_cropped_picture_holds_its_shape(out):
    rs = out.split("  function startResize(layer,s,idx,ev0,corner){")[1] \
        .split("\n  }\n")[0]
    assert "if(a.k==='image'&&el&&(a.crop||a.win)&&!cropMode){" in rs
    assert "cropHold=true;imgFree=true;" in rs
    assert "var baseRatio=figRatio||((a.lockar||cropHold)?boxRatio:0);" in rs


def test_its_handles_say_so(out):
    assert "'Drag to resize the crop window'" not in out
