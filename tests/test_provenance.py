"""Where a figure came from: dependency chains and every surface that shows
them. Chains are built from declared `#| depends:` plus AST-traced
variables, and markdown notes join a chain when they name a variable in
backticks (but never on a bare prose word). The surfaces: the plot-trace tab
opened from a card, the reusable trace component shared by the docs popup
and the presentation trail, the playback trace partitioned by section id,
and the dependency tree view with its ergonomics (zoom, width presets,
barycenter layout, edge rerouting, dark theme, expand-all opening the code,
and its ribbon tools).
"""

from __future__ import annotations

from junoview.notebook.parser import parse_notebook


def test_code_chains_from_depends_and_traced_variables(out, items):
    """Code chains: declared depends (clim <- load) and AST-traced variables
    (fig2 reads ds, which cell:c-prep assigned)."""
    by_anchor = {it.anchor: it for it in items}
    assert by_anchor["clim"].chain == ["load"]
    assert by_anchor["fig2"].chain == ["cell:c-prep"]
    assert '"chain": ["cell:c-prep"]' in out


def test_plot_trace_opens_a_real_docs_subset_tab(out):
    """docs "view plot trace" opens a NEW TAB: the docs view subset to the
    plot's lineage cells (a real .nbshell, all filters live) + a graph.

    An inactive trace tab must still hide, a placed clone resolves to its
    source notebook, the tab shares the docs per-card wiring (so it is a
    true subset and not a widget), and it nests as a SUB-tab under its
    source notebook tab.
    """
    assert 'class="plot-trace-btn"' in out and "function openTraceTab" in out
    assert "function plotGraph" in out and ".nbshell.tracetab" in out
    assert "window.SemTrace" in out and ".pg-node" in out
    assert "APP.openTraceTab" in out and "APP.traceGoto" in out
    # an inactive trace tab must still hide: the display rule is scoped so
    # it never overrides .nbshell[hidden]{display:none}
    assert ".nbshell.tracetab:not([hidden]){display:grid" in out
    # a placed clone resolves to its source notebook (dataset.src)
    assert "shell.dataset.src=stem" in out
    # the trace tab shares the docs per-card wiring (true subset, not a
    # widget)
    assert ("function wireCardBehaviors" in out
            and "APP.wireCardBehaviors" in out)
    # a trace tab renders as a SUB-tab nested under its source notebook
    # tab
    assert "tab-sub" in out and "function makeTab" in out


def test_notes_ride_the_trace_but_stay_out_of_graph_and_slides(out):
    """A markdown note that NAMES a variable is linked into that
    variable's plot trace: it rides along as a trace CARD
    (``up.kind==='note'``) but is excluded from the dependency graph
    (``s.kind!=='note'``, avoids note<->definer cycles) and never leaks a
    code trail into the presentation (note frames).
    """
    assert "up.kind==='note'" in out
    assert "s.kind!=='note'" in out
    assert "f.it.kind==='note') return" in out


