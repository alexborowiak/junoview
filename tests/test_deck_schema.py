"""The written schema, and the validator that reports against it.

`presentations._as_presentations` coerces and never complains, which is
what makes a deck saved months ago still open. `deck_schema.validate_deck`
is the other half: it complains and never changes anything. This module
pins both halves of that split, and pins DECK-FORMAT.md against the
tables so the prose cannot drift away from the code.
"""

from __future__ import annotations

import re
from pathlib import Path

from junoview.notebook.deck_schema import (
    ANNOT_COMMON,
    ANNOT_KINDS,
    DECK_KEYS,
    LAYOUTS,
    SLIDE_KEYS,
    validate_deck,
)
from junoview.notebook.presentations import _as_presentations

DOC = Path(__file__).resolve().parent.parent / "DECK-FORMAT.md"


# ---------------------------------------------------------------------------
# the validator reports, and never does anything else
# ---------------------------------------------------------------------------

def test_a_good_deck_has_nothing_said_about_it():
    deck = {"name": "demo", "slides": [
        {"layout": "full", "panes": ["clim"],
         "annots": [{"k": "text", "x": 10, "y": 20, "text": "hello"}]},
    ]}
    assert validate_deck(deck) == []


def test_it_reports_every_problem_not_just_the_first():
    """A validator that threw on the first problem would tell you one
    thing about a file with nine, which defeats the point of writing the
    schema down at all.
    """
    bad = {"name": 1, "zzz": 1, "slides": [
        {"layout": "nope",
         "annots": [{"k": "text"}, {"k": "wat", "x": 1, "y": 1}]},
        "not a slide",
    ]}
    got = validate_deck(bad)
    paths = [p.path for p in got]
    assert len(got) >= 6, got
    assert "[0].name" in paths
    assert "[0].zzz" in paths
    assert "[0].slides[0].layout" in paths
    assert "[0].slides[0].annots[0].x" in paths
    assert "[0].slides[1]" in paths


def test_it_never_raises_and_never_mutates():
    """Given nonsense it returns a problem; given a deck it leaves the
    deck exactly as it found it. Both matter: this runs over files people
    hand-edited.
    """
    assert validate_deck(5)[0].level == "error"
    assert validate_deck(None)[0].level == "error"
    assert validate_deck([])== []
    deck = {"name": "d", "slides": [{"layout": "full", "panes": ["a"]}]}
    before = repr(deck)
    validate_deck(deck)
    assert repr(deck) == before


def test_an_unknown_key_is_a_warning_not_an_error():
    """The format has grown by adding keys, older files carry keys since
    retired, and a hand-edited deck with one stray field is still
    basically fine.
    """
    got = validate_deck({"name": "d", "slides": [], "somethingNew": 1})
    assert [p.level for p in got] == ["warn"]
    assert "somethingNew" in got[0].path


def test_pixels_where_percentages_belong_are_caught():
    """Geometry is percent of the page -- that is what lets one deck
    render at 16:9 and on an A0 poster. A four-figure coordinate means
    someone stored pixels, and nothing else in the stack would say so.
    """
    got = validate_deck({"name": "d", "slides": [{"layout": "full",
        "panes": ["a"],
        "annots": [{"k": "rect", "x": 5, "y": 5, "w": 1280, "h": 20}]}]})
    assert [p.level for p in got] == ["warn"]
    assert "looks like pixels" in got[0].message


def test_off_the_page_is_legal_and_is_not_reported():
    """A stray is a supported state -- the editor marks it and lets you
    scroll to it, deliberately (an-offpage). Forbidding it here would
    contradict the editor.
    """
    assert validate_deck({"name": "d", "slides": [{"layout": "full",
        "panes": ["a"],
        "annots": [{"k": "text", "x": -12, "y": 130}]}]}) == []


def test_a_pane_count_mismatch_is_a_warning_because_it_still_loads():
    """_as_presentations pads and truncates, so the file WILL open -- it
    just will not open as written. That is the definition of a warning.
    """
    got = validate_deck({"name": "d", "slides": [
        {"layout": "halves", "panes": ["a", "b", "c", "d"]}]})
    assert [p.level for p in got] == ["warn"]
    assert "padded or truncated" in got[0].message
    # ...and the claim is true: the loader really does fix it up
    loaded = _as_presentations([{"name": "d", "slides": [
        {"layout": "halves", "panes": ["a", "b", "c", "d"]}]}])
    assert len(loaded[0]["slides"][0]["panes"]) == LAYOUTS["halves"]


