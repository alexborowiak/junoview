"""Optional git awareness for file and cell history.

Shows which commit a notebook is at, its recent history, and can commit a note
back. Every call degrades quietly when the file is not in a repository, or when
git is not installed at all.
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path

from ..notebook.directives import split_directives
from ..notebook.model import Document, Item
from ..notebook.outputs import as_text, render_outputs
from ..notebook.parser import parse_notebook
from ..render.markdown import md_to_html
from ..render.sanitize import sanitize_html

# A history row is metadata only. One selected revision may read one bounded
# notebook and return only the output attached to the selected card.
CELL_HISTORY_COMMITS = 25
CELL_HISTORY_BLOB_CAP = 64 * 1024 * 1024
CELL_HISTORY_OUTPUT_CAP = 12 * 1024 * 1024


def _github_web_url(remote: str) -> str:
    """git remote -> the repo's web URL (GitHub only; '' otherwise)."""
    m = re.match(r"(?:git@github\.com:|https?://github\.com/)"
                 r"([^/\s]+/[^/\s]+?)(?:\.git)?/?$", (remote or "").strip())
    return f"https://github.com/{m.group(1)}" if m else ""


def _git_run(f: Path, *args) -> subprocess.CompletedProcess:
    # explicit utf-8: git speaks utf-8, but text=True alone would decode
    # with the locale (cp1252 on Windows) and a single curly quote or
    # emoji in a commit message would blow up the whole read
    return subprocess.run(["git", "-C", str(f.parent), *args],
                          capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=15)


@dataclass(frozen=True)
class _Repo:
    """What git said about one folder, and when that stops being true."""

    info: dict          # what _git_info returns
    top: str            # the work tree's root
    git_dir: str        # this work tree's own git dir (HEAD, index)
    common_dir: str     # the shared one (config)
    stamp: tuple        # _repo_stamp() when this was read


#: folder -> _Repo. A git process costs tens of milliseconds on Windows,
#: and every Lock, Info, Copy and note asked again for facts that change
#: only when HEAD moves to another branch or the config is edited -- so
#: they are kept until one of those two files changes.
_REPOS: dict[str, _Repo] = {}
#: (file, index stamp) -> its path in the repository
_REL_PATHS: dict[tuple, str] = {}


def _file_stamp(p: str) -> tuple[int, int] | None:
    try:
        st = os.stat(p)
    except OSError:
        return None
    return (st.st_mtime_ns, st.st_size)


def _repo_stamp(git_dir: str, common_dir: str, folder: str = "",
                top: str = "") -> tuple:
    return (_file_stamp(os.path.join(git_dir, "HEAD")),
            _file_stamp(os.path.join(common_dir, "config")),
            _nested(folder, top))


def _nested(folder: str, top: str) -> tuple[bool, ...]:
    """Which folders between ``folder`` and its work tree's top hold a
    ``.git`` of their own. A ``git init`` (or a clone moved in) below the
    top makes the notebook another repository's, and neither HEAD nor
    the config of the one it was in changes when that happens."""
    if not folder or not top:
        return ()
    out = []
    p, stop = Path(folder), Path(top)
    while p != stop and p != p.parent:
        out.append(os.path.exists(os.path.join(p, ".git")))
        p = p.parent
    return tuple(out)


def _repo(f: Path) -> _Repo | None:
    """The repository holding ``f``'s folder, or None outside one.

    A miss reads what the old three separate calls did (inside a work
    tree? the remote, the branch) and is kept only while HEAD and the
    config are the files it was read from. Not kept: an answer with no
    branch (an unborn HEAD gains one at the first commit without HEAD
    itself changing), or "not a repository" (a ``git init`` must count
    at once).
    """
    key = str(f.parent)
    held = _REPOS.get(key)
    if held is not None and held.stamp == _repo_stamp(
            held.git_dir, held.common_dir, key, held.top):
        return held
    r = _git_run(f, "rev-parse", "--is-inside-work-tree", "--show-toplevel",
                 "--absolute-git-dir", "--git-common-dir")
    lines = [ln.strip() for ln in r.stdout.splitlines()]
    if r.returncode != 0 or len(lines) < 4 or lines[0] != "true":
        _REPOS.pop(key, None)
        return None
    top, git_dir, common = lines[1], lines[2], lines[3]
    if not os.path.isabs(common):           # relative to the folder
        common = os.path.normpath(os.path.join(key, common))
    stamp = _repo_stamp(git_dir, common, key, top)
    rem = _git_run(f, "config", "--get", "remote.origin.url")
    remote = rem.stdout.strip() if rem.returncode == 0 else ""
    br = _git_run(f, "rev-parse", "--abbrev-ref", "HEAD")
    branch = br.stdout.strip() if br.returncode == 0 else ""
    repo = _Repo({"repo": True, "remote": remote, "branch": branch,
                  "github": _github_web_url(remote)},
                 top, git_dir, common, stamp)
    # kept only with something to check it against: a branch (see above)
    # and a real git dir -- a git too old for --absolute-git-dir echoes
    # the option back instead, and would then never see HEAD move
    if branch and os.path.isabs(git_dir):
        _REPOS[key] = repo
    else:
        _REPOS.pop(key, None)
    return repo


