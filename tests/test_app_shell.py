"""The app's own chrome around the document: the ribbon, the tab line and the
sidebar. Covers ribbon composition and counts (labelled groups, the file
group leading with Open, full-size scope/copy buttons, size steppers, the
fixed-width View slot, the Raw/Tree/Present group staying one unit), the
wrapping left-aligned layout with a measured page offset, the decluttered
top-left with the hamburger on the tab line, and the TOC toggle / resizable
builder / dark document chrome. The sidebar's nav key legend and the raw
notebook view live here too.
"""

from __future__ import annotations

from junoview.render.items import render_nav


def test_ribbon_group_counts(out):
    """File + 4 type filters + scope/reset + copy + figure & text size.

    7 filter/scope groups + 2 tree-view groups (fold, width); the 2 size
    steppers carry ``fgrp-h`` and are counted separately. The ribbon is
    organised into LABELLED sections.
    """
    assert out.count('class="fgrp"') == 9
    assert out.count('class="fgrp fgrp-h"') == 2
    assert out.count('class="abgrp-lab"') == 7   # + Tree (tree view only)
    assert 'class="abgrp" id="ab-filters"' in out


def test_ribbon_leads_with_open_and_leaves_file_info_to_sidebar(out):
    """Open / File / Reload lead the ribbon, at full size.

    File info + reload live in the SIDEBAR, beside the notebook they
    describe, rather than being duplicated in the ribbon.
    """
    assert 'class="toggle primary" id="tab-open"' in out
    assert 'id="file-info-btn"' not in out   # they live in the sidebar
    assert (out.index('id="tab-open"') < out.index('id="tv-plots"'))
    assert "rf-btn rf-info" in out and "rf-btn rf-reload" in out


def test_scope_copy_and_zoom_controls_are_full_size(out):
    """The scope + copy buttons are full-size, like the filters they act
    on -- and the zoom row is captioned instead of each button carrying
    its own label.
    """
    assert 'class="toggle" id="sec-scope-btn"' in out
    assert "function copyFiltersToAll" in out
    assert 'class="toggle fz-val" id="fig-size-val"' in out
    assert 'class="fgrp-cap">Figures' in out


def test_appbar_wraps_left_aligned_with_measured_page_offset(out):
    """The ribbon WRAPS and the page offset follows its real height.

    That way a control can never end up off the right-hand edge behind a
    scrollbar. It is left-aligned, NOT centred: centring re-centres on
    any viewport width change, so every button slid when the scrollbar
    came and went.
    """
    assert "--appbar-h:104px" in out and "--chrome-h:112px" in out
    assert ".appbar{display:flex;align-items:stretch;gap:5px;" \
        "flex-wrap:wrap;" in out
    assert "justify-content:flex-start;padding-left:8px;" in out
    assert "overflow-x:auto;scrollbar-width:none;}" not in out
    assert "function measureChrome" in out
    assert "'--chrome-h',h+'px'" in out


def test_ribbon_size_stepper_and_fixed_view_slot(out):
    """The ribbon's size stepper, dividers and fixed-width View stack."""
    assert out.count('class="appbar-div filt-div"') == 2
    assert "APP.ribbonSizeStep=function(dir)" in out
    assert "if(!APP.ribbonSizeStep(1)) bumpFigAll(1.15);" in out
    assert "cap.textContent=isTree?'Tree':'Figures'" in out
    assert "top:calc(var(--chrome-h) + 6px)" in out
    # a centred bar slides sideways when the scrollbar comes and goes
    assert "scrollbar-gutter:stable" in out
    # the View stack is a FIXED slot: the Tree button renames itself to
    # "Document" and a wider word would shove Present sideways
    assert (
        ".vw-stack{display:flex;flex-direction:column;gap:4px;flex:none;"
        "\n  min-width:106px;}"
    ) in out
    assert ">Match document</button>" in out


