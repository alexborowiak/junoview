"""The slide editor loads when it is first needed -- driven in Chromium
against the real app server (2026-10-10, load cost).

Opt-in like the other browser checks: set ``JUNOVIEW_BROWSER_TESTS=1``.
The parts that need no browser are in test_the_editor_loads_on_first_use.

What is pinned here, each against the page the app serves:

* a notebook is read without the editor: the address is stamped and the
  side list says "nothing open" under Presentations, as the editor's own
  boot made them, and then the editor arrives by itself once the page is
  quiet, in the place its script always had;
* nothing on screen changes when it arrives -- the visible page before
  and after its boot is the same, tabs on top or the list down the side;
* every way in works on its FIRST click, made while the editor is still
  on its way: the click is held and made again once it has booted (the
  editor's script is held back here until the click has landed);
* an address that names a deck opens it, at load or typed in later, and
  a reload with a deck open boots the editor with the page;
* every control the editor wires outside its own markup is one of
  app.js's DOORS (its listeners, read through the DevTools protocol), so
  a control added to the editor later cannot quietly be a dead button
  for the first seconds of a launch;
* the lean boot's /api/emb fetch and the project autosave still happen
  after a late boot.
"""

from __future__ import annotations

import difflib
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
EDITOR_UP = "!!window.SemDeckImport"
HUB_OPEN = ("(()=>{const h=document.getElementById('presentation-hub');"
            "return !!(h&&!h.hidden)})()")
NEW_DIALOG = "document.body.innerText.includes('Blank presentation')"
EDITING = "document.body.classList.contains('slide-editing')"


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


def _project(root: Path) -> None:
    nb = root / NB.name
    nb.write_bytes(NB.read_bytes())
    items = json.loads(deck_payload(load_doc(nb)))["items"]
    fig = next(it for it in items if it.get("kind") == "figure")
    ref = f"{nb.stem}::{fig['anchor']}"
    # a figure frame with its kept copy, so the page boots lean and the
    # copies come from /api/emb (server/state.py)
    deck = {"name": "talk", "slides": [
        {"layout": "blank", "sid": f"s{i}", "annots": [
            {"k": "text", "x": 6, "y": 5, "w": 60, "text": f"Talk {i + 1}"},
            {"k": "cell", "x": 6, "y": 20, "w": 50, "h": 60, "ref": ref}]}
        for i in range(3)],
        "emb": {ref: {"title": fig.get("title", "Fig"), "kind": "figure",
                      "html": '<div class="cardbody"><p>KEPT</p></div>'}}}
    (root / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": as_presentations([deck]), "open": [str(nb)],
         "recent": [str(nb)]}, indent=1) + "\n", encoding="utf-8")


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
    _project(tmp_path)
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    try:
        yield {"b": browser, "url": url, "root": tmp_path}
    finally:
        srv.shutdown()
        srv.server_close()


class Page:
    """A fresh context and page; the editor's script can be held back."""

    def __init__(self, app, *, hold=False, side=False, w=1366, h=657):
        self.ctx = app["b"].new_context(viewport={"width": w, "height": h})
        self.ctx.add_init_script(
            "try{localStorage.setItem('plotline-tour','1');"
            "localStorage.setItem('plotline-tour-editor','1');"
            + ("localStorage.setItem('junoview:openfiles','side');"
               if side else "") + "}catch(e){}")
        self.ctx.route("https://cdn.jsdelivr.net/**",
                       lambda rt: rt.fulfill(status=404, body=""))
        self.held: list = []
        self.hold = hold
        if hold:
            self.ctx.route("**/static/deck.*.js", self._hold)
        self.pg = self.ctx.new_page()
        self.errs: list = []
        self.pg.on("pageerror", lambda e: self.errs.append(str(e)))
        self.reqs: list = []
        self.pg.on("request", lambda r: self.reqs.append(
            (r.method, r.url.split("?")[0])))

    def _hold(self, route):
        if self.hold:
            self.held.append(route)
        else:
            route.continue_()

    def release(self):
        self.hold = False
        for r in self.held:
            r.continue_()
        self.held = []

    def open(self, url, hash_=""):
        self.pg.goto(url + hash_, wait_until="domcontentloaded")
        self.pg.wait_for_selector(".nbshell .card")
        return self

    def close(self):
        self.ctx.close()


