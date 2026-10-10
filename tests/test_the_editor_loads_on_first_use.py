"""The local app's page reads a notebook without the slide editor, and
loads the editor when something needs it (2026-10-10, load cost).

deck.js is 3.3 MB of one IIFE. Every page used to fetch, compile and boot
all of it before it answered a click, even a launch that only read a
notebook: at 4x CPU the example notebook was ready 0.4-0.6 s sooner on a
page with no editor script at all. The app server now names the editor
on its page without running it, and app.js (``jvDeck``) loads it at once
when what is on screen is the editor's, on first use, or at idle.

These are the halves that need no browser: what the page carries, where,
and the decision app.js makes at load. The behaviour -- every way in
working on its first click, nothing on screen changing, the lean boot and
autosave after a late boot -- is driven in Chromium by
test_the_editor_loads_on_first_use_in_a_browser.py.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import ASSETS, js_engine, lift_fn
from junoview import assets
from junoview.render.page import _deferred_hint, page_pieces, render_page
from junoview.render.static import DEFERRED, DEFERRED_HINT, static_files

APP_JS = ASSETS / "js" / "app.js"
BOOT_JS = ASSETS / "js" / "deck" / "99-boot.js"


def _app_page(deferred: bool) -> str:
    return "".join(p if isinstance(p, str) else p.decode("utf-8")
                   for p in page_pieces(mode="app", title="t", shells="",
                                        app_data="{}", asset_base="/static/",
                                        deferred=deferred))


def test_only_the_editor_waits():
    assert DEFERRED == {"deck_js"}
    fields = {f.field for f in static_files()}
    assert DEFERRED <= fields


def test_the_app_page_names_the_editor_without_running_it():
    deck = next(f for f in static_files() if f.field == "deck_js")
    page = _app_page(deferred=True)
    ref = deck.deferred_link("/static/")
    # the inert reference, and the gate right after it that hands the
    # decision to app.js while the page is parsed (APP.deckGate)
    assert ref == ('<script type="text/plain" id="jv-deck-src" '
                   f'data-src="/static/{deck.name}"></script>'
                   '<script>window.SemApp&&SemApp.deckGate&&'
                   'SemApp.deckGate()</script>')
    assert page.count(ref) == 1
    # not fetched, not run: no <script src> for it anywhere
    assert f'<script src="/static/{deck.name}"' not in page
    # every other script and stylesheet is still a file, as before
    for f in static_files():
        if f.field not in DEFERRED:
            assert page.count(f.link("/static/")) == 1, f.name


def test_the_reference_sits_where_the_script_did():
    """Put the script back where its reference is (and drop the head's
    ask to fetch it early) and the page is the page that loaded it at
    once -- the same document, the same order, so the script app.js puts
    in later lands where it always ran."""
    deck = next(f for f in static_files() if f.field == "deck_js")
    lazy = _app_page(deferred=True)
    eager = _app_page(deferred=False)
    hint = _deferred_hint(f"/static/{deck.name}", False)
    assert lazy.count(hint) == 1
    assert lazy.replace(deck.deferred_link("/static/"),
                        deck.link("/static/")).replace(hint, "") == eager
    # ...after app.js and pptx.js, as last thing in the body
    tail = lazy[lazy.index('id="jv-savedfile-js"'):]
    assert tail.index('id="jv-deck-src"') > 0
    assert tail.rstrip().endswith("</body>\n</html>")


def _gate(case: str) -> dict | None:
    """Run app.js's jvDeck.now() with a stand-in document: what it wrote,
    whether it loaded the editor as on first use instead, its state."""
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    app = APP_JS.read_text(encoding="utf-8")
    body = (
        "var wrote=[],loads=0,state='waiting',written=false;\n"
        "var ph={getAttribute:function(){return '/static/deck.0123.js';}};\n"
        "var gate={src:''},other={src:''};\n"
        "var document={readyState:'loading',currentScript:null,\n"
        "  write:function(h){wrote.push(h);}};\n"
        "function load(){loads++;}\n"
        + lift_fn(app, "now") + "\n"
        "var c=" + json.dumps(case) + ";\n"
        "if(c==='gate'){document.currentScript=gate;now(gate);}\n"
        "if(c==='gate-twice'){document.currentScript=gate;now(gate);now(gate);}\n"
        "if(c==='no-gate'){now(null);}\n"
        "if(c==='callback'){document.currentScript=null;now(gate);}\n"
        "if(c==='other-script'){document.currentScript=other;now(gate);}\n"
        "if(c==='external'){gate.src='/x.js';document.currentScript=gate;"
        "now(gate);}\n"
        "if(c==='parsed'){document.readyState='interactive';"
        "document.currentScript=gate;now(gate);}\n"
        "console.log(JSON.stringify({wrote:wrote,loads:loads,state:state,"
        "written:written}));\n")
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "run.js"
        f.write_text(body, encoding="utf-8")
        r = subprocess.run(cmd + [str(f)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_gate_writes_the_editor_in_while_the_page_is_parsed():
    """At once, the editor is written into the page by the gate while the
    parser is on it, so it runs where and when it always did: a #/pres
    address showed its deck 1.2 s later at 4x CPU when it was inserted
    from DOMContentLoaded instead."""
    got = _gate("gate")
    if got is None:
        pytest.skip("no JS engine (node or VS Code) here")
    assert got == {"wrote": ['<script src="/static/deck.0123.js"></script>'],
                   "loads": 0, "state": "loading", "written": True}
    # once only
    assert _gate("gate-twice")["wrote"] == got["wrote"]


@pytest.mark.parametrize("case", ["no-gate", "callback", "other-script",
                                  "external", "parsed"])
def test_from_anywhere_else_it_loads_as_on_first_use(case):
    """document.write anywhere but the gate's own inline script, while the
    parser is on it, would replace the whole page (or be ignored): every
    other way in loads the editor the way first use does."""
    got = _gate(case)
    if got is None:
        pytest.skip("no JS engine (node or VS Code) here")
    assert got == {"wrote": [], "loads": 1, "state": "waiting",
                   "written": False}


def test_a_written_editor_that_never_booted_has_failed():
    """...once the document is parsed: the parser waited for it, so a boot
    that has not said it finished threw or never came, and what waited
    gets its fallback rather than waiting for ever."""
    app = APP_JS.read_text(encoding="utf-8")
    assert app.count("document.write(") == 1
    assert "if(written&&pending()) failed();" in lift_fn(app, "parsed")
    assert "APP.deckGate=function(){deckDecide(document.currentScript);};" \
        in app
    assert "function deckParsed(){deckDecide(null);jvDeck.parsed();}" in app


def test_the_editor_wanted_at_once_is_fetched_from_the_top_of_the_page():
    """The gate writes the editor in where it always ran, but the browser
    only finds a written script when the parser gets there; fetched and
    compiled from then on, a #/pres address showed its deck 0.4 s later
    at 4x CPU. So the head asks for it from the start whenever it will be
    wanted at once: always with nothing open (Home), and otherwise from a
    tiny script that reads the address and this tab's open decks. Before
    the stylesheets, so it waits on none of them."""
    deck = next(f for f in static_files() if f.field == "deck_js")
    url = f"/static/{deck.name}"

    def page(shells: str) -> str:
        return "".join(p if isinstance(p, str) else p.decode("utf-8")
                       for p in page_pieces(mode="app", title="t",
                                            shells=shells, app_data="{}",
                                            asset_base="/static/",
                                            deferred=True))
    home = page("")
    head = home[:home.index("</head>")]
    assert f'<link rel="preload" as="script" href="{url}">' in head
    assert "sempres-open:" not in head
    reading = page('<div class="shell"></div>')
    head = reading[:reading.index("</head>")]
    assert f"<script>{DEFERRED_HINT % url}</script>" in head
    assert 'rel="preload"' not in head
    assert head.index("sempres-open:") < head.index('rel="stylesheet"')
    # pages that carry the editor themselves ask for nothing more
    for eager in (_app_page(deferred=False), render_page([], mode="web",
                                                          asset_base="")):
        assert "sempres-open:" not in eager and 'rel="preload"' not in eager


def _hint(hash_: str, store: dict) -> bool | None:
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    body = (
        "var links=[];var location={hash:" + json.dumps(hash_) + "};\n"
        "var S=" + json.dumps(store) + ",K=Object.keys(S);\n"
        "var sessionStorage={length:K.length,key:function(i){return K[i];},"
        "getItem:function(k){return S[k];}};\n"
        "var document={createElement:function(){return {};},"
        "head:{appendChild:function(l){links.push(l);}}};\n"
        + DEFERRED_HINT % "/static/deck.x.js" + "\n"
        "console.log(JSON.stringify(links));\n")
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "run.js"
        f.write_text(body, encoding="utf-8")
        r = subprocess.run(cmd + [str(f)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        links = json.loads(r.stdout.strip().splitlines()[-1])
    assert all(x == {"rel": "preload", "as": "script",
                     "href": "/static/deck.x.js"} for x in links)
    return len(links) == 1


HINT_CASES = [
    ("", {}), ("#/doc/paper", {}), ("#/pres/talk", {}), ("#/pres/talk/s3", {}),
    ("#pres/talk", {}), ("#/home", {}), ("#/homework", {}),
    ("#/presentations", {}), ("#junoview-handoff", {}),
    ("#/doc/paper", {"sempres-open:proj:/x": '["talk"]'}),
    ("#/doc/paper", {"sempres-open:proj:/x": "[]"}),
    ("#/doc/paper", {"other": '["talk"]'}),
]


@pytest.mark.parametrize("hash_,store", HINT_CASES)
def test_the_hint_asks_exactly_when_app_js_will_load_it_at_once(hash_, store):
    """...the same answer deckAtLoad gives with a notebook open, so the
    hint neither fetches 3 MB for nothing nor misses the case it is for."""
    got = _hint(hash_, store)
    if got is None:
        pytest.skip("no JS engine (node or VS Code) here")
    decks = any(k.startswith("sempres-open:") and json.loads(v)
                for k, v in store.items())
    want = _run(APP_JS.read_text(encoding="utf-8"), "deckAtLoad",
                [[1, hash_, decks]])
    assert want is not None
    assert got == bool(want[0]), (hash_, store, want)


def test_a_page_with_its_assets_inline_cannot_wait():
    with pytest.raises(ValueError):
        page_pieces(mode="app", title="t", shells="", app_data="{}",
                    asset_base=None, deferred=True)
    with pytest.raises(ValueError):
        next(f for f in static_files()
             if f.name.endswith(".css")).deferred_link("/static/")


def test_exports_and_the_web_build_keep_the_editor_at_load():
    """A single-file export has nothing beside it to load later, and the
    web build opens on its welcome, which lists the editor's
    presentations: both carry deck.js exactly as before."""
    deck = next(f for f in static_files() if f.field == "deck_js")
    ref = 'type="text/plain" id="jv-deck-src"'
    static = render_page([], mode="static")
    assert ref not in static
    assert f"<script>{deck.text}</script>" in static
    web = render_page([], mode="web", asset_base="")
    assert ref not in web and deck.link("") in web


def test_the_app_server_sends_the_waiting_page(tmp_path):
    from junoview.server.state import _app_page, _AppState

    nb = tmp_path / "n.ipynb"
    nb.write_text(json.dumps({"cells": [{"cell_type": "markdown",
                                         "metadata": {}, "source": "# Hi"}],
                              "metadata": {}, "nbformat": 4,
                              "nbformat_minor": 5}), encoding="utf-8")
    st = _AppState(tmp_path)
    st.note_open(nb)
    page = _app_page(st).decode("utf-8")
    assert 'id="jv-deck-src"' in page
    assert not re.search(r'<script src="/static/deck\.[0-9a-f]{16}\.js"', page)


# ---- app.js: the decision at load ---------------------------------------

def _run(src: str, name: str, calls: list) -> list | None:
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(lift_fn(src, name) + "\nconsole.log(JSON.stringify("
                     + json.dumps(calls) + f".map(a=>{name}.apply(null,a))));\n",
                     encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads(r.stdout.strip().splitlines()[-1])


def test_what_the_editor_must_be_up_for_at_load():
    src = APP_JS.read_text(encoding="utf-8")
    cases = [
        # (open notebooks, address, decks still open in this tab) -> why
        ([1, "", False], ""),
        ([1, "#/doc/paper", False], ""),
        ([3, "#/doc/paper", False], ""),
        # nothing open: Home, which lists the presentations
        ([0, "", False], "home"),
        ([0, "#/doc/paper", False], "home"),
        # an address that is the editor's
        ([1, "#/pres/talk", False], "route"),
        ([1, "#/pres/talk/s3", False], "route"),
        ([1, "#pres/talk", False], "route"),
        ([1, "#/home", False], "route"),
        # a saved file handing its deck over
        ([1, "#junoview-handoff", False], "handoff"),
        # decks this tab had open before a reload: their tabs show
        ([1, "#/doc/paper", True], "tabs"),
    ]
    got = _run(src, "deckAtLoad", [c for c, _ in cases])
    if got is None:
        pytest.skip("no JS engine (node or VS Code) here")
    assert got == [want for _, want in cases]


def test_the_tab_list_it_reads_is_the_one_the_editor_writes():
    """deckAtLoad's `decks` comes from sessionStorage keys the editor
    writes (10-decks.js OPEN_PRES_KEY): if that key's name moves, a reload
    with decks open would show their tabs late."""
    deck = (ASSETS / "js" / "deck" / "10-decks.js").read_text(encoding="utf-8")
    assert "var OPEN_PRES_KEY='sempres-open:'+SCOPE;" in deck
    assert "ssSet(OPEN_PRES_KEY" in deck
    assert "k.indexOf('sempres-open:')!==0" in APP_JS.read_text(
        encoding="utf-8")


def test_the_editor_says_when_its_boot_has_finished():
    """jvDeck holds clicks and calls until APP.deckBooted: it must be the
    LAST thing the boot does, after every hook is exported and after the
    initial route (which app.js may already have applied)."""
    boot = BOOT_JS.read_text(encoding="utf-8")
    body = boot[:boot.rindex("})();")].rstrip()
    assert body.endswith(
        "if(window.SemApp&&window.SemApp.deckBooted) "
        "window.SemApp.deckBooted();")
    assert boot.index("applyInitialRoute();") < boot.index("deckBooted();")
    app = APP_JS.read_text(encoding="utf-8")
    assert "APP.deckBooted=booted;" in app


def test_the_initial_route_is_applied_once():
    """Applied by app.js when the editor waits, then called again by the
    editor's own boot: the second call must not send the reader back to
    the address the page opened at."""
    app = APP_JS.read_text(encoding="utf-8")
    fn = app[app.index("APP.applyInitialRoute=function(){"):]
    fn = fn[:fn.index("\n  };") + 4]
    assert "if(!routeReady){" in fn
    assert fn.index("if(!routeReady){") < fn.index("routeReady=true;")


def test_a_pointer_must_rest_on_a_door_to_load_the_editor():
    """Every card's head has a Collect and every figure a Plot trace: a
    pointer only passing over one is the reader moving the mouse, and
    loading on it put the editor's boot back into the load (2026-10-10
    review). Keyboard focus still loads at once."""
    fn = lift_fn(APP_JS.read_text(encoding="utf-8"), "intent")
    assert "if(e.type!=='pointerover'){load();return;}" in fn
    assert "d.matches(':hover')" in fn
    assert "setTimeout(" in fn and "clearTimeout(dwell);" in fn


def test_every_door_is_a_real_selector_of_real_elements():
    """DOORS names what a click cannot do without the editor. Each id in
    it must exist in a template, or the door is a guess."""
    app = APP_JS.read_text(encoding="utf-8")
    m = re.search(r"var DOORS=((?:'[^']*'\s*\+?\s*)+);", app)
    assert m, "DOORS not found"
    doors = "".join(re.findall(r"'([^']*)'", m.group(1)))
    ids = set(re.findall(r"#([A-Za-z][\w-]*)", doors))
    html = "".join((ASSETS / "html" / n).read_text(encoding="utf-8")
                   for n in ("page.html", "deck.html", "shell.html"))
    defined = set(re.findall(r'id="([A-Za-z][\w-]*)"', html))
    assert ids <= defined, sorted(ids - defined)
    # the deck's own top-level markup, every element of it, is a door
    deck_html = assets.deck_html()
    tops = re.findall(r'^<div class="[^"]*" id="([\w-]+)"', deck_html, re.M)
    assert tops and set(tops) <= ids, sorted(set(tops) - ids)


# ---- every editor hook the notebook side calls is accounted for ----------

#: Each hook the slide editor exports (``window.Sem*``, ``SemApp.*``) that
#: app.js calls, and why the call is right while the editor has not loaded
#: yet (app.js jvDeck). A call app.js makes to a hook that is not there
#: does nothing -- which is what a dead button IS -- so a new one must be
#: added here with its reason, and a door must really be one of DOORS.
#:   ("door", selector): only reached from a click on that control, which
#:       jvDeck holds until the editor has booted, then makes again;
#:   ("waits", ""): the call goes through jvDeck.then()/later();
#:   ("absent", why): with no editor there is nothing for it to do.
#: A hook reached more than one way lists each.
HOOKS: dict[str, list[tuple[str, str]]] = {k: v if isinstance(v, list)
                                           else [v] for k, v in {
    "SemTrace": ("door", ".plot-trace-btn"),
    "SemCollect": ("door", ".cell-collect"),
    "deckNew": ("door", "#welcome-new"),
    "deckNewFolder": ("door", "#welcome-folder"),
    "deckPinToggle": ("door", "#welcome-pres"),
    "deckChoose": ("door", "#welcome-pres"),
    "deckPreview": ("absent", "Home's rows; Home loads the editor, whose "
                              "boot paints Home again (APP.refreshChrome)"),
    "deckPreviewForget": ("absent", "a preview only the editor drew"),
    "deckRecentNames": ("absent", "Home's rows, as deckPreview"),
    "deckRowWords": ("absent", "Home's rows, as deckPreview"),
    "deckHub": [("waits", ""), ("door", "#welcome-presentations")],
    "deckAuto": ("waits", ""),
    "deckImportPptx": ("waits", ""),
    "deckImportPptxPath": ("waits", ""),
    "deckOpenHandles": ("waits", ""),
    "SemDeckImport": ("waits", ""),
    "SemAsk": ("waits", ""),
    "SemAskTell": ("waits", ""),
    "SemDeckCellCopied": ("waits", ""),
    "deckState": ("absent", "no presentation is open"),
    "deckClose": ("absent", "no presentation is open to close"),
    "deckGo": ("absent", "a deck route waits for the editor (applyHash)"),
    "deckOpen": ("absent", "a deck route waits for the editor (applyHash)"),
    "draftsPending": ("absent", "no deck route is applied before it"),
    "deckOverlayCloseAll": ("absent", "no editor menu can be open"),
    "deckDropImage": ("absent", "an image lands on a slide; none is open"),
    "deckDropMedia": ("absent", "a clip lands on a slide; none is open"),
    "SemDeckLinkable": ("absent", "no selection on a slide to link"),
    "renderPresentationTabs": ("absent", "no deck's tab is open (a reload "
                                         "with one loads the editor at once)"),
}.items()}

_EXPORT = re.compile(r"(?<![\w.])(?:window\.(Sem\w+)|(?:window\.SemApp|SemApp"
                     r"|APP)\.(\w+))\s*=(?!=)")


def _doors() -> list[str]:
    app = APP_JS.read_text(encoding="utf-8")
    m = re.search(r"var DOORS=((?:'[^']*'\s*\+?\s*)+);", app)
    assert m, "DOORS not found"
    return "".join(re.findall(r"'([^']*)'", m.group(1))).split(",")


def test_every_editor_hook_the_notebook_side_calls_is_accounted_for():
    deck = assets.deck_js()
    app = APP_JS.read_text(encoding="utf-8")
    exported = {a or b for a, b in _EXPORT.findall(deck)}
    assert len(exported) > 40   # the regex still finds them
    used = set()
    for name in exported:
        pat = (rf"window\.{name}\b" if name.startswith("Sem")
               else rf"(?:APP|SemApp)\.{name}\b")
        if re.search(pat, app):
            used.add(name)
    assert used == set(HOOKS), (
        f"new: {sorted(used - set(HOOKS))}, gone: {sorted(set(HOOKS) - used)}")
    doors = _doors()
    for name, ways in HOOKS.items():
        for how, what in ways:
            assert how in ("door", "waits", "absent"), name
            if how == "door":
                assert what in doors, (name, what)


def test_a_door_is_one_the_notebook_page_draws():
    """The door classes are on what the renderer draws, so a click on
    them reaches jvDeck's capture listener as a click on a door."""
    html = render_page([], mode="static")
    shell = (ASSETS / "html" / "shell.html").read_text(encoding="utf-8")
    items = (Path(__file__).resolve().parent.parent / "src" / "junoview"
             / "render" / "items.py").read_text(encoding="utf-8")
    for cls in (".plot-trace-btn", ".cell-collect"):
        assert cls in _doors()
        assert (f'class="{cls[1:]}' in items or f'class="{cls[1:]}' in shell
                or cls[1:] in html), cls


