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
    # 47-charts.js builds this popover on demand when you tie an
    # object to a chart SERIES, and removes it on close (T173)
    "series-tie",
    # The presenter console is a popup window whose whole body is one
    # markup string in deck.js (~line 13950, 'jvp-' = junoview presenter);
    # these lookups run against that popup's document, not the app's.
    "jvp-clock", "jvp-count", "jvp-goal", "jvp-next-b", "jvp-notes",
    "jvp-now", "jvp-pause", "jvp-prev", "jvp-reset", "jvp-slideclock",
    "jvp-talk", "jvp-find", "jvp-hits",
    # The PDF/print export builds a throwaway container:
    # deck.js ~line 17471, root.id='print-root'.
    "print-root",
    # Auto-arrange's live count badge: deck.js ~line 12696, n.id='aa-n'
    # (the rest of the aa- dialog is static markup in deck.html).
    "aa-n",
    # The two "show me the others" popups T89 added, both built the same
    # way as the canvas menu -- created on open, removed on close, never
    # shipped in the markup (35-arranging.js openObjMatchMenu and
    # 40-captions-and-components.js openCmpInstMenu).
    "objmatch-menu", "cmp-inst-menu",
    # the layout-ideas chooser, built on open and removed on close like
    # the two menus above (35-arranging.js openLayoutIdeas, T131)
    "lay-ideas",
    # the reading-order panel, built on open and removed on close
    # (45-images.js openReadingOrder, T106)
    "rd-order",
    # the chart-numbers dialog, built on open and removed on close
    # (47-charts.js chartDataDlg, T117)
    "chart-data",
    # the masters panel, built on open and removed on close
    # (40-captions-and-components.js openMasters, T115)
    "mast-panel",
    # What goes in an object frame: built on first open and then kept,
    # because it floats over the canvas rather than living in a ribbon
    # group (45-images.js openObjSrc, T61).
    "obj-src-menu",
    # The saved-to chip's countdown, written into #qat-auto's innerHTML
    # by syncAutoChip (60-saving-and-export.js) rather than shipped in
    # the markup, because the chip is rebuilt whenever the cadence or
    # the pending state changes (T70).
    "qat-tick",
    # Dropdown menus the deck builds on first open rather than shipping
    # in the markup: deck.js ~line 15375 (film strip's view menu) and
    # ~line 11853 (the matching bar's property menu).
    "film-menu", "match-menu",
    # The canvas right-click menu, built per click and removed on the
    # next one: deck.js, THE CANVAS RIGHT-CLICK MENU banner. "selby-menu"
    # is the Arrange row's standalone copy of its select-by rows, built
    # by openSelectByMenu in SELECTING BY WHAT THINGS ARE.
    "canvas-menu", "selby-menu",
    # The ribbon customiser, built on right-clicking the ribbon and
    # removed on the next click: deck.js, A RIBBON OF YOUR OWN.
    "rbn-cust",
    # The overview map, an overlay built per open and removed on close:
    # deck.js, THE OVERVIEW. Its search box is built with it:
    # deck.js, FINDING A SLIDE WHILE YOU ARE TALKING.
    "deck-overview", "ovw-find",
    # The deck-token editor, built on demand: deck.js, DESIGN TOKENS.
    "tok-pop",
    # The roomy notes editor, an overlay built per open and removed on
    # close: deck.js, THE ROOM TO WRITE THEM IN.
    "deck-notesed",
    # The history panel, the same shape: deck.js, WHAT THIS DECK USED TO
    # BE. Its rail and body are reached through the overlay rather than
    # by id, so only the overlay itself is looked up globally.
    "deck-history",
    # The design surface, built the same way and deliberately the same
    # shape: deck/50-review-and-overview.js, THE DESIGN SURFACE (T87).
    "deck-design",
    # The review panel, likewise: deck.js, WHAT THE DECK SAYS, IN WORDS.
    "deck-review",
    # The ribbon-layout gallery, built per open and removed on close:
    # deck/07-ribbon-layouts.js, THE GALLERY.
    # Its overflow warning is also looked up directly so applying a
    # too-wide layout can reveal the remedy above the deck's toast layer.
    "rbn-gallery", "rbn-gal-warn",
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
    """Every id the frontend asks the DOM for.

    deck.js is now js/deck/ -- the fragments DECK_PARTS names, one
    IIFE between them (T36) --
    so the scan reads what assets.deck_js() assembles rather than a file
    that no longer exists. Same text, one source of truth about which
    parts are in it.
    """
    from junoview import assets

    ids: set[str] = set()
    for text in ((JS / "app.js").read_text(encoding="utf-8"),
                 assets.deck_js()):
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


