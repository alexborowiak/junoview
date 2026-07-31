"""Provenance: which cell feeds which.

Edges come from explicit ``#| depends:`` directives where the author gave them,
and otherwise from dataflow -- the names a cell binds, matched against the names
later cells read. Prose notes are attached to the chain they discuss by looking
for those same names in the text, which is what lets an interpretation follow
its figure.
"""

from __future__ import annotations

import ast
import re

from .model import Document, Item


def _cell_names(code: str) -> tuple[set[str], set[str]]:
    """Best-effort (defined, externally-read) names for one cell's code.

    A name counts as externally read when the cell uses it at or before its
    own first assignment (so `z = z + 1` reads the earlier z, but
    `x = 1; print(x)` does not read an external x). Function parameters are
    excluded; IPython magic/shell lines are stripped before parsing.
    """
    src = "\n".join(ln for ln in code.splitlines()
                    if not ln.lstrip().startswith(("%", "!")))
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return set(), set()
    first_def: dict[str, int] = {}
    first_use: dict[str, int] = {}
    params: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.arg):
            params.add(node.arg)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef,
                               ast.ClassDef)):
            first_def.setdefault(node.name, node.lineno)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                first_def.setdefault((a.asname or a.name).split(".")[0],
                                     node.lineno)
        elif isinstance(node, ast.AugAssign) and isinstance(node.target,
                                                            ast.Name):
            first_use.setdefault(node.target.id, node.lineno)
        elif isinstance(node, ast.Name):
            if isinstance(node.ctx, ast.Store):
                first_def.setdefault(node.id, node.lineno)
            elif isinstance(node.ctx, ast.Load):
                first_use.setdefault(node.id, node.lineno)
    uses = {n for n, ln in first_use.items()
            if n not in params
            and (n not in first_def or ln <= first_def[n])}
    return set(first_def), uses


def _mentioned_names(note: Item, all_defs: set[str]) -> set[str]:
    """Variable names a markdown note refers to. An inline-code span (`name`)
    is a strong signal at any length. A BARE word only counts when it is
    "code-shaped" -- snake_case or containing a digit (e.g. ridge_index,
    z500) -- so prose like "warm events" or "seasonal cycle" does not match a
    plain-word variable named `warm` / `seasonal`; those need backticks."""
    text = f"{note.title}\n{note.caption}"
    found: set[str] = set()
    for span in re.findall(r"`([^`]+)`", text):        # `name`, `name.attr`…
        m = re.match(r"[A-Za-z_]\w*", span.strip())
        if m and m.group(0) in all_defs:
            found.add(m.group(0))
    for n in all_defs:
        code_shaped = "_" in n or any(c.isdigit() for c in n)
        if code_shaped and len(n) >= 3 \
                and re.search(r"\b" + re.escape(n) + r"\b", text):
            found.add(n)
    return found


def _link_notes_to_chains(doc: Document, cards: list, card_defs: dict,
                          anc_of: dict, items_by_id: dict, order: dict) -> None:
    """Link a markdown note into the code trace of every plot whose lineage
    defines a variable the note names -- so the prose that explains a step
    travels with the code into that plot's trace (and its dependency graph).
    Notes are ignored by the presentation trail (it keeps its hasCode filter),
    so this only enriches the docs 'Plot trace'."""
    all_defs: set[str] = set()
    for d in card_defs.values():
        all_defs |= d
    if not all_defs:
        return
    definers: dict[str, list] = {}
    for _, it in cards:
        for n in card_defs[id(it)]:
            definers.setdefault(n, []).append(it)
    anchor_pos: dict[str, int] = {}
    pos = 0
    for sec in doc.sections:
        for it in sec.items:
            anchor_pos[it.anchor or it.item_id] = pos
            pos += 1
    notes: list[tuple] = []
    for sec in doc.sections:
        for it in sec.items:
            if not it.is_note:
                continue
            names = _mentioned_names(it, all_defs)
            if not names:
                continue
            src_ids = {id(c) for n in names for c in definers.get(n, [])}
            it.chain = [items_by_id[i].anchor or items_by_id[i].item_id
                        for i in sorted(src_ids, key=lambda i: order.get(i, 0))]
            notes.append((it, names))
    if not notes:
        return
    for _, it in cards:
        lineage_names = set(card_defs[id(it)])
        for aid in anc_of[id(it)]:
            lineage_names |= card_defs.get(aid, set())
        extra = [nt for (nt, names) in notes if names & lineage_names]
        if not extra:
            continue
        merged = list(it.chain) + [
            (nt.anchor or nt.item_id) for nt in extra
            if (nt.anchor or nt.item_id) not in it.chain]
        it.chain = sorted(merged, key=lambda a: anchor_pos.get(a, 0))


def _build_chains(doc: Document) -> None:
    """Attach to every card the ordered chain of upstream cards feeding it.

    Edges come from two sources, unioned: automatic variable tracing (the
    card that last assigned each name this card reads) and declared
    `depends:` ids. The transitive closure, in document order, becomes
    `item.chain` -- the full "open data -> transform -> plot" story shown
    under a figure's Show code. A final pass also links markdown notes that
    name a variable into the chains that define it.
    """
    cards: list[tuple[int, Item]] = []
    for sec in doc.sections:
        for it in sec.items:
            if it.is_note or not it.members:
                continue
            cards.append((min(m["idx"] for m in it.members), it))
    cards.sort(key=lambda t: t[0])
    order = {id(it): i for i, (_, it) in enumerate(cards)}
    by_node = {it.node_id: it for _, it in cards if it.node_id}
    items_by_id = {id(it): it for _, it in cards}

    deps: dict[int, set[int]] = {id(it): set() for _, it in cards}
    card_defs: dict[int, set[str]] = {id(it): set() for _, it in cards}
    last: dict[str, Item] = {}          # name -> card that last assigned it
    for _, it in cards:
        for m in sorted(it.members, key=lambda m: m["idx"]):
            defs, uses = _cell_names(m["code"])
            for n in uses:
                src = last.get(n)
                if src is not None and src is not it:
                    deps[id(it)].add(id(src))
            for n in defs:
                last[n] = it
            card_defs[id(it)] |= defs
        for d in it.depends:
            src = by_node.get(d)
            if src is not None and src is not it:
                deps[id(it)].add(id(src))

    def ancestors(iid: int, seen: set[int]) -> None:
        for p in deps.get(iid, ()):
            if p not in seen:
                seen.add(p)
                ancestors(p, seen)

    anc_of: dict[int, set[int]] = {}
    for _, it in cards:
        seen: set[int] = set()
        ancestors(id(it), seen)
        anc_of[id(it)] = seen
        it.chain = [items_by_id[i].anchor or items_by_id[i].item_id
                    for i in sorted(seen, key=lambda i: order.get(i, 0))]

    _link_notes_to_chains(doc, cards, card_defs, anc_of, items_by_id, order)
