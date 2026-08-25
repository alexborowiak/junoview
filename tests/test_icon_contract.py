"""The icon contract: one artwork table, honestly consumed.

branding.py's _ICON_PATHS is the ONLY place icon artwork lives. It
reaches every surface through exactly three doors (see the icon-set
comment in branding.py):

* templates carry ``<i data-ic="key"></i>`` tokens, expanded at build
  time by ``icons()``;
* render/items.py stamps finished markup through ``icon_svg`` (its
  local alias ``_ic``);
* the scripts read ``window.SemIcons`` / the widget's ``data.icons``
  through a per-file ``bic('key')`` accessor.

Two things can rot silently and this file is what makes them loud:

1. a DEAD KEY — artwork drawn, never referenced. The eye icon shipped
   unreferenced for weeks once (2026-08-19, see branding.py). Every key
   must be consumed by one of the three doors, except the curated
   PENDING_RIBBON set below.
2. an EMOJI CREEPING BACK — emoji render as tofu in this app's mono
   font (that cost several rounds); the 2026-08-23 sweep replaced every
   button emoji with the icon family. Chrome-generating sources must
   stay free of the swept codepoints, raw or entity-encoded.

A third convention rides along since the 2026-08-24 ribbon step: any
template control whose visible content is ONLY an icon or glyph must
carry an aria-label (title alone is a tooltip, not a reliable name).
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

from junoview.branding import _ICON_PATHS

SRC = Path(__file__).resolve().parent.parent / "src" / "junoview"
ASSETS = SRC / "assets"

TEMPLATES = ["html/page.html", "html/shell.html", "html/deck.html",
             "html/help.html"]
SCRIPTS = ["js/app.js", "js/deck.js", "js/widget.js"]

# The 2026-08-23 "ribbon fill-in batch" was wired by the 2026-08-24
# ribbon step: every key it declared pending is consumed now, so the
# PENDING_RIBBON escape hatch is GONE. A drawn-but-unwired key is a bug
# again, full stop (the eye icon shipped that way for weeks once).


def _read(rel: str, base: Path = ASSETS) -> str:
    """One asset's text -- and "js/deck.js" now means the fourteen
    fragments of js/deck/ joined the way the page joins them (T36), so
    every check here goes on asking about "deck.js" and gets the same
    text it always did."""
    if rel == "js/deck.js":
        from junoview import assets
        return assets.deck_js()
    return (base / rel).read_text(encoding="utf-8")


def _used_keys() -> set[str]:
    used: set[str] = set()
    for rel in TEMPLATES:
        used |= set(re.findall(r'<i data-ic="([a-z][a-z0-9-]*)"></i>',
                               _read(rel)))
    used |= set(re.findall(r'_ic\("([a-z][a-z0-9-]*)"\)',
                           _read("render/items.py", SRC)))
    for rel in SCRIPTS:
        used |= set(re.findall(r"bic\('([a-z][a-z0-9-]*)'\)", _read(rel)))
    return used


def test_every_icon_key_is_used_or_declared_pending():
    keys = set(_ICON_PATHS)
    used = _used_keys()

    # the extraction regexes must keep matching how icons are consumed —
    # an implausibly small haul means the patterns rotted, not the icons
    assert len(used) > 30, (
        f"only {len(used)} icon keys extracted — the consumption "
        "patterns (data-ic tokens / _ic(...) / bic(...)) no longer "
        "match the sources")

    # a bic('typo') returns '' at runtime and nothing complains — THIS
    # is the check that catches a key no table carries
    unknown = used - keys
    assert not unknown, (
        f"icons referenced but not in _ICON_PATHS: {sorted(unknown)}")

    dead = keys - used
    assert not dead, (
        "icon artwork with no consumer (drawn but never referenced): "
        f"{sorted(dead)}")

    # ...and the delivery mechanism itself: the SemIcons script block
    # must be injected BEFORE the scripts that read it, or every bic()
    # icon silently renders as nothing
    page = _read("html/page.html")
    assert page.index("{icons_js}") < page.index("<script>{js}</script>"), (
        "page.html must inject {icons_js} before app.js runs")
    for rel in ("js/app.js", "js/deck.js"):
        assert "window.SemIcons" in _read(rel), (
            f"{rel} no longer reads window.SemIcons — bic() went stale")


# The codepoints the 2026-08-23 sweep removed from button-generating
# sources: the whole emoji block, the ⌚/⌛ pair and ⚙ (all render as
# tofu in the mono font), plus the two one-off glyph offenders that the
# icon family replaced (⚯ plot-trace, ⛶ full-screen). Geometric glyphs
# the ribbon still legitimately wears (✕ ⧉ ◫ ▾ …) are NOT banned; the
# later ribbon step retires those.
_BANNED = [(0x1F300, 0x1FAFF), (0x231A, 0x231B), (0x2699, 0x2699),
           (0x26AF, 0x26AF), (0x26F6, 0x26F6)]

# The ribbon/help step (2026-08-24) consumed every deliberate leftover:
# Rulers wears data-ic="rulers" and the help overlay describes the icons
# the buttons actually wear. Nothing is allowed through any more.
_ALLOWED: set[tuple[str, int]] = set()


def _banned(cp: int) -> bool:
    return any(lo <= cp <= hi for lo, hi in _BANNED)


def test_no_swept_emoji_left_in_chrome_sources():
    offenders: list[str] = []
    files = ([(rel, _read(rel)) for rel in TEMPLATES + SCRIPTS]
             + [("render/items.py", _read("render/items.py", SRC))])
    for rel, text in files:
        for i, line in enumerate(text.splitlines(), 1):
            hits: set[int] = set()
            # raw characters
            hits |= {ord(c) for c in line if _banned(ord(c))}
            # HTML entities, decimal and hex
            for m in re.finditer(r'&#(x[0-9a-fA-F]+|\d+);', line):
                v = m.group(1)
                cp = int(v[1:], 16) if v[0] in "xX" else int(v)
                if _banned(cp):
                    hits.add(cp)
            # JS \uXXXX escapes (the emoji block needs surrogate pairs,
            # but the BMP offenders — ⌚ ⚙ ⚯ ⛶ — fit in one escape)
            for m in re.finditer(r'\\u([0-9a-fA-F]{4})', line):
                cp = int(m.group(1), 16)
                if _banned(cp):
                    hits.add(cp)
            # ...and surrogate-pair escapes: \ud83c-\ud83e lead every
            # emoji-plane character, so their presence at all is a hit
            if re.search(r'\\ud83[c-eC-E]', line):
                hits.add(0x1F300)
            for cp in hits:
                if (rel, cp) not in _ALLOWED:
                    offenders.append(f"{rel}:{i} U+{cp:04X}")
    assert not offenders, (
        "swept emoji/glyph codepoints crept back into chrome sources "
        "(use an _ICON_PATHS icon, or plain words in prose/titles): "
        + "; ".join(offenders))


# Template controls whose text is EMPTY in the markup because JS writes
# their (worded) label at runtime — each names its labelling site. They
# are the only excuse for a wordless control without an aria-label.
_JS_LABELED = {
    ("html/deck.html", "qat-name"),     # syncQatName: presentation name
    ("html/deck.html", "qat-auto"),     # renderAutosaveItem: "Autosave on"
    ("html/deck.html", "mi-autosave"),  # renderAutosaveItem: "Autosave: on"
    ("html/page.html", "tv-plots"),     # setBtnText: "Plots" + state word
    ("html/page.html", "tv-markdown"),  # setBtnText
    ("html/page.html", "tv-code"),      # setBtnText
    ("html/page.html", "tv-output"),    # setBtnText
}

# JS-BUILT icon-only buttons are labelled at their creation sites (all
# carry setAttribute('aria-label', ...) beside their title): app.js —
# the tab strip's close buttons (tab-b), the rail rows' closers (rnb-x),
# tree-node eye/chevron (tn-btn); deck.js — the rail row delete
# (pr-del, a real <button> since 2026-08-24), the Layers pane's sp-act
# row buttons and group chip, the slide strip's film-mini actions, the
# flip-book pane's film-mini actions, the arrangements dialog's fp-ctr
# actions, and the animation pane's step arrows (anim-mini). A static
# scan of createElement('button') sites cannot see innerHTML wiring
# reliably, so the list above is the audited manual inventory.


class _CtrlScan(HTMLParser):
    """Every <button>/<a> in a template, with its visible text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.open: list[tuple[dict, list[str]]] = []
        self.out: list[tuple[dict, str]] = []

    def handle_starttag(self, tag, attrs):
        if tag in ("button", "a"):
            self.open.append((dict(attrs), []))

    def handle_endtag(self, tag):
        if tag in ("button", "a") and self.open:
            attrs, chunks = self.open.pop()
            self.out.append((attrs, "".join(chunks)))

    def handle_data(self, data):
        for _, chunks in self.open:
            chunks.append(data)


