/* 32-mini-toolbar.js — the everyday formatting, beside the words you
   highlighted (T536).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- THE MINI TOOLBAR ------------------------------------------------
     PowerPoint floats bold, italic, size and colour beside a highlighted
     run, because the ribbon is a long way up from the words (2026-09-29
     audit: "it still doesn't feel as smooth as PowerPoint").

     1. NOTHING IS A SECOND COPY. Every button here PRESSES the ribbon's
        own control (the way the keyboard does since T534) and reads its
        pressed state back from it, so the two can never disagree about
        what bold is or whether it is on. The swatches call the ribbon
        swatches' own applyTextColor.
     2. WORDS, NOT ONLY ICONS -- the house rule. B, I, U, S, A-, A+ are
        the ribbon's own faces; the swatch run is the ribbon's run.
     3. IT APPEARS ONLY FOR A HIGHLIGHTED RUN in a box being typed in:
        a caret alone, a selected box, a table cell, the notes -- none of
        those. Typing, Escape, a click elsewhere or a scroll put it away.
     4. IT KEEPS THE SELECTION. Every control swallows its mousedown, as
        the ribbon's do (onBtn), or the click would take the focus and
        the run with it before the command could ask what was selected.
     Later tasks add to MINI_BTNS (link, highlight, clear, sup/sub);
     each entry is one ribbon control, never a new behaviour. */
  var MINI_BTNS=[
    ['#fmt-bold','B','Bold (Ctrl+B)','mini-b'],
    ['#fmt-ital','I','Italic (Ctrl+I)','mini-i'],
    ['#fmt-under','U','Underline (Ctrl+U)','mini-u'],
    ['#fmt-strike','S','Strikethrough','mini-s'],
    ['#fmt-sup','x\u00b2','Superscript (Ctrl+Shift+=)',''],
    ['#fmt-sub','x\u2082','Subscript (Ctrl+=)',''],
    ['#fmt-smaller','A−','Smaller text (Ctrl+Shift+<)',''],
    ['#fmt-bigger','A+','Bigger text (Ctrl+Shift+>)','']
  ];
  var miniEl=null,miniPend=false;
  function miniBuild(){
    if(miniEl) return miniEl;
    var m=document.createElement('div');
    m.className='mini-tb';m.id='mini-tb';m.hidden=true;
    m.setAttribute('role','toolbar');
    m.setAttribute('aria-label','Format the highlighted words');
    m.addEventListener('mousedown',function(e){e.preventDefault();
      e.stopPropagation();});
    MINI_BTNS.forEach(function(p){
      var b=document.createElement('button');
      b.type='button';b.className='dbtn mini-btn '+(p[3]||'');
      b.textContent=p[1];b.title=p[2];b.dataset.for=p[0];
      b.addEventListener('click',function(e){
        e.stopPropagation();
        var real=$(p[0]); if(!real||real.disabled) return;
        real.click();
        miniSync();
      });
      m.appendChild(b);
    });
    var sw=document.createElement('span');
    sw.className='mini-sw';m.appendChild(sw);
    /* T543: the markers, where the highlighted words are */
    var hl=document.createElement('span');hl.className='mini-hl';
    hlRow(hl,true);m.appendChild(hl);
    deckEl.appendChild(m);
    miniEl=m;
    return m;
  }
  /* the deck's quick colours, rebuilt each time the bar shows: the row
     is the deck's and changes with it */
  function miniSwatches(){
    var host=miniEl&&miniEl.querySelector('.mini-sw'); if(!host) return;
    host.innerHTML='';
    (typeof quickRow==='function'?quickRow():[]).forEach(function(ref){
      var b=document.createElement('button');
      b.type='button';b.className='qk-sw mini-swb';
      b.style.background=tokVal(ref);
      b.title=colorLabel(ref)+', on the words';
      b.setAttribute('aria-label',b.title);
      b.addEventListener('click',function(e){
        e.stopPropagation();applyTextColor(ref);miniSync();});
      host.appendChild(b);
    });
  }
  function miniSync(){
    if(!miniEl) return;
    $$('.mini-btn',miniEl).forEach(function(b){
      var real=$(b.dataset.for);
      b.disabled=!real||real.disabled;
      b.setAttribute('aria-pressed',
        (real&&real.getAttribute('aria-pressed')==='true')?'true':'false');
    });
  }
  function miniHide(){if(miniEl&&!miniEl.hidden) miniEl.hidden=true;}
  function miniRange(){
    if(mode!=='edit'||deckEl.hidden) return null;
    var el=activeTextEditable(); if(!el) return null;
    var sel=window.getSelection();
    if(!sel||!sel.rangeCount||sel.isCollapsed) return null;
    var r=sel.getRangeAt(0);
    if(!el.contains(r.startContainer)||!el.contains(r.endContainer)) return null;
    if(!String(r.toString()).trim()) return null;
    return r;
  }
  function miniPlace(){
    miniPend=false;
    var r=miniRange();
    if(!r){miniHide();return;}
    var m=miniBuild();
    var wasHidden=m.hidden;
    if(wasHidden) miniSwatches();
    m.hidden=false;
    miniSync();
    var rr=r.getBoundingClientRect();
    if(!rr.width&&!rr.height){miniHide();return;}
    var w=m.offsetWidth,h=m.offsetHeight;
    var bar=$('#edit-tools');
    var floor=bar?bar.getBoundingClientRect().bottom+4:0;
    var top=rr.top-h-10;
    if(top<floor) top=rr.bottom+10;          /* no room above: below */
    var left=rr.left+rr.width/2-w/2;
    left=Math.max(8,Math.min(left,window.innerWidth-w-8));
    top=Math.max(8,Math.min(top,window.innerHeight-h-8));
    m.style.left=Math.round(left)+'px';m.style.top=Math.round(top)+'px';
  }
  function miniSoon(){
    if(miniPend) return;
    miniPend=true;
    requestAnimationFrame(miniPlace);
  }
  function miniBoot(){
    document.addEventListener('selectionchange',miniSoon);
    /* anything that moves the words out from under it */
    stage.addEventListener('scroll',miniHide,true);
    window.addEventListener('resize',miniHide);
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape') miniHide();},true);
  }
