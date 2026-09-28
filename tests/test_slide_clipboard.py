"""T516: thumbnail selection and ordinary slide-sorter shortcuts."""

from __future__ import annotations


def test_clicking_the_current_thumbnail_selects_the_slide(out):
    """A stale object selection must not steal the next Copy or Delete."""
    assert ("        if(i===cur){\n"
            "          var layer=stage.querySelector('.annot-layer');\n"
            "          if(layer) selectAnnot(layer,null);") in out


def test_slide_copy_is_a_snapshot_and_the_latest_internal_copy(out):
    body = out.split("  function slideCopy(i){")[1].split("\n  }")[0]
    assert "    slideClip=deep(s);" in body
    assert "    clipBuf=[];clipGrpMeta={};" in body
    assert "navigator.clipboard.writeText('junoview/slide')" in body


def test_slide_shortcuts_defer_to_an_object_selection(out):
    assert ("        if(selIdxs().length) duplicateSel();\n"
            "        else {dupSlide(cur);toast('Slide duplicated');}") in out
    assert ("        else if(slideCopy(cur)){\n"
            "          e.preventDefault();toast('Slide copied');}") in out
    assert ("        else if(slideCut(cur)){\n"
            "          e.preventDefault();toast('Slide cut');}") in out
    assert "if(selIdxs().length) deleteSel(); else delSlide(cur);" in out


def test_slide_paste_uses_both_clipboard_paths(out):
    """The real event wins; the timer covers browsers that fire none."""
    assert ("    if(slideClip&&mk.indexOf('junoview/slide')===0){\n"
            "      e.preventDefault();slidePaste(cur);toast('Slide pasted');"
            "return;\n    }") in out
    assert "          else if(slidePaste(cur)) toast('Slide pasted');" in out


def test_pasted_slides_share_the_safe_duplicate_path(out):
    paste = out.split("  function slidePaste(i){")[1].split("\n  }")[0]
    assert "return slideClip?putSlideCopy(slideClip,i):false;" in paste
