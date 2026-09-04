"""Cards, navigation and the raw view: a Document rendered to HTML fragments.

Each :class:`~junoview.notebook.model.Item` becomes a card -- headline output on
top, folded code beneath, caption below. This module produces fragments only;
:mod:`junoview.render.page` assembles them into a page.
"""

from __future__ import annotations

import html
import json

# card chrome calls the icon helper DIRECTLY (rather than emitting
# <i data-ic> tokens) so these fragments are finished markup on every
# path that serves them — the full page, the server's shell JSON, the
# Pyodide bridge and the widget — with branding.py still the single
# source of the artwork (see the icon-set comment there)
from ..branding import icon_svg as _ic
from ..notebook.model import Document, Item
from ..notebook.outputs import as_text, render_outputs
from .graph import build_graph_svg
from .highlight import highlight_python
from .markdown import _MD_HTMLBLOCK_RE, _md_with_headings, md_to_html

_BADGE = {
    "figure": "figure", "dataset": "dataset", "transform": "transform",
    "diagnostic": "diagnostic", "metric": "print", "text": "print",
    "note": "markdown", "code": "code",
}


def _kind_class(kind: str) -> str:
    return {
        "figure": "k-figure", "diagnostic": "k-figure", "dataset": "k-dataset",
        "transform": "k-transform", "metric": "k-metric", "text": "k-print",
        "note": "k-note", "code": "k-code",
    }.get(kind, "k-code")


def _fig_pager(imgs) -> str:
    """Several figures from one cell: a pager, one figure at a time."""
    pages = "".join(
        f'<div class="figpage{" current" if i == 0 else ""}">{o.payload}'
        f'</div>' for i, o in enumerate(imgs))
    return (
        f'<div class="figpager" data-n="{len(imgs)}">{pages}'
        f'<div class="figpager-nav">'
        f'<button class="fp-btn fp-prev" title="Previous figure">'
        f'&#8249;</button>'
        f'<span class="fp-count">1 / {len(imgs)}</span>'
        f'<button class="fp-btn fp-next" title="Next figure">'
        f'&#8250;</button></div></div>')