def test_waiting_calls_wait():
    """The hooks marked as waiting are called only inside jvDeck.then()
    or later() -- each call site sits in a function handed to one -- or
    from the listener of a door the hook also lists."""
    app = APP_JS.read_text(encoding="utf-8")
    for name, ways in HOOKS.items():
        if ("waits", "") not in ways:
            continue
        ids = [w for h, w in ways if h == "door" and w.startswith("#")]
        pat = (rf"window\.{name}\(" if name.startswith("Sem")
               else rf"APP\.{name}\(")
        for m in re.finditer(pat, app):
            before = app[max(0, m.start() - 400):m.start()]
            k = max(before.rfind("jvDeck.then(function("),
                    before.rfind("jvDeck.later(function("))
            wired = re.findall(r"\$\('(#[\w-]+)'\)", before)
            # ...or the function returned early, through then(), while
            # the editor was still to come (autoSlidesFrom)
            fn = app[:m.start()]
            fn = fn[fn.rfind("\n  function "):]
            early = re.search(r"jvDeck\.pending\(\)\)\{\s*jvDeck\.then\("
                              r"[^\n]*\n?\s*return;", fn)
            at = (name, app[:m.start()].count("\n") + 1)
            assert k >= 0 or (wired and wired[-1] in ids) or early, at


def test_the_idle_load_waits_for_the_reader_too():
    """At idle means no long task AND no scroll, key or press for the
    quiet spell: the editor's boot is one long task, and landed in the
    middle of a scroll it dropped a frame of 120-170 ms at 4x CPU that
    the page never dropped after its load before (2026-10-10 review)."""
    fn = lift_fn(APP_JS.read_text(encoding="utf-8"), "preload")
    for t in ("'wheel'", "'scroll'", "'keydown'", "'pointerdown'",
              "'touchstart'"):
        assert t in fn, t
    assert "function input(){last=Math.max(last,performance.now());}" in fn
    # ...and they stop listening once the editor is asked for
    assert fn.count("done();") == 2
