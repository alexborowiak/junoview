  /* ================================================================
     62-pptx-import.js — POWERPOINT IN (T320)

     ONE FRAGMENT of deck.js's single IIFE: assets.DECK_PARTS names the
     order, 00-page.js opens the function and 99-boot.js closes it. It
     does not parse alone; check the ASSEMBLED file.

     The reader is Python (notebook/pptx_read.py -- the same stdlib
     zipfile + ElementTree that reads a workbook) and it answers in the
     spec pptx.js WRITES, so the round trip is one seam and one test can
     drive a deck out and back. This file turns that spec into slides
     (specToPres), settles the pictures into the original store the way
     a paste does, says what was lost BEFORE the deck lands (the export
     dialog's twin), and opens the doors: File ▸ Import PowerPoint, the
     launcher's New ▸ Import a PowerPoint file, a .pptx dropped on the
     window, a .pptx row or path in the Open dialog, and a .pptx URL in
     the web build.

     A rendered export has no Python behind it, so there the door says
     so rather than pretending. Nothing here runs at load time:
     pptxImportBoot() is called from THE BOOT SEQUENCE. */

  /* ---- SPEC -> PRES ------------------------------------------------ */
  var PPT_HEADS={triangle:'triangle',stealth:'stealth',arrow:'open',
    diamond:'diamond',oval:'oval',none:'none'};
  var PPT_DASH={solid:'solid',dash:'dash',sysDot:'dot',dashDot:'dashdot',
    lgDash:'lgdash'};
  /* PowerPoint's typeface names back onto the picker's ids. A name the
     picker does not know is used as typed, which a.font already allows;
     Calibri is what the deck's own sans exports as, so it stays unset
     and follows the deck. */
  function pptFontId(name){
    var nm=String(name||'').trim();
    if(!nm) return '';
    var low=nm.toLowerCase(),hit='';
    FONTS.forEach(function(f){if(!hit&&f.id===low) hit=f.id;});
    if(!hit) FONTS.forEach(function(f){
      if(hit||f.id==='sans'||f.id==='serif'||f.id==='mono'
         ||f.id==='system') return;
      if(String(f.ppt).toLowerCase()===low) hit=f.id;
    });
    if(hit==='calibri') return '';
    return hit||nm;
  }
  /* the page preset nearest the deck's own size, by aspect ratio; a
     size that is not one of ours is reported, not silently reshaped */
  function pptPagePreset(wmm,hmm){
    var r=(wmm||339)/(hmm||191),best=null,bd=Infinity;
    PAGE_PRESETS.forEach(function(p){
      var d=Math.abs(Math.log(r/(p.mm[0]/p.mm[1])));
      if(d<bd){bd=d;best=p;}
    });
    return {id:best?best.id:'16x9',label:best?best.label:'',off:bd>0.02};
  }
  function pptEsc(s){
    return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }
  /* one run as rich HTML, wearing only what the whole box does not */
  function pptRunHtml(r,box){
    var h=pptEsc(r.t).replace(/\n/g,'<br>');
    if(!h) return '';
    if(r.b&&!box.b) h='<b>'+h+'</b>';
    if(r.i&&!box.i) h='<i>'+h+'</i>';
    if(r.u&&!box.u) h='<u>'+h+'</u>';
    if(r.strike&&!box.strike) h='<s>'+h+'</s>';
    if(r.color&&r.color!==(box.color||''))
      h='<span style="color:'+r.color+'">'+h+'</span>';
    return h;
  }
  /* a text item -> a text annot. PLAIN when every run agrees with the
     box; RICH (a.html) when bold, italic, colour or bullets differ
     inside it, which is the deck's own model for exactly that
     (sanitizeRich, listOf) -- so "then bold and red" stays bold and red
     and stays editable, rather than arriving as Markdown source. */
  function pptTextAnnot(it){
    var a={k:'text',x:it.x,y:it.y,w:it.w,h:it.h,
      text:String(it.text||''),size:it.sizePct||2.6};
    if(it.color) a.color=it.color;
    if(it.b) a.b=1;
    if(it.i) a.i=1;
    if(it.u) a.u=1;
    if(it.strike) a.strike=1;
    if(it.align==='center'||it.align==='right') a.align=it.align;
    var f=pptFontId(it.font);
    if(f) a.font=f;
    if(it.bgc) a.bgc=it.bgc;
    var paras=(it.paras||[]).filter(function(p){
      return p&&Array.isArray(p.runs);});
    var full=paras.filter(function(p){
      return p.runs.some(function(r){return String(r.t||'').trim();});});
    var allList=!!full.length&&full.every(function(p){return p.bullet;});
    var anyList=full.some(function(p){return p.bullet;});
    var rich=paras.some(function(p){
      return p.runs.some(function(r){
        return (!!r.b!==!!it.b)||(!!r.i!==!!it.i)||(!!r.u!==!!it.u)
          ||(!!r.strike!==!!it.strike)
          ||((r.color||'')!==(it.color||''));
      });
    });
    function line(p){
      return p.runs.map(function(r){return pptRunHtml(r,it);}).join('');
    }
    function plain(p){
      return p.runs.map(function(r){return String(r.t||'');}).join('');
    }
    if(allList){
      a.list=full.every(function(p){return p.num;})?'number':'bullet';
      a.html=full.map(function(p){
        return '<li>'+(line(p)||'<br>')+'</li>';}).join('');
      a.text=full.map(plain).join('\n');
    } else if(rich||anyList){
      /* a box that is part bullets, part not: the marker is a
         character, because one box is a list or it is not */
      a.html=paras.map(function(p){
        return (p.bullet?'• ':'')+line(p);}).join('<br>');
      if(anyList) a.text=paras.map(function(p){
        return (p.bullet?'• ':'')+plain(p);}).join('\n');
    }
    /* a link on words inside the box: the box takes the first one */
    var href='';
    paras.forEach(function(p){p.runs.forEach(function(r){
      if(!href&&r.href) href=String(r.href);});});
    if(href&&!it.link) a.link={to:'url',href:href};
    return a;
  }
  /* line weight arrives as a percentage of the page height, the same
     currency the writer uses; a.sw is pixels on a 720px page */
  function pptSw(pct,noline){
    if(noline) return 0.5;
    var v=(pct||0)/100*SW_REF_H;
    return Math.max(0.5,Math.round(v*10)/10);
  }
  function pptAnnot(it,sids){
    if(!it||!it.t) return null;
    var a=null,st;
    if(it.t==='text'){
      a=pptTextAnnot(it);
    } else if(it.t==='rect'){
      a={k:'rect',x:it.x,y:it.y,w:it.w,h:it.h,shape:it.shape||'rect',
        color:it.color||'#000000',sw:pptSw(it.swPct,it.noline)};
      if(it.grad){a.fill=1;a.grad=it.grad;}
      else if(it.fill){a.fill=1;a.fillc=it.fill;}
      st=PPT_DASH[it.dash];
      if(st&&st!=='solid') a.style=st;
    } else if(it.t==='video'){
      /* T321: the bytes ride on `src` until pptxSettleImages moves them
         into the media store and leaves a vkey behind */
      if(!it.src) return null;
      a={k:'video',x:it.x,y:it.y,w:it.w,h:it.h,src:it.src,
        mime:it.mime||'',poster:it.poster||''};
      if(it.audio) a.audio=1;
      if(!it.name&&it.clipName)
        a.name=String(it.clipName).replace(/\.[A-Za-z0-9]+$/,'');
      if(it.alt) a.alt=String(it.alt);
    } else if(it.t==='image'){
      if(!it.src) return null;
      a={k:'image',x:it.x,y:it.y,w:it.w,h:it.h,src:it.src};
      if(it.alt) a.alt=String(it.alt);
      if(it.crop) a.crop={l:+it.crop.l||0,t:+it.crop.t||0,
        r:+it.crop.r||0,b:+it.crop.b||0};
    } else if(it.t==='line'){
      a={k:'arrow',x1:it.x1,y1:it.y1,x2:it.x2,y2:it.y2,
        color:it.color||'#000000',sw:pptSw(it.swPct),
        head:PPT_HEADS[it.head]||'none',tail:PPT_HEADS[it.tail]||'none',
        hsz:it.hsz||'md'};
      if(it.curve) a.curve=1;
      if(it.bend) a.bend=1;
      st=PPT_DASH[it.dash];
      if(st&&st!=='solid') a.style=st;
    } else if(it.t==='draw'){
      if(!it.pts||it.pts.length<2) return null;
      a={k:'draw',x:it.x,y:it.y,w:it.w,h:it.h,pts:it.pts,
        color:it.color||'#000000',sw:pptSw(it.swPct)};
      st=PPT_DASH[it.dash];
      if(st&&st!=='solid') a.style=st;
    } else if(it.t==='table'){
      if(!it.rows||!it.rows.length) return null;
      a={k:'table',x:it.x,y:it.y,w:it.w,h:it.h,rows:it.rows,grid:1,
        size:it.sizePct||1.6};
      if(it.cols&&it.cols.length===it.rows[0].length) a.cols=it.cols;
      if(it.thead) a.thead=1;
      if(it.color) a.color=it.color;
    } else if(it.t==='chart'){
      if(!it.series||!it.series.length) return null;
      a={k:'chart',x:it.x,y:it.y,w:it.w,h:it.h,ct:it.ct||'bar',
        cats:it.cats||[],series:it.series.map(function(se){
          var o={name:String(se.name||''),ys:se.ys||[]};
          if(se.color) o.color=se.color;
          return o;})};
      if(it.title) a.title=String(it.title);
      if(it.leg===false) a.leg=0;
    }
    if(!a) return null;
    if(it.rot&&a.k!=='arrow') a.rot=it.rot;
    if(it.op!=null&&it.op<1) a.op=it.op;
    if(it.name) a.name=String(it.name);
    if(it.link&&it.link.to==='url'&&it.link.href)
      a.link={to:'url',href:String(it.link.href)};
    else if(it.link&&it.link.to==='slide'&&sids[it.link.si])
      a.link={to:'slide',sid:sids[it.link.si]};
    /* builds: the click each shape arrives on, exactly as PowerPoint
       had it, and the click it leaves on (T174's `out`) */
    if(it.animStep!=null){
      a.anim={type:it.animType||'fade',order:it.animStep};
      if(it.animBy==='para'&&a.k==='text') a.anim.by='para';
      if(it.after) a.anim.after=it.after|0;
    }
    if(it.outStep!=null) a.out=it.outStep;
    return a;
  }
  /* the whole spec -> a plain presentation object, ready for normPres.
     `lost` is appended to: the page size is the one thing the reader
     cannot know about, because the presets are this file's. */
  function specToPres(spec,name,lost){
    lost=lost||[];
    var pg=pptPagePreset(spec.widthMm,spec.heightMm);
    if(pg.off) lost.push('a '+Math.round(spec.widthMm||0)+'×'
      +Math.round(spec.heightMm||0)+' mm page — shown at the nearest '
      +'of this editor’s page sizes ('+pg.label+')');
    var nm=String(name||spec.title||'presentation')
      .replace(/\.[A-Za-z0-9]+$/,'');
    var pr={name:nm||'presentation',page:pg.id,slides:[]};
    if(spec.bg) pr.pageBg=spec.bg;
    var sids=(spec.slides||[]).map(function(_,i){return 'ppt'+(i+1);});
    var secIds={},secs={},nsec=0;
    (spec.slides||[]).forEach(function(sl,i){
      var s={layout:'blank',annots:[],sid:sids[i]};
      if(sl.bg&&sl.bg!==pr.pageBg) s.bg=sl.bg;
      if(sl.notes) s.notes=String(sl.notes);
      if(sl.trans) s.trans=sl.trans;
      if(sl.hidden) s.opt=1;
      if(sl.section){
        if(!secIds[sl.section]){
          nsec++;secIds[sl.section]='ps'+nsec;
          secs[secIds[sl.section]]={name:String(sl.section)};
        }
        s.sec=secIds[sl.section];
      }
      (sl.items||[]).forEach(function(it){
        var a=pptAnnot(it,sids);
        if(a) s.annots.push(a);
      });
      pr.slides.push(s);
    });
    if(nsec) pr.sections=secs;
    return pr;
  }

  /* ---- LANDING IT --------------------------------------------------- */
  /* what this import will cost, said before it happens -- the export
     dialog's twin (pptxConfirmLosses). Nothing to lose means no dialog. */
  function pptxConfirmImport(name,lost){
    if(!lost.length) return true;
    return confirm('Import “'+name+'” from PowerPoint?\n\n'
      +'Everything else comes across, but this will not:\n\n• '
      +lost.join('\n• ')
      +'\n\nThe .pptx itself is not changed.');
  }
  /* every picture settles the way a pasted one does: a display copy on
     the slide, the full bytes in the original store (T58), so the deck
     stays small and a re-export gets the real pixels back */
  function pptxSettleImages(pr){
    var jobs=[];
    (pr.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(a&&a.k==='video'&&a.src){
          /* T321: into the store, off the item; the probe fills in what
             the .pptx did not say (length, and a poster if none came) */
          var key=mediaKeyNew(),vsrc=a.src,kind=a.audio?'audio':'video';
          mediaPut(key,{src:vsrc,mime:String(a.mime||''),
            name:String(a.name||'')});
          a.vkey=key;delete a.src;delete a.mime;
          jobs.push(mediaProbe(vsrc,kind).then(function(info){
            if(info.dur) a.dur=Math.round(info.dur*100)/100;
            if(!a.poster&&info.poster) a.poster=info.poster;
          }).catch(function(){}));
          if(a.poster) jobs.push(shrinkDataUrl(a.poster).then(function(sm){
            if(sm) a.poster=sm;}).catch(function(){}));
          return;
        }
        if(!a||a.k!=='image'||!a.src) return;
        var full=a.src;
        jobs.push(shrinkDataUrl(full).then(function(small){
          if(!small||small===full) return null;
          a.src=small;
          var k=okeyNew();
          return idbPut(k,full).then(function(){a.okey=k;})
            .catch(function(){});
        }).catch(function(){}));
      });
    });
    return Promise.all(jobs);
  }
  function importPptxSpec(got,name){
    if(!got||!got.spec||!Array.isArray(got.spec.slides)){
      toast('That file does not look like a PowerPoint deck');
      return;
    }
    var lost=(got.lost||[]).slice();
    var nm=String(name||got.name||got.spec.title||'presentation');
    var pr=specToPres(got.spec,nm,lost);
    if(!pptxConfirmImport(pr.name,lost)) return;
    pptxSettleImages(pr).then(function(){
      var n=importDeckText(JSON.stringify({presentations:[pr]}),false);
      if(!n) return;
      /* the file you opened was a .pptx; the one you will save is not,
         so the destination is "a file on your computer" the way the
         .junoview door sets it, and the first Save asks where once */
      fileHandle=null;fileName=pr.name+'.junoview.html';
      if(canPickFile) setTarget('file');
      toast('Imported '+pr.slides.length+' slide'
        +(pr.slides.length===1?'':'s')+' from '+nm
        +' — text, shapes, pictures and notes stay editable'
        +(lost.length?'. '+lost.length+' thing'
          +(lost.length===1?'':'s')+' did not come across (you saw the '
          +'list)':''),6000);
    });
  }
  function pptxFileB64(file){
    return file.arrayBuffer().then(function(buf){
      var u8=new Uint8Array(buf),out='',CH=0x8000;
      for(var i=0;i<u8.length;i+=CH)
        out+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));
      return btoa(out);
    });
  }
  /* a .pptx the browser holds: picked, dropped or fetched. The app
     hands the bytes to its server; the web build hands them to
     Pyodide; a rendered export has neither and says so. */
  function importPptxFile(file){
    if(!file) return false;
    var name=file.name||'presentation.pptx';
    var web=!!(window.semPy&&window.semPy.importPptx);
    if(APP.mode!=='app'&&!web){
      toast('PowerPoint import needs the Junoview app or the web build '
        +'— this page has no reader for a .pptx',6000);
      return true;
    }
    toast('Reading '+name+'…');
    pptxFileB64(file).then(function(b64){
      if(APP.mode==='app')
        return APP.api('/api/importpptx',{name:name,b64:b64});
      var j=window.semPy.importPptx(name,b64);
      return (typeof j==='string')?JSON.parse(j):j;
    }).then(function(got){
      importPptxSpec(got,name);
    }).catch(function(e){
      toast('Could not import '+name+': '+((e&&e.message)||e),6000);
    });
    return true;
  }
  /* a path on this computer, from the Open dialog (app only) */
  function importPptxPath(path){
    if(APP.mode!=='app'){
      toast('Opening a path needs the Junoview app');
      return;
    }
    toast('Reading '+path+'…');
    APP.api('/api/readpptx',{path:path}).then(function(got){
      importPptxSpec(got,got&&got.name||path);
    }).catch(function(e){
      toast('Could not import: '+((e&&e.message)||e),6000);
    });
  }
  function openPptxFile(){
    if(window.showOpenFilePicker){
      var accept={};
      accept['application/vnd.openxmlformats-officedocument'
        +'.presentationml.presentation']=['.pptx','.potx','.ppsx','.pptm'];
      window.showOpenFilePicker({
        types:[{description:'PowerPoint presentation',accept:accept}],
        multiple:false
      }).then(function(hs){
        var h=hs&&hs[0];
        if(h) return h.getFile().then(importPptxFile);
      }).catch(function(){});
      return;
    }
    var fi=document.getElementById('pptxfile');
    if(fi) fi.click();
  }
  /* ---- THE DOORS, from THE BOOT SEQUENCE ----------------------------- */
  function pptxImportBoot(){
    menuAction('#mi-import-pptx',openPptxFile);
    var fi=document.getElementById('pptxfile');
    if(fi) fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      this.value='';
      if(f) importPptxFile(f);
    });
    /* app.js's window drop and its Open dialog call these; the tests
       and a browser check reach the seam the same way */
    window.SemApp.deckImportPptx=importPptxFile;
    window.SemApp.deckImportPptxPath=importPptxPath;
    window.SemDeckImportPptx=importPptxFile;
    window.SemDeckImportPptxSpec=importPptxSpec;
  }
