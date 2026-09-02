"""The ribbon the PowerPoint way (T207).

The user, 2026-09-02, with screenshots of six tabs and PowerPoint's:
"Buttons of all shapes and sizes and configurations all over the place...
buttons in buttons that are confusing and do nothing... Options in
options is shit and can't be clicked... Why do objects not have an x-y
position and also not a width and height... Look at PowerPoint, look at
how much better that looks."
"""

from __future__ import annotations


def test_menus_nest_instead_of_closing_their_parent(out):
    """The overlay owner keeps a stack: a menu opened from inside an open
    popover or window keeps its parent; an outside click closes,
    innermost first, only what it was outside of; Escape peels one."""
    assert "var overlayStack=[];" in out
    assert "var inside=o.menu.contains(menu)||(btn&&o.menu.contains(btn));" in out
    assert "if(inside) keep.push(o); else overlayCloseOne(o);" in out
    assert "overlayStack.splice(at).reverse().forEach(overlayCloseOne);" in out
    assert "if(o.menu.contains(e.target)) break;" in out
    assert "function overlayCloseAll(){" in out
    # overlayNow is still the innermost, for the guards that ask
    assert ("overlayNow=overlayStack.length?"
            "overlayStack[overlayStack.length-1]:null;") in out


def test_the_grid_is_column_major_and_the_buttons_are_flat(out):
    assert ".rbn-row{display:grid;grid-auto-flow:column;" in out
    assert "grid-template-columns:repeat(var(--rbn-cols" not in out
    # flat at rest, lifted on hover, filled when pressed
    assert (".edit-tools .dbtn.rbn-sm,.edit-tools .fx-tile,.edit-tools .dbtn.lay,\n"
            ".edit-tools .rbn-cell .dbtn,.edit-tools .rbn-foldbtn{\n"
            "  border-color:transparent;background:transparent;"
            "box-shadow:none;}") in out
    assert ('body.th-colorful .edit-tools .dbtn:not([aria-pressed="true"])'
            ':not(:hover),') in out


def test_one_text_box_tile_on_insert(out):
    assert 'class="rbn-tall fx-strip big-strip" id="tx-strip"' in out
    assert 'id="tx-strip-frame"' not in out
    assert "var rows=[['','Text box',null]];" in out
    assert "rows.push([id,styleDef(id).label,styleDef(id)]);" not in out


def test_x_y_width_and_height_sit_on_the_object_tab(out):
    for cid in ("fmt-geom-xy", "fmt-geom-wh", "rb-x", "rb-y", "rb-w", "rb-h"):
        assert f'id="{cid}"' in out, cid
    assert "show('#fmt-geom-xy',hasBox);show('#fmt-geom-wh',hasBox);" in out
    assert "var GEO_HOSTS=['#sz-','#rb-'];" in out
    assert "geoEach(k,function(el){el.value='';el.disabled=true;});" in out
    assert "if(e.key==='Enter') el.blur();" in out
    # governed, so the completeness audit stays quiet
    assert "var FMT_MANUAL=('#fmt-geom-xy #fmt-geom-wh #fmt-lhwrap '" in out
    assert ".rbn-geom input{width:54px;height:24px;" in out


def test_a_tooltip_is_a_bubble_not_a_button(out):
    assert ".apptip{position:fixed;z-index:300;background:#0b1520;" in out
    tip = out.split(".apptip{")[1][:400]
    assert ("border:1px solid color-mix(in srgb,var(--accent) 33%,transparent);"
            not in tip)
    assert "    },520);" in out
