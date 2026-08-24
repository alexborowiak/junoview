"""What each cell and each output IS: the classifiers and the type slugs they
stamp onto the rendered fragments. Output side: figure detection
(matplotlib, plotly, bokeh, vega, folium, generic widgets), the "real embed
machinery" rule that stops prose naming a library from becoming a phantom
plot, auto-naming, repr kinds
(numeric/list/dict/set/function/class/module/pandas and the brace edge
cases), rich media (gif/jpeg/video data URIs) and the escaping that keeps a
crafted payload inside src="data:...". Code side: the ordered list of code
kinds per cell, mixed cells, the imports-plus-work and fully-commented
cases. Interactive outputs are neutralised at build time and re-activated by
the client, so that round trip lives here too.
"""

from __future__ import annotations

import ast

from helpers import (
    _make_gif,
    _make_int,
    _make_jpg,
    _make_plain,
    _make_ply,
    _make_vid,
)
from junoview.notebook.classify import _classify_code
from junoview.notebook.outputs import (
    _looks_interactive,
    _plot_lib,
    _repr_kind,
    render_outputs,
)
from junoview.notebook.parser import parse_notebook
from junoview.render.items import render_item


def test_plot_lib_identifies_folium_and_generic_widgets():
    assert _plot_lib("<div class='leaflet-map'></div>") == "folium"
    assert _plot_lib("<script>custom()</script>") == "widget"


def test_looks_interactive_requires_real_embed_machinery():
    """Prose that merely NAMES a library is not a live embed.

    Otherwise a version table full of library names produced phantom
    "Plot N" figures. Real machinery -- a script, an iframe, a known
    root div -- is what counts.
    """
    assert not _looks_interactive("<table><td>plotly 5.22</td></table>")
    assert not _looks_interactive("bokeh results are in the paper")
    assert _looks_interactive("<div class='bk-root'></div>")
    assert _looks_interactive("<script>anything()</script>")
    assert _looks_interactive("<iframe srcdoc='...'></iframe>")
    _prose = render_outputs([{"output_type": "execute_result", "data": {
        "text/html": "<table><td>made with plotly</td></table>"}}])
    assert _prose and not _prose[0].has_interactive and _prose[0].pt == ""


def test_live_folium_output_becomes_a_tagged_figure():
    _live_doc = parse_notebook({"cells": [
        {"cell_type": "code", "source": "m", "outputs": [
            {"output_type": "display_data",
             "data": {"text/html": "<div class='folium-map'></div>"}}]}]})
    _live_items = [it for s in _live_doc.sections for it in s.items]
    assert _live_items and _live_items[0].kind == "figure"
    _live_html = render_item(_live_items[0])
    assert 'data-pt="folium"' in _live_html \
        and 'class="cb-part cb-fig" data-pt="folium"' in _live_html


def test_unnamed_figure_is_auto_named_plot_1():
    """A figure with no explicit name is auto-named "Plot N"."""
    pdoc = parse_notebook({"cells": [
        {"cell_type": "code", "source": "plt.plot(x)", "outputs": [
            {"output_type": "display_data",
             "data": {"image/png": "iVBORw0KGgo="}}]}]})
    pfig = [it for s in pdoc.sections for it in s.items
            if it.kind in ("figure", "diagnostic")]
    assert pfig and pfig[0].title == "Plot 1" and not pfig[0].title_echo


def test_plot_type_slugs():
    """Every plot fragment carries a data-pt slug.

    matplotlib for static images, plotly/bokeh/vega/folium/widget for live
    embeds -- and live embeds are FIGURES (plot part + figure kind), not
    output.
    """
    _ply = _make_ply()
    _int = _make_int()
    _vid = _make_vid()
    _jpg = _make_jpg()
    _plain = _make_plain()
    assert _ply[0].pt == "plotly" and 'data-pt="plotly"' in _ply[0].payload
    assert _int[0].pt == "plotly" and _vid[0].pt == "video"
    assert _jpg[0].pt == "matplotlib" \
        and 'data-pt="matplotlib"' in _jpg[0].payload
    assert _plain[0].pt == ""
    assert _plot_lib("<div>BokehJS says hi</div>") == "bokeh"
    assert _plot_lib("<div>vegaEmbed(spec)</div>") == "vega"


def test_repr_kind_literals_and_braces():
    """The literal repr types, and the brace cases that used to trip it up.

    Empty dict is a dict, not a set; string contents don't fool set/dict.
    """
    assert _repr_kind("[1, 2, 3]") == "list" and _repr_kind("42") == "numeric"
    assert _repr_kind("{'a': 1}") == "dict" and _repr_kind("{1, 2}") == "set"
    assert _repr_kind("'hi'") == "string" and _repr_kind("(1, 2)") == "tuple"
    assert _repr_kind("True") == "bool" and _repr_kind("None") == "none"
    assert _repr_kind("np.float64(1.5)") == "array"
    # empty dict is a dict, not a set; string contents don't fool set/dict
    assert _repr_kind("{}") == "dict"
    assert _repr_kind("{'12:00', '13:00'}") == "set"
    assert _repr_kind("{'a}b': 1}") == "dict"


def test_repr_kind_numeric_and_value_types():
    """Every numeric-like repr lands under "numeric" (complex, inf, nan, sci).

    Granular value types: function / class / object / module + pandas.
    """
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
    assert _repr_kind("   a  b\n0  1  2\n\n[1 rows x 2 columns]") \
        == "dataframe"


