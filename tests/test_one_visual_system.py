"""One visual system on the ribbon (T205).

The user, 2026-09-02, with three tabs screenshotted: "these aren't
really working. This is just chaos. Buttons of all shapes and sizes and
configurations all over the place." The structure was settled by then;
what was left was that every tall control had its own width, its own
icon size and its own idea of a pressed colour, three small buttons had
no icon, and the colourful theme painted groups by class so a group
moved between tabs carried its old colour along.
"""

from __future__ import annotations


def test_every_tall_control_is_the_one_tile(out):
    """72 wide, 24px icon (22 until T219), 56 tall -- alone or in a
    frame over a bar."""
    assert ".fx-tile{width:72px;display:flex;flex-direction:column;" in out
    assert ".fx-tile .bic{width:24px;height:24px;}" in out
    for rule in (".lay-strip .dbtn.lay{flex:0 0 72px;",
                 ".shape-strip .fx-tile{flex:0 0 72px;",
                 ".tx-strip .fx-tile,.page-strip .fx-tile{flex:0 0 72px;",
                 ".big-strip .fx-tile{height:56px;}",
                 ".rbn-row>.fx-strip.big-strip{align-items:center;}",
                 ".rbn-row>#hm-newslide.big-tile{width:72px;height:56px;align-self:center;}",
                 ".strip-frame>.fx-strip{height:63px;padding:4px 4px 0;",
                 ".sh-menu.strip-all .fx-strip>*{flex:0 0 auto;height:56px;}"):
        assert rule in out, rule
    # the tinted "big" face is gone: the tall shape is the emphasis
    assert ".fx-tile.big-tile{width:74px;" not in out
    assert ".fx-tile.big-tile .bic{width:24px;" not in out


def test_pressed_is_the_accent_the_button_inherits(out):
    deep = "var(--accent-deep,var(--cyan-deep))"
    for rule in (f'.dbtn[aria-pressed="true"]{{background:{deep};',
                 f".fx-tile.on{{background:{deep};",
                 f'.lay-strip .dbtn.lay[aria-pressed="true"]{{background:{deep};',
                 f'.strip-more[aria-expanded="true"]{{background:{deep};'):
        assert rule in out, rule


def test_every_small_button_has_an_icon():
    # the markup, not the page: the renderer turns each token into its svg
    from junoview import assets
    html = assets.deck_html()
    for tidy, ic in (("tight", "collapse"), ("normal", "spacing"), ("airy", "expand")):
        i = html.index(f'data-tidy="{tidy}"')
        btn = html[i:html.index("</button>", i)]
        assert f'<i data-ic="{ic}"></i>' in btn and 'title="' in btn, tidy


def test_the_colourful_theme_is_one_hue_per_tab(out):
    for tab, hue in (("home", "#f0a848"), ("insert", "#a586e8"),
                     ("design", "#6b9bff"), ("animation", "#6fd8c2"),
                     ("view", "#41c493"), ("object", "#e0a5c6")):
        i = out.index(f'body.th-colorful .rbn-grp[data-tab="{tab}"]')
        assert hue in out[i:i + 260], tab