def _visible(pg):
    """the visible page outside the editor, as text: element, classes,
    box and own words"""
    return pg.evaluate(r"""(()=>{const out=[];
     for(const e of document.querySelectorAll('body *')){
       if(e.closest('#deck,script,style,template,svg')) continue;
       const r=e.getBoundingClientRect();
       if(!r.width||!r.height) continue;
       const cs=getComputedStyle(e);
       if(cs.visibility==='hidden'||cs.display==='none') continue;
       const own=[...e.childNodes].filter(n=>n.nodeType===3)
         .map(n=>n.textContent.trim()).join(' ').slice(0,40);
       out.push(e.tagName+'#'+e.id+'.'+String(e.className.baseVal!==undefined
         ?e.className.baseVal:e.className)+' '+[r.x,r.y,r.width,r.height]
         .map(Math.round).join(',')+' '+own);}
     out.push(document.body.className+' '+location.hash);
     return out;})()""")


def test_a_notebook_is_read_without_the_editor_and_it_comes_when_quiet(app):
    p = Page(app).open(app["url"])
    pg = p.pg
    try:
        assert not pg.evaluate(EDITOR_UP)
        ref = pg.evaluate("(()=>{const r=document.getElementById('jv-deck-src');"
                          "return r&&[r.type,r.dataset.src]})()")
        assert ref and ref[0] == "text/plain"
        assert ref[1].startswith("/static/deck.") and ref[1].endswith(".js")
        # what the editor's boot used to do that shows, done without it
        assert pg.evaluate("location.hash") == "#/doc/example_climate_analysis"
        assert pg.evaluate("document.getElementById('presstrip').textContent"
                           ".trim()") == "nothing open"
        # ...and it comes by itself once the page has been quiet
        pg.wait_for_function(EDITOR_UP, timeout=30000)
        order = pg.evaluate(
            "[...document.querySelectorAll('script[src]')].map(s=>s.src)"
            ".filter(u=>u.includes('/static/')).map(u=>u.split('/static/')[1]"
            ".split('.')[0])")
        assert order == ["icons", "app", "pptx", "deck"]
        assert pg.evaluate("document.getElementById('jv-deck-src')") is None
        # the deck file was fetched once
        assert len([r for r in p.reqs if "/static/deck." in r[1]
                    and r[1].endswith(".js")]) == 1
        assert p.errs == []
    finally:
        p.close()


@pytest.mark.parametrize("side", [False, True], ids=["tabs-on-top", "side-list"])
def test_nothing_on_screen_changes_when_the_editor_arrives(app, side):
    """...while being read: scrolled down, with words typed in Find --
    the editor arriving at idle takes neither the place nor the caret"""
    p = Page(app, hold=True, side=side).open(app["url"])
    pg = p.pg
    try:
        pg.mouse.move(700, 420)
        pg.mouse.wheel(0, 900)
        pg.click("#doc-find")
        pg.keyboard.type("ENSO")
        pg.wait_for_timeout(800)
        # the reader's own after-scroll shield goes on its own timer
        pg.wait_for_function("!document.querySelector('.jv-scrollshield.on')")
        pg.wait_for_timeout(200)
        state = ("[document.activeElement&&document.activeElement.id,"
                 "document.getElementById('docfind-in').value,"
                 "Math.round((document.scrollingElement||document.body)"
                 ".scrollTop)]")
        before = _visible(pg), pg.evaluate(state)
        assert before[1][0] == "docfind-in" and before[1][1] == "ENSO"
        assert not pg.evaluate(EDITOR_UP)
        p.release()
        pg.evaluate("window.SemApp.deckLoad()")
        assert pg.evaluate(EDITOR_UP)
        pg.wait_for_timeout(500)
        after = _visible(pg), pg.evaluate(state)
        assert before[1] == after[1]
        assert before[0] == after[0], "\n".join(difflib.unified_diff(
            before[0], after[0], lineterm="", n=0))
        # ...and the caret is still where the words go
        pg.keyboard.type(" Z")
        assert pg.evaluate(
            "document.getElementById('docfind-in').value") == "ENSO Z"
        assert p.errs == []
    finally:
        p.close()


