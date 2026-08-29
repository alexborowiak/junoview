"""Editing a deck from Python.

``deck.slides[7].figures["toe_map"].place(x=8, w=60)`` — the deck you
built in the browser, opened, changed and written back so the editor
picks it up without noticing anybody else was here.

THE ONE DECISION EVERYTHING ELSE FOLLOWS FROM: **this is a view over the
JSON, never a parallel model of it.** Every object below holds a
reference to the very dict that was loaded and mutates it in place.
Nothing is rebuilt on save.

That matters more than it sounds. The obvious design — dataclasses with
a field per key — silently destroys every key it has not heard of, and
the browser is always ahead of this file: ``sid`` arrived with rehearsal
timing, ``trans`` with transitions, ``priv`` with private annotations,
and each of them would have been quietly deleted by the first Python
round-trip made before somebody remembered to add a field here. There is
already a test in this repo whose whole job is catching that class of
loss (``test_deck_schema_parity``), which is how often it has happened.
A view cannot lose a key it does not know about, because it never
touches one.

The three other rules:

* **It reads what a file happens to hold.** A list of decks, a
  ``{"presentations": [...]}``, a bare single deck, an ``.ipynb`` with
  the deck in ``metadata.semantic``, or the ``.junoview.html`` the
  browser writes — the same shapes :mod:`~junoview.notebook.loader` and
  ``as_presentations`` already accept, because having to know which one
  you have before you can open it defeats the purpose.

* **Saving reports; it does not coerce.** ``save()`` runs
  :func:`~junoview.notebook.deck_schema.validate_deck` and hands back
  what it found. That is T33's split kept: ``as_presentations``
  coerces and never complains, ``validate_deck`` complains and never
  changes anything, and this writes and tells you. ``strict=True`` for
  a script that would rather stop.

* **Geometry is percent of the page**, exactly as it is everywhere else
  here — ``x`` and ``w`` of the width, ``y`` and ``h`` of the height, a
  text size of the height. A deck holds no pixels, which is why the same
  deck is a 16:9 talk and an A0 poster.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from .deck_schema import Problem, validate_deck

__all__ = ["Deck", "Slide", "Item", "open_deck"]

_HTML_BLOCK_RE = re.compile(
    r'(<script type="application/json" id="junoview-data">)(.*?)(</script>)',
    re.S)


# --------------------------------------------------------------------------
# one thing on a slide
# --------------------------------------------------------------------------

class Item:
    """One annotation — a text box, a figure frame, a shape, an arrow.

    Wraps the live dict. ``item.raw`` is that dict, and writing to it is
    a supported thing to do: this class is a convenience over the
    format, not a gate in front of it.
    """

    __slots__ = ("raw",)

    def __init__(self, raw: dict) -> None:
        self.raw = raw

    # -- what it is --------------------------------------------------
    @property
    def kind(self) -> str:
        """``text``, ``cell``, ``rect``, ``image``, ``arrow``, ``draw``,
        ``table`` or ``flip``."""
        return str(self.raw.get("k") or "")

    @property
    def ref(self) -> str:
        """For a figure frame, the card it shows, by stable anchor."""
        return str(self.raw.get("ref") or "")

    @property
    def name(self) -> str:
        """The short name a figure is known by — the anchor's last
        segment, since refs are namespaced ``notebook::anchor``."""
        r = self.ref
        return r.rsplit("::", 1)[-1] if r else ""

    @property
    def text(self) -> str:
        return str(self.raw.get("text") or "")

    @text.setter
    def text(self, v: str) -> None:
        self.raw["text"] = str(v)

    @property
    def is_figure(self) -> bool:
        return self.kind in ("cell", "image", "flip")

    # -- where it is -------------------------------------------------
    @property
    def box(self) -> tuple[float, float, float | None, float | None]:
        """``(x, y, w, h)`` in percent. ``w``/``h`` are ``None`` when the
        item has none — a text box auto-heights from its words, so an
        invented number would be a lie about the format."""
        g = self.raw
        return (float(g.get("x") or 0), float(g.get("y") or 0),
                None if g.get("w") is None else float(g["w"]),
                None if g.get("h") is None else float(g["h"]))

    def place(self, x: float | None = None, y: float | None = None,
              w: float | None = None, h: float | None = None) -> Item:
        """Set any of x/y/w/h, in percent. Returns self, so calls chain."""
        for key, val in (("x", x), ("y", y), ("w", w), ("h", h)):
            if val is not None:
                self.raw[key] = float(val)
        return self

    def move(self, dx: float = 0.0, dy: float = 0.0) -> Item:
        """Shift by a percentage of the page. An arrow moves by both its
        endpoints, because an arrow is not a box — the same special case
        the editor makes everywhere it walks the geometry."""
        if self.kind == "arrow":
            for a, b in (("x1", dx), ("x2", dx), ("y1", dy), ("y2", dy)):
                if a in self.raw:
                    self.raw[a] = float(self.raw[a]) + b
            return self
        self.raw["x"] = float(self.raw.get("x") or 0) + dx
        self.raw["y"] = float(self.raw.get("y") or 0) + dy
        return self

    def update(self, **kw: Any) -> Item:
        """Set any keys at all, including ones this module has never
        heard of. ``None`` removes a key rather than storing a null,
        because the format's own rule is that absent means default."""
        for k, v in kw.items():
            if v is None:
                self.raw.pop(k, None)
            else:
                self.raw[k] = v
        return self

    def __repr__(self) -> str:
        bits = [self.kind or "?"]
        if self.name:
            bits.append(repr(self.name))
        elif self.text:
            t = self.text.replace("\n", " ")
            bits.append(repr(t[:24] + ("…" if len(t) > 24 else "")))
        x, y, _w, _h = self.box
        bits.append(f"at {x:.0f},{y:.0f}%")
        return f"<Item {' '.join(bits)}>"


