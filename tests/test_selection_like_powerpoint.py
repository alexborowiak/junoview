"""T576: selection like PowerPoint.

Shift- and Ctrl-click, groups (double-click in, Esc out), Tab, Ctrl+A and
the drag box were all there and were checked live. What was missing was
the stack: the object on top took every click. A separate click on what
is already selected now reaches the object underneath.
"""
from junoview import assets


def _js():
    return assets.load("js/deck/25-selecting.js")


def test_a_click_on_the_selection_is_armed_to_reach_underneath():
    js = _js()
    assert "function clickThroughArm(layer,idx,ev0){" in js
    arm = js.split("function clickThroughArm(layer,idx,ev0){")[1].split(
        "\n  }\n")[0]
    # never the second press of a double-click, which types
    assert "if(ev0.button!==0||ev0.detail>1) return;" in arm
    # never a drag
    assert "Math.abs(ev.clientX-x0)>3" in arm
    # it waits out the double-click, and any press cancels it
    assert "},300);" in arm
    assert "if(ctTimer){clearTimeout(ctTimer);ctTimer=0;}" in js
    # not while typing in the box
    assert "&&!item.classList.contains('an-editing'))" in js


def test_it_walks_down_the_stack_and_round_again():
    js = _js()
    nxt = js.split("function clickThroughNext(layer,idx,x,y){")[1].split(
        "\n  }\n")[0]
    assert "document.elementsFromPoint(x,y)" in nxt
    # a group not stepped into is one object
    assert "return (a&&a.grp!=null&&inGroup!==a.grp)?'g:'+a.grp:'i:'+i;" \
        in nxt
    assert "var next=units[(at+1)%units.length];" in nxt
    assert "ctLast={x:x,y:y,idx:next};" in nxt
    # the next click at the same spot carries on from there
    assert "if(ctLast&&selSet.indexOf(idx)<0&&selSet.indexOf(ctLast.idx)>=0" \
        in js


def test_the_drag_box_still_touches_on_purpose():
    """PowerPoint wants an object enclosed; this was chosen otherwise, for
    posters, and T576 leaves it."""
    js = _js()
    assert "TOUCH, not enclose" in js
    assert "if(q.r<l||q.l>r||q.b<t||q.t>b) return;" in js


def test_the_help_lists_the_gestures():
    html = assets.load("html/help.html")
    assert "<span>Click again</span>" in html
    assert "<span><kbd>Shift</kbd>/<kbd>Ctrl</kbd>+click</span>" in html
    assert "Double-click a group / <kbd>Esc</kbd>" in html
