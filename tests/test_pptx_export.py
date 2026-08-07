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
    """A frame showing a table has no PowerPoint equivalent and a crop is a
    CSS clip-path, not a picture crop. Both are counted and named in the
    toast, and the count the caller sees is the SUM of what the deck could
    not turn into an item and what the writer could not write — reporting
    one of the two would read as "nothing was lost".
    """
    assert "note.skipped++" in out and "note.cropped++" in out
    assert "could not convert (code or a table" in out
    assert "skipped:note.skipped+out.skipped" in out
    assert "not carried" in out


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
    assert "color:a.color||ink" in out


def test_pdf_export_says_it_prints_at_true_page_size(out):
    """The PDF path already handled posters correctly; what it lacked was
    anyone knowing. The menu now says so.
    """
    assert "TRUE size" in out
    assert "841&#215;1189mm" in out or "841×1189mm" in out
