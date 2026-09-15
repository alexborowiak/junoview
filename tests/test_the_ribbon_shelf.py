"""A chooser opens its options in the ribbon, not over the slide (T453).

The user, 2026-09-14: "put all the ones for whole slide and build order
to the right hand side. Then each of these buttons opens up a horizontal
display of all the options ... Like how we had it before, but instead of
them all having a little horizontal thing of options, it just appears
for the one that you click on out of transition, effect, time and text,
motion (also what is disappear?)"

T441 gave every chooser a door and a readout, which fixed the crowding
but put the options in a pop-up over the slide.
"""

from __future__ import annotations


def test_the_shelf_is_in_the_bar(out):
    assert 'id="rbn-shelf"' in out
    assert 'id="rbn-shelf-name"' in out
    assert 'id="rbn-shelf-body"' in out
    assert 'id="rbn-shelf-close"' in out
    # a line of its own while open, and no space at all while not
    assert (".edit-tools.ribbon:has(.rbn-shelf:not([hidden])){"
            "flex-wrap:wrap;\n  height:auto;min-height:92px;}") in out
    assert ".rbn-shelf:not([hidden]){flex:1 0 100%;order:99;}" in out
    # one line of options, not the group's two-track grid
    assert (".rbn-shelf-body>.rbn-row{display:flex;align-items:center;\n"
            "  height:auto;column-gap:var(--rbn-col-gap);}") in out
    # (T469: the class twice, to outrank each strip's own row-width rule)
    assert ".rbn-shelf-body .strip-frame>.fx-strip.fx-strip{flex-wrap:nowrap;" in out
    # the door that owns it reads as pressed
    assert ".rbn-grp.rbn-shelved .rbn-foldbtn{" in out


def test_the_verb_groups_follow_the_choosers(out):
    # T463: after the choosers, packed against them -- the shelf takes a
    # line of its own, so the hole margin-left:auto left was buying nothing
    assert ".rbn-build{order:8;}" in out
    assert ".rbn-order{order:9;}" in out
    # the choosers keep the left, in the order they were already in
    assert ".rbn-trans{order:0;}" in out
    assert ".rbn-anim{order:1;}" in out
    assert ".rbn-timing{order:2;}" in out
    assert ".rbn-exit{order:3;}" in out
    assert ".rbn-motion{order:4;}" in out


def test_one_row_at_a_time_and_it_is_the_same_row(out):
    """The row is never rebuilt: the same element moves between its
    parked holder and the shelf, so every listener, pressed state and
    readout on it survives."""
    assert "  function rbnShelfOpen(g){" in out
    assert "    if(rbnShelfFor===g){rbnShelfDismiss();return true;}" in out
    assert "    rbnShelfClose();" in out          # another one swaps
    assert "    body.appendChild(row);" in out
    assert "      if(menu&&row) menu.appendChild(row);" in out
    # only a group the user keeps folded goes to the shelf; one folded
    # because the window is narrow keeps its pop-up
    # (T465: not on a side-docked ribbon, which has no line for a shelf)
    assert ("      if(compact&&!deckEl.classList.contains('rbn-side')"
            "&&rbnShelfOpen(g)){") in out


def test_the_shelf_survives_every_measuring_pass(out):
    """fitEditRibbon unfolds the whole bar to judge the row, and
    ribbonMinW does it eight times over to find the strip's ceiling.
    Each one hands the shelf's row back, so without this the shelf shut
    itself on every selection change."""
    assert "    if(rbnShelfFor) rbnShelfWant=rbnShelfFor;" in out
    assert "  function rbnShelfRestore(){" in out
    assert "    if(!g||rbnShelfFor) return;" in out
    # both ends of every cycle
    assert ("      if(!g.hidden&&!g.classList.contains('rbn-folded')) "
            "rbnFoldGroup(g);});\n    rbnShelfRestore();") in out
    assert "    rbnShelfRestore();      /* T453: the eight walks unfolded it */" in out
    # a user close forgets it; bookkeeping does not
    assert "  function rbnShelfDismiss(){rbnShelfWant=null;rbnShelfClose();}" in out
    # ...and a tab change gives the row back to the tab it came from
    assert "    rbnShelfSync();" in out
    assert "    if(g.hidden||g.hasAttribute('data-off')||!document.contains(g))" in out


def test_a_shelved_group_is_still_counted_as_occupied(out):
    """syncRibbonGroups hides a group with nothing in it, and a shelved
    group has nothing in it but its door -- which that pass skips. It
    would have hidden the group out from under the row it is showing."""
    assert "    var SEL='button,input,select,.sh-drop,.fmt-path';" in out
    assert ("      var shelved=(typeof rbnFoldRow==='function')"
            "?rbnFoldRow(g):null;") in out
    assert ("        kids=kids.concat([].slice.call("
            "shelved.querySelectorAll(SEL)));") in out
    assert "        var stop=g.contains(n)?g:shelved;" in out
    assert "        while(n&&n!==stop){" in out
    # and the readout reads the row wherever it is sitting
    assert "  function rbnFoldRow(g){" in out
    assert "    var row=rbnFoldRow(g);" in out


def test_disappear_is_named_for_what_you_are_choosing(out):
    """"also what is disappear?" -- it was named for what it does to the
    object, under a group label that said the same word again."""
    assert '<span class="rbn-lab">Leaves early</span>' in out
    assert "<span>Send it away</span>" in out
    assert "Disappear</button>" not in out and "<span>Disappear</span>" not in out
