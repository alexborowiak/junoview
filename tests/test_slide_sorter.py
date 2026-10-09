"""T557: a slide sorter.

The Overview map, while editing, is PowerPoint's Slide Sorter: pick
slides (click, Ctrl, Shift, Ctrl+A), drag them as a block, duplicate,
section or delete them as one undo step each, and open one.
"""
from junoview import assets


def _ov():
    js = assets.load("js/deck/50-review-and-overview.js")
    return js.split("function openOverview(){")[1].split(
        "/* ---- OPTIONAL SLIDES, NAMED CUTS")[0]


def test_editing_opens_a_sorter_presenting_the_map():
    ov = _ov()
    assert "var sorting=(mode!=='view');" in ov
    assert "if(!sorting){openAt(i);return;}" in ov
    assert "tile.draggable=true;" in ov


def test_picking_is_by_slide_object():
    ov = _ov()
    assert "picked=pres.slides.slice(lo,hi+1);" in ov     # Shift
    assert "if(at>=0) picked.splice(at,1); else picked.push(sl);" in ov
    assert "return picked.map(function(s){return pres.slides.indexOf(s);})" \
        in ov


def test_a_block_moves_and_joins_the_section_it_lands_in():
    ov = _ov()
    assert "function moveBlock(to,sec){" in ov
    assert "if(partGuardMove(idxs[q],sec)) return;" in ov
    assert "block.forEach(function(s2){if(sec) s2.sec=sec; else delete s2.sec;});" \
        in ov


def test_batches_are_one_undo_step():
    ov = _ov()
    assert "var at=slideCopyAt(pres.slides[i],i);" in ov
    assert "idxs.slice().reverse().forEach(function(i){pres.slides.splice(i,1);});" \
        in ov
    strip = assets.load("js/deck/55-sections-and-strip.js")
    assert "function slideCopyAt(source,i){" in strip
    assert "var at=slideCopyAt(source,i);" in strip


def test_the_keys_are_the_sorters():
    ov = _ov()
    for k in ("if(k==='Delete'||k==='Backspace'){stop();act('del');return;}",
              "if(ctrl&&(k==='d'||k==='D')){stop();act('dup');return;}",
              "if(k==='y'||k==='Y'||e.shiftKey) redo(); else undo();"):
        assert k in ov


def test_view_has_the_door():
    html = assets.load("html/deck.html")
    assert 'id="vw-sorter"' in html
    assert 'data-ic="sorter"></i> Slide sorter</button>' in html
    lay = assets.load("js/deck/07-ribbon-layouts.js")
    # T622: the scroll view's two tiles sit between the sorter and Rulers
    assert lay.count("'vw-sorter','vw-scroll','vw-scroll-lines','vw-rulers',") \
        == lay.count("'vw-rulers',")
