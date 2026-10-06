"""Tables grow up: merge and split cells, a cell's fill, table styles (T551).

A merge is a REGION -- `a.merge` a list of [row, col, rows, cols] with the
words in its top-left cell -- and a cell's own fill is `a.fills`, rows of
the same shape as `a.rows`. A look (`a.tstyle`) and its switches (Header
row, Banded rows, First column) are drawn from the deck's own colours.
A click on a cell picks it and Shift+click stretches the pick, which the
Table group's Add/Remove row and column, Merge, Split and Cell fill act
on. The .pptx carries merges and fills both ways.
"""

from __future__ import annotations

import io
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest

from helpers_js import build_pptx, js_engine, lift_fn
from junoview import assets
from junoview.notebook.pptx_read import read_pptx

MODEL = ("tableRows", "tableCols", "tableNormalise", "tableMerges",
         "tableCover", "tableMergeAt", "tableMergeWrite", "tableFillAt",
         "tableFillSet", "tblInsert", "tblDelete", "tableMerge",
         "tableUnmerge", "tableSplit", "tableGrow")


def _run(script: str) -> object:
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    js = assets.deck_js()
    src = "\n".join(lift_fn(js, n) for n in MODEL) + "\n" + script
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.js"
        p.write_text(src, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:3000]
    return json.loads(r.stdout.strip().splitlines()[-1])


GRID = ("var a={k:'table',rows:[['a','b','c'],['d','e','f'],"
        "['g','h','i']]};")


def test_merging_gathers_the_words_into_the_corner():
    got = _run(GRID + """
tableMerge(a,0,0,1,1);
console.log(JSON.stringify({rows:a.rows,merge:a.merge,
  cover:tableCover(a)}));""")
    assert got["merge"] == [[0, 0, 2, 2]]
    assert got["rows"][0][0] == "a b d e"
    assert got["rows"][0][1] == "" and got["rows"][1][1] == ""
    # every row keeps its length: the covered cells are slots, not gone
    assert [len(r) for r in got["rows"]] == [3, 3, 3]
    assert got["cover"][0][0] == {"rs": 2, "cs": 2}
    assert got["cover"][1][1] == {"at": [0, 0]}
    assert got["cover"][2][2] is None


def test_a_stale_or_overlapping_region_never_draws_a_cell_twice():
    got = _run(GRID + """
a.merge=[[0,0,2,2],[1,1,2,2],[5,5,2,2],[2,1,1,9],[0,2,1,1]];
console.log(JSON.stringify(tableMerges(a)));""")
    # the overlap is dropped, the out-of-range one too, the too-wide one
    # is clipped to the table, and a 1x1 "region" is no region
    assert got == [{"r": 0, "c": 0, "rs": 2, "cs": 2},
                   {"r": 2, "c": 1, "rs": 1, "cs": 2}]


def test_unmerge_and_split_into_two_columns():
    got = _run(GRID + """
tableMerge(a,0,0,0,1);tableUnmerge(a,0,1);
var b={k:'table',rows:[['a','b'],['c','d']],cols:[40,60]};
tableSplit(b,1,0,'col');
console.log(JSON.stringify({a:a.merge||null,brows:b.rows,bmerge:b.merge,
  bcols:b.cols}));""")
    assert got["a"] is None
    # a new column right of the split cell, its width halved, and the
    # other row merged across it so only the one cell is divided
    assert got["brows"] == [["a", "", "b"], ["c", "", "d"]]
    assert got["bcols"] == [20, 20, 60]
    assert got["bmerge"] == [[0, 0, 1, 2]]


def test_split_into_two_rows_keeps_the_rest_of_the_row_whole():
    got = _run(GRID + """
tableSplit(a,1,2,'row');
console.log(JSON.stringify({rows:a.rows.length,merge:a.merge}));""")
    assert got["rows"] == 4
    assert got["merge"] == [[1, 0, 2, 1], [1, 1, 2, 1]]


def test_inserting_and_removing_lines_moves_regions_fills_and_columns():
    got = _run(GRID + """
a.ctype=[null,{t:'num'},null];a.calc=['','sum',''];
tableMerge(a,1,1,2,2);tableFillSet(a,2,0,'#ff0000');
tblInsert(a,'row',0);            /* above everything */
tblInsert(a,'col',2);            /* through the region */
var mid=JSON.parse(JSON.stringify({merge:a.merge,fill:a.fills[3][0],
  ctype:a.ctype,calc:a.calc}));
tblDelete(a,'row',2);            /* the region's top row */
tblDelete(a,'col',1);            /* its first column */
console.log(JSON.stringify({mid:mid,merge:a.merge||null,
  rows:a.rows,fills:a.fills||null}));""")
    mid = got["mid"]
    assert mid["merge"] == [[2, 1, 2, 3]]       # moved down, one wider
    assert mid["fill"] == "#ff0000"             # its fill moved with it
    assert mid["ctype"][1] == {"t": "num"} and mid["ctype"][2] is None
    assert mid["calc"] == ["", "sum", "", ""]
    # what is left of the region still spans what is left of it
    assert got["merge"] == [[2, 1, 1, 2]]
    # the words of the region's corner moved down with it
    assert got["rows"][2][1] == "e f h i"
    assert got["fills"][2][0] == "#ff0000"


