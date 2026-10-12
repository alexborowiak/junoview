"""Six reader and app bugs, driven end to end in Chromium against the real
app server (2026-10-11). Each failed on 27be2a9; the pure halves are in
test_reader_and_app_keep_what_you_did.py.

Opt-in like the theme matrix (it needs Playwright's Chromium): set
``JUNOVIEW_BROWSER_TESTS=1``.

1. Save as view makes the view, and nothing throws.
2. Pages on a notebook of one section, and Variables on one whose code
   binds no names, say why they do nothing -- in the reader's toast.
3. A Find match lands wholly on screen below the fixed chrome, at both
   laptop sizes.
4. Reload with Find open stays on the match you were on, on screen.
5. An edit made just before a reload or a tab close is there afterwards:
   a slide added, words typed in a box, a collection reordered.
6. Closing the last notebook with a collection's or a presentation's
   tab open shows that tab, not Home; with nothing open, Home, at
   Home's address.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.notebook.presentations import as_presentations
from junoview.server.routes import _make_handler
from junoview.server.state import _PROJECT_FILE, _AppState

ROOT = Path(__file__).resolve().parent.parent
NB = ROOT / "examples" / "example_climate_analysis.ipynb"
NB2 = ROOT / "examples" / "example_widget.ipynb"
SIZES = [(1366, 657), (1280, 600)]


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


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


def _serve(root: Path):
    st = _AppState(root)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"


def _project(root: Path, files: list[Path], pres=()) -> None:
    (root / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": as_presentations(list(pres)),
         "open": [str(f) for f in files], "recent": [str(f) for f in files]},
        indent=1) + "\n", encoding="utf-8")


def _md(i, s):
    return {"cell_type": "markdown", "id": f"m{i}", "metadata": {},
            "source": s}


@pytest.fixture
def served(browser, tmp_path):
    """serve(files, pres) -> url, on a fresh project of its own"""
    held = []

    def serve(files, pres=()):
        _project(tmp_path, files, pres)
        srv, url = _serve(tmp_path)
        held.append(srv)
        return url
    try:
        yield {"b": browser, "root": tmp_path, "serve": serve}
    finally:
        for srv in held:
            srv.shutdown()
            srv.server_close()


def _example(fx, pres=()):
    nb = fx["root"] / NB.name
    nb.write_bytes(NB.read_bytes())
    return fx["serve"]([nb], pres), nb


def _nb(fx, name, cells):
    f = fx["root"] / f"{name}.ipynb"
    f.write_text(json.dumps({"cells": cells}), encoding="utf-8")
    return fx["serve"]([f]), f


def _ctx(fx, w=1366, h=657):
    ctx = fx["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
    ctx.route("https://cdn.jsdelivr.net/**",
              lambda r: r.fulfill(status=404, body=b""))
    ctx.route("https://cdn.plot.ly/**",
              lambda r: r.fulfill(status=404, body=b""))
    return ctx


def _open(ctx, url, errors):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    # a "leave site?" over an edit not yet in the project: leave
    pg.on("dialog", lambda d: d.accept())
    pg.goto(url, wait_until="load")
    pg.wait_for_selector(".nbshell .card", state="attached")
    pg.wait_for_timeout(600)
    return pg


TOAST = ("(()=>{const t=document.getElementById('doc-toast');"
         "return t&&!t.hidden?t.textContent:null})()")


# ------------------------------------------------------ 1. Save as view


def test_save_as_view_makes_the_view_and_nothing_throws(served):
    url, _ = _example(served)
    ctx = _ctx(served)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    pg.click("#ab-newview")          # a door: the editor loads for it
    pg.wait_for_function("document.body.classList.contains('styling')",
                         timeout=15000)
    # its first change -- the layout save it schedules -- is made
    pg.wait_for_timeout(2000)
    assert pg.evaluate("SemApp.stylingView().name") == "custom view"
    # ...and a change of yours reaches it without a throw either
    pg.evaluate("document.querySelector('#tv-plots').click()")
    pg.wait_for_timeout(2000)
    assert pg.evaluate("SemApp.stylingView().view.def.plot") != "visible"
    ctx.close()
    assert not errors, errors


# ------------------------------------------- 2. the reader's own toast


def test_pages_and_variables_say_why_they_do_nothing(served):
    url, _ = _nb(served, "report", [
        _md(0, "# Report"), _md(1, "An opening note."),
        {"cell_type": "code", "id": "c0", "metadata": {},
         "source": "#| id: load\nload()", "outputs": []}])
    ctx = _ctx(served)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    pg.click("#ab-tab-view")
    pg.wait_for_timeout(300)
    pg.click("#sec-pages")
    pg.wait_for_timeout(300)
    assert "one section" in (pg.evaluate(TOAST) or "")
    pg.click("#vars-btn")
    pg.wait_for_timeout(300)
    assert "variable" in (pg.evaluate(TOAST) or "")
    assert pg.evaluate("document.getElementById('varspane').hidden")
    ctx.close()
    assert not errors, errors


# ------------------------------------------- 3. where a Find match lands


# the current match: wholly on screen, below the header and the Find bar
LANDED = r"""
()=>{const m=document.querySelector('mark.jv-doc.on');if(!m) return null;
 const r=m.getBoundingClientRect(),hd=document.getElementById('apptop'),
   fb=document.getElementById('docfind');
 const top=Math.max(hd?hd.getBoundingClientRect().bottom:0,
   fb&&!fb.hidden?fb.getBoundingClientRect().bottom:0);
 const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return {top:Math.round(r.top),band:Math.round(top),
   ok:r.top>=top&&r.bottom<=innerHeight,seen:!!(e&&(e===m||m.contains(e))),
   n:(document.getElementById('docfind-n')||{}).textContent};}
