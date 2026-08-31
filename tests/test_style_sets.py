"""Style sets (auto-style) and arrangements (auto-arrange).

2026-08-22, user: "it would be good if you could auto-style a presentation.
Then you could have set-defaults of what paragraphs, headings etc. look
like, instead of having to go through and do everything yourself ... I think
there could be autostyle and auto-arrange. Like there could be arrangements
one has ... I know there can be infinite numbers of these, but it would be
cool if there was like a way to create ones of these, and like there was a
view that had a list of what is being arranged, then like a little thumbnail
of what it would be arranged to."

Neither half invents a model. A style set IS `pres.styles`, named; an
arrangement IS a saved slide, and applying one is matchSlide from it. The
two things that ARE new are stated below and pinned: naming unstyled text
from its measured size before stamping a set over it, and refusing to apply
an arrangement automatically.
"""

from __future__ import annotations

# ------------------------------------------------------------ style sets

def test_a_style_set_is_the_registry_under_a_name(out):
    """`pres.styles` already held every style's size, weight, face and
    colour, so applying a set is one assignment and one re-stamp."""
    assert "var STYLE_SETS=[" in out
    assert "function applyStyleSet(id){" in out
    assert "pres.styles=next;" in out
    assert "return restyleAll(null);" in out
    # six built-ins, each with a note saying what it is for
    for label in ("'Clean'", "'Editorial'", "'Bold'", "'Academic'",
                  "'Minimal'", "'Poster'"):
        assert label in out


def test_it_is_not_called_a_theme(out):
    """"Theme" in this app is already the chrome's colour scheme, and two
    things called the same word one bar apart is how a menu stops being
    readable. Word uses "style set" for exactly this."""
    assert "Style sets" in out
    assert 'id="ss-dlg"' in out


def test_a_set_means_what_it_says_and_nothing_more(out):
    """styleDef merges an override OVER the built-in, so a key a set simply
    omits keeps whatever the built-in said -- which meant "Bold", whose
    caption is upright, still produced italic captions, because the
    built-in Caption is italic.

    Writing a falsy value makes applyStyleTo's `if(d.i) ... else delete`
    clear it.
    """
    body = out.split("function applyStyleSet(id){")[1].split("\n  }")[0]
    assert "['b','i','font','color','lh','pspace'].forEach(function(p){" in body
    assert "if(o[p]===undefined) o[p]=0;" in body


def test_applying_a_set_keeps_the_types_you_invented(out):
    """A set is a LOOK; your custom types are your vocabulary. One should
    not silently flatten the other."""
    body = out.split("function applyStyleSet(id){")[1].split("\n  }")[0]
    assert "(pres.types||[]).forEach(function(ct){" in body


def test_auto_style_names_the_text_before_it_styles_it(out):
    """THE HALF THAT MATTERS. Most decks have never used a named style, so
    applying a set to one changes nothing -- there is nothing wearing a
    name to re-stamp.

    So the boxes are named first, by what they already look like, using
    the bands the standardise check already computes. This is the exact
    opposite of stdAdopt, which keeps the band's own numbers so nothing
    moves: here moving is the entire request.
    """
    assert "function autoStyleDeck(id){" in out
    body = out.split("function autoStyleDeck(id){")[1].split("\n  }")[0]
    assert "stdName(stdBands(boxes))" in body
    assert "p.a.style=b.suggest;named++;" in body
    assert "var n=applyStyleSet(id);" in body
    # only boxes that have no style are touched
    assert "return !(p.a.style&&STYLE_DEFAULTS[p.a.style]);" in body


def test_the_gallery_shows_each_set_in_its_own_type(out):
    """A look is chosen by looking -- the same reason the Styles menu's
    rows are specimens rather than a list of point sizes."""
    assert 'id="ss-grid"' in out and "ss-card" in out
    assert "ln.style.fontWeight=d.b?'700':'400';" in out
    assert "if(d.font) ln.style.fontFamily=fontCss(d.font);" in out