def test_no_asset_reaches_for_a_webfont_cdn():
    """A static export is ONE file someone emails, and it has to look the
    same on a plane as on Wi-Fi.

    core.css used to open with an @import of IBM Plex from
    fonts.googleapis.com, and EVERY mode inlines that file verbatim -- the
    local app, the exported .html, the deck's standalone export (it copies
    the head's <style> blocks) and the widget's scoped copy -- so
    "shareable, self-contained" quietly meant "plus two Google hosts", and
    sw.js allow-listed them for caching without ever precaching them
    (JVR-06, 2026-09-01). The families stay first in the stacks for anyone
    who has them installed; nothing is fetched to get them.
    """
    # block comments are stripped first: naming a host to explain why it
    # is NOT used is documentation, and a rule that forbids the
    # explanation as loudly as the fetch teaches people to delete the
    # explanation.
    strip = re.compile(r"/\*.*?\*/|<!--.*?-->", re.S)
    for path in sorted(ASSETS.rglob("*")):
        if path.suffix not in (".css", ".js", ".html"):
            continue
        text = strip.sub("", path.read_text(encoding="utf-8"))
        for host in ("fonts.googleapis.com", "fonts.gstatic.com"):
            assert host not in text, (
                f"{path.relative_to(ASSETS)} fetches a webfont from "
                f"{host}; a rendered page must not depend on a font CDN"
            )
    # ...and the rendered page agrees, in both modes
    from junoview.render.page import render_page
    for mode in ("static", "web"):
        page = render_page([], mode=mode)
        assert "fonts.googleapis.com" not in page
        assert "fonts.gstatic.com" not in page
    # the stack itself survives -- the fix is "no fetch", not "no Plex"
    assert "'IBM Plex Sans',system-ui" in render_page([])


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


def test_the_assembled_deck_parses():
    """js/deck/ holds FRAGMENTS of one IIFE (TASKS T36), so checking one
    of them means nothing -- half of them do not balance alone, by
    construction. The gate is on what actually ships: assemble the parts
    exactly as assets.deck_js() does, and parse that.

    This is stricter than the per-file check it replaces, because it also
    catches a part that parses on its own and breaks the join.
    """
    import tempfile

    from junoview import assets

    engine = _js_engine()
    if engine is None:
        pytest.skip("no JS engine found")
    cmd, env = engine
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "deck.assembled.js"
        f.write_text(assets.deck_js(), encoding="utf-8", newline="\n")
        proc = subprocess.run(
            cmd + ["--check", str(f)],
            capture_output=True, text=True, env=env, timeout=180,
        )
    assert proc.returncode == 0, (
        f"the assembled deck.js does not parse:\n{proc.stderr}")


def test_the_boot_sequence_is_last_by_filename_not_by_habit():
    """All of deck's load-time work runs from THE BOOT SEQUENCE, after
    every declaration above it. That used to be a comment and a
    convention; it is now a fact about the directory listing, which is
    the whole reason the boot got a file of its own.
    """
    from junoview import assets

    assert assets.DECK_PARTS[-1] == "99-boot"
    assert assets.DECK_PARTS == tuple(sorted(assets.DECK_PARTS)), (
        "the parts are concatenated in the order listed, and that order "
        "has to match what a directory listing shows, or reading them "
        "in order means reading them in a different order")
    boot = (JS / "deck" / "99-boot.js").read_text(encoding="utf-8")
    assert "THE BOOT SEQUENCE" in boot
    assert boot.rstrip().endswith("})();")


def test_every_deck_part_is_listed_and_every_listing_is_a_part():
    """A part on disk that nothing concatenates is dead code that still
    looks alive; a listed part that is missing is a page that will not
    load. Both are silent, so both are checked.
    """
    from junoview import assets

    on_disk = {p.stem for p in (JS / "deck").glob("*.js")}
    assert on_disk == set(assets.DECK_PARTS), (
        f"only on disk: {sorted(on_disk - set(assets.DECK_PARTS))}; "
        f"only listed: {sorted(set(assets.DECK_PARTS) - on_disk)}")


def test_a_deck_part_says_what_it_is():
    """A fragment whose braces do not balance has to explain itself in
    its first line, or the next person to open one assumes it is broken.
    """
    for name in ("05-figures-and-ribbon", "99-boot"):
        head = (JS / "deck" / f"{name}.js").read_text(
            encoding="utf-8")[:400]
        assert "ONE FRAGMENT of deck.js's single IIFE" in head
        flat = " ".join(head.split())
        assert "It does not parse alone" in flat


