"""Just enough Markdown for notebook prose.

Bullets, bold, italic, inline code and paragraphs -- deliberately not a full
implementation, since the goal is readable notes rather than a document format.
Math is left as ``$...$`` for MathJax to typeset in the browser.
"""

from __future__ import annotations

import html
import re

from ..notebook.directives import _HEADING_RE
from .sanitize import _sanitize_html

_MD_CODE_RE = re.compile(r"`([^`]+)`")


_MD_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")


_MD_EM_RE = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")


_MD_BULLET_RE = re.compile(r"^\s*[-*+]\s+")


def _md_with_headings(text: str) -> str:
    """md_to_html plus #-heading support, for the raw notebook view."""
    parts: list[str] = []
    plain: list[str] = []

    def flush() -> None:
        if plain:
            parts.append(md_to_html("\n".join(plain)))
            plain.clear()

    for line in text.splitlines():
        m = _HEADING_RE.match(line.strip())
        if m:
            flush()
            level = min(len(m.group(1)) + 1, 6)
            parts.append(f"<h{level}>{html.escape(m.group(2))}</h{level}>")
        else:
            plain.append(line)
    flush()
    return "".join(parts)


_MD_HTMLBLOCK_RE = re.compile(r"^\s*<[a-zA-Z!/]", re.M)


def md_to_html(text: str) -> str:
    def inline(s: str) -> str:
        s = _MD_CODE_RE.sub(r"<code>\1</code>", s)
        s = _MD_BOLD_RE.sub(r"<strong>\1</strong>", s)
        s = _MD_EM_RE.sub(r"<em>\1</em>", s)
        return s

    out: list[str] = []
    for block in re.split(r"\n\s*\n", text):
        raw_lines = [ln.rstrip() for ln in block.splitlines()
                     if ln.strip()]
        if not raw_lines:
            continue
        # blocks that ARE html render as html (like Jupyter), sanitized —
        # but `- ` list lines inside the block still become a real list
        # (<b>Title</b> straight above bullets is a common notebook style)
        if _MD_HTMLBLOCK_RE.match(raw_lines[0]):
            k = 0
            while k < len(raw_lines):
                run: list[str] = []
                if _MD_BULLET_RE.match(raw_lines[k]):
                    while (k < len(raw_lines)
                           and _MD_BULLET_RE.match(raw_lines[k])):
                        run.append(raw_lines[k])
                        k += 1
                    lis = "".join(
                        f"<li>{inline(_MD_BULLET_RE.sub('', html.escape(ln)))}"
                        f"</li>" for ln in run)
                    out.append(f"<ul>{lis}</ul>")
                else:
                    while (k < len(raw_lines)
                           and not _MD_BULLET_RE.match(raw_lines[k])):
                        run.append(raw_lines[k])
                        k += 1
                    out.append(_sanitize_html("\n".join(run)))
            continue
        lines = [html.escape(ln) for ln in raw_lines]
        if all(_MD_BULLET_RE.match(ln) for ln in lines):
            lis = "".join(
                f"<li>{inline(_MD_BULLET_RE.sub('', ln))}</li>" for ln in lines)
            out.append(f"<ul>{lis}</ul>")
        else:
            out.append(f"<p>{inline('<br>'.join(lines))}</p>")
    return "".join(out)
