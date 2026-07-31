"""Inferring what a cell is when its author did not say.

Most notebooks carry no directives at all, so the renderer guesses: an image
output is a figure, an xarray repr is a dataset, bare text is a print. Code is
classified by walking its AST for the calls it makes -- reading data, plotting,
configuring -- which is what drives the code-type filters in the viewer.
"""

from __future__ import annotations

import ast
import re

from .outputs import RenderedOutput


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
