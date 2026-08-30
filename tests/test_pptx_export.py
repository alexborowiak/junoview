"""PowerPoint export: the OOXML writer and the deck's translation into it.

A ``.pptx`` is a ZIP of XML parts, and both halves are written from scratch
in ``assets/js/pptx.js`` so the export stays dependency-free like everything
else here. These are string pins against the built page (the suite executes
no JS); the writer itself was verified out-of-band by generating a real A0
poster in a headless browser, unpacking it with :mod:`zipfile`, and opening
it in Microsoft PowerPoint over COM — which reported the right page size,
7 pictures and 9 editable text boxes, and rendered them correctly.
"""

from __future__ import annotations


def test_the_writer_ships_and_is_self_contained(out):
    """The whole OOXML + ZIP implementation is inline in the page. Nothing
    is fetched: an export has to work from a file:// page with no network,
    which is exactly how a shared single-file export is opened.
    """
    assert "window.JunoPptx" in out
    # a stored-entry ZIP, written by hand: local header, central dir, EOCD
    assert "0x04034B50" in out and "0x02014B50" in out and "0x06054B50" in out
    assert "CRC_TABLE" in out and "0xEDB88320" in out
    # the parts PowerPoint refuses to open a file without
    assert "[Content_Types].xml" in out
    assert "ppt/presentation.xml" in out
    assert "ppt/slideMasters/slideMaster1.xml" in out
    assert "ppt/slideLayouts/slideLayout1.xml" in out
    assert "ppt/theme/theme1.xml" in out
    # no CDN, no import: the file is the whole implementation
    assert "cdn." not in out.split("window.JunoPptx")[1][:9000]


def test_page_size_and_font_size_are_derived_from_the_real_page(out):
    """OOXML measures in EMU (36000/mm) and hundredths of a point. Slide
    coordinates arrive as PERCENTAGES, which is how Junoview stores them,
    so an A0 poster and a 16:9 slide use one code path at two scales.
    """
    assert "EMU_PER_MM = 36000" in out
    assert "PT_PER_MM = 72 / 25.4" in out
    assert "'<p:sldSz cx=\"' + page.wEmu + '\" cy=\"' + page.hEmu + '\"/>'" in out
    # font size is a percentage of slide HEIGHT, matching fontPx() in deck.js
    assert "(item.sizePct || 2.6) / 100 * page.hPt" in out


def test_text_becomes_editable_shapes_not_a_picture(out):
    """The point of exporting shapes rather than an image of each slide:
    the text is still text in PowerPoint. Pictures, boxes and arrows get
    their native equivalents too.
    """
    assert "txBox=\"1\"" in out          # a real text box
    assert "<p:pic>" in out              # pictures
    assert "<p:cxnSp>" in out            # lines/arrows are connectors
    # dash presets and arrow ends are emitted through helpers now
    # (2026-08-07, when each gained a choice of styles), so the tag names
    # arrive as arguments rather than as literals at the write site
    assert "a:prstDash" in out
    assert "function endXml" in out
    assert "endXml('headEnd'" in out and "endXml('tailEnd'" in out
    assert "SHAPE_GEOM" in out           # rect/ellipse/diamond/…


def test_menu_entry_and_test_hook(out):
    assert 'id="mi-pptx"' in out
    assert "menuAction('#mi-pptx',function(){exportDeckPptx();});" in out
    assert "window.SemDeckPptx=exportDeckPptx;" in out
    assert "'.pptx'" in out


def test_what_cannot_convert_is_reported_not_silently_dropped(out):
    """A frame showing a table has no PowerPoint equivalent, and a
    hand-drawn crop outline has none either. Both are counted and named
    in the toast, and the count the caller sees is the SUM of what the
    deck could not turn into an item and what the writer could not write
    — reporting one of the two would read as "nothing was lost".

    The crop half narrowed at T107: rectangular trims and preset outlines
    ARE carried now, so only a freehand path is counted. A tally that
    still claimed every crop was lost would be the same dishonesty in the
    other direction.
    """
    assert "note.skipped++" in out and "if(a.crop&&a.crop.path)" in out
    assert "could not convert (code or a table" in out
    assert "skipped:note.skipped+out.skipped" in out
    assert "hand-drawn crop" in out and "not carried" in out


