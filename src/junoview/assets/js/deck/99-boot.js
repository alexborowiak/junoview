/* 99-boot.js — THE BOOT SEQUENCE. Last on purpose, and last by filename: everything above only declares.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ================= THE BOOT SEQUENCE =================
     ALL of this file's load-time work runs from here, after every
     declaration and every `var` initialiser above. Never call any of it
     mid-file, and never add a sub-IIFE that executes logic at load:
     function declarations hoist but `var` initialisers do not, and a
     throw during load silently kills the rest of this IIFE — no
     handlers, no exports, no deck, and no test notices. Not
     hypothetical: on 2026-08-22 a mid-file loadPresentation(last) ran
     histReset() → syncCustomTypes() → Object.keys(STYLE_DEFAULTS)
     thousands of lines before STYLE_DEFAULTS was assigned, and the
     TypeError killed everything below it — the editor quietly stopped
     existing. These calls keep the relative order they ran in when they
     were scattered mid-file. */
  initShellRegistry();        /* every notebook the page carries */
  initFirstPresentation();    /* the presentation the page opens with */
  /* app.js paints the welcome before this file loads; redraw it now the
     SemApp.deck* hooks and the registry can answer its questions */
  if(APP.refreshChrome) APP.refreshChrome();
  renderLayoutPicker();
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
  renderPresTabs();
  initRibbonLayoutDoor();
  /* the two auto-hides: their button and pointer listeners only. The
     remembered STATE is applied on first entry to edit mode, beside the
     ribbon fold's restore -- nothing here has geometry to measure yet. */
  initFilmAuto();
  initRibbonAuto();
  /* the animation surface (T158). It used to run itself from the
     middle of 45-images.js; a throw in an executing sub-IIFE takes
     the whole deck IIFE with it, which is T133 exactly. */
  animBoot();
  seqBoot();       /* the sequencing mode's bar (T168) */
  galBoot();       /* the effect gallery's door (T171) */
  txStripBoot();              /* the kinds of text box, as tiles (T188) */
  shapeStripBoot();           /* the shapes, as tiles (T197) */
  imgPaneBoot();              /* the All images pane's door (T202) */
  stripMoreBoot();            /* every strip's Show-all door (T203) */
  styleSystemDoorBoot();      /* Style system on the ribbon (T212) */
  overlayBoot();              /* the one outside-click + Escape closer
                                 for every transient menu (T135) */
  optPanelBoot();             /* every window of options' door (T177) */
  /* the three saved-layout rows in the Layouts menu (T89). Here, not
     mid-file: it walks the deck's markup, which is only guaranteed real
     by the time the boot sequence runs. */
  initReuseDoors();
  /* the ribbon you kept: applied once here, at the tail, after every
     declaration and every group's markup is real. It must not run
     mid-file — it walks #edit-tools and calls fitEditRibbon (T11).
     The LAYOUT goes first and the per-button preferences follow, because
     a layout decides which group a control is in and the preferences
     order and hide it WITHIN that group — the other way round would sort
     a group the control is about to leave. applyRibbonLayout ends by
     calling applyRibbonPrefs itself, so the ordinary path is one call;
     the second is the belt-and-braces for the default layout, which
     moves nothing (2026-08-25). */
  applyRibbonLayout(rbnCurrentId(),true);
  applyRibbonPrefs();
  /* both IIFEs + their route hooks are now wired — restore the URL's view */
  if(window.SemApp&&window.SemApp.applyInitialRoute)
    window.SemApp.applyInitialRoute();
})();
