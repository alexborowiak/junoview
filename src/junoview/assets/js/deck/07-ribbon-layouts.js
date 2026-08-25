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
        rather than a fourteenth entry in the catalogue. Every atom's
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
        first. Every layout is the same 94 objects in a different order.

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
      strip:(function(){
        var s=$('#rbn-tabs');
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
    if(h.strip) h.strip.kids.forEach(function(k){
      h.strip.el.appendChild(k);});
    TABS=h.tabs.slice();
  }
  function rbnLayouts(){
    return [{id:'default',name:'Default',
      blurb:'The arrangement the app ships with: Home, Insert, Design.',
      selTab:'home',fromMarkup:true,
      tabs:[{id:'home',label:'Home'},{id:'insert',label:'Insert'},
            {id:'design',label:'Design'}],
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
      rbnLayoutId=rbnLayoutById(s)?s:'default';
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
  /* the tab strip, built from whichever layout is on. The markup's own
     buttons carry tooltips worth keeping, so Default gets them back
     verbatim rather than regenerated. */
  function rbnBuildTabs(lay){
    var strip=$('#rbn-tabs'); if(!strip) return;
    $$('.rbn-tab',strip).forEach(function(b){b.remove();});
    var before=strip.firstChild;
    lay.tabs.forEach(function(t){
      var b=document.createElement('button');
      b.className='rbn-tab';b.type='button';
      b.id='rbn-tab-'+t.id;
      b.setAttribute('role','tab');
      b.dataset.tab=t.id;
      b.setAttribute('aria-selected','false');
      b.textContent=t.label;
      if(t.title) b.title=t.title;
      strip.insertBefore(b,before);
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
          var a=atoms[cid];
          if(!a||used[cid]) return;
          used[cid]=1;
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
    if(!quiet) toast('Ribbon layout: '+lay.name);
  }
  /* WHAT A LAYOUT MISSED, for the tests to read. Reports; changes
     nothing — the same split validate_deck makes against the loader. */
  function ribbonLayoutAudit(id){
    var lay=rbnLayoutById(id);
    if(!lay) return {ok:false,why:'no such layout'};
    var atoms=rbnAllAtoms(),seen={},dup=[],unknown=[];
    (lay.groups||[]).forEach(function(g){
      (g.items||[]).forEach(function(cid){
        if(seen[cid]) dup.push(cid);
        seen[cid]=1;
        if(!atoms[cid]) unknown.push(cid);
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
  function rbnGalleryKey(e){
    if(!$('#rbn-gallery')) return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();rbnGalleryClose();}
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
    var r=bar.getBoundingClientRect();
    ov.style.top=Math.max(0,Math.round(r.bottom))+'px';
  }
  function rbnGalleryFill(){
    var ov=$('#rbn-gallery'); if(!ov) return;
    var host=ov.querySelector('#rbn-gal-list');
    host.innerHTML='';
    var now=rbnCurrentId();
    rbnLayouts().forEach(function(lay){
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
    });
  }
  function openRibbonGallery(){
    rbnGalleryClose();
    var ov=document.createElement('div');
    ov.className='rbn-gallery';ov.id='rbn-gallery';
    ov.innerHTML='<div class="rbn-gh">'
      +'<span class="rbn-gt">Ribbon layouts</span>'
      +'<span class="deck-spring"></span>'
      +'<button class="dbtn" id="rbn-gal-close">'+bic('exit')
      +' Done</button></div>'
      +'<div class="rbn-gnote">Click one to try it — the ribbon '
      +'changes straight away and this stays open, so you can flick '
      +'through. Nothing is lost either way: every layout holds the same '
      +'controls, and <b>Default</b> puts them back exactly as they '
      +'ship.</div>'
      +'<div class="rbn-gal" id="rbn-gal-list"></div>';
    document.body.appendChild(ov);
    ov.querySelector('#rbn-gal-close')
      .addEventListener('click',rbnGalleryClose);
    rbnGalleryFill();
    rbnGalleryPlace();
    window.addEventListener('resize',rbnGalleryPlace);
    document.addEventListener('keydown',rbnGalleryKey,true);
  }

  /* ---- THE CATALOGUE ---------------------------------------------------
     Data only. Each entry: an id, a name for the menu, a blurb saying
     who it is for, the tab the selection sends you to, the tabs, and the
     groups with the ids they hold. One group per layout carries
     `rest:true` — where a control this list has never heard of lands. */
  var RIBBON_LAYOUTS=[
    {id:'familiar-office-ribbon',
     name:'Office ribbon',
     blurb:'Try this first if your hands already know PowerPoint - Home, Insert, Design and Animate with the group names Office trained you on.',
     selTab:'home',
     tabs:[{id:'home',label:'Home'},{id:'insert',label:'Insert'},{id:'design',label:'Design'},{id:'animate',label:'Animate'}],
     groups:[
      {id:'of-slides',label:'Slides',tab:'home',rest:1,
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'of-font',label:'Font',tab:'home',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-txcolwrap','fmt-stylewrap-tx','fmt-eqedit']},
      {id:'of-para',label:'Paragraph',tab:'home',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'of-draw',label:'Drawing',tab:'home',
       items:['fmt-shapewrap','fmt-fillwrap','fmt-fillcolwrap',
         'fmt-opwrap','fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap']},
      {id:'of-pic',label:'Picture',tab:'home',
       items:['fmt-figures','fmt-replace','fmt-imgrefresh',
         'fmt-revert','fmt-lockver','fmt-locate','fmt-cropwrap',
         'fmt-parts','et-cell']},
      {id:'of-tbl',label:'Table',tab:'home',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'of-arrange',label:'Arrange',tab:'home',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'of-text',label:'Text',tab:'insert',
       items:['tx-drop','dc-maths','dc-qr']},
      {id:'of-illus',label:'Illustrations',tab:'insert',
       items:['et-image','sh-drop','dc-line','dc-draw','et-cancel',
         'et-table','et-flip','et-arrow']},
      {id:'of-furn',label:'Page furniture',tab:'insert',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'of-setup',label:'Slide setup',tab:'design',
       items:['page-drop','lay-drop','bg-drop']},
      {id:'of-type',label:'Type',tab:'design',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'of-view',label:'View',tab:'design',
       items:['vw-rulers','vw-grid','vw-full','vw-side','vw-check',
         'vw-morewrap']},
      {id:'of-panes',label:'Panes',tab:'design',
       items:['objects-btn','notes-btn','vw-versions']},
      {id:'of-fx',label:'Effects',tab:'animate',
       items:['anim-none','anim-fade','anim-rise','anim-zoom']},
      {id:'of-seq',label:'Sequence',tab:'animate',
       items:['anim-stagger','anim-together']},
      {id:'of-time',label:'Timeline',tab:'animate',
       items:['vw-anim','anim-clear']},
     ]},
    {id:'scope-deck-slide-object',
     name:'Deck, slide, object',
     blurb:'Try this if you want to know before clicking whether a button changes the whole deck, just this slide, or only what you selected.',
     selTab:'object',
     tabs:[{id:'deck',label:'Deck'},{id:'slide',label:'Slide'},{id:'object',label:'Object'}],
     groups:[
      {id:'dk-page',label:'Page setup',tab:'deck',
       items:['page-drop','bg-drop']},
      {id:'dk-furn',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'dk-type',label:'Type styles',tab:'deck',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'dk-view',label:'View',tab:'deck',rest:1,
       items:['vw-rulers','vw-grid','vw-full','vw-side',
         'vw-morewrap']},
      {id:'dk-panes',label:'Review',tab:'deck',
       items:['vw-versions','notes-btn','vw-check']},
      {id:'sl-slides',label:'Slides',tab:'slide',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','lay-drop']},
      {id:'sl-insert',label:'Insert',tab:'slide',
       items:['tx-drop','et-image','dc-maths','dc-qr']},
      {id:'sl-draw',label:'Draw',tab:'slide',
       items:['sh-drop','dc-line','dc-draw','et-cancel','et-table',
         'et-flip','et-arrow']},
      {id:'sl-anim',label:'Build order',tab:'slide',
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear']},
      {id:'ob-arrange',label:'Arrange',tab:'object',
       items:['objects-btn','fmt-dup','fmt-group','fmt-ungroup',
         'fmt-alignwrap','fmt-samewrap','fmt-arline','fmt-argrid',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr']},
      {id:'ob-text',label:'Text',tab:'object',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit']},
      {id:'ob-para',label:'Paragraph',tab:'object',
       items:['fmt-bullets','fmt-numbers','fmt-indent','fmt-outdent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'ob-colour',label:'Colour',tab:'object',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'ob-line',label:'Line and shape',tab:'object',
       items:['fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-fillwrap','fmt-shapewrap']},
      {id:'ob-source',label:'Figure source',tab:'object',
       items:['fmt-figures','fmt-lockver','fmt-imgrefresh',
         'fmt-replace','fmt-locate','fmt-revert','fmt-cropwrap',
         'fmt-parts','et-cell']},
      {id:'ob-table',label:'Table',tab:'object',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
     ]},
    {id:'familiar-slides-toolbar',
     name:'Slides toolbar',
     blurb:'Try this if you liked Google Slides: one toolbar that reshapes itself around whatever you clicked, with every deck-wide setting parked on a second tab.',
     selTab:'toolbar',
     tabs:[{id:'toolbar',label:'Toolbar'},{id:'deck',label:'Deck'}],
     groups:[
      {id:'st-slides',label:'Slides',tab:'toolbar',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'st-insert',label:'Insert',tab:'toolbar',rest:1,
       items:['tx-drop','sh-drop','dc-line','dc-draw','dc-maths',
         'dc-qr','et-cancel','et-table','et-flip','et-arrow']},
      {id:'st-figs',label:'Figures',tab:'toolbar',
       items:['et-image','fmt-figures','fmt-replace','fmt-imgrefresh',
         'fmt-revert','fmt-lockver','fmt-locate','fmt-cropwrap',
         'fmt-parts','et-cell']},
      {id:'st-text',label:'Text',tab:'toolbar',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-bullets','fmt-numbers',
         'fmt-outdent','fmt-indent','fmt-lhwrap','fmt-parawrap']},
      {id:'st-shape',label:'Shape and colour',tab:'toolbar',
       items:['fmt-shapewrap','fmt-fillwrap','fmt-fillcolwrap',
         'fmt-txcolwrap','fmt-opwrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap']},
      {id:'st-tbl',label:'Table',tab:'toolbar',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'st-arrange',label:'Arrange',tab:'toolbar',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'st-setup',label:'Slide setup',tab:'deck',
       items:['page-drop','lay-drop','bg-drop']},
      {id:'st-type',label:'Type',tab:'deck',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'st-furn',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'st-anim',label:'Animate',tab:'deck',
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear']},
      {id:'st-view',label:'View',tab:'deck',
       items:['vw-rulers','vw-grid','vw-full','vw-side','vw-check',
         'vw-morewrap']},
      {id:'st-panes',label:'Panes',tab:'deck',
       items:['objects-btn','notes-btn','vw-versions']},
     ]},
    {id:'familiar-create-and-format',
     name:'Create and format',
     blurb:'Try this if you think in inspectors like Keynote or Canva: one tab builds the deck, the other becomes the panel for whatever is selected.',
     selTab:'format',
     tabs:[{id:'create',label:'Create'},{id:'format',label:'Format'}],
     groups:[
      {id:'cf-slides',label:'Slides',tab:'create',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','vw-versions']},
      {id:'cf-design',label:'Slide design',tab:'create',
       items:['lay-drop','page-drop','bg-drop']},
      {id:'cf-type',label:'Type styles',tab:'create',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'cf-furn',label:'Page furniture',tab:'create',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'cf-insert',label:'Insert',tab:'create',rest:1,
       items:['tx-drop','sh-drop','dc-line','dc-draw','dc-maths',
         'dc-qr','et-cancel','et-table','et-flip','et-arrow']},
      {id:'cf-anim',label:'Animate',tab:'create',
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear']},
      {id:'cf-view',label:'View',tab:'create',
       items:['vw-rulers','vw-grid','vw-full','vw-side','vw-check',
         'vw-morewrap','notes-btn']},
      {id:'cf-text',label:'Text',tab:'format',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-bullets','fmt-numbers',
         'fmt-outdent','fmt-indent','fmt-lhwrap','fmt-parawrap']},
      {id:'cf-colour',label:'Colour',tab:'format',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'cf-lineshape',label:'Line and shape',tab:'format',
       items:['fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-fillwrap','fmt-shapewrap']},
      {id:'cf-figs',label:'Figures',tab:'format',
       items:['et-image','fmt-figures','fmt-replace','fmt-imgrefresh',
         'fmt-revert','fmt-lockver','fmt-locate','fmt-cropwrap',
         'fmt-parts','et-cell']},
      {id:'cf-tbl',label:'Table',tab:'format',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'cf-arrange',label:'Arrange',tab:'format',
       items:['objects-btn','fmt-dup','fmt-group','fmt-ungroup',
         'fmt-alignwrap','fmt-front','fmt-back','fmt-forward',
         'fmt-backward','fmt-rotl','fmt-rotr','fmt-arline',
         'fmt-argrid','fmt-samewrap']},
     ]},
    {id:'verbs-add-modify-show',
     name:'Add, modify, show',
     blurb:'Try this if you think in verbs: every control that changes a selected object is on one tab and nothing else is.',
     selTab:'modify',
     tabs:[{id:'add',label:'Add'},{id:'modify',label:'Modify'},{id:'show',label:'Show'}],
     groups:[
      {id:'am-slides',label:'Slides',tab:'add',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'am-draw',label:'Text and shapes',tab:'add',
       items:['tx-drop','sh-drop','dc-line','dc-draw','et-cancel',
         'et-table','et-flip','et-arrow']},
      {id:'am-media',label:'Media and maths',tab:'add',
       items:['et-image','dc-maths','dc-qr']},
      {id:'am-page',label:'Page setup',tab:'add',
       items:['lay-drop','page-drop','bg-drop']},
      {id:'am-furn',label:'Page furniture',tab:'add',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'am-text',label:'Text',tab:'modify',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-bullets','fmt-numbers','fmt-outdent',
         'fmt-indent','fmt-lhwrap','fmt-parawrap','fmt-eqedit']},
      {id:'am-colour',label:'Colour',tab:'modify',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'am-lineshape',label:'Line and shape',tab:'modify',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-fillwrap']},
      {id:'am-table',label:'Table',tab:'modify',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'am-figures',label:'Figures',tab:'modify',
       items:['fmt-figures','fmt-parts','fmt-cropwrap',
         'fmt-imgrefresh','fmt-replace','fmt-locate','fmt-revert',
         'fmt-lockver','et-cell']},
      {id:'am-arrange',label:'Arrange',tab:'modify',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'am-decktype',label:'Deck type',tab:'modify',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'am-view',label:'View',tab:'show',
       items:['vw-rulers','vw-grid','vw-full','vw-side']},
      {id:'am-panes',label:'Panes',tab:'show',
       items:['objects-btn','notes-btn','vw-versions','vw-anim']},
      {id:'am-builds',label:'Builds',tab:'show',
       items:['anim-none','anim-fade','anim-rise','anim-zoom',
         'anim-stagger','anim-together','anim-clear']},
      {id:'am-tools',label:'Tools',tab:'show',rest:1,
       items:['vw-check','vw-morewrap']},
     ]},
    {id:'scope-slides-first',
     name:'Slides first',
     blurb:'Try this when you are building the deck rather than polishing it: the whole slide lifecycle is the opening tab and nothing else is.',
     selTab:'object',
     tabs:[{id:'slides',label:'Slides'},{id:'object',label:'Object'},{id:'deck',label:'Deck'}],
     groups:[
      {id:'sf-slides',label:'Slides',tab:'slides',
       items:['hm-newslide','hm-dupslide','hm-delslide','hm-match']},
      {id:'sf-look',label:'Layout and background',tab:'slides',
       items:['hm-laywrap','lay-drop','bg-drop']},
      {id:'sf-anim',label:'Animate',tab:'slides',
       items:['anim-none','anim-fade','anim-rise','anim-zoom',
         'anim-stagger','anim-together','anim-clear']},
      {id:'sf-panes',label:'Slide panes',tab:'slides',
       items:['vw-anim','notes-btn','vw-versions']},
      {id:'sf-insert',label:'Insert',tab:'object',
       items:['tx-drop','dc-maths','dc-qr','sh-drop','dc-line',
         'dc-draw','et-cancel','et-table','et-flip','et-arrow']},
      {id:'sf-source',label:'Sources',tab:'object',
       items:['et-image','fmt-figures','fmt-lockver','fmt-imgrefresh',
         'fmt-replace','fmt-locate','fmt-revert','fmt-cropwrap',
         'fmt-parts','et-cell']},
      {id:'sf-arrange',label:'Arrange',tab:'object',
       items:['objects-btn','fmt-dup','fmt-group','fmt-ungroup',
         'fmt-alignwrap','fmt-samewrap','fmt-arline','fmt-argrid',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr']},
      {id:'sf-text',label:'Text',tab:'object',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-bullets','fmt-numbers',
         'fmt-indent','fmt-outdent','fmt-lhwrap','fmt-parawrap']},
      {id:'sf-paint',label:'Colour and line',tab:'object',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap',
         'fmt-fillwrap','fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-shapewrap']},
      {id:'sf-table',label:'Table',tab:'object',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'sf-page',label:'Page and checks',tab:'deck',
       items:['page-drop','vw-check']},
      {id:'sf-furn',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'sf-type',label:'Type styles',tab:'deck',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'sf-view',label:'View',tab:'deck',rest:1,
       items:['vw-rulers','vw-grid','vw-full','vw-side',
         'vw-morewrap']},
     ]},
    {id:'journey-outline-to-stage',
     name:'Outline to stage',
     blurb:'Try this if you work front to back - outline the deck, build the slides, design the look, rehearse the talk - and want the ribbon to follow you rightwards.',
     selTab:'build',
     tabs:[{id:'outline',label:'Outline'},{id:'build',label:'Build'},{id:'design',label:'Design'},{id:'rehearse',label:'Rehearse'}],
     groups:[
      {id:'j1-slides',label:'Slides',tab:'outline',
       items:['hm-newslide','hm-dupslide','hm-match','hm-delslide']},
      {id:'j1-slidelayout',label:'Slide layout',tab:'outline',
       items:['hm-laywrap','lay-drop']},
      {id:'j1-workspace',label:'Workspace',tab:'outline',rest:1,
       items:['vw-versions','objects-btn','vw-side','vw-rulers',
         'vw-grid']},
      {id:'j1-insert',label:'Insert',tab:'build',
       items:['tx-drop','et-image','dc-maths','dc-qr','sh-drop',
         'dc-line','dc-draw','et-cancel','et-table','et-flip',
         'et-arrow']},
      {id:'j1-source',label:'Figure source',tab:'build',
       items:['fmt-figures','fmt-replace','fmt-imgrefresh',
         'fmt-locate','fmt-revert','fmt-lockver','fmt-parts',
         'fmt-cropwrap','et-cell']},
      {id:'j1-text',label:'Text',tab:'build',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike','fmt-eqedit',
         'fmt-stylewrap-tx','fmt-bullets','fmt-numbers','fmt-outdent',
         'fmt-indent','fmt-lhwrap','fmt-parawrap']},
      {id:'j1-colour',label:'Colour',tab:'build',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'j1-lineshape',label:'Line and shape',tab:'build',
       items:['fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-fillwrap','fmt-shapewrap']},
      {id:'j1-arrange',label:'Arrange',tab:'build',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'j1-table',label:'Table',tab:'build',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'j1-type',label:'Type',tab:'design',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up']},
      {id:'j1-page',label:'Page',tab:'design',
       items:['page-drop','bg-drop']},
      {id:'j1-furniture',label:'Page furniture',tab:'design',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'j1-consistency',label:'Consistency',tab:'design',
       items:['dsg-restyle','dsg-std','vw-check']},
      {id:'j1-buildorder',label:'Build order',tab:'rehearse',
       items:['vw-anim','anim-stagger','anim-together','anim-clear']},
      {id:'j1-effects',label:'Effects',tab:'rehearse',
       items:['anim-none','anim-fade','anim-rise','anim-zoom']},
      {id:'j1-delivery',label:'Delivery',tab:'rehearse',
       items:['notes-btn','vw-full','vw-morewrap']},
     ]},
    {id:'tasks-four-benches',
     name:'Four workbenches',
     blurb:'Try this if you work in passes - write the words, draw the diagram, wire up the figures, run the deck - and want each pass self-contained.',
     selTab:'draw',
     tabs:[{id:'write',label:'Write'},{id:'draw',label:'Draw'},{id:'figures',label:'Figures'},{id:'deck',label:'Deck'}],
     groups:[
      {id:'w-textobj',label:'Insert',tab:'write',
       items:['tx-drop','dc-maths','fmt-eqedit']},
      {id:'w-text',label:'Text',tab:'write',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx']},
      {id:'w-para',label:'Paragraph',tab:'write',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'w-type',label:'Type styles',tab:'write',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'w-furn',label:'Page furniture',tab:'write',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'d-tools',label:'Drawing tools',tab:'draw',
       items:['sh-drop','dc-line','dc-draw','et-cancel','et-table',
         'et-flip','et-arrow']},
      {id:'d-shape',label:'Line and shape',tab:'draw',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-fillwrap']},
      {id:'d-colour',label:'Colour',tab:'draw',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'d-arrange',label:'Arrange',tab:'draw',
       items:['fmt-alignwrap','fmt-front','fmt-back','fmt-forward',
         'fmt-backward','fmt-rotl','fmt-rotr']},
      {id:'d-object',label:'Object',tab:'draw',rest:1,
       items:['objects-btn','fmt-dup','fmt-group','fmt-ungroup',
         'fmt-parts']},
      {id:'d-guides',label:'Guides',tab:'draw',
       items:['vw-rulers','vw-grid']},
      {id:'f-pics',label:'Images',tab:'figures',
       items:['et-image','dc-qr','fmt-cropwrap']},
      {id:'f-src',label:'Figures',tab:'figures',
       items:['fmt-figures','fmt-locate','fmt-replace',
         'fmt-imgrefresh','fmt-revert','fmt-lockver','et-cell']},
      {id:'f-panels',label:'Panels',tab:'figures',
       items:['fmt-arline','fmt-argrid','fmt-samewrap']},
      {id:'f-tbl',label:'Table',tab:'figures',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'k-slides',label:'Slides',tab:'deck',
       items:['hm-newslide','hm-dupslide','hm-delslide','hm-laywrap',
         'hm-match','lay-drop']},
      {id:'k-page',label:'Page',tab:'deck',
       items:['page-drop','bg-drop','vw-versions']},
      {id:'k-anim',label:'Animate',tab:'deck',
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear']},
      {id:'k-show',label:'View',tab:'deck',
       items:['notes-btn','vw-full','vw-check','vw-side',
         'vw-morewrap']},
     ]},
    {id:'sources-own-tab',
     name:'Sources tab',
     blurb:'Try this if your figures come from a live notebook: a whole tab for where content came from and whether it is still fresh.',
     selTab:'format',
     tabs:[{id:'slides',label:'Slides'},{id:'sources',label:'Sources'},{id:'format',label:'Format'},{id:'deck',label:'Deck'}],
     groups:[
      {id:'s1-slides',label:'Slides',tab:'slides',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','lay-drop']},
      {id:'s1-anim',label:'Animate',tab:'slides',
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear']},
      {id:'s1-view',label:'View',tab:'slides',rest:1,
       items:['vw-full','vw-side','vw-morewrap','notes-btn']},
      {id:'s1-link',label:'Notebook link',tab:'sources',
       items:['fmt-figures','fmt-locate','fmt-replace','fmt-lockver',
         'et-cell']},
      {id:'s1-fresh',label:'Freshness',tab:'sources',
       items:['fmt-imgrefresh','fmt-revert','vw-versions',
         'vw-check']},
      {id:'s1-frame',label:'Frame',tab:'sources',
       items:['et-image','fmt-cropwrap','fmt-parts']},
      {id:'s1-typed',label:'Typed content',tab:'sources',
       items:['tx-drop','dc-maths','dc-qr']},
      {id:'s1-drawn',label:'Drawn content',tab:'sources',
       items:['sh-drop','dc-line','dc-draw','et-cancel','et-table',
         'et-flip','et-arrow']},
      {id:'s1-guides',label:'Guides and layers',tab:'format',
       items:['vw-rulers','vw-grid','objects-btn']},
      {id:'s1-text',label:'Text',tab:'format',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit']},
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
       items:['page-drop','bg-drop']},
      {id:'s1-type',label:'Type',tab:'deck',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'s1-furn',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
     ]},
    {id:'journey-notebook-to-slide',
     name:'Notebook to slide',
     blurb:'Try this for notebook-driven talks you rarely leave mid-flow: one Content tab holds where a figure came from, what it says, how it looks and where it sits.',
     selTab:'content',
     tabs:[{id:'slides',label:'Slides'},{id:'content',label:'Content'},{id:'present',label:'Present'}],
     groups:[
      {id:'j2-slides',label:'Slides',tab:'slides',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'j2-page',label:'Page',tab:'slides',
       items:['page-drop','lay-drop','bg-drop']},
      {id:'j2-furniture',label:'Page furniture',tab:'slides',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'j2-type',label:'Type',tab:'slides',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'j2-workspace',label:'Workspace',tab:'slides',rest:1,
       items:['vw-versions','objects-btn','vw-rulers','vw-grid',
         'vw-side']},
      {id:'j2-source',label:'Notebook source',tab:'content',
       items:['fmt-figures','fmt-locate','fmt-replace',
         'fmt-imgrefresh','fmt-revert','fmt-lockver','et-cell']},
      {id:'j2-insert',label:'Insert',tab:'content',
       items:['tx-drop','et-image','dc-maths','dc-qr','sh-drop',
         'dc-line','dc-draw','et-cancel','et-table','et-flip',
         'et-arrow']},
      {id:'j2-text',label:'Text',tab:'content',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike','fmt-eqedit',
         'fmt-stylewrap-tx','fmt-bullets','fmt-numbers','fmt-outdent',
         'fmt-indent','fmt-lhwrap','fmt-parawrap']},
      {id:'j2-look',label:'Look',tab:'content',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap',
         'fmt-fillwrap','fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-shapewrap']},
      {id:'j2-position',label:'Position',tab:'content',
       items:['fmt-alignwrap','fmt-front','fmt-back','fmt-forward',
         'fmt-backward','fmt-rotl','fmt-rotr','fmt-arline',
         'fmt-argrid','fmt-samewrap']},
      {id:'j2-pieces',label:'Group and crop',tab:'content',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-parts',
         'fmt-cropwrap']},
      {id:'j2-table',label:'Table',tab:'content',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'j2-buildorder',label:'Build order',tab:'present',
       items:['vw-anim','anim-stagger','anim-together','anim-clear']},
      {id:'j2-effects',label:'Effects',tab:'present',
       items:['anim-none','anim-fade','anim-rise','anim-zoom']},
      {id:'j2-run',label:'Delivery and checks',tab:'present',
       items:['notes-btn','vw-full','vw-morewrap','vw-check']},
     ]},
    {id:'verbs-bring-in-and-change',
     name:'Bring in and change',
     blurb:'Try this if getting content in is a job of its own: a whole tab for Image, Figures, Replace, Locate, Previous figure and Lock, so provenance never competes with formatting.',
     selTab:'change',
     tabs:[{id:'deck',label:'Set up'},{id:'bring',label:'Bring in'},{id:'change',label:'Change'},{id:'show',label:'Show'}],
     groups:[
      {id:'bc-slides',label:'Slides',tab:'deck',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'bc-page',label:'Page',tab:'deck',
       items:['lay-drop','page-drop','bg-drop']},
      {id:'bc-furn',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'bc-insert',label:'Insert',tab:'bring',rest:1,
       items:['tx-drop','et-image','dc-maths','dc-qr','sh-drop',
         'dc-line','dc-draw','et-cancel','et-table','et-flip',
         'et-arrow']},
      {id:'bc-figures',label:'Figures',tab:'bring',
       items:['fmt-figures','fmt-parts','fmt-cropwrap',
         'fmt-imgrefresh','et-cell']},
      {id:'bc-notebook',label:'Notebook link',tab:'bring',
       items:['fmt-replace','fmt-locate','fmt-revert','fmt-lockver',
         'vw-versions']},
      {id:'bc-decktype',label:'Deck type',tab:'change',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'bc-text',label:'Text',tab:'change',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-bullets','fmt-numbers','fmt-outdent',
         'fmt-indent','fmt-lhwrap','fmt-parawrap','fmt-eqedit']},
      {id:'bc-colour',label:'Colour',tab:'change',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'bc-lineshape',label:'Line and shape',tab:'change',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-fillwrap']},
      {id:'bc-table',label:'Table',tab:'change',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'bc-arrange',label:'Arrange',tab:'change',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'bc-view',label:'View',tab:'show',
       items:['vw-rulers','vw-grid','vw-full','vw-side','vw-check',
         'vw-morewrap']},
      {id:'bc-panes',label:'Panes',tab:'show',
       items:['objects-btn','notes-btn','vw-anim']},
      {id:'bc-builds',label:'Builds',tab:'show',
       items:['anim-none','anim-fade','anim-rise','anim-zoom',
         'anim-stagger','anim-together','anim-clear']},
     ]},
    {id:'density-everyday-first',
     name:'Everyday first',
     blurb:'Try this if the deck gets handed to colleagues who only ever do six things: fifteen everyday buttons, a Format tab that fills itself in, and one drawer for the rest.',
     selTab:'format',
     tabs:[{id:'start',label:'Everyday'},{id:'format',label:'Format'},{id:'more',label:'Everything else'}],
     groups:[
      {id:'day-slides',label:'Slides',tab:'start',
       items:['hm-newslide','hm-dupslide','hm-delslide','hm-laywrap',
         'vw-versions']},
      {id:'day-insert',label:'Insert',tab:'start',
       items:['tx-drop','et-image','sh-drop','dc-line','et-cancel',
         'et-table','et-flip','et-arrow']},
      {id:'day-look',label:'Deck look',tab:'start',
       items:['lay-drop','bg-drop','dsg-stylewrap']},
      {id:'day-show',label:'Present',tab:'start',
       items:['vw-full','notes-btn']},
      {id:'day-text',label:'Text',tab:'format',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit','fmt-bullets','fmt-numbers',
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
       items:['fmt-figures','fmt-replace','fmt-locate',
         'fmt-imgrefresh','fmt-revert','fmt-lockver','fmt-parts',
         'fmt-cropwrap','et-cell']},
      {id:'day-table',label:'Table',tab:'format',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'day-anim',label:'Animation',tab:'format',
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear']},
      {id:'day-page',label:'Page and furniture',tab:'more',
       items:['page-drop','dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'day-deck-styling',label:'Deck styling',tab:'more',
       items:['dsg-scale-down','dsg-scale-up','dsg-restyle','dsg-std',
         'hm-match']},
      {id:'day-maths',label:'Other inserts',tab:'more',
       items:['dc-maths','dc-qr','dc-draw']},
      {id:'day-workspace',label:'Workspace',tab:'more',rest:1,
       items:['vw-rulers','vw-grid','vw-side','vw-check',
         'objects-btn','vw-morewrap']},
     ]},
    {id:'verbs-look-versus-place',
     name:'Look versus place',
     blurb:'Try this for layout-heavy poster and figure work, where ordering, aligning and grouping deserve their own tab with the rulers and grid that serve them.',
     selTab:'change',
     tabs:[{id:'make',label:'Make'},{id:'change',label:'Change'},{id:'place',label:'Place'},{id:'show',label:'Show'}],
     groups:[
      {id:'lp-slides',label:'Slides',tab:'make',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'lp-insert',label:'Insert',tab:'make',rest:1,
       items:['tx-drop','et-image','dc-maths','dc-qr','sh-drop',
         'dc-line','dc-draw','et-cancel','et-table','et-flip',
         'et-arrow']},
      {id:'lp-page',label:'Page',tab:'make',
       items:['lay-drop','page-drop','bg-drop']},
      {id:'lp-furn',label:'Page furniture',tab:'make',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'lp-decktype',label:'Deck type',tab:'change',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'lp-text',label:'Text',tab:'change',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-bullets','fmt-numbers','fmt-outdent',
         'fmt-indent','fmt-lhwrap','fmt-parawrap','fmt-eqedit']},
      {id:'lp-colour',label:'Colour',tab:'change',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'lp-lineshape',label:'Line and shape',tab:'change',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-fillwrap']},
      {id:'lp-table',label:'Table',tab:'change',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'lp-figures',label:'Figures',tab:'change',
       items:['fmt-figures','fmt-cropwrap','fmt-imgrefresh',
         'fmt-replace','fmt-locate','fmt-revert','fmt-lockver',
         'et-cell']},
      {id:'lp-order',label:'Stacking order',tab:'place',
       items:['fmt-front','fmt-forward','fmt-backward','fmt-back',
         'objects-btn']},
      {id:'lp-align',label:'Alignment',tab:'place',
       items:['fmt-alignwrap','fmt-arline','fmt-argrid',
         'fmt-samewrap','fmt-rotl','fmt-rotr']},
      {id:'lp-group',label:'Grouping',tab:'place',
       items:['fmt-group','fmt-ungroup','fmt-parts','fmt-dup']},
      {id:'lp-guides',label:'Guides',tab:'place',
       items:['vw-rulers','vw-grid']},
      {id:'lp-view',label:'View',tab:'show',
       items:['vw-full','vw-side','vw-check','vw-morewrap']},
      {id:'lp-panes',label:'Panes',tab:'show',
       items:['notes-btn','vw-versions','vw-anim']},
      {id:'lp-builds',label:'Builds',tab:'show',
       items:['anim-none','anim-fade','anim-rise','anim-zoom',
         'anim-stagger','anim-together','anim-clear']},
     ]},
    {id:'journey-poster-first',
     name:'Poster first',
     blurb:'Try this for A0 posters and other one-page work: page setup, guides and the print check lead, and everything that only exists for a talk is quarantined.',
     selTab:'content',
     tabs:[{id:'page',label:'Page'},{id:'content',label:'Content'},{id:'talk',label:'Talk'}],
     groups:[
      {id:'j3-page',label:'Page',tab:'page',
       items:['page-drop','bg-drop','lay-drop']},
      {id:'j3-furniture',label:'Page furniture',tab:'page',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'j3-type',label:'Type',tab:'page',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'j3-guides',label:'Workspace',tab:'page',rest:1,
       items:['vw-rulers','vw-grid','vw-side','vw-morewrap',
         'objects-btn']},
      {id:'j3-proof',label:'Proof and versions',tab:'page',
       items:['vw-check','vw-versions']},
      {id:'j3-insert',label:'Insert',tab:'content',
       items:['tx-drop','et-image','dc-maths','dc-qr','sh-drop',
         'dc-line','dc-draw','et-cancel','et-table','et-flip',
         'et-arrow']},
      {id:'j3-figures',label:'Figure source',tab:'content',
       items:['fmt-figures','fmt-replace','fmt-imgrefresh',
         'fmt-locate','fmt-revert','fmt-lockver','et-cell']},
      {id:'j3-text',label:'Text',tab:'content',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit']},
      {id:'j3-para',label:'Paragraph',tab:'content',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'j3-fill',label:'Colour and line',tab:'content',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap',
         'fmt-fillwrap','fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-shapewrap']},
      {id:'j3-arrange',label:'Arrange',tab:'content',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-parts',
         'fmt-cropwrap','fmt-alignwrap','fmt-front','fmt-back',
         'fmt-forward','fmt-backward','fmt-rotl','fmt-rotr',
         'fmt-arline','fmt-argrid','fmt-samewrap']},
      {id:'j3-table',label:'Table',tab:'content',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'j3-slides',label:'Slides',tab:'talk',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide']},
      {id:'j3-buildorder',label:'Build order',tab:'talk',
       items:['vw-anim','anim-stagger','anim-together','anim-clear']},
      {id:'j3-effects',label:'Effects',tab:'talk',
       items:['anim-none','anim-fade','anim-rise','anim-zoom']},
      {id:'j3-delivery',label:'Delivery',tab:'talk',
       items:['notes-btn','vw-full']},
     ]},
    {id:'density-max-separation',
     name:'Everything in its place',
     blurb:'Try this if you would rather know exactly where a control lives than have it nearby: four tabs and twenty-five small groups whose labels name their contents literally.',
     selTab:'format',
     tabs:[{id:'deck',label:'Deck'},{id:'insert',label:'Insert'},{id:'format',label:'Format'},{id:'show',label:'Show'}],
     groups:[
      {id:'sep-slides',label:'Slides',tab:'deck',
       items:['hm-newslide','hm-dupslide','hm-delslide',
         'vw-versions']},
      {id:'sep-slide-layout',label:'Slide layout',tab:'deck',
       items:['hm-laywrap','lay-drop','hm-match']},
      {id:'sep-page-setup',label:'Page setup',tab:'deck',
       items:['page-drop','bg-drop']},
      {id:'sep-furniture',label:'Page furniture',tab:'deck',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'sep-deck-type',label:'Type scale',tab:'deck',
       items:['dsg-scale-down','dsg-scale-up']},
      {id:'sep-proofing',label:'Proofing',tab:'deck',
       items:['dsg-std','vw-check']},
      {id:'sep-text-maths',label:'Text and maths',tab:'insert',
       items:['tx-drop','dc-maths','fmt-eqedit']},
      {id:'sep-pictures',label:'Pictures and codes',tab:'insert',
       items:['et-image','dc-qr']},
      {id:'sep-shapes',label:'Shapes and lines',tab:'insert',
       items:['sh-drop','dc-line','dc-draw','et-cancel','et-table',
         'et-flip','et-arrow']},
      {id:'sep-figures',label:'Notebook figures',tab:'insert',
       items:['fmt-figures','fmt-replace','fmt-locate','et-cell']},
      {id:'sep-fig-versions',label:'Figure versions',tab:'insert',
       items:['fmt-imgrefresh','fmt-revert','fmt-lockver']},
      {id:'sep-frame',label:'Frame and parts',tab:'insert',
       items:['fmt-cropwrap','fmt-parts']},
      {id:'sep-text-styles',label:'Text styles',tab:'format',
       items:['dsg-stylewrap','dsg-restyle','fmt-stylewrap-tx']},
      {id:'sep-font',label:'Font and size',tab:'format',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger']},
      {id:'sep-emphasis',label:'Emphasis',tab:'format',
       items:['fmt-bold','fmt-ital','fmt-under','fmt-strike']},
      {id:'sep-lists',label:'Lists and spacing',tab:'format',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'sep-colour',label:'Colour and fill',tab:'format',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'sep-line-shape',label:'Line and shape',tab:'format',
       items:['fmt-shapewrap','fmt-stylewrap','fmt-swwrap',
         'fmt-headwrap','fmt-bendwrap','fmt-fillwrap']},
      {id:'sep-order',label:'Arrange and align',tab:'format',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-front',
         'fmt-back','fmt-forward','fmt-backward','fmt-rotl',
         'fmt-rotr','fmt-alignwrap','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'sep-table',label:'Table',tab:'format',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
      {id:'sep-guides',label:'Guides',tab:'show',
       items:['vw-rulers','vw-grid']},
      {id:'sep-workspace',label:'Workspace',tab:'show',rest:1,
       items:['vw-side','vw-full','vw-morewrap']},
      {id:'sep-panes',label:'Panes',tab:'show',
       items:['objects-btn','notes-btn','vw-anim']},
      {id:'sep-build-style',label:'Build styles',tab:'show',
       items:['anim-none','anim-fade','anim-rise','anim-zoom']},
      {id:'sep-build-order',label:'Build order',tab:'show',
       items:['anim-stagger','anim-together','anim-clear']},
     ]},
    {id:'sources-live-vs-made',
     name:'Live and made',
     blurb:'Try this if provenance matters more than tool type: content that tracks the notebook and content you made by hand get a tab each.',
     selTab:'format',
     tabs:[{id:'live',label:'Live'},{id:'made',label:'Made here'},{id:'slides',label:'Slides'},{id:'format',label:'Format'}],
     groups:[
      {id:'s4-notebook',label:'From the notebook',tab:'live',
       items:['fmt-figures','fmt-locate','fmt-replace','et-cell']},
      {id:'s4-fresh',label:'Freshness',tab:'live',
       items:['fmt-imgrefresh','fmt-revert','fmt-lockver',
         'vw-check']},
      {id:'s4-frame',label:'Frame',tab:'live',
       items:['et-image','fmt-cropwrap','fmt-parts']},
      {id:'s4-panes',label:'Panes',tab:'live',
       items:['vw-versions','notes-btn']},
      {id:'s4-place',label:'Text and maths',tab:'made',
       items:['tx-drop','dc-maths','dc-qr']},
      {id:'s4-draw',label:'Shapes and lines',tab:'made',
       items:['sh-drop','dc-line','dc-draw','et-cancel','et-table',
         'et-flip','et-arrow']},
      {id:'s4-type',label:'Type',tab:'made',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std']},
      {id:'s4-furn',label:'Page furniture',tab:'made',
       items:['dc-wmark','dc-head','dc-foot','dc-nums']},
      {id:'s4-slides',label:'Slides',tab:'slides',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','lay-drop']},
      {id:'s4-page',label:'Page',tab:'slides',
       items:['page-drop','bg-drop']},
      {id:'s4-anim',label:'Animate',tab:'slides',
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear']},
      {id:'s4-view',label:'View',tab:'slides',rest:1,
       items:['vw-full','vw-side','vw-morewrap']},
      {id:'s4-guides',label:'Guides and layers',tab:'format',
       items:['vw-rulers','vw-grid','objects-btn']},
      {id:'s4-text',label:'Text',tab:'format',
       items:['fmt-font','fmt-szwrap','fmt-smaller','fmt-bigger',
         'fmt-bold','fmt-ital','fmt-under','fmt-strike',
         'fmt-stylewrap-tx','fmt-eqedit']},
      {id:'s4-para',label:'Paragraph',tab:'format',
       items:['fmt-bullets','fmt-numbers','fmt-outdent','fmt-indent',
         'fmt-lhwrap','fmt-parawrap']},
      {id:'s4-colour',label:'Colour',tab:'format',
       items:['fmt-txcolwrap','fmt-fillcolwrap','fmt-opwrap']},
      {id:'s4-lineshape',label:'Line and shape',tab:'format',
       items:['fmt-stylewrap','fmt-swwrap','fmt-headwrap',
         'fmt-bendwrap','fmt-fillwrap','fmt-shapewrap']},
      {id:'s4-arrange',label:'Arrange',tab:'format',
       items:['fmt-dup','fmt-group','fmt-ungroup','fmt-alignwrap',
         'fmt-front','fmt-back','fmt-forward','fmt-backward',
         'fmt-rotl','fmt-rotr','fmt-arline','fmt-argrid',
         'fmt-samewrap']},
      {id:'s4-table',label:'Table',tab:'format',
       items:['fmt-tbl-rowplus','fmt-tbl-rowminus','fmt-tbl-colplus',
         'fmt-tbl-colminus','fmt-tbl-head','fmt-tbl-grid']},
     ]},
    {id:'density-one-row',
     name:'Everything in one row',
     blurb:'Try this if tabs themselves are the problem: all 94 controls on a single row, ruthlessly clustered, nothing hidden behind a tab you are not on.',
     selTab:'all',
     tabs:[{id:'all',label:'All tools'}],
     groups:[
      {id:'one-slides',label:'Slides',tab:'all',
       items:['hm-newslide','hm-dupslide','hm-laywrap','hm-match',
         'hm-delslide','lay-drop','page-drop','bg-drop','dc-wmark',
         'dc-head','dc-foot','dc-nums','vw-versions']},
      {id:'one-insert',label:'Insert and sources',tab:'all',
       items:['tx-drop','et-image','dc-maths','dc-qr','sh-drop',
         'dc-line','dc-draw','et-cancel','fmt-figures','fmt-replace',
         'fmt-locate','fmt-imgrefresh','fmt-revert','fmt-lockver',
         'fmt-parts','fmt-cropwrap','et-cell','et-table','et-flip',
         'et-arrow']},
      {id:'one-text',label:'Text',tab:'all',
       items:['dsg-stylewrap','dsg-scale-down','dsg-scale-up',
         'dsg-restyle','dsg-std','fmt-stylewrap-tx','fmt-font',
         'fmt-szwrap','fmt-smaller','fmt-bigger','fmt-bold',
         'fmt-ital','fmt-under','fmt-strike','fmt-eqedit',
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
       items:['vw-anim','anim-none','anim-fade','anim-rise',
         'anim-zoom','anim-stagger','anim-together','anim-clear',
         'vw-rulers','vw-grid','vw-full','vw-side','vw-check',
         'objects-btn','notes-btn','vw-morewrap']},
     ]},
  ];
