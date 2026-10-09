"""What the local app knows: open notebooks, the project file, the file browser.

One :class:`_AppState` per running app. Presentations and recent files persist
to a project JSON next to where the app was started, so a session survives a
restart.
"""

from __future__ import annotations

import json
import os
import secrets
import threading
from pathlib import Path

from .._write import write_text
from ..notebook.loader import is_url, stem_for, url_stem
from ..notebook.pptx_read import is_pptx_name
from ..notebook.presentations import as_presentations
from ..notebook.sources import source_label
from ..render.page import app_data_json, encode_pieces, page_pieces, page_title
from .shells import DOWNLOADS, Shell, local_shell, local_source, url_shell

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
        # T600: the files this run wrote as exports -- the only ones
        # /api/reveal will open or show, so it cannot launch anything else
        self.exported: set[str] = set()
        # (name, position) -> (the deck dict, its encoded text): see _write
        self._deck_text: dict = {}
        # (key, bytes) of the last boot JSON a page was built with
        self.boot_json: tuple[tuple, bytes] | None = None
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
        """Write the project file -- the same bytes as one ``json.dumps``
        of the whole thing, without re-encoding every deck every time.

        SPEED (2026-10-09): every save, every notebook Open and every
        Close rewrote the whole file, figures and all, through the
        pure-Python indent encoder: 335 ms for 30 decks to record one
        path in ``open``. Each deck's text is kept beside the dict it was
        encoded from and reused while the deck is unchanged -- the same
        object, or ``==`` to it, which is C-speed and short-circuits on
        the ``emb`` blocks ``_keep_embedded`` carries forward by
        reference. So a save encodes the deck that changed, and Open and
        Close encode none. Held decks are never mutated in place (every
        write replaces the list), which is what makes the reuse sound;
        ``test_the_project_file_is_byte_identical`` pins the bytes.
        """
        cache = self._deck_text
        fresh: dict = {}
        parts = []
        for i, p in enumerate(self.presentations):
            key = (p.get("name") if isinstance(p, dict) else None, i)
            hit = cache.get(key)
            if hit is not None and hit[0] == p:
                txt = hit[1]
            else:
                # one level in from the list, two from the outer object
                txt = "  " + json.dumps(
                    p, indent=1, ensure_ascii=False).replace("\n", "\n  ")
            fresh[key] = (p, txt)
            parts.append(txt)
        self._deck_text = fresh
        head = ('{\n "presentations": [\n' + ",\n".join(parts) + "\n ],\n"
                if parts else '{\n "presentations": [],\n')
        tail = json.dumps({"open": self.open, "recent": self.recent},
                          indent=1, ensure_ascii=False)
        write_text(self.project_path, head + tail[2:] + "\n")

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
            merged = _keep_embedded(self.presentations, pres)
            # A WRITE THAT CHANGES NOTHING IS NOT A WRITE (2026-10-09).
            # A caret left in a text box used to autosave every 15 s for
            # as long as it sat there, each one rewriting the whole file
            # to a synced folder. Equality is exact, so nothing a real
            # edit carries can be skipped; the revision stays put because
            # nothing happened that another window has to merge.
            if merged == self.presentations:
                return self.revision
            self.presentations = merged
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


def _keep_embedded(old: list, new: list) -> list:
    """Carry each deck's ``emb`` block forward when the write omits it.

    The editor autosaves the LEAN form -- refs, no figures -- 1.2s after
    every keystroke, and only rewrites the self-contained form on a
    deliberate Save or after 20 idle seconds. Because this method
    replaces the whole array, that lean write DELETED every ``emb``
    block from junoview_project.json and left it refs-only for most of
    an editing session. Close the tab in that window, or sync the file
    to another machine, and the figures existed only in one browser
    profile's IndexedDB (2026-09-05, user: "I have lost too many
    things").

    Omission is not deletion, so absence carries forward and an explicit
    ``emb`` -- including an empty one, which is what a deck with no
    placed figures sends -- replaces it.

    Matched on the deck's NAME, because a name is the only identity a
    saved presentation has (``as_presentations`` writes no id). Renaming
    a deck therefore drops the carry-forward for one write, which is the
    behaviour this function replaces rather than a new failure: the
    rename is a deliberate Save, and a deliberate Save sends the
    self-contained form anyway.
    """
    def key(p):
        return p.get("name") if isinstance(p, dict) else None

    # T321: the clips (`media`) ride the same rule. A lean autosave omits
    # them for the same reason it omits `emb`, and losing a video because
    # you typed a word is the same failure one key over.
    held: dict = {}
    for p in old or []:
        k = key(p)
        if not k:
            continue
        for f in ("emb", "media"):
            if isinstance(p.get(f), dict) and p[f]:
                held.setdefault(k, {})[f] = p[f]
    if not held:
        return new
    out = []
    for p in new or []:
        k = key(p)
        if isinstance(p, dict) and k in held:
            add = {f: v for f, v in held[k].items() if f not in p}
            # AN EXPLICIT BLOCK THAT IS MISSING A COPY THE DECK STILL
            # SHOWS IS A GAP, NOT A DELETION (2026-10-09). The page now
            # boots without the snapshots and fetches them after, so a
            # self-contained write made before they arrived -- or by a
            # window whose fetch failed -- would carry only the figures
            # it could capture and replace the rest with nothing. Only a
            # copy of a ref (or clip) the incoming deck still PLACES is
            # carried; a figure taken off the deck goes with its copy,
            # which is the explicit-empty rule above.
            for f, placed in (("emb", _placed_refs), ("media", _placed_clips)):
                mine, theirs = p.get(f), held[k].get(f)
                if f in add or not isinstance(mine, dict) or not theirs:
                    continue
                gap = {r: v for r, v in theirs.items()
                       if r not in mine and r in placed(p)}
                if gap:
                    add[f] = {**mine, **gap}
            if add:
                p = {**p, **add}
        out.append(p)
    return out


