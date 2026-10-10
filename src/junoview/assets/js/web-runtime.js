/* The generated application is already on the page. This bridge is
   installed before app.js -- build_web writes it INTO the page's <head>,
   where a separate file cost a round trip before the body could parse --
   and accepts imports while Python starts.

   PYTHON STARTS WHEN IT IS WANTED, NOT FROM <head> (2026-10-09 speed pass,
   load-static #2). The worker used to be created here, before the body
   was even parsed, and its ~7 MB of Pyodide downloaded alongside the
   page's own files: on a 9 Mbps link the welcome screen could not be
   clicked for 5.3 s, and on any link the first seconds belonged to a
   parser most visits had not asked for yet. Now it starts on the first
   thing that needs it -- any call below, or the page saying a notebook
   is about to be opened (semPy.start: the Open dialog, a file dragged
   over the window) -- and otherwise once the page has loaded and gone
   quiet, so it is usually ready before the first file arrives. Calls
   made before it is ready queue exactly as they always did. */
(function(){
  var jobs=new Map(),serial=0,worker=null,failure=null,started=false;
  var holds=0,idleDue=false;
  var resolveReady,rejectReady;
  var ready=new Promise(function(resolve,reject){resolveReady=resolve;rejectReady=reject;});
  ready.catch(function(){});
  function fail(error){
    failure=error instanceof Error?error:new Error(String(error));
    rejectReady(failure);
    jobs.forEach(function(job){job.reject(failure);});jobs.clear();
    if(worker) worker.terminate();
  }
  function start(){
    if(started) return;
    started=true;
    try{
      worker=new Worker('web-worker.js');
      worker.onmessage=function(event){
        var msg=event.data;
        if(msg.type==='ready'){
          resolveReady();document.dispatchEvent(new Event('sem:pyready'));return;
        }
        if(msg.type==='fatal'){fail(new Error(msg.error));return;}
        var job=jobs.get(msg.id);if(!job) return;jobs.delete(msg.id);
        if(msg.error) job.reject(new Error(msg.error));else job.resolve(msg.result);
      };
      worker.onerror=function(e){fail(new Error(e.message||'The reader could not start. Reload to retry.'));};
      worker.onmessageerror=function(){fail(new Error('Could not receive the reader result. Reload to retry.'));};
    }catch(e){fail(e);}
  }
  function call(method,name,text,taken){
    start();
    if(failure) return Promise.reject(failure);
    return new Promise(function(resolve,reject){
      var id=++serial;jobs.set(id,{resolve:resolve,reject:reject});
      try{worker.postMessage({id:id,method:method,name:name,text:text,taken:taken||[]});}
      catch(e){jobs.delete(id);reject(e);}
    });
  }
  /* The page can ask the quiet-time start to wait while it downloads
     something the visitor is waiting for (the example, already rendered):
     on a slow link 7 MB of Pyodide would share the line with it. A
     call, or start(), still starts Python at once. */
  function hold(){
    holds++;
    var done=false,timer;
    function release(){
      if(done) return;
      done=true;holds--;clearTimeout(timer);
      if(!holds&&idleDue) start();
    }
    /* a download that never ends must not keep Python waiting forever */
    timer=setTimeout(release,15000);
    return release;
  }
  window.semPy={ready:ready,start:start,hold:hold,
    parse:function(name,text,taken){return call('parse',name,text,taken);},
    parseB64:function(name,text,taken){return call('parseB64',name,text,taken);},
    importPptx:function(name,text){return call('importPptx',name,text);}
  };
  /* once the page has loaded, at its first quiet moment: what nobody
     has asked for yet waits until the page itself is done */
  function settled(fn){
    function idle(){
      if(window.requestIdleCallback) window.requestIdleCallback(fn,{timeout:4000});
      else setTimeout(fn,200);
    }
    if(document.readyState==='complete') idle();
    else window.addEventListener('load',idle);
  }
  settled(function(){idleDue=true;if(!holds) start();});
  window.__jvBuild='__JV_VERSION__';
  window.__jvUpdateBar=function(){
    if(document.getElementById('jv-newbuild')||!document.body) return;
    var bar=document.createElement('div');bar.id='jv-newbuild';
    bar.setAttribute('role','status');
    bar.style.cssText='position:fixed;left:50%;top:10px;transform:translateX(-50%);'
      +'z-index:100000;display:flex;align-items:center;gap:12px;padding:8px 14px;'
      +'border-radius:10px;background:#123;color:#e8f1f8;border:1px solid #39a9c0;'
      +'font:13px system-ui,sans-serif;';
    var text=document.createElement('span');text.textContent='A newer Junoview is available.';
    var reload=document.createElement('button');reload.textContent='Reload';
    reload.addEventListener('click',function(){location.reload();});
    var later=document.createElement('button');later.textContent='Later';
    later.addEventListener('click',function(){bar.remove();});
    bar.appendChild(text);bar.appendChild(reload);bar.appendChild(later);
    document.body.appendChild(bar);
  };
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();window.__jvInstall=e;
  });
  if('serviceWorker' in navigator){
    var hadWorker=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(!hadWorker) return;
      window.__jvNewBuild=true;window.__jvUpdateBar();
    });
    /* THE OFFLINE COPY, IN TWO HALVES. The service worker is registered
       once the page has loaded (it used to wait for Python, which now
       starts late itself) and installs only the app: the page and its
       files, all just downloaded. The heavy half -- the Python runtime,
       MathJax, the example -- is asked for once Python is up: the page's
       own downloads are done by then, and the runtime, the biggest part,
       is already in the browser's cache; along with it go the pinned
       runtime files this visit actually used (Plotly, say), so a deck
       that drew one presents offline. The worker answers when the copy
       is complete, and only then does the page say it works offline
       (sem:offline, window.__jvOffline). */
    settled(function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
    ready.then(function(){return navigator.serviceWorker.ready;}).then(function(reg){
      if(!reg||!reg.active||typeof MessageChannel!=='function') return;
      var used=[];
      try{
        used=performance.getEntriesByType('resource').map(function(e){return e.name;});
      }catch(e){}
      var ch=new MessageChannel();
      ch.port1.onmessage=function(event){
        var msg=event.data||{};
        if(msg.type!=='warmed'||!msg.ok) return;
        window.__jvOffline=true;
        document.dispatchEvent(new Event('sem:offline'));
      };
      reg.active.postMessage({type:'warm',used:used},[ch.port2]);
    }).catch(function(){});
  }
})();
