"""'Split in two' fits the side rail (2026-10-11 review).

A cell frame's part picker (#fmt-parts: Figure, Code, Split in two) is one
nowrap row of pills, 264px of them, and the rail (ribbon at the side) is
226px with its padding: Split in two ran 50px past its edge and was cut
off, at 1366x657 and 1280x600 alike. In the rail the picker is a line of
its own now and its pills wrap and pair up like every other control there
-- each keeps its word and its icon (never icon-only, the user's rule).
The horizontal ribbon is untouched: it never wraps, and fitEditRibbon
compacts it instead. Driven in Chromium at both laptop sizes by
tests/test_the_editor_keyboard_in_a_browser.py (opt-in).
"""

from __future__ import annotations

import re

from junoview import assets


def _rule(css: str, selector: str) -> str:
    m = re.search(re.escape(selector) + r"\{([^}]*)\}", css)
    assert m, f"no rule for {selector}"
    return m.group(1)


def test_in_the_rail_the_picker_is_a_line_of_its_own_and_wraps():
    css = assets.deck_css()
    slot = _rule(css, ".deck.rbn-side .rbn-partslot:not([hidden])")
    assert "flex:1 0 100%;" in slot and "width:100%;" in slot
    pills = _rule(css, ".deck.rbn-side #fmt-parts .cellparts")
    assert "flex-wrap:wrap;" in pills and "width:100%;" in pills
    # a pill grows to pair up; it never shrinks, which would cut its word
    pill = _rule(css, ".deck.rbn-side #fmt-parts .cellpartbtn")
    assert "flex:1 0 auto;" in pill


def test_only_the_rail_is_changed():
    css = assets.deck_css()
    # every new rule is scoped to the rail
    i = css.index("so does a cell frame's part picker (#fmt-parts)")
    block = css[i:css.index("full-screen EDITING", i)]
    sels = re.findall(r"\n(\.[^{]+)\{", block)
    assert sels and all(s.startswith(".deck.rbn-side ") for s in sels)
    # the ribbon's own picker is still one row
    assert "#fmt-parts .cellparts{position:static;display:inline-flex;" \
        in css


def test_the_pills_keep_their_words_and_icons():
    deck = assets.deck_js()
    # the fix is the rail's layout, not a shorter pill: every pill still
    # carries its icon AND its word (T530)
    assert ("sp.className='cellpartbtn split';sp.innerHTML=bic('outline')"
            "+' Split in two';") in deck
    assert ("      b.innerHTML=(PART_IC[fp]?bic(PART_IC[fp])+' ':'')\n"
            "        +esc(fp.charAt(0).toUpperCase()+fp.slice(1));") in deck
