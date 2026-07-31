"""An allow-list HTML sanitizer for untrusted notebook markup.

Rendered pages are shared, and a notebook can contain arbitrary HTML in a
markdown cell or a rich output. Only known-safe tags and attributes survive;
script-bearing content is dropped whole, and URLs are restricted to schemes
that cannot execute.
"""

from __future__ import annotations

import html.parser
import re

# Allowlist sanitizer: parse the fragment and re-emit ONLY known-safe
# tags/attributes, so nothing is reconstructed from deletion. This is
# the safe approach — regex "strip the bad bits" sanitizers are
# defeated by split tags, unquoted attrs and encoded URLs.
_ALLOWED_TAGS = {
    "p", "br", "hr", "span", "div", "strong", "b", "em", "i", "u", "s",
    "del", "ins", "code", "pre", "blockquote", "h1", "h2", "h3", "h4",
    "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd", "a", "img", "sub",
    "sup", "small", "mark", "abbr", "kbd", "samp", "var", "table",
    "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup",
    "col", "figure", "figcaption",
}


_VOID_TAGS = {"br", "hr", "img", "col"}


# tags whose CONTENT is dropped, not just the tag
_DROP_CONTENT_TAGS = {"script", "style", "template", "noscript",
                      "title", "textarea", "iframe", "xmp"}


_URL_ATTRS = {"href", "src"}


_ALLOWED_ATTRS = {
    "class", "style", "title", "alt", "align", "width", "height",
    "colspan", "rowspan", "scope", "href", "src", "start", "type",
    "lang", "dir",
}


_STYLE_BAD_RE = re.compile(
    r"(javascript:|expression\s*\(|url\s*\()", re.I)


_URL_SCHEME_RE = re.compile(r"^([a-zA-Z][a-zA-Z0-9+.\-]*):")


def _url_ok(val: str) -> bool:
    # strip entities + all whitespace/control chars (browsers do before
    # resolving the scheme, so "javas\ncript:" must be caught)
    v = re.sub(r"[\x00-\x20]+", "", html.unescape(val))
    m = _URL_SCHEME_RE.match(v)
    if not m:
        return True                       # relative / fragment / query
    scheme = m.group(1).lower()
    if scheme in ("http", "https", "mailto", "tel"):
        return True
    return v.lower().startswith("data:image/")


class _HtmlSanitizer(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0

    def _emit_open(self, tag, attrs, selfclose):
        kept = []
        for k, v in attrs:
            k = k.lower()
            if k not in _ALLOWED_ATTRS or k.startswith("on"):
                continue
            v = v or ""
            if k in _URL_ATTRS and not _url_ok(v):
                continue
            if k == "style" and _STYLE_BAD_RE.search(v):
                continue
            kept.append(f' {k}="{html.escape(v, quote=True)}"')
        slash = "/" if (selfclose or tag in _VOID_TAGS) else ""
        self.out.append(f"<{tag}{''.join(kept)}{slash}>")

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            self.skip += 1
            return
        if self.skip or tag not in _ALLOWED_TAGS:
            return
        self._emit_open(tag, attrs, False)

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS or self.skip or tag not in _ALLOWED_TAGS:
            return
        self._emit_open(tag, attrs, True)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            if self.skip:
                self.skip -= 1
            return
        if self.skip or tag not in _ALLOWED_TAGS or tag in _VOID_TAGS:
            return
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(html.escape(data))


def _sanitize_html(fragment: str) -> str:
    """Jupyter-style raw HTML in markdown, re-emitted from an allowlist
    of safe tags/attributes so no active content can survive."""
    s = _HtmlSanitizer()
    s.feed(fragment)
    s.close()
    return "".join(s.out)
