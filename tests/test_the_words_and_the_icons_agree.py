"""The words and the icons say the same thing everywhere (T262).

A sweep of the audit's copy and icon findings, plus one measured
layout fault. Small each; the point is that the UI stops contradicting
itself.

* **The filters said one thing and showed another.** The buttons read
  On / Fold / Off (`CODE_LABEL`, and what `setTvBtn` writes), while
  every tooltip, the help page and the tour said "Visible ->
  Collapsed -> Hidden". Standardised on the words the buttons actually
  show. Only display strings changed: the stored state values stay
  'visible'/'collapsed'/'hidden', because saved layouts depend on them.
* **Auto-hide wore the pin icon** on the present bar, while the other
  three Auto-hide controls use `autohide` -- and the comment beside the
  rail pair says outright "Neither is 'pin' -- nothing is being
  pinned". This page also has a real pin on every card that means
  something else entirely.
* **"GitHub" was a raw arrow glyph** in a row of `bic()` icons, two
  lines under a comment saying the labels carry a bic() icon.
* **The Tree toolbar called a cell a "node"** in three tooltips, with
  its own neighbour in the same group saying "cell".
* **Five reload buttons, four verbs.** The three full-screen scan views
  said "Check again", "Check again" and "Look again"; the picture list
  said "Read again" for a job that is not a check at all.
* **Ctrl+F was real but advertised nowhere** -- no chip on the button,
  no row in Help.
* **The rail's Auto-hide wrapped to two lines.** `#pr-auto` was pinned
  to a 34px box, which is right for an icon-only button and wrong for
  one carrying the word "Auto-hide": it came out as "Auto-" / "hide"
  beside a Collapse button three times its width. Driven at 1440x900
  before: 34px and 2 lines. After: both 163px, one line each.
"""

from __future__ import annotations

from junoview import assets


def test_the_filters_are_described_in_the_words_they_show():
    page = assets.load("html/page.html")
    helpdoc = assets.load("html/help.html")
    app = assets.app_js()
    # the buttons' own vocabulary, unchanged
    assert ("  var CODE_LABEL={visible:'On',collapsed:'Fold',hidden:'Off',"
            in app)
    for text in (page, helpdoc):
        assert "Visible -> Collapsed -> Hidden" not in text
        assert "Visible &rarr; Collapsed &rarr; Hidden" not in text
    assert "Click to cycle: On -> Fold -> Off" in page
    assert "On &rarr; Fold &rarr; Off" in helpdoc
    assert "Visible → " not in app.split("TOUR")[-1]
    # the STORED values are untouched -- saved layouts depend on them
    assert "if(v==='visible'||v==='collapsed'||v==='hidden') return v;" in app


def test_auto_hide_wears_the_auto_hide_icon():
    page = assets.load("html/page.html")
    btn = page.split('id="pb-auto"')[1].split("</button>")[0]
    assert 'data-ic="autohide"' in btn
    assert 'data-ic="pin"' not in btn
    # the other three agree, and always did
    assert page.count('data-ic="autohide"') >= 3


def test_github_uses_the_icon_set_like_its_neighbours():
    app = assets.app_js()
    assert "↗ GitHub" not in app
    assert "act(bic('link')+' GitHub'," in app
    # its neighbours in the same list
    assert "act(bic('history')+' Version history…'" in app


def test_the_tree_toolbar_calls_a_cell_a_cell():
    page = assets.load("html/page.html")
    tree = page.split('id="ab-tree"')[1].split('id="ab-size"')[0]
    assert "node" not in tree, tree[:400]
    assert "Expand every cell" in tree
    assert "Collapse every cell back to its title" in tree


def test_the_scan_panels_use_one_verb():
    deck = assets.load("html/deck.html")
    assert "Look again" not in deck
    assert "Read again" not in deck
    # ...and the one that is a different job says what that job is
    assert "Update this list" in deck


def test_ctrl_f_is_advertised_where_the_others_are():
    app = assets.app_js()
    assert "    if(b) b.dataset.kbd='Ctrl+F';" in app
    helpdoc = assets.load("html/help.html")
    assert "<kbd>Ctrl</kbd>+<kbd>F</kbd>" in helpdoc
    # the binding itself is unchanged -- one handler, one advertisement
    assert "      if(!(e.ctrlKey||e.metaKey)||e.key!=='f') return;" in app


def test_a_worded_rail_button_gets_a_row_of_its_own():
    css = assets.load("css/app.css")
    assert (".pr-foot{margin-top:auto;display:flex;flex-direction:column;"
            "gap:6px;\n  align-items:stretch;}") in css
    # the 34px box that squeezed "Auto-hide" into two lines is gone
    assert ".pr-foot #pr-auto{flex:none;width:34px;" not in css
    page = assets.load("html/page.html")
    foot = page.split('class="pr-foot"')[1].split("</div>")[0]
    for word in ("Collapse", "Auto-hide"):
        assert word in foot
    assert foot.count("data-ic=") == 2
