/* 30-format-bar.js — picking a card into a frame, and every control on the format bar.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---------- picking: click a notebook card into a cell frame -------
     A flip book is filled by picking SEVERAL cards, so the mode stays
     open and counts them until you say Done. The single-pick flow is
     unchanged: the first click is still the answer (2026-08-22). */
  var pickMulti=false,pickAdded=0;
  function syncPickbar(){
    var w=$('#pick-what'),d=$('#pick-done');
    if(d) d.hidden=!pickMulti;
    if(!w) return;
    if(!pickMulti){
      w.innerHTML=bic('pin')+' Click a card in the notebook to place it '
        +'in the slide';
      return;
    }
    w.innerHTML=bic('pin')+' Click each figure you want in the flip '
      +'book, in order'
      +(pickAdded?(' &mdash; <b>'+pickAdded+' added</b>'):'');
    if(d) d.textContent=pickAdded
      ?('Done — '+pickAdded+' figure'+(pickAdded===1?'':'s'))
      :'Done';
  }
  function startPick(idx,multi){
    if(typeof idx!=='number') return;
    picking=idx;pickMulti=!!multi;pickAdded=0;
    rbnGalleryClose();
    deckEl.hidden=true;
    document.body.classList.remove('deck-open');
    document.body.classList.remove('creating-docs');
    document.body.classList.remove('slide-editing');
    document.body.classList.add('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=false;
    syncPickbar();
  }
  /* one card added to the flip book being filled; the mode stays open */
  function pickAdd(ref){
    var s=pres.slides[cur],a=s&&(s.annots||[])[picking];
    if(!a||a.k!=='flip') return;
    a.frames=flipFrames(a).slice();
    a.frames.push({ref:ref});
    /* land on the frame just added, so Done leaves you looking at it */
    a.at=a.frames.length-1;
    pickAdded++;markDirty(true);syncPickbar();
  }
  function endPick(ref){
    var idx=picking; picking=-1;
    var wasMulti=pickMulti; pickMulti=false;
    document.body.classList.remove('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=true;
    if(ref!==undefined&&idx>=0){
      var s=pres.slides[cur];
      var a=s&&(s.annots||[])[idx];
      if(a&&a.k==='cell'){a.ref=ref;markDirty();}
      else if(a&&a.k==='flip'){
        a.frames=flipFrames(a).slice();
        a.frames.push({ref:ref});
        a.at=a.frames.length-1;markDirty();
      }
    }
    /* a multi-pick has been writing frames as it went with markDirty(true)
       — one history entry for the whole batch is recorded here, so Ctrl+Z
       undoes "I added six figures" rather than six separate steps */
    if(wasMulti&&pickAdded) markDirty();
    pickAdded=0;
    openDeck('edit');
    var l=stage.querySelector('.annot-layer');
    if(l&&idx>=0) selectAnnot(l,idx);
    if(wasMulti) renderFlipPane();
  }
  document.addEventListener('click',function(e){
    if(picking<0) return;
    var t=e.target;
    if(!t||!t.closest) return;
    if(t.closest('.pickbar')) return;
    var shellEl=t.closest('.nbshell');
    if(!shellEl) return;
    var card=t.closest('.card');
    if(!card) return;
    if(t.closest('.codetoggle,.depchip,a')) return;
    e.preventDefault();e.stopPropagation();
    /* a Plot-trace tab's cards are clones — resolve to the real notebook */
    var pref=nsKey(shellEl.dataset.src||shellEl.dataset.nb,
      card.dataset.anchor);
    if(pickMulti) pickAdd(pref); else endPick(pref);
  },true);

  /* ---------- format bar wiring ---------- */
  /* the two colour POPUPS: open on their buttons, close on outside
     click or on picking a swatch (custom keeps its own panel flow) */
  /* the two colour mutations, shared by the preset swatches, the recent
     chips, the custom picker and the hover preview — one implementation
     of "what does this colour mean for this kind of item" each */
  function textMut(c){return function(a){
    if(a.k==='cell') a.txcol=c;
    else a.color=c;};}
  function fillMut(c){return function(a){
    if(a.k==='cell'){a.bgcol=c;}
    else if(a.k==='draw'){
      /* a drawn stroke has no fill to speak of — the swatch sets the
         ink, which is the only colour it has */
      if(c!=='none') a.color=c;
    }
    else if(a.k==='rect'){
      /* a shape's fill lives in a.fill/a.fillc — a.bg/a.bgc are the
         TEXT-box background and no shape renderer reads them. The
         gradient has to go, because cssFill and drawShapeSvg both
         check a.grad first and would ignore the new colour. */
      delete a.grad;
      if(c==='none'){a.fill=0;delete a.fillc;}
      else {a.fill=1;a.fillc=c;}
    }
    else if(c==='none'){a.bg=0;}
    else{a.bg=1;a.bgc=c;}};}
  function applyTextColor(c){
    if(colorSelection(c)) return;
    fmtApply(textMut(c));
  }
  function applyFillColor(c){fmtApply(fillMut(c));}
  /* ---- live preview: hovering a swatch shows the colour ON the page,
     leaving puts it back (2026-08-19, user: colours should preview live).
     The selected item is snapshotted, mutated for the render only, and
     restored — markDirty is never called, so autosave and undo never see
     a hover. ---- */
  var pvSnap=null;
  function pvAnnot(){
    var s=pres.slides[cur];
    return (s&&typeof selAnnot==='number')?(s.annots||[])[selAnnot]:null;
  }
  function pvRender(){
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(l&&s){renderAnnots(l,s);selectAnnot(l,selAnnot);}
  }
  function pvShow(mut){
    var a=pvAnnot();
    /* a highlighted RUN inside a text box is recoloured through the
       selection, which a hover must not disturb */
    if(!a||activeTextEditable()) return;
    if(pvSnap==null) pvSnap=JSON.stringify(a);
    mut(a);
    pvRender();
  }
  /* silent=true when a real apply follows immediately: it re-renders
     anyway, so the restore only has to fix the MODEL */
  function pvEnd(silent){
    if(pvSnap==null) return;
    var a=pvAnnot();
    if(a){
      var back=JSON.parse(pvSnap);
      Object.keys(a).forEach(function(k){delete a[k];});
      Object.keys(back).forEach(function(k){a[k]=back[k];});
    }
    pvSnap=null;
    if(!silent) pvRender();
  }
  /* the recent-colour chips, rebuilt from the picker's history each time
     a colour menu opens */
  function renderSwRecents(menu){
    var box=menu.querySelector('.sw-recrow');
    if(!box) return;
    var rec=cpRecent().slice(0,6);
    box.innerHTML='';
    box.hidden=!rec.length;
    if(!rec.length) return;
    var lab=document.createElement('span');
    lab.className='sw-reclab';lab.textContent='recent';
    box.appendChild(lab);
    rec.forEach(function(str){
      var b=document.createElement('button');
      b.type='button';b.className='sw-rc';b.title=str;
      b.style.background=str;
      b.dataset.c=str;
      box.appendChild(b);
    });
  }
  [['#fmt-txcol-btn','#fmt-txcol-menu','text'],
   ['#fmt-fillcol-btn','#fmt-fillcol-menu','fill']].forEach(function(pair){
    var btn=$(pair[0]),menu=$(pair[1]),target=pair[2];
    if(!btn||!menu) return;
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open.toString());
      if(open){renderSwRecents(menu);floatMenu(btn,menu);}
      else pvEnd(false);
    });
    /* CAPTURE phase: any click inside the menu restores the hover preview
       BEFORE a swatch's own apply handler runs, or the apply would land on
       the previewed state and then be clobbered by the restore */
    menu.addEventListener('click',function(){pvEnd(false);},true);
    menu.addEventListener('click',function(e){
      var rc=e.target.closest&&e.target.closest('.sw-rc');
      if(rc){
        if(target==='text') applyTextColor(rc.dataset.c);
        else applyFillColor(rc.dataset.c);
      }
      var sw=e.target.closest&&e.target.closest('.sw');
      if(rc||(sw&&!sw.classList.contains('sw-custom'))){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    });
    menu.addEventListener('mouseover',function(e){
      var sw=e.target.closest&&e.target.closest('.sw,.sw-rc');
      if(!sw||sw.classList.contains('sw-custom')) return;
      var c=sw.dataset.c; if(c==null) return;
      pvEnd(true);                /* put back the previous hover first */
      pvShow(target==='text'?textMut(c):fillMut(c));
    });
    menu.addEventListener('mouseleave',function(){pvEnd(false);});
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');
        pvEnd(false);}
    });
  });
  $$('#et-fmt .sw:not(.swbg):not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('mousedown',function(e){
      /* keep the caret/selection in the text box so we can recolour just
         the highlighted run instead of the whole box */
      if(activeTextEditable()) e.preventDefault();
    });
    sw.addEventListener('click',function(){
      applyTextColor(sw.dataset.c);
    });
  });
  function onFmt(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(){fmtApply(fn);});
  }
  onFmt('#fmt-smaller',function(a){
    if(a.k==='cell') a.ts=Math.max(0.5,
      Math.round((a.ts||1)/1.15*100)/100);
    else a.size=Math.max(1.2,
      (a.size||(a.k==='table'?2.2:2.6))/1.25);});
  onFmt('#fmt-bigger',function(a){
    if(a.k==='cell') a.ts=Math.min(3,
      Math.round((a.ts||1)*1.15*100)/100);
    else a.size=Math.min(20,
      (a.size||(a.k==='table'?2.2:2.6))*1.25);});
  /* ---- line style / weight / arrow ends / route -----------------------
     These four SHOW the option instead of naming it. They used to be
     worded lists — "Dash-dot", "Stealth", "Curved the other way", and a
     Weight button that cycled through three values and told you the
     result afterwards (2026-08-17, user: "use symbols with text on hover
     not typing what they are ... what the fuck are the curve options ...
     the weight just have all the options like word does").

     A word is a thing you decode into a picture; for a dash pattern, an
     arrowhead or a thickness the picture IS the answer, and mirroring
     "curved" in your head to get "curved the other way" is work nobody
     should be doing. Each row now draws the real thing — the same dash
     array the renderer uses, the same head path, the same relative
     weight — and keeps its name in the tooltip.

     This is NOT the wordless-glyph problem the ribbon buttons had
     (2026-08-07): a glyph STANDS FOR a thing and has to be learned; a
     preview is the thing. The buttons that open these menus stay
     worded. ---- */
  var SVG_=function(t){return document.createElementNS(SVGNS,t);};
  function svgBox(cls,vb,w,h){
    var s=SVG_('svg');
    s.setAttribute('class',cls);s.setAttribute('viewBox',vb);
    s.setAttribute('width',w);s.setAttribute('height',h);
    return s;
  }
  function strokeLine(x1,y1,x2,y2,w,dash){
    var l=SVG_('line');
    l.setAttribute('x1',x1);l.setAttribute('y1',y1);
    l.setAttribute('x2',x2);l.setAttribute('y2',y2);
    l.setAttribute('stroke','currentColor');
    l.setAttribute('stroke-width',w);
    l.setAttribute('stroke-linecap','round');
    if(dash) l.setAttribute('stroke-dasharray',dash);
    return l;
  }
  /* a 110x16 rule in the real dash array, so "dash-dot" is a dash and a
     dot rather than a hyphenated word */
  function styleIcon(id){
    var s=svgBox('ln-prev','0 0 110 16',110,16);
    s.appendChild(strokeLine(3,8,107,8,2.4,LINE_DASH[id]||''));
    return s;
  }
  /* ---- WEIGHT, in printed points, the way Word lists it. The ladder is
     Word's own; what a point costs in stored units depends on the page,
     because weight here is page-relative like everything else, so the
     conversion happens at pick time against the page you are on. ---- */
  var SW_PT=[0.25,0.5,0.75,1,1.5,2.25,3,4.5,6];
  var PT_MM=2.834645;
  function ptToSw(pt,pg){
    pg=pg||pageOf();
    return pt/PT_MM*SW_REF_H/(pg.mm[1]||191);
  }
  function swPt(a,pg){return swMm(a,pg)*PT_MM;}
  function ptLabel(pt){return String(pt).replace(/\.?0+$/,'')+' pt';}
  function weightIcon(pt){
    var s=svgBox('ln-prev','0 0 110 16',110,16);
    s.appendChild(strokeLine(3,8,107,8,Math.max(0.8,pt*1.6),''));
    return s;
  }
  /* a stub of line carrying the real head path, pointing the way that end
     points, so Start and End are told apart by looking */
  function headIcon(id,atStart){
    var s=svgBox('hd-ico','0 0 32 16',32,16);
    var h=HEAD_BY[id];
    s.appendChild(strokeLine(atStart?11:2,8,atStart?30:21,8,1.8,''));
    if(h&&h.path){
      var g=SVG_('g');
      g.setAttribute('transform',atStart
        ?'translate(12,3) scale(-1,1)':'translate(20,3)');
      var p=SVG_('path');
      p.setAttribute('d',h.path);
      if(h.open){
        p.setAttribute('fill','none');
        p.setAttribute('stroke','currentColor');
        p.setAttribute('stroke-width','1.8');
      } else p.setAttribute('fill','currentColor');
      g.appendChild(p);s.appendChild(g);
    }
    return s;
  }
  /* the same triangle at each size, so "Small" and "Huge" are a
     comparison rather than two adjectives */
  function headSizeIcon(z){
    var s=svgBox('hd-ico','0 0 32 16',32,16);
    s.appendChild(strokeLine(2,8,20,8,1.8,''));
    var k=(HEADSZ_BY[z]||HEADSZ_BY.md).mul/6.5;
    var g=SVG_('g');
    g.setAttribute('transform','translate(20,8) scale('+k+') translate(0,-5)');
    var p=SVG_('path');
    p.setAttribute('d',HEAD_BY.triangle.path);
    p.setAttribute('fill','currentColor');
    g.appendChild(p);s.appendChild(g);
    return s;
  }
  /* the routes, drawn. "Curved the other way" was a sentence you had to
     mirror in your head; this is two pictures side by side. */
  var ROUTES=[
    {id:'straight',label:'Straight',d:'M4 24 L28 8'},
    {id:'curve',label:'Curved one way',d:'M4 24 Q4 8 28 8'},
    {id:'curve-',label:'Curved the other way',d:'M4 24 Q28 24 28 8'},
    {id:'h',label:'Elbow — across, then down',d:'M4 8 L28 8 L28 24'},
    {id:'v',label:'Elbow — down, then across',d:'M4 8 L4 24 L28 24'}];
  function routeIcon(d){
    var s=svgBox('bd-ico','0 0 32 32',32,32);
    var p=SVG_('path');
    p.setAttribute('d',d);p.setAttribute('fill','none');
    p.setAttribute('stroke','currentColor');
    p.setAttribute('stroke-width','2');
    p.setAttribute('stroke-linecap','round');
    p.setAttribute('stroke-linejoin','round');
    s.appendChild(p);
    return s;
  }
  /* one drawn, wordless-on-screen, fully-named-in-the-tooltip option */
  function drawnOpt(menu,btn,title,node,key,onPick){
    var o=document.createElement('button');
    o.className='sh-opt';o.title=title;
    o.setAttribute('aria-label',title);
    o.setAttribute('aria-pressed','false');
    o.dataset.optKey=key;
    o.appendChild(node);
    o.addEventListener('click',function(e){
      e.stopPropagation();onPick();
      /* a menu that is a SECTION of a window stays up: you set the
         weight after the style without opening the window twice,
         and showFmt re-marks the rows (T177) */
      if(menu.closest&&menu.closest('.opt-panel')) return;
      menu.hidden=true;btn.setAttribute('aria-expanded','false');
    });
    menu.appendChild(o);
    return o;
  }
  function menuHead(menu,text){
    var h=document.createElement('div');
    h.className='hd-lab';h.textContent=text;menu.appendChild(h);
    return h;
  }
  function menuRow(menu,cls){
    var r=document.createElement('div');
    r.className='hd-row'+(cls?' '+cls:'');menu.appendChild(r);
    return r;
  }
  (function buildLineMenus(){
    var st=wireMenuToggle('fmt-stylewrap','fmt-style','fmt-style-menu');
    if(st) LINE_STYLES.forEach(function(s){
      drawnOpt(st.menu,st.btn,s.label,styleIcon(s.id),'ls:'+s.id,
        function(){fmtApply(function(a){a.style=s.id;delete a.dash;});});
    });
    var sw=wireMenuToggle('fmt-swwrap','fmt-sw','fmt-sw-menu');
    if(sw) SW_PT.forEach(function(pt){
      var o=drawnOpt(sw.menu,sw.btn,ptLabel(pt)+' — the printed thickness '
        +'on this page',weightIcon(pt),'sw:'+pt,
        function(){fmtApply(function(a){a.sw=ptToSw(pt);});});
      var v=document.createElement('span');
      v.className='sw-val';v.textContent=ptLabel(pt);
      o.appendChild(v);
    });
    /* ENDS: three labelled rows rather than eighteen worded lines that
       all began with the same word */
    var hd=wireMenuToggle('fmt-headwrap','fmt-head','fmt-head-menu');
    if(hd){
      menuHead(hd.menu,'Start');
      var r1=menuRow(hd.menu);
      HEADS.forEach(function(h){
        r1.appendChild(drawnOpt(hd.menu,hd.btn,h.label,
          headIcon(h.id,true),'s:'+h.id,
          function(){fmtApply(function(a){a.tail=h.id;});}));
      });
      menuHead(hd.menu,'End');
      var r2=menuRow(hd.menu);
      HEADS.forEach(function(h){
        r2.appendChild(drawnOpt(hd.menu,hd.btn,h.label,
          headIcon(h.id,false),'e:'+h.id,
          function(){fmtApply(function(a){
            a.head=h.id;delete a.nohead;});}));
      });
      menuHead(hd.menu,'Size');
      var r3=menuRow(hd.menu,'hd-sz');
      HEAD_SIZES.forEach(function(z){
        r3.appendChild(drawnOpt(hd.menu,hd.btn,z.label,
          headSizeIcon(z.id),'z:'+z.id,
          function(){fmtApply(function(a){a.hsz=z.id;});}));
      });
    }
    /* CHANGE SHAPE: the same fifteen shapes the Insert menu offers,
       drawn by the same shapeIcon, instead of a button that stepped
       through them one click at a time with no way back (2026-08-17). */
    var sp=wireMenuToggle('fmt-shapewrap','fmt-shape','fmt-shape-menu');
    if(sp) SHAPE_LIST.forEach(function(pair){
      drawnOpt(sp.menu,sp.btn,pair[1],shapeIcon(pair[0]),'sp:'+pair[0],
        function(){fmtApply(function(a){
          if(pair[0]==='rect') delete a.shape; else a.shape=pair[0];});});
    });
    var bd=wireMenuToggle('fmt-bendwrap','fmt-bend','fmt-bend-menu');
    if(bd) ROUTES.forEach(function(r){
      drawnOpt(bd.menu,bd.btn,r.label,routeIcon(r.d),'bd:'+r.id,
        function(){fmtApply(function(a){
          if(r.id==='straight'){delete a.bend;delete a.curve;}
          else if(r.id==='curve'){delete a.bend;a.curve=14;}
          else if(r.id==='curve-'){delete a.bend;a.curve=-14;}
          else {a.bend=r.id;delete a.curve;}
        });});
    });
  })();
  /* which option the selection is ON. Without it a drawn menu is a set of
     pictures with no answer to "and which one am I?" — the one thing the
     worded lists were no better at, and the reason a cycling Weight
     button felt like guessing. */
  function syncLineMenus(a){
    if(!a) return;
    var cur={};
    cur['ls:'+lineStyle(a)]=1;
    cur['s:'+headStart(a)]=1;
    cur['e:'+headEnd(a)]=1;
    cur['z:'+headSize(a).id]=1;
    cur['bd:'+(a.bend?a.bend:(a.curve>0?'curve'
      :(a.curve<0?'curve-':'straight')))]=1;
    cur['sp:'+(a.shape||'rect')]=1;
    /* the nearest rung of the ladder, since a stored weight need not be
       exactly one of them (an older poster, or a page that has changed
       size since) */
    var pt=swPt(a),best=SW_PT[0];
    SW_PT.forEach(function(p){
      if(Math.abs(p-pt)<Math.abs(best-pt)) best=p;});
    cur['sw:'+best]=1;
    $$('#fmt-style-menu .sh-opt,#fmt-sw-menu .sh-opt,'
      +'#fmt-head-menu .sh-opt,#fmt-bend-menu .sh-opt,'
      +'#fmt-shape-menu .sh-opt').forEach(function(o){
      o.setAttribute('aria-pressed',cur[o.dataset.optKey]?'true':'false');
    });
  }
  /* ---- THE FILL PANEL --------------------------------------------------
     Six worded rows became a panel you pick from by LOOKING. "Gradient —
     linear" told you nothing about which way it ran, and "gradient from
     different directions, multiple colours" was not expressible at all
     (2026-08-20, user: "all the gradient fills are just words. Put images
     showing it. Also put heaps of options in this").
     Every chip is drawn with the shape's OWN colours, so the preview is
     the answer rather than an illustration of one.
     It also absorbs the fill COLOUR swatches. There used to be a "Fill"
     here and a "Fill colour" two groups away, and nobody could tell which
     was which ("Also confusing there is a fill and fill colour"); a shape
     now has exactly one Fill control with everything in it. */
  var GRAD_DIRS=[
    [0,'Left to right'],[45,'Bottom-left to top-right'],
    [90,'Bottom to top'],[135,'Bottom-right to top-left'],
    [180,'Right to left'],[225,'Top-right to bottom-left'],
    [270,'Top to bottom'],[315,'Top-left to bottom-right']];
  /* Ready-made ramps. Each is a list of stops, so three- and four-colour
     gradients are as ordinary as two-colour ones. */
  var GRAD_PRESETS=[
    ['Fade out',      null, [0,1]],
    ['Fade to dark',  ['#00000000','#000000cc'], null],
    ['Fade to white', ['#ffffff00','#ffffffdd'], null],
    ['Ocean',   ['#39a9c0','#1e6f9e','#123a63'], null],
    ['Sunset',  ['#f0a848','#e5484d','#7a2b6b'], null],
    ['Forest',  ['#8fd694','#41c493','#0f5c46'], null],
    ['Ember',   ['#ffd08a','#ff6b57','#8c1d2f'], null],
    ['Violet',  ['#c3a6ff','#7a52c0','#241a4d'], null],
    ['Steel',   ['#dbe6ee','#8aa0b0','#33424f'], null],
    ['Mono',    ['#ffffff','#9aa7b2','#1b2530'], null],
    ['Warm/cool',['#f0a848','#39a9c0'], null],
    ['Three-tone',['#39a9c0','#f0a848','#e5484d'], null]];
  /* a drawn swatch of a fill, as an inline SVG so it is crisp at any dpi
     and needs no image file */
  function fillSwatch(kind,opt,base){
    var w=34,h=22;
    var paint=tokVal(base)||'#39a9c0';
    var sv=svgBox('fillsw','0 0 '+w+' '+h,w,h);
    var uid='fsw'+(fillSwatch._n=(fillSwatch._n||0)+1);
    var r=SVG_('rect');
    r.setAttribute('x','0.5');r.setAttribute('y','0.5');
    r.setAttribute('width',w-1);r.setAttribute('height',h-1);
    r.setAttribute('rx','3');
    r.setAttribute('stroke','#ffffff30');
    if(kind==='none'){
      r.setAttribute('fill','none');
      sv.appendChild(r);
      /* the universal "nothing here": a diagonal through an empty box */
      var ln=SVG_('line');
      ln.setAttribute('x1','2');ln.setAttribute('y1',h-2);
      ln.setAttribute('x2',w-2);ln.setAttribute('y2','2');
      ln.setAttribute('stroke','#e5484d');ln.setAttribute('stroke-width','1.6');
      sv.appendChild(ln);
      return sv;
    }
    if(kind==='solid'||kind==='tint'){
      r.setAttribute('fill',kind==='tint'
        ?shapeFill(paint,0x2b/255):paint);
      sv.appendChild(r);return sv;
    }
    /* a gradient: build the paint server the same way drawShapeSvg does,
       so what you pick is exactly what you get */
    var defs=SVG_('defs');
    var g=tokenGradient(opt,paint);
    var gel=SVG_(g.type==='radial'?'radialGradient':'linearGradient');
    gel.setAttribute('id',uid);
    if(g.type==='radial'){
      gel.setAttribute('cx','50%');gel.setAttribute('cy','50%');
      gel.setAttribute('r','62%');
    } else {
      var rad=((+g.ang||0))*Math.PI/180;
      gel.setAttribute('x1',(50-50*Math.cos(rad))+'%');
      gel.setAttribute('y1',(50-50*Math.sin(rad))+'%');
      gel.setAttribute('x2',(50+50*Math.cos(rad))+'%');
      gel.setAttribute('y2',(50+50*Math.sin(rad))+'%');
    }
    gradStops(g).forEach(function(st){
      var s2=SVG_('stop');
      s2.setAttribute('offset',st.o==null?0:st.o);
      s2.setAttribute('stop-color',st.c);
      gel.appendChild(s2);
    });
    defs.appendChild(gel);sv.appendChild(defs);
    r.setAttribute('fill','url(#'+uid+')');
    sv.appendChild(r);
    return sv;
  }
  /* evenly spaced stops from a list of colours */
  function stopsFrom(cols){
    var n=cols.length;
    return cols.map(function(c,i){
      return {o:n<2?0:(i/(n-1)),c:c};});
  }
  (function(){
    var wrap=$('#fmt-fillwrap'),btn=$('#fmt-fillstyle'),
        menu=$('#fmt-fillstyle-menu');
    if(!wrap||!btn||!menu) return;
    menu.classList.add('fill-panel');
    function curA(){
      var s2=pres.slides[cur];return annotByIdx(s2,selAnnot);
    }
    function baseCol(){
      var a=curA();
      return (a&&(a.fillc||(a.grad&&gradStops(a.grad)[0].c)||a.color))
        ||'#39a9c0';
    }
    function chip(node,label,on,fn){
      var b=document.createElement('button');
      b.className='fill-chip'+(on?' on':'');
      b.type='button';b.title=label;
      b.setAttribute('aria-pressed',on?'true':'false');
      b.appendChild(node);
      b.addEventListener('click',function(e){
        e.stopPropagation();fn();menu.hidden=true;
        btn.setAttribute('aria-expanded','false');});
      return b;
    }
    function build(){
      var a=curA(); if(!a) return;
      var base=baseCol();
      menu.innerHTML='';
      menuHead(menu,'fill');
      var r1=document.createElement('div');r1.className='fill-row';
      r1.appendChild(chip(fillSwatch('none',null,base),'No fill',
        !a.fill&&!a.grad,function(){
          fmtApply(function(x){x.fill=0;delete x.fillc;delete x.grad;});}));
      r1.appendChild(chip(fillSwatch('tint',null,base),
        'Tint of the outline colour',
        !!a.fill&&!a.grad&&!a.fillc,function(){
          fmtApply(function(x){x.fill=1;delete x.fillc;delete x.grad;});}));
      r1.appendChild(chip(fillSwatch('solid',null,base),'Solid '+base,
        !!a.fill&&!a.grad&&!!a.fillc,function(){
          fmtApply(function(x){
            x.fill=1;x.fillc=x.fillc||x.color||'#39a9c0';delete x.grad;});}));
      menu.appendChild(r1);
      /* the COLOUR, in the same panel — there is no second Fill control */
      menuHead(menu,'fill colour');
      var r2=document.createElement('div');r2.className='fill-row';
      ['#e5484d','#ff6b57','#f0a848','#39a9c0','#46a892','#6b9bff',
       '#a586e8','#ffffff','#8aa0b0','#16202b'].forEach(function(c){
        var sw=document.createElement('span');
        sw.className='fill-dot';sw.style.background=c;
        r2.appendChild(chip(sw,c,a.fillc===c,function(){
          fmtApply(function(x){
            if(x.grad){
              /* recolour the ramp's first stop rather than throwing the
                 gradient away — changing a colour should not silently
                 change the KIND of fill */
              var st=gradStops(x.grad).slice();
              st[0]={o:st[0].o,c:c};
              gradSet(x,{type:x.grad.type,ang:x.grad.ang,stops:st});
            } else {x.fill=1;x.fillc=c;}
          });}));
      });
      var cus=document.createElement('span');
      cus.className='fill-dot fill-custom';
      r2.appendChild(chip(cus,'Custom colour…',false,function(){
        openColorPop('fill',btn);}));
      menu.appendChild(r2);
      menuHead(menu,'gradient — direction');
      var r3=document.createElement('div');r3.className='fill-row';
      GRAD_DIRS.forEach(function(d){
        var g={type:'linear',ang:d[0],
          stops:[{o:0,c:base},{o:1,c:gradPartner(base)}]};
        var on=!!(a.grad&&a.grad.type!=='radial'
          &&(+a.grad.ang||0)===d[0]);
        r3.appendChild(chip(fillSwatch('grad',g,base),d[1],on,function(){
          fmtApply(function(x){
            var b2=x.fillc||(x.grad&&gradStops(x.grad)[0].c)||x.color
              ||'#39a9c0';
            gradSet(x,{type:'linear',ang:d[0],
              stops:[{o:0,c:b2},{o:1,c:gradPartner(b2)}]});});}));
      });
      var gr={type:'radial',stops:[{o:0,c:base},{o:1,c:gradPartner(base)}]};
      r3.appendChild(chip(fillSwatch('grad',gr,base),'From the centre',
        !!(a.grad&&a.grad.type==='radial'),function(){
          fmtApply(function(x){
            var b2=x.fillc||(x.grad&&gradStops(x.grad)[0].c)||x.color
              ||'#39a9c0';
            gradSet(x,{type:'radial',
              stops:[{o:0,c:b2},{o:1,c:gradPartner(b2)}]});});}));
      menu.appendChild(r3);
      menuHead(menu,'gradient — ready-made');
      var r4=document.createElement('div');r4.className='fill-row';
      GRAD_PRESETS.forEach(function(pr){
        var cols=pr[1]||[base,gradPartner(base)];
        var g2={type:'linear',ang:270,stops:stopsFrom(cols)};
        r4.appendChild(chip(fillSwatch('grad',g2,base),pr[0],false,
          function(){
            fmtApply(function(x){
              var cs=pr[1]||[(x.fillc||x.color||'#39a9c0'),
                gradPartner(x.fillc||x.color||'#39a9c0')];
              gradSet(x,{type:'linear',
                ang:(x.grad&&x.grad.ang!=null)?x.grad.ang:270,
                stops:stopsFrom(cs)});});}));
      });
      menu.appendChild(r4);
    }
    /* not wireFloatDropdown: the fill panel REBUILDS on every open to
       reflect the selection, so the helper's static options never fit */
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)) menu.hidden=true;
    });
  })();
  /* ---- THE PARAGRAPH WINDOW (T177) ------------------------------------
     Alignment, the list toggles, the whole-box indent, line and
     paragraph spacing, and the curve: every "how the words sit" answer
     under a heading of its own in ONE window, built on open so each row
     shows which answer is on. Alignment and curve used to be one worded
     menu called Layout; spacing was another called Spacing; the list
     toggles were bare buttons between them (2026-09-02, user: "heaps
     of buttons that you always have to click through").
     paraApply is the old Layout menu's handler, kept whole: the model
     it writes is unchanged. The curve options are listed flat rather
     than nested -- a menu that opens a menu is worse than a slightly
     longer list. */
  var ALIGNS=[['left','Left'],['center','Centre'],['right','Right']];
  var CURVES=[[0,'Straight'],[12,'Gentle arch'],[30,'Arch'],
    [55,'Strong arch'],[-12,'Gentle sag'],[-30,'Sag']];
  function paraApply(v){
    /* Bullets and numbering are BUTTONS in this window, not a line of
       a menu: burying a toggle whose state you cannot see inside a
       dropdown called "Layout" is half of why it never behaved the way
       anyone expected (2026-08-20, user). */
    if(v.indexOf('a:')===0){
      var al=v.slice(2);
      fmtApply(function(a){a.align=al;});
      return;
    }
    if(v.indexOf('i:')===0){
      var out=v.slice(2)==='-';
      fmtApply(function(a){boxIndent(a,out);});
      return;
    }
    var n=+v.slice(2);
    fmtApply(function(a){
      if(!n){delete a.arc;return;}
      /* a list has several baselines and no single curve to follow, so
         curving one turns the list off rather than quietly doing
         nothing — the two cannot both be true. It converts the content
         back to lines instead of DELETING it, which is what the old
         `delete a.html` did (2026-08-20). */
      if(listOf(a)) setListStyle(a,0);
      a.arc=n;
    });
  }
  /* one of several answers, and it shows whether it is the one that
     is on. The window stays open after a pick; the rows are rebuilt
     by showFmt (optPanelsSync) so the mark moves at once. */
  function optChip(host,label,on,title,fn){
    var b=document.createElement('button');
    b.type='button';b.className='dbtn opt-chip';b.textContent=label;
    if(title) b.title=title;
    b.setAttribute('aria-pressed',on?'true':'false');
    b.addEventListener('click',function(e){e.stopPropagation();fn();});
    host.appendChild(b);
    return b;
  }
  /* a section is a heading over a row; hiding one hides both */
  function optSection(row,on){
    if(!row) return;
    row.hidden=!on;
    var lab=row.previousElementSibling;
    if(lab&&lab.classList.contains('hd-lab')) lab.hidden=!on;
  }
  function buildParaPanel(){
    var s2=pres.slides[cur],a=annotByIdx(s2,selAnnot); if(!a) return;
    /* a table's WORDS take spacing; alignment, the box indent and the
       curve are a text box's own */
    var isTx=(a.k==='text');
    /* alignment and the two lists are buttons in the row again
       (T189); the window keeps what is set once */
    var ind=$('#fmt-para-ind'),cv=$('#fmt-para-curve');
    [ind,cv].forEach(function(h){
      if(!h) return;
      h.innerHTML='';optSection(h,isTx);
    });
    if(isTx&&ind&&cv){
      /* the whole-box indent is a stepper with its count between the
         steps, because a level is a number rather than a choice */
      var steps=Math.round((a.ind||0)/IND_STEP);
      optChip(ind,'− Out',false,
        'Move the whole box out one step',
        function(){paraApply('i:-');}).disabled=!steps;
      var lvl=document.createElement('span');
      lvl.className='opt-val';
      lvl.textContent=steps?(steps+' step'+(steps===1?'':'s')):'none';
      ind.appendChild(lvl);
      optChip(ind,'+ In',false,
        'Move the whole box in one step',
        function(){paraApply('i:+');}).disabled=steps>=4;
      CURVES.forEach(function(p){
        optChip(cv,p[1],(a.arc||0)===p[0],
          p[0]<0?'Round the bottom (as PowerPoint calls it)':'',
          function(){paraApply('c:'+p[0]);});
      });
    }
    buildSpacingRows();
  }
  /* ---- WINDOWS OF OPTIONS (T177) ---------------------------------------
     A worded door on the ribbon opens a panel holding a whole cluster of
     related controls -- the font, the paragraph, the line, the source.
     The REAL controls live inside, moved there in the markup rather than
     copied, so every handler and every test keeps addressing the one
     element it always did, and a ribbon layout moves the window as one
     atom (rbnResolve). The one owner (overlayShow) makes a window
     exclusive and closes it on Escape or a click away; a click INSIDE
     keeps it open, which is what makes it a room rather than a menu:
     open once, then bold, italic and a size in a row. data-close marks
     the windows whose rows are things you do and leave (Source), and
     those close as they act. Every door is wired here, from THE BOOT
     SEQUENCE, so a window added to the markup needs no JS of its own. */
  function optBuilder(id){
    return id==='fmt-para-menu'?buildParaPanel:null;
  }
  function optKids(w){
    var door=null,panel=null;
    [].slice.call(w.children).forEach(function(c){
      if(!door&&c.classList.contains('dbtn')) door=c;
      if(!panel&&c.classList.contains('opt-panel')) panel=c;
    });
    return {door:door,panel:panel};
  }
  /* rebuild whatever window is open, so a pick inside it shows at once */
  function optPanelsSync(){
    $$('.opt-panel').forEach(function(p){
      if(p.hidden) return;
      var fn=optBuilder(p.id); if(fn) fn();
    });
  }
  function optPanelsClose(){
    $$('.opt-panel').forEach(function(p){if(!p.hidden) overlayHide(p);});
  }
  function optPanelBoot(){
    $$('.opt-drop').forEach(function(w){
      var k=optKids(w),door=k.door,panel=k.panel;
      if(!door||!panel) return;
      door.addEventListener('click',function(e){
        e.stopPropagation();
        if(!panel.hidden){overlayHide(panel);return;}
        var fn=optBuilder(panel.id); if(fn) fn();
        overlayShow(door,panel);floatMenu(door,panel);
      });
      /* CAPTURE, so a row that stops propagation still closes the
         window it sits in */
      if(panel.dataset.close) panel.addEventListener('click',function(e){
        var b=e.target.closest&&e.target.closest('button');
        if(b&&panel.contains(b)&&!b.disabled) overlayHide(panel);
      },true);
    });
  }
  /* ---- LINE SPACING ---------------------------------------------------
     A MULTIPLE of the type size, the way every word processor states it -
     so it means the same thing at every zoom and on every page size, and
     needs no re-measuring. Paragraph spacing is the half nobody asks for
     until their bullets are touching each other. */
  /* ---- INDENTATION ----------------------------------------------------
     Whole-box indent, in em of the box's own type size, stepped rather
     than typed \u2014 the same currency and the same shape as line and
     paragraph spacing beside it. Capped at four steps because a fifth
     leaves nothing to indent INTO on a slide. */
  var IND_STEP=2;
  function boxIndent(a,out){
    var v=(a.ind||0)+(out?-IND_STEP:IND_STEP);
    v=Math.max(0,Math.min(IND_STEP*4,v));
    if(v) a.ind=v; else delete a.ind;
  }
  var LH_STEPS=[[0,'Default'],[1,'Single'],[1.15,'1.15'],[1.5,'1\u00bd'],
    [2,'Double'],[2.5,'2\u00bd'],[3,'Triple']];
  var PS_STEPS=[[0,'None'],[0.25,'Small'],[0.5,'Medium'],[1,'Large'],
    [1.5,'Very large']];
  /* the two spacing rows, a SECTION of the Paragraph window (T177).
     Built with the window and rebuilt after every pick, so the chip
     that is on is the value the box has. #fmt-lhwrap keeps its id
     because showFmt governs it by kind: a table's words take spacing
     and a table has no Paragraph rows of its own. */
  function buildSpacingRows(){
    var menu=$('#fmt-lh-menu'); if(!menu) return;
    var s2=pres.slides[cur],a=annotByIdx(s2,selAnnot);
    menu.innerHTML='';
    [['between lines',LH_STEPS,'lh'],
     ['between paragraphs',PS_STEPS,'pspace']].forEach(function(sec){
      menuHead(menu,sec[0]);
      var row=document.createElement('div');row.className='opt-row';
      sec[1].forEach(function(st){
        optChip(row,st[1],((a&&a[sec[2]])||0)===st[0],'',function(){
          fmtApply(function(x){
            if(st[0]) x[sec[2]]=st[0]; else delete x[sec[2]];});
        });
      });
      menu.appendChild(row);
    });
  }
  /* ---- bullets / numbering / indent ----------------------------------
     Real buttons that show their own state, because a list is something
     you can SEE is on. Indent and outdent drive the browser's own list
     machinery, which is what builds the nested <ul> the model stores. */
  function listApply(style){
    fmtApply(function(a){
      if(a.k!=='text') return;
      setListStyle(a,listOf(a)===style?0:style);
    });
  }
  /* plain listeners, not onFmt: onFmt wraps its callback in fmtApply and
     hands it one annot, and both of these already drive fmtApply
     themselves (the list ones) or act on the live caret (the indent
     ones) */
  function onBtn(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(e){e.preventDefault();fn();});
  }
  /* ---- table structure ---------------------------------------------
     Rows and columns are added at the END. "Insert above the cell I am
     in" needs a selected CELL, which would be a second kind of selection
     living beside the item selection, and nothing else in this editor has
     one - so the honest version is the one that always works. */
  function tblApply(fn){
    fmtApply(function(a){if(a.k==='table') fn(a);});
  }
  onBtn('#fmt-tbl-rowplus',function(){tblApply(function(a){
    tableGrow(a,'row',1);});});
  onBtn('#fmt-tbl-rowminus',function(){tblApply(function(a){
    tableGrow(a,'row',-1);});});
  onBtn('#fmt-tbl-colplus',function(){tblApply(function(a){
    tableGrow(a,'col',1);});});
  onBtn('#fmt-tbl-colminus',function(){tblApply(function(a){
    tableGrow(a,'col',-1);});});
  onBtn('#fmt-tbl-head',function(){tblApply(function(a){
    if(a.thead) delete a.thead; else a.thead=1;});});
  onBtn('#fmt-tbl-grid',function(){tblApply(function(a){
    if(a.grid===0) a.grid=1; else a.grid=0;});});
  /* ---- the Styles menu ------------------------------------------------
     Picking a style stamps it. "Update from this one" is the other half
     and the reason a style registry is worth having at all: format ONE
     heading the way you want it, then push that look to every heading in
     the deck without touching them one at a time. */
  (function(){
    var menu=$('#fmt-style-menu-tx');
    if(!menu) return;
    function build(){
      menu.innerHTML='';
      var s2=pres.slides[cur],a=annotByIdx(s2,selAnnot);
      var curId=a&&a.style;
      menuHead(menu,'apply a style');
      styleOrder().forEach(function(id){
        var d=styleDef(id);
        var b=document.createElement('button');
        b.className='dbtn vw-opt jv-styleopt';
        b.setAttribute('aria-pressed',(curId===id).toString());
        var t=document.createElement('span');
        t.className='jv-stylename';
        t.textContent=d.label;
        /* the row is a SPECIMEN: it is set in the style it names, so you
           pick by looking rather than by reading a number */
        t.style.fontWeight=d.b?'700':'400';
        if(d.i) t.style.fontStyle='italic';
        t.style.fontSize=Math.max(11,Math.min(21,d.size*3.1))+'px';
        if(d.color) t.style.color=tokVal(d.color);
        b.appendChild(t);
        var n=document.createElement('span');
        n.className='jv-stylesz';
        n.textContent=Math.round(d.size*5.4)+' pt';
        b.appendChild(n);
        b.addEventListener('click',function(e){
          e.stopPropagation();
          fmtApply(function(x){
            if(x.k==='text') applyStyleTo(x,id);});
          menu.hidden=true;
        });
        menu.appendChild(b);
      });
      menuHead(menu,'this deck');
      var upd=document.createElement('button');
      upd.className='dbtn vw-opt';
      upd.innerHTML=bic('reload')+' Update the style from this box';
      upd.title='Take this box\u2019s size, weight, font and colour and '
        +'make them the style \u2014 every other box wearing it follows';
      upd.disabled=!curId;
      upd.addEventListener('click',function(e){
        e.stopPropagation();
        var s3=pres.slides[cur],a3=annotByIdx(s3,selAnnot);
        if(!a3||!a3.style) return;
        var d3={size:a3.size,label:STYLE_DEFAULTS[a3.style].label};
        /* whether a type counts as a heading is a property of the TYPE,
           not of the box you happened to select — carry it forward or a
           custom heading silently stops being one the first time anyone
           updates it from a box (2026-08-22) */
        if(STYLE_DEFAULTS[a3.style].head) d3.head=1;
        if(a3.b) d3.b=1;
        if(a3.i) d3.i=1;
        if(a3.font) d3.font=a3.font;
        if(a3.color) d3.color=a3.color;
        deckStyles()[a3.style]=d3;
        restyleDeck([a3.style]);
        menu.hidden=true;
        toast('\u201c'+d3.label+'\u201d updated everywhere');
      });
      menu.appendChild(upd);
      var all=document.createElement('button');
      all.className='dbtn vw-opt';
      all.innerHTML=bic('inherit')+' Apply this look to ALL headings';
      all.title='Push this box\u2019s weight, font and colour to Title '
        +'and Headings 1\u20133, keeping each one\u2019s own size';
      all.addEventListener('click',function(e){
        e.stopPropagation();
        var s4=pres.slides[cur],a4=annotByIdx(s4,selAnnot);
        if(!a4){menu.hidden=true;return;}
        headingStyles().forEach(function(id){
          var d4=deckStyles()[id]||{};
          /* SIZE is what makes a heading level a level, so it is the one
             thing this does not flatten */
          d4.size=(deckStyles()[id]||{}).size||STYLE_DEFAULTS[id].size;
          d4.label=STYLE_DEFAULTS[id].label;
          if(a4.b) d4.b=1; else delete d4.b;
          if(a4.i) d4.i=1; else delete d4.i;
          if(a4.font) d4.font=a4.font; else delete d4.font;
          if(a4.color) d4.color=a4.color; else delete d4.color;
          deckStyles()[id]=d4;
        });
        restyleDeck(headingStyles());
        menu.hidden=true;
        toast('Every heading in this presentation now matches');
      });
      menu.appendChild(all);
      /* the same idea as the row above it, opened out: any type rather
         than the four headings, any property set rather than all of
         them, any slides rather than the whole deck. It is repeated here
         as well as in Arrange because this is where the one-click
         version has always lived, and that is where people will look for
         the fuller one (2026-08-22). */
      var more=document.createElement('button');
      more.className='dbtn vw-opt';
      more.innerHTML=bic('inherit')+' Apply this look to…';
      more.title='Choose which properties travel and which slides they '
        +'travel to';
      more.addEventListener('click',function(e){
        e.stopPropagation();
        menu.hidden=true;
        if(typeof window.SemDeckApplyDlg==='function')
          window.SemDeckApplyDlg();
      });
      menu.appendChild(more);
    }
    /* walk the whole deck and re-stamp anything wearing these styles.
       This was a byte-for-byte copy of restyleAll with the "no ids means
       everything" branch removed; now that restyleAll takes a slide scope
       there is a real reason not to keep two of them drifting apart, so
       this is a name kept for its callers and nothing more. */
    function restyleDeck(ids){
      return restyleAll(ids,null);
    }
    var btn=$('#fmt-style-tx');
    if(btn) btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn)
        menu.hidden=true;
    });
  })();
  onBtn('#fmt-bullets',function(){listApply('bullet');});
  onBtn('#fmt-numbers',function(){listApply('number');});
  /* the three alignments, as buttons (T189) */
  ALIGNS.forEach(function(p){
    onBtn('#fmt-al-'+(p[0]==='center'?'center':p[0]),function(){
      paraApply('a:'+p[0]);});
  });
  /* indent/outdent only mean anything with the caret inside the box, so
     they act on the live contenteditable rather than the model, and the
     blur handler writes the result back like any other typing */
  function listIndent(out){
    var el=activeTextEditable();
    if(!el||!el.classList.contains('an-ul')){
      toast('Click into the list first, then indent');return;
    }
    try{document.execCommand(out?'outdent':'indent',false,null);}catch(e){}
    el.focus();
  }
  onBtn('#fmt-indent',function(){listIndent(false);});
  onBtn('#fmt-outdent',function(){listIndent(true);});
  /* the far end of a generated gradient: the same hue taken most of the
     way to transparent, which reads as a wash rather than a second
     colour you did not choose */
  /* the .pptx exporter speaks in two colours, so every gradient written
     here also carries its first and last stop in the old a/b fields */
  function gradSet(a,g){
    var st=gradStops(g);
    g.stops=st;
    g.a=st[0].c;g.b=st[st.length-1].c;
    a.fill=1;a.grad=g;
    delete a.fillc;
  }
  function gradPartner(col){
    var c=parseColor(tokVal(col));
    if(!c) return '#00000000';
    return 'rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '+clamp255(c.b)
      +', 0.06)';
  }
  $$('#et-fmt .swbg:not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('click',function(){
      applyFillColor(sw.dataset.c);
    });
  });

  /* ---------- professional colour picker: hex / rgb / rgba + alpha + a
     recent-colours strip. Text swatches and the fill swatches each get a
     rainbow "＋" chip that opens it; any CSS colour string is accepted. ---- */
  var cpEl=$('#color-pop'), cpTarget='text', cpRGBA={r:57,g:169,b:192,a:1};
  /* a live text selection captured when the picker opens, so a custom colour
     can recolour just the highlighted run (focus moves to the popup on apply) */
  var cpSavedEl=null, cpSavedRange=null;
  function clamp255(n){n=Math.round(+n||0);return n<0?0:n>255?255:n;}
  function hex2(n){return ('0'+clamp255(n).toString(16)).slice(-2);}
  function toHex(c){return '#'+hex2(c.r)+hex2(c.g)+hex2(c.b);}
  function toStr(c){
    return c.a>=1?toHex(c):('rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '
      +clamp255(c.b)+', '+(Math.round(c.a*100)/100)+')');
  }
  /* faint fill tint of a shape's colour — PARSE first so translucent rgba()
     colours work, not just #rrggbb (a hex-suffix concat would corrupt them);
     `alpha` is the tint fraction of 255 (matches the old 0x26 / 0x2b). */
  function shapeFill(col,alpha){
    var c=parseColor(col); if(!c) return 'transparent';
    return 'rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '+clamp255(c.b)+', '
      +(Math.round(c.a*alpha*1000)/1000)+')';
  }
  function parseColor(str){
    if(!str) return null;
    str=String(str).trim();
    var m=str.match(/^#([0-9a-f]{3,8})$/i);
    if(m){
      var h=m[1];
      if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      else if(h.length===4) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
      if(h.length===6||h.length===8) return {
        r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),
        b:parseInt(h.slice(4,6),16),
        a:h.length===8?parseInt(h.slice(6,8),16)/255:1};
      return null;
    }
    m=str.match(/^rgba?\(([^)]+)\)$/i);
    if(m){
      var p=m[1].split(/[,\s/]+/).filter(Boolean);
      if(p.length>=3){var pa=parseFloat(p[3]);
        return {r:clamp255(parseFloat(p[0])),g:clamp255(parseFloat(p[1])),
          b:clamp255(parseFloat(p[2])),
          a:p.length>3?(isFinite(pa)?Math.max(0,Math.min(1,pa)):1):1};}
    }
    return null;
  }
  function cpSync(from){
    var nat=$('#cp-native'),hx=$('#cp-hex'),rg=$('#cp-rgb'),
        al=$('#cp-alpha'),av=$('#cp-aval'),pv=$('#cp-preview');
    if(nat&&from!=='native') nat.value=toHex(cpRGBA);
    if(hx&&from!=='hex') hx.value=cpRGBA.a>=1?toHex(cpRGBA)
      :toHex(cpRGBA)+hex2(Math.round(cpRGBA.a*255));
    if(rg&&from!=='rgb') rg.value='rgba('+clamp255(cpRGBA.r)+', '
      +clamp255(cpRGBA.g)+', '+clamp255(cpRGBA.b)+', '
      +(Math.round(cpRGBA.a*100)/100)+')';
    if(al&&from!=='alpha') al.value=Math.round(cpRGBA.a*100);
    if(av) av.textContent=Math.round(cpRGBA.a*100)+'%';
    if(pv) pv.style.setProperty('--cpc',toStr(cpRGBA));
    if(hx) hx.classList.remove('bad');
    if(rg) rg.classList.remove('bad');
    cpPreview();
  }
  /* the picker previews LIVE on the selected item as the colour changes;
     Apply commits it, closing without applying puts it back. A saved text
     RUN is the exception — its selection cannot survive a re-render. */
  function cpPreview(){
    if(!cpEl||cpEl.hidden||cpSavedRange) return;
    pvEnd(true);
    pvShow((cpTarget==='text'?textMut:fillMut)(toStr(cpRGBA)));
  }
  function cpRecent(){
    try{return JSON.parse(localStorage.getItem('plotline-colors')||'[]');}
    catch(e){return [];}
  }
  function cpPushRecent(str){
    var arr=cpRecent().filter(function(x){return x!==str;});
    arr.unshift(str);
    try{localStorage.setItem('plotline-colors',
      JSON.stringify(arr.slice(0,12)));}catch(e){}
  }
  function cpRenderRecent(){
    var box=$('#cp-recent'); if(!box) return;
    box.innerHTML='';
    cpRecent().forEach(function(str){
      var b=document.createElement('button');
      b.className='cp-rsw cp-sw-chk';b.type='button';b.title=str;
      b.style.setProperty('--cpc',str);
      b.addEventListener('click',function(){
        var c=parseColor(str); if(c){cpRGBA=c;cpSync();}});
      box.appendChild(b);
    });
  }
  function cpCurrentFor(target){
    var s=pres.slides[cur];
    var a=(s&&selAnnot!==null)?annotByIdx(s,selAnnot):null;
    if(!a) return null;
    if(target==='fill'){
      if(a.k==='cell') return a.bgcol||null;
      /* a shape prefills from its OWN fill, not the text-box background */
      if(a.k==='rect') return (a.grad&&a.grad.a)
        ||(a.fill?(a.fillc||a.color||null):null);
      return a.bg===0?null:(a.bgc||null);
    }
    return a.k==='cell'?(a.txcol||null):(a.color||null);
  }
  function openColorPop(target,anchor){
    if(!cpEl) return;
    cpTarget=target;
    cpSavedEl=null;cpSavedRange=null;
    if(target==='text'){
      var te=activeTextEditable();
      if(te&&selectionInside(te)) try{
        cpSavedEl=te;
        cpSavedRange=window.getSelection().getRangeAt(0).cloneRange();
      }catch(e){cpSavedEl=null;cpSavedRange=null;}
    }
    var head=$('#cp-head');
    if(head) head.textContent=target==='fill'?'Custom fill':'Custom colour';
    var c0=parseColor(cpCurrentFor(target))||{r:57,g:169,b:192,a:1};
    cpRGBA={r:c0.r,g:c0.g,b:c0.b,a:c0.a};
    cpRenderRecent();cpSync();
    cpEl.hidden=false;
    var r=anchor.getBoundingClientRect(),w=236;
    var ph=cpEl.getBoundingClientRect().height||300;
    var left=Math.max(8,Math.min(r.left,window.innerWidth-w-8));
    var top=r.bottom+8;
    if(top+ph>window.innerHeight-8) top=Math.max(8,r.top-ph-8);
    cpEl.style.left=left+'px';cpEl.style.top=top+'px';
  }
  function cpApply(){
    pvEnd(true);          /* commit lands on the real state, not the preview */
    var str=toStr(cpRGBA);
    if(cpTarget==='text'){
      var did=false;
      /* restore the highlighted run (focus moved to the popup) and recolour
         just it, like the preset swatches do; else colour the whole box */
      if(cpSavedEl&&cpSavedRange&&document.body.contains(cpSavedEl)) try{
        cpSavedEl.focus();
        var sel=window.getSelection();
        sel.removeAllRanges();sel.addRange(cpSavedRange);
        did=colorSelection(str);
      }catch(e){did=false;}
      if(!did) fmtApply(function(a){
        if(a.k==='cell') a.txcol=str; else a.color=str;});
    } else fmtApply(function(a){
      if(a.k==='cell') a.bgcol=str;
      else if(a.k==='rect'){a.fill=1;a.fillc=str;delete a.grad;}
      else {a.bg=1;a.bgc=str;}});
    cpSavedEl=null;cpSavedRange=null;
    cpPushRecent(str);
    if(cpEl) cpEl.hidden=true;
  }
  (function(){
    var nat=$('#cp-native'),hx=$('#cp-hex'),rg=$('#cp-rgb'),al=$('#cp-alpha');
    if(nat) nat.addEventListener('input',function(){
      var c=parseColor(nat.value);
      if(c){cpRGBA.r=c.r;cpRGBA.g=c.g;cpRGBA.b=c.b;cpSync('native');}});
    if(hx) hx.addEventListener('input',function(){
      var v=hx.value.trim(),c=parseColor(v);
      if(c){cpRGBA=c;cpSync('hex');} else hx.classList.toggle('bad',v!=='');});
    if(rg) rg.addEventListener('input',function(){
      var v=rg.value.trim(),c=parseColor(v);
      if(c){cpRGBA=c;cpSync('rgb');} else rg.classList.toggle('bad',v!=='');});
    if(al) al.addEventListener('input',function(){
      cpRGBA.a=(+al.value)/100;cpSync('alpha');});
    var ap=$('#cp-apply'); if(ap) ap.addEventListener('click',cpApply);
    var swc=$('#sw-custom');
    if(swc){
      swc.addEventListener('mousedown',function(e){
        if(activeTextEditable()) e.preventDefault();});
      swc.addEventListener('click',function(){openColorPop('text',swc);});
    }
    var swbgc=$('#swbg-custom');
    if(swbgc) swbgc.addEventListener('click',function(){
      openColorPop('fill',swbgc);});
    document.addEventListener('mousedown',function(e){
      if(cpEl&&!cpEl.hidden&&!cpEl.contains(e.target)
         &&e.target!==swc&&e.target!==swbgc){
        cpEl.hidden=true;pvEnd(false);}   /* closed without applying */
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&cpEl&&!cpEl.hidden){e.stopPropagation();
        cpEl.hidden=true;pvEnd(false);}
    },true);
  })();
  var fontSelEl=$('#fmt-font');
  if(fontSelEl){
    /* the picker is built from FONTS so the list, the canvas and the
       .pptx writer can never drift apart */
    fontSelEl.innerHTML=FONTS.map(function(f){
      return '<option value="'+f.id+'">'+esc(f.label)+'</option>';
    }).join('')+'<option value="__custom">Other…</option>';
    fontSelEl.addEventListener('change',function(){
      var v=this.value;
      if(v==='__custom'){
        var typed=prompt('Font family — exactly as it is named on this '
          +'computer (e.g. "Univers", "Source Sans Pro").\n\nIt has to be '
          +'installed to show here, and installed on any machine that '
          +'opens the PowerPoint. PDF export always embeds what you see.',
          '');
        typed=(typed||'').trim();
        if(!typed){renderControls();return;}
        fmtApply(function(a){a.font=typed;});
        return;
      }
      fmtApply(function(a){
        if(v==='sans') delete a.font; else a.font=v;
      });
    });
  }
  onFmt('#fmt-bold',function(a){a.b=a.b?0:1;});
  onFmt('#fmt-ital',function(a){a.i=a.i?0:1;});
  onFmt('#fmt-under',function(a){a.u=a.u?0:1;});
  onFmt('#fmt-strike',function(a){a.strike=a.strike?0:1;});
  var opRangeEl=$('#fmt-op');
  /* A range fires one `input` per step, so one drag across the opacity
     slider used to push ~100 undo entries and flush every real edit out
     of the 50-slot history. fmtApply's `quiet` flag exists for exactly
     this and the crop steppers already use it; this control never did.
     Live-preview on input, commit ONE entry on change. */
  if(opRangeEl){
    opRangeEl.addEventListener('input',function(){
      var pct=Math.max(0,Math.min(100,+this.value));
      fmtApply(function(a){
        if(pct>=100) delete a.op; else a.op=pct/100;},true);
    });
    opRangeEl.addEventListener('change',function(){
      fmtApply(function(){});   /* end of gesture: one undo entry */
    });
  }
  var szInEl=$('#fmt-size');
  if(szInEl) szInEl.addEventListener('change',function(){
    var pt=+this.value;
    if(!(pt>0)) return;
    pt=Math.max(6,Math.min(240,pt));
    fmtApply(function(a){a.size=pt/5.4;});
  });
  onFmt('#fmt-rotl',function(a){
    a.rot=(((a.rot||0)-15)%360+360)%360;
    if(!a.rot) delete a.rot;});
  onFmt('#fmt-rotr',function(a){
    a.rot=(((a.rot||0)+15)%360+360)%360;
    if(!a.rot) delete a.rot;});
  /* ---- CLONES ----------------------------------------------------------
     A clone is an INDEPENDENT copy: it shares nothing with its source,
     and editing either one never touches the other. Copies that DO stay
     linked to a definition are a different feature (TASKS T13), and
     keeping the two verbs apart from the first line of this section is
     the point of saying so here.

     Two gestures, one function:
       Ctrl+D / the Copy button -- clone the whole selection with a small
         offset, so the copies are visible instead of hidden exactly
         under their originals;
       Alt-drag -- clone in place and drag the COPIES, leaving the
         originals where they were. Every vector editor does this, and it
         is how a row of five of something actually gets laid out.

     Groups survive: clone two members of a group of five and you get a
     pair that still moves as one, in a NEW group -- not two loose items,
     and not all five. Duplicating used to act on selAnnot alone, so
     "duplicate" on a five-item selection gave you one item.  */
  var CLONE_OFF=3;      /* enough to see; small enough to still read as
                           "this, and its copy" */
  /* a duplicate that lands off the bottom-right corner is a duplicate you
     have to go looking for -- but an item ALREADY out there stays where
     its owner put it, strays being a supported state (an-offpage) */
  function cloneShift(v,d){
    var n=(v||0)+d;
    return (d>0&&n>96&&(v||0)<=96)?96:n;
  }
  /* Deep-copy a batch and re-issue every identity that means "these
     objects belong together". A two-pass rewrite matters: the caption
     may precede its figure in the array, while its new capOf cannot be
     known until every copied figure has a fresh cap.

     `sourceMeta` is deliberately a snapshot for paste. Looking it up by
     clipFrom later would be wrong after the source slide was moved,
     deleted or its group renamed while the clipboard was still live. */
  function independentCopies(srcs,s,sourceMeta){
    var copies=srcs.map(function(a){return deep(a);});
    var gnext=nextGrp(s),gmap={},capMap={},instMap={};
    copies.forEach(function(cp){
      if(cp.grp!=null){
        var gk='g'+cp.grp;
        if(gmap[gk]==null) gmap[gk]=gnext++;
      }
      if(cp.cap){
        var oldCap=cp.cap;
        cp.cap=figId();
        /* Existing corrupt decks may already have duplicate cap ids.
           The last figure owns the caption today (capOfFig), so keep
           that deterministic rule while making every copy independent. */
        capMap['f'+oldCap]=cp.cap;
      }
      if(cp.cinst){
        var ik='i'+(cp.cmp||'')+'|'+cp.cinst;
        if(instMap[ik]==null) instMap[ik]=nextCinst();
      }
    });
    copies.forEach(function(cp){
      if(cp.grp!=null) cp.grp=gmap['g'+cp.grp];
      if(cp.capOf){
        var freshCap=capMap['f'+cp.capOf];
        if(freshCap) cp.capOf=freshCap;
        else delete cp.capOf; /* its figure was not copied */
      }
      if(cp.cinst)
        cp.cinst=instMap['i'+(cp.cmp||'')+'|'+cp.cinst];
    });
    Object.keys(gmap).forEach(function(gk){
      var old=gk.slice(1),m=sourceMeta&&sourceMeta[old];
      if(!m) return;
      s.grpmeta=s.grpmeta||{};
      var m2=deep(m);
      if(m2.name) m2.name+=' copy';
      s.grpmeta[gmap[gk]]=m2;
    });
    return copies;
  }
  /* ---- A COPY WITH NO SOURCE (T93) ----------------------------------
     "Would be good if there was a 'duplicate without context' option."
     (2026-08-29, user.)

     A plain duplicate of a figure frame is a SECOND VIEW OF THE SAME
     CARD: same notebook cell, same facet of it, same pinned commit.
     That is the right default and exactly the wrong thing when what you
     are about to do is aim the copy somewhere else -- you want the size,
     the crop, the border, the caption tie and the animation, and then
     you have to unpick three separate bindings before the copy can point
     anywhere. The emptied frame is not a broken state: a cell with no
     ref draws the "Click to add from notebook" button, which is the
     affordance this whole feature is asking for.

     ONE LIST, READ TWICE. hasContext decides whether the door is even
     offered; stripContext takes the context away. They must name the
     same fields, so they live in the same breath.

     WHAT IS DELIBERATELY NOT HERE. A component instance (cmp/ci/cinst)
     keeps its link -- its content lives in the definition, so cutting it
     leaves an empty husk rather than a free object. cap/capOf are ties
     BETWEEN the copies and independentCopies has already re-keyed them.
     oid is re-minted by ensureOids the moment it collides. */
  function hasContext(a){
    if(!a) return false;
    if(a.k==='cell') return !!(a.ref||a.part||a.lockver);
    if(a.k==='image') return !!a.fkey;
    if(a.k==='flip') return !!(a.frames&&a.frames.length);
    return false;
  }
  function stripContext(cp){
    if(!cp) return cp;
    /* the notebook card, the facet of it this frame shows, and the
       commit it was pinned to */
    delete cp.ref;delete cp.part;delete cp.lockver;
    /* a picture's link back to the file it came from -- what Refresh
       follows, and the only thing fkey is for */
    delete cp.fkey;delete cp.fname;
    /* a flip book is a LIST of refs; emptied, it is exactly the newborn
       flip book the Insert button makes */
    if(cp.k==='flip'){cp.frames=[];cp.at=0;}
    return cp;
  }
  function cloneAnnots(idxs,dx,dy,bare){
    var s=pres.slides[cur];
    if(!s||!s.annots) return [];
    var live=idxs.filter(function(i){
      return typeof i==='number'&&s.annots[i];});
    if(!live.length) return [];
    var first=s.annots.length,made=[];
    var srcs=live.map(function(i){return s.annots[i];});
    var copies=independentCopies(srcs,s,s.grpmeta);
    if(bare) copies.forEach(stripContext);
    copies.forEach(function(cp){
      /* its own build step, rather than sharing the source's */
      if(cp.anim) cp.anim={type:cp.anim.type,order:nextAnimOrder(s)};
      if(cp.k==='arrow'){
        cp.x1+=dx;cp.y1+=dy;cp.x2+=dx;cp.y2+=dy;
        if(Array.isArray(cp.mid)) cp.mid=cp.mid.map(function(m){
          return [m[0]+dx,m[1]+dy];});
      } else {
        cp.x=cloneShift(cp.x,dx);cp.y=cloneShift(cp.y,dy);
      }
      s.annots.push(cp);made.push(s.annots.length-1);
    });
    /* an attached arrow endpoint holds an INDEX. Clone the arrow AND its
       target together and the copy should point at the copy; clone the
       arrow alone and the original target is still on this slide, so its
       index is still good and the tie is left alone. */
    var remap={};
    live.forEach(function(src,n){remap[src]=first+n;});
    made.forEach(function(j){
      var cp=s.annots[j];
      if(!cp||cp.k!=='arrow') return;
      if(cp.c1&&remap[cp.c1.i]!=null) cp.c1={i:remap[cp.c1.i]};
      if(cp.c2&&remap[cp.c2.i]!=null) cp.c2={i:remap[cp.c2.i]};
    });
    return made;
  }
  function duplicateSel(bare){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    /* a fully locked item cannot even be clicked, so an unlocked twin
       dropped on top of it would be a puzzle rather than a duplicate. A
       PINNED one clones happily: the copy is a free item. */
    var idxs=selIdxs().filter(function(i){
      var a=s.annots[i];return a&&!lockedAll(a);});
    if(!idxs.length) return;
    var made=cloneAnnots(idxs,CLONE_OFF,CLONE_OFF,bare);
    if(!made.length) return;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectMany(l,made);}
    /* SAY SO. A stripped picture looks identical to the original at the
       moment it lands -- only its Refresh link is gone -- so the one
       difference that matters is the one thing nobody can see. The
       stripped FRAME does go visibly empty, and the toast is what says
       that was on purpose rather than a figure that failed to load. */
    if(bare) toast(made.length===1
      ?'Copied without its source — it tracks nothing now'
      :made.length+' copied without their sources — they track '
        +'nothing now');
  }
  /* ---- copy / cut / paste ------------------------------------------
     Ctrl+D duplicates in place, which is not the same thing: it cannot
     carry an item to another poster, and it cannot bring anything IN. The
     internal buffer keeps whole annotations (so a copied figure frame is
     still a live figure frame, not a picture of one), and a system-
     clipboard image pastes straight onto the page — which is how logos
     and screenshots actually arrive. */
  var clipBuf=[],clipGrpMeta={},pendingPaste=null;
  function selectedIdxs(){
    var s=pres.slides[cur]; if(!s||!s.annots) return [];
    var out=selSet.filter(function(i){
      return typeof i==='number'&&s.annots[i];});
    if(!out.length&&typeof selAnnot==='number'&&s.annots[selAnnot])
      out=[selAnnot];
    return out;
  }
  /* which slide the clipboard came from: pasting onto a DIFFERENT slide
     should land in the same place, which is the whole point of copying
     something across (2026-08-20, user: "copying and pasting something
     from one slide to another should be pasted into the same location on
     the other slide that it was copied from"). Pasting onto the SAME
     slide still offsets, or the copy hides exactly under its original. */
  var clipFrom=-1;
  /* which annots the buffer came from, index-aligned with clipBuf: an
     attached arrow endpoint stores an INDEX, so a paste has to be able
     to say "that one is in this set too" (see retie in pasteBuf) */
  var clipIdx=[];
  /* the pointer's last position over the stage, in CLIENT coordinates
     (recorded by the ruler-cursor handler, which costs nothing to do
     there). Null once it leaves, or before it has ever been there. */
  var lastCanvasXY=null;
  /* the pointer as a percentage of the page. Null when it is off the
     page, which is the case "Paste here" has to have an answer for. */
  function pointerPct(){
    var slideEl=stage&&stage.querySelector('.slide');
    if(!slideEl||!lastCanvasXY) return null;
    var r=slideEl.getBoundingClientRect();
    if(!r.width||!r.height) return null;
    var x=(lastCanvasXY.x-r.left)/r.width*100;
    var y=(lastCanvasXY.y-r.top)/r.height*100;
    if(x<0||x>100||y<0||y>100) return null;
    return {x:x,y:y};
  }
  /* the clipboard set's own bounding box, from its STORED geometry --
     the items are not on the page, so there is nothing to measure with
     annotRectPct. A text box that sizes itself has no w/h and counts as
     its top-left corner, which is the point being placed anyway. */
  function clipBox(buf){
    var l=1e9,t=1e9,r=-1e9,b=-1e9;
    buf.forEach(function(a){
      var x1,y1,x2,y2;
      if(a.k==='arrow'){
        x1=Math.min(a.x1,a.x2);x2=Math.max(a.x1,a.x2);
        y1=Math.min(a.y1,a.y2);y2=Math.max(a.y1,a.y2);
      } else {
        x1=a.x||0;y1=a.y||0;x2=x1+(a.w||0);y2=y1+(a.h||0);
      }
      if(x1<l) l=x1;
      if(y1<t) t=y1;
      if(x2>r) r=x2;
      if(y2>b) b=y2;
    });
    return (l>r||t>b)?null:{l:l,t:t,r:r,b:b};
  }
  function copySel(){
    var s=pres.slides[cur];
    var idxs=selectedIdxs(); if(!s||!idxs.length) return 0;
    clipFrom=cur;              /* where it came from - see pasteBuf */
    clipIdx=idxs.slice();
    clipBuf=idxs.map(function(i){
      return deep(s.annots[i]);});
    clipGrpMeta={};
    clipBuf.forEach(function(a){
      if(a.grp!=null&&s.grpmeta&&s.grpmeta[a.grp])
        clipGrpMeta[a.grp]=deep(s.grpmeta[a.grp]);
    });
    /* stamp the SYSTEM clipboard so this copy outranks whatever image was
       on it: the paste listener checked the OS clipboard first, so one
       stale screenshot shadowed every internal copy forever — Ctrl+C said
       "1 item copied", Ctrl+V pasted the screenshot (2026-08-20 diagnosis,
       reproduced live). Best-effort: inside the Ctrl+C gesture Chromium
       allows it; anywhere it fails the old ordering simply remains. */
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText)
        navigator.clipboard.writeText('junoview/items').catch(function(){});
    }catch(err){}
    return clipBuf.length;
  }
  function cutSel(){
    var n=copySel();
    if(n) deleteSel();
    return n;
  }
  /* WHERE A PASTE LANDS. Three answers, because three different
     questions get asked of the same buffer (2026-08-24, TASKS T1):

       'auto'   Ctrl+V, and the rule that was already here. Onto the SAME
                slide it nudges, or the copy hides exactly under its
                original; onto ANOTHER slide it lands in the same place,
                which is the whole point of copying across (2026-08-20).
       'place'  Ctrl+Shift+V. The source's coordinates exactly, same
                slide included -- how a caption or a logo ends up in the
                identical spot on twenty slides. It never cascades, so
                pasting it into ten slides really does give ten items in
                ten identical positions.
       'here'   Ctrl+Alt+V, or the right-click menu, which is the only
                door that knows where you clicked. A multi-item copy
                keeps its own internal arrangement -- the SET moves, not
                each item on its own -- and falls back to the middle of
                the page when the pointer is not over it.

     `at` is a point in page percentages; 'here' from the menu passes the
     click, the shortcut passes nothing and the live pointer is used. */
  function pasteBuf(how,at){
    var s=pres.slides[cur];
    if(!s||!clipBuf.length) return 0;
    s.annots=s.annots||[];
    var first=s.annots.length;
    var dx=0,dy=0;
    if(how==='here'){
      var box=clipBox(clipBuf),pt=at||pointerPct()||{x:50,y:50};
      if(box){
        dx=pt.x-(box.l+box.r)/2;dy=pt.y-(box.t+box.b)/2;
        /* keep the set ON the page: a paste you cannot see is a paste
           you will not find */
        if(box.l+dx<0) dx=-box.l;
        else if(box.r+dx>100) dx=100-box.r;
        if(box.t+dy<0) dy=-box.t;
        else if(box.b+dy>100) dy=100-box.b;
      }
    } else if(how!=='place'){
      dx=dy=(clipFrom===cur)?3:0;
    }
    /* an attached arrow endpoint (`c1`/`c2` = {i:index}) points into the
       annots of the slide it was copied from. Re-point it at the pasted
       COPY where that copy is in this same set; leave it alone when the
       original is still on this slide; drop it otherwise -- an index
       carried across slides silently ties the arrow to whatever happens
       to sit at that number over there. */
    var remap={};
    clipIdx.forEach(function(src,n){remap[src]=first+n;});
    function retie(c){
      if(!c||typeof c.i!=='number') return null;
      if(remap[c.i]!=null) return {i:remap[c.i]};
      return (clipFrom===cur)?c:null;
    }
    var copies=independentCopies(clipBuf,s,clipGrpMeta);
    copies.forEach(function(cp){
      if(cp.anim) cp.anim={type:cp.anim.type,order:nextAnimOrder(s)};
      if(cp.k==='arrow'){
        cp.x1+=dx;cp.y1+=dy;cp.x2+=dx;cp.y2+=dy;
        /* the bend corners travel with the line they belong to. They did
           not, so a pasted elbow arrow came out with its middle left
           behind at the original's coordinates (found while giving paste
           three modes; nudgeSel already moved them) */
        if(Array.isArray(cp.mid)) cp.mid=cp.mid.map(function(m){
          return [m[0]+dx,m[1]+dy];});
        var t1=retie(cp.c1),t2=retie(cp.c2);
        if(t1) cp.c1=t1; else delete cp.c1;
        if(t2) cp.c2=t2; else delete cp.c2;
      }
      else {cp.x=(cp.x||0)+dx;cp.y=(cp.y||0)+dy;}
      s.annots.push(cp);
    });
    /* paste again and the next copy lands clear of this one, rather than
       stacking every paste on the same 3% offset. Ctrl+V ONLY: a "paste
       in place" that crept 3% each time would not be paste in place, and
       "paste here" is told where to go every single time. */
    if(how!=='place'&&how!=='here') clipBuf=clipBuf.map(function(cp){
      var n=deep(cp);
      if(n.k==='arrow'){n.x1+=3;n.y1+=3;n.x2+=3;n.y2+=3;
        if(Array.isArray(n.mid)) n.mid=n.mid.map(function(m){
          return [m[0]+3,m[1]+3];});}
      else {n.x=(n.x||0)+3;n.y=(n.y||0)+3;}
      return n;
    });
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){
      renderAnnots(l,s);
      selectAnnot(l,first);
      for(var i=first+1;i<s.annots.length;i++) selectAnnot(l,i,true);
    }
    return clipBuf.length;
  }
  /* an image on the system clipboard becomes an image item */
  /* KEEP THE PICTURE OUT OF THE QUOTA. An image annot carries its whole
     payload as a base64 data URI inside `pres`, and markDirty stringifies
     `pres` into localStorage on EVERY edit — so two full-resolution
     screenshots on a poster exhausted the ~5MB budget, after which every
     later edit was discarded while the UI went on saying "saved". This
     codebase already made exactly that argument for embedded card
     snapshots and moved them to IndexedDB (see the note by EMBED); the
     `image` kind was simply left behind.
     Moving image payloads out of `pres` is the real fix and is still to
     do. This caps what can arrive in the meantime: nothing on a slide or
     an A0 poster needs more than ~2400px on its long edge, and the
     re-encode is typically a 5-10x saving with nothing visible lost.
     PNG stays PNG so a logo keeps its transparency, and a re-encode that
     comes out bigger is thrown away (2026-08-22). */
  /* ---- THE ORIGINAL, AND THE COPY THAT GOES ON THE PAGE ---------------
     (TASKS T21.) Crop was ALREADY non-destructive — a.crop is a view
     transform in inset percentages over the whole picture, and cropCss
     renders it — so nothing about cropping needed changing. What was
     destructive was the SHRINK: a pasted screenshot was re-encoded down
     to 2400px and the original bytes were thrown away on the spot, so a
     crop into one corner exported at the resolution of the shrunk copy
     and there was no way back.

     The note left on IMG_MAX_EDGE said why it had to be that way, and
     said what the real fix was: image payloads live inside `pres`, and
     markDirty stringifies `pres` into localStorage on EVERY edit, so two
     full-resolution screenshots exhausted the ~5MB budget and every
     later edit was silently discarded while the UI went on saying
     "saved". The same argument had already moved embedded card
     snapshots to IndexedDB; the `image` kind was simply left behind.

     So: the ORIGINAL goes to IndexedDB, under an opaque key on the
     annotation (`a.okey`), and `a.src` keeps a display-sized copy. The
     draft that gets stringified sixty times an hour therefore carries
     the small one, which is the quota fix; the original is one async
     read away when an export wants it, which is the resolution fix.

     A deck that has never seen this is unaffected: no okey, no lookup,
     and a.src is exactly what it always was. */
  var IMG_MAX_EDGE=2400;
  /* what actually goes on the page. A 6000px PNG drawn at 30% of a
     slide costs real time on every repaint for detail no screen can
     show; the original is kept for the export, not for the canvas. */
  var IMG_VIEW_EDGE=1600;
  function okeyNew(){
    return 'img:'+Date.now().toString(36)
      +Math.random().toString(36).slice(2,8);
  }
  /* keep the full-resolution bytes out of `pres`, and remember where.
     Best-effort by design: with no IndexedDB the picture still works,
     it just has no original to fall back on — which is exactly what
     happened to every image before this existed. */
  function keepOriginal(a,dataUrl){
    if(!a||!dataUrl) return;
    var k=okeyNew();
    idbPut(k,dataUrl).then(function(){
      a.okey=k;
      markDirty(true);
    }).catch(function(){});
  }
  /* the original if there is one, else what is on the page. Async
     because IndexedDB is; every caller is an export, which is already
     asynchronous for MathJax. */
  function originalOf(a){
    if(!a) return Promise.resolve(null);
    if(!a.okey) return Promise.resolve(a.src||null);
    return idbGet(a.okey).then(function(v){
      return v||a.src||null;
    }).catch(function(){return a.src||null;});
  }
  function shrinkImage(img,dataUrl,edge){
    try{
      var lim=edge||IMG_MAX_EDGE;
      var w=img&&img.naturalWidth||0,h=img&&img.naturalHeight||0;
      if(!w||!h) return dataUrl;
      var big=Math.max(w,h);
      if(big<=lim) return dataUrl;
      var k=lim/big;
      var cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(w*k));
      cv.height=Math.max(1,Math.round(h*k));
      var cx=cv.getContext('2d');
      if(!cx) return dataUrl;
      cx.drawImage(img,0,0,cv.width,cv.height);
      var isPng=/^data:image\/png/i.test(String(dataUrl||''));
      var out=isPng?cv.toDataURL('image/png')
        :cv.toDataURL('image/jpeg',0.9);
      return (out&&out.length<String(dataUrl||'').length)?out:dataUrl;
    }catch(e){return dataUrl;}
  }
  function pasteImageFile(file){
    if(!file) return false;
    var fr=new FileReader();
    fr.onload=function(){
      var s=pres.slides[cur]; if(!s) return;
      var img=new Image();
      img.onload=function(){
        /* land it at a sane size: 30% of the page width, keeping the
           image's own aspect so it is not squashed on arrival */
        var pg=pageOf();
        var w=30,h=w*(img.naturalHeight/img.naturalWidth)
          *(pg.mm[0]/pg.mm[1]);
        if(!isFinite(h)||h<=0) h=24;
        if(h>80){h=80;w=h*(img.naturalWidth/img.naturalHeight)
          *(pg.mm[1]/pg.mm[0]);}
        s.annots=s.annots||[];
        /* the DISPLAY copy goes on the page; the full-resolution bytes
           go to IndexedDB so a crop can be exported at the resolution
           it was actually cropped from (T21) */
        var payload=shrinkImage(img,fr.result,IMG_VIEW_EDGE);
        /* A FRAME ASKED FOR THIS ONE (T61). The object-frame menu's
           clipboard row lands here rather than in placeImage, so the
           waiting frame has to be honoured in both places -- and
           takeObjInto is read once and cleared either way, so an answer
           nobody consumed can never aim the NEXT picture at a frame the
           user has long forgotten. */
        var into=takeObjInto();
        if(into){
          into.k='image';into.src=payload;delete into.ref;
          if(payload!==fr.result) keepOriginal(into,fr.result);
          markDirty();setTool('select');
          var li=stage.querySelector('.annot-layer');
          if(li){renderAnnots(li,s);
            selectAnnot(li,(s.annots||[]).indexOf(into));}
          toast('Pasted into the frame');
          return;
        }
        var na={k:'image',x:50-w/2,y:50-h/2,w:w,h:h,src:payload};
        s.annots.push(na);
        /* the ORIGINAL, kept aside. Only worth keeping when it is
           actually bigger than what went on the page — otherwise the
           display copy IS the original and a second copy of it would be
           pure waste. */
        if(payload!==fr.result) keepOriginal(na,fr.result);
        markDirty();
        var l=stage.querySelector('.annot-layer');
        if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
        toast(payload===fr.result?'Image pasted'
          :'Image pasted — shown at '+IMG_VIEW_EDGE+'px, and the '
            +'full-size original is kept for exports');
      };
      img.onerror=function(){toast('That image could not be read');};
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
    return true;
  }
  /* CODE PASTED ONTO THE CANVAS, with no box open to receive it -- the
     other half of T92. Same detector, same look, and it lands the way
     pasteImageFile lands a screenshot: push, markDirty, re-render,
     select, say so. Centred on its own computed width and placed high,
     because code is usually the thing being talked about rather than
     the thing in the corner. */
  /* the ordinary half of pasting words (T128): a text box, in the
     deck's default body face, centred the way the code box is. Prose
     used to fall off the END of the paste handler and do nothing at
     all, which reads as a broken Ctrl+V to anyone arriving from any
     other slide tool. */
  function pasteTextBox(txt){
    var s=pres.slides[cur];if(!s) return false;
    var src=String(txt).replace(/\r/g,'').trim();
    if(!src) return false;
    s.annots=s.annots||[];
    var na={k:'text',x:8,y:14,text:src,
      w:Math.max(24,Math.min(60,Math.round(src.length/3)))};
    na.x=Math.max(4,50-na.w/2);
    s.annots.push(na);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
    toast('Text pasted \u2014 Ctrl+Z undoes it');
    return true;
  }
  /* Ctrl+Shift+V with NOTHING in the internal buffer means "paste the
     clipboard as plain text" (T128) -- the same one-key out the in-box
     paste has had, for the canvas, where a wrong code detection
     previously left Ctrl+Z as the only exit. Armed for one paste event
     and self-clearing, the pendingPaste pattern. */
  var plainPasteT=null;
  function armPlainPaste(){
    if(plainPasteT) clearTimeout(plainPasteT);
    plainPasteT=setTimeout(function(){plainPasteT=null;},300);
  }
  function pasteCodeBox(txt){
    var s=pres.slides[cur];if(!s) return false;
    var f=codeFence(txt);
    var src=(f?f.src:txt).replace(/\r/g,'').replace(/\s+$/,'');
    if(!src) return false;
    s.annots=s.annots||[];
    var na={k:'text',x:8,y:14};
    codeBoxify(na,src);
    na.x=Math.max(4,50-na.w/2);
    s.annots.push(na);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
    toast('Code pasted \u2014 Ctrl+Z undoes it, or Ctrl+Shift+V '
      +'pastes it as plain text');
    return true;
  }
  /* Ctrl+Shift+V / Ctrl+Alt+V are preventDefaulted on keydown, but not
     every engine agrees that this stops the paste event — and one that
     still fires would run the plain paste on top of the placed one. The
     explicit modes raise this for a beat; the timer clears it in case
     the event never comes at all. */
  var pasteHandled=null;
  function tookPaste(){
    if(pasteHandled) clearTimeout(pasteHandled);
    pasteHandled=setTimeout(function(){pasteHandled=null;},300);
  }
  document.addEventListener('paste',function(e){
    /* the Ctrl+V keydown armed a fallback in case this event never comes
       (some engines fire no paste on a non-editable focus) — it did, so
       disarm it before anything else or the item would paste twice */
    if(pendingPaste){clearTimeout(pendingPaste);pendingPaste=null;}
    if(pasteHandled){
      clearTimeout(pasteHandled);pasteHandled=null;
      e.preventDefault();return;
    }
    if(deckEl.hidden||mode!=='edit') return;
    var tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||e.target.isContentEditable) return;
    /* a fresh internal copy left its marker on the OS clipboard — prefer
       the internal buffer over a stale clipboard image (see copySel) */
    var mk='';
    try{mk=e.clipboardData?e.clipboardData.getData('text/plain')||'':'';}
    catch(err){}
    if(clipBuf.length&&mk.indexOf('junoview/items')===0){
      e.preventDefault();pasteBuf();return;
    }
    var items=(e.clipboardData||{}).items||[];
    for(var i=0;i<items.length;i++){
      if(items[i].type&&items[i].type.indexOf('image/')===0){
        e.preventDefault();
        pasteImageFile(items[i].getAsFile());
        return;
      }
    }
    if(clipBuf.length){e.preventDefault();pasteBuf();return;}
    /* NOTHING USED TO HAPPEN HERE. Ctrl+V with plain text on the
       clipboard and no box open fell off the end of this handler and did
       nothing at all, which is why code can have the branch without
       taking anything away from anyone (T92).
       Deliberately AFTER the internal buffer, not before: the note above
       argues a fresh internal copy must beat a stale OS clipboard, and
       that does not stop being true because the stale thing is text
       rather than an image. So this fires only when there is nothing of
       ours to paste. `mk` is the plain text already read off the event
       for the marker test -- no second read, and no navigator.clipboard
       permission prompt. */
    if(plainPasteT){
      clearTimeout(plainPasteT);plainPasteT=null;
      if(mk){e.preventDefault();pasteTextBox(mk);}
      return;
    }
    if(mk&&looksLikeCode(mk)){e.preventDefault();pasteCodeBox(mk);}
    /* and PROSE lands as an ordinary text box. AFTER the code branch,
       so detection still gets first look; before this line, plain text
       fell off the end and nothing happened at all (T128). */
    else if(mk&&mk.trim()){e.preventDefault();pasteTextBox(mk);}
  });

  /* nudge the selection with the arrow keys (Shift = bigger step) */
  /* MOVE ONE ITEM BY A DELTA. A line has no x/y — it is two endpoints
     and any corners dragged into it — so "move" is a different sentence
     for it, and every caller that has ever written the box version by
     hand has had to remember that. One function, so the next one does
     not (2026-08-25, factored out for T8's layout matching). */
  function shiftAnnot(a,dx,dy){
    if(!a||(!dx&&!dy)) return;
    /* A TIED CAPTION TRAVELS WITH ITS FIGURE. Here, in the one translate
       helper, so every mover gets it for nothing: nudge, layout match,
       tidy-up, arrange. `_capMoving` stops the two of them ping-ponging
       when a caller happens to move both (T17). */
    if(a.cap&&!_capMoving){
      var s2=pres.slides[cur];
      var ci=capOfFig(s2,a);
      if(ci>=0){
        _capMoving=1;
        try{shiftAnnot(s2.annots[ci],dx,dy);}finally{_capMoving=0;}
      }
    }
    if(a.k==='arrow'){
      a.x1+=dx;a.y1+=dy;a.x2+=dx;a.y2+=dy;
      if(Array.isArray(a.mid)) a.mid=a.mid.map(function(m){
        return [m[0]+dx,m[1]+dy];});
    } else if(a.anch){
      /* an anchored item is stored as a distance from its corner, so a
         page-space delta is not a delta on the stored number — moving
         right DECREASES "distance from the right edge". Going out to
         page coordinates and back is the only version of this that
         cannot get a sign wrong (T14). */
      var ap=anchorPos(a,a.w,a.h);
      anchorSet(a,ap.x+dx,ap.y+dy,a.w,a.h);
    } else {a.x=(a.x||0)+dx;a.y=(a.y||0)+dy;}
  }
  var _capMoving=0;
  /* A CAPTION WHOSE FIGURE IS ALSO IN THE SET must not be moved twice —
     once as a member, and again by its figure's tie. startMove already
     guards this by skipping captions already in `movers`; anything else
     that moves a SET has to do the same, and doing it in one named
     place is what stops the next mover getting it wrong (2026-08-25,
     found in the browser: a nudge moved the caption 53px for a 26px
     figure). */
  function dropTiedCaptions(s,idxs){
    if(!s||!s.annots) return idxs;
    var figs={};
    idxs.forEach(function(i){
      var a=s.annots[i];
      if(a&&a.cap) figs[a.cap]=1;});
    return idxs.filter(function(i){
      var a=s.annots[i];
      return !(a&&a.capOf&&figs[a.capOf]);});
  }
  function nudgeSel(dx,dy){
    var s=pres.slides[cur]; if(!s) return;
    if(selAnnot==='t'||selAnnot==='s'){
      var tp=titleProps(s,selAnnot);tp.x+=dx;tp.y+=dy;
    } else {
      var idxs=dropTiedCaptions(s,selIdxs());
      if(!idxs.length||!s.annots) return;
      idxs.forEach(function(i){
        var a=s.annots[i]; if(!a||pinned(a)) return;   /* no nudge */
        shiftAnnot(a,dx,dy);
      });
    }
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
  }
  var dupBtn=$('#fmt-dup');
  /* WRAPPED, not passed straight through. duplicateSel now takes a
     `bare` flag and a listener is handed the MouseEvent as its first
     argument -- which is truthy, so the ribbon's Duplicate button would
     silently have become the stripped duplicate (T93). */
  if(dupBtn) dupBtn.addEventListener('click',function(){duplicateSel();});
  var grpBtn=$('#fmt-group');
  if(grpBtn) grpBtn.addEventListener('click',groupSel);
  var ungBtn=$('#fmt-ungroup');
  if(ungBtn) ungBtn.addEventListener('click',ungroupSel);
