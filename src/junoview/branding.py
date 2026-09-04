"""Marks, icons and links that identify Junoview in a rendered page.

The icon set is inline SVG rather than emoji on purpose: emoji render as tofu
boxes in this app's monospace font. One 16x16 grid, one stroke style, so every
button reads as the same family.
"""

from __future__ import annotations

import json
import re
import urllib.parse

KOFI_URL = "https://ko-fi.com/plotline"


# The Junoview mark: a peacock-feather "ocellus" (eye) — concentric teal /
# amber / blue / dark rings inside twelve barbs with three amber dots. Inline
# SVG so it stays crisp and self-contained in every runtime (juno-view-ocellus).
# --- the chrome icon set -------------------------------------------------
# Inline SVG, never emoji: emoji render as tofu boxes in this app's mono
# font (that cost several rounds once already). One grid (16x16), one
# style (stroke, currentColor), so every button reads as the same family.
# Markup uses <i data-ic="key"></i> tokens which icons() expands, so the
# templates stay readable and the artwork lives in exactly one place.
#
# THE SAME TABLE FEEDS EVERY RUNTIME (2026-08-23). Three consumers, one
# source, no copied path data anywhere:
#   * templates + items.py -- build-time. Templates carry tokens that
#     icons() expands; items.py calls icon_svg() directly so its card
#     chrome is final markup on every path (page, server routes, widget).
#   * app.js / deck.js -- runtime-built DOM. page.py injects a
#     <script> from icons_js() defining window.SemIcons (key -> the SAME
#     finished <svg class="bic"> markup icons() stamps). Each script has
#     a two-line bic(key) accessor that returns '' when the map is
#     absent, so a page without the block degrades to missing icons, not
#     a dead script.
#   * widget.js -- anywidget has no page.py, so widget.py ships
#     icons_map() inside the synced `data` dict and widget.js reads it
#     from there (with the same soft fallback).
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
    # an open eye: Unhide all. Its token shipped for weeks with NO entry
    # here, and the substituter silently deleted it — the button had no
    # icon and nothing complained (2026-08-19; the same silent path the
    # completeness check below now closes).
    "eye": '<path d="M1.8 8s2.3-4.2 6.2-4.2S14.2 8 14.2 8s-2.3 4.2-6.2 '
           '4.2S1.8 8 1.8 8Z"/><circle cx="8" cy="8" r="1.9"/>',
    "reset": '<path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/>'
             '<path d="M2.4 2.2v3.1h3.1"/>',
    "inherit": '<path d="M8 2.6v8.2"/><path d="m4.8 7.6 3.2 3.2 3.2-3.2"/>'
               '<path d="M2.6 13.4h10.8"/>',
    # sizes
    "minus": '<path d="M3.6 8h8.8"/>',
    "plus": '<path d="M8 3.6v8.8"/><path d="M3.6 8h8.8"/>',
    # navigation: plain chevrons, distinct from z-order and drawing arrows
    "prev": '<path d="m10.4 3.2-4.8 4.8 4.8 4.8"/>',
    "next": '<path d="m5.6 3.2 4.8 4.8-4.8 4.8"/>',
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
    # a palette: the colour-scheme picker
    "palette": '<circle cx="8" cy="8" r="5.8"/>'
              '<circle cx="6" cy="6" r="1" fill="currentColor"/>'
              '<circle cx="10" cy="6" r="1" fill="currentColor"/>'
              '<circle cx="10.5" cy="9.5" r="1" fill="currentColor"/>',
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
    # a spiral-bound page: the notebooks pane
    "nb": '<rect x="4" y="2.6" width="9" height="10.8" rx="1.2"/>'
          '<path d="M6.8 2.6v10.8"/><path d="M2.6 5h1.4"/>'
          '<path d="M2.6 8h1.4"/><path d="M2.6 11h1.4"/>',
    # a nib on a stroke: freehand drawing
    "pen": '<path d="M2.4 13.6c2.6.4 4-1 4.6-2.4"/>'
           '<path d="m5.6 10.4 5.8-5.8a1.6 1.6 0 0 1 2.3 2.3l-5.8 5.8z"/>',
    "shapes": '<rect x="2.2" y="5.6" width="7" height="7" rx="1"/>'
              '<circle cx="10.6" cy="5.8" r="3.4"/>',
    "image": '<rect x="2" y="3" width="12" height="10" rx="1.2"/>'
             '<circle cx="5.7" cy="6.4" r="1.1"/>'
             '<path d="m4 12 3.3-3.8 2.2 2.3 1.9-2L14 12"/>',
    "layouts": '<rect x="2" y="2.6" width="5.2" height="4.6" rx=".8"/>'
               '<rect x="8.8" y="2.6" width="5.2" height="4.6" rx=".8"/>'
               '<rect x="2" y="8.8" width="12" height="4.6" rx=".8"/>',
    "pagep": '<rect x="4" y="1.8" width="8" height="12.4" rx="1"/>',
    "objects": '<path d="M8 2.4 14 5.6 8 8.8 2 5.6Z"/>'
               '<path d="m2 9.2 6 3.2 6-3.2"/>',
    # ------------------------------------------------------------------
    # 2026-08-23: the ribbon fill-in batch. A verified review found the
    # deck ribbon and the second-tier chrome (layers pane, welcome list,
    # open dialog, tab strip) still wearing raw unicode glyphs and emoji
    # because these were never drawn. Artwork only: nothing below is
    # referenced yet — a follow-up step swaps the glyph sites over to
    # <i data-ic="..."> tokens.
    # insert tab
    "flipbook": '<rect x="2" y="3.2" width="12" height="9.6" rx="1.2"/>'
                '<path d="m6.4 6.1-1.9 1.9 1.9 1.9"/>'
                '<path d="m9.6 6.1 1.9 1.9-1.9 1.9"/>',
    "table": '<rect x="2.2" y="3" width="11.6" height="10" rx="1"/>'
             '<path d="M2.2 6.2h11.6"/><path d="M8 6.2V13"/>'
             '<path d="M2.2 9.6h11.6"/>',
    # an integral sign: the LaTeX equation tools
    "maths": '<path d="M10.9 3c-1.9-.9-2.9.2-2.9 2v6c0 1.8-1 2.9-2.9 '
             '2"/>',
    # view group: a ruler on the diagonal, and a plain grid
    "rulers": '<path d="M1.8 11.4 11.4 1.8l2.8 2.8-9.6 9.6Z"/>'
              '<path d="m4.6 8.6 1.2 1.2M7 6.2l1.2 1.2M9.4 3.8l1.2 '
              '1.2"/>',
    "grid": '<path d="M5.4 2.4v11.2M10.6 2.4v11.2"/>'
            '<path d="M2.4 5.4h11.2M2.4 10.6h11.2"/>',
    # YOUR OWN guides, as opposed to the fixed 12-column "grid": a page
    # with two dashed lines you put there. It has to read apart from both
    # its neighbours in the View group -- "grid" is a hash of solid rules
    # with no page round it, and "frame" (the guide-box TOOL) is the
    # dashed box with no page and no lines.
    "guides": '<rect x="2.2" y="2.6" width="11.6" height="10.8" rx="1"/>'
              '<path d="M6.2 2.6v10.8" stroke-dasharray="2.4 2"/>'
              '<path d="M2.2 9.6h11.6" stroke-dasharray="2.4 2"/>',
    # a flag on a pole: the print check
    "flag": '<path d="M3.8 14.2V2.2"/><path d="M3.8 3h8.4v5H3.8"/>',
    # document furniture (Design tab). Header reuses "docktop" above.
    "footer": '<rect x="1.8" y="2.4" width="12.4" height="11.2" '
              'rx="1.2"/><path d="M1.8 9.8h12.4"/>'
              '<path d="M4.4 11.7h5.4"/>',
    "wmark": '<rect x="3" y="2.2" width="10" height="11.6" rx="1"/>'
             '<path d="m5.2 11.6 5.6-5.6"/><path d="m5.2 8.2 2.6-2.6"/>',
    # a slide with a page number on it
    "numbers": '<rect x="2.4" y="2.8" width="11.2" height="10.4" '
               'rx="1.2"/><path d="m6.6 6.9 1.8-1.4v5"/>'
               '<path d="M6.4 10.5h4"/>',
    # "Aa": the named text styles
    "styles": '<path d="M2.4 12 5.6 4l3.2 8"/><path d="M3.5 9.2h4.2"/>'
              '<circle cx="11.8" cy="9.9" r="2.1"/>'
              '<path d="M13.9 7.8V12"/>',
    # three plain lines: the generic list / overflow menu (never the
    # markdown filter, whose third line is short)
    "menu": '<path d="M2.6 4.2h10.8M2.6 8h10.8M2.6 11.8h10.8"/>',
    # a card with the edges of the stack behind it: poster versions
    "versions": '<rect x="2.2" y="8.2" width="11.6" height="5.2" '
                'rx="1"/><path d="M3.6 5.8h8.8"/><path d="M5 3.4h6"/>',
    # slide actions
    "copy": '<rect x="5.6" y="5.6" width="8.2" height="8.2" rx="1.2"/>'
            '<path d="M10.4 2.4H3.6a1.2 1.2 0 0 0-1.2 1.2v6.8"/>',
    # a clipboard with its clip -- the OTHER half of copy, and distinct
    # from it at 16px because the clip reads even when the body does not
    "paste": '<rect x="3.4" y="3" width="9.2" height="11" rx="1.2"/>'
             '<path d="M6.2 3.4V2.6a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v.8Z"/>',
    "swap": '<path d="M2.4 5.3h9.6"/><path d="m9.6 2.9 2.4 2.4-2.4 '
            '2.4"/><path d="M13.6 10.7H4"/>'
            '<path d="m6.4 8.3-2.4 2.4 2.4 2.4"/>',
    # arrange: to the front bar / to the back bar, align to an edge,
    # a marquee round two shapes = group
    "front": '<path d="M2.8 2.8h10.4"/><path d="M8 13.6V5.8"/>'
             '<path d="m4.9 8.9 3.1-3.1 3.1 3.1"/>',
    "back": '<path d="M2.8 13.2h10.4"/><path d="M8 2.4v7.8"/>'
            '<path d="m4.9 7.1 3.1 3.1 3.1-3.1"/>',
    # T212: alignment, lists -- the four ribbon buttons that had no icon
    "alignleft": '<path d="M2.4 3.4h11.2M2.4 6.6h7M2.4 9.8h11.2M2.4 13h7"/>',
    "aligncentre": '<path d="M2.4 3.4h11.2M4.5 6.6h7M2.4 9.8h11.2M4.5 13h7"/>',
    "alignright": '<path d="M2.4 3.4h11.2M6.6 6.6h7M2.4 9.8h11.2M6.6 13h7"/>',
    "bullets": '<circle cx="3.4" cy="4.6" r="1.2"/><circle cx="3.4" cy="11.4" r="1.2"/>'
               '<path d="M6.6 4.6h7M6.6 11.4h7"/>',
    "numlist": '<path d="M2.6 3.2h1.6v3.2M2.6 6.4h1.6M2.4 9.6h2.2l-2.2 2.6h2.4"/>'
               '<path d="M6.6 4.6h7M6.6 11.4h7"/>',
    "align": '<path d="M2.6 2v12"/>'
             '<rect x="4.8" y="3.6" width="8.8" height="2.8" rx=".8"/>'
             '<rect x="4.8" y="9.6" width="5.4" height="2.8" rx=".8"/>',
    "group": '<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="1.6" '
             'stroke-dasharray="2.6 2.3"/>'
             '<rect x="4.2" y="4.2" width="4.2" height="4.2" rx=".8"/>'
             '<circle cx="10.2" cy="10.2" r="2.1"/>',
    # ungroup: the same two shapes with the marquee let go -- only the
    # opposite corners of it are left
    "ungroup": '<path d="M1.6 5.2V1.6h3.6"/><path d="M14.4 10.8v3.6h-3.6"/>'
               '<rect x="3" y="3" width="4.6" height="4.6" rx=".8"/>'
               '<circle cx="11" cy="11" r="2.3"/>',
    # ONE PLACE, not all the way: front/back's arrow against a short
    # step instead of the full bar. Reusing front/back here put the
    # SAME icon on two neighbouring buttons that do different things.
    "forward": '<path d="M2.4 10.6 8 7.5l5.6 3.1L8 13.7Z"/>'
               '<path d="M8 5.2V1.6"/><path d="m6.1 3.5 1.9-1.9 1.9 1.9"/>',
    "backward": '<path d="M2.4 5.4 8 2.3l5.6 3.1L8 8.5Z"/>'
                '<path d="M8 10.8v3.6"/><path d="m6.1 12.5 1.9 1.9 1.9-1.9"/>',
    # rotate: an OBJECT under a turning arc. The circular-arrow icons
    # this borrowed before (reset, reload) read as undo and refresh.
    "rotl": '<rect x="3.8" y="7.4" width="8.4" height="6.4" rx="1"/>'
            '<path d="M12.4 5.4A5 5 0 0 0 3.8 4.9"/>'
            '<path d="M3.4 2.2v2.9h2.9"/>',
    "rotr": '<rect x="3.8" y="7.4" width="8.4" height="6.4" rx="1"/>'
            '<path d="M3.6 5.4A5 5 0 0 1 12.2 4.9"/>'
            '<path d="M12.6 2.2v2.9H9.7"/>',
    # text block controls
    "outdent": '<path d="M7.8 3.8h5.6M7.8 8h5.6M7.8 12.2h5.6"/>'
               '<path d="M5.4 5.6 3 8l2.4 2.4"/>',
    "indent": '<path d="M7.8 3.8h5.6M7.8 8h5.6M7.8 12.2h5.6"/>'
              '<path d="m3 5.6 2.4 2.4L3 10.4"/>',
    "spacing": '<path d="M2.6 2.6h10.8M2.6 13.4h10.8"/>'
               '<path d="M8 4.9v6.2"/>'
               '<path d="M6.1 6.6 8 4.7l1.9 1.9"/>'
               '<path d="M6.1 9.4 8 11.3l1.9-1.9"/>',
    # line & shape: weight steps, dash styles, an elbowed route, a
    # half-filled square
    "weight": '<path d="M2.6 3.4h10.8" stroke-width="1"/>'
              '<path d="M2.6 7.7h10.8" stroke-width="2"/>'
              '<path d="M2.6 12.2h10.8" stroke-width="3.2"/>',
    "dashes": '<path d="M2.6 3.8h10.8"/>'
              '<path d="M2.6 8h10.8" stroke-dasharray="3 2.4"/>'
              '<path d="M2.6 12.2h10.8" stroke-dasharray="0 2.8"/>',
    "route": '<path d="M3.2 13.4V7.6a2.4 2.4 0 0 1 2.4-2.4h6.6"/>'
             '<path d="m9.8 2.8 2.4 2.4-2.4 2.4"/>',
    "fill": '<rect x="2.6" y="2.6" width="10.8" height="10.8" '
            'rx="1.4"/><path d="M12.4 6v5.6a.8.8 0 0 1-.8.8H6Z" '
            'fill="currentColor"/>',
    # animation builds: one by one (steps) / all at once (one bracket)
    "stagger": '<path d="M2.4 3.8h4.6"/><path d="M5.7 8h4.6"/>'
               '<path d="M9 12.2h4.6"/>',
    "together": '<path d="M4.6 2.6H2.8v10.8h1.8"/>'
                '<path d="M6.6 4.2h6.8M6.6 8h6.8M6.6 11.8h6.8"/>',
    # a circle with a bar through it: no animation
    "none": '<circle cx="8" cy="8" r="5.7"/><path d="M4 4l8 8"/>',
    # APPEAR: a box that is simply THERE, with the little rays of
    # something arriving all at once. It has been an option in the
    # animation pane since the day the pane landed and never had a
    # picture, because it never had a button -- the gallery gives it
    # one (T171).
    "appear": '<rect x="4.4" y="5.4" width="7.2" height="5.2" rx="1"/>'
              '<path d="M8 1.8v1.5M8 12.7v1.5M1.8 8h1.5M12.7 8h1.5"/>',
    # the three builds, each drawn as what it DOES to the thing:
    # solid giving way to dashed, an arrow coming up into it, and a
    # small one pushing its corners out
    "fade": '<path d="M2.8 3.2v9.6"/>'
            '<path d="M6.5 3.2v9.6" stroke-dasharray="3.4 1.7"/>'
            '<path d="M10.1 3.2v9.6" stroke-dasharray="1.7 2.3"/>'
            '<path d="M13.4 3.2v9.6" stroke-dasharray="0 3.1"/>',
    "rise": '<rect x="3.4" y="2.4" width="9.2" height="6" rx="1"/>'
            '<path d="M8 14.4v-3.6"/><path d="m6.1 12.6 1.9-1.8 1.9 1.8"/>',
    "zoom": '<rect x="5.2" y="5.2" width="5.6" height="5.6" rx=".9"/>'
            '<path d="M2.4 6V2.4h3.6"/><path d="M13.6 10v3.6H10"/>',
    # figure/image tools
    "crop": '<path d="M4.6 1.8v9.6h9.6"/><path d="M1.8 4.6h9.6v9.6"/>',
    "locate": '<circle cx="8" cy="8" r="4.2"/>'
              '<path d="M8 1.6v2.4M8 12v2.4M1.6 8H4M12 8h2.4"/>',
    "lock": '<rect x="3.2" y="7.2" width="9.6" height="6.6" rx="1.2"/>'
            '<path d="M5.4 7.2V5.1a2.6 2.6 0 0 1 5.2 0v2.1"/>'
            '<path d="M8 9.7v1.6"/>',
    "unlock": '<rect x="3.2" y="7.2" width="9.6" height="6.6" '
              'rx="1.2"/><path d="M5.4 7.2V5.1a2.6 2.6 0 0 1 5.1-.6"/>'
              '<path d="M8 9.7v1.6"/>',
    # an empty flip-book frame (dashed = nothing in it yet)
    "frame": '<rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1" '
             'stroke-dasharray="2.7 2.3"/>',
    # document-wide actions in the thin top bar
    # a broken chain: untie. `link` on its own would have said the
    # opposite of what the row does, and reusing a neighbour's glyph is
    # the named defect T39/T54 swept for.
    "unlink": '<path d="M6.6 9.4a2.9 2.9 0 0 1 .3-3.8l1.6-1.6a2.9 2.9 '
              '0 0 1 4.1 4.1l-.9.9"/>'
              '<path d="M9.4 6.6a2.9 2.9 0 0 1-.3 3.8l-1.6 1.6a2.9 2.9 '
              '0 0 1-4.1-4.1l.9-.9"/>'
              '<path d="M2.4 2.4l11.2 11.2"/>',
    # a picture with a line of words under it: a caption is a text box
    # that belongs to a figure, and neither `text` nor `image` says that
    "caption": '<rect x="2.2" y="2.4" width="11.6" height="7.2" rx="1"/>'
               '<path d="M2.2 12.2h8.4"/><path d="M2.2 14.2h5.6"/>',
    "find": '<circle cx="7" cy="7" r="4.3"/>'
            '<path d="m10.2 10.2 3.6 3.6"/>',
    "undo": '<path d="M3 6.2h7.2a3.3 3.3 0 0 1 0 6.6H6.6"/>'
            '<path d="M5.8 3.4 3 6.2 5.8 9"/>',
    "redo": '<path d="M13 6.2H5.8a3.3 3.3 0 0 0 0 6.6h3.6"/>'
            '<path d="M10.2 3.4 13 6.2 10.2 9"/>',
    # a five-pointed star: one of the marks you can put on a cell (T242)
    "star": '<path d="m8 2.2 1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9'
            ' .7-4-2.9-2.8 4-.6Z"/>',
    # a roof over a doorway: back to the start screen (T239)
    "home": '<path d="M2.2 7.6 8 2.6l5.8 5"/>'
            '<path d="M3.9 8.6v4.8h8.2V8.6"/>',
    # a hooked back-arrow: leave the editor / stop presenting
    "return": '<path d="M13.2 3.6v2.6a3 3 0 0 1-3 3H3.4"/>'
              '<path d="M6.2 6.3 3.3 9.2l2.9 2.9"/>',
    # the reset arc wearing clock hands: automatic version history
    "clock": '<circle cx="8" cy="8" r="6"/>'
             '<path d="M8 4.6V8l2.4 1.5"/>',
    "history": '<path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/>'
               '<path d="M2.4 2.2v3.1h3.1"/>'
               '<path d="M8 5.2V8l2.2 1.3"/>',
    # a chain: open from a URL
    "link": '<path d="M6.9 9.1a2.9 2.9 0 0 1 0-4.1l1.6-1.6a2.9 2.9 0 0 '
            '1 4.1 4.1l-.9.9"/>'
            '<path d="M9.1 6.9a2.9 2.9 0 0 1 0 4.1l-1.6 1.6a2.9 2.9 0 '
            '0 1-4.1-4.1l.9-.9"/>',
}


