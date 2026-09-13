"""T390: the notebook view split into pages (2026-09-12, user: "could the
notebook view have pages; e.g. create page per section, or add page here,
so then instead of all at once it could be split into pages").

A page is a top-level section with every deeper section under it. Paging
is a way of looking, kept per notebook with the layout; the filters still
decide what a page holds. Driven in Chromium: Pages on the example showed
section 1 alone with "Page 1 of N" on the button, Next turned to the
second, and the outline kept every row with the others dimmed.
"""

from __future__ import annotations


def test_the_pager_is_one_group_on_the_appbar(out):
    for cid in ("ab-pages", "sec-pages", "sec-prevpage", "sec-nextpage"):
        assert f'id="{cid}"' in out, cid
    assert "  pagesBoot();" in out
    assert "  function pageRuns(sh){" in out
    # a page starts at the shallowest level with more than one section,
    # and carries the umbrella sections above the first one
    assert "      if(count[k]>1&&+k<lv) lv=+k;});" in out
    assert "        runs.push({sid:sid,sids:pending.concat([sid])," in out
    assert "      } else if(runs.length) runs[runs.length-1].sids.push(sid);" in out


def test_paging_is_enforced_from_the_one_filter_pass(out):
    assert ("      var pgOut=pagedOut(sh);            "
            "/* T390: sections off this page */") in out
    assert "        sec.classList.toggle('pg-out',paged);" in out
    assert "        if(row) row.classList.toggle('nav-paged',paged);" in out
    assert ".section.pg-out{display:none!important;}" in out
    assert ".navsec-row.nav-paged,.navitems.nav-paged{opacity:.4;}" in out


def test_the_outline_is_the_door_to_another_page(out):
    assert "        if(el&&pageBy[stem]){" in out
    assert "            if(pi>=0) setPage(stem,pr[pi].sid,false);" in out


def test_the_page_is_kept_with_the_layout(out):
    assert ("    st.page=pageBy[stem]||'';           "
            "/* T390: which page, or '' */") in out
    assert "    pageBy[stem]=st.page||'';           /* T390 */" in out
    # the button says which page, and stands down for a one-section notebook
    assert "    setBtnText(b,on?('Page '+(i+1)+' of '+runs.length):'Pages');" in out
    assert "    if(runs.length<2){" in out
