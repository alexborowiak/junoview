"""The lean boot, driven in Chromium against the real app server: every
figure copy, picture and clip survives every path byte for byte.

Opt-in like the theme matrix (it needs Playwright's Chromium): set
``JUNOVIEW_BROWSER_TESTS=1``. The pure halves of the same mechanisms run
in the ordinary suite (test_lean_boot_keeps_every_copy.py,
test_saving_does_only_what_changed.py).

The session, on a project of five decks that place the open notebook's
figures, a closed notebook's, pictures and clips:

1. the page boots with no copies in it;
2. a deck whose notebook is closed is opened BEFORE the idle fetch has
   answered -- the reader fetches them itself, and the frame shows the
   kept copy, never a blank or the notebook's version;
3. one deck is edited and the 20-second consolidation runs: only that
   deck goes out whole, and the file keeps every copy of every deck;
4. a deliberate Save, a reload, closing the notebook, saving again and a
   downloaded copy: every copy, picture and clip still byte for byte.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.notebook.loader import load_doc
from junoview.notebook.presentations import as_presentations
from junoview.render.page import deck_payload
from junoview.server.routes import _make_handler
from junoview.server.state import _PROJECT_FILE, _AppState

ROOT = Path(__file__).resolve().parent.parent
NB = ROOT / "examples" / "example_climate_analysis.ipynb"
PIC = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
       "AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAASUVORK5CYII=")


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


def _kept(tag: str, item: dict | None = None) -> dict:
    """A copy in the form the editor writes (so re-embedding it is a
    no-op): the card's own title and kind, a body and a code facet."""
    body = (f'<div class="cardbody"><p class="kept">KEPT {tag}</p>'
            f'<img src="{PIC}"></div>')
    return {"title": (item or {}).get("title", f"Fig {tag}"),
            "kind": (item or {}).get("kind", "figure"), "html": body,
            "code": f'<div class="codeinner"><pre>kept_code_{tag}()</pre></div>'}


def _project(root: Path) -> dict:
    nb = root / NB.name
    nb.write_bytes(NB.read_bytes())
    items = {it["anchor"]: it for it in
             json.loads(deck_payload(load_doc(nb)))["items"]}
    stem = nb.stem
    figs = [a for a, it in items.items() if it.get("kind") == "figure"][:3]
    refs = [f"{stem}::{a}" for a in figs]
    kept = {r: _kept(str(i), items[a]) for i, (r, a)
            in enumerate(zip(refs, figs, strict=True))}

    def deck(name, rs, extra=None):
        d = {"name": name, "slides": [
            {"layout": "blank", "annots": [
                {"k": "text", "x": 6, "y": 5, "w": 60, "text": f"{name} {i}"},
                {"k": "cell", "x": 6, "y": 20, "w": 50, "h": 60, "ref": r}]}
            for i, r in enumerate(rs)],
            "emb": {r: kept.get(r) or _kept(r) for r in rs}}
        d.update(extra or {})
        return d
    talk = deck("talk", refs)
    talk["slides"].append({"layout": "blank", "annots": [
        {"k": "image", "x": 5, "y": 5, "w": 40, "h": 40,
         "src": PIC + "A" * 12000}]})
    decks = [
        talk,
        deck("poster", refs[:1]),
        deck("closed", ["gone::one", "gone::two"]),
        {**deck("clips", refs[1:2]), "media": {
            "med:v": {"src": "data:video/mp4;base64," + "AAAA" * 3000,
                      "mime": "video/mp4", "name": "v.mp4"}}},
        {"name": "gathered", "kind": "collection", "slides": [],
         "items": [{"id": "x", "k": "cell", "ref": refs[2]}],
         "emb": {refs[2]: kept[refs[2]]}},
    ]
    decks[3]["slides"][0]["annots"].append(
        {"k": "video", "x": 50, "y": 50, "w": 30, "h": 20, "vkey": "med:v"})
    # slides already named, as any deck the editor has saved once is --
    # minting names is an edit, and this session should make only one
    for p in decks:
        for i, s in enumerate(p["slides"]):
            s["sid"] = f"s{p['name']}{i}"
    decks = as_presentations(decks)
    (root / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb)], "recent": [str(nb)]},
        indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"decks": decks, "stem": stem, "refs": refs}


def _copies(root: Path) -> dict:
    d = json.loads((root / _PROJECT_FILE).read_text(encoding="utf-8"))
    return {p["name"]: {"emb": p.get("emb"), "media": p.get("media"),
                        "pics": [a.get("src") for s in p.get("slides", [])
                                 for a in s.get("annots", [])
                                 if a.get("k") == "image"]}
            for p in d["presentations"]}


def _same_copies(root: Path, want: list, why: str):
    got = _copies(root)
    for p in want:
        g = got[p["name"]]
        for r, e in (p.get("emb") or {}).items():
            assert g["emb"] and g["emb"].get(r) == e, f"{why}: {p['name']} {r}"
        assert (g["media"] or {}) == (p.get("media") or {}), f"{why}: clips"
        pics = [a.get("src") for s in p.get("slides", [])
                for a in s.get("annots", []) if a.get("k") == "image"]
        assert g["pics"] == pics, f"{why}: pictures of {p['name']}"


