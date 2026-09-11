"""Show only cells carrying selected reactions or categories (T257).

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

The user asked for several reactions plus practical categorisation
labels, without making the already-wide toolbar grow again. One compact
Labels button in the Filters group opens a grouped menu. It offers only
labels the notebook uses when filtering, while each cell's picker also
offers the complete set and custom labels. Several selected filters are
an OR, so Heart plus Tier 1 means either, not only the uncommon cells
carrying both.
"""

from __future__ import annotations

from junoview import assets


def test_the_gate_is_kept_per_notebook():
    app = assets.app_js()
    assert "  var ONLYKEY='semmarkonly:'+location.pathname;" in app
    assert "  function onlyFor(stem){" in app
    assert "  function setOnly(stem,v){" in app
    assert "Array.isArray(v)?v:(typeof v==='string'&&v?[v]:[])" in app


def test_it_reads_the_marks_off_the_card_itself():
    """paintMark stamps a compact tags list on the card; filtering does
    not reimplement the marks store."""
    app = assets.app_js()
    assert "  function onlyKeeps(c,only){" in app
    assert "    var tags=(c.dataset.marks||'').split('|');" in app
    assert "    return only.some(function(k){return k==='pin'" in app
    assert "?c.classList.contains('is-pinned'):tags.indexOf(k)>=0;});" in app


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


def test_one_labels_control_only_appears_when_the_notebook_has_labels():
    app = assets.app_js()
    assert "  function markCounts(shell,stem){" in app
    assert "    host.hidden=!have.any;" in app
    assert "b.id='marks-filter';b.className='toggle sub mark-filter';" in app
    assert "Filter cells by reactions and categories" in app
    # ...and the whole group goes when the notebook has no labels
    assert "    host.hidden=!have.any;" in app
    # counted off the OUTLINE, so a mark from another notebook does not
    # raise a chip that gates on nothing
    assert ("      if(!shell.querySelector('.navitem[data-item=\"'+id+'\"]'))"
            " return;") in app


def test_the_labels_menu_is_in_the_ribbon_with_the_filters_it_gates():
    """It is out of the sidebar, inside the Filters group."""
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


def test_the_labels_control_and_menu_rows_are_words_plus_icons():
    app = assets.app_js()
    assert "b.innerHTML=bic('tag')+'<span class=\"btxt\">Labels'" in app
    assert "b.innerHTML=bic(info.ic);" in app
    assert "name.textContent=info.lab;" in app


def test_the_way_back_out_is_in_the_menu():
    app = assets.app_js()
    assert "<span class=\"mark-menu-name\">Show all cells</span>" in app
    assert "setOnly(stem,[]);closeLabelMenu();" in app


def test_a_gate_with_nothing_left_to_show_lets_go():
    """Un-marking the last hearted cell while "Heart" is on would
    otherwise empty the notebook with no visible cause."""
    app = assets.app_js()
    assert "if(only.length){setOnly(stem,[]);applyFilters();}" in app
    assert "if(only.length!==onlyFor(stem).length) setOnly(stem,only);" in app


def test_changing_a_label_changes_what_is_in_view():
    app = assets.app_js()
    labels = app.split("  function openCellLabels(btn,shell,stem,id){")[1]
    labels = labels.split("  document.addEventListener('click'", 1)[0]
    assert "setMarkState(stem,id,{p:st.p?1:0,tags:next});" in labels
    assert "paintMark(shell,stem,id);renderMarks(shell,stem);applyFilters();" in labels


def test_the_menu_is_a_compact_menu_not_a_new_wrapping_ribbon_row():
    css = assets.load("css/app.css")
    assert ".mark-filter[aria-pressed=\"true\"]" in css
    assert ".mark-menu{position:fixed;" in css
    assert ".mark-menu-row{display:flex;align-items:center;" in css
    app = assets.app_js()
    assert "function openLabelFilter(btn,shell,stem,have){" in app
    assert "function openCellLabels(btn,shell,stem,id){" in app
    assert "Add a custom label…" in app


def test_the_ribbon_never_wrap_rule_is_untouched():
    """The wrap above is scoped to .navonly, in the sidebar. The app bar
    must still compact rather than wrap (AGENTS.md invariant)."""
    css = assets.load("css/app.css")
    assert ".appbar{display:flex;align-items:stretch;gap:3px;flex-wrap:nowrap;" in css
