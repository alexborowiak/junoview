"""Turning a parsed Document into HTML.

Split by scope: :mod:`~junoview.render.items` renders the pieces (a card, the
nav rail, the raw view), :mod:`~junoview.render.page` assembles the finished
page around them using the templates and bundles in :mod:`junoview.assets`.

The rest are self-contained helpers with no knowledge of the page:
:mod:`~junoview.render.highlight` for source, :mod:`~junoview.render.markdown`
for prose, :mod:`~junoview.render.sanitize` for untrusted notebook HTML, and
:mod:`~junoview.render.graph` for the provenance drawing.
"""

from __future__ import annotations

from .page import render_html, render_page, render_shell

__all__ = ["render_page", "render_shell", "render_html"]
