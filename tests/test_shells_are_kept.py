"""The app keeps each rendered notebook until something it depends on
changes, and says so when a Reload finds nothing changed.

Every page load used to re-read, re-parse and re-render every open
notebook (100-590 ms of server time before the first byte here, several
times that on the owner's laptop), and every Reload remounted and
re-typeset an identical notebook (1.2-2.5 s at 4x CPU throttle on the
116-cell one). server/shells.py keys a rendering on what it depends on;
these tests pin that a change to ANY of those is a re-render -- a cache
must never show a stale notebook -- and that nothing else is.
"""

from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets
from junoview.render import page as page_mod
from junoview.server import shells
from junoview.server.routes import _make_handler
from junoview.server.shells import _Memo, local_shell, local_source
from junoview.server.state import _app_page, _AppState


def _nb(text: str = "Hello") -> dict:
    return {"cells": [
        {"cell_type": "markdown", "metadata": {}, "source": f"# {text}"},
        {"cell_type": "code", "metadata": {}, "execution_count": 1,
         "source": "x = 1\nx", "outputs": [
             {"output_type": "execute_result", "execution_count": 1,
              "metadata": {}, "data": {"text/plain": "1"}}]}],
        "metadata": {}, "nbformat": 4, "nbformat_minor": 5}


def _write(p: Path, nb: dict) -> None:
    p.write_text(json.dumps(nb), encoding="utf-8")


@pytest.fixture(autouse=True)
def _fresh_cache():
    shells._SHELLS.clear()
    yield
    shells._SHELLS.clear()


@pytest.fixture
def renders(monkeypatch):
    """How many times a notebook was actually rendered."""
    n = [0]
    real = shells.render_shell

    def counting(*a, **kw):
        n[0] += 1
        return real(*a, **kw)
    monkeypatch.setattr(shells, "render_shell", counting)
    return n


def _shell(f: Path, stem: str = "nb", lenient: bool = True):
    return local_shell(local_source(f, stem, str(f)), lenient=lenient)


def test_an_unchanged_notebook_is_rendered_once(tmp_path, renders):
    f = tmp_path / "nb.ipynb"
    _write(f, _nb())
    a = _shell(f)
    b = _shell(f)
    assert a is b and renders[0] == 1
    assert a.ver and f'data-ver="{a.ver}"' in a.html
    assert a.title and "Hello" in a.html


def test_new_content_is_a_new_render_even_at_the_same_size_and_mtime(
        tmp_path, renders):
    """Keyed on the BYTES: a copy that keeps the old timestamp (a sync
    client, an unzip) must still be seen."""
    f = tmp_path / "nb.ipynb"
    _write(f, _nb("Hello"))
    a = _shell(f)
    st = f.stat()
    _write(f, _nb("Jello"))          # same length, different text
    os.utime(f, ns=(st.st_atime_ns, st.st_mtime_ns))
    assert f.stat().st_size == st.st_size
    b = _shell(f)
    assert renders[0] == 2 and b.ver != a.ver
    assert "Jello" in b.html and "Hello" not in b.html


def test_the_same_bytes_rewritten_are_not_rendered_again(tmp_path, renders):
    f = tmp_path / "nb.ipynb"
    _write(f, _nb())
    a = _shell(f)
    time.sleep(0.01)
    _write(f, _nb())                 # a save that changed nothing
    assert _shell(f) is a and renders[0] == 1


def test_a_deck_file_beside_the_notebook_is_part_of_the_key(
        tmp_path, renders):
    f = tmp_path / "nb.ipynb"
    _write(f, _nb())
    a = _shell(f)
    deck = {"presentations": [{"name": "Talk", "slides": [
        {"layout": "single", "panes": ["nb::x"]}]}]}
    side = tmp_path / "nb.deck.json"
    side.write_text(json.dumps(deck), encoding="utf-8")
    b = _shell(f)
    assert b.ver != a.ver and renders[0] == 2
    assert "Talk" in b.html and "Talk" not in a.html
    deck["presentations"][0]["name"] = "Talk two"
    side.write_text(json.dumps(deck), encoding="utf-8")
    c = _shell(f)
    assert c.ver != b.ver and "Talk two" in c.html
    side.unlink()
    assert "Talk" not in _shell(f).html


