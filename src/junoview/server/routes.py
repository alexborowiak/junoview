"""The HTTP surface of the local app.

A single handler factory closed over the app state. Requests are same-origin and
token-guarded: this server can read and write files, so it must never answer to
a page it did not serve.
"""

from __future__ import annotations

import base64
import html
import http.server
import json
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from .._write import write_text
from ..notebook.loader import (
    doc_from_url,
    is_url,
    load_doc,
    normalize_nb_url,
    stem_for,
)
from ..notebook.parser import parse_notebook
from ..notebook.pptx_read import (
    PPTX_CAP,
    is_pptx_name,
    read_pptx,
    read_pptx_b64,
)
from ..notebook.presentations import as_presentations
from ..notebook.sources import (
    EMBED_CAP,
    IMG_MIME,
    NOT_AN_IMAGE,
    SOURCE_SUFFIXES,
    doc_from_bytes,
    doc_from_text,
)
from ..render.items import render_item
from ..render.page import render_shell
from .notebook_edit import _store_version, _versions_dir, insert_note_cell
from .state import StaleWrite, _app_page, _AppState, _is_deck_file, _list_dir
from .vcs import (
    _git_commit_file,
    _git_file_log,
    _git_info,
    _git_show_bytes,
    _git_show_notebook,
)

#: The first bytes each format must start with. A suffix is what the user
#: typed; this is what the file actually is, and the two disagreeing is how
#: a mistyped path ships the wrong file's bytes into a deck that then gets
#: shared. SVG has no magic number, so it is checked by parsing instead;
#: webp and avif are containers whose heads are not a fixed prefix, and are
#: the known gap (a test names them, so a third cannot join them quietly).
_IMG_MAGIC = {
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/bmp": [b"BM"],
}


def resolve_image_path(root: Path, raw: str) -> Path:
    """A path that must be an IMAGE, small enough to embed.

    THE GATE IS THE POINT. Every other content-returning route is held to
    a suffix or a name -- .ipynb, SOURCE_SUFFIXES, ``*.junoview*`` -- and
    a route that returned whatever bytes it was pointed at would be the
    first with none, taking what a page can read from ten document
    extensions to every file the account can open. Held to ``IMG_MIME``
    it adds no reach at all: ``/api/open`` already makes the server read
    an arbitrary absolute-path image and base64 it into the page, because
    that is how a .md or .tex embeds its figures.

    No root sandbox, deliberately: a deck legitimately draws on a figure
    in a sibling folder or on a share, and no existing route confines a
    path either.
    """
    f = Path(raw).expanduser()
    if not f.is_absolute():
        f = root / f
    f = f.resolve()
    if not f.exists() or not f.is_file():
        raise FileNotFoundError(f"{f} not found")
    mime = IMG_MIME.get(f.suffix.lower())
    if not mime:
        what = NOT_AN_IMAGE.get(f.suffix.lower())
        raise ValueError(
            f"{f.name} is {what} \u2014 not a picture a deck can carry"
            if what else f"{f.name} is not a picture this can read")
    size = f.stat().st_size
    if size > EMBED_CAP:
        raise ValueError(
            f"{f.name} is {size // (1024 * 1024)} MB, over the "
            f"{EMBED_CAP // (1024 * 1024)} MB a deck will carry")
    return f


