"""Sources other than Jupyter (TASKS T91).

"Something for things like Overleaf, Excel etc." (2026-08-29, user.)

The interesting thing about this ask is how little it needs. Everything
downstream of the parser -- the card renderer, the deck builder, the
refresh contract, the export path -- speaks :class:`Document` and knows
nothing about notebooks. A new source is therefore a *producer*: text in,
``Document`` out, and every feature in the tool works on it for free.

So this module is a registry of producers and three of them:

* **Markdown** (``.md``, ``.markdown``, ``.qmd``) -- headings become
  sections, prose becomes notes, fenced code becomes code cards, images
  become figures. Quarto's ``.qmd`` is markdown with fenced code, which
  is exactly this.
* **LaTeX** (``.tex``) -- the Overleaf half. ``\\section`` and
  ``\\subsection`` become sections, ``figure`` and ``table``
  environments become cards with their captions, and everything else is
  prose.
* **Delimited text** (``.csv``, ``.tsv``) -- the Excel half. A
  spreadsheet's *export* is a csv, and csv needs no dependency, which
  matters because this package has none and runs under Pyodide in the
  browser. One card per file: the table, with its shape stated.

WHAT IS DELIBERATELY NOT HERE. No ``.xlsx``, because reading it means
openpyxl -- a dependency, in a package with none, that would have to be
carried into the Pyodide bundle for a format whose own Save As offers
csv. No live Overleaf API, because the thing a person can actually give
this tool is the ``.tex`` file. Both are one producer away if that
changes, which is the point of the registry.

A producer NEVER raises on ugly input. These files are written by hand
and pasted from anywhere; a source that refuses to open is worse than
one that opens with the odd paragraph in the wrong place.
"""

from __future__ import annotations

import csv
import html
import io
import json
import re
from collections.abc import Callable
from pathlib import Path

from .classify import _slug
from .model import CodeStep, Document, Item, Section
from .outputs import RenderedOutput
from .parser import parse_notebook

__all__ = ["SOURCES", "SOURCE_SUFFIXES", "doc_from_text", "source_label"]


# ---------------------------------------------------------------------------
# small shared helpers
# ---------------------------------------------------------------------------

def _doc(title: str) -> tuple[Document, dict]:
    """A document plus the mutable state every producer threads through."""
    return Document(title=title), {"used": set(), "sec": None, "sub": ""}


def _section(doc: Document, st: dict, title: str, level: int = 2) -> Section:
    sec = Section(title, _slug("sec " + (title or "section"), st["used"]),
                  level=level, from_heading=True)
    doc.sections.append(sec)
    st["sec"] = sec
    st["sub"] = ""
    return sec


def _ensure(doc: Document, st: dict) -> Section:
    """The bucket for content that arrives before any heading.

    Named "Overview" and slugged in the ``sec`` namespace, both for the
    same reason the notebook parser does it: a heading must never be able
    to steal a card's id, because deck frames point at card ids.
    """
    if st["sec"] is None:
        sec = Section("Overview", _slug("sec overview", st["used"]))
        doc.sections.append(sec)
        st["sec"] = sec
    return st["sec"]


def _add(doc: Document, st: dict, item: Item) -> Item:
    sec = _ensure(doc, st)
    item.subsection = item.subsection or st["sub"]
    sec.items.append(item)
    return item


def _note(doc: Document, st: dict, text: str, title: str = "Note") -> None:
    text = text.strip()
    if not text:
        return
    nid = _slug("note", st["used"])
    _add(doc, st, Item(kind="note", title=title, caption=text,
                       is_note=True, item_id=nid, anchor=nid))


def _html_out(payload: str, ot: str = "print") -> RenderedOutput:
    return RenderedOutput(kind="html", payload=payload, ot=ot)


def _img_item(doc: Document, st: dict, src: str, alt: str,
              caption: str = "") -> Item:
    """A figure card pointing at an image the source file referred to.

    The path is kept EXACTLY as written. These files live beside their
    figures, so a relative path is right when the page is saved beside
    them and wrong when it is not -- and rewriting it to a guess would be
    wrong in a way that is harder to see.
    """
    iid = _slug(alt or "figure", st["used"])
    body = (f'<img src="{html.escape(src, quote=True)}" '
            f'alt="{html.escape(alt, quote=True)}" loading="lazy">')
    return _add(doc, st, Item(
        kind="figure", title=alt or Path(src).stem or "Figure",
        outputs=[RenderedOutput(kind="image", payload=body,
                                has_image=True, ot="plot", pt="image")],
        caption=caption, item_id=iid, anchor=iid))