def test_your_own_sets_outlive_the_deck_they_came_from(out):
    """The whole point of naming a look is using it on the NEXT
    presentation too, and anything on `pres` travels with one file."""
    assert "var SETKEY='jv-deck-sets:';" in out
    assert "function myStyleSets(){" in out
    assert 'id="ss-save"' in out


# --------------------------------------------------------- arrangements

def test_an_arrangement_is_a_saved_slide(out):
    """That is the whole design, and it is why there is no new matching
    language: matchSlide already buckets by kind and pairs in reading
    order, so applying one is matchSlide from a stored slide.

    It also dissolves the "infinite numbers of these" worry -- nobody
    enumerates them, you keep the five you actually use.
    """
    assert "function arrFromSlide(sl,name){" in out
    assert "function arrApply(arr,idx){" in out
    body = out.split("function arrApply(arr,idx){")[1].split("\n  }")[0]
    assert "var r=matchSlide(pres.slides.length-1,idx);" in body
    # spliced in as a temporary slide rather than re-signing matchSlide,
    # whose pairing is characterised and must not change
    assert "pres.slides.pop();" in body


def test_an_arrangement_carries_no_content(out):
    """Only what matchSlide would ever copy is kept, so an arrangement
    cannot smuggle someone else's words or figure onto your slide."""
    body = out.split("function arrFromSlide(sl,name){")[1].split("\n  }")[0]
    assert "MATCH_PROPS.forEach(function(p){" in body
    # the placeholder word exists ONLY so the saved slide can be drawn
    assert "annotLabel(a).replace(/^Text — /,'')" in body


def test_the_score_punishes_a_mismatch_in_both_directions(out):
    """Dividing by the slide's own count alone said a slide holding one
    text box fitted a three-item arrangement perfectly -- every item it
    had could be placed, which is true and useless."""
    body = out.split("function arrScore(arr,sl){")[1].split("\n  }")[0]
    assert "var tot=Math.max(nw,nh);" in body


def test_it_suggests_and_does_not_apply(out):
    """Whether a paragraph is "small" is a consequence of the layout you
    have not applied yet, so a rule keyed on it is circular and would
    rearrange slides you were happy with.

    Only a CONFIDENT match is ticked for you, and every row can be
    overruled.
    """
    assert 'id="ar-sug"' in out
    assert "pickFor[i]=(b&&b.score>=0.75)?b.arr.id:'';" in out
    # per-slide override, with the score shown so the suggestion can be
    # judged rather than trusted
    assert "Math.round(arrScore(a,sl)*100)+'%'" in out


def test_each_arrangement_is_drawn(out):
    """"a little thumbnail of what it would be arranged to" -- miniDiagram
    draws any slide-shaped thing and an arrangement IS a slide, so the
    preview cannot drift from what the canvas would render."""
    body = out.split("function arrThumb(arr){")[1].split("\n    }")[0]
    assert "miniDiagram({layout:'blank',panes:[],annots:arr.annots||[]})" in body


def test_unstyled_text_is_ranked_rather_than_lumped_together(out):
    """On a deck that has never used a named style, matchKey answered
    'text:body' for EVERY text box -- so a heading and a caption were the
    same kind and got paired by position alone, and a heading could land
    where a caption belonged.

    The role is inferred instead, and the signal is RANK WITHIN ITS OWN
    SLIDE rather than absolute size: the biggest text on a slide is its
    heading whatever the number happens to be. Rank survives exactly the
    case a size threshold breaks on -- a deck whose slides were formatted
    by hand and disagree about how big a heading is, which is precisely
    the deck that needed arranging.
    """
    assert "function inferRoles(sl){" in out
    assert "function slideRoleKey(sl){" in out
    body = out.split("function inferRoles(sl){")[1].split("\n  }")[0]
    assert "list.sort(function(x,y){return y.size-x.size;});" in body
    assert "if(prev!==null&&prev/e.size>ROLE_TOL) rank++;" in body
    # a name you chose beats a rank we inferred
    assert "if(a&&a.k==='text'&&!a.style&&roles[i]!=null)" in out
    # ...and the pane no longer has to apologise for the old behaviour
    assert "ar-warn" not in out


