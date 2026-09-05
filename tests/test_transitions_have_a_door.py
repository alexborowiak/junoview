"""Slide transitions have a door on the ribbon (T289).

The 2026-09-05 review called this the largest capability with no door in
the product. The whole transition model -- including "Move matching
objects", which is PowerPoint's Morph and the most impressive single
thing this editor does -- could be reached only by RIGHT-CLICKING a
filmstrip row. Nothing on any tab. PowerPoint gives transitions a tab of
their own, so someone arriving from it looked where it should be and
concluded the feature was not there.

The slide menu keeps its rows: that is where you are looking when you
decide a slide is a nice-to-have, and it is the only place a SECTION
default can be set. This is the same three answers, where you would go
looking for them.

Driven at 1440x900: the group is leftmost on the Animation tab; setting
Move on slide 1 marks Move, slide 2 shows its own answer, and returning
to slide 1 shows Move again.
"""

from __future__ import annotations

from junoview import assets


def test_the_three_transitions_are_on_the_animation_tab():
    html = assets.deck_html()
    assert 'class="rbn-grp rbn-trans" data-tab="animation"' in html
    assert 'id="trans-run"' in html
    for bid, word in (("trans-cut", "Cut"), ("trans-fade", "Fade"),
                      ("trans-move", "Move")):
        assert f'id="{bid}"' in html, bid
        btn = html[html.index(f'id="{bid}"'):]
        assert word in btn[:btn.index("</button>")], bid
    # words PLUS icon, never icon-only
    for ic in ("none", "fade", "swap"):
        assert f'<i data-ic="{ic}"></i>' in html, ic
    assert '<span class="rbn-lab">How it arrives</span>' in html


def test_apply_to_all_slides_exists_at_all(out):
    """PowerPoint's own verb, and it was missing everywhere -- the slide
    menu sets one slide, the section menu sets one section, and there
    was no way to say "the whole deck"."""
    assert 'id="trans-all"' in assets.deck_html()
    assert "    var all=$('#trans-all');" in out
    # the EFFECTIVE transition, so it means what you can see on this
    # slide -- inside a section that may be the section's
    assert ("      var kind=(typeof sl.trans==='string')"
            "?sl.trans:transFor(cur);") in out
    assert ("      (pres.slides||[]).forEach("
            "function(s2){s2.trans=String(kind);});") in out


def test_it_leads_the_tab_and_the_rungless_groups_got_rungs(out):
    """Without an `order` a group sits at 0 and comes FIRST, which is how
    Disappear and a flip book's Page turn were arriving ahead of Appear.
    deck.css already records this exact failure for Page furniture, and
    the 2026-09-05 review found it a third time on Home."""
    css = assets.load("css/deck.css")
    assert ".rbn-trans{order:0;}" in css
    assert ".rbn-anim{order:1;}" in css
    assert ".rbn-exit{order:3;}" in css
    assert ".rbn-flipfx{order:6;}" in css


def test_the_buttons_follow_the_slide_not_the_selection(out):
    """animRibbonSync -- where the rest of the Animation tab syncs from
    -- is driven by the SELECTION, and go() clears the selection to null
    without going through it. Driven: the ribbon kept showing the
    previous slide's answer until go() called this directly."""
    assert "  function transRibbonSync(){" in out
    assert "    var now=transFor(cur);" in out
    # both hooks: the selection path and the slide path
    assert out.count("if(typeof transRibbonSync==='function') transRibbonSync();") >= 3
    go = out.split("  function go(n){")[1].split("\n  }")[0]
    assert "transRibbonSync();" in go


def test_the_boot_call_is_in_the_boot_sequence(out):
    """Declarations only in the fragment; every load-time call runs from
    THE BOOT SEQUENCE, because a throw there silently kills the whole
    IIFE and every door after it."""
    assert "  transRibbonBoot();          /* how a SLIDE arrives (T289) */" in out
    assert "  function transRibbonBoot(){" in out
