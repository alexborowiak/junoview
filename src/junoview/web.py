"""The client-side build: the same tool as a static site, no server.

Python runs in the visitor's browser through Pyodide, so notebooks never leave
their machine and the result is safe to host anywhere. :func:`build_web` writes
a directory that can be committed straight to GitHub Pages.

How the package reaches the browser
-----------------------------------
Junoview used to be one module, and the loader simply fetched
``semantic_render.py`` and imported it. A package cannot ship that way, so
:func:`build_web` writes ``junoview.zip`` and the loader hands it to Pyodide's
``unpackArchive``. Both ``import`` and :mod:`importlib.resources` work from a
zip, so the CSS/JS/HTML assets load exactly as they do on disk -- and it stays
one HTTP request, as the single file was.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import zipfile
from pathlib import Path

from . import assets
from ._write import write_text
from .branding import FAVICON, LOGO_SVG
from .notebook.loader import stem_for
from .notebook.parser import parse_notebook
from .notebook.sources import doc_from_bytes, doc_from_text
from .render.page import render_page, render_shell

# A fixed timestamp for every zip member. Without it the archive's bytes change
# on every build, and the committed docs/ Pages build would show a diff each
# time whether or not anything in it actually changed.
_ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)


def web_parse(name: str, text: str, taken_json: str = "[]") -> str:
    """Bridge for the Pyodide build: one dropped file's text -> shell HTML.

    Dispatches through the same producer table the CLI uses, so a
    ``.tex``, a ``.md`` or a ``.csv`` dropped on the web build opens the
    way it does locally -- with no JavaScript parser to keep in step
    (T91).
    """
    doc = doc_from_text(name, text)
    return _web_finish(doc, name, taken_json)


def web_parse_b64(name: str, b64: str, taken_json: str = "[]") -> str:
    """The binary half of the bridge (T113): a dropped .xlsx arrives as
    base64 because a workbook has no text to hand over."""
    doc = doc_from_bytes(name, base64.b64decode(b64))
    return _web_finish(doc, name, taken_json)


def _web_finish(doc, name: str, taken_json: str) -> str:
    base = re.sub(r"\.[A-Za-z0-9]+$", "", str(name)) or "notebook"
    doc.source_name = stem_for(Path(base + ".ipynb"),
                                set(json.loads(taken_json)))
    return render_shell(doc)


def _is_shipped(path: Path) -> bool:
    """Ship source and assets; skip build leftovers."""
    return (path.is_file()
            and "__pycache__" not in path.parts
            and path.suffix not in (".pyc", ".pyo"))


def bundle_package(dest: Path) -> Path:
    """Zip this package so Pyodide can unpack and import it whole.

    Written deterministically -- members sorted, timestamps fixed -- so an
    unchanged package always produces byte-identical output.
    """
    root = Path(__file__).resolve().parent
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(p for p in root.rglob("*") if _is_shipped(p)):
            arcname = Path("junoview") / path.relative_to(root)
            info = zipfile.ZipInfo(arcname.as_posix(), date_time=_ZIP_EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    return dest


def find_example() -> Path | None:
    """Locate the bundled example notebook, if this is a source checkout.

    Installed from a wheel there is nothing to find and the web build simply
    ships without a demo -- which is what it did before this was a package too.
    """
    name = "example_climate_analysis.ipynb"
    here = Path(__file__).resolve().parent
    bases = [*here.parents[1:3], Path.cwd()]
    for base in bases:
        for candidate in (base / "examples" / name, base / name):
            if candidate.exists():
                return candidate
    return None


def find_gifs() -> Path | None:
    """Locate the demo GIFs the help overlay and welcome tour link to.

    They are ~23 MB, so they are not package data -- too big to put in a wheel
    for a feature that degrades cleanly without them. The page probes for one
    and hides the whole demo section if it 404s, so an install with no GIFs
    shows no broken frames; it just doesn't offer the reel.
    """
    here = Path(__file__).resolve().parent
    for base in [*here.parents[1:3], Path.cwd()]:
        for candidate in (base / "docs" / "gifs", base / "gifs"):
            if candidate.is_dir() and any(candidate.glob("*.gif")):
                return candidate
    return None


def build_web(outdir: Path, example: Path | None = None) -> None:
    """Write a deployable static web app (index.html + the packaged renderer)."""
    outdir.mkdir(parents=True, exist_ok=True)
    zip_path = bundle_package(outdir / "junoview.zip")
    # the package hash is the build's name: the worker's cache key, and
    # the stamp the loader shows so a screenshot can say which build it
    # is (T206 -- three stale-build screenshots in one day)
    version = hashlib.md5(zip_path.read_bytes()).hexdigest()[:12]
    loader = assets.web_loader().replace(
        "<title>", f'<link rel="icon" href="{FAVICON}">\n'
        f'<meta name="junoview-build" content="{version}">\n<title>', 1)
    write_text(outdir / "index.html", loader.replace("__JV_VERSION__", version))
    write_text(outdir / ".nojekyll", "")

    # The offline, installable app: a service worker plus a manifest turn
    # the page into a PWA -- one visit caches the app, the Pyodide runtime
    # and MathJax, after which it loads with no internet and the browser
    # offers "Install app". The worker is version-stamped with the package
    # hash (token replace, NOT str.format -- the JS is full of braces) so a
    # new build retires the old cache while an unchanged package produces
    # byte-identical output, same as the zip itself.
    write_text(outdir / "sw.js",
               assets.sw_js().replace("__JV_VERSION__", version))
    manifest = {
        "name": "Junoview",
        "short_name": "Junoview",
        "description": "Figure-first Jupyter notebook viewer and "
                       "presentation builder — runs entirely in your "
                       "browser, notebooks never leave your machine.",
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "background_color": "#0a141d",
        "theme_color": "#0a141d",
        "icons": [{"src": "icon.svg", "sizes": "any",
                   "type": "image/svg+xml", "purpose": "any"}],
    }
    write_text(outdir / "manifest.webmanifest",
               json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    write_text(outdir / "icon.svg", LOGO_SVG + "\n")

    # The help overlay and welcome tour link to gifs/ relative to the page, so
    # a build into a fresh directory needs them copied across; without this the
    # demo reel silently never appears anywhere but the repo's own docs/.
    gifs = find_gifs()
    if gifs and gifs.resolve() != (outdir / "gifs").resolve():
        dest = outdir / "gifs"
        dest.mkdir(exist_ok=True)
        for gif in sorted(gifs.glob("*.gif")):
            target = dest / gif.name
            if not target.exists() or target.stat().st_size != gif.stat().st_size:
                target.write_bytes(gif.read_bytes())

    # bundle the example so "Try the example notebook" works same-origin
    example = example or find_example()
    if example and example.exists():
        (outdir / "example_climate_analysis.ipynb").write_bytes(
            example.read_bytes())
        # also render an INSTANT static demo (no Pyodide load, no install) —
        # a hosted, clickable "live demo above the fold"
        try:
            doc = parse_notebook(json.loads(
                example.read_text(encoding="utf-8")))
            doc.source_name = "example_climate_analysis"
            write_text(outdir / "example_climate_analysis.html",
                       render_page([doc], mode="static"))
        except Exception:
            pass
