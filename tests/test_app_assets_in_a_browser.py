"""The app page with its CSS/JS as files, its raw view as a template and
its conditional Reload, driven in a real Chromium.

Opt-in like the theme matrix: set ``JUNOVIEW_BROWSER_TESTS=1``. Needs the
``playwright`` package and its Chromium; skips cleanly without them.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import pytest

from junoview.render.static import static_files

pytestmark = pytest.mark.skipif(
    os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1",
    reason="set JUNOVIEW_BROWSER_TESTS=1 for real-browser checks")


def _nb(text: str) -> dict:
    return {"cells": [
        {"cell_type": "markdown", "metadata": {},
         "source": f"# {text}\n\nInline $x^2$ maths."},
        {"cell_type": "code", "metadata": {}, "execution_count": 1,
         "source": "x = 1\nx", "outputs": [
             {"output_type": "execute_result", "execution_count": 1,
              "metadata": {}, "data": {"text/plain": "1"}}]},
        # a hidden cell: its output lives ONLY in the raw view, in full
        {"cell_type": "code", "metadata": {}, "execution_count": 2,
         "source": "#| display: hidden\nshow()", "outputs": [
             {"output_type": "display_data", "metadata": {}, "data": {
                 "text/plain": "x",
                 "text/html": '<div id="rawonly">no</div><script>'
                              'document.getElementById("rawonly")'
                              '.textContent="RAN"</script>'}}]}],
        "metadata": {}, "nbformat": 4, "nbformat_minor": 5}


@pytest.fixture
def app(tmp_path):
    sync = pytest.importorskip("playwright.sync_api")
    from junoview.server.app import _Server
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    f = tmp_path / "paper.ipynb"
    f.write_text(json.dumps(_nb("First")), encoding="utf-8")
    state = _AppState(tmp_path)
    state.note_open(f)
    httpd = _Server(("127.0.0.1", 0), _make_handler(state))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/?t={state.token}"
    with sync.sync_playwright() as pw:
        try:
            browser = pw.chromium.launch()
        except Exception as e:      # noqa: BLE001 -- no browser here
            pytest.skip(f"Chromium unavailable: {e}")
        ctx = browser.new_context(viewport={"width": 1366, "height": 657},
                                  accept_downloads=True)
        ctx.add_init_script(
            "try{localStorage.setItem('plotline-tour','1');"
            "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
        ctx.route("https://cdn.jsdelivr.net/**", lambda r: r.abort())
        page = ctx.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url, wait_until="load")
        page.wait_for_function("()=>window.SemApp&&window.SemDeckImport")
        yield page, f, errors
        browser.close()
    httpd.shutdown()
    httpd.server_close()


def test_the_page_runs_and_is_styled_from_its_files(app):
    page, _f, errors = app
    got = page.evaluate("""(()=>({
      links:[...document.querySelectorAll('link[rel=stylesheet],script[src]')]
        .map(e=>e.href||e.src).filter(u=>u.includes('/static/'))
        .map(u=>u.split('/static/')[1]),
      sheets:[...document.styleSheets].filter(s=>s.href).length,
      icons:Object.keys(window.SemIcons||{}).length,
      bg:getComputedStyle(document.body).backgroundColor,
      cards:document.querySelectorAll('.nbshell .card').length}))()""")
    assert got["links"] == [f.name for f in static_files()]
    assert got["sheets"] == 3 and got["icons"] > 100
    assert got["bg"] not in ("rgba(0, 0, 0, 0)", "rgb(255, 255, 255)")
    assert got["cards"] >= 2
    assert errors == []


def test_the_raw_view_is_built_the_first_time_it_is_shown(app):
    page, _f, errors = app
    before = page.evaluate(
        "document.querySelectorAll('.rawview .rawcell').length")
    assert before == 0
    page.evaluate("document.querySelector('#view-raw').click()")
    page.wait_for_function(
        "document.querySelectorAll('.nbshell.raw .rawview .rawcell')"
        ".length===3")
    assert page.evaluate(
        "document.querySelectorAll('.rawview template').length") == 0
    assert "x = 1" in page.evaluate(
        "document.querySelector('.rawview').innerText")
    # a hidden cell's own output script runs once its view exists, as it
    # did at load when the raw view was always live DOM
    page.wait_for_function(
        "(document.getElementById('rawonly')||{}).textContent==='RAN'")
    assert errors == []


def test_reload_keeps_an_unchanged_tab_and_remounts_a_changed_one(app):
    page, f, errors = app
    page.evaluate("window.__old=document.querySelector('.nbshell')")
    r = page.evaluate("SemApp.reloadTab(SemApp.active)")
    assert r["ok"] and r["reason"] == "reread" and r["unchanged"]
    assert page.evaluate("document.querySelector('.nbshell')===window.__old")
    f.write_text(json.dumps(_nb("Second")), encoding="utf-8")
    r = page.evaluate("SemApp.reloadTab(SemApp.active)")
    assert r["ok"] and not r["unchanged"]
    assert page.evaluate(
        "document.querySelector('.nbshell')!==window.__old")
    assert "Second" in page.evaluate(
        "document.querySelector('.nbshell .content').innerText")
    assert errors == []


def test_the_standalone_export_carries_the_linked_css(app):
    page, _f, errors = app
    stem = page.evaluate("SemApp.active")
    deck = {"name": "css", "slides": [{"layout": "blank", "annots": [
        {"k": "text", "x": 5, "y": 5, "w": 80, "text": "Hi", "size": 4}]}]}
    page.evaluate("t=>window.SemDeckImport(t,false)", json.dumps(deck))
    page.wait_for_timeout(800)
    page.evaluate("[...document.querySelectorAll('button')].filter(b=>"
                  "/^Keep it in this browser/.test(b.textContent.trim())"
                  "&&b.offsetParent).map(b=>b.click())")
    page.wait_for_function(
        "document.body.classList.contains('slide-editing')")
    with page.expect_download(timeout=60000) as dl:
        page.evaluate("document.querySelector('#mi-html').click()")
    html = Path(dl.value.path()).read_text(encoding="utf-8")
    css = html.split("<style>", 1)[1].split("</style>", 1)[0]
    for f in static_files():
        if f.name.endswith(".css"):
            assert f.text in css, f.name
    assert stem and errors == []
