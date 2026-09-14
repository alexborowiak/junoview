"""T446: a motion plays in the editor as well as the show.

The user, 2026-09-14: "just applied some motions to things and they
did not work. Hmmmmm."

Wobble, Float and Pulse played in the show only, so applying one
changed nothing on screen and read as broken (in the show it did
play: driven, the wobbling shape reported animation-name an-wobble).
Now the class goes on in the editor too; the selected item alone stays
still so it can still be grabbed. And an item with both an entrance
and a motion used to get only the motion, because both classes set
`animation` and the later rule won -- the fifteen pairs now list both,
the entrance first and the motion from where it ends.
"""

from __future__ import annotations


def test_the_editor_moves_too_but_not_the_selected_item(out):
    assert "    if(s.annots&&s.annots.some(function(a){" in out
    assert "        if(ma&&ma.motion) el.classList.add('an-move-'+ma.motion);" in out
    assert ('body.slide-editing .an-item.sel[class*="an-move-"]'
            '{animation:none;}') in out


def test_an_entrance_and_a_motion_both_play(out):
    assert (".an-anim-fade.an-move-wobble{animation:anIn-fade .45s ease,"
            "an-wobble 1.6s ease-in-out .45s infinite;}") in out
    assert (".an-anim-turn.an-move-pulse{animation:anIn-turn .55s "
            "cubic-bezier(.2,.7,.2,1),an-pulse 1.8s ease-in-out .55s infinite;}"
            ) in out
    for e in ("fade", "rise", "zoom", "slide", "turn"):
        for m in ("wobble", "bob", "pulse"):
            assert f".an-anim-{e}.an-move-{m}{{animation:" in out, (e, m)
