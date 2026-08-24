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

from ..notebook.parser import parse_notebook


def _new_cell_id() -> str:
    return secrets.token_hex(4)


def insert_note_cell(nb: dict, after_anchor: str,
                     source: str) -> tuple[dict, int, str]:
    """Insert a markdown cell into notebook JSON right after the cell(s)
    that render the card `after_anchor` (append at the end when the anchor
    is empty or unknown). Pure — file IO stays with the caller.
    Returns (nb, insert_index, new_cell_id)."""
    cells = nb.setdefault("cells", [])
    idx = len(cells)                       # default: append at the end
    if after_anchor:
        # structural parse only — the caller re-parses via load_doc for
        # the fresh shell anyway, so don't render the raw view twice
        doc = parse_notebook(nb, render_raw=False)
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


def _versions_dir(f: Path) -> Path:
    return f.parent / ".junoview_versions" / f.stem


def _store_version(f: Path, cap: int = 25) -> None:
    """Automatic notebook snapshots: every open / reload keeps a copy
    (deduped by content, capped) so earlier runs stay reachable from the
    tab's Versions menu. Never allowed to block an open."""
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
        vers = sorted(d.glob("*.ipynb"))
        if vers and vers[-1].stem.rsplit("_", 1)[-1] == h:
            return                      # unchanged since the last snapshot
        stamp = time.strftime("%Y%m%d-%H%M%S")
        (d / f"{stamp}_{h}.ipynb").write_bytes(data)
        vers = sorted(d.glob("*.ipynb"))
        for old in vers[:-cap]:
            old.unlink()
    except Exception:
        pass
