"""T577: a bullet on a click of its own, mixed in with everything else.

The user, 2026-09-30: "the dot points animation is sooo annoying. Like I
currently can't mix them, like they are all tied together this is really
frustrating." A box built bullet by bullet spent a BLOCK of consecutive
clicks on its one ``anim.order``, and nothing could sit inside the block:
the photo meant for the first bullet could only arrive after the last.

``anim.parts`` gives each piece its own build order. Absent is the old
block, byte for byte, so no deck already written moves. The Animation
pane, the Story and Start all rearrange one list of clicks
(``timelineOf``) and write it back through ``timelineWrite``.

Driven live on the user's own slide shape (three bullets, two photos):
Earlier, Earlier, With prev on the first photo and Earlier, With prev on
the second, and the show played bullet 1 with the orange photo, bullet 2
with the green one, then bullet 3.
"""

from __future__ import annotations

import pytest

from helpers_js import js_engine, lift_fn, run_fn
from junoview import assets
from junoview.notebook import deck_schema

SRC = assets.load("js/deck/15-annotations.js")


def _run(name, calls):
    got = run_fn(SRC, name, calls)
    if got is None:
        pytest.skip("JavaScript engine unavailable")
    return got


def test_no_parts_is_the_old_block():
    # three pieces on order 4: one order, one sub-click each
    got = _run("pieceClaimsN", [[{"order": 4}, 3], [{"order": 2}, 1]])
    assert got[0] == [{"o": 4, "sub": 0}, {"o": 4, "sub": 1},
                      {"o": 4, "sub": 2}]
    assert got[1] == [{"o": 2, "sub": 0}]


def test_parts_put_each_piece_on_its_own_order():
    got = _run("pieceClaimsN", [
        [{"order": 0, "parts": [0, 2, 5]}, 3],
        # two bullets on one click arrive together
        [{"order": 1, "parts": [1, 1, 3]}, 3],
    ])
    assert got[0] == [{"o": 0, "sub": 0}, {"o": 2, "sub": 0},
                      {"o": 5, "sub": 0}]
    assert got[1] == [{"o": 1, "sub": 0}, {"o": 1, "sub": 0},
                      {"o": 3, "sub": 0}]


def test_a_bullet_typed_later_gets_a_click_straight_after_the_last():
    """The list names two pieces and the box now has four: the two new
    ones cost a click each, right after the last named one -- never on
    top of somebody else's click."""
    got = _run("pieceClaimsN", [[{"order": 0, "parts": [0, 3]}, 4]])
    assert got[0] == [{"o": 0, "sub": 0}, {"o": 3, "sub": 0},
                      {"o": 3, "sub": 1}, {"o": 3, "sub": 2}]


def test_a_hole_in_the_list_joins_the_piece_before():
    got = _run("pieceClaimsN", [[{"order": 1, "parts": [1, None, 4]}, 3]])
    assert got[0] == [{"o": 1, "sub": 0}, {"o": 1, "sub": 0},
                      {"o": 4, "sub": 0}]


# the user's slide: bullets b0 b1 b2 of box 1, photos 2 and 3
B = [[{"i": 1, "k": "p", "j": 0}], [{"i": 1, "k": "p", "j": 1}],
     [{"i": 1, "k": "p", "j": 2}], [{"i": 2, "k": "in"}],
     [{"i": 3, "k": "in"}]]


def test_a_photo_joins_its_bullets_click():
    got = _run("tlMove", [[B, 3, 0, 0, "with"]])[0]
    assert got == [[{"i": 1, "k": "p", "j": 0}, {"i": 2, "k": "in"}],
                   [{"i": 1, "k": "p", "j": 1}],
                   [{"i": 1, "k": "p", "j": 2}],
                   [{"i": 3, "k": "in"}]]


def test_a_photo_gets_a_click_between_two_bullets():
    got = _run("tlMove", [[B, 4, 0, 1, "after"],
                          [B, 4, 0, 1, "before"]])
    assert got[0][2] == [{"i": 3, "k": "in"}]
    assert got[0][3] == [{"i": 1, "k": "p", "j": 2}]
    assert got[1][1] == [{"i": 3, "k": "in"}]
    assert len(got[0]) == len(got[1]) == 5


