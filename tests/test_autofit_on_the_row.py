"""T572: AutoFit is on the row.

Shrink to fit lived only on the right-click menu, as an on/off row beside
"Forget the fit height". PowerPoint puts AutoFit with the paragraph: the
box grows with its words (Resize shape to fit text), the words shrink
into the box (Shrink text on overflow), or neither (Do not Autofit). The
model already had all three -- no a.fh, a.fh with a.fit 'shrink', a.fh
alone -- so the Paragraph window and the right-click menu now offer them
by those names, and a .pptx carries them both ways.
"""
from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_paragraph_window_has_the_row():
    html = assets.load("html/deck.html")
    panel = html.split('id="fmt-para-menu"')[1].split(
        "</div>\n              </span>")[0]
    assert 'id="fmt-para-fit"' in panel
    assert "autofit &#8212; when the words" in panel
    # beside where the words sit: the two halves of the box's height
    assert panel.index('id="fmt-para-va"') < panel.index('id="fmt-para-fit"')
    js = assets.load("js/deck/30-format-bar.js")
    for word in ("'Grow the box'", "'Shrink the words'", "'Fixed box'"):
        assert word in js
    # PowerPoint's own names are on the tooltips, so either finds it
    for pp in ("Resize shape to fit text", "Shrink text on overflow",
               "Do not Autofit"):
        assert pp in js
    assert "var fNow=!a.fh?'g':(a.fit==='shrink'?'s':'x');" in js


def test_the_three_answers_are_the_models_three_states():
    js = assets.load("js/deck/30-format-bar.js")
    body = js.split("if(v.indexOf('f:')===0){")[1].split(
        "return;\n    }")[0]
    # Grow forgets the height -- and middle/bottom, which need one
    assert "if(a.va){delete a.va;unSat=true;}" in body
    assert "delete a.fit;delete a.fh;return;" in body
    # Shrink and Fixed keep the height the box has now
    assert "if(ff==='s') a.fit='shrink'; else delete a.fit;" in body


def test_the_right_click_menu_says_the_same_three_things():
    js = assets.load("js/deck/25-selecting.js")
    assert "menuHead(m,'autofit');" in js
    assert "row(p[1],'',function(){paraApply('f:'+p[0]);},p[2])" in js
    assert "Shrink to fit: on" not in js
    assert "Forget the fit height" not in js


def test_the_command_search_finds_it_by_powerpoints_name():
    js = assets.load("js/deck/58-command-search.js")
    alias = js.split("'fmt-para':")[1].split("',\n")[0]
    for w in ("autofit", "shrink text on overflow", "resize shape"):
        assert w in alias


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_autofit_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 80, "h": 20,
                    "text": "shrunk words", "sizePct": 4, "fit": "shrink",
                    "fontScale": 0.8},
                   {"t": "text", "x": 10, "y": 40, "w": 80, "h": 20,
                    "text": "fixed box", "sizePct": 4, "fit": "fixed"},
                   {"t": "text", "x": 10, "y": 70, "w": 80, "h": 10,
                    "text": "grows", "sizePct": 4}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert '<a:normAutofit fontScale="80000"/>' in xml
    assert xml.count("<a:noAutofit/>") == 1
    assert xml.count("<a:spAutoFit/>") == 1
    got = read_pptx(data, "fit.pptx")
    items = got["spec"]["slides"][0]["items"]
    assert items[0].get("fit") == "shrink"
    assert "fit" not in items[1]
    assert "fit" not in items[2]


def test_the_export_writes_the_height_and_the_scale():
    js = assets.load("js/deck/60-saving-and-export.js")
    assert "fit:!a.fh?'':(a.fit==='shrink'?'shrink':'fixed')," in js
    # the scale the slide drew the words at, from the live layer or an
    # off-screen draw of the slide
    assert "if(fk>0&&fk<1) ti.fontScale=fk;" in js
    assert "?buildSlideNode(fsi):null)||false;" in js
    imp = assets.load("js/deck/62-pptx-import.js")
    assert "if(it.fit==='shrink'&&it.h>0){" in imp
