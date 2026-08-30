"""What the local app knows: open notebooks, the project file, the file browser.

One :class:`_AppState` per running app. Presentations and recent files persist
to a project JSON next to where the app was started, so a session survives a
restart.
"""

from __future__ import annotations

import json
import secrets
import sys
import threading
from pathlib import Path

from .._write import write_text
from ..notebook.loader import doc_from_url, is_url, load_doc, stem_for
from ..notebook.parser import parse_notebook
from ..notebook.presentations import as_presentations
from ..notebook.sources import source_label
from ..render.page import render_page

_PROJECT_FILE = "junoview_project.json"


class StaleWrite(Exception):
    """A save carried a revision older than the one held here.

    Carries the current revision and presentations so the caller can
    hand them straight back for the client to merge against.
    """

    def __init__(self, revision: int, presentations: list):
        super().__init__(f"stale write; current revision {revision}")
        self.revision = revision
        self.presentations = presentations


class _AppState:
    """Project file + open-tab session, shared across requests."""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.token = secrets.token_hex(8)
        self.lock = threading.Lock()
        self.presentations: list = []
        # bumped on every accepted write; a client sends back the one it
        # last saw so a stale whole-array save can be refused rather than
        # silently clobbering another window's work
        self.revision: int = 0
        self.open: list[str] = []
        self.recent: list[str] = []
        self._load()

    @property
    def project_path(self) -> Path:
        return self.root / _PROJECT_FILE

    def _load(self) -> None:
        path = self.project_path
        if not path.exists():
            # load older project files if present (migrate to the new name on
            # the next save): the former plotline_ name, then the original
            for legacy_name in ("plotline_project.json", "semantic_project.json"):
                legacy = self.root / legacy_name
                if legacy.exists():
                    path = legacy
                    break
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        if not isinstance(d, dict):
            return
        self.presentations = as_presentations(d.get("presentations"))
        for name in ("open", "recent"):
            v = d.get(name)
            setattr(self, name,
                    [str(x) for x in v if isinstance(x, str)]
                    if isinstance(v, list) else [])

    def _write(self) -> None:
        write_text(
            self.project_path,
            json.dumps({"presentations": self.presentations,
                        "open": self.open, "recent": self.recent},
                       indent=1, ensure_ascii=False) + "\n")

    def note_open(self, path: Path | str) -> None:
        with self.lock:
            s = str(path)
            if s not in self.open:
                self.open.append(s)
            self.recent = ([s] + [r for r in self.recent if r != s])[:10]
            self._write()

    def note_close(self, path: str) -> None:
        with self.lock:
            self.open = [p for p in self.open if p != path]
            self._write()

    def save_presentations(self, pres: list, rev: int | None = None) -> int:
        """Replace the saved presentations. Returns the new revision.

        ``rev`` is the revision the caller last saw. If it does not match,
        this raises :class:`StaleWrite` rather than writing.

        Why: this used to be ``self.presentations = pres`` -- a whole-array
        replace with no version at all. Every tab autosaves its ENTIRE view
        of every presentation 1.2s after each keystroke, so a second window
        left open on the same project continuously overwrote the first: a
        deck created or renamed in tab A vanished the moment tab B typed a
        character, and a delete in one tab was resurrected by the other
        depending on typing order. ``self.lock`` guarded the file write but
        never the lost update (2026-08-22).
        """
        with self.lock:
            if rev is not None and rev != self.revision:
                raise StaleWrite(self.revision, self.presentations)
            self.presentations = pres
            self.revision += 1
            self._write()
            return self.revision

    def stems_taken(self, skip: Path | None = None,
                    skip_str: str | None = None) -> set[str]:
        """Deduped stems of the open tabs (mirrors the page-build order)."""
        taken: set[str] = set()
        for p in self.open:
            if skip is not None and not is_url(p) and Path(p) == skip:
                continue
            if skip_str is not None and p == skip_str:
                continue
            taken.add(stem_for(Path(p), taken))
        return taken


