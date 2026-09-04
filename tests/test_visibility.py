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

from junoview.notebook.parser import parse_notebook


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
    # counts: "dataset (3)" — via the shared row builder
    assert "var otCounts={};" in out
    assert "typeMenuRow('ot',t,otCounts[t]||0,'ot-sw-'+t)" in out
    # the per-type tri-state, cycling like the main filters
    assert "function typeMenuRow" in out
    assert "st.className='ckf-state';" in out
    assert "writeF(function(s){s[map][t]=nx;});" in out
    # a folded output leaves a per-output stub that reopens just itself
    assert ".cb-out>.ot-fold:not(.ot-open){display:none!important;}" in out
    assert "stub.className='ot-stub';" in out
    # reset re-attaches every type to the overall filter — notebook-wide,
    # so a stale override in an untargeted section (or the default)
    # cannot survive it
    assert "typeMenuReset('ot','ot-reset')" in out
    assert "rs.textContent='Reset: match '+MENU_LABEL[map];" in out
    assert "FDEFof(stem)[map]={};" in out
    assert "if(k.indexOf(pre)===0) secF[k][map]={};" in out
    # legacy 1 still reads as 'hidden', and map equality compares VALUES
    assert "function otVal(v)" in out
    assert "return v?'hidden':null;" in out
    assert "if(otVal(x[kx[i]])!==otVal(y[kx[i]])) return false;" in out
    # a type with no override follows the overall filter it belongs to
    assert "vals[otVal(s[map][t])||s[key]]=1;" in out
    # -- hardened by the adversarial review (2026-08-04): --
    # an override for a type ABSENT from the notebook (saved layout, re-run
    # notebook) still renders a row (count 0), still enables the reset, and
    # the reset clears the WHOLE notebook, not just the targeted sections
    assert "function overriddenTypes" in out
    assert "if(rs) rs.disabled=!overriddenTypes(p[1]).length;" in out
    # switching tabs closes EVERY picker — a stale menu wrote the old
    # notebook's overrides into the new notebook's state
    assert out.count("closeFilterMenus();") >= 1
    # entering/leaving per-type mode keeps what the reader had open
    assert "var wasPartOpen=out.classList.contains('part-open');" in out
    assert "if(hadOtOpen&&outState==='collapsed')" in out
    # the whole row cycles, like the old full-row checkbox label did
    assert "if(e.target!==st) st.click();" in out


def test_code_and_plot_type_menus_are_tri_state_like_the_output_menu(out):
    """ALL THREE type menus speak the same language (2026-08-04, user:
    "what happened to the filter options being more complete with the
    on, off, fold / usage").

    Every row: dot, "name (count)", and the type's own On/Fold/Off via
    the shared builder; every menu ends in its own reset. A code type's
    Fold folds those cells' code behind its toggle; a plot type's Fold
    folds each of that library's frames to a slim stub strip that opens in
    place. A plot type set to On shows even under Plots = Off.
    """
    assert "var ckCounts={};" in out and "var ptCounts={};" in out
    assert "typeMenuRow('ck',t,ckCounts[t]||0,'ckmain-'+t)" in out
    assert "typeMenuRow('pt',t,ptCounts[t]||0,'pt-sw-'+t)" in out
    assert "typeMenuReset('ck','ck-reset')" in out
    assert "typeMenuReset('pt','pt-reset')" in out
    # code: the per-type + per-label states reach both hiding and folding
    assert "var ckEff=ckExp.length?ckExp.reduce(stricterState):codeState;" in out
    assert "var eff=exp.length?exp.reduce(stricterState):s.code;" in out
    # plots: any override switches the part to per-frame mode (exactly the
    # output part's model) with fold stubs; On-under-Off follows for free
    assert ".cb-fig [data-pt].pt-fold{cursor:pointer;" in out
    assert '"\\25b8  " attr(data-pt)' in out
    assert "var ptAnyOv=Object.keys(ptHidden).length>0;" in out


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


