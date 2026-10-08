"""An arrow's tied ends follow their boxes when items are removed or
restacked (2026-10-08 review of T561).

Ties are c1/c2 = {i}, indices into s.annots. Deleting a slide's title
shifted every index after it, so a diagram's Plan->Build arrow vanished,
the rest moved one step along and the last pointed at an arrow; bring to
front did the same. Every change that removes or reorders items now
calls retieAfter with the old array: a tie follows its box, and a tie
whose box has gone lets go where it was last drawn.

Driven at 1366x657: a title, then a Plan/Build/Test/Ship process; Delete
on the title and, separately, Ctrl+Shift+] on it both left the three
arrows Plan->Build, Build->Test, Test->Ship.
"""

from __future__ import annotations

import pytest

from helpers_js import lift_fn
from junoview import assets
from test_a_custom_heading_is_a_heading import _run


def _get(script):
    js = assets.deck_js()
    got = _run(lift_fn(js, "retieAfter") + "\n" + script)
    if got is None:
        pytest.skip("no JS engine")
    return got


SCRIPT = """
  function box(n){return {k:'text',text:n};}
  function arrow(a,b){return {k:'arrow',x1:0,y1:0,x2:1,y2:1,c1:{i:a},c2:{i:b}};}
  function names(s){return s.annots.filter(function(a){return a.k==='arrow';})
    .map(function(a){return [a.c1?s.annots[a.c1.i].text:'-',
                             a.c2?s.annots[a.c2.i].text:'-'];});}
  var out={};
  /* delete the title at 0 */
  var s={annots:[box('T'),box('Plan'),box('Build'),box('Test'),
                 arrow(1,2),arrow(2,3)]};
  var was=s.annots.slice();s.annots.splice(0,1);retieAfter(s,was);
  out.del=names(s);
  /* bring the title to the front */
  s={annots:[box('T'),box('Plan'),box('Build'),box('Test'),
             arrow(1,2),arrow(2,3)]};
  was=s.annots;s.annots=s.annots.slice(1).concat([s.annots[0]]);
  retieAfter(s,was);out.front=names(s);
  /* delete a tied box: that end lets go where it was drawn */
  s={annots:[box('Plan'),box('Build'),arrow(0,1)]};
  was=s.annots.slice();s.annots.splice(1,1);
  retieAfter(s,was,[,,{x1:5,y1:6,x2:7,y2:8}]);
  var a=s.annots[1];
  out.gone={c1:a.c1,c2:a.c2||null,x2:a.x2,y2:a.y2};
  console.log(JSON.stringify(out));
"""


def test_ties_follow_their_boxes():
    got = _get(SCRIPT)
    assert got["del"] == [["Plan", "Build"], ["Build", "Test"]]
    assert got["front"] == [["Plan", "Build"], ["Build", "Test"]]
    assert got["gone"] == {"c1": {"i": 0}, "c2": None, "x2": 7, "y2": 8}


def test_every_remove_and_reorder_reties():
    js = assets.deck_js()
    dele = lift_fn(js, "deleteSel")
    assert dele.index("var before=s.annots.slice(),ends=tiedEnds(s);") \
        < dele.index("retieAfter(s,before,ends);")
    assert "retieAfter(s,before);" in lift_fn(js, "zReorder")
    assert "retieAfter(s,old);" in lift_fn(js, "applyLayout")
    # the lint's Delete the copy on top, a flip book's own object, and a
    # component's dropped members
    assert js.count("retieAfter(") >= 7
