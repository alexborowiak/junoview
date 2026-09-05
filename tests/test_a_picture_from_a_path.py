"""A picture named by a path on this computer (T312).

The deck's Insert menu offers "A path or a link", and its tooltip
promises "Any address this page can load -- a file path or a URL". The
path half could never work: every spelling of a computer path resolves
to a ``file:`` URL, and an http document may not load one as a
subresource, so a path typed there produced a broken picture in the app
where it was typed.

``/api/readimage`` is the other half. It also makes the user's actual
request reachable for this class -- "all images should be embedded into
the thing, but should have the option to refreshed from the path" --
because a path the server can read is a path the deck can embed AND go
back to.

THE GATE IS THE POINT. Every other content-returning route is held to a
suffix or a name (.ipynb, SOURCE_SUFFIXES, ``*.junoview*``). A route
that returned whatever bytes it was pointed at would be the first with
none, taking what a page can read from ten document extensions to every
file the account can open. Held to ``IMG_MIME`` it adds no reach at
all: ``/api/open`` already makes the server read an arbitrary
absolute-path image and base64 it into the page, because that is how a
.md or .tex embeds its figures.
"""

from __future__ import annotations

import base64
import struct
import zlib

import pytest

from junoview.notebook.sources import EMBED_CAP, IMG_MIME


def _png(w: int = 4, h: int = 4) -> bytes:
    def chunk(t: bytes, d: bytes) -> bytes:
        c = t + d
        return (struct.pack(">I", len(d)) + c
                + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF))
    raw = b"".join(b"\x00" + bytes((20, 140, 220)) * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))


def _route(root):
    """The reader is a module-level function precisely so a test can hold
    it: the rest of the handler is a closure over live server state, and
    lifting methods out of that by source was too brittle to trust."""
    from junoview.server.routes import read_image_at

    class R:
        @staticmethod
        def _read_image(body):
            return read_image_at(root, body.get("path"))
    return R


def test_a_real_png_comes_back_as_a_data_uri(tmp_path):
    """The whole point: bytes the deck can keep, not an address that only
    resolves on this machine."""
    (tmp_path / "logo.png").write_bytes(_png())
    got = _route(tmp_path)._read_image({"path": "logo.png"})
    assert got["src"].startswith("data:image/png;base64,")
    assert base64.b64decode(got["src"].split(",", 1)[1]) == _png()
    assert got["name"] == "logo.png"
    # the resolved path rides back, so the deck can record where it came
    # from and offer to re-read it later
    assert got["path"].endswith("logo.png")


def test_an_absolute_path_outside_the_root_is_allowed(tmp_path):
    """No root sandbox, deliberately. A deck legitimately draws on a
    figure in a sibling folder or on a share, and no existing route
    confines a path either."""
    out = tmp_path / "elsewhere"
    out.mkdir()
    (out / "fig.png").write_bytes(_png())
    got = _route(tmp_path / "proj")._read_image({"path": str(out / "fig.png")})
    assert got["src"].startswith("data:image/png;base64,")


@pytest.mark.parametrize("name", ["id_rsa", "secrets.env", "notes.pdf",
                                  "setup.exe", "deck.junoview"])
def test_it_reads_pictures_and_nothing_else(tmp_path, name):
    """THE GATE. Without it this would be the first route with no suffix
    check, and its bytes would then persist into junoview_project.json
    and into every exported deck."""
    (tmp_path / name).write_bytes(b"sensitive")
    with pytest.raises(ValueError, match="picture"):
        _route(tmp_path)._read_image({"path": name})


def test_a_pdf_is_named_as_the_thing_it_is(tmp_path):
    """NOT_AN_IMAGE already knows the three that people reasonably
    expect to work, so say which one it is rather than a flat refusal."""
    (tmp_path / "plot.pdf").write_bytes(b"%PDF-1.4")
    with pytest.raises(ValueError, match="is PDF"):
        _route(tmp_path)._read_image({"path": "plot.pdf"})


