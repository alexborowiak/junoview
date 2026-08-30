"""The scratch cleaner and .gitignore have to agree.

``tools/clean_scratch.py`` deletes directories recursively, and its
docstring promises "this only ever removes untracked files". Nothing
enforced that promise: the two lists were maintained by hand, in
different files, and drifted apart in both directions at once.

The browser-driving recipe in CLAUDE.md moved to ``.browser-check/`` with
profiles named ``edge-profile-<task>/``, while both lists still knew only
the older repo-root ``edgeprof*/``. So ``git status`` grew a permanent
untracked entry, and the cleaner reported 9.5 MB while 3.8 GB sat beside
it -- on a OneDrive checkout, which syncs it (T99).

The invariant below is the one that makes the promise true: every pattern
the cleaner will delete must be a pattern git already ignores. It also
catches the opposite drift, which is the dangerous direction -- a cleaner
pattern nobody added to .gitignore would delete tracked files.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def _cleaner():
    """Import tools/clean_scratch.py, which is a script, not a module."""
    path = REPO / "tools" / "clean_scratch.py"
    spec = importlib.util.spec_from_file_location("clean_scratch", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _ignored() -> set[str]:
    """The .gitignore entries, with any trailing directory slash dropped."""
    lines = (REPO / ".gitignore").read_text(encoding="utf-8").splitlines()
    return {ln.strip().rstrip("/") for ln in lines
            if ln.strip() and not ln.lstrip().startswith("#")}


def test_the_cleaner_only_deletes_what_git_already_ignores():
    """Anything ``clean_scratch --yes`` removes must be gitignored.

    A pattern present here and absent from .gitignore is a script that
    deletes tracked files, which is the failure worth a test.
    """
    cleaner = _cleaner()
    ignored = _ignored()
    patterns = list(cleaner.DIR_PATTERNS) + list(cleaner.FILE_PATTERNS)
    unignored = sorted(p for p in patterns if p.rstrip("/") not in ignored)
    assert not unignored, (
        "tools/clean_scratch.py would delete these, and .gitignore does "
        f"not ignore them, so they may be tracked: {unignored}")


def test_the_browser_scratch_directory_is_covered_by_both():
    """The specific regression, named, so a failure says what broke.

    ``.browser-check/`` is where the CDP recipe in CLAUDE.md works. It
    was in neither list and reached 3.8 GB.
    """
    cleaner = _cleaner()
    assert ".browser-check" in cleaner.DIR_PATTERNS
    assert ".browser-check" in _ignored()


def test_every_browser_profile_naming_scheme_is_known():
    """Both generations of profile directory, in both files.

    The old runs left ``edgeprof<n>/`` in the repo root; the current
    recipe leaves ``edge-profile-<task>/``. Dropping the old names would
    orphan whatever is still on an existing checkout.
    """
    cleaner = _cleaner()
    ignored = _ignored()
    for pattern in ("edgeprof*", "chromeprof*",
                    "edge-profile*", "chrome-profile*"):
        assert pattern in cleaner.DIR_PATTERNS, pattern
        assert pattern in ignored, pattern


def test_the_cleaner_finds_nested_scratch_and_collapses_it(tmp_path):
    """A nested match inside a doomed directory is not listed twice.

    This is why naming the container is enough: ``.browser-check/`` holds
    ``edge-profile-*/`` directories, each holding ``__pycache__``, and
    reporting all three would say "3 items" for one deletion.
    """
    cleaner = _cleaner()
    root = tmp_path / "repo"
    (root / ".browser-check" / "edge-profile-t1" / "__pycache__").mkdir(
        parents=True)
    (root / ".browser-check" / "edge-profile-t1" / "__pycache__"
     / "x.pyc").write_bytes(b"x")
    (root / "scratch_a.html").write_text("hi", encoding="utf-8")

    original = cleaner.REPO
    try:
        cleaner.REPO = root
        found = cleaner._targets()
    finally:
        cleaner.REPO = original

    names = sorted(p.relative_to(root).as_posix() for p in found)
    assert names == [".browser-check", "scratch_a.html"], names
