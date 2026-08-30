"""The deck format, written down — and a ``validate()`` that reports.

:mod:`junoview.notebook.presentations` is the de-facto schema: it rebuilds
a deck field by field and is the reason a deck saved months ago still
opens. But it *coerces*. An unknown key is dropped without a word, a
malformed slide is skipped, a bad annotation is filtered out. That is
exactly right for loading — a deck that half-parses is better than a
traceback in front of an audience — and exactly wrong for finding out
what is actually in a file.

So this module is the other half, and the two are deliberately different
in kind:

* ``as_presentations`` **coerces and never complains**. Loading.
* ``validate_deck`` **complains and never changes anything**. Checking.

Neither raises. A validator that threw on the first problem would tell
you one thing about a file with nine, and the whole point of writing the
schema down is to be able to see all nine.

THE TABLES BELOW ARE THE SCHEMA. ``DECK_KEYS``, ``SLIDE_KEYS`` and
``ANNOT_KINDS`` name every field with a sentence about what it is, and
DECK-FORMAT.md is prose over the same list —
``tests/test_deck_schema.py`` checks the two agree, so the document
cannot drift away from the code the way an unchecked document always
does.
"""

from __future__ import annotations

from typing import Any, NamedTuple

__all__ = ["Problem", "validate_deck", "DECK_KEYS", "SLIDE_KEYS",
           "ANNOT_KINDS", "ANNOT_COMMON", "LAYOUTS"]


class Problem(NamedTuple):
    """One thing wrong, and where.

    ``path`` reads like the JSON it came from ("slides[3].annots[1].k") so
    a report can be pasted straight into a bug. ``level`` separates "this
    will not load as you expect" from "this is unusual but survivable" —
    a deck full of warnings is still a deck.
    """

    path: str
    level: str          # "error" | "warn"
    message: str


# --------------------------------------------------------------------------
# the schema itself: every key, and one sentence on what it is
# --------------------------------------------------------------------------

#: Deck-level keys. The value is a (type, prose) pair; the type is what
#: ``isinstance`` is given, and the prose is what DECK-FORMAT.md says.
DECK_KEYS: dict[str, tuple[type | tuple[type, ...], str]] = {
    "name": (str, "What the deck is called."),
    "slides": (list, "The slides, in order. The order IS the story."),
    "kind": (str, 'Only ever "view" — a saved filtered view of one '
                  "notebook rather than a deck of slides."),
    "nb": (str, "For a view: which notebook it is a view of."),
    "style": (dict, "For a view: its saved styling."),
    "view": (dict, "For a view: its saved view state."),
    "filters": (dict, "For a view: its saved filters. Tolerated on read "
                      "and never written back."),
    "folder": (str, "The folder the deck is filed under in the rail."),
    "page": (str, 'Page-size preset id ("a4", "a0", "wide", …).'),
    "pageBg": (str, "The page's own background colour."),
    "cropMarks": (int, "1 when trim marks are printed outside the page."),
    "showNums": (int, "1 when slide numbers are drawn."),
    "tapzoom": (int, "1 when tapping an item enlarges it in playback."),
    "hideTrace": (int, "1 when the code trail under the slide is "
                       "suppressed in playback -- the trail, the "
                       "Show code pill and the scroll region all go."),
    "talkMins": ((int, float), "How long the whole talk should run."),
    "notes": (str, "Whole-talk speaker notes (per-slide notes live on "
                   "the slide)."),
    "pad": (list, "The scratchpad's notes."),
    "types": (list, "Text types this deck invented, beyond the built-in "
                    "seven."),
    "sections": (dict, "{id: {name, fold}}. Membership is the slide's "
                       "`sec` tag; the ORDER is read back off the slide "
                       "list and never stored."),
    "guides": (dict, "The guides you drew on this page: {x, y} lists of "
                     "line positions and `b` of [x, y, w, h] boxes, all "
                     "in page percentages. An editing aid -- never "
                     "rendered in present mode or any export."),
    "wmark": (dict, "Watermark across every page."),
    "head": (dict, "Running header."),
    "foot": (dict, "Running footer."),
    "styles": (dict, "This deck's overrides of the named text types."),
    "tokens": (dict, "The deck's design tokens: {c:{name:colour}, rad, "
                     "gap}. An item referencing one stores '@name'."),
    "components": (dict, "{id: {name, w, h, items}}. Named groups that "
                         "can be placed repeatedly; every instance stays "
                         "linked to the definition."),
    "cuts": (dict, "{id: {name}}. Named subsets of one deck — a "
                   "45-minute version and a 5-minute one in the same "
                   "file. Membership is the slide's `cuts` list."),
    "emb": (dict, "The deck's own copy of every placed card, so it shows "
                  "its figures with no notebook and no network."),
}

