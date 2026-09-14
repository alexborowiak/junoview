"""T430: a file of a deck that is already here asks, once.

Opening an older file of "talk" silently minted "talk-2" and put it on
the screen, so the old version appeared to have replaced the current
one -- the user, 2026-09-14: "when I clicked save, everything got
reverted back to before the save." One confirm: OK replaces the copy
in this browser with the file's version, Cancel keeps both under a new
name. A silent boot restore and a file holding several decks never ask.

Driven live: accepting left one "clashdeck" holding the file's version;
declining opened it as "clashdeck-2" beside the original.
"""

from __future__ import annotations


def test_the_one_question(out):
    fn = out.split("  function importDeckText(txt,silent){")[1].split("\n  }")[0]
    assert "      var clash=(savedByName(nm)||draftGet(nm));" in fn
    assert "      if(clash&&!silent&&list.length===1){" in fn
    assert ("        var replace=window.confirm('\\u201c'+base"
            "+'\\u201d is already in '\n"
            "          +'this browser.\\n\\nOK replaces it with the "
            "file\\u2019s version.'") in fn
    assert ("        if(replace){\n"
            "          np.name=nm;\n"
            "          draftSet(nm,JSON.stringify(np),true);") in fn
    # the keep-both path is the old one, unchanged
    assert ("      while(savedByName(nm)||draftGet(nm)){\n"
            "        k++;nm=base+'-'+k;\n"
            "      }") in fn
