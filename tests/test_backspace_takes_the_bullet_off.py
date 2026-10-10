"""T590: Backspace at the start of a bullet takes the bullet off.

The user, 2026-09-30: "It's still really hard to get rid-of dot points.
Like you seem to be only be able to get rid of them if the line is empty.
E.g. if there is a line above and you try and delete, then it just takes
everything back to the line before. IF the dot points there is no line
before e.g. at the top, then dot points cannot be backspaced."

Left to the browser, Backspace at the start of a bullet merged it into
the line above, words and all, and on the first line did nothing. Word
and PowerPoint: the first Backspace takes a sub-bullet up a level or the
bullet off, keeping the words on their own line; the next one joins.

Driven: "- one / two / three" typed as a list; Backspace at the start of
"two" left <ul>one</ul> two <ul>three</ul>, and at the start of "one"
left one and two plain above the "three" bullet.

T623 (2026-10-10): the same rule on the paragraph model -- the marker
comes off the paragraph (or its level goes down one) and the others keep
theirs, colour and number included. Driven: "- one / sub / sub2 / three",
Backspace at "three" took its bullet off, Ctrl+Z put it back, Ctrl+Y off
again; at "sub2" (a sub-bullet) it went up a level.
"""

from __future__ import annotations


def test_the_caret_at_a_paragraphs_start_is_recognised(out):
    """T623: a bullet is a paragraph with a marker now, so the test is
    the paragraph's own start -- nothing but empty markup before it."""
    assert "  function paraAtStart(p,n,off){" in out
    fn = out.split("  function paraAtStart(p,n,off){")[1].split("\n  }\n")[0]
    assert "try{r.setStart(p,0);r.setEnd(n,off);}catch(e){return false;}" \
        in fn
    assert "return r.toString().replace(/\\u200b/g,'')==='';" in fn


def test_backspace_there_outdents_or_unbullets(out):
    kd = out.split("        if(p8&&e.key==='Backspace'")[1] \
        .split("          return;\n        }")[0]
    assert "&&paraAtStart(p8,s8.focusNode,s8.focusOffset)){" in kd
    # a sub-bullet goes up a level first; a first-level one loses its
    # marker, and a plain paragraph with a level goes up one (T623)
    assert "if(p.list&&!p.lvl) paraListSet(p,''); else paraLevel(p,-1);" \
        in kd
    # ...as one step of the editor's undo, and never the browser's
    # outdent, which split the list and lost its markers' look
    assert "paraEdit(el,[p8],function(p){" in kd
    assert "execCommand('outdent'" not in out