def test_a_whole_click_moves_and_an_emptied_click_goes():
    got = _run("tlMoveClick", [[B, 4, 0, "before"], [B, 3, 1, "with"]])
    assert got[0][0] == [{"i": 3, "k": "in"}]
    assert got[1][1] == [{"i": 1, "k": "p", "j": 1}, {"i": 2, "k": "in"}]
    assert len(got[1]) == 4


def test_nothing_leaves_before_it_arrives():
    """A drag that puts an exit on or before its object's entrance moves
    the exit to a click of its own after the object's last piece; a
    focus before the arrival joins it. Without this animOut would simply
    ignore the exit, and the drag would have deleted it."""
    clicks = [[{"i": 5, "k": "out"}, {"i": 5, "k": "focus"}],
              [{"i": 5, "k": "p", "j": 0}], [{"i": 5, "k": "p", "j": 1}],
              [{"i": 6, "k": "in"}]]
    got = _run("tlFix", [[clicks]])[0]
    assert got == [[{"i": 5, "k": "p", "j": 0}, {"i": 5, "k": "focus"}],
                   [{"i": 5, "k": "p", "j": 1}],
                   [{"i": 5, "k": "out"}],
                   [{"i": 6, "k": "in"}]]


def test_the_write_back_keeps_the_block_when_it_can():
    """Written back, a box whose pieces are still one unbroken run with
    nothing else on the later clicks is a plain block again -- no
    `parts` -- so a deck only carries the list when it says something."""
    eng = js_engine()
    if eng is None:
        pytest.skip("JavaScript engine unavailable")
    code = "\n".join(lift_fn(SRC, n) for n in (
        "tlFix", "timelineWrite")) + r"""
function run(clicks){
  var s={annots:[{k:'text',anim:{order:9,parts:[9,8,7]}},
                 {k:'image',anim:{order:9}}]};
  timelineWrite(s,clicks);
  return s.annots.map(function(a){return a.anim;});
}
var block=run([[{i:0,k:'p',j:0}],[{i:0,k:'p',j:1}],[{i:0,k:'p',j:2}],
  [{i:1,k:'in'}]]);
var mixed=run([[{i:0,k:'p',j:0},{i:1,k:'in'}],[{i:0,k:'p',j:1}],
  [{i:0,k:'p',j:2}]]);
var split=run([[{i:0,k:'p',j:0}],[{i:1,k:'in'}],[{i:0,k:'p',j:1}],
  [{i:0,k:'p',j:2}]]);
console.log(JSON.stringify([block,mixed,split]));
"""
    import json
    import subprocess
    import tempfile
    from pathlib import Path
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(code, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr
    block, mixed, split = json.loads(r.stdout)
    assert block == [{"order": 0}, {"order": 3}]
    # the photo on the first bullet's click: the rest still follow on
    # unbroken, with nothing else on them, so it is still a block
    assert mixed == [{"order": 0}, {"order": 0}]
    # a photo BETWEEN two bullets is what the list is for
    assert split == [{"order": 0, "parts": [0, 2, 3]}, {"order": 1}]


def test_every_order_writer_that_is_not_the_list_clears_it(out):
    # Quick animate says "this arrives now", as a block
    assert ("    if(a.anim) {a.anim.order=ord;a.anim.type=seqType;"
            "delete a.anim.parts;}") in out
    # the swap gives the incoming object a fresh order
    assert "                delete comes.anim.parts;   /* T577: a block again */" \
        in out
    # With previous / On click go through the list
    assert "      timelineWrite(s,tlMove(tl,e.c,e.x,e.c-1,'with'));commit(s);" in out
    assert "      timelineWrite(s,tlMove(tl,e.c,e.x,e.c,'after'));commit(s);" in out
    assert "    function renumber(s){timelineWrite(s,timelineOf(s));}" in out


def test_the_show_reads_each_piece_off_its_own_step(out):
    assert "  function pieceSteps(steps,a){" in out
    assert "            var vpst=pieceSteps(steps,ba);   /* T577: its own step */" \
        in out
    assert "    var pst=pieceSteps(slideBuildSteps(s),a);   /* T577" in out
    # a self-running stop reads the builds that START on it, not the
    # animSeq entry that happened to share its index
    assert ("      if(!a||!a.anim||a.hide||steps.map[a.anim.order||0]!==b) "
            "return;") in out


def test_the_format_says_what_parts_is():
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert "`parts` (a list of build orders, one per piece" in fmt
    src = open(deck_schema.__file__, encoding="utf-8").read()
    assert "`parts` is a list of build ORDERS, one per piece" in src
