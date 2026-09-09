"""No holes, no ragged columns -- on either ribbon (T365).

The user, 2026-09-07, for what they say is the fortieth time: "Do you
ever understand what I mean by the buttons are cursed. Like there are
weird gaps and spaces everywhere? DO you ever understand what I mean by
this????? I have told you about this like 40 fucking times. Why is it
still fucked."

They are two arithmetic bugs, not a matter of taste, and both were
measured on the running app before anything was changed.

THE HOLE. ``.rbn-row`` is a two-row, column-major grid: controls fill
top-to-bottom, two to a column. An ODD number of single-row cells
therefore always leaves the last column half empty -- one 26px control
at the top and 37px of nothing under it -- and the group's dividers and
caption fence that emptiness into a visible rectangle. Seven groups had
one at full width: Everything on the slide (Remove all), Order
(Layers), Layout (Tidy page), Page furniture (Slide master), Draw
(Draw), During the talk (Code trail), Write (Table). Narrower windows
and other ribbon layouts move which groups are odd, so the cure has to
be arithmetic too, not a per-group tweak.

THE RAGGED COLUMN. T207's own comment says "the two buttons that share
a column share a width". They never did: ``justify-items:start`` leaves
the narrower of the two short of the max-content track. Twenty-two
columns were ragged, from 2px (Style sets / Citations) to 178px (a
three-segment run over "All slides").

Both are set by ``sizeRibbonGroups()``, which already counts a group's
cells and already re-runs on every path that re-fits the ribbon, so the
marks cannot go stale.

The second fix has a trap the first does not, and T280 fell into it
from the other side: stretching a plain button to a JOINED RUN's width
is how "why is tidy page huge?" happened on 2026-09-03, and answering
that by start-aligning everything is what left the twenty-two ragged
columns. So ``.rbn-fit`` is set in PAIRS and never on a pair holding a
run, and the two runs that had a narrow neighbour take a column of
their own in the markup instead.

The notebook viewer's bar is flex rather than grid but had the same two
diseases: "Markdown On" pinned to the top of the Filters group with
33px of nothing under it (it is the one filter with no Choose beneath
it), and an App group that was one row of 34px buttons -- the only 34px
controls on a 28px bar -- with 27px empty under all four.

Driven on the example notebook at 2400px and again at 1700px, deck open
and closed. After: every one of the seven deck tabs reports no hole, no
ragged column and no overflow into an implicit third row; 9 cells wear
``rbn-odd`` and 48 wear ``rbn-fit``; and all 27 controls on the
viewer's bar measure 28px, with every group still on one row.
"""

from __future__ import annotations

from junoview import assets


def test_the_odd_cell_fills_the_band_instead_of_hanging_in_it():
    css = assets.load("css/deck.css")
    assert ".rbn-row>.rbn-odd{grid-row:1/span 2;align-self:center;}" in css
    deck = assets.deck_js()
    # it is the LAST single-row cell that is alone, because the flow is
    # column-major: the count decides, and only an odd count leaves one
    assert "      if(n%2===1&&last) last.classList.add('rbn-odd');" in deck


def test_two_controls_sharing_a_column_share_its_width():
    css = assets.load("css/deck.css")
    assert ".rbn-row>.rbn-fit{justify-self:stretch;}" in css
    deck = assets.deck_js()
    assert "        if(rbnCanFit(p[0])&&rbnCanFit(p[1])){" in deck
    assert ("          p[0].classList.add('rbn-fit');"
            "p[1].classList.add('rbn-fit');}") in deck


def test_a_joined_run_is_never_stretched_to_a_column():
    """T280's lesson, kept: a run is as wide as all of its segments, and
    a plain button blown up to that is "why is tidy page huge?"."""
    deck = assets.deck_js()
    assert "  function rbnCanFit(c){" in deck
    assert "    return c.classList.contains('dbtn')" in deck
    assert "      &&!c.classList.contains('big-tile');" in deck
    # ...and start-alignment stays the default for the things that carry it
    css = assets.load("css/deck.css")
    assert ".rbn-row>.rbn-cell.rbn-seg{justify-self:start;}" in css


