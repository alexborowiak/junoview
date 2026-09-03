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
    ['fade','Fade','F'],['rise','Float up','U'],['zoom','Grow','G']];
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
    /* the three CELLS of the ribbon group carry the hidden bit
       (T180): syncRibbonGroups reads a group's visibility off its
       controls, so hiding the group itself would not hold */
    var on=!!seqArm,any=false;
    ['seq-what','seq-fx','seq-btns'].forEach(function(id){
      var el=$('#'+id); if(!el) return;
      any=true;el.hidden=!on;});
    /* the Timing group stands down while the mode has the row,
       and comes back with the selection when it ends (T185) */
    if(typeof animRibbonSync==='function') animRibbonSync();
    /* ...and so do the whole-slide shortcuts: they would fight the
       mode, and their group is the width the mode's own controls need
       (measured 20px over at 1400px with them showing, T186) */
    var poster=!!(pageOf&&pageOf().poster);
    ['anim-stagger','anim-together','anim-clear'].forEach(function(id){
      var el=$('#'+id); if(el) el.hidden=on||poster;});
    if(!any) return;
    if(typeof syncRibbonGroups==='function') syncRibbonGroups();
    var w=$('#seq-what'); if(!w||!seqArm) return;
    var done=seqArm.hits.length;
    /* two short lines: the count, then the two modifiers. The second
       line is the first thing the tight rung drops (deck.css), the way
       the hint text is -- words that explain, not words that act */
    w.innerHTML='<span><b>next: '+(seqArm.n+1)+'</b> &middot; click the '
      +'next thing to appear'
      +(done?(' &middot; '+done+' placed'):'')+'</span>'
      +'<span><b>Shift</b>: same click &middot; '
      +(seqDigit
        ?('<b>'+seqDigit+'</b> held: '+seqDigit+'s pause')
        :'<b>1\u20139</b>: pause')+'</span>';
    /* THE CHOOSER. Rebuilt rather than diffed: five buttons is cheaper
       to redraw than to reconcile, and it has to follow both the mouse
       and the keyboard. */
    var fx=$('#seq-fx');
    if(fx){
      fx.innerHTML='';
      SEQ_FX.forEach(function(f){
        var b=document.createElement('button');
        b.className='dbtn rbn-sm seq-fxb'+(seqType===f[0]?' on':'');
        b.type='button';
        b.setAttribute('aria-pressed',seqType===f[0]?'true':'false');
        b.innerHTML=bic(f[0])+' '+f[1]+' <kbd>'+f[2]+'</kbd>';
        b.title=f[1]+' \u2014 press '+f[2]
          +(f[0]==='none'?'. Clicking then TAKES an animation away.'
            :'. Every click from now gives this.');
        b.addEventListener('click',function(e){
          e.stopPropagation();seqType=f[0];seqSync();});
        fx.appendChild(b);
      });
    }
    var u=$('#seq-undo'); if(u) u.disabled=!done;
    var d=$('#seq-done'); if(d) d.textContent=done?('Finish ('+done+')')
      :'Finish';
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
    zoom:'zoom'};
  function fxIcon(t){
    if(t==='none') return bic('none');
    if(t==='appear') return bic('appear');
    if(t==='rise') return bic('rise');
    if(t==='zoom') return bic('zoom');
    return bic('fade');
  }
  var galPvEls=[],galPvT=null;
  function galPreviewStop(){
    if(galPvT){clearTimeout(galPvT);galPvT=null;}
    galPvEls.forEach(function(el){
      el.classList.remove('an-anim-fade','an-anim-rise','an-anim-zoom');});
    galPvEls=[];
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
    });
    /* animationend is not reliable enough to be the only cleanup */
    galPvT=setTimeout(galPreviewStop,900);
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
    var d=$('#seq-done'),c=$('#seq-cancel'),u=$('#seq-undo');
    if(d) d.addEventListener('click',function(){seqEnd(true);});
    if(c) c.addEventListener('click',function(){seqEnd(false);});
    if(u) u.addEventListener('click',function(){seqUndoOne();});
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
      if(!on) return {on:false,text:!!a&&num&&a.k==='text'&&!!a.anim};
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
        by:(a.anim.by==='para'||a.anim.by==='sent')?a.anim.by:''};
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
      var dw=$('#anim-delaywrap'),di=$('#anim-delay');
      if(dw) dw.hidden=!(st.on&&st.mode==='after');
      if(di&&st.on&&st.mode==='after'&&document.activeElement!==di)
        di.value=st.after||1;
      [['anim-by-all',''],['anim-by-para','para'],
       ['anim-by-sent','sent']].forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        b.disabled=!st.on;
        b.setAttribute('aria-pressed',
          (st.on&&st.text&&st.by===p[1]).toString());
      });
      var lab=$('#anim-timing-lab');
      if(lab) lab.textContent=(st.on&&st.text)?'Timing & text':'Timing';
    }
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
    /* HOW FINELY A TEXT BOX ARRIVES (17-text-builds.js). Beside setType
       because it is the same gesture on the same selection, and it
       resets revealCount for the same reason "One by one" does: the
       number of stops on this slide just changed under the cursor. */
    function setBy(by){
      var s=pres.slides[cur]; if(!s) return;
      var n=0;
      selIdxs().forEach(function(i){
        var a=s.annots[i];
        if(!a||a.k!=='text'||!a.anim) return;
        if(by==='para'||by==='sent') a.anim.by=by;
        else delete a.anim.by;      /* absent IS "all at once" */
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
         ['rise','Float up'],['zoom','Zoom']].forEach(function(p){
          var b=document.createElement('button');b.className='anim-effb';
          b.textContent=p[1];
          if((a.anim?a.anim.type:'none')===p[0]) b.classList.add('on');
          b.addEventListener('click',function(e){e.stopPropagation();
            setType(p[0]);});
          eff.appendChild(b);});
        menu.appendChild(eff);
        /* HOW MUCH ARRIVES AT A TIME (2026-08-30, user: "options for
           text as well, like the dot point by dot point, line by line,
           sentence by sentence"). Only a text box has pieces, and only
           an animated one has anywhere to put them.
           IN THE PANE, NOT THE RIBBON. Three more word buttons in the
           Animate group is ~200px of ribbon floor, and by T152 every px
           of that comes off the slide column's ceiling. This is where
           the build order already lives and where the selection is
           already tracked. */
        if(a.anim&&a.k==='text'){
          var hb=document.createElement('div');hb.className='anim-h';
          hb.textContent='How much arrives at a time';
          menu.appendChild(hb);
          var gr=document.createElement('div');gr.className='anim-eff';
          [['','All at once','The whole box on one click.'],
           ['para','Bullet by bullet',
            'One click per bullet, or per line you pressed Enter on. '
            +'Exports to PowerPoint as a paragraph build'],
           ['sent','Sentence by sentence',
            'One click per sentence. "Fig. 3", "et al.", "0.05" and '
            +'initials are left alone; when a cut is in the wrong '
            +'place, press Enter there and use Bullet by bullet.']
          ].forEach(function(p){
            var b=document.createElement('button');
            b.className='anim-effb';
            b.textContent=p[1];b.title=p[2];
            var now=(a.anim.by==='para'||a.anim.by==='sent')
              ?a.anim.by:'';
            if(now===p[0]) b.classList.add('on');
            b.addEventListener('click',function(e){e.stopPropagation();
              setBy(p[0]);});
            gr.appendChild(b);});
          menu.appendChild(gr);
          var nby=textBy(a)?textPieceCount(a):1;
          if(nby>1){
            var nt=document.createElement('div');
            nt.className='anim-empty';
            nt.textContent=nby+' pieces — '+nby+' clicks.'
              +(((a.anim.type==='rise'||a.anim.type==='zoom')
                 &&a.anim.by==='sent')
                ?' A sentence inside a paragraph fades in rather than '
                 +'moving: a run of words has no box of its own to move.'
                :'')
              +(a.arc?' This box is curved, so it arrives whole — '
                 +'curved text is redrawn as one shape.':'');
            menu.appendChild(nt);
          }
        }
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
      h2.textContent='Build order — one row per build';
      menu.appendChild(h2);
      var seq=animSeq(s);
      /* ---- THE ONE TRUE SEQUENCE (T163) ------------------------------
         This list used to show anim-order builds ONLY, under a heading
         that promises "each row is one click". A flip book's frames and
         (since T160) a chart's series builds are clicks too -- they are
         in the plan playback walks -- so a slide whose whole reveal was
         a six-figure book showed "Nothing animated on this slide yet"
         while the space bar took five presses through it.
         The stops each build ANCHORS are drawn under it as read-only
         rows. Read-only on purpose: a frame's place in the sequence is
         decided by its place in its BOOK, and offering a second way to
         reorder it here would be two truths about one order. The book's
         own pane is where frames move. */
      var plan=flipPlan(s);
      function stepperRows(list,ps){
        (ps||[]).forEach(function(p){
          var a=p.a;
          var subs=[];
          if(a.k==='flip'){
            flipFrames(a).forEach(function(f,fi){
              if(fi) subs.push(frameLabel(f,fi));});
          } else if(a.k==='chart'){
            chartParse(a).series.forEach(function(se){
              subs.push(se.name);});
          }
          subs.forEach(function(t,ti){
            var r2=document.createElement('div');
            r2.className='anim-step anim-sub';
            var n2=document.createElement('span');
            n2.className='anim-num anim-subnum';
            n2.textContent='\u21b3';
            r2.appendChild(n2);
            var c2=document.createElement('span');
            c2.className='anim-chips';
            var chip=document.createElement('span');
            chip.className='anim-chip anim-subchip';
            /* no owner name on a sub-row: the build row directly
               above IS the owner, and repeating it on every page
               turned the list into a column of the same six words */
            chip.textContent=a.k==='flip'
              ?('figure '+(ti+2)+' of '+flipFrames(a).length
                +(t?(' \u00b7 '+t):''))
              :('then '+t);
            chip.title=a.k==='flip'
              ?('A page of this flip book \u2014 move it in the book '
                +'itself, not here')
              :('A series of this chart \u2014 the order follows the '
                +'data');
            c2.appendChild(chip);
            r2.appendChild(c2);
            list.appendChild(r2);
          });
        });
      }
      if(!seq.length&&!steppersOn(s).length){
        var e2=document.createElement('div');e2.className='anim-empty';
        e2.textContent='Nothing animated on this slide yet.';
        menu.appendChild(e2);
      } else if(!seq.length){
        /* steppers but no builds: the slide DOES walk, so say so */
        var e3=document.createElement('div');e3.className='anim-empty';
        /* slideStops IS the click count: an item hides while
           sp>=revealCount and the largest sp is count-1, so `count`
           presses is what fully builds the slide. Subtracting one here
           told a two-page text box it took "0 clicks" while the film
           strip, reading the same function, said 1 (caught by driving
           it, 2026-09-01). */
        var nst=slideStops(s);
        e3.textContent='No entrance effects here, but this slide takes '
          +nst+' click'+(nst===1?'':'s')+' \u2014 it steps through '
          +'what is below.';
        menu.appendChild(e3);
        var l0=document.createElement('div');l0.className='anim-seq';
        stepperRows(l0,plan.tail);
        menu.appendChild(l0);
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
            /* a stop that RUNS ITSELF says so where the order is read
               (T169). The number is the wait before it, never a
               duration -- durations are still fixed in the stylesheet. */
            var aft=(s.annots[idx].anim.after)|0;
            if(aft) c.textContent+=' · +'+aft+'s';
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
          list.appendChild(row);
          stepperRows(list,plan.anch[si]);});
        /* anything that steps but carries no build of its own lands
           after every build, exactly as flipPlan lays it out */
        stepperRows(list,plan.tail);
        menu.appendChild(list);
      }
      /* ...and the way to SAY the order by pointing (T168). Beside
         the list it rewrites, because that is where you are standing
         when the order is what you are thinking about. */
      var sq=document.createElement('button');
      sq.className='anim-mini wide';
      sq.innerHTML=bic('stagger')+' Quick animate\u2026';
      sq.title='Then click the objects on the slide one after another, '
        +'in the order they should appear. Shift-click puts one on the '
        +'same click as the last.';
      sq.addEventListener('click',function(e){e.stopPropagation();
        seqArmStart();});
      menu.appendChild(sq);
      /* the order "One by one" deals the clicks in (T106) */
      var rb=document.createElement('button');
      rb.className='anim-mini wide';
      rb.textContent='Order on this slide\u2026';
      rb.title='The order things are numbered and revealed in. Quick '
        +'animate sets it by clicking; here you nudge one step';
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
