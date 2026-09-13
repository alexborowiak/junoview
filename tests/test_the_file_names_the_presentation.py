"""T398: saving to a file renames the presentation after the file.

The user, 2026-09-13: "Saving the presentation as a file name, doesn't
change the name in junoview." Save as "my talk.junoview.html" and the
deck went on being called "presentation-5" in the rail, the bar and the
project file. The stem of the file you pick becomes the presentation's
name, by the one rename everything else uses.
"""

from __future__ import annotations


def test_the_picked_files_stem_becomes_the_name(out):
    assert "  function fileStem(name){" in out
    assert "    return String(name||'').replace(/\\.junoview\\.html$/i,'')" in out
    assert "      .replace(/\\.(html|junoview|json)$/i,'').trim();" in out
    assert "  function followFileName(){" in out
    assert ("    if(!stem||stem===pres.name) return false;\n"
            "    return renamePresentation(stem);") in out
    # called from the picker, before the handle is handed back
    assert ("      idbPut(HKEY,h).catch(function(){});\n"
            "      followFileName();\n      return h;") in out


def test_the_file_written_carries_the_new_name(out):
    """saveToFile renders the file's text BEFORE the pick; a rename during
    the pick would otherwise write the old name into the new file."""
    assert ("        if(pres.name!==savedName){\n"
            "          savedName=pres.name||'untitled';savedSig=deckSaveSig(pres);\n"
            "          fileText=junoviewFileHtml();\n"
            "        }") in out
