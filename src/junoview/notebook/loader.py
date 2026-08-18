"""Getting notebooks from where they live: disk, or a URL.

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
from .presentations import _as_presentations


def load_doc(path: Path, title: str | None = None,
             deck_path: Path | None = None) -> Document:
    """Parse one notebook file into a Document, with its presentations.

    Deck priority: explicit deck_path > <notebook>.deck.json sidecar >
    embedded metadata (parse_notebook already loaded that).
    """
    nb = json.loads(path.read_text(encoding="utf-8"))
    doc = parse_notebook(nb, title=title)
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
        pres = _as_presentations(
            _deck_json(Path(deck_path).read_text(encoding="utf-8")))
        if pres:
            doc.presentations = pres
    return doc


_DECK_BLOCK_RE = re.compile(
    r'<script type="application/json" id="junoview-data">(.*?)</script>',
    re.S)


def _deck_json(text: str):
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
            raise SystemExit("error: no Junoview data block in that "
                             "HTML file")
        t = m.group(1)
    return json.loads(t)


def render_notebook_file(path: Path, title: str | None = None,
                         deck_path: Path | None = None) -> str:
    return render_html(load_doc(path, title=title, deck_path=deck_path))


def embed_deck(nb_path: Path, deck_path: Path) -> None:
    """Write presentations JSON into metadata.semantic.presentations."""
    pres = _as_presentations(
        _deck_json(deck_path.read_text(encoding="utf-8")))
    if not pres:
        raise SystemExit(f"error: {deck_path} does not look like saved "
                         "presentations (expected {'presentations': [...]})")
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    sem = nb.setdefault("metadata", {}).setdefault("semantic", {})
    sem["presentations"] = pres
    sem.pop("deck", None)
    nb_path.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")


_GH_BLOB_RE = re.compile(
    r"^https?://github\.com/([^/]+)/([^/]+)/(?:blob|raw)/(.+)$")


def _is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def _normalize_nb_url(url: str) -> str:
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
    url = _normalize_nb_url(url)
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


def _stem_for(path: Path, taken: set[str]) -> str:
    base = path.stem or "notebook"
    stem, n = base, 1
    while stem in taken:
        n += 1
        stem = f"{base}-{n}"
    return stem
