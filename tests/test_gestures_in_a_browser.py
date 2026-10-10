"""Editing gestures that do less, driven in Chromium against the real app
server: what is skipped or drawn later is never what the user sees
(2026-10-09, speed, the "gestures" package).

Opt-in like every Chromium check: set ``JUNOVIEW_BROWSER_TESTS=1``. The
pure halves run in the ordinary suite (test_gestures_do_only_what_shows.py).

1. The Style system's table draws the rows in view, yet scrolling shows
   every row in order, Tab walks every row, and a tick keeps the place.
2. A held arrow key moves the boxes and the arrows tied to them, and one
   Ctrl+Z puts the whole run back.
3. X/Y/W/H filled when they come into sight are the numbers a full fill
   gives.
4. The strip keeps the current slide in view as the keys walk the deck.
5. Notes typed and the page left at once: the deck has the words.
6. Every page of an export is sized from the page, the first as the last.
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
    items = json.loads(deck_payload(load_doc(nb)))["items"]
    figs = [it["anchor"] for it in items if it.get("kind") == "figure"]
    stem = nb.stem
    big = []
    for i in range(40):
        an = [{"k": "text", "x": 6, "y": 5, "w": 80,
               "text": f"Heading {i + 1}", "size": 4},
              {"k": "text", "x": 60, "y": 25, "w": 30,
               "text": f"Point {i + 1}"}]
        if figs and i % 3 != 2:
            an.append({"k": "cell", "x": 6, "y": 20, "w": 50, "h": 60,
                       "ref": f"{stem}::{figs[i % len(figs)]}"})
        big.append({"layout": "blank", "annots": an,
                    "notes": f"notes {i + 1}"})
    dia = []
    for i in range(3):
        an = [{"k": "text", "x": 6, "y": 5, "w": 80, "text": f"Diagram {i}"}]
        for j in range(3):
            an.append({"k": "rect", "x": 10 + j * 28, "y": 40, "w": 16,
                       "h": 12})
        for j in range(2):
            an.append({"k": "arrow", "x1": 0, "y1": 0, "x2": 1, "y2": 1,
                       "c1": {"i": 1 + j}, "c2": {"i": 2 + j}})
        dia.append({"layout": "blank", "annots": an})
    # what a render draws ON an object or because of where it is: a
    # comment's marker, a group's frame round a member locked in place,
    # an arrow's off-page mark
    marks = [{"layout": "blank", "annots": [
        {"k": "rect", "x": 20, "y": 30, "w": 20, "h": 15, "oid": "m1",
         "grp": "g1"},
        {"k": "rect", "x": 45, "y": 30, "w": 10, "h": 15, "grp": "g1",
         "lock": "pos"},
        {"k": "arrow", "x1": 80, "y1": 70, "x2": 99, "y2": 70}],
        "comments": [{"id": "c1", "oid": "m1", "text": "look", "by": "me",
                      "at": 1}]}]
    decks = as_presentations([{"name": "big", "slides": big},
                              {"name": "dia", "slides": dia},
                              {"name": "marks", "slides": marks}])
    (root / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb)], "recent": [str(nb)]},
        indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"stem": stem}


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


def _page(app, deck, w=1366, h=657):
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
    # the app loads the editor on first use (app.js jvDeck); this drives
    # its API, so it asks for it first
    pg.evaluate("SemApp.deckLoad()")
    pg.wait_for_timeout(600)
    pg.evaluate(f"SemApp.deckChoose('{deck}')")
    pg.wait_for_timeout(900)
    return ctx, pg, errs


def _pt(pg, sel):
    return pg.evaluate(
        "s=>{const e=document.querySelector(s);if(!e)return null;"
        "const r=e.getBoundingClientRect();return [r.x+r.width/2,"
        "r.y+r.height/2]}", sel)


_VISIBLE_SLIDES = """(()=>{const g=document.querySelector('.dgt-grid');
  const gr=g.getBoundingClientRect();
  return [...g.querySelectorAll('.dgt-si')].filter(c=>{
    const r=c.getBoundingClientRect();
    return r.top>=gr.top+30&&r.bottom<=gr.bottom+1&&r.height>0;})
    .map(c=>[Math.round(c.getBoundingClientRect().top+g.scrollTop),
      +c.textContent]);})()"""


@pytest.mark.parametrize("size", [(1366, 657), (1280, 600)])
def test_the_style_table_draws_what_shows_and_shows_every_row(app, size):
    ctx, pg, errs = _page(app, "big", *size)
    pg.evaluate("document.querySelector('#rbn-tab-design').click()")
    pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#dsg-design-btn').click()")
    pg.wait_for_timeout(700)
    pg.evaluate("[...document.querySelectorAll('button')].find(b=>"
                "/^All text boxes/.test(b.textContent.trim())).click()")
    pg.wait_for_timeout(700)
    rows = 80
    drawn = pg.evaluate("document.querySelectorAll('.dgt-grid .dgt-si').length")
    assert 0 < drawn < rows
    # scroll the whole table: every row shows, in order, at its place
    seen = {}
    top = 0
    while True:
        for y, n in pg.evaluate(_VISIBLE_SLIDES):
            seen.setdefault(y, n)
        sh, ch = pg.evaluate("(()=>{const g=document.querySelector('.dgt-grid');"
                             "return [g.scrollHeight,g.clientHeight]})()")
        if top >= sh - ch:
            break
        top += 120
        pg.evaluate("y=>{document.querySelector('.dgt-grid').scrollTop=y}", top)
        pg.wait_for_timeout(120)
    order = [seen[y] for y in sorted(seen)]
    assert order == [i // 2 + 1 for i in range(rows)]
    ys = sorted(seen)
    pitch = {round(b - a) for a, b in zip(ys, ys[1:], strict=False)}
    assert len(pitch) == 1        # the spacers stand exactly for the rows
    # a tick keeps the table where it was
    pg.evaluate("document.querySelector('.dgt-grid').scrollTop=1200")
    pg.wait_for_timeout(200)
    before = pg.evaluate(_VISIBLE_SLIDES)
    ck = pg.evaluate("""(()=>{const g=document.querySelector('.dgt-grid');
      const gr=g.getBoundingClientRect();const e=[...g.querySelectorAll('.dgt-ck')]
      .find(e=>{const r=e.getBoundingClientRect();
        return r.top>gr.top+40&&r.bottom<gr.bottom});
      const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()""")
    pg.mouse.click(*ck)
    pg.wait_for_timeout(400)
    assert pg.evaluate("document.querySelector('.dgt-grid').scrollTop") == 1200
    assert pg.evaluate(_VISIBLE_SLIDES) == before
    assert "1 of 80 ticked" in pg.evaluate(
        "document.querySelector('.dgt-count').textContent")
    # the keyboard walks every row
    pg.evaluate("document.querySelector('.dgt-grid').scrollTop=0")
    pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('.dgt-grid .dgt-tx').focus()")
    walked = set()
    for _ in range(rows * 12):
        pg.keyboard.press("Tab")
        n = pg.evaluate("""(()=>{const e=document.activeElement;
          const c=e&&e.closest&&e.closest('.dgt-c');if(!c)return null;
          return +c.dataset.dgtRow})()""")
        if n is None:
            break
        walked.add(n)
    assert walked == set(range(rows))
    assert errs == [], errs
    ctx.close()


def test_a_held_arrow_key_moves_boxes_and_tied_arrows_and_undoes_as_one(app):
    ctx, pg, errs = _page(app, "dia")
    geom = ("[...document.querySelectorAll('#deck-stage .annot-layer>.an-item')]"
            ".map(e=>e.style.left+','+e.style.top).join('|')")
    arrows = ("[...document.querySelectorAll('#deck-stage path.an-arrow-line')]"
              ".map(p=>p.getAttribute('d')).join('|')")
    before, abefore = pg.evaluate(geom), pg.evaluate(arrows)
    pg.mouse.click(*_pt(pg, "#deck-stage .annot-layer>.an-item[data-idx='2']"))
    pg.wait_for_timeout(300)
    for _ in range(12):
        pg.keyboard.down("ArrowRight")
        pg.wait_for_timeout(30)
    mid, amid = pg.evaluate(geom), pg.evaluate(arrows)
    pg.keyboard.up("ArrowRight")
    pg.wait_for_timeout(500)
    after, aafter = pg.evaluate(geom), pg.evaluate(arrows)
    assert mid == after and mid != before
    assert amid == aafter and amid != abefore
    # what the page shows is what a full render of the model draws
    pg.keyboard.press("PageDown")
    pg.wait_for_timeout(300)
    pg.keyboard.press("PageUp")
    pg.wait_for_timeout(500)
    assert pg.evaluate(geom) == after
    assert pg.evaluate(arrows) == aafter
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(500)
    assert pg.evaluate(geom) == before
    assert pg.evaluate(arrows) == abefore
    assert errs == [], errs
    ctx.close()


def test_numbers_filled_as_they_come_into_sight_are_the_full_fill(app):
    ctx, pg, errs = _page(app, "big")
    pg.evaluate("document.querySelector('#rbn-tab-home').click()")
    pg.wait_for_timeout(200)
    pg.mouse.click(*_pt(pg, "#deck-stage .annot-layer>.an-item[data-idx='1']"))
    pg.wait_for_timeout(300)
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowDown")
    pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('#rbn-tab-object').click()")
    pg.wait_for_timeout(300)
    shown = pg.evaluate("['x','y','w','h'].map(k=>document.getElementById("
                        "'rb-'+k).value)")
    pg.evaluate("document.querySelector('#fmt-sizepos').click()")
    pg.wait_for_timeout(300)
    full = pg.evaluate("['x','y','w','h'].map(k=>[document.getElementById("
                       "'rb-'+k).value,document.getElementById('sz-'+k).value])")
    assert all(v != "" for v in shown)
    assert [f[0] for f in full] == shown
    assert [f[1] for f in full] == shown
    assert errs == [], errs
    ctx.close()


def test_the_strip_keeps_the_current_slide_in_view(app):
    ctx, pg, errs = _page(app, "big")
    pg.mouse.click(1250, 600)
    for _ in range(25):
        pg.keyboard.press("PageDown")
        pg.wait_for_timeout(80)
        assert pg.evaluate("""(()=>{const l=document.getElementById('film-list');
          const c=l.querySelector('.film-row.current');
          const a=l.getBoundingClientRect(),b=c.getBoundingClientRect();
          return b.top>=a.top-1&&b.bottom<=a.bottom+1})()""")
    assert errs == [], errs
    ctx.close()


def test_notes_typed_and_the_page_left_at_once_are_kept(app):
    ctx, pg, errs = _page(app, "big")
    pg.evaluate("document.querySelector('#rbn-tab-home').click()")
    pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#hm-notes').click()")
    pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const t=document.querySelector('#np-notes');t.focus();"
                "t.setSelectionRange(t.value.length,t.value.length)})()")
    pg.keyboard.type(" QZXQ")
    # straight away: the page is hidden, as a closing tab hides it
    status = pg.evaluate(
        "(()=>{window.dispatchEvent(new Event('pagehide'));"
        "return document.getElementById('deck-status').textContent})()")
    assert "unsaved" in status.lower()
    doc = pg.evaluate("SemDeckFileHtml()")
    data = doc[doc.index('id="junoview-data">') + 19:]
    data = json.loads(data[:data.index("</" + "script>")])
    ps = data if isinstance(data, list) else data.get("presentations", [data])
    big = [p for p in ps if p.get("name") == "big"][0]
    assert big["slides"][0]["notes"].endswith("QZXQ")
    assert errs == [], errs
    ctx.close()


def test_notes_typed_then_another_deck_by_its_address_are_kept(app):
    ctx, pg, errs = _page(app, "big")
    pg.evaluate("document.querySelector('#rbn-tab-home').click()")
    pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#hm-notes').click()")
    pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const t=document.querySelector('#np-notes');t.focus();"
                "t.setSelectionRange(t.value.length,t.value.length)})()")
    pg.keyboard.type("Q")
    # straight away, by the address (Back, a link): nothing is blurred
    pg.evaluate("location.hash='#/pres/dia/s1'")
    pg.wait_for_timeout(1000)
    pg.evaluate("location.hash='#/pres/big/s1'")
    pg.wait_for_timeout(1000)
    doc = pg.evaluate("SemDeckFileHtml()")
    data = doc[doc.index('id="junoview-data">') + 19:]
    data = json.loads(data[:data.index("</" + "script>")])
    ps = data if isinstance(data, list) else data.get("presentations", [data])
    big = [p for p in ps if p.get("name") == "big"][0]
    assert big["slides"][0]["notes"] == "notes 1Q"
    assert errs == [], errs
    ctx.close()


def test_every_page_of_an_export_is_sized_from_the_page(app):
    ctx, pg, errs = _page(app, "big")
    r = pg.evaluate("""(()=>{const root=SemDeckPrintRoot();
      const out=[...root.querySelectorAll('.print-page')].map(p=>{
        const L=p.querySelector('.annot-layer');
        const h=L.getBoundingClientRect().height;
        const t=L.querySelector('.an-text');
        return [h,t?t.style.fontSize:''];});
      root.remove();return out;})()""")
    assert len(r) == 40
    assert {h for h, _ in r} == {720}
    # a 4% heading on a 720px page is 28.8px, on every page alike
    assert all("28.8px" in fs for _, fs in r)
    assert errs == [], errs
    ctx.close()


_MARKS = """(()=>{const L=document.querySelector('#deck-stage .annot-layer');
  const r=x=>Math.round(parseFloat(x)*100)/100;
  return {pins:[...L.querySelectorAll('.cmt-pin')].map(e=>[r(e.style.left),
      r(e.style.top)]),
    frame:[...L.querySelectorAll('.an-grpframe')].map(f=>[r(f.style.left),
      r(f.style.top),r(f.style.width),r(f.style.height)]),
    off:[...L.querySelectorAll('.an-offpage')].map(e=>e.getAttribute(
      'data-idx')).sort(),
    spill:document.getElementById('deck-stage').classList.contains('spill')};
  })()"""


def _rerender(pg):
    # a zoom there and back: the page changes size, so it is drawn again
    pg.click("#zoom-in")
    pg.wait_for_timeout(300)
    pg.click("#zoom-val")
    pg.wait_for_timeout(400)


def test_a_nudge_moves_what_a_render_draws_round_the_object(app):
    ctx, pg, errs = _page(app, "marks")
    pg.mouse.click(*_pt(pg, "#deck-stage .annot-layer>.an-item[data-idx='0']"))
    pg.wait_for_timeout(300)
    for _ in range(5):
        pg.keyboard.press("ArrowRight")
        pg.wait_for_timeout(40)
    pg.wait_for_timeout(500)
    nudged = pg.evaluate(_MARKS)
    # the marker followed its object; the frame hugs the locked member
    assert nudged["pins"] == [[42, 30]]
    assert nudged["frame"] == [[22, 30, 33, 15]]
    _rerender(pg)
    assert pg.evaluate(_MARKS) == nudged
    # an arrow nudged off the page keeps its mark and the stage's scroll
    pg.mouse.click(*_pt(pg, "#deck-stage .annot-layer .an-arrow-hit"))
    pg.wait_for_timeout(300)
    for _ in range(8):
        pg.keyboard.press("Shift+ArrowRight")
        pg.wait_for_timeout(40)
    pg.wait_for_timeout(500)
    off = pg.evaluate(_MARKS)
    assert off["spill"] and off["off"] == ["2"]
    _rerender(pg)
    assert pg.evaluate(_MARKS) == off
    assert errs == [], errs
    ctx.close()
