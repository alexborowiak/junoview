"""Sources other than Jupyter (TASKS T91).

"Something for things like Overleaf, Excel etc."

The claim these pin is the one that made the task small: everything
downstream of the parser speaks ``Document`` and knows nothing about
notebooks, so a new source is a producer and nothing else. If that ever
stops being true, these break first.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from junoview.notebook.sources import (
    SOURCES,
    doc_from_text,
    parse_latex,
    parse_markdown,
    parse_table,
    source_label,
)

MD = """\
# A climate note

Some **prose** with a $\\sigma$ in it.

## Method

```python
import numpy as np
```

![The trend](fig/trend.png)

The trend over the record.

### A detail

More words.
"""

TEX = r"""
\documentclass{article}
\title{A Warming Record}
\begin{document}
Opening prose with \textbf{emphasis} and \cite{smith2020}.

\section{Method}
We did the thing. % a comment nobody should ever see
\begin{figure}
  \includegraphics[width=0.8\textwidth]{fig/trend.pdf}
  \caption{The trend over the record.}
  \label{fig:trend}
\end{figure}

\subsection{Detail}

\begin{table}
  \caption{Station counts.}
\end{table}

\begin{equation}
  E = mc^2
\end{equation}
\end{document}
"""


def _items(doc):
    return [it for s in doc.sections for it in s.items]


def _kinds(doc):
    return [it.kind for it in _items(doc)]


# ---------------------------------------------------------------------------
# markdown
# ---------------------------------------------------------------------------

def test_markdown_headings_become_sections_and_subsections():
    """Two tiers, because the card model has two. A document using six
    levels still has to put its fifth somewhere, and "the nearest tier
    above" is the only answer that never loses one."""
    doc = parse_markdown(MD)
    # `#` and `##` open a section; `###` and deeper are subsections
    assert [s.title for s in doc.sections] == ["A climate note", "Method"]
    assert any(it.subsection == "A detail" for it in _items(doc))


def test_a_fenced_block_is_a_code_card_that_knows_its_language():
    doc = parse_markdown(MD)
    code = [it for it in _items(doc) if it.kind == "code"]
    assert len(code) == 1
    assert code[0].code_kind == "python"
    assert "import numpy" in code[0].steps[0].code


def test_a_lone_image_is_a_figure_and_the_next_paragraph_is_its_caption():
    """How people actually write a figure in markdown: the picture, then
    the sentence about it."""
    doc = parse_markdown(MD)
    figs = [it for it in _items(doc) if it.kind == "figure"]
    assert len(figs) == 1
    assert 'src="fig/trend.png"' in figs[0].outputs[0].payload
    assert figs[0].caption == "The trend over the record."
    assert figs[0].outputs[0].has_image


def test_markdown_leaves_maths_alone_for_the_page_to_typeset():
    doc = parse_markdown(MD)
    notes = [it for it in _items(doc) if it.kind == "note"]
    assert any("\\sigma" in it.caption for it in notes)


def test_prose_before_any_heading_still_lands_somewhere():
    """And in the `sec ` slug namespace, so a heading can never steal a
    card's id -- deck frames point at card ids."""
    doc = parse_markdown("just a sentence, no heading at all\n")
    assert len(doc.sections) == 1
    assert doc.sections[0].section_id.startswith("sec-")
    assert _kinds(doc) == ["note"]


# ---------------------------------------------------------------------------
# LaTeX
# ---------------------------------------------------------------------------

def test_latex_takes_its_title_from_the_document():
    assert parse_latex(TEX).title == "A Warming Record"


def test_latex_sections_and_environments_become_cards():
    doc = parse_latex(TEX)
    assert [s.title for s in doc.sections] == ["Overview", "Method"]
    kinds = _kinds(doc)
    assert "figure" in kinds
    assert "dataset" in kinds        # the table environment
    figs = [it for it in _items(doc) if it.kind == "figure"]
    # NOT an <img src="fig/trend.pdf">. This assertion used to check the
    # string survived, which it did -- into an <img> no browser can draw,
    # because \includegraphics{...pdf} is the ordinary case in a LaTeX
    # project and a PDF is not a web image (T101). The card now names the
    # file it cannot draw.
    body = figs[0].outputs[0].payload
    assert "<img" not in body
    assert "trend.pdf" in body and "PDF" in body
    assert figs[0].outputs[0].has_image is False
    assert figs[0].caption == "The trend over the record."


