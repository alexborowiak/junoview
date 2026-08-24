"""The variables index: every top-level name the notebook binds, and where.

Walks each card's member cells once, collecting the names bound by top-level
statements only -- a name assigned inside a function or class body is a local,
not a notebook variable, so the walker recurses into ``if``/``for``/``with``/
``try`` blocks (whose bindings ARE globals) but never into a ``def`` or
``class``. Each binding gets a best-effort display type read off the assigned
expression, and every later card that reads the name is recorded as a use.
The sidebar's Variables view renders this; like everything else in this
package it is static analysis -- nothing is executed.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field

from .chains import _cell_names, _code_cards
from .classify import _UNPARSED, _parse_or_none, _strip_magics
from .model import Document


@dataclass
class VarSite:
    item_id: str                   # card slug ("#card-<item_id>" jumps there)
    title: str                     # the card's display title
    role: str                      # "defined" | "redefined" | "used"


@dataclass
class NotebookVariable:
    name: str
    type_label: str                # fine label: "DataFrame", "str", "module"…
    group: str                     # coarse bucket the by-type view groups on
    sites: list[VarSite] = field(default_factory=list)

    @property
    def def_site(self) -> VarSite | None:
        return next((s for s in self.sites if s.role == "defined"), None)

    @property
    def n_used(self) -> int:
        return sum(1 for s in self.sites if s.role == "used")


# fine labels that mean "tabular / gridded data" regardless of library
_DATA_LABELS = {"DataFrame", "Series", "Dataset", "DataArray", "array"}

# call names → the thing they famously return. Only names whose meaning is
# unambiguous in practice belong here; anything else falls through to the
# generic "name()" label, which is honest about being a call result.
_CALL_RETURNS = {
    "read_csv": "DataFrame", "read_excel": "DataFrame",
    "read_parquet": "DataFrame", "read_table": "DataFrame",
    "read_json": "DataFrame", "read_hdf": "DataFrame",
    "read_pickle": "DataFrame", "read_sql": "DataFrame",
    "read_feather": "DataFrame", "read_orc": "DataFrame",
    "read_stata": "DataFrame", "read_fwf": "DataFrame",
    "open_dataset": "Dataset", "open_mfdataset": "Dataset",
    "open_zarr": "Dataset", "open_rasterio": "Dataset",
    "load_dataset": "Dataset",
    "array": "array", "asarray": "array", "zeros": "array", "ones": "array",
    "empty": "array", "full": "array", "arange": "array",
    "linspace": "array", "logspace": "array", "loadtxt": "array",
    "genfromtxt": "array", "concatenate": "array", "stack": "array",
    "figure": "Figure", "open": "file",
    "dict": "dict", "list": "list", "set": "set", "tuple": "tuple",
    "str": "str", "int": "number", "float": "number", "bool": "bool",
    "len": "number", "range": "range", "sorted": "list", "zip": "zip",
    "enumerate": "enumerate",
}

# display order of the by-type groups (only non-empty ones appear)
GROUP_ORDER = ["imports", "constants", "data", "functions", "classes",
               "plotting", "values", "objects", "computed", "other"]


def _call_label(call: ast.Call) -> str:
    fn = call.func
    if isinstance(fn, ast.Attribute):
        name = fn.attr
    elif isinstance(fn, ast.Name):
        name = fn.id
    else:
        return "value"
    if name in _CALL_RETURNS:
        return _CALL_RETURNS[name]
    if name[:1].isupper():
        return name                # SomeClass(...) — an instance of it
    return f"{name}()"             # foo(...) — whatever foo returns


def _value_label(node: ast.AST | None) -> str:
    """Display type of an assigned expression, without running anything."""
    if node is None:
        return "value"
    if isinstance(node, ast.Constant):
        v = node.value
        if isinstance(v, bool):
            return "bool"
        if isinstance(v, (int, float, complex)):
            return "number"
        if isinstance(v, str):
            return "str"
        if isinstance(v, bytes):
            return "bytes"
        if v is None:
            return "None"
        return "value"
    if isinstance(node, ast.JoinedStr):
        return "str"
    if isinstance(node, (ast.List, ast.ListComp)):
        return "list"
    if isinstance(node, (ast.Dict, ast.DictComp)):
        return "dict"
    if isinstance(node, (ast.Set, ast.SetComp)):
        return "set"
    if isinstance(node, ast.Tuple):
        return "tuple"
    if isinstance(node, ast.GeneratorExp):
        return "generator"
    if isinstance(node, ast.Lambda):
        return "function"
    if isinstance(node, (ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare)):
        return "expression"
    if isinstance(node, ast.Await):
        return _value_label(node.value)
    if isinstance(node, ast.IfExp):
        a, b = _value_label(node.body), _value_label(node.orelse)
        return a if a == b else "value"
    if isinstance(node, ast.Call):
        return _call_label(node)
    return "value"                 # Name alias, subscript, attribute, …


def _ann_label(annotation: ast.AST) -> str:
    """An explicit annotation is the author speaking — use it verbatim."""
    try:
        text = ast.unparse(annotation).strip()
    except Exception:
        return ""
    if not text:
        return ""
    return text if len(text) <= 24 else text[:23] + "…"


def _target_names(target: ast.AST) -> list[str]:
    """Plain names bound by an assignment/loop target. ``df.col`` and
    ``d["k"]`` bind no new name and yield nothing."""
    if isinstance(target, ast.Name):
        return [target.id]
    if isinstance(target, ast.Starred):
        return _target_names(target.value)
    if isinstance(target, (ast.Tuple, ast.List)):
        out: list[str] = []
        for el in target.elts:
            out.extend(_target_names(el))
        return out
    return []


def _is_subplots(value: ast.AST) -> bool:
    if not isinstance(value, ast.Call):
        return False
    fn = value.func
    name = fn.attr if isinstance(fn, ast.Attribute) else (
        fn.id if isinstance(fn, ast.Name) else "")
    return name == "subplots"


def _assign_defs(targets: list, value: ast.AST) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for target in targets:
        if isinstance(target, ast.Name):
            out.append((target.id, _value_label(value)))
        elif isinstance(target, (ast.Tuple, ast.List)):
            names = _target_names(target)
            if _is_subplots(value) and names:
                # fig, ax = plt.subplots() — everyone writes this
                out.append((names[0], "Figure"))
                out.extend((n, "Axes") for n in names[1:])
            elif (isinstance(value, (ast.Tuple, ast.List))
                    and len(target.elts) == len(value.elts)
                    and not any(isinstance(e, ast.Starred)
                                for e in target.elts)):
                # the lengths were just compared in the guard above
                for el, v in zip(target.elts, value.elts, strict=True):
                    out.extend((n, _value_label(v))
                               for n in _target_names(el))
            else:
                out.extend((n, "value") for n in names)
    return out


def _walrus_defs(stmt: ast.stmt) -> list[tuple[str, str]]:
    """Names bound by ``:=`` in a statement's OWN expressions.

    Only the statement's direct expression children are walked -- its nested
    statement bodies belong to the recursive visit below, so nothing is
    counted twice. This is where a walrus actually appears in notebook code:
    ``while (chunk := f.read()):``, ``if (m := re.match(p, s)):``.
    """
    out: list[tuple[str, str]] = []
    for child in ast.iter_child_nodes(stmt):
        if not isinstance(child, ast.expr):
            continue
        for node in ast.walk(child):
            if isinstance(node, ast.NamedExpr) and isinstance(node.target,
                                                              ast.Name):
                out.append((node.target.id, _value_label(node.value)))
    return out


def _top_level_defs(tree: ast.Module) -> list[tuple[str, str]]:
    """(name, type_label) for every top-level binding, in source order.
    An empty label means "binds the name but says nothing new about its
    type" (an ``x += 1``), so an earlier label is kept."""
    out: list[tuple[str, str]] = []

    def visit(stmts: list) -> None:
        for node in stmts:
            # `y = (x := 1)` binds x before y, which is the order this gives
            out.extend(_walrus_defs(node))
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                out.append((node.name, "function"))
            elif isinstance(node, ast.ClassDef):
                out.append((node.name, "class"))
            elif isinstance(node, ast.Import):
                for a in node.names:
                    out.append(((a.asname or a.name).split(".")[0], "module"))
            elif isinstance(node, ast.ImportFrom):
                for a in node.names:
                    if a.name != "*":
                        out.append((a.asname or a.name, "import"))
            elif isinstance(node, ast.Assign):
                out.extend(_assign_defs(node.targets, node.value))
            elif (isinstance(node, ast.AnnAssign)
                    and isinstance(node.target, ast.Name)
                    and node.value is not None):
                # a BARE `x: int` annotates without assigning -- no such
                # name exists at runtime, so listing it would be a phantom
                out.append((node.target.id,
                            _ann_label(node.annotation)
                            or _value_label(node.value)))
            elif isinstance(node, ast.AugAssign) and isinstance(node.target,
                                                                ast.Name):
                out.append((node.target.id, ""))
            elif isinstance(node, (ast.For, ast.AsyncFor)):
                out.extend((n, "loop item")
                           for n in _target_names(node.target))
                visit(node.body)
                visit(node.orelse)
            elif isinstance(node, ast.While):
                visit(node.body)
                visit(node.orelse)
            elif isinstance(node, ast.If):
                visit(node.body)
                visit(node.orelse)
            elif isinstance(node, (ast.With, ast.AsyncWith)):
                for w in node.items:
                    if w.optional_vars is not None:
                        out.extend((n, _value_label(w.context_expr))
                                   for n in _target_names(w.optional_vars))
                visit(node.body)
            elif isinstance(node, ast.Try):
                visit(node.body)
                for h in node.handlers:
                    visit(h.body)
                visit(node.orelse)
                visit(node.finalbody)

    visit(tree.body)
    return out


