"""Three things that stop the editor being a notebook accessory.

2026-08-22, user: "Interactive presentation: clicking figures/text makes
full screen" / "would be cool if there was a refresh images with local
object ... If local path is gone though, give a list of ones that couldn't
be refreshed but just leave them as they were before the refresh" / "I think
we are starting to get some better features than powerpoint. It would be
good if this wasn't so notebook forward now ... the default screen had
something more standard, like 'create new', or open previous."
"""

from __future__ import annotations

from junoview.render.page import render_page

# ------------------------------------------------- tap to enlarge

def test_tapping_an_item_in_playback_can_enlarge_it(out):
    """It reuses the spotlight that Alt+click and Z already open, so there
    is one enlarge and not two."""
    assert "if(pres.tapzoom){" in out
    assert "e.stopPropagation();spotlight(tz);return;}" in out
    assert 'id="pl-tap"' in out


def test_tap_to_enlarge_is_a_setting_not_the_new_default(out):
    """It is in tension with a STANDING INSTRUCTION -- "a plain click MUST
    still advance, that is the gesture a talk runs on" (2026-08-20) -- so
    it is off until asked for, and even on it only claims the item itself:
    the rest of the slide, which is most of it, still advances.

    Turning it off restores the old behaviour exactly.
    """
    body = out.split("slideEl.addEventListener('click',function(e){")[1]
    body = body.split("\n        });")[0]
    # the guard is on the ITEM, not the slide
    assert "e.target.closest('.an-item')" in body
    # and advance() is still the fall-through for everything else
    assert body.rstrip().endswith("advance();")


def test_the_tap_setting_survives_a_reload_and_an_undo(out):
    """The same three whitelists showNums goes through -- a deck-level
    preference that is not named in all of them dies quietly."""
    assert "if(p.tapzoom) out.tapzoom=1;" in out
    assert "showNums:pres.showNums||0,tapzoom:pres.tapzoom||0," in out
    assert "if(d.tapzoom) pres.tapzoom=1; else delete pres.tapzoom;" in out


# ------------------------------------------ pictures that know their file

def test_a_picture_can_be_re_read_from_the_file_it_came_from(out):
    """The picture itself stays embedded -- a deck has to survive being
    sent to somebody, and a path on your machine means nothing on theirs.

    What is kept beside it is a file HANDLE, which survives a reload, can
    be re-read on demand, and asks permission rather than granting the
    page a filesystem. Handles cannot be JSON, so they go in the same
    IndexedDB store the project handle already uses.
    """
    assert "var FHKEY='imgfile:';" in out
    assert "function linkedImages(){" in out
    assert "function refreshLinkedImages(list){" in out
    assert "if(a&&a.k==='image'&&a.fkey) out.push" in out
    # inserted through showOpenFilePicker, because the <input type=file>
    # can only ever hand back the bytes
    assert ("if(!window.showOpenFilePicker){imgFile.value='';"
            "imgFile.click();return;}") in out
    assert "img.fkey=link.key;img.fname=link.name||'';" in out


def test_a_picture_whose_file_is_gone_is_left_exactly_as_it_was(out):
    """The user asked for this precisely: "give a list of ones that
    couldn't be refreshed but just leave them as they were before the
    refresh".

    Losing a figure because a folder was renamed would be far worse than
    a stale one, so nothing is written unless the file actually reads.
    """
    body = out.split("function refreshLinkedImages(list){")[1]
    body = body.split("\n  }")[0]
    assert "lost.push({si:e.si,name:e.a.fname||'a picture'});" in body
    # the only write is inside the success path
    assert "e.a.src=src;ok++;" in body
    assert body.index("if(!h) throw 0;") < body.index("e.a.src=src")
    # ...and the report NAMES them, with the slide they are on
    assert "could not be read and '" in out
    assert "+(r.lost.length===1?'was':'were')+' left exactly as before: '" in out


def test_the_per_picture_refresh_never_shows_when_it_could_only_fail(out):
    """A button offered on a picture that was never linked to a file is a
    button that can only ever report failure."""
    assert "if(xa&&xa.k==='image'&&xa.fkey) anyLinked=true;" in out
    assert "ir.hidden=!anyLinked;" in out
    # and it is declared, so the completeness check does not warn
    assert "#fmt-imgrefresh" in out


