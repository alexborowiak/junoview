"""Rendered notebook shells, kept between page builds.

Every GET / -- each launch, F5 and second window -- used to re-read,
re-parse and re-render every open notebook, and every Reload did it
again for one (100-590 ms of server time before the first byte here, so
roughly 0.3-2.5 s of white page on the owner's laptop; 2026-10-08 speed
investigation). A rendered shell depends on very little, so it is kept,
keyed on exactly that:

* the source file's CONTENT -- a hash of its bytes, not its mtime, so a
  copy that keeps its timestamp, or a write inside one clock tick, can
  never be mistaken for the version already rendered;
* the deck files ``load_doc`` reads beside it (``deck_sidecars``, the
  same function, so the cache and the loader cannot disagree about
  which files count), by name and content;
* the tab's stem and path, which are written into the shell;
* the shell template's text, so the frontend edit loop still works;
* this run of the server (a random salt): rendering code only changes
  by restarting, and a page from an earlier run must never be told its
  shells are current.

Only SELF-CONTAINED sources are kept. A .md, .qmd or .tex embeds image
files from beside it, which nothing here watches, so those render fresh
every time and carry no version.

The key doubles as the shell's VERSION (``data-ver``): the page sends it
back on Reload and on the deck's Update figures, and a notebook that has
not changed answers ``unchanged`` instead of a re-render the browser
would then have to remount and re-typeset (1.2-2.5 s on the 116-cell
notebook at 4x CPU throttle).
"""

from __future__ import annotations

import concurrent.futures
import functools
import hashlib
import secrets
import sys
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Hashable
from dataclasses import dataclass, field
from pathlib import Path

from .. import assets
from ..notebook.loader import (
    deck_sidecars,
    fetch_url_bytes,
    load_doc,
    url_notebook,
)
from ..notebook.parser import parse_notebook
from ..notebook.sources import doc_from_bytes
from ..render.page import has_marked_math, render_shell

#: Different on every run: a version token from an earlier server never
#: matches, whatever the file says.
_RUN = secrets.token_hex(8)

#: Sources whose rendering depends on their own bytes (and deck files)
#: alone. Everything else renders fresh -- see the module docstring.
_SELF_CONTAINED = frozenset({".ipynb", ".csv", ".tsv", ".xlsx"})


@dataclass
class Shell:
    """One rendered notebook view and what the page needs beside it."""

    html: str
    title: str
    ver: str = ""   # "" = cannot be versioned; always re-render
    #: the corrupt-deck-file error a lenient build rendered past; a
    #: strict caller (an explicit open) still raises it
    fallback: Exception | None = None
    _body: bytes | None = field(default=None, repr=False)
    _math: bool | None = field(default=None, repr=False)

    def body(self) -> bytes:
        """The shell as UTF-8, encoded once."""
        if self._body is None:
            self._body = self.html.encode("utf-8")
        return self._body

    @property
    def math(self) -> bool:
        """Whether this shell holds maths (render/maths.py marks it), so
        the page fetches MathJax at load -- asked once per rendering."""
        if self._math is None:
            self._math = has_marked_math(self.html)
        return self._math


class _Memo:
    """A small LRU whose concurrent misses on one key build ONCE.

    The startup pre-render and the browser's first GET / ask for the
    same shells at the same moment; the second asker waits for the first
    one's result instead of parsing the notebook a second time.
    ``slot`` names what a key is a version OF: storing a new version
    drops the old one, so a long session does not keep every revision
    of a notebook it has reloaded.
    """

    def __init__(self, cap: int):
        self._cap = cap
        self._lock = threading.Lock()
        self._data: OrderedDict = OrderedDict()   # key -> (slot, value)
        self._busy: dict = {}                     # key -> threading.Event

    def get(self, key: Hashable, slot: Hashable,
            build: Callable[[], Shell]) -> Shell:
        while True:
            with self._lock:
                if key in self._data:
                    self._data.move_to_end(key)
                    return self._data[key][1]
                wait = self._busy.get(key)
                if wait is None:
                    done = self._busy[key] = threading.Event()
            if wait is None:
                break
            wait.wait()        # then look again: a hit, or build it here
        try:
            value = build()
        except BaseException:
            with self._lock:
                del self._busy[key]
            done.set()
            raise
        with self._lock:
            for k in [k for k, (s, _v) in self._data.items() if s == slot]:
                del self._data[k]
            self._data[key] = (slot, value)
            while len(self._data) > self._cap:
                self._data.popitem(last=False)
            del self._busy[key]
        done.set()
        return value

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


