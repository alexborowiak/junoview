"""T426: a poster tile in the Home strip shows a readable name.

A poster's strip tile has a taller (portrait) icon, which leaves its
label one line where a slide tile's gets two -- so "3 columns ·
classic" wrapped and clipped to "3", "2 columns · wide figures" to
"2", and the strip read as a row of digits. Each poster template
carries a short name the strip tile shows on one line at the slide
tiles' size; the full name stays on the tooltip.

Driven live on an A0 page: every label's scroll width equals its box
width, one line each.
"""

from __future__ import annotations

import re


def test_every_poster_template_has_a_short_name(out):
    js = out[out.index("{id:'poster-3col'"):]
    js = js[:js.index("  function applyLayout")]
    shorts = re.findall(r"short:'([^']*)'", js)
    assert len(shorts) == 8, shorts
    for s in shorts:
        assert len(s) <= 10, s


def test_the_strip_tile_shows_it_on_one_line(out):
    # (T465: the Change layout grid is the strip's tile size and takes
    # the short name too; only the builder panel shows the full one)
    assert ("        lb.textContent=(sel!=='#layout-row'&&layout.short)"
            "||layout.label;") in out
    assert ("        b.title=layout.label;") in out
    assert (".deck.poster-page .lay-strip .lay-lb{white-space:nowrap;\n"
            "  text-overflow:ellipsis;font-size:8px;}") in out
