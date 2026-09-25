/* 99-boot.js — THE BOOT SEQUENCE. Last on purpose, and last by filename: everything above only declares.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ================= THE BOOT SEQUENCE =================
     Every piece of load-time work whose ORDER matters runs from here,
     after every declaration and every `var` initialiser above. Never
     call any of it mid-file, and never add a sub-IIFE that executes
     logic at load: function declarations hoist but `var` initialisers
     do not, and a throw during load silently kills the rest of this
     IIFE — no handlers, no exports, no deck, and no test notices. Not
     hypothetical: on 2026-08-22 a mid-file loadPresentation(last) ran
     histReset() → syncCustomTypes() → Object.keys(STYLE_DEFAULTS)
     thousands of lines before STYLE_DEFAULTS was assigned, and the
     TypeError killed everything below it — the editor quietly stopped
     existing. These calls keep the relative order they ran in when they
     were scattered mid-file.
     WHAT STILL RUNS MID-FILE, AND WHY THAT IS NOT A LIE (T497). The
     older parts keep 51 executing sub-IIFEs and a few hundred bare
     wiring statements -- onBtn(...), menuAction(...), a listener on a
     node the markup guarantees. None of them reads a `var` declared
     later (a tokenised order analysis of all of them and the 108
     functions they call at load found no such read on 2026-09-15),
     every id they look up is one tests/test_js_contract.py proves
     exists, and every lookup at the IIFE's own level is guarded. That
     is the bargain: what remains mid-file only wires; anything that
     DECIDES -- reads a store, walks the deck's markup, measures --
     belongs here. test_js_contract.py ratchets the sub-IIFE count so
     the number can fall and never climb, and refuses a top-level
     lookup used unguarded (an addEventListener straight off `$`). */
  /* Editor controls are wired on first entry. Notebook-only visits do
     not build galleries or lay out a hidden editor. */
  var editorToolsReady=false;
  function initEditorTools(){
    if(editorToolsReady) return;
    editorToolsReady=true;
    renderLayoutPicker();
    initRibbonLayoutDoor();
    rbnReadoutBoot();           /* folded doors show their choice (T441) */
    rbnShelfBoot();             /* and open into the ribbon's shelf (T453) */
    animBoot();
    animCfgBoot();              /* the Animation panel (T445) */
    seqBoot();       /* the sequencing mode's bar (T168) */
    galBoot();       /* the effect gallery's door (T171) */
    txStripBoot();              /* the kinds of text box, as tiles (T188) */
    shapeStripBoot();           /* the shapes, as tiles (T197) */
    imgPaneBoot();
    quickSwatchBoot();          /* the deck's six colours, on the row */
    ohOverviewBoot();           /* History of this object, full screen */
    layoutBuilderBoot();        /* layouts of your own (T226) */
    listGalleryBoot();          /* kinds of bullet and numbering (T227) */
    homeDoorsBoot();            /* Notes and Optional on Home (T228) */
    cloneDoorsBoot();           /* clones, on the Object tab (T229) */
    transRibbonBoot();          /* how a SLIDE arrives (T289) */
    flipFxBoot();               /* how a flip book's page turns (T234) */
    motionBoot();               /* wobble / float / pulse (T385) */
    webBoot();                  /* a live web page on a slide (T388) */
    storyBoot();                /* the animation story (T391) */
    animOutBoot();              /* Disappear, on the Animation tab (T238) */
    focusBoot();                /* T472: focus, on its click */
    versionDoorsBoot();         /* History and Checkpoint, on Home (T236) */
    chartBoot();                /* the Chart pane's door (T322) */
    tablePaneBoot();            /* the Table pane's door (T324) */
    citeBoot();                 /* the Citations pane's door (T325) */
    spActionsBoot();            /* the Layers pane's Actions popover (T221) */
    stripMoreBoot();            /* every strip's Show-all door (T203) */
    presentTabBoot();           /* the Present tab and Layers on Home (T216) */
    optPanelBoot();             /* every window of options' door (T177) */
    /* The saved-layout rows walk real markup, so belong in boot (T89).
       Restore the layout BEFORE the per-button preferences: the layout
       decides each control's group, then preferences order/hide it there.
       The second preferences pass also covers the default layout (T11). */
    initReuseDoors();
    applyRibbonLayout(rbnCurrentId(),true);
    applyRibbonPrefs();
  }
  initShellRegistry();        /* every notebook the page carries */
  nbDoorsSync();              /* the notebook doors, greyed without one (T440) */
  initFirstPresentation();    /* the presentation the page opens with */
  /* app.js paints the welcome before this file loads; redraw it now the
     SemApp.deck* hooks and the registry can answer its questions */
  if(APP.refreshChrome) APP.refreshChrome();
  renderAutosaveItem();
  renderSaveBtn();
  /* belt-and-braces: initFirstPresentation already synced the custom
     types (via histReset, or explicitly on its default branch), so this
     second pass is an idempotent no-op — it re-pins the invariant the
     2026-08-22 incident was about: the registry must be synced by the
     time boot finishes, whatever path loaded the presentation. */
  syncCustomTypes();
  status();
  initPresenterControls();
  /* app.js owns the one horizontal strip; this registers presentation
     tabs beside its notebook tabs whenever either list is rebuilt. */
  APP.renderPresentationTabs=renderTopPresTabs;
  renderPresTabs();
  /* the two auto-hides: their button and pointer listeners only. The
     remembered STATE is applied on first entry to edit mode, beside the
     ribbon fold's restore -- nothing here has geometry to measure yet. */
  initFilmAuto();
  initRibbonAuto();
  talkToolsBoot();            /* laser, magnifier, black screen (T386) */
  scrollShowBoot();           /* the scrolling version (T389) */
  pptxImportBoot();           /* .pptx import: File, launcher, drop (T320) */
  presentationHubBoot();      /* Home + presenting drawer, one library */
  mediaBoot();                /* video and audio: Insert, pane, drop (T321) */
  autoDeckBoot();             /* slides from the notebook viewer (T362) */
  overlayBoot();              /* the one outside-click + Escape closer
                                 for every transient menu (T135) */
  /* both IIFEs + their route hooks are now wired — restore the URL's view */
  if(window.SemApp&&window.SemApp.applyInitialRoute)
    window.SemApp.applyInitialRoute();
})();
