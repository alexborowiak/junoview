"""T423: opening a plot trace no longer throws in the pager.

The plot-trace tab's section is built in code and has no data-sec, so
pageRuns took undefined for the run's title and threw on .replace --
which killed renderPagesBtn and everything after it in the activate
path the moment a trace opened. The id falls back to '', and an
unpaged tab no longer matches that empty id as "Page 1 of 1".

Driven on the example notebook: the pager read "Pages" before and
after opening a trace with no page error, and "Page 1 of 5" once the
notebook itself was paged.
"""

from __future__ import annotations

from junoview import assets


def test_a_section_without_an_id_is_an_empty_id():
    app = assets.app_js()
    runs = app.split("  function pageRuns(sh){")[1].split("\n  function ")[0]
    assert "      var l=+(s2.dataset.level||2),sid=s2.dataset.sec||'';" in runs


def test_an_unpaged_tab_is_not_on_a_page():
    app = assets.app_js()
    btn = app.split("  function renderPagesBtn(){")[1].split("\n  function ")[0]
    assert "    var i=pageBy[stem]?pageRunOf(runs,pageBy[stem]):-1;" in btn
    assert "pageRunOf(runs,pageBy[stem]||'')" not in btn
