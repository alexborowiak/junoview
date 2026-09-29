"""T542: vertical alignment in a box.

A text box grows with its words (the T15 model, unchanged), so it has no
spare height for its words to sit anywhere in -- except the opt-in fit
line `a.fh` that Shrink to fit already used. Paragraph ▾ gains "where
the words sit": Top (the growing box), Middle or Bottom -- which keep the
height the box has now ("stay this big", toggleFit's rule) and then
place the words in it. A box that keeps a height now has top and bottom
handles that move that height. The .pptx writes the anchor with
noAutofit (autofit would shrink the shape round the words), and an
imported box anchored middle or bottom keeps both its anchor and its
height.

Driven: the title set to Bottom, its bottom handle dragged 66px down --
the box 108px tall with the words at its foot (60px above, 11px below),
no overflow mark.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine


def test_the_model_and_the_render(out):
    assert "if(a.fh&&(a.va==='m'||a.va==='b')){" in out
    assert "d2.style.minHeight='calc('+a.fh+'% - 0.7em - 2px)';" in out
    assert ".an-item.an-text.an-va-m{align-items:center;}" in out
    assert ".an-item.an-text.an-va-b{align-items:flex-end;}" in out
    # a box that keeps a height has vertical handles
    assert "if(editing){d2.appendChild(mkResize(null,a.fh?0:1));" in out
    assert "var fh0=(a.k==='text'&&a.fh)?+a.fh:0;" in out


def test_the_choice_keeps_the_height_it_has(out):
    fn = out.split("  function paraApply(v){")[1].split("\n  }\n")[0]
    assert "if(vv==='t'){delete a.va;if(!a.fit) delete a.fh;return;}" in fn
    assert "a.fh=rr?Math.round((rr.b-rr.t+0.5)*100)/100:12;" in fn
    assert 'id="fmt-para-va"' in out


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_anchors_and_does_not_autofit():
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 60, "h": 30,
                    "text": "foot", "sizePct": 4, "va": "b"},
                   {"t": "text", "x": 10, "y": 50, "w": 60, "h": 10,
                    "text": "top", "sizePct": 4}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert '<a:bodyPr wrap="square" anchor="b"><a:noAutofit/>' in xml
    assert '<a:bodyPr wrap="square" anchor="t"><a:spAutoFit/>' in xml


def test_an_imported_anchor_keeps_its_place(out):
    imp = out.split("  function pptTextAnnot(it){")[1].split("\n  }\n")[0]
    assert "if((it.anchor==='ctr'||it.anchor==='b')&&it.h>0){" in imp
    assert "a.va=it.anchor==='ctr'?'m':'b';a.fh=Math.round(it.h*100)/100;}" \
        in imp
    assert "va:(a.fh&&(a.va==='m'||a.va==='b'))?a.va:''};" in out
