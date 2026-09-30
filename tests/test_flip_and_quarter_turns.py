"""T549: flip and quarter turns.

The Arrange menu had "Flip left to right", "Turn a quarter turn right"
and friends, but a flip only mirrored the selection's PLACES: a single
picture flipped moved nowhere and showed nothing different. A flip now
mirrors what a picture, shape, notebook figure, flip book or clip shows
(a.flipH / a.flipV), on the canvas, in the thumbnails and in a .pptx both
ways, and Rotate ▾ on the Object tab is the door PowerPoint has.
"""
from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_a_flip_mirrors_the_content():
    js = assets.load("js/deck/35-arranging.js")
    assert "var FLIPPABLE={image:1,cell:1,flip:1,rect:1,video:1};" in js
    body = js.split("function flipSel(axis){")[1].split("\n  }\n")[0]
    assert "var key=horiz?'flipH':'flipV';" in body
    assert "if(a[key]) delete a[key]; else a[key]=1;" in body
    # a turned thing mirrors about the page's axis: its angle negates
    assert "if(a.rot) a.rot=(360-a.rot)%360||undefined;" in body


def test_the_canvas_mirrors_the_content_not_the_box():
    js = assets.load("js/deck/15-annotations.js")
    body = js.split("function applyCommon(el,a,extraTransform){")[1].split(
        "\n  }\n")[0]
    assert "el.classList.toggle('an-flh',!!a.flipH);" in body
    assert "el.classList.toggle('an-flv',!!a.flipV);" in body
    css = assets.load("css/deck.css")
    assert ".an-item.an-flh{--an-sx:-1;}" in css
    assert "transform:scale(var(--an-sx),var(--an-sy));}" in css
    # the box's handles are never selected by these rules
    rule = css.split(".an-item.an-flh>.an-imgel")[1].split("}")[0]
    assert "an-resize" not in rule and "an-rotate" not in rule


def test_the_thumbnail_mirrors_too():
    js = assets.load("js/deck/50-review-and-overview.js")
    assert ("+((a.flipH||a.flipV)?' scale('+(a.flipH?-1:1)+','"
            "+(a.flipV?-1:1)+')':'');") in js


def test_rotate_has_a_door_on_the_object_tab():
    html = assets.load("html/deck.html")
    assert 'id="fmt-rotwrap" hidden' in html
    assert "Rotate &#9662;</button>" in html
    js = assets.load("js/deck/40-captions-and-components.js")
    assert "wireFloatDropdown('fmt-rotwrap','fmt-rot','fmt-rot-menu'," in js
    for row in ("'r:90','Rotate right 90", "'r:-90','Rotate left 90",
                "'f:v','Flip vertical'", "'f:h','Flip horizontal'",
                "'r:0','Straighten'"):
        assert row in js
    lay = assets.load("js/deck/07-ribbon-layouts.js")
    assert lay.count("'fmt-rotwrap'") == lay.count("'fmt-rotl'") >= 8
    sel = assets.load("js/deck/25-selecting.js")
    assert "show('#fmt-rotwrap',isNum);" in sel


def test_the_model_documents_it():
    from junoview.notebook.deck_schema import ANNOT_COMMON
    assert "flipH" in ANNOT_COMMON and "flipV" in ANNOT_COMMON


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_flips_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "rect", "x": 10, "y": 10, "w": 30, "h": 20,
                    "color": "#ff0000", "shape": "triangle", "flipH": 1},
                   {"t": "rect", "x": 50, "y": 10, "w": 30, "h": 20,
                    "color": "#00ff00", "shape": "triangle", "flipV": 1},
                   {"t": "rect", "x": 10, "y": 60, "w": 30, "h": 20,
                    "color": "#0000ff", "shape": "triangle"}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert xml.count(' flipH="1"') == 1 and xml.count(' flipV="1"') == 1
    got = read_pptx(data, "flip.pptx")
    items = got["spec"]["slides"][0]["items"]
    assert items[0].get("flipH") == 1 and not items[0].get("flipV")
    assert items[1].get("flipV") == 1 and not items[1].get("flipH")
    assert not items[2].get("flipH") and not items[2].get("flipV")
    imp = assets.load("js/deck/62-pptx-import.js")
    assert "if(a.k==='image'||a.k==='rect'||a.k==='video'){" in imp
