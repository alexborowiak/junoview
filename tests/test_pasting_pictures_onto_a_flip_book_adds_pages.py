"""T592: every picture pasted onto a selected flip book is a page of it.

The user, 2026-09-30: "You can only paste on image into a flip book.
Would be cool if when selected hitting paste pasted another image into a
flip book."

T408 made a picture from the SYSTEM clipboard a page, but a picture
copied on the canvas (Ctrl+C on it) travels in the deck's own buffer,
and pasting that onto the book dropped a loose copy beside it -- which
took the selection, so every paste after it did the same.

Driven: a picture on the slide copied with Ctrl+C, the book clicked,
Ctrl+V twice -- before, two loose copies and an empty book; after, the
book on page 2 of 2 and still selected, no loose copies.
"""

from __future__ import annotations


def test_copied_pictures_become_pages(out):
    pb = out.split("  function pasteBuf(how,at){")[1].split("\n  }\n")[0]
    assert "var fbi=(!how&&typeof flipSelIdx==='function')?flipSelIdx():null;" \
        in pb
    # only when everything copied is a picture; the original travels
    assert "clipBuf.every(function(c){return c&&c.k==='image'&&c.src;})" in pb
    assert "if(c.okey) fr.okey=c.okey;" in pb
    # it turns to the last page and does not fall through to a plain paste
    assert "fbk.at=fbk.frames.length-1;" in pb
    assert pb.index("return clipBuf.length;") < pb.index("var first=s.annots.length;")


def test_the_system_clipboard_door_is_unchanged(out):
    assert "    if(pasteIntoFlip(pic)) return true;   /* T408 */" in out
