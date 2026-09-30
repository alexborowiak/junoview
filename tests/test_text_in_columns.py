"""T547: text in columns.

Paragraph ▾ gains "columns" (One, Two, Three) and, once there are two,
"gap between the columns" (Narrow, Normal, Wide, in em of the box's own
words -- the currency a.ind and a.pspace use). The words' own element is
the multi-column box, so plain words, lists and Markdown all flow the
same way, and a box that grows with its words comes out as tall as its
longest column. A curve has one baseline, so choosing columns straightens
a curved box and choosing a curve takes the columns away -- each says so.
The count is a.ncol, never a.cols: that is a TABLE's list of column
widths. The .pptx carries PowerPoint's own numCol and spcCol, and an
imported box keeps its columns (more than three arrive as three, and the
import says so).

The markup was begun by another session on 2026-09-30 and left
uncommitted; the user asked for it to be finished and committed.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_menu_has_the_rows():
    html = assets.deck_html()
    menu = html[html.index('id="fmt-para-menu"'):]
    menu = menu[:menu.index("\n                </div>\n")]
    assert ('<div class="hd-lab">columns</div>\n'
            '                  <div class="opt-row" id="fmt-para-cols"></div>'
            ) in menu
    assert 'id="fmt-para-colgap"' in menu
    js = assets.deck_js()
    panel = js.split("  function buildParaPanel(){")[1].split("\n  }\n")[0]
    assert "cl=$('#fmt-para-cols'),cg=$('#fmt-para-colgap');" in panel
    # the gap is only offered once there are two columns
    assert "optSection(cg,nc>1);" in panel


def test_columns_and_a_curve_cannot_both_be_on(out):
    fn = out.split("  function paraApply(v){")[1].split("\n  }\n")[0]
    assert "if(a.arc){delete a.arc;straightened=true;}" in fn
    assert "if(a.ncol>1){delete a.ncol;delete a.cgap;unColumned=true;}" in fn
    assert "toast('Columns and a curve cannot both be on" in fn
    assert "toast('A curve and columns cannot both be on" in fn
    # One takes the gap away with the columns; Normal is not stored
    assert "} else {delete a.ncol;delete a.cgap;}" in fn
    assert "if(gg===COL_GAP_DEF) delete a.cgap; else a.cgap=gg;" in fn


def test_the_words_element_is_the_column_box(out):
    assert "if(a.ncol>1&&!a.arc){" in out
    assert "tx2.style.columnCount=String(Math.min(3,a.ncol));" in out
    assert ("tx2.style.columnGap=((a.cgap!=null)?+a.cgap:COL_GAP_DEF)"
            "+'em';") in out
    # a text box's count never shares a name with a table's widths
    assert "a.cols=nn" not in out


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_columns_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 80, "h": 30,
                    "text": "one two three four five six", "sizePct": 4,
                    "ncol": 2, "colGapEm": 1.5},
                   {"t": "text", "x": 10, "y": 60, "w": 60, "h": 10,
                    "text": "plain", "sizePct": 4},
                   {"t": "text", "x": 10, "y": 80, "w": 60, "h": 10,
                    "text": "arched", "sizePct": 4, "arc": 30,
                    "ncol": 3, "colGapEm": 3}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    # 4% of a 7.5in (540pt) page is 21.6pt; 1.5em of that is 32.4pt
    assert ('<a:bodyPr wrap="square" numCol="2" spcCol="411480" '
            'anchor="t">') in xml
    assert xml.count("numCol=") == 1          # not the plain, not the arc
    got = read_pptx(data, "cols.pptx")
    items = got["spec"]["slides"][0]["items"]
    assert items[0]["ncol"] == 2
    assert items[0]["colGapEm"] == pytest.approx(1.5, abs=0.02)
    assert "ncol" not in items[1]


def test_an_imported_box_keeps_its_columns(out):
    imp = out.split("  function pptTextAnnot(it,sids){")[1].split("\n  }\n")[0]
    assert "if(it.ncol>1){" in imp
    assert "a.ncol=Math.min(3,Math.round(it.ncol));" in imp
    from junoview.notebook import pptx_read
    src = open(pptx_read.__file__, encoding="utf-8").read()
    assert '"manycols": "{n} text box{es} in more than three columns' in src
    assert 'self.ctx.tally.add("manycols")' in src