def test_stem_path_and_template_are_part_of_the_key(tmp_path, renders,
                                                    monkeypatch):
    f = tmp_path / "nb.ipynb"
    _write(f, _nb())
    a = _shell(f, stem="nb")
    b = _shell(f, stem="nb-2")
    assert a.ver != b.ver and 'data-nb="nb-2"' in b.html
    tpl = assets.shell_template()
    monkeypatch.setattr(shells.assets, "shell_template",
                        lambda: tpl.replace('class="rail"',
                                            'class="rail" data-x="1"'))
    monkeypatch.setattr(page_mod.assets, "shell_template",
                        shells.assets.shell_template)
    c = _shell(f, stem="nb")
    assert c.ver != a.ver and 'data-x="1"' in c.html


def test_a_source_that_embeds_files_beside_it_is_never_kept(tmp_path,
                                                            renders):
    """A .md pulls its pictures from the folder, which no key here
    watches: it renders every time and offers no version."""
    f = tmp_path / "notes.md"
    f.write_text("# Notes\n\nSome text.\n", encoding="utf-8")
    a = _shell(f, stem="notes")
    b = _shell(f, stem="notes")
    assert a.ver == "" and b.ver == "" and renders[0] == 2
    assert "data-ver" not in a.html


def test_a_corrupt_deck_file_opens_deckless_for_a_page_but_errors_on_open(
        tmp_path):
    f = tmp_path / "nb.ipynb"
    _write(f, _nb())
    (tmp_path / "nb.deck.json").write_text("{not json", encoding="utf-8")
    page_shell = _shell(f, lenient=True)
    assert "Hello" in page_shell.html
    with pytest.raises(ValueError):
        _shell(f, lenient=False)


def test_concurrent_misses_on_one_key_build_once():
    """The startup pre-render and the browser's first GET ask together."""
    memo = _Memo(cap=4)
    started, release, built = threading.Event(), threading.Event(), [0]

    def build():
        built[0] += 1
        started.set()
        release.wait(5)
        return shells.Shell("<div></div>", "t", "v")
    got = []
    t1 = threading.Thread(target=lambda: got.append(memo.get("k", "s",
                                                             build)))
    t1.start()
    started.wait(5)
    t2 = threading.Thread(target=lambda: got.append(memo.get("k", "s",
                                                             build)))
    t2.start()
    time.sleep(0.05)
    release.set()
    t1.join(5)
    t2.join(5)
    assert built[0] == 1 and got[0] is got[1]


def test_a_failed_build_is_not_kept_and_the_next_asker_retries():
    memo = _Memo(cap=4)
    with pytest.raises(OSError):
        memo.get("k", "s", lambda: (_ for _ in ()).throw(OSError("gone")))
    assert memo.get("k", "s", lambda: shells.Shell("x", "t")).html == "x"


def test_a_new_version_replaces_the_old_one_in_its_slot():
    memo = _Memo(cap=8)
    memo.get("v1", "slot", lambda: shells.Shell("one", "t"))
    memo.get("v2", "slot", lambda: shells.Shell("two", "t"))
    memo.get("other", "slot2", lambda: shells.Shell("x", "t"))
    assert list(memo._data) == ["v2", "other"]


# -- the page ----------------------------------------------------------------

def _state(tmp_path: Path, names: list[str]) -> _AppState:
    st = _AppState(tmp_path)
    for n in names:
        f = tmp_path / n
        _write(f, _nb(n.split(".")[0]))
        st.note_open(f)
    return st


