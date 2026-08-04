"""Marks, icons and links that identify Junoview in a rendered page.

The icon set is inline SVG rather than emoji on purpose: emoji render as tofu
boxes in this app's monospace font. One 16x16 grid, one stroke style, so every
button reads as the same family.
"""

from __future__ import annotations

import re
import urllib.parse

_REPO_URL = "https://github.com/alexborowiak/junoview"


_KOFI_URL = "https://ko-fi.com/plotline"


# The Junoview mark: a peacock-feather "ocellus" (eye) — concentric teal /
# amber / blue / dark rings inside twelve barbs with three amber dots. Inline
# SVG so it stays crisp and self-contained in every runtime (juno-view-ocellus).
# --- the chrome icon set -------------------------------------------------
# Inline SVG, never emoji: emoji render as tofu boxes in this app's mono
# font (that cost several rounds once already). One grid (16x16), one
# style (stroke, currentColor), so every button reads as the same family.
# Markup uses <i data-ic="key"></i> tokens which _icons() expands, so the
# templates stay readable and the artwork lives in exactly one place.
_ICON_PATHS = {
    # files / app
    "open": '<path d="M1.8 12.6V4.2a1 1 0 0 1 1-1h3.1l1.4 1.6h6a1 1 0 0 1 1 '
            '1v6.8a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1Z"/>',
    "reload": '<path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8"/>'
              '<path d="M13.6 2.2v3.1h-3.1"/>',
    "info": '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.4v4"/>'
            '<path d="M8 4.9v.1"/>',
    # filters: one per content type
    "plots": '<path d="M2.4 13.2h11.2"/><path d="M4.6 13.2V8.1"/>'
             '<path d="M8 13.2V3.6"/><path d="M11.4 13.2V6.3"/>',
    "markdown": '<path d="M2.6 4.2h10.8"/><path d="M2.6 7.4h10.8"/>'
                '<path d="M2.6 10.6h7.2"/>',
    "code": '<path d="M5.6 5.2 2.4 8l3.2 2.8"/>'
            '<path d="M10.4 5.2 13.6 8l-3.2 2.8"/>',
    "output": '<rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.2"/>'
              '<path d="M4.6 6.6 6.4 8l-1.8 1.4"/><path d="M8.4 10h3"/>',
    # a sub-picker: a funnel, the universal "narrow this down"
    "types": '<path d="M2.6 3.6h10.8L9.4 8.2v4.3l-2.8-1.6V8.2Z"/>',
    # scope + reset
    "scope": '<path d="M6.4 4.2h7.2"/><path d="M6.4 8h7.2"/>'
             '<path d="M6.4 11.8h7.2"/><path d="m2.2 4.2.9.9 1.6-1.7"/>'
             '<path d="m2.2 8 .9.9L4.7 7.2"/>',
    "reset": '<path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/>'
             '<path d="M2.4 2.2v3.1h3.1"/>',
    "inherit": '<path d="M8 2.6v8.2"/><path d="m4.8 7.6 3.2 3.2 3.2-3.2"/>'
               '<path d="M2.6 13.4h10.8"/>',
    # sizes
    "minus": '<path d="M3.6 8h8.8"/>',
    "plus": '<path d="M8 3.6v8.8"/><path d="M3.6 8h8.8"/>',
    # views
    "raw": '<path d="M6.2 3.2 4 12.8"/><path d="M9.8 3.2 12 12.8"/>'
           '<path d="M2.6 6.4h10.8"/><path d="M2.6 9.6h10.8"/>',
    "tree": '<rect x="5.8" y="1.8" width="4.4" height="3.2" rx=".8"/>'
            '<rect x="1.6" y="11" width="4.4" height="3.2" rx=".8"/>'
            '<rect x="10" y="11" width="4.4" height="3.2" rx=".8"/>'
            '<path d="M8 5v3.2M3.8 11V8.2h8.4V11"/>',
    "doc": '<path d="M3.4 2.4h6l3.2 3.2v8a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8'
           '-.8V3.2a.8.8 0 0 1 .8-.8Z"/><path d="M9.2 2.4v3.4h3.4"/>'
           '<path d="M5.4 9h5.2M5.4 11.4h3.4"/>',
    "present": '<rect x="1.8" y="2.8" width="12.4" height="9" rx="1"/>'
               '<path d="m6.8 6.1 3 1.9-3 1.9Z"/><path d="M8 11.8v1.6"/>',
    # the presenting bar's own controls
    "outline": '<rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.2"/>'
               '<path d="M6.2 2.6v10.8"/><path d="M3.2 5.6h1.8M3.2 8h1.8"/>',
    "docktop": '<rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.2"/>'
               '<path d="M1.8 6.2h12.4"/><path d="M4.4 4.3h5.4"/>',
    "dockright": '<rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.2"/>'
                 '<path d="M9.8 2.4v11.2"/><path d="M11.5 5h1.2M11.5 7.4h1.2"/>',
    "autohide": '<rect x="1.8" y="2.4" width="4" height="11.2" rx="1"/>'
                 '<path d="M14.2 8H8"/><path d="M10.4 5.8 8 8l2.4 2.2"/>',
    "pin": '<path d="M6 1.9h4l-.6 4.2 2.4 2.3H4.2l2.4-2.3Z"/>'
           '<path d="M8 8.4v5.7"/>',
    "exit": '<path d="M4 4l8 8"/><path d="M12 4l-8 8"/>',
    # app
    "theme": '<circle cx="8" cy="8" r="5.6"/><path d="M8 2.4v11.2"/>'
             '<path d="M8 4.6a3.4 3.4 0 0 1 0 6.8"/>',
    "heart": '<path d="M8 13.3S2.2 9.9 2.2 6.3A2.9 2.9 0 0 1 8 4.7a2.9 2.9 0 '
             '0 1 5.8 1.6c0 3.6-5.8 7-5.8 7Z"/>',
    "help": '<circle cx="8" cy="8" r="6.2"/>'
            '<path d="M6.2 6.2a1.9 1.9 0 1 1 2.4 2.2v1.1"/>'
            '<path d="M8.6 12v.1"/>',
    # custom views
    "style": '<path d="M10.6 2.6 13.4 5.4 6.2 12.6H3.4V9.8Z"/>'
             '<path d="m9.2 4 2.8 2.8"/>',
    # tree-view controls: arrows OUT of a box = expand, INTO it = collapse,
    # and a left-right measure = width
    "expand": '<path d="M6 2.6H2.6V6"/><path d="M10 13.4h3.4V10"/>'
              '<path d="M2.6 2.6 6.8 6.8"/><path d="M13.4 13.4 9.2 9.2"/>',
    "collapse": '<path d="M2.6 6.4H6V3"/><path d="M13.4 9.6H10V13"/>'
                '<path d="M6 6.4 2.6 3"/><path d="M10 9.6l3.4 3.4"/>',
    "width": '<path d="M1.6 8h12.8"/><path d="M4.2 5.4 1.6 8l2.6 2.6"/>'
             '<path d="M11.8 5.4 14.4 8l-2.6 2.6"/>',
    # the three "+ New ..." rail buttons. Collapsed to icons they used to be
    # "+", a rectangle and a triple bar — three near-identical glyphs for
    # three different kinds of thing, so each now shows what it makes.
    "newdeck": '<rect x="1.6" y="3.2" width="9.6" height="7.2" rx="1"/>'
               '<path d="M3.6 12.8h5.6"/><path d="M13.4 4.6v5.2"/>'
               '<path d="M10.8 7.2h5.2"/>',
    "newposter": '<rect x="2.4" y="1.8" width="7.6" height="12.4" rx="1"/>'
                 '<path d="M4.2 5h4M4.2 7.4h4M4.2 9.8h2.4"/>'
                 '<path d="M13.4 4.6v5.2"/><path d="M10.8 7.2h5.2"/>',
    "newview": '<path d="M2.4 2.6h5.8l2.6 2.6v8.2H2.4Z"/>'
               '<path d="M4.6 8.4h4M4.6 10.8h2.6"/>'
               '<path d="M13.9 2.4 15.4 3.9 12 7.3h-1.5V5.8Z"/>',
    # the deck editor's toolbar (2026-08-04): the insert buttons carried
    # bare "+" labels and mismatched unicode glyphs; each now shows what
    # it inserts, in the same 16-grid stroke style as the app ribbon.
    "play": '<path d="M5.2 3.2v9.6l7.8-4.8Z"/>',
    "cellcard": '<rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.2"/>'
                '<path d="M2.2 5.6h11.6"/><path d="M4.8 11.2V8.6"/>'
                '<path d="M7.6 11.2V7.2"/><path d="M10.4 11.2V9.4"/>',
    "text": '<path d="M3.4 4.6V3.2h9.2v1.4"/><path d="M8 3.2v9.6"/>'
            '<path d="M6.2 12.8h3.6"/>',
    "arrow": '<path d="M3.4 12.6 12.6 3.4"/><path d="M7.8 3.4h4.8v4.8"/>',
    "hline": '<path d="M2 8h12"/><path d="M2 5.8v4.4"/>'
             '<path d="M14 5.8v4.4"/>',
    "shapes": '<rect x="2.2" y="5.6" width="7" height="7" rx="1"/>'
              '<circle cx="10.6" cy="5.8" r="3.4"/>',
    "image": '<rect x="2" y="3" width="12" height="10" rx="1.2"/>'
             '<circle cx="5.7" cy="6.4" r="1.1"/>'
             '<path d="m4 12 3.3-3.8 2.2 2.3 1.9-2L14 12"/>',
    "qr": '<rect x="2.2" y="2.2" width="4.4" height="4.4"/>'
          '<rect x="9.4" y="2.2" width="4.4" height="4.4"/>'
          '<rect x="2.2" y="9.4" width="4.4" height="4.4"/>'
          '<path d="M9.4 9.4h2v2h-2Z"/><path d="M13.8 9.4v1.8"/>'
          '<path d="M9.4 13.8h1.8"/><path d="M13 12.6v1.2h.8"/>',
    "layouts": '<rect x="2" y="2.6" width="5.2" height="4.6" rx=".8"/>'
               '<rect x="8.8" y="2.6" width="5.2" height="4.6" rx=".8"/>'
               '<rect x="2" y="8.8" width="12" height="4.6" rx=".8"/>',
    "pagep": '<rect x="4" y="1.8" width="8" height="12.4" rx="1"/>',
    "objects": '<path d="M8 2.4 14 5.6 8 8.8 2 5.6Z"/>'
               '<path d="m2 9.2 6 3.2 6-3.2"/>',
}


