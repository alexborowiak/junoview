/* saved-file.js -- the script a saved presentation file carries (T597).

   A .junoview.html is a real page (2026-08-18), so the OS opens it in a
   browser. It used to stop there: the page said what it was and told you
   to go and open Junoview yourself, and "why can't it be opened?"
   (2026-09-30, user) was the fair reply. This is the other half. Open in
   Junoview opens the Junoview the file was saved from -- or the one on
   the web -- in a new tab, waits for that tab to say it is Junoview and
   ready, and hands it the presentation this file holds. The tab opens it
   through the same importer as File > Open, after asking.

   It is carried INSIDE every saved file, so it knows nothing about the
   deck model and asks nothing of the page but three ids: #jv-open (the
   button), #jv-open-msg (what is happening) and the two JSON blocks,
   #junoview-open (where to open it) and #junoview-data (the deck). It
   runs from file://, so: ES5, no fetch, no storage -- window.open and
   postMessage, and the deck goes nowhere but the tab you asked for, and
   only to that tab's own origin when it has one.

   The app pages embed this file as inert text (#jv-savedfile-js) and the
   save writes it into the file; nothing in the app runs it. */
(function(){
  'use strict';
  function $(id){return document.getElementById(id);}
  var cfg={};
  try{cfg=JSON.parse(($('junoview-open')||{}).textContent||'{}')||{};}
  catch(e){cfg={};}
  var data=$('junoview-data'),btn=$('jv-open'),msg=$('jv-open-msg');
  var next=$('jv-open-next'),shut=$('jv-open-close');
  if(!data||!btn||!msg) return;

  /* where to try, in order: the Junoview this was saved from, then the
     one on the web. A file saved from a page opened off disk has a
     file: address, which a new tab can still open. */
  var targets=[];
  function add(u){
    u=String(u||'').split('#')[0];
    if(/^(https?|file):/i.test(u)&&targets.indexOf(u)<0) targets.push(u);
  }
  add(cfg.app);add(cfg.web);

  /* the name this file has NOW -- it may have been renamed since it was
     saved, and the name it was saved under is the fallback */
  function ownName(){
    var n=String(location.pathname||'').split('/').pop()||'';
    try{n=decodeURIComponent(n);}catch(e){}
    return /\.html?$/i.test(n)?n:String(cfg.file||'');
  }
  var at=-1,win=null,sent=false,timer=null;
  function say(t,kind){
    msg.textContent=t;
    msg.className='jv-msg'+(kind?' jv-'+kind:'');
  }
  function show(el,on){if(el) el.hidden=!on;}
  function host(u){
    var m=/^https?:\/\/([^\/?#]+)/i.exec(u||'');
    return m?m[1]:'this computer';
  }
  /* the deck is posted to the origin that was opened and nowhere else;
     a file: page has no origin to name, so it can only be '*' */
  function originOf(u){
    var m=/^(https?:\/\/[^\/?#]+)/i.exec(u||'');
    return m?m[1]:'*';
  }
  function open(i){
    var u=targets[i]; if(!u) return;
    at=i;sent=false;
    show(next,false);show(shut,false);
    try{win=window.open(u+'#junoview-handoff','_blank');}
    catch(e){win=null;}
    if(!win){
      say('The browser stopped the new tab opening. Allow pop-ups for '
        +'this file, then press Open in Junoview again.','warn');
      return;
    }
    say('Opening Junoview at '+host(u)+'…');
    clearTimeout(timer);
    timer=setTimeout(function(){
      if(sent) return;
      say('Junoview did not answer at '+host(u)+'.','warn');
      offerNext();
    },20000);
  }
  function offerNext(){
    if(!next) return;
    var u=targets[at+1];
    if(!u){show(next,false);return;}
    next.textContent='Open it in Junoview at '+host(u)+' instead';
    show(next,true);
  }
  btn.addEventListener('click',function(){open(at>=0?at:0);});
  if(next) next.addEventListener('click',function(){open(at+1);});
  if(shut) shut.addEventListener('click',function(){
    window.close();
    /* a tab the browser will not let a page close stays; say so */
    setTimeout(function(){
      say('This tab can be closed now (Ctrl+W, or \u2318W on a Mac).','ok');
      show(shut,false);
    },300);
  });

  window.addEventListener('message',function(e){
    if(!win||e.source!==win) return;
    var d=e.data||{};
    if(d.junoview==='ready'&&!sent){
      sent=true;clearTimeout(timer);show(next,false);
      win.postMessage({junoview:'deck',text:data.textContent,
        file:ownName(),path:String(location.href||'')},
        originOf(targets[at]));
      say('Junoview is open in the next tab — it asks there before it '
        +'opens “'+(cfg.name||'this presentation')+'”.');
    } else if(d.junoview==='opened'){
      say('Opened in Junoview. This tab has done its job.','ok');
      show(shut,true);
    } else if(d.junoview==='declined'){
      say('Not opened — Junoview was told no. Press Open in Junoview '
        +'to ask again.');
    }
  });
})();
