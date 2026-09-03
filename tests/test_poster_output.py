"""The poster OUTPUT path (2026-08-04): the run that made poster mode real.

Page background + light pages, standalone HTML export, print-resolution
warnings, the crop-trim UI, and a self-contained vector QR generator.
These are string pins against the built page (the suite executes no JS);
the QR encoder itself was verified out-of-band by machine-decoding its
rendered matrices with OpenCV across versions 1-10.
"""

from __future__ import annotations


def test_page_background_and_light_pages(out):
    """pres.pageBg drives --page-bg; a light colour flips .page-light,
    which recolours the DEFAULT chrome (never explicit per-item colours).
    New posters start WHITE — they exist to be printed — and the chosen
    background rides into the print/export path instead of the app navy.
    """
    assert "function applyPageBg" in out and "function pageIsLight" in out
    assert "pres={name:name,slides:[s],page:'a0p',pageBg:'#ffffff'};" in out
    # the swatches are BUILT from PAGE_BGS now rather than hand-written
    # into the markup, so the two background menus cannot drift apart and
    # the colours live in one place (2026-08-20)
    # Page background LEFT the File menu on 2026-08-20. File is where you
    # open, save and export things; how the deck looks is Design. It was
    # in that menu because somebody put it there, not because it belonged
    # (user: "why the fuck is page background in file"). It now sits in
    # the Background dropdown beside the per-slide override, so the two
    # can be seen against each other.
    assert 'id="mi-pagebg"' not in out
    assert "menuHead(menu,'Every slide');" in out
    assert "var PAGE_BGS=[" in out
    assert "function bgChips(host,current,onPick,withAuto){" in out
    # a gradient has no single colour to measure, so each entry declares
    # whether it is light instead of pageIsLight guessing
    assert "if(PAGE_BG_LIGHT.hasOwnProperty(v)) return PAGE_BG_LIGHT[v];" \
        in out
    assert "function bgSolid(bg){" in out
    assert ".deck .deck-stage .slide{background:var(--page-bg,transparent);}" in out
    assert ".page-light .an-text{" in out
    assert ".page-light .an-cell{background:#fff;" in out
    # the export carries the page's own background
    assert "'.print-page,.print-page .slide{background:'+bg" in out


def test_standalone_html_export(out):
    """File > Export standalone HTML: one self-contained file anyone can
    open without Junoview — inline styles, data-URI figures, arrow-key
    paging, and the same @page rules so Ctrl+P prints at page size.
    """
    assert "function buildPrintRoot" in out
    assert "function exportDeckHtml" in out
    assert 'id="mi-html"' in out
    assert "menuAction('#mi-html',function(){exportDeckHtml();});" in out
    assert "#print-root{position:static!important" in out
    # the print path still exists and shares the same page builder
    assert "window.SemDeckPrint=printDeck;" in out


def test_poster_figures_get_a_print_resolution_warning(out):
    """A raster figure that would print under 150dpi at its poster size
    gets a warning chip with the fix in its tooltip; SVG figures are
    vector and never flagged.
    """
    assert "function checkFigDpi" in out
    assert "if(mode==='edit') checkFigDpi(slideEl);" in out
    assert "/^data:image\\/svg/i" in out
    assert "if(!dpi||dpi>=150) return;" in out
    assert ".dpi-warn{position:absolute" in out


def test_crop_menu_gained_the_rectangular_trim_ui(out):
    """The t/r/b/l inset always existed in the model — this pins its UI:
    four steppers in the crop menu, live on the selection, plus Reset.
    """
    assert "row.className='crop-inset';" in out
    assert "lab.textContent='Trim edges %';" in out
    assert "if(v) a.crop[p[0]]=v; else delete a.crop[p[0]];" in out
    assert ".crop-inset input{" in out


