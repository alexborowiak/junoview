"""The front door is one grid of identical cards (T240).

The user, 2026-09-04: "The home screen is a bit wild atm. Like it could
be tidied up and organised a lot more. There is just text, and buttons
of different shapes and sizes and organisation everywhere. Please
standardise."

Four buttons sized to their own words wrapped into two ragged rows, and
only one of them carried a second line -- so the row read as four
unrelated things rather than one offer with four answers. Driven on a
web build at 1400px: four cards, all 344px wide, every one an icon, a
title and one line of help, and the drop hint said once.
"""

from __future__ import annotations

import re

from junoview import assets


def _web() -> str:
    from tests.test_front_door import render_page
    return render_page([], mode="web")


def test_every_card_is_the_same_three_parts():
    """T264 made it THREE cards, not four.

    "Try the example notebook" moved to the links row -- it is a
    first-visit door, not one of the things you come here to do
    (2026-09-04, user: "the example notebook is in an odd spot, like put
    that out of the way"). Its card also only ever existed in the web
    build, so the app build was already showing three cards in a
    two-column grid: one alone on a ragged second row, which is the very
    thing T240 set out to stop. What this test is for -- every card the
    same three parts -- is unchanged.
    """
    web = _web()
    i = web.index('class="welcome-btns"')
    j = web.index("</div>", web.index('id="welcome-url"'))
    block = web[i:j]
    for cid in ("welcome-new", "welcome-open", "welcome-url"):
        assert f'id="{cid}"' in block, cid
    assert 'id="welcome-demo"' not in block, "the example is not a card"
    # one icon, one title and one hint on each
    assert block.count('class="wc-t"') == 3, block.count('class="wc-t"')
    assert block.count('class="wc-h') == 3, block.count('class="wc-h')
    assert len(re.findall(r'class="bic', block)) == 3
    # ...and it is still reachable, one row down
    assert 'id="welcome-demo"' in web
    assert web.index('class="welcome-links"') < web.index('id="welcome-demo"')


def test_it_is_a_grid_not_a_wrapping_row():
    css = assets.load("css/app.css")
    assert (".welcome-btns{display:grid;gap:12px;margin-top:0;\n"
            "  grid-template-columns:repeat(2,minmax(0,1fr));") in css
    assert "@media (max-width:560px){\n" \
        "  .welcome-btns{grid-template-columns:minmax(0,1fr);}}" in css
    # ...and four across is deliberately NOT offered: the box is 760px
    assert "grid-template-columns:repeat(4,minmax(0,1fr));}}" not in css
    # one box for every card, whatever its words
    assert ".welcome-btns .dbtn{display:grid;" in css
    assert "  align-content:start;justify-items:start;text-align:left;" in css
    assert ".welcome-btns .dbtn>.bic{grid-row:1 / span 2;" in css


def test_the_drop_hint_is_said_once():
    web = _web()
    # it is the Open card's second line, and there is no paragraph of its
    # own restating it under the row
    assert '<p class="welcome-drop">' not in web
    assert web.count('class="wc-h welcome-drop"') == 1
    assert ".ipynb" in web
    # (the same words in Open's title attribute are a tooltip,
    # not a second band of prose on the screen)


def test_the_links_row_is_the_same_type_as_the_rest():
    css = assets.load("css/app.css")
    assert (".welcome-links{margin-top:20px;font-family:var(--sans);"
            "font-size:13px;") in css
    assert (".welcome-btns .welcome-drop{font-family:var(--sans);"
            "font-size:11.5px;") in css
