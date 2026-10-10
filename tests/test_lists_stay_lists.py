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

T623 (2026-10-10) finished the job: a box IS its paragraphs, one <p> each
with its own level and marker, drawn the same in the editor and the show
(THE PARAGRAPH, 20-notes-and-tables.js). A box you came back to was one
text node with "\\n" lines, and the List button made ONE bullet of every
line from the caret down; it is a <p> per line now, in the editor too.
"""

from __future__ import annotations

from junoview import assets


def test_the_editor_and_the_show_are_the_same_block(out):
    """T609 made the EDITOR a block; T623 makes the show the same block
    of the same paragraphs (parasDraw), so nothing differs between them --
    the spacing of a list's items and the gutter of its second column
    did. A Markdown box keeps its span and its rendered source."""
    assert "var tx2=document.createElement(a.md?'span':'div');" in out
    assert ("          parasDraw(tx2,(a.bib||_bibHint)?parasFrom(null,showTx,'')"
            "\n            :parasFrom(a,showTx,showHtml||''));") in out
    # the box-wide list's wrapper (T513) and root <ul> are gone with it
    assert "an-list-edit" not in out
    assert "an-ul" not in out


def test_a_box_reads_into_paragraphs_whatever_left_it():
    """One reader for every shape: outside a paragraph a <br>, a hard \\n
    and a block each begin a line (T609's rules, for an older box);
    inside a <p> or an <li> they are a line break within it."""
    js = assets.deck_js()
    body = js.split("  function parasParse(html,box){", 1)[1].split(
        "\n  }\n", 1)[0]
    assert ("if(tg==='BR'){if(cx.soft) put(cx.w[0]+'<br>'+cx.w[1],cx); "
            "else hard(cx);continue;}") in body
    assert "if(cx.soft){if(v) put(cx.w[0]+esc(v)+cx.w[1],cx);continue;}" \
        in body
    assert "v.split('\\n').forEach(function(p,j){" in body
    assert ("var PARA_BLOCK=/^(DIV|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|"
            "TABLE|TBODY|THEAD|TR|TD|TH)$/;") in js


def test_a_list_is_spaced_wherever_it_sits():
    """A list on a later line, a list in a box with plain lines and a
    whole-box list are all paragraphs with a marker, spaced alike."""
    css = assets.deck_css()
    assert (".an-p[data-list]{display:list-item;margin-top:.18em;"
            "margin-bottom:.18em;}") in css


def test_a_blank_line_is_one_blank_line_after_a_redraw():
    """2026-10-08 review: a block editor makes <div><br></div> for a blank
    line and innerText counts it twice, so "Para one", Enter, Enter, "Para
    two" came back with two blank lines (and every extra Enter added two).
    The editor's words are read paragraph by paragraph (T623). Driven: the
    box is 78.8px tall while typing and after the redraw, text
    'Para one\\n\\nPara two'."""
    js = assets.deck_js()
    assert ("  function editorText(el){\n"
            "    return parasText(parasParse(el.innerHTML,null));\n"
            "  }") in js
    assert "el.innerText||'').replace(/\\r/g,'')" not in js
    # every run edit commits through the one paragraph writer
    assert js.count("paraCommit(a,n,el);") == 3


def test_a_marker_on_one_line_lists_only_that_line():
    """2026-10-08 review: a revisited plain box was one text node with
    hard \\n lines, and the browser's list command ran from the caret's
    line to the end of the node -- "1. " before the second of four lines
    made one item of the last three. T609 cut the caret's line out first;
    T623 makes every line a paragraph of its own, so the marker goes on
    the caret's paragraph and nowhere else. Driven: only "Buy milk"
    numbered; "- " on the first line bullets only "Intro"."""
    js = assets.deck_js()
    h = js.split("    function autoList(e){")[1].split("\n    }\n")[0]
    assert "e.inputType!=='insertText'" in h
    assert "var p4=paraAt(el,tn,off4);" in h
    assert "var at=paraAttrs(p6);paraListSet(at,kind);paraAttrsSet(p6,at);" \
        in h
    # no more surgery on the text node, and no browser list command
    assert "splitText" not in h
    assert "insertUnorderedList" not in js
    assert "insertOrderedList" not in js


def test_levels_are_steps_of_the_type_not_nested_lists():
    """A level is a number on the paragraph, drawn as a margin in em of
    the box's type: the gutter, and 1.5em a level for a marker, 1.25em
    for a number -- the steps the nested lists had, so an older deck's
    sub-points sit exactly where they did."""
    js = assets.deck_js()
    pos = js.split("  function paraPos(l,k){")[1].split("\n  }\n")[0]
    assert ("if(k) return Math.round((1.7+l*(listIsOrdered(k)?1.25:1.5))"
            "*100)/100;") in pos
    assert "return l?Math.round((1.7+1.5*(l-1))*100)/100:0;" in pos
