"""The flip book: many figures in one box, arrows to step through them, and
other items tied to a particular figure.

2026-08-22, user: "people create figures with small additions and then need
to create layers of figures or heaps of new slides each with a new figure.
It would be cool if there was something like a flip book or photo deck where
you can add heaps of figures to and then click arrows to scroll through
(including in presentation mode), then you can tie text to an image in it
and maybe have like 'all previous text' or 'just this text' or something."

Three things carry the feature and each is pinned below: the frame is
DERIVED from the one playback cursor rather than stored beside it; a binding
is keyed on an opaque id rather than an array index; and the exporter
EXPLODES a flip book into the pile of slides the user was otherwise building
by hand. The third is the payoff -- the flip book is the authoring form, the
pile is only ever the delivery form.
"""

from __future__ import annotations

from junoview.notebook.presentations import as_presentations


def test_a_flip_book_is_a_real_item_kind(out):
    """It is drawn out like every other insert tool, not dropped in at a
    canned size -- the rule the line tool was told off for breaking."""
    assert "table:1,flip:1,guide:1};" in out
    assert 'data-tool="flip"' in out
    assert "?{k:'flip',x:p0.x,y:p0.y,w:0,h:0,fid:flipId(),frames:[],at:0}" in out
    # it resizes like a box, not like a line
    assert "||a.k==='table'||a.k==='flip');" in out


def test_the_id_exists_from_the_moment_the_box_does(out):
    """Every binding on the slide points at the flip book's id, so it cannot
    be minted later -- and it cannot be an array index, because every
    reorder, delete, duplicate and paste in the editor splices s.annots and
    would silently re-point the binding at a stranger. a.grp set the
    precedent.
    """
    assert "function flipId(){" in out
    assert "return 'k'+Date.now().toString(36)+flipSeq.toString(36);" in out


def test_the_frame_is_derived_from_the_one_playback_cursor(out):
    """A slide already has exactly one cursor. A second piece of state
    beside it would be a second thing to keep in step -- which is the bug
    this whole feature exists to stop people hand-doing.
    """
    assert "function flipAtNow(s,a){" in out
    assert "function flipPlan(s){" in out
    assert "function slideStops(s){" in out
    # ONE timeline. Builds first and frames after was the whole story
    # until a flip book could carry a build of its own (T86): one that
    # does puts its frames straight after itself, one that does not still
    # walks once every build on the slide is up.
    assert "return flipPlan(s).count;" in out
    assert "if(b==null) tail.push(p);" in out
    assert "else (anch[b]||(anch[b]=[])).push(p);" in out
    assert "if(mode==='view'&&s&&revealCount<slideStops(s)){" in out
    # stepping BACK into a slide lands it fully built AND on the last frame
    assert "var s=pres.slides[i];return s?slideStops(s):0;" in out


def test_the_three_ways_an_item_can_be_tied_to_a_figure(out):
    """"just this text" and "all previous text" are the user's own words;
    the third falls out of the same shape."""
    assert "function flipShowsFrame(s,a,at){" in out
    assert "if(m==='from') return at>=f;" in out
    assert "if(m==='until') return at<=f;" in out
    assert "var FLIP_MODES=[['only','Just this figure']," in out
    assert "'This figure and every one after'" in out


def test_an_unresolvable_binding_fails_open(out):
    """An item that silently becomes invisible forever is the worst thing
    this feature could do.

    So a binding whose flip book has been deleted, or whose frame no longer
    exists, shows the item rather than hiding it.
    """
    body = out.split("function flipShowsFrame(s,a,at){")[1].split("\n  }")[0]
    assert "if(!a||!a.fb) return true;" in body
    assert "if(!fb) return true;" in body
    assert "if(!fr.length) return true;" in body
    assert "if(f>=fr.length) return true;" in body


def test_reordering_frames_carries_the_bindings_with_them(out):
    """Otherwise a caption tied to figure 4 silently starts belonging to
    whatever slid into slot 4."""
    assert "function flipRemap(a,map){" in out
    assert "if(!x||x.fb!==a.fid) return;" in out
    # and deleting a frame drops the binding rather than re-pointing it
    assert "if(to==null) delete x.fb, delete x.fbf, delete x.fbm;" in out


