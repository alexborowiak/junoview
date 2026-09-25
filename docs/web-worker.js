/* Parsing runs here so a large notebook cannot block editor input or
   animation. Only stored notebook outputs are read; no cells execute. */
var PYODIDE_BASE='https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
var ready=(async function(){
  var packageBytes=fetch('junoview.zip').then(function(r){
    if(!r.ok) throw new Error('Could not load the reader (HTTP '+r.status+')');
    return r.arrayBuffer();
  });
  packageBytes.catch(function(){});
  importScripts(PYODIDE_BASE+'pyodide.js');
  var py=await loadPyodide({indexURL:PYODIDE_BASE});
  py.unpackArchive(await packageBytes,'zip');
  py.runPython('import junoview as sr');
  self.postMessage({type:'ready'});
  return py;
})();
ready.catch(function(e){self.postMessage({type:'fatal',error:String(e.message||e)});});
var queue=ready;
self.onmessage=function(event){
  var job=event.data;
  /* Python globals belong to exactly one request at a time. A failed
     document must not poison the next request in the queue. */
  queue=queue.catch(function(){return ready;}).then(function(py){
    try{
      var methods={parse:'web_parse',parseB64:'web_parse_b64',
        importPptx:'web_import_pptx_b64'};
      if(!Object.prototype.hasOwnProperty.call(methods,job.method))
        throw new Error('Unknown reader operation');
      py.globals.set('_wname',String(job.name));
      py.globals.set('_wtext',String(job.text));
      py.globals.set('_wtaken',JSON.stringify(job.taken||[]));
      var args=job.method==='importPptx'?'_wname,_wtext':'_wname,_wtext,_wtaken';
      var result=py.runPython('sr.'+methods[job.method]+'('+args+')');
      self.postMessage({id:job.id,result:result});
    }catch(e){self.postMessage({id:job.id,error:String(e.message||e)});}
    return py;
  });
  queue.catch(function(){});
};
