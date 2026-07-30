#!/usr/bin/env python3
"""
semantic_render.py
==================

Turn an *executed* Jupyter notebook into an interactive, figure-first
"semantic analysis" environment -- an HTML page that treats the notebook as
computational state and recovers the scientific structure underneath it:

        Dataset -> Transform -> Diagnostic -> Figure -> Interpretation

instead of rendering every cell with equal weight.

This is a *static* renderer: it reads the outputs already stored in the
notebook (run it once, normally, in Jupyter), so there is no kernel, no
backend and no re-execution. Open the resulting .html in any browser.

--------------------------------------------------------------------------
Authoring a notebook for this renderer
--------------------------------------------------------------------------
Add `#| key: value` directive lines to the TOP of a code cell. They are
parsed, then stripped from the displayed source. Everything is optional --
absent directives are inferred from the cell's outputs.

    #| section:    <name>      Group this cell under a top-level section.
    #| subsection: <name>      Optional nested group within a section.
    #| title:      <text>      Human title for the card (else inferred).
    #| display:    <type>      figure | dataset | transform | diagnostic
                               | metric | text | code | hidden
    #| code:       hidden|show Default code visibility for this card.
    #| id:         <slug>      Stable id, referenced by `depends`.
    #| depends:    a, b, c     ids this card derives from (provenance edges).
    #| caption:    <text>      Interpretation / what to look for.
    #| group:      <name>      Merge several cells into ONE card (alias: tag).
    #| order:      <int>       Sort this cell within its group.
    #| step:       <label>     Label this cell's chunk in the folded code.
    #| stack:      a, b        Fold the code of cells with these ids under
                               this card (reusable across figures).

Markdown cells: a leading `# / ## / ###` heading opens a section /
subsection; any prose beneath it becomes an interpretation note.

Grouping vs stacking, two ways to put several cells under one figure:
  * group (push): cells self-tag with `#| group:`; one group per cell; best
    for a few adjacent cells authored as a unit.
  * stack (pull): a figure names upstream cells by id with `#| stack:`; the
    named cells are folded in (and consumed, so they get no card of their
    own) and the SAME cell can be stacked under many figures. Use it for
    shared prep like opening data or regridding. `depends:` keeps a cell as
    its own graph node; `stack:` folds its code and collapses it.

Inference when `display` is absent:
    image output            -> figure
    xarray HTML repr        -> dataset
    any text / stdout / repr -> text (badge "print")
    no output                -> code (collapsed by default)

--------------------------------------------------------------------------
Usage
--------------------------------------------------------------------------
App mode (the normal way to work) -- a local GUI in your browser with a
tab per notebook, an Open dialog, drag-and-drop, and project-level
presentations that can mix cards from every open notebook:

    python semantic_render.py                    # launch the app (cwd root)
    python semantic_render.py --app A.ipynb B.ipynb   # preload as tabs
    python semantic_render.py --app --root C:/work/proj --port 8765

Static export (shareable single .html, no server needed to view):

    python semantic_render.py NOTEBOOK.ipynb [-o OUT.html] [--title "..."]
    python semantic_render.py A.ipynb B.ipynb -o bundle.html   # tabbed
    python semantic_render.py NOTEBOOK.ipynb --deck DECK.json
    python semantic_render.py NOTEBOOK.ipynb --embed-deck DECK.json
    python semantic_render.py --self-test

The rendered page includes a Present mode (toolbar) with a slide builder;
decks persist in the notebook's metadata.semantic.presentations, in a
<notebook>.deck.json sidecar, via --embed-deck, or (app mode) in a
semantic_project.json next to where the app was started. Slides reference
cards by stable anchors (`#| id:` first, else the nbformat cell id);
multi-notebook decks namespace them as `<stem>::<anchor>`.
"""

from __future__ import annotations

import argparse
import ast
import base64
import hashlib
import html
import html.parser
import http.server
import io
import json
import keyword
import re
import secrets
import subprocess
import sys
import threading
import time
import tokenize
import urllib.parse
import urllib.request
import webbrowser
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_REPO_URL = "https://github.com/alexborowiak/semantic-rendering"
_KOFI_URL = "https://ko-fi.com/plotline"

# The Junoview mark: a peacock-feather "ocellus" (eye) — concentric teal /
# amber / blue / dark rings inside twelve barbs with three amber dots. Inline
# SVG so it stays crisp and self-contained in every runtime (juno-view-ocellus).
# --- the chrome icon set -------------------------------------------------
# Inline SVG, never emoji: emoji render as tofu boxes in this app's mono
# font (that cost several rounds once already). One grid (16x16), one
# style (stroke, currentColor), so every button reads as the same family.
# Markup uses <i data-ic="key"></i> tokens which _icons() expands, so the
# templates stay readable and the artwork lives in exactly one place.
_ICON_PATHS = {
    # files / app
    "open": '<path d="M1.8 12.6V4.2a1 1 0 0 1 1-1h3.1l1.4 1.6h6a1 1 0 0 1 1 '
            '1v6.8a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1Z"/>',
    "reload": '<path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8"/>'
              '<path d="M13.6 2.2v3.1h-3.1"/>',
    "info": '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.4v4"/>'
            '<path d="M8 4.9v.1"/>',
    # filters: one per content type
    "plots": '<path d="M2.4 13.2h11.2"/><path d="M4.6 13.2V8.1"/>'
             '<path d="M8 13.2V3.6"/><path d="M11.4 13.2V6.3"/>',
    "markdown": '<path d="M2.6 4.2h10.8"/><path d="M2.6 7.4h10.8"/>'
                '<path d="M2.6 10.6h7.2"/>',
    "code": '<path d="M5.6 5.2 2.4 8l3.2 2.8"/>'
            '<path d="M10.4 5.2 13.6 8l-3.2 2.8"/>',
    "output": '<rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.2"/>'
              '<path d="M4.6 6.6 6.4 8l-1.8 1.4"/><path d="M8.4 10h3"/>',
    # a sub-picker: a funnel, the universal "narrow this down"
    "types": '<path d="M2.6 3.6h10.8L9.4 8.2v4.3l-2.8-1.6V8.2Z"/>',
    # scope + reset
    "scope": '<path d="M6.4 4.2h7.2"/><path d="M6.4 8h7.2"/>'
             '<path d="M6.4 11.8h7.2"/><path d="m2.2 4.2.9.9 1.6-1.7"/>'
             '<path d="m2.2 8 .9.9L4.7 7.2"/>',
    "reset": '<path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/>'
             '<path d="M2.4 2.2v3.1h3.1"/>',
    "inherit": '<path d="M8 2.6v8.2"/><path d="m4.8 7.6 3.2 3.2 3.2-3.2"/>'
               '<path d="M2.6 13.4h10.8"/>',
    # sizes
    "minus": '<path d="M3.6 8h8.8"/>',
    "plus": '<path d="M8 3.6v8.8"/><path d="M3.6 8h8.8"/>',
    # views
    "raw": '<path d="M6.2 3.2 4 12.8"/><path d="M9.8 3.2 12 12.8"/>'
           '<path d="M2.6 6.4h10.8"/><path d="M2.6 9.6h10.8"/>',
    "tree": '<rect x="5.8" y="1.8" width="4.4" height="3.2" rx=".8"/>'
            '<rect x="1.6" y="11" width="4.4" height="3.2" rx=".8"/>'
            '<rect x="10" y="11" width="4.4" height="3.2" rx=".8"/>'
            '<path d="M8 5v3.2M3.8 11V8.2h8.4V11"/>',
    "doc": '<path d="M3.4 2.4h6l3.2 3.2v8a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8'
           '-.8V3.2a.8.8 0 0 1 .8-.8Z"/><path d="M9.2 2.4v3.4h3.4"/>'
           '<path d="M5.4 9h5.2M5.4 11.4h3.4"/>',
    "present": '<rect x="1.8" y="2.8" width="12.4" height="9" rx="1"/>'
               '<path d="m6.8 6.1 3 1.9-3 1.9Z"/><path d="M8 11.8v1.6"/>',
    # the presenting bar's own controls
    "outline": '<rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.2"/>'
               '<path d="M6.2 2.6v10.8"/><path d="M3.2 5.6h1.8M3.2 8h1.8"/>',
    "docktop": '<rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.2"/>'
               '<path d="M1.8 6.2h12.4"/><path d="M4.4 4.3h5.4"/>',
    "dockright": '<rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.2"/>'
                 '<path d="M9.8 2.4v11.2"/><path d="M11.5 5h1.2M11.5 7.4h1.2"/>',
    "pin": '<path d="M6 1.9h4l-.6 4.2 2.4 2.3H4.2l2.4-2.3Z"/>'
           '<path d="M8 8.4v5.7"/>',
    "exit": '<path d="M4 4l8 8"/><path d="M12 4l-8 8"/>',
    # app
    "theme": '<circle cx="8" cy="8" r="5.6"/><path d="M8 2.4v11.2"/>'
             '<path d="M8 4.6a3.4 3.4 0 0 1 0 6.8"/>',
    "heart": '<path d="M8 13.3S2.2 9.9 2.2 6.3A2.9 2.9 0 0 1 8 4.7a2.9 2.9 0 '
             '0 1 5.8 1.6c0 3.6-5.8 7-5.8 7Z"/>',
    "help": '<circle cx="8" cy="8" r="6.2"/>'
            '<path d="M6.2 6.2a1.9 1.9 0 1 1 2.4 2.2v1.1"/>'
            '<path d="M8.6 12v.1"/>',
    # custom views
    "style": '<path d="M10.6 2.6 13.4 5.4 6.2 12.6H3.4V9.8Z"/>'
             '<path d="m9.2 4 2.8 2.8"/>',
    # the three "+ New ..." rail buttons. Collapsed to icons they used to be
    # "+", a rectangle and a triple bar — three near-identical glyphs for
    # three different kinds of thing, so each now shows what it makes.
    "newdeck": '<rect x="1.6" y="3.2" width="9.6" height="7.2" rx="1"/>'
               '<path d="M3.6 12.8h5.6"/><path d="M13.4 4.6v5.2"/>'
               '<path d="M10.8 7.2h5.2"/>',
    "newposter": '<rect x="2.4" y="1.8" width="7.6" height="12.4" rx="1"/>'
                 '<path d="M4.2 5h4M4.2 7.4h4M4.2 9.8h2.4"/>'
                 '<path d="M13.4 4.6v5.2"/><path d="M10.8 7.2h5.2"/>',
    "newview": '<path d="M2.4 2.6h5.8l2.6 2.6v8.2H2.4Z"/>'
               '<path d="M4.6 8.4h4M4.6 10.8h2.6"/>'
               '<path d="M13.9 2.4 15.4 3.9 12 7.3h-1.5V5.8Z"/>',
}


def _icons(markup: str) -> str:
    """Swap every ``<i data-ic="key"></i>`` token for its inline SVG."""
    def sub(m: re.Match) -> str:
        body = _ICON_PATHS.get(m.group(1))
        if body is None:
            return ""
        return ('<svg class="bic" viewBox="0 0 16 16" aria-hidden="true" '
                'focusable="false">' + body + '</svg>')
    return re.sub(r'<i data-ic="([a-z]+)"></i>', sub, markup)


_LOGO_SVG = (
    '<svg class="jv-logo" viewBox="0 0 200 200" '
    'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Junoview">'
    '<g stroke="#1D9E75" stroke-width="2.5" stroke-linecap="round" '
    'opacity="0.8">'
    '<line x1="169.55" y1="118.64" x2="186.93" y2="123.29"/>'
    '<line x1="150.91" y1="150.91" x2="163.64" y2="163.64"/>'
    '<line x1="118.64" y1="169.55" x2="123.29" y2="186.93"/>'
    '<line x1="81.36" y1="169.55" x2="76.71" y2="186.93"/>'
    '<line x1="49.09" y1="150.91" x2="36.36" y2="163.64"/>'
    '<line x1="30.45" y1="118.64" x2="13.07" y2="123.29"/>'
    '<line x1="30.45" y1="81.36" x2="13.07" y2="76.71"/>'
    '<line x1="49.09" y1="49.09" x2="36.36" y2="36.36"/>'
    '<line x1="81.36" y1="30.45" x2="76.71" y2="13.07"/>'
    '<line x1="118.64" y1="30.45" x2="123.29" y2="13.07"/>'
    '<line x1="150.91" y1="49.09" x2="163.64" y2="36.36"/>'
    '<line x1="169.55" y1="81.36" x2="186.93" y2="76.71"/>'
    '</g>'
    '<circle cx="100" cy="100" r="66" fill="#0F6E56"/>'
    '<circle cx="100" cy="100" r="66" fill="none" stroke="#EF9F27" '
    'stroke-width="3.5"/>'
    '<circle cx="100" cy="100" r="42" fill="#185FA5"/>'
    '<circle cx="100" cy="100" r="18" fill="#04342C"/>'
    '<circle cx="100" cy="12" r="7.5" fill="#EF9F27"/>'
    '<circle cx="176.21" cy="144" r="7.5" fill="#EF9F27"/>'
    '<circle cx="23.79" cy="144" r="7.5" fill="#EF9F27"/>'
    '</svg>'
)
_FAVICON = "data:image/svg+xml," + urllib.parse.quote(_LOGO_SVG)

# --------------------------------------------------------------------------
# Directive parsing
# --------------------------------------------------------------------------

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


# --------------------------------------------------------------------------
# Python syntax highlighting (robust: real tokenizer, plain-text fallback)
# --------------------------------------------------------------------------

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
    builtins_set = set(dir(__builtins__)) if isinstance(__builtins__, dict) \
        else set(dir(__builtins__))
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
            elif tok.string in builtins_set:
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


# --------------------------------------------------------------------------
# Output rendering
# --------------------------------------------------------------------------

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _strip_ansi(text: str) -> str:
    return _ANSI_RE.sub("", text)


def _as_text(value: Any) -> str:
    return "".join(value) if isinstance(value, list) else (value or "")


def _looks_like_xarray(htmltext: str) -> bool:
    return ("xr-" in htmltext) or ("xarray" in htmltext.lower())


def _looks_like_dataframe(htmltext: str) -> bool:
    # pandas styles its HTML table with class="dataframe"
    return 'class="dataframe"' in htmltext or "class='dataframe'" in htmltext


@dataclass
class RenderedOutput:
    kind: str          # "image"|"video"|"plotly"|"xarray"|"html"|"text"|"error"
    payload: str       # html fragment ready to drop in
    has_image: bool = False
    has_xarray: bool = False
    has_interactive: bool = False   # embeds live JS (plotly/bokeh/vega/…)
    ot: str = "print"  # output-type slug for the Output-types filter
    pt: str = ""       # plot-type slug (matplotlib/plotly/bokeh/…) — set on
                       # everything that lands in a card's PLOT part


_B64_STRIP_RE = re.compile(r"[^A-Za-z0-9+/=]")


def _b64(v) -> str:
    """A notebook base64 payload may be a str or a list of str lines. Restrict
    to the base64 alphabet so a crafted (non-base64) value cannot break out of
    the surrounding src="data:...;base64,{b64}" attribute (XSS)."""
    s = v if isinstance(v, str) else "".join(v)
    return _B64_STRIP_RE.sub("", s)


# any embedded <script> in a cell OUTPUT (never in a markdown note) is
# neutralised at build time and re-run on the client so interactive plots
# (plotly / bokeh / vega / folium) work in every runtime. The notebook was
# executed to produce this output, so its own <script> is treated as trusted
# — exactly as nbconvert/JupyterLab do.
_SCRIPT_OPEN_RE = re.compile(r"<script\b([^>]*)>", re.I)
_TYPE_ATTR_RE = re.compile(r"""\s*type\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)""", re.I)


def _defuse_scripts(fragment: str) -> tuple[str, bool]:
    """Rewrite <script ...> to an inert type the browser won't auto-run.
    Returns (html, had_script). The client re-activates them on mount."""
    had = False

    def repl(m: "re.Match") -> str:
        nonlocal had
        had = True
        attrs = _TYPE_ATTR_RE.sub("", m.group(1))
        return f'<script type="text/plotline-embed"{attrs}>'

    return _SCRIPT_OPEN_RE.sub(repl, fragment), had


_PLOT_MARKER_RE = re.compile(
    r"bk-root|bokehjs|plotly-graph-div|js-plotly-plot|vega-embed|vega-lite|"
    r"folium-map|leaflet-container|require\(|<script|<iframe", re.I)


def _looks_interactive(htmltext: str) -> bool:
    """True only on REAL embed machinery (scripts, iframes, library
    containers) — prose that merely mentions a library name must not turn
    a printed table into a 'figure'."""
    return bool(_PLOT_MARKER_RE.search(htmltext))


def _plot_lib(htmltext: str) -> str:
    """Which plotting library a live HTML embed comes from — the slug feeds
    the Plot-types filter ('widget' = some other interactive embed)."""
    low = htmltext.lower()
    if "bokeh" in low:
        return "bokeh"
    if "vega" in low or "altair" in low:
        return "vega"
    if "folium" in low or "leaflet" in low:
        return "folium"
    if "plotly" in low:
        return "plotly"
    return "widget"


_NUM_RE = re.compile(r"^[-+]?(\d[\d_]*\.?\d*|\.\d+)([eE][-+]?\d+)?j?$")
_COMPLEX_RE = re.compile(
    r"^\(?[-+]?(\d[\d_]*\.?\d*|\.\d+)([eE][-+]?\d+)?"
    r"[-+](\d[\d_]*\.?\d*|\.\d+)([eE][-+]?\d+)?j\)?$")


def _has_toplevel_colon(s: str) -> bool:
    """A ':' at the top level of the outer braces, ignoring string contents.
    Distinguishes a dict ({'a': 1}) from a set ({'12:00', '13:00'})."""
    quote = None
    esc = False
    depth = 0
    for ch in s:
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
        elif ch in "[{(":
            depth += 1
        elif ch in "]})":
            depth -= 1
        elif ch == ":" and depth == 1:
            return True
    return False


def _repr_kind(text: str) -> str:
    """Guess the Python type of an execute_result repr, for the finer
    Output-types filter (numeric / string / list / dict / series / …). Only
    types actually seen are ever surfaced, so this can be as granular as it
    likes. Falls back to 'value' for anything unrecognised; 'print' for empty."""
    s = text.strip()
    if not s:
        return "print"
    c = s[0]
    if c == "<":                                   # <function …>, <Foo object …>
        if s.startswith(("<function", "<built-in function", "<built-in method",
                         "<bound method", "<lambda")):
            return "function"
        if s.startswith("<class "):
            return "class"
        if s.startswith("<module "):
            return "module"
        return "object"
    if c == "[":
        return "list"
    if c == "{":
        # {} is an empty dict; a set has no top-level ':' (quote-aware)
        return "dict" if (s == "{}" or _has_toplevel_colon(s)) else "set"
    if c == "(":
        # a full complex number reprs parenthesised, e.g. "(1+2j)"
        return "numeric" if _COMPLEX_RE.match(s) else "tuple"
    if c in "'\"" or s[:2] in ("b'", 'b"', "r'", 'r"', "f'", 'f"'):
        return "string"
    if s in ("True", "False"):
        return "bool"
    if s == "None":
        return "none"
    if s.lstrip("+-") in ("inf", "nan"):
        return "numeric"
    if _NUM_RE.match(s):
        return "numeric"
    if s.startswith(("array(", "tensor(", "np.", "matrix(")):
        return "array"
    if s.startswith(("defaultdict(", "OrderedDict(", "Counter(")):
        return "dict"
    if "\n" in s:                                  # multi-line reprs
        if re.search(r"\[\d+ rows? x \d+ columns?\]\s*$", s):
            return "dataframe"                      # pandas DataFrame text repr
        if re.search(r"(\n|, )dtype:\s*\S+\s*$", s):
            return "series"                         # pandas Series text repr
    return "value"


def render_outputs(outputs: list[dict]) -> list[RenderedOutput]:
    """Convert nbformat output dicts into ready-to-embed HTML fragments."""
    rendered: list[RenderedOutput] = []
    for out in outputs or []:
        otype = out.get("output_type")
        if otype == "stream":
            text = _strip_ansi(_as_text(out.get("text", "")))
            if text.strip():
                rendered.append(RenderedOutput(
                    "text",
                    f'<pre class="stream ot-print">{html.escape(text)}</pre>',
                    ot="print"))
        elif otype in ("execute_result", "display_data"):
            data = out.get("data", {})
            plotly_key = "application/vnd.plotly.v1+json"
            video_key = next((m for m in ("video/mp4", "video/webm",
                                          "video/ogg") if m in data), None)
            if plotly_key in data:
                # an interactive Plotly figure — embed the spec; the client
                # lazily loads plotly.js and draws it
                spec = json.dumps(data[plotly_key], ensure_ascii=False)
                spec = html.escape(spec, quote=True).replace("</", "<\\/")
                rendered.append(RenderedOutput(
                    "plotly",
                    f'<div class="figframe plotframe" data-pt="plotly">'
                    f'<div class="plotly-embed" data-plotly="{spec}">'
                    f'</div></div>',
                    has_interactive=True, ot="result", pt="plotly"))
            elif video_key:
                b64 = _b64(data[video_key])
                rendered.append(RenderedOutput(
                    "video",
                    f'<div class="figframe" data-pt="video">'
                    f'<video class="vid-out" controls '
                    f'loop muted playsinline preload="metadata" '
                    f'src="data:{video_key};base64,{b64}"></video></div>',
                    has_image=True, ot="result", pt="video"))
            elif "image/png" in data:
                rendered.append(RenderedOutput(
                    "image",
                    f'<div class="figframe" data-pt="matplotlib">'
                    f'<img loading="lazy" alt="figure output" '
                    f'src="data:image/png;base64,{_b64(data["image/png"])}">'
                    f'</div>',
                    has_image=True, pt="matplotlib"))
            elif "image/gif" in data:
                rendered.append(RenderedOutput(
                    "image",
                    f'<div class="figframe" data-pt="animation">'
                    f'<img loading="lazy" '
                    f'alt="animation" class="gif-out" '
                    f'src="data:image/gif;base64,{_b64(data["image/gif"])}">'
                    f'</div>',
                    has_image=True, pt="animation"))
            elif "image/jpeg" in data:
                rendered.append(RenderedOutput(
                    "image",
                    f'<div class="figframe" data-pt="matplotlib">'
                    f'<img loading="lazy" '
                    f'alt="figure output" '
                    f'src="data:image/jpeg;base64,{_b64(data["image/jpeg"])}">'
                    f'</div>',
                    has_image=True, pt="matplotlib"))
            elif "image/svg+xml" in data:
                svg = _as_text(data["image/svg+xml"])
                rendered.append(RenderedOutput(
                    "image",
                    f'<div class="figframe" data-pt="matplotlib">{svg}</div>',
                    has_image=True, pt="matplotlib"))
            elif "text/html" in data:
                htmltext = _as_text(data["text/html"])
                if _looks_like_xarray(htmltext):
                    rendered.append(RenderedOutput(
                        "xarray",
                        f'<div class="xr-wrap ot-dataset">{htmltext}</div>',
                        has_xarray=True, ot="dataset"))
                elif _looks_like_dataframe(htmltext):
                    rendered.append(RenderedOutput(
                        "html",
                        f'<div class="rich ot-dataframe">{htmltext}</div>',
                        ot="dataframe"))
                else:
                    safe, had = _defuse_scripts(htmltext)
                    live = had or _looks_interactive(htmltext)
                    if live:
                        # a live embed is a PLOT (bokeh/vega/folium/… — it
                        # joins the card's plot part and the Plot-types filter)
                        lib = _plot_lib(htmltext)
                        rendered.append(RenderedOutput(
                            "plotly",
                            f'<div class="rich ot-result plotframe" '
                            f'data-pt="{lib}">{safe}</div>',
                            has_interactive=True, ot="result", pt=lib))
                    else:
                        rendered.append(RenderedOutput(
                            "html",
                            f'<div class="rich ot-result">{safe}</div>',
                            ot="result"))
            elif "text/plain" in data:
                text = _as_text(data["text/plain"])
                if text.strip():
                    # classify the repr so the Output-types filter can offer
                    # numeric / string / list / dict / … not just "print"
                    ot = _repr_kind(text)
                    rendered.append(RenderedOutput(
                        "text",
                        f'<pre class="result ot-{ot}">{html.escape(text)}</pre>',
                        ot=ot))
        elif otype == "error":
            tb = _strip_ansi("\n".join(out.get("traceback", [])))
            rendered.append(RenderedOutput(
                "error",
                f'<pre class="error ot-error">{html.escape(tb)}</pre>',
                ot="error"))
    return rendered


# --------------------------------------------------------------------------
# Semantic model
# --------------------------------------------------------------------------

@dataclass
class CodeStep:
    label: str
    code: str
    outputs: list[RenderedOutput] = field(default_factory=list)
    is_primary: bool = False


@dataclass
class Item:
    kind: str                      # card display type
    title: str
    code: str = ""                 # kept for notes / simple use
    code_visible: bool = False
    outputs: list[RenderedOutput] = field(default_factory=list)  # face outputs
    caption: str = ""
    item_id: str = ""              # explicit slug or auto
    node_id: str = ""              # provenance node (only if user gave `id`)
    anchor: str = ""               # stable deck ref: node_id > nb cell id > slug
    chain: list[str] = field(default_factory=list)  # upstream card anchors
    depends: list[str] = field(default_factory=list)
    subsection: str = ""
    is_note: bool = False          # pure-markdown interpretation card
    title_echo: bool = False       # title merely repeats a code line
    code_kind: str = "code"        # primary code kind (code_kinds[0])
    code_kinds: list = field(default_factory=lambda: ["code"])
    steps: list[CodeStep] = field(default_factory=list)  # folded code chunks
    members: list = field(default_factory=list)          # transient, build-only

    @property
    def has_image(self) -> bool:
        return any(o.has_image for o in self.outputs)

    @property
    def has_xarray(self) -> bool:
        return any(o.has_xarray for o in self.outputs)


@dataclass
class Section:
    title: str
    section_id: str
    level: int = 2                 # heading tier: 1 (#), 2 (##) or 3 (###)
    number: str = ""               # outline number ("2", "2.1", "2.1.3")
    items: list[Item] = field(default_factory=list)
    from_heading: bool = False     # authored `#`/`##`/`###` heading — keep
                                   # even when no cards land under it


@dataclass
class Document:
    title: str
    sections: list[Section] = field(default_factory=list)
    presentations: list = field(default_factory=list)  # named slide decks
    source_name: str = ""          # notebook stem, names deck downloads
    raw_html: str = ""             # linear "raw notebook" view of the cells


def _slug(text: str, used: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"
    slug, n = base, 1
    while slug in used:
        n += 1
        slug = f"{base}-{n}"
    used.add(slug)
    return slug


def _infer_kind(item_outputs: list[RenderedOutput]) -> str:
    # a live embed (plotly/bokeh/vega/folium) is a figure, same as an image
    if any(o.has_image or o.has_interactive for o in item_outputs):
        return "figure"
    if any(o.has_xarray for o in item_outputs):
        return "dataset"
    text_like = [o for o in item_outputs if o.kind in ("text", "html", "error")]
    if text_like:
        # any printed output is "print" — a bare expression (len(x)), a
        # print(), a repr. (We used to split short output off as "metric",
        # but in a notebook that is just a printed value too.)
        return "text"
    return "code"


def _title_from_code(code: str) -> tuple[str, bool]:
    """Best-effort title. Returns (title, echo): echo=True when the title
    merely repeats a line of the cell's code — such titles still label the
    item in the nav but are not repeated as a heading on the card."""
    lines = [ln.strip() for ln in code.splitlines() if ln.strip()]
    lines = [ln for ln in lines if not ln.startswith("#|")]
    if lines and lines[0].startswith("#"):
        return (lines[0].lstrip("#").strip() or "Code"), False
    funcs: list[tuple[str, bool]] = []      # (name, is_function)
    other = False
    try:
        for node in ast.parse(code).body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                funcs.append((node.name, True))
            elif isinstance(node, ast.ClassDef):
                funcs.append((node.name, False))
            else:
                other = True
    except SyntaxError:
        pass
    if funcs:
        if len(funcs) == 1:
            name, is_fn = funcs[0]
            base = name + ("()" if is_fn else "")
            return (base + (" + code" if other else "")), False
        if other:
            return f"{len(funcs)} functions + code", False
        names = ", ".join(n for n, _ in funcs[:3])
        if len(funcs) > 3:
            names += ", …"
        return f"{len(funcs)} functions ({names})", False
    for s in lines:
        if not s.startswith("#"):
            return ((s[:60] + "...") if len(s) > 60 else s), True
    return "Code", False


def _csv(value: str) -> list[str]:
    return [x.strip() for x in value.split(",") if x.strip()]


_DATA_FNS = {
    "read_csv", "read_excel", "read_parquet", "read_table", "read_json",
    "read_hdf", "read_pickle", "read_sql", "read_feather", "read_orc",
    "read_stata", "read_fwf", "open_dataset", "open_mfdataset", "open_zarr",
    "open_rasterio", "load_dataset", "loadtxt", "genfromtxt", "fromfile",
    "Dataset", "read_netcdf",
}
_PLOT_METHODS = {
    "plot", "scatter", "bar", "barh", "hist", "hist2d", "imshow", "contour",
    "contourf", "pcolormesh", "pcolor", "fill_between", "fill", "errorbar",
    "boxplot", "violinplot", "heatmap", "subplots", "figure", "add_subplot",
    "savefig", "stackplot", "step", "stem", "quiver", "streamplot",
    "colorbar", "set_title", "set_xlabel", "set_ylabel", "axhline",
    "axvline", "annotate", "lineplot", "displot", "histplot", "kdeplot",
}
_PLOT_OBJS = {"plt", "ax", "axes", "sns", "fig", "axs"}
_SETTINGS_FNS = {
    "set_options", "filterwarnings", "simplefilter", "use", "set",
    "set_theme", "set_context", "set_style", "set_palette", "rc",
    "register_matplotlib_converters",
}
_PRINT_FNS = {"print", "display", "pprint"}


def _call_pairs(tree: ast.AST) -> list:
    """(func_name, object_name) for every call — obj is the Name before a
    method call (plt.plot -> ('plot','plt')), else None."""
    out = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            fn = node.func
            if isinstance(fn, ast.Attribute):
                obj = fn.value.id if isinstance(fn.value, ast.Name) else None
                out.append((fn.attr, obj))
            elif isinstance(fn, ast.Name):
                out.append((fn.id, None))
    return out


def _is_const_value(node: ast.AST) -> bool:
    if isinstance(node, ast.Constant):
        return True
    if isinstance(node, ast.UnaryOp) and isinstance(node.operand, ast.Constant):
        return True
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return all(_is_const_value(e) for e in node.elts)
    if isinstance(node, ast.Dict):
        return (all(k is not None and _is_const_value(k) for k in node.keys)
                and all(_is_const_value(v) for v in node.values))
    return False


def _classify_code(code: str) -> list[str]:
    """The kinds of things a code cell does, in display order. Usually one
    (imports / function / data / settings / plotting / print / constant /
    code); a mixed cell lists several."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return ["code"]
    body = tree.body
    if not body:
        # nothing executes — a fully commented-out cell is its own kind,
        # so the Code-types filter can hide these in one click
        if any(ln.strip() for ln in code.splitlines()):
            return ["comments"]
        return ["code"]
    imp = (ast.Import, ast.ImportFrom)
    defs = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
    calls = _call_pairs(tree)
    cats: list[str] = []
    if any(isinstance(n, imp) for n in body):
        cats.append("imports")
    if any(isinstance(n, defs) for n in body):
        cats.append("function")
    if any(a in _DATA_FNS or a.startswith("read_") or a.startswith("open_")
           for a, _ in calls):
        cats.append("data")
    if (any(a in _SETTINGS_FNS for a, _ in calls) or "rcParams" in code):
        cats.append("settings")
    if any(a in _PLOT_METHODS or o in _PLOT_OBJS for a, o in calls):
        cats.append("plotting")
    if any(a in _PRINT_FNS for a, _ in calls):
        cats.append("print")
    if not cats:
        if all(isinstance(n, ast.Assign) and _is_const_value(n.value)
               for n in body):
            return ["constant"]
        return ["code"]
    # imports/defs alone must not hide REAL work: a cell that also runs
    # statements no specific kind matched (cluster setup, transforms, …)
    # is "imports · code", not just "imports"
    other = [n for n in body if not isinstance(n, imp + defs)]
    if other and not any(c in cats for c in
                         ("data", "settings", "plotting", "print")):
        if all(isinstance(n, ast.Assign) and _is_const_value(n.value)
               for n in other):
            cats.append("constant")
        else:
            cats.append("code")
    return cats


def _finalize_item(item: Item, used_slugs: set[str],
                   cell_by_id: dict[str, dict]) -> None:
    """Resolve a card from its grouped member cells plus any stacked cells."""
    members = sorted(item.members, key=lambda m: (m["order"], m["idx"]))
    multi = len(members) > 1

    def has_img(m):
        # a live embed (plotly/bokeh/…) is a figure face, same as an image
        return any(o.has_image or o.has_interactive for o in m["outputs"])

    # the card's face: the cell that draws the figure (or the last with output)
    primary = next(
        (m for m in members
         if m["d"].get("display", "").lower() in ("figure", "diagnostic")), None)
    if primary is None:
        primary = next((m for m in reversed(members) if has_img(m)), None)
    if primary is None:
        primary = next((m for m in reversed(members) if m["outputs"]), None)
    if primary is None:
        primary = members[-1]

    # this card's own code chunks (from its grouped members)
    own_steps: list[CodeStep] = []
    for m in members:
        d = m["d"]
        label = (d.get("step") or d.get("label")
                 or (d.get("subsection", "") if multi else "")).strip()
        own_steps.append(CodeStep(label=label, code=m["code"],
                                 outputs=m["outputs"], is_primary=(m is primary)))

    # cells pulled in by `stack:` (referenced by id), folded in front
    stack_ids: list[str] = []
    for m in members:
        for sid in _csv(m["d"].get("stack", "")):
            if sid not in stack_ids:
                stack_ids.append(sid)
    own_idx = {m["idx"] for m in members}
    stacked_steps: list[CodeStep] = []
    for sid in stack_ids:
        cm = cell_by_id.get(sid)
        if cm is None or cm["idx"] in own_idx:
            continue
        label = (cm["d"].get("step") or cm["d"].get("label")
                 or cm["d"].get("title") or sid)
        stacked_steps.append(CodeStep(label=label.strip(), code=cm["code"],
                                      outputs=cm["outputs"], is_primary=False))

    item.steps = stacked_steps + own_steps
    item.outputs = primary["outputs"]

    # display kind: first explicit non-code display wins, else infer from face
    display = ""
    for m in members:
        cand = m["d"].get("display", "").lower()
        if cand == "hidden":
            display = "hidden"
            break
        if cand in _DISPLAY_TYPES and cand != "code":
            display = cand
            break
    item.kind = display or _infer_kind(primary["outputs"])

    # give the face a default step label once it shares the fold with others
    if len(item.steps) > 1:
        for s in item.steps:
            if s.is_primary and not s.label:
                s.label = {"figure": "plot", "dataset": "load data",
                           "transform": "transform",
                           "metric": "compute"}.get(item.kind, "")

    explicit = next(
        (m["d"]["title"] for m in members if m["d"].get("title")), "")
    if explicit:
        item.title = explicit
    else:
        item.title, item.title_echo = _title_from_code(primary["code"])
    item.code_kinds = _classify_code(primary["code"])
    item.code_kind = item.code_kinds[0]
    item.caption = (primary["d"].get("caption")
                    or next((m["d"]["caption"] for m in members
                             if m["d"].get("caption")), ""))
    item.node_id = next(
        (m["d"]["id"].strip() for m in members if m["d"].get("id", "").strip()), "")

    member_ids = {m["d"].get("id", "").strip() for m in members}
    depends, seen = [], set()
    for m in members:
        for dep in _csv(m["d"].get("depends", "")):
            if dep not in seen and dep not in member_ids:
                seen.add(dep)
                depends.append(dep)
    item.depends = depends
    item.code_visible = any(
        m["d"].get("code", "").lower() in ("show", "shown", "visible", "true")
        for m in members)
    item.item_id = _slug(item.node_id or item.title or "item", used_slugs)
    cid = primary.get("cell_id", "")
    if item.node_id:
        item.anchor = item.node_id
    elif cid:
        item.anchor = f"cell:{cid}"
    else:
        # No stable identity (no `#| id:`, no nbformat cell id): anchor by
        # POSITION, not the title-derived slug. Editing a figure changes
        # its code-derived title but not its place in the notebook, so a
        # deck frame keeps pointing at it across a refresh.
        item.anchor = f"cell:p{primary.get('idx', 0)}"


_LAYOUT_PANES = {"full": 1, "halves": 2, "rows": 2, "quarters": 4,
                 "title": 0, "blank": 0}


def _as_presentations(obj: Any) -> list:
    """Normalize saved presentation data to [{name, slides}, ...].

    Accepts the current schema (a list, or {"presentations": [...]}) plus
    the legacy single-deck schema ({"slides": [{kind, anchor, beside}]}),
    whose card slides are converted to pane layouts. Slides may carry
    free annotations (text boxes / arrows / rects) and title-slide text.
    """
    if isinstance(obj, list):
        pres = obj
    elif isinstance(obj, dict) and isinstance(obj.get("presentations"), list):
        pres = obj["presentations"]
    elif isinstance(obj, dict) and isinstance(obj.get("slides"), list):
        pres = [{"name": obj.get("name") or "deck", "slides": obj["slides"]}]
    else:
        return []
    out = []
    for p in pres:
        if not isinstance(p, dict):
            continue
        # A CUSTOM VIEW is not a slide deck: it is a saved, styled, filtered
        # view of ONE notebook, so it carries style / view / filters instead
        # of slides. It keeps an empty `slides` list so every consumer that
        # reaches for .slides still works. (2026-07-29)
        if p.get("kind") == "view":
            entry = {"name": str(p.get("name") or "view"), "kind": "view",
                     "slides": []}
            if isinstance(p.get("nb"), str) and p["nb"].strip():
                entry["nb"] = p["nb"].strip()
            for key in ("style", "view", "filters"):
                if isinstance(p.get(key), dict):
                    entry[key] = p[key]
            if isinstance(p.get("folder"), str) and p["folder"].strip():
                entry["folder"] = p["folder"].strip()
            out.append(entry)
            continue
        if not isinstance(p.get("slides"), list):
            continue
        slides = []
        for s in p["slides"]:
            if not isinstance(s, dict):
                continue
            if "panes" in s or s.get("layout") in _LAYOUT_PANES:
                lay = s.get("layout")
                raw_panes = [a if isinstance(a, str) and a else None
                             for a in (s.get("panes") or [])]
                if lay not in _LAYOUT_PANES:
                    lay = {1: "full", 2: "halves"}.get(
                        len(raw_panes) or 1, "quarters")
                n = _LAYOUT_PANES[lay]
                panes = (raw_panes + [None] * n)[:n]
                slide: dict = {"layout": lay, "panes": panes}
                if lay == "title":
                    slide["title"] = str(s.get("title") or "")
                    slide["sub"] = str(s.get("sub") or "")
                    for k in ("tprops", "sprops"):
                        if isinstance(s.get(k), dict):
                            slide[k] = s[k]
                if isinstance(s.get("annots"), list):
                    ann = [a for a in s["annots"] if isinstance(a, dict)]
                    if ann:
                        slide["annots"] = ann
                if isinstance(s.get("hidden"), list):
                    hid = [r for r in s["hidden"] if isinstance(r, str) and r]
                    if hid:
                        slide["hidden"] = hid
                slides.append(slide)
            elif s.get("kind") == "card" and s.get("anchor"):   # legacy
                panes = [s["anchor"]] + [b for b in (s.get("beside") or [])
                                         if isinstance(b, str)][:3]
                lay = {1: "full", 2: "halves"}.get(len(panes), "quarters")
                slides.append({"layout": lay, "panes": panes})
        entry = {"name": str(p.get("name") or "deck"), "slides": slides}
        if isinstance(p.get("folder"), str) and p["folder"].strip():
            entry["folder"] = p["folder"].strip()
        if isinstance(p.get("page"), str) and p["page"].strip():
            entry["page"] = p["page"].strip()   # page-size preset id
        out.append(entry)
    return out


def _cell_names(code: str) -> tuple[set[str], set[str]]:
    """Best-effort (defined, externally-read) names for one cell's code.

    A name counts as externally read when the cell uses it at or before its
    own first assignment (so `z = z + 1` reads the earlier z, but
    `x = 1; print(x)` does not read an external x). Function parameters are
    excluded; IPython magic/shell lines are stripped before parsing.
    """
    src = "\n".join(ln for ln in code.splitlines()
                    if not ln.lstrip().startswith(("%", "!")))
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return set(), set()
    first_def: dict[str, int] = {}
    first_use: dict[str, int] = {}
    params: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.arg):
            params.add(node.arg)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef,
                               ast.ClassDef)):
            first_def.setdefault(node.name, node.lineno)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                first_def.setdefault((a.asname or a.name).split(".")[0],
                                     node.lineno)
        elif isinstance(node, ast.AugAssign) and isinstance(node.target,
                                                            ast.Name):
            first_use.setdefault(node.target.id, node.lineno)
        elif isinstance(node, ast.Name):
            if isinstance(node.ctx, ast.Store):
                first_def.setdefault(node.id, node.lineno)
            elif isinstance(node.ctx, ast.Load):
                first_use.setdefault(node.id, node.lineno)
    uses = {n for n, ln in first_use.items()
            if n not in params
            and (n not in first_def or ln <= first_def[n])}
    return set(first_def), uses


def _mentioned_names(note: "Item", all_defs: set[str]) -> set[str]:
    """Variable names a markdown note refers to. An inline-code span (`name`)
    is a strong signal at any length. A BARE word only counts when it is
    "code-shaped" -- snake_case or containing a digit (e.g. ridge_index,
    z500) -- so prose like "warm events" or "seasonal cycle" does not match a
    plain-word variable named `warm` / `seasonal`; those need backticks."""
    text = f"{note.title}\n{note.caption}"
    found: set[str] = set()
    for span in re.findall(r"`([^`]+)`", text):        # `name`, `name.attr`…
        m = re.match(r"[A-Za-z_]\w*", span.strip())
        if m and m.group(0) in all_defs:
            found.add(m.group(0))
    for n in all_defs:
        code_shaped = "_" in n or any(c.isdigit() for c in n)
        if code_shaped and len(n) >= 3 \
                and re.search(r"\b" + re.escape(n) + r"\b", text):
            found.add(n)
    return found


def _link_notes_to_chains(doc: Document, cards: list, card_defs: dict,
                          anc_of: dict, items_by_id: dict, order: dict) -> None:
    """Link a markdown note into the code trace of every plot whose lineage
    defines a variable the note names -- so the prose that explains a step
    travels with the code into that plot's trace (and its dependency graph).
    Notes are ignored by the presentation trail (it keeps its hasCode filter),
    so this only enriches the docs 'Plot trace'."""
    all_defs: set[str] = set()
    for d in card_defs.values():
        all_defs |= d
    if not all_defs:
        return
    definers: dict[str, list] = {}
    for _, it in cards:
        for n in card_defs[id(it)]:
            definers.setdefault(n, []).append(it)
    anchor_pos: dict[str, int] = {}
    pos = 0
    for sec in doc.sections:
        for it in sec.items:
            anchor_pos[it.anchor or it.item_id] = pos
            pos += 1
    notes: list[tuple] = []
    for sec in doc.sections:
        for it in sec.items:
            if not it.is_note:
                continue
            names = _mentioned_names(it, all_defs)
            if not names:
                continue
            src_ids = {id(c) for n in names for c in definers.get(n, [])}
            it.chain = [items_by_id[i].anchor or items_by_id[i].item_id
                        for i in sorted(src_ids, key=lambda i: order.get(i, 0))]
            notes.append((it, names))
    if not notes:
        return
    for _, it in cards:
        lineage_names = set(card_defs[id(it)])
        for aid in anc_of[id(it)]:
            lineage_names |= card_defs.get(aid, set())
        extra = [nt for (nt, names) in notes if names & lineage_names]
        if not extra:
            continue
        merged = list(it.chain) + [
            (nt.anchor or nt.item_id) for nt in extra
            if (nt.anchor or nt.item_id) not in it.chain]
        it.chain = sorted(merged, key=lambda a: anchor_pos.get(a, 0))


def _build_chains(doc: Document) -> None:
    """Attach to every card the ordered chain of upstream cards feeding it.

    Edges come from two sources, unioned: automatic variable tracing (the
    card that last assigned each name this card reads) and declared
    `depends:` ids. The transitive closure, in document order, becomes
    `item.chain` -- the full "open data -> transform -> plot" story shown
    under a figure's Show code. A final pass also links markdown notes that
    name a variable into the chains that define it.
    """
    cards: list[tuple[int, Item]] = []
    for sec in doc.sections:
        for it in sec.items:
            if it.is_note or not it.members:
                continue
            cards.append((min(m["idx"] for m in it.members), it))
    cards.sort(key=lambda t: t[0])
    order = {id(it): i for i, (_, it) in enumerate(cards)}
    by_node = {it.node_id: it for _, it in cards if it.node_id}
    items_by_id = {id(it): it for _, it in cards}

    deps: dict[int, set[int]] = {id(it): set() for _, it in cards}
    card_defs: dict[int, set[str]] = {id(it): set() for _, it in cards}
    last: dict[str, Item] = {}          # name -> card that last assigned it
    for _, it in cards:
        for m in sorted(it.members, key=lambda m: m["idx"]):
            defs, uses = _cell_names(m["code"])
            for n in uses:
                src = last.get(n)
                if src is not None and src is not it:
                    deps[id(it)].add(id(src))
            for n in defs:
                last[n] = it
            card_defs[id(it)] |= defs
        for d in it.depends:
            src = by_node.get(d)
            if src is not None and src is not it:
                deps[id(it)].add(id(src))

    def ancestors(iid: int, seen: set[int]) -> None:
        for p in deps.get(iid, ()):
            if p not in seen:
                seen.add(p)
                ancestors(p, seen)

    anc_of: dict[int, set[int]] = {}
    for _, it in cards:
        seen: set[int] = set()
        ancestors(id(it), seen)
        anc_of[id(it)] = seen
        it.chain = [items_by_id[i].anchor or items_by_id[i].item_id
                    for i in sorted(seen, key=lambda i: order.get(i, 0))]

    _link_notes_to_chains(doc, cards, card_defs, anc_of, items_by_id, order)


def parse_notebook(nb: dict, title: str | None = None) -> Document:
    used_slugs: set[str] = set()
    nb_title = title or nb.get("metadata", {}).get("title")
    # an explicit --title OR a notebook metadata title wins over an H1
    title_locked = nb_title is not None

    doc = Document(title=nb_title or "Untitled analysis")
    sem_meta = nb.get("metadata", {}).get("semantic", {})
    if isinstance(sem_meta, dict):
        doc.presentations = _as_presentations(
            sem_meta.get("presentations") or sem_meta.get("deck"))
    cur_section: Section | None = None
    cur_subsection = ""
    # the synthetic bucket holding content that appears before any heading; a
    # real heading of the same name may later claim it instead of duplicating
    auto_overview: Section | None = None
    group_index: dict[str, Item] = {}
    cell_by_id: dict[str, dict] = {}   # id -> member cell (for `stack:` lookup)
    all_members: list[dict] = []       # every code cell, to find stacked ids

    def ensure_section() -> Section:
        nonlocal cur_section, auto_overview
        if cur_section is None:
            # section slugs live in a "sec " namespace so a heading can never
            # steal a card's title slug (deck refs point at card ids)
            cur_section = Section("Overview",
                                  _slug("sec overview", used_slugs))
            auto_overview = cur_section
            doc.sections.append(cur_section)
        return cur_section

    for idx, cell in enumerate(nb.get("cells", [])):
        ctype = cell.get("cell_type")
        source = _as_text(cell.get("source", ""))

        if ctype == "markdown":
            handled_heading = False
            md_anchor = f"cell:{cell.get('id')}" if cell.get("id") else ""
            stripped = source.strip()
            lead = _lead_heading(source)
            if lead:
                level, text, rest = lead
                if level <= 3:
                    # Every #/##/### heading opens its own REAL section (three
                    # tiers, each collapsible + hideable), in document order.
                    # Markdown headings are POSITIONAL: two headings that share
                    # a title (e.g. a `## Summary` under each model) are two
                    # distinct sections, unlike the declarative `#| section:`
                    # directive which groups by name. The first h1 also names
                    # the document. #### and deeper stay lightweight kicker
                    # labels within their section.
                    if level == 1 and not title_locked:
                        doc.title = text
                        title_locked = True
                    if auto_overview is not None and auto_overview.title == text:
                        # a real heading claims the synthetic pre-heading
                        # "Overview" bucket rather than spawning a twin
                        cur_section = auto_overview
                        cur_section.level = level
                        cur_section.from_heading = True
                    else:
                        cur_section = Section(
                            text, _slug("sec " + text, used_slugs))
                        cur_section.level = level
                        cur_section.from_heading = True
                        doc.sections.append(cur_section)
                    # the claim window closes at the FIRST heading either way:
                    # a later "### Overview" deep in the document must NOT
                    # teleport its content into the preamble bucket
                    auto_overview = None
                    cur_subsection = ""
                    handled_heading = True
                else:  # level >= 4 -> in-section kicker label
                    cur_subsection = text
                    handled_heading = True
                # prose after the heading becomes a note
                if rest:
                    sec = ensure_section()
                    nid = _slug("note", used_slugs)
                    sec.items.append(Item(
                        kind="note", title=text if handled_heading else "Note",
                        caption=rest, is_note=True, subsection=cur_subsection,
                        item_id=nid, anchor=md_anchor or nid))
            else:
                if stripped:
                    sec = ensure_section()
                    nid = _slug("note", used_slugs)
                    sec.items.append(Item(
                        kind="note", title="Note", caption=stripped,
                        is_note=True, subsection=cur_subsection,
                        item_id=nid, anchor=md_anchor or nid))
            continue

        if ctype != "code":
            continue

        directives, code = split_directives(source)
        group_key = (directives.get("group") or directives.get("tag") or "").strip()
        seen_before = bool(group_key) and group_key in group_index

        # only the first cell of a group steers section / subsection context
        if not seen_before:
            if "section" in directives:
                sec_name = directives["section"]
                # group-by-name stays a TIER-2 concept: a positional ###
                # sub-heading that happens to share the name must not
                # capture directive-declared cells
                existing = next(
                    (s for s in doc.sections
                     if s.title == sec_name and s.level <= 2), None)
                if existing is None:
                    cur_section = Section(
                        sec_name, _slug("sec " + sec_name, used_slugs))
                    doc.sections.append(cur_section)
                else:
                    cur_section = existing
                cur_subsection = ""
            if "subsection" in directives:
                cur_subsection = directives["subsection"]

        outputs = render_outputs(cell.get("outputs", []))
        try:
            order_val = float(directives.get("order", idx))
        except ValueError:
            order_val = float(idx)
        member = {"d": directives, "code": code, "outputs": outputs,
                  "order": order_val, "idx": idx,
                  "cell_id": str(cell.get("id") or "")}
        all_members.append(member)
        cell_id = directives.get("id", "").strip()
        if cell_id:
            cell_by_id.setdefault(cell_id, member)

        if seen_before:
            group_index[group_key].members.append(member)
            continue

        sec = ensure_section()
        item = Item(kind="", title="", subsection=cur_subsection, members=[member])
        sec.items.append(item)
        if group_key:
            group_index[group_key] = item

    # cells named in any `stack:` list are consumed (folded into figures,
    # not shown as their own card)
    consumed_ids: set[str] = set()
    for m in all_members:
        consumed_ids.update(_csv(m["d"].get("stack", "")))

    # resolve every code-derived card from its member cell(s) + stacked cells
    for sec in doc.sections:
        for item in sec.items:
            if not item.is_note and item.members:
                _finalize_item(item, used_slugs, cell_by_id)

    # drop consumed standalone cards, hidden cards, and empty sections
    for sec in doc.sections:
        sec.items = [
            it for it in sec.items
            if (it.is_note or it.kind not in ("", "hidden"))
            and not (it.node_id and it.node_id in consumed_ids)
        ]
    # keep AUTHORED headings even when nothing lands under them (a `#`
    # heading followed straight by another used to vanish entirely)
    doc.sections = [s for s in doc.sections if s.items or s.from_heading]
    # name any unnamed plot "Plot 1", "Plot 2", … (a figure with no explicit
    # title just echoes its first code line — give it a real name instead)
    plot_n = 0
    for s in doc.sections:
        for it in s.items:
            if (it.kind in ("figure", "diagnostic")
                    and (it.title_echo or not it.title.strip())):
                plot_n += 1
                it.title = f"Plot {plot_n}"
                it.title_echo = False
    # outline numbers ("2", "2.1", "2.1.3") make the three section tiers
    # unmistakable in the doc eyebrows. A tier the document NEVER uses is
    # dropped from every number (# + ### with no ## reads "1.1", not
    # "1.0.1"); a tier that exists but hasn't opened yet stays as an
    # honest 0 ("0.1" for a ## before the first #) so two different
    # sections can never share a number.
    present = {max(1, min(3, s.level)) for s in doc.sections}
    counters = [0, 0, 0]
    for s in doc.sections:
        lv = max(1, min(3, s.level))
        counters[lv - 1] += 1
        for i in range(lv, 3):
            counters[i] = 0
        s.number = ".".join(str(counters[i]) for i in range(lv)
                            if (i + 1) in present)
    _build_chains(doc)
    doc.raw_html = render_raw(nb)
    return doc


# --------------------------------------------------------------------------
# Provenance graph layout (layered top-down, fits a narrow rail)
# --------------------------------------------------------------------------

_NODE_FILL = {
    "dataset": "#2f6f9e",
    "transform": "#3b5566",
    "diagnostic": "#2f9bb0",
    "figure": "#2f9bb0",
    "metric": "#2c8c7d",
    "text": "#7a6a52",
    "code": "#4a5564",
}


def build_graph_svg(doc: Document, width: int = 268) -> str:
    """Return an SVG node-link diagram of items that declared an `id`."""
    nodes = [it for s in doc.sections for it in s.items if it.node_id]
    if len(nodes) < 2:
        return ""

    id_to_item = {it.node_id: it for it in nodes}
    # edges (dep -> item), ignoring references to unknown ids
    edges = [(d, it.node_id) for it in nodes for d in it.depends if d in id_to_item]

    # longest-path depth via memoised DFS over reverse edges
    parents: dict[str, list[str]] = {nid: [] for nid in id_to_item}
    for a, b in edges:
        parents[b].append(a)
    depth_cache: dict[str, int] = {}

    def depth(nid: str, stack: frozenset = frozenset()) -> int:
        if nid in depth_cache:
            return depth_cache[nid]
        if nid in stack or not parents[nid]:
            depth_cache[nid] = 0
            return 0
        d = 1 + max(depth(p, stack | {nid}) for p in parents[nid])
        depth_cache[nid] = d
        return d

    order = [it.node_id for it in nodes]  # document order
    layers: dict[int, list[str]] = {}
    for nid in order:
        layers.setdefault(depth(nid), []).append(nid)

    row_h, pad_top, pad_x = 64, 26, 16
    nh = 30
    max_depth = max(layers)
    height = pad_top * 2 + max_depth * row_h + nh
    pos: dict[str, tuple[float, float]] = {}
    for d, ids in layers.items():
        n = len(ids)
        usable = width - 2 * pad_x
        for i, nid in enumerate(ids):
            cx = pad_x + (usable * (i + 0.5) / n)
            cy = pad_top + d * row_h
            pos[nid] = (cx, cy)

    parts: list[str] = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" '
        f'height="{height}" class="provsvg" role="img" '
        f'aria-label="Analysis provenance graph">']

    # edges first (under nodes), amber lineage curves
    for a, b in edges:
        ax, ay = pos[a]
        bx, by = pos[b]
        midy = (ay + nh / 2 + by - nh / 2) / 2
        parts.append(
            f'<path class="provedge" '
            f'd="M {ax:.1f} {ay + nh/2:.1f} '
            f'C {ax:.1f} {midy:.1f} {bx:.1f} {midy:.1f} '
            f'{bx:.1f} {by - nh/2:.1f}" '
            f'data-from="{a}" data-to="{b}"/>')

    # nodes
    for nid, it in id_to_item.items():
        cx, cy = pos[nid]
        fill = _NODE_FILL.get(it.kind, "#4a5564")
        label = it.node_id if len(it.node_id) <= 13 else it.node_id[:12] + "\u2026"
        bw = max(58, min(width - 2 * pad_x, len(label) * 7.2 + 16))
        x = cx - bw / 2
        y = cy - nh / 2
        parts.append(
            f'<g class="provnode" data-node="{it.node_id}" '
            f'data-target="{it.item_id}" tabindex="0" '
            f'role="button" aria-label="Go to {html.escape(it.title)}">'
            f'<rect x="{x:.1f}" y="{y:.1f}" rx="5" width="{bw:.1f}" '
            f'height="{nh}" fill="{fill}"/>'
            f'<text x="{cx:.1f}" y="{cy + 4:.1f}" text-anchor="middle">'
            f'{html.escape(label)}</text></g>')

    parts.append("</svg>")
    return "".join(parts)


# --------------------------------------------------------------------------
# Minimal Markdown for notes (bullets, bold/italic/code, paragraphs).
# Math ($...$ / $$...$$) is left as text for MathJax to typeset in-browser.
# --------------------------------------------------------------------------

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


def render_raw(nb: dict) -> str:
    """Linear rendering of the notebook exactly as authored: every cell in
    order, code with its `#|` directives visible, outputs underneath.

    This is the transparency view -- it shows where the semantic page's
    titles, captions and sections come from.
    """
    parts: list[str] = []
    for cell in nb.get("cells", []):
        ctype = cell.get("cell_type")
        source = _as_text(cell.get("source", ""))
        if ctype == "markdown":
            parts.append(
                '<div class="rawcell md"><span class="rawtag">markdown</span>'
                f'<div class="rawmd">{_md_with_headings(source)}</div></div>')
        elif ctype == "code":
            n = cell.get("execution_count")
            label = f"In [{n if n is not None else ' '}]"
            outs = "".join(o.payload for o in
                           render_outputs(cell.get("outputs", [])))
            out_html = f'<div class="rawout">{outs}</div>' if outs else ""
            parts.append(
                f'<div class="rawcell code"><span class="rawtag">{label}'
                '</span><pre class="code"><code>'
                f'{highlight_python(source)}</code></pre>{out_html}</div>')
    return "".join(parts) or '<p class="rawempty">Empty notebook.</p>'


_MD_HTMLBLOCK_RE = re.compile(r"^\s*<[a-zA-Z!/]", re.M)

# Allowlist sanitizer: parse the fragment and re-emit ONLY known-safe
# tags/attributes, so nothing is reconstructed from deletion. This is
# the safe approach — regex "strip the bad bits" sanitizers are
# defeated by split tags, unquoted attrs and encoded URLs.
_ALLOWED_TAGS = {
    "p", "br", "hr", "span", "div", "strong", "b", "em", "i", "u", "s",
    "del", "ins", "code", "pre", "blockquote", "h1", "h2", "h3", "h4",
    "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd", "a", "img", "sub",
    "sup", "small", "mark", "abbr", "kbd", "samp", "var", "table",
    "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup",
    "col", "figure", "figcaption",
}
_VOID_TAGS = {"br", "hr", "img", "col"}
# tags whose CONTENT is dropped, not just the tag
_DROP_CONTENT_TAGS = {"script", "style", "template", "noscript",
                      "title", "textarea", "iframe", "xmp"}
_URL_ATTRS = {"href", "src"}
_ALLOWED_ATTRS = {
    "class", "style", "title", "alt", "align", "width", "height",
    "colspan", "rowspan", "scope", "href", "src", "start", "type",
    "lang", "dir",
}
_STYLE_BAD_RE = re.compile(
    r"(javascript:|expression\s*\(|url\s*\()", re.I)
_URL_SCHEME_RE = re.compile(r"^([a-zA-Z][a-zA-Z0-9+.\-]*):")


def _url_ok(val: str) -> bool:
    # strip entities + all whitespace/control chars (browsers do before
    # resolving the scheme, so "javas\ncript:" must be caught)
    v = re.sub(r"[\x00-\x20]+", "", html.unescape(val))
    m = _URL_SCHEME_RE.match(v)
    if not m:
        return True                       # relative / fragment / query
    scheme = m.group(1).lower()
    if scheme in ("http", "https", "mailto", "tel"):
        return True
    return v.lower().startswith("data:image/")


class _HtmlSanitizer(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0

    def _emit_open(self, tag, attrs, selfclose):
        kept = []
        for k, v in attrs:
            k = k.lower()
            if k not in _ALLOWED_ATTRS or k.startswith("on"):
                continue
            v = v or ""
            if k in _URL_ATTRS and not _url_ok(v):
                continue
            if k == "style" and _STYLE_BAD_RE.search(v):
                continue
            kept.append(f' {k}="{html.escape(v, quote=True)}"')
        slash = "/" if (selfclose or tag in _VOID_TAGS) else ""
        self.out.append(f"<{tag}{''.join(kept)}{slash}>")

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            self.skip += 1
            return
        if self.skip or tag not in _ALLOWED_TAGS:
            return
        self._emit_open(tag, attrs, False)

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS or self.skip or tag not in _ALLOWED_TAGS:
            return
        self._emit_open(tag, attrs, True)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            if self.skip:
                self.skip -= 1
            return
        if self.skip or tag not in _ALLOWED_TAGS or tag in _VOID_TAGS:
            return
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(html.escape(data))


def _sanitize_html(fragment: str) -> str:
    """Jupyter-style raw HTML in markdown, re-emitted from an allowlist
    of safe tags/attributes so no active content can survive."""
    s = _HtmlSanitizer()
    s.feed(fragment)
    s.close()
    return "".join(s.out)


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


# --------------------------------------------------------------------------
# HTML rendering
# --------------------------------------------------------------------------

_BADGE = {
    "figure": "figure", "dataset": "dataset", "transform": "transform",
    "diagnostic": "diagnostic", "metric": "print", "text": "print",
    "note": "markdown", "code": "code",
}


def _kind_class(kind: str) -> str:
    return {
        "figure": "k-figure", "diagnostic": "k-figure", "dataset": "k-dataset",
        "transform": "k-transform", "metric": "k-metric", "text": "k-print",
        "note": "k-note", "code": "k-code",
    }.get(kind, "k-code")


def _fig_pager(imgs) -> str:
    """Several figures from one cell: a pager, one figure at a time."""
    pages = "".join(
        f'<div class="figpage{" current" if i == 0 else ""}">{o.payload}'
        f'</div>' for i, o in enumerate(imgs))
    return (
        f'<div class="figpager" data-n="{len(imgs)}">{pages}'
        f'<div class="figpager-nav">'
        f'<button class="fp-btn fp-prev" title="Previous figure">'
        f'&#8249;</button>'
        f'<span class="fp-count">1 / {len(imgs)}</span>'
        f'<button class="fp-btn fp-next" title="Next figure">'
        f'&#8250;</button></div></div>')


def render_item(item: Item, sec_id: str = "") -> str:
    badge = _BADGE.get(item.kind, item.kind)
    kclass = _kind_class(item.kind)
    # a card's FILTER ROLE (what top-bar filter governs it) — distinct from
    # its output kind. Printed results (dataset/metric/text) are OUTPUT, not
    # code; only cells that are purely source are "code".
    if item.is_note:
        role = "markdown"
    elif item.kind in ("figure", "diagnostic"):
        role = "plot"
    elif item.kind == "code":
        role = "code"
    else:
        role = "output"
    ck_attr = ""
    # EVERY code-bearing cell (anything the Code filter governs — not a figure,
    # not a markdown note) carries data-ck so the advanced type filter can
    # reach it, INCLUDING plain "code". Unchecking every type then equals
    # Hide code. A strong type (imports/function/data/plotting/…) also labels
    # the cell and recolours its badge; plain "code" keeps the default look.
    if item.kind not in ("figure", "diagnostic") and not item.is_note:
        ck_attr = f' data-ck="{" ".join(item.code_kinds)}"'
        if item.code_kinds != ["code"]:
            badge = " · ".join(item.code_kinds[:3])
            kclass += f" ckmain-{item.code_kind}"
            kclass += "".join(f" ck-{c}" for c in item.code_kinds)
    # a cell's output splits into a PLOT part (figures — static images AND
    # live embeds like plotly/bokeh/vega/folium) and an OUTPUT part (printed
    # results) so the Plots and Output filters can act on them independently
    # of each other and of the cell's Code
    imgs = [o for o in item.outputs if o.has_image or o.has_interactive]
    others = [o for o in item.outputs
              if not (o.has_image or o.has_interactive)]
    fig_html = (_fig_pager(imgs) if len(imgs) > 1
                else "".join(o.payload for o in imgs))
    cb_parts = []
    if fig_html:
        # the zoom controls widen the whole CARD, so its border and header
        # grow with the figure instead of the plot spilling out of them
        kclass += " has-fig"
        pt_types: list[str] = []
        for o in imgs:
            if o.pt and o.pt not in pt_types:
                pt_types.append(o.pt)
        pt_attr = f' data-pt="{" ".join(pt_types)}"' if pt_types else ""
        cb_parts.append(
            f'<div class="cb-part cb-fig"{pt_attr}>'
            f'<div class="figzoom" aria-hidden="false">'
            f'<button class="fz-btn fz-out" title="Smaller (this figure)"'
            f'>&#8722;</button>'
            f'<button class="fz-btn fz-in" title="Bigger (this figure)"'
            f'>&#43;</button>'
            f'<button class="fz-btn fz-max" '
            f'title="Expand this figure full screen">&#10530;</button>'
            f'</div>{fig_html}</div>')
    if others:
        ot_types: list[str] = []
        for o in others:
            if o.ot not in ot_types:
                ot_types.append(o.ot)
        cb_parts.append(
            f'<div class="cb-part cb-out" data-ot="{" ".join(ot_types)}">'
            + "".join(o.payload for o in others) + "</div>")
        if role == "output":
            # the badge speaks the Output-types filter's language — a
            # defaultdict repr reads "dict", not a generic "print" (which
            # the Print checkbox then doesn't hide)
            badge = ot_types[0]
    out_html = "".join(cb_parts)

    # code: one or more labelled steps folded behind a single toggle
    code_block = ""
    steps = [s for s in item.steps if s.code.strip()]
    if steps and not item.is_note:
        multi = len(steps) > 1
        chunks = []
        for i, s in enumerate(steps, 1):
            label_html = ""
            if multi:
                lbl = html.escape(s.label)
                label_html = (
                    f'<div class="codestep-h"><span class="stepnum">{i}</span>'
                    f'<span class="steplabel">{lbl}</span></div>')
            extra_out = ""
            if multi and not s.is_primary and s.outputs:
                extra_out = ('<div class="codestep-out">'
                             + "".join(o.payload for o in s.outputs) + "</div>")
            chunks.append(
                f'<div class="codestep">{label_html}'
                f'<pre class="code"><code>{highlight_python(s.code)}</code></pre>'
                f"{extra_out}</div>")
        steps_count = (f'<span class="ct-steps">\u00b7 {len(steps)} steps</span>'
                       if multi else "")
        # a card with no output face IS its code: expanded, no toggle
        bare = not item.outputs
        is_open = item.code_visible or bare
        open_attr = " data-open='1'" if is_open else ""
        code_block = (
            f'<div class="codewrap{" bare" if bare else ""}"{open_attr}>'
            f'<button class="codetoggle" aria-expanded='
            f'"{"true" if is_open else "false"}">'
            f'<span class="chev">\u203a</span>'
            f'<span class="ct-show">Show code</span>'
            f'<span class="ct-hide">Hide code</span>{steps_count}</button>'
            f'<div class="codebody"><div class="codeinner">'
            f'{"".join(chunks)}</div></div></div>')

    caption = ""
    if item.caption:
        cap_html = html.escape(item.caption).replace("\n", "<br>")
        caption = f'<p class="caption">{cap_html}</p>'

    prov = ""
    if item.depends:
        chips = "".join(
            f'<a class="depchip" href="#" data-dep="{html.escape(d)}">{html.escape(d)}</a>'
            for d in item.depends)
        prov = f'<div class="prov"><span class="prov-l">derives from</span>{chips}</div>'

    id_tag = ""
    if item.node_id:
        id_tag = f'<span class="nodeid">{html.escape(item.node_id)}</span>'

    # figures get a "Plot trace" button -> opens a new tab: the docs view
    # subset to this plot's lineage cells + a dependency graph
    trace_btn = ""
    if item.kind in ("figure", "diagnostic"):
        trace_btn = (
            f'<button class="plot-trace-btn" type="button" '
            f'data-trace="{html.escape(item.anchor or item.item_id)}" '
            f'title="See every cell that builds this plot — as a code trace '
            f'and a dependency graph">&#9903; Plot trace</button>')

    body = out_html
    htmlsrc = ""
    if item.is_note:
        body = f'<div class="note">{md_to_html(item.caption)}</div>'
        # a note with no real heading gets NO title row — the amber edge
        # says "markdown" on hover instead of a generic MARKDOWN · Note
        if item.title.strip().lower() == "note":
            kclass += " note-untitled"
        # notes containing raw HTML render it, with a source toggle.
        # kept OUTSIDE .cardbody so a long-note clamp can't clip it.
        if _MD_HTMLBLOCK_RE.search(item.caption):
            htmlsrc = (
                '<pre class="note-src code"><code>'
                f'{html.escape(item.caption)}</code></pre>'
                '<button class="htmltoggle" '
                'title="Toggle this note between rendered and raw HTML">'
                '<span class="ht-show">&lt;/&gt;</span>'
                '<span class="ht-hide">&#10005; raw</span></button>')
        caption = ""

    # the card carries its OWN section id: per-section filters must survive
    # being cloned out of the document (tree view, plot-trace tab), where a
    # DOM-ancestor lookup would find no section and silently fall back to
    # the notebook default
    return (
        f'<article class="card {kclass}" id="card-{item.item_id}" '
        f'data-kind="{item.kind}" data-role="{role}" '
        f'data-node="{item.node_id}"{ck_attr} '
        f'data-secid="{html.escape(sec_id)}" '
        f'data-note="{"1" if item.is_note else "0"}" '
        f'data-anchor="{html.escape(item.anchor or item.item_id)}" tabindex="-1">'
        f'<header class="cardhead">'
        f'<span class="badge">{badge}</span>'
        f'<h3 class="cardtitle{" echo" if item.title_echo else ""}">'
        f'{html.escape(item.title)}</h3>'
        f'{id_tag}{trace_btn}'
        f'<button class="cell-eye" type="button" '
        f'title="Hide this cell (it stays in the sidebar so you can bring '
        f'it back)" aria-label="Hide this cell">&#128065;</button>'
        f'</header>'
        f'<div class="cardbody">{body}</div>'
        f'{htmlsrc}{caption}{prov}{code_block}</article>')


def render_nav(doc: Document) -> str:
    parts = ['<nav class="nav" aria-label="Analysis sections">']
    # key: one entry per item kind (incl. code subtypes) present, GROUPED
    # (markdown | plots | code | output) with a divider between groups — so the
    # two "print" dots (a CODE cell that prints vs a printed VALUE) read apart.
    # Shown at the TOP of the sidebar.
    labels = {"k-figure": "figure", "k-dataset": "dataset",
              "k-transform": "transform", "k-metric": "print",
              "k-note": "markdown", "k-print": "print", "k-code": "code",
              "ckmain-imports": "imports", "ckmain-function": "function",
              "ckmain-data": "data", "ckmain-constant": "constant",
              "ckmain-settings": "settings", "ckmain-plotting": "plotting",
              "ckmain-print": "print"}

    def _key_group(kc: str) -> str:
        if kc == "k-note":
            return "markdown"
        if kc == "k-figure":
            return "plots"
        if kc in ("k-dataset", "k-print", "k-metric"):
            return "output"
        return "code"        # ckmain-* + k-code + k-transform

    seen: list[str] = []
    for s in doc.sections:
        for it in s.items:
            kc = (f"ckmain-{it.code_kind}"
                  if it.kind not in ("figure", "diagnostic")
                  and it.code_kinds != ["code"] else _kind_class(it.kind))
            if kc not in seen:
                seen.append(kc)
    if seen:
        parts.append('<div class="navkey"><span class="navkey-h">key</span>')
        first = True
        for grp in ("markdown", "plots", "code", "output"):
            kcs = [kc for kc in seen if _key_group(kc) == grp]
            if not kcs:
                continue
            if not first:
                parts.append('<span class="navkey-div" aria-hidden="true">'
                             '</span>')
            first = False
            shown: set[str] = set()   # one dot per label within a group
            for kc in kcs:
                lab = labels.get(kc, kc)
                if lab in shown:       # e.g. k-metric + k-print both "print"
                    continue
                shown.add(lab)
                parts.append(f'<span class="nk {kc}"><span class="dot">'
                             f'</span>{lab}</span>')
        parts.append('</div>')
    figs_own = [sum(1 for it in s.items
                    if it.kind in ("figure", "diagnostic"))
                for s in doc.sections]
    for si, s in enumerate(doc.sections):
        # the badge counts the whole SUBTREE (deeper tiers that follow), so
        # a collapsed parent still advertises the figures inside it
        figs = figs_own[si]
        for sj in range(si + 1, len(doc.sections)):
            if doc.sections[sj].level <= s.level:
                break
            figs += figs_own[sj]
        parts.append(
            f'<div class="navsec-row navsec-l{s.level}" '
            f'data-sec="{s.section_id}" data-level="{s.level}">'
            f'<button class="navsec-chev" aria-expanded="true" '
            f'title="Collapse this section">▾</button>'
            f'<a class="navsec" href="#sec-{s.section_id}" '
            f'data-sec="{s.section_id}">'
            f'<span class="navsec-t">{html.escape(s.title)}</span>'
            f'<span class="navsec-c">{figs or ""}</span></a>'
            f'<span class="navsec-eye" role="button" tabindex="0" '
            f'title="Hide or show just this heading" '
            f'aria-label="Hide or show just this heading">&#128065;</span>'
            f'<span class="navsec-hideall" role="button" tabindex="0" '
            f'title="Hide or show this whole section" '
            f'aria-label="Hide or show this whole section">&#8801;</span>'
            f'</div>')
        parts.append(f'<div class="navitems navitems-l{s.level}" '
                     f'data-sec="{s.section_id}">')
        last_sub = None
        for it in s.items:
            if it.subsection and it.subsection != last_sub:
                parts.append(
                    f'<div class="navsub">{html.escape(it.subsection)}</div>')
                last_sub = it.subsection
            dot = _kind_class(it.kind)
            if (it.kind not in ("figure", "diagnostic")
                    and it.code_kinds != ["code"]):
                dot += f" ckmain-{it.code_kind}"
            parts.append(
                f'<a class="navitem {dot}" href="#card-{it.item_id}" '
                f'data-item="{it.item_id}">'
                f'<span class="dot"></span>'
                f'<span class="navitem-t">{html.escape(it.title)}</span>'
                f'<span class="navitem-eye" role="button" tabindex="0" '
                f'title="Hide or show this cell" '
                f'aria-label="Hide or show this cell">&#128065;</span></a>')
        parts.append('</div>')
    parts.append('</nav>')
    return "".join(parts)


def render_sections(doc: Document) -> str:
    """The stage content: every section with its cards. Reused by the widget."""
    sections_html: list[str] = []
    for s in doc.sections:
        sid = s.section_id
        cards = "".join(render_item(it, sid) for it in s.items)
        eyebrow = f'section {s.number}' if s.number else 'section'
        sections_html.append(
            f'<section class="section sec-l{s.level}" id="sec-{sid}" '
            f'data-sec="{sid}" data-level="{s.level}">'
            f'<div class="sectionhead sectionhead-l{s.level}">'
            f'<button class="sec-chev" data-sec="{sid}" aria-expanded="true" '
            f'title="Collapse / expand this section">&#9662;</button>'
            f'<div class="sectionhead-txt">'
            f'<span class="eyebrow">{eyebrow}</span>'
            f'<h2>{html.escape(s.title)}</h2></div>'
            f'<button class="sec-eye" data-sec="{sid}" '
            f'title="Hide just this heading (the cards below stay)" '
            f'aria-label="Hide just this heading">&#128065;</button>'
            f'<button class="sec-hideall" data-sec="{sid}" '
            f'title="Hide this whole section — the heading and every card '
            f'in it (restore it from the sidebar)" '
            f'aria-label="Hide this whole section">hide section</button>'
            f'</div>{cards}</section>')
    return "".join(sections_html)


def doc_meta(doc: Document) -> str:
    n_fig = sum(1 for s in doc.sections for it in s.items
                if it.kind in ("figure", "diagnostic"))
    n_data = sum(1 for s in doc.sections for it in s.items if it.kind == "dataset")
    return (f"{n_fig} figures \u00b7 {n_data} datasets "
            f"\u00b7 {len(doc.sections)} sections")


def deck_payload(doc: Document) -> str:
    """JSON blob embedded in the page: the card index + any saved deck.

    Slide payloads are NOT duplicated here -- the deck JS clones card DOM
    nodes (figures, notes, code) already present on the page.
    """
    items = []
    for s in doc.sections:
        for it in s.items:
            items.append({
                "anchor": it.anchor or it.item_id,
                "card": it.item_id,
                "title": it.title,
                "kind": "note" if it.is_note else it.kind,
                "codeKind": it.code_kind,
                "codeKinds": it.code_kinds,
                "section": s.section_id,
                "sectitle": s.title,
                "secnum": s.number,
                "subsection": it.subsection or "",
                "hasCode": any(st.code.strip() for st in it.steps),
                "chain": it.chain,
            })
    payload = {
        "title": doc.title,
        "meta": doc_meta(doc),
        "stem": doc.source_name,
        "sections": [{"id": s.section_id, "title": s.title}
                     for s in doc.sections],
        "items": items,
        "presentations": doc.presentations,
    }
    # "</" would terminate the inline <script> block early
    return json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")


def render_graph_panel(doc: Document) -> str:
    graph_svg = build_graph_svg(doc)
    if not graph_svg:
        return ""
    return (
        '<div class="railgraph">'
        '<div class="railgraph-h"><span class="eyebrow">analysis graph</span>'
        '<button class="rg-collapse" aria-expanded="true" '
        'title="Collapse graph">\u2013</button></div>'
        f'<div class="railgraph-b">{graph_svg}</div></div>')


def render_shell(doc: Document, path: str = "") -> str:
    """One notebook's complete document view (rail + toolbar + cards).

    Several of these mount side by side as tabs; the embedded `nb-data`
    JSON is the card index the tab/deck JS consumes.
    """
    stem = doc.source_name or "notebook"
    path_attr = f' data-path="{html.escape(path)}"' if path else ""
    return _SHELL_TEMPLATE.format(
        stem=html.escape(stem),
        path_attr=path_attr,
        title=html.escape(doc.title),
        meta=html.escape(doc_meta(doc)),
        nav=render_nav(doc),
        graph_panel=render_graph_panel(doc),
        sections=render_sections(doc),
        rawview=doc.raw_html or "",
        nb_data=deck_payload(doc),
    )


def render_page(docs: list[Document], mode: str = "static",
                app_cfg: dict | None = None) -> str:
    """The full HTML page: tab strip, one shell per notebook, deck, app UI.

    mode "static": fixed tabs, shareable file (tab strip hidden when only
    one notebook). mode "app": served by the local server; tabs can be
    opened / closed / reloaded and presentations save to the project file.
    """
    cfg = app_cfg or {}
    paths = cfg.get("paths", {})
    shells = "".join(render_shell(d, path=paths.get(d.source_name, ""))
                     for d in docs)
    app_data = {
        "mode": mode,
        "token": cfg.get("token", ""),
        "root": cfg.get("root", ""),
        "project": {
            "presentations": cfg.get("presentations", []),
            "recent": cfg.get("recent", []),
        },
    }
    if len(docs) == 1:
        title = docs[0].title
    elif docs:
        title = f"{docs[0].title} (+{len(docs) - 1})"
    else:
        title = "Junoview"
    return _icons(_TEMPLATE.format(
        title=html.escape(title),
        shells=shells,
        css=_CSS,
        app_css=_APP_CSS,
        js=_JS,
        mathjax=_MATHJAX,
        deck_shell=_DECK_HTML,
        app_data=json.dumps(app_data, ensure_ascii=False).replace("</", "<\\/"),
        deck_css=_DECK_CSS,
        deck_js=_DECK_JS,
        repo=_REPO_URL,
        kofi=_KOFI_URL,
        help_html=_HELP_HTML,
        logo=_LOGO_SVG,
        favicon=_FAVICON,
    ))


def render_html(doc: Document, source_name: str | None = None) -> str:
    """Single-notebook page (kept for the widget and simple exports)."""
    if source_name:
        doc.source_name = source_name
    return render_page([doc])


# --------------------------------------------------------------------------
# Static assets
# --------------------------------------------------------------------------

_CSS = r"""
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Serif:ital,wght@0,400;1,400&display=swap');

:root{
  --ink:#16202b; --ink-2:#33414f; --ink-3:#69788a;
  --paper:#fbfcfd; --paper-2:#eef2f6; --paper-3:#e2e8ee;
  --line:#d8e0e8;
  --chrome:#11202c; --chrome-2:#16273544; --chrome-line:#ffffff14;
  --chrome-ink:#cdd9e3; --chrome-ink-2:#7e93a4;
  --cyan:#39a9c0; --cyan-deep:#1f7e93;
  --amber:#cf9a4e; --amber-soft:#caa06a66;
  --sans:'IBM Plex Sans',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  --serif:'IBM Plex Serif',Georgia,serif;
  --rad:6px; --rail-w:300px;
}
*{box-sizing:border-box}
/* reserve the scrollbar's width at all times: without it, switching to a
   view that does not scroll the page (the tree) widens the viewport and
   the CENTRED ribbon slides sideways — every button moving a few px is
   exactly the jump the user reported (2026-07-30) */
html{scroll-behavior:smooth;scrollbar-gutter:stable}
body{margin:0;font-family:var(--sans);color:var(--ink);
  background:var(--paper-2);line-height:1.5;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}

/* ---------- layout ---------- */
.shell{display:grid;grid-template-columns:var(--rail-w) 1fr;min-height:100vh;}
.rail{position:sticky;top:0;height:100vh;overflow-y:auto;
  background:var(--chrome);color:var(--chrome-ink);
  border-right:1px solid var(--chrome-line);
  display:flex;flex-direction:column;}
.stage{min-width:0;}

/* ---------- rail header ---------- */
.railhead{padding:22px 22px 16px;border-bottom:1px solid var(--chrome-line);}
.brand{font-family:var(--mono);font-size:10.5px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--cyan);margin:0 0 12px;display:flex;
  align-items:center;gap:8px;}
.brand::before{content:"";width:7px;height:7px;border-radius:50%;
  background:var(--cyan);box-shadow:0 0 0 3px #39a9c029;}
.railtitle{font-size:18px;font-weight:600;line-height:1.25;margin:0;
  color:#eef4f8;letter-spacing:-.01em;}
.railmeta{font-family:var(--mono);font-size:10.5px;color:var(--chrome-ink-2);
  margin-top:8px;letter-spacing:.02em;}
/* where this notebook came from: path + git commit + earlier versions,
   with the reload button beside it (it used to hide on the tab) */
.railfile{display:flex;gap:4px;margin-top:11px;}
.rf-btn{font-family:var(--mono);font-size:10px;letter-spacing:.04em;
  border:1px solid #ffffff40;background:#ffffff12;color:var(--chrome-ink);
  padding:6px 10px;border-radius:5px;cursor:pointer;transition:all .13s;
  display:inline-flex;align-items:center;gap:5px;line-height:1;}
.rf-btn:hover{border-color:var(--cyan);color:#fff;background:#ffffff1e;}
body.light .rf-btn{border-color:var(--line);background:#fff;
  color:var(--ink-2);}
.rf-info{flex:1;justify-content:flex-start;min-width:0;}
.rf-reload{flex:none;font-size:12px;padding:5px 9px;}
.rf-btn[hidden]{display:none!important;}
/* ---- CUSTOM VIEW: the styling bar + style panel (2026-07-29) --------
   A custom view is edited IN the document (you see exactly what you get),
   so its chrome is a second bar under the filter ribbon rather than a
   separate stage. */
.stylebar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  padding:7px 16px 8px;border-top:1px solid var(--chrome-line);
  background:#0f1b28;}
body.light .stylebar{background:#eef3f7;}
.stylebar[hidden]{display:none;}
.sb-lab{font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--chrome-ink-2);opacity:.8;}
body.light .sb-lab{color:var(--ink-3);}
.sb-name{font-family:var(--sans);font-size:13px;font-weight:600;
  color:var(--chrome-ink);max-width:220px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
body.light .sb-name{color:var(--ink);}
.sb-spring{flex:1;}
.sb-hint{font-family:var(--mono);font-size:9px;letter-spacing:.05em;
  color:var(--chrome-ink-2);opacity:.75;}
body.light .sb-hint{color:var(--ink-3);}
.stylebar .toggle{height:30px;box-sizing:border-box;padding:0 13px;
  font-size:11.5px;flex:none;white-space:nowrap;
  border:1px solid #ffffff40;background:#ffffff12;color:#d7e3ec;
  border-radius:6px;cursor:pointer;font-family:var(--mono);
  display:inline-flex;align-items:center;line-height:1;}
.stylebar .toggle:hover{border-color:var(--cyan);color:#fff;}
.stylebar .toggle[hidden]{display:none!important;}
.stylebar .toggle.primary{background:var(--cyan);border-color:var(--cyan);
  color:#04222b;font-weight:600;}
.stylebar .toggle[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
body.light .stylebar .toggle{background:#fff;border-color:var(--line);
  color:var(--ink-2);}
body.light .stylebar .toggle:hover{border-color:var(--cyan);color:var(--ink);}
body.light .stylebar .toggle.primary{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
/* the panel floats at body level — a sticky/positioned ancestor would
   trap it behind the header (the File-info panel learned this already) */
.stylepanel{position:fixed;z-index:210;width:302px;max-height:74vh;
  overflow-y:auto;background:#16273a;border:1px solid #ffffff22;
  border-radius:9px;padding:11px 12px 13px;
  box-shadow:0 14px 44px #00000070;}
.stylepanel[hidden]{display:none;}
body.light .stylepanel{background:#fff;border-color:var(--line);
  box-shadow:0 14px 44px #00000026;}
.sp-h{font-family:var(--mono);font-size:9px;letter-spacing:.15em;
  text-transform:uppercase;color:#7e93a4;padding:0 0 8px;}
body.light .sp-h{color:var(--ink-3);}
.sp-sub{font-size:11.5px;color:#9fb2c2;padding:0 0 9px;line-height:1.45;}
body.light .sp-sub{color:var(--ink-3);}
.sp-row{display:flex;align-items:center;gap:8px;padding:4px 0;}
.sp-rl{flex:1;font-size:12px;color:#cdd9e3;}
body.light .sp-rl{color:var(--ink-2);}
.sp-row input[type=color]{width:34px;height:24px;padding:0;flex:none;
  background:none;border:1px solid #ffffff2e;border-radius:5px;
  cursor:pointer;}
.sp-row input[type=range]{width:118px;flex:none;}
.sp-row select,.sp-num{background:#0f1b28;border:1px solid #ffffff2e;
  color:#cdd9e3;font-family:var(--mono);font-size:11px;padding:4px 6px;
  border-radius:5px;flex:none;}
body.light .sp-row select,body.light .sp-num{background:#fff;
  border-color:var(--line);color:var(--ink-2);}
.sp-num{width:56px;}
.sp-val{font-family:var(--mono);font-size:10px;color:#7e93a4;width:38px;
  text-align:right;flex:none;}
.sp-btns{display:flex;gap:6px;padding-top:10px;margin-top:8px;
  border-top:1px solid #ffffff14;}
.sp-btns .toggle{flex:1;justify-content:center;}
.sp-warn{font-size:11px;color:#e6b877;padding:7px 0 2px;line-height:1.4;}
/* while styling: markdown cells and headings advertise that they are
   clickable targets, and each carries its own style button */
body.styling .card[data-note="1"],body.styling .sectionhead{cursor:pointer;}
body.styling .card[data-note="1"]:hover,
body.styling .sectionhead:hover{outline:2px dashed var(--cyan);
  outline-offset:3px;}
body.styling .card[data-note="1"].sty-sel,
body.styling .sectionhead.sty-sel{outline:2px solid var(--cyan);
  outline-offset:3px;}
.sty-btn{position:absolute;top:6px;left:8px;z-index:6;
  font-family:var(--mono);font-size:9px;letter-spacing:.08em;
  text-transform:uppercase;padding:3px 7px;border-radius:5px;
  border:1px solid var(--cyan);background:var(--paper);color:var(--cyan-deep);
  cursor:pointer;opacity:0;transition:opacity .12s;}
.card[data-note="1"]:hover .sty-btn,.sty-btn:focus-visible{opacity:1;}
.sty-btn:hover{background:var(--cyan);color:#04222b;}
/* a section's style button sits on its header line, before the eye */
.sectionhead .sty-btn{position:static;opacity:.7;margin-left:auto;}
.sectionhead:hover .sty-btn{opacity:1;}
/* a target that carries its OWN style says so — that is what the
   "Override individual styles" button is about */
.sty-own{border-color:var(--amber)!important;color:var(--amber)!important;}
.rf-panel{margin-top:8px;border:1px solid var(--chrome-line);
  border-radius:7px;padding:9px 10px;background:#ffffff08;}
.rf-panel[hidden]{display:none;}
/* the same panel, floated under the ribbon's File button */
.rf-panel.rf-float{position:fixed;z-index:200;margin-top:0;width:372px;
  background:#16273a;border-color:#ffffff22;
  box-shadow:0 12px 40px #00000066;}
body.light .rf-panel.rf-float{background:#fff;border-color:var(--line);}
.rf-row{display:flex;flex-direction:column;gap:1px;margin-bottom:8px;
  min-width:0;}
.rf-row:last-child{margin-bottom:0;}
.rf-k{font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--chrome-ink-2);}
/* one tidy line per fact: truncate, don't break a URL mid-word across
   three lines. The full value is on the element's title. */
.rf-v{font-family:var(--mono);font-size:10.5px;color:var(--chrome-ink);
  line-height:1.5;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
/* the commit message is prose — it may wrap, on word boundaries */
.rf-v.rf-sub{white-space:normal;overflow-wrap:anywhere;}
.rf-v.hash{color:var(--cyan);}
.rf-sub{color:var(--chrome-ink-2);font-size:9.5px;}
.rf-acts{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;}
.rf-live{color:#7fd0b8;}
.rf-old{color:var(--amber);}
/* the commit hash IS a control, so it has to look like one */
.rf-hashbtn{background:#39a9c018;border:1px solid #39a9c059;
  padding:4px 9px;cursor:pointer;border-radius:5px;
  text-align:left;font-family:var(--mono);font-size:10.5px;
  color:var(--cyan);display:inline-flex;align-items:center;gap:7px;
  align-self:flex-start;max-width:100%;}
.rf-hashbtn:hover{background:#39a9c02e;border-color:var(--cyan);
  color:#eaf6fa;}
.rf-caret{font-size:8px;transition:transform .13s;opacity:.85;}
.rf-hashbtn.open .rf-caret{transform:rotate(180deg);}
.rf-commits{margin-top:7px;max-height:240px;overflow-y:auto;
  border-top:1px solid var(--chrome-line);padding-top:6px;}
.rf-commits[hidden]{display:none;}
.rf-crow{display:flex;align-items:stretch;gap:3px;}
.rf-commit{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;
  flex:1;min-width:0;text-align:left;background:none;
  border:1px solid transparent;
  border-radius:5px;padding:5px 6px;cursor:pointer;color:inherit;}
.rf-commit:hover{background:#ffffff0e;border-color:var(--chrome-line);}
/* the same version, but side by side instead of in place */
.rf-newtab{flex:none;width:26px;background:none;cursor:pointer;
  border:1px solid transparent;border-radius:5px;
  color:var(--chrome-ink-2);font-size:12px;line-height:1;}
.rf-newtab:hover{background:#ffffff0e;border-color:var(--chrome-line);
  color:var(--chrome-ink);}
body.light .rf-newtab:hover{background:#00000008;}
.rf-ch{font-family:var(--mono);font-size:10px;color:var(--cyan);}
.rf-cm{font-family:var(--sans);font-size:11px;color:var(--chrome-ink);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rf-cd{grid-column:2;font-family:var(--mono);font-size:9px;
  color:var(--chrome-ink-2);}
body.light .rf-commit:hover{background:#00000008;}
body.light .rf-cm{color:var(--ink-2);}
body.light .rf-cd{color:var(--ink-3);}
body.light .rf-btn{border-color:var(--line);color:var(--ink-3);}
body.light .rf-btn:hover{color:var(--ink);}
body.light .rf-panel{background:#00000005;border-color:var(--line);}
body.light .rf-v{color:var(--ink-2);}
body.light .rf-k,body.light .rf-sub{color:var(--ink-3);}

/* ---------- nav ---------- */
.nav{padding:14px 12px 8px;flex:1 0 auto;}
.navsec{display:flex;justify-content:space-between;align-items:center;
  gap:8px;padding:9px 10px;margin-top:6px;border-radius:var(--rad);
  text-decoration:none;color:var(--chrome-ink);font-weight:600;font-size:13.5px;
  letter-spacing:-.005em;transition:background .15s,color .15s;}
.navsec:hover{background:#ffffff0c;}
.navsec.active{background:#39a9c014;color:#eef4f8;}
/* a section row = a collapse chevron + the (clickable) section link */
.navsec-row{display:flex;align-items:center;gap:1px;margin-top:6px;}
.navsec-row .navsec{flex:1;margin-top:0;min-width:0;}
.navsec-chev{background:none;border:none;color:var(--chrome-ink-2);
  cursor:pointer;font-size:10px;line-height:1;padding:6px 3px;flex:none;
  border-radius:4px;transition:transform .15s,color .15s;}
.navsec-chev:hover{color:var(--chrome-ink);}
.navsec-row.collapsed .navsec-chev{transform:rotate(-90deg);}
.navitems.nav-collapsed{display:none;}
/* the three heading tiers nest progressively (indent + shrinking type) */
.navsec-l1 .navsec{font-size:14px;}
.navsec-l2{margin-left:12px;}
.navsec-l2 .navsec{font-size:12.5px;font-weight:500;}
.navsec-l3{margin-left:24px;}
.navsec-l3 .navsec{font-size:11.5px;font-weight:500;
  color:var(--chrome-ink-2);padding:6px 10px;}
/* Long notebooks: let the browser skip layout+paint for cards that are
   off-screen. Measured on a 260-card document this is where the time
   goes — not our JS, which runs in ~1ms. `auto` remembers each card's
   last real size, so the scrollbar stays honest. */
.content .card{content-visibility:auto;contain-intrinsic-size:auto 300px;}
/* …but never for a card that has been CLONED somewhere it must render in
   full: slide frames, tree nodes, trace steps, the raw view, printing */
.an-cell .card,.spane .card,.slide-fig .card,.tree-node .card,
.vo-step .card,.print-page .card,.rawview .card,.figmax .card{
  content-visibility:visible;contain-intrinsic-size:none;}
@media print{.content .card{content-visibility:visible!important;
  contain-intrinsic-size:none!important;}}
/* fully hidden (filtered out) cards + their sidebar entries disappear */
.card.is-hidden,.section.is-hidden{display:none;}
.navitem.nav-hidden,.navsec-row.nav-hidden,.navitems.nav-hidden{
  display:none;}
.navsec-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.navsec-c{font-family:var(--mono);font-size:10px;color:var(--cyan);
  background:#39a9c016;border-radius:20px;padding:1px 7px;min-width:18px;
  text-align:center;}
.navsec-c:empty{display:none;}
.navitems{margin:2px 0 4px 4px;padding-left:8px;
  border-left:1px solid var(--chrome-line);}
/* cell lists indent with their section's tier */
.navitems-l2{margin-left:16px;}
.navitems-l3{margin-left:28px;}
.navsub{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--chrome-ink-2);
  padding:9px 10px 3px;}
.navitem{display:flex;align-items:center;gap:9px;padding:5px 10px;
  border-radius:5px;text-decoration:none;color:var(--chrome-ink-2);
  font-size:12.5px;transition:color .15s,background .15s;}
.navitem:hover{color:var(--chrome-ink);background:#ffffff08;}
.navitem.active{color:#eef4f8;}
.navitem-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
/* per-cell eye in the sidebar: click to hide/show a single cell. A cell
   hidden this way STAYS in the sidebar (dimmed, slashed eye) to restore. */
.navitem-eye{flex:none;font-size:11px;line-height:1;padding:1px 4px;
  border-radius:4px;position:relative;opacity:0;color:inherit;
  transition:opacity .12s,background .12s;}
.navitem:hover .navitem-eye,.navitem-eye:focus{opacity:.6;}
.navitem-eye:hover{opacity:1;background:#ffffff14;}
.navitem.cell-off{opacity:.5;}
.navitem.cell-off .navitem-eye{opacity:.9;}
.navitem.cell-off .navitem-eye::after{content:"";position:absolute;
  left:3px;right:3px;top:calc(50% - 1px);height:1.5px;background:currentColor;
  transform:rotate(-18deg);border-radius:2px;}
.navitem .dot{width:9px;height:9px;border-radius:3px;flex:none;
  background:var(--chrome-ink-2);}
.navitem.k-figure .dot,.nk.k-figure .dot{background:var(--cyan);}
.navitem.k-dataset .dot,.nk.k-dataset .dot{background:#4d90c0;}
.navitem.k-transform .dot,.nk.k-transform .dot{background:#5b7589;}
.navitem.k-metric .dot,.nk.k-metric .dot{background:#46a892;}
.navitem.k-note .dot,.nk.k-note .dot{background:var(--amber);
  border-radius:50%;}
.navitem.k-code .dot,.nk.k-code .dot{background:#56627033;
  border:1px solid #ffffff22;}
.navitem.ckmain-imports .dot,.nk.ckmain-imports .dot{background:#a3855c;}
.navitem.ckmain-function .dot,.nk.ckmain-function .dot{background:#46a892;}
.navitem.ckmain-data .dot,.nk.ckmain-data .dot{background:#4d90c0;}
.navitem.ckmain-constant .dot,.nk.ckmain-constant .dot{background:#9a7cc0;}
.navitem.ckmain-settings .dot,.nk.ckmain-settings .dot{background:#5b7589;}
.navitem.ckmain-plotting .dot,.nk.ckmain-plotting .dot{background:#39a9c0;}
.navitem.ckmain-print .dot,.nk.ckmain-print .dot{background:#cf9a4e;}
.navitem.ckmain-comments .dot,.nk.ckmain-comments .dot{background:#5f7386;}
/* light theme needs its own — a generic body.light .dot outranks these */
body.light .navitem.ckmain-imports .dot,body.light .nk.ckmain-imports .dot{
  background:#a3855c;}
body.light .navitem.ckmain-function .dot,body.light .nk.ckmain-function .dot{
  background:#46a892;}
body.light .navitem.ckmain-data .dot,body.light .nk.ckmain-data .dot{
  background:#4d90c0;}
body.light .navitem.ckmain-constant .dot,body.light .nk.ckmain-constant .dot{
  background:#9a7cc0;}
body.light .navitem.ckmain-settings .dot,body.light .nk.ckmain-settings .dot{
  background:#5b7589;}
body.light .navitem.ckmain-plotting .dot,body.light .nk.ckmain-plotting .dot{
  background:#39a9c0;}
body.light .navitem.ckmain-comments .dot,body.light .nk.ckmain-comments .dot{background:#5f7386;}
body.light .navitem.ckmain-print .dot,body.light .nk.ckmain-print .dot{
  background:#cf9a4e;}

/* ---------- nav key (what the dot colours mean) ---------- */
.navkey{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;
  padding:10px 12px 12px;margin:8px 10px 0;
  border-top:1px solid var(--chrome-line);}
.navkey-h{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--chrome-ink-2);flex:0 0 100%;}
.nk{display:inline-flex;align-items:center;gap:6px;font-size:11px;
  font-family:var(--mono);color:var(--chrome-ink-2);}
.nk .dot{width:6px;height:6px;border-radius:2px;flex:none;
  background:var(--chrome-ink-2);}
/* a thin rule marking the markdown | plots | code | output groups */
.navkey-div{width:1px;height:11px;flex:none;align-self:center;
  background:var(--chrome-line);margin:0 -3px;}
body.light .navkey-div{background:var(--line);}

/* ---------- rail graph (signature) ---------- */
.railgraph{border-top:1px solid var(--chrome-line);padding:14px 14px 20px;
  margin-top:auto;background:#0c1822;}
.railgraph-h{display:flex;justify-content:space-between;align-items:center;
  margin-bottom:8px;}
.railgraph .eyebrow{color:var(--amber);}
.rg-collapse{background:none;border:1px solid var(--chrome-line);
  color:var(--chrome-ink-2);width:22px;height:22px;border-radius:5px;
  cursor:pointer;font-size:14px;line-height:1;}
.rg-collapse:hover{color:var(--chrome-ink);border-color:#ffffff33;}
.railgraph-b{overflow:auto;max-height:46vh;transition:max-height .3s ease;}
.railgraph.collapsed .railgraph-b{max-height:0;overflow:hidden;}
.provsvg text{font-family:var(--mono);font-size:9.5px;fill:#dfeaf1;
  pointer-events:none;}
.provedge{fill:none;stroke:var(--amber-soft);stroke-width:1.4;
  transition:stroke .2s,stroke-width .2s;}
.provedge.lit{stroke:var(--amber);stroke-width:2.2;}
.provnode{cursor:pointer;}
.provnode rect{transition:filter .2s,stroke .2s;stroke:transparent;stroke-width:2;}
.provnode:hover rect{filter:brightness(1.18);}
.provnode.active rect{stroke:var(--cyan);filter:brightness(1.12)
  drop-shadow(0 0 6px #39a9c077);}
.provnode:focus-visible rect{stroke:var(--cyan);outline:none;}

/* ---------- document identity bar (filename + full path) ---------- */
.docbar{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;
  padding:2px 0 14px;margin-bottom:6px;border-bottom:1px solid var(--line);}
.docbar[hidden]{display:none;}
.docbar-ic{font-size:13px;flex:none;opacity:.7;}
.docbar-nm{font-size:15px;font-weight:600;color:var(--ink);
  letter-spacing:-.01em;}
.docbar-p{font-family:var(--mono);font-size:11px;color:var(--ink-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  max-width:100%;min-width:0;flex:1;direction:rtl;text-align:left;}
.docbar-p:empty{display:none;}
body:not(.light) .docbar{border-bottom-color:#ffffff14;}
body:not(.light) .docbar-nm{color:#e6edf3;}
body:not(.light) .docbar-p{color:#8ba0b2;}

/* ---------- toolbar ---------- */
.toolbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;
  gap:12px;padding:12px 28px;background:#fbfcfdf2;
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line);}
.menubtn{display:none;}
.tb-title{font-family:var(--mono);font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-3);margin-right:auto;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tb-actions{display:flex;gap:8px;flex:none;}
.toggle{font-family:var(--mono);font-size:11px;letter-spacing:.04em;
  border:1px solid var(--line);background:#fff;color:var(--ink-2);
  padding:7px 12px;border-radius:var(--rad);cursor:pointer;
  transition:all .15s;display:inline-flex;align-items:center;gap:7px;}
/* an author `display` beats the UA's [hidden] rule, so say it explicitly —
   without this, every el.hidden=true on a .toggle silently does nothing */
.toggle[hidden],.dbtn[hidden],.fgrp[hidden],.fgrp-row[hidden]{
  display:none!important;}
.toggle:hover{border-color:var(--cyan);color:var(--ink);}
.toggle[aria-pressed="true"]{background:var(--ink);color:#eef4f8;
  border-color:var(--ink);}
/* the state colour rides on the button's own ICON now — a separate dot
   said the same thing twice and cost the bar ~56px it did not have */
.toggle.tv .tdot{display:none;}
.toggle.tv .bic{color:var(--cyan);opacity:1;}
.toggle.tv.half .bic{color:var(--amber);}
.toggle.tv.off .bic{opacity:.4;}
.toggle.tv.mixed .bic{color:var(--amber);opacity:.8;}
.toggle .tdot{width:6px;height:6px;border-radius:50%;background:currentColor;
  opacity:.4;}
/* every state word occupies the same slot, so the bar never re-flows
   just because a filter changed (On / Folded / Off / Mixed) */
.tvstate{display:inline-block;width:4.4ch;text-align:left;
  margin-left:.4em;overflow:hidden;}
.toggle[aria-pressed="true"] .tdot{opacity:1;background:var(--cyan);}
/* view-mode buttons (Docs / Present): pressed = the view you are in */
.toggle.mode[aria-pressed="true"]{background:var(--ink);color:#eef4f8;
  border-color:var(--ink);}
.tb-sep{width:1px;height:22px;background:var(--line);margin:0 4px;
  flex:none;}
/* per-type state buttons: label shows the CURRENT state. Code cycles
   Visible (cyan dot) -> Collapsed (amber, half) -> Hidden (dim). */
.toggle.tv .tdot{opacity:1;background:var(--cyan);}
.toggle.tv.half .tdot{background:var(--amber);}
.toggle.tv.off .tdot{opacity:.3;background:currentColor;}
.toggle.tv.off{color:var(--ink-3);}
/* the selected sections disagree about this filter */
.toggle.tv.mixed .tdot{background:linear-gradient(90deg,
  var(--cyan) 50%,var(--ink-3) 50%);opacity:1;}
/* "Apply to" is set to no sections at all — nothing to filter */
.toggle.notarget{opacity:.4;cursor:not-allowed;}
/* a section filtered differently from the notebook default says so */
.section.has-fover .sectionhead .eyebrow::after{content:" · filtered";
  color:var(--amber);letter-spacing:.12em;}

/* ---------- content ---------- */
.content{max-width:920px;margin:0 auto;padding:30px 28px 30vh;}
.section{margin-bottom:14px;scroll-margin-top:70px;}
/* headings read the --hd-* vars for the same reason the notes read
   --md-*: a custom view can restyle every heading, one section's
   heading, or leave them alone (the fallbacks are the stock design) */
.sectionhead{padding:24px 0 6px;margin-bottom:8px;
  border-bottom:var(--hd-bw,1px) solid var(--hd-bd,var(--line));
  background:var(--hd-bg,transparent);
  display:flex;align-items:center;gap:8px;}
.sectionhead-txt{flex:1;min-width:0;}
.eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--hd-accent,var(--cyan-deep));
  display:var(--hd-eyebrow,block);margin-bottom:6px;}
.sectionhead h2{font-size:calc(26px * var(--hd-size,1));
  font-weight:var(--hd-wt,600);margin:0;letter-spacing:-.02em;
  color:var(--hd-col,var(--ink));text-transform:var(--hd-caps,none);
  font-family:var(--hd-font,inherit);}
/* three heading tiers (# / ## / ###): descending size + indent, and the
   deepest drops the underline so the levels read apart at a glance.
   (These must FOLLOW the base .sectionhead h2 rule — same specificity.) */
.sectionhead-l2 h2{font-size:calc(21px * var(--hd-size,1));}
.sectionhead-l2{padding-top:16px;}
.sectionhead-l3 h2{font-size:calc(17px * var(--hd-size,1));}
.sectionhead-l3{padding-top:10px;border-bottom:none;padding-bottom:2px;}
.sectionhead-l3 .eyebrow{font-size:9px;margin-bottom:3px;}
.section.sec-l2 .sectionhead{margin-left:14px;}
.section.sec-l3 .sectionhead{margin-left:28px;}
/* main-view section controls: a collapse chevron (left) + a hide eye (right,
   on hover) — the sidebar has the same two, kept in sync */
.sec-chev{flex:none;background:none;border:none;color:var(--ink-3);
  cursor:pointer;font-size:13px;line-height:1;padding:4px 4px;
  border-radius:4px;transition:transform .15s,color .15s;}
.sec-chev:hover{color:var(--ink);}
.section.sec-collapsed .sec-chev{transform:rotate(-90deg);}
.sec-eye{flex:none;background:none;border:none;color:var(--ink-3);
  cursor:pointer;font-size:14px;line-height:1;padding:3px 6px;
  border-radius:5px;opacity:0;transition:opacity .12s,background .12s;}
.sectionhead:hover .sec-eye,.sec-eye:focus-visible{opacity:.5;}
.sec-eye:hover{opacity:1;background:var(--paper-2);}
/* the eye hides the HEADING only; this names the bigger action in words —
   a glyph could not say "and everything in it" (2026-07-29) */
.sec-hideall{flex:none;background:none;border:1px solid transparent;
  color:var(--ink-3);cursor:pointer;font-family:var(--mono);font-size:9px;
  letter-spacing:.1em;text-transform:uppercase;line-height:1;padding:5px 8px;
  border-radius:5px;opacity:0;white-space:nowrap;
  transition:opacity .12s,background .12s,border-color .12s;}
.sectionhead:hover .sec-hideall,.sec-hideall:focus-visible{opacity:.65;}
.sec-hideall:hover{opacity:1;background:var(--paper-2);
  border-color:var(--line);color:var(--ink-2);}
/* collapsed folds the section's cards away; the header stays clickable */
.section.sec-collapsed .card{display:none;}
.section.sec-collapsed .sectionhead{margin-bottom:0;}
/* HEADING hidden: the title and its eyebrow go, the cards stay. The head
   itself survives as a thin hover strip so the controls that brought it
   here can bring it back in place (no round trip to the sidebar). */
.section.sec-headoff .sectionhead-txt{display:none;}
/* a hidden heading leaves NO trace in the feed — the faint stub that used
   to remain read as a rendering artefact. It lives in the sidebar only,
   which is where you bring it back from (2026-07-30). */
.section.sec-headoff .sectionhead{display:none;}
/* ...unless the sidebar's "Show all hidden" is revealing them. That is a
   PEEK, not a reset: everything stays hidden underneath, marked amber so
   you can tell what you are looking at, and one more click puts it all
   away again. Each item's own eye still works while revealed, which is
   how you keep just the one you wanted back. */
.nbshell.reveal-hidden .section.sec-headoff .sectionhead{display:flex;}
.nbshell.reveal-hidden .section.sec-off,
.nbshell.reveal-hidden .section.sec-under-off,
.nbshell.reveal-hidden .content .card.cell-off.is-hidden{display:block;}
.nbshell.reveal-hidden .section.sec-off,
.nbshell.reveal-hidden .section.sec-under-off,
.nbshell.reveal-hidden .content .card.cell-off.is-hidden,
.nbshell.reveal-hidden .section.sec-headoff .sectionhead{
  outline:1px dashed var(--amber);outline-offset:4px;opacity:.62;}
.nbshell.reveal-hidden .section.sec-off:hover,
.nbshell.reveal-hidden .content .card.cell-off.is-hidden:hover,
.nbshell.reveal-hidden .section.sec-headoff .sectionhead:hover{opacity:1;}
.rf-unhide[aria-pressed="true"]{border-color:var(--amber);
  color:var(--amber);}
.section.sec-headoff .sec-eye{opacity:.5;position:relative;}
/* a struck-through eye = "hidden, click to bring it back" (the sidebar
   already uses exactly this mark for a hidden section) */
.section.sec-headoff .sec-eye::after,
.navsec-row.head-off .navsec-eye::after{content:"";position:absolute;
  left:3px;right:3px;top:calc(50% - 1px);height:1.5px;background:currentColor;
  transform:rotate(-18deg);border-radius:2px;}
.navsec-row.head-off .navsec-t{opacity:.55;text-decoration:line-through;
  text-decoration-thickness:1px;}
.navsec-row.head-off .navsec-eye{opacity:.9;position:relative;}
/* hidden drops the whole section from the document (restore from the sidebar) */
.section.sec-off{display:none;}
.navsec-row.sec-off{opacity:.5;}
/* the tiers are a real hierarchy: collapsing / hiding an ancestor section
   folds every deeper section that follows it (recalcSecCascade sets these) */
.section.sec-under,.section.sec-under-off{display:none;}
.navsec-row.nav-under,.navitems.nav-under{display:none;}
.navsec-row.sec-under-off{opacity:.5;}
/* a hidden section keeps only its (dimmed) header row — fold its cell links
   away too, else they stay bright but point at a display:none target */
.navsec-row.sec-off+.navitems{display:none;}
.navsec-eye,.navsec-hideall{flex:none;font-size:11px;line-height:1;
  padding:1px 4px;border-radius:4px;position:relative;opacity:0;
  color:inherit;cursor:pointer;transition:opacity .12s,background .12s;}
.navsec-hideall{font-size:13px;}
.navsec-row:hover .navsec-eye,.navsec-eye:focus,
.navsec-row:hover .navsec-hideall,.navsec-hideall:focus{opacity:.6;}
.navsec-eye:hover,.navsec-hideall:hover{opacity:1;background:#ffffff14;}
.navsec-row.sec-off .navsec-hideall{opacity:.9;}
/* the strike belongs on whichever control did the hiding: ≡ for the whole
   section, the eye for the heading alone */
.navsec-row.sec-off .navsec-hideall::after{content:"";position:absolute;
  left:3px;right:3px;top:calc(50% - 1px);height:1.5px;background:currentColor;
  transform:rotate(-18deg);border-radius:2px;}

/* ---------- cards ---------- */
.card{background:var(--paper);border:1px solid var(--line);
  border-radius:10px;padding:18px 18px 16px;
  /* --vw-gap: a custom view sets the rhythm of the whole feed */
  margin:var(--vw-gap,14px) 0;
  scroll-margin-top:78px;position:relative;
  box-shadow:0 1px 2px #1a26340a;
  opacity:0;transform:translateY(10px);
  transition:opacity .5s ease,transform .5s ease,box-shadow .2s,border-color .2s;}
.card.in{opacity:1;transform:none;}
.card:hover{box-shadow:0 6px 22px #1a26341a;}
.card::before{content:"";position:absolute;left:0;top:16px;bottom:16px;
  width:3px;border-radius:3px;background:var(--line);
  transition:background .2s;}
.card.k-figure::before{background:var(--cyan);}
.card.k-dataset::before{background:#4d90c0;}
.card.k-transform::before{background:#5b7589;}
.card.k-metric::before{background:#46a892;}
.card.k-note::before{background:var(--amber);}
.card.k-code::before{background:var(--paper-3);}
.card.target-flash{border-color:var(--cyan);box-shadow:0 0 0 3px #39a9c033;}

/* a markdown note the Markdown filter has COLLAPSED: only the header shows;
   click the header to expand in place, click again to fold. The :not(.expanded)
   guard means expanding simply reverts to the note's normal rules (so a
   "Show raw HTML" note behaves correctly). */
.card.collapsed{padding:9px 16px;}
.card.collapsed:not(.expanded)>.cardbody,
.card.collapsed:not(.expanded)>.caption,
.card.collapsed:not(.expanded)>.prov,
.card.collapsed:not(.expanded)>.note-src,
.card.collapsed:not(.expanded)>.htmltoggle{display:none;}
.card.collapsed>.cardhead{margin-bottom:0;cursor:pointer;}
.card.collapsed .cardtitle::before{content:"\25b8";margin-right:7px;
  color:var(--ink-3);display:inline-block;font-size:.85em;
  transition:transform .2s;}
.card.collapsed.expanded .cardtitle::before{transform:rotate(90deg);}
.card.collapsed>.cardhead:hover .cardtitle{color:var(--ink);}
.card.collapsed.expanded{padding:18px 18px 16px;}
.card.collapsed.expanded>.cardhead{margin-bottom:12px;}

/* ---- cell output parts: figure + printed output, filtered independently ---- */
.cb-part{display:block;}
.cb-fig.part-off,.cb-out.part-off{display:none;}
/* Plots = Collapsed folds a figure to a slim "show plot" bar (click to open) */
.cb-fig.part-fold>*{display:none;}
.cb-fig.part-fold{cursor:pointer;border:1px dashed var(--line);border-radius:8px;
  padding:8px 12px;position:relative;min-height:0;}
.cb-fig.part-fold::before{content:"\25b8  Show plot";font-family:var(--mono);
  font-size:11px;color:var(--ink-3);letter-spacing:.02em;}
.cb-fig.part-fold:hover::before{color:var(--cyan-deep);}
.cb-fig.part-fold.part-open{cursor:default;border:none;padding:0;}
.cb-fig.part-fold.part-open>*{display:revert;}
.cb-fig.part-fold.part-open::before{display:none;}
/* Output = Collapsed folds the printed output the same way (click to reveal) */
.cb-out.part-fold>*{display:none;}
.cb-out.part-fold{cursor:pointer;border:1px dashed var(--line);border-radius:8px;
  padding:8px 12px;margin-top:12px;position:relative;min-height:0;}
.cb-out.part-fold::before{content:"\25b8  Show output";font-family:var(--mono);
  font-size:11px;color:var(--ink-3);letter-spacing:.02em;}
.cb-out.part-fold:hover::before{color:var(--cyan-deep);}
.cb-out.part-fold.part-open{cursor:default;border:none;padding:0;}
/* :not(.ot-off) so a child hidden by the Output-types filter stays hidden
   even when the collapsed output is opened */
.cb-out.part-fold.part-open>*:not(.ot-off){display:revert;}
.cb-out.part-fold.part-open::before{display:none;}

/* one line: badge, title (elided if long), then the actions pinned to the
   RIGHT. Without nowrap a long title pushed "Plot trace" onto its own row */
.cardhead{display:flex;align-items:center;gap:10px;margin-bottom:12px;
  padding-left:6px;flex-wrap:nowrap;min-width:0;}
/* per-cell eye on the card header: hide this one cell (restore via sidebar) */
.cell-eye{margin-left:auto;flex:none;background:none;border:none;
  color:var(--ink-3);cursor:pointer;font-size:13px;line-height:1;
  padding:2px 6px;border-radius:5px;opacity:0;
  transition:opacity .15s,background .15s;}
.card:hover .cell-eye,.cell-eye:focus-visible{opacity:.55;}
.cell-eye:hover{opacity:1;background:var(--paper-2);}
/* code fully hidden: the code tucked under figures disappears too */
.codewrap.code-off{display:none;}
.badge{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;
  text-transform:uppercase;padding:3px 8px;border-radius:4px;
  background:var(--paper-2);color:var(--ink-3);flex:none;}
.k-figure .badge{background:#39a9c014;color:var(--cyan-deep);}
.k-dataset .badge{background:#4d90c014;color:#2f6f9e;}
.k-transform .badge{background:#5b758914;color:#41566a;}
.k-metric .badge{background:#46a89214;color:#2c8c7d;}
.k-note .badge{background:#cf9a4e1f;color:#8a6326;}
/* printed-output cells read "print" (a steel tone, distinct from md notes) */
.k-print .badge{background:#5f7d8c1f;color:#3f5c6a;}
.navitem.k-print .dot,.nk.k-print .dot{background:#5f7d8c;}
.card.k-print::before{background:#5f7d8c;}
/* code subtypes (base rules read on the light paper theme) */
.ckmain-imports .badge{background:#8a6d4a1a;color:#7a5e38;}
.ckmain-function .badge{background:#46a89218;color:#2c8c7d;}
.ckmain-data .badge{background:#4d90c018;color:#2f6f9e;}
.ckmain-constant .badge{background:#9a7cc01f;color:#6d4f95;}
.ckmain-settings .badge{background:#5b758918;color:#41566a;}
.ckmain-plotting .badge{background:#39a9c018;color:var(--cyan-deep);}
.ckmain-print .badge{background:#cf9a4e1f;color:#8a6326;}
.ckmain-comments .badge{background:#5f73861f;color:#4c5b66;}
/* dark theme (default) needs its own — a generic dark .badge otherwise
   outranks the base rules above */
body:not(.light) .ckmain-imports .badge{background:#8a6d4a2b;color:#c8a877;}
body:not(.light) .ckmain-function .badge{background:#46a8922b;color:#7fd0bd;}
body:not(.light) .ckmain-data .badge{background:#4d90c02b;color:#8fbfe0;}
body:not(.light) .ckmain-constant .badge{background:#9a7cc02b;color:#c3a9e0;}
body:not(.light) .ckmain-settings .badge{background:#5b75892b;color:#a7bccd;}
body:not(.light) .ckmain-plotting .badge{background:#39a9c02b;color:#5fc3d8;}
body:not(.light) .ckmain-print .badge{background:#cf9a4e2b;color:#dfb277;}
body:not(.light) .ckmain-comments .badge{background:#5f738633;color:#93a5b1;}
.cardtitle{font-size:16px;font-weight:600;margin:0;letter-spacing:-.01em;
  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
/* titles that merely echo the first code line label the item in the
   nav, but are not repeated as a heading on the card */
.cardtitle.echo{display:none;}
.nodeid{font-family:var(--mono);font-size:10px;color:var(--ink-3);
  background:var(--paper-2);padding:2px 7px;border-radius:4px;flex:none;}

.cardbody{padding-left:6px;}
/* ---- figure zoom: a per-figure factor (--fz, set inline by the +/- on
   the card) multiplied by the feed-wide factor (--fzall on the shell).
   The CARD grows — border, header and all — so a bigger figure is never
   sitting outside its own cell. It stays centred on the column. ---- */
.nbshell{--fzall:1;}
.card.has-fig{--fz:1;
  width:calc(100% * var(--fz) * var(--fzall));
  margin-left:calc((1 - var(--fz) * var(--fzall)) * 50%);}
/* a wider card is not a bigger figure: a PNG at its natural size ignores
   a roomier box, because max-width only CAPS. While zoomed, the image
   fills the frame so it actually grows. */
.card.has-fig.zoomed .figframe img,
.card.has-fig.zoomed .figframe svg,
.card.has-fig.zoomed .figpage img{
  width:100%;max-width:none;height:auto;}
.cb-fig{position:relative;}
/* top-LEFT on purpose: Plotly/Bokeh draw their own toolbar top-right, and
   the two would sit on top of each other. Invisible until you point at the
   card, and un-clickable while invisible so you never hit it blind. */
.figzoom{position:absolute;top:6px;left:6px;z-index:4;display:flex;gap:3px;
  opacity:0;pointer-events:none;transition:opacity .13s;}
.card:hover .figzoom,.figzoom:focus-within{opacity:1;pointer-events:auto;}
.fz-btn{font-family:var(--mono);font-size:12px;line-height:1;width:23px;
  height:23px;padding:0;border-radius:5px;cursor:pointer;
  border:1px solid var(--line);background:var(--paper);color:var(--ink-2);}
.fz-btn:hover{border-color:var(--cyan);color:var(--ink);}
body:not(.light) .fz-btn{background:#0d1a24d9;border-color:#ffffff2b;
  color:#cfe0ea;}
body:not(.light) .fz-btn:hover{color:#fff;border-color:var(--cyan);}
/* the tree/trace clones and slide frames never carry the zoom chrome, and
   a cloned card is sized by its frame — never by the feed's zoom */
.tree-node .figzoom,.an-cell .figzoom,.spane .figzoom,.slide-fig .figzoom,
.vo-step .figzoom,.print-page .figzoom{display:none!important;}
.an-cell .card.has-fig,.spane .card.has-fig,.slide-fig .card.has-fig,
.tree-node .card.has-fig,.vo-step .card.has-fig,
.print-page .card.has-fig,.rawview .card.has-fig{
  width:100%!important;margin-left:0!important;}
/* full-screen figure viewer (⤢) */
.figmax{position:fixed;inset:0;z-index:300;background:#050b11f2;
  display:flex;align-items:center;justify-content:center;padding:34px;}
.figmax[hidden]{display:none;}
.figmax-box{max-width:96vw;max-height:92vh;overflow:auto;background:#fff;
  border-radius:10px;padding:10px;}
.figmax-box img,.figmax-box svg{max-width:100%;max-height:88vh;
  width:auto;height:auto;display:block;margin:0 auto;}
.figmax-close{position:fixed;top:16px;right:18px;font-family:var(--mono);
  font-size:12px;padding:7px 12px;border-radius:7px;cursor:pointer;
  border:1px solid #ffffff30;background:#0d1a24ee;color:#e7eff5;}
.figmax-close:hover{border-color:var(--cyan);color:#fff;}
.figframe{background:#fff;border:1px solid var(--paper-3);border-radius:8px;
  padding:8px;overflow:auto;text-align:center;}
.figframe img{max-width:100%;height:auto;display:block;margin:0 auto;}
.figframe svg{max-width:100%;height:auto;}
/* interactive plots (plotly/bokeh/vega/folium) + video / gif outputs */
.figframe.plotframe{overflow:hidden;padding:0;}
.plotly-embed{width:100%;min-height:340px;}
.plotframe .rich,.plotframe .js-plotly-plot{width:100%;}
.vid-out{max-width:100%;height:auto;display:block;margin:0 auto;
  border-radius:6px;background:#000;}
/* in a slide frame these fill the frame like a figure */
.an-cell .plotly-embed,.spane .plotly-embed,
.slide-fig .plotly-embed{min-height:0;height:100%;flex:1;}
.an-cell .vid-out,.spane .vid-out,.slide-fig .vid-out{max-height:100%;
  width:auto;}

/* several figures from one cell: pager with prev/next arrows */
.figpager .figpage{display:none;}
.figpager .figpage.current{display:block;}
.figpager-nav{display:flex;align-items:center;justify-content:center;
  gap:10px;margin-top:6px;}
.fp-btn{font-family:var(--mono);font-size:15px;line-height:1;
  border:1px solid var(--paper-3);background:#fff;color:var(--ink-2);
  border-radius:6px;width:28px;height:22px;cursor:pointer;padding:0;}
.fp-btn:hover{border-color:var(--cyan);color:var(--ink);}
.fp-count{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);}

/* huge markdown notes: clamped with a Show more toggle */
.cardbody.mdclamp{max-height:440px;overflow:hidden;position:relative;}
.cardbody.mdclamp::after{content:"";position:absolute;left:0;right:0;
  bottom:0;height:64px;pointer-events:none;
  background:linear-gradient(#fbfcfd00,var(--paper));}
.cardbody.mdclamp.mdopen{max-height:none;}
.cardbody.mdclamp.mdopen::after{display:none;}
.mdmore{display:block;margin:8px 0 0 6px;font-family:var(--mono);
  font-size:10.5px;border:1px solid var(--line);background:#fff;
  color:var(--cyan-deep);border-radius:6px;padding:4px 12px;
  cursor:pointer;}
.mdmore:hover{border-color:var(--cyan);color:var(--ink);}

/* notes with raw HTML: rendered by default, the source behind a tiny
   </> button floating top-right (visible on hover) */
.note-src{display:none;margin:9px 0 0;}
.card.showhtml .cardbody>.note{display:none;}
.card.showhtml .note-src{display:block;}
.htmltoggle{position:absolute;top:8px;right:64px;z-index:2;
  font-family:var(--mono);font-size:10px;letter-spacing:.04em;
  color:var(--ink-3);background:none;border:1px solid var(--line);
  cursor:pointer;padding:2px 7px;border-radius:5px;opacity:0;
  transition:opacity .15s,color .15s;}
.card:hover .htmltoggle,.htmltoggle:focus,
.card.showhtml .htmltoggle{opacity:.8;}
.htmltoggle:hover{opacity:1;color:var(--cyan-deep);
  border-color:var(--cyan);}
.htmltoggle .ht-hide{display:none;}
.card.showhtml .htmltoggle .ht-show{display:none;}
.card.showhtml .htmltoggle .ht-hide{display:inline;}
.an-cell .htmltoggle,.an-cell .note-src,
.spane .htmltoggle,.spane .note-src{display:none;}
/* markdown notes: minimal chrome. No MARKDOWN badge; a note with no real
   heading drops its "Note" title row too — controls float top-right, and
   hovering the card pops a small amber "markdown" label by its edge */
/* the markdown card's own box: background / border / padding / radius are
   all view-stylable, defaulting to the stock card look */
.card[data-note="1"]{position:relative;
  background:var(--md-bg,var(--paper));
  border-color:var(--md-bd,var(--line));
  border-width:var(--md-bw,1px);
  border-radius:var(--md-rad,10px);
  padding:var(--md-pad,18px) var(--md-pad,18px) calc(var(--md-pad,18px) - 2px);}
.card[data-note="1"] .badge{display:none;}
.card.note-untitled>.cardhead{position:absolute;top:6px;right:8px;
  z-index:2;margin:0;gap:6px;}
.card.note-untitled .cardtitle{display:none;}
.card.note-untitled::after{content:"markdown";position:absolute;
  left:14px;top:8px;font-family:var(--mono);font-size:8.5px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--amber);
  opacity:0;transition:opacity .15s;pointer-events:none;}
.card.note-untitled:hover::after{opacity:.85;}
/* tables inside notes render as real tables, not floating rows */
/* a table is text too: it must follow the TEXT stepper and a custom
   view's markdown size, or "make the text bigger" visibly skips it */
.note table{border-collapse:collapse;margin:10px 0;
  font-size:calc(13.5px * var(--mdscale,1) * var(--md-size,1));}
.note th,.note td{border:1px solid #00000022;padding:5px 11px;
  text-align:left;}
.note th{background:#00000008;font-weight:600;}
body:not(.light) .note th,body:not(.light) .note td{
  border-color:#ffffff26;}
body:not(.light) .note th{background:#ffffff0d;}

pre.result,pre.stream,pre.error{font-family:var(--mono);font-size:12px;
  background:var(--paper-2);border:1px solid var(--paper-3);
  border-radius:7px;padding:11px 13px;overflow:auto;margin:0;line-height:1.45;}
pre.error{background:#fbf0ee;border-color:#f0d2cc;color:#8a3221;}
/* a huge printout (1000s of lines) scrolls inside a capped box in the
   document + raw views instead of running the whole page on. Short
   outputs are unaffected; slide frames keep their own sizing. */
.content pre.result,.content pre.stream,.content pre.error,
.content .rich,.content .xr-wrap,
.rawview pre.result,.rawview pre.stream,.rawview .rich,
.rawview .xr-wrap{max-height:min(440px,62vh);overflow:auto;}
.card.k-metric .cardbody pre.result{font-size:14px;
  background:#46a8920d;border-color:#46a89233;color:#1f5f54;
  font-weight:500;}

/* prose scales with the "Text size" control (--mdscale on the shell) —
   markdown notes and captions, not code or output */
.nbshell{--mdscale:1;background:var(--vw-bg,transparent);}
/* ---- CUSTOM VIEW styling (2026-07-29) -----------------------------
   Every prose/heading property a custom view can set reads from an
   INHERITED custom property, which is what gives the cascade for free:
   the value is stamped on .nbshell for "all markdown cells", on a
   .section for one section, or on a .card for one cell — narrowest
   wins, exactly like the user's mental model. Defaults in the var()
   fallbacks keep an unstyled document byte-identical to before. */
.note{font-family:var(--md-font,var(--serif));
  font-size:calc(15px * var(--mdscale) * var(--md-size,1));
  line-height:var(--md-lh,1.65);color:var(--md-col,var(--ink-2));
  text-align:var(--md-align,start);}
.note .caption{font-family:var(--md-font,var(--serif));font-style:normal;
  color:var(--md-col,var(--ink-2));margin:0;padding:0;border:none;
  font-size:calc(15px * var(--mdscale) * var(--md-size,1));}

.caption{font-family:var(--serif);font-size:calc(14px * var(--mdscale));
  color:var(--ink-2);margin:13px 0 0;padding-left:6px;line-height:1.6;}

/* a cell's printed output part, adjacent to its figure part (Output filter) */
.cb-out{margin-top:12px;}
.cb-fig+.cb-out{margin-top:14px;}

.prov{display:flex;align-items:center;gap:7px;flex-wrap:wrap;
  margin:13px 0 0;padding-left:6px;}
.prov-l{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--amber);}
.depchip{font-family:var(--mono);font-size:11px;color:var(--ink-2);
  text-decoration:none;background:#cf9a4e14;border:1px solid #cf9a4e33;
  padding:2px 9px;border-radius:20px;transition:all .15s;}
.depchip:hover{background:var(--amber);color:#fff;border-color:var(--amber);}

/* ---------- code ---------- */
.codewrap{margin:13px 0 0;border-top:1px solid var(--line);padding-top:11px;}
.codewrap.bare{border-top:none;padding-top:0;margin-top:10px;}
.codetoggle{font-family:var(--mono);font-size:11px;letter-spacing:.05em;
  color:var(--ink-3);background:none;border:none;cursor:pointer;padding:2px 6px;
  display:inline-flex;align-items:center;gap:7px;border-radius:5px;
  transition:color .15s;}
.codetoggle:hover{color:var(--cyan-deep);}
.codetoggle .chev{display:inline-block;transition:transform .2s;font-size:14px;}
.ct-hide{display:none;}
.codewrap[data-open] .codetoggle .chev{transform:rotate(90deg);}
.codewrap[data-open] .ct-show{display:none;}
.codewrap[data-open] .ct-hide{display:inline;}
.codebody{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s ease;}
.codewrap[data-open] .codebody{grid-template-rows:1fr;}
.codebody>.codeinner,.codeinner{overflow:hidden;min-height:0;}
.codestep{margin-top:14px;}
.codestep:first-child{margin-top:0;}
.codestep-h{display:flex;align-items:center;gap:9px;margin:0 0 7px;}
.stepnum{font-family:var(--mono);font-size:10px;font-weight:600;
  width:19px;height:19px;border-radius:5px;display:inline-flex;
  align-items:center;justify-content:center;background:#cf9a4e1f;
  color:#8a6326;flex:none;}
.steplabel{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink-3);}
.codestep-out{margin-top:9px;}
.codestep pre.code{margin:0;}
.ct-steps{margin-left:9px;color:var(--ink-3);}
pre.code{font-family:var(--mono);font-size:12.5px;line-height:1.55;
  background:#0e1b25;color:#c9d6e0;border-radius:8px;padding:14px 16px;
  margin:9px 0 2px;overflow:auto;}
pre.code .kw{color:#6bb8d6;}
pre.code .bn{color:#86c5a8;}
pre.code .st{color:#d8a36a;}
pre.code .nu{color:#c98fd0;}
pre.code .co{color:#5d7185;}
pre.code .op{color:#9fb1c0;}

/* ---------- xarray repr ---------- */
.xr-wrap{font-size:13px;overflow:auto;border:1px solid var(--paper-3);
  border-radius:8px;padding:4px 8px;background:#fff;}
.xr-wrap .xr-array-wrap,.xr-wrap .xr-var-list{font-family:var(--mono);}

/* ---------- empty / fallback ---------- */
.rich{overflow:auto;}
/* rich OUTPUT (dataframes and friends) follows the feed-wide text
   stepper too — but not --md-size, which styles markdown cells only */
.rich table{border-collapse:collapse;
  font-size:calc(13px * var(--mdscale,1));}
.rich th,.rich td{border:1px solid var(--line);padding:4px 8px;}

/* ---------- focus ---------- */
a:focus-visible,button:focus-visible,.toggle:focus-visible{
  outline:2px solid var(--cyan);outline-offset:2px;}

/* ---------- responsive ---------- */
@media (max-width:860px){
  .shell{grid-template-columns:1fr;}
  .rail{position:fixed;left:0;top:0;width:min(86vw,330px);z-index:60;
    transform:translateX(-102%);transition:transform .3s ease;
    box-shadow:0 0 40px #00000055;}
  .rail.open{transform:none;}
  .menubtn{display:inline-flex;align-items:center;justify-content:center;
    width:36px;height:36px;border:1px solid var(--line);background:#fff;
    border-radius:var(--rad);cursor:pointer;flex:none;}
  .menubtn span,.menubtn span::before,.menubtn span::after{content:"";
    display:block;width:16px;height:2px;background:var(--ink);position:relative;}
  .menubtn span::before{position:absolute;top:-5px;}
  .menubtn span::after{position:absolute;top:5px;}
  .scrim{position:fixed;inset:0;background:#0a131b66;z-index:55;display:none;}
  .scrim.show{display:block;}
  .content{padding:22px 18px 30vh;}
  .sectionhead h2{font-size:22px;}
  .sectionhead-l2 h2{font-size:19px;}
  .sectionhead-l3 h2{font-size:16px;}
  .section.sec-l2 .sectionhead{margin-left:8px;}
  .section.sec-l3 .sectionhead{margin-left:16px;}
}

@media (prefers-reduced-motion:reduce){
  *{transition:none!important;scroll-behavior:auto!important;}
  .card{opacity:1;transform:none;}
}
"""

# --------------------------------------------------------------------------
# Help overlay -- "how to use / what it can do", shown in every mode
# --------------------------------------------------------------------------

_HELP_HTML = r"""
<h3>What this is</h3>
<p>A <b>figure-first view of executed Jupyter notebooks</b>. Instead of a
wall of cells, you get the scientific structure: figures, datasets and
notes as cards, code folded underneath, sections in a sidebar, and a
provenance graph of how each result derives from the data. On top of
that sits a <b>presentation builder</b>: turn any notebooks into slides
and present straight from the browser.</p>
<p>Everything runs locally &mdash; in the web version, notebooks are
processed <i>in your browser</i> and never uploaded anywhere.</p>

<h3>Open notebooks</h3>
<ul>
<li><b>Drag &amp; drop</b> one or more <code>.ipynb</code> files
anywhere onto the window.</li>
<li><b>+ Open</b> (top left) &mdash; a file picker, or paste a
<b>URL</b> to a notebook (GitHub links are converted automatically).</li>
<li>Notebooks must be <b>executed</b> (run once in Jupyter so outputs
are saved) &mdash; nothing is re-run here.</li>
<li>Every notebook is a <b>tab</b>: click to switch, <b>&#8635;</b>
re-reads it after you re-run it in Jupyter, <b>&#10005;</b> closes.</li>
</ul>

<h3>Filtering what you see</h3>
<p>Four buttons in the top bar &mdash; <b>Plots</b>, <b>Markdown</b>,
<b>Code</b>, <b>Output</b> &mdash; each shows its CURRENT state and
cycles when clicked. They apply to every tab at once. A thin divider
sets them apart from the view controls (Raw notebook, theme) on the
right. <b>Plots</b> comes first because a figure is the headline of a
cell; everything else a notebook produces is, loosely, its
<i>output</i>.</p>
<ul>
<li>All four &mdash; <b>Plots</b>, <b>Markdown</b>, <b>Code</b> and
<b>Output</b> (printed tables, values, text) &mdash; cycle
<i>Visible &rarr; Collapsed &rarr; Hidden</i>. <i>Collapsed</i> folds
that part away behind a click-to-open toggle; <i>Hidden</i> removes it.</li>
<li><b>Code means the code in EVERY cell</b> &mdash; imports, prints,
plotting, a bare expression &mdash; not just standalone code cells. So
<i>Code: Collapsed</i> tucks the source away under every figure and
result at once, and a cell that is <i>only</i> code disappears entirely
when Code is Hidden.</li>
<li><b>Code types</b> and <b>Output types</b> (the two
<b>&#9662;</b> menus) are finer control: untick <i>imports</i>,
<i>plotting</i>&hellip; on the code side, or <i>print</i>,
<i>dataset</i>, <i>numeric</i>, <i>string</i>, <i>list</i>,
<i>dict</i>, <i>error</i>&hellip; on the output side, to hide just
those. Only the types actually present in the notebook are listed.
Untick every code type and it is the same as hiding code.</li>
<li><b>Apply to</b> chooses <i>which sections</i> the filters above act
on. Tick a few headings, set the filters, then pick a different set and
filter those differently &mdash; every section remembers its own
filters, and a section that differs says <i>&middot; filtered</i> next
to its heading. <b>&#8649; All notebooks</b> copies these filters to
every other open notebook; <b>&#8635; Reset</b> clears them for this
one.</li>
</ul>

<h3>Figure size</h3>
<ul>
<li><b>Figures 100%</b> in the top bar (with <b>&minus;</b> and
<b>&#43;</b> either side) resizes <i>every</i> figure in the feed &mdash;
click the percentage to snap back to 100%. Figures grow past the text
column, so a wide plot really does get wider.</li>
<li><b>Point at any figure</b> and its own <b>&minus; &#43;</b> appear at
the top left: those resize just that one, on top of the feed-wide
setting.</li>
<li>The <b>&#10530;</b> button next to them opens that figure
<b>full screen</b> &mdash; Esc or a click outside closes it.</li>
</ul>

<h3>The sidebar</h3>
<ul>
<li>A <b>key</b> at the top names every card type present; below it,
sections and a jump-to link for every cell.</li>
<li><b>Collapse or hide a whole section</b> from its chevron and eye
&mdash; in the sidebar <i>or</i> on the section heading in the document
itself; the two stay in sync. A hidden section leaves the document but
keeps its (dimmed) sidebar row so you can bring it back.</li>
<li>The <b>eye</b> beside any cell &mdash; in the sidebar or on the card
itself &mdash; hides just that one cell; a cell hidden this way stays in
the sidebar (dimmed) so its eye can bring it back.</li>
<li>The <b>analysis graph</b> at the sidebar's foot jumps to any node
that declared an <code>#| id:</code>.</li>
</ul>

<h3>Plot trace</h3>
<p>Every figure has a <b>&#9903; Plot trace</b> button. It opens a new
tab holding just the cells that build that plot &mdash; its whole
lineage, load &rarr; transform &rarr; plot &mdash; with a dependency
graph at the top. The tab is the same document view, just subset to
those cells, so every filter and button still works exactly as it does
in the full document. Close the tab (its <b>&times;</b>) when you are
done; the original document is untouched.</p>

<h3>Raw notebook</h3>
<p><b>Raw notebook</b> flips the current tab to the notebook exactly as
authored &mdash; cells in order, directives visible &mdash; so you can
always see where a title or caption came from.</p>

<h3>Make notebooks render better (optional)</h3>
<p>Add <code>#|</code> directive lines to the top of a code cell; they
are parsed and hidden from display. Everything works without them
&mdash; they are how you take control:</p>
<table>
<tr><td><code>#| title:</code></td><td>card title (else inferred from
the first comment)</td></tr>
<tr><td><code>#| caption:</code></td><td>interpretation text under the
output</td></tr>
<tr><td><code>#| section:</code></td><td>start a section (or use a
markdown <code>##</code> heading)</td></tr>
<tr><td><code>#| id:</code></td><td>stable name; makes the cell a node
in the graph and a reliable slide anchor</td></tr>
<tr><td><code>#| depends: a, b</code></td><td>declare inputs; draws
the graph edges</td></tr>
<tr><td><code>#| display:</code></td><td>force a card type: figure,
dataset, metric, text, code, hidden</td></tr>
<tr><td><code>#| group:</code> / <code>#| stack:</code></td><td>fold
several cells under one figure (see the README for details)</td></tr>
</table>

<h3>Custom views &mdash; a styled, filtered copy of the notebook</h3>
<ul>
<li><b>+ New custom view</b> in the left rail (under + New presentation
and + New poster) saves <i>how the notebook itself looks</i>. It is not
slides: it opens in the document, with a styling bar under the
ribbon.</li>
<li>Style <b>All markdown</b>, <b>All headings</b> or the <b>Document</b>
(page colour, spacing) &mdash; or click any single markdown cell or
heading to style just that one. Colour, size, background, border, corner
radius, padding, font and alignment.</li>
<li>Narrowest wins: a cell beats its section, a section beats the whole
view. Anything carrying its own style is marked, and <b>Override N
individual styles</b> clears them so they follow the view again.</li>
<li>Your <b>filters</b>, hidden cells, hidden headings, collapsed
sections, figure sizes and text size are saved <i>with</i> the view
&mdash; so it is also the place to keep an elaborate filter setup you
want back later.</li>
<li>Click the view in the rail to reopen it; <b>Done</b> returns the
document to its normal styling.</li>
</ul>

<h3>Presentations</h3>
<ul>
<li>The <b>left rail</b> lists presentations under a <b>Notebooks</b>
button &mdash; exactly one is active, so that button is always the way
back. <b>New</b> starts one; <b>&#171;</b> shrinks or hides the
rail.</li>
<li>A presentation opens straight in the <b>slide editor</b>. Add
content with <b>+ Notebook cell</b> &mdash; a draggable, resizable frame
that holds any notebook card: drop it on the slide, then click a card in
your notebook (from <i>any</i> open tab, so one deck can mix several
notebooks) to fill it; swap later with &#8644; Replace. Pick a slide
layout from the diagrams (full, halves, rows, quarters, a
<b>title slide</b>, or a <b>blank canvas</b>).</li>
<li>The editor is a full slide editor: <b>+ Text</b>, <b>+ Arrow</b>,
<b>+ Shapes</b> (rectangle, ellipse, star, arrow, cloud, and more) and
<b>&#128443; Image</b>. Select anything for colours, precise point size,
alignment, bold / italic / underline, line thickness, dash, fill and a
smooth opacity slider. <b>Highlight</b> part of a text box to recolour just
that run.</li>
<li><b>Crop</b> an image <i>or</i> a notebook cell (figure, markdown or code)
to a shape; <b>group</b> items (shift-click, then Ctrl+G) so they move as
one; <b>&#9654; Animate</b> an item so it appears on click; and switch on
<b>slide numbers</b> from the File menu.</li>
<li>Editor shortcuts: <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Shift+Z</kbd> undo &amp;
redo, <kbd>Ctrl+D</kbd> duplicate, <kbd>Ctrl+G</kbd> group, <kbd>Del</kbd>
remove, <b>arrow keys</b> nudge (hold <kbd>Shift</kbd> for bigger steps).
<i>File &rarr; Export PDF</i> saves the whole deck as a PDF (or prints it).</li>
<li><b>&#9654; Present</b> plays full screen. Arrow keys / click
&larr;/&rarr; step through builds and slides; on slides with code, &darr;
descends the <b>code trail</b> &mdash; every cell that made the figure, one
per screen, in execution order &mdash; and &uarr; climbs back out.</li>
</ul>

<h3>Saving</h3>
<ul>
<li>The <b>Saved to:</b> button beside <b>Save</b> says where this
presentation lives, and lets you change it:
<ul>
<li><b>Browser</b> &mdash; kept in this browser, autosaving as you edit.
Fine for a quick deck, but it is tied to this browser on this machine.</li>
<li><b>A file on your computer</b> &mdash; pick a spot once and Junoview
writes a <code>.junoview</code> file there. It <b>remembers that file
between visits</b>, so Save (and autosave) go straight back to it &mdash;
no re-picking, no downloads folder full of near-identical JSON.</li>
<li><b>This project</b> (desktop app) &mdash;
<code>junoview_project.json</code> next to where you launched it,
along with your open tabs.</li>
</ul></li>
<li>A <code>.junoview</code> file is plain JSON with a friendlier name.
Drop one next to its notebook as <code><i>notebook</i>.junoview</code>
and it loads itself the next time you open that notebook.</li>
<li><i>File &rarr; Download a copy</i> gives you a standalone
<code>.junoview</code> to share; <i>File &rarr; Open a .junoview
file</i> brings one back &mdash; later, or on another computer.</li>
<li>Decks are robust to notebook edits: slides reference cells by
<b>stable ids</b>, never position &mdash; re-upload an edited notebook
and everything still resolves; a deleted cell just leaves an empty
frame you can refill.</li>
</ul>

<h3>Run it locally</h3>
<p>The whole tool is one Python file with no dependencies. For daily
use &mdash; local file browsing, project files, session restore:
<code>pip install</code> the repo and run <code>junoview</code>,
or just download <code>semantic_render.py</code> and run
<code>python semantic_render.py</code>.</p>

<h3>Support this project &#9829;</h3>
<p>Junoview is free and open source, built and maintained in the open.
If it saves you time, a <b>Support</b> contribution genuinely helps
&mdash; and it funds where this is going:</p>
<ul>
<li>An <b>online, hosted Junoview with accounts</b> (think Overleaf,
but for notebook figures + talks): save your documents and
presentations to the cloud, pick up on any device, and share a link
with collaborators &mdash; instead of juggling JSON files.</li>
<li>Keeping the local + in-browser versions <b>free forever</b>, with
regular improvements.</li>
</ul>
<p>Use the <b>Support &#9829;</b> button (top bar) &mdash; it goes
through Ko-fi. Thank you.</p>
"""

# App chrome (controls bar + tab rows), welcome screen, open dialog,
# drag-drop hint
_APP_CSS = r"""
:root{--appbar-h:104px;--tabsrow-h:44px;--chrome-h:112px;--dc-w:430px;
  --presrail-w:176px;}
body.presrail-min{--presrail-w:46px;}

/* ---------- row 1: global controls; row 2: notebook + presentation tabs */
/* the header sizes to its content: --chrome-h is measured from the real
   element (see measureChrome), so a bar that needs a second line pushes
   the page down instead of hiding controls off the right-hand edge */
.apptop{position:fixed;top:0;left:0;right:0;min-height:var(--chrome-h);
  z-index:90;display:flex;flex-direction:column;background:#0a141d;
  border-bottom:1px solid #ffffff14;}
/* top-aligned: every main button sits on one first row; the small
   "… types ▾" pickers hang underneath their parent filter. It WRAPS —
   a horizontal scrollbar in a toolbar just hides things. */
/* align-items:stretch so every SECTION is as tall as the bar and a
   single-button group (+ Open) can fill both rows rather than floating at
   the top of an empty column */
/* NOT centred: a centred bar re-centres whenever the viewport width
   changes — switching to the tree removes the page scrollbar and every
   button slid 15px sideways, which is precisely the "buttons move when I
   change view" complaint. Left-aligned, a button's position depends only
   on what is before it (2026-07-30). */
.appbar{display:flex;align-items:stretch;gap:6px;flex-wrap:wrap;
  justify-content:flex-start;padding-left:8px;
  min-height:var(--appbar-h);
  padding:8px 6px 6px 0;border-bottom:1px solid #ffffff0d;}
/* buttons keep one line and one uniform size no matter how narrow the
   bar gets (the builder can squeeze it) or what glyph they hold.
   34px is THE ribbon button height and it is set exactly once — a second
   rule further down used to quietly win and leave the sub-pickers taller
   than the buttons they hang under (2026-07-29) */
.appbar .toggle,.appbar .appbar-link,.present-bar .toggle{
  flex:none;white-space:nowrap;height:34px;box-sizing:border-box;
  padding:0 10px;line-height:1;font-size:12px;gap:6px;}
/* ---- button icons: inline SVG, never emoji (emoji are tofu in the mono
   font). One 16-grid, stroke-only, currentColor — so an icon is always
   the same weight as the label beside it and follows the theme. ---- */
.bic{width:15px;height:15px;flex:none;display:block;
  stroke:currentColor;stroke-width:1.5;fill:none;
  stroke-linecap:round;stroke-linejoin:round;opacity:.9;}
.toggle:hover .bic,.toggle[aria-pressed="true"] .bic{opacity:1;}
/* an icon-only button is square, not a wide slab with a dot in it */
.appbar .toggle.fz-step,.present-bar .toggle.fz-step,
#theme-btn,#support-btn{padding:0;justify-content:center;}
.btxt{display:inline-block;}
/* a filter GROUP stacks its advanced types picker under its main button
   (Plot types under Plots, Code types under Code, …) so the bar stays
   narrow instead of growing ever wider */
.fgrp{flex:none;display:flex;flex-direction:column;align-items:stretch;
  gap:3px;}
.fgrp .toggle{width:100%;text-align:left;}
/* a HORIZONTAL group: its caption sits to the LEFT of the buttons instead
   of under them, so two of them stack in the height of one filter column
   (the size steppers) */
.fgrp-h{flex-direction:row;align-items:center;gap:8px;}
.fgrp-h .fgrp-cap{order:-1;text-align:right;min-width:50px;line-height:1;
  height:auto;}
/* two small buttons sharing one row, so a group never grows past the two
   rows the app bar is tall */
/* a labelled SECTION of the ribbon: its NAME, then its controls — the
   label reads as a heading for the group below it (2026-07-29: it used to
   sit underneath and read as a caption for whatever came next) */
.abgrp{display:flex;flex-direction:column;align-items:stretch;gap:5px;
  flex:none;}
.abgrp-row{display:flex;align-items:flex-start;gap:6px;flex:1;}
/* + Open is one button in its own section, so it takes the full height */
#ab-file .abgrp-row{align-items:stretch;}
/* the chain matters: the row stretches the .fgrp (cross axis), but inside
   the .fgrp the button's height is the MAIN axis — so it needs flex:1 or
   it just sits at its natural 34px */
#ab-file .abgrp-row .fgrp{flex:1;}
#ab-file .abgrp-row .toggle{height:auto;min-height:34px;flex:1;}
/* Present is the important control in its section and had dead space
   under it, so it spans both rows beside the Raw/Tree stack */
#ab-view .abgrp-row,#ab-view .btn-grp{align-items:stretch;}
#ab-view #doc-present{height:auto;min-height:34px;}
/* an icon-only button is square, never a wide slab around a small glyph */
#pt-filter-btn,#ck-filter-btn,#ot-filter-btn,#help-btn{padding:0 11px;
  justify-content:center;}
/* stacked rows inside one section (the two size steppers) */
.abgrp-row.abgrp-stack{flex-direction:column;align-items:stretch;gap:5px;}
.abgrp-lab{font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--chrome-ink-2);text-align:center;
  line-height:1;opacity:.75;order:-1;}
body.light .abgrp-lab{color:var(--ink-3);}
/* buttons that belong together and must wrap as one unit */
.btn-grp{display:flex;gap:4px;flex:none;align-items:flex-start;
  position:relative;}
.btn-grp[hidden]{display:none!important;}
/* the "…" overflow: rarely-used items, out of the way but one click deep */
.more-menu{min-width:210px;padding:6px;}
.more-menu .ckf-all{margin-bottom:4px;}
.more-link{display:flex;align-items:center;gap:7px;text-decoration:none;
  text-transform:none;font-family:var(--sans);font-size:12px;}
.fgrp-row{display:flex;gap:3px;align-items:stretch;}
/* size to CONTENT. `.fgrp .toggle{width:100%}` + `flex:1` was squeezing
   these below their natural width, so the label sat on the border. */
.fgrp-row .toggle{flex:none;width:auto;justify-content:center;
  text-align:center;padding-left:12px;padding-right:12px;}
/* square steppers/icons sit beside the thing they act on */
.fgrp-row .toggle.fz-step{flex:none;width:34px;padding:0;
  justify-content:center;font-size:14px;}
.fgrp-row .toggle.fz-val{flex:none;width:46px;padding:0;
  justify-content:center;}
/* a caption naming a group of small buttons, so the buttons stay narrow
   instead of each carrying the label */
.fgrp-cap{font-family:var(--mono);font-size:9px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--chrome-ink-2);text-align:center;
  line-height:22px;height:22px;white-space:nowrap;}
body.light .fgrp-cap{color:var(--ink-3);}
.appbar .toggle.primary,.present-bar .toggle.primary{background:var(--cyan);border-color:var(--cyan);
  color:#04222b;font-weight:600;}
.appbar .toggle.primary:hover{filter:brightness(1.08);color:#04222b;}
/* ONE button height across the whole ribbon (2026-07-29, user: "make all
   buttons have same height"). A sub-picker is still visually quieter —
   dimmer text, fainter border, smaller type — but it is never shorter,
   because a short button beside a tall one reads as a broken grid. */
.appbar .toggle.sub,.present-bar .toggle.sub{height:34px;font-size:11px;
  padding:0 10px;color:#93a8ba;border-color:#ffffff2e;background:#ffffff08;}
.appbar .toggle.sub:hover,.present-bar .toggle.sub:hover{
  color:#fff;border-color:var(--cyan);}
/* both selectors need the body.light prefix — without it the LIGHT rule
   applies to the present bar in dark mode too */
body.light .appbar .toggle.sub,body.light .present-bar .toggle.sub{
  color:var(--ink-3);border-color:var(--line);background:#00000005;}
body.light .appbar .toggle.sub:hover,
body.light .present-bar .toggle.sub:hover{color:var(--ink);}
/* push the trailing controls right WITHOUT a growing spacer: a flex:1
   spacer fills the first line and shoves everything after it onto a
   second row, even when there is room */

.appbar-spring{flex:1;}
/* a thin rule that marks where the content FILTERS end and the view/theme
   controls begin — centred against the 30px first row */
/* group separators: full-height so the bar reads as distinct groups
   (file · filters · scope+size · view · app), not one long run */
/* ---- TREE VIEW: the filters do not apply there, so they GO — but the
   controls that remain must not slide left to fill the hole, or the
   button you use to get back moves every time you switch view. The trick
   is an auto margin: Size / View / App are pushed to the right end, so
   they sit in the same place whether the filter sections are there or
   not (a growing spacer would fill line 1 and force a wrap; an auto
   margin is applied after line breaking). ---- */
#ab-size{margin-left:auto;}
body.tree-mode #ab-filters,body.tree-mode #ab-scope,
body.tree-mode .appbar-div.filt-div,
body.tree-mode #pt-grp,body.tree-mode #md-grp,body.tree-mode #ck-grp,
body.tree-mode #ot-grp,body.tree-mode #sec-scope-grp,
body.tree-mode #copy-grp{display:none!important;}
/* the stacked View column: Raw over Tree. Its width is FIXED to the
   longest label it can hold ("Document"), because the Tree button renames
   itself and a wider word would shove Present sideways — the same fixed
   slot the filter state words use, for the same reason (2026-07-30) */
.vw-stack{display:flex;flex-direction:column;gap:4px;flex:none;
  min-width:124px;}
.vw-stack .toggle{width:100%;justify-content:center;}
.appbar-div{flex:none;width:1px;height:82px;background:#ffffff38;
  margin:1px 0 0;border-radius:1px;}
body.light .appbar-div{background:#00000026;}
/* dark variants of the show/hide toggles */
.appbar .toggle,.present-bar .toggle{border-color:#ffffff40;background:#ffffff12;color:#d7e3ec;}
.appbar-link{text-decoration:none;display:inline-flex;
  align-items:center;}
.appbar .toggle:hover,.present-bar .toggle:hover{border-color:var(--cyan);color:#fff;}
.appbar .toggle.tv.off,.present-bar .toggle.tv.off{color:#69788a;}
/* the sidebar toggle now lives on the tab line, next to Open + the tabs
   (the doc-navigation controls), not up among the filters */
.tabsrow .menubtn{display:inline-flex;align-items:center;
  justify-content:center;width:30px;height:29px;margin:7px 2px 0 8px;
  border:1px solid #ffffff22;background:none;
  border-radius:8px;cursor:pointer;flex:none;}
.tabsrow .menubtn:hover{border-color:var(--cyan);}
.tabsrow .menubtn span,.tabsrow .menubtn span::before,
.tabsrow .menubtn span::after{content:"";display:block;width:14px;
  height:2px;background:#cdd9e3;position:relative;}
.tabsrow .menubtn span::before{position:absolute;top:-5px;}
.tabsrow .menubtn span::after{position:absolute;top:5px;}
.tabsrow .menubtn[aria-pressed="true"]{background:#39a9c022;
  border-color:#39a9c088;}
body.light .tabsrow .menubtn{border-color:var(--line);}
body.light .tabsrow .menubtn span,body.light .tabsrow .menubtn span::before,
body.light .tabsrow .menubtn span::after{background:var(--ink-2);}
.tabsrow{display:flex;align-items:stretch;height:var(--tabsrow-h);
  background:#0d1a26;}
/* tabs line up with the DOCUMENT, not with the outline beneath them —
   the strip starts where the sidebar ends (and slides back when the
   sidebar is toggled off) */
.tabstrip{display:flex;align-items:stretch;overflow-x:auto;
  min-width:0;scrollbar-width:thin;flex:0 1 auto;
  gap:5px;padding:6px 8px 0;
  margin-left:calc(var(--rail-w) - 52px);
  transition:margin-left .2s ease;}
body.no-rail .tabstrip{margin-left:0;}
.tab{display:flex;align-items:center;gap:8px;padding:0 10px 0 15px;
  max-width:260px;min-width:0;cursor:pointer;user-select:none;
  font-size:13px;color:#96a9ba;background:#ffffff08;
  border:1px solid #ffffff14;border-bottom:none;
  border-radius:9px 9px 0 0;
  white-space:nowrap;transition:background .12s,color .12s;}
.tab:hover{background:#ffffff12;color:#cdd9e3;}
.tab.current{background:#0b141d;color:#e6edf3;font-weight:600;
  border-color:#ffffff1f;}
.tab-t{overflow:hidden;text-overflow:ellipsis;max-width:200px;}
/* a version tab: name on top, the commit it is pinned to underneath */
.tab-t.tab-t-ver{display:flex;flex-direction:column;line-height:1.15;
  padding:3px 0;}
.tab-ver{font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;
  color:var(--cyan);opacity:.9;font-weight:400;}
body.light .tab-ver{color:var(--cyan-deep);}
.tab-b{background:none;border:none;color:inherit;opacity:.55;
  cursor:pointer;font-size:13px;padding:4px 6px;border-radius:5px;
  line-height:1;flex:none;}
.tab-b:hover{opacity:1;background:#00000033;}
.tabs-label{font-family:var(--mono);font-size:8.5px;letter-spacing:.18em;
  text-transform:uppercase;color:#54677a;display:flex;align-items:center;
  padding:0 10px 0 14px;flex:none;user-select:none;}

/* ---------- presentations rail: vertical stack on the left edge.
   Exactly ONE item is active at a time: "Notebooks" (no builder) or a
   presentation (builder open) — so the way out is always visible. */
.presrail{position:fixed;left:0;top:0;bottom:0;width:var(--presrail-w);
  z-index:95;background:#0a141d;border-right:1px solid #ffffff1f;
  display:flex;flex-direction:column;padding:8px 6px;gap:2px;}
/* the Junoview wordmark now lives at the top of the left rail */
.presrail-brand{font-family:var(--mono);font-size:13px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--cyan);font-weight:600;gap:9px;
  padding:9px 10px 13px;display:flex;align-items:center;flex:none;}
.presrail-brand .jv-logo{width:24px;height:auto;}
body.presrail-min .presrail-brand .jv-logo{width:26px;}
.prb-min{display:none;}
body.presrail-min .prb-full{display:none;}
body.presrail-min .presrail-brand{justify-content:center;padding:9px 0 13px;}
body.presrail-min .prb-min{display:inline;font-size:16px;letter-spacing:0;}
body.light .presrail-brand{color:var(--cyan-deep);}
.pr-item{display:flex;align-items:center;gap:9px;width:100%;
  background:none;border:none;border-radius:7px;padding:9px 10px;
  font-family:var(--sans);font-size:12.5px;color:#8ba0b2;cursor:pointer;
  text-align:left;min-width:0;transition:background .12s,color .12s;}
.pr-item:hover{background:#ffffff0c;color:#cdd9e3;}
/* ONE active style, radio-consistent: whichever of Notebooks / a
   presentation is open gets the same filled-cyan treatment */
.pr-item.current{background:var(--cyan-deep);color:#fff;font-weight:600;}
.pr-item.editing{background:var(--cyan-deep);color:#fff;font-weight:600;}
.pr-ico{font-size:11px;flex:none;width:16px;text-align:center;
  opacity:.85;}
.pr-item.ptab .pr-ico{font-size:8.5px;color:var(--cyan);}
.pr-item.editing .pr-ico{color:#fff;}
.pr-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
/* the Notebooks button reads as a BUTTON (bordered like + New
   presentation), not a plain label */
.pr-docs{margin-bottom:6px;border:1px solid #ffffff22;border-radius:8px;}
.pr-docs:hover{border-color:var(--cyan);}
.pr-docs.current{border-color:var(--cyan-deep);}
body.light .pr-docs{border-color:var(--line);}
body.light .pr-docs:hover{border-color:var(--cyan);}
.pr-label{font-family:var(--mono);font-size:8.5px;letter-spacing:.18em;
  text-transform:uppercase;color:#4e93a6;padding:10px 10px 6px;
  user-select:none;white-space:nowrap;overflow:hidden;}
.pr-list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;
  min-height:0;flex:0 1 auto;}
/* real buttons for the create actions */
.pr-btn{display:flex;align-items:center;justify-content:center;gap:7px;
  width:100%;background:#ffffff08;border:1px solid #ffffff22;
  border-radius:7px;padding:8px 10px;font-family:var(--mono);
  font-size:10.5px;letter-spacing:.03em;color:#9fb2c2;cursor:pointer;
  margin-top:6px;transition:border-color .15s,color .15s,
  background .15s;}
.pr-btn:hover{border-color:var(--cyan);color:#fff;
  background:#39a9c014;}
/* the icon shows at every rail width: it is what makes the three
   "+ New ..." buttons tellable apart, collapsed OR expanded */
.pr-btn .pr-ico{display:flex;align-items:center;justify-content:center;}
body.presrail-min .pr-btn .pr-t{display:none;}
body.presrail-min .pr-btn .pr-ico{display:flex;align-items:center;
  justify-content:center;}
/* folder icon next to folder names */
.pr-fico{display:flex;align-items:center;color:#7590a5;flex:none;}
.pr-folder:hover .pr-fico{color:#9fb2c2;}
body.presrail-min .pr-fico{display:none;}
.pr-collapse{margin-top:auto;background:none;border:1px solid #ffffff1f;
  border-radius:7px;color:#69788a;font-size:13px;padding:5px 0;
  cursor:pointer;}
.pr-collapse:hover{color:#cdd9e3;border-color:#ffffff40;}
/* collapsed: icons only */
body.presrail-min .pr-t,body.presrail-min .pr-label{display:none;}
body.presrail-min .pr-item{justify-content:center;padding:9px 0;}
body.presrail-min .pr-ico{width:auto;}
/* fully hidden: a small edge handle brings it back */
body.presrail-hidden{--presrail-w:0px;}
body.presrail-hidden .presrail{display:none;}
/* ---- rail auto-hide (OFF by default), same taskbar model as the
   present bar: the panel leaves, the document takes the full width, and
   the panel slides back when the pointer reaches the left edge ---- */
body.prrail-auto{--presrail-w:0px;}
body.prrail-auto .presrail{transform:translateX(-101%);
  transition:transform .18s ease;box-shadow:0 0 40px #00000066;}
body.prrail-auto.prrail-peek .presrail{transform:none;}
body.prrail-auto .presrail-show{display:none;}
#pr-auto[aria-pressed="true"]{color:var(--cyan);border-color:var(--cyan);}
#pr-auto .bic{width:13px;height:13px;}
.presrail-show{position:fixed;left:0;bottom:20px;z-index:96;width:22px;
  height:46px;border:1px solid #ffffff22;border-left:none;
  border-radius:0 8px 8px 0;background:#0a141d;color:#7fb6c6;
  cursor:pointer;display:none;font-size:12px;padding:0;}
body.presrail-hidden .presrail-show{display:block;}
.presrail-show:hover{color:#fff;border-color:var(--cyan);}
/* draft-only presentations get an unsaved dot */
.pr-item.draftonly .pr-t::after{content:" \2022";color:var(--amber);}
/* presentation folders: real folders — drag items in/out, collapsible */
.pr-folder{display:flex;align-items:center;gap:7px;width:100%;
  border:1px solid transparent;background:none;border-radius:7px;
  padding:7px 10px;margin-top:5px;font-family:var(--mono);font-size:10px;
  letter-spacing:.1em;text-transform:uppercase;color:#5e7488;
  cursor:pointer;text-align:left;min-width:0;user-select:none;}
.pr-folder:hover{background:#ffffff0a;color:#9fb2c2;}
.pr-folder.dropping{border-color:var(--cyan);background:#39a9c01c;
  color:#aadbe8;}
.pr-folder .pr-t{flex:1;}
.pr-fchev{flex:none;font-size:9px;}
.pr-fcount{flex:none;font-size:9px;background:#ffffff10;
  border-radius:8px;padding:1px 6px;color:#69788a;}
.pr-fctrl{display:none;gap:2px;flex:none;}
.pr-folder:hover .pr-fctrl{display:flex;}
.pr-fctrl button{background:none;border:none;color:#8ba0b2;
  cursor:pointer;font-size:10px;padding:1px 4px;border-radius:4px;}
.pr-fctrl button:hover{color:#fff;background:#ffffff14;}
.pr-frename{width:100%;background:#16273a;border:1px solid var(--cyan);
  color:#dce6ee;font-family:var(--sans);font-size:12px;padding:3px 7px;
  border-radius:5px;min-width:0;}
.pr-frename:focus{outline:none;}
.pr-item.infolder{padding-left:26px;}
.pr-item.ptab[draggable="true"]{cursor:grab;}
.pr-item.ptab.dragging{opacity:.45;}
.presrail.dropping-root{outline:2px dashed #39a9c066;
  outline-offset:-4px;}
body.presrail-min .pr-folder .pr-t,
body.presrail-min .pr-fcount,body.presrail-min .pr-fctrl{display:none;}
body.presrail-min .pr-folder{justify-content:center;padding:8px 0;}
body.presrail-min .pr-item.infolder{padding-left:0;}

.nbshell[hidden]{display:none;}
body{padding-top:var(--chrome-h);padding-left:var(--presrail-w);}
.apptop{left:var(--presrail-w);}
.welcome{left:var(--presrail-w);}
.rail{top:var(--chrome-h);height:calc(100vh - var(--chrome-h));}
.section{scroll-margin-top:calc(var(--chrome-h) + 12px);}
.card{scroll-margin-top:calc(var(--chrome-h) + 18px);}
/* builder docked: full-height panel right of the rail; tab / controls
   chrome shifts right so it sits above the DOCUMENT (IDE-style) */
.deck.creating{left:var(--presrail-w);}
body.creating-docs .apptop{
  left:calc(var(--presrail-w) + min(var(--dc-w),94vw));}
@media (max-width:860px){
  .deck.creating{top:var(--chrome-h);}
  body.creating-docs .apptop{left:var(--presrail-w);}
}

/* ---------- welcome (app mode, nothing open) ---------- */
.welcome{position:fixed;left:0;right:0;top:var(--chrome-h);bottom:0;
  overflow:auto;background:var(--paper-2);z-index:5;}
.welcome[hidden]{display:none;}
.welcome-box{text-align:center;max-width:680px;margin:0 auto;
  padding:0 30px 60px;}
/* the hero fills the first screen; the numbered steps sit below it, seen on
   scroll (with a small "How it works" cue) */
.welcome-top{min-height:calc(100vh - var(--chrome-h) - 30px);display:flex;
  flex-direction:column;justify-content:center;padding:24px 0;}
.welcome-scrollcue{margin-top:34px;font-family:var(--mono);font-size:10.5px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);opacity:.7;}
.welcome-more{padding:36px 0 10px;border-top:1px solid var(--line);
  max-width:560px;margin:0 auto;}
/* big centered hero logo, then the wordmark below it */
.welcome-hero{display:flex;justify-content:center;margin-bottom:4px;}
.welcome-hero .jv-logo{width:clamp(88px,15vw,132px);height:auto;
  filter:drop-shadow(0 6px 18px #0007);}
.welcome-wordmark{font-family:var(--mono);font-size:clamp(42px,8.5vw,66px);
  font-weight:600;letter-spacing:.06em;color:var(--cyan-deep);
  margin:2px 0 12px;}
.ww-dot{display:none;}
/* the Junoview mark (peacock-eye ocellus) — sized by context */
.jv-logo{flex:none;display:inline-block;vertical-align:middle;}
.welcome-tag{font-size:clamp(17px,2.4vw,21px);line-height:1.5;font-weight:500;
  color:var(--ink-2);margin:0 auto 20px;max-width:560px;}
.welcome-lead{font-size:15.5px;line-height:1.65;color:var(--ink-3);
  margin:0 auto 30px;max-width:580px;}
.welcome-lead b{color:var(--ink-2);}
.welcome-note{max-width:560px;margin:26px auto 0;text-align:left;
  font-size:14.5px;line-height:1.55;color:var(--ink-2);
  background:#39a9c010;border:1px solid #39a9c026;
  border-left:3px solid var(--cyan);border-radius:10px;padding:13px 16px;}
.welcome-note b{color:var(--cyan-deep);}
.welcome-steps{list-style:none;margin:0 auto 30px;padding:0;max-width:560px;
  text-align:left;display:flex;flex-direction:column;gap:15px;}
.welcome-steps li{display:flex;align-items:flex-start;gap:15px;
  font-size:16.5px;line-height:1.5;color:var(--ink-2);}
.ws-n{flex:none;width:30px;height:30px;border-radius:50%;background:#39a9c018;
  color:var(--cyan-deep);font-family:var(--mono);font-size:15px;font-weight:600;
  display:inline-flex;align-items:center;justify-content:center;margin-top:1px;}
.welcome-drop{font-size:14.5px;color:var(--ink-3);margin:18px 0 0;}
.welcome-drop b{color:var(--ink-2);}
.recent{margin-top:30px;display:flex;flex-direction:column;gap:6px;
  text-align:left;max-width:560px;margin-left:auto;margin-right:auto;}
.recent-h{font-family:var(--mono);font-size:10px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink-3);margin-bottom:2px;}
.recent-i{font-family:var(--mono);font-size:12.5px;color:var(--cyan-deep);
  background:#fff;border:1px solid var(--line);padding:9px 12px;
  border-radius:6px;cursor:pointer;text-align:left;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;direction:rtl;}
.recent-i:hover{border-color:var(--cyan);}
.welcome-btns{display:flex;gap:12px;justify-content:center;
  flex-wrap:wrap;margin-top:4px;}
.welcome-btns .dbtn{font-size:16px;font-weight:600;padding:14px 26px;
  border-radius:10px;border:1.5px solid var(--cyan-deep);cursor:pointer;
  transition:all .15s;}
.welcome-btns .dbtn.primary{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;box-shadow:0 6px 18px #39a9c033;}
.welcome-btns .dbtn.primary:hover{background:var(--cyan);
  border-color:var(--cyan);}
.welcome-btns .dbtn.ghost{background:transparent;border-color:var(--cyan);
  color:var(--cyan-deep);}
.welcome-btns .dbtn.ghost:hover{background:#39a9c018;}
/* dark welcome (default): keep the secondary button clearly readable */
body:not(.light) .welcome-btns .dbtn.ghost{color:#8fe0f0;
  border-color:#39a9c0;background:#39a9c012;}
body:not(.light) .welcome-btns .dbtn.ghost:hover{background:#39a9c026;}
.welcome-links{margin-top:20px;font-size:14px;color:var(--ink-3);}
.welcome-links a{color:var(--cyan-deep);text-decoration:none;}
.welcome-links a:hover{text-decoration:underline;}
.wl-sep{margin:0 8px;}

/* ---------- help overlay: how to use / what it can do ---------- */
.helpdlg{position:fixed;inset:0;z-index:135;background:#0a131b88;
  display:flex;align-items:center;justify-content:center;padding:24px;}
.helpdlg[hidden]{display:none;}
/* ---- guided tour: a spotlight + a tooltip that steps through the UI ---- */
.tour{position:fixed;inset:0;z-index:400;}
.tour[hidden]{display:none;}
.tour-hole{position:fixed;border-radius:8px;pointer-events:none;
  box-shadow:0 0 0 9999px rgba(4,8,12,.62);transition:left .25s,top .25s,
  width .25s,height .25s;}
.tour-hole.center{box-shadow:0 0 0 9999px rgba(4,8,12,.74);}
.tour-tip{position:fixed;width:min(400px,90vw);background:#0f1c29;
  border:1px solid #ffffff26;border-radius:12px;padding:17px 19px 14px;
  box-shadow:0 18px 50px #000a;color:#dce6ee;transition:left .2s,top .2s;}
.tour-tip-h{display:flex;align-items:baseline;gap:9px;margin-bottom:9px;}
.tour-step{font-family:var(--mono);font-size:11.5px;color:#5fc3d8;flex:none;}
.tour-title{font-size:18px;font-weight:600;color:#eef4f8;}
.tour-text{font-size:15.5px;line-height:1.6;color:#c3d0db;margin-bottom:15px;}
.tour-btns{display:flex;align-items:center;gap:8px;}
.tour-btns button{font-family:var(--sans);font-size:13.5px;border-radius:16px;
  padding:7px 16px;cursor:pointer;border:1px solid #ffffff22;
  background:#ffffff0d;color:#dce6ee;}
.tour-btns button:hover{background:#ffffff18;}
.tour-next{background:#39a9c026;border-color:#39a9c066;color:#bfeaf5;}
.tour-skip{color:#8ba0b2;border-color:transparent;background:none;padding:5px 6px;}
.help-box{width:min(760px,94vw);height:min(720px,90vh);
  background:var(--paper);border-radius:12px;display:flex;
  flex-direction:column;overflow:hidden;
  box-shadow:0 24px 80px #00000066;}
.help-head{display:flex;align-items:center;gap:12px;
  padding:13px 18px;border-bottom:1px solid var(--line);}
.help-title{font-family:var(--mono);font-size:11px;
  letter-spacing:.18em;text-transform:uppercase;
  color:var(--cyan-deep);font-weight:600;}
.help-gh{font-size:12.5px;color:var(--cyan-deep);text-decoration:none;}
.help-gh:hover{text-decoration:underline;}
.help-head .dbtn{border-color:var(--line);background:#fff;
  color:var(--ink-2);}
.help-head .dbtn:hover{border-color:var(--cyan);color:var(--ink);}
.help-body{flex:1;overflow-y:auto;padding:6px 26px 30px;
  color:var(--ink-2);font-size:13.5px;line-height:1.65;}
.help-body h3{font-size:15px;color:var(--ink);letter-spacing:-.01em;
  margin:24px 0 8px;padding-top:14px;
  border-top:1px solid var(--paper-3);}
.help-body h3:first-child{border-top:none;margin-top:8px;}
.help-body ul{margin:6px 0;padding-left:20px;}
.help-body li{margin:5px 0;}
.help-body a{color:var(--cyan-deep);}
.help-body code{font-family:var(--mono);font-size:12px;
  background:var(--paper-2);border:1px solid var(--paper-3);
  border-radius:4px;padding:1px 5px;}
.help-body kbd{font-family:var(--mono);font-size:11.5px;
  background:var(--paper-2);border:1px solid var(--paper-3);
  border-bottom-width:2px;border-radius:5px;padding:1px 6px;
  color:var(--ink-2);white-space:nowrap;}
.help-body table{border-collapse:collapse;margin:8px 0;width:100%;}
.help-body td{border:1px solid var(--paper-3);padding:6px 10px;
  vertical-align:top;}
.help-body td:first-child{white-space:nowrap;}

/* ---------- open dialog (app mode file browser) ---------- */
.opendlg{position:fixed;inset:0;z-index:130;background:#0a131b88;
  display:flex;align-items:center;justify-content:center;padding:24px;}
.opendlg[hidden]{display:none;}
.odlg-box{width:min(580px,94vw);height:min(620px,86vh);
  background:var(--paper);border-radius:12px;display:flex;
  flex-direction:column;overflow:hidden;box-shadow:0 24px 80px #00000066;}
.odlg-head{display:flex;align-items:center;gap:10px;padding:12px 14px;
  border-bottom:1px solid var(--line);}
.odlg-head .dbtn{border-color:var(--line);background:#fff;
  color:var(--ink-2);}
.odlg-head .dbtn:hover{border-color:var(--cyan);color:var(--ink);}
.odlg-path{flex:1;font-family:var(--mono);font-size:11px;color:var(--ink-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  direction:rtl;text-align:left;}
.odlg-list{flex:1;overflow-y:auto;padding:8px;}
.odlg-i{display:flex;align-items:center;gap:10px;width:100%;
  background:none;border:none;font-family:var(--sans);font-size:13px;
  color:var(--ink-2);padding:8px 10px;border-radius:6px;cursor:pointer;
  text-align:left;}
.odlg-i:hover{background:var(--paper-2);color:var(--ink);}
.odlg-i .ic{font-size:13px;flex:none;width:20px;text-align:center;}
.odlg-i.nb{color:var(--cyan-deep);font-weight:500;}
.odlg-i .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  flex:1;min-width:0;}
.odlg-i .sz{font-family:var(--mono);font-size:10px;color:var(--ink-3);
  flex:none;}
.odlg-empty{padding:26px;text-align:center;color:var(--ink-3);
  font-size:12.5px;}
/* remembered files: reopen anything you've had open, name over path */
.odlg-recent{flex:none;border-bottom:1px solid var(--line);
  padding:8px 8px 10px;max-height:190px;overflow-y:auto;}
.odlg-recent[hidden]{display:none;}
.odlg-recent-h{font-family:var(--mono);font-size:9px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink-3);padding:2px 6px 6px;}
.odlg-r{display:flex;flex-direction:column;gap:1px;width:100%;
  background:none;border:none;padding:6px 10px;border-radius:6px;
  cursor:pointer;text-align:left;}
.odlg-r:hover{background:var(--paper-2);}
.odlg-r-nm{font-size:12.5px;color:var(--cyan-deep);font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  max-width:100%;}
.odlg-r-p{font-family:var(--mono);font-size:10px;color:var(--ink-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  max-width:100%;direction:rtl;text-align:left;}
.odlg-foot{border-top:1px solid var(--line);padding:10px 12px;}
#odlg-input{width:100%;box-sizing:border-box;font-family:var(--mono);
  font-size:11.5px;border:1px solid var(--line);border-radius:6px;
  padding:8px 10px;background:#fff;color:var(--ink);}
#odlg-input:focus{outline:none;border-color:var(--cyan);}
.odlg-inrow{display:flex;gap:8px;align-items:stretch;}
.odlg-inrow #odlg-input{flex:1;min-width:0;}
#odlg-go{flex:none;font-weight:600;padding:8px 16px;
  border-color:var(--cyan);color:var(--cyan-deep);background:#fff;}
#odlg-go:hover:not(:disabled){background:var(--cyan);color:#fff;}
#odlg-go:disabled,#odlg-input:disabled{opacity:.55;cursor:default;}
.odlg-load{height:3px;margin-top:8px;border-radius:2px;overflow:hidden;
  background:#39a9c022;position:relative;}
.odlg-load[hidden]{display:none;}
.odlg-load span{position:absolute;left:-40%;top:0;width:40%;height:100%;
  background:var(--cyan);border-radius:2px;
  animation:odlg-slide 1.1s ease-in-out infinite;}
@keyframes odlg-slide{to{left:100%;}}

/* ---------- section sidebar (TOC): hidden until ☰ toggles it ------- */
@media(min-width:861px){
  body:not(.tocshow) .shell{grid-template-columns:1fr;}
  body:not(.tocshow) .nbshell .rail{display:none;}
}

/* ---------- advanced code-type filter menu ---------- */
.ckfilter-menu{position:fixed;z-index:200;background:#16273a;
  border:1px solid #ffffff22;border-radius:8px;padding:8px;
  box-shadow:0 12px 40px #00000066;min-width:150px;}
.ckfilter-menu[hidden]{display:none;}
.ckf-h{font-family:var(--mono);font-size:9px;letter-spacing:.14em;
  text-transform:uppercase;color:#7e93a4;padding:2px 6px 6px;}
.ckf-row{display:flex;align-items:center;gap:8px;padding:5px 6px;
  font-family:var(--mono);font-size:11.5px;color:#cdd9e3;cursor:pointer;
  border-radius:5px;text-transform:capitalize;}
.ckf-row:hover{background:#ffffff0c;}
.ckf-row input{cursor:pointer;}
.ckf-dot{width:8px;height:8px;border-radius:3px;flex:none;background:#8ba0b2;}
.ckf-dot.ckmain-imports{background:#a3855c;}
.ckf-dot.ckmain-function{background:#46a892;}
.ckf-dot.ckmain-data{background:#4d90c0;}
.ckf-dot.ckmain-constant{background:#9a7cc0;}
.ckf-dot.ckmain-settings{background:#5b7589;}
.ckf-dot.ckmain-plotting{background:#39a9c0;}
.ckf-dot.ckmain-print{background:#cf9a4e;}
.ckf-dot.ckmain-comments{background:#5f7386;}
.ckf-dot.ot-sw-print{background:#5f7d8c;}
.ckf-dot.ot-sw-dataset{background:#4d90c0;}
.ckf-dot.ot-sw-result{background:#9a7cc0;}
.ckf-dot.ot-sw-error{background:#cf6a5a;}
/* finer text/plain repr types */
.ckf-dot.ot-sw-numeric{background:#4fae8f;}
.ckf-dot.ot-sw-string{background:#c9a24b;}
.ckf-dot.ot-sw-list{background:#5b8fd0;}
.ckf-dot.ot-sw-dict{background:#a878c8;}
.ckf-dot.ot-sw-tuple{background:#7b86d0;}
.ckf-dot.ot-sw-set{background:#4fb0c0;}
.ckf-dot.ot-sw-bool{background:#d08a4f;}
.ckf-dot.ot-sw-none{background:#7a8794;}
.ckf-dot.ot-sw-array{background:#5b7589;}
.ckf-dot.ot-sw-value{background:#8a93a0;}
.ckf-dot.ot-sw-dataframe{background:#4d90c0;}
.ckf-dot.ot-sw-series{background:#5aa0b8;}
.ckf-dot.ot-sw-function{background:#46a892;}
.ckf-dot.ot-sw-class{background:#9a7cc0;}
.ckf-dot.ot-sw-module{background:#8a6d4a;}
.ckf-dot.ot-sw-object{background:#8a93a0;}
.ckf-empty{color:#7e93a4;font-size:11px;padding:8px;}
/* the tab's ⌚ Versions menu */
.vers-menu{min-width:232px;max-width:330px;
  max-height:min(70vh,540px);overflow-y:auto;}
.vers-row{display:block;width:100%;text-align:left;background:none;
  border:none;color:#cdd9e3;font-family:var(--mono);font-size:11.5px;
  padding:6px 8px;border-radius:5px;cursor:pointer;}
.vers-row .vers-l{display:block;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
.vers-row .vers-sub{display:block;font-size:9.5px;color:#7e93a4;
  margin-top:1px;}
.vers-row:hover{background:#ffffff0c;}
.vers-row.on{color:#7fd0e0;}
.vers-row.on .vers-l{color:#7fd0e0;}
body.light .vers-row{color:var(--ink-2);}
body.light .vers-row:hover{background:#00000008;}
.tab-vermark{color:#f0a848;margin-right:4px;flex:none;font-size:12px;}
#ck-filter-btn.on,#ot-filter-btn.on,#pt-filter-btn.on{
  border-color:var(--cyan);color:#fff;background:#39a9c022;}
/* an output hidden by the advanced Output-types filter */
.ot-off{display:none;}
/* a figure hidden by the advanced Plot-types filter */
.cb-fig .pt-off{display:none!important;}
/* Plot-types menu swatches: one colour per plotting library */
.ckf-dot.pt-sw-matplotlib{background:#39a9c0;}
.ckf-dot.pt-sw-plotly{background:#4d90c0;}
.ckf-dot.pt-sw-bokeh{background:#cf9a4e;}
.ckf-dot.pt-sw-vega{background:#9a7cc0;}
.ckf-dot.pt-sw-folium{background:#46a892;}
.ckf-dot.pt-sw-animation{background:#8fd4e4;}
.ckf-dot.pt-sw-video{background:#5b7589;}
.ckf-dot.pt-sw-widget{background:#8ba0b2;}
/* "Apply to" scope picker: the section tree, tier-indented + tickable */
.scope-menu{min-width:250px;max-width:330px;max-height:min(64vh,440px);
  overflow-y:auto;}
/* selection is the ROW itself — highlighted means "the filters act here" */
.scope-row{text-transform:none;align-items:center;gap:5px;cursor:pointer;
  border:1px solid transparent;user-select:none;}
.scope-row.on{background:#39a9c024;border-color:#39a9c059;color:#eaf6fa;}
.scope-row.on:hover{background:#39a9c033;}
/* only some of the sub-headings inside are selected */
.scope-row.part{background:#39a9c010;border-color:#39a9c033;}
.scope-row:focus-visible{outline:2px solid var(--cyan);outline-offset:1px;}
body.light .scope-row.on{background:#39a9c022;color:var(--ink);}
.scope-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.scope-l2{padding-left:16px;}
.scope-l3{padding-left:32px;opacity:.9;}
/* the expand arrow that reveals a heading's sub-headings */
.scope-tw{width:14px;flex:none;display:flex;justify-content:center;}
.scope-chev{background:none;border:none;padding:0;cursor:pointer;
  color:#7e93a4;font-size:10px;line-height:1;
  transition:transform .13s,color .13s;}
.scope-chev.open{transform:rotate(90deg);}
.scope-chev:hover{color:var(--cyan);}
/* how many sub-headings ride along with this one */
.scope-n{font-family:var(--mono);font-size:9px;color:var(--cyan);
  background:#39a9c018;border-radius:20px;padding:1px 5px;margin-left:6px;}
/* the footer action in the Apply-to menu */
.scope-copy{margin:8px 0 0;border-top:1px solid #ffffff1f;
  border-radius:0 0 5px 5px;padding-top:8px;}
.scope-copy[disabled]{opacity:.45;cursor:default;}
.ckf-all{display:block;width:100%;text-align:left;font-family:var(--mono);
  font-size:11px;color:var(--cyan);background:#39a9c014;
  border:1px solid #39a9c033;border-radius:5px;padding:5px 7px;
  margin:0 0 6px;cursor:pointer;}
.ckf-all:hover{background:#39a9c026;color:#eaf6fa;}
body.light .ckfilter-menu{background:#fff;border-color:var(--line);}
body.light .ckf-row{color:var(--ink-2);}
body.light .ckf-row:hover{background:#00000008;}

/* ---------- add-a-note: a pencil on every card (app mode) that writes a
   markdown cell into the .ipynb, with an optional git commit ---------- */
.card-addnote{flex:none;background:none;border:none;cursor:pointer;
  font-size:13px;line-height:1;padding:1px 4px;opacity:0;
  color:var(--ink-3);}
.card:hover .card-addnote,.card-addnote:focus{opacity:.55;}
.card-addnote:hover{opacity:1;color:var(--cyan-deep);}
.note-dlg{position:fixed;inset:0;z-index:230;background:#00000088;
  display:flex;align-items:center;justify-content:center;}
.note-dlg[hidden]{display:none;}
.note-dlg-box{width:min(560px,92vw);background:#16273a;
  border:1px solid #ffffff22;border-radius:12px;padding:16px 18px;
  box-shadow:0 18px 60px #000a;display:flex;flex-direction:column;gap:10px;}
.note-dlg-h{font-weight:600;color:#eef4f8;font-size:15px;}
.note-dlg-sub{font-size:11.5px;color:#8ba0b2;font-family:var(--mono);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#note-dlg-src{background:#0e1926;border:1px solid #ffffff22;
  border-radius:8px;color:#e6edf3;font-family:var(--mono);font-size:13px;
  padding:10px 12px;resize:vertical;min-height:110px;}
#note-dlg-src:focus{outline:none;border-color:var(--cyan);}
.note-dlg-git{display:flex;align-items:center;gap:8px;font-size:12.5px;
  color:#cdd9e3;cursor:pointer;}
.note-dlg-btns{display:flex;gap:8px;justify-content:flex-end;
  align-items:center;}
.note-dlg-err{flex:1;font-size:11.5px;color:#e08a7a;}
.doc-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);
  z-index:240;background:#16273a;border:1px solid #39a9c066;
  border-radius:9px;color:#e6edf3;font-size:13px;padding:10px 16px;
  box-shadow:0 10px 30px #00000088;max-width:min(640px,92vw);}
.doc-toast a{color:#7fd0e0;}
.doc-toast[hidden]{display:none;}
body.light .note-dlg-box{background:#fff;border-color:var(--line);}
body.light .note-dlg-h{color:var(--ink);}
body.light #note-dlg-src{background:#f7fafc;color:var(--ink);
  border-color:var(--line);}
body.light .note-dlg-git{color:var(--ink-2);}
body.light .doc-toast{background:#fff;color:var(--ink);
  border-color:var(--cyan);}
body.light .doc-toast a{color:var(--cyan-deep);}
body.light .ckf-h{color:var(--ink-3);}

/* ---------- instant tooltips (replaces slow native titles) -------- */
.apptip{position:fixed;z-index:300;background:#0e1926;color:#dce6ee;
  font-family:var(--sans);font-size:11.5px;line-height:1.45;
  padding:6px 10px;border-radius:7px;border:1px solid #39a9c055;
  box-shadow:0 6px 24px #00000066;pointer-events:none;max-width:290px;
  white-space:pre-line;display:none;}

/* ---------- light theme: the app chrome flips, the presentation
   canvas stays dark (decks look identical on every machine) -------- */
body.light .apptop{background:#f4f7fa;border-color:var(--line);}
body.light .appbar{border-bottom-color:var(--line);}
body.light .appbar .toggle,body.light .present-bar .toggle{border-color:var(--line);background:#fff;
  color:var(--ink-2);}
body.light .appbar .toggle:hover,body.light .present-bar .toggle:hover{border-color:var(--cyan);
  color:var(--ink);}
body.light .appbar .toggle.tv.off,body.light .present-bar .toggle.tv.off{color:var(--ink-3);}
body.light .tabsrow{background:#e9eef3;}
body.light .tab{border-color:var(--line);background:#00000006;
  color:var(--ink-3);}
body.light .tab:hover{background:#00000010;color:var(--ink);}
body.light .tab.current{background:var(--paper);color:var(--ink);}
body.light .tabs-label{color:var(--ink-3);}
body.light .presrail{background:#f4f7fa;
  border-right-color:var(--line);}
body.light .pr-item{color:var(--ink-3);}
body.light .pr-item:hover{background:#00000008;color:var(--ink);}
body.light .pr-item.current{background:var(--cyan-deep);color:#fff;}
body.light .pr-item.editing{background:var(--cyan-deep);color:#fff;}
body.light .pr-item.ptab .pr-ico{color:var(--cyan-deep);}
body.light .pr-item.editing .pr-ico{color:#fff;}
body.light .pr-label{color:var(--cyan-deep);}
body.light .pr-folder{color:var(--ink-3);}
body.light .pr-folder:hover{background:#00000008;
  color:var(--ink-2);}
body.light .pr-fico{color:var(--ink-3);}
body.light .pr-fcount{background:#00000012;color:var(--ink-3);}
body.light .pr-fctrl button{color:var(--ink-3);}
body.light .pr-fctrl button:hover{color:var(--ink);
  background:#00000012;}
body.light .pr-frename{background:#fff;color:var(--ink);}
body.light .pr-btn{background:#fff;border-color:var(--line);
  color:var(--ink-2);}
body.light .pr-btn:hover{border-color:var(--cyan);color:var(--ink);
  background:#39a9c012;}
body.light .pr-collapse{border-color:var(--line);
  color:var(--ink-3);}
body.light .pr-collapse:hover{color:var(--ink);
  border-color:var(--ink-3);}
body.light .presrail-show{background:#f4f7fa;
  border-color:var(--line);color:var(--ink-3);}
body.light .deck-create{background:#f4f7fa;}
body.light .dc-head{background:#eef2f6;
  border-bottom-color:var(--line);}
body.light .dc-block{border-bottom-color:var(--line);}
body.light .dc-label{color:var(--ink-3);}
body.light .deck-create .dbtn{border-color:var(--line);
  background:#fff;color:var(--ink-2);}
body.light .deck-create .dbtn:hover{border-color:var(--cyan);
  color:var(--ink);}
body.light .deck-create .dbtn.primary{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
body.light .deck-create .dbtn.lay .layico i{background:#8ba0b2;}
body.light .deck-create .dbtn.lay[aria-pressed="true"]{
  background:var(--cyan-deep);border-color:var(--cyan-deep);}
body.light .dc-presname{color:var(--ink);}
body.light #pres-name,body.light .title-editor input{
  background:#fff;border-color:var(--line);color:var(--ink);}
body.light .dc-hint{color:var(--ink-3);}
body.light .dc-menu{background:#fff;border-color:var(--line);}
body.light .dc-mi{color:var(--ink-2);}
body.light .dc-mi:hover{background:#39a9c026;}
body.light .dc-msep{background:var(--line);}
body.light .deck-status{background:#00000010;color:var(--ink-3);}
body.light .deck-status.draft{background:#b5731a22;color:#8a5410;}
body.light .deck-status.saved{background:#2e8a7222;color:#1e6f5a;}
body.light .film-label{color:var(--ink-2);}
body.light .film-row.current{background:#39a9c022;
  outline-color:#39a9c066;}
body.light .film-mini{color:var(--ink-3);}
body.light .film-mini:hover{background:#00000012;color:var(--ink);}
body.light .film-label .film-n{color:var(--ink-3);}
/* slide-editing chrome flips too; the slide surface itself stays the
   dark presentation design in every theme */
body.light .deck.editing{background:#dfe6ec;}
body.light .deck.creating{background:#f4f7fa;}
body.light .edit-tools{background:#f4f7fa;
  border-bottom-color:var(--line);}
body.light .edit-tools .dbtn{background:#fff;border-color:var(--line);
  color:var(--ink-2);}
body.light .edit-tools .dbtn:hover{border-color:var(--cyan);
  color:var(--ink);}
body.light .edit-tools .dbtn.et[aria-pressed="true"],
body.light .edit-tools .dbtn.etm[aria-pressed="true"]{
  background:var(--cyan-deep);border-color:var(--cyan-deep);
  color:#fff;}
body.light .et-label{color:#a06a1e;}
body.light .et-hint{color:var(--ink-3);}
body.light select#fmt-font{background:#fff;border-color:var(--line);
  color:var(--ink);}
/* document rail (section nav aka Overview + analysis graph) */
body.light .rail{background:#f2f5f8;color:var(--ink-2);
  border-right-color:var(--line);}
body.light .railhead{border-bottom-color:var(--line);}
body.light .railtitle{color:var(--ink);}
body.light .railmeta{color:var(--ink-3);}
body.light .brand{color:var(--cyan-deep);}
body.light .navsec{color:var(--ink-2);}
body.light .navsec:hover{background:#00000008;}
body.light .navsec.active{background:#39a9c01c;color:var(--ink);}
body.light .navitems{border-left-color:var(--line);}
body.light .navsub{color:var(--ink-3);}
body.light .navitem{color:var(--ink-3);}
body.light .navitem:hover{color:var(--ink);background:#00000006;}
body.light .navitem.active{color:var(--ink);}
body.light .navitem.k-code .dot,body.light .nk.k-code .dot{
  background:#56627022;border-color:#00000026;}
body.light .navkey{border-top-color:var(--line);}
body.light .navkey-h,body.light .nk{color:var(--ink-3);}
body.light .nk .dot{background:var(--ink-3);}
body.light .navitem .dot{background:var(--ink-3);}
body.light .navitem.k-figure .dot,body.light .nk.k-figure .dot{
  background:var(--cyan);}
body.light .navitem.k-dataset .dot,body.light .nk.k-dataset .dot{
  background:#4d90c0;}
body.light .navitem.k-transform .dot,body.light .nk.k-transform .dot{
  background:#5b7589;}
body.light .navitem.k-metric .dot,body.light .nk.k-metric .dot{
  background:#46a892;}
body.light .navitem.k-note .dot,body.light .nk.k-note .dot{
  background:var(--amber);}
body.light .railgraph{background:#e9eef3;border-top-color:var(--line);}
body.light .rg-collapse{border-color:var(--line);color:var(--ink-3);}
body.light .rg-collapse:hover{color:var(--ink);
  border-color:#00000033;}

/* ---------- dark document (default theme; body.light keeps paper) --- */
body:not(.light){background:#0b141d;}
body:not(.light) .stage{background:#0b141d;}
/* dark mode is explicit overrides, not variable swaps — so every rule a
   custom view can restyle must honour its var here TOO, or styling does
   nothing at all in the default theme (2026-07-29) */
body:not(.light) .sectionhead{
  border-bottom-color:var(--hd-bd,#ffffff14);}
body:not(.light) .sectionhead h2{color:var(--hd-col,#e6edf3);}
body:not(.light) .eyebrow{color:var(--hd-accent,#5fc3d8);}
body:not(.light) .card{background:#101c28;border-color:#ffffff14;
  box-shadow:0 1px 2px #00000040;}
body:not(.light) .card:hover{box-shadow:0 6px 22px #00000055;}
body:not(.light) .card.k-code::before{background:#2c3c4c;}
body:not(.light) .cardtitle{color:#e6edf3;}
body:not(.light) .badge{background:#ffffff0d;color:#8ba0b2;}
body:not(.light) .k-figure .badge{background:#39a9c022;color:#5fc3d8;}
body:not(.light) .k-dataset .badge{background:#4d90c022;color:#7fb3d8;}
body:not(.light) .k-transform .badge{background:#5b758922;
  color:#93a7b8;}
body:not(.light) .k-metric .badge{background:#46a89222;color:#6fcab4;}
body:not(.light) .k-note .badge{background:#cf9a4e26;color:#dfb277;}
body:not(.light) .k-print .badge{background:#5f7d8c2b;color:#a6c2cf;}
body:not(.light) .nodeid{background:#ffffff0f;color:#8ba0b2;}
body:not(.light) .note{color:var(--md-col,#c3cfda);}
body:not(.light) .note .caption{color:var(--md-col,#c3cfda);}
/* a markdown card's own box is view-stylable in dark mode too */
body:not(.light) .card[data-note="1"]{background:var(--md-bg,#101c28);
  border-color:var(--md-bd,#ffffff14);}
body:not(.light) .caption{color:#9fb0bf;}
body:not(.light) pre.result,body:not(.light) pre.stream{
  background:#0d1926;border-color:#ffffff14;color:#c9d6e2;}
body:not(.light) pre.error{background:#38180f;border-color:#6b352a;
  color:#f2b3a6;}
body:not(.light) .card.k-metric .cardbody pre.result{
  background:#46a89216;border-color:#46a89240;color:#7fd0bd;}
body:not(.light) .figframe{border-color:#ffffff1f;}
body:not(.light) .xr-wrap,body:not(.light) .rich{background:#fbfcfd;
  border:1px solid #ffffff1f;border-radius:8px;padding:8px;
  color:var(--ink);}
body:not(.light) .codewrap{border-top-color:#ffffff14;}
body:not(.light) .codetoggle{color:#8ba0b2;}
body:not(.light) .codetoggle:hover{color:#5fc3d8;}
body:not(.light) .htmltoggle{color:#8ba0b2;}
body:not(.light) .htmltoggle:hover{color:#5fc3d8;}
body:not(.light) .steplabel,body:not(.light) .ct-steps{color:#8ba0b2;}
body:not(.light) .depchip{color:#dfc49a;}
body:not(.light) .depchip:hover{color:#fff;}
body:not(.light) .mdmore{background:#101c28;border-color:#ffffff22;
  color:#5fc3d8;}
body:not(.light) .mdmore:hover{border-color:var(--cyan);color:#fff;}
body:not(.light) .cardbody.mdclamp::after{
  background:linear-gradient(#101c2800,#101c28);}
body:not(.light) .fp-btn{background:#101c28;border-color:#ffffff22;
  color:#c9d6e2;}
body:not(.light) .fp-btn:hover{border-color:var(--cyan);color:#fff;}
body:not(.light) .fp-count{color:#8ba0b2;}
body:not(.light) .rawcell{background:#101c28;border-color:#ffffff14;}
body:not(.light) .rawmd{color:#c3cfda;}
body:not(.light) .rawmd h1,body:not(.light) .rawmd h2,
body:not(.light) .rawmd h3,body:not(.light) .rawmd h4,
body:not(.light) .rawmd h5,body:not(.light) .rawmd h6{color:#e6edf3;}
body:not(.light) .welcome{background:#0b141d;}
body:not(.light) .welcome-wordmark{color:#7fd8ea;}
body:not(.light) .welcome-tag{color:#d3dee7;}
body:not(.light) .welcome-lead{color:#9fb1bf;}
body:not(.light) .welcome-lead b{color:#d3dee7;}
body:not(.light) .welcome-note{background:#39a9c016;border-color:#39a9c033;
  border-left-color:var(--cyan);color:#c2d0da;}
body:not(.light) .welcome-note b{color:#8fe0f0;}
body:not(.light) .welcome-steps li{color:#b3c2ce;}
body:not(.light) .ws-n{background:#39a9c026;color:#8fe0f0;}
body:not(.light) .welcome-drop{color:#7e93a4;}
body:not(.light) .welcome-drop b{color:#c9d6e2;}
body:not(.light) .recent-i{background:#101c28;
  border-color:#ffffff22;color:#5fc3d8;}
body:not(.light) .welcome-btns .dbtn{background:#101c28;
  border-color:#ffffff22;color:#c9d6e2;}
body:not(.light) .welcome-btns .dbtn:hover{border-color:var(--cyan);
  color:#fff;}
body:not(.light) .welcome-btns .dbtn.primary{
  background:var(--cyan-deep);border-color:var(--cyan-deep);
  color:#fff;}
body:not(.light) .welcome-links a{color:#5fc3d8;}

/* ---------- drag-drop hint ---------- */
.drophint{position:fixed;inset:10px;z-index:140;border:2px dashed var(--cyan);
  border-radius:14px;background:#39a9c018;display:flex;align-items:center;
  justify-content:center;font-family:var(--mono);font-size:14px;
  color:var(--cyan-deep);pointer-events:none;letter-spacing:.08em;}
.drophint[hidden]{display:none;}

/* ---------- notebook source chips on slides / panes ---------- */
.spane-nb,.slide-nb{font-family:var(--mono);font-size:9px;
  letter-spacing:.1em;text-transform:uppercase;color:#5fc3d8;
  background:#39a9c01f;border-radius:4px;padding:2px 7px;flex:none;}
.slide-head{display:flex;align-items:baseline;gap:10px;}
.slide-head .slide-nb{position:relative;top:-2px;}
.spane-h{display:flex;align-items:center;gap:8px;margin:0 0 8px;flex:none;}
.spane-h .spane-t{margin:0;flex:1;min-width:0;}
.pane-nbtag{position:absolute;left:3px;bottom:2px;z-index:1;
  font-family:var(--mono);font-size:8px;letter-spacing:.08em;
  text-transform:uppercase;color:#5fc3d8;}

/* ---------- raw notebook view (transparency: cells as authored) ------ */
.rawview{display:none;max-width:920px;margin:0 auto;
  padding:30px 28px 30vh;}
.nbshell.raw .content{display:none;}
.nbshell.raw .rawview{display:block;}
#view-raw[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}

/* ---------- tree view (the analysis graph as a full, expandable view) --- */
#view-tree[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
.treeview{display:none;padding:14px 20px 24vh;}
.nbshell.tree .content{display:none;}
.nbshell.tree .rawview{display:none;}
.nbshell.tree .treeview{display:block;}
/* sticks BELOW the chrome, never under it: --chrome-h is the measured
   height of the real header, so this tracks a one- or two-row ribbon */
.tree-toolbar{position:sticky;top:calc(var(--chrome-h) + 6px);z-index:3;
  display:flex;flex-wrap:wrap;
  align-items:center;gap:8px;padding:8px 2px 12px;margin-bottom:6px;
  background:linear-gradient(var(--paper-2) 72%,transparent);}
.tree-toolbar .tt-title{font-family:var(--mono);font-size:10px;
  letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);
  margin-right:auto;}
.tt-btn{font-family:var(--mono);font-size:11px;letter-spacing:.02em;
  border:1px solid var(--line);background:var(--paper);color:var(--ink-2);
  padding:5px 10px;border-radius:var(--rad);cursor:pointer;
  transition:all .15s;}
.tt-btn:hover{border-color:var(--cyan);color:var(--ink);}
.tt-hidden-note{font-family:var(--mono);font-size:10.5px;color:var(--amber);
  display:none;align-items:center;gap:6px;}
.tree-canvas.has-hidden ~ .tt-hidden-note,
.tree-toolbar .tt-hidden-note.show{display:inline-flex;}
.tree-scroll{overflow:auto;position:relative;
  border:1px solid var(--line);border-radius:12px;background:
  radial-gradient(circle at 1px 1px,var(--line) 1px,transparent 0) 0 0/22px 22px,
  var(--paper);}
.tree-canvas{position:relative;min-width:100%;width:max-content;
  padding:26px 26px 40px;}
.tree-edges{position:absolute;top:0;left:0;
  pointer-events:none;overflow:visible;z-index:0;}
.tree-edge{fill:none;stroke:var(--amber-soft);stroke-width:1.6;}
.tree-edge.lit{stroke:var(--cyan);stroke-width:2.4;}
.tree-lane{position:relative;z-index:1;display:flex;flex-wrap:nowrap;
  justify-content:center;align-items:flex-start;gap:26px;
  margin:0 0 52px;}
.tree-lane:last-child{margin-bottom:0;}
.tree-node{--nc:#4a5564;position:relative;flex:0 0 auto;width:190px;
  background:color-mix(in srgb,var(--nc) 7%,var(--paper));
  border:1px solid var(--line);border-radius:10px;
  border-top:3px solid var(--nc);box-shadow:0 1px 3px #16202b12;
  transition:box-shadow .15s,border-color .15s;}
/* cell width presets (toolbar Width: S/M/L; default M) */
.tree-canvas.tw-m .tree-node{width:260px;}
.tree-canvas.tw-l .tree-node{width:340px;}
.tree-canvas.tw-m .tree-node.expanded{width:min(440px,86vw);}
.tree-canvas.tw-l .tree-node.expanded{width:min(540px,88vw);}
.tree-canvas .tree-node.tn-off{width:auto;}
.tree-node.active{border-color:var(--cyan);box-shadow:0 3px 14px #39a9c033;}
.tree-node-head{display:flex;align-items:center;gap:7px;padding:9px 9px 9px 11px;
  cursor:pointer;}
.tn-dot{width:8px;height:8px;border-radius:50%;background:var(--nc);
  flex:none;}
.tn-title{flex:1;min-width:0;font-size:12.5px;font-weight:600;
  color:var(--ink);line-height:1.3;overflow:hidden;text-overflow:ellipsis;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.tn-kind{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--nc);font-weight:700;}
.tn-btn{flex:none;background:none;border:none;color:var(--ink-3);
  cursor:pointer;font-size:13px;line-height:1;padding:2px 4px;border-radius:5px;
  opacity:.55;transition:opacity .12s,background .12s,transform .15s;}
.tn-btn:hover{opacity:1;background:var(--paper-2);}
.tree-node.expanded .tn-chev{transform:rotate(90deg);}
/* an expanded node is a real card — give it room to breathe */
.tree-node.expanded{width:min(380px,84vw);}
.tree-node-body{display:none;border-top:1px solid var(--line);
  max-height:360px;overflow:auto;padding:10px 12px;}
.tree-node.expanded .tree-node-body{display:block;}
.tree-node-body .card{margin:0;border:none;box-shadow:none;opacity:1;
  transform:none;padding:0;}
.tree-node-body .figframe img{max-height:260px;}
/* hidden node -> slim dimmed chip (restore from its eye) */
.tree-node.tn-off{width:auto;border-top-color:var(--line);opacity:.6;}
.tree-node.tn-off .tn-title{-webkit-line-clamp:1;font-weight:500;
  color:var(--ink-3);font-size:11px;}
.tree-node.tn-off .tree-node-body,
.tree-node.tn-off .tn-chev{display:none;}
.tree-empty{padding:40px 10px;text-align:center;color:var(--ink-3);
  font-size:13px;}
/* per-cell resize corner (shows on hover) */
.tn-resize{position:absolute;right:2px;bottom:2px;width:13px;height:13px;
  cursor:nwse-resize;opacity:0;border-right:2px solid var(--ink-3);
  border-bottom:2px solid var(--ink-3);border-radius:0 0 4px 0;
  transition:opacity .12s;}
.tree-node:hover .tn-resize{opacity:.6;}
.tn-resize:hover{opacity:1;}
.tree-node.tn-off .tn-resize{display:none;}
/* dark theme: the tree canvas + nodes follow the app (the light-variable
   styling above is the light theme; dark is explicit overrides) */
body:not(.light) .tree-toolbar{
  background:linear-gradient(#0b141d 72%,transparent);}
body:not(.light) .tree-toolbar .tt-title{color:#7e93a4;}
body:not(.light) .tt-btn{background:#101c28;border-color:#ffffff22;
  color:#cdd9e3;}
body:not(.light) .tt-btn:hover{border-color:var(--cyan);color:#fff;}
body:not(.light) .tree-scroll{border-color:#ffffff1a;background:
  radial-gradient(circle at 1px 1px,#ffffff12 1px,transparent 0)
  0 0/22px 22px,#0e1926;}
body:not(.light) .tree-node{
  background:color-mix(in srgb,var(--nc) 12%,#101c28);
  border-color:#ffffff1c;
  border-top-color:var(--nc);box-shadow:0 1px 3px #00000040;}
body:not(.light) .tree-node.active{border-color:var(--cyan);
  box-shadow:0 3px 14px #39a9c04d;}
body:not(.light) .tn-title{color:#e6edf3;}
body:not(.light) .tn-btn{color:#8ba0b2;}
body:not(.light) .tn-resize{border-color:#8ba0b2;}
body:not(.light) .tn-btn:hover{background:#ffffff14;}
body:not(.light) .tree-node-body{border-top-color:#ffffff14;}
body:not(.light) .tree-node.tn-off{border-top-color:#ffffff1c;}
body:not(.light) .tree-node.tn-off .tn-title{color:#7e93a4;}
body:not(.light) .tree-empty{color:#7e93a4;}

/* ---------- present (full-screen document) mode -------------------- */
body.doc-presenting{--presrail-w:0px;padding-top:0;padding-left:0;
  overflow:hidden;}
body.doc-presenting .apptop,
body.doc-presenting .presrail,
body.doc-presenting .presrail-show{display:none!important;}
body.doc-presenting .docs{position:fixed;inset:0;z-index:82;overflow:auto;
  background:var(--paper-2);}
body.doc-presenting .shell{grid-template-columns:1fr;display:block;}
body.doc-presenting .nbshell .rail{display:none;}
/* the sidebar can slide back IN while presenting (⚌ Sections) */
body.doc-presenting.present-rail .nbshell .rail{display:block;
  position:fixed;left:0;top:0;bottom:0;width:290px;z-index:84;
  overflow-y:auto;background:var(--chrome);
  border-right:1px solid var(--chrome-line);}
body.doc-presenting.present-rail .content{margin-left:290px;}
body.doc-presenting .content{max-width:1000px;margin:0 auto;
  padding:56px 30px 30vh;}
body.doc-presenting .treeview{padding:56px 26px 24vh;height:100vh;}
body.doc-presenting .docbar{display:none;}
/* ---- presenting controls: a DOCKED bar, top or right ---------------
   Docked top it is the app bar, verbatim: same paddings, same groups,
   same two rows. Docked right the same groups turn into stacked rows.
   The document is inset by the bar, so nothing floats over content. */
.present-bar{position:fixed;z-index:140;display:flex;
  background:var(--chrome);border-color:#ffffff1f;}
.present-bar[hidden]{display:none!important;}
.pb-tools{display:flex;align-items:flex-start;}
.pb-own{display:flex;align-items:flex-start;}
/* --- docked across the TOP: identical to the app bar --- */
body.pbpos-top .present-bar{top:0;left:0;right:0;
  align-items:flex-start;gap:8px;padding:11px 16px;
  border-bottom:1px solid #ffffff1f;
  transition:transform .18s ease;}
/* docked top the bar IS the ribbon: the same labelled sections, aligned
   the same way, so nothing has to re-learn its layout.
   display:contents is the whole trick. As flex ITEMS, .pb-tools and
   .pb-own were each shrunk below their content width (flex-shrink:1) and
   so each wrapped INSIDE itself — the bar grew to three ragged rows while
   still having room to spare. With their boxes removed, the sections and
   the bar's own buttons share ONE wrapping flow, exactly like .appbar. */
body.pbpos-top .present-bar{align-items:stretch;flex-wrap:wrap;gap:6px;}
body.pbpos-top .pb-tools,body.pbpos-top .pb-own{display:contents;}
/* an auto margin on the first of its own buttons right-aligns the group
   without a growing spacer (a spacer would fill line 1 and force a wrap) */
body.pbpos-top .pb-own #pb-rail{margin-left:auto;}
body.pbpos-right .pb-tools,body.pbpos-right .pb-own{display:contents;}
body.pbpos-top .present-bar .pb-collapse{margin-left:6px;}
body.doc-presenting.pbpos-top .docs{top:var(--pbh,64px);}
body.pbpos-top.pb-folded .present-bar{transform:translateY(-101%);}
/* --- docked down the RIGHT: the groups become rows --- */
body.pbpos-right .present-bar{top:0;right:0;bottom:0;width:var(--pbw,232px);
  flex-direction:column;align-items:stretch;gap:8px;padding:12px;
  overflow-y:auto;border-left:1px solid #ffffff1f;
  transition:transform .18s ease;}
body.pbpos-right .pb-tools{flex-direction:column;align-items:stretch;
  gap:8px;}
body.pbpos-right .pb-own{flex-direction:column;align-items:stretch;gap:6px;}
/* a two-row group reads as one row per control when it is this narrow */
body.pbpos-right .pb-tools .fgrp{width:100%;}
/* NEVER wrap a group's own row here: with width:100% on every button, a
   wrapping row put the -, the 100% and the + each on their own line and
   the size steppers exploded down the sidebar */
body.pbpos-right .pb-tools .fgrp-row{flex-wrap:nowrap;}
body.pbpos-right .present-bar .toggle{width:100%;justify-content:flex-start;}
/* a stepper stays one line: caption, then -, value, + sharing the width */
body.pbpos-right .present-bar .fgrp-h{align-items:center;gap:6px;}
body.pbpos-right .present-bar .fgrp-h .fgrp-cap{min-width:44px;}
body.pbpos-right .present-bar .fgrp-h .fgrp-row{flex:1;}
body.pbpos-right .present-bar .fgrp-row .toggle.fz-step{width:30px;
  flex:none;justify-content:center;}
body.pbpos-right .present-bar .fgrp-row .toggle.fz-val{flex:1;width:auto;
  justify-content:center;}
/* the labelled sections stack down the bar and keep their captions */
body.pbpos-right .present-bar .abgrp{width:100%;}
body.pbpos-right .present-bar .abgrp-row{flex:none;flex-wrap:wrap;}
body.pbpos-right .present-bar .abgrp-lab{text-align:left;}
body.pbpos-right .present-bar .btn-grp{width:100%;flex-wrap:wrap;}
body.pbpos-right .present-bar .vw-stack{flex:1;}
body.pbpos-right .present-bar .appbar-div{display:none;}
body.doc-presenting.pbpos-right .docs{right:var(--pbw,232px);}
body.pbpos-right.pb-folded .present-bar{transform:translateX(101%);}
body.pbpos-right.pb-folded .docs{right:0;}
body.pbpos-top.pb-folded .docs{top:0;}
/* Exit sits in the VERY top-right corner, out of the wrap flow, so a
   narrow window can never push the way out onto a second row */
body.pbpos-top .pb-exit{position:absolute;top:8px;right:48px;z-index:3;}
body.pbpos-right .pb-exit{order:-1;}
.pb-exit{border-color:#39a9c059!important;color:#eaf6fa!important;}
.pb-exit:hover{background:#39a9c026!important;}
/* The fold/unfold button: ONE control, always in the same place and
   always the same shape, whether the bar is showing or hidden. */
.pb-toggle{position:fixed;top:9px;right:10px;z-index:142;
  font-family:var(--mono);font-size:13px;line-height:1;
  border:1px solid #ffffff22;background:#16273aee;color:#cfe0ea;
  cursor:pointer;width:30px;height:30px;padding:0;
  border-radius:var(--rad);display:none;align-items:center;
  justify-content:center;box-shadow:0 4px 14px #00000055;}
.pb-toggle[hidden]{display:none!important;}
body.doc-presenting .pb-toggle{display:inline-flex;}
.pb-toggle:hover{color:#fff;border-color:var(--cyan);}
body.light .pb-toggle{background:#fff;border-color:var(--line);
  color:var(--ink-2);}
/* auto-hide (taskbar style): the bar sits off-screen and slides back the
   moment the pointer reaches that edge. The document keeps the full
   screen — the bar overlays on peek instead of pushing content around. */
body.pb-auto.doc-presenting.pbpos-top .docs{top:0;}
body.pb-auto.doc-presenting.pbpos-right .docs{right:0;}
body.pb-auto.pbpos-top:not(.pb-peek) .present-bar{
  transform:translateY(-101%);}
body.pb-auto.pbpos-right:not(.pb-peek) .present-bar{
  transform:translateX(101%);}
/* :not(.pb-folded) matters — this rule used to win outright, so an
   explicit fold was invisible and the fold handle looked dead */
body.pb-auto.pb-peek:not(.pb-folded) .present-bar{transform:none!important;}
body.pbpos-top.pb-folded .present-bar{transform:translateY(-101%)!important;}
body.pbpos-right.pb-folded .present-bar{transform:translateX(101%)!important;}
.rawcell{position:relative;background:var(--paper);
  border:1px solid var(--line);border-radius:10px;
  padding:14px 16px 14px 16px;margin:12px 0;}
.rawtag{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink-3);display:inline-block;
  margin-bottom:8px;}
.rawcell.code .rawtag{color:var(--cyan-deep);}
.rawcell pre.code{margin:0;}
.rawout{margin-top:10px;}
.rawmd{font-family:var(--serif);font-size:15px;line-height:1.65;
  color:var(--ink-2);}
.rawmd h2,.rawmd h3,.rawmd h4,.rawmd h5,.rawmd h6{font-family:var(--sans);
  color:var(--ink);margin:4px 0 8px;letter-spacing:-.01em;}
.rawmd h2{font-size:24px;}
.rawmd h3{font-size:19px;}
.rawmd h4{font-size:16px;}
.rawempty{color:var(--ink-3);text-align:center;padding:40px;}
"""

_JS = r"""
(function(){
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};

  /* ================= app state ================= */
  var APP={mode:'static',token:'',root:'',project:{presentations:[],recent:[]}};
  var appEl=document.getElementById('app-data');
  if(appEl){try{APP=JSON.parse(appEl.textContent);}catch(e){}}
  APP.project=APP.project||{presentations:[],recent:[]};
  APP.shells={};          /* stem -> {el, data, path, title} */
  APP.order=[];           /* NOTEBOOK stems in tab order (deck/ref-facing) */
  APP.traces=[];          /* Plot-trace tab keys — kept OUT of APP.order so
                             the deck, refs + naming stay notebook-only */
  APP.active=null;
  window.SemApp=APP;
  /* every tab shown in the strip: notebooks first, then their trace tabs */
  function tabList(){return APP.order.concat(APP.traces);}

  function api(path,body){
    var url=path+(path.indexOf('?')<0?'?':'&')
      +'t='+encodeURIComponent(APP.token||'');
    var opt=body===undefined?{method:'GET'}
      :{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)};
    return fetch(url,opt).then(function(r){
      return r.json().catch(function(){throw new Error('HTTP '+r.status);})
        .then(function(j){
          if(!r.ok||(j&&j.error))
            throw new Error((j&&j.error)||('HTTP '+r.status));
          return j;
        });
    });
  }
  APP.api=api;

  /* ================= tab strip ================= */
  var tabstrip=$('#tabstrip'), openBtn=$('#tab-open');
  function refreshChrome(){
    var canOpen=APP.mode==='app'||APP.mode==='web';
    if(openBtn) openBtn.hidden=!canOpen;
    var wel=$('#welcome');
    if(wel) wel.hidden=!(canOpen&&!APP.order.length);
    var demo=$('#welcome-demo');
    if(demo) demo.hidden=(APP.mode!=='web');
    renderRecent();
  }
  /* ---- the tab's ⌚ Versions menu: automatic snapshots per open/reload */
  var versMenu=null;
  function closeVersMenu(){if(versMenu){versMenu.remove();versMenu=null;}}
  document.addEventListener('click',function(e){
    if(versMenu&&!versMenu.contains(e.target)) closeVersMenu();});
  function showVersMenu(btn,stem){
    /* the ⌚ button TOGGLES its own menu (no reopen flicker) */
    if(versMenu&&versMenu.dataset.stem===stem){closeVersMenu();return;}
    closeVersMenu();
    var sh=APP.shells[stem]; if(!sh||!sh.path) return;
    var m=document.createElement('div');
    m.className='ckfilter-menu vers-menu';
    m.dataset.stem=stem;
    var r=btn.getBoundingClientRect();
    m.style.top=(r.bottom+6)+'px';
    m.style.left=Math.max(6,
      Math.min(r.left,window.innerWidth-340))+'px';
    m.innerHTML='<div class="ckf-h">notebook versions</div>'
      +'<div class="ckf-empty vers-load">loading…</div>';
    document.body.appendChild(m);versMenu=m;
    api('/api/versions',{path:sh.path}).then(function(j){
      if(versMenu!==m) return;
      var ld=m.querySelector('.vers-load'); if(ld) ld.remove();
      function row(label,cur,fn,sub){
        var b=document.createElement('button');
        b.className='vers-row'+(cur?' on':'');b.type='button';
        var l1=document.createElement('span');l1.className='vers-l';
        l1.textContent=label;b.appendChild(l1);
        if(sub){
          var l2=document.createElement('span');l2.className='vers-sub';
          l2.textContent=sub;b.appendChild(l2);
        }
        b.title=label+(sub?'\n'+sub:'');
        b.addEventListener('click',function(e2){
          e2.stopPropagation();closeVersMenu();fn();});
        m.appendChild(b);
      }
      function openVer(req,toastMsg){
        api('/api/openversion',req).then(function(o){
          mountShellHTML(o.shell,o.path);
          var s2=APP.shells[o.stem];
          if(s2){
            s2.version=o.version;
            /* a version view is READ-ONLY: no add-note pencils (they
               would write into the LIVE file from an old anchor map) */
            $$('.card-addnote',s2.el).forEach(function(n){n.remove();});
            renderTabs();
          }
          docToast(toastMsg+' — ↻ or the ⌚ menu returns to live');
        }).catch(function(err){
          alert('Open failed: '+err.message);});
      }
      row('● Live — the file on disk',!sh.version,function(){
        openPath(sh.path);});
      /* the notebook's GIT history: hash + message per commit */
      var commits=j.commits||[];
      if(commits.length){
        var h1=document.createElement('div');h1.className='ckf-h';
        h1.textContent='git commits';m.appendChild(h1);
        commits.forEach(function(cm){
          row(cm.id+' · '+cm.msg,sh.version==='git:'+cm.id,function(){
            openVer({path:sh.path,commit:cm.id},
              'Viewing commit '+cm.id+' “'+cm.msg+'”');
          },cm.date);
        });
      }
      if((j.versions||[]).length){
        var h2=document.createElement('div');h2.className='ckf-h';
        h2.textContent='auto snapshots';m.appendChild(h2);
      }
      (j.versions||[]).forEach(function(v){
        row(v.label,sh.version===v.id,function(){
          openVer({path:sh.path,id:v.id},
            'Viewing the snapshot from '+v.label);
        });
      });
      if(!(j.versions||[]).length&&!commits.length){
        var d=document.createElement('div');d.className='ckf-empty';
        d.textContent='No history yet — a snapshot is kept every time '
          +'this notebook is opened or refreshed, and git commits show '
          +'here when the notebook is in a repository.';
        m.appendChild(d);
      }
    }).catch(function(err){
      if(versMenu===m)
        m.innerHTML='<div class="ckf-empty">'
          +String((err&&err.message)||err)+'</div>';
    });
  }
  function makeTab(stem){
    var sh=APP.shells[stem]; if(!sh) return null;
    var t=document.createElement('div');
    t.className='tab'+(stem===APP.active?' current':'')
      +(sh.trace?' tab-trace tab-sub':'');
    t.setAttribute('role','tab');
    t.title=sh.trace?('Plot trace — '+(sh.title||'')
        +'  ·  a sub-tab of '+(sh.source||''))
      :(sh.path||sh.title||stem);
    var lbl=document.createElement('span');lbl.className='tab-t';
    if(sh.trace){
      /* the ↳ hook reads as "nested under the tab before me" */
      var ic=document.createElement('span');ic.className='tab-trace-ic';
      ic.textContent='↳';
      t.appendChild(ic);
      lbl.textContent=sh.title||'Plot trace';
    } else {
      /* a tab opened AT A COMMIT keeps the notebook's name and wears the
         short hash underneath — "draft_01-2" told you nothing */
      lbl.textContent=sh.label||stem;
      if(sh.version){
        lbl.classList.add('tab-t-ver');
        var vs=document.createElement('span');
        vs.className='tab-ver';
        vs.textContent=/^git:/.test(sh.version)
          ?sh.version.slice(4):'earlier version';
        vs.title='This tab is showing an earlier version';
        lbl.appendChild(vs);
      }
    }
    t.appendChild(lbl);
    /* a trace sub-tab is always closeable (in every mode); notebook tabs get
       reload+close only in the modes that can reopen them */
    if(sh.trace){
      var xc=document.createElement('button');xc.className='tab-b';
      xc.innerHTML='&#10005;';xc.title='Close trace';
      xc.addEventListener('click',function(e){e.stopPropagation();
        closeNotebook(stem);});
      t.appendChild(xc);
    } else if(APP.mode==='app'||APP.mode==='web'){
      if(sh.version){
        var vm=document.createElement('span');vm.className='tab-vermark';
        vm.textContent='⌚';
        vm.title='Viewing an earlier version — ↻ or the ⌚ menu '
          +'returns to live';
        t.insertBefore(vm,lbl);
      }
      /* reload + versions used to hide on the tab, where nobody found
         them; they live in the sidebar's File info block now */
      var x=document.createElement('button');x.className='tab-b';
      x.innerHTML='&#10005;';x.title='Close tab';
      x.addEventListener('click',function(e){e.stopPropagation();
        closeNotebook(stem);});
      t.appendChild(x);
    }
    t.addEventListener('click',function(){activate(stem);});
    return t;
  }
  function renderTabs(){
    if(!tabstrip){refreshChrome();return;}
    tabstrip.innerHTML='';
    /* each notebook is followed inline by its own Plot-trace sub-tabs, so a
       trace reads as a child of the notebook it was opened from */
    APP.order.forEach(function(stem){
      var nb=makeTab(stem); if(nb) tabstrip.appendChild(nb);
      APP.traces.forEach(function(k){
        if(APP.shells[k]&&APP.shells[k].source===stem){
          var st=makeTab(k); if(st) tabstrip.appendChild(st);
        }
      });
    });
    /* defensive: a trace whose source is gone still gets a tab (at the end) */
    APP.traces.forEach(function(k){
      var sh=APP.shells[k];
      if(sh&&APP.order.indexOf(sh.source)<0){
        var st=makeTab(k); if(st) tabstrip.appendChild(st);
      }
    });
    refreshChrome();
  }
  function activate(stem){
    if(!APP.shells[stem]) return;
    APP.active=stem;
    tabList().forEach(function(s){APP.shells[s].el.hidden=(s!==stem);});
    renderTabs();
    invalidateSids();   /* the section list belongs to the new tab */
    renderRawBtn();renderViewBtns();relayoutActiveTree();
    /* filters belong to the NOTEBOOK, so the whole filter bar has to be
       rebound to the tab you just switched to (and its "Apply to" picker
       closed — its rows are namespaced to the previous notebook) */
    var scm=$('#sec-scope-menu');
    if(scm&&!scm.hidden) scm.hidden=true;
    renderTypeButtons();renderScopeBtn();
    updateHash();
    document.dispatchEvent(new CustomEvent('sem:activate',
      {detail:{stem:stem}}));
  }
  APP.activate=activate;

  /* ================= URL routing: a unique hash per view ================
     #/doc/<stem>  a document tab   #/pres/<name>[/s<n>]  a presentation slide.
     Bookmarkable + survives reload + back/forward, in every mode (hash only,
     so no server routing needed). The deck registers deckState/deckOpen. */
  var initialHash=location.hash, routeReady=false, pendingRoute=null,
      routeTimer=null;
  function setHash(h){
    if(location.hash===h||(!location.hash&&h==='#/')) return;
    /* replaceState (not location.hash=) so in-app navigation NEVER floods the
       back stack — the URL always mirrors the view, bookmarkable + reloadable,
       and Back leaves the app cleanly rather than stepping through tab switches */
    try{ if(history.replaceState)
           history.replaceState(null,'',
             location.pathname+location.search+(h==='#/'?'':h));
         else location.hash=h; }catch(e){}
  }
  function routeParse(hash){
    return String(hash||'').replace(/^#\/?/,'').split('/')
      .filter(Boolean).map(function(p){
        try{return decodeURIComponent(p);}catch(e){return p;}});
  }
  function updateHash(){
    if(!routeReady) return;
    var d=APP.deckState&&APP.deckState();
    if(d&&d.name){
      setHash('#/pres/'+encodeURIComponent(d.name)
        +(d.slide!=null?('/s'+(d.slide+1)):''));
      return;
    }
    var a=APP.active&&APP.shells[APP.active];
    var stem=a&&a.trace?a.source:APP.active;   /* a trace tab -> its source */
    setHash(stem?('#/doc/'+encodeURIComponent(stem)):'#/');
  }
  APP.updateHash=updateHash;
  /* idempotent: applying the hash for the view already showing is a no-op,
     so a programmatic setHash -> hashchange never loops or double-renders */
  function applyHash(hash){
    var parts=routeParse(hash);
    if(!parts.length) return;
    if(parts[0]==='pres'&&parts[1]){
      var slide=0;
      if(parts[2]&&/^s\d+$/i.test(parts[2]))
        slide=Math.max(0,parseInt(parts[2].slice(1),10)-1);
      var st=APP.deckState&&APP.deckState();
      if(st&&st.name===parts[1]){
        /* same presentation already open -> just move slide, keeping the
           current mode (don't reopen the editor / drop out of Present) */
        if(st.slide!==slide&&APP.deckGo) APP.deckGo(slide);
        return;
      }
      if(APP.deckOpen&&!APP.deckOpen(parts[1],slide)) updateHash();
    } else if(parts[0]==='doc'&&parts[1]){
      var open=APP.deckState&&APP.deckState();
      var ca=APP.shells[APP.active];
      var curStem=ca&&ca.trace?ca.source:APP.active;   /* symmetric w/ updateHash */
      if(!open&&curStem===parts[1]) return;
      if(open&&APP.deckClose) APP.deckClose();
      if(APP.shells[parts[1]]) activate(parts[1]);
    }
  }
  function tryRoute(){
    if(!pendingRoute) return;
    applyHash(pendingRoute);
    var parts=routeParse(pendingRoute);
    /* presentations open synchronously; a doc route may wait for its tab to
       mount (web mode restores notebooks asynchronously) */
    if(parts[0]!=='doc'||APP.shells[parts[1]]) pendingRoute=null;
  }
  APP.applyInitialRoute=function(){
    routeReady=true;
    var parts=routeParse(initialHash);
    if(parts.length&&(parts[0]==='doc'||parts[0]==='pres'))
      pendingRoute=initialHash;
    tryRoute();
    if(!location.hash) updateHash();   /* stamp the default view */
  };
  /* a tab mounting later (web restore) satisfies a still-pending route; debounce
     so it lands AFTER the restore's own mounting settles, not mid-storm */
  document.addEventListener('sem:shell',function(){
    if(!pendingRoute) return;
    if(routeTimer) clearTimeout(routeTimer);
    routeTimer=setTimeout(function(){
      applyHash(pendingRoute);pendingRoute=null;},250);
  });
  window.addEventListener('hashchange',function(){
    pendingRoute=null;   /* a real navigation supersedes the initial route */
    applyHash(location.hash);
  });

  /* ================= per-notebook document behaviors ================= */
  var scrim=$('#scrim');
  if(scrim) scrim.addEventListener('click',function(){
    $$('.rail.open').forEach(function(r){r.classList.remove('open');});
    scrim.classList.remove('show');
  });

  /* ---- global show/hide filters (top bar; apply to every tab) ----
     one state per ROLE. Markdown / Code / Plots / Output all cycle
     Visible -> Collapsed -> Hidden. The button LABEL shows the current
     state, not the action. */
  /* FILTERS ARE PER SECTION. `FDEF` is the notebook-wide default; a section
     the user has filtered differently gets its own state in `secF` (keyed
     stem::section so two notebooks never share one). Everything reads
     stateFor(); the appbar edits whichever sections "Apply to" selects. */
  /* a brief message for filter actions (the deck's toast lives inside the
     deck, which is hidden while you are reading the document) */
  var docToastEl=null,docToastT=null;
  function docToast(msg){
    if(!docToastEl){
      docToastEl=document.createElement('div');
      docToastEl.className='deck-toast';
    }
    docToastEl.textContent=msg;
    docToastEl.hidden=false;
    (document.fullscreenElement||document.body).appendChild(docToastEl);
    clearTimeout(docToastT);
    docToastT=setTimeout(function(){docToastEl.hidden=true;},3400);
  }
  /* a Plot-trace tab opens UNFILTERED — it is a fresh reading of the cells
     behind one figure, so the document's hidden code must not follow it
     (and its code shows, since the code is the point of a trace) */
  function newF(trace){
    return {md:'visible',code:trace?'visible':'collapsed',
      plot:'visible',out:'visible',ck:{},ot:{},pt:{}};
  }
  /* EVERYTHING here is per notebook: the default, the per-section
     overrides and the "Apply to" pick. One notebook's filters must never
     reach into another open tab. */
  var defBy={},secF={};
  function FDEFof(stem){
    var k=String(stem||'');
    if(!defBy[k]){
      var sh=APP.shells&&APP.shells[k];
      defBy[k]=newF(!!(sh&&sh.trace));
    }
    return defBy[k];
  }
  /* copy one notebook's filters onto another. `withOverrides` carries the
     per-section tweaks too — right for a trace (its cards keep the source's
     section ids), wrong across notebooks (their section ids differ). */
  function copyFiltersTo(destStem,srcStem,withOverrides){
    var s=String(srcStem),d=String(destStem);
    if(s===d) return;
    defBy[d]=cloneF(FDEFof(s));
    var dpre=d+'::',spre=s+'::',k;
    for(k in secF){if(k.indexOf(dpre)===0) delete secF[k];}
    for(k in secScope){if(k.indexOf(dpre)===0) delete secScope[k];}
    delete scopeSeeded[d];
    if(withOverrides){
      for(k in secF){
        if(k.indexOf(spre)===0)
          secF[dpre+k.slice(spre.length)]=cloneF(secF[k]);
      }
    }
  }
  function copyMap(o){
    var r={};for(var k in o){if(o[k]) r[k]=o[k];}return r;
  }
  function cloneF(s){
    return {md:s.md,code:s.code,plot:s.plot,out:s.out,
      ck:copyMap(s.ck),ot:copyMap(s.ot),pt:copyMap(s.pt)};
  }
  function fkey(stem,sid){return String(stem||'')+'::'+String(sid||'');}
  /* which section a CARD belongs to. data-secid travels with the node, so
     clones (tree view, plot-trace) keep obeying their source section. */
  function secIdOf(card){
    if(!card) return '';
    if(card.dataset&&card.dataset.secid) return card.dataset.secid;
    var s=card.closest?card.closest('.section'):null;
    return (s&&s.dataset.sec)||'';
  }
  function stateFor(stem,sid){
    return secF[fkey(stem,sid)]||FDEFof(stem);
  }
  var CODE_CYCLE=['visible','collapsed','hidden'];
  /* short enough that every state fits one fixed slot, so the button —
     and everything to the right of it — never moves */
  var CODE_LABEL={visible:'On',collapsed:'Fold',hidden:'Off',
    mixed:'Mix'};
  var CK_TYPES=['imports','function','data','settings',
    'plotting','print','comments','constant','code'];
  /* ---- "Apply to": which sections the filters act on. Empty = the whole
     notebook (every section). Ticking sections narrows the filters to
     them, so one chapter can hide its code while the next keeps it. ---- */
  /* The selection is just a SET of highlighted sections — no modes. A
     notebook starts with everything selected (so filters act on all of
     it), and "Select all" puts it back. */
  var secScope={},scopeSeeded={};
  /* a notebook starts with every section selected. The flag matters:
     "the user deselected everything" and "not set up yet" are both an
     empty set, and only the second should be filled in. */
  function seedScope(){
    var stem=String(activeStem()),ids=allSids();
    if(scopeSeeded[stem]||!ids.length) return;
    scopeSeeded[stem]=1;
    ids.forEach(function(id){secScope[fkey(stem,id)]=1;});
  }
  function scopeAll(){
    var ids=allSids();
    if(!ids.length) return true;
    var stem=activeStem();
    return ids.every(function(id){return !!secScope[fkey(stem,id)];});
  }
  function scopeCount(){return targetSids().length;}
  function renderScopeBtn(){
    var b=$('#sec-scope-btn'); if(!b) return;
    seedScope();
    var n=scopeCount(),tot=allSids().length;
    var lab=(!tot||n===tot)?'All'
      :(n?(n+' of '+tot):'none');
    b.innerHTML='Sections: '+lab+' &#9662;';
    b.classList.toggle('on',!!tot&&n!==tot);
  }
  /* ---- which sections the appbar is currently EDITING, and how to read
     and write their filter state ------------------------------------- */
  function activeStem(){return APP.active||'';}
  /* the section list is asked for many times per filter change (every
     readF, countF and anyType goes through it), so it is memoised per
     notebook and dropped whenever a shell is mounted or swapped */
  var sidMemo=null,sidMemoFor=null;
  function invalidateSids(){sidMemo=null;sidMemoFor=null;}
  APP.invalidateSids=invalidateSids;
  function allSids(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return [];
    if(sidMemoFor===APP.active&&sidMemo) return sidMemo;
    /* a Plot-trace tab builds bare <section> wrappers with no data-sec —
       they are not real notebook sections and must not become rows */
    sidMemo=$$('.section',sh.el).map(function(s){return s.dataset.sec;})
      .filter(Boolean);
    sidMemoFor=APP.active;
    return sidMemo;
  }
  function targetSids(){
    /* seed here, not only in the button renderer: a freshly activated
       notebook must already read as "all sections" the first time any
       filter asks, or the whole bar renders itself disabled */
    seedScope();
    var stem=activeStem();
    return allSids().filter(function(id){
      return !!secScope[fkey(stem,id)];});
  }
  /* the value of one filter across the selection — 'mixed' when they
     disagree, so the button never lies about a heterogeneous selection */
  function readF(key){
    var stem=activeStem(),ids=targetSids();
    if(!ids.length) return FDEFof(stem)[key];
    var first=stateFor(stem,ids[0])[key],same=true;
    ids.forEach(function(id){
      if(stateFor(stem,id)[key]!==first) same=false;});
    return same?first:'mixed';
  }
  /* how many of the selected sections hide this code/output/plot type */
  function countF(map,type){
    var stem=activeStem(),ids=targetSids(),n=0;
    if(!ids.length) return FDEFof(stem)[map][type]?1:0;
    ids.forEach(function(id){
      if(stateFor(stem,id)[map][type]) n++;});
    return n;
  }
  function targetCount(){
    var n=targetSids().length;
    return n||1;
  }
  /* apply a change to the selection. "Entire notebook" also rewrites the
     existing per-section overrides for THAT property, so the notebook
     really does become uniform without losing a section's other choices */
  function writeF(fn){
    var stem=activeStem(),ids=targetSids();
    if(scopeAll()){
      fn(FDEFof(stem));
      ids.forEach(function(id){
        var o=secF[fkey(stem,id)];
        if(o) fn(o);
      });
    } else {
      ids.forEach(function(id){
        var k=fkey(stem,id);
        if(!secF[k]) secF[k]=cloneF(FDEFof(stem));
        fn(secF[k]);
      });
    }
    pruneF(stem);
    markSecOverrides();
  }
  function sameMap(x,y){
    var kx=Object.keys(x);
    if(kx.length!==Object.keys(y).length) return false;
    for(var i=0;i<kx.length;i++){if(!y[kx[i]]) return false;}
    return true;
  }
  function sameF(a,b){
    return a.md===b.md&&a.code===b.code&&a.plot===b.plot&&a.out===b.out
      &&sameMap(a.ck,b.ck)&&sameMap(a.ot,b.ot)&&sameMap(a.pt,b.pt);
  }
  /* an override that has drifted back to its notebook's default is NOT an
     override — drop it, else the section keeps a "· filtered" badge that
     lies. Scoped to ONE notebook: another tab's overrides are compared
     against a different default and must not be touched. */
  function pruneF(stem){
    var pre=String(stem||'')+'::';
    for(var k in secF){
      if(k.indexOf(pre)!==0) continue;
      if(secF[k]&&sameF(secF[k],FDEFof(stem))) delete secF[k];
    }
  }
  /* a section filtered differently from the rest says so in its header */
  function markSecOverrides(){
    $$('.nbshell').forEach(function(sh){
      var stem=sh.dataset.nb;
      $$('.section',sh).forEach(function(s){
        s.classList.toggle('has-fover',
          !!secF[fkey(stem,s.dataset.sec)]);
      });
    });
  }
  /* Reset clears THIS notebook: its default, its per-section overrides and
     its "Apply to" pick. Other open tabs keep their own filters. */
  function resetFilters(){
    var stem=String(activeStem()),pre=stem+'::';
    var sh=APP.shells&&APP.shells[stem];
    defBy[stem]=newF(!!(sh&&sh.trace));
    [secF,secScope,scopeOpen].forEach(function(m){
      for(var k in m){if(k.indexOf(pre)===0) delete m[k];}
    });
    delete scopeSeeded[stem];
    seedScope();          /* back to "All sections" */
    markSecOverrides();renderScopeBtn();
    var m=$('#sec-scope-menu');
    if(m&&!m.hidden) renderScopeMenu();   /* an open picker must not lie */
    applyFilters();applyCodeState();
  }
  var scopeOpen={};   /* which parent rows are expanded in the picker */
  function scopeTree(){
    /* the section list as a tree: each node knows the ids of its whole
       subtree (the deeper sections that follow it) */
    var sh=APP.active&&APP.shells[APP.active];
    var rows=sh?$$('.section',sh.el):[];
    var stem=activeStem();
    return rows.map(function(s,i){
      var lv=+(s.dataset.level||2),kids=[];
      for(var j=i+1;j<rows.length;j++){
        if(+(rows[j].dataset.level||2)<=lv) break;
        kids.push(fkey(stem,rows[j].dataset.sec));
      }
      var t=s.querySelector('.sectionhead h2');
      var eb=s.querySelector('.sectionhead .eyebrow');
      return {id:fkey(stem,s.dataset.sec),lv:lv,kids:kids,
        num:eb?(eb.textContent||'').replace(/^section\s*/i,'').trim():'',
        title:(t&&t.textContent)||s.dataset.sec};
    });
  }
  function renderScopeMenu(){
    var m=$('#sec-scope-menu'); if(!m) return;
    m.innerHTML='';
    var nodes=scopeTree();
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='apply the filters to';m.appendChild(h);
    /* one button, one meaning, one label — always "Select all" */
    var all=document.createElement('button');
    all.className='ckf-all';
    all.textContent='Select all';
    all.addEventListener('click',function(e){
      e.stopPropagation();
      nodes.forEach(function(n){secScope[n.id]=1;});
      renderScopeMenu();renderScopeBtn();applyFilters();
    });
    m.appendChild(all);
    /* …and, at the foot, send these filters to the other notebooks */
    var many=(APP.order||[]).length>1;
    var cp=document.createElement('button');
    cp.className='ckf-all scope-copy';
    cp.textContent='Copy these filters to all notebooks';
    cp.disabled=!many;
    cp.title=many
      ?'Every other open notebook gets the filters this one is using '
        +'(their own per-section changes are cleared)'
      :'Open a second notebook to copy these filters across';
    cp.addEventListener('click',function(e){
      e.stopPropagation();
      var mm=$('#sec-scope-menu'); if(mm) mm.hidden=true;
      copyFiltersToAll();
    });
    if(!nodes.length){
      var e0=document.createElement('div');e0.className='ckf-empty';
      e0.textContent='No sections in this notebook';
      m.appendChild(e0);m.appendChild(cp);return;
    }
    function on(id){return !!secScope[id];}
    function setSub(n,val){
      /* a heading carries its sub-headings with it */
      if(val) secScope[n.id]=1; else delete secScope[n.id];
      n.kids.forEach(function(k){
        if(val) secScope[k]=1; else delete secScope[k];});
    }
    /* a row is visible only while every ancestor is expanded */
    var hideUnder=null;
    nodes.forEach(function(n,i){
      if(hideUnder!=null&&n.lv<=hideUnder) hideUnder=null;
      var hidden=(hideUnder!=null);
      if(!hidden&&n.kids.length&&!scopeOpen[n.id]) hideUnder=n.lv;
      if(hidden) return;
      var selfOn=on(n.id);
      /* the WHOLE ROW is the selection control (highlighted = selected);
         only the little arrow expands or collapses */
      var part=n.kids.some(function(k){return on(k)!==selfOn;});
      var row=document.createElement('div');
      row.className='ckf-row scope-row scope-l'+n.lv
        +(selfOn?' on':'')+(part?' part':'');
      row.setAttribute('role','button');
      row.tabIndex=0;
      row.title=(selfOn?'Selected':'Not selected')
        +(n.kids.length?' — click to '+(selfOn?'drop':'add')
          +' this heading and the '+n.kids.length+' inside it'
          :' — click to '+(selfOn?'drop':'add')+' this section');
      var tw=document.createElement('span');tw.className='scope-tw';
      if(n.kids.length){
        var ch=document.createElement('button');
        ch.className='scope-chev'+(scopeOpen[n.id]?' open':'');
        ch.type='button';
        ch.innerHTML='&#9656;';
        ch.title=(scopeOpen[n.id]?'Hide':'Show')
          +' the sub-headings under this one';
        ch.addEventListener('click',function(e){
          e.preventDefault();e.stopPropagation();
          scopeOpen[n.id]=!scopeOpen[n.id];
          renderScopeMenu();
        });
        tw.appendChild(ch);
      }
      row.appendChild(tw);
      var tx=document.createElement('span');tx.className='scope-t';
      tx.textContent=(n.num?n.num+'  ':'')+n.title;
      if(n.kids.length){
        var cnt=document.createElement('span');
        cnt.className='scope-n';
        cnt.textContent=n.kids.length;
        cnt.title=n.kids.length+' sub-section'
          +(n.kids.length>1?'s':'')+' inside';
        tx.appendChild(cnt);
      }
      row.appendChild(tx);
      function pick(e){
        e.preventDefault();e.stopPropagation();
        setSub(n,!selfOn);
        renderScopeMenu();renderScopeBtn();applyFilters();
      }
      row.addEventListener('click',pick);
      row.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') pick(e);});
      m.appendChild(row);
    });
    m.appendChild(cp);
  }
  function setTvBtn(id,label,state){
    var b=$('#'+id); if(!b) return;
    /* the state word sits in a fixed-width slot: without it the button
       (and everything after it) jumps as On -> Folded -> Off.
       Only the two SPANS are written — rewriting innerHTML here would
       delete the button's icon, which is an <svg> sibling. */
    var dot=b.querySelector('.tdot'),txt=b.querySelector('.btxt'),
        st=b.querySelector('.tvstate');
    if(!dot){
      dot=document.createElement('span');dot.className='tdot';
      b.appendChild(dot);
    }
    if(!txt){
      txt=document.createElement('span');txt.className='btxt';
      b.appendChild(txt);
    }
    if(!st){
      st=document.createElement('span');st.className='tvstate';
      b.appendChild(st);
    }
    txt.textContent=label;
    st.textContent=CODE_LABEL[state]||state;
    b.classList.toggle('off',state==='hidden');
    b.classList.toggle('half',state==='collapsed');
    b.classList.toggle('mixed',state==='mixed');
    b.setAttribute('data-cs',state);
  }
  /* the "…" overflow (Help + Support): one click deep, so the bar fits */
  (function(){
    var wrap=$('#more-btn')&&$('#more-btn').parentNode;
    var btn=$('#more-btn'),menu=$('#more-menu');
    if(!btn||!menu) return;
    function close(){menu.hidden=true;
      btn.setAttribute('aria-expanded','false');}
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open.toString());
      if(open){
        var r=btn.getBoundingClientRect();
        menu.style.top=(r.bottom+6)+'px';
        menu.style.left=Math.max(8,
          Math.min(r.left,window.innerWidth-224))+'px';
      }
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&wrap&&!wrap.contains(e.target)) close();});
    menu.addEventListener('click',function(){close();});
  })();
  /* which cross-notebook filter buttons make sense for the active tab */
  function renderFilterExtras(){
    var sh=APP.active&&APP.shells[APP.active];
    var isTrace=!!(sh&&sh.trace);
    /* "Present" is meaningless while you are already presenting */
    var dp=$('#doc-present');
    if(dp) dp.hidden=document.body.classList.contains('doc-presenting');
    var ti=$('#trace-inherit');
    if(ti) ti.hidden=!isTrace;
    /* an empty group still costs a gap in the bar */
    var cg=$('#copy-grp');
    if(cg) cg.hidden=!isTrace;
    /* a trace has no real sections, so "Apply to" has nothing to pick */
    var sc=$('#sec-scope-btn');
    if(sc) sc.hidden=isTrace;
    var fa=$('#filters-all');
    if(fa){
      fa.hidden=isTrace;
      var n=(APP.order||[]).length;
      fa.disabled=n<2;
      fa.classList.toggle('notarget',n<2);
      fa.title=n<2
        ?'Open a second notebook to copy these filters across'
        :'Give every other open notebook the filters this one is using';
    }
  }
  function renderTypeButtons(){
    setTvBtn('tv-markdown','Markdown',readF('md'));
    setTvBtn('tv-code','Code',readF('code'));
    setTvBtn('tv-plots','Plots',readF('plot'));
    setTvBtn('tv-output','Output',readF('out'));
    renderFilterExtras();
    /* "Apply to" with nothing ticked: the filters have no target, so say
       so instead of letting clicks do nothing */
    var none=allSids().length>0&&targetSids().length===0;
    ['tv-markdown','tv-code','tv-plots','tv-output',
     'ck-filter-btn','ot-filter-btn','pt-filter-btn'].forEach(function(id){
      var b=$('#'+id); if(!b) return;
      /* keep the button's real explanation to restore afterwards */
      if(b.dataset.tip0==null) b.dataset.tip0=b.getAttribute('title')||'';
      b.disabled=none;
      b.classList.toggle('notarget',none);
      b.title=none?'Pick at least one section in "Apply to" first'
        :b.dataset.tip0;
    });
  }
  /* the figure part's real children (the zoom buttons are chrome) */
  function figCount(fig){
    var n=0;
    [].forEach.call(fig.children,function(el){
      if(!el.classList.contains('figzoom')) n++;});
    return n;
  }
  function applyFilters(){
    $$('.nbshell').forEach(function(sh){
      var stem=sh.dataset.nb;
      /* only the DOCUMENT feed: the tree view holds clones of these same
         cards and must always show every node in full */
      $$('.content .card',sh).forEach(function(c){
        /* a per-cell eye can hide one cell regardless of the filters */
        var off=c.classList.contains('cell-off');
        /* EVERY card obeys ITS OWN section's filter state, so one chapter
           can hide code while the next keeps it (the vars below shadow the
           old globals, which is why the body reads unchanged) */
        /* the card's OWN section id, stamped at render time — a clone in
           the tree view or a Plot-trace tab has no .section ancestor, and
           an ancestor lookup would silently fall back to the default */
        var st=stateFor(stem,secIdOf(c));
        var mdState=st.md,codeState=st.code,plotState=st.plot,
            outState=st.out;
        var ckHidden=st.ck,otHidden=st.ot,ptHidden=st.pt;
        var note=c.dataset.note==='1';
        var filtGone;
        if(note){
          /* a markdown note is one part — the Markdown filter owns the card */
          filtGone=mdState==='hidden';
          c.classList.toggle('collapsed',
            !filtGone&&!off&&mdState==='collapsed');
          if(filtGone||off||mdState!=='collapsed') c.classList.remove('expanded');
        } else {
          /* PART-BASED: every non-markdown cell may hold a code part, a plot
             part and an output part; each answers to its OWN filter. The card
             disappears only when none of its parts remain visible. */
          var ckOff=!!(c.dataset.ck&&ckHidden[c.dataset.ck.split(' ')[0]]);
          var fig=c.querySelector('.cb-fig'),
              out=c.querySelector('.cb-out'),
              cw=c.querySelector('.codewrap');
          if(out){
            out.classList.toggle('part-off',outState==='hidden');
            out.classList.toggle('part-fold',outState==='collapsed');
            if(outState!=='collapsed') out.classList.remove('part-open');
          }
          if(cw) cw.classList.toggle('code-off',codeState==='hidden'||ckOff);
          /* the advanced Plot-types filter hides individual figures by
             library (matplotlib / plotly / bokeh / …). Stamp pt-off on
             every frame, then fold pager pages and the part upward; the
             plot part counts as visible only if some figure survives. */
          var figVis=false;
          if(fig&&plotState!=='hidden'){
            $$('[data-pt]',fig).forEach(function(n){
              var pts=n.dataset.pt.split(' ').filter(Boolean);
              n.classList.toggle('pt-off',
                pts.length>0&&pts.every(function(t){return ptHidden[t];}));
            });
            /* a pager PAGE is off when every frame on it is off; keep the
               'current' page a visible one and the ‹1 / N› count honest */
            $$('.figpage',fig).forEach(function(p){
              var fr=$$('[data-pt]',p);
              p.classList.toggle('pt-off',
                fr.length>0&&fr.every(function(n){
                  return n.classList.contains('pt-off');}));
            });
            $$('.figpager',fig).forEach(function(pgr){
              var pages=$$(':scope > .figpage',pgr);
              var vis=pages.filter(function(p){
                return !p.classList.contains('pt-off');});
              var curp=pages.filter(function(p){
                return p.classList.contains('current');})[0];
              if(vis.length&&(!curp||curp.classList.contains('pt-off'))){
                if(curp) curp.classList.remove('current');
                vis[0].classList.add('current');
                if(window.SemActivate) window.SemActivate(vis[0],true);
              }
              var ct=pgr.querySelector('.fp-count');
              if(ct&&vis.length){
                var ci=vis.indexOf(pgr.querySelector(
                  ':scope > .figpage.current'));
                ct.textContent=(Math.max(0,ci)+1)+' / '+vis.length;
              }
              var nav=pgr.querySelector('.figpager-nav');
              if(nav) nav.style.display=vis.length>1?'':'none';
            });
            [].forEach.call(fig.children,function(el){
              var off;
              if(el.classList.contains('figzoom')) return;  /* chrome */
              if(el.classList.contains('figpager')){
                var pgs=$$('.figpage',el);
                off=pgs.length>0&&pgs.every(function(p){
                  return p.classList.contains('pt-off');});
              } else {
                var pts=(el.dataset&&el.dataset.pt)
                  ?el.dataset.pt.split(' ')
                  :$$('[data-pt]',el).map(function(n){return n.dataset.pt;});
                pts=pts.filter(Boolean);
                off=pts.length>0&&pts.every(function(t){
                  return ptHidden[t];});
              }
              el.classList.toggle('pt-off',off);
              if(!off) figVis=true;
            });
            if(!figCount(fig)) figVis=true;
          }
          if(fig){
            /* every plot type-hidden -> the part folds away entirely (no
               "Show plot" stub over nothing) */
            var allPtOff=plotState!=='hidden'
              &&!figVis&&figCount(fig)>0;
            fig.classList.toggle('part-off',
              plotState==='hidden'||allPtOff);
            fig.classList.toggle('part-fold',
              plotState==='collapsed'&&!allPtOff);
            if(plotState!=='collapsed') fig.classList.remove('part-open');
          }
          /* the advanced Output-types filter hides individual outputs by kind;
             the output part counts as visible only if some output survives */
          var outVis=false;
          if(out&&outState!=='hidden'){
            [].forEach.call(out.children,function(el){
              var mm=(el.className||'').match(/\bot-([a-z]+)\b/);
              var typ=mm&&mm[1]!=='off'?mm[1]:null;
              var otOff=!!(typ&&otHidden[typ]);
              el.classList.toggle('ot-off',otOff);
              if(!otOff) outVis=true;
            });
            if(!out.children.length) outVis=true;
          }
          var codeVis=!!cw&&codeState!=='hidden'&&!ckOff;
          filtGone=!figVis&&!outVis&&!codeVis;
          c.classList.remove('collapsed','expanded');   /* parts fold, not cards */
        }
        var id=c.id.replace(/^card-/,'');
        c.classList.toggle('is-hidden',filtGone||off);
        var nav=sh.querySelector('.navitem[data-item="'+id+'"]');
        if(nav){
          /* filtered out -> gone from the sidebar; manually hidden -> STAYS
             (dimmed, so you can bring it back) */
          nav.classList.toggle('nav-hidden',filtGone);
          nav.classList.toggle('cell-off',off);
        }
      });
      $$('.section',sh).forEach(function(sec){
        /* a section hidden via its eye is a manual state, kept out of the
           filter-driven fold so its (dimmed) sidebar row survives to restore */
        var secOff=sec.classList.contains('sec-off');
        var cards=$$('.card',sec);
        /* doc: an empty section header (all its cards hidden) folds away */
        var allGone=cards.length>0&&cards.every(function(c){
          return c.classList.contains('is-hidden');});
        sec.classList.toggle('is-hidden',allGone&&!secOff);
        var sid=sec.dataset.sec;
        var row=sh.querySelector('.navsec-row[data-sec="'+sid+'"]');
        var items=sh.querySelector('.navitems[data-sec="'+sid+'"]');
        /* nav: the section vanishes only if EVERY item is filtered out —
           manually-hidden cells/sections keep their (dimmed) rows to restore */
        var navs=items?$$('.navitem',items):[];
        var navGone=navs.length>0&&navs.every(function(n){
          return n.classList.contains('nav-hidden');});
        if(row) row.classList.toggle('nav-hidden',navGone&&!secOff);
        if(items) items.classList.toggle('nav-hidden',navGone&&!secOff);
      });
    });
    renderTypeButtons();
    /* an advanced picker lights up when ANY selected section hides a type
       (one section-list lookup for all three, not one each) */
    var anyStem=activeStem(),anyIds=targetSids();
    function anyType(map){
      var n=0;
      if(!anyIds.length) return Object.keys(FDEFof(anyStem)[map]).length>0;
      anyIds.forEach(function(id){
        if(Object.keys(stateFor(anyStem,id)[map]).length) n++;});
      return n>0;
    }
    var fb=$('#ck-filter-btn');
    if(fb) fb.classList.toggle('on',anyType('ck'));
    var ob=$('#ot-filter-btn');
    if(ob) ob.classList.toggle('on',anyType('ot'));
    var pb=$('#pt-filter-btn');
    if(pb) pb.classList.toggle('on',anyType('pt'));
    renderScopeBtn();
    markSecOverrides();
    syncTypeMenus();
    scheduleSaveLayout();   /* remember this for next time */
  }
  /* refresh an OPEN type menu's ticks in place. Rebuilding it mid-click
     would yank the rows out from under a user ticking several in a row. */
  function syncTypeMenus(){
    ['#ck-filter-menu','#pt-filter-menu','#ot-filter-menu']
      .forEach(function(sel){
        $$(sel+' .ckf-row').forEach(function(r){
          var t=r.dataset.t,map=r.dataset.map;
          if(!t||!map) return;
          var cb=$('input',r); if(!cb) return;
          var n=countF(map,t);
          cb.checked=n===0;
          cb.indeterminate=n>0&&n<targetCount();
        });
      });
  }
  /* advanced filter menu: hide specific code subtypes */
  function presentCkTypes(){
    var set={};
    $$('.nbshell .card[data-ck]').forEach(function(c){
      c.dataset.ck.split(' ').forEach(function(t){set[t]=1;});});
    return CK_TYPES.filter(function(t){return set[t];});
  }
  function renderCkMenu(){
    var m=$('#ck-filter-menu'); if(!m) return;
    m.innerHTML='';
    var types=presentCkTypes();
    if(!types.length){
      m.innerHTML='<div class="ckf-empty">No typed code cells yet</div>';
      return;
    }
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='show code types';m.appendChild(h);
    types.forEach(function(t){
      var row=document.createElement('label');row.className='ckf-row';
      row.dataset.t=t;row.dataset.map='ck';
      var cb=document.createElement('input');cb.type='checkbox';
      var nHid=countF('ck',t);
      cb.checked=nHid===0;
      cb.indeterminate=nHid>0&&nHid<targetCount();
      cb.addEventListener('change',function(){
        var show=cb.checked;
        writeF(function(s){
          if(show) delete s.ck[t]; else s.ck[t]=1;});
        applyFilters();
      });
      var sw=document.createElement('span');
      sw.className='ckf-dot ckmain-'+t;
      var tx=document.createElement('span');tx.textContent=t;
      row.appendChild(cb);row.appendChild(sw);row.appendChild(tx);
      m.appendChild(row);
    });
  }
  /* only one advanced filter menu open at a time */
  function closeFilterMenus(except){
    ['#ck-filter-menu','#pt-filter-menu','#ot-filter-menu',
     '#sec-scope-menu']
      .forEach(function(sel){
        if(sel===except) return;
        var m=$(sel); if(m&&!m.hidden) m.hidden=true;
      });
  }
  var scBtn=$('#sec-scope-btn'),scMenu=$('#sec-scope-menu');
  if(scBtn) scBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!scMenu) return;
    if(scMenu.hidden){
      closeFilterMenus('#sec-scope-menu');
      renderScopeMenu();scMenu.hidden=false;
      var r=scBtn.getBoundingClientRect();
      scMenu.style.top=(r.bottom+6)+'px';
      scMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-260))+'px';
    } else scMenu.hidden=true;
  });
  if(scMenu) scMenu.addEventListener('click',function(e){
    e.stopPropagation();});
  /* like the other pickers: a click anywhere else closes it */
  document.addEventListener('click',function(e){
    if(scMenu&&!scMenu.hidden&&e.target!==scBtn
       &&!scMenu.contains(e.target)) scMenu.hidden=true;});
  var ckBtn=$('#ck-filter-btn'),ckMenu=$('#ck-filter-menu');
  if(ckBtn) ckBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!ckMenu) return;
    if(ckMenu.hidden){
      closeFilterMenus('#ck-filter-menu');
      renderCkMenu();ckMenu.hidden=false;
      var r=ckBtn.getBoundingClientRect();
      ckMenu.style.top=(r.bottom+6)+'px';
      ckMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-190))+'px';
    } else ckMenu.hidden=true;
  });
  document.addEventListener('click',function(e){
    if(ckMenu&&!ckMenu.hidden&&!ckMenu.contains(e.target)
       &&e.target!==ckBtn) ckMenu.hidden=true;
  });
  /* advanced PLOT-type filter: hide figures by the library that drew them
     (matplotlib images, plotly, bokeh, vega/altair, folium, animations,
     video, other widgets) — like the code-type filter, but for plots */
  var PT_TYPES=['matplotlib','plotly','bokeh','vega','folium',
    'animation','video','widget'];
  function presentPtTypes(){
    var set={};
    $$('.nbshell .cb-fig[data-pt]').forEach(function(c){
      c.dataset.pt.split(' ').forEach(function(t){if(t)set[t]=1;});});
    var out=PT_TYPES.filter(function(t){return set[t];});
    Object.keys(set).forEach(function(t){
      if(PT_TYPES.indexOf(t)<0) out.push(t);});  /* unknown slugs still show */
    return out;
  }
  function renderPtMenu(){
    var m=$('#pt-filter-menu'); if(!m) return;
    m.innerHTML='';
    var types=presentPtTypes();
    if(!types.length){
      m.innerHTML='<div class="ckf-empty">No plots yet</div>';return;}
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='show plot types';m.appendChild(h);
    types.forEach(function(t){
      var row=document.createElement('label');row.className='ckf-row';
      row.dataset.t=t;row.dataset.map='pt';
      var cb=document.createElement('input');cb.type='checkbox';
      var nHidP=countF('pt',t);
      cb.checked=nHidP===0;
      cb.indeterminate=nHidP>0&&nHidP<targetCount();
      cb.addEventListener('change',function(){
        var show=cb.checked;
        writeF(function(s){
          if(show) delete s.pt[t]; else s.pt[t]=1;});
        applyFilters();});
      var sw=document.createElement('span');sw.className='ckf-dot pt-sw-'+t;
      var tx=document.createElement('span');tx.textContent=t;
      row.appendChild(cb);row.appendChild(sw);row.appendChild(tx);
      m.appendChild(row);});
  }
  var ptBtn=$('#pt-filter-btn'),ptMenu=$('#pt-filter-menu');
  if(ptBtn) ptBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!ptMenu) return;
    if(ptMenu.hidden){
      closeFilterMenus('#pt-filter-menu');
      renderPtMenu();ptMenu.hidden=false;
      var r=ptBtn.getBoundingClientRect();
      ptMenu.style.top=(r.bottom+6)+'px';
      ptMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-190))+'px';
    } else ptMenu.hidden=true;});
  document.addEventListener('click',function(e){
    if(ptMenu&&!ptMenu.hidden&&!ptMenu.contains(e.target)
       &&e.target!==ptBtn) ptMenu.hidden=true;});
  /* advanced OUTPUT-type filter: hide specific printed-output kinds (print,
     dataset, result, error) — like the code-type filter, but for output */
  /* preferred ordering; any other slug present (a finer repr type) is appended
     after these so the menu never drops a type it doesn't already know */
  var OT_TYPES=['print','numeric','string','bool','none','list','tuple','set',
    'dict','array','series','dataframe','dataset','function','class','module',
    'object','value','result','error'];
  function presentOtTypes(){
    var set={};
    $$('.nbshell .cb-out[data-ot]').forEach(function(c){
      c.dataset.ot.split(' ').forEach(function(t){if(t)set[t]=1;});});
    var out=OT_TYPES.filter(function(t){return set[t];});
    Object.keys(set).forEach(function(t){
      if(OT_TYPES.indexOf(t)<0) out.push(t);});   /* unknown slugs still show */
    return out;
  }
  function renderOtMenu(){
    var m=$('#ot-filter-menu'); if(!m) return;
    m.innerHTML='';
    var types=presentOtTypes();
    if(!types.length){
      m.innerHTML='<div class="ckf-empty">No printed output yet</div>';return;}
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='show output types';m.appendChild(h);
    types.forEach(function(t){
      var row=document.createElement('label');row.className='ckf-row';
      row.dataset.t=t;row.dataset.map='ot';
      var cb=document.createElement('input');cb.type='checkbox';
      var nHidO=countF('ot',t);
      cb.checked=nHidO===0;
      cb.indeterminate=nHidO>0&&nHidO<targetCount();
      cb.addEventListener('change',function(){
        var show=cb.checked;
        writeF(function(s){
          if(show) delete s.ot[t]; else s.ot[t]=1;});
        applyFilters();});
      var sw=document.createElement('span');sw.className='ckf-dot ot-sw-'+t;
      var tx=document.createElement('span');tx.textContent=t;
      row.appendChild(cb);row.appendChild(sw);row.appendChild(tx);
      m.appendChild(row);});
  }
  var otBtn=$('#ot-filter-btn'),otMenu=$('#ot-filter-menu');
  if(otBtn) otBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!otMenu) return;
    if(otMenu.hidden){
      closeFilterMenus('#ot-filter-menu');
      renderOtMenu();otMenu.hidden=false;
      var r=otBtn.getBoundingClientRect();
      otMenu.style.top=(r.bottom+6)+'px';
      otMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-190))+'px';
    } else otMenu.hidden=true;});
  document.addEventListener('click',function(e){
    if(otMenu&&!otMenu.hidden&&!otMenu.contains(e.target)
       &&e.target!==otBtn) otMenu.hidden=true;});
  /* the code state drives every code block: code cards AND the blocks
     folded under every figure / dataset card. Visible = expanded,
     Collapsed = folded, Hidden = the block disappears entirely. */
  function setCodeOpen(w,open){
    if(open) w.setAttribute('data-open','');
    else w.removeAttribute('data-open');
    var btn=$('.codetoggle',w);
    if(btn) btn.setAttribute('aria-expanded',open?'true':'false');
  }
  /* fold/expand each codewrap (data-open) to ITS OWN section's state.
     HIDING a codewrap (code-off) is owned by applyFilters — the Code
     filter plus the code-type filter. */
  function applyCodeState(root){
    var shells=(root&&root.classList
      &&root.classList.contains('nbshell'))
      ?[root]:$$('.nbshell',root||document);
    shells.forEach(function(sh){
      var stem=sh.dataset.nb;
      $$('.content .codewrap',sh).forEach(function(w){
        setCodeOpen(w,stateFor(stem,secIdOf(w.closest('.card')))
          .code==='visible');
      });
    });
  }
  function cycle3(s){return CODE_CYCLE[(CODE_CYCLE.indexOf(s)+1)%3];}
  /* one click = advance the SELECTED sections. A mixed selection lands on
     a definite state first (Visible) rather than advancing from a lie. */
  function cycleF(key){
    var cur=readF(key);
    var next=(cur==='mixed')?'visible':cycle3(cur);
    writeF(function(s){s[key]=next;});
    applyFilters();
    if(key==='code') applyCodeState();
  }
  var mkBtn=$('#tv-markdown');
  if(mkBtn) mkBtn.addEventListener('click',function(){cycleF('md');});
  var plBtn=$('#tv-plots');
  if(plBtn) plBtn.addEventListener('click',function(){cycleF('plot');});
  var opBtn=$('#tv-output');
  if(opBtn) opBtn.addEventListener('click',function(){cycleF('out');});
  var cb=$('#tv-code');
  if(cb) cb.addEventListener('click',function(){cycleF('code');});
  var rsBtn=$('#filters-reset');
  if(rsBtn) rsBtn.addEventListener('click',function(){
    resetFilters();
    docToast('Filters reset for this notebook');
  });
  /* a trace opens unfiltered; this pulls its source document's filters in
     (its clones carry the source's section ids, so the per-section tweaks
     land on exactly the right cells) */
  var tiBtn=$('#trace-inherit');
  if(tiBtn) tiBtn.addEventListener('click',function(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh||!sh.trace||!sh.source) return;
    copyFiltersTo(APP.active,sh.source,true);
    renderTypeButtons();renderScopeBtn();
    applyFilters();applyCodeState();
    docToast('Using the filters from '+sh.source);
  });
  /* "these filters, everywhere" — lives at the foot of the Apply-to menu,
     which is already the control for WHERE the filters land */
  function copyFiltersToAll(){
    var src=String(activeStem()),n=0;
    (APP.order||[]).forEach(function(s){
      if(String(s)===src) return;
      copyFiltersTo(s,src,false);n++;
    });
    if(!n){docToast('No other notebooks are open');return;}
    applyFilters();applyCodeState();
    docToast('Applied these filters to '+n+' other notebook'
      +(n>1?'s':'')+' — their per-section tweaks were cleared');
  }
  renderTypeButtons();

  /* ---- raw notebook toggle (applies to the ACTIVE tab) ---- */
  var rawBtn=$('#view-raw');
  /* write a button's LABEL without touching its icon: every chrome button
     carries an <svg class="bic"> first child, and textContent= on the
     button would silently delete it */
  function setBtnText(b,txt){
    if(!b) return;
    var s=b.querySelector('.btxt');
    if(!s){
      s=document.createElement('span');s.className='btxt';
      b.appendChild(s);
    }
    s.textContent=txt;
  }
  APP.setBtnText=setBtnText;
  function renderRawBtn(){
    if(!rawBtn) return;
    var sh=APP.active&&APP.shells[APP.active];
    if(sh&&sh.trace){   /* a Plot-trace tab has no raw notebook of its own */
      setBtnText(rawBtn,'Raw');
      rawBtn.setAttribute('aria-pressed','false');
      rawBtn.disabled=true;return;
    }
    var on=!!(sh&&sh.el.classList.contains('raw'));
    rawBtn.setAttribute('aria-pressed',on.toString());
    setBtnText(rawBtn,on?'Formatted':'Raw');
    rawBtn.disabled=!sh;
  }
  if(rawBtn) rawBtn.addEventListener('click',function(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return;
    var on=sh.el.classList.toggle('raw');
    if(on) sh.el.classList.remove('tree');   /* raw + tree are exclusive */
    if(on&&!sh.el.dataset.rawTypeset){
      sh.el.dataset.rawTypeset='1';
      var rv=$('.rawview',sh.el);
      if(rv&&window.MathJax&&MathJax.typesetPromise)
        MathJax.typesetPromise([rv]).catch(function(){});
    }
    renderRawBtn();renderViewBtns();
  });

  /* ---- tree view: the analysis graph as a full, expandable view, plus a
     full-screen "present" mode for either view. Both the Narrative document
     and the Tree map can be presented; the Tree is built client-side from
     this shell's own card index (nb-data) + its rendered card DOM, so it
     works identically in the static file, the app and the web build. ---- */
  var treeBtn=$('#view-tree');
  function renderViewBtns(){
    var sh=APP.active&&APP.shells[APP.active];
    var isTree=!!(sh&&sh.el.classList.contains('tree'));
    if(treeBtn){
      treeBtn.setAttribute('aria-pressed',isTree.toString());
      /* write the LABEL only: the button's icon is a sibling <svg> and
         textContent= would delete it */
      setBtnText(treeBtn,isTree?'Document':'Tree');
      treeBtn.disabled=!sh;
    }
    /* there is no #pb-view: while presenting, this very button moves into
       the present bar with the rest of the View section */
    syncTreeRibbon(isTree);
  }
  /* ---- the tree shows the WHOLE analysis, so the filters do not apply
     there. Grey them out rather than removing them: a control that
     vanishes takes its neighbours' positions with it, and the whole point
     is that a button never moves when you change view (2026-07-30). ---- */
  function syncTreeRibbon(isTree){
    /* the CSS removes the filter sections outright in tree view; the
       disabling below is belt-and-braces for anything that stays reachable
       (a present-bar copy, keyboard focus mid-transition) */
    document.body.classList.toggle('tree-mode',isTree);
    var why='Filters do not apply in the tree — it always shows every '
      +'cell, so you can see the whole analysis. Switch back to Document '
      +'to filter.';
    ['#tv-plots','#tv-markdown','#tv-code','#tv-output','#pt-filter-btn',
     '#ck-filter-btn','#ot-filter-btn','#sec-scope-btn','#sec-reset',
     '#trace-inherit'].forEach(function(sel){
      var b=$(sel); if(!b) return;
      if(isTree){
        if(!b.dataset.t0) b.dataset.t0=b.title||'';
        b.disabled=true;b.title=why;
      } else if(b.dataset.t0!==undefined){
        b.disabled=false;b.title=b.dataset.t0;
      }
    });
    /* the figure sizer has nothing to size in the tree (node clones drop
       --fz), so the same three buttons drive the TREE ZOOM instead — same
       place, same shape, caption says which */
    var cap=$('#fig-size-grp .fgrp-cap');
    if(cap) cap.textContent=isTree?'Tree':'Figures';
    var fv=$('#fig-size-val');
    if(fv) fv.title=isTree
      ?'Tree zoom — click to reset to 100%'
      :'Figure size across the whole feed — click to reset to 100%';
    if(isTree&&APP.treeZoomPct) applyTreeZoomLabel();
  }
  function activeTreeHost(){
    var sh=APP.active&&APP.shells[APP.active];
    return sh?sh.el.querySelector('.treeview'):null;
  }
  function applyTreeZoomLabel(){
    var host=activeTreeHost(); if(!host) return;
    var cv=host.querySelector('.tree-canvas'); if(!cv) return;
    var v=$('#fig-size-val');
    if(v) v.textContent=Math.round(
      (parseFloat(cv.style.zoom||'1')||1)*100)+'%';
  }
  APP.treeZoomPct=applyTreeZoomLabel;
  /* the ribbon's size steppers, routed by view */
  APP.ribbonSizeStep=function(dir){
    var sh=APP.active&&APP.shells[APP.active];
    var isTree=!!(sh&&sh.el.classList.contains('tree'));
    if(!isTree) return false;
    var host=activeTreeHost(); if(!host) return true;
    if(dir===0) treeZoomSet(host,1); else treeZoomBy(host,dir>0?1.2:1/1.2);
    applyTreeZoomLabel();
    return true;   /* handled: do not also zoom the figures */
  };
  function toggleTree(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return;
    var on=sh.el.classList.toggle('tree');
    if(on){ sh.el.classList.remove('raw'); buildTree(sh); }
    renderRawBtn();renderViewBtns();
    if(on) relayoutActiveTree();
  }
  if(treeBtn) treeBtn.addEventListener('click',toggleTree);

  var TREE_FILL={figure:'#39a9c0',diagnostic:'#39a9c0',dataset:'#4d90c0',
    transform:'#5b7589',metric:'#46a892',note:'#cf9a4e',text:'#8ba0b2',
    imports:'#a3855c','function':'#46a892',data:'#4d90c0',constant:'#9a7cc0',
    settings:'#5b7589',plotting:'#39a9c0',print:'#cf9a4e',code:'#8ba0b2'};
  function treeColor(it){
    if(it.kind==='figure'||it.kind==='diagnostic') return TREE_FILL.figure;
    if(it.kind==='note') return TREE_FILL.note;
    var cks=it.codeKinds||[it.codeKind||'code'];
    return TREE_FILL[cks[0]]||TREE_FILL[it.kind]||'#4a5564';
  }
  var TSVGNS='http://www.w3.org/2000/svg';
  /* host-scoped: works for ANY tree (docs shells and the deck's trace
     tree). rAF can be throttled (background tab / headless) and late
     content (MathJax, image decode) shifts nodes — the timer pass
     re-routes edges regardless; treeLayoutEdges is idempotent + cheap. */
  function relayoutTreeHost(host){
    if(!host) return;
    requestAnimationFrame(function(){treeLayoutEdges(host);});
    setTimeout(function(){treeLayoutEdges(host);},120);
  }
  function relayoutActiveTree(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh||!sh.el.classList.contains('tree')) return;
    relayoutTreeHost($('.treeview',sh.el));
  }
  /* tree zoom: CSS zoom on the canvas (layout scales, scrollbars stay
     honest); edges divide their measurements back into layout pixels */
  function treeZoomSet(host,z){
    z=Math.max(0.4,Math.min(2.2,z));
    var canvas=$('.tree-canvas',host); if(!canvas) return;
    canvas.style.zoom=z;
    var zl=$('.tt-zoomval',host);
    if(zl) zl.textContent=Math.round(z*100)+'%';
    relayoutTreeHost(host);
  }
  function treeZoomBy(host,f){
    var canvas=$('.tree-canvas',host); if(!canvas) return;
    treeZoomSet(host,(parseFloat(canvas.style.zoom||'1')||1)*f);
  }
  function buildTree(sh){
    var host=$('.treeview',sh.el); if(!host) return;
    if(host.dataset.built){ relayoutTreeHost(host); return; }
    host.dataset.built='1';
    var items=(sh.data&&sh.data.items)||[];
    /* one node per card that is actually present in this shell's DOM */
    var byAnchor={},nodes=[];
    items.forEach(function(it){
      var card=$('.card[id="card-'+it.card+'"]',sh.el);
      if(!card) return;
      var nd={it:it,card:card,anchor:it.anchor,parents:[],depth:0};
      byAnchor[it.anchor]=nd; nodes.push(nd);
    });
    host.textContent='';
    if(!nodes.length){
      var em=document.createElement('div');em.className='tree-empty';
      em.textContent='No cells to map in this notebook.';
      host.appendChild(em); return;
    }
    var idx={}; nodes.forEach(function(nd,i){idx[nd.anchor]=i;});
    /* ancestors named in each cell's data-flow chain (transitively reduced
       to direct parents) — same shape as the plot-trace dependency graph,
       but over EVERY cell, not one plot's lineage */
    var anc=nodes.map(function(nd){
      var set={};
      (nd.it.chain||[]).forEach(function(a){if(idx[a]!==undefined)set[a]=1;});
      return set;
    });
    nodes.forEach(function(nd,i){
      var a=Object.keys(anc[i]);
      nd.parents=a.filter(function(p){
        return !a.some(function(q){
          return q!==p&&anc[idx[q]]&&anc[idx[q]][p];});
      }).map(function(p){return idx[p];});
    });
    var depth=nodes.map(function(){return -1;});
    function dep(i){
      if(depth[i]>=0) return depth[i];
      depth[i]=0;                        /* cycle guard */
      var m=0; nodes[i].parents.forEach(function(p){m=Math.max(m,dep(p)+1);});
      depth[i]=m; return m;
    }
    nodes.forEach(function(nd,i){nd.depth=dep(i);});
    var maxD=0; nodes.forEach(function(nd){if(nd.depth>maxD)maxD=nd.depth;});
    var lanes=[]; for(var L=0;L<=maxD;L++) lanes.push([]);
    nodes.forEach(function(nd,i){nd.ti=i; lanes[nd.depth].push(nd);});
    /* barycenter pass: order each lane by the mean lane-position of its
       parents, so children sit under their parents and edges cross less */
    var lanePos={};
    lanes.forEach(function(lane,li){
      if(li>0){
        lane.forEach(function(nd,i){nd._o=i;});
        lane.sort(function(a,b){
          function bc(nd){
            var ps=nd.parents.map(function(p){return lanePos[p];})
              .filter(function(v){return v!=null;});
            return ps.length
              ?ps.reduce(function(s,v){return s+v;},0)/ps.length
              :nd._o;
          }
          return (bc(a)-bc(b))||(a._o-b._o);
        });
      }
      lane.forEach(function(nd,i){lanePos[nd.ti]=i;});
    });

    /* ---- toolbar ---- */
    var bar=document.createElement('div');bar.className='tree-toolbar';
    var ttl=document.createElement('span');ttl.className='tt-title';
    ttl.textContent='analysis tree';bar.appendChild(ttl);
    function toolBtn(label,fn){
      var b=document.createElement('button');b.className='tt-btn';
      b.type='button';b.textContent=label;b.addEventListener('click',fn);
      bar.appendChild(b);return b;
    }
    toolBtn('Expand all',function(){
      /* batch across frames — cloning every card at once can jank a big
         notebook; yield between chunks, relayout once at the end */
      var els=$$('.tree-node',host).filter(function(el){
        return !el.classList.contains('tn-off')
          &&!el.classList.contains('expanded');});
      var i=0,BATCH=6;
      (function step(){
        for(var end=Math.min(i+BATCH,els.length);i<end;i++){
          els[i].classList.add('expanded');fillNode(els[i]);}
        if(i<els.length) requestAnimationFrame(step);
        else relayoutTreeHost(host);
      })();
    });
    toolBtn('Collapse all',function(){
      $$('.tree-node.expanded',host).forEach(function(el){
        el.classList.remove('expanded');});
      relayoutTreeHost(host);
    });
    /* zoom lives on the RIBBON in tree view (the Size section's stepper
       drives it), so it is not repeated down here — one control, one
       place, and it does not move when you change view */
    var WNAMES={'tw-s':'S','tw-m':'M','tw-l':'L'};
    var wBtn=toolBtn('Width: M',function(){
      var canvas=$('.tree-canvas',host); if(!canvas) return;
      var order=['tw-m','tw-l','tw-s'];
      var cur=order.filter(function(c){
        return canvas.classList.contains(c);})[0]||'tw-m';
      var nx=order[(order.indexOf(cur)+1)%order.length];
      order.forEach(function(c){canvas.classList.remove(c);});
      canvas.classList.add(nx);
      wBtn.textContent='Width: '+WNAMES[nx];
      relayoutTreeHost(host);
    });
    wBtn.title='Cell width — cycle Small / Medium / Large '
      +'(drag a cell’s corner to size it individually)';
    /* only shown when some cells are eye-hidden — the one-click way back
       (each hidden chip's own eye restores it individually) */
    var unhideBtn=toolBtn('Unhide all',function(){
      $$('.tree-node.tn-off',host).forEach(function(el){
        el.classList.remove('tn-off');});
      updateHiddenNote();relayoutTreeHost(host);
    });
    unhideBtn.style.display='none';
    toolBtn('☲ Present',function(){enterDocPresent();})
      .classList.add('tt-present');
    var hnote=document.createElement('span');hnote.className='tt-hidden-note';
    bar.appendChild(hnote);
    host.appendChild(bar);

    /* ---- scroll + canvas + edge layer ---- */
    var scroll=document.createElement('div');scroll.className='tree-scroll';
    var canvas=document.createElement('div');
    canvas.className='tree-canvas tw-m';   /* medium cell width by default */
    var svg=document.createElementNS(TSVGNS,'svg');
    svg.setAttribute('class','tree-edges');
    canvas.appendChild(svg);

    function fillNode(el){
      var body=$('.tree-node-body',el); if(!body||body.dataset.filled) return;
      body.dataset.filled='1';
      var nd=nodes[+el.dataset.ti]; if(!nd) return;
      var clone=nd.card.cloneNode(true);
      clone.removeAttribute('id');clone.classList.add('in');
      /* the tree is the WHOLE analysis: a node shows its cell in full,
         whatever the document's filters are currently hiding */
      clone.classList.remove('is-hidden','cell-off','collapsed','zoomed');
      clone.style.removeProperty('--fz');
      $$('.code-off',clone).forEach(function(x){
        x.classList.remove('code-off');});
      $$('.part-off,.part-fold,.pt-off,.ot-off',clone).forEach(function(x){
        x.classList.remove('part-off','part-fold','pt-off','ot-off');});
      $$('[id]',clone).forEach(function(x){x.removeAttribute('id');});
      $$('.cell-eye,.plot-trace-btn,.card-anchor,.card-addnote',clone)
        .forEach(function(x){x.remove();});
      body.appendChild(clone);
      /* cloneNode does not copy listeners: re-wire the clone so its code
         toggle / fig-fold / note-expand work (as the Plot-trace tab does) */
      var stem=(sh.data&&sh.data.stem)||sh.el.dataset.nb||'';
      wireCardBehaviors(clone,stem);
      activateOutputs(clone,true);   /* draw plotly specs in the tree node */
      $$('.mdmore',clone).forEach(function(x){x.remove();});
      $$('.cardbody[data-mdclamp]',clone).forEach(function(bd){
        bd.removeAttribute('data-mdclamp');
        bd.classList.remove('mdclamp');bd.classList.remove('mdopen');});
      mdClampScan(clone);
      if(window.MathJax&&MathJax.typesetPromise)
        MathJax.typesetPromise([body]).catch(function(){});
    }
    function updateHiddenNote(){
      var n=$$('.tree-node.tn-off',host).length;
      hnote.classList.toggle('show',n>0);
      hnote.textContent=n?('◉ '+n+' hidden'):'';
      unhideBtn.style.display=n?'':'none';
    }

    /* edges must follow EVERY size change — expanding, MathJax finishing,
       images decoding, corner-resizes, width presets. Watching the nodes
       is the one mechanism that catches all of them. */
    var ro=window.ResizeObserver
      ?new ResizeObserver(function(){relayoutTreeHost(host);}):null;
    host._ro=ro;
    lanes.forEach(function(lane){
      var laneEl=document.createElement('div');laneEl.className='tree-lane';
      lane.forEach(function(nd){
        var el=document.createElement('div');el.className='tree-node';
        if(ro) ro.observe(el);
        el.dataset.ti=nd.ti;
        el.dataset.parents=nd.parents.join(',');
        el.style.setProperty('--nc',treeColor(nd.it));
        var head=document.createElement('div');head.className='tree-node-head';
        var dot=document.createElement('span');dot.className='tn-dot';
        head.appendChild(dot);
        var tw=document.createElement('div');tw.style.flex='1';tw.style.minWidth='0';
        var tt=document.createElement('div');tt.className='tn-title';
        tt.textContent=nd.it.title||nd.anchor;tw.appendChild(tt);
        var kd=document.createElement('div');kd.className='tn-kind';
        kd.textContent=nd.it.kind||'cell';tw.appendChild(kd);
        head.appendChild(tw);
        var eye=document.createElement('button');eye.className='tn-btn tn-eye';
        eye.type='button';eye.innerHTML='&#128065;';eye.title='Hide this cell';
        head.appendChild(eye);
        var chev=document.createElement('button');chev.className='tn-btn tn-chev';
        chev.type='button';chev.innerHTML='&#8250;';
        chev.title='Expand to see the cell';
        head.appendChild(chev);
        var body=document.createElement('div');body.className='tree-node-body';
        el.appendChild(head);el.appendChild(body);
        /* per-cell resize: drag the corner — width, and height of the
           opened body (zoom-corrected deltas) */
        var rs=document.createElement('span');rs.className='tn-resize';
        rs.title='Drag to resize this cell';
        rs.addEventListener('mousedown',function(e){
          e.preventDefault();e.stopPropagation();
          if(!el.classList.contains('expanded')){
            el.classList.add('expanded');fillNode(el);}
          var cv=$('.tree-canvas',host);
          var z=cv?(parseFloat(cv.style.zoom||'1')||1):1;
          var sw=el.getBoundingClientRect().width/z;
          var sh0=body.getBoundingClientRect().height/z;
          var sx=e.clientX,sy=e.clientY;
          function mm(ev){
            el.style.width=Math.max(200,
              Math.min(900,sw+(ev.clientX-sx)/z))+'px';
            body.style.maxHeight=Math.max(120,
              Math.min(1400,sh0+(ev.clientY-sy)/z))+'px';
          }
          function mu(){
            document.removeEventListener('mousemove',mm);
            document.removeEventListener('mouseup',mu);
            relayoutTreeHost(host);
          }
          document.addEventListener('mousemove',mm);
          document.addEventListener('mouseup',mu);
        });
        el.appendChild(rs);
        head.addEventListener('click',function(e){
          if(e.target.closest('.tn-eye')) return;
          if(el.classList.contains('tn-off')) return;
          var open=el.classList.toggle('expanded');
          if(open) fillNode(el);
          relayoutTreeHost(host);
        });
        eye.addEventListener('click',function(e){
          e.stopPropagation();
          var off=el.classList.toggle('tn-off');
          if(off){el.classList.remove('expanded');
            eye.title='Show this cell';}
          else eye.title='Hide this cell';
          updateHiddenNote();relayoutTreeHost(host);
        });
        el.addEventListener('mouseenter',function(){litEdges(host,nd.ti,true);});
        el.addEventListener('mouseleave',function(){litEdges(host,nd.ti,false);});
        laneEl.appendChild(el);
      });
      canvas.appendChild(laneEl);
    });
    scroll.appendChild(canvas);host.appendChild(scroll);
    if(ro) ro.observe(canvas);   /* window resizes shift lanes too */
    relayoutTreeHost(host);
  }
  function litEdges(host,ti,on){
    var el=$('.tree-node[data-ti="'+ti+'"]',host);
    if(el) el.classList.toggle('active',on);
    $$('.tree-edge',host).forEach(function(p){
      if(p.dataset.from===String(ti)||p.dataset.to===String(ti))
        p.classList.toggle('lit',on);
    });
  }
  function treeLayoutEdges(host){
    var svg=$('.tree-edges',host),canvas=$('.tree-canvas',host);
    if(!svg||!canvas) return;
    var cb=canvas.getBoundingClientRect();
    if(!cb.width) return;                 /* not visible yet */
    var W=canvas.scrollWidth,H=canvas.scrollHeight;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('width',W);svg.setAttribute('height',H);
    svg.style.width=W+'px';svg.style.height=H+'px';   /* px, not 100%, so the
      viewBox maps 1:1 even when lanes overflow and the canvas scrolls */
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    /* measurements come back in VISUAL px — divide by the canvas zoom to
       get layout px, the space the SVG viewBox lives in */
    var z=parseFloat(canvas.style.zoom||'1')||1;
    var heads={};
    $$('.tree-node',host).forEach(function(el){
      var h=$('.tree-node-head',el); if(!h) return;
      var r=h.getBoundingClientRect();
      heads[el.dataset.ti]={
        cx:(r.left-cb.left+r.width/2)/z+canvas.scrollLeft,
        top:(r.top-cb.top)/z+canvas.scrollTop,
        bot:(r.bottom-cb.top)/z+canvas.scrollTop,
        off:el.classList.contains('tn-off')};
    });
    $$('.tree-node',host).forEach(function(el){
      var ci=heads[el.dataset.ti]; if(!ci) return;
      (el.dataset.parents||'').split(',').filter(Boolean).forEach(function(pi){
        var pr=heads[pi]; if(!pr) return;
        var x1=pr.cx,y1=pr.bot,x2=ci.cx,y2=ci.top,mid=(y1+y2)/2;
        var path=document.createElementNS(TSVGNS,'path');
        path.setAttribute('class','tree-edge'+((ci.off||pr.off)?' dim':''));
        path.setAttribute('d','M'+x1+' '+y1+' C'+x1+' '+mid+' '
          +x2+' '+mid+' '+x2+' '+y2);
        path.dataset.from=pi;path.dataset.to=el.dataset.ti;
        svg.appendChild(path);
      });
    });
  }

  /* ---- present (full-screen) mode for the active document ---- */
  var docsEl=$('#docs');
  /* The present bar carries the REAL filter controls: they are moved out of
     the appbar on enter and put back (in place) on exit, so every existing
     handler, menu and state read keeps working — no duplicate widgets. */
  var pbMoved=[];
  /* move the whole LABELLED SECTIONS, not the bare groups inside them.
     Moving the inner groups left their .abgrp wrappers behind, so the
     present bar lost the ribbon's grid: the two size steppers stopped
     being stacked, Raw/Tree came apart from Present, and the section
     names (FILTERS / SIZE / VIEW) vanished. Now the bar IS the ribbon. */
  var PB_TOOLS=['#ab-filters','#ab-scope','#ab-size','#ab-view'];
  var PB_MENUS=['#ck-filter-menu','#pt-filter-menu','#ot-filter-menu',
                '#sec-scope-menu'];
  function pbTakeTools(){
    var host=$('#pb-tools'); if(!host) return;
    pbMoved=[];
    PB_TOOLS.forEach(function(sel){
      var el=$(sel); if(!el) return;
      pbMoved.push({el:el,parent:el.parentNode,next:el.nextSibling});
      host.appendChild(el);
    });
    /* the dropdowns are position:fixed at body level — inside a fullscreen
       #docs they would paint UNDER the top layer, so they ride along */
    PB_MENUS.forEach(function(sel){
      var m=$(sel); if(!m||!docsEl) return;
      pbMoved.push({el:m,parent:m.parentNode,next:m.nextSibling});
      m.hidden=true;docsEl.appendChild(m);
    });
  }
  function pbReturnTools(){
    /* restore in reverse so each insertBefore anchor is still valid */
    pbMoved.slice().reverse().forEach(function(m){
      if(!m.parent) return;
      if(m.el.classList.contains('ckfilter-menu')) m.el.hidden=true;
      if(m.next&&m.next.parentNode===m.parent)
        m.parent.insertBefore(m.el,m.next);
      else m.parent.appendChild(m.el);
    });
    pbMoved=[];
  }
  function enterDocPresent(){
    var sh=APP.active&&APP.shells[APP.active]; if(!sh) return;
    document.body.classList.add('doc-presenting');
    document.body.classList.remove('pb-folded');
    pbTakeTools();
    /* the controls must live INSIDE #docs: when #docs goes fullscreen it is
       promoted to the browser top layer, and a sibling bar would render
       beneath it (dead). As descendants they join the top layer. */
    var pb=$('#present-bar'); if(pb){pb.hidden=false;
      if(docsEl) docsEl.appendChild(pb);}
    var pbs=$('#present-bar-show'); if(pbs){pbs.hidden=false;
      if(docsEl) docsEl.appendChild(pbs);}
    renderViewBtns();
    if(APP.applyPbDock) APP.applyPbDock();   /* size the inset */
    relayoutActiveTree();
    try{
      if(docsEl&&docsEl.requestFullscreen&&!document.fullscreenElement)
        docsEl.requestFullscreen().catch(function(){});
    }catch(e){}
  }
  function exitDocPresent(){
    if(!document.body.classList.contains('doc-presenting')) return;
    document.body.classList.remove('doc-presenting');
    document.body.classList.remove('pb-folded');
    document.body.classList.remove('present-rail');
    pbReturnTools();
    renderViewBtns();   /* the Tree button must work again immediately */
    var pb=$('#present-bar'); if(pb){pb.hidden=true;
      document.body.appendChild(pb);}
    var pbs=$('#present-bar-show'); if(pbs){pbs.hidden=true;
      document.body.appendChild(pbs);}
    try{if(document.fullscreenElement) document.exitFullscreen().catch(function(){});}
    catch(e){}
    relayoutActiveTree();
  }
  var dpBtn=$('#doc-present');
  if(dpBtn) dpBtn.addEventListener('click',enterDocPresent);
  (function(){
    var x=$('#pb-exit'); if(x) x.addEventListener('click',exitDocPresent);
    /* deliberately NO #pb-view: while presenting, the ribbon's whole View
       section (Raw / Tree / Present) MOVES into this bar, so there is
       never a second Tree button with a second name */
    var rl=$('#pb-rail');
    if(rl){
      rl.setAttribute('aria-pressed','false');
      rl.addEventListener('click',function(){
        var on=document.body.classList.toggle('present-rail');
        rl.setAttribute('aria-pressed',on.toString());
        rl.title=on?'Hide the section sidebar':'Show the section sidebar';
        relayoutActiveTree();
      });
    }
    /* the two dock icons, swapped in place so the glyph always shows the
       edge the button would move the bar TO */
    var PB_ICO={
      right:'<rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.2"/>'
        +'<path d="M9.8 2.4v11.2"/><path d="M11.5 5h1.2M11.5 7.4h1.2"/>',
      top:'<rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.2"/>'
        +'<path d="M1.8 6.2h12.4"/><path d="M4.4 4.3h5.4"/>'};
    /* dock across the top (where it IS the app bar) or down the right
       (where the groups become rows) — remembered between talks */
    var PKEY='junoview:presentbar:dock';
    var pbDock='top';
    try{pbDock=(localStorage.getItem(PKEY)==='right')?'right':'top';}
    catch(e){}
    /* the document is inset by the bar's real size, so the bar never
       covers content — measured, because the bar wraps to fit */
    function measurePb(){
      var bar=$('#present-bar');
      if(!bar||bar.hidden) return;
      var r=bar.getBoundingClientRect();
      if(pbDock==='top')
        document.body.style.setProperty('--pbh',Math.ceil(r.height)+'px');
      else
        document.body.style.setProperty('--pbw',Math.ceil(r.width)+'px');
    }
    function applyPbDock(){
      document.body.classList.toggle('pbpos-top',pbDock==='top');
      document.body.classList.toggle('pbpos-right',pbDock==='right');
      var mv=$('#pb-move');
      if(mv){
        /* name the DESTINATION, never the current position: "Dock right"
           while docked right reads as a state, and the user cannot tell
           whether it is telling them where the bar is or offering to move
           it. "Move right" / "Move to top" can only be an action. */
        /* icon-only: the glyph IS the destination edge, and the title
           still says it in words. The present bar is the tightest bar we
           have — these words cost it the Exit button's place on line 1. */
        var mi=mv.querySelector('.bic');
        if(mi) mi.innerHTML=(pbDock==='top')?PB_ICO.right:PB_ICO.top;
        mv.title=(pbDock==='top')
          ?'Move these controls down the right-hand side'
          :'Move these controls back across the top';
      }
      if(APP.syncPbToggle) APP.syncPbToggle();
      try{localStorage.setItem(PKEY,pbDock);}catch(e){}
      measurePb();relayoutActiveTree();
      setTimeout(measurePb,60);   /* after the wrap settles */
    }
    var mv=$('#pb-move');
    if(mv) mv.addEventListener('click',function(){
      pbDock=(pbDock==='top')?'right':'top';applyPbDock();});
    APP.applyPbDock=applyPbDock;
    APP.measurePb=measurePb;
    window.addEventListener('resize',function(){
      if(document.body.classList.contains('doc-presenting')) measurePb();});
    applyPbDock();
    /* one button, one place: it folds the bar away and brings it back */
    var s=$('#present-bar-show');
    /* Is the bar actually on screen right now? Auto-hide and an explicit
       fold are two different mechanisms and BOTH move it, so the handle
       has to ask about the result, not about one flag. */
    function pbHidden(){
      return document.body.classList.contains('pb-folded')
        ||(pbAuto&&!document.body.classList.contains('pb-peek'));
    }
    function syncToggleBtn(){
      if(!s) return;
      var hidden=pbHidden();
      /* never a hamburger: ☰ is the OUTLINE button's glyph, and two
         controls wearing the same symbol is what made this one look
         broken. A chevron points the way the bar will travel. */
      s.innerHTML=hidden
        ?(pbDock==='top'?'&#9660;':'&#9664;')
        :(pbDock==='top'?'&#9650;':'&#9654;');
      s.title=hidden?'Show the presenting controls'
        :'Hide the presenting controls';
      s.setAttribute('aria-expanded',(!hidden).toString());
    }
    if(s) s.addEventListener('click',function(){
      /* it used to just toggle pb-folded — which auto-hide (the default)
         overrode with !important, so the button did nothing at all */
      if(pbHidden()){
        document.body.classList.remove('pb-folded');
        if(pbAuto) document.body.classList.add('pb-peek');
      } else {
        document.body.classList.add('pb-folded');
        document.body.classList.remove('pb-peek');
      }
      syncToggleBtn();measurePb();relayoutActiveTree();});
    APP.syncPbToggle=syncToggleBtn;
    /* ---- auto-hide is the DEFAULT while presenting (the slide is the
       point, not the chrome); "Pin" keeps the bar in place, the way a
       taskbar or a docked panel does ---- */
    var AKEY='junoview:presentbar:pinned';
    var pbPinned=false;
    try{pbPinned=localStorage.getItem(AKEY)==='1';}catch(e){}
    var pbAuto=!pbPinned;
    function applyAuto(){
      pbAuto=!pbPinned;
      document.body.classList.toggle('pb-auto',pbAuto);
      var ab=$('#pb-auto');
      if(ab){
        /* the button is called "Auto-hide", so PRESSED must mean auto-hide
           is on — it used to mean "pinned", the exact opposite */
        ab.setAttribute('aria-pressed',pbAuto?'true':'false');
        ab.title=pbAuto
          ?'Auto-hide is on: the bar slides away and comes back when you '
            +'move to its edge. Click to keep it in place.'
          :'The bar stays in place. Click to let it hide itself again.';
      }
      if(!pbAuto) document.body.classList.remove('pb-peek');
      try{localStorage.setItem(AKEY,pbPinned?'1':'0');}catch(e){}
      measurePb();relayoutActiveTree();
    }
    var ab=$('#pb-auto');
    if(ab) ab.addEventListener('click',function(){
      pbPinned=!pbPinned;
      if(!pbPinned) document.body.classList.remove('pb-folded');
      applyAuto();syncToggleBtn();
    });
    document.addEventListener('mousemove',function(e){
      if(!pbAuto||!document.body.classList.contains('doc-presenting'))
        return;
      var bar=$('#present-bar');
      var peeking=document.body.classList.contains('pb-peek');
      var near=(pbDock==='top')?(e.clientY<=4)
        :(e.clientX>=window.innerWidth-4);
      if(near){
        if(!peeking) document.body.classList.add('pb-peek');
        return;
      }
      if(!peeking||!bar) return;
      /* leave a margin so the bar does not vanish the instant you aim
         at a button near its edge */
      var r=bar.getBoundingClientRect();
      var out=e.clientX<r.left-40||e.clientX>r.right+40
        ||e.clientY<r.top-40||e.clientY>r.bottom+40;
      if(out) document.body.classList.remove('pb-peek');
    });
    applyAuto();syncToggleBtn();
  })();
  document.addEventListener('fullscreenchange',function(){
    if(!document.fullscreenElement
       &&document.body.classList.contains('doc-presenting'))
      exitDocPresent();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&document.body.classList.contains('doc-presenting')){
      exitDocPresent();
    }
  });
  var treeRelayoutTimer=null;
  window.addEventListener('resize',function(){
    if(treeRelayoutTimer) clearTimeout(treeRelayoutTimer);
    treeRelayoutTimer=setTimeout(relayoutActiveTree,120);
  });
  window.SemView={tree:toggleTree,present:enterDocPresent,
    exitPresent:exitDocPresent,buildTree:buildTree};

  /* ---- theme toggle (chrome only; the slide canvas stays dark) --- */
  var themeBtn=$('#theme-btn');
  function applyTheme(light){
    document.body.classList.toggle('light',light);
    if(themeBtn){
      themeBtn.innerHTML=light?'&#9789;':'&#9788;';
      themeBtn.setAttribute('data-tip',light
        ?'Switch to the dark theme':'Switch to the light theme');
      themeBtn.removeAttribute('title');
    }
    try{localStorage.setItem('plotline-theme',
      light?'light':'dark');}catch(e){}
  }
  var themePref=null;
  try{themePref=localStorage.getItem('plotline-theme');}catch(e){}
  applyTheme(themePref==='light');
  if(themeBtn) themeBtn.addEventListener('click',function(){
    applyTheme(!document.body.classList.contains('light'));
  });

  /* ---- builder panel width: draggable right edge, persisted ------- */
  var dcR=$('#dc-resize');
  var dcwPref=null;
  try{dcwPref=parseInt(localStorage.getItem('plotline-dcw'),10);}
  catch(e){}
  if(dcwPref&&dcwPref>=300&&dcwPref<=760)
    document.documentElement.style.setProperty('--dc-w',dcwPref+'px');
  if(dcR) dcR.addEventListener('mousedown',function(e){
    e.preventDefault();
    dcR.classList.add('on');
    var host=$('#deck-create');
    var left=host?host.getBoundingClientRect().left:0;
    var w=0;
    function mv(ev){
      w=Math.max(300,Math.min(760,ev.clientX-left));
      document.documentElement.style.setProperty('--dc-w',w+'px');
    }
    function up(){
      dcR.classList.remove('on');
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      if(w) try{localStorage.setItem('plotline-dcw',w);}catch(e){}
    }
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
  });

  /* ---- instant tooltips: every [title] becomes a styled tip ------- */
  var tipEl=document.createElement('div');
  tipEl.className='apptip';
  document.body.appendChild(tipEl);
  var tipTimer=null,tipTarget=null;
  function hideTip(){
    clearTimeout(tipTimer);tipTimer=null;
    tipTarget=null;tipEl.style.display='none';
  }
  document.addEventListener('mouseover',function(e){
    var t=e.target.closest&&e.target.closest('[title],[data-tip]');
    if(!t){hideTip();return;}
    if(t===tipTarget) return;
    if(t.hasAttribute&&t.hasAttribute('title')){
      var tt=t.getAttribute('title');
      if(tt) t.setAttribute('data-tip',tt);
      t.removeAttribute('title');
    }
    var tip=t.getAttribute&&t.getAttribute('data-tip');
    if(!tip){hideTip();return;}
    tipTarget=t;
    clearTimeout(tipTimer);
    tipTimer=setTimeout(function(){
      if(tipTarget!==t||!document.contains(t)){return;}
      tipEl.textContent=tip;
      tipEl.style.display='block';
      var r=t.getBoundingClientRect();
      var tw=tipEl.offsetWidth,th=tipEl.offsetHeight;
      var x=r.left+r.width/2-tw/2;
      x=Math.max(6,Math.min(window.innerWidth-tw-6,x));
      var y=r.bottom+8;
      if(y+th>window.innerHeight-6) y=r.top-th-8;
      tipEl.style.left=x+'px';
      tipEl.style.top=Math.max(6,y)+'px';
    },220);
  });
  document.addEventListener('mouseout',function(e){
    if(tipTarget&&!tipTarget.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('mousedown',hideTip,true);
  document.addEventListener('scroll',hideTip,true);

  /* ---- guided tour: a spotlight + tooltip that steps through the UI;
     skippable, shown once, or re-run from "Take a tour" ---- */
  var TOUR_STEPS=[
    {title:'Welcome to Junoview',
     text:'A figure-first view of your notebooks, plus a presentation '
       +'builder. Here is a quick tour — skip it anytime.'},
    {sel:'#tabstrip',title:'Notebooks are tabs',
     text:'Every notebook you open is a tab. Drop .ipynb files anywhere on '
       +'the window, or use + Open.'},
    {sel:'#tv-code',title:'Filter what you see',
     text:'Plots, Markdown, Code and Output each cycle Visible → '
       +'Collapsed → Hidden. Code folds the source in EVERY cell at once.'},
    {sel:'#ot-filter-btn',title:'Fine-tune by type',
     text:'The Code types and Output types menus hide specific kinds — '
       +'imports, plotting, print, dataset, error…'},
    {sel:'.rail .nav',title:'The sidebar',
     text:'A key at the top; collapse or hide a whole section (also from its '
       +'heading in the document), and an eye beside every cell to hide just '
       +'that one — hidden things stay here so you can bring them back.'},
    {sel:'.plot-trace-btn',title:'Trace a plot',
     text:'Plot trace opens a new tab with just the cells that build a '
       +'plot — its whole lineage — plus a dependency graph. Every filter '
       +'still works there.'},
    {sel:'#pr-docs,.presrail,#presrail',title:'Build presentations',
     text:'The left rail holds presentations. Lay out slides, drop in cards '
       +'from any open notebook, and present full screen.'},
    {sel:'#help-btn',title:'Help & support',
     text:'Full docs live here. If Junoview helps you, Support funds a '
       +'hosted version with accounts — thank you!'}
  ];
  var tourI=0;
  function tourRect(step){
    if(!step.sel) return null;
    var el=$(step.sel);
    if(!el||el.hidden||el.offsetParent===null) return null;
    var r=el.getBoundingClientRect();
    if(r.width===0&&r.height===0) return null;
    return r;
  }
  function tourShow(i){
    var steps=TOUR_STEPS,dir=(i>=tourI)?1:-1;
    while(i>=0&&i<steps.length){
      if(!steps[i].sel||tourRect(steps[i])) break;
      i+=dir;
    }
    if(i>=steps.length){tourEnd();return;}
    if(i<0) i=0;
    tourI=i;
    var step=steps[i],tour=$('#tour'),hole=$('#tour-hole'),tip=$('#tour-tip');
    if(!tour) return;
    tour.hidden=false;
    $('#tour-step').textContent=(i+1)+' / '+steps.length;
    $('#tour-title').textContent=step.title;
    $('#tour-text').textContent=step.text;
    var back=$('#tour-back'),next=$('#tour-next');
    if(back) back.style.visibility=i>0?'visible':'hidden';
    if(next) next.textContent=(i===steps.length-1)?'Done':'Next';
    var r=tourRect(step);
    var tw=Math.min(400,window.innerWidth*0.90),th=tip.offsetHeight||170;
    if(r){
      var pad=6;
      hole.classList.remove('center');
      hole.style.left=(r.left-pad)+'px';hole.style.top=(r.top-pad)+'px';
      hole.style.width=(r.width+pad*2)+'px';
      hole.style.height=(r.height+pad*2)+'px';
      var top=(r.bottom+th+16<window.innerHeight)?r.bottom+12
        :(r.top-th-16>0)?r.top-th-12:Math.max(12,(window.innerHeight-th)/2);
      var left=Math.min(Math.max(12,r.left),window.innerWidth-tw-12);
      tip.style.left=left+'px';tip.style.top=top+'px';tip.style.transform='none';
    } else {
      hole.classList.add('center');
      hole.style.left='50%';hole.style.top='50%';
      hole.style.width='0px';hole.style.height='0px';
      tip.style.left='50%';tip.style.top='50%';
      tip.style.transform='translate(-50%,-50%)';
    }
  }
  function tourStart(){
    var hd=$('#helpdlg'); if(hd) hd.hidden=true;
    var wl=$('#welcome'); /* keep welcome as the backdrop is fine */
    tourI=0;tourShow(0);
  }
  function tourEnd(){
    var t=$('#tour'); if(t) t.hidden=true;
    try{localStorage.setItem('plotline-tour','1');}catch(e){}
  }
  (function(){
    var nx=$('#tour-next'),bk=$('#tour-back'),sk=$('#tour-skip');
    if(nx) nx.addEventListener('click',function(){
      if(tourI>=TOUR_STEPS.length-1) tourEnd(); else tourShow(tourI+1);});
    if(bk) bk.addEventListener('click',function(){tourShow(tourI-1);});
    if(sk) sk.addEventListener('click',tourEnd);
    document.addEventListener('keydown',function(e){
      var t=$('#tour'); if(!t||t.hidden) return;
      if(e.key==='Escape'){e.preventDefault();tourEnd();}
      else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();
        if(tourI>=TOUR_STEPS.length-1) tourEnd(); else tourShow(tourI+1);}
      else if(e.key==='ArrowLeft'){e.preventDefault();tourShow(tourI-1);}
    });
    window.addEventListener('resize',function(){
      var t=$('#tour'); if(t&&!t.hidden) tourShow(tourI);});
    var wt=$('#welcome-tour');
    if(wt) wt.addEventListener('click',function(e){e.preventDefault();tourStart();});
    var ht=$('#help-tour');
    if(ht) ht.addEventListener('click',function(e){e.preventDefault();tourStart();});
  })();
  function maybeAutoTour(){
    try{if(localStorage.getItem('plotline-tour')) return;}catch(e){}
    if(!APP.order.length) return;       /* wait until there is content to tour */
    try{localStorage.setItem('plotline-tour','1');}catch(e){}
    setTimeout(function(){if($('#tour')) tourStart();},700);
  }
  APP.startTour=tourStart;
  document.addEventListener('sem:activate',maybeAutoTour);

  /* ---- figure pager: ‹ › flips between figures of one cell -------- */
  /* delegated so it works in cloned slide frames too */
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.fp-btn');
    if(!b) return;
    var pg=b.closest('.figpager'); if(!pg) return;
    e.preventDefault();e.stopPropagation();
    var pages=[].slice.call(pg.querySelectorAll(':scope > .figpage'));
    /* pages whose plot type is filtered out are skipped by the pager */
    var vis=pages.filter(function(p){
      return !p.classList.contains('pt-off');});
    if(!vis.length) return;
    var curEl=pg.querySelector(':scope > .figpage.current');
    var ci=curEl?vis.indexOf(curEl):0; if(ci<0) ci=0;
    var nx=(ci+(b.classList.contains('fp-next')?1:-1)
      +vis.length)%vis.length;
    if(curEl) curEl.classList.remove('current');
    vis[nx].classList.add('current');
    var ct=pg.querySelector('.fp-count');
    if(ct) ct.textContent=(nx+1)+' / '+vis.length;
    /* a live embed (plotly/bokeh/…) drawn while its page was display:none
       has no size — draw it now it is visible, and resize what's drawn */
    var page=vis[nx];
    if(window.SemActivate) window.SemActivate(page,true);
    if(window.Plotly&&window.Plotly.Plots)
      [].forEach.call(page.querySelectorAll('.js-plotly-plot'),
        function(g){try{window.Plotly.Plots.resize(g);}catch(err){}});
    try{window.dispatchEvent(new Event('resize'));}catch(err){}
  },true);

  /* ---- raw-HTML notes: toggle rendered <-> source ----------------- */
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.htmltoggle');
    if(!b) return;
    e.preventDefault();e.stopPropagation();
    var card=b.closest('.card');
    if(card) card.classList.toggle('showhtml');
  },true);

  /* ---- presentations rail: full -> icons -> hidden (edge handle
     brings it back) ---- */
  /* ---- rail auto-hide: opt-in, remembered, and it never fights the
     collapse states (turning it on leaves them alone) ---- */
  (function(){
    var AK='junoview:presrail:auto';
    var btn=$('#pr-auto'),on=false;
    try{on=localStorage.getItem(AK)==='1';}catch(e){}
    function apply(){
      document.body.classList.toggle('prrail-auto',on);
      if(!on) document.body.classList.remove('prrail-peek');
      if(btn) btn.setAttribute('aria-pressed',on?'true':'false');
      try{localStorage.setItem(AK,on?'1':'0');}catch(e){}
      if(APP.measureChrome) APP.measureChrome();
    }
    if(btn) btn.addEventListener('click',function(e){
      e.stopPropagation();on=!on;apply();});
    document.addEventListener('mousemove',function(e){
      if(!on) return;
      var peek=document.body.classList.contains('prrail-peek');
      if(!peek&&e.clientX<=4) document.body.classList.add('prrail-peek');
      else if(peek&&e.clientX>Math.max(200,
        (($('#presrail')||{}).getBoundingClientRect
          ?$('#presrail').getBoundingClientRect().right:200)+40))
        document.body.classList.remove('prrail-peek');
    });
    apply();
  })();
  var prCollapse=$('#pr-collapse'), prShow=$('#presrail-show');
  function railState(){
    return document.body.classList.contains('presrail-hidden')?'hidden'
      :document.body.classList.contains('presrail-min')?'min':'full';
  }
  function setRailState(st){
    document.body.classList.toggle('presrail-min',st==='min');
    document.body.classList.toggle('presrail-hidden',st==='hidden');
    if(prCollapse)
      prCollapse.title=st==='full'
        ?'Collapse to icons (click again to hide)':'Hide this panel';
    try{localStorage.setItem('sempresrail2',st);}catch(e){}
  }
  var railPref=null;
  try{railPref=localStorage.getItem('sempresrail2');}catch(e){}
  setRailState(railPref==='min'||railPref==='hidden'||railPref==='full'
    ?railPref:(window.innerWidth<1100?'min':'full'));
  if(prCollapse) prCollapse.addEventListener('click',function(){
    setRailState(railState()==='full'?'min':'hidden');
  });
  if(prShow) prShow.addEventListener('click',function(){
    setRailState('full');
  });

  /* ---- help overlay ---- */
  var helpDlg=$('#helpdlg');
  function showHelp(){if(helpDlg) helpDlg.hidden=false;}
  function hideHelp(){if(helpDlg) helpDlg.hidden=true;}
  var helpBtn=$('#help-btn');
  if(helpBtn) helpBtn.addEventListener('click',showHelp);
  var wHelp=$('#welcome-help');
  if(wHelp) wHelp.addEventListener('click',function(e){
    e.preventDefault();showHelp();});
  var helpClose=$('#help-close');
  if(helpClose) helpClose.addEventListener('click',hideHelp);
  if(helpDlg) helpDlg.addEventListener('click',function(e){
    if(e.target===helpDlg) hideHelp();});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&helpDlg&&!helpDlg.hidden){
      e.stopPropagation();hideHelp();
    }
  },true);

  /* ---- ☰ toggles the section sidebar (TOC). Desktop: body.tocshow
     (hidden by default, pref persisted); mobile keeps the slide-in. */
  /* the header is allowed to wrap, so the page offset has to follow its
     REAL height — otherwise a second row of controls hides under the
     document (or leaves a gap when it fits on one) */
  var chromeT=null;
  function measureChrome(){
    if(chromeT) return;
    chromeT=setTimeout(function(){
      chromeT=null;
      var top=$('#apptop'); if(!top) return;
      var h=Math.ceil(top.getBoundingClientRect().height);
      if(h>0) document.documentElement.style.setProperty(
        '--chrome-h',h+'px');
    },0);
  }
  APP.measureChrome=measureChrome;
  window.addEventListener('resize',measureChrome);
  document.addEventListener('sem:shell',measureChrome);
  document.addEventListener('sem:activate',measureChrome);
  measureChrome();
  var menuBtn=$('#menubtn');
  function applyToc(show){
    document.body.classList.toggle('tocshow',show);
    if(menuBtn) menuBtn.setAttribute('aria-pressed',
      show?'true':'false');
    try{localStorage.setItem('plotline-toc',
      show?'open':'hidden');}catch(e){}
  }
  var tocPref=null;
  try{tocPref=localStorage.getItem('plotline-toc');}catch(e){}
  applyToc(tocPref==='open');
  if(menuBtn) menuBtn.addEventListener('click',function(){
    if(window.matchMedia
       &&window.matchMedia('(max-width:860px)').matches){
      var sh=APP.active&&APP.shells[APP.active];
      if(!sh) return;
      var rail=$('.rail',sh.el);
      if(rail){rail.classList.toggle('open');
        if(scrim) scrim.classList.toggle('show');}
      return;
    }
    applyToc(!document.body.classList.contains('tocshow'));
  });

  /* huge markdown notes: clamp with a Show more toggle */
  function mdClampScan(shell){
    $$('.card[data-note="1"] .cardbody',shell).forEach(function(bd){
      if(bd.dataset.mdclamp) return;
      var nt=$('.note',bd); if(!nt) return;
      if(nt.scrollHeight<=460) return;
      bd.dataset.mdclamp='1';
      bd.classList.add('mdclamp');
      var btn=document.createElement('button');
      btn.className='mdmore';
      btn.textContent='Show more';
      btn.title='This note is long — expand it to full length';
      btn.addEventListener('click',function(){
        var open=bd.classList.toggle('mdopen');
        btn.textContent=open?'Show less':'Show more';
      });
      bd.parentNode.insertBefore(btn,bd.nextSibling);
    });
  }
  APP.mdscan=mdClampScan;

  /* ---- "add a note": a pencil on every card (app mode, local files).
     Saves a markdown cell into the .ipynb right after that card's cells;
     optionally git-commits it, linking the commit on GitHub. ---- */
  var noteCtx=null;
  function noteEls(){
    return {dlg:$('#note-dlg'),src:$('#note-dlg-src'),sub:$('#note-dlg-sub'),
      gitrow:$('#note-dlg-gitrow'),commit:$('#note-dlg-commit'),
      gitlab:$('#note-dlg-gitlab'),err:$('#note-dlg-err'),
      save:$('#note-dlg-save')};
  }
  function docToast(text,url,label,ms){
    var t=$('#doc-toast'); if(!t) return;
    t.textContent=text;
    if(url){
      t.appendChild(document.createTextNode(' — '));
      var a=document.createElement('a');
      a.href=url;a.target='_blank';a.rel='noopener';
      a.textContent=label||url;
      t.appendChild(a);
    }
    t.hidden=false;
    clearTimeout(t._tm);
    t._tm=setTimeout(function(){t.hidden=true;},ms||6500);
  }
  function closeNoteDlg(){
    var e=noteEls(); if(e.dlg) e.dlg.hidden=true;
    noteCtx=null;
  }
  function openNoteDlg(stem,anchor,title){
    var sh=APP.shells[stem];
    if(!sh||!sh.path||/^https?:/i.test(sh.path)) return;
    var e=noteEls(); if(!e.dlg) return;
    noteCtx={stem:stem,path:sh.path,anchor:anchor};
    e.sub.textContent='after “'+title+'” · saved into '
      +sh.path;
    e.src.value='';e.err.textContent='';
    e.gitrow.hidden=true;e.commit.checked=false;
    e.dlg.hidden=false;e.src.focus();
    api('/api/gitstate',{path:sh.path}).then(function(g){
      if(g&&g.repo&&noteCtx){
        e.gitrow.hidden=false;
        e.gitlab.textContent='also commit to git'
          +(g.github
            ?' ('+g.github.replace('https://github.com/','')+')':'');
      }
    }).catch(function(){});
  }
  (function(){
    var e=noteEls(); if(!e.dlg) return;
    var cancel=$('#note-dlg-cancel');
    if(cancel) cancel.addEventListener('click',closeNoteDlg);
    e.dlg.addEventListener('click',function(ev){
      if(ev.target===e.dlg) closeNoteDlg();});
    document.addEventListener('keydown',function(ev){
      if(ev.key==='Escape'&&!e.dlg.hidden){
        ev.stopPropagation();closeNoteDlg();}
    },true);
    e.save.addEventListener('click',function(){
      if(!noteCtx) return;
      var src=e.src.value.trim();
      if(!src){e.err.textContent='Write something first';return;}
      e.save.disabled=true;e.err.textContent='';
      api('/api/addnote',{path:noteCtx.path,after:noteCtx.anchor,
        source:src,commit:!!(e.commit.checked&&!e.gitrow.hidden)})
      .then(function(j){
        e.save.disabled=false;
        closeNoteDlg();
        mountShellHTML(j.shell,j.path);
        var sh2=APP.shells[j.stem];
        var card=sh2&&sh2.el.querySelector(
          '.card[data-anchor="cell:'+j.cell+'"]');
        if(card){
          card.scrollIntoView({behavior:'smooth',block:'center'});
          card.classList.add('target-flash');
          setTimeout(function(){
            card.classList.remove('target-flash');},1400);
        }
        var g=j.git&&j.git.commit;
        if(g&&g.ok)
          docToast('Note saved ✓ · committed '+(g.sha||''),
            g.url||'',g.url?'view on GitHub':'');
        else if(g&&!g.ok)
          docToast('Note saved ✓ · git commit failed: '
            +(g.error||''),'','',9000);
        else docToast('Note saved into the notebook ✓');
      }).catch(function(err){
        e.save.disabled=false;
        e.err.textContent=(err&&err.message)||'save failed';
      });
    });
  })();
  function wireAddNote(shell,stem){
    /* only where the server can WRITE: app mode + a local .ipynb (never
       static exports, URL-opened notebooks or Plot-trace clones) */
    if(APP.mode!=='app') return;
    if(shell.classList.contains('tracetab')) return;
    var p=shell.dataset.path||'';
    if(!p||/^https?:/i.test(p)) return;
    $$('.card',shell).forEach(function(card){
      var head=$('.cardhead',card); if(!head) return;
      if(head.querySelector('.card-addnote')) return;
      var b=document.createElement('button');
      b.className='card-addnote';b.type='button';
      b.innerHTML='&#9998;';
      b.title='Add a markdown note after this cell (saved into the '
        +'.ipynb; optionally committed to git)';
      b.addEventListener('click',function(ev){
        ev.preventDefault();ev.stopPropagation();
        var t=$('.cardtitle',card);
        openNoteDlg(stem,card.dataset.anchor,
          ((t&&t.textContent)||'this cell').trim());
      });
      head.insertBefore(b,head.querySelector('.cell-eye')||null);
    });
  }

  /* ---- interactive outputs: run neutralised output scripts (plotly-html /
     bokeh / vega / folium) and draw embedded Plotly figure specs. Cell output
     was produced by running the notebook, so its own <script> is trusted
     (nbconvert does the same). jsonOnly=true for CLONES (deck / tree) — their
     duplicate element ids would clash if arbitrary scripts re-ran, but the
     id-less Plotly spec draws cleanly on the element itself. ---- */
  function ensurePlotly(cb){
    if(window.Plotly) return cb();
    window.__plCbs=window.__plCbs||[];window.__plCbs.push(cb);
    if(window.__plLoading) return;
    window.__plLoading=1;
    var s=document.createElement('script');
    s.src='https://cdn.plot.ly/plotly-2.35.2.min.js';
    s.async=true;
    s.onload=function(){var q=window.__plCbs||[];window.__plCbs=[];
      q.forEach(function(f){try{f();}catch(e){}});};
    /* keep the queue on failure: a later ensurePlotly retries the load and
       onload then draws the figures that were pending when it first failed
       (the draw callback skips already-rendered divs, so no double-draw) */
    s.onerror=function(){window.__plLoading=0;};
    document.head.appendChild(s);
  }
  function activateOutputs(root,jsonOnly){
    root=root||document;
    if(!jsonOnly){
      /* revive in DOCUMENT ORDER: an external <script src> must finish
         loading before the following (often inline) init runs, else the lib
         (Plotly/Bokeh/vegaEmbed) is undefined when the init executes. So we
         chain: block on each src script's onload before inserting the next. */
      var list=[].filter.call(
        root.querySelectorAll('script[type="text/plotline-embed"]'),
        function(o){return !o.dataset.ran;});
      (function runNext(i){
        if(i>=list.length) return;
        var old=list[i]; old.dataset.ran='1';
        var s=document.createElement('script');
        for(var j=0;j<old.attributes.length;j++){
          var a=old.attributes[j];
          if(a.name==='type'||a.name==='data-ran') continue;
          try{s.setAttribute(a.name,a.value);}catch(e){}
        }
        var hasSrc=!!old.getAttribute('src');
        if(hasSrc){s.async=false;
          s.onload=s.onerror=function(){runNext(i+1);};}
        else s.textContent=old.textContent;   /* inline runs on insert */
        if(old.parentNode) old.parentNode.replaceChild(s,old);
        if(!hasSrc) runNext(i+1);
      })(0);
    }
    var pe=root.querySelectorAll('.plotly-embed[data-plotly]');
    /* skip embeds on hidden pager pages — a plot drawn into display:none
       has no size; the pager draws it (via SemActivate) when flipped to */
    pe=[].filter.call(pe,function(d){
      var p=d.closest&&d.closest('.figpage');
      return !p||p.classList.contains('current');
    });
    if(!pe.length) return;
    ensurePlotly(function(){
      if(!window.Plotly) return;
      [].forEach.call(pe,function(div){
        /* a cloned card may carry a static copy already — leave it be */
        if(div.querySelector('.js-plotly-plot,.plotly')) return;
        var raw=div.getAttribute('data-plotly'); if(!raw) return;
        try{
          var spec=JSON.parse(raw);
          window.Plotly.newPlot(div,spec.data||[],spec.layout||{},
            {responsive:true,displaylogo:false});
        }catch(e){}
      });
    });
  }
  window.SemActivate=activateOutputs;

  /* The #/##/### section tiers form a real hierarchy: collapsing or hiding
     a section also folds every DEEPER section that follows it, until a
     heading at the same tier (or shallower) closes the subtree. Sections
     stay flat siblings in the DOM — this pass just stamps the classes. */
  function recalcSecCascade(sh){
    var hideLv=null,offLv=null;
    $$('.section',sh).forEach(function(sec){
      var lv=+(sec.dataset.level||2);
      if(hideLv!=null&&lv<=hideLv) hideLv=null;
      if(offLv!=null&&lv<=offLv) offLv=null;
      sec.classList.toggle('sec-under',hideLv!=null);
      sec.classList.toggle('sec-under-off',offLv!=null);
      var sid=sec.dataset.sec;
      var row=sh.querySelector('.navsec-row[data-sec="'+sid+'"]');
      var items=sh.querySelector('.navitems[data-sec="'+sid+'"]');
      if(row){
        row.classList.toggle('nav-under',hideLv!=null);
        row.classList.toggle('sec-under-off',offLv!=null);
      }
      if(items) items.classList.toggle('nav-under',
        hideLv!=null||offLv!=null);
      if(hideLv==null&&sec.classList.contains('sec-collapsed')) hideLv=lv;
      if(offLv==null&&sec.classList.contains('sec-off')) offLv=lv;
    });
  }
  /* ---- figure zoom: live embeds (plotly/bokeh/vega) size themselves to
     their container once, so a resized figure must be told to re-fit ---- */
  /* how far a card can grow before it runs past the stage and drags a
     horizontal scrollbar onto the whole page */
  /* "zoomed" = this card's figure should FILL its frame (see the CSS):
     only then does a wider card actually show a bigger plot */
  function syncZoomed(card){
    if(!card||!card.classList) return;
    var own=parseFloat(card.style.getPropertyValue('--fz'))||1;
    /* any deliberate zoom — smaller as well as bigger — makes the plot
       track its frame; at exactly 1 it goes back to its natural size */
    card.classList.toggle('zoomed',
      Math.abs(own*(figAll||1)-1)>0.001);
  }
  function maxZoomFor(card){
    var stage=card&&card.closest?card.closest('.stage'):null;
    var host=card&&card.parentNode;
    if(!stage||!host||!host.getBoundingClientRect) return 3;
    var avail=stage.getBoundingClientRect().width-28;
    var base=host.getBoundingClientRect().width;
    if(!base||!avail) return 3;
    return Math.max(1,Math.min(3,avail/base));
  }
  /* live embeds size themselves to their container, so a resized figure
     has to be told. Only the embeds actually present are touched, and the
     global resize event — which makes every other listener relayout — is
     fired ONLY when there is something that needs it. */
  var embedT=null;
  function resizeEmbeds(root){
    clearTimeout(embedT);
    embedT=setTimeout(function(){
      var plots=[];
      try{plots=$$('.js-plotly-plot',root&&root.querySelectorAll
        ?root:document);}catch(e){}
      if(!plots.length) return;
      try{
        if(window.Plotly&&Plotly.Plots)
          plots.forEach(function(g){
            try{Plotly.Plots.resize(g);}catch(e){}});
      }catch(e){}
      try{window.dispatchEvent(new Event('resize'));}catch(e){}
    },80);
  }
  /* ---- ⤢ : one figure, full screen. The node is CLONED (ids stripped) so
     the live figure in the feed is never detached. ---- */
  function openFigMax(fig){
    var host=$('#figmax'),box=$('#figmax-box');
    if(!host||!box||!fig) return;
    box.innerHTML='';
    var src=fig.querySelector(
      '.figpage.current, .figframe, .figpager')||fig;
    var cl=src.cloneNode(true);
    $$('[id]',cl).forEach(function(n){n.removeAttribute('id');});
    if(cl.removeAttribute) cl.removeAttribute('id');
    $$('.figzoom',cl).forEach(function(n){
      if(n.parentNode) n.parentNode.removeChild(n);});
    box.appendChild(cl);
    /* a fullscreen document keeps its own top layer — the overlay must
       live inside it or it paints underneath */
    var fsc=document.fullscreenElement;
    (fsc||document.body).appendChild(host);
    host.hidden=false;
    resizeEmbeds(box);
  }
  function closeFigMax(){
    var host=$('#figmax'),box=$('#figmax-box');
    if(!host) return;
    host.hidden=true;
    if(box) box.innerHTML='';
    if(host.parentNode!==document.body) document.body.appendChild(host);
  }
  (function(){
    var host=$('#figmax'); if(!host) return;
    host.addEventListener('click',function(e){
      if(e.target===host||e.target.id==='figmax-close') closeFigMax();});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&!host.hidden){e.stopPropagation();closeFigMax();}
    },true);
  })();
  /* ---- universal figure size for the whole feed (appbar +/-) ---- */
  var figAll=1;
  function applyFigAll(){
    $$('.nbshell').forEach(function(sh){
      if(figAll===1) sh.style.removeProperty('--fzall');
      else sh.style.setProperty('--fzall',figAll);
      $$('.card.has-fig',sh).forEach(syncZoomed);
    });
    var lab=$('#fig-size-val');
    if(lab) lab.textContent=Math.round(figAll*100)+'%';
    resizeEmbeds(document);
    scheduleSaveLayout();
  }
  APP.getFigAll=function(){return figAll;};
  APP.setFigAll=function(v){figAll=v||1;applyFigAll();};
  function bumpFigAll(mult){
    /* same ceiling, measured on a real card in the active notebook */
    var probe=$('.nbshell:not([hidden]) .card.has-fig');
    var cap=probe?maxZoomFor(probe):2.5;
    figAll=Math.max(0.4,Math.min(Math.max(1,Math.min(2.5,cap)),
      Math.round(figAll*mult*100)/100));
    applyFigAll();
  }
  (function(){
    var i=$('#fig-bigger'),o=$('#fig-smaller'),v=$('#fig-size-val');
    /* in TREE view these same three buttons drive the tree's zoom — the
       tree has no figures to size, and a size control that lives in a
       different place per view is exactly what the user asked us to stop
       doing. ribbonSizeStep returns true when it handled it. */
    if(i) i.addEventListener('click',function(){
      if(!APP.ribbonSizeStep(1)) bumpFigAll(1.15);});
    if(o) o.addEventListener('click',function(){
      if(!APP.ribbonSizeStep(-1)) bumpFigAll(1/1.15);});
    if(v) v.addEventListener('click',function(){
      if(!APP.ribbonSizeStep(0)){figAll=1;applyFigAll();}});
  })();
  /* ---- markdown / prose text size (the same idea, for words) ---- */
  var mdAll=1;
  function applyMdAll(){
    $$('.nbshell').forEach(function(sh){
      if(mdAll===1) sh.style.removeProperty('--mdscale');
      else sh.style.setProperty('--mdscale',mdAll);});
    var lab=$('#md-size-val');
    if(lab) lab.textContent=Math.round(mdAll*100)+'%';
    scheduleSaveLayout();
  }
  APP.applyMdAll=applyMdAll;
  APP.setMdAll=function(v){mdAll=v||1;applyMdAll();};
  APP.getMdAll=function(){return mdAll;};
  (function(){
    var i=$('#md-bigger'),o=$('#md-smaller'),v=$('#md-size-val');
    function bump(m){
      mdAll=Math.max(0.7,Math.min(2,Math.round(mdAll*m*100)/100));
      applyMdAll();
    }
    if(i) i.addEventListener('click',function(){bump(1.12);});
    if(o) o.addEventListener('click',function(){bump(1/1.12);});
    if(v) v.addEventListener('click',function(){mdAll=1;applyMdAll();});
  })();
  APP.applyFigAll=applyFigAll;
  /* Per-card behaviours, shared by the docs shell and the Plot-trace tab so
     the trace is a genuine subset of the docs with every control live.
     (Nav/graph wiring stays in initShell — the trace tab has no sidebar.) */
  function wireCardBehaviors(shell,stem){
    /* ---- code toggles ---- */
    $$('.codetoggle',shell).forEach(function(btn){
      btn.addEventListener('click',function(){
        var wrap=btn.closest('.codewrap');
        var open=wrap.hasAttribute('data-open');
        if(open){wrap.removeAttribute('data-open');
          btn.setAttribute('aria-expanded','false');}
        else{wrap.setAttribute('data-open','');
          btn.setAttribute('aria-expanded','true');}
      });
    });
    /* ---- per-cell eye: hide/show one cell (it stays in the sidebar) ---- */
    function setCellOff(id,off){
      var card=shell.querySelector('.card[id="card-'+id+'"]');
      var nav=shell.querySelector('.navitem[data-item="'+id+'"]');
      if(card) card.classList.toggle('cell-off',off);
      if(nav) nav.classList.toggle('cell-off',off);
      applyFilters();
    }
    $$('.cell-eye',shell).forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        var card=btn.closest('.card'); if(!card) return;
        setCellOff(card.id.replace(/^card-/,''),true);   /* hide this cell */
      });
    });
    $$('.navitem-eye',shell).forEach(function(sp){
      var toggle=function(e){
        e.preventDefault();e.stopPropagation();
        var nav=sp.closest('.navitem'); if(!nav) return;
        setCellOff(nav.dataset.item,!nav.classList.contains('cell-off'));
      };
      sp.addEventListener('click',toggle);
      /* role=button span: Enter/Space must act (keyboard users restore a
         cell hidden via the card eye only through this control) */
      sp.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') toggle(e);
      });
    });
    /* ---- figure "Plot trace" button -> the deck's trace tab ---- */
    $$('.plot-trace-btn',shell).forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        if(window.SemTrace) window.SemTrace.open(stem,btn.dataset.trace);
      });
    });
    /* ---- "derives from" dep chip -> scroll to its source card (scoped to
       this shell, so it works in the docs AND the trace tab's clones) ---- */
    $$('.depchip',shell).forEach(function(a){
      a.addEventListener('click',function(e){
        e.preventDefault();
        var src=$('.card[data-node="'+a.dataset.dep+'"]',shell);
        if(src){src.scrollIntoView({behavior:'smooth',block:'center'});
          src.classList.add('target-flash');
          setTimeout(function(){src.classList.remove('target-flash');},1400);}
      });
    });
    /* ---- section collapse + hide: available in the MAIN view and the sidebar,
       kept in sync. Collapse folds a section's cards; hide drops the whole
       section (it stays in the sidebar, dimmed, so you can bring it back).
       Nav queries no-op on the trace tab (which has no sidebar). ---- */
    function setSecCollapsed(sid,val){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      var items=shell.querySelector('.navitems[data-sec="'+sid+'"]');
      if(sec) sec.classList.toggle('sec-collapsed',val);
      if(row) row.classList.toggle('collapsed',val);
      if(items) items.classList.toggle('nav-collapsed',val);
      var chevs=shell.querySelectorAll('.sec-chev[data-sec="'+sid+'"],'
        +'.navsec-row[data-sec="'+sid+'"] .navsec-chev');
      [].forEach.call(chevs,function(ch){
        ch.setAttribute('aria-expanded',(!val).toString());});
      recalcSecCascade(shell);   /* fold/unfold the deeper tiers below */
      scheduleSaveLayout();
    }
    function setSecOff(sid,val){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.toggle('sec-off',val);
      if(row) row.classList.toggle('sec-off',val);
      recalcSecCascade(shell);   /* hide/restore the deeper tiers below */
      scheduleSaveLayout();
      applyFilters();   /* keep the sidebar in step (a hidden section stays) */
      syncUnhideBtn(shell);
    }
    /* ---- "Show all hidden": a REVEAL TOGGLE, not a reset. It brings the
       hidden sections, headings and cells back into view — marked, so you
       can see which ones they are — and clicking again puts them away.
       Nothing about what is hidden changes, so the saved layout is
       untouched and you can hide them all again with one click. While
       they are revealed each one's own eye still works, which is how you
       un-hide just the one you actually wanted back. ---- */
    function syncUnhideBtn(sh){
      var b=sh.querySelector('.rf-unhide'); if(!b) return;
      var n=sh.querySelectorAll('.section.sec-off,.section.sec-headoff,'
        +'.content .card.cell-off').length;
      var on=sh.classList.contains('reveal-hidden');
      /* with nothing hidden the button has no job — unless it is still
         revealing, in which case it is the only way back */
      b.hidden=!n&&!on;
      b.setAttribute('aria-pressed',on?'true':'false');
      b.textContent=on?('Hide them again ('+n+')')
                      :('Show all hidden ('+n+')');
      if(!n&&on) sh.classList.remove('reveal-hidden');
    }
    (function(){
      var ub=shell.querySelector('.rf-unhide');
      if(!ub) return;
      ub.addEventListener('click',function(e){
        e.stopPropagation();
        shell.classList.toggle('reveal-hidden');
        syncUnhideBtn(shell);
      });
      syncUnhideBtn(shell);
    })();
    /* hiding the HEADING is a different, smaller action than hiding the
       section: the cards stay in the document, only the title goes. */
    function setSecHeadOff(sid,val){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.toggle('sec-headoff',val);
      if(row) row.classList.toggle('head-off',val);
      scheduleSaveLayout();
      syncUnhideBtn(shell);
    }
    function isHeadOff(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      if(sec) return sec.classList.contains('sec-headoff');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      return !!(row&&row.classList.contains('head-off'));
    }
    function isCollapsed(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      return !!(sec&&sec.classList.contains('sec-collapsed'));
    }
    $$('.sec-chev',shell).forEach(function(ch){
      ch.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        setSecCollapsed(ch.dataset.sec,!isCollapsed(ch.dataset.sec));
      });
    });
    $$('.navsec-chev',shell).forEach(function(ch){
      ch.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        var row=ch.closest('.navsec-row'); if(!row) return;
        setSecCollapsed(row.dataset.sec,!row.classList.contains('collapsed'));
      });
    });
    /* clicking the section header (not a button) also collapses it */
    $$('.sectionhead',shell).forEach(function(h){
      h.addEventListener('click',function(e){
        if(e.target.closest('button,a')) return;
        var sec=h.closest('.section'); if(!sec) return;
        setSecCollapsed(sec.dataset.sec,!sec.classList.contains('sec-collapsed'));
      });
    });
    $$('.sec-eye',shell).forEach(function(b){
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        /* the heading only — and it toggles, because the thin hover strip
           left behind still carries this button */
        setSecHeadOff(b.dataset.sec,!isHeadOff(b.dataset.sec));
      });
    });
    $$('.sec-hideall',shell).forEach(function(b){
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        setSecOff(b.dataset.sec,true);   /* heading AND every card */
      });
    });
    $$('.navsec-eye',shell).forEach(function(sp){
      var toggle=function(e){
        e.preventDefault();e.stopPropagation();
        var row=sp.closest('.navsec-row'); if(!row) return;
        setSecHeadOff(row.dataset.sec,!isHeadOff(row.dataset.sec));
      };
      sp.addEventListener('click',toggle);
      sp.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') toggle(e);});
    });
    $$('.navsec-hideall',shell).forEach(function(sp){
      var toggle=function(e){
        e.preventDefault();e.stopPropagation();
        var row=sp.closest('.navsec-row'); if(!row) return;
        if(row.classList.contains('sec-under-off')){
          /* dimmed because an ANCESTOR is hidden: restore the hidden
             ancestors (bringing this row back with them) instead of
             stamping a stray hide on the child itself */
          var rows=$$('.navsec-row',shell);
          var lv=+(row.dataset.level||2);
          for(var k=rows.indexOf(row)-1;k>=0;k--){
            var r2=rows[k],l2=+(r2.dataset.level||2);
            if(l2>=lv) continue;
            if(r2.classList.contains('sec-off'))
              setSecOff(r2.dataset.sec,false);
            lv=l2;
            if(l2<=1) break;
          }
          if(row.classList.contains('sec-off'))
            setSecOff(row.dataset.sec,false);
          return;
        }
        setSecOff(row.dataset.sec,!row.classList.contains('sec-off'));
      };
      sp.addEventListener('click',toggle);
      sp.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') toggle(e);});
    });
    /* ---- a Collapsed markdown note opens when its header is clicked;
       clicking again folds it back ---- */
    $$('.card',shell).forEach(function(c){
      var head=$('.cardhead',c);
      if(head) head.addEventListener('click',function(e){
        if(e.target.closest('button,a')) return;   /* leave eye/trace clicks */
        if(c.classList.contains('collapsed')) c.classList.toggle('expanded');
      });
    });
    /* ---- a figure folded by Plots = Collapsed opens on click ---- */
    $$('.cb-fig',shell).forEach(function(f){
      f.addEventListener('click',function(){
        if(f.classList.contains('part-fold')) f.classList.toggle('part-open');
      });
    });
    /* ---- per-figure zoom (+ / - / expand full screen) ---- */
    $$('.cb-fig .figzoom',shell).forEach(function(z){
      var fig=z.parentNode;
      /* the factor lives on the CARD: widening the card takes its border
         and header with it, so the figure never sits outside its cell */
      var card=fig.closest('.card')||fig;
      function bump(mult){
        var cur=parseFloat(card.style.getPropertyValue('--fz'))||1;
        /* the ceiling is what actually fits — growing past the stage
           would put a scrollbar under the whole document */
        var cap=maxZoomFor(card)/(figAll||1);
        var next=Math.max(0.35,Math.min(Math.max(1,cap),
          Math.round(cur*mult*100)/100));
        if(next===1) card.style.removeProperty('--fz');
        else card.style.setProperty('--fz',next);
        syncZoomed(card);
        resizeEmbeds(card);
        scheduleSaveLayout();   /* this size is yours to keep */
      }
      z.addEventListener('click',function(e){e.stopPropagation();});
      var bi=$('.fz-in',z),bo=$('.fz-out',z),bx=$('.fz-max',z);
      if(bi) bi.addEventListener('click',function(e){
        e.stopPropagation();bump(1.25);});
      if(bo) bo.addEventListener('click',function(e){
        e.stopPropagation();bump(1/1.25);});
      if(bx) bx.addEventListener('click',function(e){
        e.stopPropagation();openFigMax(fig);});
    });
    /* ---- output folded by Output = Collapsed reveals on click. Open-only
       (unlike a figure): the output is text/tables you may want to select,
       so a click inside it must not fold it back up ---- */
    $$('.cb-out',shell).forEach(function(o){
      o.addEventListener('click',function(){
        if(o.classList.contains('part-fold')&&!o.classList.contains('part-open'))
          o.classList.add('part-open');
      });
    });
  }
  APP.wireCardBehaviors=wireCardBehaviors;
  /* ---- a notebook opened straight from GitHub still has a history: read
     it from the public API, so the hash + version list work with no local
     clone. Handles both the raw. and the blob/ form of the URL. ---- */
  function ghFromUrl(u){
    var m=/^https?:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/
      .exec(u||'');
    if(!m) m=/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|raw)\/([^\/]+)\/(.+)$/
      .exec(u||'');
    if(!m) return null;
    return {owner:m[1],repo:m[2],ref:m[3],
      path:m[4].split('?')[0].split('#')[0]};
  }
  function ghRawAt(gh,sha){
    return 'https://raw.githubusercontent.com/'+gh.owner+'/'+gh.repo
      +'/'+sha+'/'+gh.path;
  }
  /* Open a URL that is ANOTHER VERSION of a notebook already open. With
     `intoStem` it replaces that tab (same file, different moment) and is
     kept out of Recent; without it, a normal open in its own tab. */
  function openUrlVersion(url,intoStem,verTag,label){
    function tag(st){
      var sh=APP.shells[st];
      if(!sh) return;
      sh.version=verTag||'';sh.path=url;
      if(label) sh.label=label;
      renderTabs();
    }
    if(!intoStem){
      /* its OWN tab, but still named for the notebook with the commit
         underneath — not "draft_01-2" */
      if(APP.mode==='web'){
        fetch(url,{cache:'no-store'}).then(function(r){
          if(!r.ok) throw new Error('HTTP '+r.status);
          return r.text();
        }).then(function(txt){
          if(!webReady()) throw new Error('Python is still loading');
          var name=decodeURIComponent(
            url.split('?')[0].split('/').pop()||'notebook.ipynb');
          var shell=window.semPy.parse(name,txt,APP.order.slice());
          mountShellHTML(shell,url,true);
          var tmp=document.createElement('div');tmp.innerHTML=shell;
          var el=tmp.querySelector('.nbshell');
          tag(el?el.dataset.nb:'');
        }).catch(function(e){
          alert('Could not open that version: '+((e&&e.message)||e));});
        return;
      }
      api('/api/open',{path:url}).then(function(j){
        mountShellHTML(j.shell,url,true);
        tag(j.stem);
      }).catch(function(e){
        alert('Could not open that version: '+((e&&e.message)||e));});
      return;
    }
    function land(shellHtml){
      mountShellHTML(shellHtml,url,true);
      tag(intoStem);
    }
    if(APP.mode==='web'){
      fetch(url,{cache:'no-store'}).then(function(r){
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.text();
      }).then(function(txt){
        if(!webReady()) throw new Error('Python is still loading');
        var name=decodeURIComponent(
          url.split('?')[0].split('/').pop()||'notebook.ipynb');
        /* exclude the tab we are replacing from the taken names, so the
           parser reproduces ITS stem instead of minting a second one */
        var taken=APP.order.filter(function(s){return s!==intoStem;});
        land(window.semPy.parse(name,txt,taken));
      }).catch(function(e){
        alert('Could not open that version: '+((e&&e.message)||e));});
      return;
    }
    api('/api/open',{path:url,stem:intoStem}).then(function(j){
      land(j.shell);
    }).catch(function(e){
      alert('Could not open that version: '+((e&&e.message)||e));});
  }
  function ghCommits(gh){
    var url='https://api.github.com/repos/'+encodeURIComponent(gh.owner)
      +'/'+encodeURIComponent(gh.repo)+'/commits?per_page=25&sha='
      +encodeURIComponent(gh.ref)+'&path='+encodeURIComponent(gh.path);
    return fetch(url,{headers:{'Accept':'application/vnd.github+json'}})
      .then(function(r){
        if(r.status===403)
          throw new Error('GitHub rate limit — try again later');
        if(!r.ok) throw new Error('GitHub said '+r.status);
        return r.json();
      }).then(function(list){
        return (list||[]).map(function(c){
          var d=((c.commit||{}).author||{}).date||'';
          var msg=((c.commit||{}).message||'').split('\n')[0];
          return {id:String(c.sha||'').slice(0,10),full:c.sha,
            msg:msg,date:d?d.slice(0,10):''};
        });
      });
  }
  /* ---- File info: where this notebook came from. The path, the git
     commit it is sitting on, and the way in to every earlier version —
     all in one place at the top of the sidebar, with Reload beside it. */
  function wireFileInfo(shell,stem){
    var bar=$('.railfile',shell),panel=$('.rf-panel',shell);
    if(!bar||!panel) return;
    var info=$('.rf-info',bar),rel=$('.rf-reload',bar);
    var path=shell.dataset.path||'';
    var isUrlPath=/^https?:/i.test(path);
    if(rel){
      rel.hidden=!path;
      rel.title=isUrlPath?'Reload from the URL':'Reload from disk';
      rel.addEventListener('click',function(){
        if(path) openPath(path);});
    }
    /* one line per fact, truncated with the full value on hover — a raw
       URL broken mid-word across three lines is what made this a mess */
    function row(k,v,cls){
      var r=document.createElement('div');r.className='rf-row';
      var kk=document.createElement('div');kk.className='rf-k';
      kk.textContent=k;
      var vv=document.createElement('div');
      vv.className='rf-v'+(cls?' '+cls:'');
      vv.textContent=v;
      vv.title=v;
      r.appendChild(kk);r.appendChild(vv);
      return r;
    }
    function baseName(p){
      var b=String(p||'').split('?')[0].split('#')[0]
        .split(/[\\/\\\\]/).pop();
      try{b=decodeURIComponent(b);}catch(e){}
      return b||String(p||'');
    }
    function folderOf(p){
      var s=String(p||'').split('?')[0].split('#')[0];
      var i=Math.max(s.lastIndexOf('/'),s.lastIndexOf('\\\\'));
      return i>0?s.slice(0,i):s;
    }
    function act(label,title,fn){
      var b=document.createElement('button');
      b.className='rf-btn';b.type='button';
      b.textContent=label;b.title=title;
      b.addEventListener('click',function(e){e.stopPropagation();fn(b);});
      return b;
    }
    function closePanel(){
      panel.hidden=true;
      if(info) info.setAttribute('aria-expanded','false');
    }
    function fill(){
      panel.innerHTML='';
      var sh=APP.shells[stem]||{};
      var ghp=isUrlPath?ghFromUrl(path):null;
      /* the NAME first, then where it lives — not a wrapped raw URL */
      panel.appendChild(row('file',baseName(path)||'untitled'));
      panel.appendChild(row(isUrlPath?'from':'folder',
        ghp?(ghp.owner+'/'+ghp.repo)
          :(path?folderOf(path):'not saved to a file')));
      /* which version of the notebook you are looking at right now */
      var ver=sh.version||'';
      var vrow;
      if(ver){
        vrow=row('showing',
          /^git:/.test(ver)?('an earlier commit — '+ver.slice(4))
            :'an earlier snapshot','rf-old');
      } else vrow=row('showing','the latest version','rf-live');
      panel.appendChild(vrow);
      var acts=document.createElement('div');acts.className='rf-acts';
      panel.appendChild(acts);
      if(APP.mode==='app'&&path&&!isUrlPath){
        acts.appendChild(act('⌚ Version history…',
          'Every saved snapshot and git commit of this notebook — '
          +'open any of them',
          function(b){showVersMenu(b,stem);}));
      }
      if(ver){
        acts.appendChild(act('↻ Back to current',
          'Leave this old version and reload the file as it is now',
          function(){openPath(path);}));
      }
      /* --- the commit list, shown under the hash when you click it --- */
      function commitList(commits,openAt){
        var box=document.createElement('div');
        box.className='rf-commits';box.hidden=true;
        commits.forEach(function(c){
          var row=document.createElement('div');row.className='rf-crow';
          var b=document.createElement('button');
          b.className='rf-commit';b.type='button';
          var h=document.createElement('span');
          h.className='rf-ch';h.textContent=c.id;
          var m=document.createElement('span');
          m.className='rf-cm';m.textContent=c.msg||'(no message)';
          var d=document.createElement('span');
          d.className='rf-cd';d.textContent=c.date||'';
          b.appendChild(h);b.appendChild(m);b.appendChild(d);
          b.title='View this notebook as it was at '+c.id
            +' (same tab — it is the same file)';
          b.addEventListener('click',function(e){
            e.stopPropagation();closePanel();openAt(c,false);});
          /* …or side by side, when you actually want to compare */
          var nt=document.createElement('button');
          nt.className='rf-newtab';nt.type='button';
          nt.textContent='⧉';
          nt.title='Open this version in a new tab, to compare';
          nt.addEventListener('click',function(e){
            e.stopPropagation();closePanel();openAt(c,true);});
          row.appendChild(b);row.appendChild(nt);
          box.appendChild(row);
        });
        if(!commits.length){
          var e0=document.createElement('div');
          e0.className='rf-v rf-sub';
          e0.textContent='no commits found for this file';
          box.appendChild(e0);
        }
        return box;
      }
      /* the hash IS the way in: click it to see every version */
      function hashRow(label,c,commits,openAt){
        var r=document.createElement('div');r.className='rf-row';
        var kk=document.createElement('div');kk.className='rf-k';
        kk.textContent=label;
        var btn=document.createElement('button');
        btn.className='rf-v hash rf-hashbtn';btn.type='button';
        var hid=document.createElement('span');hid.textContent=c.id;
        var car=document.createElement('span');
        car.className='rf-caret';car.textContent='▾';
        btn.appendChild(hid);btn.appendChild(car);
        btn.title='Show every version of this notebook';
        var sub=document.createElement('div');
        sub.className='rf-v rf-sub';
        sub.textContent=(c.msg||'')+(c.date?('  ·  '+c.date):'');
        var list=commitList(commits,openAt);
        btn.addEventListener('click',function(e){
          e.stopPropagation();
          list.hidden=!list.hidden;
          btn.classList.toggle('open',!list.hidden);
        });
        r.appendChild(kk);r.appendChild(btn);r.appendChild(sub);
        r.appendChild(list);
        return r;
      }
      /* ---- a notebook opened from GitHub: read its history from the
         GitHub API, so the same hash/versions work with no local repo --- */
      var gh=ghp;
      if(gh){
        var pend=row('commit','loading history…');
        panel.insertBefore(pend,acts);
        ghCommits(gh).then(function(commits){
          if(pend.parentNode) pend.parentNode.removeChild(pend);
          if(!commits.length) return;
          panel.insertBefore(hashRow('commit',commits[0],commits,
            function(c,newTab){
              /* every commit is the SAME file at a different moment — it
                 belongs in this tab, not a new one, and it is not a new
                 entry in Recent. "⧉" is the explicit opt-in to compare. */
              openUrlVersion(ghRawAt(gh,c.full||c.id),
                newTab?null:stem,'git:'+c.id,
                (APP.shells[stem]||{}).label||stem);
            }),acts);
        }).catch(function(e){
          var v=$('.rf-v',pend);
          if(v) v.textContent=(e&&e.message)||'could not reach GitHub';
        });
        acts.appendChild(act('↗ GitHub',
          'Open this file on GitHub',function(){
            try{window.open('https://github.com/'+gh.owner+'/'+gh.repo
              +'/blob/'+gh.ref+'/'+gh.path,'_blank','noopener');}catch(e){}
          }));
        return;
      }
      if(!(APP.mode==='app'&&path&&!isUrlPath)) return;
      /* git details come from the server */
      var gr=row('git','checking…');
      panel.insertBefore(gr,acts);
      APP.api('/api/gitstate',{path:path}).then(function(g){
        var v=$('.rf-v',gr);
        if(!g||!g.repo){
          v.textContent='not in a git repository';
          return;
        }
        v.textContent=(g.branch?('branch '+g.branch):'in a git repository');
        var c=g.commit;
        if(c&&c.id){
          /* the hash expands into the full commit list, each openable */
          APP.api('/api/versions',{path:path}).then(function(j){
            var commits=(j&&j.commits)||[c];
            panel.insertBefore(hashRow('commit',c,commits,
              function(cm,newTab){
                /* same file, different moment — it replaces this tab and
                   is not a new entry in Recent */
                APP.api('/api/openversion',
                  {path:path,commit:cm.id,stem:newTab?'':stem})
                  .then(function(r){
                    if(!r||!r.shell) return;
                    mountShellHTML(r.shell,r.path||path,!newTab);
                    var st=r.stem||stem;
                    var s2=APP.shells[st];
                    if(s2){
                      s2.version='git:'+cm.id;
                      if(!s2.label) s2.label=(APP.shells[stem]||{}).label
                        ||stem;
                      renderTabs();
                    }
                  }).catch(function(){});
              }),acts);
          }).catch(function(){
            panel.insertBefore(hashRow('current commit',c,[c],
              function(){}),acts);
          });
        }
        if(g.github){
          acts.appendChild(act('↗ GitHub',
            'Open this repository on GitHub',function(){
              try{window.open(g.github,'_blank','noopener');}catch(e){}
            }));
        }
      }).catch(function(){
        var v=$('.rf-v',gr);
        if(v) v.textContent='could not read git';
      });
    }
    function toggle(anchor){
      var open=panel.hidden;
      panel.hidden=!open;
      if(info) info.setAttribute('aria-expanded',open.toString());
      if(open) fill();
      /* opened from the ribbon: float it under that button. It has to be
         re-parented to <body> — .rail is position:sticky, which makes its
         own stacking context, so any z-index inside it still loses to the
         fixed header and the panel opens BEHIND the ribbon. */
      if(anchor&&open){
        panel.classList.add('rf-float');
        document.body.appendChild(panel);
        var r=anchor.getBoundingClientRect();
        panel.style.top=(r.bottom+6)+'px';
        panel.style.left=Math.max(8,
          Math.min(r.left,window.innerWidth-320))+'px';
      } else if(!anchor){
        panel.classList.remove('rf-float');
        panel.style.top='';panel.style.left='';
        var head=$('.railhead',shell);
        if(head&&panel.parentNode!==head) head.appendChild(panel);
      }
    }
    if(info) info.addEventListener('click',function(e){
      e.stopPropagation();toggle(null);});
    /* clicking anywhere else closes it — wherever it is anchored */
    document.addEventListener('click',function(e){
      if(panel.hidden||panel.contains(e.target)) return;
      if(info&&info.contains(e.target)) return;
      var fb=$('#file-info-btn');
      if(fb&&fb.contains(e.target)) return;
      closePanel();
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&!panel.hidden) closePanel();});
    /* the ribbon's File button drives whichever notebook is active */
    APP.fileInfoToggle=APP.fileInfoToggle||{};
    APP.fileInfoToggle[stem]=toggle;
  }
  (function(){
    var fb=$('#file-info-btn'),rb=$('#file-reload');
    function activeSh(){return APP.active&&APP.shells[APP.active];}
    /* these are DISABLED, never hidden: a button that appears once the
       notebook finishes loading shoves the whole bar sideways */
    function sync(){
      var sh=activeSh();
      var has=!!(sh&&sh.path&&!sh.trace);
      if(fb) fb.disabled=!has;
      if(rb){
        rb.disabled=!has;
        rb.title=(sh&&/^https?:/i.test(sh.path||''))
          ?'Reload from the URL':'Reload from disk';
      }
      measureChrome();
    }
    if(fb) fb.addEventListener('click',function(e){
      e.stopPropagation();
      var t=APP.fileInfoToggle&&APP.fileInfoToggle[APP.active];
      if(t) t(fb);
    });
    if(rb) rb.addEventListener('click',function(){
      var sh=activeSh(); if(sh&&sh.path) openPath(sh.path);});
    document.addEventListener('click',function(e){
      /* the floated panel now lives on <body>, so find it there */
      var p=document.querySelector('body > .rf-panel.rf-float');
      if(p&&!p.hidden&&e.target!==fb&&!p.contains(e.target)) p.hidden=true;
    });
    document.addEventListener('sem:activate',sync);
    document.addEventListener('sem:shell',sync);
    APP.syncFileBtns=sync;
    sync();
  })();
  function initShell(shell){
    var data={};
    var de=$('.nb-data',shell);
    if(de){try{data=JSON.parse(de.textContent);}catch(e){}}
    var stem=shell.dataset.nb||data.stem||('nb-'+(APP.order.length+1));
    mdClampScan(shell);
    wireFileInfo(shell,stem);

    /* ---- filename + path bar at the top of the document ---- */
    var db=$('.docbar',shell);
    if(db){
      var p=shell.dataset.path||'';
      var nmEl=$('.docbar-nm',db), pEl=$('.docbar-p',db);
      if(p){
        var parts=p.split(/[\/\\]/);
        var base=parts[parts.length-1]||p;
        base=base.split('?')[0].split('#')[0];
        try{base=decodeURIComponent(base);}catch(e){}
        if(nmEl&&base) nmEl.textContent=base;
        if(pEl){pEl.textContent=p;pEl.dir='ltr';
          pEl.title=p;}
      } else if(pEl){pEl.textContent='';}
      db.hidden=false;
    }

    /* ---- reveal on scroll ---- */
    var cards=$$('.card',shell);
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){
        es.forEach(function(e){if(e.isIntersecting){
          e.target.classList.add('in');io.unobserve(e.target);}});
      },{rootMargin:'0px 0px -8% 0px',threshold:0.04});
      cards.forEach(function(c){io.observe(c);});
    } else cards.forEach(function(c){c.classList.add('in');});

    /* ---- scroll-spy: active section + item + graph node ---- */
    var navSecs={},navItems={},graphNodes={};
    $$('.navsec',shell).forEach(function(a){navSecs[a.dataset.sec]=a;});
    $$('.navitem',shell).forEach(function(a){navItems[a.dataset.item]=a;});
    $$('.provnode',shell).forEach(function(g){graphNodes[g.dataset.node]=g;});
    function setActiveSection(id){
      $$('.navsec.active',shell).forEach(function(a){a.classList.remove('active');});
      if(navSecs[id]) navSecs[id].classList.add('active');
    }
    function setActiveItem(item){
      $$('.navitem.active',shell).forEach(function(a){a.classList.remove('active');});
      if(navItems[item]) navItems[item].classList.add('active');
      var node=$('.card[id="card-'+item+'"]',shell);
      var nodeId=node?node.dataset.node:'';
      $$('.provnode.active',shell).forEach(function(g){g.classList.remove('active');});
      $$('.provedge.lit',shell).forEach(function(p){p.classList.remove('lit');});
      if(nodeId&&graphNodes[nodeId]){
        graphNodes[nodeId].classList.add('active');
        $$('.provedge',shell).forEach(function(p){
          if(p.dataset.to===nodeId||p.dataset.from===nodeId)
            p.classList.add('lit');
        });
      }
    }
    if('IntersectionObserver' in window){
      var visible={};
      var spy=new IntersectionObserver(function(es){
        es.forEach(function(e){
          if(e.isIntersecting) visible[e.target.id]=e.intersectionRatio;
          else delete visible[e.target.id];
        });
        var bestC=null,bc=0;
        Object.keys(visible).forEach(function(k){
          if(k.indexOf('card-')===0&&visible[k]>=bc){bc=visible[k];bestC=k;}
        });
        if(bestC){
          var item=bestC.slice(5);
          setActiveItem(item);
          var card=$('.card[id="'+bestC+'"]',shell);
          var sec=card?card.closest('.section'):null;
          if(sec) setActiveSection(sec.dataset.sec);
        }
      },{rootMargin:'-12% 0px -55% 0px',threshold:[0,0.25,0.6,1]});
      cards.forEach(function(c){spy.observe(c);});
    }

    /* ---- nav links: resolve inside THIS shell (ids repeat across tabs) */
    var rail=$('.rail',shell);
    function closeRail(){
      if(rail) rail.classList.remove('open');
      if(scrim) scrim.classList.remove('show');
    }
    $$('.navsec,.navitem',shell).forEach(function(a){
      a.addEventListener('click',function(e){
        e.preventDefault();
        if(shell.classList.contains('raw')||shell.classList.contains('tree')){
          shell.classList.remove('raw');shell.classList.remove('tree');
          renderRawBtn();renderViewBtns();
        }
        var id=(a.getAttribute('href')||'').slice(1);
        var el=id?$('[id="'+id+'"]',shell):null;
        if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
        if(window.innerWidth<=860) closeRail();
      });
    });

    /* ---- graph node / dep chip -> scroll to card ---- */
    function gotoItem(itemId){
      var card=$('.card[id="card-'+itemId+'"]',shell);
      if(!card) return;
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},1400);
    }
    $$('.provnode',shell).forEach(function(g){
      function act(){gotoItem(g.dataset.target);}
      g.addEventListener('click',act);
      g.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});
    });
    /* .depchip lives inside a card -> wired in wireCardBehaviors so it also
       works on the Plot-trace tab's cloned cards */
    var rgBtn=$('.rg-collapse',shell);
    if(rgBtn) rgBtn.addEventListener('click',function(){
      var rg=rgBtn.closest('.railgraph');
      var c=rg.classList.toggle('collapsed');
      rgBtn.setAttribute('aria-expanded',(!c).toString());
      rgBtn.textContent=c?'+':'\u2013';
    });
    /* ---- per-card + per-section behaviours (code toggle, eyes, collapse,
       fig-fold, section collapse/hide incl. the nav chevrons): shared with
       the Plot-trace tab so the trace is a true subset of the docs ---- */
    wireCardBehaviors(shell,stem);
    wireAddNote(shell,stem);  /* app mode: pencil to add a markdown note */
    activateOutputs(shell);   /* run plotly/bokeh/vega + draw plotly specs */

    /* ---- register ---- */
    var replaced=!!APP.shells[stem];
    APP.shells[stem]={el:shell,data:data,path:shell.dataset.path||'',
      title:data.title||stem};
    if(APP.order.indexOf(stem)<0) APP.order.push(stem);
    applyFilters();
    applyCodeState(shell);   /* fold/hide code to match the current state */
    document.dispatchEvent(new CustomEvent('sem:shell',
      {detail:{stem:stem,el:shell,data:data,replaced:replaced}}));
    renderTabs();
    return stem;
  }

  /* ================= app mode: open / close / reload ================= */
  /* a refresh keeps YOUR VIEW: hidden cells/sections, collapsed sections,
     tree/raw mode and the scroll position carry over the shell swap
     (anchors + section ids are stable across re-parses) */
  function captureViewState(el){
    return {
      cellsOff:$$('.card.cell-off',el).map(function(c){
        return c.dataset.anchor;}).filter(Boolean),
      secsOff:$$('.section.sec-off',el).map(function(s2){
        return s2.dataset.sec;}).filter(Boolean),
      secsHeadOff:$$('.section.sec-headoff',el).map(function(s2){
        return s2.dataset.sec;}).filter(Boolean),
      secsClosed:$$('.section.sec-collapsed',el).map(function(s2){
        return s2.dataset.sec;}).filter(Boolean),
      tree:el.classList.contains('tree'),
      raw:el.classList.contains('raw'),
      scroll:window.scrollY||0
    };
  }
  function restoreViewState(shell,stem,keep){
    keep.cellsOff.forEach(function(an){
      var card=shell.querySelector(
        '.card[data-anchor="'+String(an).replace(/"/g,'\\"')+'"]');
      if(!card) return;
      card.classList.add('cell-off');
      var id=card.id.replace(/^card-/,'');
      var nav=shell.querySelector('.navitem[data-item="'+id+'"]');
      if(nav) nav.classList.add('cell-off');
    });
    keep.secsOff.forEach(function(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.add('sec-off');
      if(row) row.classList.add('sec-off');
    });
    (keep.secsHeadOff||[]).forEach(function(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.add('sec-headoff');
      if(row) row.classList.add('head-off');
    });
    keep.secsClosed.forEach(function(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      var items=shell.querySelector('.navitems[data-sec="'+sid+'"]');
      if(sec) sec.classList.add('sec-collapsed');
      if(row) row.classList.add('collapsed');
      if(items) items.classList.add('nav-collapsed');
    });
    recalcSecCascade(shell);   /* re-fold the tiers under restored state */
    if(keep.raw&&!keep.tree) shell.classList.add('raw');
    if(keep.tree){
      shell.classList.add('tree');
      var sh=APP.shells[stem];
      if(sh) buildTree(sh);
    }
    applyFilters();
    renderRawBtn();renderViewBtns();
    if(keep.tree) relayoutActiveTree();
  }
  /* ---- YOUR LAYOUT, remembered per notebook -------------------------
     Hidden cells, hidden/collapsed sections, tree-or-raw mode and the
     whole filter setup are kept against the notebook's PATH, so closing
     the browser and coming back finds the document as you left it. ---- */
  function viewKey(path){
    return 'junoview:layout:'+String(path||'');
  }
  /* "your whole view", as data: hidden cells and sections, hidden
     headings, collapsed sections, tree/raw, every filter (including the
     per-section ones) and the figure/text sizes. ONE function builds it,
     so the layout cache and a saved custom view can never drift apart. */
  function layoutSnapshot(stem){
    var sh=APP.shells[stem];
    if(!sh||!sh.el) return null;
    var st=captureViewState(sh.el);
    delete st.scroll;                   /* where you were is not layout */
    var pre=String(stem)+'::';
    st.def=FDEFof(stem);
    st.sec={};st.scope=[];
    for(var k in secF){
      if(k.indexOf(pre)===0) st.sec[k.slice(pre.length)]=secF[k];}
    for(var k2 in secScope){
      if(k2.indexOf(pre)===0&&secScope[k2])
        st.scope.push(k2.slice(pre.length));}
    /* the size you set on individual figures is part of your layout */
    st.figs={};
    $$('.card.has-fig',sh.el).forEach(function(c){
      var f=parseFloat(c.style.getPropertyValue('--fz'));
      if(f&&f!==1&&c.dataset.anchor) st.figs[c.dataset.anchor]=f;
    });
    /* the two feed-wide sizers are layout too — a setting that resets on
       every visit reads as a feature that was taken away */
    st.figall=APP.getFigAll?APP.getFigAll():1;
    st.mdall=APP.getMdAll?APP.getMdAll():1;
    st.v=1;
    return st;
  }
  function applySnapshot(shell,stem,st){
    if(!st) return false;
    /* the filter state first, so the one applyFilters below is enough */
    if(st.def) defBy[String(stem)]=cloneF(st.def);
    var pre=String(stem)+'::';
    for(var k in secF){if(k.indexOf(pre)===0) delete secF[k];}
    for(var k2 in secScope){if(k2.indexOf(pre)===0) delete secScope[k2];}
    Object.keys(st.sec||{}).forEach(function(sid){
      secF[pre+sid]=cloneF(st.sec[sid]);});
    if(Array.isArray(st.scope)&&st.scope.length){
      st.scope.forEach(function(sid){secScope[pre+sid]=1;});
      scopeSeeded[String(stem)]=1;
    }
    invalidateSids();
    if(APP.setFigAll) APP.setFigAll(st.figall||1);
    if(APP.setMdAll) APP.setMdAll(st.mdall||1);
    $$('.card.has-fig',shell).forEach(function(c){
      c.style.removeProperty('--fz');syncZoomed(c);});
    Object.keys(st.figs||{}).forEach(function(an){
      var c=shell.querySelector(
        '.card[data-anchor="'+String(an).replace(/"/g,'\\"')+'"]');
      if(!c) return;
      c.style.setProperty('--fz',st.figs[an]);
      syncZoomed(c);
    });
    restoreViewState(shell,stem,{
      cellsOff:st.cellsOff||[],secsOff:st.secsOff||[],
      secsHeadOff:st.secsHeadOff||[],
      secsClosed:st.secsClosed||[],tree:!!st.tree,raw:!!st.raw});
    return true;
  }
  APP.layoutSnapshot=layoutSnapshot;
  APP.applySnapshot=function(stem,st){
    var sh=APP.shells[stem];
    if(!sh||!sh.el) return false;
    /* a restore must CLEAR what the document is wearing now, or the old
       hidden cells/sections survive underneath the incoming view */
    $$('.card.cell-off',sh.el).forEach(function(c){
      c.classList.remove('cell-off');});
    $$('.section',sh.el).forEach(function(s2){
      s2.classList.remove('sec-off','sec-headoff','sec-collapsed');});
    $$('.navsec-row',sh.el).forEach(function(r){
      r.classList.remove('sec-off','head-off','collapsed');});
    $$('.navitems',sh.el).forEach(function(n){
      n.classList.remove('nav-collapsed');});
    $$('.navitem.cell-off',sh.el).forEach(function(n){
      n.classList.remove('cell-off');});
    sh.el.classList.remove('tree','raw');
    return applySnapshot(sh.el,stem,st);
  };
  function saveLayout(stem){
    try{
      var sh=APP.shells[stem];
      if(!sh||!sh.el||sh.trace) return;
      /* a static export has no path — fall back to the notebook's name so
         the layout still sticks for that page */
      var key=sh.path||('stem:'+stem);
      var st=layoutSnapshot(stem);
      if(!st) return;
      localStorage.setItem(viewKey(key),JSON.stringify(st));
    }catch(e){}
  }
  var saveT=null;
  function scheduleSaveLayout(){
    clearTimeout(saveT);
    saveT=setTimeout(function(){
      if(!APP.active) return;
      saveLayout(APP.active);
      /* a custom view IS this snapshot plus its styling, so every filter
         or hide you change while editing one belongs to it */
      if(APP.syncStylingView) APP.syncStylingView();
    },400);
  }
  APP.scheduleSaveLayout=scheduleSaveLayout;
  function loadLayout(shell,stem,path){
    var st=null;
    try{
      var raw=localStorage.getItem(viewKey(path));
      if(raw) st=JSON.parse(raw);
    }catch(e){}
    if(!st||st.v!==1) return false;
    return applySnapshot(shell,stem,st);
  }
  /* ================= CUSTOM VIEW: styling the document =================
     A custom view is a saved, restyled, filtered view of ONE notebook. It
     is edited in the document itself, so what you see is what it is.

     Every property maps to an inherited CSS variable, which is what buys
     the cascade the user asked for: stamp it on .nbshell and it styles
     every markdown cell; stamp it on a .section and that section wins;
     stamp it on a .card and that one cell wins. "Override individual
     styles" is then just deleting the narrower entries. ------------- */
  var STY=null,styView=null,styOnChange=null,styTarget=null;
  var MD_PROPS=[
    {k:'col',v:'--md-col',t:'color',lab:'Text colour'},
    {k:'size',v:'--md-size',t:'num',lab:'Text size',
      d:1,min:0.6,max:2.4,step:0.05,pct:1},
    {k:'lh',v:'--md-lh',t:'num',lab:'Line height',
      d:1.65,min:1.1,max:2.4,step:0.05},
    {k:'bg',v:'--md-bg',t:'color',lab:'Background'},
    {k:'bd',v:'--md-bd',t:'color',lab:'Border colour'},
    {k:'bw',v:'--md-bw',t:'px',lab:'Border width',d:1,min:0,max:6,step:1},
    {k:'rad',v:'--md-rad',t:'px',lab:'Corner radius',
      d:10,min:0,max:28,step:1},
    {k:'pad',v:'--md-pad',t:'px',lab:'Padding',d:18,min:2,max:44,step:1},
    {k:'font',v:'--md-font',t:'font',lab:'Font'},
    {k:'align',v:'--md-align',t:'align',lab:'Alignment'}
  ];
  var HD_PROPS=[
    {k:'hcol',v:'--hd-col',t:'color',lab:'Heading colour'},
    {k:'hsize',v:'--hd-size',t:'num',lab:'Heading size',
      d:1,min:0.6,max:2.4,step:0.05,pct:1},
    {k:'hwt',v:'--hd-wt',t:'weight',lab:'Weight'},
    {k:'hfont',v:'--hd-font',t:'font',lab:'Font'},
    {k:'hcaps',v:'--hd-caps',t:'caps',lab:'Capitals'},
    {k:'hbg',v:'--hd-bg',t:'color',lab:'Background'},
    {k:'hbd',v:'--hd-bd',t:'color',lab:'Rule colour'},
    {k:'hbw',v:'--hd-bw',t:'px',lab:'Rule width',d:1,min:0,max:8,step:1},
    {k:'haccent',v:'--hd-accent',t:'color',lab:'Accent ("section N")'},
    {k:'heyebrow',v:'--hd-eyebrow',t:'show',lab:'Show "section N"'}
  ];
  var DOC_PROPS=[
    {k:'paper',v:'--vw-bg',t:'color',lab:'Page background'},
    {k:'gap',v:'--vw-gap',t:'px',lab:'Space between cells',
      d:14,min:0,max:48,step:1}
  ];
  var FONTS=[['','Default'],['var(--serif)','Serif'],
             ['var(--sans)','Sans'],['var(--mono)','Mono']];
  var ALIGNS=[['','Default'],['start','Left'],['center','Centre'],
              ['end','Right'],['justify','Justified']];
  var WEIGHTS=[['','Default'],['400','Regular'],['500','Medium'],
               ['600','Semibold'],['700','Bold']];
  function cssVal(p,val){
    if(p.t==='px') return String(val)+'px';
    if(p.t==='caps') return val?'uppercase':'none';
    if(p.t==='show') return val?'block':'none';
    return String(val);
  }
  function stamp(el,obj,props){
    props.forEach(function(p){
      var v=obj?obj[p.k]:null;
      if(v===undefined||v===null||v==='') el.style.removeProperty(p.v);
      else el.style.setProperty(p.v,cssVal(p,v));
    });
  }
  function ALLPROPS(){return MD_PROPS.concat(HD_PROPS).concat(DOC_PROPS);}
  function styShell(){
    /* a custom view belongs to ONE notebook: style that one, whatever tab
       happens to be in front, so switching tabs can never bleed a view's
       styling onto a different notebook */
    var stem=(styView&&styView.nb)||APP.active;
    var sh=APP.shells[stem];
    return (sh&&sh.el&&!sh.trace)?sh.el:null;
  }
  function countNarrow(){
    var S=STY||{};
    return Object.keys(S.sec||{}).length+Object.keys(S.cell||{}).length;
  }
  function cellsInSection(sid){
    var el=styShell(); if(!el) return [];
    var sec=el.querySelector('.section[data-sec="'+sid+'"]');
    if(!sec) return [];
    return [].map.call(sec.querySelectorAll('.card[data-note="1"]'),
      function(c){return c.dataset.anchor;}).filter(Boolean);
  }
  function applyViewStyle(){
    var el=styShell(); if(!el) return;
    var S=STY||{};
    stamp(el,S.all,MD_PROPS);
    stamp(el,S.head,HD_PROPS);
    stamp(el,S.doc,DOC_PROPS);
    $$('.section',el).forEach(function(s2){
      var o=(S.sec||{})[s2.dataset.sec];
      stamp(s2,o,MD_PROPS);stamp(s2,o,HD_PROPS);
    });
    $$('.card[data-note="1"]',el).forEach(function(c){
      stamp(c,(S.cell||{})[c.dataset.anchor],MD_PROPS);
    });
    markStyOwn();
  }
  function clearStamps(){
    var el=styShell(); if(!el) return;
    var props=ALLPROPS();
    [el].concat([].slice.call(el.querySelectorAll(
      '.section,.card[data-note="1"]'))).forEach(function(n){
      props.forEach(function(p){n.style.removeProperty(p.v);});
    });
  }
  /* a target wearing its OWN style is marked, so "Override individual
     styles" is never a blind action */
  function markStyOwn(){
    var el=styShell(); if(!el) return;
    var S=STY||{};
    $$('.sty-btn',el).forEach(function(b){
      var own=b.dataset.styKind==='sec'
        ?!!(S.sec||{})[b.dataset.styId]
        :!!(S.cell||{})[b.dataset.styId];
      b.classList.toggle('sty-own',own);
      b.textContent=own?'styled':'style';
    });
    var ov=$('#sb-override');
    if(ov){
      var n=countNarrow();
      ov.hidden=!n;
      ov.textContent='Override '+n+' individual style'+(n===1?'':'s');
    }
  }
  function ensureStyBtns(){
    var el=styShell(); if(!el) return;
    $$('.card[data-note="1"]',el).forEach(function(c){
      if(c.querySelector(':scope > .sty-btn')) return;
      var b=document.createElement('button');
      b.className='sty-btn';b.type='button';b.textContent='style';
      b.dataset.styKind='cell';b.dataset.styId=c.dataset.anchor||'';
      b.title='Style just this markdown cell';
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'cell',id:b.dataset.styId},b);
      });
      c.appendChild(b);
    });
    $$('.sectionhead',el).forEach(function(h){
      if(h.querySelector(':scope > .sty-btn')) return;
      var sec=h.closest('.section'); if(!sec) return;
      var b=document.createElement('button');
      b.className='sty-btn';b.type='button';b.textContent='style';
      b.dataset.styKind='sec';b.dataset.styId=sec.dataset.sec||'';
      b.title='Style this section — its heading and its markdown cells';
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'sec',id:b.dataset.styId},b);
      });
      h.insertBefore(b,h.querySelector('.sec-eye')||null);
    });
  }
  function dropStyBtns(){
    $$('.sty-btn').forEach(function(b){b.remove();});
    $$('.sty-sel').forEach(function(n){n.classList.remove('sty-sel');});
  }
  function styModelFor(t){
    var S=STY||{};
    if(t.kind==='all') return S.all||(S.all={});
    if(t.kind==='head') return S.head||(S.head={});
    if(t.kind==='doc') return S.doc||(S.doc={});
    if(t.kind==='sec'){
      S.sec=S.sec||{};return S.sec[t.id]||(S.sec[t.id]={});}
    S.cell=S.cell||{};return S.cell[t.id]||(S.cell[t.id]={});
  }
  function styPropsFor(t){
    if(t.kind==='head') return HD_PROPS;
    if(t.kind==='doc') return DOC_PROPS;
    if(t.kind==='sec') return MD_PROPS.concat(HD_PROPS);
    return MD_PROPS;
  }
  function styTitleFor(t){
    if(t.kind==='all') return 'every markdown cell';
    if(t.kind==='head') return 'every heading';
    if(t.kind==='doc') return 'the page';
    if(t.kind==='sec'){
      var el=styShell();
      var h=el&&el.querySelector(
        '.section[data-sec="'+t.id+'"] .sectionhead h2');
      return 'section “'+((h&&h.textContent)||t.id)+'”';
    }
    var el2=styShell();
    var c=el2&&el2.querySelector(
      '.card[data-anchor="'+String(t.id).replace(/"/g,'\\"')+'"]');
    var ct=c&&c.querySelector('.cardtitle');
    return 'the cell “'+((ct&&ct.textContent.trim())||t.id)+'”';
  }
  function styDirty(){
    applyViewStyle();
    if(styView&&styOnChange){
      styView.style=STY;
      styOnChange();
    }
  }
  function closeStyPanel(){
    var p=$('#stylepanel');
    if(p){p.hidden=true;p.innerHTML='';}
    styTarget=null;
    $$('.sty-sel').forEach(function(n){n.classList.remove('sty-sel');});
    ['#sb-md','#sb-hd','#sb-doc'].forEach(function(s){
      var b=$(s); if(b) b.setAttribute('aria-pressed','false');});
  }
  function openStyPanel(t,anchor){
    var p=$('#stylepanel'); if(!p||!STY) return;
    closeStyPanel();
    styTarget=t;
    if(p.parentNode!==document.body) document.body.appendChild(p);
    var model=styModelFor(t),props=styPropsFor(t);
    var h=document.createElement('div');h.className='sp-h';
    h.textContent='style '+(t.kind==='all'?'all markdown'
      :t.kind==='head'?'all headings':t.kind==='doc'?'page':t.kind);
    p.appendChild(h);
    var sub=document.createElement('div');sub.className='sp-sub';
    sub.textContent='Applies to '+styTitleFor(t)+'.';
    p.appendChild(sub);
    props.forEach(function(pr){
      var row=document.createElement('div');row.className='sp-row';
      var lab=document.createElement('span');lab.className='sp-rl';
      lab.textContent=pr.lab;row.appendChild(lab);
      var val=model[pr.k];
      if(pr.t==='color'){
        var ci=document.createElement('input');ci.type='color';
        ci.value=/^#/.test(String(val||''))?val:'#3fa9c4';
        ci.addEventListener('input',function(){
          model[pr.k]=ci.value;styDirty();});
        row.appendChild(ci);
        var cx=document.createElement('button');cx.className='toggle';
        cx.type='button';cx.textContent='clear';
        cx.style.height='24px';cx.style.padding='0 8px';
        cx.addEventListener('click',function(){
          delete model[pr.k];styDirty();openStyPanel(t,anchor);});
        row.appendChild(cx);
      } else if(pr.t==='num'||pr.t==='px'){
        var r=document.createElement('input');r.type='range';
        r.min=pr.min;r.max=pr.max;r.step=pr.step;
        r.value=(val==null||val==='')?pr.d:val;
        var out=document.createElement('span');out.className='sp-val';
        var show=function(v){
          out.textContent=pr.pct?Math.round(v*100)+'%'
            :(pr.t==='px'?v+'px':Number(v).toFixed(2));};
        show(r.value);
        r.addEventListener('input',function(){
          var v=pr.t==='px'?parseInt(r.value,10):parseFloat(r.value);
          model[pr.k]=v;show(v);styDirty();});
        row.appendChild(r);row.appendChild(out);
      } else {
        var sel=document.createElement('select');
        var opts=pr.t==='font'?FONTS:pr.t==='align'?ALIGNS
          :pr.t==='weight'?WEIGHTS
          :[['','Default'],['1','Yes'],['0','No']];
        opts.forEach(function(o){
          var op=document.createElement('option');
          op.value=o[0];op.textContent=o[1];sel.appendChild(op);});
        sel.value=(val==null||val==='')?'':String(val);
        sel.addEventListener('change',function(){
          if(sel.value==='') delete model[pr.k];
          else model[pr.k]=(pr.t==='caps'||pr.t==='show')
            ?(sel.value==='1'?1:0):sel.value;
          styDirty();});
        row.appendChild(sel);
      }
      p.appendChild(row);
    });
    /* the override action, scoped to what this panel edits */
    var narrow=t.kind==='all'||t.kind==='head'?countNarrow()
      :t.kind==='sec'?cellsInSection(t.id).filter(function(a){
        return !!(STY.cell||{})[a];}).length:0;
    if(narrow){
      var w=document.createElement('div');w.className='sp-warn';
      w.textContent=narrow+' item'+(narrow===1?'':'s')+' inside this '
        +'still carry their own style, so they ignore what you set here.';
      p.appendChild(w);
      var ob=document.createElement('button');ob.className='toggle';
      ob.type='button';ob.style.width='100%';
      ob.textContent='Override those '+narrow+' individual style'
        +(narrow===1?'':'s');
      ob.addEventListener('click',function(){
        if(t.kind==='sec'){
          cellsInSection(t.id).forEach(function(a){
            if(STY.cell) delete STY.cell[a];});
        } else {STY.sec={};STY.cell={};}
        styDirty();openStyPanel(t,anchor);
      });
      p.appendChild(ob);
    }
    var btns=document.createElement('div');btns.className='sp-btns';
    var clr=document.createElement('button');clr.className='toggle';
    clr.type='button';clr.textContent='Clear this style';
    clr.addEventListener('click',function(){
      if(t.kind==='sec'&&STY.sec) delete STY.sec[t.id];
      else if(t.kind==='cell'&&STY.cell) delete STY.cell[t.id];
      else if(t.kind==='all') STY.all={};
      else if(t.kind==='head') STY.head={};
      else if(t.kind==='doc') STY.doc={};
      styDirty();closeStyPanel();
    });
    var done=document.createElement('button');
    done.className='toggle primary';done.type='button';
    done.textContent='Close';
    done.addEventListener('click',closeStyPanel);
    btns.appendChild(clr);btns.appendChild(done);
    p.appendChild(btns);
    p.hidden=false;
    /* place it under whatever opened it, clamped to the window */
    var r2=(anchor||$('#sb-md')).getBoundingClientRect();
    var pr2=p.getBoundingClientRect();
    p.style.top=Math.min(r2.bottom+7,
      Math.max(8,window.innerHeight-pr2.height-8))+'px';
    p.style.left=Math.max(8,
      Math.min(r2.left,window.innerWidth-pr2.width-8))+'px';
    if(t.kind==='sec'||t.kind==='cell'){
      var el3=styShell();
      var node=t.kind==='sec'
        ?el3.querySelector('.section[data-sec="'+t.id+'"] .sectionhead')
        :el3.querySelector('.card[data-anchor="'
          +String(t.id).replace(/"/g,'\\"')+'"]');
      if(node) node.classList.add('sty-sel');
    }
    var bmap={all:'#sb-md',head:'#sb-hd',doc:'#sb-doc'};
    if(bmap[t.kind]){
      var bb=$(bmap[t.kind]);
      if(bb) bb.setAttribute('aria-pressed','true');
    }
  }
  APP.enterStyling=function(view,onChange){
    if(!view) return false;
    styView=view;
    STY=view.style||(view.style={});
    styOnChange=onChange||null;
    document.body.classList.add('styling');
    var b=$('#stylebar'); if(b) b.hidden=false;
    var n=$('#sb-name'); if(n) n.textContent=view.name||'';
    ensureStyBtns();
    applyViewStyle();
    measureChrome();
    return true;
  };
  APP.exitStyling=function(){
    if(!STY) return;
    closeStyPanel();
    clearStamps();
    dropStyBtns();
    STY=null;styView=null;styOnChange=null;
    document.body.classList.remove('styling');
    var b=$('#stylebar'); if(b) b.hidden=true;
    measureChrome();
  };
  APP.stylingView=function(){return styView;};
  APP.syncStylingView=function(){
    if(!styView||!styOnChange||!APP.active) return;
    var snap=layoutSnapshot(APP.active);
    if(!snap) return;
    styView.view=snap;
    styView.nb=APP.active;
    styOnChange();
  };
  (function(){
    var md=$('#sb-md'),hd=$('#sb-hd'),dc=$('#sb-doc');
    if(md) md.addEventListener('click',function(){
      openStyPanel({kind:'all',id:''},md);});
    if(hd) hd.addEventListener('click',function(){
      openStyPanel({kind:'head',id:''},hd);});
    if(dc) dc.addEventListener('click',function(){
      openStyPanel({kind:'doc',id:''},dc);});
    var ov=$('#sb-override');
    if(ov) ov.addEventListener('click',function(){
      if(!STY) return;
      STY.sec={};STY.cell={};styDirty();closeStyPanel();});
    var rs=$('#sb-reset');
    if(rs) rs.addEventListener('click',function(){
      if(!STY) return;
      STY.all={};STY.head={};STY.doc={};STY.sec={};STY.cell={};
      styDirty();closeStyPanel();});
    /* clicking the BODY of a markdown cell or a heading styles that one
       (real controls — chevrons, eyes, links — still do their own job) */
    document.addEventListener('click',function(e){
      if(!STY) return;
      var p=$('#stylepanel');
      if(p&&!p.hidden&&p.contains(e.target)) return;
      if(e.target.closest('.stylebar')) return;
      if(e.target.closest('button,a,input,select,textarea')) return;
      var card=e.target.closest('.card[data-note="1"]');
      if(card){
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'cell',id:card.dataset.anchor||''},card);
        return;
      }
      var head=e.target.closest('.sectionhead');
      if(head){
        var sec=head.closest('.section');
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'sec',id:(sec&&sec.dataset.sec)||''},head);
        return;
      }
      if(p&&!p.hidden) closeStyPanel();
    },true);
    /* a refresh re-mounts the shell: re-stamp and re-hang the buttons */
    document.addEventListener('sem:shell',function(){
      if(!STY) return;
      ensureStyBtns();applyViewStyle();
    });
  })();
  function mountShellHTML(htmlStr,path,quiet){
    var host=$('#docs');
    var tmp=document.createElement('div');
    tmp.innerHTML=htmlStr;
    var shell=tmp.querySelector('.nbshell');
    if(!shell){alert('Open failed: bad response');return;}
    if(path) shell.dataset.path=path;
    var stem=shell.dataset.nb;
    var old=APP.shells[stem];
    var keep=(old&&old.el)?captureViewState(old.el):null;
    /* a reload replaces the notebook's cards — its Plot-trace tabs now hold
       stale clones, so close them (a fresh trace re-clones the new cards) */
    if(old) APP.traces.slice().forEach(function(k){
      if(APP.shells[k]&&APP.shells[k].source===stem) closeNotebook(k);
    });
    if(old&&old.el.parentNode) host.replaceChild(shell,old.el);
    else host.appendChild(shell);
    initShell(shell);
    invalidateSids();   /* this notebook's sections were just replaced */
    /* a reload keeps the live view; a fresh open restores the layout you
       last left this notebook in */
    if(keep) restoreViewState(shell,stem,keep);
    else loadLayout(shell,stem,
      path||shell.dataset.path||('stem:'+stem));
    /* a VERSION of a notebook you already have open is not a new
       document — it must not turn up in Recent as a separate file */
    if(path&&!quiet&&APP.noteRecent) APP.noteRecent(path);
    activate(stem);
    if(keep&&keep.scroll){
      window.scrollTo(0,keep.scroll);
      /* once more after images/math settle the layout */
      setTimeout(function(){window.scrollTo(0,keep.scroll);},150);
    }
    if(window.MathJax&&MathJax.typesetPromise)
      MathJax.typesetPromise([shell]).catch(function(){});
  }
  APP.mountShellHTML=mountShellHTML;
  /* ---- "Plot trace" opens in its OWN TAB: a genuine subset of the docs
     holding just this plot's lineage cells + the dependency graph. The tab
     is a real .nbshell, so every global filter and per-card control works
     inside it exactly as it does in the full document. ---- */
  function traceGoto(itemId){
    /* the graph lives inside the active trace tab — scroll to a step there */
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh||!sh.el) return;
    var card=sh.el.querySelector('.card[id="card-'+itemId+'"]');
    if(card){card.scrollIntoView({block:'center'});
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},1200);}
  }
  APP.traceGoto=traceGoto;
  function openTraceTab(stem,ids,title,graph,anchor){
    var src=APP.shells[stem];
    if(!src||!src.el) return;
    var key='trace::'+stem+'::'
      +(anchor||(ids&&ids.length&&ids[ids.length-1])||title||'plot');
    if(APP.shells[key]){          /* already open — just bring it forward */
      activate(key);return key;
    }
    /* clone the lineage cards in DOCUMENT order (a true subset of the docs) */
    var want={};(ids||[]).forEach(function(i){want[i]=1;});
    var section=document.createElement('section');
    section.className='section';
    $$('.content .card',src.el).forEach(function(card){
      var id=card.id.replace(/^card-/,'');
      if(want[id]) section.appendChild(card.cloneNode(true));
    });
    if(!section.children.length){        /* nothing matched: show the plot */
      var only=src.el.querySelector('.content .card');
      if(only) section.appendChild(only.cloneNode(true));
    }
    /* clones: drop per-cell eyes (no way back) and add-note pencils (their
       listeners don't survive cloneNode; notes belong on the source tab) */
    $$('.cell-eye,.card-addnote',section).forEach(function(b){
      if(b.parentNode) b.parentNode.removeChild(b);});
    $$('.card.cell-off',section).forEach(function(c){
      c.classList.remove('cell-off');});
    /* cards default to opacity:0 and are revealed by initShell's scroll
       observer; the trace tab is a deliberate, fully-shown subset and has no
       such observer, so force every clone visible up front */
    $$('.card',section).forEach(function(c){c.classList.add('in');});
    var shell=document.createElement('div');
    shell.className='shell nbshell tracetab';
    shell.dataset.nb=key;
    shell.dataset.src=stem;   /* the real notebook a placed clone resolves to */
    /* the lineage items actually present (covers the fallback case too) —
       they power the sidebar nav and the Tree view of this trace */
    var haveIds={};
    $$('.card',section).forEach(function(c){
      haveIds[c.id.replace(/^card-/,'')]=1;});
    var lineage=((src.data&&src.data.items)||[]).filter(function(it){
      return haveIds[it.card];});
    /* a real sidebar, so the ☰ sections toggle works here like in a
       notebook tab: one nav entry per lineage step */
    var KCLS={figure:'k-figure',diagnostic:'k-figure',dataset:'k-dataset',
      transform:'k-transform',metric:'k-metric',text:'k-print',
      note:'k-note',code:'k-code'};
    var rail=document.createElement('aside');rail.className='rail';
    var rh=document.createElement('div');rh.className='railhead';
    var rt=document.createElement('h1');rt.className='railtitle';
    rt.textContent=title||'Plot trace';
    var rmeta=document.createElement('div');rmeta.className='railmeta';
    rmeta.textContent=lineage.length+' steps · from '+stem;
    rh.appendChild(rt);rh.appendChild(rmeta);rail.appendChild(rh);
    var nav=document.createElement('nav');nav.className='nav';
    nav.setAttribute('aria-label','Plot lineage');
    lineage.forEach(function(it){
      var a=document.createElement('a');
      var kc=KCLS[it.kind]||'k-code';
      if(kc!=='k-figure'&&it.codeKinds
         &&(it.codeKinds.length!==1||it.codeKinds[0]!=='code'))
        kc+=' ckmain-'+it.codeKind;
      a.className='navitem '+kc;
      a.href='#card-'+it.card;
      var d=document.createElement('span');d.className='dot';
      var t=document.createElement('span');t.className='navitem-t';
      t.textContent=it.title;
      a.appendChild(d);a.appendChild(t);
      nav.appendChild(a);
    });
    nav.addEventListener('click',function(e){
      var a=e.target.closest?e.target.closest('.navitem'):null;
      if(!a) return;
      e.preventDefault();
      var id=(a.getAttribute('href')||'').slice(1);
      var el=id?shell.querySelector('[id="'+id+'"]'):null;
      if(el){el.scrollIntoView({behavior:'smooth',block:'center'});
        el.classList.add('target-flash');
        setTimeout(function(){el.classList.remove('target-flash');},1200);}
    });
    rail.appendChild(nav);
    shell.appendChild(rail);
    var stage=document.createElement('main');stage.className='stage';
    var content=document.createElement('div');content.className='content';
    var head=document.createElement('div');head.className='tracetab-head';
    var eb=document.createElement('span');eb.className='tracetab-eyebrow';
    eb.textContent='plot trace';
    var h=document.createElement('h2');h.className='tracetab-t';
    h.textContent=title||'Plot trace';
    var sub=document.createElement('span');sub.className='tracetab-sub';
    sub.textContent='the cells that build this plot, from '+stem;
    head.appendChild(eb);head.appendChild(h);head.appendChild(sub);
    /* view switcher IN the header: the same lineage as a readable LIST of
       cells or as an expandable dependency TREE (columns by step). The
       appbar's Tree button does the same, but here it's discoverable. */
    var vsw=document.createElement('div');vsw.className='trace-viewsw';
    var bList=document.createElement('button');
    bList.className='dbtn tvw';bList.type='button';
    bList.innerHTML='&#9776; Cells';
    bList.title='The lineage as a readable list of cells';
    var bTree=document.createElement('button');
    bTree.className='dbtn tvw';bTree.type='button';
    bTree.innerHTML='&#9633; Tree';
    bTree.title='The lineage as an expandable dependency tree — columns '
      +'by step, click a node to open the cell';
    function syncVsw(){
      var on=shell.classList.contains('tree');
      bList.classList.toggle('on',!on);
      bTree.classList.toggle('on',on);
    }
    function setTraceView(tree){
      if(shell.classList.contains('tree')===tree){syncVsw();return;}
      if(window.SemView&&window.SemView.tree) window.SemView.tree();
      else shell.classList.toggle('tree');
      syncVsw();
    }
    bList.addEventListener('click',function(){setTraceView(false);});
    bTree.addEventListener('click',function(){setTraceView(true);});
    vsw.appendChild(bList);vsw.appendChild(bTree);
    syncVsw();
    try{      /* the appbar Tree button toggles too — stay in sync */
      new MutationObserver(syncVsw)
        .observe(shell,{attributes:true,attributeFilter:['class']});
    }catch(e){}
    head.appendChild(vsw);
    content.appendChild(head);
    if(graph){var gw=document.createElement('div');
      gw.className='tracetab-graph';gw.appendChild(graph);
      content.appendChild(gw);}
    content.appendChild(section);
    stage.appendChild(content);
    /* an (initially empty) tree host so Tree view works on this trace */
    var tv=document.createElement('div');tv.className='treeview';
    tv.setAttribute('aria-label','Analysis tree view');
    stage.appendChild(tv);
    shell.appendChild(stage);
    var host=$('#docs')||document.body;
    host.appendChild(shell);
    /* wire the clones so their code toggles, eyes, collapse + fig-fold work */
    wireCardBehaviors(shell,stem);
    activateOutputs(shell,true);   /* draw plotly specs on the clones */
    APP.shells[key]={el:shell,
      data:{stem:stem,items:lineage},   /* subset: feeds buildTree */
      path:'',title:title||'Plot trace',
      trace:true,source:stem};
    if(APP.traces.indexOf(key)<0) APP.traces.push(key);
    activate(key);
    applyFilters();
    applyCodeState(shell);   /* fold/hide code to match the current state */
    var c=shell.querySelector('.content'); if(c) c.scrollTop=0;
    window.scrollTo(0,0);
    return key;
  }
  APP.openTraceTab=openTraceTab;
  /* one open per source at a time: repeated Enter/clicks are ignored
     while the fetch runs, and the dialog shows a loading bar */
  var OPENBUSY={},dlgBusyN=0;
  function setDlgBusy(b){
    /* counter, not flag: several sources can load at once and the
       dialog stays locked until the last one settles */
    dlgBusyN=Math.max(0,dlgBusyN+(b?1:-1));
    var on=dlgBusyN>0;
    var go=$('#odlg-go'),inp=$('#odlg-input'),ld=$('#odlg-load');
    if(go){go.disabled=on;go.textContent=on?'Opening…':'Open';}
    if(inp) inp.disabled=on;
    if(ld) ld.hidden=!on;
  }
  function openPath(path){
    if(APP.mode==='web'){
      if(isUrl(path)) webOpenUrl(path,false);
      return;
    }
    if(OPENBUSY[path]) return;
    OPENBUSY[path]=1;setDlgBusy(true);
    api('/api/open',{path:path}).then(function(j){
      delete OPENBUSY[path];setDlgBusy(false);
      mountShellHTML(j.shell,j.path||path);
      hideDlg();
    }).catch(function(e){
      delete OPENBUSY[path];setDlgBusy(false);
      alert('Open failed: '+e.message);});
  }
  APP.openPath=openPath;
  function closeNotebook(stem){
    var sh=APP.shells[stem]; if(!sh) return;
    /* closing a notebook also closes any Plot-trace tabs derived from it */
    if(!sh.trace) APP.traces.slice().forEach(function(k){
      if(APP.shells[k]&&APP.shells[k].source===stem) closeNotebook(k);
    });
    if(sh.el.parentNode) sh.el.parentNode.removeChild(sh.el);
    delete APP.shells[stem];
    /* drop this notebook's filter state — otherwise it lingers forever and
       a later notebook with the same stem reopens pre-filtered */
    var pre=String(stem)+'::';
    delete defBy[String(stem)];delete scopeSeeded[String(stem)];
    [secF,secScope,scopeOpen].forEach(function(m){
      for(var k in m){if(k.indexOf(pre)===0) delete m[k];}
    });
    var list=sh.trace?APP.traces:APP.order;
    var i=list.indexOf(stem);
    if(i>=0) list.splice(i,1);
    if(APP.active===stem){
      APP.active=null;
      /* closing a trace tab returns to its source notebook; otherwise fall
         back to the last remaining notebook (or trace) tab */
      var back=(sh.trace&&APP.shells[sh.source])?sh.source
        :(APP.order[APP.order.length-1]||APP.traces[APP.traces.length-1]);
      if(back) activate(back); else {renderRawBtn();renderViewBtns();}
    }
    renderTabs();
    if(sh.trace) return;   /* a trace tab is not a notebook — no teardown */
    document.dispatchEvent(new CustomEvent('sem:shellclosed',
      {detail:{stem:stem}}));
    if(APP.mode==='app'&&sh.path)
      api('/api/close',{path:sh.path}).catch(function(){});
    if(APP.mode==='web'&&sh.path) webUnnote(sh.path);
  }

  /* ================= web mode (Pyodide, fully client-side) ============ */
  var WEBKEY='semweb:'+location.pathname;
  function isUrl(s){return /^https?:\/\//i.test(String(s||''));}
  function normNbUrl(u){
    u=String(u||'').trim();
    var m=u.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|raw)\/(.+)$/);
    if(m) return 'https://raw.githubusercontent.com/'
      +m[1]+'/'+m[2]+'/'+m[3];
    return u;
  }
  function webReady(){return !!window.semPy;}
  function webParseText(name,text){
    if(!webReady()){
      alert('Python is still loading — try again in a moment.');
      return;
    }
    try{
      var shell=window.semPy.parse(name,text,APP.order);
      mountShellHTML(shell,'');
      hideDlg();
    }catch(e){
      alert('Could not open '+name+': '+((e&&e.message)||e));
    }
  }
  function webOpenFiles(files){
    Array.prototype.slice.call(files||[])
      .filter(function(f){return /\.ipynb$/i.test(f.name);})
      .forEach(function(f){
        f.text().then(function(txt){webParseText(f.name,txt);});
      });
  }
  function webOpenUrl(url,silent){
    url=normNbUrl(url);
    var pend=OPENBUSY[url];
    if(pend){
      /* already loading; a real click on a silently-restoring URL
         surfaces the busy UI instead of dying quietly */
      if(!silent&&pend.s){pend.s=false;setDlgBusy(true);}
      return;
    }
    pend=OPENBUSY[url]={s:silent};
    if(!silent) setDlgBusy(true);
    function done(){delete OPENBUSY[url];if(!pend.s) setDlgBusy(false);}
    /* GitHub's raw CDN caches for minutes: bust its cache key on every
       (re)fetch so a refresh sees the latest commit immediately */
    var fu=url;
    if(/^https?:\/\/[^\/]*githubusercontent\.com\//i.test(url))
      fu=url+(url.indexOf('?')<0?'?':'&')+'jvr='+Date.now();
    fetch(fu,{cache:'no-store'}).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.text();
    }).then(function(txt){
      if(!webReady()) throw new Error('Python is still loading');
      var name=decodeURIComponent(
        url.split('?')[0].split('/').pop()||'notebook.ipynb');
      /* reloading: exclude the tab that already holds this URL from the
         "taken" names so the parser reproduces its stem and we REPLACE
         that tab in place instead of minting a new one */
      var taken=APP.order.filter(function(s){
        return !(APP.shells[s]&&APP.shells[s].path===url);});
      var shell=window.semPy.parse(name,txt,taken);
      mountShellHTML(shell,url);
      webNote(url);
      done();
      hideDlg();
    }).catch(function(e){
      var wasSilent=pend.s;
      done();
      if(wasSilent){
        webUnnote(url);
        return;
      }
      alert('Could not fetch '+url+'\n'+((e&&e.message)||e)
        +'\nIf that host blocks cross-site requests, download the '
        +'file and drop it here instead.');
    });
  }
  function webNote(url){
    try{
      var rec=JSON.parse(localStorage.getItem(WEBKEY+':recent')||'[]');
      rec=[url].concat(rec.filter(function(r){return r!==url;}))
        .slice(0,6);
      localStorage.setItem(WEBKEY+':recent',JSON.stringify(rec));
      var open=JSON.parse(localStorage.getItem(WEBKEY+':open')||'[]');
      if(open.indexOf(url)<0) open.push(url);
      localStorage.setItem(WEBKEY+':open',JSON.stringify(open));
      APP.project.recent=rec;
      renderRecent();
    }catch(e){}
  }
  function webUnnote(url){
    try{
      var open=JSON.parse(localStorage.getItem(WEBKEY+':open')||'[]');
      localStorage.setItem(WEBKEY+':open',
        JSON.stringify(open.filter(function(u){return u!==url;})));
    }catch(e){}
  }

  /* ================= open dialog (server file browser) ================= */
  var dlg=$('#opendlg'), dlgList=$('#odlg-list'), dlgPath=$('#odlg-path');
  var dlgDir='';
  function hideDlg(){if(dlg) dlg.hidden=true;}
  /* remembered files: name-over-path, reopen anything you've had open */
  function splitPath(p){
    var s=String(p||'');
    var parts=s.split(/[\/\\]/);
    var nm=parts[parts.length-1]||s;
    nm=nm.split('?')[0].split('#')[0];
    try{nm=decodeURIComponent(nm);}catch(e){}
    return {name:nm||s, path:s};
  }
  function renderDlgRecent(){
    var host=$('#odlg-recent'); if(!host) return;
    host.innerHTML='';
    var rec=(APP.project&&APP.project.recent)||[];
    if(!rec.length){host.hidden=true;return;}
    host.hidden=false;
    var h=document.createElement('div');h.className='odlg-recent-h';
    h.textContent='recent — reopen';host.appendChild(h);
    rec.slice(0,12).forEach(function(p){
      var sp=splitPath(p);
      var b=document.createElement('button');b.className='odlg-r';
      b.title='Reopen '+sp.path;
      var nm=document.createElement('span');nm.className='odlg-r-nm';
      nm.textContent=sp.name;b.appendChild(nm);
      var pt=document.createElement('span');pt.className='odlg-r-p';
      pt.textContent=sp.path;pt.dir='ltr';b.appendChild(pt);
      b.addEventListener('click',function(){openPath(p);});
      host.appendChild(b);
    });
  }
  APP.noteRecent=function(p){
    /* app mode: keep the client's recent list live as tabs open (the
       server persists it too); web mode uses webNote */
    if(!p||APP.mode!=='app') return;
    var rec=(APP.project&&APP.project.recent)||[];
    rec=[p].concat(rec.filter(function(r){return r!==p;})).slice(0,12);
    APP.project.recent=rec;
    renderRecent();
  };
  function showDlg(){
    if(!dlg) return;
    dlg.hidden=false;
    renderDlgRecent();
    var inp=$('#odlg-input'); if(inp) inp.value='';
    var up=$('#odlg-up'), fb=$('#odlg-files');
    if(APP.mode==='web'){
      if(up) up.hidden=true;
      if(fb) fb.hidden=false;
      if(dlgPath) dlgPath.textContent='Open notebooks';
      if(inp) inp.placeholder='…or paste a notebook URL '
        +'(GitHub links work) and hit Open';
      dlgList.innerHTML='<div class="odlg-empty">Drop .ipynb files '
        +'anywhere in the window, use &#8220;Choose files&#8230;&#8221;, '
        +'or paste a URL below.<br><br>Everything runs in your browser '
        +'&#8212; notebooks are never uploaded anywhere.</div>';
      return;
    }
    if(inp) inp.placeholder='…or paste a folder, .ipynb path or URL '
      +'and hit Open';
    listDir(dlgDir||APP.root||'');
  }
  function listDir(dir){
    api('/api/list?dir='+encodeURIComponent(dir||'')).then(function(j){
      dlgDir=j.dir;
      dlgPath.textContent=j.dir;dlgPath.title=j.dir;
      var up=$('#odlg-up');
      up.disabled=!j.parent;up.dataset.parent=j.parent||'';
      dlgList.innerHTML='';
      if(!j.dirs.length&&!j.notebooks.length)
        dlgList.innerHTML='<div class="odlg-empty">'
          +'No folders or notebooks here.</div>';
      j.dirs.forEach(function(d){
        var b=document.createElement('button');b.className='odlg-i';
        b.innerHTML='<span class="ic">&#128193;</span>';
        var nm=document.createElement('span');nm.className='nm';
        nm.textContent=d.name;b.appendChild(nm);
        b.addEventListener('click',function(){listDir(d.path);});
        dlgList.appendChild(b);
      });
      j.notebooks.forEach(function(n){
        var b=document.createElement('button');b.className='odlg-i nb';
        b.innerHTML='<span class="ic">&#128209;</span>';
        var nm=document.createElement('span');nm.className='nm';
        nm.textContent=n.name;b.appendChild(nm);
        var sz=document.createElement('span');sz.className='sz';
        sz.textContent=n.size||'';b.appendChild(sz);
        b.addEventListener('click',function(){openPath(n.path);});
        dlgList.appendChild(b);
      });
    }).catch(function(e){
      dlgList.innerHTML='';
      var d=document.createElement('div');d.className='odlg-empty';
      d.textContent=String(e.message);
      dlgList.appendChild(d);
    });
  }
  function renderRecent(){
    var host=$('#welcome-recent'); if(!host) return;
    host.innerHTML='';
    var rec=(APP.project&&APP.project.recent)||[];
    if(!rec.length) return;
    var h=document.createElement('div');h.className='recent-h';
    h.textContent='recent';host.appendChild(h);
    rec.slice(0,6).forEach(function(p){
      var b=document.createElement('button');b.className='recent-i';
      b.textContent=p;b.title=p;
      b.addEventListener('click',function(){openPath(p);});
      host.appendChild(b);
    });
  }

  if(APP.mode==='app'||APP.mode==='web'){
    var isWeb=(APP.mode==='web');
    if(openBtn) openBtn.addEventListener('click',showDlg);
    var wOpen=$('#welcome-open');
    if(wOpen) wOpen.addEventListener('click',showDlg);
    /* same dialog, but landed on the URL path: paste a GitHub link */
    var wUrl=$('#welcome-url');
    if(wUrl) wUrl.addEventListener('click',function(){
      showDlg();
      var inp2=$('#odlg-input');
      if(inp2) setTimeout(function(){inp2.focus();},50);
    });
    var up=$('#odlg-up');
    if(up&&!isWeb) up.addEventListener('click',function(){
      if(up.dataset.parent) listDir(up.dataset.parent);});
    var filesBtn=$('#odlg-files'), fileInput=$('#fileinput');
    if(filesBtn) filesBtn.addEventListener('click',function(){
      if(fileInput) fileInput.click();});
    if(fileInput) fileInput.addEventListener('change',function(){
      webOpenFiles(this.files);this.value='';});
    var cl=$('#odlg-close');
    if(cl) cl.addEventListener('click',hideDlg);
    if(dlg) dlg.addEventListener('click',function(e){
      if(e.target===dlg) hideDlg();});
    var inp=$('#odlg-input');
    function submitOpenInput(){
      if(!inp||inp.disabled) return;
      var v=inp.value.trim(); if(!v) return;
      if(isWeb){
        if(isUrl(v)) webOpenUrl(v,false);
        else alert('Paste an http(s) link to a .ipynb file, or use '
          +'Choose files / drag-and-drop.');
        return;
      }
      if(isUrl(v)||/\.ipynb$/i.test(v)) openPath(v);
      else listDir(v);
    }
    if(inp) inp.addEventListener('keydown',function(e){
      if(e.key!=='Enter') return;
      submitOpenInput();
    });
    var goBtn=$('#odlg-go');
    if(goBtn) goBtn.addEventListener('click',submitOpenInput);
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&dlg&&!dlg.hidden) hideDlg();
    });

    /* ---- drag & drop .ipynb anywhere on the window ---- */
    var hint=$('#drophint'), dragDepth=0;
    window.addEventListener('dragover',function(e){e.preventDefault();});
    window.addEventListener('dragenter',function(e){
      e.preventDefault();dragDepth++;
      if(hint) hint.hidden=false;
    });
    window.addEventListener('dragleave',function(){
      dragDepth=Math.max(0,dragDepth-1);
      if(!dragDepth&&hint) hint.hidden=true;
    });
    window.addEventListener('drop',function(e){
      e.preventDefault();dragDepth=0;
      if(hint) hint.hidden=true;
      var files=Array.prototype.slice.call(
        (e.dataTransfer||{}).files||[]);
      files.filter(function(f){return /\.ipynb$/i.test(f.name);})
        .forEach(function(f){
          if(isWeb){
            f.text().then(function(txt){webParseText(f.name,txt);});
            return;
          }
          f.text().then(function(txt){
            return api('/api/parse',{name:f.name,nb:txt});
          }).then(function(j){mountShellHTML(j.shell,j.path||'');})
          .catch(function(err){
            alert('Could not open '+f.name+': '+err.message);});
        });
    });
  }
  if(APP.mode==='web'){
    var demoBtn=$('#welcome-demo');
    if(demoBtn) demoBtn.addEventListener('click',function(){
      webOpenUrl('example_climate_analysis.ipynb',false);
    });
    try{
      APP.project.recent=JSON.parse(
        localStorage.getItem(WEBKEY+':recent')||'[]');
    }catch(e){}
    /* reopen last session's URL notebooks once Python is up */
    document.addEventListener('sem:pyready',function(){
      var open=[];
      try{open=JSON.parse(
        localStorage.getItem(WEBKEY+':open')||'[]');}catch(e){}
      open.forEach(function(u){webOpenUrl(u,true);});
    });
  }

  /* ================= boot: mount shells already on the page ============ */
  $$('.nbshell').forEach(function(sh){initShell(sh);});
  if(APP.order.length) activate(APP.order[0]);
  else renderTabs();
  renderRawBtn();
})();
"""

# --------------------------------------------------------------------------
# Presentation deck (Present mode + PowerPoint-style builder)
# --------------------------------------------------------------------------

_MATHJAX = r"""<script>
window.MathJax = {
  tex: {inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]},
  options: {skipHtmlTags: ['script','noscript','style','textarea','pre','code']}
};
</script>
<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>"""

_DECK_HTML = """
<div class="deck" id="deck" hidden>
  <div class="deck-top">
    <button class="dbtn" id="deck-docs"
      title="Back to the document view">Docs</button>
    <span class="deck-spring"></span>
    <button class="dbtn" id="deck-exit"
      title="Stop presenting and go back to the slide builder (Esc).
 Nothing is closed or lost.">&#8617; Back</button>
  </div>
  <div class="deck-main">
    <aside class="deck-create" id="deck-create" hidden>
      <div class="dc-resize" id="dc-resize"
        title="Drag to resize the builder panel"></div>
      <div class="dc-head">
        <div class="dc-menuwrap">
          <button class="dbtn" id="dc-file" aria-haspopup="true"
            aria-expanded="false">File &#9662;</button>
          <div class="dc-menu" id="dc-menu" hidden>
            <button class="dc-mi" id="mi-new">New presentation</button>
            <button class="dc-mi" id="mi-rename">Rename&#8230;</button>
            <div class="dc-msep"></div>
            <button class="dc-mi" id="mi-auto-figs">Auto-build: figures</button>
            <button class="dc-mi" id="mi-auto-figdocs">Auto-build: figures + docs</button>
            <div class="dc-msep"></div>
            <button class="dc-mi" id="mi-nums">Slide numbers: off</button>
            <div class="dc-msep"></div>
            <button class="dc-mi" id="mi-save">Save to notebook&#8230;</button>
            <button class="dc-mi" id="mi-autosave" hidden></button>
            <button class="dc-mi" id="mi-pdf">Export PDF / print&#8230;</button>
            <button class="dc-mi" id="mi-dl">Download a copy
              (.junoview)</button>
            <button class="dc-mi" id="mi-load">Open a .junoview
              file&#8230;</button>
            <button class="dc-mi" id="mi-discard">Discard changes</button>
            <button class="dc-mi" id="mi-del">Delete presentation</button>
          </div>
        </div>
        <button class="dbtn" id="dc-save">Save</button>
        <span class="dc-menuwrap">
          <button class="dbtn dc-target" id="dc-target" aria-haspopup="true"
            aria-expanded="false"
            title="Where this presentation is saved">
            Saved to: Browser &#9662;</button>
          <div class="dc-menu" id="target-menu" hidden>
            <div class="dc-mhead">where this presentation is saved</div>
            <button class="dc-mi" id="tg-project" hidden>This project</button>
            <button class="dc-mi" id="tg-browser">This browser</button>
            <button class="dc-mi" id="tg-file">A file on your
              computer&#8230;</button>
            <div class="dc-msep"></div>
            <button class="dc-mi" id="tg-pick" hidden>Choose a different
              file&#8230;</button>
          </div>
        </span>
        <button class="dbtn dc-icon" id="dc-undo" disabled
          title="Undo (Ctrl+Z)" aria-label="Undo">&#8630;</button>
        <button class="dbtn dc-icon" id="dc-redo" disabled
          title="Redo (Ctrl+Shift+Z)" aria-label="Redo">&#8631;</button>
        <span class="dc-spring"></span>
        <span class="deck-status" id="deck-status"></span>
      </div>
      <div class="dc-block dc-controls">
        <div class="dc-presname" id="pres-current" hidden></div>
        <input id="pres-name" type="text" placeholder="presentation name"
          spellcheck="false" autocomplete="off" hidden>
        <button class="dbtn" id="dc-edit"
          title="Swap to the slide editor — add text, arrows and boxes">
          &#9998; Swap to edit view</button>
        <div class="lay-picker" id="layout-row"
          aria-label="Slide layouts"></div>
        <div class="title-editor" id="title-editor" hidden>
          <input id="ts-title" type="text" placeholder="Slide title"
            spellcheck="false" autocomplete="off">
          <input id="ts-sub" type="text" placeholder="Subtitle (optional)"
            spellcheck="false" autocomplete="off">
        </div>
      </div>
      <div class="dc-block dc-film">
        <div class="film-list" id="film-list"></div>
        <button class="dbtn addslide" id="film-add">+ Add slide</button>
      </div>
    </aside>
    <div class="deck-stagewrap" id="deck-stagewrap">
      <div class="edit-tools ribbon" id="edit-tools" hidden>
        <div class="rbn-static">
          <span class="rbn-grp">
            <span class="rbn-row">
              <button class="dbtn primary" id="dc-play"
                title="Play the presentation full screen (from this slide)">
                &#9654; Present</button>
            </span>
            <span class="rbn-lab">Show</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <div class="dc-menuwrap">
                <button class="dbtn" id="dc-nbs-btn" aria-haspopup="true"
                  aria-expanded="false"
                  title="Notebooks that went into this presentation">&#128218;
                  Open notebooks</button>
                <div class="dc-menu dc-nbs-menu" id="dc-nbs-menu" hidden></div>
              </div>
            </span>
            <span class="rbn-lab">Notebooks</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <span class="sh-drop" id="lay-drop">
                <button class="dbtn" id="lay-btn" aria-haspopup="true"
                  aria-expanded="false"
                  title="Slide templates &mdash; apply a layout to this
 slide">&#9638; Layouts &#9662;</button>
                <div class="sh-menu lay-menu" id="lay-menu" hidden>
                  <div class="lay-picker" id="layout-menu-grid"
                    aria-label="Slide layouts"></div>
                </div>
              </span>
              <span class="sh-drop" id="page-drop">
                <button class="dbtn" id="page-btn" aria-haspopup="true"
                  aria-expanded="false"
                  title="Page size &mdash; slides (16:9, 4:3) or a poster
 (A4&ndash;A0, portrait or landscape)">&#9645; Page &#9662;</button>
                <div class="sh-menu page-menu" id="page-menu" hidden></div>
              </span>
              <button class="dbtn etm" id="zoom-out"
                title="Zoom out">&#8722;</button>
              <button class="dbtn etm" id="zoom-val"
                title="Zoom &mdash; click to fit the window">Fit</button>
              <button class="dbtn etm" id="zoom-in"
                title="Zoom in">+</button>
              <button class="dbtn" id="objects-btn" aria-pressed="false"
                title="Objects pane &mdash; list, hide and lock everything
 on this slide">&#9776; Objects</button>
            </span>
            <span class="rbn-lab">Slide</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <button class="dbtn et" data-tool="cell" aria-pressed="false"
                title="Drop a notebook card onto the slide — you pick which
 one from your notebook">&#43; Notebook cell</button>
              <button class="dbtn et" data-tool="text" aria-pressed="false">
                + Text</button>
              <button class="dbtn et" data-tool="arrow"
                aria-pressed="false">+ Arrow</button>
              <span class="sh-drop" id="sh-drop">
                <button class="dbtn" id="sh-btn" aria-haspopup="true"
                  aria-expanded="false"
                  title="Draw a shape (rectangle, ellipse, arrow, star, …)">
                  + Shapes &#9662;</button>
                <div class="sh-menu" id="sh-menu" hidden></div>
              </span>
              <button class="dbtn" id="et-image"
                title="Add an image from your computer">&#128443; Image</button>
              <input type="file" id="img-file" accept="image/*" hidden>
            </span>
            <span class="rbn-lab">Insert</span>
          </span>
        </div>
        <span class="et-fmt" id="et-fmt" hidden>
          <span class="rbn-grp">
            <span class="rbn-row">
              <button class="dbtn etm" id="fmt-dup"
                title="Duplicate (Ctrl+D)">&#10697;</button>
              <button class="dbtn etm" id="fmt-group"
                title="Group the selected items (Ctrl+G)">&#9783;
                Group</button>
              <button class="dbtn etm" id="fmt-ungroup"
                title="Ungroup (Ctrl+Shift+G)">Ungroup</button>
              <button class="dbtn etm" id="fmt-front"
                title="Bring to front">&#8613;</button>
              <button class="dbtn etm" id="fmt-back"
                title="Send to back">&#8615;</button>
              <button class="dbtn etm" id="fmt-rotl"
                title="Rotate left 15&#176;">&#10226;</button>
              <button class="dbtn etm" id="fmt-rotr"
                title="Rotate right 15&#176;">&#10227;</button>
              <button class="dbtn etm" id="fmt-arline"
                title="Arrange the selected items in a row: middles aligned, equal gaps"
                >&#8943; Row</button>
              <button class="dbtn etm" id="fmt-argrid"
                title="Arrange the selected items in a grid">&#8862;
                Grid</button>
              <span class="sh-drop" id="fmt-samewrap" hidden>
                <button class="dbtn etm" id="fmt-same" aria-haspopup="true"
                  aria-expanded="false"
                  title="Make the selected items the same size">&#9713;
                  Same size &#9662;</button>
                <div class="sh-menu same-menu" id="fmt-same-menu"
                  hidden></div>
              </span>
            </span>
            <span class="rbn-lab">Arrange</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <span class="fmt-opwrap" id="fmt-opwrap"
                title="Opacity (0&ndash;100%)">
                <input class="fmt-range" id="fmt-op" type="range"
                  min="0" max="100" step="1" aria-label="Opacity percent">
                <span class="fmt-opval" id="fmt-opval">100%</span></span>
              <span class="sh-drop" id="fmt-animwrap" hidden>
                <button class="dbtn etm" id="fmt-anim" aria-haspopup="true"
                  aria-expanded="false"
                  title="Animate this item so it appears on click">&#9654;
                  Animate &#9662;</button>
                <div class="sh-menu" id="fmt-anim-menu" hidden></div>
              </span>
            </span>
            <span class="rbn-lab">Effects</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <span class="fmt-lab" id="fmt-txlab" hidden
                title="Text colour">Text</span>
              <button class="sw" data-c="#ff6b57"
                style="background:#ff6b57" title="Coral"></button>
              <button class="sw" data-c="#f0a848"
                style="background:#f0a848" title="Amber"></button>
              <button class="sw" data-c="#39a9c0"
                style="background:#39a9c0" title="Cyan"></button>
              <button class="sw" data-c="#46a892"
                style="background:#46a892" title="Green"></button>
              <button class="sw" data-c="#ffffff"
                style="background:#ffffff" title="White"></button>
              <button class="sw" data-c="#16202b"
                style="background:#16202b" title="Ink"></button>
              <button class="sw sw-custom" id="sw-custom" data-target="text"
                title="Custom colour — hex, rgb or rgba"></button>
              <span class="fmt-lab" id="fmt-bglab" hidden
                title="Fill / background colour">Fill</span>
              <button class="sw swbg trans" data-c="none" hidden
                title="Transparent box"></button>
              <button class="sw swbg" data-c="#0e1926" hidden
                style="background:#0e1926" title="Dark box"></button>
              <button class="sw swbg" data-c="#ffffff" hidden
                style="background:#ffffff" title="White box"></button>
              <button class="sw swbg" data-c="#ff6b57" hidden
                style="background:#ff6b57" title="Coral box"></button>
              <button class="sw swbg" data-c="#f0a848" hidden
                style="background:#f0a848" title="Amber box"></button>
              <button class="sw swbg" data-c="#39a9c0" hidden
                style="background:#39a9c0" title="Cyan box"></button>
              <button class="sw swbg sw-custom" id="swbg-custom" hidden
                data-target="fill"
                title="Custom fill colour — hex, rgb or rgba"></button>
            </span>
            <span class="rbn-lab">Colour</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <button class="dbtn etm" id="fmt-smaller"
                title="Smaller text">A&#8722;</button>
              <button class="dbtn etm" id="fmt-bigger"
                title="Bigger text">A+</button>
              <span class="fmt-szwrap" id="fmt-szwrap" hidden
                title="Text size (points)">
                <input class="fmt-num" id="fmt-size" type="number"
                  min="6" max="240" step="1"
                  aria-label="Text size in points">
                <span class="fmt-unit">pt</span></span>
              <select class="etm" id="fmt-font" hidden title="Text font">
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Mono</option>
                <option value="system">System</option>
                <option value="hand">Hand</option>
              </select>
              <button class="dbtn etm" id="fmt-bold"
                title="Bold"><b>B</b></button>
              <button class="dbtn etm" id="fmt-ital"
                title="Italic"><i>I</i></button>
              <button class="dbtn etm" id="fmt-under"
                title="Underline"><u>U</u></button>
              <button class="dbtn etm" id="fmt-strike"
                title="Strikethrough"><s>S</s></button>
              <button class="dbtn etm" id="fmt-align"
                title="Text alignment (click to cycle)">&#9636; Left</button>
              <button class="dbtn etm" id="fmt-list"
                title="Bullet list (Enter adds a point)">&#8226; List</button>
            </span>
            <span class="rbn-lab">Text</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <button class="dbtn etm" id="fmt-line"
                title="Cycle line thickness">Line</button>
              <button class="dbtn etm" id="fmt-dash"
                title="Dashed on/off">Dash</button>
              <button class="dbtn etm" id="fmt-fill"
                title="Fill on/off">Fill</button>
              <button class="dbtn etm" id="fmt-shape"
                title="Cycle the shape (rectangle, ellipse, star, …)">
                &#9711;</button>
            </span>
            <span class="rbn-lab">Shape</span>
          </span>
          <span class="rbn-grp">
            <span class="rbn-row">
              <span class="rbn-partslot" id="fmt-parts" hidden></span>
              <span class="sh-drop" id="fmt-cropwrap" hidden>
                <button class="dbtn etm" id="fmt-crop" aria-haspopup="true"
                  aria-expanded="false"
                  title="Crop to a shape (rectangle, ellipse, star, …)">
                  &#9986; Crop &#9662;</button>
                <div class="sh-menu" id="fmt-crop-menu" hidden></div>
              </span>
              <button class="dbtn etm" id="fmt-replace"
                title="Swap in a different notebook card">&#8644;
                Replace</button>
              <button class="dbtn etm" id="fmt-locate"
                title="Jump to this card in its notebook &mdash; see where
 the plot came from">&#8982; Locate in notebook</button>
              <button class="dbtn etm" id="fmt-revert"
                title="Swap this frame between the LIVE figure and the one
 from before the last notebook refresh (rescue a figure a re-run
 broke without giving up the others)">&#10226; Previous figure</button>
              <button class="dbtn etm" id="fmt-lockver"
                title="Pin this figure to its notebook&rsquo;s current git
 commit &mdash; refreshes stop changing it, and it renders even with the
 notebook closed">&#128274; Lock figure</button>
            </span>
            <span class="rbn-lab">Object</span>
          </span>
        </span>
        <span class="et-hint" id="et-hint"></span>
      </div>
      <aside class="selpane" id="selpane" hidden>
        <div class="selpane-h"><span>Objects</span>
          <button class="dbtn dc-icon" id="selpane-close"
            title="Close">&#10005;</button></div>
        <div class="selpane-list" id="selpane-list"></div>
      </aside>
      <button class="deck-arrow prev" id="deck-prev"
        title="Previous slide (&#8592;)"
        aria-label="Previous slide">&#8249;</button>
      <div class="deck-stage" id="deck-stage"></div>
      <button class="deck-arrow next" id="deck-next"
        title="Next slide (&#8594;)"
        aria-label="Next slide">&#8250;</button>
      <button class="deck-arrow up" id="deck-up" hidden
        title="Back to the slide (&#8593;)"
        aria-label="Back up to the slide">&#8593;</button>
      <button class="deck-codepill" id="deck-down" hidden
        title="Scroll down to the code trace (&#8595;)"
        aria-label="Show the code trace that made this slide">
        <span class="cp-arr">&#8595;</span> Show code</button>
      <span class="deck-count" id="deck-count"></span>
    </div>
  </div>
  <div class="vfull" id="vfull" hidden>
    <div class="vfull-head">
      <span class="chain-badge" id="vfull-badge"></span>
      <span class="vfull-t" id="vfull-t"></span>
      <button class="dbtn" id="vfull-close"
        title="Close (Esc)">&#10005; Close</button>
    </div>
    <div class="vfull-body" id="vfull-body"></div>
  </div>
  <div class="deck-toast" id="deck-toast" hidden></div>
</div>
<div class="pickbar" id="pickbar" hidden>
  <span>&#128204; Click a card in the notebook to place it in the
  slide</span>
  <span class="deck-spring"></span>
  <button class="dbtn" id="pick-cancel">Cancel (Esc)</button>
</div>
<div class="color-pop" id="color-pop" hidden>
  <div class="cp-head" id="cp-head">Custom colour</div>
  <input type="color" id="cp-native" class="cp-native" value="#39a9c0"
    aria-label="Pick a colour">
  <div class="cp-row">
    <span class="cp-lab">Hex</span>
    <input type="text" id="cp-hex" class="cp-in" spellcheck="false"
      autocomplete="off" placeholder="#39a9c0" maxlength="9">
  </div>
  <div class="cp-row">
    <span class="cp-lab">RGB</span>
    <input type="text" id="cp-rgb" class="cp-in" spellcheck="false"
      autocomplete="off" placeholder="rgba(57, 169, 192, 1)">
  </div>
  <div class="cp-row cp-arow">
    <span class="cp-lab">Alpha</span>
    <input type="range" id="cp-alpha" class="cp-alpha" min="0" max="100"
      step="1" value="100" aria-label="Opacity">
    <span class="cp-aval" id="cp-aval">100%</span>
  </div>
  <div class="cp-recent" id="cp-recent"></div>
  <div class="cp-foot">
    <span class="cp-preview" id="cp-preview"></span>
    <span class="deck-spring"></span>
    <button class="dbtn cp-apply" id="cp-apply">Apply</button>
  </div>
</div>
"""

_DECK_CSS = r"""
.deck{position:fixed;inset:0;z-index:100;background:#0b141d;color:#dce6ee;
  display:flex;flex-direction:column;font-family:var(--sans);}
.deck[hidden]{display:none!important;}
.deck [hidden]:not(.et-fmt){display:none!important;}
body.deck-open{overflow:hidden;}

.deck-top{display:flex;align-items:center;gap:9px;padding:10px 18px;
  border-bottom:1px solid #ffffff14;background:#0e1926;flex:none;}
.deck-brand{font-family:var(--mono);font-size:10.5px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--cyan);}
.deck-status{font-family:var(--mono);font-size:10px;padding:0 10px;
  height:30px;box-sizing:border-box;display:inline-flex;align-items:center;
  border-radius:15px;background:#ffffff12;color:#9fb2c2;letter-spacing:.04em;
  white-space:nowrap;}
.deck-status.draft{background:#cf9a4e26;color:#e6b877;}
.deck-status.saved{background:#46a89226;color:#7fd0bd;}
.deck-status:empty{display:none;}
.deck-spring{flex:1;}
.dbtn{font-family:var(--mono);font-size:11px;border:1px solid #ffffff22;
  background:#ffffff0a;color:#cdd9e3;padding:6px 11px;border-radius:6px;
  cursor:pointer;transition:all .15s;}
.dbtn:hover{border-color:var(--cyan);color:#fff;}
.dbtn.primary{background:var(--cyan);border-color:var(--cyan);color:#fff;
  font-weight:600;box-shadow:0 0 0 1px #39a9c066,0 2px 12px #39a9c066;}
.dbtn.primary:hover{background:#4bbcd2;border-color:#4bbcd2;
  box-shadow:0 0 0 1px #39a9c088,0 2px 16px #39a9c088;}
.dbtn[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
.deck-save{display:flex;gap:7px;align-items:center;}

.deck-main{flex:1;display:flex;min-height:0;}
.deck-stagewrap{flex:1;display:flex;flex-direction:column;min-width:0;
  position:relative;}
.deck-stage{flex:1;min-height:0;display:flex;padding:26px 78px 6px;
  overflow:hidden;}

/* editing: the slide is a real bounded page surface (16:9 by default —
   the Page dropdown can make it 4:3 or a poster), so you can see exactly
   where things will sit when presented */
.deck.editing .deck-stage{align-items:center;justify-content:center;
  padding:18px 26px 10px;}
.deck.editing .slide{flex:none;width:100%;max-height:100%;
  aspect-ratio:var(--page-ar,16/9);margin:auto;background:#0b141d;
  border:2px solid #ffffff2b;border-radius:12px;
  box-shadow:0 14px 60px #00000066,inset 0 0 0 1px #00000055;}
/* zoomed past the window: the stage scrolls, content anchors top-left
   (margin:auto still centers it while it fits) */
.deck.editing .deck-stage.zoomed{overflow:auto;
  align-items:flex-start;justify-content:flex-start;}
/* a custom page (poster / portrait) letterboxes in playback too */
.deck.custom-page .vpage{display:flex;}
/* the Page dropdown menu */
.sh-menu.page-menu{display:block;width:252px;padding:6px;}
.page-menu .page-opt{display:block;width:100%;text-align:left;}
.page-menu .page-opt[aria-pressed="true"]{color:#fff;
  background:var(--cyan-deep);border-radius:6px;}
/* the Objects pane: everything on the slide — select, hide, lock */
.selpane{position:absolute;top:8px;right:8px;bottom:8px;width:232px;
  z-index:60;background:#101c28f2;border:1px solid #ffffff22;
  border-radius:10px;display:flex;flex-direction:column;
  box-shadow:0 14px 44px #00000066;}
.selpane[hidden]{display:none;}
.selpane-h{display:flex;align-items:center;justify-content:space-between;
  padding:8px 8px 7px 12px;font-family:var(--mono);font-size:10px;
  letter-spacing:.14em;text-transform:uppercase;color:#7e93a4;
  border-bottom:1px solid #ffffff14;}
.selpane-list{flex:1;overflow-y:auto;padding:5px;}
.selpane-empty{color:#54677a;font-size:12px;padding:12px;}
.sp-row{display:flex;align-items:center;gap:7px;
  border-radius:7px;padding:6px 7px;color:#c9d6e2;font-size:12px;
  cursor:pointer;}
.sp-row:hover{background:#ffffff0c;}
.sp-row.sel{background:#39a9c022;color:#fff;}
.sp-row.offrow .sp-t{opacity:.45;text-decoration:line-through;}
.sp-kind{flex:none;width:8px;height:8px;border-radius:2px;
  background:#8ba0b2;}
.sp-kind.k-cell{background:var(--cyan);}
.sp-kind.k-text{background:#f0a848;}
.sp-kind.k-rect,.sp-kind.k-arrow{background:#ff6b57;}
.sp-kind.k-image{background:#46a892;}
.sp-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
.sp-act{flex:none;background:none;border:none;color:#5f7386;
  cursor:pointer;font-size:12px;padding:1px 3px;border-radius:4px;
  line-height:1;}
.sp-act:hover{color:#fff;background:#ffffff14;}
.sp-act.on{color:var(--cyan);}
body.light .selpane{background:#fffffff5;border-color:var(--line);}
body.light .sp-row{color:var(--ink-2);}
body.light .sp-row.sel{background:#39a9c022;color:var(--ink);}
body.light .sp-act:hover{color:var(--ink);background:#00000010;}
/* locked objects: visible but untouchable on the canvas */
.deck.editing .an-locked,.deck.editing .an-locked *{
  pointer-events:none!important;cursor:default!important;}

/* vertical "code trail": each slide can descend into the cells that
   made it (down arrow / ArrowDown), one step per screen */
.vstack{flex:1;min-width:0;display:flex;flex-direction:column;
  transition:transform .35s ease;}
.vslide{flex:none;height:100%;display:flex;min-height:0;min-width:0;}
.vslide.vstep{padding:10px 0 4px;}
.vstep-in{flex:1;display:flex;flex-direction:column;min-height:0;
  min-width:0;background:#0e1926;border:1px solid #ffffff10;
  border-radius:12px;padding:16px 20px;}
.vstep-head{display:flex;align-items:center;gap:10px;flex:none;
  margin-bottom:10px;min-width:0;}
.vstep-t{font-size:15px;font-weight:600;color:#dbe7ef;flex:1;
  min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
.vstep-n{font-family:var(--mono);font-size:10.5px;color:#7e93a4;
  flex:none;}
.vstep-body{flex:1;min-height:0;overflow:auto;}
.vstep-none{color:#7e93a4;font-size:13px;}
.vstep-thumb{flex:none;height:34px;max-width:56px;object-fit:contain;
  border-radius:5px;background:#fff;padding:2px;}

/* the trace map: minimised, numbered steps grouped per plot, arranged
   like the plots on the slide; colours tie group <-> plot */
.vslide.voverview{padding:10px 0 4px;}
.vo-in{flex:1;display:flex;flex-direction:column;min-height:0;
  min-width:0;gap:12px;}
.vo-title{flex:none;font-family:var(--mono);font-size:10.5px;
  letter-spacing:.18em;text-transform:uppercase;color:#7e93a4;
  text-align:center;display:flex;gap:10px;align-items:center;
  justify-content:center;flex-wrap:wrap;}
/* match the docs top-bar toggles so the trail feels part of the same tool */
.vo-xall,.vo-fbtn{font-family:var(--mono);font-size:11px;letter-spacing:.04em;
  text-transform:none;background:#ffffff0a;border:1px solid #ffffff22;
  color:#cdd9e3;border-radius:var(--rad);padding:6px 12px;cursor:pointer;
  display:inline-flex;align-items:center;gap:7px;transition:all .15s;}
.vo-xall:hover,.vo-fbtn:hover{border-color:var(--cyan);color:#fff;}
/* the trail's Code-types / Output-types filter dropdowns */
.vo-fdrop{position:relative;display:inline-block;}
.vo-fmenu{position:absolute;top:calc(100% + 5px);left:0;z-index:40;
  background:#16273a;border:1px solid #ffffff22;border-radius:8px;padding:5px;
  min-width:150px;display:flex;flex-direction:column;text-align:left;
  box-shadow:0 12px 34px #00000077;}
.vo-fmenu[hidden]{display:none;}
.vo-fmenu .ckf-row{display:flex;align-items:center;gap:8px;padding:5px 8px;
  border-radius:5px;cursor:pointer;color:#dce6ee;font-size:12px;
  font-family:var(--sans);text-transform:none;letter-spacing:0;}
.vo-fmenu .ckf-row:hover{background:#39a9c022;}
.vo-step.vo-filtered{display:none;}
.vo-plots{flex:none;display:flex;gap:16px;justify-content:center;
  flex-wrap:wrap;}
.vo-plot{display:flex;flex-direction:column;align-items:center;gap:6px;
  padding:9px 11px;border-radius:10px;background:#0e1926;
  border:2px solid #ffffff22;}
.vo-plot img{max-height:11vh;max-width:16vw;width:auto;height:auto;
  object-fit:contain;border-radius:6px;background:#fff;padding:2px;}
.vo-plot-t{font-size:11px;color:#dbe7ef;max-width:16vw;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.vo-groups{flex:1;min-height:0;display:flex;gap:14px;}
.vo-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;
  border:1.5px solid #ffffff1f;border-radius:12px;padding:11px;
  overflow:auto;background:#0e1926;}
.vo-col-h{flex:none;font-size:12.5px;font-weight:600;color:#dbe7ef;
  display:flex;align-items:center;gap:8px;min-width:0;}
.vo-col-h span{overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
/* section (## heading) + subsection (### heading) dividers in the trace */
.vo-sec{font-family:var(--mono);font-size:10px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:#dbe7ef;
  padding:8px 2px 4px;margin-top:6px;
  border-bottom:1px solid #ffffff1f;
  display:flex;align-items:center;gap:7px;}
.vo-col>.vo-sec:first-of-type,.vo-col-h+.vo-sec{margin-top:0;}
/* section collapse chevron + hide eye (mirror the docs sidebar/section head) */
.vo-sec-chev{flex:none;font-size:11px;line-height:1;color:#7e93a4;
  cursor:pointer;transition:transform .15s,color .15s;}
.vo-sec-chev:hover{color:#cdd9e3;}
.vo-sec.collapsed .vo-sec-chev{transform:rotate(-90deg);}
.vo-sec-lab{flex:1;min-width:0;cursor:pointer;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.vo-sec-eye{flex:none;font-size:11px;line-height:1;color:#7e93a4;
  cursor:pointer;opacity:0;padding:1px 4px;border-radius:4px;
  transition:opacity .12s,color .12s,background .12s;}
.vo-sec:hover .vo-sec-eye{opacity:.65;}
.vo-sec-eye:hover{opacity:1;color:#fff;background:#ffffff14;}
.vo-sec-body{display:flex;flex-direction:column;gap:8px;}
.vo-sec-body.vo-sec-fold{display:none;}
.vo-subsec{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;
  color:#8ba0b2;padding:5px 2px 2px;}
.vo-step{display:flex;flex-direction:column;background:#12202e;
  border:1px solid #ffffff14;border-radius:8px;overflow:hidden;
  flex:none;min-width:0;transition:border-color .15s;}
.vo-step-h{display:flex;align-items:center;gap:9px;width:100%;
  padding:9px 11px;background:none;border:none;cursor:pointer;
  text-align:left;font-family:var(--sans);color:#c3d2df;min-width:0;}
.vo-step-h:hover{background:#1a2c3d;}
.vo-num{font-family:var(--mono);font-size:11px;font-weight:600;
  width:22px;height:22px;border-radius:6px;display:flex;
  align-items:center;justify-content:center;flex:none;
  background:#39a9c022;color:#5fc3d8;}
.vo-step-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;font-size:12.5px;}
.vo-chev{flex:none;color:#8ba0b2;font-size:13px;
  transition:transform .2s;}
.vo-step.open .vo-chev{transform:rotate(90deg);}
.vo-full{background:none;border:none;color:#8ba0b2;cursor:pointer;
  font-size:13px;flex:none;padding:2px 5px;border-radius:4px;}
.vo-full:hover{color:#fff;background:#ffffff14;}
/* eyeball: hide a step while presenting */
.vo-eye{background:none;border:none;color:#8ba0b2;cursor:pointer;
  font-size:12px;flex:none;padding:2px 5px;border-radius:4px;
  line-height:1;opacity:.75;position:relative;}
.vo-eye:hover{color:#fff;background:#ffffff14;opacity:1;}
.vo-eye.off{color:#63758a;}
.vo-eye.off::after{content:"";position:absolute;left:4px;right:4px;
  top:calc(50% - 1px);height:1.6px;background:currentColor;
  transform:rotate(-18deg);border-radius:2px;}
.vo-step.hidden{opacity:.5;border-style:dashed;}
.vo-step.hidden .vo-step-t::after{content:" · hidden";
  color:#8ba0b2;font-family:var(--mono);font-size:10px;
  letter-spacing:.04em;}
.vo-xall.on,.vo-fbtn.on{border-color:var(--cyan);color:#fff;
  background:#39a9c022;}
.vo-step-b{display:none;padding:2px 10px 10px;}
.vo-step.open .vo-step-b{display:block;}

/* scrollable playback: the slide fills the screen, the trace flows
   beneath it — scroll (or ArrowDown) between them */
.deck-stage.scrolly{display:block;overflow-y:auto;
  scroll-snap-type:y proximity;padding-top:0;padding-bottom:0;}
/* the slide fills the viewport EXACTLY so the code trace sits fully
   below the fold — its buttons never peek out under the slide */
.vpage{height:100%;box-sizing:border-box;padding:22px 0 8px;
  display:flex;flex-direction:column;min-width:0;
  scroll-snap-align:start;}
.vtrace{scroll-snap-align:start;display:flex;flex-direction:column;
  gap:14px;padding:64px 0 60px;min-height:70%;}   /* top clears the ↑ arrow */
.vtrace .vo-groups{flex:none;align-items:flex-start;}
.vtrace .vo-col{overflow:visible;}
/* several plots: the thumbnails PICK which trace shows */
.vo-plots .vo-thumb-btn{cursor:pointer;opacity:.45;
  transition:opacity .15s;}
.vo-plots .vo-thumb-btn:hover{opacity:.8;}
.vo-plots .vo-thumb-btn.sel{opacity:1;}
/* the docs dependency tree, hosted under a slide (always dark — the
   playback canvas is dark in both themes) */
.deck-tracetree .treeview{display:block;padding:0 4px 30px;}
.deck-tracetree .tt-present{display:none;}
.deck-tracetree .tree-toolbar{
  background:linear-gradient(#0b141d 72%,transparent);}
.deck-tracetree .tree-toolbar .tt-title{color:#7e93a4;}
.deck-tracetree .tt-btn{background:#101c28;border-color:#ffffff22;
  color:#cdd9e3;}
.deck-tracetree .tt-btn:hover{border-color:var(--cyan);color:#fff;}
.deck-tracetree .tree-scroll{border-color:#ffffff1a;background:
  radial-gradient(circle at 1px 1px,#ffffff12 1px,transparent 0)
  0 0/22px 22px,#0e1926;}
.deck-tracetree .tree-node{
  background:color-mix(in srgb,var(--nc) 12%,#101c28);
  border-color:#ffffff1c;border-top-color:var(--nc);
  box-shadow:0 1px 3px #00000040;}
.deck-tracetree .tree-node.active{border-color:var(--cyan);}
.deck-tracetree .tn-title{color:#e6edf3;}
.deck-tracetree .tn-btn{color:#8ba0b2;}
.deck-tracetree .tn-btn:hover{background:#ffffff14;}
.deck-tracetree .tn-resize{border-color:#8ba0b2;}
.deck-tracetree .tree-node-body{border-top-color:#ffffff14;}
.deck-tracetree .tree-node.tn-off{border-top-color:#ffffff1c;}
.deck-tracetree .tree-node.tn-off .tn-title{color:#7e93a4;}
.deck-tracetree .tree-empty{color:#7e93a4;}
.deck-codepill{position:absolute;left:50%;transform:translateX(-50%);
  bottom:16px;z-index:7;display:flex;align-items:center;gap:8px;
  background:#16273ae0;border:1px solid #ffffff2e;border-radius:22px;
  color:#cdd9e3;font-family:var(--mono);font-size:11.5px;
  padding:9px 17px;cursor:pointer;backdrop-filter:blur(4px);
  transition:border-color .15s,color .15s;}
.deck-codepill:hover{border-color:var(--cyan);color:#fff;}
.deck-codepill[hidden]{display:none;}
.cp-arr{font-size:14px;line-height:1;}
.deck-arrow.up{left:50%;top:12px;transform:translateX(-50%);
  width:44px;height:44px;font-size:24px;}
.deck-count{position:absolute;right:18px;bottom:12px;z-index:7;
  font-family:var(--mono);font-size:11.5px;color:#7e93a4;}
.deck.creating .deck-count,.deck.editing .deck-count{display:none;}

/* one step, full screen */
.vfull{position:fixed;inset:0;z-index:135;background:#0b141dfa;
  display:flex;flex-direction:column;padding:22px 44px 30px;}
.vfull[hidden]{display:none;}
.vfull-head{display:flex;align-items:center;gap:12px;flex:none;
  margin-bottom:14px;}
.vfull-t{font-size:17px;font-weight:600;color:#eef4f8;flex:1;
  min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
.vfull-body{flex:1;min-height:0;overflow:auto;}

/* the figure "Plot trace" button */
/* the card's actions live together at the top RIGHT */
.plot-trace-btn{margin-left:auto;}
.plot-trace-btn+.cell-eye{margin-left:0;}
.plot-trace-btn{flex:none;font-family:var(--mono);font-size:10.5px;
  letter-spacing:.02em;border:1px solid var(--line);background:var(--paper-2);
  color:var(--ink-2);border-radius:20px;padding:3px 10px;cursor:pointer;
  transition:background .15s,color .15s,border-color .15s;white-space:nowrap;}
.plot-trace-btn:hover{background:#39a9c016;color:var(--cyan-deep);
  border-color:#39a9c055;}
body:not(.light) .plot-trace-btn{background:#0e1824;color:#8ba0b2;
  border-color:#ffffff1f;}
body:not(.light) .plot-trace-btn:hover{color:#5fc3d8;border-color:#39a9c066;}
/* ---- Plot-trace TAB: a real notebook shell holding just this plot's
   lineage cells, so every global filter + per-card control works inside it.
   No sidebar — the content spans the full width. ---- */
/* :not([hidden]) both raises specificity above .nbshell[hidden]{display:none}
   AND stops matching once activate() hides the tab, so switching tabs works */
.nbshell.tracetab:not([hidden]){display:grid;}
.nbshell.tracetab .stage{width:100%;}
.tracetab-head{margin:0 0 14px;padding-bottom:12px;
  border-bottom:1px solid #ffffff14;position:relative;}
/* Cells | Tree switcher, right in the trace header */
.trace-viewsw{position:absolute;right:0;top:6px;display:flex;gap:6px;}
.dbtn.tvw.on{background:var(--cyan-deep);border-color:var(--cyan-deep);
  color:#fff;}
body.light .trace-viewsw .dbtn{background:#fff;border-color:var(--line);
  color:var(--ink-2);}
body.light .trace-viewsw .dbtn.tvw.on{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
.tracetab-eyebrow{display:block;font-family:var(--mono);font-size:10px;
  letter-spacing:.22em;text-transform:uppercase;color:#5fc3d8;}
.tracetab-t{margin:5px 0 2px;font-size:22px;font-weight:650;color:#eef4f8;
  line-height:1.2;}
.tracetab-sub{font-size:12.5px;color:#8fa6b4;}
.tracetab-graph{margin:0 0 18px;}
.tracetab-graph .plotgraph-wrap{margin:0;}
body.light .tracetab-head{border-color:#0000000f;}
body.light .tracetab-t{color:#122029;}
body.light .tracetab-sub{color:#5a6b76;}
/* the ◈ badge + tint that marks a Plot-trace tab in the tab strip */
/* a Plot-trace SUB-tab: smaller + indented + cyan-tinted so it reads as a
   child of the notebook tab immediately before it */
.tab.tab-sub{margin-left:6px;max-width:200px;font-size:12px;
  padding:0 8px 0 10px;background:#39a9c00f;border-color:#39a9c03d;}
.tab.tab-sub:hover{background:#39a9c01c;}
.tab.tab-sub.current{background:#39a9c022;color:#dff3f8;
  border-color:#39a9c07a;}
.tab-trace-ic{color:#5fc3d8;margin-right:4px;font-size:12px;flex:none;
  opacity:.85;}
.tab.tab-sub .tab-t{max-width:150px;}
/* a small gap + hook line before a sub-tab hints the parent→child nesting */
.tab.tab-sub::before{content:"";width:8px;height:1px;background:#39a9c066;
  margin:0 1px 0 -6px;align-self:center;flex:none;}
body.light .tab.tab-sub{background:#39a9c012;border-color:#39a9c04d;}
body.light .tab.tab-sub.current{background:#39a9c026;color:#0b3a44;}
/* per-plot dependency graph */
.plotgraph-wrap{margin:0 0 18px;padding:12px 12px 6px;
  background:#0e1824;border:1px solid #ffffff12;border-radius:10px;}
.pg-eyebrow{font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;
  text-transform:uppercase;color:#63758a;margin-bottom:8px;}
.plotgraph{display:block;width:100%;height:auto;}
.pg-edge{fill:none;stroke:#f0a848;stroke-width:1.6;opacity:.6;}
.pg-node{cursor:pointer;}
.pg-node rect{stroke:#ffffff26;stroke-width:1;
  transition:filter .15s;}
.pg-node:hover rect,.pg-node:focus rect{filter:brightness(1.18);
  stroke:#ffffff66;}
.pg-node:focus{outline:none;}
.pg-node text{font-family:var(--sans);font-size:12px;fill:#0b141d;
  font-weight:600;pointer-events:none;}

.slide{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;
  animation:slidein .28s ease;}
@keyframes slidein{from{opacity:0;transform:translateY(8px);}
  to{opacity:1;transform:none;}}
.slide-titlecard{align-items:center;justify-content:center;text-align:center;
  gap:12px;}
.slide-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.24em;
  text-transform:uppercase;color:var(--cyan);margin:0;}
.slide-titlecard h2{font-size:clamp(28px,4.5vw,54px);font-weight:600;
  letter-spacing:-.02em;color:#f0f6fa;margin:0;max-width:82%;line-height:1.15;}
.slide-meta{font-family:var(--mono);font-size:12px;color:#7e93a4;margin:0;}
.slide-empty{align-items:center;justify-content:center;color:#7e93a4;
  font-size:14px;text-align:center;}

.slide-head h3{font-size:clamp(18px,2.2vw,28px);font-weight:600;color:#eef4f8;
  margin:0 0 14px;letter-spacing:-.015em;}
.slide-body{flex:1;display:flex;gap:26px;min-height:0;}
.slide-fig{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;}
.slide-fig .cardbody{flex:1;min-height:0;display:flex;flex-direction:column;
  padding-left:0;}
.slide-fig .figframe{flex:1;min-height:0;display:flex;align-items:center;
  justify-content:center;border:none;border-radius:10px;padding:14px;
  overflow:hidden;background:none;}
.slide-fig .figframe img{max-width:100%;max-height:100%;width:auto;height:auto;
  object-fit:contain;margin:0;}
.slide-fig .note{background:#f7fafc;color:var(--ink-2);border-radius:12px;
  padding:26px 32px;overflow:auto;font-size:16.5px;line-height:1.7;}
.slide-fig .caption{flex:none;color:#a9bccb;margin-top:12px;padding-left:2px;
  font-size:14.5px;}
.slide-fig pre.result,.slide-fig pre.stream{flex:none;overflow:auto;}
.slide-fig .xr-wrap{flex:1;min-height:0;overflow:auto;}

/* halves / quarters slide layouts */
.slide-grid{flex:1;display:grid;gap:16px;min-height:0;}
.slide-grid.halves{grid-template-columns:1fr 1fr;}
.slide-grid.quarters{grid-template-columns:1fr 1fr;
  grid-template-rows:1fr 1fr;}
.spane{display:flex;flex-direction:column;min-width:0;min-height:0;
  background:#0e1926;border:1px solid #ffffff10;border-radius:10px;
  padding:12px 14px;}
.spane-t{font-size:13.5px;font-weight:600;color:#dbe7ef;margin:0 0 8px;
  letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;flex:none;}
.spane .cardbody{flex:1;min-height:0;display:flex;flex-direction:column;
  padding-left:0;}
.spane .figframe{flex:1;min-height:0;display:flex;align-items:center;
  justify-content:center;border:none;border-radius:8px;padding:8px;
  overflow:hidden;}
.spane .figframe img{max-width:100%;max-height:100%;width:auto;height:auto;
  object-fit:contain;margin:0;}
.spane .note{flex:1;min-height:0;background:#f7fafc;color:var(--ink-2);
  border-radius:8px;padding:14px 18px;overflow:auto;font-size:13.5px;
  line-height:1.6;}
.spane .xr-wrap,.spane pre.result,.spane pre.stream{overflow:auto;
  min-height:0;}
.spane.empty{align-items:center;justify-content:center;color:#54677a;
  font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;}

.chain-sec{border-top:1px solid #ffffff10;}
.chain-sec:first-child{border-top:none;}
.chain-h{display:flex;align-items:center;gap:10px;width:100%;
  padding:9px 4px;margin:0;background:none;border:none;cursor:pointer;
  font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;
  text-transform:uppercase;color:#9fb2c2;text-align:left;border-radius:6px;
  transition:color .15s,background .15s;}
.chain-h:hover{color:#e6eef4;background:#ffffff08;}
.chain-chev{display:inline-block;font-size:14px;line-height:1;flex:none;
  transition:transform .2s;}
.chain-h[aria-expanded="true"] .chain-chev{transform:rotate(90deg);}
.chain-badge{font-size:9px;padding:2px 7px;border-radius:4px;
  background:#39a9c01f;color:#5fc3d8;letter-spacing:.1em;flex:none;
  text-transform:lowercase;}
.chain-badge.ckmain-imports{background:#8a6d4a2b;color:#c8a877;}
.chain-badge.ckmain-function{background:#46a8922b;color:#7fd0bd;}
.chain-badge.ckmain-data{background:#4d90c02b;color:#8fbfe0;}
.chain-badge.ckmain-constant{background:#9a7cc02b;color:#c3a9e0;}
.chain-badge.ckmain-settings{background:#5b75892b;color:#a7bccd;}
.chain-badge.ckmain-plotting{background:#39a9c02b;color:#5fc3d8;}
.chain-badge.ckmain-print{background:#cf9a4e2b;color:#dfb277;}
.chain-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.chain-b{padding:0 4px 10px;}

.deck-arrow{position:absolute;top:50%;transform:translateY(-50%);width:52px;
  height:52px;border-radius:50%;border:1px solid #ffffff22;background:#ffffff0a;
  color:#cdd9e3;font-size:30px;line-height:1;cursor:pointer;z-index:5;
  transition:all .15s;}
.deck-arrow:hover{border-color:var(--cyan);color:#fff;background:#39a9c022;}
.deck-arrow:disabled{opacity:.22;cursor:default;}
.deck-arrow.prev{left:13px;}
.deck-arrow.next{right:13px;}

.deck-foot{display:flex;align-items:center;justify-content:center;gap:16px;
  padding:9px 18px 13px;flex:none;}
.deck-count{font-family:var(--mono);font-size:11.5px;color:#7e93a4;}
.deck-drawer{max-height:44vh;overflow-y:auto;background:#0e1b25;
  border-top:1px solid #ffffff14;padding:14px 78px 22px;flex:none;}
.deck-drawer .steplabel{color:#8fa3b4;}
.deck-drawer pre.result,.deck-drawer pre.stream{background:#13222f;
  border-color:#ffffff14;color:#b6c6d3;}

/* ---------- create mode: deck docks left, document stays interactive */
.deck.creating{width:min(var(--dc-w),94vw);right:auto;
  border-right:1px solid #ffffff22;box-shadow:8px 0 40px #00000055;}
.deck.creating .deck-stagewrap{display:none;}
.deck.creating .deck-top{display:none;}

/* create panel header: File menu + status */
.dc-head{display:flex;align-items:center;gap:8px;padding:10px 14px;
  border-bottom:1px solid #ffffff14;background:#0b141d;flex-wrap:wrap;}
/* every header button is the same chip as the top-bar toggles */
.dc-head .dbtn,.dc-menuwrap .dbtn{height:30px;box-sizing:border-box;
  padding:0 12px;display:inline-flex;align-items:center;gap:6px;
  line-height:1;letter-spacing:.04em;white-space:nowrap;}
.dc-head .dbtn.dc-icon{padding:0 9px;font-size:15px;}
.dbtn[disabled]{opacity:.4;cursor:default;pointer-events:none;}
/* ---- POSTER MODE: bigger chrome (2026-07-29) ------------------------
   A poster is authored at A0/A1 on a big screen, and the buttons that
   were sized for a 16:9 slide read as tiny beside it. Everything the
   deck editor draws steps up one size while the page is a poster. */
.deck.poster-page .dbtn{font-size:12.5px;padding:8px 14px;}
.deck.poster-page .dc-head .dbtn,
.deck.poster-page .dc-menuwrap .dbtn{height:36px;padding:0 15px;
  font-size:12.5px;}
.deck.poster-page .dc-head .dbtn.dc-icon{padding:0 11px;font-size:17px;}
.deck.poster-page .edit-tools .dbtn{height:34px;box-sizing:border-box;
  display:inline-flex;align-items:center;font-size:12.5px;}
.deck.poster-page .dbtn.etm{padding:0 12px;}
.deck.poster-page .deck-status{height:34px;font-size:11px;}
/* the template catalog gets two bigger previews per row instead of three */
.deck.poster-page .lay-picker{grid-template-columns:repeat(2,1fr);
  max-height:300px;}
.deck.poster-page .lay-lb{font-size:9.5px;}
.deck.poster-page .dbtn.lay{padding:5px;}
.deck.poster-page .dc-label{font-size:10px;}
.dc-menuwrap{position:relative;}
.dc-menu{position:absolute;left:0;top:calc(100% + 6px);z-index:30;
  background:#16273a;border:1px solid #ffffff22;border-radius:8px;
  padding:5px;min-width:214px;display:flex;flex-direction:column;
  box-shadow:0 12px 34px #00000066;}
.dc-mi{text-align:left;background:none;border:none;color:#dce6ee;
  font-size:12.5px;font-family:var(--sans);padding:8px 11px;
  border-radius:5px;cursor:pointer;transition:background .12s;}
.dc-mi:hover{background:#39a9c026;}
.dc-msep{height:1px;background:#ffffff14;margin:4px 6px;}
/* the "Saved to" picker: a heading + a tick beside the current target */
.dc-mhead{font-family:var(--mono);font-size:9px;letter-spacing:.13em;
  text-transform:uppercase;color:#7e93a4;padding:5px 11px 6px;}
.dc-mi[aria-pressed="true"]{color:#fff;}
.dc-mi[aria-pressed="true"]::before{content:"\2713  ";color:var(--cyan);}
.dc-mi[disabled]{opacity:.45;cursor:default;}
.dbtn.dc-target{font-family:var(--mono);font-size:10.5px;
  letter-spacing:.02em;max-width:230px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.dbtn.dc-target.tg-file{border-color:#46a89266;color:#8fd8c4;}
body.light .dc-mhead{color:var(--ink-3);}
body.creating-docs .docs{margin-left:min(var(--dc-w),94vw);}
body.creating-docs .card{cursor:copy;}
body.creating-docs .card:hover{outline:2px solid var(--cyan);
  outline-offset:2px;}

.deck-create{flex:1;overflow-y:auto;display:flex;flex-direction:column;
  min-height:0;background:#0e1926;}
/* fixed so it hugs the panel's right edge in both creating (docked
   deck) and editing (flex column) modes, and survives panel scroll */
.dc-resize{position:fixed;top:0;bottom:0;width:6px;z-index:130;
  cursor:col-resize;
  left:calc(var(--presrail-w) + min(var(--dc-w),94vw) - 1px);}
.dc-resize:hover,.dc-resize.on{background:#39a9c066;}
@media(max-width:860px){.dc-resize{display:none;}}
.dc-block{padding:10px 14px 9px;border-bottom:1px solid #ffffff14;}
/* the slides list is the main working area — give it the lion's share
   and let it be the panel's primary scroller */
.dc-block.dc-film{flex:1 1 auto;display:flex;flex-direction:column;
  min-height:240px;border-bottom:none;padding-bottom:8px;}
.dc-block.dc-film .film-list{flex:1;overflow-y:auto;min-height:0;}
.dc-label{display:block;font-family:var(--mono);font-size:9.5px;
  letter-spacing:.16em;text-transform:uppercase;color:#7e93a4;
  margin-bottom:8px;}
.dc-row{display:flex;gap:6px;flex-wrap:wrap;}
.dc-hint{font-size:11.5px;color:#7e93a4;line-height:1.5;margin:9px 0 0;}
.dc-spring{flex:1;}
/* the presentation name lives on the left rail — no need to repeat it
   in the builder; keep the element for the File > Rename flow only */
#pres-current{display:none;}
.dc-controls{display:flex;flex-direction:column;gap:9px;}
/* the "Notebooks" popover: list + open-all / refresh-all */
.dc-nbs-menu{min-width:252px;max-width:330px;gap:1px;}
.dc-nbs-menuh{font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;
  text-transform:uppercase;color:#7e93a4;padding:6px 9px 5px;}
.dc-nbs-empty{font-size:11.5px;color:#8ba0b2;padding:8px 10px;line-height:1.5;}
.dc-nbrow{display:flex;align-items:center;gap:8px;padding:6px 9px;
  border-radius:5px;font-size:12px;color:#dce6ee;}
.dc-nbrow.clickable{cursor:pointer;}
.dc-nbrow.clickable:hover{background:#39a9c020;}
.dc-nbrow-dot{width:7px;height:7px;border-radius:50%;flex:none;
  background:#5b7589;}
.dc-nbrow.open .dc-nbrow-dot{background:#46c08a;}
.dc-nbrow.avail .dc-nbrow-dot{background:#f0a848;}
.dc-nbrow.gone .dc-nbrow-dot{background:#8a5a5a;}
.dc-nbrow-nm{flex:1;font-family:var(--mono);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.dc-nbrow.gone .dc-nbrow-nm{color:#98a7b5;}
.dc-nbrow-st{font-family:var(--mono);font-size:9.5px;color:#7e93a4;flex:none;}
.dc-nbacts{display:flex;gap:6px;padding:8px 6px 3px;margin-top:4px;
  border-top:1px solid #ffffff14;}
.dc-nbacts .dbtn{flex:1;text-align:center;justify-content:center;
  font-size:11.5px;}
#pres-name{width:100%;background:#16273a;border:1px solid #ffffff22;
  color:#dce6ee;font-family:var(--sans);font-size:12.5px;padding:7px 9px;
  border-radius:6px;box-sizing:border-box;}
#pres-name:focus{outline:none;border-color:var(--cyan);}
.dbtn.lay[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
/* layout picker: little diagrams instead of words */
.dbtn.lay{padding:5px 7px;line-height:0;}
.layico{display:grid;gap:2px;width:34px;height:22px;}
.layico.full{grid-template-columns:1fr;}
.layico.halves{grid-template-columns:1fr 1fr;}
.layico.rows{grid-template-rows:1fr 1fr;}
.layico.quarters{grid-template-columns:1fr 1fr;
  grid-template-rows:1fr 1fr;}
.layico i{background:#8ba0b2;border-radius:2px;display:block;}
.dbtn.lay[aria-pressed="true"] .layico i{background:#fff;}
.layico.title{display:block;position:relative;}
.layico.title i{position:absolute;border-radius:2px;}
.layico.title .tl1{left:15%;right:15%;top:26%;height:24%;}
.layico.title .tl2{left:28%;right:28%;top:62%;height:12%;opacity:.5;}
.layico.blank{display:block;border:1.5px dashed #8ba0b2;
  border-radius:3px;}
.dbtn.lay[aria-pressed="true"] .layico.blank{border-color:#fff;}
/* scrollable slide-template catalog (buttons generated from LAYOUTS) */
.lay-picker{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;
  max-height:224px;overflow-y:auto;overflow-x:hidden;
  padding:2px 3px 4px;margin:0;}
.lay-picker .lay{padding:4px;display:flex;flex-direction:column;
  align-items:stretch;gap:3px;line-height:1;height:auto;}
.layico2{position:relative;width:100%;aspect-ratio:16/9;background:#0b141d;
  border:1px solid #ffffff1a;border-radius:3px;overflow:hidden;}
.dbtn.lay[aria-pressed="true"] .layico2{border-color:#fff;}
.layico2 .li-cell{position:absolute;background:#2a4761;
  border:1px solid #4d7ea3;border-radius:1px;box-sizing:border-box;}
.layico2 .li-text{position:absolute;box-sizing:border-box;opacity:.8;
  background:repeating-linear-gradient(#9fb2c2 0 1.5px,transparent 1.5px 4px);}
.lay-lb{font-family:var(--mono);font-size:8px;letter-spacing:.02em;
  color:#8ba0b2;text-align:center;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;}
.dbtn.lay[aria-pressed="true"] .lay-lb{color:#fff;}
/* title-slide text inputs */
.title-editor{display:flex;flex-direction:column;gap:7px;}
.title-editor[hidden]{display:none;}
.title-editor input{background:#16273a;border:1px solid #ffffff22;
  color:#dce6ee;font-family:var(--sans);font-size:12.5px;padding:8px 9px;
  border-radius:6px;}
.title-editor input:focus{outline:none;border-color:var(--cyan);}
.pane-editor[hidden]{display:none;}
#dc-edit{width:100%;}
/* freeform slot editor + film thumbnails: boxes at frame positions */
.pane-editor.freeform{display:block;position:relative;}
.pane-editor.freeform .pane.slot{position:absolute;padding:4px 16px
  4px 6px;}
.pane-editor.freeform .pane.slot .pane-t{font-size:9.5px;
  -webkit-line-clamp:2;}
.mini-diagram.free{display:block;position:relative;}
.mini-diagram.free .mini-pane{position:absolute;}
.mini-diagram.title{grid-template-columns:1fr;}
.mini-pane.is-title{background:#12202e;}
.mini-pane.is-title::before{content:"";position:absolute;left:18%;
  right:18%;top:32%;height:18%;background:#4d90c0;border-radius:1px;}
.mini-pane.is-title::after{content:"";position:absolute;left:30%;
  right:30%;top:60%;height:9%;background:#4d90c066;}

/* ---------- slide editor ----------
   Editing docks like an IDE: the builder panel stays on the left and
   the slide canvas takes the document area. The document chrome (tabs,
   filters) is hidden while editing — it acts on the hidden documents —
   and comes back for cell-picking / on Done. */
.deck.editing{left:var(--presrail-w);top:0;}
body.slide-editing .apptop{display:none;}
/* while editing, the panel is just chrome + film strip (the template
   catalog lives in the ribbon's Layouts dropdown) — keep it slim so the
   slide canvas gets the width */
.deck.editing .deck-create{flex:0 0 min(var(--dc-w),248px);
  border-right:1px solid #ffffff22;}
.deck.editing #layout-row{display:none;}
.deck.editing .dc-resize{display:none;}
/* ---- PowerPoint-style ribbon: labelled groups, always the same height ----
   ONE wrapping flow: the static groups and the contextual format groups are
   display:contents, so every group flows into the same rows — no dedicated
   row per section, no wasted band. min-height reserves two rows so
   selecting/deselecting never grows the ribbon or shifts the canvas. */
.edit-tools.ribbon{display:flex;flex-wrap:wrap;align-items:stretch;
  align-content:flex-start;gap:2px;row-gap:4px;
  padding:7px 16px 6px;border-bottom:1px solid #ffffff14;
  background:#0e1926;flex:none;min-height:122px;}
.rbn-static{display:contents;}
.rbn-grp{display:flex;flex-direction:column;align-items:center;
  justify-content:space-between;gap:6px;padding:2px 15px;position:relative;
  min-width:0;}
.rbn-grp[hidden]{display:none;}
.rbn-grp+.rbn-grp::before{content:"";position:absolute;left:0;top:2px;
  bottom:15px;width:1px;background:#ffffff1a;}
.rbn-grp.rbn-first::before{display:none;}
.rbn-row{display:flex;align-items:center;justify-content:center;gap:6px;
  flex-wrap:wrap;flex:1;min-height:32px;}
.rbn-lab{font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;
  text-transform:uppercase;color:#66798a;line-height:1;white-space:nowrap;}
/* the contextual format groups flow into the same rows as the static ones;
   when nothing is selected they stay in layout (invisible) so the ribbon
   height never jumps */
.et-fmt{display:contents;}
.et-fmt[hidden]{display:contents;visibility:hidden;}
.et-fmt .rbn-grp{flex:none;}
.fmt-lab{margin-left:2px;}
.et-label{font-family:var(--mono);font-size:10px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--amber);}
.et-hint{font-size:11px;color:#7e93a4;align-self:center;margin-left:auto;
  padding:0 4px 10px;}
.et-div{width:1px;height:22px;background:#ffffff26;flex:none;margin:0 3px;}
/* the "+ Shapes" dropdown */
.sh-drop{position:relative;display:inline-block;}
#sh-btn[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
.sh-menu{position:absolute;top:calc(100% + 5px);left:0;z-index:60;
  background:#16273a;border:1px solid #ffffff26;border-radius:9px;padding:6px;
  display:grid;grid-template-columns:repeat(3,1fr);gap:4px;
  box-shadow:0 14px 38px #0009;width:210px;}
.sh-menu[hidden]{display:none;}
.sh-opt{display:flex;flex-direction:column;align-items:center;gap:3px;
  background:none;border:1px solid transparent;border-radius:7px;
  padding:7px 4px 5px;cursor:pointer;color:#c9d6e2;font-family:var(--sans);}
.sh-opt:hover{background:#39a9c022;border-color:#39a9c066;color:#fff;}
.sh-ico{width:26px;height:22px;display:block;}
/* filled crop-shape preview in the Crop menu (same clip-path as the effect) */
.crop-ico{width:30px;height:22px;display:block;border-radius:2px;
  background:linear-gradient(135deg,#8fd8ea,#39a9c0);}
/* a shape-cropped figure fills its frame so the mask actually bites into it
   (a contained figure would just have its letterbox clipped, looking unchanged) */
.an-cell.an-cropped .figframe{padding:0;}
.an-cell.an-cropped .figframe img{object-fit:cover;width:100%;height:100%;
  max-width:none;max-height:none;}
/* the "Same size" picker: a plain single-column list of text options */
.sh-menu.same-menu{display:block;width:196px;padding:6px;}
.same-menu .sh-opt{flex-direction:row;justify-content:flex-start;
  width:100%;padding:7px 9px;font-size:12px;text-align:left;}
/* the animation pane: effect picker + build-order sequence */
.sh-menu.anim-pane{display:block;grid-template-columns:none;width:340px;
  padding:11px 12px;max-height:min(72vh,460px);overflow-y:auto;text-align:left;}
.anim-h{font-family:var(--mono);font-size:9px;letter-spacing:.14em;
  text-transform:uppercase;color:#7e93a4;margin:0 2px 6px;}
.anim-eff+.anim-h,.anim-merge+.anim-h,.anim-empty+.anim-h{margin-top:13px;}
.anim-empty{font-size:12px;color:#8ba0b2;padding:1px 2px 5px;line-height:1.5;}
.anim-eff{display:flex;flex-wrap:wrap;gap:5px;}
.anim-effb{flex:1;min-width:52px;background:#16273a;border:1px solid #ffffff1f;
  color:#cdd9e3;border-radius:7px;padding:7px 6px;font-size:12px;cursor:pointer;
  font-family:var(--sans);}
.anim-effb:hover{border-color:#39a9c088;color:#fff;}
.anim-effb.on{background:var(--cyan-deep);border-color:var(--cyan);color:#fff;}
.anim-merge{display:flex;gap:6px;margin-top:8px;}
.anim-mini{background:#16273a;border:1px solid #ffffff1f;color:#bcccd8;
  border-radius:6px;padding:5px 8px;font-size:11.5px;cursor:pointer;
  font-family:var(--sans);}
.anim-mini.wide{flex:1;}
.anim-mini:hover:not(:disabled){border-color:#39a9c088;color:#fff;}
.anim-mini:disabled{opacity:.4;cursor:default;}
.anim-seq{display:flex;flex-direction:column;gap:4px;}
.anim-step{display:flex;align-items:center;gap:8px;background:#101c28;
  border:1px solid #ffffff12;border-radius:8px;padding:5px 7px;}
.anim-num{flex:none;width:20px;height:20px;border-radius:50%;
  background:var(--amber);color:#241a05;font-family:var(--mono);font-size:11px;
  font-weight:700;display:flex;align-items:center;justify-content:center;}
.anim-chips{flex:1;display:flex;flex-wrap:wrap;gap:4px;min-width:0;}
.anim-chip{font-size:11px;color:#bcccd8;background:#1c2c3d;border-radius:5px;
  padding:2px 7px;cursor:pointer;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;max-width:150px;}
.anim-chip.cur{background:var(--cyan-deep);color:#fff;}
.anim-stepctr{flex:none;display:flex;gap:2px;}
.anim-stepctr .anim-mini{padding:3px 6px;}
.sh-ico path,.sh-ico rect,.sh-ico ellipse,.sh-ico text{transition:fill .1s;}
.sh-opt-t{font-size:9.5px;letter-spacing:.02em;}
.dbtn.viewtoggle{border-color:#39a9c05c;color:#8fd4e4;}
.dbtn.viewtoggle:hover{border-color:var(--cyan);color:#fff;
  background:#39a9c01e;}
/* the floating "back to slide" toggle shown while scrolling the notebook */
/* SVG shapes fill their frame; the div carries no border/box for these */
.an-rect.an-svgshape{border:none!important;border-radius:0;
  background:none!important;}
.an-shape-svg{position:absolute;inset:0;width:100%;height:100%;
  overflow:visible;display:block;pointer-events:none;}
/* var() doesn't resolve in an SVG font-family attribute — set it via CSS */
.an-shape-svg text,.sh-ico text{font-family:var(--sans);}
.dbtn.et[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
.dbtn.etm{padding:5px 9px;}
select#fmt-font{background:#16273a;border:1px solid #ffffff22;
  color:#cdd9e3;font-family:var(--mono);font-size:11px;
  padding:5px 6px;border-radius:6px;}
select#fmt-font[hidden]{display:none;}
.dbtn.etm[aria-pressed="true"]{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
/* precise point-size input + opacity slider live in the format bar */
.fmt-szwrap,.fmt-opwrap{display:inline-flex;align-items:center;gap:4px;
  flex:none;}
.fmt-szwrap[hidden]{display:none;}
.fmt-num{width:44px;background:#16273a;border:1px solid #ffffff22;
  color:#cdd9e3;font-family:var(--mono);font-size:11px;padding:4px 5px;
  border-radius:6px;-moz-appearance:textfield;}
.fmt-num::-webkit-outer-spin-button,
.fmt-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.fmt-unit,.fmt-opval{font-family:var(--mono);font-size:10.5px;color:#7e93a4;}
.fmt-opval{min-width:34px;text-align:right;}
.fmt-range{width:96px;accent-color:var(--cyan);cursor:pointer;height:16px;}
.sw{width:18px;height:18px;border-radius:50%;padding:0;cursor:pointer;
  border:2px solid #ffffff30;}
.sw[aria-pressed="true"]{border-color:#fff;
  box-shadow:0 0 0 2px #39a9c0aa;}
.fmt-lab{font-family:var(--mono);font-size:9px;letter-spacing:.1em;
  text-transform:uppercase;color:#7e93a4;}
.sw.trans{background:#16273a;position:relative;overflow:hidden;}
.sw.trans::after{content:"";position:absolute;left:-2px;right:-2px;
  top:50%;height:2px;background:#ff6b57;
  transform:rotate(-45deg);}
/* custom-colour swatch: a rainbow chip that opens the full picker */
.sw.sw-custom{background:conic-gradient(from 0deg,#ff6b57,#f0a848,#46a892,
  #39a9c0,#7a6cff,#ff6b57);position:relative;overflow:hidden;}
.sw.sw-custom::after{content:"+";position:absolute;inset:0;display:flex;
  align-items:center;justify-content:center;font-size:11px;line-height:1;
  color:#fff;font-weight:800;text-shadow:0 1px 2px #000b;}
/* professional colour picker popover (hex / rgb / rgba + alpha + recents) */
.color-pop{position:fixed;z-index:160;width:236px;background:#0e1b28;
  border:1px solid #ffffff26;border-radius:10px;padding:12px;
  box-shadow:0 16px 46px #000a;display:flex;flex-direction:column;gap:9px;
  font-family:var(--sans);}
.color-pop[hidden]{display:none;}
.cp-head{font-family:var(--mono);font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:#8ba0b2;}
.cp-native{width:100%;height:38px;border:1px solid #ffffff22;border-radius:6px;
  background:none;cursor:pointer;padding:2px;}
.cp-row{display:flex;align-items:center;gap:8px;}
.cp-lab{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;
  text-transform:uppercase;color:#7e93a4;width:38px;flex:none;}
.cp-in{flex:1;min-width:0;background:#16273a;border:1px solid #ffffff22;
  color:#dce6ee;font-family:var(--mono);font-size:12px;padding:6px 8px;
  border-radius:6px;}
.cp-in:focus{outline:none;border-color:var(--cyan);}
.cp-in.bad{border-color:#ff6b57;}
.cp-alpha{flex:1;min-width:0;accent-color:var(--cyan);}
.cp-aval{font-family:var(--mono);font-size:10px;color:#8ba0b2;width:34px;
  text-align:right;flex:none;}
.cp-recent{display:flex;flex-wrap:wrap;gap:5px;}
.cp-recent:empty{display:none;}
.cp-sw-chk{background-image:linear-gradient(45deg,#33475a 25%,transparent 25%,
  transparent 75%,#33475a 75%),linear-gradient(45deg,#33475a 25%,#1a2836 25%,
  #1a2836 75%,#33475a 75%);background-size:8px 8px;
  background-position:0 0,4px 4px;}
.cp-rsw{width:18px;height:18px;border-radius:4px;border:1px solid #ffffff22;
  cursor:pointer;padding:0;position:relative;overflow:hidden;}
.cp-rsw::after{content:"";position:absolute;inset:0;background:var(--cpc);}
.cp-foot{display:flex;align-items:center;gap:8px;}
.cp-preview{width:28px;height:28px;border-radius:6px;border:1px solid #ffffff26;
  flex:none;position:relative;overflow:hidden;}
.cp-preview::after{content:"";position:absolute;inset:0;
  background:var(--cpc,#39a9c0);}
.cp-apply{background:var(--cyan-deep);border-color:var(--cyan-deep);
  color:#fff;}
.deck.editing .deck-arrow,.deck.editing .deck-foot{display:none;}
.slide{position:relative;}
/* image annotations */
.an-image{position:absolute;}
.an-imgel{width:100%;height:100%;object-fit:cover;display:block;
  pointer-events:none;border-radius:2px;}
.deck.editing .an-image{cursor:move;}
.deck.editing .an-image.sel{outline:2px solid var(--cyan);outline-offset:1px;}
/* multi-selection / group: a dashed outline, no per-item resize handles */
.deck.editing .an-item.grpsel{outline:1.5px dashed var(--cyan);
  outline-offset:1px;}
.deck.editing .an-item.grpsel .an-resize,
.deck.editing .an-item.grpsel .an-handle,
.deck.editing .an-item.grpsel .an-cellbtn,
.deck.editing .an-item.grpsel .cellparts{display:none!important;}
/* build animations: staged items hide until revealed, then animate in */
.an-prebuild{opacity:0!important;pointer-events:none!important;}
@keyframes anIn-fade{from{opacity:0}to{opacity:1}}
@keyframes anIn-rise{from{opacity:0;transform:translateY(22px)}
  to{opacity:1;transform:none}}
@keyframes anIn-zoom{from{opacity:0;transform:scale(.85)}
  to{opacity:1;transform:none}}
.an-anim-fade{animation:anIn-fade .45s ease;}
.an-anim-rise{animation:anIn-rise .5s cubic-bezier(.2,.7,.2,1);}
.an-anim-zoom{animation:anIn-zoom .45s ease;}
/* the build-order badge shown in the editor */
.an-buildno{position:absolute;top:-9px;left:-9px;z-index:5;min-width:16px;
  height:16px;border-radius:8px;background:var(--amber);color:#241a05;
  font-family:var(--mono);font-size:10px;font-weight:700;display:flex;
  align-items:center;justify-content:center;padding:0 3px;pointer-events:none;}
/* optional per-deck slide numbers (bottom-right, part of the slide) */
.slide-pageno{position:absolute;right:2.6%;bottom:3.2%;z-index:4;
  font-family:var(--mono);font-size:2.4vh;line-height:1;color:#8aa0b0;
  pointer-events:none;}
.vpage .slide-pageno{color:#8aa0b0;}
/* ---- PDF / print export: one fixed-size 16:9 slide per page ---- */
#print-root{position:fixed;left:-99999px;top:0;width:1280px;z-index:-1;}
.print-page{width:1280px;height:720px;position:relative;overflow:hidden;
  background:#0b141d;}
.print-page .slide{position:absolute;inset:0;background:#0b141d;}
.print-page .annot-layer{pointer-events:none;}
@media print{
  @page{size:1280px 720px;margin:0;}
  html,body{background:#0b141d;}
  body.printing>*{display:none!important;}
  body.printing #print-root{display:block!important;position:static;
    left:0;top:0;width:auto;z-index:auto;}
  .print-page{page-break-after:always;break-after:page;}
  .print-page:last-child{page-break-after:auto;break-after:auto;}
}

/* a frame LOCKED to a git commit */
.an-lockchip{position:absolute;top:5px;left:5px;z-index:3;
  font-family:var(--mono);font-size:9px;letter-spacing:.04em;
  background:#46a89222;border:1px solid #46a89266;color:#7fd0b8;
  border-radius:5px;padding:2px 6px;pointer-events:auto;cursor:help;}
.an-lockchip.warn{background:#ff6b5722;border-color:#ff6b5766;
  color:#ff9d8e;}
.deck:not(.editing) .an-lockchip{display:none;}
.an-verwait{flex:1;display:flex;align-items:center;justify-content:center;
  font-family:var(--mono);font-size:11px;color:#7e93a4;padding:16px;
  text-align:center;}

/* a frame reverted to its pre-refresh figure */
.deck.editing .an-cell.an-frozen{outline:1.5px dashed #f0a848;
  outline-offset:2px;}
.an-frozenchip{position:absolute;top:5px;left:5px;z-index:3;
  font-family:var(--mono);font-size:9px;letter-spacing:.06em;
  background:#f0a84822;border:1px solid #f0a84866;color:#f0c078;
  border-radius:5px;padding:2px 6px;pointer-events:none;}

/* snap-to-align guide lines (drawn only mid-drag) */
.snapline{position:absolute;z-index:45;pointer-events:none;}
.snapline.snap-v{top:0;bottom:0;width:0;border-left:1.5px dashed #ff6b57;}
.snapline.snap-h{left:0;right:0;height:0;border-top:1.5px dashed #ff6b57;}

/* annotation layer */
.annot-layer{position:absolute;inset:0;z-index:6;pointer-events:none;}
.deck.editing .annot-layer{pointer-events:auto;cursor:crosshair;}
.deck.editing .annot-layer.tool-select{cursor:default;}
.deck.editing .annot-layer:not(.tool-select) .an-item,
.deck.editing .annot-layer:not(.tool-select) .an-item *{
  cursor:crosshair!important;}
.annot-layer>svg{position:absolute;inset:0;width:100%;height:100%;
  overflow:visible;pointer-events:none;}
.deck.editing .annot-layer>svg{pointer-events:auto;}
.annot-layer>svg.an-svgtop{pointer-events:none!important;z-index:5;}
.an-item{pointer-events:none;}
.deck.editing .an-item{pointer-events:auto;}
.an-rect{position:absolute;border:3px solid #ff6b57;border-radius:4px;}
.deck.editing .an-rect{cursor:move;}
.an-rect.sel,.an-text.sel,.an-title.sel,.an-cell.sel{
  outline:2px dashed var(--cyan);outline-offset:3px;}
.an-text{position:absolute;max-width:60%;font-family:var(--sans);
  line-height:1.35;color:#fff;background:#0e1926d9;
  border:1px solid #ffffff2e;border-radius:8px;padding:.35em .55em;
  display:flex;align-items:flex-start;gap:.35em;}
.an-text.nobg{background:none;border:none;
  text-shadow:0 1px 4px #000d,0 0 10px #0009;}
/* fill the box (minus the move handle) so text-align actually positions the
   text — a content-sized flex item can't be aligned */
.an-tx{white-space:pre-wrap;min-width:14px;outline:none;flex:1;}
ul.an-ul{margin:0;padding-left:1.15em;list-style:disc;}
ul.an-ul li{margin:.18em 0;white-space:pre-wrap;}
.an-handle{cursor:move;color:#8ba0b2;font-size:.65em;flex:none;
  user-select:none;margin-top:.3em;}
.an-handle:hover{color:#fff;}
.an-arrow-line{fill:none;}
.an-arrow-line.sel{filter:drop-shadow(0 0 5px #39a9c0cc);}
.an-arrow-hit{stroke:transparent;stroke-width:16;fill:none;}
.deck.editing .an-arrow-hit{cursor:move;}
.an-resize{position:absolute;width:15px;
  height:15px;border-radius:4px;background:var(--cyan);
  border:2px solid #0b141d;display:none;z-index:3;}
.an-rs-se{right:-7px;bottom:-7px;cursor:nwse-resize;}
.an-rs-nw{left:-7px;top:-7px;cursor:nwse-resize;}
.an-rs-ne{right:-7px;top:-7px;cursor:nesw-resize;}
.an-rs-sw{left:-7px;bottom:-7px;cursor:nesw-resize;}
.an-item.sel .an-resize{display:block;}
/* free-rotation grip above the item (drag; Shift snaps to 15 deg) */
.an-rotate{position:absolute;top:-30px;left:50%;margin-left:-8px;
  width:16px;height:16px;border-radius:50%;background:#0e1926;
  border:2px solid var(--cyan);cursor:grab;display:none;z-index:3;}
.an-rotate::after{content:"";position:absolute;left:50%;top:100%;
  width:2px;height:11px;background:var(--cyan);margin-left:-1px;}
.an-item.sel .an-rotate{display:block;}
.deck.editing .an-item.grpsel .an-rotate{display:none!important;}
.an-endpt{position:absolute;width:15px;height:15px;
  margin:-7.5px 0 0 -7.5px;border-radius:50%;background:var(--cyan);
  border:2px solid #0b141d;display:none;z-index:6;
  pointer-events:none;}
.deck.editing .an-endpt.sel{display:block;pointer-events:auto;
  cursor:grab;}

/* movable title / subtitle on title slides */
.an-title{position:absolute;transform:translate(-50%,-50%);
  max-width:88%;text-align:center;display:flex;gap:.4em;
  align-items:flex-start;justify-content:center;
  font-family:var(--sans);line-height:1.2;}
.an-title.t-main .an-tx{font-weight:600;letter-spacing:-.018em;}
.slide-titlefree .ttl-eyebrow{position:absolute;top:7%;left:0;right:0;
  text-align:center;font-family:var(--mono);font-size:11px;
  letter-spacing:.24em;text-transform:uppercase;color:var(--cyan);}

/* notebook-cell frames */
.an-cell{position:absolute;background:#0e1926;
  border:1.5px solid #39a9c05c;border-radius:10px;overflow:hidden;
  display:flex;flex-direction:column;}
/* edit mode: an UNSELECTED frame is just its content — transparent (so it
   never blocks what's behind), no border, no title header. The border, title,
   Replace and part-picker all return only when the frame is SELECTED, so you
   can read the slide as it will present. */
.deck.editing .an-cell{cursor:move;background:none;border-color:transparent;}
.deck.editing .an-cell.sel{border-color:var(--cyan);background:#0b141d88;}
/* an EMPTY frame keeps its dashed dark placeholder box (a card goes here) */
.deck.editing .an-cell.empty{background:#0e192699;border-color:#39a9c05c;}
/* the title header is an OVERLAY (out of flow) shown only when selected, so
   selecting a frame never reflows/shrinks the figure underneath it */
.deck.editing .an-cell .an-cellhead,
.pane.filled .an-cellhead{position:absolute;top:0;left:0;right:0;z-index:2;
  display:none;padding:7px 30px 10px 12px;
  background:linear-gradient(#0b141de0,#0b141d00);}
.deck.editing .an-cell.sel .an-cellhead,
.pane.filled.active .an-cellhead{display:flex;}
.deck:not(.editing) .an-cell.empty{display:none;}
/* clean playback: a frame is just its content — no header title, no
   badge, no frame border (the editor/builder keep them for orientation) */
.vpage .an-cell{border:none;background:none;}
.vpage .an-cellhead{display:none;}
/* playback: a framed cell is just its content (no dark card box / cyan border),
   so a shape-crop reads as the shape even on slides without a code trace */
.deck:not(.editing) .deck-stage .an-cell{border:none;background:none;}
.deck:not(.editing) .deck-stage .an-cellhead{display:none;}
.an-cellhead{flex:none;display:flex;align-items:center;gap:8px;
  padding:8px 30px 0 12px;min-width:0;}
.an-cellhead-t{font-size:13px;font-weight:600;color:#dbe7ef;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;
  min-width:0;}
.an-cellcap{flex:none;font-family:var(--serif);font-size:12.5px;
  color:#a9bccb;padding:0 12px 9px;margin:0;overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.slide-emptyhint{position:absolute;inset:0;display:flex;
  align-items:center;justify-content:center;text-align:center;
  color:#54677a;font-size:14px;line-height:1.6;margin:0;padding:0 8%;
  pointer-events:none;}
.slide-emptyhint b{color:#7e93a4;}
.an-cell .cardbody{flex:1;min-height:0;display:flex;
  flex-direction:column;padding:8px;}
/* the .cb-fig figure-part wrapper must pass the flex height through in slide
   frames, else .figframe's flex:1 fit-to-frame sizing is inert and plots clip */
.an-cell .cb-fig,.spane .cb-fig,.slide-fig .cb-fig{flex:1;min-height:0;
  display:flex;flex-direction:column;}
.an-cell .figframe{flex:1;min-height:0;display:flex;
  align-items:center;justify-content:center;overflow:hidden;
  border:none;padding:6px;}
/* a frame wider/taller than its figure shows TRANSPARENT space around
   the plot, not a white box (the plot keeps its own background) */
.an-cell .figframe,.spane .figframe{background:none;}
.an-cell .figframe+.figframe{border-top:1px solid #ffffff10;}
.an-cell .figpager{flex:1;min-height:0;display:flex;
  flex-direction:column;}
.an-cell .figpager .figpage{display:none;}
.an-cell .figpager .figpage.current{flex:1;min-height:0;display:flex;
  flex-direction:column;}
.an-cell .fp-btn{background:transparent;border-color:#ffffff22;
  color:#cdd9e3;}
.an-cell .fp-count{color:#7e93a4;}
.an-cell .cardbody.mdclamp,.spane .cardbody.mdclamp{max-height:none;}
.an-cell .cardbody.mdclamp::after,
.spane .cardbody.mdclamp::after{display:none;}
.spane .figpager{flex:1;min-height:0;display:flex;
  flex-direction:column;}
.spane .figpager .figpage.current{flex:1;min-height:0;display:flex;
  flex-direction:column;}
.an-cell .figframe img{max-width:100%;max-height:100%;width:auto;
  height:auto;object-fit:contain;margin:0;}
/* a FIGURE frame is just the plot: no inner padding, and after render the
   frame snaps to the image's aspect ratio (snapFigAspect) — so the selection
   outline and resize handle sit exactly on the plot, with no letterbox gap
   and no title header (the tooltip + Locate in notebook carry its name) */
.an-cell.an-figonly{border-radius:4px;}
.an-cell.an-figonly .cardbody{padding:0;}
.an-cell.an-figonly .figframe{padding:0;}
/* the frame already matches the plot's aspect, so filling it (up- OR
   down-scaling) keeps the plot edge-to-edge under the outline */
.an-cell.an-figonly .figframe img{width:100%;height:100%;
  max-width:none;max-height:none;object-fit:contain;}
.an-cell .note{flex:1;min-height:0;overflow:auto;
  background:var(--nb-bg,#f7fafc);
  color:var(--nb-tx,var(--ink-2));border-radius:6px;padding:10px 14px;
  font-size:13px;}
/* a recoloured markdown card carries its text colour to every child
   (headings, lists, bold) so the whole note reads in the chosen colour */
.an-cell[style*="--nb-tx"] .note,
.an-cell[style*="--nb-tx"] .note *{color:var(--nb-tx);}
.an-cell .xr-wrap,.an-cell pre.result,.an-cell pre.stream{
  overflow:auto;min-height:0;}
.an-cell.empty{align-items:center;justify-content:center;
  border-style:dashed;background:#0e192699;}
.an-cellpick{background:none;border:none;color:#7fb6c6;
  font-family:var(--mono);font-size:11px;letter-spacing:.05em;
  cursor:pointer;padding:14px;text-align:center;line-height:1.5;}
.an-cellpick:hover{color:#fff;}
.an-cellbtn{position:absolute;top:5px;right:5px;z-index:3;display:none;
  background:#0e1926ee;border:1px solid #39a9c066;border-radius:6px;
  color:#7fd0e0;font-family:var(--mono);font-size:10px;padding:4px 9px;
  cursor:pointer;}
/* Replace shows only for the SELECTED frame (not on hover) — declutter */
.deck.editing .an-cell.sel .an-cellbtn{display:block;}
.an-cellbtn:hover{color:#fff;border-color:var(--cyan);}
/* which part of a cell a frame shows: code / figure / output */
.an-cellpart{font-family:var(--mono);font-size:9px;letter-spacing:.08em;
  text-transform:uppercase;color:#7fb6c6;background:#39a9c022;
  border-radius:4px;padding:1px 6px;flex:none;}
/* the code/figure/output picker sits along the BOTTOM of the frame so
   it never covers the title header or the part badge at the top */
.cellparts{position:absolute;bottom:5px;left:5px;right:5px;z-index:5;
  display:none;gap:3px;flex-wrap:wrap;justify-content:center;}
/* the part-picker shows only for the SELECTED frame (not on hover) */
.deck.editing .an-cell.sel .cellparts,
.pane.filled.active .cellparts{display:flex;}
.cellpartbtn{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;
  background:#0e1926ee;border:1px solid #ffffff2b;border-radius:5px;
  color:#c9d6e2;padding:3px 7px;cursor:pointer;line-height:1;}
.cellpartbtn.on{background:var(--cyan-deep);border-color:var(--cyan-deep);
  color:#fff;}
.cellpartbtn:hover{border-color:var(--cyan);color:#fff;}
.cellpartbtn.split{color:#9fb2c2;}
/* the same part-picker, hosted in the top ribbon's Object group */
.rbn-partslot{display:inline-flex;align-items:center;}
.rbn-partslot[hidden]{display:none;}
#fmt-parts .cellparts{position:static;display:inline-flex;gap:6px;
  flex-wrap:nowrap;bottom:auto;left:auto;right:auto;z-index:auto;}
/* in the ribbon the figure/code/output/split pills dress like every other
   ribbon button — same face, same size */
#fmt-parts .cellpartbtn{font-family:var(--mono);font-size:11px;
  letter-spacing:normal;background:#ffffff0a;border:1px solid #ffffff22;
  border-radius:6px;color:#cdd9e3;padding:5px 9px;line-height:normal;}
#fmt-parts .cellpartbtn:hover{border-color:var(--cyan);color:#fff;}
#fmt-parts .cellpartbtn.on{background:var(--cyan-deep);
  border-color:var(--cyan-deep);color:#fff;}
/* the Layouts dropdown: the whole template catalog, off the panel and
   into a ribbon menu */
.sh-menu.lay-menu{display:block;width:442px;max-height:min(64vh,470px);
  overflow-y:auto;padding:8px;}
.lay-menu .lay-picker{margin:0;}
/* catalog section headings (Slide layouts / Poster layouts) */
.lay-sec{grid-column:1/-1;font-family:var(--mono);font-size:9px;
  letter-spacing:.14em;text-transform:uppercase;color:#66798a;
  padding:7px 2px 1px;}
.lay-sec:first-child{padding-top:1px;}

/* picking a card for a cell frame */
.pickbar{position:fixed;top:var(--chrome-h);left:var(--presrail-w);
  right:0;z-index:99;background:var(--cyan-deep);color:#fff;
  padding:9px 16px;font-size:13px;display:flex;gap:12px;
  align-items:center;box-shadow:0 6px 24px #00000055;}
.pickbar[hidden]{display:none;}
.pickbar .dbtn{border-color:#ffffff55;color:#fff;}
body.picking .card{cursor:copy;}
body.picking .card:hover{outline:2px solid #fff;outline-offset:2px;}

/* pane editor: the current slide as clickable regions */
/* the current slide's interactive editor — the single big view in the
   merged slides list (fills the width; drag the panel edge to resize) */
.pane-editor{aspect-ratio:var(--page-ar,16/9);display:grid;gap:6px;
  background:#0b141d;
  border:1px solid #ffffff22;border-radius:8px;padding:6px;
  margin:0;width:100%;overflow:hidden;}
.pane-editor.full{grid-template-columns:1fr;grid-template-rows:1fr;}
.pane-editor.halves{grid-template-columns:1fr 1fr;grid-template-rows:1fr;}
.pane-editor.quarters{grid-template-columns:1fr 1fr;
  grid-template-rows:1fr 1fr;}
.pane{position:relative;background:#12202e;border:1px dashed #ffffff26;
  border-radius:6px;cursor:pointer;display:flex;align-items:center;
  justify-content:center;padding:6px 18px 6px 8px;overflow:hidden;
  transition:border-color .15s,background .15s;}
/* a filled frame shows the ACTUAL slide content (an .an-cell fills it),
   so the builder preview is exactly what will be presented */
.pane.filled{padding:0;background:none;border:none;overflow:visible;}
.pane.filled .an-cell{position:absolute;inset:0;width:auto;height:auto;
  cursor:pointer;pointer-events:none;}
.pane.active{outline:2px solid var(--cyan);outline-offset:1px;}
.pane.empty.active{border-color:var(--cyan);border-style:solid;
  background:#39a9c018;box-shadow:0 0 0 2px #39a9c04d inset;}
.pane.empty.active .pane-t{color:var(--cyan);}
.pane-t{font-size:10.5px;line-height:1.35;color:#c3d2df;text-align:center;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;
  -webkit-box-orient:vertical;}
.pane.empty .pane-t{color:#54677a;font-family:var(--mono);font-size:9.5px;
  letter-spacing:.1em;text-transform:uppercase;}
.pane-x{position:absolute;top:3px;right:3px;z-index:4;background:#0e1926cc;
  border:1px solid #ffffff22;border-radius:5px;color:#c9d6e2;
  cursor:pointer;font-size:11px;padding:2px 6px;line-height:1;}
.pane-x:hover{color:#fff;border-color:var(--cyan);}

/* filmstrip: mini slide thumbnails */
.film-list{flex:1;overflow-y:auto;min-height:60px;margin:0 -4px;
  padding:0 4px;}
.film-row{display:flex;align-items:center;gap:4px;border-radius:7px;
  margin-bottom:3px;cursor:grab;}
.film-row.current{background:#39a9c01c;outline:1px solid #39a9c055;
  align-items:flex-start;}
.film-row.dragging{opacity:.45;}
.film-row.drop-above{box-shadow:0 -2px 0 var(--cyan);}
.film-row.drop-below{box-shadow:0 2px 0 var(--cyan);}
.film-label{flex:1;display:flex;align-items:center;gap:9px;background:none;
  border:none;color:#c3d2df;font-size:11.5px;padding:5px 6px;cursor:pointer;
  text-align:left;min-width:0;font-family:var(--sans);}
.film-label .film-t{overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
.film-label .film-n{font-family:var(--mono);font-size:9.5px;color:#6c8093;
  width:15px;flex:none;text-align:right;}
/* the selected slide expands: number on top, big editor, title below */
.film-row.current .film-label{flex-direction:column;align-items:stretch;
  gap:6px;cursor:default;}
.film-row.current .film-n{align-self:flex-start;text-align:left;
  color:var(--cyan);}
.film-view{width:100%;min-width:0;}
.film-view .pane-editor{width:100%;margin:0;}
.mini-diagram{width:116px;height:66px;flex:none;display:grid;gap:2px;
  background:#0b141d;border:1px solid #ffffff22;border-radius:4px;
  padding:2px;overflow:hidden;}
.mini-diagram.full{grid-template-columns:1fr;}
.mini-diagram.halves{grid-template-columns:1fr 1fr;}
.mini-diagram.quarters{grid-template-columns:1fr 1fr;
  grid-template-rows:1fr 1fr;}
.mini-pane{position:relative;overflow:hidden;border-radius:2px;
  background:#1b2c3e;display:flex;align-items:center;
  justify-content:center;}
.mini-pane img{width:100%;height:100%;object-fit:contain;display:block;
  background:#fff;}
.mini-pane.is-note{background:#eef2f6 repeating-linear-gradient(180deg,
  #eef2f6 0,#eef2f6 4px,#b9c8d4 4px,#b9c8d4 5px);
  background-clip:padding-box;border:2px solid #eef2f6;}
.mini-pane.is-code{font-family:var(--mono);font-size:8.5px;
  color:#6f8ba3;background:#101d2a;}
.mini-pane.is-fig{background:#2a4761;}
.mini-pane.empty{background:#12202e;}

/* pane editor: faint live preview behind the title */
.pane-img{position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;opacity:.4;}
.pane.filled .pane-t{position:relative;z-index:1;color:#eef4f8;
  text-shadow:0 1px 3px #000c,0 0 8px #0008;}
.film-ctr{display:none;gap:1px;padding-right:5px;flex:none;}
.film-row:hover .film-ctr,.film-row.current .film-ctr{display:flex;}
.film-mini{background:none;border:none;color:#8ba0b2;cursor:pointer;
  font-size:11px;padding:2px 4px;border-radius:4px;}
.film-mini:hover{background:#ffffff14;color:#fff;}
.addslide{margin-top:8px;}

.deck-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
  background:#16273a;border:1px solid var(--cyan);color:#e6eef4;
  font-size:12.5px;font-family:var(--mono);padding:9px 16px;border-radius:8px;
  z-index:120;box-shadow:0 8px 30px #00000066;max-width:80vw;}

@media (max-width:860px){
  .deck-stage{padding:16px 52px 4px;}
  .deck-drawer{padding:12px 20px 18px;}
  .slide-grid.halves,.slide-grid.quarters{grid-template-columns:1fr;
    grid-template-rows:none;grid-auto-rows:1fr;}
}
@media (prefers-reduced-motion:reduce){.slide{animation:none;}}
"""

_DECK_JS = r"""
(function(){
  var deckEl=document.getElementById('deck');
  if(!deckEl) return;
  var APP=window.SemApp||{mode:'static',shells:{},order:[],
    project:{presentations:[],recent:[]}};

  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  function esc(t){var d=document.createElement('div');d.textContent=(t==null?'':String(t));return d.innerHTML;}
  function deep(o){return JSON.parse(JSON.stringify(o));}

  var stage=$('#deck-stage');
  /* layouts are just preset ARRANGEMENTS of cell frames (percent rects);
     every box on a slide is a "+ Cell" frame — movable and resizable */
  var PRESETS={
    full:[[3,4,94,91]],
    halves:[[2,7,47.5,86],[50.5,7,47.5,86]],
    rows:[[6,2,88,47],[6,51,88,47]],
    quarters:[[2,2,47.5,47],[50.5,2,47.5,47],
              [2,51,47.5,47],[50.5,51,47.5,47]]
  };
  /* the slide-template catalog: each layout is a list of typed slots —
     notebook-card frames (k:'cell') and plain text boxes (k:'text', with a
     placeholder + size). A title slide is simply two text boxes; there is no
     special title mode. h on a text slot is only used to draw the picker
     preview (the real text box auto-sizes to its content). */
  var LAYOUTS=[
    {id:'title',label:'Title',items:[
      {k:'text',x:12,y:33,w:76,h:16,text:'Presentation title',size:7,b:1,
        align:'center'},
      {k:'text',x:12,y:55,w:76,h:8,text:'Subtitle',size:3.4,align:'center'}]},
    {id:'section',label:'Section',items:[
      {k:'text',x:8,y:41,w:84,h:18,text:'Section',size:8,b:1,
        align:'center'}]},
    {id:'title-body',label:'Title + text',items:[
      {k:'text',x:6,y:6,w:88,h:12,text:'Title',size:5,b:1},
      {k:'text',x:6,y:24,w:88,h:64,text:'Body text',size:3}]},
    {id:'full',label:'One panel',items:[
      {k:'cell',x:3,y:4,w:94,h:91}]},
    {id:'title-full',label:'Title + panel',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'cell',x:4,y:20,w:92,h:76}]},
    {id:'halves',label:'Two panels',items:[
      {k:'cell',x:2,y:7,w:47.5,h:86},{k:'cell',x:50.5,y:7,w:47.5,h:86}]},
    {id:'title-halves',label:'Title + two',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'cell',x:3,y:20,w:46.5,h:76},{k:'cell',x:50.5,y:20,w:46.5,h:76}]},
    {id:'rows',label:'Stacked',items:[
      {k:'cell',x:6,y:2,w:88,h:47},{k:'cell',x:6,y:51,w:88,h:47}]},
    {id:'title-rows',label:'Title + stack',items:[
      {k:'text',x:5,y:4,w:90,h:10,text:'Title',size:5,b:1},
      {k:'cell',x:6,y:17,w:88,h:39},{k:'cell',x:6,y:58,w:88,h:39}]},
    {id:'quarters',label:'Four panels',items:[
      {k:'cell',x:2,y:2,w:47.5,h:47},{k:'cell',x:50.5,y:2,w:47.5,h:47},
      {k:'cell',x:2,y:51,w:47.5,h:47},{k:'cell',x:50.5,y:51,w:47.5,h:47}]},
    {id:'text-cell',label:'Text | panel',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'text',x:5,y:23,w:40,h:60,text:'Body text',size:3},
      {k:'cell',x:49,y:20,w:47,h:76}]},
    {id:'cell-text',label:'Panel | text',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'cell',x:4,y:20,w:47,h:76},
      {k:'text',x:56,y:23,w:39,h:60,text:'Body text',size:3}]},
    {id:'cell-above',label:'Panel / text',items:[
      {k:'cell',x:4,y:4,w:92,h:62},
      {k:'text',x:6,y:70,w:88,h:26,text:'Body text',size:2.8}]},
    {id:'text-above',label:'Text / panel',items:[
      {k:'text',x:6,y:5,w:88,h:14,text:'Title',size:4.4,b:1},
      {k:'cell',x:4,y:22,w:92,h:74}]},
    {id:'blank',label:'Blank',items:[]},
    /* ---- POSTER templates -------------------------------------------
       Modelled on what actually hangs in a conference poster hall: a title
       banner over authors/affiliation, NUMBERED section headings (a reader
       walking past needs to know the reading order), prose for
       Introduction / Discussion / Conclusions and figure panels for
       Results, and a footer for references, funding and contact. The
       headings are real text boxes, so they are editable like anything
       else. `land:1` marks the templates shaped for a landscape page.
       Text `size` is a % of page HEIGHT, so the landscape templates carry
       larger numbers for the same physical type size. ---- */
    {id:'poster-3col',label:'3 columns · classic',poster:1,items:[
      {k:'text',x:3,y:1.4,w:94,h:3.6,
        text:'Poster title — the finding in one line',size:3.1,b:1,
        align:'center'},
      {k:'text',x:8,y:5.4,w:84,h:2.2,
        text:'Author, Author · Institution · contact@institution.edu',
        size:1.4,align:'center'},
      {k:'text',x:2.5,y:9.2,w:29.7,h:2.6,text:'1 · Introduction',
        size:1.9,b:1},
      {k:'text',x:2.5,y:12.4,w:29.7,h:13,
        text:'Why this matters, the question you asked, and what was '
          +'already known.',size:1.35},
      {k:'text',x:2.5,y:26.8,w:29.7,h:2.6,text:'2 · Data & methods',
        size:1.9,b:1},
      {k:'text',x:2.5,y:30,w:29.7,h:10.5,
        text:'Data sources, processing and the analysis in brief.',
        size:1.35},
      {k:'cell',x:2.5,y:42,w:29.7,h:22},
      {k:'text',x:2.5,y:65.6,w:29.7,h:2.6,text:'3 · Key numbers',
        size:1.9,b:1},
      {k:'cell',x:2.5,y:68.8,w:29.7,h:22.8},
      {k:'text',x:35.15,y:9.2,w:29.7,h:2.6,text:'4 · Results',
        size:1.9,b:1},
      {k:'cell',x:35.15,y:12.4,w:29.7,h:37.5},
      {k:'cell',x:35.15,y:51.5,w:29.7,h:40.1},
      {k:'text',x:67.8,y:9.2,w:29.7,h:2.6,text:'5 · Results continued',
        size:1.9,b:1},
      {k:'cell',x:67.8,y:12.4,w:29.7,h:29},
      {k:'text',x:67.8,y:43,w:29.7,h:2.6,text:'6 · Discussion',
        size:1.9,b:1},
      {k:'text',x:67.8,y:46.2,w:29.7,h:17.5,
        text:'What the results mean, and the caveats.',size:1.35},
      {k:'text',x:67.8,y:65.6,w:29.7,h:2.6,text:'7 · Conclusions',
        size:1.9,b:1},
      {k:'text',x:67.8,y:68.8,w:29.7,h:22.8,
        text:'The take-home messages, as short bullets.',size:1.4},
      {k:'text',x:2.5,y:93.4,w:95,h:4.6,
        text:'References · Funding & acknowledgements · '
          +'Code and data: github.com/…',size:1.1}]},
    {id:'poster-2col',label:'2 columns · wide figures',poster:1,items:[
      {k:'text',x:3,y:1.4,w:94,h:3.8,text:'Poster title',size:3.3,b:1,
        align:'center'},
      {k:'text',x:8,y:5.6,w:84,h:2.2,
        text:'Author, Author · Institution',size:1.5,align:'center'},
      {k:'text',x:2.5,y:9.4,w:46,h:2.8,text:'1 · Introduction',
        size:2.1,b:1},
      {k:'text',x:2.5,y:12.8,w:46,h:14,
        text:'Motivation, the question, and the gap this fills.',
        size:1.5},
      {k:'text',x:2.5,y:28.2,w:46,h:2.8,text:'2 · Methods',size:2.1,b:1},
      {k:'text',x:2.5,y:31.6,w:46,h:12.5,
        text:'Data and analysis, in enough detail to be believed.',
        size:1.5},
      {k:'cell',x:2.5,y:45.6,w:46,h:24},
      {k:'text',x:2.5,y:71.4,w:46,h:2.8,text:'4 · Take-home message',
        size:2.1,b:1},
      {k:'text',x:2.5,y:74.8,w:46,h:15,
        text:'The one thing you want remembered.',size:1.7,b:1},
      {k:'text',x:51.5,y:9.4,w:46,h:2.8,text:'3 · Results',size:2.1,b:1},
      {k:'cell',x:51.5,y:12.8,w:46,h:37},
      {k:'cell',x:51.5,y:51.2,w:46,h:38.6},
      {k:'text',x:2.5,y:92,w:95,h:5.5,
        text:'References · Acknowledgements · contact@institution.edu',
        size:1.2}]},
    {id:'poster-fig',label:'Hero figure',poster:1,items:[
      {k:'text',x:3,y:1.4,w:94,h:3.6,text:'Poster title',size:3.1,b:1,
        align:'center'},
      {k:'text',x:8,y:5.4,w:84,h:2.2,
        text:'Author, Author · Institution',size:1.4,align:'center'},
      {k:'text',x:2.5,y:9.4,w:95,h:2.8,text:'Headline result',
        size:2,b:1},
      {k:'cell',x:2.5,y:12.8,w:95,h:42},
      {k:'text',x:2.5,y:56.4,w:95,h:2.6,text:'Supporting evidence',
        size:1.8,b:1},
      {k:'cell',x:2.5,y:59.8,w:29.7,h:22},
      {k:'cell',x:35.15,y:59.8,w:29.7,h:22},
      {k:'cell',x:67.8,y:59.8,w:29.7,h:22},
      {k:'text',x:2.5,y:83.6,w:46,h:2.6,text:'What it means',
        size:1.8,b:1},
      {k:'text',x:2.5,y:86.8,w:46,h:8,
        text:'Interpretation and limitations.',size:1.35},
      {k:'text',x:51.5,y:83.6,w:46,h:2.6,text:'Methods in brief',
        size:1.8,b:1},
      {k:'text',x:51.5,y:86.8,w:46,h:8,
        text:'Data, model, validation.',size:1.35},
      {k:'text',x:2.5,y:95.6,w:95,h:3.6,
        text:'References · contact@institution.edu',size:1}]},
    {id:'poster-flow',label:'Intro → results → conclusions',poster:1,
      items:[
      {k:'text',x:3,y:1.4,w:94,h:3.6,text:'Poster title',size:3.1,b:1,
        align:'center'},
      {k:'text',x:8,y:5.4,w:84,h:2.2,
        text:'Author, Author · Institution',size:1.4,align:'center'},
      {k:'text',x:2.5,y:9.4,w:95,h:2.6,text:'1 · Introduction',
        size:1.9,b:1},
      {k:'text',x:2.5,y:12.6,w:95,h:7.5,
        text:'Motivation, question, and data — two or three sentences.',
        size:1.4},
      {k:'text',x:2.5,y:21.6,w:95,h:2.6,text:'2 · Results',size:1.9,b:1},
      {k:'cell',x:2.5,y:24.8,w:46,h:32},
      {k:'cell',x:51.5,y:24.8,w:46,h:32},
      {k:'cell',x:2.5,y:58.4,w:46,h:27},
      {k:'cell',x:51.5,y:58.4,w:46,h:27},
      {k:'text',x:2.5,y:87,w:95,h:2.6,text:'3 · Conclusions',
        size:1.9,b:1},
      {k:'text',x:2.5,y:90.2,w:95,h:6,
        text:'What it means, and what is next.',size:1.4},
      {k:'text',x:2.5,y:96.8,w:95,h:2.8,
        text:'References · Acknowledgements · contact@institution.edu',
        size:1}]},
    {id:'poster-billboard',label:'Billboard · one big message',poster:1,
      items:[
      {k:'text',x:3,y:1.6,w:94,h:3.2,text:'Poster title',size:2.6,b:1,
        align:'center'},
      {k:'text',x:8,y:5.2,w:84,h:2,
        text:'Author, Author · Institution',size:1.3,align:'center'},
      {k:'text',x:5,y:9.6,w:90,h:15,
        text:'The one sentence a passer-by should remember.',
        size:4.6,b:1,align:'center'},
      {k:'cell',x:5,y:26.5,w:90,h:37},
      {k:'text',x:2.5,y:66,w:29.7,h:2.6,text:'Why it matters',
        size:1.7,b:1},
      {k:'text',x:2.5,y:69.2,w:29.7,h:20,
        text:'The problem, in plain words.',size:1.25},
      {k:'text',x:35.15,y:66,w:29.7,h:2.6,text:'How we did it',
        size:1.7,b:1},
      {k:'text',x:35.15,y:69.2,w:29.7,h:20,
        text:'Data, method, validation.',size:1.25},
      {k:'text',x:67.8,y:66,w:29.7,h:2.6,text:'Detail & references',
        size:1.7,b:1},
      {k:'text',x:67.8,y:69.2,w:29.7,h:20,
        text:'Caveats, citations, funding.',size:1.25},
      {k:'text',x:2.5,y:91,w:95,h:3.4,
        text:'Paper, code and data: github.com/… · contact@institution.edu',
        size:1.05,align:'center'}]},
    {id:'poster-4col',label:'4 columns · dense',poster:1,items:[
      {k:'text',x:3,y:1.2,w:94,h:3.2,text:'Poster title',size:2.9,b:1,
        align:'center'},
      {k:'text',x:8,y:4.9,w:84,h:2,
        text:'Author, Author · Institution',size:1.3,align:'center'},
      {k:'text',x:2.5,y:8.8,w:21.87,h:2.4,text:'1 · Introduction',
        size:1.7,b:1},
      {k:'text',x:2.5,y:11.8,w:21.87,h:16,
        text:'Motivation and question.',size:1.25},
      {k:'text',x:2.5,y:29.2,w:21.87,h:2.4,text:'2 · Methods',
        size:1.7,b:1},
      {k:'text',x:2.5,y:32.2,w:21.87,h:14,
        text:'Data and analysis.',size:1.25},
      {k:'cell',x:2.5,y:47.6,w:21.87,h:20},
      {k:'cell',x:2.5,y:69,w:21.87,h:22.5},
      {k:'text',x:26.87,y:8.8,w:21.87,h:2.4,text:'3 · Results',
        size:1.7,b:1},
      {k:'cell',x:26.87,y:11.8,w:21.87,h:26},
      {k:'cell',x:26.87,y:39.6,w:21.87,h:26},
      {k:'cell',x:26.87,y:67.4,w:21.87,h:24.1},
      {k:'text',x:51.25,y:8.8,w:21.87,h:2.4,text:'4 · Results continued',
        size:1.7,b:1},
      {k:'cell',x:51.25,y:11.8,w:21.87,h:26},
      {k:'cell',x:51.25,y:39.6,w:21.87,h:26},
      {k:'cell',x:51.25,y:67.4,w:21.87,h:24.1},
      {k:'text',x:75.62,y:8.8,w:21.87,h:2.4,text:'5 · Discussion',
        size:1.7,b:1},
      {k:'text',x:75.62,y:11.8,w:21.87,h:24,
        text:'Interpretation and caveats.',size:1.25},
      {k:'text',x:75.62,y:37.2,w:21.87,h:2.4,text:'6 · Conclusions',
        size:1.7,b:1},
      {k:'text',x:75.62,y:40.2,w:21.87,h:22,
        text:'The take-home messages.',size:1.3},
      {k:'text',x:75.62,y:63.8,w:21.87,h:2.4,text:'References',
        size:1.7,b:1},
      {k:'text',x:75.62,y:66.8,w:21.87,h:24.7,
        text:'Citations and funding.',size:1.05},
      {k:'text',x:2.5,y:93,w:95,h:5,
        text:'Acknowledgements · contact@institution.edu',size:1.05}]},
    {id:'poster-land3',label:'Landscape · 3 columns',poster:1,land:1,
      items:[
      {k:'text',x:2.5,y:2.2,w:95,h:6,text:'Poster title',size:4.4,b:1,
        align:'center'},
      {k:'text',x:10,y:9,w:80,h:3.4,
        text:'Author, Author · Institution · contact@institution.edu',
        size:2,align:'center'},
      {k:'text',x:2.5,y:15.5,w:29.7,h:4,text:'1 · Introduction',
        size:2.6,b:1},
      {k:'text',x:2.5,y:20.5,w:29.7,h:20,
        text:'Motivation, the question, and what was already known.',
        size:1.85},
      {k:'text',x:2.5,y:42.5,w:29.7,h:4,text:'2 · Methods',size:2.6,b:1},
      {k:'text',x:2.5,y:47.5,w:29.7,h:16,
        text:'Data sources and analysis.',size:1.85},
      {k:'cell',x:2.5,y:65.5,w:29.7,h:22.5},
      {k:'text',x:35.15,y:15.5,w:29.7,h:4,text:'3 · Results',
        size:2.6,b:1},
      {k:'cell',x:35.15,y:20.5,w:29.7,h:32},
      {k:'cell',x:35.15,y:54.5,w:29.7,h:33.5},
      {k:'text',x:67.8,y:15.5,w:29.7,h:4,text:'4 · Discussion',
        size:2.6,b:1},
      {k:'text',x:67.8,y:20.5,w:29.7,h:23,
        text:'What the results mean, and the caveats.',size:1.85},
      {k:'text',x:67.8,y:45.5,w:29.7,h:4,text:'5 · Conclusions',
        size:2.6,b:1},
      {k:'text',x:67.8,y:50.5,w:29.7,h:37.5,
        text:'The take-home messages, as short bullets.',size:1.9},
      {k:'text',x:2.5,y:89.5,w:95,h:7,
        text:'References · Funding · Code and data: github.com/…',
        size:1.5}]},
    {id:'poster-land-fig',label:'Landscape · hero + notes',poster:1,
      land:1,items:[
      {k:'text',x:2.5,y:2.2,w:95,h:6,text:'Poster title',size:4.4,b:1,
        align:'center'},
      {k:'text',x:10,y:9,w:80,h:3.2,
        text:'Author, Author · Institution',size:1.9,align:'center'},
      {k:'text',x:2.5,y:15.5,w:63,h:4,text:'Headline result',
        size:2.6,b:1},
      {k:'cell',x:2.5,y:20.5,w:63,h:60},
      {k:'text',x:2.5,y:82,w:63,h:6.5,
        text:'What this figure shows, and the key numbers.',size:1.6},
      {k:'text',x:67.8,y:15.5,w:29.7,h:4,text:'Introduction',
        size:2.4,b:1},
      {k:'text',x:67.8,y:20.5,w:29.7,h:22,
        text:'Motivation and question.',size:1.8},
      {k:'text',x:67.8,y:44,w:29.7,h:4,text:'Methods',size:2.4,b:1},
      {k:'text',x:67.8,y:49,w:29.7,h:14,
        text:'Data and analysis.',size:1.8},
      {k:'text',x:67.8,y:64.5,w:29.7,h:4,text:'Conclusions',
        size:2.4,b:1},
      {k:'text',x:67.8,y:69.5,w:29.7,h:19,
        text:'The take-home messages.',size:1.85},
      {k:'text',x:2.5,y:89.5,w:95,h:7,
        text:'References · Acknowledgements · contact@institution.edu',
        size:1.5}]}
  ];
  var LAYOUTBYID={};
  LAYOUTS.forEach(function(l){LAYOUTBYID[l.id]=l;});
  /* apply a template to a slide: reposition the cards/text it already has
     into the template's slots (in order), fill empty slots with placeholders,
     and keep any free decorations (arrows/images/shapes) the user added. */
  function applyLayout(s,layout){
    if(!s||!layout) return;
    s.layout='blank';s.lay=layout.id;
    var old=s.annots||[];
    var cells=old.filter(function(a){return a.k==='cell';});
    var texts=old.filter(function(a){return a.k==='text';});
    var keep=old.filter(function(a){return a.k!=='cell'&&a.k!=='text';});
    var ci=0,ti=0,next=[];
    (layout.items||[]).forEach(function(it){
      if(it.k==='cell'){
        var c=cells[ci++]||{k:'cell',ref:null};
        c.k='cell';c.x=it.x;c.y=it.y;c.w=it.w;c.h=it.h;
        next.push(c);
      } else {
        var t=texts[ti++];
        if(t){t.x=it.x;t.y=it.y;t.w=it.w;
          if(!t.text) t.text=it.text||'Text';
          next.push(t);
        } else next.push({k:'text',x:it.x,y:it.y,w:it.w,
          text:it.text||'Text',size:it.size||2.8,color:'#ffffff',
          bg:0,align:it.align||'left',b:it.b?1:0});
      }
    });
    /* don't lose placed cards / typed text beyond the template's slots */
    for(;ci<cells.length;ci++) if(cells[ci].ref) next.push(cells[ci]);
    for(;ti<texts.length;ti++) next.push(texts[ti]);
    s.annots=keep.concat(next);
    if(!s.annots.length) delete s.annots;
  }
  function layIcon(layout){
    var ic=document.createElement('span');ic.className='layico2';
    /* a poster template previews at its OWN aspect — a landscape template
       drawn in a portrait box is unrecognisable */
    if(layout.poster)
      ic.style.aspectRatio=layout.land?'1189 / 841':'841 / 1189';
    (layout.items||[]).forEach(function(it){
      var b=document.createElement('span');
      b.className=(it.k==='text'?'li-text':'li-cell');
      b.style.left=it.x+'%';b.style.top=it.y+'%';
      b.style.width=(it.w||20)+'%';b.style.height=(it.h||20)+'%';
      ic.appendChild(b);
    });
    return ic;
  }
  function renderLayoutPicker(){
    /* the same catalog renders twice: in the builder panel (create mode)
       and in the ribbon's Layouts dropdown (edit mode). A poster page is
       offered POSTER templates ONLY and a slide page SLIDE templates only
       — the other family was never applicable, just noise to scroll past
       (2026-07-29). Within the poster family, the templates shaped like
       the current page come first. */
    var pg=pageOf();
    var isPoster=!!pg.poster;
    var land=pg.aw>pg.ah;
    var variant=(isPoster?'p':'s')+(land?'l':'p');
    ['#layout-row','#layout-menu-grid'].forEach(function(sel){
      var row=$(sel); if(!row||row.dataset.built===variant) return;
      row.dataset.built=variant;row.innerHTML='';
      var list=LAYOUTS.filter(function(l){return !!l.poster===isPoster;});
      if(isPoster) list=list.slice().sort(function(a,b){
        return (!!a.land===land?0:1)-(!!b.land===land?0:1);});
      var h=document.createElement('div');h.className='lay-sec';
      h.textContent=isPoster?'Poster layouts':'Slide layouts';
      row.appendChild(h);
      list.forEach(function(layout){
        var b=document.createElement('button');
        b.className='dbtn lay';b.dataset.lay=layout.id;b.type='button';
        b.title=layout.label;
        b.appendChild(layIcon(layout));
        var lb=document.createElement('span');lb.className='lay-lb';
        lb.textContent=layout.label;b.appendChild(lb);
        b.addEventListener('click',function(){
          var s=pres.slides[cur]; if(!s) return;
          applyLayout(s,layout);
          activePane=-1;markDirty();refresh();
          closeLayMenu();
        });
        row.appendChild(b);
      });
    });
  }
  /* the ribbon's Layouts / Page dropdowns: open one, the other closes */
  function closeLayMenu(){
    var lm=$('#lay-menu'),lb=$('#lay-btn');
    if(lm&&!lm.hidden){lm.hidden=true;
      if(lb) lb.setAttribute('aria-expanded','false');}
  }
  function closePageMenu(){
    var pm=$('#page-menu'),pb=$('#page-btn');
    if(pm&&!pm.hidden){pm.hidden=true;
      if(pb) pb.setAttribute('aria-expanded','false');}
  }
  /* ---- page size: slides or a poster — ONE builder for both. The page
     is a per-presentation preset; a poster is just a big page. ---- */
  var PAGE_PRESETS=[
    {id:'16x9',label:'Slides 16:9',aw:16,ah:9,mm:[339,191]},
    {id:'4x3',label:'Slides 4:3',aw:4,ah:3,mm:[254,190]},
    {id:'a4p',label:'A4 portrait',aw:210,ah:297,mm:[210,297]},
    {id:'a4l',label:'A4 landscape',aw:297,ah:210,mm:[297,210]},
    /* poster:1 = "this is a poster" — it selects the poster template
       family and the bigger editor chrome. A4 is a page, not a poster. */
    {id:'a1p',label:'Poster A1 portrait',aw:594,ah:841,mm:[594,841],
      poster:1},
    {id:'a1l',label:'Poster A1 landscape',aw:841,ah:594,mm:[841,594],
      poster:1},
    {id:'a0p',label:'Poster A0 portrait',aw:841,ah:1189,mm:[841,1189],
      poster:1},
    {id:'a0l',label:'Poster A0 landscape',aw:1189,ah:841,mm:[1189,841],
      poster:1}];
  function pageOf(){
    var id=pres&&pres.page;
    for(var i=0;i<PAGE_PRESETS.length;i++)
      if(PAGE_PRESETS[i].id===id) return PAGE_PRESETS[i];
    return PAGE_PRESETS[0];
  }
  var deckZoom=0;               /* 0 = fit-to-window */
  function applyPage(){
    var pg=pageOf();
    deckEl.style.setProperty('--page-ar',pg.aw+' / '+pg.ah);
    deckEl.classList.toggle('custom-page',pg.id!=='16x9');
    /* poster work happens at arm's length from a wall-sized page — the
       editor's own chrome grows to match (2026-07-29) */
    deckEl.classList.toggle('poster-page',!!pg.poster);
    var b=$('#page-btn');
    if(b) b.innerHTML='&#9645; '
      +(pg.id==='16x9'?'Page':esc(pg.label))+' &#9662;';
    $$('#page-menu .page-opt').forEach(function(o){
      o.setAttribute('aria-pressed',
        (o.dataset.page===pg.id).toString());});
    renderLayoutPicker();   /* poster pages list poster templates first */
  }
  function sizeSlideTo(slideEl,zoom){
    var pg=pageOf();
    var pad=36;
    var aw=stage.clientWidth-pad,ah=stage.clientHeight-pad;
    if(!slideEl||aw<=60||ah<=60) return;
    var fitW=Math.min(aw,ah*pg.aw/pg.ah);
    var w=fitW*(zoom||1),h=w*pg.ah/pg.aw;
    slideEl.style.width=w+'px';
    slideEl.style.height=h+'px';
    /* the stylesheet's flex:1 / max-height:100% must not fight the explicit
       page size — else zoom grows width-only (distortion) and playback
       letterboxing never bites */
    slideEl.style.flex='none';
    slideEl.style.maxWidth='none';
    slideEl.style.maxHeight='none';
    slideEl.style.margin='auto';
    stage.classList.toggle('zoomed',w>aw+1||h>ah+1);
  }
  function applyZoom(){
    if(deckEl.hidden) return;
    var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
    if(mode==='edit'){
      sizeSlideTo(slideEl,deckZoom||1);
      var zl=$('#zoom-val');
      if(zl) zl.textContent=deckZoom
        ?Math.round(deckZoom*100)+'%':'Fit';
    } else if(deckEl.classList.contains('custom-page')){
      /* playing a poster / portrait page letterboxes to the page */
      sizeSlideTo(slideEl,1);
    }
  }
  function setZoom(z){deckZoom=z;applyZoom();}
  (function(){
    var zi=$('#zoom-in'),zo=$('#zoom-out'),zv=$('#zoom-val');
    if(zi) zi.addEventListener('click',function(){
      setZoom(Math.min(6,(deckZoom||1)*1.25));});
    if(zo) zo.addEventListener('click',function(){
      setZoom(Math.max(0.25,(deckZoom||1)/1.25));});
    if(zv) zv.addEventListener('click',function(){setZoom(0);});
    window.addEventListener('resize',function(){
      if(!deckEl.hidden) applyZoom();});
  })();
  (function(){
    var pb=$('#page-btn'),pm=$('#page-menu'),pd=$('#page-drop');
    if(!pb||!pm) return;
    PAGE_PRESETS.forEach(function(pg){
      var o=document.createElement('button');
      o.className='dc-mi page-opt';o.type='button';
      o.dataset.page=pg.id;
      o.textContent=pg.label
        +(pg.id==='16x9'?'':' · '+pg.mm[0]+'×'+pg.mm[1]+' mm');
      o.addEventListener('click',function(e){
        e.stopPropagation();
        if(pg.id==='16x9') delete pres.page; else pres.page=pg.id;
        pm.hidden=true;pb.setAttribute('aria-expanded','false');
        deckZoom=0;
        markDirty();applyPage();refresh();
      });
      pm.appendChild(o);
    });
    pb.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=pm.hidden;
      if(willOpen) closeLayMenu();
      pm.hidden=!willOpen;
      pb.setAttribute('aria-expanded',willOpen.toString());
    });
    document.addEventListener('click',function(e){
      if(!pm.hidden&&pd&&!pd.contains(e.target)){
        pm.hidden=true;pb.setAttribute('aria-expanded','false');}
    });
  })();
  /* ---- Objects pane (layers v1): list / select / hide / lock ---- */
  function annotLabel(a){
    if(a.k==='cell'){
      var it=a.ref?resolveRef(a.ref):null;
      return it?it.title:'Empty frame';
    }
    if(a.k==='text')
      return 'Text — '+(String(a.text||'').trim().slice(0,26)||'(empty)');
    if(a.k==='image') return 'Image';
    if(a.k==='arrow') return 'Arrow';
    if(a.k==='rect') return 'Shape — '+(a.shape||'box');
    return a.k;
  }
  function renderSelPane(){
    var pane=$('#selpane'),list=$('#selpane-list');
    if(!pane||pane.hidden||!list) return;
    list.innerHTML='';
    var s=pres.slides[cur];
    var ann=(s&&s.annots)||[];
    if(!ann.length){
      list.innerHTML='<div class="selpane-empty">Nothing on this '
        +'slide yet.</div>';
      return;
    }
    /* handlers resolve the CURRENT slide's annot at event time (never a
       closure) — the pane can't mutate or repaint a stale slide */
    function liveAnnot(i){
      var s2=pres.slides[cur];
      return (s2&&s2.annots||[])[i]||null;
    }
    function toggleFlag(i,flag){
      var a2=liveAnnot(i);
      if(!a2){renderSelPane();return;}
      if(a2[flag]) delete a2[flag]; else a2[flag]=1;
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}
      renderSelPane();
    }
    function row(a,i){
      var r=document.createElement('div');
      r.className='sp-row'+(selSet.indexOf(i)>=0?' sel':'')
        +(a.hide?' offrow':'');
      var k=document.createElement('span');
      k.className='sp-kind k-'+a.k;r.appendChild(k);
      var t=document.createElement('span');t.className='sp-t';
      t.textContent=annotLabel(a);t.title=t.textContent;
      r.appendChild(t);
      var eye=document.createElement('button');
      eye.className='sp-act'+(a.hide?' on':'');eye.type='button';
      eye.innerHTML='&#128065;';
      eye.title=a.hide?'Show while editing'
        :'Hide while editing (still shows when presenting)';
      eye.addEventListener('click',function(e){
        e.stopPropagation();toggleFlag(i,'hide');});
      r.appendChild(eye);
      var lk=document.createElement('button');
      lk.className='sp-act'+(a.lock?' on':'');lk.type='button';
      lk.innerHTML='&#128274;';
      lk.title=a.lock?'Unlock':'Lock (can’t be clicked or '
        +'dragged on the canvas)';
      lk.addEventListener('click',function(e){
        e.stopPropagation();toggleFlag(i,'lock');});
      r.appendChild(lk);
      r.addEventListener('click',function(){
        if(!liveAnnot(i)){renderSelPane();return;}
        var l=stage.querySelector('.annot-layer');
        if(l) selectAnnot(l,i);
        renderSelPane();
      });
      list.appendChild(r);
    }
    for(var i=ann.length-1;i>=0;i--) row(ann[i],i);  /* front-most first */
  }
  (function(){
    var ob=$('#objects-btn'),pane=$('#selpane'),cl=$('#selpane-close');
    if(!ob||!pane) return;
    function set(open){
      pane.hidden=!open;
      ob.setAttribute('aria-pressed',open.toString());
      if(open) renderSelPane();
    }
    ob.addEventListener('click',function(){set(pane.hidden);});
    if(cl) cl.addEventListener('click',function(){set(false);});
  })();
  (function(){
    var lb=$('#lay-btn'),lm=$('#lay-menu'),ld=$('#lay-drop');
    if(!lb||!lm) return;
    lb.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=lm.hidden;
      if(willOpen) closePageMenu();
      lm.hidden=!willOpen;
      lb.setAttribute('aria-expanded',willOpen.toString());
    });
    document.addEventListener('click',function(e){
      if(!lm.hidden&&ld&&!ld.contains(e.target)) closeLayMenu();
    });
  })();
  function slideCells(s){
    return (s&&s.annots||[]).map(function(a,i){return {a:a,i:i};})
      .filter(function(p){return p.a.k==='cell';});
  }

  /* ---------- registry: every open notebook's cards ----------
     Refs are namespaced "stem::anchor" so one deck can mix cards from
     every open tab; plain legacy anchors still resolve. */
  var ITEMS={};        /* ns -> item {..., nb, ns} */
  var SHELLITEMS={};   /* stem -> [ns, ...] in document order */
  var nbPres=[];       /* presentations embedded in notebooks (namespaced) */
  function nsKey(stem,anchor){return stem+'::'+anchor;}
  function splitRef(ref){
    var i=String(ref).indexOf('::');
    return i<0?[null,String(ref)]:[String(ref).slice(0,i),String(ref).slice(i+2)];
  }
  function resolveRef(ref){
    if(!ref) return null;
    if(ITEMS[ref]) return ITEMS[ref];
    if(String(ref).indexOf('::')>=0) return null;
    for(var s=0;s<APP.order.length;s++){
      var k=nsKey(APP.order[s],ref);
      if(ITEMS[k]) return ITEMS[k];
    }
    return null;
  }
  function normRef(ref){
    if(!ref) return null;
    var it=resolveRef(ref);
    return it?it.ns:String(ref);
  }
  function normPres(p,stem){
    /* deep-copy a presentation, namespacing plain anchors (against
       `stem` when it came from one notebook, else best-effort);
       folder, title-slide text and free annotations ride along.
       Legacy grid-pane slides convert to preset cell-frame layouts. */
    /* A CUSTOM VIEW has no slides to normalise — and it must keep kind /
       nb / style / view or it comes back as a plain deck and clicking its
       row opens the slide editor instead (that was the bug where a custom
       view "took you to the presentation below it"). */
    if(p&&p.kind==='view'){
      var v={name:String(p.name||'view'),kind:'view',slides:[],
        nb:typeof p.nb==='string'?p.nb:'',
        style:p.style?JSON.parse(JSON.stringify(p.style)):{},
        view:p.view?JSON.parse(JSON.stringify(p.view)):{}};
      if(typeof p.folder==='string'&&p.folder) v.folder=p.folder;
      return v;
    }
    function ns(a){
      if(!a) return null;
      if(String(a).indexOf('::')>=0) return a;
      return stem?nsKey(stem,a):(normRef(a)||a);
    }
    var out={name:String(p.name||'presentation'),
      slides:(p.slides||[]).map(function(s){
        var o={layout:s.layout,
          panes:(s.panes||[]).map(ns)};
        if(s.layout==='title'){
          o.title=String(s.title||'');o.sub=String(s.sub||'');
          if(s.tprops) o.tprops=JSON.parse(JSON.stringify(s.tprops));
          if(s.sprops) o.sprops=JSON.parse(JSON.stringify(s.sprops));
        }
        if(Array.isArray(s.annots)&&s.annots.length)
          o.annots=JSON.parse(JSON.stringify(s.annots));
        (o.annots||[]).forEach(function(a){
          if(a.k==='cell'&&a.ref) a.ref=ns(a.ref);
        });
        /* steps hidden in the code trace (namespaced refs) */
        if(Array.isArray(s.hidden)&&s.hidden.length)
          o.hidden=s.hidden.map(ns).filter(Boolean);
        /* legacy pane layouts -> cell frames at the preset rects */
        if(o.layout!=='title'){
          if(PRESETS[o.layout]){
            var rects=PRESETS[o.layout];
            o.annots=o.annots||[];
            for(var i=0;i<rects.length;i++){
              o.annots.push({k:'cell',x:rects[i][0],y:rects[i][1],
                w:rects[i][2],h:rects[i][3],
                ref:o.panes[i]||null});
            }
          }
          o.layout='blank';
        }
        o.panes=[];
        return o;
      })};
    if(typeof p.folder==='string'&&p.folder) out.folder=p.folder;
    if(p.showNums) out.showNums=1;   /* keep the slide-numbers preference */
    if(typeof p.page==='string'&&p.page) out.page=p.page;  /* page preset */
    return out;
  }
  function registerShell(stem,data){
    Object.keys(ITEMS).forEach(function(k){
      if(ITEMS[k].nb===stem) delete ITEMS[k];});
    SHELLITEMS[stem]=[];
    (data.items||[]).forEach(function(it){
      var o={};for(var k in it) o[k]=it[k];
      o.nb=stem;o.ns=nsKey(stem,it.anchor);
      ITEMS[o.ns]=o;SHELLITEMS[stem].push(o.ns);
      /* also resolve by the card slug so decks saved before anchors
         became positional still find their frames (unchanged cards) */
      if(it.card){
        var alias=nsKey(stem,it.card);
        if(alias!==o.ns&&!ITEMS[alias]) ITEMS[alias]=o;
      }
    });
    nbPres=nbPres.filter(function(p){return p.origin!==stem;});
    (data.presentations||[]).forEach(function(p){
      var cp=normPres(p,stem);cp.origin=stem;nbPres.push(cp);
    });
  }
  function unregisterShell(stem){
    Object.keys(ITEMS).forEach(function(k){
      if(ITEMS[k].nb===stem) delete ITEMS[k];});
    delete SHELLITEMS[stem];
    nbPres=nbPres.filter(function(p){return p.origin!==stem;});
  }
  APP.order.forEach(function(stem){
    registerShell(stem,APP.shells[stem].data||{});});

  /* ---------- saved presentations: project file + notebook-embedded --- */
  var projectPres=(APP.project&&Array.isArray(APP.project.presentations))
    ?deep(APP.project.presentations).map(function(p){return normPres(p);})
    :[];
  function allSaved(){
    var out=[],seen={};
    projectPres.forEach(function(p){out.push(p);seen[p.name]=1;});
    nbPres.forEach(function(p){
      var n=p.name;
      if(seen[n]) n=p.name+' ('+p.origin+')';
      if(seen[n]) return;
      var cp=deep(p);cp.name=n;out.push(cp);seen[n]=1;
    });
    return out;
  }
  function savedByName(name){
    return allSaved().filter(function(p){return p.name===name;})[0]||null;
  }

  /* ---------- draft persistence scope ---------- */
  var SCOPE=APP.mode==='app'?'proj:'+(APP.root||'')
    :APP.mode==='web'?'web:'+location.pathname
    :(APP.order.length>1
      ?'bundle:'+APP.order.slice().sort().join('+')
      :(APP.order[0]||document.title));
  var PFX='sempres:'+SCOPE+':';
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function loadDraft(name){
    var raw=lsGet(PFX+name); if(!raw) return null;
    try{var d=JSON.parse(raw);
      return (d&&Array.isArray(d.slides))?normPres(d):null;
    }catch(e){return null;}
  }
  function draftNames(){
    var out=[];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k&&k.indexOf(PFX)===0){
          var nm=k.slice(PFX.length);
          if(nm&&nm!=='last'&&out.indexOf(nm)<0) out.push(nm);
        }
      }
    }catch(e){}
    return out.sort();
  }
  function fullFrame(ref){
    var r=PRESETS.full[0];
    return {k:'cell',x:r[0],y:r[1],w:r[2],h:r[3],ref:ref||null};
  }
  function emptySlide(){
    return {layout:'blank',panes:[],annots:[fullFrame(null)]};
  }
  function autoSlides(withDocs){
    var out=[];
    APP.order.forEach(function(stem){
      (SHELLITEMS[stem]||[]).forEach(function(ns){
        var it=ITEMS[ns];
        var fig=it.kind==='figure'||it.kind==='diagnostic';
        if(fig||(withDocs&&it.kind==='note'))
          out.push({layout:'blank',panes:[],
            annots:[fullFrame(ns)]});
      });
    });
    return out;
  }
  function defaultPres(){return {name:'presentation',slides:autoSlides(false)};}

  var pres=null, source='auto', mode='view', cur=0, activePane=0;
  function loadPresentation(name){
    deckZoom=0;   /* zoom is per-session, reset per presentation */
    var d=loadDraft(name);
    if(d){pres=d;source='draft';histReset();return;}
    var s=savedByName(name);
    if(s){pres=normPres(deep(s));source='saved';histReset();return;}
    pres=defaultPres();source='auto';histReset();
  }
  var last=lsGet(PFX+'last');
  if(last&&(loadDraft(last)||savedByName(last))) loadPresentation(last);
  else if(allSaved().length) loadPresentation(allSaved()[0].name);
  else {pres=defaultPres();source='auto';}

  var saveStamp=null,saveKind='';
  function fmtT(d){
    var h=d.getHours(),m=d.getMinutes();
    return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
  }
  function status(){
    var el=$('#deck-status');
    var auto=APP.mode==='app'
      &&(typeof autosaveOn==='undefined'||autosaveOn);
    if(source==='draft'){
      /* web/static Save writes to the browser but keeps source='draft';
         show a plain 'saved' — the Save button tooltip explains where */
      if(APP.mode!=='app'&&saveKind==='manual'&&saveStamp){
        el.textContent='saved · '+fmtT(saveStamp);
        el.className='deck-status saved';
        return;
      }
      el.textContent=auto?'unsaved — saving…':'unsaved';
    } else if(source==='saved'){
      el.textContent=saveStamp
        ?((saveKind==='auto'?'autosaved · ':'saved · ')+fmtT(saveStamp))
        :'saved';
    } else el.textContent='';
    el.className='deck-status '+source;
  }
  function markDirty(){
    source='draft';
    saveKind='';
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
    status();
    scheduleAutosave();
    histPush();
    renderSelPane();   /* keep the Objects pane in step (no-op if closed) */
  }
  /* ---------- undo / redo (snapshots of the slide content) ---------- */
  var undoStack=[],redoStack=[],histSnap=null;
  function histState(){
    return JSON.stringify({slides:pres.slides||[],showNums:pres.showNums||0});
  }
  function histReset(){
    histSnap=histState();undoStack=[];redoStack=[];updateUndoBtns();
  }
  function histPush(){
    var st=histState();
    if(st===histSnap) return;         /* nothing actually changed */
    undoStack.push(histSnap);
    if(undoStack.length>50) undoStack.shift();
    redoStack.length=0;histSnap=st;updateUndoBtns();
  }
  function histRestore(snap){
    var d;try{d=JSON.parse(snap);}catch(e){return;}
    pres.slides=d.slides||[];
    if(d.showNums) pres.showNums=1; else delete pres.showNums;
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;selAnnot=null;selSet=[];
    /* persist WITHOUT recording a new history entry */
    source='draft';
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    status();scheduleAutosave();refresh();
    /* nothing is selected after a restore — clear the format bar + Delete */
    var db=$('#et-del'); if(db) db.disabled=true;
    if(typeof showFmt==='function') showFmt();
  }
  function undo(){
    if(!undoStack.length) return;
    redoStack.push(histSnap);histSnap=undoStack.pop();
    updateUndoBtns();histRestore(histSnap);
  }
  function redo(){
    if(!redoStack.length) return;
    undoStack.push(histSnap);histSnap=redoStack.pop();
    updateUndoBtns();histRestore(histSnap);
  }
  function updateUndoBtns(){
    var u=$('#dc-undo'),r=$('#dc-redo');
    if(u) u.disabled=!undoStack.length;
    if(r) r.disabled=!redoStack.length;
  }

  /* ---------- DOM cloning from the cards already on the page ---------- */
  function cardEl(ref){
    var it=resolveRef(ref); if(!it) return null;
    var sh=APP.shells[it.nb]; if(!sh) return null;
    return sh.el.querySelector(
      '.card[data-anchor="'+String(it.anchor).replace(/"/g,'\\"')+'"]');
  }
  function stripIds(node){
    if(node.removeAttribute) node.removeAttribute('id');
    $$('[id]',node).forEach(function(n){n.removeAttribute('id');});
    return node;
  }
  /* per-frame figure history: every successful live clone is remembered;
     on a notebook reload those become the "previous figure" a frame can
     revert to (session-only — snapshots never enter the saved deck) */
  var frameSnaps={},frameSnapsPrev={};
  var frozenFrames=new WeakMap();   /* annot -> snapshot html it shows */
  function cloneBody(ref){
    var c=cardEl(ref); if(!c) return null;
    var b=$('.cardbody',c); if(!b) return null;
    b=stripIds(b.cloneNode(true));
    /* the DOCUMENT's filter state (hidden plot types, folded/hidden parts)
       must not ride into slides — a placed frame shows its part in full */
    $$('.pt-off,.ot-off,.part-off,.part-fold,.code-off',b)
      .forEach(function(n){
        ['pt-off','ot-off','part-off','part-fold','part-open','code-off']
          .forEach(function(cl){n.classList.remove(cl);});
      });
    $$('.figpager-nav',b).forEach(function(n){n.style.display='';});
    var it=resolveRef(ref);
    if(it) frameSnaps[it.ns]=b.outerHTML;
    return b;
  }
  function cloneCode(ref){
    var c=cardEl(ref); if(!c) return null;
    var inner=$('.codeinner',c); if(!inner) return null;
    return stripIds(inner.cloneNode(true));
  }
  /* a cell can contribute several things to a slide: its CODE, its
     FIGURE(s) and its printed OUTPUT. A frame shows one 'part'. */
  function cellFacets(ref){
    var card=cardEl(ref);
    var it=resolveRef(ref);
    var f={code:!!(it&&it.hasCode),figure:false,output:false};
    if(card){
      if(!f.code&&card.querySelector('.codeinner')) f.code=true;
      var body=$('.cardbody',card);
      if(body){
        /* live embeds (plotly/bokeh/vega/folium) are figures too */
        f.figure=!!body.querySelector('.figframe,.figpager,.plotframe');
        f.output=!!body.querySelector(
          'pre.result,pre.stream,.rich:not(.plotframe),.xr-wrap,.note')
          ||(!f.figure&&!!(body.textContent||'').trim());
      }
    }
    return f;
  }
  function autoPart(f){
    return f.figure?'figure':(f.output?'output':(f.code?'code':'body'));
  }
  function hasFacet(f,part){
    return (part==='code'&&f.code)||(part==='figure'&&f.figure)
      ||(part==='output'&&f.output);
  }
  function partOf(a){
    var f=cellFacets(a.ref);
    /* honor the chosen part only if the cell STILL has it (a refresh may
       have removed the figure/output) — else fall back to auto */
    if(a.part&&a.part!=='auto'&&hasFacet(f,a.part)) return a.part;
    return autoPart(f);
  }
  function applyPartFilter(b,part){
    if(part==='figure'){
      /* the figure part is JUST the figure — drop outputs AND any markdown
         note / caption that rides along in the card body (a .plotframe is
         a live figure, e.g. bokeh/vega/folium — keep it) */
      $$('.cb-out,.xr-wrap,pre.result,pre.stream,.rich:not(.plotframe),'
        +'.note,.note-src,.htmltoggle,.caption',b)
        .forEach(function(n){if(n.parentNode) n.parentNode.removeChild(n);});
    } else if(part==='output'){
      $$('.cb-fig,.figframe,.figpager,.plotframe',b).forEach(function(n){
        if(n.parentNode) n.parentNode.removeChild(n);});
    }
    return b;
  }
  function framePart(ref,part){
    var f=cellFacets(ref);
    if(!part||part==='auto'||!hasFacet(f,part)) part=autoPart(f);
    if(part==='code') return cloneCode(ref)||cloneBody(ref);
    var b=cloneBody(ref);
    if(!b) return cloneCode(ref);
    return applyPartFilter(b,part);
  }
  /* ---- figure LOCKS: a frame pinned to a git commit renders that
     commit's card (fetched once, cached) — refresh never touches it, and
     the source notebook doesn't even have to be open ---- */
  var verCards={},verMeta={},verPending={};
  function lockParts(a){
    var r=normRef(a.ref)||String(a.ref||'');
    var pr=splitRef(r);
    if(!pr[0]) return null;
    var path=nbPathFor(pr[0]);
    if(!path||/^https?:/i.test(path)) return null;
    return {stem:pr[0],anchor:pr[1],path:path,
      key:path+'@'+a.lockver.commit+'::'+pr[1],
      pkey:path+'@'+a.lockver.commit};
  }
  function fetchVerCards(path,commit,anchors){
    var pkey=path+'@'+commit;
    var pend=verPending[pkey]=verPending[pkey]||{};
    anchors=anchors.filter(function(an){
      return verCards[pkey+'::'+an]===undefined&&!pend[an];});
    if(!anchors.length) return Promise.resolve();
    anchors.forEach(function(an){pend[an]=1;});
    return APP.api('/api/versioncards',
      {path:path,commit:commit,anchors:anchors})
    .then(function(j){
      verMeta[pkey]={msg:j.msg||'',date:j.date||''};
      anchors.forEach(function(an){
        verCards[pkey+'::'+an]=(j.cards||{})[an]||null;
        delete pend[an];
      });
      var l=stage.querySelector('.annot-layer');
      var s=pres.slides[cur];
      if(l&&s&&!deckEl.hidden){renderAnnots(l,s);paintSel(l);}
    }).catch(function(){
      anchors.forEach(function(an){
        verCards[pkey+'::'+an]=null;delete pend[an];});
    });
  }
  /* undefined = loading, null = unavailable, object = the card */
  function verCardFor(a){
    if(!(a.lockver&&a.lockver.commit)||APP.mode!=='app') return null;
    var lp=lockParts(a); if(!lp) return null;
    var hit=verCards[lp.key];
    if(hit!==undefined) return hit;
    fetchVerCards(lp.path,a.lockver.commit,[lp.anchor]);
    return undefined;
  }
  function frameFromVerCard(card,part){
    var t=document.createElement('template');t.innerHTML=card.html||'';
    var b=t.content.querySelector('.cardbody');
    if(!b) return null;
    b=stripIds(b.cloneNode(true));
    return framePartFromSnap(b.outerHTML,part);
  }
  function lockChip(c,a,ok){
    c.classList.add('an-locked-ver');
    var lp=lockParts(a);
    var meta=(lp&&verMeta[lp.pkey])||{};
    var msg=a.lockver.msg||meta.msg||'';
    var date=a.lockver.date||meta.date||'';
    var fz=document.createElement('span');
    fz.className='an-lockchip'+(ok?'':' warn');
    fz.textContent='🔒 '+a.lockver.commit;
    fz.title=(ok?'Locked to commit ':'Locked to commit (content '
      +'unavailable — showing live) ')+a.lockver.commit
      +(msg?' — “'+msg+'”':'')+(date?' · '+date:'')
      +'\nRefresh never changes this frame. Unlock via the ribbon.';
    c.appendChild(fz);
  }
  /* render a frame from a REMEMBERED body (the pre-refresh figure) */
  function framePartFromSnap(html,part){
    var t=document.createElement('template');
    t.innerHTML=html;
    var b=t.content.firstElementChild;
    if(!b) return null;
    b=b.cloneNode(true);
    var hasFig=!!b.querySelector('.figframe,.figpager,.plotframe');
    if(!part||part==='auto'||part==='code')
      part=hasFig?'figure':'output';   /* snapshots hold no code part */
    return applyPartFilter(b,part);
  }
  function facetList(ref){
    var f=cellFacets(ref),out=[];
    if(f.figure) out.push('figure');
    if(f.output) out.push('output');
    if(f.code) out.push('code');
    return out;
  }
  /* split a frame into two adjacent frames — one per part (e.g. the
     figure beside its code), each labelled */
  function splitFrame(ai){
    var s=pres.slides[cur]; if(!s) return;
    var a=(s.annots||[])[ai]; if(!a||a.k!=='cell'||!a.ref) return;
    var facs=facetList(a.ref); if(facs.length<2) return;
    var cur0=partOf(a);
    var other=facs.filter(function(x){return x!==cur0;})[0];
    a.part=cur0;
    var w=a.w||46,h=a.h||56,x=a.x||6,y=a.y||6;
    /* split WITHIN the frame's own bounds so the two never overflow or
       overlap: side by side if wide enough, otherwise stacked */
    var half=(w-2)/2;
    if(half>=16){
      a.w=half;
      s.annots.push({k:'cell',ref:a.ref,part:other,
        x:x+half+2,y:y,w:w-half-2,h:h});
    } else {
      var hh=Math.max(16,(h-2)/2);
      a.h=hh;
      s.annots.push({k:'cell',ref:a.ref,part:other,
        x:x,y:y+hh+2,w:w,h:h-hh-2>=16?h-hh-2:hh});
    }
    markDirty();refresh();
  }
  /* the code/figure/output picker shown on a filled frame (+ split) */
  function buildPartChooser(s,ai){
    var a=(s.annots||[])[ai]; if(!a||!a.ref) return null;
    var facs=facetList(a.ref); if(facs.length<2) return null;
    var curp=partOf(a);
    var box=document.createElement('div');box.className='cellparts';
    /* let draw tools (edit mode) still start a shape over the button;
       in the builder (create) or select tool the button always acts */
    function guardDown(e){if(mode!=='edit'||tool==='select') e.stopPropagation();}
    function armed(){return mode!=='edit'||tool==='select';}
    facs.forEach(function(fp){
      var b=document.createElement('button');
      b.className='cellpartbtn'+(fp===curp?' on':'');
      b.textContent=fp;
      b.title='Show the '+fp+' in this frame';
      b.addEventListener('mousedown',guardDown);
      b.addEventListener('click',function(e){
        if(!armed()) return;
        e.stopPropagation();
        if(partOf(a)===fp&&a.part) return;
        a.part=fp;markDirty();refresh();});
      box.appendChild(b);
    });
    var sp=document.createElement('button');
    sp.className='cellpartbtn split';sp.innerHTML='&#9707; split';
    sp.title='Split into two frames — one for each part';
    sp.addEventListener('mousedown',guardDown);
    sp.addEventListener('click',function(e){
      if(!armed()) return;
      e.stopPropagation();splitFrame(ai);});
    box.appendChild(sp);
    return box;
  }
  function typeset(el){
    if(window.MathJax&&MathJax.typesetPromise){
      MathJax.typesetPromise([el]).catch(function(){});}
  }
  function multiNb(){return APP.order.length>1;}
  function nbChip(cls,stem){
    var c=document.createElement('span');c.className=cls;
    c.textContent=stem;return c;
  }
  /* ---------- view mode: slide rendering + vertical code trail ------
     Horizontal = the story; vertical = how each slide was made. Every
     framed card contributes its full upstream chain (open data ->
     transforms -> plot), deduped, in execution order — one cell per
     screen below the slide. */
  var vGroups=[];
  var traceSel=0;          /* which plot's trace shows (thumbnail pick) */
  var traceView='cells';   /* 'cells' list or 'tree' (docs tree, reused) */
  var TRACE_COLORS=['#39a9c0','#ff6b57','#f0a848','#46a892',
    '#c98fd0','#5b8dd6'];
  function hiddenSet(s){
    var h={};(s&&s.hidden||[]).forEach(function(r){h[r]=1;});return h;
  }
  function toggleHidden(s,ns){
    if(!s) return;
    s.hidden=s.hidden||[];
    var i=s.hidden.indexOf(ns);
    if(i>=0) s.hidden.splice(i,1); else s.hidden.push(ns);
    markDirty();
  }
  /* ---- reusable code trace used by the presentation's slide code-trail
     (the docs "Plot trace" instead opens a tab of cloned docs cards) ----
     spec = { groups:[{it,steps,color}], list:()=>[ns hidden],
              toggle:(ns)=>void (persist), showHiddenRef:{v:bool} } */
  function renderTrace(spec){
    spec.showHiddenRef=spec.showHiddenRef||{v:false};
    function rebuild(oldNode){
      var fresh=traceNode(spec,rebuild);
      if(oldNode&&oldNode.parentNode)
        oldNode.parentNode.replaceChild(fresh,oldNode);
      return fresh;
    }
    return rebuild(null);
  }
  /* the presentation wrapper: groups come from the slide's framed plots */
  function buildTrace(s){
    return renderTrace({
      groups:vGroups,
      list:function(){return (s&&s.hidden)||[];},
      toggle:function(ns){toggleHidden(s,ns);}
    });
  }
  /* one lineage group for a SINGLE plot/item (the docs popup) */
  function lineageForItem(ns){
    var it=ITEMS[ns]; if(!it) return null;
    var steps=[],seen={};
    (it.chain||[]).forEach(function(anchor){
      var up=ITEMS[nsKey(it.nb,anchor)];
      /* markdown notes that name a lineage variable ride along in the trace */
      if(up&&(up.hasCode||up.kind==='note')&&!seen[up.ns]){
        seen[up.ns]=1;steps.push(up);}
    });
    if(it.hasCode&&!seen[it.ns]) steps.push(it);
    return {it:it,steps:steps,color:TRACE_COLORS[0]};
  }
  /* ---- per-plot dependency graph (the docs popup) ---- */
  var NODE_FILL={figure:'#39a9c0',diagnostic:'#39a9c0',dataset:'#4d90c0',
    transform:'#5b7589',metric:'#46a892',note:'#cf9a4e',text:'#8ba0b2',
    imports:'#a3855c','function':'#46a892',data:'#4d90c0',constant:'#9a7cc0',
    settings:'#5b7589',plotting:'#39a9c0',print:'#cf9a4e',code:'#8ba0b2'};
  function nodeColor(st){
    if(st.kind==='figure'||st.kind==='diagnostic') return NODE_FILL.figure;
    if(st.kind==='note') return NODE_FILL.note;
    var cks=st.codeKinds||[st.codeKind||'code'];
    return NODE_FILL[cks[0]]||NODE_FILL[st.kind]||'#8ba0b2';
  }
  var SVGNS='http://www.w3.org/2000/svg';
  /* ---- shapes for the "+ Shapes" tool. Geometric ones are SVG <path>s in a
     0..100 box (stretched to the frame, non-scaling stroke); !/? are glyphs.
     'rect' + 'ellipse' stay CSS-drawn (see the an-rect renderer). ---- */
  var SHAPE_PATHS={
    triangle:'M50 6 L95 92 L5 92 Z',
    diamond:'M50 4 L96 50 L50 96 L4 50 Z',
    pentagon:'M50 5 L95 39 L77 93 L23 93 L5 39 Z',
    hexagon:'M27 6 H73 L97 50 L73 94 H27 L3 50 Z',
    star:'M50 3 L61 37 H97 L68 59 L79 95 L50 73 L21 95 L32 59 L3 37 H39 Z',
    cross:'M37 5 H63 V37 H95 V63 H63 V95 H37 V63 H5 V37 H37 Z',
    arrow:'M5 36 H60 V18 L96 50 L60 82 V64 H5 Z',
    heart:'M50 90 C6 56 12 16 50 40 C88 16 94 56 50 90 Z',
    cloud:'M30 82 C12 82 6 58 24 52 C20 30 52 22 58 38 '
      +'C72 26 92 40 84 56 C98 58 96 82 78 82 Z',
    bubble:'M8 8 H92 V66 H44 L24 90 V66 H8 Z',
    lightning:'M58 4 L20 56 H46 L38 96 L82 40 H54 Z'
  };
  var SHAPE_GLYPH={exclaim:'!',question:'?'};
  /* menu order + short labels */
  var SHAPE_LIST=[
    ['rect','Rectangle'],['ellipse','Ellipse'],['triangle','Triangle'],
    ['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],
    ['star','Star'],['cross','Plus'],['arrow','Arrow'],['heart','Heart'],
    ['cloud','Cloud'],['bubble','Speech'],['lightning','Bolt'],
    ['exclaim','Exclaim'],['question','Question']];
  function drawShapeSvg(shp,col,sw,dash,fill){
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','an-shape-svg');
    svg.setAttribute('viewBox','0 0 100 100');
    if(SHAPE_GLYPH[shp]){
      svg.setAttribute('preserveAspectRatio','xMidYMid meet');
      var tx=document.createElementNS(SVGNS,'text');
      tx.setAttribute('x','50');tx.setAttribute('y','54');
      tx.setAttribute('text-anchor','middle');
      tx.setAttribute('dominant-baseline','central');
      tx.setAttribute('font-size','104');tx.setAttribute('font-weight','800');
      tx.setAttribute('fill',col);   /* font comes from CSS (.an-shape-svg text) */
      tx.textContent=SHAPE_GLYPH[shp];
      svg.appendChild(tx);
    } else {
      svg.setAttribute('preserveAspectRatio','none');
      var p=document.createElementNS(SVGNS,'path');
      p.setAttribute('d',SHAPE_PATHS[shp]||'');
      p.setAttribute('fill',fill?shapeFill(col,0x2b/255):'none');
      p.setAttribute('stroke',col);
      p.setAttribute('stroke-width',sw||3);
      p.setAttribute('vector-effect','non-scaling-stroke');
      p.setAttribute('stroke-linejoin','round');
      if(dash) p.setAttribute('stroke-dasharray','7 6');
      svg.appendChild(p);
    }
    return svg;
  }
  function plotGraph(group,onNode){
    if(!group) return null;
    /* the dependency graph is CODE lineage — linked markdown notes ride along
       in the trace's card list but are not graph nodes (they aren't
       computational deps, and mixing them in creates note<->definer cycles
       that the transitive reduction can't lay out) */
    var steps=group.steps.filter(function(s){return s.kind!=='note';});
    if(steps.length<2) return null;                 /* nothing to draw */
    var n=steps.length,idx={},i;
    for(i=0;i<n;i++) idx[steps[i].ns]=i;
    /* each step's ancestors that are also in this plot's set (from chain) */
    var anc=steps.map(function(s){
      var set={};
      (s.chain||[]).forEach(function(a){
        var ns=nsKey(s.nb,a); if(idx[ns]!==undefined) set[ns]=1;});
      return set;
    });
    /* direct parents = transitive reduction (drop ancestors reachable
       through another ancestor) */
    var parents=steps.map(function(s,i2){
      var a=Object.keys(anc[i2]);
      return a.filter(function(p){
        return !a.some(function(q){
          return q!==p&&anc[idx[q]]&&anc[idx[q]][p];});
      });
    });
    var depth=[]; for(i=0;i<n;i++) depth.push(-1);
    function dep(i2){
      if(depth[i2]>=0) return depth[i2];
      depth[i2]=0;   /* cycle guard */
      var m=0; parents[i2].forEach(function(p){
        m=Math.max(m,dep(idx[p])+1);});
      depth[i2]=m; return m;
    }
    for(i=0;i<n;i++) dep(i);
    var maxD=0; depth.forEach(function(v){if(v>maxD)maxD=v;});
    var layers=[],L; for(L=0;L<=maxD;L++) layers.push([]);
    for(i=0;i<n;i++) layers[depth[i]].push(i);
    var NW=152,NH=30,GX=20,GY=52,PADX=14,PADY=14,maxCols=0;
    layers.forEach(function(l){if(l.length>maxCols)maxCols=l.length;});
    var W=PADX*2+maxCols*NW+(maxCols-1)*GX;
    var H=PADY*2+(maxD+1)*NH+maxD*GY,pos={};
    layers.forEach(function(l,Ld){
      var rowW=l.length*NW+(l.length-1)*GX,x0=(W-rowW)/2;
      l.forEach(function(i2,k){
        pos[i2]={x:x0+k*(NW+GX),y:PADY+Ld*(NH+GY)};});
    });
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','plotgraph');
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('preserveAspectRatio','xMidYMin meet');
    svg.style.maxHeight=Math.min(H,300)+'px';
    steps.forEach(function(s,i2){
      parents[i2].forEach(function(p){
        var a=pos[idx[p]],b=pos[i2];
        var x1=a.x+NW/2,y1=a.y+NH,x2=b.x+NW/2,y2=b.y,mid=(y1+y2)/2;
        var path=document.createElementNS(SVGNS,'path');
        path.setAttribute('class','pg-edge');
        path.setAttribute('d','M'+x1+' '+y1+' C'+x1+' '+mid+' '
          +x2+' '+mid+' '+x2+' '+y2);
        svg.appendChild(path);
      });
    });
    steps.forEach(function(s,i2){
      var p=pos[i2];
      var g=document.createElementNS(SVGNS,'g');
      g.setAttribute('class','pg-node');
      g.setAttribute('transform','translate('+p.x+','+p.y+')');
      g.setAttribute('tabindex','0');g.setAttribute('role','button');
      var r=document.createElementNS(SVGNS,'rect');
      r.setAttribute('width',NW);r.setAttribute('height',NH);
      r.setAttribute('rx',7);r.setAttribute('fill',nodeColor(s));
      g.appendChild(r);
      var t=document.createElementNS(SVGNS,'text');
      t.setAttribute('x',NW/2);t.setAttribute('y',NH/2+4);
      t.setAttribute('text-anchor','middle');
      var label=s.title||splitRef(s.ns)[1];
      if(label.length>22) label=label.slice(0,21)+'…';
      t.textContent=label;g.appendChild(t);
      var open=function(){onNode?onNode(s):openVFull(s);};
      g.addEventListener('click',open);
      g.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
      svg.appendChild(g);
    });
    var wrap=document.createElement('div');wrap.className='plotgraph-wrap';
    var lbl=document.createElement('div');lbl.className='pg-eyebrow';
    lbl.textContent='dependency graph';
    wrap.appendChild(lbl);wrap.appendChild(svg);
    return wrap;
  }
  function traceItemFor(stem,anchor){
    return resolveRef(stem?nsKey(stem,anchor):anchor)||resolveRef(anchor);
  }
  function lineageFor(s){
    /* one group per framed card, ordered like the frames sit on the
       slide (row by row, left to right); each group = that card's full
       chain + its own code */
    var frames=[],seen={};
    (s.annots||[]).forEach(function(a){
      if(a.k!=='cell'||!a.ref) return;
      var it=resolveRef(a.ref);
      if(it&&!seen[it.ns]){seen[it.ns]=1;frames.push({a:a,it:it});}
    });
    frames.sort(function(p,q){
      var ry=Math.round((p.a.y||0)/12)-Math.round((q.a.y||0)/12);
      return ry!==0?ry:((p.a.x||0)-(q.a.x||0));
    });
    var groups=[];
    frames.forEach(function(f){
      /* a framed markdown note carries no code trail of its own — its chain
         now names its variables' cards (docs feature), but the presentation
         must stay note-free */
      if(f.it.kind==='note') return;
      var steps=[],seen2={};
      (f.it.chain||[]).forEach(function(anchor){
        var ns=nsKey(f.it.nb,anchor);
        var up=ITEMS[ns];
        if(up&&up.hasCode&&!seen2[ns]){seen2[ns]=1;steps.push(up);}
      });
      if(f.it.hasCode&&!seen2[f.it.ns]) steps.push(f.it);
      if(steps.length)
        groups.push({it:f.it,steps:steps,
          color:TRACE_COLORS[groups.length%TRACE_COLORS.length]});
    });
    var flat=[];
    groups.forEach(function(g){
      g.steps.forEach(function(st,k){
        flat.push({it:st,g:g,num:k+1});
      });
    });
    return {groups:groups,flat:flat};
  }
  /* the SELECTED plot's lineage as the docs dependency tree: a pseudo-
     shell (hidden card clones + a .treeview) fed to the docs builder, so
     zoom / width / expand / resize all behave exactly like the Tree view */
  function traceTreeNode(g){
    var wrap=document.createElement('div');
    wrap.className='deck-tracetree';
    var store=document.createElement('div');store.hidden=true;
    var items=[];
    (g.steps||[]).forEach(function(st){
      items.push(st);
      var c=cardEl(st.ns);
      if(c) store.appendChild(c.cloneNode(true));  /* ids kept: the tree
        builder looks nodes up by card id WITHIN this wrapper */
    });
    var tv=document.createElement('div');tv.className='treeview';
    wrap.appendChild(store);wrap.appendChild(tv);
    if(window.SemView&&window.SemView.buildTree)
      window.SemView.buildTree({el:wrap,
        data:{stem:g.it.nb,items:items}});
    return wrap;
  }
  function plotThumb(g,glow){
    var w=document.createElement('div');w.className='vo-plot';
    if(glow){
      w.style.borderColor=g.color;
      w.style.boxShadow='0 0 16px '+g.color+'66';
    }
    var src=paneImgSrc(g.it.ns);
    if(src){
      var im=document.createElement('img');
      im.src=src;im.alt='';w.appendChild(im);
    }
    var tl=document.createElement('span');tl.className='vo-plot-t';
    tl.textContent=g.it.title;w.appendChild(tl);
    return w;
  }
  function openVFull(st){
    var vf=$('#vfull'); if(!vf) return;
    var b=$('#vfull-badge'); if(b) b.textContent=st.kind;
    var t=$('#vfull-t'); if(t) t.textContent=st.title;
    var body=$('#vfull-body');
    if(body){
      body.innerHTML='';
      var c=cloneCode(st.ns);
      if(c) body.appendChild(c);
    }
    vf.hidden=false;
  }
  function closeVFull(){
    var vf=$('#vfull'); if(vf) vf.hidden=true;
  }
  function traceStep(st,k,g,multi,isHidden,spec,doRebuild){
    var box=document.createElement('div');
    box.className='vo-step'+(isHidden?' hidden':'');
    box.setAttribute('data-ns',st.ns);
    box.setAttribute('data-ck',(st.codeKinds&&st.codeKinds[0])||'code');
    box.setAttribute('data-ot',stepOt(st));
    var h=document.createElement('button');h.className='vo-step-h';
    h.title='Expand this cell';
    var n=document.createElement('span');n.className='vo-num';
    n.textContent=(k+1);
    if(multi){n.style.background=g.color+'26';n.style.color=g.color;}
    h.appendChild(n);
    var bd=document.createElement('span');
    var cks=st.codeKinds||(st.codeKind?[st.codeKind]:['code']);
    var codey=st.kind!=='figure'&&st.kind!=='diagnostic'
      &&!(cks.length===1&&cks[0]==='code');
    bd.className='chain-badge '+(codey?('ckmain-'+cks[0]):'');
    bd.textContent=codey?cks.slice(0,3).join(' · '):st.kind;
    h.appendChild(bd);
    var bt=document.createElement('span');bt.className='vo-step-t';
    bt.textContent=st.title;h.appendChild(bt);
    if(multiNb()) h.appendChild(nbChip('spane-nb',st.nb));
    /* eyeball: hide this step while presenting (persists per slide) */
    var eye=document.createElement('span');
    eye.className='vo-eye'+(isHidden?' off':'');
    eye.innerHTML='&#128065;';
    eye.title=isHidden
      ?'Hidden — click to show it again'
      :'Hide this step';
    eye.addEventListener('click',function(e){
      e.stopPropagation();spec.toggle(st.ns);doRebuild();});
    h.appendChild(eye);
    var fb=document.createElement('span');fb.className='vo-full';
    fb.innerHTML='&#x26F6;';fb.title='View this cell full screen';
    fb.addEventListener('click',function(e){
      e.stopPropagation();openVFull(st);});
    h.appendChild(fb);
    var ch=document.createElement('span');ch.className='vo-chev';
    ch.innerHTML='&#8250;';
    h.appendChild(ch);
    var body=document.createElement('div');body.className='vo-step-b';
    h.addEventListener('click',function(){
      var open=box.classList.toggle('open');
      if(open&&!body.firstChild){
        var c=cloneCode(st.ns);
        if(c) body.appendChild(c);
        else{
          var no=document.createElement('p');no.className='vstep-none';
          no.textContent='(no code on this card)';
          body.appendChild(no);
        }
        typeset(body);
      }
    });
    box.appendChild(h);box.appendChild(body);
    return box;
  }
  function setAllSteps(v,open){
    $$('.vo-step',v).forEach(function(box){
      if(open===box.classList.contains('open')) return;
      if(open) box.querySelector('.vo-step-h').click();
      else box.classList.remove('open');
    });
  }
  /* the code trail's OWN Code-types / Output-types filters (mirror the docs
     ones): each hides trace steps by their primary code kind / output kind */
  var traceCkHidden={},traceOtHidden={};
  function stepOt(st){
    var kd=st.kind;
    if(kd==='text'||kd==='metric') return 'print';
    if(kd==='dataset') return 'dataset';
    if(kd==='error') return 'error';
    return '';   /* figures / code / notes are not an output kind */
  }
  function applyTraceFilter(v){
    $$('.vo-step',v).forEach(function(st){
      var ck=st.getAttribute('data-ck')||'code',ot=st.getAttribute('data-ot');
      st.classList.toggle('vo-filtered',
        !!traceCkHidden[ck]||(!!ot&&!!traceOtHidden[ot]));
    });
  }
  function traceFilterDropdown(kind,present,state,v){
    var wrap=document.createElement('span');wrap.className='vo-fdrop';
    var btn=document.createElement('button');
    btn.className='vo-fbtn'+(Object.keys(state).length?' on':'');
    btn.textContent=(kind==='code'?'Code types':'Output types')+' ▾';
    var menu=document.createElement('div');menu.className='vo-fmenu';
    menu.hidden=true;
    present.forEach(function(t){
      var row=document.createElement('label');row.className='ckf-row';
      var cb=document.createElement('input');cb.type='checkbox';
      cb.checked=!state[t];
      cb.addEventListener('change',function(){
        if(cb.checked) delete state[t]; else state[t]=1;
        btn.classList.toggle('on',Object.keys(state).length>0);
        applyTraceFilter(v);});
      var sw=document.createElement('span');
      sw.className='ckf-dot '+(kind==='code'?'ckmain-'+t:'ot-sw-'+t);
      var tx=document.createElement('span');tx.textContent=t;
      row.appendChild(cb);row.appendChild(sw);row.appendChild(tx);
      menu.appendChild(row);});
    btn.addEventListener('click',function(e){
      e.stopPropagation();menu.hidden=!menu.hidden;});
    wrap.appendChild(btn);wrap.appendChild(menu);
    return wrap;
  }
  function traceNode(spec,rebuild){
    var groups=spec.groups||[];
    var hidden=hiddenSet({hidden:spec.list()});
    /* count DISTINCT hidden cells (a shared upstream cell can appear in
       several plot columns but is one step to the user) */
    var counted={},nHidden=0;
    groups.forEach(function(g){g.steps.forEach(function(st){
      if(hidden[st.ns]&&!counted[st.ns]){counted[st.ns]=1;nHidden++;}});});
    var showHidden=spec.showHiddenRef.v;
    /* the visible groups drive BOTH the plot strip and the columns, so
       they always line up even when a whole plot's trace is hidden */
    var visGroups=groups.map(function(g){
      return {g:g,vis:g.steps.filter(function(st){
        return showHidden||!hidden[st.ns];})};
    }).filter(function(x){return x.vis.length;});
    var multi=visGroups.length>1;
    if(traceSel>=visGroups.length) traceSel=0;
    var v=document.createElement('div');v.className='vtrace';
    var doRebuild=function(){rebuild(v);};
    var tl=document.createElement('div');tl.className='vo-title';
    /* the same lineage two ways: a readable list of Cells, or the
       expandable dependency Tree (the docs tree, reused) */
    var isTree=(traceView==='tree');
    [['&#9776; Cells','cells','The lineage as a readable list of steps'],
     ['&#9633; Tree','tree','The lineage as an expandable dependency '
      +'tree — columns by step']].forEach(function(bv){
      var b=document.createElement('button');
      b.className='vo-xall'+((traceView===bv[1])?' on':'');
      b.innerHTML=bv[0];b.title=bv[2];
      b.addEventListener('click',function(){
        if(traceView!==bv[1]){traceView=bv[1];doRebuild();}});
      tl.appendChild(b);
    });
    var xa=document.createElement('button');xa.className='vo-xall';
    xa.textContent='Expand all';
    xa.title='Open the code of every step';
    xa.addEventListener('click',function(){setAllSteps(v,true);});
    var ca=document.createElement('button');ca.className='vo-xall';
    ca.textContent='Collapse all';
    ca.title='Fold every step back down';
    ca.addEventListener('click',function(){setAllSteps(v,false);});
    if(!isTree){tl.appendChild(xa);tl.appendChild(ca);}
    if(!isTree&&nHidden){
      var sh=document.createElement('button');
      sh.className='vo-xall'+(showHidden?' on':'');
      sh.textContent=showHidden?'Hide hidden'
        :('Show hidden ('+nHidden+')');
      sh.title=showHidden
        ?'Hide the steps you marked hidden again'
        :'Reveal the steps you hid — to view them or unhide them';
      sh.addEventListener('click',function(){
        spec.showHiddenRef.v=!spec.showHiddenRef.v;doRebuild();});
      tl.appendChild(sh);
    }
    /* the trail's own Code-types / Output-types filters (present kinds only) */
    var ckSet={},otSet={};
    groups.forEach(function(g){g.steps.forEach(function(st){
      ckSet[(st.codeKinds&&st.codeKinds[0])||'code']=1;
      var ot=stepOt(st); if(ot) otSet[ot]=1;});});
    var ckList=Object.keys(ckSet),otList=Object.keys(otSet);
    if(!isTree&&ckList.length)
      tl.appendChild(traceFilterDropdown('code',ckList,traceCkHidden,v));
    if(!isTree&&otList.length)
      tl.appendChild(traceFilterDropdown('output',otList,traceOtHidden,v));
    v.appendChild(tl);
    /* several plots: the thumbnails PICK whose trace shows (one at a
       time), instead of every trace rendering side by side */
    if(multi){
      var strip=document.createElement('div');strip.className='vo-plots';
      visGroups.forEach(function(x,i){
        var th=plotThumb(x.g,i===traceSel);
        th.classList.add('vo-thumb-btn');
        if(i===traceSel) th.classList.add('sel');
        th.title='Show the code trace for “'+x.g.it.title+'”';
        th.addEventListener('click',function(){
          if(traceSel!==i){traceSel=i;doRebuild();}});
        strip.appendChild(th);
      });
      v.appendChild(strip);
    }
    if(isTree){
      var tg=visGroups[traceSel];
      if(tg) v.appendChild(traceTreeNode(tg.g));
      applyTraceFilter(v);
      return v;
    }
    var cols=document.createElement('div');cols.className='vo-groups';
    [visGroups[traceSel]].filter(Boolean).forEach(function(x){
      var g=x.g,vis=x.vis;
      var col=document.createElement('div');col.className='vo-col';
      if(multi){
        col.style.borderColor=g.color;
        col.style.boxShadow='0 0 16px '+g.color+'44';
      }
      var h=document.createElement('div');h.className='vo-col-h';
      if(multi) h.style.color=g.color;
      var hs=document.createElement('span');
      hs.textContent=g.it.title;h.appendChild(hs);
      col.appendChild(h);
      /* partition the steps under their notebook section (## heading) and
         subsection (### heading). Each section is a collapsible + hideable
         block, mirroring the docs — its steps live in a .vo-sec-body. */
      var lastSec=null,lastSub=null,secBody=col,secNs=[],secHdr=null;
      function wireSecEye(){
        if(!secHdr) return;
        var nss=secNs.slice();
        secHdr.querySelector('.vo-sec-eye').addEventListener('click',
          function(e){
            e.stopPropagation();
            var hid=hiddenSet({hidden:spec.list()});
            var anyVis=nss.some(function(ns){return !hid[ns];});
            nss.forEach(function(ns){
              if(anyVis?!hid[ns]:hid[ns]) spec.toggle(ns);});
            doRebuild();
          });
      }
      vis.forEach(function(st,k){
        /* partition by section ID, not title — two "### Summary" sections
           under different chapters must NOT merge into one block */
        var sec=st.section||st.sectitle||'',sub=st.subsection||'';
        if(sec!==lastSec){
          wireSecEye();                       /* finish the previous section */
          secNs=[];secHdr=null;
          if(sec){
            var sd=document.createElement('div');sd.className='vo-sec';
            var chev=document.createElement('span');
            chev.className='vo-sec-chev';chev.innerHTML='&#9662;';
            var lab=document.createElement('span');
            lab.className='vo-sec-lab';
            lab.textContent=(st.secnum?st.secnum+' · ':'')
              +(st.sectitle||sec);
            var eye=document.createElement('span');
            eye.className='vo-sec-eye';eye.innerHTML='&#128065;';
            eye.title='Hide or show this whole section';
            sd.appendChild(chev);sd.appendChild(lab);sd.appendChild(eye);
            col.appendChild(sd);
            secBody=document.createElement('div');
            secBody.className='vo-sec-body';col.appendChild(secBody);
            secHdr=sd;
            /* capture sd + secBody per-section (both are function-scoped vars
               reused across steps) so each chevron folds its OWN body */
            (function(hdr,bdy){
              var fold=function(){
                var c=hdr.classList.toggle('collapsed');
                bdy.classList.toggle('vo-sec-fold',c);};
              chev.addEventListener('click',function(e){
                e.stopPropagation();fold();});
              lab.addEventListener('click',fold);
            })(sd,secBody);
          } else {
            secBody=col;   /* steps with no section go straight in the column */
          }
          lastSec=sec;lastSub=null;
        }
        if(sub!==lastSub){
          if(sub){
            var sbh=document.createElement('div');sbh.className='vo-subsec';
            sbh.textContent=sub;secBody.appendChild(sbh);
          }
          lastSub=sub;
        }
        secNs.push(st.ns);
        secBody.appendChild(
          traceStep(st,k,g,multi,!!hidden[st.ns],spec,doRebuild));
      });
      wireSecEye();                            /* finish the final section */
      cols.appendChild(col);
    });
    v.appendChild(cols);
    applyTraceFilter(v);   /* reflect the current trail filters on rebuild */
    return v;
  }
  function updateVNav(){
    var down=$('#deck-down'),up=$('#deck-up');
    var inView=(mode==='view');
    var hasTrace=inView&&!!stage.querySelector('.vtrace');
    var atTop=(stage.scrollTop||0)<60;
    if(down) down.hidden=!(hasTrace&&atTop);
    if(up) up.hidden=!(hasTrace&&!atTop);
    var c=$('#deck-count');
    if(c) c.textContent=pres.slides.length
      ?((cur+1)+' / '+pres.slides.length):'0 / 0';
  }
  function scrollToTrace(){
    var tr=stage.querySelector('.vtrace');
    if(tr) tr.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function scrollToSlide(){
    stage.scrollTo({top:0,behavior:'smooth'});
  }
  stage.addEventListener('scroll',function(){
    if(mode==='view') updateVNav();
  });
  function renderSlide(){
    var s=pres.slides[cur];
    stage.innerHTML='';
    vGroups=[];
    traceSel=0;   /* each slide starts on its first plot's trace */
    closeVFull();
    if(!s){
      stage.innerHTML='<div class="slide slide-empty"><p>No slides yet.'
        +'<br>Use <b>Create</b> to build some.</p></div>';
    } else if(s.layout==='title'){
      /* title + sub are movable items drawn by the annotation layer */
      var ts=document.createElement('div');
      ts.className='slide slide-titlefree';
      ts.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
      stage.appendChild(ts);
    } else {
      var bs=document.createElement('div');
      bs.className='slide slide-blank';
      stage.appendChild(bs);
    }
    var slideEl=stage.firstElementChild;
    if(s&&slideEl){
      /* size the page BEFORE annots render, so % geometry, fonts and
         figure fits all read the final canvas dimensions */
      applyPage();
      if(mode==='edit'||deckEl.classList.contains('custom-page'))
        applyZoom();
      attachAnnots(slideEl,s);
      typeset(slideEl);
      if(mode==='view'){
        /* click anywhere on the slide advances the build / next slide */
        slideEl.style.cursor='pointer';
        slideEl.addEventListener('click',function(e){
          if(e.target.closest&&e.target.closest('button,a,input,select'))
            return;
          advance();
        });
      }
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';
        pn.textContent=(cur+1);
        slideEl.appendChild(pn);
      }
    }
    renderSelPane();   /* keep the Objects pane on the CURRENT slide */
    /* playback: the code trace flows beneath the slide — scroll (or
       ArrowDown) between them; steps expand in place */
    stage.classList.remove('scrolly');
    if(mode==='view'&&s){
      var lin=lineageFor(s);
      vGroups=lin.groups;
      if(vGroups.length){
        var page=document.createElement('div');
        page.className='vpage';
        while(stage.firstChild) page.appendChild(stage.firstChild);
        stage.appendChild(page);
        stage.appendChild(buildTrace(s));
        stage.classList.add('scrolly');
      }
    }
    stage.scrollTop=0;
    updateVNav();
    /* Next stays live while builds remain on the last slide; Prev while any
       build can be stepped back on the first slide */
    var moreBuilds=(mode==='view'&&s&&revealCount<slideBuildSteps(s).count);
    var fewerBuilds=(mode==='view'&&revealCount>0);
    $('#deck-prev').disabled=(cur<=0&&!fewerBuilds);
    $('#deck-next').disabled=(cur>=pres.slides.length-1&&!moreBuilds);
  }

  /* ---------- free annotations: text, arrows, boxes, cell frames -----
     Stored per slide as s.annots, coordinates in % of the slide box so
     they scale with the screen; text size is % of slide height. Title
     slides also carry movable title/sub text (s.tprops / s.sprops,
     addressed with the special indices 't' / 's'). */
  var AN_NS='http://www.w3.org/2000/svg';
  var FONTMAP={sans:'var(--sans)',serif:'var(--serif)',
    mono:'var(--mono)',system:'system-ui,sans-serif',
    hand:"'Segoe Print','Comic Sans MS',cursive"};
  var tool='select', selAnnot=null, picking=-1;
  /* selSet = every item in the current selection (a group, or a shift-click
     multi-select); selAnnot is the primary one that drives the format bar */
  var selSet=[];
  function groupMembers(s,idx){
    if(!s||typeof idx!=='number') return [idx];
    var a=(s.annots||[])[idx];
    if(!a||a.grp==null) return [idx];
    var out=[];
    (s.annots||[]).forEach(function(x,i){if(x.grp===a.grp) out.push(i);});
    return out.length?out:[idx];
  }
  function nextGrp(s){
    var mx=0;(s.annots||[]).forEach(function(x){
      if(typeof x.grp==='number'&&x.grp>mx) mx=x.grp;});
    return mx+1;
  }
  /* build animations: items carrying a.anim reveal one step at a time during
     playback (click / arrow / space); revealCount is how many are shown */
  var revealCount=0;
  function slideBuildIdx(s){
    var arr=[];
    (s&&s.annots||[]).forEach(function(a,i){if(a&&a.anim) arr.push(i);});
    arr.sort(function(x,y){
      return ((s.annots[x].anim.order||0)-(s.annots[y].anim.order||0));});
    return arr;
  }
  /* a build "step" is a distinct anim.order — items sharing an order appear
     TOGETHER on the same click. Returns {map: order->step-index, count} */
  function slideBuildSteps(s){
    var seen={};
    (s&&s.annots||[]).forEach(function(a){
      if(a&&a.anim) seen[a.anim.order||0]=1;});
    var keys=Object.keys(seen).map(Number).sort(function(x,y){return x-y;});
    var map={};keys.forEach(function(o,i){map[o]=i;});
    return {map:map,count:keys.length};
  }
  /* ordered list of steps for the animation pane: [{order, items:[idx,…]}] */
  function animSeq(s){
    var by={},order=[];
    (s&&s.annots||[]).forEach(function(a,i){
      if(a&&a.anim){var o=a.anim.order||0;
        if(!by[o]){by[o]=[];order.push(o);}by[o].push(i);}});
    order.sort(function(x,y){return x-y;});
    return order.map(function(o){return {order:o,items:by[o]};});
  }
  function nextAnimOrder(s){
    var mx=-1;(s&&s.annots||[]).forEach(function(a){
      if(a&&a.anim&&(a.anim.order||0)>mx) mx=a.anim.order||0;});
    return mx+1;
  }
  function itemLabel(s,idx){
    var a=(s&&s.annots||[])[idx]; if(!a) return 'item';
    if(a.k==='text') return (a.text||'').trim().slice(0,16)||'Text';
    if(a.k==='image') return 'Image';
    if(a.k==='arrow') return 'Arrow';
    if(a.k==='rect') return (a.shape?a.shape:'Shape');
    if(a.k==='cell'){var it=a.ref&&resolveRef(a.ref);
      return it&&it.title?it.title.slice(0,18):'Cell';}
    return 'item';
  }
  function paintSel(layer){
    var multi=selSet.length>1;
    $$('[data-idx]',layer).forEach(function(el){
      var raw=el.getAttribute('data-idx');
      var key=(raw==='t'||raw==='s')?raw:+raw;
      var on=selSet.indexOf(key)>=0;
      el.classList.toggle('sel',on);
      el.classList.toggle('grpsel',on&&multi);
    });
  }
  var pendingShape='rect';   /* which shape the "+ Shapes" tool draws */
  function titleProps(s,which){
    var key=which==='t'?'tprops':'sprops';
    if(!s[key]) s[key]=(which==='t')
      ?{x:50,y:42,size:6,color:'#f0f6fa'}
      :{x:50,y:58,size:2.6,color:'#7e93a4'};
    return s[key];
  }
  function annotByIdx(s,idx){
    if(idx==='t'||idx==='s') return titleProps(s,idx);
    if(typeof idx==='number') return (s.annots||[])[idx];
    return null;
  }
  function fontPx(layer,size){
    var h=layer.getBoundingClientRect().height||600;
    return Math.max(9,h*(size||2.6)/100)+'px';
  }
  function applyCommon(el,a,extraTransform){
    if(a.op!=null&&a.op<1) el.style.opacity=a.op;
    var tr=extraTransform||'';
    if(a.rot) tr+=(tr?' ':'')+'rotate('+a.rot+'deg)';
    if(tr) el.style.transform=tr;
  }
  /* a markdown cell frame can carry its own text + background colour, so the
     note is readable on any slide (the default light-box grey is not) */
  function applyCellColor(el,a){
    if(a.txcol) el.style.setProperty('--nb-tx',a.txcol);
    else el.style.removeProperty('--nb-tx');
    if(a.bgcol) el.style.setProperty('--nb-bg',
      a.bgcol==='none'?'transparent':a.bgcol);
    else el.style.removeProperty('--nb-bg');
  }
  /* crop masks: images AND notebook cells (figures, markdown, code) can be
     clipped to a shape, or trimmed with a rectangular inset. clip-path scales
     with the element, so it survives responsive slide sizing. */
  var CROP_SHAPES=[['rect','Rectangle'],['round','Rounded'],
    ['ellipse','Ellipse'],['circle','Circle'],['triangle','Triangle'],
    ['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],
    ['star','Star'],['arrow','Arrow']];
  var CROP_CLIP={
    round:'inset(0 round 14%)',
    ellipse:'ellipse(50% 50% at 50% 50%)',
    circle:'circle(50% at 50% 50%)',
    triangle:'polygon(50% 0%,100% 100%,0% 100%)',
    diamond:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
    pentagon:'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)',
    hexagon:'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
    star:'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,'
      +'21% 91%,32% 57%,2% 35%,39% 35%)',
    arrow:'polygon(0% 30%,55% 30%,55% 8%,100% 50%,55% 92%,55% 70%,0% 70%)'};
  function cropCss(a){
    if(!a||!a.crop) return '';
    var c=a.crop,sh=c.shape||'rect';
    if(sh!=='rect'&&CROP_CLIP[sh]) return CROP_CLIP[sh];
    var t=c.t||0,r=c.r||0,b=c.b||0,l=c.l||0;
    if(t||r||b||l) return 'inset('+t+'% '+r+'% '+b+'% '+l+'%)';
    return '';
  }
  function applyCrop(el,a){
    if(!el) return;
    var cc=cropCss(a);
    if(cc){el.style.clipPath=cc;el.style.webkitClipPath=cc;}
  }
  /* a little filled preview of a crop shape (uses the very same clip-path) */
  function cropIcon(shape){
    var d=document.createElement('span');d.className='crop-ico';
    var cc=CROP_CLIP[shape];
    if(cc){d.style.clipPath=cc;d.style.webkitClipPath=cc;}
    return d;
  }
  /* rich text: a text box can carry per-character colour (highlight a run and
     recolour just it). Stored as sanitised HTML in a.html; a.text keeps the
     plain fallback. Only colour + basic inline styles survive the sanitiser. */
  var RICH_TAGS={span:1,b:1,strong:1,i:1,em:1,u:1,s:1,br:1,font:1};
  function sanitizeRich(html){
    /* parse into an INERT template fragment — no image loads, no inline event
       handlers ever run (unlike a live-document div), so merely sanitising
       hostile HTML can never execute code */
    var tpl=document.createElement('template');
    tpl.innerHTML=String(html||'');
    /* walk with a live cursor (not a stale snapshot) so nodes promoted by
       unwrapping an unknown tag are ALSO inspected — otherwise a dangerous
       element nested one level in survives */
    (function walk(node){
      var n=node.firstChild;
      while(n){
        var next=n.nextSibling;
        if(n.nodeType===3){n=next;continue;}      /* text node: keep */
        if(n.nodeType!==1){node.removeChild(n);n=next;continue;}
        var tag=(n.tagName||'').toLowerCase();
        if(!RICH_TAGS[tag]){                       /* unwrap unknown tags */
          var first=n.firstChild;
          while(n.firstChild) node.insertBefore(n.firstChild,n);
          node.removeChild(n);
          n=first||next;continue;                  /* re-walk promoted nodes */
        }
        var color=(n.style&&n.style.color)||
          (tag==='font'?(n.getAttribute('color')||''):'');
        var names=[],k;
        for(k=0;k<n.attributes.length;k++) names.push(n.attributes[k].name);
        names.forEach(function(nm){n.removeAttribute(nm);});
        if(color) n.style.color=color;
        walk(n);
        n=next;
      }
    })(tpl.content);
    return {html:tpl.innerHTML,
      rich:!!tpl.content.querySelector(
        'span[style],font,b,strong,i,em,u,s')};
  }
  function activeTextEditable(){
    var ae=document.activeElement;
    if(ae&&ae.classList&&ae.classList.contains('an-tx')&&ae.isContentEditable
       &&ae.contentEditable!=='plaintext-only') return ae;
    return null;
  }
  function selectionInside(el){
    var sel=window.getSelection();
    if(!sel||sel.rangeCount===0||sel.isCollapsed) return false;
    var r=sel.getRangeAt(0);
    return el.contains(r.startContainer)&&el.contains(r.endContainer);
  }
  /* colour just the highlighted run inside the text box being edited;
     returns false when there is no live selection to recolour */
  function colorSelection(col){
    var el=activeTextEditable();
    if(!el||!selectionInside(el)) return false;
    try{document.execCommand('styleWithCSS',false,true);}catch(e){}
    try{document.execCommand('foreColor',false,col);}catch(e){}
    var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
    if(a){
      var r=sanitizeRich(el.innerHTML);
      a.text=el.innerText;
      if(r.rich) a.html=r.html; else delete a.html;
      markDirty();
    }
    return true;
  }
  function mkHandle(){
    var h=document.createElement('span');h.className='an-handle';
    h.title='Drag to move';h.textContent='⠿';
    return h;
  }
  function mkResize(){
    /* all four corners resize (anchored on the opposite corner) */
    var frag=document.createDocumentFragment();
    ['nw','ne','sw','se'].forEach(function(cn){
      var r=document.createElement('span');
      r.className='an-resize an-rs-'+cn;
      r.dataset.corner=cn;
      r.title='Drag to resize';
      frag.appendChild(r);
    });
    return frag;
  }
  function mkRotate(){
    var r=document.createElement('span');r.className='an-rotate';
    r.title='Drag to rotate freely (Shift snaps to 15°)';
    return r;
  }
  function attachAnnots(slideEl,s){
    var layer=document.createElement('div');
    layer.className='annot-layer tool-'+tool;
    slideEl.appendChild(layer);
    renderAnnots(layer,s);
    if(mode==='edit') wireEditor(layer,s);
    /* draw any Plotly figures cloned into cell frames (json specs only —
       cloned scripts would clash on duplicate ids) */
    if(window.SemActivate) window.SemActivate(layer,true);
  }
  function editableText(layer,el,getVal,setVal,idx,rich){
    try{
      el.contentEditable=(el.tagName==='UL'||rich)?'true':'plaintext-only';
    }catch(e){el.contentEditable='true';}
    el.spellcheck=false;
    el.addEventListener('focus',function(){
      if(tool!=='select') el.blur();
    });
    el.addEventListener('focus',function(){
      if(!getVal()) el.textContent='';
    });
    el.addEventListener('blur',function(){
      var v=(el.innerText||'').replace(/\r/g,'')
        .replace(/\n+$/,'');
      var r=rich?sanitizeRich(el.innerHTML):null;
      setVal(v,r);
      markDirty();
    });
    el.addEventListener('mousedown',function(e){
      if(tool!=='select') return;   /* placing mode: draw over me */
      e.stopPropagation();
      selectAnnot(layer,idx);
    });
  }
  /* a figure frame hugs its plot: the frame ELEMENT is sized to the
     image's contained fit inside the stored rect, so the selection outline
     + resize handle sit exactly on the plot with no letterbox gap. The
     stored rect is left alone at render time (a slide renders at several
     scales — stage, film thumbnails, vpage — and mutating the model from
     whichever layer happens to render would compound); only an explicit
     resize gesture normalises it (startResize). */
  function figFit(layer,a,img){
    if(!img||!img.naturalWidth||!img.naturalHeight) return null;
    var lw=layer.clientWidth,lh=layer.clientHeight;
    if(!lw||!lh) return null;
    var fw=lw*(a.w||34)/100,fh=lh*(a.h||30)/100;
    var r=img.naturalWidth/img.naturalHeight;
    var w2=Math.min(fw,fh*r),h2=w2/r;
    return {x:(a.x||0)+(fw-w2)/2/lw*100,
            y:(a.y||0)+(fh-h2)/2/lh*100,
            w:w2/lw*100,h:h2/lh*100,ratio:r};
  }
  function figImg(c){
    if(c.querySelector('.figpager')) return null;   /* pager: several plots */
    var imgs=$$('.figframe img',c);
    return imgs.length===1?imgs[0]:null;   /* plotly/html figs: no fit */
  }
  function fitFigFrame(layer,a,c){
    var img=figImg(c); if(!img) return;
    var tries=0;
    function go(){
      /* the slide renders detached (no layout yet) and a freshly cloned
         <img> can lack its natural size — retry over a few frames until
         both have real dimensions; a replaced render just stops */
      var f=c.isConnected?figFit(layer,a,img):null;
      if(!f){if(tries++<8) requestAnimationFrame(go);return;}
      c.style.left=f.x+'%';c.style.top=f.y+'%';
      c.style.width=f.w+'%';c.style.height=f.h+'%';
    }
    if(!img.naturalWidth){
      img.addEventListener('load',go,{once:true});
      if(img.decode) img.decode().then(go).catch(function(){});
    }
    go();
  }
  function renderAnnots(layer,s){
    var editing=(mode==='edit');
    layer.innerHTML='';
    /* drop the "empty slide" hint once the slide has any content (placement
       only re-renders the layer, not the whole slide, so clear it here) */
    var _host=layer.parentNode;
    if(_host){
      var _eh=_host.querySelector('.slide-emptyhint');
      if(_eh&&(s.annots||[]).length) _eh.remove();
    }
    /* two svg layers: fat invisible hit-lines UNDER the items (so
       frames stay clickable), visible strokes ON TOP of everything
       (click-transparent) so arrows are never hidden behind frames */
    var svg=document.createElementNS(AN_NS,'svg');
    layer.appendChild(svg);
    var svgTop=document.createElementNS(AN_NS,'svg');
    svgTop.setAttribute('class','an-svgtop');
    var defs=document.createElementNS(AN_NS,'defs');
    svgTop.appendChild(defs);

    if(s.layout==='title'){
      ['t','s'].forEach(function(which){
        var p=titleProps(s,which);
        var d=document.createElement('div');
        d.className='an-item an-title'+(which==='t'?' t-main':'')
          +(selAnnot===which?' sel':'');
        d.style.left=p.x+'%';d.style.top=p.y+'%';
        d.style.fontSize=fontPx(layer,p.size);
        d.style.color=p.color||'#f0f6fa';
        if(p.b) d.style.fontWeight='700';
        if(p.i) d.style.fontStyle='italic';
        var tdeco=(p.u?'underline ':'')+(p.strike?'line-through':'');
        if(tdeco.trim()) d.style.textDecoration=tdeco.trim();
        if(p.align) d.style.textAlign=p.align;
        if(p.font&&FONTMAP[p.font])
          d.style.fontFamily=FONTMAP[p.font];
        applyCommon(d,p,'translate(-50%,-50%)');
        d.setAttribute('data-idx',which);
        if(editing){d.appendChild(mkHandle());
          d.appendChild(mkRotate());}
        var tx=document.createElement('span');tx.className='an-tx';
        var val=which==='t'?s.title:s.sub;
        tx.textContent=val
          ||(editing?(which==='t'?'Click to edit title':'subtitle'):'');
        if(editing){
          editableText(layer,tx,
            function(){return which==='t'?s.title:s.sub;},
            function(v){
              if(which==='t') s.title=v.trim();
              else s.sub=v.trim();
              renderFilm();renderControls();
            },which);
        }
        d.appendChild(tx);
        layer.appendChild(d);
      });
    }

    (s.annots||[]).forEach(function(a,i){
      /* hidden via the Objects pane: skipped while editing, still
         rendered in playback / print */
      if(a.hide&&editing) return;
      if(a.k==='arrow'){
        var col=a.color||'#ff6b57';
        var mk=document.createElementNS(AN_NS,'marker');
        mk.setAttribute('id','an-head-'+i);
        mk.setAttribute('viewBox','0 0 10 10');
        mk.setAttribute('refX','8');mk.setAttribute('refY','5');
        mk.setAttribute('markerWidth','6.5');
        mk.setAttribute('markerHeight','6.5');
        mk.setAttribute('orient','auto-start-reverse');
        var mp=document.createElementNS(AN_NS,'path');
        mp.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
        mp.setAttribute('fill',col);
        mk.appendChild(mp);defs.appendChild(mk);
        var ln=document.createElementNS(AN_NS,'line');
        ln.setAttribute('x1',a.x1+'%');ln.setAttribute('y1',a.y1+'%');
        ln.setAttribute('x2',a.x2+'%');ln.setAttribute('y2',a.y2+'%');
        ln.setAttribute('class','an-arrow-line'
          +(selAnnot===i?' sel':''));
        ln.setAttribute('data-idx',i);
        ln.setAttribute('stroke',col);
        ln.setAttribute('stroke-width',a.sw||3);
        if(a.dash) ln.setAttribute('stroke-dasharray','9 7');
        if(a.op!=null&&a.op<1) ln.style.opacity=a.op;
        ln.setAttribute('marker-end','url(#an-head-'+i+')');
        svgTop.appendChild(ln);
        var hit=document.createElementNS(AN_NS,'line');
        hit.setAttribute('x1',a.x1+'%');hit.setAttribute('y1',a.y1+'%');
        hit.setAttribute('x2',a.x2+'%');hit.setAttribute('y2',a.y2+'%');
        hit.setAttribute('class','an-arrow-hit an-item');
        hit.setAttribute('data-idx',i);
        svg.appendChild(hit);
        if(editing&&!a.lock){   /* a locked arrow gets no live endpoints */
          ['1','2'].forEach(function(which){
            var ep=document.createElement('span');
            ep.className='an-endpt an-endpt-'+which
              +(selAnnot===i?' sel':'');
            ep.style.left=a['x'+which]+'%';
            ep.style.top=a['y'+which]+'%';
            ep.setAttribute('data-idx',i);
            ep.setAttribute('data-ep',which);
            ep.title='Drag to redirect the arrow';
            layer.appendChild(ep);
          });
        }
      } else if(a.k==='rect'){
        var shp=a.shape||'rect';
        var col=a.color||'#ff6b57';
        var r=document.createElement('div');
        var svgShape=!!(SHAPE_PATHS[shp]||SHAPE_GLYPH[shp]);
        r.className='an-item an-rect'+(svgShape?' an-svgshape':'')
          +(selAnnot===i?' sel':'');
        r.style.left=a.x+'%';r.style.top=a.y+'%';
        r.style.width=(a.w||10)+'%';r.style.height=(a.h||10)+'%';
        if(svgShape){
          r.appendChild(drawShapeSvg(shp,col,a.sw||3,a.dash,a.fill));
        } else {
          r.style.borderColor=col;
          r.style.borderWidth=(a.sw||3)+'px';
          r.style.borderStyle=a.dash?'dashed':'solid';
          r.style.background=a.fill?shapeFill(col,0x26/255):'transparent';
          if(shp==='ellipse') r.style.borderRadius='50%';
        }
        applyCommon(r,a);
        r.setAttribute('data-idx',i);
        if(editing){r.appendChild(mkResize());
          r.appendChild(mkRotate());}
        layer.appendChild(r);
      } else if(a.k==='cell'){
        var c=document.createElement('div');
        var it=a.ref?resolveRef(a.ref):null;
        var locked=!!(a.lockver&&a.lockver.commit);
        var lkCard=locked?verCardFor(a):null;
        c.className='an-item an-cell'+((it||locked)?'':' empty')
          +(selAnnot===i?' sel':'');
        c.style.left=a.x+'%';c.style.top=a.y+'%';
        c.style.width=(a.w||34)+'%';c.style.height=(a.h||30)+'%';
        applyCommon(c,a);
        c.setAttribute('data-idx',i);
        if(locked&&lkCard){
          /* pinned to a git commit: render THAT version's card — refresh
             never touches it, the notebook needn't even be open */
          c.title=(lkCard.title||'')+' @ '+a.lockver.commit;
          var vb=frameFromVerCard(lkCard,a.part);
          if(vb){
            if(a.ts) vb.style.zoom=a.ts;
            applyCrop(vb,a);
            if(a.crop&&a.crop.shape) c.classList.add('an-cropped');
            c.appendChild(vb);
            if(!a.crop&&vb.querySelector(
                '.figframe,.figpager,.plotframe')){
              c.classList.add('an-figonly');
              fitFigFrame(layer,a,c);
            }
          }
          lockChip(c,a,true);
          applyCellColor(c,a);
        } else if(locked&&lkCard===undefined){
          var w8=document.createElement('div');w8.className='an-verwait';
          w8.textContent='🔒 '+a.lockver.commit+' — loading…';
          c.appendChild(w8);
        } else if(locked&&!it){
          var w9=document.createElement('div');w9.className='an-verwait';
          w9.textContent='🔒 '+a.lockver.commit+' — not available';
          c.appendChild(w9);
          lockChip(c,a,false);
        } else if(it){
          if(locked) lockChip(c,a,false);  /* lock set, live fallback */
          c.title=it.nb+' — '+it.title;
          var pt0=partOf(a),facs0=facetList(it.ns);
          /* a figure frame carries NO title header, even selected — a
             placed plot is JUST the plot (its name lives in the tooltip
             and the ribbon's Locate in notebook) */
          if(pt0!=='figure'){
            var ch=document.createElement('div');
            ch.className='an-cellhead';
            var chT=document.createElement('span');
            chT.className='an-cellhead-t';
            chT.textContent=it.title;
            ch.appendChild(chT);
            if(facs0.length>1||pt0==='code'){
              var pl=document.createElement('span');
              pl.className='an-cellpart';pl.textContent=pt0;
              ch.appendChild(pl);
            }
            if(multiNb()) ch.appendChild(nbChip('spane-nb',it.nb));
            c.appendChild(ch);
          }
          var fro=frozenFrames.get(a);
          var b=fro?framePartFromSnap(fro,a.part):framePart(it.ns,a.part);
          if(fro&&!b) b=framePart(it.ns,a.part);
          if(b){
            if(a.ts) b.style.zoom=a.ts;
            applyCrop(b,a);
            if(a.crop&&a.crop.shape) c.classList.add('an-cropped');
            c.appendChild(b);
          }
          if(fro){
            c.classList.add('an-frozen');
            if(editing){
              var fz=document.createElement('span');
              fz.className='an-frozenchip';
              fz.textContent='⟲ previous';
              fz.title='This frame shows the figure from BEFORE the last '
                +'notebook refresh — select it and press “Live figure” '
                +'to catch up';
              c.appendChild(fz);
            }
          }
          if(pt0==='figure'&&!a.crop){
            c.classList.add('an-figonly');
            fitFigFrame(layer,a,c);
          }
          applyCellColor(c,a);
          /* No on-frame Replace / part-picker / caption: those controls now
             live in the top ribbon's Object group (cleaner), and a placed
             figure is JUST the figure — so the selection outline hugs the
             content instead of a caption-padded box. */
        } else if(editing){
          var pb=document.createElement('button');
          pb.className='an-cellpick';
          pb.textContent=a.ref?('missing: '+a.ref)
            :'Click to add from notebook';
          pb.addEventListener('mousedown',function(e){
            if(tool==='select') e.stopPropagation();});
          pb.addEventListener('click',function(e){
            if(tool!=='select') return;
            e.stopPropagation();startPick(i);});
          c.appendChild(pb);
        }
        if(editing){c.appendChild(mkResize());
          c.appendChild(mkRotate());}
        layer.appendChild(c);
      } else if(a.k==='text'){
        var d2=document.createElement('div');
        d2.className='an-item an-text'+(a.bg===0?' nobg':'')
          +(selAnnot===i?' sel':'');
        d2.style.left=a.x+'%';d2.style.top=a.y+'%';
        d2.style.fontSize=fontPx(layer,a.size);
        d2.style.color=a.color||'#ffffff';
        if(a.b) d2.style.fontWeight='700';
        if(a.i) d2.style.fontStyle='italic';
        var deco=(a.u?'underline ':'')+(a.strike?'line-through':'');
        if(deco.trim()) d2.style.textDecoration=deco.trim();
        if(a.align) d2.style.textAlign=a.align;
        if(a.font&&FONTMAP[a.font])
          d2.style.fontFamily=FONTMAP[a.font];
        if(a.bg!==0&&a.bgc){
          d2.style.background=a.bgc;
          d2.style.borderColor='transparent';
        }
        if(a.w){d2.style.width=a.w+'%';d2.style.maxWidth='none';}
        applyCommon(d2,a);
        d2.setAttribute('data-idx',i);
        if(editing) d2.appendChild(mkHandle());
        if(editing){d2.appendChild(mkResize());
          d2.appendChild(mkRotate());}
        var tx2;
        if(a.list){
          tx2=document.createElement('ul');
          tx2.className='an-tx an-ul';
          String(a.text||'').split('\n').forEach(function(line){
            var li=document.createElement('li');
            li.textContent=line;
            tx2.appendChild(li);
          });
        } else {
          tx2=document.createElement('span');
          tx2.className='an-tx';
          if(a.html) tx2.innerHTML=sanitizeRich(a.html).html;
          else tx2.textContent=a.text||'';
        }
        if(editing){
          editableText(layer,tx2,
            function(){return a.text;},
            function(v,r){a.text=v;
              if(r&&r.rich&&!a.list) a.html=r.html; else delete a.html;},
            i,!a.list);
        }
        d2.appendChild(tx2);
        layer.appendChild(d2);
      } else if(a.k==='image'){
        var im=document.createElement('div');
        im.className='an-item an-image'+(selAnnot===i?' sel':'');
        im.style.left=a.x+'%';im.style.top=a.y+'%';
        im.style.width=(a.w||30)+'%';im.style.height=(a.h||24)+'%';
        applyCommon(im,a);
        im.setAttribute('data-idx',i);
        var img=document.createElement('img');
        img.className='an-imgel';img.src=a.src||'';img.alt='';
        img.draggable=false;
        applyCrop(img,a);
        im.appendChild(img);
        if(editing){im.appendChild(mkHandle());im.appendChild(mkResize());
          im.appendChild(mkRotate());}
        layer.appendChild(im);
      }
    });
    /* build animations: number the builds in the editor; in playback, hide the
       ones not yet revealed and animate the one just revealed */
    if(s.annots&&s.annots.some(function(a){return a&&a.anim;})){
      var steps=slideBuildSteps(s);
      $$('.an-item[data-idx]',layer).forEach(function(el){
        var raw=el.getAttribute('data-idx');
        if(raw==='t'||raw==='s') return;
        var bi=+raw,ba=(s.annots||[])[bi];
        if(!ba||!ba.anim) return;
        var st=steps.map[ba.anim.order||0];   /* which build step (0-based) */
        if(st==null) return;
        if(editing){
          var bd=document.createElement('span');
          bd.className='an-buildno';bd.textContent=(st+1);
          bd.title='Build '+(st+1)+' — '+(ba.anim.type||'fade')
            +' (items on the same build appear together)';
          el.appendChild(bd);
        } else if(mode==='view'){
          if(st>=revealCount) el.classList.add('an-prebuild');
          else if(st===revealCount-1){
            var atype=ba.anim.type||'fade';
            /* "appear" is instant (no keyframe); rise/zoom animate transform,
               which would fight a rotation and snap — a rotated item fades */
            if(ba.rot&&(atype==='rise'||atype==='zoom')) atype='fade';
            if(atype!=='appear') el.classList.add('an-anim-'+atype);
          }
        }
      });
    }
    layer.appendChild(svgTop);
    /* locked via the Objects pane: visible but untouchable on the canvas
       (select / unlock through the pane) */
    if(editing) (s.annots||[]).forEach(function(a,i){
      if(!a.lock) return;
      $$('.an-item[data-idx="'+i+'"]',layer).forEach(function(el){
        el.classList.add('an-locked');});
    });
  }
  function selectAnnot(layer,idx,additive){
    var s=pres.slides[cur];
    if(idx===null){selAnnot=null;selSet=[];}
    else {
      var mem=groupMembers(s,idx);
      if(additive&&typeof idx==='number'){
        if(selSet.indexOf(idx)>=0){
          selSet=selSet.filter(function(i){return mem.indexOf(i)<0;});
          selAnnot=selSet.length?selSet[selSet.length-1]:null;
        } else {
          mem.forEach(function(i){if(selSet.indexOf(i)<0) selSet.push(i);});
          selAnnot=idx;
        }
      } else {selAnnot=idx;selSet=mem.slice();}
    }
    paintSel(layer);
    var d=$('#et-del');
    if(d) d.disabled=!selSet.some(function(i){return typeof i==='number';});
    showFmt();
    /* refresh the Objects pane only when the selection actually CHANGED
       (resize/endpoint drags re-select every mousemove) */
    var sig=String(selAnnot)+'|'+selSet.join(',');
    if(sig!==lastSelSig){lastSelSig=sig;renderSelPane();}
  }
  var lastSelSig='';
  function defaultColor(kind){
    return kind==='text'?'#ffffff':'#ff6b57';
  }
  function showFmt(){
    var bar=$('#et-fmt'); if(!bar) return;
    var s=pres.slides[cur];
    var a=(s&&selAnnot!==null)?annotByIdx(s,selAnnot):null;
    if(!a){bar.hidden=true;return;}
    var kind=(selAnnot==='t'||selAnnot==='s')?'text':a.k;
    bar.hidden=false;
    function show(id,on,pressed){
      var el=$(id); if(!el) return;
      el.hidden=!on;
      if(on&&pressed!==undefined)
        el.setAttribute('aria-pressed',pressed.toString());
    }
    /* cellText = a resizable text-ish cell (A-/A+ content zoom applies to any
       non-figure cell). noteCell = a MARKDOWN note specifically — only its
       rendered .note carries a colour, so ONLY it gets the colour swatches. */
    var cellText=false,noteCell=false;
    if(kind==='cell'&&a.ref){
      var ci=resolveRef(a.ref);
      cellText=!!ci&&ci.kind!=='figure'&&ci.kind!=='diagnostic';
      noteCell=!!ci&&ci.kind==='note';
    }
    var isText=(kind==='text');
    var isNum=(typeof selAnnot==='number');
    /* the colour swatches drive a.color for text / arrows / shapes, and a.txcol
       for a markdown note — but NOT images or figure/code cells */
    var colourable=isText||kind==='arrow'||kind==='rect'||noteCell;
    $$('.sw:not(.swbg)',bar).forEach(function(sw){
      sw.hidden=!colourable;
      var cur_=(kind==='cell')?(a.txcol||''):(a.color||defaultColor(kind));
      sw.setAttribute('aria-pressed',(cur_===sw.dataset.c).toString());
    });
    show('#fmt-smaller',isText||cellText);
    show('#fmt-bigger',isText||cellText);
    var fontSel=$('#fmt-font');
    if(fontSel){
      fontSel.hidden=!isText;
      if(isText) fontSel.value=a.font||'sans';
    }
    show('#fmt-bold',isText,!!a.b);
    show('#fmt-ital',isText,!!a.i);
    show('#fmt-under',isText,!!a.u);
    show('#fmt-strike',isText,!!a.strike);
    show('#fmt-align',isText);
    var alBtn=$('#fmt-align');
    if(alBtn&&isText){
      var al=a.align||'left';
      alBtn.textContent=al.charAt(0).toUpperCase()+al.slice(1);
    }
    show('#fmt-szwrap',isText);
    var szIn=$('#fmt-size');
    if(szIn&&isText&&document.activeElement!==szIn)
      szIn.value=Math.round((a.size||2.6)*5.4);
    show('#fmt-list',isText&&isNum,!!a.list);
    show('#fmt-line',kind==='arrow'||kind==='rect');
    show('#fmt-dash',kind==='arrow'||kind==='rect',!!a.dash);
    show('#fmt-fill',kind==='rect',!!a.fill);
    show('#fmt-shape',kind==='rect',!!a.shape&&a.shape!=='rect');
    show('#fmt-opwrap',true);
    var opR=$('#fmt-op'),opV=$('#fmt-opval');
    var opPct=Math.round((a.op==null?1:a.op)*100);
    if(opR) opR.value=opPct;
    if(opV) opV.textContent=opPct+'%';
    show('#fmt-rotl',kind!=='arrow');
    show('#fmt-rotr',kind!=='arrow');
    show('#fmt-dup',isNum);
    var nSel=selSet.filter(function(i){return typeof i==='number';}).length;
    show('#fmt-group',nSel>=2);
    show('#fmt-ungroup',isNum&&a.grp!=null);
    show('#fmt-front',isNum&&kind!=='arrow');
    show('#fmt-back',isNum&&kind!=='arrow');
    show('#fmt-arline',nSel>=2);
    show('#fmt-argrid',nSel>=2);
    show('#fmt-samewrap',nSel>=2);
    var plainText=isText&&typeof selAnnot==='number';
    var showBg=plainText||noteCell;
    show('#fmt-txlab',(isText&&kind!=='cell')||noteCell);
    show('#fmt-bglab',showBg);
    $$('.swbg',bar).forEach(function(sw){
      sw.hidden=!showBg;
      var cur_=(kind==='cell')
        ?(a.bgcol||'')
        :((a.bg===0)?'none':(a.bgc||'#0e1926'));
      sw.setAttribute('aria-pressed',(cur_===sw.dataset.c).toString());
    });
    show('#fmt-replace',kind==='cell');
    show('#fmt-locate',kind==='cell'&&!!a.ref);
    var lockedV=(kind==='cell')&&!!(a.lockver&&a.lockver.commit);
    var frozen=(kind==='cell')&&frozenFrames.has(a);
    var hasPrev=(kind==='cell')&&!!a.ref
      &&!!frameSnapsPrev[normRef(a.ref)];
    show('#fmt-revert',(frozen||hasPrev)&&!lockedV);
    if((frozen||hasPrev)&&!lockedV){
      var rvb=$('#fmt-revert');
      if(rvb) rvb.innerHTML=frozen
        ?'&#8635; Live figure':'&#10226; Previous figure';
    }
    var canLock=(kind==='cell')&&!!a.ref&&APP.mode==='app';
    show('#fmt-lockver',canLock);
    if(canLock){
      var lvb=$('#fmt-lockver');
      if(lvb) lvb.innerHTML=lockedV
        ?'&#128275; Unlock figure':'&#128274; Lock figure';
    }
    show('#fmt-cropwrap',kind==='image'||kind==='cell');
    show('#fmt-animwrap',isNum);
    /* the code/figure/output part-picker (+ split) — moved off the frame
       into the ribbon's Object group */
    var partsSlot=$('#fmt-parts');
    if(partsSlot){
      partsSlot.innerHTML='';
      var pcr=(kind==='cell'&&typeof selAnnot==='number')
        ?buildPartChooser(s,selAnnot):null;
      if(pcr) partsSlot.appendChild(pcr);
      partsSlot.hidden=!pcr;
    }
    var animBtn=$('#fmt-anim');
    if(animBtn&&isNum){
      var an=a.anim&&a.anim.type;
      var lbl={appear:'Appear',fade:'Fade',rise:'Rise',zoom:'Zoom'}[an]
        ||'Animate';
      animBtn.innerHTML='&#9654; '+lbl+' &#9662;';
    }
    syncRibbonGroups();
  }
  /* hide a ribbon group whose controls are all hidden, and drop the divider
     before the first visible group — so the format ribbon stays tidy */
  function syncRibbonGroups(){
    var bar=$('#et-fmt'); if(!bar) return;
    var first=null;
    $$('.rbn-grp',bar).forEach(function(g){
      var vis=false,kids=g.querySelectorAll('button,input,select,.sh-drop');
      for(var i=0;i<kids.length;i++){
        var n=kids[i],blocked=false;
        while(n&&n!==g){if(n.hidden){blocked=true;break;}n=n.parentNode;}
        if(!blocked){vis=true;break;}
      }
      g.hidden=!vis;
      g.classList.remove('rbn-first');
      if(vis&&!first) first=g;
    });
    if(first) first.classList.add('rbn-first');
  }
  function fmtApply(fn){
    var s=pres.slides[cur]; if(!s) return;
    /* apply to EVERY selected item (a group or shift-multi-select), not just
       the primary — otherwise formatting a multi-selection silently changes
       only one item and collapses the selection */
    var targets=selSet.filter(function(i){return typeof i==='number';});
    if(targets.length){
      targets.forEach(function(i){if(s.annots[i]) fn(s.annots[i]);});
    } else {
      var a=annotByIdx(s,selAnnot); if(!a) return;
      fn(a);
    }
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(!l) return;
    renderAnnots(l,s);
    if(targets.length>1){        /* keep the multi-selection alive */
      selSet=targets.slice();paintSel(l);
      var d=$('#et-del'); if(d) d.disabled=false;
      showFmt();
    } else selectAnnot(l,selAnnot);
  }
  function pctPoint(layer,ev){
    var r=layer.getBoundingClientRect();
    return {x:Math.max(0,Math.min(100,(ev.clientX-r.left)/r.width*100)),
            y:Math.max(0,Math.min(100,(ev.clientY-r.top)/r.height*100))};
  }
  /* ---- snap-to-align: while dragging or resizing, edges and centers
     snap to the canvas (edges + middle) and to every other object's
     edges + centers, with dashed guide lines. Hold Alt to disable. ---- */
  var SNAP_PX=6;
  function annotRectPct(layer,s,i){
    var a=(s.annots||[])[i]; if(!a) return null;
    if(a.k==='arrow')
      return {l:Math.min(a.x1,a.x2),r:Math.max(a.x1,a.x2),
              t:Math.min(a.y1,a.y2),b:Math.max(a.y1,a.y2)};
    var el=layer.querySelector('.an-item[data-idx="'+i+'"]');
    /* auto-sized items (text) AND aspect-fitted figure frames answer with
       their RENDERED rect — snapping must align to the visible plot, not
       a letterboxed stored box */
    if(el&&(a.w==null||a.h==null
            ||el.classList.contains('an-figonly'))){
      var lr=layer.getBoundingClientRect();
      if(lr.width&&lr.height){
        var er=el.getBoundingClientRect();
        return {l:(er.left-lr.left)/lr.width*100,
                r:(er.right-lr.left)/lr.width*100,
                t:(er.top-lr.top)/lr.height*100,
                b:(er.bottom-lr.top)/lr.height*100};
      }
    }
    if(a.w==null||a.h==null) return null;
    return {l:a.x,r:a.x+a.w,t:a.y,b:a.y+a.h};
  }
  function snapTargets(layer,s,skip){
    var xs=[0,50,100],ys=[0,50,100];
    (s.annots||[]).forEach(function(a,i){
      if(skip.indexOf(i)>=0||a.hide) return;
      var r=annotRectPct(layer,s,i);
      if(!r) return;
      xs.push(r.l,(r.l+r.r)/2,r.r);
      ys.push(r.t,(r.t+r.b)/2,r.b);
    });
    return {xs:xs,ys:ys};
  }
  function bestSnap(cands,vals,thr){
    var best=null;
    for(var i=0;i<vals.length;i++) for(var j=0;j<cands.length;j++){
      var d=cands[j]-vals[i];
      if(Math.abs(d)<=thr&&(!best||Math.abs(d)<Math.abs(best.d)))
        best={d:d,at:cands[j]};
    }
    return best;
  }
  function snapThr(layer){
    var r=layer.getBoundingClientRect();
    return {x:r.width?SNAP_PX/r.width*100:1,
            y:r.height?SNAP_PX/r.height*100:1};
  }
  function drawSnapGuides(layer,sx,sy){
    $$('.snapline',layer).forEach(function(n){n.remove();});
    if(sx!=null){
      var v=document.createElement('div');
      v.className='snapline snap-v';v.style.left=sx+'%';
      layer.appendChild(v);
    }
    if(sy!=null){
      var h=document.createElement('div');
      h.className='snapline snap-h';h.style.top=sy+'%';
      layer.appendChild(h);
    }
  }
  function clearSnapGuides(layer){
    $$('.snapline',layer).forEach(function(n){n.remove();});
  }
  function startMove(layer,s,idx,ev0){
    ev0.preventDefault();
    var a=annotByIdx(s,idx); if(!a) return;
    var start=pctPoint(layer,ev0);
    /* drag the whole current selection (group / multi-select) together —
       locked members stay put (lock = can't be dragged) */
    var movers=selSet.filter(function(i){return typeof i==='number';});
    if(typeof idx==='number'&&movers.indexOf(idx)<0) movers=[idx];
    movers=movers.filter(function(i){
      var m=(s.annots||[])[i];return m&&!m.lock;});
    var origs={};
    movers.forEach(function(i){
      origs[i]=JSON.parse(JSON.stringify((s.annots||[])[i]));});
    var single=(typeof idx!=='number')?JSON.parse(JSON.stringify(a)):null;
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,movers);
    /* snap by the union bounding box of everything being dragged
       (hidden members travel along but contribute no snap geometry) */
    var origBB=null;
    movers.forEach(function(i){
      var m=(s.annots||[])[i];
      if(!m||m.hide) return;
      var r=annotRectPct(layer,s,i); if(!r) return;
      origBB=origBB?{l:Math.min(origBB.l,r.l),r:Math.max(origBB.r,r.r),
        t:Math.min(origBB.t,r.t),b:Math.max(origBB.b,r.b)}:r;
    });
    function mm(ev){
      var p=pctPoint(layer,ev);
      var dx=p.x-start.x,dy=p.y-start.y;
      var sx=null,sy=null;
      if(!ev.altKey){
        if(single){       /* a title item positions by its CENTER */
          var bx0=bestSnap(targets.xs,[single.x+dx],thr.x);
          var by0=bestSnap(targets.ys,[single.y+dy],thr.y);
          if(bx0){dx+=bx0.d;sx=bx0.at;}
          if(by0){dy+=by0.d;sy=by0.at;}
        } else if(origBB){
          var bb={l:origBB.l+dx,r:origBB.r+dx,
                  t:origBB.t+dy,b:origBB.b+dy};
          var bx=bestSnap(targets.xs,[bb.l,(bb.l+bb.r)/2,bb.r],thr.x);
          var by=bestSnap(targets.ys,[bb.t,(bb.t+bb.b)/2,bb.b],thr.y);
          if(bx){dx+=bx.d;sx=bx.at;}
          if(by){dy+=by.d;sy=by.at;}
        }
      }
      if(single){a.x=single.x+dx;a.y=single.y+dy;}
      else movers.forEach(function(i){
        var m=(s.annots||[])[i],o=origs[i];
        if(!m||!o) return;
        if(m.k==='arrow'){
          m.x1=o.x1+dx;m.y1=o.y1+dy;m.x2=o.x2+dx;m.y2=o.y2+dy;
        } else {m.x=o.x+dx;m.y=o.y+dy;}
      });
      renderAnnots(layer,s);paintSel(layer);
      drawSnapGuides(layer,sx,sy);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startResize(layer,s,idx,ev0,corner){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a||typeof idx!=='number') return;
    corner=corner||'se';
    var east=corner.indexOf('e')>=0,west=corner.indexOf('w')>=0;
    var south=corner.indexOf('s')>=0,north=corner.indexOf('n')>=0;
    var start=pctPoint(layer,ev0);
    var el=layer.querySelector('.an-item[data-idx="'+idx+'"]');
    var lr=layer.getBoundingClientRect();
    /* a figure frame: first snap the stored rect to the plot it visually
       hugs, then keep the plot's aspect locked while dragging */
    var figRatio=0;
    if(a.k==='cell'&&el&&el.classList.contains('an-figonly')){
      var ff=figFit(layer,a,figImg(el));
      if(ff){a.x=ff.x;a.y=ff.y;a.w=ff.w;a.h=ff.h;figRatio=ff.ratio;}
    }
    var er=el?el.getBoundingClientRect():null;
    var ox=a.x||0,oy=a.y||0;
    var ow=a.w||(er?er.width/lr.width*100:10);
    var oh=a.h||(er?er.height/lr.height*100:10);
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,[idx]);
    function mm(ev){
      var p=pctPoint(layer,ev);
      var dx=p.x-start.x,dy=p.y-start.y;
      /* the dragged corner moves; the opposite corner stays anchored */
      if(east) a.w=Math.max(4,ow+dx);
      if(west){var ww=Math.max(4,ow-dx);a.x=ox+(ow-ww);a.w=ww;}
      if(a.k!=='text'){
        if(south) a.h=Math.max(4,oh+dy);
        if(north){var nh=Math.max(4,oh-dy);a.y=oy+(oh-nh);a.h=nh;}
      }
      var sx=null,sy=null;
      if(!ev.altKey){
        /* the moving edges snap; an aspect-locked figure snaps its width
           and lets the height follow the plot's ratio. A guide only shows
           when the snap actually landed (the 4% minimum can cancel it). */
        var bx=bestSnap(targets.xs,[east?a.x+a.w:a.x],thr.x);
        if(bx){
          if(east){if(a.w+bx.d>=4){a.w=a.w+bx.d;sx=bx.at;}}
          else if(a.w-bx.d>=4){a.x=a.x+bx.d;a.w=a.w-bx.d;sx=bx.at;}
        }
        if(a.k!=='text'&&!figRatio){
          var by=bestSnap(targets.ys,[south?a.y+a.h:a.y],thr.y);
          if(by){
            if(south){if(a.h+by.d>=4){a.h=a.h+by.d;sy=by.at;}}
            else if(a.h-by.d>=4){a.y=a.y+by.d;a.h=a.h-by.d;sy=by.at;}
          }
        }
      }
      if(figRatio&&lr.height){
        var fh=a.w*(lr.width/(lr.height*figRatio));
        if(north) a.y=oy+oh-fh;   /* keep the bottom edge anchored */
        a.h=fh;
      }
      renderAnnots(layer,s);selectAnnot(layer,idx);
      drawSnapGuides(layer,sx,sy);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startRotate(layer,s,idx,ev0){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a) return;
    function mm(ev){
      var el=layer.querySelector('.an-item[data-idx="'+idx+'"]');
      if(!el) return;
      /* the visual centre is rotation-invariant, so measuring the live
         bounding box keeps the pivot stable while the item spins */
      var r=el.getBoundingClientRect();
      var ang=Math.atan2(ev.clientY-(r.top+r.height/2),
                         ev.clientX-(r.left+r.width/2))*180/Math.PI+90;
      if(ev.shiftKey) ang=Math.round(ang/15)*15;
      ang=((ang%360)+360)%360;
      if(ang>180) ang-=360;
      /* a small magnetic dead-zone so items land EXACTLY straight */
      [0,90,-90,180,-180].forEach(function(v){
        if(Math.abs(ang-v)<=1) ang=(v===-180)?180:v;});
      a.rot=Math.round(ang*10)/10||0;
      renderAnnots(layer,s);paintSel(layer);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      if(!a.rot) delete a.rot;
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startDraw(layer,s,kind,p0){
    var a=(kind==='rect')
      ?{k:'rect',x:p0.x,y:p0.y,w:0,h:0,color:'#ff6b57',sw:3,
        shape:(pendingShape!=='rect'?pendingShape:undefined)}
      :{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,
        color:'#ff6b57',sw:3};
    s.annots=s.annots||[];
    s.annots.push(a);
    var idx=s.annots.length-1;
    function mm(ev){
      var p=pctPoint(layer,ev);
      if(a.k==='rect'){
        a.x=Math.min(p0.x,p.x);a.y=Math.min(p0.y,p.y);
        a.w=Math.abs(p.x-p0.x);a.h=Math.abs(p.y-p0.y);
      } else {a.x2=p.x;a.y2=p.y;}
      renderAnnots(layer,s);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      var tiny=(a.k==='rect')?(a.w<1.5&&a.h<1.5)
        :(Math.abs(a.x2-a.x1)<1.5&&Math.abs(a.y2-a.y1)<1.5);
      if(tiny) s.annots.splice(idx,1);
      markDirty();setTool('select');
      renderAnnots(layer,s);
      if(!tiny) selectAnnot(layer,idx);
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function distToSeg(px,py,x1,y1,x2,y2){
    var dx=x2-x1,dy=y2-y1;
    var L2=dx*dx+dy*dy;
    var u=L2?((px-x1)*dx+(py-y1)*dy)/L2:0;
    u=Math.max(0,Math.min(1,u));
    return Math.hypot(px-(x1+u*dx),py-(y1+u*dy));
  }
  function startEndpoint(layer,s,idx,ep,ev0){
    ev0.preventDefault();
    var a=(s.annots||[])[idx];
    if(!a||a.k!=='arrow'||a.lock) return;
    function mm(ev){
      var p=pctPoint(layer,ev);
      a['x'+ep]=p.x;a['y'+ep]=p.y;
      renderAnnots(layer,s);selectAnnot(layer,idx);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function arrowAt(layer,s,ev){
    if(!s.annots) return -1;
    var r=layer.getBoundingClientRect();
    var px=ev.clientX-r.left,py=ev.clientY-r.top;
    var best=-1,bestD=12;
    s.annots.forEach(function(a,i){
      if(a.k!=='arrow'||a.lock||a.hide) return;
      var d=distToSeg(px,py,
        a.x1/100*r.width,a.y1/100*r.height,
        a.x2/100*r.width,a.y2/100*r.height);
      if(d<bestD){bestD=d;best=i;}
    });
    return best;
  }
  function wireEditor(layer,s){
    layer.addEventListener('mousedown',function(ev){
      if(mode!=='edit') return;
      var t=ev.target;
      var item=(t.closest&&t.closest('.an-item'))
        ||(t.getAttribute&&t.classList
           &&t.classList.contains('an-item')?t:null);
      if(tool==='select'){
        /* endpoint handles first, then resize handles, then arrows
           (they render on top, so they win the click even over a
           frame), then the item */
        if(t.classList&&t.classList.contains('an-endpt')){
          var idxE=+t.getAttribute('data-idx');
          selectAnnot(layer,idxE);
          startEndpoint(layer,s,idxE,
            t.getAttribute('data-ep'),ev);
          return;
        }
        if(item&&t.classList&&t.classList.contains('an-resize')){
          var rawR=item.getAttribute('data-idx');
          var idxR=(rawR==='t'||rawR==='s')?rawR:+rawR;
          selectAnnot(layer,idxR);
          startResize(layer,s,idxR,ev,t.dataset.corner);
          return;
        }
        if(item&&t.classList&&t.classList.contains('an-rotate')){
          var rawRo=item.getAttribute('data-idx');
          var idxRo=(rawRo==='t'||rawRo==='s')?rawRo:+rawRo;
          selectAnnot(layer,idxRo);
          startRotate(layer,s,idxRo,ev);
          return;
        }
        var ai=arrowAt(layer,s,ev);
        if(ai>=0){
          /* honour shift/multi-select the same way the item branch does */
          if(ev.shiftKey){selectAnnot(layer,ai,true);return;}
          if(selSet.indexOf(ai)<0) selectAnnot(layer,ai,false);
          else {selAnnot=ai;paintSel(layer);showFmt();}
          startMove(layer,s,ai,ev);
          return;
        }
        if(item){
          var raw=item.getAttribute('data-idx');
          var idx=(raw==='t'||raw==='s')?raw:+raw;
          /* Shift+click adds/removes from the selection (for grouping);
             it never starts a drag */
          if(ev.shiftKey&&typeof idx==='number'){
            selectAnnot(layer,idx,true);return;
          }
          /* clicking an item already in a multi-selection keeps the set and
             drags the whole group */
          if(selSet.indexOf(idx)<0) selectAnnot(layer,idx,false);
          else {selAnnot=idx;paintSel(layer);showFmt();}
          var handleOnly=item.classList.contains('an-text')
            ||item.classList.contains('an-title');
          /* a grouped/multi-selected item drags from its body too (its move
             handle is hidden), so the whole group moves as one */
          var grouped=(selSet.length>1&&selSet.indexOf(idx)>=0);
          if(grouped||!handleOnly
             ||(t.classList&&t.classList.contains('an-handle')))
            startMove(layer,s,idx,ev);
        } else selectAnnot(layer,null);
        return;
      }
      ev.preventDefault();
      var p=pctPoint(layer,ev);
      if(tool==='text'){
        s.annots=s.annots||[];
        s.annots.push({k:'text',x:p.x,y:p.y,text:'Text',
          size:2.6,color:'#ffffff',bg:1});
        var idx2=s.annots.length-1;
        markDirty();setTool('select');
        renderAnnots(layer,s);selectAnnot(layer,idx2);
        var tx=layer.querySelector(
          '.an-item[data-idx="'+idx2+'"] .an-tx');
        if(tx){
          tx.focus();
          try{
            var rng=document.createRange();
            rng.selectNodeContents(tx);
            var sl=window.getSelection();
            sl.removeAllRanges();sl.addRange(rng);
          }catch(e){}
        }
      } else if(tool==='cell'){
        s.annots=s.annots||[];
        s.annots.push({k:'cell',x:Math.min(p.x,64),
          y:Math.min(p.y,64),w:34,h:30,ref:null});
        markDirty();setTool('select');
        renderAnnots(layer,s);
        selectAnnot(layer,s.annots.length-1);
      } else if(tool==='rect'||tool==='arrow'){
        startDraw(layer,s,tool,p);
      }
    });
  }
  function setTool(t){
    tool=t;
    $$('#edit-tools .et').forEach(function(b){
      b.setAttribute('aria-pressed',(b.dataset.tool===t).toString());});
    var shb=$('#sh-btn');   /* the Shapes dropdown draws the 'rect' tool */
    if(shb) shb.setAttribute('aria-pressed',(t==='rect').toString());
    var l=stage.querySelector('.annot-layer');
    if(l) l.className='annot-layer tool-'+t;
    var hint=$('#et-hint');
    if(hint) hint.textContent=
      t==='text'?'Click on the slide to place a text box'
      :t==='arrow'?'Drag on the slide to draw an arrow'
      :t==='rect'?('Drag on the slide to draw a '
        +(pendingShape==='rect'?'rectangle':pendingShape))
      :t==='cell'?'Click on the slide to drop a cell frame, then pick a card '
        +'from your notebook to fill it'
      :'Click an item to select; drag to move; Del removes';
  }
  function deleteSel(){
    var s=pres.slides[cur];
    if(!s||!s.annots) return;
    var idxs=selSet.filter(function(i){return typeof i==='number';});
    if(!idxs.length&&typeof selAnnot==='number') idxs=[selAnnot];
    if(!idxs.length) return;
    idxs.sort(function(x,y){return y-x;}).forEach(function(i){
      if(i>=0&&i<s.annots.length) s.annots.splice(i,1);});
    if(!s.annots.length) delete s.annots;
    selAnnot=null;selSet=[];markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l) renderAnnots(l,s);
    var d=$('#et-del'); if(d) d.disabled=true;
    showFmt();
  }
  function groupSel(){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var idxs=selSet.filter(function(i){return typeof i==='number';});
    if(idxs.length<2) return;
    var gid=nextGrp(s);
    idxs.forEach(function(i){if(s.annots[i]) s.annots[i].grp=gid;});
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,idxs[0]);}
  }
  function ungroupSel(){
    var s=pres.slides[cur];
    if(!s||typeof selAnnot!=='number'||!s.annots) return;
    var a=s.annots[selAnnot]; if(!a||a.grp==null) return;
    var g=a.grp;
    s.annots.forEach(function(x){if(x.grp===g) delete x.grp;});
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,selAnnot);}
  }

  /* ---------- picking: click a notebook card into a cell frame ------- */
  function startPick(idx){
    if(typeof idx!=='number') return;
    picking=idx;
    deckEl.hidden=true;
    document.body.classList.remove('deck-open');
    document.body.classList.remove('creating-docs');
    document.body.classList.remove('slide-editing');
    document.body.classList.add('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=false;
  }
  function endPick(ref){
    var idx=picking; picking=-1;
    document.body.classList.remove('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=true;
    if(ref!==undefined&&idx>=0){
      var s=pres.slides[cur];
      var a=s&&(s.annots||[])[idx];
      if(a&&a.k==='cell'){a.ref=ref;markDirty();}
    }
    openDeck('edit');
    var l=stage.querySelector('.annot-layer');
    if(l&&idx>=0) selectAnnot(l,idx);
  }
  document.addEventListener('click',function(e){
    if(picking<0) return;
    var t=e.target;
    if(!t||!t.closest) return;
    if(t.closest('.pickbar')) return;
    var shellEl=t.closest('.nbshell');
    if(!shellEl) return;
    var card=t.closest('.card');
    if(!card) return;
    if(t.closest('.codetoggle,.depchip,a')) return;
    e.preventDefault();e.stopPropagation();
    /* a Plot-trace tab's cards are clones — resolve to the real notebook */
    endPick(nsKey(shellEl.dataset.src||shellEl.dataset.nb,
      card.dataset.anchor));
  },true);

  /* ---------- format bar wiring ---------- */
  $$('#et-fmt .sw:not(.swbg):not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('mousedown',function(e){
      /* keep the caret/selection in the text box so we can recolour just
         the highlighted run instead of the whole box */
      if(activeTextEditable()) e.preventDefault();
    });
    sw.addEventListener('click',function(){
      if(colorSelection(sw.dataset.c)) return;
      fmtApply(function(a){
        if(a.k==='cell') a.txcol=sw.dataset.c;
        else a.color=sw.dataset.c;
      });
    });
  });
  function onFmt(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(){fmtApply(fn);});
  }
  onFmt('#fmt-smaller',function(a){
    if(a.k==='cell') a.ts=Math.max(0.5,
      Math.round((a.ts||1)/1.15*100)/100);
    else a.size=Math.max(1.2,(a.size||2.6)/1.25);});
  onFmt('#fmt-bigger',function(a){
    if(a.k==='cell') a.ts=Math.min(3,
      Math.round((a.ts||1)*1.15*100)/100);
    else a.size=Math.min(20,(a.size||2.6)*1.25);});
  onFmt('#fmt-line',function(a){
    var cur_=a.sw||3;
    a.sw=cur_>=5?2:(cur_>=3.5?5:3.5);});
  onFmt('#fmt-dash',function(a){a.dash=a.dash?0:1;});
  onFmt('#fmt-fill',function(a){a.fill=a.fill?0:1;});
  $$('#et-fmt .swbg:not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('click',function(){
      fmtApply(function(a){
        if(a.k==='cell'){a.bgcol=sw.dataset.c;}
        else if(sw.dataset.c==='none'){a.bg=0;}
        else{a.bg=1;a.bgc=sw.dataset.c;}
      });
    });
  });

  /* ---------- professional colour picker: hex / rgb / rgba + alpha + a
     recent-colours strip. Text swatches and the fill swatches each get a
     rainbow "＋" chip that opens it; any CSS colour string is accepted. ---- */
  var cpEl=$('#color-pop'), cpTarget='text', cpRGBA={r:57,g:169,b:192,a:1};
  /* a live text selection captured when the picker opens, so a custom colour
     can recolour just the highlighted run (focus moves to the popup on apply) */
  var cpSavedEl=null, cpSavedRange=null;
  function clamp255(n){n=Math.round(+n||0);return n<0?0:n>255?255:n;}
  function hex2(n){return ('0'+clamp255(n).toString(16)).slice(-2);}
  function toHex(c){return '#'+hex2(c.r)+hex2(c.g)+hex2(c.b);}
  function toStr(c){
    return c.a>=1?toHex(c):('rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '
      +clamp255(c.b)+', '+(Math.round(c.a*100)/100)+')');
  }
  /* faint fill tint of a shape's colour — PARSE first so translucent rgba()
     colours work, not just #rrggbb (a hex-suffix concat would corrupt them);
     `alpha` is the tint fraction of 255 (matches the old 0x26 / 0x2b). */
  function shapeFill(col,alpha){
    var c=parseColor(col); if(!c) return 'transparent';
    return 'rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '+clamp255(c.b)+', '
      +(Math.round(c.a*alpha*1000)/1000)+')';
  }
  function parseColor(str){
    if(!str) return null;
    str=String(str).trim();
    var m=str.match(/^#([0-9a-f]{3,8})$/i);
    if(m){
      var h=m[1];
      if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      else if(h.length===4) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
      if(h.length===6||h.length===8) return {
        r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),
        b:parseInt(h.slice(4,6),16),
        a:h.length===8?parseInt(h.slice(6,8),16)/255:1};
      return null;
    }
    m=str.match(/^rgba?\(([^)]+)\)$/i);
    if(m){
      var p=m[1].split(/[,\s/]+/).filter(Boolean);
      if(p.length>=3){var pa=parseFloat(p[3]);
        return {r:clamp255(parseFloat(p[0])),g:clamp255(parseFloat(p[1])),
          b:clamp255(parseFloat(p[2])),
          a:p.length>3?(isFinite(pa)?Math.max(0,Math.min(1,pa)):1):1};}
    }
    return null;
  }
  function cpSync(from){
    var nat=$('#cp-native'),hx=$('#cp-hex'),rg=$('#cp-rgb'),
        al=$('#cp-alpha'),av=$('#cp-aval'),pv=$('#cp-preview');
    if(nat&&from!=='native') nat.value=toHex(cpRGBA);
    if(hx&&from!=='hex') hx.value=cpRGBA.a>=1?toHex(cpRGBA)
      :toHex(cpRGBA)+hex2(Math.round(cpRGBA.a*255));
    if(rg&&from!=='rgb') rg.value='rgba('+clamp255(cpRGBA.r)+', '
      +clamp255(cpRGBA.g)+', '+clamp255(cpRGBA.b)+', '
      +(Math.round(cpRGBA.a*100)/100)+')';
    if(al&&from!=='alpha') al.value=Math.round(cpRGBA.a*100);
    if(av) av.textContent=Math.round(cpRGBA.a*100)+'%';
    if(pv) pv.style.setProperty('--cpc',toStr(cpRGBA));
    if(hx) hx.classList.remove('bad');
    if(rg) rg.classList.remove('bad');
  }
  function cpRecent(){
    try{return JSON.parse(localStorage.getItem('plotline-colors')||'[]');}
    catch(e){return [];}
  }
  function cpPushRecent(str){
    var arr=cpRecent().filter(function(x){return x!==str;});
    arr.unshift(str);
    try{localStorage.setItem('plotline-colors',
      JSON.stringify(arr.slice(0,12)));}catch(e){}
  }
  function cpRenderRecent(){
    var box=$('#cp-recent'); if(!box) return;
    box.innerHTML='';
    cpRecent().forEach(function(str){
      var b=document.createElement('button');
      b.className='cp-rsw cp-sw-chk';b.type='button';b.title=str;
      b.style.setProperty('--cpc',str);
      b.addEventListener('click',function(){
        var c=parseColor(str); if(c){cpRGBA=c;cpSync();}});
      box.appendChild(b);
    });
  }
  function cpCurrentFor(target){
    var s=pres.slides[cur];
    var a=(s&&selAnnot!==null)?annotByIdx(s,selAnnot):null;
    if(!a) return null;
    if(target==='fill')
      return a.k==='cell'?(a.bgcol||null):(a.bg===0?null:(a.bgc||null));
    return a.k==='cell'?(a.txcol||null):(a.color||null);
  }
  function openColorPop(target,anchor){
    if(!cpEl) return;
    cpTarget=target;
    cpSavedEl=null;cpSavedRange=null;
    if(target==='text'){
      var te=activeTextEditable();
      if(te&&selectionInside(te)) try{
        cpSavedEl=te;
        cpSavedRange=window.getSelection().getRangeAt(0).cloneRange();
      }catch(e){cpSavedEl=null;cpSavedRange=null;}
    }
    var head=$('#cp-head');
    if(head) head.textContent=target==='fill'?'Custom fill':'Custom colour';
    var c0=parseColor(cpCurrentFor(target))||{r:57,g:169,b:192,a:1};
    cpRGBA={r:c0.r,g:c0.g,b:c0.b,a:c0.a};
    cpRenderRecent();cpSync();
    cpEl.hidden=false;
    var r=anchor.getBoundingClientRect(),w=236;
    var ph=cpEl.getBoundingClientRect().height||300;
    var left=Math.max(8,Math.min(r.left,window.innerWidth-w-8));
    var top=r.bottom+8;
    if(top+ph>window.innerHeight-8) top=Math.max(8,r.top-ph-8);
    cpEl.style.left=left+'px';cpEl.style.top=top+'px';
  }
  function cpApply(){
    var str=toStr(cpRGBA);
    if(cpTarget==='text'){
      var did=false;
      /* restore the highlighted run (focus moved to the popup) and recolour
         just it, like the preset swatches do; else colour the whole box */
      if(cpSavedEl&&cpSavedRange&&document.body.contains(cpSavedEl)) try{
        cpSavedEl.focus();
        var sel=window.getSelection();
        sel.removeAllRanges();sel.addRange(cpSavedRange);
        did=colorSelection(str);
      }catch(e){did=false;}
      if(!did) fmtApply(function(a){
        if(a.k==='cell') a.txcol=str; else a.color=str;});
    } else fmtApply(function(a){
      if(a.k==='cell') a.bgcol=str; else {a.bg=1;a.bgc=str;}});
    cpSavedEl=null;cpSavedRange=null;
    cpPushRecent(str);
    if(cpEl) cpEl.hidden=true;
  }
  (function(){
    var nat=$('#cp-native'),hx=$('#cp-hex'),rg=$('#cp-rgb'),al=$('#cp-alpha');
    if(nat) nat.addEventListener('input',function(){
      var c=parseColor(nat.value);
      if(c){cpRGBA.r=c.r;cpRGBA.g=c.g;cpRGBA.b=c.b;cpSync('native');}});
    if(hx) hx.addEventListener('input',function(){
      var v=hx.value.trim(),c=parseColor(v);
      if(c){cpRGBA=c;cpSync('hex');} else hx.classList.toggle('bad',v!=='');});
    if(rg) rg.addEventListener('input',function(){
      var v=rg.value.trim(),c=parseColor(v);
      if(c){cpRGBA=c;cpSync('rgb');} else rg.classList.toggle('bad',v!=='');});
    if(al) al.addEventListener('input',function(){
      cpRGBA.a=(+al.value)/100;cpSync('alpha');});
    var ap=$('#cp-apply'); if(ap) ap.addEventListener('click',cpApply);
    var swc=$('#sw-custom');
    if(swc){
      swc.addEventListener('mousedown',function(e){
        if(activeTextEditable()) e.preventDefault();});
      swc.addEventListener('click',function(){openColorPop('text',swc);});
    }
    var swbgc=$('#swbg-custom');
    if(swbgc) swbgc.addEventListener('click',function(){
      openColorPop('fill',swbgc);});
    document.addEventListener('mousedown',function(e){
      if(cpEl&&!cpEl.hidden&&!cpEl.contains(e.target)
         &&e.target!==swc&&e.target!==swbgc) cpEl.hidden=true;
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&cpEl&&!cpEl.hidden){e.stopPropagation();
        cpEl.hidden=true;}
    },true);
  })();
  var fontSelEl=$('#fmt-font');
  if(fontSelEl) fontSelEl.addEventListener('change',function(){
    var v=this.value;
    fmtApply(function(a){
      if(v==='sans') delete a.font; else a.font=v;
    });
  });
  onFmt('#fmt-bold',function(a){a.b=a.b?0:1;});
  onFmt('#fmt-ital',function(a){a.i=a.i?0:1;});
  onFmt('#fmt-under',function(a){a.u=a.u?0:1;});
  onFmt('#fmt-strike',function(a){a.strike=a.strike?0:1;});
  onFmt('#fmt-align',function(a){
    var order=['left','center','right','justify'];
    var ni=(order.indexOf(a.align||'left')+1)%order.length;
    if(order[ni]==='left') delete a.align; else a.align=order[ni];});
  onFmt('#fmt-list',function(a){a.list=a.list?0:1;});
  onFmt('#fmt-shape',function(a){
    /* cycle the selected shape through the whole set */
    var order=SHAPE_LIST.map(function(p){return p[0];});
    var ni=(order.indexOf(a.shape||'rect')+1)%order.length;
    if(order[ni]==='rect') delete a.shape; else a.shape=order[ni];});
  var opRangeEl=$('#fmt-op');
  if(opRangeEl) opRangeEl.addEventListener('input',function(){
    var pct=Math.max(0,Math.min(100,+this.value));
    fmtApply(function(a){
      if(pct>=100) delete a.op; else a.op=pct/100;});
  });
  var szInEl=$('#fmt-size');
  if(szInEl) szInEl.addEventListener('change',function(){
    var pt=+this.value;
    if(!(pt>0)) return;
    pt=Math.max(6,Math.min(240,pt));
    fmtApply(function(a){a.size=pt/5.4;});
  });
  onFmt('#fmt-rotl',function(a){
    a.rot=(((a.rot||0)-15)%360+360)%360;
    if(!a.rot) delete a.rot;});
  onFmt('#fmt-rotr',function(a){
    a.rot=(((a.rot||0)+15)%360+360)%360;
    if(!a.rot) delete a.rot;});
  function duplicateSel(){
    var s=pres.slides[cur];
    if(!s||typeof selAnnot!=='number'||!s.annots) return;
    var cp=JSON.parse(JSON.stringify(s.annots[selAnnot]));
    /* a copy is its own item: never silently join the source's group, and
       give it its own build step rather than sharing the source's */
    delete cp.grp;
    if(cp.anim) cp.anim={type:cp.anim.type,order:nextAnimOrder(s)};
    if(cp.k==='arrow'){
      cp.x1+=3;cp.y1+=3;cp.x2+=3;cp.y2+=3;
    } else {cp.x=(cp.x||0)+3;cp.y=(cp.y||0)+3;}
    s.annots.push(cp);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
  }
  /* nudge the selection with the arrow keys (Shift = bigger step) */
  function nudgeSel(dx,dy){
    var s=pres.slides[cur]; if(!s) return;
    if(selAnnot==='t'||selAnnot==='s'){
      var tp=titleProps(s,selAnnot);tp.x+=dx;tp.y+=dy;
    } else {
      var idxs=selSet.filter(function(i){return typeof i==='number';});
      if(!idxs.length&&typeof selAnnot==='number') idxs=[selAnnot];
      if(!idxs.length||!s.annots) return;
      idxs.forEach(function(i){
        var a=s.annots[i]; if(!a||a.lock) return;  /* locked: no nudge */
        if(a.k==='arrow'){a.x1+=dx;a.y1+=dy;a.x2+=dx;a.y2+=dy;}
        else {a.x=(a.x||0)+dx;a.y=(a.y||0)+dy;}
      });
    }
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
  }
  var dupBtn=$('#fmt-dup');
  if(dupBtn) dupBtn.addEventListener('click',duplicateSel);
  var grpBtn=$('#fmt-group');
  if(grpBtn) grpBtn.addEventListener('click',groupSel);
  var ungBtn=$('#fmt-ungroup');
  if(ungBtn) ungBtn.addEventListener('click',ungroupSel);
  function zMove(front){
    var s=pres.slides[cur];
    if(!s||typeof selAnnot!=='number'||!s.annots) return;
    var a=s.annots.splice(selAnnot,1)[0];
    var idx;
    if(front){s.annots.push(a);idx=s.annots.length-1;}
    else{s.annots.unshift(a);idx=0;}
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,idx);}
  }
  var frontBtn=$('#fmt-front');
  if(frontBtn) frontBtn.addEventListener('click',function(){
    zMove(true);});
  var backBtn=$('#fmt-back');
  if(backBtn) backBtn.addEventListener('click',function(){
    zMove(false);});
  /* ---- Row / Grid arrange + "Make same size" (multi-selection) ---- */
  function selRects(){
    /* the selected, laid-out items with their VISUAL rects (an aspect-
       fitted figure answers with the plot it shows, not its stored box) */
    var s=pres.slides[cur]; if(!s) return [];
    var l=stage.querySelector('.annot-layer'); if(!l) return [];
    return selSet.filter(function(i){return typeof i==='number';})
      .map(function(i){
        var a=(s.annots||[])[i];
        if(!a||a.k==='arrow'||a.lock||a.hide) return null;
        var r=annotRectPct(l,s,i);
        return r?{i:i,a:a,r:r,w:r.r-r.l,h:r.b-r.t}:null;
      }).filter(Boolean);
  }
  function selBBox(items){
    var bb={l:1e9,r:-1e9,t:1e9,b:-1e9};
    items.forEach(function(x){
      bb.l=Math.min(bb.l,x.r.l);bb.r=Math.max(bb.r,x.r.r);
      bb.t=Math.min(bb.t,x.r.t);bb.b=Math.max(bb.b,x.r.b);});
    return bb;
  }
  function placeAt(x,l2,t2){
    x.a.x=l2;x.a.y=t2;
    /* figure frames: pin the model to the visual box so the aspect fit
       re-renders the plot exactly in the slot we computed */
    if(x.a.k==='cell'){x.a.w=x.w;x.a.h=x.h;}
  }
  function rerenderSel(){
    markDirty();
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(l&&s){renderAnnots(l,s);paintSel(l);}
  }
  function arrangeRow(){
    var items=selRects(); if(items.length<2) return;
    var bb=selBBox(items);
    items.sort(function(p,q){return p.r.l-q.r.l;});
    var sum=0;items.forEach(function(x){sum+=x.w;});
    /* keep the selection's horizontal span; if the items cannot fit in
       it side by side, fall back to a small fixed gap */
    var gap=(bb.r-bb.l>=sum)
      ?((bb.r-bb.l-sum)/(items.length-1)):1.5;
    var cy=(bb.t+bb.b)/2,x0=bb.l;
    items.forEach(function(x){
      placeAt(x,x0,cy-x.h/2);x0+=x.w+gap;});
    rerenderSel();
  }
  function arrangeGrid(){
    var items=selRects(); if(items.length<2) return;
    var bb=selBBox(items);
    /* reading order: rows top-to-bottom, then left-to-right */
    items.sort(function(p,q){return (p.r.t-q.r.t)||(p.r.l-q.r.l);});
    var n=items.length;
    var cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols);
    var mw=0,mh=0;
    items.forEach(function(x){mw=Math.max(mw,x.w);mh=Math.max(mh,x.h);});
    /* grid cells at least as big as the largest item, growing past the
       current bounding box when the items started stacked */
    var cw=Math.max((bb.r-bb.l)/cols,mw+2);
    var ch=Math.max((bb.b-bb.t)/rows,mh+2);
    var ox=Math.max(0,Math.min(bb.l,100-cw*cols));
    var oy=Math.max(0,Math.min(bb.t,100-ch*rows));
    items.forEach(function(x,k){
      placeAt(x,
        ox+(k%cols)*cw+(cw-x.w)/2,
        oy+Math.floor(k/cols)*ch+(ch-x.h)/2);
    });
    rerenderSel();
  }
  function sameSize(mode){
    var items=selRects(); if(items.length<2) return;
    var nums=selSet.filter(function(i){return typeof i==='number';});
    var ref=null;
    if(mode==='first'||mode==='last'){
      var want=(mode==='first')?nums[0]:nums[nums.length-1];
      ref=items.filter(function(x){return x.i===want;})[0];
    } else {
      items.forEach(function(x){
        if(!ref||(mode==='smallest'
          ?x.w*x.h<ref.w*ref.h:x.w*x.h>ref.w*ref.h)) ref=x;});
    }
    if(!ref) ref=items[items.length-1];  /* the reference was an arrow */
    items.forEach(function(x){
      if(x===ref) return;
      if(x.a.k==='cell'){x.a.x=x.r.l;x.a.y=x.r.t;}
      x.a.w=ref.w;
      if(x.a.k!=='text') x.a.h=ref.h;
    });
    toast('Same size: matched the '+
      (mode==='first'?'first selected':mode==='last'?'last selected'
       :mode)+' item');
    rerenderSel();
  }
  var arRowBtn=$('#fmt-arline');
  if(arRowBtn) arRowBtn.addEventListener('click',arrangeRow);
  var arGridBtn=$('#fmt-argrid');
  if(arGridBtn) arGridBtn.addEventListener('click',arrangeGrid);
  wireFloatDropdown('fmt-samewrap','fmt-same','fmt-same-menu',
    [['last','Match LAST selected'],
     ['first','Match FIRST selected'],
     ['largest','Match the largest'],
     ['smallest','Match the smallest']],'same',
    function(mode){sameSize(mode);});
  var repBtn=$('#fmt-replace');
  if(repBtn) repBtn.addEventListener('click',function(){
    if(typeof selAnnot==='number') startPick(selAnnot);
  });
  /* Previous figure <-> Live figure: rescue ONE frame after a notebook
     re-run broke its plot, without giving up the other frames' updates */
  var revBtn=$('#fmt-revert');
  if(revBtn) revBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    if(frozenFrames.has(a)){
      frozenFrames.delete(a);
      toast('Back to the live figure');
    } else {
      var prev=frameSnapsPrev[normRef(a.ref)];
      if(!prev){toast('No pre-refresh figure for this frame yet');return;}
      frozenFrames.set(a,prev);
      toast('Showing the figure from before the refresh');
    }
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
    showFmt();
  });
  /* Lock figure <-> Unlock: pin a frame to its notebook's current git
     commit — refreshes stop touching it (and it renders even when the
     notebook is closed) */
  function lockFrame(a){
    var pr=splitRef(normRef(a.ref)||String(a.ref||''));
    var path=pr[0]?nbPathFor(pr[0]):null;
    if(!path||/^https?:/i.test(path)){
      toast('Locking needs a local notebook file');
      return Promise.resolve(false);
    }
    var sh=APP.shells[pr[0]];
    if(sh&&sh.version&&/^git:/.test(sh.version)){
      a.lockver={commit:sh.version.slice(4)};
      toast('Locked to '+a.lockver.commit+' (the version being viewed)');
      return Promise.resolve(true);
    }
    return APP.api('/api/gitstate',{path:path}).then(function(g){
      if(!g||!g.repo||!g.commit){
        toast('Not in a git repository — commit the notebook first');
        return false;
      }
      a.lockver={commit:g.commit.id,msg:g.commit.msg||'',
        date:g.commit.date||''};
      toast('Locked to '+g.commit.id
        +(g.commit.msg?' “'+g.commit.msg+'”':''));
      return true;
    }).catch(function(e){
      toast('Lock failed: '+((e&&e.message)||e));
      return false;
    });
  }
  var lockVBtn=$('#fmt-lockver');
  if(lockVBtn) lockVBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    function done(){
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s);paintSel(l);}
      showFmt();
    }
    if(a.lockver){
      delete a.lockver;
      toast('Unlocked — this figure follows notebook refreshes again');
      done();
      return;
    }
    lockFrame(a).then(function(ok){if(ok) done();});
  });
  /* Locate in notebook: leave the deck and land on the card this frame
     was placed from — its home in the notebook, scrolled to + flashed */
  var locBtn=$('#fmt-locate');
  if(locBtn) locBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    var it=resolveRef(a.ref);
    var card=cardEl(a.ref);
    if(!it||!card){toast("That card's notebook is not open");return;}
    closeDeck();
    if(APP.activate) APP.activate(it.nb);
    setTimeout(function(){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},1400);
    },60);
  });
  var pickCancel=$('#pick-cancel');
  if(pickCancel) pickCancel.addEventListener('click',function(){
    endPick();
  });
  /* ---- add an image: read the file as a data URI, embed + place it ---- */
  function placeImage(src,ar){
    var s=pres.slides[cur]; if(!s) return;
    var l=stage.querySelector('.annot-layer');
    var lr=l?l.getBoundingClientRect():null;
    var w=40,h=32;
    if(ar&&lr&&lr.height){h=w*(lr.width/lr.height)*ar;}
    h=Math.max(8,Math.min(86,h));
    s.annots=s.annots||[];
    s.annots.push({k:'image',x:Math.max(2,50-w/2),
      y:Math.max(2,50-h/2),w:w,h:h,src:src});
    markDirty();
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
  }
  var etImage=$('#et-image'),imgFile=$('#img-file');
  if(etImage&&imgFile) etImage.addEventListener('click',function(){
    imgFile.value='';imgFile.click();});
  if(imgFile) imgFile.addEventListener('change',function(){
    var f=this.files&&this.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){
      var src=rd.result;
      var probe=new Image();
      probe.onload=function(){
        placeImage(src,(probe.naturalHeight||3)/(probe.naturalWidth||4));};
      probe.onerror=function(){placeImage(src,0);};
      probe.src=src;
    };
    rd.readAsDataURL(f);
  });
  /* the format bar scrolls horizontally (overflow), which would CLIP a normal
     absolute dropdown — so the Crop / Animate menus float with position:fixed,
     positioned under their button each time they open */
  function floatMenu(btn,menu){
    menu.style.position='fixed';
    menu.style.zIndex='240';
    var r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    var mw=menu.offsetWidth||170;
    menu.style.left=Math.max(8,
      Math.min(r.left,window.innerWidth-mw-8))+'px';
    menu.style.right='auto';menu.style.bottom='auto';
  }
  function wireFloatDropdown(wrapId,btnId,menuId,opts,attr,onPick,iconFn){
    var wrap=$('#'+wrapId),btn=$('#'+btnId),menu=$('#'+menuId);
    if(!wrap||!btn||!menu) return;
    opts.forEach(function(p){
      var o=document.createElement('button');
      o.className='sh-opt';o.setAttribute('data-'+attr,p[0]);o.title=p[1];
      if(iconFn){
        var ic=iconFn(p[0]); if(ic) o.appendChild(ic);
        var lbl=document.createElement('span');
        lbl.className='sh-opt-t';lbl.textContent=p[1];o.appendChild(lbl);
      } else o.textContent=p[1];
      o.addEventListener('click',function(e){
        e.stopPropagation();onPick(p[0]);
        menu.hidden=true;btn.setAttribute('aria-expanded','false');
      });
      menu.appendChild(o);
    });
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=menu.hidden;
      menu.hidden=!willOpen;
      btn.setAttribute('aria-expanded',willOpen.toString());
      if(willOpen) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    });
  }
  /* ---- crop-to-shape dropdown (images + notebook cells) ---- */
  wireFloatDropdown('fmt-cropwrap','fmt-crop','fmt-crop-menu',
    CROP_SHAPES,'shape',function(shape){
      fmtApply(function(a){
        a.crop=a.crop||{};
        if(shape==='rect'){
          delete a.crop.shape;
          if(!(a.crop.t||a.crop.r||a.crop.b||a.crop.l)) delete a.crop;
        } else a.crop.shape=shape;
      });
    },cropIcon);
  /* ---- animation PANE: effect + build order. Items on the same build appear
     TOGETHER; each build is one click in playback. ---- */
  (function(){
    var wrap=$('#fmt-animwrap'),btn=$('#fmt-anim'),menu=$('#fmt-anim-menu');
    if(!wrap||!btn||!menu) return;
    menu.classList.add('anim-pane');
    function rerender(){
      var s=pres.slides[cur],l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s);paintSel(l);}
    }
    function renumber(s){animSeq(s).forEach(function(st,i){
      st.items.forEach(function(idx){s.annots[idx].anim.order=i;});});}
    function stepOf(s,idx){var r=-1;animSeq(s).forEach(function(st,i){
      if(st.items.indexOf(idx)>=0) r=i;});return r;}
    function commit(s){markDirty();rerender();render();}
    function setType(type){
      var s=pres.slides[cur]; if(!s) return;
      var idxs=selSet.filter(function(i){return typeof i==='number';});
      if(!idxs.length&&typeof selAnnot==='number') idxs=[selAnnot];
      var no=nextAnimOrder(s);            /* new anims share one build step */
      idxs.forEach(function(i){var a=s.annots[i]; if(!a) return;
        if(type==='none') delete a.anim;
        else if(a.anim) a.anim.type=type;
        else a.anim={type:type,order:no};});
      commit(s);
    }
    function mergeUp(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      if(!a||!a.anim) return;var q=animSeq(s),si=stepOf(s,selAnnot);
      if(si>0){a.anim.order=q[si-1].order;renumber(s);commit(s);}
    }
    function splitOwn(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      if(!a||!a.anim) return;
      a.anim.order=(a.anim.order||0)+0.5;renumber(s);commit(s);
    }
    function moveStep(si,dir){
      var s=pres.slides[cur],q=animSeq(s),tj=si+dir;
      if(tj<0||tj>=q.length) return;
      var oa=q[si].order,ob=q[tj].order;
      q[si].items.forEach(function(i){s.annots[i].anim.order=ob;});
      q[tj].items.forEach(function(i){s.annots[i].anim.order=oa;});
      renumber(s);commit(s);
    }
    function render(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      menu.innerHTML='';
      var h1=document.createElement('div');h1.className='anim-h';
      h1.textContent='How it appears';menu.appendChild(h1);
      if(!a||typeof selAnnot!=='number'){
        var em=document.createElement('div');em.className='anim-empty';
        em.textContent='Select an item first, then pick an effect.';
        menu.appendChild(em);
      } else {
        var eff=document.createElement('div');eff.className='anim-eff';
        [['none','None'],['appear','Appear'],['fade','Fade'],
         ['rise','Rise'],['zoom','Zoom']].forEach(function(p){
          var b=document.createElement('button');b.className='anim-effb';
          b.textContent=p[1];
          if((a.anim?a.anim.type:'none')===p[0]) b.classList.add('on');
          b.addEventListener('click',function(e){e.stopPropagation();
            setType(p[0]);});
          eff.appendChild(b);});
        menu.appendChild(eff);
        if(a.anim){
          var si0=stepOf(s,selAnnot),q0=animSeq(s);
          var mrow=document.createElement('div');mrow.className='anim-merge';
          var mb=document.createElement('button');mb.className='anim-mini wide';
          mb.textContent='↑ Appear with previous';mb.disabled=(si0<=0);
          mb.title='Reveal this on the same click as the build above';
          mb.addEventListener('click',function(e){e.stopPropagation();
            mergeUp();});
          mrow.appendChild(mb);
          if(q0[si0]&&q0[si0].items.length>1){
            var sb=document.createElement('button');sb.className='anim-mini wide';
            sb.textContent='↓ Own click';
            sb.addEventListener('click',function(e){e.stopPropagation();
              splitOwn();});
            mrow.appendChild(sb);
          }
          menu.appendChild(mrow);
        }
      }
      var h2=document.createElement('div');h2.className='anim-h';
      h2.textContent='Build order — each row is one click';
      menu.appendChild(h2);
      var seq=animSeq(s);
      if(!seq.length){
        var e2=document.createElement('div');e2.className='anim-empty';
        e2.textContent='Nothing animated on this slide yet.';
        menu.appendChild(e2);
      } else {
        var list=document.createElement('div');list.className='anim-seq';
        seq.forEach(function(st,si){
          var row=document.createElement('div');row.className='anim-step';
          var n=document.createElement('span');n.className='anim-num';
          n.textContent=(si+1);row.appendChild(n);
          var chips=document.createElement('span');chips.className='anim-chips';
          st.items.forEach(function(idx){
            var c=document.createElement('span');
            c.className='anim-chip'+(idx===selAnnot?' cur':'');
            c.textContent=itemLabel(s,idx)+' · '
              +((s.annots[idx].anim.type)||'fade');
            c.addEventListener('click',function(e){e.stopPropagation();
              var l=stage.querySelector('.annot-layer');
              if(l) selectAnnot(l,idx); render();});
            chips.appendChild(c);});
          row.appendChild(chips);
          var ctr=document.createElement('span');ctr.className='anim-stepctr';
          [['↑',-1],['↓',1]].forEach(function(m){
            var b=document.createElement('button');b.className='anim-mini';
            b.textContent=m[0];
            b.disabled=(m[1]<0?si===0:si===seq.length-1);
            b.addEventListener('click',function(e){e.stopPropagation();
              moveStep(si,m[1]);});
            ctr.appendChild(b);});
          row.appendChild(ctr);
          list.appendChild(row);});
        menu.appendChild(list);
      }
    }
    btn.addEventListener('click',function(e){e.stopPropagation();
      var willOpen=menu.hidden;menu.hidden=!willOpen;
      btn.setAttribute('aria-expanded',willOpen.toString());
      if(willOpen){render();floatMenu(btn,menu);}});
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}});
  })();
  window.addEventListener('resize',function(){
    if(deckEl.hidden) return;
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(s&&l) renderAnnots(l,s);
  });
  function buildsForSlide(i){
    var s=pres.slides[i];return s?slideBuildSteps(s).count:0;
  }
  function go(n){
    var prev=cur;
    cur=Math.max(0,Math.min(pres.slides.length-1,n));
    if(cur===prev) return;   /* clamped no-op: keep build + selection state */
    /* stepping back into a slide shows it fully built; forward starts fresh */
    revealCount=(mode==='view'&&cur<prev)?buildsForSlide(cur):0;
    selAnnot=null;selSet=[];   /* never carry a selection across slides */
    refresh();
    if(window.SemApp&&window.SemApp.updateHash) window.SemApp.updateHash();
  }
  /* advance: reveal the next build, else move to the next slide (no-op at the
     very end, so the final slide never collapses back to its pre-build state) */
  function advance(){
    var s=pres.slides[cur];
    if(mode==='view'&&s&&revealCount<slideBuildSteps(s).count){
      revealCount++;renderSlide();
    } else if(cur<pres.slides.length-1) go(cur+1);
  }
  function backStep(){
    if(mode==='view'&&revealCount>0){revealCount--;renderSlide();}
    else go(cur-1);
  }

  /* ---------- create mode: sidebar UI ---------- */
  /* ---------- presentations rail (vertical, left edge) ----------
     One item is active at any time: the "Notebooks" button (builder
     closed) or a presentation (builder open editing it). */
  var presstrip=document.getElementById('presstrip');
  var FOLDKEY='sempresfold:'+SCOPE;
  var FOLDERSKEY='sempresfolders:'+SCOPE;
  function foldState(){
    try{return JSON.parse(lsGet(FOLDKEY)||'{}');}catch(e){return {};}
  }
  function toggleFold(f){
    var s=foldState();
    if(s[f]) delete s[f]; else s[f]=1;
    lsSet(FOLDKEY,JSON.stringify(s));
    renderPresTabs();
  }
  /* folders exist on their own (created empty, dragged into) */
  function explicitFolders(){
    try{
      var l=JSON.parse(lsGet(FOLDERSKEY)||'[]');
      return Array.isArray(l)?l:[];
    }catch(e){return [];}
  }
  function saveFolders(list){lsSet(FOLDERSKEY,JSON.stringify(list));}
  /* move ANY presentation (current, saved, draft, embedded) */
  function setPresFolder(nm,folder){
    var f=(folder||'').trim();
    function apply(p){
      if(f) p.folder=f; else delete p.folder;
    }
    if(nm===pres.name){apply(pres);markDirty();renderPresRow();return;}
    var hit=false;
    projectPres.forEach(function(p){
      if(p.name===nm){apply(p);hit=true;}});
    nbPres.forEach(function(p){
      if(p.name===nm){apply(p);hit=true;}});
    var raw=lsGet(PFX+nm);
    if(raw){
      try{
        var d=JSON.parse(raw);apply(d);
        lsSet(PFX+nm,JSON.stringify(d));hit=true;
      }catch(e){}
    }
    if(hit&&APP.mode==='app') scheduleAutosave();
    renderPresTabs();
  }
  function newFolder(){
    var list=explicitFolders();
    var n=1,name='folder';
    function taken(x){
      return list.indexOf(x)>=0
        ||allSaved().some(function(p){return p.folder===x;});
    }
    while(taken(name)){n++;name='folder-'+n;}
    list.push(name);saveFolders(list);
    renderPresTabs();
    var h=presstrip.querySelector(
      '.pr-folder[data-folder="'+name+'"]');
    if(h) startFolderRename(h,name);
  }
  function renameFolder(oldName,newName){
    newName=(newName||'').trim();
    if(!newName||newName===oldName) return;
    var list=explicitFolders().map(function(x){
      return x===oldName?newName:x;});
    if(list.indexOf(newName)<0) list.push(newName);
    saveFolders(list.filter(function(x,i){
      return list.indexOf(x)===i;}));
    var st=foldState();
    if(st[oldName]){delete st[oldName];st[newName]=1;
      lsSet(FOLDKEY,JSON.stringify(st));}
    allSaved().concat([pres]).forEach(function(p){
      if(p.folder===oldName) setPresFolder(p.name,newName);
    });
    draftNames().forEach(function(nm){
      var d=loadDraft(nm);
      if(d&&d.folder===oldName) setPresFolder(nm,newName);
    });
    renderPresTabs();
  }
  function deleteFolder(f){
    saveFolders(explicitFolders().filter(function(x){return x!==f;}));
    allSaved().concat([pres]).forEach(function(p){
      if(p.folder===f) setPresFolder(p.name,'');
    });
    draftNames().forEach(function(nm){
      var d=loadDraft(nm);
      if(d&&d.folder===f) setPresFolder(nm,'');
    });
    renderPresTabs();
  }
  function startFolderRename(header,f){
    var t=header.querySelector('.pr-t');
    if(!t) return;
    var inp=document.createElement('input');
    inp.className='pr-frename';
    inp.value=f;inp.spellcheck=false;
    t.replaceWith(inp);
    inp.focus();inp.select();
    function commit(){
      var v=inp.value.trim();
      if(v&&v!==f) renameFolder(f,v);
      else renderPresTabs();
    }
    inp.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Enter') this.blur();
      if(e.key==='Escape'){this.value=f;this.blur();}
    });
    inp.addEventListener('blur',commit);
    inp.addEventListener('click',function(e){e.stopPropagation();});
  }
  function renderPresTabs(){
    if(!presstrip) return;
    presstrip.innerHTML='';
    var savedList=allSaved();
    var savedNames=savedList.map(function(p){return p.name;});
    var byName={};
    savedList.forEach(function(p){byName[p.name]=p;});
    var names=savedNames.slice();
    /* drafts stay listed even while another presentation is open */
    draftNames().forEach(function(n){
      if(names.indexOf(n)<0){
        names.push(n);
        byName[n]=loadDraft(n)||{name:n};
      }
    });
    if(names.indexOf(pres.name)<0) names.unshift(pres.name);
    byName[pres.name]=pres;   /* in-memory version wins (live folder) */
    var editing=!deckEl.hidden;

    function presItem(nm,folder){
      var isCur=nm===pres.name;
      var t=document.createElement('button');
      /* radio model: a row lights up ONLY while its deck is open — back on
         the notebook view, no presentation stays highlighted */
      t.className='pr-item ptab'+(isCur&&editing?' current editing':'')
        +(savedNames.indexOf(nm)<0?' draftonly':'');
      t.setAttribute('role','tab');
      t.dataset.pres=nm;
      t.dataset.folder=folder||'';
      var isPoster=/^a\d/.test(String((byName[nm]&&byName[nm].page)||''));
      var isView=isViewPres(byName[nm]);
      /* a custom view lights up while ITS styling bar is open, not while
         the slide stage is (it never opens the slide stage) */
      var vwOpen=isView&&isCur
        &&document.body.classList.contains('styling');
      if(vwOpen) t.className+=' current editing';
      var kindWord=isView?'custom view':isPoster?'poster':'presentation';
      t.title=((isCur&&(editing||vwOpen))
        ?('Editing "'+nm+'" — click Notebooks (top left) to go back')
        :('Open '+kindWord+' "'+nm+'"'
          +(isView?' — restyles the notebook itself':' in the builder')))
        +'\nDrag onto a folder to file it';
      /* the same drawn icons as the "+ New ..." buttons, so a row and the
         button that made it read as the same kind of thing */
      t.innerHTML='<span class="pr-ico">'
        +'<svg class="bic" viewBox="0 0 16 16" aria-hidden="true">'
        +(isView?RAIL_ICO.view:isPoster?RAIL_ICO.poster:RAIL_ICO.deck)
        +'</svg></span>';
      var lbl=document.createElement('span');lbl.className='pr-t';
      lbl.textContent=nm||'(unnamed)';
      t.appendChild(lbl);
      t.draggable=true;
      t.addEventListener('dragstart',function(e){
        draggingPres=nm;
        t.classList.add('dragging');
        try{e.dataTransfer.setData('text/plain',nm);}catch(err){}
        e.dataTransfer.effectAllowed='move';
      });
      t.addEventListener('dragend',function(){
        draggingPres=null;
        t.classList.remove('dragging');
        clearDropMarks();
      });
      t.addEventListener('click',function(){
        if(isCur&&!deckEl.hidden) return;
        if(vwOpen) return;            /* already the open custom view */
        choosePresentation(nm);
      });
      return t;
    }

    /* group by folder; loose items first, then collapsible folders
       (explicitly created folders show even while empty) */
    var rootNames=[],folders={},folderOrder=[];
    explicitFolders().forEach(function(f){
      folders[f]=[];folderOrder.push(f);
    });
    names.forEach(function(nm){
      var f=(byName[nm]&&byName[nm].folder)||'';
      if(!f){rootNames.push(nm);return;}
      if(!folders[f]){folders[f]=[];folderOrder.push(f);}
      folders[f].push(nm);
    });
    rootNames.forEach(function(nm){
      presstrip.appendChild(presItem(nm,''));});
    folderOrder.sort().forEach(function(f){
      var collapsed=!!foldState()[f]
        &&!(editing&&folders[f].indexOf(pres.name)>=0);
      var h=document.createElement('div');
      h.className='pr-folder';
      h.dataset.folder=f;
      h.title='Folder "'+f+'" — click to '
        +(collapsed?'expand':'collapse')
        +'; drag presentations onto it';
      h.innerHTML='<span class="pr-fchev">'
        +(collapsed?'&#9656;':'&#9662;')+'</span>'
        +'<span class="pr-fico"><svg viewBox="0 0 16 14" width="13" '
        +'height="12" fill="currentColor"><path d="M1 3.2C1 2.5 1.5 2 '
        +'2.2 2h3.4l1.5 1.6h6.7c.7 0 1.2.5 1.2 1.2v6c0 .7-.5 1.2-1.2 '
        +'1.2H2.2C1.5 12 1 11.5 1 10.8z"/></svg></span>';
      var ft=document.createElement('span');ft.className='pr-t';
      ft.textContent=f;h.appendChild(ft);
      var fc=document.createElement('span');fc.className='pr-fcount';
      fc.textContent=folders[f].length;h.appendChild(fc);
      var ctr=document.createElement('span');ctr.className='pr-fctrl';
      [['✎','Rename folder',function(){startFolderRename(h,f);}],
       ['✕','Delete folder (contents move out)',
        function(){deleteFolder(f);}]].forEach(function(b){
        var btn=document.createElement('button');
        btn.textContent=b[0];btn.title=b[1];
        btn.addEventListener('click',function(e){
          e.stopPropagation();b[2]();});
        ctr.appendChild(btn);
      });
      h.appendChild(ctr);
      h.addEventListener('click',function(){toggleFold(f);});
      presstrip.appendChild(h);
      if(!collapsed) folders[f].forEach(function(nm){
        var it=presItem(nm,f);
        it.classList.add('infolder');
        presstrip.appendChild(it);
      });
    });
    var docsBtn=document.getElementById('pr-docs');
    if(docsBtn) docsBtn.classList.toggle('current',!editing);
  }
  /* drag & drop filing: onto a folder header (or an item inside one)
     files it; onto empty rail space moves it back to the top level */
  var draggingPres=null;
  function clearDropMarks(){
    $$('.pr-folder.dropping',presstrip).forEach(function(el){
      el.classList.remove('dropping');});
    var rail=document.getElementById('presrail');
    if(rail) rail.classList.remove('dropping-root');
  }
  (function(){
    var rail=document.getElementById('presrail');
    if(!rail) return;
    rail.addEventListener('dragover',function(e){
      if(!draggingPres) return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      clearDropMarks();
      var h=e.target.closest&&e.target.closest('.pr-folder');
      if(!h){
        var it=e.target.closest&&e.target.closest('.pr-item.ptab');
        if(it&&it.dataset.folder)
          h=presstrip.querySelector(
            '.pr-folder[data-folder="'+it.dataset.folder+'"]');
      }
      if(h) h.classList.add('dropping');
      else rail.classList.add('dropping-root');
    });
    rail.addEventListener('dragleave',function(e){
      if(e.target===rail) clearDropMarks();
    });
    rail.addEventListener('drop',function(e){
      if(!draggingPres) return;
      e.preventDefault();
      var f='';
      var h=e.target.closest&&e.target.closest('.pr-folder');
      if(h) f=h.dataset.folder;
      else{
        var it=e.target.closest&&e.target.closest('.pr-item.ptab');
        if(it) f=it.dataset.folder||'';
      }
      var nm=draggingPres;
      draggingPres=null;
      clearDropMarks();
      setPresFolder(nm,f);
    });
  })();
  var newFoldBtn=document.getElementById('pr-newfold');
  if(newFoldBtn) newFoldBtn.addEventListener('click',newFolder);
  function choosePresentation(nm){
    var A=window.SemApp||{};
    if(nm!==pres.name){
      if(A.exitStyling) A.exitStyling();   /* leave any open custom view */
      lsSet(PFX+'last',nm);
      loadPresentation(nm);
      cur=0;activePane=-1;
    }
    /* a custom view is edited in the document; a deck on the slide stage */
    if(isViewPres(pres)){openCustomView();return;}
    openDeck('edit');   /* land straight in the slide editor */
  }
  function newPresentation(){
    var n2=1,name='presentation';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='presentation-'+n2;}
    /* deliberately NOT persisted yet: a new presentation only starts
       saving (draft + autosave) once you actually edit it, so clicking
       "New" never litters the project with empty decks */
    pres={name:name,slides:[emptySlide()]};
    source='auto';
    cur=0;activePane=0;
    openDeck('edit');   /* land straight in the slide editor */
  }
  /* ---- CUSTOM VIEW: a third kind of saved thing (2026-07-29) ---------
     Not slides. A custom view remembers how the NOTEBOOK looks: the
     styling of its markdown cells and headings, plus the whole filter /
     hidden-cell / figure-size state. It opens in the document, not on the
     slide stage, so the styling bar edits what you are looking at. ---- */
  function isViewPres(p){return !!(p&&p.kind==='view');}
  /* rail row icons — the same artwork the "+ New ..." buttons carry */
  var RAIL_ICO={
    deck:'<rect x="1.6" y="3.2" width="9.6" height="7.2" rx="1"/>'
      +'<path d="M3.6 12.8h5.6"/>',
    poster:'<rect x="2.4" y="1.8" width="7.6" height="12.4" rx="1"/>'
      +'<path d="M4.2 5h4M4.2 7.4h4M4.2 9.8h2.4"/>',
    view:'<path d="M2.4 2.6h5.8l2.6 2.6v8.2H2.4Z"/>'
      +'<path d="M4.6 8.4h4M4.6 10.8h2.6"/>'
      +'<path d="M13.9 2.4 15.4 3.9 12 7.3h-1.5V5.8Z"/>'};
  function newCustomView(){
    var A=window.SemApp||{};
    var stem=A.active;
    if(!stem||!A.enterStyling){
      toast('Open a notebook first — a custom view restyles a notebook');
      return;
    }
    var n2=1,name='custom view';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='custom view '+n2;}
    /* seeded from what you are looking at right now, so a new view never
       throws away the filters you already set up */
    pres={name:name,kind:'view',nb:stem,style:{},
          view:(A.layoutSnapshot&&A.layoutSnapshot(stem))||{}};
    source='auto';
    cur=0;activePane=-1;
    openCustomView();
  }
  function openCustomView(){
    var A=window.SemApp||{};
    closeDeck();                     /* the document, not the slide stage */
    if(pres.nb&&A.shells&&A.shells[pres.nb]&&A.activate)
      A.activate(pres.nb);
    if(pres.view&&A.applySnapshot)
      A.applySnapshot(pres.nb||A.active,pres.view);
    A.enterStyling(pres,function(){markDirty();});
    renderPresTabs();
    status();
  }
  function closeCustomView(){
    var A=window.SemApp||{};
    if(A.exitStyling) A.exitStyling();
    renderPresTabs();
  }
  window.SemApp.viewClose=closeCustomView;
  function newPoster(){
    var n2=1,name='poster';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='poster-'+n2;}
    /* like a new presentation, nothing persists until the first edit */
    var s=emptySlide();
    pres={name:name,slides:[s],page:'a0p'};
    applyLayout(s,LAYOUTBYID['poster-3col']||LAYOUTS[0]);
    source='auto';
    cur=0;activePane=-1;
    openDeck('edit');
  }

  function renderPresRow(){
    var lbl=$('#pres-current');
    if(lbl) lbl.textContent=pres.name||'(unnamed)';
    var inp=$('#pres-name');
    if(document.activeElement!==inp&&inp.value!==pres.name)
      inp.value=pres.name;
    renderPresTabs();
  }
  function renderControls(){
    updateNumsLabel();
    var s=pres.slides[cur];
    $$('#layout-row .lay,#layout-menu-grid .lay').forEach(function(b){
      /* highlight the template last applied to this slide (if any) */
      b.setAttribute('aria-pressed',
        (!!s&&s.lay===b.dataset.lay).toString());
      b.disabled=!s;
    });
    var te=$('#title-editor'), eb=$('#dc-edit');
    var isTitle=!!s&&s.layout==='title';
    if(te){
      te.hidden=!isTitle;
      if(isTitle){
        var ti=$('#ts-title'),su=$('#ts-sub');
        if(ti&&document.activeElement!==ti) ti.value=s.title||'';
        if(su&&document.activeElement!==su) su.value=s.sub||'';
      }
    }
    if(eb){
      eb.disabled=!s;
      eb.innerHTML=(mode==='edit')
        ?'&#9636; Swap to notebooks':'&#9998; Swap to edit view';
    }
  }
  /* the current slide's interactive frame editor — embedded inline as
     the big view in the merged slides list (one view, not two) */
  function buildSlideEditor(s){
    var ed=document.createElement('div');
    ed.className='pane-editor freeform';ed.id='pane-editor';
    if(!s){
      ed.innerHTML='<div class="pane empty">'
        +'<span class="pane-t">no slide</span></div>';
      return ed;
    }
    var cells=slideCells(s);
    if(!cells.length){
      ed.innerHTML='<div class="pane empty"><span class="pane-t">'
        +'pick a layout above, or click a card in the document'
        +'</span></div>';
      return ed;
    }
    cells.forEach(function(pair){
      var a=pair.a, ai=pair.i;
      var it=a.ref?resolveRef(a.ref):null;
      var p=document.createElement('div');
      p.className='pane slot'+(it?' filled':' empty')
        +(ai===activePane?' active':'');
      p.style.left=a.x+'%';p.style.top=a.y+'%';
      p.style.width=(a.w||10)+'%';p.style.height=(a.h||10)+'%';
      if(it){
        /* render the frame EXACTLY as it appears on the slide: the real
           card content for the chosen part (code / figure / output) */
        var frame=document.createElement('div');frame.className='an-cell';
        var ch=document.createElement('div');ch.className='an-cellhead';
        var chT=document.createElement('span');
        chT.className='an-cellhead-t';chT.textContent=it.title;
        ch.appendChild(chT);
        var pt0=partOf(a),facs0=facetList(it.ns);
        if(facs0.length>1||pt0==='code'){
          var pl=document.createElement('span');
          pl.className='an-cellpart';pl.textContent=pt0;
          ch.appendChild(pl);
        }
        if(multiNb()) ch.appendChild(nbChip('spane-nb',it.nb));
        frame.appendChild(ch);
        var b=framePart(it.ns,a.part);
        if(b){if(a.ts) b.style.zoom=a.ts;applyCrop(b,a);frame.appendChild(b);}
        applyCellColor(frame,a);
        p.title=it.nb+' — '+it.title;
        p.appendChild(frame);
        var pc=buildPartChooser(s,ai);
        if(pc) p.appendChild(pc);
      } else {
        var t=document.createElement('span');t.className='pane-t';
        t.textContent=a.ref?('missing: '+a.ref)
          :(ai===activePane?'▸ now click a card in the notebook'
            :'empty — click to select this frame');
        p.appendChild(t);
      }
      if(a.ref){
        var x=document.createElement('button');x.className='pane-x';
        x.textContent='✕';x.title='Clear this frame';
        x.addEventListener('click',function(e){e.stopPropagation();
          a.ref=null;activePane=ai;markDirty();refresh();});
        p.appendChild(x);
      }
      p.addEventListener('click',function(e){
        e.stopPropagation();activePane=ai;refresh();});
      ed.appendChild(p);
    });
    return ed;
  }
  function paneImgSrc(ref){
    var card=ref?cardEl(ref):null;
    var img=card?$('.figframe img',card):null;
    return img?img.getAttribute('src'):null;
  }
  function paneThumb(ref){
    var w=document.createElement('span');w.className='mini-pane';
    var it=ref?resolveRef(ref):null;
    if(!it){w.className+=' empty';return w;}
    var src=paneImgSrc(ref);
    if(src){
      var m=document.createElement('img');
      m.src=src;m.alt='';m.loading='lazy';
      w.appendChild(m);
    } else if(it.kind==='note'){
      w.className+=' is-note';
    } else if(it.kind==='figure'||it.kind==='diagnostic'){
      w.className+=' is-fig';
    } else {
      w.className+=' is-code';
      w.textContent='</>';
    }
    return w;
  }
  function miniDiagram(s){
    var d=document.createElement('span');
    d.className='mini-diagram free';
    if(s.layout==='title'){
      var w=document.createElement('span');
      w.className='mini-pane is-title';
      d.appendChild(w);
      return d;
    }
    var cells=slideCells(s);
    if(!cells.length){
      var e=document.createElement('span');
      e.className='mini-pane empty';
      d.appendChild(e);
      return d;
    }
    cells.forEach(function(pair){
      var a=pair.a;
      var w2=paneThumb(a.ref);
      w2.style.position='absolute';
      w2.style.left=a.x+'%';w2.style.top=a.y+'%';
      w2.style.width=(a.w||10)+'%';w2.style.height=(a.h||10)+'%';
      d.appendChild(w2);
    });
    return d;
  }
  function slideTitle(s){
    if(s.layout==='title') return s.title||'title slide';
    var cells=slideCells(s);
    for(var i=0;i<cells.length;i++){
      var it=cells[i].a.ref&&resolveRef(cells[i].a.ref);
      if(it) return it.title;
    }
    var tx=(s.annots||[]).filter(function(a){
      return a.k==='text'&&a.text;})[0];
    return tx?tx.text:'empty slide';
  }
  var draggingSlide=-1;
  function renderFilm(){
    var list=$('#film-list');list.innerHTML='';
    pres.slides.forEach(function(s,i){
      var row=document.createElement('div');
      row.className='film-row'+(i===cur?' current':'');
      row.dataset.idx=i;
      row.draggable=true;
      row.title='Drag to reorder';
      row.addEventListener('dragstart',function(e){
        draggingSlide=i;
        row.classList.add('dragging');
        try{e.dataTransfer.setData('text/plain','slide-'+i);}
        catch(err){}
        e.dataTransfer.effectAllowed='move';
      });
      row.addEventListener('dragend',function(){
        draggingSlide=-1;
        row.classList.remove('dragging');
        clearFilmMarks();
      });
      var lbl=document.createElement('div');lbl.className='film-label';
      var num=document.createElement('span');num.className='film-n';
      num.textContent=(i+1);lbl.appendChild(num);
      if(i===cur&&mode==='create'&&s.layout!=='title'){
        /* notebook view: the current slide IS the big inline pane editor
           (paired with your visible notebook cells to fill it). In slide
           view the CANVAS is the single editor, so the strip stays thumbnails */
        var view=document.createElement('div');view.className='film-view';
        view.appendChild(buildSlideEditor(s));
        lbl.appendChild(view);
      } else {
        lbl.appendChild(miniDiagram(s));
      }
      var tt=document.createElement('span');tt.className='film-t';
      tt.textContent=slideTitle(s);lbl.appendChild(tt);
      if(i!==cur) lbl.addEventListener('click',function(){
        cur=i;activePane=-1;selAnnot=null;selSet=[];refresh();});
      row.appendChild(lbl);
      var ctr=document.createElement('span');ctr.className='film-ctr';
      [['↑',function(){moveSlide(i,-1);},'Move slide up'],
       ['↓',function(){moveSlide(i,1);},'Move slide down'],
       ['✕',function(){delSlide(i);},'Delete slide']]
        .forEach(function(p){
        var b=document.createElement('button');b.className='film-mini';
        b.textContent=p[0];
        b.title=p[2];
        b.addEventListener('click',function(ev){
          ev.stopPropagation();p[1]();});
        ctr.appendChild(b);
      });
      row.appendChild(ctr);
      list.appendChild(row);
    });
  }
  function clearFilmMarks(){
    $$('#film-list .film-row.drop-above,#film-list .film-row.drop-below')
      .forEach(function(r){
        r.classList.remove('drop-above');
        r.classList.remove('drop-below');
      });
  }
  (function(){
    var list=$('#film-list'); if(!list) return;
    list.addEventListener('dragover',function(e){
      if(draggingSlide<0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row');
      if(!row) return;
      var r=row.getBoundingClientRect();
      row.classList.add(
        e.clientY>r.top+r.height/2?'drop-below':'drop-above');
    });
    list.addEventListener('dragleave',function(e){
      if(e.target===list) clearFilmMarks();
    });
    list.addEventListener('drop',function(e){
      if(draggingSlide<0) return;
      e.preventDefault();
      var from=draggingSlide;
      draggingSlide=-1;
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row');
      if(!row) return;
      var to=+row.dataset.idx;
      var r=row.getBoundingClientRect();
      if(e.clientY>r.top+r.height/2) to++;
      if(to>from) to--;
      if(to===from) return;
      var moved=pres.slides.splice(from,1)[0];
      pres.slides.splice(to,0,moved);
      if(cur===from) cur=to;
      else if(from<cur&&to>=cur) cur--;
      else if(from>cur&&to<=cur) cur++;
      markDirty();refresh();
    });
  })();
  function presNbs(p){
    var set={},order=[];
    (p&&p.slides||[]).forEach(function(s){
      (s.annots||[]).forEach(function(a){
        if(a.k==='cell'&&a.ref){
          var stem=splitRef(a.ref)[0];
          if(stem&&!set[stem]){set[stem]=1;order.push(stem);}
        }
      });
    });
    return order;
  }
  function renderPresNbs(){
    var nbs=presNbs(pres);
    var btn=$('#dc-nbs-btn');
    if(btn){
      /* only meaningful when the deck pulls from named notebooks (namespaced
         refs) — a static single-file export has none */
      btn.hidden=!nbs.length;
      /* "Open notebooks" until at least one of the deck's notebooks is open,
         then "Refresh notebooks" (reload the latest cells from disk / URL) */
      var anyOpen=nbs.some(function(stem){
        return APP.order.indexOf(stem)>=0;});
      btn.textContent=(anyOpen?'📚 Refresh notebooks'
        :'📚 Open notebooks');
    }
  }
  /* ---- "notebooks in this presentation" popover: open all / refresh all ----
     stem -> path resolves from an open shell, else a recent path with the
     same filename (paths only exist in the app + web builds) */
  function pathStem(p){
    var s=String(p||''),parts=s.split(/[\/\\]/),nm=parts[parts.length-1]||s;
    nm=nm.split('?')[0].split('#')[0];
    try{nm=decodeURIComponent(nm);}catch(e){}
    return nm.replace(/\.ipynb$/i,'');
  }
  function nbPathFor(stem){
    var sh=APP.shells&&APP.shells[stem];
    if(sh&&sh.path) return sh.path;
    var rec=(APP.project&&APP.project.recent)||[];
    for(var i=0;i<rec.length;i++)
      if(pathStem(rec[i])===stem) return rec[i];
    return null;
  }
  /* a path is actually openable only if APP.openPath can act on it: any path
     in the app (the server resolves it), but ONLY http(s) URLs in the web
     build (relative recent entries like the bundled demo can't be re-fetched
     by openPath) */
  function nbOpenable(path){
    if(!path) return false;
    return APP.mode==='web'?/^https?:\/\//i.test(path):true;
  }
  function nbInfo(){
    return presNbs(pres).map(function(stem){
      var open=APP.order.indexOf(stem)>=0;
      var path=open?((APP.shells[stem]&&APP.shells[stem].path)||'')
        :nbPathFor(stem);
      return {stem:stem,open:open,path:path,openable:nbOpenable(path)};
    });
  }
  function nbsCanOpen(){return APP.mode==='app'||APP.mode==='web';}
  function openPresNbs(missingOnly){
    if(!nbsCanOpen()){toast('Opening notebooks needs the Junoview app');return;}
    var info=nbInfo(),acted=0,cannot=0;
    info.forEach(function(n){
      if(missingOnly&&n.open) return;
      if(n.openable){APP.openPath(n.path);acted++;} else cannot++;
    });
    var verb=missingOnly?'Opening ':'Reloading ';
    if(!acted&&!cannot)
      toast(missingOnly?'All notebooks are already open':'Nothing to reload');
    else if(!acted)
      toast('Could not '+(missingOnly?'open':'reload')+' those notebooks');
    else if(cannot)
      toast(verb+acted+'; '+cannot+' unavailable');
    else
      toast(verb+acted+' notebook'+(acted===1?'':'s')+'…');
    hideNbsMenu();
  }
  function hideNbsMenu(){
    var m=$('#dc-nbs-menu'); if(m) m.hidden=true;
    var b=$('#dc-nbs-btn'); if(b) b.setAttribute('aria-expanded','false');
  }
  /* ---- Lock all / Unlock all / prefetch locked versions ---- */
  function allCellAnnots(){
    var out=[];
    (pres.slides||[]).forEach(function(s){
      (s.annots||[]).forEach(function(a){
        if(a.k==='cell'&&a.ref) out.push(a);});});
    return out;
  }
  function lockAllFrames(){
    if(APP.mode!=='app'){toast('Locking needs the Junoview app');return;}
    var ann=allCellAnnots().filter(function(a){return !a.lockver;});
    if(!ann.length){toast('Every figure is already locked');return;}
    var byStem={};
    ann.forEach(function(a){
      var pr=splitRef(normRef(a.ref)||String(a.ref||''));
      if(pr[0]) (byStem[pr[0]]=byStem[pr[0]]||[]).push(a);
    });
    var stems=Object.keys(byStem),done=0,locked=0,norepo=0;
    if(!stems.length){toast('Nothing to lock');return;}
    stems.forEach(function(st){
      var path=nbPathFor(st);
      function fin(){
        if(++done!==stems.length) return;
        markDirty();refresh();
        toast(locked
          ?('Locked '+locked+' figure'+(locked===1?'':'s')
            +(norepo?' — '+norepo+' not in git':''))
          :'Nothing lockable — are the notebooks committed to git?');
      }
      if(!path||/^https?:/i.test(path)){
        norepo+=byStem[st].length;fin();return;}
      APP.api('/api/gitstate',{path:path}).then(function(g){
        if(g&&g.repo&&g.commit){
          byStem[st].forEach(function(a){
            a.lockver={commit:g.commit.id,msg:g.commit.msg||'',
              date:g.commit.date||''};
            locked++;
          });
        } else norepo+=byStem[st].length;
        fin();
      }).catch(fin);
    });
  }
  function unlockAllFrames(){
    var ann=allCellAnnots().filter(function(a){return a.lockver;});
    if(!ann.length){toast('No locked figures');return;}
    if(!window.confirm('Unlock all '+ann.length+' figure'
      +(ann.length===1?'':'s')+'? They will follow notebook refreshes '
      +'again — locked versions stop showing.')) return;
    ann.forEach(function(a){delete a.lockver;});
    markDirty();refresh();
    toast('Unlocked '+ann.length+' figure'+(ann.length===1?'':'s'));
  }
  function loadLockedVersions(){
    var groups={};
    allCellAnnots().forEach(function(a){
      if(!(a.lockver&&a.lockver.commit)) return;
      var lp=lockParts(a); if(!lp) return;
      (groups[lp.pkey]=groups[lp.pkey]||{path:lp.path,
        commit:a.lockver.commit,anchors:[]});
      if(groups[lp.pkey].anchors.indexOf(lp.anchor)<0)
        groups[lp.pkey].anchors.push(lp.anchor);
    });
    var keys=Object.keys(groups);
    if(!keys.length){toast('No locked figures to load');return;}
    var total=0;
    keys.forEach(function(k){total+=groups[k].anchors.length;});
    toast('Loading '+total+' locked figure'+(total===1?'':'s')
      +' from '+keys.length+' version'+(keys.length===1?'':'s')+'…');
    keys.forEach(function(k){
      fetchVerCards(groups[k].path,groups[k].commit,
        groups[k].anchors);});
  }
  function renderNbsMenu(){
    var m=$('#dc-nbs-menu'); if(!m) return;
    m.innerHTML='';
    var info=nbInfo();
    if(!info.length){
      m.innerHTML='<div class="dc-nbs-empty">No notebooks yet &mdash; add cells '
        +'from your notebooks to a slide.</div>';return;}
    var h=document.createElement('div');h.className='dc-nbs-menuh';
    h.textContent='notebooks in this presentation';m.appendChild(h);
    info.forEach(function(n){
      /* openable-but-closed = "avail"; can't be opened here = "gone" */
      var cls=n.open?'open':(n.openable?'avail':'gone');
      var row=document.createElement('div');
      row.className='dc-nbrow '+cls;
      var dot=document.createElement('span');dot.className='dc-nbrow-dot';
      var nm=document.createElement('span');nm.className='dc-nbrow-nm';
      nm.textContent=n.stem;
      var st=document.createElement('span');st.className='dc-nbrow-st';
      st.textContent=n.open?'open':(n.openable?'closed':'not found');
      row.appendChild(dot);row.appendChild(nm);row.appendChild(st);
      if(n.openable&&!n.open){
        row.title=n.path;row.classList.add('clickable');
        row.addEventListener('click',function(){
          APP.openPath(n.path);hideNbsMenu();});
      } else if(n.path){row.title=n.path;}
      m.appendChild(row);
    });
    if(nbsCanOpen()){
      var acts=document.createElement('div');acts.className='dc-nbacts';
      var ob=document.createElement('button');ob.className='dbtn';
      ob.textContent='Open notebooks';
      ob.title='Open every notebook this presentation uses that is not '
        +'already open';
      ob.addEventListener('click',function(){openPresNbs(true);});
      var rb=document.createElement('button');rb.className='dbtn';
      rb.textContent='Refresh all';
      rb.title='Reload every notebook this presentation uses from disk / URL';
      rb.addEventListener('click',function(){openPresNbs(false);});
      acts.appendChild(ob);acts.appendChild(rb);m.appendChild(acts);
      if(APP.mode==='app'){
        var acts2=document.createElement('div');acts2.className='dc-nbacts';
        var la=document.createElement('button');la.className='dbtn';
        la.innerHTML='&#128274; Lock all figures';
        la.title='Pin every frame to its notebook’s current git commit — '
          +'refreshes stop changing them';
        la.addEventListener('click',function(){lockAllFrames();});
        var ua=document.createElement('button');ua.className='dbtn';
        ua.innerHTML='&#128275; Unlock all';
        ua.title='Every frame follows notebook refreshes again';
        ua.addEventListener('click',function(){unlockAllFrames();});
        var lv=document.createElement('button');lv.className='dbtn';
        lv.innerHTML='&#10227; Load locked versions';
        lv.title='Fetch every locked figure’s content from git — the '
          +'notebooks don’t need to be open';
        lv.addEventListener('click',function(){loadLockedVersions();});
        acts2.appendChild(la);acts2.appendChild(ua);
        acts2.appendChild(lv);
        m.appendChild(acts2);
      }
    } else {
      var note=document.createElement('div');note.className='dc-nbs-empty';
      note.textContent='Open / refresh is available in the Junoview app.';
      m.appendChild(note);
    }
  }
  function renderCreate(){
    renderPresRow();renderControls();renderPresNbs();renderFilm();
  }
  function moveSlide(i,d){
    var j=i+d; if(j<0||j>=pres.slides.length) return;
    var t=pres.slides[i];pres.slides[i]=pres.slides[j];pres.slides[j]=t;
    if(cur===i)cur=j; else if(cur===j)cur=i;
    markDirty();refresh();
  }
  function delSlide(i){
    pres.slides.splice(i,1);
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;
    markDirty();refresh();
  }

  /* ---------- mode switching ---------- */
  function setUIMode(m){
    mode=m;
    var creating=(m==='create'), editing=(m==='edit');
    deckEl.classList.toggle('creating',creating);
    deckEl.classList.toggle('editing',editing);
    /* the builder panel stays visible while editing a slide */
    $('#deck-create').hidden=!(creating||editing);
    var et=$('#edit-tools'); if(et) et.hidden=!editing;
    var dt=$('.deck-top',deckEl); if(dt) dt.hidden=editing;
    document.body.classList.toggle('creating-docs',
      (creating||editing)&&!deckEl.hidden);
    document.body.classList.toggle('slide-editing',
      editing&&!deckEl.hidden);
    document.body.classList.toggle('deck-open',
      !creating&&!deckEl.hidden);
    selAnnot=null;selSet=[];
    if(m==='view') revealCount=0;   /* start the build sequence fresh */
    if(!editing){                   /* Objects pane is an editing tool */
      var sp=$('#selpane'); if(sp) sp.hidden=true;
      var ob=$('#objects-btn');
      if(ob) ob.setAttribute('aria-pressed','false');
    }
    var db=$('#et-del'); if(db) db.disabled=true;
    var fb=$('#et-fmt'); if(fb) fb.hidden=true;
    if(editing) setTool('select');
    /* real full screen while presenting (browser chrome gone) */
    try{
      if(m==='view'&&!deckEl.hidden&&deckEl.requestFullscreen
         &&!document.fullscreenElement)
        deckEl.requestFullscreen().catch(function(){});
      else if(m!=='view'&&document.fullscreenElement)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    if(creating||editing){
      activePane=-1;
      renderCreate();
    }
    if(!creating) renderSlide();
  }
  function refresh(){
    if(mode==='create'){renderCreate();}
    else if(mode==='edit'){renderCreate();renderSlide();}
    else renderSlide();
  }
  function routeSync(){
    if(window.SemApp&&window.SemApp.updateHash) window.SemApp.updateHash();
  }
  function openDeck(m){
    deckEl.hidden=false;
    histReset();   /* undo history starts fresh per editing session */
    status();
    setUIMode(m||'view');
    routeSync();
  }
  function closeDeck(){
    try{
      if(document.fullscreenElement)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    closeVFull();
    deckEl.hidden=true;
    document.body.classList.remove('deck-open');
    document.body.classList.remove('creating-docs');
    document.body.classList.remove('slide-editing');
    deckEl.classList.remove('creating');
    deckEl.classList.remove('editing');
    renderPresTabs();
    routeSync();
  }
  /* ---- URL routing hooks used by the SemApp router (docs side) ---- */
  window.SemApp.deckState=function(){
    return deckEl.hidden?null:{name:pres.name,slide:cur};
  };
  window.SemApp.deckClose=function(){closeDeck();};
  window.SemApp.deckGo=function(slide){   /* move slide, keep the current mode */
    if(deckEl.hidden) return;
    go(Math.max(0,Math.min(((pres.slides||[]).length||1)-1,slide||0)));
  };
  window.SemApp.deckOpen=function(name,slide){
    if(!name) return false;
    if(pres.name!==name){
      if(!(savedByName(name)||loadDraft(name))) return false;
      lsSet(PFX+'last',name);
      loadPresentation(name);
      activePane=-1;
    }
    cur=0;
    if(typeof slide==='number'&&slide>0)
      cur=Math.max(0,Math.min(((pres.slides||[]).length||1)-1,slide));
    openDeck('edit');
    return true;
  };
  /* wrap so the click Event isn't forwarded (closeDeck takes no args) */
  $('#deck-docs').addEventListener('click',function(){closeDeck();});
  var prDocs=document.getElementById('pr-docs');
  if(prDocs) prDocs.addEventListener('click',function(){closeDeck();});
  var prNew=document.getElementById('pr-new');
  if(prNew) prNew.addEventListener('click',newPresentation);
  var prNewPost=document.getElementById('pr-newpost');
  if(prNewPost) prNewPost.addEventListener('click',newPoster);
  var prNewView=document.getElementById('pr-newview');
  if(prNewView) prNewView.addEventListener('click',newCustomView);
  var sbDone=document.getElementById('sb-done');
  if(sbDone) sbDone.addEventListener('click',closeCustomView);
  $('#pres-current').addEventListener('click',function(){
    var inp=$('#pres-name');
    this.hidden=true;
    inp.hidden=false;inp.value=pres.name;
    inp.focus();inp.select();
  });
  $('#dc-play').addEventListener('click',function(){setUIMode('view');});
  var undoBtn=$('#dc-undo');
  if(undoBtn) undoBtn.addEventListener('click',undo);
  var redoBtn=$('#dc-redo');
  if(redoBtn) redoBtn.addEventListener('click',redo);
  $('#deck-exit').addEventListener('click',function(){
    setUIMode('create');});
  $('#deck-prev').addEventListener('click',function(){backStep();});
  $('#deck-next').addEventListener('click',function(){advance();});
  /* click the letterbox AROUND the slide to clear the selection (clicks on
     the canvas itself are already handled by the annot-layer). Scoped to the
     stage element only, so it never fights a fresh text/arrow placement. */
  if(stage) stage.addEventListener('mousedown',function(ev){
    if(mode!=='edit'||tool!=='select'||ev.target!==stage) return;
    var l=stage.querySelector('.annot-layer');
    if(l) selectAnnot(l,null);
  });
  /* ONE mode toggle: swaps between the slide editor and the notebook view */
  var editBtn=$('#dc-edit');
  if(editBtn) editBtn.addEventListener('click',function(){
    if(mode==='edit') setUIMode('create');
    else if(pres.slides[cur]) setUIMode('edit');
  });
  var delBtn=$('#et-del');
  if(delBtn) delBtn.addEventListener('click',deleteSel);
  $$('#edit-tools .et').forEach(function(b){
    b.addEventListener('click',function(){setTool(b.dataset.tool);});
  });
  /* ---- "+ Shapes" dropdown: choose a shape, then draw it ---- */
  function shapeIcon(shp){
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','sh-ico');svg.setAttribute('viewBox','0 0 100 100');
    if(shp==='rect'){
      var rc=document.createElementNS(SVGNS,'rect');
      rc.setAttribute('x','12');rc.setAttribute('y','22');
      rc.setAttribute('width','76');rc.setAttribute('height','56');
      rc.setAttribute('rx','7');rc.setAttribute('fill','#c9d6e2');
      svg.appendChild(rc);
    } else if(shp==='ellipse'){
      var el=document.createElementNS(SVGNS,'ellipse');
      el.setAttribute('cx','50');el.setAttribute('cy','50');
      el.setAttribute('rx','42');el.setAttribute('ry','33');
      el.setAttribute('fill','#c9d6e2');svg.appendChild(el);
    } else if(SHAPE_GLYPH[shp]){
      var tx=document.createElementNS(SVGNS,'text');
      tx.setAttribute('x','50');tx.setAttribute('y','56');
      tx.setAttribute('text-anchor','middle');
      tx.setAttribute('dominant-baseline','central');
      tx.setAttribute('font-size','98');tx.setAttribute('font-weight','800');
      tx.setAttribute('fill','#c9d6e2');tx.textContent=SHAPE_GLYPH[shp];
      svg.appendChild(tx);
    } else {
      var p=document.createElementNS(SVGNS,'path');
      p.setAttribute('d',SHAPE_PATHS[shp]||'');
      p.setAttribute('fill','#c9d6e2');svg.appendChild(p);
    }
    return svg;
  }
  (function(){
    var shBtn=$('#sh-btn'),shMenu=$('#sh-menu'),shDrop=$('#sh-drop');
    if(!shBtn||!shMenu) return;
    SHAPE_LIST.forEach(function(pair){
      var opt=document.createElement('button');
      opt.className='sh-opt';opt.type='button';opt.title=pair[1];
      opt.dataset.shape=pair[0];
      opt.appendChild(shapeIcon(pair[0]));
      var t=document.createElement('span');t.className='sh-opt-t';
      t.textContent=pair[1];opt.appendChild(t);
      opt.addEventListener('click',function(e){
        e.stopPropagation();
        pendingShape=pair[0];
        shMenu.hidden=true;shBtn.setAttribute('aria-expanded','false');
        setTool('rect');
      });
      shMenu.appendChild(opt);
    });
    shBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=shMenu.hidden;
      shMenu.hidden=!willOpen;
      shBtn.setAttribute('aria-expanded',willOpen.toString());
    });
    document.addEventListener('click',function(e){
      if(!shMenu.hidden&&shDrop&&!shDrop.contains(e.target)){
        shMenu.hidden=true;shBtn.setAttribute('aria-expanded','false');}
    });
  })();
  var downBtn=$('#deck-down');
  if(downBtn) downBtn.addEventListener('click',scrollToTrace);
  var upBtn=$('#deck-up');
  if(upBtn) upBtn.addEventListener('click',scrollToSlide);
  var vfClose=$('#vfull-close');
  if(vfClose) vfClose.addEventListener('click',closeVFull);
  /* ---- "Plot trace" opens a new DOCS tab, subset to the cells that build
     this plot. The deck (which owns the lineage) hands the cell ids + a
     dependency graph to the docs side, which clones those cards into a tab —
     every document filter and button keeps working because the tab IS made
     of real document cards. ---- */
  window.SemTrace={
    open:function(stem,anchor){
      var it=traceItemFor(stem,anchor); if(!it) return;
      if(!(window.SemApp&&window.SemApp.openTraceTab)) return;
      var group=lineageForItem(it.ns);
      var ids={},list=[];
      if(group) group.steps.forEach(function(s){
        if(s.card&&!ids[s.card]){ids[s.card]=1;list.push(s.card);}});
      if(it.card&&!ids[it.card]) list.push(it.card);   /* the plot itself */
      var graph=group?plotGraph(group,function(step){
        if(window.SemApp.traceGoto) window.SemApp.traceGoto(step.card);
      }):null;
      window.SemApp.openTraceTab(
        it.nb,list,it.title||'Plot trace',graph,anchor);
    }
  };
  /* close any open code-trail filter menu on an outside click */
  document.addEventListener('click',function(e){
    $$('.vo-fmenu').forEach(function(m){
      if(!m.hidden&&m.parentNode&&!m.parentNode.contains(e.target))
        m.hidden=true;});
  });
  /* ---- "Notebooks" popover in the deck header ---- */
  var nbsBtn=$('#dc-nbs-btn'),nbsMenu=$('#dc-nbs-menu');
  if(nbsBtn) nbsBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!nbsMenu) return;
    if(nbsMenu.hidden){
      renderNbsMenu();nbsMenu.hidden=false;
      nbsBtn.setAttribute('aria-expanded','true');
    } else hideNbsMenu();
  });
  document.addEventListener('click',function(e){
    if(nbsMenu&&!nbsMenu.hidden&&!nbsMenu.contains(e.target)
       &&e.target!==nbsBtn) hideNbsMenu();
  });
  document.addEventListener('fullscreenchange',function(){
    /* Esc always exits browser fullscreen (the page cannot prevent
       it), so Esc while presenting leaves the presentation entirely —
       never a windowed half-presentation state. Inner layers (the code
       overlay, the trace) close via their own ✕ / scroll instead. */
    if(document.fullscreenElement) return;
    if(mode!=='view'||deckEl.hidden) return;
    closeVFull();
    setUIMode('create');
  });
  document.addEventListener('keydown',function(e){
    if(picking>=0){
      if(e.key==='Escape'){e.preventDefault();endPick();}
      return;
    }
    if(deckEl.hidden) return;
    /* while the document is being presented full screen over an open
       builder, its own Esc / Ctrl+Z own the keyboard — don't let the deck
       also close or undo underneath it */
    if(document.body.classList.contains('doc-presenting')) return;
    var tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea') return;
    if(e.target.isContentEditable) return;
    if(e.key==='Escape'){
      var vf=$('#vfull');
      if(vf&&!vf.hidden) closeVFull();
      else if(mode==='view'&&(stage.scrollTop||0)>50) scrollToSlide();
      else if(mode==='edit'
              &&(tool!=='select'||selAnnot!==null||selSet.length)){
        /* first Esc drops the tool / selection; the next one leaves the
           editor (there are no Select/Delete buttons — Esc and Del do it) */
        setTool('select');
        var l=stage.querySelector('.annot-layer');
        if(l) selectAnnot(l,null);
        else {selAnnot=null;selSet=[];showFmt();}
      }
      else if(mode==='view'||mode==='edit') setUIMode('create');
      else closeDeck();
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')
            &&mode!=='view'){
      e.preventDefault();
      if(e.shiftKey) redo(); else undo();
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')
            &&mode!=='view'){
      e.preventDefault();redo();
    }
    else if(mode==='edit'){
      if(e.key==='Delete'||e.key==='Backspace'){
        e.preventDefault();deleteSel();
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')){
        e.preventDefault();duplicateSel();
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='g'||e.key==='G')){
        e.preventDefault();
        if(e.shiftKey) ungroupSel(); else groupSel();
      }
      else if(e.key.indexOf('Arrow')===0
              &&(selSet.length||selAnnot!==null)){
        e.preventDefault();
        var st=e.shiftKey?2:0.4;
        nudgeSel(e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,
                 e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0);
      }
    }
    else if(mode==='view'){
      if(e.key==='ArrowRight'||e.key==='PageDown'
         ||(e.key===' '&&tag!=='button')){e.preventDefault();advance();}
      else if(e.key==='ArrowLeft'||e.key==='PageUp'){
        e.preventDefault();backStep();}
      else if(e.key==='ArrowDown'){
        e.preventDefault();
        if((stage.scrollTop||0)<60) scrollToTrace();
        else stage.scrollBy({top:stage.clientHeight*0.7,
          behavior:'smooth'});
      }
      else if(e.key==='ArrowUp'){
        e.preventDefault();
        if((stage.scrollTop||0)<=stage.clientHeight*0.8) scrollToSlide();
        else stage.scrollBy({top:-stage.clientHeight*0.7,
          behavior:'smooth'});
      }
    }
  });

  /* ---------- create mode: click a card in ANY open tab to place it */
  document.addEventListener('click',function(e){
    if(deckEl.hidden||mode!=='create') return;
    var t=e.target;
    if(!t||!t.closest) return;
    if(deckEl.contains(t)) return;
    if(t.closest('.apptop,.opendlg,.welcome')) return;
    var shellEl=t.closest('.nbshell');
    if(!shellEl) return;
    var card=t.closest('.card');
    if(!card) return;
    if(t.closest('.codetoggle,.depchip,a')) return;
    var s=pres.slides[cur];
    if(!s){pres.slides.push(emptySlide());cur=pres.slides.length-1;
      s=pres.slides[cur];}
    if(s.layout==='title'){
      e.preventDefault();e.stopPropagation();
      toast('This is a title slide — pick a layout to add card frames');
      return;
    }
    /* a Plot-trace tab's cards are clones — resolve to the real notebook */
    var ref=nsKey(shellEl.dataset.src||shellEl.dataset.nb,
      card.dataset.anchor);
    if(slideCells(s).some(function(c){return c.a.ref===ref;})){
      e.preventDefault();e.stopPropagation();
      toast('That card is already on this slide');
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},700);
      return;
    }
    /* deliberate placement: a card lands in the frame the user has
       SELECTED (armed). When the slide has NO frames yet, the click is
       unambiguous so we create one; when it HAS empty frames but none
       is armed, require a selection first (so cards don't jump in while
       you read the notebook). */
    var target=annotByIdx(s,activePane);
    if(!target||target.k!=='cell'||target.ref){
      if(slideCells(s).length===0){
        s.annots=s.annots||[];
        s.annots.push({k:'cell',x:8,y:8,w:84,h:84,ref:null});
        target=annotByIdx(s,s.annots.length-1);
      } else {
        toast('Select an empty frame on the slide first, then click');
        return;
      }
    }
    e.preventDefault();e.stopPropagation();
    target.ref=ref;
    activePane=-1;   /* disarm: adding again needs a fresh frame selection */
    markDirty();refresh();
    card.classList.add('target-flash');
    setTimeout(function(){card.classList.remove('target-flash');},700);
  },true);

  /* ---------- create mode: slide + presentation operations ---------- */
  $('#film-add').addEventListener('click',function(){
    var at=pres.slides.length?cur+1:0;
    pres.slides.splice(at,0,emptySlide());
    cur=at;activePane=-1;
    markDirty();refresh();
  });
  renderLayoutPicker();
  /* title-slide text fields (panel); the slide canvas mirrors them */
  [['#ts-title','title'],['#ts-sub','sub']].forEach(function(p){
    var inp=$(p[0]); if(!inp) return;
    inp.addEventListener('input',function(){
      var s=pres.slides[cur];
      if(!s||s.layout!=='title') return;
      s[p[1]]=this.value;
      markDirty();renderFilm();
      if(mode==='edit') renderSlide();
    });
  });
  /* ---- File menu ---- */
  var fileBtn=$('#dc-file'), fileMenu=$('#dc-menu');
  function closeMenu(){
    if(fileMenu&&!fileMenu.hidden){
      fileMenu.hidden=true;
      fileBtn.setAttribute('aria-expanded','false');
    }
  }
  if(fileBtn){
    fileBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=!fileMenu.hidden;
      fileMenu.hidden=open;
      fileBtn.setAttribute('aria-expanded',(!open).toString());
    });
    document.addEventListener('click',function(e){
      if(!fileMenu.hidden&&!fileMenu.contains(e.target)) closeMenu();
    });
  }
  function menuAction(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(){closeMenu();fn();});
  }
  menuAction('#mi-new',newPresentation);
  menuAction('#mi-rename',function(){
    var lbl=$('#pres-current'), inp=$('#pres-name');
    if(lbl) lbl.hidden=true;
    inp.hidden=false;inp.value=pres.name;
    inp.focus();inp.select();
  });
  menuAction('#mi-auto-figs',function(){
    pres.slides=autoSlides(false);cur=0;activePane=0;
    markDirty();refresh();
    toast(pres.slides.length+' slides: one per figure, in order');
  });
  menuAction('#mi-auto-figdocs',function(){
    pres.slides=autoSlides(true);cur=0;activePane=0;
    markDirty();refresh();
    toast(pres.slides.length+' slides: figures + docs, in order');
  });
  function updateNumsLabel(){
    var b=$('#mi-nums');
    if(b) b.textContent='Slide numbers: '+(pres.showNums?'on':'off');
  }
  menuAction('#mi-nums',function(){
    if(pres.showNums){delete pres.showNums;} else {pres.showNums=1;}
    updateNumsLabel();markDirty();refresh();
    toast('Slide numbers '+(pres.showNums?'on':'off'));
  });
  $('#pres-name').addEventListener('input',function(){
    var old=pres.name;
    pres.name=this.value.trim();
    if(old&&old!==pres.name) lsDel(PFX+old);
    markDirty();
  });
  $('#pres-name').addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key==='Escape') this.blur();
    e.stopPropagation();
  });
  $('#pres-name').addEventListener('blur',function(){
    this.hidden=true;
    var lbl=$('#pres-current');
    if(lbl) lbl.hidden=false;
    renderPresRow();
  });

  /* ---------- persistence ---------- */
  var toastTimer;
  function toast(msg){
    var t=$('#deck-toast');t.textContent=msg;t.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){t.hidden=true;},3600);
  }
  function mergedPresentations(){
    var out=allSaved().filter(function(p){return p.name!==pres.name;})
      .map(function(p){var c=deep(p);delete c.origin;return c;});
    var cp=deep(pres);delete cp.origin;out.push(cp);
    return out;
  }
  /* strip "stem::" when only one notebook is open, so decks saved from a
     single tab stay compatible with sidecars and --embed-deck */
  function plainIfSingle(list){
    if(APP.order.length!==1) return list;
    var pfx=APP.order[0]+'::';
    function strip(a){
      return (a&&String(a).indexOf(pfx)===0)
        ?String(a).slice(pfx.length):a;
    }
    return list.map(function(p){
      var c=deep(p);
      c.slides=(c.slides||[]).map(function(s){
        s.panes=(s.panes||[]).map(strip);
        (s.annots||[]).forEach(function(a){
          if(a.k==='cell'&&a.ref) a.ref=strip(a.ref);
        });
        if(Array.isArray(s.hidden)) s.hidden=s.hidden.map(strip);
        return s;});
      return c;});
  }
  function requireName(){
    if(pres.name) return true;
    toast('Give the presentation a name first');
    var ni=$('#pres-name');ni.hidden=false;ni.focus();
    return false;
  }
  /* ---------- app mode: save to project + autosave ---------- */
  function saveToProject(silent){
    var merged=mergedPresentations();
    return APP.api('/api/save',{presentations:merged})
      .then(function(){
        projectPres=merged;
        lsDel(PFX+(pres.name||'untitled'));
        saveStamp=new Date();saveKind=silent?'auto':'manual';
        source='saved';status();renderPresRow();
        if(!silent)
          toast('Saved "'+pres.name+'" to junoview_project.json');
      }).catch(function(e){
        if(!silent)
          toast('Save failed: '+(e&&e.message?e.message:e));
      });
  }
  /* ---------- WHERE this presentation is saved -----------------------
     'project' (app mode: junoview_project.json), 'browser' (this browser,
     the default everywhere else) or 'file' (a .junoview file you pick).
     A picked file is REMEMBERED: the FileSystemFileHandle is stored in
     IndexedDB, so the next visit saves straight back to the same place
     without asking again (the browser only re-asks for permission). */
  var TGKEY='semopts:'+SCOPE+':savetarget';
  var HKEY='deck:'+SCOPE;
  var canPickFile=!!window.showSaveFilePicker;
  var saveTarget=lsGet(TGKEY)
    ||(APP.mode==='app'?'project':'browser');
  if(saveTarget==='project'&&APP.mode!=='app') saveTarget='browser';
  if(saveTarget==='file'&&!canPickFile) saveTarget='browser';
  var fileHandle=null,fileName='';
  function idb(){
    return new Promise(function(res,rej){
      var r,done=false;
      function fail(e){if(!done){done=true;rej(e);}}
      function okd(v){if(!done){done=true;res(v);}}
      /* a blocked or wedged open must never leave the caller hanging */
      setTimeout(function(){fail(new Error('indexeddb timeout'));},4000);
      try{r=indexedDB.open('junoview',1);}catch(e){fail(e);return;}
      r.onupgradeneeded=function(){
        try{r.result.createObjectStore('handles');}catch(e){}};
      r.onsuccess=function(){okd(r.result);};
      r.onerror=function(){fail(r.error);};
      r.onblocked=function(){fail(new Error('indexeddb blocked'));};
    });
  }
  function idbPut(k,v){
    return idb().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction('handles','readwrite');
        /* .put can throw synchronously (DataCloneError) */
        try{t.objectStore('handles').put(v,k);}catch(e){rej(e);return;}
        t.oncomplete=function(){res();};
        t.onerror=function(){rej(t.error);};
        t.onabort=function(){rej(t.error);};
      });
    });
  }
  function idbGet(k){
    return idb().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction('handles','readonly');
        var q=t.objectStore('handles').get(k);
        q.onsuccess=function(){res(q.result);};
        q.onerror=function(){rej(q.error);};
      });
    });
  }
  function permOK(h){
    if(!h||!h.queryPermission) return Promise.resolve(!!h);
    return h.queryPermission({mode:'readwrite'})
      .then(function(s){return s==='granted';}).catch(function(){
        return false;});
  }
  function permAsk(h){
    if(!h) return Promise.resolve(false);
    return permOK(h).then(function(ok){
      if(ok||!h.requestPermission) return ok;
      return h.requestPermission({mode:'readwrite'})
        .then(function(s){return s==='granted';})
        .catch(function(){return false;});
    });
  }
  function pickSaveFile(){
    if(!canPickFile) return Promise.resolve(null);
    return window.showSaveFilePicker({
      suggestedName:(pres.name||'presentation')+'.junoview',
      types:[{description:'Junoview presentation',
        accept:{'application/json':['.junoview','.json']}}]
    }).then(function(h){
      fileHandle=h;fileName=h.name||'';
      /* REMEMBERING the file is best-effort: it must never delay or block
         the save itself, so it runs in the background */
      idbPut(HKEY,h).catch(function(){});
      return h;
    });
  }
  function deckFileText(){
    return JSON.stringify({junoview:1,
      presentations:plainIfSingle(mergedPresentations())},null,2);
  }
  /* write to the remembered file. `silent` = an autosave: never pops a
     permission prompt (there is no user gesture behind it) */
  function saveToFile(silent){
    if(!fileHandle&&silent) return Promise.resolve(false);
    return (fileHandle?Promise.resolve(fileHandle):pickSaveFile())
      .then(function(h){
        if(!h) return false;
        return (silent?permOK(h):permAsk(h)).then(function(ok){
          if(!ok){
            if(!silent) toast('Junoview needs permission to write '
              +(fileName||'that file'));
            return false;
          }
          return h.createWritable().then(function(w){
            return Promise.resolve(w.write(deckFileText()))
              .then(function(){return w.close();});
          }).then(function(){
            lsDel(PFX+(pres.name||'untitled'));
            saveStamp=new Date();saveKind=silent?'auto':'manual';
            source='saved';status();renderTargetBtn();renderPresRow();
            if(!silent) toast('Saved to '+(fileName||'your file'));
            return true;
          });
        });
      }).catch(function(e){
        if(!silent&&(!e||e.name!=='AbortError'))
          toast('Save failed: '+((e&&e.message)||e));
        return false;
      });
  }
  function targetLabel(){
    if(saveTarget==='project') return 'This project';
    if(saveTarget==='file') return fileName||'a file (not chosen yet)';
    return 'Browser';
  }
  function renderTargetBtn(){
    var b=$('#dc-target'); if(!b) return;
    b.innerHTML='Saved to: '+esc(targetLabel())+' &#9662;';
    b.classList.toggle('tg-file',saveTarget==='file');
    var pj=$('#tg-project'); if(pj) pj.hidden=(APP.mode!=='app');
    var pk=$('#tg-pick'); if(pk) pk.hidden=(saveTarget!=='file');
    var tf=$('#tg-file');
    if(tf) tf.textContent=canPickFile
      ?'A file on your computer…'
      :'A file (this browser can’t — use Download a copy)';
    if(tf) tf.disabled=!canPickFile;
    [['#tg-project','project'],['#tg-browser','browser'],
     ['#tg-file','file']].forEach(function(p){
      var el=$(p[0]);
      if(el) el.setAttribute('aria-pressed',(saveTarget===p[1]).toString());
    });
    b.setAttribute('data-tip',
      saveTarget==='file'
        ?'Saving writes '+(fileName||'a .junoview file')
          +' — Junoview remembers it between visits'
        :saveTarget==='project'
          ?'Saving writes junoview_project.json next to your notebooks'
          :'Kept in this browser. Switch to a file to save it on your '
            +'computer as .junoview');
  }
  function setTarget(t){
    saveTarget=t;lsSet(TGKEY,t);
    renderTargetBtn();renderSaveBtn();status();
  }
  var AUTOKEY='semopts:'+SCOPE+':autosave';
  var autosaveOn=(APP.mode==='app')&&lsGet(AUTOKEY)!=='0';
  var autoTimer=null;
  function scheduleAutosave(){
    /* a remembered file autosaves too — silently, and only while the
       browser still grants write permission (after a reload it waits for
       the first Save click, which carries the user gesture it needs) */
    if(saveTarget==='file'){
      clearTimeout(autoTimer);
      autoTimer=setTimeout(function(){saveToFile(true);},1200);
      return;
    }
    if(!autosaveOn||APP.mode!=='app'||saveTarget!=='project') return;
    clearTimeout(autoTimer);
    autoTimer=setTimeout(function(){saveToProject(true);},1200);
  }
  function renderAutosaveItem(){
    var mi=$('#mi-autosave'); if(!mi) return;
    mi.hidden=(APP.mode!=='app');
    mi.textContent='Autosave: '+(autosaveOn?'on':'off');
  }
  var miAuto=$('#mi-autosave');
  if(miAuto) miAuto.addEventListener('click',function(){
    closeMenu();
    autosaveOn=!autosaveOn;
    lsSet(AUTOKEY,autosaveOn?'1':'0');
    renderAutosaveItem();renderSaveBtn();status();
    if(autosaveOn){scheduleAutosave();toast('Autosave on');}
    else toast('Autosave off — use the Save button');
  });
  renderAutosaveItem();

  /* always-visible Save button; the File menu keeps the rest */
  var saveBtn=$('#dc-save');
  function renderSaveBtn(){
    if(!saveBtn) return;
    if(saveTarget==='file'){
      saveBtn.setAttribute('data-tip','Save now to '
        +(fileName||'the .junoview file you pick')
        +' — Junoview remembers it between visits');
    } else if(saveTarget==='project'&&APP.mode==='app'){
      saveBtn.setAttribute('data-tip','Save now to '
        +'junoview_project.json'
        +(autosaveOn
          ?' — autosave is ON: every change saves itself about a '
            +'second later'
          :' — autosave is OFF, only this button saves'));
    } else {
      saveBtn.setAttribute('data-tip','Kept in this browser '
        +'automatically as you edit — Save confirms it. Switch '
        +'"Saved to" to keep it as a file on your computer');
    }
    saveBtn.removeAttribute('title');
  }
  if(saveBtn) saveBtn.addEventListener('click',function(){
    if(!requireName()) return;
    if(saveTarget==='project'&&APP.mode==='app'){saveToProject(false);return;}
    if(saveTarget==='file'){saveToFile(false);return;}
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
    saveStamp=new Date();saveKind='manual';
    status();
    toast('Kept in this browser — it also autosaves as you edit. '
      +'Switch "Saved to" to a file to keep it on your computer.');
  });
  renderSaveBtn();
  /* ---- the "Saved to" picker ---- */
  (function(){
    var wrap=$('#dc-target')&&$('#dc-target').parentNode;
    var btn=$('#dc-target'),menu=$('#target-menu');
    if(!btn||!menu) return;
    function close(){menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open.toString());
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&wrap&&!wrap.contains(e.target)) close();});
    var pj=$('#tg-project');
    if(pj) pj.addEventListener('click',function(){
      close();setTarget('project');
      toast('Saving now writes junoview_project.json');
    });
    var br=$('#tg-browser');
    if(br) br.addEventListener('click',function(){
      close();setTarget('browser');
      toast('Kept in this browser from now on');
    });
    function chooseFile(){
      close();
      if(!canPickFile){
        toast('This browser can’t save straight to a file — '
          +'use File › Download a copy');
        return;
      }
      if(!requireName()) return;
      pickSaveFile().then(function(h){
        if(!h) return;
        setTarget('file');
        return saveToFile(false);
      }).catch(function(e){
        if(!e||e.name!=='AbortError')
          toast('Could not choose a file: '+((e&&e.message)||e));
      });
    }
    var tf=$('#tg-file');
    if(tf) tf.addEventListener('click',function(){
      if(saveTarget==='file'&&fileHandle){
        close();setTarget('file');
        toast('Saving writes '+fileName);
        return;
      }
      chooseFile();
    });
    var pk=$('#tg-pick');
    if(pk) pk.addEventListener('click',chooseFile);
    /* a file chosen on an earlier visit is still remembered */
    idbGet(HKEY).then(function(h){
      if(!h) return;
      fileHandle=h;fileName=h.name||'';
      renderTargetBtn();renderSaveBtn();
    }).catch(function(){});
    renderTargetBtn();
  })();

  /* direct save-into-.ipynb is parked for now (kept for later) */
  var ENABLE_SAVE_TO_IPYNB=false;
  var writeBtn=$('#mi-save');
  if(APP.mode==='app'){
    writeBtn.textContent='Save to project';
    writeBtn.addEventListener('click',function(){
      closeMenu();
      if(!requireName()) return;
      saveToProject(false);
    });
  } else if(ENABLE_SAVE_TO_IPYNB
      &&APP.order.length===1&&window.showOpenFilePicker){
    writeBtn.addEventListener('click',function(){
      closeMenu();
      if(!requireName()) return;
      (async function(){
        try{
          var picks=await window.showOpenFilePicker({types:[{
            description:'Jupyter notebook',
            accept:{'application/json':['.ipynb']}}]});
          var h=picks[0];
          var f=await h.getFile();
          var nb=JSON.parse(await f.text());
          nb.metadata=nb.metadata||{};
          nb.metadata.semantic=nb.metadata.semantic||{};
          nb.metadata.semantic.presentations=
            plainIfSingle(mergedPresentations());
          delete nb.metadata.semantic.deck;
          var w=await h.createWritable();
          await w.write(JSON.stringify(nb,null,1));
          await w.close();
          var stem0=APP.order[0];
          nbPres=mergedPresentations().map(function(p){
            var c=normPres(p,null);c.origin=stem0;return c;});
          lsDel(PFX+(pres.name||'untitled'));
          saveStamp=new Date();saveKind='manual';
          source='saved';status();renderPresRow();
          toast('Saved "'+pres.name+'" into '+f.name);
        }catch(e){
          if(!e||e.name!=='AbortError')
            toast('Save failed: '+(e&&e.message?e.message:e));
        }
      })();
    });
  } else {
    writeBtn.hidden=true;
  }
  menuAction('#mi-dl',function(){
    var blob=new Blob([deckFileText()],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(APP.order.length===1?APP.order[0]:'project')+'.junoview';
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
    toast(APP.order.length===1
      ?'Downloaded. Keep it next to the .ipynb and it loads itself.'
      :'Downloaded. Load it with --deck, or save to the project instead.');
  });
  menuAction('#mi-load',function(){
    var fi=document.getElementById('deckfile');
    if(fi) fi.click();
  });
  /* ---- Export PDF / print: render every slide at a fixed size (so text,
     which is sized from the layer height, comes out right) into off-screen
     pages, then hand off to the browser's Print -> Save as PDF ---- */
  function printDeck(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    var old=document.getElementById('print-root');
    if(old) old.remove();
    var savedMode=mode,savedReveal=revealCount,savedCur=cur;
    mode='view';revealCount=99999;              /* all builds fully revealed */
    var root=document.createElement('div');root.id='print-root';
    /* attach the container FIRST (off-screen but laid out) so each slide has a
       real 720px height when its text is sized from the layer — otherwise a
       detached layer measures 0 and text bakes in ~17% too small */
    document.body.appendChild(root);
    /* a custom page (4:3 / A-series poster) exports at ITS size, not 16:9 */
    var pg=pageOf();
    if(pg.id!=='16x9'){
      var pw=Math.round(pg.mm[0]/25.4*96),ph=Math.round(pg.mm[1]/25.4*96);
      var pst=document.createElement('style');
      pst.textContent='#print-root{width:'+pw+'px;}'
        +'.print-page{width:'+pw+'px;height:'+ph+'px;}'
        +'@media print{@page{size:'+pg.mm[0]+'mm '+pg.mm[1]+'mm;'
        +'margin:0;}}';
      root.appendChild(pst);
    }
    pres.slides.forEach(function(s,i){
      cur=i;
      var page=document.createElement('div');page.className='print-page';
      var slideEl=document.createElement('div');
      if(s&&s.layout==='title'){
        slideEl.className='slide slide-titlefree';
        slideEl.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
      } else slideEl.className='slide slide-blank';
      page.appendChild(slideEl);
      root.appendChild(page);            /* in the DOM before annots render */
      if(s) attachAnnots(slideEl,s);     /* view-style; fontPx reads 720px */
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';pn.textContent=(i+1);
        slideEl.appendChild(pn);
      }
    });
    mode=savedMode;revealCount=savedReveal;cur=savedCur;
    document.body.classList.add('printing');
    if(typeset) typeset(root);
    var done=false;
    function cleanup(){
      if(done) return;done=true;
      document.body.classList.remove('printing');
      var r=document.getElementById('print-root'); if(r) r.remove();
      window.removeEventListener('afterprint',cleanup);
    }
    window.addEventListener('afterprint',cleanup);
    /* let layout + MathJax settle, then open the print dialog */
    setTimeout(function(){try{window.print();}catch(e){}
      setTimeout(cleanup,800);},120);
    return root;   /* returned for headless testing */
  }
  window.SemDeckPrint=printDeck;   /* test hook */
  menuAction('#mi-pdf',function(){printDeck();});
  (function(){
    var fi=document.getElementById('deckfile');
    if(!fi) return;
    fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      this.value='';
      if(!f) return;
      f.text().then(function(txt){
        var obj=JSON.parse(txt);
        var list=(obj&&Array.isArray(obj.presentations))
          ?obj.presentations
          :Array.isArray(obj)?obj
          :(obj&&Array.isArray(obj.slides))?[obj]:null;
        if(!list||!list.length){
          toast('That file does not look like a saved deck');
          return;
        }
        var imported=0,firstName=null;
        list.forEach(function(pr){
          if(!pr||!Array.isArray(pr.slides)) return;
          var np=normPres(pr);
          var base=np.name||'imported',nm=base,k=1;
          while(savedByName(nm)||lsGet(PFX+nm)){
            k++;nm=base+'-'+k;
          }
          np.name=nm;
          lsSet(PFX+nm,JSON.stringify(np));
          if(!firstName) firstName=nm;
          imported++;
        });
        if(!imported){
          toast('No presentations found in that file');
          return;
        }
        lsSet(PFX+'last',firstName);
        loadPresentation(firstName);
        cur=0;activePane=-1;
        status();refresh();
        toast('Imported '+imported+' presentation'
          +(imported>1?'s':'')+' (as drafts)');
      }).catch(function(e){
        toast('Import failed: '+((e&&e.message)||e));
      });
    });
  })();
  menuAction('#mi-discard',function(){
    lsDel(PFX+(pres.name||'untitled'));
    loadPresentation(pres.name);
    cur=0;activePane=-1;
    status();
    refresh();
  });
  menuAction('#mi-del',function(){
    var nm=pres.name;
    lsDel(PFX+nm);
    var wasEmbedded=nbPres.some(function(p){return p.name===nm;});
    projectPres=projectPres.filter(function(p){return p.name!==nm;});
    nbPres=nbPres.filter(function(p){return p.name!==nm;});
    if(APP.mode==='app')
      APP.api('/api/save',{presentations:deep(projectPres)})
        .catch(function(){});
    var names=allSaved().map(function(p){return p.name;})
      .concat(draftNames());
    if(names.length) loadPresentation(names[0]);
    else {pres=defaultPres();source='auto';}
    cur=0;activePane=-1;
    status();refresh();
    toast(wasEmbedded
      ?('Deleted "'+nm+'" (it will return if it is embedded in a '
        +'notebook’s metadata)')
      :('Deleted "'+nm+'"'));
  });

  /* ---------- tabs opened / closed while the page lives ---------- */
  document.addEventListener('sem:shell',function(e){
    if(e.detail.replaced){
      /* the notebook was reloaded: what every frame showed until now
         becomes the "previous figure" it can revert to */
      var pfx=e.detail.stem+'::';
      Object.keys(frameSnaps).forEach(function(k){
        if(k.indexOf(pfx)===0){
          frameSnapsPrev[k]=frameSnaps[k];delete frameSnaps[k];}
      });
    }
    registerShell(e.detail.stem,e.detail.data||{});
    if(source==='auto'&&(!pres.slides||!pres.slides.length))
      pres=defaultPres();
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });
  document.addEventListener('sem:shellclosed',function(e){
    unregisterShell(e.detail.stem);
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });

  status();
  renderPresTabs();
  /* both IIFEs + their route hooks are now wired — restore the URL's view */
  if(window.SemApp&&window.SemApp.applyInitialRoute)
    window.SemApp.applyInitialRoute();
})();
"""

_SHELL_TEMPLATE = """<div class="shell nbshell" data-nb="{stem}"{path_attr}>
  <aside class="rail">
    <div class="railhead">
      <h1 class="railtitle">{title}</h1>
      <div class="railmeta">{meta}</div>
      <div class="railfile">
        <button class="rf-btn rf-info" type="button"
          title="Where this notebook came from — its path, its git commit,
 and every earlier version you can open">File info
          &#9662;</button>
        <button class="rf-btn rf-reload" type="button"
          title="Reload this notebook from disk">&#8635;</button>
        <!-- shown only while something IS hidden: a permanent button for a
             state you are usually not in is clutter -->
        <button class="rf-btn rf-unhide" type="button" hidden
          title="Bring back every hidden section, heading and cell in this
 notebook">Show all hidden</button>
      </div>
      <div class="rf-panel" hidden></div>
    </div>
    {nav}
    {graph_panel}
  </aside>
  <main class="stage">
    <div class="content">
      <div class="docbar" hidden>
        <span class="docbar-ic">&#128196;</span>
        <span class="docbar-nm">{stem}</span>
        <span class="docbar-p"></span>
      </div>
      {sections}
    </div>
    <div class="rawview">
      {rawview}
    </div>
    <div class="treeview" aria-label="Analysis tree view"></div>
  </main>
  <script type="application/json" class="nb-data">{nb_data}</script>
</div>
"""

_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<!-- a generator tag, NOT a description: the page's content belongs to
     whoever exported it, so we name the tool without describing their
     notebook for them -->
<meta name="generator" content="Junoview — figure-first Jupyter notebook
 viewer and presentation builder (https://junoview.dev)">
<link rel="icon" href="{favicon}">
<style>{css}</style>
<style>{app_css}</style>
<style>{deck_css}</style>
{mathjax}
</head>
<body>
<div class="scrim" id="scrim"></div>
<header class="apptop" id="apptop">
  <div class="appbar">
    <!-- File info + reload live at the top of the sidebar, beside the
         notebook they describe; only Open belongs to the app itself -->
    <span class="abgrp" id="ab-file"><span class="abgrp-row"><span class="fgrp" id="file-grp">
      <button class="toggle primary" id="tab-open" hidden
        title="Open a notebook (.ipynb) from your computer or a
 URL"><i data-ic="open"></i><span class="btxt">Open</span></button>
    </span></span><span class="abgrp-lab">File</span></span>
    <span class="appbar-div filt-div" aria-hidden="true"></span>
    <span class="abgrp" id="ab-filters"><span class="abgrp-row"><span class="fgrp" id="pt-grp">
      <button class="toggle tv" id="tv-plots"
        title="Plots / figures — the headline of each cell. Click to cycle:
 Visible -> Collapsed -> Hidden"><i data-ic="plots"></i><span class="tdot"></span><span class="btxt"></span><span class="tvstate"></span></button>
      <button class="toggle sub" id="pt-filter-btn"
        title="Advanced: hide specific PLOT types (matplotlib, plotly,
 bokeh, vega, folium, …)"><i data-ic="types"></i></button>
    </span>
    <span class="fgrp" id="md-grp">
      <button class="toggle tv" id="tv-markdown"
        title="Markdown / note cards. Click to cycle: Visible -> Collapsed
 -> Hidden"><i data-ic="markdown"></i><span class="tdot"></span><span class="btxt"></span><span class="tvstate"></span></button>
    </span>
    <span class="fgrp" id="ck-grp">
      <button class="toggle tv" id="tv-code"
        title="Code — the source in every cell (imports, prints, plotting, …).
 Click to cycle: Visible -> Collapsed -> Hidden"><i data-ic="code"></i><span class="tdot"></span><span class="btxt"></span><span class="tvstate"></span></button>
      <button class="toggle sub" id="ck-filter-btn"
        title="Advanced: hide specific CODE cell types (imports, plotting,
 …)"><i data-ic="types"></i></button>
    </span>
    <span class="fgrp" id="ot-grp">
      <button class="toggle tv" id="tv-output"
        title="Printed output — the tables, values and text a cell prints.
 Everything a notebook produces is 'output'; plots are just the one kind
 pulled out into their own filter (on the left). Click to show / hide"><i data-ic="output"></i><span class="tdot"></span><span class="btxt"></span><span class="tvstate"></span></button>
      <button class="toggle sub" id="ot-filter-btn"
        title="Advanced: hide specific OUTPUT types (print, dataset, result,
 error)"><i data-ic="types"></i></button>
    </span></span><span class="abgrp-lab">Filters</span></span>
    <span class="appbar-div filt-div" aria-hidden="true"></span>
    <span class="abgrp" id="ab-scope"><span class="abgrp-row"><span class="fgrp" id="sec-scope-grp">
      <button class="toggle" id="sec-scope-btn"
        title="Choose WHICH sections the filters above act on — select the
 headings and sub-headings to include, change the filters, then select a
 different set and filter those differently. Each section remembers its
 own filters."
        ><i data-ic="scope"></i><span class="btxt">Sections: All</span></button>
      <button class="toggle sub" id="filters-reset"
        title="Put every filter — and every per-section change — in THIS
 notebook back to the defaults"><i data-ic="reset"></i>Reset</button>
    </span>
    <span class="fgrp" id="copy-grp">
      <button class="toggle sub" id="trace-inherit" hidden
        data-keep="1"
        title="This plot trace opened unfiltered, on purpose. Click to give
 it the same filters as the notebook it came from."><i data-ic="inherit"></i
 >Match document</button>
    </span>
    </span><span class="abgrp-lab">Apply to</span></span>
    <span class="appbar-div" aria-hidden="true"></span>
    <span class="abgrp" id="ab-size"><span class="abgrp-row abgrp-stack"><span class="fgrp fgrp-h" id="fig-size-grp">
      <span class="fgrp-row">
        <button class="toggle fz-step" id="fig-smaller"
          title="Make every figure in the feed smaller"><i data-ic="minus"></i></button>
        <button class="toggle fz-val" id="fig-size-val"
          title="Figure size across the whole feed — click to reset to 100%"
          >100%</button>
        <button class="toggle fz-step" id="fig-bigger"
          title="Make every figure in the feed bigger (each figure also has
 its own +/- and an expand button on hover)"><i data-ic="plus"></i></button>
      </span>
      <span class="fgrp-cap">Figures</span>
    </span>
    <span class="fgrp fgrp-h" id="md-size-grp">
      <span class="fgrp-row">
        <button class="toggle fz-step" id="md-smaller"
          title="Smaller markdown / prose text"><i data-ic="minus"></i></button>
        <button class="toggle fz-val" id="md-size-val"
          title="Markdown text size — click to reset to 100%"
          >100%</button>
        <button class="toggle fz-step" id="md-bigger"
          title="Larger markdown / prose text"><i data-ic="plus"></i></button>
      </span>
      <span class="fgrp-cap">Text</span>
    </span></span><span class="abgrp-lab">Size</span></span>
    <span class="appbar-div" aria-hidden="true"></span>
    <!-- Raw / Tree / Present stay together: they are one idea (how you are
         looking at the document) and must not wrap apart -->
    <span class="abgrp" id="ab-view"><span class="abgrp-row"><span class="btn-grp" id="view-grp">
    <!-- Raw over Tree in one column, Present beside them: two short
         buttons stacked cost the bar half the width of three in a line -->
    <span class="vw-stack">
    <button class="toggle" id="view-raw"
      title="Toggle between the semantic view and the raw notebook
 (cells in order, directives visible)"><i data-ic="raw"></i><span class="btxt">Raw</span></button>
    <button class="toggle" id="view-tree"
      title="Tree view: the analysis as a dependency map you can expand,
 collapse and hide cell by cell. Toggle back for the narrative document."
      ><i data-ic="tree"></i><span class="btxt">Tree</span></button>
    </span>
    <button class="toggle" id="doc-present"
      title="Present this document full screen (Narrative or Tree). Esc to
 exit."><i data-ic="present"></i>Present</button>
    </span></span><span class="abgrp-lab">View</span></span>
    <!-- nothing hidden behind a menu: these all fit -->
    <span class="abgrp appbar-right" id="ab-app"><span class="abgrp-row">
    <span class="btn-grp">
      <button class="toggle" id="theme-btn"
        title="Switch between dark and light theme"><i data-ic="theme"></i></button>
      <a class="toggle appbar-link" id="support-btn" href="{kofi}"
        target="_blank" rel="noopener"
        title="Support Junoview on Ko-fi — funds an online, hosted version
 with accounts (save + share your docs and talks, like Overleaf)"
        ><i data-ic="heart"></i></a>
      <button class="toggle" id="help-btn"
        title="How to use, and everything this tool can do" aria-label="Help"><i data-ic="help"></i></button>
    </span></span><span class="abgrp-lab">App</span></span>
  </div>
  <div class="tabsrow">
    <button class="menubtn" id="menubtn" aria-label="Toggle sections"
      title="Show or hide the section sidebar (table of contents)">
      <span></span></button>
    <div class="tabstrip" id="tabstrip" role="tablist"
      aria-label="Open notebooks"></div>
  </div>
  <!-- CUSTOM VIEW styling bar: lives INSIDE the header so measureChrome()
       insets the document by it automatically, and so the normal filter
       ribbon stays available (a custom view saves your filters too) -->
  <div class="stylebar" id="stylebar" hidden>
    <span class="sb-lab">custom view</span>
    <span class="sb-name" id="sb-name"></span>
    <span class="appbar-div"></span>
    <button class="toggle" id="sb-md" type="button"
      title="Style EVERY markdown cell in this view">All markdown</button>
    <button class="toggle" id="sb-hd" type="button"
      title="Style EVERY heading in this view">All headings</button>
    <button class="toggle" id="sb-doc" type="button"
      title="Page colour, accent colour and spacing">Document</button>
    <span class="appbar-div"></span>
    <button class="toggle" id="sb-override" type="button" hidden
      title="Clear the styles set on individual sections and cells, so
 they follow the view-wide style again">Override individual styles</button>
    <button class="toggle" id="sb-reset" type="button"
      title="Remove every style in this view (filters and hidden cells
 are kept)">Reset styling</button>
    <span class="sb-spring"></span>
    <span class="sb-hint">click a markdown cell or heading to style just
      that one</span>
    <button class="toggle primary" id="sb-done" type="button"
      title="Stop editing this custom view and go back to your notebooks"
      >Done</button>
  </div>
</header>
<!-- the style panel is re-parented to <body> when it opens: the header is
     position:sticky, so a panel inside it would paint behind the page -->
<div class="stylepanel" id="stylepanel" hidden></div>
<nav class="presrail" id="presrail" aria-label="Presentations">
  <div class="presrail-brand">{logo}<span class="prb-full">Junoview</span></div>
  <button class="pr-item pr-docs current" id="pr-docs"
    title="Back to your notebooks — closes the presentation builder">
    <span class="pr-ico"><i data-ic="doc"></i></span>
    <span class="pr-t">Notebooks</span></button>
  <div class="pr-label">presentations</div>
  <div class="pr-list" id="presstrip" role="tablist"></div>
  <!-- custom view FIRST: it is the one that acts on the notebook you are
       already looking at, so it belongs nearest the notebook list -->
  <button class="pr-btn" id="pr-newview"
    title="New custom view &mdash; a saved, restyled, filtered view of the
 notebook itself (not slides). Style all markdown cells, one section or a
 single cell, and keep your filters and hidden cells with it.">
    <span class="pr-ico"><i data-ic="newview"></i></span>
    <span class="pr-t">+ New custom view</span></button>
  <button class="pr-btn" id="pr-new"
    title="Create a new presentation">
    <span class="pr-ico"><i data-ic="newdeck"></i></span>
    <span class="pr-t">+ New presentation</span></button>
  <button class="pr-btn" id="pr-newpost"
    title="Create a new poster &mdash; an A0 portrait page with a poster
 template applied (change size via Page, layout via Layouts)">
    <span class="pr-ico"><i data-ic="newposter"></i></span>
    <span class="pr-t">+ New poster</span></button>
  <button class="pr-btn" id="pr-newfold"
    title="New folder &#8212; drag presentations into it">
    <span class="pr-ico"><svg viewBox="0 0 16 14" width="13"
      height="12" fill="currentColor"><path d="M1 3.2C1 2.5 1.5 2
      2.2 2h3.4l1.5 1.6h6.7c.7 0 1.2.5 1.2 1.2v6c0 .7-.5 1.2-1.2
      1.2H2.2C1.5 12 1 11.5 1 10.8z"/></svg></span>
    <span class="pr-t">+ New folder</span></button>
  <button class="pr-collapse" id="pr-auto" aria-pressed="false"
    title="Auto-hide: the panel slides away and comes back when you move
 the pointer to the left edge. Off by default."
    ><i data-ic="pin"></i></button>
  <button class="pr-collapse" id="pr-collapse"
    title="Collapse this panel">&#171;</button>
</nav>
<button class="presrail-show" id="presrail-show"
  title="Show presentations">&#187;</button>
<!-- Presenting controls: a DOCKED bar (across the top, or down the right),
     never a panel floating over the slide. The real app-bar groups are
     MOVED into #pb-tools on enter and put back on exit, so the top bar is
     literally the same controls you were just using. -->
<div class="present-bar" id="present-bar" hidden>
  <div class="pb-tools" id="pb-tools"></div>
  <div class="pb-own">
    <!-- "Outline" not "Sections": the ribbon already has "Sections: All"
         for filter SCOPE, and two controls called Sections that do
         different things is exactly what confused the user. Tree/Raw are
         NOT duplicated here either — the whole View section travels in. -->
    <button class="toggle" id="pb-rail" aria-pressed="false"
      title="Show or hide the outline (the list of sections) down the left"
      ><i data-ic="outline"></i><span class="btxt">Outline</span></button>
    <!-- the dock button names the DESTINATION, never where the bar is now -->
    <button class="toggle" id="pb-move"
      title="Move these controls to the other edge"
      ><i data-ic="dockright"></i></button>
    <!-- "Auto-hide" names the behaviour; pressed = it is hiding itself -->
    <button class="toggle" id="pb-auto" aria-pressed="true"
      title="Auto-hide: the bar slides away and comes back when you move
 to its edge. Switch it off to keep the bar in place."
      ><i data-ic="pin"></i><span class="btxt">Auto-hide</span></button>
    <button class="toggle pb-exit" id="pb-exit"
      title="Stop presenting and go back to the document (Esc). Nothing is
 closed or lost."><i data-ic="exit"></i>Exit presentation</button>
  </div>
</div>
<!-- ONE button does both fold and unfold, and it never moves: it is
     pinned to the same spot whether the bar is in or out -->
<button class="pb-toggle" id="present-bar-show"
  title="Hide or show the presenting controls" hidden>&#9776;</button>
<div class="docs" id="docs">
{shells}
</div>
<div class="welcome" id="welcome" hidden>
  <div class="welcome-box">
    <div class="welcome-top">
      <div class="welcome-hero">{logo}</div>
      <div class="welcome-wordmark">Junoview</div>
      <p class="welcome-tag">Filter, view and present your Jupyter notebooks.</p>
      <div class="welcome-btns">
        <button class="dbtn primary" id="welcome-open">&#128193; Open
          local files&#8230;</button>
        <button class="dbtn ghost" id="welcome-url">&#128279; From
          GitHub / URL&#8230;</button>
        <button class="dbtn ghost" id="welcome-demo" hidden>&#9654; Try the
          example notebook</button>
      </div>
      <p class="welcome-drop">&hellip; or drop <b>.ipynb</b> files anywhere in
        this window.</p>
      <div class="welcome-links">
        <a href="#" id="welcome-tour">Take a tour</a>
        <span class="wl-sep">&middot;</span>
        <a href="#" id="welcome-help">How to use</a>
        <span class="wl-sep">&middot;</span>
        <a href="{kofi}" target="_blank"
          rel="noopener">Support &#9829;</a>
      </div>
      <div class="recent" id="welcome-recent"></div>
      <div class="welcome-scrollcue" aria-hidden="true">How it works
        &#8595;</div>
    </div>
    <div class="welcome-more">
      <ol class="welcome-steps">
        <li><span class="ws-n">1</span><span>Open your notebooks &mdash; from
          local files or a GitHub URL.</span></li>
        <li><span class="ws-n">2</span><span>Filter by cell type, and trace
          back every cell that builds a plot.</span></li>
        <li><span class="ws-n">3</span><span>Build presentations from figures,
          markdown and code straight out of the notebook.</span></li>
        <li><span class="ws-n">4</span><span>Hit refresh to pull the notebook's
          latest changes into your slides &mdash; automatically.</span></li>
      </ol>
    </div>
  </div>
</div>
<div class="helpdlg" id="helpdlg" hidden>
  <div class="help-box">
    <div class="help-head">
      <span class="help-title">How to use</span>
      <span class="deck-spring"></span>
      <button class="dbtn" id="help-tour" title="Take the guided tour">&#9654;
        Take a tour</button>
      <button class="dbtn" id="help-close" title="Close">&#10005;</button>
    </div>
    <div class="help-body">
      {help_html}
    </div>
  </div>
</div>
<div class="tour" id="tour" hidden>
  <div class="tour-hole" id="tour-hole"></div>
  <div class="tour-tip" id="tour-tip">
    <div class="tour-tip-h">
      <span class="tour-step" id="tour-step"></span>
      <span class="tour-title" id="tour-title"></span>
    </div>
    <div class="tour-text" id="tour-text"></div>
    <div class="tour-btns">
      <button class="tour-skip" id="tour-skip">Skip tour</button>
      <span class="deck-spring"></span>
      <button id="tour-back">Back</button>
      <button class="tour-next" id="tour-next">Next</button>
    </div>
  </div>
</div>
<div class="opendlg" id="opendlg" hidden>
  <div class="odlg-box">
    <div class="odlg-head">
      <button class="dbtn" id="odlg-up" title="Parent folder">&#8593; Up</button>
      <span class="odlg-path" id="odlg-path"></span>
      <button class="dbtn" id="odlg-files" hidden>Choose
        files&#8230;</button>
      <button class="dbtn" id="odlg-close" title="Close">&#10005;</button>
    </div>
    <div class="odlg-recent" id="odlg-recent" hidden></div>
    <div class="odlg-list" id="odlg-list"></div>
    <div class="odlg-foot">
      <div class="odlg-inrow">
        <input id="odlg-input" type="text" spellcheck="false"
          autocomplete="off"
          placeholder="&#8230;or paste a folder or .ipynb path">
        <button class="dbtn" id="odlg-go"
          title="Open the path or URL typed on the left">Open</button>
      </div>
      <div class="odlg-load" id="odlg-load" hidden><span></span></div>
    </div>
  </div>
</div>
<div class="drophint" id="drophint" hidden>Drop .ipynb files to open</div>
<div class="figmax" id="figmax" hidden>
  <button class="figmax-close" id="figmax-close"
    title="Close (Esc)">&#10005; Close</button>
  <div class="figmax-box" id="figmax-box"></div>
</div>
<div class="ckfilter-menu" id="ck-filter-menu" hidden></div>
<div class="ckfilter-menu" id="ot-filter-menu" hidden></div>
<div class="ckfilter-menu" id="pt-filter-menu" hidden></div>
<div class="ckfilter-menu scope-menu" id="sec-scope-menu" hidden></div>
<div class="note-dlg" id="note-dlg" hidden>
  <div class="note-dlg-box">
    <div class="note-dlg-h">Add a markdown note</div>
    <div class="note-dlg-sub" id="note-dlg-sub"></div>
    <textarea id="note-dlg-src" rows="6" spellcheck="true"
      placeholder="Write markdown &mdash; a comment, an interpretation, a
 TODO&#8230;"></textarea>
    <label class="note-dlg-git" id="note-dlg-gitrow" hidden>
      <input type="checkbox" id="note-dlg-commit">
      <span id="note-dlg-gitlab">also commit to git</span>
    </label>
    <div class="note-dlg-btns">
      <span class="note-dlg-err" id="note-dlg-err"></span>
      <button class="dbtn" id="note-dlg-cancel">Cancel</button>
      <button class="dbtn primary" id="note-dlg-save">Save to
 notebook</button>
    </div>
  </div>
</div>
<div class="doc-toast" id="doc-toast" hidden></div>
<input type="file" id="fileinput" accept=".ipynb" multiple hidden>
<input type="file" id="deckfile" accept=".junoview,.json" hidden>
{deck_shell}
<script type="application/json" id="app-data">{app_data}</script>
<script>{js}</script>
<script>{deck_js}</script>
</body>
</html>
"""


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def load_doc(path: Path, title: str | None = None,
             deck_path: Path | None = None) -> Document:
    """Parse one notebook file into a Document, with its presentations.

    Deck priority: explicit deck_path > <notebook>.deck.json sidecar >
    embedded metadata (parse_notebook already loaded that).
    """
    nb = json.loads(path.read_text(encoding="utf-8"))
    doc = parse_notebook(nb, title=title)
    doc.source_name = path.stem
    if deck_path is None:
        # a deck saved from the browser lands next to the notebook as
        # <stem>.junoview; the older <stem>.deck.json still works
        for suffix in (".junoview", ".deck.json"):
            sidecar = path.with_suffix(suffix)
            if sidecar.exists():
                deck_path = sidecar
                break
    if deck_path is not None:
        pres = _as_presentations(
            json.loads(Path(deck_path).read_text(encoding="utf-8")))
        if pres:
            doc.presentations = pres
    return doc


def render_notebook_file(path: Path, title: str | None = None,
                         deck_path: Path | None = None) -> str:
    return render_html(load_doc(path, title=title, deck_path=deck_path))


def embed_deck(nb_path: Path, deck_path: Path) -> None:
    """Write presentations JSON into metadata.semantic.presentations."""
    pres = _as_presentations(
        json.loads(deck_path.read_text(encoding="utf-8")))
    if not pres:
        raise SystemExit(f"error: {deck_path} does not look like saved "
                         "presentations (expected {'presentations': [...]})")
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    sem = nb.setdefault("metadata", {}).setdefault("semantic", {})
    sem["presentations"] = pres
    sem.pop("deck", None)
    nb_path.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")


# --------------------------------------------------------------------------
# Notebooks by URL (GitHub links are normalized to their raw form)
# --------------------------------------------------------------------------

_GH_BLOB_RE = re.compile(
    r"^https?://github\.com/([^/]+)/([^/]+)/(?:blob|raw)/(.+)$")


def _is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def _normalize_nb_url(url: str) -> str:
    url = url.strip()
    m = _GH_BLOB_RE.match(url)
    if m:
        return ("https://raw.githubusercontent.com/"
                f"{m.group(1)}/{m.group(2)}/{m.group(3)}")
    return url


def _cache_bust(url: str) -> str:
    """GitHub's raw CDN caches files for minutes — a fresh query param makes
    a new cache key, so a refresh sees the latest commit immediately."""
    host = urllib.parse.urlsplit(url).netloc.lower()
    if host.endswith("githubusercontent.com"):
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}jvr={int(time.time())}"
    return url


def _fetch_notebook_url(url: str) -> tuple[str, dict]:
    """Download a notebook from a URL; returns (filename, nb dict)."""
    url = _normalize_nb_url(url)
    req = urllib.request.Request(
        _cache_bust(url), headers={"User-Agent": "semantic-render",
                                   "Cache-Control": "no-cache",
                                   "Pragma": "no-cache"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    nb = json.loads(data.decode("utf-8"))
    if not isinstance(nb, dict) or "cells" not in nb:
        raise ValueError(f"{url} does not look like a notebook")
    name = urllib.parse.unquote(
        urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1]) \
        or "notebook.ipynb"
    return name, nb


def doc_from_url(url: str) -> Document:
    name, nb = _fetch_notebook_url(url)
    doc = parse_notebook(nb)
    doc.source_name = re.sub(r"\.ipynb$", "", name, flags=re.I) \
        or "notebook"
    return doc


# --------------------------------------------------------------------------
# Web build -- the same tool as a static, fully client-side page (Python
# runs in the browser via Pyodide). Safe to publish: no server, notebooks
# never leave the visitor's machine.
# --------------------------------------------------------------------------

def web_parse(name: str, text: str, taken_json: str = "[]") -> str:
    """Bridge for the Pyodide build: notebook JSON text -> shell HTML."""
    nb = json.loads(text)
    doc = parse_notebook(nb)
    base = re.sub(r"\.ipynb$", "", str(name), flags=re.I) or "notebook"
    taken = set(json.loads(taken_json))
    stem, n = base, 1
    while stem in taken:
        n += 1
        stem = f"{base}-{n}"
    doc.source_name = stem
    return render_shell(doc)


def build_web(outdir: Path) -> None:
    """Write a deployable static web app (index.html + this module)."""
    outdir.mkdir(parents=True, exist_ok=True)
    loader = _WEB_LOADER.replace(
        "<title>", f'<link rel="icon" href="{_FAVICON}">\n<title>', 1)
    (outdir / "index.html").write_text(loader, encoding="utf-8")
    (outdir / "semantic_render.py").write_text(
        Path(__file__).read_text(encoding="utf-8"), encoding="utf-8")
    (outdir / ".nojekyll").write_text("", encoding="utf-8")
    # bundle the example so "Try the example notebook" works same-origin
    example = Path(__file__).parent / "example_climate_analysis.ipynb"
    if example.exists():
        (outdir / "example_climate_analysis.ipynb").write_bytes(
            example.read_bytes())
        # also render an INSTANT static demo (no Pyodide load, no install) —
        # a hosted, clickable "live demo above the fold"
        try:
            doc = parse_notebook(json.loads(
                example.read_text(encoding="utf-8")))
            doc.source_name = "example_climate_analysis"
            (outdir / "example_climate_analysis.html").write_text(
                render_page([doc], mode="static"), encoding="utf-8")
        except Exception:
            pass


_WEB_LOADER = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Junoview &mdash; presentations from Jupyter</title>
<meta name="description" content="Streamline presentations from
 Jupyter. Display your plots and documentation - figure-first notebook
 viewing and slide decks, entirely in your browser.">
<meta property="og:title" content="Junoview">
<meta property="og:description" content="Streamline presentations from
 Jupyter. Display your plots and documentation.">
<meta property="og:type" content="website">
<style>
  body{margin:0;background:#0a141d;color:#cdd9e3;
    font-family:ui-monospace,Menlo,Consolas,monospace;display:flex;
    align-items:center;justify-content:center;min-height:100vh;}
  .boot{text-align:center;max-width:420px;padding:30px;}
  .boot h1{font-size:14px;letter-spacing:.22em;text-transform:uppercase;
    color:#39a9c0;font-weight:600;}
  .boot p{font-size:12.5px;line-height:1.7;color:#7e93a4;}
  .bar{height:3px;background:#16273a;border-radius:3px;overflow:hidden;
    margin-top:18px;}
  .bar i{display:block;height:100%;width:30%;background:#39a9c0;
    border-radius:3px;animation:sl 1.2s ease-in-out infinite alternate;}
  @keyframes sl{from{margin-left:0}to{margin-left:70%}}
</style>
</head>
<body>
<div class="boot" id="boot">
  <h1>Junoview</h1>
  <p id="bootmsg">Loading the Python runtime (first visit only takes a
  few seconds)&#8230;</p>
  <div class="bar"><i></i></div>
</div>
<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
<script>
(async function(){
  var msg=document.getElementById('bootmsg');
  function say(t){if(msg) msg.textContent=t;}
  try{
    var py=await loadPyodide();
    say('Loading the renderer…');
    var src=await (await fetch('semantic_render.py')).text();
    py.FS.writeFile('semantic_render.py',src);
    py.runPython('import semantic_render as sr');
    var page=py.runPython('sr.render_page([], mode="web")');
    document.open();document.write(page);document.close();
    window.semPy={
      parse:function(name,text,taken){
        py.globals.set('_wname',String(name));
        py.globals.set('_wtext',text);
        py.globals.set('_wtaken',JSON.stringify(taken||[]));
        return py.runPython('sr.web_parse(_wname,_wtext,_wtaken)');
      }
    };
    document.dispatchEvent(new Event('sem:pyready'));
  }catch(e){
    say('Failed to start: '+(e&&e.message?e.message:e)
      +' — check your connection and reload.');
  }
})();
</script>
</body>
</html>
"""


# --------------------------------------------------------------------------
# Local app server -- the GUI: open notebooks as browser tabs, build
# cross-notebook presentations, everything saved in semantic_project.json
# --------------------------------------------------------------------------

_PROJECT_FILE = "junoview_project.json"


def _stem_for(path: Path, taken: set[str]) -> str:
    base = path.stem or "notebook"
    stem, n = base, 1
    while stem in taken:
        n += 1
        stem = f"{base}-{n}"
    return stem


class _AppState:
    """Project file + open-tab session, shared across requests."""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.token = secrets.token_hex(8)
        self.lock = threading.Lock()
        self.presentations: list = []
        self.open: list[str] = []
        self.recent: list[str] = []
        self._load()

    @property
    def project_path(self) -> Path:
        return self.root / _PROJECT_FILE

    def _load(self) -> None:
        path = self.project_path
        if not path.exists():
            # load older project files if present (migrate to the new name on
            # the next save): the former plotline_ name, then the original
            for legacy_name in ("plotline_project.json", "semantic_project.json"):
                legacy = self.root / legacy_name
                if legacy.exists():
                    path = legacy
                    break
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        if not isinstance(d, dict):
            return
        self.presentations = _as_presentations(d.get("presentations"))
        for name in ("open", "recent"):
            v = d.get(name)
            setattr(self, name,
                    [str(x) for x in v if isinstance(x, str)]
                    if isinstance(v, list) else [])

    def _write(self) -> None:
        self.project_path.write_text(
            json.dumps({"presentations": self.presentations,
                        "open": self.open, "recent": self.recent},
                       indent=1, ensure_ascii=False) + "\n",
            encoding="utf-8")

    def note_open(self, path: "Path | str") -> None:
        with self.lock:
            s = str(path)
            if s not in self.open:
                self.open.append(s)
            self.recent = ([s] + [r for r in self.recent if r != s])[:10]
            self._write()

    def note_close(self, path: str) -> None:
        with self.lock:
            self.open = [p for p in self.open if p != path]
            self._write()

    def save_presentations(self, pres: list) -> None:
        with self.lock:
            self.presentations = pres
            self._write()

    def stems_taken(self, skip: Path | None = None,
                    skip_str: str | None = None) -> set[str]:
        """Deduped stems of the open tabs (mirrors the page-build order)."""
        taken: set[str] = set()
        for p in self.open:
            if skip is not None and not _is_url(p) and Path(p) == skip:
                continue
            if skip_str is not None and p == skip_str:
                continue
            taken.add(_stem_for(Path(p), taken))
        return taken


def _list_dir(raw: str) -> dict:
    d = Path(raw).expanduser()
    if not d.is_dir():
        raise FileNotFoundError(f"{d} is not a folder")
    d = d.resolve()
    dirs, nbs = [], []
    try:
        entries = sorted(d.iterdir(), key=lambda p: p.name.lower())
    except OSError:
        entries = []
    for p in entries:
        name = p.name
        if name.startswith(".") or name == "__pycache__":
            continue
        try:
            if p.is_dir():
                dirs.append({"name": name, "path": str(p)})
            elif p.suffix.lower() == ".ipynb":
                kb = max(1, p.stat().st_size // 1024)
                nbs.append({"name": name, "path": str(p), "size": f"{kb} KB"})
        except OSError:
            continue
    parent = str(d.parent) if d.parent != d else ""
    return {"dir": str(d), "parent": parent, "dirs": dirs, "notebooks": nbs}


def _app_page(state: _AppState) -> str:
    """Rebuild the whole app page from the session's open notebooks."""
    docs, paths, taken, pruned = [], {}, set(), []
    for p in list(state.open):
        if _is_url(p):
            try:
                doc = doc_from_url(p)
            except Exception:       # noqa: BLE001 -- likely transient
                continue            # keep the URL in the session
            doc.source_name = _stem_for(
                Path(doc.source_name + ".ipynb"), taken)
            taken.add(doc.source_name)
            paths[doc.source_name] = p
            docs.append(doc)
            continue
        f = Path(p)
        try:
            doc = load_doc(f)
        except (OSError, ValueError):
            pruned.append(p)
            continue
        doc.source_name = _stem_for(f, taken)
        taken.add(doc.source_name)
        paths[doc.source_name] = str(f)
        docs.append(doc)
    if pruned:                      # notebooks meanwhile deleted / moved
        with state.lock:
            state.open = [p for p in state.open if p not in pruned]
            state._write()
    return render_page(docs, mode="app", app_cfg={
        "token": state.token,
        "root": str(state.root),
        "presentations": state.presentations,
        "recent": state.recent,
        "paths": paths,
    })


def _new_cell_id() -> str:
    return secrets.token_hex(4)


def insert_note_cell(nb: dict, after_anchor: str,
                     source: str) -> tuple[dict, int, str]:
    """Insert a markdown cell into notebook JSON right after the cell(s)
    that render the card `after_anchor` (append at the end when the anchor
    is empty or unknown). Pure — file IO stays with the caller.
    Returns (nb, insert_index, new_cell_id)."""
    cells = nb.setdefault("cells", [])
    idx = len(cells)                       # default: append at the end
    if after_anchor:
        doc = parse_notebook(nb)
        target = None
        for sec in doc.sections:
            for it in sec.items:
                if (it.anchor or it.item_id) == after_anchor:
                    target = it
                    break
            if target:
                break
        if target is not None:
            if target.members:             # code card: after its LAST cell
                idx = max(m["idx"] for m in target.members) + 1
            elif target.anchor.startswith("cell:"):   # a markdown note
                cid = target.anchor[5:]
                for i, c in enumerate(cells):
                    if str(c.get("id") or "") == cid:
                        idx = i + 1
                        break
    new_id = _new_cell_id()
    cells.insert(idx, {"cell_type": "markdown", "id": new_id,
                       "metadata": {}, "source": source})
    return nb, idx, new_id


def _versions_dir(f: Path) -> Path:
    return f.parent / ".junoview_versions" / f.stem


def _store_version(f: Path, cap: int = 25) -> None:
    """Automatic notebook snapshots: every open / reload keeps a copy
    (deduped by content, capped) so earlier runs stay reachable from the
    tab's Versions menu. Never allowed to block an open."""
    try:
        data = f.read_bytes()
        h = hashlib.sha1(data).hexdigest()[:10]
        d = _versions_dir(f)
        d.mkdir(parents=True, exist_ok=True)
        # a self-ignoring snapshot store: our own bookkeeping must never
        # show up as untracked noise in the user's `git status`
        gi = d.parent / ".gitignore"
        if not gi.exists():
            gi.write_text("*\n", encoding="utf-8")
        vers = sorted(d.glob("*.ipynb"))
        if vers and vers[-1].stem.rsplit("_", 1)[-1] == h:
            return                      # unchanged since the last snapshot
        stamp = time.strftime("%Y%m%d-%H%M%S")
        (d / f"{stamp}_{h}.ipynb").write_bytes(data)
        vers = sorted(d.glob("*.ipynb"))
        for old in vers[:-cap]:
            old.unlink()
    except Exception:
        pass


def _github_web_url(remote: str) -> str:
    """git remote -> the repo's web URL (GitHub only; '' otherwise)."""
    m = re.match(r"(?:git@github\.com:|https?://github\.com/)"
                 r"([^/\s]+/[^/\s]+?)(?:\.git)?/?$", (remote or "").strip())
    return f"https://github.com/{m.group(1)}" if m else ""


def _git_run(f: Path, *args) -> "subprocess.CompletedProcess":
    # explicit utf-8: git speaks utf-8, but text=True alone would decode
    # with the locale (cp1252 on Windows) and a single curly quote or
    # emoji in a commit message would blow up the whole read
    return subprocess.run(["git", "-C", str(f.parent), *args],
                          capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=15)


def _git_info(f: Path) -> dict:
    """Is this file inside a git work tree, and where does it push to?"""
    try:
        top = _git_run(f, "rev-parse", "--is-inside-work-tree")
        if top.returncode != 0 or top.stdout.strip() != "true":
            return {"repo": False}
        rem = _git_run(f, "config", "--get", "remote.origin.url")
        remote = rem.stdout.strip() if rem.returncode == 0 else ""
        br = _git_run(f, "rev-parse", "--abbrev-ref", "HEAD")
        branch = br.stdout.strip() if br.returncode == 0 else ""
        return {"repo": True, "remote": remote, "branch": branch,
                "github": _github_web_url(remote)}
    except Exception:
        return {"repo": False}


def _git_file_log(f: Path, n: int = 25) -> list:
    """Commits touching this notebook: [{id, msg, date, path}], newest
    first. --name-only records the file's path AT EACH COMMIT, so commits
    from before a rename stay openable."""
    try:
        r = _git_run(f, "log", "--follow", "--name-only", "-n", str(n),
                     "--format=%h%x1f%s%x1f%ad",
                     "--date=format:%d %b %Y · %H:%M", "--", str(f))
        if r.returncode != 0:
            return []
        out: list = []
        for line in r.stdout.splitlines():
            if "\x1f" in line:
                parts = line.split("\x1f")
                # a literal 0x1f in the subject shifts fields: the date is
                # always the LAST part, the message everything between
                out.append({"id": parts[0],
                            "msg": "\x1f".join(parts[1:-1]),
                            "date": parts[-1] if len(parts) > 2 else "",
                            "path": ""})
            elif line.strip() and out and not out[-1]["path"]:
                out[-1]["path"] = line.strip()
        return out
    except Exception:
        return []


def _git_show_notebook(f: Path, commit: str) -> dict:
    """The notebook's JSON as it was at COMMIT (git show hash:relpath).
    Bytes + explicit utf-8 — text mode would decode with the locale."""
    top = _git_run(f, "rev-parse", "--show-toplevel")
    if top.returncode != 0:
        raise ValueError("not in a git repository")
    rel = f.resolve().relative_to(
        Path(top.stdout.strip()).resolve()).as_posix()
    # a renamed notebook lived under a DIFFERENT path in old commits —
    # use the path git recorded for that commit when we have it
    for e in _git_file_log(f, 100):
        if e["id"] == commit and e.get("path"):
            rel = e["path"]
            break
    r = subprocess.run(
        ["git", "-C", str(f.parent), "show", f"{commit}:{rel}"],
        capture_output=True, timeout=20)
    if r.returncode != 0:
        raise FileNotFoundError(
            r.stderr.decode("utf-8", "replace").strip()[:200]
            or "commit not found")
    nb = json.loads(r.stdout.decode("utf-8"))
    if not isinstance(nb, dict) or "cells" not in nb:
        raise ValueError("that commit's file is not a notebook")
    return nb


def _git_commit_file(f: Path, message: str) -> dict:
    """Stage + commit ONE file; returns {ok, sha, url} or {ok, error}."""
    try:
        add = _git_run(f, "add", "--", str(f))
        if add.returncode != 0:
            return {"ok": False,
                    "error": (add.stderr or add.stdout).strip()[:400]}
        com = _git_run(f, "commit", "-m", message, "--", str(f))
        if com.returncode != 0:
            return {"ok": False,
                    "error": (com.stdout + com.stderr).strip()[:400]}
        sha = _git_run(f, "rev-parse", "--short", "HEAD").stdout.strip()
        gh = _git_info(f).get("github") or ""
        return {"ok": True, "sha": sha,
                "url": f"{gh}/commit/{sha}" if gh else ""}
    except Exception as e:                  # noqa: BLE001 -- surfaced in UI
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


def _make_handler(state: _AppState):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):       # keep the terminal quiet
            pass

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj: Any, code: int = 200) -> None:
            self._send(code,
                       json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                       "application/json; charset=utf-8")

        def _html(self, text: str, code: int = 200) -> None:
            self._send(code, text.encode("utf-8"),
                       "text/html; charset=utf-8")

        def _authed(self, query: dict) -> bool:
            tok = (query.get("t") or [""])[0]
            return secrets.compare_digest(tok, state.token)

        def do_GET(self):
            url = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(url.query)
            if url.path == "/":
                if not self._authed(query):
                    self._html("<h1>Junoview</h1>"
                               "<p>Open the exact URL printed in the "
                               "terminal (it carries a session token).</p>",
                               403)
                    return
                self._html(_app_page(state))
                return
            if not self._authed(query):
                self._json({"error": "bad token"}, 403)
                return
            try:
                if url.path == "/api/list":
                    raw = (query.get("dir") or [""])[0] or str(state.root)
                    self._json(_list_dir(raw))
                else:
                    self._json({"error": "not found"}, 404)
            except FileNotFoundError as e:
                self._json({"error": str(e)}, 404)
            except Exception as e:          # noqa: BLE001 -- surfaced in UI
                self._json({"error": f"{type(e).__name__}: {e}"}, 400)

        def do_POST(self):
            url = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(url.query)
            if not self._authed(query):
                self._json({"error": "bad token"}, 403)
                return
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError("expected a JSON object")
            except ValueError:
                self._json({"error": "bad JSON body"}, 400)
                return
            try:
                if url.path == "/api/open":
                    self._json(self._open_nb(body))
                elif url.path == "/api/parse":
                    self._json(self._parse_nb(body))
                elif url.path == "/api/save":
                    state.save_presentations(
                        _as_presentations(body.get("presentations")))
                    self._json({"ok": True})
                elif url.path == "/api/close":
                    state.note_close(str(body.get("path") or ""))
                    self._json({"ok": True})
                elif url.path == "/api/addnote":
                    self._json(self._add_note(body))
                elif url.path == "/api/gitstate":
                    self._json(self._git_state(body))
                elif url.path == "/api/versions":
                    self._json(self._versions(body))
                elif url.path == "/api/openversion":
                    self._json(self._open_version(body))
                elif url.path == "/api/versioncards":
                    self._json(self._version_cards(body))
                else:
                    self._json({"error": "not found"}, 404)
            except FileNotFoundError as e:
                self._json({"error": str(e)}, 404)
            except Exception as e:          # noqa: BLE001 -- surfaced in UI
                self._json({"error": f"{type(e).__name__}: {e}"}, 400)

        def _open_nb(self, body: dict) -> dict:
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw:
                raise ValueError("no path given")
            # "stem" = load this INTO an open tab (another version of the
            # same notebook): keep its name and leave the recent list alone
            into = str(body.get("stem") or "").strip()
            if _is_url(raw):
                url = _normalize_nb_url(raw)
                doc = doc_from_url(url)
                if into:
                    doc.source_name = into
                else:
                    doc.source_name = _stem_for(
                        Path(doc.source_name + ".ipynb"),
                        state.stems_taken(skip_str=url))
                    state.note_open(url)
                return {"stem": doc.source_name, "path": url,
                        "shell": render_shell(doc, path=url)}
            f = Path(raw).expanduser()
            if not f.is_absolute():
                f = state.root / f
            f = f.resolve()
            if not f.exists():
                raise FileNotFoundError(f"{f} not found")
            if f.suffix.lower() != ".ipynb":
                raise ValueError(f"{f.name} is not a .ipynb file")
            _store_version(f)   # every open/reload keeps a snapshot
            doc = load_doc(f)
            if into:
                doc.source_name = into
            else:
                doc.source_name = _stem_for(f, state.stems_taken(skip=f))
                state.note_open(f)
            return {"stem": doc.source_name, "path": str(f),
                    "shell": render_shell(doc, path=str(f))}

        def _resolve_nb_path(self, raw: str) -> Path:
            f = Path(raw).expanduser()
            if not f.is_absolute():
                f = state.root / f
            f = f.resolve()
            if not f.exists():
                raise FileNotFoundError(f"{f} not found")
            if f.suffix.lower() != ".ipynb":
                raise ValueError(f"{f.name} is not a .ipynb file")
            return f

        def _add_note(self, body: dict) -> dict:
            """Insert a markdown note cell into the .ipynb on disk (after the
            card the user clicked), optionally git-commit it, and hand back a
            freshly rendered shell."""
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw:
                raise ValueError("no path given")
            if _is_url(raw):
                raise ValueError("this notebook was opened from a URL — "
                                 "notes can only be saved to a local file")
            src = str(body.get("source") or "").strip()
            if not src:
                raise ValueError("the note is empty")
            f = self._resolve_nb_path(raw)
            _store_version(f)   # keep the pre-note state reachable
            nb = json.loads(f.read_text(encoding="utf-8"))
            nb, idx, cell_id = insert_note_cell(
                nb, str(body.get("after") or ""), src)
            f.write_text(json.dumps(nb, ensure_ascii=False, indent=1) + "\n",
                         encoding="utf-8")
            git = _git_info(f)
            if body.get("commit") and git.get("repo"):
                first = src.splitlines()[0][:60]
                git["commit"] = _git_commit_file(
                    f, str(body.get("message") or "") or f"Note: {first}")
            doc = load_doc(f)
            doc.source_name = _stem_for(f, state.stems_taken(skip=f))
            return {"stem": doc.source_name, "path": str(f),
                    "cell": cell_id, "index": idx, "git": git,
                    "shell": render_shell(doc, path=str(f))}

        def _git_state(self, body: dict) -> dict:
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw or _is_url(raw):
                return {"repo": False}
            f = self._resolve_nb_path(raw)
            info = _git_info(f)
            if info.get("repo"):
                log = _git_file_log(f, 1)
                if log:            # the commit a figure LOCK binds to
                    info["commit"] = log[0]
            return info

        def _version_cards(self, body: dict) -> dict:
            """Render SPECIFIC cards from a git version of a notebook —
            locked deck frames fetch these without touching the tab."""
            raw = str(body.get("path") or "").strip().strip('"')
            commit = str(body.get("commit") or "")
            anchors = [str(x) for x in (body.get("anchors") or [])
                       if isinstance(x, str)][:200]
            if not re.fullmatch(r"[0-9a-fA-F]{4,40}", commit):
                raise ValueError("bad commit id")
            f = self._resolve_nb_path(raw)
            nb = _git_show_notebook(f, commit)
            doc = parse_notebook(nb)
            by_anchor = {}
            for sec in doc.sections:
                for it in sec.items:
                    by_anchor[it.anchor or it.item_id] = it
            cards = {}
            for an in anchors:
                it = by_anchor.get(an)
                cards[an] = ({"html": render_item(it), "title": it.title}
                             if it is not None else None)
            meta = next((e for e in _git_file_log(f, 100)
                         if e["id"] == commit), {})
            return {"commit": commit, "msg": meta.get("msg", ""),
                    "date": meta.get("date", ""), "cards": cards}

        def _versions(self, body: dict) -> dict:
            raw = str(body.get("path") or "").strip().strip('"')
            if not raw or _is_url(raw):
                return {"versions": []}
            f = self._resolve_nb_path(raw)
            out = []
            for v in sorted(_versions_dir(f).glob("*.ipynb"),
                            reverse=True):
                stamp = v.stem.split("_", 1)[0]
                try:
                    label = time.strftime(
                        "%d %b %Y · %H:%M:%S",
                        time.strptime(stamp, "%Y%m%d-%H%M%S"))
                except ValueError:
                    label = v.stem
                out.append({"id": v.name, "label": label})
            git = _git_info(f)
            commits = _git_file_log(f) if git.get("repo") else []
            return {"versions": out, "commits": commits}

        def _open_version(self, body: dict) -> dict:
            """Render an earlier snapshot OR a git commit's notebook INTO
            the notebook's tab (same stem + path, so deck refs keep
            resolving); ↻ returns to live."""
            raw = str(body.get("path") or "").strip().strip('"')
            vid = str(body.get("id") or "")
            commit = str(body.get("commit") or "")
            if commit:
                if not re.fullmatch(r"[0-9a-fA-F]{4,40}", commit):
                    raise ValueError("bad commit id")
                fc = self._resolve_nb_path(raw)
                nbc = _git_show_notebook(fc, commit)
                doc = parse_notebook(nbc)
                doc.source_name = _stem_for(
                    fc, state.stems_taken(skip=fc))
                return {"stem": doc.source_name, "path": str(fc),
                        "version": "git:" + commit,
                        "shell": render_shell(doc, path=str(fc))}
            if not re.fullmatch(r"[\w.\-]+\.ipynb", vid):
                raise ValueError("bad version id")
            f = self._resolve_nb_path(raw)
            vd = _versions_dir(f).resolve()
            vf = (vd / vid).resolve()
            if vf.parent != vd or not vf.exists():
                raise FileNotFoundError("version not found")
            doc = load_doc(vf)
            doc.source_name = _stem_for(f, state.stems_taken(skip=f))
            return {"stem": doc.source_name, "path": str(f),
                    "version": vid,
                    "shell": render_shell(doc, path=str(f))}

        def _parse_nb(self, body: dict) -> dict:
            nb = body.get("nb")
            if isinstance(nb, str):
                nb = json.loads(nb)
            if not isinstance(nb, dict):
                raise ValueError("nb must be notebook JSON")
            name = str(body.get("name") or "notebook.ipynb")
            base = re.sub(r"\.ipynb$", "", name, flags=re.I) or "notebook"
            doc = parse_notebook(nb)
            doc.source_name = _stem_for(Path(base + ".ipynb"),
                                        state.stems_taken())
            return {"stem": doc.source_name, "path": "",
                    "shell": render_shell(doc)}

    return Handler


def run_app(root: Path, notebooks: list, port: int = 8765,
            open_browser: bool = True) -> int:
    state = _AppState(root)
    for nb in notebooks:
        if isinstance(nb, str) and _is_url(nb):
            state.note_open(_normalize_nb_url(nb))
            continue
        f = Path(nb).expanduser().resolve()
        if f.exists():
            state.note_open(f)
        else:
            print(f"warning: {nb} not found, skipping", file=sys.stderr)
    handler = _make_handler(state)
    try:
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:                 # port busy -> any free port
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/?t={state.token}"
    print("Junoview")
    print(f"  url:     {url}")
    print(f"  project: {state.project_path}")
    print("  Open notebooks with '+ Open' or drop .ipynb files onto the "
          "page. Ctrl+C stops the app.")
    if open_browser:
        threading.Timer(0.4, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()
    return 0


def _self_test() -> None:
    """Tiny built-in notebook so the renderer can be checked with no input."""
    nb = {
        "metadata": {"semantic": {"presentations": [
            {"name": "demo", "slides": [
                {"layout": "halves", "panes": ["clim", "cell:md1"]},
            ]},
        ]}},
        "cells": [
            {"cell_type": "markdown", "source": "# Demo analysis"},
            {"cell_type": "markdown", "source": "## Dataset"},
            {"cell_type": "markdown", "id": "md1",
             "source": "The anomaly is $z' = z - \\bar{z}$.\n\n- point one\n- point **two**"},
            {"cell_type": "code", "id": "c-load",
             "source": "#| display: metric\n#| id: load\n#| title: Load grid\nprint('shape (40, 80)')",
             "outputs": [{"output_type": "stream", "name": "stdout",
                          "text": "shape (40, 80)\n"}]},
            {"cell_type": "code", "id": "c-clim",
             "source": "#| display: figure\n#| id: clim\n#| depends: load\n#| title: Climatology\n#| caption: Note the ridge.\nplot()",
             "outputs": []},
            {"cell_type": "code", "id": "c-mixed",
             "source": "#| id: mixed\n#| title: Repr then plot\nds",
             "outputs": [
                 {"output_type": "display_data",
                  "data": {"text/html": "<div class='xr-a'>xarray</div>"}},
                 {"output_type": "display_data",
                  "data": {"image/png": "aGk="}}]},
            {"cell_type": "code", "id": "c-prep",
             "source": "#| title: Open dataset\nds = open_thing()",
             "outputs": []},
            {"cell_type": "code", "id": "c-fig2",
             "source": "#| display: figure\n#| id: fig2\n#| title: Second figure\nplot(ds)",
             "outputs": []},
            {"cell_type": "code", "id": "c-two",
             "source": "#| display: figure\n#| id: two\n#| title: Two panels\nplot(); plot()",
             "outputs": [
                 {"output_type": "display_data",
                  "data": {"image/png": "aGk="}},
                 {"output_type": "display_data",
                  "data": {"image/png": "aGk="}}]},
            {"cell_type": "code", "id": "c-fn",
             "source": "def rescale(arr):\n    return arr / arr.max()",
             "outputs": []},
            {"cell_type": "code", "id": "c-one",
             "source": "result = rescale(data)",
             "outputs": []},
            {"cell_type": "markdown", "id": "md-html",
             "source": "<h1 style='color:cyan'> Universal </h1>\n\n"
                       "plain paragraph\n\n"
                       "<div style='color:cyan'>styled block</div>\n\n"
                       "<script>alert(1)</script>\n\n"
                       "<a href='javascript:alert(2)'>x</a>"},
        ]
    }
    doc = parse_notebook(nb)
    out = render_html(doc, source_name="demo")
    assert "Demo analysis" in out and "Climatology" in out and "provsvg" in out
    # presentation plumbing, incl. legacy single-deck conversion
    assert doc.presentations and doc.presentations[0]["name"] == "demo"
    assert doc.presentations[0]["slides"][0]["panes"] == ["clim", "cell:md1"]
    legacy = _as_presentations({"slides": [
        {"kind": "card", "anchor": "a", "beside": ["b"]}]})
    assert legacy[0]["slides"][0] == {"layout": "halves", "panes": ["a", "b"]}
    assert '"panes": ["clim", "cell:md1"]' in out
    assert 'class="nb-data"' in out and 'id="app-data"' in out
    assert 'id="presstrip"' in out and 'id="tv-markdown"' in out
    assert 'id="pr-docs"' in out and 'id="pr-new"' in out
    assert 'id="deck-docs"' in out
    # the redundant builder "Close" is gone (presrail Notebooks handles it)
    # rail radio model: a presentation row lights up ONLY while its deck is
    # open; the Notebooks button is a bordered button with the SAME active
    # style (no stale half-highlight after going back to the notebooks)
    assert '<span class="pr-t">Notebooks</span>' in out
    assert "isCur&&editing?' current editing'" in out
    assert ".pr-item.current{background:var(--cyan-deep)" in out
    assert ".pr-docs{margin-bottom:6px;border:1px solid" in out
    # SNAP-TO-ALIGN: dragging/resizing snaps edges + centers to the canvas
    # and other objects, with dashed guide lines; Alt disables; aspect-locked
    # figures snap width and let height follow the plot ratio
    assert "function snapTargets" in out and "function bestSnap" in out
    assert "function drawSnapGuides" in out and "ev.altKey" in out
    assert ".snapline.snap-v" in out and ".snapline.snap-h" in out
    # PAGE SIZE / POSTER: a per-presentation preset (16:9, 4:3, A4-A0) —
    # one builder for slides AND posters; zoom while editing; the preset
    # survives JS normPres and the Python save path; PDF exports at size
    assert "var PAGE_PRESETS" in out and 'id="page-btn"' in out
    assert "--page-ar" in out and "function applyZoom" in out
    assert 'id="zoom-in"' in out and 'id="zoom-out"' in out
    assert "out.page=p.page" in out
    assert _as_presentations([{"name": "po", "page": "a0p",
                               "slides": []}])[0]["page"] == "a0p"
    assert "page" not in _as_presentations([{"name": "s", "slides": []}])[0]
    assert ".deck.editing .deck-stage.zoomed{overflow:auto" in out
    # OBJECTS PANE (layers v1): list every object, hide-while-editing, lock
    assert 'id="selpane"' in out and 'id="objects-btn"' in out
    assert "function renderSelPane" in out and "a.hide&&editing" in out
    assert "an-locked" in out and ".sp-row" in out
    # POSTERS: a "+ New poster" rail button lands in the editor on an A0
    # portrait page with a poster template applied; the catalog groups
    # Slide vs Poster templates (poster group FIRST on a poster page)
    # the tree view follows the DARK theme (nodes/canvas/toolbar were
    # light-only), and "Reset" became "Unhide all" — shown only while
    # cells are eye-hidden
    assert "body:not(.light) .tree-node{" in out
    assert "color-mix(in srgb,var(--nc) 12%,#101c28)" in out
    assert "body:not(.light) .tree-scroll{border-color" in out
    assert "'Unhide all'" in out and "toolBtn('Reset'" not in out
    # tree ergonomics: zoom −/100%/+ (edge layout divides by the canvas
    # zoom), Width S/M/L presets (default M), per-cell corner resize, a
    # barycenter pass aligning children under parents, and type-tinted
    # nodes with the kind label in the type colour
    assert "function treeZoomSet" in out and "tt-zoomval" in out
    # edges re-route on ANY node size change (expand / MathJax / image
    # decode / resize): ResizeObserver on every node + a timer pass that
    # survives rAF throttling
    assert "new ResizeObserver" in out and "host._ro=ro" in out
    assert "setTimeout(function(){treeLayoutEdges(host);},120)" in out
    assert "'tree-canvas tw-m'" in out
    assert ".tree-canvas.tw-l .tree-node{width:340px" in out
    assert "tn-resize" in out and "barycenter" in out
    assert "color-mix(in srgb,var(--nc)" in out
    assert ".navitem .dot{width:9px" in out
    # the trace tab carries its own "Cells | Tree" switcher in its header
    # (same lineage as list or expandable dependency columns; the appbar
    # Tree button stays in sync via a class MutationObserver)
    assert "trace-viewsw" in out and "function setTraceView" in out
    assert ".dbtn.tvw.on{background:var(--cyan-deep)" in out
    # ---- CUSTOM VIEWS: a third saved kind, styling the notebook itself
    assert 'id="pr-newview"' in out and "function newCustomView" in out
    # the three '+ New ...' rail buttons must be tellable apart when the
    # rail is collapsed to icons (they were '+', a box and a triple bar)
    for _ni in ("newdeck", "newposter", "newview"):
        assert f'<i data-ic="{_ni}"></i>' not in out, _ni   # expanded
        assert _ICON_PATHS[_ni][:24] in out, _ni
    # and the feature is documented where people look for it
    assert "Custom views &mdash; a styled, filtered copy" in out
    assert "+ New custom view</b> in the left rail" in out
    assert "function openCustomView" in out and "function isViewPres" in out
    assert 'id="stylebar"' in out and 'id="stylepanel"' in out
    for _sb in ("sb-md", "sb-hd", "sb-doc", "sb-override", "sb-reset",
                "sb-done", "sb-name"):
        assert f'id="{_sb}"' in out, _sb
    # the cascade is inherited custom properties: shell -> section -> card
    assert "var MD_PROPS=[" in out and "var HD_PROPS=[" in out
    assert "APP.enterStyling=function(view,onChange)" in out
    assert "APP.exitStyling=function()" in out
    assert "APP.syncStylingView=function()" in out
    assert "function applyViewStyle" in out and "function stamp(el,obj" in out
    assert ".note{font-family:var(--md-font,var(--serif));" in out
    assert "color:var(--md-col,var(--ink-2))" in out
    assert 'background:var(--md-bg,var(--paper))' in out
    assert "font-size:calc(26px * var(--hd-size,1))" in out
    assert "color:var(--hd-col,var(--ink))" in out
    assert "display:var(--hd-eyebrow,block)" in out
    assert "margin:var(--vw-gap,14px) 0;" in out
    # dark mode overrides colour explicitly, so it must honour the vars too
    # (without this the whole feature silently did nothing in the default
    # theme — an equality-only test walked right past it)
    assert "body:not(.light) .note{color:var(--md-col,#c3cfda);}" in out
    assert "body:not(.light) .sectionhead h2{color:var(--hd-col,#e6edf3);}" \
        in out
    assert 'body:not(.light) .card[data-note="1"]{' \
        'background:var(--md-bg,#101c28);' in out
    # a view styles ITS notebook, never whatever tab is in front
    assert "var stem=(styView&&styView.nb)||APP.active;" in out
    # per-target buttons + the override affordance
    assert "function ensureStyBtns" in out and "b.className='sty-btn'" in out
    assert "function markStyOwn" in out and "sty-own" in out
    assert "'Override those '+narrow+' individual style'" in out
    # a view round-trips through the notebook's saved presentations
    _v = _as_presentations([{"name": "v", "kind": "view", "nb": "nb1",
                             "style": {"all": {"size": 1.4}},
                             "view": {"def": {"code": 0}, "v": 1},
                             "filters": {}, "folder": "f"}])
    assert _v[0]["kind"] == "view" and _v[0]["nb"] == "nb1"
    assert _v[0]["style"]["all"]["size"] == 1.4
    assert _v[0]["view"]["def"] == {"code": 0} and _v[0]["slides"] == []
    assert _v[0]["folder"] == "f"
    # a view entry has no slides, and must not be dropped for that
    assert _as_presentations([{"name": "x", "kind": "view"}])[0]["name"] == "x"
    assert 'id="pr-newpost"' in out and "function newPoster" in out
    assert "page:'a0p'" in out
    assert "id:'poster-3col'" in out and "id:'poster-2col'" in out
    assert "id:'poster-fig'" in out and "id:'poster-flow'" in out
    assert "'Poster layouts'" in out and "'Slide layouts'" in out
    assert ".lay-sec{grid-column:1/-1" in out
    assert 'id="dc-close"' not in out
    assert 'id="dc-play"' in out and 'id="film-list"' in out
    assert 'id="layout-row"' in out and "buildSlideEditor" in out
    # decluttered builder: no repeated name label, no verbose hints
    assert "dc-controls" in out
    # a frame can show a cell's code / figure / output part, and split
    assert "framePart" in out and "cellFacets" in out
    assert "buildPartChooser" in out and "splitFrame" in out
    # trace partitions by notebook section; playback frames are clean
    assert '"sectitle"' in out and '"subsection"' in out
    assert "vo-sec" in out and ".vpage .an-cellhead{display:none" in out
    # code-cell subtypes (each returns an ordered list of the kinds present)
    assert _classify_code("import numpy as np\nimport pandas as pd") \
        == ["imports"]
    assert _classify_code("def rescale(a):\n    return a/a.max()") \
        == ["function"]
    assert _classify_code("q = 99\nSTD = 1.0") == ["constant"]
    assert _classify_code("ds = xr.open_mfdataset(paths)") == ["data"]
    assert _classify_code("df = pd.read_csv('a.csv')") == ["data"]
    assert _classify_code("x = compute(y) + 1") == ["code"]
    assert _classify_code("plt.plot(x, y)\nax.set_title('t')") == ["plotting"]
    assert _classify_code("print(result)") == ["print"]
    assert _classify_code("xr.set_options(display_expand_data=False)") \
        == ["settings"]
    # mixed cells list several kinds, in order
    assert _classify_code("import xr\ndef f():\n    pass") \
        == ["imports", "function"]
    assert _classify_code("df = pd.read_csv('a')\ndf.plot()") \
        == ["data", "plotting"]
    assert '"codeKinds"' in out and "ckmain-function" in out
    assert "body:not(.light) .ckmain-data .badge" in out
    assert "body.light .navitem.ckmain-data .dot" in out
    # the Notebooks button (Open/Refresh) + advanced code-type filter; the
    # old inline "notebooks" chip strip above the thumbnails is gone
    assert 'id="dc-nbs-btn"' in out and "renderPresNbs" in out
    assert 'class="dc-nbs"' not in out
    assert 'id="ck-filter-btn"' in out and 'id="ck-filter-menu"' in out
    # printed output (incl. a bare expression) reads "print"; markdown notes
    # read "markdown" (not "note"); "metric" is gone — a printed value IS print
    assert _BADGE["text"] == "print" and _BADGE["note"] == "markdown"
    assert _BADGE["metric"] == "print"
    assert _infer_kind([RenderedOutput("text", "5", ot="print")]) == "text"
    # the key groups its dots with dividers (markdown | plots | code | output)
    _knav = render_nav(parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "note text"},
        {"cell_type": "code", "source": "import os", "outputs": []},
        {"cell_type": "code", "source": "print(1)", "outputs": [
            {"output_type": "stream", "name": "stdout", "text": "1\n"}]}]}))
    assert "navkey-div" in _knav and ">markdown<" in _knav and ">note<" not in _knav
    # advanced OUTPUT-type filter + finer repr types (numeric/list/dict/…)
    assert 'id="ot-filter-btn"' in out and 'id="ot-filter-menu"' in out
    assert "function presentOtTypes" in out and ".ot-off{display:none" in out
    assert "ot-print" in out and 'cb-out" data-ot=' in out
    assert _repr_kind("[1, 2, 3]") == "list" and _repr_kind("42") == "numeric"
    assert _repr_kind("{'a': 1}") == "dict" and _repr_kind("{1, 2}") == "set"
    assert _repr_kind("'hi'") == "string" and _repr_kind("(1, 2)") == "tuple"
    assert _repr_kind("True") == "bool" and _repr_kind("None") == "none"
    assert _repr_kind("np.float64(1.5)") == "array"
    # empty dict is a dict, not a set; string contents don't fool set/dict
    assert _repr_kind("{}") == "dict"
    assert _repr_kind("{'12:00', '13:00'}") == "set"
    assert _repr_kind("{'a}b': 1}") == "dict"
    # every numeric-like repr lands under "numeric" (complex, inf, nan, sci)
    assert _repr_kind("(1+2j)") == "numeric" and _repr_kind("2j") == "numeric"
    assert _repr_kind("inf") == "numeric" and _repr_kind("-nan") == "numeric"
    assert _repr_kind("-1.5e-9") == "numeric"
    # granular value types: function / class / object / module + pandas
    assert _repr_kind("<function foo at 0x1>") == "function"
    assert _repr_kind("<class 'int'>") == "class"
    assert _repr_kind("<module 'os'>") == "module"
    assert _repr_kind("<Foo object at 0x1>") == "object"
    assert _repr_kind("0    1\n1    2\ndtype: int64") == "series"
    assert _repr_kind("   a  b\n0  1  2\n\n[1 rows x 2 columns]") == "dataframe"
    # a pandas DataFrame HTML table is tagged 'dataframe'
    _dfo = render_outputs([{"output_type": "execute_result", "data": {
        "text/html": '<table class="dataframe"><tr><td>1</td></tr></table>'}}])
    assert _dfo and _dfo[0].ot == "dataframe" and "ot-dataframe" in _dfo[0].payload
    # the Output-types menu must actually surface the finer slugs (not filter
    # them out against a stale allow-list)
    assert "var OT_TYPES=['print','numeric'" in out
    assert "if(OT_TYPES.indexOf(t)<0) out.push(t)" in out
    # opening a collapsed output must not re-show type-filtered children
    assert ".cb-out.part-fold.part-open>*:not(.ot-off){display:revert" in out
    _rout = render_outputs([
        {"output_type": "execute_result", "data": {"text/plain": "[1, 2, 3]"}}])
    assert _rout and _rout[0].ot == "list" and "ot-list" in _rout[0].payload
    # richer plot/output types: gif, jpeg, video, and interactive Plotly
    _gif = render_outputs([{"output_type": "display_data",
        "data": {"image/gif": "R0lGOD"}}])
    assert _gif and _gif[0].has_image and "data:image/gif;base64,R0lGOD" \
        in _gif[0].payload and "gif-out" in _gif[0].payload
    _jpg = render_outputs([{"output_type": "display_data",
        "data": {"image/jpeg": "/9j/4A"}}])
    assert _jpg and "data:image/jpeg;base64,/9j/4A" in _jpg[0].payload
    # a crafted (non-base64) media payload cannot break out of src="data:..."
    _xss = render_outputs([{"output_type": "display_data",
        "data": {"image/gif": '"><script>alert(1)</script>'}}])
    assert _xss and "<script" not in _xss[0].payload \
        and "alert(1)" not in _xss[0].payload
    _vid = render_outputs([{"output_type": "display_data",
        "data": {"video/mp4": "AAAAIG"}}])
    assert _vid and _vid[0].kind == "video" and "<video" in _vid[0].payload \
        and "data:video/mp4;base64,AAAAIG" in _vid[0].payload
    _ply = render_outputs([{"output_type": "display_data", "data": {
        "application/vnd.plotly.v1+json": {"data": [{"y": [1, 2]}],
                                           "layout": {}},
        "image/png": "aGk="}}])
    assert _ply and _ply[0].kind == "plotly" and _ply[0].has_interactive \
        and "plotly-embed" in _ply[0].payload and "data-plotly=" in _ply[0].payload
    # an interactive text/html output (embedded <script>) is neutralised at
    # build time (client re-runs it) and flagged interactive
    _int = render_outputs([{"output_type": "display_data", "data": {
        "text/html": '<div id="p"></div><script>Plotly.newPlot("p",[])'
                     '</script>'}}])
    assert _int and _int[0].has_interactive \
        and 'type="text/plotline-embed"' in _int[0].payload \
        and "plotframe" in _int[0].payload
    # a plain (script-less) html result is untouched and NOT flagged interactive
    _plain = render_outputs([{"output_type": "execute_result", "data": {
        "text/html": "<b>hello</b>"}}])
    assert _plain and not _plain[0].has_interactive \
        and "plotframe" not in _plain[0].payload
    # PLOT-TYPES: every plot fragment carries a data-pt slug — matplotlib
    # for static images, plotly/bokeh/vega/folium/widget for live embeds —
    # and live embeds are FIGURES (plot part + figure kind), not output
    assert _ply[0].pt == "plotly" and 'data-pt="plotly"' in _ply[0].payload
    assert _int[0].pt == "plotly" and _vid[0].pt == "video"
    assert _jpg[0].pt == "matplotlib" \
        and 'data-pt="matplotlib"' in _jpg[0].payload
    assert _plain[0].pt == ""
    assert _plot_lib("<div>BokehJS says hi</div>") == "bokeh"
    assert _plot_lib("<div>vegaEmbed(spec)</div>") == "vega"
    assert _plot_lib("<div class='leaflet-map'></div>") == "folium"
    assert _plot_lib("<script>custom()</script>") == "widget"
    # prose that merely NAMES a library is not a live embed (no phantom
    # "Plot N" figures from a version table) — real machinery is
    assert not _looks_interactive("<table><td>plotly 5.22</td></table>")
    assert not _looks_interactive("bokeh results are in the paper")
    assert _looks_interactive("<div class='bk-root'></div>")
    assert _looks_interactive("<script>anything()</script>")
    assert _looks_interactive("<iframe srcdoc='...'></iframe>")
    _prose = render_outputs([{"output_type": "execute_result", "data": {
        "text/html": "<table><td>made with plotly</td></table>"}}])
    assert _prose and not _prose[0].has_interactive and _prose[0].pt == ""
    # one advanced filter menu at a time; doc filter state never rides into
    # slide clones; hidden pager pages defer their plotly draw to the flip
    assert "function closeFilterMenus" in out
    assert "'.pt-off,.ot-off,.part-off,.part-fold,.code-off'" in out
    assert "figpage')" in out and "Plots.resize" in out
    # ---- add-a-note: a markdown cell lands right after the card's cells
    # (grouped code cards use their LAST member cell; a note card maps back
    # through its cell:<id> anchor; unknown/empty anchors append) ----
    _nb2 = {"cells": [
        {"cell_type": "markdown", "id": "m0", "source": "just a note"},
        {"cell_type": "code", "id": "c0",
         "source": "#| id: load\nload()", "outputs": []},
        {"cell_type": "code", "id": "c1",
         "source": "#| display: figure\n#| id: figx\nplot()",
         "outputs": [{"output_type": "display_data",
                      "data": {"image/png": "aGk="}}]},
    ]}
    _r, _i, _cid = insert_note_cell(
        json.loads(json.dumps(_nb2)), "figx", "a **note**")
    assert _i == 3 and _r["cells"][3]["cell_type"] == "markdown" \
        and _r["cells"][3]["source"] == "a **note**" \
        and _r["cells"][3]["id"] == _cid
    _r2, _i2, _ = insert_note_cell(
        json.loads(json.dumps(_nb2)), "load", "mid note")
    assert _i2 == 2 and _r2["cells"][2]["source"] == "mid note"
    _r3, _i3, _ = insert_note_cell(
        json.loads(json.dumps(_nb2)), "cell:m0", "x")
    assert _i3 == 1
    _r4, _i4, _ = insert_note_cell(json.loads(json.dumps(_nb2)), "", "x")
    assert _i4 == 3
    _r5, _i5, _ = insert_note_cell(json.loads(json.dumps(_nb2)), "nope", "x")
    assert _i5 == 3
    assert _github_web_url("git@github.com:alice/proj.git") \
        == "https://github.com/alice/proj"
    assert _github_web_url("https://github.com/alice/proj") \
        == "https://github.com/alice/proj"
    assert _github_web_url("https://gitlab.com/x/y") == ""
    # the UI: pencil per card (app mode only), editor dialog, git checkbox
    assert 'id="note-dlg"' in out and 'id="doc-toast"' in out
    assert "function wireAddNote" in out and "'/api/addnote'" in out
    assert "'/api/gitstate'" in out and "card-addnote" in out
    _live_doc = parse_notebook({"cells": [
        {"cell_type": "code", "source": "m", "outputs": [
            {"output_type": "display_data",
             "data": {"text/html": "<div class='folium-map'></div>"}}]}]})
    _live_items = [it for s in _live_doc.sections for it in s.items]
    assert _live_items and _live_items[0].kind == "figure"
    _live_html = render_item(_live_items[0])
    assert 'data-pt="folium"' in _live_html \
        and 'class="cb-part cb-fig" data-pt="folium"' in _live_html
    # the appbar stacks each advanced types picker under its parent filter
    # (Plot types under Plots, Code types under Code, Output types under
    # Output) so the filter row stays narrow
    assert 'id="pt-filter-btn"' in out and 'id="pt-filter-menu"' in out
    assert "function renderPtMenu" in out and "presentPtTypes" in out
    assert ".ckf-dot.pt-sw-bokeh" in out and ".ckf-dot.pt-sw-matplotlib" in out
    assert 'class="fgrp"' in out and ".cb-fig .pt-off{display:none" in out
    # file + 4 type filters + scope/reset + copy + figure & text size
    # 7 vertical filter/scope groups + 2 horizontal size steppers (fgrp-h)
    assert out.count('class="fgrp"') == 7
    assert out.count('class="fgrp fgrp-h"') == 2
    # the ribbon is organised into LABELLED sections
    assert out.count('class="abgrp-lab"') == 6
    assert 'class="abgrp" id="ab-filters"' in out
    # markdown/prose text scales with its own +/- control
    assert 'id="md-bigger"' in out and 'id="md-smaller"' in out
    assert "--mdscale" in out and "calc(15px * var(--mdscale) * var(--md-size,1))" in out
    # tables are text too — both had hard-coded sizes and sat out every
    # text-size change until 2026-07-30
    assert "font-size:calc(13.5px * var(--mdscale,1) * var(--md-size,1));" in out
    assert "font-size:calc(13px * var(--mdscale,1));" in out
    # Open / File / Reload lead the ribbon, at full size
    assert 'class="toggle primary" id="tab-open"' in out
    assert 'id="file-info-btn"' not in out   # they live in the sidebar
    assert (out.index('id="tab-open"') < out.index('id="tv-plots"'))
    # the scope + copy buttons are full-size, like the filters they act on
    assert 'class="toggle" id="sec-scope-btn"' in out
    assert "function copyFiltersToAll" in out
    assert 'class="toggle fz-val" id="fig-size-val"' in out
    # …and the zoom row is captioned instead of each button carrying it
    assert 'class="fgrp-cap">Figures' in out
    # the present bar shares the app bar's button theming (it used to fall
    # back to the LIGHT styling in dark mode)
    assert ".appbar .toggle,.present-bar .toggle{" in out
    assert "body.light .appbar .toggle,body.light .present-bar .toggle{" in out
    assert (out.index('id="tv-plots"') < out.index('id="pt-filter-btn"')
            < out.index('id="tv-markdown"'))
    assert "--appbar-h:104px" in out and "--chrome-h:112px" in out
    # the ribbon WRAPS and the page offset follows its real height, so a
    # control can never end up off the right-hand edge behind a scrollbar
    assert ".appbar{display:flex;align-items:stretch;gap:6px;" \
        "flex-wrap:wrap;" in out
    # left-aligned, NOT centred: centring re-centres on any viewport
    # width change, so every button slid when the scrollbar came and went
    assert "justify-content:flex-start;padding-left:8px;" in out
    assert "overflow-x:auto;scrollbar-width:none;}" not in out
    assert "function measureChrome" in out
    assert "'--chrome-h',h+'px'" in out
    # …and File info + reload live in the SIDEBAR, beside the notebook
    # they describe, rather than being duplicated in the ribbon
    assert "rf-btn rf-info" in out and "rf-btn rf-reload" in out
    # sub filter buttons are comfortably tall; expanded tree nodes widen
    assert ".appbar .toggle.sub,.present-bar .toggle.sub{height:34px" in out
    assert ".tree-node.expanded{width:min(380px" in out
    # the client re-activates neutralised scripts + draws plotly specs
    assert "function activateOutputs" in out and "window.SemActivate" in out
    assert 'text/plotline-embed' in out and "cdn.plot.ly" in out
    assert ".ckf-dot.ot-sw-numeric" in out and ".ckf-dot.ot-sw-dataframe" in out
    # the sidebar key sits at the TOP (before the first section row)
    _nav = render_nav(doc)
    assert "navkey" in _nav and _nav.index("navkey") < _nav.index("navsec-row")
    # a figure with no explicit name is auto-named "Plot N"
    pdoc = parse_notebook({"cells": [
        {"cell_type": "code", "source": "plt.plot(x)", "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]})
    pfig = [it for s in pdoc.sections for it in s.items
            if it.kind in ("figure", "diagnostic")]
    assert pfig and pfig[0].title == "Plot 1" and not pfig[0].title_echo
    # huge printed output is capped + scrollable in the document view
    assert "max-height:min(440px,62vh)" in out
    # four filters — Markdown/Code/Plots/Output ALL cycle 3 states now
    assert "var CODE_CYCLE=['visible','collapsed','hidden']" in out
    assert 'id="tv-markdown"' in out and 'id="tv-plots"' in out
    assert 'id="tv-output"' in out and 'id="tv-code"' in out
    # Output is 3-state: it cycles like the rest and its part can fold
    assert "cycleF('out')" in out and "return CODE_CYCLE[" in out
    assert ".cb-out.part-fold" in out and 'content:"\\25b8  Show output"' in out
    # PART-BASED: a cell's output splits into a filterable figure + output part;
    # the Code filter reaches the code (codewrap) in EVERY non-markdown cell
    assert 'class="cb-part cb-fig"' in out and 'class="cb-part cb-out"' in out
    assert ".cb-fig.part-off" in out and ".cb-fig.part-fold" in out
    # the cb-fig wrapper must pass flex height through in slide frames
    assert ".an-cell .cb-fig,.spane .cb-fig,.slide-fig .cb-fig" in out
    assert "function applyCodeState" in out and ".codewrap.code-off" in out
    assert ".card.collapsed" in out   # markdown notes still card-collapse
    # plain 'code' is a filter type too, so unchecking all == hide code
    assert "'constant','code']" in out
    # per-cell eyes: one on every card header, one on every sidebar item
    assert 'class="cell-eye"' in out and 'class="navitem-eye"' in out
    assert "function setCellOff" in out
    assert ".navitem.cell-off" in out   # hidden cell stays in the sidebar
    # h1 (# ) headings become sections too, not just the document title
    hdoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# PR"},
        {"cell_type": "code", "source": "x = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## Details"},
        {"cell_type": "code", "source": "y = 2", "outputs": []}]})
    assert any(s.title == "PR" and s.level == 1 for s in hdoc.sections)
    assert any(s.title == "Details" and s.level == 2 for s in hdoc.sections)
    assert hdoc.title == "PR"          # first h1 also names the document
    # raw HTML headings (with attributes / inline styles) register exactly like
    # `#` headings — notebooks that style their headers must still get sections
    hhtml = parse_notebook({"cells": [
        {"cell_type": "markdown",
         "source": "<h1 style='color:cyan'> Demonstration: Single Ensemble "
                   "</h1>"},
        {"cell_type": "code", "source": "z = 1", "outputs": []},
        {"cell_type": "markdown", "source": '<h2 class="x">Details</h2>'},
        {"cell_type": "code", "source": "z2 = 2", "outputs": []}]})
    assert any(s.title == "Demonstration: Single Ensemble" and s.level == 1
               for s in hhtml.sections)
    assert any(s.title == "Details" and s.level == 2 for s in hhtml.sections)
    assert hhtml.title == "Demonstration: Single Ensemble"
    # the heading tag itself is consumed (not left as prose in a note); an empty
    # <h1></h1> is NOT a heading; markdown `#` still works
    assert _lead_heading("<h1 style='c'>Hi</h1>") == (1, "Hi", "")
    assert _lead_heading("<h3>Deep</h3>\n\nbody") == (3, "Deep", "body")
    assert _lead_heading("<h1></h1>") is None
    assert _lead_heading("# Plain")[1] == "Plain"
    # headings are POSITIONAL: two sections sharing a title stay distinct and
    # in order — content is never merged across parents (regression guard)
    ddoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Model A"},
        {"cell_type": "code", "source": "a = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## Summary"},
        {"cell_type": "code", "source": "sa = 1", "outputs": []},
        {"cell_type": "markdown", "source": "# Model B"},
        {"cell_type": "code", "source": "b = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## Summary"},
        {"cell_type": "code", "source": "sb = 1", "outputs": []}]})
    assert [s.title for s in ddoc.sections] == \
        ["Model A", "Summary", "Model B", "Summary"]
    # the SECOND Summary owns Model B's summary cell, not the first
    summaries = [s for s in ddoc.sections if s.title == "Summary"]
    assert "sa = 1" in summaries[0].items[0].members[0]["code"]
    assert "sb = 1" in summaries[1].items[0].members[0]["code"]
    # a real `# Overview` claims the synthetic pre-heading bucket (one section,
    # promoted to level 1) instead of leaving a mis-styled level-2 twin
    odoc = parse_notebook({"cells": [
        {"cell_type": "code", "source": "import os", "outputs": []},
        {"cell_type": "markdown", "source": "# Overview"},
        {"cell_type": "code", "source": "z = 2", "outputs": []}]})
    ovs = [s for s in odoc.sections if s.title == "Overview"]
    assert len(ovs) == 1 and ovs[0].level == 1
    assert 'data-anchor="clim"' in out and 'data-anchor="cell:md1"' in out
    assert '"stem": "demo"' in out or '"stem":"demo"' in out
    # markdown notes: bullets + bold survive, math left for MathJax
    assert "<li>point one</li>" in out and "<strong>two</strong>" in out
    # a raw-HTML lead (<b>Title</b>) no longer swallows the "- " bullets
    # under it — the list still renders as a real list
    _mdh = md_to_html("<b>Signal-to-noise</b>\n- Signal is S\n- Noise is N")
    assert "<b>Signal-to-noise</b>" in _mdh
    assert _mdh.count("<li>") == 2 and "<ul>" in _mdh
    assert "- Signal" not in _mdh
    assert "\\bar{z}$" in out  # ' is escaped to &#x27;; DOM text is intact
    # anchors fall back to node id / cell id
    items = [it for s in doc.sections for it in s.items]
    assert any(it.anchor == "clim" for it in items)
    assert any(it.anchor == "cell:md1" for it in items)
    # code chains: declared depends (clim <- load) and AST-traced variables
    # (fig2 reads ds, which cell:c-prep assigned)
    by_anchor = {it.anchor: it for it in items}
    assert by_anchor["clim"].chain == ["load"]
    assert by_anchor["fig2"].chain == ["cell:c-prep"]
    assert '"chain": ["cell:c-prep"]' in out

    # mixed-output cell: the figure and the printed repr become SEPARATE,
    # independently filterable parts (cb-fig + cb-out), not a disclosure
    mixed = [it for s in doc.sections for it in s.items
             if it.anchor == "mixed"][0]
    assert mixed.kind == "figure"
    assert any(o.has_image for o in mixed.outputs)
    assert any(not o.has_image for o in mixed.outputs)
    assert "alsoprinted" not in out   # the old "also printed" disclosure is gone

    # several figures from one cell -> pager, one figure at a time
    assert 'class="figpager" data-n="2"' in out
    assert 'class="figpage current"' in out and "fp-next" in out
    assert "1 / 2" in out
    # nav key legend + long-markdown clamp plumbing shipped
    assert 'class="navkey"' in out and 'class="nk k-figure"' in out
    assert "mdClampScan" in out and "mdclamp" in out
    assert "vo-xall" in out and "fullscreenchange" in out

    # Tree view (analysis graph as a full, expandable view) + a full-screen
    # "present" mode for either the Narrative document or the Tree — both are
    # baked into every runtime (one _TEMPLATE), built client-side per shell.
    assert 'id="view-tree"' in out and 'class="treeview"' in out
    assert ".nbshell.tree .content{display:none" in out
    assert ".nbshell.tree .treeview{display:block" in out
    assert "function buildTree" in out and "function treeLayoutEdges" in out
    assert "function renderViewBtns" in out and "window.SemView" in out
    assert "tree-lane" in out and "tree-node-head" in out and "tree-edge" in out
    # present mode: button, floating control bar + its restore edge-arrow
    assert 'id="doc-present"' in out and 'id="present-bar"' in out
    # ONE fold/unfold button, pinned in one place, plus taskbar auto-hide
    assert 'id="present-bar-show"' in out and 'class="pb-toggle"' in out
    assert 'id="pb-collapse"' not in out
    assert 'id="pb-auto"' in out and "body.pb-auto.pb-peek" in out
    # presenting: hiding itself is the DEFAULT, "Pin" keeps it in place
    assert "'junoview:presentbar:pinned'" in out
    assert "var pbAuto=!pbPinned" in out and "Auto-hide</span></button>" in out
    # a version is the SAME file: it replaces the tab and stays out of
    # Recent, with an explicit "open in a new tab" to compare instead
    assert "function openUrlVersion" in out and ".rf-newtab" in out
    assert "if(path&&!quiet&&APP.noteRecent)" in out
    assert "{path:url,stem:intoStem}" in out
    # …and the picker closes on an outside click, Esc, or a choice
    assert "function closePanel" in out
    assert "if(e.key==='Escape'&&!panel.hidden) closePanel();" in out
    assert "function syncToggleBtn" in out
    assert "function enterDocPresent" in out and "function exitDocPresent" in out
    assert "body.doc-presenting" in out and "pb-folded" in out
    # the bar DOCKS (top = the app bar verbatim, right = groups as rows),
    # insets the document instead of floating over it, and folds toward
    # the edge it is docked on
    assert "body.pbpos-top .present-bar" in out
    assert "body.pbpos-right .present-bar" in out
    assert "body.doc-presenting.pbpos-top .docs{top:var(--pbh" in out
    assert "body.doc-presenting.pbpos-right .docs{right:var(--pbw" in out
    assert "translateY(-101%)" in out and "translateX(101%)" in out
    assert "function measurePb" in out and "function applyPbDock" in out
    assert "Exit presentation</button>" in out
    # present mode carries the REAL filter/code controls in a collapsible
    # tray (moved, not duplicated) — only Exit stays outside it — and the
    # section sidebar can slide back in
    assert 'id="pb-tools"' in out and 'class="pb-own"' in out
    assert "function pbTakeTools" in out and "function pbReturnTools" in out
    # the present bar takes the whole labelled SECTIONS, so it reproduces the
    # ribbon grid instead of flattening the groups into its own wrap flow
    assert "var PB_TOOLS=['#ab-filters','#ab-scope','#ab-size','#ab-view'];" in out
    assert 'id="pb-rail"' in out and "body.doc-presenting.present-rail" in out
    # …the presenting controls ARE the app bar's (same .toggle class, not
    # a bespoke look-alike), and the dock choice is remembered
    assert 'id="pb-move"' in out and "'junoview:presentbar:dock'" in out
    assert '<button class="toggle" id="pb-rail" aria-pressed="false"' in out
    assert '<button class="toggle pb-exit" id="pb-exit"' in out
    assert '<button class="toggle" id="pb-auto"' in out
    # …and the fixed-position filter menus ride into the fullscreen layer
    assert "var PB_MENUS=" in out
    # figure zoom: per-figure -/+/expand, a feed-wide sizer, a full-screen
    # viewer, and the multiplied width factor
    assert 'class="figzoom"' in out and "fz-in" in out and "fz-max" in out
    assert 'id="fig-bigger"' in out and 'id="fig-smaller"' in out
    assert "function openFigMax" in out and 'id="figmax-box"' in out
    # the zoom widens the CARD, so its border/header grow with the figure
    # instead of the plot spilling outside its own cell
    assert ".card.has-fig{--fz:1;" in out
    # a roomier card is not a bigger plot: max-width only caps, so a
    # zoomed figure must FILL its frame or nothing visibly changes
    assert ".card.has-fig.zoomed .figframe img" in out
    assert "function syncZoomed" in out
    # the app bar reads as groups: full-height separators between them
    assert ".appbar-div{flex:none;width:1px;height:82px" in out
    # 2 plain ribbon dividers + 2 grouping the custom-view styling bar
    # (the other 2 carry filt-div and disappear with the filters in tree)
    assert out.count('class="appbar-div"') == 4
    assert "width:calc(100% * var(--fz) * var(--fzall))" in out
    assert 'has-fig' in render_item(parse_notebook({"cells": [
        {"cell_type": "code", "source": "plot()", "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]}).sections[0].items[0])
    # …and a card cloned into a slide / tree / trace ignores it
    assert ".an-cell .card.has-fig,.spane .card.has-fig" in out
    assert "function figCount" in out      # zoom chrome never counts as a plot
    # …the per-figure controls sit top-LEFT (a Plotly/Bokeh toolbar owns
    # top-right) and cannot be clicked while invisible
    assert ".figzoom{position:absolute;top:6px;left:6px" in out
    assert "opacity:0;pointer-events:none" in out
    # …and both are documented in Help, so they are findable without hunting
    assert "<h3>Figure size</h3>" in out and "Figures 100%" in out
    # SAVE LOCATION: a "Saved to:" picker (project / browser / a remembered
    # .junoview file) instead of an unexplained "Download JSON"
    assert 'id="dc-target"' in out and 'id="target-menu"' in out
    assert 'id="tg-browser"' in out and 'id="tg-file"' in out
    assert "function renderTargetBtn" in out and "function setTarget" in out
    assert "showSaveFilePicker" in out and "'.junoview'" in out
    # the picked file is REMEMBERED across visits (handle in IndexedDB)
    assert "indexedDB.open('junoview'" in out and "function idbPut" in out
    assert "function permAsk" in out and "function saveToFile" in out
    # the friendlier names replaced the JSON-speak
    assert "Download a copy" in out and "Open a .junoview" in out
    assert "Download JSON" not in out and "Load deck" not in out
    # a .junoview next to the notebook auto-loads like the old sidecar
    import tempfile as _tf
    with _tf.TemporaryDirectory() as _d:
        _p = Path(_d) / "talk.ipynb"
        _p.write_text(json.dumps({"cells": [
            {"cell_type": "code", "source": "x=1", "outputs": []}]}),
            encoding="utf-8")
        _p.with_suffix(".junoview").write_text(json.dumps(
            {"junoview": 1, "presentations": [
                {"name": "from sidecar", "slides": []}]}),
            encoding="utf-8")
        _sc = load_doc(_p)
        assert [p["name"] for p in _sc.presentations] == ["from sidecar"]
    # "Apply to": filters can be scoped to ticked sections/sub-sections
    assert 'id="sec-scope-btn"' in out and 'id="sec-scope-menu"' in out
    assert "function renderScopeMenu" in out and "var secScope=" in out
    assert "function scopeAll" in out and "scope-l3" in out
    # …as an EXPANDABLE tree: a heading carries its sub-headings when
    # ticked, and its arrow reveals them
    assert "function scopeTree" in out and "var scopeOpen=" in out
    assert "scope-chev" in out and "cb.indeterminate" in out
    assert "function setSub" in out
    # …and picking is an explicit MODE, so unticking everything means
    # "no sections", never a silent fallback to the whole notebook
    # the picker is a plain SELECTION: highlighted rows, one constant
    # "Select all", and only the little arrow expands a heading
    # YOUR LAYOUT is remembered per notebook (hidden cells, hidden and
    # collapsed sections, tree/raw mode, and the whole filter setup)
    assert "function saveLayout" in out and "function loadLayout" in out
    assert "'junoview:layout:'" in out
    # …including the size you set on an INDIVIDUAL figure
    assert "st.figs={}" in out and "c.style.setProperty('--fz'" in out
    assert "else loadLayout(shell,stem," in out
    assert "function scheduleSaveLayout" in out
    # a tab opened AT A COMMIT keeps the notebook's name, with the short
    # hash underneath — not a "-2" suffix
    assert "vs.className='tab-ver'" in out and ".tab-t.tab-t-ver" in out
    assert "sh.label||stem" in out
    # a filter button never changes width as its state word changes
    assert 'class="tvstate"' in out and ".tvstate{display:inline-block" in out
    assert "function seedScope" in out and "'Select all'" in out
    assert ".scope-row.on{" in out and ".scope-row.part{" in out
    assert "'none'" in out and "scope-chev" in out
    assert "type='checkbox'" not in out.split("scope-row")[1][:900]
    # FILTERS BELONG TO SECTIONS: each section carries its own state, so
    # one chapter can hide code while the next collapses plots. The appbar
    # reads/writes whichever sections "Apply to" selects, says "Mixed"
    # when they disagree, and Reset clears every override.
    assert "function stateFor" in out and "function newF" in out
    assert "function readF" in out and "function writeF" in out
    assert "function cycleF" in out and "mixed:'Mix'" in out
    assert ".toggle.tv.mixed .tdot" in out
    assert 'id="filters-reset"' in out and "function resetFilters" in out
    assert "function markSecOverrides" in out and "has-fover" in out
    # an override that drifts back to the default stops being an override
    # (no lying "· filtered" badge), and an empty pick disables the filters
    assert "function pruneF" in out and "function sameF" in out
    assert ".toggle.notarget" in out and "b.dataset.tip0" in out
    # per-notebook isolation (the adversarial review's top findings): the
    # DEFAULT and the pick are per stem, a tab switch rebinds the bar, and
    # closing a notebook drops its filter state
    assert "function FDEFof" in out and "var defBy={},secF={}" in out
    assert "renderTypeButtons();renderScopeBtn();" in out
    assert "delete defBy[String(stem)]" in out
    # a card carries its own section id, so tree/trace CLONES keep obeying
    # their source section instead of silently reverting to the default
    assert 'data-secid="' in out and "function secIdOf" in out
    assert "stateFor(stem,secIdOf(c))" in out
    # a Plot-trace tab opens UNFILTERED (its own default, code showing) and
    # offers to pull in the document's filters; any notebook can push its
    # filters to all the others (greyed out when it is the only one open)
    assert "function newF(trace)" in out and "code:trace?'visible'" in out
    assert 'id="trace-inherit"' in out and "function copyFiltersTo" in out
    assert "function copyFiltersToAll" in out and ".scope-copy" in out
    assert "function renderFilterExtras" in out and "function docToast" in out
    # per-section state is namespaced by notebook, so two tabs whose
    # sections share a slug never trample each other
    assert "function fkey" in out and "stateFor(stem," in out

    # id-less figure cells anchor by POSITION, and that anchor survives a
    # content edit (the code-derived title changes, the anchor must not) —
    # so a deck frame keeps resolving after the notebook is refreshed
    a_before = parse_notebook({"cells": [{"cell_type": "code",
        "source": "#| display: figure\nplot(a)", "outputs": [
        {"output_type": "display_data", "data": {"image/png": "aGk="}}]}]})
    a_after = parse_notebook({"cells": [{"cell_type": "code",
        "source": "#| display: figure\nplot(a, b, c, lw=2)", "outputs": [
        {"output_type": "display_data", "data": {"image/png": "aGk="}}]}]})
    an_b = a_before.sections[0].items[0].anchor
    an_a = a_after.sections[0].items[0].anchor
    assert an_b == an_a == "cell:p0", (an_b, an_a)

    # untitled code cells: function names become titles; a bare code
    # line labels the nav but is not repeated as a card heading
    all_items = [it for s in doc.sections for it in s.items]
    assert any(it.title == "rescale()" and not it.title_echo
               for it in all_items)
    assert any(it.title == "result = rescale(data)" and it.title_echo
               for it in all_items)
    assert 'cardtitle echo' in out
    assert _title_from_code("def a():\n    pass\n\ndef b():\n    pass") \
        == ("2 functions (a, b)", False)
    assert _title_from_code(
        "import x\n\ndef a():\n    pass\n\ndef b():\n    pass") \
        == ("2 functions + code", False)
    # a raw HTML <h1> heading (with an inline style) registers as a section,
    # exactly like a `#` heading (the raw transparency view still shows the
    # authored HTML; the semantic document gets a real section)
    assert any(s.title == "Universal" for s in doc.sections)
    assert any(s.title == "Universal" and s.level == 1 for s in doc.sections)
    # the rest of the cell is still a note, allowlist-sanitized, with a toggle;
    # inline styles on safe tags survive (previously proven via the h1)
    assert '<div style="color:cyan">styled block</div>' in out
    assert "<p>plain paragraph</p>" in out
    # the rendered note must not contain a live script tag (the escaped
    # source lives separately in the note-src <pre>)
    assert 'class="note-src code"' in out and "htmltoggle" in out
    assert "Show raw HTML" in out
    # allowlist reconstruction: only safe tags/attrs come back out
    assert _sanitize_html('<img src=x onerror=alert(1)>') \
        == '<img src="x"/>'
    # every bypass the adversarial review found must be closed:
    assert "script" not in _sanitize_html(     # split-tag reassembly
        '<scr<embed>ipt>alert(1)</scr<embed>ipt>').lower()
    assert _sanitize_html(                      # unquoted js URL
        '<a href=javascript:alert(1)>x</a>') == '<a>x</a>'
    assert _sanitize_html(                      # newline-split scheme
        "<a href='javas\ncript:alert(1)'>x</a>") == '<a>x</a>'
    assert "formaction" not in _sanitize_html(  # non-href URL sink
        '<button formaction="javascript:alert(1)">go</button>')
    assert "srcdoc" not in _sanitize_html(      # iframe + srcdoc
        '<iframe srcdoc="&lt;script&gt;x&lt;/script&gt;"></iframe>')
    assert _sanitize_html('<a href="/rel/ok">y</a>') \
        == '<a href="/rel/ok">y</a>'           # safe URLs kept

    # chrome: TOC toggle, resizable builder, dark document, tab refresh
    assert 'id="menubtn"' in out and "tocshow" in out
    assert 'id="dc-resize"' in out and "--dc-w" in out
    assert 'id="dc-save"' in out
    assert 'class="docbar"' in out and 'class="docbar-p"' in out
    assert "body:not(.light) .card" in out
    assert 'id="refresh-btn"' not in out

    # new slide layouts, title slides and annotations survive normalizing
    pres2 = _as_presentations([{"name": "n", "slides": [
        {"layout": "rows", "panes": ["a"]},
        {"layout": "title", "title": "Hi", "sub": "there",
         "annots": [{"k": "text", "x": 5, "y": 5, "text": "note"}]},
    ]}])
    assert pres2[0]["slides"][0] == {"layout": "rows", "panes": ["a", None]}
    t_slide = pres2[0]["slides"][1]
    assert t_slide["layout"] == "title" and t_slide["title"] == "Hi"
    assert t_slide["panes"] == [] and t_slide["annots"][0]["text"] == "note"
    # the layout picker is a scrollable catalog generated from LAYOUTS; a
    # title slide is just two text boxes (no special title mode)
    assert "var LAYOUTS" in out and "function applyLayout" in out
    assert "id:'title'" in out and "id:'rows'" in out and "id:'blank'" in out
    assert "id:'title-text-cell'" in out or "id:'text-cell'" in out
    assert 'id="layout-row"' in out and "renderLayoutPicker" in out
    assert 'id="edit-tools"' in out and 'id="dc-edit"' in out
    # a poster page offers POSTER templates only and a slide page slide
    # templates only — never both lists (2026-07-29)
    assert "return !!l.poster===isPoster;" in out
    assert "isPoster?'Poster layouts':'Slide layouts'" in out
    # ...and the poster family sorts the page's own orientation first,
    # previewing each template at its real aspect
    assert "(!!a.land===land?0:1)-(!!b.land===land?0:1)" in out
    assert "layout.land?'1189 / 841':'841 / 1189'" in out
    # poster templates read like a real conference poster: numbered
    # section headings, prose for intro/discussion, figures for results
    for _pl in ("poster-3col", "poster-2col", "poster-fig", "poster-flow",
                "poster-billboard", "poster-4col", "poster-land3",
                "poster-land-fig"):
        assert f"id:'{_pl}'" in out, _pl
    assert "text:'1 · Introduction'" in out
    assert "text:'2 · Data & methods'" in out
    assert "text:'7 · Conclusions'" in out
    assert "Funding & acknowledgements" in out
    assert "land:1" in out and "poster:1" in out
    # the A-series poster presets are what turns poster mode on; A4 is a
    # page, so it keeps the slide templates
    assert "id:'a0p',label:'Poster A0 portrait',aw:841,ah:1189," \
        "mm:[841,1189],\n      poster:1}" in out
    assert "id:'a4p',label:'A4 portrait',aw:210,ah:297,mm:[210,297]}" in out
    # poster mode grows the editor's own chrome
    assert "classList.toggle('poster-page',!!pg.poster)" in out
    assert ".deck.poster-page .dbtn{font-size:12.5px;padding:8px 14px;}" in out
    assert ".deck.poster-page .lay-picker{grid-template-columns:" \
        "repeat(2,1fr);" in out
    assert 'id="et-fmt"' in out and 'data-tool="cell"' in out
    # ribbon declutter: ONE wrapping flow (static + format groups share
    # rows), no Select/Delete group (Esc deselects, Del removes), Animate
    # merged into an Effects group, and common groups (Arrange, Effects)
    # come FIRST so buttons don't jump between selection types
    assert ".rbn-static{display:contents;}" in out
    assert ".et-fmt{display:contents;}" in out
    assert 'id="et-del"' not in out and 'data-tool="select"' not in out
    assert ">Effects</span>" in out and 'id="fmt-animwrap"' in out
    assert out.index('id="fmt-dup"') < out.index('id="fmt-txlab"')
    # slide templates live in a ribbon Layouts dropdown while editing; the
    # panel keeps the catalog only in create mode and stays slim in edit
    assert 'id="lay-btn"' in out and 'id="layout-menu-grid"' in out
    assert ".deck.editing #layout-row{display:none;}" in out
    assert "min(var(--dc-w),248px)" in out
    # the ribbon part-picker pills dress like the other ribbon buttons
    assert "#fmt-parts .cellpartbtn{" in out
    # plot-trace tabs get a real sidebar (lineage nav) and Tree view
    assert "aria-label','Plot lineage'" in out.replace('"', "'")
    # URL routing: a unique, restorable hash per view (#/doc/<stem>, #/pres/…)
    assert "function applyHash" in out and "APP.updateHash=updateHash" in out
    assert "'#/doc/'" in out and "'#/pres/'" in out
    assert "window.SemApp.deckOpen" in out and "window.SemApp.deckState" in out
    assert "window.SemApp.deckGo" in out   # move slide without reopening the mode
    assert "APP.applyInitialRoute" in out and "'hashchange'" in out
    # in-app nav uses replaceState (no back-stack flood); a late-mounting tab
    # (web restore) satisfies a still-pending initial route
    assert "history.replaceState" in out and "pendingRoute" in out
    assert "document.addEventListener('sem:shell'" in out
    # builder workflow: a presentation opens in the slide EDITOR by default
    assert out.count("openDeck('edit')") >= 2
    # the "+ Notebook cell" tool (now a plain tool, not a cyan bigcell), the
    # "+ Shapes" dropdown, and Present relocated into the slide tool bar
    assert 'data-tool="cell"' in out and "Notebook cell" in out
    assert "et-bigcell" not in out
    assert 'id="sh-btn"' in out and 'id="sh-menu"' in out and "var SHAPE_LIST" in out
    # ONE mode toggle (dc-edit) swaps slide-editor <-> notebook view; the old
    # separate "et-notebook" button, "Done" and the "Back to slide" pill are gone
    assert "Swap to notebooks" in out and "Swap to edit view" in out
    assert 'id="et-notebook"' not in out
    assert 'id="et-done"' not in out and 'id="slide-return"' not in out
    # a markdown cell frame carries its own text + background colour
    assert "function applyCellColor" in out and "--nb-tx" in out
    assert "a.txcol=sw.dataset.c" in out and "a.bgcol=sw.dataset.c" in out
    # professional colour picker: hex / rgb / rgba + alpha + custom swatches
    assert 'id="color-pop"' in out and 'id="sw-custom"' in out
    assert 'id="swbg-custom"' in out and 'id="cp-hex"' in out
    assert 'id="cp-rgb"' in out and 'id="cp-alpha"' in out
    assert "function parseColor" in out and "function openColorPop" in out
    # shapes render as SVG paths (star/cloud/…) or glyphs (!/?); box+ellipse CSS
    assert "var SHAPE_PATHS" in out and "function drawShapeSvg" in out
    assert ".an-rect.an-svgshape" in out and "an-shape-svg" in out
    assert 'id="fmt-op"' in out and 'id="fmt-rotl"' in out
    # rich slide editor: precise pt size, alignment, underline/strike, a
    # CONTINUOUS opacity slider (not fixed steps), and per-deck slide numbers
    assert 'id="fmt-size"' in out and 'id="fmt-align"' in out
    assert 'id="fmt-under"' in out and 'id="fmt-strike"' in out
    assert 'id="fmt-op"' in out and 'type="range"' in out
    assert 'id="mi-nums"' in out and "slide-pageno" in out
    # images + crop-to-shape (images AND notebook cells)
    assert 'id="et-image"' in out and 'id="img-file"' in out
    assert "function applyCrop" in out and "var CROP_CLIP" in out
    assert 'id="fmt-crop"' in out and "an-image" in out
    # group / ungroup with multi-select
    assert 'id="fmt-group"' in out and 'id="fmt-ungroup"' in out
    assert "function groupMembers" in out and "function paintSel" in out
    # rich text: recolour just the highlighted run
    assert "function colorSelection" in out and "function sanitizeRich" in out
    # build animations (reveal on click)
    assert 'id="fmt-anim"' in out and "function slideBuildIdx" in out
    assert "an-prebuild" in out and "an-anim-fade" in out
    # hardening from the adversarial review of the editor batch:
    # - rich-text sanitiser parses INERTLY (template) + re-walks unwrapped nodes
    assert "createElement('template')" in out and "tpl.content" in out
    # - Crop/Animate menus float (position:fixed) out of the format-bar overflow
    assert "function floatMenu" in out and "menu.style.position='fixed'" in out
    # - the slide-numbers preference survives normalisation/reload
    assert "out.showNums=1" in out
    # - selection never carries across slides (no phantom group moves/crashes)
    assert "selAnnot=null;selSet=[];refresh()" in out
    assert "if(cur===prev) return" in out
    # - formatting applies to the whole selection; text-align actually positions
    assert "targets=selSet.filter" in out and "flex:1;}" in out
    # launch-polish batch: undo/redo, PDF export, arrow-nudge, bigger tour text
    assert 'id="dc-undo"' in out and 'id="dc-redo"' in out
    assert "function undo(){" in out and "function histPush()" in out
    assert 'id="mi-pdf"' in out and "function printDeck" in out \
        and "print-page" in out
    assert "function nudgeSel" in out
    assert ".tour-text{font-size:15.5px" in out
    # PowerPoint-style ribbon: labelled groups; colour swatches for arrows/shapes
    assert "edit-tools ribbon" in out and 'class="rbn-grp"' in out
    assert 'class="rbn-lab"' in out and "function syncRibbonGroups" in out
    assert "colourable=isText||kind==='arrow'||kind==='rect'" in out
    # crop is a visual shape picker (icons) + a cropped figure fills its frame;
    # animations get an "Appear" effect + a build-order pane (items can share a
    # build so they appear together)
    assert "function cropIcon" in out and "an-cropped" in out
    assert "function slideBuildSteps" in out and "function animSeq" in out
    assert "anim-pane" in out and "anim-effb" in out
    assert "['appear','Appear']" in out and "an-anim-fade" in out
    assert 'id="theme-btn"' in out
    # Raw / Tree / Present are one unit and never wrap apart; Help and
    # Support moved behind a "…" so the bar fits on one row
    assert 'class="btn-grp" id="view-grp"' in out
    assert (out.index('id="view-grp"') < out.index('id="view-raw"')
            < out.index('id="doc-present"') < out.index('id="theme-btn"'))
    assert 'id="more-btn"' not in out   # nothing hidden behind a menu
    assert ".btn-grp{display:flex" in out
    # …and present mode carries the group, not the loose buttons
    assert "'#ab-size','#ab-view'" in out
    # the present bar is ONE wrapping flow (display:contents), not two
    # flex items that each shrink and wrap inside themselves
    assert "body.pbpos-top .pb-tools,body.pbpos-top .pb-own{display:contents;}" in out
    assert "body.pbpos-top .pb-own #pb-rail{margin-left:auto;}" in out
    assert 'id="fmt-font"' in out and "body.light .apptop" in out
    assert "apptip" in out
    assert 'id="fmt-list"' in out and 'id="fmt-shape"' in out
    assert 'id="fmt-dup"' in out and 'id="fmt-front"' in out
    assert 'id="pickbar"' in out and 'id="fmt-replace"' in out
    # top-left declutter: no "docs" label; the hamburger sits on the tab
    # line, and Open has moved up to the ribbon's file group
    assert 'class="tabs-label"' not in out
    assert (out.index('class="tabsrow"') < out.index('id="menubtn"')
            < out.index('id="tabstrip"'))
    assert 'class="tabrow-open"' not in out
    assert ".tabsrow .menubtn" in out
    # slide-editor declutter: an unselected edit frame is transparent + borderless
    # and its chrome (border/title/Replace/parts) returns only when selected
    assert (".deck.editing .an-cell{cursor:move;background:none;"
            "border-color:transparent" in out)
    assert ".deck.editing .an-cell.sel .an-cellbtn{display:block" in out
    assert ".deck.editing .an-cell.sel .cellparts" in out
    # Object controls (Replace + code/figure/output part-picker) now live in
    # the ribbon, not floating on the frame; a placed figure is just the figure
    assert 'id="fmt-parts"' in out and "rbn-partslot" in out
    # a figure frame hugs its plot: the frame element fits the image's
    # contained rect with no inner padding and no title header, so the
    # selection outline sits exactly on the plot
    assert "function fitFigFrame" in out and "an-figonly" in out
    assert "function figFit" in out
    assert ".an-cell.an-figonly .figframe{padding:0;}" in out
    assert ".an-cell.an-figonly .cardbody{padding:0;}" in out
    # ribbon Object group: Locate in notebook jumps to the frame's source card
    assert 'id="fmt-locate"' in out and "#fmt-locate" in out
    # thumbnail slide surfaces clip overflow (a figure dragged past the slide
    # edge can't bleed into the next thumbnail)
    assert "margin:0;width:100%;overflow:hidden" in out
    # tree canvas sizes to its widest lane so centered lanes never clip left
    assert "width:max-content" in out
    # the empty placeholder keeps its dashed box; the header is an overlay
    # (out of flow) so selecting a frame doesn't reflow the figure
    assert ".deck.editing .an-cell.empty{background:#0e192699" in out
    assert ".deck.editing .an-cell.sel .an-cellhead" in out
    assert ".pane.filled .an-cellhead{position:absolute" in out
    pres_f = _as_presentations([{"name": "a", "folder": "paper 1",
                                 "slides": []}])
    assert pres_f[0]["folder"] == "paper 1"
    assert 'id="pr-newfold"' in out
    # code-trace hidden-step list survives normalization (per slide)
    pres_h = _as_presentations([{"name": "h", "slides": [
        {"layout": "blank", "panes": [],
         "annots": [{"k": "cell", "x": 5, "y": 5, "w": 40, "h": 40,
                     "ref": "clim"}],
         "hidden": ["nb::cell:c-prep", ""]}]}])
    assert pres_h[0]["slides"][0]["hidden"] == ["nb::cell:c-prep"]
    # the code trace is one reusable component (presentation + docs popup)
    assert "vo-eye" in out and "function renderTrace" in out
    assert "function traceNode" in out and "function lineageForItem" in out
    # docs "view plot trace" opens a NEW TAB: the docs view subset to the
    # plot's lineage cells (a real .nbshell, all filters live) + a graph
    assert 'class="plot-trace-btn"' in out and "function openTraceTab" in out
    assert "function plotGraph" in out and ".nbshell.tracetab" in out
    assert "window.SemTrace" in out and ".pg-node" in out
    assert "APP.openTraceTab" in out and "APP.traceGoto" in out
    # an inactive trace tab must still hide: the display rule is scoped so it
    # never overrides .nbshell[hidden]{display:none}
    assert ".nbshell.tracetab:not([hidden]){display:grid" in out
    # a placed clone resolves to its source notebook (dataset.src)
    assert "shell.dataset.src=stem" in out
    # the trace tab shares the docs per-card wiring (true subset, not a widget)
    assert "function wireCardBehaviors" in out and "APP.wireCardBehaviors" in out
    # a trace tab renders as a SUB-tab nested under its source notebook tab
    assert "tab-sub" in out and "function makeTab" in out
    # a markdown note that NAMES a variable is linked into that variable's
    # plot trace: it rides along as a trace CARD (up.kind==='note') but is
    # excluded from the dependency graph (s.kind!=='note', avoids note<->definer
    # cycles) and never leaks a code trail into the presentation (note frames)
    assert "up.kind==='note'" in out
    assert "s.kind!=='note'" in out
    assert "f.it.kind==='note') return" in out
    _lnb = parse_notebook({"cells": [
        {"cell_type": "code", "source": "ridge_index = 1", "outputs": []},
        {"cell_type": "markdown", "source": "The `ridge_index` and z500 matter."},
        {"cell_type": "code", "source": "z500 = 2", "outputs": []},
        {"cell_type": "code", "source": "fig = ridge_index + z500", "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]})
    _lnote = [it for s in _lnb.sections for it in s.items if it.is_note][0]
    _lfig = [it for s in _lnb.sections for it in s.items
             if it.kind in ("figure", "diagnostic")][0]
    assert (_lnote.anchor or _lnote.item_id) in _lfig.chain   # note rides along
    assert _lnote.chain                                       # note -> its vars
    # a plain-word variable named in prose (no backticks) must NOT over-link
    _pnb = parse_notebook({"cells": [
        {"cell_type": "code", "source": "warm = 1", "outputs": []},
        {"cell_type": "markdown", "source": "We study warm events in summer."},
        {"cell_type": "code", "source": "fig = warm + 1", "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]})
    _pnote = [it for s in _pnb.sections for it in s.items if it.is_note][0]
    _pfig = [it for s in _pnb.sections for it in s.items
             if it.kind in ("figure", "diagnostic")][0]
    assert (_pnote.anchor or _pnote.item_id) not in _pfig.chain
    # the retired focus-mode machinery is gone
    assert "focusStem" not in out and 'id="focusbar"' not in out
    # toolbar: content filters, a grouping divider, Open moved to the tab line
    assert 'class="appbar-div"' in out
    assert 'id="tab-open"' in out
    _ap = out.index('id="tv-plots"')          # filter order plots→…→output-types
    assert (_ap < out.index('id="tv-markdown"') < out.index('id="tv-code"')
            < out.index('id="ck-filter-btn"') < out.index('id="tv-output"')
            < out.index('id="ot-filter-btn"'))
    # sections collapse + hide in the MAIN view (chevron + eye), synced to nav
    assert 'class="sec-chev"' in out and 'class="sec-eye"' in out
    assert 'class="navsec-eye"' in out
    # TWO hide actions per section (2026-07-29): the eye takes the HEADING
    # only (the cards stay), and a second, word-labelled button takes the
    # whole section. Both exist in the document and in the sidebar.
    assert 'class="sec-hideall"' in out and 'class="navsec-hideall"' in out
    assert 'title="Hide just this heading (the cards below stay)"' in out
    assert ">hide section</button>" in out
    assert "function setSecHeadOff" in out and "function isHeadOff" in out
    assert ".section.sec-headoff .sectionhead-txt{display:none;}" in out
    # a hidden heading leaves NO trace in the feed: the sidebar is the only
    # place it shows, and "Show all hidden" is the way back
    assert ".section.sec-headoff .sectionhead{display:none;}" in out
    assert 'class="rf-btn rf-unhide"' in out
    # the presentations rail can auto-hide, OFF by default
    assert 'id="pr-auto" aria-pressed="false"' in out
    assert "body.prrail-auto.prrail-peek .presrail{transform:none;}" in out
    assert "'junoview:presrail:auto'" in out
    assert "function syncUnhideBtn" in out
    # tree view: filters are DISABLED, not removed (a control that
    # vanishes drags its neighbours' positions with it), and the Size
    # stepper drives the tree zoom from the same place on the ribbon
    assert "function syncTreeRibbon" in out
    # tree view REMOVES the filter sections; Size/View/App are anchored to
    # the right by an auto margin so they do not slide into the hole
    assert "#ab-size{margin-left:auto;}" in out
    assert "document.body.classList.toggle('tree-mode',isTree);" in out
    assert out.count('class="appbar-div filt-div"') == 2
    assert "APP.ribbonSizeStep=function(dir)" in out
    assert "if(!APP.ribbonSizeStep(1)) bumpFigAll(1.15);" in out
    assert "cap.textContent=isTree?'Tree':'Figures'" in out
    assert "top:calc(var(--chrome-h) + 6px)" in out
    # a centred bar slides sideways when the scrollbar comes and goes
    assert "scrollbar-gutter:stable" in out
    # the View stack is a FIXED slot: the Tree button renames itself to
    # "Document" and a wider word would shove Present sideways
    assert ".vw-stack{display:flex;flex-direction:column;gap:4px;flex:none;\n  min-width:124px;}" in out
    assert ">Match document</button>" in out
    # it is a REVEAL toggle, not a reset: nothing about what is hidden
    # changes, so one more click puts it all back
    assert ".nbshell.reveal-hidden .section.sec-headoff .sectionhead{display:flex;}" in out
    assert "shell.classList.toggle('reveal-hidden')" in out
    assert "'Hide them again ('+n+')'" in out
    # every exported page names the tool (a generator tag, not a fake
    # description of someone else's notebook)
    assert '<meta name="generator" content="Junoview' in out
    assert "https://junoview.dev" in out
    assert "body.pbpos-top .pb-exit{position:absolute;top:8px;right:48px" in out
    # the only :hover on a hidden head is the REVEAL one, which needs the
    # .reveal-hidden ancestor — an UNPREFIXED rule (one starting a line)
    # would bring the ghost stub back
    assert "\n.section.sec-headoff .sectionhead:hover" not in out
    assert ".navsec-row.head-off .navsec-t{opacity:.55;" \
        "text-decoration:line-through;" in out
    # ...and it is part of the saved layout, like every other view setting
    assert "secsHeadOff:$$('.section.sec-headoff'" in out
    assert "(keep.secsHeadOff||[]).forEach" in out
    assert "st.secsHeadOff||[]" in out
    # the two feed-wide sizers are layout too
    assert "st.figall=APP.getFigAll?APP.getFigAll():1;" in out
    assert "st.mdall=APP.getMdAll?APP.getMdAll():1;" in out
    assert "if(APP.setFigAll) APP.setFigAll(st.figall||1);" in out
    assert "if(APP.setMdAll) APP.setMdAll(st.mdall||1);" in out
    # ONE snapshot builder feeds both the layout cache and a custom view
    assert "function layoutSnapshot" in out and "function applySnapshot" in out
    assert "APP.layoutSnapshot=layoutSnapshot;" in out
    assert "APP.applySnapshot=function(stem,st)" in out
    assert ".section.sec-collapsed .card{display:none" in out
    assert ".section.sec-off{display:none" in out
    assert "function setSecCollapsed" in out and "function setSecOff" in out
    # the presentation code-trail has its OWN Code-types / Output-types filters
    assert "function traceFilterDropdown" in out and ".vo-step.vo-filtered" in out
    assert "var traceCkHidden" in out and "function applyTraceFilter" in out
    # presentation trail sections collapse + hide (chevron + eye), like the docs
    assert ".vo-sec-chev" in out and ".vo-sec-eye" in out
    assert ".vo-sec-body.vo-sec-fold{display:none" in out
    # the trail toolbar clears the ↑ arrow, and its buttons match the docs
    assert "padding:64px 0 60px" in out
    assert ".vo-xall,.vo-fbtn{font-family:var(--mono);font-size:11px" in out
    # guided tour (skippable, shown once) + entry points
    assert 'id="tour"' in out and "var TOUR_STEPS" in out
    assert 'id="welcome-tour"' in out and 'id="help-tour"' in out
    assert "function tourShow" in out and "plotline-tour" in out
    # help content covers the new model + what Support funds
    assert "Support this project" in out and "hosted" in _HELP_HTML
    assert "Filtering what you see" in _HELP_HTML and "Plot trace" in _HELP_HTML
    # presentation "Notebooks" popover: open-all / refresh-all
    assert 'id="dc-nbs-btn"' in out and 'id="dc-nbs-menu"' in out
    assert "function renderNbsMenu" in out and "function openPresNbs" in out
    assert "Refresh all" in out and "Open notebooks" in out
    pres3 = _as_presentations([{"name": "x", "slides": [
        {"layout": "title", "title": "T",
         "tprops": {"x": 30, "y": 20, "size": 5}},
        {"layout": "blank",
         "annots": [{"k": "cell", "x": 1, "y": 1, "w": 40, "h": 40,
                     "ref": "demo::clim"}]},
    ]}])
    assert pres3[0]["slides"][0]["tprops"]["x"] == 30
    blank = pres3[0]["slides"][1]
    assert blank["panes"] == [] and blank["annots"][0]["ref"] == "demo::clim"
    assert "lay-picker" in out and "an-cellbtn" in out

    # raw notebook view: cells as authored, directives visible
    assert 'id="view-raw"' in out and 'class="rawview"' in out
    assert 'class="rawcell code"' in out and "#| display: metric" in out
    assert 'class="rawcell md"' in out

    # multi-notebook page: two tabs, per-shell data, cross-notebook deck
    nb2 = {"cells": [
        {"cell_type": "markdown", "source": "# Second notebook"},
        {"cell_type": "code", "id": "x1",
         "source": "#| display: figure\n#| id: sst\n#| title: SST map\nplot()",
         "outputs": []},
    ]}
    doc_a = parse_notebook(nb)
    doc_a.source_name = "demo"
    doc_b = parse_notebook(nb2)
    doc_b.source_name = "other"
    page = render_page([doc_a, doc_b], app_cfg={
        "presentations": [{"name": "combo", "slides": [
            {"layout": "halves", "panes": ["demo::clim", "other::sst"]}]}],
    })
    assert page.count('class="shell nbshell"') == 2
    assert 'data-nb="demo"' in page and 'data-nb="other"' in page
    assert 'id="apptop"' in page and 'id="tabstrip"' in page
    assert '"mode": "static"' in page and "demo::clim" in page

    # app-mode page carries the session token and root for the GUI
    app_page = render_page([doc_a], mode="app", app_cfg={
        "token": "tok123", "root": "C:/proj", "paths": {"demo": "x.ipynb"},
        "recent": ["a.ipynb"],
    })
    assert '"mode": "app"' in app_page and "tok123" in app_page
    assert 'data-path="x.ipynb"' in app_page

    # decks survive notebook edits: anchors are ids, never positions —
    # reordering cells and editing text must keep every anchor alive
    import copy
    nb_edit = copy.deepcopy(nb)
    nb_edit["cells"] = list(reversed(nb_edit["cells"]))
    for c in nb_edit["cells"]:
        if c.get("id") == "md1":
            c["source"] = "EDITED prose, same cell id"
    doc_e = parse_notebook(nb_edit)
    anchors_e = {it.anchor for s in doc_e.sections for it in s.items}
    assert "clim" in anchors_e and "cell:md1" in anchors_e
    assert "fig2" in anchors_e

    # server helpers: directory listing shape + stem dedupe
    listing = _list_dir(str(Path(__file__).parent))
    assert {"dir", "parent", "dirs", "notebooks"} <= set(listing)
    assert _stem_for(Path("a/nb.ipynb"), {"nb"}) == "nb-2"

    # URLs: GitHub normalization + the client-side web build
    assert _normalize_nb_url(
        "https://github.com/u/r/blob/main/d/nb.ipynb") \
        == "https://raw.githubusercontent.com/u/r/main/d/nb.ipynb"
    assert _is_url("https://x/y.ipynb") and not _is_url("C:/y.ipynb")
    shell = web_parse("demo.ipynb", json.dumps(nb), '["demo"]')
    assert 'data-nb="demo-2"' in shell
    web_page = render_page([], mode="web")
    assert '"mode": "web"' in web_page and 'id="fileinput"' in web_page
    assert 'id="helpdlg"' in web_page and 'id="help-btn"' in web_page
    assert "ko-fi.com/plotline" in web_page
    assert 'id="support-btn"' in web_page
    assert 'id="welcome-demo"' in web_page
    # welcome screen: big wordmark, a real tagline, a narrative lead + a note
    # a tight welcome hero: big logo, wordmark, one tagline, prominent buttons
    assert 'class="welcome-hero"' in web_page and 'class="welcome-wordmark"' in web_page
    assert "Filter, view and present your Jupyter notebooks" in web_page
    assert 'class="welcome-btns"' in web_page and 'id="welcome-open"' in web_page
    # BOTH open paths are explicit on the welcome: local files and a
    # GitHub/URL button that opens the dialog focused on the URL input
    assert 'id="welcome-url"' in web_page and "'#welcome-url'" in out
    # GitHub raw fetches bust the CDN cache (server + web builds; the raw
    # CDN otherwise serves stale content for minutes), and a notebook
    # refresh keeps the VIEW: hidden cells/sections, collapsed sections,
    # tree/raw mode and scroll all survive the shell swap
    assert _cache_bust("https://raw.githubusercontent.com/a/b/c.ipynb"
                       ).startswith(
        "https://raw.githubusercontent.com/a/b/c.ipynb?jvr=")
    assert _cache_bust("https://example.com/n.ipynb") \
        == "https://example.com/n.ipynb"
    assert "cache:'no-store'" in out and "jvr='+Date.now()" in out
    assert "function captureViewState" in out
    assert "function restoreViewState" in out
    assert "APP.mountShellHTML=mountShellHTML" in out
    # playback code trace: with several plots, the thumbnails PICK whose
    # trace shows (one at a time), and a Cells|Tree switch reuses the docs
    # dependency tree under the slide (dark in both themes, no Present btn)
    assert "var traceSel=0" in out and "traceView='cells'" in out
    assert "function traceTreeNode" in out and "vo-thumb-btn" in out
    assert "function relayoutTreeHost" in out
    assert ".deck-tracetree .tt-present{display:none" in out
    assert ".deck-tracetree .tree-node{" in out
    # per-frame figure rescue: every live clone is remembered; a notebook
    # reload rotates snapshots to "previous"; the ribbon's Previous/Live
    # figure button swaps ONE frame without touching the others
    assert "var frameSnaps={},frameSnapsPrev={}" in out
    assert "frozenFrames=new WeakMap()" in out
    assert "function framePartFromSnap" in out and "an-frozenchip" in out
    assert 'id="fmt-revert"' in out and "Previous figure" in out
    # automatic notebook versions: stored per open/reload (deduped, capped),
    # listed + reopened from the tab's ⌚ menu into the SAME stem/path
    assert "'/api/versions'" in out and "'/api/openversion'" in out
    # File info: path + git commit + version history, in the sidebar where
    # you can find it (reload moved off the tab and sits beside it)
    assert "function wireFileInfo" in out and 'class="rf-panel"' in out
    assert "rf-info" in out and "rf-reload" in out
    assert "current commit" in out
    # the HASH is the way in: clicking it expands every version, each
    # openable — for a local repo AND for a notebook opened from GitHub
    assert "function hashRow" in out and "function commitList" in out
    assert ".rf-hashbtn" in out and ".rf-commits" in out
    assert "function ghFromUrl" in out and "function ghCommits" in out
    assert "raw.githubusercontent.com" in out and "api.github.com" in out
    assert "function ghRawAt" in out
    assert "GitHub rate limit" in out
    assert "tab-verbtn" not in out      # the buried tab buttons are gone
    assert "function showVersMenu" in out
    # …and the ⌚ menu also lists the notebook's GIT history (short hash +
    # commit message + date), opening the notebook as it was at any commit
    assert "git commits" in out and "vers-sub" in out
    assert "commit:cm.id" in out and "'git:'+cm.id" in out
    # figure LOCKS: pin a frame to a git commit — refresh can't touch it,
    # a closed notebook still renders it, Lock/Unlock all + prefetch live
    # in the Notebooks menu, and the chip names the commit
    assert 'id="fmt-lockver"' in out and "a.lockver" in out
    assert "'/api/versioncards'" in out and "function fetchVerCards" in out
    assert "function lockAllFrames" in out
    assert "function unlockAllFrames" in out and "window.confirm" in out
    assert "function loadLockedVersions" in out and "an-lockchip" in out
    assert "function frameFromVerCard" in out and "an-verwait" in out
    # resize from ANY corner (opposite corner anchored) + a free-rotation
    # grip above the item (Shift snaps to 15°)
    assert "an-rs-nw" in out and "an-rs-sw" in out \
        and "t.dataset.corner" in out
    assert "function startRotate" in out and "an-rotate" in out
    # multi-select arrange: Row / Grid, and "Same size" matching the
    # first/last-selected (or largest/smallest) item
    assert 'id="fmt-arline"' in out and 'id="fmt-argrid"' in out
    assert "function arrangeRow" in out and "function arrangeGrid" in out
    assert "function sameSize" in out and 'id="fmt-same-menu"' in out
    # classifier honesty: imports + real work reads "imports · code", a
    # fully commented-out cell is its own filterable "comments" kind
    assert _classify_code(
        "import dask\n\ngw = dask.Gateway()\ngw.scale(20)") \
        == ["imports", "code"]
    assert _classify_code("import x\nimport y") == ["imports"]
    assert _classify_code("# only\n# comments") == ["comments"]
    assert _classify_code("") == ["code"]
    assert "'comments','constant','code']" in out
    assert ".ckf-dot.ckmain-comments" in out
    # authored headings never vanish: a `#` followed straight by another
    # heading keeps BOTH sections (header-only sections render fine)
    hdoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Trends"},
        {"cell_type": "markdown", "source": "# Functions"},
        {"cell_type": "code", "source": "x = 1", "outputs": []}]})
    assert [s.title for s in hdoc.sections] == ["Trends", "Functions"]
    # THREE section tiers: #/##/### are all real sections (levels 1/2/3)
    # with outline numbers; #### stays an in-section kicker label
    tdoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Opening and Processing"},
        {"cell_type": "markdown", "source": "## ERA5"},
        {"cell_type": "markdown", "source": "### Processing"},
        {"cell_type": "code", "source": "p = 1", "outputs": []},
        {"cell_type": "markdown", "source": "#### Opening"},
        {"cell_type": "code", "source": "q = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## CMIP6"}]})
    assert [(s.title, s.level, s.number) for s in tdoc.sections] == [
        ("Opening and Processing", 1, "1"), ("ERA5", 2, "1.1"),
        ("Processing", 3, "1.1.1"), ("CMIP6", 2, "1.2")]
    proc = tdoc.sections[2]
    assert [it.subsection for it in proc.items] == ["", "Opening"]
    # a document that never uses h1 drops the unused leading counter
    t2 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "## A"},
        {"cell_type": "markdown", "source": "### B"}]})
    assert [(s.number) for s in t2.sections] == ["1", "1.1"]
    # a tier the document NEVER uses vanishes from numbers ("1.1", not the
    # phantom "1.0.1"); a tier that exists but hasn't opened yet stays 0 so
    # two sections can never share a number ("0.1" / "1" / "1.1")
    t3 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# A"},
        {"cell_type": "markdown", "source": "### B"},
        {"cell_type": "markdown", "source": "### C"}]})
    assert [s.number for s in t3.sections] == ["1", "1.1", "1.2"]
    t4 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "## A"},
        {"cell_type": "markdown", "source": "# B"},
        {"cell_type": "markdown", "source": "## C"}]})
    assert [s.number for s in t4.sections] == ["0.1", "1", "1.1"]
    # a LATE "### Overview" must not claim the synthetic preamble bucket
    # and teleport its content to the top (the claim window closes at the
    # first heading)
    t5 = parse_notebook({"cells": [
        {"cell_type": "code", "source": "import os", "outputs": []},
        {"cell_type": "markdown", "source": "# Intro"},
        {"cell_type": "markdown", "source": "### Overview"},
        {"cell_type": "code", "source": "late = 1", "outputs": []}]})
    assert [s.title for s in t5.sections] == \
        ["Overview", "Intro", "Overview"]
    assert t5.sections[0].level == 2 and t5.sections[2].level == 3
    assert "late = 1" in t5.sections[2].items[0].members[0]["code"]
    # "#| section:" groups by name at TIER 2 only — a positional ###
    # sub-heading sharing the name must not capture directive cells
    t6 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Model A"},
        {"cell_type": "markdown", "source": "### Summary"},
        {"cell_type": "code", "source": "sa = 1", "outputs": []},
        {"cell_type": "code", "source": "#| section: Summary\nsx = 1",
         "outputs": []}]})
    t6_sum = [s for s in t6.sections if s.title == "Summary"]
    assert len(t6_sum) == 2
    assert t6_sum[0].level == 3 and t6_sum[1].level == 2
    assert "sx = 1" in t6_sum[1].items[0].members[0]["code"]
    # section slugs live in their own namespace: a ### heading never
    # steals a same-titled card's slug (deck refs stay stable)
    t7 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "### Trend map"},
        {"cell_type": "code", "source": "#| title: Trend map\nplot()",
         "outputs": []}]})
    assert t7.sections[0].section_id == "sec-trend-map"
    assert t7.sections[0].items[0].item_id == "trend-map"
    # the playback trace partitions by section ID (same-titled sections
    # stay apart) and labels the divider with the outline number
    assert "var sec=st.section||st.sectitle||''" in out
    assert '"secnum"' in out
    # tiers reach the DOM: data-level + tier classes on sections, nav rows
    # and cell lists; the eyebrow carries the outline number; and the
    # collapse/hide CASCADE (an ancestor folds the deeper tiers) shipped
    assert 'data-level="2"' in out and "sectionhead-l" in out
    assert ".sectionhead-l3 h2" in out and ".navsec-l3" in out
    assert "navitems-l" in out and '<span class="eyebrow">section 1<' in out
    assert "function recalcSecCascade" in out
    assert ".section.sec-under,.section.sec-under-off{display:none;}" in out
    assert ".navsec-row.nav-under,.navitems.nav-under{display:none;}" in out
    # a defaultdict repr is a DICT for the Output-types filter, and the
    # card badge speaks the same language (so unchecking it works)
    assert _repr_kind("defaultdict(dict, {'a': 1})") == "dict"
    odoc = parse_notebook({"cells": [{"cell_type": "code", "source": "d",
        "outputs": [{"output_type": "execute_result", "data":
                     {"text/plain": "defaultdict(dict, {'a': 1})"}}]}]})
    o_html = render_item(odoc.sections[0].items[0])
    assert 'data-ot="dict"' in o_html and '>dict</span>' in o_html
    # markdown notes: minimal chrome — no badge, untitled notes drop the
    # "Note" row, hover says markdown, raw-HTML toggle floats minimal,
    # and note tables render as real tables
    assert "note-untitled" in out
    assert 'content:"markdown"' in out
    assert ".note table{border-collapse:collapse" in out
    assert ".htmltoggle{position:absolute" in out
    assert '.card[data-note="1"] .badge{display:none;}' in out
    import tempfile
    with tempfile.TemporaryDirectory() as vtd:
        vf = Path(vtd) / "exp.ipynb"
        vf.write_text('{"cells": []}', encoding="utf-8")
        _store_version(vf)
        _store_version(vf)      # unchanged -> deduped, still one snapshot
        vs = list(_versions_dir(vf).glob("*.ipynb"))
        assert len(vs) == 1
        vf.write_text('{"cells": [1]}', encoding="utf-8")
        _store_version(vf)
        assert len(list(_versions_dir(vf).glob("*.ipynb"))) == 2
    assert "Open\n          local files" in out.replace("\r\n", "\n") \
        or "Open local files" in re.sub(r"\s+", " ", out)
    # the getting-started steps moved to the bottom (seen on scroll)
    assert 'class="welcome-more"' in web_page and web_page.count('class="ws-n"') == 4
    # rebrand: PlotLine -> Junoview, with the peacock-eye ocellus mark
    assert "Junoview" in out and "PlotLine" not in out
    assert out.count('class="jv-logo"') >= 2   # welcome hero + presrail brand
    assert 'rel="icon"' in out and "data:image/svg+xml," in out
    assert "<title>Junoview" in web_page
    assert 'content="Junoview"' in _WEB_LOADER and "PlotLine" not in _WEB_LOADER
    # the GitHub repo link is intentionally NOT surfaced in the UI (privacy)
    assert _REPO_URL not in web_page
    assert "#| title:" in web_page          # directives documented in help
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        build_web(Path(td))
        idx = (Path(td) / "index.html").read_text(encoding="utf-8")
        assert "pyodide" in idx and "sem:pyready" in idx
        assert (Path(td) / "semantic_render.py").exists()
    # project file renamed to junoview_project.json, but an existing
    # plotline_project.json (or older semantic_project.json) still loads
    assert _PROJECT_FILE == "junoview_project.json"
    with tempfile.TemporaryDirectory() as td:
        (Path(td) / "plotline_project.json").write_text(
            '{"presentations": [{"name": "legacy", "slides": []}]}',
            encoding="utf-8")
        proj = _AppState(Path(td))
        assert [p["name"] for p in proj.presentations] == ["legacy"]

    print("self-test ok:", len(out), "bytes;",
          sum(len(s.items) for s in doc.sections), "items;",
          "presentations:", len(doc.presentations))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Semantic notebook environment: run with no arguments "
        "to launch the local GUI app (open .ipynb files as tabs), or pass "
        "notebook path(s) to export a static HTML page.")
    p.add_argument("notebooks", nargs="*",
                   help="path(s) to executed .ipynb notebooks; several "
                   "render as tabs in one page")
    p.add_argument("-o", "--output",
                   help="output .html (default: alongside the notebook, or "
                   "semantic_view.html for a multi-notebook bundle)")
    p.add_argument("--title", help="override the analysis title "
                   "(single-notebook export only)")
    p.add_argument("--deck", help="presentation deck JSON to use "
                   "(default: <notebook>.deck.json sidecar, then embedded "
                   "metadata)")
    p.add_argument("--embed-deck", metavar="DECK_JSON",
                   help="write DECK_JSON into the notebook's "
                   "metadata.semantic.presentations (modifies the .ipynb) "
                   "and exit")
    p.add_argument("--app", action="store_true",
                   help="launch the local GUI app (implied when no "
                   "notebooks are given); listed notebooks preload as tabs")
    p.add_argument("--root", help="app mode: folder for the file browser "
                   "and semantic_project.json (default: the first "
                   "notebook's folder, else the current folder)")
    p.add_argument("--port", type=int, default=8765,
                   help="app mode: port to serve on (default 8765; falls "
                   "back to a free port when busy)")
    p.add_argument("--no-browser", action="store_true",
                   help="app mode: don't auto-open the browser")
    p.add_argument("--build-web", metavar="DIR",
                   help="write the deployable client-side web app "
                   "(index.html + this module, runs Python in the "
                   "browser via Pyodide) into DIR and exit")
    p.add_argument("--self-test", action="store_true",
                   help="run a built-in sanity check and exit")
    args = p.parse_args(argv)

    if args.self_test:
        _self_test()
        return 0

    if args.build_web:
        build_web(Path(args.build_web))
        print(f"wrote web app to {args.build_web}\\index.html")
        print("Deploy: commit that folder and enable GitHub Pages for "
              "it (or drop it on any static host).")
        return 0

    items = list(args.notebooks)
    local = [Path(n) for n in items if not _is_url(n)]

    if args.embed_deck:
        if len(items) != 1 or not local:
            p.error("--embed-deck needs exactly one local notebook")
        if not local[0].exists():
            print(f"error: {local[0]} not found", file=sys.stderr)
            return 1
        embed_deck(local[0], Path(args.embed_deck))
        print(f"embedded {args.embed_deck} into {local[0]} "
              "(metadata.semantic.presentations)")
        return 0

    if args.app or not items:
        root = Path(args.root) if args.root else \
            (local[0].parent if local else Path.cwd())
        if not root.is_dir():
            p.error(f"--root {root} is not a folder")
        preload = [n if _is_url(n) else Path(n) for n in items]
        return run_app(root, preload, port=args.port,
                       open_browser=not args.no_browser)

    missing = [f for f in local if not f.exists()]
    for m in missing:
        print(f"error: {m} not found", file=sys.stderr)
    if missing:
        return 1

    deck = Path(args.deck) if args.deck else None
    single = len(items) == 1
    if not single and args.title:
        print("note: --title is ignored for multi-notebook bundles",
              file=sys.stderr)
    docs, taken = [], set()
    for n in items:
        if _is_url(n):
            doc = doc_from_url(n)
            if single and args.title:
                doc.title = args.title
            if single and deck is not None:
                pres = _as_presentations(
                    json.loads(deck.read_text(encoding="utf-8")))
                if pres:
                    doc.presentations = pres
            doc.source_name = _stem_for(
                Path(doc.source_name + ".ipynb"), taken)
        else:
            doc = load_doc(Path(n),
                           title=args.title if single else None,
                           deck_path=deck if single else None)
            doc.source_name = _stem_for(Path(n), taken)
        taken.add(doc.source_name)
        docs.append(doc)
    cfg = {}
    if not single and deck is not None:
        cfg["presentations"] = _as_presentations(
            json.loads(deck.read_text(encoding="utf-8")))
    html_out = render_page(docs, app_cfg=cfg)
    if args.output:
        out_path = Path(args.output)
    elif single and not _is_url(items[0]):
        out_path = Path(items[0]).with_suffix(".html")
    elif single:
        out_path = Path(docs[0].source_name + ".html")
    else:
        out_path = (local[0].parent if local else Path.cwd()) \
            / "semantic_view.html"
    out_path.write_text(html_out, encoding="utf-8")
    print(f"wrote {out_path}  ({len(html_out)//1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
