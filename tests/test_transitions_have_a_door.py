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
    # T372: the same frame-of-tiles as the entrance-effect strip two
    # groups along, because it is the same kind of choice
    assert 'class="rbn-tall strip-frame" id="trans-frame"' in html
    assert 'class="fx-strip trans-strip" id="trans-strip"' in html
    for bid, word in (("trans-cut", "Cut"), ("trans-fade", "Fade"),
                      ("trans-move", "Move")):
        assert f'id="{bid}"' in html, bid
        btn = html[html.index(f'id="{bid}"'):]
        assert word in btn[:btn.index("</button>")], bid
    # words PLUS icon, never icon-only
    for ic in ("none", "fade", "swap"):
        assert f'<i data-ic="{ic}"></i>' in html, ic
    # T372: "How it arrives" named nothing (2026-09-09, user: "WHAT
    # DOES 'HOW IT ARRIVES' EVEN MEAN"). It is the slide transition, and
    # Transition is the word PowerPoint uses for it.
    assert '<span class="rbn-lab">Transition</span>' in html
    assert "How it arrives" not in html


def test_who_gets_this_transition_is_a_menu_of_scopes(out):
    """"All slides" was one verb on a stranded 26px button beside a
    56px tile strip, and it was the only scope on offer (2026-09-09,
    user: "the all slides thing is weird, that button is still bad.
    Also, that should be a drop down menu with options, this slide, all
    slides, in range, sections etc").

    The door is a TILE now -- the same shape as the transitions it
    applies, the same idiom as Background's tile door -- and it opens a
    menu: this slide, each section by name, all slides, and a tick list
    for anything else. "In range" lives in that tick list: grouped by
    section with a tri-state header per section, it expresses a range,
    a section, several sections or an arbitrary handful, which is why
    there is no from/to widget anywhere in this product.
    """
    html = assets.deck_html()
    assert 'id="trans-all"' not in html
    assert 'class="sh-drop rbn-tall" id="trans-scopewrap"' in html
    assert 'class="fx-tile" id="trans-scope"' in html
    assert "Give it to &#9662;" in html
    assert "    var door=$('#trans-scope');" in out
    # the EFFECTIVE transition, so a scope means what you can SEE on
    # this slide -- inside a section that may be the section's
    assert ("    var sl=(pres.slides||[])[cur];\n"
            "    return (sl&&typeof sl.trans==='string')"
            "?sl.trans:transFor(cur);") in out
    # every scope writes the SLIDES it names; it deliberately does not
    # set a section default, which the slides' own answers would beat
    assert "  function transGiveTo(idxs,kind,what){" in out
    assert "      var s=(pres.slides||[])[i]; if(s) s.trans=String(kind);" in out
    assert "pres.sections" not in out.split("function transGiveTo")[1][:600]
    # the four scopes
    for row in ("'This slide'", "'All slides'", "'Choose slides\\u2026'"):
        assert row in out, row
    assert "sectionRuns().filter(function(r){return r.id;})" in out


def test_the_scope_tick_list_is_the_shell_the_others_use(out):
    """A fifth .aa-dlg rather than a fifth SHAPE: the Apply-a-look and
    Match-slides dialogs already answer "which slides" this way, and
    #ms-dlg is the precedent for a chooser that keeps its OWN exclusion
    map so two features cannot share one tick state."""
    html = assets.deck_html()
    assert '<div class="aa-dlg" id="ts-dlg" hidden role="dialog"' in html
    for cid in ("ts-scope", "ts-count", "ts-ok", "ts-cancel", "ts-close",
                "ts-all", "ts-none", "ts-what"):
        assert f'id="{cid}"' in html, cid
    assert "  function transScopeDlg(kind){" in out
    # keyed on the slide OBJECT, never its index: a splice from
    # move/delete/duplicate would silently re-point an index-keyed set
    assert "    var off=new WeakMap();" in out
    # and the canvas must not see the dialog's keys
    assert "    dlg.onkeydown=function(e){\n      e.stopPropagation();" in out


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
