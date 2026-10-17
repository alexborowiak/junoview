"""Every sentence names a control by its current name (T210).

Controls were renamed across T176-T209 (the print check became Review,
Standardise became Check consistency, Colours & spacing became Shared
colours, Set order became Quick animate, the "Saved to" switch became
the chevron beside Save). Sentences elsewhere still used the old names,
which is "stupid names in stupid places" from the other side.
"""

from __future__ import annotations

from pathlib import Path

import junoview.assets as assets


def test_the_review_centre_and_toasts_use_current_names(out):
    # (the sentences, not the code comments that still name the old picker)
    for gone in ("' Open the print check'", "' Open Standardise'",
                 'switch "Saved to"', "Saved to › a file",
                 "Colours & spacing and everything",
                 "guides and the print check lead"):
        assert gone not in out, gone
    # (T383: the check is "Fix mismatched text" again, on its own tile)
    for now in ("' Open Before you print'", "' Open Check consistency'",
                "Shared colours",
                "guides and Review lead"):
        assert now in out, now


def test_help_uses_current_names():
    help_html = (Path(assets.__file__).parent / "html" / "help.html").read_text(
        encoding="utf-8")
    assert "<i>Standardise text</i>" not in help_html
    assert "<i>Colours &amp; spacing</i>" not in help_html
    # T467: one name -- the door's (T443: "the fix mismatched text
    # makes no sense")
    assert "Fix mismatched text</i>" not in help_html
    assert "Check consistency</i>" in help_html
    # T531: T444 renamed Shared colours to Deck colours and moved it to
    # Design; the help page followed on 2026-09-29
    assert "<i>Deck colours&#8230;</i>" in help_html
    assert "Shared colours</i>" not in help_html



def _ribbon_tab_of(deck: str, label: str) -> set:
    """The data-tab of every ribbon group holding a button that reads
    `label` (its words, ignoring the icon)."""
    from html.parser import HTMLParser
    void = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "source", "track", "wbr"}
    found: set = set()

    class P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.stack: list = []
            self.text: list = []

        def handle_starttag(self, tag, attrs):
            if tag in void:
                return
            self.stack.append((tag, dict(attrs).get("data-tab")))
            if tag == "button":
                self.text = []

        def handle_data(self, data):
            self.text.append(data)

        def handle_endtag(self, tag):
            while self.stack:
                t, _ = self.stack.pop()
                if t == tag:
                    break
            if tag == "button":
                words = " ".join("".join(self.text).split())
                if words == label:
                    tabs = [d for t, d in self.stack if d and t != "button"]
                    if tabs:
                        found.add(tabs[-1])

    P().feed(deck)
    return found


def test_help_sends_you_to_the_tab_the_button_is_on():
    """A Help sentence that names a ribbon tab must name the one the
    button sits on in the ribbon as shipped. T624 moved Citations into
    Help as "Design › Citations…" while #dsg-cites lives on Text (T444),
    so someone following Help looked on the wrong tab (review,
    2026-10-12). Checked for every "<i>Tab › …</i>" path Help gives
    (Present › is the Present ▾ menu, File › and New › are menus)."""
    import re
    here = Path(assets.__file__).parent / "html"
    help_html = (here / "help.html").read_text(encoding="utf-8")
    deck = (here / "deck.html").read_text(encoding="utf-8")
    tabs = {"Home": "home", "Images": "images", "Text": "text",
            "Design": "design", "Animation": "animation", "View": "view",
            "Style": "style", "Object": "object"}
    for word, key in tabs.items():
        assert f'id="rbn-tab-{key}"' in deck, word
    paths = re.findall(r"<i>([A-Z][a-z]+) &rsaquo; ([^<]+)</i>", help_html)
    checked = 0
    for word, label in paths:
        if word not in tabs:
            continue
        label = label.replace("&hellip;", "\u2026").strip()
        where = _ribbon_tab_of(deck, label)
        assert where, (word, label, "no ribbon button reads this")
        assert tabs[word] in where, (word, label, where)
        checked += 1
    assert checked >= 1
    assert "<i>Text &rsaquo; Citations&hellip;</i>" in help_html
    assert _ribbon_tab_of(deck, "Citations\u2026") == {"text"}