#: Slide-level keys.
SLIDE_KEYS: dict[str, tuple[type | tuple[type, ...], str]] = {
    "layout": (str, "Which pane arrangement this slide uses."),
    "lay": (str, "The id of the slide template last applied; annotations "
                 "hold its actual geometry."),
    "panes": (list, "One card anchor per pane, or null for an empty one."),
    "title": (str, "Title-slide heading."),
    "sub": (str, "Title-slide subheading."),
    "tprops": (dict, "Geometry and look of the title text."),
    "sprops": (dict, "Geometry and look of the subtitle text."),
    "annots": (list, "Everything placed freely on the slide."),
    "hidden": (list, "Card refs kept out of this slide's code trail."),
    "label": (str, "A name for this version of a poster."),
    "sec": (str, "Which section this slide belongs to."),
    "bg": (str, "This slide's own background colour."),
    "notes": (str, "Speaker notes for this slide."),
    "goal": ((int, float), "Minutes this slide should take."),
    "border": (dict, "This slide's own border."),
    "grpmeta": (dict, "Names for the groups on this slide."),
    "sid": (str, "This slide's durable name, minted the first time the "
            "deck is rehearsed. Rehearsal times are keyed by it and live "
            "beside the deck, never inside it."),
    "trans": (str, "How this slide arrives: \"\" (cut), \"fade\" or "
                   "\"move\" (matching objects travel). A section may "
                   "set a default for the slides in it."),
    "opt": (int, "1 when this slide is optional — \"Running late\" in "
                 "present mode skips it."),
    "cuts": (list, "Which named cuts this slide is in. A slide naming "
                   "none is in every cut."),
}

#: How many panes each layout has. Mirrors ``_LAYOUT_PANES``.
LAYOUTS: dict[str, int] = {"full": 1, "halves": 2, "rows": 2,
                           "quarters": 4, "title": 0, "blank": 0}

