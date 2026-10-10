/* 64-collections.js — Collections: cells from any notebook, kept in one
   view with notes of your own (T606-T608).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- COLLECTIONS -----------------------------------------------------
     (2026-10-01, user: "one thing that is annoying is that i am
     consistently filter a notebook over and over again ... it would be
     good if I could create something ... that creates a view similar to
     the notebooks perhaps, but you can add cells and images etc. from
     other notebooks. Would be good to be able to add new cells to this,
     so I could add a figure, then attach some notes to it that appear
     below in a cell like thing, or can be hidden. Also would be cool to
     link things together, like I can add code cells and notes below a
     figure, and clicking the expand shows the code and such that I have
     linked to it.")

     A COLLECTION is a fourth kind of saved thing beside a presentation,
     a poster and a custom view -- kind:'collection' in the same store,
     so it is saved, listed, opened as a tab, renamed and deleted the way
     they are. It reads like a notebook: a feed of cards, in your order,
     each saying which notebook it came from, and the notebook's own
     filters work on it.

       items: [{id, k:'cell', ref, src, title, cap, meta, under, fold}
               {id, k:'note', md, under, fold}]

     A collected CELL is a ref, exactly as a placed slide frame is, and
     its picture is the deck's KEPT COPY (EMBED, embedAssets): taken when
     you collect it, saved with the collection, so it opens with no
     notebook and does not change under you when a notebook is re-run
     ("Update from notebooks" takes the new copies on purpose). `meta`
     carries what the card itself said about the cell -- its kind
     classes and data-* -- so the filters read a collected card as they
     read the original. A NOTE is your own markdown cell. `under` is
     what you linked to an item: notes, its code (the cells Plot trace
     finds), other cells -- shown beneath it in a drawer you can fold. */
  function isColPres(p){return !!(p&&p.kind==='collection');}
  var COL_PFX='col::';
  function colKey(name){return COL_PFX+name;}
  function colId(){
    return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
  function colNormItem(it,ns,top){
    if(!it||typeof it!=='object') return null;
    var o={id:(typeof it.id==='string'&&it.id)?it.id:colId()};
    if(it.k==='note'){
      o.k='note';o.md=typeof it.md==='string'?it.md:'';
    } else if(typeof it.ref==='string'&&it.ref){
      o.k='cell';o.ref=ns(it.ref);
      o.src=(typeof it.src==='string'&&it.src)?it.src
        :(splitRef(o.ref)[0]||'');
      if(typeof it.title==='string') o.title=it.title;
      if(typeof it.cap==='string'&&it.cap) o.cap=it.cap;
      if(it.meta&&typeof it.meta==='object') o.meta=deep(it.meta);
    } else return null;
    if(top&&Array.isArray(it.under)){
      var u=it.under.map(function(x){return colNormItem(x,ns,false);})
        .filter(Boolean);
      if(u.length) o.under=u;
    }
    if(it.fold) o.fold=1;
    if(+it.at>0) o.at=+it.at;
    return o;
  }
  /* normPres hands a collection here: the same namespacing of refs, the
     same absorbing of its embedded copies, and nothing a deck carries */
  function colNorm(p,stem){
    function ns(a){
      if(!a) return a;
      if(String(a).indexOf('::')>=0) return a;
      return stem?nsKey(stem,a):(normRef(a)||a);
    }
    var out={name:String(p.name||'collection'),kind:'collection',
      slides:[],items:[]};
    (Array.isArray(p.items)?p.items:[]).forEach(function(it){
      var o=colNormItem(it,ns,true); if(o) out.items.push(o);});
    if(typeof p.folder==='string'&&p.folder) out.folder=p.folder;
    embAbsorb(p,ns);
    return out;
  }
  /* every cell a collection shows, for embedAssets */
  function colRefsOf(p){
    var out=[];
    (p&&p.items||[]).forEach(function(it){
      if(it.k==='cell'&&it.ref) out.push(it.ref);
      (it.under||[]).forEach(function(u){
        if(u.k==='cell'&&u.ref) out.push(u.ref);});
    });
    return out;
  }
  function colNames(){
    var seen={},out=[];
    allSaved().concat(draftNames().map(function(n){
      return loadDraft(n)||{};})).forEach(function(p){
      if(isColPres(p)&&p.name&&!seen[p.name]){seen[p.name]=1;out.push(p.name);}
    });
    if(isColPres(pres)&&pres.name&&!seen[pres.name]) out.push(pres.name);
    /* the one you used last first */
    var meta=deckMetaAll();
    out.sort(function(a,b){
      return ((meta[b]||{}).edited||0)-((meta[a]||{}).edited||0);});
    return out;
  }
  /* ---- the model, current or not ---------------------------------------
     A collection is edited where it is: as `pres` when it is the one open
     (so undo, autosave and the readout see it like any deck), or as its
     stored copy when something is collected INTO it from a notebook
     while a presentation is the current one -- switching `pres` under an
     open builder to file a figure would be the wrong surprise. */
  function colModel(name){
    if(pres&&pres.name===name&&isColPres(pres)) return pres;
    var p=presentationByName(name);
    return isColPres(p)?normPres(deep(p)):null;
  }
  function colCommit(model){
    if(model===pres){markDirty();}
    else {
      /* its browser copy, which is what opening it reads first; the
         project file takes it the next time it is open and saved, by the
         one path every deck takes there */
      draftSet(model.name,JSON.stringify(model));
      deckMetaSet(model.name,{edited:Date.now(),slides:0});
    }
    colRefresh(model.name);
  }
  /* ---- taking a cell out of a notebook ---------------------------------
     The kept copy is captured NOW, from the live card (fromLive, so a
     deck's own kept copy of the same ref is not what gets filed), the way
     embedAssets captures a frame; the card's own facts ride in `meta`. */
  function colCapture(ref){
    var it=resolveRef(ref); if(!it) return false;
    var b=cloneBody(ref,true); if(!b) return false;
    var e={title:it.title||'',kind:it.kind||'',html:b.outerHTML};
    var cc=cloneCode(ref);
    if(cc) e.code=cc.outerHTML;
    embStore(normRef(ref)||ref,e);
    embSaveSoon();
    return true;
  }
  function colItemFromCard(stem,card){
    if(!stem||!card||!card.dataset.anchor) return null;
    var ref=nsKey(stem,card.dataset.anchor);
    if(!resolveRef(ref)) return null;
    colCapture(ref);
    var d=card.dataset;
    var keep=[].filter.call(card.classList,function(c){
      return /^(k-|has-|ckmain-)/.test(c);});
    var meta={cls:keep.join(' ')};
    ['kind','role','note','noout','labelled','ck'].forEach(function(k){
      if(d[k]!=null&&d[k]!=='') meta[k]=d[k];});
    var bd=card.querySelector('.cardhead .badge');
    if(bd) meta.badge=bd.textContent.trim();
    var cw=card.querySelector(':scope>.codewrap');
    if(cw){meta.cw=cw.className.replace(/\bcode-off\b/g,'').trim();
      if(cw.classList.contains('bare')) meta.cwOpen=1;}
    var ti=card.querySelector('.cardhead .cardtitle');
    var o={id:colId(),k:'cell',ref:normRef(ref)||ref,src:stem,
      title:ti?ti.textContent.trim():'',meta:meta,at:Date.now()};
    var cap=card.querySelector(':scope>.caption');
    if(cap&&cap.innerHTML.trim()) o.cap=cap.innerHTML;
    return o;
  }
  /* the cells Plot trace finds behind a figure, minus the figure itself:
     what "its code" means when you attach it */
  function colCodeCards(stem,card){
    if(!card||!card.dataset.anchor) return [];
    var it=traceItemFor(stem,card.dataset.anchor);
    if(!it||it.emb) return [];
    var g=lineageForItem(it.ns); if(!g) return [];
    var out=[];
    g.steps.forEach(function(s){
      if(s.ns===it.ns||!s.hasCode) return;
      var c=cardEl(s.ns); if(c) out.push(c);
    });
    return out;
  }
  /* ---- adding -------------------------------------------------------- */
  function colAdd(name,items,underId){
    var model=colModel(name); if(!model||!items.length) return 0;
    var host=model.items;
    if(underId){
      var par=null;
      model.items.forEach(function(x){if(x.id===underId) par=x;});
      if(!par) return 0;
      par.under=par.under||[];host=par.under;
      delete par.fold;   /* what you just linked is what you want to see */
    }
    var have={},n=0;
    host.forEach(function(x){if(x.ref) have[x.ref]=1;});
    items.forEach(function(it){
      if(!it) return;
      if(it.ref&&have[it.ref]) return;
      if(it.ref) have[it.ref]=1;
      host.push(it);n++;
    });
    if(n) colCommit(model);
    return n;
  }
  function newCollection(then){
    var n=1,nm='collection';
    while(presentationByName(nm)){n++;nm='collection '+n;}
    askText({title:'New collection',
      what:'A collection keeps cells from any of your notebooks in one '
        +'view, in your order, with notes of your own beside them.',
      value:nm,ok:'Create'},function(v){
      v=String(v==null?'':v).trim();
      if(!v) return;
      if(presentationByName(v)){
        colToast('There is already something called “'+v+'”');
        return;}
      var model={name:v,kind:'collection',slides:[],items:[]};
      draftSet(v,JSON.stringify(model));
      deckMetaSet(v,{edited:Date.now(),slides:0});
      if(then) then(v); else openCollection(v);
    });
  }
  /* ---- saying so, on the document side -------------------------------- */
  function colToast(msg,acts){
    var t=$('#doc-toast'); if(!t){toast(msg);return;}
    t.textContent=msg+' ';
    (acts||[]).forEach(function(a){
      var b=document.createElement('button');
      b.type='button';b.className='toast-act';b.textContent=a[0];
      b.addEventListener('click',function(){t.hidden=true;a[1]();});
      t.appendChild(b);
    });
    t.hidden=false;
    clearTimeout(t._tm);
    t._tm=setTimeout(function(){t.hidden=true;},acts&&acts.length?9000:4500);
  }
  function colSaid(name,n,what){
    if(!n){colToast('Already in “'+name+'”');return;}
    colToast((what||(n+' cell'+(n===1?'':'s')))+' added to “'
      +name+'”.',[['Open',function(){openCollection(name);}]]);
  }
  /* ---- THE COLLECT MENU ------------------------------------------------
     One small menu for every door: a cell's Collect, the Filters tab's
     Collect showing, a collection's own Link. Each collection is a row,
     the one you used last first; New collection... makes one and files
     into it. `pick(name)` does the filing. */
  var colMenuEl=null;
  function colMenuClose(){
    if(colMenuEl){colMenuEl.remove();colMenuEl=null;}
  }
  document.addEventListener('click',function(e){
    if(colMenuEl&&!colMenuEl.contains(e.target)) colMenuClose();});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&colMenuEl){e.stopPropagation();colMenuClose();}
  },true);
  function colMenu(anchor,o){
    var again=colMenuEl&&colMenuEl._for===anchor;
    colMenuClose();
    if(again) return;
    /* MEASURED BEFORE IT IS BUILT (2026-10-09, speed: reader #19): the
       button's place read after the menu went in made the browser lay
       out the page with the menu half-made, and focusing it scrolled it
       into view -- a second layout. Read first, then write, and focus
       without scrolling (it is placed on screen already). */
    var r=anchor.getBoundingClientRect();
    var m=document.createElement('div');
    m.className='col-menu';m.setAttribute('role','menu');m._for=anchor;
    var h=document.createElement('div');h.className='col-menu-h';
    h.textContent=o.head||'Add to a collection';
    m.appendChild(h);
    var withCode=null;
    if(o.code){
      withCode=document.createElement('button');
      withCode.type='button';withCode.className='col-menu-chip';
      var on=false;
      try{on=localStorage.getItem('jv-collect-code')==='1';}catch(e){}
      withCode.setAttribute('aria-pressed',on?'true':'false');
      withCode.innerHTML=bic('code')+' With the code that makes it';
      withCode.title='Also link the cells Plot trace finds behind this '
        +'figure, under it';
      withCode.addEventListener('click',function(e){
        e.stopPropagation();
        var v=withCode.getAttribute('aria-pressed')!=='true';
        withCode.setAttribute('aria-pressed',v?'true':'false');
        try{localStorage.setItem('jv-collect-code',v?'1':'0');}catch(e2){}
      });
      m.appendChild(withCode);
    }
    function wants(){
      return !!(withCode&&withCode.getAttribute('aria-pressed')==='true');}
    colNames().forEach(function(nm){
      var r=document.createElement('button');
      r.type='button';r.className='col-menu-row';r.setAttribute('role','menuitem');
      r.innerHTML=bic('newcol')+'<span></span>';
      r.querySelector('span').textContent=nm;
      r.addEventListener('click',function(e){
        e.stopPropagation();colMenuClose();o.pick(nm,wants());});
      m.appendChild(r);
    });
    var nw=document.createElement('button');
    nw.type='button';nw.className='col-menu-row col-menu-new';
    nw.setAttribute('role','menuitem');
    nw.innerHTML=bic('plus')+'<span>New collection…</span>';
    nw.addEventListener('click',function(e){
      e.stopPropagation();
      var w=wants();
      colMenuClose();
      newCollection(function(nm){o.pick(nm,w);});
    });
    m.appendChild(nw);
    document.body.appendChild(m);
    colMenuEl=m;
    var mh=m.offsetHeight,mw=m.offsetWidth;
    var top=r.bottom+4;
    if(top+mh>window.innerHeight-8)
      top=Math.max(8,r.top-4-mh);
    m.style.top=Math.round(top)+'px';
    m.style.left=Math.round(Math.max(6,Math.min(r.left,
      window.innerWidth-mw-6)))+'px';
    var first=m.querySelector('.col-menu-row');
    if(first) try{first.focus({preventScroll:true});}
      catch(e){first.focus();}
  }
  /* a notebook card's Collect */
  function colCollectCard(btn,stem,card){
    var fig=!!card.querySelector('.cb-fig');
    colMenu(btn,{code:fig,pick:function(name,withCode){
      var it=colItemFromCard(stem,card);
      if(!it){colToast('That cell could not be read');return;}
      if(withCode){
        var under=colCodeCards(stem,card).map(function(c){
          return colItemFromCard(stem,c);}).filter(Boolean);
        if(under.length) it.under=under;
      }
      var n=colAdd(name,[it]);
      colSaid(name,n,n?('“'+(it.title||'This cell')+'”'
        +(it.under?(' and '+it.under.length+' cell'
          +(it.under.length===1?'':'s')+' of its code'):'')):'');
    }});
  }
  /* the Filters tab's Collect showing: every card the filters leave on
     screen in this notebook, in order -- the setup you keep redoing,
     filed once */
  function colShowingCards(){
    var A=window.SemApp||{};
    var sh=A.active&&A.shells&&A.shells[A.active];
    if(!sh||!sh.el||sh.collection) return null;
    var stem=sh.trace?sh.source:A.active;
    var cards=$$('.content .card',sh.el).filter(function(c){
      return c.getClientRects().length&&!c.classList.contains('is-hidden');});
    return {stem:stem,cards:cards};
  }
  function colCollectShowing(btn){
    var s=colShowingCards();
    if(!s){colToast('Open a notebook first — Collect showing keeps '
      +'the cells it shows');return;}
    if(!s.cards.length){colToast('Nothing is showing to collect');return;}
    colMenu(btn,{head:'Add the '+s.cards.length+' cells showing to',
      pick:function(name){
        var items=s.cards.map(function(c){
          return colItemFromCard(s.stem,c);}).filter(Boolean);
        var n=colAdd(name,items);
        colSaid(name,n);
      }});
  }
  /* ---- opening one -------------------------------------------------- */
  function openCollection(name){
    var A=window.SemApp||{};
    name=name||(pres&&pres.name);
    if(!name) return;
    if(!(pres&&pres.name===name&&isColPres(pres))){
      if(A.exitStyling) A.exitStyling();
      lsSet(PFX+'last',name);
      loadPresentation(name);
    }
    if(!isColPres(pres)) return;
    if(!deckEl.hidden) closeDeck();
    notePresentationOpen(name);
    colShow();
  }
  function colShell(name){
    var A=window.SemApp||{};
    var key=colKey(name),sh=A.shells&&A.shells[key];
    if(sh) return sh;
    var el=document.createElement('div');
    el.className='shell nbshell tracetab coltab';
    el.dataset.nb=key;el.dataset.col=name;
    var rail=document.createElement('aside');rail.className='rail';
    el.appendChild(rail);
    var stage=document.createElement('main');stage.className='stage';
    var content=document.createElement('div');content.className='content';
    stage.appendChild(content);
    var tv=document.createElement('div');tv.className='treeview';
    stage.appendChild(tv);
    el.appendChild(stage);
    ($('#docs')||document.body).appendChild(el);
    sh={el:el,data:{stem:key,items:[]},path:'',title:name,
      trace:true,collection:true,source:null};
    A.shells[key]=sh;
    if(!A.cols) A.cols=[];
    if(A.cols.indexOf(key)<0) A.cols.push(key);
    return sh;
  }
  /* GOING BACK TO A COLLECTION IS NOT DRAWING IT AGAIN (2026-10-09,
     speed). Its tab, after a notebook's, rebuilt every card from the
     kept copies -- 240 ms at 4x for 27 items, growing with the list --
     to show what the shell still held. Every change to a collection
     redraws its shell where it is made (colCommit -> colRefresh), open
     or not; so the shell is drawn again only when it was drawn from
     another copy of the collection, from other items, or before a
     notebook opened, reloaded or closed or a kept copy changed
     (deckViewGen: what a cell's copy is read from). */
  function colDrawSig(model){
    return [model.name,JSON.stringify(model.items||[]),
      JSON.stringify(model.live||null)].join('\n');
  }
  function colShow(){
    var A=window.SemApp||{};
    var sh=colShell(pres.name);
    var drawn=sh._colDrawn;
    if(!(drawn&&drawn.model===pres&&drawn.view===deckViewGen
         &&drawn.sig===colDrawSig(pres)))
      colRender(sh,pres);
    if(A.activate) A.activate(colKey(pres.name));
    if(A.refilter) A.refilter(sh.el);
    renderPresTabs();
  }
  function colClose(key){
    var A=window.SemApp||{};
    var sh=A.shells&&A.shells[key]; if(!sh) return;
    if(sh.el.parentNode) sh.el.parentNode.removeChild(sh.el);
    delete A.shells[key];
    if(A.cols) A.cols=A.cols.filter(function(k){return k!==key;});
    if(A.active===key){
      A.active=null;
      var back=(A.order||[]).slice(-1)[0];
      if(back&&A.activate) A.activate(back);
      else if(A.refreshChrome) A.refreshChrome();
    }
  }
  /* an open collection's shell follows its tab: closed, deleted or
     renamed, the shell goes (renderPresTabs calls this) */
  function colSync(){
    var A=window.SemApp||{};
    var open=openPresentationNames();
    (A.cols||[]).slice().forEach(function(key){
      var nm=key.slice(COL_PFX.length);
      if(open.indexOf(nm)<0||!isColPres(presentationByName(nm))) colClose(key);
    });
  }
  function colRefresh(name){
    var A=window.SemApp||{};
    var sh=A.shells&&A.shells[colKey(name)]; if(!sh) return;
    var model=colModel(name); if(!model) return;
    colRender(sh,model);
    if(A.refilter) A.refilter(sh.el);
  }
  /* ---- THE FEED --------------------------------------------------------
     Rebuilt whole on every change: a collection is a page of cards, not
     thousands, and one renderer cannot disagree with itself. */
  var COL_CODETOGGLE='<button class="codetoggle" aria-expanded="false">'
    +'<span class="chev">›</span><span class="ct-show">Show code</span>'
    +'<span class="ct-hide">Hide code</span></button>';
  function colBtn(icon,word,title,fn,cls){
    var b=document.createElement('button');
    b.type='button';b.className='col-btn'+(cls?' '+cls:'');
    b.innerHTML=icon+'<span>'+esc(word)+'</span>';
    b.title=title;
    b.addEventListener('click',function(e){e.stopPropagation();fn(b);});
    return b;
  }
  /* a note's title is its opening heading, if it has one; `nav` asks
     for the outline's row, which says the first line either way */
  function colTitleOf(it,nav){
    if(it.k==='note'){
      var first=String(it.md||'').split('\n').filter(function(l){
        return l.trim();})[0]||'';
      var head=/^\s*#{1,4}\s+/.test(first);
      if(!head&&!nav) return 'Note';
      first=first.replace(/^\s*#+\s*/,'').replace(/[*_`]/g,'').trim();
      return first.length>70?first.slice(0,68)+'…':(first||'Note');
    }
    return it.title||'Cell';
  }
  function colCellCard(it){
    var m=it.meta||{};
    var c=document.createElement('article');
    c.className='card in col-card '+(m.cls||'');
    c.id='card-col-'+it.id;
    c.dataset.col=it.id;c.dataset.secid='col';
    ['kind','role','note','noout','labelled','ck'].forEach(function(k){
      if(m[k]!=null&&m[k]!=='') c.dataset[k]=m[k];});
    var head=document.createElement('header');head.className='cardhead';
    var bd=document.createElement('span');bd.className='badge';
    bd.textContent=m.badge||m.kind||'cell';
    var t=document.createElement('h3');t.className='cardtitle';
    t.textContent=colTitleOf(it);
    head.appendChild(bd);head.appendChild(t);
    var src=document.createElement('button');
    src.type='button';src.className='col-src';
    src.innerHTML=bic('open')+'<span></span>';
    src.querySelector('span').textContent=it.src||'notebook';
    src.title='From '+(it.src||'a notebook')
      +' — click to see this cell there';
    src.addEventListener('click',function(e){
      e.stopPropagation();colGoSource(it);});
    head.appendChild(src);
    c.appendChild(head);
    var b=cloneBody(it.ref);
    if(!b){
      b=document.createElement('div');b.className='cardbody col-missing';
      b.textContent='Open '+(it.src||'its notebook')+' and press Update '
        +'from notebooks — there is no copy of this cell here yet.';
    }
    c.appendChild(b);
    if(it.cap){
      var p=document.createElement('p');p.className='caption';
      p.innerHTML=it.cap;c.appendChild(p);
    }
    var code=frameCode(it.ref);
    if(code){
      var cw=document.createElement('div');
      cw.className=m.cw||'codewrap';
      if(m.cwOpen) cw.setAttribute('data-open','1');
      cw.innerHTML=COL_CODETOGGLE;
      var cb=document.createElement('div');cb.className='codebody';
      cb.appendChild(code);cw.appendChild(cb);
      c.appendChild(cw);
    }
    return c;
  }
  function colNoteCard(it,model){
    var c=document.createElement('article');
    c.className='card in k-note col-card col-note';
    c.id='card-col-'+it.id;
    c.dataset.col=it.id;c.dataset.secid='col';
    c.dataset.kind='note';c.dataset.role='markdown';c.dataset.note='1';
    c.dataset.noout='0';c.dataset.labelled='1';
    var head=document.createElement('header');head.className='cardhead';
    var bd=document.createElement('span');bd.className='badge';
    bd.textContent='your note';
    var t=document.createElement('h3');t.className='cardtitle';
    t.textContent=colTitleOf(it);
    head.appendChild(bd);head.appendChild(t);
    c.appendChild(head);
    var body=document.createElement('div');body.className='cardbody';
    var nt=document.createElement('div');nt.className='note';
    /* a note that opens with a heading wears it as its title, once */
    var md=String(it.md||'');
    var lead=/^\s*#{1,4}\s+[^\n]*\n?/.exec(md);
    if(lead) md=md.slice(lead[0].length);
    nt.innerHTML=md.trim()?notesHtml(md)
      :(it.md?'':'<p class="col-hint">An empty note — Edit to write it.</p>');
    body.appendChild(nt);c.appendChild(body);
    /* a double-click is the quick way in, as on a slide's text */
    nt.addEventListener('dblclick',function(){colEditNote(c,it,model);});
    return c;
  }
  function colEditNote(card,it,model){
    if(card.querySelector('.col-edit')) return;
    var body=card.querySelector('.cardbody');
    var nt=body.querySelector('.note');
    var box=document.createElement('div');box.className='col-edit';
    var ta=document.createElement('textarea');
    ta.value=it.md||'';ta.rows=Math.max(4,Math.min(18,
      String(it.md||'').split('\n').length+2));
    ta.setAttribute('aria-label','Your note, in Markdown');
    ta.placeholder='Write in Markdown: **bold**, *italic*, - lists, '
      +'# headings, `code`';
    var row=document.createElement('div');row.className='col-edit-row';
    var save=document.createElement('button');save.type='button';
    save.className='col-btn primary';save.textContent='Save';
    save.title='Keep this note (Ctrl+Enter)';
    var cancel=document.createElement('button');cancel.type='button';
    cancel.className='col-btn';cancel.textContent='Cancel';
    cancel.title='Leave the note as it was (Esc)';
    row.appendChild(cancel);row.appendChild(save);
    box.appendChild(ta);box.appendChild(row);
    if(nt) nt.hidden=true;
    body.appendChild(box);
    function done(keep){
      if(keep){it.md=ta.value;colCommit(model);}
      else colRefresh(model.name);
    }
    save.addEventListener('click',function(e){e.stopPropagation();done(true);});
    cancel.addEventListener('click',function(e){e.stopPropagation();done(false);});
    ta.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();done(true);}
      else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false);}
    });
    ta.focus();
  }
  /* where an item sits: its list and its place in it */
  function colWhere(model,id){
    var hit=null;
    model.items.forEach(function(x,i){
      if(x.id===id) hit={list:model.items,i:i,top:true,item:x};
      (x.under||[]).forEach(function(u,j){
        if(u.id===id) hit={list:x.under,i:j,top:false,item:u,parent:x};});
    });
    return hit;
  }
  function colMove(model,id,dir){
    var w=colWhere(model,id); if(!w) return;
    var j=w.i+dir; if(j<0||j>=w.list.length) return;
    var t=w.list[j];w.list[j]=w.list[w.i];w.list[w.i]=t;
    colCommit(model);
  }
  function colRemove(model,id){
    var w=colWhere(model,id); if(!w) return;
    var gone=w.list.splice(w.i,1)[0];
    if(w.parent&&!w.parent.under.length) delete w.parent.under;
    colCommit(model);
    colToast('Removed “'+colTitleOf(gone,true)+'”.',[['Undo',function(){
      var m2=colModel(model.name); if(!m2) return;
      var list=m2.items;
      if(w.parent){
        var par=null;m2.items.forEach(function(x){
          if(x.id===w.parent.id) par=x;});
        if(!par) return;
        par.under=par.under||[];list=par.under;
      }
      list.splice(Math.min(w.i,list.length),0,gone);
      colCommit(m2);
    }]]);
  }
  function colAddNote(model,underId){
    var it={id:colId(),k:'note',md:'',at:Date.now()};
    if(underId){
      var w=colWhere(model,underId); if(!w) return;
      w.item.under=w.item.under||[];w.item.under.push(it);
      delete w.item.fold;
    } else model.items.push(it);
    colCommit(model);
    var A=window.SemApp||{};
    var sh=A.shells&&A.shells[colKey(model.name)];
    var card=sh&&sh.el.querySelector('#card-col-'+it.id);
    if(card){
      card.scrollIntoView({block:'center'});
      colEditNote(card,it,colModel(model.name)||model);
    }
  }
  /* T608: what "its code" is, read from the notebook it came from */
  function colAttachCode(model,it){
    var card=cardEl(it.ref);
    if(!card){
      colToast('Open '+(it.src||'its notebook')+' to find the code that '
        +'makes this — Plot trace reads it from the notebook');
      return;
    }
    var stem=(resolveRef(it.ref)||{}).nb||it.src;
    var under=colCodeCards(stem,card).map(function(c){
      return colItemFromCard(stem,c);}).filter(Boolean);
    if(!under.length){
      colToast('Plot trace finds no other code behind this cell');return;}
    var n=colAdd(model.name,under,it.id);
    colToast(n?(n+' cell'+(n===1?'':'s')+' of code linked under “'
      +colTitleOf(it,true)+'”'):'Its code is already linked here');
  }
  /* T608: link any cell from an open notebook under an item */
  function colPick(title,cb){
    var A=window.SemApp||{};
    var rows=[];
    (A.order||[]).forEach(function(stem){
      var sh=A.shells[stem]; if(!sh||!sh.el) return;
      $$('.content .card',sh.el).forEach(function(c){
        if(!c.dataset.anchor) return;
        var ti=c.querySelector('.cardhead .cardtitle');
        var bd=c.querySelector('.cardhead .badge');
        rows.push({stem:stem,card:c,title:ti?ti.textContent.trim():'',
          badge:bd?bd.textContent.trim():''});
      });
    });
    if(!rows.length){
      colToast('Open a notebook to link one of its cells');return;}
    var ov=document.createElement('div');ov.className='col-pick';
    var box=document.createElement('div');box.className='col-pick-box';
    box.setAttribute('role','dialog');box.setAttribute('aria-label',title);
    var h=document.createElement('div');h.className='col-pick-h';
    h.textContent=title;
    var q=document.createElement('input');q.type='search';
    q.className='col-pick-q';q.placeholder='Find a cell by its title or notebook';
    q.setAttribute('aria-label','Find a cell');
    var list=document.createElement('div');list.className='col-pick-list';
    var foot=document.createElement('div');foot.className='col-pick-foot';
    var x=document.createElement('button');x.type='button';
    x.className='col-btn';x.textContent='Cancel';
    foot.appendChild(x);
    box.appendChild(h);box.appendChild(q);box.appendChild(list);
    box.appendChild(foot);ov.appendChild(box);
    document.body.appendChild(ov);
    function shut(){ov.remove();document.removeEventListener('keydown',key,true);}
    function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();shut();}}
    document.addEventListener('keydown',key,true);
    ov.addEventListener('click',function(e){if(e.target===ov) shut();});
    x.addEventListener('click',shut);
    function paint(){
      var words=q.value.toLowerCase().split(/\s+/).filter(Boolean);
      list.innerHTML='';
      rows.filter(function(r){
        var hay=(r.title+' '+r.stem+' '+r.badge).toLowerCase();
        return words.every(function(w){return hay.indexOf(w)>=0;});
      }).slice(0,200).forEach(function(r){
        var b=document.createElement('button');b.type='button';
        b.className='col-pick-row';
        var bd=document.createElement('span');bd.className='badge';
        bd.textContent=r.badge||'cell';
        var t=document.createElement('span');t.className='col-pick-t';
        t.textContent=r.title||'(untitled cell)';
        var s=document.createElement('span');s.className='col-pick-s';
        s.textContent=r.stem;
        b.appendChild(bd);b.appendChild(t);b.appendChild(s);
        b.addEventListener('click',function(){shut();cb(r.stem,r.card);});
        list.appendChild(b);
      });
      if(!list.children.length){
        var none=document.createElement('div');none.className='col-pick-none';
        none.textContent='No cell matches';list.appendChild(none);
      }
    }
    q.addEventListener('input',paint);
    q.addEventListener('keydown',function(e){
      if(e.key==='Enter'){var f=list.querySelector('.col-pick-row');
        if(f){e.preventDefault();f.click();}}
    });
    paint();q.focus();
  }
  function colLinkCell(model,it){
    colPick('Link a cell under “'+colTitleOf(it,true)+'”',
      function(stem,card){
        var o=colItemFromCard(stem,card); if(!o) return;
        var n=colAdd(model.name,[o],it.id);
        colToast(n?('Linked “'+o.title+'”'):'That cell is already linked here');
      });
  }
  function colGoSource(it){
    var A=window.SemApp||{};
    var ri=resolveRef(it.ref);
    var stem=(ri&&!ri.emb&&ri.nb)||'';
    if(!stem||!A.shells[stem]){
      colToast((it.src||'Its notebook')+' is not open — open it to '
        +'see this cell in place');return;}
    A.activate(stem);
    var c=cardEl(it.ref);
    if(c){c.scrollIntoView({behavior:'smooth',block:'center'});
      c.classList.add('target-flash');
      setTimeout(function(){c.classList.remove('target-flash');},1400);}
  }
  /* "Update from notebooks": every collected cell whose notebook is open
     takes that notebook's current copy -- on purpose, never by itself */
  function colUpdate(model){
    var n=0,miss={};
    colRefsOf(model).forEach(function(ref){
      if(cardEl(ref)){if(colCapture(ref)) n++;}
      else miss[splitRef(ref)[0]||'?']=1;
    });
    colRefresh(model.name);
    var m=Object.keys(miss);
    colToast(n?('Updated '+n+' cell'+(n===1?'':'s')+' from '
      +'their notebooks'+(m.length?(' — '+m.join(', ')+' '
        +(m.length===1?'is':'are')+' not open'):'')+'.')
      :('Nothing to update — open the notebooks these cells came '
        +'from first.'));
  }
  function colBar(model,it,top){
    var bar=document.createElement('footer');bar.className='col-bar';
    if(it.k==='note') bar.appendChild(colBtn(bic('pen'),'Edit','Write this note '
      +'(or double-click it)',function(){
        var A=window.SemApp||{};
        var sh=A.shells[colKey(model.name)];
        var card=sh&&sh.el.querySelector('#card-col-'+it.id);
        if(card) colEditNote(card,it,model);}));
    if(top){
      bar.appendChild(colBtn(bic('newnote'),'Note','Add a note of your own '
        +'under this',function(){colAddNote(model,it.id);}));
      if(it.k==='cell'){
        bar.appendChild(colBtn(bic('code'),'Its code','Link the cells Plot '
          +'trace finds behind this, under it',function(){
            colAttachCode(model,it);}));
        bar.appendChild(colBtn(bic('link'),'Link a cell','Link any cell from '
          +'an open notebook under this',function(){
            colLinkCell(model,it);}));
      }
    }
    var sp=document.createElement('span');sp.className='col-bar-sp';
    bar.appendChild(sp);
    bar.appendChild(colBtn(bic('up'),'Up','Move this up',function(){
      colMove(model,it.id,-1);}));
    bar.appendChild(colBtn(bic('down'),'Down','Move this down',function(){
      colMove(model,it.id,1);}));
    bar.appendChild(colBtn(bic('exit'),'Remove','Take this out of the '
      +'collection (its notebook keeps it)',function(){
        colRemove(model,it.id);},'col-rm'));
    return bar;
  }
  function colItemEl(model,it,top){
    var card=it.k==='note'?colNoteCard(it,model):colCellCard(it);
    card.appendChild(colBar(model,it,top));
    if(!top) card.classList.add('col-att');
    return card;
  }
  function colUnderWords(list){
    var notes=list.filter(function(u){return u.k==='note';}).length;
    var cells=list.length-notes,w=[];
    if(notes) w.push(notes+' note'+(notes===1?'':'s'));
    if(cells) w.push(cells+' cell'+(cells===1?'':'s'));
    return w.join(', ');
  }
  function colRender(sh,model){
    var A=window.SemApp||{};
    var el=sh.el,name=model.name;
    sh.title=name;
    var items=model.items||[];
    var srcs={};
    colRefsOf(model).forEach(function(r){srcs[splitRef(r)[0]||'?']=1;});
    var nsrc=Object.keys(srcs);
    /* the rail: one row per item, as a notebook's outline has */
    var rail=el.querySelector('.rail');rail.innerHTML='';
    var rh=document.createElement('div');rh.className='railhead';
    var rt=document.createElement('h1');rt.className='railtitle';
    rt.textContent=name;
    var rm=document.createElement('div');rm.className='railmeta';
    rm.textContent=items.length+' item'+(items.length===1?'':'s')
      +(nsrc.length?(' · from '+nsrc.join(', ')):'');
    rh.appendChild(rt);rh.appendChild(rm);rail.appendChild(rh);
    var nav=document.createElement('nav');nav.className='nav';
    nav.setAttribute('aria-label','Collection');
    items.forEach(function(it){
      var a=document.createElement('a');
      a.className='navitem '+(it.k==='note'?'k-note'
        :((it.meta||{}).cls||'').split(' ').filter(function(c){
          return /^k-/.test(c);})[0]||'k-code');
      a.href='#card-col-'+it.id;
      var d=document.createElement('span');d.className='dot';
      var t=document.createElement('span');t.className='navitem-t';
      t.textContent=colTitleOf(it,true);
      a.appendChild(d);a.appendChild(t);nav.appendChild(a);
    });
    nav.addEventListener('click',function(e){
      var a=e.target.closest?e.target.closest('.navitem'):null;
      if(!a) return;
      e.preventDefault();
      var c=el.querySelector(a.getAttribute('href'));
      if(c){c.scrollIntoView({behavior:'smooth',block:'center'});
        c.classList.add('target-flash');
        setTimeout(function(){c.classList.remove('target-flash');},1200);}
    });
    rail.appendChild(nav);
    /* the feed */
    var content=el.querySelector('.content');content.innerHTML='';
    var head=document.createElement('div');
    head.className='tracetab-head col-head';
    var eb=document.createElement('span');eb.className='tracetab-eyebrow';
    eb.textContent='collection';
    var h=document.createElement('h2');h.className='tracetab-t';
    h.textContent=name;
    h.title='Double-click to rename';
    h.addEventListener('dblclick',function(){colRename(model);});
    var sub=document.createElement('span');sub.className='tracetab-sub';
    sub.textContent=items.length
      ?(items.length+' item'+(items.length===1?'':'s')
        +(nsrc.length?(' from '+nsrc.join(', ')):''))
      :'empty';
    var tools=document.createElement('div');tools.className='col-tools';
    tools.appendChild(colBtn(bic('newnote'),'Add a note','A note of your own, '
      +'at the end',function(){colAddNote(model,null);}));
    tools.appendChild(colBtn(bic('link'),'Add a cell','Any cell from an open '
      +'notebook, at the end',function(){
        colPick('Add a cell to “'+name+'”',function(stem,card){
          var o=colItemFromCard(stem,card); if(!o) return;
          var n=colAdd(name,[o]);
          colToast(n?('Added “'+o.title+'”'):'Already in this collection');
        });}));
    tools.appendChild(colBtn(bic('reload'),'Update from notebooks','Take the '
      +'current copy of every cell whose notebook is open',function(){
        colUpdate(colModel(name)||model);}));
    tools.appendChild(colBtn(bic('pen'),'Rename','Give this collection a new '
      +'name',function(){colRename(model);}));
    head.appendChild(eb);head.appendChild(h);head.appendChild(sub);
    head.appendChild(tools);
    content.appendChild(head);
    var sec=document.createElement('section');
    sec.className='section col-sec';sec.dataset.sec='col';
    sec.id='sec-col';
    if(!items.length){
      var empty=document.createElement('div');empty.className='col-empty';
      empty.innerHTML='<b>Nothing collected yet.</b> Press <b>'
        +bic('collect')+' Collect</b> on any cell in a notebook, or '
        +'<b>Collect showing</b> on the Filters tab to keep everything '
        +'the filters leave on screen. <b>Add a note</b> above writes one '
        +'of your own.';
      sec.appendChild(empty);
    }
    items.forEach(function(it){
      var g=document.createElement('div');g.className='col-group';
      g.dataset.col=it.id;
      g.appendChild(colItemEl(model,it,true));
      if(it.under&&it.under.length){
        var u=document.createElement('div');u.className='col-under';
        var open=!it.fold;
        var fb=document.createElement('button');fb.type='button';
        fb.className='col-fold';
        fb.setAttribute('aria-expanded',open?'true':'false');
        fb.innerHTML='<span class="chev">›</span><span></span>';
        fb.querySelector('span:last-child').textContent='Linked: '
          +colUnderWords(it.under);
        fb.title=open?'Fold away what is linked under this'
          :'Show what is linked under this';
        fb.addEventListener('click',function(e){
          e.stopPropagation();
          if(it.fold) delete it.fold; else it.fold=1;
          colCommit(model);
        });
        var ub=document.createElement('div');ub.className='col-under-body';
        ub.hidden=!open;
        it.under.forEach(function(x){ub.appendChild(colItemEl(model,x,false));});
        u.appendChild(fb);u.appendChild(ub);
        g.appendChild(u);
      }
      sec.appendChild(g);
    });
    content.appendChild(sec);
    /* the document side's own wiring: code toggles, figure zoom, plots */
    if(A.wireCardBehaviors) A.wireCardBehaviors(sec,colKey(name));
    if(A.activateOutputs) A.activateOutputs(sec,true);
    typeset(sec);   /* through the page's typesetter (jvMath) */
    /* what this shell was drawn from (colShow's way back) */
    sh._colDrawn={model:model,view:deckViewGen,sig:colDrawSig(model)};
  }
  function colRename(model){
    askText({title:'Rename collection',value:model.name,ok:'Rename'},
      function(v){
        v=String(v==null?'':v).trim();
        if(!v||v===model.name) return;
        var old=model.name;
        if(!(pres&&pres.name===old)) openCollection(old);
        if(renamePresentation(v)){
          colClose(colKey(old));
          openCollection(v);
        }
      });
  }
  /* ---- the doors ------------------------------------------------------ */
  window.SemCollect={
    card:colCollectCard,
    showing:colCollectShowing,
    open:openCollection,
    names:colNames
  };
  function colBoot(){
    var nb=$('#pr-newcol');
    if(nb) nb.addEventListener('click',function(){newCollection();});
    var cs=$('#ab-collect');
    if(cs) cs.addEventListener('click',function(e){
      e.stopPropagation();colCollectShowing(cs);});
  }
