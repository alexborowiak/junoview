"""What reaches an installed copy.

The frontend is real files rather than Python string constants, so every
one of them has to be named in ``[tool.setuptools.package-data]`` to get
into a wheel. Nothing else notices when one is not: a source checkout and
the generated ``docs/`` build both read the files off disk beside the
package, and ``pythonpath = ["src", ...]`` puts the checkout ahead of any
installed copy even inside pytest. So the failure is invisible here and
total there.

That is not hypothetical. ``assets/js/deck/*.js`` was undeclared for 141
commits (T95). A setuptools glob does not cross a ``/``, so
``assets/js/*.js`` never matched the fifteen fragments the deck is
assembled from, and every render path in an installed copy raised
``FileNotFoundError`` -- not just the editor, because
``render/page.py`` calls ``assets.deck_js()`` unconditionally.

The test below is deliberately not "is js/deck/ declared?". It holds the
declared patterns against every file actually under ``assets/``, so the
next asset directory somebody adds is covered before it is written.

Reading the declaration needs ``tomllib`` (3.11+) while the project
supports 3.10, so the pyproject-reading tests skip on 3.10. CI runs a
3.13 leg on all three platforms, and so does this machine.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

try:  # tomllib is 3.11+; pyproject.toml:13 allows 3.10.
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - only on 3.10
    tomllib = None  # type: ignore[assignment]

REPO = Path(__file__).resolve().parent.parent
PKG = REPO / "src" / "junoview"

needs_toml = pytest.mark.skipif(
    tomllib is None, reason="tomllib is 3.11+; the 3.13 legs cover this")


def _declared() -> list[str]:
    """The package-data patterns pyproject declares for ``junoview``."""
    assert tomllib is not None
    with (REPO / "pyproject.toml").open("rb") as fh:
        data = tomllib.load(fh)
    return data["tool"]["setuptools"]["package-data"]["junoview"]


def _packaged() -> set[Path]:
    """Every file those patterns actually match, relative to the package."""
    found: set[Path] = set()
    for pattern in _declared():
        found |= {p.relative_to(PKG) for p in PKG.glob(pattern)
                  if p.is_file()}
    return found


def _assets_on_disk() -> set[Path]:
    """Every shipped asset file, relative to the package.

    ``.py`` is excluded because ``assets/`` is itself a package: its
    modules reach the wheel through ``[tool.setuptools.packages.find]``,
    not through package-data. ``test_asset_modules_are_real_packages``
    holds up that other half. ``__pycache__`` is excluded because it is
    why the patterns are listed by extension rather than as
    ``assets/**/*`` in the first place.
    """
    return {p.relative_to(PKG) for p in (PKG / "assets").rglob("*")
            if p.is_file() and "__pycache__" not in p.parts
            and p.suffix not in (".py", ".pyc")}


@needs_toml
def test_package_data_names_every_asset_file():
    """An asset no pattern matches is missing from every published wheel.

    This is the general form of T95. It fails for a new directory under
    ``assets/`` as loudly as it would have failed for ``js/deck/``.
    """
    missing = sorted(_assets_on_disk() - _packaged())
    assert not missing, (
        "these files are on disk but no [tool.setuptools.package-data] "
        "pattern matches them, so they will not be in a wheel:\n  "
        + "\n  ".join(str(p) for p in missing)
        + "\nRemember a setuptools `*` does not cross a `/`: each "
          "directory under assets/ needs its own line.")


@needs_toml
def test_every_deck_fragment_is_packaged():
    """The specific regression, named, so a failure says what broke.

    ``deck_js()`` reads these fifteen by name and ``render_page`` calls
    it unconditionally, so one absent fragment is a dead renderer rather
    than a degraded one.
    """
    from junoview import assets

    packaged = _packaged()
    absent = [name for name in assets.DECK_PARTS
              if Path("assets/js/deck") / f"{name}.js" not in packaged]
    assert not absent, (
        f"DECK_PARTS members missing from package-data: {absent}")


def test_asset_modules_are_real_packages():
    """A ``.py`` under ``assets/`` only ships if find_packages sees it.

    ``packages.find`` walks for ``__init__.py``, so a module dropped into
    a data-only directory (``assets/js/``, say) would be skipped exactly
    as ``js/deck/*.js`` was -- silently, and only in a wheel. Nothing
    else in the suite would notice, since a checkout imports it fine.
    """
    for module in (PKG / "assets").rglob("*.py"):
        if "__pycache__" in module.parts:
            continue
        assert (module.parent / "__init__.py").exists(), (
            f"{module.relative_to(PKG)} sits in a directory with no "
            "__init__.py, so find_packages will not ship it and no "
            "package-data pattern covers .py either")


@needs_toml
def test_py_typed_is_packaged():
    """The marker is worthless to a downstream type checker if it is not
    in the wheel, and it lives outside ``assets/`` so the sweep above
    would not notice."""
    assert Path("py.typed") in _packaged()


def test_every_asset_the_code_loads_is_readable():
    """Every ``load()`` path used anywhere in the package resolves.

    A checkout satisfies this trivially; its value is against an
    installed copy, which is what ``PYTHONPATH`` cannot fake. It is the
    honest version of what ``test_assets_load_from_the_installed_package``
    once claimed to do -- that name promised more than pytest's own
    ``pythonpath`` setting can ever deliver here.
    """
    from junoview import assets

    for name in ("css/core.css", "css/app.css", "css/deck.css",
                 "css/widget.css", "css/widget-media.css",
                 "js/app.js", "js/pptx.js", "js/sw.js", "js/widget.js",
                 "html/page.html", "html/shell.html", "html/deck.html",
                 "html/help.html", "html/mathjax.html",
                 "html/web-loader.html"):
        assert assets.load(name).strip(), f"asset {name} is empty or missing"
    for part in assets.DECK_PARTS:
        assert assets.load(f"js/deck/{part}.js").strip()


def test_the_asset_loaders_and_the_files_agree():
    """No asset file is orphaned and no loader points at nothing.

    A file under ``assets/`` that nothing loads is dead weight in every
    wheel; the reverse is a crash. Both are silent, so both are checked
    -- the same promise ``test_js_contract`` makes for ``DECK_PARTS``.
    """
    from junoview import assets

    loaded = {"css/core.css", "css/app.css", "css/deck.css",
              "css/widget.css", "css/widget-media.css",
              "js/app.js", "js/pptx.js", "js/sw.js", "js/widget.js",
              "html/page.html", "html/shell.html", "html/deck.html",
              "html/help.html", "html/mathjax.html",
              "html/web-loader.html"}
    loaded |= {f"js/deck/{p}.js" for p in assets.DECK_PARTS}
    on_disk = {p.relative_to(PKG / "assets").as_posix()
               for p in (PKG / "assets").rglob("*")
               if p.is_file() and "__pycache__" not in p.parts
               and p.suffix in (".css", ".js", ".html")}
    assert on_disk == loaded, (
        f"on disk but never loaded: {sorted(on_disk - loaded)}; "
        f"loaded but not on disk: {sorted(loaded - on_disk)}")


@pytest.mark.skipif(sys.version_info < (3, 11),
                    reason="tomllib is 3.11+")
def test_the_patterns_stay_extension_scoped():
    """``assets/**/*`` would also sweep ``__pycache__/*.pyc`` into the
    wheel, which is why the list is by extension. Guard the shape, so a
    future 'fix' for T95 does not take the shortcut the comment rejects.
    """
    assert all("**" not in p for p in _declared())
