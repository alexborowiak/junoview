"""The provenance graph, laid out as SVG.

A layered top-down drawing sized to fit the narrow sidebar rail, so the shape of
an analysis is visible without leaving the page.
"""

from __future__ import annotations

import html

from ..notebook.model import Document

_NODE_FILL = {
    "dataset": "#2f6f9e",
    "transform": "#3b5566",
    "diagnostic": "#2f9bb0",
    "figure": "#2f9bb0",
    "metric": "#2c8c7d",
    "text": "#7a6a52",
    "code": "#4a5564",
}


def build_graph_svg(doc: Document, width: int = 268) -> str:
    """Return an SVG node-link diagram of items that declared an `id`."""
    nodes = [it for s in doc.sections for it in s.items if it.node_id]
    if len(nodes) < 2:
        return ""

    id_to_item = {it.node_id: it for it in nodes}
    # edges (dep -> item), ignoring references to unknown ids
    edges = [(d, it.node_id) for it in nodes for d in it.depends if d in id_to_item]

    # longest-path depth via memoised DFS over reverse edges
    parents: dict[str, list[str]] = {nid: [] for nid in id_to_item}
    for a, b in edges:
        parents[b].append(a)
    depth_cache: dict[str, int] = {}

    def depth(nid: str, stack: frozenset = frozenset()) -> int:
        if nid in depth_cache:
            return depth_cache[nid]
        if nid in stack or not parents[nid]:
            depth_cache[nid] = 0
            return 0
        d = 1 + max(depth(p, stack | {nid}) for p in parents[nid])
        depth_cache[nid] = d
        return d

    order = [it.node_id for it in nodes]  # document order
    layers: dict[int, list[str]] = {}
    for nid in order:
        layers.setdefault(depth(nid), []).append(nid)

    row_h, pad_top, pad_x = 64, 26, 16
    nh = 30
    max_depth = max(layers)
    height = pad_top * 2 + max_depth * row_h + nh
    pos: dict[str, tuple[float, float]] = {}
    for d, ids in layers.items():
        n = len(ids)
        usable = width - 2 * pad_x
        for i, nid in enumerate(ids):
            cx = pad_x + (usable * (i + 0.5) / n)
            # float so it matches what `pos` stores and what reading it back
            # out below produces; every use formats with :.1f either way
            cy = float(pad_top + d * row_h)
            pos[nid] = (cx, cy)

    parts: list[str] = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" '
        f'height="{height}" class="provsvg" role="img" '
        f'aria-label="Analysis provenance graph">']

    # edges first (under nodes), amber lineage curves
    for a, b in edges:
        ax, ay = pos[a]
        bx, by = pos[b]
        midy = (ay + nh / 2 + by - nh / 2) / 2
        parts.append(
            f'<path class="provedge" '
            f'd="M {ax:.1f} {ay + nh/2:.1f} '
            f'C {ax:.1f} {midy:.1f} {bx:.1f} {midy:.1f} '
            f'{bx:.1f} {by - nh/2:.1f}" '
            f'data-from="{a}" data-to="{b}"/>')

    # nodes
    for nid, it in id_to_item.items():
        cx, cy = pos[nid]
        fill = _NODE_FILL.get(it.kind, "#4a5564")
        label = it.node_id if len(it.node_id) <= 13 else it.node_id[:12] + "\u2026"
        bw = max(58, min(width - 2 * pad_x, len(label) * 7.2 + 16))
        x = cx - bw / 2
        y = cy - nh / 2
        parts.append(
            f'<g class="provnode" data-node="{it.node_id}" '
            f'data-target="{it.item_id}" tabindex="0" '
            f'role="button" aria-label="Go to {html.escape(it.title)}">'
            f'<rect x="{x:.1f}" y="{y:.1f}" rx="5" width="{bw:.1f}" '
            f'height="{nh}" fill="{fill}"/>'
            f'<text x="{cx:.1f}" y="{cy + 4:.1f}" text-anchor="middle">'
            f'{html.escape(label)}</text></g>')

    parts.append("</svg>")
    return "".join(parts)
