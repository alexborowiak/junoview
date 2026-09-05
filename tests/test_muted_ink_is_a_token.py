"""Muted ink in the deck comes from a token, not a literal (T284).

There are TEN colour schemes in core.css, not two. A rule that writes a
raw hex `color:` keeps that colour in all ten -- so 128 rules that had
been written by pasting `--chrome-ink-2`'s dark value in place of the
token were unreadable in every light scheme. Measured before:
`.hd-lab` 1.92:1, `.rbn-lab` 2.32:1, `.fmt-lab` 2.83:1, all against
`--chrome-1` at `#eef2f6`. After: 7.45, 6.93 and 7.45, driven in a
browser with `body.light` on.

This test is a computation over the stylesheet rather than a list of
selectors, because the failure mode is "somebody adds one more" and a
list cannot see that. It is the shape the 2026-09-05 review asked for:
781 substring assertions could not see a whole class of defect that one
loop over the source finds in a second.
"""

from __future__ import annotations

import re

from junoview import assets

WCAG_AA = 4.5


def _lum(h: str) -> float:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    ch = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
         for c in ch]
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]


def _ratio(a: str, b: str) -> float:
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _light_grounds() -> list[tuple[str, str]]:
    """The two surfaces a deck panel is painted with, in body.light."""
    core = assets.load("css/core.css")
    m = re.search(r"body\.light\s*\{(.*?)\}", core, re.S)
    tok = dict(re.findall(r"(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})",
                          m.group(1) if m else ""))
    return [("--chrome-1", tok.get("--chrome-1", "#eef2f6")),
            ("--chrome-2", tok.get("--chrome-2", "#ffffff"))]


def test_no_rule_hard_codes_dark_text_on_a_light_surface():
    deck = assets.load("css/deck.css")
    grounds = _light_grounds()
    # selectors that a body.light / body:not(.light) rule already answers
    answered = set(re.findall(
        r"body(?:\.light|:not\(\.light\))[^{]*?([.#][A-Za-z0-9_-]+)[^{]*\{",
        deck))

    bad = []
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", deck):
        sel = sel.strip().split("\n")[-1].strip()
        if not sel or sel.startswith("@") or "light" in sel:
            continue
        m = re.search(r"(?:^|[;\s])color\s*:\s*(#[0-9a-fA-F]{3,8})\s*[;}]",
                      body)
        if not m:
            continue
        fg = m.group(1)[:7]
        if _lum(fg) > 0.5:
            continue           # white-ish ink belongs on an accent fill
        if re.search(r"(?:^|[;\s])background(?:-color)?\s*:", body):
            continue           # the rule paints its own ground
        if any(a in sel for a in answered):
            continue
        worst = min(_ratio(fg, bg) for _, bg in grounds)
        if worst < WCAG_AA:
            bad.append(f"{worst:.2f}:1  {fg}  {sel}")

    assert not bad, (
        "these rules write dark text as a literal, inherit a light "
        "surface, and have no body.light answer -- use --chrome-ink, "
        "--chrome-ink-2, --chrome-ink-3, --warning, --danger or --cyan, "
        "which every scheme redefines:\n  " + "\n  ".join(sorted(bad)))


def test_the_commonest_literal_really_was_the_token():
    """#7e93a4 is --chrome-ink-2's dark value character for character,
    which is how 32 rules came to be written with it: the value was
    pasted where the name belonged. Pinned so the claim in T284 stays
    checkable."""
    core = assets.load("css/core.css")
    assert "--chrome-ink-2:#7e93a4;" in core
    deck = assets.load("css/deck.css")
    assert "color:#7e93a4" not in deck
    assert "color:var(--chrome-ink-2)" in deck
