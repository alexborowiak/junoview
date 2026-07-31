"""Notebook versions and their git backing. Automatic snapshots are stored per
open/reload, deduped when nothing changed and capped, then listed in the tab
menu and the sidebar's file-info panel; opening one replaces the tab in
place and stays out of Recent. The commit hash expands the full git history
(local repo and GitHub-opened notebooks alike), figure locks pin a frame to
a commit so refresh cannot touch it, and per-frame figure rescue keeps a
previous snapshot alongside the live one.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from junoview.server.notebook_edit import _store_version, _versions_dir


def test_automatic_versions_and_file_info_panel(out):
    """automatic notebook versions: stored per open/reload (deduped, capped),
    listed + reopened from the tab's ⌚ menu into the SAME stem/path.

    File info: path + git commit + version history, in the sidebar where
    you can find it (reload moved off the tab and sits beside it)
    """
    assert "'/api/versions'" in out and "'/api/openversion'" in out
    assert "function wireFileInfo" in out and 'class="rf-panel"' in out
    assert "rf-info" in out and "rf-reload" in out
    assert "current commit" in out


def test_commit_hash_expands_openable_git_versions(out):
    """the HASH is the way in: clicking it expands every version, each
    openable -- for a local repo AND for a notebook opened from GitHub.

    …and the ⌚ menu also lists the notebook's GIT history (short hash +
    commit message + date), opening the notebook as it was at any commit
    """
    assert "function hashRow" in out and "function commitList" in out
    assert ".rf-hashbtn" in out and ".rf-commits" in out
    assert "function ghFromUrl" in out and "function ghCommits" in out
    assert "raw.githubusercontent.com" in out and "api.github.com" in out
    assert "function ghRawAt" in out
    assert "GitHub rate limit" in out
    assert "tab-verbtn" not in out      # the buried tab buttons are gone
    assert "function showVersMenu" in out
    assert "git commits" in out and "vers-sub" in out
    assert "commit:cm.id" in out and "'git:'+cm.id" in out


def test_store_version_dedupes_unchanged_snapshots():
    """Saving twice with no edit in between keeps one snapshot."""
    with tempfile.TemporaryDirectory() as vtd:
        vf = Path(vtd) / "exp.ipynb"
        vf.write_text('{"cells": []}', encoding="utf-8")
        _store_version(vf)
        _store_version(vf)      # unchanged -> deduped, still one snapshot
        vs = list(_versions_dir(vf).glob("*.ipynb"))
        assert len(vs) == 1
        vf.write_text('{"cells": [1]}', encoding="utf-8")
        _store_version(vf)
        assert len(list(_versions_dir(vf).glob("*.ipynb"))) == 2


def test_version_opens_in_place_and_picker_dismisses(out):
    """A version is the SAME file: it replaces the tab and stays out of
    Recent, with an explicit "open in a new tab" to compare instead."""
    assert "function openUrlVersion" in out and ".rf-newtab" in out
    assert "if(path&&!quiet&&APP.noteRecent)" in out
    assert "{path:url,stem:intoStem}" in out
    # …and the picker closes on an outside click, Esc, or a choice
    assert "function closePanel" in out
    assert "if(e.key==='Escape'&&!panel.hidden) closePanel();" in out
    assert "function syncToggleBtn" in out


def test_figure_locks_pin_a_frame_to_a_git_commit(out):
    """figure LOCKS: pin a frame to a git commit -- refresh can't touch it,
    a closed notebook still renders it, Lock/Unlock all + prefetch live
    in the Notebooks menu, and the chip names the commit
    """
    assert 'id="fmt-lockver"' in out and "a.lockver" in out
    assert "'/api/versioncards'" in out and "function fetchVerCards" in out
    assert "function lockAllFrames" in out
    assert "function unlockAllFrames" in out and "window.confirm" in out
    assert "function loadLockedVersions" in out and "an-lockchip" in out
    assert "function frameFromVerCard" in out and "an-verwait" in out


def test_per_frame_figure_rescue_keeps_previous_and_live(out):
    """per-frame figure rescue: every live clone is remembered; a notebook
    reload rotates snapshots to "previous"; the ribbon's Previous/Live
    figure button swaps ONE frame without touching the others
    """
    assert "var frameSnaps={},frameSnapsPrev={}" in out
    assert "frozenFrames=new WeakMap()" in out
    assert "function framePartFromSnap" in out and "an-frozenchip" in out
    assert 'id="fmt-revert"' in out and "Previous figure" in out
