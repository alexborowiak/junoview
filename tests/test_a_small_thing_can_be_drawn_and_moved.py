"""T584: a small shape can be drawn, sized and moved.

The user, 2026-09-30: "I tried drawing an oval just then, but it seems
like there is a minimum size that it can be for some reason" -- a dot
marking a town on a map. Three things stood in the way:

- a resize stopped every edge at 4% of the slide, about 60px on a
  laptop, whatever the item was;
- a draw under 1.5% of the slide on both axes (~22px) was thrown away
  as a stray click;
- a selected item wears eight handles 15px across, which bury a 20px
  dot completely, so it could be resized but not dragged.

Driven: a 12x10px oval drawn on the example deck is kept, shrinks to
6px, and drags by its middle.
"""

from __future__ import annotations

from junoview import assets


def test_the_resize_floor_is_six_screen_pixels(out):
    assert "var mnX=lr.width?600/lr.width:0.5,mnY=lr.height?600/lr.height:0.5;" \
        in out
    assert "if(east) nw=Math.max(mnX,ow+dx);" in out
    assert "if(south) nh=Math.max(mnY,oh+dy);" in out
    # the snap respects the same floor
    assert "if(east){if(nw+bx.d>=mnX){nw+=bx.d;sx=bx.at;}}" in out
    # the old 4% is gone from the gesture
    assert "Math.max(4,ow" not in out and "Math.max(4,oh" not in out


def test_a_click_is_four_pixels_not_a_share_of_the_slide(out):
    assert "var cx=lr.width?400/lr.width:1.5,cy=lr.height?400/lr.height:1.5;" \
        in out
    assert ":boxed?(a.w<cx&&a.h<cy)" in out
    assert ":boxed?(a.w<1.5&&a.h<1.5)" not in out


def test_a_small_selection_keeps_its_middle(out):
    assert "small=br.width<48||br.height<48;" in out
    assert "el.classList.toggle('an-small',small);" in out
    css = assets.deck_css()
    assert ".an-item.sel.an-small .an-rs-e,.an-item.sel.an-small .an-rs-w" \
        "{display:none;}" in css
    assert ".an-item.an-small .an-rs-se{right:-16px;bottom:-16px;}" in css