class _ByName:
    """The figures on one slide, by name — and still a sequence.

    Named lookup is what you want (``figures["toe_map"]``) until two
    frames show the same card, which is a thing people really do, so
    iteration and indexing keep working and ``all_named`` gives every
    match instead of the first.
    """

    __slots__ = ("_items",)

    def __init__(self, items: list[Item]) -> None:
        self._items = items

    def __getitem__(self, key: Any) -> Item:
        if isinstance(key, int):
            return self._items[key]
        for it in self._items:
            if it.name == key or it.ref == key:
                return it
        raise KeyError(key)

    def __iter__(self) -> Iterator[Item]:
        return iter(self._items)

    def __len__(self) -> int:
        return len(self._items)

    def __contains__(self, key: Any) -> bool:
        try:
            self[key]
            return True
        except (KeyError, IndexError):
            return False

    def all_named(self, key: str) -> list[Item]:
        """Every figure with this name, not just the first."""
        return [i for i in self._items if i.name == key or i.ref == key]

    def names(self) -> list[str]:
        return [i.name for i in self._items if i.name]

    def __repr__(self) -> str:
        return f"<figures {self.names() or len(self._items)}>"


# --------------------------------------------------------------------------
# one slide
# --------------------------------------------------------------------------

class Slide:
    """One slide. ``slide.raw`` is the live dict."""

    __slots__ = ("raw",)

    def __init__(self, raw: dict) -> None:
        self.raw = raw

    @property
    def items(self) -> list[Item]:
        """Everything placed on the slide, in stored order."""
        return [Item(a) for a in self.raw.get("annots") or []
                if isinstance(a, dict)]

    @property
    def figures(self) -> _ByName:
        """The figure frames, by the name of the card each one shows."""
        return _ByName([i for i in self.items if i.is_figure])

    @property
    def texts(self) -> list[Item]:
        return [i for i in self.items if i.kind == "text"]

    @property
    def layout(self) -> str:
        return str(self.raw.get("layout") or "blank")

    @property
    def title(self) -> str:
        """A title slide's headline. Other layouts are named by what is
        on them, so this is empty for them rather than invented."""
        return str(self.raw.get("title") or "")

    @title.setter
    def title(self, v: str) -> None:
        self.raw["title"] = str(v)

    @property
    def notes(self) -> str:
        """Speaker notes — markdown, and yours."""
        return str(self.raw.get("notes") or "")

    @notes.setter
    def notes(self, v: str) -> None:
        if str(v).strip():
            self.raw["notes"] = str(v)
        else:
            self.raw.pop("notes", None)

    @property
    def goal(self) -> float:
        """Minutes you mean to spend here; 0 when none is set."""
        g = self.raw.get("goal")
        return float(g) if isinstance(g, (int, float)) and g > 0 else 0.0

    @goal.setter
    def goal(self, v: float) -> None:
        if v and float(v) > 0:
            self.raw["goal"] = float(v)
        else:
            self.raw.pop("goal", None)

    @property
    def section(self) -> str:
        """The id of the section this slide is in, or ``""``."""
        return str(self.raw.get("sec") or "")

    @property
    def optional(self) -> bool:
        """True when "Running late" would skip it."""
        return bool(self.raw.get("opt"))

    @optional.setter
    def optional(self, v: bool) -> None:
        if v:
            self.raw["opt"] = 1
        else:
            self.raw.pop("opt", None)

    def update(self, **kw: Any) -> Slide:
        """Set any slide keys; ``None`` removes one."""
        for k, v in kw.items():
            if v is None:
                self.raw.pop(k, None)
            else:
                self.raw[k] = v
        return self

    def add(self, kind: str, **kw: Any) -> Item:
        """Put a new item on the slide and hand it back.

        Deliberately thin: it writes ``k`` and whatever else you pass,
        and does not invent defaults. The editor defaults every optional
        field at draw time — inventing a second set here is how two
        renderers start disagreeing about what a bare rectangle looks
        like.
        """
        raw: dict[str, Any] = {"k": str(kind)}
        raw.update({k: v for k, v in kw.items() if v is not None})
        self.raw.setdefault("annots", []).append(raw)
        return Item(raw)

    def remove(self, item: Item) -> bool:
        """Take an item off the slide. Identity, not equality: two
        identical shapes are two shapes."""
        ann = self.raw.get("annots")
        if not isinstance(ann, list):
            return False
        for i, a in enumerate(ann):
            if a is item.raw:
                del ann[i]
                return True
        return False

    def __repr__(self) -> str:
        n = len(self.raw.get("annots") or [])
        name = self.title or self.raw.get("label") or self.layout
        return f"<Slide {name!r} {n} item{'' if n == 1 else 's'}>"


