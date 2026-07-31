"""What the reader can currently see. The four Markdown/Code/Plots/Output
filters cycle three states, the advanced type pickers narrow them further,
and a code cell's figure and text output are separate parts that filter
independently. Filter state belongs to sections ("Apply to" as an expandable
tree, "Mixed" when they disagree) and is isolated per notebook. Hiding
answers the same question from the other side: the heading-only eye versus a
whole-section hide, collapse-versus-hide CSS, per-cell eyes, and
reveal-hidden as a toggle rather than a reset.
"""

from __future__ import annotations


def test_output_is_capped_and_all_four_filters_cycle_three_states(out):
    """Huge printed output is capped + scrollable in the document view.

    Four filters -- Markdown/Code/Plots/Output -- ALL cycle 3 states now.
    Output is 3-state too: it cycles like the rest and its part can fold.
    """
    assert "max-height:min(440px,62vh)" in out
    assert "var CODE_CYCLE=['visible','collapsed','hidden']" in out
    assert 'id="tv-markdown"' in out and 'id="tv-plots"' in out
    assert 'id="tv-output"' in out and 'id="tv-code"' in out
    assert "cycleF('out')" in out and "return CODE_CYCLE[" in out
    assert ".cb-out.part-fold" in out \
        and 'content:"\\25b8  Show output"' in out


def test_output_type_filter_ui(out):
    """Advanced OUTPUT-type filter + finer repr types (numeric/list/dict/...).

    The Output-types menu must actually surface the finer slugs (not filter
    them out against a stale allow-list), and opening a collapsed output
    must not re-show type-filtered children.
    """
    assert 'id="ot-filter-btn"' in out and 'id="ot-filter-menu"' in out
    assert "function presentOtTypes" in out and ".ot-off{display:none" in out
    assert "ot-print" in out and 'cb-out" data-ot=' in out
    # the Output-types menu must actually surface the finer slugs (not filter
    # them out against a stale allow-list)
    assert "var OT_TYPES=['print','numeric'" in out
    assert "if(OT_TYPES.indexOf(t)<0) out.push(t)" in out
    # opening a collapsed output must not re-show type-filtered children
    assert ".cb-out.part-fold.part-open>*:not(.ot-off){display:revert" in out


def test_plot_type_picker_nests_under_the_plots_filter(out):
    """The appbar stacks each advanced types picker under its parent.

    Plot types under Plots, Code types under Code, Output types under
    Output, so the filter row stays narrow.
    """
    assert 'id="pt-filter-btn"' in out and 'id="pt-filter-menu"' in out
    assert "function renderPtMenu" in out and "presentPtTypes" in out
    assert ".ckf-dot.pt-sw-bokeh" in out and ".ckf-dot.pt-sw-matplotlib" in out
    assert 'class="fgrp"' in out and ".cb-fig .pt-off{display:none" in out
    assert (out.index('id="tv-plots"') < out.index('id="pt-filter-btn"')
            < out.index('id="tv-markdown"'))


def test_filter_menu_and_pager_javascript_wiring(out):
    """One advanced filter menu at a time.

    Doc filter state never rides into slide clones; hidden pager pages
    defer their plotly draw to the flip.
    """
    assert "function closeFilterMenus" in out
    assert "'.pt-off,.ot-off,.part-off,.part-fold,.code-off'" in out
    assert "figpage')" in out and "Plots.resize" in out


def test_section_scope_is_an_expandable_selection_tree(out):
    """"Apply to": filters can be scoped to ticked sections/sub-sections.

    …as an EXPANDABLE tree: a heading carries its sub-headings when ticked,
    and its arrow reveals them.

    …and picking is an explicit MODE, so unticking everything means "no
    sections", never a silent fallback to the whole notebook. The picker is
    a plain SELECTION: highlighted rows, one constant "Select all", and only
    the little arrow expands a heading -- hence no checkbox inputs in the
    rows themselves.
    """
    assert 'id="sec-scope-btn"' in out and 'id="sec-scope-menu"' in out
    assert "function renderScopeMenu" in out and "var secScope=" in out
    assert "function scopeAll" in out and "scope-l3" in out
    assert "function scopeTree" in out and "var scopeOpen=" in out
    assert "scope-chev" in out and "cb.indeterminate" in out
    assert "function setSub" in out
    assert "function seedScope" in out and "'Select all'" in out
    assert ".scope-row.on{" in out and ".scope-row.part{" in out
    assert "'none'" in out and "scope-chev" in out
    assert "type='checkbox'" not in out.split("scope-row")[1][:900]


def test_filters_belong_to_sections(out):
    """FILTERS BELONG TO SECTIONS: each section carries its own state, so one
    chapter can hide code while the next collapses plots. The appbar
    reads/writes whichever sections "Apply to" selects, says "Mixed" when
    they disagree, and Reset clears every override.

    An override that drifts back to the default stops being an override (no
    lying "· filtered" badge), and an empty pick disables the filters. A
    filter button never changes width as its state word changes.
    """
    # a filter button never changes width as its state word changes
    assert 'class="tvstate"' in out and ".tvstate{display:inline-block" in out
    assert "function stateFor" in out and "function newF" in out
    assert "function readF" in out and "function writeF" in out
    assert "function cycleF" in out and "mixed:'Mix'" in out
    assert ".toggle.tv.mixed .tdot" in out
    assert 'id="filters-reset"' in out and "function resetFilters" in out
    assert "function markSecOverrides" in out and "has-fover" in out
    # an override that drifts back to the default stops being an override
    # (no lying "· filtered" badge), and an empty pick disables the filters
    assert "function pruneF" in out and "function sameF" in out
    assert ".toggle.notarget" in out and "b.dataset.tip0" in out


