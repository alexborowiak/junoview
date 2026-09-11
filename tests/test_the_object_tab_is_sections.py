"""Style and Object are sections that answer one question each (T233).

The user, 2026-09-04: "Put object history in it's own little section...
The object ribbon is still a bit all over the place."

One group called Object held the two locks, four number boxes, the
crop, the caption, the flip book's figures, where the picture came
from, the opacity slider and the clone buttons, so nothing in it looked
related to anything else. Style now holds Font, Paragraph and Line & shape;
Object holds placement, provenance, appearance and reuse. A folded group
still opens on its own name with its controls inside.
"""

from __future__ import annotations

import re

from junoview import assets


def _row(html: str, label: str) -> str:
    fmt = html.index('<span class="et-fmt" id="et-fmt" hidden>')
    lab = html.index('<span class="rbn-lab">' + label + "</span>", fmt)
    row = html.rfind('<span class="rbn-row">', fmt, lab)
    return html[row:lab]


def _ids(row: str) -> list[str]:
    return re.findall(r'\bid="([a-z0-9-]+)"', row)


def test_history_has_a_section_of_its_own():
    """In Arrange it read as a fifth way to move something."""
    html = assets.deck_html()
    assert '<span class="rbn-grp" data-tab="object" data-fold-ic="history">' in html
    hist = _ids(_row(html, "History"))
    assert hist == ["fmt-hist"], hist
    assert "fmt-hist" not in _ids(_row(html, "Arrange"))


def test_the_grab_bag_became_focused_sections():
    html = assets.deck_html()
    for ic, lab, cls in (("rulers", "Size &amp; place", ""),
                         ("cellcard", "Picture", "rbn-picture"),
                         ("tree", "Source", "rbn-sources"),
                         ("objects", "Appearance", "rbn-appearance"),
                         ("group", "Reuse", "rbn-clones")):
        classes = "rbn-grp" + (" " + cls if cls else "")
        assert re.search(
            rf'<span class="{classes}" data-tab="object"\s+'
            rf'data-fold-ic="{ic}">', html), ic
        assert f'<span class="rbn-lab">{lab}</span>' in html, lab
    place, src, pic, appearance, reuse = (_ids(_row(html, x)) for x in
        ("Size &amp; place", "Source", "Picture", "Appearance", "Reuse"))
    # where it sits on the page
    assert place == ["fmt-lock", "fmt-lockar", "fmt-geom-xy", "rb-x", "rb-y",
                     "fmt-geom-wh", "rb-w", "rb-h", "fmt-sizepos"], place
    # where it came from is permanently visible and independent of the
    # picture-decoration group, which is allowed to fold on a laptop
    for cid in ("fmt-path", "fmt-imgrefresh", "fmt-srcwrap"):
        assert cid in src, cid
    for cid in ("fmt-figures", "fmt-cropwrap", "fmt-caption", "fmt-parts"):
        assert cid in pic, cid
    # appearance and reuse are separate jobs, so neither makes the other
    # look like a stray control in a half-full column.
    assert appearance == ["fmt-opcell", "fmt-opwrap", "fmt-op", "fmt-opval"]
    assert reuse == ["fmt-cmp-make", "fmt-cmp-find"]


def test_every_format_control_still_has_exactly_one_home():
    """Splitting the contextual surface is a move, not a copy."""
    html = assets.deck_html()
    seen: dict[str, str] = {}
    for lab in ("Arrange", "History", "Font", "Paragraph", "Line &amp; shape",
                "Size &amp; place", "Source", "Picture", "Appearance", "Reuse",
                "Table"):
        for cid in _ids(_row(html, lab)):
            assert cid not in seen, (cid, seen.get(cid), lab)
            seen[cid] = lab
    # and nothing was dropped on the way
    for cid in ("fmt-lock", "fmt-lockar", "rb-x", "rb-y", "rb-w", "rb-h",
                "fmt-crop", "fmt-caption", "fmt-imgrefresh", "fmt-sizepos",
                "fmt-figures", "fmt-src", "fmt-op", "fmt-cmp-make",
                "fmt-cmp-find", "fmt-parts", "fmt-hist"):
        assert cid in seen, cid


def test_a_folded_group_is_named_by_its_own_label(out):
    """A folded group must still say which focused job it opens."""
    assert "  function rbnFoldOne(){" in out
    assert "    return rbnFoldGroup(gs[gs.length-1]);" in out