# --------------------------------------------------------------------------
# the deck
# --------------------------------------------------------------------------

class Deck:
    """One deck, and where it came from.

    ``Deck.open(path)`` for a file, ``Deck(obj)`` for JSON you already
    have. ``deck.raw`` is the live deck dict; ``deck.document`` is the
    whole file's data, which is not the same thing when the file holds
    several decks or is a notebook.
    """

    __slots__ = ("raw", "document", "path", "_kind", "_index", "_source")

    def __init__(self, raw: dict, *, document: Any = None,
                 path: Path | None = None, kind: str = "deck",
                 index: int = 0, source: str = "") -> None:
        self.raw = raw
        self.document = raw if document is None else document
        self.path = path
        self._kind = kind          # deck | presentations | list | notebook
        self._index = index
        self._source = source      # the original file text, for .html

    # -- opening ------------------------------------------------------
    @classmethod
    def open(cls, path: str | Path, name: str | None = None) -> Deck:
        """Open a deck from a file.

        Understands the ``.junoview.html`` the browser downloads, a bare
        ``.junoview``/``.deck.json``, and an ``.ipynb`` carrying its deck
        in ``metadata.semantic.presentations``. ``name`` picks one when
        the file holds several; without it you get the first, which is
        what a one-deck file means.
        """
        p = Path(path)
        text = p.read_text(encoding="utf-8")
        if p.suffix.lower() == ".ipynb":
            nb = json.loads(text)
            decks = (((nb.get("metadata") or {}).get("semantic") or {})
                     .get("presentations"))
            if not isinstance(decks, list) or not decks:
                raise ValueError(f"{p} carries no deck in "
                                 "metadata.semantic.presentations")
            i = _pick(decks, name)
            return cls(decks[i], document=nb, path=p, kind="notebook",
                       index=i, source=text)
        obj, src = _parse_deck_text(text)
        return cls._from_obj(obj, path=p, name=name, source=src)

    @classmethod
    def from_json(cls, obj: Any, name: str | None = None) -> Deck:
        """Wrap data you already have, in any of the shapes a file holds."""
        return cls._from_obj(obj, path=None, name=name, source="")

    @classmethod
    def _from_obj(cls, obj: Any, *, path: Path | None,
                  name: str | None, source: str) -> Deck:
        if isinstance(obj, dict) and isinstance(obj.get("presentations"),
                                                list):
            decks = obj["presentations"]
            i = _pick(decks, name)
            return cls(decks[i], document=obj, path=path,
                       kind="presentations", index=i, source=source)
        if isinstance(obj, list):
            i = _pick(obj, name)
            return cls(obj[i], document=obj, path=path, kind="list",
                       index=i, source=source)
        if isinstance(obj, dict):
            return cls(obj, document=obj, path=path, kind="deck",
                       source=source)
        raise ValueError("a deck file is an object or a list of them, "
                         f"not {type(obj).__name__}")

    # -- the deck -----------------------------------------------------
    @property
    def name(self) -> str:
        return str(self.raw.get("name") or "")

    @name.setter
    def name(self, v: str) -> None:
        self.raw["name"] = str(v)

    @property
    def slides(self) -> list[Slide]:
        """Live slide handles, in order.

        Editing a handle changes the stored slide. Change the list itself
        through :meth:`add_slide`, :meth:`move_slide` and
        :meth:`remove_slide`; this returned list is only the current view.
        """
        return [Slide(s) for s in self.raw.get("slides") or []
                if isinstance(s, dict)]

    @property
    def sections(self) -> dict:
        """``{id: {name, ...}}`` — only the names live here; which slides
        are in a section is stored on the slides."""
        sec = self.raw.get("sections")
        return sec if isinstance(sec, dict) else {}

    @property
    def notes(self) -> str:
        """Notes about the whole talk."""
        return str(self.raw.get("notes") or "")

    @notes.setter
    def notes(self, v: str) -> None:
        if str(v).strip():
            self.raw["notes"] = str(v)
        else:
            self.raw.pop("notes", None)

    def slide(self, n: int) -> Slide:
        """Slide *n*, counting from 1 — the number on the screen, not the
        index, because that is the one you were just looking at."""
        return self.slides[n - 1]

    def find(self, word: str) -> list[tuple[int, Slide]]:
        """Every slide whose text, table cells, captions or notes say
        this, as ``(number, slide)`` pairs — the same question the
        editor's own search answers, asked from a script.
        """
        w = str(word).lower()
        out = []
        for i, sl in enumerate(self.slides, 1):
            if w in _slide_words(sl.raw).lower():
                out.append((i, sl))
        return out

    def add_slide(self, layout: str = "blank", at: int | None = None,
                  **kw: Any) -> Slide:
        """Add a slide and hand it back. ``at`` is a 1-based position;
        without it the slide goes at the end."""
        raw: dict[str, Any] = {"layout": str(layout), "annots": []}
        raw.update({k: v for k, v in kw.items() if v is not None})
        slides = self.raw.setdefault("slides", [])
        if at is None:
            slides.append(raw)
        else:
            slides.insert(max(0, min(int(at) - 1, len(slides))), raw)
        return Slide(raw)

    def move_slide(self, frm: int, to: int) -> None:
        """Move a slide, both positions 1-based."""
        slides = self.raw.get("slides")
        if not isinstance(slides, list) or not slides:
            return
        i = max(0, min(int(frm) - 1, len(slides) - 1))
        j = max(0, min(int(to) - 1, len(slides) - 1))
        slides.insert(j, slides.pop(i))

    def remove_slide(self, n: int) -> bool:
        """Remove slide *n*, counting from 1.

        Positions outside the deck clamp to its first or last slide, as the
        other structural verbs do. Returns ``False`` when there is no stored
        slide to remove.
        """
        slides = self.raw.get("slides")
        if not isinstance(slides, list) or not slides:
            return False
        i = max(0, min(int(n) - 1, len(slides) - 1))
        del slides[i]
        return True

    # -- checking and writing -----------------------------------------
    def problems(self) -> list[Problem]:
        """What :func:`validate_deck` says about this deck right now."""
        return validate_deck(self.raw)

    def to_json(self, indent: int | None = 1) -> str:
        """The whole DOCUMENT as text — not just this deck — because a
        file that held three decks has to still hold three."""
        return json.dumps(self.document, indent=indent,
                          ensure_ascii=False) + "\n"

    def save(self, path: str | Path | None = None, *,
             strict: bool = False) -> list[Problem]:
        """Write it back, and report what validation found.

        Reports rather than raising, which is T33's split kept: a deck
        with a warning in it is still a deck, and a script that would
        rather stop passes ``strict=True``. The target suffix chooses the
        writer: an ``.ipynb`` target needs a notebook-backed deck; an
        ``.html`` target keeps an existing Junoview wrapper; every other
        explicit suffix writes JSON. A suffixless target preserves the
        source form.
        """
        target = Path(path) if path is not None else self.path
        if target is None:
            raise ValueError("no path: Deck.from_json needs save(path)")
        found = self.problems()
        if strict and any(p.level == "error" for p in found):
            raise ValueError("; ".join(f"{p.path}: {p.message}"
                                       for p in found
                                       if p.level == "error"))
        suffix = target.suffix.lower()
        html_source = (self._source.lstrip().startswith("<")
                       and _HTML_BLOCK_RE.search(self._source) is not None)
        if suffix == ".ipynb":
            if self._kind != "notebook":
                raise ValueError("an .ipynb target needs a deck opened from "
                                 "a notebook; choose a JSON target instead")
            text = json.dumps(self.document, indent=1,
                              ensure_ascii=False) + "\n"
        elif suffix in (".html", ".htm"):
            if not html_source:
                raise ValueError("an HTML target needs a deck opened from an "
                                 "existing .junoview.html wrapper; choose a "
                                 "JSON target instead")
            # KEEP THE WRAPPER. It is a real page with a name, an icon and
            # instructions for opening it; rebuilding it here would mean a
            # second copy of that markup, drifting from deck.js's.
            text = _html_with_document(self._source, self.document)
        elif suffix:
            text = self.to_json()
        elif self._kind == "notebook":
            text = json.dumps(self.document, indent=1,
                              ensure_ascii=False) + "\n"
        elif html_source:
            text = _html_with_document(self._source, self.document)
        else:
            text = self.to_json()
        target.write_text(text, encoding="utf-8", newline="\n")
        return found

    def __repr__(self) -> str:
        n = len(self.raw.get("slides") or [])
        return (f"<Deck {self.name!r} {n} slide{'' if n == 1 else 's'}"
                + (f" from {self.path.name}" if self.path else "") + ">")


