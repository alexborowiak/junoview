"""Structured tables (T324).

The user's list, item 5: "Structured tables: column types, decimal
alignment, number formats, conditional formatting, merged headers,
formulas".

Six requests, one idea: A COLUMN KNOWS WHAT IT HOLDS, and the alignment,
the decimals, the units, the colours and the footer all follow from the
type. So the model is one array beside `cols`, and the tests are about
what a column DOES with its cells -- which is arithmetic, lifted out of
the IIFE and run, not a substring.

The type is INFERRED when it is not set, because these tables mostly
come out of a rendered notebook and nobody wants to declare six columns
before a number lines up.
"""

from __future__ import annotations

import io
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest

from junoview import assets

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "junoview"

_STUBS = """
var pres={slides:[]},cur=0;
function tokVal(v){return v;}
function tableRows(a){
  var r=a&&a.rows;
  return (Array.isArray(r)&&r.length)?r:[['']];
}
"""
_FNS = ("tableNum", "tableDp", "tableBodyFrom", "tableColMeta", "tableThou",
        "tableFmtCell", "tableCalcOne", "tableHasCalc", "tableCalcRow",
        "tableRuleOf", "tableColRange", "tableRuleFill", "tableGroups",
        "tableViewRows")


def _run(script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    # tableNum reads a module-level regex, so it travels with it
    rx = re.search(r"var TBL_NUM_RE=/.*?/;", src).group(0)
    pre = (_STUBS + rx + "\n"
           + "\n".join(lift_fn(src, f) for f in _FNS) + "\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


# ------------------------------------------------------- what is a number


def test_a_number_survives_the_way_a_notebook_prints_it():
    """These cells are scraped out of rendered output, so the reader is
    deliberately generous: separators, a currency mark, a unit, a real
    minus sign, and the parentheses a lot of tabular output uses for
    negatives."""
    got = _run("""
      var cases=['12','12.5','-3','−3','(4.5)','1,234','1 234',
        '£99','45%','12 km','3.2 °C','  7  ','','abc','1.2.3','12a b'];
      console.log(JSON.stringify({n:cases.map(tableNum)}));
    """)
    assert got["n"] == [12, 12.5, -3, -3, -4.5, 1234, 1234,
                        99, 45, 12, 3.2, 7, None, None, None, None]


def test_a_column_is_numeric_when_its_cells_are():
    """One blank does not make a numeric column text -- a gap in a table
    is a gap, not a word -- but one word does."""
    got = _run("""
      var a={thead:1,rows:[['Site','Rain','Note','Mixed'],
        ['A','12.50','wet','1'],
        ['B','','dry','n/a'],
        ['C','3.2','damp','2']]};
      console.log(JSON.stringify({m:tableColMeta(a)}));
    """)
    t = [m["t"] for m in got["m"]]
    assert t == ["text", "num", "text", "text"]
    # the numeric column takes the widest number of decimals it holds,
    # which is what lines the column up on its point
    assert got["m"][1]["dp"] == 2
    assert got["m"][1]["align"] == "right"
    assert got["m"][0]["align"] == ""


def test_an_explicit_type_beats_the_inference():
    got = _run("""
      var a={thead:1,ctype:[null,{t:'text'},{t:'num',dp:1,thou:1,suf:' km'}],
        rows:[['a','b','c'],['x','12.5','1234.56']]};
      var m=tableColMeta(a);
      console.log(JSON.stringify({t:m.map(function(x){return x.t;}),
        cells:[tableFmtCell('12.5',m[1]),tableFmtCell('1234.56',m[2]),
               tableFmtCell('n/a',m[2])]}));
    """)
    assert got["t"] == ["text", "text", "num"]
    # forced to text, so it is left exactly as typed
    assert got["cells"][0] == "12.5"
    # one decimal, a thin space every three digits, and its unit
    assert got["cells"][1] == "1\u2009234.6 km"     # a THIN space
    # a cell the column cannot read is never mangled into one
    assert got["cells"][2] == "n/a"


def test_the_decimals_are_what_line_the_column_up():
    """Every number in a column shows the same places, so right-aligned
    they stack on the point. That IS the decimal alignment."""
    got = _run("""
      var a={thead:1,rows:[['x'],['1'],['2.5'],['10.25'],['0.1']]};
      var m=tableColMeta(a)[0];
      console.log(JSON.stringify({dp:m.dp,
        out:['1','2.5','10.25','0.1'].map(function(v){
          return tableFmtCell(v,m);})}));
    """)
    assert got["dp"] == 2
    assert got["out"] == ["1.00", "2.50", "10.25", "0.10"]
    assert len({len(s.split(".")[1]) for s in got["out"]}) == 1


def test_a_negative_keeps_a_real_minus_sign():
    got = _run("""
      var m={t:'num',dp:1,thou:0,pre:'',suf:''};
      console.log(JSON.stringify({out:['-2.5','(2.5)','2.5']
        .map(function(v){return tableFmtCell(v,m);})}));
    """)
    assert got["out"] == ["−2.5", "−2.5", "2.5"]


# ------------------------------------------------------------ the footer


def test_the_footer_is_computed_never_stored():
    got = _run("""
      var a={thead:1,calc:['','sum','mean','min','max','count'],
        rows:[['s','a','b','c','d','e'],
              ['x','1','1','1','1','1'],
              ['y','2','2','2','2',''],
              ['z','3','4','3','3','9']]};
      console.log(JSON.stringify({row:tableCalcRow(a,tableColMeta(a)),
        none:tableCalcRow({rows:[['1']]},[{t:'num',dp:0}])}));
    """)
    # the header is never part of the sum; and a MEAN is not the same
    # kind of number as its column -- 1, 2 and 4 average 2.33, and "2"
    # under a column of integers would claim an exactness it lacks
    assert got["row"] == ["", "6", "2.33", "1", "3", "2"]
    # count counts the numbers it found, and wears no unit
    assert got["none"] is None


def test_the_footer_wears_the_columns_own_format():
    got = _run("""
      var a={thead:1,calc:['sum'],ctype:[{t:'num',dp:1,thou:1,suf:' km'}],
        rows:[['d'],['1000.4'],['2000.2']]};
      console.log(JSON.stringify({row:tableCalcRow(a,tableColMeta(a))}));
    """)
    assert got["row"] == ["3\u2009000.6 km"]


# --------------------------------------------------- conditional format


def test_a_colour_scale_runs_across_the_columns_own_range():
    got = _run("""
      var a={thead:1,rules:[{kind:'scale',color:'#39a9c0'}],
        rows:[['v'],['0'],['5'],['10']]};
      var r=tableColRange(a,0,1);
      console.log(JSON.stringify({range:r,
        fills:['0','5','10','x'].map(function(v){
          return tableRuleFill(a,0,v,r);})}));
    """)
    assert got["range"] == {"lo": 0, "hi": 10}
    lo, mid, hi, txt = got["fills"]
    assert "6%" in lo and "32%" in mid and "58%" in hi
    assert txt == ""            # a cell with no number is never painted


def test_a_threshold_paints_only_what_crosses_it():
    got = _run("""
      var above={rules:[{kind:'above',at:'5',color:'#ff0000'}],
        rows:[['1'],['9']]};
      var below={rules:[{kind:'below',at:'5',color:'#ff0000'}],
        rows:[['1'],['9']]};
      console.log(JSON.stringify({
        above:['1','5','9'].map(function(v){
          return !!tableRuleFill(above,0,v,null);}),
        below:['1','5','9'].map(function(v){
          return !!tableRuleFill(below,0,v,null);}),
        noAt:!!tableRuleFill({rules:[{kind:'above',at:''}],rows:[['1']]},
          0,'9',null)}));
    """)
    assert got["above"] == [False, False, True]
    assert got["below"] == [True, False, False]
    # a threshold with no number set paints nothing rather than everything
    assert got["noAt"] is False


# ----------------------------------------------------- merged headers


def test_a_group_row_is_always_as_wide_as_the_table():
    """Whatever the groups cover, the row has to have exactly one cell
    per column or the header stops lining up with the body."""
    got = _run("""
      var a={rows:[['a','b','c','d','e']],
        groups:[{at:1,n:2,text:'2020'},{at:3,n:2,text:'2021'}]};
      var b={rows:[['a','b','c']],groups:[{at:0,n:99,text:'all'}]};
      var c={rows:[['a','b','c']]};
      console.log(JSON.stringify({a:tableGroups(a),b:tableGroups(b),
        c:tableGroups(c)}));
    """)
    assert got["a"] == [{"at": 0, "n": 1, "text": ""},
                        {"at": 1, "n": 2, "text": "2020"},
                        {"at": 3, "n": 2, "text": "2021"}]
    assert sum(g["n"] for g in got["a"]) == 5
    # a group wider than the table is clamped, not allowed to overhang
    assert got["b"] == [{"at": 0, "n": 3, "text": "all"}]
    assert got["c"] is None


# ------------------------------------------- what every export is shown


def test_the_view_is_the_table_the_slide_shows():
    """One list of rows, formatted, with the group row on top and the
    footer underneath -- so the .pptx, the PDF and the review markdown
    show the table the slide shows."""
    got = _run("""
      var a={thead:1,groups:[{at:1,n:2,text:'2020'}],calc:['','sum','sum'],
        ctype:[null,{t:'num',dp:1},{t:'num',dp:1}],
        rows:[['Site','Jan','Feb'],['A','1','2'],['B','3','4']]};
      console.log(JSON.stringify({rows:tableViewRows(a)}));
    """)
    assert got["rows"] == [
        ["", "2020", ""],                 # the spanning row
        ["Site", "Jan", "Feb"],           # the header, left as typed
        ["A", "1.0", "2.0"],
        ["B", "3.0", "4.0"],
        ["", "4.0", "6.0"],               # the footer
    ]


# ------------------------------------------------------------ the export


SPEC = {
    "title": "t", "widthMm": 339, "heightMm": 191, "bg": "#0b141d",
    "slides": [{"bg": "#0b141d", "trans": "", "notes": "", "items": [
        {"t": "table", "x": 5, "y": 5, "w": 60, "h": 30,
         "rows": [["", "2020", "", "2021", ""],
                  ["Site", "Jan", "Feb", "Jan", "Feb"],
                  ["A", "1.0", "2.0", "3.0", "4.0"],
                  ["", "1.0", "2.0", "3.0", "4.0"]],
         "cols": [20, 20, 20, 20, 20], "thead": True, "grid": 1,
         "spans": [1, 2, 2], "sizePct": 2, "color": "#ffffff"},
    ]}]}


def test_a_merged_header_is_a_real_powerpoint_merge():
    from helpers_js import build_pptx, js_engine
    if js_engine() is None:
        pytest.skip("no node or VS Code Electron on this machine")
    data, report = build_pptx(json.loads(json.dumps(SPEC)))
    assert report["skipped"] == 0
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    rows = xml.split("<a:tr ")
    group = rows[1]
    # the first cell stands alone, then one span of two and another,
    # each swallowing its neighbour with hMerge
    assert '<a:tc><a:txBody>' in group
    assert group.count('gridSpan="2"') == 2
    assert group.count('hMerge="1"') == 2
    assert "2020" in group and "2021" in group
    # every row still has five cells, or the columns stop lining up
    for r in rows[1:]:
        assert r.count("</a:tc>") == 5
    # a table with a group row is a header table whatever thead says
    assert '<a:tblPr firstRow="1"' in xml


def test_a_table_with_no_groups_is_unchanged():
    """The merge path must not touch the ordinary table."""
    from helpers_js import build_pptx, js_engine
    if js_engine() is None:
        pytest.skip("no node or VS Code Electron on this machine")
    spec = json.loads(json.dumps(SPEC))
    it = spec["slides"][0]["items"][0]
    it["spans"] = None
    it["rows"] = [["Site", "Jan"], ["A", "1.0"]]
    it["cols"] = [50, 50]
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert "gridSpan" not in xml and "hMerge" not in xml
    assert xml.count("</a:tc>") == 4


# ----------------------------------------------------------- the doors


def test_the_doors(out):
    html = assets.deck_html()
    assert 'id="fmt-tablewrap" hidden' in html and 'id="fmt-table"' in html
    assert 'id="tablepane" hidden' in html and 'id="tablepane-body"' in html
    assert "21-table-columns" in assets.DECK_PARTS
    assert "  tablePaneBoot();" in (SRC / "assets" / "js" / "deck"
                                    / "99-boot.js").read_text("utf-8")
    assert "    '#fmt-tablewrap':'table'," in out
    assert out.count("'fmt-tablewrap','fmt-chartwrap'") >= 8
    assert "'imgpane','mediapane','chartpane','tablepane'," in out
    assert "if(typeof tablePaneSync==='function') tablePaneSync();" in out
    # the right-click door, on the table itself
    assert "        if(ca.k==='table'){" in out
    assert "window.SemDeckTable.pane(true);" in out
    # the pane does not rebuild under the pointer -- T322's lesson
    assert "  function tablePaneBusy(){" in out
    assert "if(a&&a===tablePaneAt&&tablePaneBusy()) return;" in out
    # ...and the renderer reads the columns
    draw = out.split("function drawTable(layer,s,a,i,editing){")[1].split(
        "\n  }")[0]
    assert "var metas=tableColMeta(a);" in draw
    assert "tableFmtCell(val,m)" in draw
    assert "var calc=tableCalcRow(a,metas);" in draw
    assert "var groups=tableGroups(a);" in draw
    css = assets.deck_css()
    for cls in (".an-tbl-grouprow", ".an-tbl-calc", ".an-tbl-num",
                ".tablepane .tp-btn.on"):
        assert cls in css, cls


def test_the_schema_and_the_doc_say_so():
    from junoview.notebook.deck_schema import ANNOT_KINDS
    assert "`ctype[i]`" in ANNOT_KINDS["table"][1]
    doc = (ROOT / "DECK-FORMAT.md").read_text(encoding="utf-8")
    assert "`ctype[i]`" in doc and "`groups`" in doc
    tasks = (ROOT / "TASKS.md").read_text(encoding="utf-8")
    assert "- [x] **T324" in tasks
