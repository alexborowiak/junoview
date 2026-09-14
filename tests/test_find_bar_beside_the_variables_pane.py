"""T422: the Find bar is not hidden under the Variables pane.

Both dock at the top right corner and the pane stacks above the bar,
so with both open the count and the prev/next/close buttons sat behind
the pane -- the close button's hit point landed on the pane's own
close icon. The bar steps left of the pane while the pane is open.

Driven on the example notebook: Variables then Ctrl+F put the bar at
723..1119px beside a pane at 1131..1411px, no overlap; with the pane
closed the bar returned to the corner.
"""

from __future__ import annotations

from junoview import assets


def test_the_bar_steps_left_of_an_open_pane():
    css = assets.load("css/app.css")
    assert ("body:has(#varspane:not([hidden])) .docfind"
            "{right:calc(14px + 280px + 12px);}") in css
    # the numbers are the pane's own: right 14px, width 280px
    assert ".selpane.varspane{position:fixed;top:170px;right:14px;" in css
    assert "  height:min(62vh,560px);width:280px;z-index:220;}" in css
