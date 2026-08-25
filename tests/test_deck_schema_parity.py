"""Deck schema parity: every key deck.js normPres keeps, Python keeps too.

`as_presentations` rebuilds each deck field-by-field, so a key it does not
name silently dies on the next project save. That has happened five times
now (cropMarks / showNums / pageBg 2026-08-10, slide look / notes / goal
and the deck furniture 2026-08-20, types / sections 2026-08-22, tapzoom
2026-08-23). Instead of pinning a hand-written key list that would itself
go stale, this test extracts the kept keys from normPres ITSELF -- the
`out.KEY=` / `out[k]=` assignments in deck.js -- runs a deck carrying all
of them through `as_presentations`, and demands every one survives. The
sixth instance of this bug class is a red test, not a bug report.

One-sided keys, excluded on purpose because the extraction runs in the
JS -> Python direction only:

* ``emb`` -- normPres absorbs embedded snapshots into the session store
  instead of writing ``out.emb``; Python keeps the key (see the dated
  comment in presentations.py -- decks must stay self-contained).
* ``filters`` on custom views -- Python tolerates it, normPres never
  writes it back: dead-defensive tolerance, not drift.
"""

from __future__ import annotations

import re

from junoview import assets
from junoview.notebook.presentations import as_presentations

# ---------------------------------------------------------------------------
# extraction: the body of normPres, and the keys it copies onto `out` / `o`
# ---------------------------------------------------------------------------


def _norm_pres_body() -> str:
    """The text of normPres in deck.js.

    The function sits at two-space indentation inside the deck IIFE and
    ends before the next function at the same level (registerShell); its
    own nested helpers (`function ns`) are indented deeper, so they do
    not end the slice early.
    """
    js = assets.deck_js()
    start = js.index("function normPres(")
    nxt = re.compile(r"\n  function [A-Za-z_$]").search(js, start)
    assert nxt, "could not find the function following normPres"
    return js[start:nxt.start()]


def _kept_deck_keys(body: str) -> set[str]:
    """Deck-level keys normPres writes: `out.KEY=` plus the
    `['wmark','head','foot','styles'].forEach(... out[k]= ...)` loop."""
    keys = set(re.findall(r"\bout\.([A-Za-z_$][\w$]*)\s*=", body))
    lit_foreach = re.compile(
        r"\[((?:'[\w$]+'\s*,\s*)*'[\w$]+')\]\s*\.forEach\(function\((\w+)\)")
    for m in lit_foreach.finditer(body):
        var = m.group(2)
        # only count the loop if it actually assigns out[<var>] close by
        if re.search(r"\bout\[" + re.escape(var) + r"\]\s*=",
                     body[m.end():m.end() + 300]):
            keys |= set(re.findall(r"'([\w$]+)'", m.group(1)))
    return keys


def _kept_slide_keys(body: str) -> set[str]:
    """Slide-level keys normPres writes inside the slides .map(): `o.KEY=`."""
    start = body.index(".map(function(s){")
    end = body.index("return o;", start)
    return set(re.findall(r"\bo\.([A-Za-z_$][\w$]*)\s*=", body[start:end]))


# ---------------------------------------------------------------------------
# sentinels: a value per key that BOTH normalisers regard as worth keeping
# (truthy, correctly typed, non-empty). A key extracted from deck.js with
# no sentinel here fails loudly: add the sentinel AND the Python carry.
# ---------------------------------------------------------------------------

DECK_SENTINELS = {
    "folder": "Talks/2026",
    "page": "a4",
    "pageBg": "#ffffff",
    "showNums": 1,
    "tapzoom": 1,
    "cropMarks": 1,
    "talkMins": 25,
    "notes": "whole-talk notes",
    "pad": [{"t": "scratch"}],
    "types": [{"id": "quote", "name": "Quote"}],
    "sections": {"s1": {"name": "Introduction"}},
    "wmark": {"text": "DRAFT"},
    "head": {"text": "left header"},
    "foot": {"text": "right footer"},
    "styles": {"h1": {"size": 44}},
    "tokens": {"c": {"accent": "#39a9c0"}, "rad": 8},
    "components": {"c1": {"name": "FigureCaption", "w": 30, "h": 10,
                          "items": []}},
    "cuts": {"k1": {"name": "20-min"}},
}

