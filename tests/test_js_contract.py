"""The contracts between the JS assets and everything around them.

The frontend is plain files with no build step, no bundler and no test
runner of its own -- which means nothing ever parses the JS before a
browser does, and nothing checks that the ids the scripts look up still
exist in the templates they run against. These tests are that missing
half. None of them *executes* any JavaScript; they read the files as
text and hold three cheap promises:

1. Every element id the scripts look up exists somewhere -- in a
   template, or on the curated list of ids the JS itself creates.
   deck.js in particular returns out of its entire IIFE if `#deck` is
   missing (deck.js:3-5), so a renamed id doesn't error: the deck
   feature silently vanishes.
2. The CDN pins agree. The service worker precaches Pyodide, MathJax
   and Plotly under *version-stamped* URLs; each of those versions is
   also pinned where it is loaded (web-loader.html, mathjax.html,
   app.js). ARCHITECTURE.md says "bump the two together" -- this test
   is what turns forgetting that red.
3. The JS actually parses, using whatever node happens to be around
   (including VS Code's Electron run as node, since dev machines here
   deliberately have no Node toolchain).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ASSETS = Path(__file__).resolve().parent.parent / "src" / "junoview" \
    / "assets"
JS = ASSETS / "js"
HTML = ASSETS / "html"

# The documents app.js and deck.js actually run inside are assembled from
# these four templates (page.html is the static page, shell.html one
# notebook tab, deck.html the presentation builder, help.html the overlay).
TEMPLATES = ["deck.html", "page.html", "shell.html", "help.html"]

# Ids the JS looks up that exist in NO template because the JS builds the
# element itself at runtime. Curated by hand -- a new entry needs a note
# saying where the element is created, so the next reader can re-verify.
RUNTIME_IDS = {
    # The presenter console is a popup window whose whole body is one
    # markup string in deck.js (~line 13950, 'jvp-' = junoview presenter);
    # these lookups run against that popup's document, not the app's.
    "jvp-clock", "jvp-count", "jvp-goal", "jvp-next-b", "jvp-notes",
    "jvp-now", "jvp-pause", "jvp-prev", "jvp-reset", "jvp-slideclock",
    "jvp-talk",
    # The PDF/print export builds a throwaway container:
    # deck.js ~line 17471, root.id='print-root'.
    "print-root",
    # Auto-arrange's live count badge: deck.js ~line 12696, n.id='aa-n'
    # (the rest of the aa- dialog is static markup in deck.html).
    "aa-n",
    # Dropdown menus the deck builds on first open rather than shipping
    # in the markup: deck.js ~line 15375 (film strip's view menu) and
    # ~line 11853 (the matching bar's property menu).
    "film-menu", "match-menu",
}

# Lookups of elements that were REMOVED from the markup but whose
# null-guarded JS was left behind. All such leftovers have now been
# deleted from the JS (2026-08-23); the set stays so a NEW miss still
# fails loudly. Add an entry (with a note) only as a deliberate,
# temporary tolerance.
VESTIGIAL_IDS: set[str] = set()

# The three ways these scripts look an element up by id. $ / $$ are the
# querySelector helpers both files define; only single-quoted literal
# arguments count -- computed ids ($('#'+x)) are invisible to a static
# check and rightly so.
_LOOKUP = re.compile(
    r"\$\$?\(\s*'#([A-Za-z0-9_-]+)'\s*[),]"
    r"|getElementById\(\s*'([A-Za-z0-9_-]+)'\s*\)"
)


def _looked_up_ids() -> set[str]:
    ids: set[str] = set()
    for name in ("app.js", "deck.js"):
        text = (JS / name).read_text(encoding="utf-8")
        for m in _LOOKUP.finditer(text):
            ids.add(m.group(1) or m.group(2))
    return ids


def _template_ids() -> set[str]:
    ids: set[str] = set()
    for name in TEMPLATES:
        text = (HTML / name).read_text(encoding="utf-8")
        ids.update(re.findall(r'id="([A-Za-z0-9_-]+)"', text))
    return ids


def test_every_id_the_js_looks_up_exists_somewhere():
    looked_up = _looked_up_ids()
    # If the extraction regex rots (someone renames the $ helpers, say)
    # this test would silently check nothing; app.js+deck.js look up
    # hundreds of ids, so an implausibly small haul is the regex's fault.
    assert len(looked_up) > 20, (
        f"only extracted {len(looked_up)} id lookups -- the extraction "
        "regex no longer matches how app.js/deck.js query elements"
    )
    known = _template_ids() | RUNTIME_IDS | VESTIGIAL_IDS
    missing = looked_up - known
    assert not missing, (
        f"JS looks up ids that no template defines: {sorted(missing)}. "
        "Either the template lost the element (the lookup now returns "
        "null and the feature silently degrades) or the JS creates it "
        "at runtime -- then add it to RUNTIME_IDS with a note saying "
        "where."
    )
    # Keep the allowlists honest in the other direction too: an entry
    # nothing looks up any more is a stale exemption waiting to hide a
    # real regression under the same name.
    stale = (RUNTIME_IDS | VESTIGIAL_IDS) - looked_up
    assert not stale, (
        f"allowlisted ids no longer looked up by any JS: "
        f"{sorted(stale)} -- remove them from RUNTIME_IDS/VESTIGIAL_IDS"
    )


def test_the_deck_mount_point_exists():
    """`#deck` deserves its own line: deck.js:3-5 returns out of the whole
    IIFE when it is absent, so losing it doesn't throw -- every deck
    feature just quietly stops existing."""
    assert "deck" in _template_ids(), (
        'no template carries id="deck"; deck.js will bail out of its '
        "entire IIFE at load"
    )


def test_cdn_pins_match_the_service_worker():
    """Each CDN dependency is pinned twice: where it is loaded, and in
    sw.js's precache list. If they drift, the app runs one version online
    and caches another -- offline (the PWA's whole point) then runs code
    that was never tested. A one-sided bump must fail here."""
    sw = (JS / "sw.js").read_text(encoding="utf-8")

    # Pyodide: web-loader.html's script tag vs sw.js's PY base URL.
    loader = (HTML / "web-loader.html").read_text(encoding="utf-8")
    m = re.search(
        r'src="(https://cdn\.jsdelivr\.net/pyodide/v[^"]+/)pyodide\.js"',
        loader)
    assert m, "web-loader.html no longer pins Pyodide where expected"
    assert m.group(1) in sw, (
        f"Pyodide pinned at {m.group(1)} in web-loader.html but sw.js "
        "precaches a different version -- bump the two together "
        "(see the comment above PY in sw.js)"
    )

    # Plotly: app.js's lazy ensurePlotly loader vs sw.js's precache.
    app = (JS / "app.js").read_text(encoding="utf-8")
    m = re.search(r"'(https://cdn\.plot\.ly/plotly-[^']+\.js)'", app)
    assert m, "app.js no longer pins Plotly where expected"
    assert m.group(1) in sw, (
        f"Plotly pinned at {m.group(1)} in app.js but sw.js precaches "
        "a different version -- bump the two together"
    )

    # MathJax: mathjax.html's script tag vs sw.js's MJ base + file. The
    # worker builds the URL as MJ + 'tex-chtml.js', so check both parts.
    mathjax = (HTML / "mathjax.html").read_text(encoding="utf-8")
    m = re.search(
        r'src="(https://cdn\.jsdelivr\.net/npm/mathjax@[^"]+/)([^"/]+)"',
        mathjax)
    assert m, "mathjax.html no longer pins MathJax where expected"
    base, script = m.group(1), m.group(2)
    assert base in sw, (
        f"MathJax pinned at {base} in mathjax.html but sw.js precaches "
        "a different version -- bump the two together"
    )
    assert script in sw, (
        f"mathjax.html loads {script} but sw.js does not precache it"
    )


def _js_engine() -> tuple[list[str], dict[str, str]] | None:
    """Find something that can parse JS: node, else VS Code's Electron.

    Dev machines here deliberately have no Node toolchain (the project
    needs none), but VS Code ships one inside Electron:
    ELECTRON_RUN_AS_NODE=1 makes Code.exe behave as a plain node binary.
    """
    node = shutil.which("node")
    if node:
        return [node], dict(os.environ)
    for base in (os.environ.get("LOCALAPPDATA", ""),
                 os.environ.get("ProgramFiles", "")):
        exe = Path(base) / "Programs" / "Microsoft VS Code" / "Code.exe"
        if not exe.exists():
            exe = Path(base) / "Microsoft VS Code" / "Code.exe"
        if base and exe.exists():
            return [str(exe)], {**os.environ, "ELECTRON_RUN_AS_NODE": "1"}
    return None


def test_every_asset_js_file_parses():
    """`--check` parses without executing, so sw.js's worker globals and
    the browser-only APIs everywhere else are fine. This is the only
    pre-browser syntax gate the no-build-step frontend gets locally
    (CI runs node --check too, but only after push)."""
    engine = _js_engine()
    if engine is None:
        pytest.skip("no JS engine found (no node on PATH, no VS Code "
                    "Electron to run as node)")
    cmd, env = engine
    for path in sorted(JS.glob("*.js")):
        proc = subprocess.run(
            cmd + ["--check", str(path)],
            capture_output=True, text=True, env=env, timeout=120,
        )
        assert proc.returncode == 0, (
            f"{path.name} does not parse:\n{proc.stderr}"
        )
