"""Three doors into and out of the slide editor, driven in Chromium against
the real app server (2026-10-10, from the reviews of the speed work).

Opt-in like every Chromium check: set ``JUNOVIEW_BROWSER_TESTS=1``. The
same three lines are pinned as text in the ordinary suite
(tests/test_deck_doors.py).

1. Opening a deck leaves the keyboard IN the editor. The hand-over chose
   #qat-name, and the open files' tabs then arrived in the title row
   (app.js homeTabsRow, a MutationObserver, after setUIMode returned) and
   hid it -- so Chrome dropped the keyboard on the page, every time, by
   every door. It goes to the editor's own first control now: not a tab of
   that row, and not the command search (a field takes the keys).
2. A presentation opened from a file with the editor already up keeps its
   tab. importDeckText skipped openDeck there, and openDeck is what puts
   a deck on the open list: its tab went the moment you switched away,
   and with it the only way back. Nor was it handed the keyboard: the
   Open dialog had closed, so the keyboard was on the page.
3. Update figures leaves the editor up. It re-reads each notebook through
   APP.reloadTab, whose activate() leaves the editor for a notebook (the
   rail's click, f3ad31f) -- so the editor closed on every press, where
   T123 had it "never closing". Both halves: a notebook unchanged on disk
   (activate) and one that changed (a remount). And leaving the editor
   afterwards still goes where it was opened from (Home here), not to the
   notebook the re-read brought forward under it.
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
    slides = []
    for i in range(4):
        an = [{"k": "text", "x": 6, "y": 5, "w": 80,
               "text": f"talk slide {i + 1}"}]
        if figs:
            an.append({"k": "cell", "x": 6, "y": 20, "w": 50, "h": 60,
                       "ref": f"{stem}::{figs[i % len(figs)]}"})
        slides.append({"layout": "blank", "annots": an, "sid": f"st{i}"})
    decks = as_presentations([{"name": "talk", "slides": slides}])
    (root / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb)], "recent": [str(nb)]},
        indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"stem": stem, "nb": nb, "figs": len(figs)}


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
        yield {"b": browser, "url": url, "tmp": tmp_path, **fx}
    finally:
        srv.shutdown()
        srv.server_close()


def _page(app, w=1366, h=657, init=""):
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');}catch(e){}"
        + init)
    ctx.route("https://cdn.jsdelivr.net/**",
              lambda rt: rt.fulfill(status=404, body=""))
    pg = ctx.new_page()
    errs: list = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(app["url"], wait_until="load")
    pg.wait_for_selector(".nbshell .card")
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
    pg.wait_for_timeout(600)


def _deck_tabs(pg):
    return pg.evaluate(
        "[...document.querySelectorAll('#top-tabstrip .top-pres-tab')]"
        ".map(t=>t.dataset.pres)")


# where the keyboard is: inside the editor, on something on screen that
# is the editor's own (not the open files' row, which leaves with it) and
# is not a field (the editor's keys skip what is typed into)
KEYS = r"""(()=>{const a=document.activeElement,d=document.getElementById('deck');
  return {inDeck:!!(a&&a!==document.body&&d.contains(a)),
    shown:!!(a&&a.getClientRects().length),
    own:!!(a&&!a.closest('#open-tabs-row')),
    field:!!(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)),
    what:a?(a.tagName+'#'+a.id+'.'+String(a.className)):null};})()"""


def _keys_in_editor(pg, where):
    k = pg.evaluate(KEYS)
    assert k["inDeck"] and k["shown"] and k["own"] and not k["field"], \
        f"{where}: the keyboard is on {k}"


def test_opening_a_deck_leaves_the_keyboard_in_the_editor(app):
    ctx, pg, errs = _page(app)
    # the door Home's Recent and the library use
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    assert pg.evaluate("document.body.classList.contains('slide-editing')")
    _keys_in_editor(pg, "opened")
    # ...and the keys work from there at once
    pg.keyboard.press("PageDown")
    pg.wait_for_timeout(300)
    assert pg.evaluate("SemApp.deckState().slide") == 1
    rows = "document.querySelectorAll('#film-list .film-row').length"
    n = pg.evaluate(rows)
    pg.keyboard.press("Control+m")
    pg.wait_for_timeout(400)
    assert pg.evaluate(rows) == n + 1
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(400)
    assert pg.evaluate(rows) == n
    # its tab, from the notebook: the deck comes back (the resume door)
    _tab(pg, app["stem"])
    assert pg.evaluate("SemApp.deckState()") is None
    _tab(pg, "talk", deck=True)
    assert pg.evaluate("SemApp.deckState().name") == "talk"
    _keys_in_editor(pg, "back by its tab")
    # with the open files down the side there is no row to arrive, and
    # the deck's name keeps the keyboard it is given
    pg.evaluate("SemApp.deckClose()")
    pg.wait_for_timeout(400)
    pg.evaluate("SemApp.setFilesAt('side')")
    pg.wait_for_timeout(300)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    _keys_in_editor(pg, "files at the side")
    # and it still comes back where it was when the editor closes
    pg.evaluate("SemApp.deckClose()")
    pg.wait_for_timeout(300)
    pg.evaluate("SemApp.setFilesAt('top')")
    pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('app-file').focus()")
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    _keys_in_editor(pg, "from the File button")
    pg.evaluate("SemApp.deckClose()")
    pg.wait_for_timeout(600)
    assert pg.evaluate("document.activeElement.id") == "app-file"
    assert errs == [], errs
    ctx.close()


def test_a_presentation_opened_in_the_editor_keeps_its_tab(app):
    # the <input> door, which Playwright can drive (the File System Access
    # picker is native); both doors end in the same importDeckTextAsk
    ctx, pg, errs = _page(
        app, init="try{window.showOpenFilePicker=undefined;}catch(e){}")
    f = app["tmp"] / "fresh.json"
    f.write_text(json.dumps({"name": "fresh", "slides": [
        {"layout": "blank", "annots": [
            {"k": "text", "x": 6, "y": 5, "w": 80, "text": "fresh one"}]},
        {"layout": "blank", "annots": [
            {"k": "text", "x": 6, "y": 5, "w": 80, "text": "fresh two"}]}]}),
        encoding="utf-8")
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    # File > Open a presentation... > a file, with the editor up
    pg.click("#dc-file")
    pg.wait_for_timeout(200)
    pg.click("#mi-open")
    pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fc:
        pg.click("#presentation-hub-file")
    fc.value.set_files(str(f))
    pg.wait_for_function("SemApp.deckState()&&SemApp.deckState().name"
                         "==='fresh'")
    pg.wait_for_timeout(600)
    assert _deck_tabs(pg) == ["talk", "fresh"]
    # the keyboard is in the editor, not on the page the closed dialog
    # left it on: Tab moves on from there instead of out of the document
    _keys_in_editor(pg, "after File > Open")
    # away to the notebook: both decks keep their tabs...
    _tab(pg, app["stem"])
    assert pg.evaluate("SemApp.deckState()") is None
    assert _deck_tabs(pg) == ["talk", "fresh"]
    # ...and each is a way back
    _tab(pg, "fresh", deck=True)
    assert pg.evaluate("SemApp.deckState().name") == "fresh"
    _tab(pg, "talk", deck=True)
    assert pg.evaluate("SemApp.deckState().name") == "talk"
    _tab(pg, "fresh", deck=True)
    assert pg.evaluate("SemApp.deckState().name") == "fresh"
    assert _deck_tabs(pg) == ["talk", "fresh"]
    # it is in Recent too, as any deck you opened is
    assert "fresh" in pg.evaluate(
        "JSON.parse(localStorage.getItem(Object.keys(localStorage).find("
        "k=>/recent-presentations$/.test(k)))||'[]')")
    assert errs == [], errs
    ctx.close()


def _update(pg, which="The whole presentation"):
    pg.click("#rbn-tab-home")
    pg.wait_for_timeout(200)
    pg.click("#hm-update")
    pg.wait_for_timeout(200)
    pg.locator("#hm-upd-menu button").filter(has_text=which).first.click()
    # the sentence that ends the verb (not "Re-reading ..."), or first the
    # side-by-side review of what would change (T328) -- over the editor
    done = ("(()=>{const t=document.getElementById('deck-toast');"
            "return !!t&&/updated on|already matches|could not|Kept/"
            ".test(t.textContent)})()")
    pg.wait_for_function(
        f"{done}||!!document.querySelector('dialog.fig-review[open]')",
        timeout=20000)
    if pg.evaluate("!!document.querySelector('dialog.fig-review[open]')"):
        assert pg.evaluate(
            "document.body.classList.contains('slide-editing')")
        pg.click("dialog.fig-review[open] .dbtn.primary")
        pg.wait_for_function(done, timeout=20000)
    pg.wait_for_timeout(400)


def test_update_figures_leaves_the_editor_open(app):
    if not app["figs"]:
        pytest.skip("the example notebook has no figures")
    ctx, pg, errs = _page(app)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    pg.keyboard.press("PageDown")
    pg.wait_for_timeout(300)
    # nothing changed on disk: the re-read comes back "unchanged"
    _update(pg)
    assert pg.evaluate("document.body.classList.contains('slide-editing')")
    assert pg.evaluate("SemApp.deckState()") == {"name": "talk", "slide": 1}
    # the notebook changed on disk: its tab is remounted, under the editor
    nb = json.loads(app["nb"].read_text(encoding="utf-8"))
    nb["cells"].append({"cell_type": "markdown", "metadata": {},
                        "source": ["Written behind the app's back QZXQ."]})
    app["nb"].write_text(json.dumps(nb), encoding="utf-8")
    _update(pg, "Just this slide")
    assert pg.evaluate("document.body.classList.contains('slide-editing')")
    assert pg.evaluate("SemApp.deckState()") == {"name": "talk", "slide": 1}
    assert pg.evaluate("document.getElementById('deck').hidden") is False
    # the re-read took, and the notebook is there to go back to
    _tab(pg, app["stem"])
    assert pg.evaluate("SemApp.deckState()") is None
    shown = pg.evaluate(
        "(()=>{const s=document.querySelector('.nbshell:not([hidden])');"
        "return s?s.textContent.indexOf('QZXQ')>=0:null})()")
    assert shown is True
    _tab(pg, "talk", deck=True)
    assert pg.evaluate("SemApp.deckState().name") == "talk"
    assert errs == [], errs
    ctx.close()


def test_update_figures_leaves_where_the_editor_was_opened_from(app):
    # activate() takes you off Home; the re-read used to leave you there
    # when the editor closed, whichever door had opened it
    if not app["figs"]:
        pytest.skip("the example notebook has no figures")
    ctx, pg, errs = _page(app)
    pg.evaluate("SemApp.goHome(true)")
    pg.wait_for_timeout(400)
    assert pg.evaluate("document.body.classList.contains('welcoming')")
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(800)
    _update(pg)
    assert pg.evaluate("document.body.classList.contains('slide-editing')")
    pg.evaluate("SemApp.deckClose()")
    pg.wait_for_timeout(600)
    assert pg.evaluate("document.body.classList.contains('welcoming')"), \
        "leaving the editor after Update did not go back to Home"
    assert pg.evaluate("location.hash") == "#/home"
    assert errs == [], errs
    ctx.close()