def open_deck(path: str | Path, name: str | None = None) -> Deck:
    """``Deck.open`` under a function name, for ``from ... import``."""
    return Deck.open(path, name)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _html_with_document(source: str, document: Any) -> str:
    """Replace one browser-export wrapper's JSON block, byte-for-byte
    everywhere else."""
    body = json.dumps(document, ensure_ascii=False)
    return _HTML_BLOCK_RE.sub(
        lambda m: m.group(1) + "\n" + body.replace("<", "\\u003c")
        + "\n" + m.group(3), source, count=1)


def _pick(decks: list, name: str | None) -> int:
    if not decks:
        raise ValueError("that file holds no decks")
    if name is None:
        return 0
    for i, d in enumerate(decks):
        if isinstance(d, dict) and d.get("name") == name:
            return i
    have = [d.get("name") for d in decks if isinstance(d, dict)]
    raise KeyError(f"no deck called {name!r}; this file has {have}")


def _parse_deck_text(text: str) -> tuple[Any, str]:
    """The two file forms, the same way ``loader.deck_json`` reads them.

    Duplicated rather than imported on purpose: loader pulls in the whole
    renderer, and a script that only wants to move a figure should not
    have to load an HTML renderer to do it.
    """
    t = text.lstrip()
    if t.startswith("<"):
        m = _HTML_BLOCK_RE.search(t)
        if m is None:
            raise ValueError("no Junoview data block in that HTML file")
        return json.loads(m.group(2)), text
    return json.loads(t), text


def _slide_words(s: dict) -> str:
    parts: list[str] = []
    for key in ("label", "title", "sub", "notes"):
        v = s.get(key)
        if isinstance(v, str) and v:
            parts.append(v)
    for a in s.get("annots") or []:
        if not isinstance(a, dict):
            continue
        for key in ("text", "cap"):
            v = a.get(key)
            if isinstance(v, str) and v:
                parts.append(v)
        rows = a.get("rows")
        if isinstance(rows, list):
            for r in rows:
                for c in r if isinstance(r, list) else []:
                    if isinstance(c, str) and c:
                        parts.append(c)
                    elif isinstance(c, dict) and isinstance(c.get("t"), str):
                        parts.append(c["t"])
    return " · ".join(parts)
