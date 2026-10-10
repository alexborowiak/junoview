"""Moving between notebooks, decks, the library and a talk, driven in
Chromium against the real app server: what is reused is never stale, and
what is skipped is never missed (2026-10-09, speed).

Opt-in like the theme matrix (it needs Playwright's Chromium): set
``JUNOVIEW_BROWSER_TESTS=1``. The pure halves of the same mechanisms run in
the ordinary suite (test_switching_lays_out_once.py).

1. Back to a deck still open in its tab: the strip's rows are the same
   nodes, the undo history is still there and still undoes.
2. Something reaching the deck while it is hidden -- the notebook closed --
   rebuilds the strip on the way back, from the copies the deck kept.
3. A word being typed when F5 starts the talk is the deck's afterwards.
4. The library over the editor: the editor is not made inert, the
   keyboard never reaches it, and its preview draws the first slides and
   the rest as they scroll into view.
5. The presenter window keeps its pair of slides across a build click and
   redraws it on a slide change; the drawer is drawn when it opens.
6. A talk's address follows its clicks once they pause.
7. The keyboard comes back where it was when the editor closes.
8. A collection gone back to keeps its cards; a change redraws them.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.notebook.loader import load_doc
from junoview.notebook.presentations import as_presentations
from junoview.render.page import deck_payload
from junoview.server.routes import _make_handler
from junoview.server.state import _PROJECT_FILE, _AppState

ROOT = Path(__file__).resolve().parent.parent
NB = ROOT / "examples" / "example_climate_analysis.ipynb"
NB2 = ROOT / "examples" / "example_widget.ipynb"


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


def _project(root: Path) -> dict:
    nb = root / NB.name
    nb.write_bytes(NB.read_bytes())
    nb2 = root / NB2.name
    nb2.write_bytes(NB2.read_bytes())
    items = json.loads(deck_payload(load_doc(nb)))["items"]
    figs = [it["anchor"] for it in items if it.get("kind") == "figure"]
    stem = nb.stem

    def deck(name, n):
        slides = []
        for i in range(n):
            an = [{"k": "text", "x": 6, "y": 5, "w": 80,
                   "text": f"{name} slide {i + 1}"},
                  {"k": "text", "x": 60, "y": 25, "w": 30,
                   "text": "one\ntwo\nthree", "list": "bullet",
                   "anim": {"type": "fade", "order": 1, "by": "para"}}]
            if figs and i % 3 != 2:
                an.append({"k": "cell", "x": 6, "y": 20, "w": 50, "h": 60,
                           "ref": f"{stem}::{figs[i % len(figs)]}"})
            slides.append({"layout": "blank", "annots": an,
                           "notes": f"notes {name} {i + 1}",
                           "sid": f"s{name}{i}"})
        return {"name": name, "slides": slides}
    decks = as_presentations([deck("talk", 24), deck("other", 20)])
    (root / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb), str(nb2)],
         "recent": [str(nb), str(nb2)]},
        indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"stem": stem, "stem2": nb2.stem}


@pytest.fixture(scope="module")
def browser():
    _need_browser()
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    try:
        try:
            b = pw.chromium.launch()
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"Chromium will not launch here: {e}")
        yield b
        b.close()
    finally:
        pw.stop()


@pytest.fixture
def app(browser, tmp_path):
    """a fresh project and server for each test: one closes a notebook"""
    fx = _project(tmp_path)
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    try:
        yield {"b": browser, "url": url, **fx}
    finally:
        srv.shutdown()
        srv.server_close()


def _page(app, w=1366, h=657):
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
    ctx.route("https://cdn.jsdelivr.net/**",
              lambda rt: rt.fulfill(status=404, body=""))
    pg = ctx.new_page()
    errs: list = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(app["url"], wait_until="load")
    pg.wait_for_selector(".nbshell .card")
    # the app loads the editor on first use (app.js jvDeck); these drive
    # its API, so they ask for it first
    pg.evaluate("SemApp.deckLoad()")
    pg.wait_for_timeout(800)
    return ctx, pg, errs


def _tab(pg, rx, deck=False):
    sel = (".top-pres-tab .top-pres-main" if deck
           else "#top-tabstrip .tab:not(.top-pres-tab)")
    box = pg.evaluate(
        "([s,rx])=>{const r=new RegExp(rx);const e=[...document"
        ".querySelectorAll(s)].find(e=>r.test(e.textContent)&&"
        "e.getClientRects().length);if(!e)return null;"
        "const b=e.getBoundingClientRect();"
        "return [b.x+b.width/2,b.y+b.height/2]}", [sel, rx])
    assert box, f"no tab {rx}"
    pg.mouse.click(box[0], box[1])
    pg.wait_for_timeout(500)


def _item(pg):
    return pg.evaluate(
        "(()=>{const it=[...document.querySelectorAll('#deck .annot-layer"
        ">.an-item')].filter(e=>e.offsetParent&&e.classList.contains('an-text'));"
        "const e=it[0];if(!e)return null;const r=e.getBoundingClientRect();"
        "return [r.x+r.width/2,r.y+Math.min(r.height/2,10)]})()")


def _geom(pg):
    return pg.evaluate(
        "[...document.querySelectorAll('#deck .annot-layer>.an-item')]"
        ".map(e=>e.getAttribute('style')).join('|')")


def test_back_to_a_deck_reuses_what_is_still_right(app):
    ctx, pg, errs = _page(app)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    before = _geom(pg)
    b = _item(pg)
    pg.mouse.click(b[0], b[1])
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(600)
    moved = _geom(pg)
    assert moved != before
    # (an edit rebuilds the strip at the next slide change, as before;
    # the rows marked are the ones that rebuild made)
    pg.keyboard.press("PageDown")
    pg.wait_for_timeout(300)
    pg.keyboard.press("PageUp")
    pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('#film-list .film-row').__mark=1")
    # 1. a notebook tab and back: the same rows, the same session
    _tab(pg, app["stem"])
    assert pg.evaluate("SemApp.deckState()") is None
    _tab(pg, "talk", deck=True)
    assert pg.evaluate(
        "!!document.querySelector('#film-list .film-row').__mark")
    assert pg.evaluate("document.getElementById('dc-undo').disabled") is False
    assert _geom(pg) == moved
    # the undo still undoes, one nudge at a time
    for _ in range(2):
        pg.keyboard.press("Control+z")
        pg.wait_for_timeout(500)
    assert _geom(pg) == before
    for _ in range(2):
        pg.keyboard.press("Control+y")
        pg.wait_for_timeout(500)
    assert _geom(pg) == moved
    # (undo and redo redraw the strip; these are the rows they drew)
    pg.keyboard.press("PageDown")
    pg.wait_for_timeout(300)
    pg.keyboard.press("PageUp")
    pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('#film-list .film-row').__mark=1")
    # Home and its Recent row are a way back too
    pg.click("#ot-home")
    pg.wait_for_timeout(500)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(600)
    assert pg.evaluate(
        "!!document.querySelector('#film-list .film-row').__mark")
    strip = pg.evaluate("document.getElementById('film-list').innerHTML")
    # 2. the notebook closed while the deck is hidden: rebuilt, and drawn
    #    from the deck's own copies exactly as a fresh open draws them
    _tab(pg, app["stem2"])
    pg.evaluate(f"SemApp.closeNotebook('{app['stem']}')")
    pg.wait_for_timeout(800)
    _tab(pg, "talk", deck=True)
    assert not pg.evaluate(
        "!!document.querySelector('#film-list .film-row').__mark")
    rebuilt = pg.evaluate("document.getElementById('film-list').innerHTML")
    pg.evaluate("SemApp.deckClose()")
    pg.wait_for_timeout(300)
    pg.evaluate("SemApp.deckChoose('other');SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    fresh = pg.evaluate("document.getElementById('film-list').innerHTML")
    assert rebuilt == fresh
    assert strip.count("film-row") == fresh.count("film-row")
    # a deck closed with its X comes back as a fresh session
    pg.evaluate("document.querySelector('#top-tabstrip .top-pres-tab.current"
                " .tab-b').click()")
    pg.wait_for_timeout(600)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(600)
    assert pg.evaluate("document.getElementById('dc-undo').disabled") is True
    assert errs == [], errs
    ctx.close()


def test_typing_survives_a_talk_started_from_the_keyboard(app):
    ctx, pg, errs = _page(app)
    pg.evaluate("SemApp.deckChoose('other')")
    pg.wait_for_timeout(800)
    t = _item(pg)
    pg.mouse.dblclick(t[0], t[1])
    pg.wait_for_timeout(300)
    pg.keyboard.press("End")
    pg.keyboard.type(" QZXQ")
    pg.keyboard.press("F5")
    pg.wait_for_timeout(500)
    assert "QZXQ" in pg.evaluate(
        "document.getElementById('deck-stage').textContent")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(500)
    assert "QZXQ" in pg.evaluate(
        "document.getElementById('deck-stage').textContent")
    assert errs == [], errs
    ctx.close()


def test_the_library_keeps_the_keyboard_and_draws_as_you_scroll(app):
    ctx, pg, errs = _page(app)
    pg.evaluate("SemApp.deckChoose('other')")
    pg.wait_for_timeout(800)
    pg.evaluate("SemApp.deckHub()")
    pg.wait_for_timeout(500)
    st = pg.evaluate("(()=>{const d=document.getElementById('deck');"
                     "return [d.hasAttribute('inert'),"
                     "d.getAttribute('aria-hidden')]})()")
    assert st == [False, "true"]
    for _ in range(40):
        pg.keyboard.press("Tab")
        assert not pg.evaluate(
            "document.getElementById('deck').contains(document.activeElement)")
    for _ in range(10):
        pg.keyboard.press("Shift+Tab")
        assert not pg.evaluate(
            "document.getElementById('deck').contains(document.activeElement)")
    # a stray focus() into the editor is sent back to the dialog
    pg.evaluate("document.getElementById('dc-play').focus()")
    assert pg.evaluate("document.getElementById('presentation-hub')"
                       ".contains(document.activeElement)")
    # the preview: the first slides now, the rest as they come into view
    box = pg.evaluate(
        "n=>{const e=[...document.querySelectorAll('#presentation-hub-all "
        ".presentation-hub-row')].find(e=>e.querySelector("
        "'.presentation-hub-row-name').textContent===n);"
        "const b=e.getBoundingClientRect();return [b.x+30,b.y+b.height/2]}",
        "talk")
    pg.mouse.move(box[0], box[1])
    pg.wait_for_timeout(600)
    probe = ("(()=>{const l=document.querySelector('#presentation-hub-pv "
             ".pv-list');const r=l.getBoundingClientRect();"
             "const f=[...l.querySelectorAll('.pv-slide')];"
             "const vis=f.filter(x=>{const b=x.getBoundingClientRect();"
             "return b.bottom>r.top&&b.top<r.bottom;});"
             "return {n:f.length,lazy:l.querySelectorAll('.pv-lazy').length,"
             "visLazy:vis.filter(x=>x.querySelector('.pv-lazy')).length,"
             "caps:f.filter(x=>x.querySelector('figcaption b')).length}})()")
    first = pg.evaluate(probe)
    assert first["n"] == 24 and first["caps"] == 24
    assert first["lazy"] == 16 and first["visLazy"] == 0
    for _ in range(12):
        pg.evaluate("document.querySelector('#presentation-hub-pv .pv-list')"
                    ".scrollTop+=250")
        pg.wait_for_timeout(150)
        assert pg.evaluate(probe)["visLazy"] == 0
    assert pg.evaluate(probe)["lazy"] < first["lazy"]
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    assert pg.evaluate("document.getElementById('deck')"
                       ".getAttribute('aria-hidden')") is None
    assert errs == [], errs
    ctx.close()


def test_the_talk_draws_what_is_seen_when_it_is_seen(app):
    ctx, pg, errs = _page(app)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    # the drawer is drawn as it opens, not while it is shut
    pg.click("#dc-play")
    pg.wait_for_timeout(600)
    assert pg.evaluate(
        "document.getElementById('deck-pres-drawer').hidden") is True
    pg.evaluate("document.getElementById('deck-pres-open').click()")
    pg.wait_for_timeout(400)
    assert "talk" in pg.evaluate(
        "document.getElementById('deck-pres-list').textContent")
    pg.keyboard.press("Escape")
    # the address follows the clicks once they pause
    h0 = pg.evaluate("location.hash")
    for _ in range(6):    # three builds on slide 1, then onwards
        pg.evaluate("document.getElementById('deck-next').click()")
    slide = pg.evaluate("SemApp.deckState().slide")
    assert slide > 0
    pg.wait_for_timeout(600)
    assert pg.evaluate("location.hash") == f"#/pres/talk/s{slide + 1}"
    assert h0 != pg.evaluate("location.hash")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(500)
    # the presenter window: the pair stays across a build click
    with ctx.expect_page(timeout=10000) as pi:
        pg.evaluate("document.getElementById('pl-presenter').click()")
    pop = pi.value
    pop.wait_for_load_state()
    pg.bring_to_front()
    pg.evaluate("SemApp.deckGo(0)")
    pg.click("#dc-play")
    pg.wait_for_timeout(600)
    pop.evaluate("window.__now=document.getElementById('jvp-now')"
                 ".firstElementChild")
    pg.evaluate("document.getElementById('deck-next').click()")  # a build
    pg.wait_for_timeout(400)
    assert pop.evaluate("document.getElementById('jvp-now')"
                        ".firstElementChild===window.__now")
    for _ in range(4):
        pg.evaluate("document.getElementById('deck-next').click()")
        pg.wait_for_timeout(150)
    pg.wait_for_timeout(400)
    assert pop.evaluate("document.getElementById('jvp-now')"
                        ".firstElementChild!==window.__now")
    assert "talk slide 2" in pop.evaluate(
        "document.getElementById('jvp-now').textContent")
    assert "talk slide 3" in pop.evaluate(
        "document.getElementById('jvp-next').textContent")
    pg.keyboard.press("Escape")
    pop.close()
    assert errs == [], errs
    ctx.close()


def test_the_keyboard_and_the_header_come_back_after_the_editor(app):
    ctx, pg, errs = _page(app, 1280, 600)
    pg.evaluate("document.getElementById('app-file').focus()")
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    assert pg.evaluate("document.activeElement.id") != "app-file"
    # the window changes size under the editor
    pg.set_viewport_size({"width": 1000, "height": 600})
    pg.wait_for_timeout(400)
    pg.evaluate("SemApp.deckClose()")
    pg.wait_for_timeout(600)
    assert pg.evaluate("document.activeElement.id") == "app-file"
    # the header measured for the window it is in now
    got = pg.evaluate(
        "[getComputedStyle(document.documentElement)"
        ".getPropertyValue('--chrome-h').trim(),"
        "Math.ceil(document.getElementById('apptop')"
        ".getBoundingClientRect().height)+'px']")
    assert got[0] == got[1], got
    assert errs == [], errs
    ctx.close()


def test_a_collection_gone_back_to_keeps_its_cards(app):
    ctx, pg, errs = _page(app)
    pg.evaluate("SemCollect.showing(document.querySelector('#ab-collect'))")
    pg.wait_for_timeout(300)
    pg.evaluate("rx=>{const b=[...document.querySelectorAll('button,"
                "[role=menuitem]')].find(b=>new RegExp(rx).test("
                "b.textContent.trim())&&b.offsetParent);b.click()}",
                "^New collection")
    pg.wait_for_timeout(400)
    pg.click("#ask-ok")
    pg.wait_for_timeout(600)
    nm = pg.evaluate("SemCollect.names()")[0]
    pg.evaluate("n=>SemCollect.open(n)", nm)
    pg.wait_for_timeout(800)
    n0 = pg.evaluate("document.querySelector('.coltab:not([hidden])')"
                     ".querySelectorAll('.card').length")
    assert n0 > 3
    pg.evaluate("document.querySelector('.coltab:not([hidden]) .card')"
                ".__mark=1")
    _tab(pg, app["stem"])
    _tab(pg, nm, deck=True)
    assert pg.evaluate("!!document.querySelector('.coltab:not([hidden])"
                       " .card').__mark")
    # a change made to it redraws it
    pg.evaluate("document.querySelector('.coltab:not([hidden]) .col-rm')"
                ".click()")
    pg.wait_for_timeout(600)
    assert pg.evaluate("document.querySelector('.coltab:not([hidden])')"
                       ".querySelectorAll('.card').length") < n0
    assert errs == [], errs
    ctx.close()
