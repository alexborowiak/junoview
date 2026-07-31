"""Delete scratch left behind by test runs and builds.

Headless-browser tests create a throwaway profile directory per run, and those
accumulate in the repo root -- a few hundred megabytes and several hundred
folders after a busy week. They are gitignored, so this only ever removes
untracked files.

    python tools/clean_scratch.py          # show what would go
    python tools/clean_scratch.py --yes    # actually delete
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

DIR_PATTERNS = ["edgeprof*", "chromeprof*", "__pycache__",
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

    for path in targets:
        try:
            shutil.rmtree(path) if path.is_dir() else path.unlink()
        except OSError as exc:
            print(f"could not remove {path}: {exc}", file=sys.stderr)
    print("cleaned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
