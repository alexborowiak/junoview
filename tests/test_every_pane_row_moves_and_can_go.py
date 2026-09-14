"""T427: every row of the animation pane moves, and every row can go.

The user, 2026-09-14: "I still can't change the order of animations.
Like these are stuck in place. I also can't delete these as well."
Earlier and Later sat on a build's first row only; a bullet's row and a
page's row had nothing, and nothing on the pane removed anything. Now a
build row's Remove takes its animation off; a page row moves its page
through the book or takes it out; a bullet row moves its paragraph
through the text or takes it out -- the words themselves, so the slide
and the show agree. The controls sit on a second line under the name.

Driven live: "bravo" moved below "charlie" in the text, page 2 left a
three-page book, and Remove on the build left the box with no anim.
"""

from __future__ import annotations


def test_a_build_row_can_be_removed(out):
    assert "    function removeBuild(si){" in out
    assert "      q[si].items.forEach(function(i){delete s.annots[i].anim;});" in out
    assert ("            ['\\u2715 Remove',"
            "'Take the animation off: it is just there',") in out


def test_a_page_row_moves_and_goes(out):
    assert "    function movePage(a,k,dir){" in out
    assert "    function dropPage(a,k){" in out
    assert "      if(fr.length<2||k<0||k>=fr.length) return;" in out
    assert "                 function(){movePage(a,k,-1);},k<=0]," in out
    assert "                 function(){dropPage(a,k);},fr.length<2]];})(w.k);" in out


def test_a_bullet_row_moves_the_words(out):
    fn = out.split("    function pieceEdit(a,k,dir){")[1].split("\n    }")[0]
    assert "      var lines=String(a.text||'').split('\\n');" in fn
    assert "      if(a.html){" in fn
    assert "        a.html=host.innerHTML;" in fn
    # only a by-paragraph build offers it
    assert "          var para=textBy(pieceA)==='para';" in out
    assert ("                 function(){pieceEdit(pieceA,kk,0);},false]];"
            "})(k):null});") in out


def test_the_controls_are_a_second_line(out):
    assert ".anim-step{flex-wrap:wrap;}" in out
    assert (".anim-stepctr{flex:1 0 100%;display:flex;flex-direction:row;\n"
            "  justify-content:flex-end;align-items:center;gap:3px;}") in out
