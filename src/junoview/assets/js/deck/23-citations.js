  /* ================================================================
     23-citations.js — CITATIONS AND A BIBLIOGRAPHY (T325)

     ONE FRAGMENT of deck.js's single IIFE: assets.DECK_PARTS names the
     order, 00-page.js opens the function and 99-boot.js closes it. It
     does not parse alone; check the ASSEMBLED file.

     The user's list, item 6: "Citation and bibliography manager:
     BibTeX, DOI lookup, numbered references, footnotes, citation
     styles".

     The gap this closes is already written down in the LaTeX reader
     (notebook/sources.py): "\cite has nowhere to resolve to -- a .bib
     is a second input file and load_doc has no slot for one -- so a
     citation stays a key in brackets". The deck is the slot. `pres.bib`
     is a library of entries keyed by cite key, and it rides the deck
     the way `styles` and `tokens` do.

     A CITATION IS RESOLVED AT PAINT TIME, never stamped -- the same
     rule `{fig:id}` (figSubst) and '@section' (T316) already keep, and
     for the same reason: numbers come from ORDER, and order changes
     every time a slide moves. So `[@key]` in any text box, note or
     caption becomes [1] as it is drawn, the numbering is first
     appearance walking the deck, and reordering the deck renumbers
     everything with no edit and no stale marker anywhere.

     Nothing here runs at load time: citeBoot() is called from THE BOOT
     SEQUENCE. */

  /* ---- THE LIBRARY ---------------------------------------------------- */
  function bibOf(){
    if(!pres.bib||typeof pres.bib!=='object') pres.bib={};
    return pres.bib;
  }
  function citeCfg(){
    var c=(pres&&pres.cite)||{};
    return {style:(c.style==='ay')?'ay':'num',foot:!!c.foot};
  }
  /* ---- BIBTEX ---------------------------------------------------------
     A small, forgiving reader: entries, a key, and field = {braced} or
     "quoted" or a bare word. It does NOT try to be a TeX engine -- the
     brace counter is the whole parser -- because what a slide needs out
     of a .bib is an author, a year and a title, and pretending to more
     would be a second product. Anything it cannot read is skipped and
     counted, never guessed at. */
  /* The two brace characters, as constants, because a LONE '{' inside a
     string literal is invisible to JavaScript and fatal to the test
     harness: tests/helpers_js.lift_fn cuts a function out of the
     assembled deck by counting raw braces, so one unpaired brace in a
     string swallows everything after it. Naming them keeps every
     literal in this file balanced. */
  var BIB_OPEN='{',BIB_CLOSE='}';
  function bibUnbrace(s){
    var t=String(s||'').trim();
    while(/^\{[\s\S]*\}$/.test(t)||/^"[\s\S]*"$/.test(t))
      t=t.slice(1,-1).trim();
    /* the TeX that actually turns up in a title */
    t=t.replace(/\\&/g,'&').replace(/\\%/g,'%').replace(/\\\$/g,'$')
      .replace(/\\_/g,'_').replace(/\{\\"([aouAOU])\}/g,'$1')
      .replace(/\\['`^"~=.]\{?([A-Za-z])\}?/g,'$1')
      .replace(/[{}]/g,'').replace(/~/g,' ')
      .replace(/\s+/g,' ').trim();
    return t;
  }
  function bibParse(text){
    var src=String(text||''),out={},bad=0,i=0;
    while(i<src.length){
      var at=src.indexOf('@',i);
      if(at<0) break;
      var open=src.indexOf(BIB_OPEN,at);
      if(open<0) break;
      var type=src.slice(at+1,open).trim().toLowerCase();
      if(!/^[a-z]+$/.test(type)){i=at+1;continue;}
      /* the entry is everything to its matching brace */
      var depth=0,end=-1,j;
      for(j=open;j<src.length;j++){
        if(src[j]===BIB_OPEN) depth++;
        else if(src[j]===BIB_CLOSE){depth--;if(!depth){end=j;break;}}
      }
      if(end<0){bad++;break;}
      var body=src.slice(open+1,end);
      i=end+1;
      if(type==='comment'||type==='preamble'||type==='string') continue;
      var comma=body.indexOf(',');
      var key=(comma<0?body:body.slice(0,comma)).trim();
      if(!key){bad++;continue;}
      var ent={type:type};
      var rest=comma<0?'':body.slice(comma+1);
      /* one field at a time, splitting on the commas that are at depth
         zero -- a comma inside {Smith, J.} is part of the value */
      var d=0,q=false,start=0,parts=[],k;
      for(k=0;k<rest.length;k++){
        var ch=rest[k];
        if(ch===BIB_OPEN) d++;
        else if(ch===BIB_CLOSE) d--;
        else if(ch==='"'&&!d) q=!q;
        else if(ch===','&&!d&&!q){parts.push(rest.slice(start,k));start=k+1;}
      }
      parts.push(rest.slice(start));
      parts.forEach(function(p){
        var eq=p.indexOf('=');
        if(eq<0) return;
        var name=p.slice(0,eq).trim().toLowerCase();
        if(!/^[a-z]+$/.test(name)) return;
        ent[name]=bibUnbrace(p.slice(eq+1));
      });
      out[key]=ent;
    }
    return {entries:out,bad:bad};
  }
  /* ---- WHAT A REFERENCE READS AS -------------------------------------
     Two styles, because two is what the ask names and what a slide can
     tell apart: a NUMBER in the text with a numbered list at the back,
     or the author and the year in the text with an alphabetical list.
     The list format is the same either way -- authors, year, title,
     where it appeared -- because a slide's bibliography is read at
     arm's length and a full house style would be unreadable at that
     distance. */
  function bibAuthors(ent){
    var raw=String((ent&&ent.author)||(ent&&ent.editor)||'').trim();
    if(!raw) return [];
    return raw.split(/\s+and\s+/i).map(function(one){
      var s=one.trim();
      if(s.indexOf(',')>=0) return s.split(',')[0].trim();
      var bits=s.split(/\s+/);
      return bits[bits.length-1];
    }).filter(Boolean);
  }
  function bibYear(ent){
    var m=/\d{4}/.exec(String((ent&&ent.year)||(ent&&ent.date)||''));
    return m?m[0]:'';
  }
  /* the in-text mark for the author-year style: one name, two names, or
     the first "et al." -- the convention every style agrees on */
  function bibShort(ent){
    var a=bibAuthors(ent),y=bibYear(ent);
    var who=!a.length?'Anon'
      :a.length===1?a[0]
      :a.length===2?(a[0]+' & '+a[1])
      :(a[0]+' et al.');
    return who+(y?(' '+y):'');
  }
  function bibFormat(ent){
    if(!ent) return '';
    var a=bibAuthors(ent),y=bibYear(ent);
    var who=a.length?(a.length>3?(a[0]+' et al.'):a.join(', ')):'Anon';
    var bits=[who+(y?(' ('+y+')'):'')];
    if(ent.title) bits.push(ent.title);
    var where=ent.journal||ent.booktitle||ent.publisher||ent.school
      ||ent.institution||'';
    if(where){
      var w=where;
      if(ent.volume) w+=' '+ent.volume;
      if(ent.pages) w+=', '+String(ent.pages).replace(/--/g,'–');
      bits.push(w);
    }
    if(ent.doi) bits.push('doi:'+ent.doi);
    else if(ent.url) bits.push(ent.url);
    return bits.join('. ')+'.';
  }
  /* ---- WHERE THE CITATIONS ARE ---------------------------------------
     `[@key]`, `[@a;@b]` and `\cite{a,b}` -- Pandoc's spelling and
     LaTeX's, because those are the two anybody pastes in. The scan and
     the substitution read the SAME regex, so a marker that renders can
     always be found and a marker that is found always renders. */
  var CITE_RE=/\[@([^\]\s][^\]]*)\]|\\cite[a-z]*\{([^}]*)\}/g;
  function citeKeysIn(txt){
    var out=[],m;
    CITE_RE.lastIndex=0;
    while((m=CITE_RE.exec(String(txt||'')))){
      String(m[1]||m[2]||'').split(/[;,]/).forEach(function(k){
        var key=k.replace(/^\s*@?\s*/,'').trim();
        if(key) out.push(key);
      });
    }
    return out;
  }
  /* every piece of text on a slide that a citation can hide in */
  function citeTextsOf(sl){
    var out=[];
    if(!sl) return out;
    if(sl.layout==='title'){out.push(sl.title);out.push(sl.sub);}
    (sl.annots||[]).forEach(function(a){
      if(!a) return;
      if(a.k==='text'&&!a.bib){out.push(a.text);out.push(a.html);}
      if(a.cap) out.push(a.cap);
      if(a.caption) out.push(a.caption);
    });
    if(sl.notes) out.push(sl.notes);
    return out;
  }
  /* KEY -> NUMBER, by first appearance walking the deck in ORDER. The
     numbering is a fact about the deck, not about any one box, which is
     why it is computed here and never written down: move a slide and
     every marker on every slide renumbers itself. Alternative versions
     of a slide (T318) are skipped, so a version nobody shows cannot
     claim reference [1]. */
  function citeOrder(){
    var map={},n=0;
    (pres.slides||[]).forEach(function(sl,i){
      if(typeof slideIsAlt==='function'&&slideIsAlt(i)) return;
      citeTextsOf(sl).forEach(function(t){
        citeKeysIn(t).forEach(function(k){
          if(!(k in map)) map[k]=++n;
        });
      });
    });
    return map;
  }
  /* the cited keys in order, for the bibliography and the checks */
  function citeUsed(){
    var map=citeOrder(),out=[];
    Object.keys(map).forEach(function(k){out[map[k]-1]=k;});
    return out.filter(Boolean);
  }
  /* the marker, as it is READ. An unknown key is shown as such rather
     than dropped: a citation that silently vanished would be the worst
     of the three outcomes, and the review pane can list them. */
  function citeSubst(txt,map){
    var t=String(txt||'');
    if(t.indexOf('[@')<0&&t.indexOf('\\cite')<0) return t;
    map=map||citeOrder();
    var cfg=citeCfg(),lib=bibOf();
    CITE_RE.lastIndex=0;
    return t.replace(CITE_RE,function(all,a,b){
      var keys=String(a||b||'').split(/[;,]/).map(function(k){
        return k.replace(/^\s*@?\s*/,'').trim();}).filter(Boolean);
      if(!keys.length) return all;
      var parts=keys.map(function(k){
        var ent=lib[k];
        if(!ent) return '?'+k;
        return (cfg.style==='ay')?bibShort(ent):String(map[k]||'?');
      });
      return (cfg.style==='ay')?('('+parts.join('; ')+')')
        :('['+parts.join(', ')+']');
    });
  }
  /* the keys a deck cites and does not hold -- for the review pane and
     the pre-print check, which is where a missing source has to surface
     rather than on the screen behind you */
  function citeMissing(){
    var lib=bibOf(),out=[];
    citeUsed().forEach(function(k){if(!lib[k]) out.push(k);});
    return out;
  }
  /* ---- THE BIBLIOGRAPHY BOX -------------------------------------------
     A text box with `bib:1` DRAWS the references rather than storing
     them, so it is right the moment a citation is added, removed or
     moved, and there is nothing to regenerate. Author-year sorts by
     name, numeric keeps the order the numbers are in. */
  function bibListText(){
    var cfg=citeCfg(),lib=bibOf();
    var keys=citeUsed().filter(function(k){return lib[k];});
    if(cfg.style==='ay') keys.sort(function(x,y){
      return bibShort(lib[x]).localeCompare(bibShort(lib[y]));});
    if(!keys.length) return '';
    return keys.map(function(k,i){
      return (cfg.style==='ay')?bibFormat(lib[k])
        :((i+1)+'. '+bibFormat(lib[k]));
    }).join('\n');
  }
  /* the footnote strip under a slide (the "footnotes" half): the
     references THIS slide cites, in the deck's own numbering */
  function citeFootFor(sl){
    if(!citeCfg().foot) return '';
    var map=citeOrder(),lib=bibOf(),seen={},out=[];
    citeTextsOf(sl).forEach(function(t){
      citeKeysIn(t).forEach(function(k){
        if(seen[k]) return;
        seen[k]=1;
        var ent=lib[k];
        if(!ent) return;
        out.push((citeCfg().style==='ay')?bibFormat(ent)
          :('['+(map[k]||'?')+'] '+bibFormat(ent)));
      });
    });
    return out.join('   ');
  }

  /* ---- THE PANE -------------------------------------------------------- */
  function showCitePane(on){
    var p=$('#citepane'); if(!p) return;
    if(on){paneShow('citepane');citePaneSync();}
    else paneHide('citepane');
  }
  var citePaneBusyAt=null;
  function citePaneBusy(){
    var p=$('#citepane');
    return !!(p&&!p.hidden&&p.contains(document.activeElement)
      &&document.activeElement!==document.body);
  }
  function citePaneSync(){
    var p=$('#citepane'); if(!p||p.hidden) return;
    var body=$('#citepane-body'); if(!body) return;
    if(citePaneBusy()&&citePaneBusyAt==='live') return;
    body.innerHTML='';
    var lib=bibOf(),cfg=citeCfg(),used=citeOrder();
    function lab(t,cls){
      var l=document.createElement('div');
      l.className='np-lab'+(cls?' '+cls:'');
      l.textContent=t;body.appendChild(l);return l;
    }
    function row(cls){
      var r=document.createElement('div');
      r.className='np-row ct-row'+(cls?' '+cls:'');
      body.appendChild(r);return r;
    }
    function btn(host,label,on,fn,title){
      var b=document.createElement('button');
      b.className='dbtn ct-btn'+(on?' on':'');b.textContent=label;
      if(title) b.title=title;
      b.setAttribute('aria-pressed',(!!on).toString());
      b.addEventListener('click',function(e){e.stopPropagation();fn();});
      host.appendChild(b);return b;
    }
    lab('Style');
    var sr=row();
    [['num','[1] numbered'],['ay','(Smith 2020)']].forEach(function(o){
      btn(sr,o[1],cfg.style===o[0],function(){
        pres.cite=pres.cite||{};pres.cite.style=o[0];
        markDirty();renderSlide();citePaneSync();});
    });
    btn(sr,'Footnotes',cfg.foot,function(){
      pres.cite=pres.cite||{};
      if(cfg.foot) delete pres.cite.foot; else pres.cite.foot=1;
      markDirty();renderSlide();citePaneSync();},
      'Show the references a slide cites along its bottom edge');
    lab('Library');
    var lr=row();
    btn(lr,'Import .bib…',false,function(){
      var fi=$('#bibfile'); if(fi){fi.value='';fi.click();}},
      'Read a BibTeX file into this deck');
    btn(lr,'Add by DOI…',false,citeAddByDoi,
      APP.mode==='app'
        ?'Look the DOI up on doi.org and add what it returns'
        :'Needs the Junoview app: the lookup goes out to doi.org');
    var miss=citeMissing();
    if(miss.length) lab('Cited but not in the library: '+miss.join(', ')
      +'. Import the .bib they came from, or add them by DOI.','ct-warn');
    var keys=Object.keys(lib).sort(function(x,y){
      var a=used[x]||9e9,b=used[y]||9e9;
      return a===b?x.localeCompare(y):a-b;});
    if(!keys.length){
      lab('Nothing here yet. Import a .bib, or add one by DOI, then '
        +'cite it in any text box as [@key].','ct-hint');
    }
    keys.forEach(function(k){
      var r=row('ct-entry');
      var n=used[k];
      var num=document.createElement('span');
      num.className='ct-num';
      num.textContent=n?('['+n+']'):'–';
      num.title=n?('Reference '+n+' in this deck'):'Not cited yet';
      r.appendChild(num);
      var t=document.createElement('span');
      t.className='ct-ref';
      t.textContent=bibFormat(lib[k]);
      t.title=k;
      r.appendChild(t);
      btn(r,'Cite',false,function(){citeInsert(k);},
        'Put [@'+k+'] into the selected text box');
      btn(r,'Remove',false,function(){
        if(n&&!confirm('“'+k+'” is cited '
          +'in this deck. Remove it from the library anyway? The '
          +'citation will read ?'+k+' until you add it back.')) return;
        delete lib[k];markDirty();renderSlide();citePaneSync();},
        'Take this entry out of the deck’s library');
    });
    lab('References box');
    var br=row();
    btn(br,'Insert a references box',false,citeInsertBibBox,
      'A text box that DRAWS the references this deck cites, so it is '
      +'right the moment a citation moves');
  }
  /* put a marker into the selected text box, which is the only place a
     citation can go */
  function citeInsert(key){
    var s=pres.slides[cur];
    var a=(s&&typeof selAnnot==='number')?(s.annots||[])[selAnnot]:null;
    if(!a||a.k!=='text'){
      toast('Select the text box to cite in first');
      return;
    }
    a.text=String(a.text||'')+(a.text?' ':'')+'[@'+key+']';
    if(a.html) a.html=String(a.html)+' [@'+key+']';
    markDirty();renderSlide();
    toast('Cited — the number comes from where the slide sits, so '
      +'moving the slide renumbers it');
  }
  function citeInsertBibBox(){
    var s=pres.slides[cur]; if(!s) return;
    s.annots=s.annots||[];
    s.annots.push({k:'text',x:8,y:20,w:84,h:70,size:1.9,bib:1,text:''});
    markDirty();
    setTool('select');
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
    toast('A references box — it draws what the deck cites, in '
      +'order, and stays right on its own');
  }
  function citeAddByDoi(){
    if(APP.mode!=='app'){
      toast('Looking a DOI up reaches doi.org, so it needs the '
        +'Junoview app. Import a .bib instead.',6000);
      return;
    }
    var raw=prompt('The DOI (or a doi.org link):','');
    if(raw==null) return;
    var doi=String(raw).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i,'')
      .replace(/^doi:\s*/i,'');
    if(!/^10\.\d{4,9}\/\S+$/.test(doi)){
      toast('That does not look like a DOI — they start "10." and '
        +'then a slash',5000);
      return;
    }
    toast('Asking doi.org…');
    APP.api('/api/doi',{doi:doi}).then(function(j){
      var got=bibParse(j&&j.bibtex);
      var keys=Object.keys(got.entries);
      if(!keys.length){toast('doi.org sent nothing this could read');return;}
      var lib=bibOf(),added=[];
      keys.forEach(function(k){
        if(!lib[k]) added.push(k);
        lib[k]=got.entries[k];
      });
      markDirty();renderSlide();citePaneSync();
      toast(added.length
        ?('Added '+added.join(', ')+' — cite it as [@'+added[0]+']')
        :'Already in the library; the entry was refreshed',6000);
    }).catch(function(e){
      toast('DOI lookup failed: '+((e&&e.message)||e),6000);
    });
  }
  function citeImportText(text,name){
    var got=bibParse(text);
    var keys=Object.keys(got.entries);
    if(!keys.length){
      toast('No BibTeX entries in '+(name||'that file'));
      return 0;
    }
    var lib=bibOf(),fresh=0;
    keys.forEach(function(k){
      if(!lib[k]) fresh++;
      lib[k]=got.entries[k];
    });
    markDirty();renderSlide();citePaneSync();
    toast('Read '+keys.length+' entr'+(keys.length===1?'y':'ies')
      +' from '+(name||'the file')+(fresh!==keys.length
        ?(' ('+fresh+' new)'):'')
      +(got.bad?(' — '+got.bad+' could not be read'):''),6000);
    return keys.length;
  }
  function citeBoot(){
    var b=$('#dsg-cites');
    if(b) b.addEventListener('click',function(){
      var p=$('#citepane');showCitePane(!p||p.hidden);});
    var cl=$('#citepane-close');
    if(cl) cl.addEventListener('click',function(){showCitePane(false);});
    var fi=$('#bibfile');
    if(fi) fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      this.value='';
      if(!f) return;
      f.text().then(function(t){citeImportText(t,f.name);})
        .catch(function(e){
          toast('Could not read '+f.name+': '+((e&&e.message)||e));});
    });
    window.SemDeckCite={parse:bibParse,format:bibFormat,short:bibShort,
      order:citeOrder,subst:citeSubst,keys:citeKeysIn,list:bibListText,
      missing:citeMissing,pane:showCitePane,importText:citeImportText};
  }
