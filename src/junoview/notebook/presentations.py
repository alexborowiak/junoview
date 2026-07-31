"""Reading saved presentation decks off a notebook.

A deck is a list of slides, each naming cards by stable anchor. Decks travel in
``metadata.semantic.presentations``, in a ``<notebook>.deck.json`` sidecar, or
in the app's project file. This module normalises all three into one shape and
tolerates older layouts, so a deck saved months ago still opens.
"""

from __future__ import annotations

from typing import Any

_LAYOUT_PANES = {"full": 1, "halves": 2, "rows": 2, "quarters": 4,
                 "title": 0, "blank": 0}


def _as_presentations(obj: Any) -> list:
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
        out.append(entry)
    return out