def test_a_deck_file_dropped_before_the_editor_opens(app):
    p = Page(app, hold=True).open(app["url"])
    pg = p.pg
    try:
        deck = {"name": "dropped", "slides": [{"layout": "blank", "annots": [
            {"k": "text", "x": 6, "y": 5, "w": 60, "text": "Dropped in"}]}]}
        pg.evaluate("""t=>{const dt=new DataTransfer();
          dt.items.add(new File([t],'dropped.junoview',
            {type:'application/json'}));
          for(const k of ['dragenter','dragover','drop'])
            window.dispatchEvent(new DragEvent(k,{dataTransfer:dt,
              bubbles:true,cancelable:true}));}""", json.dumps(deck))
        pg.wait_for_timeout(300)
        assert not pg.evaluate(EDITOR_UP)
        p.release()
        pg.wait_for_function(
            "window.SemApp.deckState&&(window.SemApp.deckState()||{}).name"
            "==='dropped'", timeout=20000)
        assert p.errs == []
    finally:
        p.close()


# (what is done, what shows once it has worked)
WAYS_IN = {
    "File": ("pg.click('#app-file')",
             "!document.getElementById('app-file-menu').hidden"),
    "File > New > Presentation": (
        "pg.evaluate(\"document.querySelector('#app-file-menu"
        " [data-for=pr-new]').click()\")", NEW_DIALOG),
    "File > Open a presentation": (
        "pg.evaluate(\"document.getElementById('ot-open').click()\")",
        HUB_OPEN),
    "Collect showing": ("pg.click('#ab-collect')",
                        "!!document.querySelector('.col-menu')"),
    "a card's Collect": (
        "pg.locator('.nbshell:not([hidden]) .cell-collect').first.click()",
        "!!document.querySelector('.col-menu')"),
    # every figure has one; the lineage it shows is the editor's
    # (window.SemTrace), and it was a dead button until the editor came
    "a figure's Plot trace": (
        "pg.locator('.nbshell:not([hidden]) .plot-trace-btn').first.click()",
        "!!document.querySelector('.nbshell.tracetab:not([hidden]) .card')"
        "&&String(window.SemApp.active).indexOf('trace::')===0"),
    "Save as view": ("pg.click('#ab-newview')",
                     "document.body.classList.contains('styling')"),
    "Home": ("pg.click('#ot-home')",
             "!document.getElementById('welcome').hidden"
             "&&document.body.classList.contains('welcoming')"),
    "Create slides": ("pg.click('#doc-autoslides');"
                      "pg.click('#auto-slides-create')", EDITING),
    "Ctrl+K": ("pg.mouse.click(700,420);pg.keyboard.press('Control+k')",
               HUB_OPEN),
    "an address typed in": ("pg.evaluate(\"location.hash='#/pres/talk'\")",
                            EDITING + "&&location.hash.indexOf('talk')>=0"),
    "a question in the editor's dialog": (
        "pg.evaluate(\"window.SemApp.openPath('/no/such/file.junoview')\")",
        "!document.getElementById('ask-dlg').hidden"),
}


@pytest.mark.parametrize("way", list(WAYS_IN))
def test_every_way_in_works_on_its_first_click(app, way):
    act, shows = WAYS_IN[way]
    p = Page(app, hold=True).open(app["url"])
    pg = p.pg
    try:
        assert not pg.evaluate(EDITOR_UP)
        exec(act, {"pg": pg})
        # it is waiting for the editor, which is held back: nothing yet
        pg.wait_for_timeout(300)
        assert not pg.evaluate(EDITOR_UP)
        assert not pg.evaluate(shows), f"{way} answered without the editor"
        p.release()
        pg.wait_for_function(shows, timeout=20000)
        assert p.errs == []
    finally:
        p.close()