def _is_deck_file(name: str) -> bool:
    """A saved presentation on disk: name.junoview.html (the polyglot HTML
    save) or a bare-JSON .junoview from before the wrapper existed."""
    low = name.lower()
    return low.endswith(".junoview") or low.endswith(".junoview.html")


def _list_dir(raw: str) -> dict:
    d = Path(raw).expanduser()
    if not d.is_dir():
        raise FileNotFoundError(f"{d} is not a folder")
    d = d.resolve()
    dirs, nbs, decks, srcs = [], [], [], []
    try:
        entries = sorted(d.iterdir(), key=lambda p: p.name.lower())
    except OSError:
        entries = []
    for p in entries:
        name = p.name
        if name.startswith(".") or name == "__pycache__":
            continue
        try:
            if p.is_dir():
                dirs.append({"name": name, "path": str(p)})
            elif p.suffix.lower() == ".ipynb":
                kb = max(1, p.stat().st_size // 1024)
                nbs.append({"name": name, "path": str(p), "size": f"{kb} KB"})
            elif _is_deck_file(name):
                # saved presentations open from the same dialog — on disk
                # they carry the default browser's icon and no way back in
                # (2026-08-20, user: "you can't click on them and open
                # them, it just shows the firefox symbol")
                kb = max(1, p.stat().st_size // 1024)
                decks.append({"name": name, "path": str(p),
                              "size": f"{kb} KB"})
            elif source_label(name):
                # every OTHER source the producer table knows: Markdown,
                # Quarto, LaTeX, csv/tsv. They parsed from the CLI and
                # from the web build since T91 and were invisible here,
                # which made the same file openable or not depending on
                # which door you came through (T100). The label comes
                # from SOURCES rather than a second list in this file.
                kb = max(1, p.stat().st_size // 1024)
                srcs.append({"name": name, "path": str(p),
                             "size": f"{kb} KB",
                             "kind": source_label(name)})
        except OSError:
            continue
    parent = str(d.parent) if d.parent != d else ""
    return {"dir": str(d), "parent": parent, "dirs": dirs,
            "notebooks": nbs, "decks": decks, "sources": srcs}


def _app_page(state: _AppState) -> str:
    """Rebuild the whole app page from the session's open notebooks."""
    docs, paths, pruned = [], {}, []
    taken: set[str] = set()
    for p in list(state.open):
        if is_url(p):
            try:
                doc = doc_from_url(p)
            except Exception:       # noqa: BLE001 -- likely transient
                continue            # keep the URL in the session
            doc.source_name = stem_for(
                Path(doc.source_name + ".ipynb"), taken)
            taken.add(doc.source_name)
            paths[doc.source_name] = p
            docs.append(doc)
            continue
        f = Path(p)
        try:
            doc = load_doc(f)
        except (OSError, ValueError):
            # A corrupt DECK SIDECAR lands here too (JSONDecodeError is a
            # ValueError), and it used to be treated exactly like a deleted
            # notebook: the healthy tab was pruned and the project file
            # rewritten without it. Retry on just the .ipynb — if the
            # notebook itself parses, keep the tab and open it deckless;
            # prune only when the notebook is really gone/bad (2026-08-23).
            try:
                doc = parse_notebook(json.loads(
                    f.read_text(encoding="utf-8")))
                doc.source_name = f.stem
            except (OSError, ValueError):
                pruned.append(p)
                continue
            print(f"warning: could not read the deck sidecar for {f.name};"
                  " opened without its presentations", file=sys.stderr)
        doc.source_name = stem_for(f, taken)
        taken.add(doc.source_name)
        paths[doc.source_name] = str(f)
        docs.append(doc)
    if pruned:                      # notebooks meanwhile deleted / moved
        with state.lock:
            state.open = [p for p in state.open if p not in pruned]
            state._write()
    return render_page(docs, mode="app", app_cfg={
        "token": state.token,
        "root": str(state.root),
        "presentations": state.presentations,
        # the client echoes this back on every save so a second
        # window's stale whole-array write is refused, not applied
        "rev": state.revision,
        "recent": state.recent,
        "paths": paths,
    })