SLIDE_SENTINELS = {
    "label": "poster v2",
    "sec": "s1",
    "bg": "#123456",
    "notes": "speaker notes",
    "goal": 3,
    "border": {"w": 2},
    "grpmeta": {"g": [1, 2]},
    "opt": 1,
    "cuts": ["k1"],
    "trans": "move",
    "sid": "sab12cd",
    "annots": [{"k": "text", "x": 1, "y": 1}],
    "hidden": ["demo::clim"],
    "title": "The headline",
    "sub": "The subtitle",
    "tprops": {"size": 44},
    "sprops": {"size": 20},
}

# both sides rewrite the slide skeleton rather than copy it (normPres
# converts legacy pane layouts to cell frames and empties `panes`), so
# survival-of-the-key is not the contract for these two
_STRUCTURAL_SLIDE_KEYS = {"layout", "panes"}
# kept by both sides only when the slide IS a title slide
_TITLE_ONLY_KEYS = {"title", "sub", "tprops", "sprops"}


def test_deck_level_keys_normpres_keeps_survive_the_python_rebuild():
    body = _norm_pres_body()
    kept = _kept_deck_keys(body)
    # extraction sanity: a plain assignment, the truthy flag this test was
    # written for, and one key from the forEach loop must all be found --
    # if deck.js is restyled and the regexes go blind, fail HERE, not by
    # quietly asserting nothing
    assert {"folder", "tapzoom", "styles"} <= kept, (
        f"normPres key extraction looks broken; got {sorted(kept)}")
    unknown = kept - set(DECK_SENTINELS)
    assert not unknown, (
        f"normPres now keeps deck key(s) {sorted(unknown)} this test has no "
        "sentinel for. Add a sentinel above AND carry the key in "
        "as_presentations (presentations.py), or the key will silently "
        "die on every project save.")
    deck = {"name": "parity", "slides": [], **DECK_SENTINELS}
    out = as_presentations([deck])
    assert len(out) == 1
    entry = out[0]
    dropped = sorted(k for k in kept if k not in entry)
    assert not dropped, (
        f"as_presentations dropped deck-level key(s) {dropped} that "
        "deck.js normPres preserves -- the sixth instance of the "
        "field-by-field rebuild shedding a saved setting.")
    # the flags share normPres's truthy -> 1 storage form
    assert entry["showNums"] == 1 and entry["tapzoom"] == 1 \
        and entry["cropMarks"] == 1


def test_slide_level_keys_normpres_keeps_survive_the_python_rebuild():
    body = _norm_pres_body()
    kept = _kept_slide_keys(body) - _STRUCTURAL_SLIDE_KEYS
    assert {"label", "notes", "tprops"} <= kept, (
        f"normPres slide-key extraction looks broken; got {sorted(kept)}")
    unknown = kept - set(SLIDE_SENTINELS)
    assert not unknown, (
        f"normPres now keeps slide key(s) {sorted(unknown)} this test has "
        "no sentinel for. Add a sentinel above AND carry the key in the "
        "slide rebuild in as_presentations (presentations.py).")
    title_slide = {"layout": "title", "panes": [], **SLIDE_SENTINELS}
    blank_slide = {"layout": "blank", "panes": [],
                   **{k: v for k, v in SLIDE_SENTINELS.items()
                      if k not in _TITLE_ONLY_KEYS}}
    out = as_presentations(
        [{"name": "parity", "slides": [title_slide, blank_slide]}])
    slides = out[0]["slides"]
    assert len(slides) == 2
    dropped = sorted(
        k for k in kept
        if k not in slides[0 if k in _TITLE_ONLY_KEYS else 1])
    assert not dropped, (
        f"as_presentations dropped slide-level key(s) {dropped} that "
        "deck.js normPres preserves.")