def test_the_arrows_are_buttons_so_playback_does_not_swallow_them(out):
    """The click-to-advance handler already skips button/a/input/select, so
    a real <button> steps the frame without also advancing the slide.

    That guard is the reason this works at all, so both halves are pinned.
    """
    assert "if(e.target.closest&&e.target.closest('button,a,input,select'))" in out
    assert "nb.className='an-flipnav';nb.type='button';" in out
    # ...and dragging off an arrow must not drag the whole flip book
    assert "nb.addEventListener('mousedown',function(ev){" in out


def test_an_arrow_moves_the_talk_not_a_private_cursor(out):
    """Otherwise the arrow and the space bar would disagree about where you
    are in the deck."""
    body = out.split("function flipGo(idx,to){")[1].split("\n  }")[0]
    assert "if(mode==='view'){" in body
    assert "revealCount=base+to;" in body
    assert "flipGo(idx,flipAtNow(s,a)+d);" in out
    # in the editor, flipping through your own figures is not an edit
    assert "markDirty(true);renderSlide();renderFlipPane();" in body


def test_editing_dims_the_other_frames_rather_than_hiding_them(out):
    """You have to be able to see and click the caption you are about to tie
    to figure 4 while you are standing on figure 1. In playback it goes."""
    assert "if(editing) fel.classList.add('an-fbother');" in out
    assert "else if(fel.parentNode) fel.parentNode.removeChild(fel);" in out
    assert ".deck.editing .an-item.an-fbother{opacity:.24;}" in out


def test_the_export_explodes_a_flip_book_into_real_slides(out):
    """THE PAYOFF. The complaint was "heaps of new slides each with a new
    figure", so the editor keeps one slide and the exporter builds the pile.

    The FIRST flip book on a slide is the one that explodes it -- two of
    them multiplying into a grid of pages is nobody's intention.
    """
    body = out.split("function outputSlides(){")[1].split("\n  }")[0]
    assert "var fl=flipsOn(s)[0];" in body
    assert "for(var f=0;f<n;f++) all.push({s:s,i:i,f:f});" in body
    # both export paths carry the frame: .pptx through note.frame, and
    # print/PDF/standalone HTML through flipForce
    assert "note.frame=ent.f;" in out
    assert "flipForce=ent.f;" in out
    # ...and the editor is put back afterwards
    assert "flipForce=null;" in out


def test_a_forced_frame_beats_both_cursors(out):
    """Printing sets mode='view' and revealCount=99999 to mean "fully
    built", which would otherwise put every exported page on the last
    frame."""
    body = out.split("function flipAtNow(s,a){")[1].split("\n  }")[0]
    assert body.index("if(flipForce!=null){") < body.index("if(mode!=='view')")


def test_a_printed_page_carries_no_arrows_to_press(out):
    """Each exported page IS one frame, so the counter stays -- it tells a
    reader on paper they are looking at step 2 of 3 -- and the arrows go."""
    assert "if(flipForce!=null) return;" in out


def test_one_button_per_figure_is_the_other_way_to_step(out):
    """"It would be cool if you could have an option for 'buttons per
    image'" (T86). The arrows are a walk; the buttons are a menu -- with
    nine figures, reaching figure 7 in front of an audience should not be
    six clicks.

    Per flip book, chosen in the frames pane: it is a property of the
    book, and a stepping choice is not worth a ribbon control.
    """
    assert "if(fr.length>1&&a.fbtn){" in out
    assert "jb.className='an-flipbtn'+(fi===at?' on':'');" in out
    assert "ev.stopPropagation();ev.preventDefault();flipGo(i,fi);});" in out
    assert 'id="fp-nav"' in out
    assert "if(nav.value==='btn') a.fbtn=1; else delete a.fbtn;" in out
    # a jump and a step are ONE verb, or they would disagree about where
    # the talk is
    assert "function flipGo(idx,to){" in out


def test_an_animated_flip_book_walks_where_its_build_is(out):
    """"Flip books also need a way of appearing with animations" (T86).

    Give the book a build and it has said where in the talk it belongs, so
    its figures follow it THERE rather than waiting for every other build
    on the slide. One timeline, and still one cursor.
    """
    assert "var b=(p.a&&p.a.anim)?steps.map[p.a.anim.order||0]:null;" in out
    assert "stop[b]=n;n++;" in out
    assert "function flipBase(s,a){" in out
    # so a build BEHIND one sits later in the sequence than its own build
    # number, which is the question an-prebuild has to ask
    assert "var sp=plan.stop[st];" in out
    assert "if(sp>=revealCount) el.classList.add('an-prebuild');" in out


