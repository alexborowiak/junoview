"""T589: Build order folds into a door before the ribbon clips it.

The user, 2026-09-30: "the annimaion pannel is still not opening", with
a screenshot of the Animation tab cut off at "All to..." and "Rem...".
Whole slide and Build order never fold (T441/T445) and sit at the
right-hand end of the tab (T453), so once every other group was a door
and the row still did not fit, they were what the clip took. At 1280px
with a text box selected, Build order began past the ribbon's edge and
the Animation panel button could not be pressed at all.

Now, as a last resort before the edge, Whole slide folds and then Build
order. Driven at 1280x800 with an animated text box selected: Whole slide
is a door, Build order ends at the ribbon's edge, and pressing Animation
panel opens the pane.
"""

from __future__ import annotations


def test_the_never_fold_groups_fold_before_the_edge(out):
    # the ladder is asked of states since 2026-10-09 (ribbonFitClimb)
    fit = out.split("  function ribbonFitClimb(ctx){")[1].split("\n  }\n")[0]
    last = fit.index("return g.classList.contains('rbn-nofold')&&st.F.indexOf(g)<0")
    # after every ordinary group has had its turn...
    assert fit.index("while(!ctx.stale&&over(st)&&guard++<12){") < last
    # ...and before the give-back, which may open them again
    assert last < fit.index("byLeft(st.F.slice()).forEach(function(g){")
    # Build order is the very last to go
    assert "return (x.classList.contains('rbn-order')?1:0)" in fit