#: Fields any annot may carry, whatever its kind.
ANNOT_COMMON: dict[str, tuple[type, str]] = {
    "hide": (int, "1 to leave this out WHILE EDITING — scaffolding you "
                  "do not want in the way. It is still drawn in "
                  "playback and print."),
    "priv": (int, "1 when only you may see it: drawn on your own screen "
                  "and in the presenter view, never for the audience and "
                  "never in a PDF or a .pptx. Like speaker notes it is "
                  "stored in the deck, so a deck file you hand over "
                  "contains it."),
    "oid": (str, "This object's durable name, used to follow it through "
                 "its own history and to match it across slides for a "
                 "\"move\" transition."),
    "crop": (dict, "How this picture or figure is cropped. `t`/`r`/`b`/"
                   "`l` trim each edge by a percentage; `shape` names one "
                   "of the preset outlines, drawn INSIDE the trim box so "
                   "the same four handles move and size it; `path` is an "
                   "outline you drew yourself, a list of [x, y] points in "
                   "percent of the item's own box, which wins over both. "
                   "The picture itself is never altered -- a crop is a "
                   "mask, so clearing it brings everything back."),
    "md": (int, "1 when this text box's words are Markdown source and "
                "what is drawn is that source rendered -- headings, "
                "bullets, numbers, quotes, code, emphasis and links. "
                "Editing goes through the Markdown editor rather than "
                "the caret, because the face of the box is the output."),
    "maths": (int, "1 when this text box was built by the equation "
                   "editor: its words are LaTeX between $ or $$ "
                   "delimiters, typeset after every edit."),
    "lockar": (int, "1 to keep this item's shape while it is dragged by "
                    "a resize handle: the other side follows, so a logo "
                    "stays square and a plot keeps its proportions. The "
                    "shape itself is not stored -- it is read off the box "
                    "when the drag begins -- and holding Shift during a "
                    "drag does the opposite of whatever this says."),
    "fbtn": (int, "Flip books only: 1 to give the book one button per "
                  "figure instead of the back/forward arrows, so any "
                  "figure is one click away. A named frame names its "
                  "button."),
    "name": (str, "What to call this object in the Objects pane, the "
                  "Selection Pane of an exported .pptx, and anywhere "
                  "else it has to be listed. Absent means the object is "
                  "described by its kind and its content."),
    "alt": (str, "What this picture SHOWS, for somebody who cannot see "
                 "it: it becomes the image's alt text in every rendered "
                 "page and its description in an exported .pptx. A "
                 "caption says what to think about the figure and is "
                 "read by everyone; alt text says what is in it and is "
                 "read instead of it."),
    "link": (dict, "What happens when this object is clicked while "
                   "presenting. An ALLOW-LISTED action, never a piece of "
                   "script: `to` is either \"url\" with an `href` "
                   "(http, https or mailto only) or \"slide\" with a "
                   "`sid` -- the target slide's durable name, so "
                   "reordering the deck cannot break the link the way a "
                   "slide NUMBER would."),
    "dec": (int, "1 when this picture carries no information -- a rule, "
                 "a texture, a logo already named in the text. It is "
                 "then marked decorative and skipped by a screen reader "
                 "rather than announced as an unlabelled image, which "
                 "is the correct answer for it and the wrong answer for "
                 "everything else."),
}

#: The kinds of thing that can sit on a slide, and what each one needs to
#: be renderable at all. Geometry is in PERCENT of the page — x and w of
#: its width, y and h of its height — so a deck scales to any page size.
ANNOT_KINDS: dict[str, tuple[tuple[str, ...], str]] = {
    "text": (("x", "y"), "A text box. Auto-heights from its words, so it "
                         "has no required h."),
    "cell": (("x", "y"), "A frame showing a card from a notebook, named "
                         "by `ref`."),
    "rect": (("x", "y"), "A drawn shape; `shape` picks which one."),
    "image": (("x", "y"), "A placed picture, carried as a data URI."),
    "arrow": (("x1", "y1", "x2", "y2"),
              "A line or arrow — two endpoints, not a box."),
    "draw": (("x", "y"), "A freehand stroke: a box plus points "
                         "normalised inside it."),
    "table": (("x", "y"), "Rows of plain strings, not HTML."),
    "flip": (("x", "y"), "A flip book: several figures stepped through "
                         "in place."),
}


# --------------------------------------------------------------------------
# the validator
# --------------------------------------------------------------------------

def _kind_of(a: Any) -> str:
    k = a.get("k")
    return k if isinstance(k, str) else ""


def _check_keys(obj: dict, table: dict, path: str,
                out: list[Problem]) -> None:
    """Type-check the keys we know, and note the ones we do not.

    An unknown key is a WARNING, never an error: this format has grown by
    adding keys, older files carry keys that have since been retired, and
    a hand-edited deck with one stray field should still be reported as
    basically fine.
    """
    for key, val in obj.items():
        if not isinstance(key, str):
            out.append(Problem(path, "error",
                               f"key {key!r} is not a string"))
            continue
        spec = table.get(key)
        if spec is None:
            out.append(Problem(f"{path}.{key}", "warn",
                               "not a key this version knows about"))
            continue
        want = spec[0]
        if not isinstance(val, want):
            names = (want.__name__ if isinstance(want, type)
                     else "/".join(t.__name__ for t in want))
            out.append(Problem(f"{path}.{key}", "error",
                               f"should be {names}, "
                               f"got {type(val).__name__}"))


