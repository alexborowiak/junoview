"""A real-browser theme matrix over the surfaces CSS tests cannot see (T254).

Set ``JUNOVIEW_BROWSER_TESTS=1`` to run it.  The ordinary suite stays portable
on machines without Chromium; this machine and CI/browser review can opt in.
Set ``JUNOVIEW_UPDATE_THEME_REFERENCE=1`` as well to refresh the contact sheet.
"""

from __future__ import annotations

import os
import shutil
import struct
import subprocess
import time
import zlib
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
PROBE = Path(__file__).with_name("theme_browser_probe.js")
REFERENCE = ROOT / "reviews" / "theme-matrix.png"
SCHEMES = (
    "dark", "light", "forest", "forest-light", "forest-blue",
    "colourful", "contrast-dark", "warm", "navy", "purple", "dim",
    "contrast-light",
)


def _browser() -> str | None:
    requested = os.environ.get("JUNOVIEW_CHROMIUM")
    if requested:
        return requested
    for name in (
        "chromium", "chromium-browser", "google-chrome",
        "google-chrome-stable", "msedge",
    ):
        found = shutil.which(name)
        if found:
            return found
    for path in (
        Path(os.environ.get("ProgramFiles(x86)", ""))
        / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("ProgramFiles", ""))
        / "Microsoft/Edge/Application/msedge.exe",
        Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    ):
        if path.is_file():
            return str(path)
    return None


def _write_probe(page: Path, rendered: str) -> None:
    probe = PROBE.read_text(encoding="utf-8")
    page.write_text(
        rendered.replace("</body>", f"<script>{probe}</script></body>"),
        encoding="utf-8", newline="\n",
    )


def _screenshot(
        browser: str, page: Path, target: Path, profile: Path,
        size: tuple[int, int], budget: int = 2000) -> None:
    command = [
        browser, "--headless=new", "--disable-gpu", "--no-sandbox",
        "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", "--hide-scrollbars",
        f"--user-data-dir={profile}", f"--virtual-time-budget={budget}",
        f"--window-size={size[0]},{size[1]}", f"--screenshot={target}",
        page.as_uri(),
    ]
    result = subprocess.run(
        command, capture_output=True, text=True, timeout=45,
    )
    assert result.returncode == 0, result.stderr
    # Edge's small launcher process can exit just before the headless child
    # finishes the atomic screenshot rename.
    for _ in range(300):
        if target.is_file():
            break
        time.sleep(.1)
    assert target.is_file(), result.stderr


def _png_pixel(path: Path, x: int, y: int) -> tuple[int, int, int]:
    """Read one RGB pixel from an 8-bit browser screenshot, stdlib-only."""
    raw = path.read_bytes()
    assert raw.startswith(b"\x89PNG\r\n\x1a\n")
    at = 8
    data = bytearray()
    width = height = colour = 0
    while at < len(raw):
        length = struct.unpack(">I", raw[at:at + 4])[0]
        kind = raw[at + 4:at + 8]
        chunk = raw[at + 8:at + 8 + length]
        at += length + 12
        if kind == b"IHDR":
            width, height, depth, colour = struct.unpack(
                ">IIBB", chunk[:10]
            )
            assert depth == 8 and colour in (2, 6)
        elif kind == b"IDAT":
            data.extend(chunk)
        elif kind == b"IEND":
            break
    channels = 3 if colour == 2 else 4
    scan = width * channels
    inflated = zlib.decompress(data)
    previous = bytearray(scan)
    offset = 0
    for row_number in range(height):
        filter_type = inflated[offset]
        row = bytearray(inflated[offset + 1:offset + 1 + scan])
        offset += scan + 1
        for index in range(scan):
            left = row[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 1:
                row[index] = (row[index] + left) & 255
            elif filter_type == 2:
                row[index] = (row[index] + above) & 255
            elif filter_type == 3:
                row[index] = (row[index] + (left + above) // 2) & 255
            elif filter_type == 4:
                estimate = left + above - upper_left
                distances = (
                    abs(estimate - left), abs(estimate - above),
                    abs(estimate - upper_left),
                )
                source = (left, above, upper_left)[distances.index(min(distances))]
                row[index] = (row[index] + source) & 255
            else:
                assert filter_type == 0
        if row_number == y:
            start = x * channels
            return tuple(row[start:start + 3])
        previous = row
    raise AssertionError((x, y, width, height))


def _write_contact_sheet(page: Path, target: Path) -> None:
    frames = "".join(
        f'<iframe title="{name}" src="{page.as_uri()}?sample={name}"></iframe>'
        for name in SCHEMES
    )
    target.write_text(
        "<!doctype html><meta charset=utf-8><title>Theme matrix</title>"
        "<style>body{margin:0;padding:16px;background:#d8dde2;"
        "font:14px system-ui}h1{margin:0 0 4px}p{margin:0 0 14px}"
        ".grid{display:grid;grid-template-columns:repeat(3,560px);gap:12px}"
        "iframe{width:560px;height:690px;border:0;background:white;"
        "box-shadow:0 1px 6px #0003}</style>"
        "<h1>Junoview theme surface matrix</h1>"
        "<p>Reader · welcome · menus/dialogs · Variables · tree/trace · editor</p>"
        f'<div class="grid">{frames}</div>',
        encoding="utf-8", newline="\n",
    )


def test_theme_reference_is_kept():
    raw = REFERENCE.read_bytes()
    assert raw.startswith(b"\x89PNG\r\n\x1a\n")
    assert struct.unpack(">II", raw[16:24]) == (1740, 2920)


def test_computed_theme_contrast_on_real_surfaces(out, tmp_path):
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium matrix")
    browser = _browser()
    if not browser:
        pytest.skip("Chromium not found")
    page = tmp_path / "theme-probe.html"
    shot = tmp_path / "theme-probe.png"
    _write_probe(page, out)
    _screenshot(browser, page, shot, tmp_path / "profile", (1200, 800))
    red, green, blue = _png_pixel(shot, 8, 8)
    assert green > 240 and red < 20 and blue < 20, (
        "the browser theme matrix failed; open the generated probe and read "
        "#theme-matrix-status.title for the failing scheme/surface"
    )
    if os.environ.get("JUNOVIEW_UPDATE_THEME_REFERENCE") == "1":
        grid = tmp_path / "theme-reference.html"
        generated = tmp_path / "theme-reference.png"
        _write_contact_sheet(page, grid)
        _screenshot(
            browser, grid, generated, tmp_path / "reference-profile",
            (1740, 2920), 6000,
        )
        shutil.copyfile(generated, REFERENCE)
    assert REFERENCE.is_file()
