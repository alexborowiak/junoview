"""Lists stay lists when you come back to them (T609).

"There are issues with the auto-formatting with dot points and numbers
again. It seems like if you click away and click back in it forgets that
it should be auto-number etc." A list that was not the whole box -- made
by the List button while typing, by "1. " on a later line, or typed out
of -- kept its <ol> in the box's html, and the box was drawn for editing
as a <span>. Chromium makes no paragraphs inside a span editing host:
Enter is a line break, which pre-wrap writes as a bare "\\n", inside an
<li> too, so "three" became a second line of "two", unnumbered, the first
time the box was drawn again (a slide change, a reload). The editor is a
block now, as the whole-box list's already was (T513).

Driven at 1366x657: "1. one", Enter, "two", Enter, Enter, "After the
list", click away, next slide and back (and a reload), double-click the
end of "two", Enter, "three": a third numbered item, where before it was
"two\\nthree" in one item.
"""

from __future__ import annotations

from junoview import assets


def test_the_editor_is_a_block_and_the_show_keeps_its_span(out):
    assert "tx2=document.createElement((editing&&!a.md)?'div':'span');" \
        in out
    # the whole-box list's own block editor (T513) is still there
    assert "an-list-edit" in out


def test_a_rich_box_splits_into_lines_whatever_the_editor_left():
    js = assets.deck_js()
    assert "  function htmlLines(html){" in js
    lines = js.split("  function contentLines(a){", 1)[1].split(
        "\n  }\n", 1)[0]
    assert "return htmlLines(a.html);" in lines
    body = js.split("  function htmlLines(html){", 1)[1].split(
        "\n  }\n", 1)[0]
    # a <br>, a hard \n and a block each begin a line
    assert "if(c.tagName==='BR'){hard();continue;}" in body
    assert "String(c.nodeValue).split('\\n')" in body
    assert "BLOCK=/^(DIV|P|UL|OL|LI|H[1-6]|BLOCKQUOTE|PRE)$/" in body


def test_a_list_made_on_a_later_line_is_spaced_like_the_others():
    css = assets.load("css/deck.css")
    assert ".an-tx>div>ul,.an-tx>div>ol{margin:.18em 0;padding-left:1.7em;}" \
        in css