def read_image_at(root: Path, raw_path: Any) -> dict:
    """Hand back ONE picture as a data URI, so the deck can keep the bytes
    rather than an address that only resolves on this machine.

    A path in an ``<img>`` cannot work from the app: every spelling of a
    computer path resolves to a ``file:`` URL, and an http document may
    not load one as a subresource. So the Insert menu's "a file path or a
    URL" was telling the truth about half of itself; this is the other
    half, and it is also what lets such a picture be EMBEDDED.
    """
    raw = str(raw_path or "").strip().strip('"')
    if not raw:
        raise ValueError("no path given")
    if is_url(raw):
        # http(s) already loads in an <img>; fetching it HERE would make
        # the server a proxy reachable from the page, which is a new
        # capability and a readable SSRF from loopback, not this one.
        raise ValueError(
            "a web address is loaded by the page itself, not read from disk")
    f = resolve_image_path(root, raw)
    mime = IMG_MIME[f.suffix.lower()]
    data = f.read_bytes()
    heads = _IMG_MAGIC.get(mime)
    if heads and not any(data.startswith(h) for h in heads):
        raise ValueError(
            f"{f.name} is named like {mime.split('/')[-1]} but its "
            "contents are not")
    if mime == "image/svg+xml":
        try:
            ET.fromstring(data)
        except Exception as e:              # noqa: BLE001 -- shown in the UI
            raise ValueError(f"{f.name} is not valid SVG: {e}") from e
    return {"name": f.name, "path": str(f),
            "src": f"data:{mime};base64,"
                   + base64.b64encode(data).decode("ascii")}


def read_pptx_at(root: Path, raw_path: Any) -> dict:
    """ONE PowerPoint deck from a path on this computer, as the editor's
    own item spec plus what was lost (T320) -- for a .pptx row in the
    Open dialog or a path typed into it.

    Held to the PowerPoint suffixes the way read_image_at is held to
    IMG_MIME: a route that read whatever it was pointed at would be the
    first with no gate. The file is never written to.
    """
    raw = str(raw_path or "").strip().strip('"')
    if not raw:
        raise ValueError("no path given")
    if is_url(raw):
        raise ValueError(
            "a web address is fetched by the page itself, not read from disk")
    f = Path(raw).expanduser()
    if not f.is_absolute():
        f = root / f
    f = f.resolve()
    if not is_pptx_name(f.name):
        raise ValueError(f"{f.name} is not a PowerPoint file (.pptx)")
    if not f.exists() or not f.is_file():
        raise FileNotFoundError(f"{f} not found")
    size = f.stat().st_size
    if size > PPTX_CAP:
        raise ValueError(
            f"{f.name} is {size // (1024 * 1024)} MB, over the "
            f"{PPTX_CAP // (1024 * 1024)} MB this will read")
    got = read_pptx(f.read_bytes(), f.name)
    return {"name": f.name, "path": str(f), "spec": got["spec"],
            "lost": got["lost"]}


#: A DOI is "10." then a registrant and a slash and a suffix. The route
#: below builds a doi.org URL out of one, so the shape is the gate: it
#: is the difference between a lookup and an open proxy.
_DOI_RE = re.compile(r"^10\.\d{4,9}/[^\s?#]+$")
#: doi.org answers content negotiation with BibTeX, which is exactly the
#: format the deck already reads. 64 KB is far more than any entry.
DOI_CAP = 64 * 1024


