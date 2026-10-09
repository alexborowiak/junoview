"""The app and the web build load their CSS/JS as content-hashed FILES.

Inline, about 4.5 MB of identical stylesheet and script rode inside every
page the local app served (and the web build's index.html), so the browser
could never cache it: no V8 code cache, no off-thread streaming, and every
launch re-tokenised and recompiled all of it (2026-10-08 speed
investigation: a warm relaunch about a second slower than it needed to be
at 4x CPU throttle). render/static.py names each asset for its content and
the page references it in the SAME place; the single-file export still
inlines everything, byte for byte as before.
"""

from __future__ import annotations

import hashlib
import json
import re
import string
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets
from junoview.branding import icons, icons_js
from junoview.render import static
from junoview.render.page import render_page
from junoview.render.static import static_file, static_files

NAME = re.compile(r"(core|app|deck|icons|pptx)\.([0-9a-f]{16})\.(css|js)")


def test_every_asset_is_named_for_its_exact_bytes():
    files = static_files()
    assert [f.field for f in files] == [
        "css", "app_css", "deck_css", "icons_js", "js", "pptx_js",
        "deck_js"]
    texts = [assets.core_css(), assets.app_css(), assets.deck_css(),
             icons_js(), assets.app_js(), assets.pptx_js(), assets.deck_js()]
    for f, text in zip(files, texts, strict=True):
        m = NAME.fullmatch(f.name)
        assert m, f.name
        assert f.text == text and f.data == text.encode("utf-8")
        assert m.group(2) == hashlib.sha256(f.data).hexdigest()[:16]
        assert f.content_type.startswith(
            "text/css" if f.name.endswith(".css") else "text/javascript")
    # one object per unchanged asset: the hash is not recomputed per page
    assert static_files() is files


def test_an_edited_asset_is_a_new_name_and_the_old_name_is_gone(monkeypatch):
    before = {f.field: f.name for f in static_files()}
    edited = tuple(
        (field, stem, ext,
         (lambda: assets.app_css() + "\n/* edited */") if field == "app_css"
         else load)
        for field, stem, ext, load in static._FILES)
    monkeypatch.setattr(static, "_FILES", edited)
    after = {f.field: f.name for f in static_files()}
    assert after["app_css"] != before["app_css"]
    assert {k: v for k, v in after.items() if k != "app_css"} == \
        {k: v for k, v in before.items() if k != "app_css"}
    # the server answers only for what the page references NOW
    assert static_file(after["app_css"]) is not None
    assert static_file(before["app_css"]) is None
    assert static_file("../state.py") is None


def test_the_linked_page_is_the_inline_page_with_each_asset_moved_out():
    """Same places, same order: put each file's text back where its link
    is and the page is the inline one, character for character -- so the
    parse and execution order cannot have changed."""
    inline = render_page([], mode="app")
    linked = render_page([], mode="app", asset_base="/static/")
    assert len(linked) < len(inline) // 3
    rebuilt = linked
    for f in static_files():
        link = f.link("/static/")
        assert linked.count(link) == 1, link
        tag = "style" if f.name.endswith(".css") else "script"
        rebuilt = rebuilt.replace(link, f"<{tag}>{f.text}</{tag}>")
    assert rebuilt == inline
    # the web build's links are relative: the files sit beside index.html
    web = render_page([], mode="web", asset_base="")
    for f in static_files():
        assert f.link("") in web
    assert "/static/" not in web


def test_no_stylesheet_or_script_carries_an_icon_token():
    """The page used to run icons() over itself whole, assets included; it
    now expands the templates once and leaves the assets alone. That is
    the same page only while no asset holds a token -- pinned here."""
    token = re.compile(r'<i\b[^>]*?\bdata-ic\s*=\s*"')
    for f in static_files():
        assert not token.search(f.text), f.name
    for name, text in (("saved-file.js", assets.saved_file_js()),
                       ("mathjax.html", assets.mathjax_html())):
        assert not token.search(text), name


def test_the_page_is_what_one_icons_pass_over_the_whole_page_gave(doc):
    """The old assembly, spelled out: format the template, then icons()
    over everything. The compiled template must give the same text."""
    from junoview.branding import FAVICON, KOFI_URL, LOGO_SVG
    from junoview.render.page import app_data_json, render_shell

    for mode in ("static", "app", "web"):
        page = render_page([doc], mode=mode)
        old = icons(assets.page_template().format(
            title=__import__("html").escape(doc.title),
            head_extra=('<link rel="manifest" href="manifest.webmanifest">'
                        '\n<meta name="theme-color" content="#0a141d">'
                        if mode == "web" else ""),
            shells=render_shell(doc), css=assets.core_css(),
            app_css=assets.app_css(), js=assets.app_js(),
            mathjax=assets.mathjax_html(), deck_shell=assets.deck_html(),
            app_data=app_data_json(mode, {}), icons_js=icons_js(),
            deck_css=assets.deck_css(), deck_js=assets.deck_js(),
            pptx_js=assets.pptx_js(), saved_file_js=assets.saved_file_js(),
            kofi=KOFI_URL, help_html=assets.help_html(), logo=LOGO_SVG,
            favicon=FAVICON))
        assert page == old, mode


