"""The anywidget build: its scoped stylesheet must keep every card rule.

``_scope_css`` re-emits core.css with every selector prefixed by
``.snb-root`` so the widget cannot leak styles into JupyterLab. Its scanner
is quote-aware, and an apostrophe inside a comment ("the scrollbar's
width") used to open a phantom string that swallowed every rule until the
next quote — whole stretches of the stylesheet silently vanished from the
widget, and the card headers stacked their title and Plot-trace / eye
actions vertically instead of one flex row with the actions pinned right
(2026-08-04).
"""

from __future__ import annotations

import pytest

pytest.importorskip("anywidget")


def test_scoped_widget_css_keeps_the_card_header_rules():
    from junoview.widget import _WIDGET_CSS as s
    assert ".snb-root .cardhead{display:flex" in s
    assert ".snb-root .cardhead .plot-trace-btn{margin-left:auto" in s
    assert ".snb-root .cardtitle{" in s
    assert ".snb-root .cell-eye{margin-left:auto" in s
    # the tail of core.css survives too — the old bug ate it wholesale
    assert ".snb-root .caption{" in s
    assert ".snb-root .jv-xr{" in s


def test_scope_css_survives_apostrophes_in_comments():
    from junoview.widget import _scope_css
    css = "/* the scrollbar's width */ .a{color:red;} .b{color:blue;}"
    s = _scope_css(css)
    assert ".snb-root .a{color:red;}" in s
    assert ".snb-root .b{color:blue;}" in s


def test_scope_css_keeps_quoted_text_intact():
    from junoview.widget import _scope_css
    # an apostrophe INSIDE a real string is content, not a comment issue
    s = _scope_css(".a::before{content:\"it's\";}")
    assert "it's" in s
    # ...and comment markers inside a string are not comments
    s2 = _scope_css('.a::before{content:"/* keep me */";}')
    assert '"/* keep me */"' in s2
