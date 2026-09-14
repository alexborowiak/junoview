"""The shelf's ROW scrolls; its frame stays put (T454).

Found driving T453 on the Images tab: the Shapes group's twenty-two
tiles are wider than any window. With overflow on the shelf itself, its
own name and its close button scrolled away under the tiles -- the X sat
on top of whichever shape happened to be beneath it -- and a row that
ran off the edge gave no sign that it had.
"""

from __future__ import annotations


def test_only_the_row_moves(out):
    assert (".rbn-shelf{order:99;min-width:0;display:flex;\n"
            "  align-items:center;gap:9px;padding:4px 12px;") in out
    assert ("  overflow-x:auto;overflow-y:hidden;}") in out
    assert (".rbn-shelf-body{display:flex;align-items:center;"
            "flex:1 1 auto;min-width:0;") in out
    assert ".rbn-shelf-close{flex:none;align-self:center;}" in out
    # ...and no absolute positioning left over from when it was pinned
    assert ".rbn-shelf-close{position:absolute" not in out


def test_a_row_too_wide_says_so(out):
    assert ("    sh.classList.toggle('can-scroll',"
            "body.scrollWidth>body.clientWidth+1);") in out
    assert (".rbn-shelf.can-scroll .rbn-shelf-body{\n"
            "  mask-image:linear-gradient(90deg,#000 calc(100% - 28px),"
            "transparent);}") in out
