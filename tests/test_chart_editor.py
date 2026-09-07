"""The advanced chart editor (T322).

The user's list, item 3: "Advanced chart editor: stacked charts,
secondary axes, log axes, error bars, confidence bands, labels, trend
lines, per-series editing".

The arithmetic behind the picture -- the scales, the ticks, the fit, the
stacks -- is pure and RUN here; the helper-column convention that brings
error bars and bands in through the numbers is run too, both ways. The
export contract is driven: a chart with every switch goes out through
JunoPptx.build as real chart XML and comes back through the T320 reader
with the switches on.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets
from junoview.notebook.pptx_read import read_pptx

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "junoview"

_STUBS = """
var CHART_PALETTE=['#4fb3d9','#f0a848','#8fd18a','#e07a9a','#b39ddb','#f2d16b'];
"""
_FNS = ("chartStep", "chartScale", "chartTicks", "chartPos", "chartLinFit",
        "chartStackTops", "chartFmt", "chartParse", "chartFromRows",
        "chartCsvOf")


def _run(script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    pre = _STUBS + "\n".join(lift_fn(src, f) for f in _FNS) + "\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


# ---------------------------------------------------------- the arithmetic


def test_the_scale_comes_from_the_data_and_zero_only_for_bars():
    got = _run("""
      console.log(JSON.stringify({
        line:chartScale([95,98,105],{}),
        bar:chartScale([95,98,105],{zero:true}),
        neg:chartScale([-3,-8],{zero:true}),
        flat:chartScale([4,4],{}),
        empty:chartScale([],{}),
        log:chartScale([3,120,0,-5],{log:true}),
        logTicks:chartTicks(chartScale([3,120],{log:true})),
        ticks:chartTicks(chartScale([0,7],{zero:true})),
        pos:[chartPos({lo:0,hi:10,log:false},2.5),
             chartPos({lo:1,hi:100,log:true},10),
             chartPos({lo:1,hi:100,log:true},0)]}));
    """)
    # a span of 10 steps by 5 (chartStep), and the ends snap to it
    assert got["line"] == {"lo": 95, "hi": 105, "step": 5, "log": False}
    # zero forced for bars: a 0..105 span steps by 50 and tops out at 150
    assert got["bar"] == {"lo": 0, "hi": 150, "step": 50, "log": False}
    # all-negative bars: zero at the top, the floor snapped to the step
    assert got["neg"]["lo"] == -10 and got["neg"]["hi"] == 0
    assert got["flat"]["lo"] < 4 < got["flat"]["hi"]
    assert got["empty"] == {"lo": 0, "hi": 1, "step": 0.5, "log": False}
    # log: whole decades around the positive values, the rest ignored
    assert got["log"]["log"] is True
    assert (got["log"]["lo"], got["log"]["hi"]) == (1, 1000)
    assert got["logTicks"] == [1, 10, 100, 1000]
    assert got["ticks"] == [0, 2, 4, 6, 8]
    assert got["pos"][0] == 0.25 and got["pos"][1] == 0.5
    assert got["pos"][2] is None      # NaN: a log axis cannot place 0


def test_the_trend_line_is_least_squares():
    got = _run("""
      console.log(JSON.stringify({
        exact:chartLinFit([0,1,2,3],[1,3,5,7]),
        noisy:chartLinFit([1,2,3,4,5],[2,4,5,4,5]),
        one:chartLinFit([1],[2]),
        flatx:chartLinFit([2,2,2],[1,2,3])}));
    """)
    assert got["exact"]["m"] == pytest.approx(2) and got["exact"]["b"] == 1
    assert got["noisy"]["m"] == pytest.approx(0.6)
    assert got["noisy"]["b"] == pytest.approx(2.2)
    assert got["one"] is None and got["flatx"] is None


def test_stacks_pile_positives_up_and_negatives_down():
    got = _run("""
      var S=[{ys:[3,-1,2]},{ys:[2,-2,0]},{ys:[1,4,5]}];
      console.log(JSON.stringify({
        std:chartStackTops(S,3,false),pct:chartStackTops(S,3,true)}));
    """)
    std = got["std"]
    assert [s["y1"] for s in std[0]] == [3, -1, 2]
    assert [[s["y0"], s["y1"]] for s in std[1]] == [[3, 5], [-1, -3], [2, 2]]
    assert [[s["y0"], s["y1"]] for s in std[2]] == [[5, 6], [0, 4], [2, 7]]
    pct = got["pct"]
    assert pct[2][0]["y1"] == pytest.approx(100)          # 3+2+1 -> 100%
    assert pct[0][1]["v"] == pytest.approx(-100 / 7)      # of |−1|+|−2|+4


# ------------------------------------------------ the numbers door, both ways


def test_helper_columns_become_error_bars_and_bands():
    got = _run("""
      var rows=[['','Temp','Temp ±','Rain','Rain lo','Rain hi','Wind lo'],
                ['Jan','10','1','5','4','6','9'],
                ['Feb','12','2','7','6','8','8']];
      var d=chartFromRows(rows);
      console.log(JSON.stringify(d));
    """)
    names = [s["name"] for s in got["series"]]
    # "Wind lo" names no series, so it stays a series of its own
    assert names == ["Temp", "Rain", "Wind lo"]
    assert got["series"][0]["err"] == [1, 2]
    assert got["series"][1]["band"] == {"lo": [4, 6], "hi": [6, 8]}
    assert "err" not in got["series"][1] and "band" not in got["series"][0]
    # the palette is dealt to the series that stay, in order
    assert [s["color"] for s in got["series"]] == [
        "#4fb3d9", "#f0a848", "#8fd18a"]


def test_the_csv_round_trips_the_helpers():
    got = _run("""
      var a={k:'chart',cats:['Jan','Feb'],series:[
        {name:'Temp',ys:[10,12],err:[1,2]},
        {name:'Rain',ys:[5,7],band:{lo:[4,6],hi:[6,8]}}]};
      var csv=chartCsvOf(a);
      var back=chartFromRows(csv.split('\\n').map(function(ln){
        return ln.split(',').map(function(c){return c.trim();});}));
      console.log(JSON.stringify({csv:csv,back:back}));
    """)
    assert got["csv"].split("\n")[0] == ", Temp, Temp ±, Rain, Rain lo, Rain hi"
    assert got["back"]["series"][0]["err"] == [1, 2]
    assert got["back"]["series"][1]["band"] == {"lo": [4, 6], "hi": [6, 8]}


def test_parse_normalises_the_switches():
    got = _run("""
      var a={k:'chart',ct:'bar',stack:1,ylog:'1',labels:true,xlab:'Month',
        cats:['a','b'],series:[
          {name:'A',ys:[1,2],axis:'y2',trend:'linear',ct:'line',hide:1,
           err:[0.5,null]},
          {name:'B',ys:[3,4],axis:'nonsense',trend:0}]};
      var d=chartParse(a);
      console.log(JSON.stringify({d:d,pct:chartParse({stack:'pct'}).stack}));
    """)
    d = got["d"]
    assert (d["stack"], d["ylog"], d["labels"], d["xlab"]) == (
        "std", True, True, "Month")
    a, b = d["series"]
    assert a["axis"] == "y2" and a["trend"] == "linear" and a["ct"] == "line"
    assert a["hide"] == 1 and a["err"] == [0.5, None]
    assert "axis" not in b and "trend" not in b
    assert got["pct"] == "pct"


# ------------------------------------------------------------ the export


SPEC = {
    "title": "x", "widthMm": 339, "heightMm": 191, "bg": "#0b141d",
    "slides": [{"bg": "#0b141d", "trans": "", "notes": "", "items": [
        {"t": "chart", "x": 5, "y": 5, "w": 80, "h": 60, "ct": "bar",
         "cats": ["a", "b", "c"], "numeric": False, "title": "Mixed",
         "leg": True, "ink": "#ffffff", "stack": "std", "ylog": True,
         "labels": True, "xlab": "Month", "ylab": "mm", "y2lab": "°C",
         "series": [
             {"name": "Rain", "ys": [1, 2, 3], "color": "#4fb3d9",
              "err": [0.1, 0.2, 0.3]},
             {"name": "Snow", "ys": [2, 1, 2], "color": "#f0a848",
              "trend": "linear"},
             {"name": "Temp", "ys": [10, 12, 9], "color": "#8fd18a",
              "axis": "y2", "ct": "line"},
             {"name": "Ghost", "ys": [5, 5, 5], "color": "#000000",
              "hide": 1},
         ]},
    ]}]}


@pytest.fixture(scope="module")
def written():
    from helpers_js import build_pptx, js_engine
    if js_engine() is None:
        pytest.skip("no node or VS Code Electron on this machine")
    import io
    import zipfile
    data, report = build_pptx(json.loads(json.dumps(SPEC)))
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/charts/chart1.xml").decode("utf-8")
    return data, report, xml


def test_every_switch_is_real_chart_xml(written):
    data, report, xml = written
    assert report["skipped"] == 0
    assert '<c:grouping val="stacked"/>' in xml and '<c:overlap val="100"/>' in xml
    assert '<c:logBase val="10"/>' in xml
    assert '<c:showVal val="1"/>' in xml
    assert '<c:trendlineType val="linear"/>' in xml
    assert '<c:errBars><c:errDir val="y"/>' in xml
    assert '<c:errValType val="cust"/>' in xml
    # the line over the bars is its own group on the RIGHT axes...
    assert xml.count("<c:barChart>") == 1 and xml.count("<c:lineChart>") == 1
    line = xml.split("<c:lineChart>")[1].split("</c:lineChart>")[0]
    assert '<c:axId val="333333333"/><c:axId val="444444444"/>' in line
    assert "Temp" in line and "Rain" not in line
    # ...and the right-hand value axis exists, titled, crossing at max
    assert '<c:axPos val="r"/>' in xml and '<c:crosses val="max"/>' in xml
    for t in ("Month", "mm", "°C"):
        assert f"<a:t>{t}</a:t>" in xml, t
    # a hidden series leaves nothing behind
    assert "Ghost" not in xml


def test_the_switches_come_back_through_the_reader(written):
    data, _, _ = written
    got = read_pptx(data, "x.pptx")
    assert got["lost"] == []
    ch = [it for it in got["spec"]["slides"][0]["items"]
          if it["t"] == "chart"][0]
    assert ch["ct"] == "bar" and ch["stack"] == "std"
    assert ch["ylog"] is True and ch["labels"] is True
    assert (ch["xlab"], ch["ylab"], ch["y2lab"]) == ("Month", "mm", "°C")
    by = {s["name"]: s for s in ch["series"]}
    assert set(by) == {"Rain", "Snow", "Temp"}
    assert by["Rain"]["err"] == pytest.approx([0.1, 0.2, 0.3])
    assert by["Snow"]["trend"] == "linear"
    assert by["Temp"]["axis"] == "y2" and by["Temp"]["ct"] == "line"
    assert "axis" not in by["Rain"]


# ----------------------------------------------------------- the doors


def test_the_pane_and_its_doors(out):
    html = assets.deck_html()
    assert 'id="fmt-chartwrap" hidden' in html and 'id="fmt-chart"' in html
    assert 'id="chartpane" hidden' in html and 'id="chartpane-body"' in html
    assert "    '#fmt-chartwrap':'chart'," in out
    assert out.count("'fmt-chartwrap','fmt-mediawrap','fmt-cropwrap'") >= 8
    assert "  chartBoot();" in (SRC / "assets" / "js" / "deck"
                                / "99-boot.js").read_text("utf-8")
    assert "'imgpane','mediapane','chartpane'," in out
    assert "row('Chart options\\u2026','',function(){" in out
    assert "if(typeof chartPaneSync==='function') chartPaneSync();" in out
    pane = out.split("function chartPaneSync(){")[1].split(
        "\n  function chartBoot(){")[0]
    for word in ("Stacking", "Logarithmic value axis", "Data labels",
                 "Axis titles", "'Series'", "'Trend'", "'Line'", "'Right'",
                 "Edit numbers", "Refresh from table"):
        assert word in pane, word
    # a rename moves the ties that name the series
    assert "chartRenameTies(a2,was,s2.name);" in pane
    # the data dialog keeps a series' switches across an edit
    assert "['axis','trend','ct','hide'].forEach(function(k){" in out


def test_the_export_carries_the_switches_and_counts_the_bands(out):
    items = out.split("var cd=chartParse(a);")[1].split(
        "} else if(a.k==='flip'){")[0]
    assert "stack:cd.stack,ylog:cd.ylog,labels:cd.labels," in items
    assert "if(se.band&&!se.hide) note.bands=(note.bands|0)+1;" in items
    assert "confidence band" in out.split("function pptxLosses(){")[1].split(
        "\n  }")[0]


def test_the_picture_is_drawn_on_one_frame(out):
    """The scales are computed from every series before a mark is drawn;
    bands sit behind everything; a hidden series draws nothing."""
    svg = out.split("function chartSvg(a){")[1].split("\n  function drawChart(")[0]
    assert "var shown=d.series.filter(function(se){return !se.hide;});" in svg
    assert "var scY2=hasY2?chartScale(extent(sec)," in svg
    assert "shown.forEach(band);" in svg
    assert "segs=chartStackTops(stackSeries,n,d.stack==='pct');" in svg
    assert "stroke-dasharray','5 3'" in svg          # the trend line
    assert "'M'+x+' '+y1+'V'+y2+'M'+(x-4)+' '+y1+'h8'" in svg   # error caps


def test_the_schema_and_the_doc_say_so():
    from junoview.notebook.deck_schema import ANNOT_KINDS
    assert "`stack`" in ANNOT_KINDS["chart"][1]
    doc = (ROOT / "DECK-FORMAT.md").read_text(encoding="utf-8")
    assert "`y2lab`" in doc
    assert "Chart options" in assets.help_html()