def _git_info(f: Path) -> dict:
    """Is this file inside a git work tree, and where does it push to?"""
    try:
        repo = _repo(f)
    except Exception:
        return {"repo": False}
    # a copy: callers add to it ("rel", "commit") before sending it on
    return dict(repo.info) if repo is not None else {"repo": False}


def _git_rel_path(f: Path) -> str:
    """The file's path inside its repository, as GitHub shows it; '' when
    git does not track it (an untracked file has no page to link to).

    Kept per state of the index -- which is what ``ls-files`` reads, and
    which every ``git add`` rewrites -- so the answer is asked of git
    once, not on every hover over Copy."""
    try:
        repo = _repo(f)
        key = None
        if repo is not None:
            key = (str(f), _file_stamp(os.path.join(repo.git_dir, "index")))
            if key in _REL_PATHS:
                return _REL_PATHS[key]
        # -z: the name exactly, never C-quoted (non-ASCII came back as
        # "An\303\241lisis"); :(literal): "fig[1].ipynb" is a name, not a
        # glob that matches fig1.ipynb
        r = _git_run(f, "ls-files", "-z", "--full-name", "--",
                     ":(literal)" + f.name)
        rel = r.stdout.split("\0") if r.returncode == 0 else []
        out = rel[0] if rel and rel[0] else ""
        if key is not None and r.returncode == 0:
            if len(_REL_PATHS) > 256:
                _REL_PATHS.clear()
            _REL_PATHS[key] = out
        return out
    except Exception:
        return ""


def _git_file_log(f: Path, n: int = 25) -> list:
    """Commits touching this notebook: [{id, msg, date, path}], newest
    first. --name-only records the file's path AT EACH COMMIT, so commits
    from before a rename stay openable."""
    try:
        r = _git_run(f, "log", "--follow", "--name-only", "-n", str(n),
                     "--format=%h%x1f%s%x1f%ad",
                     # ASCII on the wire, the separator added below.
                     # Git on Windows takes the command line through the
                     # ANSI codepage, so a "·" in the format string came
                     # back as a replacement char and rode into the deck's
                     # saved lockver.date (seen 2026-09-05).
                     "--date=format:%d %b %Y @ %H:%M", "--", str(f))
        if r.returncode != 0:
            return []
        out: list = []
        for line in r.stdout.splitlines():
            if "\x1f" in line:
                parts = line.split("\x1f")
                # a literal 0x1f in the subject shifts fields: the date is
                # always the LAST part, the message everything between
                out.append({"id": parts[0],
                            "msg": "\x1f".join(parts[1:-1]),
                            "date": (parts[-1].replace(" @ ", " · ")
                                     if len(parts) > 2 else ""),
                            "path": ""})
            elif line.strip() and out and not out[-1]["path"]:
                out[-1]["path"] = line.strip()
        return out
    except Exception:
        return []


