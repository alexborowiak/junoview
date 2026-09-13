"""T412: the thumbnail strip stays where you scrolled it.

The user, 2026-09-13: "Everytime you click a slide on the thumbnails,
or add a slide or anything it always jumps and moves around the
scroll position. It should always stay the same. It always takes you
back to the top." Emptying #film-list zeroes its scrollTop, and every
repaint empties it. The position is read first and put back after;
the current slide is then brought on screen only when it is off it,
by the least that does.
"""

from __future__ import annotations


def test_the_position_is_read_before_the_wipe_and_put_back_after(out):
    assert ("    var keepTop=list.scrollTop,keepLeft=list.scrollLeft;\n"
            "    list.innerHTML='';") in out
    assert "    list.scrollTop=keepTop;list.scrollLeft=keepLeft;   /* T412 */" in out
    assert "    filmKeepCurrent(list);" in out


def test_the_current_row_comes_on_screen_only_when_it_is_off_it(out):
    assert "  function filmKeepCurrent(list){" in out
    assert "    if(rr.top>=lr.top&&rr.bottom<=lr.bottom) return;" in out
    assert "    if(rr.top<lr.top) list.scrollTop-=(lr.top-rr.top);" in out
    assert "    else list.scrollTop+=(rr.bottom-lr.bottom);" in out
    # never scrollIntoView, which some engines centre or push to the top
    assert "scrollIntoView" not in out[out.index("function filmKeepCurrent("):
                                        out.index("function filmKeepCurrent(") + 600]