def test_add_row_goes_under_a_given_line_and_at_the_end_without_one():
    got = _run(GRID + """
tableGrow(a,'row',1,0);var one=a.rows.map(function(r){return r[0];});
tableGrow(a,'row',1);var two=a.rows.length;
tableGrow(a,'col',-1,0);var three=a.rows[0];
console.log(JSON.stringify([one,two,three]));""")
    assert got[0] == ["a", "", "d", "g"]
    assert got[1] == 5
    assert got[2] == ["b", "c"]


def test_the_cells_are_drawn_from_the_regions_and_the_look():
    js = assets.deck_js()
    draw = lift_fn(js, "drawTable")
    assert "if(cov&&cov.at) return;          /* drawn by its region's corner */" in draw
    assert "if(cov){td.rowSpan=cov.rs;td.colSpan=cov.cs;}" in draw
    # precedence: the cell's own fill, its column's rule, the look
    assert ("        if(own) td.style.background=tokVal(own);\n"
            "        else if(fill) td.style.background=fill;\n"
            "        else if(lk.bg) td.style.background=lk.bg;") in draw
    assert "tblPickCell(i,ri,ci,!!e.shiftKey);" in draw


def test_the_look_is_the_decks_own_colours():
    js = assets.deck_js()
    look = lift_fn(js, "tableLook")
    for tok in ("tokVal('@page')", "tokVal('@accent')", "tokVal('@warm')"):
        assert tok in look
    assert [s.split("'")[1] for s in js[js.index("  var TBL_STYLES=["):
            js.index("];", js.index("  var TBL_STYLES=["))]
            .split("\n")[1:]] == ["", "soft", "accent", "ink", "warm", "lines"]


def test_shift_click_on_a_cell_stretches_the_pick():
    js = assets.deck_js()
    assert ("            if(ev.shiftKey&&selAnnot===idx&&selSet.length<=1\n"
            "               &&t.closest&&t.closest('.an-table [data-r]')){\n"
            "              ev.preventDefault();return;\n"
            "            }") in js


def test_the_new_doors_are_in_every_ribbon_layout():
    js = assets.deck_js()
    lay = js[js.index("  var RIBBON_LAYOUTS=["):]
    assert lay.count("'fmt-tbl-merge','fmt-tbl-splitwrap',") == 8
    html = assets.deck_html()
    for i in ("fmt-tbl-merge", "fmt-tbl-split", "fmt-tbl-fill",
              "fmt-tbl-style"):
        assert f'id="{i}"' in html, i


SPEC = {"title": "t", "widthMm": 339, "heightMm": 191, "bg": "#0b141d",
        "slides": [{"bg": "#0b141d", "items": [
            {"t": "table", "x": 10, "y": 10, "w": 60, "h": 30,
             "rows": [["Region", "2020", "2021"], ["North", "12", ""],
                      ["", "9", "11"]],
             "cols": [34, 33, 33], "thead": 1, "grid": 1, "sizePct": 2,
             "color": "#ffffff",
             "merge": [[1, 1, 1, 2], [1, 0, 2, 1]],
             "looks": [[{"bg": "#39a9c0", "ink": "#0b141d", "b": True}] * 3,
                       [{"bg": "", "ink": "", "b": True},
                        {"bg": "#f0a848", "ink": "#0b141d", "b": False},
                        {"bg": "", "ink": "", "b": False}],
                       [{"bg": "", "ink": "", "b": True},
                        {"bg": "", "ink": "", "b": False},
                        {"bg": "", "ink": "", "b": False}]],
             "band": True, "first": True}]}]}


def _built() -> tuple[bytes, str]:
    if js_engine() is None:
        pytest.skip("no JS engine")
    data, report = build_pptx(json.loads(json.dumps(SPEC)))
    assert report["skipped"] == 0
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    return data, xml


def test_the_pptx_writes_real_merges_and_fills():
    _, xml = _built()
    rows = xml.split("<a:tr ")[1:]
    # every row still has three cells, or the columns stop lining up
    assert [r.count("</a:tc>") for r in rows] == [3, 3, 3]
    # North spans two rows, "12" two columns
    assert '<a:tc rowSpan="2">' in rows[1]
    assert '<a:tc gridSpan="2">' in rows[1]
    assert rows[1].count('hMerge="1"') == 1
    assert '<a:tc vMerge="1">' in rows[2]
    # the header's accent and the amber cell are plain fills after the rules
    assert rows[0].count('<a:solidFill><a:srgbClr val="39A9C0">') >= 3
    assert 'val="F0A848"' in rows[1]
    assert 'firstCol="1"' in xml and 'bandRow="1"' in xml


