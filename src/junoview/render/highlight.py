"""Python syntax highlighting, using the real tokenizer.

Falls back to escaped plain text when a cell will not tokenize, so a syntax
error in someone's notebook never costs them the page.
"""

from __future__ import annotations

import builtins
import html
import io
import keyword
import tokenize

# Explicitly the `builtins` module, never the `__builtins__` global: that name
# is the module inside `__main__` but its __dict__ inside an imported module, so
# `dir(__builtins__)` would silently start returning dict methods -- highlighting
# `.update(` and `.values` as builtins while missing `print` and `range`.
_BUILTIN_NAMES = frozenset(dir(builtins))


def highlight_python(src: str) -> str:
    """Return HTML for `src` with lightweight, safe Python highlighting."""
    if not src.strip():
        return ""
    try:
        toks = list(tokenize.generate_tokens(io.StringIO(src).readline))
    except Exception:
        return html.escape(src)

    # absolute char offset for each (row, col)
    line_starts = [0]
    for ln in src.splitlines(keepends=True):
        line_starts.append(line_starts[-1] + len(ln))

    def idx(row: int, col: int) -> int:
        if row - 1 >= len(line_starts):
            return len(src)
        return line_starts[row - 1] + col

    out: list[str] = []
    prev = 0
    for tok in toks:
        try:
            start = idx(*tok.start)
            end = idx(*tok.end)
        except Exception:
            continue
        if start < prev:
            start = prev
        # gap (whitespace / newlines) preserved verbatim
        if start > prev:
            out.append(html.escape(src[prev:start]))
        text = src[start:end]
        cls = None
        tname = tokenize.tok_name.get(tok.type, "")
        if tok.type == tokenize.NAME:
            if keyword.iskeyword(tok.string):
                cls = "kw"
            elif tok.string in _BUILTIN_NAMES:
                cls = "bn"
        elif tok.type == tokenize.STRING or tname.startswith("FSTRING"):
            cls = "st"
        elif tok.type == tokenize.NUMBER:
            cls = "nu"
        elif tok.type == tokenize.COMMENT:
            cls = "co"
        elif tok.type == tokenize.OP:
            cls = "op"
        esc = html.escape(text)
        out.append(f'<span class="{cls}">{esc}</span>' if cls else esc)
        prev = end
    if prev < len(src):
        out.append(html.escape(src[prev:]))
    return "".join(out)