def test_the_fit_percentage_uses_the_same_key_as_the_pairing(out):
    """Otherwise the number describes a different match from the one that
    would actually happen."""
    body = out.split("function arrScore(arr,sl){")[1].split("\n  }")[0]
    assert "var m={},keyOf=slideRoleKey(sl);" in body
    assert "var want=counts(sl),have=counts({annots:arr.annots});" in body


# ------------------------------------------------- arrange what is here

def test_arranging_a_slide_needs_no_saved_layout(out):
    """The library's twin: it reads the slide and works one out.

    Three kinds of thing, and the whole design is that they are treated
    differently -- majors and text are PLACED, marks are carried.
    """
    assert "function arrangeSlide(sl,layer,opt){" in out
    assert "function isMajorKind(a){" in out
    assert 'id="lay-tidy"' in out
    # the spacing preset is the "difference between things" made
    # configurable, and the size threshold is "the size of something"
    assert "var ARRANGE_PRESETS=[" in out
    assert "['tight','Tight',{gap:1.6,big:7,textShare:0.30}]," in out


def test_a_mark_sitting_on_a_figure_is_carried_with_it(out):
    """A circle round part of a plot is not laid out -- it is recorded as
    a FRACTION of whatever it sits on and put back on top of it, so the
    annotation still annotates the same pixel of the same plot."""
    body = out.split("function arrangeSlide(sl,layer,opt){")[1]
    body = body.split("\n  }")[0]
    assert "function frac(r,h){" in body
    # half of it must be over the host, or a shape merely NEAR a figure
    # would be dragged across the slide with it
    assert "return (best>=0&&bo>=rectArea(r)*0.5)?best:-1;" in body


def test_an_arrow_tip_keeps_pointing_at_the_same_spot(out):
    """"arrows point to the same xy in one image to the same xy in another
    image" -- by FRACTION, one end at a time.

    Not via the a.c1/a.c2 tie: that aims at an item's centre and lands on
    its border, which is right for "points AT that figure" and wrong for
    "points at the peak in its top-left". So the tie is dropped for the
    end just placed, or the render would immediately overrule it.
    """
    body = out.split("function arrangeSlide(sl,layer,opt){")[1]
    body = body.split("\n  }")[0]
    assert "fx:(e[1]-r.l)/((r.r-r.l)||1)," in body
    assert "if(e.end==='1') delete a.c1; else delete a.c2;" in body


def test_every_rect_is_measured_before_anything_moves(out):
    """Text auto-heights and a figure frame hugs its plot, so the live
    layer is the only honest source -- and it goes stale on the first
    write."""
    body = out.split("function arrangeSlide(sl,layer,opt){")[1]
    body = body.split("\n  }")[0]
    assert body.index("var rects=annots.map(") < body.index("var moved=0;")


def test_a_text_box_is_never_given_a_height(out):
    """It auto-heights: writing one would fix it at a size its words do
    not need. The same rule MATCH_PROPS keeps."""
    assert "if(b.h!=null&&a.k!=='text') a.h=Math.round(b.h*10)/10;" in out


def test_the_caption_strip_is_charged_to_the_whole_row(out):
    """Charging it to the one cell that has a caption left two figures
    side by side at different heights, which reads as a mistake rather
    than as a caption."""
    assert "var rowCap={};" in out
    assert "var mh=ch-(rowCap[r2]?(capH+gap*0.5):0);" in out


