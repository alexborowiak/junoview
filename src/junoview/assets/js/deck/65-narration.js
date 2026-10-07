/* 65-narration.js — narration recorded per slide, played in the show (T564).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- NARRATION (T564) --------------------------------------------------
     PowerPoint's Record Slide Show, for a talk that has to be given
     without you: Present > Record narration... asks for the microphone
     and starts the show from this slide, and every slide you then show
     is recorded as a take of its own -- split exactly where the
     rehearsal clock splits (go()), so the time belongs to the slide you
     are LEAVING. A slide passed through in under NARR_MIN seconds is not
     a take; showing a slide again records it again, and the later take
     wins. When the show ends the takes are offered, after the ink (one
     question at a time -- askText has one callback), and kept they are
     a slide property, s.narr = {vkey, dur}: the bytes live in the deck's
     media store beside its video and audio clips, so every save that
     carries a clip carries a narration, and one Ctrl+Z takes them all
     back off. Escape keeps them -- the way people leave a show is two
     presses of Escape, and the second must not throw away ten minutes
     of talking; only Discard does.
     In the show a slide with narration speaks when it arrives (one
     player, outside the stage, which re-renders on every build) unless
     the Talk panel has narration off for this run; never while a
     recording run is on, or the microphone would record it. The Notes
     pane plays or deletes a slide's take, and the strip marks it.
     Unlike rehearsal times, which stay on this computer, narration is
     the deck's and travels with it. */
  var NARR_MIN=1.5;          /* seconds: shorter is a slide passed through */
  var narrRec=null;          /* the recording run, while there is one */
  var narrMute=false;        /* the Talk panel's switch; survives runs */
  var narrAudio=null;        /* the show's player: one, never in the stage */
  var narrPrev=null;         /* the Notes pane's player and what it holds */
  var narrPrevKey='';
  var narrBarEl=null,narrTick=0;
  function narrOf(s){
    return (s&&s.narr&&typeof s.narr.vkey==='string'&&s.narr.vkey)
      ?s.narr:null;
  }
  function narrCan(){
    return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia
      &&window.MediaRecorder);
  }
  /* the recorder's own kind (with its codec), and the plain kind the
     bytes are stored as: a data URI with ';codecs=' in it defeats every
     reader of the media store (dataUriBytes, the .pptx writer) */
  function narrMime(){
    var c=['audio/webm;codecs=opus','audio/webm','audio/mp4',
      'audio/ogg;codecs=opus'];
    for(var i=0;i<c.length;i++){
      try{if(MediaRecorder.isTypeSupported(c[i])) return c[i];}catch(e){}
    }
    return '';
  }
  function narrBase(m){return String(m||'audio/webm').split(';')[0];}
  /* ---- THE DOOR -------------------------------------------------------
     The microphone first, the show second: a permission prompt that
     came up over a full-screen show would take it out of full screen,
     and leaving full screen ends a show. */
  function narrRecord(){
    if(narrRec||mode==='view'||!pres.slides[cur]) return;
    if(!narrCan()){
      askTell({title:'Recording is not available here',
        what:'This browser cannot record from a microphone on this page.',
        note:'Open Junoview in a current Chrome, Edge, Firefox or Safari, '
          +'from the app or its web address, and try again.'});
      return;
    }
    toast('Asking for the microphone…');
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      var mt=narrMime();
      narrRec={stream:stream,mime:mt,base:narrBase(mt),deck:pres,
        takes:new Map(),cur:null,paused:false,pending:[],seq:0,
        slideNo:0};
      var b=$('#dc-play');
      if(b) b.click(); else {presentFrom=mode;setUIMode('view');}
      /* the show did not start (a deck with every slide hidden): put
         the microphone down again */
      if(mode!=='view') narrHalt();
    },function(err){
      var denied=err&&(err.name==='NotAllowedError'
        ||err.name==='SecurityError');
      askTell({title:'No microphone',
        what:denied
          ?'The browser was not allowed to use the microphone, so '
            +'nothing was recorded.'
          :'No microphone could be opened, so nothing was recorded.',
        note:denied
          ?'Allow the microphone for this page (the icon at the left of '
            +'the address bar) and press Record narration again.'
          :'Plug one in or choose one in your system settings, then try '
            +'again.'});
    });
  }
  /* ---- TAKES ------------------------------------------------------------ */
  function narrTakeStart(R,slide){
    if(!R||!slide) return;
    var mr;
    try{mr=R.mime?new MediaRecorder(R.stream,{mimeType:R.mime})
      :new MediaRecorder(R.stream);}
    catch(e){toast('The recording could not start — '+(e&&e.name||e));
      return;}
    var t={slide:slide,mr:mr,chunks:[],t0:performance.now(),off:0,
      pauseAt:0,seq:++R.seq};
    mr.ondataavailable=function(e){if(e.data&&e.data.size) t.chunks.push(e.data);};
    t.done=new Promise(function(res){
      mr.onstop=function(){res();};
      mr.onerror=function(){res();};
    });
    R.cur=t;
    try{mr.start();}catch(e){R.cur=null;return;}
    if(R.paused){try{mr.pause();}catch(e){}t.pauseAt=t.t0;}
    R.slideNo=pres.slides.indexOf(slide)+1;
  }
  /* close the take on screen. The recorder hands its last bytes over
     after stop(), so the take is kept from that promise -- against the
     slide OBJECT it began on, never `cur`, which has moved on by then */
  function narrTakeEnd(R){
    var t=R&&R.cur; if(!t) return;
    R.cur=null;
    var now=performance.now();
    var dur=((t.pauseAt||now)-t.t0-t.off)/1000;
    try{if(t.mr.state!=='inactive') t.mr.stop();}catch(e){}
    R.pending.push(t.done.then(function(){
      if(dur<NARR_MIN||!t.chunks.length) return;
      var blob=new Blob(t.chunks,{type:R.base});
      return readAsDataURL(blob).then(function(src){
        var had=R.takes.get(t.slide);
        if(had&&had.seq>t.seq) return;
        R.takes.set(t.slide,{seq:t.seq,dur:Math.round(dur*10)/10,
          rec:{src:src,mime:R.base,name:'Narration'}});
      });
    }).catch(function(){}));
  }
  /* ---- THE SHOW ---------------------------------------------------------- */
  function narrShowStart(){
    var R=narrRec;
    if(R){
      R.deck=pres;
      narrTakeStart(R,pres.slides[cur]);
      narrBar(true);
      return;
    }
    narrPlay(pres.slides[cur]);
  }
  /* go(): the one place a slide changes in the show */
  function narrSlideChanged(){
    if(mode!=='view') return;
    var R=narrRec;
    if(R){narrTakeEnd(R);narrTakeStart(R,pres.slides[cur]);narrBarSync();
      return;}
    narrPlay(pres.slides[cur]);
  }
  function narrStopPlay(){
    if(!narrAudio) return;
    try{narrAudio.pause();}catch(e){}
    narrAudio.removeAttribute('src');
    try{narrAudio.load();}catch(e){}
  }
  function narrPlay(s){
    narrStopPlay();
    var n=narrOf(s);
    if(!n||narrMute||narrRec||mode!=='view') return;
    mediaGet(n.vkey).then(function(rec){
      /* still this slide, still the show, still wanted */
      if(!rec||mode!=='view'||pres.slides[cur]!==s||narrRec||narrMute)
        return;
      if(!narrAudio){narrAudio=new Audio();narrAudio.preload='auto';}
      narrAudio.src=mediaBlobUrl(n.vkey);
      var p=narrAudio.play();
      if(p&&p.catch) p.catch(function(){
        toast('The browser held the narration back — click the '
          +'slide once and it will speak on the next one');
      });
    });
  }
  /* the presenter's Pause pauses the take and the voice with the clock */
  function narrPause(on){
    var R=narrRec;
    if(R){
      if(on===R.paused) return;
      R.paused=on;
      var t=R.cur;
      if(t){
        if(on){try{t.mr.pause();}catch(e){}t.pauseAt=performance.now();}
        else {
          if(t.pauseAt) t.off+=performance.now()-t.pauseAt;
          t.pauseAt=0;
          try{t.mr.resume();}catch(e){}
        }
      }
      narrBarSync();
      return;
    }
    if(narrAudio&&narrAudio.src){
      if(on) narrAudio.pause();
      else {var p=narrAudio.play();if(p&&p.catch) p.catch(function(){});}
    }
  }
  /* the microphone down, now: what was recorded so far waits for the
     question; the page going away is the one end nothing survives */
  function narrHalt(){
    var R=narrRec; if(!R) return null;
    narrRec=null;
    narrTakeEnd(R);
    try{R.stream.getTracks().forEach(function(t){t.stop();});}catch(e){}
    narrBar(false);
    return R;
  }
  /* every end of a show: setUIMode's, and closeDeck's (Back, Home) */
  function narrShowStop(){
    narrStopPlay();
    var R=narrHalt(); if(!R) return;
    Promise.all(R.pending).then(function(){narrAsk(R);});
  }
  /* ---- KEEP OR DISCARD -------------------------------------------------- */
  function narrAsk(R){
    var takes=[];
    R.takes.forEach(function(v,s){takes.push([s,v]);});
    if(!takes.length){
      toast('No narration was kept — a slide needs at least '
        +NARR_MIN+' seconds of talking');
      return;
    }
    /* after the ink's question, never over it */
    var d=$('#ask-dlg');
    if(d&&!d.hidden){setTimeout(function(){narrAsk(R);},300);return;}
    var total=0;
    takes.forEach(function(t){total+=t[1].dur;});
    askYes({title:'Keep the narration?',
      what:'You recorded '+takes.length+' slide'
        +(takes.length===1?'':'s')+', '+mediaClock(total)+' in all.',
      note:'Kept, each slide speaks when it comes up in the show, and the '
        +'recording travels with the deck. Ctrl+Z takes it all back off.',
      ok:'Keep narration',alt:'Discard'},
      function(v){
        if(v==='alt'){toast('Narration discarded');return;}
        /* Keep, and Escape too: nothing recorded is lost to a key */
        narrKeep(R,takes);
      });
    var c=$('#ask-cancel'); if(c) c.hidden=true;
  }
  function narrKeep(R,takes){
    if(R.deck!==pres){
      toast('That narration was for a presentation that is no longer '
        +'open — record it again there');
      return;
    }
    var n=0;
    takes.forEach(function(t){
      var s=t[0],v=t[1];
      if((pres.slides||[]).indexOf(s)<0) return;
      var k=mediaKeyNew();
      mediaPut(k,v.rec);
      s.narr={vkey:k,dur:v.dur};
      n++;
    });
    if(!n) return;
    markDirty();
    if(!deckEl.hidden&&mode!=='view'&&typeof renderFilm==='function')
      renderFilm();
    if(typeof renderNotesPane==='function') renderNotesPane();
    toast('Narration kept on '+n+' slide'+(n===1?'':'s')
      +' — Ctrl+Z takes it back off');
  }
  /* ---- THE RECORDING BAR -------------------------------------------------
     On the page, not the stage (which is rebuilt on every build), at the
     foot of the screen between the ink bar's corner and the slide count:
     what is being recorded and for how long, Pause, and End show. Words
     and icons, as every button. */
  function narrBar(on){
    if(!on){
      if(narrBarEl) narrBarEl.hidden=true;
      clearInterval(narrTick);narrTick=0;
      document.body.classList.remove('jv-recording');
      return;
    }
    if(!narrBarEl){
      var b=document.createElement('div');
      b.className='jv-recbar';b.setAttribute('role','status');
      b.innerHTML='<span class="rec-dot" aria-hidden="true"></span>'
        +'<span class="rec-t"></span>';
      var pz=document.createElement('button');
      pz.type='button';pz.className='dbtn rec-pause';
      pz.addEventListener('click',function(e){
        e.stopPropagation();narrPause(!(narrRec&&narrRec.paused));});
      var end=document.createElement('button');
      end.type='button';end.className='dbtn rec-end';
      end.innerHTML=bic('stop')+' End show';
      end.title='End the show and choose whether to keep the narration';
      end.addEventListener('click',function(e){
        e.stopPropagation();
        var x=$('#deck-exit'); if(x) x.click();
        else setUIMode(presentFrom||'edit');
      });
      [pz,end].forEach(function(x){
        x.addEventListener('mousedown',function(e){e.stopPropagation();});});
      b.appendChild(pz);b.appendChild(end);
      b.addEventListener('click',function(e){e.stopPropagation();});
      document.body.appendChild(b);
      narrBarEl=b;
    }
    narrBarEl.hidden=false;
    document.body.classList.add('jv-recording');
    clearInterval(narrTick);
    narrTick=setInterval(narrBarSync,500);
    narrBarSync();
  }
  function narrBarSync(){
    var R=narrRec,b=narrBarEl; if(!b||!R) return;
    var t=R.cur,sec=0;
    if(t) sec=((t.pauseAt||performance.now())-t.t0-t.off)/1000;
    var lab=b.querySelector('.rec-t');
    if(lab) lab.textContent=(R.paused?'Paused':'Recording')+' · slide '
      +R.slideNo+' · '+mediaClock(sec);
    b.classList.toggle('paused',!!R.paused);
    var pz=b.querySelector('.rec-pause');
    if(pz){
      pz.innerHTML=R.paused?bic('play')+' Resume':bic('pause')+' Pause';
      pz.title=R.paused?'Go on recording this slide':'Stop recording for '
        +'a moment; the slide is not changed';
    }
  }
  /* ---- THE EDITOR'S SIDE ------------------------------------------------
     The Notes pane's slide tab: this slide's take, to hear or to delete.
     Built only when the slide's take changes -- the pane is redrawn on
     every render, and a rebuilt player would stop what you are hearing. */
  function narrPaneSync(){
    var box=$('#np-narr'); if(!box) return;
    var s=pres.slides[cur],n=narrOf(s);
    var key=n?n.vkey+'|'+n.dur:'';
    if(box.dataset.key===key&&box.childNodes.length) return;
    box.dataset.key=key;
    if(narrPrev){try{narrPrev.pause();}catch(e){}}
    narrPrevKey='';
    box.innerHTML='';
    var lab=document.createElement('span');lab.className='np-narr-lab';
    box.appendChild(lab);
    if(!n){
      lab.textContent='No narration — Present › Record narration';
      return;
    }
    lab.innerHTML=bic('mic')+' Narration · '+mediaClock(n.dur);
    var play=document.createElement('button');
    play.type='button';play.className='dbtn np-narr-play';
    play.innerHTML=bic('play')+' Play';
    play.addEventListener('click',function(){narrPreview(n,play);});
    var del=document.createElement('button');
    del.type='button';del.className='dbtn np-narr-del';
    del.innerHTML=bic('exit')+' Delete';
    del.title='Take this slide’s narration off (Ctrl+Z puts it back)';
    del.addEventListener('click',function(){
      if(narrPrev){try{narrPrev.pause();}catch(e){}}
      delete s.narr;
      markDirty();
      if(typeof renderFilm==='function') renderFilm();
      narrPaneSync();
      toast('Narration deleted from this slide — Ctrl+Z puts it back');
    });
    box.appendChild(play);box.appendChild(del);
  }
  function narrPreview(n,btn){
    if(!narrPrev){narrPrev=new Audio();
      narrPrev.addEventListener('ended',function(){
        var b=$('#np-narr .np-narr-play');
        if(b) b.innerHTML=bic('play')+' Play';});}
    if(narrPrevKey===n.vkey&&!narrPrev.paused){
      narrPrev.pause();btn.innerHTML=bic('play')+' Play';return;}
    mediaGet(n.vkey).then(function(rec){
      if(!rec){toast('This narration is not in this browser — open the '
        +'deck from its saved file or project to hear it');return;}
      if(narrPrevKey!==n.vkey){narrPrev.src=mediaBlobUrl(n.vkey);
        narrPrevKey=n.vkey;}
      var p=narrPrev.play(); if(p&&p.catch) p.catch(function(){});
      btn.innerHTML=bic('stop')+' Stop';
    });
  }
  /* the Talk panel's switch: this run, and the ones after it, play no
     narration (a live talk given over a recorded one) */
  function narrTalkSync(){
    var b=$('#talk-narr'); if(!b) return;
    b.setAttribute('aria-pressed',narrMute?'true':'false');
    var st=b.querySelector('.tk-state');
    if(st) st.textContent=narrMute?'off':'playing';
    b.title=narrMute?'Recorded narration is off for this talk. Press '
      +'again to let each slide speak':'Each slide with recorded narration '
      +'speaks when it comes up. Press to give the talk yourself';
  }
  function narrationBoot(){
    var r=$('#pr-narrate');
    if(r) r.addEventListener('click',function(e){
      e.stopPropagation();narrRecord();});
    var t=$('#talk-narr');
    if(t) t.addEventListener('click',function(e){
      e.stopPropagation();
      narrMute=!narrMute;
      if(narrMute) narrStopPlay(); else narrPlay(pres.slides[cur]);
      narrTalkSync();
      toast(narrMute?'Narration off — the slides are silent'
        :'Narration on — each slide speaks when it comes up');
    });
    narrTalkSync();
  }
