"""Where the keyboard is in the slide editor, the side rail's part picker,
and a .pptx export with MathJax away -- driven in Chromium against the
real app server (2026-10-11 review).

Opt-in like every Chromium check: set ``JUNOVIEW_BROWSER_TESTS=1``. The
decisions are run without a browser in tests/test_the_editor_holds_the_
keyboard.py and tests/test_a_pptx_export_does_not_wait_on_mathjax.py.

1. Opening a deck gives the keyboard to the editor's stage, not to Save:
   Enter and Space press nothing, PageDown and Ctrl+Z work at once.
2. F5 from the editor with the keyboard on the page starts a show whose
   Space advances it, rather than pressing the show's Exit.
3. Escape on the Open dialog with the editor up gives the editor back the
   keyboard; it was left on the page.
5. A .pptx export with MathJax hanging (a CDN that never answers) or
   failing (offline) does not sit for 15 s: a deck with no live maths
   exports at once, one with a live cell after a short wait, its
   equations as the TeX they were written in, and the message says so.
   MathJax arriving late still sets them.
6. "Split in two" stays inside the side rail at both laptop sizes, its
   word and its icon both showing.
"""

from __future__ import annotations

import json
import os
import threading
import time
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
MJ = "https://cdn.jsdelivr.net/**"


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


def _maths_anchor(nb: Path) -> str:
    """the first Markdown cell with display maths in it"""
    cells = json.loads(nb.read_text(encoding="utf-8"))["cells"]
    for c in cells:
        src = "".join(c.get("source", []))
        if c.get("cell_type") == "markdown" and "$$" in src and c.get("id"):
            return "cell:" + c["id"]
    raise AssertionError("the example notebook has no display maths")


def _project(root: Path) -> dict:
    nb = root / NB.name
    nb.write_bytes(NB.read_bytes())
    items = json.loads(deck_payload(load_doc(nb)))["items"]
    figs = [it["anchor"] for it in items if it.get("kind") == "figure"]
    stem = nb.stem
    maths = _maths_anchor(nb)
    assert maths in [it["anchor"] for it in items]
    slides = []
    for i in range(4):
        an = [{"k": "text", "x": 6, "y": 5, "w": 80,
               "text": f"talk slide {i + 1}"}]
        if figs:
            an.append({"k": "cell", "x": 6, "y": 20, "w": 50, "h": 60,
                       "ref": f"{stem}::{figs[i % len(figs)]}"})
        slides.append({"layout": "blank", "annots": an, "sid": f"st{i}"})
    eq = [{"layout": "blank", "sid": "e0", "annots": [
        {"k": "text", "x": 6, "y": 5, "w": 80, "text": "maths slide"},
        {"k": "text", "x": 10, "y": 30, "w": 60, "maths": 1,
         "text": "$$ E = mc^2 + \\frac{a}{b} $$"}]}]
    mref = f"{stem}::{maths}"
    live = [{"layout": "blank", "sid": "m0", "annots": [
        {"k": "text", "x": 6, "y": 5, "w": 80, "text": "a note with maths"},
        {"k": "cell", "x": 6, "y": 20, "w": 80, "h": 70, "ref": mref}]}]
    decks = as_presentations([
        {"name": "talk", "slides": slides},
        {"name": "beta", "slides": [{"layout": "blank", "sid": "b0",
                                     "annots": []}]},
        {"name": "eq", "slides": eq},
        {"name": "mlive", "slides": live, "live": {mref: 1}}])
    (root / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb)], "recent": [str(nb)]},
        indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"stem": stem, "figs": len(figs)}


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