def test_the_page_built_from_kept_shells_is_the_page_render_page_builds(
        tmp_path):
    """The app page assembles cached pieces as bytes; it must be exactly
    what the plain renderer makes of the same notebooks."""
    from junoview.notebook.loader import load_doc
    from junoview.render.page import render_page

    st = _state(tmp_path, ["alpha.ipynb", "beta.ipynb"])
    page = _app_page(st).decode("utf-8")
    docs = []
    for p in st.open:
        d = load_doc(Path(p))
        d.source_name = Path(p).stem
        docs.append(d)
    plain = render_page(docs, mode="app", asset_base="/static/", app_cfg={
        "token": st.token, "root": str(st.root),
        "presentations": st.presentations, "rev": st.revision,
        "recent": st.recent,
        "paths": {Path(p).stem: p for p in st.open}})
    assert re.sub(r' data-ver="[0-9a-f]+"', "", page) == plain
    assert page.count(' data-ver="') == 2


def test_a_second_page_load_renders_nothing(tmp_path, renders):
    st = _state(tmp_path, ["alpha.ipynb", "beta.ipynb"])
    first = _app_page(st)
    assert renders[0] == 2
    assert _app_page(st) == first and renders[0] == 2
    _write(tmp_path / "beta.ipynb", _nb("Changed"))
    third = _app_page(st)
    assert renders[0] == 3 and b"Changed" in third


def test_the_boot_json_follows_saves_and_the_recent_list(tmp_path):
    st = _state(tmp_path, ["alpha.ipynb"])
    a = _app_page(st)
    assert b'"rev": 0' in a
    st.save_presentations([{"name": "Deck one", "slides": []}], 0)
    b = _app_page(st)
    assert b'"rev": 1' in b and b"Deck one" in b
    _write(tmp_path / "gamma.ipynb", _nb("gamma"))
    st.note_open(tmp_path / "gamma.ipynb")
    c = _app_page(st)
    recent = json.loads(re.search(
        rb'<script type="application/json" id="app-data">(.*?)</script>',
        c).group(1))["project"]["recent"]
    assert recent[0].endswith("gamma.ipynb")


def test_a_deleted_notebook_is_still_pruned(tmp_path):
    st = _state(tmp_path, ["alpha.ipynb", "beta.ipynb"])
    _app_page(st)
    (tmp_path / "beta.ipynb").unlink()
    page = _app_page(st)
    assert [Path(p).name for p in st.open] == ["alpha.ipynb"]
    assert b'data-nb="beta"' not in page
    saved = json.loads((tmp_path / "junoview_project.json").read_text())
    assert [Path(p).name for p in saved["open"]] == ["alpha.ipynb"]


# -- the conditional reload --------------------------------------------------

def _handler(st):
    H = _make_handler(st)
    return H.__new__(H)


def test_reload_with_the_current_version_answers_unchanged(tmp_path,
                                                           renders):
    st = _state(tmp_path, ["alpha.ipynb"])
    h = _handler(st)
    f = str(tmp_path / "alpha.ipynb")
    first = h._open_nb({"path": f, "stem": "alpha"})
    assert first["shell"] and first["ver"]
    assert f'data-ver="{first["ver"]}"' in first["shell"]
    same = h._open_nb({"path": f, "stem": "alpha", "have": first["ver"]})
    assert same == {"stem": "alpha", "path": f, "ver": first["ver"],
                    "unchanged": True}
    # a different version held (an old run, a version view) is answered
    # with the shell, as before
    other = h._open_nb({"path": f, "stem": "alpha", "have": "nope"})
    assert other["shell"] == first["shell"]
    _write(tmp_path / "alpha.ipynb", _nb("Edited"))
    changed = h._open_nb({"path": f, "stem": "alpha",
                          "have": first["ver"]})
    assert "unchanged" not in changed and "Edited" in changed["shell"]
    assert changed["ver"] != first["ver"]


