"""T578: Appear + highlight, or Highlight only.

The user, 2026-09-30: "with the highlight animations it is really
confusing, like there should be an appear where they appear and are
highlighted when they appear, and also a just plain highlight where they
are all there, but highlight the ones that need to appear." And, of the
highlight that already existed: "they don't appear with the dot points"
-- the lit bullet was drawn without its dot.

``anim.hl`` 1 is Highlight only: every piece on the slide from the start
(the box is never held back, which its own tooltip always promised), each
click lighting the next. ``anim.hl`` 2 is Appear + highlight: the pieces
still to come are hidden as Reveal hides them, the arriving one is lit,
and the ones already said are "the rest" the dimmed/blurred choice acts
on.

Driven: Highlight only opened on three dimmed bullets; click 1 lit the
first (dot and all) with its photo; Appear + highlight opened on nothing,
click 2 dimmed bullet 1 and lit bullet 2 with the second photo.
"""

from __future__ import annotations

from junoview import assets


def test_three_tiles_named_for_what_you_see_before_the_click():
    html = assets.deck_html()
    assert '<button class="fx-tile" id="anim-by-reveal"' in html
    assert '<button class="fx-tile" id="anim-by-hlin"' in html
    assert '<span>Appear + highlight</span></button>' in html
    assert '<button class="fx-tile" id="anim-by-hl"' in html
    assert '<span>Highlight only</span></button>' in html
    # ...in that order
    assert (html.index('id="anim-by-reveal"') < html.index('id="anim-by-hlin"')
            < html.index('id="anim-by-hl"'))


def test_the_setter_writes_one_or_two(out):
    assert "    function setTextMode(how){" in out
    assert "        if(how==='in') an.hl=2;" in out
    assert "        else if(highlight) an.hl=1; else delete an.hl;" in out
    assert "      e.stopPropagation();setTextMode('in');" in out
    assert "      e.stopPropagation();setTextMode('all');" in out
    # the ribbon lights exactly one of the three
    assert "          (st.text&&st.hl&&!st.hlin).toString());" in out
    assert "        hib.setAttribute('aria-pressed',(st.text&&st.hlin).toString());" \
        in out


def test_appear_and_highlight_hides_what_is_to_come(out):
    assert "            var hlIn=(ba.anim.hl===2);" in out
    assert "              pe.style.visibility=(wait&&(!hl||hlIn))?'hidden':'';" \
        in out
    # the ones already said are the rest the dim choice acts on
    css = assets.deck_css()
    assert '[data-hlin="1"][data-hlrest="dim"] .an-part.an-hl-rest{opacity:.45;' \
        in css


def test_highlight_only_is_all_there_from_the_start(out):
    assert "          var allThere=(ba.anim.hl===1||ba.anim.hl===true)" in out
    assert "          if(allThere){}" in out
    # ...and so it is at every stop of the Story too
    assert "            if(hlAll){}" in out


def test_the_lit_bullet_keeps_its_dot():
    """A promoted piece IS the <li>; inline-block took away its
    list-item display and with it the marker."""
    css = assets.deck_css()
    assert ".an-part.an-hl:not(.an-blk){display:inline-block;}" in css
    rule = css.split(".an-part.an-hl{")[1].split("}")[0]
    assert "display" not in rule


def test_the_panel_offers_the_same_three():
    js = assets.deck_js()
    assert "       ['#anim-by-hlin','Appear + highlight','star'],   /* T578 */" in js
    assert "       ['#anim-by-hl','Highlight only','laser']].forEach(" in js


def test_the_format_says_what_two_is():
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert "2 to hide the pieces still to come, as without it" in fmt