def _page(app, w=1366, h=657, cdn=None):
    """cdn: what MathJax's CDN does -- None answers 404 at once,
    'hang' never answers, 'offline' fails as a cut connection does"""
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
    held: list = []

    def route(rt):
        if cdn == "hang":
            held.append(rt)
        elif cdn == "offline":
            rt.abort("internetdisconnected")
        else:
            rt.fulfill(status=404, body="")
    ctx.route(MJ, route)
    pg = ctx.new_page()
    errs: list = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # not "load": a MathJax that never answers holds the load event
    pg.goto(app["url"], wait_until="domcontentloaded")
    pg.wait_for_selector(".nbshell .card")
    pg.evaluate("window.SemApp.deckLoad()")
    return ctx, pg, errs, held


ACTIVE = r"""(()=>{const a=document.activeElement;
  return a?(a.tagName+'#'+a.id):null;})()"""


def _open(pg, name):
    pg.evaluate(f"window.SemApp.deckChoose('{name}')")
    pg.wait_for_function(
        f"(window.SemApp.deckState()||{{}}).name==='{name}'")
    pg.wait_for_timeout(500)


# --------------------------------------------------------------- 1, 2, 3

def test_opening_a_deck_gives_the_keyboard_to_the_stage(app):
    ctx, pg, errs, _ = _page(app)
    _open(pg, "talk")
    assert pg.evaluate(ACTIVE) == "DIV#deck-stage"
    # Enter and Space press nothing: no click lands anywhere
    pg.evaluate("window.__clk=[];document.addEventListener('click',"
                "e=>window.__clk.push(e.target.id||e.target.className),"
                "true)")
    pg.keyboard.press("Enter")
    pg.keyboard.press(" ")
    pg.wait_for_timeout(300)
    assert pg.evaluate("window.__clk") == []
    assert pg.evaluate(ACTIVE) == "DIV#deck-stage"
    assert pg.evaluate("window.SemApp.deckState()") == \
        {"name": "talk", "slide": 0}
    # ...and the deck's keys work from there at once
    pg.keyboard.press("PageDown")
    pg.wait_for_timeout(300)
    assert pg.evaluate("window.SemApp.deckState().slide") == 1
    rows = "document.querySelectorAll('#film-list .film-row').length"
    n = pg.evaluate(rows)
    pg.keyboard.press("Control+m")
    pg.wait_for_timeout(400)
    assert pg.evaluate(rows) == n + 1
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(400)
    assert pg.evaluate(rows) == n
    # no ring round the whole canvas for holding it
    assert pg.evaluate("getComputedStyle(document.getElementById("
                       "'deck-stage')).outlineStyle") == "none"
    assert errs == [], errs
    ctx.close()


@pytest.mark.parametrize("how", ["canvas", "page"])
def test_f5_from_the_page_starts_a_show_that_space_advances(app, how):
    ctx, pg, errs, _ = _page(app)
    _open(pg, "talk")
    if how == "canvas":
        # a click on the slide canvas, away from anything on it
        r = pg.evaluate("(()=>{const b=document.getElementById('deck-stage')"
                        ".getBoundingClientRect();return [b.right-30,"
                        "b.bottom-30]})()")
        pg.mouse.click(r[0], r[1])
    else:
        pg.evaluate("document.activeElement.blur()")
    pg.wait_for_timeout(200)
    pg.keyboard.press("F5")
    pg.wait_for_function("!document.getElementById('deck').classList"
                         ".contains('editing')")
    pg.wait_for_timeout(400)
    assert pg.evaluate(ACTIVE) != "BUTTON#deck-exit"
    pg.keyboard.press(" ")
    pg.wait_for_timeout(400)
    # still presenting, one slide on
    assert not pg.evaluate("document.getElementById('deck').classList"
                           ".contains('editing')")
    assert pg.evaluate("window.SemApp.deckState()") == \
        {"name": "talk", "slide": 1}
    pg.keyboard.press(" ")
    pg.wait_for_timeout(400)
    assert pg.evaluate("window.SemApp.deckState().slide") == 2
    assert errs == [], errs
    ctx.close()