def test_the_tie_says_what_it_is_for_before_you_use_it(out):
    """The tie has worked since the flip book landed and hid unless you
    happened to have something selected with the pane open -- so it was
    asked for again as though it did not exist (T86)."""
    assert "if(!hits.length){" in out
    assert "Select any text or object on the slide to tie it " in out


def test_filling_a_flip_book_is_one_gesture_not_twelve(out):
    """Adding twelve figures a file dialog at a time is how a feature goes
    unused. Picking notebook cards stays open and counts them; the picture
    input takes several files at once.
    """
    assert "function startPick(idx,multi){" in out
    assert "function pickAdd(ref){" in out
    assert 'id="pick-done"' in out
    assert 'id="fp-img-file" accept="image/*" multiple' in out
    # a batch is ONE undo step, not one per figure
    assert "if(wasMulti&&pickAdded) markDirty();" in out


def test_the_frames_pane_is_the_slide_strips_shape(out):
    """A flip book is a little deck inside a slide, so reordering its
    figures should feel like reordering slides. Anything else would have
    been a second idiom for the same job."""
    assert 'id="flippane"' in out and 'id="flippane-list"' in out
    assert "function renderFlipPane(){" in out
    assert "function frameLabel(f,i){" in out
    # it joins the panes that share the corner and the remembered geometry
    assert "'stdpane','tidypane','objhist','provpane','flippane','sizepane']" in out


def test_tying_acts_on_the_whole_selection(out):
    """Half a dozen labels tied to one figure has to be one gesture -- the
    same rule fmtApply follows."""
    assert "function selIdxs(){" in out
    assert "function tieSel(a,frame,mode){" in out
    # a flip book cannot be tied to itself
    assert "if(!x||x.k==='flip') return;" in out


def test_the_flip_book_costs_the_ribbon_one_hidden_button(out):
    """Everything else it needs -- adding, reordering, naming, tying -- is
    in the pane, because all of it needs the frame LIST visible to make
    sense. The one ribbon control shows only when a flip book is selected.
    """
    assert "'#fmt-figures':'flip'" in out
    assert 'id="fmt-figures" hidden' in out


def test_a_frames_ref_is_namespaced_like_a_cells(out):
    """Missing this is not a subtle bug: the deck reloads with every frame
    blank."""
    assert "if(a.k==='flip'&&Array.isArray(a.frames))" in out
    assert "if(f&&f.ref) f.ref=ns(f.ref);});" in out


def test_a_flip_book_shows_in_the_film_strip(out):
    """Without a miniDiagram branch every slide holding one looks empty --
    the lesson miniDiagram was rewritten for in the first place."""
    assert "var bf=miniBox(d,a,'is-flip');" in out
    assert "function flipFrames(a){" in out


def test_a_self_contained_deck_carries_the_frames_too(out):
    """embedAssets walked ``a.k==='cell'`` only, so a deck saved with its
    figures embedded would have opened with every FRAME blank -- the one
    failure the embedded snapshots exist to prevent.

    They dedupe by ref, so a flip book costs the same as placing its
    figures one at a time.
    """
    body = out.split("function embedAssets(list){")[1].split("\n  }")[0]
    assert "if(a.k==='cell'&&a.ref) refs.push(a.ref);" in body
    assert "else if(a.k==='flip') flipFrames(a).forEach(function(f){" in body
    assert "if(emb[ref]) return;" in body


def test_python_rebuild_keeps_a_flip_book_whole():
    """Annots ride the Python rebuild wholesale, so the frames and every
    binding survive a project save. Pinned because "it worked in the
    browser and vanished on reopening" is this codebase's recurring
    failure.
    """
    pres = as_presentations([{
        "name": "n",
        "slides": [{"layout": "blank", "annots": [
            {"k": "flip", "x": 5, "y": 5, "w": 40, "h": 30, "fid": "k1",
             "at": 1, "frames": [{"ref": "nb::figa", "label": "Raw"},
                                 {"src": "data:image/gif;base64,AA"}]},
            {"k": "text", "x": 60, "y": 5, "text": "caption",
             "fb": "k1", "fbf": 1, "fbm": "from"},
        ]}],
    }])
    a = pres[0]["slides"][0]["annots"]
    assert a[0]["fid"] == "k1" and a[0]["at"] == 1
    assert len(a[0]["frames"]) == 2
    assert a[0]["frames"][0]["label"] == "Raw"
    assert a[1]["fb"] == "k1" and a[1]["fbf"] == 1 and a[1]["fbm"] == "from"
