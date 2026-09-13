"""T414: a .junoview file too big for the browser's draft store still opens.

The user, 2026-09-13: "I am trying to open a junoview file from my
computer. it will not open. This is really bad as I have to present
it soon." A deck with a few pasted pictures is bigger than
localStorage will take (about 5 MB), and importDeckText refused to
open it at all -- "There was no room to store them" -- while the one
copy that matters, the file, was in hand the whole time. Reproduced
in Chromium with an 11 MB deck: imported=0, deck hidden. Now the
first deck in the file opens from the object in hand; only the browser
copy is what did not fit, and the toast says so.

Also: the library dialog's "Open a file" goes through the real
file-handle door, a picker failure is said rather than swallowed, and
the dialog opened from an Open door no longer leads with New
presentation / New poster / New folder.
"""

from __future__ import annotations


def test_no_room_in_the_browser_is_not_cannot_open(out):
    assert "      var kept=lsSet(PFX+nm,JSON.stringify(np),true);" in out
    assert ("      if(!silent&&!first){first={name:nm,pres:np,kept:false};"
            "imported++;}") in out
    assert "    } else loadPresentationObj(first.pres);   /* T414 */" in out
    assert "  function loadPresentationObj(np){" in out
    assert "    pres=np;source='draft';" in out
    assert ("      toast('Opened \\u2014 too big for a browser copy, so it "
            "lives in '") in out
    # a file that fits still goes through the draft, as before
    assert ("    if(first.kept){\n"
            "      lsSet(PFX+'last',first.name,true);\n"
            "      loadPresentation(first.name);") in out


def test_the_library_s_open_a_file_uses_the_real_door(out):
    assert "      closePresentationHub();openDeckFile();" in out
    assert "closePresentationHub();var input=$('#deckfile');if(input) input.click();" \
        not in out
    # and a failure is said, not swallowed
    assert "        if(e&&e.name==='AbortError') return;" in out
    assert ("        toast('Could not open that file: '"
            "+((e&&e.message)||e),9000);") in out


def test_open_means_open(out):
    assert "  function openPresentationHub(opts){" in out
    assert "    var create=!!(opts&&opts.create===true);" in out
    assert ("    ['#presentation-hub-new','#presentation-hub-poster',\n"
            "     '#presentation-hub-folder'].forEach(function(id){\n"
            "      var b=$(id); if(b) b.hidden=!create;});") in out
    assert "      openPresentationHub({create:true});" in out


def test_the_readout_names_the_folder_an_autosave_went_into(out):
    assert "          ?(' in your '+deckDirName+' folder'):'');" in out