def test_view_group_stays_one_unit_and_present_bar_is_one_flow(out):
    """Raw / Tree / Present are one unit and never wrap apart.

    Help and Support moved behind a "…" so the bar fits on one row, but
    nothing else is hidden behind a menu.  Present mode carries the whole
    group rather than the loose buttons, and the present bar is ONE
    wrapping flow (display:contents) instead of two flex items that each
    shrink and wrap inside themselves.
    """
    assert 'id="theme-btn"' in out
    # Raw / Tree / Present are one unit and never wrap apart; Help and
    # Support moved behind a "…" so the bar fits on one row
    assert 'class="btn-grp" id="view-grp"' in out
    assert (out.index('id="view-grp"') < out.index('id="view-raw"')
            < out.index('id="doc-present"') < out.index('id="theme-btn"'))
    assert 'id="more-btn"' not in out   # nothing hidden behind a menu
    assert ".btn-grp{display:flex" in out
    # …and present mode carries the group, not the loose buttons
    assert "'#ab-size','#ab-view'" in out
    # the present bar is ONE wrapping flow (display:contents), not two
    # flex items that each shrink and wrap inside themselves
    assert ("body.pbpos-top .pb-tools,body.pbpos-top .pb-own"
            "{display:contents;}" in out)
    # Outline opens the rail down the LEFT, so it sits at the left end of
    # the bar; the bar's own buttons right-align from the one after it.
    assert "body.pbpos-top .pb-own #pb-rail{order:-1;margin-right:6px;}" in out
    assert "body.pbpos-top .pb-own #pb-move{margin-left:auto;}" in out
    # being flex items of the bar (their wrapper is display:contents) they
    # were shrunk under their labels and overprinted one another
    assert "body.pbpos-top .pb-own .toggle{flex:none;}" in out
    # Exit and the fold button are pinned out of the flow, so the flow has
    # to be padded clear of them or it renders underneath
    assert "padding-right:var(--pb-corner,232px);}" in out
    assert "'--pb-corner'" in out          # measured for real at runtime


def test_top_left_declutter_puts_hamburger_on_the_tab_line(out):
    """top-left declutter: no "docs" label; the hamburger sits on the tab
    line, and Open has moved up to the ribbon's file group.
    """
    assert 'class="tabs-label"' not in out
    assert (out.index('class="tabsrow"') < out.index('id="menubtn"')
            < out.index('id="tabstrip"'))
    assert 'class="tabrow-open"' not in out
    assert ".tabsrow .menubtn" in out


def test_chrome_toc_toggle_resizable_builder_dark_doc_no_refresh(out):
    """chrome: TOC toggle, resizable builder, dark document, tab refresh."""
    assert 'id="menubtn"' in out and "tocshow" in out
    assert 'id="dc-resize"' in out and "--dc-w" in out
    assert 'id="dc-save"' in out
    assert 'class="docbar"' in out and 'class="docbar-p"' in out
    assert "body:not(.light) .card" in out
    assert 'id="refresh-btn"' not in out


def test_nav_key_sits_above_the_first_section_row(doc):
    """The sidebar key sits at the TOP (before the first section row)."""
    _nav = render_nav(doc)
    assert "navkey" in _nav and _nav.index("navkey") < _nav.index("navsec-row")


def test_nav_key_legend_and_markdown_clamp(out):
    """Nav key legend + long-markdown clamp plumbing shipped."""
    assert 'class="navkey"' in out and 'class="nk k-figure"' in out
    assert "mdClampScan" in out and "mdclamp" in out
    assert "vo-xall" in out and "fullscreenchange" in out


def test_raw_notebook_view_shows_cells_as_authored(out):
    """Raw notebook view: cells as authored, directives visible."""
    assert 'id="view-raw"' in out and 'class="rawview"' in out
    assert 'class="rawcell code"' in out and "#| display: metric" in out
    assert 'class="rawcell md"' in out