def test_wordless_controls_carry_aria_labels():
    """A control showing only an icon/glyph must have an aria-label.

    Words-plus-icons is the house rule, so most controls name themselves;
    the exceptions (undo/redo, pane closes, steppers, swatches, carets)
    have to be named for assistive tech — a title is only a tooltip.
    Two-sided: the _JS_LABELED allowlist must also stay honest.
    """
    wordless: set[tuple[str, str]] = set()
    anonymous: list[str] = []
    for rel in TEMPLATES:
        scan = _CtrlScan()
        scan.feed(_read(rel))
        for attrs, text in scan.out:
            if re.search(r"[A-Za-z0-9]", text):
                continue                      # worded (letters or digits)
            if (attrs.get("aria-label") or "").strip():
                continue                      # named for screen readers
            ident = attrs.get("id")
            if not ident:
                anonymous.append(f"{rel}: {attrs}")
                continue
            wordless.add((rel, ident))
    assert not anonymous, (
        "wordless template controls with neither an id nor an "
        "aria-label: " + "; ".join(anonymous))
    assert wordless == _JS_LABELED, (
        "icon/glyph-only controls and the JS-labelled allowlist "
        "disagree.\n  missing aria-label (add one, or add to _JS_LABELED "
        f"with its labelling site): {sorted(wordless - _JS_LABELED)}\n"
        "  allowlisted but now worded/labelled (remove from _JS_LABELED): "
        f"{sorted(_JS_LABELED - wordless)}")
