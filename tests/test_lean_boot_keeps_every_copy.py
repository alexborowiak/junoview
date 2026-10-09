"""The app page boots without the saved decks' figure copies, and not one
copy is lost for it.

The owner, 2026-10-08: "if this is not able to load quick, and not be
laggy, then no matter how good the features are no one will ever use
this". The app page inlined every saved deck's ``emb`` in its boot JSON --
10 MB for an 18-deck project, the same figure once per deck -- and every
save, Open and Close re-encoded the whole project file. Now:

* the page carries the decks lean and the copies come from ``/api/emb``,
  each distinct one once (server/state.py ``emb_payload``);
* a save that changes nothing writes nothing, and a save re-encodes only
  the decks that changed (``_AppState._write``), byte for byte the file a
  single ``json.dumps`` writes;
* a self-contained write that is MISSING a copy its deck still shows
  keeps the stored one (``_keep_embedded``) -- the guard for any write
  made before the copies arrived.

The owner has lost work to saving before ("I have lost too many
things", 2026-09-05), so these tests build projects with real figure
copies, pictures and clips, run the new paths, and compare every copy
byte for byte.
"""

from __future__ import annotations

import copy
import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.notebook.presentations import as_presentations
from junoview.server.routes import _make_handler
from junoview.server.state import (
    _PROJECT_FILE,
    _app_page,
    _AppState,
    _keep_embedded,
    emb_payload,
)

ROOT = Path(__file__).resolve().parent.parent
PNG = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf"
       "FcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def _copy(i: int, big: int = 3000) -> dict:
    """A figure copy shaped like the editor's (title, kind, html, code)."""
    return {"title": f"Figure {i}", "kind": "figure",
            "html": f'<div class="cardbody"><img src="{PNG}"> '
                    + "x" * (big + i) + "</div>",
            "code": f'<div class="codeinner">plot({i})</div>'}


def _deck(name: str, refs: list[str], *, pictures: int = 0,
          clip: str | None = None) -> dict:
    slides = []
    for r in refs:
        slides.append({"layout": "blank", "annots": [
            {"k": "text", "x": 6, "y": 5, "w": 88, "text": f"{name} {r}"},
            {"k": "cell", "x": 6, "y": 20, "w": 50, "h": 60, "ref": r}]})
    for i in range(pictures):
        slides.append({"layout": "blank", "annots": [
            {"k": "image", "x": 10, "y": 10, "w": 50, "h": 50,
             "src": PNG + "A" * (9000 + i)}]})
    d: dict = {"name": name, "slides": slides,
               "emb": {r: _copy(int(r.split("f")[-1])) for r in refs}}
    if clip:
        slides.append({"layout": "blank", "annots": [
            {"k": "video", "x": 1, "y": 1, "w": 40, "h": 30, "vkey": clip}],
            "narr": {"vkey": clip + "n", "dur": 2}})
        d["media"] = {clip: {"src": "data:video/mp4;base64,AAAA" * 50,
                             "mime": "video/mp4", "name": "a.mp4"},
                      clip + "n": {"src": "data:audio/webm;base64,BB",
                                   "mime": "audio/webm", "name": "n.webm"}}
    return d


def _project(tmp_path: Path) -> list:
    """Six decks sharing figures, with pictures, clips and a collection."""
    decks = [
        _deck("talk", ["nb::f1", "nb::f2", "nb::f3"], pictures=2),
        _deck("poster", ["nb::f2", "other::f4"]),
        _deck("clips", ["nb::f1"], clip="med:c1"),
        _deck("closed", ["gone::f5", "gone::f6"]),
        _deck("plain", []),
    ]
    decks.append({"name": "gathered", "kind": "collection", "slides": [],
                  "items": [{"id": "a", "k": "cell", "ref": "nb::f3"},
                            {"id": "b", "k": "note", "md": "mine",
                             "under": [{"id": "c", "k": "cell",
                                        "ref": "nb::f7"}]}],
                  "emb": {"nb::f3": _copy(3), "nb::f7": _copy(7)}})
    decks = as_presentations(decks)
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [], "recent": []},
        indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return decks


