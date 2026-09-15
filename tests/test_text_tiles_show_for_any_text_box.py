"""T401: Whole box / By bullet / By sentence / Highlight show for ANY
selected text box, animated or not.

The user, 2026-09-13: "HOW DOES IT WORK THAT DOT POINT COME OUT ONE AT A
TIME???? I CAN'T SEE ANY OF THE OPTIONS FOR TEXT!!!!!" timingState's
`text` also required an animation, so a box on None showed no text tiles
at all and the way to a bullet-by-bullet build was invisible. Picking a
piece-wise build now gives the box an entrance (Appear, on a fresh
stop), exactly what a first click on the Effect strip does.
"""

from __future__ import annotations

from junoview import assets


def test_text_means_a_text_box_is_selected_full_stop(out):
    assert ("      if(!on) return {on:false,text:!!a&&num&&a.k==='text',"
            "by:'',hl:false,") in out   # (T473 adds fig/grid)
    assert "text:!!a&&num&&a.k==='text'&&!!a.anim" not in out


def test_the_tiles_are_live_for_a_plain_box_and_say_whole_box(out):
    start = out.index("    function timingSync(){")
    body = out[start:out.index("    var ocb=$('#anim-onclick');", start)]
    assert "        b.disabled=!st.text;" in body
    assert "          (st.text&&st.by===p[1]).toString());" in body
    assert "        hb.disabled=!st.text;" in body
    assert "      if(lab) lab.textContent=st.text?'Timing & text'" in body   # T473


def test_a_piecewise_build_gives_a_plain_box_an_entrance(out):
    assert "    function ensureAnim(s,a,no){" in out
    assert "      if(!a.anim) a.anim={type:'appear',order:no};" in out
    assert "        if(by==='para'||by==='sent') ensureAnim(s,a,no).by=by;" in out
    # whole box on a box with no entrance changes nothing
    assert ("        else return;   /* no entrance and \"whole box\": "
            "nothing to change */") in out
    # highlight can be the first click too
    assert ("        else {var an=ensureAnim(s,a,no);an.hl=1; "
            "if(!an.by) an.by='para';}") in out


def test_the_tooltips_say_so():
    html = assets.deck_html()
    assert "A box with no effect yet arrives with Appear" in html
