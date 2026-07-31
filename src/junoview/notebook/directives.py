"""Parsing of the ``#| key: value`` lines that open a code cell.

Directives are the notebook author's half of the contract: they say what a cell
means (``#| display: figure``), what it derives from (``#| depends: load``) and
how it groups. Everything here is optional -- what an author leaves out is
inferred later, in :mod:`junoview.notebook.classify`.
"""

from __future__ import annotations

import html
import re

_DIRECTIVE_RE = re.compile(r"^\s*#\|\s*([A-Za-z_]+)\s*:\s*(.*?)\s*$")


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*$")


# a raw HTML heading that OPENS a markdown cell, e.g.
# `<h1 style="color:cyan">Results</h1>` — attributes and inner markup are
# allowed and it may span several lines. Notebooks that style their headers
# with inline HTML are common, and these must register as headings too.
_HTML_HEADING_RE = re.compile(
    r"^<h([1-6])\b[^>]*>(.*?)</h\1\s*>", re.IGNORECASE | re.DOTALL)


_TAG_RE = re.compile(r"<[^>]+>")


def _lead_heading(source: str) -> tuple[int, str, str] | None:
    """Detect a heading at the very start of a markdown cell — a Markdown ATX
    heading (`## Title`) OR a raw HTML heading (`<h2 ...>Title</h2>`). Returns
    (level, plain_title, rest_after_heading), or None when the cell does not
    open with a heading."""
    stripped = source.strip()
    if not stripped:
        return None
    first = stripped.splitlines()[0]
    m = _HEADING_RE.match(first)
    if m:
        rest = "\n".join(stripped.splitlines()[1:]).strip()
        return len(m.group(1)), m.group(2).strip(), rest
    m = _HTML_HEADING_RE.match(stripped)
    if m:
        text = html.unescape(_TAG_RE.sub("", m.group(2))).strip()
        if text:
            return int(m.group(1)), text, stripped[m.end():].strip()
    return None


# display types we understand; anything else falls back to "code"
_DISPLAY_TYPES = {
    "figure", "dataset", "transform", "diagnostic",
    "metric", "text", "code", "hidden",
}


def split_directives(source: str) -> tuple[dict[str, str], str]:
    """Pull the leading `#| k: v` block off a code cell.

    Returns (directives, remaining_source). Directives may be preceded by
    blank lines; the block ends at the first non-directive, non-blank line.
    """
    lines = source.splitlines()
    directives: dict[str, str] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        m = _DIRECTIVE_RE.match(line)
        if not m:
            break
        key, value = m.group(1).lower(), m.group(2)
        directives[key] = value
        i += 1
    remaining = "\n".join(lines[i:]).strip("\n")
    return directives, remaining
