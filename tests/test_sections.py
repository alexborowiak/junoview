"""How authored headings become the document's section structure. Covers
markdown `#` headings and raw-HTML headings (attributes and inline styles
included) registering as sections, the three real tiers (#/##/### at levels
1/2/3) with #### staying an in-section kicker, outline numbering rules, and
the positional rules that keep same-titled headings distinct and stop a late
heading from claiming the synthetic preamble bucket. Also covers `#|
section:` grouping at tier two, section slugs living in their own namespace,
and the tier/collapse-cascade attributes reaching the rendered DOM.
"""

from __future__ import annotations

from junoview.notebook.directives import _lead_heading
from junoview.notebook.parser import parse_notebook


def test_markdown_headings_become_sections():
    """h1 (# ) headings become sections too, not just the document title."""
    hdoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# PR"},
        {"cell_type": "code", "source": "x = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## Details"},
        {"cell_type": "code", "source": "y = 2", "outputs": []}]})
    assert any(s.title == "PR" and s.level == 1 for s in hdoc.sections)
    assert any(s.title == "Details" and s.level == 2 for s in hdoc.sections)
    assert hdoc.title == "PR"          # first h1 also names the document
    # a real `# Overview` claims the synthetic pre-heading bucket (one section,
    # promoted to level 1) instead of leaving a mis-styled level-2 twin
    odoc = parse_notebook({"cells": [
        {"cell_type": "code", "source": "import os", "outputs": []},
        {"cell_type": "markdown", "source": "# Overview"},
        {"cell_type": "code", "source": "z = 2", "outputs": []}]})
    ovs = [s for s in odoc.sections if s.title == "Overview"]
    assert len(ovs) == 1 and ovs[0].level == 1


def test_raw_html_headings_register_and_are_consumed():
    """Raw HTML headings (with attributes / inline styles) register exactly
    like ``#`` headings -- notebooks that style their headers must still get
    sections."""
    hhtml = parse_notebook({"cells": [
        {"cell_type": "markdown",
         "source": "<h1 style='color:cyan'> Demonstration: Single Ensemble "
                   "</h1>"},
        {"cell_type": "code", "source": "z = 1", "outputs": []},
        {"cell_type": "markdown", "source": '<h2 class="x">Details</h2>'},
        {"cell_type": "code", "source": "z2 = 2", "outputs": []}]})
    assert any(s.title == "Demonstration: Single Ensemble" and s.level == 1
               for s in hhtml.sections)
    assert any(s.title == "Details" and s.level == 2 for s in hhtml.sections)
    assert hhtml.title == "Demonstration: Single Ensemble"
    # the heading tag itself is consumed (not left as prose in a note); an
    # empty <h1></h1> is NOT a heading; markdown `#` still works
    assert _lead_heading("<h1 style='c'>Hi</h1>") == (1, "Hi", "")
    assert _lead_heading("<h3>Deep</h3>\n\nbody") == (3, "Deep", "body")
    assert _lead_heading("<h1></h1>") is None
    assert _lead_heading("# Plain")[1] == "Plain"


def test_repeated_heading_titles_stay_positional():
    """Headings are POSITIONAL: two sections sharing a title stay distinct and
    in order -- content is never merged across parents (regression guard)."""
    ddoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Model A"},
        {"cell_type": "code", "source": "a = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## Summary"},
        {"cell_type": "code", "source": "sa = 1", "outputs": []},
        {"cell_type": "markdown", "source": "# Model B"},
        {"cell_type": "code", "source": "b = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## Summary"},
        {"cell_type": "code", "source": "sb = 1", "outputs": []}]})
    assert [s.title for s in ddoc.sections] == \
        ["Model A", "Summary", "Model B", "Summary"]
    # the SECOND Summary owns Model B's summary cell, not the first
    summaries = [s for s in ddoc.sections if s.title == "Summary"]
    assert "sa = 1" in summaries[0].items[0].members[0]["code"]
    assert "sb = 1" in summaries[1].items[0].members[0]["code"]


def test_authored_headings_become_three_tiers_of_sections():
    """authored headings never vanish: a `#` followed straight by another
    heading keeps BOTH sections (header-only sections render fine).

    THREE section tiers: #/##/### are all real sections (levels 1/2/3)
    with outline numbers; #### stays an in-section kicker label
    """
    hdoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Trends"},
        {"cell_type": "markdown", "source": "# Functions"},
        {"cell_type": "code", "source": "x = 1", "outputs": []}]})
    assert [s.title for s in hdoc.sections] == ["Trends", "Functions"]
    tdoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Opening and Processing"},
        {"cell_type": "markdown", "source": "## ERA5"},
        {"cell_type": "markdown", "source": "### Processing"},
        {"cell_type": "code", "source": "p = 1", "outputs": []},
        {"cell_type": "markdown", "source": "#### Opening"},
        {"cell_type": "code", "source": "q = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## CMIP6"}]})
    assert [(s.title, s.level, s.number) for s in tdoc.sections] == [
        ("Opening and Processing", 1, "1"), ("ERA5", 2, "1.1"),
        ("Processing", 3, "1.1.1"), ("CMIP6", 2, "1.2")]