def test_every_copy_survives_the_lean_boot(tmp_path):
    _need_browser()
    from playwright.sync_api import sync_playwright
    fx = _project(tmp_path)
    decks = fx["decks"]
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    posts: list = []
    try:
        with sync_playwright() as pw:
            try:
                b = pw.chromium.launch()
            except Exception as e:  # noqa: BLE001
                pytest.skip(f"Chromium will not launch here: {e}")
            ctx = b.new_context(viewport={"width": 1366, "height": 657})
            ctx.add_init_script(
                "try{localStorage.setItem('plotline-tour','1');"
                "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
            ctx.route("https://cdn.jsdelivr.net/**",
                      lambda rt: rt.fulfill(status=404, body=""))

            # the idle fetch is held back, so the first reader must fetch
            def slow(route):
                if route.request.resource_type == "fetch":
                    import time
                    time.sleep(3)
                route.continue_()
            ctx.route("**/api/emb*", slow)
            pg = ctx.new_page()
            errs: list = []
            pg.on("pageerror", lambda e: errs.append(str(e)))

            def onreq(rq):
                if "/api/save" in rq.url:
                    body = json.loads(rq.post_data or "{}")
                    posts.append(sorted(p["name"] for p in body["presentations"]
                                        if "emb" in p or "media" in p))
            pg.on("request", onreq)
            pg.goto(url, wait_until="load")
            # 1. no copies in the page
            boot = pg.evaluate(
                "document.getElementById('app-data').textContent")
            assert "kept_code_" not in boot and "KEPT " not in boot
            assert not any("emb" in p or "media" in p for p in
                           json.loads(boot)["project"]["presentations"])
            # 2. open the closed notebook's deck before the idle fetch
            pg.evaluate("window.SemApp.deckOpen('closed')")
            pg.wait_for_timeout(600)
            state = pg.evaluate("window.SemDeckEmbState()")
            assert state["loaded"] and state["syncFetches"] == 1
            frame = pg.evaluate("document.querySelector('#deck .annot-layer')"
                                ".innerText")
            assert "KEPT gone::one" in frame
            # the open notebook's figures show the kept copy, not the card
            pg.evaluate("window.SemApp.deckOpen('talk')")
            pg.wait_for_timeout(600)
            assert "KEPT 0" in pg.evaluate(
                "document.querySelector('#deck .annot-layer').innerText")
            # 3. edit talk; the consolidation sends talk alone, whole
            box = pg.locator("#deck .annot-layer .an-text").first.bounding_box()
            pg.mouse.move(box["x"] + 20, box["y"] + 6)
            pg.mouse.down()
            pg.mouse.move(box["x"] + 30, box["y"] + 12)
            pg.mouse.up()
            pg.wait_for_timeout(500)
            posts.clear()
            pg.evaluate("window.SemDeckConsolidate()")
            pg.wait_for_timeout(1500)
            assert posts == [["talk"]], posts
            _same_copies(tmp_path, decks, "after the consolidation")
            # 4. a deliberate Save writes every deck whole, unchanged
            posts.clear()
            pg.keyboard.press("Control+s")
            pg.wait_for_timeout(1500)
            assert posts and len(posts[-1]) == len(decks), posts
            _same_copies(tmp_path, decks, "after a deliberate Save")
            # ...reload: lean again, and the closed deck still shows
            ctx.unroute("**/api/emb*")
            pg.reload(wait_until="load")
            pg.wait_for_timeout(2500)
            pg.evaluate("window.SemApp.deckOpen('closed')")
            pg.wait_for_timeout(500)
            assert "KEPT gone::two" in pg.evaluate(
                "document.querySelector('#deck .annot-layer').innerText") \
                or "KEPT gone::one" in pg.evaluate(
                "document.querySelector('#deck .annot-layer').innerText")
            # ...close the notebook: talk's frames are the kept copies
            pg.evaluate("window.SemApp.deckClose();"
                        f"window.SemApp.closeNotebook('{fx['stem']}')")
            pg.wait_for_timeout(800)
            pg.evaluate("window.SemApp.deckOpen('talk')")
            pg.wait_for_timeout(600)
            assert "KEPT 0" in pg.evaluate(
                "document.querySelector('#deck .annot-layer').innerText")
            pg.keyboard.press("Control+s")
            pg.wait_for_timeout(1500)
            _same_copies(tmp_path, decks, "saved with the notebook closed")
            # ...and the file a person downloads carries them too
            txt = pg.evaluate("window.SemDeckFileHtml()")
            data = json.loads(txt.split('id="junoview-data">', 1)[1]
                              .split("</script>", 1)[0])
            fp = data["presentations"][0]
            # (no notebook is open now, so the refs keep their stem)
            assert fp["emb"] == decks[0]["emb"]
            assert errs == [], errs
            b.close()
    finally:
        srv.shutdown()
        srv.server_close()
