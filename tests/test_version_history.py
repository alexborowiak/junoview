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
    assert "function histKeyFor(name){" in out
    assert "return 'dhist:'+SCOPE+':'+(name||'untitled');" in out
    assert "function histVKeyFor(name,id){return histKeyFor(name)+':'+id;}" \
        in out
    assert "function snapWrite(cap,ix,why){" in out
    assert "function idbDel(k){" in out
    assert "var HIST_KEEP=20,histOps=Promise.resolve();" in out


def test_the_same_snapshot_rule_the_notebook_uses(out):
    """One when you open it, one on every explicit save, deduped when
    nothing changed, capped. A history that records the same deck nine
    times cannot be read, and the dedupe is what makes "open, look,
    close" cost nothing.

    The old record is deleted only AFTER the index stops naming it, so a
    crash between the two leaves an orphan rather than a listed snapshot
    that cannot be opened.
    """
    # T127 gates the opening snapshot on the stored head pointer, so a
    # reload's first entry descends from where you actually were
    assert "snapTake('opened',undefined,histSeed());" in out
    # Browser Save captures before writing, and records only beyond its
    # failed-write return. The pointer write is deliberately best-effort.
    browser = out[out.index("if(saveBtn) saveBtn.addEventListener"):
                  out.index('/* ---- the "Saved to" picker')]
    assert browser.index("var savedHist=histCapture();") < \
        browser.index("var ok=lsSet(")
    assert browser.index("if(!ok){") < \
        browser.index("if(savedHist) snapTake('saved',savedHist);")
    assert "if(ok){\n      try{localStorage.setItem(PFX+'last'" in browser
    # Project and file saves enqueue a captured snapshot immediately, but
    # its success promise gates the write. silent autosaves capture none.
    project = out[out.index("function saveToProject(silent,embed){"):
                  out.index("/* one conflict notice per settling period")]
    project_result = out[out.index("function projectSaved("):
                         out.index("function saveToProject(")]
    assert "var exact=stillSaved(savedName,savedSig);" in project_result
    assert project_result.index("if(exact){") < \
        project_result.index("projectPres=next;")
    assert "var savedHist=!silent?histCapture():null;" in project
    assert project.count("return projectSaved(") == 2
    # A delayed conflict reconciles the click-time deck even if the live
    # presentation was renamed while the first request was in flight.
    assert "p.name!==savedName" in project
    assert "p&&p.name===savedName" in project
    assert "p.name!==pres.name" not in project
    assert "if(savedHist) snapTake('saved',savedHist,op);" in project
    file_save = out[out.index("function saveToFile(silent){"):
                    out.index("/* WHERE it goes, never WHICH file")]
    assert "var savedHist=!silent?histCapture():null;" in file_save
    assert file_save.index("return w.close();") < \
        file_save.index("if(savedHist) snapTake('saved',savedHist,op);")
    autosave = out[out.index("function scheduleAutosave(){"):
                   out.index("/* always-visible Save button")]
    assert "snapTake(" not in autosave
    assert "if(prev===cap.txt) return false;" in out
    i = out.index("return idbPut(histKeyFor(cap.name),next);")
    assert "idbDel(histVKeyFor(cap.name,d.id))" in out[i:i + 500]


def test_snapshot_transactions_capture_identity_and_are_serial(out):
    """Nothing inside a delayed write may rediscover the live deck name,
    text, or slide count. The complete read/dedupe/write operation is one
    queue entry, so rapid saves cannot overwrite each other's index."""
    capture = out[out.index("function histCapture(){"):
                  out.index("function snapTake(")]
    assert "name:pres.name||'untitled',txt:histText()" in capture
    assert "n:pres.slides.length" in capture
    take = out[out.index("function snapTake("):
               out.index("function snapRead(")]
    assert "return histRun(function(){" in take
    assert "histIndexAt(cap.name)" in take
    assert "histVKeyFor(cap.name" in take
    write = take[take.index("function snapWrite("):]
    assert "pres." not in write
    assert "n:cap.n,len:cap.txt.length" in write


