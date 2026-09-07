"""Pin a cell past the filters, and mark the ones you want back (T242).

The user, 2026-09-04: "Would be good if you could pin cells so they
always appear. I currently have one cell that has output I want but I
don't want the rest. Also would be good if you could favourite cells as
well (maybe a few different ones, like star, heart, etc.), then you can
see them down on the side menu as well."

Driven on the example notebook: pinning a card and then setting Output
to Off for the whole notebook left the pinned card's output showing
while its unpinned peer's output part went `part-off`; the mark button
cycled star -> heart -> flag -> none; and the sidebar grew a "pinned &
marked" list, pinned first, that survives a reload.
"""

from __future__ import annotations

from junoview import assets


def test_a_card_carries_a_pin_and_a_mark():
    import inspect

    from junoview.render import items
    code = inspect.getsource(items)
    assert 'class="cell-pin"' in code
    assert 'class="cell-mark" type="button" data-mark=""' in code
    # T364: and NOWHERE to list them. The sidebar block this test used
    # to pin is gone; the mark is drawn on the cell's own outline row.
    assert "navmarks" not in code


def test_pinned_means_the_filters_do_not_reach_it():
    """Every branch below decides what to fold and hide; a pinned cell
    wants none of it, so it is cleared and skipped rather than threaded
    through as one more exception."""
    app = assets.app_js()
    assert "        if(c.classList.contains('is-pinned')){" in app
    # T263: the blanket strip used to include 'cell-off' too. A pin is
    # about the FILTERS; the cell's own eye is a deliberate press, and
    # clearing it here made the eye on a pinned card look live and do
    # nothing -- the class went straight back off on the next pass.
    assert "          var poff=c.classList.contains('cell-off');" in app
    assert "          c.classList.remove('collapsed','expanded');" in app
    assert "          c.classList.toggle('is-hidden',poff);" in app
    assert "          $$('.ot-stub',c).forEach(function(n){n.remove();});" in app
    assert "          if(pnav) pnav.classList.remove('nav-hidden','cell-off');" in app
    # it is a skip, not a flag read further down
    i = app.index("        if(c.classList.contains('is-pinned')){")
    j = app.index("        var off=c.classList.contains('cell-off');", i)
    assert "return;" in app[i:j]


def test_pinning_beats_hiding_by_hand(out):
    """The two say opposite things about one cell; the newer press is the
    one you meant."""
    app = assets.app_js()
    assert "        if(!st.p) setCellOff(id,false);" in app


def test_the_mark_cycles_and_is_kept():
    app = assets.app_js()
    assert "  var MARK_KINDS=['star','heart','flag'];" in app
    assert "        var at=MARK_KINDS.indexOf(st.f||'');" in app
    assert "        var next=MARK_KINDS[at+1]||'';" in app
    # per notebook, so the pins on an analysis are there tomorrow
    assert "  var MARKKEY='semmarks:'+location.pathname;" in app
    assert "  function writeMarks(stem,m){" in app
    assert "    if(Object.keys(m).length) all[stem]=m; else delete all[stem];" in app


def test_the_mark_rides_the_row_the_cell_already_has():
    """T364 (2026-09-07, user: "the heart and star should [not] have
    them move to the top just have the symbols appear next to them
    where they are in the side bar, things moving around all over the
    place is fucking confusing").

    T242 copied every marked cell into a "pinned & marked" list above
    the sections, so marking one made it appear in two places at once.
    Now paintMark puts the symbol on the outline row that cell already
    has, and nothing moves."""
    app = assets.app_js()
    assert "  function renderMarks(shell,stem){" in app
    assert "h.textContent='pinned & marked';" not in app
    assert "shell.querySelector('.navmarks')" not in app
    assert "navmark-ic" not in app
    # the symbol, on the row, next to the eye
    assert "      var mk=nav.querySelector('.navitem-mk');" in app
    assert ("          nav.insertBefore(mk,nav.querySelector"
            "('.navitem-eye'));") in app
    # both facts show when a cell is pinned AND marked
    assert "        if(st.p) mk.appendChild(glyph('pin','mk-i-pin'));" in app
    assert "        if(st.f) mk.appendChild(glyph(st.f,'mk-i-'+st.f));" in app
    css = assets.load("css/core.css")
    assert ".navitem-mk{flex:none;display:flex;align-items:center;" in css
    assert ".mk-i-pin{color:var(--cyan);}" in css
    assert ".mk-i-star{color:var(--amber,#f0a848);}" in css
    assert ".card.is-pinned{border-left:3px solid var(--cyan-deep);}" in css
