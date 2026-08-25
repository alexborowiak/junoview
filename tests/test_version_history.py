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


def test_a_decks_history_goes_in_indexeddb(out):
    """TASKS T32. A snapshot is the whole deck, and a deck carries
    placed images as data URIs. localStorage's quota has bitten this
    project once already -- it is why self-contained decks keep figures
    out of the pres object -- and twenty copies of a deck is exactly
    that problem again. IndexedDB is already open here for file handles,
    so this is a second use of a store that exists.

    ONE RECORD PER SNAPSHOT plus a small index: keeping the list in one
    record would rewrite every snapshot on every save.
    """
    assert "function histKey(){return 'dhist:'+SCOPE+':'" in out
    assert "function histVKey(id){return histKey()+':'+id;}" in out
    assert "function snapWrite(ix,txt,why){" in out
    assert "function idbDel(k){" in out
    assert "var HIST_KEEP=20;" in out


def test_the_same_snapshot_rule_the_notebook_uses(out):
    """One when you open it, one on every explicit save, deduped when
    nothing changed, capped. A history that records the same deck nine
    times cannot be read, and the dedupe is what makes "open, look,
    close" cost nothing.

    The old record is deleted only AFTER the index stops naming it, so a
    crash between the two leaves an orphan rather than a listed snapshot
    that cannot be opened.
    """
    assert "snapTake('opened');" in out
    assert out.count("snapTake('saved');") == 2
    assert "if(prev===txt) return false;" in out
    i = out.index("return idbPut(histKey(),next);")
    assert "idbDel(histVKey(d.id))" in out[i:i + 500]


def test_the_diff_pairs_slides_by_name_not_by_position(out):
    """This is why T29's `sid` mattered more than it looked. Pairing by
    index reports "everything from slide 4 down has changed" the moment
    you insert one, which is not a diff, it is noise. With a durable
    name the answer is the true one: changed, moved, added, gone.

    Verified in a browser: after editing slide 1 and deleting slide 2,
    the panel read "1 changed, 1 gone, 1 moved" -- the third slide
    correctly MOVED rather than changed.

    A snapshot older than slide names falls back to positional pairing
    and the panel says so rather than pretending.
    """
    assert "function deckDiff(then,now){" in out
    assert "var byName=A.every(function(s2){return s2&&s2.sid;})" in out
    assert ":ai!==i?'moved':'same'" in out
    assert "compared by position: this snapshot is " in out


def test_the_old_deck_is_drawn_by_the_renderer_that_draws_the_new_one(out):
    """withDeck swaps the one global for the length of a synchronous
    call -- the same trick buildSlideNode already plays with `mode` --
    rather than threading a "which deck" parameter through everything
    miniDiagram and buildSlideNode call. There is no second drawing of a
    slide anywhere in this file and this does not become the first.

    The mini diagram first and the real render on demand: drawing forty
    slides twice, fully, to answer "what changed" would take seconds and
    most rows are identical.
    """
    assert "function withDeck(obj,fn){" in out
    assert "try{return fn();}finally{pres=saved;}" in out
    assert "return miniDiagram(side[1]);}));" in out


def test_going_back_is_itself_undoable(out):
    """A snapshot of where you are now is taken BEFORE either restore,
    so the deck you just replaced is in the history too. Verified in a
    browser: after putting a destroyed slide back, the list had gained a
    "before putting a slide back" entry.

    A single slide goes back in place when the deck still has it and
    otherwise at the index it used to hold, which is where you will look
    for it.
    """
    assert "snapTake('before going back')" in out
    assert "snapTake('before putting a slide back')" in out
    assert "function histRestoreSlide(r,then){" in out
    assert "if(r.bi>=0){pres.slides[r.bi]=copy;at=r.bi;}" in out


def test_the_two_histories_do_not_pretend_to_be_each_other(out):
    """A deck is not a file on disk: it lives inside the notebook or the
    project file. So the deck's own history is this local store -- the
    moments BETWEEN commits -- and the repository's history of the file
    it is saved into is the notebook's, which server/vcs.py already
    lists and opens. The panel names that rather than duplicating it.
    """
    assert "class=\"dh-git\"" in out or "git.className='dh-git'" in out
    assert "the moments '" in out
    assert "its Version history menu " in out