"""


def _settled(pg, ms=2600):
    """a glide and any second look at where it landed are over"""
    pg.wait_for_timeout(ms)


def _find(pg, term):
    pg.keyboard.press("Control+f")
    pg.keyboard.type(term)
    pg.wait_for_function("/\\//.test((document.getElementById('docfind-n')"
                         "||{}).textContent||'')", timeout=10000)


@pytest.mark.parametrize("w,h", SIZES)
def test_a_find_match_lands_on_screen_below_the_chrome(served, w, h):
    """a page of short notes, laid out lazily: at 1280x600 the first
    match landed at y 95, under the ribbon, every time"""
    cells = [_md(0, "# Report")]
    cells += [_md(k, f"Filler note {k}. " * 40) for k in range(1, 9)]
    cells += [_md(30, "## Method"),
              _md(31, "\n\n".join(f"Paragraph {k} about the method."
                                  for k in range(40)))]
    cells += [_md(40 + k, f"After note {k}. " * 30) for k in range(6)]
    url, _ = _nb(served, "longread", cells)
    ctx = _ctx(served, w, h)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    _find(pg, "after note 1.")
    _settled(pg)
    st = pg.evaluate(LANDED)
    assert st and st["ok"] and st["seen"], st
    # ...and the next match in another note, far down
    pg.fill("#docfind-in", "after note 5.")
    _settled(pg)
    st = pg.evaluate(LANDED)
    assert st and st["ok"] and st["seen"], st
    ctx.close()
    assert not errors, errors


# ------------------------------------------- 4. Find across a Reload


@pytest.mark.parametrize("w,h,edit", [(1366, 657, True), (1280, 600, True),
                                      (1280, 600, False)])
def test_reload_with_find_open_stays_on_its_match_on_screen(served, w, h,
                                                            edit):
    """changed on disk the notebook is mounted again; unchanged it is
    shown again -- either way Find ran again from the first match"""
    url, nb = _example(served)
    ctx = _ctx(served, w, h)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    _find(pg, "blocking")
    _settled(pg, 1500)
    for _ in range(3):
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(200)
    _settled(pg)
    before = pg.evaluate(LANDED)
    assert before["ok"] and before["n"].startswith("4 / "), before
    if edit:    # the notebook changes on disk
        d = json.loads(nb.read_text(encoding="utf-8"))
        md = next(c for c in d["cells"] if c["cell_type"] == "markdown")
        src = md["source"]
        md["source"] = ((src if isinstance(src, str) else "".join(src))
                        + " (ed)")
        nb.write_text(json.dumps(d), encoding="utf-8")
    pg.evaluate("document.querySelector('.nbshell:not([hidden])').__old=1")
    pg.evaluate("document.querySelector('#file-dock .rf-reload').click()")
    if edit:
        pg.wait_for_function("(()=>{const s=document.querySelector("
                             "'.nbshell:not([hidden])');return !!(s&&"
                             "!s.__old&&s.querySelector('mark.jv-doc.on'))"
                             "})()", timeout=20000)
    _settled(pg)
    # the same shell, or a new one, as the disk says
    assert pg.evaluate("!!document.querySelector('.nbshell:not([hidden])')"
                       ".__old") is (not edit)
    after = pg.evaluate(LANDED)
    assert after["n"] == before["n"], (before, after)
    assert after["ok"] and after["seen"], after
    ctx.close()
    assert not errors, errors


# --------------------------------- 5. what you did just before you left


def _talk_and_c1():
    talk = {"name": "talk", "slides": [
        {"layout": "blank", "sid": f"s{i}", "annots": [
            {"k": "text", "x": 6, "y": 5, "w": 80, "text": f"slide {i + 1}"}]}
        for i in range(3)]}
    c1 = {"name": "c1", "kind": "collection", "items": [
        {"id": f"n{i}", "k": "note", "md": f"# Note {i}\n" + "words " * 10}
        for i in range(4)]}
    return [talk, c1]


def _editor(pg):
    pg.evaluate("SemApp.deckLoad()")
    pg.wait_for_function("!!window.SemCollect", timeout=15000)


def _leave(ctx, pg, how, url, errors):
    """reload, or close the tab and open the app again in a new one"""
    if how == "reload":
        pg.reload(wait_until="load")
        p2 = pg
    else:
        p2 = ctx.new_page()
        p2.on("pageerror", lambda e: errors.append(str(e)))
        p2.goto("about:blank")
        pg.close(run_before_unload=False)
        p2.goto(url, wait_until="load")
    p2.wait_for_selector(".nbshell .card", state="attached")
    p2.wait_for_timeout(1500)
    _editor(p2)
    return p2


@pytest.mark.parametrize("how", ["reload", "close"])
def test_a_slide_added_just_before_leaving_is_there_after(served, how):
    url, _ = _example(served, _talk_and_c1())
    ctx = _ctx(served)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    _editor(pg)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(1000)
    rows = "document.querySelectorAll('#film-list .film-row').length"
    assert pg.evaluate(rows) == 3
    pg.evaluate("document.getElementById('film-add').click()")
    assert pg.evaluate(rows) == 4
    # at once: inside the draft write's own wait
    pg = _leave(ctx, pg, how, url, errors)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(1000)
    assert pg.evaluate(rows) == 4
    ctx.close()
    assert not errors, errors


def test_words_typed_just_before_a_reload_are_there_after(served):
    url, _ = _example(served, _talk_and_c1())
    ctx = _ctx(served)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    _editor(pg)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(1000)
    box = pg.query_selector("#deck .annot-layer .an-text").bounding_box()
    pg.mouse.dblclick(box["x"] + 10, box["y"] + box["height"] / 2)
    pg.wait_for_timeout(300)
    pg.keyboard.press("End")
    pg.keyboard.type(" zebrafinch")
    # not blurred, not committed: the page goes with the words in the box
    pg = _leave(ctx, pg, "reload", url, errors)
    pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(1000)
    assert "zebrafinch" in pg.evaluate(
        "document.querySelector('#deck .annot-layer').textContent")
    ctx.close()
    assert not errors, errors


ORDER = ("[...document.querySelectorAll('.coltab:not([hidden]) .col-group')]"
         ".map(g=>g.dataset.col)")


@pytest.mark.parametrize("wait", [0, 1500])
def test_a_collection_reordered_before_a_reload_comes_back_so(served, wait):
    """at once: the draft write had not reached IndexedDB; a moment later
    it had, but boot drew the collection from the project's older copy
    before IndexedDB answered, and never again"""
    url, _ = _example(served, _talk_and_c1())
    ctx = _ctx(served)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    _editor(pg)
    pg.evaluate("SemCollect.open('c1')")
    pg.wait_for_timeout(800)
    assert pg.evaluate(ORDER) == ["n0", "n1", "n2", "n3"]
    pg.evaluate("(()=>{const g=document.querySelector('.coltab:not([hidden])"
                " .col-group');[...g.querySelectorAll('.col-bar .col-btn')]"
                ".find(b=>/^(Down|Later)$/.test(b.textContent.trim()))"
                ".click()})()")
    edited = pg.evaluate(ORDER)
    assert edited == ["n1", "n0", "n2", "n3"]
    pg.wait_for_timeout(wait)
    pg = _leave(ctx, pg, "reload", url, errors)
    pg.wait_for_function("!!document.querySelector('.coltab:not([hidden])"
                         " .col-group')", timeout=10000)
    pg.wait_for_timeout(1000)
    assert pg.evaluate(ORDER) == edited
    ctx.close()
    assert not errors, errors


# ------------------------------------- 6. closing a tab is not going Home


def _close_the_notebook(pg):
    stem = NB.stem
    tab = ("[...document.querySelectorAll('#top-tabstrip .tab:not("
           ".top-pres-tab)')].find(t=>t.textContent.includes('"
           + stem + "'))")
    pg.evaluate(f"{tab}.click()")
    pg.wait_for_timeout(500)
    assert pg.evaluate("SemApp.active") == stem
    pg.evaluate(f"{tab}.querySelector('.tab-b').click()")
    pg.wait_for_timeout(1000)


SHOWN = ("[SemApp.active,location.hash,"
         "document.body.classList.contains('welcoming'),"
         "document.body.classList.contains('slide-editing'),"
         "!!document.querySelector('.coltab:not([hidden]) .col-group')]")


@pytest.mark.parametrize("left", ["collection", "presentation", "nothing"])
def test_closing_the_last_notebook_goes_to_the_tab_left(served, left):
    url, _ = _example(served, _talk_and_c1())
    ctx = _ctx(served)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    _editor(pg)
    if left == "collection":
        pg.evaluate("SemCollect.open('c1')")
    elif left == "presentation":
        pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(1000)
    _close_the_notebook(pg)
    st = pg.evaluate(SHOWN)
    assert st == {
        "collection": ["col::c1", "#/pres/c1", False, False, True],
        "presentation": [None, "#/pres/talk/s1", False, True, False],
        "nothing": [None, "", True, False, False]}[left], st
    ctx.close()
    assert not errors, errors


@pytest.mark.parametrize("left", ["collection", "presentation"])
def test_closing_the_last_notebook_from_home_stays_home(served, left):
    """Home is not a tab: a notebook's tab closed while Home is up leaves
    Home where it is -- it took you into the collection, or opened the
    slide editor over Home (2026-10-12 review)"""
    url, _ = _example(served, _talk_and_c1())
    ctx = _ctx(served)
    errors: list[str] = []
    pg = _open(ctx, url, errors)
    _editor(pg)
    if left == "collection":
        pg.evaluate("SemCollect.open('c1')")
    else:
        pg.evaluate("SemApp.deckChoose('talk')")
    pg.wait_for_timeout(1000)
    stem = NB.stem
    tab = ("[...document.querySelectorAll('#top-tabstrip .tab:not("
           ".top-pres-tab)')].find(t=>t.textContent.includes('"
           + stem + "'))")
    pg.evaluate(f"{tab}.click()")
    pg.wait_for_timeout(500)
    pg.evaluate("SemApp.goHome(true)")
    pg.wait_for_timeout(500)
    assert pg.evaluate("document.body.classList.contains('welcoming')")
    pg.evaluate(f"{tab}.querySelector('.tab-b').click()")
    pg.wait_for_timeout(1000)
    st = pg.evaluate(SHOWN)
    assert st == [None, "#/home", True, False, False], st
    ctx.close()
    assert not errors, errors
