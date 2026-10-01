"""T573: find a shape by name.

The Shapes gallery's Show all window takes a search -- by a shape's own
name or the word people reach for ("circle" is the ellipse) -- and the
shapes you drew last lead the gallery.
"""
from junoview import assets


def _strip():
    return assets.load("js/deck/55-sections-and-strip.js")


def test_shapes_are_found_by_the_words_people_use():
    js = _strip()
    assert "ellipse:'ellipse oval circle'" in js
    assert "bubble:'speech bubble callout balloon'" in js
    assert "b.dataset.find=pair[1]+' '+(SHAPE_FIND[pair[0]]||'');" in js
    assert "strip.setAttribute('data-find','shapes');" in js


def test_show_all_has_a_search_field():
    js = _strip()
    assert "if(strip.hasAttribute('data-find')){" in js
    assert "findIn.type='search';findIn.className='strip-find';" in js
    assert "function findApply(){" in js
    # every word must match; nothing found says so
    assert "q.split(/\\s+/).every(function(w){" in js
    assert "'No shape called \\u201c'+q+'\\u201d'" in js
    # Enter arms the first shape found, and the ribbon shows them all again
    assert "if(first){e.preventDefault();first.click();}" in js
    assert "if(findIn){findIn.value='';findApply();}" in js


def test_the_shapes_you_drew_last_lead():
    js = _strip()
    assert "function shapeUsed(id){" in js
    assert "localStorage.getItem('jv-recent-shapes')" in js
    assert "return k<0?100+ids.indexOf(b.dataset.shape):k;" in js
    # recorded as a shape is DRAWN, not as its tile is picked
    sel = assets.load("js/deck/25-selecting.js")
    assert ("if(kind==='rect'&&typeof shapeUsed==='function')\n"
            "      shapeUsed(pendingShape);") in sel