_SHELLS = _Memo(cap=16)


def _digest(p: Path) -> str | None:
    """A deck file's CONTENT, for the same reason the notebook's own is
    keyed on its bytes: a copy that keeps its timestamp (``cp -p``, an
    unzip, a sync client) at the same size would otherwise be taken for
    the version already rendered, on Reload and on every page load."""
    try:
        return hashlib.sha1(p.read_bytes()).hexdigest()
    except OSError:
        return None


@functools.lru_cache(maxsize=4)
def _template_hash(template: str) -> str:
    return hashlib.sha1(template.encode("utf-8")).hexdigest()


def _token(key: tuple) -> str:
    return hashlib.sha256(repr(key).encode("utf-8")).hexdigest()[:20]


@dataclass(frozen=True)
class LocalSource:
    """A notebook file as read for ONE request: its bytes and its key."""

    f: Path
    stem: str
    path: str
    data: bytes
    key: tuple | None       # None: not self-contained, never kept

    @property
    def ver(self) -> str:
        return _token(self.key) if self.key is not None else ""


def local_source(f: Path, stem: str, path: str,
                 data: bytes | None = None) -> LocalSource:
    """Read ``f`` and work out what a rendering of it depends on.

    Raises OSError when the file is gone, exactly as a load would.
    ``data``: the file's bytes when the caller has just WRITTEN them (Add
    a note), so the version names exactly what it wrote, whatever else
    reaches the file afterwards.
    """
    if data is None:
        data = f.read_bytes()
    if f.suffix.lower() not in _SELF_CONTAINED:
        return LocalSource(f, stem, path, data, None)
    sidecars, _lenient = deck_sidecars(f)
    key = ("file", str(f), stem, path,
           hashlib.sha1(data).hexdigest(),
           tuple((str(s), _digest(s)) for s in sidecars),
           _template_hash(assets.shell_template()), _RUN)
    return LocalSource(f, stem, path, data, key)


def local_shell(src: LocalSource, *, lenient: bool) -> Shell:
    """The rendered shell for ``src``, from the cache when it is current.

    ``lenient`` is the page build's rule: a corrupt deck file beside a
    healthy notebook opens it without its presentations rather than
    dropping the tab. An explicit open or note (``lenient=False``) still
    reports that error, as it always has.
    """
    if src.key is None:
        shell = _render_local(src, "")
    else:
        shell = _SHELLS.get(src.key, ("file", str(src.f), src.stem),
                            lambda: _render_local(src, src.ver))
    if shell.fallback is not None and not lenient:
        raise shell.fallback
    return shell


def warm_local(src: LocalSource) -> None:
    """Render ``src`` into the cache in the background.

    For a caller that answered the page without a shell (a note added in
    place, server/notebook_edit.note_in_place) but whose file the next
    page build or Reload will ask for: that one then finds it kept, as it
    would have had the caller rendered it on the way out.
    """
    if src.key is None:
        return

    def run() -> None:
        try:
            local_shell(src, lenient=True)
        except Exception:       # noqa: BLE001 -- the next ask renders it
            pass
    threading.Thread(target=run, daemon=True).start()


