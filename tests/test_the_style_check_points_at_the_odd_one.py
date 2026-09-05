"""The style check says WHICH box disagrees, not just that one does.

The user, 2026-09-05, with a screenshot: "the style system isn't helpful
as you can't tell which boxes are not matching with the rest."

T268 had already made the CARDS say what the two values are ("Most are
22 pt; 1 is 23 pt"). What it did not do was mark the box. The chip loop
reads ``(f.g ? f.g.odd : (f.odd || f.list))``: a `named` or `geom`
finding carries ``f.odd`` and lists only the offenders, but a BAND
finding has no ``f.odd`` -- so it fell through to ``f.list`` and drew
every box in the band, agreeing and disagreeing alike, as identical grey
pills with the title "Go to it". On a hand-built deck the band card is
most of the screen.

Nothing here is recomputed. ``f.inner`` already carries the per-property
verdict the head and the why are written from.

Driven on a three-slide fixture with headings at 22/22/23 pt: the odd
chip leads, is marked, and reads "23 pt, where most are 22 pt"; clicking
it lands on slide 3 and rings that box in 2px amber, which clears itself
after a beat.
"""

from __future__ import annotations


def test_the_band_card_marks_the_boxes_that_differ(out):
    """Built from f.inner, which the card already has."""
    assert "    var oddSet={},oddWhy={};" in out
    assert "    (f.inner||[]).forEach(function(r){" in out
    assert "        oddSet[k]=1;" in out
    # the offenders lead: the card is an offer to fix THEM
    assert "    if(anyOdd) chips.sort(function(p,q){" in out
    assert "      c.className='std-chip '+(bad?'std-odd':'std-ok');" in out


def test_a_chip_says_what_is_different_about_that_box(out):
    """A count and a trip to go and look is what T268 set out to remove;
    it removed it from the card and left it on the chip."""
    assert "        var line=stdShow(r.prop,r.prop.get(p.a))+', where most are '" in out
    assert "          +stdShow(r.prop,r.mode);" in out


def test_the_conforming_boxes_are_muted_not_hidden(out):
    """The fix moves the whole band, so you still have to see what it
    will touch."""
    assert ".std-chip.std-ok{opacity:.5;}" in out
    assert ".std-chip.std-odd::before{content:\"! \";font-weight:700;}" in out


def test_the_marks_do_not_use_the_preflight_red(out):
    """deck.css records the rule in as many words -- "never the red
    preflight uses, because nothing this finds is broken". The odd one
    is told apart by WEIGHT and a badge, in the amber this screen
    already uses for "look at this"."""
    i = out.index("/* ---------- standardise text ----------")
    block = out[i:out.index("/* ---------- toolbar down the right-hand edge", i)]
    assert "var(--danger" not in block, block
    assert "#f0a848" in block


def test_the_slide_mark_is_applied_after_the_second_render(out):
    """go() renders and selectAnnot renders again, and a class added
    between the two is thrown away by the second -- the "one change
    renders twice" trap. Driven: the mark landed on zero boxes until it
    was deferred."""
    assert "          if(bad) setTimeout(function(){" in out
    assert ("            var l2=stage.querySelector('.annot-layer');"
            " if(!l2) return;") in out
    # by data-idx, never by child index: renderAnnots puts two <svg>
    # layers in first, so the layer's children do not index the annots
    assert ("            var el=l2.querySelector('.an-item[data-idx=\"'"
            "+p.ai+'\"]');") in out
    assert "l2.children[p.ai]" not in out
    # a note to the author, never ink on the page
    assert ".deck.editing .an-item.an-mismatch{" in out
    assert "@media print{.an-item.an-mismatch{outline:none!important;" in out


def test_the_style_board_marks_a_wearer_that_drifted(out):
    """dgGhostsFor drew every wearer identically -- same 1px amber box,
    same title of just "slide N" -- so the board was a map of WHERE they
    are and said nothing about whether any had stopped keeping to the
    style. The verdict is the same stdMatchesStyle the other screen
    uses, read once per repaint rather than per annot."""
    assert "    var def=(typeof styleDef==='function')?styleDef(id):null;" in out
    assert ("        var bad=!!(mine&&def&&typeof stdMatchesStyle==='function'"
            ) in out
    assert "          &&!stdMatchesStyle(a,def));" in out
    assert ("        b.className=(mine?'dg-real':'dg-other')+(bad?' dg-off':'');"
            ) in out
    # ...and in words, because comparing box borders across a board is
    # not an answer
    assert "        ?(off+' of these no longer match the style')" in out
    assert ".dg-real.dg-off{border-width:2px;" in out