def test_an_unchanged_reload_still_reports_a_corrupt_deck_file(tmp_path):
    st = _state(tmp_path, ["alpha.ipynb"])
    page = _app_page(st).decode("utf-8")
    ver = re.search(r'data-ver="([0-9a-f]+)"', page).group(1)
    h = _handler(st)
    f = str(tmp_path / "alpha.ipynb")
    (tmp_path / "alpha.deck.json").write_text("{broken", encoding="utf-8")
    # the page shows it deckless; an explicit reload says what is wrong
    assert b'data-nb="alpha"' in _app_page(st)
    with pytest.raises(ValueError):
        h._open_nb({"path": f, "stem": "alpha", "have": ver})


def test_a_failed_open_never_joins_the_session(tmp_path):
    st = _AppState(tmp_path)
    f = tmp_path / "broken.ipynb"
    _write(f, _nb())
    (tmp_path / "broken.deck.json").write_text("{nope", encoding="utf-8")
    with pytest.raises(ValueError):
        _handler(st)._open_nb({"path": str(f)})
    assert st.open == [] and st.recent == []


def test_a_version_view_never_carries_the_live_version(tmp_path):
    """A snapshot opened into the tab has no data-ver, so the next Reload
    sends nothing to match and gets the live file back."""
    st = _state(tmp_path, ["alpha.ipynb"])
    h = _handler(st)
    f = tmp_path / "alpha.ipynb"
    h._open_nb({"path": str(f)})          # stores a snapshot
    vid = h._versions({"path": str(f)})["versions"][0]["id"]
    view = h._open_version({"path": str(f), "id": vid})
    assert "data-ver" not in view["shell"]


# -- URL notebooks -----------------------------------------------------------

def test_url_notebooks_download_together_and_the_prerender_is_reused_once(
        monkeypatch):
    calls: list[str] = []

    def slow(url):
        calls.append(url)
        time.sleep(0.3)
        return url.rsplit("/", 1)[-1], json.dumps(_nb(url[-6:])).encode()
    monkeypatch.setattr(shells, "fetch_url_bytes", slow)
    d = shells._Downloads()
    urls = [f"https://example.invalid/n{i}.ipynb" for i in range(3)]
    t = time.perf_counter()
    got = d.fetch(urls)
    assert time.perf_counter() - t < 0.8          # not 3 x 0.3 s
    assert sorted(calls) == sorted(urls) and all(got[u] for u in urls)
    calls.clear()
    d.fetch(urls, warm=True)                       # startup pre-render
    assert len(calls) == 3
    calls.clear()
    first_page = d.fetch(urls)
    assert calls == [] and all(first_page[u] for u in urls)
    second_page = d.fetch(urls)                    # F5: fetched afresh
    assert sorted(calls) == sorted(urls) and all(second_page.values())


def test_a_page_build_joins_a_download_already_running(monkeypatch):
    calls: list[str] = []
    gate = threading.Event()

    def slow(url):
        calls.append(url)
        gate.wait(5)
        return "n.ipynb", json.dumps(_nb()).encode()
    monkeypatch.setattr(shells, "fetch_url_bytes", slow)
    d = shells._Downloads()
    url = "https://example.invalid/n.ipynb"
    warm = threading.Thread(target=d.fetch, args=([url],),
                            kwargs={"warm": True})
    warm.start()
    time.sleep(0.1)
    page = []
    t = threading.Thread(target=lambda: page.append(d.fetch([url])))
    t.start()
    time.sleep(0.1)
    gate.set()
    warm.join(5)
    t.join(5)
    assert calls == [url] and page[0][url][0] == "n.ipynb"
    # the copy it joined is spent: the next build downloads again
    gate.set()
    d.fetch([url])
    assert len(calls) == 2


