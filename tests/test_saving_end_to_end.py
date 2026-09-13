"""T416: saving, end to end.

The user, 2026-09-13, after a night of "saved to local" that was not:
"Please make sure all the saving features work - files can be opened;
files save to local properly; when you save it as a name the
presentation name becomes this and vice-versa."

What was wrong. One remembered file handle served every presentation,
so switching decks and autosaving wrote the second deck into the
first deck's file. After a reload, a lapsed write permission flipped
the save target to the browser -- silently, for a deck that only ever
fitted in the file. A deck too big for the draft store could not be
renamed at all. And the standalone HTML export could never be opened
again.

Driven in Chromium with a stubbed File System Access API: Save-as
wrote the deck and renamed it after the file; an autosave wrote the
same file; a rename moved the file; a second deck did not touch the
first deck's file; and a remembered file's deck came back on the next
visit from the file alone.
"""

from __future__ import annotations


def test_a_file_belongs_to_one_presentation(out):
    assert "  var HNKEY='semopts:'+SCOPE+':filefor';" in out
    assert "  var fileFor='',fileHandles={};" in out
    assert "  function bindFile(name,h){" in out
    assert "  function fileSync(){" in out
    # the current deck's file, on every readout
    assert ("    if(typeof fileSync==='function') fileSync();"
            "   /* T416: this deck's file */") in out
    # every door binds rather than assigning the global
    assert "          bindFile(pres.name,h);   /* T416: this deck's file */" in out
    assert "      bindFile(pres.name,h);\n      followFileName();" in out
    assert ("            bindFile(pres.name,h);\n"
            "            if(!fileName) fileName=f.name||'';") in out
    assert ("        bindFile(pres.name,null);\n        fileName=nm;\n"
            "        followFileName();") in out
    assert ("      bindFile(pres.name,null);"
            "   /* T416: this deck, no file yet */") in out
    assert "fileHandle=h;fileName=h.name||'';\n      idbPut(HKEY,h)" not in out


def test_a_lapsed_permission_never_flips_the_target_to_the_browser(out):
    assert "  function rememberedFileBoot(h,forName){" in out
    assert "      if(!ok&&mine&&saveTarget==='file') fileWaits='perm';" in out
    assert ("        if(!ok&&saveTarget==='file'){\n"
            "          saveTarget='browser';") not in out
    assert ("  window.SemDeckFileBoot=rememberedFileBoot;"
            "   /* browser-verification hook */") in out


def test_the_remembered_file_s_deck_comes_back(out):
    assert "  function fileRestore(txt,forName){" in out
    assert "    importDeckText(txt,true);" in out
    assert "    if(!hit||(pres&&pres.name===forName)) return false;" in out
    # from the library when the silent import could keep it there, else
    # from the object in hand
    assert ("    if(deckHas(forName)){lsSet(PFX+'last',forName,true);"
            "loadPresentation(forName);}") in out
    assert ("    else {var np=normPres(hit);np.name=forName;"
            "loadPresentationObj(np);}") in out
    # ...or one click away when the browser will not read it yet
    assert "        fileReopen={h:h,name:forName};" in out
    assert "        if(!deckHas(forName)){fileWaits='reopen';status();}" in out
    assert "      el.textContent='click to reopen '+rf;" in out
    assert "         &&typeof reopenFile==='function'){reopenFile();return;}" in out


def test_the_file_follows_the_name(out):
    assert "    fileRename(old,nm);   /* T416: the file follows the name */" in out
    assert "  function fileRename(old,nm){" in out
    assert "      return h.move(newName).then(function(){" in out
    assert ("      return (h.isSameEntry?h.isSameEntry(oh)"
            ":Promise.resolve(false));") in out
    assert "          return deckDir.removeEntry(oldFile).catch(function(){})" in out
    # a deck whose home is a file is renamed whether or not a draft fits
    assert ("    if(!lsSet(PFX+nm,JSON.stringify(moved),true)"
            "&&saveTarget!=='file'){") in out


def test_the_standalone_html_can_be_opened_again(out):
    # (the closing tag is split, or the inline editor script would end
    # right there -- the page threw "Invalid or unexpected token")
    assert ("        +'<script type=\"application/json\" id=\"junoview-data\">\\n'\n"
            "        +deckFileText().replace(/</g,'\\\\u003c')+'\\n</scr'+'ipt>'\n"
            "        +'</body></html>';") in out