def _git_show_bytes(f: Path, commit: str,
                    max_bytes: int | None = None,
                    log: list | None = None) -> bytes:
    """The file's BYTES as they were at COMMIT (git show hash:relpath).
    Bytes all the way down since T113: a .xlsx commit is a ZIP, and
    decoding it would destroy it. Text callers decode on top.

    ``log``: the file's history when the caller has already read it, so
    one request runs ``git log`` once rather than once per helper."""
    repo = _repo(f)
    if repo is None:
        raise ValueError("not in a git repository")
    rel = f.resolve().relative_to(Path(repo.top).resolve()).as_posix()
    # a renamed notebook lived under a DIFFERENT path in old commits —
    # use the path git recorded for that commit when we have it
    for e in (_git_file_log(f, 100) if log is None else log):
        if e["id"] == commit and e.get("path"):
            rel = e["path"]
            break
    if max_bytes is not None:
        size = _git_run(f, "cat-file", "-s", f"{commit}:{rel}")
        if size.returncode != 0:
            raise FileNotFoundError("commit not found")
        if int(size.stdout.strip()) > max_bytes:
            raise ValueError("that notebook version is too large to preview")
    r = subprocess.run(
        ["git", "-C", str(f.parent), "show", f"{commit}:{rel}"],
        capture_output=True, timeout=20)
    if r.returncode != 0:
        raise FileNotFoundError(
            r.stderr.decode("utf-8", "replace").strip()[:200]
            or "commit not found")
    if max_bytes is not None and len(r.stdout) > max_bytes:
        raise ValueError("that notebook version is too large to preview")
    return r.stdout


def _git_show_text(f: Path, commit: str,
                   max_bytes: int | None = None,
                   log: list | None = None) -> str:
    """That commit's file as text — split from _git_show_notebook at
    T124, rebased on bytes at T113."""
    return _git_show_bytes(f, commit, max_bytes, log).decode("utf-8")


def _git_show_notebook(f: Path, commit: str,
                       max_bytes: int | None = None,
                       log: list | None = None) -> dict:
    """That commit's file parsed as notebook JSON, for the routes that
    need CELLS (locked deck frames, cell history) rather than a document."""
    nb = json.loads(_git_show_text(f, commit, max_bytes, log))
    if (not isinstance(nb, dict) or not isinstance(nb.get("cells"), list)):
        raise ValueError("that commit's file is not a notebook")
    return nb


#: (file, commit) -> (cards by anchor, that commit's log entry). A commit
#: never changes, so what a locked frame shows from it is read once.
_VERSION_ITEMS: OrderedDict = OrderedDict()
_VERSION_LOCK = threading.Lock()     # the server answers on many threads


def _git_version_items(f: Path, commit: str) -> tuple[dict, dict]:
    """The cards of ``f`` as it was at ``commit``, keyed by anchor, and
    the commit's log entry ({} when it is not among the last 100).

    For locked deck frames, which ask per slide as slides are shown: the
    parse (no raw view -- a frame shows cards) and the git reads happen
    once per version, not once per request.
    """
    key = (str(f.resolve()), commit)
    with _VERSION_LOCK:
        held = _VERSION_ITEMS.get(key)
        if held is not None:
            _VERSION_ITEMS.move_to_end(key)
            return held
    log = _git_file_log(f, 100)
    doc = parse_notebook(_git_show_notebook(f, commit, log=log),
                         render_raw=False)
    by_anchor = {}
    for sec in doc.sections:
        for it in sec.items:
            by_anchor[it.anchor or it.item_id] = it
    meta: dict = next((e for e in log if e["id"] == commit), {})
    with _VERSION_LOCK:
        _VERSION_ITEMS[key] = (by_anchor, meta)
        while len(_VERSION_ITEMS) > 8:
            _VERSION_ITEMS.popitem(last=False)
    return by_anchor, meta


def _output_stub(out: dict) -> dict:
    """Retain output *type* for parser anchor choice, never its payload."""
    kind = out.get("output_type")
    if kind == "stream":
        return {"output_type": kind,
                "text": "x" if as_text(out.get("text", "")).strip() else ""}
    if kind == "error":
        return {"output_type": kind, "traceback": []}
    data = out.get("data", {})
    if not isinstance(data, dict):
        return {"output_type": kind, "data": {}}
    stub: dict = {}
    for mime, value in data.items():
        if mime == "text/html":
            # The short marker keeps xarray/interactive HTML classified the
            # same way as its full payload, without copying it into markup.
            value = as_text(value)
            lower = value.lower()
            if "xr-" in value or "xarray" in lower:
                stub[mime] = '<div class="xr-stub"></div>'
            elif 'class="dataframe"' in value or "class='dataframe'" in value:
                stub[mime] = '<table class="dataframe"></table>'
            elif any(x in lower for x in (
                    "<script", "<iframe", "plotly-graph-div", "bk-root",
                    "bokehjs", "js-plotly-plot", "vega-embed", "vega-lite",
                    "folium-map",
                    "leaflet-container", "require(")):
                stub[mime] = "<script></script>"
            else:
                stub[mime] = "<div></div>"
        elif mime == "application/vnd.plotly.v1+json":
            stub[mime] = {}
        elif mime == "text/plain":
            stub[mime] = "x" if as_text(value).strip() else ""
        else:
            stub[mime] = ""
    return {"output_type": kind, "data": stub}