def _placed_refs(p: dict) -> set:
    """Every notebook ref a saved deck or collection shows -- the refs the
    editor's embedAssets keys `emb` by: placed cells, flip-book pages,
    legacy panes and a collection's cells."""
    refs: set = set()

    def add(r):
        if isinstance(r, str) and r:
            refs.add(r)
    for s in p.get("slides") or []:
        if not isinstance(s, dict):
            continue
        for r in s.get("panes") or []:
            add(r)
        for a in s.get("annots") or []:
            if not isinstance(a, dict):
                continue
            if a.get("k") == "cell":
                add(a.get("ref"))
            elif a.get("k") == "flip":
                for fr in a.get("frames") or []:
                    if isinstance(fr, dict):
                        add(fr.get("ref"))
    for it in p.get("items") or []:
        if isinstance(it, dict):
            add(it.get("ref"))
            for u in it.get("under") or []:
                if isinstance(u, dict):
                    add(u.get("ref"))
    return refs


def _placed_clips(p: dict) -> set:
    """Every clip key a saved deck plays: its video/audio items and its
    slides' narration (the keys the editor's mediaEmbed writes)."""
    keys: set = set()
    for s in p.get("slides") or []:
        if not isinstance(s, dict):
            continue
        for a in s.get("annots") or []:
            if (isinstance(a, dict) and a.get("k") == "video"
                    and isinstance(a.get("vkey"), str) and a["vkey"]):
                keys.add(a["vkey"])
        nar = s.get("narr")
        if (isinstance(nar, dict) and isinstance(nar.get("vkey"), str)
                and nar["vkey"]):
            keys.add(nar["vkey"])
    return keys


def _lean(p):
    """A saved deck without its figure and clip copies (the boot form)."""
    if isinstance(p, dict) and ("emb" in p or "media" in p):
        return {k: v for k, v in p.items() if k not in ("emb", "media")}
    return p


def _snap_key(v) -> object:
    """Content identity of one stored copy, for de-duplication."""
    if isinstance(v, dict):
        try:
            k = tuple(sorted(v.items()))
            hash(k)
            return k
        except TypeError:           # a hand-edited value that is a list
            pass
    return ("id", id(v))