def render_item(item: Item, sec_id: str = "") -> str:
    badge = _BADGE.get(item.kind, item.kind)
    kclass = _kind_class(item.kind)
    # a card's FILTER ROLE (what top-bar filter governs it) — distinct from
    # its output kind. Printed results (dataset/metric/text) are OUTPUT, not
    # code; only cells that are purely source are "code".
    if item.is_note:
        role = "markdown"
    elif item.kind in ("figure", "diagnostic"):
        role = "plot"
    elif item.kind == "code":
        role = "code"
    else:
        role = "output"
    ck_attr = ""
    # EVERY code-bearing cell (anything the Code filter governs — not a figure,
    # not a markdown note) carries data-ck so the advanced type filter can
    # reach it, INCLUDING plain "code". Unchecking every type then equals
    # Hide code. A strong type (imports/function/data/plotting/…) also labels
    # the cell and recolours its badge; plain "code" keeps the default look.
    if item.kind not in ("figure", "diagnostic") and not item.is_note:
        ck_attr = f' data-ck="{" ".join(item.code_kinds)}"'
        if item.code_kinds != ["code"]:
            badge = " · ".join(item.code_kinds[:3])
            kclass += f" ckmain-{item.code_kind}"
            kclass += "".join(f" ck-{c}" for c in item.code_kinds)
    # a cell's output splits into a PLOT part (figures — static images AND
    # live embeds like plotly/bokeh/vega/folium) and an OUTPUT part (printed
    # results) so the Plots and Output filters can act on them independently
    # of each other and of the cell's Code
    # NOTE which outputs this function embeds (the face below, plus multi-
    # step extra_out further down) is mirrored by card_output_keys() for
    # the raw view's placeholders — change one, change both
    imgs = [o for o in item.outputs if o.has_image or o.has_interactive]
    others = [o for o in item.outputs
              if not (o.has_image or o.has_interactive)]
    fig_html = (_fig_pager(imgs) if len(imgs) > 1
                else "".join(o.payload for o in imgs))
    cb_parts = []
    if fig_html:
        # the zoom controls widen the whole CARD, so its border and header
        # grow with the figure instead of the plot spilling out of them
        kclass += " has-fig"
        pt_types: list[str] = []
        for o in imgs:
            if o.pt and o.pt not in pt_types:
                pt_types.append(o.pt)
        pt_attr = f' data-pt="{" ".join(pt_types)}"' if pt_types else ""
        cb_parts.append(
            f'<div class="cb-part cb-fig"{pt_attr}>'
            f'<div class="figzoom" aria-hidden="false">'
            f'<button class="fz-btn fz-out" title="Smaller (this figure)"'
            f'>&#8722;</button>'
            f'<button class="fz-btn fz-in" title="Bigger (this figure)"'
            f'>&#43;</button>'
            f'<button class="fz-btn fz-max" '
            f'title="Expand this figure full screen">{_ic("expand")}</button>'
            f'</div>{fig_html}</div>')
    if others:
        ot_types: list[str] = []
        for o in others:
            if o.ot not in ot_types:
                ot_types.append(o.ot)
        cb_parts.append(
            f'<div class="cb-part cb-out" data-ot="{" ".join(ot_types)}">'
            + "".join(o.payload for o in others) + "</div>")
        if role == "output":
            # the badge speaks the Output-types filter's language — a
            # defaultdict repr reads "dict", not a generic "print" (which
            # the Print checkbox then doesn't hide)
            badge = ot_types[0]
    out_html = "".join(cb_parts)

    # code: one or more labelled steps folded behind a single toggle
    code_block = ""
    steps = [s for s in item.steps if s.code.strip()]
    if steps and not item.is_note:
        multi = len(steps) > 1
        chunks = []
        for i, s in enumerate(steps, 1):
            label_html = ""
            if multi:
                lbl = html.escape(s.label)
                label_html = (
                    f'<div class="codestep-h"><span class="stepnum">{i}</span>'
                    f'<span class="steplabel">{lbl}</span></div>')
            extra_out = ""
            if multi and not s.is_primary and s.outputs:
                extra_out = ('<div class="codestep-out">'
                             + "".join(o.payload for o in s.outputs) + "</div>")
            chunks.append(
                f'<div class="codestep">{label_html}'
                f'<pre class="code"><code>{highlight_python(s.code)}</code></pre>'
                f"{extra_out}</div>")
        steps_count = (f'<span class="ct-steps">\u00b7 {len(steps)} steps</span>'
                       if multi else "")
        # a card with no output face IS its code: expanded, no toggle
        bare = not item.outputs
        is_open = item.code_visible or bare
        open_attr = " data-open='1'" if is_open else ""
        code_block = (
            f'<div class="codewrap{" bare" if bare else ""}"{open_attr}>'
            f'<button class="codetoggle" aria-expanded='
            f'"{"true" if is_open else "false"}">'
            f'<span class="chev">\u203a</span>'
            f'<span class="ct-show">Show code</span>'
            f'<span class="ct-hide">Hide code</span>{steps_count}</button>'
            f'<div class="codebody"><div class="codeinner">'
            f'{"".join(chunks)}</div></div></div>')

    caption = ""
    if item.caption:
        cap_html = html.escape(item.caption).replace("\n", "<br>")
        caption = f'<p class="caption">{cap_html}</p>'

    prov = ""
    if item.depends:
        chips = "".join(
            f'<a class="depchip" href="#" data-dep="{html.escape(d)}">{html.escape(d)}</a>'
            for d in item.depends)
        prov = f'<div class="prov"><span class="prov-l">derives from</span>{chips}</div>'

    id_tag = ""
    if item.node_id:
        id_tag = f'<span class="nodeid">{html.escape(item.node_id)}</span>'

    # figures get a "Plot trace" button -> opens a new tab: the docs view
    # subset to this plot's lineage cells + a dependency graph
    trace_btn = ""
    if item.kind in ("figure", "diagnostic"):
        trace_btn = (
            f'<button class="plot-trace-btn" type="button" '
            f'data-trace="{html.escape(item.anchor or item.item_id)}" '
            f'title="See every cell that builds this plot — as a code trace '
            f'and a dependency graph">{_ic("tree")} Plot trace</button>')

    body = out_html
    htmlsrc = ""
    if item.is_note:
        body = f'<div class="note">{md_to_html(item.caption)}</div>'
        # a note with no real heading gets NO title row — the amber edge
        # says "markdown" on hover instead of a generic MARKDOWN · Note
        if item.title.strip().lower() == "note":
            kclass += " note-untitled"
        # notes containing raw HTML render it, with a source toggle.
        # kept OUTSIDE .cardbody so a long-note clamp can't clip it.
        if _MD_HTMLBLOCK_RE.search(item.caption):
            htmlsrc = (
                '<pre class="note-src code"><code>'
                f'{html.escape(item.caption)}</code></pre>'
                '<button class="htmltoggle" '
                'title="Toggle this note between rendered and raw HTML">'
                '<span class="ht-show">&lt;/&gt;</span>'
                f'<span class="ht-hide">{_ic("exit")} raw</span></button>')
        caption = ""

    # the card carries its OWN section id: per-section filters must survive
    # being cloned out of the document (tree view, plot-trace tab), where a
    # DOM-ancestor lookup would find no section and silently fall back to
    # the notebook default
    # data-labelled: the titled/untitled filters (Plot-types AND
    # Code-types menus) read this — 1 when the author gave the cell a
    # title/caption, 0 for auto-derived names only
    return (
        f'<article class="card {kclass}" id="card-{item.item_id}" '
        f'data-kind="{item.kind}" data-role="{role}" '
        f'data-node="{item.node_id}"{ck_attr} '
        f'data-secid="{html.escape(sec_id)}" '
        f'data-note="{"1" if item.is_note else "0"}" '
        f'data-labelled="{1 if item.labelled else 0}" '
        f'data-anchor="{html.escape(item.anchor or item.item_id)}" tabindex="-1">'
        f'<header class="cardhead">'
        f'<span class="badge">{badge}</span>'
        f'<h3 class="cardtitle{" echo" if item.title_echo else ""}">'
        f'{html.escape(item.title)}</h3>'
        f'{id_tag}{trace_btn}'
        # T242: the two MARKS a cell can carry. Pin means the filters
        # cannot reach it -- "I have one cell that has output I want
        # but I do not want the rest" -- and the mark is a bookmark,
        # listed at the top of the sidebar so you can get back to it.
        f'<button class="cell-pin" type="button" aria-pressed="false" '
        f'title="Pin this cell: the filters cannot hide it, whatever '
        f'they are set to" aria-label="Pin this cell">{_ic("pin")}</button>'
        f'<button class="cell-mark" type="button" data-mark="" '
        f'title="Mark this cell so you can find it again. Clicks cycle: '
        f'star, heart, flag, none" '
        f'aria-label="Mark this cell">{_ic("star")}</button>'
        f'<button class="cell-eye" type="button" '
        f'title="Hide this cell (it stays in the sidebar so you can bring '
        f'it back)" aria-label="Hide this cell">{_ic("eye")}</button>'
        f'</header>'
        f'<div class="cardbody">{body}</div>'
        f'{htmlsrc}{caption}{prov}{code_block}</article>')


