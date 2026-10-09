"""Git is asked once for what does not change, and never for stale answers.

Every Lock, Info, Copy hover and note spawned three to five git processes
-- tens of milliseconds EACH on Windows -- for facts that only change when
HEAD moves or the config is edited, and a slide with three locked frames
made three requests that each read the same commit (2026-10-08). The
caches below are keyed on the files git itself would read, so a branch
switch, a new remote, a `git add` or a first commit is seen at once.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets
from junoview.server import vcs
from junoview.server.routes import _make_handler
from junoview.server.state import _AppState

pytestmark = pytest.mark.skipif(not shutil.which("git"),
                                reason="git is unavailable")


def _git(root: Path, *args: str) -> str:
    r = subprocess.run(["git", "-C", str(root), *args], capture_output=True,
                       text=True, encoding="utf-8", timeout=20)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


def _nb(tag: str) -> str:
    return json.dumps({"cells": [
        {"cell_type": "code", "id": "plot-cell", "metadata": {},
         "execution_count": 1, "source": "plot()", "outputs": [
             {"output_type": "display_data", "metadata": {},
              "data": {"image/png": tag}}]},
        {"cell_type": "code", "id": "other", "metadata": {},
         "execution_count": 2, "source": "other()", "outputs": [
             {"output_type": "display_data", "metadata": {},
              "data": {"image/png": "O" + tag}}]}],
        "metadata": {}, "nbformat": 4, "nbformat_minor": 5})


@pytest.fixture
def repo(tmp_path):
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "config", "user.name", "Git Cache Test")
    _git(tmp_path, "config", "user.email", "git-cache@test.invalid")
    _git(tmp_path, "remote", "add", "origin",
         "git@github.com:alice/first.git")
    f = tmp_path / "analysis.ipynb"
    f.write_text(_nb("ONE"), encoding="utf-8")
    _git(tmp_path, "add", "analysis.ipynb")
    _git(tmp_path, "commit", "-q", "-m", "one")
    vcs._REPOS.clear()
    vcs._REL_PATHS.clear()
    vcs._VERSION_ITEMS.clear()
    return f


@pytest.fixture
def spawns(monkeypatch):
    n = [0]
    real = subprocess.run

    def counting(*a, **kw):
        cmd = a[0] if a else kw.get("args")
        if cmd and cmd[0] == "git":
            n[0] += 1
        return real(*a, **kw)
    monkeypatch.setattr(vcs.subprocess, "run", counting)
    return n


def test_repo_facts_are_read_once_until_head_or_config_changes(repo,
                                                               spawns):
    first = vcs._git_info(repo)
    assert first["repo"] and first["github"] == "https://github.com/alice/first"
    n = spawns[0]
    again = vcs._git_info(repo)
    assert again == first and spawns[0] == n          # no git at all
    again["rel"] = "mutated by a caller"
    assert "rel" not in vcs._git_info(repo)           # handed out a copy
    _git(repo.parent, "checkout", "-q", "-b", "other")
    assert vcs._git_info(repo)["branch"] == "other"
    _git(repo.parent, "remote", "set-url", "origin",
         "https://github.com/bob/second")
    assert vcs._git_info(repo)["github"] == "https://github.com/bob/second"


def test_outside_a_repository_is_never_remembered(tmp_path):
    f = tmp_path / "loose.ipynb"
    f.write_text(_nb("X"), encoding="utf-8")
    vcs._REPOS.clear()
    assert vcs._git_info(f) == {"repo": False}
    _git(tmp_path, "init", "-q")                      # git init counts now
    assert vcs._git_info(f)["repo"] is True


def test_an_unborn_branch_is_asked_again_after_the_first_commit(tmp_path):
    _git(tmp_path, "init", "-q", "-b", "trunk")
    _git(tmp_path, "config", "user.name", "T")
    _git(tmp_path, "config", "user.email", "t@test.invalid")
    f = tmp_path / "a.ipynb"
    f.write_text(_nb("A"), encoding="utf-8")
    vcs._REPOS.clear()
    assert vcs._git_info(f)["branch"] == ""
    _git(tmp_path, "add", "a.ipynb")
    _git(tmp_path, "commit", "-q", "-m", "first")
    assert vcs._git_info(f)["branch"] == "trunk"


def test_the_repository_path_follows_the_index(tmp_path):
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "config", "user.name", "T")
    _git(tmp_path, "config", "user.email", "t@test.invalid")
    sub = tmp_path / "work"
    sub.mkdir()
    f = sub / "b.ipynb"
    f.write_text(_nb("B"), encoding="utf-8")
    (tmp_path / "seed.txt").write_text("x")
    _git(tmp_path, "add", "seed.txt")
    _git(tmp_path, "commit", "-q", "-m", "seed")
    vcs._REPOS.clear()
    vcs._REL_PATHS.clear()
    assert vcs._git_rel_path(f) == ""                 # untracked
    _git(tmp_path, "add", "work/b.ipynb")             # rewrites the index
    assert vcs._git_rel_path(f) == "work/b.ipynb"


def test_locked_frames_read_a_commit_once_and_show_the_same_cards(repo,
                                                                  spawns):
    old = _git(repo.parent, "rev-parse", "--short", "HEAD")
    repo.write_text(_nb("TWO"), encoding="utf-8")
    _git(repo.parent, "commit", "-q", "-am", "two")
    H = _make_handler(_AppState(repo.parent))
    h = H.__new__(H)
    body = {"path": str(repo), "commit": old,
            "anchors": ["cell:plot-cell", "cell:other", "cell:nope"]}
    first = h._version_cards(body)
    assert first["msg"] == "one" and first["date"]
    assert "ONE" in first["cards"]["cell:plot-cell"]["html"]
    assert "OONE" in first["cards"]["cell:other"]["html"]
    assert first["cards"]["cell:nope"] is None
    n = spawns[0]
    assert h._version_cards(body) == first and spawns[0] == n
    # one request per slide reads git log once, not once per helper
    vcs._VERSION_ITEMS.clear()
    n = spawns[0]
    h._version_cards(body)
    logs = spawns[0] - n
    assert logs <= 3, logs        # log + show (+ repo facts if stale)


def test_a_cell_version_reuses_the_history_it_was_checked_against(repo,
                                                                  spawns):
    old = _git(repo.parent, "rev-parse", "--short", "HEAD")
    repo.write_text(_nb("TWO"), encoding="utf-8")
    _git(repo.parent, "commit", "-q", "-am", "two")
    H = _make_handler(_AppState(repo.parent))
    h = H.__new__(H)
    vcs._git_info(repo)                                # repo facts known
    n = spawns[0]
    got = h._cell_version({"path": str(repo), "anchor": "cell:plot-cell",
                           "commit": old})
    assert "ONE" in got["html"] and "TWO" not in got["html"]
    # the checking log, cat-file -s, show: no second `git log`
    assert spawns[0] - n == 3


_VER_RUN = r"""
const asked = [];
const APP = {mode:'app'};
const verCards = {};
function lockParts(a){ return {stem:'nb', anchor:a.an, path:'/n.ipynb',
  key:'/n.ipynb@'+a.lockver.commit+'::'+a.an,
  pkey:'/n.ipynb@'+a.lockver.commit}; }
