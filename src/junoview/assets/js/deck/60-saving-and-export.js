/* 60-saving-and-export.js — persistence, autosave, and every way a deck leaves: PDF, PowerPoint, a file.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---------- persistence ---------- */
  var toastTimer;
  function toast(msg,ms){
    var t=$('#deck-toast');t.textContent=msg;t.hidden=false;
    clearTimeout(toastTimer);
    /* a warning about lost work has to outlast a confirmation of saved
       work, so the duration is a parameter now (2026-08-22) */
    toastTimer=setTimeout(function(){t.hidden=true;},ms||3600);
  }
  function mergedPresentations(){
    var out=allSaved().filter(function(p){return p.name!==pres.name;})
      .map(function(p){var c=deep(p);delete c.origin;return c;});
    var cp=deep(pres);delete cp.origin;out.push(cp);
    return out;
  }
  function deckSaveSig(p){
    try{
      var c=deep(p);delete c.origin;return JSON.stringify(c);
    }catch(e){return null;}
  }
  function stillSaved(name,sig){
    return !!sig&&pres&&pres.name===name&&deckSaveSig(pres)===sig;
  }
  /* strip "stem::" when only one notebook is open, so decks saved from a
     single tab stay compatible with sidecars and --embed-deck */
  function plainIfSingle(list){
    if(APP.order.length!==1) return list;
    var pfx=APP.order[0]+'::';
    function strip(a){
      return (a&&String(a).indexOf(pfx)===0)
        ?String(a).slice(pfx.length):a;
    }
    return list.map(function(p){
      var c=deep(p);
      c.slides=(c.slides||[]).map(function(s){
        s.panes=(s.panes||[]).map(strip);
        (s.annots||[]).forEach(function(a){
          if(a.k==='cell'&&a.ref) a.ref=strip(a.ref);
        });
        if(Array.isArray(s.hidden)) s.hidden=s.hidden.map(strip);
        return s;});
      return c;});
  }
  function requireName(){
    if(pres.name) return true;
    toast('Give the presentation a name first');
    var ni=$('#pres-name');ni.hidden=false;ni.focus();
    return false;
  }
  /* ---------- app mode: save to project + autosave ---------- */
  function projectSaved(next,silent,conflict,savedName,savedSig){
    /* The request wrote the click-time copy. If the user typed or renamed
       while it was in flight, that newer live deck is still a draft: do
       not delete its pending browser copy, report it as saved, OR replace
       projectPres with the stale request. The last point matters on a
       rename: doing so resurrects the old name beside the live new one. */
    var exact=stillSaved(savedName,savedSig);
    if(exact){
      projectPres=next;
      cancelDraftWrite();
      lsDel(PFX+(savedName||'untitled'));
      source='saved';
    } else {
      source='draft';scheduleDraftWrite();
    }
    saveStamp=new Date();saveKind=silent?'auto':'manual';
    status();renderPresRow();
    if(conflict){
      renderPresTabs();
      docToastOnce('Another window changed this project — merged '
        +'its changes in. Your "'+savedName+'" is intact.');
    } else if(!silent){
      toast('Saved "'+savedName+'" to junoview_project.json'+embNote());
    }
    return true;
  }
  function saveToProject(silent,embed){
    flushTextEdits();   /* the words still in the DOM are part of the save */
    /* Mint slide ids before both payloads are frozen. History and the
       successful file must describe the same bytes, not adjacent states. */
    var savedHist=!silent?histCapture():null;
    var savedName=pres.name||'untitled',savedSig=deckSaveSig(pres);
    var merged=mergedPresentations();
    /* a deliberate Save writes the self-contained form (figures inside)
       into junoview_project.json; the every-second autosave stays refs-
       only so editing does not rewrite megabytes to a synced disk each
       keystroke. `projectPres` keeps the lean copy either way.
       `embed` is the idle consolidation from scheduleAutosave: silent,
       but self-contained, so the file does not sit refs-only between a
       manual Save and the next one. */
    var body=(silent&&!embed)?merged:embedAssets(deep(merged));
    var op=APP.api('/api/save',{presentations:body,rev:projectRev})
      .then(function(j){
        if(j&&typeof j.rev==='number') projectRev=j.rev;
        return projectSaved(merged,silent,false,savedName,savedSig);
      }).catch(function(e){
        /* ANOTHER WINDOW GOT THERE FIRST. This whole payload is every
           presentation the tab knows about, so before the server grew a
           revision the loser of the race simply erased the winner's work
           — a deck created in one window vanished the moment the other
           typed a character (2026-08-22). Now: take their list, keep the
           one deck this window is actually editing, and write that. */
        if(e&&e.status===409&&e.data&&Array.isArray(e.data.presentations)){
          /* Reconcile the frozen request, not whichever deck/name happens
             to be live when the 409 arrives. A rename while the request
             is in flight must not make `mine` vanish from the retry. */
          var theirs=e.data.presentations.filter(function(p){
            return !p||p.name!==savedName;});
          var mine=merged.filter(function(p){
            return p&&p.name===savedName;});
          projectRev=e.data.rev;
          var reconciled=theirs.concat(mine);
          return APP.api('/api/save',
            {presentations:reconciled,rev:projectRev})
            .then(function(j2){
              if(j2&&typeof j2.rev==='number') projectRev=j2.rev;
              return projectSaved(reconciled,silent,true,
                savedName,savedSig);
            }).catch(function(e2){
              toast('Save failed after a conflict: '
                +((e2&&e2.message)||e2)+' — use File › Download a copy.',
                9000);
              return false;
            });
        }
        if(!silent)
          toast('Save failed: '+(e&&e.message?e.message:e));
        return false;
      });
    /* Enqueued immediately but gated on op=true: a rename after this
       click waits behind the saved snapshot and migrates it as one unit. */
    if(savedHist) snapTake('saved',savedHist,op);
    return op;
  }
  /* one conflict notice per settling period: the autosave retries every
     1.2s, and a notice per retry would be a strobe */
  var conflictT=null;
  function docToastOnce(msg){
    if(conflictT) return;
    toast(msg,7000);
    conflictT=setTimeout(function(){conflictT=null;},8000);
  }
  /* ---------- WHERE this presentation is saved -----------------------
     'project' (app mode: junoview_project.json), 'browser' (this browser,
     the default everywhere else) or 'file' (a .junoview file you pick).
     A picked file is REMEMBERED: the FileSystemFileHandle is stored in
     IndexedDB, so the next visit saves straight back to the same place
     without asking again (the browser only re-asks for permission). */
  var TGKEY='semopts:'+SCOPE+':savetarget';
  var HKEY='deck:'+SCOPE;
  /* T235: THE DEFAULT FOLDER. One directory handle, remembered like
     the file handle beside it, from which Junoview mints its own file
     the first time it needs one -- so "save on this computer" stops
     being a dialog you have to answer and starts being the default.
     Its NAME is kept in localStorage as well, because the menu has to
     be able to say which folder before IndexedDB has answered. */
  var DKEY='deckdir:'+SCOPE;
  var DNKEY='semopts:'+SCOPE+':savedirname';
  var canPickDir=!!window.showDirectoryPicker;
  var deckDir=null,deckDirName=lsGet(DNKEY)||'';
  var canPickFile=!!window.showSaveFilePicker;
  var saveTarget=lsGet(TGKEY)
    ||(APP.mode==='app'?'project':'browser');
  if(saveTarget==='project'&&APP.mode!=='app') saveTarget='browser';
  if(saveTarget==='file'&&!canPickFile) saveTarget='browser';
  var fileHandle=null,fileName='';
  function idb(){
    return new Promise(function(res,rej){
      var r,done=false;
      function fail(e){if(!done){done=true;rej(e);}}
      function okd(v){if(!done){done=true;res(v);}}
      /* a blocked or wedged open must never leave the caller hanging */
      setTimeout(function(){fail(new Error('indexeddb timeout'));},4000);
      try{r=indexedDB.open('junoview',1);}catch(e){fail(e);return;}
      r.onupgradeneeded=function(){
        try{r.result.createObjectStore('handles');}catch(e){}};
      r.onsuccess=function(){okd(r.result);};
      r.onerror=function(){fail(r.error);};
      r.onblocked=function(){fail(new Error('indexeddb blocked'));};
    });
  }
  function idbPut(k,v){
    return idb().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction('handles','readwrite');
        /* .put can throw synchronously (DataCloneError) */
        try{t.objectStore('handles').put(v,k);}catch(e){rej(e);return;}
        t.oncomplete=function(){res();};
        t.onerror=function(){rej(t.error);};
        t.onabort=function(){rej(t.error);};
      });
    });
  }
  function idbDel(k){
    return idb().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction('handles','readwrite');
        try{t.objectStore('handles').delete(k);}catch(e){rej(e);return;}
        t.oncomplete=function(){res();};
        t.onerror=function(){rej(t.error);};
        t.onabort=function(){rej(t.error);};
      });
    });
  }
  function idbGet(k){
    return idb().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction('handles','readonly');
        var q=t.objectStore('handles').get(k);
        q.onsuccess=function(){res(q.result);};
        q.onerror=function(){rej(q.error);};
      });
    });
  }
  function permOK(h){
    if(!h||!h.queryPermission) return Promise.resolve(!!h);
    return h.queryPermission({mode:'readwrite'})
      .then(function(s){return s==='granted';}).catch(function(){
        return false;});
  }
  /* reading needs less than writing — a handle whose write grant lapsed
     can often still be read, which is enough to restore what it holds */
  function permReadOK(h){
    if(!h||!h.queryPermission) return Promise.resolve(!!h);
    return h.queryPermission({mode:'read'})
      .then(function(s){return s==='granted';}).catch(function(){
        return false;});
  }
  function permAsk(h){
    if(!h) return Promise.resolve(false);
    return permOK(h).then(function(ok){
      if(ok||!h.requestPermission) return ok;
      return h.requestPermission({mode:'readwrite'})
        .then(function(s){return s==='granted';})
        .catch(function(){return false;});
    });
  }
  /* a file name this deck can be found by, from the deck's own name */
  function deckFileName(){
    var n=String(pres.name||'presentation').trim()
      .replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').slice(0,60);
    return (n||'presentation')+'.junoview.html';
  }
  function pickSaveFolder(){
    if(!canPickDir) return Promise.resolve(null);
    return window.showDirectoryPicker({mode:'readwrite',
      id:'junoview-decks'}).then(function(d){
      deckDir=d;deckDirName=d.name||'';
      lsSet(DNKEY,deckDirName);
      idbPut(DKEY,d).catch(function(){});
      return d;
    });
  }
  /* the file inside the default folder, made if it is not there yet.
     `silent` is an autosave, which has no user gesture behind it and
     so must never raise a permission prompt. */
  function folderFile(silent){
    if(!deckDir) return Promise.resolve(null);
    return (silent?permOK(deckDir):permAsk(deckDir)).then(function(ok){
      if(!ok) return null;
      return deckDir.getFileHandle(deckFileName(),{create:true})
        .then(function(h){
          fileHandle=h;fileName=h.name||deckFileName();
          idbPut(HKEY,h).catch(function(){});
          return h;
        }).catch(function(){return null;});
    });
  }
  function pickSaveFile(){
    if(!canPickFile) return Promise.resolve(null);
    return window.showSaveFilePicker({
      /* .junoview.html so double-clicking the file opens a browser; the
         picker API only takes single-dot extensions, so the double suffix
         goes in the suggested name */
      suggestedName:(pres.name||'presentation')+'.junoview.html',
      types:[{description:'Junoview presentation',
        accept:{'text/html':['.html']}}]
    }).then(function(h){
      fileHandle=h;fileName=h.name||'';
      /* REMEMBERING the file is best-effort: it must never delay or block
         the save itself, so it runs in the background */
      idbPut(HKEY,h).catch(function(){});
      return h;
    });
  }
  /* ---- make the saved deck carry its own pictures ---------------------
     Every placed card's rendered body (figures are data: URIs already) is
     written into the presentation as `p.emb`, keyed by the ref exactly as
     it is saved — so a deck opened with no notebook, and no internet to
     re-fetch one, still shows every frame. Open notebooks are captured
     fresh at save time (the deck tracks the notebook, as ever); a card
     whose notebook is closed keeps its last saved copy instead of losing
     it. normPres absorbs `emb` back into the session store on load. */
  function embedAssets(list){
    list.forEach(function(p){
      if(p.kind==='view') return;
      var emb={};
      (p.slides||[]).forEach(function(s){
        /* every notebook card this slide places, from BOTH the kinds that
           can hold one. A flip book's frames are refs exactly like a
           placed cell's, and leaving them out meant a self-contained deck
           opened with every frame blank — the one failure the embedded
           snapshots exist to prevent (2026-08-22). They dedupe by ref, so
           a flip book costs the same as placing its figures one by one. */
        var refs=[];
        (s.annots||[]).forEach(function(a){
          if(!a) return;
          if(a.k==='cell'&&a.ref) refs.push(a.ref);
          else if(a.k==='flip') flipFrames(a).forEach(function(f){
            if(f&&f.ref) refs.push(f.ref);});
        });
        refs.forEach(function(ref){
          if(emb[ref]) return;
          var it=resolveRef(ref);
          if(it&&!it.emb){
            var b=cloneBody(ref);
            if(!b) return;
            var e={title:it.title||'',kind:it.kind||'',html:b.outerHTML};
            var cc=it.hasCode?cloneCode(ref):null;
            if(cc) e.code=cc.outerHTML;
            emb[ref]=e;
            embStore(normRef(ref),e);   /* keep the session copy fresh */
          } else {
            var e2=embFor(ref);
            if(e2){
              var cp={title:e2.title,kind:e2.kind,html:e2.html};
              if(e2.code) cp.code=e2.code;
              emb[ref]=cp;
            }
          }
        });
      });
      if(Object.keys(emb).length) p.emb=emb;
    });
    /* how much rode along, for the save messages: embedding is automatic
       and was therefore INVISIBLE — with nothing ever saying the figures
       travelled, "save with images" read as a feature that did not exist
       (2026-08-21, user: "so there is no way to like 'save with
       images'"). Every save now says what it carried. */
    lastEmbCount=list.reduce(function(n,p){
      return n+(p.emb?Object.keys(p.emb).length:0);},0);
    embSaveSoon();
    return list;
  }
  var lastEmbCount=0;
  function embNote(){
    return lastEmbCount
      ?' — with '+lastEmbCount+' card'+(lastEmbCount===1?'':'s')
        +' embedded, so it opens without the notebook'
      :'';
  }
  function deckFileText(){
    return JSON.stringify({junoview:1,
      presentations:embedAssets(plainIfSingle(mergedPresentations()))},
      null,2);
  }
  /* ---- the saved file is a real HTML page with the JSON inside it ----
     A bare-JSON ".junoview" was a dead end on disk: double-clicking it
     asked Windows to pick an app, and nothing said what it was
     (2026-08-18, user: "when opening it doesn't really recognise that
     this should be opened in a browser"). Saved as name.junoview.html the
     OS opens a browser, and the page identifies itself — the Junoview
     logo, the name, what it holds, and how to open it for editing. The
     data rides in a <script type="application/json"> block; both loaders
     (here and the Python sidecar reader) unwrap it, and plain old .junoview
     files still parse, so nothing already saved is stranded. `<` is
     escaped inside the JSON so no content can close the script block. */
  function junoviewFileHtml(){
    var json=deckFileText().replace(/</g,'\\u003c');
    var list=plainIfSingle(mergedPresentations());
    var n=Array.isArray(list)?list.length:1;
    var slides=(Array.isArray(list)?list:[list]).reduce(function(k,p2){
      return k+((p2&&p2.slides&&p2.slides.length)||0);},0);
    var icon=(document.querySelector('link[rel="icon"]')||{}).href||'';
    var name=esc(APP.order.length===1?APP.order[0]:(pres.name||'project'));
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
      +'<meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>'+name+' — Junoview presentation</title>'
      +(icon?'<link rel="icon" href="'+icon+'">':'')
      +'<style>body{margin:0;min-height:100vh;display:flex;align-items:center;'
      +'justify-content:center;background:#0b141d;color:#dce6ee;'
      +'font-family:system-ui,sans-serif}main{text-align:center;padding:40px;'
      +'max-width:560px}img{width:96px;height:96px}h1{font-size:20px;'
      +'margin:18px 0 4px}p{color:#8ba0b2;font-size:14px;line-height:1.6;'
      +'margin:8px 0}code{background:#16273a;border-radius:4px;'
      +'padding:1px 6px;font-size:13px}</style></head><body><main>'
      +(icon?'<img src="'+icon+'" alt="Junoview">':'')
      +'<h1>'+name+'</h1>'
      +'<p>A saved <b>Junoview</b> presentation — '+n+' presentation'
      +(n===1?'':'s')+', '+slides+' slide'+(slides===1?'':'s')+'.</p>'
      +'<p>To edit it, open Junoview and pick <code>+ New… → Open a '
      +'.junoview file…</code> (or <code>File → Open</code> inside any '
      +'presentation), or keep it next to its notebook and it loads '
      +'itself.</p>'
      +'</main><script type="application/json" id="junoview-data">\n'
      +json+'\n</'+'script></body></html>\n';
  }
  /* both file forms — the HTML wrapper and a bare-JSON .junoview from
     before it existed — hand back the same object */
  function parseDeckText(txt){
    var t=String(txt||'').trim();
    if(t.charAt(0)==='<'){
      var m2=t.match(
        /<script type="application\/json" id="junoview-data">([\s\S]*?)<\/script>/);
      if(!m2) throw new Error('no Junoview data in that HTML file');
      t=m2[1];
    }
    return JSON.parse(t);
  }
  /* write to the remembered file. `silent` = an autosave: never pops a
     permission prompt (there is no user gesture behind it) */
  function saveToFile(silent){
    flushTextEdits();
    /* T235: an autosave with no file can still make one, if there is a
       default folder to make it in. Without one it stands down, as it
       always has -- an autosave must never open a file dialog. */
    if(!fileHandle&&!deckDir&&silent) return Promise.resolve(false);
    var savedHist=!silent?histCapture():null;
    var savedName=pres.name||'untitled',savedSig=deckSaveSig(pres);
    var fileText;
    try{fileText=junoviewFileHtml();}
    catch(e){
      if(!silent) toast('Save failed: '+((e&&e.message)||e));
      return Promise.resolve(false);
    }
    var op=(fileHandle?Promise.resolve(fileHandle)
      :(deckDir?folderFile(silent)
        :(silent?Promise.resolve(null):pickSaveFile())))
      .then(function(h){
        if(!h) return false;
        return (silent?permOK(h):permAsk(h)).then(function(ok){
          if(!ok){
            if(!silent) toast('Junoview needs permission to write '
              +(fileName||'that file'));
            return false;
          }
          return h.createWritable().then(function(w){
            return Promise.resolve(w.write(fileText))
              .then(function(){return w.close();});
          }).then(function(){
            /* the browser copy STAYS. Deleting it made the file the ONLY
               copy, and nothing ever read the file back at startup — save
               to file, close the browser, and the presentation was gone
               from the app (2026-08-20, user: "I made a presentation for
               tomorrow and now am locked out of it"). */
            saveStamp=new Date();saveKind=silent?'auto':'manual';
            if(stillSaved(savedName,savedSig)) source='saved';
            else {source='draft';scheduleDraftWrite();}
            status();renderTargetBtn();renderPresRow();
            if(!silent) toast('Saved to '+(fileName||'your file')+embNote());
            return true;
          });
        });
      }).catch(function(e){
        if(!silent&&(!e||e.name!=='AbortError'))
          toast('Save failed: '+((e&&e.message)||e));
        return false;
      });
    if(savedHist) snapTake('saved',savedHist,op);
    return op;
  }
  /* WHERE it goes, never WHICH file. The filename is the widest thing
     that could ever land in this bar, it changes under you when you pick
     a different file, and it answers a question nobody asked — the one
     you ask of a Save button is "is this going somewhere I will find it
     again?" (2026-08-20, user: "I don't want you to have 'save to
     <filename>' ... I want you to just say if it's save to local or
     browser"). The filename is in the tooltip. */
  function targetLabel(){
    if(saveTarget==='project') return 'This project';
    if(saveTarget==='file')
      return deckDirName?('Your '+deckDirName+' folder')
        :'On this computer';
    return 'In this browser';
  }
  function renderTargetBtn(){
    var b=$('#dc-target'); if(!b) return;
    /* the label is just the DESTINATION — "Saved to:" lives in the
       tooltip. The long form was the widest thing in the ribbon's File
       group and wrapped the whole toolbar to a third row (2026-08-05). */
    /* the chevron of a split button: "Save" is its label. The destination
       is named in the menu this opens, and in the tooltip — in the ribbon
       it was a second, wordier control that looked like a rival Save. */
    b.innerHTML='&#9662;';
    b.title='Saving to '+targetLabel()+' — click to change where';
    var th=$('#tg-head');
    if(th) th.textContent='save to — now: '+targetLabel();
    b.classList.toggle('tg-file',saveTarget==='file');
    var pj=$('#tg-project'); if(pj) pj.hidden=(APP.mode!=='app');
    var pk=$('#tg-pick'); if(pk) pk.hidden=(saveTarget!=='file');
    /* T235: the folder row names the folder once there is one, and a
       second row appears to undo it */
    var fd=$('#tg-folder');
    if(fd){
      fd.hidden=!canPickDir;
      fd.textContent=deckDirName
        ?('Folder: '+deckDirName+' \u2014 change\u2026')
        :'A folder on this computer\u2026';
      fd.title=deckDirName
        ?('Every presentation saves itself into '+deckDirName
          +' as a .junoview.html file. Nothing to answer, and no '
          +'browser storage to run out of.')
        :'Pick one folder and Junoview keeps its own file in there '
          +'from now on \u2014 for this presentation and every one '
          +'after it. No dialog each time, and no browser storage to '
          +'run out of.';
      fd.setAttribute('aria-pressed',
        (saveTarget==='file'&&!!deckDirName).toString());
    }
    var ff=$('#tg-folder-forget');
    if(ff) ff.hidden=!deckDirName;
    var tf=$('#tg-file');
    if(tf) tf.textContent=canPickFile
      ?'A file on your computer…'
      :'A file (this browser can’t — use Download a copy)';
    if(tf) tf.disabled=!canPickFile;
    [['#tg-project','project'],['#tg-browser','browser'],
     ['#tg-file','file']].forEach(function(p){
      var el=$(p[0]);
      if(el) el.setAttribute('aria-pressed',(saveTarget===p[1]).toString());
    });
    b.setAttribute('data-tip',
      saveTarget==='file'
        ?'Saving writes '+(fileName||'a .junoview file')
          +(deckDirName?(' in your '+deckDirName+' folder'):'')
          +' — Junoview remembers it between visits'
        :saveTarget==='project'
          ?'Saving writes junoview_project.json next to your notebooks'
          :'Kept in this browser. Switch to a file to save it on your '
            +'computer as .junoview');
  }
  function setTarget(t){
    saveTarget=t;lsSet(TGKEY,t);
    renderTargetBtn();renderSaveBtn();status();
  }
  var AUTOKEY='semopts:'+SCOPE+':autosave';
  /* HOW OFTEN, not just whether. The interval was a hardcoded 1200ms
     debounce: invisible, unsettable, and — being a debounce — restarted
     by every keystroke, so it only ever fired once you had stopped
     working. It is a countdown you can read and choose now (2026-08-29,
     T70, user: "please make there be an auto-save timer"). "Off" is the
     same fact as the old on/off flag, so the two doors write one setting
     and cannot disagree. */
  var AUTOSECKEY='semopts:'+SCOPE+':autosecs';
  var AUTO_STEPS=[2,5,15,30,60,300];
  var autosaveOn=lsGet(AUTOKEY)!=='0';
  var autoSecs=(function(){
    var n=parseInt(lsGet(AUTOSECKEY),10);
    return AUTO_STEPS.indexOf(n)>=0?n:2;
  })();
  var autoTimer=null,autoDue=0,autoTick=null;
  function autoSecsLabel(s){
    return s<60?(s+' seconds'):((s/60)+' minute'+(s>60?'s':''));
  }
  /* THE BROWSER IS A DESTINATION TOO. Its deck was already written to
     localStorage 300ms after every keystroke by scheduleDraftWrite, but
     nothing stamped that write — so the readout said "unsaved" about a
     deck that was on disk, and the autosave control, which returned
     early for every target but project and file, did nothing whatsoever
     on the target most people are on (T70). */
  function autoSaveBrowser(){
    flushTextEdits();
    flushDraftWrite();
    if(lsIsFull()){status();return;}
    saveStamp=new Date();saveKind='auto';source='saved';
    status();
  }
  function cancelAutosave(){
    clearTimeout(autoTimer);autoTimer=null;autoDue=0;
    clearInterval(autoTick);autoTick=null;
  }
  function autoSaveNow(){
    autoTimer=null;autoDue=0;
    clearInterval(autoTick);autoTick=null;
    if(saveTarget==='file') saveToFile(true);
    else if(saveTarget==='project'&&APP.mode==='app') saveToProject(true);
    else autoSaveBrowser();
    renderAutoTick();
  }
  function scheduleAutosave(){
    /* a remembered file autosaves too — silently, and only while the
       browser still grants write permission (after a reload it waits for
       the first Save click, which carries the user gesture it needs) */
    if(!autosaveOn||!autoSecs
      ||(saveTarget==='project'&&APP.mode!=='app')){
      cancelAutosave();renderAutoTick();return;
    }
    /* A TIMER, NOT A DEBOUNCE: a countdown already running is left to
       finish, or "every 5 minutes" would never arrive while you typed —
       which is the only stretch of time it is there for. */
    if(!autoTimer){
      autoDue=Date.now()+autoSecs*1000;
      autoTimer=setTimeout(autoSaveNow,autoSecs*1000);
      clearInterval(autoTick);
      autoTick=setInterval(renderAutoTick,1000);
      renderAutoTick();
    }
    /* ...AND PUT THE FIGURES BACK. The 1.2s autosave is deliberately
       refs-only, because embedding rewrites megabytes to a synced disk on
       every keystroke. But it is also the LAST writer: you would click
       Save, get "with 37 cards embedded, so it opens without the
       notebook", nudge one text box, and 1.2 seconds later the project
       file held refs only again — self-contained until you touched it
       (2026-08-22). So a second, much lazier timer consolidates once you
       have actually stopped typing. The window in which the file is
       refs-only is now ~20s of idle rather than forever. */
    clearTimeout(embedTimer);
    embedTimer=setTimeout(function(){
      if(saveTarget==='project'&&APP.mode==='app'&&autosaveOn)
        saveToProject(true,true);
    },20000);
  }
  var embedTimer=null;
  function renderAutosaveItem(){
    /* Two doors, one state: the File menu (where it has always been) and
       the top bar, where you can READ it without opening a menu. A save
       setting you have to go looking for to check is a save setting you
       do not trust (2026-08-20, user asked for "autosave frequency" in
       the thin bar). */
    var on=autosaveOn&&!!autoSecs;
    var mi=$('#mi-autosave');
    if(mi){
      mi.hidden=false;
      mi.textContent='Autosave: '
        +(on?('every '+autoSecsLabel(autoSecs)):'off');
    }
    var qa=$('#qat-auto');
    if(qa){
      /* every target autosaves now — the project, a remembered file and
         the browser — so this is never a control with nothing to say */
      qa.hidden=false;
      /* the reload icon plus a two-width label: fitQat's compaction rung
         swaps "Autosave" for "Auto" — shortened, never hidden. The
         countdown is its own span so the tick can rewrite four
         characters a second without re-measuring the bar. */
      qa.innerHTML=bic('reload')
        +' <span class="qat-long">Autosave</span>'
        +'<span class="qat-short">Auto</span> '
        +(on?(autoSecs<60?(autoSecs+'s'):((autoSecs/60)+'m')):'off')
        +'<span class="qat-tick" id="qat-tick"></span>';
      qa.setAttribute('aria-pressed',on?'true':'false');
      qa.title=on
        ?('Saving to '+whereSaved()+' every '+autoSecsLabel(autoSecs)
          +' while you work. Click to change how often, or turn it off.')
        :'Autosave is off — your work is only written when you press '
          +'Save. Click to choose how often it should save itself.';
      renderAutoTick();
      /* the label just changed width — re-judge the thin bar */
      requestAnimationFrame(fitQat);
    }
  }
  /* the countdown, and ONLY the countdown: no innerHTML, no fitQat. A
     once-a-second re-measure of a fourteen-control bar is how a visible
     timer turns into a stutter. */
  function renderAutoTick(){
    var t=$('#qat-tick');
    if(!t) return;
    var left=autoDue?Math.max(0,Math.ceil((autoDue-Date.now())/1000)):0;
    var txt=left?(' · '+left+'s'):'';
    if(t.textContent!==txt) t.textContent=txt;
  }
  /* ONE writer for both doors. secs===0 is "off" and leaves the chosen
     interval remembered, so turning it back on restores it. */
  function setAutosave(secs){
    autosaveOn=!!secs;
    if(secs) autoSecs=secs;
    lsSet(AUTOKEY,autosaveOn?'1':'0');
    lsSet(AUTOSECKEY,String(autoSecs));
    cancelAutosave();
    renderAutosaveItem();renderSaveBtn();status();
    if(autosaveOn){
      scheduleAutosave();
      toast('Autosaving to '+whereSaved()+' every '
        +autoSecsLabel(autoSecs));
    } else toast('Autosave off — press Save to write your changes');
  }
  /* the picker. The button has carried aria-haspopup since it was added
     and had never had a menu behind it (T70). Floated like every other
     menu in this bar, so the qat's scroll floor cannot clip it. */
  (function(){
    var btn=$('#qat-auto'),menu=$('#auto-menu');
    if(!btn||!menu) return;
    function close(){overlayHide(menu);}
    function build(){
      menu.innerHTML='';
      var h=document.createElement('div');
      h.className='dc-mhead';h.textContent='autosave every';
      menu.appendChild(h);
      AUTO_STEPS.forEach(function(s){
        var o=document.createElement('button');
        o.className='dc-mi';o.type='button';
        o.textContent='Every '+autoSecsLabel(s);
        if(autosaveOn&&autoSecs===s) o.setAttribute('aria-pressed','true');
        o.addEventListener('click',function(e){
          e.stopPropagation();close();setAutosave(s);});
        menu.appendChild(o);
      });
      var sep=document.createElement('div');
      sep.className='dc-msep';menu.appendChild(sep);
      var off=document.createElement('button');
      off.className='dc-mi';off.type='button';
      off.textContent='Off — only when I press Save';
      if(!autosaveOn) off.setAttribute('aria-pressed','true');
      off.addEventListener('click',function(e){
        e.stopPropagation();close();setAutosave(0);});
      menu.appendChild(off);
    }
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(menu.hidden){
        build();overlayShow(btn,menu);floatMenu(btn,menu);
      } else overlayHide(menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&wrap&&!wrap.contains(e.target)) close();});
  })();
  var miAuto=$('#mi-autosave');
  if(miAuto) miAuto.addEventListener('click',function(){
    closeMenu();
    setAutosave(autosaveOn?0:autoSecs);
  });

  /* always-visible Save button; the File menu keeps the rest */
  var saveBtn=$('#dc-save');
  function renderSaveBtn(){
    if(!saveBtn) return;
    if(saveTarget==='file'){
      saveBtn.setAttribute('data-tip','Save now to '
        +(fileName||'the .junoview file you pick')
        +' — Junoview remembers it between visits');
    } else if(saveTarget==='project'&&APP.mode==='app'){
      saveBtn.setAttribute('data-tip','Save now to '
        +'junoview_project.json'
        +(autosaveOn
          ?' — autosave is ON: every change saves itself about a '
            +'second later'
          :' — autosave is OFF, only this button saves'));
    } else {
      saveBtn.setAttribute('data-tip','Kept in this browser '
        +'automatically as you edit — Save confirms it. The \u25be beside '
        +'Save keeps it as a file on your computer instead');
    }
    saveBtn.removeAttribute('title');
  }
  if(saveBtn) saveBtn.addEventListener('click',function(){
    if(!requireName()) return;
    if(saveTarget==='project'&&APP.mode==='app'){saveToProject(false);return;}
    if(saveTarget==='file'){saveToFile(false);return;}
    /* the typed word first: a paragraph still in the DOM is not in the
       deck, and Save must not report a state it did not save */
    flushTextEdits();
    var savedHist=histCapture(); /* also mints ids before serialisation */
    var ok=lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    /* The pointer is convenient, not the save. Its quota result must not
       reverse or clear the outcome of writing the actual deck. */
    if(ok){
      try{localStorage.setItem(PFX+'last',pres.name||'untitled');}
      catch(e){}
    }
    if(!ok){
      /* DO NOT stamp a save that did not happen. This branch used to set
         saveStamp/saveKind and toast success unconditionally, so a write
         that threw on quota still rendered "saved to browser · 14:32"
         (2026-08-22). */
      status();
      toast('NOT saved \u2014 this browser is full. The \u25be beside '
        +'Save \u203a "A folder on this computer" keeps every '
        +'presentation as a file instead, with no limit; File \u203a '
        +'Download a copy saves this one right now.',11000);
      return;
    }
    /* EVERY EXPLICIT SAVE is a point you might want back -- the
       same rule the notebook's snapshots follow (T32) */
    if(savedHist) snapTake('saved',savedHist);
    saveStamp=new Date();saveKind='manual';
    status();
    toast('Kept in this browser — it also autosaves as you edit. '
      +'The \u25be beside Save keeps it as a file on your computer.');
  });
  /* ---- the "Saved to" picker ---- */
  (function(){
    var btn=$('#dc-target'),menu=$('#target-menu');
    if(!btn||!menu) return;
    function close(){overlayHide(menu);}
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(menu.hidden){
        /* floated so the qat's scroll floor can never clip it */
        overlayShow(btn,menu);floatMenu(btn,menu);
      } else overlayHide(menu);
    });
    var pj=$('#tg-project');
    if(pj) pj.addEventListener('click',function(){
      close();setTarget('project');
      toast('Saving now writes junoview_project.json');
    });
    var br=$('#tg-browser');
    if(br) br.addEventListener('click',function(){
      close();setTarget('browser');
      toast('Kept in this browser from now on');
    });
    function chooseFile(){
      close();
      if(!canPickFile){
        toast('This browser can’t save straight to a file — '
          +'use File › Download a copy');
        return;
      }
      if(!requireName()) return;
      pickSaveFile().then(function(h){
        if(!h) return;
        setTarget('file');
        return saveToFile(false);
      }).catch(function(e){
        if(!e||e.name!=='AbortError')
          toast('Could not choose a file: '+((e&&e.message)||e));
      });
    }
    var tf=$('#tg-file');
    if(tf) tf.addEventListener('click',function(){
      if(saveTarget==='file'&&fileHandle){
        close();setTarget('file');
        toast('Saving writes '+fileName);
        return;
      }
      chooseFile();
    });
    var pk=$('#tg-pick');
    if(pk) pk.addEventListener('click',chooseFile);
    /* T235: pick the folder, and everything after it goes there */
    var fd=$('#tg-folder');
    if(fd) fd.addEventListener('click',function(){
      close();
      if(!canPickDir){
        toast('This browser cannot pick a folder \u2014 use File \u203a '
          +'Download a copy');
        return;
      }
      if(!requireName()) return;
      pickSaveFolder().then(function(d){
        if(!d) return;
        /* a new folder means a new file: forget the old handle, or
           the next save would write the file you just moved away from */
        fileHandle=null;fileName='';
        idbDel(HKEY).catch(function(){});
        setTarget('file');
        return saveToFile(false).then(function(){
          toast('Every presentation now saves itself into '
            +deckDirName+' \u2014 this one is '+(fileName||'there')
            +' already.',6000);
        });
      }).catch(function(e){
        if(!e||e.name!=='AbortError')
          toast('Could not use that folder: '+((e&&e.message)||e));
      });
    });
    var ff=$('#tg-folder-forget');
    if(ff) ff.addEventListener('click',function(){
      close();
      deckDir=null;deckDirName='';
      lsDel(DNKEY);idbDel(DKEY).catch(function(){});
      renderTargetBtn();renderSaveBtn();
      toast('Junoview will ask which file from now on. The file it '
        +'already made is still there.',6000);
    });
    /* the folder is remembered between visits, like the file */
    idbGet(DKEY).then(function(d){
      if(!d) return;
      return permReadOK(d).then(function(ok){
        if(!ok) return;
        deckDir=d;deckDirName=d.name||deckDirName;
        lsSet(DNKEY,deckDirName);
        /* THE POINT OF IT: a remembered folder means local IS the
           default, including for a presentation made after it was
           chosen. Only 'browser' is overridden -- a project build
           keeps writing junoview_project.json. */
        if(saveTarget==='browser') setTarget('file');
        renderTargetBtn();renderSaveBtn();
      });
    }).catch(function(){});
    /* a file chosen on an earlier visit is still remembered */
    idbGet(HKEY).then(function(h){
      if(!h) return;
      fileHandle=h;fileName=h.name||'';
      /* remembered ≠ active. Only a still-granted write permission keeps
         the file as the silent autosave target across sessions; without
         it, saves go to the browser and the file stays one click away
         (2026-08-18). */
      return permOK(h).then(function(ok){
        if(!ok&&saveTarget==='file'){
          saveTarget='browser';
          lsSet(TGKEY,'browser');
          status();
        }
        renderTargetBtn();renderSaveBtn();
      }).then(function(){
        /* the file is a SOURCE too, not just a target: if it can still be
           read, restore any presentation the browser no longer lists
           (2026-08-20, user locked out of a file-saved presentation) */
        return permReadOK(h).then(function(ok){
          if(!ok) return;
          return h.getFile().then(function(f){return f.text();})
            .then(function(txt){importDeckText(txt,true);});
        });
      });
    }).catch(function(){});
    renderTargetBtn();
  })();

  /* direct save-into-.ipynb is parked for now (kept for later) */
  var ENABLE_SAVE_TO_IPYNB=false;
  var writeBtn=$('#mi-save');
  if(APP.mode==='app'){
    writeBtn.textContent='Save to project';
    writeBtn.addEventListener('click',function(){
      closeMenu();
      if(!requireName()) return;
      saveToProject(false);
    });
  } else if(ENABLE_SAVE_TO_IPYNB
      &&APP.order.length===1&&window.showOpenFilePicker){
    writeBtn.addEventListener('click',function(){
      closeMenu();
      if(!requireName()) return;
      var savedHist=histCapture();
      var savedName=pres.name||'untitled',savedSig=deckSaveSig(pres);
      var savedMerged=mergedPresentations();
      var op=(async function(){
        try{
          var picks=await window.showOpenFilePicker({types:[{
            description:'Jupyter notebook',
            accept:{'application/json':['.ipynb']}}]});
          var h=picks[0];
          var f=await h.getFile();
          var nb=JSON.parse(await f.text());
          nb.metadata=nb.metadata||{};
          nb.metadata.semantic=nb.metadata.semantic||{};
          nb.metadata.semantic.presentations=
            plainIfSingle(savedMerged);
          delete nb.metadata.semantic.deck;
          var w=await h.createWritable();
          await w.write(JSON.stringify(nb,null,1));
          await w.close();
          var stem0=APP.order[0];
          nbPres=savedMerged.map(function(p){
            var c=normPres(p,null);c.origin=stem0;return c;});
          if(stillSaved(savedName,savedSig)){
            cancelDraftWrite();
            lsDel(PFX+savedName);
            source='saved';
          } else {
            source='draft';scheduleDraftWrite();
          }
          saveStamp=new Date();saveKind='manual';
          status();renderPresRow();
          toast('Saved "'+savedName+'" into '+f.name);
          return true;
        }catch(e){
          if(!e||e.name!=='AbortError')
            toast('Save failed: '+(e&&e.message?e.message:e));
          return false;
        }
      })();
      if(savedHist) snapTake('saved',savedHist,op);
    });
  } else {
    writeBtn.hidden=true;
  }
  menuAction('#mi-dl',function(){
    var blob=new Blob([junoviewFileHtml()],{type:'text/html'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(APP.order.length===1?APP.order[0]:'project')
      +'.junoview.html';
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
    toast((APP.order.length===1
      ?'Downloaded. Keep it next to the .ipynb and it loads itself.'
      :'Downloaded. Load it with --deck, or save to the project instead.')
      +embNote());
  });
  menuAction('#mi-load',openDeckFile);
  window.SemDeckOpenFile=openDeckFile;   /* the rail's "+ New" row */
  /* ---- Export PDF / print: render every slide at a fixed size (so text,
     which is sized from the layer height, comes out right) into off-screen
     pages, then hand off to the browser's Print -> Save as PDF ---- */
  /* build the fixed-size print/export pages off-screen. Shared by the
     PDF path (window.print) and the standalone-HTML export. */
  function buildPrintRoot(){
    var old=document.getElementById('print-root');
    if(old) old.remove();
    var savedMode=mode,savedReveal=revealCount,savedCur=cur;
    mode='view';revealCount=99999;              /* all builds fully revealed */
    var root=document.createElement('div');root.id='print-root';
    /* attach the container FIRST (off-screen but laid out) so each slide has a
       real 720px height when its text is sized from the layer — otherwise a
       detached layer measures 0 and text bakes in ~17% too small */
    document.body.appendChild(root);
    /* a custom page (4:3 / A-series poster) exports at ITS size, not 16:9 */
    var pg=pageOf();
    /* Crop marks: some print shops ask for them, and they need somewhere
       to sit, so the SHEET grows by the bleed while the page inside keeps
       its exact size — an A0 poster stays 841x1189mm either way. */
    var bleed=(pres&&pres.cropMarks)?BLEED_MM:0;
    if(pg.id!=='16x9'||bleed){
      var sheetW=pg.mm[0]+2*bleed,sheetH=pg.mm[1]+2*bleed;
      var pw=Math.round(pg.mm[0]/25.4*96),ph=Math.round(pg.mm[1]/25.4*96);
      var bpx=Math.round(bleed/25.4*96);
      var pst=document.createElement('style');
      pst.textContent='#print-root{width:'+(pw+2*bpx)+'px;}'
        +'.print-page{width:'+pw+'px;height:'+ph+'px;'
        +(bleed?'margin:'+bpx+'px;':'')+'}'
        +'@media print{@page{size:'+sheetW+'mm '+sheetH+'mm;'
        +'margin:0;}}';
      root.appendChild(pst);
    }
    /* the page's own background rides into the export — a white poster
       prints white, not the app's navy (2026-08-04) */
    var bg=tokVal((pres&&pres.pageBg)||'#0b141d');
    root.classList.toggle('page-light',pageIsLight(bg));
    var bst=document.createElement('style');
    /* PRINT THE INK. Chrome and Edge default the print dialog's
       "Background graphics" box to OFF, and everything that carries this
       deck's colour is a CSS background: the page, the slide, every shape
       fill, every gradient, every text panel. Without this declaration
       File > Export PDF on the default dark deck produced white pages
       with white text on them — only <img> figures survived, because a
       picture is content rather than decoration. The A0 poster path
       escaped by luck alone (newPoster seeds a white page).
       Both spellings: the unprefixed property is the standard, the
       -webkit- one is what Chrome and Edge actually still honour
       (2026-08-22). */
    bst.textContent='.print-page,.print-page .slide{background:'+bg
      +'!important;}@media print{html,body{background:'+bg+'!important;}}'
      +'.print-page,.print-page *{-webkit-print-color-adjust:exact!important;'
      +'print-color-adjust:exact!important;}'
      +'@media print{html,body{-webkit-print-color-adjust:exact!important;'
      +'print-color-adjust:exact!important;}}';
    root.appendChild(bst);
    /* AN EXPORTED PAGE IS EVERY MOMENT AT ONCE (T162). mode='view' plus
       revealCount=99999 above means "fully built" -- which to a chart
       revealed one series at a time reads as the LAST stop, so an item
       tied to an earlier series would be missing from the PDF and the
       standalone HTML altogether. A flip book answers this by exploding
       into one page per frame; a chart exports as one plot and cannot,
       so every series tie fails open here instead (seriesShows).
       Cleared beside flipForce below, for the same reason and the same
       lifetime. */
    printAll=1;
    outputSlides().forEach(function(ent,i){
      var s=ent.s;
      cur=ent.i;
      /* the page renders for ITS frame, and the bindings follow */
      flipForce=ent.f;
      var page=document.createElement('div');page.className='print-page';
      var slideEl=document.createElement('div');
      if(s&&s.layout==='title'){
        slideEl.className='slide slide-titlefree';
        slideEl.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
      } else slideEl.className='slide slide-blank';
      if(s&&s.bg)
        slideEl.style.setProperty('background',tokVal(s.bg),'important');
      if(s&&s.border) slideEl.style.boxShadow='inset 0 0 0 '
        +((s.border.w||4)/SW_REF_H*Math.round(pg.mm[1]/25.4*96)).toFixed(2)
        +'px '+(tokVal(s.border.c)||'#39a9c0');
      page.appendChild(slideEl);
      root.appendChild(page);            /* in the DOM before annots render */
      if(s) attachAnnots(slideEl,s);     /* view-style; fontPx reads 720px */
      paintFurniture(slideEl,i);
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';pn.textContent=(i+1);
        slideEl.appendChild(pn);
      }
      /* trim marks at the four corners, drawn OUTSIDE the page in the
         bleed so they never touch the artwork */
      if(bleed){
        page.classList.add('has-crop');
        ['tl','tr','bl','br'].forEach(function(c){
          var cm=document.createElement('span');
          cm.className='cropmark cm-'+c;
          page.appendChild(cm);
        });
      }
    });
    mode=savedMode;revealCount=savedReveal;cur=savedCur;
    /* put the editor back on its own frame, or every flip book on screen
       would be left showing whatever the last exported page wanted */
    flipForce=null;
    printAll=0;
    if(typeset) typeset(root);
    return root;
  }
  /* wait for MathJax to actually FINISH on the built pages before using
     them — the print dialog tolerates late typesetting (the live DOM
     keeps working underneath it) but a serialised export is a hard
     cutoff: whatever maths was unfinished ships as raw TeX forever
     (2026-08-05 review) */
  /* SWAP IN THE ORIGINALS before an export takes the page. Every path
     that turns a print root into a file goes through afterTypeset, so
     this is the one place all of them share — the PDF, the standalone
     HTML and anything added later get it without asking (T21).

     The canvas keeps the display copy: a 6000px PNG drawn at 30% of a
     slide costs real time on every repaint for detail no screen can
     show. The export is the only consumer that wants the full bytes,
     and it is already asynchronous for MathJax, so waiting on
     IndexedDB costs it nothing it was not already paying. */
  function useOriginals(root){
    var jobs=[];
    function swap(o){
      if(!o||!o.okey||!o.src) return;
      jobs.push(originalOf(o).then(function(full){
        if(!full||full===o.src) return;
        $$('.an-imgel,img',root).forEach(function(im){
          if(im.getAttribute('src')===o.src) im.src=full;});
      }));
    }
    (pres.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(!a) return;
        if(a.k==='image'){swap(a);return;}
        /* A FLIP BOOK'S FRAMES ARE PICTURES TOO. They are the fourth
           door a picture comes in by, and the only one that was not
           asked here — so a flip book printed its display copies while
           every other picture on the page printed at full resolution
           (2026-08-26 audit, T58). */
        if(a.k==='flip'&&Array.isArray(a.frames)) a.frames.forEach(swap);
      });
    });
    if(!jobs.length) return Promise.resolve();
    return Promise.all(jobs).catch(function(){});
  }
  function afterTypeset(root,fn){
    var go=function(){
      try{
        if(window.MathJax&&MathJax.typesetPromise)
          return MathJax.typesetPromise([root])
            .catch(function(){}).then(fn);
      }catch(e){}
      setTimeout(fn,200);
    };
    try{return useOriginals(root).then(go);}catch(e){}
    go();
    return undefined;
  }
  function printDeck(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    var root=buildPrintRoot();
    document.body.classList.add('printing');
    var done=false;
    function cleanup(){
      if(done) return;done=true;
      document.body.classList.remove('printing');
      /* remove OUR root by reference — an id lookup could tear down a
         newer root built by a crossing export/print (2026-08-05 review) */
      if(root.parentNode) root.remove();
      window.removeEventListener('afterprint',cleanup);
    }
    window.addEventListener('afterprint',cleanup);
    /* THROUGH afterTypeset, like every other export. This went straight
       to window.print() after a 120ms guess, so useOriginals never ran
       for the PDF — the one output that is printed on paper got the
       display copies, which is the whole of T21 undone. The comment
       above useOriginals claimed "every path that turns a print root
       into a file goes through afterTypeset"; this was the path that
       did not (2026-08-26 audit, T58). afterTypeset also waits for
       MathJax, which is what the 120ms was standing in for. */
    afterTypeset(root,function(){
      try{window.print();}catch(e){}
      setTimeout(cleanup,800);
    });
    return root;   /* returned for headless testing */
  }
  window.SemDeckPrint=printDeck;   /* test hook */
  /* the pages an export will actually write, flip books already exploded.
     A hook rather than a guess: "one flip book of six figures becomes six
     slides" is the claim the whole feature rests on, and it is only
     checkable from outside (2026-08-22). */
  window.SemDeckRefreshImages=refreshImagesReport;   /* test hook */
  window.SemDeckLinkedImages=linkedImages;          /* test hook */
  window.SemDeckPages=outputSlides;
  window.SemDeckPrintRoot=buildPrintRoot;
  menuAction('#mi-refresh-figs',function(){resyncAllFigures();});
  menuAction('#mi-hist',openHistory);
  /* T225: the checkpoint row, through the same helper every other File
     row uses -- so it closes the menu the way its neighbours do */
  menuAction('#mi-check',function(){histCheckpoint(null);});
  (function(){
    var b=$('#dsg-design-btn');
    /* a row of the Text styles window since T178: the window goes as
       the screen opens, the way the other rows there behave */
    if(b) b.addEventListener('click',function(){
      if(typeof overlayClose==='function') overlayClose();
      openDesign();});
  })();
  menuAction('#mi-review',openReview);
  menuAction('#mi-pdf',function(){printDeck();});
  /* ---- standalone HTML export (2026-08-04): ONE self-contained .html
     anyone can open without Junoview. The page styles are already inline
     in this document's <head>, and every notebook figure is a data: URI,
     so the file travels whole. It reads as stacked pages, arrow keys
     step through them, and Ctrl+P prints at true page size (the same
     @page rules ride along). ---- */
  function exportDeckHtml(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    var root=buildPrintRoot();
    afterTypeset(root,function(){
      var css='';
      $$('style',document.head).forEach(function(st){
        css+=st.textContent+'\n';});
      var nav='<scr'+'ipt>document.addEventListener("keydown",'
        +'function(e){'
        +'var p=[].slice.call(document.querySelectorAll(".print-page"));'
        +'if(!p.length)return;var y=window.scrollY,i=0;'
        +'for(var j=0;j<p.length;j++){if(p[j].offsetTop<=y+10)i=j;}'
        +'if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){'
        +'e.preventDefault();if(p[i+1])p[i+1].scrollIntoView();}'
        +'if(e.key==="ArrowLeft"||e.key==="PageUp"){'
        +'e.preventDefault();if(p[i-1])p[i-1].scrollIntoView();}'
        +'});</scr'+'ipt>';
      /* lang, because a screen reader has to pick a voice and this
         file is the artefact a colleague actually receives */
      var doc='<!doctype html><html lang="en"><head><meta charset="utf-8">'
        +'<meta name="viewport" content="width=device-width">'
        +'<title>'+esc(pres.name||'presentation')+'</title>'
        +'<style>'+css+'</style>'
        +'<style>body{margin:0;background:#20262c;}'
        +'#print-root{position:static!important;left:auto!important;'
        +'width:auto!important;}'
        /* NO max-width: the pages are fixed-px boxes and clamping the
           width alone broke their aspect (2026-08-05 review). A huge
           poster page simply scrolls — the browser's own zoom fits it. */
        +'.print-page{margin:18px auto;box-shadow:0 8px 40px #0008;}'
        +'@media print{body{background:none;}'
        +'.print-page{margin:0;box-shadow:none;}}'
        +'</style></head><body>'
        +nav+root.outerHTML+'</body></html>';
      var blob=new Blob([doc],{type:'text/html'});
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=(pres.name||'presentation')+'.html';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
      if(root.parentNode) root.remove();   /* by reference, never by id */
      toast('Standalone HTML saved — opens anywhere; Ctrl+P there '
        +'prints at page size');
    });
  }
  menuAction('#mi-html',function(){exportDeckHtml();});
  /* ---- PowerPoint (.pptx) export: native shapes, not pictures of slides.
     Text becomes a real PowerPoint text box you can retype, figures and
     images become pictures, boxes and arrows become shapes — so a poster
     lands in PowerPoint editable rather than as one flat image.

     What CANNOT come across: a placed notebook cell showing code, a table
     or an xarray repr is arbitrary HTML with no PowerPoint equivalent, and
     rasterising it in the browser would need a library we deliberately do
     not ship. Those frames are counted and reported rather than silently
     dropped — the toast says how many, and PDF export carries them
     perfectly. Crops are dropped for the same reason (a CSS clip-path is
     not a PowerPoint crop), so a cropped item is reported too. ---- */
  /* textContent welds block elements together ("…reanalysiswould contain"),
     so read innerText instead. It is layout-dependent, which means the node
     must genuinely be RENDERED: display:none returns textContent and
     visibility:hidden returns "" outright (measured, 2026-08-07). Hence a
     real mount, merely parked off-screen. */
  function blockText(node){
    if(!node) return '';
    var host=document.createElement('div');
    host.style.cssText='position:absolute;left:-99999px;top:0;width:800px;';
    host.appendChild(node);
    document.body.appendChild(host);
    /* MathJax lays every glyph out as its own box, so innerText would put
       each character of an equation on its own line. Collapse each formula
       to one inline string instead.
       The characters come from the ASSISTIVE MathML, not the visible
       output: MathJax v3's CHTML draws glyphs through CSS ::before rules,
       so the container's own textContent is empty (measured, 2026-08-07). */
    $$('mjx-container',host).forEach(function(n){
      if(!n.parentNode) return;
      var mml=n.querySelector('mjx-assistive-mml');
      var t=String((mml&&mml.textContent)||n.textContent||'')
        .replace(/\s+/g,' ').trim();
      n.parentNode.replaceChild(
        document.createTextNode(t?' '+t+' ':' '),n);
    });
    var out='';
    try{out=String(host.innerText||host.textContent||'');}
    catch(e){out=String(host.textContent||'');}
    host.remove();
    return out.replace(/\n{3,}/g,'\n\n').trim();
  }
  /* ---- AN EQUATION, FLATTENED TO CHARACTERS ---------------------------
     A text box built by the Maths button went into the .pptx as the
     literal "$$ E = mc^2 $$", dollar signs and all, and the export's own
     "Equations came across as plain text" warning stayed silent, because
     it was only ever raised for maths inside a notebook CELL (2026-08-26
     audit, T53).

     Flattened FROM THE SOURCE, not from the rendered MathJax that
     blockText lifts for cells. Only the slide on screen has typeset
     output — typesetting is a promise and this export is synchronous —
     so reading the DOM would give real characters on one slide and raw
     LaTeX on the next, which is worse than either answer everywhere.

     The vocabulary is the equation palette's own: what the app offered
     to write is what it undertakes to read back. Anything else keeps its
     command word, spelled without the backslash, which is still the name
     of what it is.  */
  var TEX_CHAR={
    alpha:'α',beta:'β',gamma:'γ',delta:'δ',
    epsilon:'ε',varepsilon:'ε',zeta:'ζ',eta:'η',
    theta:'θ',vartheta:'ϑ',iota:'ι',kappa:'κ',
    lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',
    rho:'ρ',sigma:'σ',tau:'τ',upsilon:'υ',
    phi:'φ',varphi:'φ',chi:'χ',psi:'ψ',
    omega:'ω',
    Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',
    Xi:'Ξ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',
    Omega:'Ω',
    times:'×',div:'÷',pm:'±',mp:'∓',cdot:'·',
    ast:'∗',circ:'∘',leq:'≤',le:'≤',geq:'≥',
    ge:'≥',neq:'≠',ne:'≠',approx:'≈',
    equiv:'≡',sim:'∼',propto:'∝',ll:'≪',
    gg:'≫','in':'∈',notin:'∉',subset:'⊂',
    cup:'∪',cap:'∩',forall:'∀',exists:'∃',
    nabla:'∇',partial:'∂',infty:'∞',
    sum:'∑',prod:'∏',int:'∫',iint:'∬',
    oint:'∮',lim:'lim',
    to:'→',gets:'←',rightarrow:'→',leftarrow:'←',
    mapsto:'↦',Rightarrow:'⇒',Leftarrow:'⇐',
    Leftrightarrow:'⇔',uparrow:'↑',downarrow:'↓'
  };
  var TEX_SUP={'0':'⁰','1':'¹','2':'²','3':'³',
    '4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸',
    '9':'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',
    ')':'⁾',n:'ⁿ',i:'ⁱ'};
  var TEX_SUB={'0':'₀','1':'₁','2':'₂','3':'₃',
    '4':'₄','5':'₅','6':'₆','7':'₇','8':'₈',
    '9':'₉','+':'₊','-':'₋','=':'₌','(':'₍',
    ')':'₎',a:'ₐ',e:'ₑ',i:'ᵢ',j:'ⱼ',
    k:'ₖ',l:'ₗ',m:'ₘ',n:'ₙ',o:'ₒ',
    p:'ₚ',r:'ᵣ',s:'ₛ',t:'ₜ',u:'ᵤ',
    v:'ᵥ',x:'ₓ'};
  /* {a}{b} after a command, or the single token that stands in for a
     brace group ("x^2"). Returns [body, rest] or null. */
  function texGroup(src){
    if(src.charAt(0)!=='{'){
      if(!src) return null;
      return [src.charAt(0),src.slice(1)];
    }
    var d=0;
    for(var i=0;i<src.length;i++){
      var c=src.charAt(i);
      if(c==='{') d++;
      else if(c==='}'&&!--d) return [src.slice(1,i),src.slice(i+1)];
    }
    return null;
  }
  function texScript(body,table){
    var out='';
    for(var i=0;i<body.length;i++){
      var ch=table[body.charAt(i)];
      if(ch===undefined) return null;
      out+=ch;
    }
    return out;
  }
  function texPlain(src){
    var out='',rest=String(src||''),g;
    while(rest){
      var m=/^\\([A-Za-z]+)/.exec(rest);
      if(m){
        rest=rest.slice(m[0].length);
        var name=m[1];
        /* the wrappers whose whole job is how a thing is SET, not what
           it says: their contents are the text and they go away */
        if(/^(text|mathrm|mathbf|mathbb|mathcal|mathit|operatorname|bar|overline|hat|vec|dot|ddot|tilde|underline|left|right|displaystyle)$/
            .test(name)){
          if(name==='left'||name==='right'||name==='displaystyle') continue;
          g=texGroup(rest);
          if(g){out+=texPlain(g[0]);rest=g[1];}
          continue;
        }
        if(name==='frac'||name==='binom'){
          g=texGroup(rest);
          if(!g){out+=name;continue;}
          var num=texPlain(g[0]),g2=texGroup(g[1]);
          if(!g2){out+=num;rest=g[1];continue;}
          out+=(name==='frac')?('('+num+')/('+texPlain(g2[0])+')')
                              :('C('+num+', '+texPlain(g2[0])+')');
          rest=g2[1];
          continue;
        }
        if(name==='sqrt'){
          var root='';
          var rm=/^\[([^\]]*)\]/.exec(rest);
          if(rm){root=texPlain(rm[1]);rest=rest.slice(rm[0].length);}
          g=texGroup(rest);
          out+=root+'√('+(g?texPlain(g[0]):'')+')';
          if(g) rest=g[1];
          continue;
        }
        out+=(TEX_CHAR[name]!==undefined?TEX_CHAR[name]:name);
        /* THE SPACE AFTER A COMMAND WORD, which LaTeX reads as the
           delimiter that ends the name rather than as a space. Eaten
           only when it was doing that job and nothing else — that is,
           when a letter or digit follows ("\partial u" -> "∂u"). Eating
           it unconditionally welded the symbol to the next token
           ("\alpha + \beta" -> "α+ β", because the source's space before
           the + had already been spent). */
        if(/^ [A-Za-z0-9]/.test(rest)) rest=rest.slice(1);
        continue;
      }
      var c0=rest.charAt(0);
      if(c0==='\\'){
        /* \, \; \: \! and \\ : spacing and a line break */
        var c1=rest.charAt(1);
        out+=(c1==='!'||c1===undefined)?'':(c1==='\\'?' ':' ');
        rest=rest.slice(2);
        continue;
      }
      if(c0==='^'||c0==='_'){
        g=texGroup(rest.slice(1));
        if(!g){rest=rest.slice(1);continue;}
        var inner=texPlain(g[0]);
        var lifted=texScript(inner,c0==='^'?TEX_SUP:TEX_SUB);
        out+=(lifted!==null)?lifted:(c0+'('+inner+')');
        rest=g[1];
        continue;
      }
      if(c0==='{'||c0==='}'||c0==='&'){rest=rest.slice(1);continue;}
      out+=c0;rest=rest.slice(1);
    }
    return out;
  }
  /* WHICH DOLLARS ARE MATHS. "$5 and $10" is prose and has to leave the
     export exactly as it was typed, so an inline pair only counts when
     its body actually reads as TeX — a command, a power or a subscript.
     Display $$…$$ is never ambiguous, and neither is a box the Maths
     button built, which is what `sure` says. */
  function texish(b){return /\\[A-Za-z]|[\^_]/.test(b||'');}
  function mathsPlain(src,sure){
    var hit=false;
    var out=String(src||'').replace(
      /\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g,
      function(all,disp,inline){
        var body=(disp!==undefined)?disp:inline;
        if(disp===undefined&&!sure&&!texish(body)) return all;
        hit=true;
        return texPlain(body).replace(/\s+/g,' ').trim();
      });
    return {text:out,hit:hit};
  }
  /* An unset colour means "whatever the page CSS says", which is dark ink on
     a light poster and white on a dark one. PowerPoint has no such cascade,
     so the default is resolved HERE — baking a plain '#ffffff' would put
     white text on a white poster, the exact bug the live view already had. */
  var PPTX_DIMS={text:[34,8],image:[30,24],rect:[20,14],draw:[10,10],
    table:[40,20],flip:[40,32],cell:[30,24]};
  function pptxBox(a,centred){
    var d=centred?[80,8]:(PPTX_DIMS[a.k]||[0,0]);
    var w=a.w||d[0],h=a.h||d[1],p=anchorPos(a,w,h);
    return {x:p.x,y:p.y,w:w,h:h};
  }
  function pptxTextItem(a,centred,ink,box){
    var b=box||pptxBox(a,centred);
    return {t:'text',x:b.x,y:b.y,w:b.w,h:b.h,
      rot:a.rot,op:a.op,centred:!!centred,
      text:a.text,sizePct:a.size,color:tokVal(a.color)||ink,
      b:a.b,i:a.i,u:a.u,strike:a.strike,align:a.align||(centred?'center':''),
      bullets:!!a.list,bgc:(a.bg!==0&&a.bgc)?tokVal(a.bgc):'',
      arc:a.arc,font:fontPpt(a.font)};
  }
  /* one slide's annots -> spec items, plus a tally of what could not go */
  /* `layer` is the rendered annotation layer for THIS slide, or null. It is
     a real parameter because it used to be a bare undeclared identifier:
     reading it threw ReferenceError, so exporting any deck or poster that
     contained a single line or arrow produced no file and — because the
     throw escaped before the toast — no message either (2026-08-10). */
  /* the retained original for a display copy, or the display copy when
     there is none — ONE lookup, so no branch can forget it */
  function pptxSrc(note,src){
    return (note&&note.orig&&note.orig[src])||src;
  }
  function pptxItems(s,note,ink,layer){
    var items=[];
    /* which CLICK each annot appears on, the same grouping the badges
       and playback use \u2014 exported as real PowerPoint timing (T110) */
    var bsteps=slideBuildSteps(s).map;
    if(s.layout==='title'){
      ['t','s'].forEach(function(which){
        var p=titleProps(s,which),val=(which==='t')?s.title:s.sub;
        if(!String(val||'').trim()) return;
        var it=pptxTextItem(p,true,ink);
        /* a title carries LaTeX as readily as a text box does, and it
           went out with its dollar signs on (T53) */
        var mp=mathsPlain(val,false);
        if(mp.hit) note.maths++;
        it.text=mp.text;
        items.push(it);
      });
    }
    (s.annots||[]).forEach(function(a){
      if(!a) return;
      /* PowerPoint does not go through renderAnnots, so it asks the same
         question here rather than inheriting the answer -- and a private
         note reaching a .pptx is the exact failure T31 exists to
         prevent. */
      if(a.priv) return;
      /* an item tied to a figure other than this page's does not belong
         on this page. note.frame is set by the exploding enumerator; with
         no flip book on the slide it is null and nothing is filtered. */
      if(a.fb){
        var fbk=flipById(s,a.fb);
        var atk=(note.frame!=null)?note.frame:(fbk?(fbk.at||0):0);
        if(!flipShowsFrame(s,a,atk)) return;
      }
      /* a crop is carried unless it is one of the two the writer
         cannot express: a hand-drawn outline (custGeom, not a preset)
         and a trim that leaves nothing. Counting only what is really
         lost is the point -- the toast used to say every crop was
         dropped, which stopped being true here (T107). */
      if(a.crop&&a.crop.path) note.cropped++;
      /* Every editable box leaves in PAGE coordinates. An anchored
         object's stored x/y are distances from an edge or centre, and
         its export fallback size matters to that conversion. */
      var box=(a.k==='arrow')?null:pptxBox(a,false);
      var pushedAt=items.length;
      if(a.k==='text'){
        var ti=pptxTextItem(a,false,ink,box);
        /* `a.maths` means the Maths button built this box, so the whole
           of it is the equation and there is nothing to be careful about
           — an ordinary box has to earn the flattening (T53) */
        var tp=mathsPlain(ti.text,!!a.maths);
        if(tp.hit) note.maths++;
        ti.text=tp.text;
        items.push(ti);
      } else if(a.k==='image'){
        if(a.src) items.push({t:'image',x:box.x,y:box.y,w:box.w,h:box.h,
          rot:a.rot,op:a.op,src:pptxSrc(note,a.src),
          /* what the picture shows, for PowerPoint's own accessibility
             checker and for a screen reader opening the deck (T105) */
          alt:a.alt,dec:a.dec,
          /* a path crop has no preset to become, so it is not sent */
          crop:(a.crop&&!a.crop.path)?a.crop:null,
          cropShape:(a.crop&&!a.crop.path)?a.crop.shape:''});
        else note.skipped++;
      } else if(a.k==='rect'){
        /* `a.fill` is a BOOLEAN — "tint with my own line colour" — so the
           actual paint has to be resolved here. Passing the boolean
           through made every filled shape export solid black. */
        var lineCol=tokVal(a.color)||'#ff6b57';
        var grad=tokenGradient(a.grad,lineCol);
        var fillCol='';
        if(grad) fillCol='';
        else if(a.fill) fillCol=tokVal(a.fillc)||shapeFill(lineCol,
          0x2b/255);
        items.push({t:'rect',x:box.x,y:box.y,w:box.w,h:box.h,rot:a.rot,
          op:a.op,color:lineCol,fill:fillCol,grad:grad,
          swPct:swOf(a)/SW_REF_H*100,
          dash:LINE_PPT[lineStyle(a)],shape:a.shape});
      } else if(a.k==='draw'){
        items.push({t:'draw',x:box.x,y:box.y,w:box.w,h:box.h,rot:a.rot,
          op:a.op,color:tokVal(a.color),swPct:swOf(a)/SW_REF_H*100,
          dash:LINE_PPT[lineStyle(a)],pts:a.pts||[]});
      } else if(a.k==='arrow'){
        var ea=arrowEnds(layer,s,a,0);
        var hz=headSize(a);
        items.push({t:'line',x1:ea.x1,y1:ea.y1,x2:ea.x2,y2:ea.y2,
          color:tokVal(a.color),swPct:swOf(a)/SW_REF_H*100,
          dash:LINE_PPT[lineStyle(a)],op:a.op,
          head:(HEAD_BY[headEnd(a)]||{}).ppt||'none',
          tail:(HEAD_BY[headStart(a)]||{}).ppt||'none',
          hsz:hz.ppt,curve:a.curve,bend:a.bend});
      } else if(a.k==='table'){
        /* PowerPoint has a real table shape, so pptx.js grew a builder
           for it rather than flattening a table into a grid of
           rectangles - which is not much of an export for anyone who
           then wants to edit the deck (2026-08-20) */
        items.push({t:'table',x:box.x,y:box.y,w:box.w,h:box.h,
          rot:a.rot,op:a.op,rows:tableRows(a).map(function(r){
            return r.map(function(v){return v==null?'':String(v);});}),
          cols:tableCols(a),thead:!!a.thead,grid:a.grid!==0,
          sizePct:a.size||2.2,color:tokVal(a.color)||ink,
          font:fontPpt(a.font)});
      } else if(a.k==='chart'){
        /* the numbers travel, so PowerPoint gets a REAL chart it can
           restyle and recolour \u2014 the point of T117. chartParse
           resolves palette colours so a re-export stays consistent. */
        var cd=chartParse(a);
        items.push({t:'chart',x:box.x,y:box.y,w:box.w,h:box.h,
          ct:a.ct||'bar',cats:cd.cats,
          series:cd.series.map(function(se){
            return {name:se.name,ys:se.ys,color:se.color};}),
          numeric:cd.numeric,title:a.title||'',leg:a.leg!==0,ink:ink});
      } else if(a.k==='flip'){
        /* the frame this exported page is FOR. pptxItems is handed the
           slide plus, for an exploded page, which frame it represents —
           so one flip book of six figures becomes six real PowerPoint
           slides, which is the pile of slides the user was building by
           hand (2026-08-22). A placed notebook figure already exports as
           a picture, so this reuses that path rather than inventing one. */
        var fsel=flipFrames(a)[(note.frame!=null)?note.frame:(a.at||0)];
        var fsrc=null;
        if(fsel&&fsel.src) fsrc=fsel.src;
        else if(fsel&&fsel.ref){
          var fit=resolveRef(fsel.ref);
          var fnd=fit?framePart(fit.ns,fsel.part):null;
          var fig=fnd?fnd.querySelector('img'):null;
          if(fig&&fig.src&&fig.src.indexOf('data:')===0) fsrc=fig.src;
        }
        if(fsrc) items.push({t:'image',x:box.x,y:box.y,w:box.w,h:box.h,
          rot:a.rot,op:a.op,src:pptxSrc(note,fsrc),
          name:(fsel&&fsel.label)||'Figure'});
        else note.skipped++;
      } else if(a.k==='cell'){
        var it=a.ref?resolveRef(a.ref):null;
        var node=it?framePart(it.ns,a.part):null;
        var img=node?node.querySelector('img'):null;
        if(img&&img.src&&img.src.indexOf('data:')===0){
          items.push({t:'image',x:box.x,y:box.y,w:box.w,h:box.h,
            rot:a.rot,op:a.op,src:img.src,name:(it&&it.title)||'Figure'});
          return;
        }
        /* no figure to lift — but prose and code ARE just text, and a text
           box beats an empty slide. A rich repr is neither: its meaning
           is in a layout PowerPoint cannot rebuild, so it is reported
           instead of being flattened into gibberish. A TABLE is the
           exception, and used to be counted with them: pptx.js has had a
           real table builder since the deck's own table kind, and it
           already tolerates the shape a scrape produces — a missing
           `cols` falls back to an equal split and a short row yields ''
           per cell. So the meaning survives, editable, and the biggest
           single entry in the "could not convert" tally goes with it
           (T109). */
        var tbl=node&&node.querySelector('table');
        var isTable=!!tbl;
        if(isTable){
          var rows=scrapeTable(tbl);
          if(rows.length){
            items.push({t:'table',x:box.x,y:box.y,w:box.w,h:box.h,
              rot:a.rot,op:a.op,rows:rows,
              /* grid:1 or the rules vanish and a scraped table arrives
                 as loose text in a box */
              thead:!!tbl.querySelector('thead th, thead td'),grid:1,
              sizePct:1.6,color:tokVal(a.txcol)||ink,
              name:(it&&it.title)||'Table'});
            return;
          }
        }
        /* a <pre> means the frame IS code; a bare inline <code> is just
           prose with a code span in it, and setting the whole note in
           monospace for one `groupby(...)` reads as a bug */
        var code=node&&node.querySelector('pre');
        /* typeset maths survives only as its flattened characters — legible,
           but no longer an equation. Counted so the toast can say so. */
        if(node&&node.querySelector('mjx-container')) note.maths++;
        var txt=(node&&!isTable)?blockText(node):'';
        if(txt){
          items.push({t:'text',x:box.x,y:box.y,w:box.w,h:box.h,
            rot:a.rot,op:a.op,text:txt,sizePct:code?1.3:1.8,
            color:tokVal(a.txcol)||ink,font:code?'Consolas':'',
            name:(it&&it.title)||'Text'});
        } else note.skipped++;
      }
      /* build timing and click actions ride on WHATEVER the branch
         above pushed for this annot (T110). rise/zoom have no honest
         entrance twin, so they leave as fades \u2014 counted in the
         export dialog, never silently. A link to a slide leaves as the
         DECK index here; the builder maps it to the output page,
         because a flip book explodes one slide into several. */
      /* A SERIES TIE LEAVES AS A REAL BUILD (T173), not as a line in
         the loss report. "Show from this series onwards" is exactly
         PowerPoint's own model -- the words arrive on the click that
         plots that series and stay -- so it survives the round trip;
         the arithmetic is the one seriesShows uses, base+i, so the
         click you rehearsed is the click PowerPoint gives you.
         'only' and 'until' need the words to LEAVE again, which this
         writer has no exit animation for, so those are counted and
         land whole. Failing open beats a paragraph nobody can find. */
      /* AN EXIT IS COUNTED, NOT SILENTLY DROPPED (T174). PowerPoint
         has exit animations, but this writer only emits entrances --
         and a swap that exported as two pictures stacked on top of each
         other would be worse than being told. */
      if(typeof animOut==='function'&&animOut(a)!=null)
        note.exits=(note.exits|0)+1;
      var xt=(typeof seriesTie==='function')?seriesTie(a):null;
      var xstep=null;
      if(xt&&!a.anim){
        var xch=annotByOid(s,xt.id);
        if(xch&&xch.k==='chart'&&xch.anim&&xch.anim.by==='series'){
          var xi=chartSeriesNames(xch).indexOf(xt.at);
          var xb=(xi<0)?null:stepBase(s,xch);
          if(xb!=null){
            if((xt.m||'from')==='from') xstep=xb+xi;
            else note.tied=(note.tied|0)+1;
          }
        }
      }
      for(var pq=pushedAt;pq<items.length;pq++){
        if(xstep!=null){
          items[pq].animStep=xstep;
          items[pq].animType=(a.anim&&a.anim.type)||'fade';
        }
        if(a.anim){
          items[pq].animStep=bsteps[a.anim.order||0];
          items[pq].animType=a.anim.type||'fade';
          /* a build that runs itself carries its wait out to PowerPoint,
             which has the same idea (after-previous with a delay), so it
             survives the round trip instead of becoming a loss line */
          if(a.anim.after) items[pq].after=a.anim.after|0;
        }
        if(a.link&&a.link.to==='url'&&a.link.href){
          items[pq].link={to:'url',href:a.link.href};
        } else if(a.link&&a.link.to==='slide'&&a.link.sid){
          var lsi=-1;
          (pres.slides||[]).forEach(function(s9,i9){
            if(lsi<0&&s9.sid===a.link.sid) lsi=i9;});
          if(lsi>=0) items[pq].link={to:'slide',si:lsi};
        }
      }
    });
    return items;
  }
  /* A RENDERED TABLE, back into rows of strings. Deliberately the
     visible text and nothing else: colspans, nested markup and the
     pandas index are all layout, and a scrape that tried to keep them
     would produce a table that is wrong rather than plain. The cap is
     what PowerPoint stays usable at; past it the frame is better as a
     picture, and says so. */
  var SCRAPE_ROWS=60, SCRAPE_COLS=20;
  function scrapeTable(tbl){
    var out=[],n=0;
    var trs=tbl.querySelectorAll('tr');
    for(var i=0;i<trs.length&&out.length<SCRAPE_ROWS;i++){
      var cells=trs[i].querySelectorAll('th,td');
      if(!cells.length) continue;
      var row=[];
      for(var j=0;j<cells.length&&j<SCRAPE_COLS;j++)
        row.push((cells[j].textContent||'').trim());
      if(row.join('')==='') continue;
      n=Math.max(n,row.length);
      out.push(row);
    }
    /* tableShape reads the column count off row 0, so a header shorter
       than its body would truncate every row under it */
    return out.map(function(r){
      while(r.length<n) r.push('');
      return r;
    });
  }
  /* EVERY ORIGINAL THIS EXPORT WILL NEED, resolved before the build.
     JunoPptx.build is synchronous and pptxItems with it, so the
     IndexedDB lookup cannot happen inside them — it happens once, here,
     and is handed down as a plain {displaySrc: fullBytes} map. */
  function pptxOriginals(){
    var jobs=[],out={};
    function want(o){
      if(!o||!o.okey||!o.src||out[o.src]!==undefined) return;
      out[o.src]=null;
      jobs.push(originalOf(o).then(function(full){
        if(full&&full!==o.src) out[o.src]=full;}));
    }
    (pres.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(!a) return;
        if(a.k==='image') want(a);
        else if(a.k==='flip'&&Array.isArray(a.frames)) a.frames.forEach(want);
      });
    });
    if(!jobs.length) return Promise.resolve(out);
    return Promise.all(jobs).then(function(){return out;},
      function(){return out;});
  }
  function exportDeckPptx(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    if(!window.JunoPptx){toast('PowerPoint export unavailable here');return;}
    /* what this will cost, BEFORE the file is in the downloads folder
       (T109). Silent when there is nothing to lose. */
    if(!pptxConfirmLosses()) return;
    /* a .pptx leaves this machine and is re-scaled by whoever opens it,
       so it is one of the two consumers that most wants the full bytes —
       and it was embedding a.src, which is the shrunk display copy
       (2026-08-26 audit, T58) */
    return pptxOriginals().then(pptxBuildAndSave);
  }
  /* WHAT THIS EXPORT WILL COST, said before it happens. The tally
     already existed and was read out in a toast AFTERWARDS, which is
     the wrong end: by then the file is in the downloads folder and the
     choice — export the PDF instead — has been made for you. This runs
     the same enumeration dry and, only when something really will be
     lost, asks. Nothing to lose means no dialog, so the ordinary export
     is still one click (T109). */
  function pptxLosses(){
    var note={skipped:0,cropped:0,maths:0,tied:0,exits:0,orig:{}};
    var lost=[];
    outputSlides().forEach(function(ent){
      note.frame=ent.f;
      pptxItems(ent.s,note,'#ffffff',null);
      note.frame=null;
    });
    if(note.skipped) lost.push(note.skipped+' placed cell'
      +(note.skipped===1?'':'s')+' that PowerPoint has no shape for');
    if(note.maths) lost.push(note.maths+' equation'
      +(note.maths===1?'':'s')+' — PowerPoint has no LaTeX, so they '
      +'arrive as plain characters');
    if(note.exits) lost.push(note.exits+' object'
      +(note.exits===1?'':'s')+' set to GO on a later click \u2014 this '
      +'writer emits entrances only, so they arrive and then stay, '
      +'stacked over whatever was meant to replace them');
    if(note.tied) lost.push(note.tied+' item'+(note.tied===1?'':'s')
      +' tied to a chart series with “only” or “until” '
      +'— PowerPoint is given no way to take them away again, so '
      +'they stay on the slide once shown');
    if(note.cropped) lost.push(note.cropped+' hand-drawn crop outline'
      +(note.cropped===1?'':'s')+' — the trim is carried, the outline '
      +'is not');
    /* builds TRAVEL now (T110) \u2014 what is still approximate is
       the entrance on the two effects PowerPoint spells differently */
    var soft=0;
    (pres.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(a&&a.anim&&(a.anim.type==='rise'||a.anim.type==='zoom'))
          soft++;});
    });
    if(soft) lost.push(soft+' rise/zoom build'
      +(soft===1?'':'s')+' — the click timing is kept, the entrance '
      +'plays as a fade');
    /* TEXT BUILDS. Bullet by bullet TRAVELS -- it leaves as a real
       PowerPoint paragraph build. The other two are named. */
    var sent=0,mdpara=0;
    (pres.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(!a||a.k!=='text'||!a.anim) return;
        if(a.anim.by==='sent') sent++;
        else if(a.anim.by==='para'&&a.md
                &&/(^|\n)[ \t]*(\n|$)/.test(String(a.text||''))) mdpara++;
      });});
    if(sent) lost.push(sent+' sentence-by-sentence text build'
      +(sent===1?'':'s')+' — PowerPoint builds text by PARAGRAPH and '
      +'has no smaller unit, so each of these arrives as a whole box on '
      +'one click');
    if(mdpara) lost.push(mdpara+' Markdown box'+(mdpara===1?'':'es')
      +' built bullet by bullet — a blank line in the source is a '
      +'paragraph to PowerPoint and not a bullet here, so it takes a few '
      +'more clicks there than it does on this slide');
    return lost;
  }
  function pptxConfirmLosses(){
    var lost=pptxLosses();
    if(!lost.length) return true;
    return confirm('Export to PowerPoint?\n\nEverything else comes '
      +'across, but this will not:\n\n\u2022 '+lost.join('\n\u2022 ')
      +'\n\nExport PDF keeps all of it exactly as you see it.');
  }
  function pptxBuildAndSave(orig){
    var pg=pageOf(),
      note={skipped:0,cropped:0,maths:0,tied:0,exits:0,
        orig:orig||{}};
    var bg=tokVal((pres&&pres.pageBg)||'#0b141d');
    var ink=pageIsLight(bg)?'#0b141d':'#ffffff';
    /* a slide-jump names a DECK slide; the .pptx page it lands on is
       the first output page that slide produced (flip books explode) */
    var ents=outputSlides();
    var firstOut={};
    ents.forEach(function(ent,oi){
      if(!(ent.i in firstOut)) firstOut[ent.i]=oi+1;});
    var out=JunoPptx.build({
      title:pres.name||'presentation',
      widthMm:pg.mm[0],heightMm:pg.mm[1],bg:bg,
      slides:ents.map(function(ent){
        /* only the slide on screen has a live layer; the rest resolve
           attached arrow ends from their stored coordinates */
        var lay=(ent.i===cur)?stage.querySelector('.annot-layer'):null;
        note.frame=ent.f;
        var its=pptxItems(ent.s,note,ink,lay);
        note.frame=null;
        /* the master's look is BAKED into the export (T115): furniture
           items first (under the content) and the inherited
           background. PowerPoint-side inheritance would mean real
           slideLayout parts per master; the flattening is the recorded
           cut -- the pixels are right, the linkage does not travel. */
        var mm3=mastOf(ent.s);
        if(mm3&&mm3.cmp){
          var msyn3=mastSynth(mm3);
          if(msyn3) its=pptxItems(msyn3,note,ink,null).concat(its);
        }
        its.forEach(function(it){
          if(it.link&&it.link.to==='slide')
            it.link=(it.link.si in firstOut)
              ?{to:'slide',slide:firstOut[it.link.si]}:null;
        });
        if(ent.s.border) its.unshift({t:'rect',x:0,y:0,w:100,h:100,
          color:tokVal(ent.s.border.c)||'#39a9c0',
          swPct:(ent.s.border.w||4)/SW_REF_H*100,fill:'',name:'Border'});
        /* transFor() reads the slide's own transition, else its
           section's -- the same answer present mode uses. ent.i is the
           SOURCE slide index, which matters because a flip book
           explodes one slide into several output slides. */
        /* sl.notes is what the Notes pane writes and the presenter
           console reads; PowerPoint's Notes page is plain text, so it
           goes across as it is. A flip book's extra output slides share
           the source slide's notes, which is the same thing the
           presenter sees on each of them. */
        return {bg:bgSolid(tokVal(ent.s.bg)
            ||(mm3&&tokVal(mm3.bg))||bg),items:its,
          trans:transFor(ent.i),notes:ent.s.notes||''};
      }),
    });
    var a=document.createElement('a');
    a.href=URL.createObjectURL(out.blob);
    a.download=(pres.name||'presentation')+'.pptx';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
    var msg='PowerPoint saved — text stays editable'+outputNote();
    var noted=outputSlides().filter(function(e){
      return e.s&&e.s.notes&&e.s.notes.trim();}).length;
    if(noted) msg+='. Speaker notes came across on '+noted+' slide'
      +(noted===1?'':'s');
    /* tables convert now (T109), so naming them here would send
       people to the PDF for something that already worked */
    if(note.skipped) msg+='. '+note.skipped+' cell'
      +(note.skipped===1?'':'s')+' could not convert (a rich output with '
      +'no picture and no text — use Export PDF for those)';
    if(note.exits) msg+='. '+note.exits+' object'
      +(note.exits===1?'':'s')+' meant to leave on a later click will '
      +'stay \u2014 PowerPoint gets entrances only from here';
    if(note.tied) msg+='. '+note.tied+' series-tied item'
      +(note.tied===1?'':'s')+' will stay once shown — '
      +'“only” and “until” need an exit this '
      +'writer does not have';
    if(note.cropped) msg+='. '+note.cropped+' hand-drawn crop'
      +(note.cropped===1?'':'s')+' not carried (PowerPoint has no '
      +'freehand mask \u2014 the trim is, the outline is not)';
    if(note.maths) msg+='. '+note.maths+' equation'
      +(note.maths===1?'':'s')+' came across as plain text \u2014 '
      +'PowerPoint has no LaTeX, so they were flattened to characters';
    toast(msg);
    /* one honest tally for the caller: the builder counts items IT could not
       write, this counts cells that never became items — reporting only one
       of the two reads as "nothing was lost" when something was */
    return {blob:out.blob,slides:out.slides,cropped:note.cropped,
      skipped:note.skipped+out.skipped};
  }
  /* ---- Background menu: THIS slide's colour and border. The whole
     presentation's background stays under File, where it always was. */
  (function(){
    var wired=wireMenuToggle('bg-drop','bg-btn','bg-menu');
    if(!wired) return;
    var menu=wired.menu;
    var BWS=[[0,'Off'],[2,'Thin'],[4,'Medium'],[9,'Thick']];
    function apply(fn){
      var s2=pres.slides[cur]; if(!s2) return;
      fn(s2);markDirty();applyPageBg();applyZoom();renderSlide();
      build();
    }
    function build(){
      var s2=pres.slides[cur]||{};
      menu.innerHTML='';
      menuHead(menu,'This slide');
      var r1=menuRow(menu,'bg-sw');
      bgChips(r1,s2.bg||'',function(v){
        apply(function(x){if(v) x.bg=v; else delete x.bg;});
      },true);
      /* the WHOLE deck's default, in the same menu as the one slide's
         override, so you can see the two against each other. It used to
         be a row in the File menu, which is where you open, save and
         export things (2026-08-20, user). */
      menuHead(menu,'Every slide');
      var r0=menuRow(menu,'bg-sw');
      bgChips(r0,(pres&&pres.pageBg)||'',function(v){
        pres.pageBg=v;markDirty();applyPageBg();applyZoom();renderSlide();
        build();
        toast('Background for every slide set');
      },false);
      /* the deck default only shows through on slides that have no
         override of their own, so on any slide that HAS one the row
         above silently did nothing at all — you set the background for
         every slide and watched the one in front of you not change
         (2026-08-22). This is the verb that clears them. */
      var push=document.createElement('button');
      push.className='dbtn vw-opt';
      push.textContent='Use this on every slide (clears per-slide ones)';
      push.title='Slides with a background of their own keep showing it '
        +'until this clears them';
      var over=(pres.slides||[]).filter(function(x){return x&&x.bg;});
      push.disabled=!over.length;
      if(over.length) push.title='Clears the background '+over.length
        +' slide'+(over.length===1?'':'s')+' set individually';
      push.addEventListener('click',function(e){
        e.stopPropagation();
        var use=s2.bg||pres.pageBg||'';
        if(use) pres.pageBg=use;
        (pres.slides||[]).forEach(function(x){if(x) delete x.bg;});
        markDirty();applyPageBg();applyZoom();renderSlide();build();
        toast('Every slide now uses the one background');
      });
      menu.appendChild(push);
      menuHead(menu,'Border');
      var r2=menuRow(menu,'bg-bw');
      BWS.forEach(function(p){
        var b=document.createElement('button');
        b.className='sh-opt bg-w';b.textContent=p[1];
        var on=p[0]===((s2.border&&s2.border.w)||0);
        b.setAttribute('aria-pressed',on.toString());
        b.addEventListener('click',function(e){e.stopPropagation();
          apply(function(x){
            if(!p[0]) delete x.border;
            else x.border={w:p[0],c:(x.border&&x.border.c)||'#39a9c0'};
          });});
        r2.appendChild(b);
      });
      if(s2.border){
        var r3=menuRow(menu,'bg-sw');
        ['#39a9c0','#ff6b57','#f0a848','#46a892','#16202b','#ffffff']
          .forEach(function(c){
          var b=document.createElement('button');
          b.className='sh-opt bg-chip';b.title='Border colour';
          b.style.background=c;
          b.setAttribute('aria-pressed',(s2.border.c===c).toString());
          b.addEventListener('click',function(e){e.stopPropagation();
            apply(function(x){x.border.c=c;});});
          r3.appendChild(b);
        });
      }
    }
    wired.btn.addEventListener('click',function(){build();});
  })();
  window.SemDeckPptx=exportDeckPptx;   /* test hook */
  menuAction('#mi-pptx',function(){exportDeckPptx();});
  /* page background swatches (File menu) */
  /* one importer for every way a saved file comes back in: the File-menu
     picker, the launcher's "+ New… → Open a .junoview file…" row, and the
     silent startup restore from a remembered file handle. `silent` never
     renames, never toasts and never steals the view — it only fills in
     presentations the browser does not already have. */
  function importDeckText(txt,silent){
    var obj=parseDeckText(txt);
    var list=(obj&&Array.isArray(obj.presentations))
      ?obj.presentations
      :Array.isArray(obj)?obj
      :(obj&&Array.isArray(obj.slides))?[obj]:null;
    if(!list||!list.length){
      if(!silent) toast('That file does not look like a saved deck');
      return 0;
    }
    var imported=0,firstName=null;
    list.forEach(function(pr){
      if(!pr||!Array.isArray(pr.slides)) return;
      var np=normPres(pr);
      var base=np.name||'imported',nm=base,k=1;
      if(silent&&(savedByName(nm)||lsGet(PFX+nm))) return;
      while(savedByName(nm)||lsGet(PFX+nm)){
        k++;nm=base+'-'+k;
      }
      np.name=nm;
      lsSet(PFX+nm,JSON.stringify(np));
      if(!firstName) firstName=nm;
      imported++;
    });
    if(!imported){
      if(!silent) toast('No presentations found in that file');
      return 0;
    }
    if(silent){renderPresTabs();return imported;}
    lsSet(PFX+'last',firstName);
    loadPresentation(firstName);
    cur=0;activePane=-1;
    /* picked from the launcher: go straight into the editor — the whole
       point of opening a file is to get back to the presentation in it */
    if(deckEl.hidden) openDeck('edit');
    status();refresh();
    toast('Imported '+imported+' presentation'
      +(imported>1?'s':'')+' (as drafts)');
    return imported;
  }
  window.SemDeckImport=importDeckText;       /* browser-verification hook */
  window.SemDeckFileHtml=function(){return junoviewFileHtml();};
  /* ---- OPENING A .junoview FILE ---------------------------------------
     Opening a file used to import its contents and then carry on saving
     to the BROWSER, so the file you opened never changed again and your
     work quietly went somewhere else (2026-08-20, user: "when loading
     presentation from computer, it then starts saving to browser, should
     save to the same file").
     Where the File System Access API exists we ask for a real handle, so
     Save writes straight back to the file you opened. Where it does not
     (Firefox, Safari) an <input type=file> gives contents but no handle —
     nothing can write back to it — so the target is still set to "on this
     computer" and the first Save asks once where to put it. Either way
     the answer to "where is this going?" stops being "somewhere else". */
  function openDeckFile(){
    if(window.showOpenFilePicker){
      window.showOpenFilePicker({
        types:[{description:'Junoview presentation',
          accept:{'text/html':['.html','.junoview'],
            'application/json':['.json']}}],
        multiple:false
      }).then(function(hs){
        var h=hs&&hs[0]; if(!h) return;
        return h.getFile().then(function(f){
          return f.text().then(function(txt){
            importDeckText(txt,false);
            /* the handle is what makes Save write back to this very file */
            fileHandle=h;fileName=h.name||f.name||'';
            idbPut('deckFile',h);
            setTarget('file');
            toast('Opened \u2014 Save now writes back to '+fileName);
          });
        });
      }).catch(function(){});
      return;
    }
    var fi=document.getElementById('deckfile');
    if(fi) fi.click();
  }
  (function(){
    var fi=document.getElementById('deckfile');
    if(!fi) return;
    fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      this.value='';
      if(!f) return;
      var nm=f.name||'';
      f.text().then(function(txt){
        importDeckText(txt,false);
        /* no handle from an <input>, so we cannot write back to the file
           itself - but the DESTINATION is still "a file on your
           computer", and the first Save asks where once */
        fileName=nm;fileHandle=null;
        setTarget('file');
        toast('Opened \u2014 Save keeps it as a file on your computer');
      }).catch(function(e){
        toast('Import failed: '+((e&&e.message)||e));
      });
    });
  })();
  menuAction('#mi-discard',function(){
    cancelDraftWrite();   /* a pending write would resurrect the discard */
    lsDel(PFX+(pres.name||'untitled'));
    loadPresentation(pres.name);
    cur=0;activePane=-1;
    status();
    refresh();
  });
  /* ONE project save, shared by rename and delete. embedAssets, not the
     lean list: `projectPres` can never carry `emb` (normPres absorbs it
     into the session store), so posting it raw made a rename or a delete
     quietly strip every embedded figure out of junoview_project.json —
     the file stopped being self-contained without anything being said
     (2026-08-22). */
  function saveProject(){
    if(APP.mode==='app')
      APP.api('/api/save',{presentations:embedAssets(deep(projectPres))})
        .catch(function(){});
  }
  /* one delete, callable for ANY presentation — the File menu and the
     rail rows' bins both land here (2026-08-18, user: "an easier way to
     delete presentation ... a delete option when something is selected") */
  function deletePresByName(nm){
    if(pres&&nm===pres.name) cancelDraftWrite();
    lsDel(PFX+nm);
    /* embedded-in-a-notebook presentations come back on reload — say so,
       whichever door the delete came through */
    var wasEmbedded=nbPres.some(function(p){return p.name===nm;});
    projectPres=projectPres.filter(function(p){return p.name!==nm;});
    nbPres=nbPres.filter(function(p){return p.name!==nm;});
    saveProject();
    if(nm===pres.name){
      var names=allSaved().map(function(p){return p.name;})
        .concat(draftNames());
      names=names.filter(function(x){return x!==nm;});
      if(names.length) loadPresentation(names[0]);
      else {pres=defaultPres();source='auto';}
      cur=0;activePane=-1;
      status();refresh();
    } else renderPresTabs();
    toast(wasEmbedded
      ?('Deleted "'+nm+'" (it will return if it is embedded in a '
        +'notebook’s metadata)')
      :('Deleted "'+nm+'"'));
  }
  (function(){
    var b=$('#pr-newbtn'),m=$('#pr-newmenu');
    if(!b||!m) return;
    b.addEventListener('click',function(e){
      e.stopPropagation();
      m.hidden=!m.hidden;
      b.setAttribute('aria-expanded',(!m.hidden).toString());
    });
    $$('.pr-mi',m).forEach(function(mi){
      mi.addEventListener('click',function(e){
        e.stopPropagation();
        m.hidden=true;b.setAttribute('aria-expanded','false');
        var real=$('#'+mi.dataset.for);
        if(real) real.click();
      });
    });
    document.addEventListener('click',function(e){
      if(!m.hidden&&!m.contains(e.target)&&e.target!==b){
        m.hidden=true;b.setAttribute('aria-expanded','false');}
    });
  })();
  window.SemDeckDelete=deletePresByName;   /* rail rows + tests */
  /* ---- ONE rename, for every door into it -----------------------------
     There are three (the title bar, File ▸ Rename…, and the rail), and
     before this there was no shared implementation at all: each one poked
     pres.name and #pres-name directly. The result was renaming that
     appeared to do nothing in the primary flow, drafts orphaned under
     every prefix of the new name, no collision guard, and a project entry
     that kept the old name (2026-08-20 diagnosis).
     A rename moves the WORK, not just the label: the browser draft, the
     project entry, and the folder the presentation was filed in. */
  function renamePresentation(nm){
    nm=String(nm||'').trim();
    var old=pres&&pres.name;
    if(!nm||!old||nm===old) return false;
    var taken=allSaved().map(function(p){return p.name;})
      .concat(draftNames());
    if(taken.indexOf(nm)>=0){
      toast('There is already something called “'+nm+'” — pick another '
        +'name');
      return false;
    }
    /* the draft moves with the name, rather than being deleted under the
       old one and re-created under the new one on the next save */
    flushTextEdits();
    flushDraftWrite();   /* migrate the CURRENT state, not a stale draft */
    /* Rename itself is an unsaved edit, even when this deck had no draft
       before. Put the complete current state under the new key NOW; the
       debounced markDirty below is redundancy, not the only copy. */
    var moved=deep(pres);moved.name=nm;
    if(!lsSet(PFX+nm,JSON.stringify(moved))){
      toast('Could not rename — this browser could not keep the moved '
        +'draft. Your presentation is still called “'+old+'”.',9000);
      return false;
    }
    lsDel(PFX+old);
    /* the folder rides on the presentation object itself (p.folder), so
       it needs no separate move — but the SAVED copies are matched by
       name and do */
    projectPres.forEach(function(p){if(p.name===old) p.name=nm;});
    nbPres.forEach(function(p){if(p.name===old) p.name=nm;});
    /* Queued behind any Save already in flight. Snapshot JSON can keep
       its historical name because restore deliberately preserves `nm`. */
    histRename(old,nm);
    pres.name=nm;
    saveProject();
    markDirty();status();renderPresTabs();renderPresRow();
    toast('Renamed to “'+nm+'”');
    return true;
  }
  menuAction('#mi-del',function(){
    deletePresByName(pres.name);
  });

  /* ---- FIND AND REPLACE ------------------------------------------------
     Searches the MODEL, not the rendered page: every text box, list item,
     slide title and subtitle on every slide, whether or not that slide is
     the one on screen. A browser find can only ever see the one slide
     that is rendered, which for a deck is the wrong answer almost all of
     the time (2026-08-20, user: "needs to be a search and replace of text
     and stuff, that is pretty standard").
     A placed notebook card is deliberately NOT searchable: its words
     belong to the notebook, and rewriting them here would put the slide
     and its source out of step with no way to tell. */
  (function(){
    var pop=$('#find-pop');
    if(!pop) return;
    var qi=$('#find-q'),ri=$('#find-r'),listEl=$('#find-list');
    var cntEl=$('#find-count'),ckCase=$('#find-case'),ckWord=$('#find-word');
    var hits=[],at=-1;
    /* every writable string in the deck, as {si, idx, get, set, label} */
    function fields(){
      var out=[];
      (pres.slides||[]).forEach(function(s,si){
        if(s.layout==='title'){
          out.push({si:si,idx:'t',label:'Title',
            get:function(){return s.title||'';},
            set:function(v){s.title=v;}});
          out.push({si:si,idx:'s',label:'Subtitle',
            get:function(){return s.sub||'';},
            set:function(v){s.sub=v;}});
        }
        (s.annots||[]).forEach(function(a,i){
          if(!a) return;
          if(a.k==='table'){
            /* A table is many independent strings, not one blob: a hit
               names the exact cell, selects its table on arrival, and a
               replacement cannot spill across a cell boundary. */
            tableNormalise(a);
            a.rows.forEach(function(row,r){
              row.forEach(function(_,c){
                out.push({si:si,idx:i,label:itemLabel(s,i)+' · row '
                  +(r+1)+', column '+(c+1),
                  get:function(){
                    var v=a.rows[r][c];
                    return v==null?'':String(v);
                  },
                  set:function(v){a.rows[r][c]=v;}});
              });
            });
            return;
          }
          if(a.k!=='text') return;
          out.push({si:si,idx:i,label:itemLabel(s,i),
            get:function(){return a.text||'';},
            set:function(v){
              a.text=v;
              /* rich markup cannot survive a plain-text substitution
                 without a mapping from characters to runs, so a replaced
                 box drops back to plain text — and says so in the toast
                 rather than silently losing a colour */
              if(a.html){delete a.html;
                if(listOf(a)) setListStyle(a,listOf(a));}
            }});
        });
      });
      return out;
    }
    function rx(){
      var q=qi.value;
      if(!q) return null;
      var esc2=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(ckWord.checked) esc2='\\b'+esc2+'\\b';
      try{return new RegExp(esc2,ckCase.checked?'g':'gi');}
      catch(e){return null;}
    }
    function scan(){
      hits=[];
      var re=rx();
      if(re) fields().forEach(function(f){
        var txt=f.get(),m;re.lastIndex=0;
        while((m=re.exec(txt))){
          hits.push({f:f,start:m.index,len:m[0].length});
          if(!m[0].length) re.lastIndex++;   /* never loop on an empty match */
        }
      });
      if(at>=hits.length) at=hits.length-1;
      render();
    }
    function preview(h){
      var t=h.f.get();
      var a=Math.max(0,h.start-24),b=Math.min(t.length,h.start+h.len+24);
      var frag=document.createDocumentFragment();
      if(a>0) frag.appendChild(document.createTextNode('…'));
      frag.appendChild(document.createTextNode(t.slice(a,h.start)));
      var mk=document.createElement('mark');
      mk.textContent=t.substr(h.start,h.len);
      frag.appendChild(mk);
      frag.appendChild(document.createTextNode(t.slice(h.start+h.len,b)));
      if(b<t.length) frag.appendChild(document.createTextNode('…'));
      return frag;
    }
    function render(){
      cntEl.textContent=hits.length
        ?((at>=0?at+1:1)+' of '+hits.length)
        :(qi.value?'no matches':'');
      listEl.innerHTML='';
      hits.slice(0,120).forEach(function(h,k){
        var b=document.createElement('button');
        b.className='find-hit'+(k===at?' cur':'');
        var n=document.createElement('span');n.className='fh-n';
        n.textContent=(h.f.si+1)+' · '+h.f.label;
        b.appendChild(n);b.appendChild(preview(h));
        b.addEventListener('click',function(){at=k;goHit();});
        listEl.appendChild(b);
      });
      if(hits.length>120){
        var more=document.createElement('div');
        more.className='selpane-empty';
        more.textContent='…and '+(hits.length-120)+' more';
        listEl.appendChild(more);
      }
    }
    /* land on the hit: go to its slide and select the item, so you can SEE
       what you are about to change */
    function goHit(){
      var h=hits[at]; if(!h) return;
      if(cur!==h.f.si){cur=h.f.si;refresh();}
      var l=stage.querySelector('.annot-layer');
      if(l) selectAnnot(l,h.f.idx);
      render();
    }
    function step(d){
      if(!hits.length) return;
      at=(at+d+hits.length)%hits.length;
      goHit();
    }
    function replaceOne(){
      var h=hits[at]||hits[0]; if(!h) return;
      var t=h.f.get();
      h.f.set(t.slice(0,h.start)+ri.value+t.slice(h.start+h.len));
      markDirty();refresh();scan();
      toast('Replaced 1');
    }
    function replaceAll(){
      var re=rx(); if(!re) return;
      var n=0;
      fields().forEach(function(f){
        var t=f.get();re.lastIndex=0;
        if(!re.test(t)) return;
        re.lastIndex=0;
        f.set(t.replace(re,function(m){n++;return ri.value;}));
      });
      if(!n){toast('Nothing to replace');return;}
      markDirty();refresh();scan();
      toast('Replaced '+n+(n===1?' match':' matches'));
    }
    /* ---- FIND & REPLACE: FORMATTING ------------------------------
       Text replace above answers "every 'SST' becomes 'sea surface
       temperature'". This answers "every 18pt Georgia heading becomes
       20pt Inter" — the sweep you need when a deck has to change face,
       and the one that otherwise costs an afternoon of clicking
       (TASKS T6).

       FIND is T5's criteria table, used and not duplicated: the ticked
       rows AND together, and every one of them is read off the object
       you have SELECTED. Describing a look in the abstract is a form
       nobody fills in correctly — picking an example of it is one
       click, and it is the same gesture T5 already taught.

       CHANGE is a short list of fields, not a whole look. Copying a
       whole look onto everything of a type is the Apply dialog's job
       and it already does it well; this is the surgical one — change
       exactly these fields, on exactly the things that answer this
       description, and leave the rest alone. Nothing here writes
       a.style, for the reason the Apply dialog gives: re-tagging a box
       changes what it IS, not how it looks. */
    var FMT_CHANGES=[
      /* key, label, kinds it means anything for, write(a,v) */
      ['font','Typeface','text',function(a,v){
        if(v) a.font=v; else delete a.font;}],
      ['size','Text size','text table',function(a,v){a.size=v/5.4;}],
      ['color','Colour','text arrow rect draw',function(a,v){
        a.color=v;}]
    ];
    var fmtPanel=$('#find-fmt'),mode='text',fmtBuiltFor=null;
    function fmtRef(){
      var s2=pres.slides[cur];
      /* The ribbon and every inspector describe the PRIMARY selection.
         In a multi-selection, clicking another selected member changes
         selAnnot without reordering selSet, so selSet's last index can
         point at a different object from the one the user just chose. */
      return (s2&&typeof selAnnot==='number')
        ?((s2.annots||[])[selAnnot]||null):null;
    }
    /* WHICH OBJECTS A SWEEP TOUCHES — and it is NOT annotsBy's rule.
       annotsBy answers "what can I select", so it leaves out hidden
       items: you cannot select what is not on the page. A sweep is a
       different question. `hide` means "hidden while EDITING, still
       shown when presenting", so an item skipped here would keep the
       old face through the whole talk — the exact failure the sweep
       exists to prevent. Fully locked items are still out: a lock is an
       explicit "not this one". */
    function sweep(crit,scope){
      var out=[];
      var ids=(scope==='deck')
        ?(pres.slides||[]).map(function(_,i){return i;}):[cur];
      ids.forEach(function(i){
        var sl=(pres.slides||[])[i]; if(!sl) return;
        (sl.annots||[]).forEach(function(a,j){
          if(!a||lockedAll(a)) return;
          if(critsMatch(a,crit)) out.push({si:i,i:j,a:a});
        });
      });
      return out;
    }
    function fmtBuild(){
      if(!fmtPanel) return;
      fmtPanel.innerHTML='';
      var ref=fmtRef();
      fmtBuiltFor=ref;
      if(!ref){
        var p0=document.createElement('div');
        p0.className='ff-none';
        p0.textContent='Select an object on the page first \u2014 this '
          +'half describes what to find BY EXAMPLE, the same way '
          +'"select everything like this" does.';
        fmtPanel.appendChild(p0);
        return;
      }
      function head(t){menuHead(fmtPanel,t);}
      function ck(label,on){
        var l=document.createElement('label');
        l.className='find-ck';
        var b=document.createElement('input');
        b.type='checkbox';b.checked=!!on;
        l.appendChild(b);
        l.appendChild(document.createTextNode(' '+label));
        return {el:l,box:b};
      }
      /* ---- what to find ---- */
      head('find objects that are');
      var crits=[];
      SELECT_CRIT.forEach(function(c,n){
        var v=c[1](ref);
        if(v==null) return;
        /* the FIRST row (the type) starts ticked: on its own it is
           already a useful sweep, and a dialog that starts matching
           nothing reads as broken */
        var r=ck(c[2](v,ref),crits.length===0);
        crits.push({key:c[0],val:v,box:r.box});
        fmtPanel.appendChild(r.el);
        r.box.addEventListener('change',recount);
      });
      /* ---- what to change ---- */
      head('and change');
      var chs=[];
      FMT_CHANGES.forEach(function(c){
        var row=document.createElement('div');row.className='ff-row';
        var r=ck(c[1],false);
        row.appendChild(r.el);
        var inp;
        if(c[0]==='font'){
          inp=document.createElement('select');
          var o0=document.createElement('option');
          o0.value='';o0.textContent='(default)';inp.appendChild(o0);
          FONTS.forEach(function(fo){
            var o=document.createElement('option');
            o.value=fo.id;o.textContent=fo.label;inp.appendChild(o);});
          inp.value=ref.font||'';
        } else if(c[0]==='size'){
          inp=document.createElement('input');
          inp.type='number';inp.min='6';inp.max='240';
          inp.value=String(Math.round((ref.size||2.6)*5.4));
        } else {
          inp=document.createElement('input');
          inp.type='color';
          inp.value=/^#[0-9a-f]{6}$/i.test(ref.color||'')
            ?ref.color:'#ffffff';
        }
        inp.className='ff-in';
        row.appendChild(inp);
        fmtPanel.appendChild(row);
        chs.push({key:c[0],kinds:c[2],write:c[3],box:r.box,inp:inp});
        r.box.addEventListener('change',recount);
      });
      /* ---- over what ---- */
      head('over');
      var scope=document.createElement('select');
      scope.className='ff-in';scope.style.width='100%';
      [['deck','The whole deck'],['slide','This slide only']]
        .forEach(function(o){
          var e=document.createElement('option');
          e.value=o[0];e.textContent=o[1];scope.appendChild(e);});
      scope.addEventListener('change',recount);
      fmtPanel.appendChild(scope);
      /* ---- the count, and the button ---- */
      var foot=document.createElement('div');foot.className='find-foot';
      var cnt=document.createElement('span');cnt.className='find-count';
      foot.appendChild(cnt);
      var spring=document.createElement('span');
      spring.className='deck-spring';foot.appendChild(spring);
      var go=document.createElement('button');
      go.className='dbtn';go.textContent='Change them';
      foot.appendChild(go);
      fmtPanel.appendChild(foot);
      function picked(){
        return crits.filter(function(c){return c.box.checked;})
          .map(function(c){return {key:c.key,val:c.val};});
      }
      function edits(){
        return chs.filter(function(c){return c.box.checked;});
      }
      function recount(){
        var crit=picked();
        var hitn=crit.length?sweep(crit,scope.value):[];
        var sl={};hitn.forEach(function(h){sl[h.si]=1;});
        var ns=Object.keys(sl).length;
        cnt.textContent=!crit.length
          ?'tick what to find'
          :hitn.length
            ?(hitn.length+' object'+(hitn.length===1?'':'s')
              +' on '+ns+' slide'+(ns===1?'':'s'))
            :'nothing matches';
        go.disabled=!hitn.length||!edits().length;
      }
      go.addEventListener('click',function(){
        var crit=picked(),ed=edits();
        if(!crit.length||!ed.length) return;
        var hitn=sweep(crit,scope.value);
        var n=0;
        hitn.forEach(function(h){
          var did=false;
          ed.forEach(function(c){
            /* a field that means nothing for this kind is not written:
               a `size` on a shape would be a junk key that every export
               then has to ignore */
            if(c.kinds.indexOf(h.a.k)<0) return;
            var v=(c.key==='size')?(+c.inp.value||0):c.inp.value;
            if(c.key==='size'&&!(v>0)) return;
            c.write(h.a,v);did=true;
          });
          if(did) n++;
        });
        if(!n){toast('Nothing to change \u2014 those fields mean '
          +'nothing for what you matched');return;}
        markDirty();refresh();
        toast('Changed '+n+' object'+(n===1?'':'s'));
        fmtBuild();
      });
      recount();
    }
    /* showFmt runs for every real selection change, but also for hover
       previews and continuous gestures that reselect the SAME object.
       Rebuilding for those would erase the criteria and edits a person
       has already ticked into this non-modal popover. */
    function fmtSync(){
      if(pop.hidden||mode!=='fmt') return;
      if(fmtRef()===fmtBuiltFor) return;
      fmtBuild();
    }
    function setMode(m){
      mode=m;
      $$('#find-pop [data-fmode]').forEach(function(el){
        el.hidden=(el.getAttribute('data-fmode')!==m);});
      if(fmtPanel) fmtPanel.hidden=(m!=='fmt');
      var bt=$('#find-m-text'),bf=$('#find-m-fmt');
      if(bt){bt.classList.toggle('on',m==='text');
        bt.setAttribute('aria-selected',String(m==='text'));}
      if(bf){bf.classList.toggle('on',m==='fmt');
        bf.setAttribute('aria-selected',String(m==='fmt'));}
      if(m==='fmt') fmtBuild();
    }
    (function(){
      var bt=$('#find-m-text'),bf=$('#find-m-fmt');
      if(bt) bt.addEventListener('click',function(){setMode('text');});
      if(bf) bf.addEventListener('click',function(){setMode('fmt');});
    })();
    function open(){
      pop.hidden=false;
      /* a re-open re-reads the selection: the whole find half is
         seeded by example, and a stale example is worse than none */
      if(mode==='fmt') fmtBuild();
      /* seed from whatever text box you had selected — the thing you were
         looking at is usually the thing you want to find */
      qi.focus();qi.select();
      scan();
    }
    function close(){pop.hidden=true;at=-1;}
    [qi,ri].forEach(function(el){
      el.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter'){e.preventDefault();
          if(el===ri) replaceOne(); else step(e.shiftKey?-1:1);}
        else if(e.key==='Escape'){e.preventDefault();close();}
      });
    });
    qi.addEventListener('input',function(){at=-1;scan();});
    [ckCase,ckWord].forEach(function(c){
      c.addEventListener('change',function(){at=-1;scan();});});
    $('#find-next').addEventListener('click',function(){step(1);});
    $('#find-prev').addEventListener('click',function(){step(-1);});
    $('#find-rep').addEventListener('click',replaceOne);
    $('#find-repall').addEventListener('click',replaceAll);
    $('#find-close').addEventListener('click',close);
    /* ONE door: the top bar (or Ctrl+F). The ribbon copy is gone */
    ['#qat-find'].forEach(function(sel){
      var b=$(sel);
      if(b) b.addEventListener('click',function(){
        if(pop.hidden) open(); else close();});
    });
    window.SemDeckFind=open;       /* the Ctrl+F binding, below */
    window.SemDeckFindSync=fmtSync;/* selection bridge from showFmt */
  })();

  /* ---------- tabs opened / closed while the page lives ---------- */
  document.addEventListener('sem:shell',function(e){
    if(e.detail.replaced){
      /* the notebook was reloaded: what every frame showed until now
         becomes the "previous figure" it can revert to */
      var pfx=e.detail.stem+'::';
      Object.keys(frameSnaps).forEach(function(k){
        if(k.indexOf(pfx)===0){
          frameSnapsPrev[k]=frameSnaps[k];delete frameSnaps[k];}
      });
    }
    /* invalidation point 1 (see frameNodeCache): the notebook's cards
       changed (reload) or just became the live source (fresh open) —
       cached frame nodes for this stem must rebuild, which also refills
       frameSnaps for the next revert */
    dropFrameCache(e.detail.stem);
    registerShell(e.detail.stem,e.detail.data||{});
    if(source==='auto'&&(!pres.slides||!pres.slides.length))
      pres=defaultPres();
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });
  document.addEventListener('sem:shellclosed',function(e){
    /* invalidation point 2: frames fall back to the embedded copy */
    dropFrameCache(e.detail.stem);
    unregisterShell(e.detail.stem);
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });

  /* embedded card snapshots from earlier sessions (IndexedDB, per scope):
     without this, a deck imported from a self-contained file kept its
     figures only until the tab closed — the drafts it left behind are
     refs-only by design, so the next session opened to empty frames. A
     copy absorbed THIS session is fresher and is never overwritten. */
  idbGet('emb:'+SCOPE).then(function(m){
    if(!m||typeof m!=='object') return;
    var added=0;
    Object.keys(m).forEach(function(k){
      var e=m[k];
      if(EMBED[k]||!e||typeof e.html!=='string'||!e.html) return;
      embStore(k,e);added++;
    });
    if(!added) return;
    if(!deckEl.hidden) refresh(); else renderPresTabs();
  }).catch(function(){});
