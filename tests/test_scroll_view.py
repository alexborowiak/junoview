"""T622: the scroll view -- every slide one under the next, while editing.

The user, 2026-10-09: "the infinite scroll is only a present thing, like
I want it as a view when just creating slides as well. Like that is
better when creating slides too."

View > Scroll view. The slide you are on is the real, editable page, in
its place in the column; every other slide is a picture of itself drawn
by the export's renderer at the same size. Scrolling makes the slide in
the middle the one you edit; a click on a picture edits that slide, with
what was clicked selected.

Driven headless at 1366x657 on a six-slide deck (one slide white, the
rest dark): six pages and five lines; scrolling walked slides 3, 4, 5;
a click on slide 2's title made slide 2 live with its title selected;
the white slide's picture and live page both drew dark words while the
deck stayed unlit; a title grown with A+ on slide 1 showed grown in its
picture once slide 1 was left; New slide, Delete and Undo kept the column
and the count in step with the live page in view; zooming out resized
every picture with the page; Layers narrowed the column clear of the
pane; Present showed no pictures and Escape brought the column back.
"""

from __future__ import annotations

import re

from junoview import assets

PART = assets.load("js/deck/54b-scroll-view.js")


def test_it_is_a_listed_part_with_a_boot_call(out):
    assert "54b-scroll-view" in assets.DECK_PARTS
    i = assets.DECK_PARTS.index("54b-scroll-view")
    assert assets.DECK_PARTS[i - 1] == "54-scroll-show"
    assert "  scrollViewBoot();" in out
    assert "})();" not in PART


def test_two_tiles_on_view_and_in_its_folded_menu(out):
    view = out.split('class="rbn-grp rbn-fixed rbn-view"')[1] \
        .split('<span class="rbn-lab">View</span>')[0]
    assert view.index('id="vw-sorter"') < view.index('id="vw-scroll"') \
        < view.index('id="vw-scroll-lines"') < view.index('id="vw-rulers"')
    assert '<i data-ic="scrollview"></i> Scroll view</button>' in assets.deck_html()
    assert "    ['vw-scroll','Scroll view'],['vw-scroll-lines',null],   /* T622 */" \
        in out
    # the lines tile is named in full in the folded menu
    assert "o.textContent=p[1]||(real.getAttribute('aria-label')" in out
    # every ribbon layout places both, right after the sorter
    assert out.count("'vw-sorter','vw-scroll','vw-scroll-lines',") == 8
    assert "'vw-sorter','vw-rulers'" not in out


def test_the_live_page_stays_first_and_the_pictures_follow_it():
    fn = PART.split("  function svAfterRender(top){")[1].split("\n  }\n")[0]
    assert "    var live=stage.firstElementChild;" in fn
    assert "        stage.appendChild(el);" in fn
    assert "      el.style.order=String(k*2);" in fn
    assert "        sep.style.order=String(k*2-1);" in fn
    # the scroll is put back after renderSlide emptied the stage
    assert "    stage.scrollTop=top;" in fn
    assert "    if(moved&&!svFromScroll) svReveal(live);" in fn
    rs = assets.load("js/deck/15-annotations.js")
    body = rs.split("  function renderSlide(buildOnly){")[1]
    assert body.index("    var svTop=stage.scrollTop;") \
        < body.index("    stage.innerHTML='';")
    assert ("    if(typeof svAfterRender==='function') svAfterRender(svTop);\n"
            "  }") in body


def test_a_picture_is_the_exports_page_and_never_a_second_control():
    paint = PART.split("  function svPaint(k,deck){")[1].split("\n  }\n")[0]
    assert "    try{fillPrintPage(page,s,k,pageOf());}" in paint
    assert ("    mode='view';revealCount=99999;cur=k;selAnnot=null;selSet=[];"
            in paint)
    assert ("      mode=m;revealCount=rc;cur=c;selAnnot=sa;selSet=ss;"
            "flipForce=ff;") in paint
    assert "    page.setAttribute('inert','');" in paint
    assert "    $$('[id],[contenteditable]',page).forEach(function(n){" in paint
    # redrawn only when what it shows changed
    assert "    if(sig&&sl.sig===sig) return false;" in paint
    exp = assets.load("js/deck/60-saving-and-export.js")
    assert "  function fillPrintPage(page,s,i,pg){" in exp
    assert "      fillPrintPage(page,s,i,pg);" in exp


def test_a_picture_redraws_its_own_arrows():
    nt = assets.load("js/deck/20-notes-and-tables.js")
    fn = nt.split("  function scheduleArrowRedraw(layer){")[1] \
        .split("\n  }\n")[0]
    assert fn.index("layer.closest('.sv-pic')") < fn.index(
        "clearTimeout(arrowRedrawT);")
    assert "      var s=layer._paintSlide;" in PART


def test_each_page_is_lit_for_itself():
    page = assets.load("js/deck/00-page.js")
    fn = page.split("  function applyPageBg(){")[1].split("\n  }\n")[0]
    assert "    deckEl.classList.toggle('page-light',!perPage&&pageIsLight(bg));" \
        in fn
    assert "    sl.el.classList.toggle('page-light',pageIsLight(bg));" in PART
    css = assets.deck_css()
    assert ".deck-stage.sv>.slide.page-light{color:#1b2733;}" in css


def test_scrolling_settles_on_the_middle_slide_but_not_while_typing():
    fn = PART.split("  function svSettle(){")[1].split("\n  }\n")[0]
    assert "    if(!svActive()||svPointer) return;" in fn
    assert "    if(ae&&ae.isContentEditable&&stage.contains(ae)) return;" in fn
    assert "    if(at>=0&&at!==cur) svGoTo(at);" in fn
    # a scroll the view made itself is not one to settle
    assert "    if(performance.now()<svIgnoreUntil) return;" in PART
    go = PART.split("  function svGoTo(k,x,y){")[1].split("\n  }\n")[0]
    assert "    selectAnnot(layer,(idx&&/^\\d+$/.test(idx))?+idx:null);" in go


def test_the_column_css():
    css = assets.deck_css()
    assert (".deck.editing .deck-stage.sv{flex-direction:column;"
            "justify-content:flex-start;\n  align-items:safe center;"
            "overflow:auto;scrollbar-gutter:stable;}") in css
    assert ".deck-stage.sv>.sv-live{position:relative;z-index:2;}" in css
    assert re.search(r'\.deck-stage\.sv\[data-sep="faint"\]>\.sv-sep::after'
                     r'\{top:0;height:1px;\n  background:#8a939c80;\}', css)


def test_it_is_remembered_and_shares_the_scrolling_pages_lines():
    assert "  var SV_KEY='junoview:deck:scrollview';" in PART
    assert "    lsSet(SV_KEY,svOn?'1':'',true);" in PART
    assert "    svOn=lsGet(SV_KEY)==='1';" in PART
    assert "    lsSet(SCROLL_SEP_KEY,nx,true);" in PART
    assert "    stage.setAttribute('data-sep',scrollSepGet());" in PART


def test_help_search_and_icon(out):
    assert "<li><b>Scroll view.</b> <i>View &rarr; Scroll view</i>" \
        in assets.help_html()
    assert "    'vw-scroll':'infinite scroll continuous scroll view " in out
    from junoview.branding import icons_map
    assert "scrollview" in icons_map()
