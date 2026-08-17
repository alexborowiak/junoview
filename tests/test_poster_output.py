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
    assert 'id="mi-pagebg"' in out and 'class="pgbg-sw"' in out
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
    assert "tool==='rect'||tool==='arrow'||tool==='line'" in out
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
    assert "function fileToRibbon" in out and "function fileToPanel" in out
    assert "if(editing) fileToRibbon(); else fileToPanel();" in out
    assert ".deck.editing .deck-create{display:none!important;}" in out
    assert 'id="fmt-txcol-btn"' in out and 'id="fmt-fillcol-btn"' in out
    assert 'id="fmt-txcol-menu"' in out and 'id="fmt-fillcol-menu"' in out
    assert "show('#fmt-fillcol-btn',showBg);" in out
    # picking a swatch closes its popup; the custom swatch keeps its panel
    assert "if(sw&&!sw.classList.contains('sw-custom')){" in out


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
