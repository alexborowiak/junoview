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
    assert "  function rbnFoldCompact(){" in out
    assert ("    rbnUnfoldAll();\n    sizeRibbonGroups();\n"
            "    /* T441: the choosers are compact by design, not by width */\n"
            "    rbnFoldCompact();") in out
    for grp in ("rbn-anim", "rbn-timing", "rbn-motion", "rbn-trans",
                "rbn-flipfx", "rbn-shapes"):
        assert f'class="rbn-grp {grp} rbn-compact"' in out, grp
    # never the text groups
    for grp in ("rbn-fontgrp", "rbn-paragrp", "rbn-write"):
        assert f'class="rbn-grp {grp} rbn-compact"' not in out, grp


def test_the_door_reads_out_the_choice(out):
    assert "  function rbnFoldReadout(g){" in out
    # T453: the row may be on the ribbon's shelf rather than inside
    # the group, and the readout is still that group's to keep true
    assert "    var row=rbnFoldRow(g);" in out
    # T467: every pressed control in the row, one per strip or cell,
    # joined -- "On click · By sentence"
    assert "    var ons=row?$$('[aria-pressed=\"true\"]',row):[];" in out
    assert "    var txt=parts.join(' \\u00b7 ');" in out
    assert "  function rbnReadoutBoot(){" in out
    assert "        attributeFilter:['aria-pressed']});" in out
    assert "  rbnReadoutBoot();" in out
    # T463: the readout is the TILE's, shared with New slide and Send
    # it away, and the door keeps its icon beside it
    assert ".fx-tile>.rbn-foldval{display:block;font:600 10px var(--mono);" \
        in out
    assert ".rbn-foldbtn.has-val>.bic{display:none;}" not in out


def test_build_order_and_whole_slide_never_fold(out):
    assert 'class="rbn-grp rbn-build rbn-nofold" data-tab="animation"' in out
    assert 'class="rbn-grp rbn-order rbn-nofold" data-tab="animation"' in out
    assert "        &&!g.classList.contains('rbn-nofold')" in out
    assert '<span class="rbn-lab">Build order</span>' in out
    assert '<span class="rbn-lab">Whole slide</span>' in out