def test_line_is_drawn_like_a_shape(out):
    """Line used to drop a canned 20%->80% horizontal rule the instant you
    clicked it, and you angled it afterwards by dragging an endpoint. It
    is a TOOL now, dragged out like a shape (2026-08-10, user: "I hate it
    how when you click line, it just creates a line -- can it please be
    drawn like it does with the shapes").

    It is still an arrow with no head (a.nohead), so endpoint drags,
    attachment, colour, width, dash, lock, the Objects pane and the
    PowerPoint connector export all come free. The deck toolbar's insert
    buttons carry real SVG icons in the app ribbon's 16-grid stroke style
    instead of mismatched unicode glyphs.
    """
    assert 'id="dc-line" data-tool="line"' in out
    # the old insert-immediately handler is GONE, not merely bypassed: left
    # in place it would fire alongside the generic .et wiring, so one click
    # would both arm the tool and drop a ready-made rule
    assert "s.annots.push({k:'arrow',x1:20,y1:50,x2:80,y2:50,nohead:1," not in out
    # every insert tool goes through startDraw now, cells and text boxes
    # included, so there is no list of "the ones that are drawn" to fall
    # out of date (2026-08-17)
    assert "if(tool!=='select') startDraw(layer,s,tool,pctPoint(layer,ev));" in out
    assert "tool==='rect'||tool==='arrow'||tool==='line'" not in out
    assert "?{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,nohead:1," in out
    # heads became a choice of shapes (2026-08-07); `nohead` is still what
    # makes a Line a line, now read through headEnd() rather than a
    # marker-end test at the draw site
    assert "return a.nohead?'none':'triangle';" in out
    assert "a.nohead?'Line':'Arrow'" in out
    # a line on a light page defaults dark, and vice versa
    assert "color:pageIsLight(pres.pageBg)?'#44525c':'#8aa0b0'" in out
    # every <i data-ic> token was substituted into an inline SVG
    assert "<i data-ic=" not in out
    assert ".dbtn .bic{display:inline-block;" in out


def test_edit_mode_is_minimal_file_moves_out_colours_in_popups(out):
    """2026-08-05, user: "focus more on usability". Editing borrows the
    File controls out of the docked panel head (which read as a
    permanently-open File menu); the panel keeps only the slide strip —
    and disappears entirely for posters, which are one page and need no
    slides. The fourteen always-visible colour swatches became two popup
    buttons.

    2026-08-07: those controls now land in the TOP BAR rather than a
    ribbon group. They are document actions, not editing tools, and
    mixing the two made the toolbar unreadable. The borrow-and-restore
    mechanism is unchanged.
    """
    assert 'id="deck-topslot"' in out and 'id="deck-topright"' in out
    # the borrow machinery is gone (2026-08-19): the document actions
    # live in the left column, for posters too -- only the deck-only
    # film hides there
    assert "function fileToRibbon" not in out
    assert ".deck.poster-page .dc-film{display:none!important;}" in out
    assert 'id="fmt-txcol-btn"' in out and 'id="fmt-fillcol-btn"' in out
    assert 'id="fmt-txcol-menu"' in out and 'id="fmt-fillcol-menu"' in out
    # ...and a SHAPE's fill colour moved INTO its Fill panel on
    # 2026-08-20: there used to be a "Fill" in Line & shape and a "Fill
    # colour" two groups away and nobody could tell which was which
    # (user: "confusing there is a fill and fill colour"). This button
    # stays for text boxes and cell frames, which have a background
    # colour but no fill STYLE.
    assert "show('#fmt-fillcol-btn',showBg&&kind!=='rect');" in out
    # picking a swatch closes its popup; the custom swatch keeps its panel
    # (rc = a recent-colour chip, which also closes it — 2026-08-20)
    # (through the overlay owner since T213)
    assert "if(rc||(sw&&!sw.classList.contains('sw-custom'))) overlayHide(menu);" in out


