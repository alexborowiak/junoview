"""T427 / T432: every row of the animation pane moves; Remove takes only
the animation.

T427 (2026-09-14, user: "I still can't change the order of animations
... I also can't delete these") put Earlier and Later on every row and
a Remove on every row. T432 (same day: "When removing the animation it
would remove the image/the dot point, not just remove animation, and
the re-ordering didn't work. Also would be good to be able to drag and
drop order") took the Remove off the page rows and the bullet rows --
the pane is about clicks, not content -- made the one Remove say what
stayed, made a bullet move work for lines typed with Shift+Enter (runs
between <br>s inside one block), and made every row draggable onto its
siblings: a build onto another click, a page through its book, a
bullet through its text.

Driven live: dragging click 2's build below click 3 reordered them;
dragging "delta" above "bravo" moved the words; the Remove on a build
row left the box on the slide and said so.
"""

from __future__ import annotations


def test_remove_lives_on_the_arrival_row_only_and_says_what_stayed(out):
    fn = out.split("    function removeAnim(i){")[1].split("\n    }")[0]
    assert "      delete a.anim;" in fn
    assert ("      toast('Animation removed \\u2014 '+name+' is still on "
            "the slide');") in fn
    # T577: on the row where the thing ARRIVES -- its first piece, for a
    # box in pieces -- and nowhere else
    assert ("          else if(first) acts.push(['\\u2715 Remove',"
            "'Take the animation off \\u2014 the object '\n"
            "             +'stays on the slide',") in out
    for gone in ("function dropPage(", "Take this bullet out of the text",
                 "function pieceEdit("):
        assert gone not in out, gone


def test_a_page_moves_through_its_book_and_a_bullet_through_time(out):
    """T577 (2026-09-30, user: "I currently can't mix them, like they
    are all tied together"). T427/T432 moved a bullet's WORDS through its
    text, which kept every bullet locked inside its box's block of
    clicks. A bullet row now moves in time like any other row; the words
    stay where they were typed. A flip book's page still moves only
    through its own book."""
    assert "    function movePage(a,k,t){" in out
    assert "      fr.splice(t,0,fr.splice(k,1)[0]);" in out
    assert "                 function(){movePage(a,k,k-1);},k<=0]," in out
    assert "    function pieceMove(" not in out
    # Earlier / Later step one thing one place along the list of clicks
    assert "      function moveActs(c,x){" in out
    assert ("            redo(alone?tlMoveClick(tl,c,c-1,'before')\n"
            "              :tlMove(tl,c,x,c,'before'));},alone&&c<=0],") in out
    # ...and one button says whether it shares the click above
    assert ("          function(){redo(tlMove(tl,c,x,c-1,'with'));},"
            "c<=0];") in out


def test_every_row_drags_before_after_or_onto_another(out):
    assert "      var drag=null;" in out
    assert "          r.draggable=true;" in out
    assert "      function dropHow(r,target,e){" in out
    # the top of a row is before it, the bottom after, the middle ONTO
    # its click -- the same click, which is how a photo joins its bullet
    assert "        return f<.3?'before':(f>.7?'after':'with');" in out
    assert "        redo(tlMove(tl,d.c,d.x,t.c,how));" in out
    # pages land only in their own book
    assert "        if(drag.kind==='page'&&drag.i!==target.i) return '';" in out
    assert "                drag:w.j?null:{kind:'page',i:p.i,k:w.k}});" in out
    assert ".anim-step.drop-above{box-shadow:0 -3px 0 0 var(--cyan);}" in out
    assert ".anim-step.drop-with{box-shadow:inset 0 0 0 2px var(--cyan);" in out
