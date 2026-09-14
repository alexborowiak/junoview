"""T429: the draft store is IndexedDB, not localStorage.

The user, 2026-09-14: "I tried to save a presentation ... the
presentation seems to just have disappeared and it wasn't in recents
and didn't save at all ... There seems to be a lot of bugs around
saving." The library WAS localStorage, every draft inside a ~5 MB
budget, and a deck with a few pasted pictures does not fit: Recents
filtered it out, a rename dropped the old key and could not write the
new one, and a reload opened a default deck in its place. One cap,
every symptom.

Drafts live in one in-memory map now, read synchronously by everything
that used to read localStorage, written through to IndexedDB (hundreds
of megabytes). Legacy localStorage drafts are read once at boot, copied
into IndexedDB and dropped.

Driven live: an 11 MB deck imported, reloaded and still open; renamed,
reloaded and open under the new name with its three slides; a seeded
localStorage draft found in the drafts store after one reload.
"""

from __future__ import annotations


def test_the_store_is_a_map_written_through_to_indexeddb(out):
    assert "  var DRAFTS={},draftsDbFull=false,draftsLoaded=false;" in out
    assert "  function draftGet(name){" in out
    fn = out.split("  function draftSet(name,json,quiet){")[1].split("\n  }")[0]
    assert "    DRAFTS[name]=json;" in fn
    assert "    idbPut(PFX+name,json,'drafts').then(function(){" in fn
    # the legacy copy goes, and with it the quota it held
    assert ("    lsDel(PFX+name);   /* the legacy copy: one source, "
            "and its quota back */") in fn
    assert "    return true;" in fn
    fn = out.split("  function draftDel(name){")[1].split("\n  }")[0]
    assert "    delete DRAFTS[name];" in fn and "    idbDel(PFX+name,'drafts')" in fn
    assert ("  function draftNames(){\n"
            "    /* T429: the map, not a walk of localStorage */") in out


def test_one_database_two_stores(out):
    assert "      try{r=indexedDB.open('junoview',2);}catch(e){fail(e);return;}" in out
    assert "db.createObjectStore('drafts');}catch(e){}" in out
    assert "db.createObjectStore('handles');}catch(e){}" in out
    assert "  function idbPut(k,v,store){\n    store=store||'handles';" in out
    assert "  function idbAll(store){" in out
    # the save fragment no longer carries its own single-store copy
    assert out.count("function idbPut(") == 1


def test_boot_reads_legacy_then_the_store(out):
    fn = out.split("  function initFirstPresentation(){")[1].split("\n  }")[0]
    assert "    draftsLoadLocal();" in fn
    assert "    var bootName=(pres&&pres.name)||'';" in fn
    assert "    draftsLoadDb().then(function(fresh){" in fn
    # the deck you were on takes the screen back, unless you have moved
    assert ("      if(fresh.indexOf(want)>=0&&pres&&pres.name===bootName\n"
            "         &&bootName!==want){") in fn
    load = out.split("  function draftsLoadLocal(){")[1].split("\n  }")[0]
    assert "      if(lsGet(PFX+nm)!=null) draftSet(nm,DRAFTS[nm],true);" in load


def test_every_draft_door_goes_through_the_store(out):
    # (draftsLoadLocal's one lsGet(PFX+nm) is the legacy read, on purpose)
    for old in ("lsSet(PFX+nm", "lsDel(PFX+nm",
                "lsDel(PFX+old", "lsDel(PFX+savedName", "lsGet(PFX+name)",
                "lsSet(PFX+(pres.name", "lsDel(PFX+(pres.name"):
        assert old not in out, old
    assert "    if(draftsFull()&&saveTarget==='browser'){" in out
    assert "    return !!(name&&(draftGet(name)||savedByName(name)));" in out