def _render_local(src: LocalSource, ver: str) -> Shell:
    fallback: Exception | None = None
    try:
        doc = load_doc(src.f, data=src.data)
    except (OSError, ValueError) as e:
        # A corrupt DECK SIDECAR lands here too (JSONDecodeError is a
        # ValueError), and it used to be treated exactly like a deleted
        # notebook: the healthy tab was pruned and the project file
        # rewritten without it. Retry on just the .ipynb — if the
        # notebook itself parses, keep the tab and open it deckless;
        # prune only when the notebook is really gone/bad (2026-08-23).
        # The retry is the source read by its OWN kind, just without its
        # deck files: a .csv or .xlsx beside a broken deck opens too, and
        # a source that is itself broken raises its own error (an open
        # reported "UnicodeDecodeError" for a damaged workbook, from
        # reading it as notebook JSON), and is pruned.
        doc = doc_from_bytes(src.f, src.data, base=src.f.parent)
        fallback = e
        print(f"warning: could not read the deck sidecar for {src.f.name};"
              " opened without its presentations", file=sys.stderr)
    doc.source_name = src.stem
    return Shell(render_shell(doc, path=src.path, ver=ver), doc.title, ver,
                 fallback)


def url_shell(url: str, data: bytes, stem: str) -> Shell:
    """A downloaded notebook's shell. Kept on the downloaded BYTES, so a
    re-download that brings the same file back skips the parse. It
    carries no version: a URL tab's Reload always downloads again."""
    key = ("url", url, stem, hashlib.sha1(data).hexdigest(),
           _template_hash(assets.shell_template()), _RUN)

    def build() -> Shell:
        doc = parse_notebook(url_notebook(url, data))
        doc.source_name = stem
        return Shell(render_shell(doc, path=url), doc.title)
    return _SHELLS.get(key, ("url", url, stem), build)


class _Downloads:
    """URL notebooks for page builds: in parallel, and shared in flight.

    A page build used to download each URL notebook one after another
    (each with a 30 s timeout), on every launch and F5. Now every one it
    needs is fetched at once; a download already running -- the startup
    pre-render's -- is joined rather than repeated; and a copy the
    pre-render fetched is handed to the FIRST page build after it, if it
    is still under ``FRESH_S`` seconds old. Every later page build
    downloads again, exactly as before: F5 still means "fetch it now".
    """

    FRESH_S = 30.0

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._busy: dict[str, concurrent.futures.Future] = {}
        self._warm: dict[str, tuple[float, tuple[str, bytes]]] = {}

    def fetch(self, urls: list[str], *, warm: bool = False
              ) -> dict[str, tuple[str, bytes] | None]:
        """{url: (file name, bytes)}, or None for one that failed.

        ``warm``: this is the startup pre-render -- keep what arrives for
        the first real page build.
        """
        now = time.monotonic()
        got: dict[str, tuple[str, bytes] | None] = {}
        waits: dict[str, concurrent.futures.Future] = {}
        with self._lock:
            for u in dict.fromkeys(urls):
                held = None if warm else self._warm.pop(u, None)
                if held is not None and now - held[0] < self.FRESH_S:
                    got[u] = held[1]
                    continue
                fut = self._busy.get(u)
                if fut is None:
                    fut = self._busy[u] = concurrent.futures.Future()
                    threading.Thread(target=self._run, args=(u, fut, warm),
                                     daemon=True).start()
                waits[u] = fut
        for u, fut in waits.items():
            try:
                got[u] = fut.result()
            except Exception:       # noqa: BLE001 -- likely transient
                got[u] = None
        if not warm:
            # a page build that JOINED the pre-render's download has just
            # used that copy; it must not be handed to a second one
            with self._lock:
                for u in waits:
                    self._warm.pop(u, None)
        return got

    def _run(self, url: str, fut: concurrent.futures.Future,
             warm: bool) -> None:
        try:
            res = fetch_url_bytes(url)
        except BaseException as e:      # noqa: BLE001 -- handed to waiters
            with self._lock:
                self._busy.pop(url, None)
            fut.set_exception(e)
            return
        with self._lock:
            self._busy.pop(url, None)
            if warm:
                self._warm[url] = (time.monotonic(), res)
        fut.set_result(res)


DOWNLOADS = _Downloads()
