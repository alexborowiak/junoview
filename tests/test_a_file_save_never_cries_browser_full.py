"""T406: a deck whose home is a file is never told the browser is full.

The user, 2026-09-13: "Still getting error that it can't be saved as
browser is full even though rn it is saved to local ... I think the
auto-save is trying to save to browser and not local." Two things. The
draft copy in localStorage is written on every edit whatever the save
target, and its quota toast said "that edit was NOT kept" about a deck
that lives in a file. And an autosave to a file that stands down -- no
file chosen yet, or no write permission since the reload -- stood down
silently, so the readout said "unsaved — saving…" for the rest of the
session and the only visible noise was the toast.
"""

from __future__ import annotations


def test_the_draft_copy_is_quiet_when_the_deck_lives_elsewhere(out):
    assert "  function lsSet(k,v,quiet){" in out
    assert "        if(!quiet&&typeof toast==='function')" in out
    assert ("    var spare=(typeof saveTarget!=='undefined'"
            "&&saveTarget!=='browser');") in out
    assert "    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres),spare);" in out
    # the browser-full readout is still only for a deck kept in the browser
    assert "    if(lsIsFull()&&saveTarget==='browser'){" in out


def test_a_file_autosave_that_stands_down_says_why(out):
    assert "  var fileWaits='';" in out
    assert "      fileWaits='pick';status();" in out
    assert "            fileWaits='perm';status();   /* T406 */" in out
    assert "            fileWaits='';" in out
    assert "        ?'unsaved \\u2014 click Save to choose the file'" in out
    assert ("        :'unsaved \\u2014 click Save to keep writing '"
            "+(fileName||'the file');") in out
