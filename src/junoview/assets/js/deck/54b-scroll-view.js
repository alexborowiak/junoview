/* 54b-scroll-view.js — every slide one under the next, while you build
   them (T622). ONE FRAGMENT of deck.js's single IIFE, concatenated with
   its siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- T622: THE SCROLL VIEW ---------------------------------------------
     (2026-10-09, user, the same day T620 gave the scrolling page its
     lines: "the infinite scroll is only a present thing, like I want it
     as a view when just creating slides as well. Like that is better
     when creating slides too"). View > Scroll view stacks every slide in
     the editor's stage, one under the next, and you scroll through the
     deck as you build it.

     The editor edits ONE slide: the selection, the ribbon, the panes,
     undo and the strip all read `cur` and the stage's one live page, and
     they stay that way. So the slide you are on is the real page, in its
     place in the column, and every other slide is a PICTURE of itself,
     drawn by the export's own renderer (fillPrintPage) at the live
     page's size. Scroll, and the slide that settles in the middle of the
     view becomes the one you are on; click a picture and it is, with
     what you clicked selected. The picture and the live page are the
     same size, so the swap moves nothing.

     The live page stays the stage's FIRST child -- renderSlide builds it
     there, and the editor's 140-odd lookups take
     stage.querySelector('.slide') and '.annot-layer' to mean it -- and
     the pictures follow it in the DOM, put in deck order by CSS `order`.
     A picture carries no ids and no contenteditable, and its page is
     inert: a picture of a control is never a second control (the ghost
     layer's rule, T497). Its items keep data-idx, which its own arrows
     find their ends by; every lookup by data-idx is the live layer's.

     A picture is redrawn only when what it shows changed -- its slide,
     its place, or the deck-wide things every slide wears -- and only
     once it is near the view, so a long deck costs what is on screen.

     Between the slides: the scrolling page's own choice (T620), one
     setting for both -- a faint line, a strong one, none, or spaced.
     Like that page, a way of looking: remembered in this browser, never
     stored with the deck. */
  var SV_KEY='junoview:deck:scrollview';
  var svOn=false;
  var svSlots=[],svSeps=[];       /* by deck position */
  var svW=0,svH=0;                /* the live page's size, and every picture's */
  var svLastCur=-1,svFromScroll=false,svIgnoreUntil=0,svPointer=false;
  var svSettleT=null,svNearT=null,svFrame=0;
  var svDeckSigAt=0,svDeckSigWas='';
  /* what every slide wears, so a change to one of these redraws them all */
  var SV_DECK_KEYS=['page','pageBg','tokens','styles','types','masters',
    'showNums','scale','pad','wmark','head','foot','sections','cite','bib',
    'name','components'];
  function svActive(){
    return svOn&&mode==='edit'&&!!pres&&!deckEl.hidden;
  }
  /* the pages the column shows: one per slide, and a slide's versions
     are one page here as in the strip -- the one you are on, or the
     first */
  function svShown(){
    var out=[];
    (pres.slides||[]).forEach(function(s,k){
      var r=altRun(k);
      if(!r){out.push(k);return;}
      var pick=(cur>=r.at&&cur<r.at+r.n)?cur:r.at;
      if(k===pick) out.push(k);
    });
    return out;
  }
  function svPageSize(){
    var pg=pageOf();
    if(pg.id==='16x9') return [1280,720];      /* .print-page's own size */
    return [Math.round(pg.mm[0]/25.4*96),Math.round(pg.mm[1]/25.4*96)];
  }
  function svDeckSig(){
    var now=Date.now();
    if(now-svDeckSigAt<250) return svDeckSigWas;
    var o={};
    SV_DECK_KEYS.forEach(function(k){if(pres[k]!==undefined) o[k]=pres[k];});
    try{svDeckSigWas=JSON.stringify(o);}catch(e){svDeckSigWas=String(now);}
    svDeckSigAt=now;
    return svDeckSigWas;
  }
  function svSig(k,deck){
    var s=pres.slides[k];
    try{return k+'|'+JSON.stringify(s)+'|'+deck;}catch(e){return '';}
  }
  function svSlot(k){
    var sl=svSlots[k];
    if(sl) return sl;
    var el=document.createElement('div');
    el.className='sv-pic';el.dataset.si=String(k);
    el.setAttribute('aria-hidden','true');
    /* a press on a picture is a press on that slide; nothing behind the
       stage hears it (no marquee starts on the live page) */
    el.addEventListener('pointerdown',function(e){
      if(e.button!==0) return;
      e.preventDefault();e.stopPropagation();
      svGoTo(+el.dataset.si,e.clientX,e.clientY);
    });
    el.addEventListener('mousedown',function(e){e.stopPropagation();});
    sl=svSlots[k]={el:el,sig:''};
    return sl;
  }
  function svSep(k){
    var e=svSeps[k];
    if(!e){
      e=svSeps[k]=document.createElement('div');
      e.className='sv-sep';e.setAttribute('aria-hidden','true');
    }
    return e;
  }
  function svFit(sl){
    sl.el.style.width=svW+'px';sl.el.style.height=svH+'px';
    var pg=sl.el.firstElementChild;
    if(pg&&pg.dataset.pw)
      pg.style.zoom=(svW/(+pg.dataset.pw)).toFixed(4);
  }
  /* sizeSlideTo, every time the live page is sized */
  function svSize(w,h){
    if(!svActive()) return;
    if(Math.abs(w-svW)<0.5&&Math.abs(h-svH)<0.5) return;
    svW=w;svH=h;
    svSlots.forEach(function(sl){if(sl) svFit(sl);});
    svSeps.forEach(function(e){if(e) e.style.width=w+'px';});
    /* every page above this one changed height too: a zoom or a resize
       keeps the slide you are on in view, once the column has settled */
    requestAnimationFrame(function(){
      var live=svActive()&&stage.firstElementChild;
      if(live) svReveal(live);
    });
  }
  /* one picture, drawn the way the export draws a page: view mode,
     fully built, nothing selected, the editor's own frame of a flip
     book -- and everything put back */
  function svPaint(k,deck){
    var sl=svSlots[k],s=pres.slides[k];
    if(!sl||!s||!sl.el.isConnected) return false;
    var sig=svSig(k,deck);
    if(sig&&sl.sig===sig) return false;
    var nat=svPageSize();
    sl.el.textContent='';
    var bg=pageBgOf(s);
    sl.el.style.setProperty('--page-bg',bg);
    /* lit for itself, as the live page is (applyPageBg) */
    sl.el.classList.toggle('page-light',pageIsLight(bg));
    var page=document.createElement('div');page.className='print-page';
    page.style.width=nat[0]+'px';page.style.height=nat[1]+'px';
    page.dataset.pw=String(nat[0]);
    page.setAttribute('inert','');
    sl.el.appendChild(page);
    var m=mode,rc=revealCount,c=cur,sa=selAnnot,ss=selSet,ff=flipForce;
    mode='view';revealCount=99999;cur=k;selAnnot=null;selSet=[];
    flipForce=null;printAll=1;
    try{fillPrintPage(page,s,k,pageOf());}
    catch(err){
      if(window.console&&console.error)
        console.error('Junoview: slide '+(k+1)+' could not be drawn',err);
    }
    finally{
      mode=m;revealCount=rc;cur=c;selAnnot=sa;selSet=ss;flipForce=ff;
      printAll=0;
    }
    $$('[id],[contenteditable]',page).forEach(function(n){
      n.removeAttribute('id');n.removeAttribute('contenteditable');});
    $$('.sel,.grpsel',page).forEach(function(n){
      n.classList.remove('sel','grpsel','an-grouped');});
    $$('.an-grpframe',page).forEach(function(n){n.remove();});
    /* a clip in a picture is a still: it never plays, never speaks */
    $$('video,audio',page).forEach(function(md){
      try{md.pause();}catch(e){}
      md.removeAttribute('autoplay');md.muted=true;});
    svFit(sl);
    if(typeset) typeset(page);
    sl.sig=sig;
    return true;
  }
  /* a picture's own arrows, when a figure on it finishes fitting
     (scheduleArrowRedraw hands them here) */
  function svArrowsSoon(layer){
    clearTimeout(layer._svArrT);
    layer._svArrT=setTimeout(function(){
      var s=layer._paintSlide;
      if(!s||!layer.isConnected) return;
      var m=mode,sa=selAnnot,ss=selSet;
      mode='view';selAnnot=null;selSet=[];
      try{redrawArrows(layer,s);}
      finally{mode=m;selAnnot=sa;selSet=ss;}
    },0);
  }
  /* the pictures on screen now (urgent), or near it */
  function svPaintPass(near,limit){
    if(!svActive()) return 0;
    var deck=svDeckSig(),r=stage.getBoundingClientRect(),done=0;
    var reach=near?Math.max(400,r.height):0;
    svShown().some(function(k){
      if(k===cur) return false;
      var sl=svSlots[k]; if(!sl||!sl.el.isConnected) return false;
      var b=sl.el.getBoundingClientRect();
      if(b.bottom<r.top-reach||b.top>r.bottom+reach) return false;
      if(svPaint(k,deck)) done++;
      return !!limit&&done>=limit;
    });
    return done;
  }
  function svNearSoon(){
    clearTimeout(svNearT);
    svNearT=setTimeout(function(){svPaintPass(true);},90);
  }
  /* the slide the click landed on becomes the one you edit, and the
     thing under the pointer is selected, as a click on the live page
     would have done */
  function svGoTo(k,x,y){
    if(!pres.slides[k]) return;
    if(k!==cur){
      svFromScroll=true;
      try{go(k);}finally{svFromScroll=false;}
    }
    var layer=stage.querySelector('.annot-layer');
    if(!layer) return;
    var hit=(x!=null)&&document.elementFromPoint(x,y);
    var it=hit&&hit.closest&&hit.closest('.an-item[data-idx]');
    var idx=it&&layer.contains(it)&&it.getAttribute('data-idx');
    /* nothing under the pointer (or a scroll): the SLIDE is selected, as
       a thumbnail click selects it (T516) -- so the ribbon leaves Style
       or Object for a selection that is gone */
    selectAnnot(layer,(idx&&/^\d+$/.test(idx))?+idx:null);
  }
  /* bring the live page into view: centred if it fits, its top if not */
  function svReveal(el){
    var r=stage.getBoundingClientRect(),b=el.getBoundingClientRect();
    if(b.top>=r.top&&b.bottom<=r.bottom) return;
    var to=(b.height<=r.height)
      ?stage.scrollTop+(b.top-r.top)-(r.height-b.height)/2
      :stage.scrollTop+(b.top-r.top)-18;
    svIgnoreUntil=performance.now()+250;
    stage.scrollTop=Math.max(0,to);
  }
  /* renderSlide, every time, at its very end: the column around the
     page it has just built */
  function svAfterRender(top){
    var on=svActive();
    var was=stage.classList.contains('sv');
    deckEl.classList.toggle('scrollview',on);
    stage.classList.toggle('sv',on);
    if(!on){if(was||svSlots.length) svDrop();return;}
    stage.setAttribute('data-sep',scrollSepGet());
    var live=stage.firstElementChild;
    if(!live) return;
    live.classList.add('sv-live');
    /* the live page is lit for itself here; the deck carries no
       .page-light while the column is up (applyPageBg) */
    if(!was) applyPageBg();
    live.classList.toggle('page-light',
      pageIsLight(pageBgOf(pres.slides[cur])));
    var n=(pres.slides||[]).length;
    for(var k=n;k<svSlots.length;k++){
      if(svSlots[k]) svSlots[k].el.remove();
      if(svSeps[k]) svSeps[k].remove();
    }
    svSlots.length=Math.min(svSlots.length,n);
    svSeps.length=Math.min(svSeps.length,n);
    svShown().forEach(function(k,i){
      var el=live;
      if(k!==cur){
        var sl=svSlot(k);
        el=sl.el;
        stage.appendChild(el);
        if(svW) svFit(sl);
      }
      el.style.order=String(k*2);
      if(i){
        var sep=svSep(k);
        sep.style.order=String(k*2-1);
        if(svW) sep.style.width=svW+'px';
        stage.appendChild(sep);
      }
    });
    /* the stage just took the column's shape: measure the page again
       in it before anything is placed by its size */
    if(!was) applyZoom();
    svIgnoreUntil=performance.now()+250;
    stage.scrollTop=top;
    var moved=(cur!==svLastCur);
    svLastCur=cur;
    if(moved&&!svFromScroll) svReveal(live);
    svPaintPass(false);       /* what is on screen, now: no empty page */
    svNearSoon();             /* and what is next to it, in a moment */
  }
  function svDrop(){
    svSlots.forEach(function(sl){if(sl) sl.el.remove();});
    svSeps.forEach(function(e){if(e) e.remove();});
    svSlots=[];svSeps=[];svLastCur=-1;svW=0;svH=0;
    stage.removeAttribute('data-sep');
    var live=stage.firstElementChild;
    if(live){
      live.classList.remove('sv-live','page-light');live.style.order='';}
    applyPageBg();             /* the deck is lit by the live page again */
  }
  /* scrolling: draw what comes into view a frame at a time, and when it
     settles, the slide in the middle is the one you are on */
  function svOnScroll(){
    if(!svActive()) return;
    if(!svFrame) svFrame=requestAnimationFrame(function(){
      svFrame=0;
      if(svPaintPass(false,1)) svOnScroll();
    });
    svNearSoon();
    if(performance.now()<svIgnoreUntil) return;
    clearTimeout(svSettleT);
    svSettleT=setTimeout(svSettle,160);
  }
  function svSettle(){
    svSettleT=null;
    if(!svActive()||svPointer) return;
    /* typing in a box: the slide stays yours until you leave it */
    var ae=document.activeElement;
    if(ae&&ae.isContentEditable&&stage.contains(ae)) return;
    var r=stage.getBoundingClientRect(),mid=r.top+r.height/2;
    var at=-1,best=1e9,live=stage.firstElementChild;
    svShown().forEach(function(k){
      var el=(k===cur)?live:(svSlots[k]&&svSlots[k].el);
      if(!el||!el.isConnected) return;
      var b=el.getBoundingClientRect();
      var d=(mid<b.top)?b.top-mid:(mid>b.bottom?mid-b.bottom:0);
      if(d<best){best=d;at=k;}
    });
    if(at>=0&&at!==cur) svGoTo(at);
  }
  /* the View tab's two tiles, and the setting the scrolling page shares */
  function svSyncBtns(){
    var b=$('#vw-scroll'),l=$('#vw-scroll-lines'),t=$('#vw-scroll-lines-t');
    if(b) b.setAttribute('aria-pressed',svOn?'true':'false');
    if(l){
      var v=scrollSepGet(),name='Faint line';
      SCROLL_SEPS.forEach(function(o){if(o[0]===v) name=o[1];});
      l.disabled=!svOn;
      l.setAttribute('aria-label','Between slides: '+name);
      if(t&&t.textContent!==name) t.textContent=name;
    }
  }
  function svToggle(){
    svOn=!svOn;
    lsSet(SV_KEY,svOn?'1':'',true);
    if(!svOn) svDrop();
    else stage.classList.add('sv');       /* measured in its column shape */
    svLastCur=-1;
    renderSlide();
    svSyncBtns();
  }
  function svNextSep(){
    var v=scrollSepGet(),i=0;
    SCROLL_SEPS.forEach(function(o,j){if(o[0]===v) i=j;});
    var nx=SCROLL_SEPS[(i+1)%SCROLL_SEPS.length][0];
    lsSet(SCROLL_SEP_KEY,nx,true);
    if(svActive()){
      var live=stage.firstElementChild;
      var keep=live?live.getBoundingClientRect().top:0;
      stage.setAttribute('data-sep',nx);
      /* the page you are on stays where it was on screen */
      if(live){
        svIgnoreUntil=performance.now()+250;
        stage.scrollTop+=live.getBoundingClientRect().top-keep;
      }
    }
    svSyncBtns();
  }
  function scrollViewBoot(){
    svOn=lsGet(SV_KEY)==='1';
    var b=$('#vw-scroll'),l=$('#vw-scroll-lines');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();svToggle();});
    if(l) l.addEventListener('click',function(e){
      e.stopPropagation();svNextSep();});
    stage.addEventListener('scroll',svOnScroll,{passive:true});
    /* a drag on the live page is not a scroll to settle */
    stage.addEventListener('pointerdown',function(){svPointer=true;},true);
    window.addEventListener('pointerup',function(){svPointer=false;},true);
    window.addEventListener('pointercancel',function(){svPointer=false;},true);
    svSyncBtns();
  }
