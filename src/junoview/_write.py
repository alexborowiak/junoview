"""Writing text files without letting the platform edit them.

``Path.write_text`` opens in text mode, so on Windows every ``\\n`` becomes
``\\r\\n``. For a rendered page that means the same notebook produces different
*bytes* depending on who ran the renderer -- which breaks reproducible builds,
makes hashes platform-specific, and shows up as a whole-file diff when a
generated artifact like ``docs/`` is committed from a different machine.

Everything Junoview writes goes through :func:`write_text`, which pins the
newline so the output is the same everywhere.
"""

from __future__ import annotations

from pathlib import Path


def write_text(path: Path, text: str) -> None:
    """Write `text` as UTF-8 with LF endings, whatever the platform."""
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
