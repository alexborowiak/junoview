"""Sizing and furniture around a rendered cell. The size controls come first
because they are the least discoverable: the markdown/table text sizer and
the per-figure zoom both cascade CSS variables onto cards. The rest is the
card itself -- header actions anchored by the base stylesheet, kind badges
and their per-theme dots, the print/markdown badge vocabulary, titles
derived from untitled code, the multi-figure pager, the has-fig marker that
clones opt out of, and the full-screen viewer.
"""

from __future__ import annotations

from junoview.notebook.classify import _infer_kind, _title_from_code
from junoview.notebook.outputs import RenderedOutput
from junoview.notebook.parser import parse_notebook
from junoview.render.items import _BADGE, render_item, render_nav


def test_card_actions_anchored_by_base_stylesheet(out):
    """Card actions are anchored top-right by the BASE stylesheet.

    So a card keeps its header layout even where the deck CSS is absent.
    """
    assert ".cardhead .plot-trace-btn{margin-left:auto;flex:none;" in out
    assert ".cardhead .plot-trace-btn+.cell-eye{margin-left:0;}" in out


def test_multiple_figures_render_as_a_pager(out):
    """Several figures from one cell -> pager, one figure at a time."""
    assert 'class="figpager" data-n="2"' in out
    assert 'class="figpage current"' in out and "fp-next" in out
    assert "1 / 2" in out


def test_badge_wording_is_print_and_markdown():
    """Printed output (incl. a bare expression) reads "print".

    Markdown notes read "markdown" (not "note"); "metric" is gone -- a
    printed value IS print. The key groups its dots with dividers
    (markdown | plots | code | output).
    """
    assert _BADGE["text"] == "print" and _BADGE["note"] == "markdown"
    assert _BADGE["metric"] == "print"
    assert _infer_kind([RenderedOutput("text", "5", ot="print")]) == "text"
    # the key groups its dots with dividers (markdown | plots | code | output)
    _knav = render_nav(parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "note text"},
        {"cell_type": "code", "source": "import os", "outputs": []},
        {"cell_type": "code", "source": "print(1)", "outputs": [
            {"output_type": "stream", "name": "stdout", "text": "1\n"}]}]}))
    assert "navkey-div" in _knav and ">markdown<" in _knav \
        and ">note<" not in _knav


def test_page_styles_code_kind_badges_per_theme(out):
    """The page ships the code-kind map and per-theme badge/dot styling."""
    assert '"codeKinds"' in out and "ckmain-function" in out
    assert "body:not(.light) .ckmain-data .badge" in out
    assert "body.light .navitem.ckmain-data .dot" in out


def test_untitled_code_cells_get_titles_from_their_code(doc, out):
    """Untitled code cells: function names become titles; a bare code line
    labels the nav but is not repeated as a card heading (title_echo)."""
    all_items = [it for s in doc.sections for it in s.items]
    assert any(it.title == "rescale()" and not it.title_echo
               for it in all_items)
    assert any(it.title == "result = rescale(data)" and it.title_echo
               for it in all_items)
    assert 'cardtitle echo' in out
    assert _title_from_code("def a():\n    pass\n\ndef b():\n    pass") \
        == ("2 functions (a, b)", False)
    assert _title_from_code(
        "import x\n\ndef a():\n    pass\n\ndef b():\n    pass") \
        == ("2 functions + code", False)


def test_figure_zoom_controls_present_placed_and_documented(out):
    """Figure zoom: per-figure -/+/expand, a feed-wide sizer and a
    full-screen viewer.

    The per-figure controls sit top-LEFT (a Plotly/Bokeh toolbar owns
    top-right) and cannot be clicked while invisible. Both the per-figure
    and the feed-wide control are documented in Help, so they are findable
    without hunting.
    """
    assert 'class="figzoom"' in out and "fz-in" in out and "fz-max" in out
    assert 'id="fig-bigger"' in out and 'id="fig-smaller"' in out
    assert "function openFigMax" in out and 'id="figmax-box"' in out
    assert ".figzoom{position:absolute;top:6px;left:6px" in out
    assert "opacity:0;pointer-events:none" in out
    assert "<h3>Figure size</h3>" in out and "Figures 100%" in out


def test_zoom_widens_the_card_and_the_figure_fills_it(out):
    """The zoom widens the CARD, so its border/header grow with the figure
    instead of the plot spilling outside its own cell.

    A roomier card is not a bigger plot: max-width only caps, so a zoomed
    figure must FILL its frame or nothing visibly changes. The width is the
    per-figure factor multiplied by the feed-wide one.
    """
    assert ".card.has-fig{--fz:1;" in out
    assert ".card.has-fig.zoomed .figframe img" in out
    assert "function syncZoomed" in out
    assert "width:calc(100% * var(--fz) * var(--fzall))" in out


def test_figure_cards_marked_has_fig_and_clones_opt_out(out):
    """A card holding an image gets has-fig, and a card cloned into a slide /
    tree / trace ignores it -- zoom chrome must never count as a plot."""
    assert 'has-fig' in render_item(parse_notebook({"cells": [
        {"cell_type": "code", "source": "plot()", "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]}).sections[0].items[0])
    # …and a card cloned into a slide / tree / trace ignores it
    assert ".an-cell .card.has-fig,.spane .card.has-fig" in out
    assert "function figCount" in out      # zoom chrome never counts as a plot


def test_markdown_size_control_scales_prose_and_tables(out):
    """Markdown/prose text scales with its own +/- control.

    Tables are text too -- both table sizes were hard-coded and sat out
    every text-size change until 2026-07-30.
    """
    assert 'id="md-bigger"' in out and 'id="md-smaller"' in out
    assert "--mdscale" in out \
        and "calc(15px * var(--mdscale) * var(--md-size,1))" in out
    assert "font-size:calc(13.5px * var(--mdscale,1) * " \
        "var(--md-size,1));" in out
    assert "font-size:calc(13px * var(--mdscale,1));" in out