def test_a_pptx_brings_the_merges_and_fills_back():
    data, _ = _built()
    got = read_pptx(data, "t.pptx")
    tb = [it for it in got["spec"]["slides"][0]["items"]
          if it["t"] == "table"][0]
    assert tb["rows"] == [["Region", "2020", "2021"], ["North", "12", ""],
                          ["", "9", "11"]]
    assert sorted(tb["merge"]) == [[1, 0, 2, 1], [1, 1, 1, 2]]
    assert tb["fills"][1][1] == "#f0a848"
    assert tb["fills"][0] == ["#39a9c0"] * 3
    assert tb["first"] == 1
    # merged cells are carried now, so they are no longer reported lost
    assert "merged" not in json.dumps(got.get("lost", {}))


# ---- 2026-10-06 review fixes ---------------------------------------------

def test_removing_a_regions_last_row_or_column_removes_the_region():
    got = _run(GRID + """
tableMerge(a,1,0,1,1);           /* d e, across one row */
tableGrow(a,'row',-1,1);
var one={merge:a.merge||null,rows:a.rows,cover:tableCover(a)};
var b={k:'table',rows:[['a','b','c'],['d','e','f'],['g','h','i']]};
tableMerge(b,0,1,1,1);           /* b e, down one column */
tableGrow(b,'col',-1,1);
var two={merge:b.merge||null,cover:tableCover(b)};
var c={k:'table',rows:[['a','b','c'],['d','e','f'],['g','h','i']]};
tableMerge(c,0,0,1,1);           /* the 2x2, rows removed bottom-up */
tableGrow(c,'row',-1,1);tableGrow(c,'row',-1,0);
var three={merge:c.merge||null,rows:c.rows};
console.log(JSON.stringify([one,two,three]));""")
    one, two, three = got
    # the row that moved up is not merged in the region's place
    assert one["merge"] is None
    assert one["rows"] == [["a", "b", "c"], ["g", "h", "i"]]
    assert all(c is None for row in one["cover"] for c in row)
    assert two["merge"] is None
    assert all(c is None for row in two["cover"] for c in row)
    assert three["merge"] is None and three["rows"] == [["g", "h", "i"]]


def test_split_runs_a_neighbouring_region_across_the_new_line():
    got = _run(GRID + """
tableMerge(a,0,0,0,1);           /* a b, ending on column 1 */
tableSplit(a,1,1,'col');         /* split e */
var one={rows:a.rows,merge:a.merge,cover:tableCover(a)};
var b={k:'table',rows:[['a','b','c'],['d','e','f'],['g','h','i']]};
tableMerge(b,0,0,1,0);           /* a d, ending on row 1 */
tableSplit(b,1,2,'row');         /* split f */
console.log(JSON.stringify([one,{merge:b.merge,cover:tableCover(b)}]));""")
    one, two = got
    # a b now runs across the new column: no stray cell beside it
    assert [0, 0, 1, 3] in one["merge"]
    assert one["cover"][0][2] == {"at": [0, 0]}
    assert [0, 0, 3, 1] in two["merge"]
    assert two["cover"][2][0] == {"at": [0, 0]}


def test_tab_walks_past_a_vertical_region_in_reading_order():
    js = assets.deck_js()
    assert ("          if((anc[0]===ri&&anc[1]===ci)||anc[0]!==nr){"
            in js)
    # the same walk, run: merge (0,1)-(1,1), then Tab from (0,0)
    tab = js.split("      var cv=tableCover(a),guard=0;\n", 1)[1]
    tab = tab.split("      if(nr<0||nr>=a.rows.length", 1)[0]
    got = _run(GRID + """
tableMerge(a,0,1,1,1);
var at=[0,0],seen=[];
for(var step=0;step<7;step++){
  var ri=at[0],ci=at[1],e={key:'Tab',shiftKey:false};
  var nc=ci+1,nr=ri;
  if(nc>=a.rows[ri].length){nc=0;nr=ri+1;}
  var cv=tableCover(a),guard=0;
""" + tab + """
  if(nr>=a.rows.length) break;
  at=[nr,nc];seen.push(nr+','+nc);
}
console.log(JSON.stringify(seen));""")
    assert got == ["0,1", "0,2", "1,0", "1,2", "2,0", "2,1", "2,2"]


def test_a_table_change_commits_the_cell_being_typed_in_first():
    fmt = assets.load("js/deck/30-format-bar.js")
    body = fmt.split("  function tblApply(fn){", 1)[1].split("\n  }\n")[0]
    blur = ("if(ae&&ae.isContentEditable&&ae.closest&&ae.closest('.an-table'))"
            "\n        ae.blur();")
    assert blur in body
    assert body.index("ae.blur();") < body.index("fn(a);")


def test_a_styled_header_does_not_colour_the_whole_imported_table():
    if js_engine() is None:
        pytest.skip("no JS engine")
    data, _ = build_pptx(json.loads(json.dumps(SPEC)))
    tb = [it for it in read_pptx(data, "t.pptx")["spec"]["slides"][0]["items"]
          if it["t"] == "table"][0]
    # the header's ink is the page colour on the accent; the table's
    # words are the body's
    assert tb["color"] == "#ffffff"
