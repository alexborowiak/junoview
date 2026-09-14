"""T443: the consistency check is a count table in the Style system.

The user, 2026-09-14: "the fix mismatched text makes no sense. It
tells you if they are matching the default location. Sometimes it has
they all do not match -- obviously if they all do not match it's
because I moved them all with the style system. It should tell you
something like: 4 headings with this style, 3 with this. I feel like
the style system does a better job of this, showing you everything
and what is on each slide. So this can just be something that is
incorporated into the style system better."

The Home tile is gone. The Style system's rail opens with "who wears
what": one row per style the deck uses -- how many boxes wear it, how
many of those were changed by hand since, and one click that puts the
style back on them -- then the boxes wearing nothing, banded by size,
with the style the check would give them. The same survey (standardise)
read as a table instead of a list of complaints; the full check is
the screen's Check consistency button, and its hidden door stays for
the pane owner.

Driven live: a deck of two unstyled boxes showed "2 at about 14 pt,
no style yet -- Make them Heading 3"; the click left "2 Heading 3".
"""

from __future__ import annotations


def test_the_rail_opens_with_the_counts(out):
    assert "  function dgCounts(rail,ov){" in out
    assert "    dgCounts(rail,ov);   /* T443 */" in out
    fn = out.split("  function dgCounts(rail,ov){")[1].split("\n  }")[0]
    assert "    var r=standardise();" in fn
    assert "      var odd=list.filter(function(p){return !stdMatchesStyle(p.a,d);});" \
        in fn
    assert "        +(odd.length?(' \\u2014 '+odd.length+' changed by hand'):'')," \
        in fn
    assert "        b.textContent='Match '+odd.length;" in fn
    assert "      b.textContent='Make them '+sug;" in fn


def test_the_tile_is_gone_and_the_door_stays(out):
    assert "<span>Fix mismatched text</span></button>" not in out
    assert '<span class="rbn-lab">Consistency</span>' not in out
    assert '<button class="dbtn rbn-sm" id="dsg-std" hidden' in out
    assert "      +' Check consistency</button>'" in out