def test_a_crop_and_a_transition_are_handed_to_the_writer(out):
    """The deck half of T107. The writer's own half is checked against
    real bytes in tests/test_pptx_bytes.py; this is the wiring, which no
    ZIP can show is missing — an item that never carries its crop simply
    exports as an uncropped picture, correctly.
    """
    # a path crop has no preset to become, so it is not sent
    assert "crop:(a.crop&&!a.crop.path)?a.crop:null" in out
    assert "cropShape:(a.crop&&!a.crop.path)?a.crop.shape:''" in out
    # transFor is the same answer present mode uses, and ent.i is the
    # SOURCE slide, which matters because a flip book explodes one slide
    # into several output slides
    assert "trans:transFor(ent.i)" in out


def test_prose_and_code_frames_still_come_across_as_text(out):
    """An empty slide is worse than imperfect text: a placed note or code
    cell has no figure to lift, but it IS text, so it becomes a text box.
    A <pre> means the frame is really code (monospace); a bare inline
    <code> is prose with a code span and must NOT go monospace.
    """
    assert "function blockText" in out
    assert "node.querySelector('pre')" in out
    assert "isTable" in out              # tables are reported, not flattened
    assert "'Consolas'" in out


def test_text_extraction_survives_block_elements_and_maths(out):
    """textContent welds paragraphs together ("…reanalysiswould contain"),
    so innerText is used — which needs a genuinely rendered node, hence the
    off-screen mount. MathJax draws CHTML glyphs through CSS ::before, so
    an equation's characters come from its assistive MathML.
    """
    assert "position:absolute;left:-99999px" in out
    assert "visibility:hidden" not in out.split("function blockText")[1][:600]
    assert "mjx-assistive-mml" in out and "mjx-container" in out


def test_default_ink_follows_the_page_background(out):
    """PowerPoint has no CSS cascade, so "no colour set" has to be resolved
    at export time. Baking white would put white text on a white poster —
    the exact bug the live view already had.
    """
    assert "pageIsLight(bg)?'#0b141d':'#ffffff'" in out
    assert "color:tokVal(a.color)||ink" in out


def test_design_tokens_are_resolved_before_the_pptx_writer(out):
    """TASKS T44. The OOXML writer accepts concrete CSS colours, never
    Junoview's ``@name`` references. Resolve every colour-bearing native
    item at this translation boundary while leaving the saved deck intact.
    """
    text = out[out.index("function pptxTextItem("):
               out.index("function pptxItems(")]
    assert "color:tokVal(a.color)||ink" in text
    assert "?tokVal(a.bgc):''" in text

    items = out[out.index("function pptxItems(s,note,ink,layer){"):
                out.index("function exportDeckPptx(){")]
    assert "var lineCol=tokVal(a.color)||'#ff6b57';" in items
    assert "var grad=tokenGradient(a.grad,lineCol);" in items
    assert "fillCol=tokVal(a.fillc)||shapeFill(lineCol," in items
    assert items.count("color:tokVal(a.color)") >= 3  # draw, line, table
    for raw in ("color:a.color", "grad:a.grad", "fillCol=a.fillc"):
        assert raw not in items

    # The structural resolver clones first, resolves every stop and keeps
    # the two-stop projection consumed by pptx.js in sync with that list.
    grad = out[out.index("function tokenGradient(g,col){"):
               out.index("function gradCss(g,col){")]
    assert "var out=deep(g)" in grad
    assert "cp.c=tokVal(st.c)||fallback;" in grad
    assert "out.a=out.stops[0].c;" in grad
    assert "out.b=out.stops[out.stops.length-1].c;" in grad


