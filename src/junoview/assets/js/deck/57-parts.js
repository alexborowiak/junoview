/* 57-parts.js — one talk made of parts: a section that shows another presentation (T601).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- PARTS: ONE TALK MADE OF OTHER PRESENTATIONS (T601) ------------
     (2026-09-30, user: "like how you can with overleaf, where you can
     have multiple documents feed into the one that are linked so you
     don't have to have them open all at once, it would be good to have
     something like this ... it would be cool if there was a view to
     have something like this.")

     Overleaf's main file says \input{methods}: methods.tex is written
     on its own, and the document shows it where that line is. Here a
     SECTION is the line. It names another presentation -- a part -- and
     its slides are that presentation's slides. The Parts view (the
     strip's view menu, File, or search "parts") shows the talk as its
     parts in order, and adds, makes, updates, unlinks and reorders them.

     1. THE SLIDES ARE COPIES KEPT UP TO DATE, not references resolved
        while drawing. Everything that reads a deck -- the strip, the
        talk, PDF, .pptx, the standalone page, the saved file, the
        Python API -- reads pres.slides and nothing else, and all of it
        works on a talk made of parts unchanged. And a talk whose part
        cannot be found (another computer, a deleted deck) still has
        every slide, as last copied.
     2. THE LINK IS ON THE SECTION: sections[id].link = {deck, sig, at}.
        A copied slide carries `lk` (the section it came with), which
        tells the part's slides from any of the talk's own that were
        put in its section. Every copied object is locked, and `lkLock`
        says the link locked it and what lock it had before, so Unlink
        gives back exactly the locks the part had.
     3. BROUGHT UP TO DATE WHEN THE TALK OPENS -- if the part changed
        since it was copied: `sig` is a hash of what was copied. If the
        copies HERE changed too (unlocked and edited, a slide deleted),
        nothing is overwritten: the Parts view says both changed, and
        Update is the answer that takes the part's.
     4. EDIT IT THERE. A part is changed in its own presentation. Edit
        opens it; while it is open the corner says which talk it is part
        of, one click back, and going back brings the talk up to date. */
  /* what a copy may differ in without being different: the names the
     editor mints, the locks, and which section / master it is filed
     under here (a master is compared by what it looks like) */
  var PART_KEYS_OFF={oid:1,sid:1,lock:1,lkLock:1,sec:1,lk:1,mast:1};
  /* session only: what the last look at each part found, by section */
  var partState={},partsDoneFor=null;
  function partLink(id){
    var d=id&&pres&&pres.sections&&pres.sections[id];
    return (d&&d.link&&typeof d.link.deck==='string'&&d.link.deck)
      ?d.link:null;
  }
  /* the section a slide came in with, while it is still one of the part's */
  function partOfSlide(s){
    return (s&&s.lk&&s.sec===s.lk&&partLink(s.lk))?s.lk:'';
  }
  function partIds(){
    return sectionRuns().filter(function(r){return r.id&&partLink(r.id);})
      .map(function(r){return r.id;});
  }
  function partHash(str){
    var h=0x811c9dc5,i;
    for(i=0;i<str.length;i++){
      h^=str.charCodeAt(i);
      h=Math.imul(h,0x01000193)>>>0;
    }
    return h.toString(36)+'.'+str.length.toString(36);
  }
  function partMastBody(m){
    var o={};
    Object.keys(m||{}).forEach(function(k){
      if(k!=='name'&&k!=='lk') o[k]=m[k];});
    return o;
  }
  /* one hash for a run of slides and the masters they wear */
  function partSig(slides,masters){
    var m=masters||{};
    return partHash(JSON.stringify((slides||[]).map(function(s){
      return [s,(s&&s.mast&&m[s.mast])?partMastBody(m[s.mast]):null];
    }),function(k,v){return PART_KEYS_OFF[k]?undefined:v;}));
  }
  /* the presentation a part names -- never the talk itself, and never a
     custom view, which has no slides to show */
  function partSource(name){
    if(!name||(pres&&pres.name===name)) return null;
    var p=presentationByName(name);
    return (p&&!isViewPres(p)&&Array.isArray(p.slides))?p:null;
  }
  function partLinksOf(p){
    var out=[],m=(p&&p.sections)||{};
    Object.keys(m).forEach(function(k){
      var l=m[k]&&m[k].link;
      if(l&&l.deck&&out.indexOf(l.deck)<0) out.push(l.deck);
    });
    return out;
  }
  /* does deck `from` show `target`, through any chain of parts? A talk
     that showed itself would copy itself into itself on every open. */
  function partReaches(from,target,seen){
    seen=seen||{};
    if(from===target) return true;
    if(seen[from]) return false;
    seen[from]=1;
    var p=(pres&&pres.name===from)?pres:presentationByName(from);
    return partLinksOf(p).some(function(n){
      return partReaches(n,target,seen);});
  }
  function partLockAnnot(a){
    if(!a||a.lkLock||lockMode(a)==='all') return;
    a.lkLock=lockMode(a)==='pos'?'pos':1;
    a.lock=1;
  }
  function partUnlockAnnot(a){
    if(!a||!a.lkLock) return;
    if(a.lkLock===1||a.lkLock==='1') delete a.lock; else a.lock=a.lkLock;
    delete a.lkLock;
  }
  /* a slide of the talk's own from now on */
  function partFree(s){
    if(!s) return;
    delete s.lk;
    (s.annots||[]).forEach(partUnlockAnnot);
  }
  /* the part's slides as this talk shows them: in section `id`, marked
     as the part's, every object locked. The part's own sections do not
     come across -- the part IS one section here -- so an arrival a slide
     took from its section there is written onto the slide. Its named
     versions (cuts) are the part's and mean nothing here. */
  function partCopies(src,id){
    var secs=src.sections||{};
    return (src.slides||[]).map(function(s0){
      var s=deep(s0),d=s.sec&&secs[s.sec];
      if(typeof s.trans!=='string'&&d&&typeof d.trans==='string')
        s.trans=d.trans;
      s.sec=id;s.lk=id;
      delete s.cuts;
      (s.annots||[]).forEach(partLockAnnot);
      return s;
    });
  }
  /* a master a part's slide wears comes with it -- master ids are 'm1',
     'm2' in every deck, so it is matched by what it looks like, and one
     brought in is marked so it goes when nothing wears it any more */
  function partMasters(copies,srcMasters){
    var sm=srcMasters||{},made={};
    copies.forEach(function(s){
      if(!s.mast) return;
      var pm=sm[s.mast];
      if(!pm){delete s.mast;return;}
      if(made[s.mast]){s.mast=made[s.mast];return;}
      var mm=mastStore(),body=JSON.stringify(partMastBody(pm)),id=null;
      Object.keys(mm).forEach(function(k){
        if(!id&&JSON.stringify(partMastBody(mm[k]))===body) id=k;});
      if(!id){
        id=nextMastId();
        mm[id]=deep(pm);
        mm[id].lk=1;
      }
      made[s.mast]=id;s.mast=id;
    });
  }
  function partMastersPrune(){
    var mm=pres&&pres.masters; if(!mm) return;
    var worn={};
    (pres.slides||[]).forEach(function(s){if(s&&s.mast) worn[s.mast]=1;});
    Object.keys(mm).forEach(function(k){
      if(mm[k]&&mm[k].lk&&!worn[k]) delete mm[k];});
  }
  /* THE ONE RULE normSections keeps for parts: a slide of the part's that
     has left its section -- dragged out, merged up by a removed divider,
     copied into another section -- is the talk's own from then on */
  function partNorm(){
    (pres.slides||[]).forEach(function(s){
      if(s&&s.lk&&(s.sec!==s.lk||!partLink(s.lk))) partFree(s);
    });
  }
  /* what a part holds now, against what was copied, changing nothing */
  function partLook(id){
    var l=partLink(id); if(!l) return null;
    var out={deck:l.deck,why:''};
    if(pres.name===l.deck){out.why='self';return out;}
    var src=partSource(l.deck);
    if(!src){out.why=draftsLoaded?'missing':'waiting';return out;}
    if(partReaches(l.deck,pres.name)){out.why='cycle';return out;}
    out.src=src;
    out.fresh=partCopies(src,id);
    if(!out.fresh.length){out.why='empty';return out;}
    out.freshSig=partSig(out.fresh,src.masters);
    var mine=(pres.slides||[]).filter(function(s){return s&&s.lk===id;});
    out.srcChanged=out.freshSig!==l.sig;
    out.hereChanged=!!l.sig&&partSig(mine,pres.masters)!==l.sig;
    return out;
  }
  /* the part's slides out, its fresh ones in -- where its first one was,
     so slides of the talk's own put in its section stay where they are */
  function partApply(id,look){
    var sl=pres.slides,at=-1,i,keep=sl[cur];
    for(i=sl.length-1;i>=0;i--)
      if(sl[i]&&sl[i].lk===id){sl.splice(i,1);at=i;}
    if(at<0){
      for(i=0;i<sl.length;i++) if(sl[i]&&sl[i].sec===id){at=i;break;}
      if(at<0) at=sl.length;
    }
    partMasters(look.fresh,look.src.masters);
    Array.prototype.splice.apply(sl,[at,0].concat(look.fresh));
    var l=partLink(id);
    l.sig=look.freshSig;l.at=Date.now();
    var k=sl.indexOf(keep);
    cur=k>=0?k:Math.min(at,sl.length-1);
  }
  /* every part, looked at; the ones that changed only there brought up to
     date (`force`: the ones that changed here too). The names updated. */
  function partsRefresh(force){
    var up=[];
    partIds().forEach(function(id){
      var look=partLook(id);
      var st=partState[id]={deck:look.deck,why:look.why};
      if(look.why) return;
      if(!look.srcChanged){st.why=look.hereChanged?'here':'current';return;}
      if(look.hereChanged&&!force){st.why='both';return;}
      partApply(id,look);
      st.why='updated';up.push(look.deck);
    });
    if(up.length){normSections();partMastersPrune();}
    return up;
  }
  function partNames(list){
    return list.map(function(n){return '“'+n+'”';}).join(', ');
  }
  function partsTellUpdated(up){
    toast('Brought up to date from '+(up.length===1?'its part ':'its parts ')
      +partNames(up)+' — '+(up.length===1?'it has':'they have')
      +' changed since this talk last showed '
      +(up.length===1?'it':'them'),6000);
  }
  /* loadPresentation's last step: a talk opens showing its parts as they
     are now. Not before the draft store has answered -- a part kept only
     there would look missing, and a draft written for the talk now would
     be taken for the newest one and hide the real one (T494). */
  function partsOnLoad(){
    partState={};
    if(!pres||!draftsLoaded) return false;
    partsDoneFor=pres;
    if(!pres.sections||!partLinksOf(pres).length) return false;
    var up=partsRefresh(false);
    if(!up.length) return false;
    markDirty(true);
    partsTellUpdated(up);
    return true;
  }
  /* ...and once it has, for the talk the page opened on */
  function partsAfterDrafts(){
    if(!pres||partsDoneFor===pres) return;
    partsDoneFor=pres;
    if(!pres.sections||!partLinksOf(pres).length) return;
    var up=partsRefresh(false);
    if(!up.length) return;
    histReset();markDirty(true);
    if(typeof refresh==='function'&&!deckEl.hidden) refresh();
    partsTellUpdated(up);
  }
  /* ---- the verbs --------------------------------------------------------- */
  /* whether `name` can be a part of this talk, and if not, why not */
  function partRefusal(name){
    if(!name) return 'Choose a presentation';
    if(pres.name===name) return 'A talk cannot be a part of itself';
    var p=presentationByName(name);
    if(!p) return '“'+name+'” cannot be found here';
    if(isViewPres(p)) return 'A custom view has no slides to show';
    if(/^a\d/.test(String(p.page||''))&&!pageOf().poster)
      return '“'+name+'” is a poster';
    if(partReaches(name,pres.name))
      return '“'+name+'” shows this talk — a part cannot '
        +'contain the talk it is part of';
    if(partLinksOf(pres).indexOf(name)>=0)
      return '“'+name+'” is already a part of this talk';
    return '';
  }
  /* `name` becomes a part at the end of the talk, as its own section */
  function partAdd(name){
    var why=partRefusal(name); if(why) return why;
    var id=secId();
    secMap()[id]={name:name,link:{deck:name,sig:'',at:0}};
    var look=partLook(id);
    if(!look||look.why){
      delete pres.sections[id];
      return look&&look.why==='empty'
        ?'“'+name+'” has no slides yet'
        :'“'+name+'” cannot be shown here';
    }
    partApply(id,look);
    cur=pres.slides.length-look.fresh.length;
    partState[id]={deck:name,why:'current'};
    normSections();partMastersPrune();markDirty();refresh();
    return '';
  }
  function partUpdate(id){
    var look=partLook(id);
    if(!look||look.why) return false;
    partApply(id,look);
    partState[id]={deck:look.deck,why:'current'};
    normSections();partMastersPrune();markDirty();refresh();
    return true;
  }
  function partUnlink(id){
    var d=pres.sections&&pres.sections[id]; if(!d||!d.link) return;
    delete d.link;
    (pres.slides||[]).forEach(function(s){if(s&&s.lk===id) partFree(s);});
    delete partState[id];
    normSections();partMastersPrune();markDirty();refresh();
  }
  /* a part's presentation opened to be edited */
  function partEdit(id){
    var l=partLink(id); if(!l) return;
    if(!partSource(l.deck)){
      toast('“'+l.deck+'” cannot be found here');return;}
    partsClose();
    choosePresentation(l.deck);
  }
  /* everything a new presentation takes from the talk, so a part looks
     like the rest of it: the page, the colours, the types, the masters,
     the furniture. Not the slides, the sections, the named versions, the
     notes or the rehearsal time -- those are the talk's. */
  var PART_NOT_TAKEN={slides:1,sections:1,cuts:1,notes:1,pad:1,talkMins:1,
    guides:1,origin:1,live:1,name:1};
  function partNewDeck(name,slides){
    var p={name:name,slides:slides};
    Object.keys(pres).forEach(function(k){
      if(!PART_NOT_TAKEN[k]&&pres[k]!=null) p[k]=deep(pres[k]);});
    return p;
  }
  function partNameFree(name){
    return !!name&&!presentationByName(name)&&name!==pres.name;
  }
  function partKeep(p){
    if(!draftSet(p.name,JSON.stringify(p),true)) return false;
    deckMetaSet(p.name,{edited:Date.now(),slides:p.slides.length});
    if(typeof pvForget==='function') pvForget();
    return true;
  }
  /* New part: a new presentation, one empty slide, at the end of the talk */
  function partNew(then){
    var n=1,base='Part ';
    while(!partNameFree(base+n)) n++;
    askText({title:'New part',value:base+n,ok:'Make it',
      what:'A new presentation, shown in this talk as a section. You '
        +'write it on its own; this talk shows what it holds.'},
    function(v){
      v=(v==null)?'':String(v).trim();
      if(!v){if(then) then('');return;}
      if(!partNameFree(v)){
        if(then) then('There is already something called “'+v
          +'” — pick another name');
        return;
      }
      if(!partKeep(partNewDeck(v,[emptySlide()]))){
        if(then) then('This browser could not keep “'+v+'”');
        return;
      }
      var why=partAdd(v);
      if(then) then(why,v);
    });
  }
  /* Make it a part: a section of this talk moves into a presentation of
     its own, and the section shows it from then on. Nothing on screen
     changes except that the slides are locked here. */
  function partMake(id,then){
    var run=null;
    sectionRuns().forEach(function(r){if(r.id===id) run=r;});
    if(!run||partLink(id)) return;
    var name=secName(id),v0=name,n=2;
    while(!partNameFree(v0)) v0=name+' ('+(n++)+')';
    askText({title:'Make this section a part',value:v0,ok:'Make it a part',
      what:'Its '+run.n+' slide'+(run.n===1?'':'s')+' move into a '
        +'presentation of their own, which you edit on its own. This talk '
        +'shows it here, and picks up its changes.'},
    function(v){
      v=(v==null)?'':String(v).trim();
      if(!v){if(then) then('');return;}
      if(!partNameFree(v)){
        if(then) then('There is already something called “'+v
          +'” — pick another name');
        return;
      }
      var slides=pres.slides.slice(run.at,run.at+run.n).map(function(s){
        var c=deep(s);delete c.sec;delete c.cuts;partFree(c);return c;});
      if(!partKeep(partNewDeck(v,slides))){
        if(then) then('This browser could not keep “'+v+'”');
        return;
      }
      secMap()[id].link={deck:v,sig:'',at:0};
      /* the section's slides ARE the part's now: marked so, so the copy
         below takes their place rather than landing beside them */
      pres.slides.forEach(function(s){if(s&&s.sec===id) s.lk=id;});
      var look=partLook(id);
      if(look&&!look.why) partApply(id,look);
      partState[id]={deck:v,why:'current'};
      normSections();partMastersPrune();markDirty();refresh();
      if(then) then('',v);
    });
  }
  /* Choose another: a part that cannot be found, pointed somewhere else */
  function partRelink(id,name){
    var l=partLink(id); if(!l) return 'That part is gone';
    var was=l.deck;
    delete pres.sections[id].link;
    var why=partRefusal(name);
    pres.sections[id].link=l;
    if(why) return why;
    l.deck=name;l.sig='';
    var look=partLook(id);
    if(!look||look.why){l.deck=was;return '“'+name
      +'” cannot be shown here';}
    partApply(id,look);
    partState[id]={deck:name,why:'current'};
    normSections();partMastersPrune();markDirty();refresh();
    return '';
  }
  /* T416's rule for files, for parts: the link follows a renamed deck --
     in this talk, and in every kept talk that shows it */
  function partRenamed(old,nm){
    if(!old||!nm) return;
    function fix(p){
      var hit=false,m=(p&&p.sections)||{};
      Object.keys(m).forEach(function(k){
        if(m[k]&&m[k].link&&m[k].link.deck===old){m[k].link.deck=nm;hit=true;}
      });
      return hit;
    }
    if(pres&&fix(pres)) markDirty(true);
    var needle='"deck":'+JSON.stringify(old);
    draftNames().forEach(function(dn){
      if(pres&&dn===pres.name) return;
      var raw=draftGet(dn); if(!raw||raw.indexOf(needle)<0) return;
      var d;try{d=JSON.parse(raw);}catch(e){return;}
      if(fix(d)) draftSet(dn,JSON.stringify(d),true);
    });
    allSaved().forEach(function(p){
      if((pres&&p.name===pres.name)||draftGet(p.name)) return;
      if(!partLinksOf(p).length) return;
      var d=deep(p);
      if(fix(d)){fix(p);draftSet(p.name,JSON.stringify(d),true);}
    });
  }
  /* the talks this deck is a part of, by name. Read off the drafts'
     text first -- a talk showing it names it verbatim -- so opening a
     deck does not parse every other deck to find out. */
  var partParentsFor=null,partParentsList=[];
  function partParents(){
    if(!pres) return [];
    if(partParentsFor===pres) return partParentsList;
    var me=pres.name,needle='"deck":'+JSON.stringify(me),out=[];
    draftNames().forEach(function(nm){
      if(nm===me) return;
      var raw=draftGet(nm);
      if(!raw||raw.indexOf(needle)<0) return;
      var d=loadDraft(nm);
      if(d&&partLinksOf(d).indexOf(me)>=0) out.push(nm);
    });
    allSaved().forEach(function(p){
      if(p.name===me||out.indexOf(p.name)>=0||draftGet(p.name)) return;
      if(partLinksOf(p).indexOf(me)>=0) out.push(p.name);
    });
    partParentsFor=pres;partParentsList=out;
    return out;
  }
  /* ---- THE CORNER: where this slide comes from, or what this is part of */
  function partChipSync(){
    var b=$('#where-part'),t=$('#where-part-t'); if(!b||!t||!pres) return;
    var s=(pres.slides||[])[cur],id=partOfSlide(s),txt='',tip='';
    b.dataset.sec=id||'';b.dataset.deck='';
    if(id){
      var l=partLink(id);
      txt='From “'+l.deck+'”';
      tip='This slide is part of “'+l.deck+'”, which this talk '
        +'shows. Click to open “'+l.deck+'” and change it there';
    } else if(!pageOf().poster){
      var ps=partParents();
      if(ps.length){
        txt='Part of “'+ps[0]+'”'
          +(ps.length>1?' +'+(ps.length-1):'');
        tip='“'+pres.name+'” is a part of '+partNames(ps)
          +'. Click to open “'+ps[0]+'”';
        b.dataset.deck=ps[0];
      }
    }
    b.hidden=!txt;
    t.textContent=txt;b.title=tip;
    b.classList.toggle('from',!!id);
  }
  function partChipClick(){
    var b=$('#where-part'); if(!b) return;
    if(b.dataset.sec){partEdit(b.dataset.sec);return;}
    var d=b.dataset.deck;
    if(d&&presentationByName(d)) choosePresentation(d);
  }
  /* ---- THE STRIP, THE ARROWS AND THE MENUS: a part keeps its order ---- */
  function partSays(id){
    var l=partLink(id);
    return 'That slide is part of “'+(l?l.deck:'a part')+'”, '
      +'so it keeps that presentation’s order. Change it there '
      +'(Edit in the Parts view), or drag the part’s divider to '
      +'move the whole part.';
  }
  /* a slide being moved, or a slide being moved INTO a part: refused,
     said, and true when the caller should stop */
  function partGuardMove(i,toSec){
    var s=(pres.slides||[])[i],id=partOfSlide(s);
    if(id){toast(partSays(id),7000);return true;}
    if(toSec&&partLink(toSec)){
      toast('That is inside the part “'+partLink(toSec).deck+'” '
        +'— put the slide before or after the part.',6000);
      return true;
    }
    return false;
  }
  /* where a new slide goes when it was asked for inside a part: after it */
  function partSafeAt(at){
    var sl=pres.slides||[],p=sl[at-1],id=partOfSlide(p);
    if(!id) return at;
    while(at<sl.length&&sl[at]&&sl[at].sec===id) at++;
    return at;
  }
  /* ---- THE PARTS VIEW ------------------------------------------------ */
  var partsPicking=null;   /* {relink:id} while choosing a presentation */
  function partsClose(){
    var ov=$('#deck-parts');
    if(ov) ov.remove();
    partsPicking=null;
    document.removeEventListener('keydown',partsKey,true);
  }
  function partsKey(e){
    if(!$('#deck-parts')) return;
    var ask=$('#ask-dlg');
    if(ask&&!ask.hidden) return;   /* the question's own Escape */
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();
      if(partsPicking){partsPicking=null;renderParts();return;}
      partsClose();
    }
  }
  function partsSay(msg,warn){
    var el=$('#prt-say'); if(!el) return;
    el.textContent=msg||'';el.hidden=!msg;
    el.classList.toggle('warn',!!warn);
  }
  function partBtn(icon,label,title,fn,cls){
    var b=document.createElement('button');
    b.type='button';b.className='dbtn rbn-sm'+(cls?' '+cls:'');
    b.innerHTML=bic(icon)+' ';
    b.appendChild(document.createTextNode(label));
    b.title=title;
    b.addEventListener('click',function(e){e.stopPropagation();fn();});
    return b;
  }
  function partWords(id,r){
    var st=partState[id]||{},l=partLink(id),n=r.n+' slide'+(r.n===1?'':'s');
    var when=(l&&l.at&&typeof histWhen==='function')
      ?' · copied '+histWhen(l.at):'';
    switch(st.why){
      case 'missing':return {t:'“'+l.deck+'” cannot be found here'
        +' — these are its slides as last copied'+when,warn:1};
      case 'waiting':return {t:'Looking for “'+l.deck+'”…'};
      case 'cycle':return {t:'“'+l.deck+'” shows this talk — '
        +'a part cannot contain the talk it is part of',warn:1};
      case 'self':return {t:'A talk cannot be a part of itself',warn:1};
      case 'empty':return {t:'“'+l.deck+'” has no slides yet '
        +'— these are its slides as last copied',warn:1};
      case 'both':return {t:n+' · “'+l.deck+'” has changed, '
        +'and so have its slides here — Update takes “'+l.deck
        +'”’s',warn:1};
      case 'here':return {t:n+' · changed here since it was copied'
        +' — Update puts back “'+l.deck+'”’s',warn:1};
      case 'updated':return {t:n+' · brought up to date just now'};
      default:return {t:n+' · up to date'+when};
    }
  }
  function partTiles(r){
    var tiles=document.createElement('div');
    tiles.className='ovw-tiles';
    for(var k=0;k<r.n;k++){
      (function(i){
        var sl=pres.slides[i];
        var tile=document.createElement('button');
        tile.type='button';
        tile.className='ovw-tile'+(i===cur?' cur':'');
        var num=document.createElement('span');
        num.className='ovw-n';num.textContent=String(slideNo(i));
        tile.appendChild(num);
        try{tile.appendChild(miniDiagram(sl));}catch(err){}
        var lab=document.createElement('span');
        lab.className='ovw-lab';lab.textContent=filmText(sl)||'';
        tile.appendChild(lab);
        tile.title='Go to slide '+slideNo(i);
        tile.addEventListener('click',function(){
          partsClose();
          cur=i;activePane=-1;selAnnot=null;selSet=[];refresh();
        });
        tiles.appendChild(tile);
      })(r.at+k);
    }
    return tiles;
  }
  function partGroup(r,runs,ri){
    var linked=!!(r.id&&partLink(r.id)),l=linked?partLink(r.id):null;
    var grp=document.createElement('div');
    grp.className='ovw-grp prt-grp'+(linked?' linked':'');
    grp.dataset.sec=r.id||'';
    var gh=document.createElement('div');gh.className='prt-gh';
    var ic=document.createElement('span');ic.className='prt-ic';
    ic.innerHTML=bic(linked?'link':(r.id?'layouts':'film'));
    gh.appendChild(ic);
    var tx=document.createElement('div');tx.className='prt-tx';
    var nm=document.createElement('div');nm.className='prt-name';
    nm.textContent=r.id?(r.name||'Section'):'Slides of this talk’s own';
    if(linked&&l.deck!==r.name){
      var sm=document.createElement('span');sm.className='prt-from';
      sm.textContent=' — shows “'+l.deck+'”';
      nm.appendChild(sm);
    }
    tx.appendChild(nm);
    var sub=document.createElement('div');sub.className='prt-sub';
    if(linked){
      var w=partWords(r.id,r);
      sub.textContent='Part: “'+l.deck+'” · '+w.t;
      if(w.warn) sub.classList.add('warn');
    } else sub.textContent='This talk’s own · '+r.n+' slide'
      +(r.n===1?'':'s')+(r.id?'':' with no section');
    tx.appendChild(sub);
    gh.appendChild(tx);
    var acts=document.createElement('div');acts.className='prt-acts';
    function done(msg){renderParts();if(msg) partsSay(msg);}
    if(linked){
      var st=(partState[r.id]||{}).why||'';
      var gone=st==='missing'||st==='cycle'||st==='self'||st==='empty';
      if(!gone) acts.appendChild(partBtn('pen','Edit “'+l.deck+'”',
        'Open “'+l.deck+'” to change it. Coming back here '
          +'brings this talk up to date',function(){partEdit(r.id);},
        'primary'));
      if(st==='both'||st==='here') acts.appendChild(partBtn('reload','Update',
        'Show “'+l.deck+'” as it is now, in place of the changed '
          +'copies here (Ctrl+Z undoes it)',function(){
          if(partUpdate(r.id)) done('“'+l.deck+'” is up to date');
        }));
      if(gone&&st!=='empty') acts.appendChild(partBtn('open','Choose another…',
        'Show a different presentation in this part',function(){
          partsPicking={relink:r.id};renderParts();}));
      acts.appendChild(partBtn('unlink','Unlink',
        'Keep these slides as this talk’s own; “'+l.deck
          +'” stops updating them',function(){
          partUnlink(r.id);
          done('Unlinked — the slides stay, as this talk’s own. '
            +'Ctrl+Z undoes it.');
        }));
    } else if(r.id&&!pageOf().poster){
      acts.appendChild(partBtn('newdeck','Make it a part…',
        'Move this section into a presentation of its own, edited on its '
          +'own and shown here',function(){
          partMake(r.id,function(why,v){
            if(why) partsSay(why,true);
            else if(v) done('“'+v+'” is a presentation of its own '
              +'now, shown here. Edit it to change it.');
          });
        }));
    }
    if(r.id){
      var up=partBtn('prev','Up','Move this '+(linked?'part':'section')
        +' before the one above it',function(){
          moveSection(r.id,-1);renderParts();});
      up.disabled=ri===0;up.classList.add('prt-up');
      var dn=partBtn('next','Down','Move this '+(linked?'part':'section')
        +' after the one below it',function(){
          moveSection(r.id,1);renderParts();});
      dn.disabled=ri===runs.length-1;dn.classList.add('prt-dn');
      acts.appendChild(up);acts.appendChild(dn);
    }
    if(linked) acts.appendChild(partBtn('minus','Remove',
      'Take this part out of the talk. “'+l.deck+'” itself is not '
        +'touched',function(){
        askYes({title:'Remove “'+l.deck+'” from this talk?',
          what:'Its '+r.n+' slide'+(r.n===1?'':'s')+' leave this talk. The '
            +'presentation “'+l.deck+'” is not touched, and '
            +'Ctrl+Z puts the part back.',ok:'Remove',danger:true},
        function(y){
          if(y!==true) return;
          removeSection(r.id,true);
          done('Removed — “'+l.deck+'” is still there, on its own.');
        });
      },'prt-rm'));
    gh.appendChild(acts);
    grp.appendChild(gh);
    grp.appendChild(partTiles(r));
    return grp;
  }
  /* the presentations that could be a part, for the picker */
  function partCandidates(relink){
    var seen={},out=[];
    allSaved().map(function(p){return p.name;}).concat(draftNames())
      .forEach(function(nm){
        if(!nm||seen[nm]||nm===pres.name) return;
        seen[nm]=1;
        var why=partRefusal(nm);
        if(relink&&why&&/already a part/.test(why)) why='';
        var s=presentationSummary(nm);
        if(!s||s.view) return;
        out.push({name:nm,why:why,s:s});
      });
    return out.sort(function(a,b){
      return (!!a.why-!!b.why)||((b.s.at||0)-(a.s.at||0))
        ||a.name.localeCompare(b.name);});
  }
  function renderPartsPicker(body){
    var relink=partsPicking&&partsPicking.relink;
    var wrap=document.createElement('div');wrap.className='prt-pick';
    var col=document.createElement('div');col.className='prt-pick-list';
    var pv=document.createElement('div');pv.className='prt-pick-pv';
    var hint=document.createElement('div');hint.className='pv-note';
    hint.textContent='Point at a presentation to see its slides.';
    pv.appendChild(hint);
    var list=partCandidates(relink);
    if(!list.length){
      var none=document.createElement('p');none.className='prt-none';
      none.textContent='There is no other presentation here yet. New '
        +'part makes one.';
      col.appendChild(none);
    }
    list.forEach(function(c){
      var b=document.createElement('button');
      b.type='button';b.className='prt-row'+(c.why?' off':'');
      var nm=document.createElement('span');nm.className='prt-row-name';
      nm.textContent=c.name;
      var sub=document.createElement('span');sub.className='prt-row-sub';
      sub.textContent=c.why||deckRowWords(c.s);
      b.appendChild(nm);b.appendChild(sub);
      b.title=c.why||('Show “'+c.name+'” in this talk'
        +(relink?'':', at the end'));
      function show(){
        try{renderDeckPreview(pv,c.name,{w:176});}catch(err){}
      }
      b.addEventListener('mouseenter',show);
      b.addEventListener('focus',show);
      b.addEventListener('click',function(){
        if(c.why){partsSay(c.why,true);return;}
        var why=relink?partRelink(relink,c.name):partAdd(c.name);
        partsPicking=null;renderParts();
        partsSay(why||('“'+c.name+'” is a part of this talk now'
          +(relink?'.':', at the end — Up and Down move it.')),!!why);
      });
      col.appendChild(b);
    });
    wrap.appendChild(col);wrap.appendChild(pv);
    body.appendChild(wrap);
  }
  function renderParts(){
    var ov=$('#deck-parts'); if(!ov) return;
    var t=$('#prt-title',ov),body=$('#prt-body',ov);
    var ids=partIds(),n=(pres.slides||[]).length;
    $$('.prt-headbtn',ov).forEach(function(b){b.hidden=!!partsPicking;});
    var back=$('#prt-back',ov); if(back) back.hidden=!partsPicking;
    var upAll=$('#prt-upall',ov);
    if(upAll) upAll.hidden=!!partsPicking||!ids.some(function(id){
      var w=(partState[id]||{}).why;return w==='both'||w==='here';});
    body.innerHTML='';
    if(partsPicking){
      var l=partsPicking.relink&&partLink(partsPicking.relink);
      t.textContent=l?('Show another presentation in place of “'
        +l.deck+'”'):'Add a presentation as a part of “'
        +pres.name+'”';
      renderPartsPicker(body);
      return;
    }
    t.textContent='Parts of “'+pres.name+'” — '
      +(ids.length?ids.length+' part'+(ids.length===1?'':'s')+', ':'')
      +n+' slide'+(n===1?'':'s');
    var runs=sectionRuns();
    runs.forEach(function(r,ri){body.appendChild(partGroup(r,runs,ri));});
    if(!ids.length){
      var p=document.createElement('p');p.className='prt-none';
      p.textContent='No parts yet. Add a presentation you already have, '
        +'start a new one, or turn a section of this talk into a part.';
      body.insertBefore(p,body.firstChild);
    }
  }
  function openParts(){
    if(!pres||isViewPres(pres)) return;
    if(pageOf().poster){
      toast('A poster\u2019s pages are versions of one sheet \u2014 parts '
        +'are for a talk made of other presentations',6000);
      return;
    }
    overviewClose();partsClose();
    /* what each part holds now, before it is drawn */
    partIds().forEach(function(id){
      var look=partLook(id),st=partState[id];
      if(!look) return;
      if(look.why){partState[id]={deck:look.deck,why:look.why};return;}
      if(st&&st.why==='updated') return;
      partState[id]={deck:look.deck,why:look.srcChanged
        ?(look.hereChanged?'both':'current'):(look.hereChanged?'here':'current')};
      if(look.srcChanged&&!look.hereChanged){
        partApply(id,look);partState[id].why='updated';
        normSections();partMastersPrune();markDirty();refresh();
      }
    });
    var ov=document.createElement('div');
    ov.className='deck-overview deck-parts';ov.id='deck-parts';
    ov.setAttribute('role','dialog');ov.setAttribute('aria-label','Parts');
    var head=document.createElement('div');head.className='ovw-head prt-head';
    var t=document.createElement('span');t.className='ovw-t';t.id='prt-title';
    head.appendChild(t);
    var sp=document.createElement('span');sp.className='deck-spring';
    head.appendChild(sp);
    var back=partBtn('return','Back to the parts','The parts of this talk',
      function(){partsPicking=null;renderParts();});
    back.id='prt-back';head.appendChild(back);
    var add=partBtn('plus','Add a presentation…','Show a presentation you '
      +'already have as a part of this talk, at the end',function(){
        partsPicking={};renderParts();partsSay('');},'primary prt-headbtn');
    add.id='prt-add';head.appendChild(add);
    var nw=partBtn('newdeck','New part…','Start a new presentation that '
      +'this talk shows as a part, at the end',function(){
        partNew(function(why,v){
          renderParts();
          if(why) partsSay(why,true);
          else if(v) partsSay('“'+v+'” is a new part, at the end. '
            +'Edit it to write it.');
        });
      },'prt-headbtn');
    nw.id='prt-new';head.appendChild(nw);
    var upAll=partBtn('reload','Update all','Show every part as it is now, '
      +'in place of copies changed here (Ctrl+Z undoes it)',function(){
        var up=partsRefresh(true);
        if(up.length){markDirty();refresh();}
        renderParts();
        partsSay(up.length?('Up to date: '+partNames(up)):'Nothing to update');
      },'prt-headbtn');
    upAll.id='prt-upall';head.appendChild(upAll);
    var cl=partBtn('exit','Close','Esc',partsClose);
    head.appendChild(cl);
    ov.appendChild(head);
    var intro=document.createElement('p');intro.className='prt-intro';
    intro.textContent='A part is another presentation that this talk shows '
      +'as a section, like \\input in LaTeX: you edit it on its own, and '
      +'this talk picks up its changes each time it opens. Its slides are '
      +'locked here — Edit opens it.';
    ov.appendChild(intro);
    var say=document.createElement('div');say.className='prt-say';
    say.id='prt-say';say.hidden=true;say.setAttribute('role','status');
    ov.appendChild(say);
    var body=document.createElement('div');body.className='ovw-body prt-body';
    body.id='prt-body';
    ov.appendChild(body);
    /* on the body, over the app's own top bar, as the overview map is;
       askHost puts its questions on the body too while it is open */
    document.body.appendChild(ov);
    renderParts();
    document.addEventListener('keydown',partsKey,true);
    var first=$('#prt-add');
    if(first) try{first.focus();}catch(err){}
  }
  function partsBoot(){
    var b=$('#where-part');
    if(b) b.addEventListener('click',partChipClick);
    menuAction('#mi-parts',openParts);
  }
