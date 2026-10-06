/* 36-diagrams.js — process, cycle, list and hierarchy diagrams (T561).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- DIAGRAMS (T561) ---------------------------------------------------
     PowerPoint's SmartArt, without the second object model. A diagram is
     placed as ORDINARY OBJECTS -- a text box with a fill and an edge for
     each step (the editor's shape-with-words: it keeps a height, sits its
     words in the middle and shrinks them to fit) and an arrow between
     the steps, each end ATTACHED to its box so it follows the box when
     you move it -- all in one named group. Nothing on the slide is a
     "diagram" afterwards: the words are edited where they are, a box is
     moved, recoloured, deleted or copied like any other, Ctrl+Shift+G
     ungroups it, and the .pptx, the thumbnails, Layers and undo needed
     nothing new.
     You choose a kind, type the steps one to a line (indent a line under
     another to put it under it: a hierarchy's branches, a list's
     sub-points) and the preview is the layout the slide will get --
     drawn by the same function, so it cannot promise what Insert does
     not do. The colours are the deck's own references (@surface,
     @accent, @line, @ink, @page), so a theme change restyles a diagram
     the way it restyles everything else. */
  var DIAG_KINDS=[
    ['process','Process','Steps in order, left to right'],
    ['cycle','Cycle','Steps that come round again'],
    ['list','List','Points one under another; indent for sub-points'],
    ['hierarchy','Hierarchy','What sits under what; indent a line to '
      +'put it under the one above']];
  var DIAG_SAMPLE={
    process:'Plan\nBuild\nTest\nShip',
    cycle:'Observe\nHypothesise\nTest\nRefine',
    list:'First point\n  a detail of it\nSecond point\nThird point',
    hierarchy:'Director\n  Science\n    Models\n    Data\n  Operations\n'
      +'    Support'};
  /* how many steps each kind lays out legibly on one slide */
  var DIAG_MAX={process:8,cycle:8,list:10,hierarchy:15};
  /* where a diagram goes: clear of a title across the top */
  var DIAG_REGION={x:8,y:24,w:84,h:64};
  var diagKind='process';
  function diagClamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function diagR(v){return Math.round(v*100)/100;}
  /* one step a line; leading tabs or pairs of spaces say how deep, and a
     bullet a line was pasted with is not part of its words */
  function diagParse(txt){
    var out=[];
    String(txt||'').replace(/\r/g,'').split('\n').forEach(function(ln){
      var m=/^([ \t]*)(.*)$/.exec(ln);
      var lead=m[1].replace(/\t/g,'  ').length;
      var t=m[2].replace(/^[-*•–]\s+/,'').trim();
      if(!t) return;
      var lvl=Math.floor(lead/2);
      /* never deeper than one under the line above it */
      var prev=out.length?out[out.length-1].lvl:-1;
      out.push({text:t,lvl:Math.min(lvl,prev+1)});
    });
    return out;
  }
  /* THE LAYOUT, in page percentages: nodes {x,y,w,h,text,lvl} and links
     {a,b} between node indices (with the route each kind wants). `ar` is
     the page's width over its height, so a cycle is round and a box the
     same shape on a 16:9 slide and on an A0 poster. Pure: the preview
     and Insert both call it. */
  function diagLayout(kind,items,ar,R){
    R=R||DIAG_REGION;ar=ar>0?ar:16/9;
    var n=items.length,nodes=[],links=[],i;
    if(!n) return {nodes:nodes,links:links};
    if(kind==='process'){
      var gap=n>1?diagClamp(R.w/(n*3.2),3,6):0;
      var w=Math.min(26,(R.w-(n-1)*gap)/n);
      /* a box half again as wide as it is tall, on the page as seen */
      var h=diagClamp(w*ar/1.6,8,Math.min(R.h,22));
      var x0=R.x+(R.w-(n*w+(n-1)*gap))/2,y=R.y+(R.h-h)/2;
      items.forEach(function(it,k){
        nodes.push({x:x0+k*(w+gap),y:y,w:w,h:h,text:it.text,lvl:0});
        if(k) links.push({a:k-1,b:k});
      });
    } else if(kind==='cycle'){
      var cw=Math.min(22,R.w/(n<=4?3.4:4.4));
      var ch=diagClamp(cw*ar/1.9,7,14);
      /* round on the page as seen (rx is ry's length in width percent),
         then let out sideways on a wide page so the steps at the sides
         stand clear of the ones at the top and the foot */
      var ry=(R.h-ch)/2,rx=ry/ar*(ar>1.2?1.5:1);
      if(rx>(R.w-cw)/2){rx=(R.w-cw)/2;}
      var cx=R.x+R.w/2,cy=R.y+R.h/2;
      for(i=0;i<n;i++){
        var th=-Math.PI/2+2*Math.PI*i/n;
        var px=n>1?cx+rx*Math.cos(th):cx,py=n>1?cy+ry*Math.sin(th):cy;
        nodes.push({x:px-cw/2,y:py-ch/2,w:cw,h:ch,text:items[i].text,lvl:0});
      }
      /* each arrow bows OUT, along the ring: a fifth of its own length
         (nearly half for two steps, which then make one round), as
         `curve` measures it -- a percentage of the page's shorter side,
         negative to bow right of travel, which clockwise is outward */
      var bowOf=function(a,b){
        var dx=(nodes[b].x-nodes[a].x)*ar,dy=nodes[b].y-nodes[a].y;
        var len=Math.sqrt(dx*dx+dy*dy)*Math.max(1,1/ar);
        return -diagR(len*(n===2?0.45:0.2));
      };
      if(n>1) for(i=0;i<n;i++){
        if(n===2&&i===1){links.push({a:1,b:0,curve:bowOf(1,0)});break;}
        links.push({a:i,b:(i+1)%n,curve:bowOf(i,(i+1)%n)});
      }
    } else if(kind==='list'){
      var lg=n>1?diagClamp(R.h/(n*5),1.2,3):0;
      var lh=diagClamp((R.h-(n-1)*lg)/n,5,13);
      var LW=Math.min(R.w,72),lx=R.x+(R.w-LW)/2;
      var ly=R.y+(R.h-(n*lh+(n-1)*lg))/2;
      items.forEach(function(it,k){
        var ind=Math.min(it.lvl,3)*7;
        nodes.push({x:lx+ind,y:ly+k*(lh+lg),w:LW-ind,h:lh,text:it.text,
          lvl:it.lvl});
      });
    } else {
      /* hierarchy: a tidy tree. Each leaf gets an equal slot across the
         region and a parent sits over the middle of its children. */
      var par=[],kids=[],stack=[];
      items.forEach(function(it,k){
        while(stack.length&&items[stack[stack.length-1]].lvl>=it.lvl)
          stack.pop();
        par[k]=stack.length?stack[stack.length-1]:-1;
        kids[k]=[];
        if(par[k]>=0) kids[par[k]].push(k);
        stack.push(k);
      });
      var depth=0,leaves=0,cxs=[];
      items.forEach(function(it){depth=Math.max(depth,it.lvl+1);});
      items.forEach(function(it,k){if(!kids[k].length) leaves++;});
      var slot=R.w/leaves,leafAt=0;
      var hh=diagClamp(R.h/(depth*1.8),6,13);
      var vg=depth>1?Math.min(14,(R.h-depth*hh)/(depth-1)):0;
      var y0=R.y+(R.h-(depth*hh+(depth-1)*vg))/2;
      var hw=Math.min(24,slot*0.86);
      var place=function(k){
        if(!kids[k].length){cxs[k]=R.x+slot*(leafAt+0.5);leafAt++;}
        else {
          kids[k].forEach(place);
          var f=kids[k][0],l=kids[k][kids[k].length-1];
          cxs[k]=(cxs[f]+cxs[l])/2;
        }
      };
      items.forEach(function(it,k){if(par[k]<0) place(k);});
      items.forEach(function(it,k){
        nodes.push({x:cxs[k]-hw/2,y:y0+it.lvl*(hh+vg),w:hw,h:hh,
          text:it.text,lvl:it.lvl});
        if(par[k]>=0) links.push({a:par[k],b:k,bend:'v',nohead:1});
      });
    }
    nodes.forEach(function(nd){
      nd.x=diagR(nd.x);nd.y=diagR(nd.y);nd.w=diagR(nd.w);nd.h=diagR(nd.h);
    });
    return {nodes:nodes,links:links};
  }
  /* what each step is on the slide: a text box that keeps its height,
     words centred in it and shrunk to fit, on the deck's box colour with
     an accent edge; a hierarchy's top and a list's sub-points read
     differently, as they do in every org chart and outline */
  function diagNodeAnnot(kind,nd){
    /* no text style: a style's look is stamped onto the boxes wearing
       it, so editing Body would take every diagram's fill away */
    var a={k:'text',x:nd.x,y:nd.y,w:nd.w,h:nd.h,text:nd.text,
      size:diagR(diagClamp(nd.h*0.24,1.3,3)),fh:nd.h,va:'m',fit:'shrink',
      align:(kind==='list')?'left':'center',
      bgc:'@surface',bdc:'@accent',color:'@ink'};
    if(kind==='hierarchy'&&nd.lvl===0){a.bgc='@accent';a.color='@page';}
    if(kind==='list'&&nd.lvl>0){a.bdc='@line';a.size=diagR(a.size*0.88);}
    if(kind!=='list'||!nd.lvl) a.b=1;
    return a;
  }
  function diagLinkAnnot(L,lk,base){
    var A=L.nodes[lk.a],B=L.nodes[lk.b];
    var ar={k:'arrow',
      x1:diagR(A.x+A.w/2),y1:diagR(A.y+A.h/2),
      x2:diagR(B.x+B.w/2),y2:diagR(B.y+B.h/2),
      c1:{i:base+lk.a},c2:{i:base+lk.b},
      color:'@line',sw:SW_DEFAULT};
    if(lk.nohead) ar.nohead=1;
    if(lk.bend) ar.bend=lk.bend;
    if(lk.curve) ar.curve=lk.curve;
    return ar;
  }
  function diagPageAr(){
    var l=stage&&stage.querySelector('.annot-layer');
    var r=l&&l.getBoundingClientRect();
    return (r&&r.width>0&&r.height>0)?r.width/r.height:16/9;
  }
  function diagName(kind){
    for(var i=0;i<DIAG_KINDS.length;i++)
      if(DIAG_KINDS[i][0]===kind) return DIAG_KINDS[i][1];
    return 'Diagram';
  }
  /* put it on the slide: one group, one undo step, all of it selected */
  function diagInsert(kind,items){
    var s=pres.slides[cur]; if(!s||!items.length) return 0;
    var max=DIAG_MAX[kind]||12,cut=items.length>max;
    items=items.slice(0,max);
    var L=diagLayout(kind,items,diagPageAr(),DIAG_REGION);
    s.annots=s.annots||[];
    var base=s.annots.length,gid=nextGrp(s),idxs=[];
    L.nodes.forEach(function(nd){
      var a=diagNodeAnnot(kind,nd);a.grp=gid;
      s.annots.push(a);idxs.push(s.annots.length-1);
    });
    L.links.forEach(function(lk){
      var a=diagLinkAnnot(L,lk,base);a.grp=gid;
      s.annots.push(a);idxs.push(s.annots.length-1);
    });
    grpMeta(s,gid).name=diagName(kind);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectMany(l,idxs);}
    if(typeof renderFilm==='function') renderFilm();
    toast(diagName(kind)+' added — ordinary boxes and arrows in one '
      +'group: double-click a box to type in it'
      +(cut?' (the first '+max+' lines; more would not read)':''));
    return idxs.length;
  }
  /* ---- THE DIALOG ------------------------------------------------------ */
  /* the preview: the very layout Insert will place, drawn small in the
     deck's own colours */
  function diagPreviewSvg(kind,items,ar){
    var W=176,H=Math.round(W/ar);
    var L=diagLayout(kind,items.slice(0,DIAG_MAX[kind]||12),ar,DIAG_REGION);
    var col=function(t,f){return (typeof tokVal==='function'?tokVal(t):'')||f;};
    var page=col('@page','#0b141d'),surf=col('@surface','#16273a');
    var acc=col('@accent','#39a9c0'),line=col('@line','#8aa0b0');
    var p=function(v,d){return Math.round(v/100*d*10)/10;};
    var out=['<svg class="dgm-svg" viewBox="0 0 '+W+' '+H+'" width="'+W
      +'" height="'+H+'" aria-hidden="true"><rect width="'+W+'" height="'
      +H+'" fill="'+page+'"/>'];
    L.links.forEach(function(lk){
      var A=L.nodes[lk.a],B=L.nodes[lk.b];
      var x1=p(A.x+A.w/2,W),y1=p(A.y+A.h/2,H),x2=p(B.x+B.w/2,W),
        y2=p(B.y+B.h/2,H),d;
      if(lk.bend==='v'){
        var my=(y1+y2)/2;
        d='M'+x1+' '+y1+'V'+my+'H'+x2+'V'+y2;
      } else if(lk.curve){
        var mx=(x1+x2)/2,mmy=(y1+y2)/2,dx=x2-x1,dy=y2-y1,
          len=Math.sqrt(dx*dx+dy*dy)||1,bow=lk.curve/100*Math.min(W,H);
        d='M'+x1+' '+y1+'Q'+(mx-dy/len*bow)+' '+(mmy+dx/len*bow)+' '+x2+' '+y2;
      } else d='M'+x1+' '+y1+'L'+x2+' '+y2;
      out.push('<path d="'+d+'" fill="none" stroke="'+line+'" stroke-width="1"/>');
    });
    L.nodes.forEach(function(nd){
      var top=(kind==='hierarchy'&&nd.lvl===0);
      out.push('<rect x="'+p(nd.x,W)+'" y="'+p(nd.y,H)+'" width="'
        +p(nd.w,W)+'" height="'+p(nd.h,H)+'" rx="1.5" fill="'
        +(top?acc:surf)+'" stroke="'+(kind==='list'&&nd.lvl?line:acc)
        +'" stroke-width=".8"/>');
    });
    out.push('</svg>');
    return out.join('');
  }
  function diagSync(){
    var ta=$('#dgm-text'),pv=$('#dgm-preview'),go=$('#dgm-insert');
    if(!ta||!pv) return;
    var items=diagParse(ta.value);
    pv.innerHTML=diagPreviewSvg(diagKind,items,diagPageAr());
    var max=DIAG_MAX[diagKind]||12;
    var nt=$('#dgm-count');
    if(nt) nt.textContent=items.length?(Math.min(items.length,max)
      +' box'+(Math.min(items.length,max)===1?'':'es')
      +(items.length>max?' — the first '+max+' of '+items.length:''))
      :'Type one step to a line';
    if(go) go.disabled=!items.length;
    $$('#dgm-kinds .dgm-kind').forEach(function(b){
      var on=b.dataset.kind===diagKind;
      b.classList.toggle('on',on);b.setAttribute('aria-pressed',on.toString());
    });
  }
  /* another kind keeps the words you typed -- trying your steps as a
     cycle instead of a process is the point of the choice -- and swaps
     an untouched example for its own */
  function diagPick(kind){
    var ta=$('#dgm-text'); if(!ta) return;
    var now=ta.value;
    if(!now.trim()||now===DIAG_SAMPLE[diagKind]) ta.value=DIAG_SAMPLE[kind];
    diagKind=kind;
    diagSync();
  }
  /* Tab and Shift+Tab move the line the caret is on in and out, the way
     the outline of every slide program does */
  function diagIndent(ta,out){
    var v=ta.value,a=ta.selectionStart,b=ta.selectionEnd;
    var st=v.lastIndexOf('\n',a-1)+1;
    if(out){
      var cut=/^( {1,2}|\t)/.exec(v.slice(st));
      if(!cut) return;
      ta.value=v.slice(0,st)+v.slice(st+cut[0].length);
      ta.selectionStart=Math.max(st,a-cut[0].length);
      ta.selectionEnd=Math.max(st,b-cut[0].length);
    } else {
      ta.value=v.slice(0,st)+'  '+v.slice(st);
      ta.selectionStart=a+2;ta.selectionEnd=b+2;
    }
    diagSync();
  }
  function diagOpen(){
    var d=$('#dgm-dlg'); if(!d) return;
    if(mode!=='edit'||!pres.slides[cur]) return;
    var box=$('#dgm-kinds');
    if(box&&!box.childNodes.length){
      DIAG_KINDS.forEach(function(k){
        var b=document.createElement('button');
        b.type='button';b.className='dgm-kind';b.dataset.kind=k[0];
        b.title=k[2];
        b.innerHTML=diagPreviewSvg(k[0],diagParse(DIAG_SAMPLE[k[0]]),16/9)
          .replace('class="dgm-svg"','class="dgm-mini"')
          +'<span class="dgm-kn">'+k[1]+'</span>';
        b.addEventListener('click',function(e){
          diagPick(k[0]);
          /* a mouse pick hands the keys back to the steps, so Ctrl+Enter
             inserts (on a focused tile Enter is the tile's own) */
          if(e.detail>0){var t=$('#dgm-text'); if(t) try{t.focus();}catch(x){}}
        });
        box.appendChild(b);
      });
    }
    var ta=$('#dgm-text');
    if(ta&&!ta.value.trim()) ta.value=DIAG_SAMPLE[diagKind];
    d.hidden=false;
    diagSync();
    setTimeout(function(){
      if(ta){try{ta.focus();ta.select();}catch(e){}}},0);
  }
  function diagClose(){var d=$('#dgm-dlg'); if(d) d.hidden=true;}
  function diagramBoot(){
    var b=$('#dc-diagram');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();diagOpen();});
    var ta=$('#dgm-text');
    if(ta){
      ta.addEventListener('input',diagSync);
      ta.addEventListener('keydown',function(e){
        if(e.key!=='Tab'||e.ctrlKey||e.metaKey||e.altKey) return;
        e.preventDefault();diagIndent(ta,e.shiftKey);
      });
    }
    var c1=$('#dgm-close'),c2=$('#dgm-cancel'),go=$('#dgm-insert');
    if(c1) c1.addEventListener('click',diagClose);
    if(c2) c2.addEventListener('click',diagClose);
    if(go) go.addEventListener('click',function(){
      var items=diagParse(ta?ta.value:'');
      if(!items.length) return;
      diagClose();
      diagInsert(diagKind,items);
    });
    var d=$('#dgm-dlg');
    if(d) d.addEventListener('mousedown',function(e){
      if(e.target===d) diagClose();});
  }