def test_anchored_boxes_export_at_their_page_position(out):
    """T43. PowerPoint consumes absolute page percentages, while an
    anchored annotation stores offsets from an edge or the centre. Every
    editable box is resolved once at this boundary, using the same
    fallback size that will actually be written -- especially important
    for auto-height bottom-anchored text.
    """
    assert ("var PPTX_DIMS={text:[34,8],image:[30,24],rect:[20,14],"
            "draw:[10,10],") in out
    assert "table:[40,20],flip:[40,32],cell:[30,24]};" in out
    assert "function pptxBox(a,centred){" in out
    assert "var w=a.w||d[0],h=a.h||d[1],p=anchorPos(a,w,h);" in out
    items = out[out.index("function pptxItems(s,note,ink,layer){"):
                out.index("function exportDeckPptx(){")]
    assert "var box=(a.k==='arrow')?null:pptxBox(a,false);" in items
    assert items.count("x:box.x,y:box.y,w:box.w,h:box.h") == 7
    assert "x:a.x,y:a.y" not in items


def test_pdf_export_says_it_prints_at_true_page_size(out):
    """The PDF path already handled posters correctly; what it lacked was
    anyone knowing. The menu now says so.
    """
    assert "TRUE size" in out
    assert "841&#215;1189mm" in out or "841×1189mm" in out


def test_a_deck_equation_is_flattened_rather_than_shipped_as_latex(out):
    """A text box built by the Maths button went into the .pptx as the
    literal "$$ E = mc^2 $$", dollar signs and all, and the export's own
    "Equations came across as plain text" warning stayed silent -- it was
    only ever raised for maths inside a notebook CELL (2026-08-26 audit,
    T53).

    Flattened from the SOURCE rather than from the rendered MathJax that
    blockText lifts for cells: only the slide on screen has typeset
    output and this export is synchronous, so reading the DOM would give
    characters on one slide and raw LaTeX on the next.
    """
    assert "function mathsPlain(src,sure){" in out
    assert "function texPlain(src){" in out
    # both branches that carry deck words, not just one
    assert "var tp=mathsPlain(ti.text,!!a.maths);" in out
    assert "var mp=mathsPlain(val,false);" in out
    assert out.count("note.maths++") == 3      # cell, text box, title
    # ...and the toast now counts them and says why
    assert "came across as plain text \\u2014 " in out
    assert "PowerPoint has no LaTeX, so they were flattened" in out


def test_prose_dollars_are_not_mistaken_for_maths_by_the_export(out):
    """"It cost $5 and $10" matches the render gate's inline pattern, and
    the gate can afford that -- the cost is a needless MathJax pass. The
    export cannot: it REWRITES the words. So an inline pair only counts
    when its body actually reads as TeX, and a box the Maths button built
    says so for itself.
    """
    assert "function texish(b){return /\\\\[A-Za-z]|[\\^_]/.test(b||'');}" \
        in out
    assert "if(disp===undefined&&!sure&&!texish(body)) return all;" in out


def test_the_flattening_vocabulary_is_the_palette_the_app_offers(out):
    """What the equation palette offered to write is what the export
    undertakes to read back. Anything else keeps its command word,
    spelled without the backslash, which is still the name of what it is.
    """
    assert "var TEX_CHAR={" in out and "var TEX_SUP={" in out
    assert "var TEX_SUB={" in out
    # the structures no single run of text can otherwise express
    assert "?('('+num+')/('+texPlain(g2[0])+')')" in out
    assert "out+=root+'\u221a('+(g?texPlain(g[0]):'')+')';" in out
    # a power lifts to real superscript characters where they exist, and
    # falls back to ^(...) where they do not -- never silently dropped
    assert "out+=(lifted!==null)?lifted:(c0+'('+inner+')');" in out
    # the space after a command word is LaTeX's delimiter, and is only
    # eaten when that is the only job it was doing
    assert "if(/^ [A-Za-z0-9]/.test(rest)) rest=rest.slice(1);" in out
