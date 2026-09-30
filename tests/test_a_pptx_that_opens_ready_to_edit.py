"""A .pptx that opens ready to edit (T600).

The user, 2026-09-30, with a screenshot of PowerPoint refusing edits: "when
downloading a junoview as pptx for some reason it is downloaded in
protected view."

Nothing is wrong with the file -- every part parses, every part has a
content type, every relationship resolves and no slide repeats a shape id
(checked on a real export). Windows marks everything a browser downloads as
from the internet, and PowerPoint opens every such file in Protected View;
no page can download a file without that mark.

So the local app does not download it: the page sends the bytes and the
server writes them into Downloads, unmarked, then can open the file or show
it in its folder -- held to one suffix, a real ZIP, a size cap, a free name,
and files this run wrote. In a browser, the first download on Windows says
why PowerPoint will ask and how to stop it asking.
"""

from __future__ import annotations

import base64
import zipfile
from io import BytesIO
from pathlib import Path

import pytest

from junoview import assets
from junoview.server import exports
from junoview.server.exports import (
    EXPORT_CAP,
    export_name,
    free_path,
    reveal,
    write_export,
)


def _pptx_bytes() -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
    return buf.getvalue()


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


# --------------------------------------------------------- the writer


def test_it_is_written_as_the_presentation_is_called(tmp_path):
    p = write_export(tmp_path, "ENSO seminar.pptx", _b64(_pptx_bytes()))
    assert p == tmp_path / "ENSO seminar.pptx"
    assert p.read_bytes() == _pptx_bytes()


def test_an_export_never_replaces_a_file(tmp_path):
    """The earlier one may be open in PowerPoint, or be last week's."""
    first = write_export(tmp_path, "talk.pptx", _b64(_pptx_bytes()))
    second = write_export(tmp_path, "talk.pptx", _b64(_pptx_bytes()))
    third = write_export(tmp_path, "talk.pptx", _b64(_pptx_bytes()))
    assert [first.name, second.name, third.name] == [
        "talk.pptx", "talk (2).pptx", "talk (3).pptx"]


@pytest.mark.parametrize("raw,want", [
    ("../../etc/passwd", "etc-passwd.pptx"),
    ("C:\\Windows\\evil", "C-Windows-evil.pptx"),
    ("   ", "presentation.pptx"),
    ("talk. . .", "talk.pptx"),
    ('a<b>c:"d"|e?f*g', "a-b-c-d-e-f-g.pptx"),
])
def test_a_name_cannot_leave_the_folder(raw, want):
    assert export_name(raw, ".pptx") == want


def test_only_a_real_pptx_is_written(tmp_path):
    """One suffix: a route that wrote any suffix could put a script where
    a double-click runs it. And the bytes must be a ZIP, as a .pptx is."""
    with pytest.raises(ValueError, match="not a file Junoview exports"):
        write_export(tmp_path, "run.bat", _b64(b"echo hi"))
    with pytest.raises(ValueError, match="named like a .pptx but is not"):
        write_export(tmp_path, "talk.pptx", _b64(b"<html>not a zip</html>"))
    with pytest.raises(ValueError, match="arrived damaged"):
        write_export(tmp_path, "talk.pptx", "not base64 !!")
    with pytest.raises(ValueError, match="empty"):
        write_export(tmp_path, "talk.pptx", "")
    assert list(tmp_path.iterdir()) == []


def test_a_huge_export_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(exports, "EXPORT_CAP", 10)
    with pytest.raises(ValueError, match="over the"):
        write_export(tmp_path, "talk.pptx", _b64(_pptx_bytes()))
    assert EXPORT_CAP >= 64 * 1024 * 1024   # a real deck of pictures fits


def test_the_free_name_gives_up_rather_than_overwrite(tmp_path, monkeypatch):
    (tmp_path / "t.pptx").write_bytes(b"x")
    monkeypatch.setattr(Path, "exists", lambda self: True)
    with pytest.raises(FileExistsError):
        free_path(tmp_path, "t.pptx")


