"""A card's Git timeline reads metadata first, then one selected output."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from junoview.server.routes import _make_handler
from junoview.server.state import _AppState
from junoview.server.vcs import _history_output_html


def _git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True,
        text=True, encoding="utf-8", timeout=20)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def _cell(source: str, result: str, cell_id: str = "") -> dict:
    cell = {"cell_type": "code", "source": source,
            "outputs": [{"output_type": "display_data",
                         "data": {"image/png": result}}]}
    if cell_id:
        cell["id"] = cell_id
    return cell


def _save(path: Path, cells: list[dict]) -> None:
    path.write_text(json.dumps({"cells": cells, "metadata": {},
                                "nbformat": 4, "nbformat_minor": 5}),
                    encoding="utf-8")


def _commit(root: Path, name: str) -> str:
    _git(root, "add", "analysis.ipynb")
    _git(root, "commit", "-q", "-m", name)
    return _git(root, "rev-parse", "--short", "HEAD")


@pytest.fixture
def repo(tmp_path: Path):
    if not shutil.which("git"):
        pytest.skip("git is unavailable")
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "config", "user.name", "Cell History Test")
    _git(tmp_path, "config", "user.email", "cell-history@test.invalid")
    path = tmp_path / "analysis.ipynb"
    handler = _make_handler(_AppState(tmp_path))
    return path, handler.__new__(handler)


def test_history_is_metadata_only_and_selected_output_is_lazy(repo,
                                                                monkeypatch):
    path, handler = repo
    _save(path, [_cell("other()", "OTHER", "other"),
                 _cell("plot()", "OLD", "plot-cell")])
    first = _commit(path.parent, "before")
    _save(path, [_cell("inserted()", "INSERTED", "inserted"),
                 _cell("other()", "OTHER", "other"),
                 _cell("plot()", "NEW", "plot-cell")])
    second = _commit(path.parent, "after")

    import junoview.server.vcs as vcs

    original = vcs._git_show_notebook
    monkeypatch.setattr(vcs, "_git_show_notebook", lambda *a, **kw: 1 / 0)
    listed = handler._cell_history({"path": str(path),
                                    "anchor": "cell:plot-cell"})
    assert [entry["id"] for entry in listed["commits"]] == [second, first]
    assert all("html" not in entry for entry in listed["commits"])
    monkeypatch.setattr(vcs, "_git_show_notebook", original)

    old = handler._cell_version({"path": str(path),
                                 "anchor": "cell:plot-cell",
                                 "commit": first})
    assert old["status"] == "matched-id"
    assert old["index"] == 1
    assert "OLD" in old["html"]
    assert "OTHER" not in old["html"]
    assert "INSERTED" not in old["html"]
    new = handler._cell_version({"path": str(path),
                                 "anchor": "cell:plot-cell",
                                 "commit": second})
    assert "NEW" in new["html"] and "OLD" not in new["html"]


def test_grouped_card_follows_parser_primary_and_position_fallback(repo):
    path, handler = repo
    group = [
        _cell("#| group: pair\n#| id: pair-id\nprepare()", "PREP"),
        _cell("#| group: pair\nplot()", "FIGURE"),
        _cell("plain_old()", "PLAIN"),
    ]
    _save(path, group)
    old = _commit(path.parent, "group")
    group[0]["outputs"] = []
    group[1]["outputs"][0]["data"]["image/png"] = "NOW"
    group[2]["source"] = "plain_new()"
    _save(path, group)
    _commit(path.parent, "edit")

    paired = handler._cell_version({"path": str(path),
                                    "anchor": "pair-id", "commit": old})
    assert paired["status"] == "matched-id"
    assert paired["index"] == 1  # figure is primary, id comes from member 0
    assert "FIGURE" in paired["html"]
    assert "PREP" in paired["html"]
    assert "PLAIN" not in paired["html"]
    plain = handler._cell_version({"path": str(path),
                                   "anchor": "cell:p2", "commit": old})
    assert plain["status"] == "matched-position"
    assert "PLAIN" in plain["html"]


def test_id_and_source_fallback_follow_a_cell_after_it_moves(repo):
    path, handler = repo
    _save(path, [
        _cell("#| id: old-name\nmake_figure()", "OLDID", "stable"),
        _cell("print('unchanged')", "OLDSOURCE"),
    ])
    first = _commit(path.parent, "before move")
    _save(path, [
        _cell("added()", "ADDED"),
        _cell("#| id: new-name\nmake_figure()", "NEWID", "stable"),
        _cell("print('unchanged')", "NEWSOURCE"),
    ])
    _commit(path.parent, "after move")
    by_id = handler._cell_version({"path": str(path),
                                    "anchor": "new-name", "commit": first})
    assert by_id["status"] == "matched-id" and "OLDID" in by_id["html"]
    by_source = handler._cell_version({"path": str(path),
                                        "anchor": "cell:p2", "commit": first})
    assert by_source["status"] == "matched-source"
    assert "OLDSOURCE" in by_source["html"]
    assert "OLDID" not in by_source["html"]


def test_cell_history_limits_commit_and_payload(repo, monkeypatch):
    path, handler = repo
    _save(path, [_cell("plot()", "ABCDEFGHIJ", "plot")])
    first = _commit(path.parent, "first")
    with pytest.raises(ValueError, match="bad commit"):
        handler._cell_version({"path": str(path), "anchor": "cell:plot",
                               "commit": "HEAD:secret"})
    with pytest.raises(FileNotFoundError, match="not in this cell history"):
        handler._cell_version({"path": str(path), "anchor": "cell:plot",
                               "commit": "deadbeef"})
    import junoview.server.vcs as vcs

    monkeypatch.setattr(vcs, "CELL_HISTORY_OUTPUT_CAP", 5)
    out = handler._cell_version({"path": str(path),
                                 "anchor": "cell:plot", "commit": first})
    assert out["status"] == "too-large" and out["html"] == ""


def test_old_cell_is_available_before_notebook_rename(repo):
    path, handler = repo
    _save(path, [_cell("draw()", "BEFORE", "stable")])
    first = _commit(path.parent, "original name")
    renamed = path.with_name("renamed.ipynb")
    _git(path.parent, "mv", path.name, renamed.name)
    _git(path.parent, "commit", "-q", "-m", "rename notebook")
    out = handler._cell_version({"path": str(renamed),
                                 "anchor": "cell:stable", "commit": first})
    assert out["found"] and "BEFORE" in out["html"]


def test_history_previews_do_not_activate_old_html_or_inline_svg():
    rich = _history_output_html({
        "output_type": "display_data", "data": {
            "text/html": '<table class="dataframe"><tr><td '
                         'onclick="alert(1)">A</td></tr></table>'
                         '<script>alert(2)</script>'}})
    assert "<table" in rich and "A" in rich
    assert "onclick" not in rich and "<script" not in rich
    assert "alert(2)" not in rich

    svg = _history_output_html({
        "output_type": "display_data", "data": {
            "image/svg+xml": '<svg onload="alert(3)"></svg>'}})
    assert 'src="data:image/svg+xml;base64,' in svg
    assert "<svg" not in svg and "onload" not in svg
