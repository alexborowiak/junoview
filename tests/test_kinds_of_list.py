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


def test_the_paragraph_carries_the_kind_and_the_css_draws_it(out):
    """T623: the kind rides on each PARAGRAPH (data-list), and the
    browser's own list-style-type draws it -- one table, PARA_LST, for
    every kind, so the dot, the ring and the square are the shapes every
    list here has always had."""
    assert "  var PARA_LST={bullet:'disc',circle:'circle',square:'square'," \
        in out
    lst = out.split("  var PARA_LST={")[1].split("};")[0]
    for kind in ("dash", "arrow", "check", "number", "paren", "alpha",
                 "alpha-upper", "roman", "roman-upper"):
        assert (kind + ":" in lst) or ("'" + kind + "':" in lst), kind
    assert "dash:'\"\\u2013\\u00a0\"'" in lst
    assert "'alpha-upper':'upper-alpha'" in lst
    assert "css+='list-style-type:'+PARA_LST[m.k]+';';" in out
    # a closing bracket is the one shape the built-in styles cannot say: a
    # counter style of its own, which counts on as the paragraphs do (a
    # ::marker's counter() showed only a number the paragraph carried)
    assert "number:'decimal',paren:'jv-paren'," in lst
    assert '@counter-style jv-paren{system:extends decimal;suffix:") ";}' \
        in out
    assert 'content:counter(list-item) ")' not in out


def test_switching_kind_rewrites_no_content(out):
    """THE LATENT BUG T227 FIXED. Going from bullets to numbering ran the
    content through contentLines, which flattened every nested level.
    T623: a kind is a paragraph's attribute, so switching it touches the
    attribute and nothing else -- the words and the level stay."""
    fn = out.split("  function paraListSet(p,kind){")[1].split("\n  }\n")[0]
    assert "p.h" not in fn and "p.lvl=" not in fn


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
    # picking a kind turns the list on as well -- for the paragraphs the
    # caret is in, or every paragraph of a selected box (T623)
    assert "              paraCmd(function(p){paraListSet(p,k[0]);});" in out
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
