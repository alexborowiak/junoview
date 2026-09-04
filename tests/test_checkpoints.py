"""A checkpoint you take on purpose, and one that survives (T225).

The user, 2026-09-03: "Also there should be version of presentations
where you can save a checkpoint then go back, or then go into a new
branch. I think this is a thing with posters, but needs to be here as
well."

The branching version tree has been here since T90 and the poster's
Versions is a different feature entirely. What was missing is the
deliberate part: every snapshot was a side-effect of opening, saving or
restoring, none had a name you chose, and the keep-the-newest-twenty
rule dropped them in arrival order -- so the version you actually cared
about was the one most likely to go.
"""

from __future__ import annotations

from junoview import assets


def test_a_snapshot_can_be_marked(out):
    assert "  function snapTake(why,captured,ready,mark){" in out
    assert "  function snapWrite(cap,ix,why,mark){" in out
    assert "    if(mark) ent.mk=1;" in out
    # a checkpoint is taken even when nothing changed
    assert "                if(prev===cap.txt&&!mark) return false;" in out
    assert "                return snapWrite(cap,ix,why,mark);" in out


def test_a_checkpoint_is_never_the_one_thrown_away(out):
    """Only unmarked snapshots are eviction candidates, oldest first."""
    assert ("    var over=next.length-HIST_KEEP,drop=[];\n"
            "    for(var di=0;di<next.length&&over>0;di++){\n"
            "      if(next[di].mk) continue;\n"
            "      drop.push(next[di]);over--;\n"
            "    }") in out
    # the tree still stays connected when something is dropped
    assert "        if(e2.p===d.id){" in out
    assert "          if(d.p) e2.p=d.p; else delete e2.p;" in out


def test_there_are_two_doors_and_both_lead_to_the_same_gesture(out):
    """One in the File menu beside the history it lands in, one inside
    the history screen itself."""
    html = assets.deck_html()
    # T236: the File menu's row moved to Home, beside History --
    # taking one and looking at them are one feature
    assert 'id="hm-check"' in html and 'id="mi-check"' not in html
    assert "                Checkpoint&#8230;</button>" in html
    assert "  function versionDoorsBoot(){" in out
    assert "      e.stopPropagation();histCheckpoint(null);});" in out
    assert "id=\"dh-check\">'+bic('flag')" in out
    assert "      .addEventListener('click',function(){histCheckpoint(ov);});" in out
    assert "  function histCheckpoint(ov){" in out
    assert ("    snapTake('checkpoint: '+nm,undefined,undefined,1)"
            ".then(function(){") in out


def test_going_back_and_branching_are_the_buttons_that_were_already_there(out):
    """A checkpoint is an ordinary snapshot with a name and a mark, so
    it needs no restore path of its own."""
    assert "Start a branch from here" in out
    assert "          histRestoreDeck(then,ent.id,nm);" in out
    assert "          snapTake('branched: '+nm);" in out
    # and the rail shows which ones you chose
    assert "        +(e.mk?' checkpoint':'')" in out
    assert ".dh-snap.checkpoint{border-left:3px solid var(--accent,#39a9c0);}" in out