def test_latex_comments_never_reach_the_page():
    """A `%` comment is the author talking to themselves."""
    doc = parse_latex(TEX)
    assert all("nobody should ever see" not in (it.caption or "")
               for it in _items(doc))


def test_an_equation_stays_latex_because_the_page_typesets_it():
    """Stripping the maths out of a maths document would be throwing away
    the one part of it this tool renders properly."""
    doc = parse_latex(TEX)
    assert any("E = mc^2" in (it.caption or "") for it in _items(doc))
    assert any((it.caption or "").startswith("$$") for it in _items(doc))


def test_a_nested_environment_does_not_swallow_the_document():
    """A figure holding a subfigure is ordinary; stopping at the first
    \\end would take everything after it with it."""
    src = (r"\section{S}" "\n"
           r"\begin{figure}\begin{figure}"
           r"\includegraphics{a.png}\end{figure}"
           r"\caption{Outer}\end{figure}" "\n"
           "trailing prose that must survive\n")
    doc = parse_latex(src)
    assert any("trailing prose that must survive" in (it.caption or "")
               for it in _items(doc))


# ---------------------------------------------------------------------------
# delimited text
# ---------------------------------------------------------------------------

def test_a_csv_becomes_one_dataset_card_stating_its_shape():
    doc = parse_table("station,year,anomaly\nLeeds,2020,1.2\nYork,2020,0.9\n",
                      title="data")
    items = _items(doc)
    assert len(items) == 1 and items[0].kind == "dataset"
    body = items[0].outputs[0].payload
    assert "<th>station</th>" in body
    assert "<td>Leeds</td>" in body
    assert items[0].caption == "2 rows × 3 columns."


def test_a_tab_separated_file_is_read_as_one():
    doc = parse_table("a\tb\n1\t2\n", title="t", delim="\t")
    assert "<th>a</th>" in _items(doc)[0].outputs[0].payload


def test_a_single_column_file_is_not_guessed_into_pieces():
    """csv.Sniffer is confident and often wrong here -- it will decide a
    column of times is colon-delimited."""
    doc = parse_table("when\n09:15\n10:30\n", title="t")
    body = _items(doc)[0].outputs[0].payload
    assert "<th>when</th>" in body
    assert "<td>09:15</td>" in body


def test_a_huge_table_says_what_it_left_out():
    """A table silently showing its first 500 rows is a table lying about
    the file."""
    rows = "\n".join(f"{i},{i * 2}" for i in range(900))
    doc = parse_table("a,b\n" + rows + "\n", title="t")
    item = _items(doc)[0]
    assert "900 rows" in item.caption
    assert "Showing the first 500 of 900 rows" in item.outputs[0].payload


def test_cell_contents_are_escaped():
    doc = parse_table('a\n"<script>alert(1)</script>"\n', title="t")
    body = _items(doc)[0].outputs[0].payload
    assert "<script>" not in body
    assert "&lt;script&gt;" in body


# ---------------------------------------------------------------------------
# the registry
# ---------------------------------------------------------------------------

def test_the_registry_is_the_one_list_of_what_can_be_opened():
    for suffix in (".ipynb", ".md", ".qmd", ".tex", ".csv", ".tsv"):
        assert suffix in SOURCES
    assert source_label("paper.tex") == "LaTeX"
    assert source_label("x.xlsx") == ""      # deliberately not supported


def test_dispatch_goes_by_suffix():
    assert _kinds(doc_from_text("notes.md", MD)).count("figure") == 1
    assert doc_from_text("paper.tex", TEX).title == "A Warming Record"
    assert _kinds(doc_from_text("d.csv", "a,b\n1,2\n")) == ["dataset"]


def test_an_unknown_suffix_reads_as_markdown_rather_than_refusing():
    """The files that arrive without a suffix we know are READMEs, notes
    and pasted prose. Markdown renders plain text as plain text; refusing
    renders nothing."""
    doc = doc_from_text("README", "hello there\n")
    assert _kinds(doc) == ["note"]