def test_url_tabs_keep_their_names_and_order_among_local_ones(tmp_path,
                                                             monkeypatch):
    """Downloaded together, but named in session order, exactly as the
    one-at-a-time loop named them."""
    def fetch(url):
        return "n.ipynb", json.dumps(_nb(url.split("/")[-2])).encode()
    monkeypatch.setattr(shells, "fetch_url_bytes", fetch)
    st = _AppState(tmp_path)
    local = tmp_path / "n.ipynb"
    _write(local, _nb("local"))
    st.note_open("https://example.invalid/a/n.ipynb")
    st.note_open(local)
    st.note_open("https://example.invalid/b/n.ipynb")
    page = _app_page(st)
    assert re.findall(rb'class="shell nbshell" data-nb="([^"]+)"',
                      page) == [b"n", b"n-2", b"n-3"]
    assert re.findall(rb'data-nb="n(?:-\d)?" data-path="([^"]+)"', page) \
        == [b"https://example.invalid/a/n.ipynb", str(local).encode(),
            b"https://example.invalid/b/n.ipynb"]


def test_a_failed_download_keeps_the_url_in_the_session(tmp_path,
                                                        monkeypatch):
    def down(url):
        raise OSError("offline")
    monkeypatch.setattr(shells, "fetch_url_bytes", down)
    st = _AppState(tmp_path)
    st.note_open("https://example.invalid/n.ipynb")
    page = _app_page(st)
    assert page.count(b'class="shell nbshell"') == 0
    assert st.open == ["https://example.invalid/n.ipynb"]


# -- startup -----------------------------------------------------------------

def test_binding_asks_no_dns(monkeypatch, tmp_path):
    from junoview.server.app import _Server

    def no(*a, **kw):
        raise AssertionError("getfqdn called at bind")
    monkeypatch.setattr(socket, "getfqdn", no)
    httpd = _Server(("127.0.0.1", 0), _make_handler(_AppState(tmp_path)))
    try:
        assert httpd.server_name == "127.0.0.1"
        assert httpd.server_port == httpd.server_address[1]
    finally:
        httpd.server_close()


def test_the_browser_opens_at_once_and_the_page_is_prebuilt(monkeypatch,
                                                            tmp_path):
    from junoview.server import app

    f = tmp_path / "nb.ipynb"
    _write(f, _nb())
    opened, built = threading.Event(), threading.Event()
    monkeypatch.setattr(app.webbrowser, "open",
                        lambda url: opened.set())
    real = app._app_page

    def prerender(state, *, warm=False):
        assert warm
        real(state, warm=warm)
        built.set()
        return b""
    monkeypatch.setattr(app, "_app_page", prerender)

    def no_timer(*a, **kw):
        raise AssertionError("the browser waits on a timer again")
    monkeypatch.setattr(app.threading, "Timer", no_timer)
    monkeypatch.setattr(app._Server, "serve_forever",
                        lambda self: (opened.wait(5), built.wait(10)))
    assert app.run_app(tmp_path, [str(f)], port=0) == 0
    assert opened.is_set() and built.is_set()
    # what the pre-render built is what the first page load finds
    fr = f.resolve()
    src = local_source(fr, "nb", str(fr))
    assert src.key in shells._SHELLS._data
    assert _AppState(tmp_path).open == [str(fr)]


# -- the folder listing --------------------------------------------------------

def test_the_folder_listing_is_unchanged(tmp_path):
    from junoview.server.state import _list_dir

    (tmp_path / "Zeta").mkdir()
    (tmp_path / "alpha").mkdir()
    (tmp_path / ".hidden").mkdir()
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "B.ipynb").write_text("x" * 3000)
    (tmp_path / "a.ipynb").write_text("{}")
    (tmp_path / "talk.junoview.html").write_text("x" * 5000)
    (tmp_path / "slides.pptx").write_bytes(b"x" * 10)
    (tmp_path / "paper.tex").write_text("x")
    (tmp_path / "notes.txt").write_text("x")
    try:
        (tmp_path / "link").symlink_to(tmp_path / "alpha",
                                       target_is_directory=True)
        linked = True
    except OSError:
        linked = False
    got = _list_dir(str(tmp_path))
    root = str(tmp_path.resolve())
    assert got["dir"] == root
    assert [d["name"] for d in got["dirs"]] == \
        (["alpha", "link", "Zeta"] if linked else ["alpha", "Zeta"])
    assert all(d["path"] == os.path.join(root, d["name"])
               for d in got["dirs"])
    assert got["notebooks"] == [
        {"name": "a.ipynb", "path": os.path.join(root, "a.ipynb"),
         "size": "1 KB"},
        {"name": "B.ipynb", "path": os.path.join(root, "B.ipynb"),
         "size": "2 KB"}]
    assert got["decks"] == [
        {"name": "slides.pptx", "path": os.path.join(root, "slides.pptx"),
         "size": "1 KB", "kind": ".pptx"},
        {"name": "talk.junoview.html",
         "path": os.path.join(root, "talk.junoview.html"), "size": "4 KB"}]
    assert [s["name"] for s in got["sources"]] == ["paper.tex"]