def render_nav(doc: Document) -> str:
    parts = ['<nav class="nav" aria-label="Analysis sections">',
             # T242: what you pinned and what you marked, above the
             # sections -- filled by app.js, hidden while it is empty
             '<div class="navmarks" hidden></div>']
    # key: one entry per item kind (incl. code subtypes) present, GROUPED
    # (markdown | plots | code | output) with a divider between groups — so the
    # two "print" dots (a CODE cell that prints vs a printed VALUE) read apart.
    # Shown at the TOP of the sidebar.
    labels = {"k-figure": "figure", "k-dataset": "dataset",
              "k-transform": "transform", "k-metric": "print",
              "k-note": "markdown", "k-print": "print", "k-code": "code",
              "ckmain-imports": "imports", "ckmain-function": "function",
              "ckmain-data": "data", "ckmain-constant": "constant",
              "ckmain-settings": "settings", "ckmain-plotting": "plotting",
              "ckmain-print": "print"}

    def _key_group(kc: str) -> str:
        if kc == "k-note":
            return "markdown"
        if kc == "k-figure":
            return "plots"
        if kc in ("k-dataset", "k-print", "k-metric"):
            return "output"
        return "code"        # ckmain-* + k-code + k-transform

    seen: list[str] = []
    for s in doc.sections:
        for it in s.items:
            kc = (f"ckmain-{it.code_kind}"
                  if it.kind not in ("figure", "diagnostic")
                  and it.code_kinds != ["code"] else _kind_class(it.kind))
            if kc not in seen:
                seen.append(kc)
    if seen:
        parts.append('<div class="navkey"><span class="navkey-h">key</span>')
        first = True
        for grp in ("markdown", "plots", "code", "output"):
            kcs = [kc for kc in seen if _key_group(kc) == grp]
            if not kcs:
                continue
            if not first:
                parts.append('<span class="navkey-div" aria-hidden="true">'
                             '</span>')
            first = False
            shown: set[str] = set()   # one dot per label within a group
            for kc in kcs:
                lab = labels.get(kc, kc)
                if lab in shown:       # e.g. k-metric + k-print both "print"
                    continue
                shown.add(lab)
                parts.append(f'<span class="nk {kc}"><span class="dot">'
                             f'</span>{lab}</span>')
        parts.append('</div>')
    figs_own = [sum(1 for it in s.items
                    if it.kind in ("figure", "diagnostic"))
                for s in doc.sections]
    for si, s in enumerate(doc.sections):
        # the badge counts the whole SUBTREE (deeper tiers that follow), so
        # a collapsed parent still advertises the figures inside it
        figs = figs_own[si]
        for sj in range(si + 1, len(doc.sections)):
            if doc.sections[sj].level <= s.level:
                break
            figs += figs_own[sj]
        parts.append(
            f'<div class="navsec-row navsec-l{s.level}" '
            f'data-sec="{s.section_id}" data-level="{s.level}">'
            f'<button class="navsec-chev" aria-expanded="true" '
            f'title="Collapse this section">▾</button>'
            f'<a class="navsec" href="#sec-{s.section_id}" '
            f'data-sec="{s.section_id}">'
            f'<span class="navsec-t">{html.escape(s.title)}</span>'
            f'<span class="navsec-c">{figs or ""}</span></a>'
            f'<span class="navsec-eye" role="button" tabindex="0" '
            f'title="Hide or show just this heading" '
            f'aria-label="Hide or show just this heading">{_ic("eye")}</span>'
            f'<span class="navsec-hideall" role="button" tabindex="0" '
            f'title="Hide or show this whole section" '
            f'aria-label="Hide or show this whole section">{_ic("menu")}</span>'
            f'</div>')
        parts.append(f'<div class="navitems navitems-l{s.level}" '
                     f'data-sec="{s.section_id}">')
        last_sub = None
        for it in s.items:
            if it.subsection and it.subsection != last_sub:
                parts.append(
                    f'<div class="navsub">{html.escape(it.subsection)}</div>')
                last_sub = it.subsection
            dot = _kind_class(it.kind)
            if (it.kind not in ("figure", "diagnostic")
                    and it.code_kinds != ["code"]):
                dot += f" ckmain-{it.code_kind}"
            parts.append(
                f'<a class="navitem {dot}" href="#card-{it.item_id}" '
                f'data-item="{it.item_id}">'
                f'<span class="dot"></span>'
                f'<span class="navitem-t">{html.escape(it.title)}</span>'
                f'<span class="navitem-eye" role="button" tabindex="0" '
                f'title="Hide or show this cell" '
                f'aria-label="Hide or show this cell">{_ic("eye")}</span></a>')
        parts.append('</div>')
    parts.append('</nav>')
    return "".join(parts)