def _light_document(nb: dict) -> Document:
    """Use the real parser's group/stack/primary rules with tiny outputs."""
    cells = []
    for cell in nb["cells"]:
        if not isinstance(cell, dict):
            continue
        copy = dict(cell)
        if cell.get("cell_type") == "code":
            copy["outputs"] = [
                _output_stub(out) for out in cell.get("outputs", [])
                if isinstance(out, dict)]
        cells.append(copy)
    # Saved decks in notebook metadata can also carry images. The cell
    # parser needs no deck metadata to decide a card's anchor.
    return parse_notebook({"cells": cells, "metadata": {}}, render_raw=False)


def _card_items(doc: Document) -> list[Item]:
    return [item for section in doc.sections for item in section.items
            if item.members or item.is_note]


def _primary_member(item: Item) -> dict:
    return next(m for m in item.members if m["outputs"] is item.outputs)


def _card_for_history(now: Document, then: Document,
                      anchor: str) -> tuple[Item | None, str]:
    current = next((it for it in _card_items(now) if it.anchor == anchor),
                   None)
    old_items = _card_items(then)
    if current is not None and current.is_note:
        notes = [it for it in old_items if it.is_note]
        if anchor.startswith("cell:"):
            exact = next((it for it in notes if it.anchor == anchor), None)
            if exact:
                return exact, "id"
        same = [it for it in notes if it.caption == current.caption
                and it.title == current.title]
        if len(same) == 1:
            return same[0], "source"
        if anchor.startswith("cell:"):
            return None, ""
        positional = next((it for it in notes
                           if it.note_index == current.note_index), None)
        return positional, "position" if positional else ""
    positional_anchor = bool(re.fullmatch(r"cell:p\d+", anchor))
    if current is not None and positional_anchor:
        positional_anchor = not bool(_primary_member(current).get("cell_id"))
    if not positional_anchor:
        exact = next((it for it in old_items if it.anchor == anchor), None)
        if exact:
            return exact, "id"
    if current is not None:
        primary = _primary_member(current)
        cid = primary.get("cell_id")
        if cid:
            by_id = next((it for it in old_items if any(
                m.get("cell_id") == cid for m in it.members)), None)
            if by_id:
                return by_id, "id"
        code = primary.get("code", "").strip()
        if code:
            same = [it for it in old_items if any(
                m.get("code", "").strip() == code for m in it.members)]
            if len(same) == 1:
                return same[0], "source"
        # A durable id disappearing is stronger evidence that this card did
        # not exist yet than a neighbouring cell at the same position.
        if not positional_anchor:
            return None, ""
        idx = primary["idx"]
    else:
        m = re.fullmatch(r"cell:p(\d+)", anchor)
        if not m:
            return None, ""
        idx = int(m.group(1))
    positional = next((it for it in old_items if any(
        m["idx"] == idx for m in it.members)), None)
    return positional, "position" if positional else ""


def _history_output_html(output: dict) -> str:
    """History is a preview, not a trusted live notebook output.

    Keep the renderer's safe image/text/Plotly forms, but allowlist arbitrary
    HTML. SVG is an inert image URL here, never inline document markup.
    """
    data = output.get("data", {})
    if not isinstance(data, dict):
        data = {}
    if ("image/svg+xml" in data and not any(mime in data for mime in (
            "application/vnd.plotly.v1+json", "video/mp4", "video/webm",
            "video/ogg", "image/png", "image/gif", "image/jpeg"))):
        svg = as_text(data["image/svg+xml"]).encode("utf-8")
        encoded = base64.b64encode(svg).decode("ascii")
        return ('<div class="figframe"><img alt="SVG output" '
                f'src="data:image/svg+xml;base64,{encoded}"></div>')
    blocks: list[str] = []
    for rendered in render_outputs([output]):
        safe = rendered.kind in ("image", "video", "text", "error")
        safe = safe or (rendered.kind == "plotly" and
                        "application/vnd.plotly.v1+json" in data)
        blocks.append(rendered.payload if safe else
                      sanitize_html(rendered.payload))
    return "".join(blocks)


