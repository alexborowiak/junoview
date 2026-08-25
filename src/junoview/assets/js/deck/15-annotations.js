/* 15-annotations.js — what can sit on a slide: text, shapes, frames, flip books, styles and tokens.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- SPOTLIGHT: blow one item up, mid-talk ---------------------------
     "In power point when you present it is static. But sometimes when
     people are presenting things need to be changed. It would be cool if
     clicking on text or a figure made it full screen in the presentation"
     (2026-08-20, user).
     The hard part is not the zoom, it is that a click on the slide
     already ADVANCES the build - so a plain click cannot mean two things.
     The rule: a normal click still advances, and ALT+click (or a click on
     the little magnifier that appears when you hover an item) spotlights.
     The keyboard has it too: Z zooms whatever the pointer is over, which
     is the version you can actually use from a lectern.
     It is a FLIP: the item is cloned, the clone is placed exactly over
     the original, and then it is transformed to the centre - so it grows
     out of where it was rather than appearing from nowhere, and the
     original never moves. */
  var spotEl=null,spotHover=null;
  document.addEventListener('mousemove',function(e){
    if(mode!=='view'||deckEl.hidden) return;
    spotHover=spotTarget(e);
  });
  function closeSpot(){
    if(!spotEl) return;
    var el=spotEl;spotEl=null;
    el.classList.remove('on');
    setTimeout(function(){if(el.parentNode) el.remove();},220);
    document.body.classList.remove('jv-spot');
  }
  function spotlight(item){
    if(!item||mode!=='view') return;
    closeSpot();
    var r=item.getBoundingClientRect();
    if(!r.width||!r.height) return;
    var wrap=document.createElement('div');
    wrap.className='jv-spot-wrap';
    var inner=document.createElement('div');
    inner.className='jv-spot-inner';
    /* start EXACTLY over the original, in viewport coordinates */
    inner.style.left=r.left+'px';
    inner.style.top=r.top+'px';
    inner.style.width=r.width+'px';
    inner.style.height=r.height+'px';
    var clone=item.cloneNode(true);
    /* the clone is a picture, not a control: strip the editing chrome and
       anything that could take a click */
    /* the old drag handle is deliberately NOT in this list: nothing has
       built one since items began dragging from their own body, and a
       test pins that it never returns */
    ['.an-resize','.an-rotate','.an-buildno','.an-endpt',
     '.an-cellbtn','.cellparts','.an-marquee']
      .forEach(function(sel){
        Array.prototype.slice.call(clone.querySelectorAll(sel))
          .forEach(function(n){n.remove();});
      });
    clone.classList.remove('sel','grpsel','an-prebuild','an-ingrp');
    clone.style.position='absolute';
    clone.style.left='0';clone.style.top='0';
    clone.style.width='100%';clone.style.height='100%';
    clone.style.margin='0';
    inner.appendChild(clone);
    wrap.appendChild(inner);
    /* the way out has to be visible or it does not exist */
    var x=document.createElement('button');
    x.className='dbtn jv-spot-x';
    x.innerHTML=bic('exit')+' Close (Esc)';
    x.addEventListener('click',function(e){
      e.stopPropagation();closeSpot();});
    wrap.appendChild(x);
    wrap.addEventListener('click',function(e){
      e.stopPropagation();closeSpot();});
    document.body.appendChild(wrap);
    document.body.classList.add('jv-spot');
    spotEl=wrap;
    /* now FLIP it to the middle, as big as it can be without distorting */
    var pad=0.86;
    var k=Math.min(innerWidth*pad/r.width,innerHeight*pad/r.height);
    /* never SHRINK something that is already big; a spotlight that makes
       the figure smaller is a bug wearing a feature's clothes */
    k=Math.max(1,k);
    var cx=innerWidth/2-(r.left+r.width/2);
    var cy=innerHeight/2-(r.top+r.height/2);
    requestAnimationFrame(function(){
      inner.style.transform='translate('+cx+'px,'+cy+'px) scale('
        +k.toFixed(3)+')';
      wrap.classList.add('on');
    });
  }
  /* what, under this pointer, is worth blowing up? */
  function spotTarget(ev){
    var t=ev.target;
    if(!t||!t.closest) return null;
    return t.closest('.an-item,.card,.figframe');
  }
  function traceStep(st,k,g,multi,isHidden,spec,doRebuild){
    var box=document.createElement('div');
    box.className='vo-step'+(isHidden?' hidden':'');
    box.setAttribute('data-ns',st.ns);
    box.setAttribute('data-ck',(st.codeKinds&&st.codeKinds[0])||'code');
    box.setAttribute('data-ot',stepOt(st));
    var h=document.createElement('button');h.className='vo-step-h';
    h.title='Expand this cell';
    var n=document.createElement('span');n.className='vo-num';
    n.textContent=(k+1);
    if(multi){n.style.background=g.color+'26';n.style.color=g.color;}
    h.appendChild(n);
    var bd=document.createElement('span');
    var cks=st.codeKinds||(st.codeKind?[st.codeKind]:['code']);
    var codey=st.kind!=='figure'&&st.kind!=='diagnostic'
      &&!(cks.length===1&&cks[0]==='code');
    bd.className='chain-badge '+(codey?('ckmain-'+cks[0]):'');
    bd.textContent=codey?cks.slice(0,3).join(' · '):st.kind;
    h.appendChild(bd);
    var bt=document.createElement('span');bt.className='vo-step-t';
    bt.textContent=st.title;h.appendChild(bt);
    if(multiNb()) h.appendChild(nbChip('spane-nb',st.nb));
    /* eyeball: hide this step while presenting (persists per slide) */
    var eye=document.createElement('span');
    eye.className='vo-eye'+(isHidden?' off':'');
    eye.innerHTML=bic('eye');
    eye.title=isHidden
      ?'Hidden — click to show it again'
      :'Hide this step';
    eye.addEventListener('click',function(e){
      e.stopPropagation();spec.toggle(st.ns);doRebuild();});
    h.appendChild(eye);
    var fb=document.createElement('span');fb.className='vo-full';
    fb.innerHTML=bic('expand');fb.title='View this cell full screen';
    fb.addEventListener('click',function(e){
      e.stopPropagation();openVFull(st);});
    h.appendChild(fb);
    var ch=document.createElement('span');ch.className='vo-chev';
    ch.innerHTML='&#8250;';
    h.appendChild(ch);
    var body=document.createElement('div');body.className='vo-step-b';
    h.addEventListener('click',function(){
      var open=box.classList.toggle('open');
      if(open&&!body.firstChild){
        var c=cloneCode(st.ns);
        if(c) body.appendChild(c);
        else{
          var no=document.createElement('p');no.className='vstep-none';
          no.textContent='(no code on this card)';
          body.appendChild(no);
        }
        typeset(body);
      }
    });
    box.appendChild(h);box.appendChild(body);
    return box;
  }
  function setAllSteps(v,open){
    $$('.vo-step',v).forEach(function(box){
      if(open===box.classList.contains('open')) return;
      if(open) box.querySelector('.vo-step-h').click();
      else box.classList.remove('open');
    });
  }
  /* the code trail's OWN Code-types / Output-types filters (mirror the docs
     ones): each hides trace steps by their primary code kind / output kind */
  var traceCkHidden={},traceOtHidden={};
  function stepOt(st){
    var kd=st.kind;
    if(kd==='text'||kd==='metric') return 'print';
    if(kd==='dataset') return 'dataset';
    if(kd==='error') return 'error';
    return '';   /* figures / code / notes are not an output kind */
  }
  function applyTraceFilter(v){
    $$('.vo-step',v).forEach(function(st){
      var ck=st.getAttribute('data-ck')||'code',ot=st.getAttribute('data-ot');
      st.classList.toggle('vo-filtered',
        !!traceCkHidden[ck]||(!!ot&&!!traceOtHidden[ot]));
    });
  }
  function traceFilterDropdown(kind,present,state,v){
    var wrap=document.createElement('span');wrap.className='vo-fdrop';
    var btn=document.createElement('button');
    btn.className='vo-fbtn'+(Object.keys(state).length?' on':'');
    btn.textContent=(kind==='code'?'Code types':'Output types')+' ▾';
    var menu=document.createElement('div');menu.className='vo-fmenu';
    menu.hidden=true;
    present.forEach(function(t){
      var row=document.createElement('label');row.className='ckf-row';
      var cb=document.createElement('input');cb.type='checkbox';
      cb.checked=!state[t];
      cb.addEventListener('change',function(){
        if(cb.checked) delete state[t]; else state[t]=1;
        btn.classList.toggle('on',Object.keys(state).length>0);
        applyTraceFilter(v);});
      var sw=document.createElement('span');
      sw.className='ckf-dot '+(kind==='code'?'ckmain-'+t:'ot-sw-'+t);
      var tx=document.createElement('span');tx.textContent=t;
      row.appendChild(cb);row.appendChild(sw);row.appendChild(tx);
      menu.appendChild(row);});
    btn.addEventListener('click',function(e){
      e.stopPropagation();menu.hidden=!menu.hidden;});
    wrap.appendChild(btn);wrap.appendChild(menu);
    return wrap;
  }
  function traceNode(spec,rebuild){
    var groups=spec.groups||[];
    var hidden=hiddenSet({hidden:spec.list()});
    /* count DISTINCT hidden cells (a shared upstream cell can appear in
       several plot columns but is one step to the user) */
    var counted={},nHidden=0;
    groups.forEach(function(g){g.steps.forEach(function(st){
      if(hidden[st.ns]&&!counted[st.ns]){counted[st.ns]=1;nHidden++;}});});
    var showHidden=spec.showHiddenRef.v;
    /* the visible groups drive BOTH the plot strip and the columns, so
       they always line up even when a whole plot's trace is hidden */
    var visGroups=groups.map(function(g){
      return {g:g,vis:g.steps.filter(function(st){
        return showHidden||!hidden[st.ns];})};
    }).filter(function(x){return x.vis.length;});
    var multi=visGroups.length>1;
    if(traceSel>=visGroups.length) traceSel=0;
    var v=document.createElement('div');v.className='vtrace';
    var doRebuild=function(){rebuild(v);};
    var tl=document.createElement('div');tl.className='vo-title';
    /* the same lineage two ways: a readable list of Cells, or the
       expandable dependency Tree (the docs tree, reused) */
    var isTree=(traceView==='tree');
    [[bic('menu')+' Cells','cells',
      'The lineage as a readable list of steps'],
     [bic('tree')+' Tree','tree','The lineage as an expandable dependency '
      +'tree — columns by step']].forEach(function(bv){
      var b=document.createElement('button');
      b.className='vo-xall'+((traceView===bv[1])?' on':'');
      b.innerHTML=bv[0];b.title=bv[2];
      b.addEventListener('click',function(){
        if(traceView!==bv[1]){traceView=bv[1];doRebuild();}});
      tl.appendChild(b);
    });
    var xa=document.createElement('button');xa.className='vo-xall';
    xa.textContent='Expand all';
    xa.title='Open the code of every step';
    xa.addEventListener('click',function(){setAllSteps(v,true);});
    var ca=document.createElement('button');ca.className='vo-xall';
    ca.textContent='Collapse all';
    ca.title='Fold every step back down';
    ca.addEventListener('click',function(){setAllSteps(v,false);});
    if(!isTree){tl.appendChild(xa);tl.appendChild(ca);}
    if(!isTree&&nHidden){
      var sh=document.createElement('button');
      sh.className='vo-xall'+(showHidden?' on':'');
      sh.textContent=showHidden?'Hide hidden'
        :('Show hidden ('+nHidden+')');
      sh.title=showHidden
        ?'Hide the steps you marked hidden again'
        :'Reveal the steps you hid — to view them or unhide them';
      sh.addEventListener('click',function(){
        spec.showHiddenRef.v=!spec.showHiddenRef.v;doRebuild();});
      tl.appendChild(sh);
    }
    /* the trail's own Code-types / Output-types filters (present kinds only) */
    var ckSet={},otSet={};
    groups.forEach(function(g){g.steps.forEach(function(st){
      ckSet[(st.codeKinds&&st.codeKinds[0])||'code']=1;
      var ot=stepOt(st); if(ot) otSet[ot]=1;});});
    var ckList=Object.keys(ckSet),otList=Object.keys(otSet);
    if(!isTree&&ckList.length)
      tl.appendChild(traceFilterDropdown('code',ckList,traceCkHidden,v));
    if(!isTree&&otList.length)
      tl.appendChild(traceFilterDropdown('output',otList,traceOtHidden,v));
    v.appendChild(tl);
    /* several plots: the thumbnails PICK whose trace shows (one at a
       time), instead of every trace rendering side by side */
    if(multi){
      var strip=document.createElement('div');strip.className='vo-plots';
      visGroups.forEach(function(x,i){
        var th=plotThumb(x.g,i===traceSel);
        th.classList.add('vo-thumb-btn');
        if(i===traceSel) th.classList.add('sel');
        th.title='Show the code trace for “'+x.g.it.title+'”';
        th.addEventListener('click',function(){
          if(traceSel!==i){traceSel=i;doRebuild();}});
        strip.appendChild(th);
      });
      v.appendChild(strip);
    }
    if(isTree){
      var tg=visGroups[traceSel];
      if(tg) v.appendChild(traceTreeNode(tg.g));
      applyTraceFilter(v);
      return v;
    }
    var cols=document.createElement('div');cols.className='vo-groups';
    [visGroups[traceSel]].filter(Boolean).forEach(function(x){
      var g=x.g,vis=x.vis;
      var col=document.createElement('div');col.className='vo-col';
      if(multi){
        col.style.borderColor=g.color;
        col.style.boxShadow='0 0 16px '+g.color+'44';
      }
      var h=document.createElement('div');h.className='vo-col-h';
      if(multi) h.style.color=g.color;
      var hs=document.createElement('span');
      hs.textContent=g.it.title;h.appendChild(hs);
      col.appendChild(h);
      /* partition the steps under their notebook section (## heading) and
         subsection (### heading). Each section is a collapsible + hideable
         block, mirroring the docs — its steps live in a .vo-sec-body. */
      var lastSec=null,lastSub=null,secBody=col,secNs=[],secHdr=null;
      function wireSecEye(){
        if(!secHdr) return;
        var nss=secNs.slice();
        secHdr.querySelector('.vo-sec-eye').addEventListener('click',
          function(e){
            e.stopPropagation();
            var hid=hiddenSet({hidden:spec.list()});
            var anyVis=nss.some(function(ns){return !hid[ns];});
            nss.forEach(function(ns){
              if(anyVis?!hid[ns]:hid[ns]) spec.toggle(ns);});
            doRebuild();
          });
      }
      vis.forEach(function(st,k){
        /* partition by section ID, not title — two "### Summary" sections
           under different chapters must NOT merge into one block */
        var sec=st.section||st.sectitle||'',sub=st.subsection||'';
        if(sec!==lastSec){
          wireSecEye();                       /* finish the previous section */
          secNs=[];secHdr=null;
          if(sec){
            var sd=document.createElement('div');sd.className='vo-sec';
            var chev=document.createElement('span');
            chev.className='vo-sec-chev';chev.innerHTML='&#9662;';
            var lab=document.createElement('span');
            lab.className='vo-sec-lab';
            lab.textContent=(st.secnum?st.secnum+' · ':'')
              +(st.sectitle||sec);
            var eye=document.createElement('span');
            eye.className='vo-sec-eye';eye.innerHTML=bic('eye');
            eye.title='Hide or show this whole section';
            sd.appendChild(chev);sd.appendChild(lab);sd.appendChild(eye);
            col.appendChild(sd);
            secBody=document.createElement('div');
            secBody.className='vo-sec-body';col.appendChild(secBody);
            secHdr=sd;
            /* capture sd + secBody per-section (both are function-scoped vars
               reused across steps) so each chevron folds its OWN body */
            (function(hdr,bdy){
              var fold=function(){
                var c=hdr.classList.toggle('collapsed');
                bdy.classList.toggle('vo-sec-fold',c);};
              chev.addEventListener('click',function(e){
                e.stopPropagation();fold();});
              lab.addEventListener('click',fold);
            })(sd,secBody);
          } else {
            secBody=col;   /* steps with no section go straight in the column */
          }
          lastSec=sec;lastSub=null;
        }
        if(sub!==lastSub){
          if(sub){
            var sbh=document.createElement('div');sbh.className='vo-subsec';
            sbh.textContent=sub;secBody.appendChild(sbh);
          }
          lastSub=sub;
        }
        secNs.push(st.ns);
        secBody.appendChild(
          traceStep(st,k,g,multi,!!hidden[st.ns],spec,doRebuild));
      });
      wireSecEye();                            /* finish the final section */
      cols.appendChild(col);
    });
    v.appendChild(cols);
    applyTraceFilter(v);   /* reflect the current trail filters on rebuild */
    return v;
  }
  function updateVNav(){
    var down=$('#deck-down'),up=$('#deck-up');
    var inView=(mode==='view');
    var hasTrace=inView&&!!stage.querySelector('.vtrace');
    var atTop=(stage.scrollTop||0)<60;
    if(down) down.hidden=!(hasTrace&&atTop);
    if(up) up.hidden=!(hasTrace&&!atTop);
    var c=$('#deck-count');
    if(c) c.textContent=pres.slides.length
      ?((cur+1)+' / '+pres.slides.length):'0 / 0';
  }
  function scrollToTrace(){
    var tr=stage.querySelector('.vtrace');
    if(tr) tr.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function scrollToSlide(){
    stage.scrollTo({top:0,behavior:'smooth'});
  }
  stage.addEventListener('scroll',function(){
    if(mode==='view') updateVNav();
  });
  /* ---- print-resolution early warning (2026-08-04): a default-dpi
     matplotlib PNG stretched over a poster column prints fuzzy, and
     nobody finds out until the poster hall. On POSTER pages, any raster
     figure whose effective print density lands under 150dpi gets a
     small warning chip with the fix in its tooltip. SVG figures are
     vector — never flagged. ---- */
  function checkFigDpi(slideEl){
    var pg=pageOf(); if(!pg.poster||!pg.mm) return;
    $$('.an-cell',slideEl).forEach(function(cell){
      var old=cell.querySelector('.dpi-warn'); if(old) old.remove();
      var img=cell.querySelector('img'); if(!img) return;
      if(/^data:image\/svg/i.test(img.src||'')) return;
      function judge(){
        if(!document.contains(cell)||!img.naturalWidth) return;
        var sr=slideEl.getBoundingClientRect();
        /* the IMAGE's own drawn rect, not the frame's: a letterboxed
           figure prints far narrower than its cell, and judging the
           cell flagged sharp figures (2026-08-05 review) */
        var ir=img.getBoundingClientRect();
        var cr=ir.width?ir:cell.getBoundingClientRect();
        if(!sr.width||!cr.width) return;
        var mmw=cr.width/sr.width*pg.mm[0];
        var dpi=Math.round(img.naturalWidth/(mmw/25.4));
        if(!dpi||dpi>=150) return;
        var w=document.createElement('span');
        w.className='dpi-warn';
        w.textContent='⚠ ≈'+dpi+' dpi';
        w.title='This figure will print SOFT at this size (≈'+dpi
          +' dpi; aim for 200+). In the notebook, re-save it sharper — '
          +'savefig(dpi=300) — or emit vector SVG: '
          +"%config InlineBackend.figure_formats=['svg'] — "
          +'then refresh notebooks.';
        cell.appendChild(w);
      }
      if(img.complete) judge();
      else img.addEventListener('load',judge,{once:true});
    });
  }
  /* ---- REPEATED FURNITURE: watermark, header, footer -------------------
     All three are the same thing - one piece of DECK-level content painted
     onto every page. Slide numbers have worked this way since the start
     and are the model: they live on `pres`, they are drawn after the
     annots, and they are therefore not items you can select, drag or
     delete by accident (2026-08-20, user asked for "Watermarks" and
     "Header and footer").
     ONE function, called by renderSlide for the canvas and by
     buildPrintRoot for PDF / standalone HTML - a second copy is how the
     export and the screen drift apart.
     The placeholders are the ones every office suite uses, so a footer of
     "{n} / {N}" says what you would expect it to. */
  function furnText(txt,idx){
    /* {n}/{N} are the DECK's numbers and keep meaning exactly what they
       always did; {sn}/{sN} are the same question asked of the section,
       for a talk that runs in parts (T23). Both resolved here, in the
       one place furniture text is resolved. */
    var sp=sectionPos(idx);
    return String(txt||'')
      .replace(/\{sn\}/g,String(sp.n))
      .replace(/\{sN\}/g,String(sp.of))
      .replace(/\{sec\}/g,sp.name||'')
      .replace(/\{n\}/g,String(idx+1))
      .replace(/\{N\}/g,String((pres.slides||[]).length))
      .replace(/\{name\}/g,pres.name||'')
      .replace(/\{date\}/g,new Date().toLocaleDateString());
  }
  function paintFurniture(slideEl,idx){
    if(!slideEl) return;
    /* idempotent: applyZoom calls this again on every resize so the
       furniture rescales with the page, and appending a second copy every
       time would stack watermarks (2026-08-20) */
    $$('.slide-wmark,.slide-head,.slide-foot',slideEl)
      .forEach(function(n){n.remove();});
    /* PERCENT OF PAGE HEIGHT, resolved to px here - exactly the currency
       fontPx uses for text items. Left as a CSS percentage it resolved
       against the parent's FONT SIZE instead of the page, so a 12%
       watermark came out under 2px and was invisible (found live,
       2026-08-20). */
    var ph=slideEl.getBoundingClientRect().height||720;
    function px(pct,dflt){
      return Math.max(1,ph*(pct==null?dflt:pct)/100).toFixed(2)+'px';
    }
    var w=pres.wmark;
    if(w&&String(w.text||'').trim()){
      var wm=document.createElement('div');
      wm.className='slide-wmark';
      wm.textContent=furnText(w.text,idx);
      /* sized in the page's own currency (percent of page height), so a
         watermark reads the same on a 16:9 slide and on an A0 poster */
      wm.style.fontSize=px(w.size,12);
      wm.style.opacity=(w.op==null?0.12:w.op);
      wm.style.transform='translate(-50%,-50%) rotate('
        +(w.rot==null?-28:w.rot)+'deg)';
      if(w.color) wm.style.color=w.color;
      /* BEHIND everything: a watermark that covers a figure is a mistake,
         not a design */
      slideEl.insertBefore(wm,slideEl.firstChild);
      /* CONFIDENTIAL at 12%% of an A4 page is wider than the page. Rather
         than wrap it (a two-line watermark reads as a paragraph) or clip
         it, shrink it to fit with a margin - so any word works at any
         page size without anyone having to tune the number. */
      var wr=wm.getBoundingClientRect(),pw2=slideEl.clientWidth*0.92;
      if(wr.width>pw2&&wr.width>0){
        var k=pw2/wr.width;
        wm.style.transform+=' scale('+k.toFixed(3)+')';
      }
    }
    [['head','slide-head'],['foot','slide-foot']].forEach(function(f){
      var v=pres[f[0]];
      if(!v||!String(v.text||'').trim()) return;
      /* the first slide is usually a title slide and usually wants
         neither of them */
      if(v.skipFirst&&idx===0) return;
      var el=document.createElement('div');
      el.className=f[1];
      el.textContent=furnText(v.text,idx);
      el.style.fontSize=px(v.size,2);
      if(v.align) el.style.textAlign=v.align;
      if(v.color) el.style.color=v.color;
      slideEl.appendChild(el);
    });
  }
  function renderSlide(){
    var s=pres.slides[cur];
    applyPageBg();          /* this slide may carry its own background */
    stage.innerHTML='';
    vGroups=[];
    traceSel=0;   /* each slide starts on its first plot's trace */
    closeVFull();
    if(!s&&mode==='edit'){
      /* An editor opens on a blank PAGE, not on a notice explaining that
         there is no page. "No slides yet" also silently disabled every
         layout button, because applyLayout bails when there is nothing to
         apply it to (2026-08-07, user). Making the page real fixes both. */
      pres.slides=pres.slides||[];
      pres.slides.push(emptySlide());
      cur=pres.slides.length-1;
      s=pres.slides[cur];
      markDirty();
      renderFilm();
    }
    if(!s){
      stage.innerHTML='<div class="slide slide-empty"><p>No slides yet.'
        +'<br>Use <b>Create</b> to build some.</p></div>';
    } else if(s.layout==='title'){
      /* title + sub are movable items drawn by the annotation layer */
      var ts=document.createElement('div');
      ts.className='slide slide-titlefree';
      ts.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
      stage.appendChild(ts);
    } else {
      var bs=document.createElement('div');
      bs.className='slide slide-blank';
      stage.appendChild(bs);
    }
    var slideEl=stage.firstElementChild;
    if(s&&slideEl){
      /* size the page BEFORE annots render, so % geometry, fonts and
         figure fits all read the final canvas dimensions */
      applyPage();
      applyZoom();   /* every mode: playback letterboxes to the page too */
      attachAnnots(slideEl,s);
      typeset(slideEl);
      if(mode==='edit') checkFigDpi(slideEl);
      /* the annot layer exists only now, and the rulers shade the
         selection's extent from it */
      if(mode==='edit') syncGuides();
      if(mode==='view'){
        /* click anywhere on the slide advances the build / next slide */
        slideEl.style.cursor='pointer';
        slideEl.addEventListener('click',function(e){
          if(e.target.closest&&e.target.closest('button,a,input,select'))
            return;
          /* Alt+click blows the thing under the pointer up instead of
             advancing. A plain click MUST still advance - that is the
             gesture a talk runs on and it cannot be overloaded
             (2026-08-20). */
          if(e.altKey){
            var tg=spotTarget(e);
            if(tg){e.stopPropagation();spotlight(tg);return;}
          }
          if(spotEl){closeSpot();return;}
          /* TAP AN ITEM TO ENLARGE IT (2026-08-22, user: "clicking
             figures/text makes full screen"). This is in tension with a
             standing instruction — "a plain click MUST still advance,
             that is the gesture a talk runs on" (2026-08-20) — so it is
             a per-deck SETTING, and the two are reconciled by only
             claiming the item itself: the rest of the slide, which is
             most of it, still advances on a plain click. Off puts the
             old behaviour back exactly. */
          if(pres.tapzoom){
            var tz=e.target.closest&&e.target.closest('.an-item');
            if(tz&&!tz.classList.contains('an-prebuild')){
              e.stopPropagation();spotlight(tz);return;}
          }
          advance();
        });
      }
      paintFurniture(slideEl,cur);
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';
        pn.textContent=(cur+1);
        slideEl.appendChild(pn);
      }
    }
    renderSelPane();   /* keep the Objects pane on the CURRENT slide */
    renderNotesPane(); /* ...and the notes, which are per slide */
    /* playback: the code trace flows beneath the slide — scroll (or
       ArrowDown) between them; steps expand in place */
    stage.classList.remove('scrolly');
    if(mode==='view'&&s){
      var lin=lineageFor(s);
      vGroups=lin.groups;
      if(vGroups.length){
        var page=document.createElement('div');
        page.className='vpage';
        while(stage.firstChild) page.appendChild(stage.firstChild);
        stage.appendChild(page);
        stage.appendChild(buildTrace(s));
        stage.classList.add('scrolly');
      }
    }
    stage.scrollTop=0;
    updateVNav();
    /* Next stays live while builds remain on the last slide; Prev while any
       build can be stepped back on the first slide */
    var moreBuilds=(mode==='view'&&s&&revealCount<slideStops(s));
    var fewerBuilds=(mode==='view'&&revealCount>0);
    $('#deck-prev').disabled=(cur<=0&&!fewerBuilds);
    $('#deck-next').disabled=(cur>=pres.slides.length-1&&!moreBuilds);
  }

  /* ---------- free annotations: text, arrows, boxes, cell frames -----
     Stored per slide as s.annots, coordinates in % of the slide box so
     they scale with the screen; text size is % of slide height. Title
     slides also carry movable title/sub text (s.tprops / s.sprops,
     addressed with the special indices 't' / 's'). */
  var AN_NS='http://www.w3.org/2000/svg';
  /* One table, three consumers: the picker, the canvas CSS and the .pptx
     writer (which needs a REAL family name, not a CSS variable). A poster
     usually has to obey a departmental typeface, so the list goes beyond
     the generic five — and `a.font` may also be any font name you type,
     which falls through to the browser and to PowerPoint unchanged. */
  var FONTS=[
    {id:'sans',label:'Sans',css:'var(--sans)',ppt:'Calibri'},
    {id:'serif',label:'Serif',css:'var(--serif)',ppt:'Georgia'},
    {id:'mono',label:'Mono',css:'var(--mono)',ppt:'Consolas'},
    {id:'system',label:'System',css:'system-ui,sans-serif',ppt:'Calibri'},
    {id:'arial',label:'Arial',css:'Arial,Helvetica,sans-serif',ppt:'Arial'},
    {id:'helvetica',label:'Helvetica',
      css:'Helvetica,Arial,sans-serif',ppt:'Helvetica'},
    {id:'calibri',label:'Calibri',css:'Calibri,sans-serif',ppt:'Calibri'},
    {id:'verdana',label:'Verdana',css:'Verdana,Geneva,sans-serif',
      ppt:'Verdana'},
    {id:'tahoma',label:'Tahoma',css:'Tahoma,Geneva,sans-serif',ppt:'Tahoma'},
    {id:'trebuchet',label:'Trebuchet',
      css:'"Trebuchet MS",sans-serif',ppt:'Trebuchet MS'},
    {id:'times',label:'Times',css:'"Times New Roman",Times,serif',
      ppt:'Times New Roman'},
    {id:'georgia',label:'Georgia',css:'Georgia,serif',ppt:'Georgia'},
    {id:'cambria',label:'Cambria',css:'Cambria,Georgia,serif',ppt:'Cambria'},
    {id:'garamond',label:'Garamond',
      css:'Garamond,"EB Garamond",serif',ppt:'Garamond'},
    {id:'hand',label:'Hand',css:"'Segoe Print','Comic Sans MS',cursive",
      ppt:'Segoe Print'}];
  var FONTMAP={},FONTPPT={},FONTLAB={};
  FONTS.forEach(function(f){FONTMAP[f.id]=f.css;FONTPPT[f.id]=f.ppt;
    FONTLAB[f.id]=f.label;});
  /* the third thing a font id turns into: WORDS. A custom family is
     typed in by hand and is not in the table, so it answers with itself
     — which is exactly what the picker shows for it too. */
  function fontLabel(v){
    if(!v) return 'the default typeface';
    return FONTLAB[v]||String(v);
  }
  /* an unrecognised value is a typed family name: use it as-is */
  function fontCss(v){
    if(!v) return '';
    return FONTMAP[v]||('"'+String(v).replace(/"/g,'')+'"');
  }
  function fontPpt(v){
    if(!v) return '';
    return FONTPPT[v]||String(v);
  }
  var tool='select', selAnnot=null, picking=-1;
  /* set for the one showFmt that follows a fresh draw — see startDraw */
  var justDrew=false;
  /* selSet = every item in the current selection (a group, or a shift-click
     multi-select); selAnnot is the primary one that drives the format bar */
  var selSet=[];
  /* Which group you have STEPPED INTO, PowerPoint-style. Normally clicking
     any member selects the whole group; double-click a group and you are
     inside it, and clicks select one member at a time until you leave
     (Esc, or clicking away). Without this there was no way to touch a
     single item inside a group at all (2026-08-20, user: "You also can't
     select multiple items in a group like you can in powerpoint to
     modify"). */
  var inGroup=null;
  function leaveGroup(layer){
    if(inGroup===null) return;
    inGroup=null;
    if(layer) paintSel(layer);
  }
  function groupMembers(s,idx){
    if(!s||typeof idx!=='number') return [idx];
    var a=(s.annots||[])[idx];
    if(!a||a.grp==null) return [idx];
    /* inside this group, an item is just an item */
    if(inGroup!=null&&a.grp===inGroup) return [idx];
    var out=[];
    (s.annots||[]).forEach(function(x,i){if(x.grp===a.grp) out.push(i);});
    return out.length?out:[idx];
  }
  function nextGrp(s){
    var mx=0;(s.annots||[]).forEach(function(x){
      if(typeof x.grp==='number'&&x.grp>mx) mx=x.grp;});
    return mx+1;
  }
  /* build animations: items carrying a.anim reveal one step at a time during
     playback (click / arrow / space); revealCount is how many are shown */
  var revealCount=0;
  /* ---- THE FLIP BOOK ---------------------------------------------------
     (2026-08-22, user: "people create figures with small additions and then
     need to create layers of figures or heaps of new slides each with a new
     figure ... something like a flip book or photo deck where you can add
     heaps of figures to and then click arrows to scroll through".)

     One item holding an ordered list of FRAMES — each a notebook card or an
     image — of which exactly one shows at a time. That is the whole idea:
     a figure built up in six steps is ONE box on ONE slide, not six
     overlaid pictures with appear-animations, and not six duplicated
     slides whose surrounding text you then have to keep in step by hand.

     Other items on the slide TIE themselves to a frame (a.fb / a.fbf /
     a.fbm), so a caption can belong to figure 3 and either vanish with it
     or stay up once it has appeared. And because the deck knows which
     items belong to which frame, the exporter can do the duplication for
     you: one flip book of six frames becomes six real slides in .pptx and
     six pages in the PDF. The flip book is the authoring form; the pile of
     slides is only ever the delivery form.

     THE FRAME IS DERIVED, NEVER STORED, during playback. A slide already
     has exactly one playback cursor (revealCount) and a second piece of
     state beside it would be a second thing to keep in step — which is the
     bug this whole feature exists to stop people hand-doing. `a.at` is the
     editor's cursor only. */
  var flipSeq=0,flipForce=null;
  function flipId(){
    /* opaque and stable, like a.grp: a binding cannot be keyed on an array
       index, because every reorder, delete, duplicate and paste in this
       file splices s.annots and would silently re-point it at a stranger */
    flipSeq++;
    return 'k'+Date.now().toString(36)+flipSeq.toString(36);
  }
  function flipFrames(a){
    return (a&&Array.isArray(a.frames))?a.frames:[];
  }
  function flipsOn(s){
    var out=[];
    ((s&&s.annots)||[]).forEach(function(a,i){
      if(a&&a.k==='flip') out.push({a:a,i:i});});
    return out;
  }
  function flipById(s,id){
    var hit=null;
    flipsOn(s).forEach(function(p){if(!hit&&p.a.fid===id) hit=p.a;});
    return hit;
  }
  /* the extra playback stops this slide's flip books contribute: one per
     frame AFTER the first, because the first is what the slide opens on */
  function flipStops(s){
    var n=0;
    flipsOn(s).forEach(function(p){
      n+=Math.max(0,flipFrames(p.a).length-1);});
    return n;
  }
  /* every stop on a slide: the builds first, then the frames.
     Builds first because a build is usually the heading or the frame
     itself arriving, and the figure walking through its steps is what you
     then talk over — putting the frames first would make a title animate
     in after the picture had already finished. */
  function slideStops(s){
    return slideBuildSteps(s).count+flipStops(s);
  }
  /* which frame this flip book is showing right now. In the editor that is
     wherever you left its arrows; in playback it is read off revealCount,
     with each flip book on the slide consuming its own frames in reading
     order. */
  function flipAtNow(s,a){
    var fr=flipFrames(a),last=Math.max(0,fr.length-1);
    /* an exporting page is FOR one frame, and says so. It wins over both
       the editor cursor and the playback one, because printing sets
       mode='view' and revealCount=99999 to mean "fully built" and would
       otherwise put every page on the last frame. */
    if(flipForce!=null){
      var first=flipsOn(s)[0];
      if(first&&first.a===a)
        return Math.max(0,Math.min(last,flipForce));
      return Math.max(0,Math.min(last,a.at||0));
    }
    if(mode!=='view') return Math.max(0,Math.min(last,a.at||0));
    var left=Math.max(0,revealCount-slideBuildSteps(s).count),hit=0;
    flipsOn(s).forEach(function(p){
      var span=Math.max(0,flipFrames(p.a).length-1);
      var take=Math.min(span,left);
      if(p.a===a) hit=take;
      left-=take;
    });
    return hit;
  }
  /* is this item's frame the one showing? An item with no binding always
     shows, and — deliberately — so does one whose flip book has been
     deleted or whose frame no longer exists. An item that silently becomes
     invisible forever is the worst thing this feature could do, so every
     unresolvable binding fails OPEN. */
  function flipShowsFrame(s,a,at){
    if(!a||!a.fb) return true;
    var fb=flipById(s,a.fb); if(!fb) return true;
    var fr=flipFrames(fb); if(!fr.length) return true;
    var f=a.fbf||0; if(f>=fr.length) return true;
    var m=a.fbm||'only';
    if(m==='from') return at>=f;      /* appears here and stays up */
    if(m==='until') return at<=f;     /* here and everything before it */
    return at===f;                    /* just this one */
  }
  /* the same question against the frame showing NOW. Split from the above
     because the exporter has to ask it about a frame that is not the one
     on screen — that is what lets one flip book become several pages. */
  function flipShows(s,a){
    if(!a||!a.fb) return true;
    var fb=flipById(s,a.fb); if(!fb) return true;
    return flipShowsFrame(s,a,flipAtNow(s,fb));
  }
  var FLIP_MODES=[['only','Just this figure'],
    ['from','This figure and every one after'],
    ['until','This figure and every one before']];
  /* step a flip book's arrows. In playback the frames ARE stops in the one
     playback sequence, so an arrow moves the talk — otherwise the arrow
     and the space bar would disagree about where you are. */
  function flipStep(idx,d){
    var s=pres.slides[cur],a=((s&&s.annots)||[])[idx];
    if(!a||a.k!=='flip') return;
    var fr=flipFrames(a);
    if(fr.length<2) return;
    if(mode==='view'){
      var before=0;
      flipsOn(s).forEach(function(p){
        if(p.i<idx) before+=Math.max(0,flipFrames(p.a).length-1);});
      var lo=slideBuildSteps(s).count+before,hi=lo+fr.length-1;
      revealCount=Math.max(lo,Math.min(hi,revealCount+d));
      renderSlide();presenterSync();
      return;
    }
    a.at=Math.max(0,Math.min(fr.length-1,(a.at||0)+d));
    /* markDirty(true): flipping through your own figures to look at them
       is not an edit and must not fill the undo stack */
    markDirty(true);renderSlide();renderFlipPane();
  }
  function slideBuildIdx(s){
    var arr=[];
    (s&&s.annots||[]).forEach(function(a,i){if(a&&a.anim) arr.push(i);});
    arr.sort(function(x,y){
      return ((s.annots[x].anim.order||0)-(s.annots[y].anim.order||0));});
    return arr;
  }
  /* a build "step" is a distinct anim.order — items sharing an order appear
     TOGETHER on the same click. Returns {map: order->step-index, count} */
  function slideBuildSteps(s){
    var seen={};
    (s&&s.annots||[]).forEach(function(a){
      if(a&&a.anim) seen[a.anim.order||0]=1;});
    var keys=Object.keys(seen).map(Number).sort(function(x,y){return x-y;});
    var map={};keys.forEach(function(o,i){map[o]=i;});
    return {map:map,count:keys.length};
  }
  /* ordered list of steps for the animation pane: [{order, items:[idx,…]}] */
  function animSeq(s){
    var by={},order=[];
    (s&&s.annots||[]).forEach(function(a,i){
      if(a&&a.anim){var o=a.anim.order||0;
        if(!by[o]){by[o]=[];order.push(o);}by[o].push(i);}});
    order.sort(function(x,y){return x-y;});
    return order.map(function(o){return {order:o,items:by[o]};});
  }
  function nextAnimOrder(s){
    var mx=-1;(s&&s.annots||[]).forEach(function(a){
      if(a&&a.anim&&(a.anim.order||0)>mx) mx=a.anim.order||0;});
    return mx+1;
  }
  function itemLabel(s,idx){
    var a=(s&&s.annots||[])[idx]; if(!a) return 'item';
    /* annotLabel's ladder in miniature: these rows are narrower than the
       Objects pane's, so text and cell titles truncate shorter and the
       wording is terser (and, unlike there, a name wins for cells too).
       The why-a-name-wins comment lives on annotLabel. */
    if(a.k==='text') return (a.text||'').trim().slice(0,16)||'Text';
    if(a.name) return a.name;
    if(a.k==='rect') return (a.shape?a.shape:'Shape');
    if(a.k==='cell'){var it=a.ref&&resolveRef(a.ref);
      return it&&it.title?it.title.slice(0,18):'Cell';}
    if(a.k==='image'||a.k==='flip'||a.k==='table'
       ||a.k==='arrow'||a.k==='draw') return annotLabel(a);
    return 'item';
  }
  function paintSel(layer){
    var multi=selSet.length>1;
    var s0=pres.slides[cur];
    $$('[data-idx]',layer).forEach(function(el){
      var raw=el.getAttribute('data-idx');
      var key=(raw==='t'||raw==='s')?raw:+raw;
      var on=selSet.indexOf(key)>=0;
      el.classList.toggle('sel',on);
      el.classList.toggle('grpsel',on&&multi);
      /* the group you have stepped into is outlined as a whole, so it is
         obvious that clicks are landing on members and not on the group */
      var ga=(typeof key==='number'&&s0)?(s0.annots||[])[key]:null;
      el.classList.toggle('an-ingrp',
        inGroup!=null&&!!ga&&ga.grp===inGroup);
    });
  }
  var pendingShape='rect';   /* which shape the "+ Shapes" tool draws */
  /* which named type the next text box is born wearing, '' for a plain
     one. Module-local like pendingShape and for the same reason: a type
     that stuck across reloads would have you making headings by accident
     because of something you clicked last week (2026-08-22). */
  var pendingStyle='';
  /* every text box drawn on the canvas is born here. Factored out of
     startDraw so the armed type has ONE place to be honoured: a user who
     never opens the caret gets a byte-identical annot, because
     applyStyleTo is not called at all unless a type is armed and
     resolves.
     Deliberately NOT honoured elsewhere: the equation commit (an equation
     is maths, not a heading), applyLayout and the slide templates (a
     template already says what its boxes are), and paste (a pasted box
     keeps what it was copied as). */
  function textBorn(p0){
    var a={k:'text',x:p0.x,y:p0.y,w:0,h:0,text:'',size:2.6,bg:0};
    if(pendingStyle&&styleDef(pendingStyle)) applyStyleTo(a,pendingStyle);
    return a;
  }
  function titleProps(s,which){
    var key=which==='t'?'tprops':'sprops';
    if(!s[key]) s[key]=(which==='t')
      ?{x:50,y:42,size:6}          /* colours come from the page theme */
      :{x:50,y:58,size:2.6,color:'#7e93a4'};
    return s[key];
  }
  function annotByIdx(s,idx){
    if(idx==='t'||idx==='s') return titleProps(s,idx);
    if(typeof idx==='number') return (s.annots||[])[idx];
    return null;
  }
  /* how far shrink-to-fit is allowed to go. Below about two thirds the
     text stops being the size you chose and starts being a different
     size that happens to fit, which is the behaviour every "autofit"
     everybody hates actually is. Past the floor it stops and says so. */
  var FIT_MIN=0.62;
  function fontPx(layer,size){
    var h=layer.getBoundingClientRect().height||600;
    /* NO legibility floor. Text is a percentage of the page height, and
       everything around it — boxes, figures, spacing — scales with the
       page. A 9px minimum stopped scaling while its box carried on
       shrinking, so at 10% zoom every text broke out of its frame and the
       whole poster turned to soup (2026-08-07, user). Tiny text on a
       zoomed-out page is correct: that is what zoomed out MEANS. The
       0.5px guard only stops a collapse to zero. */
    return Math.max(0.5,h*(size||2.6)/100)+'px';
  }
  function applyCommon(el,a,extraTransform){
    if(a.op!=null&&a.op<1) el.style.opacity=a.op;
    var tr=extraTransform||'';
    if(a.rot) tr+=(tr?' ':'')+'rotate('+a.rot+'deg)';
    if(tr) el.style.transform=tr;
  }
  /* a markdown cell frame can carry its own text + background colour, so the
     note is readable on any slide (the default light-box grey is not) */
  function applyCellColor(el,a){
    if(a.txcol) el.style.setProperty('--nb-tx',tokVal(a.txcol));
    else el.style.removeProperty('--nb-tx');
    if(a.bgcol) el.style.setProperty('--nb-bg',
      a.bgcol==='none'?'transparent':tokVal(a.bgcol));
    else el.style.removeProperty('--nb-bg');
  }
  /* crop masks: images AND notebook cells (figures, markdown, code) can be
     clipped to a shape, or trimmed with a rectangular inset. clip-path scales
     with the element, so it survives responsive slide sizing. */
  var CROP_SHAPES=[['rect','No crop'],['round','Rounded'],
    ['ellipse','Ellipse'],['circle','Circle'],['triangle','Triangle'],
    ['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],
    ['star','Star'],['arrow','Arrow']];
  var CROP_CLIP={
    round:'inset(0 round 14%)',
    ellipse:'ellipse(50% 50% at 50% 50%)',
    circle:'circle(50% at 50% 50%)',
    triangle:'polygon(50% 0%,100% 100%,0% 100%)',
    diamond:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
    pentagon:'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)',
    hexagon:'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
    star:'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,'
      +'21% 91%,32% 57%,2% 35%,39% 35%)',
    arrow:'polygon(0% 30%,55% 30%,55% 8%,100% 50%,55% 92%,55% 70%,0% 70%)'};
  function cropCss(a){
    if(!a||!a.crop) return '';
    var c=a.crop,sh=c.shape||'rect';
    if(sh!=='rect'&&CROP_CLIP[sh]) return CROP_CLIP[sh];
    var t=c.t||0,r=c.r||0,b=c.b||0,l=c.l||0;
    if(t||r||b||l) return 'inset('+t+'% '+r+'% '+b+'% '+l+'%)';
    return '';
  }
  function applyCrop(el,a){
    if(!el) return;
    var cc=cropCss(a);
    if(cc){el.style.clipPath=cc;el.style.webkitClipPath=cc;}
    /* a cleared crop must also clear a stale inline clip: masked in the
       editor because renderAnnots rebuilds nodes, but the export path
       reuses them (2026-08-20 diagnosis) */
    else{el.style.removeProperty('clip-path');
      el.style.removeProperty('-webkit-clip-path');}
  }
  /* a little filled preview of a crop shape (uses the very same clip-path) */
  function cropIcon(shape){
    var d=document.createElement('span');d.className='crop-ico';
    var cc=CROP_CLIP[shape];
    if(cc){d.style.clipPath=cc;d.style.webkitClipPath=cc;}
    return d;
  }
  /* rich text: a text box can carry per-character colour (highlight a run and
     recolour just it). Stored as sanitised HTML in a.html; a.text keeps the
     plain fallback. Only colour + basic inline styles survive the sanitiser. */
  /* ul/ol/li are here because a BULLET LIST is rich text like any other
     run, not a separate mode. While they were missing, every list was
     flattened to its plain lines the moment it round-tripped through the
     sanitiser: bold inside a bullet, or a sub-level, silently vanished
     (2026-08-20, user: "the bullet list on/off is cursed"). */
  var RICH_TAGS={span:1,b:1,strong:1,i:1,em:1,u:1,s:1,br:1,font:1,
    ul:1,ol:1,li:1};
  function sanitizeRich(html){
    /* parse into an INERT template fragment — no image loads, no inline event
       handlers ever run (unlike a live-document div), so merely sanitising
       hostile HTML can never execute code */
    var tpl=document.createElement('template');
    tpl.innerHTML=String(html||'');
    /* walk with a live cursor (not a stale snapshot) so nodes promoted by
       unwrapping an unknown tag are ALSO inspected — otherwise a dangerous
       element nested one level in survives */
    (function walk(node){
      var n=node.firstChild;
      while(n){
        var next=n.nextSibling;
        if(n.nodeType===3){n=next;continue;}      /* text node: keep */
        if(n.nodeType!==1){node.removeChild(n);n=next;continue;}
        var tag=(n.tagName||'').toLowerCase();
        if(!RICH_TAGS[tag]){                       /* unwrap unknown tags */
          var first=n.firstChild;
          while(n.firstChild) node.insertBefore(n.firstChild,n);
          node.removeChild(n);
          n=first||next;continue;                  /* re-walk promoted nodes */
        }
        var color=(n.style&&n.style.color)||
          (tag==='font'?(n.getAttribute('color')||''):'');
        var names=[],k;
        for(k=0;k<n.attributes.length;k++) names.push(n.attributes[k].name);
        names.forEach(function(nm){n.removeAttribute(nm);});
        if(color) n.style.color=color;
        walk(n);
        n=next;
      }
    })(tpl.content);
    return {html:tpl.innerHTML,
      /* a list is structure worth keeping even with no inline styling in
         it — without ul/ol here a plain bullet list reported rich:false
         and the caller threw a.html away */
      rich:!!tpl.content.querySelector(
        'span[style],font,b,strong,i,em,u,s,ul,ol')};
  }
  /* ---- TEXT STYLES ----------------------------------------------------
     A named look a text box can WEAR rather than a set of properties it
     has to carry. A box records `a.style` and nothing else; the numbers
     come from pres.styles, which means restyling every heading in a deck
     is one edit to one object instead of a hunt through forty slides
     (2026-08-20, user asked for "all the different heading styles that
     you can have" and "some things like 'apply style to all headings'").
     The defaults are a type SCALE, not seven arbitrary sizes: each step
     is about 1.3x the one below, which is what makes a deck look like it
     was designed rather than assembled. Sizes are percent of page height,
     the same currency a.size already uses, so a style means the same
     thing on a 16:9 slide and on an A0 poster.
     An override still wins: colour a styled heading red and it stays red,
     because a.color is read after the style is applied. That is the whole
     contract - a style sets, it does not lock. */
  var STYLE_DEFAULTS={
    title:  {label:'Title',      size:7.2, b:1},
    h1:     {label:'Heading 1',  size:5.0, b:1},
    h2:     {label:'Heading 2',  size:3.8, b:1},
    h3:     {label:'Heading 3',  size:3.0, b:1},
    body:   {label:'Body',       size:2.6},
    small:  {label:'Small',      size:2.0},
    caption:{label:'Caption',    size:1.7, i:1, color:'#8aa0b0'}
  };
  var STYLE_ORDER=['title','h1','h2','h3','body','small','caption'];
  /* the HEADING styles, for "apply to all headings" */
  var HEADING_STYLES=['title','h1','h2','h3'];
  /* ---- DESIGN TOKENS ---------------------------------------------------
     A style set says what a HEADING looks like. Tokens say what the DECK
     is made of — its accent colours, its corner radius, the gap it
     spaces things at — and they differ from a style in one specific way
     that is the whole point of TASKS T12.

     applyStyleTo BAKES: it writes size, weight and colour onto every box
     wearing a style, and its comment argues that case well (every
     export, the pptx writer and the thumbnails all read a.size, and
     teaching five of them about styles would be five places to get it
     wrong). The cost of baking is that changing a definition later means
     re-stamping, and anything that drifted since is silently overwritten
     or silently left behind.

     A TOKEN IS A REFERENCE, NOT A COPY. An item stores the string
     '@accent' in its colour field; the value lives in one place; change
     it and every item referencing it changes, because none of them ever
     held a copy to go stale. Nothing is re-stamped and nothing drifts.

     THE RESOLVER IS AN IDENTITY FOR EVERYTHING ELSE. tokVal('#ff6b57')
     is '#ff6b57'. That is what makes this safe to thread through a
     renderer this size: every call site is a no-op for every deck that
     has never used a token, which is all of them so far. A reference is
     only ever a string beginning with '@'.

     Corner radius and the spacing scale need no per-item reference at
     all: there is one radius and one gap for the whole deck, so they go
     onto the slide as CSS custom properties and every shape picks them
     up without storing anything. */
  var TOKENS_DEFAULT={
    c:{accent:'#39a9c0',warm:'#ff6b57',lift:'#f0a848',
       calm:'#46a892',ink:'#ffffff',quiet:'#8aa0b0'},
    rad:4,      /* px, the corner of a drawn box */
    gap:3       /* % of the page, the rhythm the arrange verbs use */
  };
  var TOKEN_LABELS={accent:'Accent',warm:'Warm',lift:'Lift',
    calm:'Calm',ink:'Ink',quiet:'Quiet'};
  function tokens(){
    var t=(pres&&pres.tokens)||{};
    var out={c:{},rad:TOKENS_DEFAULT.rad,gap:TOKENS_DEFAULT.gap};
    Object.keys(TOKENS_DEFAULT.c).forEach(function(k){
      out.c[k]=TOKENS_DEFAULT.c[k];});
    if(t.c) Object.keys(t.c).forEach(function(k){
      if(t.c[k]) out.c[k]=t.c[k];});
    if(t.rad!=null&&isFinite(t.rad)) out.rad=+t.rad;
    if(t.gap!=null&&isFinite(t.gap)&&+t.gap>0) out.gap=+t.gap;
    return out;
  }
  function tokRef(v){
    return (typeof v==='string'&&v.charAt(0)==='@')?v.slice(1):'';
  }
  /* THE one resolver. Identity for anything that is not a reference. */
  function tokVal(v){
    var k=tokRef(v);
    if(!k) return v;
    var c=tokens().c;
    return c[k]||TOKENS_DEFAULT.c[k]||'#39a9c0';
  }
  /* the deck's tokens, written where CSS can see them. One place, so a
     shape's corner and the page agree without any item storing one. */
  function applyTokens(slideEl){
    renderTokenSwatches();
    renderTokenSwatches();
    if(!slideEl) return;
    var t=tokens();
    Object.keys(t.c).forEach(function(k){
      slideEl.style.setProperty('--tk-'+k,t.c[k]);});
    slideEl.style.setProperty('--tk-rad',t.rad+'px');
  }
  /* changing a token is an ordinary edit: one markDirty, one undo step,
     and a refresh — which is the cascade, since nothing held a copy */
  /* THE TOKEN SWATCHES, injected at the head of both colour menus.
     They are ordinary .sw chips carrying data-c="@accent", so the
     delegated handler that already drives every preset swatch drives
     these too and stores the REFERENCE rather than the colour. That is
     the whole trick: one line of new wiring, and the difference between
     a copy and a reference is a single character in the stored value. */
  function renderTokenSwatches(){
    ['#fmt-txcol-menu','#fmt-fillcol-menu'].forEach(function(sel){
      var menu=$(sel); if(!menu) return;
      var row=menu.querySelector('.sw-tokrow');
      if(!row){
        row=document.createElement('span');
        row.className='sw-tokrow';
        menu.insertBefore(row,menu.firstChild);
      }
      row.innerHTML='';
      var isFill=(sel==='#fmt-fillcol-menu');
      var lab=document.createElement('span');
      lab.className='fmt-lab';
      lab.textContent='Deck';
      lab.title='This deck\u2019s own colours. An item given one of '
        +'these follows it: change the colour once and everything '
        +'wearing it changes.';
      row.appendChild(lab);
      var t=tokens();
      Object.keys(t.c).forEach(function(k){
        var b=document.createElement('button');
        b.className='sw sw-tok';
        b.setAttribute('data-c','@'+k);
        b.style.background=t.c[k];
        var nm=TOKEN_LABELS[k]||k;
        b.title=nm+' \u2014 this deck\u2019s colour. Change it in '
          +'Design \u2192 Deck colours and everything using it follows.';
        b.setAttribute('aria-label',nm+' (deck colour)');
        /* WIRED HERE, not by the boot-time sweep. That sweep takes one
           snapshot of $$('#et-fmt .sw...') at load, so a chip built
           afterwards is a swatch that looks right and does nothing —
           which is exactly what these did until a browser said so
           (2026-08-25). */
        b.addEventListener('mousedown',function(e){
          if(activeTextEditable()) e.preventDefault();});
        b.addEventListener('click',function(){
          if(isFill) applyFillColor('@'+k); else applyTextColor('@'+k);});
        row.appendChild(b);
      });
    });
  }
  /* the editor for the registry itself */
  function openTokenPicker(anchor){
    var old=$('#tok-pop'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu tok-pop';m.id='tok-pop';
    menuHead(m,'this deck\u2019s colours');
    var note=document.createElement('div');
    note.className='ff-none';
    note.textContent='Change one and every object wearing it changes '
      +'with it \u2014 nothing holds a copy. Give an object one from '
      +'the Deck row of the Colour or Fill menu.';
    m.appendChild(note);
    var t=tokens();
    Object.keys(t.c).forEach(function(k){
      var row=document.createElement('div');row.className='ff-row';
      var sw=document.createElement('span');
      sw.className='sw sw-tok';sw.style.background=t.c[k];
      row.appendChild(sw);
      var nm=document.createElement('span');
      nm.className='tok-nm';nm.textContent=TOKEN_LABELS[k]||k;
      row.appendChild(nm);
      var inp=document.createElement('input');
      inp.type='color';inp.className='ff-in';
      inp.value=/^#[0-9a-f]{6}$/i.test(t.c[k])?t.c[k]:'#39a9c0';
      inp.setAttribute('aria-label',(TOKEN_LABELS[k]||k)+' colour');
      inp.addEventListener('change',function(){
        setToken('c',k,inp.value);
        sw.style.background=inp.value;
        renderTokenSwatches();
      });
      row.appendChild(inp);
      m.appendChild(row);
    });
    menuHead(m,'shape corner');
    var rr=document.createElement('div');rr.className='ff-row';
    var rl=document.createElement('span');
    rl.className='tok-nm';rl.textContent='Corner radius';
    rr.appendChild(rl);
    var ri=document.createElement('input');
    ri.type='number';ri.min='0';ri.max='40';ri.className='ff-in';
    ri.value=String(t.rad);
    ri.setAttribute('aria-label','Corner radius in pixels');
    ri.addEventListener('change',function(){
      var v=Math.max(0,Math.min(40,+ri.value||0));
      setToken('rad',null,v);
    });
    rr.appendChild(ri);
    m.appendChild(rr);
    menuHead(m,'spacing');
    var gr=document.createElement('div');gr.className='ff-row';
    var gl=document.createElement('span');
    gl.className='tok-nm';gl.textContent='Gap the arrange verbs use';
    gr.appendChild(gl);
    var gi=document.createElement('input');
    gi.type='number';gi.min='0.5';gi.max='20';gi.step='0.5';
    gi.className='ff-in';gi.value=String(t.gap);
    gi.setAttribute('aria-label','Spacing gap, in percent of the page');
    gi.addEventListener('change',function(){
      var v=Math.max(0.5,Math.min(20,+gi.value||3));
      setToken('gap',null,v);
    });
    gr.appendChild(gi);
    m.appendChild(gr);
    document.body.appendChild(m);
    floatMenu(anchor||$('#dsg-styles')||$('#edit-tools'),m);
    setTimeout(function(){
      document.addEventListener('click',function off(e){
        if(m.contains(e.target)) return;
        m.remove();document.removeEventListener('click',off);
      });
    },0);
  }
  function setToken(kind,key,val){
    pres.tokens=pres.tokens||{};
    if(kind==='c'){
      pres.tokens.c=pres.tokens.c||{};
      pres.tokens.c[key]=val;
    } else pres.tokens[kind]=val;
    markDirty();
    refresh();
  }
  /* ---- STYLE SETS ------------------------------------------------------
     (2026-08-22, user: "it would be good if you could auto-style a
     presentation ... you could have set-defaults of what paragraphs,
     headings etc. look like, instead of having to go through and do
     everything yourself ... styles that are already in existence that
     people would like, and you can create your own".)

     A style set is the whole type registry in one named object — every
     style's size, weight, face and colour together. `pres.styles` already
     IS that object, so applying a set is one assignment and one
     re-stamp, and saving one is a copy. There is no new model here at
     all, which is the point: the registry was built for this and just had
     no way to be named or shared.

     Called a STYLE SET and not a theme deliberately: "Theme" in this app
     is already the chrome's colour scheme (app.js SCHEMES), and two
     things called the same word one bar apart is how a menu stops being
     readable. Word uses "style set" for exactly this and means exactly
     this.

     Sizes are percentages of page height, the same currency a.size uses,
     so a set means the same thing on a 16:9 slide and on an A0 poster. */
  var STYLE_SETS=[
    {id:'clean',label:'Clean',
     note:'Sans throughout, the built-in scale. A safe default.',
     styles:{
       title:{size:7.2,b:1},h1:{size:5.0,b:1},h2:{size:3.8,b:1},
       h3:{size:3.0,b:1},body:{size:2.6},small:{size:2.0},
       caption:{size:1.7,i:1,color:'#8aa0b0'}}},
    {id:'editorial',label:'Editorial',
     note:'Serif headings over a sans body, and room to breathe.',
     styles:{
       title:{size:7.6,b:1,font:'serif'},
       h1:{size:5.2,b:1,font:'serif'},
       h2:{size:3.9,b:1,font:'serif'},
       h3:{size:3.0,b:0,i:1,font:'serif'},
       body:{size:2.5,lh:1.5},small:{size:1.95,lh:1.4},
       caption:{size:1.6,i:1,font:'serif',color:'#9aa8b4'}}},
    {id:'bold',label:'Bold',
     note:'Heavy sans and big titles — for a room at the back.',
     styles:{
       title:{size:9.0,b:1},h1:{size:6.2,b:1},h2:{size:4.4,b:1},
       h3:{size:3.3,b:1},body:{size:3.0,b:0},small:{size:2.3},
       caption:{size:1.9,b:1,color:'#7f93a4'}}},
    {id:'academic',label:'Academic',
     note:'Serif everywhere, modest sizes, generous leading.',
     styles:{
       title:{size:6.4,b:1,font:'serif'},
       h1:{size:4.4,b:1,font:'serif'},
       h2:{size:3.4,b:1,font:'serif'},
       h3:{size:2.8,b:0,i:1,font:'serif'},
       body:{size:2.4,font:'serif',lh:1.5,pspace:0.5},
       small:{size:1.9,font:'serif',lh:1.4},
       caption:{size:1.6,i:1,font:'serif',color:'#93a3b0'}}},
    {id:'minimal',label:'Minimal',
     note:'Light weights and small headings. Lets the figures talk.',
     styles:{
       title:{size:5.6},h1:{size:4.0},h2:{size:3.1},h3:{size:2.6},
       body:{size:2.4,lh:1.55},small:{size:1.9,lh:1.45},
       caption:{size:1.55,color:'#8aa0b0'}}},
    {id:'poster',label:'Poster',
     note:'Sized for a printed sheet read from a metre away.',
     styles:{
       title:{size:4.6,b:1},h1:{size:3.2,b:1},h2:{size:2.5,b:1},
       h3:{size:2.1,b:1},body:{size:1.7},small:{size:1.45},
       caption:{size:1.25,i:1,color:'#8aa0b0'}}}
  ];
  /* sets you saved yourself live in localStorage rather than on the deck:
     the whole point of naming a look is using it on the NEXT presentation
     too, and anything on `pres` travels with one file only. */
  var SETKEY='jv-deck-sets:';
  function myStyleSets(){
    try{
      var l=JSON.parse(lsGet(SETKEY+SCOPE)||'[]');
      return Array.isArray(l)?l:[];
    }catch(e){return [];}
  }
  function saveMyStyleSets(list){
    lsSet(SETKEY+SCOPE,JSON.stringify(list));
  }
  function allStyleSets(){
    return STYLE_SETS.concat(myStyleSets());
  }
  function styleSetById(id){
    var hit=null;
    allStyleSets().forEach(function(t){if(t&&t.id===id) hit=t;});
    return hit;
  }
  /* apply a set: replace the registry and re-stamp every box wearing a
     name. Custom TYPES are kept — they are your vocabulary, not the
     look — and a set that says nothing about one keeps whatever it had. */
  function applyStyleSet(id){
    var t=styleSetById(id); if(!t) return 0;
    var next={};
    Object.keys(t.styles||{}).forEach(function(k){
      var o=deep(t.styles[k]);
      if(STYLE_DEFAULTS[k]) o.label=STYLE_DEFAULTS[k].label;
      /* SPELL OUT the properties the set does NOT want. styleDef merges an
         override OVER the built-in, so a key the set simply omits keeps
         whatever the built-in said — which meant "Bold", whose caption is
         upright, still produced italic captions, because the built-in
         Caption is italic (2026-08-22, caught in the browser). Writing a
         falsy value makes applyStyleTo's `if(d.i) … else delete` clear it,
         so a set means exactly what it says and nothing more. */
      ['b','i','font','color','lh','pspace'].forEach(function(p){
        if(o[p]===undefined) o[p]=0;});
      next[k]=o;
    });
    /* a custom type keeps the size it had unless the set names it, so
       applying a set does not silently flatten types you invented */
    (pres.types||[]).forEach(function(ct){
      if(ct&&ct.id&&!next[ct.id]&&pres.styles&&pres.styles[ct.id])
        next[ct.id]=pres.styles[ct.id];
    });
    pres.styles=next;
    /* a set may bring its own tokens. It REPLACES rather than merges,
       for the reason applyStyleSet spells out about styles: a set means
       exactly what it says, and a colour it does not name should be the
       built-in one rather than whatever the last set happened to leave
       behind. */
    if(t.tokens) pres.tokens=deep(t.tokens);
    return restyleAll(null);
  }
  /* ---- AUTO-STYLE ------------------------------------------------------
     The half that matters. Most decks have never used a named style, so
     applying a set to one changes NOTHING — there is nothing wearing a
     name to re-stamp. So the boxes are named first, by what they already
     look like, using the bands the standardise check already computes.

     This is the opposite of stdAdopt, deliberately. Adopting a band keeps
     the band's own numbers so nothing moves; auto-styling REPLACES them,
     because moving is the entire request ("instead of having to go
     through and do everything yourself"). */
  function autoStyleDeck(id){
    var t=styleSetById(id); if(!t) return null;
    var boxes=stdBoxes().filter(function(p){
      return !(p.a.style&&STYLE_DEFAULTS[p.a.style]);});
    var named=0;
    if(boxes.length){
      var bands=stdName(stdBands(boxes));
      bands.forEach(function(b){
        b.boxes.forEach(function(p){
          p.a.style=b.suggest;named++;});
      });
    }
    var n=applyStyleSet(id);
    return {named:named,styled:n,set:t};
  }
  /* ---- TYPES OF YOUR OWN ----------------------------------------------
     The seven built-ins are a type SCALE, not a vocabulary. A deck that
     wants a "Quote" or a "Source note" had nowhere to put one, so those
     boxes got formatted by hand and then drifted apart across forty
     slides - which is the exact problem named styles exist to stop
     (2026-08-22, user: "it would be cool if people could create their own
     types and change the defaults of these").

     A custom type is a full definition living on pres.types, and
     syncCustomTypes() GRAFTS it into STYLE_DEFAULTS at load. That is
     deliberate rather than lazy: four places index STYLE_DEFAULTS[id]
     directly, and every menu, every specimen row, applyStyleTo and the
     exporters all read the registry without ever asking whether an id is
     built in. One live registry fixes all of them at once and changes
     none of them.

     It is an ARRAY, not a map, because the ORDER is the feature - a type
     scale reads top to bottom. And it is a SEPARATE key from pres.styles
     because the style manager's reset does `delete pres.styles`: "back to
     the built-in sizes" must never mean "throw away the types I made". */
  var BUILTIN_STYLE_IDS=STYLE_ORDER.slice();
  function customTypes(){
    if(!Array.isArray(pres.types)) pres.types=[];
    return pres.types;
  }
  /* rebuild STYLE_DEFAULTS from the built-ins plus THIS deck's types.
     It has to run on every path that installs a new `pres`, or deck A's
     types leak into deck B - which is why it is the first thing
     histReset() does, that being the one funnel every new presentation
     passes through. */
  function syncCustomTypes(){
    /* Impossible by construction since 2026-08-23: the first
       presentation loads from THE BOOT SEQUENCE at the end of the file,
       after STYLE_DEFAULTS is assigned, so this guard never fires. It
       stays as a pure bail-out in case a future caller runs earlier —
       the incident record at the boot sequence says why it existed. */
    if(!STYLE_DEFAULTS) return;
    Object.keys(STYLE_DEFAULTS).forEach(function(id){
      if(BUILTIN_STYLE_IDS.indexOf(id)<0) delete STYLE_DEFAULTS[id];
    });
    (Array.isArray(pres&&pres.types)?pres.types:[]).forEach(function(t){
      if(!t||!t.id||BUILTIN_STYLE_IDS.indexOf(t.id)>=0) return;
      var d={label:String(t.label||'Style'),
        size:(typeof t.size==='number'&&t.size>0)?t.size:2.6};
      ['b','i','font','color','align','lh','pspace','head']
        .forEach(function(k){if(t[k]!==undefined) d[k]=t[k];});
      STYLE_DEFAULTS[t.id]=d;
    });
  }
  /* the order the menus walk: the built-in scale first, then yours, in
     the order you made them. STYLE_ORDER itself stays exactly as it was -
     it is the built-in list, and BUILTIN_STYLE_IDS is taken from it. */
  function styleOrder(){
    var out=STYLE_ORDER.slice();
    (Array.isArray(pres&&pres.types)?pres.types:[]).forEach(function(t){
      if(t&&t.id&&out.indexOf(t.id)<0&&STYLE_DEFAULTS[t.id]) out.push(t.id);
    });
    return out;
  }
  /* "is this a heading" stopped being a fixed list of four the moment you
     could invent a type: your "Section label" probably is one and your
     "Pull quote" is not, and only you can say. The built-ins keep their
     answer, so nothing that worked yesterday changes. */
  function isHeadingStyle(id){
    if(HEADING_STYLES.indexOf(id)>=0) return true;
    var d=STYLE_DEFAULTS[id];
    return !!(d&&d.head);
  }
  function headingStyles(){
    return styleOrder().filter(isHeadingStyle);
  }
  /* an id must never collide with a built-in: a deck file naming its own
     type "h1" would silently redefine Heading 1 for everyone who opened
     it. Minted from a counter rather than from the label, so RENAMING a
     type does not orphan every box wearing it. */
  function mintTypeId(){
    var n=1,ids={};
    customTypes().forEach(function(t){if(t&&t.id) ids[t.id]=1;});
    while(ids['t'+n]||BUILTIN_STYLE_IDS.indexOf('t'+n)>=0) n++;
    return 't'+n;
  }
  function addCustomType(label,base){
    var b=styleDef(base)||STYLE_DEFAULTS.body;
    var t={id:mintTypeId(),label:String(label||'My style'),size:b.size};
    ['b','i','font','color','align','lh','pspace']
      .forEach(function(k){if(b[k]!==undefined) t[k]=b[k];});
    customTypes().push(t);
    syncCustomTypes();
    return t;
  }
  /* deleting a type must not MOVE anything. applyStyleTo has already
     written every one of its properties onto each box, so dropping the
     NAME leaves the slides looking exactly as they did - the boxes just
     stop being a group. Re-stamping them to Body instead would resize
     half the deck as a punishment for tidying up.
     Guarded on a.k==='text' because a.style on a line or an arrow is the
     DASH style (lineStyle, above) and shares nothing with this but the
     word. */
  function deleteCustomType(id){
    if(BUILTIN_STYLE_IDS.indexOf(id)>=0) return 0;
    var n=0;
    (pres.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(a&&a.k==='text'&&a.style===id){delete a.style;n++;}
      });
    });
    var list=customTypes();
    for(var i=list.length-1;i>=0;i--)
      if(list[i]&&list[i].id===id) list.splice(i,1);
    if(pres.styles) delete pres.styles[id];
    syncCustomTypes();
    return n;
  }
  function deckStyles(){
    if(!pres.styles) pres.styles={};
    return pres.styles;
  }
  function styleDef(id){
    var d=STYLE_DEFAULTS[id];
    if(!d) return null;
    var over=deckStyles()[id]||{};
    var out={};
    Object.keys(d).forEach(function(k){out[k]=d[k];});
    Object.keys(over).forEach(function(k){out[k]=over[k];});
    return out;
  }
  /* stamp a style's properties onto an item. This WRITES them rather than
     resolving at render time, deliberately: every export, the pptx
     converter and the thumbnails already read a.size / a.b / a.color, and
     teaching all five of them about styles would be five places to get it
     wrong. a.style is kept so "apply to all headings" can find them. */
  function applyStyleTo(a,id){
    var d=styleDef(id); if(!a||!d) return;
    a.style=id;
    a.size=d.size;
    if(d.b) a.b=1; else delete a.b;
    if(d.i) a.i=1; else delete a.i;
    if(d.font) a.font=d.font; else delete a.font;
    if(d.color) a.color=d.color; else delete a.color;
    if(d.align) a.align=d.align;
    if(d.lh) a.lh=d.lh; else delete a.lh;
    if(d.pspace) a.pspace=d.pspace; else delete a.pspace;
  }
  /* ---- SPEAKER NOTES + TIMING ------------------------------------------
     Notes are per slide and are never drawn on the page: they exist for
     the presenter view and for you (2026-08-20, user asked for "the other
     [screen] with like notes and the next slide"). The per-slide GOAL is
     in minutes, and the pane adds them up so a talk that cannot fit in
     its slot says so before you give it, not during. */
  function slideGoal(sl){
    return (sl&&typeof sl.goal==='number'&&sl.goal>0)?sl.goal:0;
  }
  function goalTotal(){
    var t=0;
    (pres.slides||[]).forEach(function(sl){t+=slideGoal(sl);});
    return t;
  }
  function fmtMins(m){
    var sec=Math.round(m*60);
    var mm=Math.floor(sec/60),ss=sec%60;
    return mm+':'+(ss<10?'0':'')+ss;
  }
  /* ---- WHAT A NOTE IS ALLOWED TO BE -----------------------------------
     (TASKS T28.) Notes were plain text in a pre-wrap box. The ask is
     "markdown notes with links/references", and the interesting part is
     what to leave out.

     A SUBSET, NOT A LIBRARY. There is no build step here and no bundler,
     so a markdown library would be the first vendored dependency in the
     whole frontend — carried on every page, for the sake of the notes
     pane. What speaker notes actually contain is a short list: emphasis,
     a bullet, a number, a bit of code, a link. That fits in fifty lines,
     and fifty lines that only do those things cannot be surprised by the
     rest of CommonMark.

     ESCAPE FIRST, THEN MARK UP. Every character goes through esc()
     before a single tag is added, so a note containing <script> becomes
     text and never markup. That is the same rule render/sanitize.py
     enforces on the Python side, applied at the one place the frontend
     builds HTML out of something a person typed — and it matters here
     because a deck file arrives from other people.

     LINKS ARE WHITELISTED BY SCHEME, which is the other half of that.
     [text](url) accepts http, https, mailto and a bare #N, and nothing
     else; anything else renders as its own label, so a javascript: URL
     in someone else's deck is text on your screen rather than a handler
     on your click.

     REFERENCES REUSE WHAT THE DECK ALREADY KNOWS. `{fig:id}` is T21's
     figure-numbering syntax, so a note saying "as {fig:trend} shows"
     stays right when the figures are renumbered, and there is no second
     idea about what a reference is. `[the method](#7)` is a jump to
     slide 7 — live in the presenter view, where `goto` already existed
     for the strip.

     A LINE BREAK IS MEANINGFUL. Two plain lines make two paragraphs
     rather than one, because in speaker notes you put a thought on its
     own line on purpose. Markdown's "wrap freely" rule is for prose
     someone else will typeset; this is a script you read at speed. */
  var MD_URL=/^(?:https?:\/\/|mailto:)[^\s<>"']+$/i;
  function mdHref(u){
    u=String(u||'').trim();
    if(/^#\d+$/.test(u)) return u;          /* a slide in this deck */
    return MD_URL.test(u)?u:'';
  }
  /* the inline pass runs over ALREADY-ESCAPED text. Anything that turns
     into a tag is stashed behind a sentinel first, so a later rule can
     never reach inside markup an earlier rule produced. */
  function mdInline(t){
    var keep=[];
    function stash(html){
      keep.push(html);return '\u0000'+(keep.length-1)+'\u0000';
    }
    t=t.replace(/`([^`]+)`/g,function(_,c){
      return stash('<code>'+c+'</code>');});
    t=t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,function(m,lab,u){
      var h=mdHref(u);
      if(!h) return lab;      /* not a scheme we allow: it is just words */
      if(h.charAt(0)==='#')
        return stash('<a href="'+h+'" class="jvn-goto" data-slide="'
          +h.slice(1)+'">'+lab+'</a>');
      return stash('<a href="'+h+'" target="_blank" '
        +'rel="noopener noreferrer">'+lab+'</a>');
    });
    /* a pasted URL is a link too — people paste them */
    t=t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,function(m,pre,u){
      var h=mdHref(u);
      return h?(pre+stash('<a href="'+h+'" target="_blank" '
        +'rel="noopener noreferrer">'+u+'</a>')):m;});
    t=t.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
    t=t.replace(/\*([^*\n]+)\*/g,'<i>$1</i>');
    return t.replace(/\u0000(\d+)\u0000/g,function(_,i){return keep[+i];});
  }
  function notesHtml(txt){
    var src=figSubst(String(txt==null?'':txt).replace(/[\0\u0000]/g,''),
      null);
    var lines=esc(src).split('\n'),out=[],list=null;
    function closeList(){if(list){out.push('</'+list+'>');list=null;}}
    lines.forEach(function(ln){
      var m;
      if(/^\s*$/.test(ln)){closeList();return;}
      if((m=/^(#{1,3})\s+(.*)$/.exec(ln))){
        closeList();
        /* # is an h3: a note never outranks the page it sits beside */
        out.push('<h'+(m[1].length+2)+'>'+mdInline(m[2])
          +'</h'+(m[1].length+2)+'>');return;}
      if(/^\s*(?:---+|\*\*\*+)\s*$/.test(ln)){
        closeList();out.push('<hr>');return;}
      /* > was turned into &gt; by esc, which runs first on purpose */
      if((m=/^\s*&gt;\s?(.*)$/.exec(ln))){
        closeList();
        out.push('<blockquote>'+mdInline(m[1])+'</blockquote>');return;}
      if((m=/^\s*[-*]\s+(.*)$/.exec(ln))){
        if(list!=='ul'){closeList();out.push('<ul>');list='ul';}
        out.push('<li>'+mdInline(m[1])+'</li>');return;}
      if((m=/^\s*\d+[.)]\s+(.*)$/.exec(ln))){
        if(list!=='ol'){closeList();out.push('<ol>');list='ol';}
        out.push('<li>'+mdInline(m[1])+'</li>');return;}
      closeList();
      out.push('<p>'+mdInline(ln)+'</p>');
    });
    closeList();
    return out.join('');
  }
  /* ---- THE ROOM TO WRITE THEM IN --------------------------------------
     (TASKS T28's "a roomy notes editor".) The pane is a column beside
     the stage, which is right for checking a note and wrong for writing
     one — you are typing a paragraph into a box four lines tall.

     So: an overlay, the same shape the spotlight, the presenter view and
     the overview map already have, because it wants all the room there
     is while you are using it and none afterwards. The slide is beside
     the text, because a note is about THAT slide and writing it blind is
     how you end up describing the previous one. The preview is live and
     beside the source rather than behind a toggle — the whole point of
     allowing markdown is that you can see whether you got it right.

     It writes to the same `sl.notes` on the same input event as the
     pane, so there is one field, one autosave and nothing to reconcile. */
  var notesEdIdx=-1;
  function notesEdClose(){
    var ov=$('#deck-notesed');
    if(ov) ov.remove();
    document.removeEventListener('keydown',notesEdKey,true);
    notesEdIdx=-1;
    renderNotesPane();
  }
  function notesEdKey(e){
    if(!$('#deck-notesed')) return;
    if(e.key==='Escape'){
      /* let a textarea keep Escape for its own IME/autocomplete first */
      e.preventDefault();e.stopPropagation();notesEdClose();
    }
  }
  function notesEdFill(){
    var ov=$('#deck-notesed'); if(!ov) return;
    var sl=(pres.slides||[])[notesEdIdx];
    var n=(pres.slides||[]).length;
    var ttl=ov.querySelector('.nse-t');
    if(ttl) ttl.textContent='Slide '+(notesEdIdx+1)+' of '+n
      +(filmText(sl)?(' — '+filmText(sl)):'');
    var ta=ov.querySelector('#nse-ta');
    if(ta&&document.activeElement!==ta) ta.value=(sl&&sl.notes)||'';
    var pv=ov.querySelector('#nse-prev');
    if(pv) pv.innerHTML=notesHtml((sl&&sl.notes)||'')
      ||'<p class="nse-none">Nothing yet.</p>';
    var box=ov.querySelector('#nse-slide');
    if(box){
      box.innerHTML='';
      var node=buildSlideNode(notesEdIdx,true);
      if(node){
        box.appendChild(node);
        var k=Math.min((box.clientWidth||420)/960,
          (box.clientHeight||240)/540);
        node.style.transform='scale('+(k||0.4).toFixed(4)+')';
        node.style.flex='none';
      }
    }
  }
  function notesEdGo(d){
    var n=(pres.slides||[]).length;
    var to=Math.max(0,Math.min(n-1,notesEdIdx+d));
    if(to===notesEdIdx) return;
    notesEdIdx=to;
    /* the deck follows the editor: you are looking at this slide now */
    if(cur!==to){cur=to;selAnnot=null;selSet=[];refresh();}
    notesEdFill();
  }
  function openNotesEditor(i){
    notesEdClose();
    notesEdIdx=(typeof i==='number')?i:cur;
    if(!(pres.slides||[])[notesEdIdx]) return;
    var ov=document.createElement('div');
    ov.className='deck-notesed';ov.id='deck-notesed';
    ov.innerHTML='<div class="nse-head">'
      +'<span class="nse-t"></span><span class="deck-spring"></span>'
      +'<button class="dbtn" id="nse-prevs">'+bic('back')
      +' Previous</button>'
      +'<button class="dbtn" id="nse-nexts">'+bic('arrow')
      +' Next</button>'
      +'<button class="dbtn" id="nse-done">'+bic('exit')+' Done</button>'
      +'</div>'
      +'<div class="nse-body">'
      +'<div class="nse-left">'
      +'<span class="nse-lab">this slide</span>'
      +'<div class="nse-slide" id="nse-slide"></div>'
      +'<span class="nse-lab">what markdown does here</span>'
      +'<div class="nse-help">'
      +'<code>**bold**</code> <code>*italic*</code> <code>`code`</code>'
      +' <code># heading</code> <code>- bullet</code> <code>1. step</code>'
      +' <code>&gt; quote</code><br>'
      +'<code>[the paper](https://…)</code> links out, '
      +'<code>[the method](#7)</code> jumps to slide 7 in the presenter '
      +'view, and <code>{fig:id}</code> prints that figure’s number '
      +'so it stays right when they are renumbered.'
      +'</div></div>'
      +'<div class="nse-write">'
      +'<span class="nse-lab">notes — only you ever see these</span>'
      +'<textarea id="nse-ta" class="nse-ta" spellcheck="true"'
      +' placeholder="What you want to say here."></textarea></div>'
      +'<div class="nse-read">'
      +'<span class="nse-lab">how it will read</span>'
      +'<div class="nse-prev jvn-md" id="nse-prev"></div></div>'
      +'</div>';
    document.body.appendChild(ov);
    ov.querySelector('#nse-done').addEventListener('click',notesEdClose);
    ov.querySelector('#nse-prevs').addEventListener('click',function(){
      notesEdGo(-1);});
    ov.querySelector('#nse-nexts').addEventListener('click',function(){
      notesEdGo(1);});
    var ta=ov.querySelector('#nse-ta');
    ta.addEventListener('input',function(){
      var sl=(pres.slides||[])[notesEdIdx]; if(!sl) return;
      if(ta.value.trim()) sl.notes=ta.value; else delete sl.notes;
      markDirty();
      var pv=ov.querySelector('#nse-prev');
      if(pv) pv.innerHTML=notesHtml(sl.notes||'')
        ||'<p class="nse-none">Nothing yet.</p>';
      presenterSync&&presenterSync();
    });
    /* a slide reference works in the preview too, so you can check it */
    ov.querySelector('#nse-prev').addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('.jvn-goto');
      if(!a) return;
      e.preventDefault();
      var to=(+a.dataset.slide||1)-1;
      if((pres.slides||[])[to]){notesEdIdx=to;cur=to;refresh();
        notesEdFill();}
    });
    notesEdFill();
    ta.focus();
    document.addEventListener('keydown',notesEdKey,true);
  }
  /* ---- WHAT A REHEARSAL LEAVES BEHIND ---------------------------------
     (TASKS T29.) "Record per-slide and per-section times across
     rehearsal runs; show stats (slide 17 averages 3:42)."

     1. A SLIDE HAD NO NAME. Every annot has had an `oid` since T10, but
        a SLIDE has only ever been an index — and an index is worthless
        here, because the entire value of the feature is comparing runs
        made days apart, across which you will have inserted, deleted
        and reordered slides. So slides get `sid`, minted lazily the
        first time you rehearse, exactly as oids are minted on first
        sight rather than at creation.

        AND IT IS THE OPPOSITE RULE TO oid, deliberately. `ensureOids`
        de-duplicates within a slide but not across them, so a duplicated
        SLIDE keeps its oids and T27 can match the objects. `ensureSids`
        de-duplicates across the whole deck, so a duplicated slide gets a
        FRESH sid — because a copy is a different slide that you will
        spend a different amount of time on. Same mechanism, opposite
        scope, because the two questions are opposite.

     2. THE HISTORY IS NOT IN THE DECK FILE. Three reasons, in order of
        how much they matter: sending someone your deck must not send
        them the fact that you spent 4:12 stuck on slide 3; the history
        grows every run while a deck in localStorage has a quota that
        has bitten this project before (see the embedded-snapshot note);
        and it is the argument `showCut` and `matchPick` already made —
        what you are doing with the deck today is not a property of the
        document. It lives beside the deck under the same key, so
        renaming a deck starts its history over, which is honest: the
        store is keyed the way everything else here is keyed.

     3. NOT EVERY RUN IS A REHEARSAL. Opening present mode to check a
        colour and pressing Escape is not a data point, and averaging it
        in would quietly halve every number on this page. A run is kept
        when it reached a second slide AND lasted half a minute; anything
        shorter is dropped, and the pane says so rather than silently
        recording nothing.

     4. THE CAP IS SAID OUT LOUD. The last REH_KEEP runs are kept and the
        pane names that number, because a stat over "your runs" that
        silently means "your last twelve runs" is a stat that lies. */
  var REH_KEEP=12, REH_MIN_SEC=30;
  function rehKey(){return 'jvreh:'+SCOPE+':'+(pres.name||'untitled');}
  function rehRuns(){
    try{
      var v=JSON.parse(lsGet(rehKey())||'[]');
      return Array.isArray(v)?v:[];
    }catch(e){return [];}
  }
  function rehSave(runs){
    try{lsSet(rehKey(),JSON.stringify(runs.slice(-REH_KEEP)));}
    catch(e){}
  }
  /* deck-wide de-duplication, which is what makes a duplicated slide a
     new slide here while T27's oids make a duplicated object the same
     object there */
  function ensureSids(){
    var seen={},minted=0;
    (pres.slides||[]).forEach(function(sl){
      if(!sl) return;
      if(!sl.sid||seen[sl.sid]){
        sl.sid='s'+Math.random().toString(36).slice(2,8);minted++;
      }
      seen[sl.sid]=1;
    });
    /* MINTING IS A CHANGE TO THE DECK, and saying so is the whole point:
       a name that is not written down is minted again next session, and
       then every run recorded against the old one is orphaned. */
    if(minted) markDirty();
  }
  var rehOn=false,rehAt=0,rehSpent=null,rehSid='',rehSeen=0;
  function rehMark(){
    if(!rehOn||!rehAt) return;
    var dt=Math.max(0,Math.round((Date.now()-rehAt)/1000));
    if(rehSid) rehSpent[rehSid]=(rehSpent[rehSid]||0)+dt;
    rehAt=Date.now();
  }
  /* the slide changed: the time so far belongs to the one you are
     leaving. Called from go(), which is the one place a slide changes. */
  function rehSlideChanged(){
    if(!rehOn) return;
    rehMark();
    var sl=(pres.slides||[])[cur];
    rehSid=(sl&&sl.sid)||'';
    if(rehSid&&!rehSpent[rehSid]) rehSeen++;
  }
  function rehStart(){
    if(rehOn) return;
    ensureSids();          /* lazily, so a deck that never rehearses
                              never grows the field */
    rehOn=true;rehSpent={};rehSeen=1;rehAt=Date.now();
    var sl=(pres.slides||[])[cur];
    rehSid=(sl&&sl.sid)||'';
  }
  function rehPause(){rehMark();rehAt=0;}
  function rehResume(){if(rehOn) rehAt=Date.now();}
  function rehStop(){
    if(!rehOn) return;
    rehMark();
    rehOn=false;
    var spent=rehSpent||{};rehSpent=null;rehAt=0;
    var total=0;
    Object.keys(spent).forEach(function(k){total+=spent[k];});
    /* a run that never left the first slide, or lasted under half a
       minute, is someone checking a colour -- not a rehearsal */
    if(rehSeen<2||total<REH_MIN_SEC){
      if(total>2) toast('Too short to record as a rehearsal');
      return;
    }
    var runs=rehRuns();
    runs.push({at:Date.now(),total:total,s:spent});
    rehSave(runs);
    toast('Rehearsal recorded — '+fmtMins(total/60)+' over '
      +rehSeen+' slide'+(rehSeen===1?'':'s'));
    renderNotesPane();
  }
  /* mean seconds per slide, by sid, across every kept run */
  function rehStats(){
    var acc={},runs=rehRuns();
    runs.forEach(function(r){
      Object.keys(r.s||{}).forEach(function(sid){
        var a=acc[sid]||(acc[sid]={n:0,sum:0,last:0});
        a.n++;a.sum+=r.s[sid];a.last=r.s[sid];
      });
    });
    Object.keys(acc).forEach(function(k){
      acc[k].mean=acc[k].sum/acc[k].n;});
    return {runs:runs,by:acc};
  }
  function rehFor(sl){
    if(!sl||!sl.sid) return null;
    var a=rehStats().by[sl.sid];
    return (a&&a.n)?a:null;
  }
