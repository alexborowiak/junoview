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
    # by a STOP, not by a figure (T165): with words walking beside the
    # book, one press turns the page and the next brings the next figure
    assert "flipGo(idx,flipStepNow(s,a)+d);" in out
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
    # THE SLIDE'S BOOK, not merely its first flip book (T165): a slide
    # whose only book is made of words has to explode too, or four
    # fifths of its text would leave the building silently
    assert "var walk=bookWalk(s);" in body
    assert "for(var f=0;f<walk.length;f++) all.push({s:s,i:i,f:f});" in body
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
    # the precedence moved down into flipStepNow when the cursor became
    # a WALK position rather than a frame index (T165); flipAtNow now
    # derives the figure from it. Same rule, one layer lower.
    body = out.split("function flipStepNow(s,a){")[1].split("\n  }")[0]
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
    """Everything else it needs -- reordering, naming, tying -- is in the
    pane, because all of it needs the frame LIST visible to make sense.
    The one ribbon control shows only when a flip book is selected, and
    since T234 it is the big "+ Add" tile at the head of Picture rather
    than a small "Figures..." in the middle of nine other buttons.
    """
    assert "'#fmt-figures':'flip'" in out
    assert 'class="fx-tile big-tile rbn-tall" id="fmt-figures"' in out
    assert "<span>Add</span></button>" in out
    assert "  function flipAddMenu(btn,idx){" in out
    assert "    menuHead(m,'put figures in this book');" in out
    assert "      flipAddMenu(fg,idx);" in out


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


def test_a_text_box_can_carry_pages(out):
    """T165. "Flip book for text would be good" -- a box you click
    through, instead of stacking animations.

    NOT a new kind, and NOT a flip book with text frames. Every text
    property (size, colour, font, align, list, markdown, maths, style,
    shrink-to-fit) lives on the ANNOT, and a flip annot carries none of
    them -- words you could not style, bullet or write in markdown would
    be worse than the two text boxes this replaces. So k stays 'text'
    and the box grows `pg`, the pages after the first. PAGE ONE STAYS IN
    a.text/a.html: everything that reads a text box -- an older
    junoview, the .pptx writer, search, the Objects pane, the notes --
    keeps working and keeps being RIGHT, seeing page one when it cannot
    see the rest.

    The in-place editor cost nothing: editableText never knew where the
    words lived, it was handed accessors, so pointing them at a page is
    the whole change.
    """
    assert "function textPages(a){" in out
    assert "function textPage(a,n){" in out
    assert "function textPageSet(a,n,t,h){" in out
    # page one is the box itself, never a copy of it
    assert "if(!n) return {t:String(a.text||''),h:a.html||''};" in out
    # the editor reads and writes the page being shown
    assert "function(){return textPage(a,_pi).t;}," in out
    assert "textPageSet(a,_pi,v,(r&&r.rich)?r.html:'');" in out
    # and it walks through the door T160 built for charts, not flipsOn --
    # everything asking "is this a flip book?" must keep getting flip books
    assert "if(a.k==='text') return Math.max(0,textPages(a).length-1);" in out


def test_a_page_can_be_added_and_taken_away(out):
    """T165's door. The pages, the renderer, the editor, the timeline and
    the export all landed before this did -- the third time in one day a
    capability shipped without a way in. A page you cannot add is not a
    feature.

    Removing the last extra page takes `pg` away entirely, so the box is
    byte-for-byte an ordinary text box again: a deck should not carry the
    ghost of a book somebody unmade.
    """
    assert "function textAddPage(idx){" in out
    assert "a.pg.push({t:'',h:''});" in out
    assert "function textDropPage(idx,n){" in out
    assert "if(!a.pg.length) delete a.pg;" in out
    # offered for ONE text box at a time, and never folded away
    assert "if(pgA&&pgA.k==='text'&&typeof textAddPage==='function'){" in out
    assert "menuHead(m,'flip book');" in out
    assert "'chart':1,'shows with':1,'flip book':1};" in out


