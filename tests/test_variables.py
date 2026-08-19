"""The sidebar's Variables view: the index behind it, and its HTML.

The index is static analysis -- names bound by top-level statements, typed by
the expression assigned to them, with every later reader recorded. These tests
pin the decisions that make the list *readable*: locals stay out, ALL_CAPS
means constant, ``fig, ax = plt.subplots()`` is recognised, a redefinition is
not a use.
"""

from __future__ import annotations

from junoview.notebook.parser import parse_notebook
from junoview.render.items import render_railtabs, render_varpanel
from junoview.render.page import render_page


def _code(src: str, **extra) -> dict:
    return {"cell_type": "code", "source": src, "outputs": [], **extra}


def _nb(*sources: str) -> dict:
    return {"cells": [_code(s) for s in sources]}


def _vars(doc):
    return {v.name: v for v in doc.variables}


# ---------------------------------------------------------------- the index

def test_variables_listed_in_definition_order():
    doc = parse_notebook(_nb("b = 1\na = 2", "c = a + b"))
    assert [v.name for v in doc.variables] == ["b", "a", "c"]


def test_types_read_off_the_assigned_expression():
    doc = parse_notebook(_nb(
        "import numpy as np\nfrom pathlib import Path\n"
        "def helper():\n    return 1\n"
        "class Model:\n    pass\n",
        "name = 'sst'\nN = 42\nflags = [1, 2]\nopts = {}\n"
        "df = pd.read_csv('x.csv')\nfig, ax = plt.subplots()\n"
        "model = LinearRegression()\nresult = compute()\n",
    ))
    v = _vars(doc)
    assert v["np"].type_label == "module"
    assert v["Path"].type_label == "import"
    assert v["helper"].type_label == "function"
    assert v["Model"].type_label == "class"
    assert v["name"].type_label == "str"
    assert v["N"].type_label == "number"
    assert v["flags"].type_label == "list"
    assert v["opts"].type_label == "dict"
    assert v["df"].type_label == "DataFrame"
    # the notebook idiom everyone writes gets both halves right
    assert v["fig"].type_label == "Figure"
    assert v["ax"].type_label == "Axes"
    # Capitalised call -> an instance of that class; lowercase -> "name()"
    assert v["model"].type_label == "LinearRegression"
    assert v["result"].type_label == "compute()"


def test_groups_for_the_by_type_view():
    doc = parse_notebook(_nb(
        "import numpy as np\nBASE = 'era5'\n"
        "def helper():\n    return 1\n"
        "df = pd.read_csv('x.csv')\nfig, ax = plt.subplots()\n"
        "label = 'a'\nmodel = LinearRegression()\nout = compute()\n",
    ))
    v = _vars(doc)
    assert v["np"].group == "imports"
    # ALL_CAPS is a constant by convention, whatever it holds
    assert v["BASE"].group == "constants"
    assert v["helper"].group == "functions"
    assert v["df"].group == "data"
    assert v["fig"].group == "plotting"
    assert v["label"].group == "values"
    assert v["model"].group == "objects"
    assert v["out"].group == "computed"


def test_function_locals_and_parameters_stay_out():
    """A name bound inside a def is a local -- listing it beside the
    notebook's real variables would bury them."""
    doc = parse_notebook(_nb(
        "def compute(df):\n    tmp = df * 2\n    return tmp\n"
        "if True:\n    branch = 1\n"))
    names = {v.name for v in doc.variables}
    assert "tmp" not in names and "df" not in names
    # ...but a binding in a top-level if/for/with IS a notebook variable
    assert "branch" in names


def test_uses_recorded_per_reading_card_and_redefinition_is_not_a_use():
    doc = parse_notebook(_nb(
        "x = load()", "y = x + 1", "print(x)", "x = x * 2"))
    v = _vars(doc)["x"]
    roles = [(s.role, s.item_id) for s in v.sites]
    assert [r for r, _ in roles] == ["defined", "used", "used", "redefined"]
    assert v.n_used == 2
    # an annotated later definition upgrades the generic first type
    doc2 = parse_notebook(_nb("z = get()", "z = [1]"))
    assert _vars(doc2)["z"].type_label == "get()"


def test_a_bare_annotation_is_not_a_variable():
    """``x: int`` annotates without assigning -- no such name exists at
    runtime, so listing it would send the reader to a variable that is not
    there. ``y: int = 3`` does bind, and the annotation names its type."""
    doc = parse_notebook(_nb("x: int\ny: int = 3\n"))
    v = _vars(doc)
    assert "x" not in v
    assert v["y"].type_label == "int"


def test_walrus_bindings_are_found():
    """``if (m := match()):`` binds m at notebook scope -- it is a real
    variable a reader can look up, not an implementation detail."""
    doc = parse_notebook(_nb("if (m := compute()) > 3:\n    print(m)\n"))
    assert "m" in _vars(doc)
    # ...and a walrus binds before the statement's own target: y = (x := 1)
    doc2 = parse_notebook(_nb("y = (x := 1)"))
    assert [v.name for v in doc2.variables] == ["x", "y"]


def test_magics_and_broken_cells_do_not_take_the_index_down():
    doc = parse_notebook(_nb(
        "%matplotlib inline\nok = 1", "this is not python ((("))
    assert [v.name for v in doc.variables] == ["ok"]


# ---------------------------------------------------------------- the HTML

def test_varpanel_rows_carry_what_the_js_regroups_on():
    doc = parse_notebook(_nb("import numpy as np\nx = np.zeros(3)",
                             "print(x)"))
    html = render_varpanel(doc)
    assert 'class="varpanel" hidden' in html          # sections stay default
    assert 'data-name="np"' in html and 'data-group="imports"' in html
    assert 'data-i="0"' in html and 'data-i="1"' in html
    assert 'vu-defined' in html and 'vu-used' in html
    assert 'data-vorder="type"' in html               # the group toggle
    tabs = render_railtabs(doc)
    assert 'data-rview="variables"' in tabs


def test_prose_only_notebook_keeps_its_plain_sidebar():
    doc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Just prose"}]})
    assert render_railtabs(doc) == "" and render_varpanel(doc) == ""


def test_page_embeds_the_panel_once_per_shell():
    doc = parse_notebook(_nb("a = 1", "print(a)"))
    doc.source_name = "demo"
    page = render_page([doc])
    assert page.count('class="railtabs"') == 1
    assert page.count('class="varpanel"') == 1


def test_variables_pane_chips_and_detach(out):
    """The sidebar Variables tab detaches into a right-hand pane (the
    panel node MOVES, so filter/order/jump links keep their wiring), and
    grew per-type chips -- "remove imports" is the first thing anyone
    wants from a variables index (2026-08-18). Measured: 50 rows, hiding
    imports 50 -> 46 visible, name-click jumped with the pane open, drag
    stored to jv-panes.
    """
    assert 'id="varspane"' in out and 'id="vars-btn"' in out
    assert "var-chips" in out and "vg-out" in out
    assert "document.addEventListener('sem:shell',function(){" in out
    assert "'varspane']" in out or "'varspane'" in out
