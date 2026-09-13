"""T402: the Animation pane is the list of clicks, and nothing else.

The user, 2026-09-13: "What is up with the animation pane? How am I
supposed to use this? I literally can't tell what is going on and how to
re-order things. I made a flip book and they are all animated and this
is very confusing to look at. Also why are there the animation button
options in here as well?"

It carried a second effect chooser, a second text-pieces chooser and a
second With-previous row -- copies of ribbon controls -- above a list
whose flip-book pages were italic chips truncated to "fa..." under a bare
arrow, and whose anchored pages were looked up by the wrong index. Now:
one numbered row per click, in the order the space bar takes them.
"""

from __future__ import annotations

from junoview import assets


def test_no_second_effect_chooser_in_the_pane(out):
    start = out.index("    function fxWord(t){")
    body = out[start:out.index("    /* ONE door. There were briefly two", start)]
    assert "anim-effb" not in body
    assert "'Entrance effect'" not in body
    assert "'How much arrives at a time'" not in body
    assert "Appear with previous" not in body
    assert "Order on this slide" not in body
    # the one door that stays is the pointing mode, beside the list it
    # rewrites
    assert "sq.innerHTML=bic('stagger')+' Quick animate\\u2026';" in body


def test_one_row_per_click_numbered_by_the_space_bar(out):
    start = out.index("    function fxWord(t){")
    body = out[start:out.index("    /* ONE door. There were briefly two", start)]
    assert "'This slide takes '+total+' click'+(total===1?'':'s')" in body
    assert "      function row(clickNo,names,detail,opts){" in body
    # a build's number comes from flipPlan, so a page turn before it counts
    assert "        var first=(plan.stop[b0]|0)+1;" in body
    assert "        var last=(plan.stop[b0+nsub-1]|0)+1;" in body
    assert "row(first===last?first:(first+'\\u2013'+last),names,detail," in body
    # what a row says
    assert ("if(nsub>1) detail+=' \\u00b7 '+nsub+' clicks, '"
            "+(pieces||'in pieces');") in body
    assert "if(st.items.length>1) detail+=' \\u00b7 together on one click';" in body
    # the mover buttons are words, never a bare arrow
    assert "[['\\u2191 Earlier',-1],['\\u2193 Later',1]].forEach(function(m){" in body


def test_a_flip_books_pages_are_rows_with_their_own_click(out):
    start = out.index("    function fxWord(t){")
    body = out[start:out.index("    /* ONE door. There were briefly two", start)]
    assert "      function stepperRows(ps){" in body
    assert "          var a=p.a,base=plan.base[p.i],cur2=(p.i===selAnnot);" in body
    assert "            var walk=flipWalk(s,a),fr=flipFrames(a);" in body
    # anchored by the build's STOP index, as flipPlan keys them
    assert "        var o=st.order,b0=steps.map[o],nsub=steps.sub[o]||1;" in body
    assert "        stepperRows(plan.anch[b0]);" in body
    assert "      stepperRows(plan.tail);" in body


def test_the_canvas_badge_counts_the_same_clicks(out):
    assert "          var clk=plan.stop[st]; if(clk==null) clk=st;" in out
    assert "          bd.className='an-buildno';bd.textContent=(clk+1);" in out


def test_the_pane_css_is_rows_not_chips():
    css = assets.deck_css()
    assert ".anim-body{flex:1;min-width:0;display:flex;flex-direction:column;" in css
    assert ".anim-name{background:none;border:none;padding:0;color:#dce6ee;" in css
    assert (".anim-step.anim-sub .anim-num{background:none;"
            "border:1px solid var(--amber);") in css
    assert ".anim-chip{" not in css
    assert ".anim-effb{" not in css