def test_history_moves_with_a_rename_without_breaking_old_records(out):
    """Copy records, publish the new index, then remove the old namespace.
    A crash may leave unlisted orphans, but never a listed missing record."""
    move = out[out.index("function histRename(oldName,newName){"):
               out.index("/* run something with a DIFFERENT deck")]
    record_put = move.index("idbPut(histVKeyFor(newName,ent.id),txt)")
    index_put = move.index("idbPut(histKeyFor(newName),next)")
    old_index_del = move.index("idbDel(histKeyFor(oldName))")
    old_record_del = move.index("idbDel(histVKeyFor(oldName,ent.id))")
    assert record_put < index_put < old_index_del < old_record_del
    assert "return histRun(function(){" in move
    assert "histRename(old,nm);" in out


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
    full = out[out.index("function histFullSlides("):
               out.index("function histCompare(")]
    assert "btn.innerHTML=bic('expand')+' Show full slides';" in full
    assert "btn.setAttribute('aria-expanded','false');" in full
    assert "return buildSlideNode(side[3],true);" in full
    assert full.index("withDeck(side[2]") < \
        full.index("return buildSlideNode(side[3],true);")
    assert "node.setAttribute('inert','');" in full
    assert ".dh-full{grid-column:2/4;" in out
    assert ".dh-fullframe .slide{" in out and "pointer-events:none;" in out
    assert ".dh-row.st-same.dh-open{opacity:1;}" in out


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


def test_whole_history_restore_replaces_the_whole_deck(out):
    """A whitelist drifts whenever normPres grows. Replace the object so
    all saved keys return, absent keys disappear, and histReset installs
    the restored custom types before this becomes a new draft."""
    # T90 gave it two more parameters -- where in the TREE this puts the
    # live deck -- so the signature is matched by its stem.
    restore = out[out.index("function histRestoreDeck(then"):
                  out.index("function openHistory(){")]
    assert "function histRestoreDeck(then,fromId,branch){" in out
    assert "copy.name=pres.name;" in restore
    assert "pres=copy;" in restore
    assert restore.index("pres=copy;") < restore.index("histReset();")
    assert restore.index("histReset();") < restore.index("markDirty();")
    assert "pres.slides=copy.slides" not in restore
    assert "activePane=-1" in restore and "deckZoom=0" in restore


def test_saved_custom_types_are_safe_during_early_normalisation(out):
    """projectPres normalises before the boot sequence and before the
    style-registry fragment's initialisers. Its built-in-id guard therefore
    has to exist before normPres, or merely opening a saved custom type
    aborts the assembled editor before any hook is exported."""
    ids = "var BUILTIN_STYLE_IDS=["
    assert out.index(ids) < out.index("function normPres(p,stem){")
    assert out.count(ids) == 1
    assert "var STYLE_ORDER=BUILTIN_STYLE_IDS.slice();" in out


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

# ---------------------------------------------------------------------------
# branches (T90)
# ---------------------------------------------------------------------------

def test_a_snapshot_records_which_one_it_descends_from(out):
    """A history was a LIST: going back to an older version and carrying
    on quietly rewrote what "before" meant. A parent makes it a tree."""
    assert "var histHead=null;" in out
    assert "if(histHead) ent.p=histHead;" in out
    assert "if(histBranch) ent.br=histBranch;" in out
    # absent-is-default, so a history written before branches reads as
    # a trunk and is right
    assert "ent.p=histHead" in out and "ent.p=histHead||''" not in out
    assert "histHead=id;" in out


def test_going_back_to_a_version_moves_you_there_in_the_tree(out):
    """Otherwise the next save claims to descend from work it has
    nothing to do with -- which is the whole defect branching fixes."""
    assert "function histRestoreDeck(then,fromId,branch){" in out
    assert "if(fromId!==undefined) histHead=fromId||null;" in out
    assert "histRestoreDeck(then,ent.id,ent.br||'')" in out


