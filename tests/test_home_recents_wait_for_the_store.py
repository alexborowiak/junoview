"""T449: Home's Recent presentations is painted again once the drafts land.

The user's screenshot, 2026-09-14: "No recent presentations" on Home
while the library dialog's Recent column listed seven. Home is painted
before the IndexedDB draft store (T429) has answered, and the recent
list drops every name it cannot find yet; the library re-rendered
after the load and Home did not. It does now.
"""

from __future__ import annotations


def test_home_is_repainted_after_the_drafts_load(out):
    fn = out.split("    draftsLoadDb().then(function(fresh){")[1].split("\n    });")[0]
    assert ("      if(typeof renderPresentationHub==='function') "
            "renderPresentationHub();") in fn
    assert "      if(APP.refreshChrome) APP.refreshChrome();" in fn
