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
    "app_js", "deck_js", "pptx_js", "DECK_PARTS",
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


#: The parts of ``js/deck/``, in the order they are concatenated. THE
#: ORDER IS THE SEMANTICS, which is why it is a list here rather than a
#: glob: ``99-boot`` runs every load-time call in the file and must come
#: after every declaration above it. A glob would happen to sort the same
#: way and would not say why.
DECK_PARTS = (
    "00-page",
    "05-figures-and-ribbon",
    "07-ribbon-layouts",
    "10-decks",
    "15-annotations",
    "17-text-builds",
    "20-notes-and-tables",
    "25-selecting",
    "30-format-bar",
    "35-arranging",
    "40-captions-and-components",
    "45-images",
    "47-charts",
    "48-animation",
    "50-review-and-overview",
    "55-sections-and-strip",
    "60-saving-and-export",
    "99-boot",
)


def deck_js() -> str:
    """Presentation behaviour: slide editing, layout, export, playback.

    Concatenated from ``js/deck/``. The parts are FRAGMENTS of one IIFE,
    not modules: the editor's state lives in that one closure, and ES
    modules are not an option because a rendered page is opened from
    ``file://`` as often as from a server, where ``type="module"`` is
    blocked outright. Joining files is not a build step — it is the same
    inlining every other asset already gets — and the split buys the
    thing a 24,000-line file costs most: being able to open the part you
    need. See ``js/deck/00-page.js`` for the rest of the argument.
    """
    return "".join(load(f"js/deck/{name}.js") for name in DECK_PARTS)


def pptx_js() -> str:
    """The .pptx writer: an OOXML ZIP built in the browser, no dependencies."""
    return load("js/pptx.js")


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


def sw_js() -> str:
    """The web build's service worker: offline caching + installability."""
    return load("js/sw.js")


def web_loader() -> str:
    """Boot page for the Pyodide build; see :mod:`junoview.web`."""
    return load("html/web-loader.html")
