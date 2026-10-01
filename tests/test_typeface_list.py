"""T570: the typeface list shows the typefaces.

Every option drawn in its own face, and the faces you used last at the
top, as PowerPoint's Recently Used Fonts.
"""
from junoview import assets


def _js():
    return assets.load("js/deck/30-format-bar.js")


def test_each_option_wears_its_own_face():
    js = _js()
    assert "var fontOpt=function(id,label){" in js
    assert "'\" style=\"font-family:'" in js
    assert "+attr(fontCss(id)||'inherit')+" in js


def test_recent_faces_head_the_list():
    js = _js()
    assert "function recentFonts(){" in js
    assert "localStorage.getItem('jv-recent-fonts')" in js
    assert "'<optgroup label=\"Recently used\">'" in js
    # both ways of choosing a face are remembered
    assert js.count("pushRecentFont(") >= 3   # definition + two callers


def test_the_closed_list_wears_the_face():
    sel = assets.load("js/deck/25-selecting.js")
    assert "fontSel.style.fontFamily=fontCss(fv)||'';" in sel
    assert "if(!FONTMAP[fv]&&!listed){" in sel