def _group_of(name: str, label: str) -> str:
    if label in ("module", "import"):
        return "imports"
    if label == "function":
        return "functions"
    if label == "class":
        return "classes"
    # an ALL_CAPS name is a constant by convention, whatever it holds
    if name.upper() == name and any(c.isalpha() for c in name):
        return "constants"
    if label in _DATA_LABELS:
        return "data"
    if label in ("Figure", "Axes"):
        return "plotting"
    if label in ("str", "number", "bool", "bytes", "None", "list", "dict",
                 "set", "tuple", "range"):
        return "values"
    if label[:1].isupper():
        return "objects"           # SomeClass(...) instances
    if label.endswith("()") or label in ("expression", "generator",
                                         "loop item", "file"):
        return "computed"
    return "other"


def collect_variables(doc: Document) -> list[NotebookVariable]:
    """Every top-level name the document's code binds, in definition order,
    with the cards that define, redefine and read it. Runs at parse time,
    while the cards still carry their member cells."""
    cards = _code_cards(doc)

    index: dict[str, NotebookVariable] = {}
    for _, it in cards:
        card_defs: list[tuple[str, str]] = []
        card_uses: set[str] = set()
        for m in sorted(it.members, key=lambda m: m["idx"]):
            # the magic-stripped ast, parsed once in parse_notebook's main
            # pass; parse here only when called on a hand-built doc
            tree = m.get("tree_nomagic", _UNPARSED)
            if tree is _UNPARSED:
                tree = _parse_or_none(_strip_magics(m["code"]))
            if tree is None:
                continue
            card_defs.extend(_top_level_defs(tree))
            # _build_chains already derived this cell's (defs, uses) from
            # the same tree — reuse them rather than walking it again
            names = m.get("names")
            if names is None:
                names = _cell_names(m["code"], tree)
            card_uses |= names[1]

        defined_here: set[str] = set()
        for name, label in card_defs:
            var = index.get(name)
            if var is None:
                index[name] = NotebookVariable(
                    name=name, type_label=label or "value",
                    group=_group_of(name, label or "value"),
                    sites=[VarSite(it.item_id, it.title, "defined")])
                defined_here.add(name)
                continue
            # a later, more specific label upgrades a generic first guess
            if label and var.type_label == "value" and label != "value":
                var.type_label = label
                var.group = _group_of(name, label)
            if name not in defined_here:
                defined_here.add(name)
                var.sites.append(VarSite(it.item_id, it.title, "redefined"))
        for name in sorted(card_uses):
            var = index.get(name)
            if var is not None and name not in defined_here:
                var.sites.append(VarSite(it.item_id, it.title, "used"))
    return list(index.values())
