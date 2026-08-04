"""
junoview.widget
===============

Tier-1 of the semantic notebook renderer: an in-notebook `anywidget` that
renders the *same* figure-first semantic view as the static renderer (it
imports the same parser and the same card HTML), but adds the two things a
dead HTML file cannot do:

  1. View-state that persists back to Python -- hide cards, switch layout,
     collapse the graph; read it back as `widget.view_state`, or
     `widget.export_html(...)` a clean static page with your arrangement baked
     in.
  2. Live recompute -- attach a function (with parameters) to a figure `id`;
     moving a slider re-runs it on the kernel and swaps the figure in place.

Usage
-----
    from junoview.widget import SemanticNotebook

    view = SemanticNotebook.from_ipynb("analysis.ipynb")   # executed notebook

    # optional: make one figure live (others stay static)
    @view.recompute("block_comp", threshold=(0.5, 2.5, 0.1),
                    region=["Tasman", "Ross", "Weddell"])
    def _(threshold, region):
        ...                      # uses your kernel's variables
        return fig               # return a matplotlib Figure

    view                          # display it

Parameter shorthands for `recompute(...)`:
    (lo, hi)        -> slider          (lo, hi, step) -> slider with step
    ["a", "b"]      -> dropdown        5 / 1.5        -> number box
    True            -> checkbox        "text"         -> text box
A dict like {"type": "range", "min": 0, "max": 1, "step": .1, "value": .5}
gives full control.
"""

from __future__ import annotations

import base64
import copy
import html
import io
import json
from pathlib import Path

import anywidget
import traitlets

from .assets import core_css, load
from .notebook.parser import parse_notebook
from .render.items import (
    doc_meta,
    render_graph_panel,
    render_nav,
    render_sections,
)
from .render.page import render_html

_BASE_CSS = core_css()


# --------------------------------------------------------------------------
# CSS scoping: wrap the static stylesheet so it cannot leak into the notebook
# --------------------------------------------------------------------------

def _scope_selectors(prelude: str, root: str) -> str:
    out = []
    for sel in prelude.split(","):
        s = sel.strip()
        if not s:
            continue
        if ":root" in s:
            out.append(s.replace(":root", root))
        elif s in ("body", "html"):
            out.append(root)
        elif s.startswith(root):
            out.append(s)
        else:
            out.append(f"{root} {s}")
    return ",".join(out)


def _strip_comments(css: str) -> str:
    """Drop /* … */ blocks (string-aware, so a comment INSIDE a quoted
    value survives)."""
    out, i, n, instr = [], 0, len(css), None
    while i < n:
        c = css[i]
        if instr:
            if c == instr:
                instr = None
            out.append(c)
        elif c in "\"'":
            instr = c
            out.append(c)
        elif c == "/" and css[i + 1:i + 2] == "*":
            end = css.find("*/", i + 2)
            i = n if end < 0 else end + 1   # +1 more below
        else:
            out.append(c)
        i += 1
    return "".join(out)


def _scope_css(css: str, root: str = ".snb-root") -> str:
    """Prefix every rule in `css` with `root` (comment/quote/paren/brace
    aware).

    Comments MUST go first: this scanner is quote-aware, and an apostrophe
    inside a comment ("the scrollbar's width") read as an opening quote
    swallowed every rule until the next quote character — whole stretches
    of core.css silently vanished from the widget, which is why its card
    headers stacked their title and actions vertically for weeks
    (2026-08-04)."""
    css = _strip_comments(css)
    out, i, n = [], 0, len(css)
    while i < n:
        # scan to the next top-level '{' or ';'
        j, instr, paren = i, None, 0
        while j < n:
            c = css[j]
            if instr:
                if c == instr:
                    instr = None
            elif c in "\"'":
                instr = c
            elif c == "(":
                paren += 1
            elif c == ")":
                paren = max(0, paren - 1)
            elif paren == 0 and c in "{;":
                break
            j += 1
        if j >= n:
            tail = css[i:].strip()
            if tail:
                out.append(tail)
            break
        if css[j] == ";":                      # at-statement, e.g. @import ...;
            out.append(css[i:j + 1].strip())
            i = j + 1
            continue
        prelude = css[i:j].strip()             # block: find matching '}'
        depth, k, instr = 1, j + 1, None
        while k < n and depth:
            c = css[k]
            if instr:
                if c == instr:
                    instr = None
            elif c in "\"'":
                instr = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            k += 1
        inner = css[j + 1:k - 1]
        if prelude.startswith(("@media", "@supports")):
            out.append(prelude + "{" + _scope_css(inner, root) + "}")
        elif prelude.startswith("@"):          # keyframes / font-face: leave
            out.append(prelude + "{" + inner + "}")
        else:
            out.append(_scope_selectors(prelude, root) + "{" + inner + "}")
        i = k
    return "".join(out)


