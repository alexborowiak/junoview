"""T574: the presenter view, checked against PowerPoint's.

Already there: pause and reset, the next slide, notes, Running late, the
pace, a word search. Added: the notes' size, a slide by its number (in
the show and the presenter window), Black screen and End show from the
presenter window, and the time of day.
"""
from junoview import assets


def _pv():
    return assets.load("js/deck/45-images.js")


def test_a_slide_by_its_number_in_the_show():
    js = assets.load("js/deck/51-talk-tools.js")
    assert "function talkNumKey(k){" in js
    assert "function slideAtNumber(n){" in js
    assert "if(!slideIsAlt(i)&&slideNo(i)===n) return i;" in js
    assert "if(talkNumKey(k)) return true;" in js
    assert "toast('There is no slide '+want);" in js


def test_the_presenter_window_has_what_powerpoints_has():
    js = _pv()
    for bit in ("id=\"jvp-tod\"", "id=\"jvp-black\"", "id=\"jvp-end\"",
                "id=\"jvp-nsmall\"", "id=\"jvp-nbig\""):
        assert bit in js, bit
    assert "else if(msg.do==='black'){" in js
    assert "else if(msg.do==='end'){" in js
    assert "var NOTES_PX_KEY='jv-presenter-notes-px';" in js
    # a number in its search is a slide number first
    assert "if(/^[0-9]{1,4}$/.test(q)){" in js
    # and Black screen follows whichever window blacked it
    tt = assets.load("js/deck/51-talk-tools.js")
    assert "talkToolsSync();\n    talkBlackSync();" in tt
