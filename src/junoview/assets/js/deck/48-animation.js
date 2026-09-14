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
  /* T445: opened by arming Quick animate, which now lives in it */
  var animPaneOpen=function(){};
  /* setType and its re-render live inside animBoot's closure, so the
     GALLERY -- which boots separately -- cannot reach them. Published
     the same way the pane's syncs already are, rather than duplicating
     the write (T171). Caught by driving: the first pick threw
     "rerender is not defined" and nothing happened. */
  var animSetType=function(){};
  var animRibbonSync=function(){};
  /* ---- CLICK THINGS IN THE ORDER THEY SHOULD APPEAR (T168) --------
     Asked for in the user's own words: "when you click it becomes the
     next thing that's animated... then if you hold down shift and click
     all those animations appear at the same time."

     It is the answer to the loudest complaint people make about
     PowerPoint's animation pane -- that ordering means dragging opaque
     blocks in a list that lags, silently fails and greys itself out.
     Ordering here is done ON THE OBJECTS, in the order you say them.

     Deliberately the same shape as matchArm (35-arranging.js): a state
     object, a class on the deck, a .pickbar, Escape to cancel, and a
     running count that names Ctrl+Z -- because a third way to run a
     picking mode would be a third thing to learn.

     THE WHOLE SESSION IS ONE UNDO STEP. markDirty() is called ONCE, at
     Finish, so Ctrl+Z takes back the sequence rather than the last
     click; the running count in the bar is what tells you where you are
     while it is open, and "Undo the last one" is the fine-grained
     escape. */
  var seqArm=null;
  function seqOn(){return !!seqArm;}
  /* WHICH DIGIT IS DOWN. A modifier that is a KEY rather than a
     mouse-button flag has to be tracked, because MouseEvent carries
     shift/ctrl/alt/meta and nothing else. Held only while the mode is
     armed, cleared when it ends, and swallowed so a digit cannot also
     mean whatever else a digit means in the editor. */
  var seqDigit=0;
  /* THE EFFECT THE NEXT CLICK GIVES, and the letter that picks it. The
     mode wrote 'fade' for everything, so sequencing in any other effect
     meant going round a second time. Keys are the first letter of what
     is on screen wherever that is free -- F fade, A appear, N none, G
     grow (zoom's word collides with the canvas magnifier three groups
     away), U float up -- and every one is PRINTED ON ITS BUTTON,
     because a mode whose shortcuts are invisible has no shortcuts. */
  var SEQ_FX=[['none','None','N'],['appear','Appear','A'],
    ['fade','Fade','F'],['rise','Float up','U'],['zoom','Grow','G'],
    /* T385: three more ways in (2026-09-12, user: "the big thing in
       websites is people having cool animations ... text typing out
       like a type writer ... page turn or it flies in"). Typewriter is
       for words: on anything else it plays as a fade. */
    ['slide','Fly in','L'],['turn','Page turn','P'],
    ['type','Typewriter','T']];
  /* ---- T385: MOTION THAT KEEPS GOING --------------------------------
     An entrance plays once. These loop for as long as the object is on
     the slide, in the show only (2026-09-12, user: "things wobbling
     and moving"). Stored as a.motion; the renderer puts one class on
     the item and the keyframes do the rest, so an exported page keeps
     it too. Reduced motion turns them off, as it does every keyframe. */
  /* the ribbon keeps the four commonest; every one of the thirteen,
     and every number on them, is in the Animation panel (T445) */
  var MOTION_FX=[['','None'],['wobble','Wobble'],['bob','Float'],
    ['pulse','Pulse']];
  function motionId(v){return '#anim-move-'+(v||'none');}
  function motionItems(){
    var s=pres.slides[cur],out=[];
    selIdxs().forEach(function(i){
      var x=(s&&s.annots||[])[i]; if(x) out.push(x);});
    return out;
  }
  var motionPvT=null,motionPvEls=[];
  function motionPreviewStop(){
    if(motionPvT){clearTimeout(motionPvT);motionPvT=null;}
    motionPvEls.forEach(function(el){
      /* T445: thirteen movements, so the class is found rather than
         listed; an-mo-preview is what let it play while selected */
      el.className=el.className.replace(/\ban-move-[a-z]+\b/g,'').trim();
      el.classList.remove('an-mo-preview');
      /* ...and the real one is painted back, if it has one */
      var s=pres.slides[cur],i=+el.getAttribute('data-idx');
      var a=(s&&s.annots||[])[i];
      if(a&&a.motion){
        el.classList.add('an-move-'+a.motion);
        if(typeof motionPaint==='function') motionPaint(el,a);
      } else el.style.animation='';
    });
    motionPvEls=[];
  }
  function motionPreview(v){
    motionPreviewStop();
    if(!v||!motionOK()) return;
    var layer=stage&&stage.querySelector('.annot-layer'); if(!layer) return;
    selIdxs().slice(0,8).forEach(function(i){
      var el=layer.querySelector('.an-item[data-idx="'+i+'"]');
      if(!el) return;
      el.className=el.className.replace(/\ban-move-[a-z]+\b/g,'').trim();
      el.classList.add('an-move-'+v,'an-mo-preview');
      /* the object's OWN numbers, so a preview is what you will get */
      var s2=pres.slides[cur],a2=(s2&&s2.annots||[])[i];
      if(a2&&a2.motion===v&&typeof motionPaint==='function')
        motionPaint(el,a2);
      else el.style.animation='';
      motionPvEls.push(el);
    });
    motionPvT=setTimeout(motionPreviewStop,2400);
  }
  function motionBoot(){
    MOTION_FX.forEach(function(pr){
      var b=$(motionId(pr[0])); if(!b) return;
      b.addEventListener('mouseenter',function(){motionPreview(pr[0]);});
      b.addEventListener('mouseleave',motionPreviewStop);
      b.addEventListener('click',function(e){
        e.stopPropagation();motionPreviewStop();
        var items=motionItems(); if(!items.length) return;
        items.forEach(function(a){
          if(pr[0]) a.motion=pr[0]; else delete a.motion;});
        markDirty();renderSlide();
        if(typeof animRibbonSync==='function') animRibbonSync();
      });
    });
  }
  function motionSync(){
    var items=motionItems(),on=items.length>0;
    var now=on?(items[0].motion||''):null;
    MOTION_FX.forEach(function(pr){
      var b=$(motionId(pr[0])); if(!b) return;
      b.disabled=!on;
      b.setAttribute('aria-pressed',(on&&now===pr[0]).toString());
    });
  }
  /* ---- T385: THE TYPEWRITER ------------------------------------------
     The words are already in the DOM (the model is never split); the
     effect empties every text node under the item and puts the
     characters back a few at a time, so bold runs, links and bullets
     type out in place. Bounded at about two and a half seconds however
     long the box is, and every text node is restored whole at the end
     -- or at once if the item leaves the page under it. One run at a
     time: a re-render mid-way starts again from the newest state. */
  var typeRun=null;
  function typeStop(){
    if(!typeRun) return;
    clearInterval(typeRun.t);
    typeRun.nodes.forEach(function(n){n.node.textContent=n.text;});
    typeRun.el.classList.remove('an-typing');
    typeRun=null;
  }
  function typeInto(el){
    typeStop();
    if(!el||!motionOK()) return;
    var host=el.querySelector('.an-tx')||el;
    var nodes=[];
    var walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
    var n;
    while((n=walker.nextNode())){
      if(n.textContent) nodes.push({node:n,text:n.textContent});}
    var total=0;
    nodes.forEach(function(x){total+=x.text.length;});
    if(!total) return;
    nodes.forEach(function(x){x.node.textContent='';});
    var per=Math.max(1,Math.ceil(total/100)),shown=0;
    el.classList.add('an-typing');
    typeRun={el:el,nodes:nodes,t:0};
    typeRun.t=setInterval(function(){
      if(!el.isConnected){typeStop();return;}
      shown+=per;
      var left=shown;
      nodes.forEach(function(x){
        var take=Math.max(0,Math.min(x.text.length,left));
        x.node.textContent=x.text.slice(0,take);
        left-=x.text.length;
      });
      if(shown>=total) typeStop();
    },25);
  }
  /* ---- T238: DISAPPEAR, WHERE ANIMATION IS -----------------------------
     The exit has existed since T174 and had one door: a popover inside
     the Layers pane's build column (2026-09-04, user: "animations is
     missing dissapear"). The verb and its choices are the pane's --
     one implementation, two doors -- and the button does the case you
     want nine times out of ten. */
  function animOutItem(){
    var s=pres.slides[cur];
    if(typeof selAnnot!=='number') return null;
    return annotByIdx(s,selAnnot)||null;
  }
  function animOutBoot(){
    var b=$('#anim-out');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();
      var s=pres.slides[cur],a=animOutItem(); if(!a) return;
      if(animOut(a)!=null) delete a.out;
      else a.out=nextAnimOrder(s);
      markDirty();refresh();
      /* refresh() does not re-run the ribbon's own sync -- that
         happens on a SELECTION change, and this is not one, so the
         button reported the state it had before its own click */
      animRibbonSync();
      if(typeof animPaneSync==='function') animPaneSync();
    });
    var c=$('#anim-out-caret'),m=$('#anim-out-menu');
    if(c&&m) c.addEventListener('click',function(e){
      e.stopPropagation();
      if(!m.hidden){overlayHide(m);return;}
      animOutMenu(m);
      overlayShow(c,m);floatMenu(c,m);
    });
  }
  function animOutMenu(m){
    m.innerHTML='';
    var s=pres.slides[cur],a=animOutItem(); if(!a) return;
    var now=animOut(a);
    function row(txt,tip,ic,on,fn){
      var b=document.createElement('button');
      b.className='dbtn sh-opt';b.type='button';
      b.innerHTML=bic(ic)+' '+esc(txt);
      b.title=tip;
      b.setAttribute('aria-pressed',on?'true':'false');
      b.addEventListener('click',function(e){
        e.stopPropagation();overlayHide(m);fn();
        markDirty();refresh();animRibbonSync();
        if(typeof animPaneSync==='function') animPaneSync();
      });
      m.appendChild(b);
    }
    menuHead(m,'when it goes');
    row('Stays on the slide',
      'What every object did before this existed','none',now==null,
      function(){delete a.out;});
    var mine=a.anim?(a.anim.order||0):-1,offered={};
    animSeq(s).forEach(function(st){
      if(st.order<=mine||offered[st.order]) return;
      offered[st.order]=1;
      var who=st.items.map(function(i2){
        return annotLabel((s.annots||[])[i2]);
      }).join(', ').slice(0,34);
      row('Goes when '+who+' arrives',
        'One click: that arrives, this goes \u2014 which is what '
        +'replacing a picture actually is','exit',now===st.order,
        function(){a.out=st.order;});
    });
    row('Goes on one more click at the end',
      'Adds a click of its own, on which this object leaves and '
      +'nothing arrives','exit',now!=null&&!offered[now],
      function(){a.out=nextAnimOrder(s);});
  }
  function animOutSync(){
    var wrap=$('#anim-outwrap'),say=$('#anim-out-say');
    var s=pres.slides[cur],a=animOutItem();
    var poster=!!(pageOf&&pageOf().poster);
    if(wrap) wrap.hidden=!a||poster;
    if(say) say.hidden=!a||poster;
    if(!a||poster) return;
    var now=animOut(a),b=$('#anim-out');
    if(b) b.setAttribute('aria-pressed',(now!=null).toString());
    if(say){
      say.innerHTML='<span>Leaves</span><span><b></b></span>';
      var inf=(now!=null&&typeof spStepInfo==='function')
        ?spStepInfo(s,a):null;
      say.querySelector('b').textContent=now==null?'never'
        :((inf&&inf.out!=null)?('on click '+inf.out):'on a click');
    }
  }
  /* ---- T234: A FLIP BOOK'S PAGES ARE ANIMATION ------------------------
     Every figure after the first has always eaten a click -- extraStops
     counts them, flipPlan sequences them, and the Animations pane lists
     them under the book. What was missing was any sign of it on the
     Animation tab, and any way for a page to ARRIVE rather than simply
     replace the one before (2026-09-04, user: "how do the animations
     work with the flip books. Can there be a make each flip an
     animation that appears in animations when selected"). The stored
     value is a.fanim and the renderer turns it into one CSS keyframe on
     the frame that changed, so it plays in the show and in an exported
     page alike. The words are SEQ_FX's, minus Appear -- for a page turn
     "appear" and "none" are the same thing. */
  var FLIP_FX=[['','None'],['fade','Fade'],['rise','Float up'],
    ['zoom','Grow'],
    /* T385: a page that TURNS, and one that pushes the last one out
       (2026-09-12, user: "one image swapping with another with some
       kind of animation like a page turn or it flies in and moves the
       other out of the way") */
    ['turn','Page turn'],['push','Push']];
  function flipFxWord(v){
    var out='';
    FLIP_FX.forEach(function(p){if(p[0]===v) out=p[1];});
    return out;
  }
  function flipFxItem(){
    var s=pres.slides[cur],out=null;
    selIdxs().forEach(function(i){
      var x=(s&&s.annots||[])[i];
      if(!out&&x&&x.k==='flip') out=x;});
    return out;
  }
  function flipFxId(v){return '#anim-flip-'+(v||'none');}
  function flipFxBoot(){
    FLIP_FX.forEach(function(pr){
      var b=$(flipFxId(pr[0]));
      if(!b) return;
      b.addEventListener('click',function(e){
        e.stopPropagation();
        var a=flipFxItem(); if(!a) return;
        if(pr[0]) a.fanim=pr[0]; else delete a.fanim;
        markDirty();renderSlide();
        if(typeof animRibbonSync==='function') animRibbonSync();
        if(typeof animPaneSync==='function') animPaneSync();
      });
    });
  }
  function flipFxSync(){
    var run=$('#anim-flip-run'),say=$('#anim-flip-say');
    var a=flipFxItem();
    if(run) run.hidden=!a;
    if(say) say.hidden=!a;
    if(!a) return;
    var now=a.fanim||'';
    FLIP_FX.forEach(function(pr){
      var b=$(flipFxId(pr[0]));
      if(b) b.setAttribute('aria-pressed',(now===pr[0]).toString());
    });
    if(say){
      var n=flipFrames(a).length,clicks=Math.max(0,n-1);
      say.innerHTML='<span>In the show</span><span><b></b></span>';
      say.querySelector('b').textContent=n
        ?(n+' figure'+(n===1?'':'s')+' \u00b7 '+clicks+' click'
          +(clicks===1?'':'s'))
        :'no figures yet';
    }
  }
  var seqType='fade';
  function seqKeyDown(e){
    if(!seqArm) return;
    if(e.key>='0'&&e.key<='9'){
      seqDigit=+e.key;e.preventDefault();seqSync();
      return;
    }
    var k=String(e.key||'').toUpperCase();
    for(var q=0;q<SEQ_FX.length;q++) if(SEQ_FX[q][2]===k){
      seqType=SEQ_FX[q][0];e.preventDefault();seqSync();return;
    }
  }
  function seqKeyUp(e){
    if(!seqArm) return;
    if(e.key>='0'&&e.key<='9'&&+e.key===seqDigit){seqDigit=0;seqSync();}
  }
  function seqArmStart(){
    var s=pres.slides[cur]; if(!s) return;
    /* the numbering starts AFTER whatever the slide already has, so
       arming does not silently re-order builds you made earlier */
    seqArm={slide:cur,n:0,base:nextAnimOrder(s),hits:[],
      before:JSON.stringify(s.annots||[])};
    deckEl.classList.add('seqing');
    /* the controls are a group of the Animation tab (T180), so the
       mode takes you there; a layout without that tab keeps you
       where you are and Escape still cancels */
    if(typeof setTab==='function') setTab('animation');
    seqDigit=0;
    document.addEventListener('keydown',seqKeyDown,true);
    document.addEventListener('keyup',seqKeyUp,true);
    seqSync();
  }
  function seqEnd(commitIt){
    if(!seqArm) return;
    var n=seqArm.n,hits=seqArm.hits.length,s=pres.slides[seqArm.slide];
    var hitList=seqArm.hits.slice();
    if(!commitIt&&s){
      /* Cancel puts the slide back exactly as it was: a mode that left
         half a sequence behind would be worse than no mode. */
      try{s.annots=JSON.parse(seqArm.before);}catch(e){}
    }
    seqArm=null;seqDigit=0;
    document.removeEventListener('keydown',seqKeyDown,true);
    document.removeEventListener('keyup',seqKeyUp,true);
    deckEl.classList.remove('seqing');
    seqSync();
    renderSlide();renderFilm();
    if(typeof animPaneSync==='function') animPaneSync();
    if(commitIt&&hits){
      /* THE ORDER YOU POINTED IS THE ORDER OF THE SLIDE (T181).
         Builds and the reading order were two orders set in two
         places, and the second had a panel nobody could read
         (2026-09-02, user: "what is reading order... I can't
         understand this at all and it is my idea"). One gesture
         now: the sequence you clicked is also `rord`, so figure
         numbers, One by one and the outline follow it. With the
         effect set to None it writes ONLY the order -- that is how
         you number things without animating them. Objects you did
         not click read last, in sweep order, as orderedIdx says. */
      if(s){
        ensureOids(s);
        var seen={},ro=[];
        hitList.forEach(function(h){
          var x=(s.annots||[])[h.i];
          if(x&&x.oid!=null&&!seen[x.oid]){seen[x.oid]=1;ro.push(x.oid);}
        });
        if(ro.length) s.rord=ro;
      }
      markDirty();
      /* BOTH numbers, because they part company the moment you
         shift-click: `hits` is what you pointed at, `n` is how many
         clicks it will take. Saying only one reads as a miscount to
         whoever did the other -- driven 2026-09-01, three objects in
         two clicks reported as "2 things". */
      toast(hits+(hits===1?' thing':' things')
        +(hits===n?'':(' in '+n+' click'+(n===1?'':'s')))
        +' in order \u2014 Ctrl+Z undoes the whole run');
    } else if(!commitIt&&hits){
      toast('Left as it was');
    }
  }
  /* one click: the next stop, or -- with shift -- the one just used */
  function seqHit(i,together){
    if(!seqArm) return;
    var s=pres.slides[seqArm.slide],a=(s&&s.annots||[])[i];
    if(!a) return;
    var ord;
    if(together&&seqArm.hits.length){
      ord=seqArm.hits[seqArm.hits.length-1].o;
    } else {
      ord=seqArm.base+seqArm.n;
      seqArm.n++;
    }
    /* the chosen effect, not a hardcoded fade (T170). An object that
       already has one keeps its own only when the mode has not been
       told otherwise -- picking an effect is an instruction. */
    if(a.anim) {a.anim.order=ord;a.anim.type=seqType;}
    else a.anim={type:seqType,order:ord};
    if(seqType==='none') delete a.anim;
    /* THE DIGIT SETS THE DELAY (T169). "Hold down 5 and click, it
       appears five seconds after the last." 0 clears one, which is how
       you take a delay back without leaving the mode. It goes on the
       whole STOP, not the object: a delay is a fact about when this
       click happens, and two objects arriving together cannot arrive at
       two different times. */
    if(!together){
      var delay=seqDigit;
      (s.annots||[]).forEach(function(x){
        if(x&&x.anim&&x.anim.order===ord){
          if(delay) x.anim.after=delay; else delete x.anim.after;
        }});
    }
    seqArm.hits.push({i:i,o:ord});
    renderSlide();
    seqSync();
  }
  function seqUndoOne(){
    if(!seqArm||!seqArm.hits.length) return;
    var h=seqArm.hits.pop();
    var s=pres.slides[seqArm.slide],a=(s&&s.annots||[])[h.i];
    if(a&&a.anim) delete a.anim;
    /* only step the counter back when that click had taken a NEW stop --
       a shift-click shared one and never advanced it */
    var still=seqArm.hits.some(function(x){return x.o===h.o;});
    if(!still&&seqArm.n) seqArm.n--;
    renderSlide();seqSync();
  }
  function seqSync(){
    /* T445: THE MODE'S OWN CONTROLS ARE THE PANEL'S NOW. They were
       three cells on the ribbon (T180), competing for the row at the
       one moment your attention belongs on the slide -- and the row is
       exactly what the user said was "getting squashed out of screen".
       Arming the mode opens the Animation panel; cfgSeq (48b-motion.js)
       draws the count, the effect chooser and the three verbs there.
       T452: "there" is the ORDER tab now, and arming switches the pane
       to it -- the mode writes the order, so the order is what you
       want to be watching while you point. */
    var on=!!seqArm;
    if(on&&typeof animPaneOpen==='function') animPaneOpen();
    if(on&&typeof animTabSet==='function') animTabSet('ord');
    if(typeof animCfgSync==='function') animCfgSync();
    /* the Timing group stands down while the mode is armed, and comes
       back with the selection when it ends (T185) */
    if(typeof animRibbonSync==='function') animRibbonSync();
    /* ...and so do the whole-slide shortcuts: they would fight the
       mode, and their group is the width the mode's own controls need
       (measured 20px over at 1400px with them showing, T186) */
    var poster=!!(pageOf&&pageOf().poster);
    ['anim-stagger','anim-together','anim-clear'].forEach(function(id){
      var el=$('#'+id); if(el) el.hidden=on||poster;});
    if(typeof syncRibbonGroups==='function') syncRibbonGroups();
  }
  /* ---- THE EFFECT GALLERY (T171) -----------------------------------
     One door, never hidden, opening a row of cards. SEQ_FX is the same
     list the sequencing bar uses, so the two surfaces cannot drift into
     two vocabularies.
     PICKING WITH NOTHING SELECTED DOES THE WHOLE SLIDE, one build each
     in reading order. That is what deletes the empty state -- the door
     always does something -- and it collapses "one at a time, in Grow"
     from eleven clicks to two. The footer says which it will be BEFORE
     you click, because a large silent edit from one card would be worse
     than no shortcut. */
  /* the gallery counts as an open workflow: selecting an object while
     it is up must not move the ribbon out from under it, exactly as
     T141 ruled for the panes */
  /* the gallery is a strip of tiles in the row now (T182); nothing
     is ever "open", and the Animation tab keeps the selection by
     name in showFmt instead */
  function animGalleryOpen(){return false;}
  /* ICONS, NAMED LITERALLY. bic() with a computed key works at runtime
     but is invisible to the icon contract, which scans for literal
     one-argument icon calls --
     and artwork with no visible consumer is exactly what that test
     exists to delete. Written out, the table is also the one place to
     read what a card looks like. */
  var FX_IC={none:'none',appear:'appear',fade:'fade',rise:'rise',
    zoom:'zoom',slide:'flyin',turn:'pageturn',type:'typewriter'};
  function fxIcon(t){
    if(t==='none') return bic('none');
    if(t==='appear') return bic('appear');
    if(t==='rise') return bic('rise');
    if(t==='zoom') return bic('zoom');
    if(t==='slide') return bic('flyin');
    if(t==='turn') return bic('pageturn');
    if(t==='type') return bic('typewriter');
    return bic('fade');
  }
  var galPvEls=[],galPvT=null;
  function galPreviewStop(){
    if(galPvT){clearTimeout(galPvT);galPvT=null;}
    galPvEls.forEach(function(el){
      el.classList.remove('an-anim-fade','an-anim-rise','an-anim-zoom',
        'an-anim-slide','an-anim-turn','an-anim-type');});
    galPvEls=[];
    typeStop();
  }
  /* the preview runs the REAL keyframe on the REAL object, so what you
     see is what you will get. Nothing is stored, so nothing to undo. */
  function galPreview(type){
    galPreviewStop();
    if(type==='none'||type==='appear') return;
    if(window.matchMedia&&
       window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var s=pres.slides[cur],layer=stage&&stage.querySelector('.annot-layer');
    if(!s||!layer) return;
    var idxs=selIdxs();
    if(!idxs.length) idxs=(s.annots||[]).map(function(_,i){return i;});
    idxs.slice(0,8).forEach(function(i){
      var a=(s.annots||[])[i]; if(!a||a.hide) return;
      var el=layer.querySelector('.an-item[data-idx="'+i+'"]');
      if(!el) return;
      /* re-adding a class already there does nothing, so it comes off,
         the element is reflowed, and it goes back on */
      el.classList.remove('an-anim-'+type);
      void el.offsetWidth;
      el.classList.add('an-anim-'+type);
      galPvEls.push(el);
      if(type==='type'&&a.k==='text') typeInto(el);
    });
    /* animationend is not reliable enough to be the only cleanup */
    galPvT=setTimeout(galPreviewStop,type==='type'?2800:900);
  }
  /* THE STRIP (T182): five tiles in the ribbon's own row, icon over
     word, the one that is on lit. Rebuilt rather than diffed -- five
     buttons are cheaper to redraw than to reconcile, and it has to
     follow the selection. DISABLED with nothing selected: an effect
     is a fact about a thing, and the whole-slide builds are the two
     worded buttons beside the strip. */
  function galSync(){
    var strip=$('#anim-strip'); if(!strip) return;
    var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
    var on=!!a&&typeof selAnnot==='number';
    var now=(a&&a.anim)?(a.anim.type||'fade'):(a?'none':null);
    strip.innerHTML='';
    SEQ_FX.forEach(function(f){
      var b=document.createElement('button');
      b.className='fx-tile'+(on&&now===f[0]?' on':'');
      b.type='button';
      b.disabled=!on;
      b.setAttribute('aria-pressed',on&&now===f[0]?'true':'false');
      b.innerHTML=fxIcon(f[0])+'<span>'+f[1]+'</span>';
      b.title=on
        ?(f[0]==='none'?'No entrance \u2014 on the slide from the start'
          :f[1]+' \u2014 hover to see it, click to give it')
        :'Select something on the slide first';
      b.addEventListener('mouseenter',function(){if(on) galPreview(f[0]);});
      b.addEventListener('focus',function(){if(on) galPreview(f[0]);});
      b.addEventListener('mouseleave',galPreviewStop);
      b.addEventListener('click',function(e){
        e.stopPropagation();galPreviewStop();
        if(on) animSetType(f[0]);});
      strip.appendChild(b);
    });
    var lab=$('#anim-strip-lab');
    /* just "Effect": the greyed tiles already say to select something
       (2026-09-02, user: "that is unnecessary text lol") */
    if(lab) lab.textContent='Effect';
  }
  function galBoot(){
    var strip=$('#anim-strip');
    if(!strip) return;
    galSync();
    strip.addEventListener('mouseleave',galPreviewStop);
    return;
    /* what follows is the popover's own wiring, kept only as the
       record of why the strip is not built through wireMenuToggle */
    var btn=null,menu=null;
    if(!btn||!menu) return;
    /* WIRED HERE RATHER THAN THROUGH wireMenuToggle, which takes id
       STRINGS and builds a selector out of them: handed the elements
       it threw a SyntaxError, and a throw in the boot sequence takes
       the rest of this IIFE with it -- overlayBoot, initReuseDoors and
       both ribbon-preference passes never ran, so the Insert ribbon's
       Chart button silently did nothing. Every test still passed; only
       clicking the button in a browser showed it (2026-09-01).
       The gallery also has to REDRAW as it opens -- the ticked effect
       is a fact about the current selection -- which is the other half
       of why it does not share that helper. */
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(menu.hidden){galSync();overlayShow(btn,menu);floatMenu(btn,menu);}
      else overlayHide(menu);
    });
    menu.addEventListener('mouseleave',galPreviewStop);
  }
  function seqBoot(){
    /* T445: the three verbs are the panel's buttons now (cfgSeq); the
       key that gets you out stays here because it is a key */
    /* Escape CANCELS rather than finishing: the key that gets you out of
       a mode should never be the key that commits it. Capture, so an
       overlay's own Escape handler cannot swallow it first. */
    document.addEventListener('keydown',function(e){
      if(!seqArm||e.key!=='Escape') return;
      e.preventDefault();e.stopPropagation();
      seqEnd(false);
    },true);
  }
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
    animSetType=function(t){setType(t);};
    /* ---- TIMING, AND HOW MUCH OF A TEXT BOX ARRIVES (T185) --------
       PowerPoint's Start box, on the model this deck already has:
       On click is a stop of its own; With previous is the pane's
       "Appear with previous" (mergeUp); After previous is T169's
       delay -- the stop runs itself that many seconds after the
       one before, no click -- which was reachable only by holding
       a digit in Quick animate. Every control is disabled until
       there is a selected build to time, and the group stands down
       while Quick animate has the row. The second row is T172's
       text builds, which lived only in the pane. */
    function setDelay(sec){
      var s=pres.slides[cur]; if(!s) return;
      var a=annotByIdx(s,selAnnot); if(!a||!a.anim) return;
      var ord=a.anim.order||0;
      /* the whole STOP carries it: two things arriving together
         cannot arrive at two different times (T169) */
      (s.annots||[]).forEach(function(x){
        if(x&&x.anim&&(x.anim.order||0)===ord){
          if(sec>0) x.anim.after=sec; else delete x.anim.after;}});
      commit(s);
    }
    function timingState(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      var num=typeof selAnnot==='number';
      var on=!!a&&num&&!!a.anim&&!pageOf().poster&&!seqOn();
      /* T401: `text` is "a text box is selected", full stop. It used to
         also require an animation, so a box on None showed no text
         tiles at all and the way to a bullet-by-bullet build was
         invisible (2026-09-13, user: "HOW DOES IT WORK THAT DOT POINT
         COME OUT ONE AT A TIME???? I CAN'T SEE ANY OF THE OPTIONS FOR
         TEXT!!!!!"). The tiles show for any text box; picking one gives
         the box an entrance (setBy). */
      if(!on) return {on:false,text:!!a&&num&&a.k==='text',by:'',hl:false};
      var q=animSeq(s),si=stepOf(s,selAnnot);
      var after=(a.anim.after)|0,shared=false;
      if(si>=0&&q[si].items.length>1){
        /* it joined an earlier thing's click if it is not the first
           of its stop in reading order */
        var first=null;
        orderedIdx(s).forEach(function(i){
          if(first===null&&q[si].items.indexOf(i)>=0) first=i;});
        shared=(first!==selAnnot);
      }
      return {on:true,si:si,after:after,shared:shared,
        mode:after?'after':(shared?'with':'click'),
        text:a.k==='text',
        by:(a.anim.by==='para'||a.anim.by==='sent')?a.anim.by:'',
        hl:!!a.anim.hl};
    }
    function timingSync(){
      var st=timingState(),poster=!!pageOf().poster,armed=seqOn();
      var start=$('#anim-start'),by=$('#anim-by');
      if(start) start.hidden=poster||armed;
      if(by) by.hidden=poster||armed||!st.text;
      [['anim-onclick','click'],['anim-withprev','with'],
       ['anim-afterprev','after']].forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        /* nothing to be "with" on the first build */
        b.disabled=!st.on||(p[1]==='with'&&st.si<=0&&st.mode!=='with');
        b.setAttribute('aria-pressed',(st.on&&st.mode===p[1]).toString());
      });
      /* T372: the CELL, not just the wrap inside it. While the start
         choice was a run the delay shared its column and an empty cell
         cost nothing; beside two full-height tile strips it is a column
         of its own, so an inapplicable delay was spending 96px of the
         row on nothing -- enough to fold this very group away at
         1600px. sizeRibbonGroups skips a hidden cell, so the column
         goes with it. */
      var dw=$('#anim-delaywrap'),di=$('#anim-delay'),dc=$('#anim-delaycell');
      if(dw) dw.hidden=!(st.on&&st.mode==='after');
      if(dc) dc.hidden=!(st.on&&st.mode==='after');
      if(di&&st.on&&st.mode==='after'&&document.activeElement!==di)
        di.value=st.after||1;
      /* T401: live for any selected text box, animated or not -- a box
         with no entrance IS "whole box", and By bullet is the click
         that gives it one */
      [['anim-by-all',''],['anim-by-para','para'],
       ['anim-by-sent','sent']].forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        b.disabled=!st.text;
        b.setAttribute('aria-pressed',
          (st.text&&st.by===p[1]).toString());
      });
      /* T385: highlight is a way of arriving piece by piece; T401 lets
         it be the first click too, and setBy-style it brings the
         entrance and the bullet split with it */
      var hb=$('#anim-by-hl');
      if(hb){
        hb.disabled=!st.text;
        hb.setAttribute('aria-pressed',(st.text&&st.hl).toString());
      }
      /* T418: the flip book that turns with each piece -- offered only
         for a box built in pieces, on a slide that has a book with
         pages to turn */
      var sc=$('#anim-synccell'),ss=$('#anim-sync');
      if(sc&&ss){
        var s2=pres.slides[cur],a2=annotByIdx(s2,selAnnot);
        var books=(st.text&&st.by&&!poster&&!armed)
          ?flipsOn(s2).filter(function(p){return flipFrames(p.a).length>1;})
          :[];
        sc.hidden=!books.length;
        if(books.length){
          var cur3=(a2&&a2.anim&&a2.anim.sync)||'';
          ss.innerHTML='';
          var o0=document.createElement('option');
          o0.value='';o0.textContent='no flip book';ss.appendChild(o0);
          books.forEach(function(p){
            if(!p.a.fid) p.a.fid=flipId();
            var o=document.createElement('option');
            o.value=p.a.fid;
            o.textContent=itemLabel(s2,p.i)+' ('+flipFrames(p.a).length
              +' pages)';
            if(p.a.fid===cur3) o.selected=true;
            ss.appendChild(o);
          });
          if(!cur3) ss.value='';
        }
      }
      var lab=$('#anim-timing-lab');
      if(lab) lab.textContent=st.text?'Timing & text':'Timing';
    }
    /* T418: figure k with piece k. Set on every selected box built in
       pieces; '' takes it off. The book keeps whatever entrance it has. */
    function setSync(fid){
      var s=pres.slides[cur]; if(!s) return;
      var n=0;
      selIdxs().forEach(function(i){
        var a=s.annots[i];
        if(!a||a.k!=='text'||!a.anim||!textBy(a)) return;
        if(fid) a.anim.sync=fid; else delete a.anim.sync;
        n++;
      });
      if(!n) return;
      revealCount=0;commit(s);
    }
    var ssel=$('#anim-sync');
    if(ssel) ssel.addEventListener('change',function(){setSync(ssel.value);});
    var ocb=$('#anim-onclick');
    if(ocb) ocb.addEventListener('click',function(e){
      e.stopPropagation();
      var st=timingState(); if(!st.on) return;
      if(st.shared) splitOwn();
      if(st.after) setDelay(0);
    });
    var wpb=$('#anim-withprev');
    if(wpb) wpb.addEventListener('click',function(e){
      e.stopPropagation();
      var st=timingState(); if(!st.on||st.si<=0) return;
      if(st.after) setDelay(0);
      if(!st.shared) mergeUp();
    });
    var apb=$('#anim-afterprev');
    if(apb) apb.addEventListener('click',function(e){
      e.stopPropagation();
      var st=timingState(); if(!st.on) return;
      if(st.shared) splitOwn();
      var di=$('#anim-delay');
      setDelay(Math.max(1,Math.min(60,(+(di&&di.value))||1)));
    });
    var din=$('#anim-delay');
    if(din){
      din.addEventListener('change',function(){
        var v=Math.max(1,Math.min(60,(+din.value)||1));
        din.value=v;setDelay(v);});
      din.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter'){e.preventDefault();din.blur();}});
    }
    [['anim-by-all',''],['anim-by-para','para'],
     ['anim-by-sent','sent']].forEach(function(p){
      var b=$('#'+p[0]); if(!b) return;
      b.addEventListener('click',function(e){
        e.stopPropagation();setBy(p[1]);});
    });
    /* ---- T385: HIGHLIGHT, DON'T HIDE ---------------------------------
       (2026-09-12, user: "instead of having text come out one at a
       time, something like one dot point is highlighted (larger, or
       different colour than the others) so you can still have all text
       out but there is a highlight animation"). The pieces and the
       stops are exactly Bullet-by-bullet's; only what a stop DOES
       changes -- nothing is held back, the piece whose stop this is
       lights up and the rest sit quiet. */
    /* T401: A BOX WITH NO ENTRANCE GETS ONE when a piece-wise build is
       asked of it -- Appear, on a fresh stop, exactly what setType
       gives a first click on the Effect strip. Asking a plain box to
       arrive bullet by bullet is asking it to arrive. */
    function ensureAnim(s,a,no){
      if(!a.anim) a.anim={type:'appear',order:no};
      return a.anim;
    }
    var hlb=$('#anim-by-hl');
    if(hlb) hlb.addEventListener('click',function(e){
      e.stopPropagation();
      var s=pres.slides[cur]; if(!s) return;
      var n=0,no=nextAnimOrder(s);
      selIdxs().forEach(function(i){
        var a=s.annots[i];
        if(!a||a.k!=='text') return;
        if(a.anim&&a.anim.hl) delete a.anim.hl;
        else {var an=ensureAnim(s,a,no);an.hl=1; if(!an.by) an.by='para';}
        n++;
      });
      if(!n) return;
      revealCount=0;commit(s);
    });
    /* HOW FINELY A TEXT BOX ARRIVES (17-text-builds.js). Beside setType
       because it is the same gesture on the same selection, and it
       resets revealCount for the same reason "One by one" does: the
       number of stops on this slide just changed under the cursor. */
    function setBy(by){
      var s=pres.slides[cur]; if(!s) return;
      var n=0,no=nextAnimOrder(s);
      selIdxs().forEach(function(i){
        var a=s.annots[i];
        if(!a||a.k!=='text') return;
        if(by==='para'||by==='sent') ensureAnim(s,a,no).by=by;
        else if(a.anim){delete a.anim.by;delete a.anim.hl;}  /* absent IS "all at once" */
        else return;   /* no entrance and "whole box": nothing to change */
        n++;
      });
      if(!n) return;
      revealCount=0;commit(s);
    }
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
    /* ---- T427: EVERY ROW MOVES, AND EVERY ROW CAN GO ------------------
       (2026-09-14, user: "I still can't change the order of animations.
       Like these are stuck in place. I also can't delete these as
       well.") Earlier and Later sat on the build's first row only; a
       bullet's row and a page's row had nothing, and nothing on the
       pane removed anything. A build row's Remove takes its animation
       off; a page row moves its page through the book or takes it out;
       a bullet row moves its paragraph through the text or takes it
       out -- the words themselves, so the slide and the show agree. */
    /* T432: REMOVE TAKES THE ANIMATION OFF AND NOTHING ELSE (2026-09-14,
       user: "When removing the animation it would remove the image/the
       dot point, not just remove animation"). T427 put a Remove on the
       page rows and the bullet rows that took the page out of the book
       and the bullet out of the text -- content, in a pane about
       clicks. Only the build row has Remove now, and it says what
       stayed. */
    function removeBuild(si){
      var s=pres.slides[cur],q=animSeq(s);
      if(!q[si]) return;
      var names=q[si].items.map(function(i){return itemLabel(s,i);});
      q[si].items.forEach(function(i){delete s.annots[i].anim;});
      renumber(s);commit(s);
      toast('Animation removed \u2014 '+names.join(', ')
        +(names.length===1?' is':' are')+' still on the slide');
    }
    /* a build to another click: the whole list is renumbered, so a
       drag from click 2 to click 7 is one move, not five swaps */
    function moveStepTo(si,tj){
      var s=pres.slides[cur],q=animSeq(s);
      if(si<0||si>=q.length||tj<0||tj>=q.length||si===tj) return;
      var it=q.splice(si,1)[0];q.splice(tj,0,it);
      q.forEach(function(st,i){
        st.items.forEach(function(idx){s.annots[idx].anim.order=i;});});
      commit(s);
    }
    function movePage(a,k,t){
      var fr=flipFrames(a);
      if(k<0||k>=fr.length||t<0||t>=fr.length||k===t) return;
      fr.splice(t,0,fr.splice(k,1)[0]);
      commit(pres.slides[cur]);
    }
    /* a paragraph to another place in its text -- the words move, so
       the slide and the show agree. Plain and Markdown text are lines;
       rich text is the block children of its one list or of the box,
       or, when the lines were typed with Shift+Enter, the runs between
       <br>s inside one block (T432: "the re-ordering didn't work" was
       this shape). Only a by-paragraph build: a sentence is not a
       line, and the row says so by having no such buttons. */
    function pieceMove(a,k,t){
      var lines=String(a.text||'').split('\n');
      function shift(list){
        if(k<0||k>=list.length||t<0||t>=list.length||k===t) return false;
        list.splice(t,0,list.splice(k,1)[0]);return true;
      }
      if(a.html){
        var host=document.createElement('div');host.innerHTML=a.html;
        function isBlock(nd){return !!nd&&nd.nodeType===1
          &&/^(LI|P|DIV|H[1-6])$/i.test(nd.tagName);}
        function isBr(nd){return !!nd&&nd.nodeType===1&&nd.tagName==='BR';}
        function blank(nd){return nd.nodeType===3&&!String(nd.nodeValue||'').trim();}
        var kids=[].slice.call(host.children);
        var wrap=(kids.length===1&&/^(UL|OL)$/i.test(kids[0].tagName))
          ?kids[0]:host;
        var nodes=[].slice.call(wrap.childNodes),groups,runs;
        /* blocks side by side (list items, paragraphs): one group each */
        var blocky=nodes.length>0&&nodes.every(function(nd){
          return isBlock(nd)||blank(nd);});
        if(blocky&&nodes.filter(isBlock).length>1){
          runs=false;
          groups=nodes.filter(isBlock).map(function(el){return [el];});
        } else {
          /* one block: its runs between <br>s, each run with its <br>.
             The box itself, or the single block it holds. */
          runs=true;
          var box=(kids.length===1&&isBlock(kids[0]))?kids[0]:wrap;
          wrap=box;nodes=[].slice.call(box.childNodes);
          groups=[[]];
          nodes.forEach(function(nd){
            groups[groups.length-1].push(nd);
            if(isBr(nd)) groups.push([]);
          });
          groups=groups.filter(function(g){
            return g.some(function(nd){return !isBr(nd)&&!blank(nd);});});
        }
        if(groups.length<2||!shift(groups)) return false;
        var frag=document.createDocumentFragment();
        groups.forEach(function(g,gi){
          if(runs){
            /* every run but the last ends in its <br>; the last has none:
               a run moved from the end brings no <br> with it, and one
               moved to the end must not keep the one it had */
            while(g.length&&isBr(g[g.length-1])) g.pop();
            if(gi<groups.length-1) g.push(document.createElement('br'));
          }
          g.forEach(function(nd){frag.appendChild(nd);});
        });
        wrap.innerHTML='';wrap.appendChild(frag);
        a.html=host.innerHTML;
        if(lines.length===groups.length) shift(lines);
        a.text=lines.join('\n');
      } else {
        if(!shift(lines)) return false;
        a.text=lines.join('\n');
      }
      commit(pres.slides[cur]);
      return true;
    }
    /* ---- THE PANE IS THE LIST OF CLICKS, AND NOTHING ELSE (T402) -----
       (2026-09-13, user: "What is up with the animation pane? How am I
       supposed to use this? I literally can't tell what is going on and
       how to re-order things. I made a flip book and they are all
       animated and this is very confusing to look at. Also why are
       there the animation button options in here as well?")
       It carried a second effect chooser, a second text-pieces chooser
       and a second With-previous row -- every one a copy of a ribbon
       control -- above a list headed "one row per build" whose flip
       book pages were italic chips truncated to "fa..." under a bare
       arrow, and whose anchored pages were looked up by the wrong index
       (build index, not stop index) so a book after a split text box
       showed no pages at all.
       Now: one numbered row per click, in the order the space bar takes
       them. A build row names what arrives, how, and on how many clicks;
       Earlier and Later move it. A flip book's pages are rows of their
       own, numbered with their click, and say that they follow the book.
       The controls live on the ribbon, once. */
    function fxWord(t){
      var w='';SEQ_FX.forEach(function(f){if(f[0]===t) w=f[1];});
      return w||'Fade';
    }
    function render(){
      var s=pres.slides[cur];
      menu.innerHTML='';
      /* T452: Quick animate sits at the head of the ORDER tab, not in
         the configuration one. It is the tool that sets this list by
         pointing, so it belongs above the list it is writing. */
      if(typeof seqOn==='function'&&seqOn()
         &&typeof cfgSeq==='function'){
        var qa=document.createElement('div');
        qa.className='anim-cfg anim-quick';
        menu.appendChild(qa);
        cfgSeq(qa);
      }
      var seq=animSeq(s),steps=slideBuildSteps(s),plan=flipPlan(s);
      var total=plan.count;
      var h1=document.createElement('div');h1.className='anim-h';
      h1.textContent=total?(total+' click'+(total===1?'':'s')):'No clicks yet';
      menu.appendChild(h1);
      var list=document.createElement('div');list.className='anim-seq';
      var dragKey='';   /* T432: the row being dragged, by its key */
      /* T417: ONE LINE PER ROW (2026-09-13, user: "All that text is
         soo unnecessary ... DON'T FILL IT WITH VERBOSE UNNECESSARY
         TEXT"). The number, the name, the effect word. Nothing that
         explains the row: the row is the explanation. */
      function row(clickNo,names,tag,opts){
        opts=opts||{};
        var r=document.createElement('div');
        r.className='anim-step'+(opts.sub?' anim-sub':'')+(opts.cur?' cur':'');
        var n=document.createElement('span');
        n.className='anim-num'+(String(clickNo).length>2?' wide':'');
        n.textContent=clickNo;
        r.appendChild(n);
        var body=document.createElement('span');body.className='anim-body';
        names.forEach(function(p){
          var nm=document.createElement('button');nm.type='button';
          nm.className='anim-name';nm.textContent=p[0];nm.title=p[0];
          nm.addEventListener('click',function(e){e.stopPropagation();
            var l=stage.querySelector('.annot-layer');
            if(l) selectAnnot(l,p[1]); render();});
          body.appendChild(nm);
        });
        r.appendChild(body);
        if(tag){
          var d=document.createElement('span');d.className='anim-tag';
          d.textContent=tag;r.appendChild(d);
        }
        if(opts.ctr){
          ctrls(r,[
            ['\u2191 Earlier','Move this build one click earlier',
             function(){moveStep(opts.si,-1);},opts.si===0],
            ['\u2193 Later','Move this build one click later',
             function(){moveStep(opts.si,1);},opts.si===seq.length-1],
            ['\u2715 Remove','Take the animation off \u2014 the object '
             +'stays on the slide',
             function(){removeBuild(opts.si);},false]]);
        }
        /* T427: a page's or a bullet's own controls */
        if(opts.acts) ctrls(r,opts.acts);
        /* T432: ...AND EVERY ROW DRAGS (user: "would be good to be able
           to drag and drop order, not just having to press arrows").
           A row carries a key -- build, page of a book, bullet of a
           text -- and lands on a row of the same kind and owner; the
           build's first row also stands for bullet 0, so a bullet can
           be dragged to the top. */
        if(opts.dk){
          r.draggable=true;r.dataset.dk=opts.dk;
          if(opts.dk2) r.dataset.dk2=opts.dk2;
          r.addEventListener('dragstart',function(e){
            dragKey=opts.dk;r.classList.add('dragging');
            try{e.dataTransfer.effectAllowed='move';
              e.dataTransfer.setData('text/plain',opts.dk);}catch(err){}
          });
          r.addEventListener('dragend',function(){
            dragKey='';r.classList.remove('dragging');
            $$('.anim-step.drop-above,.anim-step.drop-below',list)
              .forEach(function(x){x.classList.remove('drop-above','drop-below');});
          });
          r.addEventListener('dragover',function(e){
            var tk=dropKeyFor(r,dragKey); if(!tk) return;
            e.preventDefault();e.dataTransfer.dropEffect='move';
            var bb=r.getBoundingClientRect();
            var below=e.clientY>bb.top+bb.height/2;
            r.classList.toggle('drop-below',below);
            r.classList.toggle('drop-above',!below);
          });
          r.addEventListener('dragleave',function(){
            r.classList.remove('drop-above','drop-below');});
          r.addEventListener('drop',function(e){
            var tk=dropKeyFor(r,dragKey); if(!tk) return;
            e.preventDefault();e.stopPropagation();
            var below=r.classList.contains('drop-below');
            r.classList.remove('drop-above','drop-below');
            dropRow(dragKey,tk,below);dragKey='';
          });
        }
        list.appendChild(r);
        return r;
      }
      /* the key on this row that matches the dragged one's kind and
         owner: 'b:si', 'p:annot:k' or 't:annot:k' */
      function dropKeyFor(r,dk){
        if(!dk) return '';
        var own=dk.replace(/:\d+$/,'');
        var ks=[r.dataset.dk,r.dataset.dk2];
        for(var i=0;i<ks.length;i++)
          if(ks[i]&&ks[i]!==dk&&ks[i].replace(/:\d+$/,'')===own) return ks[i];
        return '';
      }
      function dropRow(from,to,below){
        var fk=from.split(':'),tk=to.split(':');
        var k=+fk[fk.length-1],j=+tk[tk.length-1];
        var t=below?j+1:j; if(k<t) t-=1;
        if(fk[0]==='b') moveStepTo(k,t);
        else {
          var a=s.annots[+fk[1]]; if(!a) return;
          if(fk[0]==='p') movePage(a,k,t);
          else pieceMove(a,k,t);
        }
      }
      /* Earlier and Later stacked, Remove beside them: the same shape on
         every row that has them */
      function ctrls(r,acts){
        var ctr=document.createElement('span');ctr.className='anim-stepctr';
        var col=document.createElement('span');col.className='anim-updown';
        acts.forEach(function(m,i){
          var b=document.createElement('button');b.type='button';
          b.className='anim-mini';b.textContent=m[0];
          b.title=m[1];b.setAttribute('aria-label',m[1]);
          b.disabled=!!m[3];
          b.addEventListener('click',function(e){e.stopPropagation();m[2]();});
          (i<2?col:ctr).appendChild(b);
        });
        ctr.insertBefore(col,ctr.firstChild);
        r.appendChild(ctr);
      }
      /* the stops a flip book, a chart or a paged text box takes AFTER
         the click it arrives on, each on its own numbered row (T163);
         `base` is what flipPlan says, so the numbers here are the ones
         the space bar counts */
      function stepperRows(ps){
        (ps||[]).forEach(function(p){
          var a=p.a,base=plan.base[p.i],cur2=(p.i===selAnnot);
          if(base==null) return;
          if(a.k==='flip'){
            var walk=flipWalk(s,a),fr=flipFrames(a);
            var fx=flipFxWord(a.fanim)||'Cut';
            for(var d=1;d<walk.length;d++){
              var w=walk[d];
              var name=w.j?('Page '+(w.j+1)+' beside figure '+(w.k+1))
                :frameLabel(fr[w.k],w.k);
              /* T427: a page moves through its book (T432: never out
                 of it -- the pane is about clicks, not content) */
              var acts=w.j?null:(function(k){return [
                ['\u2191 Earlier','Show this page one page sooner',
                 function(){movePage(a,k,k-1);},k<=0],
                ['\u2193 Later','Show this page one page later',
                 function(){movePage(a,k,k+1);},k>=fr.length-1]];})(w.k);
              row(base+d,[[name,p.i]],fx,{sub:true,cur:cur2,acts:acts,
                dk:w.j?'':('p:'+p.i+':'+w.k)});
            }
          } else if(a.k==='chart'){
            chartParse(a).series.forEach(function(se,k){
              row(base+k+1,[[se.name,p.i]],'series',{sub:true,cur:cur2});
            });
          } else if(a.k==='text'){
            var pg=textPages(a);
            for(var t=1;t<pg.length;t++)
              row(base+t,[['Page '+(t+1),p.i]],'page',{sub:true,cur:cur2});
          }
        });
      }
      function short(t,n){
        t=String(t||'').replace(/\s+/g,' ').trim();
        return t.length>n?(t.slice(0,n-1)+'\u2026'):t;
      }
      seq.forEach(function(st,si){
        var o=st.order,b0=steps.map[o],nsub=steps.sub[o]||1;
        var first=(plan.stop[b0]|0)+1;
        var names=st.items.map(function(idx){return [itemLabel(s,idx),idx];});
        var kinds={};
        st.items.forEach(function(idx){
          kinds[fxWord(s.annots[idx].anim.type)]=1;});
        var tag=Object.keys(kinds).join('/');
        var aft=0;
        st.items.forEach(function(idx){
          var v=(s.annots[idx].anim.after)|0; if(v>aft) aft=v;});
        if(aft) tag+=' \u00b7 after '+aft+' s';
        var cur2=st.items.indexOf(selAnnot)>=0;
        /* T417: A BUILD IN PIECES IS ONE ROW PER PIECE (2026-09-13,
           user: "Why cannot I see the per dot point for the
           paragraph"). The first piece carries the name's row and the
           controls; every piece after it is a row of its own, with the
           words that appear on that click. */
        var pieceA=null;
        st.items.forEach(function(idx){
          var a=s.annots[idx];
          if(!pieceA&&textBy(a)&&nsub>1) pieceA=a;});
        if(pieceA&&st.items.length===1){
          var pcs=textPieces(pieceA),ii=st.items[0];
          /* T418: the figure that turns with each piece, on its row */
          var sfb=pieceA.anim.sync?flipById(s,pieceA.anim.sync):null;
          var sfr=sfb?flipFrames(sfb):[];
          function pieceName(k){
            var t=short(pcs[k]||('Piece '+(k+1)),40);
            if(sfr[k]) t+=' \u00b7 '+frameLabel(sfr[k],k);
            return t;
          }
          /* T427: a bullet moves through its text -- the words move, so
             the slide and the show agree (T432: never out of it). Only
             a by-paragraph build: a sentence is not a line. */
          var para=textBy(pieceA)==='para';
          row(first,[[pieceName(0),ii]],tag,{si:si,ctr:true,cur:cur2,
            dk:'b:'+si,dk2:para?('t:'+ii+':0'):''});
          for(var k=1;k<nsub;k++)
            row((plan.stop[b0+k]|0)+1,[[pieceName(k),ii]],'',
              {sub:true,cur:cur2,dk:para?('t:'+ii+':'+k):'',
               acts:para?(function(kk){return [
                ['\u2191 Earlier','Move this bullet up one',
                 function(){pieceMove(pieceA,kk,kk-1);},false],
                ['\u2193 Later','Move this bullet down one',
                 function(){pieceMove(pieceA,kk,kk+1);},kk>=nsub-1]];})(k)
               :null});
        } else {
          var last=(plan.stop[b0+nsub-1]|0)+1;
          row(first===last?first:(first+'\u2013'+last),names,
            tag+(nsub>1?(' \u00b7 '+nsub+' pieces'):''),
            {si:si,ctr:true,cur:cur2,dk:'b:'+si});
        }
        stepperRows(plan.anch[b0]);
      });
      /* anything that steps but carries no build of its own lands
         after every build, exactly as flipPlan lays it out */
      stepperRows(plan.tail);
      if(total) menu.appendChild(list);
      /* T417: the thing you have selected, when it is not on the list
         yet -- with the two ways onto it, so a box with bullets is one
         click from appearing bullet by bullet */
      var sa=(typeof selAnnot==='number')?(s.annots||[])[selAnnot]:null;
      if(sa&&!sa.anim&&!sa.hide&&(sa.k!=='flip'||!flipFrames(sa).length)){
        var sr=document.createElement('div');
        sr.className='anim-step anim-off cur';
        var sn=document.createElement('span');
        sn.className='anim-num off';sn.textContent='\u2013';
        sr.appendChild(sn);
        var sb=document.createElement('span');sb.className='anim-body';
        var sl=document.createElement('span');sl.className='anim-name';
        sl.textContent=itemLabel(s,selAnnot);sb.appendChild(sl);
        sr.appendChild(sb);
        var sc=document.createElement('span');
        sc.className='anim-stepctr row';
        var acts=[['Appear',function(){setType('appear');}]];
        if(sa.k==='text') acts.push(['By bullet',function(){setBy('para');}]);
        acts.forEach(function(m){
          var b=document.createElement('button');b.type='button';
          b.className='anim-mini';b.textContent=m[0];
          b.addEventListener('click',function(e){e.stopPropagation();
            m[1]();render();});
          sc.appendChild(b);});
        sr.appendChild(sc);
        menu.appendChild(sr);
      }
      /* ...and the way to SAY the order by pointing (T168), beside the
         list it rewrites. T452: not while it is already running -- its
         own controls are at the head of this very tab now, so a second
         door into the mode you are standing in is just noise. */
      if(typeof seqOn==='function'&&seqOn()) return;
      var sq=document.createElement('button');
      sq.type='button';sq.className='anim-mini wide';
      sq.innerHTML=bic('stagger')+' Quick animate\u2026';
      sq.title='Then click the objects on the slide one after another, '
        +'in the order they should appear. Shift-click puts one on the '
        +'same click as the last.';
      sq.addEventListener('click',function(e){e.stopPropagation();
        seqArmStart();});
      menu.appendChild(sq);
    }
    /* ONE door. There were briefly two — View's Animations and an
       "Animate" button in an Effects group that renamed itself to the
       selected item's effect. Same pane, different groups, different
       names, both pressed at once (2026-08-17, user: "WHY IS ANIMATIONS
       AND APPEAR NOT IN THE SAME PLACE"). The pane's effect chooser
       already tracks the selection, which is everything the second
       button ever added. */
    function set(open){
      if(open){
        paneShow('animpane');render();
        if(typeof animCfgSync==='function') animCfgSync();
        /* T452: opening lands you on the tab you left it on */
        if(typeof animTabApply==='function') animTabApply();
      }
      else paneHide('animpane');
    }
    vbtn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    if(cl) cl.addEventListener('click',function(){set(false);});
    /* the effect chooser at the top tracks the selection, so an open pane
       has to follow it rather than showing whatever was picked last */
    animPaneSync=function(){
      if(pane.hidden) return;
      render();
      /* T445: the settings above the list follow the selection too */
      if(typeof animCfgSync==='function') animCfgSync();
    };
    animPaneClose=function(){set(false);};
    animPaneOpen=function(){set(true);};
    /* ---- the Animate TAB's own buttons --------------------------------
       "There doesn't seem to be a way to remove animations" (2026-08-20,
       user) — there was one, the None effect, but it was inside a pane
       you had to know to open, with an item selected, and it looked like
       any other effect rather than like a removal. The effects are now
       buttons in the ribbon where you can see which one is on, None reads
       as the undo it is, and Clear slide strips the whole slide in one
       press without hunting item by item. */
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
      toast(order.length+' items, one per click');
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
    /* the pointing mode (T168) and the reading order (T106), on the
       ribbon at last (T176). Both were rows at the FOOT of the pane,
       so you had to open the list to find the two ways of rewriting
       it -- a door behind another door. Same functions the pane rows
       call; two doors, one implementation. */
    var sqb=$('#anim-seq');
    if(sqb) sqb.addEventListener('click',function(e){
      e.stopPropagation();seqArmStart();});
    /* the timeline IS the Layers pane (T174); this door drives
       Home's button so there is one pane and one implementation */
    var lyb=$('#anim-layers');
    if(lyb) lyb.addEventListener('click',function(e){
      e.stopPropagation();
      var ob=$('#objects-btn'); if(ob) ob.click();});
    var clr=$('#anim-clear');
    if(clr) clr.addEventListener('click',function(){
      var s=pres.slides[cur]; if(!s) return;
      /* SAY WHAT IS LEFT (T162). This deleted `a.anim` and then
         claimed "everything is on the slide from the start" -- untrue on
         exactly the slides the feature exists for. A flip book still
         steps, and a caption tied to figure 3 still waits for figure 3,
         because neither is an `a.anim`. Worse, the guard fired
         "Nothing on this slide is animated" about a slide the space bar
         walks in five clicks. Both sentences now count what REMAINS,
         using the same plan playback uses. Deleting the flip book's own
         frames is deliberately NOT done here: "Remove animations" is
         about the reveal, and a flip book is CONTENT -- taking its
         figures away would destroy work this button never promised to
         touch. */
      var n=0;
      (s.annots||[]).forEach(function(a){if(a&&a.anim){delete a.anim;n++;}});
      var left=slideStops(s);   /* the clicks still in the slide */
      if(!n){
        toast(left
          ?('Nothing here has an entrance effect, but the slide still '
            +'takes '+left+' more click'+(left===1?'':'s')
            +' — that is its flip book')
          :'Nothing on this slide is animated');
        return;
      }
      revealCount=0;commit(s);
      toast('Cleared '+n+(n===1?' animation':' animations')
        +(left?(' — '+left+' click'+(left===1?'':'s')
                +' left, stepping the flip book')
              :' — everything is on the slide from the start'));
    });
    /* the effect buttons act on the SELECTION, so they show the selected
       item's effect and stand down when there is nothing selected */
    animRibbonSync=function(){
      timingSync();
      flipFxSync();
      animOutSync();
      motionSync();
      if(typeof pictureSync==='function') pictureSync();   /* T387 */
      /* T289: the slide transition is a fact about the SLIDE rather than
         the selection, but this is the one sync every path already
         calls -- selection changes, slide changes and markDirty all
         land here -- so the ribbon's Cut / Fade / Move cannot show a
         different answer from the slide you are looking at. */
      if(typeof transRibbonSync==='function') transRibbonSync();

      /* the gallery's icon and its pressed card follow the selection
         through the one sync everything else already calls (T171) */
      if(typeof galSync==='function'&&$('#anim-strip')) galSync();
      /* T220: the Object tab's own copy of the effects and the
         by-bullet trio is gone -- an entrance is the Animation tab's
         job, and the Object tab was the more crowded of the two
         (2026-09-03, user: "getting rid of the animations from the
         object page would be good. This only needs to go on
         animations"). What is left here is the Animation tab's. */
    };
  }
