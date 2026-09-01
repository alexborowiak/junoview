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


def test_a_charts_marks_carry_the_series_they_belong_to(out):
    """T159, the enabling step for series-addressed build steps.

    chartSvg appended every mark straight onto the <svg>. The drawing
    loops have always KNOWN which series they were in -- they sit inside
    `d.series.forEach(function(se){...})` -- and threw that away on the
    append, leaving one flat bag of shapes. A build step cannot address
    what has no name, which is why "reveal this plot one line at a time"
    was impossible here and why every other tool does it by exporting N
    separate pictures of the same plot.

    Each series' marks now go in `<g data-series="NAME">` and everything
    that is not a series -- title, gridlines, axis and category labels --
    goes in the skeleton group, which is the split the slow reveal wants:
    axes first, then one series at a time.

    Keyed by NAME, never index. `chartResyncAll` already replaces
    `a.series` wholesale on a refresh and carries the author's per-series
    COLOUR across by matching `se.name`; a build order keyed the same way
    survives a column being added, removed or reordered upstream.
    PowerPoint's animation list is keyed to shape index, which is exactly
    why theirs breaks when the data moves under it.
    """
    assert "function seriesG(name){" in out
    assert "g.setAttribute('data-series',k);" in out
    assert "gSkel.setAttribute('data-part','skeleton');" in out
    # every mark-drawing branch routes through the group, none append flat
    assert "var gl2=seriesG(se.name);" in out      # line
    assert "var gs=seriesG(se.name);" in out       # scatter
    assert "var gb=seriesG(se.name);" in out       # bar
    # ...and a legend entry travels with its series, or it spoils the build
    assert "var gL=seriesG(se.name);" in out
    # the skeleton really does hold the non-series furniture
    assert "gSkel.appendChild(gl);" in out
    assert "if(a.title) gSkel.appendChild(" in out


def test_a_chart_refresh_carries_author_intent_across_by_name(out):
    """The precedent T159 builds on, pinned so it cannot quietly change.

    A refresh replaces `a.series` wholesale, so anything the AUTHOR chose
    per series has to be re-attached afterwards, and the only stable
    handle is the name. Colour already does this; the series build order
    will use the same match, which is what makes a build survive the data
    changing underneath it.
    """
    assert "var old={};chartParse(a).series.forEach(function(se){" in out
    assert "old[se.name]=se.color;});" in out
    assert "if(old[se.name]) se.color=old[se.name];});" in out


def test_a_series_build_takes_one_stop_per_series(out):
    """T160, RUN rather than read.

    "One annotation consumes several playback stops" was written for flip
    books, but it was never a flip-book idea -- it is the shape of every
    progressive reveal. A chart built by series is the same thing: the
    skeleton lands on the build's own stop and each series takes one
    after it, so a three-series chart is four clicks.

    The count is lifted out of the assembled IIFE and EXECUTED, because
    an off-by-one here is invisible to a substring test and fatal in a
    talk -- it would strand a series past the end of the slide.
    """
    import json
    import os
    import re
    import subprocess
    import tempfile

    import pytest

    from helpers_js import js_engine, lift_fn

    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng

    pal = re.search(r"var CHART_PALETTE=\[[^\]]*\];", out, re.S).group(0)
    body = "\n".join([pal,
                      lift_fn(out, "chartParse"),
                      lift_fn(out, "chartSeriesCount"),
                      lift_fn(out, "flipFrames"),
                      lift_fn(out, "textPages"),
                      lift_fn(out, "extraStops")])
    cases = (
        "const line3={k:'chart',ct:'line',"
        "cats:['a','b'],series:["
        "{name:'control',ys:[1,2]},"
        "{name:'treatment',ys:[2,4]},"
        "{name:'baseline',ys:[1,1]}]};"
        "console.log(JSON.stringify({"
        "count: chartSeriesCount(line3),"
        "pie: chartSeriesCount(Object.assign({},line3,{ct:'pie'})),"
        "built: extraStops(Object.assign({},line3,"
        "  {anim:{type:'fade',order:0,by:'series'}})),"
        "plain: extraStops(Object.assign({},line3,"
        "  {anim:{type:'fade',order:0}})),"
        "flip: extraStops({k:'flip',frames:[1,2,3,4],"
        "  anim:{type:'fade',order:0}}),"
        "text: extraStops({k:'text',anim:{type:'fade',order:0}})}));"
    )
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "r.js")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(body + "\n" + cases)
        r = subprocess.run(cmd + [p], capture_output=True, text=True,
                           env=env, timeout=90)
    assert r.returncode == 0, r.stderr[:1500]
    got = json.loads([ln for ln in r.stdout.splitlines()
                      if ln.startswith("{")][-1])
    assert got["count"] == 3
    # a pie's slices are CATEGORIES: "one series at a time" means nothing
    assert got["pie"] == 0
    # the skeleton takes the build's own stop, then one per series
    assert got["built"] == 3
    # a chart with no series build is still exactly one click
    assert got["plain"] == 0
    # and the generalisation must not have moved flip books
    assert got["flip"] == 3
    assert got["text"] == 0


def test_a_series_build_survives_its_data_being_re_read(out):
    """The build lives on `a.anim`, and a refresh replaces only `a.cats`
    and `a.series` -- so "reveal series one at a time" survives Update
    figures from their sources for free, and the stop count simply
    follows however many series the data now has.

    That is the differentiator over PowerPoint, whose animation list is
    keyed to shape INDEX and comes apart when the data moves under it.
    """
    i = out.index("function chartResyncAll(){")
    body = out[i:i + 1400]
    assert "a.cats=data.cats;a.series=data.series;" in body
    # nothing in the refresh touches the animation
    assert "a.anim" not in body
