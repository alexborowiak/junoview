"""The style-recalc state classes, driven in a real Chromium (opt-in).

test_style_recalc.py holds the source and runs the pure parts in node;
this drives the rendered page the way a person does and reads what the
browser actually computed, so a class its owner forgets to set or clear
shows up as the wrong padding, a badge left showing, an outline gone.

Set ``JUNOVIEW_BROWSER_TESTS=1`` to run it; it needs the Python
``playwright`` package and its Chromium (skips cleanly without them).
"""

from __future__ import annotations

import json
import os

import pytest

DECK = {"name": "style-check", "slides": [
    {"layout": "blank", "annots": [
        {"k": "text", "x": 6, "y": 5, "w": 60, "text": "Heading", "size": 4,
         "anim": {"type": "fade", "order": 0}},
        {"k": "text", "x": 6, "y": 40, "w": 40, "text": "", "size": 2},
        {"k": "rect", "x": 60, "y": 50, "w": 20, "h": 20,
         "anim": {"type": "fade", "order": 1}}]},
    {"layout": "blank", "annots": [
        {"k": "text", "x": 6, "y": 5, "w": 60, "text": "Two", "size": 4}]},
]}


@pytest.fixture
def page(out, tmp_path):
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the real-browser checks")
    sync_api = pytest.importorskip("playwright.sync_api")
    path = tmp_path / "page.html"
    path.write_text(out, encoding="utf-8")
    with sync_api.sync_playwright() as pw:
        try:
            browser = pw.chromium.launch()
        except Exception as e:   # no browser installed for playwright
            pytest.skip(f"Chromium unavailable: {e}")
        ctx = browser.new_context(viewport={"width": 1366, "height": 657})
        ctx.add_init_script(
            "try{localStorage.setItem('plotline-tour','1');"
            "localStorage.setItem('plotline-tour-editor','1');"
            "localStorage.setItem('plotline-scheme','colourful');}catch(e){}")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(path.as_uri())
        pg.wait_for_selector(".nbshell .card")
        yield pg
        assert not errors, errors
        browser.close()


def _q(pg, js):
    return pg.evaluate("(()=>" + js + ")()")


def test_state_classes_in_a_real_browser(page):
    pg = page
    body_has = "document.body.classList.contains('%s')"
    stage_pad = ("getComputedStyle(document.querySelector("
                 "'.nbshell:not([hidden]) .stage')).paddingRight")
    # the Variables pane: the class and the room it makes come and go
    pg.evaluate("document.getElementById('vars-btn').click()")
    assert _q(pg, body_has % "vars-open")
    assert _q(pg, stage_pad) == "306px"
    pg.evaluate("document.getElementById('vars-btn').click()")
    assert not _q(pg, body_has % "vars-open")
    assert _q(pg, stage_pad) != "306px"

    pg.evaluate("t=>window.SemDeckImport(t,false)", json.dumps(DECK))
    pg.wait_for_function("document.body.classList.contains('slide-editing')")
    pg.mouse.click(1250, 600)
    pg.wait_for_timeout(300)

    # an empty text box keeps its dashed edge; one with words does not
    outlines = _q(pg, "[...document.querySelectorAll('#deck-stage "
                      ".an-item.an-text')].map(e=>getComputedStyle(e)"
                      ".outlineStyle)")
    assert sorted(outlines) == ["dashed", "none"]

    badge = ("[...document.querySelectorAll('#deck-stage .%s')]"
             ".map(e=>getComputedStyle(e).display)")
    # reading order: the badges show while the panel is open, and only then
    pg.evaluate("window.SemDeckReadingOrder()")
    assert _q(pg, body_has % "rd-order-on")
    assert set(_q(pg, badge % "an-readno")) == {"flex"}
    pg.keyboard.press("Escape")
    assert not _q(pg, body_has % "rd-order-on")
    assert set(_q(pg, badge % "an-readno")) == {"none"}

    # the Timeline's build bubbles: shown with the pane, gone when another
    # pane takes its place (paneShow writes `hidden` directly)
    pg.evaluate("document.getElementById('vw-anim').click()")
    pg.wait_for_timeout(200)
    assert set(_q(pg, badge % "an-buildno")) == {"flex"}
    pg.evaluate("document.getElementById('objects-btn').click()")
    pg.wait_for_timeout(200)
    assert set(_q(pg, badge % "an-buildno")) == {"none"}

    # the docked pane's width reaches the stage's padding as it is dragged
    grip = _q(pg, "(()=>{const r=document.querySelector('#selpane "
                  ".selpane-grip').getBoundingClientRect();"
                  "return [r.x+r.width/2,r.y+r.height/2]})()")
    pg.mouse.move(grip[0], grip[1])
    pg.mouse.down()
    pg.mouse.move(grip[0] - 60, grip[1], steps=4)
    pg.wait_for_timeout(150)
    w = _q(pg, "Math.round(document.getElementById('selpane')"
               ".getBoundingClientRect().width)")
    pad = _q(pg, "getComputedStyle(document.getElementById('deck-stage'))"
                 ".paddingRight")
    pg.mouse.up()
    assert pad == f"{w + 22}px"
    pg.evaluate("document.getElementById('objects-btn').click()")

    # the strip's divider: the live width is the column's own, and on
    # release it goes back to the stylesheet with the column unmoved
    fr = _q(pg, "(()=>{const r=document.getElementById('film-resize')"
                ".getBoundingClientRect();"
                "return [r.x+r.width/2,r.y+r.height/2]})()")
    col = "document.getElementById('deck-create')"
    pg.mouse.move(fr[0], fr[1])
    pg.mouse.down()
    pg.mouse.move(fr[0] + 40, fr[1], steps=4)
    mid = _q(pg, "[" + col + ".style.width,Math.round(" + col
             + ".getBoundingClientRect().width)]")
    assert mid[0] == f"{mid[1]}px"
    pg.mouse.up()
    after = _q(pg, "[" + col + ".style.width,Math.round(" + col
               + ".getBoundingClientRect().width),"
               "document.getElementById('deck').style"
               ".getPropertyValue('--film-w')]")
    assert after == ["", mid[1], f"{mid[1]}px"]

    # Colourful: under the editor the page keeps its zone, the editor takes
    # the tab's hue at once, and the page catches up when it shows again
    pg.click("#rbn-tab-design")
    zones = _q(pg, "[document.body.getAttribute('data-theme-zone'),"
                   "document.getElementById('deck')"
                   ".getAttribute('data-theme-zone'),"
                   "getComputedStyle(document.getElementById('deck'))"
                   ".getPropertyValue('--accent').trim()]")
    assert zones[1:] == ["design", "#82a8ff"]
    assert zones[0] != "design"
    pg.mouse.click(1250, 600)
    pg.keyboard.press("Escape")          # to the builder, beside the page
    pg.wait_for_function("!document.body.classList.contains('slide-editing')")
    assert _q(pg, "document.body.getAttribute('data-theme-zone')") == "design"
