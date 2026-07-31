"""Turning stored cell outputs into renderable pieces.

This is a static renderer: it reads the outputs already saved in an executed
notebook and never runs a kernel. The work here is recognising what each output
actually is -- an image, an xarray repr, a DataFrame, an interactive plot,
plain stdout -- and defusing anything unsafe before it reaches the page.
"""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from typing import Any

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

    def repl(m: re.Match) -> str:
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
