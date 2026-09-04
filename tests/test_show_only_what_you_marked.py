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

The chips live in the sidebar block with the marks they act on, wrap
(this is a sidebar, not the ribbon), carry a word AND an icon, show a
count, and only appear for a mark the notebook actually uses -- a chip
for a mark you have never used is a chip that empties the page. "All"
is always there so getting back out is a button rather than something
you have to remember.

Driven on the example notebook: with two pins, one star, one heart and
one flag, four chips appeared plus All; "Pinned" showed exactly the two
pinned cards of 27, "Star" exactly the one starred card (the pinned
ones gone with the rest), "All" restored all 27, and removing the last
hearted mark while "Heart" was on released the gate instead of leaving
an empty notebook.
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
    assert "    var have={pin:0,star:0,heart:0,flag:0};" in app
    assert ("      if(have[o.k]) bar.appendChild(chip(o.k,o.ic,o.lab,"
            "have[o.k]));});") in app


def test_every_chip_is_a_word_plus_an_icon():
    """Icon-only was rejected twice; a bare word among iconed chips reads
    as a label rather than a button, so All wears one too."""
    app = assets.app_js()
    assert "    bar.appendChild(chip('','cellcard','All',0));" in app
    assert "      b.innerHTML=bic(ic)+'<span class=\"navonly-t\">'+lab" in app


def test_the_way_back_out_is_on_the_row():
    app = assets.app_js()
    assert "        :'Show every cell again';" in app
    # pressing the chip that is already on is also a way out
    assert "        setOnly(stem,only===k?'':k);" in app


def test_a_gate_with_nothing_left_to_show_lets_go():
    """Un-marking the last hearted cell while "Heart" is on would
    otherwise empty the notebook with no visible cause."""
    app = assets.app_js()
    assert "      if(onlyFor(stem)){setOnly(stem,'');applyFilters();}" in app
    assert "    if(only&&!have[only]){setOnly(stem,'');only='';}" in app


def test_changing_a_mark_changes_what_is_in_view():
    app = assets.app_js()
    mark = app.split("$$('.cell-mark',shell).forEach(function(btn){")[1]
    mark = mark.split("    });")[0]
    assert "applyFilters();" in mark


def test_the_chips_may_wrap_because_this_is_not_the_ribbon():
    css = assets.load("css/core.css")
    assert ".navonly{display:flex;flex-wrap:wrap;gap:4px;" in css
    assert ".navonly-b{display:inline-flex;align-items:center;gap:4px;" in css
    # the pressed chip is coloured by the mark it stands for, not by one
    # generic accent
    assert '.navonly-b[data-only="star"].on{border-color:var(--amber,#f0a848);' in css
    assert ('.navonly-b[data-only="heart"].on'
            '{border-color:#e0757c;color:#e0757c;}') in css
    assert '.navonly-b[data-only="flag"].on{border-color:#5fc4ac;color:#5fc4ac;}' in css


def test_the_ribbon_never_wrap_rule_is_untouched():
    """The wrap above is scoped to .navonly, in the sidebar. The app bar
    must still compact rather than wrap (AGENTS.md invariant)."""
    css = assets.load("css/app.css")
    assert ".appbar{display:flex;align-items:stretch;gap:4px;flex-wrap:nowrap;" in css