function fetchVerCards(path, commit, anchors){
  asked.push([path, commit, anchors.slice()]); }
__FNS__
(async () => {
  const frames = ['a','b','a','c'].map(an => ({an:an, lockver:{commit:'f00'}}));
  frames.push({an:'z', lockver:{commit:'bee'}});
  const got = frames.map(verCardFor);
  const before = asked.length;
  await Promise.resolve(); await Promise.resolve();
  verCards['/n.ipynb@f00::a'] = {html:'A'};
  const hit = verCardFor({an:'a', lockver:{commit:'f00'}});
  console.log(JSON.stringify({got:got, before:before, asked:asked, hit:hit,
    unlocked: verCardFor({an:'q'})}));
})();
"""


def test_a_slides_locked_frames_are_fetched_in_one_request():
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    src = assets.deck_js()
    body = lift_fn(src, "verCardFor")
    i = src.index("  var verAsk={};")
    fns = "var verAsk={};\n" + body
    assert src[i:i + 200].find("function verCardFor(a){") > 0
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_VER_RUN.replace("__FNS__", fns), encoding="utf-8")
        cmd, env = eng
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr
    out = json.loads(r.stdout.strip().splitlines()[-1])
    assert out["got"] == [None] * 5 or out["got"] == []  # undefined -> null
    assert out["before"] == 0          # nothing asked mid-render
    assert sorted(map(tuple, (tuple(x[:2]) + (tuple(x[2]),)
                              for x in out["asked"]))) == [
        ("/n.ipynb", "bee", ("z",)),
        ("/n.ipynb", "f00", ("a", "b", "c"))]
    assert out["hit"] == {"html": "A"}
    assert out["unlocked"] is None
