"""T591: "- ", "* " or "1. " at the start of any line starts a list.

The user, 2026-09-30: "There is not auto-numbering like dot points being
created automatically." Auto-bullets (2026-08-20) only fired on the first
characters of a box that was not a list yet, so "1. " typed under a
heading line stayed "1. ". Now a marker typed at the start of any plain
line takes that line into a list, through the same per-paragraph toggle
as the List button; Enter then carries the numbering on.

Driven: under two plain lines, "1. first", Enter, "second" became a
numbered list of two, above an existing bullet.
"""

from __future__ import annotations


def test_a_marker_at_a_lines_start_lists_that_line(out):
    """T623: one rule for every paragraph now (the box-start rule that
    rebuilt the whole box is gone), and the paragraph is the unit -- the
    marker must be the whole of it before the caret."""
    h = out.split("    function autoList(e){")[1].split("\n    }\n")[0]
    assert "var m4=/^([-*\\u2022]|1[.)])[ \\u00a0]$/.exec(r4.toString());" in h
    assert "try{r4.setStart(p4,0);r4.setEnd(tn,off4);}" in h
    assert "document.execCommand('delete',false,null);" in h
    # "1) " is the 1) 2) 3) kind, not 1. 2. 3.
    assert ("var kind=m4[1]==='1.'?'number':m4[1]==='1)'?'paren':'bullet';"
            in h)
    # never inside a list, never in a Markdown box, and never in a code
    # box, whose "- " is code (the 2026-10-10 review)
    assert "if(!p4||p4.hasAttribute('data-list')) return;" in h
    assert "if(!a4||a4.k!=='text'||a4.md||a4.font==='mono') return;" in h
    # only at the START of its paragraph: the whole paragraph before the
    # caret is the marker; and never by hand-editing the text node, which
    # left an empty node and took the line ABOVE into the list
    assert "if(!m4||off4<m4[0].length) return;" in h
    assert "tn.nodeValue=" not in h
    # the deletion is the browser's and the marker ours, ONE step of the
    # editor's undo: the first Ctrl+Z gives the typed "- " back
    assert h.index("edOp(el,function(){") < h.index(
        "document.execCommand('delete',false,null);")