# -- the page side ---------------------------------------------------------------

_OPEN_RUN = r"""
const reqs = [];
let reply = [];
const APP = {shells:{}, order:[]};
function api(path, body){ reqs.push(JSON.parse(JSON.stringify(body)));
  return Promise.resolve(reply.shift()); }
__FNS__
function tab(stem, path, ver){ APP.order.push(stem);
  APP.shells[stem] = {el:{dataset:{path:path, ver:ver}}}; }
(async () => {
  const out = {};
  tab('a', '/n/a.ipynb', 'V1');
  tab('b', '/n/b.ipynb', '');
  out.tabs = [tabForPath('/n/a.ipynb'), tabForPath('/n/b.ipynb'),
              tabForPath('/n/c.ipynb')];
  reply = [{stem:'a', ver:'V1', unchanged:true}];
  out.same = await openShell({path:'/n/a.ipynb', stem:'a'}, 'a');
  reply = [{stem:'b', shell:'<div>'}];
  out.nover = await openShell({path:'/n/b.ipynb'}, 'b');
  // the tab was replaced while asking: ask again, without `have`
  reply = [{stem:'a', ver:'V1', unchanged:true}, {stem:'a', shell:'<x>'}];
  const p = openShell({path:'/n/a.ipynb', stem:'a'}, 'a');
  APP.shells.a.el.dataset.ver = '';
  out.replaced = await p;
  out.reqs = reqs;
  console.log(JSON.stringify(out));
})();
"""


def test_the_page_sends_its_version_and_trusts_unchanged_only_for_it():
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    src = assets.app_js()
    fns = "\n".join(lift_fn(src, n)
                    for n in ("shellVer", "tabForPath", "openShell"))
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_OPEN_RUN.replace("__FNS__", fns), encoding="utf-8")
        cmd, env = eng
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr
    out = json.loads(r.stdout.strip().splitlines()[-1])
    assert out["tabs"] == ["a", "b", ""]
    assert out["same"]["unchanged"] is True
    assert out["nover"]["shell"] == "<div>"
    assert out["replaced"] == {"stem": "a", "shell": "<x>"}
    assert out["reqs"] == [
        {"path": "/n/a.ipynb", "stem": "a", "have": "V1"},
        {"path": "/n/b.ipynb"},
        {"path": "/n/a.ipynb", "stem": "a", "have": "V1"},
        {"path": "/n/a.ipynb", "stem": "a"}]


def test_reload_paths_use_the_conditional_open():
    js = assets.app_js()
    tab = js[js.index("APP.reloadTab=function(stem,pathHint){"):]
    tab = tab[:tab.index("\n  };")]
    assert "openShell({path:path,stem:stem},sh?stem:'')" in tab
    assert "if(j.unchanged) activate(stem);" in tab
    op = js[js.index("  function openPath(path,keep){"):]
    op = op[:op.index("\n  APP.openPath=openPath;")]
    assert "openShell({path:path},openTab)" in op
    assert "if(APP.noteRecent) APP.noteRecent(j.path||path);" in op
    # the raw view is built from its template the first time it shows
    assert "tpl.parentNode.replaceChild(tpl.content,tpl);" in js
    assert '<div class="rawview"><template class="rawtpl">' in \
        assets.shell_template()
