"""Inferring what a cell is when its author did not say.

Most notebooks carry no directives at all, so the renderer guesses: an image
output is a figure, an xarray repr is a dataset, bare text is a print. Code is
classified by walking its AST for the calls it makes -- reading data, plotting,
configuring -- which is what drives the code-type filters in the viewer.
"""

from __future__ import annotations

import ast
import re

from .directives import is_directive_line
from .outputs import RenderedOutput

# "no pre-parsed tree supplied — parse it yourself". Distinct from None,
# which a caller passes to mean "parsed already, and it FAILED".
_UNPARSED = object()


def _parse_or_none(source: str) -> ast.Module | None:
    try:
        return ast.parse(source)
    except SyntaxError:
        return None


def _strip_magics(code: str) -> str:
    """Drop IPython magic/shell lines (``%…`` / ``!…``) — not Python, so
    they must go before a dataflow parse (and only there: the raw-source
    readers below keep the cell exactly as written)."""
    return "\n".join(ln for ln in code.splitlines()
                     if not ln.lstrip().startswith(("%", "!")))


def _parse_cell(code: str) -> tuple[ast.Module | None, ast.Module | None]:
    """Parse one code cell's source ONCE, in the two forms readers need.

    Returns ``(tree, tree_nomagic)``: the AST of the raw source (what
    :func:`_title_from_code`, :func:`_plot_title_from_code` and
    :func:`_classify_code` look at) and of the magic-stripped source (what
    the dataflow readers look at — ``_cell_names`` in chains, the variables
    index). Either is None where that form has a SyntaxError. When
    stripping changes nothing the one tree serves both — the ASTs are read,
    never mutated — so a magic-free cell costs a single parse.

    ``parse_notebook`` stashes the pair on each member dict (``"tree"`` /
    ``"tree_nomagic"``) so classify, chains and variables stop re-parsing
    the same cell: previously up to six parses per cell per render.
    """
    tree = _parse_or_none(code)
    stripped = _strip_magics(code)
    if stripped == code:
        return tree, tree
    return tree, _parse_or_none(stripped)


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


def _title_from_code(code: str,
                     tree: ast.Module | None = _UNPARSED) -> tuple[str, bool]:
    """Best-effort title. Returns (title, echo): echo=True when the title
    merely repeats a line of the cell's code — such titles still label the
    item in the nav but are not repeated as a heading on the card.

    ``tree`` is the cell's pre-parsed RAW ast (or None if that parse
    failed); omit it and the code is parsed here."""
    lines = [ln.strip() for ln in code.splitlines() if ln.strip()]
    lines = [ln for ln in lines if not is_directive_line(ln)]
    if lines and lines[0].startswith("#"):
        return (lines[0].lstrip("#").strip() or "Code"), False
    if tree is _UNPARSED:
        tree = _parse_or_none(code)
    funcs: list[tuple[str, bool]] = []      # (name, is_function)
    other = False
    if tree is not None:
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                funcs.append((node.name, True))
            elif isinstance(node, ast.ClassDef):
                funcs.append((node.name, False))
            else:
                other = True
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


def _plot_title_from_code(code: str,
                          tree: ast.Module | None = _UNPARSED) -> str:
    """The title the PLOT gives itself in code.

    ``fig.suptitle("…")``, ``ax.set_title("…")``, ``plt.title("…")`` or a
    ``title=`` / ``title_text=`` keyword (matplotlib, plotly, pandas /
    xarray ``.plot``) — a cell that names its own figure has already been
    titled by its author, just not through a directive. Only LITERAL
    strings count: an f-string or a variable cannot be resolved without
    running the cell, so guessing is worse than declining. Figure-level
    ``suptitle`` wins; otherwise a SINGLE distinct axes-level title —
    four subplots with four different titles name no one card.

    ``tree`` as in :func:`_title_from_code` (the RAW ast, None on failure).
    """
    if tree is _UNPARSED:
        tree = _parse_or_none(code)
    if tree is None:
        return ""

    def lit(node) -> str:
        if (isinstance(node, ast.Constant) and isinstance(node.value, str)
                and node.value.strip()):
            return node.value.strip()
        return ""

    sup: list[str] = []
    axes: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        # method calls only: a bare `title(...)` could be anyone's function
        if isinstance(node.func, ast.Attribute):
            meth = node.func.attr
            if meth == "suptitle" and node.args:
                t = lit(node.args[0])
                if t:
                    sup.append(t)
            elif meth in ("set_title", "title") and node.args:
                t = lit(node.args[0])
                if t:
                    axes.append(t)
        for kw in node.keywords or []:
            if kw.arg in ("title", "title_text"):
                t = lit(kw.value)
                if not t and isinstance(kw.value, ast.Dict):
                    # plotly's title=dict(text="…")
                    for k2, v2 in zip(kw.value.keys, kw.value.values):
                        if isinstance(k2, ast.Constant) and k2.value == "text":
                            t = lit(v2)
                if t:
                    axes.append(t)
    if sup:
        return sup[0]
    uniq = list(dict.fromkeys(axes))
    return uniq[0] if len(uniq) == 1 else ""


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


def _classify_code(code: str,
                   tree: ast.Module | None = _UNPARSED) -> list[str]:
    """The kinds of things a code cell does, in display order. Usually one
    (imports / function / data / settings / plotting / print / constant /
    code); a mixed cell lists several.

    ``tree`` as in :func:`_title_from_code` (the RAW ast, None on failure).
    """
    if tree is _UNPARSED:
        tree = _parse_or_none(code)
    if tree is None:
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