def test_plots_filter_by_author_label_titled_vs_untitled(out, items):
    """Plots filter by whether the author LABELLED them (2026-08-04).

    A figure is "titled" when the author added a `#| title:`, a
    `#| caption:`, or a leading `#` comment heading — a name derived from
    function names or code lines is bookkeeping, not labelling. The
    Plot-types menu lists plain titled/untitled rows in the one list
    (count + On/Fold/Off like every other row — no sub-heading), shown
    only when the notebook has both kinds. A frame combines its library state with its
    label state restrictively, and any explicit override beats the
    inherited overall Plots state — so "only show titled plots" is:
    untitled → Off.
    """
    # the demo's figures all carry #| title: — labelled
    clim = [it for it in items if it.anchor == "clim"][0]
    assert clim.labelled is True
    assert 'data-labelled="1"' in out
    # a bare figure cell (no title/caption/leading comment) is NOT
    bare = parse_notebook({"cells": [
        {"cell_type": "code", "source": "plot()",
         "outputs": [{"output_type": "display_data",
                      "data": {"image/png": "aGk="}}]}]})
    bare_item = [i for s in bare.sections for i in s.items][0]
    assert bare_item.labelled is False
    # ...while a leading `# comment` heading IS an author label
    led = parse_notebook({"cells": [
        {"cell_type": "code",
         "source": "# Sea surface temperature\nplot()",
         "outputs": [{"output_type": "display_data",
                      "data": {"image/png": "aGk="}}]}]})
    led_item = [i for s in led.sections for i in s.items][0]
    assert led_item.labelled is True
    # menu: label tallies + plain rows in the single list (no sub-heading)
    assert "ptCounts[lab]=(ptCounts[lab]||0)+1;" in out
    assert "'by label'" not in out
    assert "typeMenuRow('pt','titled'," in out
    assert "typeMenuRow('pt','untitled'," in out
    assert ".ckf-dot.pt-sw-titled" in out
    # restrictive combination; explicit beats inherited
    assert "function stricterState" in out
    assert "var vl=otVal(ptHidden[cardLab]); if(vl) exp.push(vl);" in out
    assert "var eff=exp.length?exp.reduce(stricterState):plotState;" in out
    # code cells have titles too: the SAME rows in the Code-types menu,
    # keyed on the card-level data-labelled stamp
    assert "typeMenuRow('ck','titled'," in out
    assert "typeMenuRow('ck','untitled'," in out
    assert "ckCounts[lab]=(ckCounts[lab]||0)+1;" in out


def test_plot_call_titles_name_untitled_figure_cards():
    """A figure with no `#| title:` and no comment heading takes the
    title its own plot call carries (2026-08-04): fig.suptitle first,
    else a single distinct axes-level title (ax.set_title / plt.title /
    title=). Literal strings only — an f-string cannot be resolved
    without running the cell. Directives and leading comment headings
    still win, and a plot-call title makes the cell "titled" for the
    labelled/unlabelled filters.
    """
    png = {"output_type": "display_data", "data": {"image/png": "aGk="}}

    def item_of(src):
        doc = parse_notebook({"cells": [
            {"cell_type": "code", "source": src, "outputs": [png]}]})
        return [i for s in doc.sections for i in s.items][0]

    # ax.set_title literal -> the card title, and it counts as labelled
    it = item_of("fig, ax = plt.subplots()\nax.set_title('DJF mean height')")
    assert it.title == "DJF mean height" and it.labelled is True
    assert it.title_echo is False
    # figure-level suptitle beats axes titles
    it = item_of("fig.suptitle('Whole figure')\nax.set_title('One panel')")
    assert it.title == "Whole figure"
    # several DISTINCT axes titles name no one card...
    it = item_of("ax1.set_title('A')\nax2.set_title('B')")
    assert it.title != "A" and it.labelled is False
    # ...but the same title repeated across panels is unambiguous
    it = item_of("ax1.set_title('Same')\nax2.set_title('Same')")
    assert it.title == "Same"
    # f-strings cannot be resolved -> skipped, cell stays unlabelled
    it = item_of("ax.set_title(f'{var} anomaly')")
    assert it.labelled is False
    # a leading `#` comment heading still wins over the plot call
    it = item_of("# My banner\nax.set_title('Plot title')")
    assert it.title == "My banner"
    # the title= keyword (plotly express, pandas/xarray .plot) works too
    it = item_of("px.line(df, title='Trend over time')")
    assert it.title == "Trend over time" and it.labelled is True


