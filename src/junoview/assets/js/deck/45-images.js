/* 45-images.js — placing images, where they came from, and cropping them.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- add an image: read the file as a data URI, embed + place it ---- */
  /* ---- IMAGES THAT REMEMBER WHERE THEY CAME FROM -----------------------
     (2026-08-22, user: "would be cool if there was a refresh images with
     local object. Like it has the image saved, but also knows the local
     path, and clicking refresh on the image/presentation refreshes them
     from the local path. If local path is gone though, give a list of
     ones that couldn't be refreshed but just leave them as they were".)

     The picture itself stays embedded — a deck has to survive being sent
     to somebody, and a path on your machine means nothing on theirs. What
     is kept BESIDE it is a file HANDLE, which is the browser's own idea
     of "this exact file on disk": it survives a reload, it can be
     re-read on demand, and it asks permission rather than granting the
     page a filesystem.

     Handles cannot be JSON, so they live in IndexedDB — the same store
     the project handle and the embedded cards already use — keyed by an
     id on the annot. `a.fname` is kept on the annot too, purely so the
     "could not refresh" list can NAME the files that went missing. */
  var FHKEY='imgfile:';
  var fhSeq=0;
  function newFileKey(){
    fhSeq++;
    return FHKEY+Date.now().toString(36)+fhSeq.toString(36);
  }
  function readAsDataURL(file){
    return new Promise(function(res,rej){
      var rd=new FileReader();
      rd.onload=function(){res(rd.result);};
      rd.onerror=function(){rej(rd.error);};
      rd.readAsDataURL(file);
    });
  }
  /* shrink on the way in, exactly as the insert path does, so a refreshed
     picture is the same weight as the one it replaces */
  function shrinkDataUrl(src){
    return new Promise(function(res){
      var probe=new Image();
      probe.onload=function(){res(shrinkImage(probe,src));};
      probe.onerror=function(){res(src);};
      probe.src=src;
    });
  }
  /* every image on the deck that was put there from a local file */
  function linkedImages(){
    var out=[];
    (pres.slides||[]).forEach(function(sl,si){
      (sl.annots||[]).forEach(function(a,ai){
        if(a&&a.k==='image'&&a.fkey) out.push({si:si,ai:ai,a:a});});
    });
    return out;
  }
  /* re-read every linked picture from disk. NOTHING is changed unless its
     file actually reads: a picture whose file has moved keeps the copy it
     already had, and is named in the report instead — losing a figure
     because a folder was renamed would be much worse than a stale one. */
  function refreshLinkedImages(list){
    var items=list||linkedImages();
    if(!items.length) return Promise.resolve({ok:0,lost:[]});
    var ok=0,lost=[];
    return items.reduce(function(chain,e){
      return chain.then(function(){
        return idbGet(e.a.fkey).then(function(h){
          if(!h) throw 0;
          return permAsk(h).then(function(granted){
            if(!granted) throw 0;
            return h.getFile();
          });
        }).then(function(f){
          return readAsDataURL(f);
        }).then(function(src){
          return shrinkDataUrl(src).then(function(small){
            return {full:src,small:small};});
        }).then(function(r){
          var src=r.small;
          if(!src||src===e.a.src) {ok++;return;}
          e.a.src=src;ok++;
          /* THE ORIGINAL MOVES WITH THE PICTURE. Only a.src was
             replaced, so a.okey went on naming the bytes of the file as
             it was when first inserted — and every export that swaps
             originals in (T21) then put the OLD picture on the page,
             which is worse than a stale one, not better (2026-08-26
             audit, T58). */
          var was=e.a.okey;
          if(r.full&&r.full!==src) keepOriginal(e.a,r.full);
          else if(was) delete e.a.okey;
          if(was&&was!==e.a.okey){try{idbDel(was);}catch(err){}}
        }).catch(function(){
          lost.push({si:e.si,name:e.a.fname||'a picture'});
        });
      });
    },Promise.resolve()).then(function(){
      if(ok){markDirty();refresh();}
      return {ok:ok,lost:lost};
    });
  }
  /* the user-facing verb: refresh, then SAY what happened — including,
     by name, anything that could not be found */
  function refreshImagesReport(list){
    var n=(list||linkedImages()).length;
    if(!n){
      toast('No pictures on this deck are linked to a file on this '
        +'computer. Insert one with Image and it will remember where it '
        +'came from.');
      return;
    }
    toast('Re-reading '+n+' picture'+(n===1?'':'s')+'…');
    refreshLinkedImages(list).then(function(r){
      if(!r.lost.length){
        toast(r.ok+' picture'+(r.ok===1?'':'s')+' refreshed from disk');
        return;
      }
      var names=r.lost.slice(0,4).map(function(l){
        return l.name+' (slide '+(l.si+1)+')';}).join(', ');
      if(r.lost.length>4) names+=' and '+(r.lost.length-4)+' more';
      toast((r.ok?(r.ok+' refreshed. '):'')
        +r.lost.length+' could not be read and '
        +(r.lost.length===1?'was':'were')+' left exactly as before: '
        +names,9000);
    });
  }
  (function(){
    var mi=$('#mi-refresh-img');
    if(mi) mi.addEventListener('click',function(){
      var dm=$('#dc-menu'); if(dm) overlayHide(dm);
      refreshImagesReport();
    });
    var one=$('#fmt-imgrefresh');
    if(one) one.addEventListener('click',function(e){
      e.stopPropagation();
      var sl=pres.slides[cur],hits=[];
      selIdxs().forEach(function(i){
        var a=(sl&&sl.annots||[])[i];
        if(a&&a.k==='image'&&a.fkey) hits.push({si:cur,ai:i,a:a});});
      refreshImagesReport(hits);
    });
  })();
  /* `full` is the ORIGINAL bytes when `src` is a shrunken copy of them.
     One funnel: three different doors insert a picture (the file picker,
     the <input> fallback and the paste), and putting the original aside
     in each of them is three chances to forget (T21). */
  function placeImage(src,ar,link,full){
    var s=pres.slides[cur]; if(!s) return;
    var l=stage.querySelector('.annot-layer');
    var lr=l?l.getBoundingClientRect():null;
    /* INTO A FRAME, when one asked for this picture. Drawing a frame
       and then having the picture land centred on the slide at a size
       of its own choosing would make the frame pointless, so an object
       frame waiting on a source is filled in place and keeps its rect
       (T61). objInto is cleared by takeObjInto whichever way it goes. */
    var into=takeObjInto();
    if(into){
      into.k='image';into.src=src;delete into.ref;
      if(link&&link.key){into.fkey=link.key;into.fname=link.name||'';}
      if(full&&full!==src) keepOriginal(into,full);
      markDirty();
      setTool('select');
      if(l){renderAnnots(l,s);
        selectAnnot(l,(s.annots||[]).indexOf(into));}
      return;
    }
    var w=40,h=32;
    if(ar&&lr&&lr.height){h=w*(lr.width/lr.height)*ar;}
    h=Math.max(8,Math.min(86,h));
    s.annots=s.annots||[];
    var img={k:'image',x:Math.max(2,50-w/2),
      y:Math.max(2,50-h/2),w:w,h:h,src:src};
    /* the link, when the browser gave us a real handle to keep */
    if(link&&link.key){img.fkey=link.key;img.fname=link.name||'';}
    s.annots.push(img);
    /* only when it really IS bigger: otherwise the display copy is the
       original and a second copy of it would be pure waste */
    if(full&&full!==src) keepOriginal(img,full);
    markDirty();
    setTool('select');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
  }
  /* ---- THE FRAMES PANE -------------------------------------------------
     A flip book is a little deck inside a slide, so its frames are listed
     and reordered in the same shape the slide strip uses: one row each,
     move/duplicate/remove minis, click to go to it. Anything else would
     have been a second
     idiom for the same job (2026-08-22). */
  var flipSel=-1;         /* which annot index the pane is showing */
  /* the selected items as indexes, the same rule fmtApply follows: the
     whole multi-selection when there is one, else the primary. Tying six
     labels to one figure has to be one gesture, not six. */
  function selIdxs(){
    var m=selSet.filter(function(i){return typeof i==='number';});
    if(m.length) return m;
    return (typeof selAnnot==='number')?[selAnnot]:[];
  }
  function flipPaneItem(){
    var s=pres.slides[cur];
    var a=s&&(s.annots||[])[flipSel];
    return (a&&a.k==='flip')?a:null;
  }
  /* the name a frame goes by: yours, else the card's own title, else its
     number. A bound caption has to be able to say WHICH figure it belongs
     to, and "Frame 3" is no help when there are nine of them. */
  function frameLabel(f,i){
    if(!f) return 'Frame '+(i+1);
    if(f.label) return f.label;
    if(f.ref){
      var it=resolveRef(f.ref);
      if(it&&it.title) return it.title;
      return 'Figure '+(i+1)+' (notebook closed)';
    }
    return 'Picture '+(i+1);
  }
  function showFlipPane(on,idx){
    var p=$('#flippane'); if(!p) return;
    if(on){
      if(typeof idx==='number') flipSel=idx;
      /* paneShow un-hides BEFORE renderFlipPane runs: it bails on a
         hidden pane (it is called from showFmt on every canvas click
         and must not rebuild a list nobody is looking at) */
      paneShow('flippane');
      renderFlipPane();
    } else paneHide('flippane');
  }
  function renderFlipPane(){
    var p=$('#flippane'); if(!p||p.hidden) return;
    var list=$('#flippane-list'),ttl=$('#flippane-t');
    var a=flipPaneItem();
    if(!a){
      if(ttl) ttl.textContent='Flip book';
      if(list) list.innerHTML='<div class="selpane-empty">Select a flip '
        +'book on the slide to see its figures.</div>';
      var tie0=$('#fp-tie'); if(tie0) tie0.hidden=true;
      var op0=$('#fp-opt'); if(op0) op0.hidden=true;
      return;
    }
    var fr=flipFrames(a);
    if(ttl) ttl.textContent='Flip book — '+fr.length+' figure'
      +(fr.length===1?'':'s');
    /* how it steps is this book's own property, so the chooser follows
       the pane's item rather than showing the last thing you picked */
    var op=$('#fp-opt'); if(op) op.hidden=false;
    var nav=$('#fp-nav'); if(nav) nav.value=a.fbtn?'btn':'';
    list.innerHTML='';
    if(!fr.length){
      list.innerHTML='<div class="selpane-empty">No figures yet. '
        +'“+ Figures…” lets you click several notebook cards in a row.'
        +'</div>';
    }
    fr.forEach(function(f,i){
      var row=document.createElement('div');
      row.className='fp-row'+(i===(a.at||0)?' current':'');
      var n=document.createElement('span');
      n.className='fp-n';n.textContent=(i+1);
      row.appendChild(n);
      var t=document.createElement('input');
      t.className='fp-t';t.type='text';
      t.value=f.label||'';
      t.placeholder=frameLabel(f,i);
      t.title='What to call this figure — bound captions name it';
      t.addEventListener('keydown',function(e){e.stopPropagation();});
      /* committed on blur, not per keystroke: renaming rebuilds this list,
         and rebuilding it under the caret is the bug the poster-version
         rename already taught us (2026-08-10) */
      t.addEventListener('blur',function(){
        var v=t.value.trim();
        if(v) f.label=v; else delete f.label;
        markDirty();renderFlipPane();});
      row.appendChild(t);
      var ctr=document.createElement('span');ctr.className='fp-ctr';
      [['↑',function(){flipMove(i,-1);},'Move this figure earlier'],
       ['↓',function(){flipMove(i,1);},'Move this figure later'],
       [bic('exit'),function(){flipDrop(i);},'Remove this figure']]
        .forEach(function(pr){
          var b=document.createElement('button');
          b.className='film-mini';b.innerHTML=pr[0];b.title=pr[2];
          b.setAttribute('aria-label',pr[2]);
          b.addEventListener('click',function(ev){
            ev.stopPropagation();pr[1]();});
          ctr.appendChild(b);
        });
      row.appendChild(ctr);
      row.addEventListener('click',function(){
        a.at=i;markDirty(true);renderSlide();renderFlipPane();});
      list.appendChild(row);
    });
    renderTiePanel(a);
  }
  /* moving a frame must carry its BINDINGS with it, or captions tied to
     figure 4 silently start belonging to whatever slid into slot 4 */
  function flipRemap(a,map){
    var s=pres.slides[cur];
    (s.annots||[]).forEach(function(x){
      if(!x||x.fb!==a.fid) return;
      var to=map[x.fbf||0];
      if(to==null) delete x.fb, delete x.fbf, delete x.fbm;
      else x.fbf=to;
    });
  }
  function flipMove(i,d){
    var a=flipPaneItem(); if(!a) return;
    var fr=flipFrames(a).slice(),j=i+d;
    if(j<0||j>=fr.length) return;
    var t=fr[i];fr[i]=fr[j];fr[j]=t;
    a.frames=fr;
    var map={};fr.forEach(function(_,k){map[k]=k;});
    map[i]=j;map[j]=i;
    flipRemap(a,map);
    if((a.at||0)===i) a.at=j; else if((a.at||0)===j) a.at=i;
    markDirty();renderSlide();renderFlipPane();
  }
  function flipDrop(i){
    var a=flipPaneItem(); if(!a) return;
    var fr=flipFrames(a).slice();
    if(i<0||i>=fr.length) return;
    fr.splice(i,1);
    a.frames=fr;
    /* a caption tied to the frame that just went loses its binding rather
       than pointing at a stranger — and it stays VISIBLE, because an item
       that silently disappears forever is the worst thing here */
    var map={};
    for(var k=0;k<=fr.length;k++) map[k]=(k<i)?k:(k===i?null:k-1);
    flipRemap(a,map);
    a.at=Math.max(0,Math.min(fr.length-1,a.at||0));
    markDirty();renderSlide();renderFlipPane();
  }
  /* ---- TYING AN ITEM TO A FIGURE ---------------------------------------
     "you can tie text to an image in it ... and tie objects and things to
     a specific image in the flip book" (2026-08-22). It lives in the
     frames pane rather than the ribbon because it needs the frame LIST to
     be visible to make any sense, and because the ribbon had nothing to
     give. It acts on the whole selection, so half a dozen labels can be
     tied to one figure in one go. */
  function tieSel(a,frame,mode){
    var s=pres.slides[cur],hits=selIdxs();
    var n=0;
    hits.forEach(function(i){
      var x=(s.annots||[])[i];
      if(!x||x.k==='flip') return;    /* a flip book cannot bind to itself */
      if(frame==null){delete x.fb;delete x.fbf;delete x.fbm;}
      else {x.fb=a.fid;x.fbf=frame;x.fbm=mode||'only';}
      n++;
    });
    if(n){markDirty();renderSlide();renderFlipPane();}
    return n;
  }
  function renderTiePanel(a){
    var host=$('#fp-tie'); if(!host) return;
    var s=pres.slides[cur],hits=selIdxs().filter(function(i){
      var x=(s.annots||[])[i];return x&&x.k!=='flip';});
    host.innerHTML='';
    if(!flipFrames(a).length){
      host.hidden=true;
      return;
    }
    /* THE TIE HAS TO ADVERTISE ITSELF. Tying a caption to a figure has
       worked since the day the flip book landed, and hid completely
       unless you happened to have something selected while this pane was
       open — so it was asked for again as though it did not exist (T86).
       An empty panel that says what it is for costs three lines. */
    if(!hits.length){
      host.hidden=false;
      var hint=document.createElement('div');
      hint.className='fp-tielab';
      hint.textContent='Select any text or object on the slide to tie it '
        +'to one of these figures — it can show with that figure only, '
        +'from it onwards, or up to it.';
      host.appendChild(hint);
      return;
    }
    host.hidden=false;
    var lab=document.createElement('div');
    lab.className='fp-tielab';
    lab.textContent=hits.length===1
      ?('Tie “'+annotLabel((s.annots||[])[hits[0]]).slice(0,28)+'” to')
      :('Tie these '+hits.length+' items to');
    host.appendChild(lab);
    var cur0=(s.annots||[])[hits[0]]||{};
    var sel=document.createElement('select');
    sel.className='fp-tiesel';
    var o0=document.createElement('option');
    o0.value='';o0.textContent='(not tied — always shown)';
    sel.appendChild(o0);
    flipFrames(a).forEach(function(f,i){
      var o=document.createElement('option');
      o.value=String(i);o.textContent=(i+1)+'. '+frameLabel(f,i);
      sel.appendChild(o);
    });
    sel.value=(cur0.fb===a.fid&&cur0.fbf!=null)?String(cur0.fbf):'';
    host.appendChild(sel);
    var mode=document.createElement('select');
    mode.className='fp-tiesel';
    FLIP_MODES.forEach(function(m){
      var o=document.createElement('option');
      o.value=m[0];o.textContent=m[1];
      mode.appendChild(o);
    });
    mode.value=cur0.fbm||'only';
    mode.disabled=sel.value==='';
    host.appendChild(mode);
    function commit(){
      mode.disabled=sel.value==='';
      tieSel(a,sel.value===''?null:+sel.value,mode.value);
    }
    sel.addEventListener('change',commit);
    mode.addEventListener('change',commit);
  }
  (function(){
    var fg=$('#fmt-figures');
    if(fg) fg.addEventListener('click',function(e){
      e.stopPropagation();
      var s=pres.slides[cur],idx=null;
      selIdxs().forEach(function(i){
        var x=(s&&s.annots||[])[i];
        if(idx===null&&x&&x.k==='flip') idx=i;});
      if(idx===null) return;
      var p=$('#flippane');
      showFlipPane(!!(p&&p.hidden),idx);
    });
    var cl=$('#flippane-close');
    if(cl) cl.addEventListener('click',function(){showFlipPane(false);});
    var nav=$('#fp-nav');
    if(nav) nav.addEventListener('change',function(){
      var a=flipPaneItem(); if(!a) return;
      if(nav.value==='btn') a.fbtn=1; else delete a.fbtn;
      markDirty();renderSlide();renderFlipPane();
    });
    var ac=$('#fp-add-cells');
    if(ac) ac.addEventListener('click',function(){
      if(flipPaneItem()) startPick(flipSel,true);});
    var ai=$('#fp-add-img'),fi=$('#fp-img-file');
    if(ai&&fi) ai.addEventListener('click',function(){
      if(!flipPaneItem()) return;
      fi.value='';fi.click();});
    /* several pictures at once, in the order the browser hands them over —
       adding twelve frames one file dialog at a time is how a feature
       goes unused */
    if(fi) fi.addEventListener('change',function(){
      var a=flipPaneItem(),files=this.files;
      if(!a||!files||!files.length) return;
      var list=Array.prototype.slice.call(files);
      var got=[],done=0;
      list.forEach(function(f,i){
        var rd=new FileReader();
        rd.onload=function(){
          var probe=new Image();
          probe.onload=function(){
            var small=shrinkImage(probe,rd.result);
            got[i]={src:small};
            /* placeImage was factored out precisely because "putting the
               original aside in each door is three chances to forget".
               The flip book is the fourth door, and it forgot
               (2026-08-26 audit, T58). A frame is not an annot, so it
               carries its own okey and useOriginals walks frames. */
            if(rd.result&&rd.result!==small)
              keepOriginal(got[i],rd.result);
            fin();};
          probe.onerror=function(){got[i]={src:rd.result};fin();};
          probe.src=rd.result;
        };
        rd.onerror=function(){got[i]=null;fin();};
        rd.readAsDataURL(f);
      });
      function fin(){
        if(++done<list.length) return;
        a.frames=flipFrames(a).slice();
        got.forEach(function(g){if(g) a.frames.push(g);});
        a.at=a.frames.length-1;
        /* ONE history entry for the whole batch */
        markDirty();renderSlide();renderFlipPane();
      }
    });
  })();
  /* ---- WHAT GOES IN AN OBJECT FRAME ----------------------------------
     An empty frame is a hole of a known size and position; this is the
     menu that fills it. Every row lands in THAT frame rather than
     dropping something centred on the slide, which is the entire reason
     to have drawn a frame first (T61, 2026-08-29). */
  var objInto=-1;      /* the frame the next placeImage should fill */
  function takeObjInto(){
    var i=objInto; objInto=-1;
    var s=pres.slides[cur];
    var a=s&&(s.annots||[])[i];
    return (a&&a.k==='cell'&&!a.ref)?a:null;
  }
  function openObjSrc(btn,idx){
    var m=$('#obj-src-menu');
    if(!m){
      m=document.createElement('div');
      /* vw-menu, or the rows tile: a bare .sh-menu is the shape
         gallery's three-column grid, which is why every worded menu in
         this file names the class that makes it a column */
      m.className='sh-menu vw-menu obj-src-menu';m.id='obj-src-menu';
      m.hidden=true;document.body.appendChild(m);
      /* the same outside-click close every drawn menu in the editor
         uses; there is no shared closer to call */
      document.addEventListener('click',function(e){
        if(!m.hidden&&!m.contains(e.target)) m.hidden=true;});
    }
    m.innerHTML='';
    menuHead(m,'put in this frame');
    /* the icons are written out as literal bic() calls rather than
       looked up from a key in the row: the icon contract test reads this
       source, and artwork reached through a loop variable looks to it
       like artwork nobody consumes */
    [[bic('cellcard'),'A figure from a notebook',
      'Any figure, table or note in an open notebook. This is what the '
      +'frame always did; now it is one answer among several',
      function(){objInto=-1;startPick(idx);}],
     [bic('image'),'A picture from this computer',
      'Choose an image file. Junoview keeps a link to the file where the '
      +'browser allows it, so Refresh can re-read it later',
      function(){objInto=idx;var b=$('#et-image'); if(b) b.click();}],
     [bic('paste'),'A picture on the clipboard',
      'Paste a screenshot or a copied image straight into this frame',
      function(){objInto=idx;pasteObjImage();}],
     [bic('link'),'A path or a link',
      'Any address this page can load — a file path or a URL. The '
      +'address is what is kept, so the picture stays exactly as '
      +'portable as the address is',
      function(){
        var p=prompt('Path or link to a picture:','');
        if(!p||!p.trim()) return;
        objInto=idx;placeImage(p.trim(),0);}]
    ].forEach(function(r){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      b.title=r[2];
      b.innerHTML=r[0]+' '+r[1];
      b.addEventListener('click',function(e){
        e.stopPropagation();m.hidden=true;r[3]();});
      m.appendChild(b);
    });
    m.hidden=false;
    floatMenu(btn,m);
  }
  /* Ctrl+V already puts a clipboard image on the slide; this is the same
     road with a destination. navigator.clipboard.read is the only way to
     PULL rather than wait for a paste event, and it is permissioned and
     missing on some engines -- so it says what to do instead rather than
     failing silently. */
  function pasteObjImage(){
    function giveUp(){
      objInto=-1;
      toast('This browser will not hand over the clipboard on its own '
        +'\u2014 click the frame and press Ctrl+V instead');
    }
    if(!navigator.clipboard||!navigator.clipboard.read){giveUp();return;}
    navigator.clipboard.read().then(function(items){
      for(var i=0;i<items.length;i++){
        var ts=items[i].types||[];
        for(var j=0;j<ts.length;j++){
          if(ts[j].indexOf('image/')===0)
            return items[i].getType(ts[j]).then(function(b){
              if(!pasteImageFile(b)) giveUp();});
        }
      }
      giveUp();
    }).catch(giveUp);
  }
  var etImage=$('#et-image'),imgFile=$('#img-file');
  if(etImage&&imgFile) etImage.addEventListener('click',function(){
    /* showOpenFilePicker hands back a HANDLE, which is what lets the
       picture be re-read from disk later; the <input> can only ever hand
       back the bytes. So it is tried first and the input is the fallback
       for browsers without it (2026-08-22). */
    if(!window.showOpenFilePicker){imgFile.value='';imgFile.click();return;}
    window.showOpenFilePicker({multiple:false,types:[{
      description:'Images',
      accept:{'image/*':['.png','.jpg','.jpeg','.gif','.webp','.svg',
        '.bmp','.avif']}}]})
      .then(function(picks){
        var h=picks&&picks[0]; if(!h) return;
        var key=newFileKey();
        return idbPut(key,h).catch(function(){return null;})
          .then(function(){return h.getFile();})
          .then(function(f){
            return readAsDataURL(f).then(function(src){
              var probe=new Image();
              probe.onload=function(){
                placeImage(shrinkImage(probe,src,IMG_VIEW_EDGE),
                  (probe.naturalHeight||3)/(probe.naturalWidth||4),
                  {key:key,name:h.name||f.name||''},src);};
              probe.onerror=function(){
                placeImage(src,0,{key:key,name:h.name||''});};
              probe.src=src;
            });
          });
      }).catch(function(){});
  });
  if(imgFile) imgFile.addEventListener('change',function(){
    var f=this.files&&this.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){
      var src=rd.result;
      var probe=new Image();
      probe.onload=function(){
        placeImage(shrinkImage(probe,src,IMG_VIEW_EDGE),
          (probe.naturalHeight||3)/(probe.naturalWidth||4),null,src);};
      probe.onerror=function(){placeImage(src,0);};
      probe.src=src;
    };
    rd.readAsDataURL(f);
  });
  /* the format bar scrolls horizontally (overflow), which would CLIP a normal
     absolute dropdown — so the Crop / Animate menus float with position:fixed,
     positioned under their button each time they open */
  function floatMenu(btn,menu){
    menu.style.position='fixed';
    menu.style.zIndex='240';
    menu.style.right='auto';menu.style.bottom='auto';
    /* measure AFTER it is positionable, and clamp on BOTH axes: a tall
       catalogue opened from low down, or a wide one opened from the
       right-hand toolbar, would otherwise leave the screen */
    var r=btn.getBoundingClientRect();
    var mw=menu.offsetWidth||170;
    menu.style.left=Math.max(8,
      Math.min(r.left,window.innerWidth-mw-8))+'px';
    var mh=menu.offsetHeight||0;
    var top=r.bottom+4;
    if(mh&&top+mh>window.innerHeight-8)
      top=Math.max(8,Math.min(r.top-4-mh,window.innerHeight-mh-8));
    menu.style.top=top+'px';
  }
  /* ---- THE ONE OWNER OF TRANSIENT MENUS (T135 / JVUX-02) ------------
     Every dropdown used to carry its own open/close pair, and each knew
     only the siblings its author remembered -- so File and Present
     could stand open together, Background sat on top of the Layouts
     gallery, and a menu dismissed by an outside click left its trigger
     claiming aria-expanded=true (all three reproduced live before this
     existed). One rule now: at most one transient menu shows; showing
     a second closes the first; hiding ALWAYS resets the trigger's
     aria-expanded, whoever asked. The outside click and Escape live
     here once, installed by overlayBoot from THE BOOT SEQUENCE --
     never at eval (the T133 rule). Inspector panes are a different
     class of surface and have their own owner (T136). */
  var overlayNow=null;
  function overlayClose(){
    if(!overlayNow) return;
    overlayNow.menu.hidden=true;
    if(overlayNow.btn&&overlayNow.btn.setAttribute)
      overlayNow.btn.setAttribute('aria-expanded','false');
    overlayNow=null;
  }
  function overlayShow(btn,menu){
    if(!menu) return;
    if(overlayNow&&overlayNow.menu!==menu) overlayClose();
    menu.hidden=false;
    if(btn&&btn.setAttribute) btn.setAttribute('aria-expanded','true');
    overlayNow={btn:btn,menu:menu};
  }
  function overlayHide(menu){
    if(!menu) return;
    if(overlayNow&&overlayNow.menu===menu){overlayClose();return;}
    menu.hidden=true;
  }
  function overlayBoot(){
    document.addEventListener('click',function(e){
      if(!overlayNow) return;
      if(overlayNow.menu.contains(e.target)) return;
      var b=overlayNow.btn;
      if(b&&(e.target===b||(b.contains&&b.contains(e.target)))) return;
      overlayClose();
    });
    /* CAPTURE, and stopped there. An open menu is the innermost state
       you can be standing in, so Escape closes it and does nothing
       else: the ladder in 55-sections-and-strip.js (drop the tool, drop
       the selection, leave the editor) used to fire on the same key, so
       closing the Font window deselected the very box it was about
       (found driving T177, 2026-09-02). The gallery and the notes
       editor make the same choice for the same reason. */
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape'||!overlayNow) return;
      e.preventDefault();e.stopPropagation();
      var b=overlayNow.btn;
      overlayClose();
      /* keyboard dismissal returns focus to the trigger */
      if(b&&b.focus) b.focus();
    },true);
  }
  /* Open/close, shared by the WORDED dropdowns below and the DRAWN ones
     (line style, weight, ends, route) -- now just registration with the
     one owner above, which is what makes every wired menu exclusive and
     aria-honest for free. */
  function wireMenuToggle(wrapId,btnId,menuId){
    var wrap=$('#'+wrapId),btn=$('#'+btnId),menu=$('#'+menuId);
    if(!wrap||!btn||!menu) return null;
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(menu.hidden){overlayShow(btn,menu);floatMenu(btn,menu);}
      else overlayHide(menu);
    });
    return {wrap:wrap,btn:btn,menu:menu};
  }
  function wireFloatDropdown(wrapId,btnId,menuId,opts,attr,onPick,iconFn){
    var wrap=$('#'+wrapId),btn=$('#'+btnId),menu=$('#'+menuId);
    if(!wrap||!btn||!menu) return;
    opts.forEach(function(p){
      var o=document.createElement('button');
      o.className='sh-opt';o.setAttribute('data-'+attr,p[0]);o.title=p[1];
      if(iconFn){
        var ic=iconFn(p[0]); if(ic) o.appendChild(ic);
        var lbl=document.createElement('span');
        lbl.className='sh-opt-t';lbl.textContent=p[1];o.appendChild(lbl);
      } else o.textContent=p[1];
      o.addEventListener('click',function(e){
        e.stopPropagation();onPick(p[0]);
        menu.hidden=true;btn.setAttribute('aria-expanded','false');
      });
      menu.appendChild(o);
    });
    wireMenuToggle(wrapId,btnId,menuId);
  }
  /* ---- crop-to-shape dropdown (images + notebook cells) ---- */
  /* ---- DRAG-TO-TRIM: the crop the user reached for first. Picking
     "Rectangle" (now honestly "No crop") did nothing, because rectangle
     with no insets IS the uncropped state — the menu's most inviting
     option was a no-op (2026-08-19, user, twice). Trim mode shows four
     edge handles on the selected frame; dragging writes a.crop insets
     live, Esc or reselecting leaves the mode. ---- */
  var cropMode=false;
  function setCropMode(on){
    cropMode=!!on;
    var l=stage.querySelector('.annot-layer');
    if(l&&pres.slides[cur]){renderAnnots(l,pres.slides[cur]);paintSel(l);}
    if(on) toast('Drag the edge handles to trim. Esc to finish.');
  }
  /* ---- FREE CROP: DRAW THE OUTLINE (T64) ------------------------------
     A lasso over the selected picture. Points are collected in PERCENT
     of the item's own box, which is the currency every other geometry in
     this format uses -- so a drawn crop survives a resize, a page-size
     change and an export without a single conversion.

     It runs on an OVERLAY laid over the annot layer rather than through
     the canvas mousedown handler: that handler is the gatekeeper for
     selection, marquee, resize, rotate, group entry and eight tools, and
     a tenth mode inside it would be the tenth reason it is hard to
     reason about. The overlay wants the pointer and nothing else does.

     Douglas-Peucker would be the tidy way to thin the points; a fixed
     minimum spacing is two lines and is indistinguishable at the sizes a
     clip-path is drawn at, so that is what this does. */
  var freeArm=null;
  function armFreeCrop(){
    var s=pres.slides[cur];
    var idx=(typeof selAnnot==='number')?selAnnot:null;
    var a=(idx!=null)&&(s&&s.annots||[])[idx];
    if(!a||(a.k!=='image'&&a.k!=='cell')){
      toast('Select a picture or a figure first');
      return;
    }
    var layer=stage.querySelector('.annot-layer');
    var host=layer&&layer.querySelector('.an-item[data-idx="'+idx+'"]');
    if(!layer||!host){toast('Select a picture or a figure first');return;}
    if(freeArm) endFreeCrop(false);
    var ov=document.createElement('div');
    ov.className='crop-lasso';
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','cl-ink');
    svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('viewBox','0 0 100 100');
    var path=document.createElementNS(SVGNS,'polygon');
    path.setAttribute('class','cl-poly');
    svg.appendChild(path);ov.appendChild(svg);
    var hint=document.createElement('div');
    hint.className='cl-hint';
    hint.textContent='Drag around what you want to keep \u2014 Esc to '
      +'stop';
    ov.appendChild(hint);
    layer.appendChild(ov);
    freeArm={idx:idx,ov:ov,poly:path,pts:[],host:host,layer:layer};
    var box=host.getBoundingClientRect();
    function at(ev){
      return [((ev.clientX-box.left)/(box.width||1))*100,
              ((ev.clientY-box.top)/(box.height||1))*100];
    }
    function push(p){
      var pts=freeArm.pts,last=pts[pts.length-1];
      if(last&&Math.abs(last[0]-p[0])<1.2&&Math.abs(last[1]-p[1])<1.2)
        return;
      pts.push([Math.max(-5,Math.min(105,p[0])),
                Math.max(-5,Math.min(105,p[1]))]);
      freeArm.poly.setAttribute('points',pts.map(function(q){
        return q[0].toFixed(2)+','+q[1].toFixed(2);}).join(' '));
    }
    ov.addEventListener('pointerdown',function(ev){
      ev.preventDefault();ev.stopPropagation();
      box=host.getBoundingClientRect();
      freeArm.pts=[];freeArm.drawing=1;
      try{ov.setPointerCapture(ev.pointerId);}catch(e){}
      push(at(ev));
    });
    ov.addEventListener('pointermove',function(ev){
      if(!freeArm||!freeArm.drawing) return;
      ev.preventDefault();push(at(ev));
    });
    ov.addEventListener('pointerup',function(ev){
      if(!freeArm||!freeArm.drawing) return;
      ev.preventDefault();ev.stopPropagation();
      freeArm.drawing=0;
      endFreeCrop(true);
    });
    toast('Drag around the part of the picture you want to keep');
  }
  function endFreeCrop(commit){
    if(!freeArm) return;
    var f=freeArm; freeArm=null;
    if(f.ov&&f.ov.parentNode) f.ov.parentNode.removeChild(f.ov);
    if(!commit) return;
    if(f.pts.length<3){
      toast('That outline was too small to crop with \u2014 nothing '
        +'changed');
      return;
    }
    var s=pres.slides[cur],a=(s&&s.annots||[])[f.idx];
    if(!a) return;
    a.crop=a.crop||{};
    a.crop.path=f.pts.map(function(p){
      return [Math.round(p[0]*100)/100,Math.round(p[1]*100)/100];});
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,f.idx);}
    toast('Cropped to your outline \u2014 Ctrl+Z undoes it, and Reset '
      +'in the Crop menu clears it');
  }
  function mkCropHandles(host,layer,s2,idx){
    var a=s2.annots[idx]; if(!a) return;
    ['t','r','b','l'].forEach(function(side){
      var h=document.createElement('div');
      h.className='an-crop-h an-crop-'+side;
      var c2=a.crop||{};
      if(side==='t') h.style.top=(c2.t||0)+'%';
      if(side==='b') h.style.bottom=(c2.b||0)+'%';
      if(side==='l') h.style.left=(c2.l||0)+'%';
      if(side==='r') h.style.right=(c2.r||0)+'%';
      h.title='Trim the '+side+' edge';
      h.addEventListener('pointerdown',function(ev){
        ev.stopPropagation();ev.preventDefault();
        /* the rect FIRST: the shape-drop below re-renders and detaches
           this host, and a detached rect is all zeros. clip-path does not
           affect layout, so the captured rect stays valid for the drag. */
        var r=host.getBoundingClientRect();
        /* trimming is rectangular: cropCss ignores insets while a SHAPE
           crop is set, so dragging a handle under an ellipse moved the
           handle and changed nothing (2026-08-20 diagnosis). Starting a
           trim honestly drops the shape. */
        if(a.crop&&a.crop.shape){delete a.crop.shape;
          renderAnnots(layer,s2);paintSel(layer);}
        function mv(e2){
          var v;
          if(side==='t') v=(e2.clientY-r.top)/r.height*100;
          else if(side==='b') v=(r.bottom-e2.clientY)/r.height*100;
          else if(side==='l') v=(e2.clientX-r.left)/r.width*100;
          else v=(r.right-e2.clientX)/r.width*100;
          v=Math.max(0,Math.min(45,Math.round(v)));
          a.crop=a.crop||{};
          if(v) a.crop[side]=v; else delete a.crop[side];
          renderAnnots(layer,s2);paintSel(layer);
        }
        function up(){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
          if(a.crop&&!a.crop.shape&&!a.crop.t&&!a.crop.r
            &&!a.crop.b&&!a.crop.l) delete a.crop;
          markDirty();
          renderAnnots(layer,s2);paintSel(layer);
        }
        document.addEventListener('pointermove',mv);
        document.addEventListener('pointerup',up);
      });
      host.appendChild(h);
    });
  }
  /* ...on the CARET, not on the button: the button is the trim now */
  wireFloatDropdown('fmt-cropwrap','fmt-crop-caret','fmt-crop-menu',
    CROP_SHAPES,'shape',function(shape){
      fmtApply(function(a){
        a.crop=a.crop||{};
        if(shape==='rect'){
          delete a.crop.shape;
          if(!(a.crop.t||a.crop.r||a.crop.b||a.crop.l)) delete a.crop;
        } else a.crop.shape=shape;
      });
    },cropIcon);
  /* ---- rectangular TRIM (2026-08-04): the model always carried t/r/b/l
     inset percentages — this is the UI it never had. Four steppers in
     the crop menu, live on the selection: trimming whitespace off a
     figure is the single most common poster edit. ---- */
  (function(){
    var menu=$('#fmt-crop-menu'),btn=$('#fmt-crop-caret');
    if(!menu||!btn) return;
    /* the button itself arms the trim -- the row that used to say so is
       gone from the menu, because a menu row for what the button beside
       it already does is a second answer to one question (T64) */
    var cb=$('#fmt-crop');
    if(cb) cb.addEventListener('click',function(e){
      e.stopPropagation();
      menu.hidden=true;btn.setAttribute('aria-expanded','false');
      setCropMode(!cropMode);
    });
    /* DRAW THE OUTLINE YOURSELF. "There is no free crop as well where
       you can just draw a shape" -- there was not, and the shape
       gallery is no substitute for one: nine presets cannot follow the
       edge of a coastline or a brain scan. */
    var fc=document.createElement('button');fc.type='button';
    fc.className='ci-trim';
    fc.innerHTML=bic('pen')+' Draw the crop yourself';
    fc.title='Drag around the part you want to keep. Everything outside '
      +'the outline is hidden; the picture itself is untouched';
    fc.addEventListener('click',function(e){
      e.stopPropagation();
      menu.hidden=true;btn.setAttribute('aria-expanded','false');
      armFreeCrop();
    });
    menu.insertBefore(fc,menu.firstChild);
    var row=document.createElement('div');row.className='crop-inset';
    var lab=document.createElement('span');lab.className='ci-lab';
    lab.textContent='Trim edges %';row.appendChild(lab);
    var SIDES=[['t','top'],['r','right'],['b','bottom'],['l','left']];
    var inputs={};
    SIDES.forEach(function(p){
      var inp=document.createElement('input');
      inp.type='number';inp.min='0';inp.max='45';inp.step='1';
      inp.placeholder=p[1];
      inp.title='Trim the '+p[1]+' edge (% of the frame)';
      inp.addEventListener('click',function(e){e.stopPropagation();});
      inp.addEventListener('input',function(){
        var v=Math.max(0,Math.min(45,parseFloat(inp.value)||0));
        fmtApply(function(a){
          a.crop=a.crop||{};
          if(v) a.crop[p[0]]=v; else delete a.crop[p[0]];
          if(!a.crop.shape&&!a.crop.t&&!a.crop.r&&!a.crop.b&&!a.crop.l)
            delete a.crop;
        },true);              /* live preview, no history */
      });
      /* the gesture's END (blur / spinner release) commits ONE entry */
      inp.addEventListener('change',function(){
        fmtApply(function(){});
      });
      inputs[p[0]]=inp;row.appendChild(inp);
    });
    var rs=document.createElement('button');rs.type='button';
    rs.className='ci-reset';rs.textContent='Reset';
    /* ALL OF IT. It used to clear the trim and leave the shape, so
       pressing Reset on a star-cropped picture left it star-cropped --
       a button named for undoing everything that undid two thirds of it
       (T64). The picture is never altered by any of this, so there is
       nothing to lose by putting it all back. */
    rs.title='Clear every crop on this picture — the trim, the shape '
      +'and any outline you drew';
    rs.addEventListener('click',function(e){
      e.stopPropagation();
      SIDES.forEach(function(p){inputs[p[0]].value='';});
      fmtApply(function(a){
        if(a.crop) delete a.crop;
      });
    });
    row.appendChild(rs);
    menu.appendChild(row);
    /* opening the menu shows the SELECTION's current trim */
    btn.addEventListener('click',function(){
      var s=pres.slides[cur]; if(!s) return;
      var a=annotByIdx(s,selAnnot)
        ||(selSet.length?s.annots[selSet[0]]:null);
      SIDES.forEach(function(p){
        inputs[p[0]].value=(a&&a.crop&&a.crop[p[0]])||'';
      });
    });
  })();
  /* ---- READING ORDER (T106) -----------------------------------------
     The one place the slide's SEQUENCE is authored. orderedIdx's sweep
     (top-to-bottom, left-to-right) stays the default; this panel writes
     `sl.rord` — a list of oids, first-to-last — and the resolver in
     35-arranging overlays it, so builds, figure numbers, flip matching
     and the review export all follow without knowing it exists.
     An overlay with an explicit close (Esc or the ✕), NOT click-away:
     you need to click objects on the canvas while the numbers are
     showing, and the number badges themselves are CSS-gated on this
     panel being open — the same trick as the build bubbles (T76). */
  function rdClose(){
    var p=$('#rd-order'); if(p) p.remove();
    document.removeEventListener('keydown',rdKey,true);
  }
  function rdKey(e){
    if(e.key!=='Escape') return;
    if(!$('#rd-order')) return;
    e.preventDefault();e.stopPropagation();rdClose();
  }
  function openReadingOrder(){
    rdClose();
    var s=pres.slides[cur];
    if(!s||!(s.annots||[]).length){
      toast('Put something on this slide first \u2014 reading order '
        +'is read off what is there');
      return;
    }
    ensureOids(s);
    var p=document.createElement('div');
    p.className='sh-menu rd-order';p.id='rd-order';
    var head=menuHead(p,'reading order');
    var x=document.createElement('button');
    x.className='dbtn dc-icon rd-close';x.type='button';
    x.setAttribute('aria-label','Close');x.title='Close';
    x.innerHTML=bic('exit')||'\u2715';
    x.addEventListener('click',function(e){e.stopPropagation();
      rdClose();});
    head.appendChild(x);
    var note=document.createElement('div');note.className='rd-note';
    note.textContent='Builds (One by one), figure numbers and the '
      +'review outline all say this slide in this order. The numbers '
      +'show on the slide while this is open.';
    p.appendChild(note);
    var state=document.createElement('div');state.className='rd-state';
    var list=document.createElement('div');list.className='rd-list';
    p.appendChild(state);p.appendChild(list);
    var reset=document.createElement('button');
    reset.className='anim-mini wide rd-reset';
    reset.textContent='Back to automatic';
    reset.title='Forget the authored order \u2014 read top to bottom, '
      +'left to right again';
    reset.addEventListener('click',function(e){e.stopPropagation();
      var s2=pres.slides[cur]; if(!s2) return;
      delete s2.rord;
      markDirty();rdRepaint();render2();
      toast('Automatic reading order \u2014 top to bottom. '
        +'Ctrl+Z brings the authored one back.');
    });
    p.appendChild(reset);
    function rdRepaint(){
      var s2=pres.slides[cur],l=stage.querySelector('.annot-layer');
      if(l&&s2){renderAnnots(l,s2);paintSel(l);}
    }
    function move(pos,dir){
      var s2=pres.slides[cur]; if(!s2) return;
      ensureOids(s2);
      var ord=orderedIdx(s2);
      var to=pos+dir;
      if(to<0||to>=ord.length) return;
      var t=ord[pos];ord[pos]=ord[to];ord[to]=t;
      /* the FULL list every time: stale oids drop out, and what you
         see in the panel is exactly what is stored */
      s2.rord=ord.map(function(i){return s2.annots[i].oid;});
      markDirty();rdRepaint();render2();
    }
    function render2(){
      var s2=pres.slides[cur];
      state.textContent=(s2&&Array.isArray(s2.rord)&&s2.rord.length)
        ?'Custom \u2014 objects added later read last'
        :'Automatic \u2014 top to bottom, left to right';
      reset.hidden=!(s2&&Array.isArray(s2.rord)&&s2.rord.length);
      list.innerHTML='';
      var ord=s2?orderedIdx(s2):[];
      ord.forEach(function(idx,pos){
        var row=document.createElement('div');row.className='rd-row';
        var n=document.createElement('span');n.className='rd-num';
        n.textContent=(pos+1);row.appendChild(n);
        var lab=document.createElement('span');lab.className='rd-lab';
        lab.textContent=itemLabel(s2,idx);
        lab.title=lab.textContent;
        row.appendChild(lab);
        [['\u2191',-1,'Read this earlier'],
         ['\u2193',1,'Read this later']].forEach(function(m){
          var b=document.createElement('button');b.className='anim-mini';
          b.textContent=m[0];b.title=m[2];
          b.setAttribute('aria-label',m[2]);
          b.disabled=(m[1]<0?pos===0:pos===ord.length-1);
          b.addEventListener('click',function(e){e.stopPropagation();
            move(pos,m[1]);});
          row.appendChild(b);});
        list.appendChild(row);
      });
    }
    render2();
    document.body.appendChild(p);
    document.addEventListener('keydown',rdKey,true);
    rdRepaint();   /* badges are built on render; make them current */
  }
  window.SemDeckReadingOrder=openReadingOrder;
  window.addEventListener('resize',function(){
    if(deckEl.hidden) return;
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(s&&l) renderAnnots(l,s);
  });
  /* ---- PRESENTER VIEW --------------------------------------------------
     A second window holding the things the audience must not see: your
     notes, the slide that is coming, and a clock (2026-08-20, user:
     "presentation mode where you can have like the different screens one
     with the slides and the other with like notes and the next slide and
     stuff when you have multiple screens. Also would be cool if there was
     a time, and you can set time goals per slide").

     A POPUP you drag to the other display, not an automatic placement.
     The Window Management API that can put a window on a named screen is
     Chromium-only and needs a permission prompt; a popup works in every
     browser and on every setup, including the one where the second screen
     is a projector the OS is mirroring.

     The slides in it are REAL renders, not pictures: buildSlideNode uses
     the same renderAnnots every other output uses, and the nodes are
     imported into the popup. So a presenter view can never drift from
     what is on the screen behind it — there is only one renderer.

     Sync is a BroadcastChannel where there is one and a storage event
     where there is not; both are just "here is the state" one way and
     "do this" the other. */
  var presWin=null,presCh=null,presStart=0,presPaused=0,presPauseAt=0;
  function presChannel(){
    if(presCh) return presCh;
    try{
      presCh=new BroadcastChannel('junoview-presenter:'+SCOPE);
      presCh.onmessage=function(e){presenterCommand(e.data);};
    }catch(err){presCh=null;}
    return presCh;
  }
  /* the other window asked for something */
  function presenterCommand(msg){
    if(!msg||msg.jv!=='cmd') return;
    if(msg.do==='next') advance();
    else if(msg.do==='prev') backStep();
    else if(msg.do==='goto'&&typeof msg.n==='number') go(msg.n);
    else if(msg.do==='timer'){
      if(msg.act==='reset'){presStart=Date.now();presPaused=0;presPauseAt=0;
        rehResume();}
      else if(msg.act==='pause'&&!presPauseAt){
        presPauseAt=Date.now();rehPause();}
      else if(msg.act==='resume'&&presPauseAt){
        presPaused+=Date.now()-presPauseAt;presPauseAt=0;rehResume();}
    }
    else if(msg.do==='closed'){presWin=null;return;}
    presenterPush();
  }
  /* one slide, rendered the way every other output renders it */
  /* `priv` is OPT-IN, so the default is the safe one: a render path
     added later shows nothing private unless it asks for it (T31). */
  function buildSlideNode(i,priv){
    var sl=(pres.slides||[])[i];
    if(!sl) return null;
    var savedMode=mode,savedReveal=revealCount,savedCur=cur;
    var savedPriv=privCtx;
    privCtx=!!priv;
    mode='view';revealCount=99999;cur=i;
    var host=document.createElement('div');
    host.className='jvp-slidehost';
    host.style.cssText='position:fixed;left:-99999px;top:0;'
      +'width:960px;height:540px;';
    document.body.appendChild(host);
    var el=document.createElement('div');
    el.className=(sl.layout==='title')?'slide slide-titlefree'
      :'slide slide-blank';
    el.style.cssText='width:960px;height:540px;position:relative;';
    if(sl.layout==='title')
      el.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
    var bg=tokVal(sl.bg||pres.pageBg||'#0b141d');
    el.style.setProperty('background',bg,'important');
    host.appendChild(el);
    try{attachAnnots(el,sl);paintFurniture(el,i);}catch(err){}
    mode=savedMode;revealCount=savedReveal;cur=savedCur;
    privCtx=savedPriv;
    host.removeChild(el);
    host.remove();
    return el;
  }
  function presenterPush(){
    if(!presWin||presWin.closed){presWin=null;return;}
    var doc=presWin.document;
    if(!doc||!doc.getElementById('jvp-now')) return;
    var n=(pres.slides||[]).length;
    var sl=pres.slides[cur]||{};
    var shown=shownSlides(),shownAt=shown.indexOf(cur);
    var next=nextShown(cur,1);
    /* the two slide previews */
    [['jvp-now',cur],['jvp-next',next]].forEach(function(pr){
      var box=doc.getElementById(pr[0]);
      if(!box) return;
      box.innerHTML='';
      /* THE PRESENTER VIEW IS THE PRIVATE ONE. This is the whole
         point of T31: the same slide, drawn twice, and only this copy
         carries what you wrote for yourself. */
      var node=(pr[1]>=0&&pr[1]<n)?buildSlideNode(pr[1],true):null;
      if(node){
        var im=doc.importNode(node,true);
        box.appendChild(im);
        /* the node is built at a fixed 960x540 so its percentage geometry
           has something real to measure against; it is scaled into
           whatever box it lands in rather than re-rendered per size */
        var bw=box.clientWidth||480,bh=box.clientHeight||270;
        var k=Math.min(bw/960,bh/540);
        im.style.transform='scale('+(k||0.5).toFixed(4)+')';
        im.style.flex='none';
      }
      else box.innerHTML='<div class="jvp-end">end of the deck</div>';
    });
    var nt=doc.getElementById('jvp-notes');
    /* MARKDOWN, through the same notesHtml the editor previews (T28).
       It is escape-first and scheme-whitelisted, which is what lets a
       deck that arrived from someone else be read here at all. */
    if(nt) nt.innerHTML=(sl.notes||'').trim()
      ?notesHtml(sl.notes)
      :'<p class="jvp-nonotes">No notes for this slide.</p>';
    var ct=doc.getElementById('jvp-count');
    if(ct) ct.textContent=(shownAt>=0?shownAt+1:0)+' / '+shown.length;
    var gl=doc.getElementById('jvp-goal');
    if(gl){
      var g=slideGoal(sl),st=rehFor(sl),bits=[];
      if(g) bits.push('target '+fmtMins(g));
      /* what you ACTUALLY take here, which is the number that changes
         what you do next (T29) */
      if(st) bits.push('usually '+fmtMins(st.mean/60));
      gl.textContent=bits.join(' \u00b7 ');
    }
    var tt=doc.getElementById('jvp-talk');
    if(tt){
      var want=pres.talkMins||0,tot=goalTotal();
      tt.textContent=want?('talk '+want+' min')
        :(tot?('planned '+fmtMins(tot)):'');
    }
    presWin.__jvState={start:presStart,paused:presPaused,
      pauseAt:presPauseAt,goal:slideGoal(sl),
      talk:pres.talkMins||0,slide:shownAt,count:shown.length,
      slideIndex:cur};
  }
  function presenterHtml(){
    /* every stylesheet the deck uses, so the imported slide nodes look
       exactly as they do on screen */
    var css='';
    $$('style').forEach(function(st){css+=st.textContent+'\n';});
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      +'<title>Presenter view</title><style>'+css
      +'\nhtml,body{margin:0;height:100%;background:#070d13;color:#dce6ee;'
      +'font-family:var(--sans,system-ui);overflow:hidden;}'
      +'.jvp{display:grid;grid-template-columns:1.35fr 1fr;'
      +'grid-template-rows:auto 1fr auto;gap:12px;height:100%;'
      +'box-sizing:border-box;padding:12px;}'
      +'.jvp-bar{grid-column:1/-1;display:flex;align-items:center;gap:14px;}'
      +'.jvp-clock{font-family:var(--mono,monospace);font-size:44px;'
      +'font-weight:600;line-height:1;letter-spacing:.02em;}'
      +'.jvp-clock.over{color:#ff8a7a;}'
      +'.jvp-sub{font-family:var(--mono,monospace);font-size:12px;'
      +'color:#8ea4b6;display:flex;flex-direction:column;gap:2px;}'
      +'.jvp-sp{flex:1;}'
      +'.jvp-b{font-family:var(--mono,monospace);font-size:12px;'
      +'padding:7px 13px;border-radius:7px;cursor:pointer;'
      +'background:#ffffff0f;border:1px solid #ffffff2b;color:#dce6ee;}'
      +'.jvp-b:hover{border-color:#39a9c0;color:#fff;}'
      +'.jvp-b.primary{background:#39a9c0;border-color:#39a9c0;color:#04222b;'
      +'font-weight:600;}'
      +'.jvp-stage{position:relative;background:#000;border-radius:10px;'
      +'overflow:hidden;display:flex;align-items:center;'
      +'justify-content:center;min-height:0;}'
      +'.jvp-stage .slide{transform-origin:center center;}'
      +'.jvp-side{display:flex;flex-direction:column;gap:10px;min-height:0;}'
      +'.jvp-nextwrap{flex:0 0 34%;display:flex;flex-direction:column;'
      +'gap:4px;min-height:0;}'
      +'.jvp-lab{font-family:var(--mono,monospace);font-size:10px;'
      +'letter-spacing:.14em;text-transform:uppercase;color:#7d93a6;}'
      +'.jvp-notes{flex:1;min-height:0;overflow-y:auto;'
      +'font-size:19px;line-height:1.5;background:#0e1926;border-radius:10px;'
      +'padding:14px 16px;border:1px solid #ffffff1a;}'
      /* the small markdown, at reading-from-a-lectern size */
      +'.jvp-notes p{margin:0 0 .6em;}'
      +'.jvp-notes h3,.jvp-notes h4,.jvp-notes h5{margin:.2em 0 .4em;'
      +'font-size:1.05em;color:#fff;}'
      +'.jvp-notes ul,.jvp-notes ol{margin:.2em 0 .6em;padding-left:1.3em;}'
      +'.jvp-notes li{margin:.15em 0;}'
      +'.jvp-notes code{font-family:var(--mono,monospace);font-size:.85em;'
      +'background:#ffffff14;padding:.1em .35em;border-radius:4px;}'
      +'.jvp-notes blockquote{margin:.3em 0 .6em;padding-left:.8em;'
      +'border-left:3px solid #ffffff2b;color:#a9bccc;}'
      +'.jvp-notes hr{border:0;border-top:1px solid #ffffff26;'
      +'margin:.7em 0;}'
      +'.jvp-notes a{color:#6fd0e4;}'
      +'.jvp-notes .jvn-goto{cursor:pointer;text-decoration:underline '
      +'dotted;}'
      +'.jvp-nonotes{color:#6e8394;}'
      +'.jvp-end{color:#6e8394;font-family:var(--mono,monospace);'
      +'font-size:13px;}'
      +'.jvp-find{flex:0 0 auto;font-family:var(--sans,system-ui);'
      +'font-size:14px;padding:8px 11px;border-radius:8px;'
      +'background:#0e1926;color:#dce6ee;border:1px solid #ffffff2b;}'
      +'.jvp-find:focus{outline:none;border-color:#39a9c0;}'
      +'.jvp-hits{flex:0 0 auto;max-height:24%;overflow-y:auto;'
      +'display:none;flex-direction:column;gap:2px;}'
      +'.jvp-hits.on{display:flex;}'
      +'.jvp-hit{text-align:left;background:#ffffff08;color:#dce6ee;'
      +'border:1px solid #ffffff17;border-radius:7px;padding:6px 9px;'
      +'cursor:pointer;font-size:12.5px;line-height:1.35;}'
      +'.jvp-hit:hover{border-color:#39a9c0;}'
      +'.jvp-hit b{font-family:var(--mono,monospace);font-size:10px;'
      +'color:#8ea4b6;font-weight:400;margin-right:6px;}'
      +'.jvp-hit i{color:#8ea4b6;font-style:normal;}'
      +'.jvp-nohit{color:#6e8394;font-size:12px;padding:6px 2px;}'
      +'.jvp-foot{grid-column:1/-1;display:flex;gap:8px;align-items:center;}'
      +'</style></head><body><div class="jvp">'
      +'<div class="jvp-bar">'
      +'<span class="jvp-clock" id="jvp-clock">0:00</span>'
      +'<span class="jvp-sub"><span id="jvp-count"></span>'
      +'<span id="jvp-goal"></span><span id="jvp-talk"></span>'
      +'<span id="jvp-slideclock"></span></span>'
      +'<span class="jvp-sp"></span>'
      +'<button class="jvp-b" id="jvp-pause">Pause</button>'
      +'<button class="jvp-b" id="jvp-reset">Reset clock</button>'
      +'</div>'
      +'<div class="jvp-stage" id="jvp-now"></div>'
      +'<div class="jvp-side">'
      +'<div class="jvp-nextwrap"><span class="jvp-lab">next</span>'
      +'<div class="jvp-stage" id="jvp-next"></div></div>'
      +'<span class="jvp-lab">notes</span>'
      +'<div class="jvp-notes" id="jvp-notes"></div>'
      /* SEARCH, in the window you are actually looking at (T30). The
         same slideHits the map filters with -- one matcher, two doors. */
      +'<input class="jvp-find" id="jvp-find" type="search" '
      +'placeholder="Find a slide\u2026" aria-label="Find a slide">'
      +'<div class="jvp-hits" id="jvp-hits"></div></div>'
      +'<div class="jvp-foot">'
      +'<button class="jvp-b" id="jvp-prev">&#8592; Back</button>'
      +'<button class="jvp-b primary" id="jvp-next-b">Next &#8594;</button>'
      +'<span class="jvp-sp"></span>'
      +'<span class="jvp-lab">drag this window to your other screen, then '
      +'press Present on the first one</span>'
      +'</div></div></body></html>';
  }
  function openPresenter(){
    if(presWin&&!presWin.closed){presWin.focus();presenterPush();return;}
    var w=null;
    try{
      w=window.open('','junoview-presenter',
        'width=1100,height=720,menubar=no,toolbar=no');
    }catch(err){w=null;}
    if(!w){
      toast('Your browser blocked the presenter window — allow pop-ups '
        +'for this page and try again');
      return;
    }
    presWin=w;
    w.document.open();
    w.document.write(presenterHtml());
    w.document.close();
    if(!presStart) presStart=Date.now();
    var d=w.document;
    function send(m){
      /* same-window handle first: it always works, channel or not */
      presenterCommand(m);
    }
    d.getElementById('jvp-prev').onclick=function(){
      send({jv:'cmd',do:'prev'});};
    d.getElementById('jvp-next-b').onclick=function(){
      send({jv:'cmd',do:'next'});};
    d.getElementById('jvp-reset').onclick=function(){
      send({jv:'cmd',do:'timer',act:'reset'});};
    var pb=d.getElementById('jvp-pause');
    pb.onclick=function(){
      var paused=!!(presWin.__jvState&&presWin.__jvState.pauseAt);
      send({jv:'cmd',do:'timer',act:paused?'resume':'pause'});
      pb.textContent=paused?'Pause':'Resume';
    };
    /* TYPE TO FIND ONE, in the window you are looking at (T30). Built
       here rather than in the popup's own script because the popup has
       no script: everything it does is wired from this side, which is
       what keeps the two windows from drifting. */
    var fi=d.getElementById('jvp-find'),hits=d.getElementById('jvp-hits');
    function drawHits(){
      var q=fi.value.trim();
      hits.innerHTML='';
      hits.classList.toggle('on',!!q);
      if(!q) return;
      var found=slideHits(q);
      if(!found.length){
        var no=d.createElement('div');
        no.className='jvp-nohit';no.textContent='No slide says that.';
        hits.appendChild(no);return;
      }
      found.forEach(function(h){
        var b=d.createElement('button');
        b.className='jvp-hit';
        var num=d.createElement('b');
        num.textContent=(h.i+1);
        b.appendChild(num);
        if(h.where){
          var wh=d.createElement('i');
          wh.textContent=h.where+' \u2014 ';
          b.appendChild(wh);
        }
        b.appendChild(d.createTextNode(h.snip));
        b.onclick=function(){
          send({jv:'cmd',do:'goto',n:h.i});
          fi.value='';drawHits();
        };
        hits.appendChild(b);
      });
    }
    fi.addEventListener('input',drawHits);
    fi.addEventListener('keydown',function(e){
      e.stopPropagation();      /* the arrow keys below drive the TALK */
      if(e.key==='Escape'){fi.value='';drawHits();}
      else if(e.key==='Enter'){
        var first=hits.querySelector('.jvp-hit');
        if(first) first.click();
      }
    });
    /* [the method](#7) in a note jumps the talk there. `goto` was
       already a command the strip used, so a reference is a use of the
       machinery rather than a new one (T28). */
    d.getElementById('jvp-notes').addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('.jvn-goto');
      if(!a) return;
      e.preventDefault();
      send({jv:'cmd',do:'goto',n:(+a.dataset.slide||1)-1});
    });
    /* the arrow keys work in the presenter window too - you will have the
       clicker pointed at whichever window has focus */
    d.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){
        e.preventDefault();send({jv:'cmd',do:'next'});}
      else if(e.key==='ArrowLeft'||e.key==='PageUp'){
        e.preventDefault();send({jv:'cmd',do:'prev'});}
    });
    w.addEventListener('beforeunload',function(){presWin=null;});
    /* the clock ticks in the presenter window, off state the main window
       owns - so pausing on either side agrees */
    w.setInterval(function(){
      var st=w.__jvState; if(!st) return;
      var now=st.pauseAt||Date.now();
      var ms=now-st.start-st.paused;
      var sec=Math.max(0,Math.round(ms/1000));
      var cl=d.getElementById('jvp-clock');
      cl.textContent=Math.floor(sec/60)+':'+('0'+(sec%60)).slice(-2);
      var over=st.talk&&sec>st.talk*60;
      cl.classList.toggle('over',!!over);
      var sc=d.getElementById('jvp-slideclock');
      if(sc){
        if(!st.talk) sc.textContent='';
        else {
          var left=Math.round(st.talk*60-sec);
          sc.textContent=left>=0
            ?(Math.floor(left/60)+':'+('0'+(left%60)).slice(-2)+' left')
            :(Math.floor(-left/60)+':'+('0'+((-left)%60)).slice(-2)
              +' OVER');
        }
      }
    },250);
    presenterPush();
    toast('Presenter view opened — drag it to your other screen');
  }
  /* the main window tells the presenter whenever anything moves */
  function presenterSync(){
    if(presWin&&!presWin.closed) presenterPush();
  }
  function buildsForSlide(i){
    /* stepping BACKWARDS into a slide shows it as you left it: fully
       built, and every flip book on its last frame */
    var s=pres.slides[i];return s?slideStops(s):0;
  }
  /* ---- HOW A SLIDE ARRIVES, AND WHAT TRAVELS WITH IT ------------------
     (TASKS T27, and the substrate T23's "section transitions" needed and
     did not have.)

     THE DESIGN NOTE.

     1. THERE WAS NO TRANSITION MODEL AT ALL. Not a missing feature — a
        missing FIELD. renderSlide() emptied the stage and rebuilt it, and
        nothing anywhere said how a slide should arrive. So the first
        thing here is `s.trans`, and it is per-slide because that is how
        anybody thinks about it ("this one flies in from the last") and
        because a deck-wide setting cannot express the one case the whole
        feature is for. A SECTION may set a default, which is what makes
        T23's section transitions real rather than a note.

     2. IDENTITY ACROSS SLIDES WAS THE HARD PART, AND IT WAS ALREADY
        SOLVED. T10 gave every object an `oid` so its history could be
        read; `ensureOids` de-duplicates WITHIN a slide but never across
        them — which means a DUPLICATED SLIDE keeps its source's oids.
        That is not a coincidence to exploit, it is the exact shape of
        how anyone builds a Magic Move: duplicate the slide, move the
        thing. So continuity comes free for the way people actually work,
        and matchKey (the slide-matching machinery TASKS.md points at) is
        the fallback for the pair of slides that were built separately.

     3. THE ANIMATION IS FLIP, and that is what lets it exist without a
        second renderer. Measure the outgoing slide's items, let
        renderSlide rebuild the page exactly as it always does, then put
        each surviving item BACK where it was with a transform and take
        the transform away. The browser animates the difference. No item
        is drawn twice, no state is duplicated, and if anything goes
        wrong the page is already correct — the transform is a lie told
        for 420ms over a page that is right underneath it.

     4. IT COMPOSES WITH ROTATION. applyCommon writes `transform` for
        a.rot, so the FLIP transform is PREFIXED onto whatever is there
        and removed by restoring the original string, never by clearing
        it. Getting that wrong un-rotates every rotated object mid-talk. */
  var TRANS=[
    ['','Cut','Nothing — the next slide is simply there.'],
    ['fade','Fade','A short cross-fade.'],
    ['move','Move matching objects',
     'Anything on both slides slides, grows or shrinks from where it '
     +'was to where it is. Duplicate a slide and move something, and '
     +'this is what you get.']
  ];
  var TRANS_MS=420;
  function transLabel(kind){
    var lab='';
    TRANS.forEach(function(t){if(t[0]===(kind||'')) lab=t[1];});
    return lab;
  }
  /* the transition to use ARRIVING at slide i: the slide's own, else its
     section's, else none. */
  function transFor(i){
    var sl=(pres.slides||[])[i];
    if(!sl) return '';
    if(typeof sl.trans==='string') return sl.trans;
    var sec=sl.sec&&(pres.sections||{})[sl.sec];
    if(sec&&typeof sec.trans==='string') return sec.trans;
    return '';
  }
  /* WHAT AN OBJECT IS CALLED, for the purpose of matching it across two
     slides. The oid when there is one — which a duplicated slide gives
     for free — and matchKey plus its position in reading order
     otherwise, which is the same pairing Match slide has always used. */
  function flipKeys(sl){
    var out={},seen={};
    var ord=orderedIdx(sl||{});
    ord.forEach(function(i){
      var a=(sl.annots||[])[i];
      if(!a||a.hide) return;
      var k=a.oid?('o:'+a.oid):null;
      if(!k){
        var mk=matchKey(a);
        seen[mk]=(seen[mk]||0)+1;
        k='m:'+mk+':'+seen[mk];
      }
      out[i]=k;
    });
    return out;
  }
  /* WHOSE DECISION THIS IS. core.css already turns every transition off
     under prefers-reduced-motion, so an animation would not have played
     anyway — it would have gone through the motions of moving twelve
     elements and produced a cut. Asking the question here means the
     preference is honoured deliberately rather than by accident, and it
     is why the menu can say so instead of offering a control that
     quietly does nothing. (Windows with animation effects switched off
     reports this, and so does headless Edge — app.js has been round
     this once already.) */
  function motionOK(){
    try{
      return !window.matchMedia
        ||!matchMedia('(prefers-reduced-motion: reduce)').matches;
    }catch(e){return true;}
  }
  var _flipFrom=null;
  /* measure the OUTGOING slide, before renderSlide empties the stage */
  function captureFlip(fromIdx){
    _flipFrom=null;
    if(mode!=='view') return;
    var sl=(pres.slides||[])[fromIdx];
    var layer=stage?stage.querySelector('.annot-layer'):null;
    if(!sl||!layer) return;
    var lr=layer.getBoundingClientRect();
    if(!lr.width||!lr.height) return;
    var keys=flipKeys(sl),map={};
    Object.keys(keys).forEach(function(i){
      var el=layer.querySelector('.an-item[data-idx="'+i+'"]');
      if(!el) return;
      var r=el.getBoundingClientRect();
      if(!r.width||!r.height) return;
      map[keys[i]]={x:r.left-lr.left,y:r.top-lr.top,
        w:r.width,h:r.height,in:flipInnerBox(el,lr)};
    });
    _flipFrom={map:map,lr:{w:lr.width,h:lr.height}};
  }
  /* THE CONTENT, not the box. T27 promised "slides, grows or shrinks",
     and zooming into a region is the third of those — but a content zoom
     (a.ts, written as `zoom` on the body node) and a crop (a.crop,
     written as a clip-path on the same node) change what you see INSIDE
     an item without moving the .an-item by a pixel. playFlip compared
     only the .an-item, so its "nothing moved" guard threw exactly that
     case away (2026-08-26 audit, T57).
     Found by the style the renderer actually writes rather than by class
     name, because the same two properties are written onto a cell body,
     a locked version card and an image by three different branches. */
  function flipInnerEl(el){
    if(!el||!el.querySelector) return null;
    return el.querySelector('[style*="zoom"],[style*="clip-path"]');
  }
  function flipInnerBox(el,lr){
    var n=flipInnerEl(el); if(!n) return null;
    var r=n.getBoundingClientRect();
    if(!r.width||!r.height) return null;
    return {x:r.left-lr.left,y:r.top-lr.top,w:r.width,h:r.height,
      clip:n.style.clipPath||n.style.webkitClipPath||''};
  }
  /* put the survivors back where they were, then let them travel */
  function playFlip(){
    var from=_flipFrom;
    _flipFrom=null;
    /* "skip animations" means the fade/move between slides too
       (T126) -- a build held back and a transition still playing would
       be half an answer to "goes without animations" */
    if(!from||mode!=='view'||!motionOK()||talkNoBuilds) return;
    var kind=transFor(cur);
    var sl=pres.slides[cur];
    var layer=stage?stage.querySelector('.annot-layer'):null;
    if(!sl||!layer) return;
    if(kind==='fade'){
      var sEl=stage.querySelector('.slide');
      if(sEl){
        sEl.style.transition='none';
        sEl.style.opacity='0';
        void sEl.offsetWidth;
        sEl.style.transition='opacity '+TRANS_MS+'ms ease';
        sEl.style.opacity='';
        setTimeout(function(){
          sEl.style.transition='';},TRANS_MS+60);
      }
      return;
    }
    if(kind!=='move') return;
    var lr=layer.getBoundingClientRect();
    if(!lr.width||!lr.height) return;
    var keys=flipKeys(sl),moved=[],clipped=[];
    Object.keys(keys).forEach(function(i){
      var was=from.map[keys[i]];
      if(!was) return;
      var el=layer.querySelector('.an-item[data-idx="'+i+'"]');
      if(!el) return;
      var r=el.getBoundingClientRect();
      if(!r.width||!r.height) return;
      var now={x:r.left-lr.left,y:r.top-lr.top,w:r.width,h:r.height};
      var dx=was.x-now.x,dy=was.y-now.y;
      var sx=was.w/now.w,sy=was.h/now.h;
      /* THE SAME FLIP, one level in. Done before the box's own guard, so
         a zoom or a crop that left the box alone still animates. */
      var innerEl=flipInnerEl(el),wasIn=was.in;
      if(innerEl&&wasIn){
        var nowIn=flipInnerBox(el,lr);
        if(nowIn){
          var idx2=wasIn.x-nowIn.x,idy=wasIn.y-nowIn.y;
          var isx=wasIn.w/nowIn.w,isy=wasIn.h/nowIn.h;
          if(Math.abs(idx2)>=1||Math.abs(idy)>=1
             ||Math.abs(isx-1)>=0.01||Math.abs(isy-1)>=0.01){
            var ibase=innerEl.style.transform||'';
            innerEl.dataset.jvFlip=ibase;
            innerEl.style.transformOrigin='0 0';
            innerEl.style.transition='none';
            innerEl.style.transform='translate('+idx2+'px,'+idy+'px)'
              +' scale('+isx.toFixed(4)+','+isy.toFixed(4)+') '+ibase;
            moved.push(innerEl);
          }
          /* a crop is a clip-path, which the browser will interpolate
             between two insets of the same shape — so hand it the old
             one and let the transition do the rest */
          if(wasIn.clip&&nowIn.clip&&wasIn.clip!==nowIn.clip
             &&/^inset\(/.test(wasIn.clip)&&/^inset\(/.test(nowIn.clip)){
            innerEl.dataset.jvClip=nowIn.clip;
            innerEl.style.transition='none';
            innerEl.style.clipPath=wasIn.clip;
            innerEl.style.webkitClipPath=wasIn.clip;
            clipped.push(innerEl);
          }
        }
      }
      /* a pixel here and there is not a move; animating it would only
         add a shimmer to a slide that did not change */
      if(Math.abs(dx)<1&&Math.abs(dy)<1
         &&Math.abs(sx-1)<0.01&&Math.abs(sy-1)<0.01) return;
      /* PREFIXED, and restored by putting the original string back:
         applyCommon owns this property for a.rot, and clearing it would
         un-rotate every rotated object mid-talk */
      var base=el.style.transform||'';
      el.dataset.jvFlip=base;
      el.style.transformOrigin='0 0';
      el.style.transition='none';
      el.style.transform='translate('+dx+'px,'+dy+'px) scale('
        +sx.toFixed(4)+','+sy.toFixed(4)+') '+base;
      moved.push(el);
    });
    if(!moved.length&&!clipped.length) return;
    void layer.offsetWidth;         /* one reflow for the whole set */
    moved.forEach(function(el){
      el.style.transition='transform '+TRANS_MS+'ms cubic-bezier('
        +'.4,0,.2,1)';
      el.style.transform=el.dataset.jvFlip||'';
    });
    clipped.forEach(function(el){
      var tr=el.style.transition;
      el.style.transition=(tr&&tr!=='none'?tr+',':'')
        +'clip-path '+TRANS_MS+'ms cubic-bezier(.4,0,.2,1)';
      el.style.clipPath=el.dataset.jvClip;
      el.style.webkitClipPath=el.dataset.jvClip;
    });
    setTimeout(function(){
      moved.forEach(function(el){
        el.style.transition='';
        el.style.transformOrigin='';
        /* restore, never clear: the base string is what applyCommon
           wrote and may carry a rotation */
        el.style.transform=el.dataset.jvFlip||'';
        delete el.dataset.jvFlip;
      });
      clipped.forEach(function(el){
        el.style.transition='';
        delete el.dataset.jvClip;
      });
    },TRANS_MS+80);
  }
  /* CUT IS AN ANSWER, not the absence of one. TRANS[0][0] is '', and
     this used to `delete sl.trans` for any falsy kind — so "arrives cut"
     and "stop overriding the section" were the same write, and inside a
     section defaulting to Fade there was no way to say the first:
     transFor fell straight back to the section while the toast claimed
     the slide arrived cut (2026-08-26 audit, T57).
     `null` is the clear now, and '' is a real override. A SECTION needs
     no such distinction — nothing sits above one for its Cut to be
     confused with — which is why setSectionTrans below still deletes. */
  function setTrans(i,kind){
    var sl=(pres.slides||[])[i]; if(!sl) return;
    if(kind==null) delete sl.trans; else sl.trans=String(kind);
    markDirty();renderFilm();
    toast(kind==null
      ?('This slide arrives however its section says: '
        +transLabel(transFor(i)).toLowerCase())
      :('This slide arrives: '+transLabel(kind).toLowerCase()));
  }
  function setSectionTrans(id,kind){
    var m=(pres.sections||{})[id]; if(!m) return;
    if(kind) m.trans=kind; else delete m.trans;
    markDirty();renderFilm();
    var lab=transLabel(kind);
    toast('Every slide in this section arrives: '+lab.toLowerCase());
  }
  /* ---- FINDING A SLIDE WHILE YOU ARE TALKING --------------------------
     (TASKS T30.) "Type-to-search titles and content while presenting;
     jump straight to a slide."

     ONE MATCHER, TWO WINDOWS. The question — where is the slide about
     the residuals? — is the same whether you are looking at the
     presenter view or driving from the only screen you have, so
     `slideHits` is written once and both doors call it. A second
     matcher would be a second answer, and they would disagree the first
     time either grew a field.

     WHAT COUNTS AS THE SLIDE'S WORDS: its name, every piece of text on
     it (text boxes, table cells, captions, a title slide's title and
     subtitle) and its speaker notes. Notes are in because "where did I
     say that" is exactly the question being asked at the lectern — but
     a hit that is ONLY in the notes says so, because jumping to a slide
     expecting to see a word on the screen and not finding it is worse
     than not finding the slide.

     AND THE MAP IS THE SEARCH RESULTS. T26 already built the overview:
     every slide, in its sections, click to go. A filter on top of that
     IS "type-to-search and jump", so the door is a search box in the map
     rather than a second piece of navigation furniture — and the map
     becomes reachable while presenting, which is the only reason it was
     not already the answer. */
  function slideWords(sl){
    if(!sl) return {on:'',notes:''};
    var on=[];
    if(sl.label) on.push(sl.label);
    if(sl.layout==='title'){on.push(sl.title||'');on.push(sl.sub||'');}
    (sl.annots||[]).forEach(function(a){
      if(!a||a.hide) return;
      if(a.k==='text'&&a.text) on.push(a.text);
      if(a.k==='table'&&Array.isArray(a.rows))
        a.rows.forEach(function(r){
          (r||[]).forEach(function(c){
            if(typeof c==='string'&&c) on.push(c);
            else if(c&&typeof c.t==='string'&&c.t) on.push(c.t);
          });
        });
      if(a.cap&&typeof a.cap==='string') on.push(a.cap);
      /* A NOTEBOOK CARD'S WORDS ARE ON THE SLIDE. This loop knew about
         text, tables and captions, and the only route to a cell was the
         single slideTitle() call below — which returns one title. So a
         paragraph of prose placed from a notebook was visibly on the
         slide and invisible to the presenter's own search (2026-08-26
         audit, T57). embBody has already parsed the html for
         cellFacets; nothing here is new work. */
      if(a.k==='cell'&&a.ref){
        var it=resolveRef(a.ref);
        if(it&&it.title) on.push(it.title);
        var bn=(typeof embBody==='function')?embBody(a.ref):null;
        /* A LIVE PAGE keeps the card in the notebook's own DOM rather
           than in the embedded map, and a deck can be opened either way
           — so ask the map first and the page second, and never come
           back with nothing when the words are plainly there. */
        var live=(!bn&&typeof cardEl==='function')?cardEl(a.ref):null;
        var bt=String((bn&&bn.textContent)||(live&&live.textContent)||'')
          .replace(/\s+/g,' ').trim();
        /* THE CODE COUNTS TOO. A frame showing a code card draws the code,
           so a name defined in it is as visibly on the slide as a
           paragraph is — and the commonest thing anyone hunts a slide by
           is the function that made the figure. */
        var ef=(typeof embFor==='function')?embFor(a.ref):null;
        var ct=(ef&&ef.code)?String(ef.code).replace(/\s+/g,' ').trim():'';
        /* GENEROUS, because this string is what the search MATCHES and
           the snippet is cut from around the hit rather than from the
           front of it — a tight cap here would put a word plainly on
           the slide back out of reach, which is the whole defect. The
           bound is only about the cost of running this per keystroke. */
        [bt,ct].forEach(function(w){
          if(w) on.push(w.length>4000?w.slice(0,4000):w);});
      }
    });
    var t=slideTitle(sl);
    if(t) on.push(t);
    /* slideTitle usually RETURNS one of the pieces already collected --
       a slide whose only text is its heading is named by that heading --
       so the snippet would otherwise read "the word · the word" */
    var seen={},uniq=[];
    on.forEach(function(p){
      var k=String(p).trim(); if(!k||seen[k]) return;
      seen[k]=1;uniq.push(k);
    });
    return {on:uniq.join(' · '),notes:(sl.notes||'')};
  }
  /* every slide whose words contain the query, in deck order, each with
     enough context to tell one hit from another */
  function slideHits(q){
    q=String(q||'').trim().toLowerCase();
    if(!q) return [];
    var out=[];
    (pres.slides||[]).forEach(function(sl,i){
      var w=slideWords(sl);
      var inOn=w.on.toLowerCase().indexOf(q)>=0;
      var inNotes=w.notes.toLowerCase().indexOf(q)>=0;
      if(!inOn&&!inNotes) return;
      /* the snippet comes from wherever the hit actually was */
      var src=inOn?w.on:w.notes;
      var at=src.toLowerCase().indexOf(q);
      var from=Math.max(0,at-28);
      out.push({i:i,onSlide:inOn,
        where:inOn?'':'in the notes',
        snip:(from?'…':'')+src.slice(from,at+q.length+34).trim()
          +((at+q.length+34)<src.length?'…':'')});
    });
    return out;
  }
  /* ---- WHAT THIS DECK USED TO BE --------------------------------------
     (TASKS T32.) Snapshots on save, a slide-by-slide comparison of two
     versions, and getting a destroyed slide back.

     1. INDEXEDDB, NOT localStorage. A snapshot is the whole deck, and a
        deck carries placed images as data URIs. localStorage's quota has
        already bitten this project once — it is why self-contained decks
        keep figures out of the pres object — and twenty copies of a deck
        is exactly the shape of that problem. IndexedDB is already open
        here for file handles, so this is a second use of a store that
        exists rather than a new dependency.

        ONE RECORD PER SNAPSHOT, plus a small index. Keeping the list in
        one record would mean rewriting every snapshot on every save,
        which for a deck full of images is megabytes per keystroke-worth
        of work. The index holds only what the list needs to draw itself
        — the same reason `pres.cuts` holds only names.

     2. THE SAME RULE THE NOTEBOOK USES: one when you open it, one on
        every explicit save, deduped when nothing changed, capped. A
        history that records the same deck nine times is a history you
        cannot read, and the dedupe is what makes "open, look, close"
        cost nothing.

     3. THE COMPARISON PAIRS SLIDES BY `sid`, WHICH IS WHY T29 MATTERED
        MORE THAN IT LOOKED. Pairing by index reports "everything from
        slide 4 down has changed" the moment you insert one, which is not
        a diff, it is noise. With a durable name per slide the answer is
        the true one: this slide changed, that one moved, this one is
        new, that one is gone. So the mint point widens — T29 minted a
        sid on first rehearsal; a deck is now named whenever it is
        RECORDED, which is the first moment identity has to exist.
        Snapshots taken before that fall back to positional pairing and
        the panel says so, rather than pretending.

     4. THE MINI DIAGRAM FIRST, THE REAL RENDER ON DEMAND. Drawing forty
        slides twice, fully, to answer "what changed" would take seconds
        and most rows are identical. The strip's own thumbnail shows a
        moved box or a lost figure at a glance; opening a row renders
        both sides properly. Same renderer either way — there is no
        second drawing of a slide anywhere in this file, and this does
        not become the first. */
  var HIST_KEEP=20,histOps=Promise.resolve();
  /* ---- BRANCHES (T90, 2026-08-29) ------------------------------------
     "Where is the version and then you can create branches of version."

     A history was a LIST: every snapshot followed the one before it, so
     going back to an older version and carrying on from there quietly
     rewrote what "before" meant -- the older version and the newer one
     both claimed the same line, and the newer work looked like a
     continuation of something it had nothing to do with.

     Three things make it a tree, and the third is the one that bites.

     `histHead` is where the LIVE deck sits: the snapshot it descends
     from. Every new snapshot records it as `p`, then becomes it. Going
     back to an older version moves the head THERE, so the next save
     forks rather than pretending the detour never happened.

     `br` is the branch's name, inherited from the parent so a branch
     costs one naming and not one per save.

     And HIST_KEEP=20 still evicts the oldest entry, which on a tree can
     be an entry other entries descend from -- so eviction SPLICES:
     every child of a dropped entry is re-pointed at that entry's own
     parent before it goes. A tree that loses its oldest snapshot stays
     one connected tree; it just gets shallower. Without that, half the
     history becomes unreachable rows pointing at an id that is not
     there, which is the bug this design is most likely to have had. */
  var histHead=null;   /* the snapshot the live deck descends from */
  var histBranch='';   /* ...and the branch it is on ('' = the trunk) */
  function histKeyFor(name){
    return 'dhist:'+SCOPE+':'+(name||'untitled');
  }
  function histVKeyFor(name,id){return histKeyFor(name)+':'+id;}
  /* A snapshot is two IndexedDB writes (record, then index). Serialising
     that pair prevents two quick Saves from reading the same old index
     and letting the last writer silently erase the other one's entry.
     Rename migration uses this queue too, so it cannot cut across a
     save that was already in flight. */
  function histRun(fn){
    var run=histOps.then(fn).catch(function(){return false;});
    histOps=run.then(function(){});
    return run;
  }
  /* WHERE YOU ARE IN THE TREE, between sessions (T127).
     histHead and histBranch were runtime variables and nothing else:
     a page reload forgot both, the chip reverted to "on main", and the
     NEXT save wrote a snapshot with no parent -- a brand-new root,
     quietly fracturing the very tree T90 exists to keep. The pointer
     is one small idb value beside the index; seeding validates it
     against the index (the pointed-at snapshot can have been evicted)
     and a history with no pointer at all -- one from before this fix --
     falls back to the TIP, which is the old linear assumption and
     repairs the story rather than re-rooting it. */
  function histPtrKey(name){return histKeyFor(name)+':head';}
  function histPtrSave(name){
    return idbPut(histPtrKey(name),{h:histHead||'',br:histBranch||''})
      .catch(function(){});
  }
  function histSeed(){
    var name=pres&&pres.name;
    if(!name) return Promise.resolve(false);
    return histRun(function(){
      return idbGet(histPtrKey(name)).then(function(ptr){
        return histIndexAt(name).then(function(ix){
          /* the deck can have been switched while this read was queued;
             writing the OLD deck's pointer onto the new one would be
             the exact cross-parenting loadPresentation guards against */
          if(!pres||pres.name!==name) return false;
          var hit=null;
          ix.forEach(function(e){
            if(ptr&&e.id===ptr.h) hit=e;});
          if(hit){
            histHead=hit.id;
            histBranch=(ptr.br!=null&&ptr.br!=='')?ptr.br:(hit.br||'');
          } else if(ix.length){
            var tip=ix[ix.length-1];
            histHead=tip.id;histBranch=tip.br||'';
          } else {histHead=null;histBranch='';}
          return true;
        });
      });
    });
  }
  function histIndexAt(name){
    return idbGet(histKeyFor(name)).then(function(v){
      return Array.isArray(v)?v:[];
    });
  }
  function histIndex(){
    var name=pres.name;
    return histOps.then(function(){return histIndexAt(name);})
      .catch(function(){return [];});
  }
  /* the whole deck as it stands, in the form a save would write */
  function histText(){
    ensureSids();
    return JSON.stringify(normPres(pres));
  }
  /* Capture synchronously. No delayed IndexedDB callback is allowed to
     discover that the deck was renamed, edited, or given another slide
     while a file/server write was awaiting its result. */
  function histCapture(){
    if(!pres||!pres.slides) return null;
    try{return {name:pres.name||'untitled',txt:histText(),
      n:pres.slides.length};}
    catch(e){return null;}
  }
  function snapTake(why,captured,ready){
    var cap=captured||histCapture();
    if(!cap) return Promise.resolve(false);
    var gate=(ready===undefined)
      ?Promise.resolve(true)
      :Promise.resolve(ready).catch(function(){return false;});
    /* Queue NOW, even when the successful write is still pending. A
       rename initiated after the Save then waits behind this operation
       and migrates the snapshot to the new name. */
    return histRun(function(){
      return gate.then(function(ok){
        if(!ok) return false;
        return histIndexAt(cap.name).then(function(ix){
          /* DEDUPED. Open, look, close should cost nothing, and a history
             with the same deck in it nine times cannot be read. */
          if(ix.length&&ix[ix.length-1].len===cap.txt.length
             &&ix[ix.length-1].n===cap.n)
            return idbGet(histVKeyFor(cap.name,ix[ix.length-1].id))
              .then(function(prev){
                if(prev===cap.txt) return false;
                return snapWrite(cap,ix,why);
              });
          return snapWrite(cap,ix,why);
        });
      });
    });
  }
  function snapWrite(cap,ix,why){
    var id='v'+(Date.now().toString(36))
      +Math.random().toString(36).slice(2,5);
    var ent={id:id,at:Date.now(),why:why||'saved',
      n:cap.n,len:cap.txt.length};
    /* absent-is-default, the rule the deck format follows everywhere: a
       trunk snapshot with no parent stores neither key, so a history
       written before branches existed reads as a trunk and is right */
    if(histHead) ent.p=histHead;
    if(histBranch) ent.br=histBranch;
    var next=ix.concat([ent]);
    histHead=id;
    var drop=next.length>HIST_KEEP?next.splice(0,next.length-HIST_KEEP):[];
    /* SPLICE, don't sever. The dropped entries are the oldest, and on a
       tree the oldest can have children; re-point each child at its
       grandparent so the tree stays connected and merely gets shallower
       (T90). Done oldest-first so a run of dropped ancestors collapses
       correctly in one pass. */
    drop.forEach(function(d){
      next.forEach(function(e2){
        if(e2.p===d.id){
          if(d.p) e2.p=d.p; else delete e2.p;
        }
      });
    });
    return idbPut(histVKeyFor(cap.name,id),cap.txt).then(function(){
      return idbPut(histKeyFor(cap.name),next);
    }).then(function(){
      return histPtrSave(cap.name);   /* the head moved (T127) */
    }).then(function(){
      /* the record goes only after the index no longer names it, so a
         crash between the two leaves an orphan rather than a listed
         snapshot that cannot be opened */
      return Promise.all(drop.map(function(d){
        return idbDel(histVKeyFor(cap.name,d.id)).catch(function(){});
      }));
    }).then(function(){return true;}).catch(function(){return false;});
  }
  function snapRead(id){
    var name=pres.name;
    return histOps.then(function(){
      return idbGet(histVKeyFor(name,id));
    }).then(function(t){
      if(typeof t!=='string') return null;
      try{return JSON.parse(t);}catch(e){return null;}
    }).catch(function(){return null;});
  }
  /* Move every version with the deck. New records and their index are
     durable before any old key is removed, so interruption can leave
     harmless orphans but never a listed snapshot that cannot open. */
  function histRename(oldName,newName){
    if(!oldName||!newName||oldName===newName)
      return Promise.resolve(false);
    return histRun(function(){
      return histIndexAt(oldName).then(function(ix){
        if(!ix.length) return false;
        return Promise.all(ix.map(function(ent){
          return idbGet(histVKeyFor(oldName,ent.id)).then(function(txt){
            if(typeof txt!=='string') return null;
            return idbPut(histVKeyFor(newName,ent.id),txt)
              .then(function(){return ent;});
          });
        })).then(function(copied){
          var next=copied.filter(function(ent){return !!ent;});
          return idbPut(histKeyFor(newName),next).then(function(){
            /* the head pointer renames with its history (T127) */
            return idbGet(histPtrKey(oldName)).then(function(ptr){
              if(ptr) return idbPut(histPtrKey(newName),ptr);
            }).catch(function(){});
          }).then(function(){
            return idbDel(histPtrKey(oldName)).catch(function(){});
          }).then(function(){
            return idbDel(histKeyFor(oldName));
          }).then(function(){
            return Promise.all(ix.map(function(ent){
              return idbDel(histVKeyFor(oldName,ent.id))
                .catch(function(){});
            }));
          }).then(function(){return true;});
        });
      });
    });
  }
  /* run something with a DIFFERENT deck in place. buildSlideNode and
     miniDiagram both read the live `pres`, and giving either a "which
     deck" parameter would mean threading it through everything they
     call; swapping the one global for the length of a synchronous call
     is the same trick buildSlideNode already plays with `mode`. */
  function withDeck(obj,fn){
    var saved=pres;
    pres=obj;
    try{return fn();}finally{pres=saved;}
  }
  function slideSig(sl){
    if(!sl) return '';
    var c={};
    Object.keys(sl).forEach(function(k){
      if(k!=='sid') c[k]=sl[k];});
    try{return JSON.stringify(c);}catch(e){return '';}
  }
  /* WHAT CHANGED, as rows in reading order: every slide that is in
     either version, paired by name where both versions have names. */
  function deckDiff(then,now){
    var A=(then&&then.slides)||[],B=(now&&now.slides)||[];
    var byName=A.every(function(s2){return s2&&s2.sid;})
      &&B.every(function(s2){return s2&&s2.sid;})
      &&A.length&&B.length;
    var rows=[];
    if(!byName){
      /* POSITIONAL, and said out loud: a snapshot from before slides
         were named cannot be paired any other way */
      var n=Math.max(A.length,B.length);
      for(var i=0;i<n;i++)
        rows.push({a:A[i]||null,b:B[i]||null,ai:i,bi:i,
          st:!A[i]?'added':!B[i]?'removed'
            :(slideSig(A[i])===slideSig(B[i])?'same':'changed')});
      return {rows:rows,byName:false};
    }
    var posB={};
    B.forEach(function(s2,i){posB[s2.sid]=i;});
    var seen={};
    B.forEach(function(b,i){
      var ai=-1;
      A.forEach(function(a,j){if(a.sid===b.sid) ai=j;});
      var a=ai>=0?A[ai]:null;
      if(a) seen[a.sid]=1;
      rows.push({a:a,b:b,ai:ai,bi:i,
        st:!a?'added'
          :slideSig(a)!==slideSig(b)?'changed'
          :ai!==i?'moved':'same'});
    });
    /* the ones that are GONE, put back where they used to be so the
       list still reads like the old deck at the point they vanished */
    A.forEach(function(a,j){
      if(seen[a.sid]) return;
      var at=rows.length;
      for(var k=0;k<rows.length;k++)
        if(rows[k].ai>j){at=k;break;}
      rows.splice(at,0,{a:a,b:null,ai:j,bi:-1,st:'removed'});
    });
    return {rows:rows,byName:true};
  }
  function histWhen(ms){
    var d=Math.round((Date.now()-ms)/1000);
    if(d<90) return 'just now';
    if(d<5400) return Math.round(d/60)+' min ago';
    if(d<86400*2) return Math.round(d/3600)+' h ago';
    return new Date(ms).toLocaleDateString();
  }
  /* THE PANEL. An overlay, like the overview map and the notes editor:
     it wants the screen while you are comparing and none of it after. */
  var histSel='';
  function histPanelClose(){
    var ov=$('#deck-history');
    if(ov) ov.remove();
    document.removeEventListener('keydown',histPanelKey,true);
  }
  function histPanelKey(e){
    if(!$('#deck-history')) return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();histPanelClose();}
  }
  /* HOW DEEP EACH SNAPSHOT SITS. An entry whose parent is not in the
     index is a ROOT rather than a lost row: that is what an evicted
     ancestor looks like from here, and the splice in snapWrite means it
     can only happen to a history written before branches existed (T90). */
  function histDepths(ix){
    var by={},depth={};
    ix.forEach(function(e){by[e.id]=e;});
    function of(e,guard){
      if(depth[e.id]!=null) return depth[e.id];
      var p=e.p&&by[e.p];
      /* guard: a hand-edited store could name a cycle, and a stack
         overflow inside a history panel is a poor way to find out */
      var d=(!p||guard>HIST_KEEP)?0:of(p,guard+1)+1;
      depth[e.id]=d;
      return d;
    }
    ix.forEach(function(e){of(e,0);});
    return depth;
  }
  function histRows(ov,ix){
    var rail=ov.querySelector('#dh-list');
    rail.innerHTML='';
    if(!ix.length){
      rail.innerHTML='<div class="selpane-empty">Nothing yet. A '
        +'snapshot is kept when you open this deck and every time you '
        +'save it, so the history starts filling from now.</div>';
      return;
    }
    var depth=histDepths(ix),lastBr=null,kids={};
    ix.forEach(function(e){if(e.p) kids[e.p]=(kids[e.p]||0)+1;});
    ix.slice().reverse().forEach(function(e){
      var br=e.br||'';
      /* a heading whenever the branch changes on the way down, so the
         shape reads without drawing a graph (T90) */
      if(br!==lastBr){
        var h=document.createElement('div');
        h.className='dh-brlab';
        h.innerHTML=bic('route')+' '+esc(br||'main');
        rail.appendChild(h);
        lastBr=br;
      }
      var b=document.createElement('button');
      b.className='dh-snap'+(e.id===histSel?' on':'')
        +(e.id===histHead?' head':'')
        +((kids[e.id]||0)>1?' forked':'');
      b.style.setProperty('--dh-depth',String(Math.min(6,depth[e.id]||0)));
      var l1=document.createElement('span');
      l1.className='dh-when';
      l1.textContent=histWhen(e.at)
        +(e.id===histHead?' · you are here':'');
      var l2=document.createElement('span');
      l2.className='dh-why';
      l2.textContent=e.why+' · '+e.n+' slide'+(e.n===1?'':'s')
        +((kids[e.id]||0)>1
          ?(' · '+kids[e.id]+' branches from here'):'');
      b.appendChild(l1);b.appendChild(l2);
      b.title=new Date(e.at).toLocaleString()
        +(br?('\nBranch: '+br):'\nMain line')
        +(e.id===histHead
          ?'\nThis is where the deck you are editing came from':'');
      b.addEventListener('click',function(){
        histSel=e.id;histRows(ov,ix);histCompare(ov,e);});
      rail.appendChild(b);
    });
  }
  /* The diagrams make a forty-slide comparison cheap. A real render is
     opt-in per row, built by the same 960×540 renderer used by presenter
     and notes previews, then scaled into the two comparison columns. */
  function histFullSlides(row,r,then,btn){
    var old=row.querySelector('.dh-full');
    if(old){
      old.remove();row.classList.remove('dh-open');
      btn.setAttribute('aria-expanded','false');
      btn.innerHTML=bic('expand')+' Show full slides';
      return;
    }
    var full=document.createElement('div');full.className='dh-full';
    var made=[];
    [['then',r.a,then,r.ai],['now',r.b,pres,r.bi]]
      .forEach(function(side){
        var cell=document.createElement('div');
        cell.className='dh-fullcell';
        var cap=document.createElement('span');cap.className='dh-cap';
        cap.textContent=side[0]+(side[1]?' · full slide':' — not there');
        cell.appendChild(cap);
        if(side[1]&&side[3]>=0){
          var frame=document.createElement('div');
          frame.className='dh-fullframe';
          var node=withDeck(side[2],function(){
            return buildSlideNode(side[3],true);
          });
          if(node){
            /* History is a comparison, never a second live editor. */
            node.setAttribute('inert','');
            node.setAttribute('aria-hidden','true');
            frame.appendChild(node);made.push({frame:frame,node:node});
          }
          cell.appendChild(frame);
        } else {
          var miss=document.createElement('div');
          miss.className='dh-fullmissing';miss.textContent='No slide here';
          cell.appendChild(miss);
        }
        full.appendChild(cell);
      });
    row.appendChild(full);
    made.forEach(function(p){
      var k=Math.min((p.frame.clientWidth||480)/960,
        (p.frame.clientHeight||270)/540);
      p.node.style.transform='scale('+(k||0.5).toFixed(4)+')';
      p.node.style.transformOrigin='top left';
    });
    row.classList.add('dh-open');
    btn.setAttribute('aria-expanded','true');
    btn.innerHTML=bic('minus')+' Hide full slides';
  }
  function histCompare(ov,ent){
    var body=ov.querySelector('#dh-body');
    body.innerHTML='<div class="selpane-empty">Reading…</div>';
    snapRead(ent.id).then(function(then){
      body.innerHTML='';
      if(!then){
        body.innerHTML='<div class="selpane-empty">That snapshot '
          +'could not be read.</div>';
        return;
      }
      var d=deckDiff(then,pres);
      var head=document.createElement('div');
      head.className='dh-head2';
      var counts={added:0,removed:0,changed:0,moved:0,same:0};
      d.rows.forEach(function(r){counts[r.st]++;});
      head.textContent=histWhen(ent.at)+' → now: '
        +[['changed','changed'],['added','new'],['removed','gone'],
          ['moved','moved']].filter(function(p){return counts[p[0]];})
          .map(function(p){return counts[p[0]]+' '+p[1];}).join(', ')
        +(Object.keys(counts).every(function(k){
            return k==='same'||!counts[k];})?'no difference':'')
        +(d.byName?'':' — compared by position: this snapshot is '
          +'older than slide names, so an inserted slide shifts '
          +'everything below it');
      body.appendChild(head);
      var restoreAll=document.createElement('button');
      restoreAll.className='dbtn dh-all';
      restoreAll.innerHTML=bic('reload')+' Go back to this whole version';
      restoreAll.addEventListener('click',function(){
        if(!confirm('Replace all '+(pres.slides||[]).length
          +' slides with the '+d.rows.filter(function(r){
            return r.a;}).length+' from '+histWhen(ent.at)+'?')) return;
        snapTake('before going back').then(function(){
          histRestoreDeck(then,ent.id,ent.br||'');histPanelClose();});
      });
      body.appendChild(restoreAll);
      /* THE ASK ITSELF. Same restore, plus a name -- so the work you do
         next is recorded as descending from THIS version instead of
         from whatever happened to be latest (T90). */
      var branch=document.createElement('button');
      branch.className='dbtn dh-all dh-branch';
      branch.innerHTML=bic('route')+' Start a branch from here\u2026';
      branch.title='Go back to this version AND give what you do next '
        +'its own name, so it shows as a branch instead of overwriting '
        +'the line you were on';
      branch.addEventListener('click',function(){
        var suggest=ent.br?(ent.br+' 2'):'alternative';
        var nm=prompt('Call this branch:',suggest);
        if(nm===null) return;
        nm=nm.trim()||suggest;
        snapTake('before branching').then(function(){
          histRestoreDeck(then,ent.id,nm);
          histPanelClose();
          snapTake('branched: '+nm);
          toast('On branch \u201c'+nm+'\u201d \u2014 what you save next '
            +'descends from '+histWhen(ent.at)+', not from where you '
            +'were');
        });
      });
      body.appendChild(branch);
      d.rows.forEach(function(r){
        var row=document.createElement('div');
        row.className='dh-row st-'+r.st;
        var lab=document.createElement('span');
        lab.className='dh-st';
        lab.textContent=r.st==='same'?'unchanged':r.st;
        row.appendChild(lab);
        [['then',r.a,then],['now',r.b,pres]].forEach(function(side){
          var cell=document.createElement('div');
          cell.className='dh-cell';
          var cap=document.createElement('span');
          cap.className='dh-cap';
          cap.textContent=side[1]
            ?(side[0]+' · '+((side[0]==='then'?r.ai:r.bi)+1))
            :(side[0]+' — not there');
          cell.appendChild(cap);
          if(side[1])
            cell.appendChild(withDeck(side[2],function(){
              return miniDiagram(side[1]);}));
          row.appendChild(cell);
        });
        var acts=document.createElement('div');
        acts.className='dh-acts';
        var look=document.createElement('button');
        look.className='dbtn dh-look';
        look.innerHTML=bic('expand')+' Show full slides';
        look.setAttribute('aria-expanded','false');
        look.addEventListener('click',function(){
          histFullSlides(row,r,then,look);
        });
        acts.appendChild(look);
        if(r.a&&(r.st==='removed'||r.st==='changed')){
          var rb=document.createElement('button');
          rb.className='dbtn dh-one';
          rb.innerHTML=bic('reload')
            +(r.st==='removed'?' Put it back':' Use the old one');
          rb.addEventListener('click',function(){
            snapTake('before putting a slide back').then(function(){
              histRestoreSlide(r,then);
              histPanelClose();
            });
          });
          acts.appendChild(rb);
        }
        row.appendChild(acts);
        body.appendChild(row);
      });
    });
  }
  /* ONE SLIDE BACK. In place when the deck still has it, and otherwise
     at the index it used to hold -- which is where you will look for it. */
  function histRestoreSlide(r,then){
    var copy=JSON.parse(JSON.stringify(r.a));
    var at;
    if(r.bi>=0){pres.slides[r.bi]=copy;at=r.bi;}
    else {
      at=Math.min(Math.max(r.ai,0),(pres.slides||[]).length);
      pres.slides.splice(at,0,copy);
    }
    cur=at;selAnnot=null;selSet=[];
    markDirty();refresh();
    toast(r.bi>=0?'Slide '+(at+1)+' is the older one again'
      :'Slide '+(at+1)+' is back');
  }
  function histRestoreDeck(then,fromId,branch){
    /* WHERE YOU NOW ARE IN THE TREE. Restoring puts the live deck at
       that snapshot, so the next save descends from IT -- which is what
       makes carrying on from an old version a fork rather than a lie
       about what came before (T90). */
    if(fromId!==undefined) histHead=fromId||null;
    if(branch!==undefined) histBranch=branch||'';
    if(fromId!==undefined||branch!==undefined) histPtrSave(pres.name);
    var pageWas=pres.page||null,bgWas=pres.pageBg||null;
    var copy=JSON.parse(JSON.stringify(then));
    copy.name=pres.name;      /* the NAME is where you are, not where it was */
    pres=copy;              /* replace/delete every normPres key together */
    if((pres.page||null)!==pageWas||(pres.pageBg||null)!==bgWas) deckZoom=0;
    cur=0;activePane=-1;selAnnot=null;selSet=[];
    /* Installs this version's custom type registry and discards undo
       entries whose object references belong to the replaced deck. */
    histReset();
    markDirty();refresh();renderFilm();renderPresTabs();renderPresRow();
    toast('Back to the older version — the deck as it was is in the '
      +'history too, so this is undoable');
  }
  function openHistory(){
    histPanelClose();
    var ov=document.createElement('div');
    ov.className='deck-history';ov.id='deck-history';
    ov.innerHTML='<div class="dh-head">'
      +'<span class="dh-t">History of “'+esc(pres.name||'this deck')
      +'”</span>'
      +'<span class="dh-onbr">'+bic('route')+' on '
      +esc(histBranch||'main')+'</span>'
      +'<span class="deck-spring"></span>'
      +'<button class="dbtn" id="dh-close">'+bic('exit')+' Close</button>'
      +'</div><div class="dh-main">'
      +'<div class="dh-rail" id="dh-list"></div>'
      +'<div class="dh-body" id="dh-body">'
      +'<div class="selpane-empty">Pick a version on the left to see '
      +'what is different about it.</div></div></div>';
    /* WHERE GIT IS. A deck is not a file on disk -- it lives inside the
       notebook or the project file -- so the deck's own history is this
       local store, and the repository's history of the file it is saved
       INTO is the notebook's, which server/vcs.py already lists and
       opens. Naming that rather than duplicating it is the honest hook:
       two histories that answer different questions, and neither
       pretending to be the other. */
    if(APP.mode==='app'){
      var git=document.createElement('div');
      git.className='dh-git';
      git.textContent='This is the deck\u2019s own history — the moments '
        +'between commits. The repository\u2019s history of the file it '
        +'is saved into is the notebook\u2019s: its Version history menu '
        +'lists the git commits and opens them.';
      ov.querySelector('.dh-main').appendChild(git);
    }
    document.body.appendChild(ov);
    ov.querySelector('#dh-close').addEventListener('click',histPanelClose);
    document.addEventListener('keydown',histPanelKey,true);
    histIndex().then(function(ix){
      histRows(ov,ix);
      /* the most recent one is the one you meant */
      if(ix.length){histSel=ix[ix.length-1].id;histRows(ov,ix);
        histCompare(ov,ix[ix.length-1]);}
    });
  }
