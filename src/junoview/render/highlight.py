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

    # Python 3.12 (PEP 701) started tokenizing an f-string as FSTRING_START,
    # then its pieces (FSTRING_MIDDLE, and real OP/NAME tokens for what is
    # inside the braces), then FSTRING_END; 3.10 and 3.11 give one STRING.
    # Fold each FSTRING_START..FSTRING_END run back into one string span so
    # the page renders byte-for-byte the same on every supported Python --
    # tests/test_characterization.py pins those bytes.
    folded: list[tuple[int, int, int, str]] = []   # (start, end, type, string)
    depth = 0
    for tok in toks:
        try:
            start = idx(*tok.start)
            end = idx(*tok.end)
        except Exception:
            continue
        tname = tokenize.tok_name.get(tok.type, "")
        if tname == "FSTRING_START":
            if depth == 0:
                folded.append((start, end, tokenize.STRING, tok.string))
            depth += 1
            continue
        if depth:
            s0, _, t0, _ = folded[-1]
            folded[-1] = (s0, max(end, folded[-1][1]), t0, "")
            if tname == "FSTRING_END":
                depth -= 1
            continue
        folded.append((start, end, tok.type, tok.string))

    out: list[str] = []
    prev = 0
    for start, end, ttype, tstring in folded:
        if start < prev:
            start = prev
        # gap (whitespace / newlines) preserved verbatim
        if start > prev:
            out.append(html.escape(src[prev:start]))
        text = src[start:end]
        cls = None
        if ttype == tokenize.NAME:
            if keyword.iskeyword(tstring):
                cls = "kw"
            elif tstring in _BUILTIN_NAMES:
                cls = "bn"
        elif ttype == tokenize.STRING:
            cls = "st"
        elif ttype == tokenize.NUMBER:
            cls = "nu"
        elif ttype == tokenize.COMMENT:
            cls = "co"
        elif ttype == tokenize.OP:
            cls = "op"
        esc = html.escape(text)
        out.append(f'<span class="{cls}">{esc}</span>' if cls else esc)
        prev = end
    if prev < len(src):
        out.append(html.escape(src[prev:]))
    return "".join(out)