def test_the_side_list_doors_work_on_their_first_click(app):
    p = Page(app, hold=True, side=True).open(app["url"])
    pg = p.pg
    try:
        assert not pg.evaluate(EDITOR_UP)
        pg.click("#pr-library")
        pg.wait_for_timeout(300)
        assert not pg.evaluate(HUB_OPEN)
        p.release()
        pg.wait_for_function(HUB_OPEN, timeout=20000)
        pg.keyboard.press("Escape")
        pg.wait_for_function("!(" + HUB_OPEN + ")")
        pg.click("#pr-newbtn")
        pg.click("#pr-newmenu [data-for=pr-new]")
        pg.wait_for_function(NEW_DIALOG, timeout=20000)
        assert p.errs == []
    finally:
        p.close()


def test_a_click_elsewhere_drops_the_held_one(app):
    p = Page(app, hold=True).open(app["url"])
    pg = p.pg
    try:
        pg.click("#app-file")
        pg.mouse.click(700, 420)          # changed their mind
        p.release()
        pg.wait_for_function(EDITOR_UP, timeout=20000)
        pg.wait_for_timeout(400)
        assert pg.evaluate("document.getElementById('app-file-menu').hidden")
        assert p.errs == []
    finally:
        p.close()


def test_a_deck_address_at_load_opens_the_deck(app):
    p = Page(app).open(app["url"], "#/pres/talk/s2")
    pg = p.pg
    try:
        pg.wait_for_function(EDITING, timeout=20000)
        assert pg.evaluate("window.SemApp.deckState()") == \
            {"name": "talk", "slide": 1}
        assert pg.evaluate("location.hash") == "#/pres/talk/s2"
        assert p.errs == []
    finally:
        p.close()


def test_a_deck_address_at_load_runs_the_editor_as_the_page_is_parsed(app):
    """...where and when the page always ran it: written in by the gate
    right after its reference, so the parser runs it before the page's
    DOMContentLoaded and the deck is open by then -- not queued behind
    MathJax and the first layouts, which showed a #/pres address's deck
    1.2 s later at 4x CPU."""
    p = Page(app)
    p.ctx.add_init_script(
        "document.addEventListener('DOMContentLoaded',()=>{"
        "window.__atDcl=[!!window.SemDeckImport,"
        "document.body.classList.contains('slide-editing')];},{once:true});")
    pg = p.open(app["url"], "#/pres/talk").pg
    try:
        pg.wait_for_function(EDITING, timeout=20000)
        assert pg.evaluate("window.__atDcl") == [True, True]
        order = pg.evaluate(
            "[...document.querySelectorAll('script[src]')].map(s=>s.src)"
            ".filter(u=>u.includes('/static/')).map(u=>u.split('/static/')[1]"
            ".split('.')[0])")
        assert order == ["icons", "app", "pptx", "deck"]
        assert pg.evaluate("document.getElementById('jv-deck-src')") is None
        assert len([r for r in p.reqs if "/static/deck." in r[1]
                    and r[1].endswith(".js")]) == 1
        assert p.errs == []
    finally:
        p.close()


def test_a_reload_with_a_deck_open_boots_the_editor_with_the_page(app):
    p = Page(app).open(app["url"])
    pg = p.pg
    try:
        pg.evaluate("location.hash='#/pres/talk'")
        pg.wait_for_function(EDITING, timeout=20000)
        pg.evaluate("window.SemApp.deckClose()")
        pg.wait_for_function("!" + EDITING)
        # the deck's tab stays open; a reload shows it at once
        pg.reload(wait_until="domcontentloaded")
        pg.wait_for_selector(".nbshell .card")
        t0 = time.time()
        pg.wait_for_function(
            "!!document.querySelector('.top-pres-tab')", timeout=10000)
        # not the idle load, which waits for 1.5 s of quiet after load
        assert time.time() - t0 < 5
        assert p.errs == []
    finally:
        p.close()


