"""T441: the choosers are compact doors that show the current choice.

The user, 2026-09-14, of the Animation tab: "there are lots of menus
that drop down when you click. These should all be buttons with what
is currently selected beside it. E.g. there is the transition button,
then there should just be one beside it with what is the current
option ... This same idea should be applied to lots of other slides
as well, like the shapes. This would give more room to make the
buttons for flip book etc. more prominent. Except for the text
options, where I want almost all of them visible."

A group marked rbn-compact is folded whatever the width (Effect,
Timing, Motion, Transition and Flip book on Animation; Shapes on
Images); its door carries the group's name over the pressed choice
inside, and a MutationObserver on aria-pressed keeps that readout
true. Build order and Whole slide (were Order and Everything on the
slide) are marked rbn-nofold and never fold. The text groups are
untouched.

Driven live at 1440px: Effect, Timing, Motion and Transition folded
with "Cut", "Still", "On click" on their doors; picking Fade through
the Effect door put "Fade" on it; Whole slide and Build order stayed
open; Shapes folded on Images.
"""

from __future__ import annotations


def test_a_compact_group_folds_by_design(out):
    # every fit starts with the choosers folded (ribbonFitPrepare, which
    # took over rbnFoldCompact's job), and the climb never folds or opens
    # one for width (2026-10-09, speed)
    prep = out.split("  function ribbonFitPrepare(ctx){")[1] \
        .split("\n  }\n")[0]
    assert ("      if(!g.classList.contains('rbn-compact')) return;\n"
            "      var f=g.classList.contains('rbn-folded');\n"
            "      if(g.hidden){if(f) rbnUnfoldGroup(g);}\n"
            "      else if(!f) rbnFoldGroup(g);") in prep
    assert "    rbnShelfRestore();" in prep
    assert ("        if(g.classList.contains('rbn-compact')||st.F.indexOf(g)>=0)"
            " return false;") in out
    assert "      if(g.classList.contains('rbn-compact')) return;\n" \
        "      var want=st.F.indexOf(g)>=0" in out
    # T594: Start, Text sequence and Each text step are sections of one
    # Timing door, Whole slide is a door, and Add animation is tiles in
    # the row again (the tab has room for them now)
    for grp in ("rbn-timing", "rbn-build", "rbn-motion", "rbn-trans",
                "rbn-flipfx", "rbn-shapes"):
        assert f'class="rbn-grp {grp} rbn-compact"' in out, grp
    assert 'class="rbn-grp rbn-anim" data-tab="animation"' in out
    # never the text groups
    for grp in ("rbn-fontgrp", "rbn-paragrp", "rbn-write"):
        assert f'class="rbn-grp {grp} rbn-compact"' not in out, grp


def test_the_door_reads_out_the_choice(out):
    # worked out (rbnReadoutCalc, which the fit also asks of a group it is
    # only thinking of folding), then written where it changed
    assert "  function rbnFoldReadout(g){" in out
    assert "    return rbnFoldReadoutWrite(g,rbnReadoutCalc(g));" in out
    # T453: the row may be on the ribbon's shelf rather than inside
    # the group, and the readout is still that group's to keep true
    assert "  function rbnReadoutCalc(g){" in out
    assert "    var row=ribbonGroupRow(g);" in out
    assert "    return rbnFoldRow(g);" in out
    # T467: every pressed control in the row, one per strip or cell,
    # joined -- "On click · By sentence"
    assert "    var ons=row?$$('[aria-pressed=\"true\"]',row):[];" in out
    # T498: two choices at most -- a rest group's eight are not a readout
    assert "    var txt=parts.length>2?'':parts.join(' \\u00b7 ');" in out
    assert "  function rbnReadoutBoot(){" in out
    assert "        attributeFilter:['aria-pressed']});" in out
    assert "  rbnReadoutBoot();" in out
    # T463: the readout is the TILE's, shared with New slide and Send
    # it away, and the door keeps its icon beside it
    assert ".fx-tile>.rbn-foldval{display:block;font:600 10px var(--mono);" \
        in out
    assert ".rbn-foldbtn.has-val>.bic{display:none;}" not in out


def test_build_order_and_whole_slide_never_fold(out):
    # T594: Whole slide is one door now (the user approved the redesign
    # that made it one); Build order still never folds, and leads the tab
    assert 'class="rbn-grp rbn-build rbn-compact" data-tab="animation"' in out
    assert 'class="rbn-grp rbn-order rbn-nofold" data-tab="animation"' in out
    assert "\n    'rbn-nofold',\n" in out.split("  var RBN_NEVER_FOLD=[")[1] \
        .split("];")[0]
    assert '<span class="rbn-lab">Build order</span>' in out
    assert '<span class="rbn-lab">Whole slide</span>' in out
