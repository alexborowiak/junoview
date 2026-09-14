"""T247: Find follows the notebook you switch to.

The bar, its count and findHits survived a tab switch, so Next and
Previous walked matches in the now-hidden shell and the count described
a document you could not see. The term is re-run against the newly
active document on every activate.

Driven with two notebooks open: "blocking" read 1 / 23 on the climate
notebook; switching to the widget notebook read 1 / 18 with all 18
marks in the visible shell and none left in the hidden one; "widget"
there read 1 / 2; switching back read "nothing found".
"""

from __future__ import annotations

from junoview import assets


def test_activating_a_tab_reruns_an_open_find():
    app = assets.load("js/app.js")
    assert ("    document.addEventListener('sem:activate',function(){\n"
            "      var bar=$('#docfind');\n"
            "      if(!bar||bar.hidden) return;\n"
            "      findRun(((inp&&inp.value)||'').trim());\n"
            "    });") in app


def test_the_rerun_marks_the_visible_shell_and_clears_the_rest():
    app = assets.load("js/app.js")
    run = app.split("  function findRun(term){")[1].split("\n  function ")[0]
    # clears first -- wherever the old marks are -- then marks the shell
    # that is showing
    assert run.index("findClear();") < run.index(
        "document.querySelector('.nbshell:not([hidden]) .content')")
    clear = app.split("  function findClear(){")[1].split("\n  function ")[0]
    assert "$$('mark.jv-doc')" in clear