def test_focus_mode_gone_and_toolbar_filter_order(out):
    """The retired focus-mode machinery is gone.

    What replaced it in the toolbar: content filters, a grouping divider,
    and Open moved to the tab line.  The filter order is
    plots -> markdown -> code -> output-types.
    """
    # the retired focus-mode machinery is gone
    assert "focusStem" not in out and 'id="focusbar"' not in out
    # toolbar: content filters, a grouping divider, Open moved to the tab
    # line
    assert 'class="appbar-div"' in out
    assert 'id="tab-open"' in out
    _ap = out.index('id="tv-plots"')  # filter order plots→…→output-types
    assert (_ap < out.index('id="tv-markdown"') < out.index('id="tv-code"')
            < out.index('id="ck-filter-btn"') < out.index('id="tv-output"')
            < out.index('id="ot-filter-btn"'))


def test_tree_view_ribbon_disables_filters_and_anchors_right(out):
    """Tree view: filters are DISABLED, not removed.

    A control that vanishes drags its neighbours' positions with it, and
    the Size stepper drives the tree zoom from the same place on the
    ribbon.
    """
    assert "function syncTreeRibbon" in out
    # tree view REMOVES the filter sections; Size/View/App are anchored to
    # the right by an auto margin so they do not slide into the hole
    # icon-only buttons need a WIDTH floor, not just padding:0 -- with
    # nothing to stop them they were squeezed to 9px in a tight bar
    assert "width:34px;min-width:34px;flex:none;" in out
    assert "#ab-app .btn-grp>*{flex:none;}" in out
    assert "#ab-size{margin-left:auto;}" in out
    # in tree view the right-hand block starts at the Tree section, so its
    # controls sit WITH the others instead of marooned at the far left
    assert "body.tree-mode #ab-tree{margin-left:auto;}" in out
    assert "body.tree-mode #ab-size{margin-left:0;}" in out
    # the tree's own controls are ON THE RIBBON, in the Filters slot
    assert 'id="ab-tree"' in out and 'id="tree-expand"' in out
    assert 'id="tree-collapse"' in out and 'id="tree-width"' in out
    assert "body.tree-mode #ab-tree{display:flex!important;}" in out
    assert ".abgrp[hidden]{display:none!important;}" in out


def test_lineage_sidebar_and_restorable_hash_routing(out):
    """plot-trace tabs get a real sidebar (lineage nav) and Tree view, and
    URL routing gives a unique, restorable hash per view (#/doc/<stem>,
    #/pres/...).  In-app nav uses replaceState (no back-stack flood); a
    late-mounting tab (web restore) satisfies a still-pending initial
    route.
    """
    assert "aria-label','Plot lineage'" in out.replace('"', "'")
    # URL routing: a unique, restorable hash per view (#/doc/<stem>, #/pres/…)
    assert "function applyHash" in out and "APP.updateHash=updateHash" in out
    assert "'#/doc/'" in out and "'#/pres/'" in out
    assert "window.SemApp.deckOpen" in out and "window.SemApp.deckState" in out
    assert "window.SemApp.deckGo" in out   # move slide without reopening mode
    assert "APP.applyInitialRoute" in out and "'hashchange'" in out
    # in-app nav uses replaceState (no back-stack flood); a late-mounting tab
    # (web restore) satisfies a still-pending initial route
    assert "history.replaceState" in out and "pendingRoute" in out
    assert "document.addEventListener('sem:shell'" in out


def test_app_buttons_sit_in_the_tab_row_not_the_ribbon(out):
    """Theme / Support / Help live at the right of the tab row.

    As the ribbon's last group they were the first thing to wrap, and below
    roughly 1500px they claimed a whole row for three icon buttons -- 50px
    of chrome, and a wide empty band under the filters. The tab row is
    always rendered and always has room at its right, so moving them there
    makes the ribbon one row at every width.
    """
    # the group is inside the tab row, after the tab strip
    assert out.index('id="tabstrip"') < out.index('id="ab-app"')
    assert out.index('id="ab-app"') < out.index('class="stylebar"')
    # ...and styled for that row rather than for a captioned ribbon group
    assert (".tabsrow #ab-app{margin-left:auto;justify-content:center;"
            "padding:0 10px;" in out)
    assert ".tabsrow #ab-app .abgrp-lab{display:none;}" in out
    # all three buttons came with it
    for button in ('id="theme-btn"', 'id="support-btn"', 'id="help-btn"'):
        assert button in out, button