def test_a_broken_notebook_still_fails_loudly():
    """The one source that CAN fail: a notebook that is not JSON is
    broken, not unusual."""
    with pytest.raises(json.JSONDecodeError):
        doc_from_text("x.ipynb", "not json at all")


@pytest.mark.parametrize("junk", [
    "", "\n\n\n", "#", "```", "```python", "\\begin{figure}",
    "\\section{", "a,b\n", '"unclosed', "\x00\x01",
])
def test_no_producer_raises_on_ugly_input(junk):
    """These files are written by hand and pasted from anywhere. A source
    that refuses to open is worse than one that opens with the odd
    paragraph in the wrong place."""
    for name in ("x.md", "x.tex", "x.csv"):
        doc = doc_from_text(name, junk)
        assert doc.sections is not None


# ---------------------------------------------------------------------------
# end to end
# ---------------------------------------------------------------------------

def test_a_tex_file_renders_a_whole_page(tmp_path: Path):
    """The point of the whole task: nothing downstream needed changing."""
    from junoview.notebook.loader import render_notebook_file

    src = tmp_path / "paper.tex"
    src.write_text(TEX, encoding="utf-8")
    out = render_notebook_file(src)
    assert out.startswith("<!doctype html>")
    assert "A Warming Record" in out
    assert "trend.pdf" in out                # named, not drawn (T101)
    assert "The trend over the record" in out


def test_a_csv_renders_a_whole_page(tmp_path: Path):
    from junoview.notebook.loader import render_notebook_file

    src = tmp_path / "data.csv"
    src.write_text("station,anomaly\nLeeds,1.2\n", encoding="utf-8")
    out = render_notebook_file(src)
    assert "<th>station</th>" in out
    assert "<td>Leeds</td>" in out


def test_the_web_bridge_opens_them_too():
    """One producer table, three doors -- the CLI, the app and the
    Pyodide build. A JavaScript parser for each new format would be a
    second answer to "what is a section"."""
    from junoview.web import web_parse

    shell = web_parse("paper.tex", TEX, "[]")
    assert "A Warming Record" in shell
    shell = web_parse("data.csv", "a,b\n1,2\n", "[]")
    assert "<th>a</th>" in shell


def test_the_browsers_drop_list_matches_the_registry():
    """The one thing here that can rot silently. app.js decides which
    dropped files are worth handing to Python; sources.py decides what
    Python can do with them. A file the browser filters out never
    reaches the message that would have explained it -- it just does
    nothing, which is the worse failure."""
    import re as _re

    from junoview import assets

    js = assets.app_js()
    m = _re.search(r"var SRC_RE=/\\.\(([^)]*)\)\$/i;", js)
    assert m, "app.js no longer declares SRC_RE the way this test reads it"
    in_js = {"." + s for s in m.group(1).split("|")}
    assert in_js == set(SOURCES), (
        f"app.js accepts {sorted(in_js)} but sources.py handles "
        f"{sorted(SOURCES)}")


# ---------------------------------------------------------------------------
# the app's doors (T100)
# ---------------------------------------------------------------------------
#
# T91 built the producers and every door EXCEPT the local app's. The
# result was a file that opened from the CLI and from the web build and
# was refused by the desktop app -- the same file, the same parser, three
# answers. These pin each door against the registry rather than against a
# hand-written list, because a second list is how they drifted apart.


def test_the_file_browser_lists_every_source_it_can_open(tmp_path: Path):
    """A file the browser does not list has no door at all: there is no
    error to read, because nothing was ever offered."""
    from junoview.server.state import _list_dir

    for name in ("book.ipynb", "notes.md", "paper.tex", "data.csv",
                 "grid.tsv", "story.qmd", "photo.png"):
        (tmp_path / name).write_text("x", encoding="utf-8")
    (tmp_path / "sub").mkdir()

    listing = _list_dir(str(tmp_path))
    assert [n["name"] for n in listing["notebooks"]] == ["book.ipynb"]
    assert {s["name"] for s in listing["sources"]} == {
        "notes.md", "paper.tex", "data.csv", "grid.tsv", "story.qmd"}
    # the KIND comes off SOURCES, so the browser cannot label a file
    # something the parser disagrees with
    kinds = {s["name"]: s["kind"] for s in listing["sources"]}
    assert kinds["paper.tex"] == "LaTeX"
    assert kinds["data.csv"] == "Table"
    # and nothing unopenable is offered
    assert all(s["name"] != "photo.png" for s in listing["sources"])


