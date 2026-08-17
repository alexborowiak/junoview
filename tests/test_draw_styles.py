"""Line styles, arrow ends, routing, and gradient fills -- on both outputs.

Every one of these carries a canvas rendering AND an OOXML mapping in the
same table, because "the poster and the PowerPoint look the same" only stays
true if the two cannot be edited apart. Verified out-of-band by exporting a
slide of gradients, dash styles and double-ended arrows and opening it in
Microsoft PowerPoint, which reported gradient fills (fillType=3), dashDot and
sysDot dash styles, and genuinely different heads at each end (an oval start
with a triangle finish, a diamond start with a stealth finish).
"""

from __future__ import annotations


def test_one_table_drives_canvas_and_powerpoint(out):
    assert "var LINE_STYLES=[" in out
    assert "var HEADS=[" in out and "var HEAD_SIZES=[" in out
    # each entry carries both the SVG dash and the OOXML preset
    assert "{id:'dashdot',label:'Dash-dot',dash:'12 5 2 5',ppt:'dashDot'}" in out
    assert "LINE_DASH[s.id]=s.dash;LINE_PPT[s.id]=s.ppt;" in out


def test_old_posters_keep_working(out):
    """`dash` was a boolean and `nohead` meant "this is a line". Both are
    still read, so a poster saved before this exists opens unchanged.
    """
    assert "return a.style||(a.dash?'dash':'solid');" in out
    assert "return a.nohead?'none':'triangle';" in out


def test_arrows_have_two_ends_and_a_size(out):
    assert "function headEnd" in out and "function headStart" in out
    assert "function headSize" in out
    # a fat line must not end in a pinhead
    assert "hs.mul*Math.max(0.55,Math.min(2.2,sw/3))" in out
    # start markers reuse the same path, reversed
    assert "auto-start-reverse" in out
    assert "endXml('headEnd', item.tail" in out
    assert "endXml('tailEnd', item.head" in out


def test_routes_curved_and_elbowed(out):
    """Drawn as a path so a curve or a bend is possible at all; PowerPoint
    has real curved and bent connectors so it stays editable there.
    """
    assert "function arrowPath" in out
    assert "'M'+x1+' '+y1+' Q'" in out          # quadratic bow
    assert "bend==='h'" in out and "bend==='v'" in out
    assert "item.bend ? 'bentConnector3'" in out
    assert "item.curve ? 'curvedConnector3'" in out


def test_arrows_can_be_attached_to_items(out):
    """An attached end is DERIVED from where its item is now, which is what
    makes the arrow follow it; the stored point remains as a fallback.
    """
    assert "function arrowEnds" in out and "function tiedRect" in out
    assert "function edgePoint" in out           # stop at the border
    assert "a.c1" in out and "a.c2" in out


def test_gradients_linear_and_from_the_centre(out):
    assert "function cssFill" in out
    assert "radial-gradient(circle at 50% 50%" in out
    assert "function gradFill" in out
    assert '<a:path path="circle">' in out       # PowerPoint's radial
    assert "'<a:lin ang=\"'" in out
    # an rgba stop's transparency becomes OOXML's separate alpha element
    assert "function alphaOf" in out


def test_the_boolean_fill_bug_is_fixed(out):
    """`a.fill` is a BOOLEAN meaning "tint with my own line colour". It was
    being passed to the .pptx writer as if it were a colour, so every
    filled shape exported as a solid black box.
    """
    assert "function shapeFillXml" in out
    assert "else if(a.fill) fillCol=a.fillc||shapeFill(a.color||'#ff6b57'," in out


