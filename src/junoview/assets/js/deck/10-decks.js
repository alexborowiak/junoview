/* 10-decks.js — every open notebook's cards, saved decks, drafts, undo and redo.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---------- registry: every open notebook's cards ----------
     Refs are namespaced "stem::anchor" so one deck can mix cards from
     every open tab; plain legacy anchors still resolve. */
  var ITEMS={};        /* ns -> item {..., nb, ns} */
  var SHELLITEMS={};   /* stem -> [ns, ...] in document order */
  var nbPres=[];       /* presentations embedded in notebooks (namespaced) */
  function nsKey(stem,anchor){return stem+'::'+anchor;}
  function splitRef(ref){
    var i=String(ref).indexOf('::');
    return i<0?[null,String(ref)]:[String(ref).slice(0,i),String(ref).slice(i+2)];
  }
  /* ---------- embedded snapshots: the deck's own copy of its cards ----
     A saved deck used to be refs only, so opening it without the source
     notebook (or without the internet to re-fetch one) showed empty
     frames. Saving now writes each placed card's rendered body into the
     file (`p.emb`, figures already data: URIs), and this store carries
     those copies at runtime. The live notebook ALWAYS wins — resolveRef
     tries ITEMS first — so an open tab still drives its frames, and the
     embedded copy is the understudy, not a fork. Kept OUT of the pres
     object on purpose: drafts are written to localStorage on every edit,
     and megabytes of figures there would hit the quota and silently kill
     autosave. IndexedDB holds them between sessions instead. */
  var EMBED={};          /* ns -> {title,kind,html,code} */
  var embItems={};       /* ns -> the virtual item resolveRef hands out */
  var embSaveT=null;
  function embKey(ref){
    if(!ref) return null;
    if(EMBED[ref]) return ref;
    /* plain legacy anchor: find it under any namespace, like resolveRef */
    if(String(ref).indexOf('::')>=0) return null;
    var suf='::'+ref,ks=Object.keys(EMBED);
    for(var i=0;i<ks.length;i++)
      if(ks[i].slice(-suf.length)===suf) return ks[i];
    return null;
  }
  function embFor(ref){var k=embKey(ref);return k?EMBED[k]:null;}
  function embItem(ref){
    var k=embKey(ref); if(!k) return null;
    if(!embItems[k]){
      var e=EMBED[k],pr=splitRef(k);
      embItems[k]={title:e.title||'',kind:e.kind||'note',
        hasCode:!!e.code,nb:pr[0]||'',anchor:pr[1],ns:k,emb:true};
    }
    return embItems[k];
  }
  /* the parsed body node, cached — cellFacets asks often */
  function embBody(ref){
    var e=embFor(ref); if(!e||!e.html) return null;
    if(!e._node){
      var t=document.createElement('template');t.innerHTML=e.html;
      e._node=t.content.firstElementChild||null;
    }
    return e._node;
  }
  function embStore(key,e){
    EMBED[key]={title:String(e.title||''),kind:String(e.kind||''),
      html:String(e.html||''),code:typeof e.code==='string'?e.code:''};
    delete embItems[key];
    /* invalidation point 3 (see frameNodeCache): a frame rendered from
       the OLD embedded copy of this ref must rebuild from the new one */
    dropFrameCache(key);
  }
  function embSaveSoon(){
    clearTimeout(embSaveT);
    embSaveT=setTimeout(function(){
      /* plain copies only — the cached _node is a DOM element and would
         make the structured clone throw */
      var plain={};
      Object.keys(EMBED).forEach(function(k){
        var e=EMBED[k];
        plain[k]={title:e.title,kind:e.kind,html:e.html,code:e.code||''};
      });
      idbPut('emb:'+SCOPE,plain).catch(function(){});
    },1000);
  }
  function resolveRef(ref){
    if(!ref) return null;
    if(ITEMS[ref]) return ITEMS[ref];
    if(String(ref).indexOf('::')>=0) return embItem(ref);
    for(var s=0;s<APP.order.length;s++){
      var k=nsKey(APP.order[s],ref);
      if(ITEMS[k]) return ITEMS[k];
    }
    return embItem(ref);
  }
  function normRef(ref){
    if(!ref) return null;
    var it=resolveRef(ref);
    return it?it.ns:String(ref);
  }
  /* normPres runs while projectPres is initialised, before the style
     registry fragment's var initialisers. Keep the built-in ids here so
     a saved deck with custom types can be normalised without reaching an
     as-yet undefined BUILTIN_STYLE_IDS (and keep one canonical list). */
  var BUILTIN_STYLE_IDS=[
    'title','h1','h2','h3','body','small','caption'];
  function normPres(p,stem){
    /* deep-copy a presentation, namespacing plain anchors (against
       `stem` when it came from one notebook, else best-effort);
       folder, title-slide text and free annotations ride along.
       Legacy grid-pane slides convert to preset cell-frame layouts. */
    /* A CUSTOM VIEW has no slides to normalise — and it must keep kind /
       nb / style / view or it comes back as a plain deck and clicking its
       row opens the slide editor instead (that was the bug where a custom
       view "took you to the presentation below it"). */
    if(p&&p.kind==='view'){
      var v={name:String(p.name||'view'),kind:'view',slides:[],
        nb:typeof p.nb==='string'?p.nb:'',
        style:p.style?deep(p.style):{},
        view:p.view?deep(p.view):{}};
      if(typeof p.folder==='string'&&p.folder) v.folder=p.folder;
      return v;
    }
    function ns(a){
      if(!a) return null;
      if(String(a).indexOf('::')>=0) return a;
      return stem?nsKey(stem,a):(normRef(a)||a);
    }
    var out={name:String(p.name||'presentation'),
      slides:(p.slides||[]).map(function(s){
        var o={layout:s.layout,
          panes:(s.panes||[]).map(ns)};
        /* Applying a template turns the old pane skeleton into free
           annotations (`layout: blank`). `lay` is the template id the
           gallery needs to keep its applied card selected after reload. */
        if(typeof s.lay==='string'&&s.lay) o.lay=s.lay;
        /* the name you gave a poster version. Not carrying it here meant
           it survived until the next load and then silently became
           "empty slide" again (2026-08-10) */
        if(typeof s.label==='string'&&s.label) o.label=s.label;
        /* which section this slide sits in. The ORDER of the sections is
           not stored anywhere — it is read back off the slide list, which
           is why reordering slides can never desynchronise it
           (2026-08-22) */
        if(typeof s.sec==='string'&&s.sec) o.sec=s.sec;
        /* optional, and which named cuts this slide is in. Membership
           lives on the SLIDE so it survives every splice and drag for
           free — the same argument s.sec makes above (T24). */
        if(s.opt) o.opt=1;
        /* how this slide ARRIVES. Per slide because that is how anyone
           thinks about it, and because a deck-wide setting cannot say
           "this one flies in from the last" (T27). */
        if(typeof s.trans==='string'&&s.trans) o.trans=s.trans;
        if(Array.isArray(s.cuts)&&s.cuts.length)
          o.cuts=s.cuts.filter(function(c){
            return typeof c==='string'&&c;});
        /* per-slide look + pane organisation. A field not listed here
           silently dies on the next load — exactly what happened to
           `label` before it was added (2026-08-10) */
        if(typeof s.bg==='string'&&s.bg) o.bg=s.bg;
        /* speaker notes and the per-slide time goal: yours, never drawn
           on the page, and lost on every reload until they were
           whitelisted here (2026-08-20) */
        if(typeof s.notes==='string'&&s.notes) o.notes=s.notes;
        if(typeof s.goal==='number'&&s.goal>0) o.goal=s.goal;
        /* the slide's durable name. Minted on first rehearsal, and the
           only reason a run made on Tuesday can be compared with one
           made on Friday after you reordered the deck (T29, 2026-08-25).
           The TIMES are not here on purpose -- they live beside the deck,
           because your rehearsal is not a property of the document. */
        if(typeof s.sid==='string'&&s.sid) o.sid=s.sid;
        if(s.border) o.border=deep(s.border);
        if(s.grpmeta) o.grpmeta=deep(s.grpmeta);
        if(s.layout==='title'){
          o.title=String(s.title||'');o.sub=String(s.sub||'');
          if(s.tprops) o.tprops=deep(s.tprops);
          if(s.sprops) o.sprops=deep(s.sprops);
        }
        if(Array.isArray(s.annots)&&s.annots.length)
          o.annots=deep(s.annots);
        (o.annots||[]).forEach(function(a){
          if(a.k==='cell'&&a.ref) a.ref=ns(a.ref);
          /* a flip book's frames hold the same kind of ref, one per
             frame. Missing this line is not a subtle bug: the deck
             reloads with every frame blank. */
          if(a.k==='flip'&&Array.isArray(a.frames))
            a.frames.forEach(function(f){
              if(f&&f.ref) f.ref=ns(f.ref);});
        });
        /* steps hidden in the code trace (namespaced refs) */
        if(Array.isArray(s.hidden)&&s.hidden.length)
          o.hidden=s.hidden.map(ns).filter(Boolean);
        /* legacy pane layouts -> cell frames at the preset rects */
        if(o.layout!=='title'){
          if(PRESETS[o.layout]){
            var rects=PRESETS[o.layout];
            o.annots=o.annots||[];
            for(var i=0;i<rects.length;i++){
              o.annots.push({k:'cell',x:rects[i][0],y:rects[i][1],
                w:rects[i][2],h:rects[i][3],
                ref:o.panes[i]||null});
            }
          }
          o.layout='blank';
        }
        o.panes=[];
        return o;
      })};
    if(typeof p.folder==='string'&&p.folder) out.folder=p.folder;
    if(p.showNums) out.showNums=1;   /* keep the slide-numbers preference */
    if(p.tapzoom) out.tapzoom=1;     /* tap-to-enlarge, same rule */
    if(typeof p.page==='string'&&p.page) out.page=p.page;  /* page preset */
    /* the page background survives every load path — normPres dropping
       it turned saved white posters navy again (2026-08-05 review) */
    if(typeof p.pageBg==='string'&&p.pageBg) out.pageBg=p.pageBg;
    /* trim marks are a print decision and were being forgotten on every
       reload, because nothing carried them across (2026-08-10) */
    if(p.cropMarks) out.cropMarks=1;
    if(typeof p.talkMins==='number'&&p.talkMins>0) out.talkMins=p.talkMins;
    if(typeof p.notes==='string'&&p.notes) out.notes=p.notes;
    if(Array.isArray(p.pad)&&p.pad.length)
      out.pad=deep(p.pad);
    /* the text types this deck invented. Filtered on the way IN: an entry
       with no id is unusable, and one claiming a built-in id would
       silently redefine Heading 1 for everybody who opened the file.
       It cannot ride the ['wmark','head','foot','styles'] loop below —
       that loop takes objects and this is a list. */
    if(Array.isArray(p.types)&&p.types.length){
      var tps=[];
      p.types.forEach(function(t){
        if(!t||typeof t!=='object'||!t.id) return;
        if(BUILTIN_STYLE_IDS.indexOf(t.id)>=0) return;
        tps.push(deep(t));
      });
      if(tps.length) out.types=tps;
    }
    /* the section NAMES, filtered to ids a slide actually uses. A blind
       deep copy — the shape the wmark/head/foot/styles line uses — would
       hoard entries for sections that no longer have a single slide in
       them, and the key would never empty again. Dropping it entirely
       when it does empty is what keeps a deck that never used sections
       serialising exactly as it did before the feature existed. */
    if(p.sections&&typeof p.sections==='object'){
      var used={},keep={},anySec=false;
      out.slides.forEach(function(s2){if(s2.sec) used[s2.sec]=1;});
      Object.keys(p.sections).forEach(function(k){
        if(!used[k]) return;
        var d=p.sections[k]; if(!d) return;
        keep[k]={name:String(d.name||'Untitled section')};
        if(d.fold) keep[k].fold=1;
        /* a section's default arrival, which is what makes T23's
           "section transitions" a real thing rather than a note */
        if(typeof d.trans==='string'&&d.trans) keep[k].trans=d.trans;
        anySec=true;
      });
      if(anySec) out.sections=keep;
    }
    /* deck-level furniture, same rule as the page background: forget it on
       load and a saved deck quietly loses its footer (2026-08-20).
       `tokens` joins them: an item that references '@accent' and a deck
       that has forgotten what accent means renders the fallback, which
       is the quiet failure this list exists to prevent (T12). */
    /* `guides` joins them, and is the sixth instance of exactly the bug
       this list exists to stop. normPres REBUILDS `out` field by field,
       so a deck-level key it does not name does not survive -- and
       guides were named in histRestore's key list but not here, twelve
       lines of code away. The effect: a guide survived Ctrl+Z and
       survived the localStorage draft, and vanished the moment the deck
       was re-opened from the saved copy, the project file or a loaded
       JSON. T4 shipped that; T52 made it worse by putting guides in the
       undo snapshot and writing a comment saying they belong to the
       deck (2026-08-29). */
    ['wmark','head','foot','styles','tokens',
     'components','cuts','guides'].forEach(function(k){
      if(p[k]&&typeof p[k]==='object') out[k]=deep(p[k]);
    });
    /* embedded card snapshots ride the FILE, not the object: they are
       absorbed into the session store (and IndexedDB) here, so frames
       still render when the notebook never opens — while drafts written
       on every edit stay ref-sized. Keys are namespaced like refs are. */
    if(p.emb&&typeof p.emb==='object'){
      Object.keys(p.emb).forEach(function(k){
        var e=p.emb[k];
        if(e&&typeof e.html==='string'&&e.html) embStore(ns(k)||k,e);
      });
      embSaveSoon();
    }
    return out;
  }
  function registerShell(stem,data){
    Object.keys(ITEMS).forEach(function(k){
      if(ITEMS[k].nb===stem) delete ITEMS[k];});
    SHELLITEMS[stem]=[];
    (data.items||[]).forEach(function(it){
      var o={};for(var k in it) o[k]=it[k];
      o.nb=stem;o.ns=nsKey(stem,it.anchor);
      ITEMS[o.ns]=o;SHELLITEMS[stem].push(o.ns);
      /* also resolve by the card slug so decks saved before anchors
         became positional still find their frames (unchanged cards) */
      if(it.card){
        var alias=nsKey(stem,it.card);
        if(alias!==o.ns&&!ITEMS[alias]) ITEMS[alias]=o;
      }
    });
    nbPres=nbPres.filter(function(p){return p.origin!==stem;});
    (data.presentations||[]).forEach(function(p){
      var cp=normPres(p,stem);cp.origin=stem;nbPres.push(cp);
    });
  }
  function unregisterShell(stem){
    Object.keys(ITEMS).forEach(function(k){
      if(ITEMS[k].nb===stem) delete ITEMS[k];});
    delete SHELLITEMS[stem];
    nbPres=nbPres.filter(function(p){return p.origin!==stem;});
  }
  /* ingest every notebook the page carries. Called from THE BOOT
     SEQUENCE at the end of the file — nothing executes here at load. */
  function initShellRegistry(){
    APP.order.forEach(function(stem){
      registerShell(stem,APP.shells[stem].data||{});});
  }

  /* ---------- saved presentations: project file + notebook-embedded --- */
  /* the project revision this page was built from; echoed back on every
     save so the server can refuse a write that has not seen another
     window's changes (see the 409 branch in saveToProject) */
  var projectRev=(APP.project&&typeof APP.project.rev==='number')
    ?APP.project.rev:0;
  var projectPres=(APP.project&&Array.isArray(APP.project.presentations))
    ?deep(APP.project.presentations).map(function(p){return normPres(p);})
    :[];
  function allSaved(){
    var out=[],seen={};
    projectPres.forEach(function(p){out.push(p);seen[p.name]=1;});
    nbPres.forEach(function(p){
      var n=p.name;
      if(seen[n]) n=p.name+' ('+p.origin+')';
      if(seen[n]) return;
      var cp=deep(p);cp.name=n;out.push(cp);seen[n]=1;
    });
    return out;
  }
  function savedByName(name){
    return allSaved().filter(function(p){return p.name===name;})[0]||null;
  }

  /* ---------- draft persistence scope ---------- */
  var SCOPE=APP.mode==='app'?'proj:'+(APP.root||'')
    :APP.mode==='web'?'web:'+location.pathname
    :(APP.order.length>1
      ?'bundle:'+APP.order.slice().sort().join('+')
      :(APP.order[0]||document.title));
  var PFX='sempres:'+SCOPE+':';
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  /* A SILENT PERSISTENCE LAYER IS WORSE THAN NONE. This swallowed
     QuotaExceededError and returned nothing, and all seventeen callers
     ignored it — so once a draft outgrew the ~5MB budget every later
     write was discarded while the Save button went on toasting "Kept in
     this browser" and the readout went on saying "saved". In the browser
     and static builds that store IS the presentation, so what was lost
     was the only copy (2026-08-22).
     It reports now, and lsFull records that it happened so the readout
     and the Save button can stop lying. */
  var lsFull=false;
  function lsSet(k,v){
    try{
      localStorage.setItem(k,v);
      if(lsFull){lsFull=false;if(typeof status==='function') status();}
      return true;
    }catch(e){
      /* Firefox reports NS_ERROR_DOM_QUOTA_REACHED, Safari a bare
         QuotaExceededError with code 22, Chrome code 22 with a name.
         Anything that threw here failed to store, whatever it is called. */
      if(!lsFull){
        lsFull=true;
        if(typeof status==='function') status();
        if(typeof toast==='function')
          toast('This browser is full — that edit was NOT kept. Use '
            +'File › Download a copy, or Saved to › a file on '
            +'your computer.',9000);
      }
      return false;
    }
  }
  function lsIsFull(){return lsFull;}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function loadDraft(name){
    var raw=lsGet(PFX+name); if(!raw) return null;
    try{var d=JSON.parse(raw);
      return (d&&Array.isArray(d.slides))?normPres(d):null;
    }catch(e){return null;}
  }
  /* THE DRAFT WRITE IS DEBOUNCED (2026-08-23 perf). markDirty runs on
     every keystroke and every gesture commit, and JSON.stringify(pres)
     plus a synchronous localStorage write per call was the single
     biggest fixed cost of an edit. Only the serialisation waits (~300ms
     trailing, stringifying the CURRENT pres when it fires) — status(),
     scheduleAutosave and histPush stay immediate, so the readout and
     undo behave exactly as before.
     flushDraftWrite() runs a pending write NOW — called wherever a fresh
     draft matters: pagehide/visibilitychange (after the text flush),
     entering Present, loading another presentation, and a rename (which
     migrates the draft by key).
     cancelDraftWrite() drops a pending write instead — called where the
     draft was just deleted on purpose (project/notebook save success,
     Discard, Delete), matching the old order in which the write always
     preceded the lsDel. */
  var draftT=null;
  function writeDraftNow(){
    draftT=null;
    if(!pres) return;
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
  }
  function scheduleDraftWrite(){
    if(draftT) clearTimeout(draftT);
    draftT=setTimeout(writeDraftNow,300);
  }
  function flushDraftWrite(){
    if(draftT){clearTimeout(draftT);writeDraftNow();}
  }
  function cancelDraftWrite(){
    if(draftT){clearTimeout(draftT);draftT=null;}
  }
  function draftNames(){
    var out=[];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k&&k.indexOf(PFX)===0){
          var nm=k.slice(PFX.length);
          if(nm&&nm!=='last'&&out.indexOf(nm)<0) out.push(nm);
        }
      }
    }catch(e){}
    return out.sort();
  }
  function fullFrame(ref){
    var r=PRESETS.full[0];
    return {k:'cell',x:r[0],y:r[1],w:r[2],h:r[3],ref:ref||null};
  }
  function emptySlide(){
    return {layout:'blank',panes:[],annots:[fullFrame(null)]};
  }
  function autoSlides(withDocs){
    var out=[];
    APP.order.forEach(function(stem){
      (SHELLITEMS[stem]||[]).forEach(function(ns){
        var it=ITEMS[ns];
        var fig=it.kind==='figure'||it.kind==='diagnostic';
        if(fig||(withDocs&&it.kind==='note'))
          out.push({layout:'blank',panes:[],
            annots:[fullFrame(ns)]});
      });
    });
    return out;
  }
  function defaultPres(){return {name:'presentation',slides:autoSlides(false)};}

  var pres=null, source='auto', mode='view', cur=0, activePane=0;
  function loadPresentation(name){
    flushDraftWrite();   /* the outgoing deck's last edits reach its draft */
    deckZoom=0;   /* zoom is per-session, reset per presentation */
    var d=loadDraft(name);
    if(d){pres=d;source='draft';histReset();return;}
    var s=savedByName(name);
    if(s){pres=normPres(deep(s));source='saved';histReset();return;}
    pres=defaultPres();source='auto';histReset();
  }
  /* which presentation the page opens with. Called from THE BOOT
     SEQUENCE at the end of the file — never from here: loadPresentation
     → histReset() → syncCustomTypes() reaches STYLE_DEFAULTS, which is
     assigned thousands of lines below this point (see the 2026-08-22
     incident record at the boot sequence). */
  function initFirstPresentation(){
    var last=lsGet(PFX+'last');
    if(last&&(loadDraft(last)||savedByName(last))) loadPresentation(last);
    else if(allSaved().length) loadPresentation(allSaved()[0].name);
    /* the other two branches sync via histReset; this one must too —
       "every path that installs a new pres", as syncCustomTypes says */
    else {pres=defaultPres();source='auto';syncCustomTypes();}
  }

  var saveStamp=null,saveKind='';
  function fmtT(d){
    var h=d.getHours(),m=d.getMinutes();
    return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
  }
  /* the readout is a SAVE BUTTON when saves only live in this browser —
     it used to open the save-to-file picker, which is not what a thing
     that says "autosaved" invites you to do (2026-08-19, user: "clicking
     the autosave button should save") */
  function markSaveClickable(el){
    var toBrowser=(saveTarget!=='file'&&saveTarget!=='project');
    el.classList.toggle('clickable',toBrowser);
    el.title=toBrowser
      ?'Saves stay in this browser. Click to save now — use the ▾ beside '
        +'Save to keep a .junoview.html file on your computer instead.'
      :'';
  }
  function whereSaved(){
    if(saveTarget==='project') return 'project';
    if(saveTarget==='file') return fileName||'file';
    return 'browser';
  }
  /* ---- the name, in the title bar ------------------------------------
     Rename used to be a File-menu item that un-hid an input living inside
     a display:none block, so in the ordinary editing flow it did nothing
     visible at all. The name now sits in the middle of the top bar the
     way a title bar shows a document's name, and you rename it by
     clicking it. It commits on Enter or blur, never per keystroke. */
  function syncQatName(){
    var b=$('#qat-name');
    if(!b) return;
    var nm=(pres&&pres.name)||'';
    if(b.textContent!==nm) b.textContent=nm;
    b.title=nm?('“'+nm+'” — click to rename'):'Click to name this';
  }
  function startQatRename(){
    var b=$('#qat-name'),inp=$('#qat-nameedit');
    if(!b||!inp) return;
    inp.value=(pres&&pres.name)||'';
    b.hidden=true;inp.hidden=false;
    inp.focus();inp.select();
    var done=false;
    function commit(ok){
      if(done) return; done=true;
      inp.hidden=true;b.hidden=false;
      var v=inp.value.trim();
      if(ok&&v&&v!==pres.name){renamePresentation(v);}
      syncQatName();
    }
    inp.addEventListener('blur',function(){commit(true);},{once:true});
    inp.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();commit(true);}
      else if(e.key==='Escape'){e.preventDefault();commit(false);}
    });
  }
  function status(){
    syncQatName();
    /* the bar names what it belongs to; for a poster this is the only
       place the name is shown, since the panel that normally carries it
       is hidden */
    var ti=$('#deck-title');
    if(ti) ti.textContent=(mode==='edit'&&pres&&pres.name)?pres.name:'';
    var el=$('#deck-status');
    var auto=APP.mode==='app'
      &&(typeof autosaveOn==='undefined'||autosaveOn);
    /* A FULL BROWSER OUTRANKS EVERY OTHER READING. Once localStorage has
       refused a write, "saved" is a lie about the only copy there is, so
       it says so and keeps saying so until a write succeeds. */
    if(lsIsFull()&&saveTarget==='browser'){
      el.textContent='NOT saved — browser full';
      el.className='deck-status unsaved lsfull';
      el.title='localStorage is full, so edits are no longer being kept. '
        +'Use File › Download a copy, or switch "Saved to" to a file.';
      return;
    }
    if(source==='draft'){
      /* web/static Save writes to the browser but keeps source='draft';
         show a plain 'saved' — the Save button tooltip explains where */
      if(APP.mode!=='app'&&saveKind==='manual'&&saveStamp){
        el.textContent='saved to '+whereSaved()+' · '+fmtT(saveStamp);
        el.className='deck-status saved';
        markSaveClickable(el);   /* this branch returns before the shared
                                    tail below would run */
        return;
      }
      el.textContent=auto?'unsaved — saving…':'unsaved';
    } else if(source==='saved'){
      /* WHERE, not just when: "autosaved · 12:18" answered the question
         nobody asked and skipped the one that matters — into the browser?
         the project? which file? (2026-08-18, user: "in the little
         autosave button, say where saved to") */
      el.textContent=saveStamp
        ?((saveKind==='auto'?'autosaved to ':'saved to ')+whereSaved()
          +' · '+fmtT(saveStamp))
        :'saved to '+whereSaved();
    } else el.textContent='';

    el.className='deck-status '+source;
    /* AFTER the className assignment, which would wipe the class */
    markSaveClickable(el);
    /* the readout RENAMES ITSELF between fits ("" -> "autosaved to
       presentation.junoview.html · 12:41"), and a wider readout after
       the last fit is exactly how it ended up printed across other
       controls (2026-08-18, user: "the autosave button hides the color
       options"). Any text change re-judges the bar, which drops the
       readout whole when the row is tight. */
    if(el.textContent!==el._lastTxt){
      el._lastTxt=el.textContent;
      requestAnimationFrame(fitEditRibbon);
      /* the readout lives in the thin bar now, so a wider text has to
         re-judge THAT row too — fitQat drops it whole when tight */
      requestAnimationFrame(fitQat);
    }
    if(!el.classList.contains('clickable')) el.title=el.textContent;
  }
  (function(){
    var el=$('#deck-status');
    if(el) el.addEventListener('click',function(){
      if(!el.classList.contains('clickable')) return;
      var sb=$('#dc-save'); if(sb) sb.click();
    });
  })();
  /* `quiet` persists WITHOUT recording an undo step. The debounced commit
     that now runs while you type uses it, so a paragraph still costs one
     undo entry (taken on blur, as before) instead of one per phrase —
     which would evict real slide edits from the 50-deep stack. */
  function markDirty(quiet){
    source='draft';
    saveKind='';
    scheduleDraftWrite();   /* the stringify+localStorage cost, debounced */
    status();
    scheduleAutosave();
    if(!quiet) histPush();
    renderSelPane();   /* keep the Objects pane in step (no-op if closed) */
    /* and the numbers, which are the same fact about the same slide
       (T65). Same no-op-when-closed contract. */
    if(typeof sizePaneSync==='function') sizePaneSync();
    /* Object history is derived on demand from undo plus the live model.
       When its pane is open, a COMMITTED edit must redraw that final
       "now" row; quiet slider/typing previews would otherwise parse 24
       whole-deck snapshots per input event. */
    var ohp=$('#objhist');
    if(!quiet&&ohp&&!ohp.hidden) renderObjHist();
    refreshThumb(cur);
  }
  /* ---- keep the CURRENT slide's thumbnail live -------------------------
     The strip was only rebuilt by refresh() — a slide change, a layout, a
     reorder. Editing the slide you are looking at never touched it, so its
     thumbnail showed the slide as it was when you arrived and every slide
     you had worked on looked wrong. That is the other half of "thumbnails
     do now show text, or anything else for that matter" (2026-08-20,
     user): the first half was miniDiagram drawing only cells.
     Just the one row, and debounced: renderFilm() rebuilds every row with
     its drag wiring, which is far too much to do on each edit. */
  var thumbT=null;
  function refreshThumb(i){
    clearTimeout(thumbT);
    thumbT=setTimeout(function(){
      var s=pres.slides[i]; if(!s) return;
      var row=$('#film-list .film-row[data-idx="'+i+'"]');
      if(!row) return;
      var old=row.querySelector('.mini-diagram');
      /* the CURRENT row in notebook view is the big inline pane editor,
         not a thumbnail — leave that alone. In headings mode there is no
         thumbnail at all, and this correctly does nothing. */
      if(old&&old.parentNode){
        miniHNow=miniH();
        old.parentNode.replaceChild(miniDiagram(s),old);
      }
      var tt=row.querySelector('.film-t');
      /* filmText, not slideTitle: in headings mode the row is named by
         the slide's heading, and refreshing it with the other function
         would rename it back on the first edit */
      if(tt) tt.textContent=filmText(s);
      row.dataset.lvl=headLevel(s);
    },140);
  }
  /* ---------- undo / redo (snapshots of the slide content) ---------- */
  var undoStack=[],redoStack=[],histSnap=null;
  /* the section names alone, or null when there are none — the same
     empty-is-null trick pres.styles uses, so a deck with no sections
     serialises into the snapshot exactly as it did before they existed */
  function secNames(){
    var m=pres&&pres.sections,out=null;
    if(m) Object.keys(m).forEach(function(k){
      if(!m[k]) return;
      out=out||{};
      /* the NAME and the arrival are content; whether a section is
         folded is a way of looking at the strip and stays out (T23) */
      out[k]=(m[k].trans)
        ?{name:(m[k].name)||'Untitled section',trans:m[k].trans}
        :((m[k].name)||'Untitled section');
    });
    return out;
  }
  /* WHAT UNDO CAN SEE. Anything left out of this object is not merely
     un-undoable — it goes INCONSISTENT, because the things that are in it
     are derived from the things that are not.

     The type scale was the bad case. `scaleStyles()` rewrites pres.styles
     and then writes the new sizes into every text box; only the boxes were
     snapshotted, so Ctrl+Z put the boxes back and left the style
     definitions scaled. The deck looked restored until anything called
     applyStyleTo — editing a box, Re-apply, Match slide — at which point
     the scaling silently returned. And because scaleStyles multiplies the
     CURRENT definition, scale/undo/scale drifted the type a little further
     every time, with no way back short of resetting each style by hand
     (2026-08-22).
     Page size and page background were the quiet case: annots are stored
     in percentages, so changing either leaves this object identical,
     histPush's "nothing actually changed" guard fires, and no undo entry
     is created at all.

     pres.notes and pres.pad stay OUT, deliberately: they are written on
     every keystroke, so snapshotting them would fill the 50-entry stack
     with single characters and evict the slide edits undo is for. Per
     SLIDE notes live on the slide and are covered. */
  function histState(){
    return JSON.stringify({slides:pres.slides||[],talkMins:pres.talkMins||0,
      showNums:pres.showNums||0,tapzoom:pres.tapzoom||0,wmark:pres.wmark||null,
      head:pres.head||null,foot:pres.foot||null,
      /* an empty styles object and no styles object are the same deck —
         serialise them the same way or merely READING a style (which
         lazily creates {}) would record a phantom undo step */
      styles:(pres.styles&&Object.keys(pres.styles).length)
        ?pres.styles:null,
      /* the types you invented are as undoable as the boxes wearing
         them, and for the same reason the styles are: delete a type and
         Ctrl+Z must bring back both the type AND the a.style tags that
         deleteCustomType stripped. Empty serialises as null on the same
         argument as styles - merely READING the list lazily creates it,
         and a phantom undo step for reading is worse than none. */
      types:(pres.types&&pres.types.length)?pres.types:null,
      /* a token change repaints every item referencing it, so it is an
         edit like any other and Ctrl+Z has to reach it. Empty
         serialises as null on the same argument styles makes: merely
         READING the registry must not record a phantom step. */
      tokens:(pres.tokens&&Object.keys(pres.tokens).length)
        ?pres.tokens:null,
      /* the definitions are as undoable as the instances wearing them:
         Ctrl+Z after a push has to put BOTH back, or the deck is left
         with instances stamped from a definition that no longer says
         that (the same argument styles and types make above) */
      components:(pres.components&&Object.keys(pres.components).length)
        ?pres.components:null,
      /* the cut NAMES are content; which cut you happen to be
         rehearsing is not, and lives in a session variable (T24) */
      cuts:(pres.cuts&&Object.keys(pres.cuts).length)?pres.cuts:null,
      /* section NAMES are content and are undoable; whether a section is
         COLLAPSED is a way of looking at the strip, so it is stripped out
         here — Ctrl+Z must never open or close one (2026-08-22). The
         tags themselves ride inside `slides`. */
      sections:secNames(),
      /* the guides you drew are content: they belong to the deck, they
         are saved and re-opened with it, and drawing one is an edit like
         any other. They were left out, so a mis-drawn guide box and a
         mis-clicked "Clear every guide" were both unreachable by Ctrl+Z —
         the only edits in the editor that were (2026-08-29, audit T52).
         WHETHER THEY ARE SHOWN stays out, on the same argument that keeps
         a section's fold state out: that is a way of looking at the page,
         and lives in the browser's view state. */
      guides:pres.guides||null,
      page:pres.page||null,pageBg:pres.pageBg||null,
      cropMarks:pres.cropMarks||0});
  }
  function histReset(){
    /* the one funnel every newly installed `pres` passes through, which
       makes it the only safe place to graft this deck's own text types
       into the shared STYLE_DEFAULTS registry. Miss it and deck A's
       "Quote" is still on the menu after you open deck B. */
    syncCustomTypes();
    histSnap=histState();undoStack=[];redoStack=[];updateUndoBtns();
  }
  function histPush(){
    var st=histState();
    if(st===histSnap) return;         /* nothing actually changed */
    undoStack.push(histSnap);
    if(undoStack.length>50) undoStack.shift();
    redoStack.length=0;histSnap=st;updateUndoBtns();
  }
  function histRestore(snap){
    var d;try{d=JSON.parse(snap);}catch(e){return;}
    pres.slides=d.slides||[];
    if(d.showNums) pres.showNums=1; else delete pres.showNums;
    if(d.tapzoom) pres.tapzoom=1; else delete pres.tapzoom;
    var pageWas=pres.page||null,bgWas=pres.pageBg||null;
    ['wmark','head','foot','styles','tokens','components','cuts',
     'guides','page','pageBg','cropMarks'].forEach(function(k){
      if(d[k]) pres[k]=d[k]; else delete pres[k];});
    if(d.talkMins) pres.talkMins=d.talkMins; else delete pres.talkMins;
    /* types are restored with their own statement rather than by joining
       the list above, because the registry has to be re-grafted the
       moment the list changes - every menu, every specimen row and
       applyStyleTo read STYLE_DEFAULTS, not pres.types, so an undo that
       restored the list without syncing would leave the deck offering a
       type that no longer resolves. */
    if(d.types) pres.types=d.types; else delete pres.types;
    syncCustomTypes();
    /* sections get their own merge rather than joining the list above:
       that loop deletes what the snapshot lacks, and the snapshot
       deliberately lacks the fold flags — so it would collapse-or-expand
       every section on every undo. Names come from the snapshot; whether
       a section is open stays exactly as you left it. */
    if(d.sections){
      var was=pres.sections||{};
      pres.sections={};
      Object.keys(d.sections).forEach(function(k){
        var v=d.sections[k];
        pres.sections[k]=(v&&typeof v==='object')
          ?{name:v.name||'Untitled section',trans:v.trans}
          :{name:v};
        if(!pres.sections[k].trans) delete pres.sections[k].trans;
        if(was[k]&&was[k].fold) pres.sections[k].fold=1;
      });
    } else delete pres.sections;
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;selAnnot=null;selSet=[];
    /* the styles come back as DEFINITIONS only. Every text box already
       carries the sizes it had in this snapshot (applyStyleTo writes them
       in), so restyling here would overwrite the restored boxes with the
       restored definitions — the same round trip we are undoing. */
    /* a page size or background is not repainted by refresh(): they are
       applied to the stage, so an undo across one has to re-run the same
       two calls the picker does, and re-fit a ribbon whose column may
       have just changed shape */
    var pageChanged=(pres.page||null)!==pageWas;
    if(pageChanged||(pres.pageBg||null)!==bgWas) deckZoom=0;
    /* persist WITHOUT recording a new history entry */
    source='draft';
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    status();scheduleAutosave();
    if(pageChanged) applyPage();
    if(typeof applyPageBg==='function') applyPageBg();
    refresh();
    if(pageChanged){
      if(typeof syncTopBar==='function') syncTopBar();
      if(typeof applySideRibbon==='function') applySideRibbon();
    }
    /* the guide layer is not the annot layer: it hangs off the slide and
       caches the signature it last drew, so an undo across a guide edit
       has to ask it again or the restored model is invisible */
    if(typeof syncGuides==='function') syncGuides();
    /* nothing is selected after a restore — clear the format bar */
    if(typeof showFmt==='function') showFmt();
  }
  function undo(){
    if(!undoStack.length) return;
    redoStack.push(histSnap);histSnap=undoStack.pop();
    updateUndoBtns();histRestore(histSnap);
  }
  function redo(){
    if(!redoStack.length) return;
    undoStack.push(histSnap);histSnap=redoStack.pop();
    updateUndoBtns();histRestore(histSnap);
  }
  function updateUndoBtns(){
    var u=$('#dc-undo'),r=$('#dc-redo');
    if(u) u.disabled=!undoStack.length;
    if(r) r.disabled=!redoStack.length;
  }

  /* ---------- DOM cloning from the cards already on the page ---------- */
  function cardEl(ref){
    var it=resolveRef(ref); if(!it) return null;
    var sh=APP.shells[it.nb]; if(!sh) return null;
    return sh.el.querySelector(
      '.card[data-anchor="'+String(it.anchor).replace(/"/g,'\\"')+'"]');
  }
  function stripIds(node){
    if(node.removeAttribute) node.removeAttribute('id');
    $$('[id]',node).forEach(function(n){n.removeAttribute('id');});
    return node;
  }
  /* per-frame figure history: every successful live clone is remembered;
     on a notebook reload those become the "previous figure" a frame can
     revert to (session-only — snapshots never enter the saved deck) */
  var frameSnaps={},frameSnapsPrev={};
  var frozenFrames=new WeakMap();   /* annot -> snapshot html it shows */
  /* ---- FRAME RENDER CACHES (2026-08-23 perf) --------------------------
     renderAnnots used to re-run cloneBody per cell frame per layer
     rebuild: a full cloneNode(true) of a card body carrying multi-MB
     base64 figures, four querySelectorAll stripping passes, and an
     outerHTML serialisation into frameSnaps — per frame, per call. The
     prepared node is now cached and re-cloned on use (the embBody
     e._node precedent).
     frameNodeCache: normRef+'::'+requestedPart -> ready-to-insert node.
     INVALIDATION — a stale frame is a wrong frame, so every event that
     can change a card's rendered body drops the affected entries via
     dropFrameCache():
       1. the 'sem:shell' handler (a notebook opened OR reloaded — the
          refresh-pictures path), per stem;
       2. the 'sem:shellclosed' handler, per stem — frames fall back to
          the deck's embedded copy;
       3. embStore(), per ref — a new/updated embedded copy must show
          (it matters when the notebook is not open).
     NOT invalidation points, deliberately:
       - document filter changes (the Plots/Code/Outputs menus): they
         only toggle classes/stubs on the live cards, and cloneBody
         normalises all of that away (strips the pt-, ot-, part- and
         code-off classes, removes .ot-stub, restores .figpager-nav),
         so the clone is filter-invariant;
       - the notebook-side figpager's CURRENT page: view state, not
         content — the placed frame's own pager stays interactive;
       - freeze/unfreeze ("Previous figure"): it switches BUILDERS
         (framePartFromSnap vs framePart), no shared entries;
       - version locks: verNodeCache is keyed by the immutable
         per-commit card object (fetchVerCards never refetches a defined
         key), and locking/unlocking picks a different code path.
     snapNodeCache is content-addressed (keyed by the snapshot HTML
     string itself), so it cannot go stale by construction. */
  var frameNodeCache={};
  var snapNodeCache=new Map();      /* snapshot html -> {part: node} */
  var verNodeCache=new WeakMap();   /* version card -> {part: node} */
  /* drop cached frame nodes for one notebook stem, one full ref, or all
     (both key shapes are prefixes of 'stem::anchor::part') */
  function dropFrameCache(stemOrRef){
    if(stemOrRef==null){frameNodeCache={};return;}
    var pfx=stemOrRef+'::';
    Object.keys(frameNodeCache).forEach(function(k){
      if(k.indexOf(pfx)===0) delete frameNodeCache[k];});
  }
  function cloneBody(ref){
    var c=cardEl(ref);
    if(!c){
      /* notebook not open: fall back to the copy embedded in the deck
         (already filter-stripped at capture time) */
      var eb=embBody(ref);
      return eb?stripIds(eb.cloneNode(true)):null;
    }
    var b=$('.cardbody',c); if(!b) return null;
    b=stripIds(b.cloneNode(true));
    /* the DOCUMENT's filter state (hidden plot types, folded/hidden parts)
       must not ride into slides — a placed frame shows its part in full */
    $$('.pt-off,.pt-fold,.ot-off,.ot-fold,.part-off,.part-fold,.code-off',b)
      .forEach(function(n){
        ['pt-off','pt-fold','pt-open','ot-off','ot-fold','ot-open',
         'part-off','part-fold','part-open','code-off']
          .forEach(function(cl){n.classList.remove(cl);});
      });
    /* per-output fold stubs are filter chrome, not content */
    $$('.ot-stub',b).forEach(function(n){n.remove();});
    $$('.figpager-nav',b).forEach(function(n){n.style.display='';});
    var it=resolveRef(ref);
    if(it) frameSnaps[it.ns]=b.outerHTML;
    return b;
  }
  function cloneCode(ref){
    var c=cardEl(ref);
    if(!c){
      var e=embFor(ref);
      if(!e||!e.code) return null;
      var t=document.createElement('template');t.innerHTML=e.code;
      var n=t.content.firstElementChild;
      return n?stripIds(n.cloneNode(true)):null;
    }
    var inner=$('.codeinner',c); if(!inner) return null;
    return stripIds(inner.cloneNode(true));
  }
  /* a cell can contribute several things to a slide: its CODE, its
     FIGURE(s) and its printed OUTPUT. A frame shows one 'part'. */
  function cellFacets(ref){
    var card=cardEl(ref);
    var it=resolveRef(ref);
    var f={code:!!(it&&it.hasCode),figure:false,output:false};
    var body=null;
    if(card){
      if(!f.code&&card.querySelector('.codeinner')) f.code=true;
      body=$('.cardbody',card);
    } else {
      body=embBody(ref);   /* the deck's own copy is a cardbody too */
    }
    if(body){
      /* live embeds (plotly/bokeh/vega/folium) are figures too */
      f.figure=!!body.querySelector('.figframe,.figpager,.plotframe');
      f.output=!!body.querySelector(
        'pre.result,pre.stream,.rich:not(.plotframe),.jv-xr,.note')
        ||(!f.figure&&!!(body.textContent||'').trim());
    }
    return f;
  }
  function autoPart(f){
    return f.figure?'figure':(f.output?'output':(f.code?'code':'body'));
  }
  function hasFacet(f,part){
    return (part==='code'&&f.code)||(part==='figure'&&f.figure)
      ||(part==='output'&&f.output);
  }
  function partOf(a){
    var f=cellFacets(a.ref);
    /* honor the chosen part only if the cell STILL has it (a refresh may
       have removed the figure/output) — else fall back to auto */
    if(a.part&&a.part!=='auto'&&hasFacet(f,a.part)) return a.part;
    return autoPart(f);
  }
  function applyPartFilter(b,part){
    if(part==='figure'){
      /* the figure part is JUST the figure — drop outputs AND any markdown
         note / caption that rides along in the card body (a .plotframe is
         a live figure, e.g. bokeh/vega/folium — keep it) */
      $$('.cb-out,.jv-xr,pre.result,pre.stream,.rich:not(.plotframe),'
        +'.note,.note-src,.htmltoggle,.caption',b)
        .forEach(function(n){if(n.parentNode) n.parentNode.removeChild(n);});
    } else if(part==='output'){
      $$('.cb-fig,.figframe,.figpager,.plotframe',b).forEach(function(n){
        if(n.parentNode) n.parentNode.removeChild(n);});
    }
    return b;
  }
  function framePart(ref,part){
    /* cached per (ref, requested part): cloneBody — and its frameSnaps
       outerHTML snapshot — now runs only when the cache was dropped,
       i.e. on first sight or after the source card actually changed.
       See the invalidation list on frameNodeCache above. */
    var key=(normRef(ref)||String(ref||''))+'::'+(part||'auto');
    var hit=frameNodeCache[key];
    if(hit) return hit.cloneNode(true);
    var f=cellFacets(ref);
    if(!part||part==='auto'||!hasFacet(f,part)) part=autoPart(f);
    var b;
    if(part==='code') b=cloneCode(ref)||cloneBody(ref);
    else {
      b=cloneBody(ref);
      b=b?applyPartFilter(b,part):cloneCode(ref);
    }
    if(b) frameNodeCache[key]=b.cloneNode(true);
    return b;
  }
  /* ---- figure LOCKS: a frame pinned to a git commit renders that
     commit's card (fetched once, cached) — refresh never touches it, and
     the source notebook doesn't even have to be open ---- */
  var verCards={},verMeta={},verPending={};
  function lockParts(a){
    var r=normRef(a.ref)||String(a.ref||'');
    var pr=splitRef(r);
    if(!pr[0]) return null;
    var path=nbPathFor(pr[0]);
    if(!path||/^https?:/i.test(path)) return null;
    return {stem:pr[0],anchor:pr[1],path:path,
      key:path+'@'+a.lockver.commit+'::'+pr[1],
      pkey:path+'@'+a.lockver.commit};
  }
  function fetchVerCards(path,commit,anchors){
    var pkey=path+'@'+commit;
    var pend=verPending[pkey]=verPending[pkey]||{};
    anchors=anchors.filter(function(an){
      return verCards[pkey+'::'+an]===undefined&&!pend[an];});
    if(!anchors.length) return Promise.resolve();
    anchors.forEach(function(an){pend[an]=1;});
    return APP.api('/api/versioncards',
      {path:path,commit:commit,anchors:anchors})
    .then(function(j){
      verMeta[pkey]={msg:j.msg||'',date:j.date||''};
      anchors.forEach(function(an){
        verCards[pkey+'::'+an]=(j.cards||{})[an]||null;
        delete pend[an];
      });
      var l=stage.querySelector('.annot-layer');
      var s=pres.slides[cur];
      if(l&&s&&!deckEl.hidden){renderAnnots(l,s);paintSel(l);}
    }).catch(function(){
      anchors.forEach(function(an){
        verCards[pkey+'::'+an]=null;delete pend[an];});
    });
  }
  /* undefined = loading, null = unavailable, object = the card */
  function verCardFor(a){
    if(!(a.lockver&&a.lockver.commit)||APP.mode!=='app') return null;
    var lp=lockParts(a); if(!lp) return null;
    var hit=verCards[lp.key];
    if(hit!==undefined) return hit;
    fetchVerCards(lp.path,a.lockver.commit,[lp.anchor]);
    return undefined;
  }
  /* resolve the part and filter a snapshot BODY node (snapshots hold no
     code part) — shared by the string and version-card paths */
  function snapPart(b,part){
    var hasFig=!!b.querySelector('.figframe,.figpager,.plotframe');
    if(!part||part==='auto'||part==='code')
      part=hasFig?'figure':'output';
    return applyPartFilter(b,part);
  }
  function frameFromVerCard(card,part){
    /* was: template-parse card.html, clone, re-serialise to outerHTML,
       then framePartFromSnap parsed the string AGAIN — per frame, per
       render. Now parsed once per card object (verCards entries are
       immutable) and cached per part (2026-08-23 perf). */
    var byPart=verNodeCache.get(card);
    if(!byPart){byPart={};verNodeCache.set(card,byPart);}
    var pk=part||'auto';
    if(pk in byPart)
      return byPart[pk]?byPart[pk].cloneNode(true):null;
    var t=document.createElement('template');t.innerHTML=card.html||'';
    var b=t.content.querySelector('.cardbody');
    var out=b?snapPart(stripIds(b.cloneNode(true)),part):null;
    byPart[pk]=out?out.cloneNode(true):null;
    return out;
  }
  function lockChip(c,a,ok){
    c.classList.add('an-locked-ver');
    var lp=lockParts(a);
    var meta=(lp&&verMeta[lp.pkey])||{};
    var msg=a.lockver.msg||meta.msg||'';
    var date=a.lockver.date||meta.date||'';
    var fz=document.createElement('span');
    fz.className='an-lockchip'+(ok?'':' warn');
    fz.innerHTML=bic('lock')+' '+esc(a.lockver.commit);
    fz.title=(ok?'Locked to commit ':'Locked to commit (content '
      +'unavailable — showing live) ')+a.lockver.commit
      +(msg?' — “'+msg+'”':'')+(date?' · '+date:'')
      +'\nRefresh never changes this frame. Unlock via the ribbon.';
    c.appendChild(fz);
  }
  /* render a frame from a REMEMBERED body (the pre-refresh figure).
     The string used to be re-parsed through template.innerHTML on every
     call — multi-MB of HTML, per frame, per rebuild. Now parsed once per
     (html, part) and re-cloned; keyed by the string itself, so the cache
     is content-addressed and cannot go stale (2026-08-23 perf). */
  function framePartFromSnap(html,part){
    var byPart=snapNodeCache.get(html);
    if(!byPart){byPart={};snapNodeCache.set(html,byPart);}
    var pk=part||'auto';
    if(pk in byPart)
      return byPart[pk]?byPart[pk].cloneNode(true):null;
    var t=document.createElement('template');
    t.innerHTML=html;
    var b=t.content.firstElementChild;
    b=b?snapPart(b.cloneNode(true),part):null;
    byPart[pk]=b?b.cloneNode(true):null;
    return b;
  }
  function facetList(ref){
    var f=cellFacets(ref),out=[];
    if(f.figure) out.push('figure');
    if(f.output) out.push('output');
    if(f.code) out.push('code');
    return out;
  }
  /* split a frame into two adjacent frames — one per part (e.g. the
     figure beside its code), each labelled */
  function splitFrame(ai){
    var s=pres.slides[cur]; if(!s) return;
    var a=(s.annots||[])[ai]; if(!a||a.k!=='cell'||!a.ref) return;
    var facs=facetList(a.ref); if(facs.length<2) return;
    var cur0=partOf(a);
    var other=facs.filter(function(x){return x!==cur0;})[0];
    a.part=cur0;
    var w=a.w||46,h=a.h||56,x=a.x||6,y=a.y||6;
    /* split WITHIN the frame's own bounds so the two never overflow or
       overlap: side by side if wide enough, otherwise stacked */
    var half=(w-2)/2;
    if(half>=16){
      a.w=half;
      s.annots.push({k:'cell',ref:a.ref,part:other,
        x:x+half+2,y:y,w:w-half-2,h:h});
    } else {
      var hh=Math.max(16,(h-2)/2);
      a.h=hh;
      s.annots.push({k:'cell',ref:a.ref,part:other,
        x:x,y:y+hh+2,w:w,h:h-hh-2>=16?h-hh-2:hh});
    }
    markDirty();refresh();
  }
  /* the code/figure/output picker shown on a filled frame (+ split) */
  function buildPartChooser(s,ai){
    var a=(s.annots||[])[ai]; if(!a||!a.ref) return null;
    var facs=facetList(a.ref); if(facs.length<2) return null;
    var curp=partOf(a);
    var box=document.createElement('div');box.className='cellparts';
    /* let draw tools (edit mode) still start a shape over the button;
       in the builder (create) or select tool the button always acts */
    function guardDown(e){if(mode!=='edit'||tool==='select') e.stopPropagation();}
    function armed(){return mode!=='edit'||tool==='select';}
    facs.forEach(function(fp){
      var b=document.createElement('button');
      b.className='cellpartbtn'+(fp===curp?' on':'');
      b.textContent=fp;
      b.title='Show the '+fp+' in this frame';
      b.addEventListener('mousedown',guardDown);
      b.addEventListener('click',function(e){
        if(!armed()) return;
        e.stopPropagation();
        if(partOf(a)===fp&&a.part) return;
        a.part=fp;markDirty();refresh();});
      box.appendChild(b);
    });
    var sp=document.createElement('button');
    sp.className='cellpartbtn split';sp.innerHTML=bic('outline')+' split';
    sp.title='Split into two frames — one for each part';
    sp.addEventListener('mousedown',guardDown);
    sp.addEventListener('click',function(e){
      if(!armed()) return;
      e.stopPropagation();splitFrame(ai);});
    box.appendChild(sp);
    return box;
  }
  function typeset(el){
    if(window.MathJax&&MathJax.typesetPromise){
      MathJax.typesetPromise([el]).catch(function(){});}
  }
  function multiNb(){return APP.order.length>1;}
  function nbChip(cls,stem){
    var c=document.createElement('span');c.className=cls;
    c.textContent=stem;return c;
  }
  /* ---------- view mode: slide rendering + vertical code trail ------
     Horizontal = the story; vertical = how each slide was made. Every
     framed card contributes its full upstream chain (open data ->
     transforms -> plot), deduped, in execution order — one cell per
     screen below the slide. */
  var vGroups=[];
  var traceSel=0;          /* which plot's trace shows (thumbnail pick) */
  var traceView='cells';   /* 'cells' list or 'tree' (docs tree, reused) */
  var TRACE_COLORS=['#39a9c0','#ff6b57','#f0a848','#46a892',
    '#c98fd0','#5b8dd6'];
  function hiddenSet(s){
    var h={};(s&&s.hidden||[]).forEach(function(r){h[r]=1;});return h;
  }
  function toggleHidden(s,ns){
    if(!s) return;
    s.hidden=s.hidden||[];
    var i=s.hidden.indexOf(ns);
    if(i>=0) s.hidden.splice(i,1); else s.hidden.push(ns);
    markDirty();
  }
  /* ---- reusable code trace used by the presentation's slide code-trail
     (the docs "Plot trace" instead opens a tab of cloned docs cards) ----
     spec = { groups:[{it,steps,color}], list:()=>[ns hidden],
              toggle:(ns)=>void (persist), showHiddenRef:{v:bool} } */
  function renderTrace(spec){
    spec.showHiddenRef=spec.showHiddenRef||{v:false};
    function rebuild(oldNode){
      var fresh=traceNode(spec,rebuild);
      if(oldNode&&oldNode.parentNode)
        oldNode.parentNode.replaceChild(fresh,oldNode);
      return fresh;
    }
    return rebuild(null);
  }
  /* the presentation wrapper: groups come from the slide's framed plots */
  function buildTrace(s){
    return renderTrace({
      groups:vGroups,
      list:function(){return (s&&s.hidden)||[];},
      toggle:function(ns){toggleHidden(s,ns);}
    });
  }
  /* one lineage group for a SINGLE plot/item (the docs popup) */
  function lineageForItem(ns){
    var it=ITEMS[ns]; if(!it) return null;
    var steps=[],seen={};
    (it.chain||[]).forEach(function(anchor){
      var up=ITEMS[nsKey(it.nb,anchor)];
      /* markdown notes that name a lineage variable ride along in the trace */
      if(up&&(up.hasCode||up.kind==='note')&&!seen[up.ns]){
        seen[up.ns]=1;steps.push(up);}
    });
    if(it.hasCode&&!seen[it.ns]) steps.push(it);
    return {it:it,steps:steps,color:TRACE_COLORS[0]};
  }
  /* ---- per-plot dependency graph (the docs popup) ---- */
  /* the code-kind palette: app.js owns the table (window.SemView.kindFill
     — app.js is spliced before this file in page.html). The literal here
     is only the fallback for a page carrying the deck without app.js. */
  var NODE_FILL=(window.SemView&&window.SemView.kindFill)
    ||{figure:'#39a9c0',diagnostic:'#39a9c0',dataset:'#4d90c0',
    transform:'#5b7589',metric:'#46a892',note:'#cf9a4e',text:'#8ba0b2',
    imports:'#a3855c','function':'#46a892',data:'#4d90c0',constant:'#9a7cc0',
    settings:'#5b7589',plotting:'#39a9c0',print:'#cf9a4e',code:'#8ba0b2'};
  function nodeColor(st){
    if(st.kind==='figure'||st.kind==='diagnostic') return NODE_FILL.figure;
    if(st.kind==='note') return NODE_FILL.note;
    var cks=st.codeKinds||[st.codeKind||'code'];
    return NODE_FILL[cks[0]]||NODE_FILL[st.kind]||'#8ba0b2';
  }
  var SVGNS='http://www.w3.org/2000/svg';
  /* ---- shapes for the "+ Shapes" tool. Geometric ones are SVG <path>s in a
     0..100 box (stretched to the frame, non-scaling stroke); !/? are glyphs.
     'rect' + 'ellipse' stay CSS-drawn (see the an-rect renderer). ---- */
  var SHAPE_PATHS={
    triangle:'M50 6 L95 92 L5 92 Z',
    diamond:'M50 4 L96 50 L50 96 L4 50 Z',
    pentagon:'M50 5 L95 39 L77 93 L23 93 L5 39 Z',
    hexagon:'M27 6 H73 L97 50 L73 94 H27 L3 50 Z',
    star:'M50 3 L61 37 H97 L68 59 L79 95 L50 73 L21 95 L32 59 L3 37 H39 Z',
    cross:'M37 5 H63 V37 H95 V63 H63 V95 H37 V63 H5 V37 H37 Z',
    arrow:'M5 36 H60 V18 L96 50 L60 82 V64 H5 Z',
    heart:'M50 90 C6 56 12 16 50 40 C88 16 94 56 50 90 Z',
    cloud:'M30 82 C12 82 6 58 24 52 C20 30 52 22 58 38 '
      +'C72 26 92 40 84 56 C98 58 96 82 78 82 Z',
    bubble:'M8 8 H92 V66 H44 L24 90 V66 H8 Z',
    lightning:'M58 4 L20 56 H46 L38 96 L82 40 H54 Z'
  };
  var SHAPE_GLYPH={exclaim:'!',question:'?'};

  /* ---- line styles, arrow heads, gradients ---------------------------
     One table per thing, each carrying BOTH how it draws on the canvas
     (SVG) and what it becomes in PowerPoint (OOXML) — the two cannot
     drift, which is the only way "the poster and the .pptx look the
     same" stays true as this list grows. */
  var LINE_STYLES=[
    {id:'solid',label:'Solid',dash:'',ppt:'solid'},
    {id:'dash',label:'Dashed',dash:'9 7',ppt:'dash'},
    {id:'dot',label:'Dotted',dash:'1 6',ppt:'sysDot'},
    {id:'dashdot',label:'Dash-dot',dash:'12 5 2 5',ppt:'dashDot'},
    {id:'lgdash',label:'Long dash',dash:'20 8',ppt:'lgDash'}];
  var LINE_DASH={},LINE_PPT={};
  LINE_STYLES.forEach(function(s){
    LINE_DASH[s.id]=s.dash;LINE_PPT[s.id]=s.ppt;});
  /* an older poster stored a boolean `dash`; read it as the dashed style */
  function lineStyle(a){
    return a.style||(a.dash?'dash':'solid');
  }
  function dashFor(a){return LINE_DASH[lineStyle(a)]||'';}

  /* ---- line weight, in the same currency as everything else ----------
     Every dimension on a page is page-relative: x/y/w/h are percentages,
     text is a percentage of page height resolved at render time (fontPx).
     Line weight was the one exception — `a.sw` went straight out as CSS
     px — so it was the only thing that did not move when the page did.
     Measured: zooming 3.74x grew the text 3.75x and the stroke 1.00x, so
     a line fell from 12.7% of the text height to 3.4% (2026-08-10, user:
     "as you zoom in and out the line stays the same thick on the screen
     whilst the presentation gets smaller").

     `a.sw` now means "pixels on a page 720px tall". 720 is not arbitrary:
     it is the height the 16:9 print page has always been built at, and it
     is within 0.3% of a true 191mm at 96dpi. So every number already on
     disk keeps exactly the weight it has today on a slide, and the same
     number finally means something on a poster, where 3px of ink on a
     1189mm sheet was a 0.8mm hairline beside 31mm text. */
  var SW_REF_H=720;
  var SW_DEFAULT=3;
  function swOf(a){return (a&&a.sw!=null)?a.sw:SW_DEFAULT;}
  function pageScale(layer){
    var h=layer?(layer.getBoundingClientRect().height||0):0;
    return (h||SW_REF_H)/SW_REF_H;
  }
  function strokePx(a,layer){
    /* the same 0.5px guard fontPx uses: it only stops a collapse to zero,
       it is not a legibility floor */
    return Math.max(0.5,swOf(a)*pageScale(layer));
  }
  /* a dash pattern is measured in the same units as the stroke it dashes,
     so it has to scale with it. Left unscaled, a 9px gap on a stroke that
     had shrunk to 0.5px read as a row of dots, and a different pattern at
     every zoom level. */
  function dashPx(a,layer){
    var d=dashFor(a); if(!d) return '';
    var k=pageScale(layer);
    return d.split(' ').map(function(n){
      return (parseFloat(n)*k).toFixed(2);}).join(' ');
  }
  /* what this weight will actually print, for the controls and preflight */
  function swMm(a,pg){
    return swOf(a)/SW_REF_H*((pg||pageOf()).mm[1]||191);
  }

  /* Head shapes are drawn in a 10x10 marker box. `ppt` is the OOXML
     head type; PowerPoint has no "bar", so it degrades to none there and
     the shape says so in its tooltip. */
  var HEADS=[
    {id:'none',label:'None',ppt:'none'},
    {id:'triangle',label:'Triangle',ppt:'triangle',
     path:'M0 0 L10 5 L0 10 z'},
    {id:'stealth',label:'Stealth',ppt:'stealth',
     path:'M0 0 L10 5 L0 10 L3 5 z'},
    {id:'open',label:'Open',ppt:'arrow',
     path:'M0 0 L10 5 L0 10',open:1},
    {id:'diamond',label:'Diamond',ppt:'diamond',
     path:'M0 5 L5 0 L10 5 L5 10 z'},
    {id:'oval',label:'Round',ppt:'oval',
     path:'M5 0 A5 5 0 1 1 4.99 0 z'},
    {id:'bar',label:'Bar',ppt:'none',
     path:'M9 0 L9 10',open:1}];
  var HEAD_BY={};HEADS.forEach(function(h){HEAD_BY[h.id]=h;});
  var HEAD_SIZES=[
    {id:'sm',label:'Small',mul:4.5,ppt:'sm'},
    {id:'md',label:'Medium',mul:6.5,ppt:'med'},
    {id:'lg',label:'Large',mul:9.5,ppt:'lg'},
    {id:'xl',label:'Huge',mul:13,ppt:'lg'}];
  var HEADSZ_BY={};HEAD_SIZES.forEach(function(s){HEADSZ_BY[s.id]=s;});
  /* the end head: older posters used `nohead` to mean "this is a line" */
  function headEnd(a){
    if(a.head!=null) return a.head;
    return a.nohead?'none':'triangle';
  }
  function headStart(a){return a.tail||'none';}
  function headSize(a){return HEADSZ_BY[a.hsz]||HEADSZ_BY.md;}

  /* ---- attached endpoints --------------------------------------------
     An endpoint can be pinned to an item (`a.c1`/`a.c2` = {i:index}).
     Its coordinates are then DERIVED at render time from where that item
     currently is, which is what makes the arrow follow it around. The
     stored x/y stay as a fallback for when the target goes away. */
  function edgePoint(r,tox,toy){
    /* where a line from the rect's centre towards (tox,toy) leaves it —
       so the arrow stops at the border instead of burying its head in
       the middle of the figure */
    var cx=(r.l+r.r)/2,cy=(r.t+r.b)/2;
    var dx=tox-cx,dy=toy-cy;
    if(!dx&&!dy) return {x:cx,y:cy};
    var hw=(r.r-r.l)/2,hh=(r.b-r.t)/2;
    var sx=dx?hw/Math.abs(dx):Infinity,sy=dy?hh/Math.abs(dy):Infinity;
    var t=Math.min(sx,sy);
    return {x:cx+dx*t,y:cy+dy*t};
  }
  function tiedRect(layer,s,c){
    if(!c||typeof c.i!=='number') return null;
    var t=(s.annots||[])[c.i];
    if(!t||t.hide||t.k==='arrow') return null;
    return annotRectPct(layer,s,c.i);
  }
  function arrowEnds(layer,s,a,idx){
    var e={x1:a.x1,y1:a.y1,x2:a.x2,y2:a.y2};
    var r1=tiedRect(layer,s,a.c1),r2=tiedRect(layer,s,a.c2);
    /* aim each attached end at the OTHER end, so both slide around their
       item's border as either one moves */
    var far1=r2?{x:(r2.l+r2.r)/2,y:(r2.t+r2.b)/2}:{x:a.x2,y:a.y2};
    var far2=r1?{x:(r1.l+r1.r)/2,y:(r1.t+r1.b)/2}:{x:a.x1,y:a.y1};
    if(r1){var p1=edgePoint(r1,far1.x,far1.y);e.x1=p1.x;e.y1=p1.y;}
    if(r2){var p2=edgePoint(r2,far2.x,far2.y);e.x2=p2.x;e.y2=p2.y;}
    return e;
  }
  /* straight, curved (quadratic through an offset midpoint) or elbowed.
     Coordinates are PERCENTAGES of the page, and must be converted to
     pixels here: <line> accepted x1="20%", but path data has no units —
     "M20 50" means 20px,50px, so every line and arrow was drawn in a
     60-pixel stub in the top-left corner (2026-08-07, user: "arrow just
     appears in the top left"). Scaling here rather than with a viewBox
     keeps stroke width and arrowheads circular instead of stretched. */
  /* the corners a line is dragged through, if any. Percentages of the
     page like everything else, in the order they are walked. An arrow
     without them is exactly what it always was - two endpoints - so
     nothing that never touches a corner notices they exist (2026-08-20,
     user: "when adding arrows you can really edit all the points and make
     it the exact shape you want"). */
  function arrowMids(a){
    return (a&&Array.isArray(a.mid))?a.mid:[];
  }
  function arrowPath(e,a,W,H){
    W=W||100;H=H||100;
    var x1=e.x1/100*W,y1=e.y1/100*H,x2=e.x2/100*W,y2=e.y2/100*H;
    /* CORNERS win over every canned route: once you have dragged one in by
       hand, "curved" and "elbowed" are no longer describing the line you
       drew. Smoothed with the same Catmull-Rom the freehand tool uses, so
       a dragged corner reads as a bend rather than a kink - unless
       a.sharp says the kink was the point. */
    var mids=arrowMids(a);
    if(mids.length){
      var pts=[[x1,y1]].concat(mids.map(function(m){
        return [m[0]/100*W,m[1]/100*H];}),[[x2,y2]]);
      if(a.sharp)
        return 'M'+pts.map(function(q){return q[0]+' '+q[1];}).join(' L');
      var f=function(n){return Math.round(n*100)/100;};
      var d2='M'+f(pts[0][0])+' '+f(pts[0][1]);
      for(var k=0;k<pts.length-1;k++){
        var q0=pts[k-1]||pts[k],q1=pts[k],q2=pts[k+1],q3=pts[k+2]||pts[k+1];
        d2+='C'+f(q1[0]+(q2[0]-q0[0])/6)+' '+f(q1[1]+(q2[1]-q0[1])/6)
          +','+f(q2[0]-(q3[0]-q1[0])/6)+' '+f(q2[1]-(q3[1]-q1[1])/6)
          +','+f(q2[0])+' '+f(q2[1]);
      }
      return d2;
    }
    var bend=a.bend||'none';
    if(bend==='h')      /* out sideways first, then down/up */
      return 'M'+x1+' '+y1+' L'+((x1+x2)/2)+' '+y1
        +' L'+((x1+x2)/2)+' '+y2+' L'+x2+' '+y2;
    if(bend==='v')
      return 'M'+x1+' '+y1+' L'+x1+' '+((y1+y2)/2)
        +' L'+x2+' '+((y1+y2)/2)+' L'+x2+' '+y2;
    var cv=+a.curve||0;
    if(!cv) return 'M'+x1+' '+y1+' L'+x2+' '+y2;
    /* bow the line out perpendicular to itself; `curve` is a percentage of
       the page, so it scales to pixels like the endpoints do */
    var mx=(x1+x2)/2,my=(y1+y2)/2;
    var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
    var nx=-dy/len,ny=dx/len;
    var bow=cv/100*Math.min(W,H);
    return 'M'+x1+' '+y1+' Q'+(mx+nx*bow)+' '+(my+ny*bow)+' '+x2+' '+y2;
  }
  /* menu order + short labels */
  var SHAPE_LIST=[
    ['rect','Rectangle'],['ellipse','Ellipse'],['triangle','Triangle'],
    ['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],
    ['star','Star'],['cross','Plus'],['arrow','Arrow'],['heart','Heart'],
    ['cloud','Cloud'],['bubble','Speech'],['lightning','Bolt'],
    ['exclaim','Exclaim'],['question','Question']];
  /* the fill a shape actually paints: none, a tint of its own line
     colour (the original behaviour, kept for existing posters), a solid
     colour, or a gradient — linear at an angle, or radiating from the
     centre */
  /* ---- GRADIENTS -------------------------------------------------------
     A gradient is a list of STOPS: [{o:0..1, c:'#rrggbb'}, ...]. It used to
     be exactly two colours in `a` and `b`, which made a three-colour
     gradient impossible to express at all (2026-08-20, user asked for
     "gradients from different directions, multiple colours").
     `a`/`b` are still read on the way IN so every deck saved before this
     keeps its gradient, and every paint boundary projects the resolved
     first/last stops back onto them so the two-colour PowerPoint writer
     need not understand the multi-stop model. */
  function gradStops(g){
    if(!g) return [];
    if(Array.isArray(g.stops)&&g.stops.length>=2) return g.stops;
    return [{o:0,c:g.a||'#39a9c0'},{o:1,c:g.b||'transparent'}];
  }
  /* Resolve a gradient at a PAINT boundary without baking its token
     references back into the deck. Keeping the legacy a/b projection in
     step with the resolved stop list matters to PowerPoint, whose writer
     deliberately supports two stops while the canvas supports any number. */
  function tokenGradient(g,col){
    if(!g) return g;
    var out=deep(g),fallback=tokVal(col)||'#39a9c0';
    out.stops=gradStops(g).map(function(st){
      var cp=deep(st);
      cp.c=tokVal(st.c)||fallback;
      return cp;
    });
    out.a=out.stops[0].c;
    out.b=out.stops[out.stops.length-1].c;
    return out;
  }
  function gradCss(g,col){
    var st=tokenGradient(g,col).stops.map(function(s2){
      return s2.c+' '+Math.round((s2.o||0)*100)+'%';
    }).join(', ');
    if(g.type==='radial')
      return 'radial-gradient(circle at '
        +(g.cx==null?50:g.cx)+'% '+(g.cy==null?50:g.cy)+'%, '+st+')';
    /* CSS measures its angle from "up" and clockwise; the model keeps the
       maths convention the SVG paint server uses, so the two differ by 90 */
    return 'linear-gradient('+((+g.ang||0)+90)+'deg, '+st+')';
  }
  function cssFill(a,col){
    if(!a.fill&&!a.grad) return 'transparent';
    if(a.grad) return gradCss(a.grad,col);
    if(a.fillc) return tokVal(a.fillc);
    return shapeFill(col,0x26/255);
  }
  /* `sw` arrives already resolved to screen pixels by strokePx, and the
     dash has to be resolved against the same page so the two agree */
  /* ---- FREEHAND ------------------------------------------------------
     A drawn stroke is stored the way a shape is — a box in page
     percentages — with its points normalised to 0..1 INSIDE that box. So
     moving, resizing, rotating, opacity, lock, hide, the Objects pane and
     the selection handles all work on it without knowing it exists: they
     only ever touch x/y/w/h. Keeping raw page coordinates instead would
     have meant a special case in every one of those.
     Catmull-Rom through the points, converted to cubics: a hand-drawn
     line has to read as a curve, not as the polygon the mouse reported. */
  function drawPathD(pts){
    if(!pts||!pts.length) return '';
    var P=pts.map(function(q){return [q[0]*100,q[1]*100];});
    var f=function(n){return (Math.round(n*100)/100);};
    if(P.length===1) return 'M'+f(P[0][0])+' '+f(P[0][1])+'l0 0';
    var d='M'+f(P[0][0])+' '+f(P[0][1]);
    for(var i=0;i<P.length-1;i++){
      var p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||P[i+1];
      d+='C'+f(p1[0]+(p2[0]-p0[0])/6)+' '+f(p1[1]+(p2[1]-p0[1])/6)
        +','+f(p2[0]-(p3[0]-p1[0])/6)+' '+f(p2[1]-(p3[1]-p1[1])/6)
        +','+f(p2[0])+' '+f(p2[1]);
    }
    return d;
  }
  function drawFreeSvg(a,layer){
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','an-shape-svg');
    svg.setAttribute('viewBox','0 0 100 100');
    /* stretched to the box like a shape, so the stroke needs the same
       non-scaling-stroke or it would thicken as you widen the drawing */
    svg.setAttribute('preserveAspectRatio','none');
    var p=document.createElementNS(SVGNS,'path');
    p.setAttribute('d',drawPathD(a.pts));
    p.setAttribute('fill','none');
    p.setAttribute('stroke',tokVal(a.color)||'#ff6b57');
    p.setAttribute('stroke-width',strokePx(a,layer));
    p.setAttribute('vector-effect','non-scaling-stroke');
    p.setAttribute('stroke-linecap','round');
    p.setAttribute('stroke-linejoin','round');
    var dsh=dashPx(a,layer);
    if(dsh) p.setAttribute('stroke-dasharray',dsh);
    svg.appendChild(p);
    return svg;
  }
  function drawShapeSvg(shp,col,sw,a,idx,layer){
    col=tokVal(col)||'#ff6b57';
    var dash=dashPx(a,layer);
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','an-shape-svg');
    svg.setAttribute('viewBox','0 0 100 100');
    if(SHAPE_GLYPH[shp]){
      svg.setAttribute('preserveAspectRatio','xMidYMid meet');
      var tx=document.createElementNS(SVGNS,'text');
      tx.setAttribute('x','50');tx.setAttribute('y','54');
      tx.setAttribute('text-anchor','middle');
      tx.setAttribute('dominant-baseline','central');
      tx.setAttribute('font-size','104');tx.setAttribute('font-weight','800');
      tx.setAttribute('fill',col);   /* font comes from CSS (.an-shape-svg text) */
      tx.textContent=SHAPE_GLYPH[shp];
      svg.appendChild(tx);
    } else {
      svg.setAttribute('preserveAspectRatio','none');
      var p=document.createElementNS(SVGNS,'path');
      p.setAttribute('d',SHAPE_PATHS[shp]||'');
      var fillVal='none';
      if(a.grad){
        /* SVG cannot take a CSS gradient string, so the same gradient is
           declared as a paint server and referenced */
        var gid='an-grad-'+(idx==null?'x':idx);
        var gd=document.createElementNS(SVGNS,'defs');
        var g=tokenGradient(a.grad,col);
        var gel=document.createElementNS(SVGNS,
          g.type==='radial'?'radialGradient':'linearGradient');
        gel.setAttribute('id',gid);
        if(g.type!=='radial'){
          var rad=((+g.ang||0))*Math.PI/180;
          gel.setAttribute('x1',(50-50*Math.cos(rad))+'%');
          gel.setAttribute('y1',(50-50*Math.sin(rad))+'%');
          gel.setAttribute('x2',(50+50*Math.cos(rad))+'%');
          gel.setAttribute('y2',(50+50*Math.sin(rad))+'%');
        } else {
          gel.setAttribute('cx',(g.cx==null?50:g.cx)+'%');
          gel.setAttribute('cy',(g.cy==null?50:g.cy)+'%');
          gel.setAttribute('r','62%');
        }
        g.stops.forEach(function(st){
          var s2=document.createElementNS(SVGNS,'stop');
          s2.setAttribute('offset',st.o==null?0:st.o);
          s2.setAttribute('stop-color',st.c);
          gel.appendChild(s2);
        });
        gd.appendChild(gel);svg.appendChild(gd);
        fillVal='url(#'+gid+')';
      } else if(a.fill){
        fillVal=tokVal(a.fillc)||shapeFill(col,0x2b/255);
      }
      p.setAttribute('fill',fillVal);
      p.setAttribute('stroke',col);
      p.setAttribute('stroke-width',sw);
      /* the shape SVG is preserveAspectRatio="none", so without this the
         outline would stretch with the box instead of staying round */
      p.setAttribute('vector-effect','non-scaling-stroke');
      p.setAttribute('stroke-linejoin','round');
      if(dash) p.setAttribute('stroke-dasharray',dash);
      svg.appendChild(p);
    }
    return svg;
  }
  /* ---- text on a curved baseline -------------------------------------
     `a.arc` bows the baseline: positive arches up, negative sags down,
     and the magnitude is how far in percent of the box's width. The flat
     span stays in the DOM (hidden) because it is what carries selection,
     editing and the stored text — the SVG is a rendering of it. */
  function applyTextArc(box,span,a,idx){
    var r=box.getBoundingClientRect();
    var w=r.width,h=r.height;
    if(!w||!h) return;
    var txt=String(a.text||'');
    if(!txt.trim()) return;
    var cs=window.getComputedStyle(span);
    var fs=parseFloat(cs.fontSize)||16;
    var arc=Math.max(-95,Math.min(95,+a.arc||0));
    /* The bow is bounded by the box's OWN height, not its width: scaled
       off the width, an arch on a wide title peaked hundreds of px above
       a one-line box and drew itself off the page. The box is given room
       to hold the arch (see the min-height set before measuring), so a
       deeper curve makes the box taller rather than escaping it. */
    var pad=fs*0.3;
    var avail=Math.max(0,h-fs-2*pad);
    var bow=avail*Math.min(1,Math.abs(arc)/55)*(arc>=0?1:-1);
    var baseY=(arc>=0)?(h-pad):(pad+fs*0.85);
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','an-arcsvg');
    svg.setAttribute('viewBox','0 0 '+w+' '+h);
    svg.setAttribute('width',w);svg.setAttribute('height',h);
    var defs=document.createElementNS(SVGNS,'defs');
    var pid='an-arcp-'+idx;
    var p=document.createElementNS(SVGNS,'path');
    p.setAttribute('id',pid);
    p.setAttribute('fill','none');
    p.setAttribute('d','M '+pad+' '+baseY+' Q '+(w/2)+' '+(baseY-2*bow)
      +' '+(w-pad)+' '+baseY);
    defs.appendChild(p);svg.appendChild(defs);
    var t=document.createElementNS(SVGNS,'text');
    t.setAttribute('font-size',fs);
    t.setAttribute('font-family',cs.fontFamily);
    t.setAttribute('font-weight',cs.fontWeight);
    t.setAttribute('font-style',cs.fontStyle);
    t.setAttribute('fill',cs.color);
    var tp=document.createElementNS(SVGNS,'textPath');
    tp.setAttribute('href','#'+pid);
    tp.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','#'+pid);
    tp.setAttribute('startOffset','50%');
    tp.setAttribute('text-anchor','middle');
    tp.textContent=txt.replace(/\n+/g,' ');
    t.appendChild(tp);svg.appendChild(t);
    box.classList.add('an-arced');
    box.appendChild(svg);
  }
  function plotGraph(group,onNode){
    if(!group) return null;
    /* the dependency graph is CODE lineage — linked markdown notes ride along
       in the trace's card list but are not graph nodes (they aren't
       computational deps, and mixing them in creates note<->definer cycles
       that the transitive reduction can't lay out) */
    var steps=group.steps.filter(function(s){return s.kind!=='note';});
    if(steps.length<2) return null;                 /* nothing to draw */
    var n=steps.length,idx={},i;
    for(i=0;i<n;i++) idx[steps[i].ns]=i;
    /* each step's ancestors that are also in this plot's set (from chain) */
    var anc=steps.map(function(s){
      var set={};
      (s.chain||[]).forEach(function(a){
        var ns=nsKey(s.nb,a); if(idx[ns]!==undefined) set[ns]=1;});
      return set;
    });
    /* direct parents = transitive reduction (drop ancestors reachable
       through another ancestor) */
    var parents=steps.map(function(s,i2){
      var a=Object.keys(anc[i2]);
      return a.filter(function(p){
        return !a.some(function(q){
          return q!==p&&anc[idx[q]]&&anc[idx[q]][p];});
      });
    });
    var depth=[]; for(i=0;i<n;i++) depth.push(-1);
    function dep(i2){
      if(depth[i2]>=0) return depth[i2];
      depth[i2]=0;   /* cycle guard */
      var m=0; parents[i2].forEach(function(p){
        m=Math.max(m,dep(idx[p])+1);});
      depth[i2]=m; return m;
    }
    for(i=0;i<n;i++) dep(i);
    var maxD=0; depth.forEach(function(v){if(v>maxD)maxD=v;});
    var layers=[],L; for(L=0;L<=maxD;L++) layers.push([]);
    for(i=0;i<n;i++) layers[depth[i]].push(i);
    var NW=152,NH=30,GX=20,GY=52,PADX=14,PADY=14,maxCols=0;
    layers.forEach(function(l){if(l.length>maxCols)maxCols=l.length;});
    var W=PADX*2+maxCols*NW+(maxCols-1)*GX;
    var H=PADY*2+(maxD+1)*NH+maxD*GY,pos={};
    layers.forEach(function(l,Ld){
      var rowW=l.length*NW+(l.length-1)*GX,x0=(W-rowW)/2;
      l.forEach(function(i2,k){
        pos[i2]={x:x0+k*(NW+GX),y:PADY+Ld*(NH+GY)};});
    });
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','plotgraph');
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('preserveAspectRatio','xMidYMin meet');
    svg.style.maxHeight=Math.min(H,300)+'px';
    steps.forEach(function(s,i2){
      parents[i2].forEach(function(p){
        var a=pos[idx[p]],b=pos[i2];
        var x1=a.x+NW/2,y1=a.y+NH,x2=b.x+NW/2,y2=b.y,mid=(y1+y2)/2;
        var path=document.createElementNS(SVGNS,'path');
        path.setAttribute('class','pg-edge');
        path.setAttribute('d','M'+x1+' '+y1+' C'+x1+' '+mid+' '
          +x2+' '+mid+' '+x2+' '+y2);
        svg.appendChild(path);
      });
    });
    steps.forEach(function(s,i2){
      var p=pos[i2];
      var g=document.createElementNS(SVGNS,'g');
      g.setAttribute('class','pg-node');
      g.setAttribute('transform','translate('+p.x+','+p.y+')');
      g.setAttribute('tabindex','0');g.setAttribute('role','button');
      var r=document.createElementNS(SVGNS,'rect');
      r.setAttribute('width',NW);r.setAttribute('height',NH);
      r.setAttribute('rx',7);r.setAttribute('fill',nodeColor(s));
      g.appendChild(r);
      var t=document.createElementNS(SVGNS,'text');
      t.setAttribute('x',NW/2);t.setAttribute('y',NH/2+4);
      t.setAttribute('text-anchor','middle');
      var label=s.title||splitRef(s.ns)[1];
      if(label.length>22) label=label.slice(0,21)+'…';
      t.textContent=label;g.appendChild(t);
      var open=function(){onNode?onNode(s):openVFull(s);};
      g.addEventListener('click',open);
      g.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
      svg.appendChild(g);
    });
    var wrap=document.createElement('div');wrap.className='plotgraph-wrap';
    var lbl=document.createElement('div');lbl.className='pg-eyebrow';
    lbl.textContent='dependency graph';
    wrap.appendChild(lbl);wrap.appendChild(svg);
    return wrap;
  }
  function traceItemFor(stem,anchor){
    return resolveRef(stem?nsKey(stem,anchor):anchor)||resolveRef(anchor);
  }
  function lineageFor(s){
    /* one group per framed card, ordered like the frames sit on the
       slide (row by row, left to right); each group = that card's full
       chain + its own code */
    var frames=[],seen={};
    (s.annots||[]).forEach(function(a){
      if(a.k!=='cell'||!a.ref) return;
      var it=resolveRef(a.ref);
      if(it&&!seen[it.ns]){seen[it.ns]=1;frames.push({a:a,it:it});}
    });
    frames.sort(function(p,q){
      var ry=Math.round((p.a.y||0)/12)-Math.round((q.a.y||0)/12);
      return ry!==0?ry:((p.a.x||0)-(q.a.x||0));
    });
    var groups=[];
    frames.forEach(function(f){
      /* a framed markdown note carries no code trail of its own — its chain
         now names its variables' cards (docs feature), but the presentation
         must stay note-free */
      if(f.it.kind==='note') return;
      var steps=[],seen2={};
      (f.it.chain||[]).forEach(function(anchor){
        var ns=nsKey(f.it.nb,anchor);
        var up=ITEMS[ns];
        if(up&&up.hasCode&&!seen2[ns]){seen2[ns]=1;steps.push(up);}
      });
      if(f.it.hasCode&&!seen2[f.it.ns]) steps.push(f.it);
      if(steps.length)
        groups.push({it:f.it,steps:steps,
          color:TRACE_COLORS[groups.length%TRACE_COLORS.length]});
    });
    var flat=[];
    groups.forEach(function(g){
      g.steps.forEach(function(st,k){
        flat.push({it:st,g:g,num:k+1});
      });
    });
    return {groups:groups,flat:flat};
  }
  /* the SELECTED plot's lineage as the docs dependency tree: a pseudo-
     shell (hidden card clones + a .treeview) fed to the docs builder, so
     zoom / width / expand / resize all behave exactly like the Tree view */
  function traceTreeNode(g){
    var wrap=document.createElement('div');
    wrap.className='deck-tracetree';
    var store=document.createElement('div');store.hidden=true;
    var items=[];
    (g.steps||[]).forEach(function(st){
      items.push(st);
      var c=cardEl(st.ns);
      if(c) store.appendChild(c.cloneNode(true));  /* ids kept: the tree
        builder looks nodes up by card id WITHIN this wrapper */
    });
    var tv=document.createElement('div');tv.className='treeview';
    wrap.appendChild(store);wrap.appendChild(tv);
    if(window.SemView&&window.SemView.buildTree)
      window.SemView.buildTree({el:wrap,
        data:{stem:g.it.nb,items:items}});
    return wrap;
  }
  function plotThumb(g,glow){
    var w=document.createElement('div');w.className='vo-plot';
    if(glow){
      w.style.borderColor=g.color;
      w.style.boxShadow='0 0 16px '+g.color+'66';
    }
    var src=paneImgSrc(g.it.ns);
    if(src){
      var im=document.createElement('img');
      im.src=src;im.alt='';w.appendChild(im);
    }
    var tl=document.createElement('span');tl.className='vo-plot-t';
    tl.textContent=g.it.title;w.appendChild(tl);
    return w;
  }
  function openVFull(st){
    var vf=$('#vfull'); if(!vf) return;
    var b=$('#vfull-badge'); if(b) b.textContent=st.kind;
    var t=$('#vfull-t'); if(t) t.textContent=st.title;
    var body=$('#vfull-body');
    if(body){
      body.innerHTML='';
      var c=cloneCode(st.ns);
      if(c) body.appendChild(c);
    }
    vf.hidden=false;
  }
  function closeVFull(){
    var vf=$('#vfull'); if(vf) vf.hidden=true;
    closeSpot();
  }
