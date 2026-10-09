"""Writing back into a notebook, carefully.

Adding a note inserts a real markdown cell after the card's own cells, so the
notebook stays the source of truth. Every write snapshots the previous version
first -- the app edits files people care about.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from pathlib import Path

from ..branding import icons
from ..notebook.model import Document
from ..notebook.parser import parse_notebook
from ..render.items import (
    payload_item,
    render_item,
    render_navitem,
    render_raw_md,
)


def _new_cell_id() -> str:
    return secrets.token_hex(4)


def insert_note_cell(nb: dict, after_anchor: str, source: str,
                     doc: Document | None = None) -> tuple[dict, int, str]:
    """Insert a markdown cell into notebook JSON right after the cell(s)
    that render the card `after_anchor` (append at the end when the anchor
    is empty or unknown). Pure — file IO stays with the caller.
    `doc` is the notebook as parsed already, when the caller has it.
    Returns (nb, insert_index, new_cell_id)."""
    cells = nb.setdefault("cells", [])
    idx = len(cells)                       # default: append at the end
    if after_anchor:
        # structural parse only — the caller re-parses via load_doc for
        # the fresh shell anyway, so don't render the raw view twice
        doc = doc or parse_notebook(nb, render_raw=False)
        target = None
        for sec in doc.sections:
            for it in sec.items:
                if (it.anchor or it.item_id) == after_anchor:
                    target = it
                    break
            if target:
                break
        if target is not None:
            if target.members:             # code card: after its LAST cell
                idx = max(m["idx"] for m in target.members) + 1
            elif target.anchor.startswith("cell:"):   # a markdown note
                cid = target.anchor[5:]
                for i, c in enumerate(cells):
                    if str(c.get("id") or "") == cid:
                        idx = i + 1
                        break
    new_id = _new_cell_id()
    cells.insert(idx, {"cell_type": "markdown", "id": new_id,
                       "metadata": {}, "source": source})
    return nb, idx, new_id


def _item_sig(sec_id: str, it) -> tuple:
    """Everything about a card that its rendering in the page shows --
    except a note's slug, which only numbers the notes in order."""
    return (sec_id, it.anchor or it.item_id, it.kind, it.is_note, it.title,
            it.caption, it.subsection, it.code_kind, tuple(it.code_kinds),
            it.labelled, it.node_id, tuple(it.depends), tuple(it.chain),
            None if it.is_note else it.item_id)


def note_in_place(old: Document, new: Document, cell_id: str, idx: int,
                  nb: dict) -> dict | None:
    """What the page needs to show a note just added WITHOUT re-mounting
    the notebook -- or None when anything else it shows would change.

    Adding a note re-rendered and re-mounted the whole notebook: on the
    116-cell one a 2.2 s freeze (critic #3) for one new markdown cell. The
    notebook as the page holds it is `old`; `new` is it re-parsed with the
    cell at `idx`. When the only difference is that one note -- the same
    sections, every other card the same in the same place, nothing in the
    outline that depends on it -- the page inserts the card, its outline
    row and its raw-view cell where they go. Anything else (a heading in
    the note opens a section, the first note in a notebook adds the
    outline key's markdown dot, a cell with no id anchored by position)
    answers None and the page re-mounts the full shell, as it always did.

    The page ends up named exactly as a fresh load of the file names it:
    notes are numbered in order (note, note-2, ...), so the new card takes
    the number `new` gives it and ``renames`` moves every note after it
    up one. A mark is kept against a card's id, so a page that kept its
    old numbers put the marks made on those notes onto their neighbours
    at the next page load, and lost the new note's own.
    """
    if old.title != new.title:
        return None
    if ([(s.section_id, s.title, s.level, s.number) for s in old.sections]
            != [(s.section_id, s.title, s.level, s.number)
                for s in new.sections]):
        return None
    anchor = f"cell:{cell_id}"
    placed = [(s, k, it) for s in new.sections
              for k, it in enumerate(s.items) if it.anchor == anchor]
    if len(placed) != 1:
        return None
    sec, k, item = placed[0]
    if not item.is_note:
        return None
    old_items = [(s.section_id, it) for s in old.sections for it in s.items]
    if not any(it.is_note for _, it in old_items):
        return None
    rest = [_item_sig(s.section_id, it) for s in new.sections
            for it in s.items if it is not item]
    if rest != [_item_sig(sid, it) for sid, it in old_items]:
        return None
    prev = sec.items[k - 1] if k else None
    # the outline groups a section's rows under their #### kicker: the
    # note has to sit in the run it is shown in
    if item.subsection != (prev.subsection if prev else ""):
        return None
    # `rest` matched card for card, so the notes pair up in order
    old_notes = [it.item_id for _, it in old_items if it.is_note]
    new_notes = [it.item_id for s in new.sections for it in s.items
                 if it.is_note and it is not item]
    renames = [[a, b] for a, b in zip(old_notes, new_notes, strict=True)
               if a != b]
    cells = nb.get("cells", [])
    md_src = cells[idx].get("source", "") if idx < len(cells) else ""
    if isinstance(md_src, list):
        md_src = "".join(md_src)
    # the raw view renders the markdown and code cells, in order
    rawpos = sum(1 for c in cells[:idx]
                 if c.get("cell_type") in ("markdown", "code"))
    rawcount = sum(1 for c in cells
                   if c.get("cell_type") in ("markdown", "code"))
    return {
        "section": sec.section_id,
        "after": (prev.anchor or prev.item_id) if prev else "",
        "index": idx,
        "card": icons(render_item(item, sec.section_id)),
        "nav": icons(render_navitem(item)),
        "item": payload_item(sec, item),
        "raw": icons(render_raw_md(str(md_src))),
        "rawpos": rawpos,
        "rawcount": rawcount,
        "renames": renames,
    }


def _versions_dir(f: Path) -> Path:
    return f.parent / ".junoview_versions" / f.stem


def _store_version(f: Path, cap: int = 25) -> None:
    """Automatic source snapshots: every open / reload keeps a copy
    (deduped by content, capped) so earlier runs stay reachable from the
    tab's Versions menu. Never allowed to block an open.

    Keyed on the file's own suffix rather than ``.ipynb`` (T100), so a
    .tex or a .csv keeps the history a notebook keeps. Two sources
    sharing a stem share a directory and stay separate, because each
    lists only its own suffix.
    """
    try:
        data = f.read_bytes()
        h = hashlib.sha1(data).hexdigest()[:10]
        d = _versions_dir(f)
        d.mkdir(parents=True, exist_ok=True)
        # a self-ignoring snapshot store: our own bookkeeping must never
        # show up as untracked noise in the user's `git status`
        gi = d.parent / ".gitignore"
        if not gi.exists():
            gi.write_text("*\n", encoding="utf-8")
        suffix = f.suffix.lower() or ".ipynb"
        vers = sorted(d.glob("*" + suffix))
        if vers and vers[-1].stem.rsplit("_", 1)[-1] == h:
            return                      # unchanged since the last snapshot
        stamp = time.strftime("%Y%m%d-%H%M%S")
        (d / f"{stamp}_{h}{suffix}").write_bytes(data)
        vers = sorted(d.glob("*" + suffix))
        for old in vers[:-cap]:
            old.unlink()
    except Exception:
        pass
