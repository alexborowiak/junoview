"""T438: an image's Object tab says where it came from first.

The user, 2026-09-14: "when clicking on an object that is an image, it
needs to tell you the path as the first thing in that tab."

T281 wrote the Source group to lead, but Arrange, History and Size &
place carry flex order 0 and Source carried 2, so it sat fourth. The
Object tab's Source group now carries order -1. And a pasted picture,
which has no path, used to lose the row altogether -- it now says so
in the same place.
"""

from __future__ import annotations


def test_source_leads_on_object(out):
    assert '.rbn-grp.rbn-sources[data-tab="object"]{order:-1;}' in out
    assert '<span class="rbn-grp rbn-sources" data-tab="object"' in out


def test_a_pasted_picture_still_gets_the_row(out):
    assert ("        if(!from) from='pasted or dropped \\u2014 no file "
            "behind it';") in out
    assert "      pth.hidden=!from;" in out
    # ...and the readout alone keeps its group on the ribbon. T453
    # moved the selector into SEL, because a shelved group's controls
    # have to be counted where they are sitting as well.
    assert "    var SEL='button,input,select,.sh-drop,.fmt-path';" in out
    assert "      var vis=false,kids=[].slice.call(g.querySelectorAll(SEL));" in out
