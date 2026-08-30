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
    assert 'src="fig/trend.pdf"' in figs[0].outputs[0].payload
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
    assert "fig/trend.pdf" in out
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

