"""T525: the Home screen's buttons stay in their own column.

The 2026-09-29 audit: at 1440px the Recent presentations header's third
door, Folder, ran across the Notebooks heading -- the header is nowrap
(T484: the NAME must never break) and name plus three worded doors is
wider than a 337px column. And a live check at 900px found the whole
screen under the rail: `.welcome{left:0}` silently beat the
`left:var(--presrail-w)` written above it.

Driven at 1440, 1100, 900 and 700: every door's right edge is inside its
column, the doors wrap under the name as one group when they must, and
the screen starts at the rail's edge.
"""

from __future__ import annotations

import pytest

from junoview.render.page import render_page


@pytest.fixture(scope="module")
def web_or_out() -> str:
    return render_page([], mode="web")


def test_the_doors_are_one_group_that_can_wrap(web_or_out):
    html = web_or_out
    for col in ("Recent presentations", "Notebooks"):
        head = "<span" + html.split(f" {col}\n            <span")[1] \
            .split("</h2>")[0]
        assert head.lstrip().startswith('<span class="wj-doors">'), col
        assert head.rstrip().endswith("</button></span>"), col


def test_the_header_wraps_but_the_name_does_not(web_or_out):
    css = web_or_out
    rule = css.split(".wj-h{white-space:nowrap;")[1].split("}")[0]
    assert "flex-wrap:wrap;row-gap:6px;" in rule
    assert (".wj-doors{margin-left:auto;display:inline-flex;"
            "align-items:center;}") in css


def test_the_screen_has_room_and_starts_beside_the_rail(web_or_out):
    css = web_or_out
    assert "@media (min-width:1000px){.welcome-box{max-width:880px;}}" in css
    assert ".welcome{position:fixed;left:var(--presrail-w,0);right:0;" in css
    assert ".welcome{position:fixed;left:0;" not in css
