"""A notebook's own strings cannot inject markup into the page (T258).

Audit, 2026-09-04. `render/sanitize.py` exists because rendered pages
get shared -- but three sinks wrote author-controlled strings straight
into markup without going near it. All three were confirmed by
rendering a crafted notebook, not by reading:

* `data-node` on every card (items.py). `#| id: a"><script>alert(1)
  </script>` closed the attribute, closed the tag, and put a live
  <script> element in the page. The neighbouring `data-anchor` escapes
  the SAME string, so this was an oversight, not a decision.
* `data-node` and `data-from`/`data-to` in the provenance SVG
  (graph.py), where every other value in the same builder is escaped.
* the raw view's `In [n]` label (items.py). nbformat types
  execution_count as int|null, but this reader is deliberately lenient
  about types everywhere else, and the raw view is built for every
  notebook by default: `"execution_count": "1</span><img src=x
  onerror=alert(2)>"` rendered a live <img>.

A node id is not slugged the way item_id is -- it is the author's
string, kept verbatim on purpose so deck anchors and `#| depends:`
matching keep working -- so escaping at the sinks is the fix, not
sanitising at the parser.

Why it matters beyond a shared file: in the local app the same page
holds `window.APP.cfg.token`, which grants the file read/write API.
"""

from __future__ import annotations

import json
import pathlib
import tempfile
from html.parser import HTMLParser

from junoview.notebook.loader import load_doc
from junoview.render.graph import build_graph_svg
from junoview.render.items import render_item

# each one closes an attribute and starts something that would run
PAYLOADS = (
    'a"><script>alert(1)</script>',
    'c" onmouseover="alert(3)',
    "d'><svg onload=alert(4)>",
)


class _Live(HTMLParser):
    """What actually PARSED out of the markup.

    A substring check is the wrong tool here: the notebook's own text is
    displayed, so `onerror=` legitimately appears inside escaped content
    (`&lt;img src=x onerror=alert(2)&gt;`) and must keep appearing. What
    must never happen is that it becomes a tag or an attribute.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags: list[str] = []
        self.handlers: list[tuple[str, str]] = []

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        for name, _ in attrs:
            if name.lower().startswith("on"):
                self.handlers.append((tag, name))


def _parsed(markup: str) -> _Live:
    p = _Live()
    p.feed(markup)
    return p


def _assert_inert(markup: str, why: str) -> None:
    got = _parsed(markup)
    assert "script" not in got.tags, f"{why}: a <script> element parsed out"
    assert not got.handlers, f"{why}: event handlers parsed out: {got.handlers}"


def _doc(cells):
    d = pathlib.Path(tempfile.mkdtemp()) / "crafted.ipynb"
    d.write_text(json.dumps({
        "cells": cells,
        "metadata": {"kernelspec": {"name": "python3", "language": "python"}},
        "nbformat": 4, "nbformat_minor": 5,
    }), encoding="utf-8")
    return load_doc(d)


def _code(source, count=1, outputs=None):
    return {"cell_type": "code", "execution_count": count, "metadata": {},
            "outputs": outputs if outputs is not None else [
                {"output_type": "stream", "name": "stdout", "text": ["x\n"]}],
            "source": source}


def test_a_crafted_id_cannot_break_out_of_the_card_attribute():
    for payload in PAYLOADS:
        doc = _doc([_code(f'#| id: {payload}\nprint("x")\n')])
        for sec in doc.sections:
            for item in sec.items:
                _assert_inert(render_item(item, sec.section_id), payload)
        # ...and the id is still THERE on the card, just inert
        out = render_item(doc.sections[0].items[0], "s")
        node = _parsed(out)
        assert "article" in node.tags


def test_a_crafted_id_cannot_break_out_of_the_provenance_svg():
    """The graph draws only when two or more cells declare an id -- which
    is exactly the notebooks that use the provenance feature."""
    for payload in PAYLOADS:
        doc = _doc([
            _code(f'#| id: {payload}\nprint("x")\n'),
            _code(f'#| id: b\n#| depends: {payload}\nprint("y")\n'),
        ])
        svg = build_graph_svg(doc)
        assert "provnode" in svg, "the graph must actually have been drawn"
        _assert_inert(svg, payload)


def test_a_crafted_execution_count_cannot_inject_into_the_raw_view():
    doc = _doc([_code("z=1\n",
                      count="1</span><img src=x onerror=alert(2)>",
                      outputs=[])])
    raw = doc.raw_html
    assert "rawtag" in raw, "the raw view must actually have been built"
    _assert_inert(raw, "execution_count")
    # the label degrades to inert TEXT rather than vanishing
    assert "&lt;img src=x onerror=alert(2)&gt;" in raw


def test_every_id_sink_escapes():
    """Named so a future sink is added next to a rule, not next to a gap."""
    items = pathlib.Path(__file__).resolve().parents[1] / (
        "src/junoview/render/items.py")
    graph = pathlib.Path(__file__).resolve().parents[1] / (
        "src/junoview/render/graph.py")
    isrc = items.read_text(encoding="utf-8")
    gsrc = graph.read_text(encoding="utf-8")
    assert 'f\'data-node="{html.escape(item.node_id)}"{ck_attr} \'' in isrc
    assert ("label = f\"In [{html.escape(str(n)) if n is not None else ' '}]\""
            in isrc)
    assert 'data-node="{html.escape(it.node_id)}"' in gsrc
    assert 'f\'data-from="{html.escape(a)}" \'' in gsrc
    assert 'f\'data-to="{html.escape(b)}"/>\')' in gsrc
    # item_id is slugged, but escaping it too removes the dependency on
    # that staying true
    assert 'data-target="{html.escape(it.item_id)}"' in gsrc


def test_an_ordinary_id_is_untouched():
    doc = _doc([_code('#| id: tidy_frame\nprint("x")\n')])
    out = render_item(doc.sections[0].items[0], "s")
    assert 'data-node="tidy_frame"' in out
