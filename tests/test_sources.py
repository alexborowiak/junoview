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
    assert body.startswith('<img src="data:image/png;base64,')
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
    assert body.startswith('<img src="data:image/png;base64,')


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