def test_no_desktop_to_open_it_is_said_in_words(monkeypatch, tmp_path):
    def boom(*a, **kw):
        raise FileNotFoundError(2, "No such file or directory")
    monkeypatch.setattr(exports.subprocess, "Popen", boom)
    monkeypatch.setattr(exports.sys, "platform", "linux")
    with pytest.raises(ValueError, match="no program set up to open t.pptx"):
        reveal(tmp_path / "t.pptx", "open")


# ------------------------------------------------------------ the routes


@pytest.fixture
def server(tmp_path, monkeypatch):
    from junoview.server import routes
    from junoview.server.routes import _make_handler
    from junoview.server.state import _AppState

    out = tmp_path / "Downloads"
    out.mkdir()
    monkeypatch.setattr(routes, "export_folder", lambda: out)
    opened = []
    monkeypatch.setattr(routes, "reveal",
                        lambda p, how="open": opened.append((p.name, how)))
    root = tmp_path / "root"
    root.mkdir()
    state = _AppState(root)
    handler = _make_handler(state)
    return handler.__new__(handler), state, out, opened


def test_the_app_writes_it_and_can_open_what_it_wrote(server):
    h, state, out, opened = server
    got = h._export({"name": "ENSO seminar.pptx", "b64": _b64(_pptx_bytes())})
    assert got["name"] == "ENSO seminar.pptx"
    assert got["folder"] == "Downloads"
    assert (out / "ENSO seminar.pptx").read_bytes() == _pptx_bytes()
    assert h._reveal({"path": got["path"]}) == {"ok": True}
    assert h._reveal({"path": got["path"], "how": "folder"}) == {"ok": True}
    assert opened == [("ENSO seminar.pptx", "open"),
                      ("ENSO seminar.pptx", "folder")]


def test_it_opens_nothing_it_did_not_write(server, tmp_path):
    """/api/reveal hands a path to the operating system; held to this
    run's own exports, the page cannot use it to launch anything else."""
    h, state, out, opened = server
    other = tmp_path / "other.pptx"
    other.write_bytes(_pptx_bytes())
    with pytest.raises(ValueError, match="only a file Junoview exported"):
        h._reveal({"path": str(other)})
    with pytest.raises(ValueError, match="only a file Junoview exported"):
        h._reveal({"path": "C:\\Windows\\System32\\calc.exe"})
    assert opened == []


def test_the_routes_are_behind_the_token():
    """Every POST is token-guarded before it reaches a route, these two
    included -- the check is once, at the top of do_POST."""
    src = Path(__import__("junoview.server.routes", fromlist=["x"]).__file__)
    text = src.read_text(encoding="utf-8")
    post = text.split("        def do_POST(self):")[1]
    assert post.index("if not self._authed(query):") < post.index(
        'elif url.path == "/api/export":')
    assert 'elif url.path == "/api/reveal":' in post


# -------------------------------------------------------------- the page


def test_the_app_sends_it_to_the_server_and_the_browser_explains(out):
    body = out.split("  function pptxDeliver(blob,fname,msg){")[1] \
        .split("\n  }\n")[0]
    assert "    if(APP.mode==='app'&&APP.api){" in body
    assert "        return APP.api('/api/export',{name:fname," in body
    assert "[['Open it',function(){reveal('open');}]," in body
    # the server failing is not the export failing
    assert "        pptxDownload(blob,fname);" in body
    # once, on Windows, where Protected View is
    assert "    var windows=/Windows/i.test(String(navigator.userAgent||''));" in body
    assert "    if(windows&&lsGet(PV_TOLD_KEY)!=='1'){" in body
    assert "[['Why, and how to stop it\\u2026',pptxProtectedHelp]]" in body
    help_ = out.split("  function pptxProtectedHelp(){")[1].split("\n  }\n")[0]
    assert "Trusted Locations" in help_ and "Unblock" in help_
    save = out.split("  function pptxBuildAndSave(orig){")[1] \
        .split("\n  }\n")[0]
    assert "    pptxDeliver(out.blob,fname,msg);" in save
    assert "a.download=" not in save


def test_the_help_says_so_too():
    help_html = assets.help_html()
    assert "Protected View" in help_html
    assert "Trusted Locations" in help_html