def _reference_bytes(st: _AppState) -> str:
    return json.dumps({"presentations": st.presentations, "open": st.open,
                       "recent": st.recent}, indent=1,
                      ensure_ascii=False) + "\n"


def _rebuild(payload: dict) -> dict:
    """Every deck's emb/media as the editor reassembles them."""
    out = {}
    for d in payload["decks"]:
        out[d["name"]] = {
            "emb": {r: payload["snaps"][i] for r, i in
                    (d.get("emb") or {}).items()},
            "media": {k: payload["clips"][i] for k, i in
                      (d.get("media") or {}).items()}}
    return out


# ------------------------------------------------------------ the boot


def test_the_page_boots_lean_and_says_there_is_more(tmp_path):
    decks = _project(tmp_path)
    st = _AppState(tmp_path)
    page = _app_page(st)
    raw = page.split('id="app-data">', 1)[1].split("</script>", 1)[0]
    app = json.loads(raw.replace("<\\/", "</"))
    boot = app["project"]["presentations"]
    assert [p["name"] for p in boot] == [p["name"] for p in decks]
    assert not any("emb" in p or "media" in p for p in boot)
    assert app["project"]["lazyEmb"] == 1
    # the lean decks are the stored decks minus the copies, and nothing
    # else: slides (pictures inside them) ride as they are
    for p, q in zip(boot, decks, strict=True):
        assert p == {k: v for k, v in q.items() if k not in ("emb", "media")}
    # the stored decks themselves are untouched by building the page
    assert st.presentations == decks


def test_a_project_with_no_copies_has_nothing_to_fetch(tmp_path):
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": [{"name": "t", "slides": []}]}), encoding="utf-8")
    page = _app_page(_AppState(tmp_path))
    assert '"lazyEmb"' not in page


def test_every_copy_comes_back_once_and_byte_for_byte(tmp_path):
    decks = _project(tmp_path)
    st = _AppState(tmp_path)
    pay = emb_payload(st.presentations, st.revision)
    back = _rebuild(pay)
    for p in decks:
        got = back.get(p["name"], {"emb": {}, "media": {}})
        assert got["emb"] == p.get("emb", {}), p["name"]
        assert got["media"] == p.get("media", {}), p["name"]
    # each distinct copy is sent once: nb::f1..f3 are shared between decks
    sent = [json.dumps(s, sort_keys=True) for s in pay["snaps"]]
    assert len(sent) == len(set(sent))
    held = {json.dumps(e, sort_keys=True) for p in decks
            for e in (p.get("emb") or {}).values()}
    assert set(sent) == held
    # decks keep their order: the editor keeps the first copy it meets
    assert [d["name"] for d in pay["decks"]] == [
        p["name"] for p in decks if p.get("emb") or p.get("media")]


def test_a_hand_edited_copy_is_still_served():
    """A copy holding a list or an object (a hand-edited file) cannot be
    de-duplicated by content; it is sent as itself rather than failing
    the whole fetch, which would leave every figure without its copy."""
    odd = {"title": "t", "html": "<p>x</p>", "tags": ["a", "b"]}
    decks = [{"name": "a", "slides": [], "emb": {"nb::f": odd,
                                                  "nb::g": {"html": "y"}}},
             {"name": "b", "slides": [], "emb": {"nb::g": {"html": "y"}},
              "media": {"v": {"src": "data:video/mp4;base64,AA", "m": {}}}}]
    pay = emb_payload(decks, 3)
    back = _rebuild(pay)
    assert back["a"]["emb"] == decks[0]["emb"]
    assert back["b"]["emb"] == decks[1]["emb"]
    assert back["b"]["media"] == decks[1]["media"]
    assert len(pay["snaps"]) == 2          # the plain copy, once


