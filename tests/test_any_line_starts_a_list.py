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
    h = out.split("    /* T591: ...AND AT THE START OF ANY LINE.")[1] \
        .split("\n    });\n")[0]
    # T609: the LINE is read as AutoCorrect reads it (a <br>, a block or a
    # hard \n begins one), and the marker deleted through the editor
    assert ("var m4=/^([-*\\u2022]|1[.)])[ \\u00a0]$/"
            ".exec(acLine(el,tn,off4)||'');") in h
    assert "document.execCommand('delete',false,null);" in h
    assert "listSelection(/^1/.test(m4[1])?'number':'bullet');" in h
    # never inside a list, never in a Markdown box
    assert "tn.parentNode.closest('li')" in h
    assert "if(!a4||a4.k!=='text'||a4.md) return;" in h
    # only at the START of its line: the whole line before the caret is
    # the marker; and never by hand-editing the text node, which left an
    # empty node and took the line ABOVE into the list
    assert "if(!m4||off4<m4[0].length) return;" in h
    assert "tn.nodeValue=" not in h