def test_the_template_still_holds_each_asset_once():
    fields = [name for _, name, _, _
              in string.Formatter().parse(assets.page_template()) if name]
    for f in static_files():
        assert fields.count(f.field) == 1
        assert assets.page_template().count(f.tag) == 1, f.tag


@pytest.fixture
def server(tmp_path):
    from junoview.server.app import _Server
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    state = _AppState(tmp_path)
    httpd = _Server(("127.0.0.1", 0), _make_handler(state))
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}", state
    httpd.shutdown()
    httpd.server_close()


def _get(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def test_the_app_serves_each_file_forever_cacheable_and_nothing_else(server):
    base, state = server
    status, headers, page = _get(f"{base}/?t={state.token}")
    assert status == 200 and headers["Cache-Control"] == "no-store"
    text = page.decode("utf-8")
    for f in static_files():
        assert f.link("/static/") in text
        # no token: public code, the same bytes for every session
        status, headers, body = _get(f"{base}/static/{f.name}")
        assert status == 200 and body == f.data
        assert headers["Cache-Control"] == \
            "public, max-age=31536000, immutable"
        assert headers["Content-Type"] == f.content_type
    for bad in ("app.0000000000000000.js", "../state.py", "",
                "core.css"):
        assert _get(f"{base}/static/{bad}")[0] == 404
    # and everything else still wants the token
    assert _get(f"{base}/api/list")[0] == 403


def test_the_web_build_writes_the_files_and_its_worker_precaches_them(
        tmp_path):
    from junoview.web import build_web

    (tmp_path / "app.0123456789abcdef.js").write_text("stale")
    (tmp_path / "keep.me.js").write_text("not ours")
    build_web(tmp_path)
    idx = (tmp_path / "index.html").read_text(encoding="utf-8")
    sw = (tmp_path / "sw.js").read_text(encoding="utf-8")
    core = sw[sw.index("var CORE = ["):]
    core = core[:core.index("];")]
    for f in static_files():
        assert f.link("") in idx
        assert (tmp_path / f.name).read_bytes() == f.data
        assert f"'{f.name}'" in core
    assert "/*__JV_ASSETS__*/" not in sw
    # a previous build's hashed file goes; nothing else is touched
    assert not (tmp_path / "app.0123456789abcdef.js").exists()
    assert (tmp_path / "keep.me.js").read_text() == "not ours"
    # the inline copies are gone from the page itself
    assert len(idx.encode("utf-8")) < 600_000
    # a hashed name is final in the worker's cache: no refresh behind it
    assert "var HASHED_RE = /\\.[0-9a-f]{16}\\.(css|js)$/;" in sw
    assert "if(hit && (!mine || HASHED_RE.test(url.pathname)))" in sw


def test_the_unbuilt_worker_still_parses_and_lists_its_core():
    sw = assets.sw_js()
    assert "'icon.svg'/*__JV_ASSETS__*/];" in sw


_CSS_RUN = r"""
const out = [];
function $$(sel, root){ return root.els; }
__FNS__
(async () => {
  const sheet = {cssRules:[{cssText:'a{color:red}'},{cssText:'b{x:1}'}]};
  const doc = {els:[
    {tagName:'LINK', href:'http://h/static/core.css', sheet:sheet},
    {tagName:'STYLE', textContent:'.inline{}'},
    {tagName:'LINK', href:'http://h/static/gone.css', sheet:sheet}]};
  globalThis.fetch = (u) => Promise.resolve(u.endsWith('core.css')
    ? {ok:true, text:() => Promise.resolve('CORE SOURCE')}
    : {ok:false, status:404});
  out.push(await pageCssText(doc));
  out.push(pageCssTextNow(doc));
  console.log(JSON.stringify(out));
})();
"""


def test_a_copy_of_the_page_css_reads_linked_sheets_too():
    """The standalone HTML export and the presenter window copy the page's
    CSS as text. A linked sheet is fetched for its exact source (falling
    back to its parsed rules); the presenter, which cannot wait, uses the
    parsed rules. Document order is kept either way."""
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    src = assets.deck_js()
    fns = "\n".join(lift_fn(src, n) for n in
                    ("sheetRulesText", "pageCssText", "pageCssTextNow"))
    import subprocess
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_CSS_RUN.replace("__FNS__", fns), encoding="utf-8")
        cmd, env = eng
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr
    exact, now = json.loads(r.stdout.strip().splitlines()[-1])
    assert exact == ("CORE SOURCE\n.inline{}\n"
                     "a{color:red}\nb{x:1}\n\n")
    assert now == "a{color:red}\nb{x:1}\n\n.inline{}\na{color:red}\nb{x:1}\n\n"
