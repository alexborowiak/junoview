"""T553: transitions -- a duration, and three more.

Push, Wipe and Zoom beside Cut, Fade and Move, each with its own length
and a Duration box; played with the outgoing slide kept as a ghost (which
also made Fade a real cross-fade); and exported as PowerPoint's own, at
the exact length, with Move as Morph. Checked against PowerPoint over COM
on 2026-10-01: fade, push, wipe, zoom and morph-by-object at 0.42, 0.6,
1.25, 0.5 and 0.42 s, no repair prompt.
"""
from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def _js():
    return assets.load("js/deck/45-images.js")


def test_six_kinds_each_with_its_own_length():
    js = _js()
    for k in ("['push','Push',", "['wipe','Wipe',", "['zoom','Zoom',"):
        assert k in js
    assert "var TRANS_DEF_MS={fade:420,push:600,wipe:700,zoom:500,move:420};" \
        in js
    body = js.split("function transDurMs(i){")[1].split("\n  }\n")[0]
    assert "if(d>0) return Math.round(Math.max(0.1,Math.min(10,d))*1000);" \
        in body
    html = assets.load("html/deck.html")
    for tid in ("trans-push", "trans-wipe", "trans-zoom", "trans-dur"):
        assert f'id="{tid}"' in html, tid


def test_the_old_slide_is_kept_for_the_transition():
    js = _js()
    cap = js.split("function captureFlip(fromIdx){")[1].split("\n  }\n")[0]
    assert "var oldEl=stage?stage.querySelector('.slide'):null;" in cap
    play = js.split("function playSlideTrans(kind,old,dur){")[1].split(
        "\n  }\n")[0]
    # media in the ghost cannot start again
    assert "$$('video,audio,iframe',old.el).forEach(function(m){m.remove();});" \
        in play
    assert "o.style.clipPath='inset(0 0 0 100%)';" in play       # wipe
    assert "o.style.transform='scale(1.25)';" in play            # zoom
    assert "nEl.style.transform='translateX('+sr.width+'px)';" in play
    assert "ghost.remove();" in play


def test_the_duration_box_and_give_it_to():
    js = _js()
    assert "var du=$('#trans-dur');" in js
    assert "if(!(v>0)||Math.abs(v-def)<0.005) delete sl.tdur;" in js
    assert "du.disabled=!now;" in js          # a cut takes no time


def test_the_model_keeps_the_length():
    from junoview.notebook.presentations import as_presentations
    got = as_presentations([{"name": "d", "slides": [
        {"layout": "blank", "annots": [], "trans": "push", "tdur": 1.5}]}])
    assert got[0]["slides"][0]["tdur"] == 1.5
    assert "if(+s.tdur>0) o.tdur=+s.tdur;" in assets.load(
        "js/deck/10-decks.js")


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_kind_and_length_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    slides = [{"bg": "#ffffff", "trans": "", "items": []}]
    for k, ms in (("push", 600), ("wipe", 1250), ("zoom", 500),
                  ("move", 420)):
        slides.append({"bg": "#ffffff", "trans": k, "tdur": ms,
                       "items": []})
    data, _ = build_pptx({"title": "t", "widthMm": 254, "heightMm": 190.5,
                          "slides": slides})
    z = zipfile.ZipFile(io.BytesIO(data))
    two = z.read("ppt/slides/slide2.xml").decode("utf-8")
    assert '<p:transition spd="med" p14:dur="600"><p:push dir="l"/>' in two
    five = z.read("ppt/slides/slide5.xml").decode("utf-8")
    assert '<p159:morph option="byObject"/>' in five
    got = read_pptx(data, "tr.pptx")
    sl = got["spec"]["slides"]
    assert [s.get("trans") for s in sl] == ["", "push", "wipe", "zoom",
                                            "move"]
    assert [s.get("tdur") for s in sl[1:]] == [0.6, 1.25, 0.5, 0.42]
