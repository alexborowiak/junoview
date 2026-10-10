"""Assembling the finished HTML page.

The templates and the CSS/JS bundles come from :mod:`junoview.assets` as real
files. Note the asymmetry: the two ``.html`` templates are :meth:`str.format`
templates with named placeholders, while the stylesheets and scripts are inert
values substituted into them -- which is why their many ``{`` braces need no
escaping.
"""

from __future__ import annotations

import functools
import html
import json
import string

from .. import assets
from ..branding import FAVICON, KOFI_URL, LOGO_SVG, icons
from ..build_info import build_badge
from ..notebook.model import Document
from .items import (
    deck_payload,
    render_graph_panel,
    render_nav,
    render_railtabs,
    render_sections,
    render_varpanel,
)
from .maths import MATH_ATTR
from .static import DEFERRED, DEFERRED_HINT, static_files


def render_shell(doc: Document, path: str = "", ver: str = "") -> str:
    """One notebook's complete document view (rail + toolbar + cards).

    Several of these mount side by side as tabs; the embedded `nb-data`
    JSON is the card index the tab/deck JS consumes.

    ``ver`` is the local app's version token for this exact rendering
    (server/shells.py): the page sends it back on a Reload, and an
    unchanged notebook then skips the re-render and the remount. Every
    other caller leaves it empty and the shell carries no attribute.
    """
    stem = doc.source_name or "notebook"
    path_attr = f' data-path="{html.escape(path)}"' if path else ""
    if ver:
        path_attr += f' data-ver="{html.escape(ver)}"'
    # A source kind remains machine-readable for the live tab controller.
    # The outline itself deliberately has no repeated title, kind or stats.
    kind = doc.source_kind
    if kind and kind != "Jupyter notebook":
        kind_attr = f' data-srckind="{html.escape(kind)}"'
    else:
        kind_attr = ""
    # icons() runs HERE and not over the whole page: a shell is also
    # served on its own (server routes, the Pyodide bridge's web_parse)
    # and mounted into an already-built page, so it has to arrive
    # expanded -- and once it has, a page-wide pass has nothing left to
    # do in it (see _compiled).
    return icons(assets.shell_template().format(
        stem=html.escape(stem),
        path_attr=path_attr,
        kind_attr=kind_attr,
        railtabs=render_railtabs(doc),
        nav=render_nav(doc),
        varpanel=render_varpanel(doc),
        graph_panel=render_graph_panel(doc),
        sections=render_sections(doc),
        rawview=doc.raw_html or "",
        nb_data=deck_payload(doc),
    ))


def has_marked_math(shells: str | bytes) -> bool:
    """Whether any element in ``shells`` is marked as holding maths
    (render/maths.py) -- text or already-encoded bytes alike."""
    if isinstance(shells, bytes):
        return MATH_ATTR.encode("ascii") in shells
    return MATH_ATTR in shells


def mathjax_head(math: bool) -> str:
    """MathJax for a page whose notebooks do (``math``) or do not hold
    maths.

    The configuration always goes in -- a notebook opened later, or a
    slide with an equation, can still need it, and app.js then loads the
    script itself. The script tag fetches only when something on the page
    is marked as holding maths (render/maths.py): a page with none -- the
    web build's welcome screen, most code-only notebooks -- no longer
    downloads, compiles and runs 1.2 MB of MathJax it will never use
    (2026-10-09 speed pass). The address stays on the tag as data-src, so
    there is one pinned URL on the page either way.
    """
    mj = assets.mathjax_html()
    if math:
        return mj
    return mj.replace(' src="', ' data-src="', 1)


def render_page(docs: list[Document], mode: str = "static",
                app_cfg: dict | None = None, *,
                asset_base: str | None = None,
                deferred: bool = False) -> str:
    """The full HTML page: tab strip, one shell per notebook, deck, app UI.

    mode "static": fixed tabs, shareable file (tab strip hidden when only
    one notebook). mode "app": served by the local server; tabs can be
    opened / closed / reloaded and presentations save to the project file.

    ``asset_base`` None inlines every stylesheet and script, which is what
    a single-file export must do. Given a prefix ("/static/" for the app
    server, "" for the web build's directory), each one is referenced as
    a content-hashed file under it instead -- see render/static.py.
    ``deferred`` names the slide editor without running it at load, as
    the local app's page does (see :func:`page_pieces`).
    """
    cfg = app_cfg or {}
    paths = cfg.get("paths", {})
    shells = join_shells([render_shell(d, path=paths.get(d.source_name, ""))
                          for d in docs])
    pieces = page_pieces(
        mode=mode, title=page_title([d.title for d in docs]),
        shells=shells, app_data=app_data_json(mode, cfg),
        asset_base=asset_base, deferred=deferred)
    # every piece is text here; only the app server passes in bytes
    return "".join(p if isinstance(p, str) else p.decode("utf-8")
                   for p in pieces)