def _check_annot(a: Any, path: str, out: list[Problem]) -> None:
    if not isinstance(a, dict):
        out.append(Problem(path, "error",
                           f"should be an object, got {type(a).__name__}"))
        return
    kind = _kind_of(a)
    if not kind:
        out.append(Problem(f"{path}.k", "error",
                           "every item needs a kind"))
        return
    spec = ANNOT_KINDS.get(kind)
    if spec is None:
        out.append(Problem(f"{path}.k", "warn",
                           f"{kind!r} is not a kind this version draws"))
        return
    for field in spec[0]:
        if not isinstance(a.get(field), (int, float)):
            out.append(Problem(f"{path}.{field}", "error",
                               f"a {kind} needs a numeric {field}"))
    # geometry is a PERCENTAGE of the page. Outside 0..100 is legal --
    # an item parked off-page is a supported state, and the editor marks
    # it rather than forbidding it -- but wildly outside means someone
    # has stored pixels, which is the mistake worth catching.
    for field in ("x", "y", "w", "h", "x1", "y1", "x2", "y2"):
        v = a.get(field)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            if v < -1000 or v > 1000:
                out.append(Problem(f"{path}.{field}", "warn",
                                   f"{v} looks like pixels; geometry is "
                                   "a percentage of the page"))
    if kind == "cell" and a.get("ref") is not None:
        if not isinstance(a.get("ref"), str):
            out.append(Problem(f"{path}.ref", "error",
                               "a frame's ref names a card, as a string"))
    for field in ("color", "fillc", "bgc", "txcol", "bgcol"):
        v = a.get(field)
        if isinstance(v, str) and v.startswith("@") and len(v) < 2:
            out.append(Problem(f"{path}.{field}", "error",
                               "a token reference needs a name after @"))


def _check_slide(s: Any, path: str, out: list[Problem]) -> None:
    if not isinstance(s, dict):
        out.append(Problem(path, "error",
                           f"should be an object, got {type(s).__name__}"))
        return
    _check_keys(s, SLIDE_KEYS, path, out)
    lay = s.get("layout")
    if isinstance(lay, str) and lay not in LAYOUTS:
        out.append(Problem(f"{path}.layout", "error",
                           f"{lay!r} is not a layout "
                           f"({', '.join(sorted(LAYOUTS))})"))
    elif isinstance(lay, str) and isinstance(s.get("panes"), list):
        want = LAYOUTS[lay]
        got = len(s["panes"])
        if got != want:
            # a WARNING: as_presentations pads and truncates on load, so
            # this file will open -- it just will not open as written
            out.append(Problem(f"{path}.panes", "warn",
                               f"{lay} has {want} panes, this has {got}; "
                               "it will be padded or truncated on load"))
    for i, a in enumerate(s.get("annots") or []):
        _check_annot(a, f"{path}.annots[{i}]", out)


def validate_deck(obj: Any) -> list[Problem]:
    """Report everything wrong with one deck, or with a list of them.

    Accepts the same shapes :func:`as_presentations` does — a list of
    decks, ``{"presentations": [...]}``, or a single deck — because the
    thing you have in your hand is whichever of those a file happened to
    hold, and having to know which before you can check it would defeat
    the purpose.

    Returns an empty list when there is nothing to say. Never raises, and
    never modifies what it is given.
    """
    out: list[Problem] = []
    if isinstance(obj, dict) and isinstance(obj.get("presentations"), list):
        decks = obj["presentations"]
        base = "presentations"
    elif isinstance(obj, list):
        decks = obj
        base = ""
    elif isinstance(obj, dict):
        decks = [obj]
        base = ""
    else:
        return [Problem("", "error",
                        "a deck file is an object or a list of them, "
                        f"not {type(obj).__name__}")]

    for i, p in enumerate(decks):
        path = f"{base}[{i}]" if base else f"[{i}]"
        if not isinstance(p, dict):
            out.append(Problem(path, "error",
                               f"should be an object, "
                               f"got {type(p).__name__}"))
            continue
        _check_keys(p, DECK_KEYS, path, out)
        if p.get("kind") == "view":
            # a view carries no slides by design, and says so with an
            # empty list rather than by omission
            continue
        slides = p.get("slides")
        if not isinstance(slides, list):
            out.append(Problem(f"{path}.slides", "error",
                               "a deck needs a list of slides"))
            continue
        for j, s in enumerate(slides):
            _check_slide(s, f"{path}.slides[{j}]", out)
    return out
