"""The ``junoview`` command line.

With no arguments it launches the local app; with notebook paths it exports a
static page. See ``junoview --help``.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ._write import write_text
from .notebook.loader import (
    doc_from_url,
    is_url,
    load_doc,
    stem_for,
)
from .notebook.presentations import (
    as_presentations,
    deck_json,
    embed_deck,
)
from .render.page import render_page
from .server.app import run_app
from .web import build_web


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Semantic notebook environment: run with no arguments "
        "to launch the local GUI app (open .ipynb files as tabs), or pass "
        "notebook path(s) to export a static HTML page.")
    p.add_argument("notebooks", nargs="*",
                   help="path(s) to executed .ipynb notebooks; several "
                   "render as tabs in one page")
    p.add_argument("-o", "--output",
                   help="output .html (default: alongside the notebook, or "
                   "semantic_view.html for a multi-notebook bundle)")
    p.add_argument("--title", help="override the analysis title "
                   "(single-notebook export only)")
    p.add_argument("--deck", help="presentation deck JSON to use "
                   "(default: <notebook>.deck.json sidecar, then embedded "
                   "metadata)")
    p.add_argument("--embed-deck", metavar="DECK_JSON",
                   help="write DECK_JSON into the notebook's "
                   "metadata.semantic.presentations (modifies the .ipynb) "
                   "and exit")
    p.add_argument("--app", action="store_true",
                   help="launch the local GUI app (implied when no "
                   "notebooks are given); listed notebooks preload as tabs")
    p.add_argument("--root", help="app mode: folder for the file browser "
                   "and semantic_project.json (default: the first "
                   "notebook's folder, else the current folder)")
    p.add_argument("--port", type=int, default=8765,
                   help="app mode: port to serve on (default 8765; falls "
                   "back to a free port when busy)")
    p.add_argument("--no-browser", action="store_true",
                   help="app mode: don't auto-open the browser")
    p.add_argument("--build-web", metavar="DIR",
                   help="write the deployable client-side web app "
                   "(index.html + this module, runs Python in the "
                   "browser via Pyodide) into DIR and exit")
    p.add_argument("--self-test", action="store_true",
                   help="run a built-in sanity check and exit")
    args = p.parse_args(argv)

    if args.self_test:
        from ._smoke import self_test
        return self_test()

    if args.build_web:
        build_web(Path(args.build_web))
        print(f"wrote web app to {args.build_web}\\index.html")
        print("Deploy: commit that folder and enable GitHub Pages for "
              "it (or drop it on any static host).")
        return 0

    items = list(args.notebooks)
    local = [Path(n) for n in items if not is_url(n)]

    if args.embed_deck:
        if len(items) != 1 or not local:
            p.error("--embed-deck needs exactly one local notebook")
        if not local[0].exists():
            print(f"error: {local[0]} not found", file=sys.stderr)
            return 1
        # a bad deck file used to raise SystemExit from inside the loader;
        # it is a ValueError now (the server needs it catchable), so the
        # CLI prints the same one-line error itself (2026-08-23)
        try:
            embed_deck(local[0], Path(args.embed_deck))
        except ValueError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        print(f"embedded {args.embed_deck} into {local[0]} "
              "(metadata.semantic.presentations)")
        return 0

    if args.app or not items:
        root = Path(args.root) if args.root else \
            (local[0].parent if local else Path.cwd())
        if not root.is_dir():
            p.error(f"--root {root} is not a folder")
        preload = [n if is_url(n) else Path(n) for n in items]
        return run_app(root, preload, port=args.port,
                       open_browser=not args.no_browser)

    missing = [f for f in local if not f.exists()]
    for m in missing:
        print(f"error: {m} not found", file=sys.stderr)
    if missing:
        return 1

    deck = Path(args.deck) if args.deck else None
    single = len(items) == 1
    if not single and args.title:
        print("note: --title is ignored for multi-notebook bundles",
              file=sys.stderr)
    docs = []
    taken: set[str] = set()
    # every --deck read goes through deck_json, so the polyglot
    # name.junoview.html save works on all three branches, not just the
    # sidecar path inside load_doc (it parsed with raw json.loads on two
    # of them until 2026-08-23). And since the loader now raises
    # ValueError instead of SystemExit, the CLI prints the same one-line
    # "error: ..." itself and exits 1.
    try:
        for n in items:
            if is_url(n):
                doc = doc_from_url(n)
                if single and args.title:
                    doc.title = args.title
                if single and deck is not None:
                    pres = as_presentations(
                        deck_json(deck.read_text(encoding="utf-8")))
                    if pres:
                        doc.presentations = pres
                doc.source_name = stem_for(
                    Path(doc.source_name + ".ipynb"), taken)
            else:
                doc = load_doc(Path(n),
                               title=args.title if single else None,
                               deck_path=deck if single else None)
                doc.source_name = stem_for(Path(n), taken)
            taken.add(doc.source_name)
            docs.append(doc)
        cfg = {}
        if not single and deck is not None:
            cfg["presentations"] = as_presentations(
                deck_json(deck.read_text(encoding="utf-8")))
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    html_out = render_page(docs, app_cfg=cfg)
    if args.output:
        out_path = Path(args.output)
    elif single and not is_url(items[0]):
        out_path = Path(items[0]).with_suffix(".html")
    elif single:
        out_path = Path(docs[0].source_name + ".html")
    else:
        out_path = (local[0].parent if local else Path.cwd()) \
            / "semantic_view.html"
    write_text(out_path, html_out)
    print(f"wrote {out_path}  ({len(html_out)//1024} KB)")
    return 0