def page_title(titles: list[str]) -> str:
    """The tab title: the first document's, with a count of the others."""
    if len(titles) == 1:
        return titles[0]
    if titles:
        return f"{titles[0]} (+{len(titles) - 1})"
    return "Junoview"


def app_data_json(mode: str, cfg: dict) -> str:
    """The boot JSON (``<script id="app-data">``), escaped for inlining."""
    app_data = {
        "mode": mode,
        "token": cfg.get("token", ""),
        "root": cfg.get("root", ""),
        "project": {
            "presentations": cfg.get("presentations", []),
            # the project revision this page was built from. deck.js sends
            # it back on every save so the server can refuse a write from a
            # window that has not seen another window's changes.
            "rev": cfg.get("rev", 0),
            "recent": cfg.get("recent", []),
        },
    }
    # the app server boots the decks lean and serves their figure copies
    # from /api/emb (server/state.py); only then does the key appear, so
    # every other page is byte-for-byte what it was
    if cfg.get("lazyEmb"):
        app_data["project"]["lazyEmb"] = 1
    # what build_web knows about the directory the page sits in (whether
    # the demo clips are there, which notebooks it holds already
    # rendered); only that page has the key
    if cfg.get("web"):
        app_data["web"] = cfg["web"]
    return json.dumps(app_data, ensure_ascii=False).replace("</", "<\\/")


#: A piece of a page: text, or text the caller has already encoded.
Piece = str | bytes


def join_shells(shells: list[str] | list[bytes]) -> Piece:
    """The notebooks' shells as the page's ``{shells}``: every one but the
    first sent HIDDEN.

    app.js only registers a hidden shell at boot and wires it the first
    time it is shown (registerLazyShell / wakeShell), so an extra open
    notebook no longer adds its layout and its wiring to every launch
    (2026-10-09, speed: load-app #4). The first is the one app.js shows.

    The attribute is added HERE, where the page is put together, and not
    by render_shell: a shell is the same rendering wherever it sits (the
    app keeps it between page builds -- server/shells.py -- and serves it
    on its own to Reload and Open), and only the page knows which comes
    first. Bytes stay bytes: the app joins encoded shells it keeps, and a
    memoryview slice adds the attribute without copying a shell twice.
    """
    if not shells:
        return ""
    text = [sh for sh in shells if isinstance(sh, str)]
    data = [sh for sh in shells if isinstance(sh, bytes)]
    if text and data:
        raise TypeError("shells are all text or all bytes")
    if not all(sh.startswith("<div ") for sh in text) \
            or not all(sh.startswith(b"<div ") for sh in data):
        raise ValueError("a shell starts with its own <div>")
    if data:
        parts: list[bytes | memoryview] = [data[0]]
        for b in data[1:]:
            parts += [b"<div hidden ", memoryview(b)[5:]]
        return b"".join(parts)
    return "".join([text[0]] + ["<div hidden " + t[5:] for t in text[1:]])