def test_a_token_reference_needs_a_name():
    got = validate_deck({"name": "d", "slides": [{"layout": "full",
        "panes": ["a"],
        "annots": [{"k": "rect", "x": 1, "y": 1, "color": "@"}]}]})
    assert [p.level for p in got] == ["error"]
    assert "token reference" in got[0].message


def test_a_view_is_not_a_deck_and_is_not_asked_for_slides():
    """A custom view carries style/view/filters instead of slides, and
    says so with kind:"view". Demanding slides of it would report every
    saved view in every project as broken.
    """
    assert validate_deck({"name": "v", "kind": "view", "slides": [],
                          "nb": "demo", "style": {}}) == []


# ---------------------------------------------------------------------------
# the document cannot drift away from the tables
# ---------------------------------------------------------------------------

def test_every_key_the_validator_knows_is_written_down():
    """DECK-FORMAT.md is prose over the same tables. An unchecked
    document drifts; this is the check.
    """
    doc = DOC.read_text(encoding="utf-8")
    for key in DECK_KEYS:
        assert f"`{key}`" in doc, f"deck key {key} is not in DECK-FORMAT.md"
    for key in SLIDE_KEYS:
        assert f"`{key}`" in doc, f"slide key {key} is not in DECK-FORMAT.md"
    for kind in ANNOT_KINDS:
        assert f"`{kind}`" in doc, f"item kind {kind} is not documented"
    for key in ANNOT_COMMON:
        assert f"`{key}`" in doc, f"item key {key} is not in DECK-FORMAT.md"
    for lay in LAYOUTS:
        assert f"`{lay}`" in doc, f"layout {lay} is not documented"


def test_the_document_invents_no_keys_of_its_own():
    """The other direction: a key in the prose that no longer exists in
    the code is worse than one missing, because it reads as true.
    """
    doc = DOC.read_text(encoding="utf-8")
    known = (set(DECK_KEYS) | set(SLIDE_KEYS) | set(ANNOT_KINDS)
             | set(ANNOT_COMMON) | set(LAYOUTS))
    # `k` is the annot table's own header -- the kind field itself, which
    # is a real key of the format and not a claim about a named one
    known.add("k")
    # only the rows of the three key tables, which are the claims
    rows = re.findall(r"^\| `([A-Za-z0-9_]+)` \|", doc, re.M)
    assert rows, "no schema tables found in DECK-FORMAT.md"
    unknown = sorted(set(rows) - known)
    assert not unknown, f"DECK-FORMAT.md documents keys that do not exist: {unknown}"


def test_the_schema_covers_what_the_loader_actually_keeps():
    """The tables must not fall behind _as_presentations. Every key that
    survives a real round trip has to be one the schema names, or the
    document is describing a format the code does not produce.
    """
    deck = {
        "name": "demo", "folder": "Talks", "page": "a4",
        "pageBg": "#fff", "cropMarks": 1, "showNums": 1, "tapzoom": 1,
        "talkMins": 25, "notes": "n", "pad": [{"t": "x"}],
        "types": [{"id": "quote", "name": "Quote"}],
        "sections": {"s1": {"name": "Intro"}},
        "wmark": {"text": "D"}, "head": {"text": "h"},
        "foot": {"text": "f"}, "styles": {"h1": {"size": 44}},
        "tokens": {"c": {"accent": "#39a9c0"}},
        "slides": [{
            "layout": "title", "panes": [], "title": "T", "sub": "S",
            "tprops": {"size": 44}, "sprops": {"size": 20},
            "annots": [{"k": "text", "x": 1, "y": 1}],
            "hidden": ["demo::clim"], "label": "v2", "sec": "s1",
            "bg": "#123456", "notes": "sn", "goal": 3,
            "border": {"w": 2}, "grpmeta": {"g": [1, 2]},
        }],
    }
    out = _as_presentations([deck])[0]
    unknown = sorted(set(out) - set(DECK_KEYS))
    assert not unknown, f"loader keeps deck keys the schema omits: {unknown}"
    unknown_s = sorted(set(out["slides"][0]) - set(SLIDE_KEYS))
    assert not unknown_s, \
        f"loader keeps slide keys the schema omits: {unknown_s}"
    # and the round trip really is clean by the validator's own lights
    assert validate_deck(out) == []
