"""Your arrangement, remembered. Hidden cells, filter state, sizes and scroll
position are snapshotted per notebook and restored on the way back, by one
snapshot builder that also feeds custom views. Refreshing a notebook is the
hard case and one test straddles it deliberately: it must bust the CDN cache
to re-read the file AND restore the view state across the swap, so the
URL-layer asserts sit here next to the state ones they exist to serve.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from junoview.notebook.loader import _cache_bust, load_doc
from junoview.server.state import _PROJECT_FILE, _AppState


def test_layout_snapshot_records_hidden_heads_and_feed_sizers(out):
    """Hidden headings are part of the saved layout, like every other
    view setting -- and so are the two feed-wide sizers."""
    assert "secsHeadOff:$$('.section.sec-headoff'" in out
    assert "(keep.secsHeadOff||[]).forEach" in out
    assert "st.secsHeadOff||[]" in out
    # the two feed-wide sizers are layout too
    assert "st.figall=APP.getFigAll?APP.getFigAll():1;" in out
    assert "st.mdall=APP.getMdAll?APP.getMdAll():1;" in out
    assert "if(APP.setFigAll) APP.setFigAll(st.figall||1);" in out
    assert "if(APP.setMdAll) APP.setMdAll(st.mdall||1);" in out
    # ONE snapshot builder feeds both the layout cache and a custom view
    assert "function layoutSnapshot" in out and "function applySnapshot" in out
    assert "APP.layoutSnapshot=layoutSnapshot;" in out
    assert "APP.applySnapshot=function(stem,st)" in out


def test_layout_and_tab_identity_remembered_per_notebook(out):
    """YOUR LAYOUT is remembered per notebook (hidden cells, hidden and
    collapsed sections, tree/raw mode, and the whole filter setup) --
    including the size you set on an INDIVIDUAL figure.

    A tab opened AT A COMMIT keeps the notebook's name, with the short hash
    underneath -- not a "-2" suffix.
    """
    assert "function saveLayout" in out and "function loadLayout" in out
    assert "'junoview:layout:'" in out
    # …including the size you set on an INDIVIDUAL figure
    assert "st.figs={}" in out and "c.style.setProperty('--fz'" in out
    assert "else loadLayout(shell,stem," in out
    assert "function scheduleSaveLayout" in out
    # a tab opened AT A COMMIT keeps the notebook's name, with the short
    # hash underneath — not a "-2" suffix
    assert "vs.className='tab-ver'" in out and ".tab-t.tab-t-ver" in out
    assert "sh.label||stem" in out


def test_refresh_busts_cdn_cache_and_preserves_view_state(out):
    """GitHub raw fetches bust the CDN cache (server + web builds; the raw
    CDN otherwise serves stale content for minutes), and a notebook
    refresh keeps the VIEW: hidden cells/sections, collapsed sections,
    tree/raw mode and scroll all survive the shell swap
    """
    assert _cache_bust("https://raw.githubusercontent.com/a/b/c.ipynb"
                       ).startswith(
        "https://raw.githubusercontent.com/a/b/c.ipynb?jvr=")
    assert _cache_bust("https://example.com/n.ipynb") \
        == "https://example.com/n.ipynb"
    assert "cache:'no-store'" in out and "jvr='+Date.now()" in out
    assert "function captureViewState" in out
    assert "function restoreViewState" in out
    assert "APP.mountShellHTML=mountShellHTML" in out


def test_save_target_picker_replaces_download_json(out):
    """SAVE LOCATION: a "Saved to:" picker (project / browser / a remembered
    .junoview file) instead of an unexplained "Download JSON".

    The friendlier names replaced the JSON-speak outright, so the old
    wording must not survive anywhere on the page.
    """
    assert 'id="dc-target"' in out and 'id="target-menu"' in out
    assert 'id="tg-browser"' in out and 'id="tg-file"' in out
    assert "function renderTargetBtn" in out and "function setTarget" in out
    assert "showSaveFilePicker" in out and "'.junoview.html'" in out
    # the friendlier names replaced the JSON-speak
    assert "Download a copy" in out and "Open a .junoview" in out
    assert "Download JSON" not in out and "Load deck" not in out


def test_picked_save_file_remembered_across_visits(out):
    """The picked file is REMEMBERED across visits (handle in IndexedDB), and
    permission is re-asked rather than assumed."""
    assert "indexedDB.open('junoview'" in out and "function idbPut" in out
    assert "function permAsk" in out and "function saveToFile" in out


def test_sidecar_junoview_file_auto_loads(tmp_path):
    """A .junoview next to the notebook auto-loads like the old sidecar."""
    _p = tmp_path / "talk.ipynb"
    _p.write_text(json.dumps({"cells": [
        {"cell_type": "code", "source": "x=1", "outputs": []}]}),
        encoding="utf-8")
    _p.with_suffix(".junoview").write_text(json.dumps(
        {"junoview": 1, "presentations": [
            {"name": "from sidecar", "slides": []}]}),
        encoding="utf-8")
    _sc = load_doc(_p)
    assert [p["name"] for p in _sc.presentations] == ["from sidecar"]


def test_saved_file_is_a_browser_openable_html_wrapper(out, tmp_path):
    """The saved file is a real HTML page with the JSON inside it.

    A bare-JSON .junoview was a dead end on disk: double-clicking asked
    Windows to pick an app and nothing said what the file was
    (2026-08-18, user: "when opening it doesn't really recognise that
    this should be opened in a browser"). Saved as name.junoview.html the
    OS opens a browser, and the page identifies itself -- the Junoview
    logo, the name, what it holds, how to open it.

    Verified against the browser's actual output: the captured download
    parsed through _deck_json, and a talk.junoview.html sidecar
    auto-loaded next to talk.ipynb.
    """
    from junoview.notebook.loader import _deck_json

    assert "function junoviewFileHtml(){" in out
    assert "function parseDeckText(txt){" in out
    # both writers write the wrapper; the project save stays raw JSON
    assert "w.write(junoviewFileHtml())" in out
    assert "new Blob([junoviewFileHtml()],{type:'text/html'});" in out
    # the download and the picker both carry the openable double suffix
    assert "+'.junoview.html';" in out
    assert "+'.junoview.html'," in out
    # `<` is escaped inside the JSON so no saved text -- even a text box
    # that literally says </script> -- can close the data block early
    assert ("deckFileText().replace(/</g,'" + 2 * chr(92)
            + "u003c');") in out
    # the importer unwraps before parsing, so both forms open
    assert "var obj=parseDeckText(txt);" in out
    # ...and the Python loader does the same, probing the new sidecar
    # name first
    assert _deck_json(json.dumps({"junoview": 1, "presentations": []}))
    _nb = tmp_path / "talk.ipynb"
    _nb.write_text(json.dumps({"cells": [
        {"cell_type": "code", "source": "x=1", "outputs": []}]}),
        encoding="utf-8")
    (tmp_path / "talk.junoview.html").write_text(
        '<!doctype html><html><body>'
        '<script type="application/json" id="junoview-data">'
        + json.dumps({"junoview": 1, "presentations": [
            {"name": "from html sidecar", "slides": []}]})
        + '</script></body></html>', encoding="utf-8")
    _doc = load_doc(_nb)
    assert [p["name"] for p in _doc.presentations] == ["from html sidecar"]


def test_legacy_project_filenames_still_load():
    """Project file renamed to junoview_project.json, but an existing
    plotline_project.json (or older semantic_project.json) still loads."""
    assert _PROJECT_FILE == "junoview_project.json"
    with tempfile.TemporaryDirectory() as td:
        (Path(td) / "plotline_project.json").write_text(
            '{"presentations": [{"name": "legacy", "slides": []}]}',
            encoding="utf-8")
        proj = _AppState(Path(td))
        assert [p["name"] for p in proj.presentations] == ["legacy"]
