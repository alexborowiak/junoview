"""T421: the right-click menu's More rows stay on the screen.

floatAt clamps the canvas menu to the window when it opens, measured
FOLDED; the rows behind "More" then grew it past the bottom edge, where
nothing could be clicked or scrolled to. The fold re-clamps after it
opens and scrolls its own first rows into view.
"""

from __future__ import annotations


def test_opening_the_fold_refits_the_menu(out):
    body = out.split("function cmFold(m){")[1].split("\n  }")[0]
    assert ("      more.hidden=!more.hidden;\n"
            "      t2.setAttribute('aria-expanded',(!more.hidden).toString());\n"
            "      cmRefit(m,more.hidden?null:t2);") in body


def test_the_refit_pulls_the_menu_up_and_scrolls_to_the_fold(out):
    fn = out.split("function cmRefit(m,at){")[1].split("\n  }")[0]
    assert ("    if(r.bottom>window.innerHeight-8)\n"
            "      m.style.top=Math.max(8,window.innerHeight-8-r.height)+'px';") in fn
    assert "    if(at) m.scrollTop=Math.max(0,at.offsetTop-6);" in fn
    # the menu keeps its own scroll, so a fold taller than the window is
    # still reachable once the menu is pulled up
    assert ("  max-width:min(340px,92vw);max-height:72vh;\n"
            "  overflow-y:auto;overflow-x:hidden;}") in out
