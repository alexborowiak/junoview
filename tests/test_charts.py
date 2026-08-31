"""Native data-bound charts (T117).

A figure used to leave for PowerPoint as a picture, so nobody could
recolour a series on the other side. A chart annotation carries its
NUMBERS: drawn as plain SVG by the new deck part ``47-charts.js``, born
from a placed table (or a frame showing a table card, keeping ``ref``),
and exported by ``pptx.js`` as a real ``<c:chart>`` part — the bytes
half is pinned in ``test_pptx_bytes.py`` against the actual ZIP.

Driven live 2026-08-31 (port 8621): a ``data.csv`` tab's card placed in
a frame; the real right-click row "Turn into a chart" produced a bar
chart with ``ref: "data::table"`` and the table's numbers; the csv was
then edited ON DISK (a fourth row added) and one click of File →
"Update figures from their sources" re-read it — the chart showed Apr
with the new numbers while type and colours stayed. "✓ Bar" / Line /
Scatter / Pie rows switched the live SVG (polylines appeared); Edit
data… showed the CSV, applied a rewrite, and unlinked ``ref``; both
charts survived a full page reload through normPres and the project
file.
"""

from __future__ import annotations

from junoview import assets


def _out() -> str:
    return assets.deck_js()


def test_the_chart_part_is_real_and_listed():
    """Fragment + listing, both halves (AGENTS.md): a part nothing
    concatenates is dead code that still looks alive."""
    assert "47-charts" in assets.DECK_PARTS
    out = _out()
    assert "function chartSvg(a){" in out
    assert "function drawChart(layer,s,a,i){" in out
    assert "window.SemDeckChart={place:placeChart,dataOf:chartDataOf," in out


def test_the_renderer_dispatches_and_the_panes_can_name_it():
    out = _out()
    assert "drawChart(layer,s,a,i);" in out
    assert "'Chart \\u2014 '+(a.ct||'bar')" in out.replace("\n        +", "")


def test_a_chart_is_born_from_a_table_and_keeps_its_ref():
    """chartFromRows: first row names the series, first column is the
    category; a frame's card table is read off the open shell the way
    the provenance pane compares bodies (cloneBody)."""
    out = _out()
    assert "function chartFromRows(rows){" in out
    assert "if(a.k==='table') return chartFromRows(tableRows(a));" in out
    assert ("if(a.k==='cell'&&a.ref) return "
            "chartFromRows(chartRowsOfCard(a.ref));" in out)
    assert "row('Turn into a chart','',function(){" in out
    assert "row('Insert a chart','',function(){" in out


def test_update_figures_re_reads_the_chart_numbers_too():
    """The chart half of T123's one verb: provRef says yes for a chart
    (so its source tab reloads first), and the resync runs BEFORE the
    early return, or a deck whose only change was a chart would be told
    everything already matches. Position, type and colours stay."""
    out = _out()
    assert "if(a.k==='chart') return a.ref||'';" in out
    assert ("var cn=(typeof chartResyncAll==='function')"
            "?chartResyncAll():0;" in out)
    assert "if(!list.length&&!cn){" in out
    # hand-edited numbers unlink: the dialog deletes ref on apply
    fn = out[out.index("function chartDataDlg(idx){"):]
    fn = fn[:fn.index("function chartResyncAll")]
    assert "delete a.ref;" in fn


def test_powerpoint_gets_the_numbers_not_a_picture():
    """Deck side of the export: the chart item carries cats + series +
    the slide's ink (chart text on a dark slide must not leave black).
    The writer's bytes are proven in test_pptx_bytes.py."""
    out = _out()
    assert "items.push({t:'chart',x:box.x,y:box.y,w:box.w,h:box.h," in out
    pptx = assets.pptx_js()
    assert "function chartFrame(item, id, rid, page) {" in pptx
    assert "function chartXml(item) {" in pptx
    assert "'/relationships/chart'" in pptx.replace("DOC_NS + ", "")
    assert "drawingml.chart+xml" in pptx


def test_the_chart_kind_is_schema_and_validates_clean():
    from junoview.notebook.deck_schema import ANNOT_KINDS, validate_deck

    assert "chart" in ANNOT_KINDS
    problems = validate_deck([{"name": "d", "slides": [
        {"layout": "blank", "panes": [], "annots": [
            {"k": "chart", "x": 10, "y": 10, "w": 30, "h": 24,
             "ct": "bar", "cats": ["a", "b"],
             "series": [{"name": "S", "ys": [1, 2]}]}]}]}])
    assert not [p for p in problems if p.level == "error"], problems


def test_the_chart_dialog_and_styles_exist():
    out = _out()
    assert "p.className='sh-menu chart-data';p.id='chart-data';" in out
    css = assets.deck_css()
    assert ".an-chartsvg{" in css and ".chart-ta{" in css
