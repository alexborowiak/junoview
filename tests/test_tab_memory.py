"""What the editor remembers, and what its words say (T192-T194).

The user, sixth review of 2026-09-02: "if you are on insert tab, and
you click on an object then unclick it should go back to insert. When
adding a new slide, when click add new it should remember the last one
you added. The default slide choice should be the panel, title, text...
how things like 'standardise' works. I find the text and how it looks
confusing."
"""

from __future__ import annotations


def test_deselecting_returns_to_the_tab_the_selection_took_you_from(out):
    """T192. The selection carries you to Object; when it goes, the
    ribbon used to fall to Home. It goes back to the tab you left, if
    that tab still has anything on it."""
    assert "var tabBeforeSel='';" in out
    assert "if(wantTab) tabBeforeSel=activeTab();" in out
    assert "if(tabBeforeSel&&tabHasContent(tabBeforeSel)) to=tabBeforeSel;" in out
    # used once, then forgotten: a tab you changed to on purpose while
    # something was selected is where you stay
    i = out.index("if(tabBeforeSel&&tabHasContent(tabBeforeSel)) to=tabBeforeSel;")
    assert "tabBeforeSel='';" in out[i:i + 200]


def test_new_slide_takes_the_layout_you_last_chose(out):
    """T193. Picking a layout remembers it per project; New slide applies
    it; a deck that never picked one starts with a title, a panel and
    text. Blank is one pick away. Poster templates are pages, not
    slides, and are not remembered."""
    assert "function newLayKey(){return 'jv-deck-newlay:'+SCOPE;}" in out
    assert "function layoutById(id){" in out
    assert "var lay=layoutById(lsGet(newLayKey())||'cell-text');" in out
    assert "if(lay&&!lay.poster) applyLayout(ns,lay);" in out
    assert "if(!layout.poster) lsSet(newLayKey(),layout.id);" in out
    # the two layouts that carried a title without saying so
    assert "{id:'cell-text',label:'Title + panel + text',items:[" in out
    assert "{id:'text-cell',label:'Title + text + panel',items:[" in out
    # a new slide is still born empty; the layout is applied on top
    assert "return {layout:'blank',panes:[],annots:[]};" in out


def test_the_words_on_the_tabs_say_what_happens(out):
    """T194. A pass over the tooltips and menu rows against one test:
    would a first-time reader know what happens when they press it?"""
    # the Layouts menus lose their private vocabulary
    assert "My saved layouts&#8230;" in out
    assert "Save this layout&#8230;" in out
    assert "Copy this layout to other slides&#8230;" in out
    assert "Arrangements&#8230;</button>" not in out
    # Standardise says what it checks, on the button and in the pane
    assert ('title="Find text that should match but does not '
            '&mdash; headings') in out or \
        'title="Find text that should match but does not — headings' in out
    assert '<div class="pf-intro">Text that should look the same but does' in out
    assert "<span>Standardise</span>" in out
    # masters, in one sentence, in all three places
    assert out.count("A background and a header or footer that many slides "
                     "share") == 3
    # the Source rows
    assert "Where it came from&#8230;" in out
    assert "Keep this exact figure even when the notebook is re-run" in out
