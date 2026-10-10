"""The web build, served and driven in a real Chromium (2026-10-09 speed
pass, load-static #2, #10, #11).

tests/test_web_build_loads_first.py runs the runtime, the service worker
and the example's open path against stand-ins; this serves a real build
and checks what a first visit does: the welcome screen is what arrives,
nothing asks for Python, a demo clip or the service worker before the
page has loaded, the worker's install holds the app and nothing more,
and "Try the example" opens with Python unavailable altogether. The
CDNs are blocked, so it needs no network. Opt-in like the theme matrix:
set ``JUNOVIEW_BROWSER_TESTS=1``; needs the ``playwright`` package and
its Chromium, and skips cleanly without them.
"""

from __future__ import annotations

import functools
import http.server
import os
import threading
import time
from pathlib import Path

import pytest

from junoview import web
from junoview.web import build_web

pytestmark = pytest.mark.skipif(
    os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1",
    reason="set JUNOVIEW_BROWSER_TESTS=1 for real-browser checks")

ROOT = Path(__file__).resolve().parents[1]


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):   # noqa: D401 -- keep pytest output clean
        pass


@pytest.fixture
def site(tmp_path, monkeypatch):
    gifs = tmp_path / "clips"
    gifs.mkdir()
    (gifs / "code_folding.gif").write_bytes(
        (ROOT / "docs" / "gifs" / "code_folding.gif").read_bytes()
        if (ROOT / "docs" / "gifs" / "code_folding.gif").is_file()
        else b"GIF89a")
    monkeypatch.setattr(web, "find_gifs", lambda: gifs)
    out = tmp_path / "site"
    build_web(out, example=ROOT / "examples" / "example_climate_analysis.ipynb")
    handler = functools.partial(_Quiet, directory=str(out))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}/"
    server.shutdown()


@pytest.fixture
def chromium():
    sync = pytest.importorskip("playwright.sync_api")
    with sync.sync_playwright() as pw:
        browser = None
        for kw in ({"channel": "chromium"}, {}):
            try:
                browser = pw.chromium.launch(**kw)
                break
            except Exception:       # noqa: BLE001 -- try the next one
                continue
        if browser is None:
            pytest.skip("Chromium unavailable")
        yield browser
        browser.close()


def test_a_first_visit_shows_the_welcome_and_fetches_nothing_unasked(
        site, chromium):
    ctx = chromium.new_context(viewport={"width": 1366, "height": 657})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
    # no network beyond the site: the CDNs answer nothing, and Python's
    # worker script is refused -- the example must open without it
    ctx.route("https://cdn.jsdelivr.net/**", lambda r: r.abort())
    ctx.route("https://cdn.plot.ly/**", lambda r: r.abort())
    worker_asked: list[float] = []

    def no_python(route):
        worker_asked.append(time.monotonic())
        route.abort()
    ctx.route("**/web-worker.js", no_python)
    page = ctx.new_page()
    seen: list[tuple[float, str]] = []
    page.on("request", lambda r: seen.append((time.monotonic(), r.url)))
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(site, wait_until="load")
    loaded = time.monotonic()
    # the screen that arrives IS the welcome: no ribbon swapped out for it
    first = page.evaluate("""(()=>({
        body:document.body.className,
        welcome:!document.getElementById('welcome').hidden,
        demo:!document.getElementById('welcome-demo-wrap').hidden,
        apptop:getComputedStyle(document.getElementById('apptop')).display,
        reel:!document.getElementById('wtour').hidden}))()""")
    assert "welcoming" in first["body"] and "files-top" in first["body"]
    assert first["welcome"] and first["demo"]
    assert first["apptop"] == "none"
    assert first["reel"]            # the build said the clips are there
    # Python and the service worker wait for the page to have loaded
    page.wait_for_function("!!navigator.serviceWorker.controller||"
                           "navigator.serviceWorker.ready.then(()=>true)",
                           timeout=30000)
    page.wait_for_timeout(500)
    before_load = [u for t, u in seen if t < loaded]
    assert not [u for u in before_load
                if u.endswith(("web-worker.js", "sw.js"))], before_load
    assert worker_asked and min(worker_asked) >= loaded
    # nobody downloaded a clip to find out whether there are any
    assert not [u for _, u in seen if "/gifs/" in u]
    # the install holds the app: './' once, and no runtime or example
    cached = page.evaluate("""caches.keys().then(ks=>Promise.all(ks.map(k=>
        caches.open(k).then(c=>c.keys()).then(rs=>rs.map(r=>r.url))))
        ).then(a=>[].concat(...a))""")
    assert site in cached
    assert not [u for u in cached if u.endswith("/index.html")
                or u.startswith("https://") or ".shell." in u
                or u.endswith(".ipynb") or u.endswith("junoview.zip")]
    # "Try the example": the build's rendering, mounted, with no Python
    page.click("#welcome-demo")
    page.wait_for_selector(".nbshell .card", state="attached",
                           timeout=60000)
    opened = page.evaluate("""(()=>({
        stem:SemApp.active,path:SemApp.shells[SemApp.active].path,
        cards:document.querySelectorAll('.nbshell .card').length,
        welcoming:document.body.classList.contains('welcoming')}))()""")
    assert opened["stem"] == "example_climate_analysis"
    assert opened["path"] == "example_climate_analysis.ipynb"
    assert opened["cards"] > 10 and not opened["welcoming"]
    assert not [u for _, u in seen if u.endswith(".ipynb")]
    assert not errors, errors
    ctx.close()