# ---------------------------------------------------------------------------
# markdown
# ---------------------------------------------------------------------------

_MD_HEAD = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_MD_FENCE = re.compile(r"^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$")
_MD_IMG_ONLY = re.compile(r"^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)"
                          r"\s*$")


def parse_markdown(text: str, title: str | None = None) -> Document:
    """Markdown (and Quarto) into cards.

    A heading opens a section (``#``/``##``) or a subsection (``###`` and
    below -- deeper than that is a subsection too, because the card model
    has two tiers and inventing a third for a document that uses six
    would put the extra ones nowhere).

    A fenced block is a code card, its language its code kind. A
    paragraph that is nothing but an image is a figure card, and the
    paragraph after it becomes its caption -- which is how people
    actually write figures in markdown.
    """
    doc, st = _doc(title or "Untitled document")
    lines = str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n")
    para: list[str] = []
    last_fig: Item | None = None
    i = 0

    def flush() -> None:
        nonlocal para, last_fig
        body = "\n".join(para).strip()
        para = []
        if not body:
            return
        # a paragraph straight after a lone image is that image's caption
        if last_fig is not None and not last_fig.caption:
            last_fig.caption = body
            last_fig = None
            return
        last_fig = None
        _note(doc, st, body)

    while i < len(lines):
        line = lines[i]
        m = _MD_FENCE.match(line)
        if m:
            flush()
            fence, lang = m.group(1), (m.group(2) or "").lower()
            body: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith(
                    fence[0] * len(fence)):
                body.append(lines[i])
                i += 1
            i += 1                       # step over the closing fence
            src = "\n".join(body).rstrip()
            if src:
                cid = _slug(lang or "code", st["used"])
                _add(doc, st, Item(
                    kind="code", title=(lang or "code"),
                    code_visible=True, code_kind=lang or "code",
                    code_kinds=[lang or "code"],
                    steps=[CodeStep(label=lang or "code", code=src,
                                    is_primary=True)],
                    item_id=cid, anchor=cid))
            last_fig = None
            continue

        m = _MD_HEAD.match(line)
        if m:
            flush()
            depth, name = len(m.group(1)), m.group(2).strip()
            if depth <= 2:
                _section(doc, st, name, level=max(1, depth))
            else:
                _ensure(doc, st)
                st["sub"] = name
            last_fig = None
            i += 1
            continue

        m = _MD_IMG_ONLY.match(line)
        if m:
            flush()
            last_fig = _img_item(doc, st, m.group(2), m.group(1))
            i += 1
            continue

        if not line.strip():
            flush()
        else:
            para.append(line)
        i += 1

    flush()
    if not doc.sections:
        _ensure(doc, st)
    return doc


# ---------------------------------------------------------------------------
# LaTeX -- the Overleaf half
# ---------------------------------------------------------------------------

_TEX_SEC = re.compile(r"\\(section|subsection|subsubsection|chapter)\*?"
                      r"\s*\{(.*?)\}")
_TEX_TITLE = re.compile(r"\\title\s*\{(.*?)\}", re.S)
_TEX_ENV = re.compile(r"\\begin\{(figure|table|lstlisting|verbatim|"
                      r"minted|equation|align)\*?\}")
_TEX_GRAPHIC = re.compile(r"\\includegraphics(?:\[[^\]]*\])?\s*\{([^}]*)\}")
_TEX_CAPTION_OPEN = re.compile(r"\\caption\s*(?:\[[^\]]*\])?\s*\{")