def test_filter_state_is_isolated_per_notebook(out):
    """Per-notebook isolation (the adversarial review's top findings): the
    DEFAULT and the pick are per stem, a tab switch rebinds the bar, and
    closing a notebook drops its filter state.

    A card carries its own section id, so tree/trace CLONES keep obeying
    their source section instead of silently reverting to the default; and
    per-section state is namespaced by notebook, so two tabs whose sections
    share a slug never trample each other.
    """
    assert "function FDEFof" in out and "var defBy={},secF={}" in out
    assert "renderTypeButtons();renderScopeBtn();" in out
    assert "delete defBy[String(stem)]" in out
    # a card carries its own section id, so tree/trace CLONES keep obeying
    # their source section instead of silently reverting to the default
    assert 'data-secid="' in out and "function secIdOf" in out
    assert "stateFor(stem,secIdOf(c))" in out
    # per-section state is namespaced by notebook, so two tabs whose
    # sections share a slug never trample each other
    assert "function fkey" in out and "stateFor(stem," in out


def test_trace_tab_opens_unfiltered_and_filters_can_be_pushed(out):
    """A Plot-trace tab opens UNFILTERED (its own default, code showing) and
    offers to pull in the document's filters; any notebook can push its
    filters to all the others (greyed out when it is the only one open)."""
    assert "function newF(trace)" in out and "code:trace?'visible'" in out
    assert 'id="trace-inherit"' in out and "function copyFiltersTo" in out
    assert "function copyFiltersToAll" in out and ".scope-copy" in out
    assert "function renderFilterExtras" in out and "function docToast" in out


def test_code_output_parts_are_independently_filterable(out):
    """A code cell's figure and its text output are separate parts."""
    assert 'class="cb-part cb-fig"' in out and 'class="cb-part cb-out"' in out
    assert ".cb-fig.part-off" in out and ".cb-fig.part-fold" in out
    # the cb-fig wrapper must pass flex height through in slide frames
    assert ".an-cell .cb-fig,.spane .cb-fig,.slide-fig .cb-fig" in out


def test_mixed_output_cell_becomes_separate_parts(out, items):
    """Mixed-output cell: the figure and the printed repr become SEPARATE,
    independently filterable parts (cb-fig + cb-out), not a disclosure."""
    mixed = [it for it in items if it.anchor == "mixed"][0]
    assert mixed.kind == "figure"
    assert any(o.has_image for o in mixed.outputs)
    assert any(not o.has_image for o in mixed.outputs)
    # the old "also printed" disclosure is gone
    assert "alsoprinted" not in out


def test_code_and_cell_visibility_toggles(out):
    """Code hiding, card collapse and the per-cell eye all ship."""
    assert "function applyCodeState" in out and ".codewrap.code-off" in out
    assert ".card.collapsed" in out   # markdown notes still card-collapse
    # plain 'code' is a filter type too, so unchecking all == hide code
    assert "'constant','code']" in out
    # per-cell eyes: one on every card header, one on every sidebar item
    assert 'class="cell-eye"' in out and 'class="navitem-eye"' in out
    assert "function setCellOff" in out
    assert ".navitem.cell-off" in out   # hidden cell stays in the sidebar


def test_section_heading_and_whole_section_hide_are_separate(out):
    """TWO hide actions per section (2026-07-29).

    The eye takes the HEADING only (the cards stay), and a second,
    word-labelled button takes the whole section. Both exist in the
    document and in the sidebar.
    """
    assert 'class="sec-chev"' in out and 'class="sec-eye"' in out
    assert 'class="navsec-eye"' in out
    assert 'class="sec-hideall"' in out and 'class="navsec-hideall"' in out
    assert 'title="Hide just this heading (the cards below stay)"' in out
    assert ">hide section</button>" in out
    assert "function setSecHeadOff" in out and "function isHeadOff" in out
    assert ".section.sec-headoff .sectionhead-txt{display:none;}" in out
    # a hidden heading leaves NO trace in the feed: the sidebar is the only
    # place it shows, and "Show all hidden" is the way back
    assert ".section.sec-headoff .sectionhead{display:none;}" in out
    assert 'class="rf-btn rf-unhide"' in out
    assert "function syncUnhideBtn" in out


def test_section_collapse_and_hide_css(out):
    """Collapsing a section keeps its heading; hiding drops the lot."""
    assert ".section.sec-collapsed .card{display:none" in out
    assert ".section.sec-off{display:none" in out
    assert "function setSecCollapsed" in out and "function setSecOff" in out


def test_hidden_heading_leaves_no_hover_ghost(out):
    """The only :hover on a hidden head is the REVEAL one.

    That rule needs the ``.reveal-hidden`` ancestor -- an UNPREFIXED rule
    (one starting a line) would bring the ghost stub back.
    """
    assert "\n.section.sec-headoff .sectionhead:hover" not in out
    assert ".navsec-row.head-off .navsec-t{opacity:.55;" \
        "text-decoration:line-through;" in out


def test_reveal_hidden_is_a_toggle_not_a_reset(out):
    """It is a REVEAL toggle, not a reset.

    Nothing about what is hidden changes, so one more click puts it all
    back.
    """
    assert (
        ".nbshell.reveal-hidden .section.sec-headoff "
        ".sectionhead{display:flex;}"
    ) in out
    assert "shell.classList.toggle('reveal-hidden')" in out
    assert "'Hide them again ('+n+')'" in out
