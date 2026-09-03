/* 52-layout-builder.js — making a slide layout of your own.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */

  /* ---- LAYOUTS OF YOUR OWN (T226) --------------------------------------
     (2026-09-03, user: "it would be great if people could make their own
     slide layouts.")

     Two things already existed and neither was this. The built-in
     LAYOUTS catalogue is a fixed table in the source. "Save this
     slide's layout" records an ARRANGEMENT -- the boxes of a slide you
     already made, kept without their words -- which is the right tool
     when the slide exists and the wrong one when it does not: you
     cannot design the shape you want and then fill it.

     So: a board, some slots, a name. What comes out is an entry in
     exactly the shape LAYOUTS uses, kept on the deck as `pres.layouts`,
     and from there it is a layout in every sense -- it appears in the
     New slide strip and in Change layout, applyLayout stamps it, and
     the picker draws its thumbnail with the same layIcon the built-ins
     use. There is no second code path; the catalogue simply got longer
     and part of it is yours. */
  var LB_SLOTS=[
    ['title','Title',{k:'text',w:88,h:12,text:'Title',size:5,b:1}],
    ['head','Heading',{k:'text',w:80,h:9,text:'Heading',size:3.6,b:1}],
    ['body','Body text',{k:'text',w:80,h:30,text:'Body text',size:2.8}],
    ['cell','Figure panel',{k:'cell',w:44,h:50}]
  ];
  var lbItems=[],lbSel=-1,lbName='',lbEdit='';
  function myLayouts(){
    if(!Array.isArray(pres.layouts)) pres.layouts=[];
    return pres.layouts;
  }
  function mintLayoutId(){
    var n=1,ids={};
    myLayouts().forEach(function(l){if(l&&l.id) ids[l.id]=1;});
    while(ids['my'+n]||layoutById('my'+n)) n++;
    return 'my'+n;
  }
  function lbClose(){
    var ov=$('#lay-make'); if(ov) overlayHide(ov);
  }
  /* the board: one absolutely-positioned proxy per slot, in page
     percent, dragged and resized the way the design screen's ghost is */
  function lbBoard(host){
    var pg=pageOf();
    var board=document.createElement('div');
    board.className='lb-board';
    board.style.aspectRatio=(pg.aw||16)+' / '+(pg.ah||9);
    lbItems.forEach(function(it,i){
      var el=document.createElement('div');
      el.className='lb-slot lb-'+(it.k==='cell'?'cell':'text')
        +(i===lbSel?' on':'');
      el.style.left=it.x+'%';el.style.top=it.y+'%';
      el.style.width=it.w+'%';el.style.height=(it.h||10)+'%';
      var lab=document.createElement('span');
      lab.className='lb-lab';
      lab.textContent=(it.k==='cell')?'Figure panel':(it.text||'Text');
      el.appendChild(lab);
      var grip=document.createElement('span');
      grip.className='lb-grip';grip.title='Drag to resize';
      el.appendChild(grip);
      function at(ev){
        var r=board.getBoundingClientRect();
        return {x:(ev.clientX-r.left)/r.width*100,
                y:(ev.clientY-r.top)/r.height*100,r:r};
      }
      function drag(ev,mode){
        ev.preventDefault();ev.stopPropagation();
        lbSel=i;
        var st=at(ev),ox=it.x,oy=it.y,ow=it.w,oh=it.h||10;
        function mv(e2){
          var p=at(e2);
          if(mode==='move'){
            it.x=Math.max(0,Math.min(100-ow,
              Math.round((ox+p.x-st.x)*10)/10));
            it.y=Math.max(0,Math.min(100-oh,
              Math.round((oy+p.y-st.y)*10)/10));
          } else {
            it.w=Math.max(5,Math.min(100-it.x,
              Math.round((ow+p.x-st.x)*10)/10));
            it.h=Math.max(4,Math.min(100-it.y,
              Math.round((oh+p.y-st.y)*10)/10));
          }
          lbRender();
        }
        function up(){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
        }
        document.addEventListener('pointermove',mv);
        document.addEventListener('pointerup',up);
      }
      el.addEventListener('pointerdown',function(e){drag(e,'move');});
      grip.addEventListener('pointerdown',function(e){drag(e,'size');});
      board.appendChild(el);
    });
    host.appendChild(board);
  }
  function lbRender(){
    var ov=$('#lay-make'); if(!ov) return;
    var body=ov.querySelector('#lay-make-body'); if(!body) return;
    var keep=body.scrollTop;
    body.innerHTML='';

    var add=document.createElement('div');add.className='lb-bar';
    var al=document.createElement('span');
    al.className='cell-lab';al.textContent='Add a slot';
    add.appendChild(al);
    LB_SLOTS.forEach(function(pr){
      var b=document.createElement('button');
      b.className='dbtn dg-b';
      b.innerHTML=bic(pr[2].k==='cell'?'cellcard':'text')+' '+esc(pr[1]);
      b.title='Put a '+pr[1].toLowerCase()+' on the layout';
      b.addEventListener('click',function(){
        var base=pr[2],y=6;
        lbItems.forEach(function(it){
          y=Math.max(y,(it.y||0)+(it.h||10)+3);});
        var it={k:base.k,x:6,y:Math.min(88,y),w:base.w,h:base.h};
        if(base.k!=='cell'){
          it.text=base.text;it.size=base.size;
          if(base.b) it.b=1;
        }
        lbItems.push(it);lbSel=lbItems.length-1;lbRender();
      });
      add.appendChild(b);
    });
    var del=document.createElement('button');
    del.className='dbtn dg-b dbtn-warn';
    del.innerHTML=bic('exit')+' Remove the chosen slot';
    del.disabled=lbSel<0;
    del.title='Take the highlighted slot off the layout';
    del.addEventListener('click',function(){
      if(lbSel<0) return;
      lbItems.splice(lbSel,1);lbSel=-1;lbRender();
    });
    add.appendChild(del);
    body.appendChild(add);

    lbBoard(body);

    /* the numbers, for the same reason the design screen has them:
       dragging is rough and typing is how two layouts agree */
    if(lbSel>=0&&lbItems[lbSel]){
      var it2=lbItems[lbSel];
      var nums=document.createElement('div');nums.className='dg-nums';
      [['x','X'],['y','Y'],['w','Width'],['h','Height']]
        .forEach(function(pr){
        var cell=document.createElement('label');cell.className='dg-num';
        var lb=document.createElement('span');lb.textContent=pr[1];
        cell.appendChild(lb);
        var inp=document.createElement('input');
        inp.type='number';inp.step='0.5';inp.min='0';inp.max='100';
        inp.value=(it2[pr[0]]!=null?it2[pr[0]]:10);
        inp.addEventListener('keydown',function(e){
          e.stopPropagation();
          if(e.key==='Enter') inp.blur();
        });
        inp.addEventListener('change',function(){
          var v=parseFloat(inp.value);
          if(isFinite(v)) it2[pr[0]]=Math.round(v*10)/10;
          lbRender();
        });
        cell.appendChild(inp);
        var pc=document.createElement('span');
        pc.className='dg-numpc';pc.textContent='%';
        cell.appendChild(pc);
        nums.appendChild(cell);
      });
      body.appendChild(nums);
    }

    var foot=document.createElement('div');foot.className='lb-foot';
    var nm=document.createElement('input');
    nm.className='lb-name';nm.type='text';nm.value=lbName;
    nm.placeholder='Call this layout';
    nm.title='The name it shows under its tile';
    nm.addEventListener('keydown',function(e){e.stopPropagation();});
    nm.addEventListener('input',function(){lbName=nm.value;});
    foot.appendChild(nm);
    var save=document.createElement('button');
    save.className='dbtn primary';
    save.innerHTML=bic('copy')+' '+(lbEdit?'Save changes':'Save this layout');
    save.disabled=!lbItems.length;
    save.title=lbItems.length
      ?'Keep it. It joins the New slide gallery and Change layout.'
      :'Put at least one slot on it first';
    save.addEventListener('click',function(){
      if(!lbItems.length) return;
      var label=(lbName||'').trim()||'My layout';
      var list=myLayouts(),hit=null;
      if(lbEdit) list.forEach(function(l){if(l.id===lbEdit) hit=l;});
      if(hit){hit.label=label;hit.items=deep(lbItems);}
      else list.push({id:mintLayoutId(),label:label,items:deep(lbItems)});
      markDirty();
      /* the pickers cache what they built, so make them build again */
      lbInvalidate();
      renderLayoutPicker();
      renderControls();
      lbClose();
      toast('“'+label+'” saved — it is in the New slide '
        +'gallery and in Change layout');
    });
    foot.appendChild(save);
    body.appendChild(foot);

    if(myLayouts().length){
      var mine=document.createElement('div');mine.className='lb-mine';
      var h=document.createElement('div');
      h.className='hd-lab';h.textContent='layouts you have made';
      mine.appendChild(h);
      myLayouts().forEach(function(l){
        var row=document.createElement('div');row.className='lb-row';
        var t=document.createElement('span');
        t.className='lb-rowt';
        t.textContent=l.label+' · '+(l.items||[]).length+' slot'
          +((l.items||[]).length===1?'':'s');
        row.appendChild(t);
        var ed=document.createElement('button');
        ed.className='dbtn dg-b';ed.textContent='Edit';
        ed.title='Open this layout on the board';
        ed.addEventListener('click',function(){
          lbEdit=l.id;lbName=l.label;lbItems=deep(l.items||[]);
          lbSel=-1;lbRender();
        });
        row.appendChild(ed);
        var rm=document.createElement('button');
        rm.className='dbtn dg-b dbtn-warn';rm.textContent='Delete';
        rm.title='Slides already laid out this way keep their boxes';
        rm.addEventListener('click',function(){
          var at=myLayouts().indexOf(l);
          if(at>=0) myLayouts().splice(at,1);
          if(lbEdit===l.id){lbEdit='';lbName='';lbItems=[];lbSel=-1;}
          markDirty();lbInvalidate();renderLayoutPicker();
          renderControls();lbRender();
        });
        row.appendChild(rm);
        mine.appendChild(row);
      });
      body.appendChild(mine);
    }
    body.scrollTop=keep;
  }
  /* the three pickers cache the family they drew; a new layout has to
     make them draw again */
  function lbInvalidate(){
    ['#layout-row','#layout-menu-grid','#layout-strip'].forEach(
      function(sel){
        var row=$(sel); if(row) delete row.dataset.built;
      });
  }
  function lbOpen(){
    var ov=$('#lay-make'),btn=$('#hm-lay-new');
    if(!ov) return;
    if(!lbEdit&&!lbItems.length){
      /* a layout that starts empty is a blank page you have to furnish;
         starting from a title is the shape almost every slide has */
      lbItems=[{k:'text',x:6,y:6,w:88,h:12,text:'Title',size:5,b:1}];
      lbName='';lbSel=0;
    }
    lbRender();
    overlayShow(btn,ov);
  }
  function layoutBuilderBoot(){
    var b=$('#hm-lay-new');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();lbOpen();});
    var c=$('#lay-make-close');
    if(c) c.addEventListener('click',lbClose);
    var n=$('#lay-make-new');
    if(n) n.addEventListener('click',function(){
      lbEdit='';lbName='';lbSel=0;
      lbItems=[{k:'text',x:6,y:6,w:88,h:12,text:'Title',size:5,b:1}];
      lbRender();
    });
  }