def test_freehand_drawing_is_a_first_class_stroke(out):
    """The last drawing tool that did not exist (2026-08-17, user asking
    whether the line options were complete: "like free draw").

    Stored the way a SHAPE is -- a box in page percentages, with the
    points normalised to 0..1 inside it -- so move, resize, rotate,
    opacity, lock, hide, the Objects pane and the selection handles all
    work on it without knowing it exists: they only ever touch x/y/w/h.
    Raw page coordinates would have meant a special case in every one.

    Catmull-Rom through the points, as cubics, because a hand-drawn line
    must read as a curve and not as the polygon the mouse reported; the
    trail is thinned first, or a single stroke would push thousands of
    points into the document and the undo stack.

    Measured in a browser: a 60-sample scribble became a 50%x24% item with
    40 cubic segments; weight and line style both applied to it; Ends and
    Route correctly did NOT offer themselves; the Objects pane called it
    "Drawing"; and it exported as a real PowerPoint freeform (custGeom, 40
    lnTo points, no fill) in a file with no missing parts.
    """
    assert 'id="dc-draw" data-tool="draw"' in out
    assert ("var TOOLS={select:1,text:1,arrow:1,rect:1,line:1,cell:1,draw:1,\n"
            "    table:1,flip:1,guide:1};") in out
    assert "function drawPathD(pts){" in out
    assert "function drawFreeSvg(a,layer){" in out
    # normalised into its own box, with a floor on each axis so a dead
    # straight stroke neither divides by zero nor becomes ungrabbable
    assert "function foldTrail(){" in out
    assert "if(w<MIN){x0-=(MIN-w)/2;w=MIN;}" in out
    # the trail is thinned as it is collected
    assert "if(Math.abs(p.x-last[0])+Math.abs(p.y-last[1])>=0.35)" in out
    # a stroke takes stroke properties -- and only those. No arrowheads on
    # a scribble, no route: those stay arrow-only in the same table
    assert "'#fmt-stylewrap':'arrow rect draw'," in out
    # tables joined the weight menu on 2026-08-20 (a table's rules are a
    # stroke too); the style menu stayed shape-and-stroke only
    assert "'#fmt-swwrap':'arrow rect draw table'," in out
    assert "'#fmt-headwrap':'arrow'," in out
    assert "'#fmt-bendwrap':'arrow'," in out
    # ...and it is judged by the print check like any other ink
    assert "if(a.k!=='arrow'&&a.k!=='rect'&&a.k!=='draw') return;" in out
    # the Objects pane names it
    assert "if(a.k==='draw') return 'Drawing';" in out
    # it survives PowerPoint as an editable freeform, not a picture
    assert "function drawShape(item, id, page) {" in out
    assert "<a:custGeom>" in out
    assert "'<a:lnTo>' + pt + '</a:lnTo>'" in out
    assert "} else if (item.t === 'draw') {" in out


def test_a_new_poster_opens_blank(out):
    """The 3-column academic template used to be applied at creation, so
    a new poster opened already covered in headings and placeholder
    frames you had to clear before starting your own (2026-08-18, user:
    "opening a poster should open as blank not a default fill"). Even the
    blank slide's full-page ghost frame goes: on a deck it is the
    click-to-fill idiom, but stretched over an A0 sheet it is one more
    thing you did not put there. The templates are all still one click
    away in Layouts. Measured in a browser: a new poster renders with 0
    items on the page.
    """
    body = out.split("function newPoster(){")[1].split("function ")[0]
    assert "applyLayout" not in body
    assert "s.annots=[];" in body


def test_the_save_readout_says_where(out):
    """"autosaved · 12:18" answered the question nobody asked and skipped
    the one that matters -- into the browser? the project? which file?
    (2026-08-18, user: "in the little autosave button, say where saved
    to"). whereSaved() is short and lower-case because it sits
    mid-sentence; targetLabel() stays as the menu heading it is.
    Measured: "saved to browser · 12:36" after a manual save on the
    static page.
    """
    assert "function whereSaved(){" in out
    assert "?((saveKind==='auto'?'autosaved to ':'saved to ')+whereSaved()" in out
    assert "el.textContent='saved to '+whereSaved()+' · '+fmtT(saveStamp);" in out


def test_qr_generator_is_self_contained_and_vector(out):
    """A poster QR must not depend on a third-party service: the encoder
    (byte mode, ECC M, versions 1-10, spec mask scoring) lives in deck.js
    and emits crisp vector SVG. Machine-decode-verified out of band.
    """
    assert "var QR_M_TAB=" in out and "function qrMatrix" in out
    assert "function qrSvgData" in out
    assert "window.SemDeckQr=qrMatrix;" in out
    assert 'id="dc-qr"' in out
    # the v7+ regression: alignment patterns on the timing lines are
    # DRAWN — only the three finder corners are skipped
    assert "(cy<9&&cx<9)||(cy<9&&cx>N-10)||(cy>N-10&&cx<9)" in out