def test_escape_on_open_gives_the_editor_back_the_keyboard(app):
    ctx, pg, errs, _ = _page(app)
    _open(pg, "talk")
    hub = ("(()=>{const h=document.getElementById('presentation-hub');"
           "return !!(h&&!h.hidden)})()")
    # File > Open a presentation..., then Escape
    pg.click("#dc-file")
    pg.click("#mi-open")
    pg.wait_for_function(hub)
    pg.keyboard.press("Escape")
    pg.wait_for_function("!" + hub)
    assert pg.evaluate(ACTIVE) == "DIV#deck-stage"
    pg.keyboard.press("PageDown")
    pg.wait_for_timeout(300)
    assert pg.evaluate("window.SemApp.deckState().slide") == 1
    # ...and by its close button the same
    pg.click("#dc-file")
    pg.click("#mi-open")
    pg.wait_for_function(hub)
    pg.click("#presentation-hub-close")
    pg.wait_for_function("!" + hub)
    assert pg.evaluate(ACTIVE) == "DIV#deck-stage"
    assert errs == [], errs
    ctx.close()


def test_tab_walks_the_objects_and_then_lets_the_keyboard_out(app):
    # the stage holds the keyboard and Tab walks the slide's objects; past
    # the last one it goes on to the rest of the editor, or a keyboard
    # could never reach the ribbon from it (2026-10-12 review)
    ctx, pg, errs, _ = _page(app)
    _open(pg, "talk")
    sel = ("(()=>{const l=document.querySelector('#deck .annot-layer');"
           "return l?l.querySelectorAll('.an-item.sel').length:0})()")
    pg.keyboard.press("Tab")
    assert pg.evaluate(ACTIVE) == "DIV#deck-stage" and pg.evaluate(sel) == 1
    pg.keyboard.press("Tab")
    assert pg.evaluate(ACTIVE) == "DIV#deck-stage" and pg.evaluate(sel) == 1
    seen = []
    for _ in range(12):
        pg.keyboard.press("Tab")
        seen.append(pg.evaluate(ACTIVE))
    assert seen[0] != "DIV#deck-stage", seen
    assert "BUTTON#dc-save" in seen, seen
    assert errs == [], errs
    ctx.close()


def test_escape_back_to_the_side_panel_keeps_the_keyboard_in_it(app):
    # the side panel hides the stage that held the keyboard: it goes to
    # the panel's first control (Save, where it used to stay), not to the
    # page (2026-10-12 review)
    ctx, pg, errs, _ = _page(app)
    _open(pg, "talk")
    assert pg.evaluate(ACTIVE) == "DIV#deck-stage"
    pg.keyboard.press("Escape")
    pg.wait_for_function("document.getElementById('deck').classList"
                         ".contains('creating')")
    pg.wait_for_timeout(300)
    assert pg.evaluate(ACTIVE) == "BUTTON#dc-save"
    assert errs == [], errs
    ctx.close()


def test_escape_on_open_from_the_readers_file_gives_file_the_keyboard(app):
    # File > Open a presentation... over a notebook: the row that opened
    # the dialog went with its menu, so File takes the keyboard back
    ctx, pg, errs, _ = _page(app)
    pg.wait_for_function("!!window.SemDeckImport")
    hub = ("(()=>{const h=document.getElementById('presentation-hub');"
           "return !!(h&&!h.hidden)})()")
    pg.click("#app-file")
    pg.click("#ot-open")
    pg.wait_for_function(hub)
    pg.keyboard.press("Escape")
    pg.wait_for_function("!" + hub)
    assert pg.evaluate(ACTIVE) == "BUTTON#app-file"
    assert errs == [], errs
    ctx.close()