def emb_payload(presentations: list, revision: int) -> dict:
    """The figure and clip copies every saved deck carries, each distinct
    copy sent ONCE (``GET /api/emb``).

    The app page used to inline every deck's ``emb`` in its boot JSON:
    10 MB for an 18-deck project, 228 copies of 46 figures, parsed twice
    and held for the session before anything was on screen (2026-10-09).
    The page boots lean now and fetches this at idle -- or the moment a
    deck needs one. Decks keep their order (the editor absorbs them first
    come, first kept) and each names its copies by position in ``snaps``
    and ``clips``.
    """
    snaps: list = []
    clips: list = []
    seen_s: dict = {}
    seen_c: dict = {}
    decks = []

    def put(seen, store, v):
        k = _snap_key(v)
        if k not in seen:
            seen[k] = len(store)
            store.append(v)
        return seen[k]
    for p in presentations or []:
        if not isinstance(p, dict):
            continue
        e = p.get("emb") if isinstance(p.get("emb"), dict) else {}
        m = p.get("media") if isinstance(p.get("media"), dict) else {}
        if not (e or m):
            continue
        d: dict = {"name": p.get("name")}
        if e:
            d["emb"] = {r: put(seen_s, snaps, v) for r, v in e.items()}
        if m:
            d["media"] = {r: put(seen_c, clips, v) for r, v in m.items()}
        decks.append(d)
    return {"rev": revision, "snaps": snaps, "clips": clips, "decks": decks}


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
    # os.scandir, not iterdir + is_dir()/stat() per entry: on Windows the
    # listing itself already carries each entry's type and size, and a
    # separate call per file made a big (or OneDrive) folder slow to show
    # -- 4,500 stat calls for 3,500 entries (2026-10-08). DirEntry's
    # is_dir() and stat() follow symlinks, exactly as Path's did.
    try:
        with os.scandir(d) as it:
            entries = sorted(it, key=lambda e: e.name.lower())
    except OSError:
        entries = []
    for p in entries:
        name = p.name
        if name.startswith(".") or name == "__pycache__":
            continue
        try:
            if p.is_dir():
                dirs.append({"name": name, "path": str(d / name)})
            elif Path(name).suffix.lower() == ".ipynb":
                kb = max(1, p.stat().st_size // 1024)
                nbs.append({"name": name, "path": str(d / name),
                            "size": f"{kb} KB"})
            elif _is_deck_file(name):
                # saved presentations open from the same dialog — on disk
                # they carry the default browser's icon and no way back in
                # (2026-08-20, user: "you can't click on them and open
                # them, it just shows the firefox symbol")
                kb = max(1, p.stat().st_size // 1024)
                decks.append({"name": name, "path": str(d / name),
                              "size": f"{kb} KB"})
            elif is_pptx_name(name):
                # T320: a .pptx presentation imports from this dialog too.
                # Listed WITH the decks, carrying its kind, because that
                # is the shelf a person looks on for a presentation.
                kb = max(1, p.stat().st_size // 1024)
                decks.append({"name": name, "path": str(d / name),
                              "size": f"{kb} KB", "kind": ".pptx"})
            elif source_label(name):
                # every OTHER source the producer table knows: Markdown,
                # Quarto, LaTeX, csv/tsv. They parsed from the CLI and
                # from the web build since T91 and were invisible here,
                # which made the same file openable or not depending on
                # which door you came through (T100). The label comes
                # from SOURCES rather than a second list in this file.
                kb = max(1, p.stat().st_size // 1024)
                srcs.append({"name": name, "path": str(d / name),
                             "size": f"{kb} KB",
                             "kind": source_label(name)})
        except OSError:
            continue
    parent = str(d.parent) if d.parent != d else ""
    return {"dir": str(d), "parent": parent, "dirs": dirs,
            "notebooks": nbs, "decks": decks, "sources": srcs}


def _app_page(state: _AppState, *, warm: bool = False) -> bytes:
    """The whole app page for the session's open notebooks, as bytes.

    Each notebook's shell comes from server/shells.py, so a notebook that
    has not changed since the last build is not parsed or rendered again,
    and the stylesheets and scripts are links to content-hashed files the
    browser keeps (render/static.py). ``warm``: this is the startup
    pre-render, run while the browser is still starting.
    """
    shells: list[Shell] = []
    pruned: list[str] = []
    taken: set[str] = set()
    opened = list(state.open)
    # every URL notebook downloads at once, rather than one after another
    # with a 30 s timeout each inside the loop below
    fetched = DOWNLOADS.fetch([p for p in opened if is_url(p)], warm=warm)
    for p in opened:
        if is_url(p):
            got = fetched.get(p)
            try:
                if got is None:
                    raise ValueError("not downloaded")
                stem = stem_for(Path(url_stem(got[0]) + ".ipynb"), taken)
                shell = url_shell(p, got[1], stem)
            except Exception:       # noqa: BLE001 -- likely transient
                continue            # keep the URL in the session
            taken.add(stem)
            shells.append(shell)
            continue
        f = Path(p)
        stem = stem_for(f, taken)
        try:
            # lenient: a corrupt deck file beside a healthy notebook opens
            # it deckless; only a notebook that is really gone or bad is
            # pruned below (2026-08-23)
            shell = local_shell(local_source(f, stem, str(f)), lenient=True)
        except (OSError, ValueError):
            pruned.append(p)
            continue
        taken.add(stem)
        shells.append(shell)
    if pruned:                      # notebooks meanwhile deleted / moved
        with state.lock:
            state.open = [p for p in state.open if p not in pruned]
            state._write()
    return encode_pieces(page_pieces(
        mode="app", title=page_title([s.title for s in shells]),
        shells=b"".join(s.body() for s in shells),
        app_data=_boot_json(state), asset_base="/static/"))


def _boot_json(state: _AppState) -> bytes:
    """The page's boot JSON, encoded once per state of the project.

    On a project with many saved decks this is megabytes, and encoding it
    was a large share of every page build. It changes only when a save
    lands -- which replaces ``presentations`` and bumps ``revision`` --
    or the recent list moves, so that is the key.
    """
    key = (state.revision, id(state.presentations), tuple(state.recent),
           state.token, str(state.root))
    cached = state.boot_json
    if cached is not None and cached[0] == key:
        return cached[1]
    # LEAN BOOT (2026-10-09): the decks without their figure and clip
    # copies, which the editor fetches from /api/emb once the page is up.
    # `lazyEmb` says there is something to fetch; without it the editor
    # behaves exactly as it did, which is what the static page relies on.
    held = state.presentations
    body = app_data_json("app", {
        "token": state.token,
        "root": str(state.root),
        "presentations": [_lean(p) for p in held],
        "lazyEmb": any(isinstance(p, dict) and (p.get("emb") or p.get("media"))
                       for p in held),
        # the client echoes this back on every save so a second
        # window's stale whole-array write is refused, not applied
        "rev": state.revision,
        "recent": state.recent,
    }).encode("utf-8")
    state.boot_json = (key, body)
    return body