def test_render_outputs_tags_repr_types():
    """The rendered fragment carries the repr slug as ``ot`` and a class."""
    # a pandas DataFrame HTML table is tagged 'dataframe'
    _dfo = render_outputs([{"output_type": "execute_result", "data": {
        "text/html": '<table class="dataframe"><tr><td>1</td></tr></table>'}}])
    assert _dfo and _dfo[0].ot == "dataframe" \
        and "ot-dataframe" in _dfo[0].payload
    _rout = render_outputs([
        {"output_type": "execute_result",
         "data": {"text/plain": "[1, 2, 3]"}}])
    assert _rout and _rout[0].ot == "list" and "ot-list" in _rout[0].payload


def test_defaultdict_repr_counts_as_a_dict_for_the_filter():
    """A defaultdict repr is a DICT for the Output-types filter, and the
    card badge speaks the same language (so unchecking it works)."""
    assert _repr_kind("defaultdict(dict, {'a': 1})") == "dict"
    odoc = parse_notebook({"cells": [{"cell_type": "code", "source": "d",
        "outputs": [{"output_type": "execute_result", "data":
                     {"text/plain": "defaultdict(dict, {'a': 1})"}}]}]})
    o_html = render_item(odoc.sections[0].items[0])
    assert 'data-ot="dict"' in o_html and '>dict</span>' in o_html


def test_rich_media_outputs():
    """Richer plot/output types: gif, jpeg and video embed as data URIs."""
    _gif = _make_gif()
    assert _gif and _gif[0].has_image and "data:image/gif;base64,R0lGOD" \
        in _gif[0].payload and "gif-out" in _gif[0].payload
    _jpg = _make_jpg()
    assert _jpg and "data:image/jpeg;base64,/9j/4A" in _jpg[0].payload
    _vid = _make_vid()
    assert _vid and _vid[0].kind == "video" and "<video" in _vid[0].payload \
        and "data:video/mp4;base64,AAAAIG" in _vid[0].payload


def test_media_payload_cannot_escape_data_uri():
    """A crafted (non-base64) media payload cannot escape src="data:...".

    The bytes are not base64, so a naive renderer would splice the raw
    string straight into the attribute and let it close out of the quote.
    """
    _xss = render_outputs([{"output_type": "display_data",
        "data": {"image/gif": '"><script>alert(1)</script>'}}])
    assert _xss and "<script" not in _xss[0].payload \
        and "alert(1)" not in _xss[0].payload


def test_interactive_outputs_neutralised_and_flagged():
    """Interactive outputs are neutralised at build time, plain html is not.

    An interactive text/html output (embedded <script>) is neutralised at
    build time (client re-runs it) and flagged interactive. A plain
    (script-less) html result is untouched and NOT flagged interactive.
    """
    _ply = _make_ply()
    assert _ply and _ply[0].kind == "plotly" and _ply[0].has_interactive \
        and "plotly-embed" in _ply[0].payload \
        and "data-plotly=" in _ply[0].payload
    # an interactive text/html output (embedded <script>) is neutralised at
    # build time (client re-runs it) and flagged interactive
    _int = _make_int()
    assert _int and _int[0].has_interactive \
        and 'type="text/plotline-embed"' in _int[0].payload \
        and "plotframe" in _int[0].payload
    # a plain (script-less) html result is untouched and NOT flagged
    # interactive
    _plain = _make_plain()
    assert _plain and not _plain[0].has_interactive \
        and "plotframe" not in _plain[0].payload


def test_classify_code_single_kind_cells():
    """Code-cell subtypes: each returns an ordered list of kinds present."""
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


def test_classify_code_mixed_cells_keep_order():
    """Mixed cells list several kinds, in order."""
    assert _classify_code("import xr\ndef f():\n    pass") \
        == ["imports", "function"]
    assert _classify_code("df = pd.read_csv('a')\ndf.plot()") \
        == ["data", "plotting"]


def test_classifier_honesty_about_imports_and_comments(out):
    """classifier honesty: imports + real work reads "imports · code", a
    fully commented-out cell is its own filterable "comments" kind
    """
    assert _classify_code(
        "import dask\n\ngw = dask.Gateway()\ngw.scale(20)") \
        == ["imports", "code"]
    assert _classify_code("import x\nimport y") == ["imports"]
    assert _classify_code("# only\n# comments") == ["comments"]
    assert _classify_code("") == ["code"]
    assert "'comments','constant','code']" in out
    assert ".ckf-dot.ckmain-comments" in out


def test_a_code_cell_is_parsed_once_per_render(monkeypatch):
    """parse_notebook runs ast.parse ONCE per code cell (twice when a magic
    line makes the dataflow form a different string) and every consumer --
    title, plot title, code kinds, chains, the variables index -- reuses
    that tree. Each of those used to parse for itself: up to six parses of
    the same source per cell, on every server refresh and Pyodide render.
    """
    calls: list[str] = []
    real_parse = ast.parse

    def counting_parse(source, *args, **kwargs):
        calls.append(source)
        return real_parse(source, *args, **kwargs)

    monkeypatch.setattr(ast, "parse", counting_parse)
    doc = parse_notebook({"cells": [
        {"cell_type": "code", "source": "x = load()\nprint(x)",
         "outputs": []},
        {"cell_type": "code", "source": "%matplotlib inline\nplt.plot(x)",
         "outputs": []},
    ]})
    # cell 1: one parse serves everyone. cell 2: the raw parse (which the
    # magic line makes a SyntaxError, still one call) plus the stripped
    # dataflow parse. Never 6 per cell.
    assert len(calls) == 3
    # and the shared trees really fed each consumer: code kinds from the
    # raw tree, the chain and the variable use from the stripped one
    items = [it for s in doc.sections for it in s.items]
    assert items[0].code_kinds == ["print"]
    assert items[1].chain == [items[0].anchor]
    assert any(v.name == "x" and v.n_used == 1 for v in doc.variables)
