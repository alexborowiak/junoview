"""Which build of Junoview this is: the stamp on Home (T621).

The package version alone says almost nothing -- it has been 0.2.0 for
months -- so the stamp also carries the package's own git history: the
newest commit that changed ``src/junoview``, its short hash and date
(the "last updated" the stamp's tooltip gives), and as the build number
how many commits there are up to and including it, which only goes up.

Measuring from the PACKAGE's last commit rather than HEAD keeps a web
build deterministic: a docs/ rebuild, a test-only commit or a TASKS.md
edit leaves the stamp where it was, so the committed docs/ only changes
when the app does. (The count is of the whole history up to that commit,
not of the package's own commits: ``rev-list --count HEAD -- .`` took
13 seconds on a OneDrive checkout, where this takes a tenth of one.)

A copy with no git (an installed wheel, the browser's own Pyodide
package) has none of this, and the stamp is the version alone.

Only the app server and the web build show it. A rendered notebook is
a file someone keeps, and the build that wrote it is not its business --
nor may it change the bytes test_characterization pins.
"""

from __future__ import annotations

import datetime as _dt
import functools
import html
import subprocess
from pathlib import Path

_PKG = Path(__file__).resolve().parent


def _git(*args: str) -> str:
    r = subprocess.run(["git", "-C", str(_PKG), *args], capture_output=True,
                       text=True, timeout=10, check=False)
    if r.returncode:
        raise OSError(r.stderr.strip() or f"git {args[0]} failed")
    return r.stdout.strip()


@functools.lru_cache(maxsize=1)
def build_info() -> dict[str, str]:
    """``version``, and ``build``/``commit``/``date`` when git knows them.

    ``modified`` is present when the package has changes git has not
    committed, which is the local app running a working copy.
    """
    from . import __version__
    info = {"version": __version__}
    try:
        line = _git("log", "-1", "--format=%H %h %cI", "--", ".")
        parts = line.split()
        if len(parts) != 3:
            return info
        full, commit, date = parts
        count = _git("rev-list", "--count", full)
        dirty = _git("status", "--porcelain", "--", ".")
    # NotImplementedError: no processes at all (Pyodide)
    except (OSError, subprocess.SubprocessError, NotImplementedError):
        return info
    if not count.isdigit() or count == "0":
        return info
    info.update(build=count, commit=commit, date=date)
    if dirty:
        info["modified"] = "1"
    return info


@functools.lru_cache(maxsize=1)
def build_badge() -> str:
    """The stamp beside the wordmark on Home, as HTML."""
    info = build_info()
    label = f"v{info['version']}"
    if "build" in info:
        label += f" · build {info['build']}"
    if "date" in info:
        try:
            when = _dt.datetime.fromisoformat(info["date"])
            stamp = f"{when.day} {when:%b %Y} at {when:%H:%M}"
        except ValueError:
            stamp = info["date"]
        tip = f"Last updated {stamp} (commit {info['commit']}"
        tip += (", with changes not yet committed)" if "modified" in info
                else ")")
    else:
        tip = ("This copy has no git history, so there is no date to "
               "show")
    return (f'<span class="welcome-ver" title="{html.escape(tip)}">'
            f"{html.escape(label)}</span>")
