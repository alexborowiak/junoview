"""T532: "version" means one thing.

The 2026-09-29 audit counted four meanings of Version: a slide's
alternatives (T318, the user's word), a saved snapshot of the deck
(T225/T236, the user's word -- "Saved versions"), a poster's other pages,
and a named subset of the deck for a shorter talk (T24's "named cuts",
shown as Version). The last collided with the first on the same menu:
right-click a slide and "in these versions" sat two rows from "New
version of this slide". A named subset of the deck is PowerPoint's
Custom show now -- the Present tab's group, its door, its New button,
the Play menu, the slide menu, every toast and question, and the help
page. "Cut" was never an option: it is the clipboard's word.

Driven: the Present tab shows "Custom show ▾ / Every slide"; New custom
show… asks "A new custom show"; the slide menu reads "versions / New
version of this slide" and, lower down, "in these custom shows / ✓ 20-min".
"""

from __future__ import annotations


def test_the_present_tab_says_custom_show(out):
    assert '<span class="rbn-lab">Custom show</span>' in out
    assert "<span>New custom show&#8230;</span></button>" in out
    assert 'aria-label="Which custom show to play"' in out
    assert '<span class="rbn-lab">Version</span>' not in out


def test_every_word_about_a_subset_says_custom_show(out):
    for now in ("menuHead(m,'in these custom shows');",
                "hd.textContent='which custom show';",
                "nb.textContent='New custom show…';",
                "askText({title:'A new custom show',label:'Call it',",
                "toast('Custom show renamed to “'+v+'”');",
                "askText({title:'Name this custom show',value:old,",
                "ok:'Delete custom show',cancel:'Keep it',danger:true}",
                "String(name||'').trim()||'Short talk';"):
        assert now in out, now
    for gone in ("'in these versions'", "'which version'",
                 "'A new version of this deck'", "'Short version'"):
        assert gone not in out, gone


def test_the_slide_and_the_snapshot_keep_their_version(out):
    # the user's own words for the other two stay
    assert "'New version of this slide'" in out
    assert '<span class="rbn-lab">Saved versions</span>' in out
