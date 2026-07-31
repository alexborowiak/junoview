"""Optional git awareness for the file panel.

Shows which commit a notebook is at, its recent history, and can commit a note
back. Every call degrades quietly when the file is not in a repository, or when
git is not installed at all.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


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


def _git_info(f: Path) -> dict:
    """Is this file inside a git work tree, and where does it push to?"""
    try:
        top = _git_run(f, "rev-parse", "--is-inside-work-tree")
        if top.returncode != 0 or top.stdout.strip() != "true":
            return {"repo": False}
        rem = _git_run(f, "config", "--get", "remote.origin.url")
        remote = rem.stdout.strip() if rem.returncode == 0 else ""
        br = _git_run(f, "rev-parse", "--abbrev-ref", "HEAD")
        branch = br.stdout.strip() if br.returncode == 0 else ""
        return {"repo": True, "remote": remote, "branch": branch,
                "github": _github_web_url(remote)}
    except Exception:
        return {"repo": False}


def _git_file_log(f: Path, n: int = 25) -> list:
    """Commits touching this notebook: [{id, msg, date, path}], newest
    first. --name-only records the file's path AT EACH COMMIT, so commits
    from before a rename stay openable."""
    try:
        r = _git_run(f, "log", "--follow", "--name-only", "-n", str(n),
                     "--format=%h%x1f%s%x1f%ad",
                     "--date=format:%d %b %Y · %H:%M", "--", str(f))
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
                            "date": parts[-1] if len(parts) > 2 else "",
                            "path": ""})
            elif line.strip() and out and not out[-1]["path"]:
                out[-1]["path"] = line.strip()
        return out
    except Exception:
        return []


def _git_show_notebook(f: Path, commit: str) -> dict:
    """The notebook's JSON as it was at COMMIT (git show hash:relpath).
    Bytes + explicit utf-8 — text mode would decode with the locale."""
    top = _git_run(f, "rev-parse", "--show-toplevel")
    if top.returncode != 0:
        raise ValueError("not in a git repository")
    rel = f.resolve().relative_to(
        Path(top.stdout.strip()).resolve()).as_posix()
    # a renamed notebook lived under a DIFFERENT path in old commits —
    # use the path git recorded for that commit when we have it
    for e in _git_file_log(f, 100):
        if e["id"] == commit and e.get("path"):
            rel = e["path"]
            break
    r = subprocess.run(
        ["git", "-C", str(f.parent), "show", f"{commit}:{rel}"],
        capture_output=True, timeout=20)
    if r.returncode != 0:
        raise FileNotFoundError(
            r.stderr.decode("utf-8", "replace").strip()[:200]
            or "commit not found")
    nb = json.loads(r.stdout.decode("utf-8"))
    if not isinstance(nb, dict) or "cells" not in nb:
        raise ValueError("that commit's file is not a notebook")
    return nb


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