def test_every_registered_suffix_is_listed(tmp_path: Path):
    """The parity that matters: add a producer, get a door, for free."""
    from junoview.server.state import _list_dir

    for i, suffix in enumerate(SOURCES):
        (tmp_path / f"f{i}{suffix}").write_text("x", encoding="utf-8")
    listing = _list_dir(str(tmp_path))
    offered = {Path(n["name"]).suffix.lower()
               for n in listing["notebooks"] + listing["sources"]}
    assert offered == set(SOURCES)


def test_the_open_route_accepts_a_source_and_the_note_route_does_not(
        tmp_path: Path):
    """The split that keeps this safe.

    ``_resolve_src_path`` gates opening; ``_resolve_nb_path`` still gates
    the routes that read notebook JSON -- inserting a note cell rewrites
    cells, and a git version parses a blob as a notebook. Widening one
    resolver for both would have handed those files they cannot parse.
    """
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    Handler = _make_handler(_AppState(tmp_path))
    # BaseHTTPRequestHandler.__init__ wants a live socket; the resolvers
    # reach `state` through the closure only, so an uninitialised instance
    # is enough and needs no server running
    h = Handler.__new__(Handler)
    src = tmp_path / "paper.tex"
    src.write_text("\\section{Hi}\nprose\n", encoding="utf-8")

    assert h._resolve_src_path(str(src)) == src.resolve()
    with pytest.raises(ValueError):
        h._resolve_nb_path(str(src))

    # and something with no producer is refused by BOTH
    other = tmp_path / "photo.png"
    other.write_bytes(b"x")
    with pytest.raises(ValueError):
        h._resolve_src_path(str(other))


def test_a_dropped_source_parses_through_the_producer_table(tmp_path: Path):
    """/api/parse is the door for a file the server cannot read: the
    browser holds it, so only its text arrives."""
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    Handler = _make_handler(_AppState(tmp_path))
    h = Handler.__new__(Handler)
    out = h._parse_nb({"name": "paper.tex", "text": TEX})
    assert "A Warming Record" in out["shell"]

    out = h._parse_nb({"name": "d.csv", "text": "a,b\n1,2\n"})
    assert "<th>a</th>" in out["shell"]

    # the older shape still works, for a tab opened before a reload
    nb = {"cells": [{"cell_type": "markdown", "id": "m",
                     "source": "hello"}]}
    out = h._parse_nb({"name": "x.ipynb", "nb": nb})
    assert "hello" in out["shell"]

    with pytest.raises(ValueError):
        h._parse_nb({"name": "x.ipynb"})


def test_a_source_keeps_a_version_history_of_its_own_kind(tmp_path: Path):
    """Snapshots are keyed on the file's own suffix, so opening a .tex
    keeps history instead of silently keeping none -- and two sources
    sharing a stem do not list each other's."""
    from junoview.server.notebook_edit import _store_version, _versions_dir

    tex = tmp_path / "paper.tex"
    tex.write_text("one", encoding="utf-8")
    nb = tmp_path / "paper.ipynb"
    nb.write_text("{}", encoding="utf-8")
    _store_version(tex)
    _store_version(nb)
    tex.write_text("two", encoding="utf-8")
    _store_version(tex)

    d = _versions_dir(tex)
    assert len(list(d.glob("*.tex"))) == 2
    assert len(list(d.glob("*.ipynb"))) == 1


def test_every_door_in_app_js_asks_the_same_question():
    """SRC_RE is the browser's copy of the registry, and the test above
    pins it to SOURCES. This pins that the doors USE it: before T100 it
    existed and the drop handler and the typed-path branch both carried
    their own ipynb-only regex instead, so widening SRC_RE changed
    nothing a user could reach.
    """
    from junoview import assets

    js = assets.app_js()
    # the window drop handler
    assert "files.filter(function(f){return SRC_RE.test(f.name);})" in js
    assert r"/\.ipynb$/i.test(f.name)" not in js
    # the typed path in the Open dialog
    assert "if(isUrl(v)||SRC_RE.test(v)||isDeckPath(v)) openPath(v);" in js
    # and app mode posts the file's text, so /api/parse can dispatch
    assert "api('/api/parse',{name:f.name,text:txt})" in js


