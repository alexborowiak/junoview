"""T408: a picture pasted onto a selected flip book is a page of it.

The user, 2026-09-13: "I wish you could paste images into a flip
book." With a book selected, Ctrl+V dropped the picture on top of the
book as a loose image. Now it goes in as the last page and the book
turns to it, the same way "+ Pictures…" adds one; with no book
selected the picture lands on the slide as before (T400).
"""

from __future__ import annotations


def test_the_paste_door_asks_the_flip_book_first(out):
    assert "  function pasteIntoFlip(pic){" in out
    assert ("    var bi=(typeof flipSelIdx==='function')"
            "?flipSelIdx():null;") in out
    assert "    if(bi===null) return false;" in out
    assert "    if(pasteIntoFlip(pic)) return true;   /* T408 */" in out
    # ...and only then does the loose-image path run
    assert ("    if(pasteIntoFlip(pic)) return true;   /* T408 */\n"
            "    if(pic.file) return pasteImageFile(pic.file);") in out


def test_every_kind_of_clipboard_picture_becomes_a_page(out):
    # a file, a data: URL (read as a blob), and a picture at an address
    assert "    if(pic.file) flipAddFiles(bk,[pic.file],said);" in out
    assert "        .then(function(b){flipAddFiles(bk,[b],said);})" in out
    assert "      bk.frames.push({src:pic.src});" in out
    assert "      bk.at=bk.frames.length-1;" in out
    assert ("      toast(n?('Pasted as page '+flipFrames(bk).length"
            "+' of the flip '") in out


def test_the_file_door_and_the_paste_door_share_one_reader(out):
    """The "+ Pictures…" input used to hold the reader inline; a second
    copy for paste would be the fourth door forgetting keepOriginal
    all over again (T58)."""
    assert "  function flipAddFiles(a,list,done2){" in out
    assert "      flipAddFiles(a,Array.prototype.slice.call(files));" in out
    assert "            keepOriginal(got[i],rd.result);" in out
    assert "      if(done2) done2(n);" in out