def render_railtabs(doc: Document) -> str:
    """Gone (2026-08-19): the sidebar is the SECTIONS list, full stop.
    Variables open as a floating pane from the button beside the sections
    hamburger, so a tab switch that hid one list to show the other had
    nothing left to switch (user: "put it with the hamburger that has the
    sections, and remove the variables button from the section thing").
    Kept as an empty-string renderer so the shell template keeps one
    placeholder shape across versions."""
    return ""


def render_varpanel(doc: Document) -> str:
    """The sidebar's Variables view: every top-level name the notebook
    binds, in definition order. Each row jumps to the defining card and
    unfolds into the full list of cards that define, redefine and read the
    name. The order | type toggle and the filter box are wired in JS, which
    regroups these same rows rather than re-rendering them."""
    if not doc.variables:
        return ""
    rows: list[str] = []
    for i, v in enumerate(doc.variables):
        d = v.def_site
        def_id = d.item_id if d else ""
        sites = "".join(
            f'<a class="var-use" href="#card-{html.escape(s.item_id)}" '
            f'title="Jump to this cell">'
            f'<span class="vu-tag vu-{s.role}">{s.role}</span>'
            f'<span class="vu-t">{html.escape(s.title)}</span></a>'
            for s in v.sites)
        n = v.n_used
        count_tip = (f"read in {n} later cell{'s' if n != 1 else ''}"
                     if n else "never read after its definition")
        rows.append(
            f'<div class="varrow" data-i="{i}" '
            f'data-group="{html.escape(v.group)}" '
            f'data-name="{html.escape(v.name.lower())}">'
            f'<div class="var-line">'
            f'<button class="var-chev" aria-expanded="false" '
            f'title="Show every cell that defines or uses this variable">'
            f'›</button>'
            f'<a class="var-name" href="#card-{html.escape(def_id)}" '
            f'title="Jump to where {html.escape(v.name)} is defined">'
            f'{html.escape(v.name)}</a>'
            f'<span class="var-type vg-{html.escape(v.group)}" '
            f'title="{html.escape(v.type_label)}">'
            f'{html.escape(v.type_label)}</span>'
            f'<span class="var-count" title="{count_tip}">{n or ""}</span>'
            f'</div>'
            f'<div class="var-uses" hidden>{sites}</div></div>')
    return (
        '<div class="varpanel" hidden>'
        '<div class="var-controls">'
        '<input class="var-filter" type="search" placeholder="filter" '
        'aria-label="Filter variables by name">'
        '<div class="var-order" role="group" aria-label="Arrange variables">'
        '<button class="varord-btn active" data-vorder="order" '
        'title="In the order they are first defined">order</button>'
        '<button class="varord-btn" data-vorder="type" '
        'title="Grouped by what they are">type</button>'
        '</div></div>'
        f'<div class="varlist">{"".join(rows)}</div>'
        '<div class="var-empty" hidden>No variables match.</div></div>')


