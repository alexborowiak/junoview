"""Kinds of bullet, kinds of numbering (T227).

The user, 2026-09-03: "There are no different types of bullet points,
and different lists."

There were two: a filled disc and 1. 2. 3. The machinery never needed
more than a word -- `a.list` holds the style NAME, the rendered element
carries it as a class, and the content is only the items -- so each kind
is one table entry and one CSS rule, and switching between them rewrites
nothing.

Driven in a browser: Arrow gave `<ul class="an-tx an-ul an-ul-arrow">`
with the marker "> ", and picking upper roman turned the same list into
an `<ol class="an-ul-roman-upper">` with no change to the words.
"""

from __future__ import annotations

from junoview import assets


def test_twelve_kinds_from_one_table(out):
    assert "  var LIST_KINDS=[" in out
    for kind in ("bullet", "circle", "square", "dash", "arrow", "check",
                 "number", "paren", "alpha", "alpha-upper", "roman",
                 "roman-upper"):
        assert f"['{kind}'," in out, kind
    assert "  function listKind(id){" in out
    assert "  function listIsOrdered(id){" in out
    # the marker the picker draws is the marker the page draws
    assert "  function listMarker(id,n){" in out
    assert "    if(id==='roman') return ['i','ii','iii'][n-1]+tail;" in out


def test_the_element_carries_the_kind_and_the_css_draws_it(out):
    assert "          tx2=document.createElement(listIsOrdered(lst)?'ol':'ul');" in out
    assert "          tx2.className='an-tx an-ul an-ul-'+lst;" in out
    for rule in ('ul.an-ul.an-ul-circle{list-style-type:circle;}',
                 'ul.an-ul.an-ul-square{list-style-type:square;}',
                 'ul.an-ul.an-ul-dash{list-style-type:"\\2013\\00a0";}',
                 'ul.an-ul.an-ul-arrow{list-style-type:"\\25b8\\00a0";}',
                 'ul.an-ul.an-ul-check{list-style-type:"\\2713\\00a0";}',
                 'ol.an-ul.an-ul-alpha{list-style-type:lower-alpha;}',
                 'ol.an-ul.an-ul-roman-upper{list-style-type:upper-roman;}'):
        assert rule in out, rule
    # a closing bracket is the one shape list-style-type cannot say
    assert 'ol.an-ul.an-ul-paren>li::marker{content:counter(list-item) ") ";}' in out
    # the families keep their old defaults, so an existing deck is unchanged
    assert "ul.an-ul{list-style:disc;}" in out
    assert "ol.an-ul{list-style:decimal;}" in out


def test_switching_kind_rewrites_no_content(out):
    """THE LATENT BUG THIS ROUND FIXED. Going from bullets to numbering
    ran the content through contentLines, which flattens every nested
    level -- so a two-level list came back as one. Both being lists, only
    the word changes."""
    assert "    if(was&&style){a.list=style;return;}" in out


def test_an_unknown_kind_still_draws_a_list(out):
    """A deck written by a later build must not come back with its lists
    turned into plain text."""
    assert "    if(v&&!listKind(v)) v=(v==='number')?'number':'bullet';" in out


def test_each_button_is_a_split_control(out):
    """The button turns the list on with the kind you last chose; the
    caret opens the kinds, each drawn as three lines with its marker."""
    html = assets.deck_html()
    for cid in ("fmt-bulletswrap", "fmt-bullets-caret", "fmt-bullets-menu",
                "fmt-numberswrap", "fmt-numbers-caret", "fmt-numbers-menu"):
        assert f'id="{cid}"' in html, cid
    assert 'class="sh-drop tx-split" id="fmt-bulletswrap"' in html
    assert "  var lastBullet='bullet',lastNumber='number';" in out
    assert "  onBtn('#fmt-bullets',function(){listApply(lastBullet);});" in out
    assert "  function listGalleryBoot(){" in out
    assert "  listGalleryBoot();" in out
    # the doors are wired with literal id strings, as the contract insists
    assert "wireMenuToggle('fmt-bulletswrap','fmt-bullets-caret'," in out
    assert "wireMenuToggle('fmt-numberswrap','fmt-numbers-caret'," in out
    # picking a kind turns the list on as well
    assert "                setListStyle(a,k[0]);" in out
    assert "  function listGallerySync(lst){" in out


def test_the_wrappers_are_governed_or_the_control_collapses(out):
    """The deselect sweep hides every governed id that is not inside
    another governed one. An unlisted wrapper meant a hidden caret, and a
    hidden caret takes the whole split control down through the
    :has(>.dbtn[hidden]) rule. Caught in a browser, not by a string."""
    assert "    show('#fmt-bulletswrap',isText&&isNum);" in out
    assert "    show('#fmt-numberswrap',isText&&isNum);" in out
    assert "+'#fmt-bulletswrap #fmt-bullets-caret #fmt-bullets-menu '" in out
    assert "+'#fmt-numberswrap #fmt-numbers-caret #fmt-numbers-menu '" in out