def test_escape_on_ctrl_k_over_an_open_file_menu_closes_the_dialog(app):
    # File open, then Ctrl+K: the Open dialog covers the menu and holds
    # the keyboard. One Escape closes the dialog (and the menu under it),
    # as before File was app.js's; it used to shut only the hidden menu
    # and put the keyboard on File behind the dialog (2026-10-12 review)
    ctx, pg, errs, _ = _page(app)
    hub = ("(()=>{const h=document.getElementById('presentation-hub');"
           "return !!(h&&!h.hidden)})()")
    pg.click("#app-file")
    pg.keyboard.press("Control+k")
    pg.wait_for_function(hub)
    pg.wait_for_timeout(200)
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    assert not pg.evaluate(hub)
    assert pg.evaluate("document.getElementById('app-file-menu').hidden")
    assert pg.evaluate("document.getElementById('app-file')"
                       ".getAttribute('aria-expanded')") == "false"
    assert pg.evaluate(ACTIVE) == "BUTTON#app-file"
    assert errs == [], errs
    ctx.close()


# --------------------------------------------------------------------- 5

def _export(pg, name, timeout=40.0):
    """SemDeckPptx, answering its question if it asks, until the file is
    saved and said so; (seconds, what was said)"""
    t0 = time.time()
    pg.evaluate("()=>{const t=document.getElementById('deck-toast');"
                "if(t) t.textContent='';window.SemDeckPptx();}")
    said = ""
    while time.time() - t0 < timeout:
        if pg.evaluate("(()=>{const d=document.getElementById('ask-dlg');"
                       "return !!(d&&!d.hidden)})()"):
            pg.click("#ask-ok")
        said = pg.evaluate(
            "(document.getElementById('deck-toast')||{}).textContent||''")
        if f"Saved {name}" in said:
            break
        pg.wait_for_timeout(100)
    return time.time() - t0, said


@pytest.mark.parametrize("cdn", ["hang", "offline"])
def test_a_pptx_with_maths_does_not_wait_for_mathjax_that_cannot_come(
        app, cdn):
    ctx, pg, errs, _held = _page(app, cdn=cdn)
    assert not pg.evaluate("window.jvMath.ready()")
    # a text box's equation never needed MathJax: no wait at all
    _open(pg, "eq")
    took, said = _export(pg, "eq")
    assert took < 4, f"{took:.1f}s for a deck with a text-box equation"
    assert "Saved" in said and "equation" in said
    # a cell live from its notebook: a short wait, and the TeX goes as
    # written, said so
    _open(pg, "mlive")
    took, said = _export(pg, "mlive")
    assert took < 6, f"{took:.1f}s for a deck with a live maths cell"
    assert "kept its equations as the LaTeX they were written in" in said
    assert "MathJax" in said
    # a deck of pictures waits for nothing either
    _open(pg, "talk")
    took, said = _export(pg, "talk")
    assert took < 4 and "Saved" in said
    assert errs == [], errs
    ctx.close()


# a stand-in MathJax, as tests/test_maths_in_a_browser.py serves one:
# startup, and a synchronous typeset that turns each $..$ into an
# <mjx-container> holding its characters
_FAKE_MATHJAX = r"""
(function(){
  function setIn(el){
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),ns=[];
    while(w.nextNode()) ns.push(w.currentNode);
    ns.forEach(function(n){
      var p=n.parentElement;
      if(!p||p.closest('pre,code,script,style,textarea,mjx-container'))
        return;
      if(!/\$[^$]+\$/.test(n.nodeValue)) return;
      var c=document.createElement('mjx-container');
      c.textContent=n.nodeValue.replace(/\$/g,'');
      n.parentNode.replaceChild(c,n);
    });
  }
  window.MathJax={
    startup:{promise:Promise.resolve(),document:{render:function(){}}},
    typeset:function(els){els.forEach(setIn);},
    typesetPromise:function(els){this.typeset(els);return Promise.resolve();},
    typesetClear:function(){}
  };
})();
"""


