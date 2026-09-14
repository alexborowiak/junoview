"""T394: the rail lists what is OPEN; Recents and the library are doors.

The user, 2026-09-13: "the side bar shows all recents where the main
screen shows no recents???? Also the side bar should only show what is
open, not all recents. That should be something separate." The rail was
built from every saved deck, every draft and every deck embedded in an
open notebook, grouped into folders. It is a tab list now, like the
notebook strip above it, and the folders moved to the library dialog.
"""

from __future__ import annotations

from junoview import assets


def test_the_rail_label_says_open_and_has_the_two_doors():
    html = assets.page_template()
    assert '<div class="pr-label">open presentations</div>' in html
    assert 'id="pr-recent"' in html and 'id="pr-library"' in html
    # words plus icons, never icon-only
    assert '<span class="pr-t">Recents</span>' in html
    assert '<span class="pr-t">All presentations&#8230;</span>' in html


def test_the_open_list_is_per_tab_and_survives_a_reload(out):
    assert "  var OPEN_PRES_KEY='sempres-open:'+SCOPE;" in out
    assert "function ssGet(k){try{return sessionStorage.getItem(k);}" in out
    assert "  function openPresentationNames(){" in out
    assert "  function noteSessionOpen(name){" in out
    assert "  function closeOpenPresentation(name){" in out
    # opening a deck or choosing any kind of presentation marks it open;
    # a rename follows it; a delete forgets it
    assert ("    noteSessionOpen(name);\n"
            "    if(typeof renderDeckPresentationDrawer") in out
    assert "    noteSessionOpen(nm);   /* T394: it is open now" in out
    assert "    renameOpenPresentation(oldName,newName);" in out
    assert ("    closeOpenPresentation(name);\n"
            "    if(typeof renderDeckPresentationDrawer") in out


def test_the_rail_is_built_from_the_open_list_not_the_library(out):
    start = out.index("  function renderPresTabs(){")
    body = out[start:out.index("  var newFoldBtn=", start)]
    assert "openPresentationNames()" in body
    assert "draftNames()" not in body
    assert "explicitFolders()" not in body
    assert "draggable" not in body
    # the x closes the row; it does not delete the presentation
    assert "del.title='Close \"'+nm+'\" (it stays saved)';" in body
    assert "closeOpenPresentation(nm);" in body
    assert "deletePresByName" not in body
    assert "none.textContent='nothing open';" in body


def test_the_library_took_the_folders_and_the_filing(out):
    assert "  function hubFolderHead(f,count){" in out
    assert "  function hubDropBoot(){" in out
    assert "    hubDropBoot();" in out
    start = out.index("  function renderPresentationHub(){")
    body = out[start:out.index("  function hubDropBoot(){", start)]
    assert ("explicitFolders().forEach(function(f){"
            "folders[f]=[];order.push(f);});") in body
    assert "allHost.appendChild(hubFolderHead(f,folders[f].length));" in body
    assert "b.draggable=true;" in body
    # the rail's Folder row opens the library's own form
    assert ("  if(newFoldBtn) newFoldBtn.addEventListener('click',function(){\n"
            "    if(window.SemApp&&window.SemApp.deckNewFolder)") in out


def test_the_presenting_drawer_lists_the_other_open_presentations(out):
    """T448 named the list first and then walked it, so the deck's own
    name can lead it even before notePresentationOpen has run; the row
    that is not yours still switches to it."""
    start = out.index("  function renderDeckPresentationDrawer(){")
    body = out[start:out.index("  /* the dock menu:", start)]
    assert "      var names=openPresentationNames().slice();" in body
    assert ("      if(pres&&pres.name&&names.indexOf(pres.name)<0) "
            "names.unshift(pres.name);") in body
    assert "      names.forEach(function(nm){" in body
    assert "mine?'The presentation you are in':('Switch to “'+nm+'”')," in body


def test_the_css_for_doors_and_library_folders(out):
    assert ".pr-door{color:#69788a;font-size:11.5px;padding:7px 10px;}" in out
    assert ".pr-none{padding:6px 10px;color:#4e5f70;font:11px var(--sans);" in out
    assert ".presentation-hub-folder{display:flex;align-items:center;gap:7px;" in out
    assert ".presentation-hub-folder.dropping{border-color:var(--cyan);" in out
    assert ".presentation-hub-list.dropping-root{outline:2px dashed" in out
    # the rail's folder styling went with the folders
    assert ".pr-folder{" not in out
    assert ".pr-fctrl" not in out
