  /* ================================================================
     49-media.js — NATIVE VIDEO AND AUDIO (T321)

     ONE FRAGMENT of deck.js's single IIFE: assets.DECK_PARTS names the
     order, 00-page.js opens the function and 99-boot.js closes it. It
     does not parse alone; check the ASSEMBLED file.

     A clip is an item like a picture -- `{k:'video', x,y,w,h, vkey,
     poster, dur, trim, audio, ctrl, auto, loop, mute}` -- but its BYTES
     never sit in `pres`: a deck lives in localStorage between saves and
     one video would empty the whole budget. They live under `vkey` in
     the same IndexedDB store the picture originals use (MEDIA is the
     session cache in front of it), and ride into every self-contained
     save as `p.media` (embedAssets), the way placed figures ride in
     `p.emb` -- so the .junoview file and the project file play with no
     file beside them, and a deck opened elsewhere absorbs them back
     into its own store (normPres -> mediaAbsorb). The poster is a small
     JPEG on the item itself, so the strip, the overview and a PDF show
     the frame without touching the bytes.

     Playback: <video>/<audio> from the deck's own element, a blob: URL
     minted once per clip; trim is enforced by the element's own clock;
     a re-render mid-slide (every build step rebuilds the layer) resumes
     from where the clip was, so a click for the next bullet does not
     restart the film. Nothing here runs at load time: mediaBoot() is
     called from THE BOOT SEQUENCE. */

  /* ---- THE MEDIA STORE ---------------------------------------------- */
  /* vkey -> {src, mime, name}: this session's copy. NO initialiser here:
     normPres absorbs a saved deck's `media` while the IIFE is still being
     evaluated (10-decks normalises the page's presentations at eval
     time, long before this line runs), and a hoisted `var` is undefined
     until its own line executes -- so `mediaStore()[k]=...` there threw and
     killed the whole deck (2026-09-06, caught live). The store is made
     on first touch, whichever part touches it first. */
  var MEDIA;
  function mediaStore(){return MEDIA||(MEDIA={});}
  var MEDIA_URL={};        /* vkey -> blob: URL, minted once */
  var MEDIA_CAP=200*1024*1024;      /* refused above this */
  var MEDIA_WARN=25*1024*1024;      /* placed, but you are told */
  var MEDIA_POSTER_EDGE=480;
  function mediaKeyNew(){
    return 'med:'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  }
  function mediaPut(key,rec){
    mediaStore()[key]=rec;
    return idbPut(key,rec).catch(function(){});
  }
  function mediaGet(key){
    if(!key) return Promise.resolve(null);
    if(mediaStore()[key]) return Promise.resolve(mediaStore()[key]);
    return idbGet(key).then(function(v){
      if(v&&typeof v.src==='string'&&v.src) mediaStore()[key]=v;
      return mediaStore()[key]||null;
    }).catch(function(){return null;});
  }
  function dataUriBytes(src){
    var m=String(src||'').match(/^data:([^;,]+);base64,(.*)$/);
    if(!m) return null;
    var bin=atob(m[2]),u8=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    return {mime:m[1],bytes:u8};
  }
  /* a blob: URL is what the element plays from: a 40 MB data URI on a
     src attribute is a 40 MB string the DOM holds for the page's life */
  function mediaBlobUrl(key){
    var rec=mediaStore()[key];
    if(!rec) return '';
    if(MEDIA_URL[key]) return MEDIA_URL[key];
    var d=dataUriBytes(rec.src);
    if(!d) return rec.src;
    var u=URL.createObjectURL(new Blob([d.bytes],{type:d.mime}));
    MEDIA_URL[key]=u;
    return u;
  }
  function mediaClock(sec){
    sec=Math.max(0,Math.round(+sec||0));
    var m=Math.floor(sec/60),s=sec%60;
    return m+':'+(s<10?'0':'')+s;
  }
  /* the seconds a clip plays between, resolved against its length: a
     start past the end, or an end before the start, falls back to the
     whole clip rather than to silence */
  function mediaTrimOf(a){
    var d=+(a&&a.dur)||0;
    var t=(a&&a.trim)||{};
    var s=isFinite(+t.s)?Math.max(0,+t.s):0;
    var e=(isFinite(+t.e)&&+t.e>0)?+t.e:(d||Infinity);
    if(d){s=Math.min(s,d);e=Math.min(e,d);}
    if(e<=s){s=0;e=d||Infinity;}
    return {s:s,e:e};
  }
  function mediaTrimTidy(a){
    if(!a||!a.trim) return;
    var s=+a.trim.s||0,e=+a.trim.e||0;
    if(a.dur){s=Math.min(s,a.dur);e=Math.min(e,a.dur);}
    if(e&&e<=s) e=0;
    a.trim={s:Math.round(s*10)/10,e:Math.round(e*10)/10};
    if(!a.trim.s&&!a.trim.e) delete a.trim;
  }
  /* what a clip is called in the strip's tooltips, the Objects pane and
     the export report */
  function mediaLabel(a){
    var tr=mediaTrimOf(a);
    var len=(tr.e<Infinity)?(tr.e-tr.s):(+a.dur||0);
    return (a.audio?'Audio':'Video')+(a.name?' — '+a.name:'')
      +(len?' · '+mediaClock(len):'');
  }
  /* every clip a presentation places, into `p.media` for a
     self-contained save. Returns how many rode along. */
  function mediaEmbed(p){
    var out={},n=0;
    (p.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(!a||a.k!=='video'||!a.vkey||out[a.vkey]) return;
        var rec=mediaStore()[a.vkey];
        if(!rec||!rec.src) return;
        out[a.vkey]={src:rec.src,mime:rec.mime||'',name:rec.name||''};
        n++;
      });
    });
    if(n) p.media=out;
    return n;
  }
  /* the other direction: a loaded deck's `p.media` into the store. A
     copy this session already holds is the fresher one (T305's rule). */
  function mediaAbsorb(p){
    if(!p||!p.media||typeof p.media!=='object') return;
    Object.keys(p.media).forEach(function(k){
      var r=p.media[k];
      if(!r||typeof r.src!=='string'||!r.src) return;
      if(mediaStore()[k]&&mediaStore()[k].src) return;
      mediaPut(k,{src:r.src,mime:String(r.mime||''),name:String(r.name||'')});
    });
  }
  /* pull every clip the open deck names out of IndexedDB into the
     session cache, so a save made before any of its slides was looked
     at still carries them */
  function mediaWarm(p){
    var seen={};
    ((p&&p.slides)||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(!a||a.k!=='video'||!a.vkey||mediaStore()[a.vkey]||seen[a.vkey]) return;
        seen[a.vkey]=1;
        mediaGet(a.vkey).then(function(r){
          if(!r) return;
          /* the slide on screen may be showing a clip with no source */
          var l=stage.querySelector('.annot-layer'),s=pres.slides[cur];
          if(l&&s&&(s.annots||[]).some(function(b){
            return b&&b.k==='video'&&b.vkey===a.vkey;})) renderAnnots(l,s);
        });
      });
    });
  }
  /* the clips this deck names but this browser does not hold: the one
     case a self-contained save cannot be, said rather than silent */
  function mediaMissing(p){
    var n=0,seen={};
    ((p&&p.slides)||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(a&&a.k==='video'&&a.vkey&&!mediaStore()[a.vkey]&&!seen[a.vkey]){
          seen[a.vkey]=1;n++;}
      });
    });
    return n;
  }

  /* ---- PLACING ONE --------------------------------------------------- */
  function mediaKind(file){
    var t=String((file&&file.type)||'');
    if(/^audio\//.test(t)) return 'audio';
    if(/^video\//.test(t)) return 'video';
    var n=String((file&&file.name)||'').toLowerCase();
    if(/\.(mp3|m4a|wav|ogg|oga|aac|flac|weba)$/.test(n)) return 'audio';
    if(/\.(mp4|m4v|webm|mov|ogv)$/.test(n)) return 'video';
    return '';
  }
  /* a frame of a <video>, small, as a JPEG data URI -- the poster */
  function mediaFrame(v){
    try{
      var w=v.videoWidth||0,h=v.videoHeight||0;
      if(!w||!h) return '';
      var k=Math.min(1,MEDIA_POSTER_EDGE/Math.max(w,h));
      var cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(w*k));
      cv.height=Math.max(1,Math.round(h*k));
      cv.getContext('2d').drawImage(v,0,0,cv.width,cv.height);
      return cv.toDataURL('image/jpeg',0.82);
    }catch(e){return '';}
  }
  /* duration, frame size and a first poster, from an off-screen element.
     Best effort with a deadline: a clip the browser cannot decode still
     places, it just has no poster and no length until it plays. */
  function mediaProbe(src,kind){
    return new Promise(function(res){
      var el=document.createElement(kind==='audio'?'audio':'video');
      var done=false;
      function fin(o){if(done) return;done=true;res(o);}
      var t=setTimeout(function(){fin({dur:0,w:0,h:0,poster:''});},8000);
      el.preload='metadata';el.muted=true;
      if(kind!=='audio') el.playsInline=true;
      el.onerror=function(){clearTimeout(t);fin({dur:0,w:0,h:0,poster:''});};
      el.onloadedmetadata=function(){
        var dur=isFinite(el.duration)?el.duration:0;
        if(kind==='audio'){clearTimeout(t);fin({dur:dur,w:0,h:0,poster:''});
          return;}
        el.onseeked=function(){
          clearTimeout(t);
          fin({dur:dur,w:el.videoWidth,h:el.videoHeight,poster:mediaFrame(el)});
        };
        /* a frame a little way in: the first is often black */
        try{el.currentTime=Math.min(1,dur*0.1)||0;}
        catch(e){clearTimeout(t);
          fin({dur:dur,w:el.videoWidth,h:el.videoHeight,poster:''});}
      };
      el.src=src;
    });
  }
  function placeMedia(key,info,kind,name){
    var s=pres.slides[cur]; if(!s) return;
    var l=stage.querySelector('.annot-layer');
    var lr=l?l.getBoundingClientRect():null;
    var w=40,h=(kind==='audio')?10:22.5;
    if(kind!=='audio'&&info.w&&info.h&&lr&&lr.height)
      h=w*(lr.width/lr.height)*(info.h/info.w);
    h=Math.max(6,Math.min(86,h));
    var a={k:'video',x:Math.max(2,50-w/2),y:Math.max(2,50-h/2),w:w,h:h,
      vkey:key};
    if(kind==='audio') a.audio=1;
    if(info.dur) a.dur=Math.round(info.dur*100)/100;
    if(info.poster) a.poster=info.poster;
    if(name) a.name=String(name).replace(/\.[A-Za-z0-9]+$/,'');
    s.annots=s.annots||[];
    s.annots.push(a);
    markDirty();
    setTool('select');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
  }
  /* a file from the Insert button, a drop, or the pptx importer */
  function placeMediaFile(file){
    var kind=mediaKind(file);
    if(!kind) return false;
    if(file.size>MEDIA_CAP){
      toast('That clip is '+Math.round(file.size/1048576)+' MB — over '
        +'the '+(MEDIA_CAP/1048576)+' MB a deck will carry',6000);
      return true;
    }
    toast('Reading '+(file.name||'the clip')+'…');
    readAsDataURL(file).then(function(src){
      return mediaProbe(src,kind).then(function(info){
        var key=mediaKeyNew();
        mediaPut(key,{src:src,mime:String(file.type||''),
          name:String(file.name||'')});
        placeMedia(key,info,kind,file.name);
        toast('Placed'+(info.dur?' — '+mediaClock(info.dur):'')
          +(file.size>MEDIA_WARN
            ?'. At '+Math.round(file.size/1048576)+' MB this clip will '
              +'make the saved file large':''),
          file.size>MEDIA_WARN?6000:2500);
      });
    }).catch(function(e){
      toast('Could not read '+(file.name||'that file')+': '
        +((e&&e.message)||e),6000);
    });
    return true;
  }

  /* ---- THE ELEMENT ON THE SLIDE -------------------------------------- */
  /* where each clip on the CURRENT slide had got to, so a layer rebuild
     mid-slide (every build step) resumes rather than restarts. Cleared
     by go(): the next slide starts its clips from their trim start. */
  var mediaState={};
  function mediaForget(){mediaState={};}
  function mediaElement(a,i,editing,inline){
    var kind=a.audio?'audio':'video';
    var v=document.createElement(kind);
    v.className='an-mediael';
    v.preload='metadata';
    if(kind==='video'){v.playsInline=true;if(a.poster) v.poster=a.poster;}
    if(a.mute) v.muted=true;
    v.controls=!editing&&a.ctrl!==0;
    v.setAttribute('aria-label',a.alt||a.name||(a.audio?'Audio clip':'Video'));
    var rec=mediaStore()[a.vkey];
    if(inline){if(rec) v.src=rec.src;}      /* a standalone export */
    else if(rec) v.src=mediaBlobUrl(a.vkey);
    else if(a.vkey) mediaGet(a.vkey).then(function(r){
      if(r&&v.isConnected) v.src=mediaBlobUrl(a.vkey);});
    var tr=mediaTrimOf(a);
    var key=cur+':'+i,st=mediaState[key];
    v.addEventListener('loadedmetadata',function(){
      var at=(st&&st.t!=null)?st.t:tr.s;
      if(at>0){try{v.currentTime=at;}catch(e){}}
      if(editing||inline) return;
      /* a clip that has not arrived yet (a build) must not start
         behind its own invisibility */
      var hidden=v.closest&&v.closest('.an-prebuild');
      if(st&&st.playing&&!hidden) v.play().catch(function(){});
      else if(a.auto&&!st&&!hidden) v.play().catch(function(){});
    });
    v.addEventListener('timeupdate',function(){
      if(tr.e<Infinity&&v.currentTime>=tr.e){
        if(a.loop){v.currentTime=tr.s;}
        else{v.pause();try{v.currentTime=tr.e;}catch(e){}}
      }
      if(!editing) mediaState[key]={t:v.currentTime,playing:!v.paused};
    });
    v.addEventListener('ended',function(){
      if(a.loop){v.currentTime=tr.s;v.play().catch(function(){});}
    });
    v.addEventListener('play',function(){
      if(v.currentTime<tr.s||(tr.e<Infinity&&v.currentTime>=tr.e-0.05)){
        try{v.currentTime=tr.s;}catch(e){}}
      if(!editing) mediaState[key]={t:v.currentTime,playing:true};
    });
    v.addEventListener('pause',function(){
      if(!editing) mediaState[key]={t:v.currentTime,playing:false};
    });
    return v;
  }
  /* a clip that never had a picture -- an audio file -- still needs one
     to export as: a dark tile with a note mark and its name */
  function mediaTile(a){
    try{
      var cv=document.createElement('canvas');cv.width=480;cv.height=270;
      var c=cv.getContext('2d');
      c.fillStyle='#16273a';c.fillRect(0,0,480,270);
      c.fillStyle='#dce6ee';c.font='96px system-ui,sans-serif';
      c.textAlign='center';c.fillText('♪',240,150);
      c.font='22px system-ui,sans-serif';
      c.fillText(String(a.name||'Audio').slice(0,40),240,230);
      return cv.toDataURL('image/png');
    }catch(e){return '';}
  }

  /* ---- THE CLIP PANE: trim, poster, switches ------------------------- */
  function mediaPaneItem(){
    var s=pres.slides[cur];
    var a=(s&&typeof selAnnot==='number')?(s.annots||[])[selAnnot]:null;
    return (a&&a.k==='video')?a:null;
  }
  function showMediaPane(on){
    var p=$('#mediapane'); if(!p) return;
    if(on){paneShow('mediapane');mediaPaneSync();}
    else paneHide('mediapane');
  }
  function mediaPaneSync(){
    var p=$('#mediapane'); if(!p||p.hidden) return;
    var a=mediaPaneItem(),body=$('#mediapane-body'),nm=$('#md-name');
    if(!a){
      if(body) body.classList.add('empty');
      if(nm) nm.textContent='Select a video or audio clip on the slide';
      return;
    }
    if(body) body.classList.remove('empty');
    if(nm) nm.textContent=mediaLabel(a);
    var tr=mediaTrimOf(a);
    var st=$('#md-start'),en=$('#md-end');
    if(st) st.value=tr.s?tr.s.toFixed(1):'0';
    if(en) en.value=(tr.e<Infinity)?tr.e.toFixed(1):'';
    if(en) en.placeholder=a.dur?a.dur.toFixed(1):'end';
    [['#md-ctrl',a.ctrl!==0],['#md-auto',!!a.auto],['#md-loop',!!a.loop],
     ['#md-mute',!!a.mute]].forEach(function(t){
      var cb=$(t[0]); if(cb) cb.checked=t[1];});
    var pv=$('#md-preview');
    if(pv){
      if(pv.dataset.vkey!==a.vkey){
        pv.dataset.vkey=a.vkey;
        pv.src=mediaStore()[a.vkey]?mediaBlobUrl(a.vkey):'';
        if(a.poster) pv.poster=a.poster; else pv.removeAttribute('poster');
      }
      pv.classList.toggle('md-audio',!!a.audio);
    }
    var info=$('#md-info'),rec=mediaStore()[a.vkey];
    if(info) info.textContent=rec
      ?('Stored offline in this deck — '
        +Math.round(rec.src.length*0.75/1024)+' KB'
        +(rec.mime?', '+rec.mime:''))
      :(a.vkey?'Loading the clip from this browser’s store…'
        :'This clip has no bytes — place the file again');
  }
  function mediaPaneWrite(fn){
    var a=mediaPaneItem(); if(!a) return;
    fn(a);
    markDirty();
    var l=stage.querySelector('.annot-layer'),s=pres.slides[cur];
    if(l&&s) renderAnnots(l,s);
    mediaPaneSync();
  }
  /* ---- THE DOORS, from THE BOOT SEQUENCE ----------------------------- */
  function mediaBoot(){
    var et=$('#et-media'),fi=$('#media-file');
    if(et&&fi) et.addEventListener('click',function(){fi.value='';fi.click();});
    if(fi) fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      if(f) placeMediaFile(f);
    });
    var fb=$('#fmt-media'),p=$('#mediapane');
    if(fb&&p) fb.addEventListener('click',function(){showMediaPane(p.hidden);});
    var cl=$('#mediapane-close');
    if(cl) cl.addEventListener('click',function(){showMediaPane(false);});
    function num(id,fn){
      var el=$(id); if(!el) return;
      /* the canvas owns arrows, Delete and every single-letter tool
         key; a number field has to keep its own keystrokes */
      el.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter') el.blur();
      });
      el.addEventListener('change',function(){
        var n=parseFloat(el.value);
        mediaPaneWrite(function(a){fn(a,isFinite(n)?n:null);});
      });
    }
    num('#md-start',function(a,n){
      a.trim=a.trim||{};a.trim.s=(n==null)?0:Math.max(0,n);mediaTrimTidy(a);});
    num('#md-end',function(a,n){
      a.trim=a.trim||{};a.trim.e=(n==null)?0:Math.max(0,n);mediaTrimTidy(a);});
    function now(id,which){
      var b=$(id); if(!b) return;
      b.addEventListener('click',function(){
        var pv=$('#md-preview'),t=pv?(pv.currentTime||0):0;
        mediaPaneWrite(function(a){
          a.trim=a.trim||{};a.trim[which]=Math.round(t*10)/10;
          mediaTrimTidy(a);});
      });
    }
    now('#md-start-now','s');
    now('#md-end-now','e');
    var pn=$('#md-poster-now');
    if(pn) pn.addEventListener('click',function(){
      var pv=$('#md-preview'),f=pv?mediaFrame(pv):'';
      if(!f){toast('Scrub the preview to the frame you want first');return;}
      mediaPaneWrite(function(a){a.poster=f;});
      toast('Poster set to this frame');
    });
    var pf=$('#md-poster-file'),pi=$('#md-poster-input');
    if(pf&&pi) pf.addEventListener('click',function(){pi.value='';pi.click();});
    if(pi) pi.addEventListener('change',function(){
      var f=this.files&&this.files[0]; if(!f) return;
      readAsDataURL(f).then(function(src){
        var im=new Image();
        im.onload=function(){
          var small=shrinkImage(im,src,MEDIA_POSTER_EDGE);
          mediaPaneWrite(function(a){a.poster=small;});
        };
        im.src=src;
      }).catch(function(){});
    });
    [['#md-ctrl','ctrl'],['#md-auto','auto'],['#md-loop','loop'],
     ['#md-mute','mute']].forEach(function(t){
      var cb=$(t[0]); if(!cb) return;
      cb.addEventListener('change',function(){
        mediaPaneWrite(function(a){
          /* controls default ON, so their switch stores the off */
          if(t[1]==='ctrl'){if(cb.checked) delete a.ctrl; else a.ctrl=0;}
          else if(cb.checked) a[t[1]]=1; else delete a[t[1]];
        });
      });
    });
    /* app.js's window drop reaches this; the tests and a browser
       check reach the same seam */
    window.SemApp.deckDropMedia=function(file){
      if(deckEl.hidden||mode!=='edit') return false;
      return placeMediaFile(file);
    };
    window.SemDeckMedia={place:placeMediaFile,store:mediaStore(),
      trimOf:mediaTrimOf,warm:function(){mediaWarm(pres);}};
    mediaWarm(pres);
  }