def test_text_can_follow_a_curve(out):
    """HTML cannot bow a baseline, so curved text is drawn as SVG on a
    path -- but only when the box is not being typed into, because a
    caret cannot live on a <textPath>. The flat span stays in the DOM as
    what carries the text, the selection and the caret.
    """
    assert "function applyTextArc" in out
    assert "textPath" in out
    assert ".an-text.an-arced>.an-tx{visibility:hidden;}" in out
    assert ".an-text.an-arced:focus-within .an-arcsvg{display:none;}" in out
    # the arch is bounded by the box's own height: scaled off the WIDTH it
    # peaked hundreds of px above a one-line box and drew off the page
    assert "var avail=Math.max(0,h-fs-2*pad);" in out
    assert "d2.style.minHeight=" in out
    # a bullet list has several baselines and no single curve to follow,
    # so choosing a curve for one turns the list off rather than being a
    # menu entry that quietly does nothing
    assert "if(a.list){delete a.list;delete a.html;}" in out
    # alignment, bullets and curve now share one worded Layout menu
    assert "show('#fmt-parawrap',isText&&isNum" in out


def test_curved_text_warps_in_powerpoint_too(out):
    """It arrives as a real PowerPoint warp -- still editable text, not a
    picture. An empty avLst renders all but flat, so the sweep is stated.
    """
    assert "a:prstTxWarp" in out
    assert "textArchUp" in out and "textArchDown" in out
    assert 'a:gd name="adj" fmla="val ' in out
    # a warped run is sized by its path, so autofit has to go
    assert "(arc ? '<a:noAutofit/>' : '<a:spAutoFit/>')" in out
    # and the one asymmetry is stated in the menu you can actually open,
    # not left to be found. It used to be asserted against the #fmt-arc
    # dropdown, which was permanently hidden and has been removed -- so
    # this passed while pinning a string no user could ever read
    # (2026-08-17 audit)
    assert "'Curve: gentle sag (round the bottom in PowerPoint)'" in out
    assert "'Curve: arch down (round the bottom in PowerPoint)'" in out


def test_the_ribbon_is_groups_not_rows(out):
    """2026-08-07, user: rows of identical buttons "just confusing", shown
    next to a PowerPoint ribbon. One scrolling row of labelled groups with
    dividers, and a size hierarchy so a primary action does not look like
    a toggle.
    """
    assert ".edit-tools.ribbon{display:flex;flex-wrap:nowrap;" in out
    assert "border-right:1px solid #ffffff1c;}" in out
    # .rbn-big went with Present's promotion to an ordinary accented
    # button: nothing has carried the class since, and thirteen rules --
    # four of them density rungs -- were still shipping for it
    # (2026-08-17 audit)
    assert ".dbtn.rbn-big{" not in out
    assert ".dbtn.rbn-sm{" in out and ".dbtn.rbn-ico{" in out


def test_one_button_size_with_colour_carrying_emphasis(out):
    """Four sizes meant nothing shared a baseline and no size carried
    meaning -- "so many sizes, and they don't align, and they are just
    kind of everywhere" (2026-08-07, user). Every ribbon button is now the
    same height; the ONE accented control (Present) is the only thing the
    eye has to land on.
    """
    # one shared height for everything, with no exception carved out for
    # a class nothing uses any more
    assert ".rbn-row>.dbtn,.rbn-row .sh-drop>.dbtn," in out
    assert "height:26px;box-sizing:border-box;}" in out
    assert ".dbtn.rbn-ico{display:flex;align-items:center;" in out
    assert "width:26px;height:26px;" in out
    # no rbn-big survives in the ribbon at all: Present, the one accented
    # control, moved to the top bar, so every ribbon button is identical
    assert 'class="dbtn et rbn-big"' not in out
    assert 'class="dbtn rbn-big"' not in out
    assert 'class="dbtn primary rbn-big"' not in out


def test_button_names_say_what_they_do(out):
    """"Cell", "Page", "Show me" were guesses at what they meant."""
    assert "Notebook cell</button>" in out
    assert "Text box</button>" in out
    assert "Page size &#9662;" in out or "Page size ▾" in out
    assert "Guides &#9662;" in out or "Guides ▾" in out
    assert ">Show me &#9662;" not in out
    # a constant height means selecting an item cannot shift the canvas
    assert "height:98px;" in out
    # an empty group must not leave a label hanging over nothing
    assert "var bar=$('#edit-tools'); if(!bar) return;" in out


