"""T447: a renamed presentation stops writing the file with the old name.

The user, 2026-09-14: "autosaved to project.junovie... Changed file
name, but it still says it is saving to the above. Why?????? How to
get around this??? This is so annoying."

Where the browser cannot move a picked file -- Chrome cannot -- the
deck went on autosaving into the file with the OLD name, and an
eight-second toast was the only clue. Now the binding is dropped on
such a rename: the old file keeps what it had under its old name, the
readout says "unsaved -- click Save to choose the file", and the next
Save asks where to write the new name. Junoview's own folder still
renames the file outright, and a browser that can move one still
does.

Driven live with a fake file system that refuses moves: after Save to
talkA.junoview.html and a rename to talkRenamed, the readout asked for
the file, and the next Save picked talkRenamed.junoview.html.
"""

from __future__ import annotations


def test_the_old_file_is_let_go(out):
    fn = out.split("  function fileRename(old,nm){")[1].split("\n  }")[0]
    assert "    function say(){\n      fileHandles[nm]=null;" in fn
    assert "      if(fileFor===nm){fileHandle=null;fileName='';}" in fn
    assert "      if(saveTarget==='file') fileWaits='pick';" in fn
    assert ("      toast('Renamed to \\u201c'+nm+'\\u201d. '+oldFile+' keeps "
            "the old '") in fn
    assert "Still writing " not in out
