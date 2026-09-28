"""Bullets belong to paragraphs, not to an entire text box (T513).

The old editor made the contenteditable element itself a ``ul``. Browsers
cannot split one item out of a root list, so pressing Bullets on the middle
paragraph necessarily changed the whole box. A neutral editable wrapper lets
the browser keep ``ul / plain paragraph / ul`` as ordinary rich text.
"""

from __future__ import annotations

from junoview import assets


def test_a_box_wide_list_gets_a_neutral_editor_wrapper(out):
    assert "tx2.dataset.list=lst;" in out
    assert "listTx.classList.remove('an-tx');" in out
    assert "tx2.className='an-tx an-list-edit';" in out
    assert "tx2.appendChild(listTx);" in out
    # Playback and export retain the lean root list representation.
    assert "tx2=document.createElement(listIsOrdered(lst)?'ol':'ul');" in out


def test_the_list_button_edits_the_caret_paragraph(out):
    fn = out.split("  function listSelection(style){", 1)[1].split(
        "\n  function colorSelection", 1
    )[0]
    assert "classList.contains('an-ul')" not in fn
    assert "var live=caretList(el);" in fn
    assert "live.setAttribute('data-list',style);" in fn
    assert "if(listOf(a)) delete a.list;" in fn


def test_mixed_lists_round_trip_with_their_marker_kind(out):
    assert "function listEditBody(html){" in out
    assert "if(body===null) delete a.list; else r.html=body;" in out
    assert "} else delete a.list;" in out
    assert "n.setAttribute('data-list',listStyle);" in out
    assert "listIsOrdered(listStyle)===(tag==='ol')" in out

    css = assets.deck_css()
    assert '.an-tx>ul,.an-tx>ol{margin:.18em 0;padding-left:1.7em;}' in css
    assert '.an-tx ul[data-list="square"]{list-style-type:square;}' in css
    assert ('.an-tx ol[data-list="paren"]>li::marker'
            '{content:counter(list-item) ") ";}') in css


def test_indent_follows_the_list_under_the_caret(out):
    assert "function caretList(el){" in out
    assert "if(e.key==='Tab'&&caretList(el)){" in out
    assert "if(!el||!caretList(el)){" in out