def _braced(text: str, at: int) -> str:
    """The text between one ``{`` and ITS matching ``}``.

    A regex cannot do this, and a greedy one is actively wrong: a caption
    is followed by a ``\\label{...}``, so ``\\{(.*)\\}`` swallows the label
    too and every figure ends up captioned "...  \\label{fig:trend".
    """
    depth, i = 1, at
    while i < len(text) and depth:
        ch = text[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if not depth:
                return text[at:i]
        i += 1
    return text[at:]
_TEX_LABEL = re.compile(r"\\label\s*\{([^}]*)\}")
_TEX_COMMENT = re.compile(r"(?<!\\)%.*$", re.M)


def _tex_plain(s: str) -> str:
    """Enough de-TeXing to read. Not a TeX engine and not pretending to be.

    Inline maths is LEFT ALONE, delimiters and all: the page already
    typesets ``$...$`` with MathJax, so stripping it would be throwing
    away the one part of a LaTeX document this tool can render properly.
    """
    s = _TEX_COMMENT.sub("", s)
    s = re.sub(r"\\(?:textbf|textit|emph|texttt)\s*\{([^{}]*)\}",
               r"**\1**", s)
    s = re.sub(r"\\(?:cite[a-z]*|ref|eqref)\s*\{([^}]*)\}", r"[\1]", s)
    s = re.sub(r"\\(?:label|index)\s*\{[^}]*\}", "", s)
    s = re.sub(r"\\(?:item)\b", "-", s)
    s = re.sub(r"\\begin\{(itemize|enumerate|document|abstract)\}", "", s)
    s = re.sub(r"\\end\{(itemize|enumerate|document|abstract)\}", "", s)
    s = re.sub(r"\\\\", "\n", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def _tex_env_body(text: str, start: int, name: str) -> tuple[str, int]:
    """The body of one environment, and where it ends.

    Nesting is counted, because a figure holding a subfigure is ordinary
    and stopping at the first ``\\end`` would swallow half a document.
    """
    open_re = re.compile(r"\\begin\{" + name + r"\*?\}")
    close_re = re.compile(r"\\end\{" + name + r"\*?\}")
    depth, at = 1, start
    while depth:
        nxt_o = open_re.search(text, at)
        nxt_c = close_re.search(text, at)
        if not nxt_c:
            return text[start:], len(text)
        if nxt_o and nxt_o.start() < nxt_c.start():
            depth += 1
            at = nxt_o.end()
            continue
        depth -= 1
        at = nxt_c.end()
        if not depth:
            return text[start:nxt_c.start()], at
    return text[start:], len(text)


def parse_latex(text: str, title: str | None = None) -> Document:
    """A ``.tex`` file into cards -- the Overleaf half of T91."""
    src = str(text).replace("\r\n", "\n").replace("\r", "\n")
    m = _TEX_TITLE.search(src)
    doc, st = _doc(title or (_tex_plain(m.group(1)) if m else None)
                   or "Untitled document")
    pos = 0
    prose: list[str] = []

    def flush() -> None:
        body = _tex_plain("\n".join(prose))
        prose.clear()
        if body:
            _note(doc, st, body)

    while pos < len(src):
        sec = _TEX_SEC.search(src, pos)
        env = _TEX_ENV.search(src, pos)
        nxt = min([x.start() for x in (sec, env) if x], default=None)
        if nxt is None:
            prose.append(src[pos:])
            break
        prose.append(src[pos:nxt])
        if sec is not None and sec.start() == nxt:
            flush()
            name = _tex_plain(sec.group(2))
            if sec.group(1) in ("chapter", "section"):
                _section(doc, st, name,
                         level=1 if sec.group(1) == "chapter" else 2)
            else:
                _ensure(doc, st)
                st["sub"] = name
            pos = sec.end()
            continue

        flush()
        assert env is not None    # nxt came from one of the two matches
        kind = env.group(1)
        body, pos = _tex_env_body(src, env.end(), kind)
        cap_m = _TEX_CAPTION_OPEN.search(body)
        cap = (_tex_plain(_braced(body, cap_m.end()).split("\n\n")[0])
               if cap_m else "")
        lab_m = _TEX_LABEL.search(body)
        label = lab_m.group(1) if lab_m else ""
        if kind == "figure":
            g = _TEX_GRAPHIC.search(body)
            item = _img_item(doc, st, g.group(1) if g else "",
                             cap or label or "Figure", cap)
            if label:
                item.item_id = _slug(label, st["used"])
                item.anchor = item.item_id
            item.labelled = bool(cap or label)
        elif kind == "table":
            tid = _slug(label or "table", st["used"])
            _add(doc, st, Item(
                kind="dataset", title=cap or label or "Table",
                outputs=[_html_out(
                    '<pre class="tex-table">'
                    + html.escape(_TEX_COMMENT.sub("", body).strip())
                    + "</pre>", ot="table")],
                caption=cap, labelled=bool(cap or label),
                item_id=tid, anchor=tid))
        elif kind in ("equation", "align"):
            # left as LaTeX on purpose: the page typesets it
            _note(doc, st, "$$" + _TEX_COMMENT.sub("", body).strip() + "$$",
                  title=cap or "Equation")
        else:
            cid = _slug("listing", st["used"])
            _add(doc, st, Item(
                kind="code", title=cap or "Listing", code_visible=True,
                code_kind="latex", code_kinds=["latex"],
                steps=[CodeStep(label=kind, code=body.strip(),
                                is_primary=True)],
                caption=cap, item_id=cid, anchor=cid))

    flush()
    if not doc.sections:
        _ensure(doc, st)
    return doc


# ---------------------------------------------------------------------------
# delimited text -- the Excel half
# ---------------------------------------------------------------------------

TABLE_ROW_CAP = 500          # rows drawn; the count still tells the truth


def parse_table(text: str, title: str | None = None,
                delim: str | None = None) -> Document:
    """A csv/tsv into one dataset card.

    The delimiter is SNIFFED and then checked against the obvious ones,
    because csv.Sniffer is confident and often wrong on a single-column
    file -- it will happily decide that a column of dates is
    colon-delimited.
    """
    body = str(text).replace("\r\n", "\n").replace("\r", "\n")
    if delim is None:
        head = "\n".join(body.split("\n")[:20])
        counts = {d: head.count(d) for d in (",", "\t", ";", "|")}
        delim = max(counts, key=lambda d: counts[d])
        if not counts[delim]:
            delim = ","
    rows = list(csv.reader(io.StringIO(body), delimiter=delim))
    rows = [r for r in rows if any(str(c).strip() for c in r)]
    doc, st = _doc(title or "Table")
    n_rows = max(0, len(rows) - 1)
    n_cols = max((len(r) for r in rows), default=0)
    shown = rows[:TABLE_ROW_CAP + 1]

    def cell(v: str, tag: str) -> str:
        return f"<{tag}>{html.escape(str(v))}</{tag}>"

    out = ['<table class="jv-tbl">']
    if shown:
        out.append("<thead><tr>"
                   + "".join(cell(c, "th") for c in shown[0])
                   + "</tr></thead>")
    out.append("<tbody>")
    for r in shown[1:]:
        r = list(r) + [""] * (n_cols - len(r))
        out.append("<tr>" + "".join(cell(c, "td") for c in r) + "</tr>")
    out.append("</tbody></table>")
    if n_rows > TABLE_ROW_CAP:
        # SAY what was left out. A table silently showing its first 500
        # rows is a table lying about the file.
        out.append(f'<p class="jv-tbl-more">Showing the first '
                   f"{TABLE_ROW_CAP} of {n_rows} rows.</p>")
    tid = _slug("table", st["used"])
    _add(doc, st, Item(
        kind="dataset", title=title or "Table",
        outputs=[_html_out("".join(out), ot="table")],
        caption=f"{n_rows} rows \u00d7 {n_cols} columns.",
        labelled=True, item_id=tid, anchor=tid))
    return doc


# ---------------------------------------------------------------------------
# the registry
# ---------------------------------------------------------------------------

def _from_notebook(text: str, title: str | None = None) -> Document:
    return parse_notebook(json.loads(text), title=title)


#: suffix -> (what to call it, producer). The ONE place that says which
#: files this tool can open; the CLI, the browser drop handler and the
#: Pyodide bridge all read it rather than each carrying a list.
SOURCES: dict[str, tuple[str, Callable[..., Document]]] = {
    ".ipynb": ("Jupyter notebook", _from_notebook),
    ".md": ("Markdown", parse_markdown),
    ".markdown": ("Markdown", parse_markdown),
    ".qmd": ("Quarto", parse_markdown),
    ".tex": ("LaTeX", parse_latex),
    ".latex": ("LaTeX", parse_latex),
    ".csv": ("Table", parse_table),
    ".tsv": ("Table", parse_table),
}

SOURCE_SUFFIXES: tuple[str, ...] = tuple(SOURCES)


def source_label(name: str | Path) -> str:
    """What kind of thing this filename is, or "" for one we cannot open."""
    spec = SOURCES.get(Path(str(name)).suffix.lower())
    return spec[0] if spec else ""


def doc_from_text(name: str | Path, text: str,
                  title: str | None = None) -> Document:
    """Dispatch on the filename's suffix. Unknown suffixes read as markdown.

    Falling back to markdown rather than refusing is deliberate: the
    files that reach this without a suffix we know are READMEs, notes and
    pasted prose, and markdown renders plain text as plain text. Only
    ``.ipynb`` can actually fail to parse, and it fails loudly, because a
    notebook that is not JSON is a broken notebook rather than an unusual
    one.
    """
    suffix = Path(str(name)).suffix.lower()
    _, producer = SOURCES.get(suffix, ("Markdown", parse_markdown))
    if producer is parse_table:
        return parse_table(text, title=title or Path(str(name)).stem,
                           delim="\t" if suffix == ".tsv" else None)
    return producer(text, title=title)