def test_text_pages_and_figures_walk_in_pairs(out):
    """T166, Part B, RUN rather than read.

    A flip book with words walking beside it no longer takes one stop per
    figure: it takes one per (FIGURE, PAGE OF THAT FIGURE). Figure 2 with
    three paragraphs to say about it is three stops.

    Two off-by-ones decide whether this works, and both are one
    character. `flipSlots` starts every figure at 1 and only RAISES it --
    summing raw page counts would give a figure nobody wrote about zero
    slots and SKIP IT ENTIRELY, invisible and unreachable with no error.
    And `extraStops` is |walk|-1, not |walk|, or every slide carrying a
    book gains a phantom press at the end that changes nothing.

    Executed against the shipped functions because an off-by-one here
    strands a page past the end of a slide, which no substring can see.
    """
    import json
    import os
    import subprocess
    import tempfile

    import pytest

    from helpers_js import js_engine, lift_fn

    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng

    body = "\n".join([lift_fn(out, "flipFrames"), lift_fn(out, "textPages"),
                      lift_fn(out, "pageFigs"), lift_fn(out, "booksWith"),
                      lift_fn(out, "flipSlots"), lift_fn(out, "flipWalk")])
    cases = (
        "function book(n){ var f=[]; for(var i=0;i<n;i++)"
        "  f.push({label:'F'+(i+1)});"
        "  return {k:'flip',fid:'B',frames:f}; }"
        "function words(pages,figs){"
        "  var a={k:'text',fb:'B',text:pages[0]||'',pg:[]};"
        "  if(figs[0]!=null) a.fbf=figs[0];"
        "  for(var i=1;i<pages.length;i++){"
        "    var p={t:pages[i],h:''};"
        "    if(figs[i]!=null) p.f=figs[i];"
        "    a.pg.push(p); }"
        "  return a; }"
        "function W(fb,bs){ var s={annots:[fb].concat(bs||[])};"
        "  return {slots:flipSlots(s,fb),walk:flipWalk(s,fb).length}; }"
        "console.log(JSON.stringify({"
        "  plain3: W(book(3),[]),"
        "  pages312: W(book(3),[words([1,2,3,4,5,6],"
        "    [0,null,null,1,2,null])]),"
        "  allOnFig0: W(book(3),[words([1,2,3,4,5],"
        "    [0,null,null,null,null])]),"
        "  twoBooks: W(book(2),[words([1,2],[0,null]),"
        "    words([1,2,3],[0,null,null])])}));"
    )
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "r.js")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(body + cases)
        r = subprocess.run(cmd + [p], capture_output=True, text=True,
                           env=env, timeout=90)
    assert r.returncode == 0, r.stderr[:1500]
    got = json.loads([ln for ln in r.stdout.splitlines()
                      if ln.startswith("{")][-1])

    # nothing tied: one stop per figure, exactly as before Part B
    assert got["plain3"]["slots"] == [1, 1, 1]
    assert got["plain3"]["walk"] == 3
    # the worked example: pages 3,1,2 across three figures
    assert got["pages312"]["slots"] == [3, 1, 2]
    assert got["pages312"]["walk"] == 6
    # THE TRAP: every page on figure 1, and figures 2 and 3 are STILL
    # stops. Summing raw counts would delete them from the talk.
    assert got["allOnFig0"]["slots"] == [5, 1, 1]
    assert got["allOnFig0"]["walk"] == 7
    # two books beside one figure: the longer one sets the slot count
    assert got["twoBooks"]["slots"] == [3, 1]


def test_a_page_names_its_figure_only_where_it_changes(out):
    """T166's authoring, and the reason it is two rows rather than a list
    of every figure. `pageFigs` carries the figure FORWARD, so a page
    stores one only where it CHANGES -- five pages across three figures
    is two settings, not five, and the sentence stored is the sentence a
    person says: "figure 2 starts here".
    """
    assert "function textPageFig(a,n){" in out
    assert "function textPageFigSet(a,n,fig){" in out
    # page one's figure is a.fbf, the key the tie panel has always used
    assert "if(!n) return (a&&a.fbf!=null)?(a.fbf|0):null;" in out
    # the two sentences worth saying about a page
    assert "' starts on this page'" in out
    assert "'Keep this page with the one '" in out
    # and the carry-forward is what makes that enough
    assert "if(p.f!=null) at=p.f;" in out
