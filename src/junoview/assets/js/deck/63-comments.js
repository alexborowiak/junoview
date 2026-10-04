/* 63-comments.js — comments pinned to a slide or an object (T563).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- COMMENTS (T563) --------------------------------------------------
     PowerPoint's Comments, for a deck one person (or a supervisor
     reading over their shoulder) works on: a note left ON the slide --
     "this axis needs units", "cut this?" -- that is part of the working
     document and never part of the talk. A comment is pinned to an
     object (by its durable oid, so it follows the object through every
     move, restyle and reorder) or to a spot on the slide, lives in
     `s.comments`, can be answered and resolved, and is listed in a
     Comments pane beside the page. It is NEVER presented, printed or
     exported: the markers are drawn only while editing, the show and the
     print pages are drawn without them, a .pptx and the review markdown
     never read them, and the standalone page leaves them out of the deck
     it carries. A project save and a .junoview file keep them, the way
     they keep speaker notes.
     Model: s.comments = [{id, text, t, oid?, x?, y?, done?, re?}] where
     `t` is when (ms since 1970), `oid` the object it is on, `x`/`y` the
     spot (page percent) when it is on the slide, `done` 1 once resolved
     and `re` the replies, [{text, t}]. */
  var cmtScope='slide';       /* the pane lists this slide, or every slide */
  var cmtPending=null;        /* where the next comment goes, when a door
                                (the right-click, Ctrl+Alt+M) said so */
  var cmtFlash=null;          /* the comment a marker click asked to see */
  var cmtReplyTo=null;        /* the comment whose reply box is open */
  var cmtSeq=0;
  function cmtId(){
    cmtSeq++;
    return 'c'+Date.now().toString(36)+cmtSeq.toString(36);
  }
  function cmtList(s){
    return (s&&Array.isArray(s.comments))?s.comments:[];
  }
  function cmtOpen(s){
    return cmtList(s).filter(function(c){return c&&!c.done;}).length;
  }
  /* the object a comment is on, as an index on its slide, or -1 (a
     comment on the slide, or on an object since deleted -- which then
     reads as a comment on the slide, rather than vanishing) */
  function cmtIdx(s,c){
    if(!c||!c.oid) return -1;
    var an=(s&&s.annots)||[];
    for(var i=0;i<an.length;i++) if(an[i]&&an[i].oid===c.oid) return i;
    return -1;
  }
  function cmtWhere(s,c){
    var i=cmtIdx(s,c);
    if(i>=0) return 'on '+itemLabel(s,i);
    return c&&c.oid?'on an object since removed':'on the slide';
  }
  function cmtWhen(t){
    var d=Date.now()-(+t||0);
    if(!(d>=0)) return '';
    if(d<60000) return 'just now';
    if(d<3600000) return Math.round(d/60000)+' min ago';
    if(d<86400000) return Math.round(d/3600000)+' h ago';
    try{
      return new Date(+t).toLocaleDateString(undefined,
        {day:'numeric',month:'short',year:'numeric'});
    }catch(e){return '';}
  }
  /* where a new comment will go: what a door named, else the one object
     selected, else the slide */
  function cmtTarget(){
    var s=pres.slides[cur]; if(!s) return null;
    if(cmtPending&&cmtPending.s===s) return cmtPending;
    var ix=selIdxs().filter(function(i){return typeof i==='number';});
    if(ix.length===1){
      ensureOids(s);
      var a=(s.annots||[])[ix[0]];
      if(a&&a.oid) return {s:s,oid:a.oid,i:ix[0]};
    }
    return {s:s};
  }
  function cmtTargetWords(tg){
    if(!tg) return '';
    if(tg.oid){
      var i=cmtIdx(tg.s,{oid:tg.oid});
      return i>=0?('on '+itemLabel(tg.s,i)):'on the slide';
    }
    return tg.x!=null?'on the spot you chose':'on this slide';
  }
  function cmtAdd(text){
    text=String(text||'').trim();
    var tg=cmtTarget(); if(!text||!tg) return null;
    var c={id:cmtId(),text:text,t:Date.now()};
    if(tg.oid) c.oid=tg.oid;
    else if(tg.x!=null){c.x=+tg.x.toFixed(2);c.y=+tg.y.toFixed(2);}
    tg.s.comments=cmtList(tg.s).concat([c]);
    cmtPending=null;
    markDirty();
    cmtRefresh();
    return c;
  }
  /* a comment by its id -- on slide `on` first, when the caller knows
     it: a duplicated slide carries copies of its comments, ids and all,
     and Resolve on one must not resolve its twin */
  function cmtFind(id,on){
    var hit=null;
    (pres.slides||[]).forEach(function(s,si){
      cmtList(s).forEach(function(c){
        if(c.id===id&&(!hit||(s===on&&hit.s!==on))) hit={s:s,si:si,c:c};
      });
    });
    return hit;
  }
  function cmtEdit(id,fn,on){
    var h=cmtFind(id,on); if(!h) return;
    fn(h.c,h.s);
    if(!h.s.comments.length) delete h.s.comments;
    markDirty();
    cmtRefresh();
  }
  function cmtDelete(id,on){
    var h=cmtFind(id,on); if(!h) return;
    h.s.comments=cmtList(h.s).filter(function(c){return c!==h.c;});
    if(!h.s.comments.length) delete h.s.comments;
    markDirty();
    cmtRefresh();
    toastUndo('Comment deleted','Undo',function(){
      if(typeof undo==='function') undo();});
  }
  /* ---- THE MARKERS -------------------------------------------------------
     While editing only. One marker per thing commented on -- an object's
     top-right corner, or the spot -- carrying how many open comments are
     there; resolved ones leave no marker. A press on one opens the pane
     at its comments and goes no further (it is not the object). */
  function cmtMount(layer,s){
    if(!layer) return;
    $$('.cmt-pins',layer).forEach(function(n){n.remove();});
    /* the live page only: never a thumbnail, a ghost page, a print
       page or a History render, which draw slides through here too */
    if(mode!=='edit'||!s||!stage||!stage.contains(layer)) return;
    var open=cmtList(s).filter(function(c){return c&&!c.done;});
    if(!open.length) return;
    var host=document.createElement('div');host.className='cmt-pins';
    var groups={};
    open.forEach(function(c){
      var i=cmtIdx(s,c),key,x,y;
      if(i>=0){
        var r=annotRectPct(layer,s,i);
        if(!r) return;
        key='o'+i;x=r.r;y=r.t;
      } else if(c.x!=null&&c.y!=null){
        key='p'+c.x+','+c.y;x=c.x;y=c.y;
      } else {key='slide';x=98.5;y=1.5;}
      (groups[key]=groups[key]||{x:x,y:y,ids:[]}).ids.push(c.id);
    });
    Object.keys(groups).forEach(function(k){
      var g=groups[k];
      var b=document.createElement('button');
      b.type='button';b.className='cmt-pin';
      b.style.left=Math.max(0,Math.min(100,g.x))+'%';
      b.style.top=Math.max(0,Math.min(100,g.y))+'%';
      b.innerHTML=bic('comment')+(g.ids.length>1
        ?'<span class="cmt-n">'+g.ids.length+'</span>':'');
      var first=(cmtFind(g.ids[0],s)||{}).c;
      b.title=(g.ids.length>1?g.ids.length+' comments: ':'')
        +(first?first.text.slice(0,120):'');
      b.setAttribute('aria-label',g.ids.length+' comment'
        +(g.ids.length===1?'':'s'));
      b.addEventListener('mousedown',function(e){
        e.preventDefault();e.stopPropagation();});
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        cmtFlash=g.ids[0];cmtScope='slide';cmtShow(true);
      });
      host.appendChild(b);
    });
    layer.appendChild(host);
  }
  /* ---- THE PANE ------------------------------------------------------- */
  function cmtShow(on){
    var p=$('#compane'); if(!p) return;
    if(on){paneShow('compane');cmtRender();}
    else paneHide('compane');
  }
  function cmtRefresh(){
    var layer=stage&&stage.querySelector('.annot-layer');
    if(layer) cmtMount(layer,pres.slides[cur]);
    cmtRender();
    if(typeof renderFilm==='function') renderFilm();
  }
  /* typing in the pane is not interrupted by a redraw of it */
  function cmtBusy(){
    var p=$('#compane'),a=document.activeElement;
    return !!(p&&a&&p.contains(a)&&a.tagName==='TEXTAREA'&&a.value);
  }
  /* a duplicated slide's comments arrive with their twins' ids; give the
     copies their own before the pane keys its cards (and its reply box)
     by id. Nothing is lost or added, so no undo step */
  function cmtUniq(){
    var seen={};
    (pres.slides||[]).forEach(function(s){
      cmtList(s).forEach(function(c){
        if(!c) return;
        if(!c.id||seen[c.id]) c.id=cmtId();
        seen[c.id]=1;
      });
    });
  }
  function cmtRender(force){
    var p=$('#compane'),body=$('#compane-body');
    if(!p||p.hidden||!body) return;
    if(!force&&cmtBusy()) return;
    cmtUniq();
    body.innerHTML='';
    var s=pres.slides[cur];
    /* which comments: this slide's, or every slide's */
    var tabs=document.createElement('div');
    tabs.className='anim-tabs cmt-tabs';tabs.setAttribute('role','tablist');
    [['slide','This slide',cmtOpen(s)],
     ['all','All slides',(pres.slides||[]).reduce(function(n,x){
       return n+cmtOpen(x);},0)]].forEach(function(t){
      var b=document.createElement('button');
      b.type='button';b.className='anim-tab';b.setAttribute('role','tab');
      b.setAttribute('aria-selected',(cmtScope===t[0]).toString());
      b.textContent=t[1]+(t[2]?' ('+t[2]+')':'');
      b.addEventListener('click',function(){cmtScope=t[0];cmtRender(true);});
      tabs.appendChild(b);
    });
    body.appendChild(tabs);
    /* the composer: what you write, and where it will go */
    var tg=cmtTarget();
    var comp=document.createElement('div');comp.className='cmt-compose';
    var lab=document.createElement('div');lab.className='cmt-on';
    lab.textContent='New comment '+cmtTargetWords(tg);
    if(cmtPending){
      var clr=document.createElement('button');
      clr.type='button';clr.className='cmt-link';clr.textContent='on the slide instead';
      clr.addEventListener('click',function(){cmtPending=null;cmtRender(true);});
      lab.appendChild(document.createTextNode(' · '));lab.appendChild(clr);
    }
    comp.appendChild(lab);
    var ta=document.createElement('textarea');
    ta.className='ask-in ask-area cmt-ta';ta.id='cmt-new';ta.rows=3;
    ta.placeholder='Select an object to comment on it, or leave nothing '
      +'selected to comment on the slide';
    comp.appendChild(ta);
    var row=document.createElement('div');row.className='cmt-row';
    var hint=document.createElement('span');hint.className='cmt-hint';
    hint.textContent='Ctrl+Enter posts';
    var post=document.createElement('button');
    post.type='button';post.className='dbtn primary';post.textContent='Post';
    function doPost(){
      if(!ta.value.trim()){ta.focus();return;}
      var c=cmtAdd(ta.value);
      if(c){cmtFlash=c.id;ta.value='';cmtRender(true);}
    }
    post.addEventListener('click',doPost);
    ta.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();doPost();}
      if(e.key==='Escape'){e.preventDefault();ta.blur();}
    });
    row.appendChild(hint);row.appendChild(post);
    comp.appendChild(row);
    body.appendChild(comp);
    /* the list */
    var rows=[];
    (pres.slides||[]).forEach(function(sl,si){
      if(cmtScope==='slide'&&sl!==s) return;
      cmtList(sl).forEach(function(c){rows.push({s:sl,si:si,c:c});});
    });
    var open=rows.filter(function(r){return !r.c.done;});
    var done=rows.filter(function(r){return r.c.done;});
    if(!rows.length){
      var none=document.createElement('div');none.className='cmt-empty';
      none.textContent=cmtScope==='slide'?'No comments on this slide.'
        :'No comments in this presentation.';
      body.appendChild(none);
    }
    var lastSi=-1;
    function slideHead(r){
      if(cmtScope!=='all'||r.si===lastSi) return;
      lastSi=r.si;
      var h=document.createElement('button');
      h.type='button';h.className='cmt-slide';
      h.textContent='Slide '+slideNo(r.si)+' · '+(filmText(r.s)||'');
      h.title='Go to this slide';
      h.addEventListener('click',function(){
        if(r.si!==cur){go(r.si);}
      });
      body.appendChild(h);
    }
    open.forEach(function(r){slideHead(r);body.appendChild(cmtCard(r));});
    if(done.length){
      var det=document.createElement('details');det.className='cmt-done';
      var sum=document.createElement('summary');
      sum.textContent='Resolved ('+done.length+')';
      det.appendChild(sum);
      lastSi=-1;
      done.forEach(function(r){det.appendChild(cmtCard(r));});
      body.appendChild(det);
    }
    if(cmtFlash){
      var el=body.querySelector('[data-cm="'+cmtFlash+'"]');
      if(el){
        el.classList.add('cmt-flash');
        try{el.scrollIntoView({block:'nearest'});}catch(e){}
        setTimeout(function(){el.classList.remove('cmt-flash');},1600);
      }
      cmtFlash=null;
    }
  }
  function cmtCard(r){
    var c=r.c,s=r.s;
    var card=document.createElement('div');
    card.className='cmt-card'+(c.done?' done':'');
    card.dataset.cm=c.id;
    var head=document.createElement('div');head.className='cmt-head';
    var on=document.createElement('button');
    on.type='button';on.className='cmt-link';on.textContent=cmtWhere(s,c);
    on.title='Show it';
    on.addEventListener('click',function(){cmtReveal(r);});
    var when=document.createElement('span');when.className='cmt-when';
    when.textContent=cmtWhen(c.t);
    head.appendChild(on);head.appendChild(when);
    card.appendChild(head);
    var tx=document.createElement('div');tx.className='cmt-text';
    tx.textContent=c.text;
    card.appendChild(tx);
    (Array.isArray(c.re)?c.re:[]).forEach(function(rp){
      var re=document.createElement('div');re.className='cmt-re';
      var rt=document.createElement('div');rt.className='cmt-text';
      rt.textContent=rp.text;
      var rw=document.createElement('span');rw.className='cmt-when';
      rw.textContent=cmtWhen(rp.t);
      re.appendChild(rt);re.appendChild(rw);
      card.appendChild(re);
    });
    if(cmtReplyTo===c.id){
      var ra=document.createElement('textarea');
      ra.className='ask-in ask-area cmt-ta';ra.rows=2;ra.placeholder='Reply';
      var rr=document.createElement('div');rr.className='cmt-row';
      var rc=document.createElement('button');
      rc.type='button';rc.className='dbtn';rc.textContent='Cancel';
      rc.addEventListener('click',function(){cmtReplyTo=null;cmtRender(true);});
      var rp2=document.createElement('button');
      rp2.type='button';rp2.className='dbtn primary';rp2.textContent='Reply';
      function send(){
        var v=ra.value.trim(); if(!v) return;
        cmtReplyTo=null;cmtFlash=c.id;
        cmtEdit(c.id,function(cc){
          cc.re=(Array.isArray(cc.re)?cc.re:[]).concat([{text:v,t:Date.now()}]);
          /* answering a resolved comment opens it again */
          delete cc.done;
        },s);
        cmtRender(true);
      }
      rp2.addEventListener('click',send);
      ra.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send();}
        if(e.key==='Escape'){e.preventDefault();cmtReplyTo=null;cmtRender(true);}
      });
      rr.appendChild(rc);rr.appendChild(rp2);
      card.appendChild(ra);card.appendChild(rr);
      setTimeout(function(){try{ra.focus();}catch(e){}},0);
    }
    var acts=document.createElement('div');acts.className='cmt-acts';
    function act(label,title,fn){
      var b=document.createElement('button');
      b.type='button';b.className='dbtn cmt-act';b.textContent=label;
      b.title=title;
      b.addEventListener('click',function(e){e.stopPropagation();fn();});
      acts.appendChild(b);
    }
    if(cmtReplyTo!==c.id)
      act('Reply','Answer this comment',function(){
        cmtReplyTo=c.id;cmtRender(true);});
    act(c.done?'Reopen':'Resolve',c.done
      ?'Bring this back as an open comment'
      :'Mark it dealt with: it leaves the slide and waits under Resolved',
      function(){cmtEdit(c.id,function(cc){
        if(cc.done) delete cc.done; else cc.done=1;},s);});
    act('Delete','Delete this comment and its replies',function(){
      cmtDelete(c.id,s);});
    card.appendChild(acts);
    return card;
  }
  /* go to what a comment is on: its slide, and its object selected */
  function cmtReveal(r){
    var si=(pres.slides||[]).indexOf(r.s); if(si<0) return;
    if(si!==cur) go(si);
    var i=cmtIdx(r.s,r.c);
    var layer=stage&&stage.querySelector('.annot-layer');
    if(i>=0&&layer) selectAnnot(layer,i);
  }
  /* ---- THE DOORS ------------------------------------------------------
     New comment on what is selected (or the slide), from the right-click
     menu (which also knows the SPOT you clicked) and PowerPoint's own
     Ctrl+Alt+M. Each opens the pane with the box ready to type in. */
  function cmtNew(at){
    var s=pres.slides[cur]; if(!s||mode!=='edit') return;
    var ix=selIdxs().filter(function(i){return typeof i==='number';});
    if(ix.length===1){
      ensureOids(s);
      var a=(s.annots||[])[ix[0]];
      cmtPending=(a&&a.oid)?{s:s,oid:a.oid}:{s:s};
    } else if(at&&isFinite(at.x)&&isFinite(at.y)){
      cmtPending={s:s,x:at.x,y:at.y};
    } else cmtPending={s:s};
    cmtScope='slide';
    cmtShow(true);
    var ta=$('#cmt-new'); if(ta) try{ta.focus();}catch(e){}
  }
  /* the right-click menu's row; called from openCanvasMenu with its own
     row builder so it looks like the rows around it */
  function cmtMenuRows(m,row,at){
    menuHead(m,'review');
    row('New comment','Ctrl+Alt+M',function(){cmtNew(at);},
      'A note on this '+(selIdxs().length?'object':'spot')
      +' for you or a reader -- never shown in the talk, a print or an '
      +'export','comment');
  }
  function commentsBoot(){
    var b=$('#comments-btn'),p=$('#compane');
    if(b&&p) b.addEventListener('click',function(){cmtShow(p.hidden);});
    var cl=$('#compane-close');
    if(cl) cl.addEventListener('click',function(){cmtShow(false);});
    document.addEventListener('keydown',function(e){
      if(!(e.ctrlKey||e.metaKey)||!e.altKey) return;
      if(String(e.key).toLowerCase()!=='m'&&e.code!=='KeyM') return;
      if(deckEl.hidden||mode!=='edit') return;
      e.preventDefault();e.stopPropagation();
      cmtNew(null);
    },true);
  }
