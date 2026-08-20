"""The HTTP surface of the local app.

A single handler factory closed over the app state. Requests are same-origin and
token-guarded: this server can read and write files, so it must never answer to
a page it did not serve.
"""

from __future__ import annotations

import http.server
import json
import re
import secrets
import time
import urllib.parse
from pathlib import Path
from typing import Any

from ..notebook.loader import (
    _is_url,
    _normalize_nb_url,
    _stem_for,
    doc_from_url,
    load_doc,
)
from ..notebook.parser import parse_notebook
from ..notebook.presentations import _as_presentations
from ..render.items import render_item
from ..render.page import render_shell
from .notebook_edit import _store_version, _versions_dir, insert_note_cell
from .state import _app_page, _AppState, _is_deck_file, _list_dir
from .vcs import _git_commit_file, _git_file_log, _git_info, _git_show_notebook


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
                self._html(_app_page(state))
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
                elif url.path == "/api/readdeck":
                    self._json(self._read_deck(body))
                elif url.path == "/api/parse":
                    self._json(self._parse_nb(body))
                elif url.path == "/api/save":
                    state.save_presentations(
                        _as_presentations(body.get("presentations")))
                    self._json({"ok": True})
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

        def _read_deck(self, body: dict) -> dict:
            """Hand back a saved .junoview presentation file's TEXT — the
            client's importer (deck.js parseDeckText) already understands
            both the polyglot HTML save and bare JSON, so the server stays
            a reader, not a second parser."""
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw:
                raise ValueError("no path given")
            f = Path(raw).expanduser()
            if not f.is_absolute():
                f = state.root / f
            f = f.resolve()
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
            if _is_url(raw):
                url = _normalize_nb_url(raw)
                doc = doc_from_url(url)
                if into:
                    doc.source_name = into
                else:
                    doc.source_name = _stem_for(
                        Path(doc.source_name + ".ipynb"),
                        state.stems_taken(skip_str=url))
                    state.note_open(url)
                return {"stem": doc.source_name, "path": url,
                        "shell": render_shell(doc, path=url)}
            f = Path(raw).expanduser()
            if not f.is_absolute():
                f = state.root / f
            f = f.resolve()
            if not f.exists():
                raise FileNotFoundError(f"{f} not found")
            if f.suffix.lower() != ".ipynb":
                raise ValueError(f"{f.name} is not a .ipynb file")
            _store_version(f)   # every open/reload keeps a snapshot
            doc = load_doc(f)
            if into:
                doc.source_name = into
            else:
                doc.source_name = _stem_for(f, state.stems_taken(skip=f))
                state.note_open(f)
            return {"stem": doc.source_name, "path": str(f),
                    "shell": render_shell(doc, path=str(f))}

        def _resolve_nb_path(self, raw: str) -> Path:
            f = Path(raw).expanduser()
            if not f.is_absolute():
                f = state.root / f
            f = f.resolve()
            if not f.exists():
                raise FileNotFoundError(f"{f} not found")
            if f.suffix.lower() != ".ipynb":
                raise ValueError(f"{f.name} is not a .ipynb file")
            return f

        def _add_note(self, body: dict) -> dict:
            """Insert a markdown note cell into the .ipynb on disk (after the
            card the user clicked), optionally git-commit it, and hand back a
            freshly rendered shell."""
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw:
                raise ValueError("no path given")
            if _is_url(raw):
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
            f.write_text(json.dumps(nb, ensure_ascii=False, indent=1) + "\n",
                         encoding="utf-8")
            git = _git_info(f)
            if body.get("commit") and git.get("repo"):
                first = src.splitlines()[0][:60]
                git["commit"] = _git_commit_file(
                    f, str(body.get("message") or "") or f"Note: {first}")
            doc = load_doc(f)
            doc.source_name = _stem_for(f, state.stems_taken(skip=f))
            return {"stem": doc.source_name, "path": str(f),
                    "cell": cell_id, "index": idx, "git": git,
                    "shell": render_shell(doc, path=str(f))}

        def _git_state(self, body: dict) -> dict:
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw or _is_url(raw):
                return {"repo": False}
            f = self._resolve_nb_path(raw)
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
            if not raw or _is_url(raw):
                return {"versions": []}
            f = self._resolve_nb_path(raw)
            out = []
            for v in sorted(_versions_dir(f).glob("*.ipynb"),
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
                fc = self._resolve_nb_path(raw)
                nbc = _git_show_notebook(fc, commit)
                doc = parse_notebook(nbc)
                doc.source_name = _stem_for(
                    fc, state.stems_taken(skip=fc))
                return {"stem": doc.source_name, "path": str(fc),
                        "version": "git:" + commit,
                        "shell": render_shell(doc, path=str(fc))}
            if not re.fullmatch(r"[\w.\-]+\.ipynb", vid):
                raise ValueError("bad version id")
            f = self._resolve_nb_path(raw)
            vd = _versions_dir(f).resolve()
            vf = (vd / vid).resolve()
            if vf.parent != vd or not vf.exists():
                raise FileNotFoundError("version not found")
            doc = load_doc(vf)
            doc.source_name = _stem_for(f, state.stems_taken(skip=f))
            return {"stem": doc.source_name, "path": str(f),
                    "version": vid,
                    "shell": render_shell(doc, path=str(f))}

        def _parse_nb(self, body: dict) -> dict:
            nb = body.get("nb")
            if isinstance(nb, str):
                nb = json.loads(nb)
            if not isinstance(nb, dict):
                raise ValueError("nb must be notebook JSON")
            name = str(body.get("name") or "notebook.ipynb")
            base = re.sub(r"\.ipynb$", "", name, flags=re.I) or "notebook"
            doc = parse_notebook(nb)
            doc.source_name = _stem_for(Path(base + ".ipynb"),
                                        state.stems_taken())
            return {"stem": doc.source_name, "path": "",
                    "shell": render_shell(doc)}

    return Handler