def test_the_doors_say_what_they_accept():
    """Three strings promised .ipynb only. The one in page.html that a
    user never sees is deliberately NOT the fix: showDlg overwrites the
    placeholder on every open, so editing the attribute alone would have
    changed nothing."""
    from junoview import assets

    js, page = assets.app_js(), assets.page_template()
    assert ".md/.tex/" in js or "notebook/.md/.tex/" in js
    assert "Markdown, LaTeX or csv files anywhere" in js
    assert "<b>.md</b>" in page
    assert "accept=\".ipynb,.md,.markdown,.qmd,.tex,.latex,.csv,.tsv," in page


# ---------------------------------------------------------------------------
# figures beside the source (T101)
# ---------------------------------------------------------------------------
#
# A .md or a .tex refers to its figures by a path relative to ITSELF. The
# producer emitted that path verbatim, so it resolved against wherever the
# OUTPUT landed -- right only when the two sit in the same directory, and
# a 404 in the app, where nothing serves the source's folder at all.


def test_a_figure_beside_a_markdown_file_is_embedded(tmp_path: Path):
    """The page shows the figure wherever it is later saved, which is
    what every other figure in this tool already does."""
    from junoview.notebook.loader import load_doc

    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000a49444154789c6360000002000100ffff03000006000557bfabd400"
        "00000049454e44ae426082")
    (tmp_path / "fig").mkdir()
    (tmp_path / "fig" / "trend.png").write_bytes(png)
    (tmp_path / "notes.md").write_text(
        "# Notes\n\n![The trend](fig/trend.png)\n\nProse.\n",
        encoding="utf-8")

    doc = load_doc(tmp_path / "notes.md")
    fig = [it for it in _items(doc) if it.kind == "figure"][0]
    body = fig.outputs[0].payload
    # wrapped in .figframe, which is what makes the deck editor treat it
    # as a figure at all (T122) -- not decoration
    assert body.startswith('<div class="figframe" data-pt="image">')
    assert '<img src="data:image/png;base64,' in body
    assert "fig/trend.png" not in body
    assert fig.outputs[0].has_image is True


def test_an_unresolvable_path_is_still_left_exactly_as_written(tmp_path: Path):
    """A relative path is RIGHT when the page sits beside its figures.
    Rewriting it to a guess would be wrong in a way that is harder to
    see, so a reference that finds nothing is left alone."""
    from junoview.notebook.loader import load_doc

    (tmp_path / "notes.md").write_text(
        "![A](fig/missing.png)\n", encoding="utf-8")
    doc = load_doc(tmp_path / "notes.md")
    body = [it for it in _items(doc) if it.kind == "figure"][0]\
        .outputs[0].payload
    assert 'src="fig/missing.png"' in body


def test_with_no_directory_to_look_in_nothing_is_resolved():
    """The Pyodide build has no filesystem, and a dropped file has no
    home. base=None is the default for exactly that reason."""
    doc = doc_from_text("notes.md", "![A](fig/trend.png)\n")
    body = [it for it in _items(doc) if it.kind == "figure"][0]\
        .outputs[0].payload
    assert 'src="fig/trend.png"' in body


def test_a_pdf_figure_says_so_instead_of_drawing_a_broken_icon(tmp_path):
    r"""\includegraphics{trend.pdf} is the ordinary case in a LaTeX
    project, and a browser will not render a PDF in an <img>."""
    from junoview.notebook.loader import load_doc

    (tmp_path / "trend.pdf").write_bytes(b"%PDF-1.4\n")
    (tmp_path / "p.tex").write_text(
        "\\begin{figure}\\includegraphics{trend.pdf}"
        "\\caption{C}\\end{figure}\n", encoding="utf-8")
    body = [it for it in _items(load_doc(tmp_path / "p.tex"))
            if it.kind == "figure"][0].outputs[0].payload
    assert "<img" not in body
    assert "trend.pdf" in body and "PDF" in body


