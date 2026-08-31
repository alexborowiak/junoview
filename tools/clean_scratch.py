"""Delete scratch left behind by test runs and builds.

Headless-browser runs create a throwaway profile directory each, plus the
multi-megabyte page renders they were driving. They accumulate in the repo
root and in `.browser-check/` -- gigabytes and several hundred folders after
a busy week, which on a OneDrive checkout is also sync traffic. They are
gitignored, so this only ever removes untracked files.

Keep the patterns below in step with .gitignore. A profile directory that
one of them knows about and the other does not is invisible to whichever
you happen to ask; tests/test_repo_hygiene.py holds them together.

    python tools/clean_scratch.py          # show what would go
    python tools/clean_scratch.py --yes    # actually delete
"""

from __future__ import annotations

import argparse
import os
import shutil
import stat
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Two generations of browser scratch. The older runs dropped
# `edgeprof<n>/` in the repo root; the CDP recipe in CLAUDE.md puts
# `edge-profile-<task>/` and its page renders inside `.browser-check/`.
# Only the first was listed, so this tool reported ~10 MB while 3.8 GB
# sat beside it (T99). The container is enough: the redundancy filter
# below drops anything nested inside an already-doomed directory.
DIR_PATTERNS = [".browser-check", "edgeprof*", "chromeprof*",
                "edge-profile*", "chrome-profile*", "__pycache__",
                ".pytest_cache", ".ruff_cache", "*.egg-info"]
FILE_PATTERNS = ["scratch_*.html", "*_spliced.html"]


def _targets() -> list[Path]:
    found: list[Path] = []
    for pattern in DIR_PATTERNS:
        found += [p for p in REPO.glob(pattern) if p.is_dir()]
        found += [p for p in REPO.glob(f"**/{pattern}") if p.is_dir()]
    for pattern in FILE_PATTERNS:
        found += [p for p in REPO.glob(pattern) if p.is_file()]
    # A nested match inside an already-doomed directory is redundant.
    tops = [p for p in found if p.is_dir()]
    return sorted({p for p in found
                   if not any(t != p and t in p.parents for t in tops)})


def _size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def _force(func, path, _exc):
    """Clear the read-only bit and try again.

    Browser profiles and tool caches arrive read-only often enough that
    a plain rmtree gives WinError 5 and stops -- which on 2026-08-31
    left 3.3 GB of the 4 GB it had just offered to delete, reporting
    only a line on stderr. Anything still unremovable after this really
    is held by a process, and is re-raised.
    """
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _remove(path: Path) -> None:
    if not path.is_dir():
        path.chmod(stat.S_IWRITE)
        path.unlink()
        return
    # onexc is 3.12+; onerror is what 3.10 and 3.11 have, and it still
    # works (deprecated) after that. pyproject allows 3.10.
    if sys.version_info >= (3, 12):
        shutil.rmtree(path, onexc=_force)
    else:
        shutil.rmtree(path, onerror=_force)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--yes", action="store_true",
                    help="delete, rather than just listing")
    args = ap.parse_args()

    targets = _targets()
    if not targets:
        print("nothing to clean")
        return 0

    total = 0
    for path in targets:
        n = _size(path)
        total += n
        print(f"  {n / 1e6:>8.1f} MB  {path.relative_to(REPO)}")

    print(f"\n{len(targets)} item(s), {total / 1e6:.1f} MB")
    if not args.yes:
        print("dry run -- pass --yes to delete")
        return 0

    failed = 0
    for path in targets:
        try:
            _remove(path)
        except OSError as exc:
            failed += 1
            print(f"could not remove {path}: {exc}", file=sys.stderr)
    print("cleaned" if not failed
          else f"cleaned, {failed} item(s) left -- see above")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