def page_pieces(*, mode: str, title: str, shells: Piece, app_data: Piece,
                asset_base: str | None = None,
                math: bool | None = None,
                deferred: bool = False) -> list[Piece]:
    """page.html filled in, as the pieces to join -- not yet joined.

    The app server joins them as BYTES (:func:`encode_pieces`): it hands
    in the shells and the boot JSON already encoded, because it keeps both
    between page builds, and every other piece is the same object on
    every call, so its encoding is cached too. Joining one str instead
    copied the whole page, widened to four bytes a character the moment
    any notebook output held an emoji (xarray's HTML does), and then
    encoded all of it again -- on every page load.

    ``math``: whether any shell holds maths (decides whether MathJax's
    script fetches at load, see :func:`mathjax_head`). None works it out
    from ``shells``; the app server already knows it per kept shell.

    ``deferred`` (with an ``asset_base``): the scripts in
    render/static.py's DEFERRED -- the slide editor -- are named on the
    page but not run at load; app.js loads the editor when something on
    screen needs it, on first use, or once the page is idle (``jvDeck``).
    Only the local app asks for this. A single-file export has nothing
    beside it to load later, and the web build keeps the editor at load
    too: its welcome screen, which is what it opens on, lists the
    presentations the editor knows about.
    """
    if math is None:
        math = has_marked_math(shells)
    fields: dict[str, Piece] = {
        "title": html.escape(title),
        "head_extra": _head_extra(mode),
        # an empty `shells` is a page with no notebook open
        **_first_layout(bool(shells), mode),
        "shells": shells,
        "app_data": app_data,
        "mathjax": mathjax_head(math),
        "deck_shell": _with_icons(assets.deck_html()),
        "help_html": _with_icons(assets.help_html()),
        "saved_file_js": assets.saved_file_js(),
        "kofi": KOFI_URL,
        "logo": LOGO_SVG,
        "favicon": FAVICON,
        # T621: which build this is, on Home -- in the app and the web
        # build only, so a rendered notebook's bytes never depend on git
        "build": build_badge() if mode in ("app", "web") else "",
    }
    files = static_files()
    links: tuple[tuple[str, str], ...] = ()
    if asset_base is None:
        if deferred:
            raise ValueError("a script can only wait on a page that "
                             "references its assets (asset_base)")
        fields.update({f.field: f.text for f in files})
    else:
        links = tuple(
            (f.tag, f.deferred_link(asset_base)
             if deferred and f.field in DEFERRED else f.link(asset_base))
            for f in files)
        if deferred:
            fields["head_extra"] = str(fields["head_extra"]) + "".join(
                _deferred_hint(asset_base + f.name, bool(shells))
                for f in files if f.field in DEFERRED)
    out: list[Piece] = []
    for literal, field in _compiled(assets.page_template(), links):
        if literal:
            out.append(literal)
        if field is not None:
            out.append(fields[field])
    return out


def encode_pieces(pieces: list[Piece]) -> bytes:
    """:func:`page_pieces` as one UTF-8 body; bytes pieces pass through."""
    return b"".join(p if isinstance(p, bytes) else _encoded(p)
                    for p in pieces)


@functools.lru_cache(maxsize=64)
def _encoded(text: str) -> bytes:
    # the template's literal pieces and the static fields are the same
    # objects on every page build, so after the first build these are
    # identity hits
    return text.encode("utf-8")


#: The web build's welcome, shown as soon as its first screen is parsed
#: (see _first_layout). It is a field VALUE, not template text, so its
#: braces are its own. ONLY AS SENT: a visitor coming back has Recent
#: rows, the last-session offer and their presentations, which app.js
#: puts in; shown before that, the screen said "No recent presentations"
#: to someone who has some, and then the whole centred block jumped up
#: as the lists arrived (layout shift 0.079 with six recents, vs 0). F5
#: on a presentation's address (#/pres/...) is a deck about to open, not
#: Home. Those wait for app.js, which shows the screen complete; an
#: installed app is never offered to install itself, even for a moment.
#: And a control on it clicked while app.js is still on its way (up to
#: ~0.9 s on a 9 Mbps link) -- Try the example, Open, New, a link -- is
#: remembered for app.js to carry out (__jvEarlyClick), not lost.
WELCOME_REVEAL = (
    "<script>(function(){try{if(/^#\\/./.test(location.hash))return;"
    "var p=location.pathname,w='semweb:'+p+':',d='sempres:web:'+p+':',"
    "k=[w+'recent',w+'open',w+'pinned-nb',d+'recent-presentations',"
    "d+'pinned-presentations'];for(var i=0;i<k.length;i++){"
    "var v=localStorage.getItem(k[i]);if(v&&v!=='[]')return;}"
    "if(matchMedia('(display-mode: standalone)').matches)"
    "['welcome-install','welcome-install-sep'].forEach(function(id){"
    "document.getElementById(id).hidden=true;});}catch(e){}"
    "document.getElementById('welcome').addEventListener('click',"
    "function(e){var t=e.target.closest&&e.target.closest("
    "'a[href=\"#\"][id],button[id]');if(!t||window.SemApp)return;"
    "e.preventDefault();window.__jvEarlyClick=t.id;});"
    "document.getElementById('welcome').hidden=false;})();</script>")

#: --chrome-h as app.js measures it for the default first screen -- the
#: open files as tabs on top, so the title row with the tabs over the
#: ribbon: 124px at 1366x657 (126 once the ribbon compacts, at 1280 and
#: below). Only a first guess: measureChrome writes the real value.
FIRST_CHROME_H = 124


