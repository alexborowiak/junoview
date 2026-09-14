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


def test_remove_lives_on_the_build_row_only_and_says_what_stayed(out):
    fn = out.split("    function removeBuild(si){")[1].split("\n    }")[0]
    assert "      q[si].items.forEach(function(i){delete s.annots[i].anim;});" in fn
    assert "      toast('Animation removed \\u2014 '+names.join(', ')" in fn
    assert ("            ['\\u2715 Remove','Take the animation off \\u2014 "
            "the object '\n"
            "             +'stays on the slide',") in out
    for gone in ("function dropPage(", "Take this bullet out of the text",
                 "function pieceEdit("):
        assert gone not in out, gone


def test_a_page_and_a_bullet_move_but_never_leave(out):
    assert "    function movePage(a,k,t){" in out
    assert "      fr.splice(t,0,fr.splice(k,1)[0]);" in out
    assert "                 function(){movePage(a,k,k-1);},k<=0]," in out
    assert "                 function(){pieceMove(pieceA,kk,kk-1);},false]," in out
    fn = out.split("    function pieceMove(a,k,t){")[1].split("\n    }")[0]
    # block children, or the runs between <br>s inside one block
    assert ("          /* one block: its runs between <br>s, "
            "each run with its <br>.") in fn
    assert "        var nodes=[].slice.call(wrap.childNodes),groups,runs;" in fn
    assert ("            if(gi<groups.length-1) "
            "g.push(document.createElement('br'));") in fn
    assert "        if(lines.length===groups.length) shift(lines);" in fn


def test_every_row_drags_onto_its_siblings(out):
    assert ("      var dragKey='';   "
            "/* T432: the row being dragged, by its key */") in out
    assert "          r.draggable=true;r.dataset.dk=opts.dk;" in out
    assert "      function dropKeyFor(r,dk){" in out
    assert "      function dropRow(from,to,below){" in out
    assert "        if(fk[0]==='b') moveStepTo(k,t);" in out
    assert "    function moveStepTo(si,tj){" in out
    # the build's first row also stands for bullet 0
    assert "            dk:'b:'+si,dk2:para?('t:'+ii+':0'):''});" in out
    assert "                dk:w.j?'':('p:'+p.i+':'+w.k)});" in out
    assert ".anim-step.drop-above{box-shadow:0 -3px 0 0 var(--cyan);}" in out