def test_no_name_is_declared_twice_at_the_top_of_the_one_iife():
    """deck/ is ONE scope in fifteen files, so a name declared in two of
    them is not two functions -- it is the later one, and every call
    written against the earlier body silently gets the wrong one.

    This shipped: `moveSection(id,dir)` (nudge the run one place, return
    how many slides moved) and `moveSection(id,beforeAt)` (drop the run
    at a divider) both existed. The second won, so T23's "Move the
    section up" read dir=-1 as beforeAt=-1 and spliced the whole run in
    before the LAST slide, "down" was a no-op for a section at the
    front, and neither toasted, because the surviving body returns
    nothing (2026-08-25).

    Nothing else could catch it. The language does not complain, and a
    substring test finds BOTH spellings present in the page and is
    satisfied.
    """
    import collections
    import re

    top = re.compile(r"^  function ([A-Za-z_$][\w$]*)\s*\(")
    seen = collections.defaultdict(list)
    for path in sorted((ASSETS / "js" / "deck").glob("*.js")):
        for i, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), 1):
            m = top.match(line)
            if m:
                seen[m.group(1)].append(f"{path.name}:{i}")

    assert len(seen) > 400, (
        f"only {len(seen)} top-level functions found — the fragments no "
        "longer indent the IIFE's own level by two spaces")
    dupes = {k: v for k, v in seen.items() if len(v) > 1}
    assert not dupes, (
        "declared twice at the top level of the one IIFE (the later one "
        f"silently wins): { {k: v for k, v in sorted(dupes.items())} }")


def test_eval_time_deck_work_finds_its_stores_already_declared():
    """The boot-order trap, pinned at its one known eval-time exception.

    99-boot.js owns all load-time execution -- except one initialiser
    that cannot wait: ``var projectPres=...map(normPres)`` in 10-decks
    runs at EVAL, and when a saved deck carries inline ``emb`` it walks
    normPres -> embStore -> dropFrameCache -> Object.keys(frameNodeCache).
    On 2026-08-31 those cache stores were declared six hundred lines
    AFTER that initialiser: hoisted names, unassigned values, and the
    whole editor silently gone at boot for any project whose saved deck
    had embedded copies (T133). ``node --check`` cannot see it and no
    substring can, so the ORDER is the contract: every store that
    eval-time path touches must be assigned before the initialiser runs.
    """
    from junoview import assets

    out = assets.deck_js()
    # the fuller form, because a comment beside the store declarations
    # QUOTES `var projectPres=` and .index would find the quote first
    init = out.index("var projectPres=(APP.project")
    for store in ("var EMBED={}", "var embItems={}",
                  "var frameNodeCache={}", "var snapNodeCache=new Map()"):
        assert out.index(store) < init, (
            f"{store} is declared after the eval-time projectPres "
            "initialiser that can reach it -- the T133 boot-death shape")

def test_no_template_emits_a_duplicate_id():
    """One id, one element (T134 / JVUX-04). deck.html carried a second
    deck-status/qat-auto pair for two days short of a year of T70's
    life: $() is querySelector, so leftovers from a half-finished move
    are dead markup that still fools every DOM count. No allow-list --
    a duplicate id is always a bug in the assembled editor."""
    import re
    from collections import Counter

    from junoview import assets

    for name, html in [("deck.html", assets.deck_html()),
                       ("page.html", assets.page_template()),
                       ("shell.html", assets.shell_template()),
                       ("help.html", assets.help_html()),
                       ("web-loader.html", assets.web_loader())]:
        ids = re.findall(r'id="([^"{}]+)"', html)
        dupes = {k: v for k, v in Counter(ids).items() if v > 1}
        assert not dupes, f"{name} emits duplicate id(s): {dupes}"

def test_the_shared_menu_wiring_is_only_ever_handed_id_strings():
    """wireMenuToggle takes three ID STRINGS and builds `'#'+id` from
    each. Handed an ELEMENT it produces the selector
    `#[object HTMLButtonElement]`, and querySelector raises a
    SyntaxError -- which, thrown from THE BOOT SEQUENCE, takes the rest
    of the deck IIFE with it: no overlay closer, no reuse doors, no
    ribbon preferences, and an Insert ribbon whose Chart button silently
    does nothing at all.

    That shipped in T171 and all 990 tests stayed green, because the
    call reads perfectly well as a substring. It was found by clicking
    the button (2026-09-01). This pins the argument SHAPE, so the next
    caller that reaches for the helper with elements in hand fails here
    instead of in somebody's browser.
    """
    from junoview import assets

    src = assets.deck_js()
    q = "'" + '"'
    bad = []
    for args in re.findall(r"wireMenuToggle\(([^()]*)\)", src):
        if not args.strip():
            continue
        for a in args.split(","):
            a = a.strip()
            # the helper's own signature and its one pass-through call
            if a in ("wrapId", "btnId", "menuId"):
                continue
            if not (a[:1] in q and a[-1:] == a[:1]):
                bad.append(args.strip()[:70])
                break
    assert not bad, (
        "wireMenuToggle is passed something that is not an id string: "
        + repr(bad)
        + " -- it does $('#'+arg), so an element there is a SyntaxError "
        "at boot, and the rest of the deck never wires up. Wire that "
        "menu directly instead."
    )
