"""Deprecated alias for :mod:`junoview`.

Everything used to live in one ``semantic_render.py``. It is now the
:mod:`junoview` package -- see ARCHITECTURE.md for the layout. This module stays
so that existing ``import semantic_render`` code keeps working, and re-exports
the same names from wherever they now live.

New code should import :mod:`junoview`::

    import junoview
    doc = junoview.parse_notebook(nb)

The command line moved too: ``python semantic_render.py notebook.ipynb`` is now
``junoview notebook.ipynb`` (or ``python -m junoview notebook.ipynb``).
"""

from __future__ import annotations

import warnings

from junoview import __version__
from junoview.assets import help_html as _help_html
from junoview.assets import web_loader as _web_loader
from junoview.branding import _ICON_PATHS
from junoview.cli import main
from junoview.notebook.classify import (
    _classify_code,
    _infer_kind,
    _title_from_code,
)
from junoview.notebook.directives import _lead_heading, split_directives
from junoview.notebook.loader import (
    _cache_bust,
    _is_url,
    _normalize_nb_url,
    _stem_for,
    doc_from_url,
    embed_deck,
    load_doc,
    render_notebook_file,
)
from junoview.notebook.model import CodeStep, Document, Item, Section
from junoview.notebook.outputs import (
    RenderedOutput,
    _looks_interactive,
    _plot_lib,
    _repr_kind,
    render_outputs,
)
from junoview.notebook.parser import parse_notebook
from junoview.notebook.presentations import _as_presentations
from junoview.render.graph import build_graph_svg
from junoview.render.highlight import highlight_python
from junoview.render.items import _BADGE, render_item, render_nav, render_raw
from junoview.render.markdown import md_to_html
from junoview.render.page import render_html, render_page, render_shell
from junoview.render.sanitize import _sanitize_html
from junoview.server.app import run_app
from junoview.server.notebook_edit import (
    _store_version,
    _versions_dir,
    insert_note_cell,
)
from junoview.server.state import _PROJECT_FILE, _AppState, _list_dir
from junoview.server.vcs import _github_web_url
from junoview.web import build_web, web_parse

warnings.warn(
    "semantic_render is deprecated; import junoview instead "
    "(the module was split into a package in 0.2.0).",
    DeprecationWarning, stacklevel=2,
)

# The frontend became real files under junoview/assets/. These names are kept
# for callers that reached into them, but they read eagerly -- prefer the
# junoview.assets accessors, which cache.
_HELP_HTML = _help_html()
_WEB_LOADER = _web_loader()

__all__ = [
    "__version__", "main",
    "CodeStep", "Document", "Item", "Section", "RenderedOutput",
    "parse_notebook", "split_directives", "render_outputs",
    "load_doc", "doc_from_url", "render_notebook_file", "embed_deck",
    "render_page", "render_shell", "render_html", "render_item", "render_nav",
    "render_raw", "build_graph_svg", "highlight_python", "md_to_html",
    "run_app", "build_web", "web_parse",
]


if __name__ == "__main__":
    raise SystemExit(main())
