"""Duplicate, rename and delete on a library row (T450).

The user, 2026-09-14: "you can't duplicate a presentation or delete it
from the main menu, there is very little controls."

T448 put those verbs on the open-items bar. The library dialog is the
menu the user actually named, and it listed everything you own while
letting you do nothing to any of it but open it.
"""

from __future__ import annotations


def test_a_library_row_carries_four_verbs(out):
    """The pin was the only one. Duplicate, rename and delete join it,
    built the same way -- spans with role="button", because the row
    itself IS a button and a button inside a button is not a thing."""
    assert "  function hubRowAct(row,icon,label,run){" in out
    assert "    s.className='presentation-hub-act';" in out
    assert "    s.setAttribute('role','button');s.tabIndex=0;" in out
    assert "    function go(e){e.stopPropagation();e.preventDefault();run();}" in out
    # the smart quotes after these are written as \u escapes in the
    # source, so match only as far as the ASCII goes
    for verb in ("hubRowAct(b,'copy','Duplicate ",
                 "hubRowAct(b,'text','Rename ",
                 "hubRowAct(b,'minus','Delete "):
        assert verb in out, verb
    # the row's own click must still be the only thing that OPENS it
    assert "      var made=duplicatePresentation(p.name);" in out
    assert "      if(!window.confirm('Delete " in out
    # ...and both lists repaint, because the bar and the library show
    # the same presentations under different headings
    assert ("      if(typeof renderDeckPresentationDrawer==='function')\n"
            "        renderDeckPresentationDrawer();") in out


def test_the_verbs_wait_until_you_point_at_the_row(out):
    """The library is a list you read before it is a list you act on,
    so three more icons must not be shouting on every row at once."""
    assert ".presentation-hub-act{flex:none;width:20px;height:20px;" in out
    assert "  color:var(--chrome-ink-2);opacity:0;cursor:pointer;" in out
    assert (".presentation-hub-row:hover .presentation-hub-act,\n"
            ".presentation-hub-act:focus{opacity:.8;}") in out


def test_renaming_one_you_are_not_in(out):
    """The library lists every saved presentation, not just the one on
    screen, so its rename cannot be renamePresentation -- that one moves
    `pres`. The deck on screen still goes through it (only it carries
    the unflushed edits, the dirty mark and the title bar); everything
    else makes the same moves without them."""
    assert "  function renamePresByName(old,nm){" in out
    assert "    if(pres&&pres.name===old) return renamePresentation(nm);" in out
    # the same collision guard as the live rename
    assert ("    var taken=allSaved().map(function(p){return p.name;})\n"
            "      .concat(draftNames());") in out
    # the draft moves under the new key before the old one is dropped
    assert "      if(!draftSet(nm,raw,true)){" in out
    assert "      draftDel(old);" in out
    # and everything that is matched BY NAME follows
    assert "    projectPres.forEach(function(p){if(p.name===old) p.name=nm;});" in out
    assert "    nbPres.forEach(function(p){if(p.name===old) p.name=nm;});" in out
    assert "    histRename(old,nm);" in out
    assert "      renameRememberedPresentation(old,nm);" in out
    assert "      renameOpenPresentation(old,nm);" in out
    assert "    fileRename(old,nm);" in out
    assert "  window.SemDeckRename=renamePresByName;" in out