def icon_svg(key: str) -> str:
    """One icon's finished markup — the ONE wrapper every consumer gets.

    ``icons()`` (template tokens), :mod:`junoview.render.items` (card
    chrome built in Python) and :func:`icons_map` (the runtime-JS map)
    all come through here, so the ``.bic`` class, the viewBox and the
    aria attributes cannot drift apart between build-time and runtime
    icons. Unknown keys are LOUD for the same reason they are in
    ``icons()``.
    """
    body = _ICON_PATHS.get(key)
    if body is None:
        raise ValueError(
            "unknown icon token <i data-ic=\"" + key
            + "\"></i> — add it to _ICON_PATHS in branding.py")
    return ('<svg class="bic" viewBox="0 0 16 16" aria-hidden="true" '
            'focusable="false">' + body + '</svg>')


def icons_map() -> dict[str, str]:
    """Every icon's finished markup, keyed by name — for runtime DOM."""
    return {k: icon_svg(k) for k in _ICON_PATHS}


def icons_js() -> str:
    """A script-block body defining ``window.SemIcons``.

    page.py injects this before app.js/deck.js run, so DOM built at
    runtime stamps the SAME artwork the templates got at build time —
    no path data is ever copied into a .js file. ``</`` is escaped so no
    icon could ever close the inline <script> early.
    """
    return ("window.SemIcons="
            + json.dumps(icons_map(), ensure_ascii=False,
                         sort_keys=True).replace("</", "<\\/")
            + ";")


