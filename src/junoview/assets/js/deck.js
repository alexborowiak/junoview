
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
      {k:'text',x:2.5,y:26.8,w:29.7,h:2.6,text:'2 · Methods',
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
      {k:'text',x:67.8,y:9.2,w:29.7,h:2.6,text:'5 · More results',
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
      {k:'text',x:51.25,y:8.8,w:21.87,h:2.4,text:'4 · More results',
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
          /* NO baked colour: the default lives in CSS so the page
             theme decides — a stamped '#ffffff' made template text
             white-on-white on light posters (2026-08-05 review) */
          text:it.text||'Text',size:it.size||2.8,
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
    ['#layout-row','#layout-menu-grid','#layout-home-grid']
      .forEach(function(sel){
      var row=$(sel); if(!row||row.dataset.built===variant) return;
      row.dataset.built=variant;row.innerHTML='';
      var list=LAYOUTS.filter(function(l){
        return !!l.poster===isPoster&&l.id!=='blank';});
      if(isPoster) list=list.slice().sort(function(a,b){
        return (!!a.land===land?0:1)-(!!b.land===land?0:1);});
      /* Blank goes FIRST, and to BOTH families. It carries no poster flag,
         so the family filter used to drop it from posters altogether —
         there was no way to ask for an empty page (2026-08-07, user).
         Starting from nothing is the most basic choice there is, so it
         leads. */
      var blank=null;
      LAYOUTS.forEach(function(l){if(l.id==='blank') blank=l;});
      if(blank) list=[blank].concat(list);
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
          /* with no page yet, MAKE one rather than doing nothing — a
             layout button that silently ignores the click reads as
             broken (2026-08-07, user: "the layouts aren't selectable") */
          if(!pres.slides||!pres.slides.length){
            pres.slides=pres.slides||[];
            pres.slides.push(emptySlide());
            cur=0;
          }
          var s=pres.slides[cur]; if(!s) return;
          applyLayout(s,layout);
          activePane=-1;markDirty();refresh();
          closeLayMenu();
        });
        row.appendChild(b);
      });
    });
  }
  /* the ribbon's Layouts / Page dropdowns: open one, the other closes.
     The catalog is offered from TWO places now — Design ▸ Layouts and
     Home ▸ Layout — so picking from either has to shut both. */
  function closeLayMenu(){
    [['#lay-menu','#lay-btn'],['#hm-lay-menu','#hm-lay']]
      .forEach(function(p){
        var lm=$(p[0]),lb=$(p[1]);
        if(lm&&!lm.hidden){lm.hidden=true;
          if(lb) lb.setAttribute('aria-expanded','false');}
      });
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
  /* ---- the PAGE's own background (2026-08-04): pres.pageBg, default
     the classic dark. A light page also flips .page-light, which
     recolours the DEFAULT text/frame chrome — a white A0 the print shop
     will actually take. Explicit per-item colours are never touched. */
  function pageIsLight(bg){
    var m=/^#?([0-9a-f]{6})$/i.exec(String(bg||'').trim());
    if(!m) return false;
    var n=parseInt(m[1],16);
    return (0.2126*((n>>16)&255)+0.7152*((n>>8)&255)
      +0.0722*(n&255))/255>0.55;
  }
  function applyPageBg(){
    /* the slide's own colour wins; File > Page background stays the
       presentation-wide default (2026-08-18, user asked for per-slide
       backgrounds "like PowerPoint has") */
    var s0=pres&&pres.slides&&pres.slides[cur];
    var bg=(s0&&s0.bg)||(pres&&pres.pageBg)||'#0b141d';
    deckEl.style.setProperty('--page-bg',bg);
    deckEl.classList.toggle('page-light',pageIsLight(bg));
    $$('#mi-pagebg .pgbg-sw').forEach(function(sw){
      sw.classList.toggle('on',sw.dataset.bg===bg);});
  }
  function applyPage(){
    var pg=pageOf();
    deckEl.style.setProperty('--page-ar',pg.aw+' / '+pg.ah);
    deckEl.classList.toggle('custom-page',pg.id!=='16x9');
    deckEl.classList.toggle('poster-page',!!pg.poster);
    applyPageBg();
    var b=$('#page-btn');
    /* the group is already called Page, so the button carries only the
       size — "Poster A0 portrait" under a PAGE heading said "Poster" and
       "Page" twice and was the widest control in the group */
    if(b) b.innerHTML='&#9645; '
      +(pg.id==='16x9'?'Page':esc(pg.label.replace(/^Poster\s+/,'')))
      +' &#9662;';
    $$('#page-menu .page-opt').forEach(function(o){
      o.setAttribute('aria-pressed',
        (o.dataset.page===pg.id).toString());});
    /* a poster has no slides, so it is never told about them: the ribbon
       group is "Page", and page numbering — which only means anything to
       a deck you step through — goes away entirely */
    /* a heading must describe what is under it. On a poster Animate is
       hidden, so "Effects" stood over nothing but an opacity slider */
    /* the Effects group used to be renamed "Opacity" on a poster,
       because opacity lived in it and Animate did not apply. Opacity is
       in Colour now and a poster has no builds, so the group simply
       empties and syncRibbonGroups hides it (2026-08-17). */
    var vaB=$('#vw-anim');
    if(vaB) vaB.hidden=!!pg.poster;
    var slideLab=deckEl.querySelector('.rbn-slide .rbn-lab');
    if(slideLab) slideLab.textContent=pg.poster?'Page':'Slide';
    var nums=$('#mi-nums');
    if(nums) nums.hidden=!!pg.poster;
    /* a poster keeps "+ Add" — its pages are versions, and you need a way
       to make one; it just lives behind the Versions button now */
    var add=$('#film-add');
    if(add){
      add.textContent=pg.poster?'+ Create new version':'+ Add slide';
      add.title=pg.poster
        ?'Copy this poster to a new version you can change independently. '
          +'It is named for you; use Rename to change that.'
        :'Add an empty slide after this one';
    }
    /* the same button for both, named for what it holds: a poster's other
       pages are versions, a deck's are slides */
    var vb=$('#vw-versions');
    if(vb){
      vb.hidden=false;
      vb.innerHTML=pg.poster?'&#9776; Versions':'&#9776; Slides';
      vb.title=pg.poster
        ?'Other versions of this poster — drafts and variants. Opens the '
          +'strip; close it again to give the page the whole window'
        :'The strip of slides down the left. It is there by default — a '
          +'deck is a sequence — but you can put it away to give one '
          +'slide the whole window';
    }
    /* A poster that BECOMES a deck takes its strip back. There is one
       #film-list node and the two page kinds keep it in different places,
       so changing Page size from A0 to 16:9 with Versions open would
       otherwise leave the list floating in the pane while the panel that
       just appeared showed an empty strip. */
    if(!pg.poster&&mode==='edit'){showVerpane(false);filmToPanel();}
    syncStripBtn();
    /* Auto-build makes ONE SLIDE PER FIGURE. On a deck that is the whole
       point; on a poster it silently turns one page into seven, which is
       how a poster ended up with slides at all. Place cells on the page
       instead — the Insert group does that. */
    ['#mi-auto-figs','#mi-auto-figdocs'].forEach(function(sel){
      var el=$(sel); if(el) el.hidden=!!pg.poster;
    });
    renderLayoutPicker();   /* poster pages list poster templates first */
  }
  function sizeSlideTo(slideEl,zoom){
    var pg=pageOf();
    /* Measure the stage's CONTENT box, not its border box. clientWidth
       INCLUDES padding, so every rule that reserved room by padding the
       stage — the side toolbar, and now a docked pane — reserved nothing
       at all as far as the fit was concerned, and the page carried on
       being sized to the full width and sliding underneath whatever was
       supposed to be beside it (2026-08-20, found live: opening Layers
       set .pane-open, added 254px of padding, and the slide stayed
       1249px wide and overlapped the pane).
       The flat 36px this replaced was a guess standing in for the same
       padding: 52px of it horizontally and 28px vertically while
       editing, so it was wrong in both directions already. `gap` is the
       breathing room that guess was really providing. */
    var cs=window.getComputedStyle(stage),gap=16;
    var padX=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
    var padY=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
    var aw=stage.clientWidth-padX-gap,ah=stage.clientHeight-padY-gap;
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
    /* the slide's border: an inset shadow so it costs no layout, sized
       in the same 720-page currency as line weight so it scales with the
       page instead of staying a constant screen thickness */
    var sB=pres.slides&&pres.slides[cur],bd=sB&&sB.border;
    slideEl.style.boxShadow=bd
      ?('inset 0 0 0 '+((bd.w||4)/SW_REF_H*h).toFixed(2)+'px '
        +(bd.c||'#39a9c0'))
      :'';
    stage.classList.toggle('zoomed',w>aw+1||h>ah+1);
  }
  function applyZoom(){
    if(deckEl.hidden) return;
    var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
    if(mode==='edit'){
      sizeSlideTo(slideEl,deckZoom||1);
      /* Always a PERCENTAGE, never the word "Fit". Between a − and a +,
         "Fit" read as a button named Fit rather than as the zoom level
         (2026-08-07, user: "the fit button is confusing… I think you mean
         zoom"). Auto-fit still shows its real percentage, measured off
         the page, so the number always means the same thing. */
      var zl=$('#zoom-val');
      if(zl){
        var pg2=pageOf();
        var natural=pg2.mm[0]/25.4*96;      /* the page at 100% */
        var shown=parseFloat(slideEl.style.width)||0;
        var pct=(natural&&shown)?Math.round(shown/natural*100)
          :Math.round((deckZoom||1)*100);
        /* the word is carried on the control itself: a bare "4%" between a
           minus and a plus is honest (an A0 page really is shown at about
           4%) but says nothing about WHAT is 4% */
        zl.textContent='Zoom '+pct+'%';
        zl.title=deckZoom
          ? 'Click to fit the whole page in the window'
          : 'Fitted to the window — click to re-fit after scrolling';
      }
    } else {
      /* playback letterboxes to the page — EVERY page, 16:9 included. It
         used to be gated on custom-page, so a standard deck presented on
         a canvas with the WINDOW's shape while text and cell zoom key on
         layer HEIGHT: everything grew ~19% at 1400x900 and by a different
         amount on every screen (2026-08-20 diagnosis, measured live —
         "in present mode the size of things changes") */
      sizeSlideTo(slideEl,1);
    }
    /* Text is sized as a PERCENTAGE of the page, worked out from the
       layer's height when the annotations render. Zooming resized the
       page but never re-rendered them, so every text kept the size it had
       at the old zoom and burst out of its box (2026-08-07, user: "when
       you zoom out the text fucks up"). Figure frames fit themselves the
       same way, so they need it too. */
    /* Line weight is page-relative for the same reason, so PLAYBACK needs
       this too: a poster presented full screen, or a window resized
       mid-talk, otherwise keeps whatever the layer measured before the
       transition. The edit branch has always re-rendered; the letterboxed
       playback branch never did (2026-08-10). */
    var s0=pres.slides[cur],l0=stage.querySelector('.annot-layer');
    if(s0&&l0){
      renderAnnots(l0,s0);
      if(mode==='edit') paintSel(l0);
    }
    syncGuides();   /* rulers and grid track whatever size the page ended up */
  }
  function setZoom(z){deckZoom=z;applyZoom();}

  /* ---- page guides: rulers, a margin box and a layout grid ----------
     A poster is far bigger than the window, so "is this aligned?" cannot
     be answered by eye the way it can on a 16:9 slide. These give the
     page a frame of reference: real millimetre rulers, a printer safe
     margin, and a column grid that items snap to. All three are editing
     aids — they are excluded from playback, print and every export. */
  var GUIDE_KEY='junoview:deck:guides';
  var guides={rulers:false,grid:false,side:false};
  try{
    var _g=JSON.parse(localStorage.getItem(GUIDE_KEY)||'{}');
    if(_g&&typeof _g==='object'){
      guides.rulers=!!_g.rulers;guides.grid=!!_g.grid;
      guides.side=!!_g.side;guides.sideSet=!!_g.sideSet;}
  }catch(e){}
  function saveGuides(){
    try{localStorage.setItem(GUIDE_KEY,JSON.stringify(guides));}catch(e){}
  }
  var MARGIN_MM=20;      /* a printer's safe area: nothing important outside */
  var BLEED_MM=5;        /* where trim marks live, outside the page */
  var GRID_COLS=12;
  function marginPct(){
    var pg=pageOf();
    return {x:Math.min(20,MARGIN_MM/pg.mm[0]*100),
            y:Math.min(20,MARGIN_MM/pg.mm[1]*100)};
  }
  /* the grid divides the area INSIDE the margins into 12 columns, and
     rules horizontally at the same physical pitch so the cells are square
     — a 12-column poster grid people already know how to lay out against */
  function gridPct(){
    var pg=pageOf(),m=marginPct();
    var colW=(100-2*m.x)/GRID_COLS;
    var rowH=colW*(pg.mm[0]/pg.mm[1])*(100/100);
    /* colW is a % of WIDTH; convert that physical width to a % of HEIGHT */
    rowH=colW/100*pg.mm[0]/pg.mm[1]*100;
    /* fit the rows EXACTLY into the margin box: flooring left a partial
       band at the bottom with no lines in it, so the grid visibly stopped
       partway down the page (2026-08-19, user screenshot). Rounding keeps
       every cell within half a pitch of square and puts the last rule ON
       the bottom margin. */
    var rows=Math.max(1,Math.round((100-2*m.y)/rowH));
    rowH=(100-2*m.y)/rows;
    return {m:m,colW:colW,rowH:rowH,rows:rows};
  }
  /* extra snap lines contributed by the guides (only when shown) */
  function guideTargets(){
    if(!guides.grid) return {xs:[],ys:[]};
    var g=gridPct(),xs=[],ys=[],i;
    for(i=0;i<=GRID_COLS;i++) xs.push(g.m.x+i*g.colW);
    /* the last row now lands exactly on the bottom margin */
    for(i=0;i<=g.rows;i++) ys.push(g.m.y+i*g.rowH);
    return {xs:xs,ys:ys};
  }
  function drawGrid(slideEl){
    if(!slideEl) return;
    var host=slideEl.querySelector('.pgrid');
    if(!guides.grid||mode!=='edit'){ if(host) host.remove(); return; }
    if(!host){
      host=document.createElement('div');host.className='pgrid';
      slideEl.insertBefore(host,slideEl.firstChild);
    }
    var g=gridPct(),parts=[],i;
    parts.push('<div class="pgrid-margin" style="left:'+g.m.x+'%;top:'+g.m.y
      +'%;right:'+g.m.x+'%;bottom:'+g.m.y+'%;"></div>');
    for(i=0;i<GRID_COLS;i++){
      if(i%2) continue;                 /* shade alternate columns only */
      parts.push('<div class="pgrid-col" style="left:'+(g.m.x+i*g.colW)
        +'%;width:'+g.colW+'%;top:'+g.m.y+'%;bottom:'+g.m.y+'%;"></div>');
    }
    /* ROW lines. They were computed and then never drawn, so "Margin &
       grid" put up vertical stripes and called them a grid — you could
       line things up sideways and had nothing to line them up against
       going down (2026-08-07, user: "the grid is broken"). Rows use the
       same physical pitch as the columns, so the cells are square. */
    for(i=1;i<g.rows;i++){
      parts.push('<div class="pgrid-rule" style="top:'+(g.m.y+i*g.rowH)
        +'%;left:'+g.m.x+'%;right:'+g.m.x+'%;"></div>');
    }
    for(i=1;i<GRID_COLS;i++){
      parts.push('<div class="pgrid-vrule" style="left:'
        +(g.m.x+i*g.colW)+'%;top:'+g.m.y+'%;bottom:'+g.m.y+'%;"></div>');
    }
    host.innerHTML='<div class="pgrid-lines">'+parts.join('')+'</div>';
  }
  function rulerStep(pxPerMm){
    var steps=[1,2,5,10,20,25,50,100,200,500,1000];
    for(var i=0;i<steps.length;i++)
      if(steps[i]*pxPerMm>=7) return steps[i];
    return steps[steps.length-1];
  }
  function fillRuler(el,lenMm,pxPerMm,vertical){
    var step=rulerStep(pxPerMm);
    var labelEvery=(step*pxPerMm>=46)?1:(step*5*pxPerMm>=46?5:10);
    var parts=[];
    for(var mm=0;mm<=lenMm+0.5;mm+=step){
      var pos=mm*pxPerMm;
      var major=(Math.round(mm/step)%labelEvery===0);
      parts.push('<i class="rtick'+(major?' major':'')+'" style="'
        +(vertical?'top:':'left:')+pos+'px"></i>');
      if(major&&mm>0)
        parts.push('<span class="rlab" style="'+(vertical?'top:':'left:')
          +pos+'px">'+Math.round(mm)+'</span>');
    }
    el.innerHTML=parts.join('');
  }
  var rulerCursor={x:null,y:null};
  function drawRulers(slideEl,wrap){
    var rh=$('#ruler-h'),rv=$('#ruler-v'),rc=$('#ruler-corner');
    if(!rh||!rv||!rc) return;
    var sr=slideEl.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
    var left=sr.left-wr.left,top=sr.top-wr.top;
    var pg=pageOf();
    var ppmX=sr.width/pg.mm[0],ppmY=sr.height/pg.mm[1];
    rh.style.left=left+'px';rh.style.top=(top-20)+'px';
    rh.style.width=sr.width+'px';
    rv.style.top=top+'px';rv.style.left=(left-20)+'px';
    rv.style.height=sr.height+'px';
    rc.style.left=(left-20)+'px';rc.style.top=(top-20)+'px';
    fillRuler(rh,pg.mm[0],ppmX,false);
    fillRuler(rv,pg.mm[1],ppmY,true);
    /* the selected item's extent, shaded on both rulers */
    var s=pres.slides[cur],layer=slideEl.querySelector('.annot-layer');
    if(s&&layer&&typeof selAnnot==='number'){
      var r=annotRectPct(layer,s,selAnnot);
      if(r){
        rh.insertAdjacentHTML('beforeend','<i class="rspan" style="left:'
          +(r.l/100*sr.width)+'px;width:'+((r.r-r.l)/100*sr.width)+'px"></i>');
        rv.insertAdjacentHTML('beforeend','<i class="rspan" style="top:'
          +(r.t/100*sr.height)+'px;height:'+((r.b-r.t)/100*sr.height)
          +'px"></i>');
      }
    }
    if(rulerCursor.x!=null)
      rh.insertAdjacentHTML('beforeend','<i class="rcursor" style="left:'
        +(rulerCursor.x*sr.width)+'px"></i>');
    if(rulerCursor.y!=null)
      rv.insertAdjacentHTML('beforeend','<i class="rcursor" style="top:'
        +(rulerCursor.y*sr.height)+'px"></i>');
  }
  function syncGuides(){
    var wrap=$('#deck-stagewrap'),rl=$('#rulers');
    var slideEl=stage?stage.querySelector('.slide'):null;
    if(rl&&wrap){
      var on=(mode==='edit'&&guides.rulers&&!!slideEl&&!deckEl.hidden);
      rl.hidden=!on;
      if(on) drawRulers(slideEl,wrap);
    }
    drawGrid(slideEl);
    drawCustomGuides(slideEl);
  }
  /* ---- custom guides, dragged off the rulers -------------------------
     The 12-column grid covers the common case; a real poster usually has
     one or two lines of its own (a banner depth, a column split that is
     not twelfths). Drag from a ruler onto the page to lay one down, drag
     it back onto the ruler to remove it. They belong to the PRESENTATION,
     so they are saved and re-open with it. */
  function customGuides(){
    var g=(pres&&pres.guides)||{};
    return {x:(g.x||[]).slice(),y:(g.y||[]).slice()};
  }
  function setCustomGuides(g){
    if(!pres) return;
    if(!g.x.length&&!g.y.length) delete pres.guides;
    else pres.guides={x:g.x,y:g.y};
    markDirty();
  }
  function drawCustomGuides(slideEl){
    if(!slideEl) return;
    var host=slideEl.querySelector('.cguides');
    var cg=customGuides();
    if(mode!=='edit'||(!cg.x.length&&!cg.y.length)){
      if(host) host.remove(); return;
    }
    if(!host){
      host=document.createElement('div');host.className='cguides';
      slideEl.insertBefore(host,slideEl.firstChild);
    }
    host.innerHTML=
      cg.x.map(function(v,i){
        return '<i class="cguide cg-v" data-ax="x" data-i="'+i
          +'" style="left:'+v+'%"></i>';}).join('')
      +cg.y.map(function(v,i){
        return '<i class="cguide cg-h" data-ax="y" data-i="'+i
          +'" style="top:'+v+'%"></i>';}).join('');
  }
  /* drag a NEW guide out of a ruler, or an existing one to move/remove */
  function startGuideDrag(ev,axis,existing){
    ev.preventDefault();
    var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
    var cg=customGuides();
    var idx=(existing==null)
      ?(cg[axis].push(axis==='x'?0:0)-1):existing;
    function at(e){
      var sr=slideEl.getBoundingClientRect();
      if(!sr.width||!sr.height) return null;
      return axis==='x'?(e.clientX-sr.left)/sr.width*100
                       :(e.clientY-sr.top)/sr.height*100;
    }
    function mv(e){
      var v=at(e); if(v==null) return;
      cg[axis][idx]=Math.max(-4,Math.min(104,v));
      setCustomGuides(cg);drawCustomGuides(slideEl);
    }
    function up(e){
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      var v=cg[axis][idx];
      /* dropped back outside the page: that is how you delete one */
      if(v==null||v<0||v>100){cg[axis].splice(idx,1);}
      else cg[axis][idx]=Math.round(v*100)/100;
      setCustomGuides(cg);drawCustomGuides(slideEl);
    }
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
    mv(ev);
  }
  (function(){
    var rh=$('#ruler-h'),rv=$('#ruler-v');
    /* the rulers are pointer-events:none so they never block the canvas;
       they take pointer events only where a guide can be pulled from */
    if(rh) rh.addEventListener('mousedown',function(e){
      startGuideDrag(e,'y',null);});
    if(rv) rv.addEventListener('mousedown',function(e){
      startGuideDrag(e,'x',null);});
    if(stage) stage.addEventListener('mousedown',function(e){
      var g=e.target.closest?e.target.closest('.cguide'):null;
      if(!g) return;
      e.stopPropagation();
      startGuideDrag(e,g.dataset.ax,+g.dataset.i);
    },true);
  })();
  /* ---- pre-print check ------------------------------------------------
     Nothing here is new information: the DPI judgement, the margin, the
     page bounds and the page background were all already known. What was
     missing was one place that asks them all at once, before you send a
     poster to a shop that will print exactly what you gave it. */
  function rgbOf(c){
    var s=String(c||'').trim(),m;
    if((m=s.match(/^#?([0-9a-f]{3})$/i)))
      return m[1].split('').map(function(ch){
        return parseInt(ch+ch,16);});
    if((m=s.match(/^#?([0-9a-f]{6})/i)))
      return [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),
        parseInt(m[1].slice(4,6),16)];
    if((m=s.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i)))
      return [+m[1],+m[2],+m[3]];
    return null;
  }
  function relLum(rgb){
    var a=rgb.map(function(v){
      v/=255;
      return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
    return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
  }
  function contrast(c1,c2){
    var a=rgbOf(c1),b=rgbOf(c2);
    if(!a||!b) return null;
    var l1=relLum(a),l2=relLum(b);
    var hi=Math.max(l1,l2),lo=Math.min(l1,l2);
    return (hi+0.05)/(lo+0.05);
  }
  function preflight(){
    var s=pres.slides[cur],out=[];
    if(!s) return out;
    var layer=stage.querySelector('.annot-layer');
    var slideEl=stage.querySelector('.slide');
    var pg=pageOf(),m=marginPct();
    var bg=(pres&&pres.pageBg)||'#0b141d';
    var ink=pageIsLight(bg)?'#0b141d':'#ffffff';
    function add(idx,sev,what,why){
      out.push({idx:idx,sev:sev,what:what,why:why});
    }
    (s.annots||[]).forEach(function(a,i){
      if(!a||a.hide) return;
      var label=annotLabel(a);
      if(a.k==='cell'&&!a.ref){
        add(i,'err','Empty frame',
          'A placed frame with no notebook cell in it — it will print as '
          +'a blank box.');
        return;
      }
      var r=layer?annotRectPct(layer,s,i):null;
      if(!r&&a.w!=null&&a.h!=null)
        r={l:a.x,r:a.x+a.w,t:a.y,b:a.y+a.h};
      if(r){
        if(r.l<-0.5||r.t<-0.5||r.r>100.5||r.b>100.5)
          add(i,'err',label+' runs off the page',
            'Part of this is outside the page and will be cut off.');
        else if(r.l<m.x-0.5||r.t<m.y-0.5||r.r>100-m.x+0.5
                ||r.b>100-m.y+0.5)
          add(i,'warn',label+' is inside the margin',
            'It sits within '+MARGIN_MM+'mm of the edge. Trimming and '
            +'frames eat that strip.');
      }
      if(a.k==='text'){
        if(!String(a.text||'').trim())
          add(i,'warn','Empty text box','Nothing typed in it.');
        var fg=a.color||ink,against=(a.bg!==0&&a.bgc)?a.bgc:bg;
        var cr=contrast(fg,against);
        if(cr!=null&&cr<4.5)
          add(i,cr<3?'err':'warn','Text is hard to read',
            'Contrast against the page is '+cr.toFixed(1)+':1. Aim for '
            +'4.5:1 — from a metre away on a poster floor, more.');
      }
    });
    /* a line thin enough to break up or vanish on press. 0.25mm is the
       usual print-shop floor for a reliable hairline; preflight is the
       only place that speaks in real millimetres, so it is the only place
       that can judge this. */
    (s.annots||[]).forEach(function(a,i){
      if(a.k!=='arrow'&&a.k!=='rect'&&a.k!=='draw') return;
      if(a.hide) return;
      var mmw=swMm(a,pg);
      if(mmw>=0.25) return;
      add(i,'warn','Line may not print ('+mmw.toFixed(2)+'mm)',
        'Thinner than about 0.25mm and a press can break it up or drop '
        +'it. Select it and click Weight to thicken it.');
    });
    /* the DPI chips the editor already puts on soft figures */
    if(slideEl) $$('.dpi-warn',slideEl).forEach(function(w){
      var cell=w.closest('.an-item');
      var idx=cell?+cell.getAttribute('data-idx'):null;
      add(isNaN(idx)?null:idx,'err','Figure prints soft ('
        +w.textContent.replace(/[^0-9]/g,'')+' dpi)',
        'Re-save it from the notebook at a higher dpi, or as SVG, then '
        +'refresh notebooks.');
    });
    return out;
  }
  function renderPreflight(){
    var pane=$('#preflight'),list=$('#preflight-list');
    if(!pane||!list) return;
    var issues=preflight();
    var errs=issues.filter(function(x){return x.sev==='err';}).length;
    var head=$('#preflight-count');
    if(head) head.textContent=issues.length
      ?(issues.length+' to look at'+(errs?' · '+errs+' serious':''))
      :'Nothing to fix';
    list.innerHTML='';
    if(!issues.length){
      list.innerHTML='<div class="pf-ok">This page is ready to print. '
        +'Figures are sharp enough, nothing runs off the page or into '
        +'the margin, and the text has enough contrast.</div>';
      return;
    }
    issues.forEach(function(x){
      var row=document.createElement('button');
      row.className='pf-row pf-'+x.sev;
      row.innerHTML='<span class="pf-what">'+esc(x.what)+'</span>'
        +'<span class="pf-why">'+esc(x.why)+'</span>';
      if(x.idx!=null) row.addEventListener('click',function(){
        var l=stage.querySelector('.annot-layer');
        if(l) selectAnnot(l,x.idx);
      });
      list.appendChild(row);
    });
  }
  (function(){
    var btn=$('#vw-check'),pane=$('#preflight'),cl=$('#preflight-close');
    if(btn) btn.addEventListener('click',function(){
      if(!pane) return;
      pane.hidden=!pane.hidden;
      btn.setAttribute('aria-pressed',pane.hidden?'false':'true');
      if(!pane.hidden) renderPreflight();
    });
    if(cl) cl.addEventListener('click',function(){
      if(pane) pane.hidden=true;
      if(btn) btn.setAttribute('aria-pressed','false');
    });
    var re=$('#preflight-rerun');
    if(re) re.addEventListener('click',renderPreflight);
  })();
  window.SemDeckPreflight=preflight;                 /* test hook */
  window.SemDeckGuides=function(){return guides;};   /* test hook */

  /* ---- the View group: rulers, grid, side toolbar, full-screen ---- */
  var editFull=false;      /* full screen while EDITING (not presenting) */
  /* Until you say otherwise, a PORTRAIT poster gets the side toolbar and
     everything else keeps the familiar top one: that is the shape where
     the horizontal ribbon eats the dimension the page needs most. Once
     you touch the button your choice sticks for every page. */
  function wantSide(){
    if(guides.sideSet) return !!guides.side;
    var pg=pageOf();
    return !!(pg.poster&&pg.mm[1]>pg.mm[0]);
  }
  function applySideRibbon(){
    var on=wantSide();
    deckEl.classList.toggle('rbn-side',on&&mode==='edit');
    var b=$('#vw-side');
    if(b) b.setAttribute('aria-pressed',on?'true':'false');
    applyZoom();           /* the stage just changed width */
  }
  /* ---- fit the ribbon by DENSITY, never by wrapping, scrolling or
     dropping a word.
     It does NOT move the toolbar to the side on its own: that was tried
     (2026-08-07) and it both overrode a choice the user had just made
     with the Side button and left a half-built column behind. Where the
     row is genuinely fuller than the width allows, the answer is fewer
     things in it — hence the View menu — not a layout that teleports. ---- */
  var ERC=['erc1','erc2','erc3'];
  /* TWO ladders, because the ribbon has two halves with different rules.
     ERCW sizes the CONSTANT half (File, Slide, View) and is a pure
     function of the ribbon's WIDTH — never of what is in it. That is the
     whole point: the width is identical whether or not you have something
     selected, so no rung here can fire on a click. The constant half
     therefore steps only when you resize the window, which is the one
     moment a control moving is not a surprise.
     ERC below sizes the CHANGING half against the content, as before. */
  /* The thresholds are set from the WIDEST state the bar can be asked to
     hold — a text selection, which needs ~90px more than the resting row
     — not from the resting one. Sizing them to the resting row would fit
     beautifully until you clicked a text box, which is the only case that
     matters. */
  var ERCW=[['ercw1',1260],['ercw2',1170],['ercw3',1080],['ercw4',990]];
  /* ---- RIBBON TABS ----------------------------------------------------
     One ribbon stopped being able to hold the editor: every feature added
     a control, every control bought a density rung, and the row spent its
     whole life at the tight end of the ladder (2026-08-20, user: "there
     might not need to be tabs like power point and foxit pdf has ... there
     might be starting to get too many feature to have on one ribbon").
     A tab is just a filter: each .rbn-grp declares its data-tab, and
     everything not on the showing tab is taken OUT of the row with
     display:none — not visibility — so it costs nothing in the width the
     fit ladder measures. The ladder itself is unchanged, and with a third
     of the groups in the row it now almost never has to fire.
     Home is where everything selection-driven lives, deliberately: the
     tools for the thing you just clicked must be in ONE named place you
     can go back to, not on a tab that appears and disappears. */
  var TABS=['home','insert','design','animate','view'];
  /* SCOPE is declared further down the file, so the remembered tab is read
     on first use rather than here — `var` hoisting would otherwise key it
     under the string "undefined" */
  var curTab=null;
  function tabKey(){return 'jv-deck-tab:'+SCOPE;}
  function activeTab(){
    if(curTab===null){
      var t=lsGet(tabKey());
      curTab=TABS.indexOf(t)>=0?t:'home';
    }
    return curTab;
  }
  function tabHasContent(t){
    var bar=$('#edit-tools'); if(!bar) return false;
    var gs=$$('.rbn-grp[data-tab="'+t+'"]',bar);
    for(var i=0;i<gs.length;i++) if(!gs[i].hidden) return true;
    return false;
  }
  function syncTabStrip(){
    var strip=$('#rbn-tabs'); if(!strip) return;
    /* a deck animates and a poster does not, so the Animate tab exists
       only where there is something to animate — the same test #vw-anim
       already passed on its own */
    var deck=!pageOf().poster;
    $$('.rbn-tab',strip).forEach(function(b){
      var t=b.dataset.tab;
      if(t==='animate') b.hidden=!deck;
      b.setAttribute('aria-selected',(t===activeTab()).toString());
    });
    if(activeTab()==='animate'&&!deck) setTab('home');
  }
  function applyTab(){
    var bar=$('#edit-tools'); if(!bar) return;
    var t=activeTab();
    $$('.rbn-grp[data-tab]',bar).forEach(function(g){
      if(g.dataset.tab===t) g.removeAttribute('data-off');
      else g.setAttribute('data-off','1');
    });
    syncTabStrip();
  }
  function setTab(t){
    if(TABS.indexOf(t)<0||t===activeTab()) return;
    curTab=t;lsSet(tabKey(),t);
    applyTab();
    /* the row's content just changed wholesale, so its column counts and
       its density both have to be judged again */
    syncRibbonGroups();
  }
  $$('#rbn-tabs .rbn-tab').forEach(function(b){
    b.addEventListener('click',function(){setTab(b.dataset.tab);});
  });
  function fitEditRibbon(){
    var bar=$('#edit-tools');
    if(!bar||bar.hidden||mode!=='edit') return;
    /* BEFORE anything is measured: a stale column count is a wrong width,
       so re-counting here is both the fix for a group that grew a control
       since the last count and the only way the density rungs below are
       judged against the row that is actually on screen */
    sizeRibbonGroups();
    var cl=deckEl.classList;
    if(cl.contains('rbn-side')){
      /* a column is not short of width and has no rungs at all — leaving
         one stamped on would shrink the rail's type for no reason */
      ERCW.forEach(function(r){cl.remove(r[0]);});
      return;
    }
    ERC.forEach(function(c){cl.remove(c);});
    cl.remove('erc-nohint');cl.remove('erc-nostatus');cl.remove('erc-tight');
    if(!bar.clientWidth) return;
    ERCW.forEach(function(r){cl.toggle(r[0],bar.clientWidth<r[1]);});
    /* the reminder text gives up its room before any control tightens */
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('erc-nohint');
    for(var i=0;i<ERC.length;i++){
      if(bar.scrollWidth<=bar.clientWidth+1) break;
      cl.add(ERC[i]);
    }
    /* the save readout goes AFTER the density rungs, not with the hint:
       it is informative (where your work is) where the hint is
       decorative — but it still goes before any control shrinks to its
       last rung or the row clips (2026-08-18) */
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('erc-nostatus');
    /* still over after every rung: drop the one group that is not about
       the selection, rather than let the row clip */
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('erc-tight');
    /* Below the floor the row genuinely does not fit even flattened, and
       the only moves left — clip, scroll, wrap — are all forbidden.
       Standing the toolbar on its end is the layout that has room, and
       the Side button does exactly that; it is NOT done automatically,
       because a toolbar that teleports over a choice you just made was
       tried and rejected (2026-08-07).
       Floor measured by squeezing the resting ribbon 10px at a time:
       929px on 2026-08-10, 959px on 2026-08-16. The 30px is what View
       costs once its three controls are honestly sized across two columns
       instead of stacking into a third row and printing over their own
       label; the tight rung's spacing gave 40px of the ~70px back. Below
       it the remedy is Guides ▸ Toolbar on the right. */
  }
  function syncViewBtns(){
    var r=$('#vw-rulers'),g=$('#vw-grid'),f=$('#vw-full');
    if(r) r.setAttribute('aria-pressed',guides.rulers?'true':'false');
    if(g) g.setAttribute('aria-pressed',guides.grid?'true':'false');
    if(f) f.setAttribute('aria-pressed',editFull?'true':'false');
  }
  function toggleEditFull(){
    try{
      if(!document.fullscreenElement&&deckEl.requestFullscreen){
        editFull=true;
        deckEl.classList.add('editfull');
        deckEl.requestFullscreen().catch(function(){
          editFull=false;deckEl.classList.remove('editfull');syncViewBtns();});
      } else if(document.fullscreenElement){
        document.exitFullscreen().catch(function(){});
      }
    }catch(err){}
    syncViewBtns();
  }
  (function(){
    /* the View menu opens and closes like the other ribbon dropdowns; its
       rows are built in markup because each is a stateful toggle, not a
       one-shot pick */
    var vwrap=$('#vw-menuwrap'),vbtn=$('#vw-menu'),vlist=$('#vw-menu-list');
    if(vwrap&&vbtn&&vlist){
      vbtn.addEventListener('click',function(e){
        e.stopPropagation();
        var open=vlist.hidden;
        vlist.hidden=!open;
        vbtn.setAttribute('aria-expanded',open.toString());
        if(open) floatMenu(vbtn,vlist);
      });
      document.addEventListener('click',function(e){
        if(!vlist.hidden&&!vwrap.contains(e.target)){
          vlist.hidden=true;vbtn.setAttribute('aria-expanded','false');}
      });
    }
    /* ONE button, two mechanisms, because the two page kinds want opposite
       defaults. A deck's strip is docked and on: toggling it is a class,
       and the slide list never leaves the panel. A poster's versions are
       rare enough to be worth no permanent width, so they stay in the
       floating pane the Objects list uses (2026-08-17). */
    var vsb=$('#vw-versions');
    if(vsb) vsb.addEventListener('click',function(){
      if(pageOf().poster){showVerpane(!!$('#verpane').hidden);return;}
      deckEl.classList.toggle('strip-off');
      syncStripBtn();
      applyZoom();          /* the stage just changed width */
    });
    var vpc=$('#verpane-close');
    if(vpc) vpc.addEventListener('click',function(){showVerpane(false);});
    var r=$('#vw-rulers'),g=$('#vw-grid'),sd=$('#vw-side'),f=$('#vw-full');
    if(r) r.addEventListener('click',function(){
      guides.rulers=!guides.rulers;saveGuides();syncViewBtns();syncGuides();});
    if(g) g.addEventListener('click',function(){
      guides.grid=!guides.grid;saveGuides();syncViewBtns();
      renderSlide();});
    if(sd) sd.addEventListener('click',function(){
      guides.side=!wantSide();guides.sideSet=true;
      saveGuides();applySideRibbon();});
    if(f) f.addEventListener('click',toggleEditFull);
    /* leaving full screen by any route (Esc, F11, the OS) must not leave
       the editor stamped with a full-screen class it no longer has */
    document.addEventListener('fullscreenchange',function(){
      if(document.fullscreenElement) return;
      if(!editFull) return;
      editFull=false;
      deckEl.classList.remove('editfull');
      syncViewBtns();applyZoom();
    });
    /* the pointer's position, shown on both rulers */
    if(stage) stage.addEventListener('mousemove',function(e){
      if(!guides.rulers||mode!=='edit') return;
      var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
      var sr=slideEl.getBoundingClientRect();
      if(!sr.width||!sr.height) return;
      rulerCursor.x=(e.clientX-sr.left)/sr.width;
      rulerCursor.y=(e.clientY-sr.top)/sr.height;
      if(rulerCursor.x<0||rulerCursor.x>1) rulerCursor.x=null;
      if(rulerCursor.y<0||rulerCursor.y>1) rulerCursor.y=null;
      syncGuides();
    });
    if(stage) stage.addEventListener('mouseleave',function(){
      rulerCursor.x=rulerCursor.y=null;
      if(guides.rulers&&mode==='edit') syncGuides();
    });
    if(stage) stage.addEventListener('scroll',function(){syncGuides();});
  })();
  (function(){
    var zi=$('#zoom-in'),zo=$('#zoom-out'),zv=$('#zoom-val');
    if(zi) zi.addEventListener('click',function(){
      setZoom(Math.min(6,(deckZoom||1)*1.25));});
    if(zo) zo.addEventListener('click',function(){
      setZoom(Math.max(0.25,(deckZoom||1)/1.25));});
    if(zv) zv.addEventListener('click',function(){setZoom(0);});
    window.addEventListener('resize',function(){
      if(!deckEl.hidden){fitEditRibbon();applyZoom();}});
    /* the ribbon's height CHANGES now (the contextual format groups
       leave the layout when hidden), and so does the page picker — any
       toolbar reflow resizes the stage, so the page re-fits itself
       rather than waiting for a window resize */
    if(window.ResizeObserver){
      var et=$('#edit-tools');
      /* the ribbon's own box changing is the ONE signal that catches every
         way it can get narrower — window resize, the docked panel opening,
         the side rail collapsing, and the first real layout after load.
         Without this the bar was measured at zero width on open, bailed
         out, and never compacted again: the toolbar you saw was always
         full size and simply ran off the right-hand edge (2026-08-07). */
      if(et) new ResizeObserver(function(){
        if(deckEl.hidden) return;
        requestAnimationFrame(function(){
          if(deckEl.hidden) return;
          fitEditRibbon();applyZoom();
        });
      }).observe(et);
    }
    /* The rulers are drawn at the slide's CURRENT position, so anything
       that moves the slide has to redraw them. The ribbon observer above
       does not see the docked panel opening, closing or being dragged
       wider — and that is exactly the slide case, where the panel appears
       after the rulers are first placed and leaves them stranded to the
       left of the page they are supposed to measure (2026-08-07, user:
       "ruler in slides is bugged"). Watching the STAGE catches all of it. */
    if(window.ResizeObserver&&stage){
      new ResizeObserver(function(){
        if(deckEl.hidden) return;
        requestAnimationFrame(function(){
          if(!deckEl.hidden) syncGuides();
        });
      }).observe(stage);
    }
    /* a fit measured against the fallback font sticks, because the bar's
       box never changes when the real font finally arrives */
    try{
      if(document.fonts&&document.fonts.ready)
        document.fonts.ready.then(function(){
          if(!deckEl.hidden) fitEditRibbon();});
    }catch(e){}
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
        /* Changing the page can change WHERE the File controls belong: a
           poster hides the panel they live in, so without re-homing them
           they would disappear with it. Re-run the placement, then the
           bar re-decides whether it has earned its row. */
        syncTopBar();
        /* switching to a portrait poster moves the toolbar to the side
           (unless you have already chosen otherwise) */
        applySideRibbon();
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
    if(a.k==='arrow') return a.nohead?'Line':'Arrow';
    if(a.k==='draw') return 'Drawing';
    if(a.k==='rect') return 'Shape — '+(a.shape||'box');
    return a.k;
  }
  /* ---- one pane open at a time, and the stage makes room for it -------
     Every pane is an .selpane in the stage wrapper. Rather than have each
     one remember to tell the stage, ask the DOM: if any is open, dock.
     Called after anything that opens or closes one. */
  function syncPaneDock(){
    /* Only a pane still in its DEFAULT place is docked. wirePane sets
       right:auto the moment you drag one, and a pane you have deliberately
       moved somewhere else is one you have chosen to float — reserving a
       strip on the right for it would leave a gap beside nothing
       (2026-08-20). Drag it back to the edge, or reopen it, to re-dock. */
    var open=$$('.selpane',deckEl).some(function(p){
      return !p.hidden&&p.style.right!=='auto';});
    deckEl.classList.toggle('pane-open',open&&mode==='edit');
    /* the page is fitted to the stage's width, so the stage changing size
       has to re-fit it — otherwise the slide keeps the size it had when
       the pane was closed and the pane lands on top of it after all */
    applyZoom();
  }
  /* Five panes are opened from eight places between them, and one of them
     forgetting to dock would put us straight back to a pane covering the
     page. So WATCH the attribute instead of trusting the call sites. */
  (function(){
    if(!window.MutationObserver) return;
    var t=null;
    var ob=new MutationObserver(function(){
      clearTimeout(t);t=setTimeout(syncPaneDock,0);
    });
    $$('.selpane',deckEl).forEach(function(p){
      ob.observe(p,{attributes:true,attributeFilter:['hidden']});});
  })();
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
    function rowEl(a,i){
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
      var dp2=document.createElement('button');
      dp2.className='sp-act';dp2.type='button';dp2.innerHTML='&#10697;';
      dp2.title='Duplicate';
      dp2.addEventListener('click',function(e){
        e.stopPropagation();dupAnnots([i],false);});
      r.appendChild(dp2);
      r.addEventListener('click',function(ev){
        if(!liveAnnot(i)){renderSelPane();return;}
        var l=stage.querySelector('.annot-layer');
        /* ctrl-click builds a multi-selection right in the pane, which
           is what makes Group up in the toolbar reachable from here */
        if(l) selectAnnot(l,i,ev.ctrlKey||ev.metaKey);
        renderSelPane();
      });
      return r;
    }
    /* pane header actions: group/ungroup/duplicate act on the pane's
       selection, so organising happens where you are looking
       (2026-08-18, user: "create folders and group things ...
       duplicate") */
    var bar2=document.createElement('div');bar2.className='sp-tools';
    var selN=selSet.filter(function(i){return typeof i==='number';});
    function tool(label,title,on,fn){
      var b=document.createElement('button');
      b.className='dbtn sp-tool';b.textContent=label;b.title=title;
      b.disabled=!on;
      b.addEventListener('click',function(e){e.stopPropagation();fn();});
      bar2.appendChild(b);
    }
    tool('Group','Group the selected items (Ctrl+G)',selN.length>=2,
      function(){groupSel();renderSelPane();});
    var inGrp=typeof selAnnot==='number'&&ann[selAnnot]
      &&ann[selAnnot].grp!=null;
    tool('Ungroup','Ungroup (Ctrl+Shift+G)',inGrp,
      function(){ungroupSel();renderSelPane();});
    tool('\u29c9 Duplicate','Duplicate the selected items',selN.length>=1,
      function(){dupAnnots(selN,false);});
    list.appendChild(bar2);
    /* GROUPS come first, as folders: a coloured chip, a name you can
       change, and the members indented under it */
    var seen={},orderG=[];
    ann.forEach(function(a2){
      if(a2&&a2.grp!=null&&!seen[a2.grp]){
        seen[a2.grp]=1;orderG.push(a2.grp);}
    });
    orderG.forEach(function(g){
      var meta=(s.grpmeta||{})[g]||{};
      var f=document.createElement('div');f.className='sp-folder';
      var chip=document.createElement('button');
      chip.className='sp-gcol';chip.type='button';
      chip.style.background=meta.color||GRP_COLORS[0];
      chip.title='Group colour — click to change';
      chip.addEventListener('click',function(e){
        e.stopPropagation();
        var cur2=GRP_COLORS.indexOf(meta.color||GRP_COLORS[0]);
        grpMeta(s,g).color=GRP_COLORS[(cur2+1)%GRP_COLORS.length];
        markDirty();renderSelPane();
      });
      f.appendChild(chip);
      var nm=document.createElement('span');nm.className='sp-t sp-gname';
      nm.textContent=meta.name||('Group '+g);
      nm.title='Double-click to rename';
      nm.addEventListener('dblclick',function(){
        var v=prompt('Group name:',meta.name||('Group '+g));
        if(v!=null){grpMeta(s,g).name=v.trim();markDirty();renderSelPane();}
      });
      f.appendChild(nm);
      var rn=document.createElement('button');
      rn.className='sp-act';rn.type='button';rn.innerHTML='&#9998;';
      rn.title='Rename this group';
      rn.addEventListener('click',function(e){
        e.stopPropagation();
        var v=prompt('Group name:',meta.name||('Group '+g));
        if(v!=null){grpMeta(s,g).name=v.trim();markDirty();renderSelPane();}
      });
      f.appendChild(rn);
      var dp=document.createElement('button');
      dp.className='sp-act';dp.type='button';dp.innerHTML='&#10697;';
      dp.title='Duplicate the whole group';
      dp.addEventListener('click',function(e){
        e.stopPropagation();
        var idxs=[];ann.forEach(function(a2,i2){
          if(a2&&a2.grp===g) idxs.push(i2);});
        dupAnnots(idxs,true,g);
      });
      f.appendChild(dp);
      f.addEventListener('click',function(){
        var l=stage.querySelector('.annot-layer');
        var first=null;
        ann.forEach(function(a2,i2){
          if(first==null&&a2&&a2.grp===g) first=i2;});
        if(l&&first!=null) selectAnnot(l,first);
        renderSelPane();
      });
      list.appendChild(f);
      for(var i2=ann.length-1;i2>=0;i2--)
        if(ann[i2]&&ann[i2].grp===g){
          var r2=rowEl(ann[i2],i2);
          r2.classList.add('sp-ing');
          r2.style.borderLeftColor=meta.color||GRP_COLORS[0];
          list.appendChild(r2);
        }
    });
    for(var i=ann.length-1;i>=0;i--)
      if(!ann[i]||ann[i].grp==null) list.appendChild(rowEl(ann[i],i));
  }
  var GRP_COLORS=['#39a9c0','#ff6b57','#f0a848','#46a892','#a07be0',
    '#8ba0b2'];
  function grpMeta(s,g){
    s.grpmeta=s.grpmeta||{};
    return s.grpmeta[g]=s.grpmeta[g]||{};
  }
  /* duplicate items; newGrp gives the copies a fresh group id and copies
     the folder's name ("... copy") and colour with them */
  function dupAnnots(idxs,newGrp,srcGrp){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var gid=newGrp?nextGrp(s):null,added=[];
    idxs.forEach(function(i){
      var a=s.annots[i]; if(!a) return;
      var cp=JSON.parse(JSON.stringify(a));
      if(cp.k==='arrow'){cp.x1+=2;cp.y1+=2;cp.x2+=2;cp.y2+=2;
        delete cp.c1;delete cp.c2;}
      else {cp.x=Math.min(96,(cp.x||0)+2);cp.y=Math.min(96,(cp.y||0)+2);}
      if(gid!=null) cp.grp=gid;
      s.annots.push(cp);added.push(s.annots.length-1);
    });
    if(gid!=null&&srcGrp!=null&&s.grpmeta&&s.grpmeta[srcGrp]){
      var m2=JSON.parse(JSON.stringify(s.grpmeta[srcGrp]));
      if(m2.name) m2.name+=' copy';
      s.grpmeta[gid]=m2;
    }
    if(!added.length) return;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,added[added.length-1]);}
    renderSelPane();
  }
  /* ---- panes are yours to place: drag by the header, resize by the
     corner, and both are remembered per pane across sessions
     (2026-08-18, user: "detach them and drag them around and re-size —
     this then gets remembered for when you re-open"). ---- */
  var PANE_KEY='jv-panes';
  function paneStore(){
    try{return JSON.parse(lsGet(PANE_KEY)||'{}');}catch(e){return {};}
  }
  function paneSave(id,box){
    var st=paneStore();st[id]=box;lsSet(PANE_KEY,JSON.stringify(st));
  }
  function wirePane(pane){
    if(!pane||pane._wired) return;pane._wired=1;
    var id=pane.id,h=pane.querySelector('.selpane-h');
    function place(box){
      /* moving detaches the pane from its docked right/bottom anchors */
      pane.style.right='auto';pane.style.bottom='auto';
      var host=pane.offsetParent;
      var hw=host?host.clientWidth:innerWidth;
      var hh=host?host.clientHeight:innerHeight;
      pane.style.left=Math.max(0,Math.min(hw-80,box.x))+'px';
      pane.style.top=Math.max(0,Math.min(hh-60,box.y))+'px';
      if(box.w) pane.style.width=Math.min(hw,box.w)+'px';
      if(box.h) pane.style.height=Math.min(hh,box.h)+'px';
    }
    var saved=paneStore()[id];
    if(saved&&typeof saved.x==='number') place(saved);
    if(h){
      h.style.cursor='move';
      h.addEventListener('pointerdown',function(ev){
        if(ev.target.closest('button')) return;
        ev.preventDefault();
        var hostR=pane.offsetParent
          ?pane.offsetParent.getBoundingClientRect()
          :{left:0,top:0};   /* a fixed pane drags in viewport space */
        var r=pane.getBoundingClientRect();
        var dx=ev.clientX-r.left,dy=ev.clientY-r.top;
        function mv(e2){
          place({x:e2.clientX-hostR.left-dx,y:e2.clientY-hostR.top-dy});
        }
        function up(){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
          paneSave(id,{x:pane.offsetLeft,y:pane.offsetTop,
            w:pane.offsetWidth,h:pane.offsetHeight});
        }
        document.addEventListener('pointermove',mv);
        document.addEventListener('pointerup',up);
      });
    }
    /* the native resize grip changes width/height; remember those too */
    if(window.ResizeObserver) new ResizeObserver(function(){
      if(pane.hidden||!pane.offsetParent) return;
      var st=paneStore()[id];
      if(st&&Math.abs((st.w||0)-pane.offsetWidth)<3
        &&Math.abs((st.h||0)-pane.offsetHeight)<3) return;
      paneSave(id,{x:pane.offsetLeft,y:pane.offsetTop,
        w:pane.offsetWidth,h:pane.offsetHeight});
    }).observe(pane);
  }
  ['selpane','animpane','verpane','preflight','varspane']
    .forEach(function(id){wirePane(document.getElementById(id));});
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
      /* this menu is 442px wide; opened from a toolbar standing on the
         right-hand edge it ran straight off the screen (2026-08-07,
         user). floatMenu clamps it into the viewport. */
      if(willOpen) floatMenu(lb,lm);
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
        /* the name you gave a poster version. Not carrying it here meant
           it survived until the next load and then silently became
           "empty slide" again (2026-08-10) */
        if(typeof s.label==='string'&&s.label) o.label=s.label;
        /* per-slide look + pane organisation. A field not listed here
           silently dies on the next load — exactly what happened to
           `label` before it was added (2026-08-10) */
        if(typeof s.bg==='string'&&s.bg) o.bg=s.bg;
        if(s.border) o.border=JSON.parse(JSON.stringify(s.border));
        if(s.grpmeta) o.grpmeta=JSON.parse(JSON.stringify(s.grpmeta));
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
    /* the page background survives every load path — normPres dropping
       it turned saved white posters navy again (2026-08-05 review) */
    if(typeof p.pageBg==='string'&&p.pageBg) out.pageBg=p.pageBg;
    /* trim marks are a print decision and were being forgotten on every
       reload, because nothing carried them across (2026-08-10) */
    if(p.cropMarks) out.cropMarks=1;
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
  /* the readout is a SAVE BUTTON when saves only live in this browser —
     it used to open the save-to-file picker, which is not what a thing
     that says "autosaved" invites you to do (2026-08-19, user: "clicking
     the autosave button should save") */
  function markSaveClickable(el){
    var toBrowser=(saveTarget!=='file'&&saveTarget!=='project');
    el.classList.toggle('clickable',toBrowser);
    el.title=toBrowser
      ?'Saves stay in this browser. Click to save now — use the ▾ beside '
        +'Save to keep a .junoview.html file on your computer instead.'
      :'';
  }
  function whereSaved(){
    if(saveTarget==='project') return 'project';
    if(saveTarget==='file') return fileName||'file';
    return 'browser';
  }
  /* ---- the name, in the title bar ------------------------------------
     Rename used to be a File-menu item that un-hid an input living inside
     a display:none block, so in the ordinary editing flow it did nothing
     visible at all. The name now sits in the middle of the top bar the
     way a title bar shows a document's name, and you rename it by
     clicking it. It commits on Enter or blur, never per keystroke. */
  function syncQatName(){
    var b=$('#qat-name');
    if(!b) return;
    var nm=(pres&&pres.name)||'';
    if(b.textContent!==nm) b.textContent=nm;
    b.title=nm?('“'+nm+'” — click to rename'):'Click to name this';
  }
  function startQatRename(){
    var b=$('#qat-name'),inp=$('#qat-nameedit');
    if(!b||!inp) return;
    inp.value=(pres&&pres.name)||'';
    b.hidden=true;inp.hidden=false;
    inp.focus();inp.select();
    var done=false;
    function commit(ok){
      if(done) return; done=true;
      inp.hidden=true;b.hidden=false;
      var v=inp.value.trim();
      if(ok&&v&&v!==pres.name){renamePresentation(v);}
      syncQatName();
    }
    inp.addEventListener('blur',function(){commit(true);},{once:true});
    inp.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();commit(true);}
      else if(e.key==='Escape'){e.preventDefault();commit(false);}
    });
  }
  function status(){
    syncQatName();
    /* the bar names what it belongs to; for a poster this is the only
       place the name is shown, since the panel that normally carries it
       is hidden */
    var ti=$('#deck-title');
    if(ti) ti.textContent=(mode==='edit'&&pres&&pres.name)?pres.name:'';
    var el=$('#deck-status');
    var auto=APP.mode==='app'
      &&(typeof autosaveOn==='undefined'||autosaveOn);
    if(source==='draft'){
      /* web/static Save writes to the browser but keeps source='draft';
         show a plain 'saved' — the Save button tooltip explains where */
      if(APP.mode!=='app'&&saveKind==='manual'&&saveStamp){
        el.textContent='saved to '+whereSaved()+' · '+fmtT(saveStamp);
        el.className='deck-status saved';
        markSaveClickable(el);   /* this branch returns before the shared
                                    tail below would run */
        return;
      }
      el.textContent=auto?'unsaved — saving…':'unsaved';
    } else if(source==='saved'){
      /* WHERE, not just when: "autosaved · 12:18" answered the question
         nobody asked and skipped the one that matters — into the browser?
         the project? which file? (2026-08-18, user: "in the little
         autosave button, say where saved to") */
      el.textContent=saveStamp
        ?((saveKind==='auto'?'autosaved to ':'saved to ')+whereSaved()
          +' · '+fmtT(saveStamp))
        :'saved to '+whereSaved();
    } else el.textContent='';

    el.className='deck-status '+source;
    /* AFTER the className assignment, which would wipe the class */
    markSaveClickable(el);
    /* the readout RENAMES ITSELF between fits ("" -> "autosaved to
       presentation.junoview.html · 12:41"), and a wider readout after
       the last fit is exactly how it ended up printed across other
       controls (2026-08-18, user: "the autosave button hides the color
       options"). Any text change re-judges the bar, which drops the
       readout whole when the row is tight. */
    if(el.textContent!==el._lastTxt){
      el._lastTxt=el.textContent;
      requestAnimationFrame(fitEditRibbon);
    }
    if(!el.classList.contains('clickable')) el.title=el.textContent;
  }
  (function(){
    var el=$('#deck-status');
    if(el) el.addEventListener('click',function(){
      if(!el.classList.contains('clickable')) return;
      var sb=$('#dc-save'); if(sb) sb.click();
    });
  })();
  function markDirty(){
    source='draft';
    saveKind='';
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
    status();
    scheduleAutosave();
    histPush();
    renderSelPane();   /* keep the Objects pane in step (no-op if closed) */
    refreshThumb(cur);
  }
  /* ---- keep the CURRENT slide's thumbnail live -------------------------
     The strip was only rebuilt by refresh() — a slide change, a layout, a
     reorder. Editing the slide you are looking at never touched it, so its
     thumbnail showed the slide as it was when you arrived and every slide
     you had worked on looked wrong. That is the other half of "thumbnails
     do now show text, or anything else for that matter" (2026-08-20,
     user): the first half was miniDiagram drawing only cells.
     Just the one row, and debounced: renderFilm() rebuilds every row with
     its drag wiring, which is far too much to do on each edit. */
  var thumbT=null;
  function refreshThumb(i){
    clearTimeout(thumbT);
    thumbT=setTimeout(function(){
      var s=pres.slides[i]; if(!s) return;
      var row=$('#film-list .film-row[data-idx="'+i+'"]');
      if(!row) return;
      var old=row.querySelector('.mini-diagram');
      /* the CURRENT row in notebook view is the big inline pane editor,
         not a thumbnail — leave that alone */
      if(old&&old.parentNode) old.parentNode.replaceChild(miniDiagram(s),old);
      var tt=row.querySelector('.film-t');
      if(tt) tt.textContent=slideTitle(s);
    },140);
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

  /* ---- line styles, arrow heads, gradients ---------------------------
     One table per thing, each carrying BOTH how it draws on the canvas
     (SVG) and what it becomes in PowerPoint (OOXML) — the two cannot
     drift, which is the only way "the poster and the .pptx look the
     same" stays true as this list grows. */
  var LINE_STYLES=[
    {id:'solid',label:'Solid',dash:'',ppt:'solid'},
    {id:'dash',label:'Dashed',dash:'9 7',ppt:'dash'},
    {id:'dot',label:'Dotted',dash:'1 6',ppt:'sysDot'},
    {id:'dashdot',label:'Dash-dot',dash:'12 5 2 5',ppt:'dashDot'},
    {id:'lgdash',label:'Long dash',dash:'20 8',ppt:'lgDash'}];
  var LINE_DASH={},LINE_PPT={};
  LINE_STYLES.forEach(function(s){
    LINE_DASH[s.id]=s.dash;LINE_PPT[s.id]=s.ppt;});
  /* an older poster stored a boolean `dash`; read it as the dashed style */
  function lineStyle(a){
    return a.style||(a.dash?'dash':'solid');
  }
  function dashFor(a){return LINE_DASH[lineStyle(a)]||'';}

  /* ---- line weight, in the same currency as everything else ----------
     Every dimension on a page is page-relative: x/y/w/h are percentages,
     text is a percentage of page height resolved at render time (fontPx).
     Line weight was the one exception — `a.sw` went straight out as CSS
     px — so it was the only thing that did not move when the page did.
     Measured: zooming 3.74x grew the text 3.75x and the stroke 1.00x, so
     a line fell from 12.7% of the text height to 3.4% (2026-08-10, user:
     "as you zoom in and out the line stays the same thick on the screen
     whilst the presentation gets smaller").

     `a.sw` now means "pixels on a page 720px tall". 720 is not arbitrary:
     it is the height the 16:9 print page has always been built at, and it
     is within 0.3% of a true 191mm at 96dpi. So every number already on
     disk keeps exactly the weight it has today on a slide, and the same
     number finally means something on a poster, where 3px of ink on a
     1189mm sheet was a 0.8mm hairline beside 31mm text. */
  var SW_REF_H=720;
  var SW_DEFAULT=3;
  function swOf(a){return (a&&a.sw!=null)?a.sw:SW_DEFAULT;}
  function pageScale(layer){
    var h=layer?(layer.getBoundingClientRect().height||0):0;
    return (h||SW_REF_H)/SW_REF_H;
  }
  function strokePx(a,layer){
    /* the same 0.5px guard fontPx uses: it only stops a collapse to zero,
       it is not a legibility floor */
    return Math.max(0.5,swOf(a)*pageScale(layer));
  }
  /* a dash pattern is measured in the same units as the stroke it dashes,
     so it has to scale with it. Left unscaled, a 9px gap on a stroke that
     had shrunk to 0.5px read as a row of dots, and a different pattern at
     every zoom level. */
  function dashPx(a,layer){
    var d=dashFor(a); if(!d) return '';
    var k=pageScale(layer);
    return d.split(' ').map(function(n){
      return (parseFloat(n)*k).toFixed(2);}).join(' ');
  }
  /* what this weight will actually print, for the controls and preflight */
  function swMm(a,pg){
    return swOf(a)/SW_REF_H*((pg||pageOf()).mm[1]||191);
  }

  /* Head shapes are drawn in a 10x10 marker box. `ppt` is the OOXML
     head type; PowerPoint has no "bar", so it degrades to none there and
     the shape says so in its tooltip. */
  var HEADS=[
    {id:'none',label:'None',ppt:'none'},
    {id:'triangle',label:'Triangle',ppt:'triangle',
     path:'M0 0 L10 5 L0 10 z'},
    {id:'stealth',label:'Stealth',ppt:'stealth',
     path:'M0 0 L10 5 L0 10 L3 5 z'},
    {id:'open',label:'Open',ppt:'arrow',
     path:'M0 0 L10 5 L0 10',open:1},
    {id:'diamond',label:'Diamond',ppt:'diamond',
     path:'M0 5 L5 0 L10 5 L5 10 z'},
    {id:'oval',label:'Round',ppt:'oval',
     path:'M5 0 A5 5 0 1 1 4.99 0 z'},
    {id:'bar',label:'Bar',ppt:'none',
     path:'M9 0 L9 10',open:1}];
  var HEAD_BY={};HEADS.forEach(function(h){HEAD_BY[h.id]=h;});
  var HEAD_SIZES=[
    {id:'sm',label:'Small',mul:4.5,ppt:'sm'},
    {id:'md',label:'Medium',mul:6.5,ppt:'med'},
    {id:'lg',label:'Large',mul:9.5,ppt:'lg'},
    {id:'xl',label:'Huge',mul:13,ppt:'lg'}];
  var HEADSZ_BY={};HEAD_SIZES.forEach(function(s){HEADSZ_BY[s.id]=s;});
  /* the end head: older posters used `nohead` to mean "this is a line" */
  function headEnd(a){
    if(a.head!=null) return a.head;
    return a.nohead?'none':'triangle';
  }
  function headStart(a){return a.tail||'none';}
  function headSize(a){return HEADSZ_BY[a.hsz]||HEADSZ_BY.md;}

  /* ---- attached endpoints --------------------------------------------
     An endpoint can be pinned to an item (`a.c1`/`a.c2` = {i:index}).
     Its coordinates are then DERIVED at render time from where that item
     currently is, which is what makes the arrow follow it around. The
     stored x/y stay as a fallback for when the target goes away. */
  function edgePoint(r,tox,toy){
    /* where a line from the rect's centre towards (tox,toy) leaves it —
       so the arrow stops at the border instead of burying its head in
       the middle of the figure */
    var cx=(r.l+r.r)/2,cy=(r.t+r.b)/2;
    var dx=tox-cx,dy=toy-cy;
    if(!dx&&!dy) return {x:cx,y:cy};
    var hw=(r.r-r.l)/2,hh=(r.b-r.t)/2;
    var sx=dx?hw/Math.abs(dx):Infinity,sy=dy?hh/Math.abs(dy):Infinity;
    var t=Math.min(sx,sy);
    return {x:cx+dx*t,y:cy+dy*t};
  }
  function tiedRect(layer,s,c){
    if(!c||typeof c.i!=='number') return null;
    var t=(s.annots||[])[c.i];
    if(!t||t.hide||t.k==='arrow') return null;
    return annotRectPct(layer,s,c.i);
  }
  function arrowEnds(layer,s,a,idx){
    var e={x1:a.x1,y1:a.y1,x2:a.x2,y2:a.y2};
    var r1=tiedRect(layer,s,a.c1),r2=tiedRect(layer,s,a.c2);
    /* aim each attached end at the OTHER end, so both slide around their
       item's border as either one moves */
    var far1=r2?{x:(r2.l+r2.r)/2,y:(r2.t+r2.b)/2}:{x:a.x2,y:a.y2};
    var far2=r1?{x:(r1.l+r1.r)/2,y:(r1.t+r1.b)/2}:{x:a.x1,y:a.y1};
    if(r1){var p1=edgePoint(r1,far1.x,far1.y);e.x1=p1.x;e.y1=p1.y;}
    if(r2){var p2=edgePoint(r2,far2.x,far2.y);e.x2=p2.x;e.y2=p2.y;}
    return e;
  }
  /* straight, curved (quadratic through an offset midpoint) or elbowed.
     Coordinates are PERCENTAGES of the page, and must be converted to
     pixels here: <line> accepted x1="20%", but path data has no units —
     "M20 50" means 20px,50px, so every line and arrow was drawn in a
     60-pixel stub in the top-left corner (2026-08-07, user: "arrow just
     appears in the top left"). Scaling here rather than with a viewBox
     keeps stroke width and arrowheads circular instead of stretched. */
  function arrowPath(e,a,W,H){
    W=W||100;H=H||100;
    var x1=e.x1/100*W,y1=e.y1/100*H,x2=e.x2/100*W,y2=e.y2/100*H;
    var bend=a.bend||'none';
    if(bend==='h')      /* out sideways first, then down/up */
      return 'M'+x1+' '+y1+' L'+((x1+x2)/2)+' '+y1
        +' L'+((x1+x2)/2)+' '+y2+' L'+x2+' '+y2;
    if(bend==='v')
      return 'M'+x1+' '+y1+' L'+x1+' '+((y1+y2)/2)
        +' L'+x2+' '+((y1+y2)/2)+' L'+x2+' '+y2;
    var cv=+a.curve||0;
    if(!cv) return 'M'+x1+' '+y1+' L'+x2+' '+y2;
    /* bow the line out perpendicular to itself; `curve` is a percentage of
       the page, so it scales to pixels like the endpoints do */
    var mx=(x1+x2)/2,my=(y1+y2)/2;
    var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
    var nx=-dy/len,ny=dx/len;
    var bow=cv/100*Math.min(W,H);
    return 'M'+x1+' '+y1+' Q'+(mx+nx*bow)+' '+(my+ny*bow)+' '+x2+' '+y2;
  }
  /* menu order + short labels */
  var SHAPE_LIST=[
    ['rect','Rectangle'],['ellipse','Ellipse'],['triangle','Triangle'],
    ['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],
    ['star','Star'],['cross','Plus'],['arrow','Arrow'],['heart','Heart'],
    ['cloud','Cloud'],['bubble','Speech'],['lightning','Bolt'],
    ['exclaim','Exclaim'],['question','Question']];
  /* the fill a shape actually paints: none, a tint of its own line
     colour (the original behaviour, kept for existing posters), a solid
     colour, or a gradient — linear at an angle, or radiating from the
     centre */
  function cssFill(a,col){
    if(!a.fill&&!a.grad) return 'transparent';
    if(a.grad){
      var g=a.grad,c1=g.a||col,c2=g.b||'transparent';
      return g.type==='radial'
        ?('radial-gradient(circle at 50% 50%, '+c1+', '+c2+')')
        :('linear-gradient('+((+g.ang||0)+90)+'deg, '+c1+', '+c2+')');
    }
    if(a.fillc) return a.fillc;
    return shapeFill(col,0x26/255);
  }
  /* `sw` arrives already resolved to screen pixels by strokePx, and the
     dash has to be resolved against the same page so the two agree */
  /* ---- FREEHAND ------------------------------------------------------
     A drawn stroke is stored the way a shape is — a box in page
     percentages — with its points normalised to 0..1 INSIDE that box. So
     moving, resizing, rotating, opacity, lock, hide, the Objects pane and
     the selection handles all work on it without knowing it exists: they
     only ever touch x/y/w/h. Keeping raw page coordinates instead would
     have meant a special case in every one of those.
     Catmull-Rom through the points, converted to cubics: a hand-drawn
     line has to read as a curve, not as the polygon the mouse reported. */
  function drawPathD(pts){
    if(!pts||!pts.length) return '';
    var P=pts.map(function(q){return [q[0]*100,q[1]*100];});
    var f=function(n){return (Math.round(n*100)/100);};
    if(P.length===1) return 'M'+f(P[0][0])+' '+f(P[0][1])+'l0 0';
    var d='M'+f(P[0][0])+' '+f(P[0][1]);
    for(var i=0;i<P.length-1;i++){
      var p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||P[i+1];
      d+='C'+f(p1[0]+(p2[0]-p0[0])/6)+' '+f(p1[1]+(p2[1]-p0[1])/6)
        +','+f(p2[0]-(p3[0]-p1[0])/6)+' '+f(p2[1]-(p3[1]-p1[1])/6)
        +','+f(p2[0])+' '+f(p2[1]);
    }
    return d;
  }
  function drawFreeSvg(a,layer){
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','an-shape-svg');
    svg.setAttribute('viewBox','0 0 100 100');
    /* stretched to the box like a shape, so the stroke needs the same
       non-scaling-stroke or it would thicken as you widen the drawing */
    svg.setAttribute('preserveAspectRatio','none');
    var p=document.createElementNS(SVGNS,'path');
    p.setAttribute('d',drawPathD(a.pts));
    p.setAttribute('fill','none');
    p.setAttribute('stroke',a.color||'#ff6b57');
    p.setAttribute('stroke-width',strokePx(a,layer));
    p.setAttribute('vector-effect','non-scaling-stroke');
    p.setAttribute('stroke-linecap','round');
    p.setAttribute('stroke-linejoin','round');
    var dsh=dashPx(a,layer);
    if(dsh) p.setAttribute('stroke-dasharray',dsh);
    svg.appendChild(p);
    return svg;
  }
  function drawShapeSvg(shp,col,sw,a,idx,layer){
    var dash=dashPx(a,layer);
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
      var fillVal='none';
      if(a.grad){
        /* SVG cannot take a CSS gradient string, so the same gradient is
           declared as a paint server and referenced */
        var gid='an-grad-'+(idx==null?'x':idx);
        var gd=document.createElementNS(SVGNS,'defs');
        var g=a.grad;
        var gel=document.createElementNS(SVGNS,
          g.type==='radial'?'radialGradient':'linearGradient');
        gel.setAttribute('id',gid);
        if(g.type!=='radial'){
          var rad=((+g.ang||0))*Math.PI/180;
          gel.setAttribute('x1',(50-50*Math.cos(rad))+'%');
          gel.setAttribute('y1',(50-50*Math.sin(rad))+'%');
          gel.setAttribute('x2',(50+50*Math.cos(rad))+'%');
          gel.setAttribute('y2',(50+50*Math.sin(rad))+'%');
        }
        [[0,g.a||col],[1,g.b||'transparent']].forEach(function(st){
          var s2=document.createElementNS(SVGNS,'stop');
          s2.setAttribute('offset',st[0]);
          s2.setAttribute('stop-color',st[1]);
          gel.appendChild(s2);
        });
        gd.appendChild(gel);svg.appendChild(gd);
        fillVal='url(#'+gid+')';
      } else if(a.fill){
        fillVal=a.fillc||shapeFill(col,0x2b/255);
      }
      p.setAttribute('fill',fillVal);
      p.setAttribute('stroke',col);
      p.setAttribute('stroke-width',sw);
      /* the shape SVG is preserveAspectRatio="none", so without this the
         outline would stretch with the box instead of staying round */
      p.setAttribute('vector-effect','non-scaling-stroke');
      p.setAttribute('stroke-linejoin','round');
      if(dash) p.setAttribute('stroke-dasharray',dash);
      svg.appendChild(p);
    }
    return svg;
  }
  /* ---- text on a curved baseline -------------------------------------
     `a.arc` bows the baseline: positive arches up, negative sags down,
     and the magnitude is how far in percent of the box's width. The flat
     span stays in the DOM (hidden) because it is what carries selection,
     editing and the stored text — the SVG is a rendering of it. */
  function applyTextArc(box,span,a,idx){
    var r=box.getBoundingClientRect();
    var w=r.width,h=r.height;
    if(!w||!h) return;
    var txt=String(a.text||'');
    if(!txt.trim()) return;
    var cs=window.getComputedStyle(span);
    var fs=parseFloat(cs.fontSize)||16;
    var arc=Math.max(-95,Math.min(95,+a.arc||0));
    /* The bow is bounded by the box's OWN height, not its width: scaled
       off the width, an arch on a wide title peaked hundreds of px above
       a one-line box and drew itself off the page. The box is given room
       to hold the arch (see the min-height set before measuring), so a
       deeper curve makes the box taller rather than escaping it. */
    var pad=fs*0.3;
    var avail=Math.max(0,h-fs-2*pad);
    var bow=avail*Math.min(1,Math.abs(arc)/55)*(arc>=0?1:-1);
    var baseY=(arc>=0)?(h-pad):(pad+fs*0.85);
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','an-arcsvg');
    svg.setAttribute('viewBox','0 0 '+w+' '+h);
    svg.setAttribute('width',w);svg.setAttribute('height',h);
    var defs=document.createElementNS(SVGNS,'defs');
    var pid='an-arcp-'+idx;
    var p=document.createElementNS(SVGNS,'path');
    p.setAttribute('id',pid);
    p.setAttribute('fill','none');
    p.setAttribute('d','M '+pad+' '+baseY+' Q '+(w/2)+' '+(baseY-2*bow)
      +' '+(w-pad)+' '+baseY);
    defs.appendChild(p);svg.appendChild(defs);
    var t=document.createElementNS(SVGNS,'text');
    t.setAttribute('font-size',fs);
    t.setAttribute('font-family',cs.fontFamily);
    t.setAttribute('font-weight',cs.fontWeight);
    t.setAttribute('font-style',cs.fontStyle);
    t.setAttribute('fill',cs.color);
    var tp=document.createElementNS(SVGNS,'textPath');
    tp.setAttribute('href','#'+pid);
    tp.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','#'+pid);
    tp.setAttribute('startOffset','50%');
    tp.setAttribute('text-anchor','middle');
    tp.textContent=txt.replace(/\n+/g,' ');
    t.appendChild(tp);svg.appendChild(t);
    box.classList.add('an-arced');
    box.appendChild(svg);
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
  /* ---- print-resolution early warning (2026-08-04): a default-dpi
     matplotlib PNG stretched over a poster column prints fuzzy, and
     nobody finds out until the poster hall. On POSTER pages, any raster
     figure whose effective print density lands under 150dpi gets a
     small warning chip with the fix in its tooltip. SVG figures are
     vector — never flagged. ---- */
  function checkFigDpi(slideEl){
    var pg=pageOf(); if(!pg.poster||!pg.mm) return;
    $$('.an-cell',slideEl).forEach(function(cell){
      var old=cell.querySelector('.dpi-warn'); if(old) old.remove();
      var img=cell.querySelector('img'); if(!img) return;
      if(/^data:image\/svg/i.test(img.src||'')) return;
      function judge(){
        if(!document.contains(cell)||!img.naturalWidth) return;
        var sr=slideEl.getBoundingClientRect();
        /* the IMAGE's own drawn rect, not the frame's: a letterboxed
           figure prints far narrower than its cell, and judging the
           cell flagged sharp figures (2026-08-05 review) */
        var ir=img.getBoundingClientRect();
        var cr=ir.width?ir:cell.getBoundingClientRect();
        if(!sr.width||!cr.width) return;
        var mmw=cr.width/sr.width*pg.mm[0];
        var dpi=Math.round(img.naturalWidth/(mmw/25.4));
        if(!dpi||dpi>=150) return;
        var w=document.createElement('span');
        w.className='dpi-warn';
        w.textContent='⚠ ≈'+dpi+' dpi';
        w.title='This figure will print SOFT at this size (≈'+dpi
          +' dpi; aim for 200+). In the notebook, re-save it sharper — '
          +'savefig(dpi=300) — or emit vector SVG: '
          +"%config InlineBackend.figure_formats=['svg'] — "
          +'then refresh notebooks.';
        cell.appendChild(w);
      }
      if(img.complete) judge();
      else img.addEventListener('load',judge,{once:true});
    });
  }
  function renderSlide(){
    var s=pres.slides[cur];
    applyPageBg();          /* this slide may carry its own background */
    stage.innerHTML='';
    vGroups=[];
    traceSel=0;   /* each slide starts on its first plot's trace */
    closeVFull();
    if(!s&&mode==='edit'){
      /* An editor opens on a blank PAGE, not on a notice explaining that
         there is no page. "No slides yet" also silently disabled every
         layout button, because applyLayout bails when there is nothing to
         apply it to (2026-08-07, user). Making the page real fixes both. */
      pres.slides=pres.slides||[];
      pres.slides.push(emptySlide());
      cur=pres.slides.length-1;
      s=pres.slides[cur];
      markDirty();
      renderFilm();
    }
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
      applyZoom();   /* every mode: playback letterboxes to the page too */
      attachAnnots(slideEl,s);
      typeset(slideEl);
      if(mode==='edit') checkFigDpi(slideEl);
      /* the annot layer exists only now, and the rulers shade the
         selection's extent from it */
      if(mode==='edit') syncGuides();
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
  /* One table, three consumers: the picker, the canvas CSS and the .pptx
     writer (which needs a REAL family name, not a CSS variable). A poster
     usually has to obey a departmental typeface, so the list goes beyond
     the generic five — and `a.font` may also be any font name you type,
     which falls through to the browser and to PowerPoint unchanged. */
  var FONTS=[
    {id:'sans',label:'Sans',css:'var(--sans)',ppt:'Calibri'},
    {id:'serif',label:'Serif',css:'var(--serif)',ppt:'Georgia'},
    {id:'mono',label:'Mono',css:'var(--mono)',ppt:'Consolas'},
    {id:'system',label:'System',css:'system-ui,sans-serif',ppt:'Calibri'},
    {id:'arial',label:'Arial',css:'Arial,Helvetica,sans-serif',ppt:'Arial'},
    {id:'helvetica',label:'Helvetica',
      css:'Helvetica,Arial,sans-serif',ppt:'Helvetica'},
    {id:'calibri',label:'Calibri',css:'Calibri,sans-serif',ppt:'Calibri'},
    {id:'verdana',label:'Verdana',css:'Verdana,Geneva,sans-serif',
      ppt:'Verdana'},
    {id:'tahoma',label:'Tahoma',css:'Tahoma,Geneva,sans-serif',ppt:'Tahoma'},
    {id:'trebuchet',label:'Trebuchet',
      css:'"Trebuchet MS",sans-serif',ppt:'Trebuchet MS'},
    {id:'times',label:'Times',css:'"Times New Roman",Times,serif',
      ppt:'Times New Roman'},
    {id:'georgia',label:'Georgia',css:'Georgia,serif',ppt:'Georgia'},
    {id:'cambria',label:'Cambria',css:'Cambria,Georgia,serif',ppt:'Cambria'},
    {id:'garamond',label:'Garamond',
      css:'Garamond,"EB Garamond",serif',ppt:'Garamond'},
    {id:'hand',label:'Hand',css:"'Segoe Print','Comic Sans MS',cursive",
      ppt:'Segoe Print'}];
  var FONTMAP={},FONTPPT={};
  FONTS.forEach(function(f){FONTMAP[f.id]=f.css;FONTPPT[f.id]=f.ppt;});
  /* an unrecognised value is a typed family name: use it as-is */
  function fontCss(v){
    if(!v) return '';
    return FONTMAP[v]||('"'+String(v).replace(/"/g,'')+'"');
  }
  function fontPpt(v){
    if(!v) return '';
    return FONTPPT[v]||String(v);
  }
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
    if(a.k==='arrow') return a.nohead?'Line':'Arrow';
    if(a.k==='draw') return 'Drawing';
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
      ?{x:50,y:42,size:6}          /* colours come from the page theme */
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
    /* NO legibility floor. Text is a percentage of the page height, and
       everything around it — boxes, figures, spacing — scales with the
       page. A 9px minimum stopped scaling while its box carried on
       shrinking, so at 10% zoom every text broke out of its frame and the
       whole poster turned to soup (2026-08-07, user). Tiny text on a
       zoomed-out page is correct: that is what zoomed out MEANS. The
       0.5px guard only stops a collapse to zero. */
    return Math.max(0.5,h*(size||2.6)/100)+'px';
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
  var CROP_SHAPES=[['rect','No crop'],['round','Rounded'],
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
    /* a cleared crop must also clear a stale inline clip: masked in the
       editor because renderAnnots rebuilds nodes, but the export path
       reuses them (2026-08-20 diagnosis) */
    else{el.style.removeProperty('clip-path');
      el.style.removeProperty('-webkit-clip-path');}
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
  /* ul/ol/li are here because a BULLET LIST is rich text like any other
     run, not a separate mode. While they were missing, every list was
     flattened to its plain lines the moment it round-tripped through the
     sanitiser: bold inside a bullet, or a sub-level, silently vanished
     (2026-08-20, user: "the bullet list on/off is cursed"). */
  var RICH_TAGS={span:1,b:1,strong:1,i:1,em:1,u:1,s:1,br:1,font:1,
    ul:1,ol:1,li:1};
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
      /* a list is structure worth keeping even with no inline styling in
         it — without ul/ol here a plain bullet list reported rich:false
         and the caller threw a.html away */
      rich:!!tpl.content.querySelector(
        'span[style],font,b,strong,i,em,u,s,ul,ol')};
  }
  /* ---- LISTS ----------------------------------------------------------
     A text box is a list when a.list says so: 'bullet' or 'number'. The
     ITEMS live in a.html as plain <li>…</li> (no wrapper), so switching
     bullets to numbering is a one-word model change that rewrites no
     content, and a.text keeps the flat plain-text projection everything
     else reads (pptx, export, search, the Layers pane).

     What was here before had two states that each remembered the other's
     content: a.list drew a <ul> from a.text's newlines, while a.html —
     the rich version — was left untouched underneath it. Turning bullets
     OFF fell straight back to that stale a.html, so whatever you had
     typed as a list disappeared and text from before it came back
     (2026-08-20, user: "the bullet list on/off is cursed. PLEASE DO
     EVERYTHING PROPERLY"). One content field, converted on the way in and
     on the way out, is the fix. */
  function listOf(a){
    /* an older deck stored a.list as the boolean 1 */
    return a&&a.list?(a.list===true||a.list===1?'bullet':a.list):0;
  }
  /* strip markup for the plain projection */
  function plainOf(html){
    var t=document.createElement('template');
    t.innerHTML=String(html||'');
    return t.content.textContent||'';
  }
  /* the box's content as ONE HTML CHUNK PER LINE, whichever form it is in */
  function contentLines(a){
    var out=[],t=document.createElement('template');
    if(listOf(a)&&a.html){
      t.innerHTML=a.html;
      $$('li',t.content).forEach(function(li){
        /* a nested list is a line of its own, at a deeper level; flattened
           here because a plain run of text has no levels to keep */
        var kid=li.querySelector('ul,ol');
        if(kid) kid.remove();
        out.push(li.innerHTML);
      });
      return out.length?out:[''];
    }
    if(a.html){
      /* split on top-level <br>, keeping the inline markup around each */
      t.innerHTML=a.html;
      var cur=document.createElement('template');
      var n=t.content.firstChild;
      while(n){
        var next=n.nextSibling;
        if(n.nodeType===1&&(n.tagName||'').toLowerCase()==='br'){
          out.push(cur.innerHTML);cur.innerHTML='';
        } else cur.content.appendChild(n);
        n=next;
      }
      out.push(cur.innerHTML);
      return out;
    }
    return String(a.text||'').split('\n');
  }
  /* set (or clear) the list style, converting the content either way */
  function setListStyle(a,style){
    if(!a) return;
    var was=listOf(a);
    style=style||0;
    if(was===style) return;
    var lines=contentLines(a);
    if(style){
      /* an empty line still needs a bullet to stand on */
      a.html=lines.map(function(h){
        return '<li>'+(h||'<br>')+'</li>';}).join('');
      a.list=style;
      /* a list has several baselines and no single curve to follow */
      delete a.arc;
    } else {
      a.html=lines.join('<br>');
      delete a.list;
    }
    a.text=lines.map(plainOf).join('\n');
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
  /* the ⠿ move handle is gone: everything drags from its own body now,
     and the handle was both fiddly to hit and sat on top of the artwork
     you were trying to judge (2026-08-07, user) */
  function mkResize(tip){
    /* all four corners resize (anchored on the opposite corner) */
    var frag=document.createDocumentFragment();
    ['nw','ne','sw','se'].forEach(function(cn){
      var r=document.createElement('span');
      r.className='an-resize an-rs-'+cn;
      r.dataset.corner=cn;
      r.title=tip||'Drag to resize';
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
    /* Text is NOT editable on contact. It used to be, which is why a text
       box could only be moved by a little ⠿ handle: clicking the words
       put a caret in them instead of picking the box up. So: click to
       select and drag like anything else, DOUBLE-click to type — which is
       what every other tool on the machine does (2026-08-07, user: "just
       make it normal moving controls"). */
    var editMode=(el.tagName==='UL'||rich)?'true':'plaintext-only';
    function beginEdit(){
      try{el.contentEditable=editMode;}catch(e){el.contentEditable='true';}
      el.focus();
      var host=el.closest?el.closest('.an-item'):null;
      if(host) host.classList.add('an-editing');
    }
    function endEdit(){
      el.contentEditable='false';
      var host=el.closest?el.closest('.an-item'):null;
      if(host) host.classList.remove('an-editing');
    }
    el.contentEditable='false';
    /* a JUST-DRAWN box must open ready to type without the double-click —
       focus() on a non-editable span silently does nothing, so focusText
       could never land the caret (found 2026-08-20, in-browser: the
       active element stayed on <body> and typing went nowhere) */
    el._beginEdit=beginEdit;
    el.addEventListener('dblclick',function(e){
      if(tool!=='select') return;
      e.stopPropagation();
      beginEdit();
      /* put the caret where the words were double-clicked, not at the end */
      try{
        var r=document.caretRangeFromPoint
          ? document.caretRangeFromPoint(e.clientX,e.clientY):null;
        if(r){var sel=window.getSelection();sel.removeAllRanges();
          sel.addRange(r);}
      }catch(err){}
    });
    /* Spellcheck ON while editing. It used to be off everywhere, which
       meant a typo could travel all the way onto a printed A0 poster with
       nothing ever flagging it (2026-08-07). Only editable text is
       checked, so Present, print and every export stay squiggle-free —
       editableText is wired in edit mode alone. */
    el.spellcheck=true;
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
      endEdit();
      /* a text box with nothing in it is invisible once deselected (they
         are born with no placeholder and no background) — so an empty one
         removes itself rather than haunting the slide */
      var s2=pres.slides[cur],a2=s2&&(s2.annots||[])[idx];
      if(a2&&a2.k==='text'&&!String(a2.text||'').trim()&&!a2.html){
        s2.annots.splice(idx,1);
        if(selAnnot===idx) selAnnot=null;
        selSet=selSet.filter(function(i2){return i2!==idx;});
        renderAnnots(layer,s2);
      }
      markDirty();
    });
    /* Tab makes a SUB-BULLET, the way it does in every outliner and in
       PowerPoint — not a jump to the next control. Only inside a list:
       in a plain text box Tab still has nothing useful to do and is left
       alone. execCommand builds the nested <ul>/<ol>, which is exactly
       the structure the model now keeps (RICH_TAGS allows ul/ol/li). */
    el.addEventListener('keydown',function(e){
      if(!el.isContentEditable) return;
      if(e.key==='Tab'&&el.classList.contains('an-ul')){
        e.preventDefault();e.stopPropagation();
        try{document.execCommand(e.shiftKey?'outdent':'indent',
          false,null);}catch(err){}
        return;
      }
      /* while typing, the deck's own single-letter shortcuts (R, G, …)
         must not fire — they would arm a tool mid-sentence */
      e.stopPropagation();
    });
    el.addEventListener('mousedown',function(e){
      if(tool!=='select') return;   /* placing mode: draw over me */
      /* the span owns the mouse only while TYPING (caret placement).
         Otherwise the event must bubble to the layer handler — the only
         place startMove is armed. Stopping it unconditionally was why a
         text box showed a move cursor but could only ever be selected,
         never dragged (2026-08-20 diagnosis, verified live: body-drags
         moved 0.00% before, moved normally once bubbling). It also ate
         shift-multi-select on text boxes. */
      if(el.isContentEditable) e.stopPropagation();
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
      var moved=(c.style.left!==f.x+'%'||c.style.top!==f.y+'%'
        ||c.style.width!==f.w+'%'||c.style.height!==f.h+'%');
      c.style.left=f.x+'%';c.style.top=f.y+'%';
      c.style.width=f.w+'%';c.style.height=f.h+'%';
      /* the frame has just MOVED, and any arrow attached to it was routed
         to where it used to be — annotRectPct measures the rendered
         element for an aspect-fitted figure, and this fit lands a frame
         or two after the arrows were drawn. Nothing told them, so an
         attached arrow ended up off its figure, worst on the first render
         of a slide in playback where nothing re-renders afterwards
         (2026-08-20, user: "arrows and lines when going to present do not
         stay in the same place"). Arrows only — redrawing the figures
         from here would fit them again and never settle. */
      if(moved) scheduleArrowRedraw(layer);
    }
    if(!img.naturalWidth){
      img.addEventListener('load',go,{once:true});
      if(img.decode) img.decode().then(go).catch(function(){});
    }
    go();
  }
  var dpiT=null;
  /* ONE arrow, drawn. Lifted out of the render loop so it can run in a
     SECOND pass, after every other item is in the DOM — see the two-pass
     comment in renderAnnots — and so a figure that finishes fitting later
     can ask for the arrows alone to be redrawn (redrawArrows). */
  function drawArrow(layer,s,a,i,svg,svgTop,defs,editing){
    var col=a.color||'#ff6b57';
    var ends=arrowEnds(layer,s,a,i);
    var hs=headSize(a),sw=a.sw||3,swPx=strokePx(a,layer);
    /* a head is scaled by the LINE's width as well as its own size
       setting, so a fat arrow does not end in a pinhead.
       This reads the STORED weight, never the resolved pixels:
       markerUnits defaults to strokeWidth, so the head already grows
       with the page for free. Clamping on pixels instead would make
       the head-to-line ratio change with the zoom. */
    var mw=hs.mul*Math.max(0.55,Math.min(2.2,sw/3));
    function mkHead(which,type){
      var h=HEAD_BY[type];
      if(!h||type==='none'||!h.path) return '';
      var id='an-h'+which+'-'+i;
      var mk=document.createElementNS(AN_NS,'marker');
      mk.setAttribute('id',id);
      mk.setAttribute('viewBox','0 0 10 10');
      mk.setAttribute('refX',h.open?'9':'8');
      mk.setAttribute('refY','5');
      mk.setAttribute('markerWidth',mw);
      mk.setAttribute('markerHeight',mw);
      /* auto-start-reverse points a START marker back down the line,
         so one path definition serves both ends */
      mk.setAttribute('orient','auto-start-reverse');
      var mp=document.createElementNS(AN_NS,'path');
      mp.setAttribute('d',h.path);
      if(h.open){
        mp.setAttribute('fill','none');
        mp.setAttribute('stroke',col);
        mp.setAttribute('stroke-width','1.8');
        mp.setAttribute('stroke-linecap','round');
      } else mp.setAttribute('fill',col);
      mk.appendChild(mp);defs.appendChild(mk);
      return 'url(#'+id+')';
    }
    var mEnd=mkHead('e',headEnd(a)),mStart=mkHead('s',headStart(a));
    var lrA=layer.getBoundingClientRect();
    var d=arrowPath(ends,a,lrA.width,lrA.height);
    var ln=document.createElementNS(AN_NS,'path');
    ln.setAttribute('d',d);
    ln.setAttribute('class','an-arrow-line'+(selAnnot===i?' sel':''));
    ln.setAttribute('data-idx',i);
    ln.setAttribute('stroke',col);
    ln.setAttribute('fill','none');
    ln.setAttribute('stroke-width',swPx);
    ln.setAttribute('stroke-linecap',
      lineStyle(a)==='dot'?'round':'butt');
    ln.setAttribute('stroke-linejoin','round');
    var dsh=dashPx(a,layer);
    if(dsh) ln.setAttribute('stroke-dasharray',dsh);
    if(a.op!=null&&a.op<1) ln.style.opacity=a.op;
    if(mEnd) ln.setAttribute('marker-end',mEnd);
    if(mStart) ln.setAttribute('marker-start',mStart);
    svgTop.appendChild(ln);
    var hit=document.createElementNS(AN_NS,'path');
    hit.setAttribute('d',d);
    hit.setAttribute('fill','none');
    /* the grab path is CHROME, so its 16px stays screen-measured and
       does not scale with the page — otherwise a zoomed-out poster
       would leave a 2px target. But the ink can now be wider than 16px
       on a big page, so take whichever is larger. */
    hit.setAttribute('stroke-width',Math.max(16,swPx+10));
    hit.setAttribute('class','an-arrow-hit an-item');
    hit.setAttribute('data-idx',i);
    svg.appendChild(hit);
    if(editing&&!a.lock){   /* a locked arrow gets no live endpoints */
      ['1','2'].forEach(function(which){
        /* an endpoint PINNED to an item is not free to drag: it
           reports the attachment instead, and moves when that item
           moves */
        var tied=(which==='1'?a.c1:a.c2);
        var ep=document.createElement('span');
        ep.className='an-endpt an-endpt-'+which
          +(tied?' tied':'')+(selAnnot===i?' sel':'');
        ep.style.left=(which==='1'?ends.x1:ends.x2)+'%';
        ep.style.top=(which==='1'?ends.y1:ends.y2)+'%';
        ep.setAttribute('data-idx',i);
        ep.setAttribute('data-ep',which);
        ep.title=tied
          ?'Attached — it follows that item. Drag to re-aim, or drop '
            +'on empty page to detach'
          :'Drag to redirect the arrow. Drop it on an item to attach, '
            +'and it will follow that item from then on';
        layer.appendChild(ep);
      });
    }
  }
  /* Redraw JUST the arrows against the layer as it stands now. A figure
     frame settles into its aspect-fitted box asynchronously (fitFigFrame
     retries until the <img> reports a natural size), so an arrow attached
     to one was routed to the pre-fit rect and then never told the figure
     had moved — the arrow ended up somewhere else, most visibly on the
     first render of a slide in playback (2026-08-20, user: "arrows and
     lines when going to present do not stay in the same place"). */
  function redrawArrows(layer,s){
    if(!layer||!layer.isConnected||!s) return;
    var svg=layer.querySelector('svg:not(.an-svgtop)');
    var svgTop=layer.querySelector('svg.an-svgtop');
    if(!svg||!svgTop) return;
    var defs=svgTop.querySelector('defs');
    if(!defs){defs=document.createElementNS(AN_NS,'defs');
      svgTop.insertBefore(defs,svgTop.firstChild);}
    $$('.an-arrow-line,.an-endpt',layer).forEach(function(n){n.remove();});
    $$('.an-arrow-hit',svg).forEach(function(n){n.remove();});
    $$('marker',defs).forEach(function(n){n.remove();});
    var editing=(mode==='edit');
    (s.annots||[]).forEach(function(a,i){
      if(!a||a.k!=='arrow') return;
      if(a.hide&&editing) return;
      drawArrow(layer,s,a,i,svg,svgTop,defs,editing);
    });
    if(editing) paintSel(layer);
  }
  /* several figures on a slide all settle within a frame or two of each
     other, so coalesce their redraw requests into one */
  var arrowRedrawT=null;
  function scheduleArrowRedraw(layer){
    clearTimeout(arrowRedrawT);
    arrowRedrawT=setTimeout(function(){
      var s=pres&&pres.slides&&pres.slides[cur];
      if(s&&layer&&layer.isConnected) redrawArrows(layer,s);
    },0);
  }
  function renderAnnots(layer,s){
    var editing=(mode==='edit');
    layer.innerHTML='';
    /* every layer rebuild destroys the dpi chips — re-judge (debounced)
       once the edit settles, so resizing a figure ONTO a poster column
       actually raises the warning it exists for (2026-08-05 review) */
    if(editing&&pageOf().poster){
      clearTimeout(dpiT);
      dpiT=setTimeout(function(){
        var se=stage.querySelector('.slide');
        if(se&&mode==='edit') checkFigDpi(se);
      },300);
    }
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
        if(p.color) d.style.color=p.color;   /* default lives in CSS */
        if(p.b) d.style.fontWeight='700';
        if(p.i) d.style.fontStyle='italic';
        var tdeco=(p.u?'underline ':'')+(p.strike?'line-through':'');
        if(tdeco.trim()) d.style.textDecoration=tdeco.trim();
        if(p.align) d.style.textAlign=p.align;
        if(p.font) d.style.fontFamily=fontCss(p.font);
        applyCommon(d,p,'translate(-50%,-50%)');
        d.setAttribute('data-idx',which);
        if(editing){
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

    /* TWO passes. An attached endpoint is DERIVED from where its target
       item is on the layer, and annotRectPct measures the rendered
       element for anything auto-sized (text) or aspect-fitted (a figure
       frame). An arrow drawn during the same pass as its target therefore
       measured an element that was not in the DOM yet whenever the target
       came LATER in the array, and silently fell back to its stored
       coordinates — so the arrow moved (2026-08-20, user: "arrows and
       lines when going to present do not stay in the same place").
       Deferring every arrow to a second pass makes attachment
       order-independent. It changes nothing about z-order: the visible
       strokes have always gone into svgTop, which is appended last. */
    var _arrows=[];
    (s.annots||[]).forEach(function(a,i){
      /* hidden via the Objects pane: skipped while editing, still
         rendered in playback / print */
      if(a.hide&&editing) return;
      if(a.k==='arrow'){_arrows.push(i);return;}
      if(a.k==='rect'){
        var shp=a.shape||'rect';
        var col=a.color||'#ff6b57';
        var r=document.createElement('div');
        var svgShape=!!(SHAPE_PATHS[shp]||SHAPE_GLYPH[shp]);
        r.className='an-item an-rect'+(svgShape?' an-svgshape':'')
          +(selAnnot===i?' sel':'');
        r.style.left=a.x+'%';r.style.top=a.y+'%';
        r.style.width=(a.w||10)+'%';r.style.height=(a.h||10)+'%';
        if(svgShape){
          r.appendChild(drawShapeSvg(shp,col,strokePx(a,layer),a,i,layer));
        } else {
          r.style.borderColor=col;
          r.style.borderWidth=strokePx(a,layer)+'px';
          var lsD=dashFor(a);
          r.style.borderStyle=lsD
            ?(lineStyle(a)==='dot'?'dotted':'dashed'):'solid';
          r.style.background=cssFill(a,col);
          if(shp==='ellipse') r.style.borderRadius='50%';
        }
        applyCommon(r,a);
        r.setAttribute('data-idx',i);
        if(editing){r.appendChild(mkResize());
          r.appendChild(mkRotate());}
        layer.appendChild(r);
      } else if(a.k==='draw'){
        var dv=document.createElement('div');
        dv.className='an-item an-rect an-svgshape an-draw'
          +(selAnnot===i?' sel':'');
        dv.style.left=a.x+'%';dv.style.top=a.y+'%';
        dv.style.width=(a.w||10)+'%';dv.style.height=(a.h||10)+'%';
        dv.appendChild(drawFreeSvg(a,layer));
        applyCommon(dv,a);
        dv.setAttribute('data-idx',i);
        if(editing){dv.appendChild(mkResize());dv.appendChild(mkRotate());}
        layer.appendChild(dv);
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
        /* text INSIDE a cell is page-relative like everything else: the
           body renders at its natural size and is zoomed by
           a.ts x pageScale, so zooming the page cannot change a
           markdown table's size relative to the poster (2026-08-18,
           user: "make sure everything doesn't change size relative to
           poster or slide when zooming"). */
        var kz=pageScale(layer)||1;
        if(locked&&lkCard){
          /* pinned to a git commit: render THAT version's card — refresh
             never touches it, the notebook needn't even be open */
          c.title=(lkCard.title||'')+' @ '+a.lockver.commit;
          var vb=frameFromVerCard(lkCard,a.part);
          if(vb){
            vb.style.zoom=(a.ts||1)*kz;
            applyCrop(vb,a);
            if(a.crop) c.classList.add('an-cropped');
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
            ch.style.zoom=kz;
            c.appendChild(ch);
          }
          var fro=frozenFrames.get(a);
          var b=fro?framePartFromSnap(fro,a.part):framePart(it.ns,a.part);
          if(fro&&!b) b=framePart(it.ns,a.part);
          if(b){
            b.style.zoom=(a.ts||1)*kz;
            applyCrop(b,a);
            if(a.crop) c.classList.add('an-cropped');
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
          /* sized off the page like every other piece of text on it. Left
             at a fixed 11px it was the only thing that did not shrink when
             you zoomed out, so an empty frame's placeholder swelled to
             fill the poster (2026-08-07, user: text "changes size when I
             zoom in and out"). */
          pb.style.fontSize=fontPx(layer,1.15);
          pb.textContent=a.ref?('missing: '+a.ref)
            :'Click to add from notebook';
          pb.addEventListener('mousedown',function(e){
            if(tool==='select') e.stopPropagation();});
          pb.addEventListener('click',function(e){
            if(tool!=='select') return;
            e.stopPropagation();startPick(i);});
          c.appendChild(pb);
        }
        if(editing){
          if(cropMode&&selAnnot===i) mkCropHandles(c,layer,s,i);
          else {c.appendChild(mkResize());c.appendChild(mkRotate());}
        }
        layer.appendChild(c);
      } else if(a.k==='text'){
        var d2=document.createElement('div');
        d2.className='an-item an-text'+(a.bg===0?' nobg':'')
          +(selAnnot===i?' sel':'');
        d2.style.left=a.x+'%';d2.style.top=a.y+'%';
        d2.style.fontSize=fontPx(layer,a.size);
        /* only an EXPLICIT colour goes inline: the default comes from
           CSS so .page-light can flip it — a baked '#ffffff' default
           made every template text white-on-white on a light poster
           (2026-08-05 review) */
        if(a.color) d2.style.color=a.color;
        if(a.b) d2.style.fontWeight='700';
        if(a.i) d2.style.fontStyle='italic';
        var deco=(a.u?'underline ':'')+(a.strike?'line-through':'');
        if(deco.trim()) d2.style.textDecoration=deco.trim();
        if(a.align) d2.style.textAlign=a.align;
        if(a.font) d2.style.fontFamily=fontCss(a.font);
        if(a.bg!==0&&a.bgc){
          d2.style.background=a.bgc;
          d2.style.borderColor='transparent';
        }
        if(a.w){d2.style.width=a.w+'%';d2.style.maxWidth='none';}
        applyCommon(d2,a);
        d2.setAttribute('data-idx',i);
        
        if(editing){d2.appendChild(mkResize());
          d2.appendChild(mkRotate());}
        var tx2,lst=listOf(a);
        if(lst){
          /* the ELEMENT carries the marker style and a.html carries only
             the items, so switching bullets to numbering rewrites no
             content at all */
          tx2=document.createElement(lst==='number'?'ol':'ul');
          tx2.className='an-tx an-ul an-ul-'+lst;
          if(a.html) tx2.innerHTML=sanitizeRich(a.html).html;
          else String(a.text||'').split('\n').forEach(function(line){
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
            /* rich BOTH ways now. A list used to be saved as plain lines
               only, so bold inside a bullet — or a sub-level — was thrown
               away the moment the box lost focus. */
            function(v,r){a.text=v;
              if(r&&r.rich) a.html=r.html; else delete a.html;},
            i,true);
        }
        d2.appendChild(tx2);
        layer.appendChild(d2);
        /* Curved text. Drawn as SVG on a bowed baseline, which HTML has no
           way to do — but only when the box is NOT being typed into:
           contenteditable does not work on an SVG <textPath>, so the flat
           version is what you edit and the curve is what you see the rest
           of the time. Measured in px after the box is in the DOM so the
           glyphs are never stretched by a viewBox. */
        if(a.arc&&!listOf(a)&&d2!==document.activeElement
           &&!d2.contains(document.activeElement)){
          /* the box has to be tall enough to hold the arch before it is
             measured — a one-line box has no room to curve in */
          var afs=parseFloat(window.getComputedStyle(tx2).fontSize)||16;
          d2.style.minHeight=
            (afs*(1.25+Math.abs(+a.arc||0)/26))+'px';
          applyTextArc(d2,tx2,a,i);
        }
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
        if(a.crop) im.classList.add('an-cropped');
        applyCrop(img,a);
        im.appendChild(img);
        if(editing){if(cropMode&&selAnnot===i) mkCropHandles(im,layer,s,i);
          else {im.appendChild(mkResize(a.crop
              ?'Drag to resize the crop window'
              :'Drag to resize — the picture keeps its shape. '
                +'Hold Shift to stretch it'));
            im.appendChild(mkRotate());}}
        layer.appendChild(im);
      }
    });
    _arrows.forEach(function(i){
      drawArrow(layer,s,(s.annots||[])[i],i,svg,svgTop,defs,editing);
    });
    /* build animations: number the builds in the editor; in playback, hide the
       ones not yet revealed and animate the one just revealed */
    if(s.annots&&s.annots.some(function(a){return a&&a.anim;})){
      var steps=slideBuildSteps(s);
      /* .an-arrow-line is the visible stroke and carries no .an-item
         class (the fat invisible hit path under the items does), so an
         ANIMATED arrow was never hidden before its build and simply sat
         on the slide from the first frame (2026-08-20 audit) */
      $$('.an-item[data-idx],.an-arrow-line[data-idx]',layer).forEach(function(el){
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
    if(cropMode&&idx!==selAnnot) cropMode=false;
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
  /* ---- WHICH CONTROL BELONGS TO WHICH KIND OF ITEM ------------------
     One table, checked for completeness at the bottom of showFmt.

     The alternative — a hand-written show() line per control — is exactly
     how "Ends" and "Route" (both arrow properties) came to be offered on a
     triangle: four new dropdowns were added to the markup and none of them
     got a line, so they showed for everything selected, forever, and
     nothing complained (2026-08-07, user). A control that is not in this
     table and not handled explicitly now throws in the console instead of
     quietly appearing on every item.

     '*' means every kind; the value is a space-separated list otherwise. */
  var FMT_KINDS={
    '#fmt-stylewrap':'arrow rect draw', /* dashes apply to any stroke */
    '#fmt-swwrap':'arrow rect draw',    /* stroke weight, likewise */
    '#fmt-headwrap':'arrow',          /* arrowheads: a shape has no ends */
    '#fmt-bendwrap':'arrow',          /* straight/curved/elbow: ditto */
    '#fmt-fillwrap':'rect',           /* fill + gradients: shapes only */
    '#fmt-shapewrap':'rect',
    '#fmt-cropwrap':'image cell'
  };
  /* controls whose visibility depends on more than the kind (how many are
     selected, what a placed cell contains, whether the page is a poster).
     Listed so the completeness check knows they are deliberate. */
  var FMT_MANUAL=('#fmt-bullets #fmt-numbers #fmt-indent #fmt-outdent '
    +'#fmt-find '
    +'#fmt-dup #fmt-group #fmt-ungroup #fmt-front #fmt-back '
    +'#fmt-rotl #fmt-rotr #fmt-arline #fmt-argrid #fmt-samewrap '
    +'#fmt-alignwrap #fmt-opwrap #fmt-txcol-btn '
    +'#fmt-fillcol-btn #fmt-txlab #fmt-bglab #fmt-szwrap #fmt-smaller '
    +'#fmt-bigger #fmt-bold #fmt-ital #fmt-under #fmt-strike #fmt-font '
    +'#fmt-parawrap '
    +'#fmt-replace #fmt-locate #fmt-revert #fmt-lockver #fmt-parts '
    +'#fmt-crop #fmt-same #fmt-style #fmt-sw #fmt-head #fmt-bend '
    +'#fmt-fillstyle #fmt-shape '
    +'#fmt-align-btn #fmt-para #fmt-size #fmt-op '
    +'#fmt-opval').split(' ');

  function showFmt(){
    var bar=$('#et-fmt'); if(!bar) return;
    var et=$('#edit-tools');
    var s=pres.slides[cur];
    var a=(s&&selAnnot!==null)?annotByIdx(s,selAnnot):null;
    if(!a){
      bar.hidden=true;
      if(et) et.classList.remove('fmt-open');
      /* the pane outlives the selection — it is the SLIDE's build order —
         so it has to be told the selection went away, or its effect
         chooser keeps offering the last item's effect to nothing */
      animPaneSync();animRibbonSync();
      syncRibbonGroups();
      return;
    }
    var kind=(selAnnot==='t'||selAnnot==='s')?'text':a.k;
    bar.hidden=false;
    /* the contextual groups REPLACE the Insert group instead of adding
       a third toolbar row — the canvas must not shrink when you select
       something (2026-08-05, user: "you can't really see the poster
       you are working on") */
    if(et) et.classList.add('fmt-open');
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
      if(isText){
        var fv=a.font||'sans';
        /* a typed family is not one of the listed options — show it as
           its own entry rather than silently reading back as "Sans" */
        if(!FONTMAP[fv]){
          var ex=fontSel.querySelector('option[data-typed]');
          if(ex) ex.remove();
          fontSel.insertAdjacentHTML('afterbegin',
            '<option data-typed="1" value="'+esc(fv)+'">'+esc(fv)
            +'</option>');
        }
        fontSel.value=fv;
      }
    }
    show('#fmt-bold',isText,!!a.b);
    show('#fmt-ital',isText,!!a.i);
    show('#fmt-under',isText,!!a.u);
    show('#fmt-strike',isText,!!a.strike);
    show('#fmt-szwrap',isText);
    var szIn=$('#fmt-size');
    if(szIn&&isText&&document.activeElement!==szIn)
      szIn.value=Math.round((a.size||2.6)*5.4);
    /* alignment, list and curve are reached through the Layout menu, and
       that menu now applies all three itself — the originals are gone
       (2026-08-17 audit) */
    show('#fmt-parawrap',isText&&isNum,!!a.arc);
    /* bullets / numbering / indent. The two list buttons show WHICH list
       is on, which the old menu line could not; indent and outdent only
       appear once there is a list to move a bullet inside. */
    var lst=isText?listOf(a):0;
    show('#fmt-bullets',isText&&isNum,lst==='bullet');
    show('#fmt-numbers',isText&&isNum,lst==='number');
    show('#fmt-indent',isText&&isNum&&!!lst);
    show('#fmt-outdent',isText&&isNum&&!!lst);
    /* the kind-driven controls, all from one table */
    Object.keys(FMT_KINDS).forEach(function(id){
      var spec=FMT_KINDS[id];
      show(id,isNum&&(spec==='*'||spec.split(' ').indexOf(kind)>=0));
    });
    /* what this weight will actually PRINT. It goes in the tooltip, never
       the label: a label whose width changed with the selected item would
       make the ribbon's required width depend on what you clicked, and
       the fit ladder has no rung left to absorb that. */
    var lnBtn=$('#fmt-sw');
    if(lnBtn&&isNum&&!lnBtn.hidden){
      var mmw=swMm(a);
      lnBtn.title='Line thickness — '+(mmw<1?mmw.toFixed(2):mmw.toFixed(1))
        +'mm on this page ('+swPt(a).toFixed(2).replace(/\.?0+$/,'')+'pt)';
    }
    /* every drawn menu shows which option the selection is ON */
    if(isNum) syncLineMenus(a);
    animPaneSync();animRibbonSync();
    show('#fmt-opwrap',true);
    var opR=$('#fmt-op'),opV=$('#fmt-opval');
    var opPct=Math.round((a.op==null?1:a.op)*100);
    if(opR) opR.value=opPct;
    if(opV) opV.textContent=opPct+'%';
    show('#fmt-dup',isNum);
    var nSel=selSet.filter(function(i){return typeof i==='number';}).length;
    show('#fmt-group',nSel>=2);
    show('#fmt-ungroup',isNum&&a.grp!=null);
    /* these six are reached through the Arrange menu now; they stay in the
       DOM because the menu drives them by .click(), so each keeps exactly
       one implementation */
    show('#fmt-front',false);
    show('#fmt-back',false);
    show('#fmt-arline',false);
    show('#fmt-argrid',false);
    show('#fmt-rotl',false);
    show('#fmt-rotr',false);
    /* count what can actually be RESIZED, not what is selected. selRects
       drops arrows (no box), locked and hidden items, so two selected
       arrows offered "Same size" and then did nothing at all when you
       picked from it (2026-08-07 audit). */
    show('#fmt-samewrap',selRects().length>=2);
    /* the menu now covers single-item actions (order, rotate) too */
    show('#fmt-alignwrap',isNum);
    var plainText=isText&&typeof selAnnot==='number';
    /* A SHAPE gets the fill swatches too. It did not, so a triangle's
       body could not be given a colour by any control in the app: the
       outline worked (Colour → a.color → stroke) but the fill popup was
       gated to text, its handler had no shape branch, and "Solid colour…"
       just copied the outline. A green triangle with a red outline was
       not constructible (2026-08-07, user: "yet I can't change the
       fucking colour"). */
    var showBg=plainText||noteCell||kind==='rect';
    show('#fmt-txlab',(isText&&kind!=='cell')||noteCell);
    show('#fmt-bglab',showBg);
    /* the popup buttons mirror what their menus can act on, and the label
       names the PART it recolours: "Colour" next to "Fill" left people
       guessing which one was the outline (2026-08-19, user: "'colour' vs
       'fill colour' is confusing — is that border?") */
    show('#fmt-txcol-btn',kind!=='image');
    var tcb=$('#fmt-txcol-btn');
    if(tcb) tcb.textContent=(isText||kind==='cell')?'Text ▾'
      :kind==='rect'?'Border ▾'
      :(kind==='arrow'||kind==='draw')?'Line ▾':'Colour ▾';
    show('#fmt-fillcol-btn',showBg);
    /* a shape now has two Fill buttons — this one picks the COLOUR, the
       one in Line & shape picks none/solid/gradient. Say which is which. */
    var fcb=$('#fmt-fillcol-btn');
    if(fcb) fcb.textContent=(kind==='rect')?'Fill colour ▾':'Fill ▾';
    $$('.swbg',bar).forEach(function(sw){
      sw.hidden=!showBg;
      /* read back from the field the item's renderer actually uses, or
         the wrong swatch lights up */
      var cur_;
      if(kind==='cell') cur_=(a.bgcol||'');
      else if(kind==='rect')
        cur_=a.grad?'':(!a.fill?'none':(a.fillc||''));
      else cur_=((a.bg===0)?'none':(a.bgc||'#0e1926'));
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
    /* #fmt-cropwrap: visibility from FMT_KINDS.
       Animation is a BUILD — an item appearing on click as you step
       through a deck. A poster is one printed page: there is no click and
       nothing to step through, so it is not offered (2026-08-07, user:
       "why is there animate options in a poster"). */
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
    /* COMPLETENESS. Every #fmt-* control in the contextual bar must be
       governed by FMT_KINDS or listed in FMT_MANUAL. Without this, a
       control added to the markup and forgotten here shows for every kind
       of item, silently and forever — precisely what happened with Ends
       and Route on a shape. Console-only: it is a wiring mistake for
       whoever adds the control, not a user-facing failure. */
    if(!showFmt._checked){
      showFmt._checked=true;
      var governed={};
      Object.keys(FMT_KINDS).forEach(function(k){governed[k]=1;});
      FMT_MANUAL.forEach(function(k){governed[k]=1;});
      var stray=[];
      $$('[id^="fmt-"]',bar).forEach(function(el){
        if(/-menu$/.test(el.id)) return;          /* menu bodies */
        if(!governed['#'+el.id]) stray.push('#'+el.id);
      });
      if(stray.length&&window.console&&console.warn)
        console.warn('deck: ribbon controls governed by nothing in '
          +'showFmt, so they will show for every selection: '
          +stray.join(', '));
    }
    syncRibbonGroups();
  }
  /* hide a ribbon group whose controls are all hidden, and drop the divider
     before the first visible group — so the format ribbon stays tidy */
  function syncRibbonGroups(){
    /* the WHOLE ribbon, not just the contextual half: a static group can
       empty out too (Notebooks has nothing to offer a poster with no
       placed cells yet) and an empty group that still drew its label and
       divider read as a missing feature */
    var bar=$('#edit-tools'); if(!bar) return;
    /* the TAB filter first: a group belonging to another tab must be out
       of the row before anything measures the row's width */
    applyTab();
    $$('.rbn-grp',bar).forEach(function(g){
      var vis=false,kids=g.querySelectorAll('button,input,select,.sh-drop');
      for(var i=0;i<kids.length;i++){
        var n=kids[i],blocked=false;
        while(n&&n!==g){if(n.hidden){blocked=true;break;}n=n.parentNode;}
        if(!blocked){vis=true;break;}
      }
      g.hidden=!vis;
    });
    /* `rbn-first` used to be stamped on the leading visible group so a
       ::before divider could be suppressed on it. The dividers became a
       border-right on the group itself and `:last-child` handles the end
       of the row, so nothing has styled that class since — it was three
       lines of bookkeeping maintained for no reader (2026-08-17 audit). */
    sizeRibbonGroups();
    /* groups appearing or leaving changes the width the row needs, so the
       density has to be re-judged every time the selection does */
    fitEditRibbon();
  }
  /* How many columns each group needs to fill two rows ACROSS: half its
     visible controls, rounded up.
     This is a COUNT OF WHAT IS SHOWING RIGHT NOW, so it goes stale the
     moment anything reveals a control without re-running it — and something
     did. applyPage() un-hides #vw-versions ("Slides" / "Versions") after
     the count, so View was sized for the two controls it had at count time,
     the third landed in an implicit third grid row, and the row overran its
     own VIEW label and printed on top of it (2026-08-16). Owning the count
     in one function that fitEditRibbon also calls makes it self-healing:
     any path that re-fits the ribbon re-counts it first. */
  function sizeRibbonGroups(){
    var bar=$('#edit-tools'); if(!bar) return;
    $$('.rbn-grp',bar).forEach(function(g){
      var row=g.querySelector('.rbn-row'); if(!row) return;
      var n=0;
      [].slice.call(row.children).forEach(function(c){
        if(c.hidden) return;
        /* a wrapper counts as the one cell it contributes */
        if(c.classList.contains('sh-drop')||c.classList.contains('dc-menuwrap')){
          var b=c.querySelector('.dbtn');
          if(b&&!b.hidden) n++;
          return;
        }
        /* a control that spans BOTH rows is worth two cells, or a group
           made of nothing but stacks asks for half the columns it needs
           and pushes the overflow into an implicit third row */
        n+=(c.classList.contains('rbn-stack')
            ||c.classList.contains('rbn-big')
            ||c.classList.contains('rbn-tall'))?2:1;
      });
      row.style.setProperty('--rbn-cols',Math.max(1,Math.ceil(n/2)));
    });
  }
  function fmtApply(fn,quiet){
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
    /* quiet = live preview inside a continuous gesture (a Trim stepper
       being held, a value being typed): redraw but push NO history —
       the gesture's end commits ONE undo entry instead of one per
       keystroke evicting real edits from the 50-slot stack
       (2026-08-05 review) */
    if(!quiet) markDirty();
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
  /* 6px was too tight to feel: on a poster zoomed to fit, a 6px window is
     a couple of real millimetres and the snap kept slipping past you */
  var SNAP_PX=9;
  function annotRectPct(layer,s,i){
    var a=(s.annots||[])[i]; if(!a) return null;
    if(a.k==='arrow')
      return {l:Math.min(a.x1,a.x2),r:Math.max(a.x1,a.x2),
              t:Math.min(a.y1,a.y2),b:Math.max(a.y1,a.y2)};
    /* NO LAYER is a legitimate caller: the .pptx export walks every slide,
       and only the one on screen has a rendered layer to measure. Without
       one we fall through to the stored box, which is the same fallback
       an attached endpoint already uses when its target goes away. */
    var el=layer?layer.querySelector('.an-item[data-idx="'+i+'"]'):null;
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
    /* the margin box and grid columns are snap lines too — a visible
       guide you cannot snap to would be worse than none */
    var g=guideTargets();
    xs=xs.concat(g.xs);ys=ys.concat(g.ys);
    /* guides you dragged off the rulers yourself */
    var cg=customGuides();
    xs=xs.concat(cg.x);ys=ys.concat(cg.y);
    return {xs:xs,ys:ys};
  }
  /* ---- equal-gap detection -------------------------------------------
     Alignment gets you edges that agree; what still reads as sloppy is
     uneven whitespace. While dragging, look for a position where the gap
     to a neighbour matches a gap that already exists between two other
     items on the same band, and mark both. */
  function gapCands(layer,s,skip,bb,horiz){
    var boxes=[];
    (s.annots||[]).forEach(function(a,i){
      if(skip.indexOf(i)>=0||!a||a.hide||a.k==='arrow') return;
      var r=annotRectPct(layer,s,i); if(!r) return;
      /* only items on the same band count: a figure three columns over
         is not "next to" anything */
      var overlap=horiz?(r.b>bb.t&&r.t<bb.b):(r.r>bb.l&&r.l<bb.r);
      if(overlap) boxes.push(r);
    });
    boxes.sort(function(p,q){return horiz?(p.l-q.l):(p.t-q.t);});
    var gaps=[];
    for(var i=1;i<boxes.length;i++){
      var g=horiz?(boxes[i].l-boxes[i-1].r):(boxes[i].t-boxes[i-1].b);
      if(g>0.2) gaps.push(g);
    }
    return {boxes:boxes,gaps:gaps};
  }
  /* returns a delta that makes one of the dragged item's gaps equal to an
     existing gap, plus the pair of gaps to draw */
  function bestGap(layer,s,skip,bb,horiz,thr){
    var c=gapCands(layer,s,skip,bb,horiz);
    if(!c.gaps.length||!c.boxes.length) return null;
    var lo=horiz?bb.l:bb.t,hi=horiz?bb.r:bb.b;
    var best=null;
    c.boxes.forEach(function(r){
      var before=horiz?r.r:r.b,after=horiz?r.l:r.t;
      c.gaps.forEach(function(g){
        /* place the dragged box a distance g AFTER this one... */
        var d1=(before+g)-lo;
        if(Math.abs(d1)<=thr&&(!best||Math.abs(d1)<Math.abs(best.d)))
          best={d:d1,gap:g,from:r,side:'after'};
        /* ...or a distance g BEFORE it */
        var d2=(after-g)-hi;
        if(Math.abs(d2)<=thr&&(!best||Math.abs(d2)<Math.abs(best.d)))
          best={d:d2,gap:g,from:r,side:'before'};
      });
    });
    return best;
  }
  function drawGapMarks(layer,marks){
    $$('.snapgap',layer).forEach(function(n){n.remove();});
    marks.forEach(function(m){
      var el=document.createElement('div');
      el.className='snapgap';
      if(m.horiz){
        el.style.left=m.a+'%';el.style.width=(m.b-m.a)+'%';
        el.style.top=(m.at-0.35)+'%';el.style.height='0.7%';
      } else {
        el.style.top=m.a+'%';el.style.height=(m.b-m.a)+'%';
        el.style.left=(m.at-0.35)+'%';el.style.width='0.7%';
      }
      layer.appendChild(el);
    });
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
  /* a snap onto the PAGE's own edge or centre says something different
     from a snap onto another item, so the two are coloured apart */
  function isPageLine(v){
    return v===0||v===50||v===100;
  }
  function drawSnapGuides(layer,sx,sy){
    $$('.snapline',layer).forEach(function(n){n.remove();});
    if(sx!=null){
      var v=document.createElement('div');
      v.className='snapline snap-v'+(isPageLine(sx)?' snap-page':'');
      v.style.left=sx+'%';
      layer.appendChild(v);
    }
    if(sy!=null){
      var h=document.createElement('div');
      h.className='snapline snap-h'+(isPageLine(sy)?' snap-page':'');
      h.style.top=sy+'%';
      layer.appendChild(h);
    }
  }
  function clearSnapGuides(layer){
    $$('.snapline',layer).forEach(function(n){n.remove();});
    $$('.snapgap',layer).forEach(function(n){n.remove();});
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
    var gapMarks=[];
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
          /* an edge snap wins over an equal-gap snap on the same axis:
             agreeing with a line is a stronger intention than matching a
             distance */
          gapMarks=[];
          if(!bx){
            var gx=bestGap(layer,s,movers,bb,true,thr.x);
            if(gx){
              dx+=gx.d;
              var nb={l:bb.l+gx.d,r:bb.r+gx.d};
              var mid=(bb.t+bb.b)/2;
              gapMarks.push({horiz:true,at:mid,
                a:gx.side==='after'?gx.from.r:nb.r,
                b:gx.side==='after'?nb.l:gx.from.l});
            }
          }
          if(!by){
            var gy=bestGap(layer,s,movers,bb,false,thr.y);
            if(gy){
              dy+=gy.d;
              var nby={t:bb.t+gy.d,b:bb.b+gy.d};
              var midx=(bb.l+bb.r)/2;
              gapMarks.push({horiz:false,at:midx,
                a:gy.side==='after'?gy.from.b:nby.b,
                b:gy.side==='after'?nby.t:gy.from.t});
            }
          }
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
      drawGapMarks(layer,gapMarks);
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
    /* A PLACED IMAGE gets the same treatment, for the same reason. It did
       not, and the result was the bug you could not put your finger on:
       .an-imgel is object-fit:contain, so a free-form box that no longer
       matches the picture's shape just grows LETTERBOX. Drag a wide photo
       downwards and the selection outline gets taller while the photo
       stays exactly the size it was — "images don't get bigger when you
       drag them, just get's a bigger border" (2026-08-20, user).
       So: snap the stored box onto the picture (killing any letterbox
       already banked), then hold the picture's aspect for the drag, which
       is what every other tool does with a photo. Hold SHIFT to stretch
       it out of shape on purpose, and a CROPPED image keeps free-form
       resizing because there the box IS the crop window (object-fit is
       cover) and reshaping it is the whole point. */
    var imgFree=false;
    if(a.k==='image'&&!a.crop&&el){
      var ie=el.querySelector('.an-imgel');
      var fi=ie?figFit(layer,a,ie):null;
      if(fi){a.x=fi.x;a.y=fi.y;a.w=fi.w;a.h=fi.h;figRatio=fi.ratio;
        imgFree=true;}   /* ...unless Shift says otherwise, live, below */
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
      /* Shift releases a picture's aspect lock for this moment of the
         drag, so you can decide mid-gesture rather than before it */
      var ratio=(imgFree&&ev.shiftKey)?0:figRatio;
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
        if(a.k!=='text'&&!ratio){
          var by=bestSnap(targets.ys,[south?a.y+a.h:a.y],thr.y);
          if(by){
            if(south){if(a.h+by.d>=4){a.h=a.h+by.d;sy=by.at;}}
            else if(a.h-by.d>=4){a.y=a.y+by.d;a.h=a.h-by.d;sy=by.at;}
          }
        }
      }
      if(ratio&&lr.height){
        var fh=a.w*(lr.width/(lr.height*ratio));
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
    /* A LINE IS AN ARROW WITH NO HEAD, so it keeps k:'arrow' and inherits
       endpoint dragging, attachment, routing, dashes, the Objects pane
       and the PowerPoint connector export for nothing. `nohead` rather
       than head:'none' because headEnd and both label functions read that
       field to say "Line" instead of "Arrow". It is drawn rather than
       dropped in ready-made (2026-08-10, user: "I hate it how when you
       click line, it just creates a line — can it please be drawn like it
       does with the shapes"), and it stays a theme-aware divider colour
       instead of alarm-orange. */
    var a=(kind==='rect')
      ?{k:'rect',x:p0.x,y:p0.y,w:0,h:0,color:'#ff6b57',sw:SW_DEFAULT,
        shape:(pendingShape!=='rect'?pendingShape:undefined)}
      :(kind==='draw')
      ?{k:'draw',x:p0.x,y:p0.y,w:0,h:0,pts:[[0,0]],sw:SW_DEFAULT,
        color:pageIsLight(pres.pageBg)?'#44525c':'#8aa0b0'}
      :(kind==='cell')
      ?{k:'cell',x:p0.x,y:p0.y,w:0,h:0,ref:null}
      :(kind==='text')
      /* colour comes from the page theme. Born EMPTY and UNBOXED: the
         "Text" placeholder and the default panel both had to be removed
         by hand on every single box (2026-08-19, user: "no placeholder
         text and no background by default"). A box left empty deletes
         itself on blur, so nothing invisible is ever left behind. */
      ?{k:'text',x:p0.x,y:p0.y,w:0,h:0,text:'',size:2.6,bg:0}
      :(kind==='line')
      ?{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,nohead:1,sw:SW_DEFAULT,
        color:pageIsLight(pres.pageBg)?'#44525c':'#8aa0b0'}
      :{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,
        color:'#ff6b57',sw:SW_DEFAULT};
    var boxed=(a.k==='rect'||a.k==='cell'||a.k==='text');
    s.annots=s.annots||[];
    s.annots.push(a);
    var idx=s.annots.length-1;
    /* the raw trail, in page percentages, for a freehand stroke */
    var raw=(kind==='draw')?[[p0.x,p0.y]]:null;
    /* Fold the trail into a box plus 0..1 points. A stroke drawn dead
       straight has no extent on one axis, which would divide by zero and
       leave a box too thin to grab, so each axis gets a floor and the
       points centre themselves in it. */
    function foldTrail(){
      var xs=raw.map(function(q){return q[0];});
      var ys=raw.map(function(q){return q[1];});
      var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs);
      var y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
      var w=x1-x0,h=y1-y0,MIN=1.5;
      if(w<MIN){x0-=(MIN-w)/2;w=MIN;}
      if(h<MIN){y0-=(MIN-h)/2;h=MIN;}
      a.x=x0;a.y=y0;a.w=w;a.h=h;
      a.pts=raw.map(function(q){
        return [(q[0]-x0)/w,(q[1]-y0)/h];});
    }
    function mm(ev){
      var p=pctPoint(layer,ev);
      if(raw){
        /* thin the trail: a mousemove every pixel would store thousands
           of points into the document and the undo stack */
        var last=raw[raw.length-1];
        if(Math.abs(p.x-last[0])+Math.abs(p.y-last[1])>=0.35) raw.push([p.x,p.y]);
        foldTrail();
      } else if(boxed){
        a.x=Math.min(p0.x,p.x);a.y=Math.min(p0.y,p.y);
        a.w=Math.abs(p.x-p0.x);a.h=Math.abs(p.y-p0.y);
      } else {a.x2=p.x;a.y2=p.y;}
      renderAnnots(layer,s);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      var tiny=raw?(raw.length<3)
        :boxed?(a.w<1.5&&a.h<1.5)
        :(Math.abs(a.x2-a.x1)<1.5&&Math.abs(a.y2-a.y1)<1.5);
      /* A CLICK IS STILL A CLICK. Dragging says how big; clicking asks
         for the usual one, which is the fast way when the size does not
         matter yet — and it is what these two tools have always done, so
         nobody's habit breaks. A shape, line or arrow with no drag is
         still discarded: there is no sensible default size for those, and
         dropping a canned one is what the line tool was told off for
         (2026-08-10). */
      if(tiny&&a.k==='draw'){
        s.annots.splice(idx,1);      /* a stray click is not a drawing */
      } else if(tiny&&a.k==='cell'){
        a.x=Math.min(p0.x,64);a.y=Math.min(p0.y,64);a.w=34;a.h=30;
      } else if(tiny&&a.k==='text'){
        delete a.w;delete a.h;          /* auto-size to its own words */
      } else if(tiny) s.annots.splice(idx,1);
      markDirty();setTool('select');
      renderAnnots(layer,s);
      if(!tiny||(boxed&&a.k!=='draw')){
        selectAnnot(layer,idx);
        if(a.k==='text') focusText(layer,idx);
      }
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  /* put the caret in a fresh text box with its placeholder selected, so
     the first thing you type replaces "Text" */
  function focusText(layer,idx){
    var tx=layer.querySelector('.an-item[data-idx="'+idx+'"] .an-tx');
    if(!tx) return;
    if(tx._beginEdit) tx._beginEdit();   /* make it editable FIRST */
    tx.focus();
    try{
      var rng=document.createRange();
      rng.selectNodeContents(tx);
      var sl=window.getSelection();
      sl.removeAllRanges();sl.addRange(rng);
    }catch(e){}
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
          /* every item drags from its body, text included. The only thing
             that does not is a box you are actually typing in. */
          if(!item.classList.contains('an-editing'))
            startMove(layer,s,idx,ev);
        } else selectAnnot(layer,null);
        return;
      }
      ev.preventDefault();
      /* EVERY insert tool draws the same way. Text and cell used to be
         the two that did not: they dropped a canned box wherever you
         clicked and left you to resize it by hand, every single time
         (2026-08-17, user: "when you add them it would be good to draw
         them out to the shape you like, they just kind of snap to the one
         shape"). */
      if(tool!=='select') startDraw(layer,s,tool,pctPoint(layer,ev));
    });
  }
  /* every tool that exists. Anything else is NO tool. */
  var TOOLS={select:1,text:1,arrow:1,rect:1,line:1,cell:1,draw:1};
  function setTool(t){
    /* An unknown tool used to be armed happily: #dc-qr carried the generic
       `et` class with no data-tool, so the shared wiring ran
       setTool(undefined) and left the editor in a state no code handles —
       the button pressed, Cancel showing, the layer classed
       `tool-undefined`, the hint empty, and clicks on the page doing
       nothing. Worse, that wiring runs AFTER the QR handler's own
       setTool('select'), so it clobbered the cleanup and the state
       survived a successful insert (2026-08-17).
       The stray class is gone; this makes the whole family of that bug
       impossible rather than fixing the one instance of it. */
    if(!TOOLS[t]) t='select';
    tool=t;
    $$('#edit-tools .et').forEach(function(b){
      b.setAttribute('aria-pressed',(b.dataset.tool===t).toString());});
    var shb=$('#sh-btn');   /* the Shapes dropdown draws the 'rect' tool */
    if(shb) shb.setAttribute('aria-pressed',(t==='rect').toString());
    var l=stage.querySelector('.annot-layer');
    if(l) l.className='annot-layer tool-'+t;
    /* The way OUT, shown exactly when there is something to get out of.
       Escape has always de-armed a tool, but nothing said so, and an
       armed tool otherwise looks identical to no tool at all except for
       the cursor (2026-08-10, user). It sits beside the tools rather than
       in the hint, because the hint is the first thing the fit ladder
       drops and the exit must never be droppable. */
    var cx=$('#et-cancel');
    if(cx) cx.hidden=(t==='select');
    if(t!=='select') cropMode=false;
    var hint=$('#et-hint');
    /* "the slide" is wrong on a poster, which is one printed page and has
       no slides — the word leaked into every one of these (2026-08-07
       audit; cf. the Page/Slide label and the Versions button) */
    var pw=pageOf().poster?'the page':'the slide';
    if(hint) hint.textContent=
      t==='text'?'Drag on '+pw+' to draw a text box, or click for one that '
        +'sizes itself'
      :t==='arrow'?'Drag on '+pw+' to draw an arrow'
      :t==='rect'?('Drag on '+pw+' to draw a '
        +(pendingShape==='rect'?'rectangle':pendingShape))
      :t==='line'?'Drag on '+pw+' to draw a line'
      :t==='cell'?'Drag on '+pw+' to draw a cell frame (or click for the '
        +'usual size), then pick a card from your notebook to fill it'
      /* NOTHING in the resting state. A hint earns its place by telling
         you about a mode you have just entered and cannot see; describing
         the default state — click to select, drag to move — is a caption
         on the obvious, sitting in the middle of the toolbar forever
         (2026-08-10, user: "what is that even there?"). */
      :'';
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
  /* the two colour POPUPS: open on their buttons, close on outside
     click or on picking a swatch (custom keeps its own panel flow) */
  /* the two colour mutations, shared by the preset swatches, the recent
     chips, the custom picker and the hover preview — one implementation
     of "what does this colour mean for this kind of item" each */
  function textMut(c){return function(a){
    if(a.k==='cell') a.txcol=c;
    else a.color=c;};}
  function fillMut(c){return function(a){
    if(a.k==='cell'){a.bgcol=c;}
    else if(a.k==='draw'){
      /* a drawn stroke has no fill to speak of — the swatch sets the
         ink, which is the only colour it has */
      if(c!=='none') a.color=c;
    }
    else if(a.k==='rect'){
      /* a shape's fill lives in a.fill/a.fillc — a.bg/a.bgc are the
         TEXT-box background and no shape renderer reads them. The
         gradient has to go, because cssFill and drawShapeSvg both
         check a.grad first and would ignore the new colour. */
      delete a.grad;
      if(c==='none'){a.fill=0;delete a.fillc;}
      else {a.fill=1;a.fillc=c;}
    }
    else if(c==='none'){a.bg=0;}
    else{a.bg=1;a.bgc=c;}};}
  function applyTextColor(c){
    if(colorSelection(c)) return;
    fmtApply(textMut(c));
  }
  function applyFillColor(c){fmtApply(fillMut(c));}
  /* ---- live preview: hovering a swatch shows the colour ON the page,
     leaving puts it back (2026-08-19, user: colours should preview live).
     The selected item is snapshotted, mutated for the render only, and
     restored — markDirty is never called, so autosave and undo never see
     a hover. ---- */
  var pvSnap=null;
  function pvAnnot(){
    var s=pres.slides[cur];
    return (s&&typeof selAnnot==='number')?(s.annots||[])[selAnnot]:null;
  }
  function pvRender(){
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(l&&s){renderAnnots(l,s);selectAnnot(l,selAnnot);}
  }
  function pvShow(mut){
    var a=pvAnnot();
    /* a highlighted RUN inside a text box is recoloured through the
       selection, which a hover must not disturb */
    if(!a||activeTextEditable()) return;
    if(pvSnap==null) pvSnap=JSON.stringify(a);
    mut(a);
    pvRender();
  }
  /* silent=true when a real apply follows immediately: it re-renders
     anyway, so the restore only has to fix the MODEL */
  function pvEnd(silent){
    if(pvSnap==null) return;
    var a=pvAnnot();
    if(a){
      var back=JSON.parse(pvSnap);
      Object.keys(a).forEach(function(k){delete a[k];});
      Object.keys(back).forEach(function(k){a[k]=back[k];});
    }
    pvSnap=null;
    if(!silent) pvRender();
  }
  /* the recent-colour chips, rebuilt from the picker's history each time
     a colour menu opens */
  function renderSwRecents(menu){
    var box=menu.querySelector('.sw-recrow');
    if(!box) return;
    var rec=cpRecent().slice(0,6);
    box.innerHTML='';
    box.hidden=!rec.length;
    if(!rec.length) return;
    var lab=document.createElement('span');
    lab.className='sw-reclab';lab.textContent='recent';
    box.appendChild(lab);
    rec.forEach(function(str){
      var b=document.createElement('button');
      b.type='button';b.className='sw-rc';b.title=str;
      b.style.background=str;
      b.dataset.c=str;
      box.appendChild(b);
    });
  }
  [['#fmt-txcol-btn','#fmt-txcol-menu','text'],
   ['#fmt-fillcol-btn','#fmt-fillcol-menu','fill']].forEach(function(pair){
    var btn=$(pair[0]),menu=$(pair[1]),target=pair[2];
    if(!btn||!menu) return;
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open.toString());
      if(open){renderSwRecents(menu);floatMenu(btn,menu);}
      else pvEnd(false);
    });
    /* CAPTURE phase: any click inside the menu restores the hover preview
       BEFORE a swatch's own apply handler runs, or the apply would land on
       the previewed state and then be clobbered by the restore */
    menu.addEventListener('click',function(){pvEnd(false);},true);
    menu.addEventListener('click',function(e){
      var rc=e.target.closest&&e.target.closest('.sw-rc');
      if(rc){
        if(target==='text') applyTextColor(rc.dataset.c);
        else applyFillColor(rc.dataset.c);
      }
      var sw=e.target.closest&&e.target.closest('.sw');
      if(rc||(sw&&!sw.classList.contains('sw-custom'))){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    });
    menu.addEventListener('mouseover',function(e){
      var sw=e.target.closest&&e.target.closest('.sw,.sw-rc');
      if(!sw||sw.classList.contains('sw-custom')) return;
      var c=sw.dataset.c; if(c==null) return;
      pvEnd(true);                /* put back the previous hover first */
      pvShow(target==='text'?textMut(c):fillMut(c));
    });
    menu.addEventListener('mouseleave',function(){pvEnd(false);});
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');
        pvEnd(false);}
    });
  });
  $$('#et-fmt .sw:not(.swbg):not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('mousedown',function(e){
      /* keep the caret/selection in the text box so we can recolour just
         the highlighted run instead of the whole box */
      if(activeTextEditable()) e.preventDefault();
    });
    sw.addEventListener('click',function(){
      applyTextColor(sw.dataset.c);
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
  /* ---- line style / weight / arrow ends / route -----------------------
     These four SHOW the option instead of naming it. They used to be
     worded lists — "Dash-dot", "Stealth", "Curved the other way", and a
     Weight button that cycled through three values and told you the
     result afterwards (2026-08-17, user: "use symbols with text on hover
     not typing what they are ... what the fuck are the curve options ...
     the weight just have all the options like word does").

     A word is a thing you decode into a picture; for a dash pattern, an
     arrowhead or a thickness the picture IS the answer, and mirroring
     "curved" in your head to get "curved the other way" is work nobody
     should be doing. Each row now draws the real thing — the same dash
     array the renderer uses, the same head path, the same relative
     weight — and keeps its name in the tooltip.

     This is NOT the wordless-glyph problem the ribbon buttons had
     (2026-08-07): a glyph STANDS FOR a thing and has to be learned; a
     preview is the thing. The buttons that open these menus stay
     worded. ---- */
  var SVG_=function(t){return document.createElementNS(SVGNS,t);};
  function svgBox(cls,vb,w,h){
    var s=SVG_('svg');
    s.setAttribute('class',cls);s.setAttribute('viewBox',vb);
    s.setAttribute('width',w);s.setAttribute('height',h);
    return s;
  }
  function strokeLine(x1,y1,x2,y2,w,dash){
    var l=SVG_('line');
    l.setAttribute('x1',x1);l.setAttribute('y1',y1);
    l.setAttribute('x2',x2);l.setAttribute('y2',y2);
    l.setAttribute('stroke','currentColor');
    l.setAttribute('stroke-width',w);
    l.setAttribute('stroke-linecap','round');
    if(dash) l.setAttribute('stroke-dasharray',dash);
    return l;
  }
  /* a 110x16 rule in the real dash array, so "dash-dot" is a dash and a
     dot rather than a hyphenated word */
  function styleIcon(id){
    var s=svgBox('ln-prev','0 0 110 16',110,16);
    s.appendChild(strokeLine(3,8,107,8,2.4,LINE_DASH[id]||''));
    return s;
  }
  /* ---- WEIGHT, in printed points, the way Word lists it. The ladder is
     Word's own; what a point costs in stored units depends on the page,
     because weight here is page-relative like everything else, so the
     conversion happens at pick time against the page you are on. ---- */
  var SW_PT=[0.25,0.5,0.75,1,1.5,2.25,3,4.5,6];
  var PT_MM=2.834645;
  function ptToSw(pt,pg){
    pg=pg||pageOf();
    return pt/PT_MM*SW_REF_H/(pg.mm[1]||191);
  }
  function swPt(a,pg){return swMm(a,pg)*PT_MM;}
  function ptLabel(pt){return String(pt).replace(/\.?0+$/,'')+' pt';}
  function weightIcon(pt){
    var s=svgBox('ln-prev','0 0 110 16',110,16);
    s.appendChild(strokeLine(3,8,107,8,Math.max(0.8,pt*1.6),''));
    return s;
  }
  /* a stub of line carrying the real head path, pointing the way that end
     points, so Start and End are told apart by looking */
  function headIcon(id,atStart){
    var s=svgBox('hd-ico','0 0 32 16',32,16);
    var h=HEAD_BY[id];
    s.appendChild(strokeLine(atStart?11:2,8,atStart?30:21,8,1.8,''));
    if(h&&h.path){
      var g=SVG_('g');
      g.setAttribute('transform',atStart
        ?'translate(12,3) scale(-1,1)':'translate(20,3)');
      var p=SVG_('path');
      p.setAttribute('d',h.path);
      if(h.open){
        p.setAttribute('fill','none');
        p.setAttribute('stroke','currentColor');
        p.setAttribute('stroke-width','1.8');
      } else p.setAttribute('fill','currentColor');
      g.appendChild(p);s.appendChild(g);
    }
    return s;
  }
  /* the same triangle at each size, so "Small" and "Huge" are a
     comparison rather than two adjectives */
  function headSizeIcon(z){
    var s=svgBox('hd-ico','0 0 32 16',32,16);
    s.appendChild(strokeLine(2,8,20,8,1.8,''));
    var k=(HEADSZ_BY[z]||HEADSZ_BY.md).mul/6.5;
    var g=SVG_('g');
    g.setAttribute('transform','translate(20,8) scale('+k+') translate(0,-5)');
    var p=SVG_('path');
    p.setAttribute('d',HEAD_BY.triangle.path);
    p.setAttribute('fill','currentColor');
    g.appendChild(p);s.appendChild(g);
    return s;
  }
  /* the routes, drawn. "Curved the other way" was a sentence you had to
     mirror in your head; this is two pictures side by side. */
  var ROUTES=[
    {id:'straight',label:'Straight',d:'M4 24 L28 8'},
    {id:'curve',label:'Curved one way',d:'M4 24 Q4 8 28 8'},
    {id:'curve-',label:'Curved the other way',d:'M4 24 Q28 24 28 8'},
    {id:'h',label:'Elbow — across, then down',d:'M4 8 L28 8 L28 24'},
    {id:'v',label:'Elbow — down, then across',d:'M4 8 L4 24 L28 24'}];
  function routeIcon(d){
    var s=svgBox('bd-ico','0 0 32 32',32,32);
    var p=SVG_('path');
    p.setAttribute('d',d);p.setAttribute('fill','none');
    p.setAttribute('stroke','currentColor');
    p.setAttribute('stroke-width','2');
    p.setAttribute('stroke-linecap','round');
    p.setAttribute('stroke-linejoin','round');
    s.appendChild(p);
    return s;
  }
  /* one drawn, wordless-on-screen, fully-named-in-the-tooltip option */
  function drawnOpt(menu,btn,title,node,key,onPick){
    var o=document.createElement('button');
    o.className='sh-opt';o.title=title;
    o.setAttribute('aria-label',title);
    o.setAttribute('aria-pressed','false');
    o.dataset.optKey=key;
    o.appendChild(node);
    o.addEventListener('click',function(e){
      e.stopPropagation();onPick();
      menu.hidden=true;btn.setAttribute('aria-expanded','false');
    });
    menu.appendChild(o);
    return o;
  }
  function menuHead(menu,text){
    var h=document.createElement('div');
    h.className='hd-lab';h.textContent=text;menu.appendChild(h);
    return h;
  }
  function menuRow(menu,cls){
    var r=document.createElement('div');
    r.className='hd-row'+(cls?' '+cls:'');menu.appendChild(r);
    return r;
  }
  (function buildLineMenus(){
    var st=wireMenuToggle('fmt-stylewrap','fmt-style','fmt-style-menu');
    if(st) LINE_STYLES.forEach(function(s){
      drawnOpt(st.menu,st.btn,s.label,styleIcon(s.id),'ls:'+s.id,
        function(){fmtApply(function(a){a.style=s.id;delete a.dash;});});
    });
    var sw=wireMenuToggle('fmt-swwrap','fmt-sw','fmt-sw-menu');
    if(sw) SW_PT.forEach(function(pt){
      var o=drawnOpt(sw.menu,sw.btn,ptLabel(pt)+' — the printed thickness '
        +'on this page',weightIcon(pt),'sw:'+pt,
        function(){fmtApply(function(a){a.sw=ptToSw(pt);});});
      var v=document.createElement('span');
      v.className='sw-val';v.textContent=ptLabel(pt);
      o.appendChild(v);
    });
    /* ENDS: three labelled rows rather than eighteen worded lines that
       all began with the same word */
    var hd=wireMenuToggle('fmt-headwrap','fmt-head','fmt-head-menu');
    if(hd){
      menuHead(hd.menu,'Start');
      var r1=menuRow(hd.menu);
      HEADS.forEach(function(h){
        r1.appendChild(drawnOpt(hd.menu,hd.btn,h.label,
          headIcon(h.id,true),'s:'+h.id,
          function(){fmtApply(function(a){a.tail=h.id;});}));
      });
      menuHead(hd.menu,'End');
      var r2=menuRow(hd.menu);
      HEADS.forEach(function(h){
        r2.appendChild(drawnOpt(hd.menu,hd.btn,h.label,
          headIcon(h.id,false),'e:'+h.id,
          function(){fmtApply(function(a){
            a.head=h.id;delete a.nohead;});}));
      });
      menuHead(hd.menu,'Size');
      var r3=menuRow(hd.menu,'hd-sz');
      HEAD_SIZES.forEach(function(z){
        r3.appendChild(drawnOpt(hd.menu,hd.btn,z.label,
          headSizeIcon(z.id),'z:'+z.id,
          function(){fmtApply(function(a){a.hsz=z.id;});}));
      });
    }
    /* CHANGE SHAPE: the same fifteen shapes the Insert menu offers,
       drawn by the same shapeIcon, instead of a button that stepped
       through them one click at a time with no way back (2026-08-17). */
    var sp=wireMenuToggle('fmt-shapewrap','fmt-shape','fmt-shape-menu');
    if(sp) SHAPE_LIST.forEach(function(pair){
      drawnOpt(sp.menu,sp.btn,pair[1],shapeIcon(pair[0]),'sp:'+pair[0],
        function(){fmtApply(function(a){
          if(pair[0]==='rect') delete a.shape; else a.shape=pair[0];});});
    });
    var bd=wireMenuToggle('fmt-bendwrap','fmt-bend','fmt-bend-menu');
    if(bd) ROUTES.forEach(function(r){
      drawnOpt(bd.menu,bd.btn,r.label,routeIcon(r.d),'bd:'+r.id,
        function(){fmtApply(function(a){
          if(r.id==='straight'){delete a.bend;delete a.curve;}
          else if(r.id==='curve'){delete a.bend;a.curve=14;}
          else if(r.id==='curve-'){delete a.bend;a.curve=-14;}
          else {a.bend=r.id;delete a.curve;}
        });});
    });
  })();
  /* which option the selection is ON. Without it a drawn menu is a set of
     pictures with no answer to "and which one am I?" — the one thing the
     worded lists were no better at, and the reason a cycling Weight
     button felt like guessing. */
  function syncLineMenus(a){
    if(!a) return;
    var cur={};
    cur['ls:'+lineStyle(a)]=1;
    cur['s:'+headStart(a)]=1;
    cur['e:'+headEnd(a)]=1;
    cur['z:'+headSize(a).id]=1;
    cur['bd:'+(a.bend?a.bend:(a.curve>0?'curve'
      :(a.curve<0?'curve-':'straight')))]=1;
    cur['sp:'+(a.shape||'rect')]=1;
    /* the nearest rung of the ladder, since a stored weight need not be
       exactly one of them (an older poster, or a page that has changed
       size since) */
    var pt=swPt(a),best=SW_PT[0];
    SW_PT.forEach(function(p){
      if(Math.abs(p-pt)<Math.abs(best-pt)) best=p;});
    cur['sw:'+best]=1;
    $$('#fmt-style-menu .sh-opt,#fmt-sw-menu .sh-opt,'
      +'#fmt-head-menu .sh-opt,#fmt-bend-menu .sh-opt,'
      +'#fmt-shape-menu .sh-opt').forEach(function(o){
      o.setAttribute('aria-pressed',cur[o.dataset.optKey]?'true':'false');
    });
  }
  wireFloatDropdown('fmt-fillwrap','fmt-fillstyle','fmt-fillstyle-menu',
    [['none','No fill'],['tint','Tint of the line colour'],
     ['solid','Solid colour…'],['lin','Gradient — linear'],
     ['linv','Gradient — vertical'],
     ['rad','Gradient — from the centre']],'fs',
    function(v){
      fmtApply(function(a){
        delete a.grad;
        if(v==='none'){a.fill=0;delete a.fillc;}
        else if(v==='tint'){a.fill=1;delete a.fillc;}
        else if(v==='solid'){a.fill=1;a.fillc=a.fillc||a.color||'#39a9c0';}
        else {
          a.fill=1;
          var base=a.fillc||a.color||'#39a9c0';
          a.grad={type:(v==='rad'?'radial':'linear'),
            a:base,b:gradPartner(base),
            ang:(v==='linv'?90:0)};
        }
      });
    });
  /* alignment, bullets and curve in one worded menu. The curve options
     are listed inline rather than nested — a menu that opens a menu is
     worse than a slightly longer list. */
  wireFloatDropdown('fmt-parawrap','fmt-para','fmt-para-menu',
    [['a:left','Align left'],['a:center','Align centre'],
     ['a:right','Align right'],
     ['c:0','Curve: straight'],
     ['c:12','Curve: gentle arch up'],['c:30','Curve: arch up'],
     ['c:55','Curve: strong arch up'],
     ['c:-12','Curve: gentle sag (round the bottom in PowerPoint)'],
     ['c:-30','Curve: arch down (round the bottom in PowerPoint)']],'pa',
    function(v){
      /* Bullets and numbering are BUTTONS in the Text group now, not a
         line of this menu. Burying a toggle whose state you cannot see
         inside a dropdown called "Layout" is half of why it never behaved
         the way anyone expected (2026-08-20, user). */
      if(v.indexOf('a:')===0){
        var al=v.slice(2);
        fmtApply(function(a){a.align=al;});
        return;
      }
      var n=+v.slice(2);
      /* a bullet list has several baselines and no single curve to follow,
         so curving one turns the list off rather than quietly doing
         nothing — the two cannot both be true */
      fmtApply(function(a){
        if(!n){delete a.arc;return;}
        /* a list has several baselines and no single curve to follow, so
           curving one turns the list off rather than quietly doing
           nothing — the two cannot both be true. It converts the content
           back to lines instead of DELETING it, which is what the old
           `delete a.html` did (2026-08-20). */
        if(listOf(a)) setListStyle(a,0);
        a.arc=n;
      });
    });
  /* ---- bullets / numbering / indent ----------------------------------
     Real buttons that show their own state, because a list is something
     you can SEE is on. Indent and outdent drive the browser's own list
     machinery, which is what builds the nested <ul> the model stores. */
  function listApply(style){
    fmtApply(function(a){
      if(a.k!=='text') return;
      setListStyle(a,listOf(a)===style?0:style);
    });
  }
  /* plain listeners, not onFmt: onFmt wraps its callback in fmtApply and
     hands it one annot, and both of these already drive fmtApply
     themselves (the list ones) or act on the live caret (the indent
     ones) */
  function onBtn(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(e){e.preventDefault();fn();});
  }
  onBtn('#fmt-bullets',function(){listApply('bullet');});
  onBtn('#fmt-numbers',function(){listApply('number');});
  /* indent/outdent only mean anything with the caret inside the box, so
     they act on the live contenteditable rather than the model, and the
     blur handler writes the result back like any other typing */
  function listIndent(out){
    var el=activeTextEditable();
    if(!el||!el.classList.contains('an-ul')){
      toast('Click into the list first, then indent');return;
    }
    try{document.execCommand(out?'outdent':'indent',false,null);}catch(e){}
    el.focus();
  }
  onBtn('#fmt-indent',function(){listIndent(false);});
  onBtn('#fmt-outdent',function(){listIndent(true);});
  /* the far end of a generated gradient: the same hue taken most of the
     way to transparent, which reads as a wash rather than a second
     colour you did not choose */
  function gradPartner(col){
    var c=parseColor(col);
    if(!c) return '#00000000';
    return 'rgba('+clamp255(c.r)+', '+clamp255(c.g)+', '+clamp255(c.b)
      +', 0.06)';
  }
  $$('#et-fmt .swbg:not(.sw-custom)').forEach(function(sw){
    sw.addEventListener('click',function(){
      applyFillColor(sw.dataset.c);
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
    cpPreview();
  }
  /* the picker previews LIVE on the selected item as the colour changes;
     Apply commits it, closing without applying puts it back. A saved text
     RUN is the exception — its selection cannot survive a re-render. */
  function cpPreview(){
    if(!cpEl||cpEl.hidden||cpSavedRange) return;
    pvEnd(true);
    pvShow((cpTarget==='text'?textMut:fillMut)(toStr(cpRGBA)));
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
    if(target==='fill'){
      if(a.k==='cell') return a.bgcol||null;
      /* a shape prefills from its OWN fill, not the text-box background */
      if(a.k==='rect') return (a.grad&&a.grad.a)
        ||(a.fill?(a.fillc||a.color||null):null);
      return a.bg===0?null:(a.bgc||null);
    }
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
    pvEnd(true);          /* commit lands on the real state, not the preview */
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
      if(a.k==='cell') a.bgcol=str;
      else if(a.k==='rect'){a.fill=1;a.fillc=str;delete a.grad;}
      else {a.bg=1;a.bgc=str;}});
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
         &&e.target!==swc&&e.target!==swbgc){
        cpEl.hidden=true;pvEnd(false);}   /* closed without applying */
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&cpEl&&!cpEl.hidden){e.stopPropagation();
        cpEl.hidden=true;pvEnd(false);}
    },true);
  })();
  var fontSelEl=$('#fmt-font');
  if(fontSelEl){
    /* the picker is built from FONTS so the list, the canvas and the
       .pptx writer can never drift apart */
    fontSelEl.innerHTML=FONTS.map(function(f){
      return '<option value="'+f.id+'">'+esc(f.label)+'</option>';
    }).join('')+'<option value="__custom">Other…</option>';
    fontSelEl.addEventListener('change',function(){
      var v=this.value;
      if(v==='__custom'){
        var typed=prompt('Font family — exactly as it is named on this '
          +'computer (e.g. "Univers", "Source Sans Pro").\n\nIt has to be '
          +'installed to show here, and installed on any machine that '
          +'opens the PowerPoint. PDF export always embeds what you see.',
          '');
        typed=(typed||'').trim();
        if(!typed){renderControls();return;}
        fmtApply(function(a){a.font=typed;});
        return;
      }
      fmtApply(function(a){
        if(v==='sans') delete a.font; else a.font=v;
      });
    });
  }
  onFmt('#fmt-bold',function(a){a.b=a.b?0:1;});
  onFmt('#fmt-ital',function(a){a.i=a.i?0:1;});
  onFmt('#fmt-under',function(a){a.u=a.u?0:1;});
  onFmt('#fmt-strike',function(a){a.strike=a.strike?0:1;});
  var opRangeEl=$('#fmt-op');
  /* A range fires one `input` per step, so one drag across the opacity
     slider used to push ~100 undo entries and flush every real edit out
     of the 50-slot history. fmtApply's `quiet` flag exists for exactly
     this and the crop steppers already use it; this control never did.
     Live-preview on input, commit ONE entry on change. */
  if(opRangeEl){
    opRangeEl.addEventListener('input',function(){
      var pct=Math.max(0,Math.min(100,+this.value));
      fmtApply(function(a){
        if(pct>=100) delete a.op; else a.op=pct/100;},true);
    });
    opRangeEl.addEventListener('change',function(){
      fmtApply(function(){});   /* end of gesture: one undo entry */
    });
  }
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
  /* ---- copy / cut / paste ------------------------------------------
     Ctrl+D duplicates in place, which is not the same thing: it cannot
     carry an item to another poster, and it cannot bring anything IN. The
     internal buffer keeps whole annotations (so a copied figure frame is
     still a live figure frame, not a picture of one), and a system-
     clipboard image pastes straight onto the page — which is how logos
     and screenshots actually arrive. */
  var clipBuf=[],pendingPaste=null;
  function selectedIdxs(){
    var s=pres.slides[cur]; if(!s||!s.annots) return [];
    var out=selSet.filter(function(i){
      return typeof i==='number'&&s.annots[i];});
    if(!out.length&&typeof selAnnot==='number'&&s.annots[selAnnot])
      out=[selAnnot];
    return out;
  }
  function copySel(){
    var s=pres.slides[cur];
    var idxs=selectedIdxs(); if(!s||!idxs.length) return 0;
    clipBuf=idxs.map(function(i){
      return JSON.parse(JSON.stringify(s.annots[i]));});
    /* stamp the SYSTEM clipboard so this copy outranks whatever image was
       on it: the paste listener checked the OS clipboard first, so one
       stale screenshot shadowed every internal copy forever — Ctrl+C said
       "1 item copied", Ctrl+V pasted the screenshot (2026-08-20 diagnosis,
       reproduced live). Best-effort: inside the Ctrl+C gesture Chromium
       allows it; anywhere it fails the old ordering simply remains. */
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText)
        navigator.clipboard.writeText('junoview/items').catch(function(){});
    }catch(err){}
    return clipBuf.length;
  }
  function cutSel(){
    var n=copySel();
    if(n) deleteSel();
    return n;
  }
  function pasteBuf(){
    var s=pres.slides[cur];
    if(!s||!clipBuf.length) return 0;
    s.annots=s.annots||[];
    var first=s.annots.length;
    clipBuf.forEach(function(src){
      var cp=JSON.parse(JSON.stringify(src));
      delete cp.grp;          /* a paste is its own item, never in the
                                 source's group */
      if(cp.anim) cp.anim={type:cp.anim.type,order:nextAnimOrder(s)};
      if(cp.k==='arrow'){cp.x1+=3;cp.y1+=3;cp.x2+=3;cp.y2+=3;}
      else {cp.x=(cp.x||0)+3;cp.y=(cp.y||0)+3;}
      s.annots.push(cp);
    });
    /* paste again and the next copy lands clear of this one, rather than
       stacking every paste on the same 3% offset */
    clipBuf=clipBuf.map(function(cp){
      var n=JSON.parse(JSON.stringify(cp));
      if(n.k==='arrow'){n.x1+=3;n.y1+=3;n.x2+=3;n.y2+=3;}
      else {n.x=(n.x||0)+3;n.y=(n.y||0)+3;}
      return n;
    });
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){
      renderAnnots(l,s);
      selectAnnot(l,first);
      for(var i=first+1;i<s.annots.length;i++) selectAnnot(l,i,true);
    }
    return clipBuf.length;
  }
  /* an image on the system clipboard becomes an image item */
  function pasteImageFile(file){
    if(!file) return false;
    var fr=new FileReader();
    fr.onload=function(){
      var s=pres.slides[cur]; if(!s) return;
      var img=new Image();
      img.onload=function(){
        /* land it at a sane size: 30% of the page width, keeping the
           image's own aspect so it is not squashed on arrival */
        var pg=pageOf();
        var w=30,h=w*(img.naturalHeight/img.naturalWidth)
          *(pg.mm[0]/pg.mm[1]);
        if(!isFinite(h)||h<=0) h=24;
        if(h>80){h=80;w=h*(img.naturalWidth/img.naturalHeight)
          *(pg.mm[1]/pg.mm[0]);}
        s.annots=s.annots||[];
        s.annots.push({k:'image',x:50-w/2,y:50-h/2,w:w,h:h,
          src:fr.result});
        markDirty();
        var l=stage.querySelector('.annot-layer');
        if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
        toast('Image pasted');
      };
      img.onerror=function(){toast('That image could not be read');};
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
    return true;
  }
  document.addEventListener('paste',function(e){
    /* the Ctrl+V keydown armed a fallback in case this event never comes
       (some engines fire no paste on a non-editable focus) — it did, so
       disarm it before anything else or the item would paste twice */
    if(pendingPaste){clearTimeout(pendingPaste);pendingPaste=null;}
    if(deckEl.hidden||mode!=='edit') return;
    var tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||e.target.isContentEditable) return;
    /* a fresh internal copy left its marker on the OS clipboard — prefer
       the internal buffer over a stale clipboard image (see copySel) */
    var mk='';
    try{mk=e.clipboardData?e.clipboardData.getData('text/plain')||'':'';}
    catch(err){}
    if(clipBuf.length&&mk.indexOf('junoview/items')===0){
      e.preventDefault();pasteBuf();return;
    }
    var items=(e.clipboardData||{}).items||[];
    for(var i=0;i<items.length;i++){
      if(items[i].type&&items[i].type.indexOf('image/')===0){
        e.preventDefault();
        pasteImageFile(items[i].getAsFile());
        return;
      }
    }
    if(clipBuf.length){e.preventDefault();pasteBuf();}
  });

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
  /* ---- align / distribute --------------------------------------------
     Row and Grid RE-ARRANGE a selection into a formation. Aligning is the
     other thing, and the one poster work needs constantly: leave items
     where they are and make one edge agree. Everything is measured off
     the VISUAL rect, so a letterboxed figure aligns by the plot you can
     see rather than by its padded frame. */
  /* Arrange lives in a menu that also holds single-item actions, so it is
     offered whenever anything is selected — which means these four CAN be
     reached with nothing they are able to move. Say so rather than
     appearing to be broken (2026-08-07 audit). */
  function needTwo(items,what){
    if(items.length>=2) return false;
    toast('Select at least two items to '+what
      +' — arrows, locked and hidden items don’t count');
    return true;
  }
  function alignSel(edge){
    var items=selRects(); if(needTwo(items,'line up')) return;
    var bb=selBBox(items);
    items.forEach(function(x){
      if(edge==='left') placeAt(x,bb.l,x.r.t);
      else if(edge==='right') placeAt(x,bb.r-x.w,x.r.t);
      else if(edge==='hcenter') placeAt(x,(bb.l+bb.r)/2-x.w/2,x.r.t);
      else if(edge==='top') placeAt(x,x.r.l,bb.t);
      else if(edge==='bottom') placeAt(x,x.r.l,bb.b-x.h);
      else if(edge==='vmiddle') placeAt(x,x.r.l,(bb.t+bb.b)/2-x.h/2);
    });
    rerenderSel();
  }
  /* equal GAPS, not equal centres: with items of different sizes, even
     centres still look wrong — it is the whitespace between them the eye
     measures. The outermost two stay put and define the span. */
  function distributeSel(axis){
    var items=selRects();
    if(items.length<3){
      toast('Select at least three items to space them out evenly');
      return;
    }
    var horiz=(axis==='h');
    items.sort(function(p,q){
      return horiz?(p.r.l-q.r.l):(p.r.t-q.r.t);});
    var bb=selBBox(items),sum=0;
    items.forEach(function(x){sum+=horiz?x.w:x.h;});
    var span=horiz?(bb.r-bb.l):(bb.b-bb.t);
    var gap=(span-sum)/(items.length-1);
    var at=horiz?bb.l:bb.t;
    items.forEach(function(x){
      if(horiz) placeAt(x,at,x.r.t); else placeAt(x,x.r.l,at);
      at+=(horiz?x.w:x.h)+gap;
    });
    rerenderSel();
  }
  /* one worded menu for everything that arranges: line up, space out,
     stack order, rotate, tidy into a formation */
  wireFloatDropdown('fmt-alignwrap','fmt-align-btn','fmt-align-menu',
    [['left','Align left edges'],
     ['hcenter','Align centres (side to side)'],
     ['right','Align right edges'],
     ['top','Align top edges'],
     ['vmiddle','Align middles (top to bottom)'],
     ['bottom','Align bottom edges'],
     ['d:h','Equal gaps across (3+ items)'],
     ['d:v','Equal gaps down (3+ items)'],
     ['o:front','Bring to front'],
     ['o:back','Send to back'],
     ['o:rotl','Rotate left 15°'],
     ['o:rotr','Rotate right 15°'],
     ['o:row','Tidy into a row'],
     ['o:grid','Tidy into a grid']],'al',
    function(what){
      if(what.indexOf('d:')===0){distributeSel(what.slice(2));return;}
      if(what.indexOf('o:')===0){
        /* drive the original buttons so each keeps its one implementation */
        var b=$({front:'#fmt-front',back:'#fmt-back',rotl:'#fmt-rotl',
          rotr:'#fmt-rotr',row:'#fmt-arline',grid:'#fmt-argrid'
        }[what.slice(2)]);
        if(b) b.click();
        return;
      }
      alignSel(what);
    });
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
  /* ---- QR generator (2026-08-04): byte mode, ECC level M, versions
     1-10 (~200 chars — plenty for a repo / DOI link), all 8 masks with
     spec penalty scoring; output is vector SVG so it prints crisp at A0.
     Self-contained on purpose: a poster QR must not depend on someone
     else's URL-shortener service. Verified by machine-decoding the
     rendered output (see tests). ---- */
  var QR_M_TAB=[            /* [version, ecPerBlock, data cw per block] */
    [1,10,[16]],[2,16,[28]],[3,26,[44]],[4,18,[32,32]],[5,24,[43,43]],
    [6,16,[27,27,27,27]],[7,18,[31,31,31,31]],[8,22,[38,38,39,39]],
    [9,22,[36,36,36,37,37]],[10,26,[43,43,43,43,44]]];
  var QR_ALIGN=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],
    [6,24,42],[6,26,46],[6,28,50]];
  var GF_EXP=new Array(512),GF_LOG=new Array(256);
  (function(){
    var x=1,i;
    for(i=0;i<255;i++){
      GF_EXP[i]=x;GF_LOG[x]=i;
      x<<=1; if(x&256) x^=0x11d;
    }
    for(i=255;i<512;i++) GF_EXP[i]=GF_EXP[i-255];
  })();
  function gfMul(a,b){return (a&&b)?GF_EXP[GF_LOG[a]+GF_LOG[b]]:0;}
  function rsEc(data,n){
    var g=[1],i,j;                 /* generator, highest degree first */
    for(i=0;i<n;i++){
      var ng=[],k;
      for(k=0;k<=g.length;k++) ng.push(0);
      for(j=0;j<g.length;j++){
        ng[j]^=g[j];
        ng[j+1]^=gfMul(g[j],GF_EXP[i]);
      }
      g=ng;
    }
    var res=[];
    for(i=0;i<n;i++) res.push(0);
    for(i=0;i<data.length;i++){
      var f=data[i]^res[0];
      res.shift();res.push(0);
      if(f) for(j=0;j<n;j++) res[j]^=gfMul(g[j+1],f);
    }
    return res;
  }
  function qrMatrix(text){
    var bytes=[],enc=encodeURIComponent(text),i,j,x,y;
    for(i=0;i<enc.length;i++){
      if(enc[i]==='%'){bytes.push(parseInt(enc.substr(i+1,2),16));i+=2;}
      else bytes.push(enc.charCodeAt(i));
    }
    var ver=0,tab=null,dataCw=0;
    for(i=0;i<QR_M_TAB.length;i++){
      var cw=0;
      for(j=0;j<QR_M_TAB[i][2].length;j++) cw+=QR_M_TAB[i][2][j];
      if(4+(QR_M_TAB[i][0]<10?8:16)+bytes.length*8<=cw*8){
        ver=QR_M_TAB[i][0];tab=QR_M_TAB[i];dataCw=cw;break;}
    }
    if(!ver) return null;
    var bits=[];
    function put(v,n){for(var k=n-1;k>=0;k--) bits.push((v>>k)&1);}
    put(4,4);
    put(bytes.length,ver<10?8:16);
    for(i=0;i<bytes.length;i++) put(bytes[i],8);
    put(0,Math.min(4,dataCw*8-bits.length));
    while(bits.length%8) bits.push(0);
    var data=[];
    for(i=0;i<bits.length;i+=8){
      var v8=0;
      for(j=0;j<8;j++) v8=(v8<<1)|bits[i+j];
      data.push(v8);
    }
    var pi=0;
    while(data.length<dataCw) data.push([0xec,0x11][(pi++)%2]);
    var blocks=[],ecs=[],off=0,maxD=0;
    for(i=0;i<tab[2].length;i++){
      var d=data.slice(off,off+tab[2][i]);off+=tab[2][i];
      blocks.push(d);ecs.push(rsEc(d,tab[1]));
      maxD=Math.max(maxD,d.length);
    }
    var seq=[];
    for(i=0;i<maxD;i++) for(j=0;j<blocks.length;j++)
      if(i<blocks[j].length) seq.push(blocks[j][i]);
    for(i=0;i<tab[1];i++) for(j=0;j<ecs.length;j++)
      seq.push(ecs[j][i]);
    var N=17+ver*4,m=[],rsv=[];
    for(y=0;y<N;y++){
      var r1=[],r2=[];
      for(x=0;x<N;x++){r1.push(0);r2.push(0);}
      m.push(r1);rsv.push(r2);
    }
    function set(px,py,v){
      if(px<0||py<0||px>=N||py>=N) return;
      m[py][px]=v?1:0;rsv[py][px]=1;
    }
    function finder(cx,cy){
      for(var dy=-1;dy<=7;dy++)for(var dx=-1;dx<=7;dx++)
        set(cx+dx,cy+dy,dx>=0&&dx<=6&&dy>=0&&dy<=6
          &&(dx===0||dx===6||dy===0||dy===6
             ||(dx>=2&&dx<=4&&dy>=2&&dy<=4)));
    }
    finder(0,0);finder(N-7,0);finder(0,N-7);
    for(i=8;i<N-8;i++){
      if(!rsv[6][i]) set(i,6,i%2===0);
      if(!rsv[i][6]) set(6,i,i%2===0);
    }
    var ac=QR_ALIGN[ver-1];
    for(i=0;i<ac.length;i++) for(j=0;j<ac.length;j++){
      var cy=ac[i],cx=ac[j];
      /* skip only the three FINDER corners. An alignment pattern that
         crosses the timing lines (any middle coordinate from v7 up) IS
         drawn — an any-reserved-cell test silently dropped those two
         patterns and shifted the whole bit stream (2026-08-04). */
      if((cy<9&&cx<9)||(cy<9&&cx>N-10)||(cy>N-10&&cx<9)) continue;
      for(var dy2=-2;dy2<=2;dy2++)for(var dx2=-2;dx2<=2;dx2++)
        set(cx+dx2,cy+dy2,
          Math.max(Math.abs(dx2),Math.abs(dy2))!==1);
    }
    set(8,N-8,1);                              /* the dark module */
    for(i=0;i<9;i++){rsv[8][i]=1;rsv[i][8]=1;}
    for(i=N-8;i<N;i++){rsv[8][i]=1;rsv[i][8]=1;}
    if(ver>=7) for(i=0;i<6;i++) for(j=N-11;j<N-8;j++){
      rsv[j][i]=1;rsv[i][j]=1;}
    var bi=0,total=seq.length*8;
    function bitAt(k){return (seq[k>>3]>>(7-(k&7)))&1;}
    var cx2=N-1,up=true;
    while(cx2>0){
      if(cx2===6) cx2--;
      for(var yy=0;yy<N;yy++){
        var py2=up?N-1-yy:yy;
        for(var xx=0;xx<2;xx++){
          var px2=cx2-xx;
          if(rsv[py2][px2]) continue;
          m[py2][px2]=bi<total?bitAt(bi):0;bi++;
        }
      }
      up=!up;cx2-=2;
    }
    function maskBit(mk,my,mx){
      switch(mk){
        case 0:return (mx+my)%2===0;
        case 1:return my%2===0;
        case 2:return mx%3===0;
        case 3:return (mx+my)%3===0;
        case 4:return (Math.floor(my/2)+Math.floor(mx/3))%2===0;
        case 5:return (mx*my)%2+(mx*my)%3===0;
        case 6:return ((mx*my)%2+(mx*my)%3)%2===0;
        default:return ((mx+my)%2+(mx*my)%3)%2===0;
      }
    }
    function fmtBits(mk){
      var d=mk,v=d<<10,k;      /* EC level M = 00, then 3 mask bits */
      for(k=14;k>=10;k--) if((v>>k)&1) v^=0x537<<(k-10);
      return ((d<<10)|v)^0x5412;
    }
    function writeFormat(c,mk){
      var f=fmtBits(mk),k,bit;
      for(k=0;k<15;k++){
        bit=(f>>k)&1;
        if(k<6) c[k][8]=bit;
        else if(k===6) c[7][8]=bit;
        else if(k===7) c[8][8]=bit;
        else if(k===8) c[8][7]=bit;
        else c[8][14-k]=bit;
        if(k<8) c[8][N-1-k]=bit;
        else c[N-15+k][8]=bit;
      }
    }
    function writeVersion(c){
      var v=ver<<12,k;
      for(k=17;k>=12;k--) if((v>>k)&1) v^=0x1f25<<(k-12);
      v|=ver<<12;
      for(k=0;k<18;k++){
        var bit=(v>>k)&1,a2=Math.floor(k/3),b2=k%3+N-11;
        c[a2][b2]=bit;c[b2][a2]=bit;
      }
    }
    function penalty(c){
      var p=0,py,px,run,v;
      for(py=0;py<N;py++){
        run=1;
        for(px=1;px<=N;px++){
          if(px<N&&c[py][px]===c[py][px-1]) run++;
          else{if(run>=5)p+=3+run-5;run=1;}
        }
      }
      for(px=0;px<N;px++){
        run=1;
        for(py=1;py<=N;py++){
          if(py<N&&c[py][px]===c[py-1][px]) run++;
          else{if(run>=5)p+=3+run-5;run=1;}
        }
      }
      for(py=0;py<N-1;py++)for(px=0;px<N-1;px++){
        v=c[py][px];
        if(c[py][px+1]===v&&c[py+1][px]===v&&c[py+1][px+1]===v) p+=3;
      }
      var P1=[1,0,1,1,1,0,1,0,0,0,0],P2=[0,0,0,0,1,0,1,1,1,0,1];
      function scan(get){
        for(var a2=0;a2<N;a2++)for(var b2=0;b2<=N-11;b2++){
          var o1=true,o2=true;
          for(var k=0;k<11;k++){
            var vv=get(a2,b2+k);
            if(vv!==P1[k]) o1=false;
            if(vv!==P2[k]) o2=false;
          }
          if(o1) p+=40;
          if(o2) p+=40;
        }
      }
      scan(function(a2,b2){return c[a2][b2];});
      scan(function(a2,b2){return c[b2][a2];});
      var dark=0;
      for(py=0;py<N;py++)for(px=0;px<N;px++) dark+=c[py][px];
      p+=Math.floor(Math.abs(dark*100/(N*N)-50)/5)*10;
      return p;
    }
    var best=null,bestPen=1e9;
    for(var mk=0;mk<8;mk++){
      var c=[];
      for(y=0;y<N;y++) c.push(m[y].slice());
      for(y=0;y<N;y++)for(x=0;x<N;x++)
        if(!rsv[y][x]&&maskBit(mk,y,x)) c[y][x]^=1;
      writeFormat(c,mk);
      if(ver>=7) writeVersion(c);
      var pen=penalty(c);
      if(pen<bestPen){bestPen=pen;best=c;}
    }
    return best;
  }
  function qrSvgData(text){
    var m2=qrMatrix(text); if(!m2) return null;
    var n=m2.length,q=4,S=n+q*2,d='';
    for(var y=0;y<n;y++)for(var x=0;x<n;x++)
      if(m2[y][x]) d+='M'+(x+q)+' '+(y+q)+'h1v1h-1z';
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '
      +S+' '+S+'" shape-rendering="crispEdges">'
      +'<rect width="'+S+'" height="'+S+'" fill="#fff"/>'
      +'<path d="'+d+'" fill="#000"/></svg>';
    return 'data:image/svg+xml;base64,'
      +btoa(unescape(encodeURIComponent(svg)));
  }
  window.SemDeckQr=qrMatrix;   /* test hook */
  /* Line has NO handler here: it is a tool now (data-tool="line"), wired
     generically with every other .et button, and drawn by dragging like a
     shape. A listener here would fire ALONGSIDE that wiring, so clicking
     Line would both arm the tool and drop a ready-made rule on the page
     (2026-08-10). */
  var qrBtn=$('#dc-qr');
  if(qrBtn) qrBtn.addEventListener('click',function(){
    var s=pres.slides[cur];
    if(!s){toast('Add a slide first');return;}
    var url=prompt('Link for the QR code (repo / paper / data):',
      'https://');
    if(!url||url==='https://') return;
    var src=qrSvgData(url);
    if(!src){
      toast('That link is too long for a QR code (about 200 characters '
        +'at most)');
      return;
    }
    var l=stage.querySelector('.annot-layer');
    var lr=l?l.getBoundingClientRect():null;
    var w2=12,h2=12;
    if(lr&&lr.height) h2=w2*(lr.width/lr.height);
    h2=Math.max(4,Math.min(60,h2));
    s.annots=s.annots||[];
    s.annots.push({k:'image',x:84,y:Math.max(2,94-h2),w:w2,h:h2,src:src});
    markDirty();
    setTool('select');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
    else renderSlide();
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
    setTool('select');
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
    menu.style.right='auto';menu.style.bottom='auto';
    /* measure AFTER it is positionable, and clamp on BOTH axes: a tall
       catalogue opened from low down, or a wide one opened from the
       right-hand toolbar, would otherwise leave the screen */
    var r=btn.getBoundingClientRect();
    var mw=menu.offsetWidth||170;
    menu.style.left=Math.max(8,
      Math.min(r.left,window.innerWidth-mw-8))+'px';
    var mh=menu.offsetHeight||0;
    var top=r.bottom+4;
    if(mh&&top+mh>window.innerHeight-8)
      top=Math.max(8,Math.min(r.top-4-mh,window.innerHeight-mh-8));
    menu.style.top=top+'px';
  }
  /* Open/close/close-on-outside-click, shared by the WORDED dropdowns
     below and the DRAWN ones (line style, weight, ends, route). It was
     inline in wireFloatDropdown, so a menu whose rows are pictures rather
     than a list of strings had no way to reuse any of it (2026-08-17). */
  function wireMenuToggle(wrapId,btnId,menuId){
    var wrap=$('#'+wrapId),btn=$('#'+btnId),menu=$('#'+menuId);
    if(!wrap||!btn||!menu) return null;
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
    return {wrap:wrap,btn:btn,menu:menu};
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
    wireMenuToggle(wrapId,btnId,menuId);
  }
  /* ---- crop-to-shape dropdown (images + notebook cells) ---- */
  /* ---- DRAG-TO-TRIM: the crop the user reached for first. Picking
     "Rectangle" (now honestly "No crop") did nothing, because rectangle
     with no insets IS the uncropped state — the menu's most inviting
     option was a no-op (2026-08-19, user, twice). Trim mode shows four
     edge handles on the selected frame; dragging writes a.crop insets
     live, Esc or reselecting leaves the mode. ---- */
  var cropMode=false;
  function setCropMode(on){
    cropMode=!!on;
    var l=stage.querySelector('.annot-layer');
    if(l&&pres.slides[cur]){renderAnnots(l,pres.slides[cur]);paintSel(l);}
    if(on) toast('Drag the edge handles to trim. Esc to finish.');
  }
  function mkCropHandles(host,layer,s2,idx){
    var a=s2.annots[idx]; if(!a) return;
    ['t','r','b','l'].forEach(function(side){
      var h=document.createElement('div');
      h.className='an-crop-h an-crop-'+side;
      var c2=a.crop||{};
      if(side==='t') h.style.top=(c2.t||0)+'%';
      if(side==='b') h.style.bottom=(c2.b||0)+'%';
      if(side==='l') h.style.left=(c2.l||0)+'%';
      if(side==='r') h.style.right=(c2.r||0)+'%';
      h.title='Trim the '+side+' edge';
      h.addEventListener('pointerdown',function(ev){
        ev.stopPropagation();ev.preventDefault();
        /* the rect FIRST: the shape-drop below re-renders and detaches
           this host, and a detached rect is all zeros. clip-path does not
           affect layout, so the captured rect stays valid for the drag. */
        var r=host.getBoundingClientRect();
        /* trimming is rectangular: cropCss ignores insets while a SHAPE
           crop is set, so dragging a handle under an ellipse moved the
           handle and changed nothing (2026-08-20 diagnosis). Starting a
           trim honestly drops the shape. */
        if(a.crop&&a.crop.shape){delete a.crop.shape;
          renderAnnots(layer,s2);paintSel(layer);}
        function mv(e2){
          var v;
          if(side==='t') v=(e2.clientY-r.top)/r.height*100;
          else if(side==='b') v=(r.bottom-e2.clientY)/r.height*100;
          else if(side==='l') v=(e2.clientX-r.left)/r.width*100;
          else v=(r.right-e2.clientX)/r.width*100;
          v=Math.max(0,Math.min(45,Math.round(v)));
          a.crop=a.crop||{};
          if(v) a.crop[side]=v; else delete a.crop[side];
          renderAnnots(layer,s2);paintSel(layer);
        }
        function up(){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
          if(a.crop&&!a.crop.shape&&!a.crop.t&&!a.crop.r
            &&!a.crop.b&&!a.crop.l) delete a.crop;
          markDirty();
          renderAnnots(layer,s2);paintSel(layer);
        }
        document.addEventListener('pointermove',mv);
        document.addEventListener('pointerup',up);
      });
      host.appendChild(h);
    });
  }
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
  /* ---- rectangular TRIM (2026-08-04): the model always carried t/r/b/l
     inset percentages — this is the UI it never had. Four steppers in
     the crop menu, live on the selection: trimming whitespace off a
     figure is the single most common poster edit. ---- */
  (function(){
    var menu=$('#fmt-crop-menu'),btn=$('#fmt-crop');
    if(!menu||!btn) return;
    var tm=document.createElement('button');tm.type='button';
    tm.className='ci-trim';
    tm.innerHTML='&#9986; Trim by dragging the edges';
    tm.addEventListener('click',function(e){
      e.stopPropagation();
      menu.hidden=true;btn.setAttribute('aria-expanded','false');
      setCropMode(true);
    });
    menu.insertBefore(tm,menu.firstChild);
    var row=document.createElement('div');row.className='crop-inset';
    var lab=document.createElement('span');lab.className='ci-lab';
    lab.textContent='Trim edges %';row.appendChild(lab);
    var SIDES=[['t','top'],['r','right'],['b','bottom'],['l','left']];
    var inputs={};
    SIDES.forEach(function(p){
      var inp=document.createElement('input');
      inp.type='number';inp.min='0';inp.max='45';inp.step='1';
      inp.placeholder=p[1];
      inp.title='Trim the '+p[1]+' edge (% of the frame)';
      inp.addEventListener('click',function(e){e.stopPropagation();});
      inp.addEventListener('input',function(){
        var v=Math.max(0,Math.min(45,parseFloat(inp.value)||0));
        fmtApply(function(a){
          a.crop=a.crop||{};
          if(v) a.crop[p[0]]=v; else delete a.crop[p[0]];
          if(!a.crop.shape&&!a.crop.t&&!a.crop.r&&!a.crop.b&&!a.crop.l)
            delete a.crop;
        },true);              /* live preview, no history */
      });
      /* the gesture's END (blur / spinner release) commits ONE entry */
      inp.addEventListener('change',function(){
        fmtApply(function(){});
      });
      inputs[p[0]]=inp;row.appendChild(inp);
    });
    var rs=document.createElement('button');rs.type='button';
    rs.className='ci-reset';rs.textContent='Reset';
    rs.title='Clear the trim';
    rs.addEventListener('click',function(e){
      e.stopPropagation();
      SIDES.forEach(function(p){inputs[p[0]].value='';});
      fmtApply(function(a){
        if(!a.crop) return;
        delete a.crop.t;delete a.crop.r;delete a.crop.b;delete a.crop.l;
        if(!a.crop.shape) delete a.crop;
      });
    });
    row.appendChild(rs);
    menu.appendChild(row);
    /* opening the menu shows the SELECTION's current trim */
    btn.addEventListener('click',function(){
      var s=pres.slides[cur]; if(!s) return;
      var a=annotByIdx(s,selAnnot)
        ||(selSet.length?s.annots[selSet[0]]:null);
      SIDES.forEach(function(p){
        inputs[p[0]].value=(a&&a.crop&&a.crop[p[0]])||'';
      });
    });
  })();
  var animPaneSync=function(){},animPaneClose=function(){};
  var animRibbonSync=function(){};
  /* ---- animation PANE: effect + build order. Items on the same build appear
     TOGETHER; each build is one click in playback. ---- */
  (function(){
    var vbtn=$('#vw-anim'),pane=$('#animpane');
    var menu=$('#animpane-body'),cl=$('#animpane-close');
    if(!vbtn||!pane||!menu) return;
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
    /* ONE door. There were briefly two — View's Animations and an
       "Animate" button in an Effects group that renamed itself to the
       selected item's effect. Same pane, different groups, different
       names, both pressed at once (2026-08-17, user: "WHY IS ANIMATIONS
       AND APPEAR NOT IN THE SAME PLACE"). The pane's effect chooser
       already tracks the selection, which is everything the second
       button ever added. */
    function set(open){
      if(open){
        /* the panes share one corner, so only one can be the thing you
           are looking at — the same rule showVerpane already keeps */
        var sp=$('#selpane'); if(sp) sp.hidden=true;
        var ob=$('#objects-btn');
        if(ob) ob.setAttribute('aria-pressed','false');
        var pf=$('#preflight'); if(pf) pf.hidden=true;
        showVerpane(false);
        render();
      }
      pane.hidden=!open;
      vbtn.setAttribute('aria-pressed',open.toString());
    }
    vbtn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    if(cl) cl.addEventListener('click',function(){set(false);});
    /* the effect chooser at the top tracks the selection, so an open pane
       has to follow it rather than showing whatever was picked last */
    animPaneSync=function(){if(!pane.hidden) render();};
    animPaneClose=function(){set(false);};
    /* ---- the Animate TAB's own buttons --------------------------------
       "There doesn't seem to be a way to remove animations" (2026-08-20,
       user) — there was one, the None effect, but it was inside a pane
       you had to know to open, with an item selected, and it looked like
       any other effect rather than like a removal. The effects are now
       buttons in the ribbon where you can see which one is on, None reads
       as the undo it is, and Clear slide strips the whole slide in one
       press without hunting item by item. */
    [['anim-none','none'],['anim-fade','fade'],
     ['anim-rise','rise'],['anim-zoom','zoom']].forEach(function(p){
      var b=$('#'+p[0]);
      if(b) b.addEventListener('click',function(){setType(p[1]);});
    });
    var clr=$('#anim-clear');
    if(clr) clr.addEventListener('click',function(){
      var s=pres.slides[cur]; if(!s) return;
      var n=0;
      (s.annots||[]).forEach(function(a){if(a&&a.anim){delete a.anim;n++;}});
      if(!n){toast('Nothing on this slide is animated');return;}
      revealCount=0;commit(s);
      toast('Cleared '+n+(n===1?' animation':' animations')
        +' — everything is on the slide from the start');
    });
    /* the effect buttons act on the SELECTION, so they show the selected
       item's effect and stand down when there is nothing selected */
    animRibbonSync=function(){
      var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
      var on=!!a&&typeof selAnnot==='number';
      [['anim-none','none'],['anim-fade','fade'],
       ['anim-rise','rise'],['anim-zoom','zoom']].forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        b.hidden=!on;
        b.setAttribute('aria-pressed',
          (on&&(a.anim?a.anim.type:'none')===p[1]).toString());
      });
    };
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
      /* delete where the thing IS, not three menu levels away. Shown on
         hover / while current; confirm() because there is no undo for a
         deleted presentation. */
      var del=document.createElement('span');
      del.className='pr-del';del.title='Delete "'+nm+'"';
      del.innerHTML='&#10005;';
      del.addEventListener('click',function(e){
        e.stopPropagation();e.preventDefault();
        if(confirm('Delete "'+nm+'"? This cannot be undone.'))
          deletePresByName(nm);
      });
      t.appendChild(del);
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
    /* like a new presentation, nothing persists until the first edit.
       Posters start WHITE: they exist to be printed (2026-08-04) */
    var s=emptySlide();
    /* BLANK, not pre-filled: the 3-column academic template used to be
       applied here, so a new poster opened already covered in headings
       and placeholder frames you had to clear before starting your own
       (2026-08-18, user: "opening a poster should open as blank not a
       default fill"). The templates are all still one click away in
       Layouts — which is where choosing one belongs. Even the blank
       slide's full-page ghost frame goes: on a deck it is the "click to
       fill" idiom, but stretched over an A0 sheet it is one more thing
       you did not put there. */
    s.annots=[];
    pres={name:name,slides:[s],page:'a0p',pageBg:'#ffffff'};
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
    updateNumsLabel();updateCropLabel();
    var s=pres.slides[cur];
    $$('#layout-row .lay,#layout-menu-grid .lay,#layout-home-grid .lay')
      .forEach(function(b){
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
      /* Only "get me into the editor" survives. Going the other way is
         already the Notebooks button on the rail, and this duplicate was
         badly named and awkwardly placed in the bargain (2026-08-07,
         user: "the 'swap to notebooks' button is a stupid name and in a
         stupid place"). */
      eb.hidden=(mode==='edit');
      eb.innerHTML='&#9998; Open the editor';
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
  /* ---- slide thumbnails ------------------------------------------------
     A thumbnail is a SCALE MODEL of the slide, not a picture of the
     notebook cells on it. It used to walk slideCells() and nothing else,
     so a slide made of text, arrows, shapes or images showed as an empty
     box and every such slide in the strip looked identical (2026-08-20,
     user: "thumbnails do now show text, or anything else for that matter,
     just the cells").
     Everything is placed in the same page percentages the canvas uses, so
     positions are exactly right at any size. Two things cannot scale
     linearly and get a floor instead — type and stroke width — because
     0.3px of either is nothing at all. That is the opposite of the rule
     fontPx follows on the real page, and deliberately: the page is the
     document and must stay true to itself, a thumbnail is an INDEX and
     has to be legible. */
  var MINI_H=66;      /* mirrors --mini-h in deck.css */
  /* svg ids (gradients) must be unique across every thumbnail in the
     strip, not just within one — a repeated id would silently paint every
     later slide's gradient with the first slide's */
  var miniSeq=0;
  function miniText(d,a,txt,cls,centred){
    if(!String(txt||'').trim()) return;
    var t=document.createElement('span');
    t.className='mini-tx'+(cls?' '+cls:'');
    t.style.left=(a.x||0)+'%';t.style.top=(a.y||0)+'%';
    if(a.w!=null) t.style.width=a.w+'%';
    t.style.fontSize=Math.max(2,MINI_H*(a.size||2.6)/100).toFixed(2)+'px';
    if(a.color) t.style.color=a.color;
    if(a.b) t.style.fontWeight='700';
    if(a.i) t.style.fontStyle='italic';
    if(a.align) t.style.textAlign=a.align;
    if(a.font) t.style.fontFamily=fontCss(a.font);
    if(a.bg!==0&&a.bgc) t.style.background=a.bgc;
    /* a title is anchored on its CENTRE, the way the canvas anchors it */
    var tr=centred?'translate(-50%,-50%)':'';
    if(a.rot) tr+=(tr?' ':'')+'rotate('+a.rot+'deg)';
    if(tr) t.style.transform=tr;
    if(a.op!=null&&a.op<1) t.style.opacity=a.op;
    t.textContent=String(txt);
    d.appendChild(t);
  }
  /* a box-shaped item (shape, image, cell frame) at its page rect */
  function miniBox(d,a,cls){
    var b=document.createElement('span');
    b.className='mini-it'+(cls?' '+cls:'');
    b.style.left=(a.x||0)+'%';b.style.top=(a.y||0)+'%';
    b.style.width=(a.w||10)+'%';b.style.height=(a.h||10)+'%';
    if(a.rot) b.style.transform='rotate('+a.rot+'deg)';
    if(a.op!=null&&a.op<1) b.style.opacity=a.op;
    d.appendChild(b);
    return b;
  }
  /* the stroke a thumbnail draws: the page weight scaled down, floored so
     a hairline is still a line */
  function miniSw(a){
    return Math.max(0.6,swOf(a)*MINI_H/SW_REF_H).toFixed(2);
  }
  /* re-weight a borrowed shape/freehand svg for thumbnail scale, and drop
     its dash: dashes are measured in the stroke's own units, so a pattern
     sized for an A0 poster is one long dash across a 116px thumbnail */
  function miniStroke(host,a){
    var p=host.querySelector('path'); if(!p) return;
    p.setAttribute('stroke-width',miniSw(a));
    p.removeAttribute('stroke-dasharray');
  }
  function miniDiagram(s){
    var d=document.createElement('span');
    d.className='mini-diagram free';
    if(!s) return d;
    /* the slide's own background, so a recoloured slide reads as one */
    if(s.bg) d.style.background=s.bg;
    var annots=s.annots||[];
    if(s.layout!=='title'&&!annots.length){
      var e=document.createElement('span');
      e.className='mini-pane empty';
      d.appendChild(e);
      return d;
    }
    if(s.layout==='title'){
      miniText(d,titleProps(s,'t'),s.title||'Title','is-t',true);
      miniText(d,titleProps(s,'s'),s.sub||'','is-s',true);
    }
    /* arrows go last so they sit on top, exactly as on the canvas */
    var arrows=[];
    annots.forEach(function(a,i){
      if(!a||a.hide) return;
      if(a.k==='arrow'){arrows.push(a);return;}
      if(a.k==='text'){miniText(d,a,a.text||'');return;}
      if(a.k==='image'){
        var bx=miniBox(d,a,'is-img');
        if(a.src){
          var im=document.createElement('img');
          im.src=a.src;im.alt='';im.loading='lazy';im.draggable=false;
          if(a.crop) bx.classList.add('is-crop');
          bx.appendChild(im);
        }
        return;
      }
      if(a.k==='rect'){
        var bs=miniBox(d,a,'is-shape');
        bs.appendChild(drawShapeSvg(a.shape||'rect',a.color||'#ff6b57',
          miniSw(a),a,'m'+(miniSeq++),null));
        miniStroke(bs,a);
        return;
      }
      if(a.k==='draw'){
        var bd=miniBox(d,a,'is-shape');
        bd.appendChild(drawFreeSvg(a,null));
        miniStroke(bd,a);
        return;
      }
      if(a.k==='cell'){
        var w2=paneThumb(a.ref);
        w2.style.position='absolute';
        w2.style.left=(a.x||0)+'%';w2.style.top=(a.y||0)+'%';
        w2.style.width=(a.w||10)+'%';w2.style.height=(a.h||10)+'%';
        if(a.rot) w2.style.transform='rotate('+a.rot+'deg)';
        d.appendChild(w2);
      }
    });
    if(arrows.length){
      /* ONE svg for every arrow, in the page's own 0..100 percentage
         space — preserveAspectRatio="none" makes that space the
         thumbnail, so no pixel measurement is needed and nothing has to
         be re-scaled when the strip is resized */
      var sv=document.createElementNS(AN_NS,'svg');
      sv.setAttribute('class','mini-svg');
      sv.setAttribute('viewBox','0 0 100 100');
      sv.setAttribute('preserveAspectRatio','none');
      arrows.forEach(function(a){
        var p=document.createElementNS(AN_NS,'path');
        p.setAttribute('d',arrowPath(arrowEnds(null,s,a,0),a,100,100));
        p.setAttribute('fill','none');
        p.setAttribute('stroke',a.color||'#ff6b57');
        p.setAttribute('stroke-width',miniSw(a));
        p.setAttribute('vector-effect','non-scaling-stroke');
        p.setAttribute('stroke-linecap','round');
        if(a.op!=null&&a.op<1) p.setAttribute('opacity',a.op);
        sv.appendChild(p);
      });
      d.appendChild(sv);
    }
    return d;
  }
  /* ---- the other pages, as a floating pane -----------------------------
     The strip is MOVED into #verpane rather than rebuilt there, so
     reordering, drag-and-drop, delete and the thumbnails keep working
     with no second copy of any of it (2026-08-10, user: "the bar for this
     should appear like the objects bar"). */
  var filmHome=null;
  function filmToPane(){
    var body=$('#verpane-body'),list=$('#film-list'),add=$('#film-add');
    if(!body||!list||filmHome) return;
    filmHome={parent:list.parentNode,next:list.nextSibling};
    body.appendChild(list);
    if(add) body.appendChild(add);
  }
  function filmToPanel(){
    if(!filmHome) return;
    var list=$('#film-list'),add=$('#film-add');
    if(list&&filmHome.parent){
      if(filmHome.next&&filmHome.next.parentNode===filmHome.parent)
        filmHome.parent.insertBefore(list,filmHome.next);
      else filmHome.parent.appendChild(list);
      if(add) filmHome.parent.appendChild(add);
    }
    filmHome=null;
  }
  /* The button reports the state of whichever strip this page kind uses:
     the docked one for a deck, the floating pane for a poster. Written
     once, because two of these drifting apart is a toggle that lies about
     what it will do. */
  function syncStripBtn(){
    var vb=$('#vw-versions'); if(!vb) return;
    var p=$('#verpane');
    var on=pageOf().poster
      ? !!(p&&!p.hidden)
      : !deckEl.classList.contains('strip-off');
    vb.setAttribute('aria-pressed',on.toString());
  }
  function showVerpane(on){
    var p=$('#verpane'); if(!p) return;
    /* Objects and Versions are the same 232px shell in the same corner,
       so only one of them can be the thing you are looking at */
    if(on){
      var sp=$('#selpane'); if(sp) sp.hidden=true;
      var ob=$('#objects-btn');
      if(ob) ob.setAttribute('aria-pressed','false');
      var pf=$('#preflight'); if(pf) pf.hidden=true;
      filmToPane();
      renderFilm();
    }
    p.hidden=!on;
    var t=$('#verpane-title');
    if(t) t.textContent=pageOf().poster?'Versions':'Slides';
    syncStripBtn();
  }
  /* ---- versions --------------------------------------------------------
     A poster's other pages are drafts and variants, so a new one starts as
     a COPY of what you are looking at — that is what a variant is a
     variant OF — and it is named for you, because an unnamed pile of
     near-identical A0 sheets is unusable. The name is a starting point:
     Rename changes it. */
  function nextVersionName(){
    var n=0;
    (pres.slides||[]).forEach(function(s){
      var m=/^Version (\d+)$/.exec((s&&s.label)||'');
      if(m) n=Math.max(n,+m[1]);
    });
    return 'Version '+(n+1);
  }
  function newVersion(){
    var at=pres.slides.length?cur+1:0;
    if(!pageOf().poster){
      /* a DECK's slides are named by what is on them, which is more use
         than "Slide 3" — so no label is stamped here */
      pres.slides.splice(at,0,emptySlide());
    } else {
      var src=pres.slides[cur];
      /* name the page you were already on first, so the two read as a
         pair rather than "empty slide" and "Version 2" */
      if(src&&!src.label) src.label=nextVersionName();
      var cp=src?JSON.parse(JSON.stringify(src)):emptySlide();
      cp.label=nextVersionName();
      pres.slides.splice(at,0,cp);
    }
    cur=at;activePane=-1;selAnnot=null;selSet=[];
    markDirty();refresh();
    if(!$('#verpane').hidden) renderFilm();
  }
  function slideTitle(s){
    /* a version carries the name you were given or chose; only posters
       get one, so a deck slide is still named by what is ON it */
    if(s.label) return s.label;
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
        /* drag the ROW as the ghost — the browser otherwise picks up the
           figure <img> inside the thumbnail as the drag image/payload */
        try{e.dataTransfer.setDragImage(row,12,12);}catch(err){}
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
      var poster=pageOf().poster;
      var acts=[['↑',function(){moveSlide(i,-1);},
                 poster?'Move this version up':'Move slide up'],
                ['↓',function(){moveSlide(i,1);},
                 poster?'Move this version down':'Move slide down'],
                ['⧉',function(){dupSlide(i);},
                 poster?'Duplicate this version':'Duplicate slide'],
                ['✕',function(){delSlide(i);},
                 poster?'Delete this version':'Delete slide']];
      /* an autoname is a starting point, not a decision. This goes on a
         BUTTON rather than a double-click on the row: the row's own click
         re-renders the strip, so by the time a dblclick arrived the node
         it was editing had already been replaced (2026-08-10). */
      if(poster) acts.splice(2,0,['✎',function(){
        var s2=pres.slides[i]; if(!s2) return;
        var v=prompt('Name this version:',s2.label||slideTitle(s2));
        if(v==null) return;
        v=v.trim();
        if(v) s2.label=v; else delete s2.label;
        markDirty();renderFilm();
      },'Rename this version']);
      acts.forEach(function(p){
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
    /* the column shows the list whenever this build can DO anything with
       notebooks; the bare static export has none at all */
    var col=$('#dc-nbs');
    if(col) col.hidden=!(nbs.length||nbsCanOpen());
    buildNbsInto(col,true);
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
    setTimeout(renderNbsMenu,600);   /* refresh statuses, stay open */
  }
  function hideNbsMenu(){}   /* nothing floats any more; see renderNbsMenu */
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
  /* ONE place the notebook list lives: the top of the left column, on
     screen the whole time you are editing. There used to be a second copy
     in a floating pane behind a ribbon button, which is a group's worth of
     ribbon width spent on something already showing (2026-08-20, user: "so
     the notebook button can be removed now. Haven't we put all the
     functionality on the left hand side?"). */
  function renderNbsMenu(){
    buildNbsInto($('#dc-nbs'),true);
  }
  function buildNbsInto(m,column){
    if(!m) return;
    m.innerHTML='';
    var info=nbInfo();
    if(!info.length){
      m.innerHTML='<div class="dc-nbs-empty">No notebooks yet &mdash; add cells '
        +'from your notebooks to a slide.</div>';return;}
    var h=document.createElement('div');h.className='dc-nbs-menuh';
    h.textContent=column?'\u21a9 notebooks':'notebooks in this presentation';
    if(column){
      h.title='Back to all notebooks. Nothing is closed or lost.';
      h.addEventListener('click',function(){closeDeck();});
    }
    m.appendChild(h);
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
      if(n.open){
        row.classList.add('clickable');
        row.title='View this notebook';
        row.addEventListener('click',function(){
          closeDeck();
          if(APP.activate) APP.activate(n.stem);
        });
      } else if(n.openable){
        row.title=n.path;row.classList.add('clickable');
        row.addEventListener('click',function(){
          /* the pane stays open: you asked to SEE the notebooks, and
             acting on one row is not done looking (2026-08-18, user:
             "keep open, only close when clicking cross") */
          APP.openPath(n.path);
          setTimeout(renderNbsMenu,600);});
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
  /* ---- the Home tab's Slides group -----------------------------------
     The same four actions the thumbnail strip offers on hover, in the
     place you look for them when the strip is scrolled away from the
     current slide. They call the strip's own implementations, so there is
     one of each. */
  (function(){
    var b;
    b=$('#hm-newslide');
    if(b) b.addEventListener('click',function(){
      var add=$('#film-add'); if(add) add.click();});
    b=$('#hm-dupslide');
    if(b) b.addEventListener('click',function(){dupSlide(cur);});
    b=$('#hm-delslide');
    if(b) b.addEventListener('click',function(){delSlide(cur);});
    wireMenuToggle('hm-laywrap','hm-lay','hm-lay-menu');
  })();
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
  /* duplicate in place — decks never had this at all (2026-08-19, user:
     "still no duplicate slide"); a poster's copy becomes a named version
     like "+ Create new version" makes */
  function dupSlide(i){
    var s=pres.slides[i]; if(!s) return;
    var cp=JSON.parse(JSON.stringify(s));
    if(pageOf().poster) cp.label=nextVersionName();
    else delete cp.label;
    pres.slides.splice(i+1,0,cp);
    cur=i+1;activePane=-1;selAnnot=null;selSet=[];
    markDirty();refresh();
  }

  /* ---------- mode switching ---------- */
  /* ---- edit mode borrows the FILE controls into the ribbon
     (2026-08-05, user: the docked column "basically just feels like
     having the File button open all the time"). The real nodes MOVE —
     every existing handler and menu keeps working — and move back when
     create mode needs the panel again. With its head gone the panel is
     just the slide strip, and posters (one page, no slides) drop the
     panel entirely. ---- */
  /* fileToRibbon / fileToPanel are GONE (2026-08-19): the document
     actions used to be borrowed into the ribbon's File group while
     editing and restored on leaving. They live permanently in the left
     column now — Notebooks, then File/Save/undo/redo and the save
     readout, then the thumbnails — so there is nothing to borrow and
     nothing to restore, and the whole class of "moved node lost its
     styling/anchor" bugs goes with the machinery. */
  function syncTopBar(){
    var dt=$('.deck-top',deckEl);
    /* Row 1 of the deck holds exactly one bar. Presenting gets .deck-top,
       which is only a way out; editing and building get .deck-qat, which
       is the document's own controls — File, Save, undo/redo, the name,
       Find, zoom, Present (2026-08-20). Never both. */
    var qat=$('#deck-qat',deckEl);
    var editing=(mode==='edit'||mode==='create');
    if(dt) dt.hidden=editing;
    if(qat) qat.hidden=!editing;
    var tabs=$('#rbn-tabs',deckEl);
    if(tabs) tabs.hidden=(mode!=='edit');
    var xb=$('#deck-exit');
    if(xb){
      /* say where it GOES. "Back" beside an armed drawing tool reads as
         the way out of that tool, which is Cancel's job. */
      var presenting=(mode==='view');
      xb.innerHTML=presenting?'&#8617; Stop presenting'
        :'&#8617; Close the editor';
      xb.title=presenting
        ?'Stop presenting and go back to the builder (Esc). Nothing is '
          +'closed or lost.'
        :'Leave the editor and go back to the builder. Nothing is closed '
          +'or lost.';
    }
  }
  function setUIMode(m){
    mode=m;
    var creating=(m==='create'), editing=(m==='edit');
    deckEl.classList.toggle('creating',creating);
    deckEl.classList.toggle('editing',editing);
    /* nothing moves any more: the document actions LIVE in the left
       column in every mode (2026-08-19) */
    /* the builder panel stays visible while editing a slide */
    $('#deck-create').hidden=!(creating||editing);
    var et=$('#edit-tools'); if(et) et.hidden=!editing;
    if(editing) applyTab();
    /* The top bar earns its row or it does not appear. While editing it
       is only needed by a POSTER, which has no panel and therefore keeps
       File and Save up here; a presentation keeps them in the panel head,
       leaving the bar with nothing but a redundant button and a whole row
       of wasted height (2026-08-07). fileToRibbon has already run, so the
       slot's contents are the honest test. */
    syncTopBar();
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
      /* ...and so is the Versions pane. Put the strip back where the
         builder expects to find it before the builder renders. */
      showVerpane(false);
      animPaneClose();
      filmToPanel();
    }
    var db=$('#et-del'); if(db) db.disabled=true;
    var fb=$('#et-fmt'); if(fb) fb.hidden=true;
    var etb=$('#edit-tools'); if(etb) etb.classList.remove('fmt-open');
    if(editing) setTool('select');
    /* real full screen while presenting (browser chrome gone) */
    try{
      if(m==='view'&&!deckEl.hidden&&deckEl.requestFullscreen
         &&!document.fullscreenElement)
        deckEl.requestFullscreen().catch(function(){});
      /* ...but full-screen EDITING is deliberate, not a leftover from
         presenting: leaving it alone here is what lets a poster be edited
         full screen at all (every mode re-apply would otherwise drop it) */
      else if(m!=='view'&&document.fullscreenElement&&!editFull)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    if(m!=='edit'&&editFull){
      editFull=false;deckEl.classList.remove('editfull');
      try{if(document.fullscreenElement)
        document.exitFullscreen().catch(function(){});}catch(err2){}
    }
    applySideRibbon();
    syncViewBtns();
    /* entering edit mode is the first moment the ribbon has a real width */
    if(m==='edit') requestAnimationFrame(fitEditRibbon);
    if(creating||editing){
      activePane=-1;
      renderCreate();
    }
    if(!creating) renderSlide();
    /* the bar's title depends on the mode, and openDeck calls status()
       BEFORE the mode is set — so it is refreshed once more here */
    status();
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
  /* WHAT GOES OUT. A poster is one page: its other pages are drafts and
     variants, and you send one to the print shop, not the pile. Since
     "+ Create new version" makes those easy to accumulate, exporting all
     of them would quietly turn one A0 into three (2026-08-10). A deck's
     slides ARE the deck, so they all go. */
  function outputSlides(){
    var all=(pres.slides||[]).map(function(s,i){return {s:s,i:i};});
    if(!pageOf().poster||all.length<2) return all;
    var k=Math.min(Math.max(cur,0),all.length-1);
    return all[k]?[all[k]]:all;
  }
  /* named for the toast, so it is never a silent choice */
  function outputNote(){
    var all=(pres.slides||[]).length;
    if(!pageOf().poster||all<2) return '';
    var s=pres.slides[Math.min(Math.max(cur,0),all-1)];
    return ' Sent "'+((s&&s.label)||slideTitle(s||{}))+'" only — a poster '
      +'goes out one version at a time; open Versions to switch.';
  }
  function closeDeck(){
    try{
      if(document.fullscreenElement)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    closeVFull();
    showVerpane(false);filmToPanel();   /* the strip goes home */
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
  var docsBtn=$('#deck-docs');   /* removed from the markup; the rail has it */
  if(docsBtn) docsBtn.addEventListener('click',function(){closeDeck();});
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
  var presentFrom='create';
  $('#dc-play').addEventListener('click',function(){
    presentFrom=mode;setUIMode('view');});
  var undoBtn=$('#dc-undo');
  if(undoBtn) undoBtn.addEventListener('click',undo);
  var redoBtn=$('#dc-redo');
  if(redoBtn) redoBtn.addEventListener('click',redo);
  $('#deck-exit').addEventListener('click',function(){
    setUIMode(presentFrom==='edit'?'edit':'create');});

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
    /* "Swap to notebooks" now actually goes to the notebooks. It used to
       run setUIMode('create'), landing you in the presentation BUILDER —
       slide layouts, slide strip, the lot — which is not where the label
       said you were going and is meaningless for a poster (2026-08-07,
       user: "it takes you to the view for presentations"). */
    if(mode==='edit') closeDeck();
    else if(pres.slides[cur]) setUIMode('edit');
  });
  var delBtn=$('#et-del');
  if(delBtn) delBtn.addEventListener('click',deleteSel);
  var cxBtn=$('#et-cancel');
  if(cxBtn) cxBtn.addEventListener('click',function(){setTool('select');});
  $$('#edit-tools .et').forEach(function(b){
    /* pressing an armed tool again is the second way out, and the one
       people try first */
    b.addEventListener('click',function(){
      setTool(tool===b.dataset.tool?'select':b.dataset.tool);});
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
    /* Built by the same drawnOpt as every other drawn menu, so the two
       shape galleries — this one for INSERT and the Line & shape group's
       for CHANGING one — cannot look like different features. It used to
       write its own option element and add a caption under each icon,
       which made this the only drawn menu in the editor that spelled its
       pictures out (2026-08-17 audit). Names live in the tooltip, as
       PowerPoint's shape gallery does. */
    SHAPE_LIST.forEach(function(pair){
      drawnOpt(shMenu,shBtn,pair[1],shapeIcon(pair[0]),'ins:'+pair[0],
        function(){pendingShape=pair[0];setTool('rect');});
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
  document.addEventListener('fullscreenchange',function(){
    /* Esc always exits browser fullscreen (the page cannot prevent
       it), so Esc while presenting leaves the presentation entirely —
       never a windowed half-presentation state. Inner layers (the code
       overlay, the trace) close via their own ✕ / scroll instead. */
    if(document.fullscreenElement) return;
    if(mode!=='view'||deckEl.hidden) return;
    closeVFull();
    /* BACK WHERE YOU WERE: presenting from the editor returned to the
       builder, a view you then had to climb out of via "Open the editor"
       (2026-08-19, user: "takes you to some cursed view") */
    setUIMode(presentFrom==='edit'?'edit':'create');
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
      /* trim mode is the innermost state: the first Esc leaves IT,
         keeping the selection, before any tool/selection drops */
      else if(mode==='edit'&&cropMode){setCropMode(false);}
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
      /* leaving a presentation goes back to WHERE IT STARTED — Esc is the
         third exit route (exit button and fullscreen-change had this, the
         Esc branch still dumped an edit-mode presenter into the builder:
         the "cursed view", 2026-08-20 re-verify) */
      else if(mode==='view')
        setUIMode(presentFrom==='edit'?'edit':'create');
      else if(mode==='edit'){setUIMode('create');}
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
    else if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){
      /* saves to wherever "Saved to" points, exactly like the Save button
         (2026-08-19, user: "more shortcuts — ctrl+s"). Present mode still
         swallows it so the browser's save dialog never covers a talk. */
      e.preventDefault();
      if(mode!=='view'){var sb2=$('#dc-save');if(sb2) sb2.click();}
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='f'||e.key==='F')
            &&mode!=='view'){
      /* the browser's own find can only see the ONE slide that is
         rendered, which for a deck is almost always the wrong answer —
         so Ctrl+F opens the deck's find instead (2026-08-20) */
      e.preventDefault();
      if(window.SemDeckFind) window.SemDeckFind();
    }
    else if(mode==='edit'){
      if(e.key==='Delete'||e.key==='Backspace'){
        e.preventDefault();deleteSel();
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')){
        e.preventDefault();duplicateSel();
      }
      /* copy and cut; PASTE rides the real paste event instead, so a
         system-clipboard image can come in too */
      else if((e.ctrlKey||e.metaKey)&&(e.key==='c'||e.key==='C')){
        var nc=copySel();
        if(nc){e.preventDefault();
          toast(nc+' item'+(nc===1?'':'s')+' copied');}
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='x'||e.key==='X')){
        var nx=cutSel();
        if(nx){e.preventDefault();
          toast(nx+' item'+(nx===1?'':'s')+' cut');}
      }
      /* NOT preventDefaulted: the native paste event stays the primary
         path (it can carry a system-clipboard image). This one-shot timer
         only fires where that event never arrives, so an internal copy
         still pastes there (2026-08-20) */
      else if((e.ctrlKey||e.metaKey)&&(e.key==='v'||e.key==='V')){
        if(pendingPaste) clearTimeout(pendingPaste);
        pendingPaste=setTimeout(function(){
          pendingPaste=null;
          if(clipBuf.length) pasteBuf();
        },150);
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
      /* with NOTHING selected, up/down walk the deck like the thumbnail
         strip (2026-08-19, user: "pressing the down key on the slide
         thumbnails should move you through the slides") */
      else if(!e.ctrlKey&&!e.metaKey
              &&(e.key==='ArrowDown'||e.key==='ArrowUp'
                 ||e.key==='PageDown'||e.key==='PageUp')){
        var dd=(e.key==='ArrowDown'||e.key==='PageDown')?1:-1;
        var nn=cur+dd;
        if(nn>=0&&nn<pres.slides.length){
          e.preventDefault();
          cur=nn;activePane=-1;selAnnot=null;selSet=[];refresh();
        }
      }
      /* R rulers, G grid — plain keys, so Ctrl+G still groups */
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='r'||e.key==='R')){
        e.preventDefault();
        var rb=$('#vw-rulers'); if(rb) rb.click();
      }
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='g'||e.key==='G')){
        e.preventDefault();
        var gb=$('#vw-grid'); if(gb) gb.click();
      }
      /* page zoom from the keyboard, mirroring the -/Fit/+ buttons */
      else if(!e.ctrlKey&&!e.metaKey
              &&(e.key==='+'||e.key==='='||e.key==='-'||e.key==='0')){
        var zb=$(e.key==='-'?'#zoom-out'
          :e.key==='0'?'#zoom-val':'#zoom-in');
        if(zb){e.preventDefault();zb.click();}
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
    /* F5 — the PowerPoint convention — presents from the current slide
       in either editing view (it shadows the browser's refresh only
       while the editor is open, a deliberate trade) */
    if(e.key==='F5'&&(mode==='edit'||mode==='create')){
      var pl=$('#dc-play');
      if(pl){e.preventDefault();pl.click();}
    }
  });
  /* every deck shortcut is advertised in its button's tooltip, exactly
     like the document ribbon's (the data-kbd chip in app.js) */
  [['#dc-play','F5'],['#dc-undo','Ctrl+Z'],['#dc-redo','Ctrl+Y'],
   ['#dc-save','Ctrl+S'],['#fmt-dup','Ctrl+D'],
   ['#zoom-in','+'],['#zoom-out','-'],['#zoom-val','0']]
    .forEach(function(p){
      var el=$(p[0]); if(el) el.dataset.kbd=p[1];});

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
  $('#film-add').addEventListener('click',newVersion);
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
  /* ONE rename, reached from the File menu and from the name in the top
     bar. It used to un-hide #pres-name, which lives in .dc-controls — a
     block that is display:none the whole time you are editing, so the
     input was 0x0 and unfocusable and File ▸ Rename… appeared to do
     nothing at all in the primary flow (2026-08-20 diagnosis). */
  menuAction('#mi-rename',startQatRename);
  var qatName=$('#qat-name');
  if(qatName) qatName.addEventListener('click',startQatRename);
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
  function updateCropLabel(){
    var b=$('#mi-crop');
    if(b) b.textContent='Crop marks: '+(pres.cropMarks?'on':'off');
  }
  menuAction('#mi-crop',function(){
    if(pres.cropMarks){delete pres.cropMarks;} else {pres.cropMarks=1;}
    updateCropLabel();markDirty();
    toast(pres.cropMarks
      ?'Crop marks on — the exported sheet grows '+BLEED_MM
        +'mm on each side; the page keeps its exact size'
      :'Crop marks off');
  });
  $('#pres-name').addEventListener('input',function(){
    /* NOTHING happens per keystroke any more. This used to set pres.name
       and lsDel the old draft on every letter typed, so renaming "talk"
       to "talk2" walked through "tal", "ta", "t" — deleting the draft
       under each prefix on the way and leaving four half-named ghosts in
       the rail (2026-08-20 diagnosis). Renaming is a single committed
       action; see renamePresentation. */
  });
  $('#pres-name').addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key==='Escape') this.blur();
    e.stopPropagation();
  });
  $('#pres-name').addEventListener('blur',function(){
    this.hidden=true;
    var lbl=$('#pres-current');
    if(lbl) lbl.hidden=false;
    if(this.value.trim()) renamePresentation(this.value.trim());
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
  /* reading needs less than writing — a handle whose write grant lapsed
     can often still be read, which is enough to restore what it holds */
  function permReadOK(h){
    if(!h||!h.queryPermission) return Promise.resolve(!!h);
    return h.queryPermission({mode:'read'})
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
      /* .junoview.html so double-clicking the file opens a browser; the
         picker API only takes single-dot extensions, so the double suffix
         goes in the suggested name */
      suggestedName:(pres.name||'presentation')+'.junoview.html',
      types:[{description:'Junoview presentation',
        accept:{'text/html':['.html']}}]
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
  /* ---- the saved file is a real HTML page with the JSON inside it ----
     A bare-JSON ".junoview" was a dead end on disk: double-clicking it
     asked Windows to pick an app, and nothing said what it was
     (2026-08-18, user: "when opening it doesn't really recognise that
     this should be opened in a browser"). Saved as name.junoview.html the
     OS opens a browser, and the page identifies itself — the Junoview
     logo, the name, what it holds, and how to open it for editing. The
     data rides in a <script type="application/json"> block; both loaders
     (here and the Python sidecar reader) unwrap it, and plain old .junoview
     files still parse, so nothing already saved is stranded. `<` is
     escaped inside the JSON so no content can close the script block. */
  function junoviewFileHtml(){
    var json=deckFileText().replace(/</g,'\\u003c');
    var list=plainIfSingle(mergedPresentations());
    var n=Array.isArray(list)?list.length:1;
    var slides=(Array.isArray(list)?list:[list]).reduce(function(k,p2){
      return k+((p2&&p2.slides&&p2.slides.length)||0);},0);
    var icon=(document.querySelector('link[rel="icon"]')||{}).href||'';
    var name=esc(APP.order.length===1?APP.order[0]:(pres.name||'project'));
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
      +'<meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>'+name+' — Junoview presentation</title>'
      +(icon?'<link rel="icon" href="'+icon+'">':'')
      +'<style>body{margin:0;min-height:100vh;display:flex;align-items:center;'
      +'justify-content:center;background:#0b141d;color:#dce6ee;'
      +'font-family:system-ui,sans-serif}main{text-align:center;padding:40px;'
      +'max-width:560px}img{width:96px;height:96px}h1{font-size:20px;'
      +'margin:18px 0 4px}p{color:#8ba0b2;font-size:14px;line-height:1.6;'
      +'margin:8px 0}code{background:#16273a;border-radius:4px;'
      +'padding:1px 6px;font-size:13px}</style></head><body><main>'
      +(icon?'<img src="'+icon+'" alt="Junoview">':'')
      +'<h1>'+name+'</h1>'
      +'<p>A saved <b>Junoview</b> presentation — '+n+' presentation'
      +(n===1?'':'s')+', '+slides+' slide'+(slides===1?'':'s')+'.</p>'
      +'<p>To edit it, open Junoview and pick <code>+ New… → Open a '
      +'.junoview file…</code> (or <code>File → Open</code> inside any '
      +'presentation), or keep it next to its notebook and it loads '
      +'itself.</p>'
      +'</main><script type="application/json" id="junoview-data">\n'
      +json+'\n</'+'script></body></html>\n';
  }
  /* both file forms — the HTML wrapper and a bare-JSON .junoview from
     before it existed — hand back the same object */
  function parseDeckText(txt){
    var t=String(txt||'').trim();
    if(t.charAt(0)==='<'){
      var m2=t.match(
        /<script type="application\/json" id="junoview-data">([\s\S]*?)<\/script>/);
      if(!m2) throw new Error('no Junoview data in that HTML file');
      t=m2[1];
    }
    return JSON.parse(t);
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
            return Promise.resolve(w.write(junoviewFileHtml()))
              .then(function(){return w.close();});
          }).then(function(){
            /* the browser copy STAYS. Deleting it made the file the ONLY
               copy, and nothing ever read the file back at startup — save
               to file, close the browser, and the presentation was gone
               from the app (2026-08-20, user: "I made a presentation for
               tomorrow and now am locked out of it"). */
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
    /* the label is just the DESTINATION — "Saved to:" lives in the
       tooltip. The long form was the widest thing in the ribbon's File
       group and wrapped the whole toolbar to a third row (2026-08-05). */
    /* the chevron of a split button: "Save" is its label. The destination
       is named in the menu this opens, and in the tooltip — in the ribbon
       it was a second, wordier control that looked like a rival Save. */
    b.innerHTML='&#9662;';
    b.title='Saving to '+targetLabel()+' — click to change where';
    var th=$('#tg-head');
    if(th) th.textContent='save to — now: '+targetLabel();
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
    /* Two doors, one state: the File menu (where it has always been) and
       the top bar, where you can READ it without opening a menu. A save
       setting you have to go looking for to check is a save setting you
       do not trust (2026-08-20, user asked for "autosave frequency" in
       the thin bar). */
    var mi=$('#mi-autosave');
    if(mi){
      mi.hidden=(APP.mode!=='app');
      mi.textContent='Autosave: '+(autosaveOn?'on':'off');
    }
    var qa=$('#qat-auto');
    if(qa){
      /* only the app build autosaves to the project; a file target
         autosaves unconditionally and has nothing to toggle */
      qa.hidden=(APP.mode!=='app');
      qa.textContent=autosaveOn?'↻ Autosave on':'↻ Autosave off';
      qa.setAttribute('aria-pressed',autosaveOn?'true':'false');
      qa.title=autosaveOn
        ?('Autosaving to '+whereSaved()+' about a second after you stop '
          +'typing. Click to turn it off.')
        :'Autosave is off — your work is only written when you press '
          +'Save. Click to turn it on.';
    }
  }
  function toggleAutosave(){
    autosaveOn=!autosaveOn;
    lsSet(AUTOKEY,autosaveOn?'1':'0');
    renderAutosaveItem();renderSaveBtn();status();
    toast(autosaveOn
      ?('Autosave on — saving to '+whereSaved()+' as you work')
      :'Autosave off — press Save to write your changes');
  }
  var qatAuto=$('#qat-auto');
  if(qatAuto) qatAuto.addEventListener('click',toggleAutosave);
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
      /* remembered ≠ active. Only a still-granted write permission keeps
         the file as the silent autosave target across sessions; without
         it, saves go to the browser and the file stays one click away
         (2026-08-18). */
      return permOK(h).then(function(ok){
        if(!ok&&saveTarget==='file'){
          saveTarget='browser';
          lsSet(TGKEY,'browser');
          status();
        }
        renderTargetBtn();renderSaveBtn();
      }).then(function(){
        /* the file is a SOURCE too, not just a target: if it can still be
           read, restore any presentation the browser no longer lists
           (2026-08-20, user locked out of a file-saved presentation) */
        return permReadOK(h).then(function(ok){
          if(!ok) return;
          return h.getFile().then(function(f){return f.text();})
            .then(function(txt){importDeckText(txt,true);});
        });
      });
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
    var blob=new Blob([junoviewFileHtml()],{type:'text/html'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(APP.order.length===1?APP.order[0]:'project')
      +'.junoview.html';
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
  /* build the fixed-size print/export pages off-screen. Shared by the
     PDF path (window.print) and the standalone-HTML export. */
  function buildPrintRoot(){
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
    /* Crop marks: some print shops ask for them, and they need somewhere
       to sit, so the SHEET grows by the bleed while the page inside keeps
       its exact size — an A0 poster stays 841x1189mm either way. */
    var bleed=(pres&&pres.cropMarks)?BLEED_MM:0;
    if(pg.id!=='16x9'||bleed){
      var sheetW=pg.mm[0]+2*bleed,sheetH=pg.mm[1]+2*bleed;
      var pw=Math.round(pg.mm[0]/25.4*96),ph=Math.round(pg.mm[1]/25.4*96);
      var bpx=Math.round(bleed/25.4*96);
      var pst=document.createElement('style');
      pst.textContent='#print-root{width:'+(pw+2*bpx)+'px;}'
        +'.print-page{width:'+pw+'px;height:'+ph+'px;'
        +(bleed?'margin:'+bpx+'px;':'')+'}'
        +'@media print{@page{size:'+sheetW+'mm '+sheetH+'mm;'
        +'margin:0;}}';
      root.appendChild(pst);
    }
    /* the page's own background rides into the export — a white poster
       prints white, not the app's navy (2026-08-04) */
    var bg=(pres&&pres.pageBg)||'#0b141d';
    root.classList.toggle('page-light',pageIsLight(bg));
    var bst=document.createElement('style');
    bst.textContent='.print-page,.print-page .slide{background:'+bg
      +'!important;}@media print{html,body{background:'+bg+'!important;}}';
    root.appendChild(bst);
    outputSlides().forEach(function(ent,i){
      var s=ent.s;
      cur=ent.i;
      var page=document.createElement('div');page.className='print-page';
      var slideEl=document.createElement('div');
      if(s&&s.layout==='title'){
        slideEl.className='slide slide-titlefree';
        slideEl.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
      } else slideEl.className='slide slide-blank';
      if(s&&s.bg)
        slideEl.style.setProperty('background',s.bg,'important');
      if(s&&s.border) slideEl.style.boxShadow='inset 0 0 0 '
        +((s.border.w||4)/SW_REF_H*Math.round(pg.mm[1]/25.4*96)).toFixed(2)
        +'px '+(s.border.c||'#39a9c0');
      page.appendChild(slideEl);
      root.appendChild(page);            /* in the DOM before annots render */
      if(s) attachAnnots(slideEl,s);     /* view-style; fontPx reads 720px */
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';pn.textContent=(i+1);
        slideEl.appendChild(pn);
      }
      /* trim marks at the four corners, drawn OUTSIDE the page in the
         bleed so they never touch the artwork */
      if(bleed){
        page.classList.add('has-crop');
        ['tl','tr','bl','br'].forEach(function(c){
          var cm=document.createElement('span');
          cm.className='cropmark cm-'+c;
          page.appendChild(cm);
        });
      }
    });
    mode=savedMode;revealCount=savedReveal;cur=savedCur;
    if(typeset) typeset(root);
    return root;
  }
  /* wait for MathJax to actually FINISH on the built pages before using
     them — the print dialog tolerates late typesetting (the live DOM
     keeps working underneath it) but a serialised export is a hard
     cutoff: whatever maths was unfinished ships as raw TeX forever
     (2026-08-05 review) */
  function afterTypeset(root,fn){
    try{
      if(window.MathJax&&MathJax.typesetPromise)
        return MathJax.typesetPromise([root])
          .catch(function(){}).then(fn);
    }catch(e){}
    setTimeout(fn,200);
  }
  function printDeck(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    var root=buildPrintRoot();
    document.body.classList.add('printing');
    var done=false;
    function cleanup(){
      if(done) return;done=true;
      document.body.classList.remove('printing');
      /* remove OUR root by reference — an id lookup could tear down a
         newer root built by a crossing export/print (2026-08-05 review) */
      if(root.parentNode) root.remove();
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
  /* ---- standalone HTML export (2026-08-04): ONE self-contained .html
     anyone can open without Junoview. The page styles are already inline
     in this document's <head>, and every notebook figure is a data: URI,
     so the file travels whole. It reads as stacked pages, arrow keys
     step through them, and Ctrl+P prints at true page size (the same
     @page rules ride along). ---- */
  function exportDeckHtml(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    var root=buildPrintRoot();
    afterTypeset(root,function(){
      var css='';
      $$('style',document.head).forEach(function(st){
        css+=st.textContent+'\n';});
      var nav='<scr'+'ipt>document.addEventListener("keydown",'
        +'function(e){'
        +'var p=[].slice.call(document.querySelectorAll(".print-page"));'
        +'if(!p.length)return;var y=window.scrollY,i=0;'
        +'for(var j=0;j<p.length;j++){if(p[j].offsetTop<=y+10)i=j;}'
        +'if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){'
        +'e.preventDefault();if(p[i+1])p[i+1].scrollIntoView();}'
        +'if(e.key==="ArrowLeft"||e.key==="PageUp"){'
        +'e.preventDefault();if(p[i-1])p[i-1].scrollIntoView();}'
        +'});</scr'+'ipt>';
      var doc='<!doctype html><html><head><meta charset="utf-8">'
        +'<meta name="viewport" content="width=device-width">'
        +'<title>'+esc(pres.name||'presentation')+'</title>'
        +'<style>'+css+'</style>'
        +'<style>body{margin:0;background:#20262c;}'
        +'#print-root{position:static!important;left:auto!important;'
        +'width:auto!important;}'
        /* NO max-width: the pages are fixed-px boxes and clamping the
           width alone broke their aspect (2026-08-05 review). A huge
           poster page simply scrolls — the browser's own zoom fits it. */
        +'.print-page{margin:18px auto;box-shadow:0 8px 40px #0008;}'
        +'@media print{body{background:none;}'
        +'.print-page{margin:0;box-shadow:none;}}'
        +'</style></head><body>'
        +nav+root.outerHTML+'</body></html>';
      var blob=new Blob([doc],{type:'text/html'});
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=(pres.name||'presentation')+'.html';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
      if(root.parentNode) root.remove();   /* by reference, never by id */
      toast('Standalone HTML saved — opens anywhere; Ctrl+P there '
        +'prints at page size');
    });
  }
  menuAction('#mi-html',function(){exportDeckHtml();});
  /* ---- PowerPoint (.pptx) export: native shapes, not pictures of slides.
     Text becomes a real PowerPoint text box you can retype, figures and
     images become pictures, boxes and arrows become shapes — so a poster
     lands in PowerPoint editable rather than as one flat image.

     What CANNOT come across: a placed notebook cell showing code, a table
     or an xarray repr is arbitrary HTML with no PowerPoint equivalent, and
     rasterising it in the browser would need a library we deliberately do
     not ship. Those frames are counted and reported rather than silently
     dropped — the toast says how many, and PDF export carries them
     perfectly. Crops are dropped for the same reason (a CSS clip-path is
     not a PowerPoint crop), so a cropped item is reported too. ---- */
  /* textContent welds block elements together ("…reanalysiswould contain"),
     so read innerText instead. It is layout-dependent, which means the node
     must genuinely be RENDERED: display:none returns textContent and
     visibility:hidden returns "" outright (measured, 2026-08-07). Hence a
     real mount, merely parked off-screen. */
  function blockText(node){
    if(!node) return '';
    var host=document.createElement('div');
    host.style.cssText='position:absolute;left:-99999px;top:0;width:800px;';
    host.appendChild(node);
    document.body.appendChild(host);
    /* MathJax lays every glyph out as its own box, so innerText would put
       each character of an equation on its own line. Collapse each formula
       to one inline string instead.
       The characters come from the ASSISTIVE MathML, not the visible
       output: MathJax v3's CHTML draws glyphs through CSS ::before rules,
       so the container's own textContent is empty (measured, 2026-08-07). */
    $$('mjx-container',host).forEach(function(n){
      if(!n.parentNode) return;
      var mml=n.querySelector('mjx-assistive-mml');
      var t=String((mml&&mml.textContent)||n.textContent||'')
        .replace(/\s+/g,' ').trim();
      n.parentNode.replaceChild(
        document.createTextNode(t?' '+t+' ':' '),n);
    });
    var out='';
    try{out=String(host.innerText||host.textContent||'');}
    catch(e){out=String(host.textContent||'');}
    host.remove();
    return out.replace(/\n{3,}/g,'\n\n').trim();
  }
  /* An unset colour means "whatever the page CSS says", which is dark ink on
     a light poster and white on a dark one. PowerPoint has no such cascade,
     so the default is resolved HERE — baking a plain '#ffffff' would put
     white text on a white poster, the exact bug the live view already had. */
  function pptxTextItem(a,centred,ink){
    return {t:'text',x:a.x,y:a.y,w:a.w||(centred?80:34),h:a.h||8,
      rot:a.rot,op:a.op,centred:!!centred,
      text:a.text,sizePct:a.size,color:a.color||ink,
      b:a.b,i:a.i,u:a.u,strike:a.strike,align:a.align||(centred?'center':''),
      bullets:!!a.list,bgc:(a.bg!==0&&a.bgc)?a.bgc:'',
      arc:a.arc,font:fontPpt(a.font)};
  }
  /* one slide's annots -> spec items, plus a tally of what could not go */
  /* `layer` is the rendered annotation layer for THIS slide, or null. It is
     a real parameter because it used to be a bare undeclared identifier:
     reading it threw ReferenceError, so exporting any deck or poster that
     contained a single line or arrow produced no file and — because the
     throw escaped before the toast — no message either (2026-08-10). */
  function pptxItems(s,note,ink,layer){
    var items=[];
    if(s.layout==='title'){
      ['t','s'].forEach(function(which){
        var p=titleProps(s,which),val=(which==='t')?s.title:s.sub;
        if(!String(val||'').trim()) return;
        var it=pptxTextItem(p,true,ink);
        it.text=val;
        items.push(it);
      });
    }
    (s.annots||[]).forEach(function(a){
      if(!a) return;
      if(a.crop) note.cropped++;   /* inset-only trims are dropped too */
      if(a.k==='text'){
        items.push(pptxTextItem(a,false,ink));
      } else if(a.k==='image'){
        if(a.src) items.push({t:'image',x:a.x,y:a.y,w:a.w||30,h:a.h||24,
          rot:a.rot,op:a.op,src:a.src});
        else note.skipped++;
      } else if(a.k==='rect'){
        /* `a.fill` is a BOOLEAN — "tint with my own line colour" — so the
           actual paint has to be resolved here. Passing the boolean
           through made every filled shape export solid black. */
        var fillCol='';
        if(a.grad) fillCol='';
        else if(a.fill) fillCol=a.fillc||shapeFill(a.color||'#ff6b57',
          0x2b/255);
        items.push({t:'rect',x:a.x,y:a.y,w:a.w||20,h:a.h||14,rot:a.rot,
          op:a.op,color:a.color,fill:fillCol,grad:a.grad,
          swPct:swOf(a)/SW_REF_H*100,
          dash:LINE_PPT[lineStyle(a)],shape:a.shape});
      } else if(a.k==='draw'){
        items.push({t:'draw',x:a.x,y:a.y,w:a.w||10,h:a.h||10,rot:a.rot,
          op:a.op,color:a.color,swPct:swOf(a)/SW_REF_H*100,
          dash:LINE_PPT[lineStyle(a)],pts:a.pts||[]});
      } else if(a.k==='arrow'){
        var ea=arrowEnds(layer,s,a,0);
        var hz=headSize(a);
        items.push({t:'line',x1:ea.x1,y1:ea.y1,x2:ea.x2,y2:ea.y2,
          color:a.color,swPct:swOf(a)/SW_REF_H*100,
          dash:LINE_PPT[lineStyle(a)],op:a.op,
          head:(HEAD_BY[headEnd(a)]||{}).ppt||'none',
          tail:(HEAD_BY[headStart(a)]||{}).ppt||'none',
          hsz:hz.ppt,curve:a.curve,bend:a.bend});
      } else if(a.k==='cell'){
        var it=a.ref?resolveRef(a.ref):null;
        var node=it?framePart(it.ns,a.part):null;
        var img=node?node.querySelector('img'):null;
        if(img&&img.src&&img.src.indexOf('data:')===0){
          items.push({t:'image',x:a.x,y:a.y,w:a.w||30,h:a.h||24,
            rot:a.rot,op:a.op,src:img.src,name:(it&&it.title)||'Figure'});
          return;
        }
        /* no figure to lift — but prose and code ARE just text, and a text
           box beats an empty slide. A table or a rich repr is neither: its
           meaning is in a layout PowerPoint cannot rebuild, so it is
           reported instead of being flattened into gibberish. */
        var isTable=!!(node&&node.querySelector('table'));
        /* a <pre> means the frame IS code; a bare inline <code> is just
           prose with a code span in it, and setting the whole note in
           monospace for one `groupby(...)` reads as a bug */
        var code=node&&node.querySelector('pre');
        /* typeset maths survives only as its flattened characters — legible,
           but no longer an equation. Counted so the toast can say so. */
        if(node&&node.querySelector('mjx-container')) note.maths++;
        var txt=(node&&!isTable)?blockText(node):'';
        if(txt){
          items.push({t:'text',x:a.x,y:a.y,w:a.w||30,h:a.h||24,
            rot:a.rot,op:a.op,text:txt,sizePct:code?1.3:1.8,
            color:a.txcol||ink,font:code?'Consolas':'',
            name:(it&&it.title)||'Text'});
        } else note.skipped++;
      }
    });
    return items;
  }
  function exportDeckPptx(){
    if(!(pres.slides||[]).length){toast('No slides to export yet');return;}
    if(!window.JunoPptx){toast('PowerPoint export unavailable here');return;}
    var pg=pageOf(),note={skipped:0,cropped:0,maths:0};
    var bg=(pres&&pres.pageBg)||'#0b141d';
    var ink=pageIsLight(bg)?'#0b141d':'#ffffff';
    var out=JunoPptx.build({
      title:pres.name||'presentation',
      widthMm:pg.mm[0],heightMm:pg.mm[1],bg:bg,
      slides:outputSlides().map(function(ent){
        /* only the slide on screen has a live layer; the rest resolve
           attached arrow ends from their stored coordinates */
        var lay=(ent.i===cur)?stage.querySelector('.annot-layer'):null;
        var its=pptxItems(ent.s,note,ink,lay);
        if(ent.s.border) its.unshift({t:'rect',x:0,y:0,w:100,h:100,
          color:ent.s.border.c||'#39a9c0',
          swPct:(ent.s.border.w||4)/SW_REF_H*100,fill:'',name:'Border'});
        return {bg:(ent.s.bg||bg),items:its};
      }),
    });
    var a=document.createElement('a');
    a.href=URL.createObjectURL(out.blob);
    a.download=(pres.name||'presentation')+'.pptx';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
    var msg='PowerPoint saved — text stays editable'+outputNote();
    if(note.skipped) msg+='. '+note.skipped+' cell'
      +(note.skipped===1?'':'s')+' could not convert (code or a table — '
      +'use Export PDF for those)';
    if(note.cropped) msg+='. '+note.cropped+' crop'
      +(note.cropped===1?'':'s')+' not carried';
    if(note.maths) msg+='. Equations came across as plain text';
    toast(msg);
    /* one honest tally for the caller: the builder counts items IT could not
       write, this counts cells that never became items — reporting only one
       of the two reads as "nothing was lost" when something was */
    return {blob:out.blob,slides:out.slides,cropped:note.cropped,
      skipped:note.skipped+out.skipped};
  }
  /* ---- Background menu: THIS slide's colour and border. The whole
     presentation's background stays under File, where it always was. */
  (function(){
    var wired=wireMenuToggle('bg-drop','bg-btn','bg-menu');
    if(!wired) return;
    var menu=wired.menu;
    var BGS=[['#ffffff','White'],['#f6f2ea','Cream'],['#eef1f4','Light grey'],
      ['#0b141d','Dark'],['#000000','Black']];
    var BWS=[[0,'Off'],[2,'Thin'],[4,'Medium'],[9,'Thick']];
    function apply(fn){
      var s2=pres.slides[cur]; if(!s2) return;
      fn(s2);markDirty();applyPageBg();applyZoom();renderSlide();
      build();
    }
    function build(){
      var s2=pres.slides[cur]||{};
      menu.innerHTML='';
      menuHead(menu,'This slide');
      var r1=menuRow(menu,'bg-sw');
      var auto=document.createElement('button');
      auto.className='sh-opt bg-auto';auto.textContent='Auto';
      auto.title='Match the presentation background (File menu)';
      auto.setAttribute('aria-pressed',(!s2.bg).toString());
      auto.addEventListener('click',function(e){e.stopPropagation();
        apply(function(x){delete x.bg;});});
      r1.appendChild(auto);
      BGS.forEach(function(p){
        var b=document.createElement('button');
        b.className='sh-opt bg-chip';b.title=p[1];
        b.style.background=p[0];
        b.setAttribute('aria-pressed',(s2.bg===p[0]).toString());
        b.addEventListener('click',function(e){e.stopPropagation();
          apply(function(x){x.bg=p[0];});});
        r1.appendChild(b);
      });
      menuHead(menu,'Border');
      var r2=menuRow(menu,'bg-bw');
      BWS.forEach(function(p){
        var b=document.createElement('button');
        b.className='sh-opt bg-w';b.textContent=p[1];
        var on=p[0]===((s2.border&&s2.border.w)||0);
        b.setAttribute('aria-pressed',on.toString());
        b.addEventListener('click',function(e){e.stopPropagation();
          apply(function(x){
            if(!p[0]) delete x.border;
            else x.border={w:p[0],c:(x.border&&x.border.c)||'#39a9c0'};
          });});
        r2.appendChild(b);
      });
      if(s2.border){
        var r3=menuRow(menu,'bg-sw');
        ['#39a9c0','#ff6b57','#f0a848','#46a892','#16202b','#ffffff']
          .forEach(function(c){
          var b=document.createElement('button');
          b.className='sh-opt bg-chip';b.title='Border colour';
          b.style.background=c;
          b.setAttribute('aria-pressed',(s2.border.c===c).toString());
          b.addEventListener('click',function(e){e.stopPropagation();
            apply(function(x){x.border.c=c;});});
          r3.appendChild(b);
        });
      }
    }
    wired.btn.addEventListener('click',function(){build();});
  })();
  window.SemDeckPptx=exportDeckPptx;   /* test hook */
  menuAction('#mi-pptx',function(){exportDeckPptx();});
  /* page background swatches (File menu) */
  $$('#mi-pagebg .pgbg-sw').forEach(function(sw){
    sw.addEventListener('click',function(e){
      e.stopPropagation();          /* keep the File menu open to compare */
      pres.pageBg=sw.dataset.bg;
      markDirty();applyPageBg();renderSlide();
    });
  });
  /* one importer for every way a saved file comes back in: the File-menu
     picker, the launcher's "+ New… → Open a .junoview file…" row, and the
     silent startup restore from a remembered file handle. `silent` never
     renames, never toasts and never steals the view — it only fills in
     presentations the browser does not already have. */
  function importDeckText(txt,silent){
    var obj=parseDeckText(txt);
    var list=(obj&&Array.isArray(obj.presentations))
      ?obj.presentations
      :Array.isArray(obj)?obj
      :(obj&&Array.isArray(obj.slides))?[obj]:null;
    if(!list||!list.length){
      if(!silent) toast('That file does not look like a saved deck');
      return 0;
    }
    var imported=0,firstName=null;
    list.forEach(function(pr){
      if(!pr||!Array.isArray(pr.slides)) return;
      var np=normPres(pr);
      var base=np.name||'imported',nm=base,k=1;
      if(silent&&(savedByName(nm)||lsGet(PFX+nm))) return;
      while(savedByName(nm)||lsGet(PFX+nm)){
        k++;nm=base+'-'+k;
      }
      np.name=nm;
      lsSet(PFX+nm,JSON.stringify(np));
      if(!firstName) firstName=nm;
      imported++;
    });
    if(!imported){
      if(!silent) toast('No presentations found in that file');
      return 0;
    }
    if(silent){renderPresTabs();return imported;}
    lsSet(PFX+'last',firstName);
    loadPresentation(firstName);
    cur=0;activePane=-1;
    /* picked from the launcher: go straight into the editor — the whole
       point of opening a file is to get back to the presentation in it */
    if(deckEl.hidden) openDeck('edit');
    status();refresh();
    toast('Imported '+imported+' presentation'
      +(imported>1?'s':'')+' (as drafts)');
    return imported;
  }
  window.SemDeckImport=importDeckText;       /* browser-verification hook */
  window.SemDeckFileHtml=function(){return junoviewFileHtml();};
  (function(){
    var fi=document.getElementById('deckfile');
    if(!fi) return;
    fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      this.value='';
      if(!f) return;
      f.text().then(function(txt){
        importDeckText(txt,false);
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
  /* one delete, callable for ANY presentation — the File menu and the
     rail rows' bins both land here (2026-08-18, user: "an easier way to
     delete presentation ... a delete option when something is selected") */
  function deletePresByName(nm){
    lsDel(PFX+nm);
    projectPres=projectPres.filter(function(p){return p.name!==nm;});
    nbPres=nbPres.filter(function(p){return p.name!==nm;});
    if(APP.mode==='app')
      APP.api('/api/save',{presentations:deep(projectPres)})
        .catch(function(){});
    if(nm===pres.name){
      var names=allSaved().map(function(p){return p.name;})
        .concat(draftNames());
      names=names.filter(function(x){return x!==nm;});
      if(names.length) loadPresentation(names[0]);
      else {pres=defaultPres();source='auto';}
      cur=0;activePane=-1;
      status();refresh();
    } else renderPresTabs();
    toast('Deleted "'+nm+'"');
  }
  (function(){
    var b=$('#pr-newbtn'),m=$('#pr-newmenu');
    if(!b||!m) return;
    b.addEventListener('click',function(e){
      e.stopPropagation();
      m.hidden=!m.hidden;
      b.setAttribute('aria-expanded',(!m.hidden).toString());
    });
    $$('.pr-mi',m).forEach(function(mi){
      mi.addEventListener('click',function(e){
        e.stopPropagation();
        m.hidden=true;b.setAttribute('aria-expanded','false');
        var real=$('#'+mi.dataset.for);
        if(real) real.click();
      });
    });
    document.addEventListener('click',function(e){
      if(!m.hidden&&!m.contains(e.target)&&e.target!==b){
        m.hidden=true;b.setAttribute('aria-expanded','false');}
    });
  })();
  window.SemDeckDelete=deletePresByName;   /* rail rows + tests */
  /* ---- ONE rename, for every door into it -----------------------------
     There are three (the title bar, File ▸ Rename…, and the rail), and
     before this there was no shared implementation at all: each one poked
     pres.name and #pres-name directly. The result was renaming that
     appeared to do nothing in the primary flow, drafts orphaned under
     every prefix of the new name, no collision guard, and a project entry
     that kept the old name (2026-08-20 diagnosis).
     A rename moves the WORK, not just the label: the browser draft, the
     project entry, and the folder the presentation was filed in. */
  function renamePresentation(nm){
    nm=String(nm||'').trim();
    var old=pres&&pres.name;
    if(!nm||!old||nm===old) return false;
    var taken=allSaved().map(function(p){return p.name;})
      .concat(draftNames());
    if(taken.indexOf(nm)>=0){
      toast('There is already something called “'+nm+'” — pick another '
        +'name');
      return false;
    }
    /* the draft moves with the name, rather than being deleted under the
       old one and re-created under the new one on the next save */
    var draft=lsGet(PFX+old);
    if(draft!=null){lsSet(PFX+nm,draft);lsDel(PFX+old);}
    /* the folder rides on the presentation object itself (p.folder), so
       it needs no separate move — but the SAVED copies are matched by
       name and do */
    projectPres.forEach(function(p){if(p.name===old) p.name=nm;});
    nbPres.forEach(function(p){if(p.name===old) p.name=nm;});
    pres.name=nm;
    if(APP.mode==='app')
      APP.api('/api/save',{presentations:deep(projectPres)})
        .catch(function(){});
    markDirty();status();renderPresTabs();renderPresRow();
    toast('Renamed to “'+nm+'”');
    return true;
  }
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

  /* ---- FIND AND REPLACE ------------------------------------------------
     Searches the MODEL, not the rendered page: every text box, list item,
     slide title and subtitle on every slide, whether or not that slide is
     the one on screen. A browser find can only ever see the one slide
     that is rendered, which for a deck is the wrong answer almost all of
     the time (2026-08-20, user: "needs to be a search and replace of text
     and stuff, that is pretty standard").
     A placed notebook card is deliberately NOT searchable: its words
     belong to the notebook, and rewriting them here would put the slide
     and its source out of step with no way to tell. */
  (function(){
    var pop=$('#find-pop');
    if(!pop) return;
    var qi=$('#find-q'),ri=$('#find-r'),listEl=$('#find-list');
    var cntEl=$('#find-count'),ckCase=$('#find-case'),ckWord=$('#find-word');
    var hits=[],at=-1;
    /* every writable string in the deck, as {si, idx, get, set, label} */
    function fields(){
      var out=[];
      (pres.slides||[]).forEach(function(s,si){
        if(s.layout==='title'){
          out.push({si:si,idx:'t',label:'Title',
            get:function(){return s.title||'';},
            set:function(v){s.title=v;}});
          out.push({si:si,idx:'s',label:'Subtitle',
            get:function(){return s.sub||'';},
            set:function(v){s.sub=v;}});
        }
        (s.annots||[]).forEach(function(a,i){
          if(!a||a.k!=='text') return;
          out.push({si:si,idx:i,label:itemLabel(s,i),
            get:function(){return a.text||'';},
            set:function(v){
              a.text=v;
              /* rich markup cannot survive a plain-text substitution
                 without a mapping from characters to runs, so a replaced
                 box drops back to plain text — and says so in the toast
                 rather than silently losing a colour */
              if(a.html){delete a.html;
                if(listOf(a)) setListStyle(a,listOf(a));}
            }});
        });
      });
      return out;
    }
    function rx(){
      var q=qi.value;
      if(!q) return null;
      var esc2=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(ckWord.checked) esc2='\\b'+esc2+'\\b';
      try{return new RegExp(esc2,ckCase.checked?'g':'gi');}
      catch(e){return null;}
    }
    function scan(){
      hits=[];
      var re=rx();
      if(re) fields().forEach(function(f){
        var txt=f.get(),m;re.lastIndex=0;
        while((m=re.exec(txt))){
          hits.push({f:f,start:m.index,len:m[0].length});
          if(!m[0].length) re.lastIndex++;   /* never loop on an empty match */
        }
      });
      if(at>=hits.length) at=hits.length-1;
      render();
    }
    function preview(h){
      var t=h.f.get();
      var a=Math.max(0,h.start-24),b=Math.min(t.length,h.start+h.len+24);
      var frag=document.createDocumentFragment();
      if(a>0) frag.appendChild(document.createTextNode('…'));
      frag.appendChild(document.createTextNode(t.slice(a,h.start)));
      var mk=document.createElement('mark');
      mk.textContent=t.substr(h.start,h.len);
      frag.appendChild(mk);
      frag.appendChild(document.createTextNode(t.slice(h.start+h.len,b)));
      if(b<t.length) frag.appendChild(document.createTextNode('…'));
      return frag;
    }
    function render(){
      cntEl.textContent=hits.length
        ?((at>=0?at+1:1)+' of '+hits.length)
        :(qi.value?'no matches':'');
      listEl.innerHTML='';
      hits.slice(0,120).forEach(function(h,k){
        var b=document.createElement('button');
        b.className='find-hit'+(k===at?' cur':'');
        var n=document.createElement('span');n.className='fh-n';
        n.textContent=(h.f.si+1)+' · '+h.f.label;
        b.appendChild(n);b.appendChild(preview(h));
        b.addEventListener('click',function(){at=k;goHit();});
        listEl.appendChild(b);
      });
      if(hits.length>120){
        var more=document.createElement('div');
        more.className='selpane-empty';
        more.textContent='…and '+(hits.length-120)+' more';
        listEl.appendChild(more);
      }
    }
    /* land on the hit: go to its slide and select the item, so you can SEE
       what you are about to change */
    function goHit(){
      var h=hits[at]; if(!h) return;
      if(cur!==h.f.si){cur=h.f.si;refresh();}
      var l=stage.querySelector('.annot-layer');
      if(l) selectAnnot(l,h.f.idx);
      render();
    }
    function step(d){
      if(!hits.length) return;
      at=(at+d+hits.length)%hits.length;
      goHit();
    }
    function replaceOne(){
      var h=hits[at]||hits[0]; if(!h) return;
      var t=h.f.get();
      h.f.set(t.slice(0,h.start)+ri.value+t.slice(h.start+h.len));
      markDirty();refresh();scan();
      toast('Replaced 1');
    }
    function replaceAll(){
      var re=rx(); if(!re) return;
      var n=0;
      fields().forEach(function(f){
        var t=f.get();re.lastIndex=0;
        if(!re.test(t)) return;
        re.lastIndex=0;
        f.set(t.replace(re,function(m){n++;return ri.value;}));
      });
      if(!n){toast('Nothing to replace');return;}
      markDirty();refresh();scan();
      toast('Replaced '+n+(n===1?' match':' matches'));
    }
    function open(){
      pop.hidden=false;
      /* seed from whatever text box you had selected — the thing you were
         looking at is usually the thing you want to find */
      qi.focus();qi.select();
      scan();
    }
    function close(){pop.hidden=true;at=-1;}
    [qi,ri].forEach(function(el){
      el.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter'){e.preventDefault();
          if(el===ri) replaceOne(); else step(e.shiftKey?-1:1);}
        else if(e.key==='Escape'){e.preventDefault();close();}
      });
    });
    qi.addEventListener('input',function(){at=-1;scan();});
    [ckCase,ckWord].forEach(function(c){
      c.addEventListener('change',function(){at=-1;scan();});});
    $('#find-next').addEventListener('click',function(){step(1);});
    $('#find-prev').addEventListener('click',function(){step(-1);});
    $('#find-rep').addEventListener('click',replaceOne);
    $('#find-repall').addEventListener('click',replaceAll);
    $('#find-close').addEventListener('click',close);
    ['#qat-find','#fmt-find'].forEach(function(sel){
      var b=$(sel);
      if(b) b.addEventListener('click',function(){
        if(pop.hidden) open(); else close();});
    });
    window.SemDeckFind=open;   /* the Ctrl+F binding, below */
  })();

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
