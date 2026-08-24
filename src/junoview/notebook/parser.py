"""The front door: an executed notebook in, a :class:`~.model.Document` out.

:func:`parse_notebook` walks the cells once, applying directives where present
and inference where not, folding grouped and stacked cells into single cards,
opening sections on markdown headings, and finally building the provenance
graph. Nothing downstream re-reads the raw notebook.
"""

from __future__ import annotations

# aliased: parse_notebook grew a `render_raw` keyword of the same name
from ..render.items import _card_output_keys
from ..render.items import render_raw as _render_raw
from .chains import _build_chains
from .classify import (
    _UNPARSED,
    _classify_code,
    _csv,
    _infer_kind,
    _parse_cell,
    _plot_title_from_code,
    _slug,
    _title_from_code,
)
from .directives import (
    _DISPLAY_TYPES,
    _lead_heading,
    is_directive_line,
    split_directives,
)
from .model import CodeStep, Document, Item, Section
from .outputs import _as_text, render_outputs
from .presentations import _as_presentations
from .variables import collect_variables


def _finalize_item(item: Item, used_slugs: set[str],
                   cell_by_id: dict[str, dict]) -> None:
    """Resolve a card from its grouped member cells plus any stacked cells."""
    members = sorted(item.members, key=lambda m: (m["order"], m["idx"]))
    multi = len(members) > 1

    def has_img(m):
        # a live embed (plotly/bokeh/…) is a figure face, same as an image
        return any(o.has_image or o.has_interactive for o in m["outputs"])

    # the card's face: the cell that draws the figure (or the last with output)
    primary = next(
        (m for m in members
         if m["d"].get("display", "").lower() in ("figure", "diagnostic")), None)
    if primary is None:
        primary = next((m for m in reversed(members) if has_img(m)), None)
    if primary is None:
        primary = next((m for m in reversed(members) if m["outputs"]), None)
    if primary is None:
        primary = members[-1]

    # this card's own code chunks (from its grouped members)
    own_steps: list[CodeStep] = []
    for m in members:
        d = m["d"]
        label = (d.get("step") or d.get("label")
                 or (d.get("subsection", "") if multi else "")).strip()
        own_steps.append(CodeStep(label=label, code=m["code"],
                                 outputs=m["outputs"], is_primary=(m is primary)))

    # cells pulled in by `stack:` (referenced by id), folded in front
    stack_ids: list[str] = []
    for m in members:
        for sid in _csv(m["d"].get("stack", "")):
            if sid not in stack_ids:
                stack_ids.append(sid)
    own_idx = {m["idx"] for m in members}
    stacked_steps: list[CodeStep] = []
    for sid in stack_ids:
        cm = cell_by_id.get(sid)
        if cm is None or cm["idx"] in own_idx:
            continue
        label = (cm["d"].get("step") or cm["d"].get("label")
                 or cm["d"].get("title") or sid)
        stacked_steps.append(CodeStep(label=label.strip(), code=cm["code"],
                                      outputs=cm["outputs"], is_primary=False))

    item.steps = stacked_steps + own_steps
    item.outputs = primary["outputs"]

    # display kind: first explicit non-code display wins, else infer from face
    display = ""
    for m in members:
        cand = m["d"].get("display", "").lower()
        if cand == "hidden":
            display = "hidden"
            break
        if cand in _DISPLAY_TYPES and cand != "code":
            display = cand
            break
    item.kind = display or _infer_kind(primary["outputs"])

    # give the face a default step label once it shares the fold with others
    if len(item.steps) > 1:
        for s in item.steps:
            if s.is_primary and not s.label:
                s.label = {"figure": "plot", "dataset": "load data",
                           "transform": "transform",
                           "metric": "compute"}.get(item.kind, "")

    explicit = next(
        (m["d"]["title"] for m in members if m["d"].get("title")), "")
    lead = [ln.strip() for ln in primary["code"].splitlines()
            if ln.strip() and not is_directive_line(ln)]
    lead_comment = bool(lead) and lead[0].startswith("#")
    # a figure that titles ITSELF in code — fig.suptitle("…"),
    # ax.set_title("…"), title= — names its card when the author gave
    # neither a `#| title:` nor a leading `#` comment heading: the plot's
    # own name beats a function name or an echoed code line
    plot_title = ""
    ptree = primary.get("tree", _UNPARSED)   # raw ast, cached at parse time
    if item.kind == "figure" or any(
            o.has_image or o.has_interactive
            for m in members for o in m["outputs"]):
        plot_title = _plot_title_from_code(primary["code"], ptree)
    if explicit:
        item.title = explicit
    elif plot_title and not lead_comment:
        item.title = plot_title
    else:
        item.title, item.title_echo = _title_from_code(primary["code"], ptree)
    item.code_kinds = _classify_code(primary["code"], ptree)
    item.code_kind = item.code_kinds[0]
    item.caption = (primary["d"].get("caption")
                    or next((m["d"]["caption"] for m in members
                             if m["d"].get("caption")), ""))
    # an AUTHOR-added label: explicit `#| title:`, a caption, a leading
    # `#` comment heading, or a title written into the plot call itself.
    # A title derived from function names or code lines is bookkeeping,
    # not labelling — the labelled/unlabelled filters key on this.
    item.labelled = bool(explicit or item.caption or lead_comment
                         or plot_title)
    item.node_id = next(
        (m["d"]["id"].strip() for m in members if m["d"].get("id", "").strip()), "")

    member_ids = {m["d"].get("id", "").strip() for m in members}
    depends, seen = [], set()
    for m in members:
        for dep in _csv(m["d"].get("depends", "")):
            if dep not in seen and dep not in member_ids:
                seen.add(dep)
                depends.append(dep)
    item.depends = depends
    item.code_visible = any(
        m["d"].get("code", "").lower() in ("show", "shown", "visible", "true")
        for m in members)
    item.item_id = _slug(item.node_id or item.title or "item", used_slugs)
    cid = primary.get("cell_id", "")
    if item.node_id:
        item.anchor = item.node_id
    elif cid:
        item.anchor = f"cell:{cid}"
    else:
        # No stable identity (no `#| id:`, no nbformat cell id): anchor by
        # POSITION, not the title-derived slug. Editing a figure changes
        # its code-derived title but not its place in the notebook, so a
        # deck frame keeps pointing at it across a refresh.
        item.anchor = f"cell:p{primary.get('idx', 0)}"


