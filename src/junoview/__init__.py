"""Junoview -- read executed Jupyter notebooks as figures instead of cells.

A *static* renderer. It reads the outputs already stored in a notebook you ran
normally in Jupyter, so there is no kernel, no backend and no re-execution. What
comes out is one self-contained HTML page that recovers the structure underneath
the cells::

    Dataset -> Transform -> Diagnostic -> Figure -> Interpretation

Typical use is the command line (``junoview``); this API is for embedding.

    >>> import json, junoview
    >>> doc = junoview.parse_notebook(json.load(open("analysis.ipynb")))
    >>> open("analysis.html", "w", encoding="utf-8").write(
    ...     junoview.render_page([doc]))

The package is laid out by what each part does -- see ARCHITECTURE.md:

``junoview.notebook``
    Reading and understanding notebooks: directives, output classification,
    the semantic model, provenance chains.
``junoview.render``
    Turning a :class:`~junoview.notebook.model.Document` into HTML.
``junoview.assets``
    The frontend, as real ``.css`` / ``.js`` / ``.html`` files.
``junoview.server``
    The local GUI app.
``junoview.web``
    The client-side (Pyodide) build.
"""

from __future__ import annotations

__version__ = "0.2.0"

from .notebook.directives import split_directives
from .notebook.loader import (
    doc_from_url,
    load_doc,
    render_notebook_file,
)
from .notebook.model import CodeStep, Document, Item, Section
from .notebook.outputs import RenderedOutput, render_outputs
from .notebook.parser import parse_notebook
from .notebook.presentations import embed_deck
from .render.graph import build_graph_svg
from .render.highlight import highlight_python
from .render.markdown import md_to_html
from .render.page import render_html, render_page, render_shell

__all__ = [
    "__version__",
    # model
    "CodeStep", "Document", "Item", "Section", "RenderedOutput",
    # reading notebooks
    "split_directives", "parse_notebook", "render_outputs",
    "load_doc", "doc_from_url", "render_notebook_file", "embed_deck",
    # rendering
    "render_page", "render_shell", "render_html",
    "build_graph_svg", "highlight_python", "md_to_html",
    # entry points (imported lazily via __getattr__)
    "run_app", "build_web", "web_parse", "main",
]


def __getattr__(name: str):
    """Load the app, the web build and the CLI only when asked for.

    Importing Junoview to render a notebook should not drag in an HTTP server
    or an argument parser.
    """
    if name == "run_app":
        from .server.app import run_app
        return run_app
    if name in ("build_web", "web_parse"):
        from . import web
        return getattr(web, name)
    if name == "main":
        from .cli import main
        return main
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
