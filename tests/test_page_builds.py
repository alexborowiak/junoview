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
from junoview.notebook.loader import _is_url, _normalize_nb_url, _stem_for
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
    assert _stem_for(Path("a/nb.ipynb"), {"nb"}) == "nb-2"


def test_github_web_url_only_normalises_github_remotes():
    assert _github_web_url("git@github.com:alice/proj.git") \
        == "https://github.com/alice/proj"
    assert _github_web_url("https://github.com/alice/proj") \
        == "https://github.com/alice/proj"
    assert _github_web_url("https://gitlab.com/x/y") == ""


def test_github_urls_normalize_and_web_build_dedupes_stems(nb):
    """URLs: GitHub normalization + the client-side web build"""
    assert _normalize_nb_url(
        "https://github.com/u/r/blob/main/d/nb.ipynb") \
        == "https://raw.githubusercontent.com/u/r/main/d/nb.ipynb"
    assert _is_url("https://x/y.ipynb") and not _is_url("C:/y.ipynb")
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
