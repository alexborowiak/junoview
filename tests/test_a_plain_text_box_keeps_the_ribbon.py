"""T583: selecting a plain text box no longer breaks the ribbon.

The user, 2026-09-30: "the animation pane is no longer opening". T578
gave timingState's full answer an ``hlin`` key (Appear + highlight), and
timingSync writes ``(st.text&&st.hlin).toString()`` into the new tile's
aria-pressed. The early answer -- a text box with no entrance yet, which
is every text box until you animate it -- had no ``hlin``, so
``undefined.toString()`` threw inside showFmt on every such selection.
The throw skipped the rest of the selection sync, fitEditRibbon among
it, so the unfitted Animation tab overflowed and the Animation panel
button sat past the ribbon's clipped right edge: nothing to click.

Driven: 1500x950 and 1366x768, title text box selected, Animation tab,
Animation panel pressed -- the pane opens and the page logs no error.
"""

from __future__ import annotations


def _returns(out):
    body = out.split("    function timingState(){")[1].split("\n    }\n")[0]
    early = body.split("if(!on) return {")[1].split("};")[0]
    full = body.split("      return {on:true,")[1].split("};")[0]
    return early, full


def test_both_answers_say_whether_it_appears_lit(out):
    early, full = _returns(out)
    assert "hlin:false" in early
    assert "hlin:a.anim.hl===2" in full


def test_every_highlight_key_the_sync_reads_is_in_both_answers(out):
    """The sync calls .toString() on these, so a key missing from either
    answer is a throw, not a false."""
    early, full = _returns(out)
    for key in ("hl:", "hlin:", "text:", "by:", "fig:", "grid:"):
        assert key in early, key
        assert key in full, key
