"""The page's stylesheets and scripts as content-hashed files.

A single-file export inlines every asset, because being one file is the
whole point of it. The local app and the web build have a server (or a
directory) beside the page, and inlining there was pure cost: about 4.5 MB
of identical CSS/JS rode inside every page, so the browser could never
cache it -- no V8 code cache, no off-thread script streaming, and every
launch re-tokenised and recompiled all of it on the main thread (measured
at 4x CPU throttle: 640-710 ms of compile per load, and a warm relaunch
1.0 s slower than it needed to be; 2026-10-08 speed investigation).

So those two modes reference each asset as ``<name>.<hash>.<ext>`` in the
SAME place in the page (a stylesheet link where the ``<style>`` was, a
plain synchronous ``<script src>`` where the inline script was), which
keeps the parse and execution order exactly as before. The name carries a
hash of the CONTENT, so a file can be cached forever ("immutable") and an
edited asset is simply a new name -- the edit loop that ``assets.load``'s
mtime cache protects keeps working, and a stale copy cannot be served.
"""

from __future__ import annotations

import functools
import hashlib
from collections.abc import Callable
from dataclasses import dataclass

from .. import assets
from ..branding import icons_js


@dataclass(frozen=True)
class StaticFile:
    """One asset as a file: what it replaces in page.html, and its bytes."""

    field: str          # the page.html placeholder it stands for
    name: str           # e.g. "deck.3f2a9c1e04b7d6a1.js"
    text: str           # what an inline page carries instead
    data: bytes         # what the file serves: ``text`` as UTF-8
    content_type: str

    @property
    def tag(self) -> str:
        """The inline element in page.html this file replaces."""
        return (f"<style>{{{self.field}}}</style>"
                if self.name.endswith(".css")
                else f"<script>{{{self.field}}}</script>")

    def link(self, base: str) -> str:
        """The element that loads it from ``base`` instead."""
        url = base + self.name
        if self.name.endswith(".css"):
            return f'<link rel="stylesheet" href="{url}">'
        return f'<script src="{url}"></script>'

    def deferred_link(self, base: str) -> str:
        """An INERT reference to the script, for app.js to load later,
        and the gate that decides when.

        The local app's page names the slide editor this way (see
        :data:`DEFERRED` and ``jvDeck`` in app.js): the browser neither
        fetches nor runs it while the page loads. The one-line inline
        script after it hands the decision to app.js (``APP.deckGate``) at
        the moment the parser reaches it -- where the editor's own script
        used to run. When what is on screen at load is the editor's (a
        ``#/pres`` address, Home, a deck's tab), app.js writes the real
        ``<script src>`` in right there and the parser runs it as it always
        did; otherwise app.js puts one in this element's place the moment
        something needs the editor, or once the page has gone idle.
        """
        if not self.name.endswith(".js"):
            raise ValueError(f"only a script can wait: {self.name}")
        stem = self.name.split(".", 1)[0]
        return (f'<script type="text/plain" id="jv-{stem}-src" '
                f'data-src="{base}{self.name}"></script>'
                f'<script>{DEFERRED_GATE}</script>')


#: page.html placeholder -> file stem, extension, loader -- in PAGE ORDER.
#: The order is documentation only (each file replaces its own tag in
#: place), but it is the order the browser runs them in.
_FILES: tuple[tuple[str, str, str, Callable[[], str]], ...] = (
    ("css", "core", "css", assets.core_css),
    ("app_css", "app", "css", assets.app_css),
    ("deck_css", "deck", "css", assets.deck_css),
    ("icons_js", "icons", "js", icons_js),
    ("js", "app", "js", assets.app_js),
    ("pptx_js", "pptx", "js", assets.pptx_js),
    ("deck_js", "deck", "js", assets.deck_js),
)

_TYPES = {"css": "text/css; charset=utf-8",
          "js": "text/javascript; charset=utf-8"}

#: The scripts a page may name without running at load (``deferred=True``
#: in render/page.py's page_pieces): only the slide editor. It is 3.3 MB
#: of one IIFE, and a page that only shows a notebook paid for fetching,
#: compiling and booting all of it before it answered a click -- about
#: 0.4-0.6 s of a 3.2 s load at 4x CPU (2026-10-10, load cost). Its
#: stylesheet and its markup stay where they are: they are what the page
#: already looks like, and neither costs a script's compile.
DEFERRED = frozenset({"deck_js"})

#: What runs right after a deferred reference, while the page is parsed:
#: app.js decides there whether the editor is needed at once (app.js
#: ``APP.deckGate``). Guarded, so a page whose app.js did not run is only
#: a page without its editor.
DEFERRED_GATE = "window.SemApp&&SemApp.deckGate&&SemApp.deckGate()"

#: ...and what runs at the top of the page, so that when the editor will
#: be wanted at once its file is fetched -- and compiled, off the main
#: thread -- alongside everything else, as the parser fetched it when it
#: was on the page, rather than only when the gate is reached: a #/pres
#: address showed its deck 0.4 s later at 4x CPU without it (2026-10-10,
#: measured). It reads what app.js's deckAtLoad reads from the browser --
#: an address that is the editor's, a saved file's hand-over, decks this
#: tab still has open -- and only asks the browser to fetch; deckAtLoad
#: still decides (tests/test_the_editor_loads_on_first_use.py runs both
#: over the same cases). ``%s`` is the script's URL.
DEFERRED_HINT = (
    "try{(function(h,s){var on=/^#\\/?(pres|home)(\\/|$)/.test(h)"
    "||/^#junoview-handoff/.test(h),i,k,v;"
    "for(i=0;!on&&i<s.length;i++){k=s.key(i);"
    "if(k&&k.indexOf('sempres-open:')===0){v=JSON.parse(s.getItem(k)||'[]');"
    "on=Array.isArray(v)&&v.length>0;}}"
    "if(on){var l=document.createElement('link');l.rel='preload';"
    "l.as='script';l.href='%s';document.head.appendChild(l);}"
    "})(location.hash,sessionStorage);}catch(e){}")


def static_files() -> tuple[StaticFile, ...]:
    """Every externalisable asset, as it is on disk right now."""
    return _build(tuple(load() for _f, _s, _e, load in _FILES))


@functools.lru_cache(maxsize=4)
def _build(texts: tuple[str, ...]) -> tuple[StaticFile, ...]:
    # Keyed on the texts. Every loader hands back one cached object per
    # unchanged file, so a hit compares by identity and costs nothing;
    # an edited asset is a new string, a new key and a new hash.
    out = []
    for (field, stem, ext, _load), text in zip(_FILES, texts, strict=True):
        data = text.encode("utf-8")
        digest = hashlib.sha256(data).hexdigest()[:16]
        out.append(StaticFile(field, f"{stem}.{digest}.{ext}", text, data,
                              _TYPES[ext]))
    return tuple(out)


def static_file(name: str) -> StaticFile | None:
    """The current file called ``name``, or None for anything else --
    including an older hash of the same asset, which is never served."""
    for f in static_files():
        if f.name == name:
            return f
    return None