def test_the_ribbon_never_scrolls_wraps_or_clips(out):
    """2026-08-07, user: horizontal scrolling was rejected outright. Width
    now comes from density, and the row is a fixed two-row GRID -- capping
    a wrapping flex row instead produced four-plus rows inside a clipped
    58px box, i.e. controls that could not be seen or reached.
    """
    # scoped to the EDIT ribbon: the main app bar keeps its own
    # overflow-x:auto and is not what was being complained about
    ribbon = out.split(".edit-tools.ribbon{")[1].split("}")[0]
    assert "flex-wrap:nowrap" in ribbon
    assert "overflow:hidden" in ribbon
    assert "overflow-x:auto" not in ribbon
    assert "grid-auto-flow:column" in out
    assert "grid-template-rows:26px 26px" in out
    assert "grid-row:1/span 2" in out
    # the ladder is density only; no rung may strip an icon or a word
    assert "var ERC=['erc1','erc2','erc3'];" in out
    assert ".deck.erc3 .dbtn.rbn-big i" not in out
    # the reminder text goes whole rather than being ellipsised
    assert "erc-nohint" in out
    assert "text-overflow:ellipsis;white-space:nowrap;}" not in out.split(
        ".edit-tools.ribbon .et-hint")[1][:200]


def test_the_fit_actually_runs_on_a_fresh_page(out):
    """The ladder existed but nothing triggered it on load: the bar was
    measured at zero width while still hidden, bailed out, and never ran
    again -- so the toolbar was always full size and simply ran off the
    right-hand edge. Observing the ribbon's OWN box is the one signal
    that catches every way it gets narrower.
    """
    assert "new ResizeObserver(function(){" in out
    assert "fitEditRibbon();applyZoom();" in out
    assert "if(m==='edit') requestAnimationFrame(fitEditRibbon);" in out
    # a fit measured against the fallback font would otherwise stick
    assert "document.fonts.ready.then" in out


def test_nothing_is_ever_clipped_off_the_right(out):
    """The row must not clip into buttons that cannot be seen or reached.

    It used to buy that width by standing the Slide group down whenever
    something was selected on a narrow window. Measured cost: selecting a
    text box took View 168px to the left -- the biggest jump in the bar,
    fired by an ordinary click at an ordinary size (2026-08-17). The width
    comes from three things that move nothing instead: a tighter rung for
    the CHANGING half only, the save readout giving way at the same stage
    as the hint, and the constant half stepping with the window width
    rather than with the content.

    Measured after, at 1280 / 1366 / 1400 / 1600 / 1920px windows with the
    slide strip docked: nothing clipped in any state -- nothing selected,
    a line selected, a text box selected. Below ~1250px the remedies are
    unchanged and one click each: put the slide strip away, or stand the
    toolbar on the right.
    """
    assert ".deck.erc-tight .edit-tools.fmt-open .rbn-slide{display:none;}" \
        not in out
    assert "cl.add('erc-tight')" in out
    assert 'class="rbn-grp rbn-fixed rbn-slide"' in out
    # the changing half gets a rung the constant half never pays
    assert ".deck.erc-tight .et-fmt .rbn-grp{padding-left:2px;" in out
    assert ".deck.erc-tight .et-fmt .rbn-row .fmt-num{width:32px;}" in out


def test_save_is_one_control_not_two(out):
    """"Save" beside "→ This project ▾" read as two rival save buttons and
    nobody could tell what the second did. It is now a split button and
    the destination lives in its menu, where a destination belongs.
    """
    assert 'class="dc-savegrp"' in out
    assert ".dc-savegrp>.dbtn:first-child{border-radius:6px 0 0 6px;}" in out
    assert "b.innerHTML='&#9662;';" in out
    assert "b.title='Saving to '+targetLabel()" in out
    assert "th.textContent='save to — now: '+targetLabel();" in out
    # the old wide destination label is gone from the row
    assert "'&#8594; '+esc(targetLabel())+' &#9662;'" not in out


