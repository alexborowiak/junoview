"""T556: handouts and notes pages.

Export PDF / print asks what goes on each sheet: full-page slides (as
before), handouts of three a page with lines or six a page, or notes
pages -- each slide above its notes. They are layouts of the same pages
buildPrintRoot draws, on A4.
"""
from junoview import assets


def _js():
    return assets.load("js/deck/60-saving-and-export.js")


def test_the_four_layouts_are_offered_and_remembered():
    js = _js()
    for k in ("['slides','Full-page slides']", "['ho3','Handouts",
              "['ho6','Handouts", "['notes','Notes pages"):
        assert k in js, k
    body = js.split("menuAction('#mi-pdf',function(){")[1].split("\n  });")[0]
    assert "localStorage.getItem('jv-print-layout')" in body
    assert "printDeck(v.lay);" in body


def test_they_lay_out_the_same_pages():
    js = _js()
    assert "if(kind&&kind!=='slides') handoutify(root,kind);" in js
    h = js.split("function handoutify(root,kind){")[1].split("\n  }\n")[0]
    assert "var pages=$$('.print-page',root);" in h
    assert "var per=kind==='ho6'?6:kind==='ho3'?3:1;" in h
    assert "if(txt) nt.innerHTML=notesHtml(sl.notes);" in h
    assert "@page{size:A4 portrait;margin:0;}" in h


def test_the_sheets_print_one_a_page():
    css = assets.load("css/deck.css")
    assert ".ho-sheet{width:794px;height:1123px;" in css
    assert ".ho-sheet{page-break-after:always;break-after:page;}" in css
