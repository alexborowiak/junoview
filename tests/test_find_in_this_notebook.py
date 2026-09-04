"""Find in this notebook, with the matches highlighted (T244).

The user, 2026-09-04: "Also would be good for a search feature, and
also for the types of variables thing, that it gets highlighted."

Nothing looked inside a notebook's content: the rail's box finds
notebooks and decks by NAME, and the variables box filters names. The
browser's own Ctrl+F cannot see a folded cell or one a filter has
hidden, which is most of what this reader does.

Driven on the example notebook: Ctrl+F opened and focused the bar,
"blocking" found 23 matches with prev/next cycling; with Code set to Off
"matplotlib" still found its two hits, opened the code around the
current one and left everything as it was on close; and filtering the
variables by "bl" marked the matched letters in block_days, blob and
blocked.
"""

from __future__ import annotations

from junoview import assets


def test_there_is_a_find_button_and_a_bar():
    page = assets.load("html/page.html")
    assert 'id="doc-find"' in page
    for cid in ("docfind", "docfind-in", "docfind-n", "docfind-prev",
                "docfind-next", "docfind-x"):
        assert f'id="{cid}"' in page, cid


def test_it_searches_the_documents_own_text():
    app = assets.app_js()
    assert "  function findMark(root,term){" in app
    assert "    var walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{" in app
    # never inside a script, a style or an input
    assert ("  var FIND_SKIP={SCRIPT:1,STYLE:1,SVG:1,CANVAS:1,TEXTAREA:1,"
            "INPUT:1};") in app
    # ...and never inside a mark it has already made
    assert ("          if(p2.classList&&p2.classList.contains('jv-hit'))\n"
            "            return NodeFilter.FILTER_REJECT;") in app


def test_a_hit_opens_what_the_filters_folded_around_it():
    """This is the thing the browser's own Ctrl+F cannot do."""
    app = assets.app_js()
    assert "      card.classList.add('jv-hitcard','expanded');" in app
    assert "      card.classList.remove('is-hidden');" in app
    assert "          n.classList.add('jv-hitopen');});" in app
    css = assets.load("css/app.css")
    assert ".jv-hitopen{display:revert!important;}" in css
    # ...and closing puts every one of them back
    assert "      $$('.jv-hitopen').forEach(function(n){" in app
    assert "  function findClear(){" in app
    assert "      p2.replaceChild(document.createTextNode(m.textContent),m);" in app


def test_the_current_match_is_the_one_you_can_see():
    app = assets.app_js()
    assert "    m.scrollIntoView({block:'center',behavior:'smooth'});" in app
    assert "    if(nEl) nEl.textContent=(findAt+1)+' / '+findHits.length;" in app
    css = assets.load("css/app.css")
    assert "mark.jv-hit{background:color-mix(in srgb," in css
    assert "mark.jv-hit.on{background:var(--amber,#f0a848);color:#16202b;" in css


def test_ctrl_f_opens_it_unless_the_deck_owns_the_window():
    app = assets.app_js()
    assert "      if(!(e.ctrlKey||e.metaKey)||e.key!=='f') return;" in app
    assert "      if(document.body.classList.contains('deck-open')) return;" in app
    assert ("        if(e.key==='Enter'){e.preventDefault();"
            "findGo(e.shiftKey?-1:1);}") in app


def test_the_variables_filter_says_which_part_matched():
    """A filtered list of names that all contain the same three letters
    is a list you still have to read one by one."""
    app = assets.app_js()
    assert "          var nm=r.querySelector('.var-name');" in app
    assert "            var raw=nm.dataset.raw||nm.textContent;" in app
    assert "              mk.className='jv-hit';" in app
    # ...and clearing the box puts the whole name back
    assert "            } else nm.textContent=raw;" in app
