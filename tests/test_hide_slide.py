"""T554: Hide slide.

PowerPoint's Hide Slide: the slide stays in the deck, in its place and
with its number, and the show goes straight past it. Not Optional, which
plays unless you are running late.
"""
from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_model_keeps_it_everywhere():
    js = assets.load("js/deck/10-decks.js")
    assert "if(s.hide) o.hide=1;" in js
    from junoview.notebook.presentations import as_presentations
    got = as_presentations([{"name": "d", "slides": [
        {"layout": "blank", "annots": [], "hide": 1},
        {"layout": "blank", "annots": []}]}])
    assert got[0]["slides"][0]["hide"] == 1
    assert "hide" not in got[0]["slides"][1]
    from junoview.notebook.deck_schema import SLIDE_KEYS
    assert "hide" in SLIDE_KEYS
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert "| `hide` | int | 1 when this slide is hidden" in fmt


def test_the_python_api_can_hide_a_slide():
    from junoview import Deck
    deck = Deck.from_json({"name": "d", "slides": [
        {"layout": "blank", "annots": []}]})
    s = deck.slides[0]
    assert s.hide is False
    s.hide = True
    assert deck.raw["slides"][0]["hide"] == 1
    s.hide = False
    assert "hide" not in deck.raw["slides"][0]


def test_the_show_goes_straight_past_it():
    js = assets.load("js/deck/50-review-and-overview.js")
    body = js.split("function slideSkipped(i){")[1].split("\n  }\n")[0]
    assert "if(sl.hide) return true;" in body
    assert "function toggleSlideHidden(i){" in js


def test_it_has_doors():
    html = assets.load("html/deck.html")
    assert 'id="pr-hide" aria-pressed="false"' in html
    assert 'data-ic="hideslide"></i> Hide slide</button>' in html
    strip = assets.load("js/deck/55-sections-and-strip.js")
    assert "row((oSl&&oSl.hide)?'✓ Hidden':'Hide slide'" in strip
    assert "e.stopPropagation();toggleSlideHidden(cur);syncHomeDoors();" \
        in strip
    search = assets.load("js/deck/58-command-search.js")
    assert "'pr-hide':'hide slide hidden slide" in search
    from junoview import branding
    assert "hideslide" in branding.icons_map()


def test_the_strip_draws_it_as_powerpoint_does():
    strip = assets.load("js/deck/55-sections-and-strip.js")
    assert "+(s.hide?' hid':'')" in strip
    assert "if(s.hide) mark('hid','hidden'" in strip
    css = assets.load("css/deck.css")
    assert ".film-row.hid .film-n{text-decoration:line-through;}" in css


def test_exports_leave_it_out_except_the_pptx():
    strip = assets.load("js/deck/55-sections-and-strip.js")
    assert "function outputSlides(withHidden){" in strip
    assert "if(s.hide&&!withHidden) return;" in strip
    ex = assets.load("js/deck/60-saving-and-export.js")
    assert "var ents=outputSlides(true);" in ex
    assert "hide:!!ent.s.hide};" in ex
    imp = assets.load("js/deck/62-pptx-import.js")
    assert "if(sl.hidden) s.hide=1;" in imp


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_it_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 80, "h": 10,
                    "text": "shown", "sizePct": 4}]},
        {"hide": True, "items": [{"t": "text", "x": 10, "y": 10, "w": 80,
                                  "h": 10, "text": "hidden",
                                  "sizePct": 4}]}]}
    data, _ = build_pptx(spec)
    z = zipfile.ZipFile(io.BytesIO(data))
    assert ' show="0"' not in z.read("ppt/slides/slide1.xml").decode()
    assert ' show="0"' in z.read("ppt/slides/slide2.xml").decode()
    got = read_pptx(data, "hid.pptx")
    sl = got["spec"]["slides"]
    assert not sl[0].get("hidden") and sl[1].get("hidden") is True
    # and nothing is reported lost for it any more
    assert all("hidden slide" not in str(x) for x in got.get("lost", []))
