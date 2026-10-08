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


def test_a_blank_line_is_one_blank_line_after_a_redraw():
    """2026-10-08 review: a block editor makes <div><br></div> for a blank
    line and innerText counts it twice, so "Para one", Enter, Enter, "Para
    two" came back with two blank lines (and every extra Enter added two).
    The editor's words are read line by line (htmlLines). Driven: the box
    is 78.8px tall while typing and after the redraw, text
    'Para one\\n\\nPara two'."""
    js = assets.deck_js()
    assert ("  function editorText(el){\n"
            "    return htmlLines(el.innerHTML).map(plainOf).join('\\n');\n"
            "  }") in js
    assert "el.innerText||'').replace(/\\r/g,'')" not in js
    assert js.count("textPageSet(a,n,editorText(el),r.rich?r.html:'');") == 4


def test_a_marker_on_one_line_lists_only_that_line():
    """2026-10-08 review: a revisited plain box is one text node with hard
    \\n lines, and the browser's list command ran from the caret's line to
    the end of the node -- "1. " before the second of four lines made one
    item of the last three. The caret's line is cut into a node of its own
    first. Driven: only "Buy milk" numbered; "- " on the first line
    bullets only "Intro"; a marker on a new last or middle line lists
    only that line."""
    js = assets.deck_js()
    h = js.split("    el.addEventListener('input',function(e){\n"
                 "      if(!el.isContentEditable) return;\n"
                 "      /* a marker TYPED", 1)[1].split("\n    });\n", 1)[0]
    assert "if(e&&e.inputType&&e.inputType!=='insertText') return;" in h
    assert h.index("var s5=window.getSelection(),t5=s5.focusNode") \
        < h.index("listSelection(/^1/.test(m4[1])?'number':'bullet');")


def test_lists_deeper_in_a_box_are_spaced_and_levelled_alike():
    css = assets.deck_css()
    assert (".an-tx:not(.an-ul) div>ul,.an-tx:not(.an-ul) div>ol{"
            "margin:.18em 0;\n  padding-left:1.7em;}") in css
    assert ".an-tx:not(.an-ul) ol ol,\n.an-tx:not(.an-ul) ul ol{" in css
    assert ".an-tx:not(.an-ul)>ol ol" not in css