# ----------------------------------------------------------- front door

def test_the_front_door_offers_a_presentation_not_only_a_notebook():
    """The welcome screen offered only ways of opening a NOTEBOOK, so a
    presentation was something you could reach only after loading one --
    and by now the editor stands up perfectly well on its own.
    """
    web = render_page([], mode="web")
    assert 'id="welcome-new"' in web
    # PRIMARY, and ahead of both open buttons
    assert web.index('id="welcome-new"') < web.index('id="welcome-open"')
    new_btn = web.split('id="welcome-new"')[0][-120:]
    assert "primary" in new_btn
    # the old primary is demoted rather than removed
    assert 'class="dbtn ghost" id="welcome-open"' in web


def test_the_tagline_leads_with_presenting():
    web = render_page([], mode="web")
    assert "Build a presentation, or open a notebook" in web
    assert "Filter, view and present your Jupyter notebooks" not in web


def test_a_deck_can_exist_with_no_notebook_behind_it(out):
    """Every tool except the cell frame works on an empty deck, so this is
    a real way IN and not a shortcut to a dead end."""
    assert "window.SemApp.deckNew=function(){newPresentation();};" in out
    assert "APP.deckNew()" in out
    # refreshChrome already knew a deck owns the window on its own
    assert "var deckOn=!!(APP.deckState&&APP.deckState());" in out


# ---------------------------------------------------------------------------
# public/private naming (TASKS T38)
# ---------------------------------------------------------------------------

def test_no_name_crosses_a_subpackage_boundary_wearing_an_underscore():
    """TASKS T38's rule, kept honest by a check rather than by memory.

    A leading underscore means private to its own subpackage. Inside
    `notebook/`, `classify._parse_or_none` used by `parser` is exactly
    that and keeps it. A name imported from ANOTHER subpackage is not
    private by any definition -- `_as_presentations` was imported by the
    CLI, two server modules and the shim, telling four callers something
    untrue.

    `semantic_render.py` is exempt and says so in its own comment: it
    mirrors the old flat module's namespace, so it aliases rather than
    renames.
    """
    import ast
    from pathlib import Path

    src = Path(__file__).resolve().parent.parent / "src"
    offenders = []
    for f in sorted(src.rglob("*.py")):
        if "__pycache__" in f.parts or f.name == "semantic_render.py":
            continue
        parts = f.relative_to(src).parts          # junoview/notebook/x.py
        here = parts[1] if len(parts) > 2 else ""   # "" for top-level
        tree = ast.parse(f.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.ImportFrom):
                continue
            # where the name is coming FROM, as a subpackage or ""
            mod = (node.module or "")
            if node.level >= 2:                     # "from ..x import"
                there = mod.split(".")[0] if mod else ""
                if there not in ("notebook", "render", "server"):
                    there = ""
            else:                                   # "from .x import"
                there = here
            if there == here:
                continue
            for alias in node.names:
                n = alias.name
                if n.startswith("_") and not n.startswith("__"):
                    offenders.append(
                        f"{f.relative_to(src)} imports {n} from "
                        f"{'.' * node.level}{mod}")
    assert not offenders, (
        "these names cross a subpackage boundary with an underscore, "
        "which claims a privacy they do not have -- drop it, or keep "
        "the caller inside the subpackage:\n  "
        + "\n  ".join(offenders))


def test_the_shim_still_answers_to_every_old_name():
    """A rename that broke the compatibility shim would be a break
    dressed up as tidying. The old spellings are aliases now, so they
    are the same objects.
    """
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        import semantic_render as sr

    from junoview.notebook.loader import (
        is_url,
        normalize_nb_url,
        stem_for,
    )
    from junoview.notebook.presentations import as_presentations

    assert sr._is_url is is_url
    assert sr._stem_for is stem_for
    assert sr._normalize_nb_url is normalize_nb_url
    assert sr._as_presentations is as_presentations