def _first_layout(has_docs: bool, mode: str = "static") -> dict[str, str]:
    """Paint the page first the way app.js will arrange it.

    The body used to arrive with no state classes, so the first layout
    was the no-script one -- the side panel 176px wide, no tab row, the
    header 80px -- and booting moved everything: the content 176px left
    and 44px down (layout shift 0.196, load-static #8). With a notebook
    open, app.js's default is the open files as tabs on top (filesAt()
    'top', refreshOpenTabsRow), so that is what is sent. A saved
    preference for the side list still changes it once, as before.

    With nothing open, the WEB build is its welcome screen (refreshChrome:
    nothing open, so `welcoming`; the open files as tabs, so the side
    panel the welcome would sit beside is not there), and it is sent as
    one: the screen used to arrive hidden, the ribbon painted in its
    place, and the welcome text -- the largest thing on it -- appeared
    only once every script had run, 0.4 s after the first paint at 4x CPU
    (load-static #11). Its web-only links (the example, Install) and the
    empty "No recent presentations" line app.js puts up at once are sent
    shown for the same reason; app.js still hides Install when running
    installed, and a saved side list still turns into one before the
    first paint (page.html). It is shown by a line of script the moment
    its first screen has been parsed, not before: shown while still
    arriving, its centred block jumped up as each part came in. Every
    other page with nothing open lets app.js decide, as before.
    """
    hidden = {"welcome_hidden": " hidden", "web_hidden": " hidden",
              "welcome_reveal": ""}
    if not has_docs:
        if mode == "web":
            return {"html_attrs": "",
                    "body_attrs": ' class="files-top welcoming"',
                    "bar_hidden": " hidden",
                    "welcome_hidden": " hidden", "web_hidden": "",
                    "welcome_reveal": WELCOME_REVEAL}
        return {"html_attrs": "", "body_attrs": "", "bar_hidden": " hidden",
                **hidden}
    return {"html_attrs": f' style="--chrome-h:{FIRST_CHROME_H}px"',
            "body_attrs": ' class="files-top tabs-row-on"',
            "bar_hidden": "", **hidden}


def _deferred_hint(url: str, open_any: bool) -> str:
    """The top-of-page half of a script the page names for later (render/
    static.py DEFERRED_HINT): fetched from the start when the page will
    want it at once -- always, on a page with nothing open (Home lists the
    presentations, app.js deckAtLoad), and otherwise when the address or
    this tab's open decks say so, which only the browser knows."""
    if not open_any:
        return f'<link rel="preload" as="script" href="{url}">'
    return f"<script>{DEFERRED_HINT % url}</script>"


def _head_extra(mode: str) -> str:
    # The PWA bits belong to the WEB build only. They have to be here, in
    # the app page, and not merely in the boot loader: that loader hands
    # over with document.write(), which replaces the document and takes
    # its <link rel="manifest"> with it -- leaving the running app with no
    # manifest at all ("no-manifest" from Chrome's installability check,
    # 2026-08-21) and therefore not installable. A static export or the
    # local app server would only 404 on these, so they stay out of both.
    return ('<link rel="manifest" href="manifest.webmanifest">\n'
            '<meta name="theme-color" content="#0a141d">'
            if mode == "web" else "")


@functools.lru_cache(maxsize=8)
def _with_icons(markup: str) -> str:
    """icons() over a static template, once per version of that template.

    The page used to run icons() over the WHOLE assembled page on every
    build -- every notebook's shell and the boot JSON included, 19.4M
    characters and 50-140 ms on a heavy project -- to find tokens only
    the three static templates contain.
    """
    return icons(markup)


@functools.lru_cache(maxsize=8)
def _compiled(template: str, links: tuple[tuple[str, str], ...]
              ) -> tuple[tuple[str, str | None], ...]:
    """page.html as (literal, field) pairs, icons expanded in the literals.

    The same output ``icons(template.format(**fields))`` gave: no field
    value carries an icon token (render_shell expands each shell, the
    deck and help markup go through _with_icons, the boot JSON escapes
    the quotes a token needs, and a test pins that no stylesheet or
    script holds one), and a token has no braces, so none can span a
    field. ``links`` swaps inline asset tags for references, each of
    which must be there exactly once.
    """
    for tag, link in links:
        if template.count(tag) != 1:
            raise ValueError(f"page.html must hold {tag} exactly once")
        template = template.replace(tag, link)
    out = []
    for literal, field, spec, conv in string.Formatter().parse(template):
        if spec or conv:
            raise ValueError(f"page.html field {field!r} has a format "
                             "spec or a conversion; fill it in Python")
        out.append((icons(literal) if literal else "", field))
    return tuple(out)


def render_html(doc: Document, source_name: str | None = None) -> str:
    """Single-notebook page (kept for the widget and simple exports)."""
    if source_name:
        doc.source_name = source_name
    return render_page([doc])
