"""T566: the notebook toolbar reads.

The 2026-09-29 audit read the notebook ribbon's accessible names and heard
"PlotsOn", "CodeFold", three buttons all called "Choose" and two called
"100%". Each control now says what it is.
"""
from junoview import assets


def test_a_filter_is_named_as_a_setting_and_its_value():
    """The label and the state word are adjacent spans with no space, so
    the computed name ran them together; setTvBtn names the button."""
    app = assets.app_js()
    body = app.split("function setTvBtn(")[1].split("\n  }\n")[0]
    assert "b.setAttribute('aria-label',label+': '+st.textContent);" in body


def test_the_state_word_wears_the_icons_colour():
    css = assets.load("css/core.css")
    assert ".toggle.tv .tvstate{color:var(--cyan);}" in css
    assert (".toggle.tv.half .tvstate,.toggle.tv.mixed .tvstate"
            "{color:var(--amber);}") in css


def test_the_three_choosers_say_what_they_choose():
    page = assets.load("html/page.html")
    for bid, word in (("pt-filter-btn", "Which plots"),
                      ("ck-filter-btn", "Which code"),
                      ("ot-filter-btn", "Which output")):
        btn = page.split(f'id="{bid}"')[1].split("</button>")[0]
        assert f'<span class="btxt">{word}</span>' in btn, bid
        assert "Choose</span>" not in btn
    # the tour's step on them uses the new names
    assert "Which plots, Which code and Which output" in assets.app_js()


def test_the_size_readouts_say_what_they_measure():
    page = assets.load("html/page.html")
    for bid, what in (("fig-size-val", "Figure size"),
                      ("md-size-val", "Text size")):
        btn = page.split(f'id="{bid}"')[1].split("</button>")[0]
        assert f'aria-label="{what} 100% (click to reset to 100%)"' in btn
    app = assets.app_js()
    assert "function sizeReadout(el,what,pct){" in app
    assert "sizeReadout(lab,'Figure size',Math.round(figAll*100));" in app
    assert "sizeReadout(lab,'Text size',Math.round(mdAll*100));" in app
    # the tree borrows the figure readout for its zoom, and gives it back
    assert "APP.sizeReadout(v,'Tree zoom',pct);" in app
    assert ("APP.sizeReadout(fv,'Figure size',"
            "Math.round(APP.getFigAll()*100));") in app
