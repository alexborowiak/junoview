"""T400: a picture on the clipboard lands on the slide, wherever you are.

The user, 2026-09-13: "Images can't be pasted into junoview as well it
seems." Three ways Ctrl+V with a picture came to nothing: the caret was
in a text box (the handler returned on isContentEditable, and the box's
own paste only knows words); you were on the builder screen (mode
'create'); or the picture was copied as part of a page selection and
travels as text/html with an <img>, not as an image item.
"""

from __future__ import annotations

from junoview import assets


def test_one_reader_for_every_shape_a_picture_arrives_in(out):
    assert "  function clipboardImage(e){" in out
    # an image item, a file, or an <img> inside pasted HTML
    assert "      if(items[i].type&&items[i].type.indexOf('image/')===0){" in out
    assert "    var files=cd.files||[];" in out
    assert ("    var m=html&&html.match(/<img\\b[^>]*\\ssrc=[\"']([^\"']+)[\"']/i);"
            in out)
    assert ("    if(m&&/^(data:image\\/|https?:\\/\\/)/i.test(m[1])) "
            "return {src:m[1]};") in out
    assert "  function pasteClipboardImage(pic){" in out
    assert "    placeImage(pic.src,0,null);" in out


def test_a_paste_while_typing_puts_the_picture_on_the_slide(out):
    start = out.index("  document.addEventListener('paste',function(e){")
    body = out[start:start + 2600]
    assert "    if(deckEl.hidden||mode==='view') return;" in body
    assert "    if(tag==='input'||tag==='textarea') return;" in body
    assert "    var pic=clipboardImage(e);" in body
    assert ("    if(e.target.isContentEditable){\n"
            "      /* T400: a picture pasted while typing goes on the SLIDE") in body
    assert ("      try{e.target.blur();}catch(err){}\n"
            "      pasteClipboardImage(pic);") in body
    # the old early return, which sent the picture to the box, is gone
    assert "e.target.isContentEditable) return;" not in body


def test_a_paste_on_the_builder_screen_opens_the_editor(out):
    start = out.index("  document.addEventListener('paste',function(e){")
    body = out[start:start + 2600]
    assert ("    if(mode==='create'){\n"
            "      /* T400: the builder screen has no canvas") in body
    assert "      setUIMode('edit');\n      pasteClipboardImage(pic);" in body


def test_help_says_so():
    html = assets.load("html/help.html")
    assert "even while you are typing in a" in html