def test_an_extensionless_graphic_finds_the_file_latex_would(tmp_path):
    r"""LaTeX writes \includegraphics{fig/trend} with no suffix and lets
    the engine choose. The raster forms are tried before the PDF, because
    the PDF can only be named."""
    from junoview.notebook.loader import load_doc

    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000a49444154789c6360000002000100ffff03000006000557bfabd400"
        "00000049454e44ae426082")
    (tmp_path / "fig").mkdir()
    (tmp_path / "fig" / "trend.png").write_bytes(png)
    (tmp_path / "fig" / "trend.pdf").write_bytes(b"%PDF-1.4\n")
    (tmp_path / "p.tex").write_text(
        "\\begin{figure}\\includegraphics{fig/trend}\\end{figure}\n",
        encoding="utf-8")
    body = [it for it in _items(load_doc(tmp_path / "p.tex"))
            if it.kind == "figure"][0].outputs[0].payload
    assert '<img src="data:image/png;base64,' in body
    assert body.startswith('<div class="figframe"')


def test_a_figure_naming_no_file_does_not_ask_for_the_page_itself():
    """\begin{figure} with no \\includegraphics used to emit
    <img src="">, which asks the browser to re-fetch the PAGE and draw
    it as an image."""
    doc = parse_latex(
        "\\begin{figure}\\caption{Empty}\\end{figure}\n")
    body = [it for it in _items(doc) if it.kind == "figure"][0]\
        .outputs[0].payload
    assert "<img" not in body
    assert 'src=""' not in body


def test_an_oversized_figure_keeps_its_path_rather_than_doubling(tmp_path):
    """Base64 is 4/3 the size. Past the cap a missing picture costs less
    than the page it would make."""
    from junoview.notebook import sources

    big = tmp_path / "big.png"
    big.write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 64)
    old = sources._EMBED_CAP
    try:
        sources._EMBED_CAP = 8
        body = sources._img_body("big.png", "A", tmp_path)
    finally:
        sources._EMBED_CAP = old
    assert 'src="big.png"' in body


def test_a_notebook_ignores_the_directory_it_came_from(tmp_path):
    """Every producer takes `base` so doc_from_text need not know which
    ones care. A notebook carries its outputs inside itself."""
    nb = '{"cells": [{"cell_type": "markdown", "id": "m", '\
         '"source": "hi"}]}'
    doc = doc_from_text("x.ipynb", nb, base=tmp_path)
    assert _kinds(doc) == ["note"]


# ---------------------------------------------------------------------------
# front matter, tables and inline images (T102)
# ---------------------------------------------------------------------------
#
# The markdown producer is a small adapter and stays one. These are the
# three gaps that made an ordinary file render wrongly rather than
# plainly: a Quarto header printed as prose, a table printed as pipes,
# and a link printed as its own source.


def test_front_matter_gives_the_document_its_title():
    """parse_latex has read \\title{} since T91. A markdown file whose
    title is in its front matter was called by its filename, with the
    front matter itself printed as body text."""
    doc = doc_from_text("notes.md",
                        "---\ntitle: A Warming Record\nauthor: AB\n---\n"
                        "\n# Intro\n\nProse.\n")
    assert doc.title == "A Warming Record"
    body = " ".join(it.caption for it in _items(doc))
    assert "author" not in body and "AB" not in body


def test_an_explicit_title_still_wins_over_front_matter():
    doc = doc_from_text("notes.md", "---\ntitle: From the file\n---\n",
                        title="From the caller")
    assert doc.title == "From the caller"


def test_an_unclosed_fence_is_not_front_matter():
    """A file that opens with a horizontal rule is not a file with a
    header, and eating the rest of it would be the worst possible
    reading."""
    doc = doc_from_text("notes.md", "---\nnot closed\n\n# Real\n")
    assert doc.title == "Untitled document"
    # nothing was eaten: the prose still lands (in the implicit opening
    # section, as any prose before the first heading does) and the
    # heading still opens its own
    assert "Real" in [sec.title for sec in doc.sections]
    assert any("not closed" in it.caption for it in _items(doc))


