"""Two more places the colour panel overstated itself (T456).

Found finishing T455:

* "Box background" governed the text box and not the notebook frame --
  the most box-shaped thing on a slide, which carried a hard-coded
  chrome colour.
* "Style sets swaps the whole palette at once" is true of a set you
  save (it captures tokens()) and of no set that ships: not one of the
  six built-ins defines `tokens`, so applying one has never moved a
  single colour.
"""

from __future__ import annotations

from junoview import assets


def test_a_notebook_frame_is_a_box(out):
    assert (".an-cell{position:absolute;\n"
            "  background:var(--tk-surface,var(--chrome-1,#0e1926));") in out


def test_the_note_says_what_is_true(out):
    assert ("'one and everything that has no colour of its own follows. "
            "A style '") in out
    assert "+'set you save carries this palette with it.';" in out
    # the old sentence is gone from the note (the comment above it
    # quotes it, which is why this looks for the rendered form)
    assert "+'at once.';" not in out


def test_no_built_in_set_claims_a_palette_it_does_not_have():
    """The guard behind the wording: if a built-in set ever grows a
    `tokens` block the sentence can promise more again -- and until one
    does, it must not."""
    import re
    js = assets.deck_js()
    blk = js[js.index("var STYLE_SETS=["):]
    blk = blk[:blk.index("\n  var ")]
    ids = re.findall(r"\{id:'([a-z0-9-]+)'", blk)
    assert len(ids) == 6, ids
    assert "tokens:" not in blk, (
        "a built-in style set now carries a palette -- say so in the "
        "Deck colours note, which T456 narrowed to saved sets only")
    # ...and the machinery that would apply one is still there for the
    # sets a user saves
    assert "    if(t.tokens) pres.tokens=deep(t.tokens);" in js
    assert "        tokens:deep(tokens())});" in js
