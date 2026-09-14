"""T419: brackets and braces in the shape gallery.

The user, 2026-09-14: "Having things like large angle brackets and
stuff is always really useful but they are currently missing." Six
open strokes join the shapes: angle brackets, curly braces and square
brackets, left and right. An open shape takes no fill, draws with
round ends, and stretches with its box like every other path.
"""

from __future__ import annotations

from junoview import assets


def test_six_open_shapes_are_in_the_gallery(out):
    for k in ("langle", "rangle", "lbracket", "rbracket", "lbrace", "rbrace"):
        assert "    " + k + ":'M" in out, k
        assert "['" + k + "'," in out, k
    assert ("  var SHAPE_OPEN={langle:1,rangle:1,lbracket:1,rbracket:1,"
            "lbrace:1,rbrace:1};") in out
    # open: no Z on any of them
    start = out.index("    langle:'M")
    block = out[start:out.index("  var SHAPE_OPEN=", start)]
    assert " Z'" not in block


def test_an_open_shape_is_a_stroke_on_the_slide_and_in_the_gallery(out):
    assert ("      if(SHAPE_OPEN[shp]){\n"
            "        /* T419: a bracket is a stroke; a fill would paint the page\n"
            "           between its arms */\n"
            "        p.setAttribute('stroke-linecap','round');\n"
            "      } else if(a.grad){") in out
    assert ("        p.setAttribute('fill','none');"
            "p.setAttribute('stroke','#c9d6e2');") in out


def test_powerpoint_gets_presets_where_it_has_them_and_a_freeform_where_not():
    js = assets.pptx_js() if hasattr(assets, "pptx_js") else open(
        "src/junoview/assets/js/pptx.js", encoding="utf-8").read()
    assert "lbrace: 'leftBrace', rbrace: 'rightBrace'," in js
    assert "lbracket: 'leftBracket', rbracket: 'rightBracket' };" in js
    assert "var SHAPE_OPEN_PTS = { langle: [[1, 0], [0, 0.5], [1, 1]]," in js
    assert "function freeformGeom(pts) {" in js
    assert "    var geom = open ? freeformGeom(open)" in js
    assert ("    var fill = (open || SHAPE_OPEN_PRESET[item.shape])\n"
            "      ? '<a:noFill/>' : shapeFillXml(item);") in js
    # the drawn stroke uses the same freeform builder
    assert "      + freeformGeom(pts) + '<a:noFill/>'" in js


def test_the_format_names_them():
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert ("`langle`, `rangle`, `lbrace`, `rbrace`, `lbracket`, "
            "`rbracket` (T419)") in fmt
