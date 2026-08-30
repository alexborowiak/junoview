/* 25-selecting.js — what belongs to what, locks, snapping, the marquee and the canvas menu.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- WHICH CONTROL BELONGS TO WHICH KIND OF ITEM ------------------
     One table, checked for completeness at the bottom of showFmt.

     The alternative — a hand-written show() line per control — is exactly
     how "Ends" and "Route" (both arrow properties) came to be offered on a
     triangle: four new dropdowns were added to the markup and none of them
     got a line, so they showed for everything selected, forever, and
     nothing complained (2026-08-07, user). A control that is not in this
     table and not handled explicitly now throws in the console instead of
     quietly appearing on every item.

     '*' means every kind; the value is a space-separated list otherwise. */
  var FMT_KINDS={
    '#fmt-stylewrap':'arrow rect draw', /* dashes apply to any stroke */
    /* a table's rules are a stroke like any other, so the same weight
       menu sets how heavy they are (2026-08-20) */
    '#fmt-swwrap':'arrow rect draw table',
    '#fmt-headwrap':'arrow',          /* arrowheads: a shape has no ends */
    '#fmt-bendwrap':'arrow',          /* straight/curved/elbow: ditto */
    '#fmt-fillwrap':'rect',           /* fill + gradients: shapes only */
    '#fmt-shapewrap':'rect',
    '#fmt-cropwrap':'image cell',
    '#fmt-figures':'flip'
  };
  /* controls whose visibility depends on more than the kind (how many are
     selected, what a placed cell contains, whether the page is a poster).
     Listed so the completeness check knows they are deliberate. */
  var FMT_MANUAL=('#fmt-lhwrap #fmt-lh '
    /* the two children of the governed #fmt-stylewrap-tx wrapper: their
       visibility IS the wrapper's, listed so the completeness audit
       below stops flagging them on every first selection (2026-08-24) */
    +'#fmt-eqedit #fmt-mdedit '
    +'#fmt-stylewrap-tx #fmt-style-tx #fmt-style-menu-tx '
    +'#fmt-tbl-rowplus #fmt-tbl-rowminus #fmt-tbl-colplus '
    +'#fmt-tbl-colminus #fmt-tbl-head #fmt-tbl-grid '
    +'#fmt-forward #fmt-backward '
    +'#fmt-bullets #fmt-numbers #fmt-indent #fmt-outdent '
    +'#fmt-dup #fmt-group #fmt-ungroup #fmt-front #fmt-back '
    +'#fmt-rotl #fmt-rotr #fmt-arline #fmt-argrid #fmt-samewrap '
    +'#fmt-alignwrap #fmt-opwrap #fmt-txcol-btn '
    /* the wrappers around the two colour dropdowns. They got ids so a
       ribbon layout could move a button and its swatch menu as ONE
       thing; that made them controls, and a control on this bar has to
       be governed or it shows for everything, forever (2026-08-25). */
    +'#fmt-txcolwrap #fmt-fillcolwrap '
    +'#fmt-fillcol-btn #fmt-txlab #fmt-bglab #fmt-szwrap #fmt-smaller '
    +'#fmt-bigger #fmt-bold #fmt-ital #fmt-under #fmt-strike #fmt-font '
    +'#fmt-parawrap '
    +'#fmt-replace #fmt-locate #fmt-revert #fmt-lockver #fmt-parts '
    +'#fmt-caption #fmt-prov #fmt-lockar #fmt-sizepos '
    +'#fmt-crop #fmt-same #fmt-style #fmt-sw #fmt-head #fmt-bend '
    +'#fmt-fillstyle #fmt-shape '
    +'#fmt-align-btn #fmt-para #fmt-size #fmt-op '
    +'#fmt-opval #fmt-imgrefresh').split(' ');

  /* EVERY CONTEXTUAL CONTROL, in one list: the two tables that already
     govern them. */
  function fmtAllIds(){
    return Object.keys(FMT_KINDS).concat(FMT_MANUAL);
  }
  /* Inspectors are about the CURRENT primary selection, not the object
     that happened to be selected when their door was opened. Keep this
     beside showFmt because every canvas selection path already converges
     here, including deselection and title/subtitle pseudo-items. */
  var inspectorSig='';
  function syncInspectorPanes(force){
    /* the numbers pane is an inspector too, and a cheap one -- four
       value writes, and an immediate return when it is closed. It sits
       ABOVE the signature gate on purpose: the gate exists to stop
       24-snapshot history walks during a slider preview, and this does
       no walking (T65). */
    if(typeof sizePaneSync==='function') sizePaneSync();
    var hp=$('#objhist');
    var pp=$('#provpane');
    var histOpen=!!hp&&!hp.hidden,provOpen=!!pp&&!pp.hidden;
    if(!histOpen&&!provOpen){inspectorSig='';return;}
    var s=pres.slides[cur];
    /* Both panes describe the primary item, just like the ribbon. Group
       expansion belongs to bulk verbs, not to an inspector's subject. */
    var a=s&&typeof selAnnot==='number'&&(s.annots||[])[selAnnot];
    if(histOpen&&a) ensureOids(s);
    var sig=(histOpen?'h':'')+(provOpen?'p':'')+'|'+cur+'|'
      +(a?(histOpen?a.oid:(a.ref||a.k)):'none');
    /* showFmt also runs during continuous previews. Walking 24 whole-deck
       history snapshots for every slider input would make an open pane
       turn a smooth gesture into a crawl; markDirty owns edit refreshes. */
    if(!force&&sig===inspectorSig) return;
    inspectorSig=sig;
    if(histOpen){
      ohOid=a?a.oid:null;
      renderObjHist();
    }
    if(provOpen) renderProvPane();
  }
  function showFmt(){
    var bar=$('#et-fmt'); if(!bar) return;
    var et=$('#edit-tools');
    var s=pres.slides[cur];
    var a=(s&&selAnnot!==null)?annotByIdx(s,selAnnot):null;
    syncInspectorPanes();
    if(window.SemDeckFindSync) window.SemDeckFindSync();
    if(!a){
      bar.hidden=true;
      /* ...AND EVERY CONTEXTUAL CONTROL, one at a time. Hiding the bar
         used to be enough because every one of them lived inside it. A
         ribbon layout may put any of them in a group of its own, and a
         control that relied on an ancestor for its hiding would then sit
         there visible with nothing selected — and keep its whole group
         on screen with it, which is how a tab that should have been
         empty stayed in the strip (2026-08-25, found in a browser).
         Hiding them individually makes the rule a fact about the
         CONTROL rather than about where it happens to sit. */
      fmtAllIds().forEach(function(id){
        var el=$(id); if(el) el.hidden=true;});
      if(et) et.classList.remove('fmt-open');
      /* the pane outlives the selection — it is the SLIDE's build order —
         so it has to be told the selection went away, or its effect
         chooser keeps offering the last item's effect to nothing */
      animPaneSync();animRibbonSync();
      syncRibbonGroups();
      return;
    }
    /* THE TAB FOLLOWS THE SELECTION. Default gives selection-driven
       controls an Object tab; other ribbon layouts name their own target.
       Clicking a figure while you happened to be elsewhere still has to
       reveal its tools instead of leaving them on a tab you cannot see
       — which is how "the ability to lock cells" appeared to vanish when
       it had simply moved one tab away (2026-08-20, user).
       Not while a drawing tool is armed: placing five shapes in a row
       must not yank you off Insert after each one. */
    /* ...and WHICH tab that is belongs to the layout: `home` is the
       markup's answer, and a layout that calls its format tab "Object"
       would otherwise send you to a tab that does not exist
       (2026-08-25, ribbon layouts). */
    var selT=(typeof ribbonSelTab==='function')?ribbonSelTab():'home';
    /* DECIDED HERE, DONE AT THE END. The switch used to happen on this
       line, before a single control had been revealed — and once a
       layout may give the format groups a tab of their own, that tab is
       still EMPTY at this point, so the empty-tab fallback in
       syncRibbonGroups bounced straight back off it and the selection
       appeared to do nothing (2026-08-25, found in a browser). Deciding
       now and switching after the controls exist keeps both rules. */
    var wantTab=(activeTab()!==selT&&tool==='select'&&!justDrew)?selT:'';
    justDrew=false;
    var kind=(selAnnot==='t'||selAnnot==='s')?'text':a.k;
    /* a table is not a text box, but its WORDS take the same size, font
       and alignment controls a text box does (2026-08-20) */
    var isTbl=(kind==='table');
    bar.hidden=false;
    /* the contextual groups REPLACE the Insert group instead of adding
       a third toolbar row — the canvas must not shrink when you select
       something (2026-08-05, user: "you can't really see the poster
       you are working on") */
    if(et) et.classList.add('fmt-open');
    function show(id,on,pressed){
      var el=$(id); if(!el) return;
      el.hidden=!on;
      if(on&&pressed!==undefined)
        el.setAttribute('aria-pressed',pressed.toString());
    }
    /* cellText = a resizable text-ish cell (A-/A+ content zoom applies to any
       non-figure cell). noteCell = a MARKDOWN note specifically — only its
       rendered .note carries a colour, so ONLY it gets the colour swatches. */
    var cellText=false,noteCell=false;
    if(kind==='cell'&&a.ref){
      var ci=resolveRef(a.ref);
      cellText=!!ci&&ci.kind!=='figure'&&ci.kind!=='diagnostic';
      noteCell=!!ci&&ci.kind==='note';
    }
    var isText=(kind==='text');
    var isNum=(typeof selAnnot==='number');
    /* the colour swatches drive a.color for text / arrows / shapes, and a.txcol
       for a markdown note — but NOT images or figure/code cells */
    var colourable=isText||kind==='arrow'||kind==='rect'||noteCell;
    $$('.sw:not(.swbg)',bar).forEach(function(sw){
      sw.hidden=!colourable;
      var cur_=(kind==='cell')?(a.txcol||''):(a.color||defaultColor(kind));
      sw.setAttribute('aria-pressed',(cur_===sw.dataset.c).toString());
    });
    show('#fmt-smaller',isText||cellText||isTbl);
    show('#fmt-bigger',isText||cellText||isTbl);
    var fontSel=$('#fmt-font');
    if(fontSel){
      fontSel.hidden=!isText;
      if(isText){
        var fv=a.font||'sans';
        /* a typed family is not one of the listed options — show it as
           its own entry rather than silently reading back as "Sans" */
        if(!FONTMAP[fv]){
          var ex=fontSel.querySelector('option[data-typed]');
          if(ex) ex.remove();
          fontSel.insertAdjacentHTML('afterbegin',
            '<option data-typed="1" value="'+esc(fv)+'">'+esc(fv)
            +'</option>');
        }
        fontSel.value=fv;
      }
    }
    show('#fmt-bold',isText,!!a.b);
    show('#fmt-ital',isText,!!a.i);
    show('#fmt-under',isText,!!a.u);
    show('#fmt-strike',isText,!!a.strike);
    show('#fmt-szwrap',isText||isTbl);
    /* named styles are for TEXT BOXES: a title/subtitle pseudo-item is
       already the deck's title style by definition */
    show('#fmt-stylewrap-tx',isText&&isNum);
    /* spacing applies to any run of words, including a table's */
    show('#fmt-lhwrap',(isText||isTbl)&&isNum);
    show('#fmt-eqedit',isMaths(a)&&isNum);
    /* a markdown box's face is the RENDERING, so the way in is the
       editor rather than the caret (T74) */
    show('#fmt-mdedit',!!(a&&a.k==='text'&&a.md)&&isNum);
    var szIn=$('#fmt-size');
    if(szIn&&(isText||isTbl)&&document.activeElement!==szIn)
      szIn.value=Math.round((a.size||(isTbl?2.2:2.6))*5.4);
    /* alignment, list and curve are reached through the Layout menu, and
       that menu now applies all three itself — the originals are gone
       (2026-08-17 audit) */
    show('#fmt-parawrap',isText&&isNum,!!a.arc);
    /* bullets / numbering / indent. The two list buttons show WHICH list
       is on, which the old menu line could not; indent and outdent only
       appear once there is a list to move a bullet inside. */
    var lst=isText?listOf(a):0;
    show('#fmt-bullets',isText&&isNum,lst==='bullet');
    show('#fmt-numbers',isText&&isNum,lst==='number');
    show('#fmt-indent',isText&&isNum&&!!lst);
    show('#fmt-outdent',isText&&isNum&&!!lst);
    /* the kind-driven controls, all from one table */
    Object.keys(FMT_KINDS).forEach(function(id){
      var spec=FMT_KINDS[id];
      show(id,isNum&&(spec==='*'||spec.split(' ').indexOf(kind)>=0));
    });
    /* the wrapper around each colour dropdown shows exactly when its
       button does. Read from the button rather than restated, so the
       rule for when Colour appears stays in one place (2026-08-25). */
    ['txcol','fillcol'].forEach(function(k){
      var cb=$('#fmt-'+k+'-btn'),cw=$('#fmt-'+k+'wrap');
      if(cb&&cw) cw.hidden=cb.hidden;
    });
    /* what this weight will actually PRINT. It goes in the tooltip, never
       the label: a label whose width changed with the selected item would
       make the ribbon's required width depend on what you clicked, and
       the fit ladder has no rung left to absorb that. */
    var lnBtn=$('#fmt-sw');
    if(lnBtn&&isNum&&!lnBtn.hidden){
      var mmw=swMm(a);
      lnBtn.title='Line thickness — '+(mmw<1?mmw.toFixed(2):mmw.toFixed(1))
        +'mm on this page ('+swPt(a).toFixed(2).replace(/\.?0+$/,'')+'pt)';
    }
    /* every drawn menu shows which option the selection is ON */
    if(isNum) syncLineMenus(a);
    animPaneSync();animRibbonSync();
    show('#fmt-opwrap',true);
    var opR=$('#fmt-op'),opV=$('#fmt-opval');
    var opPct=Math.round((a.op==null?1:a.op)*100);
    if(opR) opR.value=opPct;
    if(opV) opV.textContent=opPct+'%';
    show('#fmt-dup',isNum);
    var nSel=selSet.filter(function(i){return typeof i==='number';}).length;
    show('#fmt-group',nSel>=2);
    show('#fmt-ungroup',isNum&&a.grp!=null);
    /* Bring to front and Send to back are BUTTONS again. They were
       menu-only, which is why they read as missing (2026-08-20, user
       asked for "the bring to forewards send to back" - both pairs were
       in the code, three clicks deep inside Arrange). The one-STEP pair
       stays in the menu: it is the rarer of the two and the row has to
       stay honest about its width. */
    show('#fmt-front',isNum);
    show('#fmt-back',isNum);
    show('#fmt-forward',false);
    show('#fmt-backward',false);
    show('#fmt-arline',false);
    show('#fmt-argrid',false);
    show('#fmt-rotl',false);
    show('#fmt-rotr',false);
    /* count what can actually be RESIZED, not what is selected. selRects
       drops arrows (no box), locked and hidden items, so two selected
       arrows offered "Same size" and then did nothing at all when you
       picked from it (2026-08-07 audit). */
    /* selRects(TRUE), the same size-only reading sameSize itself uses.
       Gated on the plain selRects it counted `pinned` items out, so
       selecting two POSITION-LOCKED boxes hid the control -- and the
       four modes behind it were unreachable in exactly the case the
       verb had just been fixed to handle. A gate stricter than its own
       verb is a feature you cannot get at (2026-08-30). */
    show('#fmt-samewrap',selRects(true).length>=2);
    /* the menu now covers single-item actions (order, rotate) too */
    show('#fmt-alignwrap',isNum);
    var plainText=isText&&typeof selAnnot==='number';
    /* A SHAPE gets the fill swatches too. It did not, so a triangle's
       body could not be given a colour by any control in the app: the
       outline worked (Colour → a.color → stroke) but the fill popup was
       gated to text, its handler had no shape branch, and "Solid colour…"
       just copied the outline. A green triangle with a red outline was
       not constructible (2026-08-07, user: "yet I can't change the
       fucking colour"). */
    var showBg=plainText||noteCell||kind==='rect';
    show('#fmt-txlab',(isText&&kind!=='cell')||noteCell);
    show('#fmt-bglab',showBg);
    /* the popup buttons mirror what their menus can act on, and the label
       names the PART it recolours: "Colour" next to "Fill" left people
       guessing which one was the outline (2026-08-19, user: "'colour' vs
       'fill colour' is confusing — is that border?") */
    show('#fmt-txcol-btn',kind!=='image');
    var tcb=$('#fmt-txcol-btn');
    /* innerHTML, not textContent: this button is RENAMED for whatever is
       selected, and textContent would delete the icon with the old word
       every time -- which is why it was the one ribbon button that could
       never keep one (2026-08-25). */
    if(tcb) tcb.innerHTML=bic('palette')+' '
      +((isText||kind==='cell')?'Text ▾'
      :kind==='rect'?'Border ▾'
      :(kind==='arrow'||kind==='draw')?'Line ▾':'Colour ▾');
    /* a SHAPE has one Fill control and it is the panel in Line & shape;
       this button stays for text boxes and cell frames, which have a
       background colour but no fill STYLE (2026-08-20, user: "confusing
       there is a fill and fill colour") */
    show('#fmt-fillcol-btn',showBg&&kind!=='rect');
    /* a shape now has two Fill buttons — this one picks the COLOUR, the
       one in Line & shape picks none/solid/gradient. Say which is which. */
    var fcb=$('#fmt-fillcol-btn');
    if(fcb) fcb.innerHTML=bic('fill')+' '
      +((kind==='rect')?'Fill colour ▾':'Fill ▾');
    $$('.swbg',bar).forEach(function(sw){
      sw.hidden=!showBg;
      /* read back from the field the item's renderer actually uses, or
         the wrong swatch lights up */
      var cur_;
      if(kind==='cell') cur_=(a.bgcol||'');
      else if(kind==='rect')
        cur_=a.grad?'':(!a.fill?'none':(a.fillc||''));
      else cur_=((a.bg===0)?'none':(a.bgc||'#0e1926'));
      sw.setAttribute('aria-pressed',(cur_===sw.dataset.c).toString());
    });
    /* the Table group, the only place row and column counts live */
    ['#fmt-tbl-rowplus','#fmt-tbl-rowminus','#fmt-tbl-colplus',
     '#fmt-tbl-colminus'].forEach(function(id){show(id,isTbl);});
    show('#fmt-tbl-head',isTbl,isTbl&&!!a.thead);
    show('#fmt-tbl-grid',isTbl,isTbl&&a.grid!==0);
    show('#fmt-replace',kind==='cell');
    show('#fmt-locate',kind==='cell'&&!!a.ref);
    /* for anything that came OUT of a notebook, which since T58 means a
       flip book as well as a placed cell */
    show('#fmt-prov',isNum&&!!provRef(a));
    /* SIZE, SHAPE AND POSITION -- for anything that is a box. An arrow
       is two endpoints and has neither (T65). */
    var hasBox=isNum&&kind!=='arrow';
    show('#fmt-sizepos',hasBox);
    show('#fmt-lockar',hasBox,hasBox&&!!a.lockar);
    var lab=$('#fmt-lockar');
    if(lab&&hasBox) lab.innerHTML=(a.lockar?bic('unlock'):bic('lock'))
      +' Keep shape';
    /* ONE BUTTON, TWO STATES — the pattern #fmt-revert above already
       uses. A figure without a caption gets "Caption"; one with a
       caption gets "Untie caption", which until now had no door but a
       right-click row (2026-08-26 audit, T58). */
    var figSel=isNum&&isFigure(a);
    show('#fmt-caption',figSel);
    if(figSel){
      var cb=$('#fmt-caption'),hasCap=capHasOne(a);
      if(cb){
        cb.innerHTML=hasCap?(bic('unlink')+' Untie caption')
          :(bic('caption')+' Caption');
        cb.title=hasCap
          ?'Let them be two ordinary objects again. The words stay '
            +'exactly where they are; they simply stop following the '
            +'figure.'
          :'Put a caption under this figure — at its width, already '
            +'tied to it and already numbered, so it follows the '
            +'figure and renumbers itself when slides move.';
      }
    }
    var lockedV=(kind==='cell')&&!!(a.lockver&&a.lockver.commit);
    var frozen=(kind==='cell')&&frozenFrames.has(a);
    var hasPrev=(kind==='cell')&&!!a.ref
      &&!!frameSnapsPrev[normRef(a.ref)];
    show('#fmt-revert',(frozen||hasPrev)&&!lockedV);
    if((frozen||hasPrev)&&!lockedV){
      var rvb=$('#fmt-revert');
      if(rvb) rvb.innerHTML=frozen
        ?(bic('reload')+' Live figure')
        :(bic('reset')+' Previous figure');
    }
    /* Locking pins a figure to its notebook's git commit, which needs the
       local server to talk to git - so it only WORKS in the app build.
       It used to disappear entirely everywhere else, which reads as a
       feature that was removed rather than one that is unavailable here
       (2026-08-20, user: "what happened to locking all the images to a
       git commit"). It is shown and disabled instead, and the tooltip
       says what would make it work. */
    var isCellRef=(kind==='cell')&&!!a.ref;
    var canLock=isCellRef&&APP.mode==='app';
    show('#fmt-lockver',isCellRef);
    var lvb=$('#fmt-lockver');
    if(lvb&&isCellRef){
      lvb.disabled=!canLock;
      lvb.innerHTML=lockedV
        ?(bic('unlock')+' Unlock figure')
        :(bic('lock')+' Lock figure');
      lvb.title=canLock
        ?('Pin this figure to its notebook\u2019s current git commit '
          +'\u2014 refreshes stop changing it, and it renders even with '
          +'the notebook closed')
        :('Locking pins a figure to a git commit, which needs the '
          +'Junoview app (it reads git through the local server). This '
          +'page was exported as a standalone file, so there is no '
          +'repository to pin to.');
    }
    /* #fmt-cropwrap: visibility from FMT_KINDS.
       Animation is a BUILD — an item appearing on click as you step
       through a deck. A poster is one printed page: there is no click and
       nothing to step through, so it is not offered (2026-08-07, user:
       "why is there animate options in a poster"). */
    /* the code/figure/output part-picker (+ split) — moved off the frame
       into the ribbon's Object group */
    /* only for a picture that actually knows where it came from —
       otherwise it is a button that can only ever fail */
    var ir=$('#fmt-imgrefresh');
    if(ir){
      var anyLinked=false;
      selIdxs().forEach(function(i){
        var xa=(s&&s.annots||[])[i];
        if(xa&&xa.k==='image'&&xa.fkey) anyLinked=true;});
      ir.hidden=!anyLinked;
    }
    var partsSlot=$('#fmt-parts');
    if(partsSlot){
      partsSlot.innerHTML='';
      var pcr=(kind==='cell'&&typeof selAnnot==='number')
        ?buildPartChooser(s,selAnnot):null;
      if(pcr) partsSlot.appendChild(pcr);
      partsSlot.hidden=!pcr;
    }
    /* the frames pane FOLLOWS the selection: select a flip book and it
       shows that one's figures; select a caption instead and its "tie to"
       row wakes up for whatever is selected. Only when the pane is
       actually open — this runs on every click on the canvas. */
    if(typeof renderFlipPane==='function'){
      var fpEl=$('#flippane');
      if(fpEl&&!fpEl.hidden){
        selIdxs().forEach(function(i){
          var xf=(s&&s.annots||[])[i];
          if(xf&&xf.k==='flip') flipSel=i;});
        renderFlipPane();
      }
    }
    /* COMPLETENESS. Every #fmt-* control in the contextual bar must be
       governed by FMT_KINDS or listed in FMT_MANUAL. Without this, a
       control added to the markup and forgotten here shows for every kind
       of item, silently and forever — precisely what happened with Ends
       and Route on a shape. Console-only: it is a wiring mistake for
       whoever adds the control, not a user-facing failure. */
    if(!showFmt._checked){
      showFmt._checked=true;
      var governed={};
      Object.keys(FMT_KINDS).forEach(function(k){governed[k]=1;});
      FMT_MANUAL.forEach(function(k){governed[k]=1;});
      var stray=[];
      $$('[id^="fmt-"]',bar).forEach(function(el){
        if(/-menu$/.test(el.id)) return;          /* menu bodies */
        if(!governed['#'+el.id]) stray.push('#'+el.id);
      });
      if(stray.length&&window.console&&console.warn)
        console.warn('deck: ribbon controls governed by nothing in '
          +'showFmt, so they will show for every selection: '
          +stray.join(', '));
    }
    /* ...and NOW the tab, with the controls that justify it in place.
       setTab re-runs syncRibbonGroups itself, so this is one call or the
       other, never both. */
    if(wantTab) setTab(wantTab); else syncRibbonGroups();
  }
  /* hide a ribbon group whose controls are all hidden, and drop the divider
     before the first visible group — so the format ribbon stays tidy */
  function syncRibbonGroups(){
    /* the WHOLE ribbon, not just the contextual half: a static group can
       empty out too (Notebooks has nothing to offer a poster with no
       placed cells yet) and an empty group that still drew its label and
       divider read as a missing feature */
    var bar=$('#edit-tools'); if(!bar) return;
    /* WHAT IS VISIBLE FIRST, and the tab filter after it. A group's
       emptiness is a fact about its controls, not about which tab is
       showing, so this pass does not care — and the answer is what the
       tab decisions below need. `data-off` still goes on before anything
       MEASURES the row, which is what the old ordering was protecting
       (2026-08-25, ribbon layouts). */
    $$('.rbn-grp',bar).forEach(function(g){
      var vis=false,kids=g.querySelectorAll('button,input,select,.sh-drop');
      for(var i=0;i<kids.length;i++){
        var n=kids[i],blocked=false;
        while(n&&n!==g){if(n.hidden){blocked=true;break;}n=n.parentNode;}
        if(!blocked){vis=true;break;}
      }
      g.hidden=!vis;
    });
    /* A CONTEXTUAL TAB, and what happens when its reason goes away. A
       ribbon layout may put every object control on a tab of its own —
       PowerPoint's "Picture Format" is the same idea — and such a tab is
       empty until something is selected. An empty tab you can still
       click reads as broken, so the strip drops it; and being left
       STANDING on one when you deselect would show you a blank row, so
       the ribbon falls back to the first tab that has anything, which is
       what every application with contextual tabs does. */
    if(!tabHasContent(activeTab())){
      var to='';
      TABS.forEach(function(t){if(!to&&tabHasContent(t)) to=t;});
      if(to&&to!==activeTab()){curTab=to;lsSet(tabKey(),to);}
    }
    applyTab();
    /* `rbn-first` used to be stamped on the leading visible group so a
       ::before divider could be suppressed on it. The dividers became a
       border-right on the group itself and `:last-child` handles the end
       of the row, so nothing has styled that class since — it was three
       lines of bookkeeping maintained for no reader (2026-08-17 audit). */
    sizeRibbonGroups();
    /* groups appearing or leaving changes the width the row needs, so the
       density has to be re-judged every time the selection does -- and so
       does the STRIP's ceiling, because the contextual groups raise the
       ribbon's floor by ~90px and a strip still sitting at its old width
       is exactly how clicking an object ate the row (T80) */
    fitFilmMax();
    fitEditRibbon();
  }
  /* How many columns each group needs to fill two rows ACROSS: half its
     visible controls, rounded up.
     This is a COUNT OF WHAT IS SHOWING RIGHT NOW, so it goes stale the
     moment anything reveals a control without re-running it — and something
     did. applyPage() un-hides #vw-versions ("Slides" / "Versions") after
     the count, so View was sized for the two controls it had at count time,
     the third landed in an implicit third grid row, and the row overran its
     own VIEW label and printed on top of it (2026-08-16). Owning the count
     in one function that fitEditRibbon also calls makes it self-healing:
     any path that re-fits the ribbon re-counts it first. */
  function sizeRibbonGroups(){
    var bar=$('#edit-tools'); if(!bar) return;
    $$('.rbn-grp',bar).forEach(function(g){
      var row=g.querySelector('.rbn-row'); if(!row) return;
      var n=0;
      [].slice.call(row.children).forEach(function(c){
        if(c.hidden) return;
        /* a wrapper counts as the one cell it contributes */
        if(c.classList.contains('sh-drop')||c.classList.contains('dc-menuwrap')){
          var b=c.querySelector('.dbtn');
          if(b&&!b.hidden) n++;
          return;
        }
        /* a control that spans BOTH rows is worth two cells, or a group
           made of nothing but stacks asks for half the columns it needs
           and pushes the overflow into an implicit third row */
        n+=(c.classList.contains('rbn-stack')
            ||c.classList.contains('rbn-big')
            ||c.classList.contains('rbn-tall'))?2:1;
      });
      row.style.setProperty('--rbn-cols',Math.max(1,Math.ceil(n/2)));
    });
  }
  function fmtApply(fn,quiet){
    var s=pres.slides[cur]; if(!s) return;
    /* apply to EVERY selected item (a group or shift-multi-select), not just
       the primary — otherwise formatting a multi-selection silently changes
       only one item and collapses the selection */
    var targets=selSet.filter(function(i){return typeof i==='number';});
    if(targets.length){
      targets.forEach(function(i){if(s.annots[i]) fn(s.annots[i]);});
    } else {
      var a=annotByIdx(s,selAnnot); if(!a) return;
      fn(a);
    }
    /* quiet = live preview inside a continuous gesture (a Trim stepper
       being held, a value being typed): redraw but push NO history —
       the gesture's end commits ONE undo entry instead of one per
       keystroke evicting real edits from the 50-slot stack
       (2026-08-05 review) */
    if(!quiet) markDirty();
    var l=stage.querySelector('.annot-layer');
    if(!l) return;
    renderAnnots(l,s);
    if(targets.length>1){        /* keep the multi-selection alive */
      selSet=targets.slice();paintSel(l);
      showFmt();
    } else selectAnnot(l,selAnnot);
  }
  function pctPoint(layer,ev){
    var r=layer.getBoundingClientRect();
    return {x:Math.max(0,Math.min(100,(ev.clientX-r.left)/r.width*100)),
            y:Math.max(0,Math.min(100,(ev.clientY-r.top)/r.height*100))};
  }
  /* ---- LOCKS -----------------------------------------------------------
     TWO locks, because there are two different things people mean by the
     word (TASKS T3):

       'all'  fully locked. The item cannot be clicked, dragged, resized,
              typed into or nudged on the canvas at all -- the Objects
              pane, and an Alt-marquee, are its remaining doors. This is
              the lock that already existed, and every saved deck carries
              it as `lock:1`.
       'pos'  position locked. Pinned where it is, and otherwise entirely
              yours: select it, resize it, restyle it, type in it. This
              is what a figure frame usually wants -- the plot must not
              wander, and you still need to make it bigger.

     `lockMode` is the ONLY reader of the raw flag; everything else asks
     one of the two questions below, so a third mode would be a change in
     one place. `pinned` is the movement question and `lockedAll` the
     reachability one -- getting those two the wrong way round is exactly
     the bug this section exists to make hard. */
  function lockMode(a){
    if(!a||!a.lock) return '';
    return a.lock==='pos'?'pos':'all';
  }
  function lockedAll(a){return lockMode(a)==='all';}
  function pinned(a){return !!lockMode(a);}
  var LOCK_LABEL={'':'Not locked','pos':'Position locked',
    all:'Fully locked'};
  /* ---- snap-to-align: while dragging or resizing, edges and centers
     snap to the canvas (edges + middle) and to every other object's
     edges + centers, with dashed guide lines. Hold Alt to disable --
     EXCEPT in an Alt-drag clone, where Alt already means "copy" and you
     have to keep holding it (see startMove's `cloning`). ---- */
  /* 6px was too tight to feel: on a poster zoomed to fit, a 6px window is
     a couple of real millimetres and the snap kept slipping past you */
  var SNAP_PX=9;
  function annotRectPct(layer,s,i){
    var a=(s.annots||[])[i]; if(!a) return null;
    if(a.k==='arrow')
      return {l:Math.min(a.x1,a.x2),r:Math.max(a.x1,a.x2),
              t:Math.min(a.y1,a.y2),b:Math.max(a.y1,a.y2)};
    /* NO LAYER is a legitimate caller: the .pptx export walks every slide,
       and only the one on screen has a rendered layer to measure. Without
       one we fall through to the stored box, which is the same fallback
       an attached endpoint already uses when its target goes away. */
    var el=layer?layer.querySelector('.an-item[data-idx="'+i+'"]'):null;
    /* auto-sized items (text) AND aspect-fitted figure frames answer with
       their RENDERED rect — snapping must align to the visible plot, not
       a letterboxed stored box */
    if(el&&(a.w==null||a.h==null
            ||el.classList.contains('an-figonly'))){
      var lr=layer.getBoundingClientRect();
      if(lr.width&&lr.height){
        var er=el.getBoundingClientRect();
        return {l:(er.left-lr.left)/lr.width*100,
                r:(er.right-lr.left)/lr.width*100,
                t:(er.top-lr.top)/lr.height*100,
                b:(er.bottom-lr.top)/lr.height*100};
      }
    }
    if(a.w==null||a.h==null) return null;
    var ap=anchorPos(a,a.w,a.h);
    return {l:ap.x,r:ap.x+a.w,t:ap.y,b:ap.y+a.h};
  }
  function snapTargets(layer,s,skip){
    var xs=[0,50,100],ys=[0,50,100];
    (s.annots||[]).forEach(function(a,i){
      if(skip.indexOf(i)>=0||a.hide) return;
      var r=annotRectPct(layer,s,i);
      if(!r) return;
      xs.push(r.l,(r.l+r.r)/2,r.r);
      ys.push(r.t,(r.t+r.b)/2,r.b);
    });
    /* the margin box and grid columns are snap lines too — a visible
       guide you cannot snap to would be worse than none */
    var g=guideTargets();
    xs=xs.concat(g.xs);ys=ys.concat(g.ys);
    /* guides you dragged off the rulers yourself — and only while
       they are shown: an invisible line that still pulls items onto
       itself is worse than either state (2026-08-29) */
    var cg=guidesShown()?customGuides():{x:[],y:[],b:[]};
    xs=xs.concat(cg.x);ys=ys.concat(cg.y);
    /* a guide box contributes its edges AND its middles: lining things up
       with one is the entire reason for drawing it */
    cg.b.forEach(function(v){
      xs.push(v[0],v[0]+v[2]/2,v[0]+v[2]);
      ys.push(v[1],v[1]+v[3]/2,v[1]+v[3]);
    });
    return {xs:xs,ys:ys};
  }
  /* ---- equal-gap detection -------------------------------------------
     Alignment gets you edges that agree; what still reads as sloppy is
     uneven whitespace. While dragging, look for a position where the gap
     to a neighbour matches a gap that already exists between two other
     items on the same band, and mark both. */
  function gapCands(layer,s,skip,bb,horiz){
    var boxes=[];
    (s.annots||[]).forEach(function(a,i){
      if(skip.indexOf(i)>=0||!a||a.hide||a.k==='arrow') return;
      var r=annotRectPct(layer,s,i); if(!r) return;
      /* only items on the same band count: a figure three columns over
         is not "next to" anything */
      var overlap=horiz?(r.b>bb.t&&r.t<bb.b):(r.r>bb.l&&r.l<bb.r);
      if(overlap) boxes.push(r);
    });
    boxes.sort(function(p,q){return horiz?(p.l-q.l):(p.t-q.t);});
    /* a gap is not just a NUMBER. It was measured between two particular
       neighbours, and to show you what a match matched — which is the
       whole point of the badge — the pair has to travel with the value
       (2026-08-25, T7). The old code kept only the number, which is why
       the comment above promised to "mark both" and only one was ever
       drawn. */
    var gaps=[];
    for(var i=1;i<boxes.length;i++){
      var p=boxes[i-1],q=boxes[i];
      var g=horiz?(q.l-p.r):(q.t-p.b);
      if(g>0.2) gaps.push({g:g,
        a:horiz?p.r:p.b, b:horiz?q.l:q.t,
        at:horiz?(Math.max(p.t,q.t)+Math.min(p.b,q.b))/2
                :(Math.max(p.l,q.l)+Math.min(p.r,q.r))/2});
    }
    return {boxes:boxes,gaps:gaps};
  }
  /* returns a delta that makes one of the dragged item's gaps equal to an
     existing gap, plus the pair of gaps to draw */
  function bestGap(layer,s,skip,bb,horiz,thr){
    var c=gapCands(layer,s,skip,bb,horiz);
    if(!c.gaps.length||!c.boxes.length) return null;
    var lo=horiz?bb.l:bb.t,hi=horiz?bb.r:bb.b;
    var best=null;
    c.boxes.forEach(function(r){
      var before=horiz?r.r:r.b,after=horiz?r.l:r.t;
      c.gaps.forEach(function(gp){
        var g=gp.g;
        /* place the dragged box a distance g AFTER this one... */
        var d1=(before+g)-lo;
        if(Math.abs(d1)<=thr&&(!best||Math.abs(d1)<Math.abs(best.d)))
          best={d:d1,gap:g,from:r,side:'after',src:gp};
        /* ...or a distance g BEFORE it */
        var d2=(after-g)-hi;
        if(Math.abs(d2)<=thr&&(!best||Math.abs(d2)<Math.abs(best.d)))
          best={d:d2,gap:g,from:r,side:'before',src:gp};
      });
    });
    return best;
  }
  /* PAGE PERCENT <-> MILLIMETRES, both directions, in one place. The
     model is percent because a deck has to survive a page-shape change;
     every number a human reads or types is millimetres, because that is
     what the rulers, the gap badges and the print shop speak (T7, T65).
     `horiz` picks which side of the page the percentage is OF -- x and w
     are percentages of the width, y and h of the height. */
  function pctMm(v,horiz){
    var pg=pageOf();
    return v/100*((horiz?pg.mm[0]:pg.mm[1])||0);
  }
  function mmPct(v,horiz){
    var pg=pageOf(),m=(horiz?pg.mm[0]:pg.mm[1])||0;
    return m?(v/m*100):0;
  }
  /* a distance across the page, in the millimetres the rulers speak.
     A percentage means nothing to anyone laying out an A0 poster, and
     the badge exists precisely so the number can be read (T7). */
  function gapMm(v,horiz){
    var mm=Math.abs(pctMm(v,horiz));
    return (mm<10?Math.round(mm*10)/10:Math.round(mm))+' mm';
  }
  function drawGapMarks(layer,marks){
    $$('.snapgap,.snapgap-lab',layer).forEach(function(n){n.remove();});
    marks.forEach(function(m){
      var lo=Math.min(m.a,m.b),hi=Math.max(m.a,m.b);
      var el=document.createElement('div');
      /* the gap you are MAKING is solid; the one it matched is drawn
         faint, because it is evidence rather than an instruction */
      el.className='snapgap'+(m.ref?' snapgap-ref':'');
      if(m.horiz){
        el.style.left=lo+'%';el.style.width=(hi-lo)+'%';
        el.style.top=(m.at-0.35)+'%';el.style.height='0.7%';
      } else {
        el.style.top=lo+'%';el.style.height=(hi-lo)+'%';
        el.style.left=(m.at-0.35)+'%';el.style.width='0.7%';
      }
      layer.appendChild(el);
      /* THE BADGE. A bar says "these two distances agree"; the number
         says what the distance IS, which is the question you were
         actually asking when you started dragging (T7). It reuses
         .dragtag, which was styled for exactly this kind of readout and
         then never wired to anything. */
      var lab=document.createElement('div');
      lab.className='dragtag snapgap-lab'+(m.ref?' snapgap-lab-ref':'');
      lab.textContent=gapMm(hi-lo,m.horiz);
      if(m.horiz){
        lab.style.left=((lo+hi)/2)+'%';
        lab.style.top=m.at+'%';
      } else {
        lab.style.left=m.at+'%';
        lab.style.top=((lo+hi)/2)+'%';
      }
      layer.appendChild(lab);
    });
  }
  function bestSnap(cands,vals,thr){
    var best=null;
    for(var i=0;i<vals.length;i++) for(var j=0;j<cands.length;j++){
      var d=cands[j]-vals[i];
      if(Math.abs(d)<=thr&&(!best||Math.abs(d)<Math.abs(best.d)))
        best={d:d,at:cands[j]};
    }
    return best;
  }
  function snapThr(layer){
    var r=layer.getBoundingClientRect();
    return {x:r.width?SNAP_PX/r.width*100:1,
            y:r.height?SNAP_PX/r.height*100:1};
  }
  /* a snap onto the PAGE's own edge or centre says something different
     from a snap onto another item, so the two are coloured apart */
  function isPageLine(v){
    return v===0||v===50||v===100;
  }
  function drawSnapGuides(layer,sx,sy){
    $$('.snapline',layer).forEach(function(n){n.remove();});
    if(sx!=null){
      var v=document.createElement('div');
      v.className='snapline snap-v'+(isPageLine(sx)?' snap-page':'');
      v.style.left=sx+'%';
      layer.appendChild(v);
    }
    if(sy!=null){
      var h=document.createElement('div');
      h.className='snapline snap-h'+(isPageLine(sy)?' snap-page':'');
      h.style.top=sy+'%';
      layer.appendChild(h);
    }
  }
  function clearSnapGuides(layer){
    /* .snapgap-lab is named here explicitly: the badge carries `dragtag`
       and `snapgap-lab`, neither of which is `.snapgap`, so it was only
       ever cleaned up incidentally — by the renderAnnots at the end of a
       drag, which is itself guarded by `if(movedAny)` (2026-08-25). */
    $$('.snapline,.snapgap,.snapgap-lab',layer)
      .forEach(function(n){n.remove();});
  }
  function startMove(layer,s,idx,ev0){
    ev0.preventDefault();
    /* ALT-DRAG CLONES. The copies are made in place and it is THEY that
       travel, so the originals are left exactly where they were and the
       rest of this function needs to know nothing about it.
       Alt also turns snapping off mid-drag (see `mm`) -- but not during
       a clone drag, where Alt was pressed to say "copy", not "ignore the
       guides", and where you have to keep holding it the whole way. */
    var cloning=false,cloneIdx=null,selWas=selIdxs().slice();
    if(ev0.altKey&&typeof idx==='number'){
      var pick=selIdxs();
      if(pick.indexOf(idx)<0) pick=[idx];
      pick=pick.filter(function(i){
        var m=(s.annots||[])[i];return m&&!lockedAll(m);});
      var clones=cloneAnnots(pick,0,0);
      if(clones.length){
        cloning=true;cloneIdx=clones.slice();
        /* quiet: the mouseup at the end of this gesture takes the one
           undo entry, and it should undo the clone and its move together
           -- they are one gesture */
        markDirty(true);
        renderAnnots(layer,s);
        var k=pick.indexOf(idx);
        idx=clones[k>=0?k:0];
        selectMany(layer,clones);
      }
    }
    var a=annotByIdx(s,idx); if(!a) return;
    var start=pctPoint(layer,ev0);
    /* drag the whole current selection (group / multi-select) together —
       pinned members stay put, under EITHER lock */
    var movers=selSet.filter(function(i){return typeof i==='number';});
    if(typeof idx==='number'&&movers.indexOf(idx)<0) movers=[idx];
    movers=movers.filter(function(i){
      var m=(s.annots||[])[i];return m&&!pinned(m);});
    var origs={};
    movers.forEach(function(i){
      origs[i]=deep((s.annots||[])[i]);});
    /* a snapshot of each mover's tied caption, for the same reason the
       movers themselves are snapshotted: the drag is computed from the
       ORIGINAL position every mousemove, never incrementally */
    var capOrig={};
    movers.forEach(function(i){
      var m=(s.annots||[])[i];
      if(!m||!m.cap) return;
      var ci=capOfFig(s,m);
      /* a POSITION LOCK is about position, and every direct mover
         already honours it — this was the one path that dragged a
         pinned item anyway (2026-08-26 audit, T58) */
      if(ci>=0&&movers.indexOf(ci)<0&&!pinned(s.annots[ci]))
        capOrig[i]={a:s.annots[ci],o:deep(s.annots[ci])};
    });
    var single=(typeof idx!=='number')?deep(a):null;
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,movers);
    /* snap by the union bounding box of everything being dragged
       (hidden members travel along but contribute no snap geometry) */
    var origBB=null;
    movers.forEach(function(i){
      var m=(s.annots||[])[i];
      if(!m||m.hide) return;
      var r=annotRectPct(layer,s,i); if(!r) return;
      origBB=origBB?{l:Math.min(origBB.l,r.l),r:Math.max(origBB.r,r.r),
        t:Math.min(origBB.t,r.t),b:Math.max(origBB.b,r.b)}:r;
    });
    var gapMarks=[];
    /* THE GESTURE PATH (2026-08-23 perf). A drag no longer rebuilds the
       whole annotation layer per mousemove: renderAnnots re-clones every
       placed card (multi-MB figure bodies) on each rebuild. Instead the
       EXISTING nodes' inline left/top move — children (text, captions,
       handles, the selection outline, a frame's aspect-fitted geometry)
       ride along for free — and only the arrows are redrawn, because an
       attached endpoint is DERIVED from where its target item sits. The
       one real renderAnnots runs on mouseup. */
    var movedEls={};
    movers.forEach(function(i){
      var m=(s.annots||[])[i];
      if(!m||m.k==='arrow') return;   /* arrows redraw as strokes below */
      var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
      if(el) movedEls[i]={el:el,l:parseFloat(el.style.left)||0,
                          t:parseFloat(el.style.top)||0};
    });
    var singleEl=null;
    if(single){
      var tEl=layer.querySelector('div.an-item[data-idx="'+idx+'"]');
      if(tEl) singleEl={el:tEl,l:parseFloat(tEl.style.left)||0,
                        t:parseFloat(tEl.style.top)||0};
    }
    var anyArrow=(s.annots||[]).some(function(m){
      return m&&m.k==='arrow';});
    var movedAny=false;
    function mm(ev){
      movedAny=true;
      var p=pctPoint(layer,ev);
      var dx=p.x-start.x,dy=p.y-start.y;
      var sx=null,sy=null;
      /* CLEARED EVERY MOVE, like sx/sy beside it. It used to be reset
         inside the branch that fills it, which is skipped entirely when
         Alt suppresses snapping — so pressing Alt part-way through a drag
         froze the last marks on the page and drawGapMarks below happily
         redrew them, at their stale coordinates, for the rest of the
         gesture. help.html promises Alt "ignores snapping"; it has to
         ignore the evidence of it too (2026-08-25). */
      gapMarks=[];
      if(cloning||!ev.altKey){
        if(single){       /* a title item positions by its CENTER */
          var bx0=bestSnap(targets.xs,[single.x+dx],thr.x);
          var by0=bestSnap(targets.ys,[single.y+dy],thr.y);
          if(bx0){dx+=bx0.d;sx=bx0.at;}
          if(by0){dy+=by0.d;sy=by0.at;}
        } else if(origBB){
          var bb={l:origBB.l+dx,r:origBB.r+dx,
                  t:origBB.t+dy,b:origBB.b+dy};
          var bx=bestSnap(targets.xs,[bb.l,(bb.l+bb.r)/2,bb.r],thr.x);
          var by=bestSnap(targets.ys,[bb.t,(bb.t+bb.b)/2,bb.b],thr.y);
          if(bx){dx+=bx.d;sx=bx.at;}
          if(by){dy+=by.d;sy=by.at;}
          /* an edge snap wins over an equal-gap snap on the same axis:
             agreeing with a line is a stronger intention than matching a
             distance */
          if(!bx){
            var gx=bestGap(layer,s,movers,bb,true,thr.x);
            if(gx){
              dx+=gx.d;
              var nb={l:bb.l+gx.d,r:bb.r+gx.d};
              var mid=(bb.t+bb.b)/2;
              gapMarks.push({horiz:true,at:mid,
                a:gx.side==='after'?gx.from.r:nb.r,
                b:gx.side==='after'?nb.l:gx.from.l});
              /* ...and the gap it MATCHED. Two bars carrying the same
                 number is the whole message; one bar on its own only
                 ever said "something snapped" (T7) */
              if(gx.src) gapMarks.push({horiz:true,at:gx.src.at,
                a:gx.src.a,b:gx.src.b,ref:1});
            }
          }
          if(!by){
            var gy=bestGap(layer,s,movers,bb,false,thr.y);
            if(gy){
              dy+=gy.d;
              var nby={t:bb.t+gy.d,b:bb.b+gy.d};
              var midx=(bb.l+bb.r)/2;
              if(gy.src) gapMarks.push({horiz:false,at:gy.src.at,
                a:gy.src.a,b:gy.src.b,ref:1});
              gapMarks.push({horiz:false,at:midx,
                a:gy.side==='after'?gy.from.b:nby.b,
                b:gy.side==='after'?nby.t:gy.from.t});
            }
          }
        }
      }
      if(single){
        a.x=single.x+dx;a.y=single.y+dy;
        if(singleEl){
          singleEl.el.style.left=(singleEl.l+dx)+'%';
          singleEl.el.style.top=(singleEl.t+dy)+'%';
        }
      }
      else movers.forEach(function(i){
        var m=(s.annots||[])[i],o=origs[i];
        if(!m||!o) return;
        if(m.k==='arrow'){
          m.x1=o.x1+dx;m.y1=o.y1+dy;m.x2=o.x2+dx;m.y2=o.y2+dy;
        } else if(m.anch){
          var op=anchorPos(o,o.w,o.h);
          anchorSet(m,op.x+dx,op.y+dy,o.w,o.h);
        } else {m.x=o.x+dx;m.y=o.y+dy;}
        /* the drag writes absolute positions from a snapshot rather
           than going through shiftAnnot, so the caption hook has to be
           repeated here — and it moves by the same delta from ITS own
           snapshot, or a caption would creep on every mousemove */
        if(m.cap&&capOrig[i]){
          var cc=capOrig[i];
          if(cc.a.anch){
            var cp=anchorPos(cc.o,cc.o.w,cc.o.h);
            anchorSet(cc.a,cp.x+dx,cp.y+dy,cc.o.w,cc.o.h);
          } else {cc.a.x=cc.o.x+dx;cc.a.y=cc.o.y+dy;}
        }
        var me=movedEls[i];
        if(me){me.el.style.left=(me.l+dx)+'%';
               me.el.style.top=(me.t+dy)+'%';}
      });
      if(anyArrow) redrawArrows(layer,s);
      drawSnapGuides(layer,sx,sy);
      drawGapMarks(layer,gapMarks);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      /* AN ALT-CLICK THAT NEVER MOVED IS NOT A COPY. The clone is made on
         mousedown precisely so that it is the copy that travels — but
         when the gesture turns out to be a click, that left an
         exact-overlap duplicate sitting on top of its original, with
         nothing to see and no toast, where Ctrl+D offsets by CLONE_OFF
         so that a copy is never invisible (2026-08-26 audit, T57).
         Taken back off here, with the selection you had put back. The
         clone was made quietly, so nothing has to come off the undo
         stack either. */
      if(cloning&&!movedAny&&cloneIdx&&cloneIdx.length){
        var ann=s.annots||[];
        cloneIdx.slice().sort(function(p,q){return q-p;})
          .forEach(function(ci){ann.splice(ci,1);});
        renderAnnots(layer,s);
        if(selWas.length) selectMany(layer,selWas);
        else {selAnnot=null;selSet=[];paintSel(layer);showFmt();}
        markDirty(true);
        return;
      }
      /* the ONE rebuild per gesture (a moveless click keeps the old
         no-render path, so double-click-to-type is undisturbed) */
      if(movedAny){renderAnnots(layer,s);paintSel(layer);}
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startResize(layer,s,idx,ev0,corner){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a||typeof idx!=='number') return;
    /* A TIED CAPTION KEEPS THE FIGURE'S WIDTH. It is the one dimension a
       caption shares with its figure — a caption wider or narrower than
       the thing it describes is the single most common way a figure
       block stops looking deliberate — and it is the only one, because
       a caption's HEIGHT is its words (T17). */
    var capA=null,capO=null,figO=null;
    if(a.cap){
      var ci0=capOfFig(s,a);
      if(ci0>=0){capA=s.annots[ci0];capO=deep(capA);figO=deep(a);}
    }
    corner=corner||'se';
    var east=corner.indexOf('e')>=0,west=corner.indexOf('w')>=0;
    var south=corner.indexOf('s')>=0,north=corner.indexOf('n')>=0;
    var start=pctPoint(layer,ev0);
    var el=layer.querySelector('.an-item[data-idx="'+idx+'"]');
    var lr=layer.getBoundingClientRect();
    /* a figure frame: first snap the stored rect to the plot it visually
       hugs, then keep the plot's aspect locked while dragging */
    var figRatio=0;
    function takeFit(f){
      if(!f) return false;
      a.w=f.w;a.h=f.h;
      anchorSet(a,f.x,f.y,f.w,f.h);
      return true;
    }
    if(a.k==='cell'&&el&&el.classList.contains('an-figonly')){
      var ff=figFit(layer,a,figImg(el));
      if(takeFit(ff)) figRatio=ff.ratio;
    }
    /* A PLACED IMAGE gets the same treatment, for the same reason. It did
       not, and the result was the bug you could not put your finger on:
       .an-imgel is object-fit:contain, so a free-form box that no longer
       matches the picture's shape just grows LETTERBOX. Drag a wide photo
       downwards and the selection outline gets taller while the photo
       stays exactly the size it was — "images don't get bigger when you
       drag them, just get's a bigger border" (2026-08-20, user).
       So: snap the stored box onto the picture (killing any letterbox
       already banked), then hold the picture's aspect for the drag, which
       is what every other tool does with a photo. Hold SHIFT to stretch
       it out of shape on purpose, and a CROPPED image keeps free-form
       resizing because there the box IS the crop window (object-fit is
       cover) and reshaping it is the whole point. */
    var imgFree=false;
    if(a.k==='image'&&!a.crop&&el){
      var ie=el.querySelector('.an-imgel');
      var fi=ie?figFit(layer,a,ie):null;
      if(takeFit(fi)){figRatio=fi.ratio;imgFree=true;}
      /* ...unless Shift says otherwise, live, below */
    }
    var er=el?el.getBoundingClientRect():null;
    var ow=a.w||(er?er.width/lr.width*100:10);
    var oh=a.h||(er?er.height/lr.height*100:10);
    var origin=anchorPos(a,ow,oh),ox=origin.x,oy=origin.y;
    /* THE ASPECT LOCK (T65). Two sources, one number. A figure frame and
       an uncropped picture bring their own ratio (figRatio, above); any
       other item the user has locked with "Keep shape" is held to the
       shape it has RIGHT NOW, read off the box at mousedown -- the lock
       says "stay this shape", never "become square", which is why
       nothing is stored on the item but the flag.
       SHIFT IS THE MOMENTARY OPPOSITE of whatever is in force: it frees
       a locked item and constrains an unlocked one, which is what every
       drawing tool has taught people to expect. It used only to free,
       and only a picture. The one exception is a figure frame, whose box
       IS its plot -- freeing it just banks letterbox again, so Shift
       cannot reach it (that is what imgFree marks). */
    var boxRatio=(oh>0&&lr.height&&lr.width)
      ?((ow*lr.width)/(oh*lr.height)):0;
    var baseRatio=figRatio||(a.lockar?boxRatio:0);
    var canFree=imgFree||!!a.lockar;
    /* A ONE-AXIS HANDLE. The untouched axis is not this drag's business:
       nothing below writes to it, and only an aspect lock may move it --
       centred, so the item grows evenly either side rather than lurching
       towards whichever edge happened to be first in the source. */
    var axisX=(east||west)&&!(north||south);
    var axisY=(north||south)&&!(east||west);
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,[idx]);
    /* the same gesture path startMove uses (2026-08-23 perf): sync the
       existing element's inline box from the model instead of rebuilding
       the layer per mousemove; shapes/freehand scale via their viewBox,
       a fitted figure via its 100%-sized <img>, and attached arrows are
       redrawn because their endpoints derive from this box. The one real
       renderAnnots runs on mouseup. */
    var anyArrow=(s.annots||[]).some(function(m){
      return m&&m.k==='arrow';});
    var movedAny=false;
    function mm(ev){
      movedAny=true;
      var p=pctPoint(layer,ev);
      var dx=p.x-start.x,dy=p.y-start.y;
      /* Shift is the momentary opposite of the lock that is in force, so
         you can decide mid-gesture rather than before it (T65) */
      var ratio=baseRatio
        ?((canFree&&ev.shiftKey)?0:baseRatio)
        :(ev.shiftKey?boxRatio:0);
      /* the dragged corner moves; the opposite corner stays anchored */
      var nx=ox,ny=oy,nw=ow,nh=oh;
      if(east) nw=Math.max(4,ow+dx);
      if(west){nw=Math.max(4,ow-dx);nx=ox+(ow-nw);}
      if(a.k!=='text'){
        if(south) nh=Math.max(4,oh+dy);
        if(north){nh=Math.max(4,oh-dy);ny=oy+(oh-nh);}
      }
      var sx=null,sy=null;
      if(!ev.altKey){
        /* the moving edges snap; an aspect-locked figure snaps its width
           and lets the height follow the plot's ratio. A guide only shows
           when the snap actually landed (the 4% minimum can cancel it). */
        /* ONLY THE AXIS BEING DRAGGED SNAPS. With four corners every
           handle moved both axes, so the `else` arms below were only
           ever reached by a real west/north drag. A side handle makes
           east AND west false, and the else arm would then slide the
           left edge sideways during a purely vertical drag (T65). */
        if(east||west){
          var bx=bestSnap(targets.xs,[east?nx+nw:nx],thr.x);
          if(bx){
            if(east){if(nw+bx.d>=4){nw+=bx.d;sx=bx.at;}}
            else if(nw-bx.d>=4){nx+=bx.d;nw-=bx.d;sx=bx.at;}
          }
        }
        /* an aspect-locked drag snaps the axis that LEADS and lets the
           other follow: width for a corner or a side handle, height when
           the gesture is vertical-only */
        if(a.k!=='text'&&(north||south)&&(!ratio||axisY)){
          var by=bestSnap(targets.ys,[south?ny+nh:ny],thr.y);
          if(by){
            if(south){if(nh+by.d>=4){nh+=by.d;sy=by.at;}}
            else if(nh-by.d>=4){ny+=by.d;nh-=by.d;sy=by.at;}
          }
        }
      }
      if(ratio&&lr.height&&lr.width){
        if(axisY&&a.k!=='text'){
          /* dragged by a top or bottom edge: the HEIGHT leads and the
             width follows. The other way round is what the four-corner
             version did, and on a side handle it computed nh from an
             unchanged nw -- an aspect-locked figure would not have moved
             at all (T65). The width grows either side, because a side
             handle names no horizontal edge to anchor. */
          nw=nh*(lr.height*ratio/lr.width);
          nx=ox+(ow-nw)/2;
        } else {
          nh=nw*(lr.width/(lr.height*ratio));
          if(axisX) ny=oy+(oh-nh)/2;   /* ditto, vertically */
          else if(north) ny=oy+oh-nh;  /* keep the bottom edge anchored */
        }
      }
      a.w=nw;
      if(a.k!=='text') a.h=nh;
      anchorSet(a,nx,ny,nw,nh);
      if(el){
        var live=anchorPos(a,nw,nh);
        el.style.left=live.x+'%';el.style.top=live.y+'%';
        if(a.w!=null){el.style.width=a.w+'%';
          if(a.k==='text') el.style.maxWidth='none';}
        if(a.h!=null&&a.k!=='text') el.style.height=a.h+'%';
      }
      if(anyArrow) redrawArrows(layer,s);
      drawSnapGuides(layer,sx,sy);
      /* the numbers move with the drag: a readout that only caught up on
         mouseup would be the wrong number for the whole gesture (T65) */
      if(typeof sizePaneSync==='function') sizePaneSync();
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      /* the caption takes the figure's new width at the END of the
         gesture, not per mousemove: one commit, and a caption that does
         not reflow its words sixty times a second (T17) */
      if(movedAny) capFollowResize(capA,capO,figO,a);
      /* the ONE rebuild per gesture; a moveless mousedown keeps the old
         no-render path */
      if(movedAny){renderAnnots(layer,s);selectAnnot(layer,idx);}
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  /* called from the resize gesture's own commit */
  function capFollowResize(capA,capO,figO,fig){
    if(!capA||!capO||!figO||!fig) return;
    var w0=figO.w,w1=fig.w;
    if(!(w0>0)||!(w1>0)) return;
    /* the caption's LEFT tracks the figure's left, and its width the
       figure's width. Its own y is left alone: a caption sits under its
       figure, and where "under" is depends on how tall the caption is,
       which is its words' business. */
    var f0=anchorPos(figO,w0,figO.h),f1=anchorPos(fig,w1,fig.h);
    var c0=anchorPos(capO,capO.w,capO.h);
    var cw=capO.w?capO.w*(w1/w0):capO.w;
    if(capO.w) capA.w=cw;
    /* A POSITION LOCK IS ABOUT POSITION — the rule T57 settled for the
       Arrange verbs, and the same one here: a pinned caption still takes
       its figure's width, and stays exactly where it was put. */
    if(pinned(capA)) return;
    anchorSet(capA,c0.x+(f1.x-f0.x),c0.y,cw,capO.h);
  }
  function startRotate(layer,s,idx,ev0){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a) return;
    function mm(ev){
      var el=layer.querySelector('.an-item[data-idx="'+idx+'"]');
      if(!el) return;
      /* the visual centre is rotation-invariant, so measuring the live
         bounding box keeps the pivot stable while the item spins */
      var r=el.getBoundingClientRect();
      var ang=Math.atan2(ev.clientY-(r.top+r.height/2),
                         ev.clientX-(r.left+r.width/2))*180/Math.PI+90;
      if(ev.shiftKey) ang=Math.round(ang/15)*15;
      ang=((ang%360)+360)%360;
      if(ang>180) ang-=360;
      /* a small magnetic dead-zone so items land EXACTLY straight */
      [0,90,-90,180,-180].forEach(function(v){
        if(Math.abs(ang-v)<=1) ang=(v===-180)?180:v;});
      a.rot=Math.round(ang*10)/10||0;
      renderAnnots(layer,s);paintSel(layer);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      if(!a.rot) delete a.rot;
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startDraw(layer,s,kind,p0){
    /* A LINE IS AN ARROW WITH NO HEAD, so it keeps k:'arrow' and inherits
       endpoint dragging, attachment, routing, dashes, the Objects pane
       and the PowerPoint connector export for nothing. `nohead` rather
       than head:'none' because headEnd and both label functions read that
       field to say "Line" instead of "Arrow". It is drawn rather than
       dropped in ready-made (2026-08-10, user: "I hate it how when you
       click line, it just creates a line — can it please be drawn like it
       does with the shapes"), and it stays a theme-aware divider colour
       instead of alarm-orange. */
    var a=(kind==='rect')
      ?{k:'rect',x:p0.x,y:p0.y,w:0,h:0,color:'#ff6b57',sw:SW_DEFAULT,
        shape:(pendingShape!=='rect'?pendingShape:undefined)}
      :(kind==='draw')
      ?{k:'draw',x:p0.x,y:p0.y,w:0,h:0,pts:[[0,0]],sw:SW_DEFAULT,
        color:pageIsLight(pres.pageBg)?'#44525c':'#8aa0b0'}
      :(kind==='cell')
      ?{k:'cell',x:p0.x,y:p0.y,w:0,h:0,ref:null}
      /* born EMPTY and already carrying its own id: the id is what every
         binding on the slide points at, so it has to exist from the
         first moment the box does */
      :(kind==='flip')
      ?{k:'flip',x:p0.x,y:p0.y,w:0,h:0,fid:flipId(),frames:[],at:0}
      :(kind==='text')
      /* colour comes from the page theme. Born EMPTY and UNBOXED: the
         "Text" placeholder and the default panel both had to be removed
         by hand on every single box (2026-08-19, user: "no placeholder
         text and no background by default"). A box left empty deletes
         itself on blur, so nothing invisible is ever left behind. */
      ?textBorn(p0)
      /* A TABLE is rows of plain strings plus a handful of switches. Not
         HTML: a table you can only fill by typing HTML is a table nobody
         will use, and rows-of-strings is the shape every export already
         knows how to walk (2026-08-20, user asked for "Tables"). The
         header row is a FLAG rather than a separate field, so turning it
         on or off never moves a single cell of data. */
      :(kind==='table')
      ?{k:'table',x:p0.x,y:p0.y,w:0,h:0,size:2.2,thead:1,grid:1,
        sw:1,rows:[['','',''],['','',''],['','','']]}
      :(kind==='line')
      ?{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,nohead:1,sw:SW_DEFAULT,
        color:pageIsLight(pres.pageBg)?'#44525c':'#8aa0b0'}
      :{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,
        color:'#ff6b57',sw:SW_DEFAULT};
    var boxed=(a.k==='rect'||a.k==='cell'||a.k==='text'
      ||a.k==='table'||a.k==='flip');
    s.annots=s.annots||[];
    s.annots.push(a);
    var idx=s.annots.length-1;
    /* the raw trail, in page percentages, for a freehand stroke */
    var raw=(kind==='draw')?[[p0.x,p0.y]]:null;
    /* Fold the trail into a box plus 0..1 points. A stroke drawn dead
       straight has no extent on one axis, which would divide by zero and
       leave a box too thin to grab, so each axis gets a floor and the
       points centre themselves in it. */
    function foldTrail(){
      var xs=raw.map(function(q){return q[0];});
      var ys=raw.map(function(q){return q[1];});
      var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs);
      var y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
      var w=x1-x0,h=y1-y0,MIN=1.5;
      if(w<MIN){x0-=(MIN-w)/2;w=MIN;}
      if(h<MIN){y0-=(MIN-h)/2;h=MIN;}
      a.x=x0;a.y=y0;a.w=w;a.h=h;
      a.pts=raw.map(function(q){
        return [(q[0]-x0)/w,(q[1]-y0)/h];});
    }
    function mm(ev){
      var p=pctPoint(layer,ev);
      if(raw){
        /* thin the trail: a mousemove every pixel would store thousands
           of points into the document and the undo stack */
        var last=raw[raw.length-1];
        if(Math.abs(p.x-last[0])+Math.abs(p.y-last[1])>=0.35) raw.push([p.x,p.y]);
        foldTrail();
      } else if(boxed){
        a.x=Math.min(p0.x,p.x);a.y=Math.min(p0.y,p.y);
        a.w=Math.abs(p.x-p0.x);a.h=Math.abs(p.y-p0.y);
      } else {a.x2=p.x;a.y2=p.y;}
      renderAnnots(layer,s);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      /* the item about to be selected is one you JUST DREW, so the tab
         must not follow the selection this time — otherwise placing five
         shapes in a row throws you off Insert after every one */
      justDrew=true;
      var tiny=raw?(raw.length<3)
        :boxed?(a.w<1.5&&a.h<1.5)
        :(Math.abs(a.x2-a.x1)<1.5&&Math.abs(a.y2-a.y1)<1.5);
      /* A CLICK IS STILL A CLICK. Dragging says how big; clicking asks
         for the usual one, which is the fast way when the size does not
         matter yet — and it is what these two tools have always done, so
         nobody's habit breaks. A shape, line or arrow with no drag is
         still discarded: there is no sensible default size for those, and
         dropping a canned one is what the line tool was told off for
         (2026-08-10). */
      if(tiny&&a.k==='draw'){
        s.annots.splice(idx,1);      /* a stray click is not a drawing */
      } else if(tiny&&a.k==='table'){
        a.x=Math.min(p0.x,54);a.y=Math.min(p0.y,72);a.w=44;a.h=24;
      } else if(tiny&&a.k==='cell'){
        a.x=Math.min(p0.x,64);a.y=Math.min(p0.y,64);a.w=34;a.h=30;
      } else if(tiny&&a.k==='text'){
        delete a.w;delete a.h;          /* auto-size to its own words */
      } else if(tiny) s.annots.splice(idx,1);
      markDirty();setTool('select');
      renderAnnots(layer,s);
      if(!tiny||(boxed&&a.k!=='draw')){
        selectAnnot(layer,idx);
        if(a.k==='text') focusText(layer,idx);
      }
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  /* put the caret in a fresh text box with its placeholder selected, so
     the first thing you type replaces "Text" */
  function focusText(layer,idx){
    var tx=layer.querySelector('.an-item[data-idx="'+idx+'"] .an-tx');
    if(!tx) return;
    if(tx._beginEdit) tx._beginEdit();   /* make it editable FIRST */
    tx.focus();
    try{
      var rng=document.createRange();
      rng.selectNodeContents(tx);
      var sl=window.getSelection();
      sl.removeAllRanges();sl.addRange(rng);
    }catch(e){}
  }
  function distToSeg(px,py,x1,y1,x2,y2){
    var dx=x2-x1,dy=y2-y1;
    var L2=dx*dx+dy*dy;
    var u=L2?((px-x1)*dx+(py-y1)*dy)/L2:0;
    u=Math.max(0,Math.min(1,u));
    return Math.hypot(px-(x1+u*dx),py-(y1+u*dy));
  }
  function startEndpoint(layer,s,idx,ep,ev0){
    ev0.preventDefault();
    var a=(s.annots||[])[idx];
    if(!a||a.k!=='arrow'||pinned(a)) return;
    function mm(ev){
      var p=pctPoint(layer,ev);
      a['x'+ep]=p.x;a['y'+ep]=p.y;
      renderAnnots(layer,s);selectAnnot(layer,idx);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  /* drag one corner. Deliberately the SAME snapping every other drag
     gets, so a corner lines up with the things around it. */
  function startMidPoint(layer,s,idx,mi,ev0){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a||!Array.isArray(a.mid)||!a.mid[mi]) return;
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,[idx]);
    function mm(ev){
      var p=pctPoint(layer,ev);
      var x=p.x,y=p.y,sx=null,sy=null;
      if(!ev.altKey){
        var bx=bestSnap(targets.xs,[x],thr.x);
        if(bx){x+=bx.d;sx=bx.at;}
        var by=bestSnap(targets.ys,[y],thr.y);
        if(by){y+=by.d;sy=by.at;}
      }
      a.mid[mi]=[x,y];
      renderAnnots(layer,s);selectAnnot(layer,idx);
      drawSnapGuides(layer,sx,sy);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function arrowAt(layer,s,ev){
    if(!s.annots) return -1;
    var r=layer.getBoundingClientRect();
    var px=ev.clientX-r.left,py=ev.clientY-r.top;
    var best=-1,bestD=12;
    s.annots.forEach(function(a,i){
      if(a.k!=='arrow'||lockedAll(a)||a.hide) return;
      var d=distToSeg(px,py,
        a.x1/100*r.width,a.y1/100*r.height,
        a.x2/100*r.width,a.y2/100*r.height);
      if(d<bestD){bestD=d;best=i;}
    });
    return best;
  }
  /* ---- MARQUEE: drag a box on empty canvas to select what it touches --
     Mousedown on nothing used to deselect and stop there, so the only way
     to select several items was to shift-click each one - and shift-click
     on a text box was itself broken until 2026-08-20 (2026-08-20, user:
     "You can't drag and select multiple items. The shift and select
     multiple is realyl hard to do").
     TOUCH, not enclose: a band that has to swallow an item whole is
     unusable on a poster where the figures are bigger than the gap you
     have to drag in. Hold Shift or Ctrl to add to what is already
     selected. A drag under the threshold is still just a click, so
     "click empty space to deselect" is unchanged. */
  var MARQUEE_PX=4;
  function startMarquee(layer,s,ev0){
    /* THE ONE DRAG-STARTER IN THIS FILE THAT USED NOT TO. Every other
       one preventDefaults (startMove, startResize, startRotate,
       startEndpoint, startMidPoint) and the handler's own
       ev.preventDefault sits AFTER the select-tool block, so a marquee
       press was the single press the browser still got to act on: it
       began a NATIVE TEXT SELECTION and dragged it across every text
       box, table and notebook card the band crossed. That is the whole
       page going blue while you are trying to pick three items -- "it
       just results in everything being selected" (T63).
       preventDefault also stops the browser moving focus, and an
       on-canvas edit commits on BLUR (see editableText), so the caret
       is taken out deliberately first -- otherwise clicking empty
       space would leave you still typing into the box you clicked
       away from, with the words uncommitted. */
    var ae=document.activeElement;
    if(ae&&ae.isContentEditable&&layer.contains(ae)) ae.blur();
    ev0.preventDefault();
    var add=ev0.shiftKey||ev0.ctrlKey||ev0.metaKey;
    /* HOLD ALT TO SWEEP UP FULLY LOCKED ITEMS TOO. A lock means "not by
       accident", not "never again", and the Objects pane being the only
       way back to a background frame you locked months ago is a long way
       round (TASKS T3). Shift and Ctrl are taken — they add to the
       selection — so Alt it is, and on empty canvas it means nothing
       else. Position-locked items were never excluded here: they select
       and restyle like anything else, they just do not move. */
    var takeLocked=ev0.altKey;
    if(!add) leaveGroup(null);
    var base=add?selSet.filter(function(i){return typeof i==='number';}):[];
    var p0=pctPoint(layer,ev0);
    var band=null,moved=false;
    function mm(ev){
      /* A MOUSEUP OUTSIDE THE WINDOW NEVER ARRIVES. Release the button
         over the browser chrome or off-screen -- easy, the band is
         being dragged at a page edge -- and `mu` never ran: the band
         stayed on the layer and this handler carried on with the
         button UP, growing over the whole page and rewriting selSet on
         every move, until the next click's mouseup fired the stale `mu`
         and committed "everything selected" (T63). ev.buttons is 0
         once nothing is held, which is the one question that tells a
         live drag from a dead one; `mu` is a hoisted declaration, so
         calling it from here is fine. */
      if(!ev.buttons){mu();return;}
      var p=pctPoint(layer,ev);
      if(!moved){
        var dx=Math.abs(p.x-p0.x)*layer.clientWidth/100;
        var dy=Math.abs(p.y-p0.y)*layer.clientHeight/100;
        if(dx<MARQUEE_PX&&dy<MARQUEE_PX) return;
        moved=true;
        band=document.createElement('div');
        band.className='an-marquee';
        layer.appendChild(band);
      }
      var l=Math.min(p0.x,p.x),t=Math.min(p0.y,p.y);
      var r=Math.max(p0.x,p.x),b=Math.max(p0.y,p.y);
      band.style.left=l+'%';band.style.top=t+'%';
      band.style.width=(r-l)+'%';band.style.height=(b-t)+'%';
      var hit=base.slice();
      (s.annots||[]).forEach(function(a,i){
        /* hidden items are never on the table; fully locked ones are on
           it only when Alt asked for them */
        if(!a||a.hide) return;
        if(lockedAll(a)&&!takeLocked) return;
        var q=annotRectPct(layer,s,i); if(!q) return;
        if(q.r<l||q.l>r||q.b<t||q.t>b) return;
        groupMembers(s,i).forEach(function(j){
          if(hit.indexOf(j)<0) hit.push(j);});
      });
      selSet=hit;
      selAnnot=hit.length?hit[hit.length-1]:null;
      paintSel(layer);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      if(band) band.remove();
      if(!moved){
        /* a plain click on empty canvas: clear, unless you were adding */
        if(!add) selectAnnot(layer,null);
        return;
      }
      /* commit through the normal path so the ribbon and the Layers
         pane follow */
      lastSelSig='';
      showFmt();renderSelPane();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  /* ---- THE CANVAS RIGHT-CLICK MENU -------------------------------------
     Paste has three answers now (the plain one, in place, here) and a
     ribbon cannot grow three buttons for one verb without becoming the
     thing fitEditRibbon spends its life fighting. A right-click is also
     the only door that knows WHERE you clicked, which is precisely the
     question "Paste here" asks -- so the click point is captured when
     the menu opens and handed to pasteBuf, rather than read back from
     the live pointer, which by then is over the menu.
     Built from the film strip's helpers (menuHead / floatAt) so this
     file has one context-menu idiom, not two. */
  /* T31. One flag, set on every selected item, the way setLockSel
     does -- a selection is a selection. */
  function setPrivSel(on){
    var s2=pres.slides[cur]; if(!s2) return;
    var n=0;
    selIdxs().forEach(function(i){
      var a=(s2.annots||[])[i]; if(!a) return;
      if(on) a.priv=1; else delete a.priv;
      n++;
    });
    if(!n) return;
    markDirty();renderSlide();presenterSync&&presenterSync();
    toast(on?(n===1?'Yours \u2014 the audience will not see it'
        :(n+' items are yours \u2014 the audience will not see them'))
      :(n===1?'Back on the slide for everyone'
        :(n+' items are back on the slide for everyone')));
  }
  function openCanvasMenu(layer,s,ev){
    var old=$('#canvas-menu'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu';m.id='canvas-menu';
    /* the click, in page percentages, frozen at open time */
    var at=pctPoint(layer,ev);
    function row(label,keys,fn,title,icon,host){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      /* the icon is trusted bic() markup; the LABEL stays a text node */
      if(icon) b.innerHTML=bic(icon)+' ';
      b.appendChild(document.createTextNode(label));
      if(keys){
        var k=document.createElement('kbd');
        k.textContent=keys;b.appendChild(k);
      }
      if(title) b.title=title;
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();fn();});
      (host||m).appendChild(b);
      return b;
    }
    var n=selIdxs().length;
    if(n){
      menuHead(m,n===1?'this object':n+' objects');
      row('Duplicate','Ctrl+D',duplicateSel,
        'An independent copy, just clear of this one — or Alt-drag '
        +'on the page to place it as you go','copy');
      /* T93. Offered only when something in the selection actually HAS
         a source to drop -- on three text boxes this would be a second
         Duplicate with a longer name, and a menu row that does nothing
         is worse than no row. Same rule the figure/caption rows below
         follow: appear exactly when they apply and ask nothing.
         hasContext and stripContext are one list, in the CLONES section
         of 30-format-bar.js. */
      if(selIdxs().some(function(i){
        return hasContext((pres.slides[cur].annots||[])[i]);}))
        row('Duplicate without its source','Ctrl+Shift+D',function(){
          duplicateSel(1);},
          'The same box, size, styling and crop — pointing at '
          +'nothing, so you can aim it at a different figure','unlink');
      row('Cut','Ctrl+X',function(){
        var c=cutSel();
        if(c) toast(c+' item'+(c===1?'':'s')+' cut');});
      row('Copy','Ctrl+C',function(){
        var c=copySel();
        if(c) toast(c+' item'+(c===1?'':'s')+' copied');});
      row('Delete','Del',deleteSel,null,'exit');
      /* A FIGURE AND ITS CAPTION (T17). Two objects selected, one of
         them a figure and one a text box, is an unambiguous "tie
         these" — so the row appears exactly then and asks nothing. */
      var capSel=selIdxs();
      var capAn=(pres.slides[cur].annots||[]);
      if(capSel.length===2){
        var f0=capAn[capSel[0]],f1=capAn[capSel[1]];
        var figI=isFigure(f0)?capSel[0]:(isFigure(f1)?capSel[1]:-1);
        var txI=(f0&&f0.k==='text')?capSel[0]
          :((f1&&f1.k==='text')?capSel[1]:-1);
        if(figI>=0&&txI>=0&&figI!==txI){
          menuHead(m,'figure');
          row('Make this the figure’s caption','',function(){
            if(tieCaption(figI,txI))
              toast('Tied — the caption follows its figure now. '
                +'Type {fig} in it for its number');},
            'It moves with the figure and takes its width when the '
            +'figure is resized. It is still an ordinary text box you '
            +'can select and restyle on its own.','link');
        }
      } else if(capSel.length===1){
        var one=capAn[capSel[0]];
        /* ADD ONE, rather than tie two things that already exist. T17
           shipped only the tie, and only when exactly two objects were
           selected — so there was no answer at all to "caption this",
           which is one command on the picture in every other tool and
           is how anyone actually writes a caption (2026-08-26 audit,
           T58). */
        if(one&&isFigure(one)&&!capHasOne(one)){
          menuHead(m,'figure');
          row('Add a caption','',function(){addCaption(capSel[0]);},
            'A text box under it, at its width, already tied and '
            +'already numbered — type the words','caption');
        }
        if(one&&(one.cap||one.capOf)){
          menuHead(m,'figure');
          if(one.capOf) row('Number it — put “Figure N” in front','',
            function(){numberCaption(capSel[0]);},
            'Writes {fig} into the caption, which renders as the '
            +'figure’s number and renumbers itself when slides move',
            'numbers');
          row(one.capOf?'Untie this caption'
            :'Untie this figure’s caption','',
            function(){
              if(untieCaption(capSel[0]))
                toast('Untied — they are two ordinary objects');},
            null,'unlink');
        }
        /* a reference from ANY text box to a figure */
        if(one&&one.k==='text'&&!one.capOf){
          /* NUMBER FIRST, THEN LIST. The list was built from figures
             that already had a `cap` — and `cap` is minted by
             figNumbers(), which was called two lines further down,
             INSIDE `if(figs.length)`. On any deck where nothing had ever
             been tied or numbered no figure had a cap, so the list came
             back empty, the guard failed, figNumbers never ran, and the
             section could not appear: not on this deck, not on any deck,
             ever (2026-08-26 audit, T58). */
          var fmap=figNumbers();
          var figs=[];
          (pres.slides||[]).forEach(function(sl){
            (sl.annots||[]).forEach(function(x){
              if(isFigure(x)&&!x.hide&&x.cap) figs.push(x);});});
          if(figs.length){
            menuHead(m,'refer to a figure');
            /* EVERY figure, in a box that scrolls when there are many.
               `.slice(0,8)` threw the rest away silently — on the poster
               tool whose sibling task is written around "regenerate 30
               figures", seven eighths of a deck could not be referred
               to at all. */
            var fbox=document.createElement('div');
            fbox.className='menu-scroll';
            m.appendChild(fbox);
            figs.forEach(function(x){
              var num=fmap[x.cap]?fmap[x.cap].n:'?';
              row('Insert a reference to Figure '+num,'',function(){
                refCaption(capSel[0],x.cap);},
                'Writes {fig:'+x.cap+'}, which follows that figure’s '
                +'number wherever it ends up','locate',fbox);
            });
          }
        }
      }
      /* PINNED TO WHICH CORNER (T14). Offered for one object at a
         time: an anchor is a fact about that item, and a menu that
         set nine of them at once would be a menu nobody could undo in
         their head. */
      if(selIdxs().length===1){
        var anI=selIdxs()[0];
        var anA=(pres.slides[cur].annots||[])[anI];
        if(anA&&anA.k!=='arrow'){
          menuHead(m,'pinned to');
          var nowAn=anA.anch||'';
          row('Nothing — measured from the top left','',
            function(){setAnchor(anI,'');},
            'The default, and what every object in every deck did '
            +'before this existed').classList.toggle('on',!nowAn);
          ['tl','tc','tr','cl','c','cr','bl','bc','br']
            .forEach(function(k){
              if(k==='tl') return;   /* same as no anchor */
              row(ANCHORS[k][0],'',function(){setAnchor(anI,k);},
                'Stays this far from there when the page changes shape')
                .classList.toggle('on',nowAn===k);
            });
        }
      }
      /* COMPONENTS. The rows differ by what you are pointing at: a
         plain selection can BECOME one; an instance can push its look
         to the definition or leave it. */
      var cSel=selIdxs();
      var cA=(pres.slides[cur].annots||[])[cSel[cSel.length-1]];
      var cInst=(cA&&cA.cmp&&cA.cinst)?cA:null;
      menuHead(m,'component');
      if(cInst){
        var cDef=cmpStore()[cInst.cmp];
        var cN=cmpInstances(cInst.cmp).length;
        row('Push this look to \u201c'
          +((cDef&&cDef.name)||'the component')+'\u201d','',
          function(){
            var k=cmpPush(cInst.cmp,cur,cInst.cinst);
            toast(k?(k+' other instance'+(k===1?'':'s')+' updated')
              :'Saved \u2014 no other instances yet');},
          'The other '+(cN-1)+' instance'+(cN===2?'':'s')
          +' take this arrangement and look. Their own words and '
          +'figures are untouched.');
        /* WHERE ELSE IS THIS? The section could push a look to every
           other instance and could cut this one loose from them, but it
           could not tell you they existed — the count only ever
           appeared inside a tooltip on a different row (T89). */
        row('Every instance of this component…',String(cN),
          function(){cmpInstMenu(cInst.cmp);},
          'Every place in the deck it has been put, as a list — '
          +'pick one to go to that slide with the instance already '
          +'selected','locate');
        row('Detach this one','',function(){
          var k=cmpDetach(cur,cInst.cinst);
          if(k) toast(k+' object'+(k===1?'':'s')
            +' \u2014 no longer linked');},
          'Turns this instance into ordinary objects. The component and '
          +'its other instances are unaffected.');
      } else if(cSel.length){
        row('Make a component from '
          +(cSel.length===1?'this':('these '+cSel.length)),'',
          function(){
            var nm=prompt('Name for the component:','FigureCaption');
            if(!nm) return;
            var id=cmpDefine(nm.trim(),cSel);
            if(id) toast('\u201c'+nm.trim()+'\u201d saved \u2014 place '
              +'it again from this menu');},
          'Saves the arrangement and look as a named thing you can place '
          +'again. Each copy keeps its own words and figures.');
      }
      var cAll=cmpList();
      if(cAll.length){
        cAll.forEach(function(c){
          row('Place \u201c'+c.name+'\u201d',String(c.n),function(){
            var k=cmpPlace(c.id,at);
            if(k) toast('Placed \u201c'+c.name+'\u201d');},
            'Drops a linked copy here');
        });
      }
      if(selIdxs().length===1){
        var fa=(pres.slides[cur].annots||[])[selIdxs()[0]];
        if(fa&&fa.k==='text'){
          menuHead(m,'fit');
          var onFit=(fa.fit==='shrink');
          row(onFit?'Shrink to fit: on':'Shrink to fit: off','',
            function(){toggleFit(selIdxs()[0]);},
            'Asks the words to live inside the height they have now. '
            +'The size you chose is never rewritten — only what is '
            +'drawn shrinks, and it stops before the text stops being '
            +'readable.').classList.toggle('on',onFit);
          if(fa.fh) row('Forget the fit height','',
            function(){clearFit(selIdxs()[0]);},
            'Back to a box that simply grows with its words');
        }
      }
      if(selIdxs().length===1){
        var pvA=(pres.slides[cur].annots||[])[selIdxs()[0]];
        if(pvA&&pvA.k==='cell'&&pvA.ref){
          row('Where this came from…','',showProvPane,
            'The notebook and cell that made it, every cell in its '
            +'lineage, and whether the notebook has moved on since',
            'tree');
        }
      }
      row('History of this object…','',showObjHist,
        'Every state it has been through that the undo stack still '
        +'remembers, and a button to put any of them back','history');
      /* SELECT BY WHAT THINGS ARE. Inline rather than behind a
         submenu: this is already a menu, and the counts are the point —
         a row that says how many it will take is a row you can trust
         before you click it. */
      var sby=selectByRows();
      if(sby.length){
        menuHead(m,'select on this slide');
        sby.forEach(function(r){
          row(r.label,String(r.n),function(){selectBy(r.key,r.val);});
        });
      }
      /* the lock, in words. The pane's button cycles the same three
         states in a quarter of the space; here they are named, which is
         how anyone finds out the position-only one exists at all. */
      var lms=selIdxs().map(function(i){
        return lockMode((pres.slides[cur].annots||[])[i]);});
      var lmNow=lms.every(function(x){return x===lms[0];})?lms[0]:null;
      menuHead(m,'lock');
      [['','Not locked',null,null],
       ['pos','Lock position',
        'Pinned where it is — still yours to select, resize and '
        +'restyle','pin'],
       ['all','Lock fully',
        'No clicking or dragging on the canvas. The Objects pane, and '
        +'an Alt-marquee, are the way back','lock']]
        .forEach(function(o){
          var b=row(o[1],'',function(){setLockSel(o[0]);},o[2],o[3]);
          if(lmNow===o[0]) b.classList.add('on');
        });
    }
    /* WHO SEES THIS. Beside `lock`, because both answer "what can be
       done to this object" rather than "what does it look like" (T31). */
    if(selIdxs().length){
      var pvs=selIdxs().map(function(i){
        return !!((pres.slides[cur].annots||[])[i]||{}).priv;});
      var allPriv=pvs.every(function(x){return x;});
      menuHead(m,'who sees it');
      var pb=row(allPriv?'\u2713 Only me':'Only me','',function(){
        setPrivSel(!allPriv);},
        'Drawn on your screen and in the presenter view, marked so you '
        +'know it is yours. Never drawn for the audience, and never in '
        +'a PDF or PowerPoint. Like your speaker notes, it is stored in '
        +'the deck file.','eye');
      if(allPriv) pb.classList.add('on');
    }
    var cgm=customGuides();
    menuHead(m,'guides');
    row('Draw a guide box','B',armGuideBox,
        'An editing aid to lay out inside \u2014 drag its edges to '
        +'resize and its grip to move it. It snaps, and it is never '
        +'printed, exported or shown while presenting','frame');
    /* SHOWN OR HIDDEN, which is not drawn or deleted. Offered only once
       there is something to hide, so an empty page does not carry a
       toggle for nothing. */
    if(cgm.b.length||cgm.x.length||cgm.y.length){
      var gShown=guidesShown();
      var gvb=row(gShown?'\u2713 Show your guides':'Show your guides','H',
        function(){showCustomGuides(!gShown);},
        'Hidden, they neither draw nor snap. They stay in the deck, so '
        +'this gets them out of the way \u2014 it is not a delete',
        'guides');
      if(gShown) gvb.classList.add('on');
    }
    if(cgm.b.length)
      row('Clear the '+cgm.b.length+' guide box'
        +(cgm.b.length===1?'':'es'),'',function(){clearGuides(true);});
    if(cgm.x.length||cgm.y.length)
      row('Clear every guide','',function(){clearGuides(false);},
        'The boxes and the lines dragged off the rulers');
    menuHead(m,'paste');
    if(!clipBuf.length){
      row('Nothing copied yet','',function(){}).disabled=true;
    } else {
      row('Paste','Ctrl+V',function(){pasteBuf('auto');},
        'Nudged clear of the original on this slide; in the same place '
        +'on any other');
      row('Paste in place','Ctrl+Shift+V',function(){pasteBuf('place');},
        'Exactly where it was copied from — the way you put one '
        +'caption in the identical spot on twenty slides');
      row('Paste here','Ctrl+Alt+V',function(){pasteBuf('here',at);},
        'Centred on the point you right-clicked');
    }
    floatAt(m,ev);
  }
  function setLockSel(mode){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var idxs=selIdxs();
    if(!idxs.length) return;
    idxs.forEach(function(i){
      var a=s.annots[i]; if(!a) return;
      if(mode==='pos') a.lock='pos';
      else if(mode==='all') a.lock=1;
      else delete a.lock;
    });
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
    toast(LOCK_LABEL[mode]+(idxs.length===1?''
      :' — '+idxs.length+' items'));
  }
  function wireEditor(layer,s){
    /* a right-click on a corner takes it out, so the browser's own menu
       must not open over the top of the gesture; anywhere else on the
       canvas it opens OUR menu instead (2026-08-24) */
    layer.addEventListener('contextmenu',function(ev){
      if(ev.target&&ev.target.classList
         &&ev.target.classList.contains('an-mid')){ev.preventDefault();return;}
      if(mode!=='edit'||tool!=='select') return;
      ev.preventDefault();
      openCanvasMenu(layer,s,ev);
    });
    layer.addEventListener('mousedown',function(ev){
      if(mode!=='edit') return;
      var t=ev.target;
      /* WHILE A MATCH IS ARMED the canvas is a picker, not an editor: the
         next thing you press is the object you meant, and selecting or
         dragging it instead would be the wrong answer to a gesture you
         have already committed to. Handled at the top of the one handler
         that owns canvas mousedown, so there is no second code path
         deciding what a click means (2026-08-22). */
      if(matchArm){
        var mt=(t.closest&&t.closest('.an-item[data-idx]'));
        if(mt){
          ev.preventDefault();ev.stopPropagation();
          matchHit(+mt.getAttribute('data-idx'));
        }
        return;
      }
      var item=(t.closest&&t.closest('.an-item'))
        ||(t.getAttribute&&t.classList
           &&t.classList.contains('an-item')?t:null);
      if(tool==='select'){
        /* A RIGHT-CLICK PICKS, AND NEVER DRAGS. The menu that follows
           acts on the selection, so the click has to be able to change
           it -- but this handler used to run its full select/move/
           marquee ladder on button 2 as well, which meant the menu
           opened on top of a drag already in progress. The one
           exception is a bend corner, where right-click REMOVES it and
           the endpoint branch below owns the gesture. */
        if(ev.button===2
           &&!(t.classList&&t.classList.contains('an-endpt'))){
          var rraw=item&&item.getAttribute('data-idx');
          if(rraw!=null){
            var ridx=(rraw==='t'||rraw==='s')?rraw:+rraw;
            if(selIdxs().indexOf(ridx)<0) selectAnnot(layer,ridx,false);
          }
          return;
        }
        /* endpoint handles first, then resize handles, then arrows
           (they render on top, so they win the click even over a
           frame), then the item */
        if(t.classList&&t.classList.contains('an-endpt')){
          var idxE=+t.getAttribute('data-idx');
          selectAnnot(layer,idxE);
          /* the faint handle halfway along a segment CREATES a corner and
             then drags it, so adding and placing are one gesture */
          if(t.hasAttribute('data-addat')){
            var at=+t.getAttribute('data-addat');
            var aA=annotByIdx(s,idxE);
            if(aA){
              var mids=arrowMids(aA).slice();
              var pA=pctPoint(layer,ev);
              mids.splice(at,0,[pA.x,pA.y]);
              aA.mid=mids;
              markDirty();renderAnnots(layer,s);selectAnnot(layer,idxE);
              startMidPoint(layer,s,idxE,at,ev);
            }
            return;
          }
          if(t.hasAttribute('data-mid')){
            var mi2=+t.getAttribute('data-mid');
            /* Alt+click takes a corner out; so does a right-click, which
               is what a vector editor has trained everyone to try */
            if(ev.altKey||ev.button===2){
              var aR=annotByIdx(s,idxE);
              if(aR&&Array.isArray(aR.mid)){
                aR.mid.splice(mi2,1);
                if(!aR.mid.length) delete aR.mid;
                markDirty();renderAnnots(layer,s);selectAnnot(layer,idxE);
              }
              return;
            }
            startMidPoint(layer,s,idxE,mi2,ev);
            return;
          }
          startEndpoint(layer,s,idxE,
            t.getAttribute('data-ep'),ev);
          return;
        }
        if(item&&t.classList&&t.classList.contains('an-resize')){
          var rawR=item.getAttribute('data-idx');
          var idxR=(rawR==='t'||rawR==='s')?rawR:+rawR;
          selectAnnot(layer,idxR);
          startResize(layer,s,idxR,ev,t.dataset.corner);
          return;
        }
        if(item&&t.classList&&t.classList.contains('an-rotate')){
          var rawRo=item.getAttribute('data-idx');
          var idxRo=(rawRo==='t'||rawRo==='s')?rawRo:+rawRo;
          selectAnnot(layer,idxRo);
          startRotate(layer,s,idxRo,ev);
          return;
        }
        var ai=arrowAt(layer,s,ev);
        if(ai>=0){
          /* honour shift/multi-select the same way the item branch does */
          if(ev.shiftKey){selectAnnot(layer,ai,true);return;}
          if(selSet.indexOf(ai)<0) selectAnnot(layer,ai,false);
          else {selAnnot=ai;paintSel(layer);showFmt();}
          startMove(layer,s,ai,ev);
          return;
        }
        if(item){
          var raw=item.getAttribute('data-idx');
          var idx=(raw==='t'||raw==='s')?raw:+raw;
          /* Shift OR Ctrl/Cmd adds and removes; it never starts a drag.
             Ctrl is here because half the world reaches for it first and
             it did nothing at all before (2026-08-20). */
          if((ev.shiftKey||ev.ctrlKey||ev.metaKey)&&typeof idx==='number'){
            selectAnnot(layer,idx,true);return;
          }
          /* clicking outside the group you are inside leaves it */
          if(inGroup!=null&&typeof idx==='number'){
            var ga=(s.annots||[])[idx];
            if(!ga||ga.grp!==inGroup) leaveGroup(null);
          }
          /* clicking an item already in a multi-selection keeps the set and
             drags the whole group */
          if(selSet.indexOf(idx)<0) selectAnnot(layer,idx,false);
          else {selAnnot=idx;paintSel(layer);showFmt();}
          /* every item drags from its body, text included. The only thing
             that does not is a box you are actually typing in. */
          if(!item.classList.contains('an-editing'))
            startMove(layer,s,idx,ev);
        } else startMarquee(layer,s,ev);
        return;
      }
      ev.preventDefault();
      /* A GUIDE IS NOT AN ANNOTATION, so it forks off here rather than
         inside startDraw: startDraw's whole job is building s.annots
         entries, and a guide that never becomes one cannot leak into a
         render or an export later (see the guide-boxes section). */
      if(tool==='guide'){
        startGuideBox(layer,pctPoint(layer,ev));
        return;
      }
      /* EVERY insert tool draws the same way. Text and cell used to be
         the two that did not: they dropped a canned box wherever you
         clicked and left you to resize it by hand, every single time
         (2026-08-17, user: "when you add them it would be good to draw
         them out to the shape you like, they just kind of snap to the one
         shape"). */
      if(tool!=='select') startDraw(layer,s,tool,pctPoint(layer,ev));
    });
    /* double-click a GROUP to step inside it; the second double-click on
       a text box inside then edits its words, as it always did */
    layer.addEventListener('dblclick',function(ev){
      if(mode!=='edit'||tool!=='select') return;
      var it=ev.target.closest&&ev.target.closest('.an-item');
      if(!it){leaveGroup(layer);return;}
      var raw=it.getAttribute('data-idx');
      if(raw==='t'||raw==='s') return;
      var i2=+raw,a2=(s.annots||[])[i2];
      if(!a2||a2.grp==null||inGroup===a2.grp) return;
      ev.stopPropagation();
      inGroup=a2.grp;
      selectAnnot(layer,i2);
      toast('Inside the group \u2014 clicks pick one item. Esc to step out');
    });
  }
  /* every tool that exists. Anything else is NO tool. */
  var TOOLS={select:1,text:1,arrow:1,rect:1,line:1,cell:1,draw:1,
    table:1,flip:1,guide:1};
  function setTool(t){
    /* An unknown tool used to be armed happily: #dc-qr carried the generic
       `et` class with no data-tool, so the shared wiring ran
       setTool(undefined) and left the editor in a state no code handles —
       the button pressed, Cancel showing, the layer classed
       `tool-undefined`, the hint empty, and clicks on the page doing
       nothing. Worse, that wiring runs AFTER the QR handler's own
       setTool('select'), so it clobbered the cleanup and the state
       survived a successful insert (2026-08-17).
       The stray class is gone; this makes the whole family of that bug
       impossible rather than fixing the one instance of it. */
    if(!TOOLS[t]) t='select';
    tool=t;
    /* arming the guide-box tool with your own guides hidden would draw a
       box you could not see. Here rather than in each of the three doors
       onto it, so the generic `.et` wiring is covered too. */
    if(t==='guide') showCustomGuides(true);
    $$('#edit-tools .et').forEach(function(b){
      b.setAttribute('aria-pressed',(b.dataset.tool===t).toString());});
    var shb=$('#sh-btn');   /* the Shapes dropdown draws the 'rect' tool */
    if(shb) shb.setAttribute('aria-pressed',(t==='rect').toString());
    var l=stage.querySelector('.annot-layer');
    if(l) l.className='annot-layer tool-'+t;
    /* The way OUT, shown exactly when there is something to get out of.
       Escape has always de-armed a tool, but nothing said so, and an
       armed tool otherwise looks identical to no tool at all except for
       the cursor (2026-08-10, user). It sits beside the tools rather than
       in the hint, because the hint is the first thing the fit ladder
       drops and the exit must never be droppable. */
    var cx=$('#et-cancel');
    if(cx) cx.hidden=(t==='select');
    if(t!=='select') cropMode=false;
    var hint=$('#et-hint');
    /* "the slide" is wrong on a poster, which is one printed page and has
       no slides — the word leaked into every one of these (2026-08-07
       audit; cf. the Page/Slide label and the Versions button) */
    var pw=pageOf().poster?'the page':'the slide';
    if(hint) hint.textContent=
      t==='text'?('Drag on '+pw+' to draw a'
        +(pendingStyle&&styleDef(pendingStyle)
          ?' '+styleDef(pendingStyle).label:' text')
        +' box, or click for one that sizes itself')
      :t==='arrow'?'Drag on '+pw+' to draw an arrow'
      :t==='rect'?('Drag on '+pw+' to draw a '
        +(pendingShape==='rect'?'rectangle':pendingShape))
      :t==='line'?'Drag on '+pw+' to draw a line'
      :t==='cell'?'Drag on '+pw+' to draw a cell frame (or click for the '
        +'usual size), then pick a card from your notebook to fill it'
      :t==='flip'?('Drag on '+pw+' to draw a flip book, then add the '
        +'figures you want to step through')
      :t==='table'?'Drag on '+pw+' to draw a table (or click for a 3\u00d73). '
        +'Double-click a cell to type; Tab moves along, Enter goes down'
      :t==='guide'?'Drag on '+pw+' to draw a guide box \u2014 an editing '
        +'aid to lay out inside. It snaps, and it is never printed, '
        +'exported or shown while presenting'
      /* NOTHING in the resting state. A hint earns its place by telling
         you about a mode you have just entered and cannot see; describing
         the default state — click to select, drag to move — is a caption
         on the obvious, sitting in the middle of the toolbar forever
         (2026-08-10, user: "what is that even there?"). */
      :'';
  }
  function deleteSel(){
    var s=pres.slides[cur];
    if(!s||!s.annots) return;
    var idxs=selIdxs();
    if(!idxs.length) return;
    /* A FULLY LOCKED ITEM IS NOT DELETABLE. "Lock fully takes it off the
       canvas altogether: no clicking, no dragging, no typing" (help),
       and every other bulk verb already asks lockedAll — duplicate,
       arrange, align, the PowerPoint export. Delete was the one that did
       not, and it is the one you cannot take back by looking at it.
       Both documented ways to hold a locked item in a selection end at
       this function: Alt+marquee "sweeps up fully locked items too", and
       the Objects pane is "the way back" for something you cannot click.
       Select one there to unlock it, press Delete meaning the other
       three, and it was gone (2026-08-25). */
    var kept=idxs.filter(function(i){
      return !lockedAll((s.annots||[])[i]);});
    var held=idxs.length-kept.length;
    if(!kept.length){
      toast(held===1?'That item is fully locked — unlock it first'
        :'Those '+held+' items are fully locked — unlock them first');
      return;
    }
    /* A CAPTION WHOSE FIGURE HAS GONE is rubbish somebody else has to
       find: the review lint exists partly to report exactly this. Untie
       it here instead. The caption STAYS — it is an ordinary text box
       and the words in it are yours — it simply stops claiming to
       belong to something that is not there (2026-08-26 audit, T58). */
    var untied=0,fmapDel=null;
    kept.forEach(function(i){
      var f=(s.annots||[])[i];
      if(!f||!f.cap) return;
      var ci=capOfFig(s,f);
      if(ci<0||kept.indexOf(ci)>=0) return;
      var c=s.annots[ci];
      /* FREEZE THE NUMBER IT WAS SHOWING. `{fig}` means "the number of
         the figure I am tied to", so the moment that figure goes the
         token has nothing left to say — and an untied box still
         holding one renders '[not a caption]' where a second ago it
         read 'Figure 3'. The words it was showing are the words it
         keeps. */
      fmapDel=fmapDel||figNumbers();
      var hitDel=fmapDel[f.cap];
      if(hitDel){
        var nDel=String(hitDel.n);
        c.text=String(c.text||'').replace(/\{fig\}/g,nDel);
        if(c.html) c.html=String(c.html).replace(/\{fig\}/g,nDel);
      }
      delete c.capOf;
      untied++;
    });
    kept.sort(function(x,y){return y-x;}).forEach(function(i){
      if(i>=0&&i<s.annots.length) s.annots.splice(i,1);});
    if(!s.annots.length) delete s.annots;
    selAnnot=null;selSet=[];markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l) renderAnnots(l,s);
    showFmt();
    /* say what was NOT deleted, or a mixed selection looks like Delete
       half-worked for no reason */
    if(held) toast(held+' fully locked item'+(held===1?'':'s')+' kept');
    else if(untied) toast(untied+' caption'+(untied===1?'':'s')
      +' untied — the text is still there');
  }
  /* does this figure already have a caption on this slide */
  function capHasOne(a){
    var s=pres.slides[cur];
    return !!(a&&a.cap&&s&&capOfFig(s,a)>=0);
  }
  /* T17 shipped the TIE. This is the command: make the box, put it
     under the figure at the figure's width, tie it, number it, and
     leave the caret in it. */
  function addCaption(i){
    var s2=pres.slides[cur];
    var f=s2&&(s2.annots||[])[i];
    if(!f||!isFigure(f)) return 0;
    var l=stage.querySelector('.annot-layer');
    var r=l?annotRectPct(l,s2,i):null;
    var x=r?r.l:(f.x||10);
    var y=(r?r.b:((f.y||10)+(f.h||20)))+1;
    var w=r?(r.r-r.l):(f.w||40);
    s2.annots=s2.annots||[];
    s2.annots.push({k:'text',x:Math.max(0,x),y:Math.min(96,y),
      w:Math.max(6,w),size:1.8,bg:0,style:'caption',
      text:'Figure {fig}. '});
    var ci=s2.annots.length-1;
    tieCaption(i,ci);
    var l2=stage.querySelector('.annot-layer');
    if(l2){selectAnnot(l2,ci);focusText(l2,ci);}
    toast('Caption added — it follows the figure and numbers itself');
    return 1;
  }
  function groupSel(){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var idxs=selSet.filter(function(i){return typeof i==='number';});
    if(idxs.length<2) return;
    var gid=nextGrp(s);
    idxs.forEach(function(i){if(s.annots[i]) s.annots[i].grp=gid;});
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,idxs[0]);}
  }
  function ungroupSel(){
    var s=pres.slides[cur];
    if(!s||typeof selAnnot!=='number'||!s.annots) return;
    var a=s.annots[selAnnot]; if(!a||a.grp==null) return;
    var g=a.grp;
    s.annots.forEach(function(x){if(x.grp===g) delete x.grp;});
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,selAnnot);}
  }
