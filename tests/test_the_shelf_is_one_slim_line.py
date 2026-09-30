"""T586: the ribbon's shelf is one slim line.

The user, 2026-09-30: "the drop down menu like this with things like
shapes here, just makes the actual view of the screen so so small. This
is on a laptop, but even on my big monitor before I was finding that it
was getting really squished."

The shelf (T453) laid its options out as full ribbon tiles -- 56px, icon
over word -- over a scrollbar of its own, so opening Shapes took the
ribbon from 92px to 162px. On the shelf a tile is its icon beside its
word, 30px tall, the scrollbar is thin, and the wheel scrolls the line.

Measured on the example deck at 1500x950, Images > Shapes: the shelf
69px -> 37px, the ribbon 162px -> 130px open.
"""

from __future__ import annotations

from junoview import assets


def test_a_shelf_tile_is_a_slim_chip():
    css = assets.deck_css()
    assert "#rbn-shelf-body .fx-tile{flex-direction:row;height:30px;" in css
    assert "#rbn-shelf-body .strip-frame,#rbn-shelf-body .fx-strip{height:auto;}" \
        in css
    assert "#rbn-shelf-body{scrollbar-width:thin;}" in css


def test_the_wheel_scrolls_the_line(out):
    boot = out.split("  function rbnShelfBoot(){")[1].split("\n  }\n")[0]
    assert "body.addEventListener('wheel',function(e){" in boot
    assert "body.scrollLeft+=e.deltaY;e.preventDefault();" in boot
