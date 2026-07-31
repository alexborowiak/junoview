"""Shared fixtures.

The demo notebook below is the one the old ``--self-test`` built inline: small,
but shaped to exercise the awkward cases -- a figure with a caption and a
declared dependency, a cell whose output is a repr *and* an image, a figure with
two panels, a function definition with no output, and a markdown cell carrying
hostile HTML.

The fixtures are named ``nb``, ``doc`` and ``out`` because the assertions that
became this suite were written against exactly those names.
"""

from __future__ import annotations

import copy

import pytest

from junoview.notebook.parser import parse_notebook
from junoview.render.page import render_html

_DEMO_NOTEBOOK = {
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
    ],
}


@pytest.fixture
def nb() -> dict:
    """The demo notebook, fresh each test -- several tests mutate it."""
    return copy.deepcopy(_DEMO_NOTEBOOK)


@pytest.fixture
def doc(nb):
    """The demo notebook parsed into a Document."""
    return parse_notebook(nb)


@pytest.fixture
def out(doc) -> str:
    """A full rendered page for the demo notebook."""
    return render_html(doc, source_name="demo")


@pytest.fixture
def items(doc) -> list:
    """Every card in the demo document, in reading order."""
    return [item for section in doc.sections for item in section.items]
