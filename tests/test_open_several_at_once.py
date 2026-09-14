"""T436: several notebooks or presentations open at once.

The user, 2026-09-14: "the ability to open multiple notebook/
presentations at once would be a slay out of 10."

The .junoview picker and its <input> fallback take many files and
open them one after another (each single-deck file binding to the
deck it opened, the last one on screen); the app's folder listing
opens a notebook and keeps the list up on Ctrl+click, so the next one
is a click away; and a Ctrl+click on a library row puts that
presentation on the open list without leaving the dialog. The
notebook <input> already took many (webOpenFiles).

Driven live with a fake picker handing back two files: both decks
landed, the toast said "Opened 2 files", the second was on screen.
"""

from __future__ import annotations


def test_the_deck_doors_take_many(out):
    assert "  function openDeckHandles(hs){" in out
    assert "        multiple:true\n      }).then(function(hs){" in out
    assert "        return openDeckHandles(hs);" in out
    assert ("        toast('Opened '+opened+' files \\u2014 each presentation "
            "saves '") in out
    assert ('<input type="file" id="deckfile" accept=".junoview,.json,.html" '
            'multiple hidden>') in out
    assert "        return chain.then(function(){return openDeckInputFile(f);});" \
        in out


def test_the_folder_listing_keeps_up_on_a_modifier_click(out):
    assert "  function openPath(path,keep){" in out
    assert "      if(!keep) hideDlg();" in out
    assert ("        b.addEventListener('click',function(e){\n"
            "          openPath(n.path,e.ctrlKey||e.metaKey||e.shiftKey);});"
            ) in out


def test_a_modifier_click_on_a_library_row_adds_to_the_open_list(out):
    assert "      if(e&&(e.ctrlKey||e.metaKey||e.shiftKey)){" in out
    assert "        noteSessionOpen(p.name);\n        renderPresTabs();" in out
    assert "' \\u2014 Ctrl+click to add it to the open list and stay here';" in out