# widget-only styling (plain selectors; scoped by _scope_css below)
_WIDGET_EXTRA = load("css/widget.css")

_WIDGET_MEDIA = load("css/widget-media.css")

# strip the @import (fonts get injected via <link> from JS) then scope
_BASE_NO_IMPORT = "\n".join(
    ln for ln in _BASE_CSS.splitlines() if not ln.strip().startswith("@import"))

_WIDGET_CSS = _scope_css(_BASE_NO_IMPORT + _WIDGET_EXTRA + _WIDGET_MEDIA) + r"""
.snb-root{display:block;border:1px solid var(--line);border-radius:12px;
  overflow:hidden;}
"""


# --------------------------------------------------------------------------
# Front-end (ES module)
# --------------------------------------------------------------------------

# The anywidget front end. A real .js file, like every other script
# this project ships.
_ESM = load("js/widget.js")


# --------------------------------------------------------------------------
# Parameter handling + figure capture (Python side)
# --------------------------------------------------------------------------

def _normalize_params(specs: dict) -> list[dict]:
    out: list[dict] = []
    for name, sp in specs.items():
        d: dict = {"name": name}
        if isinstance(sp, dict):
            d.update(sp)
            d.setdefault("type", "text")
            d.setdefault("value", "")
            d.setdefault("_py", {"range": "float", "number": "float",
                                 "checkbox": "bool"}.get(d["type"], "str"))
        elif isinstance(sp, bool):
            d.update(type="checkbox", value=sp, _py="bool")
        elif isinstance(sp, tuple) and len(sp) in (2, 3) \
                and all(isinstance(x, (int, float)) for x in sp):
            mn, mx = sp[0], sp[1]
            step = sp[2] if len(sp) == 3 else round((mx - mn) / 100, 6)
            is_int = all(isinstance(x, int) for x in sp)
            d.update(type="range", min=mn, max=mx, step=step, value=mn,
                     _py="int" if is_int else "float")
        elif isinstance(sp, list):
            opts = [str(x) for x in sp]
            first = sp[0] if sp else ""
            py = "int" if isinstance(first, int) else (
                "float" if isinstance(first, float) else "str")
            d.update(type="select", options=opts, value=str(first), _py=py)
        elif isinstance(sp, int):
            d.update(type="number", value=sp, step=1, _py="int")
        elif isinstance(sp, float):
            d.update(type="number", value=sp, step="any", _py="float")
        else:
            d.update(type="text", value=str(sp), _py="str")
        out.append(d)
    return out


def _coerce(spec: dict, value):
    py = spec.get("_py", "str")
    try:
        if py == "int":
            return int(round(float(value)))
        if py == "float":
            return float(value)
        if py == "bool":
            return bool(value)
    except (TypeError, ValueError):
        return spec.get("value")
    return value


def _fig_to_b64(fig, dpi: int = 108) -> str:
    import matplotlib.pyplot as plt
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


# --------------------------------------------------------------------------
# The widget
# --------------------------------------------------------------------------