def parse_notebook(nb: dict, title: str | None = None,
                   render_raw: bool = True) -> Document:
    """Parse one executed notebook (its JSON dict) into a Document.

    ``render_raw=False`` skips building ``doc.raw_html`` (the linear
    "raw notebook" view) — for structural parses that only need the
    card/section model, like resolving a note-insertion target, where
    the raw view is rendered again by the real parse moments later.
    """
    used_slugs: set[str] = set()
    nb_title = title or nb.get("metadata", {}).get("title")
    # an explicit --title OR a notebook metadata title wins over an H1
    title_locked = nb_title is not None

    doc = Document(title=nb_title or "Untitled analysis")
    sem_meta = nb.get("metadata", {}).get("semantic", {})
    if isinstance(sem_meta, dict):
        doc.presentations = _as_presentations(
            sem_meta.get("presentations") or sem_meta.get("deck"))
    cur_section: Section | None = None
    cur_subsection = ""
    # the synthetic bucket holding content that appears before any heading; a
    # real heading of the same name may later claim it instead of duplicating
    auto_overview: Section | None = None
    group_index: dict[str, Item] = {}
    cell_by_id: dict[str, dict] = {}   # id -> member cell (for `stack:` lookup)
    all_members: list[dict] = []       # every code cell, to find stacked ids

    def ensure_section() -> Section:
        nonlocal cur_section, auto_overview
        if cur_section is None:
            # section slugs live in a "sec " namespace so a heading can never
            # steal a card's title slug (deck refs point at card ids)
            cur_section = Section("Overview",
                                  _slug("sec overview", used_slugs))
            auto_overview = cur_section
            doc.sections.append(cur_section)
        return cur_section

    for idx, cell in enumerate(nb.get("cells", [])):
        ctype = cell.get("cell_type")
        source = _as_text(cell.get("source", ""))

        if ctype == "markdown":
            handled_heading = False
            md_anchor = f"cell:{cell.get('id')}" if cell.get("id") else ""
            stripped = source.strip()
            lead = _lead_heading(source)
            if lead:
                level, text, rest = lead
                if level <= 3:
                    # Every #/##/### heading opens its own REAL section (three
                    # tiers, each collapsible + hideable), in document order.
                    # Markdown headings are POSITIONAL: two headings that share
                    # a title (e.g. a `## Summary` under each model) are two
                    # distinct sections, unlike the declarative `#| section:`
                    # directive which groups by name. The first h1 also names
                    # the document. #### and deeper stay lightweight kicker
                    # labels within their section.
                    if level == 1 and not title_locked:
                        doc.title = text
                        title_locked = True
                    if auto_overview is not None and auto_overview.title == text:
                        # a real heading claims the synthetic pre-heading
                        # "Overview" bucket rather than spawning a twin
                        cur_section = auto_overview
                        cur_section.level = level
                        cur_section.from_heading = True
                    else:
                        cur_section = Section(
                            text, _slug("sec " + text, used_slugs))
                        cur_section.level = level
                        cur_section.from_heading = True
                        doc.sections.append(cur_section)
                    # the claim window closes at the FIRST heading either way:
                    # a later "### Overview" deep in the document must NOT
                    # teleport its content into the preamble bucket
                    auto_overview = None
                    cur_subsection = ""
                    handled_heading = True
                else:  # level >= 4 -> in-section kicker label
                    cur_subsection = text
                    handled_heading = True
                # prose after the heading becomes a note
                if rest:
                    sec = ensure_section()
                    nid = _slug("note", used_slugs)
                    sec.items.append(Item(
                        kind="note", title=text if handled_heading else "Note",
                        caption=rest, is_note=True, subsection=cur_subsection,
                        item_id=nid, anchor=md_anchor or nid))
            else:
                if stripped:
                    sec = ensure_section()
                    nid = _slug("note", used_slugs)
                    sec.items.append(Item(
                        kind="note", title="Note", caption=stripped,
                        is_note=True, subsection=cur_subsection,
                        item_id=nid, anchor=md_anchor or nid))
            continue

        if ctype != "code":
            continue

        directives, code = split_directives(source)
        group_key = (directives.get("group") or directives.get("tag") or "").strip()
        seen_before = bool(group_key) and group_key in group_index

        # only the first cell of a group steers section / subsection context
        if not seen_before:
            if "section" in directives:
                sec_name = directives["section"]
                # group-by-name stays a TIER-2 concept: a positional ###
                # sub-heading that happens to share the name must not
                # capture directive-declared cells
                existing = next(
                    (s for s in doc.sections
                     if s.title == sec_name and s.level <= 2), None)
                if existing is None:
                    cur_section = Section(
                        sec_name, _slug("sec " + sec_name, used_slugs))
                    doc.sections.append(cur_section)
                else:
                    cur_section = existing
                cur_subsection = ""
            if "subsection" in directives:
                cur_subsection = directives["subsection"]

        # keyed by cell position: the SAME rendered fragments serve the cards
        # AND the raw view (see the render_raw call below), and the data-jvout
        # stamp is how a raw-view placeholder finds its card's copy
        outputs = render_outputs(cell.get("outputs", []), key=f"c{idx}")
        try:
            order_val = float(directives.get("order", idx))
        except ValueError:
            order_val = float(idx)
        member = {"d": directives, "code": code, "outputs": outputs,
                  "order": order_val, "idx": idx,
                  "cell_id": str(cell.get("id") or "")}
        # parse the cell's code ONCE, here; classify (title / plot title /
        # code kinds), chains and the variables index all reuse these two
        # trees instead of each running ast.parse again
        member["tree"], member["tree_nomagic"] = _parse_cell(code)
        all_members.append(member)
        cell_id = directives.get("id", "").strip()
        if cell_id:
            cell_by_id.setdefault(cell_id, member)

        if seen_before:
            group_index[group_key].members.append(member)
            continue

        sec = ensure_section()
        item = Item(kind="", title="", subsection=cur_subsection, members=[member])
        sec.items.append(item)
        if group_key:
            group_index[group_key] = item

    # cells named in any `stack:` list are consumed (folded into figures,
    # not shown as their own card)
    consumed_ids: set[str] = set()
    for m in all_members:
        consumed_ids.update(_csv(m["d"].get("stack", "")))

    # resolve every code-derived card from its member cell(s) + stacked cells
    for sec in doc.sections:
        for item in sec.items:
            if not item.is_note and item.members:
                _finalize_item(item, used_slugs, cell_by_id)

    # drop consumed standalone cards, hidden cards, and empty sections
    for sec in doc.sections:
        sec.items = [
            it for it in sec.items
            if (it.is_note or it.kind not in ("", "hidden"))
            and not (it.node_id and it.node_id in consumed_ids)
        ]
    # keep AUTHORED headings even when nothing lands under them (a `#`
    # heading followed straight by another used to vanish entirely)
    doc.sections = [s for s in doc.sections if s.items or s.from_heading]
    # name any unnamed plot "Plot 1", "Plot 2", … (a figure with no explicit
    # title just echoes its first code line — give it a real name instead)
    plot_n = 0
    for s in doc.sections:
        for it in s.items:
            if (it.kind in ("figure", "diagnostic")
                    and (it.title_echo or not it.title.strip())):
                plot_n += 1
                it.title = f"Plot {plot_n}"
                it.title_echo = False
    # outline numbers ("2", "2.1", "2.1.3") make the three section tiers
    # unmistakable in the doc eyebrows. A tier the document NEVER uses is
    # dropped from every number (# + ### with no ## reads "1.1", not
    # "1.0.1"); a tier that exists but hasn't opened yet stays as an
    # honest 0 ("0.1" for a ## before the first #) so two different
    # sections can never share a number.
    present = {max(1, min(3, s.level)) for s in doc.sections}
    counters = [0, 0, 0]
    for s in doc.sections:
        lv = max(1, min(3, s.level))
        counters[lv - 1] += 1
        for i in range(lv, 3):
            counters[i] = 0
        s.number = ".".join(str(counters[i]) for i in range(lv)
                            if (i + 1) in present)
    _build_chains(doc)
    # while the cards still hold their member cells (`members` is
    # build-only): the sidebar's Variables view needs the raw code
    doc.variables = collect_variables(doc)
    if render_raw:
        # the raw view REUSES this parse's rendered outputs (no second
        # render_outputs pass over multi-MB figures), and any output whose
        # payload a card already embeds becomes a lightweight placeholder
        # that app.js fills by cloning the card's node on first open
        doc.raw_html = _render_raw(
            nb,
            outputs_by_idx={m["idx"]: m["outputs"] for m in all_members},
            card_keys=_card_output_keys(doc))
    return doc
