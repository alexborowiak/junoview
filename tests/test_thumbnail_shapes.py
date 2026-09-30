"""Rectangles and ellipses show in the slide thumbnails.

The canvas draws a rectangle and an ellipse as a CSS box, so neither has
an entry in SHAPE_PATHS. The strip (and the overview map, and the design
surface's outline sheet -- every miniDiagram) draws each shape through
drawShapeSvg, which wrote them as d="": the two commonest shapes were
missing from every thumbnail (found 2026-10-01, driving T572).
"""
from junoview import assets


def test_draw_shape_svg_has_an_outline_for_the_css_shapes():
    js = assets.load("js/deck/10-decks.js")
    body = js.split("function drawShapeSvg(")[1].split("\n  }\n")[0]
    assert "p.setAttribute('d',SHAPE_PATHS[shp]||(shp==='ellipse'" in body
    assert "'M1 50 A49 49 0 1 0 99 50 A49 49 0 1 0 1 50 Z'" in body
    assert "shp==='rect'?'M1 1 H99 V99 H1 Z':''" in body


def test_the_css_shapes_really_are_absent_from_the_path_table():
    """If they are ever added to SHAPE_PATHS the canvas would start
    drawing them as SVG too -- this fallback exists only because they
    are not there."""
    js = assets.load("js/deck/10-decks.js")
    table = js.split("var SHAPE_PATHS={")[1].split("};")[0]
    assert "rect:" not in table and "ellipse:" not in table


def test_a_thumbnail_shape_is_not_clipped_at_its_own_edge():
    css = assets.load("css/deck.css")
    assert ".mini-it.is-shape{overflow:visible;}" in css