def _icons(markup: str) -> str:
    """Swap every ``<i data-ic="key"></i>`` token for its inline SVG."""
    def sub(m: re.Match) -> str:
        body = _ICON_PATHS.get(m.group(1))
        if body is None:
            return ""
        return ('<svg class="bic" viewBox="0 0 16 16" aria-hidden="true" '
                'focusable="false">' + body + '</svg>')
    return re.sub(r'<i data-ic="([a-z]+)"></i>', sub, markup)


_LOGO_SVG = (
    '<svg class="jv-logo" viewBox="0 0 200 200" '
    'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Junoview">'
    '<g stroke="#1D9E75" stroke-width="2.5" stroke-linecap="round" '
    'opacity="0.8">'
    '<line x1="169.55" y1="118.64" x2="186.93" y2="123.29"/>'
    '<line x1="150.91" y1="150.91" x2="163.64" y2="163.64"/>'
    '<line x1="118.64" y1="169.55" x2="123.29" y2="186.93"/>'
    '<line x1="81.36" y1="169.55" x2="76.71" y2="186.93"/>'
    '<line x1="49.09" y1="150.91" x2="36.36" y2="163.64"/>'
    '<line x1="30.45" y1="118.64" x2="13.07" y2="123.29"/>'
    '<line x1="30.45" y1="81.36" x2="13.07" y2="76.71"/>'
    '<line x1="49.09" y1="49.09" x2="36.36" y2="36.36"/>'
    '<line x1="81.36" y1="30.45" x2="76.71" y2="13.07"/>'
    '<line x1="118.64" y1="30.45" x2="123.29" y2="13.07"/>'
    '<line x1="150.91" y1="49.09" x2="163.64" y2="36.36"/>'
    '<line x1="169.55" y1="81.36" x2="186.93" y2="76.71"/>'
    '</g>'
    '<circle cx="100" cy="100" r="66" fill="#0F6E56"/>'
    '<circle cx="100" cy="100" r="66" fill="none" stroke="#EF9F27" '
    'stroke-width="3.5"/>'
    '<circle cx="100" cy="100" r="42" fill="#185FA5"/>'
    '<circle cx="100" cy="100" r="18" fill="#04342C"/>'
    '<circle cx="100" cy="12" r="7.5" fill="#EF9F27"/>'
    '<circle cx="176.21" cy="144" r="7.5" fill="#EF9F27"/>'
    '<circle cx="23.79" cy="144" r="7.5" fill="#EF9F27"/>'
    '</svg>'
)


_FAVICON = "data:image/svg+xml," + urllib.parse.quote(_LOGO_SVG)
