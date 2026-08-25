"""What a built page is, once it exists. Covers the three page modes (static
export, the app shell, the client-side web build), what each one bakes in
versus defers, the multi-notebook bundle, and the behaviour the emitted page
performs on load -- reactivating the interactive outputs that were
neutralised at build time and drawing deferred plot specs.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from helpers import _demo_and_other
from junoview import assets
from junoview.notebook.loader import is_url, normalize_nb_url, stem_for
from junoview.render.page import render_page
from junoview.server.state import _list_dir
from junoview.server.vcs import _github_web_url
from junoview.web import build_web, web_parse


def test_multi_notebook_page_has_one_shell_per_notebook(nb):
    """multi-notebook page: two tabs, per-shell data, cross-notebook deck"""
    doc_a, doc_b = _demo_and_other(nb)
    page = render_page([doc_a, doc_b], app_cfg={
        "presentations": [{"name": "combo", "slides": [
            {"layout": "halves", "panes": ["demo::clim", "other::sst"]}]}],
    })
    assert page.count('class="shell nbshell"') == 2
    assert 'data-nb="demo"' in page and 'data-nb="other"' in page
    assert 'id="apptop"' in page and 'id="tabstrip"' in page
    assert '"mode": "static"' in page and "demo::clim" in page


def test_app_mode_page_carries_session_token_and_paths(nb):
    """app-mode page carries the session token and root for the GUI"""
    doc_a, _doc_b = _demo_and_other(nb)
    app_page = render_page([doc_a], mode="app", app_cfg={
        "token": "tok123", "root": "C:/proj", "paths": {"demo": "x.ipynb"},
        "recent": ["a.ipynb"],
    })
    assert '"mode": "app"' in app_page and "tok123" in app_page
    assert 'data-path="x.ipynb"' in app_page


def test_server_dir_listing_shape_and_stem_dedupe():
    """server helpers: directory listing shape + stem dedupe"""
    listing = _list_dir(str(Path(__file__).parent))
    assert {"dir", "parent", "dirs", "notebooks"} <= set(listing)
    assert stem_for(Path("a/nb.ipynb"), {"nb"}) == "nb-2"


def test_github_web_url_only_normalises_github_remotes():
    assert _github_web_url("git@github.com:alice/proj.git") \
        == "https://github.com/alice/proj"
    assert _github_web_url("https://github.com/alice/proj") \
        == "https://github.com/alice/proj"
    assert _github_web_url("https://gitlab.com/x/y") == ""


def test_github_urls_normalize_and_web_build_dedupes_stems(nb):
    """URLs: GitHub normalization + the client-side web build"""
    assert normalize_nb_url(
        "https://github.com/u/r/blob/main/d/nb.ipynb") \
        == "https://raw.githubusercontent.com/u/r/main/d/nb.ipynb"
    assert is_url("https://x/y.ipynb") and not is_url("C:/y.ipynb")
    shell = web_parse("demo.ipynb", json.dumps(nb), '["demo"]')
    assert 'data-nb="demo-2"' in shell


def test_build_web_emits_a_pyodide_bundle():
    """The static web build ships Pyodide and the renderer source.

    The renderer source used to be a single ``semantic_render.py`` that
    the loader fetched and imported. A package cannot ship that way, so
    the package split replaced it with ``junoview.zip``, handed to
    Pyodide's ``unpackArchive`` -- still one HTTP request. The original
    assertion named the old file; it is retargeted, not weakened.
    """
    with tempfile.TemporaryDirectory() as td:
        build_web(Path(td))
        idx = (Path(td) / "index.html").read_text(encoding="utf-8")
        assert "pyodide" in idx and "sem:pyready" in idx
        assert (Path(td) / "junoview.zip").exists()


def test_client_reactivates_outputs_and_draws_plotly_specs(out):
    """The client re-activates neutralised scripts + draws plotly specs."""
    assert "function activateOutputs" in out and "window.SemActivate" in out
    assert 'text/plotline-embed' in out and "cdn.plot.ly" in out
    assert ".ckf-dot.ot-sw-numeric" in out \
        and ".ckf-dot.ot-sw-dataframe" in out


def test_build_web_emits_the_offline_installable_app():
    """The web build is a PWA: one visit, then it works with no internet.

    ``build_web`` writes a service worker (version-stamped with the
    package hash so a new build retires the old cache, deterministic so an
    unchanged build produces no diff), a manifest and an icon, and the
    loader registers the worker BEFORE Pyodide starts so the first visit
    precaches in parallel with the first boot (2026-08-20, user: "make it
    purely offline").
    """
    with tempfile.TemporaryDirectory() as td:
        build_web(Path(td))
        sw = (Path(td) / "sw.js").read_text(encoding="utf-8")
        assert "__JV_VERSION__" not in sw, "version token never replaced"
        assert "junoview.zip" in sw and "pyodide" in sw
        # the Pyodide pin in the worker must match the loader's script tag
        idx = (Path(td) / "index.html").read_text(encoding="utf-8")
        pin = "pyodide/v0.26.4/full/"
        assert pin in sw and pin in idx
        assert "serviceWorker" in idx and "manifest.webmanifest" in idx
        assert "beforeinstallprompt" in idx
        man = json.loads((Path(td) / "manifest.webmanifest")
                         .read_text(encoding="utf-8"))
        assert man["display"] == "standalone"
        assert man["icons"][0]["src"] == "icon.svg"
        assert (Path(td) / "icon.svg").read_text(
            encoding="utf-8").startswith("<svg")
        # determinism, same rule as the zip: rebuild -> identical worker
        with tempfile.TemporaryDirectory() as td2:
            build_web(Path(td2))
            assert (Path(td2) / "sw.js").read_text(encoding="utf-8") == sw


def test_a_failed_silent_restore_never_forgets_the_notebook():
    """Opening the app offline must not erase your remembered session.

    The web build restores last session's URL notebooks silently on boot.
    That path used to call ``webUnnote`` on ANY failure, so launching the
    app once with no connection dropped every notebook from the remembered
    -open list -- and they were still gone after reconnecting (2026-08-21).
    A fetch that never reached a server rejects with no ``status``; only
    the server saying the file is not there (404/410) may retire a URL.
    """
    js = render_page([], mode="web")
    assert "if(e&&(e.status===404||e.status===410)) webUnnote(url);" in js
    assert "else noteRestoreMiss();" in js
    # the status has to be ON the error for that test to ever be true
    assert "he.status=r.status;throw he;" in js
    # and a kept-but-unreachable notebook says so, rather than vanishing
    assert "could not be reloaded" in js and "when you reconnect" in js


def test_web_session_restore_survives_an_early_pyready():
    """Restoring the session must not depend on winning a race.

    The loader writes the whole app page with ``document.write()`` -- which
    wipes the document and every listener on it -- then fires
    ``sem:pyready`` immediately. If this script had not run yet, the event
    is lost and last session's notebooks silently never come back. The
    service worker made that race much easier to lose (a cached boot
    writes the page faster): reproduced 2026-08-21, where the first visit
    restored and every later one did not. ``window.semPy`` is set before
    the dispatch, so it is the reliable already-up flag.
    """
    js = render_page([], mode="web")
    assert "if(window.semPy) restoreWebSession();" in js
    assert "else document.addEventListener('sem:pyready',restoreWebSession);" \
        in js


def test_the_worker_never_serves_a_stale_notebook():
    """Notebooks are data, not app shell.

    A notebook served from our own origin is same-origin and would be
    cached like a stylesheet -- re-run it, reopen it, and you would get
    yesterday's figures. It may only ever come from the cache as an
    offline fallback.
    """
    sw = assets.sw_js()
    assert "DATA_RE" in sw and r"\.(ipynb|junoview)(\.html)?$" in sw
    assert "return fetch(req).catch(function(){" in sw


def test_the_manifest_reaches_the_APP_page_not_just_the_loader():
    """The running app must declare the manifest, or it is not installable.

    The loader hands over with ``document.write()``, which replaces the
    document and takes its ``<link rel="manifest">`` with it. Declaring the
    manifest only in the loader left the live app with none -- Chrome's
    installability check reported ``no-manifest`` and the browser had
    nothing to install (2026-08-21).

    Static exports and the local app server ship no manifest file, so they
    must NOT reference one and 404.
    """
    web = render_page([], mode="web")
    assert '<link rel="manifest" href="manifest.webmanifest">' in web
    assert '<meta name="theme-color" content="#0a141d">' in web
    for other in (render_page([], mode="static"), render_page([], mode="app")):
        assert "manifest.webmanifest" not in other
