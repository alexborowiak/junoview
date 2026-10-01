"""T571: bullets you can style.

A bullet's colour and size, and a numbered list that starts at any
number -- PowerPoint's Bullets and Numbering, at the foot of both list
galleries -- drawn on the marker alone and carried by a .pptx both ways,
along with which of the deck's twelve markers it is.
"""
from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_marker_alone_takes_the_colour_and_size():
    js = assets.load("js/deck/20-notes-and-tables.js")
    assert "if(a.lcol) tx2.style.setProperty('--an-lc',tokVal(a.lcol));" in js
    assert "tx2.setAttribute('start',String(a.lstart|0));" in js
    css = assets.load("css/deck.css")
    assert ".an-ul li::marker{color:var(--an-lc,currentColor);" in css
    assert "font-size:calc(var(--an-ls,1) * 1em);}" in css


def test_both_galleries_end_in_the_options():
    js = assets.load("js/deck/30-format-bar.js")
    assert "more.textContent=g.ord?'Numbering options\\u2026'" in js
    assert "function listOptions(ord){" in js
    body = js.split("function listOptions(ord){")[1].split("\n  }\n")[0]
    # a box that is not a list yet becomes one of the gallery's family
    assert "if(!lst||listIsOrdered(lst)!==ord)" in body
    # start-at only for numbering
    assert "if(ord) rows.push({k:'start',label:'Start at'" in body


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_the_marker_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [
            {"t": "text", "x": 5, "y": 5, "w": 60, "h": 20,
             "text": "a\nb", "sizePct": 4, "bullets": True,
             "lkind": "check", "lcol": "#ff3355", "lsz": 1.5,
             "paras": [{"lvl": 0, "bullet": True, "runs": [{"t": "a"}]},
                       {"lvl": 0, "bullet": True, "runs": [{"t": "b"}]}]},
            {"t": "text", "x": 5, "y": 40, "w": 60, "h": 20,
             "text": "c\nd", "sizePct": 4, "bullets": True,
             "lkind": "roman", "lstart": 5,
             "paras": [{"lvl": 0, "num": True, "runs": [{"t": "c"}]},
                       {"lvl": 0, "num": True, "runs": [{"t": "d"}]}]}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert '<a:buClr><a:srgbClr val="FF3355"/></a:buClr>' in xml
    assert '<a:buSzPct val="150000"/>' in xml
    assert '<a:buAutoNum type="romanLcPeriod" startAt="5"/>' in xml
    got = read_pptx(data, "bul.pptx")
    items = got["spec"]["slides"][0]["items"]
    p0 = items[0]["paras"][0]
    assert p0["lkind"] == "check" and p0["lcol"] == "#ff3355"
    assert p0["lsz"] == 1.5
    p1 = items[1]["paras"][0]
    assert p1["lkind"] == "roman" and p1["lstart"] == 5
    imp = assets.load("js/deck/62-pptx-import.js")
    assert "if(p0&&p0.lcol) a.lcol=p0.lcol;" in imp