def test_a_run_with_a_narrow_neighbour_stacks_rather_than_spreads():
    """A wide run over a narrow button is a ragged column that no width
    rule can fix without blowing the button up ("why is tidy page
    huge?", 2026-09-03). T365 answered that by giving the run a column
    of its own with `rbn-tall`.

    T370 found what that cost. A cell is ONE track high whatever class
    it wears, so `rbn-tall` bought no second row -- it just reserved a
    column for a 26px control. In "How it arrives" the run and its only
    neighbour therefore sat end to end on a single row of a 60px band,
    300px wide (2026-09-09, user: "one big group that is all horizontal,
    and it stretches things out and doesn't really make sense").

    So the trade is reversed for the run: All slides sits UNDER it, the
    band fills, and the group measures 240px. The column is ragged, and
    that is fine -- every other group on that tab is already a wide cell
    over a narrow one. Spacing keeps its own column, but by being the
    odd cell out rather than by claiming a height it cannot have.
    """
    html = assets.deck_html()
    assert 'class="rbn-cell rbn-seg lay-tidy" id="hm-lay-tidy"' in html
    assert ('<span class="rbn-cell rbn-seg" id="trans-run" '
            'role="group"') in html
    # ...and Tidy page pairs with Saved layouts, which is why it moved up
    assert html.index('id="dsg-tidy"') < html.index('id="hm-lay-tidy"')


def test_the_marks_are_cleared_before_they_are_set():
    """They are re-derived on every fit; a stale rbn-odd on a control that
    is no longer last would span a column that now has a partner."""
    deck = assets.deck_js()
    assert "        c.classList.remove('rbn-odd');" in deck
    assert "        c.classList.remove('rbn-fit');" in deck


def test_a_spanning_control_resets_the_pairing():
    """It takes the next whole column for itself, so the singles after it
    start a fresh column rather than continuing the previous pair."""
    deck = assets.deck_js()
    assert "          n+=2;last=null;flushPairs();return;" in deck
    assert "      function flushPairs(){" in deck


def test_the_viewer_bar_centres_what_does_not_fill_the_band():
    css = assets.load("css/app.css")
    assert ".appbar .abgrp-row{align-items:stretch;}" in css
    assert ".appbar .fgrp{justify-content:center;}" in css
    assert ".vw-stack{justify-content:center;}" in css


def test_the_viewer_bar_has_one_button_height():
    """34px App buttons on a 28px bar, and a 30px Open beside a 28px
    docked file bar, were the two that had drifted."""
    css = assets.load("css/app.css")
    assert ("#ab-file .abgrp-row .toggle{height:var(--ab-btn-h);\n"
            "  min-height:var(--ab-btn-h);flex:none;}") in css
    assert (".appbar #ab-app .toggle,.appbar #ab-app .appbar-link{\n"
            "  height:var(--ab-btn-h);}") in css


def test_the_app_group_is_two_rows_of_two():
    """One row of four left 27px of the band empty under every button and
    spent 300px of a bar that was already scrolling; paired up it fills
    the band and hands 133px back -- which is what paid for Make slides."""
    css = assets.load("css/app.css")
    assert ("#ab-app .btn-grp{display:grid;grid-auto-flow:column;\n"
            "  grid-template-rows:var(--ab-btn-h) var(--ab-btn-h);"
            "gap:3px 4px;\n  align-items:stretch;}") in css


def test_no_two_controls_wear_the_same_id():
    """deck.html is injected into page.html, so their ids share ONE
    namespace at runtime and neither file's author can see the other's.

    #auto-menu was on both the deck's Autosave dropdown and T362's
    three-scope slides chooser. getElementById returns the first in
    document order -- the chooser -- so pressing "Autosave 2s" emptied
    it and refilled it with "Every 5 seconds", and "Slides from this
    notebook" was dead for the rest of the session. Nothing threw and
    the suite stayed green: the feature works right up until you press
    the other button, which is why only an audit found it.

    Reproduced live on 2026-09-07 before the fix (the chooser's three
    scope rows went to zero) and after (they stayed at three).
    """
    import collections
    import re

    markup = assets.page_template() + assets.deck_html() + assets.help_html()
    ids = re.findall(r'\bid="([A-Za-z0-9_:-]+)"', markup)
    dupes = sorted(i for i, n in collections.Counter(ids).items() if n > 1)
    assert not dupes, (
        "these ids are used more than once across page.html, deck.html and "
        f"help.html, which are ONE document at runtime: {dupes}"
    )
