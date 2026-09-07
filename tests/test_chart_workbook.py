"""Embedded chart workbooks (T323).

The user's list, item 4: "Embedded chart workbooks for PowerPoint's
'Edit Data'".

T117 shipped the chart with its values cached in the chart XML and no
workbook, and recorded the cut: PowerPoint renders and restyles from the
caches alone, and only "Edit Data" needs the sheet. This is that sheet.
Without it the button opens an empty grid and the numbers you typed in
Junoview are not there to edit -- and the first edit on the other side
overwrites the lot.

The grid is not a new invention: it is exactly the grid the ``c:f``
formulas the chart already wrote have always claimed -- names along row
one, categories down column A, values under their names -- so the test
that matters is that the two agree, cell for cell.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from pathlib import Path

import pytest

from junoview.notebook.pptx_read import read_pptx
from junoview.notebook.sources import sheet_rows

ROOT = Path(__file__).resolve().parent.parent

SPEC = {
    "title": "wb", "widthMm": 339, "heightMm": 191, "bg": "#0b141d",
    "slides": [{"bg": "#0b141d", "trans": "", "notes": "", "items": [
        {"t": "chart", "x": 5, "y": 5, "w": 60, "h": 50, "ct": "bar",
         "cats": ["Jan", "Feb", "Mar"], "numeric": False, "leg": True,
         "ink": "#ffffff", "title": "Rainfall",
         "series": [
             {"name": "Rain", "ys": [12, 30, 18], "color": "#4fb3d9",
              "err": [1, 2, 1.5]},
             {"name": "Snow", "ys": [5, 8, 2], "color": "#f0a848"},
         ]},
    ]}]}


def _built():
    from helpers_js import build_pptx, js_engine
    if js_engine() is None:
        pytest.skip("no node or VS Code Electron on this machine")
    data, report = build_pptx(json.loads(json.dumps(SPEC)))
    return data, report


@pytest.fixture(scope="module")
def deck():
    data, report = _built()
    return data, report, zipfile.ZipFile(io.BytesIO(data))


def test_every_chart_carries_a_workbook(deck):
    data, report, z = deck
    assert report["skipped"] == 0
    names = set(z.namelist())
    assert "ppt/embeddings/Microsoft_Excel_Sheet1.xlsx" in names
    # ...named by a rels part charts have never had before
    rels = z.read("ppt/charts/_rels/chart1.xml.rels").decode("utf-8")
    assert "/relationships/package" in rels
    assert 'Target="../embeddings/Microsoft_Excel_Sheet1.xlsx"' in rels
    # ...pointed at from the chart, after txPr, where CT_ChartSpace puts it
    xml = z.read("ppt/charts/chart1.xml").decode("utf-8")
    assert '<c:externalData r:id="rId1"><c:autoUpdate val="0"/>' in xml
    assert xml.index("</c:txPr>") < xml.index("<c:externalData")
    assert xml.index("<c:externalData") < xml.index("</c:chartSpace>")
    # ...and declared, or PowerPoint refuses the package
    ct = z.read("[Content_Types].xml").decode("utf-8")
    assert ('<Default Extension="xlsx" ContentType="application/vnd.'
            'openxmlformats-officedocument.spreadsheetml.sheet"/>') in ct


def test_the_workbook_is_a_real_readable_xlsx(deck):
    """Read back with the deck's own sheet reader -- the one that has
    opened .xlsx files since T113 -- not a bespoke parser."""
    _, _, z = deck
    book = z.read("ppt/embeddings/Microsoft_Excel_Sheet1.xlsx")
    inner = set(zipfile.ZipFile(io.BytesIO(book)).namelist())
    assert {"[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
            "xl/_rels/workbook.xml.rels",
            "xl/worksheets/sheet1.xml"} <= inner
    rows = sheet_rows(book)
    assert rows[0] == ["", "Rain", "Snow", "Rain ±"]
    assert rows[1] == ["Jan", "12", "5", "1"]
    assert rows[2] == ["Feb", "30", "8", "2"]
    assert rows[3] == ["Mar", "18", "2", "1.5"]
    # the sheet is called what every c:f formula in the chart calls it
    assert 'name="Sheet1"' in zipfile.ZipFile(
        io.BytesIO(book)).read("xl/workbook.xml").decode("utf-8")


def test_the_sheet_is_the_grid_the_formulas_claim(deck):
    """The chart's caches name cells; the workbook has to put the same
    numbers in those cells, or Edit Data shows one thing and the plot
    another."""
    _, _, z = deck
    xml = z.read("ppt/charts/chart1.xml").decode("utf-8")
    rows = sheet_rows(z.read("ppt/embeddings/Microsoft_Excel_Sheet1.xlsx"))

    def cell(ref: str) -> str:
        col = re.match(r"([A-Z]+)(\d+)", ref)
        assert col, ref
        letters, row = col.group(1), int(col.group(2))
        idx = 0
        for ch in letters:
            idx = idx * 26 + (ord(ch) - 64)
        return rows[row - 1][idx - 1]

    # every range the chart names, resolved against the sheet
    for f in set(re.findall(r"<c:f>Sheet1!\$([A-Z]+)\$(\d+)(?::"
                            r"\$[A-Z]+\$(\d+))?</c:f>", xml)):
        colL, first, last = f
        assert cell(f"{colL}{first}") != "" or colL == "A"
        if last:
            assert int(last) == len(rows), (colL, last, len(rows))
    # the series names really do sit in the cells their tx points at
    assert cell("B1") == "Rain" and cell("C1") == "Snow"
    assert cell("A2") == "Jan"
    # the error column is where chartSerExtras says it is
    assert cell("D1") == "Rain ±"


def test_the_same_deck_still_exports_byte_identically():
    """A zip inside a zip is a new chance to leak a timestamp."""
    a, _ = _built()
    b, _ = _built()
    assert a == b


def test_a_chart_whose_caches_are_gone_still_has_its_numbers(deck):
    """Some tools strip the caches and leave only the workbook. The
    reader follows externalData rather than reporting an empty chart."""
    data, _, _ = deck
    src = zipfile.ZipFile(io.BytesIO(data))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as out:
        for info in src.infolist():
            body = src.read(info.filename)
            if info.filename == "ppt/charts/chart1.xml":
                # every cached point, gone; the references stay
                body = re.sub(rb"<c:pt idx=\"\d+\"><c:v>[^<]*</c:v></c:pt>",
                              b"", body)
                body = body.replace(b'<c:ptCount val="3"/>',
                                    b'<c:ptCount val="0"/>')
            out.writestr(info.filename, body)
    got = read_pptx(buf.getvalue(), "stripped.pptx")
    ch = [it for it in got["spec"]["slides"][0]["items"]
          if it["t"] == "chart"]
    assert len(ch) == 1, got["lost"]
    by = {s["name"]: s["ys"] for s in ch[0]["series"]}
    assert by["Rain"] == [12, 30, 18]
    assert by["Snow"] == [5, 8, 2]
    assert ch[0]["cats"] == ["Jan", "Feb", "Mar"]


def test_a_chart_with_neither_is_named_not_dropped_silently(deck):
    data, _, _ = deck
    src = zipfile.ZipFile(io.BytesIO(data))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as out:
        for info in src.infolist():
            if info.filename.startswith("ppt/embeddings/"):
                continue          # no workbook either
            body = src.read(info.filename)
            if info.filename == "ppt/charts/chart1.xml":
                body = re.sub(rb"<c:pt idx=\"\d+\"><c:v>[^<]*</c:v></c:pt>",
                              b"", body)
            out.writestr(info.filename, body)
    got = read_pptx(buf.getvalue(), "empty.pptx")
    assert not [it for it in got["spec"]["slides"][0]["items"]
                if it["t"] == "chart"]
    assert any("workbook beside them" in ln for ln in got["lost"])


def test_a_column_letter_counts_past_z():
    """The error columns sit at series.length + i, so thirteen series
    with error bars used to write "[" into a formula."""
    from helpers_js import js_engine, lift_fn
    if js_engine() is None:
        pytest.skip("no node or VS Code Electron on this machine")
    import subprocess
    import tempfile

    from junoview import assets
    cmd, env = js_engine()
    src = (ROOT / "src" / "junoview" / "assets" / "js" / "pptx.js").read_text(
        encoding="utf-8")
    assert assets.pptx_js() == src
    script = (lift_fn(src, "chartCol")
              + "\nconsole.log(JSON.stringify("
              + "[0,1,24,25,26,51,52].map(chartCol)));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        got = json.loads([ln for ln in r.stdout.splitlines()
                          if ln.startswith("[")][-1])
    assert got == ["B", "C", "Z", "AA", "AB", "BA", "BB"]


def test_the_task_and_the_doc_say_so():
    tasks = (ROOT / "TASKS.md").read_text(encoding="utf-8")
    assert "- [x] **T323" in tasks
