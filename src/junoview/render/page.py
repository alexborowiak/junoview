"""Assembling the finished HTML page.

The templates and the CSS/JS bundles come from :mod:`junoview.assets` as real
files. Note the asymmetry: the two ``.html`` templates are :meth:`str.format`
templates with named placeholders, while the stylesheets and scripts are inert
values substituted into them -- which is why their many ``{`` braces need no
escaping.
"""

from __future__ import annotations

import html
import json

from .. import assets
from ..branding import _FAVICON, _KOFI_URL, _LOGO_SVG, _icons
from ..notebook.model import Document
from .items import (
    deck_payload,
    doc_meta,
    render_graph_panel,
    render_nav,
    render_railtabs,
    render_sections,
    render_varpanel,
)


def render_shell(doc: Document, path: str = "") -> str:
    """One notebook's complete document view (rail + toolbar + cards).

    Several of these mount side by side as tabs; the embedded `nb-data`
    JSON is the card index the tab/deck JS consumes.
    """
    stem = doc.source_name or "notebook"
    path_attr = f' data-path="{html.escape(path)}"' if path else ""
    return assets.shell_template().format(
        stem=html.escape(stem),
        path_attr=path_attr,
        title=html.escape(doc.title),
        meta=html.escape(doc_meta(doc)),
        railtabs=render_railtabs(doc),
        nav=render_nav(doc),
        varpanel=render_varpanel(doc),
        graph_panel=render_graph_panel(doc),
        sections=render_sections(doc),
        rawview=doc.raw_html or "",
        nb_data=deck_payload(doc),
    )


def render_page(docs: list[Document], mode: str = "static",
                app_cfg: dict | None = None) -> str:
    """The full HTML page: tab strip, one shell per notebook, deck, app UI.

    mode "static": fixed tabs, shareable file (tab strip hidden when only
    one notebook). mode "app": served by the local server; tabs can be
    opened / closed / reloaded and presentations save to the project file.
    """
    cfg = app_cfg or {}
    paths = cfg.get("paths", {})
    shells = "".join(render_shell(d, path=paths.get(d.source_name, ""))
                     for d in docs)
    app_data = {
        "mode": mode,
        "token": cfg.get("token", ""),
        "root": cfg.get("root", ""),
        "project": {
            "presentations": cfg.get("presentations", []),
            "recent": cfg.get("recent", []),
        },
    }
    if len(docs) == 1:
        title = docs[0].title
    elif docs:
        title = f"{docs[0].title} (+{len(docs) - 1})"
    else:
        title = "Junoview"
    # The PWA bits belong to the WEB build only. They have to be here, in
    # the app page, and not merely in the boot loader: that loader hands
    # over with document.write(), which replaces the document and takes
    # its <link rel="manifest"> with it -- leaving the running app with no
    # manifest at all ("no-manifest" from Chrome's installability check,
    # 2026-08-21) and therefore not installable. A static export or the
    # local app server would only 404 on these, so they stay out of both.
    head_extra = ('<link rel="manifest" href="manifest.webmanifest">\n'
                  '<meta name="theme-color" content="#0a141d">'
                  if mode == "web" else "")
    return _icons(assets.page_template().format(
        title=html.escape(title),
        head_extra=head_extra,
        shells=shells,
        css=assets.core_css(),
        app_css=assets.app_css(),
        js=assets.app_js(),
        mathjax=assets.mathjax_html(),
        deck_shell=assets.deck_html(),
        app_data=json.dumps(app_data, ensure_ascii=False).replace("</", "<\\/"),
        deck_css=assets.deck_css(),
        deck_js=assets.deck_js(),
        pptx_js=assets.pptx_js(),
        kofi=_KOFI_URL,
        help_html=assets.help_html(),
        logo=_LOGO_SVG,
        favicon=_FAVICON,
    ))


def render_html(doc: Document, source_name: str | None = None) -> str:
    """Single-notebook page (kept for the widget and simple exports)."""
    if source_name:
        doc.source_name = source_name
    return render_page([doc])