def test_text_goes_beside_one_figure_and_under_several(out):
    """A 30% column beside a 2x2 grid is a gutter, not a paragraph."""
    body = out.split("function arrangeSlide(sl,layer,opt){")[1]
    body = body.split("\n  }")[0]
    assert "if(nb&&nm<=2){" in body
    assert "if(nb&&nm>2){" in body


def test_both_libraries_are_reachable_from_the_match_menu(out):
    """Matching to another slide and matching to a saved layout are the
    same verb with a different model, so they belong one click apart --
    and neither costs the ribbon anything."""
    # the menu entry's pictograph comes from SemIcons now (2026-08-23)
    assert "arr.innerHTML=bic('layouts')+' Arrangements…';" in out
    assert "window.SemDeckArrange=open;" in out
    # the glyphs in this one are written as \\u escapes in the source, so
    # match the ASCII the label is actually made of
    assert "restyle the whole deck" in out
    assert "window.SemDeckStyleSets=open;" in out


# ---------------------------------------------------------------------------
# the design surface, closer to the described view (T130)
# ---------------------------------------------------------------------------
#
# Driven live 2026-08-31 over a three-slide deck with a section: the put
# scoped to "in (section)Methods" moved slides 2-3's headings to (8,6) and
# left slide 1 at (5,5), with the scope named in the toast; every sheet
# cell's tooltip carried the slide's NAME; outlines-on grew one drag
# proxy per object; dragging slide 1's heading proxy by +20%/+10% of the
# miniature moved the model from (5,5) to exactly (25,15); and the sheet
# scoped to the section showed only cells 2 and 3.


def test_the_put_gesture_has_a_scope(out):
    """It was all-wearers-everywhere; the ask was written in sections
    and ranges. One selector builder, two independent scopes, because
    "move the headings in section 2" and "show me outlines of slides
    4-9" are different questions asked at different moments."""
    assert "var dgPutScope={kind:'all'}, dgSheetScope={kind:'all'};" in out
    assert "function dgInScope(sc,si){" in out
    assert "function dgScopeSelect(sc,onchange){" in out
    # only sections actually in use are offered
    assert "if(sl&&sl.sec) used[sl.sec]=1;});" in out
    # the put filters through the same predicate and says its scope
    assert "return wear.filter(function(w){return dgInScope(dgPutScope,w.s);});" in out
    assert "+dgScopeLabel(dgPutScope)+' — Ctrl+Z undoes it');" in out


def test_hovering_a_sheet_cell_names_the_slide(out):
    """The tooltip said only "Slide N" when slideTitle() existed and the
    Apply dialog already used it -- the whole point of hovering is
    finding out which slide you are looking at."""
    assert "var nm=slideTitle(sl);" in out
    assert ("cell.title='Slide '+(i+1)+(nm?' " + "\\" + "u2014 '+nm:'')") in out


def test_objects_can_be_moved_from_the_outline_sheet(out):
    """"or you can just move it from here as well" -- one drag proxy per
    object at the same page percentages inside the same relatively-
    positioned miniature, shown only while outlines are on. The move
    goes through shiftAnnot, the one translate helper, so a tied caption
    travels exactly as it would on the canvas; a plain click still
    navigates, because nothing is claimed until the pointer has moved.
    """
    assert "px.className='dg-drag';" in out
    assert "if(!a||a.hide||a.k==='arrow') return;" in out
    assert "if(!dragging&&Math.abs(dx)+Math.abs(dy)<3) return;" in out
    assert "shiftAnnot(a,(ev.clientX-sx)/mr.width*100," in out
    assert ".dg-sheet.outlined .dg-drag{display:block;}" in out
    # a drop re-renders WITHOUT losing where you were in the panel
    assert "function dgBodyKeep(ov){" in out


def test_the_outline_sheet_can_show_certain_slides_only(out):
    assert "if(!dgInScope(dgSheetScope,i)) return;" in out
    assert "sheetScope.title='Outlines from these slides only';" in out
