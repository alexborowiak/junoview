"""Saved presentation decks: reading them, and putting one into a notebook.

A deck is a list of slides, each naming cards by stable anchor. Decks travel in
``metadata.semantic.presentations``, in a ``<notebook>.deck.json`` sidecar, or
in the app's project file. This module normalises all three into one shape and
tolerates older layouts, so a deck saved months ago still opens.

``deck_json`` and :func:`embed_deck` live here rather than in
:mod:`~junoview.notebook.loader`, whose job is stated in its own first line:
*getting notebooks from where they live*. Reading a DECK file is not that, and
writing one INTO a notebook is the opposite of it — a module that says "getting"
had a function that puts. They sit here beside ``as_presentations``, which
``embed_deck`` has always called and which is the reason its output is a shape
the editor can open at all (2026-08-25, TASKS T37).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .._write import write_text

_LAYOUT_PANES = {"full": 1, "halves": 2, "rows": 2, "quarters": 4,
                 "title": 0, "blank": 0}


def as_presentations(obj: Any) -> list:
    """Normalize saved presentation data to [{name, slides}, ...].

    Accepts the current schema (a list, or {"presentations": [...]}) plus
    the legacy single-deck schema ({"slides": [{kind, anchor, beside}]}),
    whose card slides are converted to pane layouts. Slides may carry
    free annotations (text boxes / arrows / rects) and title-slide text.
    """
    if isinstance(obj, list):
        pres = obj
    elif isinstance(obj, dict) and isinstance(obj.get("presentations"), list):
        pres = obj["presentations"]
    elif isinstance(obj, dict) and isinstance(obj.get("slides"), list):
        pres = [{"name": obj.get("name") or "deck", "slides": obj["slides"]}]
    else:
        return []
    out = []
    for p in pres:
        if not isinstance(p, dict):
            continue
        # A CUSTOM VIEW is not a slide deck: it is a saved, styled, filtered
        # view of ONE notebook, so it carries style / view / filters instead
        # of slides. It keeps an empty `slides` list so every consumer that
        # reaches for .slides still works. (2026-07-29)
        # heterogeneous by design: a name, a list of slides, and whichever of
        # kind / nb / style / view / filters / folder / page apply
        entry: dict[str, Any]
        if p.get("kind") == "view":
            entry = {"name": str(p.get("name") or "view"), "kind": "view",
                     "slides": []}
            if isinstance(p.get("nb"), str) and p["nb"].strip():
                entry["nb"] = p["nb"].strip()
            # `filters` is one-sided ON PURPOSE: deck.js normPres never
            # writes it back for a view, so keeping it here is dead-
            # defensive tolerance for hand-edited files, not schema drift.
            # The parity test excludes it for that reason (2026-08-23).
            for key in ("style", "view", "filters"):
                if isinstance(p.get(key), dict):
                    entry[key] = p[key]
            if isinstance(p.get("folder"), str) and p["folder"].strip():
                entry["folder"] = p["folder"].strip()
            out.append(entry)
            continue
        if not isinstance(p.get("slides"), list):
            continue
        slides = []
        for s in p["slides"]:
            if not isinstance(s, dict):
                continue
            if "panes" in s or s.get("layout") in _LAYOUT_PANES:
                lay = s.get("layout")
                raw_panes = [a if isinstance(a, str) and a else None
                             for a in (s.get("panes") or [])]
                if lay not in _LAYOUT_PANES:
                    lay = {1: "full", 2: "halves"}.get(
                        len(raw_panes) or 1, "quarters")
                n = _LAYOUT_PANES[lay]
                panes = (raw_panes + [None] * n)[:n]
                slide: dict = {"layout": lay, "panes": panes}
                if lay == "title":
                    slide["title"] = str(s.get("title") or "")
                    slide["sub"] = str(s.get("sub") or "")
                    for k in ("tprops", "sprops"):
                        if isinstance(s.get(k), dict):
                            slide[k] = s[k]
                if isinstance(s.get("annots"), list):
                    ann = [a for a in s["annots"] if isinstance(a, dict)]
                    if ann:
                        slide["annots"] = ann
                if isinstance(s.get("hidden"), list):
                    hid = [r for r in s["hidden"] if isinstance(r, str) and r]
                    if hid:
                        slide["hidden"] = hid
                # the name given to a poster version. This rebuild drops
                # every key it does not name, so an unlisted field does not
                # survive a project save (2026-08-10).
                if isinstance(s.get("label"), str) and s["label"].strip():
                    slide["label"] = s["label"].strip()
                # which section this slide belongs to. The tag is the whole
                # model -- section order is read back off the slide list --
                # so losing it here loses the sections entirely, names and
                # all (2026-08-22).
                if isinstance(s.get("sec"), str) and s["sec"].strip():
                    slide["sec"] = s["sec"].strip()
                # optional slides and named cuts (2026-08-25). Both are
                # membership stored ON the slide, so they ride through
                # every reorder; losing them here would silently turn a
                # deck's "20-minute version" back into the full one.
                if s.get("opt"):
                    slide["opt"] = 1
                # how this slide ARRIVES -- "", "fade" or "move".
                # Per-slide because that is how anyone thinks about it
                # (2026-08-25).
                if isinstance(s.get("trans"), str) and s["trans"].strip():
                    slide["trans"] = s["trans"].strip()
                # the slide's durable name, minted on first rehearsal.
                # Losing it here would make every rehearsal recorded
                # before a project save unattributable (2026-08-25, T29).
                if isinstance(s.get("sid"), str) and s["sid"].strip():
                    slide["sid"] = s["sid"].strip()
                if isinstance(s.get("cuts"), list) and s["cuts"]:
                    cuts = [c for c in s["cuts"]
                            if isinstance(c, str) and c]
                    if cuts:
                        slide["cuts"] = cuts
                # per-slide look, speaker notes and the time goal: the JS
                # normaliser (normPres) has carried these for a while; this
                # rebuild silently shed them on every round-trip through
                # Python — a project save cost you your speaker notes
                # (2026-08-20).
                if isinstance(s.get("bg"), str) and s["bg"].strip():
                    slide["bg"] = s["bg"].strip()
                if isinstance(s.get("notes"), str) and s["notes"]:
                    slide["notes"] = s["notes"]
                if isinstance(s.get("goal"), (int, float)) and s["goal"] > 0:
                    slide["goal"] = s["goal"]
                for k in ("border", "grpmeta"):
                    if isinstance(s.get(k), dict):
                        slide[k] = s[k]
                slides.append(slide)
            elif s.get("kind") == "card" and s.get("anchor"):   # legacy
                panes = [s["anchor"]] + [b for b in (s.get("beside") or [])
                                         if isinstance(b, str)][:3]
                lay = {1: "full", 2: "halves"}.get(len(panes), "quarters")
                slides.append({"layout": lay, "panes": panes})
        entry = {"name": str(p.get("name") or "deck"), "slides": slides}
        if isinstance(p.get("folder"), str) and p["folder"].strip():
            entry["folder"] = p["folder"].strip()
        if isinstance(p.get("page"), str) and p["page"].strip():
            entry["page"] = p["page"].strip()   # page-size preset id
        # Print and display decisions that the editor writes and that this
        # rebuild was silently discarding: crop marks never survived any
        # reload, and slide numbers and the page background never survived
        # a project save (2026-08-10).
        if p.get("cropMarks"):
            entry["cropMarks"] = 1
        if p.get("showNums"):
            entry["showNums"] = 1
        # tap-to-enlarge, same truthy->1 rule as showNums: the FIFTH key
        # this rebuild silently shed while normPres kept it. The parity
        # test (tests/test_deck_schema_parity.py) now diffs this function
        # against normPres so the sixth never happens (2026-08-23).
        if p.get("tapzoom"):
            entry["tapzoom"] = 1
        if isinstance(p.get("pageBg"), str) and p["pageBg"].strip():
            entry["pageBg"] = p["pageBg"].strip()
        # deck-level furniture, the whole-talk notes/pad and named styles:
        # same story as the slide keys above — normPres kept them, this
        # rebuild lost them (2026-08-20).
        if isinstance(p.get("talkMins"), (int, float)) and p["talkMins"] > 0:
            entry["talkMins"] = p["talkMins"]
        if isinstance(p.get("notes"), str) and p["notes"]:
            entry["notes"] = p["notes"]
        if isinstance(p.get("pad"), list) and p["pad"]:
            entry["pad"] = p["pad"]
        # the text types a deck invented ("Quote", "Source note"). A LIST,
        # not a dict, so it cannot join the loop below -- and losing it
        # here is the quiet failure: custom types work perfectly in the
        # browser and vanish the moment the deck is saved to the project
        # and reopened (2026-08-22).
        if isinstance(p.get("types"), list) and p["types"]:
            types = [t for t in p["types"]
                     if isinstance(t, dict) and isinstance(t.get("id"), str)
                     and t["id"]]
            if types:
                entry["types"] = types
        # "sections" joins them: a keyed {id: {name, fold}} map, and the
        # per-slide s.sec tag that points into it is carried by the slide
        # builder above. The ORDER is never stored -- it is read back off
        # the slide list (2026-08-22).
        # "tokens" is the deck's design registry -- its accent colours,
        # corner radius and spacing gap. An item that references one
        # stores the string "@accent"; lose the registry here and the
        # item renders the built-in fallback instead, which is exactly
        # the quiet save-and-reopen failure this loop exists to stop
        # (2026-08-25).
        # "components" is the deck's own library of named, linked
        # groups. Losing it here would leave every instance in the deck
        # carrying a cmp id that points at nothing -- they would still
        # draw, and would silently stop being linked (2026-08-25).
        for key in ("wmark", "head", "foot", "styles", "sections",
                    "tokens", "components", "cuts"):
            if isinstance(p.get(key), dict):
                entry[key] = p[key]
        # embedded card snapshots — the deck's own copy of every placed
        # card, so a saved deck shows its figures with no notebook and no
        # network. Written by the editor at save time; only shape-checked
        # here (values are {title, kind, html[, code]} strings).
        if isinstance(p.get("emb"), dict):
            emb = {k: v for k, v in p["emb"].items()
                   if isinstance(k, str)
                   and isinstance(v, dict)
                   and isinstance(v.get("html"), str) and v["html"]}
            if emb:
                entry["emb"] = emb
        out.append(entry)
    return out


_DECK_BLOCK_RE = re.compile(
    r'<script type="application/json" id="junoview-data">(.*?)</script>',
    re.S)


def deck_json(text: str):
    """Parse a saved deck file in either form.

    Since 2026-08-18 the browser saves ``name.junoview.html`` -- a real
    HTML page (logo, name, how to open it) with the JSON in a
    ``<script type="application/json">`` block, so double-clicking the
    file opens a browser instead of Windows asking what a .junoview is.
    Bare-JSON files from before that still parse unchanged.
    """
    t = text.lstrip()
    if t.startswith("<"):
        m = _DECK_BLOCK_RE.search(t)
        if m is None:
            # ValueError, not SystemExit: this also runs inside the local
            # server, where SystemExit (a BaseException) sailed past every
            # `except Exception` and killed the request thread. The CLI
            # catches it and prints "error: ..." as before (2026-08-23).
            raise ValueError("no Junoview data block in that HTML file")
        t = m.group(1)
    return json.loads(t)


def embed_deck(nb_path: Path, deck_path: Path) -> None:
    """Write presentations JSON into metadata.semantic.presentations."""
    pres = as_presentations(
        deck_json(deck_path.read_text(encoding="utf-8")))
    if not pres:
        # ValueError for the same reason as deck_json above (2026-08-23)
        raise ValueError(f"{deck_path} does not look like saved "
                         "presentations (expected {'presentations': [...]})")
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    sem = nb.setdefault("metadata", {}).setdefault("semantic", {})
    sem["presentations"] = pres
    sem.pop("deck", None)
    write_text(nb_path, json.dumps(nb, indent=1, ensure_ascii=False) + "\n")
