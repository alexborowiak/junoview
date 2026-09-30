"""T548: Shadow.

None, soft, hard or lifted, on any shape, picture, figure or box, and a
.pptx outer shadow both ways.
"""
from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_presets_scale_with_the_page():
    js = assets.load("js/deck/20-notes-and-tables.js")
    assert "var SHADOWS={soft:{x:0,y:3,b:10,a:0.45},hard:{x:4,y:4,b:0," \
        "a:0.55}," in js
    assert "if(k===null) k=pageScale(layer);" in js
    assert "shadowPaint(layer,s); /* T548 */" in js


def test_each_kind_casts_it_where_it_looks_right():
    js = assets.load("js/deck/20-notes-and-tables.js")
    body = js.split("function shadowPaint(layer,s){")[1].split("\n  }\n")[0]
    # a drawn shape from its SVG, else the box
    assert "if(sv) sv.style.filter=shadowCss(p,k,false);" in body
    # a picture from the picture, a cropped one from its box
    assert "var pic=a.crop?null:(kid('.an-imgwin')||kid('.an-imgel'));" \
        in body
    # a text box with no fill shadows its words
    assert "else if(a.k==='text'&&!(a.bg!==0&&a.bgc)){" in body
    assert "el.style.boxShadow=shadowCss(p,k,true);" in body


def test_the_door_sits_beside_opacity():
    html = assets.load("html/deck.html")
    assert html.index('id="fmt-opcell"') < html.index('id="fmt-shdwrap"')
    assert 'data-ic="shadow"></i> Shadow &#9662;' in html
    js = assets.load("js/deck/40-captions-and-components.js")
    assert "wireFloatDropdown('fmt-shdwrap','fmt-shd','fmt-shd-menu'," in js
    assert "[['none','No shadow'],['soft','Soft'],['hard','Hard'],"  in js
    lay = assets.load("js/deck/07-ribbon-layouts.js")
    assert lay.count("'fmt-opwrap','fmt-shdwrap'") == lay.count(
        "'fmt-opwrap'") >= 8
    from junoview import branding
    assert "shadow" in branding.icons_map()


def test_the_model_documents_it():
    from junoview.notebook.deck_schema import ANNOT_COMMON
    assert "shadow" in ANNOT_COMMON


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_shadows_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    sh = {"soft": {"dx": 0, "dy": 3 / 720, "blur": 10 / 720, "alpha": 0.45},
          "hard": {"dx": 4 / 720, "dy": 4 / 720, "blur": 0, "alpha": 0.55},
          "lift": {"dx": 0, "dy": 9 / 720, "blur": 20 / 720, "alpha": 0.42}}
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "rect", "x": 5, "y": 5, "w": 20, "h": 20,
                    "color": "#ff0000", "shadow": sh["soft"]},
                   {"t": "rect", "x": 30, "y": 5, "w": 20, "h": 20,
                    "color": "#ff0000", "shadow": sh["hard"]},
                   {"t": "text", "x": 5, "y": 40, "w": 40, "h": 10,
                    "text": "lifted", "sizePct": 4, "shadow": sh["lift"]},
                   {"t": "rect", "x": 60, "y": 5, "w": 20, "h": 20,
                    "color": "#00ff00"}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert xml.count("<a:outerShdw ") == 3
    got = read_pptx(data, "shd.pptx")
    items = got["spec"]["slides"][0]["items"]
    assert [i.get("shadow") for i in items] == ["soft", "hard", "lift", None]
