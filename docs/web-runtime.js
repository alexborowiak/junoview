/* The generated application is already on the page. This bridge is
   installed before app.js and accepts imports while Python starts. */
(function(){
  var jobs=new Map(),serial=0,worker=null,failure=null;
  var resolveReady,rejectReady;
  var ready=new Promise(function(resolve,reject){resolveReady=resolve;rejectReady=reject;});
  ready.catch(function(){});
  function fail(error){
    failure=error instanceof Error?error:new Error(String(error));
    rejectReady(failure);
    jobs.forEach(function(job){job.reject(failure);});jobs.clear();
    if(worker) worker.terminate();
  }
  function call(method,name,text,taken){
    if(failure) return Promise.reject(failure);
    return new Promise(function(resolve,reject){
      var id=++serial;jobs.set(id,{resolve:resolve,reject:reject});
      try{worker.postMessage({id:id,method:method,name:name,text:text,taken:taken||[]});}
      catch(e){jobs.delete(id);reject(e);}
    });
  }
  window.semPy={ready:ready,
    parse:function(name,text,taken){return call('parse',name,text,taken);},
    parseB64:function(name,text,taken){return call('parseB64',name,text,taken);},
    importPptx:function(name,text){return call('importPptx',name,text);}
  };
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
  window.__jvBuild='e0ea1f00b829';
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
    /* Populate the offline cache after the reader's critical downloads,
       so first-visit font/Plotly precaching cannot crowd them out. */
    ready.then(function(){
      return navigator.serviceWorker.register('sw.js');
    }).catch(function(){});
  }
})();
