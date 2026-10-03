  /* ---- T386: THE TALK'S OWN TOOLS ------------------------------------
     (2026-09-12, user: "the during presentation features, having
     something like a magnifying glass that can be swapped to. I feel
     like there are a lot of extra cool creative things that can get
     added.") Three things a presenter reaches for in front of a room,
     none of which touch the deck: a LASER dot that follows the pointer,
     a MAGNIFIER that shows the slide under the pointer at twice the
     size, and a BLACK SCREEN for when the room should look at the
     speaker. Each is one key in the show (P, M, B) and one button on
     the Talk panel; Escape puts everything down. View mode only, like
     the panel itself: these are facts about the room, not the deck, so
     nothing here is stored.

     The magnifier is a clone of the slide, scaled, inside a round
     window that rides with the pointer -- a picture, not the slide, so
     nothing in it can take a click (pointer-events:none on the whole
     lens) and a click still advances. The clone is refreshed when the
     slide's DOM changes (a build, a page turn, a new slide), through a
     MutationObserver that is only connected while the lens is up. */
  var talkTool='',talkBlackEl=null,laserEl=null,lensEl=null,lensIn=null;
  var lensObs=null,lensSyncT=null,lensPt=null;
  var LENS_D=300,LENS_Z=2;
  function talkToolsSync(){
    [['talk-laser','laser'],['talk-lens','lens']].forEach(function(p){
      var b=$('#'+p[0]); if(!b) return;
      b.setAttribute('aria-pressed',(talkTool===p[1]).toString());
    });
    var bb=$('#talk-black');
    if(bb) bb.setAttribute('aria-pressed',(!!talkBlackEl).toString());
    document.body.classList.toggle('jv-laser',talkTool==='laser');
    document.body.classList.toggle('jv-lens',talkTool==='lens');
  }
  function laserMove(e){
    if(!laserEl) return;
    laserEl.style.left=e.clientX+'px';
    laserEl.style.top=e.clientY+'px';
  }
  function slideEl(){
    return (stage&&(stage.querySelector('.slide')||stage.firstElementChild))
      ||null;
  }
  function lensRebuild(){
    if(!lensEl) return;
    /* renderSlide empties the stage, lens and all: a new slide puts the
       lens back before it fills it */
    if(!lensEl.isConnected) (stage||document.body).appendChild(lensEl);
    var src=slideEl(); if(!src) return;
    var clone=src.cloneNode(true);
    /* a picture of the slide: no ids twice in one document, no chrome */
    clone.removeAttribute('id');
    $$('[id]',clone).forEach(function(n){n.removeAttribute('id');});
    $$('.an-resize,.an-rotate,.an-buildno,.an-endpt,.an-cellbtn,.cellparts',
      clone).forEach(function(n){n.remove();});
    var r=src.getBoundingClientRect();
    clone.style.position='absolute';
    clone.style.left='0';clone.style.top='0';
    clone.style.margin='0';
    clone.style.width=r.width+'px';clone.style.height=r.height+'px';
    clone.style.transformOrigin='0 0';
    lensIn.innerHTML='';
    lensIn.appendChild(clone);
    lensIn._w=r.width;lensIn._h=r.height;
    lensPlace();
  }
  function lensPlace(){
    if(!lensEl||!lensPt) return;
    var src=slideEl(); if(!src) return;
    var r=src.getBoundingClientRect(),R=LENS_D/2;
    lensEl.style.left=(lensPt.x-R)+'px';
    lensEl.style.top=(lensPt.y-R)+'px';
    var px=lensPt.x-r.left,py=lensPt.y-r.top;
    var clone=lensIn.firstElementChild; if(!clone) return;
    clone.style.transform='translate('+(R-px*LENS_Z)+'px,'+(R-py*LENS_Z)
      +'px) scale('+LENS_Z+')';
  }
  function lensMove(e){
    lensPt={x:e.clientX,y:e.clientY};
    lensPlace();
  }
  function lensSyncSoon(recs){
    /* the lens lives inside the stage (see setTalkTool), so its own
       redraws reach this observer too; only the slide's count */
    if(lensEl&&recs&&recs.length&&!recs.some(function(r){
      return !lensEl.contains(r.target);})) return;
    if(lensSyncT) clearTimeout(lensSyncT);
    lensSyncT=setTimeout(function(){lensSyncT=null;lensRebuild();},120);
  }
  function setTalkTool(t){
    if(mode!=='view'||deckEl.hidden) t='';
    if(t===talkTool) t='';
    /* T558: one pointer at a time -- the laser or the lens puts the ink
       down (what was drawn stays) */
    if(t&&typeof inkTool!=='undefined'&&inkTool) setInkTool('');
    /* put the old one down */
    if(laserEl){laserEl.remove();laserEl=null;
      document.removeEventListener('mousemove',laserMove);}
    if(lensEl){
      lensEl.remove();lensEl=null;lensIn=null;lensPt=null;
      document.removeEventListener('mousemove',lensMove);
      if(lensObs){lensObs.disconnect();lensObs=null;}
    }
    talkTool=t;
    if(t==='laser'){
      laserEl=document.createElement('div');
      laserEl.className='jv-laserdot';
      document.body.appendChild(laserEl);
      document.addEventListener('mousemove',laserMove);
    } else if(t==='lens'){
      lensEl=document.createElement('div');
      lensEl.className='jv-lensbox';   /* T465: not the body flag's name */
      lensEl.style.width=LENS_D+'px';lensEl.style.height=LENS_D+'px';
      lensIn=document.createElement('div');
      lensIn.className='jv-lens-in';
      lensEl.appendChild(lensIn);
      /* INSIDE THE STAGE, not on the body: the slide's type is sized by
         custom properties the stage carries (--talk-text and the rest),
         and a clone on the body inherited none of them -- two letters
         filled the whole lens. Fixed positioning still measures from
         the viewport, so it rides with the pointer all the same. */
      (stage||document.body).appendChild(lensEl);
      document.addEventListener('mousemove',lensMove);
      lensRebuild();
      if(window.MutationObserver&&stage){
        lensObs=new MutationObserver(lensSyncSoon);
        lensObs.observe(stage,{childList:true,subtree:true,attributes:true});
      }
    }
    talkToolsSync();
  }
  function talkBlack(on){
    if(on==null) on=!talkBlackEl;
    if(on&&(mode!=='view'||deckEl.hidden)) on=false;
    if(!on){
      if(talkBlackEl){talkBlackEl.remove();talkBlackEl=null;}
    } else if(!talkBlackEl){
      talkBlackEl=document.createElement('div');
      talkBlackEl.className='jv-black';
      talkBlackEl.title='Black screen — press B, Esc or click to '
        +'bring the slide back';
      talkBlackEl.addEventListener('click',function(e){
        e.stopPropagation();talkBlack(false);});
      document.body.appendChild(talkBlackEl);
    }
    talkToolsSync();
    talkBlackSync();
  }
  /* T574: whichever window blacked it, the presenter view's button
     follows */
  function talkBlackSync(){
    if(typeof presenterPush==='function') presenterPush();
  }
  /* leaving the show puts every tool down: setUIMode calls this */
  function talkToolsReset(){
    if(talkTool) setTalkTool('');
    if(talkBlackEl) talkBlack(false);
    if(inkTool) setInkTool('');
  }
  /* the show's keys for these (55-sections-and-strip's key map calls
     this first in view mode); true when the key was taken */
  /* T574: A SLIDE BY ITS NUMBER. PowerPoint's own: type the number the
     strip gives it, then Enter. The digits wait a moment for the next
     one; anything else lets them go. A hidden slide can be reached this
     way, as in PowerPoint -- it is the one way into it during a show. */
  var talkNum='',talkNumT=0;
  function slideAtNumber(n){
    for(var i=0;i<(pres.slides||[]).length;i++)
      if(!slideIsAlt(i)&&slideNo(i)===n) return i;
    return -1;
  }
  function talkNumKey(k){
    if(/^[0-9]$/.test(k)){
      talkNum=(talkNum+k).slice(-4);
      clearTimeout(talkNumT);
      talkNumT=setTimeout(function(){talkNum='';},2500);
      return true;
    }
    if(k==='Enter'&&talkNum){
      var want=+talkNum,at=slideAtNumber(want);
      talkNum='';clearTimeout(talkNumT);
      if(at>=0) go(at); else toast('There is no slide '+want);
      return true;
    }
    talkNum='';
    return false;
  }
  function talkToolKey(e){
    if(mode!=='view'||deckEl.hidden) return false;
    if(e.ctrlKey||e.metaKey||e.altKey) return false;
    var k=String(e.key||'');
    if(talkNumKey(k)) return true;
    if(k==='Escape'&&(talkTool||talkBlackEl||inkTool)){
      talkToolsReset();return true;}
    if(k==='p'||k==='P'){setTalkTool('laser');return true;}
    /* T558: the ink -- I the pen, H the highlighter, X the eraser, E wipes
       this slide (PowerPoint's E) */
    if(k==='i'||k==='I'){setInkTool('pen');return true;}
    if(k==='h'||k==='H'){setInkTool('hl');return true;}
    if(k==='x'||k==='X'){setInkTool('erase');return true;}
    if(k==='e'||k==='E'){inkClearHere();return true;}
    if(k==='m'||k==='M'){setTalkTool('lens');return true;}
    if(k==='b'||k==='B'){talkBlack();return true;}
    /* T476: the presenter window, from the lectern */
    if(k==='n'||k==='N'){
      if(typeof openPresenter==='function') openPresenter();
      return true;
    }
    return false;
  }
  function talkToolsBoot(){
    var la=$('#talk-laser'),le=$('#talk-lens'),bl=$('#talk-black');
    if(la) la.addEventListener('click',function(e){
      e.stopPropagation();setTalkTool('laser');});
    if(le) le.addEventListener('click',function(e){
      e.stopPropagation();setTalkTool('lens');});
    if(bl) bl.addEventListener('click',function(e){
      e.stopPropagation();talkBlack();});
    /* T558: the Ink row */
    [['#talk-pen','pen'],['#talk-hl','hl'],['#talk-erase','erase']]
      .forEach(function(p){
        var x=$(p[0]);
        if(x) x.addEventListener('click',function(e){
          e.stopPropagation();setInkTool(p[1]);});
      });
    /* the strokes are drawn at the slide's height: a new window size is a
       new stroke weight */
    window.addEventListener('resize',function(){if(inkSvg) inkDraw();});
    var pv=$('#talk-presenter');   /* T476 */
    if(pv) pv.addEventListener('click',function(e){
      e.stopPropagation();
      if(typeof openPresenter==='function') openPresenter();
    });
    if(window.SemDeckTalk){
      window.SemDeckTalk.tool=setTalkTool;
      window.SemDeckTalk.black=talkBlack;
    }
    /* Escape puts a tool down BEFORE the editor's own Escape ladder can
       read it as "stop presenting": that ladder runs at capture, so
       this has to as well, and it only speaks when a tool is up */
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape'||!(talkTool||talkBlackEl||inkTool)) return;
      if(mode!=='view'||deckEl.hidden) return;
      e.preventDefault();e.stopPropagation();
      talkToolsReset();
    },true);
  }
  /* ---- T558: INK WHILE PRESENTING --------------------------------------
     PowerPoint's pen, highlighter and eraser in the show: I for the pen,
     H for the highlighter, X for the eraser (a stroke you touch goes), E
     to wipe this slide's ink, and the Talk panel's Ink row for the same.
     While one is up a small bar sits in the bottom-left corner -- the
     three tools, six colours, Erase all and Done -- and goes again with
     the tool, so the room sees the slide and not the editor's chrome.
     INK IS NOT THE DECK. It is kept per slide for this run of the show
     only (a Map keyed by the slide object, so it is still there when you
     come back to the slide), drawn in an overlay laid over the slide in
     the slide's own percentages, so it scales with the window; and when
     the show ends with ink on any slide you are asked whether to keep
     it. Kept, each stroke becomes an ordinary freehand drawing on its
     slide, all in one undo step; discarded, it is gone. Nothing else
     ever writes it into the slides. Pointer events, so a pen or a finger
     draws as well as a mouse; a press on the ink layer never advances
     the slide. */
  var inkTool='',inkStore=new Map(),inkSvg=null,inkBar=null,inkCur=null;
  var INK_COLS=['#ff3b30','#ffd60a','#34c759','#0a84ff','#ffffff',
    '#111111'];
  var inkCol={pen:'#ff3b30',hl:'#ffd60a'};
  var INK_SW={pen:4,hl:22};                 /* px at SW_REF_H, as `sw` is */
  var INK_HL_OP=0.4;
  function inkHere(){
    var s=pres.slides[cur]; if(!s) return [];
    if(!inkStore.has(s)) inkStore.set(s,[]);
    return inkStore.get(s);
  }
  function inkCount(){
    var n=0;inkStore.forEach(function(v){if(v.length) n++;});
    return n;
  }
  function inkSlideEl(){
    return (stage&&stage.querySelector('.slide'))||null;
  }
  function inkPathD(pts){
    if(!pts.length) return '';
    if(pts.length===1)    /* a dot: a hair of a line, so the cap draws it */
      return 'M'+pts[0][0]+' '+pts[0][1]+'L'+(pts[0][0]+0.01)+' '+pts[0][1];
    /* the Draw tool's smoothing, which reads points 0..1 of a box; the
       ink's box is the whole slide, so its percentages come down to that */
    return drawPathD(pts.map(function(q){return [q[0]/100,q[1]/100];}));
  }
  function inkStrokeEl(st,h){
    var p=document.createElementNS(SVGNS,'path');
    p.setAttribute('d',inkPathD(st.pts));
    p.setAttribute('fill','none');
    p.setAttribute('stroke',st.c);
    p.setAttribute('stroke-width',(st.sw*h/SW_REF_H).toFixed(2));
    p.setAttribute('vector-effect','non-scaling-stroke');
    p.setAttribute('stroke-linecap',st.t==='hl'?'butt':'round');
    p.setAttribute('stroke-linejoin','round');
    if(st.t==='hl'){
      p.setAttribute('stroke-opacity',String(INK_HL_OP));
      p.setAttribute('class','jv-hl');
    }
    return p;
  }
  /* put the layer on the slide on screen (renderSlide empties the stage,
     so this runs after every render) and draw this slide's strokes */
  function inkMount(){
    var on=mode==='view'&&!deckEl.hidden;
    var list=on?inkHere():[];
    var sl=on?inkSlideEl():null;
    if(!sl||(!inkTool&&!list.length)){
      if(inkSvg){inkSvg.remove();inkSvg=null;}
      return;
    }
    if(!inkSvg){
      inkSvg=document.createElementNS(SVGNS,'svg');
      inkSvg.setAttribute('class','jv-ink');
      inkSvg.setAttribute('viewBox','0 0 100 100');
      inkSvg.setAttribute('preserveAspectRatio','none');
      inkSvg.setAttribute('aria-hidden','true');
      inkSvg.addEventListener('pointerdown',inkDown);
      inkSvg.addEventListener('click',function(e){
        if(inkTool){e.preventDefault();e.stopPropagation();}});
    }
    if(inkSvg.parentNode!==sl) sl.appendChild(inkSvg);
    inkSvg.classList.toggle('jv-ink-live',!!inkTool);
    inkSvg.classList.toggle('jv-ink-erase',inkTool==='erase');
    inkDraw();
  }
  function inkDraw(){
    if(!inkSvg) return;
    var h=inkSvg.getBoundingClientRect().height||SW_REF_H;
    while(inkSvg.firstChild) inkSvg.removeChild(inkSvg.firstChild);
    inkHere().forEach(function(st){inkSvg.appendChild(inkStrokeEl(st,h));});
    if(inkCur) inkSvg.appendChild(inkCur.el);
  }
  function inkPt(e){
    var r=inkSvg.getBoundingClientRect();
    return [Math.round((e.clientX-r.left)/(r.width||1)*10000)/100,
            Math.round((e.clientY-r.top)/(r.height||1)*10000)/100];
  }
  /* the strokes within reach of a point, for the eraser: any point of a
     stroke within its own half-width plus a little, in screen pixels */
  function inkErase(p){
    var r=inkSvg.getBoundingClientRect(),list=inkHere(),gone=false;
    for(var i=list.length-1;i>=0;i--){
      var st=list[i],reach=st.sw*(r.height/SW_REF_H)/2+8;
      var hit=st.pts.some(function(q){
        var dx=(q[0]-p[0])/100*r.width,dy=(q[1]-p[1])/100*r.height;
        return dx*dx+dy*dy<=reach*reach;});
      if(hit){list.splice(i,1);gone=true;}
    }
    if(gone){inkDraw();inkSync();}
  }
  function inkDown(e){
    if(!inkTool||e.button>0) return;
    e.preventDefault();e.stopPropagation();
    try{inkSvg.setPointerCapture(e.pointerId);}catch(err){}
    var p=inkPt(e);
    if(inkTool==='erase'){
      inkErase(p);
      var em=function(ev){inkErase(inkPt(ev));};
      var eu=function(){
        inkSvg.removeEventListener('pointermove',em);
        inkSvg.removeEventListener('pointerup',eu);
        inkSvg.removeEventListener('pointercancel',eu);
      };
      inkSvg.addEventListener('pointermove',em);
      inkSvg.addEventListener('pointerup',eu);
      inkSvg.addEventListener('pointercancel',eu);
      return;
    }
    var h=inkSvg.getBoundingClientRect().height||SW_REF_H;
    var st={t:inkTool,c:inkCol[inkTool],sw:INK_SW[inkTool],pts:[p]};
    inkCur={st:st,el:inkStrokeEl(st,h)};
    inkSvg.appendChild(inkCur.el);
    var mm=function(ev){
      var q=inkPt(ev),last=st.pts[st.pts.length-1];
      /* thinned, as a drawn stroke's trail is: a point a pixel would
         be thousands of points a slide */
      if(Math.abs(q[0]-last[0])+Math.abs(q[1]-last[1])<0.25) return;
      st.pts.push(q);
      inkCur.el.setAttribute('d',inkPathD(st.pts));
    };
    var mu=function(){
      inkSvg.removeEventListener('pointermove',mm);
      inkSvg.removeEventListener('pointerup',mu);
      inkSvg.removeEventListener('pointercancel',mu);
      inkHere().push(st);inkCur=null;
      inkDraw();inkSync();
    };
    inkSvg.addEventListener('pointermove',mm);
    inkSvg.addEventListener('pointerup',mu);
    inkSvg.addEventListener('pointercancel',mu);
  }
  function inkClearHere(){
    var s=pres.slides[cur];
    if(s) inkStore.set(s,[]);
    inkDraw();inkSync();
  }
  /* the bar: built once, shown only while a tool is up */
  function inkBarBuild(){
    if(inkBar) return inkBar;
    inkBar=document.createElement('div');
    inkBar.className='jv-inkbar';inkBar.setAttribute('role','toolbar');
    inkBar.setAttribute('aria-label','Ink');
    function b(id,ic,label,title,fn){
      var x=document.createElement('button');
      x.type='button';x.className='dbtn jv-ink-b';x.dataset.ink=id;
      x.innerHTML=ic+' '+label;x.title=title;
      x.addEventListener('click',function(e){e.stopPropagation();fn();});
      inkBar.appendChild(x);return x;
    }
    b('pen',bic('pen'),'Pen','Draw on the slide (I)',function(){setInkTool('pen');});
    b('hl',bic('highlighter'),'Highlighter','Mark it in a see-through colour (H)',
      function(){setInkTool('hl');});
    b('erase',bic('eraser'),'Eraser','Rub out the strokes you touch (X)',
      function(){setInkTool('erase');});
    var sw=document.createElement('span');sw.className='jv-ink-cols';
    INK_COLS.forEach(function(c){
      var x=document.createElement('button');
      x.type='button';x.className='jv-ink-col';x.style.background=c;
      x.dataset.c=c;x.title='Ink colour';x.setAttribute('aria-label',
        'Ink colour '+c);
      x.addEventListener('click',function(e){
        e.stopPropagation();
        var t=(inkTool==='hl')?'hl':'pen';
        inkCol[t]=c;if(inkTool==='erase') setInkTool('pen');
        inkSync();
      });
      sw.appendChild(x);
    });
    inkBar.appendChild(sw);
    b('clear',bic('exit'),'Erase all','Wipe this slide’s ink (E)',inkClearHere);
    b('done',bic('tick'),'Done','Put the ink down (Esc); what you drew stays '
      +'until the show ends',function(){setInkTool('');});
    return inkBar;
  }
  function inkSync(){
    if(inkBar){
      $$('.jv-ink-b',inkBar).forEach(function(x){
        var on=x.dataset.ink===inkTool;
        x.setAttribute('aria-pressed',on.toString());});
      var t=(inkTool==='hl')?'hl':'pen';
      $$('.jv-ink-col',inkBar).forEach(function(x){
        x.setAttribute('aria-pressed',(x.dataset.c===inkCol[t]).toString());});
      var cl=inkBar.querySelector('[data-ink="clear"]');
      if(cl) cl.disabled=!inkHere().length;
    }
    [['talk-pen','pen'],['talk-hl','hl'],['talk-erase','erase']]
      .forEach(function(p){
        var x=$('#'+p[0]);
        if(x) x.setAttribute('aria-pressed',(inkTool===p[1]).toString());});
    document.body.classList.toggle('jv-inking',!!inkTool);
  }
  function setInkTool(t){
    if(mode!=='view'||deckEl.hidden) t='';
    if(t&&t===inkTool&&t!=='erase') t='';
    if(t&&talkTool) setTalkTool('');   /* one pointer at a time */
    inkTool=t||'';
    if(inkTool){
      var bar=inkBarBuild();
      if(!bar.isConnected) document.body.appendChild(bar);
      bar.hidden=false;
    } else if(inkBar) inkBar.hidden=true;
    inkMount();inkSync();
  }
  /* the show ended: keep the ink as drawings, or let it go */
  function inkLeave(){
    var keep=[];
    inkStore.forEach(function(list,s){if(list.length) keep.push([s,list]);});
    inkStore=new Map();inkCur=null;
    if(inkTool) setInkTool('');
    if(inkSvg){inkSvg.remove();inkSvg=null;}
    if(!keep.length) return;
    var n=keep.reduce(function(t,k){return t+k[1].length;},0);
    askYes({title:'Keep your ink?',
      what:'You drew '+n+' stroke'+(n===1?'':'s')+' on '+keep.length
        +' slide'+(keep.length===1?'':'s')+' during the talk.',
      note:'Kept, each stroke becomes a drawing on its slide that you can '
        +'move, recolour or delete. Ctrl+Z takes them all back off.',
      ok:'Keep ink',cancel:'Discard'},function(yes){
      if(!yes) return;
      var made=0;
      keep.forEach(function(k){
        if((pres.slides||[]).indexOf(k[0])<0) return;
        k[1].forEach(function(st){
          var a=inkToDraw(st); if(!a) return;
          k[0].annots=k[0].annots||[];k[0].annots.push(a);made++;
        });
      });
      if(!made) return;
      markDirty();renderSlide();
      if(typeof renderFilm==='function') renderFilm();
      toast(made+' ink stroke'+(made===1?'':'s')+' kept as drawings');
    });
  }
  /* a stroke as the freehand drawing the Draw tool would have made: a
     box, and its points 0..1 inside it */
  function inkToDraw(st){
    if(!st||!st.pts||!st.pts.length) return null;
    var xs=st.pts.map(function(q){return q[0];});
    var ys=st.pts.map(function(q){return q[1];});
    var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs);
    var y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
    var w=x1-x0,h=y1-y0,MIN=1.5;
    if(w<MIN){x0-=(MIN-w)/2;w=MIN;}
    if(h<MIN){y0-=(MIN-h)/2;h=MIN;}
    var a={k:'draw',x:x0,y:y0,w:w,h:h,color:st.c,sw:st.sw,
      pts:st.pts.map(function(q){
        return [Math.round((q[0]-x0)/w*1000)/1000,
          Math.round((q[1]-y0)/h*1000)/1000];}),
      name:st.t==='hl'?'Highlighter ink':'Ink'};
    if(st.t==='hl') a.op=INK_HL_OP;
    return a;
  }
  /* ---- T581: THE PRESENTING BAR FOLDS AWAY -----------------------------
     (2026-09-30, user: "why does present mode have these options up the
     top. They are distracting and not necessary. I would also want
     options to be things that are collapsable by default not always
     there.") Stop presenting, Open now and Running late sat in a bar
     across the top of the audience's screen for the whole talk. The bar
     is folded away now, and what is left is a faint Controls tab at the
     top edge. Three ways back, none of them needing the bar first: the
     pointer at the top edge (it folds again once the pointer leaves),
     the tab (it stays until Hide), and the keyboard (a focused control
     keeps it open). Esc still stops presenting, and L is still Running
     late. Kept open or not is remembered, the way the other auto-hides
     are. */
  var PRESBAR_KEY='jv-deck-presbar:';
  var presBarPinned=false,presBarT=null;
  function presBarApply(){
    if(!deckEl) return;
    var peek=deckEl.classList.contains('top-peek');
    deckEl.classList.toggle('top-pinned',presBarPinned);
    var h=$('#deck-top-handle');
    if(h) h.setAttribute('aria-expanded',String(presBarPinned||peek));
  }
  function presBarPeek(on){
    clearTimeout(presBarT);presBarT=null;
    if(deckEl) deckEl.classList.toggle('top-peek',!!on);
    presBarApply();
  }
  function presBarPin(on){
    presBarPinned=!!on;
    lsSet(PRESBAR_KEY+SCOPE,presBarPinned?'1':'0',true);
    presBarPeek(false);
  }
  function presBarBoot(){
    presBarPinned=lsGet(PRESBAR_KEY+SCOPE)==='1';
    var h=$('#deck-top-handle'),fold=$('#deck-top-fold');
    var bar=$('#deck-top-bar');
    if(h) h.addEventListener('click',function(e){
      e.stopPropagation();presBarPin(true);});
    if(fold) fold.addEventListener('click',function(e){
      e.stopPropagation();presBarPin(false);
      if(document.activeElement&&document.activeElement.blur)
        document.activeElement.blur();
    });
    /* the top edge brings it; leaving lets it go a beat later, so a
       pointer on its way to a button does not lose the bar under it --
       and never while the Open now drawer it anchors is out */
    if(deckEl) deckEl.addEventListener('mousemove',function(e){
      if(mode!=='view'||presBarPinned) return;
      var peek=deckEl.classList.contains('top-peek');
      if(!peek){if(e.clientY<=6) presBarPeek(true);return;}
      var r=bar?bar.getBoundingClientRect():null;
      var dr=$('#deck-pres-drawer');
      if((r&&e.clientY<=r.bottom+14)||(dr&&!dr.hidden)){
        clearTimeout(presBarT);presBarT=null;return;}
      if(!presBarT) presBarT=setTimeout(function(){
        presBarT=null;
        if(bar&&bar.contains(document.activeElement)) return;
        presBarPeek(false);
      },450);
    });
    presBarApply();
  }
