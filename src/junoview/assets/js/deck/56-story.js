  /* ---- T391: THE ANIMATION STORY ---------------------------------------
     (2026-09-13, user: "one thing that is annoying with animations in
     PowerPoint is when you have a lot of animations e.g. pictures
     coming and going it is hard to configure. It would be cool if there
     was something like the 'animation story', that showed you what the
     slide looks like during each animation and you can click through
     -- if something disappears it is not there at that point, so then
     if there are layers of things they are much easier to see where
     they are and move around.")

     A strip above the stage: one picture per STOP of the current slide
     -- the start, then every click -- each painted by the playback
     renderer itself at that stop, so it shows exactly what the room
     will see. Click one and the stage shows the slide AT that stop and
     stays editable: what has not arrived yet is not there, what has
     already left is not there, a flip book is on that page, a text box
     shows the bullets that are out. Move things, resize them, and the
     model changes as it always does; "Whole slide" puts the ordinary
     editor back. Nothing is stored. The cursor is `storyAt` (clicks
     taken, like revealCount in the show); the renderer and the flip
     cursor read it only while editing. */
  var storyAt=null,storySlide=-1,storyPaint=false,storyT=null,storyObs=null;
  /* T580: a little smaller -- the strip, the ribbon and the panel were
     leaving the slide a third of the screen */
  var STORY_THUMB_W=128;
  var storyRevision=0,storyPainted=-1,storySource=null,storyDeck=null;
  function storyInvalidate(){
    storyRevision++;
    storySoon();
  }
  function storySelection(strip){
    $$('.story-stop',strip).forEach(function(card){
      var on=storyAt===+card.getAttribute('data-stop');
      card.classList.toggle('on',on);
      card.setAttribute('aria-pressed',String(on));
    });
    var whole=strip.querySelector('.story-whole');
    if(whole){whole.classList.toggle('on',storyAt==null);
      whole.setAttribute('aria-pressed',String(storyAt==null));}
    /* T580: the card that is lit also says how to get back */
    $$('.story-stop',strip).forEach(function(card){
      var k=+card.getAttribute('data-stop');
      card.setAttribute('data-tip',storyAt===k
        ?'Click again for the whole slide':'');
    });
    var on=strip.querySelector('.story-stop.on');
    if(on&&on.scrollIntoView) on.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function storyPlan(s){
    return {steps:slideBuildSteps(s),plan:flipPlan(s)};
  }
  function storyCount(s){return storyPlan(s).plan.count||0;}
  /* what happens on click k (1-based): who arrives, who leaves, which
     book turns -- the caption under a thumbnail */
  function storyWhat(s,k){
    var sp0=storyPlan(s),steps=sp0.steps,plan=sp0.plan;
    var arr=[],leave=[];
    function stopOf(st){var sp=plan.stop[st];return sp==null?st:sp;}
    (s.annots||[]).forEach(function(a){
      if(!a) return;
      if(a.anim){
        var pst=pieceSteps(steps,a);
        if(pst.length>1){
          /* T577: a piece is named by its own words -- its click may be
             nowhere near the rest of its box's */
          var words=textBy(a)?textPieces(a):[];
          pst.forEach(function(b,j){
            if(b==null||stopOf(b)!==k-1) return;
            arr.push(words[j]?('\u2022 '+words[j])
              :('panel '+(j+1)+' of '+annotLabel(a)));
          });
        } else {
          var st=steps.map[a.anim.order||0];
          if(st!=null&&stopOf(st)===k-1) arr.push(annotLabel(a));
        }
      }
      var o=animOut(a);
      if(o!=null){
        var st2=steps.map[o];
        if(st2!=null&&stopOf(st2)===k-1) leave.push(annotLabel(a));
      }
      var f=(typeof animFocus==='function')?animFocus(a):null;   /* T472 */
      if(f){
        var st3=steps.map[f.at];
        if(st3!=null&&stopOf(st3)===k-1) arr.push('focus on '+annotLabel(a));
      }
    });
    steppersOn(s).forEach(function(p){
      var base=plan.base[p.i]; if(base==null) return;
      if(k-1>=base&&k-1<base+stopsFor(s,p.a))
        arr.push('next of '+annotLabel(p.a));
    });
    function say(list,verb){
      if(!list.length) return '';
      var head=list.slice(0,2).join(', ');
      if(list.length>2) head+=' +'+(list.length-2);
      return head+' '+verb;
    }
    var out=[say(arr,list1(arr)),say(leave,'leave'+(leave.length===1?'s':''))]
      .filter(Boolean).join(' · ');
    return out||'nothing changes';
    function list1(l){return l.length===1?'arrives':'arrive';}
  }
  /* one picture of the slide at stop k, painted by the SHOW's renderer
     (mode view, revealCount k) into an off-screen 1280-wide page and
     scaled down. The keyframes are stripped: a thumbnail is a still. */
  /* `whole`: everything on the slide, as the ordinary editor has it --
     every build arrived and nothing gone (printAll, which is what an
     export reads) -- for the Whole slide card (T580) */
  function storyThumb(s,k,whole){
    var off=$('#story-paint');
    if(!off){
      off=document.createElement('div');off.id='story-paint';
      off.className='story-paint';
      document.body.appendChild(off);
    }
    var pg=pageOf(),W=1280,H=Math.round(1280*pg.mm[1]/pg.mm[0]);
    var slideEl=document.createElement('div');
    slideEl.className='slide slide-blank story-slide';
    slideEl.style.width=W+'px';slideEl.style.height=H+'px';
    if(s.bg) slideEl.style.setProperty('background',tokVal(s.bg),'important');
    off.appendChild(slideEl);
    var savedMode=mode,savedReveal=revealCount,savedSel=selAnnot,
      savedSet=selSet,savedSeen=flipSeen,savedTurn=flipTurn,
      savedAll=printAll;
    mode='view';revealCount=k;selAnnot=null;selSet=[];
    flipSeen={};flipTurn={};storyPaint=true;
    if(whole) printAll=1;
    try{attachAnnots(slideEl,s);}
    finally{
      mode=savedMode;revealCount=savedReveal;selAnnot=savedSel;
      selSet=savedSet;flipSeen=savedSeen;flipTurn=savedTurn;storyPaint=false;
      printAll=savedAll;
    }
    $$('.an-item,.an-flipstage,.an-part',slideEl).forEach(function(el){
      el.className=el.className
        .replace(/\ban-anim-[a-z]+\b/g,'').replace(/\ban-move-[a-z]+\b/g,'')
        .replace(/\bfturn(-[a-z]+)?\b/g,'').replace(/\ban-typing\b/g,'');
    });
    slideEl.style.zoom=(STORY_THUMB_W/W).toFixed(4);
    var box=document.createElement('div');box.className='story-pic';
    box.style.width=STORY_THUMB_W+'px';
    box.style.height=Math.round(STORY_THUMB_W*H/W)+'px';
    box.appendChild(slideEl);
    return box;
  }
  function storyOpen(){var st=$('#story-strip');return !!st&&!st.hidden;}
  function renderStory(){
    var strip=$('#story-strip'); if(!strip||strip.hidden) return;
    var s=pres.slides[cur]; if(!s) return;
    if(storySlide!==cur){storySlide=cur;storyAt=null;}
    if(storySource===s&&storyDeck===pres&&storyPainted===storyRevision
       &&strip.firstChild){storySelection(strip);return;}
    if(storyObs){storyObs.disconnect();storyObs=null;}
    storySource=s;storyDeck=pres;storyPainted=storyRevision;
    var n=storyCount(s);
    if(storyAt!=null&&storyAt>n){storyAt=n;}
    strip.innerHTML='';
    /* T580: THE HEAD IS A COLUMN AT THE LEFT (2026-09-30, user: "the only
       way to view the original slide at the moment is to close the
       story" -- and in their screenshot Close sat under the Animation
       panel, which covers the right of the stage). A column costs no
       height, and nothing in it can be covered by a pane. */
    var head=document.createElement('div');head.className='story-head';
    var lab=document.createElement('span');lab.className='story-lab';
    lab.textContent='Animation story';
    head.appendChild(lab);
    var cnt=document.createElement('span');cnt.className='story-n';
    cnt.textContent=n?(n+' click'+(n===1?'':'s')):'no animations';
    head.appendChild(cnt);
    var x=document.createElement('button');x.className='dbtn story-x';
    x.innerHTML=bic('exit')+' Close';
    x.title='Close the story. The stage goes back to the whole slide';
    x.addEventListener('click',function(e){e.stopPropagation();storyShow(false);});
    head.appendChild(x);
    strip.appendChild(head);
    var row=document.createElement('div');row.className='story-row';
    var revision=storyRevision;
    function paintCard(card){
      if(!card.isConnected||storySource!==s||storyRevision!==revision) return;
      var box=card.querySelector('.story-pic');
      if(!box||box.firstChild) return;
      var st=card.getAttribute('data-stop');
      box.replaceWith(st==='whole'?storyThumb(s,n,true):storyThumb(s,+st));
    }
    /* Only nearby cards own rendered slides. The labels remain a complete,
       keyboard-accessible list, however many clicks the slide contains. */
    if(window.IntersectionObserver) storyObs=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){if(entry.isIntersecting){
        paintCard(entry.target);if(storyObs) storyObs.unobserve(entry.target);
      }});
    },{root:row,rootMargin:'200px'});
    var pg=pageOf();
    function card(stop,title,words,tip){
      var c=document.createElement('button');
      c.type='button';
      c.setAttribute('data-stop',String(stop));
      var placeholder=document.createElement('div');placeholder.className='story-pic';
      placeholder.style.width=STORY_THUMB_W+'px';
      placeholder.style.height=Math.round(STORY_THUMB_W*pg.mm[1]/pg.mm[0])+'px';
      c.appendChild(placeholder);
      var cap=document.createElement('span');cap.className='story-cap';
      var t=document.createElement('b');t.textContent=title;
      cap.appendChild(t);
      var w=document.createElement('span');w.textContent=words;
      cap.appendChild(w);
      c.appendChild(cap);
      c.title=tip;
      row.appendChild(c);
      if(storyObs) storyObs.observe(c);
      return c;
    }
    /* T580: THE WHOLE SLIDE IS A CARD, the first one -- the ordinary
       editor, everything on it -- where it used to be a word in the
       head that did not look like something you could press */
    var wc=card('whole','Whole slide','everything, to edit as usual',
      'Edit the slide with everything on it, the ordinary way');
    wc.className='story-stop story-whole'+(storyAt==null?' on':'');
    wc.setAttribute('aria-pressed',(storyAt==null).toString());
    wc.addEventListener('click',function(e){e.stopPropagation();setStoryAt(null);});
    /* T580: DRAG A CARD TO REORDER THE CLICKS (user: "would be cool if
       you could drag and re-arrange the slides here as well and that
       changes the order of things"). A card that is a click of the
       build sequence moves the WHOLE click through the one list of
       clicks (timelineOf / tlMoveClick / timelineWrite, T577): the
       left of another card puts it before, the right after, the middle
       ONTO it -- the two happen together. Start and a flip book's page
       turns are not clicks of the sequence and do not drag. */
    var plan0=flipPlan(s),steps0=slideBuildSteps(s),stopB={};
    for(var b0=0;b0<steps0.count;b0++){
      var sp0=plan0.stop[b0];stopB[sp0==null?b0:sp0]=b0;}
    var dragB=null;
    function dropHow(c,e){
      var bb=c.getBoundingClientRect();
      var f=(e.clientX-bb.left)/Math.max(1,bb.width);
      return f<.3?'before':(f>.7?'after':'with');
    }
    function clearDrop(){
      $$('.story-stop.drop-before,.story-stop.drop-after,.story-stop.drop-with',
        row).forEach(function(c){
        c.classList.remove('drop-before','drop-after','drop-with');});
    }
    for(var k=0;k<=n;k++){
      (function(k){
        var what=k===0
          ?((s.annots||[]).some(function(a){return a&&a.anim;})
            ?'before any click':'the whole slide')
          :storyWhat(s,k);
        var c=card(k,k===0?'Start':('Click '+k),what,
          k===0?'Edit the slide as it is before the first click'
          :'Edit the slide as it is after click '+k+': '+what);
        c.className='story-stop'+(storyAt===k?' on':'');
        c.setAttribute('aria-pressed',(storyAt===k).toString());
        /* T580: the lit card, pressed again, is the way back */
        c.addEventListener('click',function(e){
          e.stopPropagation();setStoryAt(storyAt===k?null:k);});
        var b=(k>0)?stopB[k-1]:null;
        if(b==null) return;
        c.draggable=true;
        c.title+='. Drag it to change when it happens';
        c.addEventListener('dragstart',function(e){
          dragB=b;c.classList.add('dragging');
          try{e.dataTransfer.effectAllowed='move';
            e.dataTransfer.setData('text/plain','story');}catch(err){}
        });
        c.addEventListener('dragend',function(){
          dragB=null;c.classList.remove('dragging');clearDrop();});
        c.addEventListener('dragover',function(e){
          if(dragB==null||dragB===b) return;
          e.preventDefault();e.dataTransfer.dropEffect='move';
          var how=dropHow(c,e);
          c.classList.toggle('drop-before',how==='before');
          c.classList.toggle('drop-after',how==='after');
          c.classList.toggle('drop-with',how==='with');
        });
        c.addEventListener('dragleave',function(){
          c.classList.remove('drop-before','drop-after','drop-with');});
        c.addEventListener('drop',function(e){
          if(dragB==null||dragB===b) return;
          e.preventDefault();e.stopPropagation();
          var from=dragB,how=dropHow(c,e);dragB=null;clearDrop();
          storyReorder(s,from,b,how);
        });
      })(k);
    }
    strip.appendChild(row);
    if(!storyObs) $$('.story-stop',row).forEach(paintCard);
    storySelection(strip);
  }
  /* one click of the build sequence to another place, or onto another
     click; the story, the stage, the ribbon and the pane all follow */
  function storyReorder(s,from,to,how){
    timelineWrite(s,tlMoveClick(timelineOf(s),from,to,how));
    markDirty();
    if(typeof repaintAnimation==='function') repaintAnimation();
    if(typeof animRibbonSync==='function') animRibbonSync();
    if(typeof animPaneSync==='function') animPaneSync();
    toast(how==='with'?'Those now happen on the same click'
      :'Moved \u2014 Ctrl+Z puts it back');
  }
  function setStoryAt(k){
    storyAt=(k==null)?null:Math.max(0,k|0);
    storySlide=cur;
    deckEl.classList.toggle('storying',storyAt!=null);
    /* the stage shows the stop; the strip lights the one it is on */
    renderSlide();
    renderStory();
    var b=$('#anim-story');
    if(b) b.setAttribute('aria-pressed',storyOpen()?'true':'false');
  }
  function storyShow(on){
    var strip=$('#story-strip'); if(!strip) return;
    strip.hidden=!on;
    if(!on){
      storyAt=null;deckEl.classList.remove('storying');
      if(storyObs){storyObs.disconnect();storyObs=null;}
      strip.innerHTML='';storySource=null;storyDeck=null;
      clearTimeout(storyT);storyT=null;
      renderSlide();
    } else {
      storySlide=cur;
      renderStory();
      /* Content edits invalidate through markDirty. Selection, animation
         classes and stepping through the story do not change its pictures. */
    }
    var b=$('#anim-story');
    if(b) b.setAttribute('aria-pressed',on?'true':'false');
    if(typeof applyZoom==='function') applyZoom();   /* the stage changed height */
  }
  function storySoon(){
    if(!storyOpen()) return;
    if(storyT) clearTimeout(storyT);
    storyT=setTimeout(function(){storyT=null;renderStory();},220);
  }
  function storyBoot(){
    var b=$('#anim-story');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();storyShow(!storyOpen());});
  }
