"""T434: closing with changes that are not saved yet asks first.

The user, 2026-09-14: "you can close things if they are not saved
which is an issue. If there are unsaved changes it needs to warn you
before closing."

The browser copy is written as you type, so inside this browser
nothing is lost -- but a deck whose home is a file or the project file
has changes that are not THERE until the next Save or autosave lands,
and a full browser keeps nothing at all. Closing the tab or reloading
raises the browser's own leave-site prompt in those cases; closing the
deck's row in the rail asks, and OK saves first. A deck merely opened
this visit never asks (editsThisVisit).

Driven live with a fake File System Access API: after a Save and a
nudge, the rail's x asked "has changes not yet saved to
talkA.junoview.html", OK wrote the file a third time and closed the
row; a reload after the same nudge raised beforeunload.
"""

from __future__ import annotations


def test_only_work_done_here_can_be_unsaved(out):
    assert "  var editsThisVisit=false;" in out
    assert "    source='draft';editsThisVisit=true;" in out
    fn = out.split("  function unsavedWhere(){")[1].split("\n  }")[0]
    assert "    if(!pres||!pres.slides||!editsThisVisit) return '';" in fn
    assert ("    if(saveTarget==='file') return source==='draft'"
            "?(fileName||'a file'):'';") in fn
    assert "    return draftsFull()?'nowhere':'';" in fn


def test_the_tab_and_the_rail_both_ask(out):
    assert "  window.addEventListener('beforeunload',function(e){" in out
    assert "    if(!unsavedWhere()) return;\n    e.preventDefault();" in out
    fn = out.split("  function closeGuard(nm){")[1].split("\n  }")[0]
    assert ("    if(!window.confirm('\\u201c'+nm+'\\u201d has changes not "
            "yet saved to '") in fn
    assert "    return saveNow().then(function(ok){" in fn
    # Both rail and top-tab close buttons use the shared guarded path.
    assert ("      var go=(isCur&&typeof closeGuard==='function')\n"
            "        ?closeGuard(nm):Promise.resolve(true);") in out
    assert "        if(isCur&&!deckEl.hidden) closeDeck();" in out