def test_the_endpoint_serves_them_over_http(tmp_path):
    decks = _project(tmp_path)
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    try:
        base = f"http://127.0.0.1:{srv.server_address[1]}"
        with urllib.request.urlopen(f"{base}/api/emb?t={st.token}") as r:
            pay = json.loads(r.read().decode("utf-8"))
            assert "no-store" in r.headers.get("Cache-Control", "")
        back = _rebuild(pay)
        assert back["talk"]["emb"] == decks[0]["emb"]
        assert back["clips"]["media"] == decks[2]["media"]
        with pytest.raises(urllib.error.HTTPError) as no:
            urllib.request.urlopen(f"{base}/api/emb?t=wrong")
        assert no.value.code == 403
    finally:
        srv.shutdown()
        srv.server_close()


# ------------------------------------------------------------ the writes


def _save(st: _AppState, decks: list, rev: int | None = None) -> int:
    return st.save_presentations(as_presentations(copy.deepcopy(decks)),
                                 st.revision if rev is None else rev)


def _lean(decks: list) -> list:
    return [{k: v for k, v in p.items() if k not in ("emb", "media")}
            for p in decks]


def test_a_lean_save_of_every_deck_keeps_every_copy(tmp_path):
    decks = _project(tmp_path)
    st = _AppState(tmp_path)
    edited = _lean(decks)
    edited[0]["slides"][0]["annots"][0]["text"] = "changed"
    _save(st, edited)
    on_disk = json.loads((tmp_path / _PROJECT_FILE).read_text("utf-8"))
    for p, q in zip(on_disk["presentations"], decks, strict=True):
        assert p.get("emb") == q.get("emb") and p.get("media") == q.get("media")
    assert on_disk["presentations"][0]["slides"][0]["annots"][0]["text"] \
        == "changed"
    # every picture rides inside its slide, byte for byte
    assert on_disk["presentations"][0]["slides"][3:] == decks[0]["slides"][3:]


def test_the_idle_consolidation_of_one_deck_keeps_the_others(tmp_path):
    """The editor now re-sends only the decks the file may not hold as it
    would write them; the rest go lean and the server keeps theirs."""
    decks = _project(tmp_path)
    st = _AppState(tmp_path)
    body = _lean(decks)
    body[1] = copy.deepcopy(decks[1])          # the one deck sent whole
    body[1]["slides"].append({"layout": "blank", "annots": []})
    _save(st, body)
    on_disk = json.loads((tmp_path / _PROJECT_FILE).read_text("utf-8"))
    for p, q in zip(on_disk["presentations"], decks, strict=True):
        assert p.get("emb") == q.get("emb"), p["name"]
        assert p.get("media") == q.get("media"), p["name"]


def test_a_write_missing_a_copy_its_deck_shows_keeps_the_stored_one():
    """The guard for a self-contained write made before the copies came:
    it carries only what the open notebooks could give."""
    old = as_presentations([_deck("talk", ["nb::f1", "nb::f2"],
                                  clip="med:x")])
    partial = copy.deepcopy(old)
    partial[0]["emb"] = {"nb::f1": _copy(11)}   # f1 refreshed, f2 missing
    partial[0]["media"] = {"med:x": old[0]["media"]["med:x"]}
    got = _keep_embedded(old, partial)[0]
    assert got["emb"]["nb::f1"] == _copy(11), "a refreshed copy still wins"
    assert got["emb"]["nb::f2"] == old[0]["emb"]["nb::f2"]
    assert got["media"]["med:xn"] == old[0]["media"]["med:xn"]


def test_a_figure_taken_off_the_deck_goes_with_its_copy():
    old = as_presentations([_deck("talk", ["nb::f1", "nb::f2"])])
    new = copy.deepcopy(old)
    new[0]["slides"] = new[0]["slides"][:1]            # f2 removed
    new[0]["emb"] = {"nb::f1": old[0]["emb"]["nb::f1"]}
    got = _keep_embedded(old, new)[0]
    assert set(got["emb"]) == {"nb::f1"}


def test_the_guard_reads_every_place_a_ref_lives():
    from junoview.server.state import _placed_clips, _placed_refs
    deck = {"slides": [
        {"panes": ["p::1", None], "annots": [
            {"k": "cell", "ref": "c::1"},
            {"k": "flip", "frames": [{"ref": "f::1"}, {"ref": "f::2"}, 3]},
            {"k": "video", "vkey": "med:v"}, "junk"],
         "narr": {"vkey": "med:n"}}, "junk"],
        "items": [{"ref": "i::1", "under": [{"ref": "u::1"}, 7]}, 1]}
    assert _placed_refs(deck) == {"p::1", "c::1", "f::1", "f::2", "i::1",
                                  "u::1"}
    assert _placed_clips(deck) == {"med:v", "med:n"}


