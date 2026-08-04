
(function(){
  var deckEl=document.getElementById('deck');
  if(!deckEl) return;
  var APP=window.SemApp||{mode:'static',shells:{},order:[],
    project:{presentations:[],recent:[]}};

  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  function esc(t){var d=document.createElement('div');d.textContent=(t==null?'':String(t));return d.innerHTML;}
  function deep(o){return JSON.parse(JSON.stringify(o));}

  var stage=$('#deck-stage');
  /* layouts are just preset ARRANGEMENTS of cell frames (percent rects);
     every box on a slide is a "+ Cell" frame — movable and resizable */
  var PRESETS={
    full:[[3,4,94,91]],
    halves:[[2,7,47.5,86],[50.5,7,47.5,86]],
    rows:[[6,2,88,47],[6,51,88,47]],
    quarters:[[2,2,47.5,47],[50.5,2,47.5,47],
              [2,51,47.5,47],[50.5,51,47.5,47]]
  };
  /* the slide-template catalog: each layout is a list of typed slots —
     notebook-card frames (k:'cell') and plain text boxes (k:'text', with a
     placeholder + size). A title slide is simply two text boxes; there is no
     special title mode. h on a text slot is only used to draw the picker
     preview (the real text box auto-sizes to its content). */
  var LAYOUTS=[
    {id:'title',label:'Title',items:[
      {k:'text',x:12,y:33,w:76,h:16,text:'Presentation title',size:7,b:1,
        align:'center'},
      {k:'text',x:12,y:55,w:76,h:8,text:'Subtitle',size:3.4,align:'center'}]},
    {id:'section',label:'Section',items:[
      {k:'text',x:8,y:41,w:84,h:18,text:'Section',size:8,b:1,
        align:'center'}]},
    {id:'title-body',label:'Title + text',items:[
      {k:'text',x:6,y:6,w:88,h:12,text:'Title',size:5,b:1},
      {k:'text',x:6,y:24,w:88,h:64,text:'Body text',size:3}]},
    {id:'full',label:'One panel',items:[
      {k:'cell',x:3,y:4,w:94,h:91}]},
    {id:'title-full',label:'Title + panel',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'cell',x:4,y:20,w:92,h:76}]},
    {id:'halves',label:'Two panels',items:[
      {k:'cell',x:2,y:7,w:47.5,h:86},{k:'cell',x:50.5,y:7,w:47.5,h:86}]},
    {id:'title-halves',label:'Title + two',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'cell',x:3,y:20,w:46.5,h:76},{k:'cell',x:50.5,y:20,w:46.5,h:76}]},
    {id:'rows',label:'Stacked',items:[
      {k:'cell',x:6,y:2,w:88,h:47},{k:'cell',x:6,y:51,w:88,h:47}]},
    {id:'title-rows',label:'Title + stack',items:[
      {k:'text',x:5,y:4,w:90,h:10,text:'Title',size:5,b:1},
      {k:'cell',x:6,y:17,w:88,h:39},{k:'cell',x:6,y:58,w:88,h:39}]},
    {id:'quarters',label:'Four panels',items:[
      {k:'cell',x:2,y:2,w:47.5,h:47},{k:'cell',x:50.5,y:2,w:47.5,h:47},
      {k:'cell',x:2,y:51,w:47.5,h:47},{k:'cell',x:50.5,y:51,w:47.5,h:47}]},
    {id:'text-cell',label:'Text | panel',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'text',x:5,y:23,w:40,h:60,text:'Body text',size:3},
      {k:'cell',x:49,y:20,w:47,h:76}]},
    {id:'cell-text',label:'Panel | text',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'cell',x:4,y:20,w:47,h:76},
      {k:'text',x:56,y:23,w:39,h:60,text:'Body text',size:3}]},
    {id:'cell-above',label:'Panel / text',items:[
      {k:'cell',x:4,y:4,w:92,h:62},
      {k:'text',x:6,y:70,w:88,h:26,text:'Body text',size:2.8}]},
    {id:'text-above',label:'Text / panel',items:[
      {k:'text',x:6,y:5,w:88,h:14,text:'Title',size:4.4,b:1},
      {k:'cell',x:4,y:22,w:92,h:74}]},
    {id:'blank',label:'Blank',items:[]},
    /* ---- POSTER templates -------------------------------------------
       Modelled on what actually hangs in a conference poster hall: a title
       banner over authors/affiliation, NUMBERED section headings (a reader
       walking past needs to know the reading order), prose for
       Introduction / Discussion / Conclusions and figure panels for
       Results, and a footer for references, funding and contact. The
       headings are real text boxes, so they are editable like anything
       else. `land:1` marks the templates shaped for a landscape page.
       Text `size` is a % of page HEIGHT, so the landscape templates carry
       larger numbers for the same physical type size. ---- */
    {id:'poster-3col',label:'3 columns · classic',poster:1,items:[
      {k:'text',x:3,y:1.4,w:94,h:3.6,
        text:'Poster title — the finding in one line',size:3.1,b:1,
        align:'center'},
      {k:'text',x:8,y:5.4,w:84,h:2.2,
        text:'Author, Author · Institution · contact@institution.edu',
        size:1.4,align:'center'},
      {k:'text',x:2.5,y:9.2,w:29.7,h:2.6,text:'1 · Introduction',
        size:1.9,b:1},
      {k:'text',x:2.5,y:12.4,w:29.7,h:13,
        text:'Why this matters, the question you asked, and what was '
          +'already known.',size:1.35},
      {k:'text',x:2.5,y:26.8,w:29.7,h:2.6,text:'2 · Data & methods',
        size:1.9,b:1},
      {k:'text',x:2.5,y:30,w:29.7,h:10.5,
        text:'Data sources, processing and the analysis in brief.',
        size:1.35},
      {k:'cell',x:2.5,y:42,w:29.7,h:22},
      {k:'text',x:2.5,y:65.6,w:29.7,h:2.6,text:'3 · Key numbers',
        size:1.9,b:1},
      {k:'cell',x:2.5,y:68.8,w:29.7,h:22.8},
      {k:'text',x:35.15,y:9.2,w:29.7,h:2.6,text:'4 · Results',
        size:1.9,b:1},
      {k:'cell',x:35.15,y:12.4,w:29.7,h:37.5},
      {k:'cell',x:35.15,y:51.5,w:29.7,h:40.1},
      {k:'text',x:67.8,y:9.2,w:29.7,h:2.6,text:'5 · Results continued',
        size:1.9,b:1},
      {k:'cell',x:67.8,y:12.4,w:29.7,h:29},
      {k:'text',x:67.8,y:43,w:29.7,h:2.6,text:'6 · Discussion',
        size:1.9,b:1},
      {k:'text',x:67.8,y:46.2,w:29.7,h:17.5,
        text:'What the results mean, and the caveats.',size:1.35},
      {k:'text',x:67.8,y:65.6,w:29.7,h:2.6,text:'7 · Conclusions',
        size:1.9,b:1},
      {k:'text',x:67.8,y:68.8,w:29.7,h:22.8,
        text:'The take-home messages, as short bullets.',size:1.4},
      {k:'text',x:2.5,y:93.4,w:95,h:4.6,
        text:'References · Funding & acknowledgements · '
          +'Code and data: github.com/…',size:1.1}]},
    {id:'poster-2col',label:'2 columns · wide figures',poster:1,items:[
      {k:'text',x:3,y:1.4,w:94,h:3.8,text:'Poster title',size:3.3,b:1,
        align:'center'},
      {k:'text',x:8,y:5.6,w:84,h:2.2,
        text:'Author, Author · Institution',size:1.5,align:'center'},
      {k:'text',x:2.5,y:9.4,w:46,h:2.8,text:'1 · Introduction',
        size:2.1,b:1},
      {k:'text',x:2.5,y:12.8,w:46,h:14,
        text:'Motivation, the question, and the gap this fills.',
        size:1.5},
      {k:'text',x:2.5,y:28.2,w:46,h:2.8,text:'2 · Methods',size:2.1,b:1},
      {k:'text',x:2.5,y:31.6,w:46,h:12.5,
        text:'Data and analysis, in enough detail to be believed.',
        size:1.5},
      {k:'cell',x:2.5,y:45.6,w:46,h:24},
      {k:'text',x:2.5,y:71.4,w:46,h:2.8,text:'4 · Take-home message',
        size:2.1,b:1},
      {k:'text',x:2.5,y:74.8,w:46,h:15,
        text:'The one thing you want remembered.',size:1.7,b:1},
      {k:'text',x:51.5,y:9.4,w:46,h:2.8,text:'3 · Results',size:2.1,b:1},
      {k:'cell',x:51.5,y:12.8,w:46,h:37},
      {k:'cell',x:51.5,y:51.2,w:46,h:38.6},
      {k:'text',x:2.5,y:92,w:95,h:5.5,
        text:'References · Acknowledgements · contact@institution.edu',
        size:1.2}]},
    {id:'poster-fig',label:'Hero figure',poster:1,items:[
      {k:'text',x:3,y:1.4,w:94,h:3.6,text:'Poster title',size:3.1,b:1,
        align:'center'},
      {k:'text',x:8,y:5.4,w:84,h:2.2,
        text:'Author, Author · Institution',size:1.4,align:'center'},
      {k:'text',x:2.5,y:9.4,w:95,h:2.8,text:'Headline result',
        size:2,b:1},
      {k:'cell',x:2.5,y:12.8,w:95,h:42},
      {k:'text',x:2.5,y:56.4,w:95,h:2.6,text:'Supporting evidence',
        size:1.8,b:1},
      {k:'cell',x:2.5,y:59.8,w:29.7,h:22},
      {k:'cell',x:35.15,y:59.8,w:29.7,h:22},
      {k:'cell',x:67.8,y:59.8,w:29.7,h:22},
      {k:'text',x:2.5,y:83.6,w:46,h:2.6,text:'What it means',
        size:1.8,b:1},
      {k:'text',x:2.5,y:86.8,w:46,h:8,
        text:'Interpretation and limitations.',size:1.35},
      {k:'text',x:51.5,y:83.6,w:46,h:2.6,text:'Methods in brief',
        size:1.8,b:1},
      {k:'text',x:51.5,y:86.8,w:46,h:8,
        text:'Data, model, validation.',size:1.35},
      {k:'text',x:2.5,y:95.6,w:95,h:3.6,
        text:'References · contact@institution.edu',size:1}]},
    {id:'poster-flow',label:'Intro → results → conclusions',poster:1,
      items:[
      {k:'text',x:3,y:1.4,w:94,h:3.6,text:'Poster title',size:3.1,b:1,
        align:'center'},
      {k:'text',x:8,y:5.4,w:84,h:2.2,
        text:'Author, Author · Institution',size:1.4,align:'center'},
      {k:'text',x:2.5,y:9.4,w:95,h:2.6,text:'1 · Introduction',
        size:1.9,b:1},
      {k:'text',x:2.5,y:12.6,w:95,h:7.5,
        text:'Motivation, question, and data — two or three sentences.',
        size:1.4},
      {k:'text',x:2.5,y:21.6,w:95,h:2.6,text:'2 · Results',size:1.9,b:1},
      {k:'cell',x:2.5,y:24.8,w:46,h:32},
      {k:'cell',x:51.5,y:24.8,w:46,h:32},
      {k:'cell',x:2.5,y:58.4,w:46,h:27},
      {k:'cell',x:51.5,y:58.4,w:46,h:27},
      {k:'text',x:2.5,y:87,w:95,h:2.6,text:'3 · Conclusions',
        size:1.9,b:1},
      {k:'text',x:2.5,y:90.2,w:95,h:6,
        text:'What it means, and what is next.',size:1.4},
      {k:'text',x:2.5,y:96.8,w:95,h:2.8,
        text:'References · Acknowledgements · contact@institution.edu',
        size:1}]},
    {id:'poster-billboard',label:'Billboard · one big message',poster:1,
      items:[
      {k:'text',x:3,y:1.6,w:94,h:3.2,text:'Poster title',size:2.6,b:1,
        align:'center'},
      {k:'text',x:8,y:5.2,w:84,h:2,
        text:'Author, Author · Institution',size:1.3,align:'center'},
      {k:'text',x:5,y:9.6,w:90,h:15,
        text:'The one sentence a passer-by should remember.',
        size:4.6,b:1,align:'center'},
      {k:'cell',x:5,y:26.5,w:90,h:37},
      {k:'text',x:2.5,y:66,w:29.7,h:2.6,text:'Why it matters',
        size:1.7,b:1},
      {k:'text',x:2.5,y:69.2,w:29.7,h:20,
        text:'The problem, in plain words.',size:1.25},
      {k:'text',x:35.15,y:66,w:29.7,h:2.6,text:'How we did it',
        size:1.7,b:1},
      {k:'text',x:35.15,y:69.2,w:29.7,h:20,
        text:'Data, method, validation.',size:1.25},
      {k:'text',x:67.8,y:66,w:29.7,h:2.6,text:'Detail & references',
        size:1.7,b:1},
      {k:'text',x:67.8,y:69.2,w:29.7,h:20,
        text:'Caveats, citations, funding.',size:1.25},
      {k:'text',x:2.5,y:91,w:95,h:3.4,
        text:'Paper, code and data: github.com/… · contact@institution.edu',
        size:1.05,align:'center'}]},
    {id:'poster-4col',label:'4 columns · dense',poster:1,items:[
      {k:'text',x:3,y:1.2,w:94,h:3.2,text:'Poster title',size:2.9,b:1,
        align:'center'},
      {k:'text',x:8,y:4.9,w:84,h:2,
        text:'Author, Author · Institution',size:1.3,align:'center'},
      {k:'text',x:2.5,y:8.8,w:21.87,h:2.4,text:'1 · Introduction',
        size:1.7,b:1},
      {k:'text',x:2.5,y:11.8,w:21.87,h:16,
        text:'Motivation and question.',size:1.25},
      {k:'text',x:2.5,y:29.2,w:21.87,h:2.4,text:'2 · Methods',
        size:1.7,b:1},
      {k:'text',x:2.5,y:32.2,w:21.87,h:14,
        text:'Data and analysis.',size:1.25},
      {k:'cell',x:2.5,y:47.6,w:21.87,h:20},
      {k:'cell',x:2.5,y:69,w:21.87,h:22.5},
      {k:'text',x:26.87,y:8.8,w:21.87,h:2.4,text:'3 · Results',
        size:1.7,b:1},
      {k:'cell',x:26.87,y:11.8,w:21.87,h:26},
      {k:'cell',x:26.87,y:39.6,w:21.87,h:26},
      {k:'cell',x:26.87,y:67.4,w:21.87,h:24.1},
      {k:'text',x:51.25,y:8.8,w:21.87,h:2.4,text:'4 · Results continued',
        size:1.7,b:1},
      {k:'cell',x:51.25,y:11.8,w:21.87,h:26},
      {k:'cell',x:51.25,y:39.6,w:21.87,h:26},
      {k:'cell',x:51.25,y:67.4,w:21.87,h:24.1},
      {k:'text',x:75.62,y:8.8,w:21.87,h:2.4,text:'5 · Discussion',
        size:1.7,b:1},
      {k:'text',x:75.62,y:11.8,w:21.87,h:24,
        text:'Interpretation and caveats.',size:1.25},
      {k:'text',x:75.62,y:37.2,w:21.87,h:2.4,text:'6 · Conclusions',
        size:1.7,b:1},
      {k:'text',x:75.62,y:40.2,w:21.87,h:22,
        text:'The take-home messages.',size:1.3},
      {k:'text',x:75.62,y:63.8,w:21.87,h:2.4,text:'References',
        size:1.7,b:1},
      {k:'text',x:75.62,y:66.8,w:21.87,h:24.7,
        text:'Citations and funding.',size:1.05},
      {k:'text',x:2.5,y:93,w:95,h:5,
        text:'Acknowledgements · contact@institution.edu',size:1.05}]},
    {id:'poster-land3',label:'Landscape · 3 columns',poster:1,land:1,
      items:[
      {k:'text',x:2.5,y:2.2,w:95,h:6,text:'Poster title',size:4.4,b:1,
        align:'center'},
      {k:'text',x:10,y:9,w:80,h:3.4,
        text:'Author, Author · Institution · contact@institution.edu',
        size:2,align:'center'},
      {k:'text',x:2.5,y:15.5,w:29.7,h:4,text:'1 · Introduction',
        size:2.6,b:1},
      {k:'text',x:2.5,y:20.5,w:29.7,h:20,
        text:'Motivation, the question, and what was already known.',
        size:1.85},
      {k:'text',x:2.5,y:42.5,w:29.7,h:4,text:'2 · Methods',size:2.6,b:1},
      {k:'text',x:2.5,y:47.5,w:29.7,h:16,
        text:'Data sources and analysis.',size:1.85},
      {k:'cell',x:2.5,y:65.5,w:29.7,h:22.5},
      {k:'text',x:35.15,y:15.5,w:29.7,h:4,text:'3 · Results',
        size:2.6,b:1},
      {k:'cell',x:35.15,y:20.5,w:29.7,h:32},
      {k:'cell',x:35.15,y:54.5,w:29.7,h:33.5},
      {k:'text',x:67.8,y:15.5,w:29.7,h:4,text:'4 · Discussion',
        size:2.6,b:1},
      {k:'text',x:67.8,y:20.5,w:29.7,h:23,
        text:'What the results mean, and the caveats.',size:1.85},
      {k:'text',x:67.8,y:45.5,w:29.7,h:4,text:'5 · Conclusions',
        size:2.6,b:1},
      {k:'text',x:67.8,y:50.5,w:29.7,h:37.5,
        text:'The take-home messages, as short bullets.',size:1.9},
      {k:'text',x:2.5,y:89.5,w:95,h:7,
        text:'References · Funding · Code and data: github.com/…',
        size:1.5}]},
    {id:'poster-land-fig',label:'Landscape · hero + notes',poster:1,
      land:1,items:[
      {k:'text',x:2.5,y:2.2,w:95,h:6,text:'Poster title',size:4.4,b:1,
        align:'center'},
      {k:'text',x:10,y:9,w:80,h:3.2,
        text:'Author, Author · Institution',size:1.9,align:'center'},
      {k:'text',x:2.5,y:15.5,w:63,h:4,text:'Headline result',
        size:2.6,b:1},
      {k:'cell',x:2.5,y:20.5,w:63,h:60},
      {k:'text',x:2.5,y:82,w:63,h:6.5,
        text:'What this figure shows, and the key numbers.',size:1.6},
      {k:'text',x:67.8,y:15.5,w:29.7,h:4,text:'Introduction',
        size:2.4,b:1},
      {k:'text',x:67.8,y:20.5,w:29.7,h:22,
        text:'Motivation and question.',size:1.8},
      {k:'text',x:67.8,y:44,w:29.7,h:4,text:'Methods',size:2.4,b:1},
      {k:'text',x:67.8,y:49,w:29.7,h:14,
        text:'Data and analysis.',size:1.8},
      {k:'text',x:67.8,y:64.5,w:29.7,h:4,text:'Conclusions',
        size:2.4,b:1},
      {k:'text',x:67.8,y:69.5,w:29.7,h:19,
        text:'The take-home messages.',size:1.85},
      {k:'text',x:2.5,y:89.5,w:95,h:7,
        text:'References · Acknowledgements · contact@institution.edu',
        size:1.5}]}
  ];
  var LAYOUTBYID={};
  LAYOUTS.forEach(function(l){LAYOUTBYID[l.id]=l;});
  /* apply a template to a slide: reposition the cards/text it already has
     into the template's slots (in order), fill empty slots with placeholders,
     and keep any free decorations (arrows/images/shapes) the user added. */
  function applyLayout(s,layout){
    if(!s||!layout) return;
    s.layout='blank';s.lay=layout.id;
    var old=s.annots||[];
    var cells=old.filter(function(a){return a.k==='cell';});
    var texts=old.filter(function(a){return a.k==='text';});
    var keep=old.filter(function(a){return a.k!=='cell'&&a.k!=='text';});
    var ci=0,ti=0,next=[];
    (layout.items||[]).forEach(function(it){
      if(it.k==='cell'){
        var c=cells[ci++]||{k:'cell',ref:null};
        c.k='cell';c.x=it.x;c.y=it.y;c.w=it.w;c.h=it.h;
        next.push(c);
      } else {
        var t=texts[ti++];
        if(t){t.x=it.x;t.y=it.y;t.w=it.w;
          if(!t.text) t.text=it.text||'Text';
          next.push(t);
        } else next.push({k:'text',x:it.x,y:it.y,w:it.w,
          text:it.text||'Text',size:it.size||2.8,color:'#ffffff',
          bg:0,align:it.align||'left',b:it.b?1:0});
      }
    });
    /* don't lose placed cards / typed text beyond the template's slots */
    for(;ci<cells.length;ci++) if(cells[ci].ref) next.push(cells[ci]);
    for(;ti<texts.length;ti++) next.push(texts[ti]);
    s.annots=keep.concat(next);
    if(!s.annots.length) delete s.annots;
  }
  function layIcon(layout){
    var ic=document.createElement('span');ic.className='layico2';
    /* a poster template previews at its OWN aspect — a landscape template
       drawn in a portrait box is unrecognisable */
    if(layout.poster)
      ic.style.aspectRatio=layout.land?'1189 / 841':'841 / 1189';
    (layout.items||[]).forEach(function(it){
      var b=document.createElement('span');
      b.className=(it.k==='text'?'li-text':'li-cell');
      b.style.left=it.x+'%';b.style.top=it.y+'%';
      b.style.width=(it.w||20)+'%';b.style.height=(it.h||20)+'%';
      ic.appendChild(b);
    });
    return ic;
  }
  function renderLayoutPicker(){
    /* the same catalog renders twice: in the builder panel (create mode)
       and in the ribbon's Layouts dropdown (edit mode). A poster page is
       offered POSTER templates ONLY and a slide page SLIDE templates only
       — the other family was never applicable, just noise to scroll past
       (2026-07-29). Within the poster family, the templates shaped like
       the current page come first. */
    var pg=pageOf();
    var isPoster=!!pg.poster;
    var land=pg.aw>pg.ah;
    var variant=(isPoster?'p':'s')+(land?'l':'p');
    ['#layout-row','#layout-menu-grid'].forEach(function(sel){
      var row=$(sel); if(!row||row.dataset.built===variant) return;
      row.dataset.built=variant;row.innerHTML='';
      var list=LAYOUTS.filter(function(l){return !!l.poster===isPoster;});
      if(isPoster) list=list.slice().sort(function(a,b){
        return (!!a.land===land?0:1)-(!!b.land===land?0:1);});
      var h=document.createElement('div');h.className='lay-sec';
      h.textContent=isPoster?'Poster layouts':'Slide layouts';
      row.appendChild(h);
      list.forEach(function(layout){
        var b=document.createElement('button');
        b.className='dbtn lay';b.dataset.lay=layout.id;b.type='button';
        b.title=layout.label;
        b.appendChild(layIcon(layout));
        var lb=document.createElement('span');lb.className='lay-lb';
        lb.textContent=layout.label;b.appendChild(lb);
        b.addEventListener('click',function(){
          var s=pres.slides[cur]; if(!s) return;
          applyLayout(s,layout);
          activePane=-1;markDirty();refresh();
          closeLayMenu();
        });
        row.appendChild(b);
      });
    });
  }
  /* the ribbon's Layouts / Page dropdowns: open one, the other closes */
  function closeLayMenu(){
    var lm=$('#lay-menu'),lb=$('#lay-btn');
    if(lm&&!lm.hidden){lm.hidden=true;
      if(lb) lb.setAttribute('aria-expanded','false');}
  }
  function closePageMenu(){
    var pm=$('#page-menu'),pb=$('#page-btn');
    if(pm&&!pm.hidden){pm.hidden=true;
      if(pb) pb.setAttribute('aria-expanded','false');}
  }
  /* ---- page size: slides or a poster — ONE builder for both. The page
     is a per-presentation preset; a poster is just a big page. ---- */
  var PAGE_PRESETS=[
    {id:'16x9',label:'Slides 16:9',aw:16,ah:9,mm:[339,191]},
    {id:'4x3',label:'Slides 4:3',aw:4,ah:3,mm:[254,190]},
    {id:'a4p',label:'A4 portrait',aw:210,ah:297,mm:[210,297]},
    {id:'a4l',label:'A4 landscape',aw:297,ah:210,mm:[297,210]},
    /* poster:1 = "this is a poster" — it selects the poster template
       family and the bigger editor chrome. A4 is a page, not a poster. */
    {id:'a1p',label:'Poster A1 portrait',aw:594,ah:841,mm:[594,841],
      poster:1},
    {id:'a1l',label:'Poster A1 landscape',aw:841,ah:594,mm:[841,594],
      poster:1},
    {id:'a0p',label:'Poster A0 portrait',aw:841,ah:1189,mm:[841,1189],
      poster:1},
    {id:'a0l',label:'Poster A0 landscape',aw:1189,ah:841,mm:[1189,841],
      poster:1}];
  function pageOf(){
    var id=pres&&pres.page;
    for(var i=0;i<PAGE_PRESETS.length;i++)
      if(PAGE_PRESETS[i].id===id) return PAGE_PRESETS[i];
    return PAGE_PRESETS[0];
  }
  var deckZoom=0;               /* 0 = fit-to-window */
  function applyPage(){
    var pg=pageOf();
    deckEl.style.setProperty('--page-ar',pg.aw+' / '+pg.ah);
    deckEl.classList.toggle('custom-page',pg.id!=='16x9');
    /* poster work happens at arm's length from a wall-sized page — the
       editor's own chrome grows to match (2026-07-29) */
    deckEl.classList.toggle('poster-page',!!pg.poster);
    var b=$('#page-btn');
    if(b) b.innerHTML='&#9645; '
      +(pg.id==='16x9'?'Page':esc(pg.label))+' &#9662;';
    $$('#page-menu .page-opt').forEach(function(o){
      o.setAttribute('aria-pressed',
        (o.dataset.page===pg.id).toString());});
    renderLayoutPicker();   /* poster pages list poster templates first */
  }
  function sizeSlideTo(slideEl,zoom){
    var pg=pageOf();
    var pad=36;
    var aw=stage.clientWidth-pad,ah=stage.clientHeight-pad;
    if(!slideEl||aw<=60||ah<=60) return;
    var fitW=Math.min(aw,ah*pg.aw/pg.ah);
    var w=fitW*(zoom||1),h=w*pg.ah/pg.aw;
    slideEl.style.width=w+'px';
    slideEl.style.height=h+'px';
    /* the stylesheet's flex:1 / max-height:100% must not fight the explicit
       page size — else zoom grows width-only (distortion) and playback
       letterboxing never bites */
    slideEl.style.flex='none';
    slideEl.style.maxWidth='none';
    slideEl.style.maxHeight='none';
    slideEl.style.margin='auto';
    stage.classList.toggle('zoomed',w>aw+1||h>ah+1);
  }
  function applyZoom(){
    if(deckEl.hidden) return;
    var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
    if(mode==='edit'){
      sizeSlideTo(slideEl,deckZoom||1);
      var zl=$('#zoom-val');
      if(zl) zl.textContent=deckZoom
        ?Math.round(deckZoom*100)+'%':'Fit';
    } else if(deckEl.classList.contains('custom-page')){
      /* playing a poster / portrait page letterboxes to the page */
      sizeSlideTo(slideEl,1);
    }
  }
  function setZoom(z){deckZoom=z;applyZoom();}
  (function(){
    var zi=$('#zoom-in'),zo=$('#zoom-out'),zv=$('#zoom-val');
    if(zi) zi.addEventListener('click',function(){
      setZoom(Math.min(6,(deckZoom||1)*1.25));});
    if(zo) zo.addEventListener('click',function(){
      setZoom(Math.max(0.25,(deckZoom||1)/1.25));});
    if(zv) zv.addEventListener('click',function(){setZoom(0);});
    window.addEventListener('resize',function(){
      if(!deckEl.hidden) applyZoom();});
    /* the ribbon's height CHANGES now (the contextual format groups
       leave the layout when hidden), and so does the page picker — any
       toolbar reflow resizes the stage, so the page re-fits itself
       rather than waiting for a window resize */
    if(window.ResizeObserver){
      var et=$('#edit-tools');
      if(et) new ResizeObserver(function(){
        if(!deckEl.hidden) applyZoom();}).observe(et);
    }
    /* trackpad pinch (and ctrl+scroll) zooms the PAGE, not the browser:
       a Windows precision-trackpad pinch arrives as a wheel event with
       ctrlKey=true (macOS Chrome reports the same; meta accepted to
       match the editor's other shortcuts). The point under the cursor
       stays put: measure the slide before and after, then correct the
       stage scroll — rect math survives the margin:auto centring and
       the .zoomed overflow flip without reproducing either. */
    stage.addEventListener('wheel',function(e){
      if(!(e.ctrlKey||e.metaKey)||mode!=='edit'||deckEl.hidden) return;
      e.preventDefault();
      var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
      var r=slideEl.getBoundingClientRect();
      if(!r.width||!r.height) return;
      var fx=(e.clientX-r.left)/r.width,
          fy=(e.clientY-r.top)/r.height;
      var z=Math.min(6,Math.max(0.25,
        (deckZoom||1)*Math.exp(-e.deltaY*0.002)));
      setZoom(z);
      /* setZoom is synchronous: .zoomed (overflow:auto) is already on
         when these scroll writes land */
      var nr=slideEl.getBoundingClientRect();
      stage.scrollLeft+=(nr.left+fx*nr.width)-e.clientX;
      stage.scrollTop+=(nr.top+fy*nr.height)-e.clientY;
    },{passive:false});
    /* over the rest of the open editor (ribbon, film strip, panes) a
       pinch must not browser-zoom the whole app either — swallow it,
       without zooming the page */
    deckEl.addEventListener('wheel',function(e){
      if((e.ctrlKey||e.metaKey)&&!deckEl.hidden) e.preventDefault();
    },{passive:false});
  })();
  (function(){
    var pb=$('#page-btn'),pm=$('#page-menu'),pd=$('#page-drop');
    if(!pb||!pm) return;
    PAGE_PRESETS.forEach(function(pg){
      var o=document.createElement('button');
      o.className='dc-mi page-opt';o.type='button';
      o.dataset.page=pg.id;
      o.textContent=pg.label
        +(pg.id==='16x9'?'':' · '+pg.mm[0]+'×'+pg.mm[1]+' mm');
      o.addEventListener('click',function(e){
        e.stopPropagation();
        if(pg.id==='16x9') delete pres.page; else pres.page=pg.id;
        pm.hidden=true;pb.setAttribute('aria-expanded','false');
        deckZoom=0;
        markDirty();applyPage();refresh();
      });
      pm.appendChild(o);
    });
    pb.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=pm.hidden;
      if(willOpen) closeLayMenu();
      pm.hidden=!willOpen;
      pb.setAttribute('aria-expanded',willOpen.toString());
    });
    document.addEventListener('click',function(e){
      if(!pm.hidden&&pd&&!pd.contains(e.target)){
        pm.hidden=true;pb.setAttribute('aria-expanded','false');}
    });
  })();
  /* ---- Objects pane (layers v1): list / select / hide / lock ---- */
  function annotLabel(a){
    if(a.k==='cell'){
      var it=a.ref?resolveRef(a.ref):null;
      return it?it.title:'Empty frame';
    }
    if(a.k==='text')
      return 'Text — '+(String(a.text||'').trim().slice(0,26)||'(empty)');
    if(a.k==='image') return 'Image';
    if(a.k==='arrow') return 'Arrow';
    if(a.k==='rect') return 'Shape — '+(a.shape||'box');
    return a.k;
  }
  function renderSelPane(){
    var pane=$('#selpane'),list=$('#selpane-list');
    if(!pane||pane.hidden||!list) return;
    list.innerHTML='';
    var s=pres.slides[cur];
    var ann=(s&&s.annots)||[];
    if(!ann.length){
      list.innerHTML='<div class="selpane-empty">Nothing on this '
        +'slide yet.</div>';
      return;
    }
    /* handlers resolve the CURRENT slide's annot at event time (never a
       closure) — the pane can't mutate or repaint a stale slide */
    function liveAnnot(i){
      var s2=pres.slides[cur];
      return (s2&&s2.annots||[])[i]||null;
    }
    function toggleFlag(i,flag){
      var a2=liveAnnot(i);
      if(!a2){renderSelPane();return;}
      if(a2[flag]) delete a2[flag]; else a2[flag]=1;
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}
      renderSelPane();
    }
    function row(a,i){
      var r=document.createElement('div');
      r.className='sp-row'+(selSet.indexOf(i)>=0?' sel':'')
        +(a.hide?' offrow':'');
      var k=document.createElement('span');
      k.className='sp-kind k-'+a.k;r.appendChild(k);
      var t=document.createElement('span');t.className='sp-t';
      t.textContent=annotLabel(a);t.title=t.textContent;
      r.appendChild(t);
      var eye=document.createElement('button');
      eye.className='sp-act'+(a.hide?' on':'');eye.type='button';
      eye.innerHTML='&#128065;';
      eye.title=a.hide?'Show while editing'
        :'Hide while editing (still shows when presenting)';
      eye.addEventListener('click',function(e){
        e.stopPropagation();toggleFlag(i,'hide');});
      r.appendChild(eye);
      var lk=document.createElement('button');
      lk.className='sp-act'+(a.lock?' on':'');lk.type='button';
      lk.innerHTML='&#128274;';
      lk.title=a.lock?'Unlock':'Lock (can’t be clicked or '
        +'dragged on the canvas)';
      lk.addEventListener('click',function(e){
        e.stopPropagation();toggleFlag(i,'lock');});
      r.appendChild(lk);
      r.addEventListener('click',function(){
        if(!liveAnnot(i)){renderSelPane();return;}
        var l=stage.querySelector('.annot-layer');
        if(l) selectAnnot(l,i);
        renderSelPane();
      });
      list.appendChild(r);
    }
    for(var i=ann.length-1;i>=0;i--) row(ann[i],i);  /* front-most first */
  }
  (function(){
    var ob=$('#objects-btn'),pane=$('#selpane'),cl=$('#selpane-close');
    if(!ob||!pane) return;
    function set(open){
      pane.hidden=!open;
      ob.setAttribute('aria-pressed',open.toString());
      if(open) renderSelPane();
    }
    ob.addEventListener('click',function(){set(pane.hidden);});
    if(cl) cl.addEventListener('click',function(){set(false);});
  })();
  (function(){
    var lb=$('#lay-btn'),lm=$('#lay-menu'),ld=$('#lay-drop');
    if(!lb||!lm) return;
    lb.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=lm.hidden;
      if(willOpen) closePageMenu();
      lm.hidden=!willOpen;
      lb.setAttribute('aria-expanded',willOpen.toString());
    });
    document.addEventListener('click',function(e){
      if(!lm.hidden&&ld&&!ld.contains(e.target)) closeLayMenu();
    });
  })();
  function slideCells(s){
    return (s&&s.annots||[]).map(function(a,i){return {a:a,i:i};})
      .filter(function(p){return p.a.k==='cell';});
  }

  /* ---------- registry: every open notebook's cards ----------
     Refs are namespaced "stem::anchor" so one deck can mix cards from
     every open tab; plain legacy anchors still resolve. */
  var ITEMS={};        /* ns -> item {..., nb, ns} */
  var SHELLITEMS={};   /* stem -> [ns, ...] in document order */
  var nbPres=[];       /* presentations embedded in notebooks (namespaced) */
  function nsKey(stem,anchor){return stem+'::'+anchor;}
  function splitRef(ref){
    var i=String(ref).indexOf('::');
    return i<0?[null,String(ref)]:[String(ref).slice(0,i),String(ref).slice(i+2)];
  }
  function resolveRef(ref){
    if(!ref) return null;
    if(ITEMS[ref]) return ITEMS[ref];
    if(String(ref).indexOf('::')>=0) return null;
    for(var s=0;s<APP.order.length;s++){
      var k=nsKey(APP.order[s],ref);
      if(ITEMS[k]) return ITEMS[k];
    }
    return null;
  }
  function normRef(ref){
    if(!ref) return null;
    var it=resolveRef(ref);
    return it?it.ns:String(ref);
  }
  function normPres(p,stem){
    /* deep-copy a presentation, namespacing plain anchors (against
       `stem` when it came from one notebook, else best-effort);
       folder, title-slide text and free annotations ride along.
       Legacy grid-pane slides convert to preset cell-frame layouts. */
    /* A CUSTOM VIEW has no slides to normalise — and it must keep kind /
       nb / style / view or it comes back as a plain deck and clicking its
       row opens the slide editor instead (that was the bug where a custom
       view "took you to the presentation below it"). */
    if(p&&p.kind==='view'){
      var v={name:String(p.name||'view'),kind:'view',slides:[],
        nb:typeof p.nb==='string'?p.nb:'',
        style:p.style?JSON.parse(JSON.stringify(p.style)):{},
        view:p.view?JSON.parse(JSON.stringify(p.view)):{}};
      if(typeof p.folder==='string'&&p.folder) v.folder=p.folder;
      return v;
    }
    function ns(a){
      if(!a) return null;
      if(String(a).indexOf('::')>=0) return a;
      return stem?nsKey(stem,a):(normRef(a)||a);
    }
    var out={name:String(p.name||'presentation'),
      slides:(p.slides||[]).map(function(s){
        var o={layout:s.layout,
          panes:(s.panes||[]).map(ns)};
        if(s.layout==='title'){
          o.title=String(s.title||'');o.sub=String(s.sub||'');
          if(s.tprops) o.tprops=JSON.parse(JSON.stringify(s.tprops));
          if(s.sprops) o.sprops=JSON.parse(JSON.stringify(s.sprops));
        }
        if(Array.isArray(s.annots)&&s.annots.length)
          o.annots=JSON.parse(JSON.stringify(s.annots));
        (o.annots||[]).forEach(function(a){
          if(a.k==='cell'&&a.ref) a.ref=ns(a.ref);
        });
        /* steps hidden in the code trace (namespaced refs) */
        if(Array.isArray(s.hidden)&&s.hidden.length)
          o.hidden=s.hidden.map(ns).filter(Boolean);
        /* legacy pane layouts -> cell frames at the preset rects */
        if(o.layout!=='title'){
          if(PRESETS[o.layout]){
            var rects=PRESETS[o.layout];
            o.annots=o.annots||[];
            for(var i=0;i<rects.length;i++){
              o.annots.push({k:'cell',x:rects[i][0],y:rects[i][1],
                w:rects[i][2],h:rects[i][3],
                ref:o.panes[i]||null});
            }
          }
          o.layout='blank';
        }
        o.panes=[];
        return o;
      })};
    if(typeof p.folder==='string'&&p.folder) out.folder=p.folder;
    if(p.showNums) out.showNums=1;   /* keep the slide-numbers preference */
    if(typeof p.page==='string'&&p.page) out.page=p.page;  /* page preset */
    return out;
  }
  function registerShell(stem,data){
    Object.keys(ITEMS).forEach(function(k){
      if(ITEMS[k].nb===stem) delete ITEMS[k];});
    SHELLITEMS[stem]=[];
    (data.items||[]).forEach(function(it){
      var o={};for(var k in it) o[k]=it[k];
      o.nb=stem;o.ns=nsKey(stem,it.anchor);
      ITEMS[o.ns]=o;SHELLITEMS[stem].push(o.ns);
      /* also resolve by the card slug so decks saved before anchors
         became positional still find their frames (unchanged cards) */
      if(it.card){
        var alias=nsKey(stem,it.card);
        if(alias!==o.ns&&!ITEMS[alias]) ITEMS[alias]=o;
      }
    });
    nbPres=nbPres.filter(function(p){return p.origin!==stem;});
    (data.presentations||[]).forEach(function(p){
      var cp=normPres(p,stem);cp.origin=stem;nbPres.push(cp);
    });
  }
  function unregisterShell(stem){
    Object.keys(ITEMS).forEach(function(k){
      if(ITEMS[k].nb===stem) delete ITEMS[k];});
    delete SHELLITEMS[stem];
    nbPres=nbPres.filter(function(p){return p.origin!==stem;});
  }
  APP.order.forEach(function(stem){
    registerShell(stem,APP.shells[stem].data||{});});

  /* ---------- saved presentations: project file + notebook-embedded --- */
  var projectPres=(APP.project&&Array.isArray(APP.project.presentations))
    ?deep(APP.project.presentations).map(function(p){return normPres(p);})
    :[];
  function allSaved(){
    var out=[],seen={};
    projectPres.forEach(function(p){out.push(p);seen[p.name]=1;});
    nbPres.forEach(function(p){
      var n=p.name;
      if(seen[n]) n=p.name+' ('+p.origin+')';
      if(seen[n]) return;
      var cp=deep(p);cp.name=n;out.push(cp);seen[n]=1;
    });
    return out;
  }
  function savedByName(name){
    return allSaved().filter(function(p){return p.name===name;})[0]||null;
  }

  /* ---------- draft persistence scope ---------- */
  var SCOPE=APP.mode==='app'?'proj:'+(APP.root||'')
    :APP.mode==='web'?'web:'+location.pathname
    :(APP.order.length>1
      ?'bundle:'+APP.order.slice().sort().join('+')
      :(APP.order[0]||document.title));
  var PFX='sempres:'+SCOPE+':';
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function loadDraft(name){
    var raw=lsGet(PFX+name); if(!raw) return null;
    try{var d=JSON.parse(raw);
      return (d&&Array.isArray(d.slides))?normPres(d):null;
    }catch(e){return null;}
  }
  function draftNames(){
    var out=[];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k&&k.indexOf(PFX)===0){
          var nm=k.slice(PFX.length);
          if(nm&&nm!=='last'&&out.indexOf(nm)<0) out.push(nm);
        }
      }
    }catch(e){}
    return out.sort();
  }
  function fullFrame(ref){
    var r=PRESETS.full[0];
    return {k:'cell',x:r[0],y:r[1],w:r[2],h:r[3],ref:ref||null};
  }
  function emptySlide(){
    return {layout:'blank',panes:[],annots:[fullFrame(null)]};
  }
  function autoSlides(withDocs){
    var out=[];
    APP.order.forEach(function(stem){
      (SHELLITEMS[stem]||[]).forEach(function(ns){
        var it=ITEMS[ns];
        var fig=it.kind==='figure'||it.kind==='diagnostic';
        if(fig||(withDocs&&it.kind==='note'))
          out.push({layout:'blank',panes:[],
            annots:[fullFrame(ns)]});
      });
    });
    return out;
  }
  function defaultPres(){return {name:'presentation',slides:autoSlides(false)};}

  var pres=null, source='auto', mode='view', cur=0, activePane=0;
  function loadPresentation(name){
    deckZoom=0;   /* zoom is per-session, reset per presentation */
    var d=loadDraft(name);
    if(d){pres=d;source='draft';histReset();return;}
    var s=savedByName(name);
    if(s){pres=normPres(deep(s));source='saved';histReset();return;}
    pres=defaultPres();source='auto';histReset();
  }
  var last=lsGet(PFX+'last');
  if(last&&(loadDraft(last)||savedByName(last))) loadPresentation(last);
  else if(allSaved().length) loadPresentation(allSaved()[0].name);
  else {pres=defaultPres();source='auto';}

  var saveStamp=null,saveKind='';
  function fmtT(d){
    var h=d.getHours(),m=d.getMinutes();
    return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
  }
  function status(){
    var el=$('#deck-status');
    var auto=APP.mode==='app'
      &&(typeof autosaveOn==='undefined'||autosaveOn);
    if(source==='draft'){
      /* web/static Save writes to the browser but keeps source='draft';
         show a plain 'saved' — the Save button tooltip explains where */
      if(APP.mode!=='app'&&saveKind==='manual'&&saveStamp){
        el.textContent='saved · '+fmtT(saveStamp);
        el.className='deck-status saved';
        return;
      }
      el.textContent=auto?'unsaved — saving…':'unsaved';
    } else if(source==='saved'){
      el.textContent=saveStamp
        ?((saveKind==='auto'?'autosaved · ':'saved · ')+fmtT(saveStamp))
        :'saved';
    } else el.textContent='';
    el.className='deck-status '+source;
  }
  function markDirty(){
    source='draft';
    saveKind='';
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
    status();
    scheduleAutosave();
    histPush();
    renderSelPane();   /* keep the Objects pane in step (no-op if closed) */
  }
  /* ---------- undo / redo (snapshots of the slide content) ---------- */
  var undoStack=[],redoStack=[],histSnap=null;
  function histState(){
    return JSON.stringify({slides:pres.slides||[],showNums:pres.showNums||0});
  }
  function histReset(){
    histSnap=histState();undoStack=[];redoStack=[];updateUndoBtns();
  }
  function histPush(){
    var st=histState();
    if(st===histSnap) return;         /* nothing actually changed */
    undoStack.push(histSnap);
    if(undoStack.length>50) undoStack.shift();
    redoStack.length=0;histSnap=st;updateUndoBtns();
  }
  function histRestore(snap){
    var d;try{d=JSON.parse(snap);}catch(e){return;}
    pres.slides=d.slides||[];
    if(d.showNums) pres.showNums=1; else delete pres.showNums;
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;selAnnot=null;selSet=[];
    /* persist WITHOUT recording a new history entry */
    source='draft';
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    status();scheduleAutosave();refresh();
    /* nothing is selected after a restore — clear the format bar + Delete */
    var db=$('#et-del'); if(db) db.disabled=true;
    if(typeof showFmt==='function') showFmt();
  }
  function undo(){
    if(!undoStack.length) return;
    redoStack.push(histSnap);histSnap=undoStack.pop();
    updateUndoBtns();histRestore(histSnap);
  }
  function redo(){
    if(!redoStack.length) return;
    undoStack.push(histSnap);histSnap=redoStack.pop();
    updateUndoBtns();histRestore(histSnap);
  }
  function updateUndoBtns(){
    var u=$('#dc-undo'),r=$('#dc-redo');
    if(u) u.disabled=!undoStack.length;
    if(r) r.disabled=!redoStack.length;
  }

  /* ---------- DOM cloning from the cards already on the page ---------- */
  function cardEl(ref){
    var it=resolveRef(ref); if(!it) return null;
    var sh=APP.shells[it.nb]; if(!sh) return null;
    return sh.el.querySelector(
      '.card[data-anchor="'+String(it.anchor).replace(/"/g,'\\"')+'"]');
  }
  function stripIds(node){
    if(node.removeAttribute) node.removeAttribute('id');
    $$('[id]',node).forEach(function(n){n.removeAttribute('id');});
    return node;
  }
  /* per-frame figure history: every successful live clone is remembered;
     on a notebook reload those become the "previous figure" a frame can
     revert to (session-only — snapshots never enter the saved deck) */
  var frameSnaps={},frameSnapsPrev={};
  var frozenFrames=new WeakMap();   /* annot -> snapshot html it shows */
  function cloneBody(ref){
    var c=cardEl(ref); if(!c) return null;
    var b=$('.cardbody',c); if(!b) return null;
    b=stripIds(b.cloneNode(true));
    /* the DOCUMENT's filter state (hidden plot types, folded/hidden parts)
       must not ride into slides — a placed frame shows its part in full */
    $$('.pt-off,.pt-fold,.ot-off,.ot-fold,.part-off,.part-fold,.code-off',b)
      .forEach(function(n){
        ['pt-off','pt-fold','pt-open','ot-off','ot-fold','ot-open',
         'part-off','part-fold','part-open','code-off']
          .forEach(function(cl){n.classList.remove(cl);});
      });
    /* per-output fold stubs are filter chrome, not content */
    $$('.ot-stub',b).forEach(function(n){n.remove();});
    $$('.figpager-nav',b).forEach(function(n){n.style.display='';});
    var it=resolveRef(ref);
    if(it) frameSnaps[it.ns]=b.outerHTML;
    return b;
  }
  function cloneCode(ref){
    var c=cardEl(ref); if(!c) return null;
    var inner=$('.codeinner',c); if(!inner) return null;
    return stripIds(inner.cloneNode(true));
  }
  /* a cell can contribute several things to a slide: its CODE, its
     FIGURE(s) and its printed OUTPUT. A frame shows one 'part'. */
  function cellFacets(ref){
    var card=cardEl(ref);
    var it=resolveRef(ref);
    var f={code:!!(it&&it.hasCode),figure:false,output:false};
    if(card){
      if(!f.code&&card.querySelector('.codeinner')) f.code=true;
      var body=$('.cardbody',card);
      if(body){
        /* live embeds (plotly/bokeh/vega/folium) are figures too */
        f.figure=!!body.querySelector('.figframe,.figpager,.plotframe');
        f.output=!!body.querySelector(
          'pre.result,pre.stream,.rich:not(.plotframe),.jv-xr,.note')
          ||(!f.figure&&!!(body.textContent||'').trim());
      }
    }
    return f;
  }
  function autoPart(f){
    return f.figure?'figure':(f.output?'output':(f.code?'code':'body'));
  }
  function hasFacet(f,part){
    return (part==='code'&&f.code)||(part==='figure'&&f.figure)
      ||(part==='output'&&f.output);
  }
  function partOf(a){
    var f=cellFacets(a.ref);
    /* honor the chosen part only if the cell STILL has it (a refresh may
       have removed the figure/output) — else fall back to auto */
    if(a.part&&a.part!=='auto'&&hasFacet(f,a.part)) return a.part;
    return autoPart(f);
  }
  function applyPartFilter(b,part){
    if(part==='figure'){
      /* the figure part is JUST the figure — drop outputs AND any markdown
         note / caption that rides along in the card body (a .plotframe is
         a live figure, e.g. bokeh/vega/folium — keep it) */
      $$('.cb-out,.jv-xr,pre.result,pre.stream,.rich:not(.plotframe),'
        +'.note,.note-src,.htmltoggle,.caption',b)
        .forEach(function(n){if(n.parentNode) n.parentNode.removeChild(n);});
    } else if(part==='output'){
      $$('.cb-fig,.figframe,.figpager,.plotframe',b).forEach(function(n){
        if(n.parentNode) n.parentNode.removeChild(n);});
    }
    return b;
  }
  function framePart(ref,part){
    var f=cellFacets(ref);
    if(!part||part==='auto'||!hasFacet(f,part)) part=autoPart(f);
    if(part==='code') return cloneCode(ref)||cloneBody(ref);
    var b=cloneBody(ref);
    if(!b) return cloneCode(ref);
    return applyPartFilter(b,part);
  }
  /* ---- figure LOCKS: a frame pinned to a git commit renders that
     commit's card (fetched once, cached) — refresh never touches it, and
     the source notebook doesn't even have to be open ---- */
  var verCards={},verMeta={},verPending={};
  function lockParts(a){
    var r=normRef(a.ref)||String(a.ref||'');
    var pr=splitRef(r);
    if(!pr[0]) return null;
    var path=nbPathFor(pr[0]);
    if(!path||/^https?:/i.test(path)) return null;
    return {stem:pr[0],anchor:pr[1],path:path,
      key:path+'@'+a.lockver.commit+'::'+pr[1],
      pkey:path+'@'+a.lockver.commit};
  }
  function fetchVerCards(path,commit,anchors){
    var pkey=path+'@'+commit;
    var pend=verPending[pkey]=verPending[pkey]||{};
    anchors=anchors.filter(function(an){
      return verCards[pkey+'::'+an]===undefined&&!pend[an];});
    if(!anchors.length) return Promise.resolve();
    anchors.forEach(function(an){pend[an]=1;});
    return APP.api('/api/versioncards',
      {path:path,commit:commit,anchors:anchors})
    .then(function(j){
      verMeta[pkey]={msg:j.msg||'',date:j.date||''};
      anchors.forEach(function(an){
        verCards[pkey+'::'+an]=(j.cards||{})[an]||null;
        delete pend[an];
      });
      var l=stage.querySelector('.annot-layer');
      var s=pres.slides[cur];
      if(l&&s&&!deckEl.hidden){renderAnnots(l,s);paintSel(l);}
    }).catch(function(){
      anchors.forEach(function(an){
        verCards[pkey+'::'+an]=null;delete pend[an];});
    });
  }
  /* undefined = loading, null = unavailable, object = the card */
  function verCardFor(a){
    if(!(a.lockver&&a.lockver.commit)||APP.mode!=='app') return null;
    var lp=lockParts(a); if(!lp) return null;
    var hit=verCards[lp.key];
    if(hit!==undefined) return hit;
    fetchVerCards(lp.path,a.lockver.commit,[lp.anchor]);
    return undefined;
  }
  function frameFromVerCard(card,part){
    var t=document.createElement('template');t.innerHTML=card.html||'';
    var b=t.content.querySelector('.cardbody');
    if(!b) return null;
    b=stripIds(b.cloneNode(true));
    return framePartFromSnap(b.outerHTML,part);
  }
  function lockChip(c,a,ok){
    c.classList.add('an-locked-ver');
    var lp=lockParts(a);
    var meta=(lp&&verMeta[lp.pkey])||{};
    var msg=a.lockver.msg||meta.msg||'';
    var date=a.lockver.date||meta.date||'';
    var fz=document.createElement('span');
    fz.className='an-lockchip'+(ok?'':' warn');
    fz.textContent='🔒 '+a.lockver.commit;
    fz.title=(ok?'Locked to commit ':'Locked to commit (content '
      +'unavailable — showing live) ')+a.lockver.commit
      +(msg?' — “'+msg+'”':'')+(date?' · '+date:'')
      +'\nRefresh never changes this frame. Unlock via the ribbon.';
    c.appendChild(fz);
  }
  /* render a frame from a REMEMBERED body (the pre-refresh figure) */
  function framePartFromSnap(html,part){
    var t=document.createElement('template');
    t.innerHTML=html;
    var b=t.content.firstElementChild;
    if(!b) return null;
    b=b.cloneNode(true);
    var hasFig=!!b.querySelector('.figframe,.figpager,.plotframe');
    if(!part||part==='auto'||part==='code')
      part=hasFig?'figure':'output';   /* snapshots hold no code part */
    return applyPartFilter(b,part);
  }
  function facetList(ref){
    var f=cellFacets(ref),out=[];
    if(f.figure) out.push('figure');
    if(f.output) out.push('output');
    if(f.code) out.push('code');
    return out;
  }
  /* split a frame into two adjacent frames — one per part (e.g. the
     figure beside its code), each labelled */
  function splitFrame(ai){
    var s=pres.slides[cur]; if(!s) return;
    var a=(s.annots||[])[ai]; if(!a||a.k!=='cell'||!a.ref) return;
    var facs=facetList(a.ref); if(facs.length<2) return;
    var cur0=partOf(a);
    var other=facs.filter(function(x){return x!==cur0;})[0];
    a.part=cur0;
    var w=a.w||46,h=a.h||56,x=a.x||6,y=a.y||6;
    /* split WITHIN the frame's own bounds so the two never overflow or
       overlap: side by side if wide enough, otherwise stacked */
    var half=(w-2)/2;
    if(half>=16){
      a.w=half;
      s.annots.push({k:'cell',ref:a.ref,part:other,
        x:x+half+2,y:y,w:w-half-2,h:h});
    } else {
      var hh=Math.max(16,(h-2)/2);
      a.h=hh;
      s.annots.push({k:'cell',ref:a.ref,part:other,
        x:x,y:y+hh+2,w:w,h:h-hh-2>=16?h-hh-2:hh});
    }
    markDirty();refresh();
  }
  /* the code/figure/output picker shown on a filled frame (+ split) */
  function buildPartChooser(s,ai){
    var a=(s.annots||[])[ai]; if(!a||!a.ref) return null;
    var facs=facetList(a.ref); if(facs.length<2) return null;
    var curp=partOf(a);
    var box=document.createElement('div');box.className='cellparts';
    /* let draw tools (edit mode) still start a shape over the button;
       in the builder (create) or select tool the button always acts */
    function guardDown(e){if(mode!=='edit'||tool==='select') e.stopPropagation();}
    function armed(){return mode!=='edit'||tool==='select';}
    facs.forEach(function(fp){
      var b=document.createElement('button');
      b.className='cellpartbtn'+(fp===curp?' on':'');
      b.textContent=fp;
      b.title='Show the '+fp+' in this frame';
      b.addEventListener('mousedown',guardDown);
      b.addEventListener('click',function(e){
        if(!armed()) return;
        e.stopPropagation();
        if(partOf(a)===fp&&a.part) return;
        a.part=fp;markDirty();refresh();});
      box.appendChild(b);
    });
    var sp=document.createElement('button');
    sp.className='cellpartbtn split';sp.innerHTML='&#9707; split';
    sp.title='Split into two frames — one for each part';
    sp.addEventListener('mousedown',guardDown);
    sp.addEventListener('click',function(e){
      if(!armed()) return;
      e.stopPropagation();splitFrame(ai);});
    box.appendChild(sp);
    return box;
  }
  function typeset(el){
    if(window.MathJax&&MathJax.typesetPromise){
      MathJax.typesetPromise([el]).catch(function(){});}
  }
  function multiNb(){return APP.order.length>1;}
  function nbChip(cls,stem){
    var c=document.createElement('span');c.className=cls;
    c.textContent=stem;return c;
  }
  /* ---------- view mode: slide rendering + vertical code trail ------
     Horizontal = the story; vertical = how each slide was made. Every
     framed card contributes its full upstream chain (open data ->
     transforms -> plot), deduped, in execution order — one cell per
     screen below the slide. */
  var vGroups=[];
  var traceSel=0;          /* which plot's trace shows (thumbnail pick) */
  var traceView='cells';   /* 'cells' list or 'tree' (docs tree, reused) */
  var TRACE_COLORS=['#39a9c0','#ff6b57','#f0a848','#46a892',
    '#c98fd0','#5b8dd6'];
  function hiddenSet(s){
    var h={};(s&&s.hidden||[]).forEach(function(r){h[r]=1;});return h;
  }
  function toggleHidden(s,ns){
    if(!s) return;
    s.hidden=s.hidden||[];
    var i=s.hidden.indexOf(ns);
    if(i>=0) s.hidden.splice(i,1); else s.hidden.push(ns);
    markDirty();
  }
  /* ---- reusable code trace used by the presentation's slide code-trail
     (the docs "Plot trace" instead opens a tab of cloned docs cards) ----
     spec = { groups:[{it,steps,color}], list:()=>[ns hidden],
              toggle:(ns)=>void (persist), showHiddenRef:{v:bool} } */
  function renderTrace(spec){
    spec.showHiddenRef=spec.showHiddenRef||{v:false};
    function rebuild(oldNode){
      var fresh=traceNode(spec,rebuild);
      if(oldNode&&oldNode.parentNode)
        oldNode.parentNode.replaceChild(fresh,oldNode);
      return fresh;
    }
    return rebuild(null);
  }
  /* the presentation wrapper: groups come from the slide's framed plots */
  function buildTrace(s){
    return renderTrace({
      groups:vGroups,
      list:function(){return (s&&s.hidden)||[];},
      toggle:function(ns){toggleHidden(s,ns);}
    });
  }
  /* one lineage group for a SINGLE plot/item (the docs popup) */
  function lineageForItem(ns){
    var it=ITEMS[ns]; if(!it) return null;
    var steps=[],seen={};
    (it.chain||[]).forEach(function(anchor){
      var up=ITEMS[nsKey(it.nb,anchor)];
      /* markdown notes that name a lineage variable ride along in the trace */
      if(up&&(up.hasCode||up.kind==='note')&&!seen[up.ns]){
        seen[up.ns]=1;steps.push(up);}
    });
    if(it.hasCode&&!seen[it.ns]) steps.push(it);
    return {it:it,steps:steps,color:TRACE_COLORS[0]};
  }
  /* ---- per-plot dependency graph (the docs popup) ---- */
  var NODE_FILL={figure:'#39a9c0',diagnostic:'#39a9c0',dataset:'#4d90c0',
    transform:'#5b7589',metric:'#46a892',note:'#cf9a4e',text:'#8ba0b2',
    imports:'#a3855c','function':'#46a892',data:'#4d90c0',constant:'#9a7cc0',
    settings:'#5b7589',plotting:'#39a9c0',print:'#cf9a4e',code:'#8ba0b2'};
  function nodeColor(st){
    if(st.kind==='figure'||st.kind==='diagnostic') return NODE_FILL.figure;
    if(st.kind==='note') return NODE_FILL.note;
    var cks=st.codeKinds||[st.codeKind||'code'];
    return NODE_FILL[cks[0]]||NODE_FILL[st.kind]||'#8ba0b2';
  }
  var SVGNS='http://www.w3.org/2000/svg';
  /* ---- shapes for the "+ Shapes" tool. Geometric ones are SVG <path>s in a
     0..100 box (stretched to the frame, non-scaling stroke); !/? are glyphs.
     'rect' + 'ellipse' stay CSS-drawn (see the an-rect renderer). ---- */
  var SHAPE_PATHS={
    triangle:'M50 6 L95 92 L5 92 Z',
    diamond:'M50 4 L96 50 L50 96 L4 50 Z',
    pentagon:'M50 5 L95 39 L77 93 L23 93 L5 39 Z',
    hexagon:'M27 6 H73 L97 50 L73 94 H27 L3 50 Z',
    star:'M50 3 L61 37 H97 L68 59 L79 95 L50 73 L21 95 L32 59 L3 37 H39 Z',
    cross:'M37 5 H63 V37 H95 V63 H63 V95 H37 V63 H5 V37 H37 Z',
    arrow:'M5 36 H60 V18 L96 50 L60 82 V64 H5 Z',
    heart:'M50 90 C6 56 12 16 50 40 C88 16 94 56 50 90 Z',
    cloud:'M30 82 C12 82 6 58 24 52 C20 30 52 22 58 38 '
      +'C72 26 92 40 84 56 C98 58 96 82 78 82 Z',
    bubble:'M8 8 H92 V66 H44 L24 90 V66 H8 Z',
    lightning:'M58 4 L20 56 H46 L38 96 L82 40 H54 Z'
  };
  var SHAPE_GLYPH={exclaim:'!',question:'?'};
  /* menu order + short labels */
  var SHAPE_LIST=[
    ['rect','Rectangle'],['ellipse','Ellipse'],['triangle','Triangle'],
    ['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],
    ['star','Star'],['cross','Plus'],['arrow','Arrow'],['heart','Heart'],
    ['cloud','Cloud'],['bubble','Speech'],['lightning','Bolt'],
    ['exclaim','Exclaim'],['question','Question']];
  function drawShapeSvg(shp,col,sw,dash,fill){
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','an-shape-svg');
    svg.setAttribute('viewBox','0 0 100 100');
    if(SHAPE_GLYPH[shp]){
      svg.setAttribute('preserveAspectRatio','xMidYMid meet');
      var tx=document.createElementNS(SVGNS,'text');
      tx.setAttribute('x','50');tx.setAttribute('y','54');
      tx.setAttribute('text-anchor','middle');
      tx.setAttribute('dominant-baseline','central');
      tx.setAttribute('font-size','104');tx.setAttribute('font-weight','800');
      tx.setAttribute('fill',col);   /* font comes from CSS (.an-shape-svg text) */
      tx.textContent=SHAPE_GLYPH[shp];
      svg.appendChild(tx);
    } else {
      svg.setAttribute('preserveAspectRatio','none');
      var p=document.createElementNS(SVGNS,'path');
      p.setAttribute('d',SHAPE_PATHS[shp]||'');
      p.setAttribute('fill',fill?shapeFill(col,0x2b/255):'none');
      p.setAttribute('stroke',col);
      p.setAttribute('stroke-width',sw||3);
      p.setAttribute('vector-effect','non-scaling-stroke');
      p.setAttribute('stroke-linejoin','round');
      if(dash) p.setAttribute('stroke-dasharray','7 6');
      svg.appendChild(p);
    }
    return svg;
  }
  function plotGraph(group,onNode){
    if(!group) return null;
    /* the dependency graph is CODE lineage — linked markdown notes ride along
       in the trace's card list but are not graph nodes (they aren't
       computational deps, and mixing them in creates note<->definer cycles
       that the transitive reduction can't lay out) */
    var steps=group.steps.filter(function(s){return s.kind!=='note';});
    if(steps.length<2) return null;                 /* nothing to draw */
    var n=steps.length,idx={},i;
    for(i=0;i<n;i++) idx[steps[i].ns]=i;
    /* each step's ancestors that are also in this plot's set (from chain) */
    var anc=steps.map(function(s){
      var set={};
      (s.chain||[]).forEach(function(a){
        var ns=nsKey(s.nb,a); if(idx[ns]!==undefined) set[ns]=1;});
      return set;
    });
    /* direct parents = transitive reduction (drop ancestors reachable
       through another ancestor) */
    var parents=steps.map(function(s,i2){
      var a=Object.keys(anc[i2]);
      return a.filter(function(p){
        return !a.some(function(q){
          return q!==p&&anc[idx[q]]&&anc[idx[q]][p];});
      });
    });
    var depth=[]; for(i=0;i<n;i++) depth.push(-1);
    function dep(i2){
      if(depth[i2]>=0) return depth[i2];
      depth[i2]=0;   /* cycle guard */
      var m=0; parents[i2].forEach(function(p){
        m=Math.max(m,dep(idx[p])+1);});
      depth[i2]=m; return m;
    }
    for(i=0;i<n;i++) dep(i);
    var maxD=0; depth.forEach(function(v){if(v>maxD)maxD=v;});
    var layers=[],L; for(L=0;L<=maxD;L++) layers.push([]);
    for(i=0;i<n;i++) layers[depth[i]].push(i);
    var NW=152,NH=30,GX=20,GY=52,PADX=14,PADY=14,maxCols=0;
    layers.forEach(function(l){if(l.length>maxCols)maxCols=l.length;});
    var W=PADX*2+maxCols*NW+(maxCols-1)*GX;
    var H=PADY*2+(maxD+1)*NH+maxD*GY,pos={};
    layers.forEach(function(l,Ld){
      var rowW=l.length*NW+(l.length-1)*GX,x0=(W-rowW)/2;
      l.forEach(function(i2,k){
        pos[i2]={x:x0+k*(NW+GX),y:PADY+Ld*(NH+GY)};});
    });
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','plotgraph');
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('preserveAspectRatio','xMidYMin meet');
    svg.style.maxHeight=Math.min(H,300)+'px';
    steps.forEach(function(s,i2){
      parents[i2].forEach(function(p){
        var a=pos[idx[p]],b=pos[i2];
        var x1=a.x+NW/2,y1=a.y+NH,x2=b.x+NW/2,y2=b.y,mid=(y1+y2)/2;
        var path=document.createElementNS(SVGNS,'path');
        path.setAttribute('class','pg-edge');
        path.setAttribute('d','M'+x1+' '+y1+' C'+x1+' '+mid+' '
          +x2+' '+mid+' '+x2+' '+y2);
        svg.appendChild(path);
      });
    });
    steps.forEach(function(s,i2){
      var p=pos[i2];
      var g=document.createElementNS(SVGNS,'g');
      g.setAttribute('class','pg-node');
      g.setAttribute('transform','translate('+p.x+','+p.y+')');
      g.setAttribute('tabindex','0');g.setAttribute('role','button');
      var r=document.createElementNS(SVGNS,'rect');
      r.setAttribute('width',NW);r.setAttribute('height',NH);
      r.setAttribute('rx',7);r.setAttribute('fill',nodeColor(s));
      g.appendChild(r);
      var t=document.createElementNS(SVGNS,'text');
      t.setAttribute('x',NW/2);t.setAttribute('y',NH/2+4);
      t.setAttribute('text-anchor','middle');
      var label=s.title||splitRef(s.ns)[1];
      if(label.length>22) label=label.slice(0,21)+'…';
      t.textContent=label;g.appendChild(t);
      var open=function(){onNode?onNode(s):openVFull(s);};
      g.addEventListener('click',open);
      g.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
      svg.appendChild(g);
    });
    var wrap=document.createElement('div');wrap.className='plotgraph-wrap';
    var lbl=document.createElement('div');lbl.className='pg-eyebrow';
    lbl.textContent='dependency graph';
    wrap.appendChild(lbl);wrap.appendChild(svg);
    return wrap;
  }
  function traceItemFor(stem,anchor){
    return resolveRef(stem?nsKey(stem,anchor):anchor)||resolveRef(anchor);
  }
  function lineageFor(s){
    /* one group per framed card, ordered like the frames sit on the
       slide (row by row, left to right); each group = that card's full
       chain + its own code */
    var frames=[],seen={};
    (s.annots||[]).forEach(function(a){
      if(a.k!=='cell'||!a.ref) return;
      var it=resolveRef(a.ref);
      if(it&&!seen[it.ns]){seen[it.ns]=1;frames.push({a:a,it:it});}
    });
    frames.sort(function(p,q){
      var ry=Math.round((p.a.y||0)/12)-Math.round((q.a.y||0)/12);
      return ry!==0?ry:((p.a.x||0)-(q.a.x||0));
    });
    var groups=[];
    frames.forEach(function(f){
      /* a framed markdown note carries no code trail of its own — its chain
         now names its variables' cards (docs feature), but the presentation
         must stay note-free */
      if(f.it.kind==='note') return;
      var steps=[],seen2={};
      (f.it.chain||[]).forEach(function(anchor){
        var ns=nsKey(f.it.nb,anchor);
        var up=ITEMS[ns];
        if(up&&up.hasCode&&!seen2[ns]){seen2[ns]=1;steps.push(up);}
      });
      if(f.it.hasCode&&!seen2[f.it.ns]) steps.push(f.it);
      if(steps.length)
        groups.push({it:f.it,steps:steps,
          color:TRACE_COLORS[groups.length%TRACE_COLORS.length]});
    });
    var flat=[];
    groups.forEach(function(g){
      g.steps.forEach(function(st,k){
        flat.push({it:st,g:g,num:k+1});
      });
    });
    return {groups:groups,flat:flat};
  }
  /* the SELECTED plot's lineage as the docs dependency tree: a pseudo-
     shell (hidden card clones + a .treeview) fed to the docs builder, so
     zoom / width / expand / resize all behave exactly like the Tree view */
  function traceTreeNode(g){
    var wrap=document.createElement('div');
    wrap.className='deck-tracetree';
    var store=document.createElement('div');store.hidden=true;
    var items=[];
    (g.steps||[]).forEach(function(st){
      items.push(st);
      var c=cardEl(st.ns);
      if(c) store.appendChild(c.cloneNode(true));  /* ids kept: the tree
        builder looks nodes up by card id WITHIN this wrapper */
    });
    var tv=document.createElement('div');tv.className='treeview';
    wrap.appendChild(store);wrap.appendChild(tv);
    if(window.SemView&&window.SemView.buildTree)
      window.SemView.buildTree({el:wrap,
        data:{stem:g.it.nb,items:items}});
    return wrap;
  }
  function plotThumb(g,glow){
    var w=document.createElement('div');w.className='vo-plot';
    if(glow){
      w.style.borderColor=g.color;
      w.style.boxShadow='0 0 16px '+g.color+'66';
    }
    var src=paneImgSrc(g.it.ns);
    if(src){
      var im=document.createElement('img');
      im.src=src;im.alt='';w.appendChild(im);
    }
    var tl=document.createElement('span');tl.className='vo-plot-t';
    tl.textContent=g.it.title;w.appendChild(tl);
    return w;
  }
  function openVFull(st){
    var vf=$('#vfull'); if(!vf) return;
    var b=$('#vfull-badge'); if(b) b.textContent=st.kind;
    var t=$('#vfull-t'); if(t) t.textContent=st.title;
    var body=$('#vfull-body');
    if(body){
      body.innerHTML='';
      var c=cloneCode(st.ns);
      if(c) body.appendChild(c);
    }
    vf.hidden=false;
  }
  function closeVFull(){
    var vf=$('#vfull'); if(vf) vf.hidden=true;
  }
  function traceStep(st,k,g,multi,isHidden,spec,doRebuild){
    var box=document.createElement('div');
    box.className='vo-step'+(isHidden?' hidden':'');
    box.setAttribute('data-ns',st.ns);
    box.setAttribute('data-ck',(st.codeKinds&&st.codeKinds[0])||'code');
    box.setAttribute('data-ot',stepOt(st));
    var h=document.createElement('button');h.className='vo-step-h';
    h.title='Expand this cell';
    var n=document.createElement('span');n.className='vo-num';
    n.textContent=(k+1);
    if(multi){n.style.background=g.color+'26';n.style.color=g.color;}
    h.appendChild(n);
    var bd=document.createElement('span');
    var cks=st.codeKinds||(st.codeKind?[st.codeKind]:['code']);
    var codey=st.kind!=='figure'&&st.kind!=='diagnostic'
      &&!(cks.length===1&&cks[0]==='code');
    bd.className='chain-badge '+(codey?('ckmain-'+cks[0]):'');
    bd.textContent=codey?cks.slice(0,3).join(' · '):st.kind;
    h.appendChild(bd);
    var bt=document.createElement('span');bt.className='vo-step-t';
    bt.textContent=st.title;h.appendChild(bt);
    if(multiNb()) h.appendChild(nbChip('spane-nb',st.nb));
    /* eyeball: hide this step while presenting (persists per slide) */
    var eye=document.createElement('span');
    eye.className='vo-eye'+(isHidden?' off':'');
    eye.innerHTML='&#128065;';
    eye.title=isHidden
      ?'Hidden — click to show it again'
      :'Hide this step';
    eye.addEventListener('click',function(e){
      e.stopPropagation();spec.toggle(st.ns);doRebuild();});
    h.appendChild(eye);
    var fb=document.createElement('span');fb.className='vo-full';
    fb.innerHTML='&#x26F6;';fb.title='View this cell full screen';
    fb.addEventListener('click',function(e){
      e.stopPropagation();openVFull(st);});
    h.appendChild(fb);
    var ch=document.createElement('span');ch.className='vo-chev';
    ch.innerHTML='&#8250;';
    h.appendChild(ch);
    var body=document.createElement('div');body.className='vo-step-b';
    h.addEventListener('click',function(){
      var open=box.classList.toggle('open');
      if(open&&!body.firstChild){
        var c=cloneCode(st.ns);
        if(c) body.appendChild(c);
        else{
          var no=document.createElement('p');no.className='vstep-none';
          no.textContent='(no code on this card)';
          body.appendChild(no);
        }
        typeset(body);
      }
    });
    box.appendChild(h);box.appendChild(body);
    return box;
  }
  function setAllSteps(v,open){
    $$('.vo-step',v).forEach(function(box){
      if(open===box.classList.contains('open')) return;
      if(open) box.querySelector('.vo-step-h').click();
      else box.classList.remove('open');
    });
  }
  /* the code trail's OWN Code-types / Output-types filters (mirror the docs
     ones): each hides trace steps by their primary code kind / output kind */
  var traceCkHidden={},traceOtHidden={};
  function stepOt(st){
    var kd=st.kind;
    if(kd==='text'||kd==='metric') return 'print';
    if(kd==='dataset') return 'dataset';
    if(kd==='error') return 'error';
    return '';   /* figures / code / notes are not an output kind */
  }
  function applyTraceFilter(v){
    $$('.vo-step',v).forEach(function(st){
      var ck=st.getAttribute('data-ck')||'code',ot=st.getAttribute('data-ot');
      st.classList.toggle('vo-filtered',
        !!traceCkHidden[ck]||(!!ot&&!!traceOtHidden[ot]));
    });
  }
  function traceFilterDropdown(kind,present,state,v){
    var wrap=document.createElement('span');wrap.className='vo-fdrop';
    var btn=document.createElement('button');
    btn.className='vo-fbtn'+(Object.keys(state).length?' on':'');
    btn.textContent=(kind==='code'?'Code types':'Output types')+' ▾';
    var menu=document.createElement('div');menu.className='vo-fmenu';
    menu.hidden=true;
    present.forEach(function(t){
      var row=document.createElement('label');row.className='ckf-row';
      var cb=document.createElement('input');cb.type='checkbox';
      cb.checked=!state[t];
      cb.addEventListener('change',function(){
        if(cb.checked) delete state[t]; else state[t]=1;
        btn.classList.toggle('on',Object.keys(state).length>0);
        applyTraceFilter(v);});
      var sw=document.createElement('span');
      sw.className='ckf-dot '+(kind==='code'?'ckmain-'+t:'ot-sw-'+t);
      var tx=document.createElement('span');tx.textContent=t;
      row.appendChild(cb);row.appendChild(sw);row.appendChild(tx);
      menu.appendChild(row);});
    btn.addEventListener('click',function(e){
      e.stopPropagation();menu.hidden=!menu.hidden;});
    wrap.appendChild(btn);wrap.appendChild(menu);
    return wrap;
  }
  function traceNode(spec,rebuild){
    var groups=spec.groups||[];
    var hidden=hiddenSet({hidden:spec.list()});
    /* count DISTINCT hidden cells (a shared upstream cell can appear in
       several plot columns but is one step to the user) */
    var counted={},nHidden=0;
    groups.forEach(function(g){g.steps.forEach(function(st){
      if(hidden[st.ns]&&!counted[st.ns]){counted[st.ns]=1;nHidden++;}});});
    var showHidden=spec.showHiddenRef.v;
    /* the visible groups drive BOTH the plot strip and the columns, so
       they always line up even when a whole plot's trace is hidden */
    var visGroups=groups.map(function(g){
      return {g:g,vis:g.steps.filter(function(st){
        return showHidden||!hidden[st.ns];})};
    }).filter(function(x){return x.vis.length;});
    var multi=visGroups.length>1;
    if(traceSel>=visGroups.length) traceSel=0;
    var v=document.createElement('div');v.className='vtrace';
    var doRebuild=function(){rebuild(v);};
    var tl=document.createElement('div');tl.className='vo-title';
    /* the same lineage two ways: a readable list of Cells, or the
       expandable dependency Tree (the docs tree, reused) */
    var isTree=(traceView==='tree');
    [['&#9776; Cells','cells','The lineage as a readable list of steps'],
     ['&#9633; Tree','tree','The lineage as an expandable dependency '
      +'tree — columns by step']].forEach(function(bv){
      var b=document.createElement('button');
      b.className='vo-xall'+((traceView===bv[1])?' on':'');
      b.innerHTML=bv[0];b.title=bv[2];
      b.addEventListener('click',function(){
        if(traceView!==bv[1]){traceView=bv[1];doRebuild();}});
      tl.appendChild(b);
    });
    var xa=document.createElement('button');xa.className='vo-xall';
    xa.textContent='Expand all';
    xa.title='Open the code of every step';
    xa.addEventListener('click',function(){setAllSteps(v,true);});
    var ca=document.createElement('button');ca.className='vo-xall';
    ca.textContent='Collapse all';
    ca.title='Fold every step back down';
    ca.addEventListener('click',function(){setAllSteps(v,false);});
    if(!isTree){tl.appendChild(xa);tl.appendChild(ca);}
    if(!isTree&&nHidden){
      var sh=document.createElement('button');
      sh.className='vo-xall'+(showHidden?' on':'');
      sh.textContent=showHidden?'Hide hidden'
        :('Show hidden ('+nHidden+')');
      sh.title=showHidden
        ?'Hide the steps you marked hidden again'
        :'Reveal the steps you hid — to view them or unhide them';
      sh.addEventListener('click',function(){
        spec.showHiddenRef.v=!spec.showHiddenRef.v;doRebuild();});
      tl.appendChild(sh);
    }
    /* the trail's own Code-types / Output-types filters (present kinds only) */
    var ckSet={},otSet={};
    groups.forEach(function(g){g.steps.forEach(function(st){
      ckSet[(st.codeKinds&&st.codeKinds[0])||'code']=1;
      var ot=stepOt(st); if(ot) otSet[ot]=1;});});
    var ckList=Object.keys(ckSet),otList=Object.keys(otSet);
    if(!isTree&&ckList.length)
      tl.appendChild(traceFilterDropdown('code',ckList,traceCkHidden,v));
    if(!isTree&&otList.length)
      tl.appendChild(traceFilterDropdown('output',otList,traceOtHidden,v));
    v.appendChild(tl);
    /* several plots: the thumbnails PICK whose trace shows (one at a
       time), instead of every trace rendering side by side */
    if(multi){
      var strip=document.createElement('div');strip.className='vo-plots';
      visGroups.forEach(function(x,i){
        var th=plotThumb(x.g,i===traceSel);
        th.classList.add('vo-thumb-btn');
        if(i===traceSel) th.classList.add('sel');
        th.title='Show the code trace for “'+x.g.it.title+'”';
        th.addEventListener('click',function(){
          if(traceSel!==i){traceSel=i;doRebuild();}});
        strip.appendChild(th);
      });
      v.appendChild(strip);
    }
    if(isTree){
      var tg=visGroups[traceSel];
      if(tg) v.appendChild(traceTreeNode(tg.g));
      applyTraceFilter(v);
      return v;
    }
    var cols=document.createElement('div');cols.className='vo-groups';
    [visGroups[traceSel]].filter(Boolean).forEach(function(x){
      var g=x.g,vis=x.vis;
      var col=document.createElement('div');col.className='vo-col';
      if(multi){
        col.style.borderColor=g.color;
        col.style.boxShadow='0 0 16px '+g.color+'44';
      }
      var h=document.createElement('div');h.className='vo-col-h';
      if(multi) h.style.color=g.color;
      var hs=document.createElement('span');
      hs.textContent=g.it.title;h.appendChild(hs);
      col.appendChild(h);
      /* partition the steps under their notebook section (## heading) and
         subsection (### heading). Each section is a collapsible + hideable
         block, mirroring the docs — its steps live in a .vo-sec-body. */
      var lastSec=null,lastSub=null,secBody=col,secNs=[],secHdr=null;
      function wireSecEye(){
        if(!secHdr) return;
        var nss=secNs.slice();
        secHdr.querySelector('.vo-sec-eye').addEventListener('click',
          function(e){
            e.stopPropagation();
            var hid=hiddenSet({hidden:spec.list()});
            var anyVis=nss.some(function(ns){return !hid[ns];});
            nss.forEach(function(ns){
              if(anyVis?!hid[ns]:hid[ns]) spec.toggle(ns);});
            doRebuild();
          });
      }
      vis.forEach(function(st,k){
        /* partition by section ID, not title — two "### Summary" sections
           under different chapters must NOT merge into one block */
        var sec=st.section||st.sectitle||'',sub=st.subsection||'';
        if(sec!==lastSec){
          wireSecEye();                       /* finish the previous section */
          secNs=[];secHdr=null;
          if(sec){
            var sd=document.createElement('div');sd.className='vo-sec';
            var chev=document.createElement('span');
            chev.className='vo-sec-chev';chev.innerHTML='&#9662;';
            var lab=document.createElement('span');
            lab.className='vo-sec-lab';
            lab.textContent=(st.secnum?st.secnum+' · ':'')
              +(st.sectitle||sec);
            var eye=document.createElement('span');
            eye.className='vo-sec-eye';eye.innerHTML='&#128065;';
            eye.title='Hide or show this whole section';
            sd.appendChild(chev);sd.appendChild(lab);sd.appendChild(eye);
            col.appendChild(sd);
            secBody=document.createElement('div');
            secBody.className='vo-sec-body';col.appendChild(secBody);
            secHdr=sd;
            /* capture sd + secBody per-section (both are function-scoped vars
               reused across steps) so each chevron folds its OWN body */
            (function(hdr,bdy){
              var fold=function(){
                var c=hdr.classList.toggle('collapsed');
                bdy.classList.toggle('vo-sec-fold',c);};
              chev.addEventListener('click',function(e){
                e.stopPropagation();fold();});
              lab.addEventListener('click',fold);
            })(sd,secBody);
          } else {
            secBody=col;   /* steps with no section go straight in the column */
          }
          lastSec=sec;lastSub=null;
        }
        if(sub!==lastSub){
          if(sub){
            var sbh=document.createElement('div');sbh.className='vo-subsec';
            sbh.textContent=sub;secBody.appendChild(sbh);
          }
          lastSub=sub;
        }
        secNs.push(st.ns);
        secBody.appendChild(
          traceStep(st,k,g,multi,!!hidden[st.ns],spec,doRebuild));
      });
      wireSecEye();                            /* finish the final section */
      cols.appendChild(col);
    });
    v.appendChild(cols);
    applyTraceFilter(v);   /* reflect the current trail filters on rebuild */
    return v;
  }
  function updateVNav(){
    var down=$('#deck-down'),up=$('#deck-up');
    var inView=(mode==='view');
    var hasTrace=inView&&!!stage.querySelector('.vtrace');
    var atTop=(stage.scrollTop||0)<60;
    if(down) down.hidden=!(hasTrace&&atTop);
    if(up) up.hidden=!(hasTrace&&!atTop);
    var c=$('#deck-count');
    if(c) c.textContent=pres.slides.length
      ?((cur+1)+' / '+pres.slides.length):'0 / 0';
  }
  function scrollToTrace(){
    var tr=stage.querySelector('.vtrace');
    if(tr) tr.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function scrollToSlide(){
    stage.scrollTo({top:0,behavior:'smooth'});
  }
  stage.addEventListener('scroll',function(){
    if(mode==='view') updateVNav();
  });
  function renderSlide(){
    var s=pres.slides[cur];
    stage.innerHTML='';
    vGroups=[];
    traceSel=0;   /* each slide starts on its first plot's trace */
    closeVFull();
    if(!s){
      stage.innerHTML='<div class="slide slide-empty"><p>No slides yet.'
        +'<br>Use <b>Create</b> to build some.</p></div>';
    } else if(s.layout==='title'){
      /* title + sub are movable items drawn by the annotation layer */
      var ts=document.createElement('div');
      ts.className='slide slide-titlefree';
      ts.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
      stage.appendChild(ts);
    } else {
      var bs=document.createElement('div');
      bs.className='slide slide-blank';
      stage.appendChild(bs);
    }
    var slideEl=stage.firstElementChild;
    if(s&&slideEl){
      /* size the page BEFORE annots render, so % geometry, fonts and
         figure fits all read the final canvas dimensions */
      applyPage();
      if(mode==='edit'||deckEl.classList.contains('custom-page'))
        applyZoom();
      attachAnnots(slideEl,s);
      typeset(slideEl);
      if(mode==='view'){
        /* click anywhere on the slide advances the build / next slide */
        slideEl.style.cursor='pointer';
        slideEl.addEventListener('click',function(e){
          if(e.target.closest&&e.target.closest('button,a,input,select'))
            return;
          advance();
        });
      }
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';
        pn.textContent=(cur+1);
        slideEl.appendChild(pn);
      }
    }
    renderSelPane();   /* keep the Objects pane on the CURRENT slide */
    /* playback: the code trace flows beneath the slide — scroll (or
       ArrowDown) between them; steps expand in place */
    stage.classList.remove('scrolly');
    if(mode==='view'&&s){
      var lin=lineageFor(s);
      vGroups=lin.groups;
      if(vGroups.length){
        var page=document.createElement('div');
        page.className='vpage';
        while(stage.firstChild) page.appendChild(stage.firstChild);
        stage.appendChild(page);
        stage.appendChild(buildTrace(s));
        stage.classList.add('scrolly');
      }
    }
    stage.scrollTop=0;
    updateVNav();
    /* Next stays live while builds remain on the last slide; Prev while any
       build can be stepped back on the first slide */
    var moreBuilds=(mode==='view'&&s&&revealCount<slideBuildSteps(s).count);
    var fewerBuilds=(mode==='view'&&revealCount>0);
    $('#deck-prev').disabled=(cur<=0&&!fewerBuilds);
    $('#deck-next').disabled=(cur>=pres.slides.length-1&&!moreBuilds);
  }

  /* ---------- free annotations: text, arrows, boxes, cell frames -----
     Stored per slide as s.annots, coordinates in % of the slide box so
     they scale with the screen; text size is % of slide height. Title
     slides also carry movable title/sub text (s.tprops / s.sprops,
     addressed with the special indices 't' / 's'). */
  var AN_NS='http://www.w3.org/2000/svg';
  var FONTMAP={sans:'var(--sans)',serif:'var(--serif)',
    mono:'var(--mono)',system:'system-ui,sans-serif',
    hand:"'Segoe Print','Comic Sans MS',cursive"};
  var tool='select', selAnnot=null, picking=-1;
  /* selSet = every item in the current selection (a group, or a shift-click
     multi-select); selAnnot is the primary one that drives the format bar */
  var selSet=[];
  function groupMembers(s,idx){
    if(!s||typeof idx!=='number') return [idx];
    var a=(s.annots||[])[idx];
    if(!a||a.grp==null) return [idx];
    var out=[];
    (s.annots||[]).forEach(function(x,i){if(x.grp===a.grp) out.push(i);});
    return out.length?out:[idx];
  }
  function nextGrp(s){
    var mx=0;(s.annots||[]).forEach(function(x){
      if(typeof x.grp==='number'&&x.grp>mx) mx=x.grp;});
    return mx+1;
  }
  /* build animations: items carrying a.anim reveal one step at a time during
     playback (click / arrow / space); revealCount is how many are shown */
  var revealCount=0;
  function slideBuildIdx(s){
    var arr=[];
    (s&&s.annots||[]).forEach(function(a,i){if(a&&a.anim) arr.push(i);});
    arr.sort(function(x,y){
      return ((s.annots[x].anim.order||0)-(s.annots[y].anim.order||0));});
    return arr;
  }
  /* a build "step" is a distinct anim.order — items sharing an order appear
     TOGETHER on the same click. Returns {map: order->step-index, count} */
  function slideBuildSteps(s){
    var seen={};
    (s&&s.annots||[]).forEach(function(a){
      if(a&&a.anim) seen[a.anim.order||0]=1;});
    var keys=Object.keys(seen).map(Number).sort(function(x,y){return x-y;});
    var map={};keys.forEach(function(o,i){map[o]=i;});
    return {map:map,count:keys.length};
  }
  /* ordered list of steps for the animation pane: [{order, items:[idx,…]}] */
  function animSeq(s){
    var by={},order=[];
    (s&&s.annots||[]).forEach(function(a,i){
      if(a&&a.anim){var o=a.anim.order||0;
        if(!by[o]){by[o]=[];order.push(o);}by[o].push(i);}});
    order.sort(function(x,y){return x-y;});
    return order.map(function(o){return {order:o,items:by[o]};});
  }
  function nextAnimOrder(s){
    var mx=-1;(s&&s.annots||[]).forEach(function(a){
      if(a&&a.anim&&(a.anim.order||0)>mx) mx=a.anim.order||0;});
    return mx+1;
  }
  function itemLabel(s,idx){
    var a=(s&&s.annots||[])[idx]; if(!a) return 'item';
    if(a.k==='text') return (a.text||'').trim().slice(0,16)||'Text';
    if(a.k==='image') return 'Image';
    if(a.k==='arrow') return 'Arrow';
    if(a.k==='rect') return (a.shape?a.shape:'Shape');
    if(a.k==='cell'){var it=a.ref&&resolveRef(a.ref);
      return it&&it.title?it.title.slice(0,18):'Cell';}
    return 'item';
  }
  function paintSel(layer){
    var multi=selSet.length>1;
    $$('[data-idx]',layer).forEach(function(el){
      var raw=el.getAttribute('data-idx');
      var key=(raw==='t'||raw==='s')?raw:+raw;
      var on=selSet.indexOf(key)>=0;
      el.classList.toggle('sel',on);
      el.classList.toggle('grpsel',on&&multi);
    });
  }
  var pendingShape='rect';   /* which shape the "+ Shapes" tool draws */
  function titleProps(s,which){
    var key=which==='t'?'tprops':'sprops';
    if(!s[key]) s[key]=(which==='t')
      ?{x:50,y:42,size:6,color:'#f0f6fa'}
      :{x:50,y:58,size:2.6,color:'#7e93a4'};
    return s[key];
  }
  function annotByIdx(s,idx){
    if(idx==='t'||idx==='s') return titleProps(s,idx);
    if(typeof idx==='number') return (s.annots||[])[idx];
    return null;
  }
  function fontPx(layer,size){
    var h=layer.getBoundingClientRect().height||600;
    return Math.max(9,h*(size||2.6)/100)+'px';
  }
  function applyCommon(el,a,extraTransform){
    if(a.op!=null&&a.op<1) el.style.opacity=a.op;
    var tr=extraTransform||'';
    if(a.rot) tr+=(tr?' ':'')+'rotate('+a.rot+'deg)';
    if(tr) el.style.transform=tr;
  }
  /* a markdown cell frame can carry its own text + background colour, so the
     note is readable on any slide (the default light-box grey is not) */
  function applyCellColor(el,a){
    if(a.txcol) el.style.setProperty('--nb-tx',a.txcol);
    else el.style.removeProperty('--nb-tx');
    if(a.bgcol) el.style.setProperty('--nb-bg',
      a.bgcol==='none'?'transparent':a.bgcol);
    else el.style.removeProperty('--nb-bg');
  }
  /* crop masks: images AND notebook cells (figures, markdown, code) can be
     clipped to a shape, or trimmed with a rectangular inset. clip-path scales
     with the element, so it survives responsive slide sizing. */
  var CROP_SHAPES=[['rect','Rectangle'],['round','Rounded'],
    ['ellipse','Ellipse'],['circle','Circle'],['triangle','Triangle'],
    ['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],
    ['star','Star'],['arrow','Arrow']];
  var CROP_CLIP={
    round:'inset(0 round 14%)',
    ellipse:'ellipse(50% 50% at 50% 50%)',
    circle:'circle(50% at 50% 50%)',
    triangle:'polygon(50% 0%,100% 100%,0% 100%)',
    diamond:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
    pentagon:'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)',
    hexagon:'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
    star:'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,'
      +'21% 91%,32% 57%,2% 35%,39% 35%)',
    arrow:'polygon(0% 30%,55% 30%,55% 8%,100% 50%,55% 92%,55% 70%,0% 70%)'};
  function cropCss(a){
    if(!a||!a.crop) return '';
    var c=a.crop,sh=c.shape||'rect';
    if(sh!=='rect'&&CROP_CLIP[sh]) return CROP_CLIP[sh];
    var t=c.t||0,r=c.r||0,b=c.b||0,l=c.l||0;
    if(t||r||b||l) return 'inset('+t+'% '+r+'% '+b+'% '+l+'%)';
    return '';
  }
  function applyCrop(el,a){
    if(!el) return;
    var cc=cropCss(a);
    if(cc){el.style.clipPath=cc;el.style.webkitClipPath=cc;}
  }
  /* a little filled preview of a crop shape (uses the very same clip-path) */
  function cropIcon(shape){
    var d=document.createElement('span');d.className='crop-ico';
    var cc=CROP_CLIP[shape];
    if(cc){d.style.clipPath=cc;d.style.webkitClipPath=cc;}
    return d;
  }
  /* rich text: a text box can carry per-character colour (highlight a run and
     recolour just it). Stored as sanitised HTML in a.html; a.text keeps the
     plain fallback. Only colour + basic inline styles survive the sanitiser. */
  var RICH_TAGS={span:1,b:1,strong:1,i:1,em:1,u:1,s:1,br:1,font:1};
  function sanitizeRich(html){
    /* parse into an INERT template fragment — no image loads, no inline event
       handlers ever run (unlike a live-document div), so merely sanitising
       hostile HTML can never execute code */
    var tpl=document.createElement('template');
    tpl.innerHTML=String(html||'');
    /* walk with a live cursor (not a stale snapshot) so nodes promoted by
       unwrapping an unknown tag are ALSO inspected — otherwise a dangerous
       element nested one level in survives */
    (function walk(node){
      var n=node.firstChild;
      while(n){
        var next=n.nextSibling;
        if(n.nodeType===3){n=next;continue;}      /* text node: keep */
        if(n.nodeType!==1){node.removeChild(n);n=next;continue;}
        var tag=(n.tagName||'').toLowerCase();
        if(!RICH_TAGS[tag]){                       /* unwrap unknown tags */
          var first=n.firstChild;
          while(n.firstChild) node.insertBefore(n.firstChild,n);
          node.removeChild(n);
          n=first||next;continue;                  /* re-walk promoted nodes */
        }
        var color=(n.style&&n.style.color)||
          (tag==='font'?(n.getAttribute('color')||''):'');
        var names=[],k;
        for(k=0;k<n.attributes.length;k++) names.push(n.attributes[k].name);
        names.forEach(function(nm){n.removeAttribute(nm);});
        if(color) n.style.color=color;
        walk(n);
        n=next;
      }
    })(tpl.content);
    return {html:tpl.innerHTML,
      rich:!!tpl.content.querySelector(
        'span[style],font,b,strong,i,em,u,s')};
  }
  function activeTextEditable(){
    var ae=document.activeElement;
    if(ae&&ae.classList&&ae.classList.contains('an-tx')&&ae.isContentEditable
       &&ae.contentEditable!=='plaintext-only') return ae;
    return null;
  }
  function selectionInside(el){
    var sel=window.getSelection();
    if(!sel||sel.rangeCount===0||sel.isCollapsed) return false;
    var r=sel.getRangeAt(0);
    return el.contains(r.startContainer)&&el.contains(r.endContainer);
  }
  /* colour just the highlighted run inside the text box being edited;
     returns false when there is no live selection to recolour */
  function colorSelection(col){
    var el=activeTextEditable();
    if(!el||!selectionInside(el)) return false;
    try{document.execCommand('styleWithCSS',false,true);}catch(e){}
    try{document.execCommand('foreColor',false,col);}catch(e){}
    var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
    if(a){
      var r=sanitizeRich(el.innerHTML);
      a.text=el.innerText;
      if(r.rich) a.html=r.html; else delete a.html;
      markDirty();
    }
    return true;
  }
  function mkHandle(){
    var h=document.createElement('span');h.className='an-handle';
    h.title='Drag to move';h.textContent='⠿';
    return h;
  }
  function mkResize(){
    /* all four corners resize (anchored on the opposite corner) */
    var frag=document.createDocumentFragment();
    ['nw','ne','sw','se'].forEach(function(cn){
      var r=document.createElement('span');
      r.className='an-resize an-rs-'+cn;
      r.dataset.corner=cn;
      r.title='Drag to resize';
      frag.appendChild(r);
    });
    return frag;
  }
  function mkRotate(){
    var r=document.createElement('span');r.className='an-rotate';
    r.title='Drag to rotate freely (Shift snaps to 15°)';
    return r;
  }
  function attachAnnots(slideEl,s){
    var layer=document.createElement('div');
    layer.className='annot-layer tool-'+tool;
    slideEl.appendChild(layer);
    renderAnnots(layer,s);
    if(mode==='edit') wireEditor(layer,s);
    /* draw any Plotly figures cloned into cell frames (json specs only —
       cloned scripts would clash on duplicate ids) */
    if(window.SemActivate) window.SemActivate(layer,true);
  }
  function editableText(layer,el,getVal,setVal,idx,rich){
    try{
      el.contentEditable=(el.tagName==='UL'||rich)?'true':'plaintext-only';
    }catch(e){el.contentEditable='true';}
    el.spellcheck=false;
    el.addEventListener('focus',function(){
      if(tool!=='select') el.blur();
    });
    el.addEventListener('focus',function(){
      if(!getVal()) el.textContent='';
    });
    el.addEventListener('blur',function(){
      var v=(el.innerText||'').replace(/\r/g,'')
        .replace(/\n+$/,'');
      var r=rich?sanitizeRich(el.innerHTML):null;
      setVal(v,r);
      markDirty();
    });
    el.addEventListener('mousedown',function(e){
      if(tool!=='select') return;   /* placing mode: draw over me */
      e.stopPropagation();
      selectAnnot(layer,idx);
    });
  }
  /* a figure frame hugs its plot: the frame ELEMENT is sized to the
     image's contained fit inside the stored rect, so the selection outline
     + resize handle sit exactly on the plot with no letterbox gap. The
     stored rect is left alone at render time (a slide renders at several
     scales — stage, film thumbnails, vpage — and mutating the model from
     whichever layer happens to render would compound); only an explicit
     resize gesture normalises it (startResize). */
  function figFit(layer,a,img){
    if(!img||!img.naturalWidth||!img.naturalHeight) return null;
    var lw=layer.clientWidth,lh=layer.clientHeight;
    if(!lw||!lh) return null;
    var fw=lw*(a.w||34)/100,fh=lh*(a.h||30)/100;
    var r=img.naturalWidth/img.naturalHeight;
    var w2=Math.min(fw,fh*r),h2=w2/r;
    return {x:(a.x||0)+(fw-w2)/2/lw*100,
            y:(a.y||0)+(fh-h2)/2/lh*100,
            w:w2/lw*100,h:h2/lh*100,ratio:r};
  }
  function figImg(c){
    if(c.querySelector('.figpager')) return null;   /* pager: several plots */
    var imgs=$$('.figframe img',c);
    return imgs.length===1?imgs[0]:null;   /* plotly/html figs: no fit */
  }
  function fitFigFrame(layer,a,c){
    var img=figImg(c); if(!img) return;
    var tries=0;
    function go(){
      /* the slide renders detached (no layout yet) and a freshly cloned
         <img> can lack its natural size — retry over a few frames until
         both have real dimensions; a replaced render just stops */
      var f=c.isConnected?figFit(layer,a,img):null;
      if(!f){if(tries++<8) requestAnimationFrame(go);return;}
      c.style.left=f.x+'%';c.style.top=f.y+'%';
      c.style.width=f.w+'%';c.style.height=f.h+'%';
    }
    if(!img.naturalWidth){
      img.addEventListener('load',go,{once:true});
      if(img.decode) img.decode().then(go).catch(function(){});
    }
    go();
  }
  function renderAnnots(layer,s){
    var editing=(mode==='edit');
    layer.innerHTML='';
    /* drop the "empty slide" hint once the slide has any content (placement
       only re-renders the layer, not the whole slide, so clear it here) */
    var _host=layer.parentNode;
    if(_host){
      var _eh=_host.querySelector('.slide-emptyhint');
      if(_eh&&(s.annots||[]).length) _eh.remove();
    }
    /* two svg layers: fat invisible hit-lines UNDER the items (so
       frames stay clickable), visible strokes ON TOP of everything
       (click-transparent) so arrows are never hidden behind frames */
    var svg=document.createElementNS(AN_NS,'svg');
    layer.appendChild(svg);
    var svgTop=document.createElementNS(AN_NS,'svg');
    svgTop.setAttribute('class','an-svgtop');
    var defs=document.createElementNS(AN_NS,'defs');
    svgTop.appendChild(defs);

    if(s.layout==='title'){
      ['t','s'].forEach(function(which){
        var p=titleProps(s,which);
        var d=document.createElement('div');
        d.className='an-item an-title'+(which==='t'?' t-main':'')
          +(selAnnot===which?' sel':'');
        d.style.left=p.x+'%';d.style.top=p.y+'%';
        d.style.fontSize=fontPx(layer,p.size);
        d.style.color=p.color||'#f0f6fa';
        if(p.b) d.style.fontWeight='700';
        if(p.i) d.style.fontStyle='italic';
        var tdeco=(p.u?'underline ':'')+(p.strike?'line-through':'');
        if(tdeco.trim()) d.style.textDecoration=tdeco.trim();
        if(p.align) d.style.textAlign=p.align;
        if(p.font&&FONTMAP[p.font])
          d.style.fontFamily=FONTMAP[p.font];
        applyCommon(d,p,'translate(-50%,-50%)');
        d.setAttribute('data-idx',which);
        if(editing){d.appendChild(mkHandle());
          d.appendChild(mkRotate());}
        var tx=document.createElement('span');tx.className='an-tx';
        var val=which==='t'?s.title:s.sub;
        tx.textContent=val
          ||(editing?(which==='t'?'Click to edit title':'subtitle'):'');
        if(editing){
          editableText(layer,tx,
            function(){return which==='t'?s.title:s.sub;},
            function(v){
              if(which==='t') s.title=v.trim();
              else s.sub=v.trim();
              renderFilm();renderControls();
            },which);
        }
        d.appendChild(tx);
        layer.appendChild(d);
      });
    }

    (s.annots||[]).forEach(function(a,i){
      /* hidden via the Objects pane: skipped while editing, still
         rendered in playback / print */
      if(a.hide&&editing) return;
      if(a.k==='arrow'){
        var col=a.color||'#ff6b57';
        var mk=document.createElementNS(AN_NS,'marker');
        mk.setAttribute('id','an-head-'+i);
        mk.setAttribute('viewBox','0 0 10 10');
        mk.setAttribute('refX','8');mk.setAttribute('refY','5');
        mk.setAttribute('markerWidth','6.5');
        mk.setAttribute('markerHeight','6.5');
        mk.setAttribute('orient','auto-start-reverse');
        var mp=document.createElementNS(AN_NS,'path');
        mp.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
        mp.setAttribute('fill',col);
        mk.appendChild(mp);defs.appendChild(mk);
        var ln=document.createElementNS(AN_NS,'line');
        ln.setAttribute('x1',a.x1+'%');ln.setAttribute('y1',a.y1+'%');
        ln.setAttribute('x2',a.x2+'%');ln.setAttribute('y2',a.y2+'%');
        ln.setAttribute('class','an-arrow-line'
          +(selAnnot===i?' sel':''));
        ln.setAttribute('data-idx',i);
        ln.setAttribute('stroke',col);
        ln.setAttribute('stroke-width',a.sw||3);
        if(a.dash) ln.setAttribute('stroke-dasharray','9 7');
        if(a.op!=null&&a.op<1) ln.style.opacity=a.op;
        ln.setAttribute('marker-end','url(#an-head-'+i+')');
        svgTop.appendChild(ln);
        var hit=document.createElementNS(AN_NS,'line');
        hit.setAttribute('x1',a.x1+'%');hit.setAttribute('y1',a.y1+'%');
        hit.setAttribute('x2',a.x2+'%');hit.setAttribute('y2',a.y2+'%');
        hit.setAttribute('class','an-arrow-hit an-item');
        hit.setAttribute('data-idx',i);
        svg.appendChild(hit);
        if(editing&&!a.lock){   /* a locked arrow gets no live endpoints */
          ['1','2'].forEach(function(which){
            var ep=document.createElement('span');
            ep.className='an-endpt an-endpt-'+which
              +(selAnnot===i?' sel':'');
            ep.style.left=a['x'+which]+'%';
            ep.style.top=a['y'+which]+'%';
            ep.setAttribute('data-idx',i);
            ep.setAttribute('data-ep',which);
            ep.title='Drag to redirect the arrow';
            layer.appendChild(ep);
          });
        }
      } else if(a.k==='rect'){
        var shp=a.shape||'rect';
        var col=a.color||'#ff6b57';
        var r=document.createElement('div');
        var svgShape=!!(SHAPE_PATHS[shp]||SHAPE_GLYPH[shp]);
        r.className='an-item an-rect'+(svgShape?' an-svgshape':'')
          +(selAnnot===i?' sel':'');
        r.style.left=a.x+'%';r.style.top=a.y+'%';
        r.style.width=(a.w||10)+'%';r.style.height=(a.h||10)+'%';
        if(svgShape){
          r.appendChild(drawShapeSvg(shp,col,a.sw||3,a.dash,a.fill));
        } else {
          r.style.borderColor=col;
          r.style.borderWidth=(a.sw||3)+'px';
          r.style.borderStyle=a.dash?'dashed':'solid';
          r.style.background=a.fill?shapeFill(col,0x26/255):'transparent';
          if(shp==='ellipse') r.style.borderRadius='50%';
        }
        applyCommon(r,a);
        r.setAttribute('data-idx',i);
        if(editing){r.appendChild(mkResize());
          r.appendChild(mkRotate());}
        layer.appendChild(r);
      } else if(a.k==='cell'){
        var c=document.createElement('div');
        var it=a.ref?resolveRef(a.ref):null;
        var locked=!!(a.lockver&&a.lockver.commit);
        var lkCard=locked?verCardFor(a):null;
        c.className='an-item an-cell'+((it||locked)?'':' empty')
          +(selAnnot===i?' sel':'');
        c.style.left=a.x+'%';c.style.top=a.y+'%';
        c.style.width=(a.w||34)+'%';c.style.height=(a.h||30)+'%';
        applyCommon(c,a);
        c.setAttribute('data-idx',i);
        if(locked&&lkCard){
          /* pinned to a git commit: render THAT version's card — refresh
             never touches it, the notebook needn't even be open */
          c.title=(lkCard.title||'')+' @ '+a.lockver.commit;
          var vb=frameFromVerCard(lkCard,a.part);
          if(vb){
            if(a.ts) vb.style.zoom=a.ts;
            applyCrop(vb,a);
            if(a.crop&&a.crop.shape) c.classList.add('an-cropped');
            c.appendChild(vb);
            if(!a.crop&&vb.querySelector(
                '.figframe,.figpager,.plotframe')){
              c.classList.add('an-figonly');
              fitFigFrame(layer,a,c);
            }
          }
          lockChip(c,a,true);
          applyCellColor(c,a);
        } else if(locked&&lkCard===undefined){
          var w8=document.createElement('div');w8.className='an-verwait';
          w8.textContent='🔒 '+a.lockver.commit+' — loading…';
          c.appendChild(w8);
        } else if(locked&&!it){
          var w9=document.createElement('div');w9.className='an-verwait';
          w9.textContent='🔒 '+a.lockver.commit+' — not available';
          c.appendChild(w9);
          lockChip(c,a,false);
        } else if(it){
          if(locked) lockChip(c,a,false);  /* lock set, live fallback */
          c.title=it.nb+' — '+it.title;
          var pt0=partOf(a),facs0=facetList(it.ns);
          /* a figure frame carries NO title header, even selected — a
             placed plot is JUST the plot (its name lives in the tooltip
             and the ribbon's Locate in notebook) */
          if(pt0!=='figure'){
            var ch=document.createElement('div');
            ch.className='an-cellhead';
            var chT=document.createElement('span');
            chT.className='an-cellhead-t';
            chT.textContent=it.title;
            ch.appendChild(chT);
            if(facs0.length>1||pt0==='code'){
              var pl=document.createElement('span');
              pl.className='an-cellpart';pl.textContent=pt0;
              ch.appendChild(pl);
            }
            if(multiNb()) ch.appendChild(nbChip('spane-nb',it.nb));
            c.appendChild(ch);
          }
          var fro=frozenFrames.get(a);
          var b=fro?framePartFromSnap(fro,a.part):framePart(it.ns,a.part);
          if(fro&&!b) b=framePart(it.ns,a.part);
          if(b){
            if(a.ts) b.style.zoom=a.ts;
            applyCrop(b,a);
            if(a.crop&&a.crop.shape) c.classList.add('an-cropped');
            c.appendChild(b);
          }
          if(fro){
            c.classList.add('an-frozen');
            if(editing){
              var fz=document.createElement('span');
              fz.className='an-frozenchip';
              fz.textContent='⟲ previous';
              fz.title='This frame shows the figure from BEFORE the last '
                +'notebook refresh — select it and press “Live figure” '
                +'to catch up';
              c.appendChild(fz);
            }
          }
          if(pt0==='figure'&&!a.crop){
            c.classList.add('an-figonly');
            fitFigFrame(layer,a,c);
          }
          applyCellColor(c,a);
          /* No on-frame Replace / part-picker / caption: those controls now
             live in the top ribbon's Object group (cleaner), and a placed
             figure is JUST the figure — so the selection outline hugs the
             content instead of a caption-padded box. */
        } else if(editing){
          var pb=document.createElement('button');
          pb.className='an-cellpick';
          pb.textContent=a.ref?('missing: '+a.ref)
            :'Click to add from notebook';
          pb.addEventListener('mousedown',function(e){
            if(tool==='select') e.stopPropagation();});
          pb.addEventListener('click',function(e){
            if(tool!=='select') return;
            e.stopPropagation();startPick(i);});
          c.appendChild(pb);
        }
        if(editing){c.appendChild(mkResize());
          c.appendChild(mkRotate());}
        layer.appendChild(c);
      } else if(a.k==='text'){
        var d2=document.createElement('div');
        d2.className='an-item an-text'+(a.bg===0?' nobg':'')
          +(selAnnot===i?' sel':'');
        d2.style.left=a.x+'%';d2.style.top=a.y+'%';
        d2.style.fontSize=fontPx(layer,a.size);
        d2.style.color=a.color||'#ffffff';
        if(a.b) d2.style.fontWeight='700';
        if(a.i) d2.style.fontStyle='italic';
        var deco=(a.u?'underline ':'')+(a.strike?'line-through':'');
        if(deco.trim()) d2.style.textDecoration=deco.trim();
        if(a.align) d2.style.textAlign=a.align;
        if(a.font&&FONTMAP[a.font])
          d2.style.fontFamily=FONTMAP[a.font];
        if(a.bg!==0&&a.bgc){
          d2.style.background=a.bgc;
          d2.style.borderColor='transparent';
        }
        if(a.w){d2.style.width=a.w+'%';d2.style.maxWidth='none';}
        applyCommon(d2,a);
        d2.setAttribute('data-idx',i);
        if(editing) d2.appendChild(mkHandle());
        if(editing){d2.appendChild(mkResize());
          d2.appendChild(mkRotate());}
        var tx2;
        if(a.list){
          tx2=document.createElement('ul');
          tx2.className='an-tx an-ul';
          String(a.text||'').split('\n').forEach(function(line){
            var li=document.createElement('li');
            li.textContent=line;
            tx2.appendChild(li);
          });
        } else {
          tx2=document.createElement('span');
          tx2.className='an-tx';
          if(a.html) tx2.innerHTML=sanitizeRich(a.html).html;
          else tx2.textContent=a.text||'';
        }
        if(editing){
          editableText(layer,tx2,
            function(){return a.text;},
            function(v,r){a.text=v;
              if(r&&r.rich&&!a.list) a.html=r.html; else delete a.html;},
            i,!a.list);
        }
        d2.appendChild(tx2);
        layer.appendChild(d2);
      } else if(a.k==='image'){
        var im=document.createElement('div');
        im.className='an-item an-image'+(selAnnot===i?' sel':'');
        im.style.left=a.x+'%';im.style.top=a.y+'%';
        im.style.width=(a.w||30)+'%';im.style.height=(a.h||24)+'%';
        applyCommon(im,a);
        im.setAttribute('data-idx',i);
        var img=document.createElement('img');
        img.className='an-imgel';img.src=a.src||'';img.alt='';
        img.draggable=false;
        applyCrop(img,a);
        im.appendChild(img);
        if(editing){im.appendChild(mkHandle());im.appendChild(mkResize());
          im.appendChild(mkRotate());}
        layer.appendChild(im);
      }
    });
    /* build animations: number the builds in the editor; in playback, hide the
       ones not yet revealed and animate the one just revealed */
    if(s.annots&&s.annots.some(function(a){return a&&a.anim;})){
      var steps=slideBuildSteps(s);
      $$('.an-item[data-idx]',layer).forEach(function(el){
        var raw=el.getAttribute('data-idx');
        if(raw==='t'||raw==='s') return;
        var bi=+raw,ba=(s.annots||[])[bi];
        if(!ba||!ba.anim) return;
        var st=steps.map[ba.anim.order||0];   /* which build step (0-based) */
        if(st==null) return;
        if(editing){
          var bd=document.createElement('span');
          bd.className='an-buildno';bd.textContent=(st+1);
          bd.title='Build '+(st+1)+' — '+(ba.anim.type||'fade')
            +' (items on the same build appear together)';
          el.appendChild(bd);
        } else if(mode==='view'){
          if(st>=revealCount) el.classList.add('an-prebuild');
          else if(st===revealCount-1){
            var atype=ba.anim.type||'fade';
            /* "appear" is instant (no keyframe); rise/zoom animate transform,
               which would fight a rotation and snap — a rotated item fades */
            if(ba.rot&&(atype==='rise'||atype==='zoom')) atype='fade';
            if(atype!=='appear') el.classList.add('an-anim-'+atype);
          }
        }
      });
    }
    layer.appendChild(svgTop);
    /* locked via the Objects pane: visible but untouchable on the canvas
       (select / unlock through the pane) */
    if(editing) (s.annots||[]).forEach(function(a,i){
      if(!a.lock) return;
      $$('.an-item[data-idx="'+i+'"]',layer).forEach(function(el){
        el.classList.add('an-locked');});
    });
  }
  function selectAnnot(layer,idx,additive){
    var s=pres.slides[cur];
    if(idx===null){selAnnot=null;selSet=[];}
    else {
      var mem=groupMembers(s,idx);
      if(additive&&typeof idx==='number'){
        if(selSet.indexOf(idx)>=0){
          selSet=selSet.filter(function(i){return mem.indexOf(i)<0;});
          selAnnot=selSet.length?selSet[selSet.length-1]:null;
        } else {
          mem.forEach(function(i){if(selSet.indexOf(i)<0) selSet.push(i);});
          selAnnot=idx;
        }
      } else {selAnnot=idx;selSet=mem.slice();}
    }
    paintSel(layer);
    var d=$('#et-del');
    if(d) d.disabled=!selSet.some(function(i){return typeof i==='number';});
    showFmt();
    /* refresh the Objects pane only when the selection actually CHANGED
       (resize/endpoint drags re-select every mousemove) */
    var sig=String(selAnnot)+'|'+selSet.join(',');
    if(sig!==lastSelSig){lastSelSig=sig;renderSelPane();}
  }
  var lastSelSig='';
  function defaultColor(kind){
    return kind==='text'?'#ffffff':'#ff6b57';
  }
  function showFmt(){
    var bar=$('#et-fmt'); if(!bar) return;
    var s=pres.slides[cur];
    var a=(s&&selAnnot!==null)?annotByIdx(s,selAnnot):null;
    if(!a){bar.hidden=true;return;}
    var kind=(selAnnot==='t'||selAnnot==='s')?'text':a.k;
    bar.hidden=false;
    function show(id,on,pressed){
      var el=$(id); if(!el) return;
      el.hidden=!on;
      if(on&&pressed!==undefined)
        el.setAttribute('aria-pressed',pressed.toString());
    }
    /* cellText = a resizable text-ish cell (A-/A+ content zoom applies to any
       non-figure cell). noteCell = a MARKDOWN note specifically — only its
       rendered .note carries a colour, so ONLY it gets the colour swatches. */
    var cellText=false,noteCell=false;
    if(kind==='cell'&&a.ref){
      var ci=resolveRef(a.ref);
      cellText=!!ci&&ci.kind!=='figure'&&ci.kind!=='diagnostic';
      noteCell=!!ci&&ci.kind==='note';
    }
    var isText=(kind==='text');
    var isNum=(typeof selAnnot==='number');
    /* the colour swatches drive a.color for text / arrows / shapes, and a.txcol
       for a markdown note — but NOT images or figure/code cells */
    var colourable=isText||kind==='arrow'||kind==='rect'||noteCell;
    $$('.sw:not(.swbg)',bar).forEach(function(sw){
      sw.hidden=!colourable;
      var cur_=(kind==='cell')?(a.txcol||''):(a.color||defaultColor(kind));
      sw.setAttribute('aria-pressed',(cur_===sw.dataset.c).toString());
    });
    show('#fmt-smaller',isText||cellText);
    show('#fmt-bigger',isText||cellText);
    var fontSel=$('#fmt-font');
    if(fontSel){
      fontSel.hidden=!isText;
      if(isText) fontSel.value=a.font||'sans';
    }
    show('#fmt-bold',isText,!!a.b);
    show('#fmt-ital',isText,!!a.i);
    show('#fmt-under',isText,!!a.u);
    show('#fmt-strike',isText,!!a.strike);
    show('#fmt-align',isText);
    var alBtn=$('#fmt-align');
    if(alBtn&&isText){
      var al=a.align||'left';
      alBtn.textContent=al.charAt(0).toUpperCase()+al.slice(1);
    }
    show('#fmt-szwrap',isText);
    var szIn=$('#fmt-size');
    if(szIn&&isText&&document.activeElement!==szIn)
      szIn.value=Math.round((a.size||2.6)*5.4);
    show('#fmt-list',isText&&isNum,!!a.list);
    show('#fmt-line',kind==='arrow'||kind==='rect');
    show('#fmt-dash',kind==='arrow'||kind==='rect',!!a.dash);
    show('#fmt-fill',kind==='rect',!!a.fill);
    show('#fmt-shape',kind==='rect',!!a.shape&&a.shape!=='rect');
    show('#fmt-opwrap',true);
    var opR=$('#fmt-op'),opV=$('#fmt-opval');
    var opPct=Math.round((a.op==null?1:a.op)*100);
    if(opR) opR.value=opPct;
    if(opV) opV.textContent=opPct+'%';
    show('#fmt-rotl',kind!=='arrow');
    show('#fmt-rotr',kind!=='arrow');
    show('#fmt-dup',isNum);
    var nSel=selSet.filter(function(i){return typeof i==='number';}).length;
    show('#fmt-group',nSel>=2);
    show('#fmt-ungroup',isNum&&a.grp!=null);
    show('#fmt-front',isNum&&kind!=='arrow');
    show('#fmt-back',isNum&&kind!=='arrow');
    show('#fmt-arline',nSel>=2);
    show('#fmt-argrid',nSel>=2);
    show('#fmt-samewrap',nSel>=2);
    var plainText=isText&&typeof selAnnot==='number';
    var showBg=plainText||noteCell;
    show('#fmt-txlab',(isText&&kind!=='cell')||noteCell);
    show('#fmt-bglab',showBg);
    $$('.swbg',bar).forEach(function(sw){
      sw.hidden=!showBg;
      var cur_=(kind==='cell')
        ?(a.bgcol||'')
        :((a.bg===0)?'none':(a.bgc||'#0e1926'));
      sw.setAttribute('aria-pressed',(cur_===sw.dataset.c).toString());
    });
    show('#fmt-replace',kind==='cell');
    show('#fmt-locate',kind==='cell'&&!!a.ref);
    var lockedV=(kind==='cell')&&!!(a.lockver&&a.lockver.commit);
    var frozen=(kind==='cell')&&frozenFrames.has(a);
    var hasPrev=(kind==='cell')&&!!a.ref
      &&!!frameSnapsPrev[normRef(a.ref)];
    show('#fmt-revert',(frozen||hasPrev)&&!lockedV);
    if((frozen||hasPrev)&&!lockedV){
      var rvb=$('#fmt-revert');
      if(rvb) rvb.innerHTML=frozen
        ?'&#8635; Live figure':'&#10226; Previous figure';
    }
    var canLock=(kind==='cell')&&!!a.ref&&APP.mode==='app';
    show('#fmt-lockver',canLock);
    if(canLock){
      var lvb=$('#fmt-lockver');
      if(lvb) lvb.innerHTML=lockedV
        ?'&#128275; Unlock figure':'&#128274; Lock figure';
    }
    show('#fmt-cropwrap',kind==='image'||kind==='cell');
    show('#fmt-animwrap',isNum);
    /* the code/figure/output part-picker (+ split) — moved off the frame
       into the ribbon's Object group */
    var partsSlot=$('#fmt-parts');
    if(partsSlot){
      partsSlot.innerHTML='';
      var pcr=(kind==='cell'&&typeof selAnnot==='number')
        ?buildPartChooser(s,selAnnot):null;
      if(pcr) partsSlot.appendChild(pcr);
      partsSlot.hidden=!pcr;
    }
    var animBtn=$('#fmt-anim');
    if(animBtn&&isNum){
      var an=a.anim&&a.anim.type;
      var lbl={appear:'Appear',fade:'Fade',rise:'Rise',zoom:'Zoom'}[an]
        ||'Animate';
      animBtn.innerHTML='&#9654; '+lbl+' &#9662;';
    }
    syncRibbonGroups();
  }
  /* hide a ribbon group whose controls are all hidden, and drop the divider
     before the first visible group — so the format ribbon stays tidy */
  function syncRibbonGroups(){
    var bar=$('#et-fmt'); if(!bar) return;
    var first=null;
    $$('.rbn-grp',bar).forEach(function(g){
      var vis=false,kids=g.querySelectorAll('button,input,select,.sh-drop');
      for(var i=0;i<kids.length;i++){
        var n=kids[i],blocked=false;
        while(n&&n!==g){if(n.hidden){blocked=true;break;}n=n.parentNode;}
        if(!blocked){vis=true;break;}
      }
      g.hidden=!vis;
      g.classList.remove('rbn-first');
      if(vis&&!first) first=g;
    });
    if(first) first.classList.add('rbn-first');
  }
  function fmtApply(fn){
    var s=pres.slides[cur]; if(!s) return;
    /* apply to EVERY selected item (a group or shift-multi-select), not just
       the primary — otherwise formatting a multi-selection silently changes
       only one item and collapses the selection */
    var targets=selSet.filter(function(i){return typeof i==='number';});
    if(targets.length){
      targets.forEach(function(i){if(s.annots[i]) fn(s.annots[i]);});
    } else {
      var a=annotByIdx(s,selAnnot); if(!a) return;
      fn(a);
    }
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(!l) return;
    renderAnnots(l,s);
    if(targets.length>1){        /* keep the multi-selection alive */
      selSet=targets.slice();paintSel(l);
      var d=$('#et-del'); if(d) d.disabled=false;
      showFmt();
    } else selectAnnot(l,selAnnot);
  }
  function pctPoint(layer,ev){
    var r=layer.getBoundingClientRect();
    return {x:Math.max(0,Math.min(100,(ev.clientX-r.left)/r.width*100)),
            y:Math.max(0,Math.min(100,(ev.clientY-r.top)/r.height*100))};
  }
  /* ---- snap-to-align: while dragging or resizing, edges and centers
     snap to the canvas (edges + middle) and to every other object's
     edges + centers, with dashed guide lines. Hold Alt to disable. ---- */
  var SNAP_PX=6;
  function annotRectPct(layer,s,i){
    var a=(s.annots||[])[i]; if(!a) return null;
    if(a.k==='arrow')
      return {l:Math.min(a.x1,a.x2),r:Math.max(a.x1,a.x2),
              t:Math.min(a.y1,a.y2),b:Math.max(a.y1,a.y2)};
    var el=layer.querySelector('.an-item[data-idx="'+i+'"]');
    /* auto-sized items (text) AND aspect-fitted figure frames answer with
       their RENDERED rect — snapping must align to the visible plot, not
       a letterboxed stored box */
    if(el&&(a.w==null||a.h==null
            ||el.classList.contains('an-figonly'))){
      var lr=layer.getBoundingClientRect();
      if(lr.width&&lr.height){
        var er=el.getBoundingClientRect();
        return {l:(er.left-lr.left)/lr.width*100,
                r:(er.right-lr.left)/lr.width*100,
                t:(er.top-lr.top)/lr.height*100,
                b:(er.bottom-lr.top)/lr.height*100};
      }
    }
    if(a.w==null||a.h==null) return null;
    return {l:a.x,r:a.x+a.w,t:a.y,b:a.y+a.h};
  }
  function snapTargets(layer,s,skip){
    var xs=[0,50,100],ys=[0,50,100];
    (s.annots||[]).forEach(function(a,i){
      if(skip.indexOf(i)>=0||a.hide) return;
      var r=annotRectPct(layer,s,i);
      if(!r) return;
      xs.push(r.l,(r.l+r.r)/2,r.r);
      ys.push(r.t,(r.t+r.b)/2,r.b);
    });
    return {xs:xs,ys:ys};
  }
  function bestSnap(cands,vals,thr){
    var best=null;
    for(var i=0;i<vals.length;i++) for(var j=0;j<cands.length;j++){
      var d=cands[j]-vals[i];
      if(Math.abs(d)<=thr&&(!best||Math.abs(d)<Math.abs(best.d)))
        best={d:d,at:cands[j]};
    }
    return best;
  }
  function snapThr(layer){
    var r=layer.getBoundingClientRect();
    return {x:r.width?SNAP_PX/r.width*100:1,
            y:r.height?SNAP_PX/r.height*100:1};
  }
  function drawSnapGuides(layer,sx,sy){
    $$('.snapline',layer).forEach(function(n){n.remove();});
    if(sx!=null){
      var v=document.createElement('div');
      v.className='snapline snap-v';v.style.left=sx+'%';
      layer.appendChild(v);
    }
    if(sy!=null){
      var h=document.createElement('div');
      h.className='snapline snap-h';h.style.top=sy+'%';
      layer.appendChild(h);
    }
  }
  function clearSnapGuides(layer){
    $$('.snapline',layer).forEach(function(n){n.remove();});
  }
  function startMove(layer,s,idx,ev0){
    ev0.preventDefault();
    var a=annotByIdx(s,idx); if(!a) return;
    var start=pctPoint(layer,ev0);
    /* drag the whole current selection (group / multi-select) together —
       locked members stay put (lock = can't be dragged) */
    var movers=selSet.filter(function(i){return typeof i==='number';});
    if(typeof idx==='number'&&movers.indexOf(idx)<0) movers=[idx];
    movers=movers.filter(function(i){
      var m=(s.annots||[])[i];return m&&!m.lock;});
    var origs={};
    movers.forEach(function(i){
      origs[i]=JSON.parse(JSON.stringify((s.annots||[])[i]));});
    var single=(typeof idx!=='number')?JSON.parse(JSON.stringify(a)):null;
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,movers);
    /* snap by the union bounding box of everything being dragged
       (hidden members travel along but contribute no snap geometry) */
    var origBB=null;
    movers.forEach(function(i){
      var m=(s.annots||[])[i];
      if(!m||m.hide) return;
      var r=annotRectPct(layer,s,i); if(!r) return;
      origBB=origBB?{l:Math.min(origBB.l,r.l),r:Math.max(origBB.r,r.r),
        t:Math.min(origBB.t,r.t),b:Math.max(origBB.b,r.b)}:r;
    });
    function mm(ev){
      var p=pctPoint(layer,ev);
      var dx=p.x-start.x,dy=p.y-start.y;
      var sx=null,sy=null;
      if(!ev.altKey){
        if(single){       /* a title item positions by its CENTER */
          var bx0=bestSnap(targets.xs,[single.x+dx],thr.x);
          var by0=bestSnap(targets.ys,[single.y+dy],thr.y);
          if(bx0){dx+=bx0.d;sx=bx0.at;}
          if(by0){dy+=by0.d;sy=by0.at;}
        } else if(origBB){
          var bb={l:origBB.l+dx,r:origBB.r+dx,
                  t:origBB.t+dy,b:origBB.b+dy};
          var bx=bestSnap(targets.xs,[bb.l,(bb.l+bb.r)/2,bb.r],thr.x);
          var by=bestSnap(targets.ys,[bb.t,(bb.t+bb.b)/2,bb.b],thr.y);
          if(bx){dx+=bx.d;sx=bx.at;}
          if(by){dy+=by.d;sy=by.at;}
        }
      }
      if(single){a.x=single.x+dx;a.y=single.y+dy;}
      else movers.forEach(function(i){
        var m=(s.annots||[])[i],o=origs[i];
        if(!m||!o) return;
        if(m.k==='arrow'){
          m.x1=o.x1+dx;m.y1=o.y1+dy;m.x2=o.x2+dx;m.y2=o.y2+dy;
        } else {m.x=o.x+dx;m.y=o.y+dy;}
      });
      renderAnnots(layer,s);paintSel(layer);
      drawSnapGuides(layer,sx,sy);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startResize(layer,s,idx,ev0,corner){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a||typeof idx!=='number') return;
    corner=corner||'se';
    var east=corner.indexOf('e')>=0,west=corner.indexOf('w')>=0;
    var south=corner.indexOf('s')>=0,north=corner.indexOf('n')>=0;
    var start=pctPoint(layer,ev0);
    var el=layer.querySelector('.an-item[data-idx="'+idx+'"]');
    var lr=layer.getBoundingClientRect();
    /* a figure frame: first snap the stored rect to the plot it visually
       hugs, then keep the plot's aspect locked while dragging */
    var figRatio=0;
    if(a.k==='cell'&&el&&el.classList.contains('an-figonly')){
      var ff=figFit(layer,a,figImg(el));
      if(ff){a.x=ff.x;a.y=ff.y;a.w=ff.w;a.h=ff.h;figRatio=ff.ratio;}
    }
    var er=el?el.getBoundingClientRect():null;
    var ox=a.x||0,oy=a.y||0;
    var ow=a.w||(er?er.width/lr.width*100:10);
    var oh=a.h||(er?er.height/lr.height*100:10);
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,[idx]);
    function mm(ev){
      var p=pctPoint(layer,ev);
      var dx=p.x-start.x,dy=p.y-start.y;
      /* the dragged corner moves; the opposite corner stays anchored */
      if(east) a.w=Math.max(4,ow+dx);
      if(west){var ww=Math.max(4,ow-dx);a.x=ox+(ow-ww);a.w=ww;}
      if(a.k!=='text'){
        if(south) a.h=Math.max(4,oh+dy);
        if(north){var nh=Math.max(4,oh-dy);a.y=oy+(oh-nh);a.h=nh;}
      }
      var sx=null,sy=null;
      if(!ev.altKey){
        /* the moving edges snap; an aspect-locked figure snaps its width
           and lets the height follow the plot's ratio. A guide only shows
           when the snap actually landed (the 4% minimum can cancel it). */
        var bx=bestSnap(targets.xs,[east?a.x+a.w:a.x],thr.x);
        if(bx){
          if(east){if(a.w+bx.d>=4){a.w=a.w+bx.d;sx=bx.at;}}
          else if(a.w-bx.d>=4){a.x=a.x+bx.d;a.w=a.w-bx.d;sx=bx.at;}
        }
        if(a.k!=='text'&&!figRatio){
          var by=bestSnap(targets.ys,[south?a.y+a.h:a.y],thr.y);
          if(by){
            if(south){if(a.h+by.d>=4){a.h=a.h+by.d;sy=by.at;}}
            else if(a.h-by.d>=4){a.y=a.y+by.d;a.h=a.h-by.d;sy=by.at;}
          }
        }
      }
      if(figRatio&&lr.height){
        var fh=a.w*(lr.width/(lr.height*figRatio));
        if(north) a.y=oy+oh-fh;   /* keep the bottom edge anchored */
        a.h=fh;
      }
      renderAnnots(layer,s);selectAnnot(layer,idx);
      drawSnapGuides(layer,sx,sy);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startRotate(layer,s,idx,ev0){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a) return;
    function mm(ev){
      var el=layer.querySelector('.an-item[data-idx="'+idx+'"]');
      if(!el) return;
      /* the visual centre is rotation-invariant, so measuring the live
         bounding box keeps the pivot stable while the item spins */
      var r=el.getBoundingClientRect();
      var ang=Math.atan2(ev.clientY-(r.top+r.height/2),
                         ev.clientX-(r.left+r.width/2))*180/Math.PI+90;
      if(ev.shiftKey) ang=Math.round(ang/15)*15;
      ang=((ang%360)+360)%360;
      if(ang>180) ang-=360;
      /* a small magnetic dead-zone so items land EXACTLY straight */
      [0,90,-90,180,-180].forEach(function(v){
        if(Math.abs(ang-v)<=1) ang=(v===-180)?180:v;});
      a.rot=Math.round(ang*10)/10||0;
      renderAnnots(layer,s);paintSel(layer);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      if(!a.rot) delete a.rot;
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function startDraw(layer,s,kind,p0){
    var a=(kind==='rect')
      ?{k:'rect',x:p0.x,y:p0.y,w:0,h:0,color:'#ff6b57',sw:3,
        shape:(pendingShape!=='rect'?pendingShape:undefined)}
      :{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,
        color:'#ff6b57',sw:3};
    s.annots=s.annots||[];
    s.annots.push(a);
    var idx=s.annots.length-1;
    function mm(ev){
      var p=pctPoint(layer,ev);
      if(a.k==='rect'){
        a.x=Math.min(p0.x,p.x);a.y=Math.min(p0.y,p.y);
        a.w=Math.abs(p.x-p0.x);a.h=Math.abs(p.y-p0.y);
      } else {a.x2=p.x;a.y2=p.y;}
      renderAnnots(layer,s);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      var tiny=(a.k==='rect')?(a.w<1.5&&a.h<1.5)
        :(Math.abs(a.x2-a.x1)<1.5&&Math.abs(a.y2-a.y1)<1.5);
      if(tiny) s.annots.splice(idx,1);
      markDirty();setTool('select');
      renderAnnots(layer,s);
      if(!tiny) selectAnnot(layer,idx);
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function distToSeg(px,py,x1,y1,x2,y2){
    var dx=x2-x1,dy=y2-y1;
    var L2=dx*dx+dy*dy;
    var u=L2?((px-x1)*dx+(py-y1)*dy)/L2:0;
    u=Math.max(0,Math.min(1,u));
    return Math.hypot(px-(x1+u*dx),py-(y1+u*dy));
  }
  function startEndpoint(layer,s,idx,ep,ev0){
    ev0.preventDefault();
    var a=(s.annots||[])[idx];
    if(!a||a.k!=='arrow'||a.lock) return;
    function mm(ev){
      var p=pctPoint(layer,ev);
      a['x'+ep]=p.x;a['y'+ep]=p.y;
      renderAnnots(layer,s);selectAnnot(layer,idx);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  function arrowAt(layer,s,ev){
    if(!s.annots) return -1;
    var r=layer.getBoundingClientRect();
    var px=ev.clientX-r.left,py=ev.clientY-r.top;
    var best=-1,bestD=12;
    s.annots.forEach(function(a,i){
      if(a.k!=='arrow'||a.lock||a.hide) return;
      var d=distToSeg(px,py,
        a.x1/100*r.width,a.y1/100*r.height,
        a.x2/100*r.width,a.y2/100*r.height);
      if(d<bestD){bestD=d;best=i;}
    });
    return best;
  }
  function wireEditor(layer,s){
    layer.addEventListener('mousedown',function(ev){
      if(mode!=='edit') return;
      var t=ev.target;
      var item=(t.closest&&t.closest('.an-item'))
        ||(t.getAttribute&&t.classList
           &&t.classList.contains('an-item')?t:null);
      if(tool==='select'){
        /* endpoint handles first, then resize handles, then arrows
           (they render on top, so they win the click even over a
           frame), then the item */
        if(t.classList&&t.classList.contains('an-endpt')){
          var idxE=+t.getAttribute('data-idx');
          selectAnnot(layer,idxE);
          startEndpoint(layer,s,idxE,
            t.getAttribute('data-ep'),ev);
          return;
        }
        if(item&&t.classList&&t.classList.contains('an-resize')){
          var rawR=item.getAttribute('data-idx');
          var idxR=(rawR==='t'||rawR==='s')?rawR:+rawR;
          selectAnnot(layer,idxR);
          startResize(layer,s,idxR,ev,t.dataset.corner);
          return;
        }
        if(item&&t.classList&&t.classList.contains('an-rotate')){
          var rawRo=item.getAttribute('data-idx');
          var idxRo=(rawRo==='t'||rawRo==='s')?rawRo:+rawRo;
          selectAnnot(layer,idxRo);
          startRotate(layer,s,idxRo,ev);
          return;
        }
        var ai=arrowAt(layer,s,ev);
        if(ai>=0){
          /* honour shift/multi-select the same way the item branch does */
          if(ev.shiftKey){selectAnnot(layer,ai,true);return;}
          if(selSet.indexOf(ai)<0) selectAnnot(layer,ai,false);
          else {selAnnot=ai;paintSel(layer);showFmt();}
          startMove(layer,s,ai,ev);
          return;
        }
        if(item){
          var raw=item.getAttribute('data-idx');
          var idx=(raw==='t'||raw==='s')?raw:+raw;
          /* Shift+click adds/removes from the selection (for grouping);
             it never starts a drag */
          if(ev.shiftKey&&typeof idx==='number'){
            selectAnnot(layer,idx,true);return;
          }
          /* clicking an item already in a multi-selection keeps the set and
             drags the whole group */
          if(selSet.indexOf(idx)<0) selectAnnot(layer,idx,false);
          else {selAnnot=idx;paintSel(layer);showFmt();}
          var handleOnly=item.classList.contains('an-text')
            ||item.classList.contains('an-title');
          /* a grouped/multi-selected item drags from its body too (its move
             handle is hidden), so the whole group moves as one */
          var grouped=(selSet.length>1&&selSet.indexOf(idx)>=0);
          if(grouped||!handleOnly
             ||(t.classList&&t.classList.contains('an-handle')))
            startMove(layer,s,idx,ev);
        } else selectAnnot(layer,null);
        return;
      }
      ev.preventDefault();
      var p=pctPoint(layer,ev);
      if(tool==='text'){
        s.annots=s.annots||[];
        s.annots.push({k:'text',x:p.x,y:p.y,text:'Text',
          size:2.6,color:'#ffffff',bg:1});
        var idx2=s.annots.length-1;
        markDirty();setTool('select');
        renderAnnots(layer,s);selectAnnot(layer,idx2);
        var tx=layer.querySelector(
          '.an-item[data-idx="'+idx2+'"] .an-tx');
        if(tx){
          tx.focus();
          try{
            var rng=document.createRange();
            rng.selectNodeContents(tx);
            var sl=window.getSelection();
            sl.removeAllRanges();sl.addRange(rng);
          }catch(e){}
        }
      } else if(tool==='cell'){
        s.annots=s.annots||[];
        s.annots.push({k:'cell',x:Math.min(p.x,64),
          y:Math.min(p.y,64),w:34,h:30,ref:null});
        markDirty();setTool('select');
        renderAnnots(layer,s);
        selectAnnot(layer,s.annots.length-1);
      } else if(tool==='rect'||tool==='arrow'){
        startDraw(layer,s,tool,p);
      }
    });
  }
  function setTool(t){
    tool=t;
    $$('#edit-tools .et').forEach(function(b){
      b.setAttribute('aria-pressed',(b.dataset.tool===t).toString());});
    var shb=$('#sh-btn');   /* the Shapes dropdown draws the 'rect' tool */
    if(shb) shb.setAttribute('aria-pressed',(t==='rect').toString());
    var l=stage.querySelector('.annot-layer');
    if(l) l.className='annot-layer tool-'+t;
    var hint=$('#et-hint');
    if(hint) hint.textContent=
      t==='text'?'Click on the slide to place a text box'
      :t==='arrow'?'Drag on the slide to draw an arrow'
      :t==='rect'?('Drag on the slide to draw a '
        +(pendingShape==='rect'?'rectangle':pendingShape))
      :t==='cell'?'Click on the slide to drop a cell frame, then pick a card '
        +'from your notebook to fill it'
      :'Click an item to select; drag to move; Del removes';
  }
  function deleteSel(){
    var s=pres.slides[cur];
    if(!s||!s.annots) return;
    var idxs=selSet.filter(function(i){return typeof i==='number';});
    if(!idxs.length&&typeof selAnnot==='number') idxs=[selAnnot];
    if(!idxs.length) return;
    idxs.sort(function(x,y){return y-x;}).forEach(function(i){
      if(i>=0&&i<s.annots.length) s.annots.splice(i,1);});
    if(!s.annots.length) delete s.annots;
    selAnnot=null;selSet=[];markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l) renderAnnots(l,s);
    var d=$('#et-del'); if(d) d.disabled=true;
    showFmt();
  }
  function groupSel(){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var idxs=selSet.filter(function(i){return typeof i==='number';});
    if(idxs.length<2) return;
    var gid=nextGrp(s);
    idxs.forEach(function(i){if(s.annots[i]) s.annots[i].grp=gid;});
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,idxs[0]);}
  }
  function ungroupSel(){
    var s=pres.slides[cur];
    if(!s||typeof selAnnot!=='number'||!s.annots) return;
    var a=s.annots[selAnnot]; if(!a||a.grp==null) return;
    var g=a.grp;
    s.annots.forEach(function(x){if(x.grp===g) delete x.grp;});
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,selAnnot);}
  }

  /* ---------- picking: click a notebook card into a cell frame ------- */
  function startPick(idx){
    if(typeof idx!=='number') return;
    picking=idx;
    deckEl.hidden=true;
    document.body.classList.remove('deck-open');
    document.body.classList.remove('creating-docs');
    document.body.classList.remove('slide-editing');
    document.body.classList.add('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=false;
  }
  function endPick(ref){
    var idx=picking; picking=-1;
    document.body.classList.remove('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=true;
    if(ref!==undefined&&idx>=0){
      var s=pres.slides[cur];
      var a=s&&(s.annots||[])[idx];
      if(a&&a.k==='cell'){a.ref=ref;markDirty();}
    }
    openDeck('edit');
    var l=stage.querySelector('.annot-layer');
    if(l&&idx>=0) selectAnnot(l,idx);
  }
  document.addEventListener('click',function(e){
    if(picking<0) return;
    var t=e.target;
    if(!t||!t.closest) return;
    if(t.closest('.pickbar')) return;
    var shellEl=t.closest('.nbshell');
    if(!shellEl) return;
    var card=t.closest('.card');
    if(!card) return;
    if(t.closest('.codetoggle,.depchip,a')) return;
    e.preventDefault();e.stopPropagation();
    /* a Plot-trace tab's cards are clones — resolve to the real notebook */
    endPick(nsKey(shellEl.dataset.src||shellEl.dataset.nb,
      card.dataset.anchor));
  },true);

  /* ---------- format bar wiring ---------- */
  $$('#et-fmt .sw:not(.swbg):not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('mousedown',function(e){
      /* keep the caret/selection in the text box so we can recolour just
         the highlighted run instead of the whole box */
      if(activeTextEditable()) e.preventDefault();
    });
    sw.addEventListener('click',function(){
      if(colorSelection(sw.dataset.c)) return;
      fmtApply(function(a){
        if(a.k==='cell') a.txcol=sw.dataset.c;
        else a.color=sw.dataset.c;
      });
    });
  });
  function onFmt(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(){fmtApply(fn);});
  }
  onFmt('#fmt-smaller',function(a){
    if(a.k==='cell') a.ts=Math.max(0.5,
      Math.round((a.ts||1)/1.15*100)/100);
    else a.size=Math.max(1.2,(a.size||2.6)/1.25);});
  onFmt('#fmt-bigger',function(a){
    if(a.k==='cell') a.ts=Math.min(3,
      Math.round((a.ts||1)*1.15*100)/100);
    else a.size=Math.min(20,(a.size||2.6)*1.25);});
  onFmt('#fmt-line',function(a){
    var cur_=a.sw||3;
    a.sw=cur_>=5?2:(cur_>=3.5?5:3.5);});
  onFmt('#fmt-dash',function(a){a.dash=a.dash?0:1;});
  onFmt('#fmt-fill',function(a){a.fill=a.fill?0:1;});
  $$('#et-fmt .swbg:not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('click',function(){
      fmtApply(function(a){
        if(a.k==='cell'){a.bgcol=sw.dataset.c;}
        else if(sw.dataset.c==='none'){a.bg=0;}
        else{a.bg=1;a.bgc=sw.dataset.c;}
      });
    });
  });

  /* ---------- professional colour picker: hex / rgb / rgba + alpha + a
     recent-colours strip. Text swatches and the fill swatches each get a
     rainbow "＋" chip that opens it; any CSS colour string is accepted. ---- */
  var cpEl=$('#color-pop'), cpTarget='text', cpRGBA={r:57,g:169,b:192,a:1};
  /* a live text selection captured when the picker opens, so a custom colour
     can recolour just the highlighted run (focus moves to the popup on apply) */
  var cpSavedEl=null, cpSavedRange=null;
  function clamp255(n){n=Math.round(+n||0);return n<0?0:n>255?255:n;}
  function hex2(n){return ('0'+clamp255(n).toString(16)).slice(-2);}
  function toHex(c){return '#'+hex2(c.r)+hex2(c.g)+hex2(c.b);}
  function toStr(c){
    return c.a>=1?toHex(c):('rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '
      +clamp255(c.b)+', '+(Math.round(c.a*100)/100)+')');
  }
  /* faint fill tint of a shape's colour — PARSE first so translucent rgba()
     colours work, not just #rrggbb (a hex-suffix concat would corrupt them);
     `alpha` is the tint fraction of 255 (matches the old 0x26 / 0x2b). */
  function shapeFill(col,alpha){
    var c=parseColor(col); if(!c) return 'transparent';
    return 'rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '+clamp255(c.b)+', '
      +(Math.round(c.a*alpha*1000)/1000)+')';
  }
  function parseColor(str){
    if(!str) return null;
    str=String(str).trim();
    var m=str.match(/^#([0-9a-f]{3,8})$/i);
    if(m){
      var h=m[1];
      if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      else if(h.length===4) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
      if(h.length===6||h.length===8) return {
        r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),
        b:parseInt(h.slice(4,6),16),
        a:h.length===8?parseInt(h.slice(6,8),16)/255:1};
      return null;
    }
    m=str.match(/^rgba?\(([^)]+)\)$/i);
    if(m){
      var p=m[1].split(/[,\s/]+/).filter(Boolean);
      if(p.length>=3){var pa=parseFloat(p[3]);
        return {r:clamp255(parseFloat(p[0])),g:clamp255(parseFloat(p[1])),
          b:clamp255(parseFloat(p[2])),
          a:p.length>3?(isFinite(pa)?Math.max(0,Math.min(1,pa)):1):1};}
    }
    return null;
  }
  function cpSync(from){
    var nat=$('#cp-native'),hx=$('#cp-hex'),rg=$('#cp-rgb'),
        al=$('#cp-alpha'),av=$('#cp-aval'),pv=$('#cp-preview');
    if(nat&&from!=='native') nat.value=toHex(cpRGBA);
    if(hx&&from!=='hex') hx.value=cpRGBA.a>=1?toHex(cpRGBA)
      :toHex(cpRGBA)+hex2(Math.round(cpRGBA.a*255));
    if(rg&&from!=='rgb') rg.value='rgba('+clamp255(cpRGBA.r)+', '
      +clamp255(cpRGBA.g)+', '+clamp255(cpRGBA.b)+', '
      +(Math.round(cpRGBA.a*100)/100)+')';
    if(al&&from!=='alpha') al.value=Math.round(cpRGBA.a*100);
    if(av) av.textContent=Math.round(cpRGBA.a*100)+'%';
    if(pv) pv.style.setProperty('--cpc',toStr(cpRGBA));
    if(hx) hx.classList.remove('bad');
    if(rg) rg.classList.remove('bad');
  }
  function cpRecent(){
    try{return JSON.parse(localStorage.getItem('plotline-colors')||'[]');}
    catch(e){return [];}
  }
  function cpPushRecent(str){
    var arr=cpRecent().filter(function(x){return x!==str;});
    arr.unshift(str);
    try{localStorage.setItem('plotline-colors',
      JSON.stringify(arr.slice(0,12)));}catch(e){}
  }
  function cpRenderRecent(){
    var box=$('#cp-recent'); if(!box) return;
    box.innerHTML='';
    cpRecent().forEach(function(str){
      var b=document.createElement('button');
      b.className='cp-rsw cp-sw-chk';b.type='button';b.title=str;
      b.style.setProperty('--cpc',str);
      b.addEventListener('click',function(){
        var c=parseColor(str); if(c){cpRGBA=c;cpSync();}});
      box.appendChild(b);
    });
  }
  function cpCurrentFor(target){
    var s=pres.slides[cur];
    var a=(s&&selAnnot!==null)?annotByIdx(s,selAnnot):null;
    if(!a) return null;
    if(target==='fill')
      return a.k==='cell'?(a.bgcol||null):(a.bg===0?null:(a.bgc||null));
    return a.k==='cell'?(a.txcol||null):(a.color||null);
  }
  function openColorPop(target,anchor){
    if(!cpEl) return;
    cpTarget=target;
    cpSavedEl=null;cpSavedRange=null;
    if(target==='text'){
      var te=activeTextEditable();
      if(te&&selectionInside(te)) try{
        cpSavedEl=te;
        cpSavedRange=window.getSelection().getRangeAt(0).cloneRange();
      }catch(e){cpSavedEl=null;cpSavedRange=null;}
    }
    var head=$('#cp-head');
    if(head) head.textContent=target==='fill'?'Custom fill':'Custom colour';
    var c0=parseColor(cpCurrentFor(target))||{r:57,g:169,b:192,a:1};
    cpRGBA={r:c0.r,g:c0.g,b:c0.b,a:c0.a};
    cpRenderRecent();cpSync();
    cpEl.hidden=false;
    var r=anchor.getBoundingClientRect(),w=236;
    var ph=cpEl.getBoundingClientRect().height||300;
    var left=Math.max(8,Math.min(r.left,window.innerWidth-w-8));
    var top=r.bottom+8;
    if(top+ph>window.innerHeight-8) top=Math.max(8,r.top-ph-8);
    cpEl.style.left=left+'px';cpEl.style.top=top+'px';
  }
  function cpApply(){
    var str=toStr(cpRGBA);
    if(cpTarget==='text'){
      var did=false;
      /* restore the highlighted run (focus moved to the popup) and recolour
         just it, like the preset swatches do; else colour the whole box */
      if(cpSavedEl&&cpSavedRange&&document.body.contains(cpSavedEl)) try{
        cpSavedEl.focus();
        var sel=window.getSelection();
        sel.removeAllRanges();sel.addRange(cpSavedRange);
        did=colorSelection(str);
      }catch(e){did=false;}
      if(!did) fmtApply(function(a){
        if(a.k==='cell') a.txcol=str; else a.color=str;});
    } else fmtApply(function(a){
      if(a.k==='cell') a.bgcol=str; else {a.bg=1;a.bgc=str;}});
    cpSavedEl=null;cpSavedRange=null;
    cpPushRecent(str);
    if(cpEl) cpEl.hidden=true;
  }
  (function(){
    var nat=$('#cp-native'),hx=$('#cp-hex'),rg=$('#cp-rgb'),al=$('#cp-alpha');
    if(nat) nat.addEventListener('input',function(){
      var c=parseColor(nat.value);
      if(c){cpRGBA.r=c.r;cpRGBA.g=c.g;cpRGBA.b=c.b;cpSync('native');}});
    if(hx) hx.addEventListener('input',function(){
      var v=hx.value.trim(),c=parseColor(v);
      if(c){cpRGBA=c;cpSync('hex');} else hx.classList.toggle('bad',v!=='');});
    if(rg) rg.addEventListener('input',function(){
      var v=rg.value.trim(),c=parseColor(v);
      if(c){cpRGBA=c;cpSync('rgb');} else rg.classList.toggle('bad',v!=='');});
    if(al) al.addEventListener('input',function(){
      cpRGBA.a=(+al.value)/100;cpSync('alpha');});
    var ap=$('#cp-apply'); if(ap) ap.addEventListener('click',cpApply);
    var swc=$('#sw-custom');
    if(swc){
      swc.addEventListener('mousedown',function(e){
        if(activeTextEditable()) e.preventDefault();});
      swc.addEventListener('click',function(){openColorPop('text',swc);});
    }
    var swbgc=$('#swbg-custom');
    if(swbgc) swbgc.addEventListener('click',function(){
      openColorPop('fill',swbgc);});
    document.addEventListener('mousedown',function(e){
      if(cpEl&&!cpEl.hidden&&!cpEl.contains(e.target)
         &&e.target!==swc&&e.target!==swbgc) cpEl.hidden=true;
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&cpEl&&!cpEl.hidden){e.stopPropagation();
        cpEl.hidden=true;}
    },true);
  })();
  var fontSelEl=$('#fmt-font');
  if(fontSelEl) fontSelEl.addEventListener('change',function(){
    var v=this.value;
    fmtApply(function(a){
      if(v==='sans') delete a.font; else a.font=v;
    });
  });
  onFmt('#fmt-bold',function(a){a.b=a.b?0:1;});
  onFmt('#fmt-ital',function(a){a.i=a.i?0:1;});
  onFmt('#fmt-under',function(a){a.u=a.u?0:1;});
  onFmt('#fmt-strike',function(a){a.strike=a.strike?0:1;});
  onFmt('#fmt-align',function(a){
    var order=['left','center','right','justify'];
    var ni=(order.indexOf(a.align||'left')+1)%order.length;
    if(order[ni]==='left') delete a.align; else a.align=order[ni];});
  onFmt('#fmt-list',function(a){a.list=a.list?0:1;});
  onFmt('#fmt-shape',function(a){
    /* cycle the selected shape through the whole set */
    var order=SHAPE_LIST.map(function(p){return p[0];});
    var ni=(order.indexOf(a.shape||'rect')+1)%order.length;
    if(order[ni]==='rect') delete a.shape; else a.shape=order[ni];});
  var opRangeEl=$('#fmt-op');
  if(opRangeEl) opRangeEl.addEventListener('input',function(){
    var pct=Math.max(0,Math.min(100,+this.value));
    fmtApply(function(a){
      if(pct>=100) delete a.op; else a.op=pct/100;});
  });
  var szInEl=$('#fmt-size');
  if(szInEl) szInEl.addEventListener('change',function(){
    var pt=+this.value;
    if(!(pt>0)) return;
    pt=Math.max(6,Math.min(240,pt));
    fmtApply(function(a){a.size=pt/5.4;});
  });
  onFmt('#fmt-rotl',function(a){
    a.rot=(((a.rot||0)-15)%360+360)%360;
    if(!a.rot) delete a.rot;});
  onFmt('#fmt-rotr',function(a){
    a.rot=(((a.rot||0)+15)%360+360)%360;
    if(!a.rot) delete a.rot;});
  function duplicateSel(){
    var s=pres.slides[cur];
    if(!s||typeof selAnnot!=='number'||!s.annots) return;
    var cp=JSON.parse(JSON.stringify(s.annots[selAnnot]));
    /* a copy is its own item: never silently join the source's group, and
       give it its own build step rather than sharing the source's */
    delete cp.grp;
    if(cp.anim) cp.anim={type:cp.anim.type,order:nextAnimOrder(s)};
    if(cp.k==='arrow'){
      cp.x1+=3;cp.y1+=3;cp.x2+=3;cp.y2+=3;
    } else {cp.x=(cp.x||0)+3;cp.y=(cp.y||0)+3;}
    s.annots.push(cp);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
  }
  /* nudge the selection with the arrow keys (Shift = bigger step) */
  function nudgeSel(dx,dy){
    var s=pres.slides[cur]; if(!s) return;
    if(selAnnot==='t'||selAnnot==='s'){
      var tp=titleProps(s,selAnnot);tp.x+=dx;tp.y+=dy;
    } else {
      var idxs=selSet.filter(function(i){return typeof i==='number';});
      if(!idxs.length&&typeof selAnnot==='number') idxs=[selAnnot];
      if(!idxs.length||!s.annots) return;
      idxs.forEach(function(i){
        var a=s.annots[i]; if(!a||a.lock) return;  /* locked: no nudge */
        if(a.k==='arrow'){a.x1+=dx;a.y1+=dy;a.x2+=dx;a.y2+=dy;}
        else {a.x=(a.x||0)+dx;a.y=(a.y||0)+dy;}
      });
    }
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
  }
  var dupBtn=$('#fmt-dup');
  if(dupBtn) dupBtn.addEventListener('click',duplicateSel);
  var grpBtn=$('#fmt-group');
  if(grpBtn) grpBtn.addEventListener('click',groupSel);
  var ungBtn=$('#fmt-ungroup');
  if(ungBtn) ungBtn.addEventListener('click',ungroupSel);
  function zMove(front){
    var s=pres.slides[cur];
    if(!s||typeof selAnnot!=='number'||!s.annots) return;
    var a=s.annots.splice(selAnnot,1)[0];
    var idx;
    if(front){s.annots.push(a);idx=s.annots.length-1;}
    else{s.annots.unshift(a);idx=0;}
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,idx);}
  }
  var frontBtn=$('#fmt-front');
  if(frontBtn) frontBtn.addEventListener('click',function(){
    zMove(true);});
  var backBtn=$('#fmt-back');
  if(backBtn) backBtn.addEventListener('click',function(){
    zMove(false);});
  /* ---- Row / Grid arrange + "Make same size" (multi-selection) ---- */
  function selRects(){
    /* the selected, laid-out items with their VISUAL rects (an aspect-
       fitted figure answers with the plot it shows, not its stored box) */
    var s=pres.slides[cur]; if(!s) return [];
    var l=stage.querySelector('.annot-layer'); if(!l) return [];
    return selSet.filter(function(i){return typeof i==='number';})
      .map(function(i){
        var a=(s.annots||[])[i];
        if(!a||a.k==='arrow'||a.lock||a.hide) return null;
        var r=annotRectPct(l,s,i);
        return r?{i:i,a:a,r:r,w:r.r-r.l,h:r.b-r.t}:null;
      }).filter(Boolean);
  }
  function selBBox(items){
    var bb={l:1e9,r:-1e9,t:1e9,b:-1e9};
    items.forEach(function(x){
      bb.l=Math.min(bb.l,x.r.l);bb.r=Math.max(bb.r,x.r.r);
      bb.t=Math.min(bb.t,x.r.t);bb.b=Math.max(bb.b,x.r.b);});
    return bb;
  }
  function placeAt(x,l2,t2){
    x.a.x=l2;x.a.y=t2;
    /* figure frames: pin the model to the visual box so the aspect fit
       re-renders the plot exactly in the slot we computed */
    if(x.a.k==='cell'){x.a.w=x.w;x.a.h=x.h;}
  }
  function rerenderSel(){
    markDirty();
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(l&&s){renderAnnots(l,s);paintSel(l);}
  }
  function arrangeRow(){
    var items=selRects(); if(items.length<2) return;
    var bb=selBBox(items);
    items.sort(function(p,q){return p.r.l-q.r.l;});
    var sum=0;items.forEach(function(x){sum+=x.w;});
    /* keep the selection's horizontal span; if the items cannot fit in
       it side by side, fall back to a small fixed gap */
    var gap=(bb.r-bb.l>=sum)
      ?((bb.r-bb.l-sum)/(items.length-1)):1.5;
    var cy=(bb.t+bb.b)/2,x0=bb.l;
    items.forEach(function(x){
      placeAt(x,x0,cy-x.h/2);x0+=x.w+gap;});
    rerenderSel();
  }
  function arrangeGrid(){
    var items=selRects(); if(items.length<2) return;
    var bb=selBBox(items);
    /* reading order: rows top-to-bottom, then left-to-right */
    items.sort(function(p,q){return (p.r.t-q.r.t)||(p.r.l-q.r.l);});
    var n=items.length;
    var cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols);
    var mw=0,mh=0;
    items.forEach(function(x){mw=Math.max(mw,x.w);mh=Math.max(mh,x.h);});
    /* grid cells at least as big as the largest item, growing past the
       current bounding box when the items started stacked */
    var cw=Math.max((bb.r-bb.l)/cols,mw+2);
    var ch=Math.max((bb.b-bb.t)/rows,mh+2);
    var ox=Math.max(0,Math.min(bb.l,100-cw*cols));
    var oy=Math.max(0,Math.min(bb.t,100-ch*rows));
    items.forEach(function(x,k){
      placeAt(x,
        ox+(k%cols)*cw+(cw-x.w)/2,
        oy+Math.floor(k/cols)*ch+(ch-x.h)/2);
    });
    rerenderSel();
  }
  function sameSize(mode){
    var items=selRects(); if(items.length<2) return;
    var nums=selSet.filter(function(i){return typeof i==='number';});
    var ref=null;
    if(mode==='first'||mode==='last'){
      var want=(mode==='first')?nums[0]:nums[nums.length-1];
      ref=items.filter(function(x){return x.i===want;})[0];
    } else {
      items.forEach(function(x){
        if(!ref||(mode==='smallest'
          ?x.w*x.h<ref.w*ref.h:x.w*x.h>ref.w*ref.h)) ref=x;});
    }
    if(!ref) ref=items[items.length-1];  /* the reference was an arrow */
    items.forEach(function(x){
      if(x===ref) return;
      if(x.a.k==='cell'){x.a.x=x.r.l;x.a.y=x.r.t;}
      x.a.w=ref.w;
      if(x.a.k!=='text') x.a.h=ref.h;
    });
    toast('Same size: matched the '+
      (mode==='first'?'first selected':mode==='last'?'last selected'
       :mode)+' item');
    rerenderSel();
  }
  var arRowBtn=$('#fmt-arline');
  if(arRowBtn) arRowBtn.addEventListener('click',arrangeRow);
  var arGridBtn=$('#fmt-argrid');
  if(arGridBtn) arGridBtn.addEventListener('click',arrangeGrid);
  wireFloatDropdown('fmt-samewrap','fmt-same','fmt-same-menu',
    [['last','Match LAST selected'],
     ['first','Match FIRST selected'],
     ['largest','Match the largest'],
     ['smallest','Match the smallest']],'same',
    function(mode){sameSize(mode);});
  var repBtn=$('#fmt-replace');
  if(repBtn) repBtn.addEventListener('click',function(){
    if(typeof selAnnot==='number') startPick(selAnnot);
  });
  /* Previous figure <-> Live figure: rescue ONE frame after a notebook
     re-run broke its plot, without giving up the other frames' updates */
  var revBtn=$('#fmt-revert');
  if(revBtn) revBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    if(frozenFrames.has(a)){
      frozenFrames.delete(a);
      toast('Back to the live figure');
    } else {
      var prev=frameSnapsPrev[normRef(a.ref)];
      if(!prev){toast('No pre-refresh figure for this frame yet');return;}
      frozenFrames.set(a,prev);
      toast('Showing the figure from before the refresh');
    }
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
    showFmt();
  });
  /* Lock figure <-> Unlock: pin a frame to its notebook's current git
     commit — refreshes stop touching it (and it renders even when the
     notebook is closed) */
  function lockFrame(a){
    var pr=splitRef(normRef(a.ref)||String(a.ref||''));
    var path=pr[0]?nbPathFor(pr[0]):null;
    if(!path||/^https?:/i.test(path)){
      toast('Locking needs a local notebook file');
      return Promise.resolve(false);
    }
    var sh=APP.shells[pr[0]];
    if(sh&&sh.version&&/^git:/.test(sh.version)){
      a.lockver={commit:sh.version.slice(4)};
      toast('Locked to '+a.lockver.commit+' (the version being viewed)');
      return Promise.resolve(true);
    }
    return APP.api('/api/gitstate',{path:path}).then(function(g){
      if(!g||!g.repo||!g.commit){
        toast('Not in a git repository — commit the notebook first');
        return false;
      }
      a.lockver={commit:g.commit.id,msg:g.commit.msg||'',
        date:g.commit.date||''};
      toast('Locked to '+g.commit.id
        +(g.commit.msg?' “'+g.commit.msg+'”':''));
      return true;
    }).catch(function(e){
      toast('Lock failed: '+((e&&e.message)||e));
      return false;
    });
  }
  var lockVBtn=$('#fmt-lockver');
  if(lockVBtn) lockVBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    function done(){
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s);paintSel(l);}
      showFmt();
    }
    if(a.lockver){
      delete a.lockver;
      toast('Unlocked — this figure follows notebook refreshes again');
      done();
      return;
    }
    lockFrame(a).then(function(ok){if(ok) done();});
  });
  /* Locate in notebook: leave the deck and land on the card this frame
     was placed from — its home in the notebook, scrolled to + flashed */
  var locBtn=$('#fmt-locate');
  if(locBtn) locBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    var it=resolveRef(a.ref);
    var card=cardEl(a.ref);
    if(!it||!card){toast("That card's notebook is not open");return;}
    closeDeck();
    if(APP.activate) APP.activate(it.nb);
    setTimeout(function(){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},1400);
    },60);
  });
  var pickCancel=$('#pick-cancel');
  if(pickCancel) pickCancel.addEventListener('click',function(){
    endPick();
  });
  /* ---- add an image: read the file as a data URI, embed + place it ---- */
  function placeImage(src,ar){
    var s=pres.slides[cur]; if(!s) return;
    var l=stage.querySelector('.annot-layer');
    var lr=l?l.getBoundingClientRect():null;
    var w=40,h=32;
    if(ar&&lr&&lr.height){h=w*(lr.width/lr.height)*ar;}
    h=Math.max(8,Math.min(86,h));
    s.annots=s.annots||[];
    s.annots.push({k:'image',x:Math.max(2,50-w/2),
      y:Math.max(2,50-h/2),w:w,h:h,src:src});
    markDirty();
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
  }
  var etImage=$('#et-image'),imgFile=$('#img-file');
  if(etImage&&imgFile) etImage.addEventListener('click',function(){
    imgFile.value='';imgFile.click();});
  if(imgFile) imgFile.addEventListener('change',function(){
    var f=this.files&&this.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){
      var src=rd.result;
      var probe=new Image();
      probe.onload=function(){
        placeImage(src,(probe.naturalHeight||3)/(probe.naturalWidth||4));};
      probe.onerror=function(){placeImage(src,0);};
      probe.src=src;
    };
    rd.readAsDataURL(f);
  });
  /* the format bar scrolls horizontally (overflow), which would CLIP a normal
     absolute dropdown — so the Crop / Animate menus float with position:fixed,
     positioned under their button each time they open */
  function floatMenu(btn,menu){
    menu.style.position='fixed';
    menu.style.zIndex='240';
    var r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    var mw=menu.offsetWidth||170;
    menu.style.left=Math.max(8,
      Math.min(r.left,window.innerWidth-mw-8))+'px';
    menu.style.right='auto';menu.style.bottom='auto';
  }
  function wireFloatDropdown(wrapId,btnId,menuId,opts,attr,onPick,iconFn){
    var wrap=$('#'+wrapId),btn=$('#'+btnId),menu=$('#'+menuId);
    if(!wrap||!btn||!menu) return;
    opts.forEach(function(p){
      var o=document.createElement('button');
      o.className='sh-opt';o.setAttribute('data-'+attr,p[0]);o.title=p[1];
      if(iconFn){
        var ic=iconFn(p[0]); if(ic) o.appendChild(ic);
        var lbl=document.createElement('span');
        lbl.className='sh-opt-t';lbl.textContent=p[1];o.appendChild(lbl);
      } else o.textContent=p[1];
      o.addEventListener('click',function(e){
        e.stopPropagation();onPick(p[0]);
        menu.hidden=true;btn.setAttribute('aria-expanded','false');
      });
      menu.appendChild(o);
    });
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=menu.hidden;
      menu.hidden=!willOpen;
      btn.setAttribute('aria-expanded',willOpen.toString());
      if(willOpen) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    });
  }
  /* ---- crop-to-shape dropdown (images + notebook cells) ---- */
  wireFloatDropdown('fmt-cropwrap','fmt-crop','fmt-crop-menu',
    CROP_SHAPES,'shape',function(shape){
      fmtApply(function(a){
        a.crop=a.crop||{};
        if(shape==='rect'){
          delete a.crop.shape;
          if(!(a.crop.t||a.crop.r||a.crop.b||a.crop.l)) delete a.crop;
        } else a.crop.shape=shape;
      });
    },cropIcon);
  /* ---- animation PANE: effect + build order. Items on the same build appear
     TOGETHER; each build is one click in playback. ---- */
  (function(){
    var wrap=$('#fmt-animwrap'),btn=$('#fmt-anim'),menu=$('#fmt-anim-menu');
    if(!wrap||!btn||!menu) return;
    menu.classList.add('anim-pane');
    function rerender(){
      var s=pres.slides[cur],l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s);paintSel(l);}
    }
    function renumber(s){animSeq(s).forEach(function(st,i){
      st.items.forEach(function(idx){s.annots[idx].anim.order=i;});});}
    function stepOf(s,idx){var r=-1;animSeq(s).forEach(function(st,i){
      if(st.items.indexOf(idx)>=0) r=i;});return r;}
    function commit(s){markDirty();rerender();render();}
    function setType(type){
      var s=pres.slides[cur]; if(!s) return;
      var idxs=selSet.filter(function(i){return typeof i==='number';});
      if(!idxs.length&&typeof selAnnot==='number') idxs=[selAnnot];
      var no=nextAnimOrder(s);            /* new anims share one build step */
      idxs.forEach(function(i){var a=s.annots[i]; if(!a) return;
        if(type==='none') delete a.anim;
        else if(a.anim) a.anim.type=type;
        else a.anim={type:type,order:no};});
      commit(s);
    }
    function mergeUp(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      if(!a||!a.anim) return;var q=animSeq(s),si=stepOf(s,selAnnot);
      if(si>0){a.anim.order=q[si-1].order;renumber(s);commit(s);}
    }
    function splitOwn(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      if(!a||!a.anim) return;
      a.anim.order=(a.anim.order||0)+0.5;renumber(s);commit(s);
    }
    function moveStep(si,dir){
      var s=pres.slides[cur],q=animSeq(s),tj=si+dir;
      if(tj<0||tj>=q.length) return;
      var oa=q[si].order,ob=q[tj].order;
      q[si].items.forEach(function(i){s.annots[i].anim.order=ob;});
      q[tj].items.forEach(function(i){s.annots[i].anim.order=oa;});
      renumber(s);commit(s);
    }
    function render(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      menu.innerHTML='';
      var h1=document.createElement('div');h1.className='anim-h';
      h1.textContent='How it appears';menu.appendChild(h1);
      if(!a||typeof selAnnot!=='number'){
        var em=document.createElement('div');em.className='anim-empty';
        em.textContent='Select an item first, then pick an effect.';
        menu.appendChild(em);
      } else {
        var eff=document.createElement('div');eff.className='anim-eff';
        [['none','None'],['appear','Appear'],['fade','Fade'],
         ['rise','Rise'],['zoom','Zoom']].forEach(function(p){
          var b=document.createElement('button');b.className='anim-effb';
          b.textContent=p[1];
          if((a.anim?a.anim.type:'none')===p[0]) b.classList.add('on');
          b.addEventListener('click',function(e){e.stopPropagation();
            setType(p[0]);});
          eff.appendChild(b);});
        menu.appendChild(eff);
        if(a.anim){
          var si0=stepOf(s,selAnnot),q0=animSeq(s);
          var mrow=document.createElement('div');mrow.className='anim-merge';
          var mb=document.createElement('button');mb.className='anim-mini wide';
          mb.textContent='↑ Appear with previous';mb.disabled=(si0<=0);
          mb.title='Reveal this on the same click as the build above';
          mb.addEventListener('click',function(e){e.stopPropagation();
            mergeUp();});
          mrow.appendChild(mb);
          if(q0[si0]&&q0[si0].items.length>1){
            var sb=document.createElement('button');sb.className='anim-mini wide';
            sb.textContent='↓ Own click';
            sb.addEventListener('click',function(e){e.stopPropagation();
              splitOwn();});
            mrow.appendChild(sb);
          }
          menu.appendChild(mrow);
        }
      }
      var h2=document.createElement('div');h2.className='anim-h';
      h2.textContent='Build order — each row is one click';
      menu.appendChild(h2);
      var seq=animSeq(s);
      if(!seq.length){
        var e2=document.createElement('div');e2.className='anim-empty';
        e2.textContent='Nothing animated on this slide yet.';
        menu.appendChild(e2);
      } else {
        var list=document.createElement('div');list.className='anim-seq';
        seq.forEach(function(st,si){
          var row=document.createElement('div');row.className='anim-step';
          var n=document.createElement('span');n.className='anim-num';
          n.textContent=(si+1);row.appendChild(n);
          var chips=document.createElement('span');chips.className='anim-chips';
          st.items.forEach(function(idx){
            var c=document.createElement('span');
            c.className='anim-chip'+(idx===selAnnot?' cur':'');
            c.textContent=itemLabel(s,idx)+' · '
              +((s.annots[idx].anim.type)||'fade');
            c.addEventListener('click',function(e){e.stopPropagation();
              var l=stage.querySelector('.annot-layer');
              if(l) selectAnnot(l,idx); render();});
            chips.appendChild(c);});
          row.appendChild(chips);
          var ctr=document.createElement('span');ctr.className='anim-stepctr';
          [['↑',-1],['↓',1]].forEach(function(m){
            var b=document.createElement('button');b.className='anim-mini';
            b.textContent=m[0];
            b.disabled=(m[1]<0?si===0:si===seq.length-1);
            b.addEventListener('click',function(e){e.stopPropagation();
              moveStep(si,m[1]);});
            ctr.appendChild(b);});
          row.appendChild(ctr);
          list.appendChild(row);});
        menu.appendChild(list);
      }
    }
    btn.addEventListener('click',function(e){e.stopPropagation();
      var willOpen=menu.hidden;menu.hidden=!willOpen;
      btn.setAttribute('aria-expanded',willOpen.toString());
      if(willOpen){render();floatMenu(btn,menu);}});
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}});
  })();
  window.addEventListener('resize',function(){
    if(deckEl.hidden) return;
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(s&&l) renderAnnots(l,s);
  });
  function buildsForSlide(i){
    var s=pres.slides[i];return s?slideBuildSteps(s).count:0;
  }
  function go(n){
    var prev=cur;
    cur=Math.max(0,Math.min(pres.slides.length-1,n));
    if(cur===prev) return;   /* clamped no-op: keep build + selection state */
    /* stepping back into a slide shows it fully built; forward starts fresh */
    revealCount=(mode==='view'&&cur<prev)?buildsForSlide(cur):0;
    selAnnot=null;selSet=[];   /* never carry a selection across slides */
    refresh();
    if(window.SemApp&&window.SemApp.updateHash) window.SemApp.updateHash();
  }
  /* advance: reveal the next build, else move to the next slide (no-op at the
     very end, so the final slide never collapses back to its pre-build state) */
  function advance(){
    var s=pres.slides[cur];
    if(mode==='view'&&s&&revealCount<slideBuildSteps(s).count){
      revealCount++;renderSlide();
    } else if(cur<pres.slides.length-1) go(cur+1);
  }
  function backStep(){
    if(mode==='view'&&revealCount>0){revealCount--;renderSlide();}
    else go(cur-1);
  }

  /* ---------- create mode: sidebar UI ---------- */
  /* ---------- presentations rail (vertical, left edge) ----------
     One item is active at any time: the "Notebooks" button (builder
     closed) or a presentation (builder open editing it). */
  var presstrip=document.getElementById('presstrip');
  var FOLDKEY='sempresfold:'+SCOPE;
  var FOLDERSKEY='sempresfolders:'+SCOPE;
  function foldState(){
    try{return JSON.parse(lsGet(FOLDKEY)||'{}');}catch(e){return {};}
  }
  function toggleFold(f){
    var s=foldState();
    if(s[f]) delete s[f]; else s[f]=1;
    lsSet(FOLDKEY,JSON.stringify(s));
    renderPresTabs();
  }
  /* folders exist on their own (created empty, dragged into) */
  function explicitFolders(){
    try{
      var l=JSON.parse(lsGet(FOLDERSKEY)||'[]');
      return Array.isArray(l)?l:[];
    }catch(e){return [];}
  }
  function saveFolders(list){lsSet(FOLDERSKEY,JSON.stringify(list));}
  /* move ANY presentation (current, saved, draft, embedded) */
  function setPresFolder(nm,folder){
    var f=(folder||'').trim();
    function apply(p){
      if(f) p.folder=f; else delete p.folder;
    }
    if(nm===pres.name){apply(pres);markDirty();renderPresRow();return;}
    var hit=false;
    projectPres.forEach(function(p){
      if(p.name===nm){apply(p);hit=true;}});
    nbPres.forEach(function(p){
      if(p.name===nm){apply(p);hit=true;}});
    var raw=lsGet(PFX+nm);
    if(raw){
      try{
        var d=JSON.parse(raw);apply(d);
        lsSet(PFX+nm,JSON.stringify(d));hit=true;
      }catch(e){}
    }
    if(hit&&APP.mode==='app') scheduleAutosave();
    renderPresTabs();
  }
  function newFolder(){
    var list=explicitFolders();
    var n=1,name='folder';
    function taken(x){
      return list.indexOf(x)>=0
        ||allSaved().some(function(p){return p.folder===x;});
    }
    while(taken(name)){n++;name='folder-'+n;}
    list.push(name);saveFolders(list);
    renderPresTabs();
    var h=presstrip.querySelector(
      '.pr-folder[data-folder="'+name+'"]');
    if(h) startFolderRename(h,name);
  }
  function renameFolder(oldName,newName){
    newName=(newName||'').trim();
    if(!newName||newName===oldName) return;
    var list=explicitFolders().map(function(x){
      return x===oldName?newName:x;});
    if(list.indexOf(newName)<0) list.push(newName);
    saveFolders(list.filter(function(x,i){
      return list.indexOf(x)===i;}));
    var st=foldState();
    if(st[oldName]){delete st[oldName];st[newName]=1;
      lsSet(FOLDKEY,JSON.stringify(st));}
    allSaved().concat([pres]).forEach(function(p){
      if(p.folder===oldName) setPresFolder(p.name,newName);
    });
    draftNames().forEach(function(nm){
      var d=loadDraft(nm);
      if(d&&d.folder===oldName) setPresFolder(nm,newName);
    });
    renderPresTabs();
  }
  function deleteFolder(f){
    saveFolders(explicitFolders().filter(function(x){return x!==f;}));
    allSaved().concat([pres]).forEach(function(p){
      if(p.folder===f) setPresFolder(p.name,'');
    });
    draftNames().forEach(function(nm){
      var d=loadDraft(nm);
      if(d&&d.folder===f) setPresFolder(nm,'');
    });
    renderPresTabs();
  }
  function startFolderRename(header,f){
    var t=header.querySelector('.pr-t');
    if(!t) return;
    var inp=document.createElement('input');
    inp.className='pr-frename';
    inp.value=f;inp.spellcheck=false;
    t.replaceWith(inp);
    inp.focus();inp.select();
    function commit(){
      var v=inp.value.trim();
      if(v&&v!==f) renameFolder(f,v);
      else renderPresTabs();
    }
    inp.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Enter') this.blur();
      if(e.key==='Escape'){this.value=f;this.blur();}
    });
    inp.addEventListener('blur',commit);
    inp.addEventListener('click',function(e){e.stopPropagation();});
  }
  function renderPresTabs(){
    if(!presstrip) return;
    presstrip.innerHTML='';
    var savedList=allSaved();
    var savedNames=savedList.map(function(p){return p.name;});
    var byName={};
    savedList.forEach(function(p){byName[p.name]=p;});
    var names=savedNames.slice();
    /* drafts stay listed even while another presentation is open */
    draftNames().forEach(function(n){
      if(names.indexOf(n)<0){
        names.push(n);
        byName[n]=loadDraft(n)||{name:n};
      }
    });
    if(names.indexOf(pres.name)<0) names.unshift(pres.name);
    byName[pres.name]=pres;   /* in-memory version wins (live folder) */
    var editing=!deckEl.hidden;

    function presItem(nm,folder){
      var isCur=nm===pres.name;
      var t=document.createElement('button');
      /* radio model: a row lights up ONLY while its deck is open — back on
         the notebook view, no presentation stays highlighted */
      t.className='pr-item ptab'+(isCur&&editing?' current editing':'')
        +(savedNames.indexOf(nm)<0?' draftonly':'');
      t.setAttribute('role','tab');
      t.dataset.pres=nm;
      t.dataset.folder=folder||'';
      var isPoster=/^a\d/.test(String((byName[nm]&&byName[nm].page)||''));
      var isView=isViewPres(byName[nm]);
      /* a custom view lights up while ITS styling bar is open, not while
         the slide stage is (it never opens the slide stage) */
      var vwOpen=isView&&isCur
        &&document.body.classList.contains('styling');
      if(vwOpen) t.className+=' current editing';
      var kindWord=isView?'custom view':isPoster?'poster':'presentation';
      t.title=((isCur&&(editing||vwOpen))
        ?('Editing "'+nm+'" — click Notebooks (top left) to go back')
        :('Open '+kindWord+' "'+nm+'"'
          +(isView?' — restyles the notebook itself':' in the builder')))
        +'\nDrag onto a folder to file it';
      /* the same drawn icons as the "+ New ..." buttons, so a row and the
         button that made it read as the same kind of thing */
      t.innerHTML='<span class="pr-ico">'
        +'<svg class="bic" viewBox="0 0 16 16" aria-hidden="true">'
        +(isView?RAIL_ICO.view:isPoster?RAIL_ICO.poster:RAIL_ICO.deck)
        +'</svg></span>';
      var lbl=document.createElement('span');lbl.className='pr-t';
      lbl.textContent=nm||'(unnamed)';
      t.appendChild(lbl);
      t.draggable=true;
      t.addEventListener('dragstart',function(e){
        draggingPres=nm;
        t.classList.add('dragging');
        try{e.dataTransfer.setData('text/plain',nm);}catch(err){}
        e.dataTransfer.effectAllowed='move';
      });
      t.addEventListener('dragend',function(){
        draggingPres=null;
        t.classList.remove('dragging');
        clearDropMarks();
      });
      t.addEventListener('click',function(){
        if(isCur&&!deckEl.hidden) return;
        if(vwOpen) return;            /* already the open custom view */
        choosePresentation(nm);
      });
      return t;
    }

    /* group by folder; loose items first, then collapsible folders
       (explicitly created folders show even while empty) */
    var rootNames=[],folders={},folderOrder=[];
    explicitFolders().forEach(function(f){
      folders[f]=[];folderOrder.push(f);
    });
    names.forEach(function(nm){
      var f=(byName[nm]&&byName[nm].folder)||'';
      if(!f){rootNames.push(nm);return;}
      if(!folders[f]){folders[f]=[];folderOrder.push(f);}
      folders[f].push(nm);
    });
    rootNames.forEach(function(nm){
      presstrip.appendChild(presItem(nm,''));});
    folderOrder.sort().forEach(function(f){
      var collapsed=!!foldState()[f]
        &&!(editing&&folders[f].indexOf(pres.name)>=0);
      var h=document.createElement('div');
      h.className='pr-folder';
      h.dataset.folder=f;
      h.title='Folder "'+f+'" — click to '
        +(collapsed?'expand':'collapse')
        +'; drag presentations onto it';
      h.innerHTML='<span class="pr-fchev">'
        +(collapsed?'&#9656;':'&#9662;')+'</span>'
        +'<span class="pr-fico"><svg viewBox="0 0 16 14" width="13" '
        +'height="12" fill="currentColor"><path d="M1 3.2C1 2.5 1.5 2 '
        +'2.2 2h3.4l1.5 1.6h6.7c.7 0 1.2.5 1.2 1.2v6c0 .7-.5 1.2-1.2 '
        +'1.2H2.2C1.5 12 1 11.5 1 10.8z"/></svg></span>';
      var ft=document.createElement('span');ft.className='pr-t';
      ft.textContent=f;h.appendChild(ft);
      var fc=document.createElement('span');fc.className='pr-fcount';
      fc.textContent=folders[f].length;h.appendChild(fc);
      var ctr=document.createElement('span');ctr.className='pr-fctrl';
      [['✎','Rename folder',function(){startFolderRename(h,f);}],
       ['✕','Delete folder (contents move out)',
        function(){deleteFolder(f);}]].forEach(function(b){
        var btn=document.createElement('button');
        btn.textContent=b[0];btn.title=b[1];
        btn.addEventListener('click',function(e){
          e.stopPropagation();b[2]();});
        ctr.appendChild(btn);
      });
      h.appendChild(ctr);
      h.addEventListener('click',function(){toggleFold(f);});
      presstrip.appendChild(h);
      if(!collapsed) folders[f].forEach(function(nm){
        var it=presItem(nm,f);
        it.classList.add('infolder');
        presstrip.appendChild(it);
      });
    });
    var docsBtn=document.getElementById('pr-docs');
    if(docsBtn) docsBtn.classList.toggle('current',!editing);
  }
  /* drag & drop filing: onto a folder header (or an item inside one)
     files it; onto empty rail space moves it back to the top level */
  var draggingPres=null;
  function clearDropMarks(){
    $$('.pr-folder.dropping',presstrip).forEach(function(el){
      el.classList.remove('dropping');});
    var rail=document.getElementById('presrail');
    if(rail) rail.classList.remove('dropping-root');
  }
  (function(){
    var rail=document.getElementById('presrail');
    if(!rail) return;
    rail.addEventListener('dragover',function(e){
      if(!draggingPres) return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      clearDropMarks();
      var h=e.target.closest&&e.target.closest('.pr-folder');
      if(!h){
        var it=e.target.closest&&e.target.closest('.pr-item.ptab');
        if(it&&it.dataset.folder)
          h=presstrip.querySelector(
            '.pr-folder[data-folder="'+it.dataset.folder+'"]');
      }
      if(h) h.classList.add('dropping');
      else rail.classList.add('dropping-root');
    });
    rail.addEventListener('dragleave',function(e){
      if(e.target===rail) clearDropMarks();
    });
    rail.addEventListener('drop',function(e){
      if(!draggingPres) return;
      e.preventDefault();
      var f='';
      var h=e.target.closest&&e.target.closest('.pr-folder');
      if(h) f=h.dataset.folder;
      else{
        var it=e.target.closest&&e.target.closest('.pr-item.ptab');
        if(it) f=it.dataset.folder||'';
      }
      var nm=draggingPres;
      draggingPres=null;
      clearDropMarks();
      setPresFolder(nm,f);
    });
  })();
  var newFoldBtn=document.getElementById('pr-newfold');
  if(newFoldBtn) newFoldBtn.addEventListener('click',newFolder);
  function choosePresentation(nm){
    var A=window.SemApp||{};
    if(nm!==pres.name){
      if(A.exitStyling) A.exitStyling();   /* leave any open custom view */
      lsSet(PFX+'last',nm);
      loadPresentation(nm);
      cur=0;activePane=-1;
    }
    /* a custom view is edited in the document; a deck on the slide stage */
    if(isViewPres(pres)){openCustomView();return;}
    openDeck('edit');   /* land straight in the slide editor */
  }
  function newPresentation(){
    var n2=1,name='presentation';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='presentation-'+n2;}
    /* deliberately NOT persisted yet: a new presentation only starts
       saving (draft + autosave) once you actually edit it, so clicking
       "New" never litters the project with empty decks */
    pres={name:name,slides:[emptySlide()]};
    source='auto';
    cur=0;activePane=0;
    openDeck('edit');   /* land straight in the slide editor */
  }
  /* ---- CUSTOM VIEW: a third kind of saved thing (2026-07-29) ---------
     Not slides. A custom view remembers how the NOTEBOOK looks: the
     styling of its markdown cells and headings, plus the whole filter /
     hidden-cell / figure-size state. It opens in the document, not on the
     slide stage, so the styling bar edits what you are looking at. ---- */
  function isViewPres(p){return !!(p&&p.kind==='view');}
  /* rail row icons — the same artwork the "+ New ..." buttons carry */
  var RAIL_ICO={
    deck:'<rect x="1.6" y="3.2" width="9.6" height="7.2" rx="1"/>'
      +'<path d="M3.6 12.8h5.6"/>',
    poster:'<rect x="2.4" y="1.8" width="7.6" height="12.4" rx="1"/>'
      +'<path d="M4.2 5h4M4.2 7.4h4M4.2 9.8h2.4"/>',
    view:'<path d="M2.4 2.6h5.8l2.6 2.6v8.2H2.4Z"/>'
      +'<path d="M4.6 8.4h4M4.6 10.8h2.6"/>'
      +'<path d="M13.9 2.4 15.4 3.9 12 7.3h-1.5V5.8Z"/>'};
  function newCustomView(){
    var A=window.SemApp||{};
    var stem=A.active;
    if(!stem||!A.enterStyling){
      toast('Open a notebook first — a custom view restyles a notebook');
      return;
    }
    var n2=1,name='custom view';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='custom view '+n2;}
    /* seeded from what you are looking at right now, so a new view never
       throws away the filters you already set up */
    pres={name:name,kind:'view',nb:stem,style:{},
          view:(A.layoutSnapshot&&A.layoutSnapshot(stem))||{}};
    source='auto';
    cur=0;activePane=-1;
    openCustomView();
  }
  function openCustomView(){
    var A=window.SemApp||{};
    closeDeck();                     /* the document, not the slide stage */
    if(pres.nb&&A.shells&&A.shells[pres.nb]&&A.activate)
      A.activate(pres.nb);
    if(pres.view&&A.applySnapshot)
      A.applySnapshot(pres.nb||A.active,pres.view);
    A.enterStyling(pres,function(){markDirty();});
    renderPresTabs();
    status();
  }
  function closeCustomView(){
    var A=window.SemApp||{};
    if(A.exitStyling) A.exitStyling();
    renderPresTabs();
  }
  window.SemApp.viewClose=closeCustomView;
  function newPoster(){
    var n2=1,name='poster';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='poster-'+n2;}
    /* like a new presentation, nothing persists until the first edit */
    var s=emptySlide();
    pres={name:name,slides:[s],page:'a0p'};
    applyLayout(s,LAYOUTBYID['poster-3col']||LAYOUTS[0]);
    source='auto';
    cur=0;activePane=-1;
    openDeck('edit');
  }

  function renderPresRow(){
    var lbl=$('#pres-current');
    if(lbl) lbl.textContent=pres.name||'(unnamed)';
    var inp=$('#pres-name');
    if(document.activeElement!==inp&&inp.value!==pres.name)
      inp.value=pres.name;
    renderPresTabs();
  }
  function renderControls(){
    updateNumsLabel();
    var s=pres.slides[cur];
    $$('#layout-row .lay,#layout-menu-grid .lay').forEach(function(b){
      /* highlight the template last applied to this slide (if any) */
      b.setAttribute('aria-pressed',
        (!!s&&s.lay===b.dataset.lay).toString());
      b.disabled=!s;
    });
    var te=$('#title-editor'), eb=$('#dc-edit');
    var isTitle=!!s&&s.layout==='title';
    if(te){
      te.hidden=!isTitle;
      if(isTitle){
        var ti=$('#ts-title'),su=$('#ts-sub');
        if(ti&&document.activeElement!==ti) ti.value=s.title||'';
        if(su&&document.activeElement!==su) su.value=s.sub||'';
      }
    }
    if(eb){
      eb.disabled=!s;
      eb.innerHTML=(mode==='edit')
        ?'&#9636; Swap to notebooks':'&#9998; Swap to edit view';
    }
  }
  /* the current slide's interactive frame editor — embedded inline as
     the big view in the merged slides list (one view, not two) */
  function buildSlideEditor(s){
    var ed=document.createElement('div');
    ed.className='pane-editor freeform';ed.id='pane-editor';
    if(!s){
      ed.innerHTML='<div class="pane empty">'
        +'<span class="pane-t">no slide</span></div>';
      return ed;
    }
    var cells=slideCells(s);
    if(!cells.length){
      ed.innerHTML='<div class="pane empty"><span class="pane-t">'
        +'pick a layout above, or click a card in the document'
        +'</span></div>';
      return ed;
    }
    cells.forEach(function(pair){
      var a=pair.a, ai=pair.i;
      var it=a.ref?resolveRef(a.ref):null;
      var p=document.createElement('div');
      p.className='pane slot'+(it?' filled':' empty')
        +(ai===activePane?' active':'');
      p.style.left=a.x+'%';p.style.top=a.y+'%';
      p.style.width=(a.w||10)+'%';p.style.height=(a.h||10)+'%';
      if(it){
        /* render the frame EXACTLY as it appears on the slide: the real
           card content for the chosen part (code / figure / output) */
        var frame=document.createElement('div');frame.className='an-cell';
        var ch=document.createElement('div');ch.className='an-cellhead';
        var chT=document.createElement('span');
        chT.className='an-cellhead-t';chT.textContent=it.title;
        ch.appendChild(chT);
        var pt0=partOf(a),facs0=facetList(it.ns);
        if(facs0.length>1||pt0==='code'){
          var pl=document.createElement('span');
          pl.className='an-cellpart';pl.textContent=pt0;
          ch.appendChild(pl);
        }
        if(multiNb()) ch.appendChild(nbChip('spane-nb',it.nb));
        frame.appendChild(ch);
        var b=framePart(it.ns,a.part);
        if(b){if(a.ts) b.style.zoom=a.ts;applyCrop(b,a);frame.appendChild(b);}
        applyCellColor(frame,a);
        p.title=it.nb+' — '+it.title;
        p.appendChild(frame);
        var pc=buildPartChooser(s,ai);
        if(pc) p.appendChild(pc);
      } else {
        var t=document.createElement('span');t.className='pane-t';
        t.textContent=a.ref?('missing: '+a.ref)
          :(ai===activePane?'▸ now click a card in the notebook'
            :'empty — click to select this frame');
        p.appendChild(t);
      }
      if(a.ref){
        var x=document.createElement('button');x.className='pane-x';
        x.textContent='✕';x.title='Clear this frame';
        x.addEventListener('click',function(e){e.stopPropagation();
          a.ref=null;activePane=ai;markDirty();refresh();});
        p.appendChild(x);
      }
      p.addEventListener('click',function(e){
        e.stopPropagation();activePane=ai;refresh();});
      ed.appendChild(p);
    });
    return ed;
  }
  function paneImgSrc(ref){
    var card=ref?cardEl(ref):null;
    var img=card?$('.figframe img',card):null;
    return img?img.getAttribute('src'):null;
  }
  function paneThumb(ref){
    var w=document.createElement('span');w.className='mini-pane';
    var it=ref?resolveRef(ref):null;
    if(!it){w.className+=' empty';return w;}
    var src=paneImgSrc(ref);
    if(src){
      var m=document.createElement('img');
      m.src=src;m.alt='';m.loading='lazy';
      w.appendChild(m);
    } else if(it.kind==='note'){
      w.className+=' is-note';
    } else if(it.kind==='figure'||it.kind==='diagnostic'){
      w.className+=' is-fig';
    } else {
      w.className+=' is-code';
      w.textContent='</>';
    }
    return w;
  }
  function miniDiagram(s){
    var d=document.createElement('span');
    d.className='mini-diagram free';
    if(s.layout==='title'){
      var w=document.createElement('span');
      w.className='mini-pane is-title';
      d.appendChild(w);
      return d;
    }
    var cells=slideCells(s);
    if(!cells.length){
      var e=document.createElement('span');
      e.className='mini-pane empty';
      d.appendChild(e);
      return d;
    }
    cells.forEach(function(pair){
      var a=pair.a;
      var w2=paneThumb(a.ref);
      w2.style.position='absolute';
      w2.style.left=a.x+'%';w2.style.top=a.y+'%';
      w2.style.width=(a.w||10)+'%';w2.style.height=(a.h||10)+'%';
      d.appendChild(w2);
    });
    return d;
  }
  function slideTitle(s){
    if(s.layout==='title') return s.title||'title slide';
    var cells=slideCells(s);
    for(var i=0;i<cells.length;i++){
      var it=cells[i].a.ref&&resolveRef(cells[i].a.ref);
      if(it) return it.title;
    }
    var tx=(s.annots||[]).filter(function(a){
      return a.k==='text'&&a.text;})[0];
    return tx?tx.text:'empty slide';
  }
  var draggingSlide=-1;
  function renderFilm(){
    var list=$('#film-list');list.innerHTML='';
    pres.slides.forEach(function(s,i){
      var row=document.createElement('div');
      row.className='film-row'+(i===cur?' current':'');
      row.dataset.idx=i;
      row.draggable=true;
      row.title='Drag to reorder';
      row.addEventListener('dragstart',function(e){
        draggingSlide=i;
        row.classList.add('dragging');
        try{e.dataTransfer.setData('text/plain','slide-'+i);}
        catch(err){}
        e.dataTransfer.effectAllowed='move';
      });
      row.addEventListener('dragend',function(){
        draggingSlide=-1;
        row.classList.remove('dragging');
        clearFilmMarks();
      });
      var lbl=document.createElement('div');lbl.className='film-label';
      var num=document.createElement('span');num.className='film-n';
      num.textContent=(i+1);lbl.appendChild(num);
      if(i===cur&&mode==='create'&&s.layout!=='title'){
        /* notebook view: the current slide IS the big inline pane editor
           (paired with your visible notebook cells to fill it). In slide
           view the CANVAS is the single editor, so the strip stays thumbnails */
        var view=document.createElement('div');view.className='film-view';
        view.appendChild(buildSlideEditor(s));
        lbl.appendChild(view);
      } else {
        lbl.appendChild(miniDiagram(s));
      }
      var tt=document.createElement('span');tt.className='film-t';
      tt.textContent=slideTitle(s);lbl.appendChild(tt);
      if(i!==cur) lbl.addEventListener('click',function(){
        cur=i;activePane=-1;selAnnot=null;selSet=[];refresh();});
      row.appendChild(lbl);
      var ctr=document.createElement('span');ctr.className='film-ctr';
      [['↑',function(){moveSlide(i,-1);},'Move slide up'],
       ['↓',function(){moveSlide(i,1);},'Move slide down'],
       ['✕',function(){delSlide(i);},'Delete slide']]
        .forEach(function(p){
        var b=document.createElement('button');b.className='film-mini';
        b.textContent=p[0];
        b.title=p[2];
        b.addEventListener('click',function(ev){
          ev.stopPropagation();p[1]();});
        ctr.appendChild(b);
      });
      row.appendChild(ctr);
      list.appendChild(row);
    });
  }
  function clearFilmMarks(){
    $$('#film-list .film-row.drop-above,#film-list .film-row.drop-below')
      .forEach(function(r){
        r.classList.remove('drop-above');
        r.classList.remove('drop-below');
      });
  }
  (function(){
    var list=$('#film-list'); if(!list) return;
    list.addEventListener('dragover',function(e){
      if(draggingSlide<0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row');
      if(!row) return;
      var r=row.getBoundingClientRect();
      row.classList.add(
        e.clientY>r.top+r.height/2?'drop-below':'drop-above');
    });
    list.addEventListener('dragleave',function(e){
      if(e.target===list) clearFilmMarks();
    });
    list.addEventListener('drop',function(e){
      if(draggingSlide<0) return;
      e.preventDefault();
      var from=draggingSlide;
      draggingSlide=-1;
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row');
      if(!row) return;
      var to=+row.dataset.idx;
      var r=row.getBoundingClientRect();
      if(e.clientY>r.top+r.height/2) to++;
      if(to>from) to--;
      if(to===from) return;
      var moved=pres.slides.splice(from,1)[0];
      pres.slides.splice(to,0,moved);
      if(cur===from) cur=to;
      else if(from<cur&&to>=cur) cur--;
      else if(from>cur&&to<=cur) cur++;
      markDirty();refresh();
    });
  })();
  function presNbs(p){
    var set={},order=[];
    (p&&p.slides||[]).forEach(function(s){
      (s.annots||[]).forEach(function(a){
        if(a.k==='cell'&&a.ref){
          var stem=splitRef(a.ref)[0];
          if(stem&&!set[stem]){set[stem]=1;order.push(stem);}
        }
      });
    });
    return order;
  }
  function renderPresNbs(){
    var nbs=presNbs(pres);
    var btn=$('#dc-nbs-btn');
    if(btn){
      /* only meaningful when the deck pulls from named notebooks (namespaced
         refs) — a static single-file export has none */
      btn.hidden=!nbs.length;
      /* "Open notebooks" until at least one of the deck's notebooks is open,
         then "Refresh notebooks" (reload the latest cells from disk / URL) */
      var anyOpen=nbs.some(function(stem){
        return APP.order.indexOf(stem)>=0;});
      btn.textContent=(anyOpen?'📚 Refresh notebooks'
        :'📚 Open notebooks');
    }
  }
  /* ---- "notebooks in this presentation" popover: open all / refresh all ----
     stem -> path resolves from an open shell, else a recent path with the
     same filename (paths only exist in the app + web builds) */
  function pathStem(p){
    var s=String(p||''),parts=s.split(/[\/\\]/),nm=parts[parts.length-1]||s;
    nm=nm.split('?')[0].split('#')[0];
    try{nm=decodeURIComponent(nm);}catch(e){}
    return nm.replace(/\.ipynb$/i,'');
  }
  function nbPathFor(stem){
    var sh=APP.shells&&APP.shells[stem];
    if(sh&&sh.path) return sh.path;
    var rec=(APP.project&&APP.project.recent)||[];
    for(var i=0;i<rec.length;i++)
      if(pathStem(rec[i])===stem) return rec[i];
    return null;
  }
  /* a path is actually openable only if APP.openPath can act on it: any path
     in the app (the server resolves it), but ONLY http(s) URLs in the web
     build (relative recent entries like the bundled demo can't be re-fetched
     by openPath) */
  function nbOpenable(path){
    if(!path) return false;
    return APP.mode==='web'?/^https?:\/\//i.test(path):true;
  }
  function nbInfo(){
    return presNbs(pres).map(function(stem){
      var open=APP.order.indexOf(stem)>=0;
      var path=open?((APP.shells[stem]&&APP.shells[stem].path)||'')
        :nbPathFor(stem);
      return {stem:stem,open:open,path:path,openable:nbOpenable(path)};
    });
  }
  function nbsCanOpen(){return APP.mode==='app'||APP.mode==='web';}
  function openPresNbs(missingOnly){
    if(!nbsCanOpen()){toast('Opening notebooks needs the Junoview app');return;}
    var info=nbInfo(),acted=0,cannot=0;
    info.forEach(function(n){
      if(missingOnly&&n.open) return;
      if(n.openable){APP.openPath(n.path);acted++;} else cannot++;
    });
    var verb=missingOnly?'Opening ':'Reloading ';
    if(!acted&&!cannot)
      toast(missingOnly?'All notebooks are already open':'Nothing to reload');
    else if(!acted)
      toast('Could not '+(missingOnly?'open':'reload')+' those notebooks');
    else if(cannot)
      toast(verb+acted+'; '+cannot+' unavailable');
    else
      toast(verb+acted+' notebook'+(acted===1?'':'s')+'…');
    hideNbsMenu();
  }
  function hideNbsMenu(){
    var m=$('#dc-nbs-menu'); if(m) m.hidden=true;
    var b=$('#dc-nbs-btn'); if(b) b.setAttribute('aria-expanded','false');
  }
  /* ---- Lock all / Unlock all / prefetch locked versions ---- */
  function allCellAnnots(){
    var out=[];
    (pres.slides||[]).forEach(function(s){
      (s.annots||[]).forEach(function(a){
        if(a.k==='cell'&&a.ref) out.push(a);});});
    return out;
  }
  function lockAllFrames(){
    if(APP.mode!=='app'){toast('Locking needs the Junoview app');return;}
    var ann=allCellAnnots().filter(function(a){return !a.lockver;});
    if(!ann.length){toast('Every figure is already locked');return;}
    var byStem={};
    ann.forEach(function(a){
      var pr=splitRef(normRef(a.ref)||String(a.ref||''));
      if(pr[0]) (byStem[pr[0]]=byStem[pr[0]]||[]).push(a);
    });
    var stems=Object.keys(byStem),done=0,locked=0,norepo=0;
    if(!stems.length){toast('Nothing to lock');return;}
    stems.forEach(function(st){
      var path=nbPathFor(st);
      function fin(){
        if(++done!==stems.length) return;
        markDirty();refresh();
        toast(locked
          ?('Locked '+locked+' figure'+(locked===1?'':'s')
            +(norepo?' — '+norepo+' not in git':''))
          :'Nothing lockable — are the notebooks committed to git?');
      }
      if(!path||/^https?:/i.test(path)){
        norepo+=byStem[st].length;fin();return;}
      APP.api('/api/gitstate',{path:path}).then(function(g){
        if(g&&g.repo&&g.commit){
          byStem[st].forEach(function(a){
            a.lockver={commit:g.commit.id,msg:g.commit.msg||'',
              date:g.commit.date||''};
            locked++;
          });
        } else norepo+=byStem[st].length;
        fin();
      }).catch(fin);
    });
  }
  function unlockAllFrames(){
    var ann=allCellAnnots().filter(function(a){return a.lockver;});
    if(!ann.length){toast('No locked figures');return;}
    if(!window.confirm('Unlock all '+ann.length+' figure'
      +(ann.length===1?'':'s')+'? They will follow notebook refreshes '
      +'again — locked versions stop showing.')) return;
    ann.forEach(function(a){delete a.lockver;});
    markDirty();refresh();
    toast('Unlocked '+ann.length+' figure'+(ann.length===1?'':'s'));
  }
  function loadLockedVersions(){
    var groups={};
    allCellAnnots().forEach(function(a){
      if(!(a.lockver&&a.lockver.commit)) return;
      var lp=lockParts(a); if(!lp) return;
      (groups[lp.pkey]=groups[lp.pkey]||{path:lp.path,
        commit:a.lockver.commit,anchors:[]});
      if(groups[lp.pkey].anchors.indexOf(lp.anchor)<0)
        groups[lp.pkey].anchors.push(lp.anchor);
    });
    var keys=Object.keys(groups);
    if(!keys.length){toast('No locked figures to load');return;}
    var total=0;
    keys.forEach(function(k){total+=groups[k].anchors.length;});
    toast('Loading '+total+' locked figure'+(total===1?'':'s')
      +' from '+keys.length+' version'+(keys.length===1?'':'s')+'…');
    keys.forEach(function(k){
      fetchVerCards(groups[k].path,groups[k].commit,
        groups[k].anchors);});
  }
  function renderNbsMenu(){
    var m=$('#dc-nbs-menu'); if(!m) return;
    m.innerHTML='';
    var info=nbInfo();
    if(!info.length){
      m.innerHTML='<div class="dc-nbs-empty">No notebooks yet &mdash; add cells '
        +'from your notebooks to a slide.</div>';return;}
    var h=document.createElement('div');h.className='dc-nbs-menuh';
    h.textContent='notebooks in this presentation';m.appendChild(h);
    info.forEach(function(n){
      /* openable-but-closed = "avail"; can't be opened here = "gone" */
      var cls=n.open?'open':(n.openable?'avail':'gone');
      var row=document.createElement('div');
      row.className='dc-nbrow '+cls;
      var dot=document.createElement('span');dot.className='dc-nbrow-dot';
      var nm=document.createElement('span');nm.className='dc-nbrow-nm';
      nm.textContent=n.stem;
      var st=document.createElement('span');st.className='dc-nbrow-st';
      st.textContent=n.open?'open':(n.openable?'closed':'not found');
      row.appendChild(dot);row.appendChild(nm);row.appendChild(st);
      if(n.openable&&!n.open){
        row.title=n.path;row.classList.add('clickable');
        row.addEventListener('click',function(){
          APP.openPath(n.path);hideNbsMenu();});
      } else if(n.path){row.title=n.path;}
      m.appendChild(row);
    });
    if(nbsCanOpen()){
      var acts=document.createElement('div');acts.className='dc-nbacts';
      var ob=document.createElement('button');ob.className='dbtn';
      ob.textContent='Open notebooks';
      ob.title='Open every notebook this presentation uses that is not '
        +'already open';
      ob.addEventListener('click',function(){openPresNbs(true);});
      var rb=document.createElement('button');rb.className='dbtn';
      rb.textContent='Refresh all';
      rb.title='Reload every notebook this presentation uses from disk / URL';
      rb.addEventListener('click',function(){openPresNbs(false);});
      acts.appendChild(ob);acts.appendChild(rb);m.appendChild(acts);
      if(APP.mode==='app'){
        var acts2=document.createElement('div');acts2.className='dc-nbacts';
        var la=document.createElement('button');la.className='dbtn';
        la.innerHTML='&#128274; Lock all figures';
        la.title='Pin every frame to its notebook’s current git commit — '
          +'refreshes stop changing them';
        la.addEventListener('click',function(){lockAllFrames();});
        var ua=document.createElement('button');ua.className='dbtn';
        ua.innerHTML='&#128275; Unlock all';
        ua.title='Every frame follows notebook refreshes again';
        ua.addEventListener('click',function(){unlockAllFrames();});
        var lv=document.createElement('button');lv.className='dbtn';
        lv.innerHTML='&#10227; Load locked versions';
        lv.title='Fetch every locked figure’s content from git — the '
          +'notebooks don’t need to be open';
        lv.addEventListener('click',function(){loadLockedVersions();});
        acts2.appendChild(la);acts2.appendChild(ua);
        acts2.appendChild(lv);
        m.appendChild(acts2);
      }
    } else {
      var note=document.createElement('div');note.className='dc-nbs-empty';
      note.textContent='Open / refresh is available in the Junoview app.';
      m.appendChild(note);
    }
  }
  function renderCreate(){
    renderPresRow();renderControls();renderPresNbs();renderFilm();
  }
  function moveSlide(i,d){
    var j=i+d; if(j<0||j>=pres.slides.length) return;
    var t=pres.slides[i];pres.slides[i]=pres.slides[j];pres.slides[j]=t;
    if(cur===i)cur=j; else if(cur===j)cur=i;
    markDirty();refresh();
  }
  function delSlide(i){
    pres.slides.splice(i,1);
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;
    markDirty();refresh();
  }

  /* ---------- mode switching ---------- */
  function setUIMode(m){
    mode=m;
    var creating=(m==='create'), editing=(m==='edit');
    deckEl.classList.toggle('creating',creating);
    deckEl.classList.toggle('editing',editing);
    /* the builder panel stays visible while editing a slide */
    $('#deck-create').hidden=!(creating||editing);
    var et=$('#edit-tools'); if(et) et.hidden=!editing;
    var dt=$('.deck-top',deckEl); if(dt) dt.hidden=editing;
    document.body.classList.toggle('creating-docs',
      (creating||editing)&&!deckEl.hidden);
    document.body.classList.toggle('slide-editing',
      editing&&!deckEl.hidden);
    document.body.classList.toggle('deck-open',
      !creating&&!deckEl.hidden);
    selAnnot=null;selSet=[];
    if(m==='view') revealCount=0;   /* start the build sequence fresh */
    if(!editing){                   /* Objects pane is an editing tool */
      var sp=$('#selpane'); if(sp) sp.hidden=true;
      var ob=$('#objects-btn');
      if(ob) ob.setAttribute('aria-pressed','false');
    }
    var db=$('#et-del'); if(db) db.disabled=true;
    var fb=$('#et-fmt'); if(fb) fb.hidden=true;
    if(editing) setTool('select');
    /* real full screen while presenting (browser chrome gone) */
    try{
      if(m==='view'&&!deckEl.hidden&&deckEl.requestFullscreen
         &&!document.fullscreenElement)
        deckEl.requestFullscreen().catch(function(){});
      else if(m!=='view'&&document.fullscreenElement)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    if(creating||editing){
      activePane=-1;
      renderCreate();
    }
    if(!creating) renderSlide();
  }
  function refresh(){
    if(mode==='create'){renderCreate();}
    else if(mode==='edit'){renderCreate();renderSlide();}
    else renderSlide();
  }
  function routeSync(){
    if(window.SemApp&&window.SemApp.updateHash) window.SemApp.updateHash();
  }
  function openDeck(m){
    deckEl.hidden=false;
    histReset();   /* undo history starts fresh per editing session */
    status();
    setUIMode(m||'view');
    routeSync();
  }
  function closeDeck(){
    try{
      if(document.fullscreenElement)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    closeVFull();
    deckEl.hidden=true;
    document.body.classList.remove('deck-open');
    document.body.classList.remove('creating-docs');
    document.body.classList.remove('slide-editing');
    deckEl.classList.remove('creating');
    deckEl.classList.remove('editing');
    renderPresTabs();
    routeSync();
  }
  /* ---- URL routing hooks used by the SemApp router (docs side) ---- */
  window.SemApp.deckState=function(){
    return deckEl.hidden?null:{name:pres.name,slide:cur};
  };
  window.SemApp.deckClose=function(){closeDeck();};
  window.SemApp.deckGo=function(slide){   /* move slide, keep the current mode */
    if(deckEl.hidden) return;
    go(Math.max(0,Math.min(((pres.slides||[]).length||1)-1,slide||0)));
  };
  window.SemApp.deckOpen=function(name,slide){
    if(!name) return false;
    if(pres.name!==name){
      if(!(savedByName(name)||loadDraft(name))) return false;
      lsSet(PFX+'last',name);
      loadPresentation(name);
      activePane=-1;
    }
    cur=0;
    if(typeof slide==='number'&&slide>0)
      cur=Math.max(0,Math.min(((pres.slides||[]).length||1)-1,slide));
    openDeck('edit');
    return true;
  };
  /* wrap so the click Event isn't forwarded (closeDeck takes no args) */
  $('#deck-docs').addEventListener('click',function(){closeDeck();});
  var prDocs=document.getElementById('pr-docs');
  if(prDocs) prDocs.addEventListener('click',function(){closeDeck();});
  var prNew=document.getElementById('pr-new');
  if(prNew) prNew.addEventListener('click',newPresentation);
  var prNewPost=document.getElementById('pr-newpost');
  if(prNewPost) prNewPost.addEventListener('click',newPoster);
  var prNewView=document.getElementById('pr-newview');
  if(prNewView) prNewView.addEventListener('click',newCustomView);
  var sbDone=document.getElementById('sb-done');
  if(sbDone) sbDone.addEventListener('click',closeCustomView);
  $('#pres-current').addEventListener('click',function(){
    var inp=$('#pres-name');
    this.hidden=true;
    inp.hidden=false;inp.value=pres.name;
    inp.focus();inp.select();
  });
  $('#dc-play').addEventListener('click',function(){setUIMode('view');});
  var undoBtn=$('#dc-undo');
  if(undoBtn) undoBtn.addEventListener('click',undo);
  var redoBtn=$('#dc-redo');
  if(redoBtn) redoBtn.addEventListener('click',redo);
  $('#deck-exit').addEventListener('click',function(){
    setUIMode('create');});
  $('#deck-prev').addEventListener('click',function(){backStep();});
  $('#deck-next').addEventListener('click',function(){advance();});
  /* click the letterbox AROUND the slide to clear the selection (clicks on
     the canvas itself are already handled by the annot-layer). Scoped to the
     stage element only, so it never fights a fresh text/arrow placement. */
  if(stage) stage.addEventListener('mousedown',function(ev){
    if(mode!=='edit'||tool!=='select'||ev.target!==stage) return;
    var l=stage.querySelector('.annot-layer');
    if(l) selectAnnot(l,null);
  });
  /* ONE mode toggle: swaps between the slide editor and the notebook view */
  var editBtn=$('#dc-edit');
  if(editBtn) editBtn.addEventListener('click',function(){
    if(mode==='edit') setUIMode('create');
    else if(pres.slides[cur]) setUIMode('edit');
  });
  var delBtn=$('#et-del');
  if(delBtn) delBtn.addEventListener('click',deleteSel);
  $$('#edit-tools .et').forEach(function(b){
    b.addEventListener('click',function(){setTool(b.dataset.tool);});
  });
  /* ---- "+ Shapes" dropdown: choose a shape, then draw it ---- */
  function shapeIcon(shp){
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','sh-ico');svg.setAttribute('viewBox','0 0 100 100');
    if(shp==='rect'){
      var rc=document.createElementNS(SVGNS,'rect');
      rc.setAttribute('x','12');rc.setAttribute('y','22');
      rc.setAttribute('width','76');rc.setAttribute('height','56');
      rc.setAttribute('rx','7');rc.setAttribute('fill','#c9d6e2');
      svg.appendChild(rc);
    } else if(shp==='ellipse'){
      var el=document.createElementNS(SVGNS,'ellipse');
      el.setAttribute('cx','50');el.setAttribute('cy','50');
      el.setAttribute('rx','42');el.setAttribute('ry','33');
      el.setAttribute('fill','#c9d6e2');svg.appendChild(el);
    } else if(SHAPE_GLYPH[shp]){
      var tx=document.createElementNS(SVGNS,'text');
      tx.setAttribute('x','50');tx.setAttribute('y','56');
      tx.setAttribute('text-anchor','middle');
      tx.setAttribute('dominant-baseline','central');
      tx.setAttribute('font-size','98');tx.setAttribute('font-weight','800');
      tx.setAttribute('fill','#c9d6e2');tx.textContent=SHAPE_GLYPH[shp];
      svg.appendChild(tx);
    } else {
      var p=document.createElementNS(SVGNS,'path');
      p.setAttribute('d',SHAPE_PATHS[shp]||'');
      p.setAttribute('fill','#c9d6e2');svg.appendChild(p);
    }
    return svg;
  }
  (function(){
    var shBtn=$('#sh-btn'),shMenu=$('#sh-menu'),shDrop=$('#sh-drop');
    if(!shBtn||!shMenu) return;
    SHAPE_LIST.forEach(function(pair){
      var opt=document.createElement('button');
      opt.className='sh-opt';opt.type='button';opt.title=pair[1];
      opt.dataset.shape=pair[0];
      opt.appendChild(shapeIcon(pair[0]));
      var t=document.createElement('span');t.className='sh-opt-t';
      t.textContent=pair[1];opt.appendChild(t);
      opt.addEventListener('click',function(e){
        e.stopPropagation();
        pendingShape=pair[0];
        shMenu.hidden=true;shBtn.setAttribute('aria-expanded','false');
        setTool('rect');
      });
      shMenu.appendChild(opt);
    });
    shBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=shMenu.hidden;
      shMenu.hidden=!willOpen;
      shBtn.setAttribute('aria-expanded',willOpen.toString());
    });
    document.addEventListener('click',function(e){
      if(!shMenu.hidden&&shDrop&&!shDrop.contains(e.target)){
        shMenu.hidden=true;shBtn.setAttribute('aria-expanded','false');}
    });
  })();
  var downBtn=$('#deck-down');
  if(downBtn) downBtn.addEventListener('click',scrollToTrace);
  var upBtn=$('#deck-up');
  if(upBtn) upBtn.addEventListener('click',scrollToSlide);
  var vfClose=$('#vfull-close');
  if(vfClose) vfClose.addEventListener('click',closeVFull);
  /* ---- "Plot trace" opens a new DOCS tab, subset to the cells that build
     this plot. The deck (which owns the lineage) hands the cell ids + a
     dependency graph to the docs side, which clones those cards into a tab —
     every document filter and button keeps working because the tab IS made
     of real document cards. ---- */
  window.SemTrace={
    open:function(stem,anchor){
      var it=traceItemFor(stem,anchor); if(!it) return;
      if(!(window.SemApp&&window.SemApp.openTraceTab)) return;
      var group=lineageForItem(it.ns);
      var ids={},list=[];
      if(group) group.steps.forEach(function(s){
        if(s.card&&!ids[s.card]){ids[s.card]=1;list.push(s.card);}});
      if(it.card&&!ids[it.card]) list.push(it.card);   /* the plot itself */
      var graph=group?plotGraph(group,function(step){
        if(window.SemApp.traceGoto) window.SemApp.traceGoto(step.card);
      }):null;
      window.SemApp.openTraceTab(
        it.nb,list,it.title||'Plot trace',graph,anchor);
    }
  };
  /* close any open code-trail filter menu on an outside click */
  document.addEventListener('click',function(e){
    $$('.vo-fmenu').forEach(function(m){
      if(!m.hidden&&m.parentNode&&!m.parentNode.contains(e.target))
        m.hidden=true;});
  });
  /* ---- "Notebooks" popover in the deck header ---- */
  var nbsBtn=$('#dc-nbs-btn'),nbsMenu=$('#dc-nbs-menu');
  if(nbsBtn) nbsBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!nbsMenu) return;
    if(nbsMenu.hidden){
      renderNbsMenu();nbsMenu.hidden=false;
      nbsBtn.setAttribute('aria-expanded','true');
    } else hideNbsMenu();
  });
  document.addEventListener('click',function(e){
    if(nbsMenu&&!nbsMenu.hidden&&!nbsMenu.contains(e.target)
       &&e.target!==nbsBtn) hideNbsMenu();
  });
  document.addEventListener('fullscreenchange',function(){
    /* Esc always exits browser fullscreen (the page cannot prevent
       it), so Esc while presenting leaves the presentation entirely —
       never a windowed half-presentation state. Inner layers (the code
       overlay, the trace) close via their own ✕ / scroll instead. */
    if(document.fullscreenElement) return;
    if(mode!=='view'||deckEl.hidden) return;
    closeVFull();
    setUIMode('create');
  });
  document.addEventListener('keydown',function(e){
    if(picking>=0){
      if(e.key==='Escape'){e.preventDefault();endPick();}
      return;
    }
    if(deckEl.hidden) return;
    /* while the document is being presented full screen over an open
       builder, its own Esc / Ctrl+Z own the keyboard — don't let the deck
       also close or undo underneath it */
    if(document.body.classList.contains('doc-presenting')) return;
    var tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea') return;
    if(e.target.isContentEditable) return;
    if(e.key==='Escape'){
      var vf=$('#vfull');
      if(vf&&!vf.hidden) closeVFull();
      else if(mode==='view'&&(stage.scrollTop||0)>50) scrollToSlide();
      else if(mode==='edit'
              &&(tool!=='select'||selAnnot!==null||selSet.length)){
        /* first Esc drops the tool / selection; the next one leaves the
           editor (there are no Select/Delete buttons — Esc and Del do it) */
        setTool('select');
        var l=stage.querySelector('.annot-layer');
        if(l) selectAnnot(l,null);
        else {selAnnot=null;selSet=[];showFmt();}
      }
      else if(mode==='view'||mode==='edit') setUIMode('create');
      else closeDeck();
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')
            &&mode!=='view'){
      e.preventDefault();
      if(e.shiftKey) redo(); else undo();
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')
            &&mode!=='view'){
      e.preventDefault();redo();
    }
    else if(mode==='edit'){
      if(e.key==='Delete'||e.key==='Backspace'){
        e.preventDefault();deleteSel();
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')){
        e.preventDefault();duplicateSel();
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='g'||e.key==='G')){
        e.preventDefault();
        if(e.shiftKey) ungroupSel(); else groupSel();
      }
      else if(e.key.indexOf('Arrow')===0
              &&(selSet.length||selAnnot!==null)){
        e.preventDefault();
        var st=e.shiftKey?2:0.4;
        nudgeSel(e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,
                 e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0);
      }
    }
    else if(mode==='view'){
      if(e.key==='ArrowRight'||e.key==='PageDown'
         ||(e.key===' '&&tag!=='button')){e.preventDefault();advance();}
      else if(e.key==='ArrowLeft'||e.key==='PageUp'){
        e.preventDefault();backStep();}
      else if(e.key==='ArrowDown'){
        e.preventDefault();
        if((stage.scrollTop||0)<60) scrollToTrace();
        else stage.scrollBy({top:stage.clientHeight*0.7,
          behavior:'smooth'});
      }
      else if(e.key==='ArrowUp'){
        e.preventDefault();
        if((stage.scrollTop||0)<=stage.clientHeight*0.8) scrollToSlide();
        else stage.scrollBy({top:-stage.clientHeight*0.7,
          behavior:'smooth'});
      }
    }
  });

  /* ---------- create mode: click a card in ANY open tab to place it */
  document.addEventListener('click',function(e){
    if(deckEl.hidden||mode!=='create') return;
    var t=e.target;
    if(!t||!t.closest) return;
    if(deckEl.contains(t)) return;
    if(t.closest('.apptop,.opendlg,.welcome')) return;
    var shellEl=t.closest('.nbshell');
    if(!shellEl) return;
    var card=t.closest('.card');
    if(!card) return;
    if(t.closest('.codetoggle,.depchip,a')) return;
    var s=pres.slides[cur];
    if(!s){pres.slides.push(emptySlide());cur=pres.slides.length-1;
      s=pres.slides[cur];}
    if(s.layout==='title'){
      e.preventDefault();e.stopPropagation();
      toast('This is a title slide — pick a layout to add card frames');
      return;
    }
    /* a Plot-trace tab's cards are clones — resolve to the real notebook */
    var ref=nsKey(shellEl.dataset.src||shellEl.dataset.nb,
      card.dataset.anchor);
    if(slideCells(s).some(function(c){return c.a.ref===ref;})){
      e.preventDefault();e.stopPropagation();
      toast('That card is already on this slide');
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},700);
      return;
    }
    /* placement: an ARMED frame wins; with none armed the card takes the
       first EMPTY frame in reading order. Poster templates ship full of
       placeholder frames, and demanding a selection before every single
       click made "Swap to notebooks" feel broken (2026-08-04) — in
       create mode clicking a card IS the intent to place it, so
       successive clicks fill successive slots. A slide with no frames
       at all still creates one. */
    var target=annotByIdx(s,activePane);
    if(!target||target.k!=='cell'||target.ref){
      if(slideCells(s).length===0){
        s.annots=s.annots||[];
        s.annots.push({k:'cell',x:8,y:8,w:84,h:84,ref:null});
        target=annotByIdx(s,s.annots.length-1);
      } else {
        var best=null;
        (s.annots||[]).forEach(function(a){
          if(a.k!=='cell'||a.ref) return;
          if(!best||a.y<best.y-0.5
             ||(Math.abs(a.y-best.y)<=0.5&&a.x<best.x)) best=a;
        });
        if(best) target=best;
        else {
          toast('Every frame is full — select a frame on the page '
            +'to replace');
          return;
        }
      }
    }
    e.preventDefault();e.stopPropagation();
    target.ref=ref;
    activePane=-1;   /* disarm: adding again needs a fresh frame selection */
    markDirty();refresh();
    card.classList.add('target-flash');
    setTimeout(function(){card.classList.remove('target-flash');},700);
  },true);

  /* ---------- create mode: slide + presentation operations ---------- */
  $('#film-add').addEventListener('click',function(){
    var at=pres.slides.length?cur+1:0;
    pres.slides.splice(at,0,emptySlide());
    cur=at;activePane=-1;
    markDirty();refresh();
  });
  renderLayoutPicker();
  /* title-slide text fields (panel); the slide canvas mirrors them */
  [['#ts-title','title'],['#ts-sub','sub']].forEach(function(p){
    var inp=$(p[0]); if(!inp) return;
    inp.addEventListener('input',function(){
      var s=pres.slides[cur];
      if(!s||s.layout!=='title') return;
      s[p[1]]=this.value;
      markDirty();renderFilm();
      if(mode==='edit') renderSlide();
    });
  });
  /* ---- File menu ---- */
  var fileBtn=$('#dc-file'), fileMenu=$('#dc-menu');
  function closeMenu(){
    if(fileMenu&&!fileMenu.hidden){
      fileMenu.hidden=true;
      fileBtn.setAttribute('aria-expanded','false');
    }
  }
  if(fileBtn){
    fileBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=!fileMenu.hidden;
      fileMenu.hidden=open;
      fileBtn.setAttribute('aria-expanded',(!open).toString());
    });
    document.addEventListener('click',function(e){
      if(!fileMenu.hidden&&!fileMenu.contains(e.target)) closeMenu();
    });
  }
  function menuAction(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(){closeMenu();fn();});
  }
  menuAction('#mi-new',newPresentation);
  menuAction('#mi-rename',function(){
    var lbl=$('#pres-current'), inp=$('#pres-name');
    if(lbl) lbl.hidden=true;
    inp.hidden=false;inp.value=pres.name;
    inp.focus();inp.select();
  });
  menuAction('#mi-auto-figs',function(){
    pres.slides=autoSlides(false);cur=0;activePane=0;
    markDirty();refresh();
    toast(pres.slides.length+' slides: one per figure, in order');
  });
  menuAction('#mi-auto-figdocs',function(){
    pres.slides=autoSlides(true);cur=0;activePane=0;
    markDirty();refresh();
    toast(pres.slides.length+' slides: figures + docs, in order');
  });
  function updateNumsLabel(){
    var b=$('#mi-nums');
    if(b) b.textContent='Slide numbers: '+(pres.showNums?'on':'off');
  }
  menuAction('#mi-nums',function(){
    if(pres.showNums){delete pres.showNums;} else {pres.showNums=1;}
    updateNumsLabel();markDirty();refresh();
    toast('Slide numbers '+(pres.showNums?'on':'off'));
  });
  $('#pres-name').addEventListener('input',function(){
    var old=pres.name;
    pres.name=this.value.trim();
    if(old&&old!==pres.name) lsDel(PFX+old);
    markDirty();
  });
  $('#pres-name').addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key==='Escape') this.blur();
    e.stopPropagation();
  });
  $('#pres-name').addEventListener('blur',function(){
    this.hidden=true;
    var lbl=$('#pres-current');
    if(lbl) lbl.hidden=false;
    renderPresRow();
  });

  /* ---------- persistence ---------- */
  var toastTimer;
  function toast(msg){
    var t=$('#deck-toast');t.textContent=msg;t.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){t.hidden=true;},3600);
  }
  function mergedPresentations(){
    var out=allSaved().filter(function(p){return p.name!==pres.name;})
      .map(function(p){var c=deep(p);delete c.origin;return c;});
    var cp=deep(pres);delete cp.origin;out.push(cp);
    return out;
  }
  /* strip "stem::" when only one notebook is open, so decks saved from a
     single tab stay compatible with sidecars and --embed-deck */
  function plainIfSingle(list){
    if(APP.order.length!==1) return list;
    var pfx=APP.order[0]+'::';
    function strip(a){
      return (a&&String(a).indexOf(pfx)===0)
        ?String(a).slice(pfx.length):a;
    }
    return list.map(function(p){
      var c=deep(p);
      c.slides=(c.slides||[]).map(function(s){
        s.panes=(s.panes||[]).map(strip);
        (s.annots||[]).forEach(function(a){
          if(a.k==='cell'&&a.ref) a.ref=strip(a.ref);
        });
        if(Array.isArray(s.hidden)) s.hidden=s.hidden.map(strip);
        return s;});
      return c;});
  }
  function requireName(){
    if(pres.name) return true;
    toast('Give the presentation a name first');
    var ni=$('#pres-name');ni.hidden=false;ni.focus();
    return false;
  }
  /* ---------- app mode: save to project + autosave ---------- */
  function saveToProject(silent){
    var merged=mergedPresentations();
    return APP.api('/api/save',{presentations:merged})
      .then(function(){
        projectPres=merged;
        lsDel(PFX+(pres.name||'untitled'));
        saveStamp=new Date();saveKind=silent?'auto':'manual';
        source='saved';status();renderPresRow();
        if(!silent)
          toast('Saved "'+pres.name+'" to junoview_project.json');
      }).catch(function(e){
        if(!silent)
          toast('Save failed: '+(e&&e.message?e.message:e));
      });
  }
  /* ---------- WHERE this presentation is saved -----------------------
     'project' (app mode: junoview_project.json), 'browser' (this browser,
     the default everywhere else) or 'file' (a .junoview file you pick).
     A picked file is REMEMBERED: the FileSystemFileHandle is stored in
     IndexedDB, so the next visit saves straight back to the same place
     without asking again (the browser only re-asks for permission). */
  var TGKEY='semopts:'+SCOPE+':savetarget';
  var HKEY='deck:'+SCOPE;
  var canPickFile=!!window.showSaveFilePicker;
  var saveTarget=lsGet(TGKEY)
    ||(APP.mode==='app'?'project':'browser');
  if(saveTarget==='project'&&APP.mode!=='app') saveTarget='browser';
  if(saveTarget==='file'&&!canPickFile) saveTarget='browser';
  var fileHandle=null,fileName='';
  function idb(){
    return new Promise(function(res,rej){
      var r,done=false;
      function fail(e){if(!done){done=true;rej(e);}}
      function okd(v){if(!done){done=true;res(v);}}
      /* a blocked or wedged open must never leave the caller hanging */
      setTimeout(function(){fail(new Error('indexeddb timeout'));},4000);
      try{r=indexedDB.open('junoview',1);}catch(e){fail(e);return;}
      r.onupgradeneeded=function(){
        try{r.result.createObjectStore('handles');}catch(e){}};
      r.onsuccess=function(){okd(r.result);};
      r.onerror=function(){fail(r.error);};
      r.onblocked=function(){fail(new Error('indexeddb blocked'));};
    });
  }
  function idbPut(k,v){
    return idb().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction('handles','readwrite');
        /* .put can throw synchronously (DataCloneError) */
        try{t.objectStore('handles').put(v,k);}catch(e){rej(e);return;}
        t.oncomplete=function(){res();};
        t.onerror=function(){rej(t.error);};
        t.onabort=function(){rej(t.error);};
      });
    });
  }
  function idbGet(k){
    return idb().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction('handles','readonly');
        var q=t.objectStore('handles').get(k);
        q.onsuccess=function(){res(q.result);};
        q.onerror=function(){rej(q.error);};
      });
    });
  }
  function permOK(h){
    if(!h||!h.queryPermission) return Promise.resolve(!!h);
    return h.queryPermission({mode:'readwrite'})
      .then(function(s){return s==='granted';}).catch(function(){
        return false;});
  }
  function permAsk(h){
    if(!h) return Promise.resolve(false);
    return permOK(h).then(function(ok){
      if(ok||!h.requestPermission) return ok;
      return h.requestPermission({mode:'readwrite'})
        .then(function(s){return s==='granted';})
        .catch(function(){return false;});
    });
  }
  function pickSaveFile(){
    if(!canPickFile) return Promise.resolve(null);
    return window.showSaveFilePicker({
      suggestedName:(pres.name||'presentation')+'.junoview',
      types:[{description:'Junoview presentation',
        accept:{'application/json':['.junoview','.json']}}]
    }).then(function(h){
      fileHandle=h;fileName=h.name||'';
      /* REMEMBERING the file is best-effort: it must never delay or block
         the save itself, so it runs in the background */
      idbPut(HKEY,h).catch(function(){});
      return h;
    });
  }
  function deckFileText(){
    return JSON.stringify({junoview:1,
      presentations:plainIfSingle(mergedPresentations())},null,2);
  }
  /* write to the remembered file. `silent` = an autosave: never pops a
     permission prompt (there is no user gesture behind it) */
  function saveToFile(silent){
    if(!fileHandle&&silent) return Promise.resolve(false);
    return (fileHandle?Promise.resolve(fileHandle):pickSaveFile())
      .then(function(h){
        if(!h) return false;
        return (silent?permOK(h):permAsk(h)).then(function(ok){
          if(!ok){
            if(!silent) toast('Junoview needs permission to write '
              +(fileName||'that file'));
            return false;
          }
          return h.createWritable().then(function(w){
            return Promise.resolve(w.write(deckFileText()))
              .then(function(){return w.close();});
          }).then(function(){
            lsDel(PFX+(pres.name||'untitled'));
            saveStamp=new Date();saveKind=silent?'auto':'manual';
            source='saved';status();renderTargetBtn();renderPresRow();
            if(!silent) toast('Saved to '+(fileName||'your file'));
            return true;
          });
        });
      }).catch(function(e){
        if(!silent&&(!e||e.name!=='AbortError'))
          toast('Save failed: '+((e&&e.message)||e));
        return false;
      });
  }
  function targetLabel(){
    if(saveTarget==='project') return 'This project';
    if(saveTarget==='file') return fileName||'a file (not chosen yet)';
    return 'Browser';
  }
  function renderTargetBtn(){
    var b=$('#dc-target'); if(!b) return;
    b.innerHTML='Saved to: '+esc(targetLabel())+' &#9662;';
    b.classList.toggle('tg-file',saveTarget==='file');
    var pj=$('#tg-project'); if(pj) pj.hidden=(APP.mode!=='app');
    var pk=$('#tg-pick'); if(pk) pk.hidden=(saveTarget!=='file');
    var tf=$('#tg-file');
    if(tf) tf.textContent=canPickFile
      ?'A file on your computer…'
      :'A file (this browser can’t — use Download a copy)';
    if(tf) tf.disabled=!canPickFile;
    [['#tg-project','project'],['#tg-browser','browser'],
     ['#tg-file','file']].forEach(function(p){
      var el=$(p[0]);
      if(el) el.setAttribute('aria-pressed',(saveTarget===p[1]).toString());
    });
    b.setAttribute('data-tip',
      saveTarget==='file'
        ?'Saving writes '+(fileName||'a .junoview file')
          +' — Junoview remembers it between visits'
        :saveTarget==='project'
          ?'Saving writes junoview_project.json next to your notebooks'
          :'Kept in this browser. Switch to a file to save it on your '
            +'computer as .junoview');
  }
  function setTarget(t){
    saveTarget=t;lsSet(TGKEY,t);
    renderTargetBtn();renderSaveBtn();status();
  }
  var AUTOKEY='semopts:'+SCOPE+':autosave';
  var autosaveOn=(APP.mode==='app')&&lsGet(AUTOKEY)!=='0';
  var autoTimer=null;
  function scheduleAutosave(){
    /* a remembered file autosaves too — silently, and only while the
       browser still grants write permission (after a reload it waits for
       the first Save click, which carries the user gesture it needs) */
    if(saveTarget==='file'){
      clearTimeout(autoTimer);
      autoTimer=setTimeout(function(){saveToFile(true);},1200);
      return;
    }
    if(!autosaveOn||APP.mode!=='app'||saveTarget!=='project') return;
    clearTimeout(autoTimer);
    autoTimer=setTimeout(function(){saveToProject(true);},1200);
  }
  function renderAutosaveItem(){
    var mi=$('#mi-autosave'); if(!mi) return;
    mi.hidden=(APP.mode!=='app');
    mi.textContent='Autosave: '+(autosaveOn?'on':'off');
  }
  var miAuto=$('#mi-autosave');
  if(miAuto) miAuto.addEventListener('click',function(){
    closeMenu();
    autosaveOn=!autosaveOn;
    lsSet(AUTOKEY,autosaveOn?'1':'0');
    renderAutosaveItem();renderSaveBtn();status();
    if(autosaveOn){scheduleAutosave();toast('Autosave on');}
    else toast('Autosave off — use the Save button');
  });
  renderAutosaveItem();

  /* always-visible Save button; the File menu keeps the rest */
  var saveBtn=$('#dc-save');
  function renderSaveBtn(){
    if(!saveBtn) return;
    if(saveTarget==='file'){
      saveBtn.setAttribute('data-tip','Save now to '
        +(fileName||'the .junoview file you pick')
        +' — Junoview remembers it between visits');
    } else if(saveTarget==='project'&&APP.mode==='app'){
      saveBtn.setAttribute('data-tip','Save now to '
        +'junoview_project.json'
        +(autosaveOn
          ?' — autosave is ON: every change saves itself about a '
            +'second later'
          :' — autosave is OFF, only this button saves'));
    } else {
      saveBtn.setAttribute('data-tip','Kept in this browser '
        +'automatically as you edit — Save confirms it. Switch '
        +'"Saved to" to keep it as a file on your computer');
    }
    saveBtn.removeAttribute('title');
  }
  if(saveBtn) saveBtn.addEventListener('click',function(){
    if(!requireName()) return;
    if(saveTarget==='project'&&APP.mode==='app'){saveToProject(false);return;}
    if(saveTarget==='file'){saveToFile(false);return;}
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
    saveStamp=new Date();saveKind='manual';
    status();
    toast('Kept in this browser — it also autosaves as you edit. '
      +'Switch "Saved to" to a file to keep it on your computer.');
  });
  renderSaveBtn();
  /* ---- the "Saved to" picker ---- */
  (function(){
    var wrap=$('#dc-target')&&$('#dc-target').parentNode;
    var btn=$('#dc-target'),menu=$('#target-menu');
    if(!btn||!menu) return;
    function close(){menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open.toString());
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&wrap&&!wrap.contains(e.target)) close();});
    var pj=$('#tg-project');
    if(pj) pj.addEventListener('click',function(){
      close();setTarget('project');
      toast('Saving now writes junoview_project.json');
    });
    var br=$('#tg-browser');
    if(br) br.addEventListener('click',function(){
      close();setTarget('browser');
      toast('Kept in this browser from now on');
    });
    function chooseFile(){
      close();
      if(!canPickFile){
        toast('This browser can’t save straight to a file — '
          +'use File › Download a copy');
        return;
      }
      if(!requireName()) return;
      pickSaveFile().then(function(h){
        if(!h) return;
        setTarget('file');
        return saveToFile(false);
      }).catch(function(e){
        if(!e||e.name!=='AbortError')
          toast('Could not choose a file: '+((e&&e.message)||e));
      });
    }
    var tf=$('#tg-file');
    if(tf) tf.addEventListener('click',function(){
      if(saveTarget==='file'&&fileHandle){
        close();setTarget('file');
        toast('Saving writes '+fileName);
        return;
      }
      chooseFile();
    });
    var pk=$('#tg-pick');
    if(pk) pk.addEventListener('click',chooseFile);
    /* a file chosen on an earlier visit is still remembered */
    idbGet(HKEY).then(function(h){
      if(!h) return;
      fileHandle=h;fileName=h.name||'';
      renderTargetBtn();renderSaveBtn();
    }).catch(function(){});
    renderTargetBtn();
  })();

  /* direct save-into-.ipynb is parked for now (kept for later) */
  var ENABLE_SAVE_TO_IPYNB=false;
  var writeBtn=$('#mi-save');
  if(APP.mode==='app'){
    writeBtn.textContent='Save to project';
    writeBtn.addEventListener('click',function(){
      closeMenu();
      if(!requireName()) return;
      saveToProject(false);
    });
  } else if(ENABLE_SAVE_TO_IPYNB
      &&APP.order.length===1&&window.showOpenFilePicker){
    writeBtn.addEventListener('click',function(){
      closeMenu();
      if(!requireName()) return;
      (async function(){
        try{
          var picks=await window.showOpenFilePicker({types:[{
            description:'Jupyter notebook',
            accept:{'application/json':['.ipynb']}}]});
          var h=picks[0];
          var f=await h.getFile();
          var nb=JSON.parse(await f.text());
          nb.metadata=nb.metadata||{};
          nb.metadata.semantic=nb.metadata.semantic||{};
          nb.metadata.semantic.presentations=
            plainIfSingle(mergedPresentations());
          delete nb.metadata.semantic.deck;
          var w=await h.createWritable();
          await w.write(JSON.stringify(nb,null,1));
          await w.close();
          var stem0=APP.order[0];
          nbPres=mergedPresentations().map(function(p){
            var c=normPres(p,null);c.origin=stem0;return c;});
          lsDel(PFX+(pres.name||'untitled'));
          saveStamp=new Date();saveKind='manual';
          source='saved';status();renderPresRow();
          toast('Saved "'+pres.name+'" into '+f.name);
        }catch(e){
          if(!e||e.name!=='AbortError')
            toast('Save failed: '+(e&&e.message?e.message:e));
        }
      })();
    });
  } else {
    writeBtn.hidden=true;
  }
  menuAction('#mi-dl',function(){
    var blob=new Blob([deckFileText()],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(APP.order.length===1?APP.order[0]:'project')+'.junoview';
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
    toast(APP.order.length===1
      ?'Downloaded. Keep it next to the .ipynb and it loads itself.'
      :'Downloaded. Load it with --deck, or save to the project instead.');
  });
  menuAction('#mi-load',function(){
    var fi=document.getElementById('deckfile');
    if(fi) fi.click();
  });
  /* ---- Export PDF / print: render every slide at a fixed size (so text,
     which is sized from the layer height, comes out right) into off-screen
     pages, then hand off to the browser's Print -> Save as PDF ---- */
  function printDeck(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    var old=document.getElementById('print-root');
    if(old) old.remove();
    var savedMode=mode,savedReveal=revealCount,savedCur=cur;
    mode='view';revealCount=99999;              /* all builds fully revealed */
    var root=document.createElement('div');root.id='print-root';
    /* attach the container FIRST (off-screen but laid out) so each slide has a
       real 720px height when its text is sized from the layer — otherwise a
       detached layer measures 0 and text bakes in ~17% too small */
    document.body.appendChild(root);
    /* a custom page (4:3 / A-series poster) exports at ITS size, not 16:9 */
    var pg=pageOf();
    if(pg.id!=='16x9'){
      var pw=Math.round(pg.mm[0]/25.4*96),ph=Math.round(pg.mm[1]/25.4*96);
      var pst=document.createElement('style');
      pst.textContent='#print-root{width:'+pw+'px;}'
        +'.print-page{width:'+pw+'px;height:'+ph+'px;}'
        +'@media print{@page{size:'+pg.mm[0]+'mm '+pg.mm[1]+'mm;'
        +'margin:0;}}';
      root.appendChild(pst);
    }
    pres.slides.forEach(function(s,i){
      cur=i;
      var page=document.createElement('div');page.className='print-page';
      var slideEl=document.createElement('div');
      if(s&&s.layout==='title'){
        slideEl.className='slide slide-titlefree';
        slideEl.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
      } else slideEl.className='slide slide-blank';
      page.appendChild(slideEl);
      root.appendChild(page);            /* in the DOM before annots render */
      if(s) attachAnnots(slideEl,s);     /* view-style; fontPx reads 720px */
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';pn.textContent=(i+1);
        slideEl.appendChild(pn);
      }
    });
    mode=savedMode;revealCount=savedReveal;cur=savedCur;
    document.body.classList.add('printing');
    if(typeset) typeset(root);
    var done=false;
    function cleanup(){
      if(done) return;done=true;
      document.body.classList.remove('printing');
      var r=document.getElementById('print-root'); if(r) r.remove();
      window.removeEventListener('afterprint',cleanup);
    }
    window.addEventListener('afterprint',cleanup);
    /* let layout + MathJax settle, then open the print dialog */
    setTimeout(function(){try{window.print();}catch(e){}
      setTimeout(cleanup,800);},120);
    return root;   /* returned for headless testing */
  }
  window.SemDeckPrint=printDeck;   /* test hook */
  menuAction('#mi-pdf',function(){printDeck();});
  (function(){
    var fi=document.getElementById('deckfile');
    if(!fi) return;
    fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      this.value='';
      if(!f) return;
      f.text().then(function(txt){
        var obj=JSON.parse(txt);
        var list=(obj&&Array.isArray(obj.presentations))
          ?obj.presentations
          :Array.isArray(obj)?obj
          :(obj&&Array.isArray(obj.slides))?[obj]:null;
        if(!list||!list.length){
          toast('That file does not look like a saved deck');
          return;
        }
        var imported=0,firstName=null;
        list.forEach(function(pr){
          if(!pr||!Array.isArray(pr.slides)) return;
          var np=normPres(pr);
          var base=np.name||'imported',nm=base,k=1;
          while(savedByName(nm)||lsGet(PFX+nm)){
            k++;nm=base+'-'+k;
          }
          np.name=nm;
          lsSet(PFX+nm,JSON.stringify(np));
          if(!firstName) firstName=nm;
          imported++;
        });
        if(!imported){
          toast('No presentations found in that file');
          return;
        }
        lsSet(PFX+'last',firstName);
        loadPresentation(firstName);
        cur=0;activePane=-1;
        status();refresh();
        toast('Imported '+imported+' presentation'
          +(imported>1?'s':'')+' (as drafts)');
      }).catch(function(e){
        toast('Import failed: '+((e&&e.message)||e));
      });
    });
  })();
  menuAction('#mi-discard',function(){
    lsDel(PFX+(pres.name||'untitled'));
    loadPresentation(pres.name);
    cur=0;activePane=-1;
    status();
    refresh();
  });
  menuAction('#mi-del',function(){
    var nm=pres.name;
    lsDel(PFX+nm);
    var wasEmbedded=nbPres.some(function(p){return p.name===nm;});
    projectPres=projectPres.filter(function(p){return p.name!==nm;});
    nbPres=nbPres.filter(function(p){return p.name!==nm;});
    if(APP.mode==='app')
      APP.api('/api/save',{presentations:deep(projectPres)})
        .catch(function(){});
    var names=allSaved().map(function(p){return p.name;})
      .concat(draftNames());
    if(names.length) loadPresentation(names[0]);
    else {pres=defaultPres();source='auto';}
    cur=0;activePane=-1;
    status();refresh();
    toast(wasEmbedded
      ?('Deleted "'+nm+'" (it will return if it is embedded in a '
        +'notebook’s metadata)')
      :('Deleted "'+nm+'"'));
  });

  /* ---------- tabs opened / closed while the page lives ---------- */
  document.addEventListener('sem:shell',function(e){
    if(e.detail.replaced){
      /* the notebook was reloaded: what every frame showed until now
         becomes the "previous figure" it can revert to */
      var pfx=e.detail.stem+'::';
      Object.keys(frameSnaps).forEach(function(k){
        if(k.indexOf(pfx)===0){
          frameSnapsPrev[k]=frameSnaps[k];delete frameSnaps[k];}
      });
    }
    registerShell(e.detail.stem,e.detail.data||{});
    if(source==='auto'&&(!pres.slides||!pres.slides.length))
      pres=defaultPres();
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });
  document.addEventListener('sem:shellclosed',function(e){
    unregisterShell(e.detail.stem);
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });

  status();
  renderPresTabs();
  /* both IIFEs + their route hooks are now wired — restore the URL's view */
  if(window.SemApp&&window.SemApp.applyInitialRoute)
    window.SemApp.applyInitialRoute();
})();
