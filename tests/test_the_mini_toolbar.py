"""T536: formatting beside the highlighted words.

A floating bar -- B, I, U, S, A-, A+ and the deck's quick colours --
appears above a run highlighted in a box being typed in, and nowhere
else. Every button presses the ribbon's own control and reads its
pressed state back, so nothing is a second copy. Driven: F2 on the title
highlights it and the bar shows 346px wide above it, Bold lit.
"""

from __future__ import annotations

from junoview import assets


def test_it_is_a_part_and_boots():
    assert "32-mini-toolbar" in assets.DECK_PARTS
    assert "    miniBoot();" in assets.deck_js()


def test_it_proxies_the_ribbon(out):
    assert "['#fmt-bold','B','Bold (Ctrl+B)','mini-b']," in out
    assert "var real=$(p[0]); if(!real||real.disabled) return;\n" \
        "        real.click();" in out
    assert "(real&&real.getAttribute('aria-pressed')==='true')" in out
    assert "var el=activeTextEditable(); if(!el) return null;" in out
    assert ".mini-tb{position:fixed;z-index:70;" in out
