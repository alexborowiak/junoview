/* 48c-anim-rule.js — one animation rule for many slides (T625).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- T625: ONE ANIMATION RULE FOR MANY SLIDES -----------------------
     (2026-10-11, user: "animation rule that can be applied to all slides
     and or slide selection".) Animating a talk meant doing every slide
     by hand -- or one slide's "One per click" at a time -- although the
     answer is nearly always the same on every slide: the title is
     there, the bullets come in one at a time, then the figure.

     A RULE says that once, per KIND of thing on a slide: titles, text
     boxes, figures, pictures, tables, code, shapes and diagrams -- each
     with an entrance (or none), when it starts (on click, with
     previous, after a few seconds), how fast, and for text whether it
     comes a bullet at a time; plus the ORDER the kinds come in, or top
     to bottom as placed. The default is the talk: the title there from
     the start, then the words a bullet at a time, then the figure. The
     rule is applied to this slide, to some slides (typed, or picked in
     the slide sorter -- the strip has no selection of slides), or to all
     of them, and by default only to things that have no animation yet,
     so a slide you built by hand keeps what you built. "New slides too"
     keeps the rule on the deck (pres.animRule): a slide made with New
     slide gets it as it is made, and so does a presentation Create
     slides makes with Add animations ticked while this deck is open.

     NOTHING NEW IN THE MODEL BUT A LENGTH. The rule writes what the
     ribbon writes -- a.anim {type, by, after} -- through the one list of
     clicks (timelineOf / timelineWrite, T577), so the Animation pane,
     Earlier / Later, a bullet's click of its own, the show, the
     presenter view, the scrolling page and the .pptx all read it as if
     it had been set by hand. `anim.dur` (seconds) is the one new fact:
     how long the entrance takes, absent for the effect's own length.

     THE APPLY IS ONE UNDO STEP: every slide is worked out on a copy,
     then they all take it in one task that runs markDirty once. */
  var AR_KINDS=[
    ['title','Titles','The slide’s heading: the box with its top heading type'],
    ['text','Text boxes','Words: bullets, paragraphs, captions, a notebook’s '
      +'markdown'],
    ['figure','Figures & charts','Notebook figures and outputs, flip books, charts'],
    ['image','Pictures & media','Pictures, video and audio, web pages'],
    ['table','Tables','Tables'],
    ['code','Code','Code boxes and notebook code'],
    ['shape','Shapes & diagrams','Shapes, lines, arrows, drawings and diagrams']];
  var AR_KIND_IDS=['title','text','figure','image','table','code','shape'];
  /* when it starts: the ribbon's three, the delay as a few choices */
  var AR_START=[['click','On click'],['with','With previous'],
    ['after1','After 1 s'],['after2','After 2 s'],['after3','After 3 s'],
    ['after5','After 5 s']];
  /* short enough to be read whole in the column (2026-10-12 review:
     "Very slow · 2 s" showed as "Very slow", the seconds cut off) */
  var AR_SPEED=[['0','Normal'],['0.25','Fast 0.25 s'],
    ['1','Slow 1 s'],['2','Slower 2 s']];
  /* HOW MANY AT A TIME. For text: a box at a time, a bullet at a time,
     or every box at once; for every other kind: one at a time, or all
     of them on one click. "All together" is how a rule says what a
     slide built by hand often does -- two columns of words, or two
     figures side by side, arriving on one click -- so Copy this slide
     can say it, and giving the copied rule back to the slide changes
     nothing (2026-10-17 review: the two columns were split onto two
     clicks). */
  var AR_BY=[['','Whole box'],['para','By bullet'],['all','All together']];
  var AR_BY_ONE=[['','One by one'],['all','All together']];
  /* the kind of thing an object is, for the rule. PURE: the slide's
     title type, whether the box is a diagram's node and a cell's part
     are worked out by the caller (arObjs). A notebook cell's part is
     'code', 'note' (a markdown cell's words -- what Create slides puts
     under a heading, which reads as text) or anything else (a figure,
     an output). */
  function arKindOf(a,tstyle,dnode,part){
    var k=a&&a.k;
    if(k==='text'){
      if(a.font==='mono') return 'code';
      if(dnode) return 'shape';
      if(tstyle&&a.style===tstyle) return 'title';
      return 'text';
    }
    if(k==='cell') return part==='code'?'code':(part==='note'?'text':'figure');
    if(k==='flip'||k==='chart') return 'figure';
    if(k==='image'||k==='video'||k==='web') return 'image';
    if(k==='table') return 'table';
    return 'shape';
  }
  /* the rule as stored, made safe: anything unknown takes the default.
     PURE (it reads the two tables above). */
  function arNorm(r){
    var FX=['none','appear','fade','rise','zoom','slide','turn','type'];
    var IDS=['title','text','figure','image','table','code','shape'];
    var D={title:'none',text:'fade',figure:'fade',image:'fade',
      shape:'fade',table:'fade',code:'fade'};
    r=(r&&typeof r==='object')?r:{};
    var src=(r.k&&typeof r.k==='object')?r.k:{},k={};
    IDS.forEach(function(id){
      var s=(src[id]&&typeof src[id]==='object')?src[id]:{},o={};
      o.fx=FX.indexOf(s.fx)>=0?s.fx:D[id];
      o.st=(s.st==='with'||s.st==='after')?s.st:'click';
      if(o.st==='after') o.w=Math.max(1,Math.min(60,Math.round(+s.w)||1));
      var d=+s.dur;
      if(isFinite(d)&&d>0) o.dur=Math.max(0.1,Math.min(10,d));
      if(id==='text') o.by=(s.by==='para'||s.by==='all')?s.by
        :((s.by==null&&!src.text)?'para':'');
      else if(s.by==='all') o.by='all';
      /* A BOX THAT RUNS ITSELF ARRIVES WHOLE. "After" is a property of
         the stop the box begins on (autoAfter, T169): its first bullet
         would run itself and every other wait for a click -- three
         clicks the dialog said would come by themselves. So the rule
         never says both; the dialog greys By bullet while After is
         chosen, and says why. (All together is whole boxes, and may.) */
      if(id==='text'&&o.st==='after'&&o.by==='para') o.by='';
      k[id]=o;
    });
    var ord=[];
    (Array.isArray(r.ord)?r.ord:[]).forEach(function(id){
      if(IDS.indexOf(id)>=0&&ord.indexOf(id)<0) ord.push(id);});
    IDS.forEach(function(id){if(ord.indexOf(id)<0) ord.push(id);});
    var out={k:k,ord:ord,by:r.by==='place'?'place':'kind'};
    if(typeof r.tr==='string') out.tr=r.tr;
    if(r.nw) out.nw=1;
    return out;
  }
  /* "2-4, 7" -> [1,2,3,6], in order, within 1..n. PURE. */
  function arParseRange(txt,n){
    var seen={},out=[];
    String(txt||'').replace(/\s*[-–—]\s*/g,'-')
      .split(/[,;\s]+/).forEach(function(p){
      var m=/^(\d+)(?:-(\d*))?$/.exec(p); if(!m) return;
      var a=+m[1],b=(m[2]===undefined)?a:(m[2]===''?n:+m[2]);
      if(b<a){var t=a;a=b;b=t;}
      for(var q=Math.max(1,a);q<=Math.min(n,b);q++)
        if(!seen[q]){seen[q]=1;out.push(q-1);}
    });
    return out.sort(function(x,y){return x-y;});
  }
  /* ...and back: [1,2,3,6] -> "2-4, 7". PURE. */
  function arRangeText(idxs){
    var s=(idxs||[]).slice().sort(function(x,y){return x-y;}),out=[],i=0;
    while(i<s.length){
      var j=i;
      while(j+1<s.length&&s[j+1]===s[j]+1) j++;
      out.push(j>i?((s[i]+1)+'-'+(s[j]+1)):String(s[i]+1));
      i=j+1;
    }
    return out.join(', ');
  }
  /* WHAT ARRIVES TOGETHER. A group is one unit -- a diagram's boxes and
     arrows, a picture and its caption -- and arrives as one; its kind is
     the most telling of its members'. `objs` is [{i, k, rank, g, has}];
     with `onlyNew` a thing that already has an animation is left out --
     and so is the rest of its GROUP: a group one of whose members was
     animated by hand is the slide's own work, and animating the others
     on a click of their own would split what was grouped to arrive as
     one (a picture zoomed by hand, its caption a click later). PURE. */
  function arUnits(objs,onlyNew){
    var PRI=['figure','image','table','code','title','text','shape'];
    var by={},out=[],mine={};
    if(onlyNew) (objs||[]).forEach(function(o){
      if(o.has&&o.g!=null) mine['g'+o.g]=1;});
    (objs||[]).forEach(function(o){
      if(onlyNew&&(o.has||(o.g!=null&&mine['g'+o.g]))) return;
      var key=(o.g!=null)?('g'+o.g):('i'+o.i);
      var u=by[key];
      if(!u){u=by[key]={k:o.k,rank:o.rank,ii:[],ks:[],tx:!!o.tx};out.push(u);}
      u.ii.push(o.i);u.ks.push(o.k);
      if(o.rank<u.rank) u.rank=o.rank;
    });
    out.forEach(function(u){
      if(u.ii.length>1){
        var best=99;
        u.ks.forEach(function(k){
          var p=PRI.indexOf(k); if(p>=0&&p<best) best=p;});
        if(best<99) u.k=PRI[best];
      }
      delete u.ks;
    });
    return out;
  }
  /* THE RULE AS A LIST OF CLICKS. `units` from arUnits (a single text
     box carries `pieces`, its bullets), `clicks` the list to go on from
     (timelineOf's shape: clicks[c] = [{i, k:'in'|'p'|'out'|'focus',
     j}]). Kinds in the rule's order, or top to bottom; a kind on None is
     left on the slide from the start. A kind All together arrives on
     ONE click: its first thing starts it as the kind's start says, and
     every other thing of that kind joins that click (`at`). Returns the
     new list and the entrance each object gets. PURE. */
  function arPlan(rule,units,clicks){
    var ord=(rule&&rule.ord)||[],ks=(rule&&rule.k)||{},anim={},n=0,at={};
    var out=(clicks||[]).map(function(c){return c.slice();});
    var list=(units||[]).filter(function(u){
      var sp=ks[u.k];return !!(sp&&sp.fx&&sp.fx!=='none');});
    list.sort(function(p,q){
      if(!rule||rule.by!=='place'){
        var d=ord.indexOf(p.k)-ord.indexOf(q.k);
        if(d) return d;
      }
      return p.rank-q.rank;
    });
    list.forEach(function(u){
      var sp=ks[u.k],st=sp.st||'click';
      var one=(u.ii.length===1&&u.k==='text'&&!!u.tx&&sp.by==='para');
      var split=one&&(u.pieces|0)>1;
      var first=u.ii.map(function(i){
        return split?{i:i,k:'p',j:0}:{i:i,k:'in'};});
      if(sp.by==='all'&&(u.k in at)) [].push.apply(out[at[u.k]],first);
      else if(st==='with'&&out.length) [].push.apply(out[out.length-1],first);
      else out.push(first);
      if(!(u.k in at)) at[u.k]=out.length-1;
      if(split) for(var j=1;j<(u.pieces|0);j++)
        out.push([{i:u.ii[0],k:'p',j:j}]);
      u.ii.forEach(function(i){
        var an={type:sp.fx};
        if(one) an.by='para';
        if(sp.dur>0) an.dur=sp.dur;
        if(st==='after') an.after=Math.max(1,Math.min(60,(sp.w|0)||1));
        anim[i]=an;n++;
      });
    });
    return {clicks:out,anim:anim,n:n};
  }
  /* ---- the slide's side: what each thing on it is ------------------- */
  /* a cell's part, asked once per figure for the whole apply: 'note'
     for a markdown cell's words, else what the frame shows */
  function arPart(a,memo){
    if(a.part==='code') return 'code';
    if(a.autoNote) return 'note';
    var key=String(a.ref||'')+'|'+(a.part||'');
    if(memo&&key in memo) return memo[key];
    var p='figure';
    try{
      var it=(a.ref&&typeof resolveRef==='function')?resolveRef(a.ref):null;
      if(it&&it.kind==='note') p='note';
      else if(a.part&&a.part!=='auto') p=a.part;
      else if(a.ref&&typeof partOf==='function') p=partOf(a)||'figure';
    }catch(e){}
    if(memo) memo[key]=p;
    return p;
  }
  function arObjs(s,memo){
    var ann=(s&&s.annots)||[],ord=orderedIdx(s),rank={};
    ord.forEach(function(i,n){rank[i]=n;});
    /* the slide's title is its best heading: Title, else Heading 1... */
    var hs=(typeof headingStyles==='function')?headingStyles()
      :['title','h1','h2','h3'];
    var best=-1;
    ord.forEach(function(i){
      var a=ann[i];
      if(!a||a.k!=='text'||!a.style||a.font==='mono') return;
      var r=hs.indexOf(a.style);
      if(r>=0&&(best<0||r<best)) best=r;
    });
    var tstyle=best>=0?hs[best]:null;
    /* a diagram's node is a box its own group's arrows are tied to */
    var dnode={};
    ann.forEach(function(a){
      if(!a||a.k!=='arrow'||a.grp==null) return;
      [a.c1,a.c2].forEach(function(c){
        var t=c&&typeof c.i==='number'?ann[c.i]:null;
        if(t&&t.k==='text'&&t.grp===a.grp) dnode[c.i]=1;
      });
    });
    var objs=[];
    ord.forEach(function(i){
      var a=ann[i]; if(!a||a.priv) return;
      objs.push({i:i,rank:rank[i],tx:a.k==='text',
        k:arKindOf(a,tstyle,!!dnode[i],a.k==='cell'?arPart(a,memo):''),
        g:(a.grp!=null&&a.grp!=='')?a.grp:null,
        has:!!(a.anim||typeof a.out==='number'||a.focus),
        ent:!!a.anim});
    });
    return objs;
  }
  /* how many bullets a box has, counted the way the show will */
  function arPieces(a){
    if(typeof textPieceCount!=='function') return 1;
    var c={};
    for(var key in a) if(Object.prototype.hasOwnProperty.call(a,key)) c[key]=a[key];
    c.anim={type:'fade',by:'para'};
    try{return textPieceCount(c);}catch(e){return 1;}
  }
  /* A slide of a part (T601) is the other presentation's: it is
     replaced when that one changes, so the rule leaves it alone. */
  function arSkip(s){
    return !s||(typeof partOfSlide==='function'&&!!partOfSlide(s));
  }
  /* THE RULE ON ONE SLIDE. `how` is 'new' (only things with no
     animation -- the default) or 'replace'. Exits, focuses and
     movements are not entrances and are kept, and so is the entrance of
     anything the rule does not cover (a private note): under Replace
     each keeps the arrival it shared a click with, and goes on the
     click that thing now arrives on -- or on a click of its own at the
     end when that thing no longer arrives. Returns how many things it
     animated. `opt` (optional): `only` limits it to those indices (the
     slots a layout change has just made), and `tally.gone` is counted up
     by the entrances Replace took off and gave nothing back for -- a
     kind on None -- so the dialog and its toast can say so. */
  function arSlide(s,rule,how,memo,opt){
    if(arSkip(s)) return 0;
    s.annots=s.annots||[];
    var objs=arObjs(s,memo),replace=(how==='replace'),keep=[],base;
    var only=opt&&opt.only,had=[];
    if(only) objs=objs.filter(function(o){return !!only[o.i];});
    if(replace){
      objs.forEach(function(o){if(o.ent) had.push(o.i);});
      var mine={};
      objs.forEach(function(o){mine[o.i]=1;});
      timelineOf(s).forEach(function(c,ci){
        var at=null;
        c.forEach(function(cl){
          if((cl.k==='in'||cl.k==='p')&&mine[cl.i]&&at==null) at=cl.i;});
        c.forEach(function(cl){
          if((cl.k==='in'||cl.k==='p')&&mine[cl.i]) return;
          keep.push({cl:cl,at:at,c:ci});
        });
      });
      objs.forEach(function(o){
        var a=s.annots[o.i]; if(a&&a.anim) delete a.anim;
        o.has=false;
      });
      base=[];
    } else base=timelineOf(s);
    var units=arUnits(objs,!replace),sp=rule.k.text;
    if(sp&&sp.by==='para') units.forEach(function(u){
      if(u.k==='text'&&u.tx&&u.ii.length===1)
        u.pieces=arPieces(s.annots[u.ii[0]]);
    });
    var p=arPlan(rule,units,base);
    if(opt&&opt.tally) opt.tally.gone=(opt.tally.gone|0)
      +had.filter(function(i){return !(i in p.anim);}).length;
    if(!p.n&&!replace) return 0;
    Object.keys(p.anim).forEach(function(key){
      var a=s.annots[+key]; if(!a) return;
      var an=p.anim[key];an.order=0;
      a.anim=an;
    });
    var clicks=p.clicks;
    if(keep.length){
      var first={},tail=null,tailC=-1;
      clicks.forEach(function(c,ci){c.forEach(function(cl){
        if((cl.k==='in'||cl.k==='p')&&!(cl.i in first)) first[cl.i]=ci;});});
      keep.forEach(function(x){
        if(x.at!=null&&(x.at in first)){clicks[first[x.at]].push(x.cl);return;}
        /* what shared a click with nothing that still arrives keeps
           sharing it with the same company, at the end */
        if(!tail||tailC!==x.c){tail=[];clicks.push(tail);tailC=x.c;}
        tail.push(x.cl);
      });
    }
    timelineWrite(s,clicks.filter(function(c){return c.length;}));
    return p.n;
  }
  /* WHAT THE APPLY WILL DO TO ONE SLIDE, counted without doing it: the
     things it animates, the things it leaves because they are animated
     already (Keep theirs), and the entrances Replace takes off for a
     kind on None -- by the same units the apply uses, so a group is
     counted the way it will arrive. `objs` from arObjs. PURE. */
  function arCount(objs,rule,how){
    var replace=(how==='replace'),out={things:0,had:0,gone:0};
    var ks=(rule&&rule.k)||{},inUnit={};
    arUnits(objs,!replace).forEach(function(u){
      var sp=ks[u.k],on=!!(sp&&sp.fx&&sp.fx!=='none');
      u.ii.forEach(function(i){inUnit[i]=1;});
      if(on){out.things+=u.ii.length;return;}
      if(replace) objs.forEach(function(o){
        if(o.ent&&u.ii.indexOf(o.i)>=0) out.gone++;});
    });
    if(!replace) objs.forEach(function(o){
      var sp=ks[o.k];
      if(!inUnit[o.i]&&sp&&sp.fx&&sp.fx!=='none') out.had++;});
    return out;
  }
  /* ---- the rule the deck keeps, and a new slide ---------------------- */
  /* T625: called by New slide (newVersion) on the slide it has just
     made, before its markDirty, so the slide and its animation are one
     undo step. A duplicate keeps its own; so does a version. */
  function animRuleNewSlide(s){
    var r=pres&&pres.animRule;
    if(!r||!r.nw||!s||(pageOf&&pageOf().poster)) return 0;
    var rule=arNorm(r);
    var n=arSlide(s,rule,'new',{});
    if(typeof rule.tr==='string') s.trans=rule.tr;
    return n;
  }
  /* T625: ...and by a LAYOUT CHANGE, which makes fresh slots: the
     Design menu's layout tiles call it with the objects the slide had
     before, and only what the layout has just made -- a new title, a
     new empty frame -- gets the rule, before the same markDirty. What
     was carried over keeps what it had, and a slide on a deck that
     keeps no rule is left alone. */
  function animRuleFresh(s,before){
    var r=pres&&pres.animRule;
    if(!r||!r.nw||!s||(pageOf&&pageOf().poster)) return 0;
    var was=before||[],only={},any=false;
    (s.annots||[]).forEach(function(a,i){
      if(a&&was.indexOf(a)<0){only[i]=1;any=true;}});
    return any?arSlide(s,arNorm(r),'new',{},{only:only}):0;
  }
  /* T625: Create slides makes a NEW presentation, from the reader, where
     no deck is open -- so it has no deck of its own to take a rule from,
     and the editor's last deck is not one anybody can see. Its dialog
     NAMES the deck whose rule it may use (animRuleDecks lists the ones
     that keep a rule for new slides); chosen, the slides it makes
     arrive by that rule in place of the plain one-per-click fade.
     The new presentation is not given the rule to keep: that is asked
     of a deck in its own Apply to slides. Returns how many things it
     animated. */
  function animRuleForNew(pr,r){
    if(!r||typeof r!=='object'||!pr||!Array.isArray(pr.slides)) return 0;
    var rule=arNorm(r),memo={},n=0;
    pr.slides.forEach(function(s){
      n+=arSlide(s,rule,'replace',memo);
      if(typeof rule.tr==='string') s.trans=rule.tr;
    });
    return n;
  }
  /* the decks that keep a rule for new slides, by name: the one in the
     editor as it is now, then the saved ones. Read, never copied. */
  function animRuleDecks(){
    var out=[],seen={};
    function look(p){
      if(!p||!p.name||seen[p.name]) return;
      seen[p.name]=1;
      if(p.animRule&&p.animRule.nw&&typeof p.animRule==='object')
        out.push({name:p.name,rule:p.animRule});
    }
    if(typeof pres!=='undefined'&&pres) look(pres);
    (typeof projectPres!=='undefined'?projectPres:[]).forEach(look);
    (typeof nbPres!=='undefined'?nbPres:[]).forEach(look);
    return out;
  }
  /* ...by name, for the reader's Create slides (SemApp.deckAnimRules).
     Registered by autoDeckBoot, AT LOAD, beside deckAuto: from
     animRuleBoot -- run only when the editor is first entered -- a
     reader that had not opened a deck was never offered a rule
     (2026-10-17 review). */
  function animRuleNames(){
    return animRuleDecks().map(function(d){return d.name;});
  }
  function animRuleOfDeck(name){
    var hit=null;
    animRuleDecks().forEach(function(d){if(!hit&&d.name===name) hit=d.rule;});
    return hit;
  }
  /* ---- THE DIALOG ----------------------------------------------------- */
  var arRule=null,arMemo={},arObjCache=null;
  var arPv={t:[],steps:[]};
  function arDlg(){return $('#anr-dlg');}
  /* ICONS, NAMED LITERALLY, so the icon contract can see them */
  function arKindIcon(id){
    if(id==='title') return bic('textcase');
    if(id==='text') return bic('text');
    if(id==='figure') return bic('plots');
    if(id==='image') return bic('image');
    if(id==='shape') return bic('shapes');
    if(id==='table') return bic('table');
    return bic('code');
  }
  function arOpt(sel,list,val){
    sel.innerHTML='';
    list.forEach(function(o){
      var op=document.createElement('option');
      op.value=o[0];op.textContent=o[1];
      sel.appendChild(op);
    });
    if(val!=null) sel.value=val;
  }
  function arFxList(){
    var out=[['none','None']];
    (typeof SEQ_FX!=='undefined'?SEQ_FX:[]).forEach(function(f){
      if(f[0]!=='none') out.push([f[0],f[1]]);});
    return out;
  }
  function arAttr(t){return esc(t).replace(/"/g,'&quot;');}
  function arSelHtml(cls,list,lab){
    return '<select class="anr-sel '+cls+'" aria-label="'+arAttr(lab)+'">'
      +list.map(function(o){
        return '<option value="'+arAttr(o[0])+'">'+esc(o[1])+'</option>';
      }).join('')+'</select>';
  }
  /* THE ROWS, BUILT ONCE, as one string: the first open is the only one
     that pays for them, and it pays once rather than per control. A
     reorder moves them and never rebuilds them; their changes and their
     Earlier buttons are heard by one listener each on the list
     (animRuleBoot). */
  function arBuild(){
    var host=$('#anr-rows'); if(!host||host.childNodes.length) return;
    var fx=arFxList(),h='';
    AR_KINDS.forEach(function(kd){
      h+='<div class="anr-row" data-k="'+kd[0]+'">'
        +'<span class="anr-kind" title="'+arAttr(kd[2])+'">'
        +'<i class="anr-sw anr-k-'+kd[0]+'"></i>'+arKindIcon(kd[0])
        +'<span class="anr-kn">'+esc(kd[1])+'</span>'
        +'<span class="anr-n"></span></span>'
        +arSelHtml('anr-fx',fx,kd[1]+': entrance')
        +arSelHtml('anr-st',AR_START,kd[1]+': starts')
        +arSelHtml('anr-sp',AR_SPEED,kd[1]+': speed')
        +arSelHtml('anr-by',kd[0]==='text'?AR_BY:AR_BY_ONE,
          kd[1]+': how many at a time')
        +'<button type="button" class="dbtn anr-up" title="Comes before the '
        +'kind above it">\u2191 Earlier</button></div>';
    });
    host.innerHTML=h;
    var tr=$('#anr-trans');
    if(tr){
      var tl=[['keep','Leave as it is']];
      (typeof TRANS!=='undefined'?TRANS:[]).forEach(function(t){
        tl.push([t[0]===''?'cut':t[0],t[1]]);});
      arOpt(tr,tl,'keep');
    }
  }
  /* a kind one place earlier in the rule's order */
  function arEarlier(id){
    var o=arRule.ord,at=o.indexOf(id);
    if(at<=0) return;
    o.splice(at,1);o.splice(at-1,0,id);
    arRowsOrder();arLive();
  }
  /* THE ROWS IN THE RULE'S ORDER, MOVED, NEVER REBUILT -- and the focus
     kept. Re-appending every row took the focused Earlier button out of
     the page for an instant, which drops the focus to the body; the next
     Enter then went to the dialog's own keys (dlgKeysBoot), which press
     Apply. Only a row out of place moves now, the row ABOVE it in
     preference to the focused one, and whatever had the focus has it
     back -- or, when its Earlier is now off (it is first), the row's
     entrance. */
  function arRowsOrder(){
    var host=$('#anr-rows'); if(!host) return;
    var place=arRule.by==='place',fa=document.activeElement;
    var had=!!(fa&&host.contains(fa));
    host.classList.toggle('anr-place',place);
    var want=(place?AR_KIND_IDS:arRule.ord).map(function(id){
      return host.querySelector('.anr-row[data-k="'+id+'"]');})
      .filter(function(r){return !!r;});
    want.forEach(function(row,n){
      var guard=want.length+2;
      while(host.children[n]!==row&&guard-->0){
        /* the focused row stays put: what sits in its way goes to the
           end (nothing from n on is in place yet); any other row moves
           up to where it belongs */
        var x=host.children[n];
        if(had&&row.contains(fa)) host.appendChild(x);
        else host.insertBefore(row,x);
      }
    });
    arRule.ord.forEach(function(id,n){
      var row=host.querySelector('.anr-row[data-k="'+id+'"]');
      var up=row&&row.querySelector('.anr-up');
      if(up) up.disabled=place||n===0;
    });
    if(had&&(document.activeElement!==fa||fa.disabled)){
      var t=fa;
      if(fa.disabled){
        var r=fa.closest&&fa.closest('.anr-row');
        t=r?r.querySelector('.anr-fx'):null;
      }
      if(t) try{t.focus({preventScroll:true});}catch(e){}
    }
    $$('.anr-ordby',$('#anr-dlg')).forEach(function(b){
      var on=b.getAttribute('data-by')===arRule.by;
      b.classList.toggle('on',on);b.setAttribute('aria-pressed',on.toString());
    });
  }
  /* the rule into the controls */
  function arToUi(){
    var host=$('#anr-rows'); if(!host) return;
    AR_KIND_IDS.forEach(function(id){
      var row=host.querySelector('.anr-row[data-k="'+id+'"]');
      if(!row) return;
      var sp=arRule.k[id];
      var fx=row.querySelector('.anr-fx'),st=row.querySelector('.anr-st');
      var spd=row.querySelector('.anr-sp'),by=row.querySelector('.anr-by');
      fx.value=sp.fx;
      var sv=sp.st==='after'?('after'+(sp.w||1)):sp.st;
      if(!st.querySelector('option[value="'+sv+'"]')){
        var op=document.createElement('option');
        op.value=sv;op.textContent='After '+(sp.w||1)+' s';st.appendChild(op);
      }
      st.value=sv;
      var dv=String(sp.dur||0);
      if(!spd.querySelector('option[value="'+dv+'"]')){
        var o2=document.createElement('option');
        o2.value=dv;o2.textContent=dv+' s';spd.appendChild(o2);
      }
      spd.value=dv;
      if(by&&by.tagName==='SELECT'){
        by.removeAttribute('data-was');by.value=sp.by||'';}
    });
    arRowsOrder();
    var tr=$('#anr-trans');
    if(tr) tr.value=(typeof arRule.tr==='string')?(arRule.tr||'cut'):'keep';
    var nw=$('#anr-new'); if(nw) nw.checked=!!arRule.nw;
    arDim();
  }
  /* ...and back */
  function arFromUi(){
    var host=$('#anr-rows'); if(!host) return;
    arDim();
    AR_KIND_IDS.forEach(function(id){
      var row=host.querySelector('.anr-row[data-k="'+id+'"]');
      if(!row) return;
      var sp={fx:row.querySelector('.anr-fx').value};
      var sv=row.querySelector('.anr-st').value;
      if(/^after/.test(sv)){sp.st='after';sp.w=+sv.slice(5)||1;}
      else sp.st=sv==='with'?'with':'click';
      var d=+row.querySelector('.anr-sp').value;
      if(d>0) sp.dur=d;
      var by=row.querySelector('select.anr-by');
      if(by){
        if(by.value==='all') sp.by='all';
        else if(id==='text') sp.by=by.value==='para'?'para':'';
      }
      arRule.k[id]=sp;
    });
    var tr=$('#anr-trans');
    if(tr){
      if(tr.value==='keep') delete arRule.tr;
      else arRule.tr=(tr.value==='cut')?'':tr.value;
    }
    var nw=$('#anr-new');
    if(nw){if(nw.checked) arRule.nw=1; else delete arRule.nw;}
  }
  /* a kind on None greys its other choices; text that starts by itself
     (After) arrives whole, so By bullet is greyed while it does, and
     says why -- and comes back when the start is a click again */
  var AR_BY_TIP='A box at a time, a bullet at a time, or every box on '
    +'one click';
  var AR_BY_ONE_TIP='Each on a click of its own, or all of them on one';
  var AR_BY_AFTER='A box that starts by itself arrives whole: a bullet at '
    +'a time needs On click or With previous';
  function arDim(){
    $$('#anr-rows .anr-row').forEach(function(row){
      var none=row.querySelector('.anr-fx').value==='none';
      row.classList.toggle('anr-off',none);
      $$('select',row).forEach(function(s){
        if(!s.classList.contains('anr-fx')) s.disabled=none;});
      var by=row.querySelector('select.anr-by');
      var para=by&&by.querySelector('option[value="para"]');
      if(!para){if(by) by.title=AR_BY_ONE_TIP;return;}
      var after=/^after/.test(row.querySelector('.anr-st').value);
      if(after){
        /* only By bullet is off: whole boxes, one or all, may run
           themselves */
        if(by.value==='para'){by.setAttribute('data-was','para');by.value='';}
        para.disabled=true;by.title=AR_BY_AFTER;
      } else {
        para.disabled=false;
        if(by.getAttribute('data-was')==='para'){
          by.value='para';by.removeAttribute('data-was');}
        by.title=AR_BY_TIP;
      }
    });
  }
  /* which slides, as indices */
  function arScope(){
    var n=(pres.slides||[]).length,sc=$('#anr-scope'),v=sc?sc.value:'cur';
    if(v==='all'){var all=[];for(var i=0;i<n;i++) all.push(i);return all;}
    if(v==='some') return arParseRange(($('#anr-range')||{}).value,n);
    return pres.slides[cur]?[cur]:[];
  }
  function arHow(){
    var h=$('#anr-how');return h&&h.value==='replace'?'replace':'new';
  }
  function arObjsOf(s){
    if(!arObjCache) arObjCache=new WeakMap();
    var o=arObjCache.get(s);
    if(!o){o=arObjs(s,arMemo);arObjCache.set(s,o);}
    return o;
  }
  /* the counts on the rows and the line in the foot -- counted by the
     apply's own units (arCount), so what it says is what Apply does:
     Replace says how many entrances it takes off, too */
  function arSummary(){
    var idx=arScope(),how=arHow(),per={},things=0,slides=0,parts=0,had=0;
    var gone=0,goneOn=0;
    AR_KIND_IDS.forEach(function(id){per[id]=0;});
    idx.forEach(function(i){
      var s=pres.slides[i];
      if(arSkip(s)){if(s) parts++;return;}
      var objs=arObjsOf(s);
      objs.forEach(function(o){per[o.k]++;});
      var c=arCount(objs,arRule,how);
      things+=c.things;had+=c.had;gone+=c.gone;
      if(c.things) slides++;
      if(c.gone) goneOn++;
    });
    $$('#anr-rows .anr-row').forEach(function(row){
      var k=row.getAttribute('data-k'),nEl=row.querySelector('.anr-n');
      if(nEl) nEl.textContent=per[k]?String(per[k]):'';
      row.classList.toggle('anr-none',!per[k]);
    });
    var sum=$('#anr-sum');
    if(sum){
      var n=idx.length,off=gone?(gone+(gone===1?' entrance':' entrances')
        +' taken off'):'';
      sum.textContent=!n?'No slides chosen'
        :(things?(things+(things===1?' thing':' things')+' on '+slides
          +(slides===1?' slide':' slides')+(off?' \u00b7 '+off:''))
          :(off?(off+' on '+goneOn+(goneOn===1?' slide':' slides'))
            :(had?'All of it is animated already \u2014 Replace redoes it'
              :'Nothing here to animate')))
        +(parts?(' · '+parts+' part slide'+(parts===1?'':'s')+' left'):'');
      sum.classList.toggle('anr-sum-warn',!!gone);
    }
    var go=$('#anr-apply');
    if(go) go.disabled=!idx.length;
    var all=$('#anr-scope-all');
    if(all) all.textContent='All '+(pres.slides||[]).length+' slides';
  }
  /* ---- the small live preview: the current slide as boxes ------------ */
  function arPreviewStop(){
    arPv.t.forEach(clearTimeout);arPv.t=[];
    $$('#anr-pv .anr-o').forEach(function(el){
      el.className=el.className.replace(/\ban-anim-[a-z]+\b/g,'')
        .replace(/\banr-wait\b/g,'').replace(/\s+/g,' ').trim();
      el.style.animationDuration='';
    });
  }
  /* THE SLIDE THE PREVIEW DRAWS AND COPY READS is one the apply will
     reach: this slide when it is among them, else the first of them --
     opened from the sorter with slides 4 and 8 picked, it is slide 4,
     not the slide the editor happened to be on. */
  var arPvAt=-1;
  function arPvIdx(){
    var idx=arScope();
    return (idx.indexOf(cur)>=0||!idx.length)?cur:idx[0];
  }
  function arPvLabel(at){
    var t=$('#anr-copy-t');
    if(t) t.textContent=at===cur?'Copy this slide':('Copy slide '+(at+1));
    var cp=$('#anr-copy');
    if(cp) cp.title='Fill the rule in from what '+(at===cur?'this slide'
      :('slide '+(at+1)))+' already does';
  }
  function arPreview(){
    var at=arPvIdx(),pv=$('#anr-pv'),s=pres.slides[at];
    arPvAt=at;arPvLabel(at);
    if(!pv) return;
    arPreviewStop();
    pv.innerHTML='';arPv.steps=[];
    var pg=pageOf(),mm=pg&&pg.mm||[16,9];
    pv.style.aspectRatio=mm[0]+' / '+mm[1];
    pv.style.background=(typeof pageBgOf==='function'&&s)?pageBgOf(s):'';
    var cnt=$('#anr-pvn');
    if(!s){if(cnt) cnt.textContent='';return;}
    var copy=deep(s),kinds={};
    arObjs(copy,arMemo).forEach(function(o){kinds[o.i]=o.k;});
    if(!arSkip(copy)) arSlide(copy,arRule,arHow(),arMemo);
    var tl=timelineOf(copy),plan=flipPlan(copy),fc={},lc={};
    tl.forEach(function(c,ci){
      var sp=plan.stop[ci],no=((sp==null?ci:sp)|0)+1;
      c.forEach(function(cl){
        if(cl.k!=='in'&&cl.k!=='p') return;
        if(!(cl.i in fc)) fc[cl.i]=no;
        lc[cl.i]=no;
      });
    });
    var byNo={};
    orderedIdx(copy).slice(0,60).forEach(function(i){
      var a=copy.annots[i]; if(!a||a.priv||!(i in kinds)) return;
      var x,y,w,h;
      if(a.k==='arrow'){
        x=Math.min(a.x1,a.x2);y=Math.min(a.y1,a.y2);
        w=Math.max(1.2,Math.abs(a.x2-a.x1));h=Math.max(1.2,Math.abs(a.y2-a.y1));
      } else {
        x=+a.x||0;y=+a.y||0;w=+a.w||20;
        h=+a.h||+a.fh||0;
        if(!h){
          var lines=Math.min(8,String(a.text||'').split('\n').length||1);
          h=Math.max(4,(+a.size||3)*1.35*lines);
        }
      }
      var el=document.createElement('span');
      el.className='anr-o anr-k-'+kinds[i];
      el.style.left=Math.max(0,x)+'%';el.style.top=Math.max(0,y)+'%';
      el.style.width=Math.min(100,w)+'%';el.style.height=Math.min(100,h)+'%';
      if(i in fc){
        var b=document.createElement('b');
        b.textContent=fc[i]===lc[i]?String(fc[i]):(fc[i]+'–'+lc[i]);
        el.appendChild(b);
        var an=copy.annots[i].anim||{};
        (byNo[fc[i]]||(byNo[fc[i]]=[])).push({el:el,fx:an.type||'fade',
          dur:an.dur||0});
      }
      pv.appendChild(el);
    });
    arPv.steps=Object.keys(byNo).map(Number).sort(function(p,q){return p-q;})
      .map(function(no){return byNo[no];});
    if(cnt) cnt.textContent=(at===cur?'':'Slide '+(at+1)+' \u00b7 ')
      +(plan.count?(plan.count+(plan.count===1?' click':' clicks'))
        :'No clicks');
  }
  /* PLAY: the boxes arrive in the rule's order, with the real keyframes */
  function arPlay(){
    arPreviewStop();
    var steps=arPv.steps; if(!steps.length) return;
    if(!(typeof motionOK==='function'&&motionOK())) return;
    steps.forEach(function(st){st.forEach(function(x){
      x.el.classList.add('anr-wait');});});
    steps.forEach(function(st,k){
      arPv.t.push(setTimeout(function(){
        st.forEach(function(x){
          x.el.classList.remove('anr-wait');
          var fx=x.fx==='type'?'fade':x.fx;
          if(fx!=='appear'){
            x.el.style.animationDuration=x.dur>0?(x.dur+'s'):'';
            x.el.classList.add('an-anim-'+fx);
          }
        });
      },250+k*650));
    });
    arPv.t.push(setTimeout(arPreviewStop,250+steps.length*650+2200));
  }
  function arLive(){arSummary();arPreview();}
  /* a change of slides redraws the preview only when its slide changes */
  function arScopeLive(){
    arSummary();
    if(arPvIdx()!==arPvAt) arPreview();
  }
  /* ---- COPY THIS SLIDE'S ANIMATIONS AS THE RULE ---------------------- */
  /* each kind takes what its first thing to arrive on the slide does; a
     kind that is there and never animated is None; the order is the
     order the kinds first arrive in, reading order between kinds that
     arrive on the same click. Kinds the slide does not have keep what
     the dialog said.
     WHAT ARRIVES TOGETHER STAYS TOGETHER. "With previous" is worked out
     from that ORDER, not from where a thing sits in its click's list
     (which is the order of the slide's objects): a kind is With
     previous exactly when something of a kind before it in the rule
     arrives on the click it first arrives on -- the first kind's, or
     the last bullet's. Read off the list, the kind the rule put first
     could be "With previous" -- with nothing before it, a click of its
     own -- and the one after it "On click": one click became two when
     the rule was given back to the slide it was copied from.
     ...AND WITHIN A KIND. Two things of one kind that arrive on one
     click -- two columns of words, two figures side by side -- make
     that kind All together, when every one of its animated things
     arrives on that click (a kind half together and half not can say
     neither, and says one by one). Only across kinds was it read: the
     rule gave each its own click, so the two columns came apart on
     every slide the rule went to (2026-10-17 review). PURE but for
     arObjs' cell lookups. */
  function arFromSlide(s,base){
    var r=arNorm(base);
    if(!s) return r;
    var objs=arObjs(s,arMemo),tl=timelineOf(s),fc={};
    tl.forEach(function(c,ci){c.forEach(function(cl){
      if((cl.k==='in'||cl.k==='p')&&!(cl.i in fc)) fc[cl.i]=ci;});});
    var units=arUnits(objs,false),present={},firstAt={},lead={},kOf={};
    var arr={};
    units.sort(function(p,q){return p.rank-q.rank;});
    units.forEach(function(u){
      present[u.k]=1;
      u.ii.forEach(function(i){kOf[i]=u.k;});
      var l=null,at=1e9;
      u.ii.forEach(function(i){
        var a=s.annots[i]; if(!a||!a.anim) return;
        var c=(i in fc)?fc[i]:1e9;
        if(l==null||c<at){l=i;at=c;}
      });
      if(l==null) return;
      if(at<1e9) (arr[u.k]||(arr[u.k]=[])).push(at);
      /* the kind's first arrival; a tie keeps the unit read first */
      if(!(u.k in firstAt)||at<firstAt[u.k]){firstAt[u.k]=at;lead[u.k]=l;}
    });
    var got=Object.keys(firstAt).sort(function(p,q){
      return firstAt[p]-firstAt[q];});
    got.forEach(function(k,x){
      var a=s.annots[lead[k]],sp={fx:a.anim.type||'fade',st:'click'};
      var before=got.slice(0,x),c=firstAt[k];
      if(c<1e9&&tl[c].some(function(cl){
        return (cl.k==='in'||cl.k==='p')&&before.indexOf(kOf[cl.i])>=0;}))
        sp.st='with';
      else if(a.anim.after){sp.st='after';sp.w=a.anim.after|0;}
      if(a.anim.dur>0) sp.dur=+a.anim.dur;
      var tog=(arr[k]||[]).length>1&&arr[k].every(function(c){
        return c===arr[k][0];});
      if(k==='text') sp.by=(typeof textBy==='function'&&textBy(a))?'para'
        :(tog?'all':'');
      else if(tog) sp.by='all';
      r.k[k]=sp;
    });
    Object.keys(present).forEach(function(k){
      if(!(k in firstAt)) r.k[k]={fx:'none',st:'click',by:k==='text'?'':undefined};
    });
    r.ord=got.concat(r.ord.filter(function(k){return got.indexOf(k)<0;}));
    r.by='kind';
    if(typeof s.trans==='string') r.tr=s.trans;
    return arNorm(r);
  }
  /* ---- OPEN, APPLY ---------------------------------------------------- */
  /* `picked` (slide indices) comes from the slide sorter's selection */
  function animRuleOpen(picked){
    var d=arDlg(); if(!d) return;
    if(mode!=='edit'||!pres.slides[cur]) return;
    if(pageOf&&pageOf().poster){toast('A poster has no clicks to animate');return;}
    if(typeof seqOn==='function'&&seqOn()) seqEnd(true);
    arBuild();
    arMemo={};arObjCache=null;
    /* the deck's own rule; else the last one used in this project, as
       a starting point -- but only a deck's own rule is one it already
       gives its new slides */
    arRule=arNorm(pres.animRule||lsJson('animrule'));
    if(!pres.animRule) delete arRule.nw;
    /* EVERY OPEN STARTS SAFE: this slide (or the slides picked in the
       sorter, for this open only) and Keep theirs. The last open's All
       slides + Replace stayed on the controls, so a plain Apply from the
       ribbon on another slide, days later, redid every hand-made
       animation in the deck. What is remembered is the rule. */
    var sc=$('#anr-scope'),rg=$('#anr-range'),hw=$('#anr-how');
    if(picked&&picked.length){
      if(sc) sc.value=picked.length>=pres.slides.length?'all':'some';
      if(rg) rg.value=arRangeText(picked);
    } else {
      if(sc) sc.value='cur';
      if(rg) rg.value=String(cur+1);
    }
    if(hw) hw.value='new';
    arPvAt=-1;
    arScopeSync();
    var hl=$('#anr-help'),q=$('#anr-q');
    if(hl) hl.hidden=true;
    if(q) q.setAttribute('aria-expanded','false');
    arToUi();
    var go=$('#anr-apply'),sum=$('#anr-sum');
    if(go) go.disabled=!arScope().length;
    if(sum) sum.textContent='';
    d.hidden=false;
    arLiveSoon();
  }
  /* THE DIALOG IS ON SCREEN FIRST. Counting the slides chosen and
     drawing this one small are a frame later, in a task of their own,
     so the click that opens it is answered by the dialog itself. */
  var arLiveT=0;
  function arLiveSoon(){
    if(arLiveT) return;
    arLiveT=1;
    requestAnimationFrame(function(){
      setTimeout(function(){
        arLiveT=0;
        var d=arDlg(); if(d&&!d.hidden) arLive();
      },0);
    });
  }
  /* the dialog's own memory of the last rule, for a deck that keeps none */
  function lsJson(k){
    try{var v=lsGet('semopts:'+SCOPE+':'+k);return v?JSON.parse(v):null;}
    catch(e){return null;}
  }
  /* THE FIRST OPEN COSTS WHAT EVERY LATER ONE DOES. Showing the dialog
     the first time laid out 300 elements -- 25 selects among them --
     from cold: 45 ms at 4x of its style and layout (median), against 26
     for every later show and 24 for an empty box. Shown and hidden again
     in one task, invisible, it is never painted and nothing can be
     clicked; the caches it fills (text shaping, matched styles) are
     what the later shows were reusing. Once, and never while it is
     open. */
  var arWarmed=false;
  function arWarm(){
    var d=arDlg();
    if(arWarmed||!d||!d.hidden) return;
    arWarmed=true;
    d.style.visibility='hidden';
    d.hidden=false;
    try{void d.offsetWidth;}
    finally{d.hidden=true;d.style.visibility='';}
  }
  function arScopeSync(){
    var sc=$('#anr-scope'),rg=$('#anr-range');
    if(rg) rg.hidden=!(sc&&sc.value==='some');
  }
  function animRuleClose(){
    arPreviewStop();
    var d=arDlg(); if(d) d.hidden=true;
    arObjCache=null;
  }
  /* A slide to work the rule out on: its own objects, shallow, with the
     three things the rule may write (anim, out, focus) copied -- so the
     slide itself is not touched until the apply lands. */
  function arWorkCopy(s){
    var c={},k;
    for(k in s) if(Object.prototype.hasOwnProperty.call(s,k)) c[k]=s[k];
    c.annots=(s.annots||[]).map(function(a){
      if(!a||typeof a!=='object') return a;
      var b={},q;
      for(q in a) if(Object.prototype.hasOwnProperty.call(a,q)) b[q]=a[q];
      if(a.anim&&typeof a.anim==='object'){
        b.anim={};
        for(q in a.anim) if(Object.prototype.hasOwnProperty.call(a.anim,q))
          b.anim[q]=a.anim[q];
        if(Array.isArray(a.anim.parts)) b.anim.parts=a.anim.parts.slice();
      }
      if(a.focus&&typeof a.focus==='object'){
        b.focus={fx:a.focus.fx,at:a.focus.at};
      }
      return b;
    });
    return c;
  }
  /* whether the work copy says anything the slide does not -- a slide
     the rule leaves as it was is not landed, redrawn or counted */
  function arSame(s,c){
    if(typeof c.trans==='string'&&c.trans!==s.trans) return false;
    var A=s.annots||[];
    for(var i=0;i<A.length;i++){
      var a=A[i],b=c.annots[i];
      if(!a||!b||typeof a!=='object') continue;
      if(JSON.stringify([a.anim||null,a.out==null?null:a.out,a.focus||null])
        !==JSON.stringify([b.anim||null,b.out==null?null:b.out,b.focus||null]))
        return false;
    }
    return true;
  }
  /* ...and what it worked out, written onto the slide */
  function arLand(s,c){
    (s.annots||[]).forEach(function(a,i){
      var b=c.annots[i]; if(!a||!b) return;
      if(b.anim) a.anim=b.anim; else delete a.anim;
      if(b.out!=null) a.out=b.out; else delete a.out;
      if(b.focus) a.focus=b.focus; else delete a.focus;
    });
    if(typeof c.trans==='string') s.trans=c.trans;
  }
  /* THE APPLY. Every chosen slide is worked out on a copy, a slice of
     slides at a time so no task holds a long deck's page for long; then,
     in ONE task, every slide takes what was worked out and markDirty runs
     once: one undo step, however many slides, and nothing half-done if
     the deck is switched in the middle. `done` runs at the end. */
  var arBusy=false;
  function animRuleApply(rule,idxs,how,done){
    if(arBusy) return;
    rule=arNorm(rule);
    if(typeof histSettle==='function') histSettle();
    arBusy=true;
    var memo={},n=0,slides=0,k=0,deck=pres,work=[],gone=0,trN=0;
    var trSet=typeof rule.tr==='string';
    function slice(){
      if(pres!==deck){arBusy=false;return;}
      var t0=performance.now();
      /* short slices, so the frames between them are drawn */
      while(k<idxs.length&&performance.now()-t0<16){
        var si=idxs[k++],s=pres.slides[si];
        if(!s||arSkip(s)) continue;
        var tally={gone:0};
        var c=arWorkCopy(s),m=arSlide(c,rule,how,memo,{tally:tally});
        if(trSet) c.trans=rule.tr;
        if(!arSame(s,c))
          work.push({si:si,s:s,c:c,n:m,gone:tally.gone,
            tr:trSet&&s.trans!==rule.tr,len:(s.annots||[]).length});
      }
      if(k<idxs.length){setTimeout(slice,0);return;}
      finish();
    }
    function finish(){
      arBusy=false;
      if(pres!==deck) return;
      var changed=[];
      work.forEach(function(w){
        /* a slide that changed shape under the apply is left as it is */
        if(pres.slides[w.si]!==w.s||(w.s.annots||[]).length!==w.len) return;
        arLand(w.s,w.c);changed.push(w.si);
        if(w.n){n+=w.n;slides++;}
        gone+=w.gone;if(w.tr) trN++;
      });
      var keepRule=deep(rule),had=JSON.stringify(pres.animRule||null);
      if(rule.nw) pres.animRule=keepRule;
      else delete pres.animRule;
      lsSet('semopts:'+SCOPE+':animrule',JSON.stringify(keepRule),true);
      var ruleMoved=had!==JSON.stringify(pres.animRule||null);
      /* nothing to take back: no undo step, nothing redrawn */
      if(!changed.length&&!ruleMoved){
        toast(how==='replace'?'Nothing to change \u2014 the slides already '
          +'do what the rule says':'Nothing new to animate');
        if(done) done({things:0,slides:0,gone:0});
        return;
      }
      revealCount=0;
      markDirty();
      arStripMarks(changed);
      /* the slide on screen is drawn again in a task of its own, so the
         toast and the strip are not held for it: on a busy slide the
         redraw is the longest single piece of the apply */
      if(changed.indexOf(cur)>=0) setTimeout(function(){
        if(pres===deck&&!arBusy) repaintAnimation();},0);
      if(typeof animPaneSync==='function') animPaneSync();
      if(typeof animRibbonSync==='function') animRibbonSync();
      var said=[];
      if(n) said.push(n+(n===1?' thing':' things')+' animated on '+slides
        +(slides===1?' slide':' slides'));
      if(gone) said.push(gone+(gone===1?' entrance':' entrances')
        +' taken off');
      if(!said.length&&trN) said.push('Transition set on '+trN
        +(trN===1?' slide':' slides'));
      if(!said.length&&changed.length) said.push('Clicks put in order on '
        +changed.length+(changed.length===1?' slide':' slides'));
      toast(said.length?(said.join(', ')+' \u2014 Ctrl+Z undoes it')
        :(rule.nw?'Rule kept for new slides \u2014 nothing new to animate here'
          :'Rule forgotten for new slides \u2014 Ctrl+Z undoes it'));
      if(done) done({things:n,slides:slides,gone:gone});
    }
    /* the click that asked for it is answered first: the dialog goes in
       the frame after the click, and the work starts after that frame */
    requestAnimationFrame(function(){setTimeout(slice,0);});
  }
  /* THE DOOR'S SHAPE FOLLOWS ITS GROUP. In its own group (Many slides,
     the Default ribbon) it is a tile; a generated layout that files it
     among small two-row buttons -- Build order, Animate, Animation --
     makes it one of them, icon and words on one line like Animation
     panel beside it. As a tile there it was squeezed to one 26px track,
     its icon over the button above and its words over the group's name
     (2026-10-12 review). Run by applyRibbonLayout after every move. */
  function arDoorShape(){
    var b=$('#anim-rule'); if(!b) return;
    var g=b.closest('.rbn-grp');
    var small=!!(g&&!g.classList.contains('rbn-rule')
      &&g.querySelector('.rbn-row>.dbtn.rbn-sm'));
    if(b.classList.contains('rbn-sm')===small) return;
    b.classList.toggle('dbtn',small);b.classList.toggle('rbn-sm',small);
    b.classList.toggle('fx-tile',!small);b.classList.toggle('big-tile',!small);
  }
  /* the strip's rows of the slides an apply changed: their counts of
     clicks, now. Their pictures are not drawn again -- an animation is
     not in them -- and the next build of the strip keeps the rows
     (renderFilm's filmSameBut, its comparison readied in idle moments by
     filmPrimePics), so neither the first slide change after an apply
     nor its undo draws sixty thumbnails. */
  function arStripMarks(idxs){
    idxs.forEach(function(i){syncFilmBuild(i);});
    if(typeof filmPrimePics==='function') filmPrimePics(idxs);
  }
  function animRuleBoot(){
    var b=$('#anim-rule');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();
      animRuleOpen();
    });
    var d=arDlg(); if(!d) return;
    /* its rows are built while the editor is idle, so even the first
       open only has to show them (a few milliseconds, once) -- and then,
       in an idle moment of their own, laid out once where nobody sees
       it (arWarm) */
    if(typeof requestIdleCallback==='function')
      requestIdleCallback(function(){
        arBuild();
        requestIdleCallback(arWarm,{timeout:8000});
      },{timeout:5000});
    var c1=$('#anr-close'),c2=$('#anr-cancel'),go=$('#anr-apply');
    if(c1) c1.addEventListener('click',animRuleClose);
    if(c2) c2.addEventListener('click',animRuleClose);
    if(go) go.addEventListener('click',function(){
      arFromUi();
      var idx=arScope(); if(!idx.length) return;
      var rule=deep(arRule),how=arHow();
      animRuleClose();
      animRuleApply(rule,idx,how);
    });
    d.addEventListener('mousedown',function(e){
      if(e.target===d) animRuleClose();});
    var sc=$('#anr-scope'),rg=$('#anr-range');
    if(sc) sc.addEventListener('change',function(){
      arScopeSync();
      if(sc.value==='some'&&rg){try{rg.focus();rg.select();}catch(e){}}
      arScopeLive();
    });
    if(rg) rg.addEventListener('input',arScopeLive);
    var how=$('#anr-how');
    if(how) how.addEventListener('change',arLive);
    var tr=$('#anr-trans');
    if(tr) tr.addEventListener('change',arFromUi);
    var nw=$('#anr-new');
    if(nw) nw.addEventListener('change',arFromUi);
    $$('.anr-ordby',d).forEach(function(x){
      x.addEventListener('click',function(e){
        e.stopPropagation();
        arRule.by=x.getAttribute('data-by')==='place'?'place':'kind';
        arRowsOrder();arLive();
      });
    });
    /* the rows' own controls, heard once for all of them */
    var rows=$('#anr-rows');
    if(rows){
      rows.addEventListener('change',function(e){
        var t=e.target;
        if(!t||t.tagName!=='SELECT') return;
        /* By bullet put back when the start is a click again -- unless
           the by-column was chosen by hand meanwhile */
        if(t.classList.contains('anr-by')) t.removeAttribute('data-was');
        arFromUi();arLive();});
      rows.addEventListener('click',function(e){
        var b=e.target&&e.target.closest?e.target.closest('.anr-up'):null;
        if(!b||b.disabled) return;
        e.stopPropagation();
        var row=b.closest('.anr-row');
        if(row) arEarlier(row.getAttribute('data-k'));
      });
    }
    var cp=$('#anr-copy');
    if(cp) cp.addEventListener('click',function(e){
      e.stopPropagation();
      arFromUi();
      var nwWas=arRule.nw,at=arPvIdx();
      arRule=arFromSlide(pres.slides[at],arRule);
      if(nwWas) arRule.nw=1; else delete arRule.nw;
      arToUi();arLive();
      toast('Copied from slide '+(at+1));
    });
    var pl=$('#anr-play');
    if(pl) pl.addEventListener('click',function(e){
      e.stopPropagation();arPlay();});
    var q=$('#anr-q'),hl=$('#anr-help');
    if(q&&hl) q.addEventListener('click',function(e){
      e.stopPropagation();
      hl.hidden=!hl.hidden;
      q.setAttribute('aria-expanded',(!hl.hidden).toString());
    });
  }
