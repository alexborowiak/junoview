"""A chart is drawn to its own data, in the page's own ink (T288).

From the 2026-09-05 review. Two faults in one renderer, both of which
make the figure -- the thing this whole product exists to put on a
slide -- say something untrue.

Driven on a white page with a 95..105 line series and the same data as
bars:

  line   axis 0..105 -> 95..105, and the series' vertical travel goes
         from a flat line in the top tenth to 240px
  bar    axis stays 0..150, because a bar's length IS its value
  ink    #dbe7ef (about 1.2:1 on white) -> #0b141d
"""

from __future__ import annotations


def test_the_scale_comes_from_the_data(out):
    """It started at 0..1 and only ever widened, so a 95..105 series got
    an axis of 0..105 and drew as a flat line -- the shape of the data,
    which is the entire reason for a chart, was gone."""
    assert "    var lo=Infinity,hi=-Infinity;" in out
    assert "      if(!isFinite(v)) return;" in out
    assert "    if(!isFinite(lo)||!isFinite(hi)){lo=0;hi=1;}" in out
    # a single-valued series still gets a band rather than a zero range
    assert "    if(hi===lo){lo-=0.5;hi+=0.5;}" in out
    assert "var lo=0,hi=1;" not in out


def test_but_a_bar_still_starts_at_zero(out):
    """Not a preference. A bar's length IS its value, so a bar chart cut
    off above zero misstates every comparison on it. A line or a scatter
    says where the points are, and cropping to them is honest."""
    assert "    if(a.ct==='bar'){if(lo>0) lo=0; if(hi<0) hi=0;}" in out


def test_the_chart_takes_the_pages_ink_not_the_editors(out):
    """Every poster starts white, so every chart on one drew its title,
    axis labels, legend and gridlines in #dbe7ef on white -- about
    1.2:1. buildPrintRoot and the pptx exporter both already asked
    pageIsLight; the on-screen renderer was the one that did not."""
    assert "    var lightPg=(typeof pageIsLight==='function')" in out
    assert "      &&pageIsLight((pres&&pres.pageBg)||'#0b141d');" in out
    assert "    var ink=lightPg?'#0b141d':'#dbe7ef';" in out
    assert "    var dim=lightPg?'#4a5b68':'#8aa0b0';" in out
    assert "    var grid=lightPg?'#4a5b6833':'#8aa0b033';" in out
    # the literal trio is gone
    assert "var ink='#dbe7ef',dim='#8aa0b0',grid='#8aa0b033';" not in out
