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
  var STORY_THUMB_W=150;
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
        var st=steps.map[a.anim.order||0];
        if(st!=null){
          if(stopOf(st)===k-1) arr.push(annotLabel(a));
          else if((typeof textBy==='function'&&textBy(a))
                  ||(typeof panelsOf==='function'&&panelsOf(a))){
            var n=(typeof pieceCount==='function')?pieceCount(a)
              :textPieceCount(a);   /* T473: panels too */
            for(var j=1;j<n;j++) if(stopOf(st+j)===k-1)
              arr.push('more of '+annotLabel(a));
          }
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
  function storyThumb(s,k){
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
      savedSet=selSet,savedSeen=flipSeen,savedTurn=flipTurn;
    mode='view';revealCount=k;selAnnot=null;selSet=[];
    flipSeen={};flipTurn={};storyPaint=true;
    try{attachAnnots(slideEl,s);}
    finally{
      mode=savedMode;revealCount=savedReveal;selAnnot=savedSel;
      selSet=savedSet;flipSeen=savedSeen;flipTurn=savedTurn;storyPaint=false;
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
    var head=document.createElement('div');head.className='story-head';
    var lab=document.createElement('span');lab.className='story-lab';
    lab.textContent='Animation story';
    head.appendChild(lab);
    var whole=document.createElement('button');
    whole.className='dbtn story-whole'+(storyAt==null?' on':'');
    whole.setAttribute('aria-pressed',(storyAt==null).toString());
    whole.innerHTML=bic('objects')+' Whole slide';
    whole.title='Edit the slide with everything on it, the ordinary way';
    whole.addEventListener('click',function(e){e.stopPropagation();setStoryAt(null);});
    head.appendChild(whole);
    var cnt=document.createElement('span');cnt.className='story-n';
    cnt.textContent=n?(n+' click'+(n===1?'':'s')):'no animations on this slide';
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
      box.replaceWith(storyThumb(s,+card.getAttribute('data-stop')));
    }
    /* Only nearby cards own rendered slides. The labels remain a complete,
       keyboard-accessible list, however many clicks the slide contains. */
    if(window.IntersectionObserver) storyObs=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){if(entry.isIntersecting){
        paintCard(entry.target);if(storyObs) storyObs.unobserve(entry.target);
      }});
    },{root:row,rootMargin:'200px'});
    for(var k=0;k<=n;k++){
      (function(k){
        var card=document.createElement('button');
        card.type='button';
        card.setAttribute('data-stop',String(k));
        card.className='story-stop'+(storyAt===k?' on':'');
        card.setAttribute('aria-pressed',(storyAt===k).toString());
        var placeholder=document.createElement('div');placeholder.className='story-pic';
        var pg=pageOf();placeholder.style.width=STORY_THUMB_W+'px';
        placeholder.style.height=Math.round(STORY_THUMB_W*pg.mm[1]/pg.mm[0])+'px';
        card.appendChild(placeholder);
        var cap=document.createElement('span');cap.className='story-cap';
        var t=document.createElement('b');
        t.textContent=k===0?'Start':('Click '+k);
        cap.appendChild(t);
        var w=document.createElement('span');
        w.textContent=k===0
          ?((s.annots||[]).some(function(a){return a&&a.anim;})
            ?'before any click':'the whole slide')
          :storyWhat(s,k);
        cap.appendChild(w);
        card.appendChild(cap);
        card.title=k===0
          ?'Edit the slide as it is before the first click'
          :'Edit the slide as it is after click '+k+': '+storyWhat(s,k);
        card.addEventListener('click',function(e){
          e.stopPropagation();setStoryAt(k);});
        row.appendChild(card);
        if(storyObs) storyObs.observe(card);
      })(k);
    }
    strip.appendChild(row);
    if(!storyObs) $$('.story-stop',row).forEach(paintCard);
    storySelection(strip);
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
