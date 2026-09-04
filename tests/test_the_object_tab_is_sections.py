"""The Object tab is sections that answer one question each (T233).

The user, 2026-09-04: "Put object history in it's own little section...
The object ribbon is still a bit all over the place."

One group called Object held the two locks, four number boxes, the
crop, the caption, the flip book's figures, where the picture came
from, the opacity slider and the clone buttons, so nothing in it looked
related to anything else. Driven at 1700px and 2100px: six groups for a
text box (Arrange, History, Font, Paragraph, Size & place, Object), the
folding ladder takes Object first and Size & place second, and a folded
group still opens on its own name with its controls inside.
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


def test_the_grab_bag_became_three_sections():
    html = assets.deck_html()
    for ic, lab in (("rulers", "Size &amp; place"), ("cellcard", "Picture"),
                    ("objects", "Object")):
        assert f'<span class="rbn-grp" data-tab="object" data-fold-ic="{ic}">' \
            in html, ic
        assert f'<span class="rbn-lab">{lab}</span>' in html, lab
    place, pic, obj = (_ids(_row(html, x)) for x in
                       ("Size &amp; place", "Picture", "Object"))
    # where it sits on the page
    assert place == ["fmt-lock", "fmt-lockar", "fmt-geom-xy", "rb-x", "rb-y",
                     "fmt-geom-wh", "rb-w", "rb-h", "fmt-sizepos"], place
    # what the picture inside it is, and where it came from
    for cid in ("fmt-figures", "fmt-cropwrap", "fmt-caption", "fmt-imgrefresh",
                "fmt-path", "fmt-srcwrap", "fmt-parts"):
        assert cid in pic, cid
    # the object itself
    assert obj.index("fmt-opcell") < obj.index("fmt-cmp-make") \
        < obj.index("fmt-cmp-find")


def test_every_object_control_still_has_exactly_one_home():
    """Splitting a group is a move, not a copy."""
    html = assets.deck_html()
    seen: dict[str, str] = {}
    for lab in ("Arrange", "History", "Font", "Paragraph", "Line &amp; shape",
                "Size &amp; place", "Picture", "Object", "Table"):
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
    """Size & place and Object are the two that fold first, so the tile
    that replaces them has to say which one it is."""
    assert "  function rbnFoldOne(){" in out
    assert "    return rbnFoldGroup(gs[gs.length-1]);" in out
