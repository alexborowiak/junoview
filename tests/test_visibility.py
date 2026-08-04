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
    must not re-show type-filtered or type-folded children.
    """
    assert 'id="ot-filter-btn"' in out and 'id="ot-filter-menu"' in out
    assert "function presentOtTypes" in out and ".ot-off{display:none" in out
    assert "ot-print" in out and 'cb-out" data-ot=' in out
    # the Output-types menu must actually surface the finer slugs (not filter
    # them out against a stale allow-list)
    assert "var OT_TYPES=['print','numeric'" in out
    assert "if(OT_TYPES.indexOf(t)<0) out.push(t)" in out
    # opening a collapsed output must not re-show type-filtered children
    assert (".cb-out.part-fold.part-open>*:not(.ot-off):not(.ot-fold)"
            "{display:revert" in out)


def test_output_hide_rule_beats_embedded_payload_styles(out):
    """The hide rule must WIN against CSS shipped inside the output itself.

    An xarray repr embeds `.xr-wrap{display:block !important}` (its own
    anti-fallback rule), and junoview's wrapper used to share that class
    name — so "hide Dataset" lost the cascade fight and the card stayed
    fully visible (2026-08-03). Two defences, both pinned: the wrapper is
    a junoview-owned class the payload's stylesheet cannot name, and the
    hide rule is scoped + !important so a same-specificity embedded rule
    can never out-order it.
    """
    assert 'class="jv-xr ot-dataset"' in out
    assert 'class="xr-wrap ot-dataset"' not in out
    assert ".cb-out>.ot-off{display:none!important;}" in out
    # junoview's own styling followed the wrapper to its new name
    assert ".jv-xr{font-size:13px;" in out


def test_output_types_menu_is_per_type_tri_state_with_counts(out):
    """Each output type row: a count and its OWN On/Fold/Off (2026-08-03).

    The menu lists only the ACTIVE notebook's types — scanning every open
    tab used to put other documents' types in the menu — with an
    occurrence count per type. Each row carries a tri-state cycler;
    setting one detaches that type from the overall Output filter until
    the menu's reset re-attaches it. Legacy saved states used 1 for
    "hidden" and must keep meaning that.
    """
    # the scan is scoped to the active notebook's document feed
    assert "var sh=APP.active&&APP.shells[APP.active];" in out
    assert "'.content .card .cb-out'" in out
    # counts: "dataset (3)"
    assert "var otCounts={};" in out
    assert "tx.textContent=t+' ('+(otCounts[t]||0)+')';" in out
    # the per-type tri-state, cycling like the main filters
    assert "var st=document.createElement('button');" in out
    assert "st.className='ckf-state';" in out
    assert "writeF(function(s){s.ot[t]=nx;});" in out
    # a folded output leaves a per-output stub that reopens just itself
    assert ".cb-out>.ot-fold:not(.ot-open){display:none!important;}" in out
    assert "stub.className='ot-stub';" in out
    # reset re-attaches every type to the overall Output filter
    assert "rs.id='ot-reset';" in out
    assert "'Reset: match Output'" in out
    assert "writeF(function(s){s.ot={};});" in out
    # legacy 1 still reads as 'hidden', and map equality compares VALUES
    assert "function otVal(v)" in out
    assert "return v?'hidden':null;" in out
    assert "if(otVal(x[kx[i]])!==otVal(y[kx[i]])) return false;" in out
    # a type with no override follows the overall Output state
    assert "vals[otVal(s.ot[t])||s.out]=1;" in out


def test_code_and_plot_type_menus_show_counts_for_active_notebook(out):
    """The Code-types and Plot-types menus count like the Output menu."""
    assert "var ckCounts={};" in out and "var ptCounts={};" in out
    assert "tx.textContent=t+' ('+(ckCounts[t]||0)+')';" in out
    assert "tx.textContent=t+' ('+(ptCounts[t]||0)+')';" in out


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
    # the strip selector carries every filter class INCLUDING the per-type
    # fold — a folded output must arrive on a slide in full
    assert "'.pt-off,.ot-off,.ot-fold,.part-off,.part-fold,.code-off'" in out
    assert "$$('.ot-stub',b).forEach(function(n){n.remove();});" in out
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


def test_type_picker_matches_the_width_of_its_filter(out):
    """Each type picker spans the filter it sits under.

    The pickers used to be 34px squares like the standalone Help button. A
    narrow square under a wide button reads as a separate control that
    happens to be nearby, rather than as that filter's own "advanced"
    affordance -- and it left the row of filter groups ragged along the
    bottom. Help keeps its square, because it stands alone.
    """
    assert ("#pt-filter-btn,#ck-filter-btn,#ot-filter-btn{padding:0;\n"
            "  justify-content:center;width:100%;flex:none;}" in out)
    assert ("#help-btn{padding:0;justify-content:center;width:28px;"
            "min-width:28px;\n  flex:none;}" in out)
    # the width comes from the column, so there is nothing to keep in sync
    assert ".fgrp{flex:none;display:flex;flex-direction:column;" \
           "align-items:stretch;" in out