def test_wordless_glyph_buttons_became_worded_menu_rows(out):
    """Bring-to-front, send-to-back and the rotates were bare glyphs whose
    meaning lived only in a tooltip. Folding them into the Arrange menu
    removes four controls from the row AND adds four labels.
    """
    assert "['o:front','Bring to front']" in out
    assert "['o:rotl','Rotate left 15°']" in out
    assert "show('#fmt-front',false);" in out
    assert "&#8676; Arrange &#9662;" in out
    # the menu drives the originals, so each keeps one implementation
    assert "if(b) b.click();" in out


def test_document_actions_live_above_the_editing_tools(out):
    """File, Save, undo/redo and the save readout are about the DOCUMENT:
    they never change with the selection and are touched a few times a
    session, so they sit in the top bar and the ribbon below carries only
    editing tools.

    Present is NOT one of them -- it is a way of viewing the page, so it
    belongs in the View group (2026-08-07, user: "put the present with the
    view"; an earlier reading moved it to the top bar, which was wrong).
    """
    assert 'id="deck-topslot"' in out
    assert "top.appendChild(el);" in out
    # they move up for BOTH kinds now: the panel they used to sit in is
    # closed by default while editing, so leaving them there would leave
    # a deck with no Save button on screen (2026-08-07)
    assert "if(!pageOf().poster) return;" not in out
    # ...and nothing in that row may wrap, or it stands taller than its
    # neighbours and the row stops looking inline
    assert "white-space:nowrap;display:inline-flex;" in out
    # Present is in the ribbon, not the top bar. It now sits in Output
    # alongside Print check (2026-08-07) rather than in View, so it comes
    # AFTER the View group's label. Anchored on the label markup: a bare
    # ">View<" also matches prose elsewhere in the page.
    view_lab = out.index('<span class="rbn-lab">View</span>')
    out_lab = out.index('<span class="rbn-lab">Output</span>')
    assert view_lab < out.index('id="dc-play"') < out_lab
    assert out.index('id="vw-check"') < out.index('id="dc-play"')
    # The save readout still sits beside Save rather than stranded past
    # undo/redo, but markup order does it now: File and Save are one
    # stacked cell in column one, so appending the readout last drops it
    # into column two's second row, level with Save. The old re-insert
    # tested `savegrp.parentNode === top`, which the stack makes false
    # forever -- it would have sat there doing nothing (2026-08-17).
    assert "top.insertBefore(st,grp.nextSibling);" not in out
    stack = out.split('<span class="rbn-stack">')[1].split("</span>\n        </span>")[0]
    assert 'id="dc-file"' in stack and 'class="dc-savegrp"' in stack
    assert out.index('id="dc-save"') < out.index('id="dc-undo"') \
        < out.index('id="deck-status"')
    # the top bar must survive edit mode, or it would hide the only Save
    # button in the app; see test_the_top_bar_always_earns_its_row
    assert "function syncTopBar(){" in out
    # the panel's own 30px height must not follow the nodes into the bar
    assert ".dc-head .dbtn,.dc-head .dc-menuwrap .dbtn{height:30px;" in out
    assert ".dc-head .dbtn,.dc-menuwrap .dbtn{height:30px;" not in out


def test_the_top_bar_always_earns_its_row(out):
    """A whole row was once held open by one redundant button: getting
    back to the document view is already on the presentations rail
    (2026-08-07), so the bar was made conditional on carrying something.

    It is unconditional again, for a better reason: "Close the editor"
    now lives there in every mode (2026-08-10), so the bar can never be
    an empty strip -- and the way OUT of the editor can never vanish.

    The decision is written once. It used to be written twice, at
    deck.js:1184 and :7006, while both tests pinned a string that existed
    at only one of them -- so the other could drift unseen.
    """
    assert 'id="deck-docs"' not in out
    assert "function syncTopBar(){" in out
    assert "dt.hidden=editing&&!(slot&&slot.children.length);" not in out
    assert "dt2.hidden=" not in out
    # one call site per place the bar's contents can change
    assert out.count("syncTopBar();") == 2
    # a page-size change can move where the File controls belong: a poster
    # hides the panel they live in, and they must not vanish with it
    assert "fileToPanel();fileToRibbon();syncTopBar();" in out


