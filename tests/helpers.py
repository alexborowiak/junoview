"""Builders shared by more than one test module.

Small factories for the awkward notebook shapes several subjects need -- a
GIF output, a video output, a notebook with two documents. Kept here so that
a test module holds tests and nothing else.
"""

from __future__ import annotations

from junoview.notebook.outputs import render_outputs
from junoview.notebook.parser import parse_notebook
from junoview.render.page import render_page


def _note_notebook() -> dict:
    """A fresh 3-cell notebook for the add-a-note placement tests.

    A markdown cell, a grouped code cell (``id: load``) and a figure
    (``id: figx``). Each test gets its own copy because
    ``insert_note_cell`` mutates the notebook it is handed.
    """
    return {"cells": [
        {"cell_type": "markdown", "id": "m0", "source": "just a note"},
        {"cell_type": "code", "id": "c0",
         "source": "#| id: load\nload()", "outputs": []},
        {"cell_type": "code", "id": "c1",
         "source": "#| display: figure\n#| id: figx\nplot()",
         "outputs": [{"output_type": "display_data",
                      "data": {"image/png": "aGk="}}]},
    ]}


def _make_gif():
    return render_outputs([{"output_type": "display_data",
                            "data": {"image/gif": "R0lGOD"}}])


def _make_jpg():
    return render_outputs([{"output_type": "display_data",
                            "data": {"image/jpeg": "/9j/4A"}}])


def _make_vid():
    return render_outputs([{"output_type": "display_data",
                            "data": {"video/mp4": "AAAAIG"}}])


def _make_ply():
    return render_outputs([{"output_type": "display_data", "data": {
        "application/vnd.plotly.v1+json": {"data": [{"y": [1, 2]}],
                                           "layout": {}},
        "image/png": "aGk="}}])


def _make_int():
    """An interactive text/html output -- an embedded <script>."""
    return render_outputs([{"output_type": "display_data", "data": {
        "text/html": '<div id="p"></div><script>Plotly.newPlot("p",[])'
                     '</script>'}}])


def _make_plain():
    """A plain, script-less html result."""
    return render_outputs([{"output_type": "execute_result", "data": {
        "text/html": "<b>hello</b>"}}])


def _demo_and_other(nb):
    """The two-notebook setup: the demo doc plus a small second notebook.

    Both get an explicit ``source_name`` so a deck can address their
    anchors across notebooks as ``stem::anchor``.
    """
    nb2 = {"cells": [
        {"cell_type": "markdown", "source": "# Second notebook"},
        {"cell_type": "code", "id": "x1",
         "source": "#| display: figure\n#| id: sst\n"
                   "#| title: SST map\nplot()",
         "outputs": []},
    ]}
    doc_a = parse_notebook(nb)
    doc_a.source_name = "demo"
    doc_b = parse_notebook(nb2)
    doc_b.source_name = "other"
    return doc_a, doc_b


def _web_page() -> str:
    """The browser-only landing page (no document loaded yet)."""
    return render_page([], mode="web")