def test_the_bytes_have_to_agree_with_the_suffix(tmp_path):
    """A suffix is what the user typed; the magic bytes are what the file
    is. The two disagreeing is how a mistyped path ships the wrong file's
    contents into a deck that then gets shared."""
    (tmp_path / "logo.png").write_bytes(b"BEGIN RSA PRIVATE KEY...")
    with pytest.raises(ValueError, match="contents are not"):
        _route(tmp_path)._read_image({"path": "logo.png"})


def test_broken_svg_is_refused(tmp_path):
    """SVG has no magic number, so it is checked by parsing -- and an SVG
    is the one image format that is also a document."""
    (tmp_path / "a.svg").write_bytes(b"<svg><unclosed>")
    with pytest.raises(ValueError, match="not valid SVG"):
        _route(tmp_path)._read_image({"path": "a.svg"})
    (tmp_path / "b.svg").write_bytes(
        b'<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    assert _route(tmp_path)._read_image(
        {"path": "b.svg"})["src"].startswith("data:image/svg+xml;base64,")


def test_a_picture_too_big_to_carry_is_refused(tmp_path):
    """The same 20 MB cap the .tex/.md embedder uses, so a figure embeds
    identically whichever way it arrives -- and the deck's draft has to
    fit in localStorage, which does not grow."""
    big = tmp_path / "huge.png"
    big.write_bytes(_png() + b"\0" * (EMBED_CAP + 1))
    with pytest.raises(ValueError, match="MB a deck will carry"):
        _route(tmp_path)._read_image({"path": "huge.png"})


def test_a_web_address_is_not_proxied(tmp_path):
    """An https URL already loads in an <img>; only the path half was
    broken. Fetching it HERE would make the server a proxy reachable from
    the page -- a genuinely new capability, and a readable SSRF from
    loopback. It is a separate feature or none."""
    with pytest.raises(ValueError, match="loaded by the page itself"):
        _route(tmp_path)._read_image({"path": "https://example.com/a.png"})


def test_a_missing_file_says_so(tmp_path):
    with pytest.raises(FileNotFoundError):
        _route(tmp_path)._read_image({"path": "nope.png"})


def test_no_path_is_a_refusal_not_a_crash(tmp_path):
    with pytest.raises(ValueError, match="no path given"):
        _route(tmp_path)._read_image({"path": "  "})


def test_the_route_is_wired_and_behind_the_token():
    """_authed gates every POST before the dispatch reaches any handler,
    so the new route inherits it -- but only if it is dispatched from
    inside that block rather than beside it."""
    from pathlib import Path
    src = (Path(__file__).resolve().parent.parent / "src" / "junoview"
           / "server" / "routes.py").read_text(encoding="utf-8")
    i = src.index('if not self._authed(')
    j = src.index('elif url.path == "/api/readdeck":')
    assert i < src.index('elif url.path == "/api/readimage":') < j
    assert "self._json(self._read_image(body))" in src


def test_every_format_the_table_admits_has_a_check():
    """A format in IMG_MIME with neither magic bytes nor a parse check
    is a hole: its suffix alone would let any bytes through."""
    from pathlib import Path
    src = (Path(__file__).resolve().parent.parent / "src" / "junoview"
           / "server" / "routes.py").read_text(encoding="utf-8")
    magic = src[src.index("_IMG_MAGIC = {"):src.index("def resolve_image_path")]
    checked = {m for m in set(IMG_MIME.values()) if f'"{m}"' in magic}
    checked.add("image/svg+xml")            # parsed instead
    unchecked = set(IMG_MIME.values()) - checked
    # webp and avif are container formats whose heads are not a fixed
    # prefix; they are the known gap and are named here so adding one
    # more format silently is not possible
    assert unchecked == {"image/webp", "image/avif"}, unchecked