def test_a_save_that_changes_nothing_writes_nothing(tmp_path, monkeypatch):
    decks = _project(tmp_path)
    st = _AppState(tmp_path)
    rev = _save(st, _lean(decks))
    assert rev == 0, "the stored decks again, lean: nothing to write"
    writes = []
    import junoview.server.state as state_mod
    real = state_mod.write_text
    monkeypatch.setattr(state_mod, "write_text",
                        lambda p, t: (writes.append(p), real(p, t)))
    assert _save(st, _lean(decks)) == 0 and not writes
    changed = _lean(decks)
    changed[4]["slides"] = [{"layout": "blank", "annots": []}]
    assert _save(st, changed) == 1 and len(writes) == 1
    # the stale-write guard is untouched by the skip
    from junoview.server.state import StaleWrite
    with pytest.raises(StaleWrite):
        st.save_presentations(as_presentations(changed), 0)


def test_the_project_file_is_byte_identical(tmp_path):
    """_write reuses each unchanged deck's encoded text; the file must be
    exactly what one json.dumps of the whole would write, through every
    kind of write -- and read back equal."""
    decks = _project(tmp_path)
    st = _AppState(tmp_path)
    path = tmp_path / _PROJECT_FILE

    def same():
        assert path.read_text("utf-8") == _reference_bytes(st)
    st.note_open(str(tmp_path / "a.ipynb"))
    same()
    body = _lean(decks)
    body[0]["name"] = "tälk \U0001f4c2"               # a rename, unicode
    _save(st, body)
    same()
    st.note_open(str(tmp_path / "b.ipynb"))
    st.note_close(str(tmp_path / "a.ipynb"))
    same()
    body2 = copy.deepcopy(body)
    body2.insert(1, {"name": "new", "slides": []})
    _save(st, body2)
    same()
    _save(st, body2[2:])                               # decks deleted
    same()
    _save(st, [])
    same()
    again = _AppState(tmp_path)
    assert again.presentations == st.presentations


def test_an_older_project_file_still_boots_lean(tmp_path):
    decks = as_presentations([_deck("talk", ["nb::f1"])])
    (tmp_path / "semantic_project.json").write_text(json.dumps(
        {"presentations": decks}), encoding="utf-8")
    st = _AppState(tmp_path)
    page = _app_page(st)
    assert '"lazyEmb": 1' in page
    assert _rebuild(emb_payload(st.presentations, 0))["talk"]["emb"] \
        == decks[0]["emb"]


# ------------------------------------------------------------ the editor


def _deck_js() -> str:
    from junoview import assets
    return assets.deck_js()


def test_every_self_contained_write_fetches_the_copies_first():
    js = _deck_js()
    body = js.split("  function embedAssets(list,opts){", 1)[1]
    head = body.split("list.forEach", 1)[0]
    assert "embEnsure()" in head and "opts.project" in head
    # every reader of a copy goes through embKey, which fetches them
    key = js.split("  function embKey(ref){", 1)[1].split("\n  }", 1)[0]
    assert "embEnsure()" in key
    # ...and the three project writers say they are project writes
    assert js.count("{project:1}") >= 3
    # the boot itself never fetches; the boot sequence opens the door
    boot = (ROOT / "src" / "junoview" / "assets" / "js" / "deck"
            / "99-boot.js").read_text(encoding="utf-8")
    assert boot.index("embBootDone=true;") < boot.index("handoffBoot();")
    assert "embSettled.then(embRehydrate);" in boot


def test_the_indexeddb_copy_waits_for_the_read_back():
    js = _deck_js()
    soon = js.split("  function embSaveSoon(){", 1)[1].split("\n  }", 1)[0]
    assert "embIdbDone.then" in soon
    assert "embIdbSettle(true)" in js
