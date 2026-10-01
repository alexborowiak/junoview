"""T565: the accessibility check.

Missing alt text, reading order and contrast, over the whole deck, in the
Review centre -- each finding with its fix.
"""
from junoview import assets


def _js():
    return assets.load("js/deck/00-page.js")


def test_the_review_centre_has_a_sixth_check():
    js = _js()
    assert "cat('Accessibility','whole deck',a11yFindings().length," in js
    assert "across six checks" in js
    html = assets.load("html/deck.html")
    assert 'id="a11ypane"' in html
    ribbon = assets.load("js/deck/05-figures-and-ribbon.js")
    assert "'reviewpane','a11ypane'];" in ribbon


def test_the_three_findings_and_their_fixes():
    js = _js()
    body = js.split("function a11yFindings(){")[1].split(
        "/* go to the finding")[0]
    # 1. alt text: images, flip books and charts nobody decided about
    assert "if(a.k!=='image'&&a.k!=='flip'&&a.k!=='chart') return;" in body
    assert "if(typeof setAltText==='function') setAltText([i]);" in body
    # 2. the heading is read first, by writing the reading order
    assert "if(ord.length>1&&ord[0]!==hd){" in body
    assert "sl.rord=[sl.annots[hd].oid].concat(" in body
    # 3. contrast, WCAG's numbers, and the colour that reads
    assert "var need=(pt>=18||(pt>=14&&a.b))?3:4.5;" in body
    assert "var to=light>=dark?'#ffffff':'#0b141d';" in body


def test_each_row_carries_its_fix():
    js = _js()
    r = js.split("function renderA11y(){")[1].split("\n  }\n")[0]
    assert "fx.className='dbtn a11y-fix';" in r
    assert "e.stopPropagation();f.run();" in r
