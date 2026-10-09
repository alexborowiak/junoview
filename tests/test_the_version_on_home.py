"""T621: the version on Home, with when it was last updated on hover.

The user, 2026-10-09: "be good to be able to see a version number on the
home page, maybe and then on hover a last updated so I can keep track of
this" -- after a morning of not being sure which build they were looking
at.

Beside the wordmark: "v0.2.0 · build 879", and over it "Last updated 9
Oct 2026 at 12:17 (commit 70c3964)". Only the app server and the web
build carry it: a rendered notebook's bytes must not depend on git.

Driven at 1366x657 against the app server: the pill sits on the
wordmark's line and its tooltip names the date and the commit.
"""

from __future__ import annotations

import pytest

from junoview import __version__, build_info
from junoview.render.page import render_page


@pytest.fixture
def fresh():
    build_info.build_info.cache_clear()
    build_info.build_badge.cache_clear()
    yield build_info
    build_info.build_info.cache_clear()
    build_info.build_badge.cache_clear()


def test_a_rendered_notebook_carries_no_stamp():
    page = render_page([], mode="static")
    assert '<div class="welcome-wordmark">Junoview</div>' in page
    assert 'class="welcome-ver"' not in page


@pytest.mark.parametrize("mode", ["app", "web"])
def test_the_app_and_the_web_build_carry_it_beside_the_name(mode):
    page = render_page([], mode=mode)
    word = page.split('<div class="welcome-wordmark">Junoview')[1] \
        .split("</div>")[0]
    assert word.startswith('<span class="welcome-ver" title="')
    assert f">v{__version__}" in word


def test_the_stamp_from_git(fresh, monkeypatch):
    answers = {
        "log": "70c3964aaaa 70c3964 2026-10-09T12:17:59+01:00",
        "rev-list": "879",
        "status": "",
    }
    seen = []

    def git(*args):
        seen.append(args)
        return answers[args[0]]

    monkeypatch.setattr(fresh, "_git", git)
    info = fresh.build_info()
    assert info == {"version": __version__, "build": "879",
                    "commit": "70c3964", "date": "2026-10-09T12:17:59+01:00"}
    # the PACKAGE's newest commit, and the history up to it -- never
    # HEAD, so a docs/ or test-only commit leaves the stamp alone
    assert seen[0] == ("log", "-1", "--format=%H %h %cI", "--", ".")
    assert seen[1] == ("rev-list", "--count", "70c3964aaaa")
    assert fresh.build_badge() == (
        '<span class="welcome-ver" title="Last updated 9 Oct 2026 at 12:17 '
        '(commit 70c3964)">v0.2.0 · build 879</span>')


def test_a_working_copy_says_it_has_uncommitted_changes(fresh, monkeypatch):
    answers = {"log": "f00 f00 2026-01-02T03:04:05+00:00", "rev-list": "12",
               "status": " M src/junoview/assets/css/app.css"}
    monkeypatch.setattr(fresh, "_git", lambda *a: answers[a[0]])
    assert fresh.build_info()["modified"] == "1"
    assert ("Last updated 2 Jan 2026 at 03:04 (commit f00, with changes "
            "not yet committed)") in fresh.build_badge()


def test_no_git_is_the_version_alone(fresh, monkeypatch, tmp_path):
    # a folder that is no repository, as an installed copy is
    monkeypatch.setattr(fresh, "_PKG", tmp_path)
    assert fresh.build_info() == {"version": __version__}
    badge = fresh.build_badge()
    assert f">v{__version__}</span>" in badge
    assert "no git history" in badge

    def boom(*a):
        raise NotImplementedError("no processes here")   # Pyodide

    build_info.build_info.cache_clear()
    monkeypatch.setattr(fresh, "_git", boom)
    assert fresh.build_info() == {"version": __version__}


def test_it_is_styled_as_a_quiet_pill():
    from junoview import assets
    css = assets.app_css()
    assert (".welcome-ver{display:inline-block;vertical-align:middle;"
            "margin-left:14px;") in css
    assert "font:500 12px/1.5 var(--sans);letter-spacing:0;color:var(--ink-3);" \
        in css
