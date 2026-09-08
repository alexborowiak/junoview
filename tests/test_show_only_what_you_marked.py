"""Show only the cells you pinned, or starred, or hearted (T257).

The user, 2026-09-04: "The pins are good, and would be good to have
optins that is - show pinned options only, show starts only."

Marking a cell was only half the thought. T242 gave the marks and a
list of them in the sidebar; this gives the other half -- seeing just
those cells, in the document itself.

It is a GATE, not one more filter. It decides which cells are in play
at all, and the type filters and section scope then act within that.
Two consequences worth writing down:

* it runs BEFORE the T242 pin bypass. Pin's promise is that the type
  and section filters cannot reach a cell; "show only starred" is not
  one of those -- it is the reader saying which cells they are working
  with -- so a pinned cell is out of view under "only starred" like any
  other. "Only pinned" is the case where the two agree anyway.
* it reads the card's own is-pinned / mk-* classes, which paintMark has
  already put there, so the gate has no second source of truth to drift
  from.

T364 (2026-09-07) moved the chips OUT of the sidebar and into the
Filters group of the ribbon, where the filters they gate already are.
The user: "where is the button that has just the just show the pinned
or hearted etc. I hate it being in the side bar. That sucks shit."
They are ribbon buttons now, so they take the bar's one height and one
baseline; they still carry a word AND an icon and a count, and still
only appear for a mark the notebook actually uses -- a chip for a mark
you have never used is a chip that empties the page. "All" appears
only while a gate is shut, because at rest it is the state you are
already in; pressing the lit chip is the other way out.

Driven on the example notebook: with two pins, one star, one heart and
one flag, four chips appeared in the ribbon; "Pinned" showed exactly
the two pinned cards of 27, "Star" exactly the one starred card (the
pinned ones gone with the rest), the All that appeared beside them
restored all 27, and removing the last hearted mark while "Heart" was
on released the gate instead of leaving an empty notebook.
"""

from __future__ import annotations

from junoview import assets


def test_the_gate_is_kept_per_notebook():
    app = assets.app_js()
    assert "  var ONLYKEY='semmarkonly:'+location.pathname;" in app
    assert "  function onlyFor(stem){" in app
    assert "  function setOnly(stem,v){" in app


def test_it_reads_the_marks_off_the_card_itself():
    """paintMark already stamps is-pinned / mk-star / mk-heart / mk-flag;
    a second source of truth is a second thing to drift."""
    app = assets.app_js()
    assert "  function onlyKeeps(c,only){" in app
    assert "    return only==='pin'?c.classList.contains('is-pinned')" in app
    assert "      :c.classList.contains('mk-'+only);" in app


def test_the_gate_runs_before_the_pin_bypass():
    """A pinned cell is out of view under "only starred" like any other:
    pin's promise is about the TYPE and SECTION filters."""
    app = assets.app_js()
    body = app.split("  function applyFilters(){")[1]
    gate = body.index("if(!onlyKeeps(c,only)){")
    bypass = body.index("if(c.classList.contains('is-pinned')){")
    assert gate < bypass, "the mark gate must come first"
    assert "      var only=onlyFor(stem);" in app
    # a gated-out card leaves the document AND the sidebar
    assert "          c.classList.add('is-hidden');" in app
    assert "          if(onav) onav.classList.add('nav-hidden');" in app


def test_a_chip_only_appears_for_a_mark_the_notebook_uses():
    app = assets.app_js()
    assert "    var m=marksFor(stem),have={pin:0,star:0,heart:0,flag:0}," in app
    assert ("      if(have[o.k]) row.appendChild(chip(o.k,o.ic,o.lab,"
            "have[o.k]));});") in app
    # ...and the whole group goes when the notebook has no marks at all
    assert "    host.hidden=!have.any;" in app
    # counted off the OUTLINE, so a mark from another notebook does not
    # raise a chip that gates on nothing
    assert ("      if(!shell.querySelector('.navitem[data-item=\"'+id+'\"]'))"
            " return;") in app


def test_the_chips_are_in_the_ribbon_with_the_filters_they_gate():
    """T364: out of the sidebar, into the Filters group."""
    app = assets.app_js()
    page = assets.load("html/page.html")
    assert '<span class="fgrp" id="marks-grp" hidden>' in page
    assert '<span class="fgrp-row" id="marks-row"></span>' in page
    # inside the Filters section, not a section of its own
    assert (page.index('id="marks-grp"')
            < page.index('<span class="abgrp-lab">Filters</span>'))
    assert "  function renderMarkGate(){" in app
    assert "navonly" not in app
    # and it follows the notebook you switch to
    assert ("    renderTypeButtons();renderScopeBtn();renderMarkGate();"
            in app)


def test_every_chip_is_a_word_plus_an_icon():
    """Icon-only was rejected twice; a bare word among iconed chips reads
    as a label rather than a button, so All wears one too."""
    app = assets.app_js()
    assert "    if(only) row.appendChild(chip('','cellcard','All',0));" in app
    assert "      b.innerHTML=bic(ic)+'<span class=\"btxt\">'+lab" in app


def test_the_way_back_out_is_on_the_row():
    app = assets.app_js()
    assert "        :'Show every cell again';" in app
    # pressing the chip that is already on is also a way out
    assert "        setOnly(stem,only===k?'':k);" in app


def test_a_gate_with_nothing_left_to_show_lets_go():
    """Un-marking the last hearted cell while "Heart" is on would
    otherwise empty the notebook with no visible cause."""
    app = assets.app_js()
    assert "      if(only){setOnly(stem,'');applyFilters();}" in app
    assert "    if(only&&!have[only]){setOnly(stem,'');only='';}" in app


def test_changing_a_mark_changes_what_is_in_view():
    app = assets.app_js()
    mark = app.split("$$('.cell-mark',shell).forEach(function(btn){")[1]
    mark = mark.split("    });")[0]
    assert "applyFilters();" in mark


def test_the_chip_is_coloured_by_the_mark_it_stands_for():
    """Not one generic accent: which gate is shut has to read at a
    glance, and the mark's own colour is what says it."""
    css = assets.load("css/app.css")
    assert ('.mkchip[data-only="star"][aria-pressed="true"]{\n'
            '  border-color:var(--amber,#f0a848);'
            'color:var(--amber,#f0a848);') in css
    assert ('.mkchip[data-only="heart"][aria-pressed="true"]{\n'
            '  border-color:#e0757c;color:#e0757c;') in css
    assert ('.mkchip[data-only="flag"][aria-pressed="true"]{\n'
            '  border-color:#5fc4ac;color:#5fc4ac;') in css
    # a ribbon button, so it takes the bar's one height rather than
    # inventing a third
    app = assets.app_js()
    assert "      b.className='toggle sub mkchip';" in app


def test_the_ribbon_never_wrap_rule_is_untouched():
    """The wrap above is scoped to .navonly, in the sidebar. The app bar
    must still compact rather than wrap (AGENTS.md invariant)."""
    css = assets.load("css/app.css")
    assert ".appbar{display:flex;align-items:stretch;gap:3px;flex-wrap:nowrap;" in css
