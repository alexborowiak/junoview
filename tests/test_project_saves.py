"""Two windows on one project, and the guard that stops one eating the
other.

Every tab autosaves its ENTIRE view of every presentation 1.2s after each
keystroke. Before the revision check, that was a whole-array replace with
no version at all, so a second window left open on the same project
continuously overwrote the first: a deck created or renamed in tab A
vanished the moment tab B typed a character, and a delete in one tab was
resurrected by the other depending on typing order.

The guard shipped at 2026-08-22 with no test. That is the shape of thing
that loses a user's work while every other test stays green, and it is
pure Python -- no browser, no JS, no fixture bigger than a dict -- so
there was never a reason for it not to have one (T112).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from junoview.server.state import _PROJECT_FILE, StaleWrite, _AppState


def _deck(name: str) -> dict:
    return {"name": name, "slides": [{"annots": []}]}


def test_a_first_save_takes_and_bumps_the_revision(tmp_path: Path):
    st = _AppState(tmp_path)
    assert st.revision == 0
    assert st.save_presentations([_deck("a")], rev=0) == 1
    assert [p["name"] for p in st.presentations] == ["a"]


def test_a_stale_save_is_refused_rather_than_applied(tmp_path: Path):
    """The whole point: the second window must not win by being second."""
    st = _AppState(tmp_path)
    st.save_presentations([_deck("from tab A")], rev=0)

    with pytest.raises(StaleWrite):
        st.save_presentations([_deck("from tab B")], rev=0)

    assert [p["name"] for p in st.presentations] == ["from tab A"]
    assert st.revision == 1


def test_the_refusal_carries_what_is_actually_stored(tmp_path: Path):
    """A 409 that only said "no" would leave the client with nothing to
    merge against, so the exception hands back the current revision and
    the current presentations -- which is exactly what the route puts in
    the body."""
    st = _AppState(tmp_path)
    st.save_presentations([_deck("winner")], rev=0)

    with pytest.raises(StaleWrite) as caught:
        st.save_presentations([_deck("loser")], rev=0)

    assert caught.value.revision == 1
    assert [p["name"] for p in caught.value.presentations] == ["winner"]
    assert "stale write" in str(caught.value)


def test_a_client_that_re_reads_can_then_write(tmp_path: Path):
    """The recovery path. Refusing forever would be its own bug."""
    st = _AppState(tmp_path)
    st.save_presentations([_deck("a")], rev=0)
    with pytest.raises(StaleWrite) as caught:
        st.save_presentations([_deck("b")], rev=0)
    assert st.save_presentations([_deck("b")], rev=caught.value.revision) == 2
    assert [p["name"] for p in st.presentations] == ["b"]


def test_a_page_that_never_reloaded_still_saves(tmp_path: Path):
    """`rev` absent means "do not check", deliberately: an older page
    still sitting in a tab kept its previous behaviour rather than being
    broken by the fix."""
    st = _AppState(tmp_path)
    st.save_presentations([_deck("a")], rev=0)
    assert st.save_presentations([_deck("b")], rev=None) == 2
    assert [p["name"] for p in st.presentations] == ["b"]


def test_every_accepted_write_reaches_the_project_file(tmp_path: Path):
    """And a refused one does not. The file is the thing that survives a
    restart, so a guard that only protected memory would protect
    nothing."""
    st = _AppState(tmp_path)
    st.save_presentations([_deck("kept")], rev=0)
    with pytest.raises(StaleWrite):
        st.save_presentations([_deck("dropped")], rev=0)

    saved = json.loads((tmp_path / _PROJECT_FILE).read_text(encoding="utf-8"))
    names = [p["name"] for p in saved.get("presentations", [])]
    assert names == ["kept"]


def test_the_revision_survives_nothing_but_the_process(tmp_path: Path):
    """The revision is per-run session state, not a file field: two
    windows of ONE app are what it arbitrates, and a restart has no other
    window to disagree with. Pinned because reading it back would look
    like an improvement and would reject the first save after a restart.
    """
    st = _AppState(tmp_path)
    st.save_presentations([_deck("a")], rev=0)
    assert st.revision == 1

    again = _AppState(tmp_path)
    assert again.revision == 0
    assert [p["name"] for p in again.presentations] == ["a"]
    assert again.save_presentations([_deck("b")], rev=0) == 1


def test_the_route_answers_409_and_hands_the_merge_material_back():
    """The wire half, read rather than driven.

    The /api/save branch is four lines inline in do_POST, which needs a
    live socket to call; extracting it purely to test it would be a
    refactor this task did not ask for. So this pins the shape instead
    and says so: a 409 rather than a silent overwrite, carrying `rev` and
    `presentations`, and `rev` absent meaning "do not check". The
    BEHAVIOUR those four lines wrap is covered above, against the real
    object.
    """
    src = (Path(__file__).resolve().parent.parent / "src" / "junoview"
           / "server" / "routes.py").read_text(encoding="utf-8")
    assert "except StaleWrite as stale:" in src
    assert ('{"error": "stale", "rev": stale.revision,' in src
            and '"presentations": stale.presentations}' in src)
    assert "409" in src
    assert "rev if isinstance(rev, int) else None" in src