def test_evicting_the_oldest_snapshot_splices_rather_than_severs(out):
    """THE load-bearing line. HIST_KEEP still drops the oldest entry, and
    on a tree the oldest can be one that others descend from -- so every
    child of a dropped entry is re-pointed at that entry's own parent
    before it goes. Without it, half a history becomes rows pointing at
    an id that is not there.
    """
    drop = out[out.index("var drop=next.length>HIST_KEEP"):]
    drop = drop[:drop.index("return idbPut(histVKeyFor")]
    assert "drop.forEach(function(d){" in drop
    assert "if(e2.p===d.id){" in drop
    assert "if(d.p) e2.p=d.p; else delete e2.p;" in drop


def test_an_orphan_reads_as_a_root_rather_than_a_lost_row(out):
    """What an evicted ancestor looks like from the rail. It also stops a
    hand-edited store's cycle from overflowing the stack inside a panel.
    """
    assert "function histDepths(ix){" in out
    assert "var d=(!p||guard>HIST_KEEP)?0:of(p,guard+1)+1;" in out


def test_a_different_deck_starts_on_its_own_trunk(out):
    """Carrying the head across would parent the new deck's first
    snapshot onto the old deck's tree."""
    load = out[out.index("function loadPresentation(name){"):]
    load = load[:load.index("function ")+400]
    assert "histHead=null;histBranch='';" in load



# ---------------------------------------------------------------------------
# the branch survives a reload (T127)
# ---------------------------------------------------------------------------
#
# Driven live 2026-08-31: branch "reload-branch" started, the page fully
# reloaded, and the reopened history read "on reload-branch" with "you
# are here" on the right snapshot -- where before the fix the chip
# reverted to "on main" and the next save founded a parentless root.
# The raw IndexedDB pointer was read back directly: {h:<head id>,
# br:"reload-branch"}. A fresh deck's opened+saved snapshots still
# parent correctly through the gated path, and the dedupe still refused
# two identical-content saves during the same run.


def test_where_you_are_in_the_tree_is_stored_beside_the_index(out):
    """histHead/histBranch were runtime variables and nothing else: a
    reload forgot both, and the next save quietly fractured the tree
    T90 exists to keep."""
    assert "function histPtrKey(name){return histKeyFor(name)+':head';}" in out
    assert "function histPtrSave(name){" in out
    assert "function histSeed(){" in out
    # every writer persists: a new snapshot, and a restore/branch jump
    assert "return histPtrSave(cap.name);   /* the head moved (T127) */" in out
    assert ("if(fromId!==undefined||branch!==undefined) "
            "histPtrSave(pres.name);") in out


def test_the_seed_validates_and_falls_back_to_the_tip(out):
    """The pointed-at snapshot can have been evicted, and a history from
    before the pointer existed has none at all -- the tip is the old
    linear assumption and REPAIRS the story rather than re-rooting it.
    And a deck switched mid-read must not inherit the old deck's
    pointer, which is the exact cross-parenting loadPresentation's
    reset guards against."""
    assert "if(!pres||pres.name!==name) return false;" in out
    assert "var tip=ix[ix.length-1];" in out
    assert "histHead=tip.id;histBranch=tip.br||'';" in out


def test_the_opening_snapshot_waits_for_the_seed(out):
    """snapTake's ready-gate already existed for the save path; the
    opened snapshot now rides it too, so a reload's first entry descends
    from where you actually were."""
    assert "snapTake('opened',undefined,histSeed());" in out


def test_a_rename_carries_the_pointer_with_its_history(out):
    assert "return idbGet(histPtrKey(oldName)).then(function(ptr){" in out
    assert "if(ptr) return idbPut(histPtrKey(newName),ptr);" in out
    assert "return idbDel(histPtrKey(oldName)).catch(function(){});" in out