def icons(markup: str) -> str:
    """Swap every ``<i data-ic="key"></i>`` token for its inline SVG.

    Two silent failure modes lived here and both shipped real bugs
    (2026-08-19):

    * the pattern was ``[a-z]+``, so a key with a digit (``theme2``)
      never matched and the raw token went to the page as an inert
      element;
    * an unknown-but-matching key returned ``""``, so a typo'd or
      never-defined name (``eye``) deleted the icon and nothing
      complained — the button simply had no icon, forever.

    A third one shipped too (found 2026-08-25): a token WRAPPED ACROSS
    TWO LINES — ``<i
  data-ic="return"></i>`` — matched neither the
    substitution nor the old leftover guard, which looked for the same
    single-line shape it had just failed to substitute. It reached the
    page as an inert ``<i>`` and #deck-exit had no icon for as long as
    it existed. The guard below now asks the only question that matters:
    is there ANY element left carrying a data-ic, however it is spelt.

    Rendering happens at build time, so all three are LOUD: any token
    this function cannot resolve stops the build and names the key.
    """
    def sub(m: re.Match) -> str:
        return icon_svg(m.group(1))
    out = re.sub(r'<i data-ic="([a-z][a-z0-9-]*)"></i>', sub, markup)
    leftover = re.search(r'<i\b[^>]*?\bdata-ic\s*=\s*"([^"]*)"', out)
    if leftover:
        raise ValueError(
            "icon token for key \"" + leftover.group(1) + "\" survived "
            "substitution — it must be written EXACTLY "
            "'<i data-ic=\"key\"></i>' on ONE line, with keys "
            "[a-z][a-z0-9-]*. A token split across lines renders as an "
            "inert <i> and the button silently has no icon.")
    return out


LOGO_SVG = (
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


FAVICON = "data:image/svg+xml," + urllib.parse.quote(LOGO_SVG)
