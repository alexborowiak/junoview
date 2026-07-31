"""The frontend: stylesheets, scripts and HTML templates as real files.

These used to be multi-thousand-line string constants inside the renderer,
which meant no syntax highlighting, no linting and unreadable diffs. They now
live beside this module as ordinary ``.css`` / ``.js`` / ``.html`` files and
are read through :mod:`importlib.resources`, so they keep working when the
package is imported from a zip -- which is how both the Pyodide web build and
the single-file ``.pyz`` distribution load it.

Read one with :func:`load`; the eagerly-named helpers below exist so callers
read as prose rather than as string keys.
"""

from __future__ import annotations

import functools
from importlib.resources import files

__all__ = [
    "load",
    "core_css", "app_css", "deck_css",
    "app_js", "deck_js",
    "page_template", "shell_template",
    "deck_html", "help_html", "mathjax_html", "web_loader",
]


@functools.cache
def load(relative_path: str) -> str:
    """Return the text of one asset, e.g. ``load("css/core.css")``.

    Results are cached: a page render touches every asset, and multi-notebook
    bundles render many pages in one process.

    Text mode is deliberate. Git may check these files out with CRLF endings
    on Windows; universal-newline decoding turns them back into ``\\n`` so the
    rendered HTML is byte-identical on every platform.
    """
    resource = files(__package__)
    for part in relative_path.split("/"):
        resource = resource.joinpath(part)
    return resource.read_text(encoding="utf-8")


def core_css() -> str:
    """Base styling for the rendered document: cards, rail, typography."""
    return load("css/core.css")


def app_css() -> str:
    """Chrome for the app shell: ribbon, dialogs, tab strip, panels."""
    return load("css/app.css")


def deck_css() -> str:
    """Present mode and the slide/poster builder."""
    return load("css/deck.css")


def app_js() -> str:
    """Viewer behaviour: filtering, folding, tabs, tree view, routing."""
    return load("js/app.js")


def deck_js() -> str:
    """Presentation behaviour: slide editing, layout, export, playback."""
    return load("js/deck.js")


def page_template() -> str:
    """Whole-page skeleton. A :meth:`str.format` template."""
    return load("html/page.html")


def shell_template() -> str:
    """One notebook's document view. A :meth:`str.format` template."""
    return load("html/shell.html")


def deck_html() -> str:
    """Static markup for the presentation overlay."""
    return load("html/deck.html")


def help_html() -> str:
    """Contents of the in-app help overlay."""
    return load("html/help.html")


def mathjax_html() -> str:
    """MathJax configuration and CDN script tag."""
    return load("html/mathjax.html")


def web_loader() -> str:
    """Boot page for the Pyodide build; see :mod:`junoview.web`."""
    return load("html/web-loader.html")
