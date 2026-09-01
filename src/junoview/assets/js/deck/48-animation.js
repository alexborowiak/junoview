  /* ---- ANIMATION: the effect, the build order, and the pane ---------
     Lifted out of 45-images.js on 2026-09-01 (T158), which had grown to
     hold images, crop, the transient-overlay owner, transitions AND all
     of this. Nothing here changed in the move except the two lines that
     stop it booting itself.

     IT USED TO BE AN EXECUTING SUB-IIFE -- `(function(){...})()` right
     here in the middle of a part -- which is the pattern that silently
     killed the whole editor at boot in T133: a throw inside one of those
     takes the enclosing IIFE with it, and every later declaration in
     every later part simply never happens. Its body is now `animBoot()`,
     called from THE BOOT SEQUENCE with the rest, where a failure is
     visible and lands beside its siblings. The early `return` on missing
     markup is kept verbatim: a poster has no animation group. ---- */
  var animPaneSync=function(){},animPaneClose=function(){};
  var animRibbonSync=function(){};
  function animBoot(){
    var vbtn=$('#vw-anim'),pane=$('#animpane');
    var menu=$('#animpane-body'),cl=$('#animpane-close');
    if(!vbtn||!pane||!menu) return;
    menu.classList.add('anim-pane');
    function rerender(){
      var s=pres.slides[cur],l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s);paintSel(l);}
    }
    function renumber(s){animSeq(s).forEach(function(st,i){
      st.items.forEach(function(idx){s.annots[idx].anim.order=i;});});}
    function stepOf(s,idx){var r=-1;animSeq(s).forEach(function(st,i){
      if(st.items.indexOf(idx)>=0) r=i;});return r;}
    /* AND THE STRIP. The filmstrip's build mark is the only thing that
       says a slide is animated once the Timeline pane is shut (T76), and
       until this it was drawn on the next re-render of the strip and not
       before -- so animating something left the strip claiming the slide
       was plain until you happened to add a slide or reorder one. Every
       change to an animation on this slide goes through here, which is
       why it belongs here rather than at each of the seven callers. */
    /* ...and animRibbonSync, or the RIBBON KEEPS THE OLD ANSWER (T156).
       `render` here is the PANE's render; nothing on this path told the
       ribbon. So clicking Fade left None lit, and the highlight only
       corrected itself when you re-selected the object -- you pressed the
       button, nothing moved, and the honest reading was that it had not
       worked. Every change to an animation goes through here, which is
       exactly why the sync belongs here and not at each of the callers. */
    function commit(s){markDirty();rerender();render();renderFilm();
      if(typeof animRibbonSync==='function') animRibbonSync();}
    function setType(type){
      var s=pres.slides[cur]; if(!s) return;
      var idxs=selIdxs();
      var no=nextAnimOrder(s);            /* new anims share one build step */
      idxs.forEach(function(i){var a=s.annots[i]; if(!a) return;
        if(type==='none') delete a.anim;
        else if(a.anim) a.anim.type=type;
        else a.anim={type:type,order:no};});
      commit(s);
    }
    function mergeUp(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      if(!a||!a.anim) return;var q=animSeq(s),si=stepOf(s,selAnnot);
      if(si>0){a.anim.order=q[si-1].order;renumber(s);commit(s);}
    }
    function splitOwn(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      if(!a||!a.anim) return;
      a.anim.order=(a.anim.order||0)+0.5;renumber(s);commit(s);
    }
    function moveStep(si,dir){
      var s=pres.slides[cur],q=animSeq(s),tj=si+dir;
      if(tj<0||tj>=q.length) return;
      var oa=q[si].order,ob=q[tj].order;
      q[si].items.forEach(function(i){s.annots[i].anim.order=ob;});
      q[tj].items.forEach(function(i){s.annots[i].anim.order=oa;});
      renumber(s);commit(s);
    }
    function render(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      menu.innerHTML='';
      var h1=document.createElement('div');h1.className='anim-h';
      h1.textContent='Entrance effect';menu.appendChild(h1);
      if(!a||typeof selAnnot!=='number'){
        var em=document.createElement('div');em.className='anim-empty';
        em.textContent='Select an item first, then pick an effect.';
        menu.appendChild(em);
      } else {
        var eff=document.createElement('div');eff.className='anim-eff';
        [['none','None'],['appear','Appear'],['fade','Fade'],
         ['rise','Rise'],['zoom','Zoom']].forEach(function(p){
          var b=document.createElement('button');b.className='anim-effb';
          b.textContent=p[1];
          if((a.anim?a.anim.type:'none')===p[0]) b.classList.add('on');
          b.addEventListener('click',function(e){e.stopPropagation();
            setType(p[0]);});
          eff.appendChild(b);});
        menu.appendChild(eff);
        if(a.anim){
          var si0=stepOf(s,selAnnot),q0=animSeq(s);
          var mrow=document.createElement('div');mrow.className='anim-merge';
          var mb=document.createElement('button');mb.className='anim-mini wide';
          mb.textContent='↑ Appear with previous';mb.disabled=(si0<=0);
          mb.title='Reveal this on the same click as the build above';
          mb.addEventListener('click',function(e){e.stopPropagation();
            mergeUp();});
          mrow.appendChild(mb);
          if(q0[si0]&&q0[si0].items.length>1){
            var sb=document.createElement('button');sb.className='anim-mini wide';
            sb.textContent='↓ Own click';
            sb.addEventListener('click',function(e){e.stopPropagation();
              splitOwn();});
            mrow.appendChild(sb);
          }
          menu.appendChild(mrow);
        }
      }
      var h2=document.createElement('div');h2.className='anim-h';
      h2.textContent='Build order — each row is one click';
      menu.appendChild(h2);
      var seq=animSeq(s);
      if(!seq.length){
        var e2=document.createElement('div');e2.className='anim-empty';
        e2.textContent='Nothing animated on this slide yet.';
        menu.appendChild(e2);
      } else {
        var list=document.createElement('div');list.className='anim-seq';
        seq.forEach(function(st,si){
          var row=document.createElement('div');row.className='anim-step';
          var n=document.createElement('span');n.className='anim-num';
          n.textContent=(si+1);row.appendChild(n);
          var chips=document.createElement('span');chips.className='anim-chips';
          st.items.forEach(function(idx){
            var c=document.createElement('span');
            c.className='anim-chip'+(idx===selAnnot?' cur':'');
            c.textContent=itemLabel(s,idx)+' · '
              +((s.annots[idx].anim.type)||'fade');
            c.addEventListener('click',function(e){e.stopPropagation();
              var l=stage.querySelector('.annot-layer');
              if(l) selectAnnot(l,idx); render();});
            chips.appendChild(c);});
          row.appendChild(chips);
          var ctr=document.createElement('span');ctr.className='anim-stepctr';
          [['↑',-1],['↓',1]].forEach(function(m){
            var b=document.createElement('button');b.className='anim-mini';
            b.textContent=m[0];
            b.title=m[1]<0?'Move this build earlier':'Move this build later';
            b.setAttribute('aria-label',b.title);
            b.disabled=(m[1]<0?si===0:si===seq.length-1);
            b.addEventListener('click',function(e){e.stopPropagation();
              moveStep(si,m[1]);});
            ctr.appendChild(b);});
          row.appendChild(ctr);
          list.appendChild(row);});
        menu.appendChild(list);
      }
      /* the order "One by one" deals the clicks in (T106) */
      var rb=document.createElement('button');
      rb.className='anim-mini wide';
      rb.textContent='Reading order\u2026';
      rb.title='One by one reveals in READING order \u2014 top to '
        +'bottom unless you set your own. Figure numbers and the '
        +'review outline follow the same order.';
      rb.addEventListener('click',function(e){e.stopPropagation();
        if(window.SemDeckReadingOrder) window.SemDeckReadingOrder();});
      menu.appendChild(rb);
    }
    /* ONE door. There were briefly two — View's Animations and an
       "Animate" button in an Effects group that renamed itself to the
       selected item's effect. Same pane, different groups, different
       names, both pressed at once (2026-08-17, user: "WHY IS ANIMATIONS
       AND APPEAR NOT IN THE SAME PLACE"). The pane's effect chooser
       already tracks the selection, which is everything the second
       button ever added. */
    function set(open){
      if(open){paneShow('animpane');render();}
      else paneHide('animpane');
    }
    vbtn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    if(cl) cl.addEventListener('click',function(){set(false);});
    /* the effect chooser at the top tracks the selection, so an open pane
       has to follow it rather than showing whatever was picked last */
    animPaneSync=function(){if(!pane.hidden) render();};
    animPaneClose=function(){set(false);};
    /* ---- the Animate TAB's own buttons --------------------------------
       "There doesn't seem to be a way to remove animations" (2026-08-20,
       user) — there was one, the None effect, but it was inside a pane
       you had to know to open, with an item selected, and it looked like
       any other effect rather than like a removal. The effects are now
       buttons in the ribbon where you can see which one is on, None reads
       as the undo it is, and Clear slide strips the whole slide in one
       press without hunting item by item. */
    [['anim-none','none'],['anim-fade','fade'],
     ['anim-rise','rise'],['anim-zoom','zoom']].forEach(function(p){
      var b=$('#'+p[0]);
      if(b) b.addEventListener('click',function(){setType(p[1]);});
    });
    /* ---- the two builds anyone actually wants ------------------------
       Setting "one at a time" by hand means selecting every item on the
       slide and stepping its build order one at a time, which is exactly
       the fiddling this editor exists to remove (2026-08-20).
       Reading order, not array order: the array is the order you happened
       to draw things in, which is nobody's idea of a sequence. */
    /* orderedIdx is at the top of the file now: figure NUMBERS read the
       same order (T18), and a figure numbered differently from the way
       it builds would be two answers to one question. */
    var stag=$('#anim-stagger');
    if(stag) stag.addEventListener('click',function(){
      var s2=pres.slides[cur]; if(!s2) return;
      var order=orderedIdx(s2);
      if(!order.length){toast('Nothing on this slide yet');return;}
      order.forEach(function(i,n){
        var a=s2.annots[i];
        a.anim={type:(a.anim&&a.anim.type)||'fade',order:n};
      });
      revealCount=0;commit(s2);
      toast(order.length+' items, one click each \u2014 in reading order');
    });
    var tog=$('#anim-together');
    if(tog) tog.addEventListener('click',function(){
      var s2=pres.slides[cur]; if(!s2) return;
      var order=orderedIdx(s2);
      if(!order.length){toast('Nothing on this slide yet');return;}
      order.forEach(function(i){
        var a=s2.annots[i];
        a.anim={type:(a.anim&&a.anim.type)||'fade',order:0};
      });
      revealCount=0;commit(s2);
      toast('Everything appears on one click');
    });
    var clr=$('#anim-clear');
    if(clr) clr.addEventListener('click',function(){
      var s=pres.slides[cur]; if(!s) return;
      var n=0;
      (s.annots||[]).forEach(function(a){if(a&&a.anim){delete a.anim;n++;}});
      if(!n){toast('Nothing on this slide is animated');return;}
      revealCount=0;commit(s);
      toast('Cleared '+n+(n===1?' animation':' animations')
        +' — everything is on the slide from the start');
    });
    /* the effect buttons act on the SELECTION, so they show the selected
       item's effect and stand down when there is nothing selected */
    animRibbonSync=function(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      var on=!!a&&typeof selAnnot==='number';
      [['anim-none','none'],['anim-fade','fade'],
       ['anim-rise','rise'],['anim-zoom','zoom']].forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        b.hidden=!on;
        b.setAttribute('aria-pressed',
          (on&&(a.anim?a.anim.type:'none')===p[1]).toString());
      });
    };
  }