def test_every_control_the_editor_wires_outside_its_markup_is_a_door(app):
    """Read every listener on every element outside the notebook's
    content and outside the doors, through the DevTools protocol: none may
    be the editor's. The File menu's own rows are the one exception: the
    editor's listener on them only closes the menu, and the menu cannot be
    open before the editor is (File itself is a door)."""
    p = Page(app).open(app["url"])
    pg = p.pg
    try:
        pg.evaluate("window.SemApp.deckLoad()")
        cdp = p.ctx.new_cdp_session(pg)
        scripts: dict = {}
        cdp.on("Debugger.scriptParsed",
               lambda e: scripts.__setitem__(e["scriptId"], e["url"]))
        cdp.send("Debugger.enable")
        pg.wait_for_timeout(300)
        n = pg.evaluate("""(()=>{const D=window.SemApp.deckDoors;
          const menuOwn='#tab-open,#scheme-btn,#help-btn,#support-btn';
          window.__jvChk=[...document.querySelectorAll('body *')].filter(e=>
            !e.closest(D)&&!e.closest('.nbshell .content,svg')
            &&!e.matches(menuOwn));
          return window.__jvChk.length})()""")
        assert n > 300
        wired = []
        for i in range(n):
            ob = cdp.send("Runtime.evaluate",
                          {"expression": f"window.__jvChk[{i}]"})["result"]
            ls = cdp.send("DOMDebugger.getEventListeners",
                          {"objectId": ob["objectId"]})["listeners"]
            deck = [lst["type"] for lst in ls
                    if "/static/deck." in scripts.get(lst.get("scriptId"), "")
                    and scripts[lst["scriptId"]].endswith(".js")]
            if deck:
                wired.append((pg.evaluate(
                    f"(e=>e.tagName+'#'+e.id+'.'+e.className)"
                    f"(window.__jvChk[{i}])"), deck))
        assert wired == [], wired
    finally:
        p.close()


def test_the_lean_boot_and_the_autosave_after_a_late_boot(app):
    p = Page(app).open(app["url"])
    pg = p.pg
    try:
        assert not pg.evaluate(EDITOR_UP)
        before = json.loads((app["root"] / _PROJECT_FILE).read_text())
        pg.evaluate("location.hash='#/pres/talk'")
        pg.wait_for_function(EDITING, timeout=20000)
        # the figure copies come from /api/emb, as with a booted page
        pg.wait_for_function(
            "window.SemDeckEmbState&&window.SemDeckEmbState().loaded",
            timeout=20000)
        assert any("/api/emb" in u for _m, u in p.reqs)
        # an edit, then the autosave writes it to the project
        box = pg.locator("#deck .annot-layer .an-text").first.bounding_box()
        pg.mouse.move(box["x"] + 20, box["y"] + 6)
        pg.mouse.down()
        pg.mouse.move(box["x"] + 60, box["y"] + 26, steps=4)
        pg.mouse.up()
        deadline = time.time() + 40
        while time.time() < deadline:
            if any(m == "POST" and "/api/save" in u for m, u in p.reqs):
                break
            pg.wait_for_timeout(500)
        assert any(m == "POST" and "/api/save" in u for m, u in p.reqs)
        pg.wait_for_timeout(500)
        after = json.loads((app["root"] / _PROJECT_FILE).read_text())
        assert after["presentations"][0]["slides"] != \
            before["presentations"][0]["slides"]
        assert p.errs == []
    finally:
        p.close()


def test_a_pointer_only_passing_over_a_door_leaves_the_editor_be(app):
    """...one that comes to rest there loads it (2026-10-10 review)."""
    p = Page(app).open(app["url"])
    pg = p.pg
    try:
        deck = ("[...performance.getEntriesByType('resource')].some(r=>"
                "/\\/static\\/deck\\.[0-9a-f]+\\.js$/.test(r.name))"
                "||!!document.querySelector('script[src*=\"/static/deck.\"]')")
        b = pg.locator(".nbshell:not([hidden]) .cell-collect").first
        b.scroll_into_view_if_needed()
        box = b.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        # a key keeps the idle load off for its quiet spell meanwhile
        pg.keyboard.press("Shift")
        pg.mouse.move(x - 300, y + 80)
        pg.mouse.move(x, y)
        pg.mouse.move(x - 300, y + 120)
        pg.wait_for_timeout(400)
        assert not pg.evaluate(deck)
        pg.mouse.move(x, y)
        pg.wait_for_function(EDITOR_UP, timeout=20000)
        assert p.errs == []
    finally:
        p.close()
