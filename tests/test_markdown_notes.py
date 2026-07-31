"""Prose cells: how markdown is rendered, how untrusted HTML inside it is
sanitized, and how new notes are written back into the notebook. Bullets,
bold and math survive rendering; note chrome stays minimal (no badge, no
"Note" row when untitled, real tables); an inline <h1> opens a section while
the remainder stays an allowlist-sanitized note with a raw-HTML toggle. The
sanitizer test pins every bypass the adversarial review found. The
write-back half covers the per-card pencil UI and the rule for where an
inserted markdown cell lands relative to the card's own cells.
"""

from __future__ import annotations

from helpers import _note_notebook
from junoview.render.markdown import md_to_html
from junoview.render.sanitize import _sanitize_html
from junoview.server.notebook_edit import insert_note_cell


def test_inline_html_heading_opens_section_and_rest_stays_a_note(doc, out):
    """An <h1> inside a markdown cell still opens a level-1 section.

    The rest of the cell is still a note, allowlist-sanitized, with a
    toggle; inline styles on safe tags survive (previously proven via the
    h1).  The rendered note must not contain a live script tag -- the
    escaped source lives separately in the note-src <pre>.
    """
    assert any(s.title == "Universal" for s in doc.sections)
    assert any(s.title == "Universal" and s.level == 1 for s in doc.sections)
    assert '<div style="color:cyan">styled block</div>' in out
    assert "<p>plain paragraph</p>" in out
    assert 'class="note-src code"' in out and "htmltoggle" in out
    assert "Show raw HTML" in out


def test_sanitize_html_closes_every_known_bypass():
    """Allowlist reconstruction: only safe tags/attrs come back out, and
    every bypass the adversarial review found must stay closed.
    """
    assert _sanitize_html('<img src=x onerror=alert(1)>') \
        == '<img src="x"/>'
    # every bypass the adversarial review found must be closed:
    assert "script" not in _sanitize_html(     # split-tag reassembly
        '<scr<embed>ipt>alert(1)</scr<embed>ipt>').lower()
    assert _sanitize_html(                      # unquoted js URL
        '<a href=javascript:alert(1)>x</a>') == '<a>x</a>'
    assert _sanitize_html(                      # newline-split scheme
        "<a href='javas\ncript:alert(1)'>x</a>") == '<a>x</a>'
    assert "formaction" not in _sanitize_html(  # non-href URL sink
        '<button formaction="javascript:alert(1)">go</button>')
    assert "srcdoc" not in _sanitize_html(      # iframe + srcdoc
        '<iframe srcdoc="&lt;script&gt;x&lt;/script&gt;"></iframe>')
    assert _sanitize_html('<a href="/rel/ok">y</a>') \
        == '<a href="/rel/ok">y</a>'           # safe URLs kept


def test_markdown_notes_keep_lists_bold_and_math(out):
    """Markdown notes: bullets + bold survive, math left for MathJax."""
    assert "<li>point one</li>" in out and "<strong>two</strong>" in out
    # a raw-HTML lead (<b>Title</b>) no longer swallows the "- " bullets
    # under it — the list still renders as a real list
    _mdh = md_to_html("<b>Signal-to-noise</b>\n- Signal is S\n- Noise is N")
    assert "<b>Signal-to-noise</b>" in _mdh
    assert _mdh.count("<li>") == 2 and "<ul>" in _mdh
    assert "- Signal" not in _mdh
    assert "\\bar{z}$" in out  # ' is escaped to &#x27;; DOM text is intact


def test_markdown_notes_keep_minimal_chrome(out):
    """Markdown notes: minimal chrome -- no badge, untitled notes drop the
    "Note" row, hover says markdown, raw-HTML toggle floats minimal,
    and note tables render as real tables."""
    assert "note-untitled" in out
    assert 'content:"markdown"' in out
    assert ".note table{border-collapse:collapse" in out
    assert ".htmltoggle{position:absolute" in out
    assert '.card[data-note="1"] .badge{display:none;}' in out


def test_add_note_ui_is_rendered(out):
    """The UI: pencil per card (app mode only), editor dialog, git box."""
    assert 'id="note-dlg"' in out and 'id="doc-toast"' in out
    assert "function wireAddNote" in out and "'/api/addnote'" in out
    assert "'/api/gitstate'" in out and "card-addnote" in out


def test_insert_note_cell_lands_after_the_cards_cells():
    """A markdown cell lands right after the card's cells.

    Grouped code cards use their LAST member cell; a note card maps back
    through its ``cell:<id>`` anchor; unknown/empty anchors append.
    """
    _r, _i, _cid = insert_note_cell(
        _note_notebook(), "figx", "a **note**")
    assert _i == 3 and _r["cells"][3]["cell_type"] == "markdown" \
        and _r["cells"][3]["source"] == "a **note**" \
        and _r["cells"][3]["id"] == _cid
    _r2, _i2, _ = insert_note_cell(
        _note_notebook(), "load", "mid note")
    assert _i2 == 2 and _r2["cells"][2]["source"] == "mid note"
    _r3, _i3, _ = insert_note_cell(
        _note_notebook(), "cell:m0", "x")
    assert _i3 == 1
    _r4, _i4, _ = insert_note_cell(_note_notebook(), "", "x")
    assert _i4 == 3
    _r5, _i5, _ = insert_note_cell(_note_notebook(), "nope", "x")
    assert _i5 == 3