def fetch_doi(doi: str) -> dict:
    """One DOI -> its BibTeX, from doi.org.

    THE ONLY OUTBOUND FETCH THIS SERVER MAKES, and it is worth naming
    why it is allowed: everything else here reads the user's own disk,
    and the standing rule is that a rendered deck touches the network
    only for the pinned CDNs. A citation lookup cannot be done offline,
    the user asks for it by typing a DOI, and the reach is held to one
    host and one URL shape -- so it is a lookup, not a proxy the page
    could be talked into pointing anywhere.
    """
    d = str(doi or "").strip()
    d = re.sub(r"^https?://(dx\.)?doi\.org/", "", d, flags=re.I)
    d = re.sub(r"^doi:\s*", "", d, flags=re.I)
    if not _DOI_RE.match(d):
        raise ValueError(
            f"{d or 'that'} is not a DOI -- they start \"10.\" and then "
            "a slash")
    url = "https://doi.org/" + urllib.parse.quote(d, safe="/:._-()")
    req = urllib.request.Request(url, headers={
        "Accept": "application/x-bibtex; charset=utf-8",
        "User-Agent": "Junoview/citation-lookup",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read(DOI_CAP + 1)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise ValueError(f"doi.org does not know {d}") from e
        raise ValueError(f"doi.org answered {e.code}") from e
    except OSError as e:
        raise ValueError(f"could not reach doi.org: {e}") from e
    if len(raw) > DOI_CAP:
        raise ValueError("doi.org sent more than a citation could be")
    text = raw.decode("utf-8", errors="replace")
    if "@" not in text:
        raise ValueError("doi.org sent no BibTeX for that DOI")
    return {"doi": d, "bibtex": text}


def _make_handler(state: _AppState):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):       # keep the terminal quiet
            pass

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj: Any, code: int = 200) -> None:
            self._send(code,
                       json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                       "application/json; charset=utf-8")

        def _html(self, text: str, code: int = 200) -> None:
            self._send(code, text.encode("utf-8"),
                       "text/html; charset=utf-8")

        def _authed(self, query: dict) -> bool:
            tok = (query.get("t") or [""])[0]
            return secrets.compare_digest(tok, state.token)

        def do_GET(self):
            url = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(url.query)
            if url.path == "/":
                if not self._authed(query):
                    self._html("<h1>Junoview</h1>"
                               "<p>Open the exact URL printed in the "
                               "terminal (it carries a session token).</p>",
                               403)
                    return
                # the page build sat OUTSIDE any try/except, so one bad
                # notebook in the session turned "open the app" into a
                # connection that never answered (2026-08-23)
                try:
                    page = _app_page(state)
                except Exception as e:  # noqa: BLE001 -- surfaced in UI
                    self._html("<h1>Junoview</h1><p>Failed to build the "
                               f"page: {html.escape(f'{type(e).__name__}: {e}')}"
                               "</p>", 500)
                    return
                self._html(page)
                return
            if not self._authed(query):
                self._json({"error": "bad token"}, 403)
                return
            try:
                if url.path == "/api/list":
                    raw = (query.get("dir") or [""])[0] or str(state.root)
                    self._json(_list_dir(raw))
                else:
                    self._json({"error": "not found"}, 404)
            except FileNotFoundError as e:
                self._json({"error": str(e)}, 404)
            except Exception as e:          # noqa: BLE001 -- surfaced in UI
                self._json({"error": f"{type(e).__name__}: {e}"}, 400)

        def do_POST(self):
            url = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(url.query)
            if not self._authed(query):
                self._json({"error": "bad token"}, 403)
                return
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError("expected a JSON object")
            except ValueError:
                self._json({"error": "bad JSON body"}, 400)
                return
            try:
                if url.path == "/api/open":
                    self._json(self._open_nb(body))
                elif url.path == "/api/readimage":
                    self._json(self._read_image(body))
                elif url.path == "/api/readdeck":
                    self._json(self._read_deck(body))
                elif url.path == "/api/doi":
                    self._json(fetch_doi(str(body.get("doi") or "")))
                elif url.path == "/api/readpptx":
                    self._json(self._read_pptx(body))
                elif url.path == "/api/importpptx":
                    self._json(self._import_pptx(body))
                elif url.path == "/api/parse":
                    self._json(self._parse_nb(body))
                elif url.path == "/api/save":
                    # `rev` is the revision the client last saw. Absent (an
                    # older page still in a tab) means "do not check", which
                    # keeps the previous behaviour rather than breaking a
                    # window that has not reloaded.
                    rev = body.get("rev")
                    try:
                        new_rev = state.save_presentations(
                            as_presentations(body.get("presentations")),
                            rev if isinstance(rev, int) else None)
                    except StaleWrite as stale:
                        # 409, not a silent overwrite: another window has
                        # written since this one last read. Hand back what
                        # is actually stored so the client can merge.
                        self._json({"error": "stale", "rev": stale.revision,
                                    "presentations": stale.presentations},
                                   409)
                        return
                    self._json({"ok": True, "rev": new_rev})
                elif url.path == "/api/close":
                    state.note_close(str(body.get("path") or ""))
                    self._json({"ok": True})
                elif url.path == "/api/addnote":
                    self._json(self._add_note(body))
                elif url.path == "/api/gitstate":
                    self._json(self._git_state(body))
                elif url.path == "/api/versions":
                    self._json(self._versions(body))
                elif url.path == "/api/openversion":
                    self._json(self._open_version(body))
                elif url.path == "/api/versioncards":
                    self._json(self._version_cards(body))
                else:
                    self._json({"error": "not found"}, 404)
            except FileNotFoundError as e:
                self._json({"error": str(e)}, 404)
            except Exception as e:          # noqa: BLE001 -- surfaced in UI
                self._json({"error": f"{type(e).__name__}: {e}"}, 400)

        def _read_image(self, body: dict) -> dict:
            return read_image_at(state.root, body.get("path"))

        def _read_pptx(self, body: dict) -> dict:
            return read_pptx_at(state.root, body.get("path"))

        def _import_pptx(self, body: dict) -> dict:
            """A .pptx the browser holds (picked, dropped) -- its bytes
            come up as base64 and go back down as the spec (T320)."""
            return read_pptx_b64(str(body.get("name") or ""),
                                 str(body.get("b64") or ""))

        def _read_deck(self, body: dict) -> dict:
            """Hand back a saved .junoview presentation file's TEXT — the
            client's importer (deck.js parseDeckText) already understands
            both the polyglot HTML save and bare JSON, so the server stays
            a reader, not a second parser."""
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw:
                raise ValueError("no path given")
            f = self._resolve_path(raw)
            if not _is_deck_file(f.name):
                raise ValueError(f"{f.name} is not a .junoview file")
            if not f.exists():
                raise FileNotFoundError(f"{f} not found")
            if f.stat().st_size > 64 * 1024 * 1024:
                raise ValueError(f"{f.name} is too large to open")
            return {"name": f.name,
                    "text": f.read_text(encoding="utf-8", errors="replace")}

        def _open_nb(self, body: dict) -> dict:
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw:
                raise ValueError("no path given")
            # "stem" = load this INTO an open tab (another version of the
            # same notebook): keep its name and leave the recent list alone
            into = str(body.get("stem") or "").strip()
            if is_url(raw):
                url = normalize_nb_url(raw)
                doc = doc_from_url(url)
                if into:
                    doc.source_name = into
                else:
                    doc.source_name = stem_for(
                        Path(doc.source_name + ".ipynb"),
                        state.stems_taken(skip_str=url))
                    state.note_open(url)
                return {"stem": doc.source_name, "path": url,
                        "shell": render_shell(doc, path=url)}
            f = self._resolve_src_path(raw)
            _store_version(f)   # every open/reload keeps a snapshot
            doc = load_doc(f)
            if into:
                doc.source_name = into
            else:
                doc.source_name = stem_for(f, state.stems_taken(skip=f))
                state.note_open(f)
            return {"stem": doc.source_name, "path": str(f),
                    "shell": render_shell(doc, path=str(f))}

        def _resolve_path(self, raw: str) -> Path:
            """Relative paths resolve against the app root — shared by the
            notebook and deck-file routes (which differ in what they then
            demand of the file, so only the prefix is common)."""
            f = Path(raw).expanduser()
            if not f.is_absolute():
                f = state.root / f
            return f.resolve()

        def _resolve_nb_path(self, raw: str) -> Path:
            """A path that must be a NOTEBOOK.

            Kept strict deliberately. The routes that use it read
            notebook JSON -- insert_note_cell rewrites cells and
            _git_show_notebook parses a blob out of git -- and neither
            has any meaning for a .tex or a .csv. Widening this one
            resolver was the tempting one-line version of T100 and would
            have handed those routes files they cannot parse.
            """
            f = self._resolve_path(raw)
            if not f.exists():
                raise FileNotFoundError(f"{f} not found")
            if f.suffix.lower() != ".ipynb":
                raise ValueError(f"{f.name} is not a .ipynb file")
            return f

        def _resolve_src_path(self, raw: str) -> Path:
            """A path that must be something this tool can OPEN.

            SOURCE_SUFFIXES is the producer table in notebook/sources.py
            -- the one place that says what this tool reads -- so the
            app's gate and the CLI's cannot drift apart. Before T100 the
            app carried a second, narrower list and the same .tex file
            opened from the command line while the app refused it.
            """
            f = self._resolve_path(raw)
            if not f.exists():
                raise FileNotFoundError(f"{f} not found")
            if f.suffix.lower() not in SOURCE_SUFFIXES:
                raise ValueError(
                    f"{f.name} is not a file this can open ("
                    + ", ".join(SOURCE_SUFFIXES) + ")")
            return f

        def _add_note(self, body: dict) -> dict:
            """Insert a markdown note cell into the .ipynb on disk (after the
            card the user clicked), optionally git-commit it, and hand back a
            freshly rendered shell."""
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw:
                raise ValueError("no path given")
            if is_url(raw):
                raise ValueError("this notebook was opened from a URL — "
                                 "notes can only be saved to a local file")
            src = str(body.get("source") or "").strip()
            if not src:
                raise ValueError("the note is empty")
            f = self._resolve_nb_path(raw)
            _store_version(f)   # keep the pre-note state reachable
            nb = json.loads(f.read_text(encoding="utf-8"))
            nb, idx, cell_id = insert_note_cell(
                nb, str(body.get("after") or ""), src)
            write_text(f, json.dumps(nb, ensure_ascii=False, indent=1) + "\n")
            git = _git_info(f)
            if body.get("commit") and git.get("repo"):
                first = src.splitlines()[0][:60]
                git["commit"] = _git_commit_file(
                    f, str(body.get("message") or "") or f"Note: {first}")
            doc = load_doc(f)
            doc.source_name = stem_for(f, state.stems_taken(skip=f))
            return {"stem": doc.source_name, "path": str(f),
                    "cell": cell_id, "index": idx, "git": git,
                    "shell": render_shell(doc, path=str(f))}

        def _git_state(self, body: dict) -> dict:
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw or is_url(raw):
                return {"repo": False}
            # git tracks any file, so this follows the source gate
            f = self._resolve_src_path(raw)
            info = _git_info(f)
            if info.get("repo"):
                log = _git_file_log(f, 1)
                if log:            # the commit a figure LOCK binds to
                    info["commit"] = log[0]
            return info

        def _version_cards(self, body: dict) -> dict:
            """Render SPECIFIC cards from a git version of a notebook —
            locked deck frames fetch these without touching the tab."""
            raw = str(body.get("path") or "").strip().strip('"')
            commit = str(body.get("commit") or "")
            anchors = [str(x) for x in (body.get("anchors") or [])
                       if isinstance(x, str)][:200]
            if not re.fullmatch(r"[0-9a-fA-F]{4,40}", commit):
                raise ValueError("bad commit id")
            f = self._resolve_nb_path(raw)
            nb = _git_show_notebook(f, commit)
            doc = parse_notebook(nb)
            by_anchor = {}
            for sec in doc.sections:
                for it in sec.items:
                    by_anchor[it.anchor or it.item_id] = it
            cards: dict = {}
            for an in anchors:
                # a distinct name from the `it` above: an anchor that is not in
                # this revision resolves to None, and reusing the loop variable
                # hid that from the type checker
                card = by_anchor.get(an)
                cards[an] = ({"html": render_item(card), "title": card.title}
                             if card is not None else None)
            meta: dict = next((e for e in _git_file_log(f, 100)
                               if e["id"] == commit), {})
            return {"commit": commit, "msg": meta.get("msg", ""),
                    "date": meta.get("date", ""), "cards": cards}

        def _versions(self, body: dict) -> dict:
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw or is_url(raw):
                return {"versions": []}
            f = self._resolve_src_path(raw)
            out = []
            # snapshots keep the source's own suffix, so a .tex and a
            # .ipynb sharing a stem share a directory without either
            # listing the other's history
            for v in sorted(_versions_dir(f).glob("*" + f.suffix.lower()),
                            reverse=True):
                stamp = v.stem.split("_", 1)[0]
                try:
                    label = time.strftime(
                        "%d %b %Y · %H:%M:%S",
                        time.strptime(stamp, "%Y%m%d-%H%M%S"))
                except ValueError:
                    label = v.stem
                out.append({"id": v.name, "label": label})
            git = _git_info(f)
            commits = _git_file_log(f) if git.get("repo") else []
            return {"versions": out, "commits": commits}

        def _open_version(self, body: dict) -> dict:
            """Render an earlier snapshot OR a git commit's notebook INTO
            the notebook's tab (same stem + path, so deck refs keep
            resolving); ↻ returns to live."""
            raw = str(body.get("path") or "").strip().strip('"')
            vid = str(body.get("id") or "")
            commit = str(body.get("commit") or "")
            if commit:
                if not re.fullmatch(r"[0-9a-fA-F]{4,40}", commit):
                    raise ValueError("bad commit id")
                # any SOURCE, not only a notebook (T124): git show
                # hands back the file and doc_from_bytes dispatches on
                # the name, so a .tex's -- or, since T113, a .xlsx's --
                # commits open exactly the way a notebook's do. This
                # door used to be OFFERED for every source and then
                # refused for all but .ipynb. Bytes, because a
                # workbook commit is a ZIP and decoding would kill it.
                fc = self._resolve_src_path(raw)
                doc = doc_from_bytes(fc.name,
                                     _git_show_bytes(fc, commit),
                                     base=fc.parent)
                doc.source_name = stem_for(
                    fc, state.stems_taken(skip=fc))
                return {"stem": doc.source_name, "path": str(fc),
                        "version": "git:" + commit,
                        "shell": render_shell(doc, path=str(fc))}
            f = self._resolve_src_path(raw)
            if not re.fullmatch(r"[\w.\-]+" + re.escape(f.suffix.lower()),
                                vid):
                raise ValueError("bad version id")
            vd = _versions_dir(f).resolve()
            vf = (vd / vid).resolve()
            if vf.parent != vd or not vf.exists():
                raise FileNotFoundError("version not found")
            doc = load_doc(vf)
            doc.source_name = stem_for(f, state.stems_taken(skip=f))
            return {"stem": doc.source_name, "path": str(f),
                    "version": vid,
                    "shell": render_shell(doc, path=str(f))}

        def _parse_nb(self, body: dict) -> dict:
            """Render a file the browser holds and the server cannot read.

            Two shapes. ``nb`` is notebook JSON, kept for tabs opened
            before a reload. ``text`` is the file verbatim and dispatches
            through the producer table on its name, which is how a
            dropped .md or .tex gets rendered at all (T100) -- the server
            never sees the dropped file, only what the browser read.
            """
            name = str(body.get("name") or "notebook.ipynb")
            text = body.get("text")
            b64 = body.get("b64")
            if isinstance(b64, str) and b64:
                # the binary door (T113): the browser read the file as
                # bytes because a workbook has no text to send
                doc = doc_from_bytes(name, base64.b64decode(b64))
            elif isinstance(text, str):
                doc = doc_from_text(name, text)
            else:
                nb = body.get("nb")
                if isinstance(nb, str):
                    nb = json.loads(nb)
                if not isinstance(nb, dict):
                    raise ValueError("send either nb (notebook JSON) or "
                                     "text (the file's own contents)")
                doc = parse_notebook(nb)
            base = Path(name).stem or "notebook"
            doc.source_name = stem_for(Path(base + ".ipynb"),
                                       state.stems_taken())
            return {"stem": doc.source_name, "path": "",
                    "shell": render_shell(doc)}

    return Handler
