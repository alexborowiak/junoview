/* 07-ribbon-layouts.js — many arrangements of the one ribbon: the
   catalogue, the engine that applies one, and the gallery you pick from.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- MANY ARRANGEMENTS, ONE RIBBON -----------------------------------
     The ribbon's grouping has been argued about since it existed, and
     every argument has had the same shape: somebody is sure the slide
     controls belong together, somebody else is sure the things that
     CHANGE a selected object belong together, and both are right for the
     way they work. (2026-08-25, user: "the layout of these can get
     weird. Instead of deciding, let's make there heaps of different
     layouts, so I can try a bunch and see what works.")

     So this stops deciding. A LAYOUT is a complete re-assignment of every
     control into tabs and groups; there are many; you switch between them
     from a gallery and keep the one that fits your hands.

     1. THE MARKUP IS STILL THE TRUTH, and "Default" is a restoration
        rather than one more entry in the catalogue. Every atom's
        original home is snapshotted once, before anything moves, by
        recording each container's full child order — so putting it back
        reproduces the markup exactly instead of approximating it. A
        catalogue entry that had to mirror deck.html would be one more
        thing to keep in step, and it would drift the first time a button
        was added.

     2. NOTHING IS DUPLICATED, EVER. Applying a layout MOVES the real
        controls. There is one Bold button in this application and there
        always will be — the alternative, rendering a layout's own copy
        of each control, would mean two elements answering to one id,
        two sets of handlers, and showFmt toggling whichever it found
        first. Every layout is the same hundred objects in a
        different order.

     3. A LAYOUT DECLARES ITS OWN TABS, including how many. That is the
        whole point — several of these are one-tab layouts and several
        are four — so `TABS` and the tab strip are built from the layout
        rather than hardcoded, and the strip's clicks are delegated so a
        tab button generated a second ago works like one from the markup.

     4. AND IT DECLARES WHERE A SELECTION SENDS YOU. showFmt used to say
        `setTab('home')` because "every selection-driven group lives on
        Home" — true of the markup, and false the moment a layout puts
        the format groups on a tab called "Object". So the layout names
        that tab, and the promise it protects ("the tools for the thing
        you just clicked are in ONE named place") survives the move.

     5. WHAT IT DOES NOT TOUCH: labels. Buttons stay words plus icons and
        keep their own names, so muscle memory for what a button SAYS
        survives every rearrangement — a layout moves things, it does not
        rename them. Only GROUP labels are the layout's to choose.

     6. IT COMPOSES WITH T11 rather than replacing it. A layout decides
        which group a control is in; the per-button customiser still
        hides and reorders within a group, and its preferences are keyed
        per layout, so tidying Default does not scramble Sources-first.

     THE CATALOGUE ITSELF is at the bottom of this file. It is data: no
     layout may contain logic, because the moment one needs code it stops
     being a thing you can add by typing a list of ids. */
  var RIBBON_LAYOUT_KEY='jv-ribbon-layout';   /* NOT +SCOPE, as T11's */
  var rbnLayoutId=null;
  var RBN_HOME=null;

  /* AN ATOM: the outermost id-bearing thing inside a group that is not
     the group's own label. Deeper than T11's `ribbonControls`, which
     takes the direct children of `.rbn-row` — deliberately, and the
     difference matters both ways. `ribbonControls` must stay shallow
     because it RE-APPENDS to the row, and reaching into the `.rbn-col`
     stacks of Line & shape would flatten them the first time you
     reordered anything. This one must go deep because a layout is
     entitled to move a stacked control somewhere else entirely. A
     `.sh-drop` wrapper counts as ONE atom even though it holds a button
     and a menu: moving the button out from under its menu would leave
     the popup positioned against nothing. */
  function rbnAtoms(g){
    var out=[],lab=g.querySelector('.rbn-lab');
    (function walk(node){
      [].slice.call((node&&node.children)||[]).forEach(function(el){
        if(el===lab) return;
        if(el.id){out.push(el);return;}
        walk(el);
      });
    })(g.querySelector('.rbn-row')||g);
    return out;
  }
  /* every atom on the ribbon right now, by id */
  function rbnAllAtoms(){
    var bar=$('#edit-tools'),out={};
    if(!bar) return out;
    $$('.rbn-grp',bar).forEach(function(g){
      rbnAtoms(g).forEach(function(el){out[el.id]=el;});
    });
    return out;
  }
  /* THE SNAPSHOT. Taken once, before the first layout is applied, and
     recorded as "these containers had exactly these children, in this
     order" — which is restorable exactly, unlike a list of moves. */
  function rbnHome(){
    if(RBN_HOME) return RBN_HOME;
    var bar=$('#edit-tools'); if(!bar) return null;
    var groups=$$('.rbn-grp',bar);
    var holders=[],parents=[];
    function hold(p){
      if(!p||parents.indexOf(p)>=0) return;
      parents.push(p);
      holders.push({el:p,kids:[].slice.call(p.children)});
    }
    groups.forEach(function(g){
      hold(g.parentNode);
      rbnAtoms(g).forEach(function(el){hold(el.parentNode);});
    });
    RBN_HOME={
      holders:holders,
      tabs:TABS.slice(),
      /* THE TAB SET IS A CONTAINER, and the snapshot has to reach
         into it (T151). T139 wrapped the four markup tabs in
         <span class="rbn-tabset" role="tablist"> so the layouts chooser
         beside them stopped reading as a fifth tab -- but this snapshot
         only ever took the strip's ELEMENT CHILDREN, which after that
         change is the span itself and not the buttons inside it. Restore
         then removed every .rbn-tab (a descendant query, so it reached
         through the span) and appended back a set that no longer
         contained them, and applyRibbonLayout runs at boot: the deck
         came up with an empty tablist and no tabs at all. */
      strip:(function(){
        var s=$('#rbn-tabs');
        return s?{el:s,kids:[].slice.call(s.children)}:null;
      })(),
      tabset:(function(){
        var s=$('.rbn-tabset');
        return s?{el:s,kids:[].slice.call(s.children)}:null;
      })(),
      groupTabs:groups.map(function(g){
        return {el:g,tab:g.getAttribute('data-tab')};}),
    };
    return RBN_HOME;
  }
  /* put the markup back, exactly */
  function rbnRestoreHome(){
    var h=rbnHome(); if(!h) return;
    var bar=$('#edit-tools');
    if(bar) $$('.rbn-lay',bar).forEach(function(g){g.remove();});
    h.holders.forEach(function(x){
      x.kids.forEach(function(k){x.el.appendChild(k);});
    });
    h.groupTabs.forEach(function(x){
      if(x.tab) x.el.setAttribute('data-tab',x.tab);
    });
    if(h.strip){
      /* Generated layouts build their own tab buttons. Remove those before
         the saved markup is appended, or custom -> Default leaves both sets
         in the strip (including duplicate ids). Non-tab children are the
         permanent layout chooser, hint, spring and fold button; appending
         their saved nodes restores their exact order. */
      $$('.rbn-tab',h.strip.el).forEach(function(b){b.remove();});
      h.strip.kids.forEach(function(k){h.strip.el.appendChild(k);});
    }
    /* ...and the markup tabs go back INSIDE the tablist, not merely
       back into the strip (T151). The removal above is a descendant
       query, so it empties the tabset too; without this the four tabs
       are gone for the rest of the session. */
    if(h.tabset){
      h.tabset.kids.forEach(function(k){h.tabset.el.appendChild(k);});
    }
    TABS=h.tabs.slice();
  }
  /* THE FAMILIES, and why the gallery needs them at all. Eighteen cards
     were a page you could read; a hundred are a wall. A family is the
     one word that says what a card is FOR before you read it — and it
     is also the honest answer to "why are there five of these that look
     the same": because they are a family whose members differ by one
     decision, which is a thing that was asked for by name. */
  var RBN_FAMILIES=[
    ['default','As it ships'],
    ['familiar','Shapes you already know'],
    ['principles','Organised by one idea'],
    ['web','Web tools'],
    ['radical','Experiments']
  ];
  function rbnFamilyLabel(k){
    var hit='Other';
    RBN_FAMILIES.forEach(function(f){if(f[0]===k) hit=f[1];});
    return hit;
  }
  function rbnLayouts(){
    return [{id:'default',name:'Default',
      blurb:'The arrangement the app ships with: Home, Insert, Design, Animation, View, and a contextual Object tab.',
      selTab:'object',fromMarkup:true,family:'default',
      tabs:[{id:'home',label:'Home'},{id:'images',label:'Images'},
            {id:'text',label:'Text'},
            {id:'design',label:'Design'},{id:'animation',label:'Animation'},
            {id:'view',label:'View'},{id:'present',label:'Present'},{id:'object',label:'Object'}],
      groups:[]}].concat(RIBBON_LAYOUTS||[]);
  }
  function rbnLayoutById(id){
    var hit=null;
    rbnLayouts().forEach(function(l){if(l.id===id) hit=l;});
    return hit;
  }
  function rbnCurrentId(){
    if(rbnLayoutId===null){
      var s='';
      try{s=localStorage.getItem(RIBBON_LAYOUT_KEY)||'';}catch(e){}
      if(s&&!rbnLayoutById(s)){
        /* the catalogue was cut to nine (T139): a stored id from the
           old hundred lands on Default, said out loud once */
        try{localStorage.removeItem(RIBBON_LAYOUT_KEY);}catch(e){}
        setTimeout(function(){
          if(typeof toast==='function')
            toast('The toolbar arrangement you had chosen was retired '
              +'\u2014 you are on Default now. Ribbon layouts holds '
              +'the nine that stayed.');},600);
        s='';
      }
      rbnLayoutId=s||'default';
    }
    return rbnLayoutId;
  }
  /* WHERE A SELECTION SENDS YOU — read by showFmt, which must not care
     which layout is on. */
  function ribbonSelTab(){
    var l=rbnLayoutById(rbnCurrentId());
    var t=(l&&l.selTab)||'home';
    return TABS.indexOf(t)>=0?t:TABS[0];
  }
  function syncRibbonLayoutDoor(){
    var b=$('#rbn-layouts'); if(!b) return;
    var lay=rbnLayoutById(rbnCurrentId());
    var name=(lay&&lay.name)||'Default';
    b.title='Choose a different arrangement of the ribbon. Current: '+name;
    b.setAttribute('aria-label','Ribbon layouts. Current: '+name);
  }
  function rbnOverflowNotice(bar){
    var clipped=!!(bar&&!deckEl.classList.contains('rbn-side')
      &&bar.clientWidth&&bar.scrollWidth>bar.clientWidth+1);
    /* A gallery sits above the deck's stacking context, so a deck toast
       would be hidden behind it. When the chooser is open, put the remedy
       in the chooser itself; callers without a gallery still get a toast. */
    var note=$('#rbn-gal-warn');
    if(note) note.hidden=!clipped;
    return clipped;
  }
  function initRibbonLayoutDoor(){
    var b=$('#rbn-layouts'); if(!b) return;
    b.addEventListener('click',function(e){
      e.stopPropagation();
      /* A folded ribbon has no measured bottom, so unfold it before the
         gallery positions itself beneath the arrangement being previewed. */
      if(typeof ribbonFolded==='function'&&ribbonFolded())
        setRibbonFold(false);
      openRibbonGallery();
    });
    syncRibbonLayoutDoor();
  }
  /* the tab strip, built from whichever layout is on. The markup's own
     buttons carry tooltips worth keeping, so Default gets them back
     verbatim rather than regenerated. */
  function rbnBuildTabs(lay){
    var strip=$('#rbn-tabs'); if(!strip) return;
    $$('.rbn-tab',strip).forEach(function(b){b.remove();});
    /* into the TABSET, so a generated layout's tabs sit inside the
       tablist exactly as the markup ones do (T151). Built as siblings
       of it they left role="tablist" wrapping nothing, which is the
       very thing T139 set out to fix. */
    var set=$('.rbn-tabset',strip)||strip;
    var before=(set===strip)?strip.firstChild:null;
    lay.tabs.forEach(function(t){
      var b=document.createElement('button');
      b.className='rbn-tab';b.type='button';
      b.id='rbn-tab-'+t.id;
      b.setAttribute('role','tab');
      b.dataset.tab=t.id;
      b.setAttribute('aria-selected','false');
      b.textContent=t.label;
      if(t.title) b.title=t.title;
      if(before) set.insertBefore(b,before); else set.appendChild(b);
    });
  }
  function rbnMakeGroup(lay,g){
    var el=document.createElement('span');
    /* the layout's own id in the class, so T11's ribbonGroupId gives
       each generated group a name of its own — and `rbn-lay` is listed
       in RBN_GENERIC, or every one of them would answer to it and one
       group's saved order would be applied to all of them, which is the
       exact bug T11 shipped once already. Namespaced by LAYOUT as well,
       so tidying one layout leaves the others alone. */
    el.className='rbn-grp rbn-lay rbn-lg-'+lay.id+'-'+g.id;
    el.setAttribute('data-tab',g.tab);
    var row=document.createElement('span');
    row.className='rbn-row';
    el.appendChild(row);
    var lab=document.createElement('span');
    lab.className='rbn-lab';
    lab.textContent=g.label;
    el.appendChild(lab);
    return el;
  }
  /* A CONTROL INSIDE A WINDOW (T177). The catalogue names Bold; Bold
     lives inside the Font window now, and the WINDOW is the atom. So a
     name the ribbon no longer carries at the top level resolves to the
     window holding it, and the window lands where the layout put the
     first of its members -- Font goes where Bold went, Paragraph where
     Bullets went, Line where Style went. The catalogue keeps its old
     vocabulary, and a layout written before the windows still places
     every control it names. */
  function rbnResolve(cid,atoms){
    if(atoms[cid]) return atoms[cid];
    var el=document.getElementById(cid);
    /* a strip lives in its frame with its Show-all door (T203); the
       frame is what moves */
    /* ...and a segmented run (T209): a layout that names fmt-bold moves
       the B I U run it sits in, not one letter out of it */
    var w=(el&&el.closest)?el.closest('.opt-drop,.strip-frame,.rbn-cell'):null;
    return (w&&atoms[w.id])||null;
  }
  /* WHAT A LAYOUT DID NOT SAY. A control the catalogue has never heard
     of — one added by a later version — must still land somewhere a
     person can find it, so every layout names one group as the place
     strays go. Silently dropping it would be a button that vanished
     when you changed layout, which is the one failure that would make
     nobody trust the feature. */
  function rbnRestGroup(lay){
    var hit=null;
    (lay.groups||[]).forEach(function(g){if(!hit&&g.rest) hit=g;});
    return hit||(lay.groups||[])[0]||null;
  }
  function applyRibbonLayout(id,quiet){
    var bar=$('#edit-tools'); if(!bar) return;
    rbnHome();                       /* snapshot before the first move */
    /* a folded group has its row inside a popover; the snapshot's
       holders are the rows themselves, so unfold before moving (T187) */
    if(typeof rbnUnfoldAll==='function') rbnUnfoldAll();
    var lay=rbnLayoutById(id)||rbnLayoutById('default');
    rbnRestoreHome();                /* always start from the markup */
    rbnLayoutId=lay.id;
    try{
      if(lay.id==='default') localStorage.removeItem(RIBBON_LAYOUT_KEY);
      else localStorage.setItem(RIBBON_LAYOUT_KEY,lay.id);
    }catch(e){}
    if(!lay.fromMarkup){
      rbnBuildTabs(lay);
      TABS=lay.tabs.map(function(t){return t.id;});
      var atoms=rbnAllAtoms(),used={},host=rbnHome().holders[0].el;
      var made={};
      (lay.groups||[]).forEach(function(g){
        var el=rbnMakeGroup(lay,g);
        made[g.id]=el;
        host.appendChild(el);
        var row=el.querySelector('.rbn-row');
        (g.items||[]).forEach(function(cid){
          var a=rbnResolve(cid,atoms);
          if(!a||used[a.id]) return;
          used[a.id]=1;
          row.appendChild(a);
        });
      });
      var rest=rbnRestGroup(lay);
      var restRow=rest&&made[rest.id]
        ?made[rest.id].querySelector('.rbn-row'):null;
      if(restRow) Object.keys(atoms).forEach(function(cid){
        if(!used[cid]) restRow.appendChild(atoms[cid]);
      });
    }
    /* the tab you were on may not exist in this layout */
    if(TABS.indexOf(activeTab())<0){
      curTab=TABS[0];
      try{lsSet(tabKey(),curTab);}catch(e){}
    }
    applyRibbonPrefs();      /* T11's hiding and ordering, on top */
    /* THROUGH showFmt, not straight to syncRibbonGroups. The contextual
       controls' visibility is recomputed for whatever is selected right
       now — without it, a control that had never been through showFmt
       kept its markup state, an all-contextual group looked occupied,
       and the tab that should have been dropped stayed in the strip
       until the first time you clicked something (2026-08-25, found in
       a browser). showFmt ends by calling syncRibbonGroups itself. */
    if(typeof showFmt==='function') showFmt();
    else syncRibbonGroups();
    syncRibbonLayoutDoor();
    /* The fit ladder has deliberately exhausted every non-destructive
       rung at this point. Some experimental layouts put so many controls
       in one group that the horizontal ribbon still cannot fit; say so
       and name the existing remedy instead of clipping buttons silently. */
    var clipped=rbnOverflowNotice(bar);
    if(clipped&&!$('#rbn-gal-warn'))
      toast('This ribbon layout is wider than the window \u2014 '
        +'turn on Side toolbar to reach all of it.');
    else if(!quiet) toast('Ribbon layout: '+lay.name);
  }
  /* WHAT A LAYOUT MISSED, for the tests to read. Reports; changes
     nothing — the same split validate_deck makes against the loader. */
  function ribbonLayoutAudit(id){
    var lay=rbnLayoutById(id);
    if(!lay) return {ok:false,why:'no such layout'};
    var atoms=rbnAllAtoms(),seen={},dup=[],unknown=[];
    (lay.groups||[]).forEach(function(g){
      (g.items||[]).forEach(function(cid){
        var r=rbnResolve(cid,atoms);
        /* a member of a window is placed BY its window: naming two of
           them is not naming one control twice (T177) */
        if(r&&r.id!==cid){seen[r.id]=1;return;}
        if(seen[cid]) dup.push(cid);
        seen[cid]=1;
        if(!r) unknown.push(cid);
      });
    });
    var missing=Object.keys(atoms).filter(function(cid){
      return !seen[cid];});
    var rests=(lay.groups||[]).filter(function(g){return !!g.rest;});
    return {ok:!dup.length&&!unknown.length&&rests.length===1,
      id:lay.id,dup:dup,unknown:unknown,missing:missing,
      rests:rests.length,groups:(lay.groups||[]).length,
      tabs:(lay.tabs||[]).length};
  }

  /* ---- THE GALLERY -----------------------------------------------------
     Sixteen names in a menu tells you nothing: the thing you are choosing
     between IS an arrangement, so the card shows the arrangement — every
     tab, and the groups on it. And picking one APPLIES it and leaves the
     gallery open, because the ask was to flick through a pile and see
     what works, and a chooser that closes on every choice turns that into
     sixteen round trips. */
  function rbnGalleryClose(){
    var ov=$('#rbn-gallery');
    if(ov) ov.remove();
    window.removeEventListener('resize',rbnGalleryPlace);
    document.removeEventListener('keydown',rbnGalleryKey,true);
  }
  /* ESCAPE, and why the decision has to be made HERE. A filter with a
     word still in it is a state you can be stuck in — the card you want
     is not on screen and Escape is the key everyone reaches for — so the
     first Escape empties the box and only the second closes the panel.
     The obvious place to say that is a keydown handler on the input
     itself, and it would never run: this listener is on document in the
     CAPTURE phase, so it sees the key first and stops it dead. Written
     there once, it was dead code — Escape closed the gallery and left
     the filter still holding the word (2026-08-25, found in a browser;
     no string in the page could have shown it). */
  function rbnGalleryKey(e){
    var ov=$('#rbn-gallery'); if(!ov) return;
    if(e.key!=='Escape') return;
    e.preventDefault();e.stopPropagation();
    var fi=ov.querySelector('#rbn-gal-find');
    if(fi&&fi.value){fi.value='';rbnGalleryFill();fi.focus();return;}
    rbnGalleryClose();
  }
  /* IT MUST NOT COVER THE RIBBON. Every other overlay in this app takes
     the whole screen, and that is right for them — you are reading a map
     or a diff. Here the thing you are choosing IS the ribbon, and an
     overlay across it would hide the only evidence you have. So the
     panel starts below the row, measured rather than guessed, and
     re-measured after every apply because a layout changes how tall the
     ribbon is (2026-08-25). */
  function rbnGalleryPlace(){
    var ov=$('#rbn-gallery'),bar=$('#edit-tools');
    if(!ov||!bar) return;
    var side=deckEl.classList.contains('rbn-side');
    var anchor=side?$('#rbn-tabs'):bar;
    var r=(anchor||bar).getBoundingClientRect();
    ov.style.top=Math.max(0,Math.round(r.bottom))+'px';
    var br=bar.getBoundingClientRect();
    ov.style.right=side
      ?Math.max(0,Math.round(window.innerWidth-br.left))+'px':'0px';
  }
  /* the words a card answers to when you type in the filter: its name,
     what it is for, its family, and the labels of the tabs and groups it
     would give you — because "which one puts Crop somewhere sensible" is
     what somebody scrolling a hundred cards is actually asking. */
  function rbnCardWords(lay){
    var w=[lay.name,lay.blurb||'',rbnFamilyLabel(lay.family||'')];
    (lay.tabs||[]).forEach(function(t){w.push(t.label);});
    (lay.groups||[]).forEach(function(g){w.push(g.label);});
    return w.join(' ').toLowerCase();
  }
  function rbnGalleryFill(){
    var ov=$('#rbn-gallery'); if(!ov) return;
    var host=ov.querySelector('#rbn-gal-list');
    host.innerHTML='';
    var now=rbnCurrentId();
    var fi=ov.querySelector('#rbn-gal-find');
    var qy=((fi&&fi.value)||'').trim().toLowerCase();
    var all=rbnLayouts();
    var shown=all.filter(function(lay){
      return !qy||rbnCardWords(lay).indexOf(qy)>=0;});
    var cnt=ov.querySelector('#rbn-gal-count');
    if(cnt) cnt.textContent=qy?(shown.length+' of '+all.length)
      :(all.length+' layouts');
    if(!shown.length){
      var none=document.createElement('div');
      none.className='rbn-gnone';
      none.textContent='No layout matches that.';
      host.appendChild(none);
      return;
    }
    /* headed by family, in the order RBN_FAMILIES lists them, so the
       conventional ones come before the experiments however the
       catalogue itself happens to be sorted */
    var order=RBN_FAMILIES.map(function(f){return f[0];});
    var seen={};
    shown.forEach(function(l){seen[l.family||'radical']=1;});
    var fams=order.filter(function(k){return seen[k];});
    Object.keys(seen).forEach(function(k){
      if(order.indexOf(k)<0) fams.push(k);});
    fams.forEach(function(fam){
      var mine=shown.filter(function(l){
        return (l.family||'radical')===fam;});
      if(!mine.length) return;
      var h=document.createElement('div');
      h.className='rbn-gfam';
      h.textContent=rbnFamilyLabel(fam)+' · '+mine.length;
      host.appendChild(h);
      var grid=document.createElement('div');
      grid.className='rbn-ggrid';
      host.appendChild(grid);
      mine.forEach(function(lay){rbnCard(grid,lay,now);});
    });
  }
  /* ONE CARD. Split out of the fill loop when the gallery grew family
     headings: the cards are built into a per-family grid now, not into
     one flat list. */
  function rbnCard(host,lay,now){
    var card=document.createElement('button');
    card.className='rbn-card'+(lay.id===now?' on':'');
    card.type='button';
    var h=document.createElement('span');
    h.className='rbn-cname';h.textContent=lay.name;
    card.appendChild(h);
    var b=document.createElement('span');
    b.className='rbn-cblurb';b.textContent=lay.blurb||'';
    card.appendChild(b);
    var prev=document.createElement('span');
    prev.className='rbn-cprev';
    (lay.tabs||[]).forEach(function(t){
      var trow=document.createElement('span');
      trow.className='rbn-ctab';
      var tl=document.createElement('span');
      tl.className='rbn-ctabl';tl.textContent=t.label;
      trow.appendChild(tl);
      var gs=(lay.groups||[]).filter(function(g){return g.tab===t.id;});
      if(!gs.length&&lay.fromMarkup){
        /* Default's groups live in the markup, not in the catalogue */
        var d=document.createElement('span');
        d.className='rbn-cgrp rbn-cgrp-dim';
        d.textContent='as it ships';
        trow.appendChild(d);
      }
      gs.forEach(function(g){
        var c=document.createElement('span');
        c.className='rbn-cgrp';c.textContent=g.label;
        c.title=(g.items||[]).length+' control'
          +((g.items||[]).length===1?'':'s');
        trow.appendChild(c);
      });
      prev.appendChild(trow);
    });
    card.appendChild(prev);
    card.addEventListener('click',function(){
      applyRibbonLayout(lay.id,true);
      rbnGalleryFill();
      rbnGalleryPlace();
    });
    host.appendChild(card);
  }
  function openRibbonGallery(){
    rbnGalleryClose();
    var ov=document.createElement('div');
    ov.className='rbn-gallery';ov.id='rbn-gallery';
    ov.innerHTML='<div class="rbn-gh">'
      +'<span class="rbn-gt">Ribbon layouts</span>'
      +'<span class="rbn-gcount" id="rbn-gal-count"></span>'
      +'<span class="deck-spring"></span>'
      +'<input class="rbn-gfind" id="rbn-gal-find" type="search" '
      +'placeholder="Filter\u2026" aria-label="Filter the layouts">'
      +'<button class="dbtn" id="rbn-gal-close">'+bic('exit')
      +' Done</button></div>'
      +'<div class="rbn-gnote">Click one to try it — the ribbon '
      +'changes straight away and this stays open, so you can flick '
      +'through. Nothing is lost either way: every layout holds the same '
      +'controls, and <b>Default</b> puts them back exactly as they '
      +'ship.</div>'
      +'<div class="rbn-gwarn" id="rbn-gal-warn" role="status" hidden>'
      +'<span><b>This ribbon layout is wider than the window.</b> The '
      +'right-hand toolbar keeps every control reachable.</span>'
      +'<button class="dbtn" id="rbn-gal-side">'+bic('dockright')
      +' Use Side toolbar</button></div>'
      +'<div class="rbn-gal" id="rbn-gal-list"></div>';
    document.body.appendChild(ov);
    ov.querySelector('#rbn-gal-close')
      .addEventListener('click',rbnGalleryClose);
    ov.querySelector('#rbn-gal-side').addEventListener('click',function(){
      /* In the layouts that need this remedy, #vw-side itself can be one
         of the clipped controls. Its existing handler owns persistence,
         aria state, fitting and zoom, so this is a reachable second door. */
      var side=$('#vw-side'); if(side) side.click();
    });
    var gfind=ov.querySelector('#rbn-gal-find');
    gfind.addEventListener('input',rbnGalleryFill);
    /* the deck's own shortcuts must not fire while you are typing a
       filter — `g` toggles the grid, `r` the rulers. Escape is NOT
       decided here; it cannot be. See rbnGalleryKey. */
    gfind.addEventListener('keydown',function(e){e.stopPropagation();});
    rbnGalleryFill();
    rbnGalleryPlace();
    /* T261: `bar` was never declared here, and the IIFE is strict, so
       this threw a ReferenceError and the two listeners below it were
       never attached -- Escape did not close the gallery (the very
       thing rbnGalleryKey's comment says can only live here) and the
       panel did not re-place itself on resize. */
    rbnOverflowNotice($('#edit-tools'));
    window.addEventListener('resize',rbnGalleryPlace);
    document.addEventListener('keydown',rbnGalleryKey,true);
  }

  /* ---- THE CATALOGUE ---------------------------------------------------
     Data only. Each entry: an id, a name for the menu, a blurb saying
     who it is for, the tab the selection sends you to, the tabs, and the
     groups with the ids they hold. One group per layout carries
     `rest:true` — where a control this list has never heard of lands. */
  var RIBBON_LAYOUTS=[

  /* ---- THE CUT (T139 / JVUX-05, user decision 2026-09-01) ------------
     This array held 108 alternatives -- 17% of the deck editor's
     JavaScript -- including ten sub-variants each of five bases and
     imitations of two dozen other products. Each could re-home
     controls AND change where selecting an object lands you, so no
     two users shared an interface and help had nothing stable to
     describe. The user's call: keep Default plus "like 9 of the
     best". The eight below survive because each is a genuinely
     different, coherent way of working, not a permutation: the
     PowerPoint-trained hands (Office ribbon), the scope taxonomy
     (Deck, slide, object), the notebook-first workflow (Sources tab),
     frequency (Everyday first), the poster maker (Poster first), the
     board-tool feel (Canvas rail), density (Everything in one row)
     and simplicity (Ten things, then More). A stored id from the old
     hundred lands on Default, said out loud once (rbnCurrentId).
     The deleted entries are one `git log -p` away; do not re-grow
     the catalogue -- add to a layout only what its own taxonomy
     demands. */

    {id:'familiar-office-ribbon',
     name:'Office ribbon',
     blurb:'Try this first if your hands already know PowerPoint - Home, Insert, Design and Animate with the group names Office trained you on.',
     family:'familiar',
     selTab:'home',
     tabs:[{id:'home',label:'Home'},{id:'insert',label:'Insert'},{id:'design',label:'Design'},{id:'animate',label:'Animate'}],
     groups:[
      {id:'of-slides',label:'Slides',tab:'home',rest:1,
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'of-font',label:'Font',tab:'home',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-txcolwrap','fmt-stylewrap-tx','fmt-eqedit','fmt-mdedit']},
      {id:'of-para',label:'Paragraph',tab:'home',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'of-draw',label:'Drawing',tab:'home',
       items:['fmt-shapewrap','fmt-fillwrap','fmt-fillcolwrap',
         'fmt-opwrap','fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap']},
      {id:'of-pic',label:'Picture',tab:'home',
       items:['fmt-figures','fmt-replace','fmt-caption','fmt-imgrefresh',
         'fmt-revert','fmt-lockver','fmt-locate','fmt-prov',
         'fmt-cropwrap','fmt-lockar','fmt-sizepos','fmt-parts','et-cell']},
      {id:'of-tbl',label:'Table',tab:'home',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'of-arrange',label:'Arrange',tab:'home',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'of-text',label:'Text',tab:'insert',
       items:['tx-strip','dc-maths','dc-md']},
      {id:'of-illus',label:'Illustrations',tab:'insert',
       items:['et-image','shape-strip-frame','dc-line','dc-draw','et-table',
         'et-flip','et-arrow','et-cancel']},
      {id:'of-furn',label:'Page furniture',tab:'insert',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'of-setup',label:'Slide setup',tab:'design',
       items:['page-strip-frame','lay-drop','dsg-tidy','bg-drop']},
      {id:'of-type',label:'Type',tab:'design',
       items:['dsg-stylewrap','dsg-tokens','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-design-btn','dsg-std']},
      {id:'of-view',label:'View',tab:'design',
       items:['vw-rulers','vw-grid','vw-guides','vw-guidebox','vw-full',
         'vw-side','vw-check','vw-morewrap']},
      {id:'of-panes',label:'Panes',tab:'design',
       items:['objects-btn','notes-btn','vw-versions']},
      {id:'of-fx',label:'Effects',tab:'animate',
       items:['anim-strip-frame']},
      {id:'of-seq',label:'Sequence',tab:'animate',
       items:['anim-stagger','anim-together']},
      {id:'of-time',label:'Animations',tab:'animate',
       items:['vw-anim','anim-clear']},
     ]},
    {id:'scope-deck-slide-object',
     name:'Deck, slide, object',
     blurb:'Try this if you want to know before clicking whether a button changes the whole deck, just this slide, or only what you selected.',
     family:'principles',
     selTab:'object',
     tabs:[{id:'deck',label:'Deck'},{id:'slide',label:'Slide'},{id:'object',label:'Object'}],
     groups:[
      {id:'dk-page',label:'Page setup',tab:'deck',
       items:['page-strip-frame','bg-drop']},
      {id:'dk-furn',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'dk-type',label:'Type styles',tab:'deck',
       items:['dsg-stylewrap','dsg-tokens','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-design-btn','dsg-std']},
      {id:'dk-view',label:'View',tab:'deck',rest:1,
       items:['vw-rulers','vw-grid','vw-guides','vw-guidebox','vw-full',
         'vw-side','vw-morewrap']},
      {id:'dk-panes',label:'Review',tab:'deck',
       items:['vw-versions','notes-btn','vw-check']},
      {id:'sl-slides',label:'Slides',tab:'slide',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','lay-drop','dsg-tidy']},
      {id:'sl-insert',label:'Insert',tab:'slide',
       items:['tx-strip','et-image','dc-maths','dc-md']},
      {id:'sl-draw',label:'Draw',tab:'slide',
       items:['shape-strip-frame','dc-line','dc-draw','et-table','et-flip',
         'et-arrow','et-cancel']},
      {id:'sl-anim',label:'Build order',tab:'slide',
       items:['vw-anim','anim-strip-frame','anim-stagger','anim-together','anim-clear']},
      {id:'ob-arrange',label:'Arrange',tab:'object',
       items:['objects-btn','fmt-dup','fmt-group','fmt-ungroup',
         'fmt-alignwrap','fmt-samewrap','fmt-arline','fmt-argrid',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr']},
      {id:'ob-text',label:'Text',tab:'object',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-mdedit']},
      {id:'ob-para',label:'Paragraph',tab:'object',
       items:['fmt-bullets','fmt-numbers','fmt-indent','fmt-outdent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'ob-colour',label:'Colour',tab:'object',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'ob-line',label:'Line and shape',tab:'object',
       items:['fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-fillwrap','fmt-shapewrap']},
      {id:'ob-source',label:'Figure source',tab:'object',
       items:['fmt-figures','fmt-lockver','fmt-imgrefresh','fmt-replace',
         'fmt-caption','fmt-locate','fmt-prov','fmt-revert',
         'fmt-cropwrap','fmt-lockar','fmt-sizepos','fmt-parts','et-cell']},
      {id:'ob-table',label:'Table',tab:'object',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
     ]},
    {id:'sources-own-tab',
     name:'Sources tab',
     blurb:'Try this if your figures come from a live notebook: a whole tab for where content came from and whether it is still fresh.',
     family:'principles',
     selTab:'format',
     tabs:[{id:'slides',label:'Slides'},{id:'sources',label:'Sources'},{id:'format',label:'Format'},{id:'deck',label:'Deck'}],
     groups:[
      {id:'s1-slides',label:'Slides',tab:'slides',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','lay-drop','dsg-tidy']},
      {id:'s1-anim',label:'Animate',tab:'slides',
       items:['vw-anim','anim-strip-frame','anim-stagger','anim-together','anim-clear']},
      {id:'s1-view',label:'View',tab:'slides',rest:1,
       items:['vw-full','vw-side','vw-morewrap','notes-btn']},
      {id:'s1-link',label:'Notebook link',tab:'sources',
       items:['fmt-figures','fmt-locate','fmt-prov','fmt-replace',
         'fmt-caption','fmt-lockver','et-cell']},
      {id:'s1-fresh',label:'Freshness',tab:'sources',
       items:['fmt-imgrefresh','fmt-revert','vw-versions',
         'vw-check']},
      {id:'s1-frame',label:'Frame',tab:'sources',
       items:['et-image','fmt-cropwrap','fmt-lockar','fmt-sizepos',
         'fmt-parts']},
      {id:'s1-typed',label:'Typed content',tab:'sources',
       items:['tx-strip','dc-maths','dc-md']},
      {id:'s1-drawn',label:'Drawn content',tab:'sources',
       items:['shape-strip-frame','dc-line','dc-draw','et-table','et-flip',
         'et-arrow','et-cancel']},
      {id:'s1-guides',label:'Guides and layers',tab:'format',
       items:['vw-rulers','vw-grid','vw-guides','vw-guidebox',
         'objects-btn']},
      {id:'s1-text',label:'Text',tab:'format',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-mdedit']},
      {id:'s1-para',label:'Paragraph',tab:'format',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'s1-colour',label:'Colour',tab:'format',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'s1-lineshape',label:'Line and shape',tab:'format',
       items:['fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-fillwrap','fmt-shapewrap']},
      {id:'s1-arrange',label:'Arrange',tab:'format',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'s1-table',label:'Table',tab:'format',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'s1-page',label:'Page',tab:'deck',
       items:['page-strip-frame','bg-drop']},
      {id:'s1-type',label:'Type',tab:'deck',
       items:['dsg-stylewrap','dsg-tokens','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-design-btn','dsg-std']},
      {id:'s1-furn',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
     ]},
    {id:'density-everyday-first',
     name:'Everyday first',
     blurb:'Try this if the deck gets handed to colleagues who only ever do six things: fifteen everyday buttons, a Format tab that fills itself in, and one drawer for the rest.',
     family:'principles',
     selTab:'format',
     tabs:[{id:'start',label:'Everyday'},{id:'format',label:'Format'},{id:'more',label:'Everything else'}],
     groups:[
      {id:'day-slides',label:'Slides',tab:'start',
       items:['hm-newslide','hm-dupslide','hm-delslide','hm-laywrap',
         'vw-versions']},
      {id:'day-insert',label:'Insert',tab:'start',
       items:['tx-strip','et-image','shape-strip-frame','dc-line','et-table',
         'et-flip','et-arrow','et-cancel']},
      {id:'day-look',label:'Deck look',tab:'start',
       items:['lay-drop','dsg-tidy','bg-drop','dsg-stylewrap','dsg-tokens']},
      {id:'day-show',label:'Present',tab:'start',
       items:['vw-full','notes-btn']},
      {id:'day-text',label:'Text',tab:'format',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-mdedit','fmt-bullets','fmt-numbers',
         'fmt-outdent','fmt-indent','fmt-lhwrap','fmt-parawrap']},
      {id:'day-colour',label:'Colour and fill',tab:'format',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'day-line-shape',label:'Line and shape',tab:'format',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-fillwrap']},
      {id:'day-arrange',label:'Arrange',tab:'format',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'day-sources',label:'Frames and sources',tab:'format',
       items:['fmt-figures','fmt-replace','fmt-caption','fmt-locate',
         'fmt-prov','fmt-imgrefresh','fmt-revert','fmt-lockver',
         'fmt-parts','fmt-cropwrap','fmt-lockar','fmt-sizepos','et-cell']},
      {id:'day-table',label:'Table',tab:'format',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'day-anim',label:'Animation',tab:'format',
       items:['vw-anim','anim-strip-frame','anim-stagger','anim-together','anim-clear']},
      {id:'day-page',label:'Page and furniture',tab:'more',
       items:['page-strip-frame','dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'day-deck-styling',label:'Deck styling',tab:'more',
       items:['dsg-scale-down','dsg-scale-up','dsg-restyle','dsg-design-btn','dsg-std',
         'hm-match']},
      {id:'day-maths',label:'Other inserts',tab:'more',
       items:['dc-maths','dc-md','dc-draw']},
      {id:'day-workspace',label:'Workspace',tab:'more',rest:1,
       items:['vw-rulers','vw-grid','vw-guides','vw-guidebox','vw-side',
         'vw-check','objects-btn','vw-morewrap']},
     ]},
    {id:'journey-poster-first',
     name:'Poster first',
     blurb:'Try this for A0 posters and other one-page work: page setup, guides and Review lead, and everything that only exists for a talk is quarantined.',
     family:'principles',
     selTab:'content',
     tabs:[{id:'page',label:'Page'},{id:'content',label:'Content'},{id:'talk',label:'Talk'}],
     groups:[
      {id:'j3-page',label:'Page',tab:'page',
       items:['page-strip-frame','bg-drop','lay-drop','dsg-tidy']},
      {id:'j3-furniture',label:'Page furniture',tab:'page',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'j3-type',label:'Type',tab:'page',
       items:['dsg-stylewrap','dsg-tokens','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-design-btn','dsg-std']},
      {id:'j3-guides',label:'Workspace',tab:'page',rest:1,
       items:['vw-rulers','vw-grid','vw-guides','vw-guidebox','vw-side',
         'vw-morewrap','objects-btn']},
      {id:'j3-proof',label:'Proof and versions',tab:'page',
       items:['vw-check','vw-versions']},
      {id:'j3-insert',label:'Insert',tab:'content',
       items:['tx-strip','et-image','dc-maths','dc-md','shape-strip-frame','dc-line',
         'dc-draw','et-table','et-flip','et-arrow','et-cancel']},
      {id:'j3-figures',label:'Figure source',tab:'content',
       items:['fmt-figures','fmt-replace','fmt-caption','fmt-imgrefresh',
         'fmt-locate','fmt-prov','fmt-revert','fmt-lockver','et-cell']},
      {id:'j3-text',label:'Text',tab:'content',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-mdedit']},
      {id:'j3-para',label:'Paragraph',tab:'content',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'j3-fill',label:'Colour and line',tab:'content',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap',
         'fmt-fillwrap','fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-shapewrap']},
      {id:'j3-arrange',label:'Arrange',tab:'content',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-parts',
         'fmt-cropwrap','fmt-lockar','fmt-sizepos','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward','fmt-rotl',
         'fmt-rotr','fmt-arline','fmt-argrid','fmt-samewrap']},
      {id:'j3-table',label:'Table',tab:'content',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'j3-slides',label:'Slides',tab:'talk',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'j3-buildorder',label:'Build order',tab:'talk',
       items:['vw-anim','anim-stagger','anim-together','anim-clear']},
      {id:'j3-effects',label:'Effects',tab:'talk',
       items:['anim-strip-frame']},
      {id:'j3-delivery',label:'Delivery',tab:'talk',
       items:['notes-btn','vw-full']},
     ]},
    {id:'density-one-row',
     name:'Everything in one row',
     blurb:'Try this if tabs themselves are the problem: all 94 controls on a single row, ruthlessly clustered, nothing hidden behind a tab you are not on.',
     family:'principles',
     selTab:'all',
     tabs:[{id:'all',label:'All tools'}],
     groups:[
      {id:'one-slides',label:'Slides',tab:'all',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','lay-drop','dsg-tidy','page-strip-frame','bg-drop','dc-wmark',
         'dc-head','dc-foot','dc-nums','vw-versions']},
      {id:'one-insert',label:'Insert and sources',tab:'all',
       items:['tx-strip','et-image','dc-maths','dc-md','shape-strip-frame','dc-line',
         'dc-draw','fmt-figures','fmt-replace','fmt-caption','fmt-locate',
         'fmt-prov','fmt-imgrefresh','fmt-revert','fmt-lockver',
         'fmt-parts','fmt-cropwrap','fmt-lockar','fmt-sizepos','et-cell',
         'et-table','et-flip','et-arrow','et-cancel']},
      {id:'one-text',label:'Text',tab:'all',
       items:['dsg-stylewrap','dsg-tokens','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-design-btn','dsg-std','fmt-stylewrap-tx','fmt-font',
         'fmt-szwrap','fmt-smaller','fmt-bigger','fmt-bold',
         'fmt-ital','fmt-under','fmt-strike','fmt-eqedit','fmt-mdedit',
         'fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'one-shape',label:'Shape and colour',tab:'all',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-fillwrap','fmt-txcolwrap',
         'fmt-fillcolwrap','fmt-opwrap']},
      {id:'one-arrange',label:'Arrange',tab:'all',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'one-table',label:'Table',tab:'all',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'one-view',label:'Animate and view',tab:'all',rest:1,
       items:['vw-anim','anim-strip-frame',
         'anim-stagger','anim-together','anim-clear','vw-rulers',
         'vw-grid','vw-guides','vw-guidebox','vw-full','vw-side',
         'vw-check','objects-btn','notes-btn','vw-morewrap']},
     ]},
    {id:'web-canvas-rail',
     name:'Canvas rail',
     blurb:'Try this if Miro and FigJam are home: a standing rail of making tools, a Selection tab that behaves like the bubble popping over whatever you clicked, and board-wide settings kept off both.',
     family:'web',
     selTab:'mi-sel',
     tabs:[{id:'mi-rail',label:'Tools'},{id:'mi-sel',label:'Selection'},{id:'mi-board',label:'Board'}],
     groups:[
      {id:'mi-create',label:'Create',tab:'mi-rail',rest:1,
       items:['tx-strip','shape-strip-frame','dc-line','et-arrow','dc-draw',
         'et-cancel']},
      {id:'mi-place',label:'Place',tab:'mi-rail',
       items:['et-cell','et-image','et-table','et-flip','dc-maths','dc-md',
         'dc-md']},
      {id:'mi-frames',label:'Frames',tab:'mi-rail',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'mi-bub-text',label:'Text',tab:'mi-sel',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-mdedit']},
      {id:'mi-bub-para',label:'Lists',tab:'mi-sel',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'mi-bub-colour',label:'Colour',tab:'mi-sel',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'mi-bub-style',label:'Style',tab:'mi-sel',
       items:['fmt-stylewrap','fmt-fillwrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-shapewrap']},
      {id:'mi-bub-order',label:'Order',tab:'mi-sel',
       items:['fmt-front','fmt-forward','fmt-backward','fmt-back',
         'fmt-group','fmt-ungroup','fmt-dup']},
      {id:'mi-bub-place',label:'Position',tab:'mi-sel',
       items:['fmt-alignwrap','fmt-arline','fmt-argrid',
         'fmt-samewrap','fmt-rotl','fmt-rotr']},
      {id:'mi-bub-fig',label:'Figure',tab:'mi-sel',
       items:['fmt-figures','fmt-imgrefresh','fmt-replace','fmt-caption',
         'fmt-locate','fmt-prov','fmt-revert','fmt-lockver',
         'fmt-cropwrap','fmt-lockar','fmt-sizepos','fmt-parts']},
      {id:'mi-bub-tbl',label:'Table',tab:'mi-sel',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'mi-canvas',label:'Canvas',tab:'mi-board',
       items:['lay-drop','dsg-tidy','page-strip-frame','bg-drop','vw-versions']},
      {id:'mi-furn',label:'Furniture',tab:'mi-board',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'mi-type',label:'Type',tab:'mi-board',
       items:['dsg-stylewrap','dsg-tokens','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-design-btn','dsg-std']},
      {id:'mi-view',label:'View',tab:'mi-board',
       items:['vw-rulers','vw-grid','vw-guides','vw-guidebox','vw-full',
         'vw-side','vw-check','vw-morewrap']},
      {id:'mi-panes',label:'Panes',tab:'mi-board',
       items:['objects-btn','notes-btn']},
      {id:'mi-play',label:'Play',tab:'mi-board',
       items:['vw-anim','anim-strip-frame','anim-stagger','anim-together','anim-clear']},
     ]},
    {id:'radical-ten-then-more',
     name:'Ten things, then More',
     blurb:'Ten buttons on Start \u2014 make a slide, put a figure on it, show it. Format fills in when you select something, and the rest is under More.',
     family:'radical',
     selTab:'tt-fmt',
     tabs:[{id:'tt-start',label:'Start'},{id:'tt-fmt',label:'Format'},{id:'tt-more',label:'More'}],
     groups:[
      {id:'tt-slides',label:'Slides',tab:'tt-start',
       items:['hm-newslide','hm-dupslide','hm-delslide']},
      {id:'tt-add',label:'Add',tab:'tt-start',
       items:['et-cell','tx-strip','et-image']},
      {id:'tt-look',label:'Look',tab:'tt-start',
       items:['lay-drop','dsg-tidy','bg-drop']},
      {id:'tt-show',label:'Show',tab:'tt-start',
       items:['vw-full','notes-btn']},
      {id:'tt-text',label:'Text',tab:'tt-fmt',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-txcolwrap','fmt-stylewrap-tx','fmt-bullets',
         'fmt-numbers','fmt-indent','fmt-outdent','fmt-lhwrap',
         'fmt-parawrap','fmt-eqedit','fmt-mdedit']},
      {id:'tt-col',label:'Colour',tab:'tt-fmt',
       items:['fmt-fillcolwrap','fmt-fillwrap','fmt-opwrap']},
      {id:'tt-place',label:'Place',tab:'tt-fmt',
       items:['fmt-dup','fmt-alignwrap','fmt-front','fmt-back',
         'fmt-group','fmt-ungroup','fmt-samewrap','fmt-forward',
         'fmt-backward','fmt-rotl','fmt-rotr','fmt-arline',
         'fmt-argrid']},
      {id:'tt-fig',label:'Figure',tab:'tt-fmt',
       items:['fmt-figures','fmt-imgrefresh','fmt-replace','fmt-caption',
         'fmt-locate','fmt-prov','fmt-revert','fmt-lockver',
         'fmt-cropwrap','fmt-lockar','fmt-sizepos','fmt-parts']},
      {id:'tt-tbl',label:'Table',tab:'tt-fmt',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'tt-shape',label:'Shape',tab:'tt-fmt',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap']},
      {id:'tt-ins',label:'Insert',tab:'tt-more',
       items:['et-table','et-flip','shape-strip-frame','dc-line','et-arrow',
         'dc-draw','dc-maths','dc-md','et-cancel']},
      {id:'tt-lay',label:'Slides',tab:'tt-more',
       items:['hm-laywrap','hm-match']},
      {id:'tt-page',label:'Page',tab:'tt-more',
       items:['page-strip-frame','dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'tt-type',label:'Type',tab:'tt-more',
       items:['dsg-stylewrap','dsg-tokens','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-design-btn','dsg-std']},
      {id:'tt-anim',label:'Animate',tab:'tt-more',
       items:['vw-anim','anim-strip-frame','anim-stagger','anim-together','anim-clear']},
      {id:'tt-rest',label:'The rest',tab:'tt-more',rest:1,
       items:['vw-rulers','vw-grid','vw-guides','vw-guidebox','vw-side',
         'vw-morewrap','objects-btn','vw-check','vw-versions']},
     ]}
  ];
