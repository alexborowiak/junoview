"""Exports the local app writes to disk itself (T600).

The user, 2026-09-30, with a screenshot of PowerPoint refusing edits: "when
downloading a junoview as pptx for some reason it is downloaded in
protected view."

Nothing is wrong with the file. Windows marks everything a web browser
downloads as coming from the internet -- the Zone.Identifier stream it calls
the Mark of the Web -- and PowerPoint opens every file so marked read-only,
in Protected View, until Enable Editing is pressed. A page cannot download a
file without that mark, whatever it writes into the file.

The local app does not need the browser to download anything: the page sends
the bytes it built, and the server writes them into the Downloads folder the
way any desktop program writes a file -- with no mark, so PowerPoint opens it
ready to edit -- and can then open it, or show it in its folder. The server
already writes the project file; this is the same power, held to one
suffix, one folder and files it wrote itself.
"""

from __future__ import annotations

import base64
import os
import re
import subprocess
import sys
from pathlib import Path

#: What may be written. A .pptx only: this route exists for the one file
#: PowerPoint treats differently when a browser downloaded it, and a route
#: that wrote any suffix could put a script where a double-click runs it.
EXPORT_SUFFIXES = (".pptx",)

#: Big enough for a deck full of pictures, small enough that a stray
#: request cannot fill a disk.
EXPORT_CAP = 256 * 1024 * 1024

_UNSAFE = re.compile(r'[\\/:*?"<>|\x00-\x1f]+')


def export_folder() -> Path:
    """Where a browser would have put it: the Downloads folder, else home."""
    downloads = Path.home() / "Downloads"
    return downloads if downloads.is_dir() else Path.home()


def export_name(stem: str, suffix: str) -> str:
    """A file name from a presentation's name: nothing a path could use to
    climb out of the folder, no trailing dots or spaces Windows would
    strip, and never empty."""
    s = _UNSAFE.sub("-", str(stem or ""))
    s = re.sub(r"\s+", " ", s).strip(" .-")[:120].strip(" .-")
    return (s or "presentation") + suffix


def free_path(folder: Path, name: str) -> Path:
    """``name`` in ``folder``, or ``name (2)``, ``name (3)``... -- an export
    never replaces a file that is already there, which may be open in
    PowerPoint or be last week's copy."""
    first = folder / name
    if not first.exists():
        return first
    stem, suffix = first.stem, first.suffix
    for n in range(2, 1000):
        candidate = folder / f"{stem} ({n}){suffix}"
        if not candidate.exists():
            return candidate
    raise FileExistsError(f"no free name for {name} in {folder}")


def write_export(folder: Path, name: str, b64: str) -> Path:
    """Write an export the page built. Returns where it went."""
    suffix = Path(str(name or "")).suffix.lower()
    if suffix not in EXPORT_SUFFIXES:
        raise ValueError(f"{name or 'that'} is not a file Junoview exports "
                         "this way")
    try:
        data = base64.b64decode(str(b64 or ""), validate=True)
    except ValueError:
        raise ValueError("the export arrived damaged") from None
    if not data:
        raise ValueError("the export is empty")
    if len(data) > EXPORT_CAP:
        raise ValueError(f"the export is {len(data) // (1024 * 1024)} MB, "
                         f"over the {EXPORT_CAP // (1024 * 1024)} MB limit")
    # a .pptx is a ZIP; anything else under that name is not one
    if not data.startswith(b"PK\x03\x04"):
        raise ValueError(f"{name} is named like a .pptx but is not one")
    path = free_path(folder, export_name(Path(str(name)).stem, suffix))
    path.write_bytes(data)
    return path


def reveal(path: Path, how: str = "open") -> None:
    """Open ``path`` with its own program, or show it in its folder."""
    try:
        _launch(path, how)
    except OSError as e:
        # no desktop to hand it to (a server with no xdg-open, say): say
        # so in words, not as a missing-file error about a helper program
        raise ValueError(f"this computer has no program set up to "
                         f"{'open' if how == 'open' else 'show'} "
                         f"{path.name} ({e.strerror or e})") from None


def _launch(path: Path, how: str) -> None:
    if sys.platform == "win32":
        if how == "open":
            os.startfile(str(path))   # the file this server just wrote
        else:
            subprocess.Popen(f'explorer /select,"{path}"')
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)] if how == "open"
                         else ["open", "-R", str(path)])
    else:
        subprocess.Popen(["xdg-open",
                          str(path if how == "open" else path.parent)])
