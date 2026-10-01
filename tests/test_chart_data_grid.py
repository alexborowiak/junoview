"""T562: chart data you can type into.

The chart's numbers were a box of comma-separated text. They are a grid
now -- a cell per number, a series per column, + Row and + Series, Tab,
Enter and the arrows between cells, a pasted spreadsheet block spread
across the cells -- with the slide as the live preview and the old text
box one click away.
"""
from junoview import assets


def _dlg():
    js = assets.load("js/deck/47-charts.js")
    return js.split("function chartDataDlg(idx){")[1].split(
        "/* ---- WHICH SERIES DOES THIS BELONG TO")[0]


def test_the_numbers_are_a_grid_of_cells():
    d = _dlg()
    assert "tbl.className='cd-grid';" in d
    assert "inp.className='cd-in'+(ci===0?' cd-cat':'')" in d
    assert "ar.textContent='+ Row';" in d
    assert "as.textContent='+ Series';" in d
    # one set of rows for both views: what chartCsvOf writes
    js = assets.load("js/deck/47-charts.js")
    assert "function chartRowsOf(a){" in js
    assert "var rows=chartRowsOf(a),asText=false,previewT=0;" in d


def test_a_spreadsheet_block_spreads_across_the_cells():
    d = _dlg()
    assert "inp.addEventListener('paste',function(e){" in d
    assert ".split('\\n')" in d and "line.split('\\t')" in d


def test_enter_moves_down_and_the_dialog_keys_let_it():
    d = _dlg()
    assert "if(e.key==='Enter'||e.key==='ArrowDown') to=[ri+1,ci];" in d
    assert "host.setAttribute('data-own-enter','1');" in d
    keys = assets.load("js/deck/60-saving-and-export.js")
    assert "&&t.closest('[data-own-enter]')));" in keys


def test_the_slide_is_the_preview_and_cancel_puts_it_back():
    d = _dlg()
    assert "a.cats=data.cats;a.series=keepLooks(data.series);" in d
    assert "p._putBack=putBack;" in d
    js = assets.load("js/deck/47-charts.js")
    close = js.split("function chartDlgClose(){")[1].split("\n  }\n")[0]
    assert "if(typeof undoPreview==='function') undoPreview();" in close
    # Apply keeps what is on the slide
    assert "p._putBack=null;   /* applied: nothing to put back */" in d


def test_text_is_one_click_away():
    d = _dlg()
    assert "gridB.textContent='Grid';textB.textContent='Text';" in d
    assert "ta.className='chart-ta';" in d
