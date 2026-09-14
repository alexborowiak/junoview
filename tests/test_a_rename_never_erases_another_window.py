"""A rename or a delete honours the project's revision (T451).

Found while driving T450: the library's delete took a 409 from
/api/save, which is the server refusing a write that has not seen
another window's changes. Following it back, `saveProject` -- the one
helper a rename and a delete both write through -- posted the whole
project list with NO `rev` at all and swallowed every error.

The server reads a missing `rev` as "do not check" (that is what an old
page still open in a tab sends), so the one thing the revision was
added for in 2026-08-22 -- a second window creating a deck while this
one writes -- was still broken through this door: renaming or deleting
anything erased that deck without a word.
"""

from __future__ import annotations


def test_the_helper_sends_the_revision_and_says_what_it_is_for(out):
    """`change` describes the write's intent, so a conflict can re-apply
    the same intent to the list the other window wrote instead of
    losing it or flattening them."""
    assert "  function saveProject(change){" in out
    assert "    if(APP.mode!=='app') return Promise.resolve(false);" in out
    assert ("      {presentations:embedAssets(deep(projectPres)),"
            "rev:projectRev})") in out
    assert "        if(j&&typeof j.rev==='number') projectRev=j.rev;" in out
    # the two intents, one per writer
    assert "  function projectApply(list,change){" in out
    assert ("      return list.filter(function(p){"
            "return !p||p.name!==change.drop;});") in out
    assert "        if(p&&p.name===change.from) p.name=change.to;" in out
    assert "    saveProject({drop:nm});" in out
    assert out.count("    saveProject({from:old,to:nm});") == 2


def test_the_conflict_retry_writes_their_list_not_ours(out):
    """Their list is the embedded form and projectPres is not, so the
    retry must post THEIR list with this window's change re-applied --
    posting projectPres again is the 2026-08-22 bug that stripped every
    embedded figure."""
    assert "        if(!(e&&e.status===409&&e.data&&Array.isArray(" in out
    assert "        projectRev=e.data.rev;" in out
    assert "        var merged=projectApply(e.data.presentations,change);" in out
    assert "        return APP.api('/api/save',{presentations:merged," in out


def test_the_window_learns_the_decks_it_had_never_heard_of(out):
    """Resolving the conflict once is not enough. The retry wrote the
    other window's deck back, but projectPres still did not contain it
    -- so the next full-list write from this tab, with the revision now
    caught up and nothing left to refuse it, erased it for good. They
    come in through normPres, the boot list's own door, so nothing
    carries `emb` into projectPres.
    """
    assert "  function adoptUnknownPresentations(theirs){" in out
    assert ("    projectPres.forEach(function(p){"
            "if(p&&p.name) known[p.name]=1;});") in out
    assert "      if(!p||!p.name||known[p.name]) return;" in out
    assert ("      known[p.name]=1;projectPres.push(normPres(deep(p)));n++;"
            ) in out
    assert "        adoptUnknownPresentations(merged);" in out