def test_filter_menu_and_pager_javascript_wiring(out):
    """One advanced filter menu at a time.

    Doc filter state never rides into slide clones; hidden pager pages
    defer their plotly draw to the flip.
    """
    assert "function closeFilterMenus" in out
    # the strip selector carries every filter class INCLUDING the per-type
    # fold — a folded output must arrive on a slide in full
    assert ("'.pt-off,.pt-fold,.ot-off,.ot-fold,.part-off,.part-fold,"
            ".code-off'" in out)
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
    # (the type menus' checkboxes are gone — per-section disagreement now
    # reads "Mix" on their cyclers, so no cb.indeterminate remains)
    assert "scope-chev" in out
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

    T256 dropped the `padding:0; justify-content:center` half of the rule.
    That existed only to centre a lone funnel glyph in a wide box; the
    buttons carry the word "Choose" now, so they are laid out like every
    other worded sub button. What this test is here for -- the picker
    spanning the width of the filter above it rather than sitting under
    it as a square -- is unchanged.
    """
    assert ("#pt-filter-btn,#ck-filter-btn,#ot-filter-btn"
            "{width:100%;flex:none;}" in out)
    # ...and it is a word plus an icon, never the bare funnel again
    for bid in ("pt-filter-btn", "ck-filter-btn", "ot-filter-btn"):
        btn = out.split(f'id="{bid}"')[1].split("</button>")[0]
        assert '<span class="btxt">Choose</span>' in btn, bid
    # Help's own square rule is gone (T260). Its comment said "Help is
    # icon-only and stands alone", but Help has carried the word "Help"
    # for a long time -- so the 28px box just made the word paint over
    # its neighbour. It is sized by its content now, like every other
    # worded button, which is what this test's own principle asks for.
    assert "#help-btn{padding:0;justify-content:center;" not in out
    assert 'id="help-btn"' in out and "> Help</button>" in out.replace(
        "</i> Help</button>", "> Help</button>")
    # the width comes from the column, so there is nothing to keep in sync
    assert ".fgrp{flex:none;display:flex;flex-direction:column;" \
           "align-items:stretch;" in out


def test_one_predicate_decides_who_sees_an_item(out):
    """TASKS T31. renderAnnots already calls itself the funnel every
    slide render passes through, and it is right: the stage, the
    presenter view, the notes editor's preview and the PDF pages all
    arrive there. So "should this be drawn" is asked once, beside the
    `hide` flag it sits next to -- rather than in each of the four
    callers, which is how three of them would agree and the fourth
    would leak.
    """
    assert "function privShown(){return privCtx||mode==='edit';}" in out
    assert "if(a.priv&&!privShown()) return;" in out
    # arrows are drawn in a second pass and get the same question
    assert "if(a.priv&&!privShown()) return;      /* T31 */" in out


def test_hide_and_priv_are_deliberate_opposites(out):
    """`hide` is hidden from YOU while you work and drawn for everyone
    afterwards; `priv` is drawn for you and never for anyone else. They
    sit on adjacent lines because reading them together is the only way
    either name makes sense.
    """
    assert "if(a.hide&&editing) return;" in out
    i = out.index("if(a.hide&&editing) return;")
    assert "if(a.priv&&!privShown()) return;" in out[i:i + 400]


def test_a_private_render_has_to_ask_for_it(out):
    """`priv` is opt-in on buildSlideNode, so the default is the safe
    one: a render path added next year shows nothing private unless it
    asks, rather than leaking until somebody notices. And the flag is
    restored rather than cleared, so a private render cannot bleed into
    the next one.

    Verified in a browser: presenting drew one of two shapes, the notes
    editor's preview (the other buildSlideNode(i,true) caller) drew both
    with one marked, and presenting again straight afterwards drew one.
    """
    assert "function buildSlideNode(i,priv){" in out
    assert "var savedPriv=privCtx;" in out
    assert "privCtx=!!priv;" in out
    assert "privCtx=savedPriv;" in out
    assert "buildSlideNode(pr[1],true)" in out


def test_powerpoint_asks_the_question_itself(out):
    """The .pptx writer walks the annots directly rather than going
    through renderAnnots, so it cannot inherit the answer -- and a
    private note reaching a .pptx is the exact failure this exists to
    prevent. The PDF path needs no guard of its own because it renders
    through attachAnnots like everything else.
    """
    i = out.index("function pptxItems(s,note,ink,layer){")
    assert "if(a.priv) return;" in out[i:i + 1200]


def test_a_private_item_looks_private_in_both_places_it_is_drawn(out):
    """One marking pass rather than a class in each of the nine branches
    that build an item -- and in the presenter view as well as the
    editor, because the question it answers is "can the audience see
    this", and an unmarked one looks exactly like a slide that is about
    to embarrass you.
    """
    assert "function markPrivateItems(layer,s){" in out
    assert ("$$('.an-item[data-idx],.an-arrow-line[data-idx]',layer)"
            in out)
    # attached arrows are rebuilt after their figure finishes fitting;
    # that second path must restore the marker too
    assert out.count("markPrivateItems(layer,s);") == 2
    start = out.index("function renderAnnots(layer,s){")
    render = out[start:out.index("  function selectAnnot(", start)]
    assert render.index("layer.appendChild(svgTop);") \
        < render.index("markPrivateItems(layer,s);")
    assert "if(a&&a.priv) el.classList.add('an-priv');" in out
    assert ".an-item.an-priv{outline:1.5px dashed" in out
    assert '.an-item.an-priv::after{content:"only me"' in out
    # an SVG path cannot render ::after, so the visible line itself gets
    # the amber signal without replacing its chosen colour or dash
    assert ".an-arrow-line.an-priv{filter:drop-shadow(" in out
    assert ".an-arrow-line.an-priv.sel{filter:" in out


def test_review_privacy_has_one_audience_population(out):
    """T49. The review body already dropped private things, but three
    side doors disagreed: a tied caption bypassed that guard, private text
    could count as a figure mention, and private objects inflated only the
    item half of the density sentence.

    Each now uses the same public population as the markdown it explains.
    """
    assert "function reviewCaption(sl,a){" in out
    assert "return ca&&!ca.hide&&!ca.priv?ca:null;" in out
    start = out.index("function revFigLine(sl,a,map){")
    figure = out[start:out.index("  function revHeading(sl){", start)]
    assert "var ca=reviewCaption(sl,a);" in figure
    assert "var cap=ca?revText(ca).trim():'';" in figure
    assert "figSubst(cap,ca,map)" in figure

    start = out.index("function reviewLints(){")
    lints = out[start:out.index("  /* THE PANEL.", start)]
    text_pool = lints[lints.index("var texts=[];"):
                      lints.index("/* --- 1.")]
    figure_lint = lints[lints.index("/* --- 1."):
                        lints.index("/* --- 2.")]
    caption_lint = lints[lints.index("/* --- 2."):
                         lints.index("/* --- 4.")]
    density_lint = lints[lints.index("/* --- 4."):
                         lints.index("/* COLLECT THE SURFACES")]
    assert "if(!a||a.hide||a.priv) return;" in text_pool
    assert "if(!isFigure(a)||a.hide||a.priv) return;" in figure_lint
    assert "if(reviewCaption(sl,a)) return;" in figure_lint
    assert "if(!a||a.hide||a.priv||a.k!=='text') return;" in caption_lint
    assert "return a&&!a.hide&&!a.priv&&!a.capOf;" in density_lint


def test_the_menu_says_what_the_promise_actually_is(out):
    """A private item is not drawn for the audience and never reaches a
    PDF or a .pptx. It IS stored in the deck, exactly as speaker notes
    are, so a deck FILE handed to somebody contains it -- because a
    private note that does not survive a reload is not a feature. The
    tooltip says which of the two it is rather than implying the
    stronger one.
    """
    assert "function setPrivSel(on){" in out
    assert "if(on) a.priv=1; else delete a.priv;" in out
    assert "menuHead(m,'who sees it');" in out
    assert "+'to the audience, or in a PDF or PowerPoint','eye');" in out


# ---------------------------------------------------------------------------
# what a picture says it shows (T105)
# ---------------------------------------------------------------------------
#
# Every image the deck drew carried alt="" -- the markup for "this
# carries no information, skip it" -- asserted for every figure in the
# deck, including the ones carrying the science. Browser-verified
# 2026-08-30 over an imported three-image deck: one with alt got its
# alt and no aria-hidden, one marked decorative got alt="" plus
# aria-hidden="true", one with neither fell back to its object name, and
# the review reported exactly that third one.


def test_the_renderer_has_three_answers_not_one(out):
    """alt="" is one of them, not the default. Browser-verified: the
    three states came out as written."""
    assert "function altAttrs(img,a,extra){" in out
    # decorative: empty alt AND aria-hidden, because empty alt alone
    # still leaves the element in the tree as an unnamed image
    assert "img.setAttribute('aria-hidden','true');" in out
    # written: what the author wrote
    assert "var t=(a&&a.alt)||annotLabel(a)||'';" in out
    # neither: the object's own name beats "unlabelled image"
    assert "img.alt=t;" in out


def test_the_one_funnel_is_where_it_happens(out):
    """buildSlideNode and buildPrintRoot both go through renderAnnots and
    exportDeckHtml serialises buildPrintRoot, so present mode, the
    presenter view, PDF and the standalone HTML all follow from this one
    site -- and none of them needed touching."""
    assert "altAttrs(img,a);" in out
    assert "altAttrs(fim,a,fdef&&fdef.label);" in out
    # the hard-coded empties are gone from the two annotation images
    assert "img.className='an-imgel';img.src=a.src||'';img.alt='';" not in out
    assert "fim.className='an-flipimg';fim.src=fdef.src;fim.alt='';" not in out


def test_the_thumbnails_say_they_are_decorative(out):
    """These five really ARE decorative -- a thumbnail is a picture of
    something already named beside it -- so aria-hidden states it rather
    than leaving a screen reader to infer it from an empty alt."""
    assert out.count("/* decorative (T105) */") == 4
    assert "im.src=src;im.alt='';im.setAttribute('aria-hidden','true');" in out


def test_alt_text_has_a_door_that_costs_no_ribbon_width(out):
    """The ribbon never wraps, so a control for one kind of object earns
    its place on the menu that already knows what you clicked -- the same
    reasoning as T5's select-by-type. Offered only when the selection
    actually holds a picture: a row that does nothing is worse than no
    row."""
    assert "function setAltText(idxs){" in out
    assert "return a&&(a.k==='image'||a.k==='flip');});" in out
    assert "if(altSel.length){" in out
    # the label says which of the three states this picture is in
    assert "'Alt text \\u2014 marked decorative'" in out
    # empty means decorative, and the prompt says so -- "I have not
    # written this yet" and "there is nothing to write" must not look
    # the same
    assert "if(got){delete a.dec;a.alt=got;}" in out
    assert "else {delete a.alt;a.dec=1;}" in out
    # cancel changes nothing, which is what Escape has to mean
    assert "if(got===null) return;" in out


def test_the_review_reports_only_the_undecided_pictures(out):
    """NOT "has no alt text": a picture is allowed to carry nothing, and
    saying so is a real answer. The only state worth reporting is the one
    nobody has decided about. Browser-verified: of three images -- one
    described, one decorative, one neither -- the review named exactly
    one."""
    assert "This picture does not say what it shows" in out
    assert "if(a.dec||(a.alt&&String(a.alt).trim())) return;" in out


def test_the_export_carries_the_description(out):
    """descr is what PowerPoint's own accessibility checker reads. It is
    one attribute and it had nowhere to come from until the deck grew the
    field."""
    assert "function descrAttr(item) {" in out
    assert "if (item.dec) return '';" in out
    assert "return item.alt ? ' descr=\"' + esc(item.alt) + '\"' : '';" in out
    assert "alt:a.alt,dec:a.dec," in out


# ---------------------------------------------------------------------------
# the review is one report (T121)
# ---------------------------------------------------------------------------
#
# Seven checking surfaces already shipped -- preflight, reviewLints,
# standardise, tidyFindings, provState/staleFigures, renderReh and
# deckDiff. So this is consolidation, not new machinery: the two lints
# added here restate what the deck already knew, and the exports carry
# what the panel already showed.


def test_the_review_says_whether_the_talk_fits(out):
    """Every part of this existed and none of it was a LINT. slideGoal
    and goalTotal add the goals up, rehStats holds what each slide
    actually took, and the notes pane shows the verdict WHILE YOU ARE
    PRESENTING -- which is the wrong moment. The review is where there
    is still time to cut a slide.
    """
    assert "head:over>0?'This runs long':'This runs short'," in out
    assert "var st=rehStats(),runs=(st.runs||[]).length;" in out
    # only when most of the deck has really been rehearsed: half a run
    # extrapolated to a whole talk is a number that looks like evidence
    assert "if(timed>=Math.ceil((pres.slides||[]).length/2)&&real){" in out
    # and only when the gap is worth saying
    assert "if(Math.abs(over)>=Math.max(1,goal*0.1))" in out


def test_the_review_notices_a_slide_that_is_a_copy(out):
    """A duplicate left in by accident reads as a stutter; one left in on
    purpose usually wanted a build. An EMPTY slide is not a copy, which
    is why there is a length floor."""
    assert "head:'This slide is a copy of an earlier one'," in out
    assert "if(!key||key.length<20) return;" in out


def test_the_exported_review_carries_the_findings(out):
    """The panel showed the findings and the readable text side by side
    and then exported only the text -- so the half you would send to a
    co-author was the half without the findings in it."""
    assert "function reviewMarkdown(text,lints){" in out
    assert "var head='## What this review found" in out
    assert "reviewMarkdown(text,lints)" in out


def test_there_is_a_door_for_something_that_is_not_a_person(out):
    """JSON, for a pre-submission check. It reads the SAME lints the
    panel just rendered rather than recomputing, so an export cannot
    disagree with what you were looking at."""
    assert "function reviewJson(lints){" in out
    assert "findings:lints.map(function(l){" in out
    assert "severity:l.sev,slide:(l.si==null?null:l.si+1)," in out
    assert "'.review.json'" in out
    assert 'id="rv-json"' in out
    # words AND an icon, like every other control here
    assert "+' Save as .json</button>'" in out
    assert "bic('code')" in out


def test_the_review_head_compacts_rather_than_wrapping(out):
    """The house rule for every control row, and T121 put a fourth
    button in this one. `.rv-head` is a nowrap flex row, so the risk is
    not a second line but a squashed button -- the TITLE is what gives
    way, and the buttons do not shrink."""
    assert ".rv-head .dbtn{flex:0 0 auto;}" in out
    assert "white-space:nowrap;text-overflow:ellipsis;}" in out
