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
      /* T313: the SAME edge the two insert doors and paste pass
         (IMG_VIEW_EDGE, 1600). Omitting it fell back to IMG_MAX_EDGE
         (2400), so a refreshed picture came back heavier than the one
         it replaced -- the opposite of what this function's own comment
         promises. */
      probe.onload=function(){res(shrinkImage(probe,src,IMG_VIEW_EDGE));};
      probe.onerror=function(){res(src);};
      probe.src=src;
    });
  }
  /* every image on the deck that was put there from a local file */
  function linkedImages(only){          /* T280: a slide, or the deck */
    var out=[];
    (pres.slides||[]).forEach(function(sl,si){
      if(only>=0&&si!==only) return;
      (sl.annots||[]).forEach(function(a,ai){
        /* T308: an address is a source too -- the only one that is
           re-read on every render. Leaving it out told a slide whose
           only content was a linked picture that it had "nothing with a
           source to re-read". */
        if(a&&a.k==='image'&&(a.fkey||picState(a)==='link'))
          out.push({si:si,ai:ai,a:a});});
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
    /* T313: WHERE THE BYTES COME FROM, in one place. T308 widened
       linkedImages to include address-backed pictures -- correctly, an
       address is a source -- but this reduce knew exactly one way to
       fetch: idbGet(e.a.fkey). An address picture has no fkey, so
       idbGet(undefined) rejected and EVERY one of them was reported
       "could not be read" on every refresh. The landing half below
       (shrink, swap a.src, move the original) is unchanged and shared. */
    function picBytes(a){
      var addr=picAddr(a);
      if(addr&&!a.fkey){
        /* T437: a web address reads itself, in every build */
        if(/^https?:\/\//i.test(addr)) return fetchDataUrl(addr);
        if(!picCanEmbed())
          return Promise.reject(new Error('needs the Junoview app'));
        return APP.api('/api/readimage',{path:addr})
          .then(function(r){
            if(!r||!r.src) throw new Error('no picture came back');
            return r.src;
          });
      }
      return idbGet(a.fkey).then(function(h){
        if(!h) throw 0;
        return permAsk(h).then(function(granted){
          if(!granted) throw 0;
          return h.getFile();
        });
      }).then(function(f){return readAsDataURL(f);});
    }
    return items.reduce(function(chain,e){
      return chain.then(function(){
        return picBytes(e.a).then(function(src){
          return shrinkDataUrl(src).then(function(small){
            return {full:src,small:small};});
        }).then(function(r){
          var src=r.small;
          if(!src||src===e.a.src) {ok++;return;}
          /* T437: a picture that lived at its address now holds the
             bytes, and keeps the address beside them to re-read */
          var wasLink=picState(e.a)==='link',addr0=picAddr(e.a);
          e.a.src=src;ok++;
          if(wasLink&&addr0) e.a.psrc=addr0;
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
  /* T280: `quiet` hands the reporting to the merged verb, which has a
     figure half to report as well and one #deck-toast to say it in --
     pressing both tiles used to race for that element and lose half the
     answer. It RESOLVES what happened either way, so the merged verb can
     write one sentence. */
  function refreshImagesReport(list,quiet){
    var items=list||linkedImages();
    var n=items.length;
    if(!n){
      /* suppressed under the merged verb: on a deck that is all figures
         this sentence is exactly the wrong thing to say */
      if(!quiet)
        toast('No pictures on this deck are linked to a file on this '
          +'computer. Insert one with Image and it will remember where it '
          +'came from.');
      return Promise.resolve({ok:0,lost:[],n:0});
    }
    if(!quiet) toast('Re-reading '+n+' picture'+(n===1?'':'s')+'…');
    return refreshLinkedImages(items).then(function(r){
      r.n=n;
      if(quiet) return r;
      if(!r.lost.length){
        toast(r.ok+' picture'+(r.ok===1?'':'s')+' refreshed from disk');
        return r;
      }
      var names=r.lost.slice(0,4).map(function(l){
        return l.name+' (slide '+(l.si+1)+')';}).join(', ');
      if(r.lost.length>4) names+=' and '+(r.lost.length-4)+' more';
      toast((r.ok?(r.ok+' refreshed. '):'')
        +r.lost.length+' could not be read and '
        +(r.lost.length===1?'was':'were')+' left exactly as before: '
        +names,9000);
      return r;
    });
  }
  /* ---- ONE VERB FOR BOTH HALVES (T280) ---------------------------------
     "Update figures" and "Reload pictures" were two tall tiles whose
     labels differed only in the noun, so you had to classify your own
     content before you could choose one -- and neither offered a scope:
     both walked the whole deck. They remain two MECHANISMS (a figure
     re-reads its notebook through APP.reloadTab; a picture re-reads a
     file handle out of IndexedDB) because they are two mechanisms. What
     is merged is the question and the answer.
     Both halves run QUIET and this writes the one sentence, because
     there is one #deck-toast and the two of them used to race for it. */
  function updateFromSources(slideOnly){
    var only=slideOnly?cur:-1;
    var where=slideOnly?'this slide':'the presentation';
    var pics=linkedImages(only);
    /* "does anything here HAVE a source", which is not the same question
       as staleFigures' "is anything here out of date" -- asking the
       second would tell a slide whose figure is perfectly up to date
       that it has nothing to re-read. provRef is the one predicate that
       answers it for cells, charts and flip frames alike. */
    var figs=0;
    (pres.slides||[]).forEach(function(sl,si){
      if(only>=0&&si!==only) return;
      (sl.annots||[]).forEach(function(a){
        if(a&&!a.hide&&typeof provRef==='function'&&provRef(a)) figs++;});
    });
    if(!pics.length&&!figs){
      /* say WHICH of the two it looked for, or "nothing to update" reads
         as "this button is broken" on a deck full of pasted pictures */
      toast('Nothing on '+where+' has a source to re-read \u2014 a figure '
        +'remembers its notebook and a picture remembers the file it came '
        +'from, and neither is here yet.');
      return;
    }
    toast('Re-reading '+where+'\u2026');
    var jobs=[
      (typeof resyncAllFigures==='function')
        ? resyncAllFigures(only,true)
        : Promise.resolve({n:0,reread:0,bad:[],tried:0}),
      pics.length ? refreshImagesReport(pics,true)
        : Promise.resolve({ok:0,lost:[],n:0})
    ];
    Promise.all(jobs).then(function(res){
      var f=res[0]||{n:0,bad:[]},p=res[1]||{ok:0,lost:[]};
      var bits=[];
      if(f.n) bits.push(f.n+' figure'+(f.n===1?'':'s'));
      if(p.ok) bits.push(p.ok+' picture'+(p.ok===1?'':'s'));
      var msg;
      if(bits.length) msg=bits.join(' and ')+' updated on '+where;
      else msg='Everything on '+where+' already matches its source';
      var trouble=[];
      if(f.bad&&f.bad.length)
        trouble.push('could not read '+f.bad.length+' notebook source'
          +(f.bad.length===1?'':'s'));
      if(p.lost&&p.lost.length)
        trouble.push(p.lost.length+' picture file'
          +(p.lost.length===1?'':'s')+' could not be found, and '
          +(p.lost.length===1?'was':'were')+' left as before');
      if(trouble.length) msg+=' \u2014 '+trouble.join('; ');
      toast(msg,trouble.length?9000:0);
    });
  }
  /* ---- ALL IMAGES (T202) ----------------------------------------------
     Every picture and figure across the deck in one list: the slide,
     the kind, where it came from (a picture's file, a figure's
     notebook), and its lock, toggled from the row. Rendered on open
     and on the reload button, never from markDirty -- the survey
     walks every slide. */
  /* one slide's pictures and figures, in slide order */
  function imgSurvey(si){
    var s=pres.slides[si],rows=[];
    if(!s) return rows;
    (s.annots||[]).forEach(function(a,ai){
      if(!a) return;
      if(a.k==='image'){
        var st=picState(a);
        rows.push({si:si,ai:ai,a:a,kind:'Picture',pic:st,
          from:st==='link'?String(a.src)
            :st==='path'?String(a.psrc)
            :st==='file'?(a.fname||'a file on this computer')
            :'pasted or dropped — the deck holds the only copy'});
      }
      /* A notebook cell can be prose, code, output or a figure. Only the
         last is an image: auto-generated markdown frames used to inflate
         a twelve-slide deck's image inventory to sixteen rows. */
      else if(a.k==='cell'&&a.ref&&partOf(a)==='figure')
        rows.push(imgFigRow(si,ai,a,a.ref));
      /* T308: A BOOK IS AS MANY FIGURES AS IT HAS PAGES, and a chart
         has a source too. Both were invisible here, in both surfaces,
         while provRef has always said they have one -- so a deck whose
         figures are all flip books read "No pictures or figures on this
         slide" from the tab whose whole job since T299 is telling you
         what can go missing. */
      else if(a.k==='flip'){
        flipFrames(a).forEach(function(f,fi){
          if(f&&f.ref) rows.push(imgFigRow(si,ai,a,f.ref,fi));
        });
      }
      else if(a.k==='chart'&&a.ref) rows.push(imgFigRow(si,ai,a,a.ref));
    });
    return rows;
  }
  /* one figure row, whatever is carrying it. `fi` is the page of a flip
     book, so the row can name itself and act on ITS ref rather than on
     whichever page the book happens to be showing. */
  function imgFigRow(si,ai,a,ref,fi){
    var ci=resolveRef(ref);
    var holder=(a.k==='flip')?(flipFrames(a)[fi|0]||{}):a;
    /* T309: the notebook's ADDRESS when the figure remembers one, and
       the stem only as the fallback for figures placed before it did.
       Elided in the MIDDLE, because a path's useful half is its tail --
       CSS ellipsis cuts exactly the filename off. */
    var p=holder&&holder.nbpath;
    var r={si:si,ai:ai,a:a,ref:ref,kind:'Figure',
      path:p||'',
      from:p?midElide(String(p),52):((ci&&(ci.stem||ci.nb))||String(ref))};
    if(a.k==='flip'){r.fi=fi;r.kind='Page '+((fi|0)+1);}
    else if(a.k==='chart') r.kind='Chart';
    return r;
  }
  function midElide(s,n){
    if(s.length<=n) return s;
    return s.slice(0,Math.max(0,Math.floor(n/3)))+'\u2026'
      +s.slice(s.length-Math.ceil(n*2/3));
  }
  /* T308: WHAT A PICTURE ACTUALLY IS. Three states, not two:

       link  a.src is an ADDRESS. The browser re-reads it on every
             render, so this is the one genuinely sym-linked picture in
             the app -- and the one the pane used to call "pasted or
             dropped, no file to reload", which is wrong on both halves.
       file  a.src is the bytes AND a.fkey names the file they came
             from, so it can be re-read but cannot go missing.
       kept  a.src is the bytes and nothing else. It cannot be re-read
             and it cannot go missing.

     The discriminator is the src itself: everything the app embeds is a
     data: URI, and the path door (placeImage(p,0) with no link) leaves
     the address there instead. */
  function picState(a){
    if(!a||a.k!=='image') return '';
    var s=String(a.src||'');
    if(s&&s.indexOf('data:')!==0) return 'link';
    /* T313: EMBEDDED, AND STILL KNOWS WHERE IT CAME FROM. Once the
       bytes are in a.src the address is no longer visible in it, so it
       is kept beside them -- which is the whole of the user's ask for
       this class: "all images should be embedded into the thing, but
       should have the option to refreshed from the path". */
    if(a.psrc) return 'path';
    return a.fkey?'file':'kept';
  }
  /* the address a picture can be re-read from, whichever way it holds
     one: typed-and-embedded, or still living at it */
  function picAddr(a){
    if(!a||a.k!=='image') return '';
    if(a.psrc) return String(a.psrc);
    return picState(a)==='link'?String(a.src||''):'';
  }
  /* app mode can read a path off the disk; nothing else can, so nothing
     else offers to */
  function picCanEmbed(){return APP.mode==='app';}
  /* T299: WHICH FIGURE THIS IS, AND THE THINGS YOU CAN DO TO IT.
     Everything about a picture's SOURCE now answers on its row here --
     the number, the commit, the refresh and the live-link switch
     (2026-09-05, user: "All these optoins should be in the images tab
     btw"). Words, not another glyph: the line is full width, and three
     more unlabelled chips beside the lock would be four mysteries in a
     260px pane. */
  var figOrderMemo={};
  function figOrder(stem){
    /* T306: AN EMPTY ARRAY IS TRUTHY. With the notebook shut
       SHELLITEMS[stem] is gone, so this computed [] -- and then handed
       that same [] back for the life of the page, so opening the
       notebook never brought the number back. Computed while open and
       then closed, the row kept asserting an ordinal from a card list
       that no longer existed. Nothing invalidated the memo: the
       sem:shell handlers drop frameNodeCache and never touched it.
       Absence of the notebook is answered directly, above the memo. */
    if(!SHELLITEMS[stem]) return [];
    if(figOrderMemo[stem]) return figOrderMemo[stem];
    var out=[];
    (SHELLITEMS[stem]||[]).forEach(function(k){
      try{if(cellFacets(k).figure) out.push(k);}catch(e){}
    });
    figOrderMemo[stem]=out;
    return out;
  }
  /* "the image number" (2026-09-05) counted the way a person counts
     them: among the notebook's figures, not among all its cards. Empty
     when the notebook is shut -- an ordinal we cannot check is worse
     than none. */
  function figNumber(ref){
    var n=normRef(ref)||String(ref||''),pr=splitRef(n);
    if(!pr[0]) return '';
    var ord=figOrder(pr[0]),i=ord.indexOf(n);
    return i<0?'':('figure '+(i+1)+' of '+ord.length);
  }
  function imgRefreshRow(r){
    var s2=pres.slides[r.si],a2=s2&&(s2.annots||[])[r.ai];
    if(!a2) return;
    if(a2.k==='image'){
      /* T308: the wording used to say "pasted or dropped" to the one
         picture that is neither -- an address is exactly the thing that
         CAN be re-read, and the only picture in the deck that can go
         missing. Only the third state is genuinely sourceless. */
      if(picState(a2)==='kept'){
        toast('This picture was pasted or dropped, so the deck holds the '
          +'only copy — there is no file to re-read, and nothing to lose');
        return;
      }
      if(picState(a2)==='link'&&!picCanEmbed()
         &&!/^https?:\/\//i.test(picAddr(a2))){
        toast('This picture is loaded from '+picAddr(a2)+' every time the '
          +'deck opens, so it is always as current as that address is.',
          7000);
        return;
      }
      refreshImagesReport([{si:r.si,ai:r.ai,a:a2}]);
      return;
    }
    if(!resyncFigure(a2,r.ref)){
      toast('Its notebook is not open, so there is nothing newer to '
        +'read — the copy in the deck is being shown');
      return;
    }
    /* T301: one figure, and the way back out of it */
    var k=normRef(provRef(a2));
    toastUndo('Re-read from the notebook, and kept.','Put it back',
      function(){
        var back=embRestore(k?[k]:[]);
        toast(back.n
          ?('Back to the figure from before'
            +(back.unlinked?' \u2014 and it is a kept copy again, not a '
              +'live link':''))
          :'Nothing left to put back');
        imgPaneRefresh();
      });
    imgPaneRefresh();
  }
  function imgPaneRefresh(){
    renderImgPane();
    var ov=$('#img-ov'); if(ov&&!ov.hidden) renderImgOverview();
  }
  function imgActs(r){
    var acts=document.createElement('div');acts.className='img-acts';
    function act(label,title,fn,on){
      var b=document.createElement('button');
      b.type='button';b.className='img-act'+(on?' on':'');
      b.textContent=label;b.title=title;
      b.addEventListener('click',function(e){
        e.stopPropagation();e.preventDefault();fn();});
      acts.appendChild(b);return b;
    }
    /* T308: the ROW's ref. A flip book has one per page and a chart
       keeps its table's, so reading r.a.ref here showed nothing for a
       book and the wrong thing for a chart. */
    var ref=r.ref||((r.kind==='Figure')&&r.a.ref);
    if(ref){
      var num=figNumber(ref);
      if(num){
        var sp=document.createElement('span');
        sp.className='img-num';sp.textContent=num;
        acts.appendChild(sp);
      }
    }
    /* T313: one arm per state, because each one means something
       different by "refresh" */
    /* T437: link only is a switch, on the row, said for what it is */
    if(r.kind==='Picture'&&(r.pic==='link'||r.pic==='path')){
      act(r.pic==='link'?'Link only':'Embedded',
        r.pic==='link'
          ?('Only the address is kept, so the deck is smaller \u2014 and '
            +'the picture is missing wherever '+r.from+' cannot be '
            +'reached. Click to read it into the deck.')
          :('The bytes are in the deck, so it cannot go missing. Click '
            +'to keep only the address instead (smaller, but loaded '
            +'from '+r.from+' every time).'),
        function(){
          var s2=pres.slides[r.si],a2=s2&&(s2.annots||[])[r.ai];
          if(a2) picSetLink(a2,r.pic!=='link');
        },r.pic==='link');
    }
    act('Refresh',ref
      ?('Re-read this figure from ' + r.from + ' and keep the new copy '
        + '\u2014 only this one')
      :r.pic==='path'?('Re-read this picture from '+r.from+' and keep the '
        +'new copy \u2014 only this one')
      :r.pic==='link'?('Loaded from '+r.from+' every time the deck opens. '
        +'Nothing is stored, so there is nothing to refresh \u2014 press '
        +'to read it into the deck instead.')
      :r.pic==='file'?('Re-read this picture from '+r.from)
      :'Pasted or dropped, so the deck holds the only copy',
      function(){imgRefreshRow(r);});
    if(ref){
      var live=(typeof refIsLive==='function')&&refIsLive(ref);
      act(live?'Live link':'Kept',
        live
          ?('Loads from the notebook every time this deck opens. If the '
            +'notebook moves or changes, so does this figure. Click to '
            +'keep the copy that is in the deck instead.')
          :('The copy in the deck is what you see, so it cannot go '
            +'missing. Click to make it a live link that re-reads from '
            +'the notebook every time.'),
        function(){
          setRefLive(ref,!refIsLive(ref));
          markDirty();
          var l=stage.querySelector('.annot-layer');
          if(l) renderAnnots(l,pres.slides[cur]);
          imgPaneRefresh();
        },live);
      /* the git commit, and the one verb that moves it (2026-09-05:
         "with another option of update to current git commit"). App
         mode only, because a pin needs a repository to point into. */
      if(APP.mode==='app'){
        var lv=r.a.lockver&&r.a.lockver.commit;
        act(lv?String(lv):'Pin to commit',
          lv?('Pinned to commit '+lv+(r.a.lockver.msg
              ?(' \u201c'+r.a.lockver.msg+'\u201d'):'')
             +' \u2014 click to move it to the notebook\u2019s current '
             +'commit')
            :'Record which commit of the notebook this figure came from',
          function(){
            var s2=pres.slides[r.si],a2=s2&&(s2.annots||[])[r.ai];
            if(!a2) return;
            lockFrame(a2).then(function(ok){
              if(!ok) return;
              markDirty();
              var l=stage.querySelector('.annot-layer');
              if(l) renderAnnots(l,pres.slides[cur]);
              imgPaneRefresh();
            });
          },!!lv);
      }
    }
    return acts;
  }
  /* one row: thumbnail, kind, where from, the pin. `after` runs once
     the row has taken you to the thing (the full-screen view closes) */
  function imgRow(r,after){
    var row=document.createElement('div');row.className='img-row';
    var th=document.createElement('div');th.className='img-th';
    if(r.kind==='Picture'&&r.a.src){
      var im=document.createElement('img');im.src=r.a.src;im.alt='';
      th.appendChild(im);
    } else th.innerHTML=bic('cellcard');
    row.appendChild(th);
    var mid=document.createElement('div');mid.className='img-mid';
    var t=document.createElement('div');t.className='img-t';
    t.textContent=r.kind;
    mid.appendChild(t);
    var f=document.createElement('div');f.className='img-from';
    f.textContent=r.from;f.title=r.path||r.from;
    mid.appendChild(f);
    mid.appendChild(imgActs(r));
    row.appendChild(mid);
    var lm=lockMode(r.a);
    var lk=document.createElement('button');
    lk.className='sp-act'+(lm?' on':'')+(lm==='pos'?' half':'');
    lk.type='button';
    lk.innerHTML=bic(lm==='pos'?'pin':'lock');
    lk.title=lm===''?'Not locked. Click to lock its position'
      :lm==='pos'?'Position locked. Click to unlock'
      :'Fully locked. Click to unlock';
    lk.setAttribute('aria-label',lk.title);
    lk.addEventListener('click',function(e){
      e.stopPropagation();
      var s2=pres.slides[r.si],a2=s2&&(s2.annots||[])[r.ai];
      if(!a2) return;
      if(lockMode(a2)) delete a2.lock; else a2.lock='pos';
      markDirty();
      if(r.si===cur){
        var l=stage.querySelector('.annot-layer');
        if(l){renderAnnots(l,s2);paintSel(l);}
      }
      renderImgPane();
      var ov=$('#img-ov'); if(ov&&!ov.hidden) renderImgOverview();
    });
    row.appendChild(lk);
    row.title='Select it';
    row.addEventListener('click',function(){
      if(r.si!==cur) go(r.si);
      var l=stage.querySelector('.annot-layer');
      if(l) selectAnnot(l,r.ai);
      if(after) after();
    });
    return row;
  }
  /* THE PANE IS THIS SLIDE'S (T204; 2026-09-02, user: "the all images
     thing should just be per slide"). */
  function renderImgPane(){
    var list=$('#imgpane-list'); if(!list) return;
    list.innerHTML='';
    var rows=imgSurvey(cur);
    if(!rows.length){
      list.innerHTML='<div class="selpane-empty">No pictures or figures '
        +'on this slide.</div>';
      return;
    }
    rows.forEach(function(r){list.appendChild(imgRow(r));});
  }
  /* THE FULL-SCREEN VIEW IS EVERY SLIDE'S, under a heading per slide
     that folds ("have headings that are collapsible for all slides"). */
  function renderImgOverview(){
    var body=$('#img-ov-body'); if(!body) return;
    body.innerHTML='';
    var total=0,withAny=0;
    (pres.slides||[]).forEach(function(s,si){
      var rows=imgSurvey(si);
      if(!rows.length) return;
      withAny++;total+=rows.length;
      var d=document.createElement('details');d.className='img-sec';
      d.open=true;
      var sm=document.createElement('summary');
      sm.textContent='Slide '+(si+1)+' — '
        +(String(slideTitle(s)||'').trim()||'untitled').slice(0,60)
        +' · '+rows.length;
      d.appendChild(sm);
      var grid=document.createElement('div');grid.className='img-rows';
      rows.forEach(function(r){
        grid.appendChild(imgRow(r,function(){overlayHide($('#img-ov'));}));
      });
      d.appendChild(grid);
      body.appendChild(d);
    });
    var sub=$('#img-ov-sub');
    if(sub) sub.textContent=total?(total+' on '+withAny+' slide'
      +(withAny===1?'':'s')):'';
    if(!total)
      body.innerHTML='<div class="selpane-empty">No pictures or figures '
        +'on any slide yet.</div>';
  }
  function imgPaneBoot(){
    var btn=$('#hm-images'),pane=$('#imgpane');
    if(!btn||!pane) return;
    function set(open){
      if(open){paneShow('imgpane');renderImgPane();}
      else paneHide('imgpane');
    }
    btn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    var cl=$('#imgpane-close');
    if(cl) cl.addEventListener('click',function(){set(false);});
    var rr=$('#imgpane-rerun');
    if(rr) rr.addEventListener('click',renderImgPane);
    /* the full-screen view: an overlay the owner closes on Escape */
    var all=$('#imgpane-all'),ov=$('#img-ov');
    if(all&&ov) all.addEventListener('click',function(e){
      e.stopPropagation();renderImgOverview();overlayShow(all,ov);});
    var oc=$('#img-ov-close');
    if(oc) oc.addEventListener('click',function(){overlayHide(ov);});
    var oo=$('#img-ov-open');
    if(oo) oo.addEventListener('click',function(){
      $$('.img-sec',ov).forEach(function(d){d.open=true;});});
    var of=$('#img-ov-fold');
    if(of) of.addEventListener('click',function(){
      $$('.img-sec',ov).forEach(function(d){d.open=false;});});
  }
  (function(){
    /* the Home tab's doors (T196). They forwarded a click to a File
       menu row, which is how the same verb came to have two buttons;
       T236 deleted the rows and left these calling the verb. */
    /* T280: ONE DOOR, AND IT ASKS WHERE. The two tiles are one tile
       with a menu: the scope the user asked for, and the route to the
       inventory that answers "which of these even has a source". */
    var hub=$('#hm-update'),hum=$('#hm-upd-menu');
    if(hub&&hum) hub.addEventListener('click',function(e){
      e.stopPropagation();
      if(!hum.hidden){overlayHide(hum);return;}
      hum.innerHTML='';
      menuHead(hum,'update from sources');
      [['Just this slide',true,
        'Re-read the figures and pictures on the slide you are on'],
       ['The whole presentation',false,
        'Re-read every figure and picture in the deck']]
        .forEach(function(r){
          var b=document.createElement('button');
          b.className='dbtn vw-opt';
          b.innerHTML=bic('reload')+' '+esc(r[0]);
          b.title=r[2];
          b.addEventListener('click',function(){
            overlayHide(hum);updateFromSources(r[1]);});
          hum.appendChild(b);
        });
      /* the house pattern for a second section in a menu is another
         heading, not a rule (menuHead / .hd-lab) */
      var inv=document.createElement('button');
      inv.className='dbtn vw-opt';
      inv.innerHTML=bic('image')+' Where each one came from';
      inv.title='The pictures and figures on this slide, what each was '
        +'made from, and whether it is locked in place';
      inv.addEventListener('click',function(){
        overlayHide(hum);
        var ib=$('#hm-images'); if(ib) ib.click();
      });
      hum.appendChild(inv);
      /* T381: the three lock verbs. They stood behind a More button in
         the notebook block above the thumbnails; that block is gone, and
         "keep up to date" is the question they answer -- a locked figure
         is one an update leaves alone. Same words, same app-only
         treatment with the reason in the title. */
      var appMode=(APP.mode==='app');
      menuHead(hum,'every figure at once');
      [['lock','Lock all figures',
        appMode?('Pin every frame to its notebook’s current git commit '
          +'— updates stop changing them')
          :('Needs the Junoview app: locking reads git through the local '
            +'server, and this page was exported as a standalone file.'),
        function(){lockAllFrames();}],
       ['unlock','Unlock all',
        'Every frame follows notebook updates again',
        function(){unlockAllFrames();}],
       ['reload','Load locked versions',
        'Fetch every locked figure’s content from git — the '
          +'notebooks don’t need to be open',
        function(){loadLockedVersions();}]]
        .forEach(function(r){
          var b=document.createElement('button');
          b.className='dbtn vw-opt';
          b.disabled=!appMode;
          b.innerHTML=bic(r[0])+' '+esc(r[1]);
          b.title=r[2];
          b.addEventListener('click',function(){overlayHide(hum);r[3]();});
          hum.appendChild(b);
        });
      overlayShow(hub,hum);floatMenu(hub,hum);
    });
    var one=$('#fmt-imgrefresh');
    if(one) one.addEventListener('click',function(e){
      e.stopPropagation();
      var sl=pres.slides[cur],hits=[];
      selIdxs().forEach(function(i){
        var a=(sl&&sl.annots||[])[i];
        /* T437: a file, a path or an address -- anything re-readable */
        if(a&&a.k==='image'&&(a.fkey||picAddr(a)))
          hits.push({si:cur,ai:i,a:a});});
      refreshImagesReport(hits);
    });
    /* T437: the Link only switch on the Object tab */
    var lk=$('#fmt-imglink');
    if(lk) lk.addEventListener('click',function(e){
      e.stopPropagation();
      var sl=pres.slides[cur],a=(sl&&sl.annots||[])[selAnnot];
      if(!a||a.k!=='image'||!picAddr(a)) return;
      picSetLink(a,picState(a)!=='link').then(function(){showFmt();});
    });
  })();
  /* T313: A PATH IS READ, A URL IS LINKED.
     Every spelling of a computer path resolves to a file: URL, and an
     http document may not load one as a subresource -- so the door's
     old promise of "a file path or a URL" produced a broken picture,
     in the app where it was typed, for the whole path half of itself.
     In app mode the server reads it (gated to images, magic-checked,
     capped) and the bytes are kept with the address beside them; a web
     address stays a link, because it already works and proxying it
     would make the server reachable as one. */
  /* ---- T437: EMBEDDED BY DEFAULT (2026-09-14, user: "images are
     still just loading from their path by default. The default should
     be that they are embedded, and then there are options to make them
     just from the path and so load each time, as well as refresh from
     the path even if they are embedded ... The load always from path
     (symbolic link) needs to be a compression thing that is only active
     manually so people are aware"). Every door now reads the picture
     into the deck and keeps its address beside the bytes; "link only"
     is a choice you make on the picture, said out loud as the size
     saving it is, and undone by Refresh. */
  function fetchDataUrl(url){
    return fetch(url,{mode:'cors'}).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.blob();
    }).then(function(b){
      if(b.type&&b.type.indexOf('image/')!==0)
        throw new Error('not a picture');
      return readAsDataURL(b);
    });
  }
  /* one picture: hold the bytes (off) or live at its address (on) */
  function picSetLink(a,on){
    if(!a||a.k!=='image') return Promise.resolve(false);
    var addr=picAddr(a);
    if(!addr) return Promise.resolve(false);
    if(on){
      if(picState(a)==='link') return Promise.resolve(true);
      a.src=addr;delete a.psrc;
      if(a.okey){try{idbDel(a.okey);}catch(e){}delete a.okey;}
      markDirty();refresh();imgPaneRefresh();
      toast('Link only: the deck keeps just the address, so it is smaller '
        +'\u2014 and the picture is missing wherever '+midElide(addr,40)
        +' cannot be reached. Refresh puts the bytes back.',9000);
      return Promise.resolve(true);
    }
    if(picState(a)!=='link') return Promise.resolve(true);
    var si=cur,ai=(pres.slides[cur].annots||[]).indexOf(a);
    return refreshImagesReport([{si:si,ai:ai,a:a}],true).then(function(r){
      var ok=!!(r&&r.ok);
      toast(ok?'Kept in the deck \u2014 it remembers '+midElide(addr,40)
        :('Could not read '+midElide(addr,40)+' \u2014 still a link'),6000);
      imgPaneRefresh();
      return ok;
    });
  }
  function placeFromAddress(addr){
    var isUrl=/^https?:\/\//i.test(addr);
    if(isUrl){
      /* T437: read and kept, with the address beside it. Only a site
         that refuses the read leaves it as a link, and that is said. */
      toast('Reading '+midElide(addr,40)+'\u2026');
      fetchDataUrl(addr).then(function(full){
        return shrinkDataUrl(full).then(function(small){
          placeImage(small,0,null,full!==small?full:null);
          var s=pres.slides[cur],a=s&&(s.annots||[])[selAnnot];
          /* the address lands after placeImage selected the picture,
             so the Object tab is re-judged with it */
          if(a&&a.k==='image'){a.psrc=addr;markDirty();showFmt();}
          toast('Kept in the deck, and it remembers '+midElide(addr,40));
          imgPaneRefresh();
        });
      }).catch(function(){
        placeImage(addr,0);
        toast('That site did not let this page read the picture, so it '
          +'is a link: loaded from '+midElide(addr,40)+' each time, and '
          +'missing wherever that cannot be reached.',9000);
      });
      return;
    }
    if(!picCanEmbed()){
      toast('A file on this computer can only be read by the Junoview '
        +'app. Here, use a web address \u2014 or Insert \u203a Picture to '
        +'choose the file.',7000);
      placeImage(addr,0);
      return;
    }
    toast('Reading '+addr+'\u2026');
    APP.api('/api/readimage',{path:addr}).then(function(r){
      if(!r||!r.src) throw new Error('no picture came back');
      return shrinkDataUrl(r.src).then(function(small){
        placeImage(small,0,null,r.src!==small?r.src:null);
        /* the address rides on the annotation, so the row can show it
           and Refresh can go back to it */
        var s=pres.slides[cur],a=s&&(s.annots||[])[selAnnot];
        if(a&&a.k==='image'){
          a.psrc=addr;
          if(r.path) a.ppath=r.path;
          if(r.name) a.fname=r.name;
          markDirty();showFmt();   /* T437: the tab sees the address */
        }
        toast('Kept in the deck, and it remembers '+(r.name||addr));
        imgPaneRefresh();
      });
    }).catch(function(e){
      toast('Could not read that: '+((e&&e.message)||e),7000);
    });
  }
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
  var flipPaneIdx=-1;         /* which annot index the pane is showing */
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
    var a=s&&(s.annots||[])[flipPaneIdx];
    return (a&&a.k==='flip')?a:null;
  }
  /* the name a frame goes by: yours, else the card's own title, else its
     number. A bound caption has to be able to say WHICH figure it belongs
     to, and "Frame 3" is no help when there are nine of them. */
  function frameLabel(f,i){
    if(!f) return 'Frame '+(i+1);
    if(f.label) return f.label;
    if(f.own) return 'Page '+(i+1)+' \u2014 its own object';   /* T403 */
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
      if(typeof idx==='number') flipPaneIdx=idx;
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
      row.className='fp-row'+(i===(a.at||0)?' current':'')
        +(f&&f.own?' own':'');   /* T403 */
      var n=document.createElement('span');
      n.className='fp-n';n.textContent=(i+1);
      if(f&&f.own) n.title='This page is its own object on the slide';
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
      /* T403: out of the book as its own object, and back in */
      var ownRow=(f&&f.own)
        ?[bic('link')+' Put back',function(){flipRelink(a,i);},
          'Put the picture back in the book\u2019s box, as an ordinary '
          +'page','fp-own']
        :[bic('unlink')+' Own object',function(){flipUnlink(a,i);},
          'Take this page out of the book as its own object \u2014 move, '
          +'resize, fade or crop it on its own. It still shows with '
          +'this page','fp-own'];
      [ownRow,
       ['\u2191',function(){flipMove(i,-1);},'Move this figure earlier'],
       ['↓',function(){flipMove(i,1);},'Move this figure later'],
       [bic('exit'),function(){flipDrop(i);},'Remove this figure']]
        .forEach(function(pr){
          var b=document.createElement('button');
          b.className='film-mini'+(pr[3]?' '+pr[3]:'');
          b.innerHTML=pr[0];b.title=pr[2];
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
  /* ---- T403: A PAGE THAT IS ITS OWN OBJECT ----------------------------
     (2026-09-13, user: "there should be ways to change the size of one
     and not others, e.g. in object there is like a 'unlink this frame'
     or something and then individual ones can be moved around and
     changed opacity and size individually whilst still being part of
     the book"). A book's pages share one box by design -- the
     letterbox note in renderAnnots says why. So a page that wants its
     own place is taken OUT of the box and TIED to it: the picture (or
     the notebook figure) becomes an ordinary object on the slide that
     shows with this page only (a.fb/a.fbf, the tie every caption
     already uses), and the page itself stays in the book as a blank
     leaf ({own:1}) so the book's click stops, its numbering and every
     other tie are untouched. Move it, resize it, fade it, crop it: it
     is an object. "Put back" is the reverse. */
  function flipOwnObj(s,a,i){
    var hit=null;
    ((s&&s.annots)||[]).forEach(function(x){
      if(hit||!x||!a.fid||x.fb!==a.fid||(x.fbf|0)!==i) return;
      if(x.k==='image'||x.k==='cell') hit=x;
    });
    return hit;
  }
  function flipUnlink(a,i){
    var s=pres.slides[cur]; if(!s||!a) return null;
    var fr=flipFrames(a).slice(),f=fr[i];
    if(!f||f.own) return null;
    if(!a.fid) a.fid=flipId();
    var o={x:a.x,y:a.y,w:a.w||40,h:a.h||32,fb:a.fid,fbf:i,fbm:'only'};
    if(f.src){o.k='image';o.src=f.src;if(f.okey) o.okey=f.okey;}
    else if(f.ref){
      o.k='cell';o.ref=f.ref;
      if(f.part) o.part=f.part;
      if(f.nbpath) o.nbpath=f.nbpath;
      if(f.lockver) o.lockver=deep(f.lockver);
      if(a.ts) o.ts=a.ts;
    } else return null;
    if(a.op!=null) o.op=a.op;
    if(a.rot) o.rot=a.rot;
    var leaf={own:1};
    if(f.label) leaf.label=f.label;
    fr[i]=leaf;a.frames=fr;a.at=i;
    s.annots=s.annots||[];
    s.annots.push(o);
    var idx=s.annots.length-1;
    markDirty();
    /* the picture's own shape: the frame was letterboxed into the
       book's box, so the object takes the box the picture filled */
    if(o.k==='image') fitObjToPicture(o,s);
    renderSlide();renderFlipPane();
    var l=stage.querySelector('.annot-layer');
    if(l) selectAnnot(l,idx);
    return idx;
  }
  function fitObjToPicture(o,s){
    if(!o||!o.src) return;
    var im=new Image();
    im.onload=function(){
      var nw=im.naturalWidth,nh=im.naturalHeight;
      if(!nw||!nh||(s.annots||[]).indexOf(o)<0) return;
      var pg=pageOf(),pw=pg.mm[0],ph=pg.mm[1];
      var bw=o.w*pw/100,bh=o.h*ph/100,ar=nw/nh;   /* the box, in mm */
      var fw=bw,fh=bh;
      if(bw/bh>ar) fw=bh*ar; else fh=bw/ar;
      o.x=Math.round((o.x+(bw-fw)/2/pw*100)*100)/100;
      o.y=Math.round((o.y+(bh-fh)/2/ph*100)*100)/100;
      o.w=Math.round(fw/pw*100*100)/100;
      o.h=Math.round(fh/ph*100*100)/100;
      markDirty(true);renderSlide();
    };
    im.src=o.src;
  }
  function flipRelink(a,i){
    var s=pres.slides[cur]; if(!s||!a) return false;
    var fr=flipFrames(a).slice(),f=fr[i];
    if(!f||!f.own) return false;
    var o=flipOwnObj(s,a,i);
    if(!o){toast('Its object is no longer on this slide');return false;}
    var back={};
    if(o.k==='image'){back.src=o.src;if(o.okey) back.okey=o.okey;}
    else {
      back.ref=o.ref;
      if(o.part) back.part=o.part;
      if(o.nbpath) back.nbpath=o.nbpath;
      if(o.lockver) back.lockver=deep(o.lockver);
    }
    if(f.label) back.label=f.label;
    fr[i]=back;a.frames=fr;a.at=i;
    var at=s.annots.indexOf(o);
    if(at>=0) s.annots.splice(at,1);
    markDirty();renderSlide();renderFlipPane();
    var l=stage.querySelector('.annot-layer');
    var bi=s.annots.indexOf(a);
    if(l&&bi>=0) selectAnnot(l,bi);
    return true;
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
  /* ---- T439: THE FLIP BOOK'S DOORS ARE ON THE ROW ---------------------
     (2026-09-14, user: "for flip books, the options that are there with
     the add need to be not hidden under a menu, but need to be visible
     by default"). T234 put the three things you can do to a book's
     contents behind one "+ Add" tile; they are four buttons now:
     Figures (the tile, a notebook door), Pictures, Pages, and the page
     showing as its own object or back in the book. The pane keeps its
     own two buttons: you are already looking at the list there. */
  function flipSelIdx(){
    var s=pres.slides[cur],idx=null;
    selIdxs().forEach(function(i){
      var x=(s&&s.annots||[])[i];
      if(idx===null&&x&&x.k==='flip') idx=i;});
    return idx;
  }
  (function(){
    function door(id,fn){
      var b=$(id);
      if(b) b.addEventListener('click',function(e){
        e.stopPropagation();
        var idx=flipSelIdx();
        if(idx===null) return;
        fn(idx);
      });
    }
    door('#fmt-figures',function(idx){startPick(idx,true);});
    door('#fmt-flip-imgs',function(idx){
      flipPaneIdx=idx;
      var fi=$('#fp-img-file');
      if(fi){fi.value='';fi.click();}
    });
    door('#fmt-flip-pages',function(idx){showFlipPane(true,idx);});
    /* T403: the page showing, as its own object -- the ask was "in
       object there is like a 'unlink this frame'" */
    door('#fmt-flip-own',function(idx){
      var bk=(pres.slides[cur].annots||[])[idx];
      var pgAt=bk?(bk.at||0):0,pgF=bk?flipFrames(bk)[pgAt]:null;
      if(!pgF) return;
      if(pgF.own) flipRelink(bk,pgAt); else flipUnlink(bk,pgAt);
      showFmt();
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
      if(flipPaneItem()) startPick(flipPaneIdx,true);});
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
      flipAddFiles(a,Array.prototype.slice.call(files));
    });
  })();
  /* FILES BECOME PAGES. The file input's door above and the paste door
     (30-format-bar.js, T408) both land here, so a picture arrives in a
     flip book the same way whichever way it came. `done2`, if given,
     hears how many pages were made once the last file has been read. */
  function flipAddFiles(a,list,done2){
    var got=[],done=0;
    if(!a||!list||!list.length) return;
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
      var n=0;
      got.forEach(function(g){if(g){a.frames.push(g);n++;}});
      a.at=a.frames.length-1;
      /* ONE history entry for the whole batch */
      markDirty();renderSlide();renderFlipPane();
      if(done2) done2(n);
    }
  }
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
      overlayHide(m);
      ((typeof deckEl!=='undefined'&&deckEl)||document.body).appendChild(m);
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
      function(){
        objInto=-1;
        /* T365: with no notebook open the picker had nothing to pick
           from, and the door that used to sit above the thumbnails
           ("Open notebooks...") has gone with the rest of that block.
           Asking for a figure IS asking for a notebook, so this opens
           one rather than showing you an empty page. */
        if(!(APP.order&&APP.order.length)){
          var tb=$('#tab-open');
          if(tb){toast('Open a notebook to pick a figure from');tb.click();
            return;}
        }
        startPick(idx);}],
     [bic('image'),'A picture from this computer',
      'Choose an image file. Junoview keeps a link to the file where the '
      +'browser allows it, so Refresh can re-read it later',
      function(){objInto=idx;var b=$('#et-image'); if(b) b.click();}],
     [bic('paste'),'A picture on the clipboard',
      'Paste a screenshot or a copied image straight into this frame',
      function(){objInto=idx;pasteObjImage();}],
     [bic('link'),'A path or a link',
      picCanEmbed()
        ? 'A file on this computer or a web address. Either is READ and '
          +'kept in the deck, and remembers where it came from so you '
          +'can re-read it (T437).'
        : 'A web address. It is read and kept in the deck, and remembers '
          +'where it came from so you can re-read it; a site that '
          +'refuses the read leaves it as a link, and that is said.',
      function(){
        askText({title:'A picture by address',
          label:picCanEmbed()?'A path on this computer, or a web address'
            :'A web address',value:'',ok:'Place it',
          placeholder:picCanEmbed()?'C:\\figures\\map.png or https://\u2026'
            :'https://\u2026'},function(p){
        if(!p||!p.trim()) return;
        objInto=idx;placeFromAddress(p.trim());
        });}]
    ].forEach(function(r){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      b.title=r[2];
      b.innerHTML=r[0]+' '+r[1];
      b.addEventListener('click',function(e){
        e.stopPropagation();overlayHide(m);r[3]();});
      m.appendChild(b);
    });
    overlayShow(btn,m);
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
  /* ...AND IT NESTS (T207; 2026-09-02, user: "options in options is
     shit and can't be clicked"). Background inside the folded Slide
     popover, a colour swatch inside the Font window, the layout grid
     inside a folded Layout group: each is a menu opened from INSIDE an
     open one, and "at most one shows" closed the parent under it, which
     took the child with it. The owner keeps a stack now. Showing a menu
     closes everything that does not contain it and keeps what does;
     an outside click closes, innermost first, every menu it was outside
     of and stops at the first it was inside; Escape closes only the
     innermost. `overlayNow` is still the innermost open menu, for the
     guards elsewhere that ask whether anything is open. */
  var overlayStack=[];
  var overlayNow=null;
  function overlaySync(){
    overlayNow=overlayStack.length?overlayStack[overlayStack.length-1]:null;
  }
  function overlayCloseOne(o){
    o.menu.hidden=true;
    if(o.btn&&o.btn.setAttribute) o.btn.setAttribute('aria-expanded','false');
  }
  function overlayClose(){                     /* the innermost */
    if(!overlayStack.length) return;
    overlayCloseOne(overlayStack.pop());
    overlaySync();
  }
  function overlayCloseAll(){
    while(overlayStack.length) overlayClose();
  }
  function overlayShow(btn,menu){
    if(!menu) return;
    var keep=[];
    overlayStack.forEach(function(o){
      if(o.menu===menu) return;                /* re-shown: pushed again */
      var inside=o.menu.contains(menu)||(btn&&o.menu.contains(btn));
      if(inside) keep.push(o); else overlayCloseOne(o);
    });
    overlayStack=keep;
    menu.hidden=false;
    if(btn&&btn.setAttribute) btn.setAttribute('aria-expanded','true');
    overlayStack.push({btn:btn,menu:menu});
    overlaySync();
  }
  function overlayHide(menu){
    if(!menu) return;
    var at=-1;
    overlayStack.forEach(function(o,i){if(o.menu===menu) at=i;});
    if(at<0){menu.hidden=true;return;}
    /* closing a menu closes the ones opened from inside it */
    overlayStack.splice(at).reverse().forEach(overlayCloseOne);
    overlaySync();
  }
  /* A RUNTIME-BUILT MENU (T213): appended inside the editor's layer,
     shown through the owner, floated under its button, and removed
     when the owner hides it. `overlayDrop` is what a row calls after a
     pick: through the owner, so the stack never holds a dead node. */
  function overlayMount(btn,m){
    ((typeof deckEl!=='undefined'&&deckEl)||document.body).appendChild(m);
    m.hidden=true;
    overlayShow(btn,m);
    if(btn) floatMenu(btn,m);
    new MutationObserver(function(){
      if(m.hidden&&m.parentNode) m.remove();
    }).observe(m,{attributes:true,attributeFilter:['hidden']});
  }
  function overlayDrop(m){
    if(!m) return;
    overlayHide(m);
    if(m.parentNode) m.remove();
  }
  function overlayBoot(){
    document.addEventListener('click',function(e){
      if(!overlayStack.length) return;
      /* T465: A CLICK WHOSE TARGET IS NO LONGER IN THE DOCUMENT WAS
         INSIDE. A control whose own handler re-renders its surface
         (the layout builder's add-slot, Tidy page's fix buttons) or
         closes it and opens another (the Style system's Check
         consistency) has been detached by the time the click bubbles
         here; `contains` then says "outside" and the surface the click
         opened, or was working in, is popped as if you had clicked the
         page. Three surfaces closed themselves in the user's hands
         for this (2026-09-15 review). Nothing outside an overlay is
         ever detached by its own click, so a detached target is the
         overlay's own. */
      if(e.target&&e.target.nodeType===1&&!document.contains(e.target)) return;
      for(var i=overlayStack.length-1;i>=0;i--){
        var o=overlayStack[i];
        if(o.menu.contains(e.target)) break;
        var b=o.btn;
        if(b&&(e.target===b||(b.contains&&b.contains(e.target)))) break;
        overlayCloseOne(overlayStack.pop());
      }
      overlaySync();
    });
    /* CAPTURE, and stopped there. An open menu is the innermost state
       you can be standing in, so Escape closes it and does nothing
       else: the ladder in 55-sections-and-strip.js (drop the tool, drop
       the selection, leave the editor) used to fire on the same key, so
       closing the Font window deselected the very box it was about
       (found driving T177, 2026-09-02). The gallery and the notes
       editor make the same choice for the same reason. */
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape'||!overlayStack.length) return;
      e.preventDefault();e.stopPropagation();
      var b=overlayNow&&overlayNow.btn;
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
  /* ---- T387: A ZOOM CALLOUT ------------------------------------------
     (2026-09-12, user: "a zoom on a feature in an image, like a new box
     gets created with a zoom"). Drag a box on the picture; three things
     appear, grouped: an outline where you dragged, a second picture
     wearing that box as its window (a.win) so it shows the part
     enlarged, and a line from one to the other. The callout arrives
     with a Grow, on a build of its own. Same overlay idea as the free
     crop: the overlay wants the pointer and nothing else does. */
  var zcArm=null;
  function armZoomCall(){
    var s=pres.slides[cur];
    var idx=(typeof selAnnot==='number')?selAnnot:null;
    var a=(idx!=null)&&(s&&s.annots||[])[idx];
    if(!a||a.k!=='image'||!a.src){toast('Select a picture first');return;}
    var layer=stage.querySelector('.annot-layer');
    var host=layer&&layer.querySelector('.an-item[data-idx="'+idx+'"]');
    if(!layer||!host){toast('Select a picture first');return;}
    if(zcArm) endZoomCall(false);
    var ov=document.createElement('div');
    ov.className='crop-lasso';
    var box=document.createElement('div');box.className='zc-box';
    box.hidden=true;ov.appendChild(box);
    var hint=document.createElement('div');
    hint.className='cl-hint';
    hint.textContent='Drag a box over the part to enlarge \u2014 Esc to '
      +'stop';
    ov.appendChild(hint);
    layer.appendChild(ov);
    zcArm={idx:idx,ov:ov,box:box,host:host,layer:layer,p0:null,p1:null};
    var hr=host.getBoundingClientRect();
    function at(ev){
      return [Math.max(0,Math.min(100,((ev.clientX-hr.left)/(hr.width||1))*100)),
              Math.max(0,Math.min(100,((ev.clientY-hr.top)/(hr.height||1))*100))];
    }
    function paint(){
      var r=zcRegion(); if(!r){box.hidden=true;return;}
      var lr=layer.getBoundingClientRect();
      box.hidden=false;
      box.style.left=((hr.left-lr.left+r.x/100*hr.width)/lr.width*100)+'%';
      box.style.top=((hr.top-lr.top+r.y/100*hr.height)/lr.height*100)+'%';
      box.style.width=(r.w/100*hr.width/lr.width*100)+'%';
      box.style.height=(r.h/100*hr.height/lr.height*100)+'%';
    }
    ov.addEventListener('mousedown',function(ev){
      ev.preventDefault();ev.stopPropagation();
      zcArm.p0=at(ev);zcArm.p1=zcArm.p0;paint();
    });
    ov.addEventListener('mousemove',function(ev){
      if(!zcArm||!zcArm.p0) return;
      zcArm.p1=at(ev);paint();
    });
    ov.addEventListener('mouseup',function(ev){
      ev.preventDefault();ev.stopPropagation();
      if(!zcArm||!zcArm.p0) return;
      zcArm.p1=at(ev);endZoomCall(true);
    });
    document.addEventListener('keydown',zcKey,true);
  }
  function zcRegion(){
    if(!zcArm||!zcArm.p0||!zcArm.p1) return null;
    var x=Math.min(zcArm.p0[0],zcArm.p1[0]),y=Math.min(zcArm.p0[1],zcArm.p1[1]);
    var w=Math.abs(zcArm.p1[0]-zcArm.p0[0]),h=Math.abs(zcArm.p1[1]-zcArm.p0[1]);
    return {x:x,y:y,w:w,h:h};
  }
  function zcKey(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();endZoomCall(false);}
  }
  function endZoomCall(commit){
    if(!zcArm) return;
    var z=zcArm; zcArm=null;
    document.removeEventListener('keydown',zcKey,true);
    if(z.ov&&z.ov.parentNode) z.ov.parentNode.removeChild(z.ov);
    if(!commit) return;
    var r=zcRegionOf(z);
    if(!r||r.w<3||r.h<3){
      toast('That box was too small to enlarge \u2014 nothing changed');
      return;
    }
    makeZoomCallout(z.idx,r);
  }
  function zcRegionOf(z){
    var x=Math.min(z.p0[0],z.p1[0]),y=Math.min(z.p0[1],z.p1[1]);
    return {x:Math.round(x*10)/10,y:Math.round(y*10)/10,
      w:Math.round(Math.abs(z.p1[0]-z.p0[0])*10)/10,
      h:Math.round(Math.abs(z.p1[1]-z.p0[1])*10)/10};
  }
  function makeZoomCallout(idx,win){
    var s=pres.slides[cur],a=s&&s.annots&&s.annots[idx];
    if(!a) return;
    var page=pageOf(),pw=page.mm[0],ph=page.mm[1];
    var ax=a.x||0,ay=a.y||0,aw=a.w||30,ah=a.h||24;
    /* the window's shape in millimetres, so the callout's box has the
       same shape and the picture is not stretched into it */
    var wmm=aw/100*pw*win.w/100,hmm=ah/100*ph*win.h/100;
    var wc=Math.max(12,Math.min(34,aw*0.6));
    var hc=(wc/100*pw*(hmm/wmm))/ph*100;
    if(hc>60){hc=60;wc=(hc/100*ph*(wmm/hmm))/pw*100;}
    var gap=2,x,y,side;
    if(ax+aw+gap+wc<=100){x=ax+aw+gap;side='right';}
    else if(ax-gap-wc>=0){x=ax-gap-wc;side='left';}
    else {x=Math.max(0,Math.min(100-wc,ax));side='below';}
    y=(side==='below')?Math.min(100-hc,ay+ah+gap)
      :Math.max(0,Math.min(100-hc,ay+ah/2-hc/2));
    var rx=ax+aw*win.x/100,ry=ay+ah*win.y/100,rw=aw*win.w/100,rh=ah*win.h/100;
    var col='#39a9c0';
    var outline={k:'rect',x:rx,y:ry,w:rw,h:rh,color:col};
    outline.sw=SW_DEFAULT;
    var call={k:'image',x:x,y:y,w:wc,h:hc,src:a.src,
      win:{x:win.x,y:win.y,w:win.w,h:win.h},
      anim:{type:'zoom',order:nextAnimOrder(s)}};
    if(a.okey) call.okey=a.okey;
    if(a.alt) call.alt=a.alt;
    var line=(side==='right')
      ?{k:'arrow',x1:rx+rw,y1:ry+rh/2,x2:x,y2:y+hc/2}
      :(side==='left')
      ?{k:'arrow',x1:rx,y1:ry+rh/2,x2:x+wc,y2:y+hc/2}
      :{k:'arrow',x1:rx+rw/2,y1:ry+rh,x2:x+wc/2,y2:y};
    line.nohead=1;line.color=col;line.sw=SW_DEFAULT;
    var gid=nextGrp(s);
    outline.grp=gid;line.grp=gid;call.grp=gid;
    s.annots.push(outline);s.annots.push(line);s.annots.push(call);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
    if(typeof renderFilm==='function') renderFilm();
    toast('Zoom callout added \u2014 it arrives with a Grow. Ctrl+Z '
      +'undoes it');
  }
  /* ---- T387: PICTURES THAT ZOOM TOGETHER --------------------------------
     a.sync is a per-slide number, like a.grp: the pictures wearing the
     same one come up side by side when any of them is enlarged in the
     show. The button links the selection, or unlinks it when it is
     already one set. */
  function syncIdxs(){
    var s=pres.slides[cur];
    return selIdxs().filter(function(i){
      var a=(s&&s.annots||[])[i];
      return a&&(a.k==='image'||a.k==='cell');});
  }
  function linkZoomSel(){
    var s=pres.slides[cur],idxs=syncIdxs();
    if(idxs.length<2){toast('Select two or more pictures first');return;}
    var first=s.annots[idxs[0]].sync;
    var same=first!=null&&idxs.every(function(i){
      return s.annots[i].sync===first;});
    if(same){
      idxs.forEach(function(i){delete s.annots[i].sync;});
      toast('These no longer zoom together');
    } else {
      var next=0;
      (s.annots||[]).forEach(function(a){
        if(a&&a.sync!=null&&a.sync>=next) next=a.sync+1;});
      idxs.forEach(function(i){s.annots[i].sync=next;});
      toast(idxs.length+' pictures zoom together now \u2014 enlarge one '
        +'in the show and they all come up');
    }
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
    pictureSync();
  }
  function pictureSync(){
    var b=$('#fmt-linkzoom'); if(!b) return;
    var s=pres.slides[cur],idxs=syncIdxs();
    b.disabled=idxs.length<2;
    var first=idxs.length?s.annots[idxs[0]].sync:null;
    var on=idxs.length>=2&&first!=null&&idxs.every(function(i){
      return s.annots[i].sync===first;});
    b.setAttribute('aria-pressed',on.toString());
    b.title=on
      ?'These zoom together. Press to unlink them'
      :'Select two or more pictures: when one is enlarged in the show '
        +'they all come up together, side by side';
  }
  /* how far one edge's trim may go: up to the opposite edge's trim, less
     the sliver of picture that must remain (T407) */
  var CROP_KEEP=4;
  function cropRoom(a,side){
    var opp={t:'b',b:'t',l:'r',r:'l'}[side];
    var o=(a&&a.crop&&+a.crop[opp])||0;
    return Math.max(0,100-o-CROP_KEEP);
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
          /* T407: AS FAR AS THE OTHER EDGE ALLOWS. Each side was capped
             at 45%, so the right-hand third of a figure could never be
             all that was kept (2026-09-13, user: "you cannot crop an
             object more than half way"). A handle may now go up to the
             opposite trim, leaving CROP_KEEP percent of the picture. */
          v=Math.max(0,Math.min(cropRoom(a,side),Math.round(v*10)/10));
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
      inp.type='number';inp.min='0';inp.max=String(100-CROP_KEEP);
      inp.step='1';
      inp.placeholder=p[1];
      inp.title='Trim the '+p[1]+' edge (% of the frame)';
      inp.addEventListener('click',function(e){e.stopPropagation();});
      inp.addEventListener('input',function(){
        var v0=Math.max(0,parseFloat(inp.value)||0);
        fmtApply(function(a){
          a.crop=a.crop||{};
          var v=Math.min(v0,cropRoom(a,p[0]));   /* T407 */
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
    /* ---- T387: THE FRAME'S SHAPE ----------------------------------------
       (2026-09-12, user: "the way cropping works can be pushed
       further"). A row of ratios: each trims two opposite edges,
       centred, so the box shows that shape of the picture -- the
       trim the four handles would take a minute to get right. */
    var ar=document.createElement('div');ar.className='crop-inset crop-aspect';
    var al=document.createElement('span');al.className='ci-lab';
    al.textContent='Frame';ar.appendChild(al);
    [['16:9',16/9],['4:3',4/3],['1:1',1],['3:2',1.5],['2:3',2/3]]
      .forEach(function(pr){
        var b=document.createElement('button');b.type='button';
        b.className='dbtn';b.textContent=pr[0];
        b.title='Trim the edges so the frame is '+pr[0];
        b.addEventListener('click',function(e){
          e.stopPropagation();
          var page=pageOf();
          fmtApply(function(a){
            var R=((a.w||30)/100*page.mm[0])/((a.h||24)/100*page.mm[1]);
            var c={};
            if(a.crop&&a.crop.shape) c.shape=a.crop.shape;
            if(R>pr[1]){c.l=c.r=Math.round((1-pr[1]/R)/2*1000)/10;}
            else {c.t=c.b=Math.round((1-R/pr[1])/2*1000)/10;}
            ['t','r','b','l'].forEach(function(k){
              if(c[k]!=null) c[k]=Math.min(45,c[k]);});
            a.crop=c;
          });
          SIDES.forEach(function(p){inputs[p[0]].value='';});
        });
        ar.appendChild(b);
      });
    menu.appendChild(ar);
    /* T387: the callout and the zoom link live on the same group */
    var zc=$('#fmt-zoomcall');
    if(zc) zc.addEventListener('click',function(e){
      e.stopPropagation();armZoomCall();});
    var lz=$('#fmt-linkzoom');
    if(lz) lz.addEventListener('click',function(e){
      e.stopPropagation();linkZoomSel();});
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
    var head=menuHead(p,'order on this slide');
    var x=document.createElement('button');
    x.className='dbtn dc-icon rd-close';x.type='button';
    x.setAttribute('aria-label','Close');x.title='Close';
    x.innerHTML=bic('exit')||'\u2715';
    x.addEventListener('click',function(e){e.stopPropagation();
      rdClose();});
    head.appendChild(x);
    var note=document.createElement('div');note.className='rd-note';
    /* PLAIN WORDS (T181; 2026-09-02, user: "what is reading order and
       why does it look so confusing"). Say what the order is FOR,
       then how to set it, and lead with the way that needs no
       arrows. */
    note.textContent='The order things are numbered and revealed in. '
      +'Quick animate on the Animation tab sets it as you click things '
      +'in turn; the arrows here nudge one thing earlier or later. The '
      +'numbers show on the slide while this is open.';
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
        ?'Set by you \u2014 anything added later comes last'
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
  /* T285: THE CLOCK STARTS WITH THE TALK. presStart was set when the
     presenter WINDOW opened, so the elapsed time was already however
     long you spent dragging that window to the second screen and
     lining it up before you pressed Play -- and the behind/ahead badge
     is read straight off it. Called from the one place that knows a
     talk has begun (setUIMode's startingTalk branch, beside
     rehStart). */
  function presTimerStart(){
    presStart=Date.now();presPaused=0;presPauseAt=0;
  }
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
    var bg=pageBgOf(sl);
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
    /* ---- T222: ARE YOU RUNNING LATE ---------------------------------
       The bar showed the clock and how much of the slot was left, but
       never the number that changes what you do next: whether you are
       behind FOR WHERE YOU ARE (2026-09-03, user: "the running late
       [thing] should be in the presentation view"). Planned-so-far is
       the sum of the per-slide targets up to and including this one;
       with no targets set it is the slot shared out evenly, which is
       the assumption a speaker makes anyway. */
    var planned=0;
    if(shownAt>=0){
      var goals=0,any=false;
      shown.slice(0,shownAt+1).forEach(function(ix){
        var g=slideGoal(pres.slides[ix]);
        if(g){goals+=g;any=true;}
      });
      if(any) planned=goals*60;
      else if(pres.talkMins&&shown.length)
        planned=pres.talkMins*60*(shownAt+1)/shown.length;
    }
    presWin.__jvState={start:presStart,paused:presPaused,
      pauseAt:presPauseAt,goal:slideGoal(sl),
      talk:pres.talkMins||0,slide:shownAt,count:shown.length,
      planned:Math.round(planned),slideIndex:cur};
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
      +'.jvp-pace{font-family:var(--mono,monospace);font-size:15px;'
      +'padding:5px 11px;border-radius:8px;white-space:nowrap;'
      +'border:1px solid #ffffff2b;background:#ffffff0f;}'
      +'.jvp-pace.late{background:#ff6b571f;border-color:#ff6b57;'
      +'color:#ff9d8c;}'
      +'.jvp-pace.ahead{background:#46a8921f;border-color:#46a892;'
      +'color:#7fd7c0;}'
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
      +'<span class="jvp-pace" id="jvp-pace"></span>'
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
    /* T285: only if a talk is already running. Opening the presenter
       view is setup, not the talk -- see presTimerStart. */
    if(!presStart&&typeof rehOn!=='undefined'&&rehOn) presStart=Date.now();
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
      /* T222: behind or ahead of where the plan says you should be */
      var pc=d.getElementById('jvp-pace');
      if(pc){
        if(!st.planned){pc.textContent='';pc.className='jvp-pace';}
        else {
          var off=sec-st.planned;
          var mm=Math.floor(Math.abs(off)/60),
              ss=('0'+(Math.abs(off)%60)).slice(-2);
          pc.textContent=Math.abs(off)<30?'on time'
            :(mm+':'+ss+(off>0?' behind':' ahead'));
          pc.className='jvp-pace'
            +(Math.abs(off)<30?'':(off>0?' late':' ahead'));
          pc.title=Math.abs(off)<30
            ?'You are where the plan says you should be'
            :('By this slide the plan expects '
              +Math.floor(st.planned/60)+':'
              +('0'+(st.planned%60)).slice(-2)+' on the clock');
        }
      }
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
    if(typeof transRibbonSync==='function') transRibbonSync();
    toast(kind==null
      ?('This slide arrives however its section says: '
        +transLabel(transFor(i)).toLowerCase())
      :('This slide arrives: '+transLabel(kind).toLowerCase()));
  }
  /* ---- THE RIBBON'S OWN DOOR ONTO THE ABOVE (T289) -------------------
     Declarations only; transRibbonBoot runs from THE BOOT SEQUENCE. */
  function transRibbonBoot(){
    TRANS.forEach(function(t){
      var b=$(transBtnId(t[0]));
      if(!b) return;
      b.addEventListener('click',function(e){
        e.stopPropagation();
        setTrans(cur,t[0]);
        transRibbonSync();
      });
    });
    var door=$('#trans-scope');
    if(door) door.addEventListener('click',function(e){
      e.stopPropagation();openTransScope(door);});
  }
  /* ---- T373: WHO GETS THIS TRANSITION --------------------------------
     "All slides" was one verb on a stranded 26px button, and it was the
     only scope on offer (2026-09-09, user: "that should be a drop down
     menu with options, this slide, all slides, in range, sections
     etc"). The door is a tile now and this is its menu.

     EVERY scope writes the transition onto each slide it names, exactly
     as the old All-slides button did. It deliberately does NOT write a
     section DEFAULT for the section scope: a default and a per-slide
     override are two switches that cannot both be true, and the slide
     wins -- so setting the default on a section whose slides carry
     their own would look like nothing happened. Writing the slides is
     the answer you can see. `pres.sections[id].trans` stays exactly as
     it was, so a default set from the filmstrip menu is not disturbed
     and still governs slides that have no answer of their own. */
  function transKindNow(){
    /* the EFFECTIVE one, so a scope means what you can SEE on this
       slide -- inside a section that may be the section's */
    var sl=(pres.slides||[])[cur];
    return (sl&&typeof sl.trans==='string')?sl.trans:transFor(cur);
  }
  function transGiveTo(idxs,kind,what){
    if(!idxs||!idxs.length) return;
    idxs.forEach(function(i){
      var s=(pres.slides||[])[i]; if(s) s.trans=String(kind);
    });
    markDirty();renderFilm();transRibbonSync();
    toast(what+': '+transLabel(kind).toLowerCase()
      +(idxs.length>1?'. Ctrl+Z undoes the lot.':''));
  }
  function transAllIdxs(){
    return (pres.slides||[]).map(function(s,i){return i;});
  }
  function openTransScope(btn){
    var old=$('#trans-scope-menu'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu match-menu';m.id='trans-scope-menu';
    var kind=transKindNow();
    function row(icon,label,fn){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      b.innerHTML=bic(icon)+' ';
      /* a SECTION NAME is user data and stays a text node */
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click',function(e){
        e.stopPropagation();overlayDrop(m);fn();});
      m.appendChild(b);
      return b;
    }
    if(typeof menuHead==='function')
      menuHead(m,'give \u201c'+transLabel(kind).toLowerCase()+'\u201d to\u2026');
    row('frame','This slide',function(){
      transGiveTo([cur],kind,'This slide arrives');});
    var runs=(typeof sectionRuns==='function')
      ?sectionRuns().filter(function(r){return r.id;}):[];
    runs.forEach(function(r){
      var idxs=[],i;
      for(i=r.at;i<r.at+r.n;i++) idxs.push(i);
      row('film',r.name,function(){
        transGiveTo(idxs,kind,'Every slide in \u201c'+r.name+'\u201d arrives');});
    });
    row('together','All slides',function(){
      transGiveTo(transAllIdxs(),kind,'Every slide arrives');});
    row('scope','Choose slides\u2026',function(){transScopeDlg(kind);});
    overlayMount(btn,m);
  }
  /* THE TICK LIST, which is where "in range" lives. A from/to pair
     exists nowhere in this product; the answer everywhere else is a
     list grouped by section with a tri-state header per section, and
     that expresses a range, a section, several sections or an arbitrary
     handful without a fourth widget. Its own exclusion map, keyed on
     the slide OBJECT rather than its index, for the reason the Apply
     dialog's is: a splice from move/delete/duplicate would silently
     re-point an index-keyed set. */
  function transScopeDlg(kind){
    var dlg=$('#ts-dlg'); if(!dlg) return;
    var off=new WeakMap();
    function has(s){return !!s&&!off.has(s);}
    function idxs(){
      var out=[];
      (pres.slides||[]).forEach(function(s,i){if(has(s)) out.push(i);});
      return out;
    }
    function sync(){
      var n=idxs().length,c=$('#ts-count'),ok=$('#ts-ok');
      if(c) c.textContent=n?(n+' slide'+(n===1?'':'s')+' will arrive '
        +transLabel(kind).toLowerCase()):'No slides chosen';
      if(ok){ok.disabled=!n;
        ok.textContent=n?('Give it to '+n+' slide'+(n===1?'':'s')):'Give it';}
    }
    function build(){
      var w=$('#ts-what');
      if(w) w.textContent='Every one of them arrives '
        +transLabel(kind).toLowerCase()+'.';
      var host=$('#ts-scope'); if(!host) return;
      host.innerHTML='';
      ((typeof sectionRuns==='function')?sectionRuns():[{id:'',name:'',
        at:0,n:(pres.slides||[]).length}]).forEach(function(r){
        var i;
        if(r.id){
          var h=document.createElement('div');h.className='aa-sech';
          var hck=document.createElement('input');hck.type='checkbox';
          var on=0;
          for(i=r.at;i<r.at+r.n;i++) if(has(pres.slides[i])) on++;
          hck.checked=on>0;hck.indeterminate=on>0&&on<r.n;
          hck.addEventListener('change',function(){
            for(var j=r.at;j<r.at+r.n;j++){
              var s2=pres.slides[j]; if(!s2) continue;
              if(hck.checked) off.delete(s2); else off.set(s2,1);
            }
            build();sync();});
          h.appendChild(hck);
          var ht=document.createElement('span');
          ht.textContent=r.name;h.appendChild(ht);
          host.appendChild(h);
        }
        var grid=document.createElement('div');grid.className='aa-grid';
        for(i=r.at;i<r.at+r.n;i++)(function(i2){
          var sl=(pres.slides||[])[i2]; if(!sl) return;
          var lab=document.createElement('label');lab.className='find-ck';
          var ck=document.createElement('input');ck.type='checkbox';
          ck.checked=has(sl);
          ck.addEventListener('change',function(){
            if(ck.checked) off.delete(sl); else off.set(sl,1);
            build();sync();});
          lab.appendChild(ck);
          var n2=document.createElement('span');
          n2.className='aa-slide-n';n2.textContent=(i2+1);lab.appendChild(n2);
          var t2=document.createElement('span');
          t2.className='aa-slide-t';
          t2.textContent=(typeof slideTitle==='function')?slideTitle(sl):'';
          lab.appendChild(t2);
          lab.title=t2.textContent;
          grid.appendChild(lab);
        })(i);
        host.appendChild(grid);
      });
    }
    function close(){dlg.hidden=true;}
    function bind(id,fn){
      var b=$('#'+id); if(!b) return;
      b.onclick=function(e){e.stopPropagation();fn();};
    }
    bind('ts-all',function(){off=new WeakMap();build();sync();});
    bind('ts-none',function(){
      (pres.slides||[]).forEach(function(s){off.set(s,1);});build();sync();});
    bind('ts-close',close);
    bind('ts-cancel',close);
    bind('ts-ok',function(){
      var list=idxs();close();
      transGiveTo(list,kind,list.length===1?'That slide arrives'
        :(list.length+' slides arrive'));});
    /* the canvas listens for Escape and for plain letters, so a dialog
       on top of it stops the key before it can nudge a shape */
    dlg.onkeydown=function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}};
    dlg.onclick=function(e){if(e.target===dlg) close();};
    build();sync();
    dlg.hidden=false;
  }
  function transBtnId(kind){
    return '#trans-'+(kind===''?'cut':(kind==='move'?'move':kind));
  }
  function transRibbonSync(){
    if(!(pres.slides||[]).length) return;
    var now=transFor(cur);
    TRANS.forEach(function(t){
      var b=$(transBtnId(t[0]));
      if(b) b.setAttribute('aria-pressed',(now===t[0]).toString());
    });
  }
  /* T316: a section's own colour. '' puts it back on the automatic
     cycle. refresh, because a heading wearing '@section' has to repaint
     and the strip's dot has to follow. */
  function setSectionColor(id,hex){
    var m=(pres.sections||{})[id]; if(!m) return;
    if(/^#[0-9a-f]{6}$/i.test(hex||'')) m.color=hex; else delete m.color;
    markDirty();refresh();
    toast(m.color?('This section\u2019s colour is '+m.color)
      :'This section is back on the automatic colour');
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
  /* ---- T225: A CHECKPOINT IS A SNAPSHOT YOU MEANT ------------------
     (2026-09-03, user: "there should be version of presentations
     where you can save a checkpoint then go back, or then go into a
     new branch.") The tree, the branches and the restore have been
     here since T90; every snapshot in it was a side-effect of
     opening, saving or restoring, none had a name you chose, and
     the keep-the-newest-twenty rule threw them away in arrival
     order -- so the one version you actually cared about was the
     one most likely to go. `mark` names it and keeps it. */
  function snapTake(why,captured,ready,mark){
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
                /* a checkpoint is taken even when nothing changed:
                   you are marking THIS moment, not this content */
                if(prev===cap.txt&&!mark) return false;
                return snapWrite(cap,ix,why,mark);
              });
          return snapWrite(cap,ix,why,mark);
        });
      });
    });
  }
  function snapWrite(cap,ix,why,mark){
    var id='v'+(Date.now().toString(36))
      +Math.random().toString(36).slice(2,5);
    var ent={id:id,at:Date.now(),why:why||'saved',
      n:cap.n,len:cap.txt.length};
    /* absent-is-default, the rule the deck format follows everywhere: a
       trunk snapshot with no parent stores neither key, so a history
       written before branches existed reads as a trunk and is right */
    if(histHead) ent.p=histHead;
    if(histBranch) ent.br=histBranch;
    if(mark) ent.mk=1;              /* T225: kept, and shown as kept */
    var next=ix.concat([ent]);
    histHead=id;
    histNoteWrite();      /* the idle rule's clock (T237) */
    /* T225: a checkpoint is never the one thrown away. Only the
       unmarked ones are candidates, oldest first; if a deck were
       ever all checkpoints the list simply grows, which is the
       answer the user asked for. */
    var over=next.length-HIST_KEEP,drop=[];
    for(var di=0;di<next.length&&over>0;di++){
      if(next[di].mk) continue;
      drop.push(next[di]);over--;
    }
    drop.forEach(function(d){
      var at=next.indexOf(d); if(at>=0) next.splice(at,1);
    });
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
  /* T237: THE PANEL LIVES IN 46-history.js NOW. What is left here is
     the STORE -- the index, the records, the head pointer and the
     eviction rule -- because that is persistence, and the surface
     over it grew a graph, a change model and three readings of it.
     deckDiff stays with the store: the panel is not its only
     caller, and "which slides differ" is a fact about two decks. */
