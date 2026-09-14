"""T424: a poster tile on the Home strip applies its template.

Since T218 a tile in the Home strip only CHOOSES the layout the next
New slide will use. A poster is one page and its New slide is New
version, so a poster tile chose for nothing -- the strip was the Home
tab's one door to the poster templates and clicking it did nothing.
A poster tile now applies to the page, as the Design menu's tiles do.

Driven live on an A0 page: the "3 columns" tile gave 14 typed boxes.
"""

from __future__ import annotations


def test_only_a_slide_tile_merely_chooses(out):
    assert ("          if(sel==='#layout-strip'&&!layout.poster){\n"
            "            lsSet(newLayKey(),layout.id);\n"
            "            syncNewSlideMarks();\n"
            "            return;\n"
            "          }") in out
    # and the poster tile falls through to the same apply the menu uses
    body = out.split("          if(sel==='#layout-strip'&&!layout.poster){")[1]
    assert "          applyLayout(s,layout);" in body[:600]
