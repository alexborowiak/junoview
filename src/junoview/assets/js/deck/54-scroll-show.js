  /* ---- T389: THE SCROLLING VERSION OF A PRESENTATION -------------------
     (2026-09-12, user: "could there be a continuous scroll version of
     presentations, with some like 'animate as scrolling down', so the
     animations only appear on first scroll down then just are there
     after that"). Every slide, fully built, one under the other, in an
     overlay you scroll: the same pages the PDF and the standalone
     export are made of (buildPrintRoot), scaled to the window's width.
     Each page's animated objects are held back until the page first
     scrolls into view, then play their own entrance in build order, a
     beat apart -- and stay. Scroll back up and nothing replays: a page
     is animated once, like a web page is.

     Nothing is stored; this is a way of showing the deck, not a
     property of it. Esc closes it, the arrow keys step a page. */
  var scrollShowEl=null,scrollShowIo=null,scrollShowKey=null;
  var SCROLL_STAGGER=0.18;
  /* ---- T620: WHAT SITS BETWEEN THE SLIDES ------------------------------
     (2026-10-09, user: "it would be cool if there was an infinite scroll
     view. Essentially just you can scroll between all of the different
     slides and they are next to each other instead of having to click.
     Then there is just a small feint grey line or something that marks
     between slides (would be cool if this could be ticked on or off as
     well, and be feint or strong actually)"). T389's pages were cards a
     gap apart with a shadow under each. Now they run edge to edge with a
     faint line between them, a strong one or none, and the spaced cards
     are still one of the choices. The line is its own element between
     two pages, outside their zoom, so it is a real 1px (or 2px) at every
     window width; it is drawn ACROSS the join in a see-through grey, so
     it reads as a quiet line on white slides and on dark ones alike.
     A way of looking, like the scrolling page itself: remembered in this
     browser, never stored with the deck. */
  var SCROLL_SEP_KEY='junoview:deck:scrollsep';
  var SCROLL_SEPS=[['faint','Faint line'],['strong','Strong line'],
    ['none','No line'],['gap','Spaced']];
  function scrollSepGet(){
    var v=lsGet(SCROLL_SEP_KEY)||'';
    for(var i=0;i<SCROLL_SEPS.length;i++)
      if(SCROLL_SEPS[i][0]===v) return v;
    return 'faint';
  }
  function scrollSepShow(v){
    if(!scrollShowEl) return;
    scrollShowEl.setAttribute('data-sep',v);
    $$('.deck-scroll-sepb',scrollShowEl).forEach(function(b){
      b.setAttribute('aria-pressed',b.dataset.sep===v?'true':'false');});
  }
  function scrollSepSet(v){
    /* where you are stays where you are: the pages above you grow or
       lose their gaps, so hold the page in view and put it back */
    var body=scrollShowEl&&scrollShowEl.querySelector('.deck-scroll-body');
    var pages=scrollShowPages(),at=null,off=0;
    if(body){
      var top=body.scrollTop;
      pages.forEach(function(p){
        if(scrollShowPageTop(body,p)<=top+1) at=p;});
      if(at) off=top-scrollShowPageTop(body,at);
    }
    lsSet(SCROLL_SEP_KEY,v,true);
    scrollSepShow(v);
    scrollShowFit();
    if(body&&at) body.scrollTop=scrollShowPageTop(body,at)+off;
    scrollShowCount();
  }
  function scrollShowPages(){
    return scrollShowEl?$$('.print-page',scrollShowEl):[];
  }
  function scrollShowFit(){
    if(!scrollShowEl) return;
    var body=scrollShowEl.querySelector('.deck-scroll-body');
    var avail=(body?body.clientWidth:innerWidth)-48;
    scrollShowPages().forEach(function(p){
      var w=+p.dataset.pw||p.offsetWidth||1280;
      var z=Math.max(0.1,Math.min(1,avail/w));
      p.style.zoom=z.toFixed(4);
      /* T620: the line above a page is as wide as the page is drawn */
      var sep=p.previousElementSibling;
      if(sep&&sep.classList.contains('scroll-sep'))
        sep.style.width=Math.round(w*z)+'px';
    });
  }
  function scrollShowArm(page,s){
    if(!s) return;
    /* the build ranks, so a page's things arrive a beat apart in the
       order the deck gives them */
    var orders=[];
    (s.annots||[]).forEach(function(a){
      if(a&&a.anim&&orders.indexOf(a.anim.order||0)<0)
        orders.push(a.anim.order||0);});
    orders.sort(function(x,y){return x-y;});
    var n=0;
    $$('.an-item[data-idx],.an-arrow-line[data-idx]',page).forEach(function(el){
      var raw=el.getAttribute('data-idx');
      if(raw==='t'||raw==='s') return;
      var a=(s.annots||[])[+raw];
      if(!a||!a.anim) return;
      var type=a.anim.type||'fade';
      if(type==='appear') return;             /* instant: nothing to hold */
      /* the typewriter runs one box at a time; on a scrolling page it
         would run every box at once, so it plays as a fade here */
      if(type==='type') type='fade';
      el.classList.add('an-prebuild','an-scrollin');
      el.dataset.sanim=type;
      el.dataset.srank=String(orders.indexOf(a.anim.order||0));
      n++;
    });
    page.dataset.armed=n?'1':'';
  }
  function scrollShowPlay(page){
    if(page.dataset.played) return;
    page.dataset.played='1';
    if(!motionOK()){
      $$('.an-scrollin',page).forEach(function(el){
        el.classList.remove('an-prebuild','an-scrollin');});
      return;
    }
    $$('.an-scrollin',page).forEach(function(el){
      el.style.animationDelay=((+el.dataset.srank||0)*SCROLL_STAGGER).toFixed(2)+'s';
      el.classList.remove('an-prebuild');
      el.classList.add('an-anim-'+(el.dataset.sanim||'fade'));
    });
  }
  /* T465: a page's top MEASURED IN THE BODY'S SCROLL SPACE. offsetTop
     is relative to the nearest positioned ancestor, which the scroll
     body is not, so it carried the 45px bar above it: the step's "which
     page am I on" ran one page behind after the first press and
     ArrowDown could never get past page 2 (2026-09-15 review, driven:
     scrollTop stuck at 768 against a page at 813). */
  function scrollShowPageTop(body,p){
    return p.getBoundingClientRect().top-body.getBoundingClientRect().top
      +body.scrollTop;
  }
  function scrollShowCount(){
    if(!scrollShowEl) return;
    var body=scrollShowEl.querySelector('.deck-scroll-body');
    var out=scrollShowEl.querySelector('.deck-scroll-n');
    if(!body||!out) return;
    var pages=scrollShowPages(),at=0,top=body.scrollTop+body.clientHeight*0.35;
    pages.forEach(function(p,i){if(scrollShowPageTop(body,p)<=top) at=i;});
    out.textContent=(at+1)+' / '+pages.length;
  }
  function scrollShowStep(d){
    if(!scrollShowEl) return;
    var body=scrollShowEl.querySelector('.deck-scroll-body');
    var pages=scrollShowPages(),at=0,top=body.scrollTop+10;
    pages.forEach(function(p,i){if(scrollShowPageTop(body,p)<=top) at=i;});
    var to=pages[Math.max(0,Math.min(pages.length-1,at+d))];
    if(to) to.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeScrollShow(){
    if(!scrollShowEl) return;
    if(scrollShowIo){scrollShowIo.disconnect();scrollShowIo=null;}
    if(scrollShowKey){
      document.removeEventListener('keydown',scrollShowKey,true);
      window.removeEventListener('resize',scrollShowFit);
      scrollShowKey=null;
    }
    scrollShowEl.remove();scrollShowEl=null;
  }
  function openScrollShow(){
    if(!(pres.slides||[]).length){toast('No slides to scroll through yet');return;}
    closeScrollShow();
    var ents=outputSlides();
    var root=buildPrintRoot();
    /* it is a scrolling page now, not the print root: the id goes so a
       later print or export builds its own without deleting this one */
    root.removeAttribute('id');
    /* T467: THE VERSION THE SHOW WOULD PLAY. outputSlides is the
       export's list and never consults slideSkipped (deliberately, so a
       rehearsal cut cannot trim a PDF); this is a way of PLAYING, so a
       slide the strip marks "not shown" is not a page here either
       (2026-09-15 review). The pages are dropped after the build so the
       explode-a-flip-book arithmetic is untouched. */
    if(typeof slideSkipped==='function'){
      var pgs=$$('.print-page',root),keep=[];
      ents.forEach(function(e,i){
        if(slideSkipped(e.i)){if(pgs[i]) pgs[i].remove();}
        else keep.push(e);});
      ents=keep;
    }
    root.classList.add('scroll-root');
    var ov=document.createElement('div');
    ov.className='deck-scroll';ov.id='deck-scroll';
    var bar=document.createElement('div');bar.className='deck-scroll-bar';
    var t=document.createElement('span');t.className='deck-scroll-t';
    t.textContent=pres.name||'presentation';
    var n=document.createElement('span');n.className='deck-scroll-n';
    var x=document.createElement('button');x.className='dbtn';
    x.innerHTML=bic('exit')+' Close (Esc)';
    x.addEventListener('click',function(e){e.stopPropagation();closeScrollShow();});
    /* T620: between the slides -- four worded choices, one pressed */
    var sg=document.createElement('span');sg.className='deck-scroll-sep';
    sg.setAttribute('role','group');sg.setAttribute('aria-label','Between slides');
    var sgl=document.createElement('span');sgl.className='deck-scroll-seplab';
    sgl.textContent='Between slides';
    sg.appendChild(sgl);
    SCROLL_SEPS.forEach(function(o){
      var b=document.createElement('button');
      b.type='button';b.className='dbtn deck-scroll-sepb';b.dataset.sep=o[0];
      b.innerHTML='<span class="deck-scroll-sw" aria-hidden="true"></span>'+o[1];
      b.addEventListener('click',function(e){
        e.stopPropagation();scrollSepSet(o[0]);});
      sg.appendChild(b);
    });
    bar.appendChild(t);bar.appendChild(n);bar.appendChild(sg);bar.appendChild(x);
    var body=document.createElement('div');body.className='deck-scroll-body';
    body.appendChild(root);
    ov.appendChild(bar);ov.appendChild(body);
    document.body.appendChild(ov);
    scrollShowEl=ov;
    scrollSepShow(scrollSepGet());
    var pages=scrollShowPages();
    pages.forEach(function(p,i){
      p.dataset.pw=String(p.offsetWidth||1280);
      scrollShowArm(p,ents[i]&&ents[i].s);
      /* T620: the line's place, between this page and the one before */
      if(i){
        var sep=document.createElement('div');sep.className='scroll-sep';
        sep.setAttribute('aria-hidden','true');
        p.parentNode.insertBefore(sep,p);
      }
    });
    scrollShowFit();
    if(window.IntersectionObserver){
      scrollShowIo=new IntersectionObserver(function(es){
        es.forEach(function(e){
          if(!e.isIntersecting) return;
          scrollShowPlay(e.target);
          scrollShowIo.unobserve(e.target);
        });
      },{root:body,threshold:0.3});
      pages.forEach(function(p){scrollShowIo.observe(p);});
    } else pages.forEach(scrollShowPlay);
    body.addEventListener('scroll',scrollShowCount);
    scrollShowCount();
    scrollShowKey=function(e){
      if(!scrollShowEl) return;
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();
        closeScrollShow();return;}
      /* the arrows a clicker sends step a page too, as the show does */
      if(e.key==='ArrowDown'||e.key==='PageDown'||e.key===' '
         ||e.key==='ArrowRight'){
        e.preventDefault();e.stopPropagation();scrollShowStep(1);}
      else if(e.key==='ArrowUp'||e.key==='PageUp'||e.key==='ArrowLeft'){
        e.preventDefault();e.stopPropagation();scrollShowStep(-1);}
    };
    document.addEventListener('keydown',scrollShowKey,true);
    window.addEventListener('resize',scrollShowFit);
    x.focus();
  }
  function scrollShowBoot(){
    var row=$('#pl-scroll');
    if(row) row.addEventListener('click',function(e){
      e.stopPropagation();
      var pm=$('#play-menu'); if(pm&&!pm.hidden) overlayHide(pm);
      openScrollShow();
    });
  }