def test_h4_stays_an_in_section_kicker_subsection():
    """THREE section tiers: #/##/### are all real sections (levels 1/2/3)
    with outline numbers; #### stays an in-section kicker label."""
    tdoc = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Opening and Processing"},
        {"cell_type": "markdown", "source": "## ERA5"},
        {"cell_type": "markdown", "source": "### Processing"},
        {"cell_type": "code", "source": "p = 1", "outputs": []},
        {"cell_type": "markdown", "source": "#### Opening"},
        {"cell_type": "code", "source": "q = 1", "outputs": []},
        {"cell_type": "markdown", "source": "## CMIP6"}]})
    proc = tdoc.sections[2]
    assert [it.subsection for it in proc.items] == ["", "Opening"]


def test_outline_numbers_skip_tiers_the_document_never_uses():
    """Numbering rules pinned by three hand-built documents."""
    # a document that never uses h1 drops the unused leading counter
    t2 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "## A"},
        {"cell_type": "markdown", "source": "### B"}]})
    assert [(s.number) for s in t2.sections] == ["1", "1.1"]
    # a tier the document NEVER uses vanishes from numbers ("1.1", not the
    # phantom "1.0.1"); a tier that exists but hasn't opened yet stays 0 so
    # two sections can never share a number ("0.1" / "1" / "1.1")
    t3 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# A"},
        {"cell_type": "markdown", "source": "### B"},
        {"cell_type": "markdown", "source": "### C"}]})
    assert [s.number for s in t3.sections] == ["1", "1.1", "1.2"]
    t4 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "## A"},
        {"cell_type": "markdown", "source": "# B"},
        {"cell_type": "markdown", "source": "## C"}]})
    assert [s.number for s in t4.sections] == ["0.1", "1", "1.1"]


def test_late_overview_heading_cannot_claim_the_preamble_bucket():
    """A LATE "### Overview" must not claim the synthetic preamble bucket
    and teleport its content to the top (the claim window closes at the
    first heading)."""
    t5 = parse_notebook({"cells": [
        {"cell_type": "code", "source": "import os", "outputs": []},
        {"cell_type": "markdown", "source": "# Intro"},
        {"cell_type": "markdown", "source": "### Overview"},
        {"cell_type": "code", "source": "late = 1", "outputs": []}]})
    assert [s.title for s in t5.sections] == \
        ["Overview", "Intro", "Overview"]
    assert t5.sections[0].level == 2 and t5.sections[2].level == 3
    assert "late = 1" in t5.sections[2].items[0].members[0]["code"]


def test_section_directive_groups_at_tier_two_only():
    """"#| section:" groups by name at TIER 2 only -- a positional ###
    sub-heading sharing the name must not capture directive cells."""
    t6 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "# Model A"},
        {"cell_type": "markdown", "source": "### Summary"},
        {"cell_type": "code", "source": "sa = 1", "outputs": []},
        {"cell_type": "code", "source": "#| section: Summary\nsx = 1",
         "outputs": []}]})
    t6_sum = [s for s in t6.sections if s.title == "Summary"]
    assert len(t6_sum) == 2
    assert t6_sum[0].level == 3 and t6_sum[1].level == 2
    assert "sx = 1" in t6_sum[1].items[0].members[0]["code"]


def test_section_slugs_live_in_their_own_namespace():
    """Section slugs live in their own namespace: a ### heading never
    steals a same-titled card's slug (deck refs stay stable)."""
    t7 = parse_notebook({"cells": [
        {"cell_type": "markdown", "source": "### Trend map"},
        {"cell_type": "code", "source": "#| title: Trend map\nplot()",
         "outputs": []}]})
    assert t7.sections[0].section_id == "sec-trend-map"
    assert t7.sections[0].items[0].item_id == "trend-map"


def test_section_tiers_and_collapse_cascade_reach_the_dom(out):
    """Tiers reach the DOM: data-level + tier classes on sections, nav
    rows and cell lists; the eyebrow carries the outline number; and the
    collapse/hide CASCADE (an ancestor folds the deeper tiers) shipped."""
    assert 'data-level="2"' in out and "sectionhead-l" in out
    assert ".sectionhead-l3 h2" in out and ".navsec-l3" in out
    assert "navitems-l" in out and '<span class="eyebrow">section 1<' in out
    assert "function recalcSecCascade" in out
    assert ".section.sec-under,.section.sec-under-off{display:none;}" in out
    assert ".navsec-row.nav-under,.navitems.nav-under{display:none;}" in out
