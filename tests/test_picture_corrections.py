"""T550: picture corrections.

Brightness, contrast, saturation and greyscale presets with Reset picture,
kept as settings (a.pfx) over the untouched original and drawn as a filter
on the picture alone. A .pptx carries brightness, contrast and greyscale
as PowerPoint's own -- checked over COM on 2026-10-01: Brightness 0.7 for
+40%, Contrast 0.3 for -40%, ColorType grayscale. PowerPoint draws the
blip's hsl effect as an absolute colour (0% came out black), so saturation
goes only as "none" = greyscale and the export says the rest stays here.
"""
from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_window_and_its_presets():
    html = assets.load("html/deck.html")
    assert 'id="fmt-picwrap"' in html and 'id="fmt-pic-menu"' in html
    js = assets.load("js/deck/30-format-bar.js")
    assert "var PIC_STEPS=[-40,-20,0,20,40],SAT_STEPS=[0,50,100,150,200];" in js
    assert "if(id==='fmt-pic-menu') return buildPicPanel;" in js
    assert "optChip(hosts.g,'Reset picture',false," in js
    sel = assets.load("js/deck/25-selecting.js")
    assert "'#fmt-picwrap':'image cell flip'," in sel


def test_settings_over_the_untouched_picture():
    js = assets.load("js/deck/30-format-bar.js")
    body = js.split("function picApply(fn,say){")[1].split("\n  }\n")[0]
    # defaults are not stored, so Reset is deleting one key
    assert "if(Object.keys(p).length) a.pfx=p; else delete a.pfx;" in body
    rend = assets.load("js/deck/20-notes-and-tables.js")
    assert "function pfxCss(a){" in rend
    assert "f.push('saturate('+(p.s/100).toFixed(2)+')');" in rend
    # a shadow on the same picture keeps the corrections
    assert "(pic||el).style.filter=(pf?pf+' ':'')+shadowCss(p,k,false);" \
        in rend


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_what_powerpoint_can_show():
    from junoview.notebook.pptx_read import read_pptx
    png = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf"
           "FcSJAAAADUlEQVR42mP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==")

    def sl(pfx):
        return {"bg": "#ffffff", "items": [
            {"t": "image", "x": 10, "y": 10, "w": 30, "h": 30, "src": png,
             "pfx": pfx}]}
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        sl({"b": 40, "c": -20}), sl({"g": 1}), sl({"s": 0}),
        sl({"s": 150})]}
    data, _ = build_pptx(spec)
    z = zipfile.ZipFile(io.BytesIO(data))
    one = z.read("ppt/slides/slide1.xml").decode()
    assert '<a:lum bright="40000" contrast="-20000"/>' in one
    assert "<a:grayscl/>" in z.read("ppt/slides/slide2.xml").decode()
    assert "<a:grayscl/>" in z.read("ppt/slides/slide3.xml").decode()
    four = z.read("ppt/slides/slide4.xml").decode()
    assert "<a:hsl" not in four and "<a:grayscl/>" not in four
    got = read_pptx(data, "pfx.pptx")
    items = [s["items"][0] for s in got["spec"]["slides"]]
    assert items[0]["pfx"] == {"b": 40, "c": -20}
    assert items[1]["pfx"] == {"g": 1}
    assert "pfx" not in items[3]
