"""T440: the notebook doors say "From notebook" and grey out without one.

The user, 2026-09-14: "calling the 'notebook cell' figures is
confusing. It should be 'from notebook', and be greyed out if there
are no notebooks that are open."

The Insert button was "Notebook cell" -- the name of the thing in the
notebook, not of what the button does. It is "From notebook" now, and
so is the drawing group's word for the tool. With no notebook open,
it and the flip book's "+ Figures" are disabled and their title says
to open one; a notebook opening or closing re-judges them.
"""

from __future__ import annotations


def test_the_button_is_named_for_what_it_does(out):
    assert 'id="et-cell" data-tool="cell"' in out
    assert "<span>From notebook</span></button>" in out   # a tile since T463
    assert "        cell:'From notebook',flip:'Flip book',table:'Table'," in out
    assert "Notebook cell</button>" not in out


def test_the_doors_grey_out_without_a_notebook(out):
    fn = out.split("  function nbDoorsSync(){")[1].split("\n  }")[0]
    assert "    var open=!!(APP.order&&APP.order.length);" in fn
    assert "    [['#et-cell'," in fn
    assert "     ['#fp-add-cells'," in fn
    assert "      b.disabled=!open;" in fn
    assert ("      b.title=open?d[1]:('Open a notebook first \\u2014 this "
            "places its '") in fn
    # re-judged as notebooks come and go, and once at boot
    assert ("  document.addEventListener('sem:shell',function(e){\n"
            "    nbDoorsSync();") in out
    assert ("  document.addEventListener('sem:shellclosed',function(e){\n"
            "    nbDoorsSync();") in out
    assert "  nbDoorsSync();              /* the notebook doors" in out
