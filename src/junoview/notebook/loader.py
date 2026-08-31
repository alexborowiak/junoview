"""Getting documents from where they live: disk, or a URL.

Not just notebooks any more. ``load_doc`` dispatches on the suffix
through :mod:`junoview.notebook.sources`, so a ``.tex``, a ``.md`` or a
``.csv`` opens exactly as a ``.ipynb`` does and everything downstream --
cards, decks, refresh, export -- works on it unchanged (T91).

GitHub ``blob`` links are rewritten to their raw form and cache-busted, because
the raw CDN otherwise serves minutes-stale content -- long enough for someone to
think the tool is broken.
"""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from ..render.page import render_html
from .model import Document
from .parser import parse_notebook
from .presentations import as_presentations, deck_json
from .sources import doc_from_bytes


def load_doc(path: Path, title: str | None = None,
             deck_path: Path | None = None) -> Document:
    """Parse one notebook file into a Document, with its presentations.

    Deck priority: explicit deck_path > <notebook>.deck.json sidecar >
    embedded metadata (parse_notebook already loaded that).
    """
    # by SUFFIX, not by assuming JSON: a .tex or a .csv is as much a
    # source as a notebook is, and the producer table is the one place
    # that says which (T91)
    # base=path.parent: a .md or .tex refers to its figures by a path
    # relative to ITSELF, and load_doc is the only caller that knows what
    # that is. Without it the reference was emitted verbatim and resolved
    # against wherever the OUTPUT landed, which is right only when the two
    # sit in the same directory (T101).
    # BYTES, decoded (and newline-normalised) inside doc_from_bytes:
    # the one seam T113 opened, so a .xlsx and a .tex come through the
    # same door and no caller has to know which kind it is holding.
    doc = doc_from_bytes(path, path.read_bytes(), title=title,
                         base=path.parent)
    doc.source_name = path.stem
    if deck_path is None:
        # a deck saved from the browser lands next to the notebook as
        # <stem>.junoview.html (an HTML page carrying the JSON, so
        # double-clicking it opens a browser); bare <stem>.junoview and
        # the older <stem>.deck.json still work
        for suffix in (".junoview.html", ".junoview", ".deck.json"):
            sidecar = path.with_suffix(suffix)
            if sidecar.exists():
                deck_path = sidecar
                break
    if deck_path is not None:
        pres = as_presentations(
            deck_json(Path(deck_path).read_text(encoding="utf-8")))
        if pres:
            doc.presentations = pres
    return doc


def render_notebook_file(path: Path, title: str | None = None,
                         deck_path: Path | None = None) -> str:
    return render_html(load_doc(path, title=title, deck_path=deck_path))


_GH_BLOB_RE = re.compile(
    r"^https?://github\.com/([^/]+)/([^/]+)/(?:blob|raw)/(.+)$")


def is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def normalize_nb_url(url: str) -> str:
    url = url.strip()
    m = _GH_BLOB_RE.match(url)
    if m:
        return ("https://raw.githubusercontent.com/"
                f"{m.group(1)}/{m.group(2)}/{m.group(3)}")
    return url


def _cache_bust(url: str) -> str:
    """GitHub's raw CDN caches files for minutes — a fresh query param makes
    a new cache key, so a refresh sees the latest commit immediately."""
    host = urllib.parse.urlsplit(url).netloc.lower()
    if host.endswith("githubusercontent.com"):
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}jvr={int(time.time())}"
    return url


def _fetch_notebook_url(url: str) -> tuple[str, dict]:
    """Download a notebook from a URL; returns (filename, nb dict)."""
    url = normalize_nb_url(url)
    req = urllib.request.Request(
        _cache_bust(url), headers={"User-Agent": "semantic-render",
                                   "Cache-Control": "no-cache",
                                   "Pragma": "no-cache"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    nb = json.loads(data.decode("utf-8"))
    if not isinstance(nb, dict) or "cells" not in nb:
        raise ValueError(f"{url} does not look like a notebook")
    name = urllib.parse.unquote(
        urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1]) \
        or "notebook.ipynb"
    return name, nb


def doc_from_url(url: str) -> Document:
    name, nb = _fetch_notebook_url(url)
    doc = parse_notebook(nb)
    doc.source_name = re.sub(r"\.ipynb$", "", name, flags=re.I) \
        or "notebook"
    return doc


def stem_for(path: Path, taken: set[str]) -> str:
    base = path.stem or "notebook"
    stem, n = base, 1
    while stem in taken:
        n += 1
        stem = f"{base}-{n}"
    return stem