def render_sections(doc: Document) -> str:
    """The stage content: every section with its cards. Reused by the widget."""
    sections_html: list[str] = []
    for s in doc.sections:
        sid = s.section_id
        cards = "".join(render_item(it, sid) for it in s.items)
        eyebrow = f'section {s.number}' if s.number else 'section'
        sections_html.append(
            f'<section class="section sec-l{s.level}" id="sec-{sid}" '
            f'data-sec="{sid}" data-level="{s.level}">'
            f'<div class="sectionhead sectionhead-l{s.level}">'
            f'<button class="sec-chev" data-sec="{sid}" aria-expanded="true" '
            f'title="Collapse / expand this section">&#9662;</button>'
            f'<div class="sectionhead-txt">'
            f'<span class="eyebrow">{eyebrow}</span>'
            f'<h2>{html.escape(s.title)}</h2></div>'
            f'<button class="sec-eye" data-sec="{sid}" '
            f'title="Hide just this heading (the cards below stay)" '
            f'aria-label="Hide just this heading">{_ic("eye")}</button>'
            f'<button class="sec-hideall" data-sec="{sid}" '
            f'title="Hide this whole section — the heading and every card '
            f'in it (restore it from the sidebar)" '
            f'aria-label="Hide this whole section">hide section</button>'
            f'</div>{cards}</section>')
    return "".join(sections_html)


def doc_meta(doc: Document) -> str:
    n_fig = sum(1 for s in doc.sections for it in s.items
                if it.kind in ("figure", "diagnostic"))
    n_data = sum(1 for s in doc.sections for it in s.items if it.kind == "dataset")
    return (f"{n_fig} figures \u00b7 {n_data} datasets "
            f"\u00b7 {len(doc.sections)} sections")


def deck_payload(doc: Document) -> str:
    """JSON blob embedded in the page: the card index + any saved deck.

    Slide payloads are NOT duplicated here -- the deck JS clones card DOM
    nodes (figures, notes, code) already present on the page.
    """
    items = []
    for s in doc.sections:
        for it in s.items:
            items.append({
                "anchor": it.anchor or it.item_id,
                "card": it.item_id,
                "title": it.title,
                "kind": "note" if it.is_note else it.kind,
                "codeKind": it.code_kind,
                "codeKinds": it.code_kinds,
                "section": s.section_id,
                "sectitle": s.title,
                "secnum": s.number,
                "subsection": it.subsection or "",
                "hasCode": any(st.code.strip() for st in it.steps),
                "chain": it.chain,
            })
    payload = {
        "title": doc.title,
        "meta": doc_meta(doc),
        "stem": doc.source_name,
        "sections": [{"id": s.section_id, "title": s.title}
                     for s in doc.sections],
        "items": items,
        "presentations": doc.presentations,
    }
    # "</" would terminate the inline <script> block early
    return json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")