def test_a_pipe_table_becomes_the_same_card_a_csv_becomes():
    """Two kinds of table in one tool would be two things to style, two
    things to export and two things to get wrong."""
    doc = doc_from_text(
        "notes.md",
        "| Station | Anomaly |\n|---------|---------|\n"
        "| Leeds   | 1.2     |\n| York    | 0.9     |\n")
    tables = [it for it in _items(doc) if it.kind == "dataset"]
    assert len(tables) == 1
    body = tables[0].outputs[0].payload
    assert body.startswith('<table class="jv-tbl">')
    assert "<th>Station</th>" in body and "<td>Leeds</td>" in body
    assert "2 rows" in tables[0].caption


def test_pipes_without_a_rule_under_them_are_just_prose():
    """The row of dashes is what makes it a table. A sentence with a
    pipe in it is a sentence."""
    doc = doc_from_text("notes.md", "a | b is not a table\n")
    assert [it.kind for it in _items(doc)] == ["note"]


def test_an_inline_image_and_link_render(tmp_path: Path):
    """These ran through untouched and printed as their own source."""
    from junoview.render.markdown import md_to_html

    out = md_to_html("See ![the trend](fig/t.png) and "
                     "[the paper](https://example.org).")
    assert '<img src="fig/t.png" alt="the trend"' in out
    assert '<a href="https://example.org">the paper</a>' in out


def test_an_inline_url_scheme_is_held_to_the_same_allowlist():
    """The rewrite reuses _url_ok, the sanitizer's own policy, rather
    than inventing a second one. A blocked URL is left as the literal
    text it was, which is visible and harmless."""
    from junoview.render.markdown import md_to_html

    out = md_to_html("[click](javascript:alert(1))")
    assert "<a" not in out
    assert "javascript:alert(1)" in out
    # data: images are how every notebook figure already arrives
    assert "<img" in md_to_html("![a](data:image/png;base64,AA==)")


def test_the_image_rule_runs_before_the_link_rule():
    """A link rule reaching ![alt](src) first would leave a stray `!`."""
    from junoview.render.markdown import md_to_html

    out = md_to_html("![a](x.png)")
    assert "!<a" not in out and "<img" in out


# ---------------------------------------------------------------------------
# align, tabular and cross-references (T103)
# ---------------------------------------------------------------------------
#
# _tex_plain says outright that it is not a TeX engine and that stays
# true. These are the three things a paper does on every page that the
# producer was printing as source: an aligned derivation, a table, and a
# cross-reference.

TEX_TABLE = r"""
\begin{table}
  \caption{Stations used.}
  \label{tab:stations}
  \begin{tabular}{lrr}
    \toprule
    Station & Anomaly & Years \\
    \midrule
    Leeds & 1.2 & 40 \\
    York  & 0.9 & 38 \\
    \bottomrule
  \end{tabular}
\end{table}
"""


def test_a_tabular_becomes_a_real_table():
    """It used to be dumped as escaped LaTeX in a <pre>: readable only
    to someone who can already read LaTeX, which is not who is looking
    at a rendered page."""
    doc = parse_latex(TEX_TABLE)
    body = [it for it in _items(doc) if it.kind == "dataset"][0]\
        .outputs[0].payload
    assert body.startswith('<table class="jv-tbl">')
    assert "<th>Station</th>" in body
    assert "<td>Leeds</td>" in body and "<td>1.2</td>" in body
    # the rules are formatting, not data
    assert "toprule" not in body and "midrule" not in body
    # and neither is the column spec
    assert "lrr" not in body


def test_a_table_with_no_tabular_still_shows_its_source():
    """Some table environments hold a graphic or a package's own macro.
    Falling back to the old <pre> beats showing nothing."""
    doc = parse_latex(r"\begin{table}\caption{C}"
                      r"\includegraphics{t.png}\end{table}")
    body = [it for it in _items(doc) if it.kind == "dataset"][0]\
        .outputs[0].payload
    assert "<pre" in body


