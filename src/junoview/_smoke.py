"""A built-in sanity check: render a tiny notebook with no input.

This is what ``junoview --self-test`` runs. It answers one question -- "is this
install working?" -- and is deliberately not a test suite. The real suite lives
in ``tests/`` and is not shipped in the wheel.

It exercises the whole path an actual notebook takes: directives are parsed,
outputs are classified, a provenance edge is built, a deck is read from the
notebook metadata, and every CSS/JS/HTML asset is loaded and spliced into a
page. A missing asset or a broken template fails here.
"""

from __future__ import annotations

from .notebook.parser import parse_notebook
from .render.page import render_html

_DEMO = {
    "metadata": {"semantic": {"presentations": [
        {"name": "demo", "slides": [{"layout": "halves",
                                     "panes": ["clim", "cell:md1"]}]},
    ]}},
    "cells": [
        {"cell_type": "markdown", "source": "# Demo analysis"},
        {"cell_type": "markdown", "id": "md1",
         "source": "The anomaly is $z' = z - \\bar{z}$.\n\n- point one"},
        {"cell_type": "code", "id": "c-load",
         "source": "#| display: metric\n#| id: load\n#| title: Load grid\n"
                   "print('shape (40, 80)')",
         "outputs": [{"output_type": "stream", "name": "stdout",
                      "text": "shape (40, 80)\n"}]},
        {"cell_type": "code", "id": "c-clim",
         "source": "#| display: figure\n#| id: clim\n#| depends: load\n"
                   "#| title: Climatology\n#| caption: Note the ridge.\n"
                   "plot()",
         "outputs": [{"output_type": "display_data",
                      "data": {"image/png": "aGk="}}]},
    ],
}


def self_test() -> int:
    """Render the built-in demo. Return a process exit code."""
    doc = parse_notebook(_DEMO)
    page = render_html(doc, source_name="demo")
    items = [item for section in doc.sections for item in section.items]

    problems = []
    if not items:
        problems.append("no cards were produced")
    if "Climatology" not in page:
        problems.append("the figure card is missing from the page")
    if "provsvg" not in page:
        problems.append("the provenance graph is missing")
    if not doc.presentations:
        problems.append("the embedded presentation was not read")
    # The assets are the part most likely to be missing from a bad install.
    for marker, what in ((".cardhead", "core.css"), ("function ", "app.js")):
        if marker not in page:
            problems.append(f"{what} did not make it into the page")

    if problems:
        print("self-test FAILED:")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print(f"self-test ok: {len(page)} bytes; {len(items)} items; "
          f"presentations: {len(doc.presentations)}")
    return 0
