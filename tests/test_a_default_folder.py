"""Saving is local by default, into a folder you pick once (T235).

The user, 2026-09-04: "the save to browser thing isn't working to great
I think. Like I just go 'browser full' error. Is there a way to make it
so that there is a way so the default is local, and you can set-up a
default save to location that becomes the defaults for all?"

Driven with a stubbed directory picker: choosing a folder made
`<deck name>.junoview.html` in it, wrote a real Junoview file, switched
the destination to "Your Talks folder", and every autosave after that
wrote the file with no dialog ("autosaved to flipcheck.junoview.html").
Forgetting the folder put the row back and cleared the stored name.
"""

from __future__ import annotations

from junoview import assets


def test_the_folder_is_remembered_like_the_file(out):
    assert "  var DKEY='deckdir:'+SCOPE;" in out
    assert "  var DNKEY='semopts:'+SCOPE+':savedirname';" in out
    assert "  var canPickDir=!!window.showDirectoryPicker;" in out
    assert "  var deckDir=null,deckDirName=lsGet(DNKEY)||'';" in out
    assert "  function pickSaveFolder(){" in out
    assert ("    return window.showDirectoryPicker({mode:'readwrite',\n"
            "      id:'junoview-decks'}).then(function(d){") in out
    assert "      idbPut(DKEY,d).catch(function(){});" in out
    # ...and restored on the next visit
    assert "    idbGet(DKEY).then(function(d){" in out
    assert "      return permReadOK(d).then(function(ok){" in out


def test_a_remembered_folder_makes_local_the_default(out):
    """That is the whole ask: not one more place you can save to, but the
    place everything saves to from then on."""
    assert "        if(saveTarget==='browser') setTarget('file');" in out


def test_junoview_makes_its_own_file_in_there(out):
    assert "  function deckFileName(){" in out
    assert "    return (n||'presentation')+'.junoview.html';" in out
    assert "  function folderFile(silent){" in out
    assert "      return deckDir.getFileHandle(deckFileName(),{create:true})" in out
    # the handle source: the one it has, else the folder, else ask
    assert ("    var op=(fileHandle?Promise.resolve(fileHandle)\n"
            "      :(deckDir?folderFile(silent)\n"
            "        :(silent?Promise.resolve(null):pickSaveFile())))") in out
    # an autosave can now mint a file, but still never opens a dialog
    assert ("    if(!fileHandle&&!deckDir&&silent)"
            " return Promise.resolve(false);") in out
    assert ("    return (silent?permOK(deckDir):permAsk(deckDir))"
            ".then(function(ok){") in out


def test_a_new_folder_drops_the_old_file(out):
    """Otherwise the next save writes the file you just moved away from."""
    assert ("        fileHandle=null;fileName='';\n"
            "        idbDel(HKEY).catch(function(){});\n"
            "        setTarget('file');") in out


def test_the_menu_names_the_folder_and_can_undo_it():
    html = assets.deck_html()
    assert 'id="tg-folder"' in html and 'id="tg-folder-forget"' in html
    out = assets.deck_js()
    assert "        ?('Folder: '+deckDirName+' \\u2014 change\\u2026')" in out
    assert "        :'A folder on this computer\\u2026';" in out
    assert ("    var ff=$('#tg-folder-forget');\n"
            "    if(ff) ff.hidden=!deckDirName;") in out
    assert "      deckDir=null;deckDirName='';" in out
    assert "      lsDel(DNKEY);idbDel(DKEY).catch(function(){});" in out
    # the destination readout names it, since that is the useful half
    assert "      return deckDirName?('Your '+deckDirName+' folder')" in out


def test_the_full_browser_names_the_fix(out):
    """It said what had gone wrong and offered a one-off download; the
    thing that stops it happening again is the folder."""
    assert ("      toast('NOT saved \\u2014 this browser is full. "
            "The \\u25be beside '") in out
    assert ("        +'Save \\u203a \"A folder on this computer\" "
            "keeps every '") in out