def test_mathjax_that_arrives_late_still_sets_a_live_cell(app):
    ctx, pg, errs, held = _page(app, cdn="hang")
    _open(pg, "mlive")
    assert not pg.evaluate("window.jvMath.ready()")
    # the frame on the slide was cloned while MathJax was away
    assert "$$" in pg.evaluate(
        "document.querySelector('#deck .annot-layer .an-cell').textContent")
    pg.evaluate("()=>{window.SemDeckPptx();}")
    pg.wait_for_timeout(500)
    # ...and it comes, inside the export's short wait
    for rt in held:
        rt.fulfill(status=200, body=_FAKE_MATHJAX,
                   headers={"content-type": "text/javascript"})
    t0 = time.time()
    said = ""
    while time.time() - t0 < 20 and "Saved mlive" not in said:
        if pg.evaluate("(()=>{const d=document.getElementById('ask-dlg');"
                       "return !!(d&&!d.hidden)})()"):
            pg.click("#ask-ok")
        said = pg.evaluate(
            "(document.getElementById('deck-toast')||{}).textContent||''")
        pg.wait_for_timeout(100)
    assert pg.evaluate("window.jvMath.ready()")
    # set -- cloned again, not the frame cloned while it was away -- so
    # its equations came across as characters, not as TeX
    assert "came across as plain text" in said
    assert "LaTeX they were written in" not in said
    assert errs == [], errs
    ctx.close()


def test_mathjax_that_came_before_the_export_sets_a_frame_drawn_without_it(
        app):
    # the frame was cloned while MathJax was away and kept its TeX in the
    # frame cache; MathJax came, and set the card and the slide; the
    # export clones the frame again rather than writing the TeX and
    # saying MathJax has not loaded (2026-10-12 review)
    ctx, pg, errs, held = _page(app, cdn="hang")
    _open(pg, "mlive")
    assert "$$" in pg.evaluate(
        "document.querySelector('#deck .annot-layer .an-cell').textContent")
    for rt in held:
        rt.fulfill(status=200, body=_FAKE_MATHJAX,
                   headers={"content-type": "text/javascript"})
    pg.wait_for_function("window.jvMath.ready()")
    pg.wait_for_timeout(500)
    took, said = _export(pg, "mlive")
    assert "Saved mlive" in said
    assert "came across as plain text" in said
    assert "LaTeX they were written in" not in said
    assert errs == [], errs
    ctx.close()


# --------------------------------------------------------------------- 6

RAIL = r"""(()=>{const rail=document.querySelector('#deck .edit-tools.ribbon');
  const cs=getComputedStyle(rail),rr=rail.getBoundingClientRect();
  const right=rr.left+parseFloat(cs.borderLeftWidth)+rail.clientWidth;
  return [...document.querySelectorAll('#fmt-parts .cellpartbtn')]
    .filter(b=>b.getClientRects().length).map(b=>{
      const r=b.getBoundingClientRect();
      return {t:b.textContent.trim(),inside:r.left>=rr.left-0.5
        &&r.right<=right+0.5,icon:!!b.querySelector('svg,.bic,i'),
        whole:b.scrollWidth<=b.clientWidth+1};});})()"""


@pytest.mark.parametrize("size", [(1366, 657), (1280, 600)],
                         ids=["1366x657", "1280x600"])
def test_split_in_two_fits_the_side_rail(app, size):
    if not app["figs"]:
        pytest.skip("the example notebook has no figures")
    ctx, pg, errs, _ = _page(app, *size)
    _open(pg, "talk")
    pg.evaluate("document.getElementById('vw-side').click()")
    pg.wait_for_function("document.getElementById('deck').classList"
                         ".contains('rbn-side')")
    box = pg.locator("#deck .annot-layer .an-cell").first.bounding_box()
    pg.mouse.click(box["x"] + box["width"] / 2,
                   box["y"] + box["height"] / 2)
    pg.wait_for_timeout(500)
    btns = pg.evaluate(RAIL)
    assert any(b["t"] == "Split in two" for b in btns), btns
    for b in btns:
        assert b["inside"], f"{b['t']} runs past the rail: {btns}"
        assert b["icon"] and b["t"], f"{b} lost its word or its icon"
        assert b["whole"], f"{b['t']} is cut inside itself"
    assert errs == [], errs
    ctx.close()
