"""Where the maths is: which rendered fragments MathJax will have work in.

MathJax used to be loaded on every page and to typeset the whole document
at load -- every card, every hidden notebook and every hidden raw-view copy
-- in one long task, even on a page with no maths at all (2026-10-09 speed
pass: 0.4-0.8 s at 4x on a math-free page, 1.2-2.2 s on a notebook with
maths). The page now typesets as it is read, card by card, and loads
MathJax only when something on the page needs it. That needs the page to
know, before any script runs, WHICH elements hold maths: this module answers
that from the rendered HTML, and :mod:`~junoview.render.items` stamps the
answer on the element as ``data-math``.

The question is asked of the HTML exactly as MathJax will read it: text
outside ``<script>``, ``<style>``, ``<textarea>``, ``<pre>``, ``<code>`` and
``<noscript>`` (the ``skipHtmlTags`` in assets/html/mathjax.html), entities
decoded, tags dropped. It must never say "no" where MathJax would find
something -- an element that is not marked is never typeset -- so it errs
the other way: any two ``$`` anywhere in the text, or any of the TeX
input's other openers (``\\(``, ``\\[``, ``\\begin{``, ``\\ref{``,
``\\eqref{``) or escapes (``\\$``, ``\\\\``, which MathJax also rewrites).
A false "yes" only costs a typeset pass that finds nothing.
"""

from __future__ import annotations

import html
import re

#: the attribute :mod:`~junoview.render.items` writes on an element whose
#: text holds maths. app.js typesets ``[data-math=""]`` as it nears the
#: screen and sets it to "1" once done -- so a clone of a typeset card says
#: so, and a clone of an untouched one is still waiting.
MATH_ATTR = ' data-math=""'

# MathJax's skipHtmlTags (mathjax.html): no maths is looked for inside
# these, so neither is it here. Non-greedy to the matching close tag.
_SKIP_RE = re.compile(
    r"<(script|style|textarea|pre|code|noscript)\b[^>]*>.*?</\1\s*>",
    re.S | re.I)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
_TAG_RE = re.compile(r"<[^>]*>")
# the TeX input's openers other than '$', and the two escapes it rewrites
# (processEscapes): \( \[ \$ \\ \begin{ \ref{ \eqref{
_OPEN_RE = re.compile(r"\\(?:[(\[$\\]|begin\s*\{|(?:eq)?ref\s*\{)")
# a '$' or a backslash spelled as an entity in the markup
_ENTITY_RE = re.compile(r"&(?:#(?:0*36|x0*24|0*92|x0*5c)|dollar|bsol);?",
                        re.I)


def has_math(fragment: str) -> bool:
    """True when MathJax could find something to typeset in ``fragment``.

    Cheap on the common case: a fragment with no ``$``, no backslash and no
    entity that could spell one -- every figure, most outputs -- is
    answered with three substring scans and no regex at all.
    """
    if not fragment:
        return False
    if ("$" not in fragment and "\\" not in fragment
            and ("&" not in fragment or not _ENTITY_RE.search(fragment))):
        return False
    text = _TAG_RE.sub("", _COMMENT_RE.sub("", _SKIP_RE.sub(" ", fragment)))
    if "&" in text:
        text = html.unescape(text)
    return text.count("$") >= 2 or _OPEN_RE.search(text) is not None


def math_attr(*fragments: str) -> str:
    """``MATH_ATTR`` when any fragment holds maths, else ``""``."""
    return MATH_ATTR if any(has_math(f) for f in fragments) else ""