class SemanticNotebook(anywidget.AnyWidget):
    _esm = _ESM
    _css = _WIDGET_CSS

    data = traitlets.Dict().tag(sync=True)
    view_state = traitlets.Dict().tag(sync=True)
    height = traitlets.Int(760).tag(sync=True)

    def __init__(self, document=None, *, nb=None, title=None, height=760, **kw):
        super().__init__(**kw)
        self.height = height
        self._recompute: dict[str, tuple] = {}
        if document is None:
            if nb is None:
                raise ValueError(
                    "provide a parsed `document=`, an `nb=` notebook, "
                    "or use SemanticNotebook.from_ipynb(path)")
            nbd = nb if isinstance(nb, dict) else json.loads(json.dumps(nb))
            document = parse_notebook(nbd, title=title)
        self._doc = document
        self.on_msg(self._on_msg)
        self._build_model()

    # ---- constructors ----------------------------------------------------
    @classmethod
    def from_ipynb(cls, path, *, title=None, height=760) -> SemanticNotebook:
        nb = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(document=parse_notebook(nb, title=title), height=height)

    @classmethod
    def from_notebook(cls, nb, *, title=None, height=760) -> SemanticNotebook:
        return cls(nb=nb, title=title, height=height)

    # ---- model build -----------------------------------------------------
    def _build_model(self) -> None:
        rc = {}
        for iid, (_fn, specs) in self._recompute.items():
            rc[iid] = {"params": [
                {k: v for k, v in s.items() if not k.startswith("_")}
                for s in specs]}
        self.data = {
            "title": self._doc.title,
            "meta": doc_meta(self._doc),
            "nav_html": render_nav(self._doc),
            "graph_panel": render_graph_panel(self._doc),
            "stage_html": render_sections(self._doc),
            "recompute": rc,
        }

    # ---- live recompute --------------------------------------------------
    def recompute(self, item_id: str, **param_specs):
        """Decorator: attach a recompute function to a figure `id`.

        The wrapped function receives the named parameters and should return a
        matplotlib Figure (or draw the current figure)."""
        specs = _normalize_params(param_specs)

        def deco(fn):
            self._recompute[item_id] = (fn, specs)
            self._build_model()        # re-sync so the controls appear
            return fn
        return deco

    def _on_msg(self, _widget, content, _buffers):
        if not isinstance(content, dict) or content.get("type") != "recompute":
            return
        item_id = content.get("id")
        entry = self._recompute.get(item_id)
        if entry is None:
            return
        fn, specs = entry
        raw = content.get("params", {}) or {}
        kwargs = {sp["name"]: _coerce(sp, raw.get(sp["name"], sp.get("value")))
                  for sp in specs}
        output_html = self._run_recompute(fn, kwargs)
        self.send({"type": "recomputed", "id": item_id, "output_html": output_html})

    def _run_recompute(self, fn, kwargs) -> str:
        import matplotlib
        prev = matplotlib.get_backend()
        try:
            matplotlib.use("Agg", force=True)         # headless capture
            import matplotlib.pyplot as plt
            result = fn(**kwargs)
            fig = result if hasattr(result, "savefig") else plt.gcf()
            return (f'<div class="figframe"><img alt="recomputed figure" '
                    f'src="data:image/png;base64,{_fig_to_b64(fig)}"></div>')
        except Exception:
            import traceback
            return f'<pre class="error">{html.escape(traceback.format_exc())}</pre>'
        finally:
            try:
                matplotlib.use(prev, force=True)
            except Exception:
                pass

    # ---- export back to a static page ------------------------------------
    def export_html(self, path) -> str:
        """Write a self-contained static HTML page honouring the current
        view-state (hidden cards are dropped)."""
        doc = copy.deepcopy(self._doc)
        hidden = set((self.view_state or {}).get("hidden", []))
        for s in doc.sections:
            s.items = [it for it in s.items if it.item_id not in hidden]
        doc.sections = [s for s in doc.sections if s.items]
        Path(path).write_text(render_html(doc), encoding="utf-8")
        return str(path)