def render_graph_panel(doc: Document) -> str:
    graph_svg = build_graph_svg(doc)
    if not graph_svg:
        return ""
    return (
        '<div class="railgraph">'
        '<div class="railgraph-h"><span class="eyebrow">analysis graph</span>'
        '<button class="rg-collapse" aria-expanded="true" '
        'title="Collapse graph">\u2013</button></div>'
        f'<div class="railgraph-b">{graph_svg}</div></div>')


def card_output_keys(doc: Document) -> set[str]:
    """The ``RenderedOutput.key``s whose payloads the cards page embeds.

    KEEP IN SYNC with :func:`render_item` — this predicts, from the final
    Document, exactly which outputs that function will emit, so the raw view
    can replace their second copy with a placeholder (and MUST embed
    everything else in full: the raw view's contract is "the whole notebook,
    faithfully"). The decision table:

    EMITTED by the cards (raw view may placeholder):
      - every output of a surviving card's face (``item.outputs`` — the
        primary member's outputs: figures, printed results, stream and
        error output alike);
      - outputs of a NON-primary step (a grouped member, or a cell folded
        in by ``stack:``) when the card shows a multi-step code fold —
        i.e. at least TWO steps with non-empty code.

    DROPPED by the cards (raw view keeps the full payload):
      - every output of a ``display: hidden`` cell (its card is dropped);
      - outputs of a non-primary step whose code is empty after directive
        stripping (the code fold filters on ``s.code.strip()``);
      - outputs of the only non-empty step's siblings when the fold ends up
        single-step (``extra_out`` requires ``multi``);
      - outputs of a ``stack:``-consumed cell whose consuming card falls
        under any rule above.

    Markdown cells have no rendered outputs; the raw view renders its own
    markdown (headings kept as headings) either way.
    """
    keys: set[str] = set()
    for sec in doc.sections:
        for it in sec.items:
            if it.is_note:
                continue
            for o in it.outputs:
                if o.key:
                    keys.add(o.key)
            steps = [s for s in it.steps if s.code.strip()]
            if len(steps) > 1:
                for s in steps:
                    if not s.is_primary:
                        for o in s.outputs:
                            if o.key:
                                keys.add(o.key)
    return keys


def render_raw(nb: dict, outputs_by_idx: dict[int, list] | None = None,
               card_keys: set[str] | None = None) -> str:
    """Linear rendering of the notebook exactly as authored: every cell in
    order, code with its `#|` directives visible, outputs underneath.

    This is the transparency view -- it shows where the semantic page's
    titles, captions and sections come from.

    ``outputs_by_idx`` (cell index -> the parse's already-rendered outputs)
    lets :func:`~junoview.notebook.parser.parse_notebook` share ONE
    render_outputs pass between the cards and this view. ``card_keys`` (from
    :func:`card_output_keys`) marks the outputs whose full payload a card
    already embeds: those become empty ``.rawph`` placeholders here — one
    copy of each multi-MB figure per page, not two — which app.js fills by
    cloning the card's node when the raw view is first opened. Every output
    NOT in ``card_keys`` is still embedded in full. Called bare
    (``render_raw(nb)``) it renders everything itself, self-contained.

    The code is re-highlighted here on purpose: the cards highlight the
    source with its ``#|`` directive lines stripped, and this view's whole
    point is showing them.
    """
    parts: list[str] = []
    for idx, cell in enumerate(nb.get("cells", [])):
        ctype = cell.get("cell_type")
        source = as_text(cell.get("source", ""))
        if ctype == "markdown":
            parts.append(
                '<div class="rawcell md"><span class="rawtag">markdown</span>'
                f'<div class="rawmd">{_md_with_headings(source)}</div></div>')
        elif ctype == "code":
            n = cell.get("execution_count")
            label = f"In [{n if n is not None else ' '}]"
            if outputs_by_idx is not None and idx in outputs_by_idx:
                rendered = outputs_by_idx[idx]
            else:
                rendered = render_outputs(cell.get("outputs", []))
            outs = "".join(
                f'<div class="rawph" data-jvout="{o.key}"></div>'
                if card_keys and o.key and o.key in card_keys
                else o.payload
                for o in rendered)
            out_html = f'<div class="rawout">{outs}</div>' if outs else ""
            parts.append(
                f'<div class="rawcell code"><span class="rawtag">{label}'
                '</span><pre class="code"><code>'
                f'{highlight_python(source)}</code></pre>{out_html}</div>')
    return "".join(parts) or '<p class="rawempty">Empty notebook.</p>'