def test_note_links_to_backticked_variables_but_not_plain_words():
    """A note naming `ridge_index` in backticks joins that figure's chain.

    A plain-word variable named in prose (no backticks) must NOT
    over-link -- otherwise every common English word in a paragraph would
    drag the note into unrelated traces.
    """
    _lnb = parse_notebook({"cells": [
        {"cell_type": "code", "source": "ridge_index = 1", "outputs": []},
        {"cell_type": "markdown",
         "source": "The `ridge_index` and z500 matter."},
        {"cell_type": "code", "source": "z500 = 2", "outputs": []},
        {"cell_type": "code", "source": "fig = ridge_index + z500",
         "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]})
    _lnote = [it for s in _lnb.sections for it in s.items if it.is_note][0]
    _lfig = [it for s in _lnb.sections for it in s.items
             if it.kind in ("figure", "diagnostic")][0]
    assert (_lnote.anchor or _lnote.item_id) in _lfig.chain  # note rides along
    assert _lnote.chain                                    # note -> its vars
    # a plain-word variable named in prose (no backticks) must NOT
    # over-link
    _pnb = parse_notebook({"cells": [
        {"cell_type": "code", "source": "warm = 1", "outputs": []},
        {"cell_type": "markdown", "source": "We study warm events in summer."},
        {"cell_type": "code", "source": "fig = warm + 1", "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]})
    _pnote = [it for s in _pnb.sections for it in s.items if it.is_note][0]
    _pfig = [it for s in _pnb.sections for it in s.items
             if it.kind in ("figure", "diagnostic")][0]
    assert (_pnote.anchor or _pnote.item_id) not in _pfig.chain


def test_code_trace_is_one_reusable_component(out):
    """The code trace is one reusable component (presentation + docs
    popup) rather than two copies of the same renderer.
    """
    assert "vo-eye" in out and "function renderTrace" in out
    assert "function traceNode" in out and "function lineageForItem" in out


def test_trace_tab_carries_its_own_view_switcher(out):
    """the trace tab carries its own "Cells | Tree" switcher in its header
    (same lineage as list or expandable dependency columns; the appbar
    Tree button stays in sync via a class MutationObserver)
    """
    assert "trace-viewsw" in out and "function setTraceView" in out
    assert ".dbtn.tvw.on{background:var(--cyan-deep)" in out


def test_playback_trace_partitions_by_section(out):
    """Trace partitions by notebook section; playback frames are clean."""
    assert '"sectitle"' in out and '"subsection"' in out
    assert "vo-sec" in out and ".vpage .an-cellhead{display:none" in out


def test_playback_trace_partitions_by_section_id(out):
    """The playback trace partitions by section ID (same-titled sections
    stay apart) and labels the divider with the outline number."""
    assert "var sec=st.section||st.sectitle||''" in out
    assert '"secnum"' in out


def test_playback_trace_picks_one_thumbnail_and_reuses_the_tree(out):
    """playback code trace: with several plots, the thumbnails PICK whose
    trace shows (one at a time), and a Cells|Tree switch reuses the docs
    dependency tree under the slide (dark in both themes, no Present btn)
    """
    assert "var traceSel=0" in out and "traceView='cells'" in out
    assert "function traceTreeNode" in out and "vo-thumb-btn" in out
    assert "function relayoutTreeHost" in out
    assert ".deck-tracetree .tt-present{display:none" in out
    assert ".deck-tracetree .tree-node{" in out


def test_presentation_trail_has_its_own_filters_and_folds(out):
    """The presentation code-trail has its OWN Code-types / Output-types
    filters, and its sections collapse + hide (chevron + eye) like the
    docs do."""
    assert ("function traceFilterDropdown" in out
            and ".vo-step.vo-filtered" in out)
    assert "var traceCkHidden" in out and "function applyTraceFilter" in out
    # trail sections collapse + hide (chevron + eye), like the docs
    assert ".vo-sec-chev" in out and ".vo-sec-eye" in out
    assert ".vo-sec-body.vo-sec-fold{display:none" in out
    # the trail toolbar clears the up arrow, and its buttons match the docs
    # the sides are 78px since T69: playback gave up the stage's padding
    # so the slide can fill the screen, and the trail took the reading
    # margin over (2026-08-29)
    assert "padding:64px 78px 60px" in out
    assert ".vo-xall,.vo-fbtn{font-family:var(--mono);font-size:11px" in out


def test_tree_view_is_a_full_expandable_view(out):
    """Tree view (analysis graph as a full, expandable view) + a full-screen
    "present" mode for either the Narrative document or the Tree -- both are
    baked into every runtime (one _TEMPLATE), built client-side per shell."""
    assert 'id="view-tree"' in out and 'class="treeview"' in out
    assert ".nbshell.tree .content{display:none" in out
    assert ".nbshell.tree .treeview{display:block" in out
    assert "function buildTree" in out and "function treeLayoutEdges" in out
    assert "function renderViewBtns" in out and "window.SemView" in out
    assert ("tree-lane" in out and "tree-node-head" in out
            and "tree-edge" in out)
    # each branch is tinted by the type of the node it feeds
    assert "if(nc) path.style.stroke=nc;" in out
    assert ".tree-edge.lit{stroke:var(--cyan)!important;" in out


def test_tree_view_ergonomics_and_edge_rerouting(out):
    """tree ergonomics: zoom -/100%/+ (edge layout divides by the canvas
    zoom), Width S/M/L presets (default M), per-cell corner resize, a
    barycenter pass aligning children under parents, and type-tinted
    nodes with the kind label in the type colour
    """
    assert "function treeZoomSet" in out and "tt-zoomval" in out
    # edges re-route on ANY node size change (expand / MathJax / image
    # decode / resize): ResizeObserver on every node + a timer pass that
    # survives rAF throttling
    assert "new ResizeObserver" in out and "host._ro=ro" in out
    assert "setTimeout(function(){treeLayoutEdges(host);},120)" in out
    assert "'tree-canvas tw-m'" in out
    assert ".tree-canvas.tw-l .tree-node{width:340px" in out
    assert "tn-resize" in out and "barycenter" in out
    assert "color-mix(in srgb,var(--nc)" in out
    assert ".navitem .dot{width:9px" in out


def test_tree_view_follows_dark_theme_and_unhide_all(out):
    """The tree view follows the DARK theme (nodes/canvas/toolbar were
    light-only), and "Reset" became "Unhide all" -- shown only while
    cells are eye-hidden.

    The rename matters: "Reset" read as though it would discard the whole
    arrangement, so people did not press it.
    """
    assert "body:not(.light) .tree-node{" in out
    assert "color-mix(in srgb,var(--nc) 12%,var(--chrome-3,#101c28))" in out
    assert "body:not(.light) .tree-scroll{border-color" in out
    assert "'Unhide all'" in out and "toolBtn('Reset'" not in out


def test_tree_tools_live_on_the_ribbon_and_expand_opens_code(out):
    """Expand all opens the CODE too, not just the node."""
    assert "APP.syncTreeTools=syncTreeTools;" in out
    assert "cw.setAttribute('data-open','1');" in out
    # ...and the floating toolbar it replaced is gone
    assert ".tree-toolbar{display:none;" in out
    assert "document.body.classList.toggle('tree-mode',isTree);" in out


def test_a_flip_book_has_provenance_like_any_other_figure(out):
    """isFigure counts a flip book as a figure, the save path treats its
    frames as refs exactly like a placed cell, and T18 numbers it. Only
    provOf disagreed -- it returned null for anything that was not
    k==='cell' -- so six notebook figures in one object had no
    provenance, no staleness answer and no way to be re-synced
    (2026-08-26 audit, T58).
    """
    assert "function provRef(a){" in out
    assert "if(a.k==='cell') return a.ref||'';" in out
    assert "var fr=flipFrames(a),sel=fr[a.at||0]||fr[0];" in out
    # provOf now asks provRef rather than testing the kind itself
    assert "var ref=provRef(a);\n    if(!ref) return null;" in out


def test_the_lineage_jump_leaves_the_deck_it_is_hidden_behind(out):
    """`.deck` is an opaque full-window overlay, so scrolling a card into
    view behind it produced no visible effect whatever -- from inside the
    editor the lineage buttons and "Open the plot trace" looked broken
    (2026-08-26 audit, T58).
    """
    assert "function provJumpOut(fn){" in out
    assert "if(typeof closeDeck==='function') closeDeck();" in out
    # BOTH jumps go through it, or the next one added forgets
    assert out.count("provJumpOut(function(){") == 2
    assert "b.title='Open this cell in its notebook (leaves the editor)';" \
        in out


def test_there_is_a_deck_wide_figure_update_and_not_only_a_per_figure_one(out):
    """provState could only ever answer for one annotation, because
    renderProvPane was its only caller. So there was no way to ask "has
    anything on this deck moved on?" -- while the parallel feature for
    pictures got both doors (2026-08-26 audit, T58).
    """
    assert "function staleFigures(){" in out
    assert "function resyncAllFigures(){" in out
    # the same door the picture half has, in the same menu
    assert 'id="mi-refresh-figs"' in out
    assert "menuAction('#mi-refresh-figs',function(){resyncAllFigures();});" \
        in out
    # saying nothing is stale is an answer too -- and since T123 it says
    # "source", because a .tex or a .csv is as refreshable as a notebook
    assert "Every figure on this deck already matches its source" in out
    # ...and the click re-reads each referenced tab from DISK first, so
    # "update" means the file, not whatever the open tab happened to hold
    assert "function refSourceStems(){" in out
    assert "return (APP.reloadTab?APP.reloadTab(st):Promise.resolve(false));" in out
    assert "window.SemDeckStaleFigures=staleFigures;" in out


def test_the_provenance_pane_has_a_ribbon_door_and_wears_icons(out):
    """Its only door was a canvas right-click row, while its three
    nearest neighbours -- Locate in notebook, Previous figure and the
    version lock -- all sit on the format bar and are all
    notebook-provenance commands for the selected frame.

    And every button the pane built was words-only, against the
    icon-plus-words convention every other pane follows.
    """
    assert 'id="fmt-prov"' in out
    assert "show('#fmt-prov',isNum&&!!provRef(a));" in out
    assert "if(pb) pb.addEventListener('click',showProvPane);" in out
    # icons on the three kinds of button the pane builds
    assert "b.innerHTML=bic('locate')+' ';" in out
    assert "jump.innerHTML=bic('route')+' Open the plot trace';" in out
    assert "up.innerHTML=bic('reload')" in out


def test_update_figures_re_reads_the_disk_first(out):
    """T123, driven live 2026-08-31: paper.tex's caption was edited ON
    DISK behind the app's back, and one click of File > "Update figures
    from their sources" re-read the tab in place and updated the placed
    frame -- toast "1 figure updated from its source" -- with the deck
    never closing. Before this, "update" compared against whatever the
    open tabs happened to hold, so a changed FILE meant a four-step
    dance across two surfaces.

    APP.reloadTab is the app-side half: /api/open with `stem` loads
    INTO the existing tab (refs keep resolving, the rail grows no
    twin), quietly, returning completion so the deck can sequence the
    comparison after the re-read. URL-backed tabs return false -- a URL
    is not the disk. Web mode skips the reload half honestly: a dropped
    file left no handle to re-read.
    """
    assert "APP.reloadTab=function(stem){" in out
    assert "return api('/api/open',{path:path,stem:stem}).then(function(j){" in out
    assert "mountShellHTML(j.shell,j.path||path,true);" in out
    assert "if(!path||/^https?:/i.test(path)) return Promise.resolve(false);" in out
    # the deck side sequences: reload every referenced stem, THEN compare
    assert "var jobs=refSourceStems().map(function(st){" in out
    assert "return Promise.all(jobs).then(function(res){" in out
    # and the label finally says what the button now does
    assert "Update figures from their sources</button>" in out
