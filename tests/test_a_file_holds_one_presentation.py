"""T433: a .junoview file holds one presentation.

The user, 2026-09-14: "The files on local keep seeming to just save to
project junoview. Even though that is not the file name which gets
confusing. Then project junoview doesn't appear in the list of
recently opened files."

A saved file used to carry EVERY deck the tab knew about, named after
the one on screen. Opening such a file brought all of them back under
minted names ("talk-2", "talk-3", one more each open), the handle was
bound to whichever deck came first, and Save from that deck wrote the
whole library into a file whose name was not its own. Now a file holds
the deck it was saved from; a file of a deck that is already here,
unchanged, opens that deck instead of minting a copy; a file of
several decks (a bundle from before) goes into the library without
binding to any of them; and a single-deck file's stem names the deck
through the Open door too, as T398 already did for the picked file.

Driven live with a fake File System Access API: Save wrote a file of
one deck; opening it again minted nothing; a two-deck bundle opened
twice left the library at the same two names, unbound.
"""

from __future__ import annotations


def test_the_file_is_this_deck_only(out):
    assert "  function filePresentations(){" in out
    assert ("      presentations:embedAssets(plainIfSingle("
            "filePresentations()))},") in out
    assert "    var list=plainIfSingle(filePresentations());   /* T433" in out
    assert "    var name=esc(pres.name||APP.order[0]||'presentation');" in out
    assert "plainIfSingle(mergedPresentations())" not in out
    # the project file is still the whole library
    assert "    var merged=mergedPresentations();" in out


def test_the_same_deck_is_not_a_new_deck(out):
    assert "  function sameDeck(have,np){" in out
    assert ("      if(clash&&sameDeck((pres&&pres.name===nm)?pres:clash,np)){"
            ) in out
    assert "  function fileDeckCount(txt){" in out


def test_a_bundle_opens_into_the_browser_unbound(out):
    assert "  function bundleOpened(n,name){" in out
    assert "            if(bundleOpened(n,f.name||'')) return;" in out
    assert "        if(bundleOpened(n,nm)) return;   /* T433 */" in out
    # ...and a remembered one is let go before an autosave can shrink it
    assert "  function dropBundleHandle(txt,forName){" in out
    assert "    if(dropBundleHandle(txt,forName)) return false;" in out
    assert ("          if(fileDeckCount(txt)>1){dropBundleHandle(txt,nm);"
            "return true;}") in out


def test_the_opened_file_names_the_deck(out):
    # (T436 moved the per-file work into openDeckHandles)
    fn = out.split("  function openDeckHandles(hs){")[1].split("\n  }")[0]
    assert "            followFileName();" in fn