def _git_cell_version(f: Path, commit: str, anchor: str,
                      log: list | None = None) -> dict:
    """One old card's stored outputs; no outputs from other notebook cells.

    ``log``: the history the caller already checked ``commit`` against."""
    if f.stat().st_size > CELL_HISTORY_BLOB_CAP:
        raise ValueError("this notebook is too large for cell history")
    with f.open("rb") as stream:
        raw_blob = stream.read(CELL_HISTORY_BLOB_CAP + 1)
    if len(raw_blob) > CELL_HISTORY_BLOB_CAP:
        raise ValueError("this notebook is too large for cell history")
    current = json.loads(raw_blob.decode("utf-8"))
    if (not isinstance(current, dict)
            or not isinstance(current.get("cells"), list)):
        raise ValueError("the current file is not a notebook")
    old = _git_show_notebook(f, commit, CELL_HISTORY_BLOB_CAP, log)
    item, match = _card_for_history(_light_document(current),
                                    _light_document(old), anchor)
    if item is None:
        return {"commit": commit, "found": False, "status": "absent",
                "match": "", "html": "", "source": "", "title": ""}
    if item.is_note:
        markup = '<div class="note">' + md_to_html(item.caption) + '</div>'
        if len(markup.encode("utf-8")) > CELL_HISTORY_OUTPUT_CAP:
            return {"commit": commit, "found": True, "status": "too-large",
                    "match": match, "html": "", "source": "", "title": item.title,
                    "index": item.note_index, "kind": "note"}
        return {"commit": commit, "found": True,
                "status": "matched-" + match, "match": match,
                "html": markup, "source": item.caption[:400],
                "title": item.title, "index": item.note_index, "kind": "note"}
    primary = _primary_member(item)
    ordered_members = sorted(item.members,
                             key=lambda m: (m["order"], m["idx"]))
    indices = [m["idx"] for m in ordered_members]
    # The parser's `stack:` steps are not members; include only the
    # specifically referenced cells, in the same order as the card.
    by_id: dict[str, int] = {}
    for i, cell in enumerate(old["cells"]):
        if isinstance(cell, dict) and cell.get("cell_type") == "code":
            src = as_text(cell.get("source", ""))
            directives, _ = split_directives(src)
            if directives.get("id"):
                by_id.setdefault(directives["id"], i)
    stacked: list[int] = []
    for member in ordered_members:
        for sid in member["d"].get("stack", "").split(","):
            index = by_id.get(sid.strip())
            if index is not None and index not in indices + stacked:
                stacked.append(index)
    indices = stacked + indices
    total = 0
    blocks: list[str] = []
    for i in indices:
        cell = old["cells"][i]
        outputs = cell.get("outputs", [])
        if not isinstance(outputs, list):
            continue
        serialized = json.dumps(outputs, ensure_ascii=False)
        total += len(serialized.encode("utf-8"))
        if total > CELL_HISTORY_OUTPUT_CAP:
            return {"commit": commit, "found": True, "status": "too-large",
                    "match": match, "html": "", "source": "", "title": item.title,
                    "index": primary["idx"], "kind": item.kind}
        blocks.extend(_history_output_html(output) for output in outputs)
    markup = "".join(blocks)
    if len(markup.encode("utf-8")) > CELL_HISTORY_OUTPUT_CAP:
        return {"commit": commit, "found": True, "status": "too-large",
                "match": match, "html": "", "source": "", "title": item.title,
                "index": primary["idx"], "kind": item.kind}
    return {"commit": commit, "found": True,
            "status": "matched-" + match if markup else "no-output",
            "match": match, "html": markup,
            "source": primary.get("code", "")[:400],
            "title": item.title, "index": primary["idx"],
            "kind": item.kind}


def _git_commit_file(f: Path, message: str) -> dict:
    """Stage + commit ONE file; returns {ok, sha, url} or {ok, error}."""
    try:
        add = _git_run(f, "add", "--", str(f))
        if add.returncode != 0:
            return {"ok": False,
                    "error": (add.stderr or add.stdout).strip()[:400]}
        com = _git_run(f, "commit", "-m", message, "--", str(f))
        if com.returncode != 0:
            return {"ok": False,
                    "error": (com.stdout + com.stderr).strip()[:400]}
        sha = _git_run(f, "rev-parse", "--short", "HEAD").stdout.strip()
        gh = _git_info(f).get("github") or ""
        return {"ok": True, "sha": sha,
                "url": f"{gh}/commit/{sha}" if gh else ""}
    except Exception as e:                  # noqa: BLE001 -- surfaced in UI
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
