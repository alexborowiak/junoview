"""T541: superscript and subscript.

m², CO₂, x₁ -- raised and lowered characters had no door at all, and
the rich-text allow-list would have unwrapped them on the next blur. Two
buttons beside B I U S (x² and x₂, the italic x reading as maths), the
PowerPoint keys Ctrl+Shift+= and Ctrl+=, and the mini toolbar. They act
on HIGHLIGHTED characters; with none, they say how. The .pptx carries
them both ways as PowerPoint's own run baseline (+30000 / -25000).

Driven: F2 on the title, "Southern" highlighted, Ctrl+Shift+= wrapped it
in <sup>; it survived Escape and a slide change round trip.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_sanitizer_keeps_them(out):
    # (T546 added the link on words after them)
    assert "ul:1,ol:1,li:1,sup:1,sub:1," in out
    assert "'span[style],font,b,strong,i,em,u,s,ul,ol,li,sup,sub,a')" in out


def test_the_doors_and_the_keys(out):
    html = assets.deck_html()
    seg = html.split('id="tx-run-style"')[1].split("</span>")[0]
    assert 'id="fmt-sup"' in seg and 'id="fmt-sub"' in seg
    assert "[['#fmt-sup','superscript'],['#fmt-sub','subscript']]" in out
    assert "return pptClick(e.shiftKey?'#fmt-sup':'#fmt-sub');" in out
    assert "['#fmt-sup','x\\u00b2','Superscript (Ctrl+Shift+=)','']," in out


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_writes_the_baseline():
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 60, "h": 10,
                    "text": "m2 CO2", "sizePct": 4, "paras": [
                        {"runs": [{"t": "m"}, {"t": "2", "sup": True},
                                  {"t": " CO"}, {"t": "2", "sub": True}]}]}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert 'baseline="30000"' in xml
    assert 'baseline="-25000"' in xml


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_reads_it_back():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 60, "h": 10,
                    "text": "m2", "sizePct": 4, "paras": [
                        {"runs": [{"t": "m"}, {"t": "2", "sup": True}]}]}]}]}
    data, _ = build_pptx(spec)
    got = read_pptx(data, "sup.pptx")
    runs = got["spec"]["slides"][0]["items"][0]["paras"][0]["runs"]
    assert [r.get("sup", False) for r in runs] == [False, True]
    imp = assets.deck_js()
    assert "if(r.sup) h='<sup>'+h+'</sup>';" in imp
