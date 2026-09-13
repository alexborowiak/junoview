  /* ---- T388: A LIVE WEB PAGE ON A SLIDE --------------------------------
     (2026-09-12, user: "maybe web page view, where you can put a full
     interactive website on there"). An object of kind `web` carries a
     URL and is drawn as a sandboxed iframe: live in the show and in an
     exported page, covered by a label while editing so the box can be
     picked up and moved (an iframe eats the pointer). Only http(s)
     addresses are accepted -- a deck is a document you hand to people,
     and an address is the only thing of the page that is stored. The
     sandbox lets the page run and talk to its own origin, and nothing
     else: it cannot navigate this window or open one without asking.

     PowerPoint has no shape for a live page; the export says so and
     counts it, the way it counts placed cells it cannot draw. */
  var WEB_SANDBOX='allow-scripts allow-same-origin allow-forms allow-popups '
    +'allow-popups-to-escape-sandbox';
  function webUrlOk(u){
    return /^https?:\/\/[^\s]+$/i.test(String(u||'').trim());
  }
  function webHost(u){
    var m=String(u||'').match(/^https?:\/\/([^\/?#]+)/i);
    return m?m[1]:String(u||'');
  }
  function askWebUrl(current){
    var u=window.prompt('Web address (http or https):',current||'https://');
    if(u==null) return null;
    u=String(u).trim();
    if(!webUrlOk(u)){toast('That is not an http or https address');return null;}
    return u;
  }
  function placeWebPage(url){
    var s=pres.slides[cur]; if(!s) return;
    s.annots=s.annots||[];
    var a={k:'web',x:10,y:16,w:80,h:70,url:url};
    s.annots.push(a);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
    if(typeof renderFilm==='function') renderFilm();
    toast('Web page placed — it is live in the show. Change the '
      +'address from the Object tab');
  }
  function webBoot(){
    var et=$('#et-web');
    if(et) et.addEventListener('click',function(e){
      e.stopPropagation();
      var u=askWebUrl(''); if(u) placeWebPage(u);
    });
    var fb=$('#fmt-weburl');
    if(fb) fb.addEventListener('click',function(e){
      e.stopPropagation();
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      if(!a||a.k!=='web') return;
      var u=askWebUrl(a.url||''); if(!u||u===a.url) return;
      fmtApply(function(x){if(x.k==='web') x.url=u;});
    });
  }