def test_the_bar_has_a_constant_half_and_a_changing_half(out):
    """THE rule this toolbar keeps: nothing that is always there may move
    when you select something (2026-08-17, user, having asked before:
    "having buttons jump around sucks ... have everything that stays
    constant always in the one space on the left, and everything new
    always appears on the right").

    So: File, Slide and View are ordered first and are on screen in that
    order whatever is selected -- nothing further right can push them,
    because flex lays out in order. Output, Notebooks, Insert and the
    contextual groups are ordered after them, so the swap happens at ONE
    boundary at the far end. Output and Notebooks belong to the changing
    half because they stand down for a selection, and a group that can
    disappear cannot be part of the half that promises never to move.

    Groups also pack left rather than being flung at the window edge by an
    auto margin, which turned every spare pixel into one void in the
    middle of the bar -- ~560px of it once File stopped carrying "Close
    the editor" ("there is lot's of weird space around").

    Measured at 1280 / 1400 / 1600 / 1920px windows: selecting a line and
    then deselecting moves File, Slide and View by exactly 0px, and
    changes their widths by exactly 0px.
    """
    assert ".rbn-file{order:1;}" in out
    assert ".rbn-slide{order:2;}" in out
    assert ".rbn-view{order:3;}" in out
    assert ".rbn-out{order:4;}" in out
    assert ".rbn-nbs{order:5;}" in out
    assert ".rbn-insert{order:6;}" in out
    assert ".et-fmt .rbn-grp{order:7;flex:none;}" in out
    # the constant three are tagged, and the tag is what exempts them from
    # every density rung
    for grp in ("rbn-file", "rbn-slide", "rbn-view"):
        assert 'class="rbn-grp rbn-fixed %s"' % grp in out
    assert 'class="rbn-grp rbn-standby rbn-out"' in out
    assert 'class="rbn-grp rbn-standby rbn-nbs"' in out
    # nothing is pinned to the right edge any more
    assert "margin-left:auto" not in out.split(".rbn-view{")[1].split("}")[0]
    assert ".edit-tools.ribbon .et-hint{order:9;margin-left:0;}" in out


def test_groups_fill_across_the_rows_not_down_the_columns(out):
    """grid-auto-flow:column filled the first column top-to-bottom before
    moving right, so Insert read "Notebook cell, Text box, Shape, Arrow"
    DOWN while the eye read it ACROSS (2026-08-07, user: "rows not
    columns"). The column count is computed per group from how many
    controls are actually visible.
    """
    assert "grid-auto-flow:row;" in out
    assert "grid-template-columns:repeat(var(--rbn-cols,4),auto);" in out
    assert "row.style.setProperty('--rbn-cols',Math.max(1,Math.ceil(n/2)));" in out
    # controls that are one decision stay one cell, so a stepper's minus
    # and plus can never land on different rows
    assert ".rbn-cell{display:flex;align-items:stretch;gap:3px;height:26px;}" in out


def test_zoom_reads_as_zoom(out):
    """"Fit" between a minus and a plus read as a button called Fit rather
    than as the zoom level (2026-08-07, user: "the fit button is
    confusing… I think you mean zoom"). It is always a percentage now,
    carrying the word, measured off the real page so the number means the
    same thing whether or not it is auto-fitted.
    """
    assert "zl.textContent='Zoom '+pct+'%';" in out
    assert ">Fit</button>" not in out
    assert "var natural=pg2.mm[0]/25.4*96;" in out