def test_align_keeps_its_alignment():
    r"""`align` is a display environment MathJax will not find inside
    $$. Its inline-able twin is `aligned`; without it every & and \\
    printed as itself."""
    doc = parse_latex(r"\begin{align} a &= b \\ &= c \end{align}")
    cap = [it for it in _items(doc) if it.is_note][0].caption
    assert cap.startswith("$$\\begin{aligned}")
    assert cap.endswith("\\end{aligned}$$")
    assert "&=" in cap
    # one line: md_to_html joins a multi-line paragraph with <br>, and an
    # element inside the maths stops MathJax
    assert "\n" not in cap


def test_a_plain_equation_is_left_exactly_as_it_was():
    doc = parse_latex(r"\begin{equation} E = mc^2 \end{equation}")
    cap = [it for it in _items(doc) if it.is_note][0].caption
    assert cap == "$$E = mc^2$$"


def test_a_ref_becomes_a_link_to_the_card_it_names():
    """A forward reference is ordinary in a paper, so refs are marked
    during the read and resolved once at the end. The link is markdown
    because note captions render through md_to_html -- which only
    started rendering links at T102."""
    doc = parse_latex(
        r"See Figure~\ref{fig:trend}." + "\n" + TEX)
    note = [it for it in _items(doc) if it.is_note][0]
    assert "](#fig-trend)" in note.caption
    assert "The trend over the record." in note.caption


def test_an_unknown_ref_reads_exactly_as_it_used_to():
    """The marker must never leak. A label that does not exist falls
    back to the bracketed key that was there before T103."""
    doc = parse_latex(r"See \ref{nosuch} here.")
    cap = [it for it in _items(doc) if it.is_note][0].caption
    assert "[nosuch]" in cap
    assert "\ue000" not in cap and "\ue001" not in cap


def test_a_citation_is_still_only_a_key():
    """A .bib is a second input file and load_doc has no slot for one,
    so \\cite has nowhere to resolve to and says so by staying a key."""
    doc = parse_latex(r"As \cite{smith2020} showed.")
    assert "[smith2020]" in [it for it in _items(doc) if it.is_note][0].caption


def test_the_preamble_is_not_prose():
    r"""\title was printed as a paragraph AND read as the document's
    title, so every .tex opened with its own title twice."""
    doc = parse_latex("\\documentclass{article}\n"
                      "\\usepackage[utf8]{inputenc}\n"
                      "\\title{A Warming Record}\n"
                      "\\author{AB}\n"
                      "\\begin{document}\\maketitle\nReal prose.\n"
                      "\\end{document}")
    assert doc.title == "A Warming Record"
    body = " ".join(it.caption for it in _items(doc))
    assert "Real prose." in body
    for gone in ("documentclass", "usepackage", "\\title", "AB",
                 "maketitle"):
        assert gone not in body, gone


def test_a_source_figure_wears_the_same_wrapper_a_notebook_figure_does():
    """The class is what makes the deck editor SEE a figure (T122).

    ``cellFacets`` decides whether a card has a figure by looking for
    ``.figframe/.figpager/.plotframe`` in its body, and
    ``applyPartFilter`` strips a body it does not recognise -- so a bare
    ``<img>`` here meant a slide frame bound to a .tex figure resolved
    its title and drew an empty box. Everything else in that chain was
    already source-agnostic.

    Verified in the real app 2026-08-31: the frame came back
    ``an-item an-cell an-figonly`` with a ``.cb-part cb-fig`` body and
    the picture drawn. Before the wrapper, the same frame had an empty
    ``.cardbody``.
    """
    doc = doc_from_text("notes.md", "![A trend](fig/t.png)\n")
    out = [it for it in _items(doc) if it.kind == "figure"][0].outputs[0]
    assert out.payload.startswith('<div class="figframe" data-pt="image">')
    assert "<img " in out.payload
    assert out.has_image is True


def test_something_a_browser_cannot_draw_is_not_wrapped_as_a_figure():
    """A PDF figure and an empty reference are NOT figures the deck can
    place, and claiming otherwise would put an empty frame on a slide --
    which is the bug this fixes, in the other direction."""
    doc = parse_latex(r"\begin{figure}\includegraphics{t.pdf}"
                      r"\caption{C}\end{figure}")
    out = [it for it in _items(doc) if it.kind == "figure"][0].outputs[0]
    assert "figframe" not in out.payload
    assert out.has_image is False
