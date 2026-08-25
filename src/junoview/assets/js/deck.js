/* ======================================================================
   deck.js — the presentation builder. ONE ~18,000-line IIFE.

   Boot order: ALL load-time execution runs from THE BOOT SEQUENCE at
   the very end of this file, after every declaration and every `var`
   initialiser. Never add mid-file boot calls or sub-IIFEs that execute
   logic at load — function declarations hoist but `var` initialisers do
   not, and a throw at load time silently kills everything below it (the
   deck just stops existing). Sub-IIFEs that only wire listeners or
   build static menu DOM from values declared above them are fine where
   they are; anything that CALLS into app state belongs in the boot.

   Navigate by the section banners: grep "/* ----" deck.js. The major
   regions, in file order:
     page setup            POSTER templates · page size · BACKGROUND PALETTE
     ribbon                RIBBON TABS · FOLDING THE TOOLS AWAY
     panes                 Objects pane · one pane open at a time
     data                  registry · embedded snapshots · saved presentations
     editing               undo/redo · view mode rendering · GRADIENTS ·
                           FREEHAND · SPOTLIGHT · REPEATED FURNITURE ·
                           free annotations · THE FLIP BOOK
     styles                TEXT STYLES · STYLE SETS · THE STYLE MANAGER
     content               LISTS · TABLES · format bar wiring · FILL PANEL
     arranging             copy/cut/paste · STACKING ORDER · MATCH ANOTHER
                           SLIDE · ARRANGE THIS SLIDE · ARRANGEMENTS
     extras                QR generator · EQUATION EDITOR · images ·
                           FRAMES PANE · animation PANE · PRESENTER VIEW
     shell                 presentations rail · CUSTOM VIEW · thumbnails ·
                           THE OUTLINE · SLIDE SECTIONS · mode switching
     files                 File menu · persistence · exports (PDF · HTML ·
                           PowerPoint) · rename · FIND AND REPLACE
   ====================================================================== */
(function(){
  'use strict';
  var deckEl=document.getElementById('deck');
  if(!deckEl) return;
  var APP=window.SemApp||{mode:'static',shells:{},order:[],
    project:{presentations:[],recent:[]}};

  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  function esc(t){var d=document.createElement('div');d.textContent=(t==null?'':String(t));return d.innerHTML;}
  function deep(o){return JSON.parse(JSON.stringify(o));}
  /* the chrome icon set. window.SemIcons is stamped into the page by
     branding.py (key -> the same <svg class="bic"> markup the template
     tokens expand to), so DOM built here wears the artwork the page
     already wears — no path data lives in this file. Soft on absence:
     a page without the map gets ''-icons, never a dead script. */
  function bic(k){return (window.SemIcons||{})[k]||'';}

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
  /* ---- THE BACKGROUND PALETTE -----------------------------------------
     There used to be five: white, cream, light grey, dark, black. Two of
     those are the same idea, black is never the right answer on a
     projector (it crushes every dark figure into the background and shows
     every speck of dust on the lens), and none of them had been chosen so
     much as listed (2026-08-20, user: "why are all the page background
     defaults aweful").
     These are picked as PRESENTATION grounds. The darks sit around 8-12%
     lightness with a little colour in them, because a flat neutral reads
     as "no background" while a tinted one reads as a decision. The lights
     are off-white rather than white - except White itself, which stays
     because a print shop wants exactly #ffffff. Two gradients, kept
     subtle: a background you notice is a background competing with the
     figure on top of it.
     Each entry carries its own `light` flag rather than making
     pageIsLight parse it: a gradient has no single colour to measure, and
     guessing wrong flips every default text colour on the page. */
  var PAGE_BGS=[
    ['#0b141d','Ink',0],
    ['#12171c','Charcoal',0],
    ['#0c1a2e','Midnight',0],
    ['#0f1c18','Pine',0],
    ['#181423','Plum',0],
    ['linear-gradient(165deg,#16243a 0%,#0a1017 100%)','Dusk',0],
    ['#ffffff','White (print)',1],
    ['#f8f6f1','Paper',1],
    ['#f1f5f9','Mist',1],
    ['#f4efe6','Sand',1],
    ['linear-gradient(165deg,#ffffff 0%,#e7edf3 100%)','Dawn',1]
  ];
  var PAGE_BG_LIGHT={};
  PAGE_BGS.forEach(function(q){PAGE_BG_LIGHT[q[0]]=!!q[2];});
  function pageIsLight(bg){
    var v=String(bg||'').trim();
    if(PAGE_BG_LIGHT.hasOwnProperty(v)) return PAGE_BG_LIGHT[v];
    var m=/^#?([0-9a-f]{6})$/i.exec(v);
    if(!m) return false;
    var n=parseInt(m[1],16);
    return (0.2126*((n>>16)&255)+0.7152*((n>>8)&255)
      +0.0722*(n&255))/255>0.55;
  }
  /* a gradient has no single colour, and the .pptx and the PDF both want
     one - take the first stop, which is the end the eye lands on */
  function bgSolid(bg){
    var v=String(bg||'').trim();
    if(v.indexOf('gradient')<0) return v;
    var m=/#([0-9a-f]{3,8})/i.exec(v);
    return m?('#'+m[1]):'#0b141d';
  }
  /* ONE chip builder, used by the per-slide menu and by the deck-wide
     default - so the two can never drift apart */
  function bgChips(host,current,onPick,withAuto){
    if(withAuto){
      var auto=document.createElement('button');
      auto.className='sh-opt bg-auto';auto.textContent='Auto';
      auto.title='Match the presentation background';
      auto.setAttribute('aria-pressed',(!current).toString());
      auto.addEventListener('click',function(e){
        e.stopPropagation();onPick('');});
      host.appendChild(auto);
    }
    PAGE_BGS.forEach(function(q){
      var b=document.createElement('button');
      b.className='sh-opt bg-chip'+(q[2]?' is-light':'');
      b.title=q[1];
      b.style.background=q[0];
      b.dataset.bgv=q[0];
      b.setAttribute('aria-pressed',(current===q[0]).toString());
      b.addEventListener('click',function(e){
        e.stopPropagation();onPick(q[0]);});
      host.appendChild(b);
    });
  }
  function applyPageBg(){
    /* the slide's own colour wins; File > Page background stays the
       presentation-wide default (2026-08-18, user asked for per-slide
       backgrounds "like PowerPoint has") */
    var s0=pres&&pres.slides&&pres.slides[cur];
    var bg=(s0&&s0.bg)||(pres&&pres.pageBg)||'#0b141d';
    deckEl.style.setProperty('--page-bg',bg);
    deckEl.classList.toggle('page-light',pageIsLight(bg));
    /* the chips live in the Background dropdown now, and it rebuilds
       itself each time it opens - nothing to sync here */
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
    /* a poster is one printed page and has no build, so the whole
       Animate group stands down rather than just its first control —
       syncRibbonGroups hides a group once nothing in it is showing */
    var vaB=$('#vw-anim');
    if(vaB) vaB.hidden=!!pg.poster;
    ['#anim-clear','#anim-stagger','#anim-together'].forEach(function(id){
      var b2=$(id); if(b2) b2.hidden=!!pg.poster;});
    var slideLab=deckEl.querySelector('.rbn-slide .rbn-lab');
    if(slideLab) slideLab.textContent=pg.poster?'Page':'Slide';
    var nums=$('#mi-nums');
    if(nums) nums.hidden=!!pg.poster;
    /* a poster keeps "+ Add" — its pages are versions, and you need a way
       to make one; it just lives behind the Versions button now */
    /* a poster's pages are VERSIONS — deliberately different drafts of
       one sheet — so grouping them into sections means nothing */
    var secb=$('#film-sec');
    if(secb) secb.hidden=!!pg.poster;
    /* the chooser's own words follow the page kind the same way */
    if(typeof window.SemDeckFilmBtn==='function') window.SemDeckFilmBtn();
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
      vb.innerHTML=pg.poster?bic('versions')+' Versions'
        :bic('versions')+' Slides';
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
    /* the furniture is sized in page percentages too, so it has to be
       re-measured whenever the page changes size */
    if(s0) paintFurniture(slideEl,cur);
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
    /* everything below is a percentage of the slide, so only a page-size/
       margin change alters it — skip the innerHTML when nothing did
       (drawGrid used to re-render per stage mousemove via syncGuides) */
    var gsig=g.m.x+','+g.m.y+','+g.colW+','+g.rowH+','+g.rows;
    if(host._gsig===gsig) return;
    host._gsig=gsig;
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
    /* the ticks depend only on the page length and the px-per-mm scale,
       so they rebuild ONLY when those change (zoom, page size, a stage
       resize). Every mousemove used to regenerate thousands of <i>/<span>
       nodes through innerHTML just so the 1px cursor could move
       (2026-08-23 perf). */
    var sig=lenMm+'|'+pxPerMm+(vertical?'v':'h');
    if(el._rsig===sig) return;
    el._rsig=sig;
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
  /* the slide's px size at the last full ruler placement — the light
     cursor/selection updates reuse it instead of re-reading layout */
  var rulerPx={w:0,h:0};
  /* a persistent overlay child of a ruler (the cursor line, the selection
     span): created once and repositioned forever. A tick rebuild's
     innerHTML orphans it, and then it is simply made again. */
  function rulerMark(el,cls){
    var m=el._marks&&el._marks[cls];
    if(!m||m.parentNode!==el){
      m=document.createElement('i');
      m.className=cls;
      m.style.left='0';m.style.top='0';
      el.appendChild(m);
      (el._marks=el._marks||{})[cls]=m;
    }
    return m;
  }
  /* the selected item's extent, shaded on both rulers */
  function drawRulerSel(){
    var rh=$('#ruler-h'),rv=$('#ruler-v');
    if(!rh||!rv) return;
    var hs=rulerMark(rh,'rspan'),vs=rulerMark(rv,'rspan');
    var s=pres&&pres.slides?pres.slides[cur]:null;
    var slideEl=stage?stage.querySelector('.slide'):null;
    var layer=slideEl?slideEl.querySelector('.annot-layer'):null;
    var r=(s&&layer&&typeof selAnnot==='number')
      ?annotRectPct(layer,s,selAnnot):null;
    if(r){
      hs.style.display='';
      hs.style.left=(r.l/100*rulerPx.w)+'px';
      hs.style.width=((r.r-r.l)/100*rulerPx.w)+'px';
      vs.style.display='';
      vs.style.top=(r.t/100*rulerPx.h)+'px';
      vs.style.height=((r.b-r.t)/100*rulerPx.h)+'px';
    } else {hs.style.display='none';vs.style.display='none';}
  }
  /* the pointer's position on both rulers — a transform, never a rebuild */
  function drawRulerCursor(){
    var rh=$('#ruler-h'),rv=$('#ruler-v');
    if(!rh||!rv) return;
    var hc=rulerMark(rh,'rcursor'),vc=rulerMark(rv,'rcursor');
    if(rulerCursor.x!=null){
      hc.style.display='';
      hc.style.transform='translateX('+(rulerCursor.x*rulerPx.w)+'px)';
    } else hc.style.display='none';
    if(rulerCursor.y!=null){
      vc.style.display='';
      vc.style.transform='translateY('+(rulerCursor.y*rulerPx.h)+'px)';
    } else vc.style.display='none';
  }
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
    rulerPx.w=sr.width;rulerPx.h=sr.height;
    drawRulerSel();
    drawRulerCursor();
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
    return {x:(g.x||[]).slice(),y:(g.y||[]).slice(),
            b:(g.b||[]).map(function(v){return v.slice();})};
  }
  function setCustomGuides(g){
    if(!pres) return;
    if(guidesEmpty(g)) delete pres.guides;
    else pres.guides=liveGuides(g);
    markDirty();
  }
  /* "are there any guides at all". ONE function, because the answer is
     asked in two places that must agree: whether to keep pres.guides,
     and whether to keep the layer that draws them. They did not agree —
     drawCustomGuides asked only about the LINES, so a page with guide
     boxes and no lines tore its own guide layer down and drew nothing.
     Found in the browser, 2026-08-25; the tests could not see it,
     because every one of them is a substring of the source. */
  function guidesEmpty(g){
    return !g.x.length&&!g.y.length&&!g.b.length;
  }
  /* the shape written into `pres` — ONE place, because a guide drag
     writes it live on every mousemove, and a drag that forgot a field
     would quietly delete every guide of the kind it forgot (the box
     array was nearly born with exactly that bug) */
  function liveGuides(g){
    var o={x:g.x,y:g.y};
    if(g.b.length) o.b=g.b;
    return o;
  }
  function drawCustomGuides(slideEl){
    if(!slideEl) return;
    var host=slideEl.querySelector('.cguides');
    var cg=customGuides();
    if(mode!=='edit'||guidesEmpty(cg)){
      if(host) host.remove(); return;
    }
    if(!host){
      host=document.createElement('div');host.className='cguides';
      slideEl.insertBefore(host,slideEl.firstChild);
    }
    /* guides are percentages of the slide too — rebuild only when a value
       actually changed (a guide drag repaints live; a plain mousemove or
       scroll through syncGuides skips) */
    var csig=cg.x.join(',')+'|'+cg.y.join(',')+'|'
      +cg.b.map(function(v){return v.join(' ');}).join(',');
    if(host._csig===csig) return;
    host._csig=csig;
    host.innerHTML=
      cg.x.map(function(v,i){
        return '<i class="cguide cg-v" data-ax="x" data-i="'+i
          +'" style="left:'+v+'%"></i>';}).join('')
      +cg.y.map(function(v,i){
        return '<i class="cguide cg-h" data-ax="y" data-i="'+i
          +'" style="top:'+v+'%"></i>';}).join('')
      /* FOUR EDGE STRIPS, not one clickable rectangle. A guide box is
         mostly empty middle, and an element taking pointer events across
         its whole area would swallow every click on the canvas beneath
         it — which, for a box drawn round the figure well, is most of
         the page. The strips are the only part that listens. */
      +cg.b.map(function(v,i){
        return '<i class="cg-box" data-i="'+i+'" style="left:'+v[0]
          +'%;top:'+v[1]+'%;width:'+v[2]+'%;height:'+v[3]+'%">'
          +'<i class="cg-edge cg-e-t"></i><i class="cg-edge cg-e-r"></i>'
          +'<i class="cg-edge cg-e-b"></i><i class="cg-edge cg-e-l"></i>'
          +'</i>';}).join('');
  }
  /* ---- guide BOXES: a region to lay out inside ------------------------
     A guide LINE answers "is this edge where I said"; a guide BOX answers
     "does this belong in this area at all" — the title band, the figure
     well, the column a poster's text has to stay inside (TASKS T4).

     Same contract as the lines, and the load-bearing half of it is that a
     guide is NOT an annotation. Nothing in s.annots means nothing to
     exclude: it cannot reach a render, a PDF, a .pptx or a saved
     standalone page by way of somebody forgetting a filter, which is the
     failure mode this feature would otherwise have. The CSS says the
     rest (.deck:not(.editing) .cguides, @media print, #print-root).

     Stored as [x,y,w,h] in page percentages, beside the lines. */
  var GBOX_MIN=1.5;      /* under this it was a click, not a drag */
  function startGuideBox(layer,p0){
    var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
    var cg=customGuides();
    var box=[p0.x,p0.y,0,0];
    var idx=cg.b.push(box)-1;
    function mv(e){
      var p=pctPoint(layer,e);
      box[0]=Math.min(p0.x,p.x);box[1]=Math.min(p0.y,p.y);
      box[2]=Math.abs(p.x-p0.x);box[3]=Math.abs(p.y-p0.y);
      /* live geometry only; the commit waits for mouseup — the same
         one-commit-per-gesture contract the line guides follow */
      if(pres) pres.guides=liveGuides(cg);
      drawCustomGuides(slideEl);
    }
    function up(){
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      if(box[2]<GBOX_MIN||box[3]<GBOX_MIN) cg.b.splice(idx,1);
      else cg.b[idx]=box.map(function(v){return Math.round(v*100)/100;});
      setCustomGuides(cg);drawCustomGuides(slideEl);
      /* one box, then back to selecting. A guide is furniture you put
         down, not a mode to live in — and a tool that stays armed is a
         tool that gets left armed (cf. #et-cancel's whole reason). */
      setTool('select');
    }
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
  }
  function startGuideBoxMove(ev,i){
    ev.preventDefault();
    var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
    var cg=customGuides(),o=cg.b[i];
    if(!o) return;
    o=o.slice();
    var sr=slideEl.getBoundingClientRect();
    var sx=ev.clientX,sy=ev.clientY;
    function mv(e){
      if(!sr.width||!sr.height) return;
      cg.b[i]=[o[0]+(e.clientX-sx)/sr.width*100,
               o[1]+(e.clientY-sy)/sr.height*100,o[2],o[3]];
      if(pres) pres.guides=liveGuides(cg);
      drawCustomGuides(slideEl);
    }
    function up(){
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      var b=cg.b[i];
      /* dropped with its middle off the page: that is how a line guide is
         deleted, and a box has no business needing a new gesture */
      var cx=b[0]+b[2]/2,cy=b[1]+b[3]/2;
      if(cx<0||cx>100||cy<0||cy>100) cg.b.splice(i,1);
      else cg.b[i]=b.map(function(v){return Math.round(v*100)/100;});
      setCustomGuides(cg);drawCustomGuides(slideEl);
    }
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
  }
  function clearGuides(boxesOnly){
    var cg=customGuides();
    cg.b=[];
    if(!boxesOnly){cg.x=[];cg.y=[];}
    setCustomGuides(cg);
    drawCustomGuides(stage.querySelector('.slide'));
    toast(boxesOnly?'Guide boxes cleared':'Guides cleared');
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
      /* live geometry only while the mouse is down: the model updates in
         place and the guide layer repaints, but the commit (markDirty:
         full-deck stringify + localStorage write + a no-op histPush,
         guides being outside the undo snapshot) waits for mouseup — the
         same one-commit-per-gesture contract item drags follow. It used
         to run per mousemove, ~60 stringify+write/s (2026-08-23 perf). */
      if(pres) pres.guides=liveGuides(cg);
      drawCustomGuides(slideEl);
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
    /* the square where the two rulers meet arms the guide BOX, which is
       the same idea one dimension up: each ruler lays down a guide line,
       so their corner lays down a guide area (2026-08-25) */
    var rc=$('#ruler-corner');
    if(rc) rc.addEventListener('click',function(){
      if(mode==='edit') setTool('guide');});
    if(stage) stage.addEventListener('mousedown',function(e){
      var gb=e.target.closest?e.target.closest('.cg-edge'):null;
      if(gb&&gb.parentNode){
        e.stopPropagation();
        startGuideBoxMove(e,+gb.parentNode.dataset.i);
        return;
      }
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
      if(a.k==='cell'&&a.ref){
        var itc=resolveRef(a.ref);
        /* an unresolvable ref renders as NOTHING outside the editor —
           that silent blank was only ever discovered on the projector */
        if(!itc)
          add(i,'err',label+' cannot be shown',
            'Its notebook is not open and the deck holds no saved copy '
            +'of it — it will present and print as blank space.');
        else if(itc.emb)
          add(i,'warn',label+' shows its saved copy',
            'Its notebook is not open, so the frame shows the copy saved '
            +'with the deck. Open the notebook to pick up any changes.');
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
  /* ---- WHAT HAS THIS OBJECT LOOKED LIKE --------------------------------
     Per-object history (TASKS T10). Three decisions carry the whole
     design, and each of them is the reason there is no second machine
     here fighting the first:

     1. THE HISTORY IS DERIVED, NOT RECORDED. undoStack already holds a
        full snapshot of the deck at every step; an object's past is
        those snapshots, read through the object's own identity. So
        there is no second log to keep in step, nothing to forget to
        record, and no way for the timeline to claim something Ctrl+Z
        would disagree with. It costs nothing at all until you look.

     2. RESTORING A PAST STATE IS AN EDIT, NOT A REWIND. It writes that
        state onto the object as it stands now and takes one ordinary
        undo entry. Nothing is popped off the global stack, so "undo
        just this object" cannot conflict with it — the conflict the
        task worried about does not arise, because the two mechanisms
        never touch the same data. Ctrl+Z afterwards undoes the restore
        itself, which is exactly what anyone would expect.

     3. IDENTITY IS LAZY AND SELF-HEALING. An index is not identity: an
        insert or a delete shifts every object after it. Objects carry
        an `oid`, minted on first sight by ensureOids rather than at the
        dozen places an annot can be born — one funnel, idempotent, and
        it re-mints a duplicate (which is what a copied annot arrives
        with) instead of asking every copy site to remember to strip
        one.

     Scope is ONE SLIDE, deliberately: "what has this object looked
     like" is asked about a thing you are pointing at on the page in
     front of you, and cross-slide identity would buy nothing for it. */
  var oidSeq=0;
  function mintOid(){
    return 'o'+(oidSeq++).toString(36)
      +Math.random().toString(36).slice(2,6);
  }
  function ensureOids(s){
    if(!s||!s.annots) return;
    var seen={};
    s.annots.forEach(function(a){
      if(!a) return;
      if(!a.oid||seen[a.oid]) a.oid=mintOid();
      seen[a.oid]=1;
    });
  }
  /* the things worth naming when they change. A caption saying "x, y, w"
     is a diff; one saying "moved, resized" is a sentence. */
  var OH_WORDS={x:'moved',y:'moved',w:'resized',h:'resized',
    x1:'moved',y1:'moved',x2:'moved',y2:'moved',mid:'re-routed',
    size:'text size',color:'colour',bg:'background',bgc:'background',
    txcol:'colour',bgcol:'background',
    font:'typeface',style:'named type',text:'text',rot:'rotation',
    fill:'fill',fillc:'fill',grad:'fill',sw:'line weight',
    align:'alignment',lh:'line spacing',pspace:'paragraph spacing',
    ref:'the card it shows',crop:'crop',op:'see-through',
    lock:'lock',hide:'hidden',grp:'grouping',anim:'build',
    b:'bold',i:'italic',u:'underline',strike:'strike'};
  function ohChanges(prev,now){
    if(!prev) return 'created';
    var words=[],seen={};
    var keys={};
    Object.keys(prev).forEach(function(k){keys[k]=1;});
    Object.keys(now).forEach(function(k){keys[k]=1;});
    Object.keys(keys).forEach(function(k){
      if(k==='oid') return;
      if(JSON.stringify(prev[k])===JSON.stringify(now[k])) return;
      var w=OH_WORDS[k]||k;
      if(!seen[w]){seen[w]=1;words.push(w);}
    });
    if(!words.length) return 'no visible change';
    return words.slice(0,4).join(', ')
      +(words.length>4?' and more':'');
  }
  /* HOW FAR BACK. The undo stack is 50 deep and each entry is the whole
     deck as a string, so reading them all means parsing 50 decks —
     which for a deck carrying a couple of pasted screenshots is real
     work. This is an on-demand inspector, so it does that work only
     when the pane is open, and only over the recent end of the stack:
     "what has this object looked like" is a question about the last
     little while, and a timeline nobody scrolls to the bottom of does
     not earn a two-second pause. */
  var OH_DEPTH=24;
  function objHistory(oid){
    if(!oid) return [];
    var snaps=undoStack.slice(-OH_DEPTH).concat([histState()]);
    var out=[];
    snaps.forEach(function(js){
      var d;try{d=JSON.parse(js);}catch(e){return;}
      var sl=(d.slides||[])[cur];
      if(!sl||!sl.annots) return;
      var hit=null;
      sl.annots.forEach(function(a){if(a&&a.oid===oid) hit=a;});
      if(!hit) return;
      var sig=JSON.stringify(hit);
      if(out.length&&out[out.length-1].sig===sig) return;
      out.push({a:hit,sig:sig});
    });
    /* newest first: the state you are looking at is the one you are
       asking about, and the interesting rows are the ones near it */
    out.reverse();
    out.forEach(function(e,k){
      e.what=ohChanges(out[k+1]?out[k+1].a:null,e.a);
      e.now=(k===0);
    });
    return out;
  }
  /* a schematic of a past state, not a render of it. Rendering an
     arbitrary historical annot would mean running renderAnnots against a
     slide that does not exist; the thing a person actually needs off a
     timeline row is "which one was this" — the shape, the colour, and
     the words if it had any. */
  function ohThumb(a){
    var d=document.createElement('div');
    d.className='oh-thumb';
    var w=Math.max(6,Math.min(100,a.w||18));
    var h=Math.max(6,Math.min(100,a.h||12));
    d.style.aspectRatio=(w/h).toFixed(3);
    if(a.k==='text'){
      d.classList.add('oh-text');
      d.textContent=String(a.text||'').trim().slice(0,40)||'(empty)';
      if(a.color) d.style.color=a.color;
      if(a.bg!==0&&a.bgc) d.style.background=a.bgc;
    } else if(a.k==='rect'){
      d.style.borderColor=a.color||'#ff6b57';
      if(a.fill&&a.fillc) d.style.background=a.fillc;
    } else if(a.k==='arrow'){
      d.classList.add('oh-line');
      d.style.borderColor=a.color||'#ff6b57';
    } else {
      d.classList.add('oh-block');
      d.textContent=annotLabel(a);
    }
    return d;
  }
  var ohOid=null;
  function renderObjHist(){
    var list=$('#objhist-list'),head=$('#objhist-count');
    var ttl=$('#objhist-t');
    if(!list) return;
    var s=pres.slides[cur];
    var live=null;
    (s&&s.annots||[]).forEach(function(a,i){
      if(a&&a.oid===ohOid) live={a:a,i:i};});
    if(ttl) ttl.textContent=live?annotLabel(live.a):'This object';
    var hist=objHistory(ohOid);
    if(head) head.textContent=!live
      ?'this object is gone'
      :(hist.length===1?'one state — nothing has changed yet'
        :hist.length+' states');
    list.innerHTML='';
    if(!live){
      var g=document.createElement('div');
      g.className='pf-ok';
      g.textContent='This object is no longer on the page. Ctrl+Z brings '
        +'back a deletion; this pane only shows what is still here.';
      list.appendChild(g);
      return;
    }
    hist.forEach(function(e,k){
      var row=document.createElement('div');
      row.className='oh-row'+(e.now?' oh-now':'');
      row.appendChild(ohThumb(e.a));
      var body=document.createElement('div');
      body.className='oh-body';
      var h=document.createElement('div');
      h.className='oh-h';
      h.textContent=e.now?'now':(k===hist.length-1?'earliest kept'
        :(k+' step'+(k===1?'':'s')+' ago'));
      body.appendChild(h);
      var w=document.createElement('div');
      w.className='oh-what';w.textContent=e.what;
      body.appendChild(w);
      row.appendChild(body);
      if(!e.now){
        var b=document.createElement('button');
        b.className='dbtn oh-do';b.textContent='Put it back to this';
        b.title='Writes this state onto the object as it stands now. It '
          +'is an ordinary edit \u2014 Ctrl+Z undoes it, and nothing '
          +'else on the page moves.';
        b.addEventListener('click',function(){
          ohRestore(e.a);});
        row.appendChild(b);
      }
      list.appendChild(row);
    });
  }
  function ohRestore(past){
    var s=pres.slides[cur];
    var at=-1;
    (s&&s.annots||[]).forEach(function(a,i){
      if(a&&a.oid===ohOid) at=i;});
    if(at<0){renderObjHist();return;}
    /* replace the object's fields wholesale, keeping its identity and
       its place in the array — the array position IS the stacking order,
       and restoring a look must not send it to the front */
    var keep=s.annots[at].oid;
    s.annots[at]=deep(past);
    s.annots[at].oid=keep;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectAnnot(l,at);}
    toast('Put back \u2014 one edit, so Ctrl+Z undoes it');
    renderObjHist();
  }
  function showObjHist(){
    var s=pres.slides[cur];
    var idxs=selIdxs();
    var a=s&&(s.annots||[])[idxs[idxs.length-1]];
    if(!a){toast('Select an object first');return;}
    ensureOids(s);
    ohOid=a.oid;
    var pane=$('#objhist'); if(!pane) return;
    ['#selpane','#animpane','#preflight','#notespane','#stdpane',
     '#tidypane'].forEach(function(sel){
      var o=$(sel); if(o) o.hidden=true;});
    pane.hidden=false;
    renderObjHist();
    syncPaneDock();
  }
  (function(){
    var cl=$('#objhist-close');
    if(cl) cl.addEventListener('click',function(){
      var p=$('#objhist'); if(p) p.hidden=true;
      syncPaneDock();
    });
  })();
  /* ---- TIDY UP THIS PAGE -----------------------------------------------
     A third question in the same shell as the other two. preflight() asks
     whether this page survives a printer. standardise() asks whether the
     deck agrees with itself. This asks whether the page is SLOPPY, which
     is a different thing again: everything here is individually fine and
     collectively looks like nobody was paying attention.

     Three kinds of sloppiness, and one rule over all of them: REPORT
     FIRST. Nothing moves until a button is pressed, and every button
     moves one finding's worth of things. A cleanup that rearranged the
     page the moment you asked it to look would be a cleanup nobody dares
     run twice (TASKS T9).

     The tolerances are the whole design, so they are named and argued:

       NEAR    an edge that is out by less than this is ALREADY aligned as
               far as anyone can see, and "fixing" it is noise.
       APART   out by more than this and it is a decision, not a slip.
               Reporting it would be second-guessing the layout.

     Between the two is the band where someone meant to line things up and
     missed — which is exactly the population this feature is for. */
  var TIDY_NEAR=0.12, TIDY_APART=1.6;
  /* gaps: uneven by more than this fraction of the mean is deliberate
     (a wide gutter between two blocks), under it is a wobble */
  var TIDY_GAP_REL=0.28;
  function tidyRects(layer,s){
    var out=[];
    (s.annots||[]).forEach(function(a,i){
      if(!a||a.hide||a.k==='arrow') return;
      /* a pinned object is not moved by anything else on the canvas, so
         offering to move it here would be a button that lies (T3) */
      if(pinned(a)) return;
      var r=annotRectPct(layer,s,i);
      if(r) out.push({i:i,a:a,r:r});
    });
    return out;
  }
  /* group values that are nearly-but-not-exactly equal. Returns only the
     clusters worth reporting: two or more members, and a spread inside
     the "meant to line up and missed" band. */
  function tidyClusters(items,read){
    var v=items.map(function(x){return {x:x,v:read(x.r)};});
    v.sort(function(p,q){return p.v-q.v;});
    var out=[],run=[v[0]];
    for(var k=1;k<v.length;k++){
      if(v[k].v-run[run.length-1].v<=TIDY_APART) run.push(v[k]);
      else {out.push(run);run=[v[k]];}
    }
    out.push(run);
    return out.filter(function(r){
      if(r.length<2) return false;
      var sp=r[r.length-1].v-r[0].v;
      return sp>TIDY_NEAR&&sp<=TIDY_APART;
    });
  }
  function tidyMedian(v){
    var a=v.slice().sort(function(p,q){return p-q;});
    return a[Math.floor(a.length/2)];
  }
  /* what makes two objects the SAME thing rather than two like things.
     Geometry alone is not enough — two equal-sized swatches side by side
     are a design, not a mistake — so content has to agree too. */
  function tidySig(a){
    if(a.k==='text') return 'text:'+String(a.text||'').trim().slice(0,80);
    if(a.k==='cell') return 'cell:'+(a.ref||'');
    if(a.k==='image') return 'image:'+String(a.src||'').slice(0,64);
    if(a.k==='rect')
      return 'rect:'+(a.shape||'box')+':'+(a.color||'')+':'+(a.fillc||'');
    if(a.k==='table') return 'table:'+JSON.stringify(a.rows||[]).slice(0,80);
    return a.k;
  }
  var TIDY_EDGES=[
    ['l','left edges',function(r){return r.l;},true],
    ['cx','centres, side to side',function(r){return (r.l+r.r)/2;},true],
    ['r','right edges',function(r){return r.r;},true],
    ['t','top edges',function(r){return r.t;},false],
    ['cy','middles, top to bottom',function(r){return (r.t+r.b)/2;},false],
    ['b','bottom edges',function(r){return r.b;},false]
  ];
  function tidyFindings(){
    var s=pres.slides[cur];
    var layer=stage?stage.querySelector('.annot-layer'):null;
    if(!s||!layer) return [];
    var items=tidyRects(layer,s);
    var out=[];
    if(items.length<2) return out;

    /* ---- 1. nearly aligned ---- */
    var seen={};
    TIDY_EDGES.forEach(function(e){
      tidyClusters(items,e[2]).forEach(function(cl){
        /* one physical near-miss shows up on l, cx and r at once when the
           widths match. Report it once, on whichever edge it is tightest
           — that is the one the eye is reading. */
        var sig=e[3]+'|'+cl.map(function(m){return m.x.i;}).sort().join(',');
        var sp=cl[cl.length-1].v-cl[0].v;
        if(seen[sig]&&seen[sig].sp<=sp) return;
        var target=tidyMedian(cl.map(function(m){return m.v;}));
        var f={kind:'align',sev:'warn',sp:sp,
          list:cl.map(function(m){return {si:cur,ai:m.x.i,a:m.x.a};}),
          head:cl.length+' objects nearly share their '+e[1],
          why:'They are '+gapMm(sp,e[3])+' apart across '+e[1]
            +'. Close enough to look like a mistake, far enough to see.',
          act:'Line up their '+e[1],
          fix:(function(cl2,rd,horiz,tgt){return function(){
            cl2.forEach(function(m){
              var d=tgt-rd(m.x.r);
              shiftAnnot(m.x.a,horiz?d:0,horiz?0:d);
            });
            return cl2.length;
          };})(cl,e[2],e[3],target)};
        seen[sig]=f;
      });
    });
    Object.keys(seen).forEach(function(k){out.push(seen[k]);});

    /* ---- 2. gaps that wobble ---- */
    [true,false].forEach(function(horiz){
      var done={};
      items.forEach(function(x){
        var run=bandMates(layer,s,x.i,horiz)
          .filter(function(i){
            return items.some(function(y){return y.i===i;});});
        if(run.length<3) return;
        var key=run.slice().sort().join(',');
        if(done[key]) return;
        done[key]=1;
        var rs=run.map(function(i){
          return items.filter(function(y){return y.i===i;})[0];})
          .filter(Boolean);
        rs.sort(function(p,q){
          return horiz?(p.r.l-q.r.l):(p.r.t-q.r.t);});
        var gaps=[];
        for(var k=1;k<rs.length;k++)
          gaps.push(horiz?(rs[k].r.l-rs[k-1].r.r)
                         :(rs[k].r.t-rs[k-1].r.b));
        if(gaps.some(function(g){return g<0;})) return;
        var mean=gaps.reduce(function(a,b){return a+b;},0)/gaps.length;
        var sp=Math.max.apply(null,gaps)-Math.min.apply(null,gaps);
        if(!(mean>0)||sp<=TIDY_NEAR||sp>mean*TIDY_GAP_REL) return;
        out.push({kind:'gaps',sev:'warn',sp:sp,
          list:rs.map(function(y){return {si:cur,ai:y.i,a:y.a};}),
          head:rs.length+' objects '+(horiz?'across':'down')
            +' with uneven gaps',
          why:'The gaps run '+gaps.map(function(g){
            return gapMm(g,horiz);}).join(', ')
            +'. Uneven whitespace is what reads as sloppy even when '
            +'everything is aligned.',
          act:'Space them evenly',
          fix:(function(rs2,horiz2){return function(){
            /* the OUTER two do not move: distributing between them is
               what "even" means, and moving the ends would slide the
               whole run somewhere nobody asked for */
            var first=rs2[0],last=rs2[rs2.length-1];
            var lo=horiz2?first.r.r:first.r.b;
            var hi=horiz2?last.r.l:last.r.t;
            var inner=rs2.slice(1,-1);
            var span=inner.reduce(function(t,y){
              return t+(horiz2?(y.r.r-y.r.l):(y.r.b-y.r.t));},0);
            var g=(hi-lo-span)/(inner.length+1);
            var pos=lo+g;
            inner.forEach(function(y){
              var d=pos-(horiz2?y.r.l:y.r.t);
              shiftAnnot(y.a,horiz2?d:0,horiz2?0:d);
              pos+=(horiz2?(y.r.r-y.r.l):(y.r.b-y.r.t))+g;
            });
            return inner.length;
          };})(rs,horiz)});
      });
    });

    /* ---- 3. the same thing, twice ---- */
    for(var i=0;i<items.length;i++) for(var j=i+1;j<items.length;j++){
      var A=items[i],B=items[j];
      if(A.a.k!==B.a.k) continue;
      if(tidySig(A.a)!==tidySig(B.a)) continue;
      var aw=A.r.r-A.r.l,ah=A.r.b-A.r.t;
      var bw=B.r.r-B.r.l,bh=B.r.b-B.r.t;
      if(!(aw>0&&ah>0)) continue;
      if(Math.abs(aw-bw)>aw*0.05||Math.abs(ah-bh)>ah*0.05) continue;
      var dx=Math.abs((A.r.l+A.r.r)/2-(B.r.l+B.r.r)/2);
      var dy=Math.abs((A.r.t+A.r.b)/2-(B.r.t+B.r.b)/2);
      if(dx>4||dy>4) continue;
      out.push({kind:'dup',sev:'warn',sp:Math.max(dx,dy),
        list:[{si:cur,ai:A.i,a:A.a},{si:cur,ai:B.i,a:B.a}],
        head:'Two copies of '+annotLabel(A.a),
        why:'Same content, same size, almost the same place — the shape '
          +'a paste that happened twice leaves behind. Only the one '
          +'underneath is doing anything.',
        act:'Delete the copy on top',
        fix:(function(k){return function(){
          var sl=pres.slides[cur];
          if(sl&&sl.annots&&sl.annots[k]) sl.annots.splice(k,1);
          selAnnot=null;selSet=[];
          return 1;
        };})(Math.max(A.i,B.i))});
    }
    /* worst first: the further out of true, the more it shows */
    out.sort(function(p,q){return q.sp-p.sp;});
    return out;
  }
  function tidyRow(f){
    var box=document.createElement('div');
    box.className='std-find std-'+f.sev;
    var h=document.createElement('div');
    h.className='std-h';h.textContent=f.head;box.appendChild(h);
    var w=document.createElement('div');
    w.className='std-why';w.textContent=f.why;box.appendChild(w);
    var who=document.createElement('div');who.className='std-who';
    f.list.slice(0,12).forEach(function(p){
      var c=document.createElement('button');
      c.className='std-chip';
      c.textContent=annotLabel(p.a);
      c.title='Select it';
      c.addEventListener('click',function(){
        var l=stage.querySelector('.annot-layer');
        if(l) selectAnnot(l,p.ai);
      });
      who.appendChild(c);
    });
    box.appendChild(who);
    var act=document.createElement('button');
    act.className='dbtn std-do';
    act.textContent=f.act;
    act.addEventListener('click',function(){
      var n=f.fix()||0;
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}
      toast(n+' object'+(n===1?'':'s')+' tidied \u2014 Ctrl+Z undoes it');
      renderTidyPane();
    });
    box.appendChild(act);
    return box;
  }
  function renderTidyPane(){
    var list=$('#tidypane-list'),head=$('#tidypane-count');
    if(!list) return;
    var f=tidyFindings();
    if(head) head.textContent=f.length
      ?(f.length+' to look at')
      :'nothing out of true';
    list.innerHTML='';
    if(!f.length){
      var msg=document.createElement('div');
      msg.className='pf-ok';
      msg.textContent='This page is tidy. Nothing is nearly-but-not-'
        +'quite lined up, the gaps are even, and nothing has been '
        +'pasted twice on top of itself.';
      list.appendChild(msg);
      return;
    }
    f.forEach(function(x){list.appendChild(tidyRow(x));});
  }
  function showTidyPane(){
    var pane=$('#tidypane'); if(!pane) return;
    ['#selpane','#animpane','#preflight','#notespane','#stdpane']
      .forEach(function(sel){var o=$(sel); if(o) o.hidden=true;});
    pane.hidden=false;
    renderTidyPane();
    syncPaneDock();
  }
  (function(){
    var cl=$('#tidypane-close');
    if(cl) cl.addEventListener('click',function(){
      var p=$('#tidypane'); if(p) p.hidden=true;
      syncPaneDock();
    });
    var rr=$('#tidypane-rerun');
    if(rr) rr.addEventListener('click',renderTidyPane);
  })();
  /* ---- STANDARDISE TEXT -------------------------------------------------
     (2026-08-22, user: "it would be cool if there was a button that was
     called 'standardise text', and checked if all headings paragraphs,
     captions, are looking the same".)

     preflight() above asks whether THIS page is safe to print. This asks
     a different question — whether the DECK agrees with itself — and it
     has to answer it for the deck nobody has styled, because a check
     that only read a.style would look at forty slides of hand-set text,
     find no styles to disagree, and report "all fine". That is not a
     weak answer, it is a false one, and it is the half of this worth
     building carefully.

     So there are two passes. Boxes that WEAR a style are measured
     against the style they claim. Boxes wearing nothing are bucketed by
     what they LOOK like, and the bucket is then offered a name — which
     is the part that pays for itself, because once a band is named,
     restyleAll, "apply this look to all headings" and the Apply dialog's
     bucketing all start working on a deck that was invisible to them. */

  /* WHY THESE NUMBERS. Every one is anchored to a step the editor itself
     can take, so a threshold never fires on a difference nobody could
     have made deliberately, and never misses one they did.
       SIZE 1.03 — the pt readout is size*5.4, so 3% of a 2.6 body is
     0.4pt: below it nothing is visible, above it two headings side by
     side read as different sizes. It sits well inside the A+/A− stepper's
     1.12, so one deliberate press always registers as a real difference.
       BAND 1.06 — half a stepper press. Two sizes closer than this were
     nudged apart by hand and meant to be one size; 12% apart is one press
     and is meant.
       LUM 0.05 — about the gap between the Caption grey (#8aa0b0) and the
     subtitle grey (#7e93a4). Those two ARE two hand-picked greys doing
     the same job, which is exactly the thing to report.
       CHAN 0.10 — a different HUE at the same tone is invisible to a
     luminance test, so it needs its own number.
       POS 1.0 / W 2.0 — 1% of a 16:9 page is under half a character at
     body size; more than that and a heading visibly jumps as you page
     through, which is the drift nothing else in this file can see.
     Module-local: a threshold is a judgement about type, not a property
     of one deck. */
  var STD_SIZE_TOL=1.03, STD_BAND_TOL=1.06;
  var STD_LUM_TOL=0.05,  STD_CHAN_TOL=0.10;
  var STD_POS_TOL=1.0,   STD_W_TOL=2.0;
  /* an ABSENT a.color is not "unknown", it is the page ink — resolve it
     before comparing or a deck where half the boxes say #ffffff and half
     say nothing reports a drift that is not on the screen. The same ink
     preflight computes. */
  function stdInk(){
    return pageIsLight((pres&&pres.pageBg)||'#0b141d')?'#0b141d':'#ffffff';
  }
  function stdSize(a){return (a&&a.size)||2.6;}
  function stdCol(a){return (a&&a.color)||stdInk();}
  /* two numbers, because "a different colour" is true in two ways and one
     distance hides one behind the other */
  function colDrift(c1,c2){
    var a=rgbOf(c1),b=rgbOf(c2);
    if(!a||!b) return String(c1||'')===String(c2||'')?0:1;
    var dl=Math.abs(relLum(a)-relLum(b));
    var dh=Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),
      Math.abs(a[2]-b[2]))/255;
    if(dl>STD_LUM_TOL) return dl;
    if(dh>STD_CHAN_TOL) return dh;
    return 0;
  }
  /* EVERY text-bearing thing in the deck, in reading order per slide.
     Title slides are in here on purpose: their title and subtitle are
     text the user thinks of as headings and they honour the same
     properties applyStyleTo writes, so a check that skipped them would
     call a deck consistent while its title slides disagreed. They carry
     no width and are centred, so the geometry checks skip them — that is
     what `fixed` marks. */
  function stdBoxes(){
    var out=[];
    (pres.slides||[]).forEach(function(sl,si){
      if(sl.layout==='title'){
        out.push({si:si,ai:'t',a:titleProps(sl,'t'),fixed:1});
        out.push({si:si,ai:'s',a:titleProps(sl,'s'),fixed:1});
      }
      (sl.annots||[]).map(function(a,ai){return {si:si,ai:ai,a:a};})
        .filter(function(p){return p.a&&p.a.k==='text'&&!p.a.hide;})
        /* the same reading-order sort matchSlide's bucket() uses, so
           "the first heading on the slide" means one thing in this file */
        .sort(function(p,q){
          var dy=(p.a.y||0)-(q.a.y||0);
          return Math.abs(dy)>4?dy:((p.a.x||0)-(q.a.x||0));})
        .forEach(function(p){out.push(p);});
    });
    return out;
  }
  /* the commonest value in a list. `n` against `of` is what decides
     whether there is a majority to fix TOWARDS or merely a disagreement
     to report. */
  function stdMode(list,key){
    var seen={},best=null;
    list.forEach(function(p){
      var v=String(key(p));
      if(!seen[v]) seen[v]={v:v,n:0};
      seen[v].n++;
      if(!best||seen[v].n>best.n) best=seen[v];
    });
    return best?{v:best.v,n:best.n,of:list.length}:null;
  }
  /* ---- bucketing the UNSTYLED half -------------------------------------
     RANKS, not absolute sizes. A poster's body is 2.6% of an A0 and a
     slide's body is 2.6% of a 16:9, but a deck built by hand may have
     settled on 4.0 for its body and 6.5 for its headings and be perfectly
     consistent. What matters is how many distinct sizes the deck uses and
     which of them is worn by the most boxes, so the bands are found first
     and named afterwards. */
  function stdBands(boxes){
    var sizes=[],bands=[],cur=null;
    boxes.forEach(function(p){sizes.push(stdSize(p.a));});
    sizes.sort(function(x,y){return x-y;});
    sizes.forEach(function(v){
      /* merge greedily against the band's SMALLEST member, so a long
         string of 3%-apart sizes cannot creep into one band that spans
         two real levels */
      if(cur&&v/cur.lo<=STD_BAND_TOL){cur.hi=v;return;}
      cur={lo:v,hi:v,boxes:[]};bands.push(cur);
    });
    boxes.forEach(function(p){
      var v=stdSize(p.a);
      for(var i=0;i<bands.length;i++)
        if(v>=bands[i].lo/1.0001&&v<=bands[i].hi*1.0001){
          bands[i].boxes.push(p);return;}
    });
    bands=bands.filter(function(b){return b.boxes.length;});
    /* the band's INTENDED size is the one worn by the most boxes, not the
       mean: drift is the minority, and averaging lets two stray large
       headings pull the whole band up */
    bands.forEach(function(b){
      var m=stdMode(b.boxes,function(p){return stdSize(p.a).toFixed(2);});
      b.size=parseFloat(m.v);b.agree=m.n;
    });
    bands.sort(function(x,y){return y.size-x.size;});
    return bands;
  }
  /* does this box sit directly beneath a placed figure? The cheapest
     reliable caption signal in the file, and the one thing size alone
     cannot find. */
  function stdUnderFigure(p){
    var sl=pres.slides[p.si]; if(!sl||p.fixed) return false;
    var y=p.a.y||0,x1=p.a.x||0,x2=x1+(p.a.w||0);
    return (sl.annots||[]).some(function(c){
      if(!c||c.k!=='cell'||c.hide) return false;
      var cb=(c.y||0)+(c.h||0),cx1=c.x||0,cx2=cx1+(c.w||0);
      return y>=cb-1&&y<=cb+6&&x2>cx1&&x1<cx2;
    });
  }
  /* Name a band: nearest style in LOG space, because the ladder is
     multiplicative (~1.3x a step) and a linear "closest" would drag every
     large band towards Title. Styles are consumed as they are used and
     the bands are walked biggest-first, which keeps the naming MONOTONE —
     a bigger band never gets a smaller style. That property is what makes
     the answer legible ("your three sizes are Heading 1, Body, Caption")
     and it matters more than the theoretically closest name for any one
     band. styleOrder(), so a type you invented can be suggested too. */
  function stdName(bands){
    var left=styleOrder();
    bands.forEach(function(b){
      var best=null,bestD=1e9;
      left.forEach(function(id){
        var d=Math.abs(Math.log(b.size/styleDef(id).size));
        if(d<bestD){bestD=d;best=id;}
      });
      b.suggest=best||'body';
      b.close=bestD<Math.log(1.35);
      left=left.filter(function(id){return id!==b.suggest;});
    });
    /* two cheap signals that beat size alone. A CAPTION is the one the
       user named and the one size cannot find. */
    bands.forEach(function(b){
      var capt=0,bold=0;
      b.boxes.forEach(function(p){
        if(p.a.b) bold++;
        if(stdUnderFigure(p)) capt++;
      });
      if(capt*2>b.boxes.length&&b===bands[bands.length-1]
        &&STYLE_DEFAULTS.caption) b.suggest='caption';
      /* the biggest band, mostly bold, is a heading however near Body its
         size happens to land */
      if(b===bands[0]&&bold*2>b.boxes.length&&b.suggest==='body')
        b.suggest='h1';
    });
    return bands;
  }
  var STD_PROPS=[
    {k:'size', label:'size',
     get:function(a){return stdSize(a).toFixed(2);},
     same:function(x,y){var l=Math.min(+x,+y),h=Math.max(+x,+y);
       return h/l<=STD_SIZE_TOL;}},
    {k:'b',      label:'weight',           get:function(a){return a.b?1:0;}},
    {k:'i',      label:'italics',          get:function(a){return a.i?1:0;}},
    {k:'u',      label:'underlining',      get:function(a){return a.u?1:0;}},
    {k:'strike', label:'strike-through',   get:function(a){return a.strike?1:0;}},
    {k:'font',   label:'typeface',         get:function(a){return a.font||'';}},
    {k:'align',  label:'alignment',        get:function(a){return a.align||'';}},
    {k:'color',  label:'colour', get:stdCol,
     same:function(x,y){return colDrift(x,y)===0;}},
    {k:'lh',     label:'line spacing',     get:function(a){return a.lh||0;},
     same:function(x,y){return Math.abs(x-y)<=0.02;}},
    {k:'pspace', label:'paragraph spacing',get:function(a){return a.pspace||0;},
     same:function(x,y){return Math.abs(x-y)<=0.02;}}
  ];
  /* boxes that disagree with the commonest value. A finding needs a
     MAJORITY to fix towards — two boxes disagreeing one-all is a choice,
     not a drift — so anything under two thirds is reported without an
     automatic answer. */
  function stdDrift(list,pr){
    var m=stdMode(list,function(p){return pr.get(p.a);});
    if(!m) return null;
    var same=pr.same||function(x,y){return String(x)===String(y);};
    var odd=list.filter(function(p){return !same(pr.get(p.a),m.v);});
    if(!odd.length) return null;
    return {prop:pr,mode:m.v,odd:odd,
      sev:(m.n*3>=list.length*2)?'warn':'info'};
  }
  /* GEOMETRY is compared ACROSS slides only, one box per slide. Two
     captions side by side on one slide legitimately sit at different x;
     the same heading landing somewhere else on slide 4 does not. Fewer
     than three slides is a layout, not a pattern — say nothing. */
  function stdGeom(list,k,tol){
    var perSlide=[],seenSlide={};
    list.forEach(function(p){
      if(p.fixed||seenSlide[p.si]) return;
      seenSlide[p.si]=1;perSlide.push(p);
    });
    if(perSlide.length<3) return null;
    var m=stdMode(perSlide,function(p){return (p.a[k]||0).toFixed(1);});
    var odd=perSlide.filter(function(p){
      return Math.abs((p.a[k]||0)-parseFloat(m.v))>tol;});
    if(!odd.length||m.n*3<perSlide.length*2) return null;
    return {geom:k,mode:parseFloat(m.v),odd:odd,sev:'warn',all:perSlide};
  }
  /* every property applyStyleTo would have written, still as written.
     Derived from ONE list shared with applyStyleTo rather than repeated,
     or a ninth style property would silently stop being noticed. */
  var STYLE_FIELDS=['size','b','i','font','color','align','lh','pspace'];
  function stdMatchesStyle(a,d){
    if(Math.max(stdSize(a),d.size)/Math.min(stdSize(a),d.size)
      >STD_SIZE_TOL) return false;
    if(!!a.b!==!!d.b||!!a.i!==!!d.i) return false;
    if((a.font||'')!==(d.font||'')) return false;
    if(colDrift(stdCol(a),d.color||stdInk())) return false;
    if((a.align||'')!==(d.align||'')) return false;
    if(Math.abs((a.lh||0)-(d.lh||0))>0.02) return false;
    if(Math.abs((a.pspace||0)-(d.pspace||0))>0.02) return false;
    return true;
  }
  function stdBandWhy(b,d,inner){
    if(inner.length)
      return inner.length===1
        ?('Their '+inner[0].prop.label+' does not agree: '
          +inner[0].odd.length+' of '+b.boxes.length+' differ.')
        :('Their '+inner[0].prop.label+' and '+(inner.length-1)+' other '
          +'thing'+(inner.length===2?'':'s')+' do not agree.');
    return 'They already match each other. Calling them '+d.label
      +' means changing them all later is one edit instead of '
      +b.boxes.length+'.';
  }
  function standardise(){
    var boxes=stdBoxes(),out=[],named={},loose=[];
    boxes.forEach(function(p){
      if(p.a.style&&STYLE_DEFAULTS[p.a.style])
        (named[p.a.style]=named[p.a.style]||[]).push(p);
      else loose.push(p);
    });
    /* PASS ONE — boxes measured against the style they claim to wear.
       This one is easy and is not the point; it is here because a deck
       that HAS been styled and then hand-edited is the other half of the
       same question. */
    styleOrder().forEach(function(id){
      var list=named[id]; if(!list||list.length<2) return;
      var d=styleDef(id),odd=list.filter(function(p){
        return !stdMatchesStyle(p.a,d);});
      if(!odd.length) return;
      out.push({kind:'named',style:id,list:list,odd:odd,sev:'warn',
        head:odd.length+' of '+list.length+' '+d.label+' boxes have '
          +'drifted',
        why:'They wear the '+d.label+' style but have been changed by '
          +'hand since. Re-applying the style puts them back.'});
    });
    /* PASS TWO — the boxes wearing nothing, which on most decks is all of
       them. Bands first, names second, drift within a band third. */
    var bands=stdName(stdBands(loose));
    bands.forEach(function(b){
      if(b.boxes.length<2) return;
      var d=styleDef(b.suggest),inner=[];
      STD_PROPS.forEach(function(pr){
        var r=stdDrift(b.boxes,pr); if(r) inner.push(r);
      });
      out.push({kind:'band',band:b,list:b.boxes,inner:inner,
        sev:inner.length?'warn':'info',
        head:b.boxes.length+' boxes at about '+Math.round(b.size*5.4)
          +' pt'+(inner.length?(' — '+inner[0].odd.length
            +' do not match'):' wear no style'),
        why:stdBandWhy(b,d,inner)});
      ['x','w'].forEach(function(k){
        var g=stdGeom(b.boxes,k,k==='x'?STD_POS_TOL:STD_W_TOL);
        if(g) out.push({kind:'geom',band:b,g:g,sev:'warn',
          head:(k==='x'?'These move sideways between slides'
                       :'These are different widths between slides'),
          why:g.odd.length+' of '+g.all.length+' sit at a different '
            +(k==='x'?'left edge':'width')+' from the other '
            +(g.all.length-g.odd.length)+'. Paging through, they jump.'});
      });
    });
    return {findings:out,boxes:boxes.length,bands:bands,
      styled:Object.keys(named).length};
  }
  /* ---- THE FIX ---------------------------------------------------------
     ONE undo entry, always. Every writer mutates the model directly and
     hands the sweep to stdFix, which calls markDirty exactly once — the
     same contract restyleAll has kept since it was written. Going through
     fmtApply instead would push one entry per box AND touch only the
     current slide, which is both halves of wrong. */
  function stdFix(list,fn,note){
    list.forEach(function(p){fn(p.a,p);});
    markDirty();      /* the single histPush for the whole sweep */
    refresh();        /* markDirty repaints ONE thumbnail; this does the rest */
    renderStdPane();  /* the finding disappears: that is the feedback */
    toast(note+' — Ctrl+Z puts them back');
  }
  /* adopting a band does NOT stamp STYLE_DEFAULTS' values onto it. That
     would resize and recolour the MAJORITY of the band to punish the user
     for tidying up — the opposite of standardising. The definition is
     built from the band's own commonest values first, so the majority
     does not move a pixel, only the strays snap into line, and the deck
     ends up with a style whose numbers are what the deck already looked
     like (2026-08-22). */
  function stdAdopt(band){
    var id=band.suggest,d=styleDef(id),o={label:d.label,size:band.size};
    if(isHeadingStyle(id)&&BUILTIN_STYLE_IDS.indexOf(id)<0) o.head=1;
    [['b',1],['i',1],['font',''],['color',''],['align',''],
     ['lh',0],['pspace',0]].forEach(function(pr){
      var m=stdMode(band.boxes,function(p){
        return pr[0]==='color'?stdCol(p.a):(p.a[pr[0]]||pr[1]&&0||'');});
      if(!m) return;
      var v=m.v;
      if(pr[0]==='b'||pr[0]==='i'){if(v==='1') o[pr[0]]=1;}
      else if(pr[0]==='lh'||pr[0]==='pspace'){
        if(parseFloat(v)>0) o[pr[0]]=parseFloat(v);}
      else if(v&&v!=='0'&&!(pr[0]==='color'&&v===stdInk())) o[pr[0]]=v;
    });
    deckStyles()[id]=o;
    /* EVERY box in the band, not only the odd ones: naming the band is
       the point, and half a band wearing a name is not a group */
    stdFix(band.boxes,function(a){applyStyleTo(a,id);},
      band.boxes.length+' box'+(band.boxes.length===1?'':'es')
        +' are now '+o.label);
  }
  /* the quieter half, for someone who does not want the style system:
     make them agree with each other and set no a.style at all */
  function stdFlatten(inner){
    stdFix(inner.odd,function(a){
      var pr=inner.prop;
      if(pr.k==='size') a.size=parseFloat(inner.mode);
      else if(pr.k==='color') a.color=inner.mode;
      else if(inner.mode==='0'||inner.mode===''||inner.mode==='NaN')
        delete a[pr.k];
      else a[pr.k]=(pr.k==='lh'||pr.k==='pspace')
        ?parseFloat(inner.mode):inner.mode;
    },'Their '+inner.prop.label+' now matches');
  }
  /* a style has no opinion about WHERE a box sits, so this is the one fix
     applyStyleTo cannot do */
  function stdAlign(g){
    stdFix(g.odd,function(a){a[g.geom]=g.mode;},
      g.odd.length+' box'+(g.odd.length===1?'':'es')+' lined up');
  }
  function stdRow(f){
    var box=document.createElement('div');
    box.className='std-find std-'+f.sev;
    var h=document.createElement('div');
    h.className='std-h';h.textContent=f.head;box.appendChild(h);
    var w=document.createElement('div');
    w.className='std-why';w.textContent=f.why;box.appendChild(w);
    var who=document.createElement('div');who.className='std-who';
    (f.g?f.g.odd:(f.odd||f.list)).slice(0,12).forEach(function(p){
      var c=document.createElement('button');
      c.className='std-chip';
      c.textContent=(p.si+1)+' · '
        +(p.fixed?(p.ai==='t'?'title':'subtitle'):annotLabel(p.a));
      c.title='Go to it';
      c.addEventListener('click',function(){
        /* go() clears the selection and re-renders, so the layer this box
           lives on does not exist until after it returns */
        go(p.si);
        if(typeof p.ai==='number'){
          var l=stage.querySelector('.annot-layer');
          if(l) selectAnnot(l,p.ai);
        }
      });
      who.appendChild(c);
    });
    box.appendChild(who);
    var act=document.createElement('button');
    act.className='dbtn std-do';
    if(f.kind==='geom'){
      act.textContent='Line all '+f.g.all.length+' up';
      act.addEventListener('click',function(){stdAlign(f.g);});
    } else if(f.kind==='named'){
      act.textContent='Put these '+f.odd.length+' back to '
        +styleDef(f.style).label;
      act.addEventListener('click',function(){
        stdFix(f.odd,function(a){applyStyleTo(a,f.style);},
          f.odd.length+' box'+(f.odd.length===1?'':'es')+' put back');
      });
    } else {
      act.textContent='Make all '+f.band.boxes.length+' '
        +styleDef(f.band.suggest).label;
      act.title='Names this size, and pulls the odd ones into line with '
        +'the rest. The majority do not move.';
      act.addEventListener('click',function(){stdAdopt(f.band);});
    }
    box.appendChild(act);
    if(f.kind==='band'&&f.inner&&f.inner.length){
      var alt=document.createElement('button');
      alt.className='dbtn std-do std-do2';
      alt.textContent='Just make them match each other';
      alt.title='Fix the '+f.inner[0].prop.label+' without giving them a '
        +'named style';
      alt.addEventListener('click',function(){stdFlatten(f.inner[0]);});
      box.appendChild(alt);
    }
    return box;
  }
  function renderStdPane(){
    var list=$('#stdpane-list'),head=$('#stdpane-count');
    if(!list) return;
    var r=standardise();
    if(head) head.textContent=r.findings.length
      ?(r.findings.length+' to look at · '+r.boxes+' text boxes')
      :('nothing drifting · '+r.boxes+' text boxes');
    list.innerHTML='';
    if(!r.findings.length){
      /* TWO empty states. Saying "all fine" to a deck that has never used
         a style would be true about drift and false about the question
         that was asked, so the unstyled case says what is actually so and
         offers the names, phrased as an offer rather than a fault. And no
         'err' severity anywhere: nothing this finds is broken, and a
         consistency check that shouts is one people stop opening. */
      var msg=document.createElement('div');
      msg.className='pf-ok';
      msg.textContent=r.styled
        ?('Your type is consistent. Every heading, paragraph and caption '
          +'across these '+(pres.slides||[]).length+' slides matches the '
          +'style it wears.')
        :('Nothing is drifting — but nothing here wears a named style '
          +'either. Your text falls into '+r.bands.length+' size'
          +(r.bands.length===1?'':'s')+'; naming them means changing '
          +'every heading later is one edit instead of '+r.boxes+'.');
      list.appendChild(msg);
      if(!r.styled) r.bands.forEach(function(b){
        if(b.boxes.length<2) return;
        list.appendChild(stdRow({kind:'band',band:b,list:b.boxes,
          inner:[],sev:'info',
          head:b.boxes.length+' boxes at '+Math.round(b.size*5.4)+' pt',
          why:'These look like your '+styleDef(b.suggest).label+'.'}));
      });
      return;
    }
    r.findings.forEach(function(f){list.appendChild(stdRow(f));});
  }
  (function(){
    var btn=$('#dsg-std'),pane=$('#stdpane');
    if(!btn||!pane) return;
    function set(open){
      if(open){
        /* the panes share one corner — the rule showVerpane has kept
           since they were first docked */
        ['#selpane','#animpane','#preflight','#notespane','#flippane']
          .forEach(function(sel){var o=$(sel); if(o) o.hidden=true;});
        var ob=$('#objects-btn');
        if(ob) ob.setAttribute('aria-pressed','false');
        var nb=$('#notes-btn');
        if(nb) nb.setAttribute('aria-pressed','false');
        if(typeof showVerpane==='function') showVerpane(false);
      }
      pane.hidden=!open;
      btn.setAttribute('aria-pressed',open.toString());
      /* rendered on open, on ↻ and after a fix — never from markDirty or
         refresh, or every keystroke would re-survey the whole deck */
      if(open) renderStdPane();
    }
    btn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    var cl=$('#stdpane-close');
    if(cl) cl.addEventListener('click',function(){set(false);});
    var rr=$('#stdpane-rerun');
    if(rr) rr.addEventListener('click',renderStdPane);
  })();
  window.SemDeckPreflight=preflight;                 /* test hook */
  window.SemDeckStandardise=standardise;             /* test hook */
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
  /* ---- A RIBBON OF YOUR OWN --------------------------------------------
     Reorder and hide ribbon buttons, remembered per user (TASKS T11).
     The design note, and the three answers it had to give:

     WHAT IS CUSTOMISABLE: individual controls, within the group they
     already live in. Not whole groups, and NOT moving a control to
     another tab — a tab is a promise about where things are ("the tools
     for the thing you just clicked are in ONE named place you can go
     back to", showFmt), and letting a layout break that promise would
     make every other piece of guidance in this app wrong.

     WHERE IT IS REMEMBERED: an UNSCOPED localStorage key. Every other
     preference here is `+SCOPE` — per project, per notebook bundle — but
     a ribbon layout is a fact about the person, not about the deck, and
     it would be absurd for one deck to know where you keep Bold. That is
     the same argument matchPick makes for being session-local and
     arrangements make for being localStorage rather than deck data, so
     the departure is deliberate and consistent rather than an exception.

     HOW HIDING IS EXPRESSED: a class, never `hidden`. `hidden` is owned
     by showFmt and FMT_KINDS, which turn controls on and off by KIND —
     a customiser writing the same attribute would fight it on every
     click, and whoever wrote last would win. `.rbn-hid` is
     display:none, so the two compose: a control appears when its kind
     allows it AND you have not put it away. It also costs the fit
     ladder nothing, because display:none takes no width — hiding
     genuinely buys room rather than only looking like it.

     THE INVARIANTS HOLD BY CONSTRUCTION. Nothing here changes a label,
     so buttons stay words plus icons. Nothing here bypasses
     fitEditRibbon: the row is re-fitted after every change, so a custom
     layout compacts down the same ladder and still never wraps. */
  var RIBBON_KEY='jv-ribbon';        /* NOT +SCOPE — see above */
  function ribbonPrefs(){
    try{
      var o=JSON.parse(localStorage.getItem(RIBBON_KEY)||'{}');
      return (o&&typeof o==='object')?o:{};
    }catch(e){return {};}
  }
  function ribbonSave(o){
    try{
      if(!o||!Object.keys(o).length) localStorage.removeItem(RIBBON_KEY);
      else localStorage.setItem(RIBBON_KEY,JSON.stringify(o));
    }catch(e){}
  }
  /* a control is addressed by its id. Anything without one cannot be
     customised and is left exactly where it is — which is the right
     answer for the separators and the wrappers, and means the picker
     never offers you a row you cannot act on. */
  /* the GENERIC classes every group wears. Matching the first `rbn-*`
     token found `rbn-grp` on all of them, so every group answered to the
     same id and one group's saved order was applied to all of them
     (2026-08-25, caught by reading the stored key in a browser). The
     groups with no distinguishing class of their own fall back to their
     visible label, which is stable and unique across the row. */
  var RBN_GENERIC={'rbn-grp':1,'rbn-fixed':1,'rbn-row':1,'rbn-lab':1};
  function ribbonGroupId(g){
    var hit='';
    String(g.className||'').split(/\s+/).forEach(function(c){
      if(!hit&&c.indexOf('rbn-')===0&&!RBN_GENERIC[c]) hit=c;});
    if(hit) return hit;
    var lab=g.querySelector('.rbn-lab');
    return 'grp-'+((((lab&&lab.textContent)||'').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g,'-'))||'x');
  }
  function ribbonControls(g){
    var row=g.querySelector('.rbn-row')||g;
    return [].slice.call(row.children).filter(function(el){
      return el.id&&!el.classList.contains('rbn-lab');
    });
  }
  function ribbonGroups(){
    return $$('#edit-tools .rbn-grp').filter(function(g){
      return ribbonControls(g).length>1;});
  }
  /* the picker shows the TAB YOU ARE LOOKING AT. All three tabs together
     is 87 controls in a floating menu, which is a wall rather than a
     list — and you customise a ribbon while looking at the thing you
     want moved, not by scrolling for it. applyRibbonPrefs still walks
     every group, so what you set on one tab keeps working while you are
     on another (2026-08-25, found by counting the rows in a browser). */
  function ribbonGroupsHere(){
    return ribbonGroups().filter(function(g){
      return g.offsetParent!==null;});
  }
  /* apply what is remembered: order first, then hiding. Order is written
     by re-appending, which is stable for anything the list does not
     name — a control added by a later version of the app keeps its place
     at the end rather than disappearing because an old saved list has
     never heard of it. */
  function applyRibbonPrefs(){
    var p=ribbonPrefs();
    ribbonGroups().forEach(function(g){
      var gid=ribbonGroupId(g),pref=p[gid];
      var row=g.querySelector('.rbn-row')||g;
      var ctl=ribbonControls(g);
      var byId={};ctl.forEach(function(el){byId[el.id]=el;});
      if(pref&&pref.order) pref.order.forEach(function(id){
        if(byId[id]) row.appendChild(byId[id]);});
      var hid=(pref&&pref.hide)||[];
      ctl.forEach(function(el){
        el.classList.toggle('rbn-hid',hid.indexOf(el.id)>=0);});
    });
    if(typeof fitEditRibbon==='function') fitEditRibbon();
  }
  /* the words a row goes by. A control's own label is the honest name —
     it is what you are looking for when you go hunting for it — and the
     tooltip is the fallback for the handful that are a caret or a
     glyph. */
  function ribbonCtlLabel(el){
    var t=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(t&&t.length<=28) return t;
    if(t) return t.slice(0,26)+'\u2026';
    return (el.getAttribute('aria-label')||el.title||el.id)
      .split('\n')[0].slice(0,28);
  }
  function openRibbonCustomise(){
    var old=$('#rbn-cust'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu rbn-cust';m.id='rbn-cust';
    var head=document.createElement('div');
    head.className='hd-lab';
    head.textContent='your ribbon';
    m.appendChild(head);
    var note=document.createElement('div');
    note.className='ff-none';
    note.textContent='The '+activeTab()+' tab. Untick to put a button '
      +'away; the arrows move it within its group. Buttons never move '
      +'between tabs, and the row still never wraps.';
    m.appendChild(note);
    ribbonGroupsHere().forEach(function(g){
      var gid=ribbonGroupId(g);
      var lab=g.querySelector('.rbn-lab');
      menuHead(m,((lab&&lab.textContent)||gid).trim().toLowerCase());
      ribbonControls(g).forEach(function(el){
        var row=document.createElement('div');
        row.className='ff-row rbn-crow';
        var l=document.createElement('label');
        l.className='find-ck';
        var b=document.createElement('input');
        b.type='checkbox';
        b.checked=!el.classList.contains('rbn-hid');
        l.appendChild(b);
        l.appendChild(document.createTextNode(' '+ribbonCtlLabel(el)));
        row.appendChild(l);
        b.addEventListener('change',function(){
          var pr=ribbonPrefs();
          pr[gid]=pr[gid]||{};
          var h=(pr[gid].hide||[]).filter(function(x){return x!==el.id;});
          if(!b.checked) h.push(el.id);
          if(h.length) pr[gid].hide=h; else delete pr[gid].hide;
          if(!pr[gid].hide&&!pr[gid].order) delete pr[gid];
          ribbonSave(pr);applyRibbonPrefs();
        });
        [['\u2191',-1],['\u2193',1]].forEach(function(dir){
          var mb=document.createElement('button');
          mb.className='dbtn rbn-move';mb.textContent=dir[0];
          mb.title=(dir[1]<0?'Move it earlier':'Move it later')
            +' in this group';
          mb.setAttribute('aria-label',
            (dir[1]<0?'Move earlier':'Move later')+': '
            +ribbonCtlLabel(el));
          mb.addEventListener('click',function(e){
            e.stopPropagation();
            var ids=ribbonControls(g).map(function(x){return x.id;});
            var at=ids.indexOf(el.id),to=at+dir[1];
            if(at<0||to<0||to>=ids.length) return;
            ids.splice(to,0,ids.splice(at,1)[0]);
            var pr=ribbonPrefs();
            pr[gid]=pr[gid]||{};pr[gid].order=ids;
            ribbonSave(pr);applyRibbonPrefs();
            openRibbonCustomise();
          });
          row.appendChild(mb);
        });
        m.appendChild(row);
      });
    });
    menuHead(m,'all of it');
    var rb=document.createElement('button');
    rb.className='dbtn vw-opt';
    rb.textContent='Put the ribbon back to normal';
    rb.addEventListener('click',function(e){
      e.stopPropagation();
      ribbonSave(null);
      $$('#edit-tools .rbn-hid').forEach(function(el){
        el.classList.remove('rbn-hid');});
      m.remove();
      /* order cannot be un-appended, so the honest thing is to say a
         reload restores it rather than to pretend otherwise */
      toast('Buttons are all back. The original ORDER returns when the '
        +'page is reloaded.');
      applyRibbonPrefs();
    });
    m.appendChild(rb);
    var bar=$('#edit-tools');
    document.body.appendChild(m);
    floatMenu(bar,m);
    setTimeout(function(){
      document.addEventListener('click',function off(e){
        if(m.contains(e.target)) return;
        m.remove();document.removeEventListener('click',off);
      });
    },0);
  }
  (function(){
    var bar=$('#edit-tools');
    if(!bar) return;
    /* RIGHT-CLICK THE RIBBON. Where every other application of this
       shape puts it, and it costs the row no width at all — which
       matters more here than anywhere, the width being the thing the
       whole fit ladder exists to fight over. */
    bar.addEventListener('contextmenu',function(e){
      if(mode!=='edit') return;
      e.preventDefault();
      openRibbonCustomise();
    });
  })();
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
  var TABS=['home','insert','design'];
  /* SCOPE is declared further down the file, so the remembered tab is read
     on first use rather than here — `var` hoisting would otherwise key it
     under the string "undefined" */
  var curTab=null;
  function tabKey(){return 'jv-deck-tab:'+SCOPE;}
  function activeTab(){
    if(curTab===null){
      var t=lsGet(tabKey());
      /* Animate and View were folded into Insert and Home on 2026-08-20;
         a browser that remembers one of them lands on its new host rather
         than on a tab that no longer exists */
      if(t==='animate') t='insert';
      else if(t==='view') t='home';
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
    $$('.rbn-tab',strip).forEach(function(b){
      b.setAttribute('aria-selected',
        (b.dataset.tab===activeTab()).toString());
    });
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
  /* ---- FOLDING THE TOOLS AWAY ------------------------------------------
     The ribbon is about 100px of a 700px laptop window, and there are long
     stretches - reading it back, rehearsing, nudging one thing into place
     - where the page matters and the tools do not (2026-08-20, user:
     "would be good if the editing tools can be made to pop up and down").
     The TAB STRIP always stays: it is one button high, it is how you get
     the tools back, and a bar that vanishes completely leaves you with no
     way to say "I want them again". */
  var FOLDKEY2='jv-deck-fold:';
  /* how the slide column lists its slides, and how wide it is. Both are
     preferences about the TOOL, not properties of the deck — sending
     someone a presentation must not send them your column width — so
     they live in localStorage beside the ribbon fold rather than on
     `pres` (2026-08-22). Keyed on SCOPE, which is declared further down
     this file: read it at var-declaration time and every preference in
     the app files itself under the literal string "undefined". */
  var FILMKEY='jv-deck-film:',FILMWKEY='jv-deck-filmw:';
  var FILM_VIEWS=[['thumb','Thumbnails','Pictures'],
    ['head','Headings','Names'],
    ['both','Thumbnails and headings','Both']];
  var filmView=null;
  function filmMode(){
    if(filmView===null){
      var v=lsGet(FILMKEY+SCOPE);
      filmView=(v==='head'||v==='both')?v:'thumb';
    }
    return filmView;
  }
  function ribbonFolded(){
    return deckEl.classList.contains('rbn-fold');
  }
  function setRibbonFold(on){
    deckEl.classList.toggle('rbn-fold',!!on);
    var b=$('#rbn-fold');
    if(b){
      b.setAttribute('aria-pressed',on?'true':'false');
      b.innerHTML=on?'&#9662;':'&#9652;';
      b.title=on
        ?'Show the tools again (Ctrl+F1)'
        :'Hide the tools and give the page the room (Ctrl+F1). Click a '
          +'tab, or this, to bring them back';
    }
    lsSet(FOLDKEY2+SCOPE,on?'1':'0');
    /* the stage just changed height, so the page has to be re-fitted */
    applyZoom();
    if(!on) fitEditRibbon();
  }
  $$('#rbn-tabs .rbn-tab').forEach(function(b){
    b.addEventListener('click',function(){
      /* a click on the tab you are already on, while folded, is a request
         for the tools back - not a no-op */
      if(ribbonFolded()){setRibbonFold(false);setTab(b.dataset.tab);return;}
      setTab(b.dataset.tab);
    });
    /* double-click toggles, the way PowerPoint has trained everyone */
    b.addEventListener('dblclick',function(e){
      e.preventDefault();setRibbonFold(!ribbonFolded());
    });
  });
  (function(){
    var f=$('#rbn-fold');
    if(f) f.addEventListener('click',function(){
      setRibbonFold(!ribbonFolded());});
  })();
  function fitEditRibbon(){
    var bar=$('#edit-tools');
    if(!bar||bar.hidden||mode!=='edit') return;
    /* a folded bar has no width to measure: scrollWidth would read 0 and
       the ladder would climb every rung for nothing */
    if(deckEl.classList.contains('rbn-fold')) return;
    /* BEFORE anything is measured: a stale column count is a wrong width,
       so re-counting here is both the fix for a group that grew a control
       since the last count and the only way the density rungs below are
       judged against the row that is actually on screen.
       Unfolding View first is part of that — every rung has to be judged
       against the full row, or a bar that folded once at 1280px would
       stay folded after you maximised the window. */
    foldViewGroup(false);
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
    /* still over after every rung: fold the one group that is not about
       the selection, rather than let the row clip. sizeRibbonGroups has
       to run again — it counts the controls that are showing, and seven
       of them just stopped */
    if(bar.scrollWidth>bar.clientWidth+1){
      cl.add('erc-tight');
      foldViewGroup(true);
      sizeRibbonGroups();
    }
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
  /* ---- the thin top bar must never clip --------------------------------
     #deck-qat is ~14 fixed-width controls on flex-wrap:nowrap, and no
     fitter covered it: below ~750-800px the RIGHT end — Present, the
     primary action, and Help — clipped away unreachable, which the
     ladder forbids ("clip, scroll, wrap — all forbidden", fitEditRibbon).
     Same shape as fitRibbon / fitEditRibbon: reset, measure, escalate.
       rung 1 (.qat-c1)     the save readout gives up its text — its
                            words also live in the Save button's tooltip
       rung 2 (.qat-c2)     spacing tightens and the long label shortens
                            ("Autosave" → "Auto"); words are shortened,
                            NEVER hidden (the twice-rejected icon-only)
       floor  (.qat-scroll) the bar scrolls sideways (overflow-x:auto,
                            thin scrollbar) so nothing is ever
                            unreachable. Safe for the bar's own menus:
                            File / Saved-to / Present all float
                            (floatMenu, position:fixed), so the scroll
                            box cannot cut them off. */
  function fitQat(){
    var bar=$('#deck-qat');
    if(!bar||bar.hidden) return;
    var cl=bar.classList;
    cl.remove('qat-c1');cl.remove('qat-c2');cl.remove('qat-scroll');
    /* a hidden or zero-width bar is not a real fit — leave it relaxed */
    if(!bar.clientWidth) return;
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('qat-c1');
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('qat-c2');
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('qat-scroll');
  }
  function syncViewBtns(){
    var r=$('#vw-rulers'),g=$('#vw-grid'),f=$('#vw-full'),sd=$('#vw-side');
    if(r) r.setAttribute('aria-pressed',guides.rulers?'true':'false');
    if(g) g.setAttribute('aria-pressed',guides.grid?'true':'false');
    if(f) f.setAttribute('aria-pressed',editFull?'true':'false');
    /* out of the menu and into the row, so it shows its state too */
    if(sd) sd.setAttribute('aria-pressed',
      deckEl.classList.contains('rbn-side')?'true':'false');
  }
  /* ---- the View group folds when the row runs out of width ------------
     The density ladder's last rung says it drops "the one group that is
     not about the selection rather than let the row clip". It never did:
     erc-tight only tightened padding, so a 1366px window with a text box
     selected clipped Bold, Italic, Underline and Layout off the right-hand
     edge — unreachable, because the bar is overflow-x:clip and cannot be
     scrolled (and must stay that way, or every downward dropdown gets cut
     off at the ribbon's edge again; see the comment on .edit-tools).
     So the group folds instead of vanishing: seven buttons become one that
     opens them as a menu, which is ~300px back — far more than the 66px
     the row was over (2026-08-22). */
  var VIEW_FOLD=[['vw-rulers','Rulers'],['vw-grid','Grid'],
    ['vw-full','Full screen'],['vw-side','Side toolbar'],
    ['vw-check','Check'],['objects-btn','Layers'],['notes-btn','Notes']];
  var viewFolded=false,viewWasHidden=null;
  function foldViewGroup(on){
    on=!!on;
    if(on===viewFolded) return;
    var w=$('#vw-morewrap');
    if(on){
      /* remember what was ALREADY hidden for its own reasons, so
         unfolding does not reveal a control this page never had */
      viewWasHidden={};
      VIEW_FOLD.forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        viewWasHidden[p[0]]=b.hidden;b.hidden=true;});
      if(w) w.hidden=false;
    } else {
      VIEW_FOLD.forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        b.hidden=viewWasHidden?!!viewWasHidden[p[0]]:false;});
      if(w) w.hidden=true;
      closeViewMenu();
      viewWasHidden=null;
    }
    viewFolded=on;
  }
  function closeViewMenu(){
    var m=$('#vw-more-menu'),b=$('#vw-more');
    if(m&&!m.hidden){m.hidden=true;
      if(b) b.setAttribute('aria-expanded','false');}
  }
  /* the rows DRIVE the real buttons, so each control keeps its one
     implementation and its own state — the same trick the Arrange menu
     uses for front/back/rotate */
  function openViewMenu(){
    var m=$('#vw-more-menu'),btn=$('#vw-more');
    if(!m||!btn) return;
    if(!m.hidden){closeViewMenu();return;}
    m.innerHTML='';
    menuHead(m,'view');
    VIEW_FOLD.forEach(function(p){
      var real=$('#'+p[0]);
      if(!real||(viewWasHidden&&viewWasHidden[p[0]])) return;
      var o=document.createElement('button');
      o.className='dbtn vw-opt';o.type='button';
      o.textContent=p[1];
      if(real.getAttribute('aria-pressed')==='true'){
        o.setAttribute('aria-pressed','true');
        o.classList.add('on');
      }
      if(real.disabled) o.disabled=true;
      o.title=real.title||'';
      o.addEventListener('click',function(e){
        e.stopPropagation();closeViewMenu();real.click();});
      m.appendChild(o);
    });
    m.hidden=false;
    btn.setAttribute('aria-expanded','true');
    floatMenu(btn,m);
  }
  (function(){
    var b=$('#vw-more');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();openViewMenu();});
    document.addEventListener('click',function(e){
      var w=$('#vw-morewrap');
      if(w&&!w.contains(e.target)) closeViewMenu();
    });
  })();
  /* THE ROOT ELEMENT, not the deck. A fullscreen element paints its own
     subtree and nothing else, and half this app's overlays are siblings of
     .deck rather than children of it — the theme picker, the colour
     picker, find & replace, tooltips, the playback spotlight. Fullscreening
     .deck made every one of them invisible while it was on, which is why
     the theme could not be changed while editing full screen (2026-08-20,
     user). .deck is position:fixed;inset:0 either way, so this looks
     identical and simply stops swallowing the overlays. */
  function fullTarget(){
    return document.documentElement;
  }
  function toggleEditFull(){
    try{
      if(!document.fullscreenElement&&fullTarget().requestFullscreen){
        editFull=true;
        deckEl.classList.add('editfull');
        fullTarget().requestFullscreen().catch(function(){
          editFull=false;deckEl.classList.remove('editfull');syncViewBtns();});
      } else if(document.fullscreenElement){
        document.exitFullscreen().catch(function(){});
      }
    }catch(err){}
    syncViewBtns();
  }
  (function(){
    /* No View menu. Rulers, Grid, Full screen and Side toolbar are four
       buttons in the row now: each is a stateful TOGGLE, and a toggle you
       have to open a menu to read the state of is a toggle nobody trusts.
       Two of them were never guides in the first place (2026-08-20). */
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
      /* WHERE THE POINTER IS, which is the whole question "Paste here"
         asks. CLIENT coordinates only: turning them into slide
         percentages needs a rect, and a getBoundingClientRect on every
         mousemove is exactly the cost the 2026-08-23 pass took out of
         this handler. The conversion happens once, at the paste. */
      lastCanvasXY={x:e.clientX,y:e.clientY};
      if(!guides.rulers||mode!=='edit') return;
      var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
      var sr=slideEl.getBoundingClientRect();
      if(!sr.width||!sr.height) return;
      rulerCursor.x=(e.clientX-sr.left)/sr.width;
      rulerCursor.y=(e.clientY-sr.top)/sr.height;
      if(rulerCursor.x<0||rulerCursor.x>1) rulerCursor.x=null;
      if(rulerCursor.y<0||rulerCursor.y>1) rulerCursor.y=null;
      /* the LIGHT path: shade the selection's extent (it follows a drag
         live) and move the 1px cursor — never rebuild the ticks, the
         grid or the custom guides from a mousemove (2026-08-23 perf:
         syncGuides() regenerated every tick node per event) */
      rulerPx.w=sr.width;rulerPx.h=sr.height;
      drawRulerSel();
      drawRulerCursor();
    });
    if(stage) stage.addEventListener('mouseleave',function(){
      lastCanvasXY=null;
      rulerCursor.x=rulerCursor.y=null;
      if(guides.rulers&&mode==='edit') drawRulerCursor();
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
      if(!deckEl.hidden){fitEditRibbon();fitQat();applyZoom();}});
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
      /* the thin top bar gets the same treatment for the same reason:
         its box changing (window resize, first real layout on open) is
         the one signal that catches every way it can get narrower */
      var qb=$('#deck-qat');
      if(qb) new ResizeObserver(function(){
        if(deckEl.hidden) return;
        requestAnimationFrame(function(){
          if(!deckEl.hidden) fitQat();
        });
      }).observe(qb);
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
          if(!deckEl.hidden){fitEditRibbon();fitQat();}});
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
    /* a name you gave it wins over the kind we guessed. Twelve rows
       saying "Shape - box" is a list you cannot navigate (2026-08-20,
       user: "also be able to rename layers") */
    if(a.name) return a.name;
    if(a.k==='image') return 'Image';
    if(a.k==='flip'){
      var nf=flipFrames(a).length;
      return 'Flip book \u2014 '+(nf?(nf+' figure'+(nf===1?'':'s')):'empty');
    }
    if(a.k==='table')
      return 'Table '+((a.rows||[]).length)+'\u00d7'
        +(((a.rows||[])[0]||[]).length);
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
    var docked=null;
    $$('.selpane',deckEl).forEach(function(p){
      if(!p.hidden&&p.style.right!=='auto') docked=p;});
    /* reserve the width the pane ACTUALLY has: it is resizable, and a
       strip sized to the default would leave a widened pane over the
       page again */
    if(docked)
      deckEl.style.setProperty('--pane-w',
        Math.round(docked.offsetWidth||232)+'px');
    deckEl.classList.toggle('pane-open',!!docked&&mode==='edit');
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
  /* every folder name in use on this slide, in the order items appear */
  function folderNames(s){
    var seen={},out=[];
    ((s&&s.annots)||[]).forEach(function(a){
      if(a&&a.fold&&!seen[a.fold]){seen[a.fold]=1;out.push(a.fold);}});
    return out;
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
    /* THREE STATES, ONE BUTTON: not locked -> position -> fully -> not
       locked. Two locks are what people mean (see the LOCKS section), and
       a second button for the rarer one would cost this narrow row a
       quarter of its width. The tooltip names the state it is IN and
       what the click does next, because a cycling button that only says
       one of the two is a guessing game. */
    function cycleLock(i){
      var a2=liveAnnot(i);
      if(!a2){renderSelPane();return;}
      var m=lockMode(a2);
      if(m==='') a2.lock='pos';
      else if(m==='pos') a2.lock=1;
      else delete a2.lock;
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}
      renderSelPane();
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
      t.textContent=annotLabel(a);
      t.title=t.textContent+' \u2014 double-click to rename';
      /* double-click to rename, the way the group folders above already
         work. Clearing it puts the kind-derived name back rather than
         leaving a blank row. */
      t.addEventListener('dblclick',function(e){
        e.stopPropagation();
        var inp=document.createElement('input');
        inp.className='sp-rename';inp.type='text';
        inp.value=(liveAnnot(i)||{}).name||'';
        inp.placeholder=annotLabel(a);
        t.replaceWith(inp);inp.focus();inp.select();
        var done=false;
        function commit(ok){
          if(done) return; done=true;
          var a3=liveAnnot(i);
          if(ok&&a3){
            var v=inp.value.trim();
            if(v) a3.name=v; else delete a3.name;
            markDirty();
          }
          renderSelPane();
        }
        inp.addEventListener('blur',function(){commit(true);});
        inp.addEventListener('keydown',function(e2){
          e2.stopPropagation();
          if(e2.key==='Enter'){e2.preventDefault();commit(true);}
          else if(e2.key==='Escape'){e2.preventDefault();commit(false);}
        });
      });
      r.appendChild(t);
      var eye=document.createElement('button');
      eye.className='sp-act'+(a.hide?' on':'');eye.type='button';
      eye.innerHTML=bic('eye');
      eye.title=a.hide?'Show while editing'
        :'Hide while editing (still shows when presenting)';
      eye.setAttribute('aria-label',
        a.hide?'Show while editing':'Hide while editing');
      eye.addEventListener('click',function(e){
        e.stopPropagation();toggleFlag(i,'hide');});
      r.appendChild(eye);
      var lm=lockMode(a);
      var lk=document.createElement('button');
      lk.className='sp-act'+(lm?' on':'')+(lm==='pos'?' half':'');
      lk.type='button';
      lk.innerHTML=bic(lm==='pos'?'pin':'lock');
      lk.title=lm===''
        ? 'Not locked. Click to pin its position — still yours to '
          +'select, resize and restyle'
        : lm==='pos'
        ? 'Position locked. Click to lock it fully — no clicking or '
          +'dragging on the canvas'
        : 'Fully locked. Click to unlock';
      lk.setAttribute('aria-label',
        lm===''?'Lock position':lm==='pos'?'Lock fully':'Unlock');
      lk.addEventListener('click',function(e){
        e.stopPropagation();cycleLock(i);});
      r.appendChild(lk);
      var dp2=document.createElement('button');
      dp2.className='sp-act';dp2.type='button';dp2.innerHTML=bic('copy');
      dp2.title='Duplicate';
      dp2.setAttribute('aria-label','Duplicate');
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
      /* innerHTML: the labels are fixed strings written just below,
         now carrying bic() icons before their words */
      b.className='dbtn sp-tool';b.innerHTML=label;b.title=title;
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
    tool(bic('copy')+' Duplicate','Duplicate the selected items',
      selN.length>=1,
      function(){dupAnnots(selN,false);});
    /* A FOLDER IS NOT A GROUP. Grouping welds items together — they move
       and format as one, which is exactly what you do NOT want from a
       filing system. Until now the only folders in this pane were groups,
       so tidying twelve items into three folders also made three rigid
       blocks (2026-08-20, user: "there needs to be folders in the objects
       thing").
       A folder is just a name on the items in it: a.fold. Nothing about
       selection, movement or formatting changes. */
    tool(bic('frame')+' New folder','Put the selected items in a named '
      +'folder \u2014 filing only, they are NOT grouped',selN.length>=1,
      function(){
        var nm=prompt('Name this folder','Folder '
          +(folderNames(s).length+1));
        if(nm===null) return;
        nm=nm.trim(); if(!nm) return;
        selN.forEach(function(i){if(s.annots[i]) s.annots[i].fold=nm;});
        markDirty();renderSelPane();
        toast(selN.length+' item'+(selN.length===1?'':'s')+' filed under '
          +'\u201c'+nm+'\u201d');
      });
    tool(bic('exit')+' Out of folder','Take the selected items out of '
      +'their folder',
      selN.some(function(i){return s.annots[i]&&s.annots[i].fold;}),
      function(){
        selN.forEach(function(i){
          if(s.annots[i]) delete s.annots[i].fold;});
        markDirty();renderSelPane();
      });
    list.appendChild(bar2);
    /* NAMED FOLDERS first — filing, not grouping. Renaming one renames
       it on every item in it, because the name IS the folder (there is no
       folder object to rename). */
    folderNames(s).forEach(function(fname){
      var fw=document.createElement('div');fw.className='sp-folder sp-fold2';
      var fi=document.createElement('span');fi.className='sp-fico';
      fi.innerHTML=bic('frame');fw.appendChild(fi);
      var fn=document.createElement('span');
      fn.className='sp-t sp-gname';fn.textContent=fname;
      fn.title=fname+' \u2014 double-click to rename this folder';
      fn.addEventListener('dblclick',function(e){
        e.stopPropagation();
        var nm=prompt('Rename this folder',fname);
        if(nm===null) return;
        nm=nm.trim();
        (s.annots||[]).forEach(function(a){
          if(a&&a.fold===fname){
            if(nm) a.fold=nm; else delete a.fold;}});
        markDirty();renderSelPane();
      });
      fw.appendChild(fn);
      var fsel=document.createElement('button');
      fsel.className='sp-act';fsel.type='button';
      fsel.innerHTML=bic('locate');
      fsel.title='Select everything in this folder';
      fsel.setAttribute('aria-label','Select everything in this folder');
      fsel.addEventListener('click',function(e){
        e.stopPropagation();
        var hit=[];
        (s.annots||[]).forEach(function(a,i){
          if(a&&a.fold===fname&&!lockedAll(a)) hit.push(i);});
        if(!hit.length) return;
        selSet=hit;selAnnot=hit[hit.length-1];
        var l2=stage.querySelector('.annot-layer');
        if(l2) paintSel(l2);
        lastSelSig='';showFmt();renderSelPane();
      });
      fw.appendChild(fsel);
      list.appendChild(fw);
      (s.annots||[]).forEach(function(a,i){
        if(!a||a.fold!==fname) return;
        var r=rowEl(a,i);r.classList.add('sp-infold');
        list.appendChild(r);
      });
    });
    /* GROUPS come next, as folders: a coloured chip, a name you can
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
      chip.setAttribute('aria-label','Group colour');
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
      rn.className='sp-act';rn.type='button';rn.innerHTML=bic('pen');
      rn.title='Rename this group';
      rn.setAttribute('aria-label','Rename this group');
      rn.addEventListener('click',function(e){
        e.stopPropagation();
        var v=prompt('Group name:',meta.name||('Group '+g));
        if(v!=null){grpMeta(s,g).name=v.trim();markDirty();renderSelPane();}
      });
      f.appendChild(rn);
      var dp=document.createElement('button');
      dp.className='sp-act';dp.type='button';dp.innerHTML=bic('copy');
      dp.title='Duplicate the whole group';
      dp.setAttribute('aria-label','Duplicate the whole group');
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
        if(ann[i2]&&ann[i2].grp===g&&!ann[i2].fold){
          var r2=rowEl(ann[i2],i2);
          r2.classList.add('sp-ing');
          r2.style.borderLeftColor=meta.color||GRP_COLORS[0];
          list.appendChild(r2);
        }
    });
    /* ...and finally everything filed nowhere. An item already listed
       under a named FOLDER above must not appear twice (2026-08-20). */
    for(var i=ann.length-1;i>=0;i--)
      if(!ann[i]||(ann[i].grp==null&&!ann[i].fold))
        list.appendChild(rowEl(ann[i],i));
  }
  var GRP_COLORS=['#39a9c0','#ff6b57','#f0a848','#46a892','#a07be0',
    '#8ba0b2'];
  function grpMeta(s,g){
    s.grpmeta=s.grpmeta||{};
    return s.grpmeta[g]=s.grpmeta[g]||{};
  }
  /* duplicate items; newGrp gives the copies a fresh group id and copies
     the folder's name ("... copy") and colour with them */
  /* the pane's own Duplicate. Same clone (see the CLONES section), a
     tighter offset because these rows are read side by side with the
     canvas, and one extra move: `newGrp` puts the whole batch into ONE
     group, which is the pane's "duplicate this group" verb. A locked
     item IS cloned here -- the pane is the one door to locked items, and
     refusing from inside it would leave no door at all. */
  function dupAnnots(idxs,newGrp,srcGrp){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var added=cloneAnnots(idxs,2,2);
    if(!added.length) return;
    if(newGrp){
      var gid=nextGrp(s);
      added.forEach(function(j){s.annots[j].grp=gid;});
      if(srcGrp!=null&&s.grpmeta&&s.grpmeta[srcGrp]){
        var m2=deep(s.grpmeta[srcGrp]);
        if(m2.name) m2.name+=' copy';
        s.grpmeta[gid]=m2;
      }
    }
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
    /* MOVED and RESIZED are different states. A pane keeps its docked
       right/bottom anchors until you actually DRAG it; resizing it by the
       corner grip changes its size and nothing else.
       They used to be the same thing, and the ResizeObserver below fires
       the moment a pane is first shown - so every pane recorded an x/y,
       came back "moved" on the next load, and could never dock again.
       That is what stopped the docked layout working on the second visit
       (2026-08-20, found live: selpane style.right was "auto" on a pane
       nobody had touched). */
    function place(box){
      var host=pane.offsetParent;
      var hw=host?host.clientWidth:innerWidth;
      var hh=host?host.clientHeight:innerHeight;
      if(box.moved){
        /* moving is what detaches it from the edge it was docked to */
        pane.style.right='auto';pane.style.bottom='auto';
        pane.style.left=Math.max(0,Math.min(hw-80,box.x))+'px';
        pane.style.top=Math.max(0,Math.min(hh-60,box.y))+'px';
      }
      if(box.w) pane.style.width=Math.min(hw,box.w)+'px';
      if(box.h) pane.style.height=Math.min(hh,box.h)+'px';
    }
    var saved=paneStore()[id];
    if(saved) place(saved);
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
          place({moved:1,x:e2.clientX-hostR.left-dx,
            y:e2.clientY-hostR.top-dy});
        }
        function up(){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
          /* `moved` is set HERE and only here: a drag is the one gesture
             that means "I want this somewhere else" */
          paneSave(id,{moved:1,x:pane.offsetLeft,y:pane.offsetTop,
            w:pane.offsetWidth,h:pane.offsetHeight});
          syncPaneDock();
        }
        document.addEventListener('pointermove',mv);
        document.addEventListener('pointerup',up);
      });
    }
    /* the native resize grip changes width/height; remember those too -
       and ONLY those, so a resize never counts as a move */
    if(window.ResizeObserver) new ResizeObserver(function(){
      if(pane.hidden||!pane.offsetParent) return;
      var st=paneStore()[id]||{};
      if(Math.abs((st.w||0)-pane.offsetWidth)<3
        &&Math.abs((st.h||0)-pane.offsetHeight)<3) return;
      st.w=pane.offsetWidth;st.h=pane.offsetHeight;
      paneSave(id,st);
      /* a widened pane needs a wider strip reserved for it - but NOT from
         inside the observer callback: syncPaneDock re-fits the page, the
         page reflows, and the browser reports "ResizeObserver loop
         completed with undelivered notifications" (seen live 2026-08-20).
         One frame later is outside the loop and looks identical. */
      if(!st.moved) requestAnimationFrame(syncPaneDock);
    }).observe(pane);
  }
  ['selpane','animpane','notespane','verpane','preflight','varspane',
   'stdpane','tidypane','objhist','flippane']
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
  /* ---------- embedded snapshots: the deck's own copy of its cards ----
     A saved deck used to be refs only, so opening it without the source
     notebook (or without the internet to re-fetch one) showed empty
     frames. Saving now writes each placed card's rendered body into the
     file (`p.emb`, figures already data: URIs), and this store carries
     those copies at runtime. The live notebook ALWAYS wins — resolveRef
     tries ITEMS first — so an open tab still drives its frames, and the
     embedded copy is the understudy, not a fork. Kept OUT of the pres
     object on purpose: drafts are written to localStorage on every edit,
     and megabytes of figures there would hit the quota and silently kill
     autosave. IndexedDB holds them between sessions instead. */
  var EMBED={};          /* ns -> {title,kind,html,code} */
  var embItems={};       /* ns -> the virtual item resolveRef hands out */
  var embSaveT=null;
  function embKey(ref){
    if(!ref) return null;
    if(EMBED[ref]) return ref;
    /* plain legacy anchor: find it under any namespace, like resolveRef */
    if(String(ref).indexOf('::')>=0) return null;
    var suf='::'+ref,ks=Object.keys(EMBED);
    for(var i=0;i<ks.length;i++)
      if(ks[i].slice(-suf.length)===suf) return ks[i];
    return null;
  }
  function embFor(ref){var k=embKey(ref);return k?EMBED[k]:null;}
  function embItem(ref){
    var k=embKey(ref); if(!k) return null;
    if(!embItems[k]){
      var e=EMBED[k],pr=splitRef(k);
      embItems[k]={title:e.title||'',kind:e.kind||'note',
        hasCode:!!e.code,nb:pr[0]||'',anchor:pr[1],ns:k,emb:true};
    }
    return embItems[k];
  }
  /* the parsed body node, cached — cellFacets asks often */
  function embBody(ref){
    var e=embFor(ref); if(!e||!e.html) return null;
    if(!e._node){
      var t=document.createElement('template');t.innerHTML=e.html;
      e._node=t.content.firstElementChild||null;
    }
    return e._node;
  }
  function embStore(key,e){
    EMBED[key]={title:String(e.title||''),kind:String(e.kind||''),
      html:String(e.html||''),code:typeof e.code==='string'?e.code:''};
    delete embItems[key];
    /* invalidation point 3 (see frameNodeCache): a frame rendered from
       the OLD embedded copy of this ref must rebuild from the new one */
    dropFrameCache(key);
  }
  function embSaveSoon(){
    clearTimeout(embSaveT);
    embSaveT=setTimeout(function(){
      /* plain copies only — the cached _node is a DOM element and would
         make the structured clone throw */
      var plain={};
      Object.keys(EMBED).forEach(function(k){
        var e=EMBED[k];
        plain[k]={title:e.title,kind:e.kind,html:e.html,code:e.code||''};
      });
      idbPut('emb:'+SCOPE,plain).catch(function(){});
    },1000);
  }
  function resolveRef(ref){
    if(!ref) return null;
    if(ITEMS[ref]) return ITEMS[ref];
    if(String(ref).indexOf('::')>=0) return embItem(ref);
    for(var s=0;s<APP.order.length;s++){
      var k=nsKey(APP.order[s],ref);
      if(ITEMS[k]) return ITEMS[k];
    }
    return embItem(ref);
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
        style:p.style?deep(p.style):{},
        view:p.view?deep(p.view):{}};
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
        /* which section this slide sits in. The ORDER of the sections is
           not stored anywhere — it is read back off the slide list, which
           is why reordering slides can never desynchronise it
           (2026-08-22) */
        if(typeof s.sec==='string'&&s.sec) o.sec=s.sec;
        /* per-slide look + pane organisation. A field not listed here
           silently dies on the next load — exactly what happened to
           `label` before it was added (2026-08-10) */
        if(typeof s.bg==='string'&&s.bg) o.bg=s.bg;
        /* speaker notes and the per-slide time goal: yours, never drawn
           on the page, and lost on every reload until they were
           whitelisted here (2026-08-20) */
        if(typeof s.notes==='string'&&s.notes) o.notes=s.notes;
        if(typeof s.goal==='number'&&s.goal>0) o.goal=s.goal;
        if(s.border) o.border=deep(s.border);
        if(s.grpmeta) o.grpmeta=deep(s.grpmeta);
        if(s.layout==='title'){
          o.title=String(s.title||'');o.sub=String(s.sub||'');
          if(s.tprops) o.tprops=deep(s.tprops);
          if(s.sprops) o.sprops=deep(s.sprops);
        }
        if(Array.isArray(s.annots)&&s.annots.length)
          o.annots=deep(s.annots);
        (o.annots||[]).forEach(function(a){
          if(a.k==='cell'&&a.ref) a.ref=ns(a.ref);
          /* a flip book's frames hold the same kind of ref, one per
             frame. Missing this line is not a subtle bug: the deck
             reloads with every frame blank. */
          if(a.k==='flip'&&Array.isArray(a.frames))
            a.frames.forEach(function(f){
              if(f&&f.ref) f.ref=ns(f.ref);});
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
    if(p.tapzoom) out.tapzoom=1;     /* tap-to-enlarge, same rule */
    if(typeof p.page==='string'&&p.page) out.page=p.page;  /* page preset */
    /* the page background survives every load path — normPres dropping
       it turned saved white posters navy again (2026-08-05 review) */
    if(typeof p.pageBg==='string'&&p.pageBg) out.pageBg=p.pageBg;
    /* trim marks are a print decision and were being forgotten on every
       reload, because nothing carried them across (2026-08-10) */
    if(p.cropMarks) out.cropMarks=1;
    if(typeof p.talkMins==='number'&&p.talkMins>0) out.talkMins=p.talkMins;
    if(typeof p.notes==='string'&&p.notes) out.notes=p.notes;
    if(Array.isArray(p.pad)&&p.pad.length)
      out.pad=deep(p.pad);
    /* the text types this deck invented. Filtered on the way IN: an entry
       with no id is unusable, and one claiming a built-in id would
       silently redefine Heading 1 for everybody who opened the file.
       It cannot ride the ['wmark','head','foot','styles'] loop below —
       that loop takes objects and this is a list. */
    if(Array.isArray(p.types)&&p.types.length){
      var tps=[];
      p.types.forEach(function(t){
        if(!t||typeof t!=='object'||!t.id) return;
        if(BUILTIN_STYLE_IDS.indexOf(t.id)>=0) return;
        tps.push(deep(t));
      });
      if(tps.length) out.types=tps;
    }
    /* the section NAMES, filtered to ids a slide actually uses. A blind
       deep copy — the shape the wmark/head/foot/styles line uses — would
       hoard entries for sections that no longer have a single slide in
       them, and the key would never empty again. Dropping it entirely
       when it does empty is what keeps a deck that never used sections
       serialising exactly as it did before the feature existed. */
    if(p.sections&&typeof p.sections==='object'){
      var used={},keep={},anySec=false;
      out.slides.forEach(function(s2){if(s2.sec) used[s2.sec]=1;});
      Object.keys(p.sections).forEach(function(k){
        if(!used[k]) return;
        var d=p.sections[k]; if(!d) return;
        keep[k]={name:String(d.name||'Untitled section')};
        if(d.fold) keep[k].fold=1;
        anySec=true;
      });
      if(anySec) out.sections=keep;
    }
    /* deck-level furniture, same rule as the page background: forget it on
       load and a saved deck quietly loses its footer (2026-08-20) */
    ['wmark','head','foot','styles'].forEach(function(k){
      if(p[k]&&typeof p[k]==='object') out[k]=deep(p[k]);
    });
    /* embedded card snapshots ride the FILE, not the object: they are
       absorbed into the session store (and IndexedDB) here, so frames
       still render when the notebook never opens — while drafts written
       on every edit stay ref-sized. Keys are namespaced like refs are. */
    if(p.emb&&typeof p.emb==='object'){
      Object.keys(p.emb).forEach(function(k){
        var e=p.emb[k];
        if(e&&typeof e.html==='string'&&e.html) embStore(ns(k)||k,e);
      });
      embSaveSoon();
    }
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
  /* ingest every notebook the page carries. Called from THE BOOT
     SEQUENCE at the end of the file — nothing executes here at load. */
  function initShellRegistry(){
    APP.order.forEach(function(stem){
      registerShell(stem,APP.shells[stem].data||{});});
  }

  /* ---------- saved presentations: project file + notebook-embedded --- */
  /* the project revision this page was built from; echoed back on every
     save so the server can refuse a write that has not seen another
     window's changes (see the 409 branch in saveToProject) */
  var projectRev=(APP.project&&typeof APP.project.rev==='number')
    ?APP.project.rev:0;
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
  /* A SILENT PERSISTENCE LAYER IS WORSE THAN NONE. This swallowed
     QuotaExceededError and returned nothing, and all seventeen callers
     ignored it — so once a draft outgrew the ~5MB budget every later
     write was discarded while the Save button went on toasting "Kept in
     this browser" and the readout went on saying "saved". In the browser
     and static builds that store IS the presentation, so what was lost
     was the only copy (2026-08-22).
     It reports now, and lsFull records that it happened so the readout
     and the Save button can stop lying. */
  var lsFull=false;
  function lsSet(k,v){
    try{
      localStorage.setItem(k,v);
      if(lsFull){lsFull=false;if(typeof status==='function') status();}
      return true;
    }catch(e){
      /* Firefox reports NS_ERROR_DOM_QUOTA_REACHED, Safari a bare
         QuotaExceededError with code 22, Chrome code 22 with a name.
         Anything that threw here failed to store, whatever it is called. */
      if(!lsFull){
        lsFull=true;
        if(typeof status==='function') status();
        if(typeof toast==='function')
          toast('This browser is full — that edit was NOT kept. Use '
            +'File › Download a copy, or Saved to › a file on '
            +'your computer.',9000);
      }
      return false;
    }
  }
  function lsIsFull(){return lsFull;}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function loadDraft(name){
    var raw=lsGet(PFX+name); if(!raw) return null;
    try{var d=JSON.parse(raw);
      return (d&&Array.isArray(d.slides))?normPres(d):null;
    }catch(e){return null;}
  }
  /* THE DRAFT WRITE IS DEBOUNCED (2026-08-23 perf). markDirty runs on
     every keystroke and every gesture commit, and JSON.stringify(pres)
     plus a synchronous localStorage write per call was the single
     biggest fixed cost of an edit. Only the serialisation waits (~300ms
     trailing, stringifying the CURRENT pres when it fires) — status(),
     scheduleAutosave and histPush stay immediate, so the readout and
     undo behave exactly as before.
     flushDraftWrite() runs a pending write NOW — called wherever a fresh
     draft matters: pagehide/visibilitychange (after the text flush),
     entering Present, loading another presentation, and a rename (which
     migrates the draft by key).
     cancelDraftWrite() drops a pending write instead — called where the
     draft was just deleted on purpose (project/notebook save success,
     Discard, Delete), matching the old order in which the write always
     preceded the lsDel. */
  var draftT=null;
  function writeDraftNow(){
    draftT=null;
    if(!pres) return;
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
  }
  function scheduleDraftWrite(){
    if(draftT) clearTimeout(draftT);
    draftT=setTimeout(writeDraftNow,300);
  }
  function flushDraftWrite(){
    if(draftT){clearTimeout(draftT);writeDraftNow();}
  }
  function cancelDraftWrite(){
    if(draftT){clearTimeout(draftT);draftT=null;}
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
    flushDraftWrite();   /* the outgoing deck's last edits reach its draft */
    deckZoom=0;   /* zoom is per-session, reset per presentation */
    var d=loadDraft(name);
    if(d){pres=d;source='draft';histReset();return;}
    var s=savedByName(name);
    if(s){pres=normPres(deep(s));source='saved';histReset();return;}
    pres=defaultPres();source='auto';histReset();
  }
  /* which presentation the page opens with. Called from THE BOOT
     SEQUENCE at the end of the file — never from here: loadPresentation
     → histReset() → syncCustomTypes() reaches STYLE_DEFAULTS, which is
     assigned thousands of lines below this point (see the 2026-08-22
     incident record at the boot sequence). */
  function initFirstPresentation(){
    var last=lsGet(PFX+'last');
    if(last&&(loadDraft(last)||savedByName(last))) loadPresentation(last);
    else if(allSaved().length) loadPresentation(allSaved()[0].name);
    /* the other two branches sync via histReset; this one must too —
       "every path that installs a new pres", as syncCustomTypes says */
    else {pres=defaultPres();source='auto';syncCustomTypes();}
  }

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
    /* A FULL BROWSER OUTRANKS EVERY OTHER READING. Once localStorage has
       refused a write, "saved" is a lie about the only copy there is, so
       it says so and keeps saying so until a write succeeds. */
    if(lsIsFull()&&saveTarget==='browser'){
      el.textContent='NOT saved — browser full';
      el.className='deck-status unsaved lsfull';
      el.title='localStorage is full, so edits are no longer being kept. '
        +'Use File › Download a copy, or switch "Saved to" to a file.';
      return;
    }
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
      /* the readout lives in the thin bar now, so a wider text has to
         re-judge THAT row too — fitQat drops it whole when tight */
      requestAnimationFrame(fitQat);
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
  /* `quiet` persists WITHOUT recording an undo step. The debounced commit
     that now runs while you type uses it, so a paragraph still costs one
     undo entry (taken on blur, as before) instead of one per phrase —
     which would evict real slide edits from the 50-deep stack. */
  function markDirty(quiet){
    source='draft';
    saveKind='';
    scheduleDraftWrite();   /* the stringify+localStorage cost, debounced */
    status();
    scheduleAutosave();
    if(!quiet) histPush();
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
         not a thumbnail — leave that alone. In headings mode there is no
         thumbnail at all, and this correctly does nothing. */
      if(old&&old.parentNode){
        miniHNow=miniH();
        old.parentNode.replaceChild(miniDiagram(s),old);
      }
      var tt=row.querySelector('.film-t');
      /* filmText, not slideTitle: in headings mode the row is named by
         the slide's heading, and refreshing it with the other function
         would rename it back on the first edit */
      if(tt) tt.textContent=filmText(s);
      row.dataset.lvl=headLevel(s);
    },140);
  }
  /* ---------- undo / redo (snapshots of the slide content) ---------- */
  var undoStack=[],redoStack=[],histSnap=null;
  /* the section names alone, or null when there are none — the same
     empty-is-null trick pres.styles uses, so a deck with no sections
     serialises into the snapshot exactly as it did before they existed */
  function secNames(){
    var m=pres&&pres.sections,out=null;
    if(m) Object.keys(m).forEach(function(k){
      if(!m[k]) return;
      out=out||{};
      out[k]=(m[k].name)||'Untitled section';
    });
    return out;
  }
  /* WHAT UNDO CAN SEE. Anything left out of this object is not merely
     un-undoable — it goes INCONSISTENT, because the things that are in it
     are derived from the things that are not.

     The type scale was the bad case. `scaleStyles()` rewrites pres.styles
     and then writes the new sizes into every text box; only the boxes were
     snapshotted, so Ctrl+Z put the boxes back and left the style
     definitions scaled. The deck looked restored until anything called
     applyStyleTo — editing a box, Re-apply, Match slide — at which point
     the scaling silently returned. And because scaleStyles multiplies the
     CURRENT definition, scale/undo/scale drifted the type a little further
     every time, with no way back short of resetting each style by hand
     (2026-08-22).
     Page size and page background were the quiet case: annots are stored
     in percentages, so changing either leaves this object identical,
     histPush's "nothing actually changed" guard fires, and no undo entry
     is created at all.

     pres.notes and pres.pad stay OUT, deliberately: they are written on
     every keystroke, so snapshotting them would fill the 50-entry stack
     with single characters and evict the slide edits undo is for. Per
     SLIDE notes live on the slide and are covered. */
  function histState(){
    return JSON.stringify({slides:pres.slides||[],talkMins:pres.talkMins||0,
      showNums:pres.showNums||0,tapzoom:pres.tapzoom||0,wmark:pres.wmark||null,
      head:pres.head||null,foot:pres.foot||null,
      /* an empty styles object and no styles object are the same deck —
         serialise them the same way or merely READING a style (which
         lazily creates {}) would record a phantom undo step */
      styles:(pres.styles&&Object.keys(pres.styles).length)
        ?pres.styles:null,
      /* the types you invented are as undoable as the boxes wearing
         them, and for the same reason the styles are: delete a type and
         Ctrl+Z must bring back both the type AND the a.style tags that
         deleteCustomType stripped. Empty serialises as null on the same
         argument as styles - merely READING the list lazily creates it,
         and a phantom undo step for reading is worse than none. */
      types:(pres.types&&pres.types.length)?pres.types:null,
      /* section NAMES are content and are undoable; whether a section is
         COLLAPSED is a way of looking at the strip, so it is stripped out
         here — Ctrl+Z must never open or close one (2026-08-22). The
         tags themselves ride inside `slides`. */
      sections:secNames(),
      page:pres.page||null,pageBg:pres.pageBg||null,
      cropMarks:pres.cropMarks||0});
  }
  function histReset(){
    /* the one funnel every newly installed `pres` passes through, which
       makes it the only safe place to graft this deck's own text types
       into the shared STYLE_DEFAULTS registry. Miss it and deck A's
       "Quote" is still on the menu after you open deck B. */
    syncCustomTypes();
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
    if(d.tapzoom) pres.tapzoom=1; else delete pres.tapzoom;
    var pageWas=pres.page||null,bgWas=pres.pageBg||null;
    ['wmark','head','foot','styles','page','pageBg',
     'cropMarks'].forEach(function(k){
      if(d[k]) pres[k]=d[k]; else delete pres[k];});
    if(d.talkMins) pres.talkMins=d.talkMins; else delete pres.talkMins;
    /* types are restored with their own statement rather than by joining
       the list above, because the registry has to be re-grafted the
       moment the list changes - every menu, every specimen row and
       applyStyleTo read STYLE_DEFAULTS, not pres.types, so an undo that
       restored the list without syncing would leave the deck offering a
       type that no longer resolves. */
    if(d.types) pres.types=d.types; else delete pres.types;
    syncCustomTypes();
    /* sections get their own merge rather than joining the list above:
       that loop deletes what the snapshot lacks, and the snapshot
       deliberately lacks the fold flags — so it would collapse-or-expand
       every section on every undo. Names come from the snapshot; whether
       a section is open stays exactly as you left it. */
    if(d.sections){
      var was=pres.sections||{};
      pres.sections={};
      Object.keys(d.sections).forEach(function(k){
        pres.sections[k]={name:d.sections[k]};
        if(was[k]&&was[k].fold) pres.sections[k].fold=1;
      });
    } else delete pres.sections;
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;selAnnot=null;selSet=[];
    /* the styles come back as DEFINITIONS only. Every text box already
       carries the sizes it had in this snapshot (applyStyleTo writes them
       in), so restyling here would overwrite the restored boxes with the
       restored definitions — the same round trip we are undoing. */
    /* a page size or background is not repainted by refresh(): they are
       applied to the stage, so an undo across one has to re-run the same
       two calls the picker does, and re-fit a ribbon whose column may
       have just changed shape */
    var pageChanged=(pres.page||null)!==pageWas;
    if(pageChanged||(pres.pageBg||null)!==bgWas) deckZoom=0;
    /* persist WITHOUT recording a new history entry */
    source='draft';
    lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    status();scheduleAutosave();
    if(pageChanged) applyPage();
    if(typeof applyPageBg==='function') applyPageBg();
    refresh();
    if(pageChanged){
      if(typeof syncTopBar==='function') syncTopBar();
      if(typeof applySideRibbon==='function') applySideRibbon();
    }
    /* nothing is selected after a restore — clear the format bar */
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
  /* ---- FRAME RENDER CACHES (2026-08-23 perf) --------------------------
     renderAnnots used to re-run cloneBody per cell frame per layer
     rebuild: a full cloneNode(true) of a card body carrying multi-MB
     base64 figures, four querySelectorAll stripping passes, and an
     outerHTML serialisation into frameSnaps — per frame, per call. The
     prepared node is now cached and re-cloned on use (the embBody
     e._node precedent).
     frameNodeCache: normRef+'::'+requestedPart -> ready-to-insert node.
     INVALIDATION — a stale frame is a wrong frame, so every event that
     can change a card's rendered body drops the affected entries via
     dropFrameCache():
       1. the 'sem:shell' handler (a notebook opened OR reloaded — the
          refresh-pictures path), per stem;
       2. the 'sem:shellclosed' handler, per stem — frames fall back to
          the deck's embedded copy;
       3. embStore(), per ref — a new/updated embedded copy must show
          (it matters when the notebook is not open).
     NOT invalidation points, deliberately:
       - document filter changes (the Plots/Code/Outputs menus): they
         only toggle classes/stubs on the live cards, and cloneBody
         normalises all of that away (strips the pt-, ot-, part- and
         code-off classes, removes .ot-stub, restores .figpager-nav),
         so the clone is filter-invariant;
       - the notebook-side figpager's CURRENT page: view state, not
         content — the placed frame's own pager stays interactive;
       - freeze/unfreeze ("Previous figure"): it switches BUILDERS
         (framePartFromSnap vs framePart), no shared entries;
       - version locks: verNodeCache is keyed by the immutable
         per-commit card object (fetchVerCards never refetches a defined
         key), and locking/unlocking picks a different code path.
     snapNodeCache is content-addressed (keyed by the snapshot HTML
     string itself), so it cannot go stale by construction. */
  var frameNodeCache={};
  var snapNodeCache=new Map();      /* snapshot html -> {part: node} */
  var verNodeCache=new WeakMap();   /* version card -> {part: node} */
  /* drop cached frame nodes for one notebook stem, one full ref, or all
     (both key shapes are prefixes of 'stem::anchor::part') */
  function dropFrameCache(stemOrRef){
    if(stemOrRef==null){frameNodeCache={};return;}
    var pfx=stemOrRef+'::';
    Object.keys(frameNodeCache).forEach(function(k){
      if(k.indexOf(pfx)===0) delete frameNodeCache[k];});
  }
  function cloneBody(ref){
    var c=cardEl(ref);
    if(!c){
      /* notebook not open: fall back to the copy embedded in the deck
         (already filter-stripped at capture time) */
      var eb=embBody(ref);
      return eb?stripIds(eb.cloneNode(true)):null;
    }
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
    var c=cardEl(ref);
    if(!c){
      var e=embFor(ref);
      if(!e||!e.code) return null;
      var t=document.createElement('template');t.innerHTML=e.code;
      var n=t.content.firstElementChild;
      return n?stripIds(n.cloneNode(true)):null;
    }
    var inner=$('.codeinner',c); if(!inner) return null;
    return stripIds(inner.cloneNode(true));
  }
  /* a cell can contribute several things to a slide: its CODE, its
     FIGURE(s) and its printed OUTPUT. A frame shows one 'part'. */
  function cellFacets(ref){
    var card=cardEl(ref);
    var it=resolveRef(ref);
    var f={code:!!(it&&it.hasCode),figure:false,output:false};
    var body=null;
    if(card){
      if(!f.code&&card.querySelector('.codeinner')) f.code=true;
      body=$('.cardbody',card);
    } else {
      body=embBody(ref);   /* the deck's own copy is a cardbody too */
    }
    if(body){
      /* live embeds (plotly/bokeh/vega/folium) are figures too */
      f.figure=!!body.querySelector('.figframe,.figpager,.plotframe');
      f.output=!!body.querySelector(
        'pre.result,pre.stream,.rich:not(.plotframe),.jv-xr,.note')
        ||(!f.figure&&!!(body.textContent||'').trim());
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
    /* cached per (ref, requested part): cloneBody — and its frameSnaps
       outerHTML snapshot — now runs only when the cache was dropped,
       i.e. on first sight or after the source card actually changed.
       See the invalidation list on frameNodeCache above. */
    var key=(normRef(ref)||String(ref||''))+'::'+(part||'auto');
    var hit=frameNodeCache[key];
    if(hit) return hit.cloneNode(true);
    var f=cellFacets(ref);
    if(!part||part==='auto'||!hasFacet(f,part)) part=autoPart(f);
    var b;
    if(part==='code') b=cloneCode(ref)||cloneBody(ref);
    else {
      b=cloneBody(ref);
      b=b?applyPartFilter(b,part):cloneCode(ref);
    }
    if(b) frameNodeCache[key]=b.cloneNode(true);
    return b;
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
  /* resolve the part and filter a snapshot BODY node (snapshots hold no
     code part) — shared by the string and version-card paths */
  function snapPart(b,part){
    var hasFig=!!b.querySelector('.figframe,.figpager,.plotframe');
    if(!part||part==='auto'||part==='code')
      part=hasFig?'figure':'output';
    return applyPartFilter(b,part);
  }
  function frameFromVerCard(card,part){
    /* was: template-parse card.html, clone, re-serialise to outerHTML,
       then framePartFromSnap parsed the string AGAIN — per frame, per
       render. Now parsed once per card object (verCards entries are
       immutable) and cached per part (2026-08-23 perf). */
    var byPart=verNodeCache.get(card);
    if(!byPart){byPart={};verNodeCache.set(card,byPart);}
    var pk=part||'auto';
    if(pk in byPart)
      return byPart[pk]?byPart[pk].cloneNode(true):null;
    var t=document.createElement('template');t.innerHTML=card.html||'';
    var b=t.content.querySelector('.cardbody');
    var out=b?snapPart(stripIds(b.cloneNode(true)),part):null;
    byPart[pk]=out?out.cloneNode(true):null;
    return out;
  }
  function lockChip(c,a,ok){
    c.classList.add('an-locked-ver');
    var lp=lockParts(a);
    var meta=(lp&&verMeta[lp.pkey])||{};
    var msg=a.lockver.msg||meta.msg||'';
    var date=a.lockver.date||meta.date||'';
    var fz=document.createElement('span');
    fz.className='an-lockchip'+(ok?'':' warn');
    fz.innerHTML=bic('lock')+' '+esc(a.lockver.commit);
    fz.title=(ok?'Locked to commit ':'Locked to commit (content '
      +'unavailable — showing live) ')+a.lockver.commit
      +(msg?' — “'+msg+'”':'')+(date?' · '+date:'')
      +'\nRefresh never changes this frame. Unlock via the ribbon.';
    c.appendChild(fz);
  }
  /* render a frame from a REMEMBERED body (the pre-refresh figure).
     The string used to be re-parsed through template.innerHTML on every
     call — multi-MB of HTML, per frame, per rebuild. Now parsed once per
     (html, part) and re-cloned; keyed by the string itself, so the cache
     is content-addressed and cannot go stale (2026-08-23 perf). */
  function framePartFromSnap(html,part){
    var byPart=snapNodeCache.get(html);
    if(!byPart){byPart={};snapNodeCache.set(html,byPart);}
    var pk=part||'auto';
    if(pk in byPart)
      return byPart[pk]?byPart[pk].cloneNode(true):null;
    var t=document.createElement('template');
    t.innerHTML=html;
    var b=t.content.firstElementChild;
    b=b?snapPart(b.cloneNode(true),part):null;
    byPart[pk]=b?b.cloneNode(true):null;
    return b;
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
    sp.className='cellpartbtn split';sp.innerHTML=bic('outline')+' split';
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
  /* the code-kind palette: app.js owns the table (window.SemView.kindFill
     — app.js is spliced before this file in page.html). The literal here
     is only the fallback for a page carrying the deck without app.js. */
  var NODE_FILL=(window.SemView&&window.SemView.kindFill)
    ||{figure:'#39a9c0',diagnostic:'#39a9c0',dataset:'#4d90c0',
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
  /* the corners a line is dragged through, if any. Percentages of the
     page like everything else, in the order they are walked. An arrow
     without them is exactly what it always was - two endpoints - so
     nothing that never touches a corner notices they exist (2026-08-20,
     user: "when adding arrows you can really edit all the points and make
     it the exact shape you want"). */
  function arrowMids(a){
    return (a&&Array.isArray(a.mid))?a.mid:[];
  }
  function arrowPath(e,a,W,H){
    W=W||100;H=H||100;
    var x1=e.x1/100*W,y1=e.y1/100*H,x2=e.x2/100*W,y2=e.y2/100*H;
    /* CORNERS win over every canned route: once you have dragged one in by
       hand, "curved" and "elbowed" are no longer describing the line you
       drew. Smoothed with the same Catmull-Rom the freehand tool uses, so
       a dragged corner reads as a bend rather than a kink - unless
       a.sharp says the kink was the point. */
    var mids=arrowMids(a);
    if(mids.length){
      var pts=[[x1,y1]].concat(mids.map(function(m){
        return [m[0]/100*W,m[1]/100*H];}),[[x2,y2]]);
      if(a.sharp)
        return 'M'+pts.map(function(q){return q[0]+' '+q[1];}).join(' L');
      var f=function(n){return Math.round(n*100)/100;};
      var d2='M'+f(pts[0][0])+' '+f(pts[0][1]);
      for(var k=0;k<pts.length-1;k++){
        var q0=pts[k-1]||pts[k],q1=pts[k],q2=pts[k+1],q3=pts[k+2]||pts[k+1];
        d2+='C'+f(q1[0]+(q2[0]-q0[0])/6)+' '+f(q1[1]+(q2[1]-q0[1])/6)
          +','+f(q2[0]-(q3[0]-q1[0])/6)+' '+f(q2[1]-(q3[1]-q1[1])/6)
          +','+f(q2[0])+' '+f(q2[1]);
      }
      return d2;
    }
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
  /* ---- GRADIENTS -------------------------------------------------------
     A gradient is a list of STOPS: [{o:0..1, c:'#rrggbb'}, ...]. It used to
     be exactly two colours in `a` and `b`, which made a three-colour
     gradient impossible to express at all (2026-08-20, user asked for
     "gradients from different directions, multiple colours").
     `a`/`b` are still read on the way IN so every deck saved before this
     keeps its gradient, and still written on the way OUT so the .pptx
     exporter — which speaks in two colours — needs no changes. */
  function gradStops(g){
    if(!g) return [];
    if(Array.isArray(g.stops)&&g.stops.length>=2) return g.stops;
    return [{o:0,c:g.a||'#39a9c0'},{o:1,c:g.b||'transparent'}];
  }
  function gradCss(g,col){
    var st=gradStops(g).map(function(s2){
      return (s2.c||col||'#39a9c0')+' '+Math.round((s2.o||0)*100)+'%';
    }).join(', ');
    if(g.type==='radial')
      return 'radial-gradient(circle at '
        +(g.cx==null?50:g.cx)+'% '+(g.cy==null?50:g.cy)+'%, '+st+')';
    /* CSS measures its angle from "up" and clockwise; the model keeps the
       maths convention the SVG paint server uses, so the two differ by 90 */
    return 'linear-gradient('+((+g.ang||0)+90)+'deg, '+st+')';
  }
  function cssFill(a,col){
    if(!a.fill&&!a.grad) return 'transparent';
    if(a.grad) return gradCss(a.grad,col);
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
        } else {
          gel.setAttribute('cx',(g.cx==null?50:g.cx)+'%');
          gel.setAttribute('cy',(g.cy==null?50:g.cy)+'%');
          gel.setAttribute('r','62%');
        }
        gradStops(g).forEach(function(st){
          var s2=document.createElementNS(SVGNS,'stop');
          s2.setAttribute('offset',st.o==null?0:st.o);
          s2.setAttribute('stop-color',st.c||col||'#39a9c0');
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
    closeSpot();
  }
  /* ---- SPOTLIGHT: blow one item up, mid-talk ---------------------------
     "In power point when you present it is static. But sometimes when
     people are presenting things need to be changed. It would be cool if
     clicking on text or a figure made it full screen in the presentation"
     (2026-08-20, user).
     The hard part is not the zoom, it is that a click on the slide
     already ADVANCES the build - so a plain click cannot mean two things.
     The rule: a normal click still advances, and ALT+click (or a click on
     the little magnifier that appears when you hover an item) spotlights.
     The keyboard has it too: Z zooms whatever the pointer is over, which
     is the version you can actually use from a lectern.
     It is a FLIP: the item is cloned, the clone is placed exactly over
     the original, and then it is transformed to the centre - so it grows
     out of where it was rather than appearing from nowhere, and the
     original never moves. */
  var spotEl=null,spotHover=null;
  document.addEventListener('mousemove',function(e){
    if(mode!=='view'||deckEl.hidden) return;
    spotHover=spotTarget(e);
  });
  function closeSpot(){
    if(!spotEl) return;
    var el=spotEl;spotEl=null;
    el.classList.remove('on');
    setTimeout(function(){if(el.parentNode) el.remove();},220);
    document.body.classList.remove('jv-spot');
  }
  function spotlight(item){
    if(!item||mode!=='view') return;
    closeSpot();
    var r=item.getBoundingClientRect();
    if(!r.width||!r.height) return;
    var wrap=document.createElement('div');
    wrap.className='jv-spot-wrap';
    var inner=document.createElement('div');
    inner.className='jv-spot-inner';
    /* start EXACTLY over the original, in viewport coordinates */
    inner.style.left=r.left+'px';
    inner.style.top=r.top+'px';
    inner.style.width=r.width+'px';
    inner.style.height=r.height+'px';
    var clone=item.cloneNode(true);
    /* the clone is a picture, not a control: strip the editing chrome and
       anything that could take a click */
    /* the old drag handle is deliberately NOT in this list: nothing has
       built one since items began dragging from their own body, and a
       test pins that it never returns */
    ['.an-resize','.an-rotate','.an-buildno','.an-endpt',
     '.an-cellbtn','.cellparts','.an-marquee']
      .forEach(function(sel){
        Array.prototype.slice.call(clone.querySelectorAll(sel))
          .forEach(function(n){n.remove();});
      });
    clone.classList.remove('sel','grpsel','an-prebuild','an-ingrp');
    clone.style.position='absolute';
    clone.style.left='0';clone.style.top='0';
    clone.style.width='100%';clone.style.height='100%';
    clone.style.margin='0';
    inner.appendChild(clone);
    wrap.appendChild(inner);
    /* the way out has to be visible or it does not exist */
    var x=document.createElement('button');
    x.className='dbtn jv-spot-x';
    x.innerHTML=bic('exit')+' Close (Esc)';
    x.addEventListener('click',function(e){
      e.stopPropagation();closeSpot();});
    wrap.appendChild(x);
    wrap.addEventListener('click',function(e){
      e.stopPropagation();closeSpot();});
    document.body.appendChild(wrap);
    document.body.classList.add('jv-spot');
    spotEl=wrap;
    /* now FLIP it to the middle, as big as it can be without distorting */
    var pad=0.86;
    var k=Math.min(innerWidth*pad/r.width,innerHeight*pad/r.height);
    /* never SHRINK something that is already big; a spotlight that makes
       the figure smaller is a bug wearing a feature's clothes */
    k=Math.max(1,k);
    var cx=innerWidth/2-(r.left+r.width/2);
    var cy=innerHeight/2-(r.top+r.height/2);
    requestAnimationFrame(function(){
      inner.style.transform='translate('+cx+'px,'+cy+'px) scale('
        +k.toFixed(3)+')';
      wrap.classList.add('on');
    });
  }
  /* what, under this pointer, is worth blowing up? */
  function spotTarget(ev){
    var t=ev.target;
    if(!t||!t.closest) return null;
    return t.closest('.an-item,.card,.figframe');
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
    eye.innerHTML=bic('eye');
    eye.title=isHidden
      ?'Hidden — click to show it again'
      :'Hide this step';
    eye.addEventListener('click',function(e){
      e.stopPropagation();spec.toggle(st.ns);doRebuild();});
    h.appendChild(eye);
    var fb=document.createElement('span');fb.className='vo-full';
    fb.innerHTML=bic('expand');fb.title='View this cell full screen';
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
    [[bic('menu')+' Cells','cells',
      'The lineage as a readable list of steps'],
     [bic('tree')+' Tree','tree','The lineage as an expandable dependency '
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
            eye.className='vo-sec-eye';eye.innerHTML=bic('eye');
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
  /* ---- REPEATED FURNITURE: watermark, header, footer -------------------
     All three are the same thing - one piece of DECK-level content painted
     onto every page. Slide numbers have worked this way since the start
     and are the model: they live on `pres`, they are drawn after the
     annots, and they are therefore not items you can select, drag or
     delete by accident (2026-08-20, user asked for "Watermarks" and
     "Header and footer").
     ONE function, called by renderSlide for the canvas and by
     buildPrintRoot for PDF / standalone HTML - a second copy is how the
     export and the screen drift apart.
     The placeholders are the ones every office suite uses, so a footer of
     "{n} / {N}" says what you would expect it to. */
  function furnText(txt,idx){
    return String(txt||'')
      .replace(/\{n\}/g,String(idx+1))
      .replace(/\{N\}/g,String((pres.slides||[]).length))
      .replace(/\{name\}/g,pres.name||'')
      .replace(/\{date\}/g,new Date().toLocaleDateString());
  }
  function paintFurniture(slideEl,idx){
    if(!slideEl) return;
    /* idempotent: applyZoom calls this again on every resize so the
       furniture rescales with the page, and appending a second copy every
       time would stack watermarks (2026-08-20) */
    $$('.slide-wmark,.slide-head,.slide-foot',slideEl)
      .forEach(function(n){n.remove();});
    /* PERCENT OF PAGE HEIGHT, resolved to px here - exactly the currency
       fontPx uses for text items. Left as a CSS percentage it resolved
       against the parent's FONT SIZE instead of the page, so a 12%
       watermark came out under 2px and was invisible (found live,
       2026-08-20). */
    var ph=slideEl.getBoundingClientRect().height||720;
    function px(pct,dflt){
      return Math.max(1,ph*(pct==null?dflt:pct)/100).toFixed(2)+'px';
    }
    var w=pres.wmark;
    if(w&&String(w.text||'').trim()){
      var wm=document.createElement('div');
      wm.className='slide-wmark';
      wm.textContent=furnText(w.text,idx);
      /* sized in the page's own currency (percent of page height), so a
         watermark reads the same on a 16:9 slide and on an A0 poster */
      wm.style.fontSize=px(w.size,12);
      wm.style.opacity=(w.op==null?0.12:w.op);
      wm.style.transform='translate(-50%,-50%) rotate('
        +(w.rot==null?-28:w.rot)+'deg)';
      if(w.color) wm.style.color=w.color;
      /* BEHIND everything: a watermark that covers a figure is a mistake,
         not a design */
      slideEl.insertBefore(wm,slideEl.firstChild);
      /* CONFIDENTIAL at 12%% of an A4 page is wider than the page. Rather
         than wrap it (a two-line watermark reads as a paragraph) or clip
         it, shrink it to fit with a margin - so any word works at any
         page size without anyone having to tune the number. */
      var wr=wm.getBoundingClientRect(),pw2=slideEl.clientWidth*0.92;
      if(wr.width>pw2&&wr.width>0){
        var k=pw2/wr.width;
        wm.style.transform+=' scale('+k.toFixed(3)+')';
      }
    }
    [['head','slide-head'],['foot','slide-foot']].forEach(function(f){
      var v=pres[f[0]];
      if(!v||!String(v.text||'').trim()) return;
      /* the first slide is usually a title slide and usually wants
         neither of them */
      if(v.skipFirst&&idx===0) return;
      var el=document.createElement('div');
      el.className=f[1];
      el.textContent=furnText(v.text,idx);
      el.style.fontSize=px(v.size,2);
      if(v.align) el.style.textAlign=v.align;
      if(v.color) el.style.color=v.color;
      slideEl.appendChild(el);
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
          /* Alt+click blows the thing under the pointer up instead of
             advancing. A plain click MUST still advance - that is the
             gesture a talk runs on and it cannot be overloaded
             (2026-08-20). */
          if(e.altKey){
            var tg=spotTarget(e);
            if(tg){e.stopPropagation();spotlight(tg);return;}
          }
          if(spotEl){closeSpot();return;}
          /* TAP AN ITEM TO ENLARGE IT (2026-08-22, user: "clicking
             figures/text makes full screen"). This is in tension with a
             standing instruction — "a plain click MUST still advance,
             that is the gesture a talk runs on" (2026-08-20) — so it is
             a per-deck SETTING, and the two are reconciled by only
             claiming the item itself: the rest of the slide, which is
             most of it, still advances on a plain click. Off puts the
             old behaviour back exactly. */
          if(pres.tapzoom){
            var tz=e.target.closest&&e.target.closest('.an-item');
            if(tz&&!tz.classList.contains('an-prebuild')){
              e.stopPropagation();spotlight(tz);return;}
          }
          advance();
        });
      }
      paintFurniture(slideEl,cur);
      if(pres.showNums){
        var pn=document.createElement('div');
        pn.className='slide-pageno';
        pn.textContent=(cur+1);
        slideEl.appendChild(pn);
      }
    }
    renderSelPane();   /* keep the Objects pane on the CURRENT slide */
    renderNotesPane(); /* ...and the notes, which are per slide */
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
    var moreBuilds=(mode==='view'&&s&&revealCount<slideStops(s));
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
  var FONTMAP={},FONTPPT={},FONTLAB={};
  FONTS.forEach(function(f){FONTMAP[f.id]=f.css;FONTPPT[f.id]=f.ppt;
    FONTLAB[f.id]=f.label;});
  /* the third thing a font id turns into: WORDS. A custom family is
     typed in by hand and is not in the table, so it answers with itself
     — which is exactly what the picker shows for it too. */
  function fontLabel(v){
    if(!v) return 'the default typeface';
    return FONTLAB[v]||String(v);
  }
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
  /* set for the one showFmt that follows a fresh draw — see startDraw */
  var justDrew=false;
  /* selSet = every item in the current selection (a group, or a shift-click
     multi-select); selAnnot is the primary one that drives the format bar */
  var selSet=[];
  /* Which group you have STEPPED INTO, PowerPoint-style. Normally clicking
     any member selects the whole group; double-click a group and you are
     inside it, and clicks select one member at a time until you leave
     (Esc, or clicking away). Without this there was no way to touch a
     single item inside a group at all (2026-08-20, user: "You also can't
     select multiple items in a group like you can in powerpoint to
     modify"). */
  var inGroup=null;
  function leaveGroup(layer){
    if(inGroup===null) return;
    inGroup=null;
    if(layer) paintSel(layer);
  }
  function groupMembers(s,idx){
    if(!s||typeof idx!=='number') return [idx];
    var a=(s.annots||[])[idx];
    if(!a||a.grp==null) return [idx];
    /* inside this group, an item is just an item */
    if(inGroup!=null&&a.grp===inGroup) return [idx];
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
  /* ---- THE FLIP BOOK ---------------------------------------------------
     (2026-08-22, user: "people create figures with small additions and then
     need to create layers of figures or heaps of new slides each with a new
     figure ... something like a flip book or photo deck where you can add
     heaps of figures to and then click arrows to scroll through".)

     One item holding an ordered list of FRAMES — each a notebook card or an
     image — of which exactly one shows at a time. That is the whole idea:
     a figure built up in six steps is ONE box on ONE slide, not six
     overlaid pictures with appear-animations, and not six duplicated
     slides whose surrounding text you then have to keep in step by hand.

     Other items on the slide TIE themselves to a frame (a.fb / a.fbf /
     a.fbm), so a caption can belong to figure 3 and either vanish with it
     or stay up once it has appeared. And because the deck knows which
     items belong to which frame, the exporter can do the duplication for
     you: one flip book of six frames becomes six real slides in .pptx and
     six pages in the PDF. The flip book is the authoring form; the pile of
     slides is only ever the delivery form.

     THE FRAME IS DERIVED, NEVER STORED, during playback. A slide already
     has exactly one playback cursor (revealCount) and a second piece of
     state beside it would be a second thing to keep in step — which is the
     bug this whole feature exists to stop people hand-doing. `a.at` is the
     editor's cursor only. */
  var flipSeq=0,flipForce=null;
  function flipId(){
    /* opaque and stable, like a.grp: a binding cannot be keyed on an array
       index, because every reorder, delete, duplicate and paste in this
       file splices s.annots and would silently re-point it at a stranger */
    flipSeq++;
    return 'k'+Date.now().toString(36)+flipSeq.toString(36);
  }
  function flipFrames(a){
    return (a&&Array.isArray(a.frames))?a.frames:[];
  }
  function flipsOn(s){
    var out=[];
    ((s&&s.annots)||[]).forEach(function(a,i){
      if(a&&a.k==='flip') out.push({a:a,i:i});});
    return out;
  }
  function flipById(s,id){
    var hit=null;
    flipsOn(s).forEach(function(p){if(!hit&&p.a.fid===id) hit=p.a;});
    return hit;
  }
  /* the extra playback stops this slide's flip books contribute: one per
     frame AFTER the first, because the first is what the slide opens on */
  function flipStops(s){
    var n=0;
    flipsOn(s).forEach(function(p){
      n+=Math.max(0,flipFrames(p.a).length-1);});
    return n;
  }
  /* every stop on a slide: the builds first, then the frames.
     Builds first because a build is usually the heading or the frame
     itself arriving, and the figure walking through its steps is what you
     then talk over — putting the frames first would make a title animate
     in after the picture had already finished. */
  function slideStops(s){
    return slideBuildSteps(s).count+flipStops(s);
  }
  /* which frame this flip book is showing right now. In the editor that is
     wherever you left its arrows; in playback it is read off revealCount,
     with each flip book on the slide consuming its own frames in reading
     order. */
  function flipAtNow(s,a){
    var fr=flipFrames(a),last=Math.max(0,fr.length-1);
    /* an exporting page is FOR one frame, and says so. It wins over both
       the editor cursor and the playback one, because printing sets
       mode='view' and revealCount=99999 to mean "fully built" and would
       otherwise put every page on the last frame. */
    if(flipForce!=null){
      var first=flipsOn(s)[0];
      if(first&&first.a===a)
        return Math.max(0,Math.min(last,flipForce));
      return Math.max(0,Math.min(last,a.at||0));
    }
    if(mode!=='view') return Math.max(0,Math.min(last,a.at||0));
    var left=Math.max(0,revealCount-slideBuildSteps(s).count),hit=0;
    flipsOn(s).forEach(function(p){
      var span=Math.max(0,flipFrames(p.a).length-1);
      var take=Math.min(span,left);
      if(p.a===a) hit=take;
      left-=take;
    });
    return hit;
  }
  /* is this item's frame the one showing? An item with no binding always
     shows, and — deliberately — so does one whose flip book has been
     deleted or whose frame no longer exists. An item that silently becomes
     invisible forever is the worst thing this feature could do, so every
     unresolvable binding fails OPEN. */
  function flipShowsFrame(s,a,at){
    if(!a||!a.fb) return true;
    var fb=flipById(s,a.fb); if(!fb) return true;
    var fr=flipFrames(fb); if(!fr.length) return true;
    var f=a.fbf||0; if(f>=fr.length) return true;
    var m=a.fbm||'only';
    if(m==='from') return at>=f;      /* appears here and stays up */
    if(m==='until') return at<=f;     /* here and everything before it */
    return at===f;                    /* just this one */
  }
  /* the same question against the frame showing NOW. Split from the above
     because the exporter has to ask it about a frame that is not the one
     on screen — that is what lets one flip book become several pages. */
  function flipShows(s,a){
    if(!a||!a.fb) return true;
    var fb=flipById(s,a.fb); if(!fb) return true;
    return flipShowsFrame(s,a,flipAtNow(s,fb));
  }
  var FLIP_MODES=[['only','Just this figure'],
    ['from','This figure and every one after'],
    ['until','This figure and every one before']];
  /* step a flip book's arrows. In playback the frames ARE stops in the one
     playback sequence, so an arrow moves the talk — otherwise the arrow
     and the space bar would disagree about where you are. */
  function flipStep(idx,d){
    var s=pres.slides[cur],a=((s&&s.annots)||[])[idx];
    if(!a||a.k!=='flip') return;
    var fr=flipFrames(a);
    if(fr.length<2) return;
    if(mode==='view'){
      var before=0;
      flipsOn(s).forEach(function(p){
        if(p.i<idx) before+=Math.max(0,flipFrames(p.a).length-1);});
      var lo=slideBuildSteps(s).count+before,hi=lo+fr.length-1;
      revealCount=Math.max(lo,Math.min(hi,revealCount+d));
      renderSlide();presenterSync();
      return;
    }
    a.at=Math.max(0,Math.min(fr.length-1,(a.at||0)+d));
    /* markDirty(true): flipping through your own figures to look at them
       is not an edit and must not fill the undo stack */
    markDirty(true);renderSlide();renderFlipPane();
  }
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
    /* annotLabel's ladder in miniature: these rows are narrower than the
       Objects pane's, so text and cell titles truncate shorter and the
       wording is terser (and, unlike there, a name wins for cells too).
       The why-a-name-wins comment lives on annotLabel. */
    if(a.k==='text') return (a.text||'').trim().slice(0,16)||'Text';
    if(a.name) return a.name;
    if(a.k==='rect') return (a.shape?a.shape:'Shape');
    if(a.k==='cell'){var it=a.ref&&resolveRef(a.ref);
      return it&&it.title?it.title.slice(0,18):'Cell';}
    if(a.k==='image'||a.k==='flip'||a.k==='table'
       ||a.k==='arrow'||a.k==='draw') return annotLabel(a);
    return 'item';
  }
  function paintSel(layer){
    var multi=selSet.length>1;
    var s0=pres.slides[cur];
    $$('[data-idx]',layer).forEach(function(el){
      var raw=el.getAttribute('data-idx');
      var key=(raw==='t'||raw==='s')?raw:+raw;
      var on=selSet.indexOf(key)>=0;
      el.classList.toggle('sel',on);
      el.classList.toggle('grpsel',on&&multi);
      /* the group you have stepped into is outlined as a whole, so it is
         obvious that clicks are landing on members and not on the group */
      var ga=(typeof key==='number'&&s0)?(s0.annots||[])[key]:null;
      el.classList.toggle('an-ingrp',
        inGroup!=null&&!!ga&&ga.grp===inGroup);
    });
  }
  var pendingShape='rect';   /* which shape the "+ Shapes" tool draws */
  /* which named type the next text box is born wearing, '' for a plain
     one. Module-local like pendingShape and for the same reason: a type
     that stuck across reloads would have you making headings by accident
     because of something you clicked last week (2026-08-22). */
  var pendingStyle='';
  /* every text box drawn on the canvas is born here. Factored out of
     startDraw so the armed type has ONE place to be honoured: a user who
     never opens the caret gets a byte-identical annot, because
     applyStyleTo is not called at all unless a type is armed and
     resolves.
     Deliberately NOT honoured elsewhere: the equation commit (an equation
     is maths, not a heading), applyLayout and the slide templates (a
     template already says what its boxes are), and paste (a pasted box
     keeps what it was copied as). */
  function textBorn(p0){
    var a={k:'text',x:p0.x,y:p0.y,w:0,h:0,text:'',size:2.6,bg:0};
    if(pendingStyle&&styleDef(pendingStyle)) applyStyleTo(a,pendingStyle);
    return a;
  }
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
  /* ---- TEXT STYLES ----------------------------------------------------
     A named look a text box can WEAR rather than a set of properties it
     has to carry. A box records `a.style` and nothing else; the numbers
     come from pres.styles, which means restyling every heading in a deck
     is one edit to one object instead of a hunt through forty slides
     (2026-08-20, user asked for "all the different heading styles that
     you can have" and "some things like 'apply style to all headings'").
     The defaults are a type SCALE, not seven arbitrary sizes: each step
     is about 1.3x the one below, which is what makes a deck look like it
     was designed rather than assembled. Sizes are percent of page height,
     the same currency a.size already uses, so a style means the same
     thing on a 16:9 slide and on an A0 poster.
     An override still wins: colour a styled heading red and it stays red,
     because a.color is read after the style is applied. That is the whole
     contract - a style sets, it does not lock. */
  var STYLE_DEFAULTS={
    title:  {label:'Title',      size:7.2, b:1},
    h1:     {label:'Heading 1',  size:5.0, b:1},
    h2:     {label:'Heading 2',  size:3.8, b:1},
    h3:     {label:'Heading 3',  size:3.0, b:1},
    body:   {label:'Body',       size:2.6},
    small:  {label:'Small',      size:2.0},
    caption:{label:'Caption',    size:1.7, i:1, color:'#8aa0b0'}
  };
  var STYLE_ORDER=['title','h1','h2','h3','body','small','caption'];
  /* the HEADING styles, for "apply to all headings" */
  var HEADING_STYLES=['title','h1','h2','h3'];
  /* ---- STYLE SETS ------------------------------------------------------
     (2026-08-22, user: "it would be good if you could auto-style a
     presentation ... you could have set-defaults of what paragraphs,
     headings etc. look like, instead of having to go through and do
     everything yourself ... styles that are already in existence that
     people would like, and you can create your own".)

     A style set is the whole type registry in one named object — every
     style's size, weight, face and colour together. `pres.styles` already
     IS that object, so applying a set is one assignment and one
     re-stamp, and saving one is a copy. There is no new model here at
     all, which is the point: the registry was built for this and just had
     no way to be named or shared.

     Called a STYLE SET and not a theme deliberately: "Theme" in this app
     is already the chrome's colour scheme (app.js SCHEMES), and two
     things called the same word one bar apart is how a menu stops being
     readable. Word uses "style set" for exactly this and means exactly
     this.

     Sizes are percentages of page height, the same currency a.size uses,
     so a set means the same thing on a 16:9 slide and on an A0 poster. */
  var STYLE_SETS=[
    {id:'clean',label:'Clean',
     note:'Sans throughout, the built-in scale. A safe default.',
     styles:{
       title:{size:7.2,b:1},h1:{size:5.0,b:1},h2:{size:3.8,b:1},
       h3:{size:3.0,b:1},body:{size:2.6},small:{size:2.0},
       caption:{size:1.7,i:1,color:'#8aa0b0'}}},
    {id:'editorial',label:'Editorial',
     note:'Serif headings over a sans body, and room to breathe.',
     styles:{
       title:{size:7.6,b:1,font:'serif'},
       h1:{size:5.2,b:1,font:'serif'},
       h2:{size:3.9,b:1,font:'serif'},
       h3:{size:3.0,b:0,i:1,font:'serif'},
       body:{size:2.5,lh:1.5},small:{size:1.95,lh:1.4},
       caption:{size:1.6,i:1,font:'serif',color:'#9aa8b4'}}},
    {id:'bold',label:'Bold',
     note:'Heavy sans and big titles — for a room at the back.',
     styles:{
       title:{size:9.0,b:1},h1:{size:6.2,b:1},h2:{size:4.4,b:1},
       h3:{size:3.3,b:1},body:{size:3.0,b:0},small:{size:2.3},
       caption:{size:1.9,b:1,color:'#7f93a4'}}},
    {id:'academic',label:'Academic',
     note:'Serif everywhere, modest sizes, generous leading.',
     styles:{
       title:{size:6.4,b:1,font:'serif'},
       h1:{size:4.4,b:1,font:'serif'},
       h2:{size:3.4,b:1,font:'serif'},
       h3:{size:2.8,b:0,i:1,font:'serif'},
       body:{size:2.4,font:'serif',lh:1.5,pspace:0.5},
       small:{size:1.9,font:'serif',lh:1.4},
       caption:{size:1.6,i:1,font:'serif',color:'#93a3b0'}}},
    {id:'minimal',label:'Minimal',
     note:'Light weights and small headings. Lets the figures talk.',
     styles:{
       title:{size:5.6},h1:{size:4.0},h2:{size:3.1},h3:{size:2.6},
       body:{size:2.4,lh:1.55},small:{size:1.9,lh:1.45},
       caption:{size:1.55,color:'#8aa0b0'}}},
    {id:'poster',label:'Poster',
     note:'Sized for a printed sheet read from a metre away.',
     styles:{
       title:{size:4.6,b:1},h1:{size:3.2,b:1},h2:{size:2.5,b:1},
       h3:{size:2.1,b:1},body:{size:1.7},small:{size:1.45},
       caption:{size:1.25,i:1,color:'#8aa0b0'}}}
  ];
  /* sets you saved yourself live in localStorage rather than on the deck:
     the whole point of naming a look is using it on the NEXT presentation
     too, and anything on `pres` travels with one file only. */
  var SETKEY='jv-deck-sets:';
  function myStyleSets(){
    try{
      var l=JSON.parse(lsGet(SETKEY+SCOPE)||'[]');
      return Array.isArray(l)?l:[];
    }catch(e){return [];}
  }
  function saveMyStyleSets(list){
    lsSet(SETKEY+SCOPE,JSON.stringify(list));
  }
  function allStyleSets(){
    return STYLE_SETS.concat(myStyleSets());
  }
  function styleSetById(id){
    var hit=null;
    allStyleSets().forEach(function(t){if(t&&t.id===id) hit=t;});
    return hit;
  }
  /* apply a set: replace the registry and re-stamp every box wearing a
     name. Custom TYPES are kept — they are your vocabulary, not the
     look — and a set that says nothing about one keeps whatever it had. */
  function applyStyleSet(id){
    var t=styleSetById(id); if(!t) return 0;
    var next={};
    Object.keys(t.styles||{}).forEach(function(k){
      var o=deep(t.styles[k]);
      if(STYLE_DEFAULTS[k]) o.label=STYLE_DEFAULTS[k].label;
      /* SPELL OUT the properties the set does NOT want. styleDef merges an
         override OVER the built-in, so a key the set simply omits keeps
         whatever the built-in said — which meant "Bold", whose caption is
         upright, still produced italic captions, because the built-in
         Caption is italic (2026-08-22, caught in the browser). Writing a
         falsy value makes applyStyleTo's `if(d.i) … else delete` clear it,
         so a set means exactly what it says and nothing more. */
      ['b','i','font','color','lh','pspace'].forEach(function(p){
        if(o[p]===undefined) o[p]=0;});
      next[k]=o;
    });
    /* a custom type keeps the size it had unless the set names it, so
       applying a set does not silently flatten types you invented */
    (pres.types||[]).forEach(function(ct){
      if(ct&&ct.id&&!next[ct.id]&&pres.styles&&pres.styles[ct.id])
        next[ct.id]=pres.styles[ct.id];
    });
    pres.styles=next;
    return restyleAll(null);
  }
  /* ---- AUTO-STYLE ------------------------------------------------------
     The half that matters. Most decks have never used a named style, so
     applying a set to one changes NOTHING — there is nothing wearing a
     name to re-stamp. So the boxes are named first, by what they already
     look like, using the bands the standardise check already computes.

     This is the opposite of stdAdopt, deliberately. Adopting a band keeps
     the band's own numbers so nothing moves; auto-styling REPLACES them,
     because moving is the entire request ("instead of having to go
     through and do everything yourself"). */
  function autoStyleDeck(id){
    var t=styleSetById(id); if(!t) return null;
    var boxes=stdBoxes().filter(function(p){
      return !(p.a.style&&STYLE_DEFAULTS[p.a.style]);});
    var named=0;
    if(boxes.length){
      var bands=stdName(stdBands(boxes));
      bands.forEach(function(b){
        b.boxes.forEach(function(p){
          p.a.style=b.suggest;named++;});
      });
    }
    var n=applyStyleSet(id);
    return {named:named,styled:n,set:t};
  }
  /* ---- TYPES OF YOUR OWN ----------------------------------------------
     The seven built-ins are a type SCALE, not a vocabulary. A deck that
     wants a "Quote" or a "Source note" had nowhere to put one, so those
     boxes got formatted by hand and then drifted apart across forty
     slides - which is the exact problem named styles exist to stop
     (2026-08-22, user: "it would be cool if people could create their own
     types and change the defaults of these").

     A custom type is a full definition living on pres.types, and
     syncCustomTypes() GRAFTS it into STYLE_DEFAULTS at load. That is
     deliberate rather than lazy: four places index STYLE_DEFAULTS[id]
     directly, and every menu, every specimen row, applyStyleTo and the
     exporters all read the registry without ever asking whether an id is
     built in. One live registry fixes all of them at once and changes
     none of them.

     It is an ARRAY, not a map, because the ORDER is the feature - a type
     scale reads top to bottom. And it is a SEPARATE key from pres.styles
     because the style manager's reset does `delete pres.styles`: "back to
     the built-in sizes" must never mean "throw away the types I made". */
  var BUILTIN_STYLE_IDS=STYLE_ORDER.slice();
  function customTypes(){
    if(!Array.isArray(pres.types)) pres.types=[];
    return pres.types;
  }
  /* rebuild STYLE_DEFAULTS from the built-ins plus THIS deck's types.
     It has to run on every path that installs a new `pres`, or deck A's
     types leak into deck B - which is why it is the first thing
     histReset() does, that being the one funnel every new presentation
     passes through. */
  function syncCustomTypes(){
    /* Impossible by construction since 2026-08-23: the first
       presentation loads from THE BOOT SEQUENCE at the end of the file,
       after STYLE_DEFAULTS is assigned, so this guard never fires. It
       stays as a pure bail-out in case a future caller runs earlier —
       the incident record at the boot sequence says why it existed. */
    if(!STYLE_DEFAULTS) return;
    Object.keys(STYLE_DEFAULTS).forEach(function(id){
      if(BUILTIN_STYLE_IDS.indexOf(id)<0) delete STYLE_DEFAULTS[id];
    });
    (Array.isArray(pres&&pres.types)?pres.types:[]).forEach(function(t){
      if(!t||!t.id||BUILTIN_STYLE_IDS.indexOf(t.id)>=0) return;
      var d={label:String(t.label||'Style'),
        size:(typeof t.size==='number'&&t.size>0)?t.size:2.6};
      ['b','i','font','color','align','lh','pspace','head']
        .forEach(function(k){if(t[k]!==undefined) d[k]=t[k];});
      STYLE_DEFAULTS[t.id]=d;
    });
  }
  /* the order the menus walk: the built-in scale first, then yours, in
     the order you made them. STYLE_ORDER itself stays exactly as it was -
     it is the built-in list, and BUILTIN_STYLE_IDS is taken from it. */
  function styleOrder(){
    var out=STYLE_ORDER.slice();
    (Array.isArray(pres&&pres.types)?pres.types:[]).forEach(function(t){
      if(t&&t.id&&out.indexOf(t.id)<0&&STYLE_DEFAULTS[t.id]) out.push(t.id);
    });
    return out;
  }
  /* "is this a heading" stopped being a fixed list of four the moment you
     could invent a type: your "Section label" probably is one and your
     "Pull quote" is not, and only you can say. The built-ins keep their
     answer, so nothing that worked yesterday changes. */
  function isHeadingStyle(id){
    if(HEADING_STYLES.indexOf(id)>=0) return true;
    var d=STYLE_DEFAULTS[id];
    return !!(d&&d.head);
  }
  function headingStyles(){
    return styleOrder().filter(isHeadingStyle);
  }
  /* an id must never collide with a built-in: a deck file naming its own
     type "h1" would silently redefine Heading 1 for everyone who opened
     it. Minted from a counter rather than from the label, so RENAMING a
     type does not orphan every box wearing it. */
  function mintTypeId(){
    var n=1,ids={};
    customTypes().forEach(function(t){if(t&&t.id) ids[t.id]=1;});
    while(ids['t'+n]||BUILTIN_STYLE_IDS.indexOf('t'+n)>=0) n++;
    return 't'+n;
  }
  function addCustomType(label,base){
    var b=styleDef(base)||STYLE_DEFAULTS.body;
    var t={id:mintTypeId(),label:String(label||'My style'),size:b.size};
    ['b','i','font','color','align','lh','pspace']
      .forEach(function(k){if(b[k]!==undefined) t[k]=b[k];});
    customTypes().push(t);
    syncCustomTypes();
    return t;
  }
  /* deleting a type must not MOVE anything. applyStyleTo has already
     written every one of its properties onto each box, so dropping the
     NAME leaves the slides looking exactly as they did - the boxes just
     stop being a group. Re-stamping them to Body instead would resize
     half the deck as a punishment for tidying up.
     Guarded on a.k==='text' because a.style on a line or an arrow is the
     DASH style (lineStyle, above) and shares nothing with this but the
     word. */
  function deleteCustomType(id){
    if(BUILTIN_STYLE_IDS.indexOf(id)>=0) return 0;
    var n=0;
    (pres.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(a&&a.k==='text'&&a.style===id){delete a.style;n++;}
      });
    });
    var list=customTypes();
    for(var i=list.length-1;i>=0;i--)
      if(list[i]&&list[i].id===id) list.splice(i,1);
    if(pres.styles) delete pres.styles[id];
    syncCustomTypes();
    return n;
  }
  function deckStyles(){
    if(!pres.styles) pres.styles={};
    return pres.styles;
  }
  function styleDef(id){
    var d=STYLE_DEFAULTS[id];
    if(!d) return null;
    var over=deckStyles()[id]||{};
    var out={};
    Object.keys(d).forEach(function(k){out[k]=d[k];});
    Object.keys(over).forEach(function(k){out[k]=over[k];});
    return out;
  }
  /* stamp a style's properties onto an item. This WRITES them rather than
     resolving at render time, deliberately: every export, the pptx
     converter and the thumbnails already read a.size / a.b / a.color, and
     teaching all five of them about styles would be five places to get it
     wrong. a.style is kept so "apply to all headings" can find them. */
  function applyStyleTo(a,id){
    var d=styleDef(id); if(!a||!d) return;
    a.style=id;
    a.size=d.size;
    if(d.b) a.b=1; else delete a.b;
    if(d.i) a.i=1; else delete a.i;
    if(d.font) a.font=d.font; else delete a.font;
    if(d.color) a.color=d.color; else delete a.color;
    if(d.align) a.align=d.align;
    if(d.lh) a.lh=d.lh; else delete a.lh;
    if(d.pspace) a.pspace=d.pspace; else delete a.pspace;
  }
  /* ---- SPEAKER NOTES + TIMING ------------------------------------------
     Notes are per slide and are never drawn on the page: they exist for
     the presenter view and for you (2026-08-20, user asked for "the other
     [screen] with like notes and the next slide"). The per-slide GOAL is
     in minutes, and the pane adds them up so a talk that cannot fit in
     its slot says so before you give it, not during. */
  function slideGoal(sl){
    return (sl&&typeof sl.goal==='number'&&sl.goal>0)?sl.goal:0;
  }
  function goalTotal(){
    var t=0;
    (pres.slides||[]).forEach(function(sl){t+=slideGoal(sl);});
    return t;
  }
  function fmtMins(m){
    var sec=Math.round(m*60);
    var mm=Math.floor(sec/60),ss=sec%60;
    return mm+':'+(ss<10?'0':'')+ss;
  }
  /* ---- THE SCRATCHPAD --------------------------------------------------
     Loose notes, in folders, belonging to the presentation rather than to
     any one slide (2026-08-20, user asked for "overall notes, and then
     also notes per slide, and make little notes and folders of notes").
     It is the place to put a thought without first deciding where it goes
     - which is the entire reason people keep a text file open beside
     their deck. Stored on pres.pad, so it travels with the file. */
  function padList(){
    if(!Array.isArray(pres.pad)) pres.pad=[];
    return pres.pad;
  }
  function renderPad(){
    var host=$('#np-padlist'); if(!host) return;
    host.innerHTML='';
    var items=padList();
    if(!items.length){
      host.innerHTML='<div class="selpane-empty">Nothing here yet. '
        +'Notes you put here belong to the talk, not to a slide.</div>';
      return;
    }
    /* folders first, each with the notes filed under it, then the loose
       ones - the same shape the Layers pane uses for groups */
    var folders=items.filter(function(n){return n.t==='f';});
    function noteRow(n,i){
      var row=document.createElement('div');row.className='np-note';
      var head=document.createElement('div');head.className='np-nhead';
      var ttl=document.createElement('input');
      ttl.className='np-ntitle';ttl.type='text';
      ttl.value=n.title||'';ttl.placeholder='untitled note';
      ttl.addEventListener('keydown',function(e){e.stopPropagation();});
      ttl.addEventListener('input',function(){
        n.title=ttl.value;markDirty();});
      head.appendChild(ttl);
      if(folders.length){
        var sel=document.createElement('select');
        sel.className='np-nfold';
        var o0=document.createElement('option');
        o0.value='';o0.textContent='(loose)';sel.appendChild(o0);
        folders.forEach(function(f){
          var o=document.createElement('option');
          o.value=f.id;o.textContent=f.title||'folder';
          sel.appendChild(o);});
        sel.value=n.folder||'';
        sel.title='Which folder this note is filed under';
        sel.addEventListener('change',function(){
          if(sel.value) n.folder=sel.value; else delete n.folder;
          markDirty();renderPad();});
        head.appendChild(sel);
      }
      var x=document.createElement('button');
      x.className='dbtn dc-icon np-nx';x.innerHTML=bic('exit');
      x.title='Delete this note';
      x.addEventListener('click',function(){
        var at=padList().indexOf(n);
        if(at>=0) padList().splice(at,1);
        markDirty();renderPad();});
      head.appendChild(x);
      row.appendChild(head);
      var body=document.createElement('textarea');
      body.className='np-nbody';body.value=n.body||'';
      body.placeholder='…';
      body.addEventListener('keydown',function(e){e.stopPropagation();});
      body.addEventListener('input',function(){
        n.body=body.value;markDirty();});
      row.appendChild(body);
      return row;
    }
    folders.forEach(function(f){
      var box=document.createElement('div');box.className='np-fold';
      var fh=document.createElement('div');fh.className='np-fhead';
      var ft=document.createElement('input');
      ft.className='np-ftitle';ft.type='text';
      ft.value=f.title||'';ft.placeholder='folder name';
      ft.addEventListener('keydown',function(e){e.stopPropagation();});
      ft.addEventListener('input',function(){
        f.title=ft.value;markDirty();});
      fh.appendChild(ft);
      var fx=document.createElement('button');
      fx.className='dbtn dc-icon np-nx';fx.innerHTML=bic('exit');
      fx.title='Delete the folder — its notes become loose';
      fx.addEventListener('click',function(){
        padList().forEach(function(n){
          if(n.folder===f.id) delete n.folder;});
        var at=padList().indexOf(f);
        if(at>=0) padList().splice(at,1);
        markDirty();renderPad();});
      fh.appendChild(fx);
      box.appendChild(fh);
      var any=false;
      items.forEach(function(n,i){
        if(n.t==='f'||n.folder!==f.id) return;
        any=true;box.appendChild(noteRow(n,i));});
      if(!any){
        var e2=document.createElement('div');
        e2.className='selpane-empty';e2.textContent='empty';
        box.appendChild(e2);
      }
      host.appendChild(box);
    });
    items.forEach(function(n,i){
      if(n.t==='f'||n.folder) return;
      host.appendChild(noteRow(n,i));});
  }
  function renderNotesPane(){
    var pane=$('#notespane');
    if(!pane||pane.hidden) return;
    var sl=pres.slides[cur];
    var ta=$('#np-notes'),gi=$('#np-goal'),ti=$('#np-total'),
        tot=$('#np-tot');
    if(ta&&document.activeElement!==ta) ta.value=(sl&&sl.notes)||'';
    if(gi&&document.activeElement!==gi)
      gi.value=slideGoal(sl)||'';
    if(ti&&document.activeElement!==ti)
      ti.value=pres.talkMins||'';
    var dn=$('#np-decknotes');
    if(dn&&document.activeElement!==dn) dn.value=pres.notes||'';
    renderPad();
    if(tot){
      var g=goalTotal(),want=pres.talkMins||0;
      if(!g&&!want) tot.textContent='';
      else {
        var n=(pres.slides||[]).filter(function(x){
          return slideGoal(x);}).length;
        var txt=n+' slide'+(n===1?'':'s')+' timed \u2014 '
          +fmtMins(g)+' total';
        if(want){
          var d=g-want;
          txt+=d>0.008?(', which is '+fmtMins(d)+' OVER your '
              +want+' minutes')
            :d<-0.008?(', leaving '+fmtMins(-d)+' of your '
              +want+' minutes')
            :', exactly your slot';
        }
        tot.textContent=txt;
        tot.classList.toggle('over',!!want&&g-want>0.008);
      }
    }
  }
  (function(){
    var btn=$('#notes-btn'),pane=$('#notespane');
    if(!btn||!pane) return;
    function set(open){
      if(open){
        /* the panes share one corner: only one can be what you are
           looking at, the rule showVerpane has always kept */
        ['#selpane','#animpane','#preflight'].forEach(function(sel){
          var o=$(sel); if(o) o.hidden=true;});
        var ob=$('#objects-btn');
        if(ob) ob.setAttribute('aria-pressed','false');
        showVerpane(false);
      }
      pane.hidden=!open;
      btn.setAttribute('aria-pressed',open.toString());
      if(open) renderNotesPane();
    }
    btn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    var cl=$('#notespane-close');
    if(cl) cl.addEventListener('click',function(){set(false);});
    var ta=$('#np-notes');
    if(ta){
      ta.addEventListener('keydown',function(e){e.stopPropagation();});
      ta.addEventListener('input',function(){
        var sl=pres.slides[cur]; if(!sl) return;
        var v=ta.value;
        if(v.trim()) sl.notes=v; else delete sl.notes;
        markDirty();presenterPush();
      });
    }
    var gi=$('#np-goal');
    if(gi){
      gi.addEventListener('keydown',function(e){e.stopPropagation();});
      gi.addEventListener('input',function(){
        var sl=pres.slides[cur]; if(!sl) return;
        var v=parseFloat(gi.value);
        if(v>0) sl.goal=v; else delete sl.goal;
        markDirty();renderNotesPane();presenterPush();
      });
    }
    var gc=$('#np-goalclear');
    if(gc) gc.addEventListener('click',function(){
      var sl=pres.slides[cur]; if(!sl) return;
      delete sl.goal;markDirty();renderNotesPane();presenterPush();
    });
    var ti=$('#np-total');
    if(ti){
      ti.addEventListener('keydown',function(e){e.stopPropagation();});
      ti.addEventListener('input',function(){
        var v=parseFloat(ti.value);
        if(v>0) pres.talkMins=v; else delete pres.talkMins;
        markDirty();renderNotesPane();presenterPush();
      });
    }
    /* three kinds of note, one pane: this slide, the whole talk, and a
       scratchpad that belongs to neither (2026-08-20) */
    $$('#np-tabs .np-tab').forEach(function(t){
      t.addEventListener('click',function(){
        $$('#np-tabs .np-tab').forEach(function(o){
          o.classList.toggle('on',o===t);});
        var which=t.dataset.np;
        var b1=$('#notespane-body'),b2=$('#notespane-deck'),
            b3=$('#notespane-pad');
        if(b1) b1.hidden=(which!=='slide');
        if(b2) b2.hidden=(which!=='deck');
        if(b3) b3.hidden=(which!=='pad');
        if(which==='pad') renderPad();
      });
    });
    var dn=$('#np-decknotes');
    if(dn){
      dn.addEventListener('keydown',function(e){e.stopPropagation();});
      dn.addEventListener('input',function(){
        if(dn.value.trim()) pres.notes=dn.value; else delete pres.notes;
        markDirty();
      });
    }
    var an=$('#np-addnote');
    if(an) an.addEventListener('click',function(){
      padList().push({t:'n',id:'n'+padList().length+'-'+Math.floor(
        performance.now()),title:'',body:''});
      markDirty();renderPad();
    });
    var af=$('#np-addfold');
    if(af) af.addEventListener('click',function(){
      padList().push({t:'f',id:'f'+padList().length+'-'+Math.floor(
        performance.now()),title:'New folder'});
      markDirty();renderPad();
    });
    window.SemDeckNotes=function(){set(true);};
  })();
  /* ---- THE STYLE MANAGER ----------------------------------------------
     The deck's type, editable without selecting anything. Until now a
     style could only be changed by formatting one box and pushing its
     look outwards, which meant you had to have a box of that style on the
     slide you happened to be on (2026-08-20).
     Re-stamping is explicit rather than automatic: applyStyleTo WRITES a
     style's properties onto an item, so changing the registry does not
     move anything until something walks the deck and says so. */
  /* `scope` is an array of slide indexes, or null/omitted for the whole
     deck. It exists so the Apply dialog can restyle a chosen run of
     slides; the four callers that came first pass one argument and get
     exactly the behaviour they always had. */
  function restyleAll(ids,scope){
    var n=0;
    (pres.slides||[]).forEach(function(sl,si){
      if(scope&&scope.indexOf(si)<0) return;
      (sl.annots||[]).forEach(function(a){
        if(a&&a.k==='text'&&a.style&&(!ids||ids.indexOf(a.style)>=0)){
          applyStyleTo(a,a.style);n++;
        }
      });
    });
    markDirty();refresh();
    return n;
  }
  /* every style one step up or down, in proportion - the whole deck's
     type at once, which is the thing you actually want when a room turns
     out to be bigger than you expected */
  function scaleStyles(k){
    styleOrder().forEach(function(id){
      var d=styleDef(id);
      var over=deckStyles()[id]||{};
      over.label=STYLE_DEFAULTS[id].label;
      over.size=Math.max(0.8,Math.min(24,
        Math.round(d.size*k*100)/100));
      ['b','i','font','color','align'].forEach(function(pr){
        if(d[pr]!==undefined) over[pr]=d[pr];});
      deckStyles()[id]=over;
    });
    var n=restyleAll(null);
    toast('Every text style '+(k>1?'bigger':'smaller')
      +' \u2014 '+n+' box'+(n===1?'':'es')+' followed');
  }
  (function(){
    var wrap=$('#dsg-stylewrap'),btn=$('#dsg-styles'),
        menu=$('#dsg-style-menu');
    if(!wrap||!btn||!menu) return;
    var openEdit='';   /* which row's arrow is open; one at a time */
    /* the expander behind one style's arrow. Everything here writes an
       OVERRIDE into pres.styles (or, for a rename, into the custom type
       itself) and then re-stamps the boxes wearing it — the registry
       never moves anything on its own, which is the contract
       applyStyleTo's comment sets out. */
    function styleEditor(id,d,build){
      var box=document.createElement('div');box.className='stm-edit';
      var custom=BUILTIN_STYLE_IDS.indexOf(id)<0;
      function over(){
        var o=deckStyles()[id]||{};
        /* carry the whole resolved definition, not just the one field
           being changed: styleDef merges the override OVER the base, so
           a partial override plus a later base change reads as a style
           that half-followed */
        o.label=d.label;o.size=d.size;
        ['b','i','font','color','align','lh','pspace','head']
          .forEach(function(k){
            if(d[k]!==undefined) o[k]=d[k]; else delete o[k];});
        deckStyles()[id]=o;
        return o;
      }
      function toggle(label,key,title){
        var b=document.createElement('button');
        b.className='dbtn stm-tg';b.textContent=label;
        b.setAttribute('aria-pressed',(!!d[key]).toString());
        b.title=title;
        b.addEventListener('click',function(e){
          e.stopPropagation();
          var o=over();
          if(d[key]) delete o[key]; else o[key]=1;
          restyleAll([id]);build();
        });
        return b;
      }
      var row=document.createElement('div');row.className='stm-erow';
      row.appendChild(toggle('B','b','Bold — everywhere in this deck'));
      row.appendChild(toggle('I','i','Italic — everywhere in this deck'));
      /* "counts as a heading" stopped being a fixed list of four the
         moment types could be invented: only you know whether your
         "Section label" is one */
      row.appendChild(toggle('¶ Heading','head',
        'Counts as a heading — for "apply to all headings", the outline '
        +'view and the standardise check'));
      box.appendChild(row);
      var ren=document.createElement('input');
      ren.className='stm-ren';ren.type='text';ren.value=d.label;
      ren.placeholder='name for this style';
      ren.title='What this style is called';
      ren.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter') ren.blur();
      });
      /* committed on blur, not per keystroke: a rename that fired on
         every letter would push a dozen undo steps and rebuild the menu
         under the caret (2026-08-20, the presentation-rename lesson) */
      ren.addEventListener('blur',function(){
        var v=ren.value.trim(); if(!v||v===d.label) return;
        if(custom) customTypes().forEach(function(t){
          if(t&&t.id===id) t.label=v;});
        var o=over();o.label=v;
        syncCustomTypes();markDirty();build();
      });
      box.appendChild(ren);
      var act=document.createElement('button');
      act.className='dbtn vw-opt stm-del';
      if(custom){
        act.innerHTML=bic('exit')+' Delete this style';
        act.title='The boxes wearing it keep exactly the look they have '
          +'— they just stop being a group';
        act.addEventListener('click',function(e){
          e.stopPropagation();
          var n=deleteCustomType(id);
          openEdit='';markDirty();build();
          toast('"'+d.label+'" removed — '+n+' box'+(n===1?'':'es')
            +' kept the look they had');
        });
      } else {
        act.innerHTML=bic('reset')+' Back to the built-in "'
          +esc(STYLE_DEFAULTS[id].label)+'"';
        act.title='Undo the changes made to this one style';
        act.disabled=!(pres.styles&&pres.styles[id]);
        act.addEventListener('click',function(e){
          e.stopPropagation();
          if(pres.styles) delete pres.styles[id];
          restyleAll([id]);build();
        });
      }
      box.appendChild(act);
      return box;
    }
    function build(){
      menu.innerHTML='';
      /* FIRST, above the individual styles: picking a whole look is the
         thing you do once at the start, and tuning one style is what you
         do afterwards. The old menu offered only the second (2026-08-22). */
      var sets=document.createElement('button');
      sets.className='dbtn vw-opt';
      sets.textContent='\u25f1 Style sets \u2014 restyle the whole deck\u2026';
      sets.title='Ready-made looks, and any you have saved. Works even '
        +'on a deck that has never used a named style.';
      sets.addEventListener('click',function(e){
        e.stopPropagation();menu.hidden=true;
        if(typeof window.SemDeckStyleSets==='function')
          window.SemDeckStyleSets();
      });
      menu.appendChild(sets);
      menuHead(menu,'this presentation\u2019s type');
      styleOrder().forEach(function(id){
        var d=styleDef(id);
        var row=document.createElement('div');row.className='stm-row';
        var spec=document.createElement('span');
        spec.className='stm-spec';spec.textContent=d.label;
        spec.style.fontWeight=d.b?'700':'400';
        if(d.i) spec.style.fontStyle='italic';
        spec.style.fontSize=Math.max(11,Math.min(22,d.size*3.1))+'px';
        if(d.color) spec.style.color=d.color;
        if(d.font) spec.style.fontFamily=fontCss(d.font);
        row.appendChild(spec);
        var sz=document.createElement('span');sz.className='stm-sz';
        sz.textContent=Math.round(d.size*5.4)+' pt';
        row.appendChild(sz);
        [['\u2212',1/1.12],['+',1.12]].forEach(function(pr){
          var b=document.createElement('button');
          b.className='dbtn stm-b';b.textContent=pr[0];
          b.title=(pr[1]>1?'Bigger':'Smaller')+' \u2014 '+d.label
            +' everywhere in this presentation';
          b.addEventListener('click',function(e){
            e.stopPropagation();
            var over=deckStyles()[id]||{};
            over.label=STYLE_DEFAULTS[id].label;
            over.size=Math.max(0.8,Math.min(24,
              Math.round(d.size*pr[1]*100)/100));
            ['b','i','font','color','align'].forEach(function(k2){
              if(d[k2]!==undefined) over[k2]=d[k2];});
            deckStyles()[id]=over;
            restyleAll([id]);
            build();
          });
          row.appendChild(b);
        });
        /* "a little arrow option to the right of each" (2026-08-22). It
           opens ONE inline expander rather than a second floating menu:
           floatMenu positions fixed and clamps without scrolling, so a
           menu hanging off a menu would need its own dismissal, its own
           clamping and somewhere to go when the first one is already at
           the bottom of the screen. */
        var arw=document.createElement('button');
        arw.className='dbtn stm-b stm-arrow';
        arw.innerHTML=(openEdit===id)?'&#9662;':'&#9656;';
        arw.title='Change what "'+d.label+'" is';
        arw.addEventListener('click',function(e){
          e.stopPropagation();
          openEdit=(openEdit===id)?'':id;
          build();
        });
        row.appendChild(arw);
        menu.appendChild(row);
        if(openEdit===id) menu.appendChild(styleEditor(id,d,build));
      });
      /* "people could create their own types" \u2014 the seven built-ins are a
         scale, not a vocabulary, and a deck that needs a Quote had
         nowhere to put one */
      var add=document.createElement('button');
      add.className='dbtn vw-opt';
      add.textContent='\uff0b New style of my own';
      add.title='Add a type of your own \u2014 a Quote, a Source note, '
        +'whatever this deck needs';
      add.addEventListener('click',function(e){
        e.stopPropagation();
        var t=addCustomType('My style','body');
        openEdit=t.id;
        markDirty();build();
      });
      menu.appendChild(add);
      var rst=document.createElement('button');
      rst.className='dbtn vw-opt';
      rst.innerHTML=bic('reset')+' Back to the built-in sizes';
      /* it clears the OVERRIDES, and it must never touch pres.types:
         "back to the built-in sizes" is not "throw away the types I
         invented" */
      rst.title='Clears the size and weight changes. The types you made '
        +'yourself are kept.';
      rst.addEventListener('click',function(e){
        e.stopPropagation();
        delete pres.styles;
        var n=restyleAll(null);
        build();
        toast('Styles reset \u2014 '+n+' box'+(n===1?'':'es')+' followed');
      });
      menu.appendChild(rst);
    }
    /* not wireFloatDropdown: this menu REBUILDS itself on every open
       (build()), so the static options list the helper wants never fits */
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)) menu.hidden=true;
    });
  })();
  (function(){
    var d=$('#dsg-scale-down');
    if(d) d.addEventListener('click',function(){scaleStyles(1/1.12);});
    var u=$('#dsg-scale-up');
    if(u) u.addEventListener('click',function(){scaleStyles(1.12);});
    var r=$('#dsg-restyle');
    if(r) r.addEventListener('click',function(){
      var n=restyleAll(null);
      toast(n?('Re-applied the styles to '+n+' box'+(n===1?'':'es'))
        :'Nothing on this deck is wearing a named style yet');
    });
  })();
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
    /* while EDITING the layer does not clip: an item nudged past the edge
       has to stay visible so you can drag it back (2026-08-20). Playback
       and every export still clip to the page, which is what a page IS. */
    if(mode==='edit') layer.classList.add('an-spill');
    slideEl.appendChild(layer);
    renderAnnots(layer,s);
    if(mode==='edit') wireEditor(layer,s);
    /* draw any Plotly figures cloned into cell frames (json specs only —
       cloned scripts would clash on duplicate ids) */
    if(window.SemActivate) window.SemActivate(layer,true);
  }
  /* Commit every live on-canvas edit into the model, right now. Anything
     that is about to persist, re-render or tear down the page calls this
     first; see the long note in editableText for what each of those used
     to lose. Safe to call when nothing is being edited. */
  function flushTextEdits(){
    var live=document.querySelectorAll(
      '[contenteditable="true"],[contenteditable="plaintext-only"]');
    for(var i=0;i<live.length;i++){
      var f=live[i].__jvFlush;
      if(typeof f==='function'){try{f();}catch(e){}}
    }
  }
  window.SemDeckFlush=flushTextEdits;   /* test hook */
  /* THE LAST CHANCE. A tab can be closed, crashed or backgrounded without
     ever firing blur, and the editor had no unload handler of any kind —
     the only grep hit in the file was the presenter popup clearing its own
     handle. pagehide and visibilitychange are the pair that actually fire
     (beforeunload is skipped on mobile and unreliable on a crash); both
     are cheap, because the flush's own markDirty writes the draft. */
  (function(){
    function lastChance(){
      try{flushTextEdits();}catch(e){}
      /* the draft write is debounced now — a closing tab cannot wait */
      try{flushDraftWrite();}catch(e){}
    }
    window.addEventListener('pagehide',lastChance);
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden') lastChance();
    });
  })();
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
      /* inside a group, the FIRST double-click steps in and selects this
         item; only once you are inside does it start typing */
      var sg=pres.slides[cur],ag=sg&&annotByIdx(sg,idx);
      if(ag&&ag.grp!=null&&inGroup!==ag.grp) return;
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
    /* WHAT YOU HAVE TYPED IS NOT IN THE DECK UNTIL THIS RUNS, and until
       2026-08-22 the only thing that ran it was `blur`. So: Ctrl+S while
       typing opened the browser's own Save-page dialog and saved nothing;
       renderAnnots' `layer.innerHTML=''` removes the focused node, which
       fires no blur in Chrome or Firefox, so every notebook refresh and
       every slide change silently ate the paragraph; closing the tab lost
       it; and because markDirty never ran, the 1.2s autosave was not
       running during the one activity that produces unrecoverable text —
       while the readout said "autosaved". Hence a named flush the other
       paths can call, plus a debounced one while you type, so a crash
       costs a phrase rather than a slide. */
    function commitNow(quiet){
      if(!el.isContentEditable) return;
      var v0=(el.innerText||'').replace(/\r/g,'').replace(/\n+$/,'');
      var r0=rich?sanitizeRich(el.innerHTML):null;
      setVal(v0,r0);
      markDirty(quiet);
    }
    el.__jvFlush=function(){commitNow(true);};
    var typeT=null;
    el.addEventListener('input',function(){
      clearTimeout(typeT);
      typeT=setTimeout(function(){commitNow(true);},900);
    });
    el.addEventListener('blur',function(){
      clearTimeout(typeT);
      delete el.__jvFlush;
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
    /* AUTO-BULLETS. Typing "- " or "* " at the start of a plain text box
       turns it into a bullet list, and "1. " into a numbered one — the
       markdown habit everybody already has, and the reason nobody could
       find the List button until they had already given up (2026-08-20,
       user: "need auto-dot points"). It only fires on the FIRST
       characters of a box that is not already a list, so it can never
       eat a hyphen you meant to keep. */
    el.addEventListener('input',function(){
      if(!el.isContentEditable) return;
      if(el.classList.contains('an-ul')) return;
      var t=el.textContent||'';
      var m=/^\s*([-*\u2022]|1[.)])\s$/.exec(t);
      if(!m) return;
      var s3=pres.slides[cur],a3=s3&&annotByIdx(s3,idx);
      if(!a3||a3.k!=='text') return;
      var kind=/^1/.test(m[1])?'number':'bullet';
      el.textContent='';
      a3.text='';delete a3.html;
      setListStyle(a3,kind);
      markDirty();
      var l3=stage.querySelector('.annot-layer');
      if(!l3) return;
      renderAnnots(l3,s3);selectAnnot(l3,idx);
      /* put the caret back in the first bullet so typing carries on */
      var ne=l3.querySelector('.an-item[data-idx="'+idx+'"] .an-tx');
      if(ne&&ne._beginEdit){
        ne._beginEdit();
        try{
          var li=ne.querySelector('li')||ne;
          var r3=document.createRange();r3.selectNodeContents(li);
          r3.collapse(true);
          var sel3=window.getSelection();
          sel3.removeAllRanges();sel3.addRange(r3);
        }catch(err){}
      }
      toast(kind==='number'?'Numbered list \u2014 Tab indents'
        :'Bullet list \u2014 Tab indents, Shift+Tab goes back');
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
    if(editing&&!pinned(a)){  /* a pinned arrow gets no live endpoints */
      /* a handle per corner, plus a faint one halfway along each segment
         that ADDS a corner there - the gesture every vector editor uses,
         so nobody has to be told it exists (2026-08-20) */
      arrowMids(a).forEach(function(m,mi){
        var h=document.createElement('span');
        h.className='an-endpt an-mid'+(selAnnot===i?' sel':'');
        h.style.left=m[0]+'%';h.style.top=m[1]+'%';
        h.setAttribute('data-idx',i);
        h.setAttribute('data-mid',mi);
        h.title='Drag to shape the line. Alt+click or right-click to '
          +'take this corner out again';
        layer.appendChild(h);
      });
      if(selAnnot===i){
        var pts0=[[ends.x1,ends.y1]].concat(
          arrowMids(a).map(function(m){return [m[0],m[1]];}),
          [[ends.x2,ends.y2]]);
        for(var sgi=0;sgi<pts0.length-1;sgi++){
          var ad=document.createElement('span');
          ad.className='an-endpt an-addpt';
          ad.style.left=((pts0[sgi][0]+pts0[sgi+1][0])/2)+'%';
          ad.style.top=((pts0[sgi][1]+pts0[sgi+1][1])/2)+'%';
          ad.setAttribute('data-idx',i);
          ad.setAttribute('data-addat',sgi);
          ad.title='Drag to bend the line here';
          layer.appendChild(ad);
        }
      }
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
  /* ---- TABLES ---------------------------------------------------------
     a.rows is an array of arrays of plain strings; a.thead marks the first
     row as headings; a.grid draws the rules; a.sw and a.color are the same
     stroke currency every other item uses, so the lines scale with the
     page like everything else instead of being a fixed pixel hairline that
     vanishes on an A0 poster.
     Column widths are equal unless a.cols says otherwise (percentages that
     sum to 100), which is what the column-drag handles write. */
  function tableRows(a){
    var r=a&&a.rows;
    return (Array.isArray(r)&&r.length)?r:[['']];
  }
  function tableCols(a){
    var n=(tableRows(a)[0]||[]).length||1;
    var c=a&&a.cols;
    if(Array.isArray(c)&&c.length===n) return c;
    var out=[],i;
    for(i=0;i<n;i++) out.push(100/n);
    return out;
  }
  /* keep every row the same length: a ragged model would put the column
     handles and the exports out of step with what is on screen */
  function tableNormalise(a){
    var rows=tableRows(a),n=0,i,j;
    for(i=0;i<rows.length;i++) n=Math.max(n,rows[i].length);
    n=Math.max(1,n);
    for(i=0;i<rows.length;i++){
      for(j=rows[i].length;j<n;j++) rows[i][j]='';
      rows[i].length=n;
    }
    a.rows=rows;
    if(Array.isArray(a.cols)&&a.cols.length!==n) delete a.cols;
    return a;
  }
  function drawTable(layer,s,a,i,editing){
    tableNormalise(a);
    var rows=tableRows(a),cols=tableCols(a);
    var host=document.createElement('div');
    host.className='an-item an-table'+(selAnnot===i?' sel':'')
      +(a.grid===0?' nogrid':'');
    host.style.left=a.x+'%';host.style.top=a.y+'%';
    host.style.width=(a.w||40)+'%';host.style.height=(a.h||20)+'%';
    host.style.fontSize=fontPx(layer,a.size||2.2);
    if(a.lh) host.style.lineHeight=a.lh;
    if(a.color) host.style.color=a.color;
    /* a.bg===0 is "no fill", and the format bar's swatch has always read
       it that way — but this renderer only ever looked at a.bgc, so
       setting a table to no fill left the colour on the page and the
       swatch and the slide disagreed (2026-08-22, found while giving the
       Apply dialog a Box background row that covers tables). */
    if(a.bg!==0&&a.bgc) host.style.background=a.bgc;
    /* the rules are page-relative like every other stroke on the canvas */
    host.style.setProperty('--tbl-sw',strokePx(a,layer).toFixed(2)+'px');
    host.style.setProperty('--tbl-line',a.line||'currentColor');
    applyCommon(host,a);
    applyCrop(host,a);
    host.setAttribute('data-idx',i);
    var tbl=document.createElement('table');
    tbl.className='an-tbl';
    var cg=document.createElement('colgroup');
    cols.forEach(function(w){
      var c=document.createElement('col');
      c.style.width=w+'%';cg.appendChild(c);});
    tbl.appendChild(cg);
    /* an even share each, as a HINT: a browser treats a row height as a
       minimum, so short rows sit on the grid the box was drawn to and a
       long one still grows rather than clipping its own words */
    var rowPct=(100/rows.length).toFixed(4)+'%';
    rows.forEach(function(row,ri){
      var tr=document.createElement('tr');
      tr.style.height=rowPct;
      if(a.thead&&ri===0) tr.className='an-tbl-head';
      row.forEach(function(val,ci){
        var td=document.createElement(
          (a.thead&&ri===0)?'th':'td');
        td.textContent=val==null?'':String(val);
        if(a.align) td.style.textAlign=a.align;
        if(editing){
          td.dataset.r=ri;td.dataset.c=ci;
          /* the WHOLE table drags from any cell; only a double-click puts
             a caret in one, the same contract text boxes keep */
          td.addEventListener('dblclick',function(e){
            e.stopPropagation();
            startTableEdit(layer,s,a,i,td,ri,ci);
          });
        }
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    host.appendChild(tbl);
    if(editing){
      host.appendChild(mkResize());
      host.appendChild(mkRotate());
      /* a grip per column boundary, so widths are dragged rather than
         typed into a dialog */
      if(selAnnot===i&&!lockedAll(a)){
        var acc=0;
        cols.forEach(function(w,ci){
          if(ci===cols.length-1) return;
          acc+=w;
          var g=document.createElement('span');
          g.className='an-tblgrip';
          g.style.left=acc+'%';
          g.title='Drag to resize this column';
          (function(at,pct){
            g.addEventListener('mousedown',function(ev){
              startColDrag(layer,s,a,i,at,ev);
            });
          })(ci,acc);
          host.appendChild(g);
        });
      }
    }
    layer.appendChild(host);
  }
  /* type into ONE cell. contenteditable on the <td> itself, so the caret,
     selection and spellcheck all behave the way they do in a text box. */
  function startTableEdit(layer,s,a,idx,td,ri,ci){
    if(lockedAll(a)) return;
    td.contentEditable='plaintext-only';
    td.spellcheck=true;
    td.focus();
    try{
      var r=document.createRange();r.selectNodeContents(td);
      var sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
    }catch(e){}
    function writeCell(){
      a.rows[ri][ci]=(td.innerText||'').replace(/\r/g,'')
        .replace(/\n+$/,'');
    }
    /* a table cell is a text edit too, and had the same blur-only commit */
    td.__jvFlush=function(){writeCell();markDirty(true);};
    var cellT=null;
    td.addEventListener('input',function(){
      clearTimeout(cellT);
      cellT=setTimeout(function(){writeCell();markDirty(true);},900);
    });
    function commit(){
      clearTimeout(cellT);
      delete td.__jvFlush;
      writeCell();
      td.contentEditable='false';
      markDirty();
    }
    td.addEventListener('blur',commit,{once:true});
    td.addEventListener('keydown',function(e){
      e.stopPropagation();
      /* Tab along, Enter down - the two moves that make a table usable
         without reaching for the mouse between every cell */
      var nr=ri,nc=ci;
      if(e.key==='Tab'){e.preventDefault();
        nc=ci+(e.shiftKey?-1:1);
        if(nc>=a.rows[ri].length){nc=0;nr=ri+1;}
        else if(nc<0){nc=a.rows[ri].length-1;nr=ri-1;}
      } else if(e.key==='Enter'){e.preventDefault();
        nr=ri+(e.shiftKey?-1:1);
      } else if(e.key==='Escape'){e.preventDefault();td.blur();return;}
      else return;
      commit();
      if(nr<0||nr>=a.rows.length||nc<0||nc>=a.rows[0].length){
        td.blur();return;
      }
      renderAnnots(layer,s);selectAnnot(layer,idx);
      var nxt=layer.querySelector('.an-item[data-idx="'+idx+'"] '
        +'[data-r="'+nr+'"][data-c="'+nc+'"]');
      if(nxt) startTableEdit(layer,s,a,idx,nxt,nr,nc);
    });
  }
  /* drag a column boundary. Only the two columns either side of the grip
     change, so the table's own width never moves. */
  function startColDrag(layer,s,a,idx,at,ev0){
    ev0.preventDefault();ev0.stopPropagation();
    var cols=tableCols(a).slice();
    var lr=layer.getBoundingClientRect();
    var tw=(a.w||40)/100*lr.width;
    var x0=ev0.clientX,a0=cols[at],b0=cols[at+1];
    function mm(ev){
      var d=(ev.clientX-x0)/(tw||1)*100;
      d=Math.max(-(a0-6),Math.min(b0-6,d));
      cols[at]=a0+d;cols[at+1]=b0-d;
      a.cols=cols.slice();
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
  /* add / remove rows and columns, relative to nothing in particular -
     the ribbon buttons act on the END, which is what you want 90% of the
     time and needs no cell to be selected first */
  function tableGrow(a,what,by){
    tableNormalise(a);
    var rows=a.rows,n=(rows[0]||[]).length;
    if(what==='row'){
      if(by>0){
        var blank=[],j;
        for(j=0;j<n;j++) blank.push('');
        rows.push(blank);
      } else if(rows.length>1) rows.pop();
    } else {
      if(by>0) rows.forEach(function(r){r.push('');});
      else if(n>1) rows.forEach(function(r){r.pop();});
      delete a.cols;   /* equal widths again rather than a stale set */
    }
    tableNormalise(a);
  }
  function renderAnnots(layer,s){
    /* the one funnel every slide render passes through, which makes it
       the only place identity has to be minted — see WHAT HAS THIS
       OBJECT LOOKED LIKE. Idempotent, and it re-mints a duplicate, so
       no copy site has to remember to strip one. */
    ensureOids(s);
    var editing=(mode==='edit');
    /* removing a focused node fires no blur in Chrome or Firefox, so
       without this every rebuild — a slide change, a notebook refresh,
       the async embedded-cards arrival — silently threw away whatever
       was being typed (2026-08-22) */
    flushTextEdits();
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
          w8.innerHTML=bic('lock')+' '+esc(a.lockver.commit)
            +' — loading…';
          c.appendChild(w8);
        } else if(locked&&!it){
          var w9=document.createElement('div');w9.className='an-verwait';
          w9.innerHTML=bic('lock')+' '+esc(a.lockver.commit)
            +' — not available';
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
              fz.innerHTML=bic('reset')+' previous';
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
          if(it.emb&&editing){
            /* the notebook isn't open: the frame shows the copy saved
               inside the deck. Edit-time only, like the lock chip — an
               audience never needs to know. */
            var ez=document.createElement('span');
            ez.className='an-embchip';
            ez.textContent='saved copy';
            ez.title='This frame shows the copy saved with the deck — '
              +'its notebook is not open. Open the notebook to show the '
              +'live card again.';
            c.appendChild(ez);
          }
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
        /* a.lh is a MULTIPLE of the type size, the way every word
           processor states it, so it survives every zoom and page size
           for free; a.pspace is the gap between paragraphs in the same
           currency (2026-08-20) */
        if(a.lh) d2.style.lineHeight=a.lh;
        if(a.pspace) d2.style.setProperty('--an-pspace',a.pspace+'em');
        /* indentation, in em of the box's own type size — so it means the
           same thing on a 16:9 slide and on an A0 poster, exactly as a.lh
           and a.pspace already do. It is one of the properties the user
           named for the Apply dialog and the only one that did not exist
           yet (2026-08-22). */
        if(a.ind) d2.style.setProperty('--an-ind',a.ind+'em');
        else d2.style.removeProperty('--an-ind');
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
      } else if(a.k==='table'){
        drawTable(layer,s,a,i,editing);
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
      } else if(a.k==='flip'){
        var fr=flipFrames(a),at=flipAtNow(s,a),fdef=fr[at]||null;
        var fl=document.createElement('div');
        fl.className='an-item an-flip'+(selAnnot===i?' sel':'')
          +(fr.length?'':' empty');
        fl.style.left=a.x+'%';fl.style.top=a.y+'%';
        fl.style.width=(a.w||40)+'%';fl.style.height=(a.h||32)+'%';
        applyCommon(fl,a);
        fl.setAttribute('data-idx',i);
        /* the frame is LETTERBOXED into a box that never changes size.
           Frames differ in shape — a wide plot, then the same plot with a
           legend — and a box that hugged each one would move every caption
           tied to it on every click, which is precisely the jitter people
           duplicate slides to avoid. */
        var fst=document.createElement('div');
        fst.className='an-flipstage';
        if(!fr.length){
          var fph=document.createElement('div');
          fph.className='an-flipempty';
          fph.textContent=editing
            ?'Empty flip book — use Figures ▾ to add frames'
            :'';
          fst.appendChild(fph);
        } else if(fdef&&fdef.src){
          var fim=document.createElement('img');
          fim.className='an-flipimg';fim.src=fdef.src;fim.alt='';
          fim.draggable=false;
          fst.appendChild(fim);
        } else if(fdef&&fdef.ref){
          var fnode=framePart(fdef.ref,fdef.part);
          if(fnode){
            /* the same currency a placed cell uses: natural size, zoomed
               by a.ts x pageScale, so the page's zoom cannot change how
               big the figure is relative to the slide */
            fnode.style.zoom=(a.ts||1)*(pageScale(layer)||1);
            fst.appendChild(fnode);
          } else {
            var fmiss=document.createElement('div');
            fmiss.className='an-flipempty';
            fmiss.textContent=editing
              ?'That notebook is not open, and the deck holds no copy of '
                +'this frame'
              :'';
            fst.appendChild(fmiss);
          }
        }
        fl.appendChild(fst);
        if(fr.length>1){
          var fbar=document.createElement('div');
          fbar.className='an-flipbar';
          /* real <button>s, which is what makes them safe in playback:
             the click-to-advance handler already skips
             button,a,input,select, so stepping a frame cannot also
             advance the slide.
             On an EXPORTED page there is nothing to click — each page IS
             one frame — so the arrows are left off and only the counter
             goes on, which is what tells a reader on paper that they are
             looking at step 2 of 3 (2026-08-22). */
          function flipNav(d,tip){
            if(flipForce!=null) return;
            var nb=document.createElement('button');
            nb.className='an-flipnav';nb.type='button';
            nb.textContent=d<0?'‹':'›';nb.title=tip;
            nb.disabled=d<0?(at<=0):(at>=fr.length-1);
            nb.addEventListener('click',function(ev){
              ev.stopPropagation();ev.preventDefault();flipStep(i,d);});
            /* the layer's own mousedown starts a MOVE on whatever is
               under the pointer; without this, dragging off an arrow
               drags the whole flip book across the slide */
            nb.addEventListener('mousedown',function(ev){
              ev.stopPropagation();});
            fbar.appendChild(nb);
          }
          flipNav(-1,'Previous figure');
          var fn=document.createElement('span');
          fn.className='an-flipn';
          fn.textContent=(at+1)+' / '+fr.length;
          if(fdef&&fdef.label) fn.title=fdef.label;
          fbar.appendChild(fn);
          flipNav(1,'Next figure');
          fl.appendChild(fbar);
        }
        if(editing){fl.appendChild(mkResize());fl.appendChild(mkRotate());}
        layer.appendChild(fl);
      }
    });
    /* ---- WHAT BELONGS TO ANOTHER FRAME --------------------------------
       Done as a pass over the rendered layer rather than inside the loop
       above, the way the build animations are: every kind builds its own
       element, and one predicate applied afterwards cannot be forgotten by
       a branch added later.
       In PLAYBACK an item of another frame is removed. In the EDITOR it is
       dimmed instead and left where it is — you have to be able to see and
       click the caption you are about to tie to frame 4 while you are
       standing on frame 1. */
    (s.annots||[]).forEach(function(a,i){
      if(!a||!a.fb||flipShows(s,a)) return;
      var fel=layer.querySelector('[data-idx="'+i+'"]');
      if(!fel) return;
      if(editing) fel.classList.add('an-fbother');
      else if(fel.parentNode) fel.parentNode.removeChild(fel);
    });
    _arrows.forEach(function(i){
      drawArrow(layer,s,(s.annots||[])[i],i,svg,svgTop,defs,editing);
    });
    /* the layer is rebuilt on every change, which throws away whatever
       MathJax had already typeset - so ask for it again, but ONLY when
       the slide actually carries maths. Typesetting a whole layer on
       every mousemove of a drag would be a real cost for nothing. */
    if((s.annots||[]).some(function(a){
      return a&&a.k==='text'&&(a.maths||/\$\$[\s\S]*\$\$/.test(a.text||''));
    })) typeset(layer);
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
    /* ---- STRAYS ------------------------------------------------------
       Anything sitting outside the page. They used to be clipped by the
       stage and unreachable — you could not scroll to them and you could
       not see they were there (2026-08-20, user). Marked here, and the
       stage is told so it can grow scrollbars; the print check has always
       flagged them, but flagging a thing you cannot get to is only half
       an answer. */
    if(editing){
      var spill=false;
      (s.annots||[]).forEach(function(a,i){
        if(!a||a.hide) return;
        var r=annotRectPct(layer,s,i);
        if(!r) return;
        var out=(r.l<-1||r.t<-1||r.r>101||r.b>101);
        if(out) spill=true;
        $$('.an-item[data-idx="'+i+'"]',layer).forEach(function(el){
          el.classList.toggle('an-offpage',out);});
      });
      stage.classList.toggle('spill',spill);
    }
    /* FULLY locked: visible but untouchable on the canvas (an-locked is
       pointer-events:none). Position locked is a different animal — it
       stays clickable and resizable, and only says so with a cursor. */
    if(editing) (s.annots||[]).forEach(function(a,i){
      var lm=lockMode(a); if(!lm) return;
      $$('.an-item[data-idx="'+i+'"]',layer).forEach(function(el){
        el.classList.add(lm==='all'?'an-locked':'an-pinned');});
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
    showFmt();
    /* refresh the Objects pane only when the selection actually CHANGED
       (resize/endpoint drags re-select every mousemove) */
    var sig=String(selAnnot)+'|'+selSet.join(',');
    if(sig!==lastSelSig){
      lastSelSig=sig;renderSelPane();
      /* a line's CORNER handles - and the faint ones that add a corner -
         only exist for the selected line, and they are drawn by
         renderAnnots. Selecting is not a re-render (paintSel only
         toggles classes), so the handles never appeared on a line you
         had just drawn or just clicked (2026-08-20, found live: 0 of
         them on a freshly drawn arrow). Arrows only: cheap, and nothing
         else on the layer cares about selection at render time. */
      if(mode==='edit'&&layer&&(s&&s.annots||[]).some(function(a){
        return a&&a.k==='arrow';})) redrawArrows(layer,s);
    }
  }
  var lastSelSig='';
  /* select a whole BATCH at once. selectAnnot(...,true) toggles, so
     looping it over a set whose members share a group takes them back
     out again -- which is why the marquee sets selSet directly too. */
  function selectMany(layer,idxs){
    selSet=idxs.slice();
    selAnnot=idxs.length?idxs[idxs.length-1]:null;
    lastSelSig='';
    if(layer) paintSel(layer);
    showFmt();renderSelPane();
  }
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
    /* a table's rules are a stroke like any other, so the same weight
       menu sets how heavy they are (2026-08-20) */
    '#fmt-swwrap':'arrow rect draw table',
    '#fmt-headwrap':'arrow',          /* arrowheads: a shape has no ends */
    '#fmt-bendwrap':'arrow',          /* straight/curved/elbow: ditto */
    '#fmt-fillwrap':'rect',           /* fill + gradients: shapes only */
    '#fmt-shapewrap':'rect',
    '#fmt-cropwrap':'image cell',
    '#fmt-figures':'flip'
  };
  /* controls whose visibility depends on more than the kind (how many are
     selected, what a placed cell contains, whether the page is a poster).
     Listed so the completeness check knows they are deliberate. */
  var FMT_MANUAL=('#fmt-lhwrap #fmt-lh '
    /* the two children of the governed #fmt-stylewrap-tx wrapper: their
       visibility IS the wrapper's, listed so the completeness audit
       below stops flagging them on every first selection (2026-08-24) */
    +'#fmt-eqedit #fmt-stylewrap-tx #fmt-style-tx #fmt-style-menu-tx '
    +'#fmt-tbl-rowplus #fmt-tbl-rowminus #fmt-tbl-colplus '
    +'#fmt-tbl-colminus #fmt-tbl-head #fmt-tbl-grid '
    +'#fmt-forward #fmt-backward '
    +'#fmt-bullets #fmt-numbers #fmt-indent #fmt-outdent '
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
    +'#fmt-opval #fmt-imgrefresh').split(' ');

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
    /* THE TAB FOLLOWS THE SELECTION. Every selection-driven group lives
       on Home, so clicking a figure while you happened to be on Insert
       or Design silently left its tools on a tab you were not looking at
       — which is how "the ability to lock cells" appeared to vanish when
       it had simply moved one tab away (2026-08-20, user).
       Not while a drawing tool is armed: placing five shapes in a row
       must not yank you off Insert after each one. */
    if(activeTab()!=='home'&&tool==='select'&&!justDrew) setTab('home');
    justDrew=false;
    var kind=(selAnnot==='t'||selAnnot==='s')?'text':a.k;
    /* a table is not a text box, but its WORDS take the same size, font
       and alignment controls a text box does (2026-08-20) */
    var isTbl=(kind==='table');
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
    show('#fmt-smaller',isText||cellText||isTbl);
    show('#fmt-bigger',isText||cellText||isTbl);
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
    show('#fmt-szwrap',isText||isTbl);
    /* named styles are for TEXT BOXES: a title/subtitle pseudo-item is
       already the deck's title style by definition */
    show('#fmt-stylewrap-tx',isText&&isNum);
    /* spacing applies to any run of words, including a table's */
    show('#fmt-lhwrap',(isText||isTbl)&&isNum);
    show('#fmt-eqedit',isMaths(a)&&isNum);
    var szIn=$('#fmt-size');
    if(szIn&&(isText||isTbl)&&document.activeElement!==szIn)
      szIn.value=Math.round((a.size||(isTbl?2.2:2.6))*5.4);
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
    /* Bring to front and Send to back are BUTTONS again. They were
       menu-only, which is why they read as missing (2026-08-20, user
       asked for "the bring to forewards send to back" - both pairs were
       in the code, three clicks deep inside Arrange). The one-STEP pair
       stays in the menu: it is the rarer of the two and the row has to
       stay honest about its width. */
    show('#fmt-front',isNum);
    show('#fmt-back',isNum);
    show('#fmt-forward',false);
    show('#fmt-backward',false);
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
    /* a SHAPE has one Fill control and it is the panel in Line & shape;
       this button stays for text boxes and cell frames, which have a
       background colour but no fill STYLE (2026-08-20, user: "confusing
       there is a fill and fill colour") */
    show('#fmt-fillcol-btn',showBg&&kind!=='rect');
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
    /* the Table group, the only place row and column counts live */
    ['#fmt-tbl-rowplus','#fmt-tbl-rowminus','#fmt-tbl-colplus',
     '#fmt-tbl-colminus'].forEach(function(id){show(id,isTbl);});
    show('#fmt-tbl-head',isTbl,isTbl&&!!a.thead);
    show('#fmt-tbl-grid',isTbl,isTbl&&a.grid!==0);
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
        ?(bic('reload')+' Live figure')
        :(bic('reset')+' Previous figure');
    }
    /* Locking pins a figure to its notebook's git commit, which needs the
       local server to talk to git - so it only WORKS in the app build.
       It used to disappear entirely everywhere else, which reads as a
       feature that was removed rather than one that is unavailable here
       (2026-08-20, user: "what happened to locking all the images to a
       git commit"). It is shown and disabled instead, and the tooltip
       says what would make it work. */
    var isCellRef=(kind==='cell')&&!!a.ref;
    var canLock=isCellRef&&APP.mode==='app';
    show('#fmt-lockver',isCellRef);
    var lvb=$('#fmt-lockver');
    if(lvb&&isCellRef){
      lvb.disabled=!canLock;
      lvb.innerHTML=lockedV
        ?(bic('unlock')+' Unlock figure')
        :(bic('lock')+' Lock figure');
      lvb.title=canLock
        ?('Pin this figure to its notebook\u2019s current git commit '
          +'\u2014 refreshes stop changing it, and it renders even with '
          +'the notebook closed')
        :('Locking pins a figure to a git commit, which needs the '
          +'Junoview app (it reads git through the local server). This '
          +'page was exported as a standalone file, so there is no '
          +'repository to pin to.');
    }
    /* #fmt-cropwrap: visibility from FMT_KINDS.
       Animation is a BUILD — an item appearing on click as you step
       through a deck. A poster is one printed page: there is no click and
       nothing to step through, so it is not offered (2026-08-07, user:
       "why is there animate options in a poster"). */
    /* the code/figure/output part-picker (+ split) — moved off the frame
       into the ribbon's Object group */
    /* only for a picture that actually knows where it came from —
       otherwise it is a button that can only ever fail */
    var ir=$('#fmt-imgrefresh');
    if(ir){
      var anyLinked=false;
      selIdxs().forEach(function(i){
        var xa=(s&&s.annots||[])[i];
        if(xa&&xa.k==='image'&&xa.fkey) anyLinked=true;});
      ir.hidden=!anyLinked;
    }
    var partsSlot=$('#fmt-parts');
    if(partsSlot){
      partsSlot.innerHTML='';
      var pcr=(kind==='cell'&&typeof selAnnot==='number')
        ?buildPartChooser(s,selAnnot):null;
      if(pcr) partsSlot.appendChild(pcr);
      partsSlot.hidden=!pcr;
    }
    /* the frames pane FOLLOWS the selection: select a flip book and it
       shows that one's figures; select a caption instead and its "tie to"
       row wakes up for whatever is selected. Only when the pane is
       actually open — this runs on every click on the canvas. */
    if(typeof renderFlipPane==='function'){
      var fpEl=$('#flippane');
      if(fpEl&&!fpEl.hidden){
        selIdxs().forEach(function(i){
          var xf=(s&&s.annots||[])[i];
          if(xf&&xf.k==='flip') flipSel=i;});
        renderFlipPane();
      }
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
      showFmt();
    } else selectAnnot(l,selAnnot);
  }
  function pctPoint(layer,ev){
    var r=layer.getBoundingClientRect();
    return {x:Math.max(0,Math.min(100,(ev.clientX-r.left)/r.width*100)),
            y:Math.max(0,Math.min(100,(ev.clientY-r.top)/r.height*100))};
  }
  /* ---- LOCKS -----------------------------------------------------------
     TWO locks, because there are two different things people mean by the
     word (TASKS T3):

       'all'  fully locked. The item cannot be clicked, dragged, resized,
              typed into or nudged on the canvas at all -- the Objects
              pane, and an Alt-marquee, are its remaining doors. This is
              the lock that already existed, and every saved deck carries
              it as `lock:1`.
       'pos'  position locked. Pinned where it is, and otherwise entirely
              yours: select it, resize it, restyle it, type in it. This
              is what a figure frame usually wants -- the plot must not
              wander, and you still need to make it bigger.

     `lockMode` is the ONLY reader of the raw flag; everything else asks
     one of the two questions below, so a third mode would be a change in
     one place. `pinned` is the movement question and `lockedAll` the
     reachability one -- getting those two the wrong way round is exactly
     the bug this section exists to make hard. */
  function lockMode(a){
    if(!a||!a.lock) return '';
    return a.lock==='pos'?'pos':'all';
  }
  function lockedAll(a){return lockMode(a)==='all';}
  function pinned(a){return !!lockMode(a);}
  var LOCK_LABEL={'':'Not locked','pos':'Position locked',
    all:'Fully locked'};
  /* ---- snap-to-align: while dragging or resizing, edges and centers
     snap to the canvas (edges + middle) and to every other object's
     edges + centers, with dashed guide lines. Hold Alt to disable --
     EXCEPT in an Alt-drag clone, where Alt already means "copy" and you
     have to keep holding it (see startMove's `cloning`). ---- */
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
    /* a guide box contributes its edges AND its middles: lining things up
       with one is the entire reason for drawing it */
    cg.b.forEach(function(v){
      xs.push(v[0],v[0]+v[2]/2,v[0]+v[2]);
      ys.push(v[1],v[1]+v[3]/2,v[1]+v[3]);
    });
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
    /* a gap is not just a NUMBER. It was measured between two particular
       neighbours, and to show you what a match matched — which is the
       whole point of the badge — the pair has to travel with the value
       (2026-08-25, T7). The old code kept only the number, which is why
       the comment above promised to "mark both" and only one was ever
       drawn. */
    var gaps=[];
    for(var i=1;i<boxes.length;i++){
      var p=boxes[i-1],q=boxes[i];
      var g=horiz?(q.l-p.r):(q.t-p.b);
      if(g>0.2) gaps.push({g:g,
        a:horiz?p.r:p.b, b:horiz?q.l:q.t,
        at:horiz?(Math.max(p.t,q.t)+Math.min(p.b,q.b))/2
                :(Math.max(p.l,q.l)+Math.min(p.r,q.r))/2});
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
      c.gaps.forEach(function(gp){
        var g=gp.g;
        /* place the dragged box a distance g AFTER this one... */
        var d1=(before+g)-lo;
        if(Math.abs(d1)<=thr&&(!best||Math.abs(d1)<Math.abs(best.d)))
          best={d:d1,gap:g,from:r,side:'after',src:gp};
        /* ...or a distance g BEFORE it */
        var d2=(after-g)-hi;
        if(Math.abs(d2)<=thr&&(!best||Math.abs(d2)<Math.abs(best.d)))
          best={d:d2,gap:g,from:r,side:'before',src:gp};
      });
    });
    return best;
  }
  /* a distance across the page, in the millimetres the rulers speak.
     A percentage means nothing to anyone laying out an A0 poster, and
     the badge exists precisely so the number can be read (T7). */
  function gapMm(v,horiz){
    var pg=pageOf();
    var mm=Math.abs(v)/100*(horiz?pg.mm[0]:pg.mm[1]);
    return (mm<10?Math.round(mm*10)/10:Math.round(mm))+' mm';
  }
  function drawGapMarks(layer,marks){
    $$('.snapgap,.snapgap-lab',layer).forEach(function(n){n.remove();});
    marks.forEach(function(m){
      var lo=Math.min(m.a,m.b),hi=Math.max(m.a,m.b);
      var el=document.createElement('div');
      /* the gap you are MAKING is solid; the one it matched is drawn
         faint, because it is evidence rather than an instruction */
      el.className='snapgap'+(m.ref?' snapgap-ref':'');
      if(m.horiz){
        el.style.left=lo+'%';el.style.width=(hi-lo)+'%';
        el.style.top=(m.at-0.35)+'%';el.style.height='0.7%';
      } else {
        el.style.top=lo+'%';el.style.height=(hi-lo)+'%';
        el.style.left=(m.at-0.35)+'%';el.style.width='0.7%';
      }
      layer.appendChild(el);
      /* THE BADGE. A bar says "these two distances agree"; the number
         says what the distance IS, which is the question you were
         actually asking when you started dragging (T7). It reuses
         .dragtag, which was styled for exactly this kind of readout and
         then never wired to anything. */
      var lab=document.createElement('div');
      lab.className='dragtag snapgap-lab'+(m.ref?' snapgap-lab-ref':'');
      lab.textContent=gapMm(hi-lo,m.horiz);
      if(m.horiz){
        lab.style.left=((lo+hi)/2)+'%';
        lab.style.top=m.at+'%';
      } else {
        lab.style.left=m.at+'%';
        lab.style.top=((lo+hi)/2)+'%';
      }
      layer.appendChild(lab);
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
    /* .snapgap-lab is named here explicitly: the badge carries `dragtag`
       and `snapgap-lab`, neither of which is `.snapgap`, so it was only
       ever cleaned up incidentally — by the renderAnnots at the end of a
       drag, which is itself guarded by `if(movedAny)` (2026-08-25). */
    $$('.snapline,.snapgap,.snapgap-lab',layer)
      .forEach(function(n){n.remove();});
  }
  function startMove(layer,s,idx,ev0){
    ev0.preventDefault();
    /* ALT-DRAG CLONES. The copies are made in place and it is THEY that
       travel, so the originals are left exactly where they were and the
       rest of this function needs to know nothing about it.
       Alt also turns snapping off mid-drag (see `mm`) -- but not during
       a clone drag, where Alt was pressed to say "copy", not "ignore the
       guides", and where you have to keep holding it the whole way. */
    var cloning=false;
    if(ev0.altKey&&typeof idx==='number'){
      var pick=selIdxs();
      if(pick.indexOf(idx)<0) pick=[idx];
      pick=pick.filter(function(i){
        var m=(s.annots||[])[i];return m&&!lockedAll(m);});
      var clones=cloneAnnots(pick,0,0);
      if(clones.length){
        cloning=true;
        /* quiet: the mouseup at the end of this gesture takes the one
           undo entry, and it should undo the clone and its move together
           -- they are one gesture */
        markDirty(true);
        renderAnnots(layer,s);
        var k=pick.indexOf(idx);
        idx=clones[k>=0?k:0];
        selectMany(layer,clones);
      }
    }
    var a=annotByIdx(s,idx); if(!a) return;
    var start=pctPoint(layer,ev0);
    /* drag the whole current selection (group / multi-select) together —
       pinned members stay put, under EITHER lock */
    var movers=selSet.filter(function(i){return typeof i==='number';});
    if(typeof idx==='number'&&movers.indexOf(idx)<0) movers=[idx];
    movers=movers.filter(function(i){
      var m=(s.annots||[])[i];return m&&!pinned(m);});
    var origs={};
    movers.forEach(function(i){
      origs[i]=deep((s.annots||[])[i]);});
    var single=(typeof idx!=='number')?deep(a):null;
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
    /* THE GESTURE PATH (2026-08-23 perf). A drag no longer rebuilds the
       whole annotation layer per mousemove: renderAnnots re-clones every
       placed card (multi-MB figure bodies) on each rebuild. Instead the
       EXISTING nodes' inline left/top move — children (text, captions,
       handles, the selection outline, a frame's aspect-fitted geometry)
       ride along for free — and only the arrows are redrawn, because an
       attached endpoint is DERIVED from where its target item sits. The
       one real renderAnnots runs on mouseup. */
    var movedEls={};
    movers.forEach(function(i){
      var m=(s.annots||[])[i];
      if(!m||m.k==='arrow') return;   /* arrows redraw as strokes below */
      var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
      if(el) movedEls[i]={el:el,l:parseFloat(el.style.left)||0,
                          t:parseFloat(el.style.top)||0};
    });
    var singleEl=null;
    if(single){
      var tEl=layer.querySelector('div.an-item[data-idx="'+idx+'"]');
      if(tEl) singleEl={el:tEl,l:parseFloat(tEl.style.left)||0,
                        t:parseFloat(tEl.style.top)||0};
    }
    var anyArrow=(s.annots||[]).some(function(m){
      return m&&m.k==='arrow';});
    var movedAny=false;
    function mm(ev){
      movedAny=true;
      var p=pctPoint(layer,ev);
      var dx=p.x-start.x,dy=p.y-start.y;
      var sx=null,sy=null;
      /* CLEARED EVERY MOVE, like sx/sy beside it. It used to be reset
         inside the branch that fills it, which is skipped entirely when
         Alt suppresses snapping — so pressing Alt part-way through a drag
         froze the last marks on the page and drawGapMarks below happily
         redrew them, at their stale coordinates, for the rest of the
         gesture. help.html promises Alt "ignores snapping"; it has to
         ignore the evidence of it too (2026-08-25). */
      gapMarks=[];
      if(cloning||!ev.altKey){
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
          if(!bx){
            var gx=bestGap(layer,s,movers,bb,true,thr.x);
            if(gx){
              dx+=gx.d;
              var nb={l:bb.l+gx.d,r:bb.r+gx.d};
              var mid=(bb.t+bb.b)/2;
              gapMarks.push({horiz:true,at:mid,
                a:gx.side==='after'?gx.from.r:nb.r,
                b:gx.side==='after'?nb.l:gx.from.l});
              /* ...and the gap it MATCHED. Two bars carrying the same
                 number is the whole message; one bar on its own only
                 ever said "something snapped" (T7) */
              if(gx.src) gapMarks.push({horiz:true,at:gx.src.at,
                a:gx.src.a,b:gx.src.b,ref:1});
            }
          }
          if(!by){
            var gy=bestGap(layer,s,movers,bb,false,thr.y);
            if(gy){
              dy+=gy.d;
              var nby={t:bb.t+gy.d,b:bb.b+gy.d};
              var midx=(bb.l+bb.r)/2;
              if(gy.src) gapMarks.push({horiz:false,at:gy.src.at,
                a:gy.src.a,b:gy.src.b,ref:1});
              gapMarks.push({horiz:false,at:midx,
                a:gy.side==='after'?gy.from.b:nby.b,
                b:gy.side==='after'?nby.t:gy.from.t});
            }
          }
        }
      }
      if(single){
        a.x=single.x+dx;a.y=single.y+dy;
        if(singleEl){
          singleEl.el.style.left=(singleEl.l+dx)+'%';
          singleEl.el.style.top=(singleEl.t+dy)+'%';
        }
      }
      else movers.forEach(function(i){
        var m=(s.annots||[])[i],o=origs[i];
        if(!m||!o) return;
        if(m.k==='arrow'){
          m.x1=o.x1+dx;m.y1=o.y1+dy;m.x2=o.x2+dx;m.y2=o.y2+dy;
        } else {m.x=o.x+dx;m.y=o.y+dy;}
        var me=movedEls[i];
        if(me){me.el.style.left=(me.l+dx)+'%';
               me.el.style.top=(me.t+dy)+'%';}
      });
      if(anyArrow) redrawArrows(layer,s);
      drawSnapGuides(layer,sx,sy);
      drawGapMarks(layer,gapMarks);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      /* the ONE rebuild per gesture (a moveless click keeps the old
         no-render path, so double-click-to-type is undisturbed) */
      if(movedAny){renderAnnots(layer,s);paintSel(layer);}
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
    /* the same gesture path startMove uses (2026-08-23 perf): sync the
       existing element's inline box from the model instead of rebuilding
       the layer per mousemove; shapes/freehand scale via their viewBox,
       a fitted figure via its 100%-sized <img>, and attached arrows are
       redrawn because their endpoints derive from this box. The one real
       renderAnnots runs on mouseup. */
    var anyArrow=(s.annots||[]).some(function(m){
      return m&&m.k==='arrow';});
    var movedAny=false;
    function mm(ev){
      movedAny=true;
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
      if(el){
        el.style.left=(a.x||0)+'%';el.style.top=(a.y||0)+'%';
        if(a.w!=null){el.style.width=a.w+'%';
          if(a.k==='text') el.style.maxWidth='none';}
        if(a.h!=null&&a.k!=='text') el.style.height=a.h+'%';
      }
      if(anyArrow) redrawArrows(layer,s);
      drawSnapGuides(layer,sx,sy);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);
      /* the ONE rebuild per gesture; a moveless mousedown keeps the old
         no-render path */
      if(movedAny){renderAnnots(layer,s);selectAnnot(layer,idx);}
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
      /* born EMPTY and already carrying its own id: the id is what every
         binding on the slide points at, so it has to exist from the
         first moment the box does */
      :(kind==='flip')
      ?{k:'flip',x:p0.x,y:p0.y,w:0,h:0,fid:flipId(),frames:[],at:0}
      :(kind==='text')
      /* colour comes from the page theme. Born EMPTY and UNBOXED: the
         "Text" placeholder and the default panel both had to be removed
         by hand on every single box (2026-08-19, user: "no placeholder
         text and no background by default"). A box left empty deletes
         itself on blur, so nothing invisible is ever left behind. */
      ?textBorn(p0)
      /* A TABLE is rows of plain strings plus a handful of switches. Not
         HTML: a table you can only fill by typing HTML is a table nobody
         will use, and rows-of-strings is the shape every export already
         knows how to walk (2026-08-20, user asked for "Tables"). The
         header row is a FLAG rather than a separate field, so turning it
         on or off never moves a single cell of data. */
      :(kind==='table')
      ?{k:'table',x:p0.x,y:p0.y,w:0,h:0,size:2.2,thead:1,grid:1,
        sw:1,rows:[['','',''],['','',''],['','','']]}
      :(kind==='line')
      ?{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,nohead:1,sw:SW_DEFAULT,
        color:pageIsLight(pres.pageBg)?'#44525c':'#8aa0b0'}
      :{k:'arrow',x1:p0.x,y1:p0.y,x2:p0.x,y2:p0.y,
        color:'#ff6b57',sw:SW_DEFAULT};
    var boxed=(a.k==='rect'||a.k==='cell'||a.k==='text'
      ||a.k==='table'||a.k==='flip');
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
      /* the item about to be selected is one you JUST DREW, so the tab
         must not follow the selection this time — otherwise placing five
         shapes in a row throws you off Insert after every one */
      justDrew=true;
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
      } else if(tiny&&a.k==='table'){
        a.x=Math.min(p0.x,54);a.y=Math.min(p0.y,72);a.w=44;a.h=24;
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
    if(!a||a.k!=='arrow'||pinned(a)) return;
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
  /* drag one corner. Deliberately the SAME snapping every other drag
     gets, so a corner lines up with the things around it. */
  function startMidPoint(layer,s,idx,mi,ev0){
    ev0.preventDefault();ev0.stopPropagation();
    var a=annotByIdx(s,idx);
    if(!a||!Array.isArray(a.mid)||!a.mid[mi]) return;
    var thr=snapThr(layer);
    var targets=snapTargets(layer,s,[idx]);
    function mm(ev){
      var p=pctPoint(layer,ev);
      var x=p.x,y=p.y,sx=null,sy=null;
      if(!ev.altKey){
        var bx=bestSnap(targets.xs,[x],thr.x);
        if(bx){x+=bx.d;sx=bx.at;}
        var by=bestSnap(targets.ys,[y],thr.y);
        if(by){y+=by.d;sy=by.at;}
      }
      a.mid[mi]=[x,y];
      renderAnnots(layer,s);selectAnnot(layer,idx);
      drawSnapGuides(layer,sx,sy);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      clearSnapGuides(layer);markDirty();
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
      if(a.k!=='arrow'||lockedAll(a)||a.hide) return;
      var d=distToSeg(px,py,
        a.x1/100*r.width,a.y1/100*r.height,
        a.x2/100*r.width,a.y2/100*r.height);
      if(d<bestD){bestD=d;best=i;}
    });
    return best;
  }
  /* ---- MARQUEE: drag a box on empty canvas to select what it touches --
     Mousedown on nothing used to deselect and stop there, so the only way
     to select several items was to shift-click each one - and shift-click
     on a text box was itself broken until 2026-08-20 (2026-08-20, user:
     "You can't drag and select multiple items. The shift and select
     multiple is realyl hard to do").
     TOUCH, not enclose: a band that has to swallow an item whole is
     unusable on a poster where the figures are bigger than the gap you
     have to drag in. Hold Shift or Ctrl to add to what is already
     selected. A drag under the threshold is still just a click, so
     "click empty space to deselect" is unchanged. */
  var MARQUEE_PX=4;
  function startMarquee(layer,s,ev0){
    var add=ev0.shiftKey||ev0.ctrlKey||ev0.metaKey;
    /* HOLD ALT TO SWEEP UP FULLY LOCKED ITEMS TOO. A lock means "not by
       accident", not "never again", and the Objects pane being the only
       way back to a background frame you locked months ago is a long way
       round (TASKS T3). Shift and Ctrl are taken — they add to the
       selection — so Alt it is, and on empty canvas it means nothing
       else. Position-locked items were never excluded here: they select
       and restyle like anything else, they just do not move. */
    var takeLocked=ev0.altKey;
    if(!add) leaveGroup(null);
    var base=add?selSet.filter(function(i){return typeof i==='number';}):[];
    var p0=pctPoint(layer,ev0);
    var band=null,moved=false;
    function mm(ev){
      var p=pctPoint(layer,ev);
      if(!moved){
        var dx=Math.abs(p.x-p0.x)*layer.clientWidth/100;
        var dy=Math.abs(p.y-p0.y)*layer.clientHeight/100;
        if(dx<MARQUEE_PX&&dy<MARQUEE_PX) return;
        moved=true;
        band=document.createElement('div');
        band.className='an-marquee';
        layer.appendChild(band);
      }
      var l=Math.min(p0.x,p.x),t=Math.min(p0.y,p.y);
      var r=Math.max(p0.x,p.x),b=Math.max(p0.y,p.y);
      band.style.left=l+'%';band.style.top=t+'%';
      band.style.width=(r-l)+'%';band.style.height=(b-t)+'%';
      var hit=base.slice();
      (s.annots||[]).forEach(function(a,i){
        /* hidden items are never on the table; fully locked ones are on
           it only when Alt asked for them */
        if(!a||a.hide) return;
        if(lockedAll(a)&&!takeLocked) return;
        var q=annotRectPct(layer,s,i); if(!q) return;
        if(q.r<l||q.l>r||q.b<t||q.t>b) return;
        groupMembers(s,i).forEach(function(j){
          if(hit.indexOf(j)<0) hit.push(j);});
      });
      selSet=hit;
      selAnnot=hit.length?hit[hit.length-1]:null;
      paintSel(layer);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      if(band) band.remove();
      if(!moved){
        /* a plain click on empty canvas: clear, unless you were adding */
        if(!add) selectAnnot(layer,null);
        return;
      }
      /* commit through the normal path so the ribbon and the Layers
         pane follow */
      lastSelSig='';
      showFmt();renderSelPane();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  /* ---- THE CANVAS RIGHT-CLICK MENU -------------------------------------
     Paste has three answers now (the plain one, in place, here) and a
     ribbon cannot grow three buttons for one verb without becoming the
     thing fitEditRibbon spends its life fighting. A right-click is also
     the only door that knows WHERE you clicked, which is precisely the
     question "Paste here" asks -- so the click point is captured when
     the menu opens and handed to pasteBuf, rather than read back from
     the live pointer, which by then is over the menu.
     Built from the film strip's helpers (menuHead / floatAt) so this
     file has one context-menu idiom, not two. */
  function openCanvasMenu(layer,s,ev){
    var old=$('#canvas-menu'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu';m.id='canvas-menu';
    /* the click, in page percentages, frozen at open time */
    var at=pctPoint(layer,ev);
    function row(label,keys,fn,title,icon){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      /* the icon is trusted bic() markup; the LABEL stays a text node */
      if(icon) b.innerHTML=bic(icon)+' ';
      b.appendChild(document.createTextNode(label));
      if(keys){
        var k=document.createElement('kbd');
        k.textContent=keys;b.appendChild(k);
      }
      if(title) b.title=title;
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();fn();});
      m.appendChild(b);
      return b;
    }
    var n=selIdxs().length;
    if(n){
      menuHead(m,n===1?'this object':n+' objects');
      row('Duplicate','Ctrl+D',duplicateSel,
        'An independent copy, just clear of this one — or Alt-drag '
        +'on the page to place it as you go','copy');
      row('Cut','Ctrl+X',function(){
        var c=cutSel();
        if(c) toast(c+' item'+(c===1?'':'s')+' cut');});
      row('Copy','Ctrl+C',function(){
        var c=copySel();
        if(c) toast(c+' item'+(c===1?'':'s')+' copied');});
      row('Delete','Del',deleteSel,null,'exit');
      row('History of this object…','',showObjHist,
        'Every state it has been through that the undo stack still '
        +'remembers, and a button to put any of them back','history');
      /* SELECT BY WHAT THINGS ARE. Inline rather than behind a
         submenu: this is already a menu, and the counts are the point —
         a row that says how many it will take is a row you can trust
         before you click it. */
      var sby=selectByRows();
      if(sby.length){
        menuHead(m,'select on this slide');
        sby.forEach(function(r){
          row(r.label,String(r.n),function(){selectBy(r.key,r.val);});
        });
      }
      /* the lock, in words. The pane's button cycles the same three
         states in a quarter of the space; here they are named, which is
         how anyone finds out the position-only one exists at all. */
      var lms=selIdxs().map(function(i){
        return lockMode((pres.slides[cur].annots||[])[i]);});
      var lmNow=lms.every(function(x){return x===lms[0];})?lms[0]:null;
      menuHead(m,'lock');
      [['','Not locked',null,null],
       ['pos','Lock position',
        'Pinned where it is — still yours to select, resize and '
        +'restyle','pin'],
       ['all','Lock fully',
        'No clicking or dragging on the canvas. The Objects pane, and '
        +'an Alt-marquee, are the way back','lock']]
        .forEach(function(o){
          var b=row(o[1],'',function(){setLockSel(o[0]);},o[2],o[3]);
          if(lmNow===o[0]) b.classList.add('on');
        });
    }
    var cgm=customGuides();
    menuHead(m,'guides');
    row('Draw a guide box','',function(){setTool('guide');},
        'An editing aid to lay out inside \u2014 it snaps, and it is '
        +'never printed, exported or shown while presenting','frame');
    if(cgm.b.length)
      row('Clear the '+cgm.b.length+' guide box'
        +(cgm.b.length===1?'':'es'),'',function(){clearGuides(true);});
    if(cgm.x.length||cgm.y.length)
      row('Clear every guide','',function(){clearGuides(false);},
        'The boxes and the lines dragged off the rulers');
    menuHead(m,'paste');
    if(!clipBuf.length){
      row('Nothing copied yet','',function(){}).disabled=true;
    } else {
      row('Paste','Ctrl+V',function(){pasteBuf('auto');},
        'Nudged clear of the original on this slide; in the same place '
        +'on any other');
      row('Paste in place','Ctrl+Shift+V',function(){pasteBuf('place');},
        'Exactly where it was copied from — the way you put one '
        +'caption in the identical spot on twenty slides');
      row('Paste here','Ctrl+Alt+V',function(){pasteBuf('here',at);},
        'Centred on the point you right-clicked');
    }
    floatAt(m,ev);
  }
  function setLockSel(mode){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var idxs=selIdxs();
    if(!idxs.length) return;
    idxs.forEach(function(i){
      var a=s.annots[i]; if(!a) return;
      if(mode==='pos') a.lock='pos';
      else if(mode==='all') a.lock=1;
      else delete a.lock;
    });
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
    toast(LOCK_LABEL[mode]+(idxs.length===1?''
      :' — '+idxs.length+' items'));
  }
  function wireEditor(layer,s){
    /* a right-click on a corner takes it out, so the browser's own menu
       must not open over the top of the gesture; anywhere else on the
       canvas it opens OUR menu instead (2026-08-24) */
    layer.addEventListener('contextmenu',function(ev){
      if(ev.target&&ev.target.classList
         &&ev.target.classList.contains('an-mid')){ev.preventDefault();return;}
      if(mode!=='edit'||tool!=='select') return;
      ev.preventDefault();
      openCanvasMenu(layer,s,ev);
    });
    layer.addEventListener('mousedown',function(ev){
      if(mode!=='edit') return;
      var t=ev.target;
      /* WHILE A MATCH IS ARMED the canvas is a picker, not an editor: the
         next thing you press is the object you meant, and selecting or
         dragging it instead would be the wrong answer to a gesture you
         have already committed to. Handled at the top of the one handler
         that owns canvas mousedown, so there is no second code path
         deciding what a click means (2026-08-22). */
      if(matchArm){
        var mt=(t.closest&&t.closest('.an-item[data-idx]'));
        if(mt){
          ev.preventDefault();ev.stopPropagation();
          matchHit(+mt.getAttribute('data-idx'));
        }
        return;
      }
      var item=(t.closest&&t.closest('.an-item'))
        ||(t.getAttribute&&t.classList
           &&t.classList.contains('an-item')?t:null);
      if(tool==='select'){
        /* A RIGHT-CLICK PICKS, AND NEVER DRAGS. The menu that follows
           acts on the selection, so the click has to be able to change
           it -- but this handler used to run its full select/move/
           marquee ladder on button 2 as well, which meant the menu
           opened on top of a drag already in progress. The one
           exception is a bend corner, where right-click REMOVES it and
           the endpoint branch below owns the gesture. */
        if(ev.button===2
           &&!(t.classList&&t.classList.contains('an-endpt'))){
          var rraw=item&&item.getAttribute('data-idx');
          if(rraw!=null){
            var ridx=(rraw==='t'||rraw==='s')?rraw:+rraw;
            if(selIdxs().indexOf(ridx)<0) selectAnnot(layer,ridx,false);
          }
          return;
        }
        /* endpoint handles first, then resize handles, then arrows
           (they render on top, so they win the click even over a
           frame), then the item */
        if(t.classList&&t.classList.contains('an-endpt')){
          var idxE=+t.getAttribute('data-idx');
          selectAnnot(layer,idxE);
          /* the faint handle halfway along a segment CREATES a corner and
             then drags it, so adding and placing are one gesture */
          if(t.hasAttribute('data-addat')){
            var at=+t.getAttribute('data-addat');
            var aA=annotByIdx(s,idxE);
            if(aA){
              var mids=arrowMids(aA).slice();
              var pA=pctPoint(layer,ev);
              mids.splice(at,0,[pA.x,pA.y]);
              aA.mid=mids;
              markDirty();renderAnnots(layer,s);selectAnnot(layer,idxE);
              startMidPoint(layer,s,idxE,at,ev);
            }
            return;
          }
          if(t.hasAttribute('data-mid')){
            var mi2=+t.getAttribute('data-mid');
            /* Alt+click takes a corner out; so does a right-click, which
               is what a vector editor has trained everyone to try */
            if(ev.altKey||ev.button===2){
              var aR=annotByIdx(s,idxE);
              if(aR&&Array.isArray(aR.mid)){
                aR.mid.splice(mi2,1);
                if(!aR.mid.length) delete aR.mid;
                markDirty();renderAnnots(layer,s);selectAnnot(layer,idxE);
              }
              return;
            }
            startMidPoint(layer,s,idxE,mi2,ev);
            return;
          }
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
          /* Shift OR Ctrl/Cmd adds and removes; it never starts a drag.
             Ctrl is here because half the world reaches for it first and
             it did nothing at all before (2026-08-20). */
          if((ev.shiftKey||ev.ctrlKey||ev.metaKey)&&typeof idx==='number'){
            selectAnnot(layer,idx,true);return;
          }
          /* clicking outside the group you are inside leaves it */
          if(inGroup!=null&&typeof idx==='number'){
            var ga=(s.annots||[])[idx];
            if(!ga||ga.grp!==inGroup) leaveGroup(null);
          }
          /* clicking an item already in a multi-selection keeps the set and
             drags the whole group */
          if(selSet.indexOf(idx)<0) selectAnnot(layer,idx,false);
          else {selAnnot=idx;paintSel(layer);showFmt();}
          /* every item drags from its body, text included. The only thing
             that does not is a box you are actually typing in. */
          if(!item.classList.contains('an-editing'))
            startMove(layer,s,idx,ev);
        } else startMarquee(layer,s,ev);
        return;
      }
      ev.preventDefault();
      /* A GUIDE IS NOT AN ANNOTATION, so it forks off here rather than
         inside startDraw: startDraw's whole job is building s.annots
         entries, and a guide that never becomes one cannot leak into a
         render or an export later (see the guide-boxes section). */
      if(tool==='guide'){
        startGuideBox(layer,pctPoint(layer,ev));
        return;
      }
      /* EVERY insert tool draws the same way. Text and cell used to be
         the two that did not: they dropped a canned box wherever you
         clicked and left you to resize it by hand, every single time
         (2026-08-17, user: "when you add them it would be good to draw
         them out to the shape you like, they just kind of snap to the one
         shape"). */
      if(tool!=='select') startDraw(layer,s,tool,pctPoint(layer,ev));
    });
    /* double-click a GROUP to step inside it; the second double-click on
       a text box inside then edits its words, as it always did */
    layer.addEventListener('dblclick',function(ev){
      if(mode!=='edit'||tool!=='select') return;
      var it=ev.target.closest&&ev.target.closest('.an-item');
      if(!it){leaveGroup(layer);return;}
      var raw=it.getAttribute('data-idx');
      if(raw==='t'||raw==='s') return;
      var i2=+raw,a2=(s.annots||[])[i2];
      if(!a2||a2.grp==null||inGroup===a2.grp) return;
      ev.stopPropagation();
      inGroup=a2.grp;
      selectAnnot(layer,i2);
      toast('Inside the group \u2014 clicks pick one item. Esc to step out');
    });
  }
  /* every tool that exists. Anything else is NO tool. */
  var TOOLS={select:1,text:1,arrow:1,rect:1,line:1,cell:1,draw:1,
    table:1,flip:1,guide:1};
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
      t==='text'?('Drag on '+pw+' to draw a'
        +(pendingStyle&&styleDef(pendingStyle)
          ?' '+styleDef(pendingStyle).label:' text')
        +' box, or click for one that sizes itself')
      :t==='arrow'?'Drag on '+pw+' to draw an arrow'
      :t==='rect'?('Drag on '+pw+' to draw a '
        +(pendingShape==='rect'?'rectangle':pendingShape))
      :t==='line'?'Drag on '+pw+' to draw a line'
      :t==='cell'?'Drag on '+pw+' to draw a cell frame (or click for the '
        +'usual size), then pick a card from your notebook to fill it'
      :t==='flip'?('Drag on '+pw+' to draw a flip book, then add the '
        +'figures you want to step through')
      :t==='table'?'Drag on '+pw+' to draw a table (or click for a 3\u00d73). '
        +'Double-click a cell to type; Tab moves along, Enter goes down'
      :t==='guide'?'Drag on '+pw+' to draw a guide box \u2014 an editing '
        +'aid to lay out inside. It snaps, and it is never printed, '
        +'exported or shown while presenting'
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
    var idxs=selIdxs();
    if(!idxs.length) return;
    idxs.sort(function(x,y){return y-x;}).forEach(function(i){
      if(i>=0&&i<s.annots.length) s.annots.splice(i,1);});
    if(!s.annots.length) delete s.annots;
    selAnnot=null;selSet=[];markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l) renderAnnots(l,s);
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

  /* ---------- picking: click a notebook card into a cell frame -------
     A flip book is filled by picking SEVERAL cards, so the mode stays
     open and counts them until you say Done. The single-pick flow is
     unchanged: the first click is still the answer (2026-08-22). */
  var pickMulti=false,pickAdded=0;
  function syncPickbar(){
    var w=$('#pick-what'),d=$('#pick-done');
    if(d) d.hidden=!pickMulti;
    if(!w) return;
    if(!pickMulti){
      w.innerHTML=bic('pin')+' Click a card in the notebook to place it '
        +'in the slide';
      return;
    }
    w.innerHTML=bic('pin')+' Click each figure you want in the flip '
      +'book, in order'
      +(pickAdded?(' &mdash; <b>'+pickAdded+' added</b>'):'');
    if(d) d.textContent=pickAdded
      ?('Done — '+pickAdded+' figure'+(pickAdded===1?'':'s'))
      :'Done';
  }
  function startPick(idx,multi){
    if(typeof idx!=='number') return;
    picking=idx;pickMulti=!!multi;pickAdded=0;
    deckEl.hidden=true;
    document.body.classList.remove('deck-open');
    document.body.classList.remove('creating-docs');
    document.body.classList.remove('slide-editing');
    document.body.classList.add('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=false;
    syncPickbar();
  }
  /* one card added to the flip book being filled; the mode stays open */
  function pickAdd(ref){
    var s=pres.slides[cur],a=s&&(s.annots||[])[picking];
    if(!a||a.k!=='flip') return;
    a.frames=flipFrames(a).slice();
    a.frames.push({ref:ref});
    /* land on the frame just added, so Done leaves you looking at it */
    a.at=a.frames.length-1;
    pickAdded++;markDirty(true);syncPickbar();
  }
  function endPick(ref){
    var idx=picking; picking=-1;
    var wasMulti=pickMulti; pickMulti=false;
    document.body.classList.remove('picking');
    var pb=$('#pickbar'); if(pb) pb.hidden=true;
    if(ref!==undefined&&idx>=0){
      var s=pres.slides[cur];
      var a=s&&(s.annots||[])[idx];
      if(a&&a.k==='cell'){a.ref=ref;markDirty();}
      else if(a&&a.k==='flip'){
        a.frames=flipFrames(a).slice();
        a.frames.push({ref:ref});
        a.at=a.frames.length-1;markDirty();
      }
    }
    /* a multi-pick has been writing frames as it went with markDirty(true)
       — one history entry for the whole batch is recorded here, so Ctrl+Z
       undoes "I added six figures" rather than six separate steps */
    if(wasMulti&&pickAdded) markDirty();
    pickAdded=0;
    openDeck('edit');
    var l=stage.querySelector('.annot-layer');
    if(l&&idx>=0) selectAnnot(l,idx);
    if(wasMulti) renderFlipPane();
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
    var pref=nsKey(shellEl.dataset.src||shellEl.dataset.nb,
      card.dataset.anchor);
    if(pickMulti) pickAdd(pref); else endPick(pref);
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
    else a.size=Math.max(1.2,
      (a.size||(a.k==='table'?2.2:2.6))/1.25);});
  onFmt('#fmt-bigger',function(a){
    if(a.k==='cell') a.ts=Math.min(3,
      Math.round((a.ts||1)*1.15*100)/100);
    else a.size=Math.min(20,
      (a.size||(a.k==='table'?2.2:2.6))*1.25);});
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
  /* ---- THE FILL PANEL --------------------------------------------------
     Six worded rows became a panel you pick from by LOOKING. "Gradient —
     linear" told you nothing about which way it ran, and "gradient from
     different directions, multiple colours" was not expressible at all
     (2026-08-20, user: "all the gradient fills are just words. Put images
     showing it. Also put heaps of options in this").
     Every chip is drawn with the shape's OWN colours, so the preview is
     the answer rather than an illustration of one.
     It also absorbs the fill COLOUR swatches. There used to be a "Fill"
     here and a "Fill colour" two groups away, and nobody could tell which
     was which ("Also confusing there is a fill and fill colour"); a shape
     now has exactly one Fill control with everything in it. */
  var GRAD_DIRS=[
    [0,'Left to right'],[45,'Bottom-left to top-right'],
    [90,'Bottom to top'],[135,'Bottom-right to top-left'],
    [180,'Right to left'],[225,'Top-right to bottom-left'],
    [270,'Top to bottom'],[315,'Top-left to bottom-right']];
  /* Ready-made ramps. Each is a list of stops, so three- and four-colour
     gradients are as ordinary as two-colour ones. */
  var GRAD_PRESETS=[
    ['Fade out',      null, [0,1]],
    ['Fade to dark',  ['#00000000','#000000cc'], null],
    ['Fade to white', ['#ffffff00','#ffffffdd'], null],
    ['Ocean',   ['#39a9c0','#1e6f9e','#123a63'], null],
    ['Sunset',  ['#f0a848','#e5484d','#7a2b6b'], null],
    ['Forest',  ['#8fd694','#41c493','#0f5c46'], null],
    ['Ember',   ['#ffd08a','#ff6b57','#8c1d2f'], null],
    ['Violet',  ['#c3a6ff','#7a52c0','#241a4d'], null],
    ['Steel',   ['#dbe6ee','#8aa0b0','#33424f'], null],
    ['Mono',    ['#ffffff','#9aa7b2','#1b2530'], null],
    ['Warm/cool',['#f0a848','#39a9c0'], null],
    ['Three-tone',['#39a9c0','#f0a848','#e5484d'], null]];
  /* a drawn swatch of a fill, as an inline SVG so it is crisp at any dpi
     and needs no image file */
  function fillSwatch(kind,opt,base){
    var w=34,h=22;
    var sv=svgBox('fillsw','0 0 '+w+' '+h,w,h);
    var uid='fsw'+(fillSwatch._n=(fillSwatch._n||0)+1);
    var r=SVG_('rect');
    r.setAttribute('x','0.5');r.setAttribute('y','0.5');
    r.setAttribute('width',w-1);r.setAttribute('height',h-1);
    r.setAttribute('rx','3');
    r.setAttribute('stroke','#ffffff30');
    if(kind==='none'){
      r.setAttribute('fill','none');
      sv.appendChild(r);
      /* the universal "nothing here": a diagonal through an empty box */
      var ln=SVG_('line');
      ln.setAttribute('x1','2');ln.setAttribute('y1',h-2);
      ln.setAttribute('x2',w-2);ln.setAttribute('y2','2');
      ln.setAttribute('stroke','#e5484d');ln.setAttribute('stroke-width','1.6');
      sv.appendChild(ln);
      return sv;
    }
    if(kind==='solid'||kind==='tint'){
      r.setAttribute('fill',kind==='tint'?shapeFill(base,0x2b/255):base);
      sv.appendChild(r);return sv;
    }
    /* a gradient: build the paint server the same way drawShapeSvg does,
       so what you pick is exactly what you get */
    var defs=SVG_('defs');
    var g=opt;
    var gel=SVG_(g.type==='radial'?'radialGradient':'linearGradient');
    gel.setAttribute('id',uid);
    if(g.type==='radial'){
      gel.setAttribute('cx','50%');gel.setAttribute('cy','50%');
      gel.setAttribute('r','62%');
    } else {
      var rad=((+g.ang||0))*Math.PI/180;
      gel.setAttribute('x1',(50-50*Math.cos(rad))+'%');
      gel.setAttribute('y1',(50-50*Math.sin(rad))+'%');
      gel.setAttribute('x2',(50+50*Math.cos(rad))+'%');
      gel.setAttribute('y2',(50+50*Math.sin(rad))+'%');
    }
    gradStops(g).forEach(function(st){
      var s2=SVG_('stop');
      s2.setAttribute('offset',st.o==null?0:st.o);
      s2.setAttribute('stop-color',st.c||base);
      gel.appendChild(s2);
    });
    defs.appendChild(gel);sv.appendChild(defs);
    r.setAttribute('fill','url(#'+uid+')');
    sv.appendChild(r);
    return sv;
  }
  /* evenly spaced stops from a list of colours */
  function stopsFrom(cols){
    var n=cols.length;
    return cols.map(function(c,i){
      return {o:n<2?0:(i/(n-1)),c:c};});
  }
  (function(){
    var wrap=$('#fmt-fillwrap'),btn=$('#fmt-fillstyle'),
        menu=$('#fmt-fillstyle-menu');
    if(!wrap||!btn||!menu) return;
    menu.classList.add('fill-panel');
    function curA(){
      var s2=pres.slides[cur];return annotByIdx(s2,selAnnot);
    }
    function baseCol(){
      var a=curA();
      return (a&&(a.fillc||(a.grad&&gradStops(a.grad)[0].c)||a.color))
        ||'#39a9c0';
    }
    function chip(node,label,on,fn){
      var b=document.createElement('button');
      b.className='fill-chip'+(on?' on':'');
      b.type='button';b.title=label;
      b.setAttribute('aria-pressed',on?'true':'false');
      b.appendChild(node);
      b.addEventListener('click',function(e){
        e.stopPropagation();fn();menu.hidden=true;
        btn.setAttribute('aria-expanded','false');});
      return b;
    }
    function build(){
      var a=curA(); if(!a) return;
      var base=baseCol();
      menu.innerHTML='';
      menuHead(menu,'fill');
      var r1=document.createElement('div');r1.className='fill-row';
      r1.appendChild(chip(fillSwatch('none',null,base),'No fill',
        !a.fill&&!a.grad,function(){
          fmtApply(function(x){x.fill=0;delete x.fillc;delete x.grad;});}));
      r1.appendChild(chip(fillSwatch('tint',null,base),
        'Tint of the outline colour',
        !!a.fill&&!a.grad&&!a.fillc,function(){
          fmtApply(function(x){x.fill=1;delete x.fillc;delete x.grad;});}));
      r1.appendChild(chip(fillSwatch('solid',null,base),'Solid '+base,
        !!a.fill&&!a.grad&&!!a.fillc,function(){
          fmtApply(function(x){
            x.fill=1;x.fillc=x.fillc||x.color||'#39a9c0';delete x.grad;});}));
      menu.appendChild(r1);
      /* the COLOUR, in the same panel — there is no second Fill control */
      menuHead(menu,'fill colour');
      var r2=document.createElement('div');r2.className='fill-row';
      ['#e5484d','#ff6b57','#f0a848','#39a9c0','#46a892','#6b9bff',
       '#a586e8','#ffffff','#8aa0b0','#16202b'].forEach(function(c){
        var sw=document.createElement('span');
        sw.className='fill-dot';sw.style.background=c;
        r2.appendChild(chip(sw,c,a.fillc===c,function(){
          fmtApply(function(x){
            if(x.grad){
              /* recolour the ramp's first stop rather than throwing the
                 gradient away — changing a colour should not silently
                 change the KIND of fill */
              var st=gradStops(x.grad).slice();
              st[0]={o:st[0].o,c:c};
              gradSet(x,{type:x.grad.type,ang:x.grad.ang,stops:st});
            } else {x.fill=1;x.fillc=c;}
          });}));
      });
      var cus=document.createElement('span');
      cus.className='fill-dot fill-custom';
      r2.appendChild(chip(cus,'Custom colour…',false,function(){
        openColorPop('fill',btn);}));
      menu.appendChild(r2);
      menuHead(menu,'gradient — direction');
      var r3=document.createElement('div');r3.className='fill-row';
      GRAD_DIRS.forEach(function(d){
        var g={type:'linear',ang:d[0],
          stops:[{o:0,c:base},{o:1,c:gradPartner(base)}]};
        var on=!!(a.grad&&a.grad.type!=='radial'
          &&(+a.grad.ang||0)===d[0]);
        r3.appendChild(chip(fillSwatch('grad',g,base),d[1],on,function(){
          fmtApply(function(x){
            var b2=x.fillc||(x.grad&&gradStops(x.grad)[0].c)||x.color
              ||'#39a9c0';
            gradSet(x,{type:'linear',ang:d[0],
              stops:[{o:0,c:b2},{o:1,c:gradPartner(b2)}]});});}));
      });
      var gr={type:'radial',stops:[{o:0,c:base},{o:1,c:gradPartner(base)}]};
      r3.appendChild(chip(fillSwatch('grad',gr,base),'From the centre',
        !!(a.grad&&a.grad.type==='radial'),function(){
          fmtApply(function(x){
            var b2=x.fillc||(x.grad&&gradStops(x.grad)[0].c)||x.color
              ||'#39a9c0';
            gradSet(x,{type:'radial',
              stops:[{o:0,c:b2},{o:1,c:gradPartner(b2)}]});});}));
      menu.appendChild(r3);
      menuHead(menu,'gradient — ready-made');
      var r4=document.createElement('div');r4.className='fill-row';
      GRAD_PRESETS.forEach(function(pr){
        var cols=pr[1]||[base,gradPartner(base)];
        var g2={type:'linear',ang:270,stops:stopsFrom(cols)};
        r4.appendChild(chip(fillSwatch('grad',g2,base),pr[0],false,
          function(){
            fmtApply(function(x){
              var cs=pr[1]||[(x.fillc||x.color||'#39a9c0'),
                gradPartner(x.fillc||x.color||'#39a9c0')];
              gradSet(x,{type:'linear',
                ang:(x.grad&&x.grad.ang!=null)?x.grad.ang:270,
                stops:stopsFrom(cs)});});}));
      });
      menu.appendChild(r4);
    }
    /* not wireFloatDropdown: the fill panel REBUILDS on every open to
       reflect the selection, so the helper's static options never fit */
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)) menu.hidden=true;
    });
  })();
  /* alignment, bullets and curve in one worded menu. The curve options
     are listed inline rather than nested — a menu that opens a menu is
     worse than a slightly longer list. */
  wireFloatDropdown('fmt-parawrap','fmt-para','fmt-para-menu',
    [['a:left','Align left'],['a:center','Align centre'],
     ['a:right','Align right'],
     /* indent lives HERE and not on two ribbon buttons of its own:
        #fmt-indent / #fmt-outdent are the list controls and only make
        sense with the caret inside a list, whereas this indents the whole
        box. Two more always-on buttons would have cost the widest ribbon
        case about 56px it does not have (2026-08-22). */
     ['i:+','Indent this box'],['i:-','Outdent this box'],
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
      if(v.indexOf('i:')===0){
        var out=v.slice(2)==='-';
        fmtApply(function(a){boxIndent(a,out);});
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
  /* ---- LINE SPACING ---------------------------------------------------
     A MULTIPLE of the type size, the way every word processor states it -
     so it means the same thing at every zoom and on every page size, and
     needs no re-measuring. Paragraph spacing is the half nobody asks for
     until their bullets are touching each other. */
  /* ---- INDENTATION ----------------------------------------------------
     Whole-box indent, in em of the box's own type size, stepped rather
     than typed \u2014 the same currency and the same shape as line and
     paragraph spacing beside it. Capped at four steps because a fifth
     leaves nothing to indent INTO on a slide. */
  var IND_STEP=2;
  function boxIndent(a,out){
    var v=(a.ind||0)+(out?-IND_STEP:IND_STEP);
    v=Math.max(0,Math.min(IND_STEP*4,v));
    if(v) a.ind=v; else delete a.ind;
  }
  var LH_STEPS=[[0,'Default'],[1,'Single'],[1.15,'1.15'],[1.5,'1\u00bd'],
    [2,'Double'],[2.5,'2\u00bd'],[3,'Triple']];
  var PS_STEPS=[[0,'None'],[0.25,'Small'],[0.5,'Medium'],[1,'Large'],
    [1.5,'Very large']];
  (function(){
    var wrap=$('#fmt-lhwrap'),btn=$('#fmt-lh'),menu=$('#fmt-lh-menu');
    if(!wrap||!btn||!menu) return;
    function build(){
      var s2=pres.slides[cur],a=annotByIdx(s2,selAnnot);
      menu.innerHTML='';
      menuHead(menu,'between lines');
      LH_STEPS.forEach(function(st){
        var b=document.createElement('button');
        b.className='dbtn vw-opt';b.textContent=st[1];
        b.setAttribute('aria-pressed',
          (((a&&a.lh)||0)===st[0]).toString());
        b.addEventListener('click',function(e){
          e.stopPropagation();
          fmtApply(function(x){
            if(st[0]) x.lh=st[0]; else delete x.lh;});
          menu.hidden=true;
        });
        menu.appendChild(b);
      });
      menuHead(menu,'between paragraphs');
      PS_STEPS.forEach(function(st){
        var b=document.createElement('button');
        b.className='dbtn vw-opt';b.textContent=st[1];
        b.setAttribute('aria-pressed',
          (((a&&a.pspace)||0)===st[0]).toString());
        b.addEventListener('click',function(e){
          e.stopPropagation();
          fmtApply(function(x){
            if(st[0]) x.pspace=st[0]; else delete x.pspace;});
          menu.hidden=true;
        });
        menu.appendChild(b);
      });
    }
    /* not wireFloatDropdown: rebuilt on every open so the aria-pressed
       marks track the selection — no static options list to hand over */
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)) menu.hidden=true;
    });
  })();
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
  /* ---- table structure ---------------------------------------------
     Rows and columns are added at the END. "Insert above the cell I am
     in" needs a selected CELL, which would be a second kind of selection
     living beside the item selection, and nothing else in this editor has
     one - so the honest version is the one that always works. */
  function tblApply(fn){
    fmtApply(function(a){if(a.k==='table') fn(a);});
  }
  onBtn('#fmt-tbl-rowplus',function(){tblApply(function(a){
    tableGrow(a,'row',1);});});
  onBtn('#fmt-tbl-rowminus',function(){tblApply(function(a){
    tableGrow(a,'row',-1);});});
  onBtn('#fmt-tbl-colplus',function(){tblApply(function(a){
    tableGrow(a,'col',1);});});
  onBtn('#fmt-tbl-colminus',function(){tblApply(function(a){
    tableGrow(a,'col',-1);});});
  onBtn('#fmt-tbl-head',function(){tblApply(function(a){
    if(a.thead) delete a.thead; else a.thead=1;});});
  onBtn('#fmt-tbl-grid',function(){tblApply(function(a){
    if(a.grid===0) a.grid=1; else a.grid=0;});});
  /* ---- the Styles menu ------------------------------------------------
     Picking a style stamps it. "Update from this one" is the other half
     and the reason a style registry is worth having at all: format ONE
     heading the way you want it, then push that look to every heading in
     the deck without touching them one at a time. */
  (function(){
    var menu=$('#fmt-style-menu-tx');
    if(!menu) return;
    function build(){
      menu.innerHTML='';
      var s2=pres.slides[cur],a=annotByIdx(s2,selAnnot);
      var curId=a&&a.style;
      menuHead(menu,'apply a style');
      styleOrder().forEach(function(id){
        var d=styleDef(id);
        var b=document.createElement('button');
        b.className='dbtn vw-opt jv-styleopt';
        b.setAttribute('aria-pressed',(curId===id).toString());
        var t=document.createElement('span');
        t.className='jv-stylename';
        t.textContent=d.label;
        /* the row is a SPECIMEN: it is set in the style it names, so you
           pick by looking rather than by reading a number */
        t.style.fontWeight=d.b?'700':'400';
        if(d.i) t.style.fontStyle='italic';
        t.style.fontSize=Math.max(11,Math.min(21,d.size*3.1))+'px';
        if(d.color) t.style.color=d.color;
        b.appendChild(t);
        var n=document.createElement('span');
        n.className='jv-stylesz';
        n.textContent=Math.round(d.size*5.4)+' pt';
        b.appendChild(n);
        b.addEventListener('click',function(e){
          e.stopPropagation();
          fmtApply(function(x){
            if(x.k==='text') applyStyleTo(x,id);});
          menu.hidden=true;
        });
        menu.appendChild(b);
      });
      menuHead(menu,'this deck');
      var upd=document.createElement('button');
      upd.className='dbtn vw-opt';
      upd.innerHTML=bic('reload')+' Update the style from this box';
      upd.title='Take this box\u2019s size, weight, font and colour and '
        +'make them the style \u2014 every other box wearing it follows';
      upd.disabled=!curId;
      upd.addEventListener('click',function(e){
        e.stopPropagation();
        var s3=pres.slides[cur],a3=annotByIdx(s3,selAnnot);
        if(!a3||!a3.style) return;
        var d3={size:a3.size,label:STYLE_DEFAULTS[a3.style].label};
        /* whether a type counts as a heading is a property of the TYPE,
           not of the box you happened to select — carry it forward or a
           custom heading silently stops being one the first time anyone
           updates it from a box (2026-08-22) */
        if(STYLE_DEFAULTS[a3.style].head) d3.head=1;
        if(a3.b) d3.b=1;
        if(a3.i) d3.i=1;
        if(a3.font) d3.font=a3.font;
        if(a3.color) d3.color=a3.color;
        deckStyles()[a3.style]=d3;
        restyleDeck([a3.style]);
        menu.hidden=true;
        toast('\u201c'+d3.label+'\u201d updated everywhere');
      });
      menu.appendChild(upd);
      var all=document.createElement('button');
      all.className='dbtn vw-opt';
      all.innerHTML=bic('inherit')+' Apply this look to ALL headings';
      all.title='Push this box\u2019s weight, font and colour to Title '
        +'and Headings 1\u20133, keeping each one\u2019s own size';
      all.addEventListener('click',function(e){
        e.stopPropagation();
        var s4=pres.slides[cur],a4=annotByIdx(s4,selAnnot);
        if(!a4){menu.hidden=true;return;}
        headingStyles().forEach(function(id){
          var d4=deckStyles()[id]||{};
          /* SIZE is what makes a heading level a level, so it is the one
             thing this does not flatten */
          d4.size=(deckStyles()[id]||{}).size||STYLE_DEFAULTS[id].size;
          d4.label=STYLE_DEFAULTS[id].label;
          if(a4.b) d4.b=1; else delete d4.b;
          if(a4.i) d4.i=1; else delete d4.i;
          if(a4.font) d4.font=a4.font; else delete d4.font;
          if(a4.color) d4.color=a4.color; else delete d4.color;
          deckStyles()[id]=d4;
        });
        restyleDeck(headingStyles());
        menu.hidden=true;
        toast('Every heading in this presentation now matches');
      });
      menu.appendChild(all);
      /* the same idea as the row above it, opened out: any type rather
         than the four headings, any property set rather than all of
         them, any slides rather than the whole deck. It is repeated here
         as well as in Arrange because this is where the one-click
         version has always lived, and that is where people will look for
         the fuller one (2026-08-22). */
      var more=document.createElement('button');
      more.className='dbtn vw-opt';
      more.innerHTML=bic('inherit')+' Apply this look to…';
      more.title='Choose which properties travel and which slides they '
        +'travel to';
      more.addEventListener('click',function(e){
        e.stopPropagation();
        menu.hidden=true;
        if(typeof window.SemDeckApplyDlg==='function')
          window.SemDeckApplyDlg();
      });
      menu.appendChild(more);
    }
    /* walk the whole deck and re-stamp anything wearing these styles.
       This was a byte-for-byte copy of restyleAll with the "no ids means
       everything" branch removed; now that restyleAll takes a slide scope
       there is a real reason not to keep two of them drifting apart, so
       this is a name kept for its callers and nothing more. */
    function restyleDeck(ids){
      return restyleAll(ids,null);
    }
    var btn=$('#fmt-style-tx');
    if(btn) btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn)
        menu.hidden=true;
    });
  })();
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
  /* the .pptx exporter speaks in two colours, so every gradient written
     here also carries its first and last stop in the old a/b fields */
  function gradSet(a,g){
    var st=gradStops(g);
    g.stops=st;
    g.a=st[0].c;g.b=st[st.length-1].c;
    a.fill=1;a.grad=g;
    delete a.fillc;
  }
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
  /* ---- CLONES ----------------------------------------------------------
     A clone is an INDEPENDENT copy: it shares nothing with its source,
     and editing either one never touches the other. Copies that DO stay
     linked to a definition are a different feature (TASKS T13), and
     keeping the two verbs apart from the first line of this section is
     the point of saying so here.

     Two gestures, one function:
       Ctrl+D / the Copy button -- clone the whole selection with a small
         offset, so the copies are visible instead of hidden exactly
         under their originals;
       Alt-drag -- clone in place and drag the COPIES, leaving the
         originals where they were. Every vector editor does this, and it
         is how a row of five of something actually gets laid out.

     Groups survive: clone two members of a group of five and you get a
     pair that still moves as one, in a NEW group -- not two loose items,
     and not all five. Duplicating used to act on selAnnot alone, so
     "duplicate" on a five-item selection gave you one item.  */
  var CLONE_OFF=3;      /* enough to see; small enough to still read as
                           "this, and its copy" */
  /* a duplicate that lands off the bottom-right corner is a duplicate you
     have to go looking for -- but an item ALREADY out there stays where
     its owner put it, strays being a supported state (an-offpage) */
  function cloneShift(v,d){
    var n=(v||0)+d;
    return (d>0&&n>96&&(v||0)<=96)?96:n;
  }
  function cloneAnnots(idxs,dx,dy){
    var s=pres.slides[cur];
    if(!s||!s.annots) return [];
    var live=idxs.filter(function(i){
      return typeof i==='number'&&s.annots[i];});
    if(!live.length) return [];
    var first=s.annots.length,gnext=nextGrp(s),gmap={},made=[];
    live.forEach(function(i){
      var cp=deep(s.annots[i]);
      /* one new group id per source group, allocated up front: nextGrp
         reads the max off s.annots, so asking it twice before pushing
         would hand out the same number twice */
      if(cp.grp!=null){
        if(gmap[cp.grp]==null) gmap[cp.grp]=gnext++;
        cp.grp=gmap[cp.grp];
      }
      /* its own build step, rather than sharing the source's */
      if(cp.anim) cp.anim={type:cp.anim.type,order:nextAnimOrder(s)};
      if(cp.k==='arrow'){
        cp.x1+=dx;cp.y1+=dy;cp.x2+=dx;cp.y2+=dy;
        if(Array.isArray(cp.mid)) cp.mid=cp.mid.map(function(m){
          return [m[0]+dx,m[1]+dy];});
      } else {
        cp.x=cloneShift(cp.x,dx);cp.y=cloneShift(cp.y,dy);
      }
      s.annots.push(cp);made.push(s.annots.length-1);
    });
    /* an attached arrow endpoint holds an INDEX. Clone the arrow AND its
       target together and the copy should point at the copy; clone the
       arrow alone and the original target is still on this slide, so its
       index is still good and the tie is left alone. */
    var remap={};
    live.forEach(function(src,n){remap[src]=first+n;});
    made.forEach(function(j){
      var cp=s.annots[j];
      if(!cp||cp.k!=='arrow') return;
      if(cp.c1&&remap[cp.c1.i]!=null) cp.c1={i:remap[cp.c1.i]};
      if(cp.c2&&remap[cp.c2.i]!=null) cp.c2={i:remap[cp.c2.i]};
    });
    /* a named group keeps its name on the copy, said to be one */
    if(s.grpmeta) Object.keys(gmap).forEach(function(g){
      var m=s.grpmeta[g]; if(!m) return;
      var m2=deep(m);
      if(m2.name) m2.name+=' copy';
      s.grpmeta[gmap[g]]=m2;
    });
    return made;
  }
  function duplicateSel(){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    /* a fully locked item cannot even be clicked, so an unlocked twin
       dropped on top of it would be a puzzle rather than a duplicate. A
       PINNED one clones happily: the copy is a free item. */
    var idxs=selIdxs().filter(function(i){
      var a=s.annots[i];return a&&!lockedAll(a);});
    if(!idxs.length) return;
    var made=cloneAnnots(idxs,CLONE_OFF,CLONE_OFF);
    if(!made.length) return;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);selectMany(l,made);}
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
  /* which slide the clipboard came from: pasting onto a DIFFERENT slide
     should land in the same place, which is the whole point of copying
     something across (2026-08-20, user: "copying and pasting something
     from one slide to another should be pasted into the same location on
     the other slide that it was copied from"). Pasting onto the SAME
     slide still offsets, or the copy hides exactly under its original. */
  var clipFrom=-1;
  /* which annots the buffer came from, index-aligned with clipBuf: an
     attached arrow endpoint stores an INDEX, so a paste has to be able
     to say "that one is in this set too" (see retie in pasteBuf) */
  var clipIdx=[];
  /* the pointer's last position over the stage, in CLIENT coordinates
     (recorded by the ruler-cursor handler, which costs nothing to do
     there). Null once it leaves, or before it has ever been there. */
  var lastCanvasXY=null;
  /* the pointer as a percentage of the page. Null when it is off the
     page, which is the case "Paste here" has to have an answer for. */
  function pointerPct(){
    var slideEl=stage&&stage.querySelector('.slide');
    if(!slideEl||!lastCanvasXY) return null;
    var r=slideEl.getBoundingClientRect();
    if(!r.width||!r.height) return null;
    var x=(lastCanvasXY.x-r.left)/r.width*100;
    var y=(lastCanvasXY.y-r.top)/r.height*100;
    if(x<0||x>100||y<0||y>100) return null;
    return {x:x,y:y};
  }
  /* the clipboard set's own bounding box, from its STORED geometry --
     the items are not on the page, so there is nothing to measure with
     annotRectPct. A text box that sizes itself has no w/h and counts as
     its top-left corner, which is the point being placed anyway. */
  function clipBox(buf){
    var l=1e9,t=1e9,r=-1e9,b=-1e9;
    buf.forEach(function(a){
      var x1,y1,x2,y2;
      if(a.k==='arrow'){
        x1=Math.min(a.x1,a.x2);x2=Math.max(a.x1,a.x2);
        y1=Math.min(a.y1,a.y2);y2=Math.max(a.y1,a.y2);
      } else {
        x1=a.x||0;y1=a.y||0;x2=x1+(a.w||0);y2=y1+(a.h||0);
      }
      if(x1<l) l=x1;
      if(y1<t) t=y1;
      if(x2>r) r=x2;
      if(y2>b) b=y2;
    });
    return (l>r||t>b)?null:{l:l,t:t,r:r,b:b};
  }
  function copySel(){
    var s=pres.slides[cur];
    var idxs=selectedIdxs(); if(!s||!idxs.length) return 0;
    clipFrom=cur;              /* where it came from - see pasteBuf */
    clipIdx=idxs.slice();
    clipBuf=idxs.map(function(i){
      return deep(s.annots[i]);});
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
  /* WHERE A PASTE LANDS. Three answers, because three different
     questions get asked of the same buffer (2026-08-24, TASKS T1):

       'auto'   Ctrl+V, and the rule that was already here. Onto the SAME
                slide it nudges, or the copy hides exactly under its
                original; onto ANOTHER slide it lands in the same place,
                which is the whole point of copying across (2026-08-20).
       'place'  Ctrl+Shift+V. The source's coordinates exactly, same
                slide included -- how a caption or a logo ends up in the
                identical spot on twenty slides. It never cascades, so
                pasting it into ten slides really does give ten items in
                ten identical positions.
       'here'   Ctrl+Alt+V, or the right-click menu, which is the only
                door that knows where you clicked. A multi-item copy
                keeps its own internal arrangement -- the SET moves, not
                each item on its own -- and falls back to the middle of
                the page when the pointer is not over it.

     `at` is a point in page percentages; 'here' from the menu passes the
     click, the shortcut passes nothing and the live pointer is used. */
  function pasteBuf(how,at){
    var s=pres.slides[cur];
    if(!s||!clipBuf.length) return 0;
    s.annots=s.annots||[];
    var first=s.annots.length;
    var dx=0,dy=0;
    if(how==='here'){
      var box=clipBox(clipBuf),pt=at||pointerPct()||{x:50,y:50};
      if(box){
        dx=pt.x-(box.l+box.r)/2;dy=pt.y-(box.t+box.b)/2;
        /* keep the set ON the page: a paste you cannot see is a paste
           you will not find */
        if(box.l+dx<0) dx=-box.l;
        else if(box.r+dx>100) dx=100-box.r;
        if(box.t+dy<0) dy=-box.t;
        else if(box.b+dy>100) dy=100-box.b;
      }
    } else if(how!=='place'){
      dx=dy=(clipFrom===cur)?3:0;
    }
    /* an attached arrow endpoint (`c1`/`c2` = {i:index}) points into the
       annots of the slide it was copied from. Re-point it at the pasted
       COPY where that copy is in this same set; leave it alone when the
       original is still on this slide; drop it otherwise -- an index
       carried across slides silently ties the arrow to whatever happens
       to sit at that number over there. */
    var remap={};
    clipIdx.forEach(function(src,n){remap[src]=first+n;});
    function retie(c){
      if(!c||typeof c.i!=='number') return null;
      if(remap[c.i]!=null) return {i:remap[c.i]};
      return (clipFrom===cur)?c:null;
    }
    clipBuf.forEach(function(src){
      var cp=deep(src);
      delete cp.grp;          /* a paste is its own item, never in the
                                 source's group */
      if(cp.anim) cp.anim={type:cp.anim.type,order:nextAnimOrder(s)};
      if(cp.k==='arrow'){
        cp.x1+=dx;cp.y1+=dy;cp.x2+=dx;cp.y2+=dy;
        /* the bend corners travel with the line they belong to. They did
           not, so a pasted elbow arrow came out with its middle left
           behind at the original's coordinates (found while giving paste
           three modes; nudgeSel already moved them) */
        if(Array.isArray(cp.mid)) cp.mid=cp.mid.map(function(m){
          return [m[0]+dx,m[1]+dy];});
        var t1=retie(cp.c1),t2=retie(cp.c2);
        if(t1) cp.c1=t1; else delete cp.c1;
        if(t2) cp.c2=t2; else delete cp.c2;
      }
      else {cp.x=(cp.x||0)+dx;cp.y=(cp.y||0)+dy;}
      s.annots.push(cp);
    });
    /* paste again and the next copy lands clear of this one, rather than
       stacking every paste on the same 3% offset. Ctrl+V ONLY: a "paste
       in place" that crept 3% each time would not be paste in place, and
       "paste here" is told where to go every single time. */
    if(how!=='place'&&how!=='here') clipBuf=clipBuf.map(function(cp){
      var n=deep(cp);
      if(n.k==='arrow'){n.x1+=3;n.y1+=3;n.x2+=3;n.y2+=3;
        if(Array.isArray(n.mid)) n.mid=n.mid.map(function(m){
          return [m[0]+3,m[1]+3];});}
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
  /* KEEP THE PICTURE OUT OF THE QUOTA. An image annot carries its whole
     payload as a base64 data URI inside `pres`, and markDirty stringifies
     `pres` into localStorage on EVERY edit — so two full-resolution
     screenshots on a poster exhausted the ~5MB budget, after which every
     later edit was discarded while the UI went on saying "saved". This
     codebase already made exactly that argument for embedded card
     snapshots and moved them to IndexedDB (see the note by EMBED); the
     `image` kind was simply left behind.
     Moving image payloads out of `pres` is the real fix and is still to
     do. This caps what can arrive in the meantime: nothing on a slide or
     an A0 poster needs more than ~2400px on its long edge, and the
     re-encode is typically a 5-10x saving with nothing visible lost.
     PNG stays PNG so a logo keeps its transparency, and a re-encode that
     comes out bigger is thrown away (2026-08-22). */
  var IMG_MAX_EDGE=2400;
  function shrinkImage(img,dataUrl){
    try{
      var w=img&&img.naturalWidth||0,h=img&&img.naturalHeight||0;
      if(!w||!h) return dataUrl;
      var big=Math.max(w,h);
      if(big<=IMG_MAX_EDGE) return dataUrl;
      var k=IMG_MAX_EDGE/big;
      var cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(w*k));
      cv.height=Math.max(1,Math.round(h*k));
      var cx=cv.getContext('2d');
      if(!cx) return dataUrl;
      cx.drawImage(img,0,0,cv.width,cv.height);
      var isPng=/^data:image\/png/i.test(String(dataUrl||''));
      var out=isPng?cv.toDataURL('image/png')
        :cv.toDataURL('image/jpeg',0.9);
      return (out&&out.length<String(dataUrl||'').length)?out:dataUrl;
    }catch(e){return dataUrl;}
  }
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
        var payload=shrinkImage(img,fr.result);
        s.annots.push({k:'image',x:50-w/2,y:50-h/2,w:w,h:h,
          src:payload});
        markDirty();
        var l=stage.querySelector('.annot-layer');
        if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
        toast(payload===fr.result?'Image pasted'
          :'Image pasted — resized to '+IMG_MAX_EDGE+'px so it fits in '
            +'the saved deck');
      };
      img.onerror=function(){toast('That image could not be read');};
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
    return true;
  }
  /* Ctrl+Shift+V / Ctrl+Alt+V are preventDefaulted on keydown, but not
     every engine agrees that this stops the paste event — and one that
     still fires would run the plain paste on top of the placed one. The
     explicit modes raise this for a beat; the timer clears it in case
     the event never comes at all. */
  var pasteHandled=null;
  function tookPaste(){
    if(pasteHandled) clearTimeout(pasteHandled);
    pasteHandled=setTimeout(function(){pasteHandled=null;},300);
  }
  document.addEventListener('paste',function(e){
    /* the Ctrl+V keydown armed a fallback in case this event never comes
       (some engines fire no paste on a non-editable focus) — it did, so
       disarm it before anything else or the item would paste twice */
    if(pendingPaste){clearTimeout(pendingPaste);pendingPaste=null;}
    if(pasteHandled){
      clearTimeout(pasteHandled);pasteHandled=null;
      e.preventDefault();return;
    }
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
  /* MOVE ONE ITEM BY A DELTA. A line has no x/y — it is two endpoints
     and any corners dragged into it — so "move" is a different sentence
     for it, and every caller that has ever written the box version by
     hand has had to remember that. One function, so the next one does
     not (2026-08-25, factored out for T8's layout matching). */
  function shiftAnnot(a,dx,dy){
    if(!a||(!dx&&!dy)) return;
    if(a.k==='arrow'){
      a.x1+=dx;a.y1+=dy;a.x2+=dx;a.y2+=dy;
      if(Array.isArray(a.mid)) a.mid=a.mid.map(function(m){
        return [m[0]+dx,m[1]+dy];});
    } else {a.x=(a.x||0)+dx;a.y=(a.y||0)+dy;}
  }
  function nudgeSel(dx,dy){
    var s=pres.slides[cur]; if(!s) return;
    if(selAnnot==='t'||selAnnot==='s'){
      var tp=titleProps(s,selAnnot);tp.x+=dx;tp.y+=dy;
    } else {
      var idxs=selIdxs();
      if(!idxs.length||!s.annots) return;
      idxs.forEach(function(i){
        var a=s.annots[i]; if(!a||pinned(a)) return;   /* no nudge */
        shiftAnnot(a,dx,dy);
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
  /* ---- STACKING ORDER -------------------------------------------------
     There is no z property: order in s.annots IS the order on the page,
     so every one of these is an array move. It used to act on selAnnot
     alone, so bringing a GROUP to the front brought one member of it and
     left the rest behind (2026-08-20).
     `step` moves one place instead of all the way, which is what you
     actually want when three things overlap - the user asked for "the
     bring to forewards send to back" and Word/PowerPoint give you both
     pairs. */
  function zReorder(front,step){
    var s=pres.slides[cur];
    if(!s||!s.annots) return;
    var idxs=selIdxs();
    if(!idxs.length) return;
    idxs=idxs.slice().sort(function(a,b){return a-b;});
    var n=s.annots.length;
    /* already as far as it goes: say so rather than silently doing
       nothing, which reads as a broken button */
    var atEnd=front
      ?idxs[0]===n-idxs.length
      :idxs[idxs.length-1]===idxs.length-1;
    if(atEnd&&!step) return;
    var moving=idxs.map(function(i){return s.annots[i];});
    var rest=s.annots.filter(function(a,i){return idxs.indexOf(i)<0;});
    /* idxs[0] is the LOWEST selected index, so every item below it is in
       `rest` — which makes idxs[0] exactly the insertion point that would
       leave the block where it is. One step is one either side of that. */
    var at0=idxs[0];
    var at=step
      ?(front?Math.min(rest.length,at0+1):Math.max(0,at0-1))
      :(front?rest.length:0);
    s.annots=rest.slice(0,at).concat(moving,rest.slice(at));
    /* the selection is a set of INDICES, so it has to be rebuilt */
    var moved=[];
    for(var k=0;k<moving.length;k++) moved.push(at+k);
    selSet=moved;selAnnot=moved[moved.length-1];
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);showFmt();renderSelPane();}
  }
  function zMove(front){zReorder(front,false);}
  var fwdBtn=$('#fmt-forward');
  if(fwdBtn) fwdBtn.addEventListener('click',function(){
    zReorder(true,true);});
  var bwdBtn=$('#fmt-backward');
  if(bwdBtn) bwdBtn.addEventListener('click',function(){
    zReorder(false,true);});
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
        if(!a||a.k==='arrow'||pinned(a)||a.hide) return null;
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
    /* w / h / both take the BIGGEST as the model: matching down to the
       smallest usually crops something, matching up never does
       (2026-08-20) */
    if(mode==='w'||mode==='h'||mode==='both'){
      ref=null;
      items.forEach(function(x){
        var v=(mode==='h')?x.h:(mode==='w'?x.w:x.w*x.h);
        var rv=ref?((mode==='h')?ref.h:(mode==='w'?ref.w:ref.w*ref.h)):-1;
        if(v>rv) ref=x;});
    }
    if(!ref) ref=items[items.length-1];  /* the reference was an arrow */
    items.forEach(function(x){
      if(x===ref) return;
      if(x.a.k==='cell'){x.a.x=x.r.l;x.a.y=x.r.t;}
      if(mode!=='h') x.a.w=ref.w;
      if(x.a.k!=='text'&&mode!=='w') x.a.h=ref.h;
    });
    toast(mode==='w'?'Matched widths to the widest'
      :mode==='h'?'Matched heights to the tallest'
      :mode==='both'?'Matched sizes to the biggest'
      :('Same size: matched the '+
        (mode==='first'?'first selected':mode==='last'?'last selected'
         :mode)+' item'));
    rerenderSel();
  }
  /* ---- centre on the PAGE ---------------------------------------------
     Aligning puts items in line with EACH OTHER; this puts them in line
     with the page. With one item selected the two look the same, which is
     why nobody notices the difference until they want a block of three
     centred and discover that aligning centres them on their own average
     (2026-08-20). The selection moves as one, so the arrangement inside
     it is preserved. */
  function centreOnPage(how){
    var items=selRects();
    if(!items.length){toast('Select something first');return;}
    var bb=selBBox(items);
    var dx=(how==='vmiddle')?0:(50-(bb.l+bb.r)/2);
    var dy=(how==='hcenter')?0:(50-(bb.t+bb.b)/2);
    items.forEach(function(x){placeAt(x,x.r.l+dx,x.r.t+dy);});
    rerenderSel();
    toast('Centred on the page');
  }
  /* ---- close the gaps -------------------------------------------------
     The opposite of "space them evenly": push everything up against its
     neighbour, in order, keeping the first one where it is. This is the
     one you want after deleting something out of a row. */
  function closeGaps(axis){
    var items=selRects();
    if(needTwo(items,'close the gaps between')) return;
    var horiz=(axis==='h');
    items.sort(function(a,b){
      return horiz?(a.r.l-b.r.l):(a.r.t-b.r.t);});
    var GAP=1.2;                 /* a hair of air, not a hard butt joint */
    var at=horiz?items[0].r.l:items[0].r.t;
    items.forEach(function(x){
      if(horiz){placeAt(x,at,x.r.t);at+=x.w+GAP;}
      else {placeAt(x,x.r.l,at);at+=x.h+GAP;}
    });
    rerenderSel();
    toast('Closed the gaps');
  }
  /* ---- flip ------------------------------------------------------------
     Mirror the selection within its own bounding box. With one item that
     is a no-op on its position and only matters to arrows and freehand,
     which carry real geometry to mirror; with several it reverses their
     order, which is the useful case. */
  function flipSel(axis){
    var items=selRects();
    if(!items.length){toast('Select something first');return;}
    var bb=selBBox(items),horiz=(axis==='h');
    items.forEach(function(x){
      if(horiz) placeAt(x,bb.l+bb.r-x.r.l-x.w,x.r.t);
      else placeAt(x,x.r.l,bb.t+bb.b-x.r.t-x.h);
      var a=x.a;
      /* an arrow's endpoints are its geometry, so they mirror too */
      if(a.k==='arrow'){
        if(horiz){var t1=a.x1;a.x1=bb.l+bb.r-a.x2;a.x2=bb.l+bb.r-t1;}
        else {var t2=a.y1;a.y1=bb.t+bb.b-a.y2;a.y2=bb.t+bb.b-t2;}
      } else if(a.k==='draw'&&Array.isArray(a.pts)){
        a.pts=a.pts.map(function(q){
          return horiz?[1-q[0],q[1]]:[q[0],1-q[1]];});
      }
    });
    rerenderSel();
    toast(horiz?'Flipped left to right':'Flipped top to bottom');
  }
  /* ---- quarter turns and straighten ----------------------------------- */
  function turnSel(deg){
    var n=0;
    fmtApply(function(a){
      n++;
      if(!deg){delete a.rot;return;}
      a.rot=(((+a.rot||0)+deg)%360+360)%360;
      if(!a.rot) delete a.rot;
    });
    if(!n) return;
    toast(!deg?'Straightened':(deg>0?'Turned right':'Turned left'));
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
  /* ---- MATCH ANOTHER SLIDE --------------------------------------------
     The single most tedious thing about building a deck is making slide 7
     sit exactly like slide 3 — the heading in the same place, the figure
     the same size, the caption the same style. PowerPoint's answer is to
     duplicate a slide and replace its contents, which loses the contents
     you already had (2026-08-20, user: "would be cool if there was a
     'match other slide' option ... the text style, locations and sizes of
     everything become that same").
     It works by KIND, in reading order: the first heading here takes the
     first heading there's box and look, the first figure takes the first
     figure's, and so on. That is enough to be right almost every time and
     simple enough to explain in one sentence — which matters more than
     cleverness for something that moves your work about.
     What it deliberately does NOT do is move content between slides.
     Nothing is added, nothing is deleted; only geometry and styling
     travel. */
  function matchKey(a){
    /* what counts as "the same kind of thing". A text box's ROLE is its
       named style when it has one, so a Heading 1 matches a Heading 1 and
       not just any old text. */
    if(!a) return '';
    if(a.k==='text') return 'text:'+(a.style||'body');
    if(a.k==='cell'){
      /* a placed figure and a placed table are not interchangeable */
      return 'cell:'+(a.part||'auto');
    }
    return a.k;
  }
  /* ---- WHAT COUNTS AS "ONE OF THESE" ----------------------------------
     matchKey answers a narrow question for Match slide: which item on
     THIS slide pairs with which item on THAT one. typeKeyOf answers the
     wider one the user asks out loud — "apply to all objects of this
     type" (2026-08-22) — and the two differ in exactly two places, which
     is why this is a sibling and matchKey is not touched.

     A placed frame is keyed by the part it ACTUALLY shows (partOf), not
     by the raw a.part: a figure left on 'auto' and a figure explicitly
     set to 'figure' are the same thing on the page, so a button that says
     "every figure in this deck" must not put them in two buckets. Match
     slide is right to keep the raw value — it is pairing, not counting.

     And an UNSTYLED text box is grouped by its SIZE rather than falling
     into Body. matchKey's 'body' default exists so a plain box still
     pairs with something on another slide; here it would take one
     hand-formatted heading and push its look onto every caption in the
     deck. That is not a corner case — most decks have never used a named
     style, which is the whole reason the standardise check exists — and
     it is exactly what happened the first time this was driven in a
     browser (2026-08-22).
     Quantised in LOG space at the same ~6% the standardise bands use,
     because a type scale is multiplicative: two sizes within 6% were
     nudged apart by hand and meant to be one size, and 12% apart is one
     press of A+ and is meant. */
  function textBand(a){
    return Math.round(Math.log((a&&a.size)||2.6)/Math.log(1.06));
  }
  function typeKeyOf(a){
    if(!a) return '';
    if(a.k==='text')
      return a.style?('text:'+a.style):('text:~'+textBand(a));
    if(a.k==='cell') return 'cell:'+partOf(a);
    return matchKey(a);
  }
  var TYPE_LABELS={
    'cell:figure':['figure','figures'],
    'cell:output':['output frame','output frames'],
    'cell:code':['code frame','code frames'],
    'cell:body':['placed note','placed notes'],
    table:['table','tables'],rect:['shape','shapes'],
    arrow:['arrow','arrows'],draw:['drawing','drawings'],
    image:['picture','pictures']
  };
  /* the words the dialog puts on its chip. A styled text box is named by
     its STYLE, read live out of the registry, so a type you invented
     yourself gets a correct chip for free and can never disagree with
     what the Styles list calls the same thing. */
  function typeLabel(key,plural,src){
    if(key&&key.indexOf('text:~')===0){
      /* an unstyled box has no name, so it is named by what it IS: its
         size, in the same pt the Styles menu prints. Read off the source
         item when there is one — reconstructing it from the quantised
         band would print a number a point or two off the box in front of
         you, which is worse than useless on a label. */
      var pt=src&&src.size
        ?Math.round(src.size*5.4)
        :Math.round(Math.pow(1.06,+key.slice(6))*5.4);
      return 'text box'+(plural?'es':'')+' at about '+pt+' pt';
    }
    if(key&&key.indexOf('text:')===0){
      var d=styleDef(key.slice(5));
      if(d) return d.label+(plural?' boxes':' box');
    }
    var p=TYPE_LABELS[key];
    if(p) return plural?p[1]:p[0];
    return plural?'objects':'object';
  }
  /* does this key name a STYLE, as against a size band or another kind?
     Only a styled bucket can drift away from a style definition, so only
     it needs the Re-apply warning. */
  function isStyleKey(key){
    return !!(key&&key.indexOf('text:')===0&&key.indexOf('text:~')!==0);
  }
  /* how many WOULD CHANGE over the slides in scope — which means the
     source item does not count, because applying a look to itself is not
     a change. Counting it made the button promise "Apply to 1" and then
     do nothing at all (2026-08-22, caught in the browser). */
  function typeCount(key,idxs,src){
    var n=0;
    (idxs||[]).forEach(function(i){
      var sl=(pres.slides||[])[i]; if(!sl) return;
      (sl.annots||[]).forEach(function(a){
        if(a&&a!==src&&!a.hide&&typeKeyOf(a)===key) n++;
      });
    });
    return n;
  }
  /* every distinct type present over these slides, in an order that
     reads: named styles in the deck's own style order first, then the
     unnamed size bands biggest first, then everything else.

     This is what makes the type CHOOSABLE rather than merely reported,
     and it is not a luxury. An unstyled box is grouped by its size, so
     the moment you make one heading bigger it is alone in its band and
     "apply to all of this type" has nothing left to apply to — which is
     precisely the flow the feature is for. Being able to say "no, THAT
     type" fixes it, and it answers the other half of the ask directly:
     "maybe should be highlighted which object type this is"
     (2026-08-22). */
  function deckTypeKeys(idxs,src){
    var seen={},list=[];
    (idxs||[]).forEach(function(i){
      var sl=(pres.slides||[])[i]; if(!sl) return;
      (sl.annots||[]).forEach(function(a){
        if(!a||a.hide) return;
        var k=typeKeyOf(a);
        if(!seen[k]){seen[k]={key:k,n:0,sample:a};list.push(seen[k]);}
        if(a!==src) seen[k].n++;
      });
    });
    var ord=styleOrder();
    function rank(e){
      if(e.key.indexOf('text:~')===0)
        return 1000-(e.sample.size||2.6);       /* biggest type first */
      if(e.key.indexOf('text:')===0){
        var at=ord.indexOf(e.key.slice(5));
        return at<0?900:at;
      }
      return 2000;
    }
    list.sort(function(x,y){return rank(x)-rank(y);});
    return list;
  }
  /* ---- SELECTING BY WHAT THINGS ARE ------------------------------------
     "Select all caption text boxes"; "select everything using this font,
     size or colour" (TASKS T5).

     A CRITERION is one named question about an object, answered off a
     REFERENCE object: key 'font', value 'georgia'. Keeping it a VALUE
     rather than a closure is the whole design: find & replace (T6) runs
     the identical question over every slide in the deck while the
     selection below runs it over one, and neither owns the question.

     `type` is not re-invented here. typeKeyOf / typeLabel already answer
     "what kind of thing is this" for the Apply dialog, in the deck's own
     vocabulary — including the styles you invented yourself, read live
     out of the registry. Everything else in the table is an APPEARANCE:
     one field, read raw, with the default folded in so two boxes nobody
     ever touched count as the same. */
  var SELECT_CRIT=[
    /* key,   read(a) -> value, or null when the question does not apply
                to this kind of object
              say(v,a) -> the whole menu row, minus its count */
    ['type',function(a){return typeKeyOf(a)||null;},
      function(v,a){return 'Every '+typeLabel(v,false,a);}],
    ['font',function(a){return a.k==='text'?(a.font||''):null;},
      function(v){return 'Everything in '+fontLabel(v);}],
    ['size',function(a){
        return (a.k==='text'||a.k==='table')?(a.size||2.6):null;},
      function(v){return 'Everything at '+Math.round(v*5.4)+' pt';}],
    ['color',function(a){
        return (a.k==='text'||a.k==='arrow'||a.k==='rect'||a.k==='draw')
          ?(a.color||''):null;},
      function(){return 'Everything in this colour';}],
    ['fillc',function(a){return a.k==='rect'?(a.fillc||''):null;},
      function(){return 'Every shape with this fill';}],
    ['sw',function(a){
        return (a.k==='arrow'||a.k==='rect'||a.k==='draw')
          ?(a.sw||SW_DEFAULT):null;},
      function(){return 'Every stroke at this thickness';}]
  ];
  /* does an object answer EVERY criterion in the set? The set is an
     AND, and an empty set matches nothing — "change everything" is a
     thing you should have to say another way. */
  function critsMatch(a,crit){
    if(!a||!crit||!crit.length) return false;
    for(var i=0;i<crit.length;i++)
      if(critRead(crit[i].key,a)!==crit[i].val) return false;
    return true;
  }
  function critRead(key,a){
    if(!a) return null;
    for(var i=0;i<SELECT_CRIT.length;i++)
      if(SELECT_CRIT[i][0]===key) return SELECT_CRIT[i][1](a);
    return null;
  }
  /* every index on ONE slide that answers a criterion the same way.

     Hidden items are out: they are not on the page you are looking at.
     FULLY LOCKED ones are out too — the same rule the marquee follows
     (T3), and the count in the menu is taken from this same function, so
     "Every Caption (4)" always selects exactly four. Position-locked
     items are ordinary here, as they are everywhere else. */
  function annotsBy(sl,key,val){
    var out=[];
    (sl&&sl.annots||[]).forEach(function(a,i){
      if(!a||a.hide||lockedAll(a)) return;
      if(critRead(key,a)===val) out.push(i);
    });
    return out;
  }
  /* the rows worth offering for the current selection: every criterion
     the reference object can answer, that more than one object on this
     slide answers the same way. A row that would select the one thing
     you already have selected is a row that does nothing. */
  function selectByRows(){
    var s2=pres.slides[cur];
    var idxs=selIdxs();
    var ref=s2&&(s2.annots||[])[idxs[idxs.length-1]];
    if(!ref) return [];
    var out=[];
    SELECT_CRIT.forEach(function(c){
      var v=c[1](ref);
      if(v==null) return;
      var hit=annotsBy(s2,c[0],v);
      if(hit.length<2) return;
      out.push({key:c[0],val:v,n:hit.length,idxs:hit,
        label:c[2](v,ref)});
    });
    return out;
  }
  function selectBy(key,val){
    var s2=pres.slides[cur]; if(!s2) return;
    var hit=annotsBy(s2,key,val);
    if(!hit.length) return;
    selectMany(stage.querySelector('.annot-layer'),hit);
    toast(hit.length+' selected');
  }
  /* the standalone menu, for the Arrange row. The canvas menu lists the
     same rows inline instead — it is already a menu, and burying them one
     level deeper there would cost a click for nothing. */
  function openSelectByMenu(anchor,ev){
    var old=$('#selby-menu'); if(old) old.remove();
    var rows=selectByRows();
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu';m.id='selby-menu';
    menuHead(m,'select on this slide');
    if(!rows.length){
      var b0=document.createElement('button');
      b0.className='dbtn vw-opt';b0.disabled=true;
      b0.textContent='Nothing else on this slide is like it';
      m.appendChild(b0);
    }
    rows.forEach(function(r){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      b.appendChild(document.createTextNode(r.label));
      var k=document.createElement('kbd');
      k.textContent=String(r.n);b.appendChild(k);
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();selectBy(r.key,r.val);});
      m.appendChild(b);
    });
    if(ev) floatAt(m,ev);
    else {
      document.body.appendChild(m);
      floatMenu(anchor,m);
      setTimeout(function(){
        document.addEventListener('click',function off(e){
          if(m.contains(e.target)) return;
          m.remove();document.removeEventListener('click',off);
        });
      },0);
    }
  }
  /* the geometry + look that travel; content never does.

     A LINE IS NOT AN x/y/w/h BOX. It is stored as its two endpoints
     (x1,y1,x2,y2) plus any corners dragged into it, so a list that named
     only the box properties copied nothing an arrow actually uses: Match
     slide reported the arrow as moved and left it exactly where it was
     (2026-08-22). The endpoints, the corner route, the curve and the
     heads all travel now.
     NOT here on purpose: `c1`/`c2` (which item each end is tied to —
     they name items on the OTHER slide, and an attached end is placed by
     arrowEnds from the tie, so copying the tie would drag the arrow onto
     a stranger); `pts` (a freehand stroke's points ARE its content);
     `shape` and `crop` (what a thing IS, not how it is laid out); and
     `anim`, which is behaviour rather than layout. */
  var MATCH_PROPS=['x','y','w','h','rot','size','b','i','u','strike',
    'align','font','color','bg','bgc','op','style','sw','fill','fillc',
    'grad','ts','txcol','bgcol','arc','list','thead','grid','cols',
    'lh','pspace','ind',
    /* lines and arrows */
    'x1','y1','x2','y2','mid','curve','bend','head','tail','nohead',
    'hsz','dash'];
  /* ---- WHICH PROPERTIES TRAVEL ----------------------------------------
     "It should do everything by default (text size, spacing, indentation,
     width, height, x and y position), but then you can unselect ones you
     don't want" (2026-08-22). So: every row starts ticked, and the list
     is the vocabulary the dialog speaks in.

     A row is a USER-FACING idea, not a model field — "Bold, italic,
     underline" is one decision and three fields, and nobody wants three
     checkboxes for it. `kinds` is what the row means anything for; rows
     that do not fit the selected item are greyed and explained rather
     than hidden, so the list does not reshuffle under you when you pick a
     different object.

     EVERY field named here must also appear in MATCH_PROPS, because that
     is the list the copy loop walks. A field named here and missing there
     is a checkbox that silently does nothing — which is why `ind` was
     added to MATCH_PROPS in the same edit that invented it. */
  var APPLY_PROPS=[
    /* key      label                        group        kinds                              fields */
    ['size',   'Text size',                 'Type',      'text table',                      ['size']],
    ['font',   'Typeface',                  'Type',      'text',                            ['font']],
    ['emph',   'Bold, italic, underline',   'Type',      'text',                            ['b','i','u','strike']],
    ['style',  'Named style',               'Type',      'text',                            ['style']],
    ['tbl',    'Table rules and header row','Type',      'table',                           ['thead','grid','cols']],
    ['lh',     'Line spacing',              'Spacing',   'text table',                      ['lh']],
    ['pspace', 'Space between paragraphs',  'Spacing',   'text table',                      ['pspace']],
    ['ind',    'Indentation',               'Spacing',   'text',                            ['ind']],
    ['align',  'Alignment',                 'Spacing',   'text',                            ['align']],
    ['list',   'Bullets and numbering',     'Spacing',   'text',                            ['list']],
    ['arc',    'Curve',                     'Spacing',   'text',                            ['arc']],
    ['w',      'Width',                     'Size',      'text cell rect image table draw', ['w']],
    /* HEIGHT IS NOT A TEXT PROPERTY. A text box auto-heights — the
       renderer reads a.w and never a.h for one — and sameSize has
       excluded text from height since it was written. A ticked Height on
       a heading would be a control that does nothing, which is worse
       than a control that is not offered. */
    ['h',      'Height',                    'Size',      'cell rect image table draw',      ['h']],
    ['rot',    'Rotation',                  'Size',      '*',                               ['rot']],
    ['ts',     'Content zoom',              'Size',      'cell',                            ['ts']],
    ['x',      'Left / right position',     'Position',  'text cell rect image table draw', ['x']],
    ['y',      'Up / down position',        'Position',  'text cell rect image table draw', ['y']],
    /* an arrow is its two ends, not a box: the same row of the picker, a
       completely different set of fields — the bug where Match slide
       reported an arrow moved and left it exactly where it was */
    ['ends',   'Where the line runs',       'Position',  'arrow',                           ['x1','y1','x2','y2','mid','curve','bend']],
    ['color',  'Text colour',               'Colour',    'text arrow rect',                 ['color']],
    ['txcol',  'Note text colour',          'Colour',    'cell',                            ['txcol']],
    ['stroke', 'Line style and thickness',  'Colour',    'arrow rect draw table',           ['sw','style','dash','head','tail','nohead','hsz']],
    ['fill',   'Shape fill',                'Background','rect',                            ['fill','fillc','grad']],
    ['bg',     'Box background',            'Background','text table',                      ['bg','bgc']],
    ['bgcol',  'Note background',           'Background','cell',                            ['bgcol']],
    ['op',     'See-through',               'Background','*',                               ['op']]
  ];
  var APPLY_GROUPS=['Type','Spacing','Size','Position','Colour','Background'];
  /* why a row is greyed, said in words rather than in kind names */
  var APPLY_WHYNOT={text:'a text box',cell:'a placed frame',rect:'a shape',
    image:'a picture',arrow:'an arrow',draw:'a drawing',table:'a table'};
  /* everything ticked EXCEPT "Named style". Ticking that one re-tags the
     target boxes, which is a bigger claim than "make these look alike" —
     it changes what they ARE, and the next Re-apply would then move them.
     Everything the user actually listed is on by default. */
  function applyPickAll(){
    var o={};
    APPLY_PROPS.forEach(function(r){if(r[0]!=='style') o[r[0]]=1;});
    return o;
  }
  /* SESSION-LOCAL, deliberately. This is a preference about the TOOL, not
     a property of the deck: sending someone a presentation must not send
     them my checkbox state, and everything on `pres` has to be argued
     into normPres and then into or out of the undo snapshot. Ticking a
     box is not an edit and must never become an undo step — but it MUST
     survive until the tab closes, because the complaint this answers is
     repetition, and re-ticking six boxes every time is that same tax in a
     new coat. deckZoom is session-local for the same reason. */
  var applyPick=applyPickAll();
  function applyRowFits(row,kind){
    return row[3]==='*'||row[3].split(' ').indexOf(kind)>=0;
  }
  /* the object handed to the action: keyed by MODEL FIELD, not by row, so
     the copy loop is the one matchSlide already uses with one guard
     added. Narrowed to what this kind can carry, so a ticked row that
     does not apply cannot smuggle a field through. */
  function applyFieldsFor(pick,kind){
    var out={};
    APPLY_PROPS.forEach(function(r){
      if(!pick[r[0]]||!applyRowFits(r,kind)) return;
      r[4].forEach(function(f){out[f]=1;});
    });
    return out;
  }
  /* ---- WHICH SLIDES ---------------------------------------------------
     "The default should be 'all slides', but you can unselect slides and
     sections" (2026-08-22). So this is an EXCLUSION set: absent from
     scopeOff means in scope, and a deck you have never touched the picker
     on is entirely in scope with no state at all.

     Keyed on the slide OBJECT, not its index. pres.slides is spliced by
     move, delete, duplicate and the strip's drop handler, and histRestore
     replaces the array wholesale — an index-keyed exclusion would
     silently re-point at whatever slid into the slot, so unticking slide
     4 and then dragging it would leave slide 4's neighbour excluded.
     Object identity survives all of them, and a WeakMap empties itself
     for free on undo and on switching decks. */
  var scopeOff=new WeakMap();
  function scopeHas(s){return !!s&&!scopeOff.has(s);}
  function scopeSet(s,on){
    if(!s) return;
    if(on) scopeOff['delete'](s); else scopeOff.set(s,1);
  }
  function scopeAll(){
    (pres.slides||[]).forEach(function(s){scopeOff['delete'](s);});
  }
  /* ALWAYS an array, never null. A bug that produced null would have to
     mean "the whole deck", which is the most destructive reading
     available — so the interface simply has no way to say it. */
  function scopeIdxs(){
    var out=[];
    (pres.slides||[]).forEach(function(s,i){if(scopeHas(s)) out.push(i);});
    return out;
  }
  function scopeNoun(n){
    var w=pageOf().poster?'page':'slide';
    return n===1?w:w+'s';
  }
  function scopeWords(){
    var all=(pres.slides||[]).length,idxs=scopeIdxs(),n=idxs.length;
    if(!n) return 'No '+scopeNoun(0)+' chosen';
    if(n===all) return 'All '+all+' '+scopeNoun(all);
    if(n===1&&idxs[0]===cur) return 'This '+scopeNoun(1)+' only';
    return n+' of '+all+' '+scopeNoun(all);
  }
  /* ---- THE ACTION -----------------------------------------------------
     One source item, one type key, one property set, one list of slides.
     The loop walks MATCH_PROPS rather than the caller's own keys so that
     undefined-means-delete and the deep copy of a.grad / a.cols are
     handled in exactly one place, the same place Match slide handles
     them.
     ONE markDirty() and ONE refresh() at the end, never per item: a sweep
     over forty slides has to be a single undo step, and markDirty only
     repaints the CURRENT slide's thumbnail, so the other thirty-nine need
     the refresh to catch up. */
  function applyToType(key,src,want,idxs){
    var n=0;
    (idxs||[]).forEach(function(i){
      var sl=(pres.slides||[])[i]; if(!sl) return;
      (sl.annots||[]).forEach(function(a){
        if(!a||a===src||typeKeyOf(a)!==key) return;
        MATCH_PROPS.forEach(function(p){
          if(!want[p]) return;
          if(src[p]===undefined) delete a[p];
          else a[p]=(typeof src[p]==='object'&&src[p])
            ?deep(src[p]):src[p];
        });
        n++;
      });
    });
    markDirty();refresh();
    return n;
  }
  /* ---- WHAT AN UNSTYLED TEXT BOX IS FOR --------------------------------
     matchKey answers "what kind of thing is this", and for text it
     answers with the NAMED STYLE — which is right, and useless on the
     many decks that have never used one. There, every text box came back
     'text:body', so a heading and a caption were the same kind and got
     paired by position alone: the higher one won the higher slot and a
     heading could land where a caption belonged.

     The fix is to read the role the box is actually PLAYING, and the
     signal is RANK WITHIN ITS OWN SLIDE rather than absolute size. The
     biggest text on a slide is its heading whatever the number happens to
     be, the next is its body, the next its caption. Rank survives exactly
     the case that breaks a size threshold — a deck whose slides were
     formatted by hand and disagree about how big a heading is — which is
     precisely the deck that needed arranging in the first place
     (2026-08-22, user: "is there not a way for it to figure this out?").

     Sizes within ROLE_TOL of each other share a rank, so two paragraphs
     set the same size stay one bucket and pair between themselves in
     reading order, which is the right answer for them. */
  var ROLE_TOL=1.06;
  function inferRoles(sl){
    var list=[],out={};
    ((sl&&sl.annots)||[]).forEach(function(a,i){
      if(a&&a.k==='text'&&!a.hide
        &&!(a.style&&STYLE_DEFAULTS[a.style]))
        list.push({i:i,size:(a.size||2.6)});
    });
    if(!list.length) return out;
    list.sort(function(x,y){return y.size-x.size;});
    var rank=0,prev=null;
    list.forEach(function(e){
      if(prev!==null&&prev/e.size>ROLE_TOL) rank++;
      prev=e.size;
      out[e.i]=rank;
    });
    return out;
  }
  /* the bucket key one slide's items pair on. A box wearing a real style
     keeps it — a name you chose beats a rank we inferred — and everything
     that is not text is unchanged. */
  function slideRoleKey(sl){
    var roles=inferRoles(sl);
    return function(a,i){
      if(a&&a.k==='text'&&!a.style&&roles[i]!=null)
        return 'text:~'+roles[i];
      return matchKey(a);
    };
  }
  function matchSlide(fromIdx,toIdx){
    var src=pres.slides[fromIdx],dst=pres.slides[toIdx];
    if(!src||!dst) return null;
    /* buckets by kind, in reading order down the page then across */
    function bucket(sl){
      var m={},keyOf=slideRoleKey(sl);
      (sl.annots||[]).map(function(a,i){return {a:a,i:i};})
        .filter(function(p2){return p2.a&&!p2.a.hide;})
        .sort(function(p2,q2){
          var dy=(p2.a.y||0)-(q2.a.y||0);
          return Math.abs(dy)>4?dy:((p2.a.x||0)-(q2.a.x||0));})
        .forEach(function(p2){
          var k=keyOf(p2.a,p2.i);
          (m[k]=m[k]||[]).push(p2);});
      return m;
    }
    var sb=bucket(src),db=bucket(dst);
    var moved=0,missing=[];
    Object.keys(db).forEach(function(k){
      var from=sb[k]||[],to=db[k];
      if(!from.length){missing.push(k);return;}
      to.forEach(function(p2,n){
        /* run out of models? reuse the last one, so three bullets on this
           slide all take the styling of the one bullet on that one */
        var m=from[Math.min(n,from.length-1)].a;
        MATCH_PROPS.forEach(function(prop){
          if(m[prop]===undefined) delete p2.a[prop];
          else p2.a[prop]=(typeof m[prop]==='object'&&m[prop])
            ?deep(m[prop]):m[prop];
        });
        moved++;
      });
    });
    return {moved:moved,missing:missing,
      spare:Object.keys(sb).filter(function(k){return !db[k];})};
  }
  /* ---- ARRANGE THIS SLIDE ----------------------------------------------
     (2026-08-22, user: "there could be like an 'arrange slide button',
     which based upon what is there (the main big things and text boxes,
     and then anything little like shapes stay where they are in reference
     to if they are on top of something, and arrows point to the same xy
     in one image to the same xy in another image). Then there can be
     presets based upon both the size of something, as well as the
     difference between things can be configured.")

     This is the arrangement library's twin: it needs no saved layout at
     all, because it reads the slide and works one out. Three kinds of
     thing, and the whole design is in how they are treated differently:

       MAJOR   figures, images, tables, flip books — and any shape big
               enough to be scenery rather than a mark. These are placed.
       TEXT    placed too, by the ROLE inferRoles gives it: the biggest
               text on the slide is its heading, the smallest under a
               figure is that figure's caption.
       MINOR   a circle round part of a plot, a tick, a small label. These
               are NOT placed. They are recorded as a FRACTION of whatever
               they sit on and put back on top of it afterwards, so the
               annotation still annotates the same pixel of the same plot.

     Arrow endpoints get the same treatment, one end at a time and by
     fraction rather than by the a.c1/a.c2 tie — that tie aims at an
     item's centre and lands on its border, which is right for "this
     points AT that figure" and wrong for "this points at the peak in the
     top-left of that figure", which is what is being preserved here. */
  var ARRANGE_PRESETS=[
    ['tight','Tight',{gap:1.6,big:7,textShare:0.30}],
    ['normal','Normal',{gap:3.0,big:9,textShare:0.34}],
    ['airy','Airy',{gap:5.0,big:12,textShare:0.38}]
  ];
  function arrangeOpts(id){
    var o=ARRANGE_PRESETS[1][2];
    ARRANGE_PRESETS.forEach(function(p){if(p[0]===id) o=p[2];});
    return o;
  }
  function rectOf(a){
    if(!a) return null;
    if(a.k==='arrow')
      return {l:Math.min(a.x1,a.x2),r:Math.max(a.x1,a.x2),
              t:Math.min(a.y1,a.y2),b:Math.max(a.y1,a.y2)};
    if(a.w==null||a.h==null) return null;
    return {l:a.x,r:a.x+a.w,t:a.y,b:a.y+a.h};
  }
  function rectArea(r){
    return r?Math.max(0,r.r-r.l)*Math.max(0,r.b-r.t):0;
  }
  function overlapArea(p,q){
    if(!p||!q) return 0;
    var w=Math.min(p.r,q.r)-Math.max(p.l,q.l);
    var h=Math.min(p.b,q.b)-Math.max(p.t,q.t);
    return (w>0&&h>0)?w*h:0;
  }
  /* is this item scenery or a mark? Size is the signal the user named,
     and it is configurable per preset because "big" on an A0 poster and
     "big" on a 16:9 slide are not the same number of percent. */
  function isMajorKind(a){
    return a&&(a.k==='cell'||a.k==='image'||a.k==='flip'||a.k==='table');
  }
  function arrangeSlide(sl,layer,opt){
    if(!sl) return 0;
    opt=opt||arrangeOpts('normal');
    var m=marginPct(),gap=opt.gap;
    var annots=sl.annots||[];
    /* EVERY rect is measured BEFORE anything moves. Text auto-heights and
       a figure frame hugs its plot, so the live layer is the only honest
       source for those — and it goes stale the moment we write. */
    var rects=annots.map(function(a,i){
      var r=(layer?annotRectPct(layer,sl,i):null)||rectOf(a);
      return r;
    });
    var majors=[],texts=[],minors=[],arrows=[];
    annots.forEach(function(a,i){
      if(!a||a.hide) return;
      if(a.k==='arrow'){arrows.push(i);return;}
      var r=rects[i]; if(!r) return;
      if(a.k==='text'){texts.push(i);return;}
      if(isMajorKind(a)||rectArea(r)>=opt.big*opt.big) majors.push(i);
      else minors.push(i);
    });
    if(!majors.length&&!texts.length) return 0;
    /* ---- record what rides on what, before anything moves ---- */
    function hostOf(r){
      var best=-1,bo=0;
      majors.forEach(function(j){
        var o=overlapArea(r,rects[j]);
        if(o>bo){bo=o;best=j;}
      });
      /* half of it has to be over the host, or a shape merely NEAR a
         figure would be dragged across the slide with it */
      return (best>=0&&bo>=rectArea(r)*0.5)?best:-1;
    }
    function frac(r,h){
      var hw=(h.r-h.l)||1,hh=(h.b-h.t)||1;
      return {x:(r.l-h.l)/hw,y:(r.t-h.t)/hh,
              w:(r.r-r.l)/hw,h:(r.b-r.t)/hh};
    }
    var ride=[];
    minors.forEach(function(i){
      var h=hostOf(rects[i]);
      if(h>=0) ride.push({i:i,host:h,f:frac(rects[i],rects[h])});
    });
    function pointHost(x,y){
      var best=-1;
      majors.forEach(function(j){
        var r=rects[j];
        if(x>=r.l&&x<=r.r&&y>=r.t&&y<=r.b) best=j;
      });
      return best;
    }
    var tips=[];
    arrows.forEach(function(i){
      var a=annots[i];
      [['1',a.x1,a.y1],['2',a.x2,a.y2]].forEach(function(e){
        var h=pointHost(e[1],e[2]);
        if(h<0) return;
        var r=rects[h];
        tips.push({i:i,end:e[0],host:h,
          fx:(e[1]-r.l)/((r.r-r.l)||1),
          fy:(e[2]-r.t)/((r.b-r.t)||1)});
      });
    });
    /* ---- who is a heading, who is a caption ---- */
    var roles=inferRoles(sl);
    var maxRank=0;
    texts.forEach(function(i){
      if(roles[i]!=null&&roles[i]>maxRank) maxRank=roles[i];});
    var head=-1,caps={},bodies=[];
    texts.forEach(function(i){
      var rk=roles[i];
      if(rk===0&&head<0&&maxRank>0){head=i;return;}
      /* a caption is the smallest text that sits UNDER a figure and
         overlaps it across — the same signal the standardise check uses */
      if(rk===maxRank&&maxRank>0){
        var r=rects[i],hit=-1;
        majors.forEach(function(j){
          var q=rects[j];
          if(r.t>=q.b-2&&r.t<=q.b+14&&r.r>q.l&&r.l<q.r) hit=j;});
        if(hit>=0&&caps[hit]==null){caps[hit]=i;return;}
      }
      bodies.push(i);
    });
    /* ---- the regions ---- */
    var L=m.x,T=m.y,R=100-m.x,B=100-m.y;
    var put={};
    function setBox(i,x,y,w,h){put[i]={x:x,y:y,w:w,h:h};}
    if(head>=0){
      var hh=Math.max(6,(rects[head].b-rects[head].t));
      setBox(head,L,T,R-L,null);
      T+=hh+gap;
    }
    var capH=Math.max(4,(maxRank>0?5:0));
    var nb=bodies.length,nm=majors.length;
    if(!nm){
      /* text only: one column, stacked, sharing the height */
      var each=(B-T-gap*Math.max(0,nb-1))/Math.max(1,nb);
      bodies.forEach(function(i,k){
        setBox(i,L,T+k*(each+gap),R-L,null);});
    } else {
      var fx=L,fw=R-L;
      if(nb&&nm<=2){
        /* a short slide reads best as text beside the figure. With three
           or more figures the text goes underneath instead — a 30% column
           beside a 2x2 grid is a gutter, not a paragraph. */
        var tw=(R-L)*opt.textShare;
        fx=L+tw+gap;fw=(R-L)-tw-gap;
        var eachT=(B-T-gap*Math.max(0,nb-1))/Math.max(1,nb);
        bodies.forEach(function(i,k){
          setBox(i,L,T+k*(eachT+gap),tw,null);});
      }
      var fb=B;
      if(nb&&nm>2){
        var bandH=Math.max(8,(B-T)*0.24);
        fb=B-bandH-gap;
        var eachB=(R-L-gap*Math.max(0,nb-1))/Math.max(1,nb);
        bodies.forEach(function(i,k){
          setBox(i,L+k*(eachB+gap),fb+gap,eachB,null);});
      }
      var cols=nm<=1?1:(nm<=4?2:Math.ceil(Math.sqrt(nm)));
      var rows=Math.ceil(nm/cols);
      var cw=(fw-gap*(cols-1))/cols;
      var ch=(fb-T-gap*(rows-1))/rows;
      /* the caption strip is reserved for the whole ROW, not the one cell
         that has a caption. Charging it to that cell alone left two
         figures side by side at different heights, which reads as a
         mistake rather than as a caption (2026-08-22). */
      var rowCap={};
      majors.forEach(function(i,k){
        if(caps[i]!=null) rowCap[Math.floor(k/cols)]=1;});
      majors.forEach(function(i,k){
        var c=k%cols,r2=Math.floor(k/cols);
        var x=fx+c*(cw+gap),y=T+r2*(ch+gap);
        var mh=ch-(rowCap[r2]?(capH+gap*0.5):0);
        setBox(i,x,y,cw,mh);
        if(caps[i]!=null) setBox(caps[i],x,y+mh+gap*0.5,cw,null);
      });
    }
    /* ---- write it ---- */
    var moved=0;
    Object.keys(put).forEach(function(k){
      var i=+k,a=annots[i],b=put[i];
      if(!a) return;
      a.x=Math.round(b.x*10)/10;
      a.y=Math.round(b.y*10)/10;
      a.w=Math.round(b.w*10)/10;
      /* a text box auto-heights: writing a height on one would fix it at
         a size its words do not need (the rule MATCH_PROPS keeps too) */
      if(b.h!=null&&a.k!=='text') a.h=Math.round(b.h*10)/10;
      moved++;
    });
    /* ---- and put the marks back where they were, relative ---- */
    function newRect(i){
      var b=put[i];
      if(b) return {l:b.x,t:b.y,r:b.x+b.w,
        b:b.y+(b.h!=null?b.h:(rects[i].b-rects[i].t))};
      return rects[i];
    }
    ride.forEach(function(e){
      var h=newRect(e.host),a=annots[e.i];
      var hw=(h.r-h.l),hh=(h.b-h.t);
      a.x=Math.round((h.l+e.f.x*hw)*10)/10;
      a.y=Math.round((h.t+e.f.y*hh)*10)/10;
      a.w=Math.round(e.f.w*hw*10)/10;
      a.h=Math.round(e.f.h*hh*10)/10;
      moved++;
    });
    tips.forEach(function(e){
      var h=newRect(e.host),a=annots[e.i];
      var x=Math.round((h.l+e.fx*(h.r-h.l))*10)/10;
      var y=Math.round((h.t+e.fy*(h.b-h.t))*10)/10;
      if(e.end==='1'){a.x1=x;a.y1=y;} else {a.x2=x;a.y2=y;}
      /* a fractional tip is a POINT inside the figure, which is a
         different promise from a.c1/a.c2's "aim at this item and stop at
         its border" — so the tie is dropped for the end we just placed,
         or the render would immediately overrule us */
      if(e.end==='1') delete a.c1; else delete a.c2;
      moved++;
    });
    return moved;
  }
  /* ---- ARRANGEMENTS ----------------------------------------------------
     (2026-08-22, user: "there could be arrangements one has, that are
     like if the slide has heading, small paragraph, and large image ...
     I know there can be infinite numbers of these, but it would be cool
     if there was like a way to create ones of these, and like there was a
     view that had a list of what is being arranged, then like a little
     thumbnail of what it would be arranged to".)

     AN ARRANGEMENT IS JUST A SAVED SLIDE. That is the whole design, and
     it is why there is no new matching language here: matchSlide already
     buckets items by kind and pairs them in reading order, so applying an
     arrangement is matchSlide from a stored slide instead of from another
     slide in the deck. Creating one is therefore "make a slide look right
     and save it", which is the only authoring model that scales — and it
     dissolves the "infinite numbers of these" worry, because nobody
     enumerates them: you keep the five you actually use.

     They live in localStorage, not on the deck: an arrangement you only
     ever get to use on one presentation is not worth naming.

     WHAT IS DELIBERATELY NOT HERE is automatic application. Whether a
     paragraph is "small" is a consequence of the layout you have not
     applied yet, not a property of the content, so a rule keyed on it is
     circular and would rearrange slides you were happy with. The pane
     SUGGESTS: every slide, its best match, a thumbnail, and a tick you
     can clear. */
  var ARRKEY='jv-deck-arr:';
  function arrList(){
    try{
      var l=JSON.parse(lsGet(ARRKEY+SCOPE)||'[]');
      return Array.isArray(l)?l:[];
    }catch(e){return [];}
  }
  function arrSave(list){lsSet(ARRKEY+SCOPE,JSON.stringify(list));}
  function arrById(id){
    var hit=null;
    arrList().forEach(function(a){if(a&&a.id===id) hit=a;});
    return hit;
  }
  /* the shape of a slide, with the CONTENT stripped out. Only what
     matchSlide would ever copy is kept, so an arrangement cannot smuggle
     someone else's words or someone else's figure onto your slide. */
  function arrFromSlide(sl,name){
    var keep=[];
    (sl.annots||[]).forEach(function(a){
      if(!a||a.hide) return;
      var o={k:a.k};
      if(a.k==='text'&&a.style) o.style=a.style;
      if(a.k==='cell') o.part=a.part;
      MATCH_PROPS.forEach(function(p){
        if(a[p]===undefined) return;
        o[p]=(typeof a[p]==='object'&&a[p])
          ?deep(a[p]):a[p];
      });
      /* a placeholder word, so the saved slide can be DRAWN as a
         thumbnail without carrying the real text anywhere */
      if(a.k==='text') o.text=annotLabel(a).replace(/^Text — /,'')
        .slice(0,18)||'Text';
      keep.push(o);
    });
    return {id:'ar'+Date.now().toString(36),
      label:name||'Arrangement',
      page:pageOf().poster?'poster':'slide',
      annots:keep};
  }
  /* how well an arrangement fits a slide: the fraction of the slide's
     items it has somewhere to put. Reported, never acted on by itself. */
  function arrScore(arr,sl){
    /* the SAME key the pairing uses, or the percentage describes a
       different match from the one that would happen */
    function counts(sl){
      var m={},keyOf=slideRoleKey(sl);
      ((sl&&sl.annots)||[]).forEach(function(a,i){
        if(!a||a.hide) return;
        var k=keyOf(a,i);m[k]=(m[k]||0)+1;});
      return m;
    }
    var want=counts(sl),have=counts({annots:arr.annots});
    var nw=0,nh=0,hit=0;
    Object.keys(want).forEach(function(k){
      nw+=want[k];
      hit+=Math.min(want[k],have[k]||0);
    });
    Object.keys(have).forEach(function(k){nh+=have[k];});
    /* divided by the BIGGER of the two, so it is punished in both
       directions. Dividing by the slide's own count alone said a slide
       holding one text box fitted a three-item arrangement perfectly —
       every item it had could be placed, which is true and useless
       (2026-08-22, caught in the browser). */
    var tot=Math.max(nw,nh);
    return tot?(hit/tot):0;
  }
  function arrBest(sl){
    var best=null,bs=0;
    arrList().forEach(function(a){
      var s=arrScore(a,sl);
      if(s>bs){bs=s;best=a;}
    });
    return best?{arr:best,score:bs}:null;
  }
  /* applying one is matchSlide from the stored slide. It is spliced in as
     a temporary slide rather than matchSlide being re-signed, because
     matchSlide's pairing is characterised by tests and is the one thing
     here that must not change. */
  function arrApply(arr,idx){
    var sl=pres.slides[idx]; if(!sl||!arr) return 0;
    pres.slides.push({layout:'blank',panes:[],
      annots:deep(arr.annots||[])});
    var r=matchSlide(pres.slides.length-1,idx);
    pres.slides.pop();
    return r?r.moved:0;
  }
  /* ---- MATCHING ONE OBJECT TO ANOTHER ----------------------------------
     (2026-08-22, user: "click on an object, and be like 'match object to
     this', then if you click on something else it matches it to it ...
     then if you click on another slide it says in the ribbon something
     like 'matching to object on slide xx' with a cancel button as well.
     Would be good if there was the reverse as well".)

     Match slide answers "make this whole slide look like that one" and
     pairs items up by guessing. This answers the question that needs no
     guessing at all: you point at the two things yourself. It is the
     escape hatch for every case the bucket heuristic cannot get right —
     two paragraphs that belong the other way round, an item whose
     counterpart is a different kind, a look you want from three slides
     away.

     TWO DIRECTIONS, because which end you have selected depends on which
     one you noticed first:
       'to'   — the selection is the MODEL; click things to change them.
                Stays armed, so one look can be pushed to a dozen objects.
       'from' — the selection is what CHANGES; click the model once.
     Armed state lives here and nowhere else; the canvas reads it at the
     top of its mousedown handler. */
  var matchArm=null;
  var matchPick=applyPickAll();
  function matchLabelOf(sl,i){
    var a=(sl&&sl.annots||[])[i];
    return a?annotLabel(a):'object';
  }
  function armMatch(dir){
    var s=pres.slides[cur],idxs=selIdxs().filter(function(i){
      return (s&&s.annots||[])[i];});
    if(!idxs.length){
      toast('Select the object you want to match first');
      return;
    }
    /* 'to' pushes ONE look outwards, so it takes the primary selection —
       three models and one target is a question with no answer. 'from'
       genuinely wants the lot: several objects can all take one model. */
    if(dir==='to') idxs=[(typeof selAnnot==='number')?selAnnot:idxs[0]];
    if(dir==='layout'&&idxs.length<2){
      toast('Select the objects you want laid out \u2014 two or more');
      return;
    }
    matchArm={dir:dir,slide:cur,idxs:idxs,n:0};
    deckEl.classList.add('matching');
    syncMatchBar();
  }
  function cancelMatch(){
    if(!matchArm) return;
    var n=matchArm.n;
    matchArm=null;
    deckEl.classList.remove('matching');
    syncMatchBar();
    if(n) toast(n+' object'+(n===1?'':'s')+' matched. Ctrl+Z undoes it.');
  }
  /* the copy loop, once. Same rule MATCH_PROPS has always followed —
     undefined on the model means DELETE on the target — and the same deep
     copy for the object-valued properties. */
  function matchCopy(from,to,want){
    if(!from||!to||from===to) return false;
    MATCH_PROPS.forEach(function(p){
      if(!want[p]) return;
      if(from[p]===undefined) delete to[p];
      else to[p]=(typeof from[p]==='object'&&from[p])
        ?deep(from[p]):from[p];
    });
    return true;
  }
  function matchHit(idx){
    if(!matchArm) return;
    var s=pres.slides[cur];
    var hit=(s&&s.annots||[])[idx];
    var src=pres.slides[matchArm.slide];
    if(!hit||!src) return;
    var n=0;
    if(matchArm.dir==='layout'){
      /* the reference is the group (or the run) the clicked object is
         part of, and the selection is what gets tidied to match it */
      var layer2=stage.querySelector('.annot-layer');
      var ref=refGroupAt(layer2,s,idx);
      var pat=readPattern(layer2,s,ref);
      if(!pat){
        toast('That object is not part of a row or a group \u2014 click '
          +'one that is');
        return;
      }
      n=applyPattern(layer2,s,matchArm.idxs,pat);
      if(!n){toast('Nothing to lay out');return;}
      matchArm.n+=n;
      markDirty();refresh();
      toast(n+' laid out like the '+pat.n+' you clicked \u2014 '
        +(pat.horiz?'across':'down')+', '
        +(pat.align==='mid'?'centres':pat.align==='near'
          ?(pat.horiz?'top edges':'left edges')
          :(pat.horiz?'bottom edges':'right edges'))
        +' agreeing, '+gapMm(pat.gap,pat.horiz)+' apart');
      cancelMatch();
      return;
    }
    if(matchArm.dir==='to'){
      var model=(src.annots||[])[matchArm.idxs[0]];
      /* the KIND of the thing being changed decides which properties are
         meaningful — pushing a text size onto a shape is a control that
         does nothing, and applyFieldsFor already knows that */
      if(matchCopy(model,hit,applyFieldsFor(matchPick,hit.k))) n++;
    } else {
      matchArm.idxs.forEach(function(i){
        var to=(src.annots||[])[i];
        if(matchCopy(hit,to,applyFieldsFor(matchPick,to.k))) n++;
      });
    }
    if(!n) return;
    matchArm.n+=n;
    markDirty();refresh();
    /* 'from' has exactly one model to find, so finding it finishes the
       job; 'to' stays armed so a look can be pushed to a dozen things
       without re-arming between each */
    if(matchArm.dir==='from') cancelMatch();
    else {syncMatchBar();
      toast(matchArm.n+' matched — keep clicking, or press Esc');}
  }
  /* ---- MATCHING A LAYOUT, NOT A LOOK -----------------------------------
     "Make these three look like the four above" (TASKS T8). Which is a
     third question, and none of the three neighbours above answers it:

       Match slide     copies a whole slide's arrangement, item for item.
       Match object    copies one object's PROPERTIES onto another.
       Arrangements    apply a saved slide's shape.

     This one copies neither properties nor positions. It copies the
     PATTERN — the axis a group runs along, the edge or centre its
     members agree on, the rhythm of the gaps between them, and where the
     run starts. Nothing about size or colour travels: two rows can look
     alike in the only sense that matters here while holding completely
     different things, and the counts need not even match, which is why
     "these three" can be laid out like "those four".

     The cross-axis position is NOT copied. Adopting it would drop the
     selection on top of the reference; what is adopted is the RULE (tops
     agree / centres agree / bottoms agree), applied to where the
     selection already is, so it tidies into its own band.

     Gaps are taken as the MEDIAN of the reference's gaps. One odd gap in
     a row of five is a mistake being copied, not a rhythm. */
  function patSpread(v){
    return Math.max.apply(null,v)-Math.min.apply(null,v);
  }
  function readPattern(layer,s,idxs){
    var rs=[];
    idxs.forEach(function(i){
      var r=annotRectPct(layer,s,i);
      if(r) rs.push(r);
    });
    if(rs.length<2) return null;
    /* the axis is whichever way the group actually runs */
    var cx=rs.map(function(r){return (r.l+r.r)/2;});
    var cy=rs.map(function(r){return (r.t+r.b)/2;});
    var horiz=patSpread(cx)>=patSpread(cy);
    rs.sort(function(p,q){return horiz?(p.l-q.l):(p.t-q.t);});
    var gaps=[];
    for(var k=1;k<rs.length;k++)
      gaps.push(horiz?(rs[k].l-rs[k-1].r):(rs[k].t-rs[k-1].b));
    gaps.sort(function(a,b){return a-b;});
    var gap=gaps[Math.floor(gaps.length/2)];
    /* which edge they agree on: the one they disagree about least */
    var near=rs.map(function(r){return horiz?r.t:r.l;});
    var mid=rs.map(function(r){
      return horiz?(r.t+r.b)/2:(r.l+r.r)/2;});
    var far=rs.map(function(r){return horiz?r.b:r.r;});
    var sn=patSpread(near),sm=patSpread(mid),sf=patSpread(far);
    var align=(sn<=sm&&sn<=sf)?'near':((sf<=sm)?'far':'mid');
    return {horiz:horiz,gap:gap,align:align,n:rs.length,
      start:horiz?rs[0].l:rs[0].t};
  }
  /* the value the TARGETS should agree on, read off where they are now
     by the reference's own rule — so they line up with each other, in
     their own band, rather than jumping onto the reference */
  function patCross(rs,pat){
    var v=rs.map(function(r){
      return pat.align==='near'?(pat.horiz?r.t:r.l)
        :pat.align==='far'?(pat.horiz?r.b:r.r)
        :(pat.horiz?(r.t+r.b)/2:(r.l+r.r)/2);});
    if(pat.align==='near') return Math.min.apply(null,v);
    if(pat.align==='far') return Math.max.apply(null,v);
    return v.reduce(function(a,b){return a+b;},0)/v.length;
  }
  function applyPattern(layer,s,idxs,pat){
    var rs=[];
    idxs.forEach(function(i){
      var a=(s.annots||[])[i];
      /* a pinned object is not moved by anything else on the canvas and
         is not moved by this either (T3) */
      if(!a||pinned(a)) return;
      var r=annotRectPct(layer,s,i);
      if(r) rs.push({i:i,a:a,r:r});
    });
    if(!rs.length) return 0;
    rs.sort(function(p,q){
      return pat.horiz?(p.r.l-q.r.l):(p.r.t-q.r.t);});
    var cross=patCross(rs.map(function(x){return x.r;}),pat);
    var pos=pat.start,n=0;
    rs.forEach(function(x){
      var len=pat.horiz?(x.r.r-x.r.l):(x.r.b-x.r.t);
      var da=pos-(pat.horiz?x.r.l:x.r.t);
      var now=pat.align==='near'?(pat.horiz?x.r.t:x.r.l)
        :pat.align==='far'?(pat.horiz?x.r.b:x.r.r)
        :(pat.horiz?(x.r.t+x.r.b)/2:(x.r.l+x.r.r)/2);
      var dc=cross-now;
      /* DELTAS, never absolute coordinates. An auto-sized text box and
         an aspect-fitted figure frame both answer annotRectPct with
         their RENDERED rect, which is not a.x/a.y — so moving by the
         difference is the only arithmetic that is right for every kind
         (the same reason snapping works on the bounding box). */
      shiftAnnot(x.a,pat.horiz?da:dc,pat.horiz?dc:da);
      pos+=len+pat.gap;
      n++;
    });
    return n;
  }
  /* WHAT COUNTS AS THE REFERENCE GROUP when you click one object. A real
     group is unambiguous and wins. Otherwise it is the run the object is
     part of: the items sharing its band, which is the same "is this next
     to that" test the equal-gap snapping uses (T7) — so the thing you
     see as a row is the thing that gets read as one. */
  function bandMates(layer,s,idx,horiz){
    var r0=annotRectPct(layer,s,idx); if(!r0) return [];
    var out=[];
    (s.annots||[]).forEach(function(a,i){
      if(!a||a.hide||a.k==='arrow') return;
      var r=annotRectPct(layer,s,i); if(!r) return;
      if(i===idx){out.push(i);return;}
      /* ACROSS the run, they must overlap generously — enough that a
         person would call them the same row */
      var ov=horiz?(Math.min(r.b,r0.b)-Math.max(r.t,r0.t))
                  :(Math.min(r.r,r0.r)-Math.max(r.l,r0.l));
      var ext=horiz?Math.min(r.b-r.t,r0.b-r0.t)
                   :Math.min(r.r-r.l,r0.r-r0.l);
      if(!(ext>0&&ov>=ext*0.5)) return;
      /* ALONG the run, they must sit BESIDE it rather than over it. A
         slide-wide background, or the empty cell frame a new slide
         starts with, overlaps every row's band and would otherwise be
         read as a member of all of them — caught in the browser
         2026-08-25, where the placeholder joined the reference row and
         dragged the run's start 92px to the left of where it looked. */
      var al=horiz?(Math.min(r.r,r0.r)-Math.max(r.l,r0.l))
                  :(Math.min(r.b,r0.b)-Math.max(r.t,r0.t));
      var alen=horiz?Math.min(r.r-r.l,r0.r-r0.l)
                    :Math.min(r.b-r.t,r0.b-r0.t);
      if(al>alen*0.5) return;
      out.push(i);
    });
    return out;
  }
  function refGroupAt(layer,s,idx){
    var mem=groupMembers(s,idx);
    if(mem.length>1) return mem;
    var row=bandMates(layer,s,idx,true);
    var col=bandMates(layer,s,idx,false);
    return (row.length>=col.length?row:col);
  }
  function syncMatchBar(){
    var bar=$('#matchbar'); if(!bar) return;
    bar.hidden=!matchArm;
    if(!matchArm) return;
    var w=$('#match-what');
    var src=pres.slides[matchArm.slide];
    var name=matchLabelOf(src,matchArm.idxs[0]);
    if(matchArm.idxs.length>1) name=matchArm.idxs.length+' objects';
    if(w&&matchArm.dir==='layout'){
      w.innerHTML=bic('align')+' <b>'+esc(name)
        +'</b> will be laid out like the group or row you click '
        +'&mdash; the axis, the alignment and the spacing, not the look';
      return;
    }
    if(w) w.innerHTML=(matchArm.dir==='to')
      ? (bic('swap')+' Copying the look of <b>'+esc(name)+'</b> on slide '
        +(matchArm.slide+1)+' &mdash; click an object to change it'
        +(matchArm.n?(' &middot; '+matchArm.n+' done'):''))
      : (bic('swap')+' <b>'+esc(name)+'</b> on slide '+(matchArm.slide+1)
        +' will take the look of the object you click');
  }
  (function(){
    var mc=$('#match-cancel');
    if(mc) mc.addEventListener('click',function(e){
      e.stopPropagation();cancelMatch();});
    var mb=$('#match-props'),mm=$('#match-props-menu');
    if(!mb||!mm) return;
    /* the same vocabulary the Apply dialog uses — "size, position, shape,
       colour" is exactly what APPLY_PROPS already groups, so this is that
       list rather than a second one that could disagree with it. Its own
       tick state, though: what you want carried between two objects you
       are pointing at is not the same question as what you want pushed
       across a whole deck. */
    function build(){
      mm.innerHTML='';
      var head=document.createElement('div');
      head.className='mp-head';
      [['All',function(){matchPick=applyPickAll();}],
       ['None',function(){matchPick={};}]].forEach(function(pr){
        var b=document.createElement('button');
        b.className='dbtn mp-b';b.textContent=pr[0];
        b.addEventListener('click',function(e){
          e.stopPropagation();pr[1]();build();});
        head.appendChild(b);
      });
      mm.appendChild(head);
      APPLY_GROUPS.forEach(function(g){
        var rows=APPLY_PROPS.filter(function(r){return r[2]===g;});
        if(!rows.length) return;
        menuHead(mm,g.toLowerCase());
        rows.forEach(function(r){
          var lab=document.createElement('label');
          lab.className='find-ck';
          var ck=document.createElement('input');
          ck.type='checkbox';ck.checked=!!matchPick[r[0]];
          ck.addEventListener('click',function(e){e.stopPropagation();});
          ck.addEventListener('change',function(){
            if(ck.checked) matchPick[r[0]]=1; else delete matchPick[r[0]];
          });
          lab.appendChild(ck);
          lab.appendChild(document.createTextNode(' '+r[1]));
          mm.appendChild(lab);
        });
      });
    }
    mb.addEventListener('click',function(e){
      e.stopPropagation();
      var open=mm.hidden;
      if(open) build();
      mm.hidden=!open;
      mb.setAttribute('aria-expanded',open?'true':'false');
    });
    document.addEventListener('click',function(e){
      if(!mm.hidden&&!mm.contains(e.target)&&e.target!==mb)
        mm.hidden=true;
    });
  })();
  (function(){
    var host=$('#lay-tidy'); if(!host) return;
    $$('[data-tidy]',host).forEach(function(b){
      b.addEventListener('click',function(e){
        e.stopPropagation();
        var s=pres.slides[cur]; if(!s) return;
        var lm=$('#lay-menu'); if(lm) lm.hidden=true;
        var n=arrangeSlide(s,stage.querySelector('.annot-layer'),
          arrangeOpts(b.getAttribute('data-tidy')));
        if(!n){toast('There is nothing on this slide to arrange');return;}
        markDirty();refresh();
        toast(n+' item'+(n===1?'':'s')+' arranged. Ctrl+Z undoes it.');
      });
    });
  })();
  /* ---- THE ARRANGEMENTS DIALOG -----------------------------------------
     The library on the left, drawn; the per-slide suggestions on the
     right, ticked but overridable. Nothing is applied until you say so. */
  (function(){
    var dlg=$('#ar-dlg'); if(!dlg) return;
    var pickFor={};      /* slide index -> arrangement id, '' = leave it */
    function chosen(){
      var out=[];
      (pres.slides||[]).forEach(function(sl,i){
        var id=pickFor[i];
        if(id) out.push({i:i,arr:arrById(id)});
      });
      return out.filter(function(e){return e.arr;});
    }
    function sync(){
      var n=chosen().length,c=$('#ar-count');
      if(c) c.textContent=n?(n+' slide'+(n===1?'':'s')+' will be re-laid '
        +'out'):'Nothing chosen';
      var ok=$('#ar-ok');
      if(ok){ok.disabled=!n;
        ok.textContent=n?('Arrange '+n+' slide'+(n===1?'':'s')):'Arrange';}
    }
    /* the thumbnail of what it would arrange TO. miniDiagram draws any
       slide-shaped thing, and an arrangement IS a slide, so this is free
       and cannot drift from what the canvas would render. */
    function arrThumb(arr){
      return miniDiagram({layout:'blank',panes:[],annots:arr.annots||[]});
    }
    function buildLib(){
      var host=$('#ar-lib'); if(!host) return;
      host.innerHTML='';
      var list=arrList();
      if(!list.length){
        host.innerHTML='<div class="selpane-empty">None yet. Lay a slide '
          +'out the way you like it, then “Save this slide” — the words '
          +'and figures are not kept, only the arrangement.</div>';
        return;
      }
      list.forEach(function(a){
        var row=document.createElement('div');row.className='ar-row';
        var th=document.createElement('div');th.className='ar-th';
        th.appendChild(arrThumb(a));
        row.appendChild(th);
        var mid=document.createElement('div');mid.className='ar-mid';
        var nm=document.createElement('input');
        nm.className='ar-name';nm.type='text';nm.value=a.label||'';
        nm.title='What to call this arrangement';
        nm.addEventListener('keydown',function(e){e.stopPropagation();});
        nm.addEventListener('blur',function(){
          var v=nm.value.trim(); if(!v||v===a.label) return;
          var l=arrList();
          l.forEach(function(x){if(x.id===a.id) x.label=v;});
          arrSave(l);buildLib();buildSug();
        });
        mid.appendChild(nm);
        var sub=document.createElement('div');
        sub.className='ar-sub';
        sub.textContent=(a.annots||[]).length+' item'
          +((a.annots||[]).length===1?'':'s')
          +(a.page==='poster'?' · poster':'');
        mid.appendChild(sub);
        row.appendChild(mid);
        var ctr=document.createElement('span');ctr.className='fp-ctr';
        [['⤓',function(){
            /* apply it to the slide you are on, right now — the shortest
               path from "that one" to "do it" */
            var n=arrApply(a,cur);
            if(!n){toast('Nothing on this slide matches that '
              +'arrangement');return;}
            markDirty();refresh();buildSug();
            toast(n+' item'+(n===1?'':'s')+' re-laid out on this slide');
          },'Use it on this slide now'],
         [bic('exit'),function(){
            arrSave(arrList().filter(function(x){return x.id!==a.id;}));
            Object.keys(pickFor).forEach(function(k){
              if(pickFor[k]===a.id) delete pickFor[k];});
            buildLib();buildSug();sync();
          },'Forget this arrangement']]
          .forEach(function(pr){
            var b=document.createElement('button');
            b.className='film-mini';b.innerHTML=pr[0];b.title=pr[2];
            b.setAttribute('aria-label',pr[2]);
            b.addEventListener('click',function(ev){
              ev.stopPropagation();pr[1]();});
            ctr.appendChild(b);
          });
        row.appendChild(ctr);
        host.appendChild(row);
      });
    }
    function buildSug(){
      var host=$('#ar-sug'); if(!host) return;
      host.innerHTML='';
      var list=arrList();
      if(!list.length){
        host.innerHTML='<div class="selpane-empty">Save an arrangement '
          +'first and every slide will be checked against it here.</div>';
        return;
      }
      (pres.slides||[]).forEach(function(sl,i){
        var row=document.createElement('label');
        row.className='find-ck ar-srow';
        var ck=document.createElement('input');ck.type='checkbox';
        ck.checked=!!pickFor[i];
        /* NOT disabled when empty: clearing a suggestion and taking one
           up are the same control, and a checkbox you cannot tick is a
           checkbox that looks broken */
        ck.addEventListener('change',function(){
          if(!ck.checked) pickFor[i]=''; else {
            var b=arrBest(sl); pickFor[i]=b?b.arr.id:'';
          }
          buildSug();sync();});
        row.appendChild(ck);
        var n=document.createElement('span');
        n.className='aa-slide-n';n.textContent=(i+1);
        row.appendChild(n);
        var t=document.createElement('span');
        t.className='ar-st';t.textContent=slideTitle(sl);
        row.appendChild(t);
        /* WHICH arrangement, changeable per slide: the suggestion is a
           starting point, not a verdict */
        var sel=document.createElement('select');
        sel.className='ar-ssel';
        var o0=document.createElement('option');
        o0.value='';o0.textContent='leave it';
        sel.appendChild(o0);
        list.forEach(function(a){
          var o=document.createElement('option');
          o.value=a.id;
          o.textContent=a.label+' · '
            +Math.round(arrScore(a,sl)*100)+'%';
          sel.appendChild(o);
        });
        sel.value=pickFor[i]||'';
        sel.addEventListener('click',function(e){e.stopPropagation();});
        sel.addEventListener('change',function(){
          pickFor[i]=sel.value;buildSug();sync();});
        row.appendChild(sel);
        host.appendChild(row);
      });
    }
    function seed(){
      pickFor={};
      (pres.slides||[]).forEach(function(sl,i){
        var b=arrBest(sl);
        /* only a CONFIDENT match is ticked for you. A half-fitting
           arrangement offered as a default is how an automatic tool
           earns its reputation for wrecking things. */
        pickFor[i]=(b&&b.score>=0.75)?b.arr.id:'';
      });
    }
    function open(){seed();buildLib();buildSug();sync();dlg.hidden=false;}
    function close(){dlg.hidden=true;}
    $('#ar-close').addEventListener('click',close);
    $('#ar-cancel').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#ar-save').addEventListener('click',function(e){
      e.stopPropagation();
      var sl=pres.slides[cur];
      if(!sl||!(sl.annots||[]).length){
        toast('Lay something out on this slide first');return;}
      var nm=prompt('Call this arrangement:',
        slideTitle(sl).slice(0,30)||'Arrangement');
      if(nm==null) return;
      nm=nm.trim(); if(!nm) return;
      var l=arrList();
      l.push(arrFromSlide(sl,nm));
      arrSave(l);
      /* re-seed: the suggestions were computed against a library that did
         not contain this yet — and on the first save that library was
         empty, so nothing was suggested at all */
      seed();buildLib();buildSug();sync();
      toast('“'+nm+'” saved — offered on every deck you open here');
    });
    $('#ar-all').addEventListener('click',function(){
      (pres.slides||[]).forEach(function(sl,i){
        var b=arrBest(sl);
        if(b&&b.score>0) pickFor[i]=b.arr.id;});
      buildSug();sync();});
    $('#ar-none').addEventListener('click',function(){
      pickFor={};buildSug();sync();});
    $('#ar-ok').addEventListener('click',function(){
      var list=chosen(),moved=0;
      list.forEach(function(e){moved+=arrApply(e.arr,e.i);});
      close();
      if(!moved){toast('Nothing on those slides matched');return;}
      markDirty();refresh();
      toast(moved+' item'+(moved===1?'':'s')+' re-laid out across '
        +list.length+' slide'+(list.length===1?'':'s')
        +'. Ctrl+Z undoes the lot.');
    });
    window.SemDeckArrange=open;
  })();
  /* ---- THE STYLE-SET GALLERY -------------------------------------------
     Every card is SET IN the type it is offering, because a look is
     chosen by looking. The same reason the Styles menu's rows are
     specimens rather than a list of point sizes. */
  (function(){
    var dlg=$('#ss-dlg'); if(!dlg) return;
    function unstyledCount(){
      return stdBoxes().filter(function(p){
        return !(p.a.style&&STYLE_DEFAULTS[p.a.style]);}).length;
    }
    function card(t){
      var c=document.createElement('button');
      c.className='ss-card';c.type='button';
      var h=document.createElement('div');h.className='ss-name';
      h.textContent=t.label;
      if(t.mine){
        var chip=document.createElement('span');
        chip.className='ss-mine';chip.textContent='yours';
        h.appendChild(chip);
      }
      c.appendChild(h);
      /* the specimen: three real lines at the set's own relative sizes,
         scaled to fit the card rather than to the page */
      var spec=document.createElement('div');spec.className='ss-spec';
      [['title','Title'],['h2','A heading'],
       ['body','Body text that runs on a little.'],
       ['caption','A caption']].forEach(function(pr){
        var d=(t.styles||{})[pr[0]]; if(!d) return;
        var ln=document.createElement('div');
        ln.className='ss-line';ln.textContent=pr[1];
        ln.style.fontSize=Math.max(8,Math.min(23,d.size*2.5))+'px';
        ln.style.fontWeight=d.b?'700':'400';
        if(d.i) ln.style.fontStyle='italic';
        if(d.font) ln.style.fontFamily=fontCss(d.font);
        if(d.color) ln.style.color=d.color;
        if(d.lh) ln.style.lineHeight=d.lh;
        spec.appendChild(ln);
      });
      c.appendChild(spec);
      var note=document.createElement('div');
      note.className='ss-note';note.textContent=t.note||'';
      c.appendChild(note);
      if(t.mine){
        var x=document.createElement('span');
        x.className='ss-del';x.innerHTML=bic('exit');
        x.title='Forget this set';
        x.addEventListener('click',function(e){
          e.stopPropagation();
          saveMyStyleSets(myStyleSets().filter(function(m){
            return m.id!==t.id;}));
          build();
        });
        c.appendChild(x);
      }
      c.addEventListener('click',function(){
        var auto=$('#ss-auto');
        var r=(auto&&auto.checked)?autoStyleDeck(t.id)
          :{named:0,styled:applyStyleSet(t.id),set:t};
        markDirty();refresh();build();
        var msg='“'+t.label+'” applied';
        if(r&&r.named) msg+=' — '+r.named+' box'+(r.named===1?'':'es')
          +' were named from their size first';
        else if(r&&!r.styled) msg+=' — but nothing here wears a named '
          +'style, so nothing moved. Tick the box below to name them.';
        toast(msg+(r&&r.styled?'. Ctrl+Z undoes it.':''));
      });
      return c;
    }
    function build(){
      var g=$('#ss-grid'); if(!g) return;
      g.innerHTML='';
      STYLE_SETS.forEach(function(t){g.appendChild(card(t));});
      myStyleSets().forEach(function(t){
        var m=deep(t);m.mine=1;
        g.appendChild(card(m));});
      var w=$('#ss-what'),n=unstyledCount();
      if(w) w.textContent=n
        ? (n+' text box'+(n===1?'':'es')+' on this deck wear no named '
          +'style. Picking a set below will name them from their size and '
          +'then style them.')
        : 'Everything here already wears a named style, so a set restyles '
          +'it straight away.';
      var aw=$('#ss-autowrap'); if(aw) aw.hidden=!n;
    }
    function open(){build();dlg.hidden=false;}
    function close(){dlg.hidden=true;}
    $('#ss-close').addEventListener('click',close);
    $('#ss-cancel').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#ss-save').addEventListener('click',function(e){
      e.stopPropagation();
      var nm=prompt('Call this style set:','My set');
      if(nm==null) return;
      nm=nm.trim(); if(!nm) return;
      var st={};
      styleOrder().forEach(function(id){
        var d=styleDef(id); if(!d) return;
        var o={size:d.size};
        ['b','i','font','color','align','lh','pspace'].forEach(function(k){
          if(d[k]!==undefined) o[k]=d[k];});
        st[id]=o;
      });
      var list=myStyleSets();
      list.push({id:'ss'+Date.now().toString(36),label:nm,
        note:'Saved from “'+(pres.name||'a deck')+'”.',styles:st});
      saveMyStyleSets(list);
      build();
      toast('“'+nm+'” saved — it is offered on every deck you open here');
    });
    window.SemDeckStyleSets=open;
  })();
  /* ---- ONE SLIDE'S LAYOUT, GIVEN TO SEVERAL ----------------------------
     The Match slide menu only ever PULLED — pick another slide and this
     one takes its arrangement — so making six slides agree meant doing it
     six times, standing on a different slide each time (2026-08-22).
     The model is the slide you are ON, which is the one you have just got
     looking right. */
  (function(){
    var dlg=$('#ms-dlg'); if(!dlg) return;
    var msOff=new WeakMap();       /* excluded, keyed on the slide OBJECT */
    function has(s){return !!s&&!msOff.has(s)&&s!==pres.slides[cur];}
    function idxs(){
      var out=[];
      (pres.slides||[]).forEach(function(s,i){if(has(s)) out.push(i);});
      return out;
    }
    function words(){
      var n=idxs().length;
      return n?(n+' slide'+(n===1?'':'s')+' will be re-laid out')
        :'No slides chosen';
    }
    function sync(){
      var c=$('#ms-count'); if(c) c.textContent=words();
      var ok=$('#ms-ok'),n=idxs().length;
      if(ok){ok.disabled=!n;
        ok.textContent=n?('Match '+n+' slide'+(n===1?'':'s')):'Match';}
    }
    function build(){
      var w=$('#ms-what');
      if(w) w.innerHTML='Every one of them takes the layout of '
        +'<span class="aa-chip">slide '+(cur+1)+'</span> — the position, '
        +'size and styling of what is on it, matched up by kind. '
        +'Content never moves.';
      var host=$('#ms-scope'); if(!host) return;
      host.innerHTML='';
      sectionRuns().forEach(function(r){
        if(r.id){
          var h=document.createElement('div');h.className='aa-sech';
          var hck=document.createElement('input');hck.type='checkbox';
          var on=0,tot=0,i;
          for(i=r.at;i<r.at+r.n;i++){
            if(i===cur) continue;
            tot++; if(has(pres.slides[i])) on++;
          }
          hck.checked=on>0;
          hck.indeterminate=on>0&&on<tot;
          hck.disabled=!tot;
          hck.addEventListener('change',function(){
            for(var j=r.at;j<r.at+r.n;j++){
              if(j===cur) continue;
              if(hck.checked) msOff['delete'](pres.slides[j]);
              else msOff.set(pres.slides[j],1);
            }
            build();sync();
          });
          h.appendChild(hck);
          var ht=document.createElement('span');
          ht.textContent=r.name;h.appendChild(ht);
          host.appendChild(h);
        }
        var grid=document.createElement('div');grid.className='aa-grid';
        for(var k=r.at;k<r.at+r.n;k++)(function(i2){
          var sl=pres.slides[i2]; if(!sl) return;
          var lab=document.createElement('label');
          lab.className='find-ck'+(i2===cur?' aa-no':'');
          var ck=document.createElement('input');ck.type='checkbox';
          ck.checked=has(sl);
          /* the model cannot also be a destination */
          ck.disabled=(i2===cur);
          ck.addEventListener('change',function(){
            if(ck.checked) msOff['delete'](sl); else msOff.set(sl,1);
            sync();});
          lab.appendChild(ck);
          var n2=document.createElement('span');
          n2.className='aa-slide-n';n2.textContent=(i2+1);
          lab.appendChild(n2);
          var t=document.createElement('span');
          t.className='aa-slide-t';
          t.textContent=(i2===cur)?(slideTitle(sl)+' (the model)')
            :slideTitle(sl);
          lab.appendChild(t);
          lab.title=t.textContent;
          grid.appendChild(lab);
        })(k);
        host.appendChild(grid);
      });
    }
    function open(){
      if((pres.slides||[]).length<2){
        toast('There is only one slide to match');return;}
      build();sync();dlg.hidden=false;
    }
    function close(){dlg.hidden=true;}
    $('#ms-ok').addEventListener('click',function(){
      var list=idxs(),moved=0,none=0;
      list.forEach(function(i){
        var r=matchSlide(cur,i);
        if(!r) return;
        if(r.moved) moved+=r.moved; else none++;
      });
      close();
      if(!moved){toast('Nothing on those slides matched what is on this '
        +'one — only items of the same kind travel');return;}
      var msg=moved+' item'+(moved===1?'':'s')+' re-laid out across '
        +list.length+' slide'+(list.length===1?'':'s');
      if(none) msg+=' — '+none+' had nothing in common with this one';
      markDirty();refresh();
      toast(msg+'. Ctrl+Z undoes the lot.');
    });
    $('#ms-cancel').addEventListener('click',close);
    $('#ms-close').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#ms-all').addEventListener('click',function(){
      (pres.slides||[]).forEach(function(s){msOff['delete'](s);});
      build();sync();});
    $('#ms-none').addEventListener('click',function(){
      (pres.slides||[]).forEach(function(s){msOff.set(s,1);});
      build();sync();});
    window.SemDeckMatchMany=open;
  })();
  /* pick which slide to match, from a small list of the others */
  function openMatchMenu(btn){
    var old=$('#match-menu'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu match-menu';m.id='match-menu';
    /* the OTHER direction, first, because it is the one that scales: you
       have just got this slide looking right and want the rest to follow
       (2026-08-22). Pulling one slide's layout onto this one is still
       below it, unchanged. */
    var push=document.createElement('button');
    push.className='dbtn vw-opt';
    push.innerHTML=bic('inherit')+' Give this slide’s layout to…';
    push.title='Choose which slides take the arrangement of this one';
    push.addEventListener('click',function(e){
      e.stopPropagation();m.remove();
      if(typeof window.SemDeckMatchMany==='function')
        window.SemDeckMatchMany();
    });
    m.appendChild(push);
    /* the saved-arrangements library, in the same menu: matching to
       another slide and matching to a saved layout are the same verb with
       a different model, so they belong one click apart (2026-08-22) */
    var arr=document.createElement('button');
    arr.className='dbtn vw-opt';
    arr.innerHTML=bic('layouts')+' Arrangements…';
    arr.title='Layouts you have saved, with a thumbnail of each — and '
      +'which slides they would fit';
    arr.addEventListener('click',function(e){
      e.stopPropagation();m.remove();
      if(typeof window.SemDeckArrange==='function') window.SemDeckArrange();
    });
    m.appendChild(arr);
    menuHead(m,'take the layout of…');
    var any=false;
    (pres.slides||[]).forEach(function(sl,i){
      if(i===cur) return;
      any=true;
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      var n=document.createElement('span');n.className='fh-n';
      n.textContent=(i+1);b.appendChild(n);
      var t=document.createElement('span');
      t.textContent=slideTitle(sl);b.appendChild(t);
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();
        var r=matchSlide(i,cur);
        if(!r) return;
        if(!r.moved){
          toast('Slide '+(i+1)+' and this one have no matching items — '
            +'nothing to copy a layout from');
          return;
        }
        markDirty();refresh();
        var note='Matched '+r.moved+' item'+(r.moved===1?'':'s')
          +' to slide '+(i+1);
        if(r.missing.length)
          note+=' — '+r.missing.length+' kind'
            +(r.missing.length===1?'':'s')+' here had nothing to match';
        toast(note);
      });
      m.appendChild(b);
    });
    if(!any) menuHead(m,'there is only one slide');
    document.body.appendChild(m);
    floatMenu(btn,m);
    setTimeout(function(){
      document.addEventListener('click',function once(e){
        if(!m.contains(e.target)) m.remove();
        document.removeEventListener('click',once);
      });
    },0);
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
     /* align to the PAGE, not to each other. With one item selected the
        two are indistinguishable, which is why the six above already do
        the right thing on their own — these are for centring a whole
        group on the page without first selecting something at its edge
        (2026-08-20, user asked for arrange "like what there is in photo
        shop editors ... really thorough") */
     ['p:hcenter','Centre on the page, side to side'],
     ['p:vmiddle','Centre on the page, top to bottom'],
     ['p:both','Centre on the page, both ways'],
     ['d:h','Equal gaps across (3+ items)'],
     ['d:v','Equal gaps down (3+ items)'],
     ['g:h','Close the gaps across'],
     ['g:v','Close the gaps down'],
     ['o:front','Bring to front'],
     ['o:forward','Bring forward one'],
     ['o:backward','Send backward one'],
     ['o:back','Send to back'],
     ['f:h','Flip left to right'],
     ['f:v','Flip top to bottom'],
     ['o:rotl','Rotate left 15°'],
     ['o:rotr','Rotate right 15°'],
     ['r:90','Turn a quarter turn right'],
     ['r:-90','Turn a quarter turn left'],
     ['r:0','Straighten (no rotation)'],
     ['o:row','Tidy into a row'],
     ['o:grid','Tidy into a grid'],
     ['m:w','Match widths to the widest'],
     ['m:h','Match heights to the tallest'],
     ['m:both','Match both to the biggest'],
     /* the deck-wide version of the three rows above it, which is why it
        lives here and not in a group of its own: this menu is already
        where "make these things match" is kept, and it is shown for
        every kind of item, which the Styles menu beside it is not
        (2026-08-22) */
     ['a:type','Apply this look to every one of its type…'],
     /* the two POINT-AT-IT verbs. They live here, with the other
        make-things-match rows, and cost the ribbon nothing (2026-08-22) */
     ['x:to','Copy this look to objects I click…'],
     ['x:from','Take the look of an object I click…'],
     /* the LAYOUT sibling of the two rows above: same gesture, but what
        travels is the arrangement rather than the look (TASKS T8) */
     ['x:layout','Lay these out like a group I click…'],
     /* the REPORT-first sibling of "Tidy into a row" above: that one
        rearranges what you selected, this one looks at the whole page
        and asks first (TASKS T9) */
     ['o:tidyup','Tidy up this page…'],
     /* SELECTING is not arranging, but this is the menu that is shown
        for every kind of item and already keeps the "everything like
        this one" verbs — and the ribbon has no width to spare for a
        button of its own (TASKS T5) */
     ['s:by','Select everything on this slide like this…']],'al',
    function(what){
      if(what==='s:by'){openSelectByMenu($('#fmt-align-btn'));return;}
      if(what==='o:tidyup'){showTidyPane();return;}
      if(what.indexOf('a:')===0){
        if(typeof window.SemDeckApplyDlg==='function')
          window.SemDeckApplyDlg();
        return;
      }
      if(what.indexOf('x:')===0){armMatch(what.slice(2));return;}
      if(what.indexOf('d:')===0){distributeSel(what.slice(2));return;}
      if(what.indexOf('p:')===0){centreOnPage(what.slice(2));return;}
      if(what.indexOf('g:')===0){closeGaps(what.slice(2));return;}
      if(what.indexOf('f:')===0){flipSel(what.slice(2));return;}
      if(what.indexOf('r:')===0){turnSel(+what.slice(2));return;}
      if(what.indexOf('m:')===0){sameSize(what.slice(2));return;}
      if(what.indexOf('o:')===0){
        /* drive the original buttons so each keeps its one implementation */
        var b=$({front:'#fmt-front',back:'#fmt-back',rotl:'#fmt-rotl',
          rotr:'#fmt-rotr',row:'#fmt-arline',grid:'#fmt-argrid',
          forward:'#fmt-forward',backward:'#fmt-backward'
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
  /* ---- EQUATION -------------------------------------------------------
     A text box that starts with the LaTeX delimiters already in it. There
     is no new item kind and no new renderer: MathJax is loaded on every
     page (render/page.py always splices it in) and renderSlide already
     calls typeset() on the finished slide, so an ordinary text box whose
     words happen to be "$$ ... $$" is typeset for free - and moves,
     colours, scales, exports and animates like any other text box
     (2026-08-20, user asked for "Maths inserts").
     What it DOES add is re-typesetting after an edit: the annot layer is
     rebuilt on every change, so the rendered maths would otherwise be
     thrown away the moment you touched anything. */
  /* ---- THE EQUATION EDITOR --------------------------------------------
     The old "Insert equation" dropped a text box containing "$$ E = mc^2
     $$" and walked away: no preview, no symbols, and no way to tell
     whether what you typed was valid (2026-08-20, user: "what the hell
     does insert equation do? There is no latex render and no symbols and
     stuff to add?").
     Type on the left, see it set on the right, click a symbol to drop it
     at the caret. A template like \frac{}{} leaves the caret in the first
     empty brace, because landing after the closing brace means deleting
     your way back every single time. */
  var EQ_PAL=[
    ['Structures',[
      ['\\frac{a}{b}','\\frac{}{}','fraction'],
      ['a^{b}','^{}','superscript / power'],
      ['a_{b}','_{}','subscript'],
      ['\\sqrt{x}','\\sqrt{}','square root'],
      ['\\sqrt[n]{x}','\\sqrt[]{}','nth root'],
      ['\\sum','\\sum_{i=1}^{n} ','sum'],
      ['\\prod','\\prod_{i=1}^{n} ','product'],
      ['\\int','\\int_{a}^{b} ','integral'],
      ['\\iint','\\iint ','double integral'],
      ['\\oint','\\oint ','contour integral'],
      ['\\lim','\\lim_{x \\to 0} ','limit'],
      ['(\\;)','\\left( \\right)','auto-sized brackets'],
      ['[\\;]','\\left[ \\right]','auto-sized square brackets'],
      ['\\{\\;\\}','\\left\\{ \\right\\}','auto-sized braces'],
      ['|\\;|','\\left| \\right|','absolute value'],
      ['\\binom{n}{k}','\\binom{}{}','binomial coefficient'],
      ['\\overline{x}','\\overline{}','overline / mean'],
      ['\\hat{x}','\\hat{}','hat'],
      ['\\vec{x}','\\vec{}','vector'],
      ['\\dot{x}','\\dot{}','time derivative'],
      ['\\text{if}','\\text{}','ordinary words inside maths'],
      ['2\\times2','\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
       'matrix'],
      ['cases','\\begin{cases} a & x<0 \\\\ b & x\\ge 0 \\end{cases}',
       'a case split'],
      ['align','\\begin{aligned} a &= b \\\\ &= c \\end{aligned}',
       'several lines, aligned on =']]],
    ['Greek',[
      ['\\alpha','\\alpha ',''],['\\beta','\\beta ',''],
      ['\\gamma','\\gamma ',''],['\\delta','\\delta ',''],
      ['\\epsilon','\\varepsilon ',''],['\\zeta','\\zeta ',''],
      ['\\eta','\\eta ',''],['\\theta','\\theta ',''],
      ['\\kappa','\\kappa ',''],['\\lambda','\\lambda ',''],
      ['\\mu','\\mu ',''],['\\nu','\\nu ',''],['\\xi','\\xi ',''],
      ['\\pi','\\pi ',''],['\\rho','\\rho ',''],['\\sigma','\\sigma ',''],
      ['\\tau','\\tau ',''],['\\phi','\\varphi ',''],['\\chi','\\chi ',''],
      ['\\psi','\\psi ',''],['\\omega','\\omega ',''],
      ['\\Gamma','\\Gamma ',''],['\\Delta','\\Delta ',''],
      ['\\Theta','\\Theta ',''],['\\Lambda','\\Lambda ',''],
      ['\\Sigma','\\Sigma ',''],['\\Phi','\\Phi ',''],
      ['\\Psi','\\Psi ',''],['\\Omega','\\Omega ','']]],
    ['Operators & relations',[
      ['\\times','\\times ',''],['\\div','\\div ',''],
      ['\\pm','\\pm ',''],['\\mp','\\mp ',''],['\\cdot','\\cdot ',''],
      ['\\ast','\\ast ',''],['\\circ','\\circ ',''],
      ['\\leq','\\leq ',''],['\\geq','\\geq ',''],['\\neq','\\neq ',''],
      ['\\approx','\\approx ',''],['\\equiv','\\equiv ',''],
      ['\\sim','\\sim ',''],['\\propto','\\propto ',''],
      ['\\ll','\\ll ',''],['\\gg','\\gg ',''],
      ['\\in','\\in ',''],['\\notin','\\notin ',''],
      ['\\subset','\\subset ',''],['\\cup','\\cup ',''],
      ['\\cap','\\cap ',''],['\\forall','\\forall ',''],
      ['\\exists','\\exists ',''],['\\nabla','\\nabla ',''],
      ['\\partial','\\partial ',''],['\\infty','\\infty ',''],
      ['30^\\circ','^\\circ ','degrees']]],
    ['Arrows & accents',[
      ['\\to','\\to ',''],['\\gets','\\gets ',''],
      ['\\Rightarrow','\\Rightarrow ',''],
      ['\\Leftarrow','\\Leftarrow ',''],
      ['\\Leftrightarrow','\\Leftrightarrow ',''],
      ['\\mapsto','\\mapsto ',''],['\\uparrow','\\uparrow ',''],
      ['\\downarrow','\\downarrow ',''],
      ['\\tilde{x}','\\tilde{}',''],['\\bar{x}','\\bar{}',''],
      ['\\ddot{x}','\\ddot{}',''],['\\underline{x}','\\underline{}',''],
      ['\\mathbb{R}','\\mathbb{R}','the reals'],
      ['\\mathcal{L}','\\mathcal{}','script letter'],
      ['\\mathbf{v}','\\mathbf{}','bold (a vector)'],
      ['thin space','\\, ','a thin space'],
      ['wide space','\\quad ','a wide space']]],
    ['Ready-made',[
      ['E=mc^2','E = mc^2',''],
      ['quadratic','x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',''],
      ['Gaussian','f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}'
       +' e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}',''],
      ['mean','\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i',''],
      ['RMSE','\\mathrm{RMSE} = \\sqrt{\\frac{1}{n}'
       +'\\sum_{i=1}^{n}(y_i-\\hat{y}_i)^2',''],
      ['derivative','\\frac{\\partial u}{\\partial t}',''],
      ['integral','\\int_{a}^{b} f(x)\\,dx','']]]
  ];
  (function(){
    var dlg=$('#eq-dlg'); if(!dlg) return;
    var src=$('#eq-src'),prev=$('#eq-prev'),warn=$('#eq-warn'),
        pal=$('#eq-pal'),disp=$('#eq-display');
    var editIdx=null,prevT=null;
    function wrap(tex,display){
      return display?('$$ '+tex+' $$'):('$ '+tex+' $');
    }
    /* pull the LaTeX back out of a stored text item */
    function unwrap(t){
      var m=/^\s*\$\$([\s\S]*)\$\$\s*$/.exec(t||'');
      if(m) return {tex:m[1].trim(),display:true};
      m=/^\s*\$([\s\S]*)\$\s*$/.exec(t||'');
      if(m) return {tex:m[1].trim(),display:false};
      return {tex:(t||'').trim(),display:true};
    }
    function render(){
      clearTimeout(prevT);
      prevT=setTimeout(function(){
        var tex=src.value.trim();
        prev.textContent=tex?wrap(tex,disp.checked):'';
        if(!window.MathJax||!MathJax.typesetPromise){
          /* MathJax comes from a CDN. Offline, or on a network that
             blocks it, there is no renderer at all — and a blank preview
             would read as "your LaTeX is wrong" rather than "nothing here
             can draw it" (2026-08-20). */
          warn.hidden=false;
          warn.textContent='No maths renderer available — MathJax is '
            +'loaded from the internet and could not be reached. The '
            +'LaTeX is still saved with the slide and will typeset '
            +'anywhere that can load it.';
          return;
        }
        warn.hidden=true;
        MathJax.typesetPromise([prev]).then(function(){
          /* MathJax never REJECTS on bad input, and it fails in two
             different ways depending on how bad it is: a command it does
             not know gets a red "Math input error" box, while something
             it cannot parse at all - an unclosed brace, say - is left as
             raw "$$ ... $$" text with no container produced at all.
             Neither throws, so the test is "did a container come out,
             and is it clean", not "did anything reject" (2026-08-20,
             both observed live in the browser). */
          var bad=prev.querySelector('mjx-merror,.MathJax_Error');
          var setOk=prev.querySelector('mjx-container');
          if(setOk&&!bad) return;
          warn.hidden=false;
          warn.textContent=bad
            ?('That is not valid LaTeX yet — '
              +(bad.getAttribute('title')
                ||'check the braces and backslashes')
              +'. The red box shows where it gave up.')
            :('That did not typeset — usually an unclosed { or a '
              +'misspelt command. It is still saved exactly as you '
              +'typed it.');
        }).catch(function(e){
          warn.hidden=false;
          warn.textContent='That does not parse as LaTeX yet: '
            +(e&&e.message?e.message:'check the braces');
        });
      },160);
    }
    function insert(txt){
      var a=src.selectionStart||0,b=src.selectionEnd||0;
      src.value=src.value.slice(0,a)+txt+src.value.slice(b);
      /* land the caret in the FIRST empty pair of braces, not after the
         template — otherwise every insert is followed by arrowing back */
      var hole=txt.indexOf('{}');
      var at=hole>=0?(a+hole+1):(a+txt.length);
      src.focus();src.setSelectionRange(at,at);
      render();
    }
    function buildPal(){
      pal.innerHTML='';
      EQ_PAL.forEach(function(grp){
        var h=document.createElement('div');
        h.className='eq-palh';h.textContent=grp[0];
        pal.appendChild(h);
        var row=document.createElement('div');row.className='eq-palrow';
        grp[1].forEach(function(it){
          var b=document.createElement('button');
          b.type='button';b.className='eq-key';
          /* the KEY is SET in maths, not spelled in LaTeX. A palette
             reading "\alpha \beta \gamma" is the same words-where-a-
             picture-belongs problem the fill menu had: you should be able
             to find sigma by looking for a sigma (2026-08-20). Labels
             that are ordinary words stay words. */
          if(/[\\^_]/.test(it[0])){
            b.className+=' eq-key-tex';
            b.textContent='\\('+it[0]+'\\)';
          } else b.textContent=it[0];
          b.title=(it[2]||it[1].trim())+'  →  '+it[1].trim();
          b.addEventListener('click',function(e){
            e.preventDefault();insert(it[1]);});
          row.appendChild(b);
        });
        pal.appendChild(row);
      });
      /* ONE typeset pass over the whole palette, once it is built */
      if(window.MathJax&&MathJax.typesetPromise)
        MathJax.typesetPromise([pal]).catch(function(){
          /* no renderer reachable: fall back to the LaTeX, which is at
             least readable and is what you would have typed anyway */
          $$('.eq-key-tex',pal).forEach(function(b){
            b.textContent=b.textContent.replace(/^\\\(|\\\)$/g,'');});
        });
    }
    function open(idx){
      editIdx=(typeof idx==='number')?idx:null;
      var s2=pres.slides[cur];
      var a=(editIdx!=null)?(s2.annots||[])[editIdx]:null;
      var u=a?unwrap(a.text):{tex:'E = mc^2',display:true};
      src.value=u.tex;disp.checked=u.display;
      if(!pal.childNodes.length) buildPal();
      dlg.hidden=false;
      $('#eq-ok').textContent=(editIdx!=null)?'Update it'
        :'Put it on the slide';
      src.focus();src.select();
      render();
    }
    function close(){dlg.hidden=true;editIdx=null;}
    function commit(){
      var tex=src.value.trim();
      if(!tex){close();return;}
      var s2=pres.slides[cur];
      if(!s2){toast('Add a slide first');close();return;}
      var txt=wrap(tex,disp.checked);
      s2.annots=s2.annots||[];
      var idx;
      if(editIdx!=null&&s2.annots[editIdx]){
        s2.annots[editIdx].text=txt;
        delete s2.annots[editIdx].html;
        idx=editIdx;
      } else {
        s2.annots.push({k:'text',x:28,y:40,w:44,text:txt,
          size:disp.checked?3.6:2.6,bg:0,align:'center',maths:1});
        idx=s2.annots.length-1;
      }
      markDirty();setTool('select');
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s2);selectAnnot(l,idx);}
      else renderSlide();
      close();
    }
    src.addEventListener('input',render);
    src.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
      else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){
        e.preventDefault();commit();}
    });
    disp.addEventListener('change',render);
    $('#eq-ok').addEventListener('click',commit);
    $('#eq-cancel').addEventListener('click',close);
    $('#eq-close').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    var mb=$('#dc-maths');
    if(mb) mb.addEventListener('click',function(){open(null);});
    /* editing an existing one: the Text group grows an Edit button when
       the selected box is maths */
    var eb=$('#fmt-eqedit');
    if(eb) eb.addEventListener('click',function(){
      if(typeof selAnnot==='number') open(selAnnot);});
    window.SemDeckEquation=open;
  })();
  /* ---- THE APPLY DIALOG ------------------------------------------------
     One surface answering the three questions the old "apply to all
     headings" answered for you: WHAT type, WHICH properties, WHICH
     slides (2026-08-22).

     It always DIRECT-WRITES the fields onto the matching items; it never
     edits the style registry. A registry entry carries only the eight
     properties applyStyleTo writes, so it cannot express width, height,
     x, y, indentation or see-through, and it is one object for the whole
     deck, so it cannot express a slide subset either. A path that quietly
     switched between the two depending on which boxes you happened to
     tick would be untestable. The price is real and the toast says it:
     the boxes stop matching their named style, so Re-apply would put them
     back. The two one-click registry actions in the Styles menu are
     untouched and are still the right tool when a style is what you
     mean. */
  (function(){
    var dlg=$('#aa-dlg'); if(!dlg) return;
    var srcA=null,srcKey='',srcKind='text';
    function selNow(){
      var s=pres.slides[cur]; if(!s) return null;
      if(typeof selAnnot==='number') return annotByIdx(s,selAnnot);
      return null;
    }
    /* an item of the CHOSEN type, for the wording. Once the type is
       choosable it is no longer necessarily the source's own type, and
       "text boxes at about 42 pt" read off the source would be naming the
       size of the box you copied FROM rather than the ones about to
       change. Falls back to the source when nothing else matches. */
    function keySample(){
      if(srcA&&typeKeyOf(srcA)===srcKey) return srcA;
      var found=null;
      (pres.slides||[]).forEach(function(sl){
        (sl.annots||[]).forEach(function(a){
          if(!found&&a&&!a.hide&&typeKeyOf(a)===srcKey) found=a;});
      });
      return found||srcA;
    }
    function close(){
      dlg.hidden=true;
      unmark();
      srcA=null;
    }
    function unmark(){
      $$('.an-typematch').forEach(function(n){
        n.classList.remove('an-typematch');});
    }
    /* outline the matching items on the slide behind the dialog. A class
       toggle over nodes that are already on the page — never a re-render,
       and never markDirty: looking at something is not an edit. */
    function mark(on){
      unmark();
      if(!on) return;
      var layer=stage&&stage.querySelector('.annot-layer');
      if(!layer) return;
      var s=pres.slides[cur]; if(!s) return;
      $$('[data-idx]',layer).forEach(function(n){
        var a=annotByIdx(s,+n.getAttribute('data-idx'));
        if(a&&typeKeyOf(a)===srcKey) n.classList.add('an-typematch');
      });
    }
    function buildWhat(){
      var host=$('#aa-what'); if(!host) return;
      host.innerHTML='';
      var lead=document.createElement('span');
      lead.textContent='Make every';
      host.appendChild(lead);
      /* the chip is a BUTTON, not a label. It names the type in the
         accent colour — which is what was asked for — and it opens the
         list of every other type in the deck, which is what makes the
         action usable after you have already changed the box you are
         copying from. */
      var chip=document.createElement('button');
      chip.className='aa-chip aa-chipbtn';
      chip.type='button';
      chip.textContent=typeLabel(srcKey,false,keySample())+' ▾';
      chip.title='Which kind of object to change. Hover to outline them '
        +'on this slide.';
      chip.setAttribute('aria-haspopup','true');
      host.appendChild(chip);
      var tail=document.createElement('span');
      tail.textContent='look like this one.';
      host.appendChild(tail);
      var n=document.createElement('span');
      n.className='aa-n';n.id='aa-n';
      host.appendChild(n);
      var pick=document.createElement('div');
      pick.className='sh-menu aa-typemenu';pick.id='aa-typemenu';
      pick.hidden=true;
      host.appendChild(pick);
      chip.addEventListener('click',function(e){
        e.stopPropagation();
        var open=pick.hidden;
        if(open){
          pick.innerHTML='';
          menuHead(pick,'change every…');
          var idxs=pageOf().poster?[cur]:scopeIdxs();
          deckTypeKeys(idxs,srcA).forEach(function(t){
            var b=document.createElement('button');
            b.className='dbtn vw-opt';
            b.setAttribute('aria-pressed',(t.key===srcKey).toString());
            b.textContent=typeLabel(t.key,t.n!==1,t.sample)
              +'  ('+t.n+')';
            b.disabled=!t.n;
            b.addEventListener('click',function(ev){
              ev.stopPropagation();
              srcKey=t.key;pick.hidden=true;
              buildWhat();syncWords();
            });
            pick.appendChild(b);
          });
        }
        pick.hidden=!open;
      });
      document.addEventListener('click',function(e){
        if(!pick.hidden&&!pick.contains(e.target)&&e.target!==chip)
          pick.hidden=true;
      });
      chip.addEventListener('mouseenter',function(){mark(true);});
      chip.addEventListener('mouseleave',function(){mark(false);});
    }
    function buildProps(){
      var host=$('#aa-props'); if(!host) return;
      host.innerHTML='';
      APPLY_GROUPS.forEach(function(g){
        var rows=APPLY_PROPS.filter(function(r){return r[2]===g;});
        if(!rows.length) return;
        menuHead(host,g.toLowerCase());
        rows.forEach(function(r){
          var fits=applyRowFits(r,srcKind);
          var lab=document.createElement('label');
          lab.className='find-ck'+(fits?'':' aa-no');
          var ck=document.createElement('input');
          ck.type='checkbox';
          ck.checked=!!applyPick[r[0]];
          ck.disabled=!fits;
          ck.addEventListener('change',function(){
            if(ck.checked) applyPick[r[0]]=1; else delete applyPick[r[0]];
          });
          lab.appendChild(ck);
          lab.appendChild(document.createTextNode(' '+r[1]));
          if(!fits) lab.title=r[1]+' is not something '
            +(APPLY_WHYNOT[srcKind]||'this')+' has.';
          host.appendChild(lab);
        });
      });
    }
    /* the scope column, grouped by section when there are any. Numbered
       titles rather than thumbnails: sixty pictures is a second filmstrip
       inside a dialog, and the thing you are picking here is a NAME. */
    function buildScope(){
      var host=$('#aa-scope'),col=$('#aa-scopecol');
      if(!host||!col) return;
      /* a poster's other pages are deliberately different drafts of one
         sheet, and its export only ever writes the page you are on — so
         there is no scope to pick */
      col.hidden=!!pageOf().poster;
      if(col.hidden) return;
      host.innerHTML='';
      sectionRuns().forEach(function(r){
        var grid;
        if(r.id){
          var h=document.createElement('div');h.className='aa-sech';
          var hck=document.createElement('input');hck.type='checkbox';
          var on=0,i;
          for(i=r.at;i<r.at+r.n;i++) if(scopeHas(pres.slides[i])) on++;
          hck.checked=on>0;
          /* a section that is half in and half out says so rather than
             lying in either direction */
          hck.indeterminate=on>0&&on<r.n;
          hck.addEventListener('change',function(){
            for(var j=r.at;j<r.at+r.n;j++)
              scopeSet(pres.slides[j],hck.checked);
            buildScope();syncWords();
          });
          h.appendChild(hck);
          var ht=document.createElement('span');
          ht.textContent=r.name;h.appendChild(ht);
          host.appendChild(h);
        }
        grid=document.createElement('div');grid.className='aa-grid';
        for(var k=r.at;k<r.at+r.n;k++)(function(i2){
          var sl=pres.slides[i2]; if(!sl) return;
          var lab=document.createElement('label');lab.className='find-ck';
          var ck=document.createElement('input');ck.type='checkbox';
          ck.checked=scopeHas(sl);
          ck.addEventListener('change',function(){
            scopeSet(sl,ck.checked);buildScope();syncWords();});
          lab.appendChild(ck);
          var n=document.createElement('span');
          n.className='aa-slide-n';n.textContent=(i2+1);
          lab.appendChild(n);
          var t=document.createElement('span');
          t.className='aa-slide-t';t.textContent=slideTitle(sl);
          lab.appendChild(t);
          lab.title=slideTitle(sl);
          grid.appendChild(lab);
        })(k);
        host.appendChild(grid);
      });
    }
    function syncWords(){
      var idxs=pageOf().poster?[cur]:scopeIdxs();
      var c=$('#aa-count');
      if(c) c.textContent=pageOf().poster?'This page':scopeWords();
      var n=$('#aa-n');
      var hits=typeCount(srcKey,idxs,srcA);
      if(n) n.textContent=hits+' to change';
      var ok=$('#aa-ok');
      if(ok){
        ok.disabled=!idxs.length||!hits;
        ok.textContent=hits
          ?('Apply to '+hits+' '+typeLabel(srcKey,hits!==1,keySample()))
          :'Nothing to change';
      }
    }
    function open(){
      var a=selNow();
      if(!a){toast('Select the object you want the others to match');
        return;}
      srcA=a;srcKey=typeKeyOf(a);
      srcKind=(selAnnot==='t'||selAnnot==='s')?'text':a.k;
      buildWhat();buildProps();buildScope();syncWords();
      dlg.hidden=false;
    }
    function commit(){
      if(!srcA) return;
      var idxs=pageOf().poster?[cur]:scopeIdxs();
      var want=applyFieldsFor(applyPick,srcKind);
      /* the words are read off a MATCHING item, not off the source: once
         the type is choosable the two are different things, and "5 text
         boxes at about 42 pt" would be naming the size of the box you
         copied FROM rather than the ones that changed */
      var samp=keySample();
      var n=applyToType(srcKey,srcA,want,idxs);
      close();
      if(!n){toast('Nothing else on those slides is a '
        +typeLabel(srcKey,false,samp));return;}
      var msg=n+' '+typeLabel(srcKey,n!==1,samp)+' now match this one';
      /* the one real cost of writing the fields rather than the style,
         said plainly rather than discovered later */
      if(isStyleKey(srcKey))
        msg+=' — they no longer match the '
          +typeLabel(srcKey,false,samp)+' style, so Re-apply would put '
          +'them back';
      toast(msg+'. Ctrl+Z undoes the lot.');
    }
    $('#aa-ok').addEventListener('click',commit);
    $('#aa-cancel').addEventListener('click',close);
    $('#aa-close').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      /* stopPropagation because the canvas listens for Escape and for
         plain letters, and a dialog on top of it must not nudge a shape */
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#aa-all-props').addEventListener('click',function(){
      applyPick=applyPickAll();buildProps();});
    $('#aa-no-props').addEventListener('click',function(){
      applyPick={};buildProps();});
    $('#aa-all-slides').addEventListener('click',function(){
      scopeAll();buildScope();syncWords();});
    window.SemDeckApplyDlg=open;
  })();
  /* is this text item an equation? either it was made as one or its words
     are wrapped in $ … $ */
  function isMaths(a){
    return !!(a&&a.k==='text'
      &&(a.maths||/^\s*\$[\s\S]*\$\s*$/.test(a.text||'')));
  }
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
  /* ---- IMAGES THAT REMEMBER WHERE THEY CAME FROM -----------------------
     (2026-08-22, user: "would be cool if there was a refresh images with
     local object. Like it has the image saved, but also knows the local
     path, and clicking refresh on the image/presentation refreshes them
     from the local path. If local path is gone though, give a list of
     ones that couldn't be refreshed but just leave them as they were".)

     The picture itself stays embedded — a deck has to survive being sent
     to somebody, and a path on your machine means nothing on theirs. What
     is kept BESIDE it is a file HANDLE, which is the browser's own idea
     of "this exact file on disk": it survives a reload, it can be
     re-read on demand, and it asks permission rather than granting the
     page a filesystem.

     Handles cannot be JSON, so they live in IndexedDB — the same store
     the project handle and the embedded cards already use — keyed by an
     id on the annot. `a.fname` is kept on the annot too, purely so the
     "could not refresh" list can NAME the files that went missing. */
  var FHKEY='imgfile:';
  var fhSeq=0;
  function newFileKey(){
    fhSeq++;
    return FHKEY+Date.now().toString(36)+fhSeq.toString(36);
  }
  function readAsDataURL(file){
    return new Promise(function(res,rej){
      var rd=new FileReader();
      rd.onload=function(){res(rd.result);};
      rd.onerror=function(){rej(rd.error);};
      rd.readAsDataURL(file);
    });
  }
  /* shrink on the way in, exactly as the insert path does, so a refreshed
     picture is the same weight as the one it replaces */
  function shrinkDataUrl(src){
    return new Promise(function(res){
      var probe=new Image();
      probe.onload=function(){res(shrinkImage(probe,src));};
      probe.onerror=function(){res(src);};
      probe.src=src;
    });
  }
  /* every image on the deck that was put there from a local file */
  function linkedImages(){
    var out=[];
    (pres.slides||[]).forEach(function(sl,si){
      (sl.annots||[]).forEach(function(a,ai){
        if(a&&a.k==='image'&&a.fkey) out.push({si:si,ai:ai,a:a});});
    });
    return out;
  }
  /* re-read every linked picture from disk. NOTHING is changed unless its
     file actually reads: a picture whose file has moved keeps the copy it
     already had, and is named in the report instead — losing a figure
     because a folder was renamed would be much worse than a stale one. */
  function refreshLinkedImages(list){
    var items=list||linkedImages();
    if(!items.length) return Promise.resolve({ok:0,lost:[]});
    var ok=0,lost=[];
    return items.reduce(function(chain,e){
      return chain.then(function(){
        return idbGet(e.a.fkey).then(function(h){
          if(!h) throw 0;
          return permAsk(h).then(function(granted){
            if(!granted) throw 0;
            return h.getFile();
          });
        }).then(function(f){
          return readAsDataURL(f);
        }).then(function(src){
          return shrinkDataUrl(src);
        }).then(function(src){
          if(!src||src===e.a.src) {ok++;return;}
          e.a.src=src;ok++;
        }).catch(function(){
          lost.push({si:e.si,name:e.a.fname||'a picture'});
        });
      });
    },Promise.resolve()).then(function(){
      if(ok){markDirty();refresh();}
      return {ok:ok,lost:lost};
    });
  }
  /* the user-facing verb: refresh, then SAY what happened — including,
     by name, anything that could not be found */
  function refreshImagesReport(list){
    var n=(list||linkedImages()).length;
    if(!n){
      toast('No pictures on this deck are linked to a file on this '
        +'computer. Insert one with Image and it will remember where it '
        +'came from.');
      return;
    }
    toast('Re-reading '+n+' picture'+(n===1?'':'s')+'…');
    refreshLinkedImages(list).then(function(r){
      if(!r.lost.length){
        toast(r.ok+' picture'+(r.ok===1?'':'s')+' refreshed from disk');
        return;
      }
      var names=r.lost.slice(0,4).map(function(l){
        return l.name+' (slide '+(l.si+1)+')';}).join(', ');
      if(r.lost.length>4) names+=' and '+(r.lost.length-4)+' more';
      toast((r.ok?(r.ok+' refreshed. '):'')
        +r.lost.length+' could not be read and '
        +(r.lost.length===1?'was':'were')+' left exactly as before: '
        +names,9000);
    });
  }
  (function(){
    var mi=$('#mi-refresh-img');
    if(mi) mi.addEventListener('click',function(){
      var dm=$('#dc-menu'); if(dm) dm.hidden=true;
      refreshImagesReport();
    });
    var one=$('#fmt-imgrefresh');
    if(one) one.addEventListener('click',function(e){
      e.stopPropagation();
      var sl=pres.slides[cur],hits=[];
      selIdxs().forEach(function(i){
        var a=(sl&&sl.annots||[])[i];
        if(a&&a.k==='image'&&a.fkey) hits.push({si:cur,ai:i,a:a});});
      refreshImagesReport(hits);
    });
  })();
  function placeImage(src,ar,link){
    var s=pres.slides[cur]; if(!s) return;
    var l=stage.querySelector('.annot-layer');
    var lr=l?l.getBoundingClientRect():null;
    var w=40,h=32;
    if(ar&&lr&&lr.height){h=w*(lr.width/lr.height)*ar;}
    h=Math.max(8,Math.min(86,h));
    s.annots=s.annots||[];
    var img={k:'image',x:Math.max(2,50-w/2),
      y:Math.max(2,50-h/2),w:w,h:h,src:src};
    /* the link, when the browser gave us a real handle to keep */
    if(link&&link.key){img.fkey=link.key;img.fname=link.name||'';}
    s.annots.push(img);
    markDirty();
    setTool('select');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
  }
  /* ---- THE FRAMES PANE -------------------------------------------------
     A flip book is a little deck inside a slide, so its frames are listed
     and reordered in the same shape the slide strip uses: one row each,
     move/duplicate/remove minis, click to go to it. Anything else would
     have been a second
     idiom for the same job (2026-08-22). */
  var flipSel=-1;         /* which annot index the pane is showing */
  /* the selected items as indexes, the same rule fmtApply follows: the
     whole multi-selection when there is one, else the primary. Tying six
     labels to one figure has to be one gesture, not six. */
  function selIdxs(){
    var m=selSet.filter(function(i){return typeof i==='number';});
    if(m.length) return m;
    return (typeof selAnnot==='number')?[selAnnot]:[];
  }
  function flipPaneItem(){
    var s=pres.slides[cur];
    var a=s&&(s.annots||[])[flipSel];
    return (a&&a.k==='flip')?a:null;
  }
  /* the name a frame goes by: yours, else the card's own title, else its
     number. A bound caption has to be able to say WHICH figure it belongs
     to, and "Frame 3" is no help when there are nine of them. */
  function frameLabel(f,i){
    if(!f) return 'Frame '+(i+1);
    if(f.label) return f.label;
    if(f.ref){
      var it=resolveRef(f.ref);
      if(it&&it.title) return it.title;
      return 'Figure '+(i+1)+' (notebook closed)';
    }
    return 'Picture '+(i+1);
  }
  function showFlipPane(on,idx){
    var p=$('#flippane'); if(!p) return;
    if(on){
      if(typeof idx==='number') flipSel=idx;
      /* one pane in the corner at a time — the rule showVerpane keeps */
      ['#selpane','#animpane','#preflight','#notespane','#stdpane',
       '#tidypane','#objhist']
        .forEach(function(sel){var o=$(sel); if(o) o.hidden=true;});
      var ob=$('#objects-btn');
      if(ob) ob.setAttribute('aria-pressed','false');
      if(typeof showVerpane==='function') showVerpane(false);
    }
    /* un-hide BEFORE rendering: renderFlipPane bails on a hidden pane (it
       is called from showFmt on every canvas click and must not rebuild a
       list nobody is looking at), so rendering first drew nothing and the
       pane opened empty */
    p.hidden=!on;
    if(on) renderFlipPane();
  }
  function renderFlipPane(){
    var p=$('#flippane'); if(!p||p.hidden) return;
    var list=$('#flippane-list'),ttl=$('#flippane-t');
    var a=flipPaneItem();
    if(!a){
      if(ttl) ttl.textContent='Flip book';
      if(list) list.innerHTML='<div class="selpane-empty">Select a flip '
        +'book on the slide to see its figures.</div>';
      var tie0=$('#fp-tie'); if(tie0) tie0.hidden=true;
      return;
    }
    var fr=flipFrames(a);
    if(ttl) ttl.textContent='Flip book — '+fr.length+' figure'
      +(fr.length===1?'':'s');
    list.innerHTML='';
    if(!fr.length){
      list.innerHTML='<div class="selpane-empty">No figures yet. '
        +'“+ Figures…” lets you click several notebook cards in a row.'
        +'</div>';
    }
    fr.forEach(function(f,i){
      var row=document.createElement('div');
      row.className='fp-row'+(i===(a.at||0)?' current':'');
      var n=document.createElement('span');
      n.className='fp-n';n.textContent=(i+1);
      row.appendChild(n);
      var t=document.createElement('input');
      t.className='fp-t';t.type='text';
      t.value=f.label||'';
      t.placeholder=frameLabel(f,i);
      t.title='What to call this figure — bound captions name it';
      t.addEventListener('keydown',function(e){e.stopPropagation();});
      /* committed on blur, not per keystroke: renaming rebuilds this list,
         and rebuilding it under the caret is the bug the poster-version
         rename already taught us (2026-08-10) */
      t.addEventListener('blur',function(){
        var v=t.value.trim();
        if(v) f.label=v; else delete f.label;
        markDirty();renderFlipPane();});
      row.appendChild(t);
      var ctr=document.createElement('span');ctr.className='fp-ctr';
      [['↑',function(){flipMove(i,-1);},'Move this figure earlier'],
       ['↓',function(){flipMove(i,1);},'Move this figure later'],
       [bic('exit'),function(){flipDrop(i);},'Remove this figure']]
        .forEach(function(pr){
          var b=document.createElement('button');
          b.className='film-mini';b.innerHTML=pr[0];b.title=pr[2];
          b.setAttribute('aria-label',pr[2]);
          b.addEventListener('click',function(ev){
            ev.stopPropagation();pr[1]();});
          ctr.appendChild(b);
        });
      row.appendChild(ctr);
      row.addEventListener('click',function(){
        a.at=i;markDirty(true);renderSlide();renderFlipPane();});
      list.appendChild(row);
    });
    renderTiePanel(a);
  }
  /* moving a frame must carry its BINDINGS with it, or captions tied to
     figure 4 silently start belonging to whatever slid into slot 4 */
  function flipRemap(a,map){
    var s=pres.slides[cur];
    (s.annots||[]).forEach(function(x){
      if(!x||x.fb!==a.fid) return;
      var to=map[x.fbf||0];
      if(to==null) delete x.fb, delete x.fbf, delete x.fbm;
      else x.fbf=to;
    });
  }
  function flipMove(i,d){
    var a=flipPaneItem(); if(!a) return;
    var fr=flipFrames(a).slice(),j=i+d;
    if(j<0||j>=fr.length) return;
    var t=fr[i];fr[i]=fr[j];fr[j]=t;
    a.frames=fr;
    var map={};fr.forEach(function(_,k){map[k]=k;});
    map[i]=j;map[j]=i;
    flipRemap(a,map);
    if((a.at||0)===i) a.at=j; else if((a.at||0)===j) a.at=i;
    markDirty();renderSlide();renderFlipPane();
  }
  function flipDrop(i){
    var a=flipPaneItem(); if(!a) return;
    var fr=flipFrames(a).slice();
    if(i<0||i>=fr.length) return;
    fr.splice(i,1);
    a.frames=fr;
    /* a caption tied to the frame that just went loses its binding rather
       than pointing at a stranger — and it stays VISIBLE, because an item
       that silently disappears forever is the worst thing here */
    var map={};
    for(var k=0;k<=fr.length;k++) map[k]=(k<i)?k:(k===i?null:k-1);
    flipRemap(a,map);
    a.at=Math.max(0,Math.min(fr.length-1,a.at||0));
    markDirty();renderSlide();renderFlipPane();
  }
  /* ---- TYING AN ITEM TO A FIGURE ---------------------------------------
     "you can tie text to an image in it ... and tie objects and things to
     a specific image in the flip book" (2026-08-22). It lives in the
     frames pane rather than the ribbon because it needs the frame LIST to
     be visible to make any sense, and because the ribbon had nothing to
     give. It acts on the whole selection, so half a dozen labels can be
     tied to one figure in one go. */
  function tieSel(a,frame,mode){
    var s=pres.slides[cur],hits=selIdxs();
    var n=0;
    hits.forEach(function(i){
      var x=(s.annots||[])[i];
      if(!x||x.k==='flip') return;    /* a flip book cannot bind to itself */
      if(frame==null){delete x.fb;delete x.fbf;delete x.fbm;}
      else {x.fb=a.fid;x.fbf=frame;x.fbm=mode||'only';}
      n++;
    });
    if(n){markDirty();renderSlide();renderFlipPane();}
    return n;
  }
  function renderTiePanel(a){
    var host=$('#fp-tie'); if(!host) return;
    var s=pres.slides[cur],hits=selIdxs().filter(function(i){
      var x=(s.annots||[])[i];return x&&x.k!=='flip';});
    host.innerHTML='';
    if(!hits.length||!flipFrames(a).length){
      host.hidden=true;
      return;
    }
    host.hidden=false;
    var lab=document.createElement('div');
    lab.className='fp-tielab';
    lab.textContent=hits.length===1
      ?('Tie “'+annotLabel((s.annots||[])[hits[0]]).slice(0,28)+'” to')
      :('Tie these '+hits.length+' items to');
    host.appendChild(lab);
    var cur0=(s.annots||[])[hits[0]]||{};
    var sel=document.createElement('select');
    sel.className='fp-tiesel';
    var o0=document.createElement('option');
    o0.value='';o0.textContent='(not tied — always shown)';
    sel.appendChild(o0);
    flipFrames(a).forEach(function(f,i){
      var o=document.createElement('option');
      o.value=String(i);o.textContent=(i+1)+'. '+frameLabel(f,i);
      sel.appendChild(o);
    });
    sel.value=(cur0.fb===a.fid&&cur0.fbf!=null)?String(cur0.fbf):'';
    host.appendChild(sel);
    var mode=document.createElement('select');
    mode.className='fp-tiesel';
    FLIP_MODES.forEach(function(m){
      var o=document.createElement('option');
      o.value=m[0];o.textContent=m[1];
      mode.appendChild(o);
    });
    mode.value=cur0.fbm||'only';
    mode.disabled=sel.value==='';
    host.appendChild(mode);
    function commit(){
      mode.disabled=sel.value==='';
      tieSel(a,sel.value===''?null:+sel.value,mode.value);
    }
    sel.addEventListener('change',commit);
    mode.addEventListener('change',commit);
  }
  (function(){
    var fg=$('#fmt-figures');
    if(fg) fg.addEventListener('click',function(e){
      e.stopPropagation();
      var s=pres.slides[cur],idx=null;
      selIdxs().forEach(function(i){
        var x=(s&&s.annots||[])[i];
        if(idx===null&&x&&x.k==='flip') idx=i;});
      if(idx===null) return;
      var p=$('#flippane');
      showFlipPane(!!(p&&p.hidden),idx);
    });
    var cl=$('#flippane-close');
    if(cl) cl.addEventListener('click',function(){showFlipPane(false);});
    var ac=$('#fp-add-cells');
    if(ac) ac.addEventListener('click',function(){
      if(flipPaneItem()) startPick(flipSel,true);});
    var ai=$('#fp-add-img'),fi=$('#fp-img-file');
    if(ai&&fi) ai.addEventListener('click',function(){
      if(!flipPaneItem()) return;
      fi.value='';fi.click();});
    /* several pictures at once, in the order the browser hands them over —
       adding twelve frames one file dialog at a time is how a feature
       goes unused */
    if(fi) fi.addEventListener('change',function(){
      var a=flipPaneItem(),files=this.files;
      if(!a||!files||!files.length) return;
      var list=Array.prototype.slice.call(files);
      var got=[],done=0;
      list.forEach(function(f,i){
        var rd=new FileReader();
        rd.onload=function(){
          var probe=new Image();
          probe.onload=function(){
            got[i]={src:shrinkImage(probe,rd.result)};fin();};
          probe.onerror=function(){got[i]={src:rd.result};fin();};
          probe.src=rd.result;
        };
        rd.onerror=function(){got[i]=null;fin();};
        rd.readAsDataURL(f);
      });
      function fin(){
        if(++done<list.length) return;
        a.frames=flipFrames(a).slice();
        got.forEach(function(g){if(g) a.frames.push(g);});
        a.at=a.frames.length-1;
        /* ONE history entry for the whole batch */
        markDirty();renderSlide();renderFlipPane();
      }
    });
  })();
  var etImage=$('#et-image'),imgFile=$('#img-file');
  if(etImage&&imgFile) etImage.addEventListener('click',function(){
    /* showOpenFilePicker hands back a HANDLE, which is what lets the
       picture be re-read from disk later; the <input> can only ever hand
       back the bytes. So it is tried first and the input is the fallback
       for browsers without it (2026-08-22). */
    if(!window.showOpenFilePicker){imgFile.value='';imgFile.click();return;}
    window.showOpenFilePicker({multiple:false,types:[{
      description:'Images',
      accept:{'image/*':['.png','.jpg','.jpeg','.gif','.webp','.svg',
        '.bmp','.avif']}}]})
      .then(function(picks){
        var h=picks&&picks[0]; if(!h) return;
        var key=newFileKey();
        return idbPut(key,h).catch(function(){return null;})
          .then(function(){return h.getFile();})
          .then(function(f){
            return readAsDataURL(f).then(function(src){
              var probe=new Image();
              probe.onload=function(){
                placeImage(shrinkImage(probe,src),
                  (probe.naturalHeight||3)/(probe.naturalWidth||4),
                  {key:key,name:h.name||f.name||''});};
              probe.onerror=function(){
                placeImage(src,0,{key:key,name:h.name||''});};
              probe.src=src;
            });
          });
      }).catch(function(){});
  });
  if(imgFile) imgFile.addEventListener('change',function(){
    var f=this.files&&this.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){
      var src=rd.result;
      var probe=new Image();
      probe.onload=function(){
        placeImage(shrinkImage(probe,src),
          (probe.naturalHeight||3)/(probe.naturalWidth||4));};
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
    tm.innerHTML=bic('crop')+' Trim by dragging the edges';
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
      var idxs=selIdxs();
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
            b.title=m[1]<0?'Move this build earlier':'Move this build later';
            b.setAttribute('aria-label',b.title);
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
        var sp2=$('#stdpane'); if(sp2) sp2.hidden=true;
        var fp2=$('#flippane'); if(fp2) fp2.hidden=true;
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
    /* ---- the two builds anyone actually wants ------------------------
       Setting "one at a time" by hand means selecting every item on the
       slide and stepping its build order one at a time, which is exactly
       the fiddling this editor exists to remove (2026-08-20).
       Reading order, not array order: the array is the order you happened
       to draw things in, which is nobody's idea of a sequence. */
    function orderedIdx(s2){
      return (s2.annots||[])
        .map(function(a,i){return {a:a,i:i};})
        .filter(function(p2){return p2.a&&!p2.a.hide;})
        .sort(function(p2,q2){
          var ay=(p2.a.k==='arrow')?Math.min(p2.a.y1,p2.a.y2):(p2.a.y||0);
          var by=(q2.a.k==='arrow')?Math.min(q2.a.y1,q2.a.y2):(q2.a.y||0);
          var ax=(p2.a.k==='arrow')?Math.min(p2.a.x1,p2.a.x2):(p2.a.x||0);
          var bx=(q2.a.k==='arrow')?Math.min(q2.a.x1,q2.a.x2):(q2.a.x||0);
          return Math.abs(ay-by)>4?(ay-by):(ax-bx);
        })
        .map(function(p2){return p2.i;});
    }
    var stag=$('#anim-stagger');
    if(stag) stag.addEventListener('click',function(){
      var s2=pres.slides[cur]; if(!s2) return;
      var order=orderedIdx(s2);
      if(!order.length){toast('Nothing on this slide yet');return;}
      order.forEach(function(i,n){
        var a=s2.annots[i];
        a.anim={type:(a.anim&&a.anim.type)||'fade',order:n};
      });
      revealCount=0;commit(s2);
      toast(order.length+' items, one click each \u2014 in reading order');
    });
    var tog=$('#anim-together');
    if(tog) tog.addEventListener('click',function(){
      var s2=pres.slides[cur]; if(!s2) return;
      var order=orderedIdx(s2);
      if(!order.length){toast('Nothing on this slide yet');return;}
      order.forEach(function(i){
        var a=s2.annots[i];
        a.anim={type:(a.anim&&a.anim.type)||'fade',order:0};
      });
      revealCount=0;commit(s2);
      toast('Everything appears on one click');
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
  /* ---- PRESENTER VIEW --------------------------------------------------
     A second window holding the things the audience must not see: your
     notes, the slide that is coming, and a clock (2026-08-20, user:
     "presentation mode where you can have like the different screens one
     with the slides and the other with like notes and the next slide and
     stuff when you have multiple screens. Also would be cool if there was
     a time, and you can set time goals per slide").

     A POPUP you drag to the other display, not an automatic placement.
     The Window Management API that can put a window on a named screen is
     Chromium-only and needs a permission prompt; a popup works in every
     browser and on every setup, including the one where the second screen
     is a projector the OS is mirroring.

     The slides in it are REAL renders, not pictures: buildSlideNode uses
     the same renderAnnots every other output uses, and the nodes are
     imported into the popup. So a presenter view can never drift from
     what is on the screen behind it — there is only one renderer.

     Sync is a BroadcastChannel where there is one and a storage event
     where there is not; both are just "here is the state" one way and
     "do this" the other. */
  var presWin=null,presCh=null,presStart=0,presPaused=0,presPauseAt=0;
  function presChannel(){
    if(presCh) return presCh;
    try{
      presCh=new BroadcastChannel('junoview-presenter:'+SCOPE);
      presCh.onmessage=function(e){presenterCommand(e.data);};
    }catch(err){presCh=null;}
    return presCh;
  }
  /* the other window asked for something */
  function presenterCommand(msg){
    if(!msg||msg.jv!=='cmd') return;
    if(msg.do==='next') advance();
    else if(msg.do==='prev') backStep();
    else if(msg.do==='goto'&&typeof msg.n==='number') go(msg.n);
    else if(msg.do==='timer'){
      if(msg.act==='reset'){presStart=Date.now();presPaused=0;presPauseAt=0;}
      else if(msg.act==='pause'&&!presPauseAt) presPauseAt=Date.now();
      else if(msg.act==='resume'&&presPauseAt){
        presPaused+=Date.now()-presPauseAt;presPauseAt=0;}
    }
    else if(msg.do==='closed'){presWin=null;return;}
    presenterPush();
  }
  /* one slide, rendered the way every other output renders it */
  function buildSlideNode(i){
    var sl=(pres.slides||[])[i];
    if(!sl) return null;
    var savedMode=mode,savedReveal=revealCount,savedCur=cur;
    mode='view';revealCount=99999;cur=i;
    var host=document.createElement('div');
    host.className='jvp-slidehost';
    host.style.cssText='position:fixed;left:-99999px;top:0;'
      +'width:960px;height:540px;';
    document.body.appendChild(host);
    var el=document.createElement('div');
    el.className=(sl.layout==='title')?'slide slide-titlefree'
      :'slide slide-blank';
    el.style.cssText='width:960px;height:540px;position:relative;';
    if(sl.layout==='title')
      el.innerHTML='<p class="ttl-eyebrow">'+esc(pres.name||'')+'</p>';
    var bg=sl.bg||pres.pageBg||'#0b141d';
    el.style.setProperty('background',bg,'important');
    host.appendChild(el);
    try{attachAnnots(el,sl);paintFurniture(el,i);}catch(err){}
    mode=savedMode;revealCount=savedReveal;cur=savedCur;
    host.removeChild(el);
    host.remove();
    return el;
  }
  function presenterPush(){
    if(!presWin||presWin.closed){presWin=null;return;}
    var doc=presWin.document;
    if(!doc||!doc.getElementById('jvp-now')) return;
    var n=(pres.slides||[]).length;
    var sl=pres.slides[cur]||{};
    /* the two slide previews */
    [['jvp-now',cur],['jvp-next',cur+1]].forEach(function(pr){
      var box=doc.getElementById(pr[0]);
      if(!box) return;
      box.innerHTML='';
      var node=(pr[1]<n)?buildSlideNode(pr[1]):null;
      if(node){
        var im=doc.importNode(node,true);
        box.appendChild(im);
        /* the node is built at a fixed 960x540 so its percentage geometry
           has something real to measure against; it is scaled into
           whatever box it lands in rather than re-rendered per size */
        var bw=box.clientWidth||480,bh=box.clientHeight||270;
        var k=Math.min(bw/960,bh/540);
        im.style.transform='scale('+(k||0.5).toFixed(4)+')';
        im.style.flex='none';
      }
      else box.innerHTML='<div class="jvp-end">end of the deck</div>';
    });
    var nt=doc.getElementById('jvp-notes');
    if(nt) nt.textContent=(sl.notes||'').trim()
      ||'No notes for this slide.';
    var ct=doc.getElementById('jvp-count');
    if(ct) ct.textContent=(cur+1)+' / '+n;
    var gl=doc.getElementById('jvp-goal');
    if(gl){
      var g=slideGoal(sl);
      gl.textContent=g?('target '+fmtMins(g)):'';
    }
    var tt=doc.getElementById('jvp-talk');
    if(tt){
      var want=pres.talkMins||0,tot=goalTotal();
      tt.textContent=want?('talk '+want+' min')
        :(tot?('planned '+fmtMins(tot)):'');
    }
    presWin.__jvState={start:presStart,paused:presPaused,
      pauseAt:presPauseAt,goal:slideGoal(sl),
      talk:pres.talkMins||0,slide:cur,count:n};
  }
  function presenterHtml(){
    /* every stylesheet the deck uses, so the imported slide nodes look
       exactly as they do on screen */
    var css='';
    $$('style').forEach(function(st){css+=st.textContent+'\n';});
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      +'<title>Presenter view</title><style>'+css
      +'\nhtml,body{margin:0;height:100%;background:#070d13;color:#dce6ee;'
      +'font-family:var(--sans,system-ui);overflow:hidden;}'
      +'.jvp{display:grid;grid-template-columns:1.35fr 1fr;'
      +'grid-template-rows:auto 1fr auto;gap:12px;height:100%;'
      +'box-sizing:border-box;padding:12px;}'
      +'.jvp-bar{grid-column:1/-1;display:flex;align-items:center;gap:14px;}'
      +'.jvp-clock{font-family:var(--mono,monospace);font-size:44px;'
      +'font-weight:600;line-height:1;letter-spacing:.02em;}'
      +'.jvp-clock.over{color:#ff8a7a;}'
      +'.jvp-sub{font-family:var(--mono,monospace);font-size:12px;'
      +'color:#8ea4b6;display:flex;flex-direction:column;gap:2px;}'
      +'.jvp-sp{flex:1;}'
      +'.jvp-b{font-family:var(--mono,monospace);font-size:12px;'
      +'padding:7px 13px;border-radius:7px;cursor:pointer;'
      +'background:#ffffff0f;border:1px solid #ffffff2b;color:#dce6ee;}'
      +'.jvp-b:hover{border-color:#39a9c0;color:#fff;}'
      +'.jvp-b.primary{background:#39a9c0;border-color:#39a9c0;color:#04222b;'
      +'font-weight:600;}'
      +'.jvp-stage{position:relative;background:#000;border-radius:10px;'
      +'overflow:hidden;display:flex;align-items:center;'
      +'justify-content:center;min-height:0;}'
      +'.jvp-stage .slide{transform-origin:center center;}'
      +'.jvp-side{display:flex;flex-direction:column;gap:10px;min-height:0;}'
      +'.jvp-nextwrap{flex:0 0 34%;display:flex;flex-direction:column;'
      +'gap:4px;min-height:0;}'
      +'.jvp-lab{font-family:var(--mono,monospace);font-size:10px;'
      +'letter-spacing:.14em;text-transform:uppercase;color:#7d93a6;}'
      +'.jvp-notes{flex:1;min-height:0;overflow-y:auto;white-space:pre-wrap;'
      +'font-size:19px;line-height:1.5;background:#0e1926;border-radius:10px;'
      +'padding:14px 16px;border:1px solid #ffffff1a;}'
      +'.jvp-end{color:#6e8394;font-family:var(--mono,monospace);'
      +'font-size:13px;}'
      +'.jvp-foot{grid-column:1/-1;display:flex;gap:8px;align-items:center;}'
      +'</style></head><body><div class="jvp">'
      +'<div class="jvp-bar">'
      +'<span class="jvp-clock" id="jvp-clock">0:00</span>'
      +'<span class="jvp-sub"><span id="jvp-count"></span>'
      +'<span id="jvp-goal"></span><span id="jvp-talk"></span>'
      +'<span id="jvp-slideclock"></span></span>'
      +'<span class="jvp-sp"></span>'
      +'<button class="jvp-b" id="jvp-pause">Pause</button>'
      +'<button class="jvp-b" id="jvp-reset">Reset clock</button>'
      +'</div>'
      +'<div class="jvp-stage" id="jvp-now"></div>'
      +'<div class="jvp-side">'
      +'<div class="jvp-nextwrap"><span class="jvp-lab">next</span>'
      +'<div class="jvp-stage" id="jvp-next"></div></div>'
      +'<span class="jvp-lab">notes</span>'
      +'<div class="jvp-notes" id="jvp-notes"></div></div>'
      +'<div class="jvp-foot">'
      +'<button class="jvp-b" id="jvp-prev">&#8592; Back</button>'
      +'<button class="jvp-b primary" id="jvp-next-b">Next &#8594;</button>'
      +'<span class="jvp-sp"></span>'
      +'<span class="jvp-lab">drag this window to your other screen, then '
      +'press Present on the first one</span>'
      +'</div></div></body></html>';
  }
  function openPresenter(){
    if(presWin&&!presWin.closed){presWin.focus();presenterPush();return;}
    var w=null;
    try{
      w=window.open('','junoview-presenter',
        'width=1100,height=720,menubar=no,toolbar=no');
    }catch(err){w=null;}
    if(!w){
      toast('Your browser blocked the presenter window — allow pop-ups '
        +'for this page and try again');
      return;
    }
    presWin=w;
    w.document.open();
    w.document.write(presenterHtml());
    w.document.close();
    if(!presStart) presStart=Date.now();
    var d=w.document;
    function send(m){
      /* same-window handle first: it always works, channel or not */
      presenterCommand(m);
    }
    d.getElementById('jvp-prev').onclick=function(){
      send({jv:'cmd',do:'prev'});};
    d.getElementById('jvp-next-b').onclick=function(){
      send({jv:'cmd',do:'next'});};
    d.getElementById('jvp-reset').onclick=function(){
      send({jv:'cmd',do:'timer',act:'reset'});};
    var pb=d.getElementById('jvp-pause');
    pb.onclick=function(){
      var paused=!!(presWin.__jvState&&presWin.__jvState.pauseAt);
      send({jv:'cmd',do:'timer',act:paused?'resume':'pause'});
      pb.textContent=paused?'Pause':'Resume';
    };
    /* the arrow keys work in the presenter window too - you will have the
       clicker pointed at whichever window has focus */
    d.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){
        e.preventDefault();send({jv:'cmd',do:'next'});}
      else if(e.key==='ArrowLeft'||e.key==='PageUp'){
        e.preventDefault();send({jv:'cmd',do:'prev'});}
    });
    w.addEventListener('beforeunload',function(){presWin=null;});
    /* the clock ticks in the presenter window, off state the main window
       owns - so pausing on either side agrees */
    w.setInterval(function(){
      var st=w.__jvState; if(!st) return;
      var now=st.pauseAt||Date.now();
      var ms=now-st.start-st.paused;
      var sec=Math.max(0,Math.round(ms/1000));
      var cl=d.getElementById('jvp-clock');
      cl.textContent=Math.floor(sec/60)+':'+('0'+(sec%60)).slice(-2);
      var over=st.talk&&sec>st.talk*60;
      cl.classList.toggle('over',!!over);
      var sc=d.getElementById('jvp-slideclock');
      if(sc){
        if(!st.talk) sc.textContent='';
        else {
          var left=Math.round(st.talk*60-sec);
          sc.textContent=left>=0
            ?(Math.floor(left/60)+':'+('0'+(left%60)).slice(-2)+' left')
            :(Math.floor(-left/60)+':'+('0'+((-left)%60)).slice(-2)
              +' OVER');
        }
      }
    },250);
    presenterPush();
    toast('Presenter view opened — drag it to your other screen');
  }
  /* the main window tells the presenter whenever anything moves */
  function presenterSync(){
    if(presWin&&!presWin.closed) presenterPush();
  }
  function buildsForSlide(i){
    /* stepping BACKWARDS into a slide shows it as you left it: fully
       built, and every flip book on its last frame */
    var s=pres.slides[i];return s?slideStops(s):0;
  }
  function go(n){
    var prev=cur;
    cur=Math.max(0,Math.min(pres.slides.length-1,n));
    if(cur===prev) return;   /* clamped no-op: keep build + selection state */
    /* stepping back into a slide shows it fully built; forward starts fresh */
    revealCount=(mode==='view'&&cur<prev)?buildsForSlide(cur):0;
    selAnnot=null;selSet=[];   /* never carry a selection across slides */
    refresh();
    presenterSync();
    if(window.SemApp&&window.SemApp.updateHash) window.SemApp.updateHash();
  }
  /* advance: reveal the next build, else move to the next slide (no-op at the
     very end, so the final slide never collapses back to its pre-build state) */
  function advance(){
    var s=pres.slides[cur];
    /* a flip book's frames are stops in this same sequence, so the space
       bar walks the figure through its steps exactly as it walks a build
       — one gesture for the whole talk (2026-08-22) */
    if(mode==='view'&&s&&revealCount<slideStops(s)){
      revealCount++;renderSlide();presenterSync();
    } else if(cur<pres.slides.length-1) go(cur+1);
  }
  function backStep(){
    if(mode==='view'&&revealCount>0){revealCount--;renderSlide();
      presenterSync();}
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
         button that made it read as the same kind of thing — straight
         from SemIcons, where the "+ New" template tokens also resolve */
      t.innerHTML='<span class="pr-ico">'
        +bic(isView?'newview':isPoster?'newposter':'newdeck')
        +'</span>';
      var lbl=document.createElement('span');lbl.className='pr-t';
      lbl.textContent=nm||'(unnamed)';
      t.appendChild(lbl);
      /* delete where the thing IS, not three menu levels away. Shown on
         hover / while current; confirm() because there is no undo for a
         deleted presentation. */
      /* a real <button>, not a click-wired span: focusable, and named
         for screen readers — the icon is its only visible content
         (2026-08-24). .pr-del's CSS resets the button chrome. */
      var del=document.createElement('button');
      del.type='button';
      del.className='pr-del';del.title='Delete "'+nm+'"';
      del.setAttribute('aria-label','Delete "'+nm+'"');
      del.innerHTML=bic('exit')||'&#10005;';
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
        +'<span class="pr-fico">'+bic('open')+'</span>';
      var ft=document.createElement('span');ft.className='pr-t';
      ft.textContent=f;h.appendChild(ft);
      var fc=document.createElement('span');fc.className='pr-fcount';
      fc.textContent=folders[f].length;h.appendChild(fc);
      var ctr=document.createElement('span');ctr.className='pr-fctrl';
      [[bic('pen'),'Rename folder',function(){startFolderRename(h,f);}],
       [bic('exit'),'Delete folder (contents move out)',
        function(){deleteFolder(f);}]].forEach(function(b){
        var btn=document.createElement('button');
        btn.innerHTML=b[0];btn.title=b[1];
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
  /* rail row icons come from SemIcons (newdeck/newposter/newview) in
     presItem — the RAIL_ICO copy of that path data was deleted
     2026-08-23 so branding.py stays the only place artwork lives */
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
      eb.innerHTML=bic('pen')+' Open the editor';
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
        x.innerHTML=bic('exit')||'&#10005;';x.title='Clear this frame';
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
    var card=ref?(cardEl(ref)||embBody(ref)):null;
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
  /* MINI_H is the FLOOR now, not the height: the column is draggable, so
     a thumbnail grows with the room it is given and its type and strokes
     have to grow with it or a 460px strip draws 3px lettering
     (2026-08-22). Measured off the LIST rather than off a thumbnail —
     renderFilm sizes type before the node is in the document, and an
     unattached node has no height to read. Computed once per render, not
     once per item. */
  var MINI_AR=116/66,miniHNow=MINI_H;
  function miniH(){
    var l=$('#film-list');
    var w=l?l.clientWidth:0;
    if(!w) return MINI_H;
    /* the padding and the row's own gutters the CSS spends before the
       thumbnail gets the rest */
    return Math.max(MINI_H,Math.round((w-46)/MINI_AR));
  }
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
    t.style.fontSize=Math.max(2,miniHNow*(a.size||2.6)/100).toFixed(2)+'px';
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
    return Math.max(0.6,swOf(a)*miniHNow/SW_REF_H).toFixed(2);
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
      if(a.k==='flip'){
        /* the thumbnail shows the frame the slide RESTS on, which is the
           one the strip is an index to. Without a branch here a flip book
           is invisible in the film strip and every slide holding one
           looks empty (the lesson miniDiagram was rewritten for). */
        var bf=miniBox(d,a,'is-flip');
        var ff=flipFrames(a)[a.at||0];
        if(ff&&ff.src){
          var fim2=document.createElement('img');
          fim2.src=ff.src;fim2.alt='';fim2.loading='lazy';
          fim2.draggable=false;
          bf.appendChild(fim2);
        } else if(ff&&ff.ref){
          var fnode2=framePart(ff.ref,ff.part);
          var fimg2=fnode2?fnode2.querySelector('img'):null;
          if(fimg2&&fimg2.src){
            var fc=document.createElement('img');
            fc.src=fimg2.src;fc.alt='';fc.loading='lazy';fc.draggable=false;
            bf.appendChild(fc);
          }
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
      if(a.k==='table'){
        /* a real miniature table: at 116px the words are a smudge, but
           the SHAPE of a table is unmistakable and that is what a
           thumbnail is for */
        var bt=miniBox(d,a,'is-tbl');
        var trows=tableRows(a),tcols=tableCols(a);
        var mt=document.createElement('table');
        mt.className='mini-tbl'+(a.grid===0?' nogrid':'');
        mt.style.fontSize=Math.max(1.5,
          miniHNow*(a.size||2.2)/100).toFixed(2)+'px';
        trows.forEach(function(row,ri){
          var tr=document.createElement('tr');
          row.forEach(function(v,ci){
            var td=document.createElement((a.thead&&ri===0)?'th':'td');
            td.style.width=tcols[ci]+'%';
            td.textContent=v==null?'':String(v);
            tr.appendChild(td);});
          mt.appendChild(tr);});
        bt.appendChild(mt);
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
    var body=$('#verpane-body'),list=$('#film-list'),add=$('#film-adds'),
        head=$('#film-head');
    if(!body||!list||filmHome) return;
    filmHome={parent:list.parentNode,next:list.nextSibling};
    /* the chooser rides along as a THIRD node, above the list it chooses
       for. Building a second copy of it in the pane is how two controls
       that claim to do the same thing start disagreeing (2026-08-22). */
    if(head) body.appendChild(head);
    body.appendChild(list);
    if(add) body.appendChild(add);
  }
  function filmToPanel(){
    if(!filmHome) return;
    var list=$('#film-list'),add=$('#film-adds'),head=$('#film-head');
    if(list&&filmHome.parent){
      var at=(filmHome.next&&filmHome.next.parentNode===filmHome.parent)
        ?filmHome.next:null;
      /* head, list, adds — in that order and all before whatever followed
         the list when it left, so the column comes back exactly as it was
         rather than with its chooser stranded at the bottom */
      if(head) filmHome.parent.insertBefore(head,at);
      filmHome.parent.insertBefore(list,at);
      if(add) filmHome.parent.insertBefore(add,at);
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
      var sp3=$('#stdpane'); if(sp3) sp3.hidden=true;
      var fp3=$('#flippane'); if(fp3) fp3.hidden=true;
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
      var cp=src?deep(src):emptySlide();
      cp.label=nextVersionName();
      pres.slides.splice(at,0,cp);
    }
    /* a new slide joins the section it was inserted into. Without this an
       insert splits the run in two and grows a divider out of nowhere. */
    var prev=pres.slides[at-1];
    if(prev&&prev.sec) pres.slides[at].sec=prev.sec;
    cur=at;activePane=-1;selAnnot=null;selSet=[];
    normSections();markDirty();refresh();
    if(!$('#verpane').hidden) renderFilm();
  }
  /* ---- THE OUTLINE ----------------------------------------------------
     In headings mode the strip stops being a contact sheet and becomes a
     table of contents, so it must name a slide by its HEADING and not by
     whatever text happens to sit highest on it. A box wearing a heading
     style says outright that it is the slide's title; slideTitle's
     guesswork is the fallback for slides that never used one. */
  function slideHeading(s){
    var best=null,bestAt=99;
    (s.annots||[]).forEach(function(a){
      if(!a||a.k!=='text'||a.hide||!String(a.text||'').trim()) return;
      if(!a.style||!isHeadingStyle(a.style)) return;
      var at=headingStyles().indexOf(a.style);
      if(at>=0&&at<bestAt){bestAt=at;best=a;}
    });
    return best?String(best.text).trim().split('\n')[0]:'';
  }
  /* how far the row indents in the outline. A title slide and a section
     divider are always level 0 — they are the top of something, whatever
     style their text happens to wear. */
  function headLevel(s){
    if(!s||s.layout==='title'||s.layout==='section') return 0;
    var lv=0;
    (s.annots||[]).forEach(function(a){
      if(!a||a.k!=='text'||a.hide||!a.style) return;
      var at=headingStyles().indexOf(a.style);
      if(at>=0&&(!lv||at<lv)) lv=at;
    });
    return Math.min(3,lv);
  }
  /* ONE source for the words on a row, so the strip and refreshThumb can
     never disagree about what a slide is called */
  function filmText(s){
    if(filmMode()==='thumb') return slideTitle(s);
    return slideHeading(s)||slideTitle(s);
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
    if(tx) return tx.text;
    /* a slide that is one big table is named by its first heading, which
       beats calling it "empty slide" (2026-08-20) */
    var tb=(s.annots||[]).filter(function(a){return a.k==='table';})[0];
    if(tb){
      var r0=(tb.rows||[])[0]||[];
      for(var j=0;j<r0.length;j++)
        if(String(r0[j]||'').trim()) return String(r0[j]).trim();
      return 'table';
    }
    return 'empty slide';
  }
  /* ---- SLIDE SECTIONS -------------------------------------------------
     "There should be the ability to create slide sections in the
     thumbnails part" (2026-08-22).

     THE SHAPE, and why it is this one. A section is a TAG on the slide
     (s.sec) plus a name in a keyed map (pres.sections). The ORDER is
     never stored: it is read back off pres.slides. Every slide mutation
     in this file is a raw splice — moveSlide, delSlide, dupSlide,
     newVersion, the strip's drop handler — and histRestore replaces the
     array outright; a tag rides through all six for free, while a stored
     start-INDEX would have to be shifted correctly in every one of them
     and would be silently wrong the first time one was missed.

     The one price of tags is that they permit a section to go
     discontiguous. normSections() below is what pays it, and every verb
     here ends by calling it. */
  var secSeq=0;
  function secId(){
    /* an id has to survive a save, a reload and an undo, so it cannot be
       a plain counter reset on load — two sections would collide the
       moment you reopened a deck and made another one */
    secSeq++;
    return 's'+Date.now().toString(36)+secSeq.toString(36);
  }
  function secMap(){
    if(!pres.sections||typeof pres.sections!=='object') pres.sections={};
    return pres.sections;
  }
  function secName(id){
    var d=(pres.sections||{})[id];
    return (d&&d.name)||'Untitled section';
  }
  /* THE ONE SHARED API. The strip, the Apply dialog's scope picker and
     the outline view must all agree on what a section IS, so all three
     read it from here rather than each grouping the slides their own
     way. Untagged spans come back too, with id '' — a caller that wants
     only real sections filters on run.id. */
  function sectionRuns(){
    var out=[],sl=pres.slides||[],i,id,last=null;
    for(i=0;i<sl.length;i++){
      id=(sl[i]&&sl[i].sec)||'';
      if(!last||last.id!==id){
        last={id:id,name:id?secName(id):'',at:i,n:0,
          fold:!!(id&&(pres.sections||{})[id]&&pres.sections[id].fold)};
        out.push(last);
      }
      last.n++;
    }
    return out;
  }
  /* THE INVARIANT. A section is a CONTIGUOUS run — that is what a divider
     in a strip means, and nothing in the UI can express anything else. A
     tag can still end up out of place (drag a slide past a boundary, or
     swap one across it with the arrows), so every mutation ends here: a
     tag that reappears after its run has closed is re-tagged to the run
     it now sits in, and any section no slide uses is thrown away.
     Dropping the map entirely when it empties is what keeps a deck that
     never used sections serialising exactly as it did before. */
  function normSections(){
    var sl=pres.slides||[],seen={},closed={},prev='',i,id;
    for(i=0;i<sl.length;i++){
      if(!sl[i]) continue;
      id=sl[i].sec||'';
      if(id&&id!==prev&&(closed[id]||seen[id])) id=prev;
      if(id) seen[id]=1;
      if(prev&&prev!==id) closed[prev]=1;
      if(id) sl[i].sec=id; else delete sl[i].sec;
      prev=id;
    }
    var m=pres.sections;
    if(m){
      Object.keys(m).forEach(function(k){if(!seen[k]) delete m[k];});
      if(!Object.keys(m).length) delete pres.sections;
    }
  }
  /* the five verbs. Everything that touches sections goes through one of
     these, so normSections() is guaranteed to have run before markDirty
     writes the deck out. */
  function newSection(at,name){
    var id=secId(),i;
    secMap()[id]={name:name||'New section'};
    /* a new section OWNS everything from `at` down to the next divider —
       that is what "start a section here" means in PowerPoint, and it is
       the only reading that leaves no orphan slides behind */
    var was=(pres.slides[at]&&pres.slides[at].sec)||'';
    for(i=at;i<pres.slides.length;i++){
      if(((pres.slides[i].sec)||'')!==was) break;
      pres.slides[i].sec=id;
    }
    normSections();markDirty();renderFilm();
  }
  function renameSection(id){
    /* prompt(), not an inline edit on the row. The row's own click
       re-renders the strip, so by the time a dblclick handler arrived the
       node it was editing had already been replaced — the same reason the
       poster version rename is a button and a prompt (2026-08-10) */
    var v=prompt('Name this section:',secName(id));
    if(v==null) return;
    v=v.trim(); if(!v) return;
    secMap()[id]={name:v,fold:(pres.sections[id]||{}).fold};
    if(!pres.sections[id].fold) delete pres.sections[id].fold;
    markDirty();renderFilm();
  }
  function foldSection(id,on){
    var d=secMap()[id]; if(!d) return;
    if(on) d.fold=1; else delete d.fold;
    /* markDirty(true): folding is a way of LOOKING at the deck, not an
       edit to it, so it persists in the file but never lands on the undo
       stack — Ctrl+Z must never open or close a section */
    markDirty(true);renderFilm();
  }
  function removeSection(id,withSlides){
    var runs=sectionRuns(),r=null,i;
    for(i=0;i<runs.length;i++) if(runs[i].id===id) r=runs[i];
    if(!r) return;
    if(withSlides) pres.slides.splice(r.at,r.n);
    /* the slides MERGE UPWARDS into whatever section is above — removing
       a divider must never delete work, which is why the destructive form
       is a separate and differently-worded verb */
    else for(i=r.at;i<r.at+r.n;i++){
      if(r.at>0&&pres.slides[r.at-1].sec)
        pres.slides[i].sec=pres.slides[r.at-1].sec;
      else delete pres.slides[i].sec;
    }
    if(pres.sections) delete pres.sections[id];
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    normSections();markDirty();refresh();
  }
  function moveSlideToSection(i,id){
    var runs=sectionRuns(),r=null,j,to;
    for(j=0;j<runs.length;j++) if(runs[j].id===id) r=runs[j];
    /* a tag on its own would break contiguity, so the slide MOVES to the
       end of that section's run — re-tagging without moving is the bug
       normSections would then immediately have to undo */
    to=r?(r.at+r.n):pres.slides.length;
    var moved=pres.slides.splice(i,1)[0]; if(!moved) return;
    if(to>i) to--;
    if(id) moved.sec=id; else delete moved.sec;
    pres.slides.splice(to,0,moved);
    cur=to;normSections();markDirty();refresh();
  }
  /* a WHOLE-SECTION drop is a different move: lift the run out and put it
     back at a divider boundary. `cur` is refound by IDENTITY afterwards —
     the single-slide path's four-branch arithmetic does not generalise to
     moving n slides at once, and getting it wrong strands you on somebody
     else's slide. */
  function moveSection(id,beforeAt){
    var runs=sectionRuns(),r=null,i;
    for(i=0;i<runs.length;i++) if(runs[i].id===id) r=runs[i];
    if(!r||(beforeAt>=r.at&&beforeAt<=r.at+r.n)) return;
    var keep=pres.slides[cur];
    var block=pres.slides.splice(r.at,r.n);
    var to=beforeAt>r.at?beforeAt-r.n:beforeAt;
    for(i=0;i<block.length;i++) pres.slides.splice(to+i,0,block[i]);
    var k=pres.slides.indexOf(keep);
    cur=k<0?0:k;
    normSections();markDirty();refresh();
  }
  var draggingSlide=-1,draggingSec=null;
  /* ONE divider row. Deliberately NOT class `film-row` and deliberately
     without a data-idx: refreshThumb looks up
     '.film-row[data-idx="N"]' and takes the first match, so a divider
     wearing either would quietly collect a slide's thumbnail. */
  function secRow(r){
    var el=document.createElement('div');
    el.className='film-sec'+(r.fold?' folded':'');
    el.dataset.sec=r.id;el.dataset.at=r.at;
    el.draggable=true;
    el.title='Drag to move the whole section';
    var f=document.createElement('button');
    f.className='film-sec-fold';
    f.innerHTML=r.fold?'&#9656;':'&#9662;';
    f.title=r.fold?'Show these slides':'Hide these slides';
    f.addEventListener('click',function(e){
      e.stopPropagation();foldSection(r.id,!r.fold);});
    el.appendChild(f);
    var t=document.createElement('span');
    t.className='film-sec-t';t.textContent=r.name;el.appendChild(t);
    var n=document.createElement('span');
    n.className='film-sec-n';
    /* the count is the whole point of a collapsed section — a divider
       that hides four slides and does not say four is just a deck with
       slides missing */
    n.textContent=r.fold?(r.n+' hidden'):String(r.n);
    el.appendChild(n);
    var ctr=document.createElement('span');ctr.className='film-ctr';
    [[bic('pen'),function(){renameSection(r.id);},'Rename this section'],
     [bic('exit'),function(){removeSection(r.id,false);},
      'Remove this divider — the slides stay, and join the section '
      +'above']]
      .forEach(function(p){
        var b=document.createElement('button');b.className='film-mini';
        b.innerHTML=p[0];b.title=p[2];
        b.addEventListener('click',function(ev){
          ev.stopPropagation();p[1]();});
        ctr.appendChild(b);
      });
    el.appendChild(ctr);
    el.addEventListener('dragstart',function(e){
      draggingSec=r.id;el.classList.add('dragging');
      try{e.dataTransfer.setData('text/plain','sec-'+r.id);}catch(err){}
      try{e.dataTransfer.setDragImage(el,12,12);}catch(err){}
      e.dataTransfer.effectAllowed='move';
    });
    el.addEventListener('dragend',function(){
      draggingSec=null;el.classList.remove('dragging');clearFilmMarks();});
    el.addEventListener('contextmenu',function(ev){
      ev.preventDefault();openFilmMenu(r.at,ev,r);});
    return el;
  }
  function renderFilm(){
    var list=$('#film-list');list.innerHTML='';
    /* the strip rebuilds every row, so a context menu left open is
       holding an index into nodes that no longer exist */
    var om=$('#film-menu'); if(om) om.remove();
    /* Headers are INSERTED into the flat loop rather than the loop being
       rewritten sections-outer / slides-inner. `i` stays the ARRAY index,
       which is what keeps the numbers global (1..n straight through every
       section) and keeps row.dataset.idx equal to the array index —
       refreshThumb and the drop maths both read it back. */
    var runs=sectionRuns(),head={},fold={};
    runs.forEach(function(r){
      if(r.id) head[r.at]=r;
      if(r.fold) for(var k=r.at;k<r.at+r.n;k++) fold[k]=1;
    });
    /* the mode is stamped ONCE on the list and the CSS branches off it,
       the way applyTab() stamps data-off — not a style per row, and not
       on the body or the deck, because filmToPane MOVES this list into
       the Versions pane and an ancestor class would be left behind */
    var fv=filmMode();
    list.setAttribute('data-fv',fv);
    miniHNow=miniH();
    pres.slides.forEach(function(s,i){
      if(head[i]) list.appendChild(secRow(head[i]));
      /* the CURRENT slide is drawn even inside a folded section: it is
         where you are standing, and it is also the row refreshThumb goes
         looking for on every edit — hide it and the live thumbnail dies */
      if(fold[i]&&i!==cur) return;
      var row=document.createElement('div');
      row.className='film-row'+(i===cur?' current':'')
        +(fold[i]?' peek':'')+(s.sec?' in-sec':'');
      row.dataset.idx=i;
      row.draggable=true;
      row.title='Drag to reorder';
      row.addEventListener('contextmenu',function(ev){
        ev.preventDefault();openFilmMenu(i,ev,null);});
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
      row.dataset.lvl=headLevel(s);
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
      } else if(fv!=='head'){
        /* in headings mode no thumbnail is BUILT, rather than one being
           built and hidden: miniDiagram emits an <img> per figure, a real
           <table> per table and an <svg> per slide, and a sixty-slide
           deck should not pay for all of that to draw a list of names */
        lbl.appendChild(miniDiagram(s));
      }
      var tt=document.createElement('span');tt.className='film-t';
      tt.textContent=filmText(s);lbl.appendChild(tt);
      if(i!==cur) lbl.addEventListener('click',function(){
        cur=i;activePane=-1;selAnnot=null;selSet=[];refresh();});
      row.appendChild(lbl);
      var ctr=document.createElement('span');ctr.className='film-ctr';
      var poster=pageOf().poster;
      var acts=[['↑',function(){moveSlide(i,-1);},
                 poster?'Move this version up':'Move slide up'],
                ['↓',function(){moveSlide(i,1);},
                 poster?'Move this version down':'Move slide down'],
                [bic('copy'),function(){dupSlide(i);},
                 poster?'Duplicate this version':'Duplicate slide'],
                [bic('exit'),function(){delSlide(i);},
                 poster?'Delete this version':'Delete slide']];
      /* an autoname is a starting point, not a decision. This goes on a
         BUTTON rather than a double-click on the row: the row's own click
         re-renders the strip, so by the time a dblclick arrived the node
         it was editing had already been replaced (2026-08-10). */
      if(poster) acts.splice(2,0,[bic('pen'),function(){
        var s2=pres.slides[i]; if(!s2) return;
        var v=prompt('Name this version:',s2.label||slideTitle(s2));
        if(v==null) return;
        v=v.trim();
        if(v) s2.label=v; else delete s2.label;
        markDirty();renderFilm();
      },'Rename this version']);
      acts.forEach(function(p){
        var b=document.createElement('button');b.className='film-mini';
        b.innerHTML=p[0];   /* fixed strings / bic() markup from above */
        b.title=p[2];
        b.setAttribute('aria-label',p[2]);
        b.addEventListener('click',function(ev){
          ev.stopPropagation();p[1]();});
        ctr.appendChild(b);
      });
      row.appendChild(ctr);
      list.appendChild(row);
    });
  }
  function clearFilmMarks(){
    $$('#film-list .film-row.drop-above,#film-list .film-row.drop-below,'
      +'#film-list .film-sec.drop-above,#film-list .film-sec.drop-below')
      .forEach(function(r){
        r.classList.remove('drop-above');
        r.classList.remove('drop-below');
      });
  }
  /* ---- WHERE A DROP LANDS ----------------------------------------------
     Before sections a drop was one number: the row's dataset.idx, plus
     one if you were past its midpoint. With dividers interleaved a drop
     is TWO answers — where in the array, and which section the slide now
     belongs to — and on a divider they are decided by the SAME midpoint
     from opposite sides: above the divider is the last slide of the run
     before it, below it is the first slide of the run after. Same index,
     different owner. That is the whole change. */
  function filmDropTarget(row,clientY){
    var r=row.getBoundingClientRect(),below=clientY>r.top+r.height/2;
    if(row.classList.contains('film-sec')){
      var at=+row.dataset.at,id=row.dataset.sec;
      if(!below){
        var prev=pres.slides[at-1];
        return {to:at,sec:(prev&&prev.sec)||''};
      }
      if(row.classList.contains('folded')){
        /* a folded section shows no rows to aim between, so a drop onto
           it can only mean "put this one in there", at the end */
        var runs=sectionRuns(),k,n=0;
        for(k=0;k<runs.length;k++) if(runs[k].id===id) n=runs[k].n;
        return {to:at+n,sec:id};
      }
      return {to:at,sec:id};
    }
    var idx=+row.dataset.idx,s=pres.slides[idx];
    return {to:below?idx+1:idx,sec:(s&&s.sec)||''};
  }
  (function(){
    var list=$('#film-list'); if(!list) return;
    list.addEventListener('dragover',function(e){
      if(draggingSlide<0&&!draggingSec) return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row,.film-sec');
      if(!row) return;
      var r=row.getBoundingClientRect();
      row.classList.add(
        e.clientY>r.top+r.height/2?'drop-below':'drop-above');
    });
    list.addEventListener('dragleave',function(e){
      if(e.target===list) clearFilmMarks();
    });
    list.addEventListener('drop',function(e){
      if(draggingSlide<0&&!draggingSec) return;
      e.preventDefault();
      var from=draggingSlide,sec=draggingSec;
      draggingSlide=-1;draggingSec=null;
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row,.film-sec');
      if(!row) return;
      var tgt=filmDropTarget(row,e.clientY);
      /* a whole section moves as a block and refinds `cur` by identity */
      if(sec){moveSection(sec,tgt.to);return;}
      var to=tgt.to;
      if(to>from) to--;
      var moved=pres.slides.splice(from,1)[0];
      /* the slide joins whatever section it landed in — a slide dragged
         under a divider that kept its old tag would make the section
         discontiguous, and normSections would drag it straight back */
      if(tgt.sec) moved.sec=tgt.sec; else delete moved.sec;
      pres.slides.splice(to,0,moved);
      if(cur===from) cur=to;
      else if(from<cur&&to>=cur) cur--;
      else if(from>cur&&to<=cur) cur++;
      normSections();markDirty();refresh();
    });
  })();
  /* ---- the strip's right-click menu ------------------------------------
     The section verbs live HERE rather than on a ribbon button because
     this is where the thing being sectioned is visible, and because Home
     has no room to give (2026-08-22). Mounted on the body like
     openMatchMenu, and closed at the top of renderFilm — the strip
     rebuilds every row, so a menu left open holds a dead index. */
  function openFilmMenu(i,ev,run){
    var old=$('#film-menu'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu film-menu';m.id='film-menu';
    var poster=pageOf().poster;
    function row(label,fn,title,icon){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      /* the icon arrives as trusted bic() markup; the LABEL stays a
         text node — section names are user data */
      if(icon) b.innerHTML=bic(icon)+' ';
      b.appendChild(document.createTextNode(label));
      if(title) b.title=title;
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();fn();});
      m.appendChild(b);
    }
    if(run){
      menuHead(m,'this section');
      row('Rename…',function(){renameSection(run.id);},null,'pen');
      row(run.fold?'▾ Show these slides':'▸ Hide these slides',
        function(){foldSection(run.id,!run.fold);});
      row('Remove the divider',function(){removeSection(run.id,false);},
        'The slides stay — they join the section above','exit');
      row('Delete the section AND its '+run.n+' slide'
        +(run.n===1?'':'s'),function(){
          if(confirm('Delete '+run.n+' slide'+(run.n===1?'':'s')
            +' along with the section "'+run.name+'"?'))
            removeSection(run.id,true);
        },null,'exit');
      floatAt(m,ev);
      return;
    }
    menuHead(m,poster?'this page':'slide '+(i+1));
    row('§ Start a section here',function(){newSection(i,'New section');},
      'Everything from here down to the next divider goes in it');
    var runs=sectionRuns().filter(function(r){return r.id;});
    if(runs.length){
      menuHead(m,'move this one into');
      runs.forEach(function(r){
        if(pres.slides[i]&&pres.slides[i].sec===r.id) return;
        row('→ '+r.name,function(){moveSlideToSection(i,r.id);});
      });
      if(pres.slides[i]&&pres.slides[i].sec)
        row('→ (no section)',function(){moveSlideToSection(i,'');});
    }
    menuHead(m,poster?'this page':'this slide');
    row('Duplicate',function(){dupSlide(i);},null,'copy');
    row('Delete',function(){delSlide(i);},null,'exit');
    floatAt(m,ev);
  }
  /* floatMenu positions against an element's rect; a context menu has
     only a point, so it is handed a zero-size one at the cursor */
  function floatAt(m,ev){
    document.body.appendChild(m);
    floatMenu({getBoundingClientRect:function(){
      return {left:ev.clientX,right:ev.clientX,
        top:ev.clientY,bottom:ev.clientY,width:0,height:0};
    }},m);
    setTimeout(function(){
      document.addEventListener('click',function off(e){
        if(m.contains(e.target)) return;
        m.remove();document.removeEventListener('click',off);
      });
    },0);
  }
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
      /* shown everywhere, working only in the app - see the per-figure
         Lock button for why (2026-08-20) */
      if(true){
        var appMode=(APP.mode==='app');
        var acts2=document.createElement('div');
        acts2.className='dc-nbacts dc-nbacts-stack';
        var la=document.createElement('button');la.className='dbtn';
        la.disabled=!appMode;
        la.innerHTML=bic('lock')+' Lock all figures';
        la.title=appMode
          ?('Pin every frame to its notebook\u2019s current git commit '
            +'\u2014 refreshes stop changing them')
          :('Needs the Junoview app: locking reads git through the local '
            +'server, and this page was exported as a standalone file.');
        la.addEventListener('click',function(){lockAllFrames();});
        var ua=document.createElement('button');ua.className='dbtn';
        ua.disabled=!appMode;
        ua.innerHTML=bic('unlock')+' Unlock all';
        ua.title='Every frame follows notebook refreshes again';
        ua.addEventListener('click',function(){unlockAllFrames();});
        var lv=document.createElement('button');lv.className='dbtn';
        lv.disabled=!appMode;
        lv.innerHTML=bic('reload')+' Load locked versions';
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
    b=$('#hm-match');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();openMatchMenu(this);});
    wireMenuToggle('hm-laywrap','hm-lay','hm-lay-menu');
  })();
  function renderCreate(){
    renderPresRow();renderControls();renderPresNbs();renderFilm();
    syncFurnBtns();   /* the furniture toggles show their own state */
  }
  function moveSlide(i,d){
    var j=i+d; if(j<0||j>=pres.slides.length) return;
    var t=pres.slides[i];pres.slides[i]=pres.slides[j];pres.slides[j]=t;
    if(cur===i)cur=j; else if(cur===j)cur=i;
    /* BOTH swapped slides take their section from the neighbour on their
       far side — the one OUTSIDE the pair. Without this, stepping a slide
       across a divider left its old tag behind, normSections dragged it
       back on the next pass, and the arrow button looked like it had done
       nothing at all (2026-08-22). */
    var far=function(at,dir){
      var nb=pres.slides[at+dir];
      return nb?((nb.sec)||''):null;
    };
    var sj=far(j,d),si=far(i,-d);
    if(sj!==null){if(sj) pres.slides[j].sec=sj; else delete pres.slides[j].sec;}
    if(si!==null){if(si) pres.slides[i].sec=si; else delete pres.slides[i].sec;}
    normSections();markDirty();refresh();
  }
  function delSlide(i){
    pres.slides.splice(i,1);
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;
    normSections();markDirty();refresh();
  }
  /* duplicate in place — decks never had this at all (2026-08-19, user:
     "still no duplicate slide"); a poster's copy becomes a named version
     like "+ Create new version" makes */
  function dupSlide(i){
    var s=pres.slides[i]; if(!s) return;
    var cp=deep(s);
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
    /* the first moment the bar has a real width to be judged against */
    if(editing) requestAnimationFrame(fitQat);
    var tabs=$('#rbn-tabs',deckEl);
    if(tabs) tabs.hidden=(mode!=='edit');
    var xb=$('#deck-exit');
    if(xb){
      /* say where it GOES. "Back" beside an armed drawing tool reads as
         the way out of that tool, which is Cancel's job. */
      var presenting=(mode==='view');
      xb.innerHTML=presenting?bic('return')+' Stop presenting'
        :bic('return')+' Close the editor';
      xb.title=presenting
        ?'Stop presenting and go back to the builder (Esc). Nothing is '
          +'closed or lost.'
        :'Leave the editor and go back to the builder. Nothing is closed '
          +'or lost.';
    }
  }
  function setUIMode(m){
    /* entering Present must not leave a fresher deck in memory than in
       the draft — the debounced write lands before the talk starts */
    if(m==='view') flushDraftWrite();
    mode=m;
    var creating=(m==='create'), editing=(m==='edit');
    deckEl.classList.toggle('creating',creating);
    deckEl.classList.toggle('editing',editing);
    /* nothing moves any more: the document actions LIVE in the left
       column in every mode (2026-08-19) */
    /* the builder panel stays visible while editing a slide */
    $('#deck-create').hidden=!(creating||editing);
    var et=$('#edit-tools'); if(et) et.hidden=!editing;
    if(editing){
      applyTab();
      /* the folded state is remembered per project, like the tab */
      if(!deckEl._foldInit){
        deckEl._foldInit=1;
        setRibbonFold(lsGet(FOLDKEY2+SCOPE)==='1');
      }
    }
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
    var fb=$('#et-fmt'); if(fb) fb.hidden=true;
    var etb=$('#edit-tools'); if(etb) etb.classList.remove('fmt-open');
    if(editing) setTool('select');
    /* real full screen while presenting (browser chrome gone) */
    try{
      if(m==='view'&&!deckEl.hidden&&fullTarget().requestFullscreen
         &&!document.fullscreenElement)
        fullTarget().requestFullscreen().catch(function(){});
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
    /* the welcome screen can now be showing WITH the deck opening over
       it (its presentations column, or Home with nothing else open), so
       the chrome has to be told a deck exists (2026-08-21) */
    if(APP.refreshChrome) APP.refreshChrome();
  }
  /* WHAT GOES OUT. A poster is one page: its other pages are drafts and
     variants, and you send one to the print shop, not the pile. Since
     "+ Create new version" makes those easy to accumulate, exporting all
     of them would quietly turn one A0 into three (2026-08-10). A deck's
     slides ARE the deck, so they all go. */
  function outputSlides(){
    var all=[];
    (pres.slides||[]).forEach(function(s,i){
      /* A FLIP BOOK EXPLODES ON THE WAY OUT. This is the whole payoff:
         the complaint was "heaps of new slides each with a new figure",
         so the editor keeps ONE slide with the figures stacked inside it
         and the exporter builds the pile — six frames become six real
         PowerPoint slides, each with the items tied to that frame and
         nothing else (2026-08-22).
         The FIRST flip book on the slide is the one that explodes it.
         Two of them multiplying into a grid of pages is nobody's
         intention, and the second simply rests on its own frame. */
      var fl=flipsOn(s)[0];
      var n=fl?flipFrames(fl.a).length:0;
      if(n>1){
        for(var f=0;f<n;f++) all.push({s:s,i:i,f:f});
        return;
      }
      all.push({s:s,i:i,f:null});
    });
    if(!pageOf().poster||all.length<2) return all;
    var k=0;
    all.forEach(function(e,j){if(e.i===cur&&!k) k=j;});
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
    /* ...and told when it stops existing: closing the last deck with no
       notebook open has to land back on the welcome, not a blank page */
    if(APP.refreshChrome) APP.refreshChrome();
  }
  /* ---- URL routing hooks used by the SemApp router (docs side) ---- */
  window.SemApp.deckState=function(){
    return deckEl.hidden?null:{name:pres.name,slide:cur};
  };
  window.SemApp.deckClose=function(){closeDeck();};
  /* ---- what the welcome screen lists ---------------------------------
     The presentations rail is not the only door any more: it collapses,
     and once it was away the front door had no route to a deck at all
     (2026-08-21, user: "you can't get to the presentations from here
     either"). Same source of truth as the rail's own rows. */
  window.SemApp.deckNames=function(){
    var out=[],seen={},saved=allSaved(),savedNames={};
    saved.forEach(function(p){savedNames[p.name]=1;});
    function push(nm,p,draft){
      if(!nm||seen[nm]) return;
      seen[nm]=1;
      out.push({name:nm,
        slides:(((p||{}).slides)||[]).length,
        poster:/^a\d/.test(String((p||{}).page||'')),
        view:isViewPres(p||{}),
        folder:(p||{}).folder||'',
        draft:!!draft});
    }
    saved.forEach(function(p){push(p.name,p,false);});
    draftNames().forEach(function(nm){
      push(nm,loadDraft(nm)||{},!savedNames[nm]);});
    return out;
  };
  /* opening one is the rail's own action, so a deck, a poster and a
     custom view each land where they belong */
  window.SemApp.deckChoose=function(nm){choosePresentation(nm);};
  /* a presentation needs no notebook: every tool except the cell frame
     works on an empty deck, so the front door can offer this as a way
     IN rather than as something you reach after opening a notebook
     (2026-08-22, user: "you can really only create a presentation once
     you have a notebook open"). */
  window.SemApp.deckNew=function(){newPresentation();};
  /* (the chrome redraw for these hooks runs from THE BOOT SEQUENCE) */
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
  /* ---- the Present menu ------------------------------------------------
     Play from here, play from the start, or open the presenter view first
     and then play. Presenter view deliberately does NOT start playback:
     you want to drag the window to the other screen before anything goes
     full screen (2026-08-20). */
  (function(){
    var wrap=$('#dc-playmore'),menu=$('#play-menu');
    if(!wrap||!menu) return;
    wrap.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      menu.hidden=!open;
      wrap.setAttribute('aria-expanded',open?'true':'false');
      /* floated for the same reason as the File menu: the qat's scroll
         floor must not clip it */
      if(open) floatMenu(wrap,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!menu.contains(e.target)&&e.target!==wrap)
        menu.hidden=true;
    });
    function mi(id,fn){
      var b=$(id);
      if(b) b.addEventListener('click',function(e){
        e.stopPropagation();menu.hidden=true;fn();});
    }
    mi('#pl-here',function(){$('#dc-play').click();});
    mi('#pl-start',function(){cur=0;refresh();$('#dc-play').click();});
    mi('#pl-presenter',openPresenter);
    mi('#pl-notes',function(){
      if(window.SemDeckNotes) window.SemDeckNotes();});
    function syncTap(){
      var b=$('#pl-tap'); if(!b) return;
      b.textContent='Click a figure to enlarge it: '
        +(pres&&pres.tapzoom?'on':'off');
      b.title=pres&&pres.tapzoom
        ?'Clicking an item during the talk blows it up. Clicking anywhere '
          +'else still moves you on.'
        :'Off: a click anywhere moves the talk on, and Alt+click (or Z) '
          +'blows up whatever is under the pointer.';
    }
    mi('#pl-tap',function(){
      if(pres.tapzoom) delete pres.tapzoom; else pres.tapzoom=1;
      markDirty();syncTap();
      toast(pres.tapzoom
        ?'Clicking a figure or a text box now enlarges it while presenting'
        :'Back to a plain click moving the talk on');
    });
    var plBtn=$('#dc-playmore');
    if(plBtn) plBtn.addEventListener('click',syncTap);
    syncTap();
  })();
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
  /* ---- WHAT KIND OF TEXT BOX ------------------------------------------
     The caret beside Insert > Text, built like the Shapes gallery beside
     it: pick, and the tool arms. Naming a box as you make it is the half
     of named styles that was missing — until now the only way to get a
     Heading 2 was to draw a plain box and then go and find the Styles
     menu (2026-08-22).
     The armed type is NOT written into the button's label. deck.js
     records the rule where the format bar is built: a label whose width
     changes with what you clicked makes the ribbon's required width
     depend on the selection, and the fit ladder has no rung left to
     absorb that. It shows in the caret's tooltip, in the pressed state
     of the menu row, and in the tool hint — exactly where pendingShape
     shows. */
  (function(){
    var btn=$('#tx-type-btn'),menu=$('#tx-type-menu'),drop=$('#tx-drop');
    if(!btn||!menu) return;
    function syncCaret(){
      var d=pendingStyle&&styleDef(pendingStyle);
      btn.title=d
        ?('The next text box will be a '+d.label
          +'. Click to change it or go back to plain text')
        :'Make the next text box a heading, a caption or any other named '
          +'type, instead of a plain one';
    }
    function build(){
      menu.innerHTML='';
      menuHead(menu,'make the next text box a');
      var rows=[['','Plain text box',null]];
      styleOrder().forEach(function(id){
        rows.push([id,styleDef(id).label,styleDef(id)]);});
      rows.forEach(function(r){
        var b=document.createElement('button');
        b.className='dbtn vw-opt jv-styleopt';
        b.setAttribute('aria-pressed',(pendingStyle===r[0]).toString());
        var t=document.createElement('span');
        t.className='jv-stylename';t.textContent=r[1];
        /* the row is a SPECIMEN, the same way the Styles menu's rows are:
           you pick by looking rather than by reading a number */
        if(r[2]){
          t.style.fontWeight=r[2].b?'700':'400';
          if(r[2].i) t.style.fontStyle='italic';
          t.style.fontSize=Math.max(11,Math.min(21,r[2].size*3.1))+'px';
          if(r[2].color) t.style.color=r[2].color;
          if(r[2].font) t.style.fontFamily=fontCss(r[2].font);
        }
        b.appendChild(t);
        if(r[2]){
          var n=document.createElement('span');
          n.className='jv-stylesz';
          n.textContent=Math.round(r[2].size*5.4)+' pt';
          b.appendChild(n);
        }
        b.addEventListener('click',function(e){
          e.stopPropagation();
          pendingStyle=r[0];
          menu.hidden=true;
          btn.setAttribute('aria-expanded','false');
          syncCaret();
          setTool('text');
        });
        menu.appendChild(b);
      });
    }
    btn.addEventListener('click',function(e){
      /* stopPropagation, and no `et` class and no data-tool on this
         button: the shared tool wiring would otherwise arm setTool(
         undefined) off it */
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&drop&&!drop.contains(e.target)){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    });
    syncCaret();
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
    /* BEFORE the early return: Ctrl+S while a caret is in a text box was
       not handled here at all, so it was not preventDefault'ed either and
       the browser's own "Save page as..." dialog opened over the editor,
       saving nothing. Flush first, then let the save branch below run. */
    if(e.target.isContentEditable){
      if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')) flushTextEdits();
      else return;
    }
    if(e.key==='Escape'){
      var vf=$('#vfull');
      /* an armed match is the OUTERMOST mode you can be standing in — you
         cannot be trimming or inside a group while the canvas is a
         picker — so it goes first and swallows the key */
      if(matchArm){e.preventDefault();cancelMatch();return;}
      if(vf&&!vf.hidden) closeVFull();
      /* trim mode is the innermost state: the first Esc leaves IT,
         keeping the selection, before any tool/selection drops */
      else if(mode==='edit'&&cropMode){setCropMode(false);}
      /* then the group you have stepped into — also inner, and also worth
         keeping the selection through (2026-08-20) */
      else if(mode==='edit'&&inGroup!=null){
        leaveGroup(stage.querySelector('.annot-layer'));
        var lg=stage.querySelector('.annot-layer');
        if(lg&&typeof selAnnot==='number') selectAnnot(lg,selAnnot);
      }
      else if(spotEl){closeSpot();}
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
    else if((e.ctrlKey||e.metaKey)&&e.key==='F1'&&mode==='edit'){
      /* PowerPoint's own shortcut for the same thing (2026-08-20) */
      e.preventDefault();setRibbonFold(!ribbonFolded());
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
      /* the two PLACED pastes. They come first because the plain-paste
         branch below matches 'v' and 'V' alike and would swallow them,
         and they preventDefault because there is nothing the native
         paste event could add: the buffer is ours. */
      else if((e.ctrlKey||e.metaKey)&&e.shiftKey
              &&(e.key==='v'||e.key==='V')){
        e.preventDefault();tookPaste();
        if(!clipBuf.length) toast('Nothing copied yet');
        else {pasteBuf('place');
          toast('Pasted in place — the coordinates it was copied '
            +'from');}
      }
      else if((e.ctrlKey||e.metaKey)&&e.altKey
              &&(e.key==='v'||e.key==='V')){
        e.preventDefault();tookPaste();
        if(!clipBuf.length) toast('Nothing copied yet');
        else {pasteBuf('here');
          toast(pointerPct()?'Pasted at the pointer'
            :'Pasted in the middle — the pointer was off the page');}
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
      /* Z spotlights whatever the pointer is over. Alt+click does the
         same with the mouse alone; this is the version you can use from a
         lectern with a clicker in one hand (2026-08-20). */
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='z'||e.key==='Z')
              &&mode==='view'){
        e.preventDefault();
        if(spotEl) closeSpot(); else if(spotHover) spotlight(spotHover);
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
  /* ---- the slide column's own three controls ---------------------------
     Section, the display-mode chooser and the drag handle. All three are
     about the STRIP, so all three live on it rather than in a ribbon that
     has no room and cannot see what it is acting on (2026-08-22). */
  (function(){
    var sec=$('#film-sec');
    if(sec) sec.addEventListener('click',function(){
      newSection(cur,'New section');
      /* the name is the point of a section, so ask for it straight away
         rather than leaving "New section" sitting there */
      var runs=sectionRuns(),i;
      for(i=0;i<runs.length;i++)
        if(runs[i].at<=cur&&cur<runs[i].at+runs[i].n&&runs[i].id)
          {renameSection(runs[i].id);break;}
    });
    var btn=$('#film-view-btn'),menu=$('#film-view-menu');
    function label(){
      var pg=pageOf().poster?2:1,m=filmMode(),i;
      for(i=0;i<FILM_VIEWS.length;i++)
        if(FILM_VIEWS[i][0]===m) return FILM_VIEWS[i][pg];
      return FILM_VIEWS[0][pg];
    }
    function syncFilmBtn(){
      if(btn) btn.innerHTML=bic('layouts')+' '+label()+' &#9662;';
    }
    function setFilmMode(m){
      filmView=m;
      lsSet(FILMKEY+SCOPE,m);
      syncFilmBtn();renderFilm();
    }
    if(btn&&menu){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var open=menu.hidden;
        if(open){
          menu.innerHTML='';
          var pg=pageOf().poster?2:1;
          FILM_VIEWS.forEach(function(v){
            var b=document.createElement('button');
            b.className='dc-mi';
            b.textContent=v[pg];
            b.setAttribute('aria-pressed',(filmMode()===v[0]).toString());
            b.addEventListener('click',function(ev){
              ev.stopPropagation();menu.hidden=true;setFilmMode(v[0]);});
            menu.appendChild(b);
          });
        }
        menu.hidden=!open;
        btn.setAttribute('aria-expanded',open?'true':'false');
      });
      document.addEventListener('click',function(e){
        if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn)
          menu.hidden=true;
      });
      syncFilmBtn();
      window.SemDeckFilmBtn=syncFilmBtn;
    }
    /* the drag. --film-w is set on the DECK and never on --dc-w, which
       the document view's own margin also reads — overloading that one
       makes dragging the slide column shove the notebook sideways. */
    var h=$('#film-resize');
    var wPref=parseInt(lsGet(FILMWKEY+SCOPE),10);
    if(wPref>=150&&wPref<=900)
      deckEl.style.setProperty('--film-w',wPref+'px');
    if(h) h.addEventListener('pointerdown',function(e){
      e.preventDefault();
      h.classList.add('on');
      try{h.setPointerCapture(e.pointerId);}catch(err){}
      var w=0;
      function mv(ev){
        w=Math.max(150,Math.min(900,ev.clientX));
        deckEl.style.setProperty('--film-w',w+'px');
        /* the stage just lost or gained that width, so the page has to
           re-fit as you drag or the slide sits wrong until you let go */
        applyZoom();
      }
      function up(){
        h.classList.remove('on');
        document.removeEventListener('pointermove',mv);
        document.removeEventListener('pointerup',up);
        /* ONE re-render at the end: the thumbnails re-measure their type
           off the new width, and doing that on every pointermove would
           rebuild sixty <svg>s a second */
        if(w){lsSet(FILMWKEY+SCOPE,String(w));renderFilm();}
      }
      document.addEventListener('pointermove',mv);
      document.addEventListener('pointerup',up);
    });
  })();
  /* (the picker's first render runs from THE BOOT SEQUENCE) */
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
      /* floated (position:fixed) so fitQat's scroll floor can never
         cut the menu off at the bar's edge */
      if(!open) floatMenu(fileBtn,fileMenu);
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

  /* ---- watermark / header / footer, edited in one small prompt each --
     A dialog would be a whole modal for three fields nobody changes twice
     a year; a prompt says exactly what it wants and leaves the ribbon
     button showing whether the thing is on. Empty turns it off, which is
     the same gesture as clearing any other field. */
  function furnEdit(key,label,hint,dflt){
    var cur_=pres[key]||{};
    var v=prompt(label+'\n\n'+hint,cur_.text||dflt||'');
    if(v===null) return;
    v=v.trim();
    if(!v) delete pres[key];
    else {
      pres[key]=pres[key]||{};
      pres[key].text=v;
      if(key==='wmark'){
        if(pres[key].size==null) pres[key].size=12;
        if(pres[key].op==null) pres[key].op=0.12;
      } else if(pres[key].size==null) pres[key].size=2;
    }
    markDirty();refresh();syncFurnBtns();
    toast(v?(label+' set'):(label+' removed'));
  }
  function syncFurnBtns(){
    [['#dc-wmark','wmark'],['#dc-head','head'],['#dc-foot','foot']]
      .forEach(function(p2){
        var b=$(p2[0]); if(!b) return;
        var on=!!(pres[p2[1]]&&String(pres[p2[1]].text||'').trim());
        b.setAttribute('aria-pressed',on?'true':'false');
      });
    var nb=$('#dc-nums');
    if(nb) nb.setAttribute('aria-pressed',pres.showNums?'true':'false');
  }
  var wmB=$('#dc-wmark');
  if(wmB) wmB.addEventListener('click',function(){
    furnEdit('wmark','Watermark',
      'One word or phrase, printed faintly across every page and always '
      +'BEHIND your content.\nLeave it empty to remove it.','DRAFT');
  });
  var hdB=$('#dc-head');
  if(hdB) hdB.addEventListener('click',function(){
    furnEdit('head','Header',
      'A line along the top of every page.\n'
      +'{name} the presentation, {date} today, {n} this page, {N} the '
      +'total.\nLeave it empty to remove it.','{name}');
  });
  var ftB=$('#dc-foot');
  if(ftB) ftB.addEventListener('click',function(){
    furnEdit('foot','Footer',
      'A line along the bottom of every page.\n'
      +'{name} the presentation, {date} today, {n} this page, {N} the '
      +'total.\nLeave it empty to remove it.','{n} / {N}');
  });
  var numB=$('#dc-nums');
  if(numB) numB.addEventListener('click',function(){
    var mi=$('#mi-nums'); if(mi) mi.click();
    syncFurnBtns();
  });
  /* ---------- persistence ---------- */
  var toastTimer;
  function toast(msg,ms){
    var t=$('#deck-toast');t.textContent=msg;t.hidden=false;
    clearTimeout(toastTimer);
    /* a warning about lost work has to outlast a confirmation of saved
       work, so the duration is a parameter now (2026-08-22) */
    toastTimer=setTimeout(function(){t.hidden=true;},ms||3600);
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
  function saveToProject(silent,embed){
    flushTextEdits();   /* the words still in the DOM are part of the save */
    var merged=mergedPresentations();
    /* a deliberate Save writes the self-contained form (figures inside)
       into junoview_project.json; the every-second autosave stays refs-
       only so editing does not rewrite megabytes to a synced disk each
       keystroke. `projectPres` keeps the lean copy either way.
       `embed` is the idle consolidation from scheduleAutosave: silent,
       but self-contained, so the file does not sit refs-only between a
       manual Save and the next one. */
    var body=(silent&&!embed)?merged:embedAssets(deep(merged));
    return APP.api('/api/save',{presentations:body,rev:projectRev})
      .then(function(j){
        if(j&&typeof j.rev==='number') projectRev=j.rev;
        projectPres=merged;
        cancelDraftWrite();   /* or the pending write resurrects the draft */
        lsDel(PFX+(pres.name||'untitled'));
        saveStamp=new Date();saveKind=silent?'auto':'manual';
        source='saved';status();renderPresRow();
        if(!silent)
          toast('Saved "'+pres.name+'" to junoview_project.json'
            +embNote());
      }).catch(function(e){
        /* ANOTHER WINDOW GOT THERE FIRST. This whole payload is every
           presentation the tab knows about, so before the server grew a
           revision the loser of the race simply erased the winner's work
           — a deck created in one window vanished the moment the other
           typed a character (2026-08-22). Now: take their list, keep the
           one deck this window is actually editing, and write that. */
        if(e&&e.status===409&&e.data&&Array.isArray(e.data.presentations)){
          var theirs=e.data.presentations.filter(function(p){
            return !p||p.name!==pres.name;});
          var mine=merged.filter(function(p){
            return p&&p.name===pres.name;});
          projectRev=e.data.rev;
          var reconciled=theirs.concat(mine);
          return APP.api('/api/save',
            {presentations:reconciled,rev:projectRev})
            .then(function(j2){
              if(j2&&typeof j2.rev==='number') projectRev=j2.rev;
              projectPres=reconciled;
              saveStamp=new Date();saveKind=silent?'auto':'manual';
              source='saved';status();renderPresTabs();renderPresRow();
              docToastOnce('Another window changed this project — merged '
                +'its changes in. Your "'+pres.name+'" is intact.');
            }).catch(function(e2){
              toast('Save failed after a conflict: '
                +((e2&&e2.message)||e2)+' — use File › Download a copy.',
                9000);
            });
        }
        if(!silent)
          toast('Save failed: '+(e&&e.message?e.message:e));
      });
  }
  /* one conflict notice per settling period: the autosave retries every
     1.2s, and a notice per retry would be a strobe */
  var conflictT=null;
  function docToastOnce(msg){
    if(conflictT) return;
    toast(msg,7000);
    conflictT=setTimeout(function(){conflictT=null;},8000);
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
  /* ---- make the saved deck carry its own pictures ---------------------
     Every placed card's rendered body (figures are data: URIs already) is
     written into the presentation as `p.emb`, keyed by the ref exactly as
     it is saved — so a deck opened with no notebook, and no internet to
     re-fetch one, still shows every frame. Open notebooks are captured
     fresh at save time (the deck tracks the notebook, as ever); a card
     whose notebook is closed keeps its last saved copy instead of losing
     it. normPres absorbs `emb` back into the session store on load. */
  function embedAssets(list){
    list.forEach(function(p){
      if(p.kind==='view') return;
      var emb={};
      (p.slides||[]).forEach(function(s){
        /* every notebook card this slide places, from BOTH the kinds that
           can hold one. A flip book's frames are refs exactly like a
           placed cell's, and leaving them out meant a self-contained deck
           opened with every frame blank — the one failure the embedded
           snapshots exist to prevent (2026-08-22). They dedupe by ref, so
           a flip book costs the same as placing its figures one by one. */
        var refs=[];
        (s.annots||[]).forEach(function(a){
          if(!a) return;
          if(a.k==='cell'&&a.ref) refs.push(a.ref);
          else if(a.k==='flip') flipFrames(a).forEach(function(f){
            if(f&&f.ref) refs.push(f.ref);});
        });
        refs.forEach(function(ref){
          if(emb[ref]) return;
          var it=resolveRef(ref);
          if(it&&!it.emb){
            var b=cloneBody(ref);
            if(!b) return;
            var e={title:it.title||'',kind:it.kind||'',html:b.outerHTML};
            var cc=it.hasCode?cloneCode(ref):null;
            if(cc) e.code=cc.outerHTML;
            emb[ref]=e;
            embStore(normRef(ref),e);   /* keep the session copy fresh */
          } else {
            var e2=embFor(ref);
            if(e2){
              var cp={title:e2.title,kind:e2.kind,html:e2.html};
              if(e2.code) cp.code=e2.code;
              emb[ref]=cp;
            }
          }
        });
      });
      if(Object.keys(emb).length) p.emb=emb;
    });
    /* how much rode along, for the save messages: embedding is automatic
       and was therefore INVISIBLE — with nothing ever saying the figures
       travelled, "save with images" read as a feature that did not exist
       (2026-08-21, user: "so there is no way to like 'save with
       images'"). Every save now says what it carried. */
    lastEmbCount=list.reduce(function(n,p){
      return n+(p.emb?Object.keys(p.emb).length:0);},0);
    embSaveSoon();
    return list;
  }
  var lastEmbCount=0;
  function embNote(){
    return lastEmbCount
      ?' — with '+lastEmbCount+' card'+(lastEmbCount===1?'':'s')
        +' embedded, so it opens without the notebook'
      :'';
  }
  function deckFileText(){
    return JSON.stringify({junoview:1,
      presentations:embedAssets(plainIfSingle(mergedPresentations()))},
      null,2);
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
    flushTextEdits();
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
            if(!silent) toast('Saved to '+(fileName||'your file')+embNote());
            return true;
          });
        });
      }).catch(function(e){
        if(!silent&&(!e||e.name!=='AbortError'))
          toast('Save failed: '+((e&&e.message)||e));
        return false;
      });
  }
  /* WHERE it goes, never WHICH file. The filename is the widest thing
     that could ever land in this bar, it changes under you when you pick
     a different file, and it answers a question nobody asked — the one
     you ask of a Save button is "is this going somewhere I will find it
     again?" (2026-08-20, user: "I don't want you to have 'save to
     <filename>' ... I want you to just say if it's save to local or
     browser"). The filename is in the tooltip. */
  function targetLabel(){
    if(saveTarget==='project') return 'This project';
    if(saveTarget==='file') return 'On this computer';
    return 'In this browser';
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
    /* ...AND PUT THE FIGURES BACK. The 1.2s autosave is deliberately
       refs-only, because embedding rewrites megabytes to a synced disk on
       every keystroke. But it is also the LAST writer: you would click
       Save, get "with 37 cards embedded, so it opens without the
       notebook", nudge one text box, and 1.2 seconds later the project
       file held refs only again — self-contained until you touched it
       (2026-08-22). So a second, much lazier timer consolidates once you
       have actually stopped typing. The window in which the file is
       refs-only is now ~20s of idle rather than forever. */
    clearTimeout(embedTimer);
    embedTimer=setTimeout(function(){
      if(saveTarget==='project'&&APP.mode==='app'&&autosaveOn)
        saveToProject(true,true);
    },20000);
  }
  var embedTimer=null;
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
      /* the reload icon plus a two-width label: fitQat's compaction rung
         swaps "Autosave" for "Auto" — shortened, never hidden */
      qa.innerHTML=bic('reload')
        +' <span class="qat-long">Autosave</span>'
        +'<span class="qat-short">Auto</span> '
        +(autosaveOn?'on':'off');
      qa.setAttribute('aria-pressed',autosaveOn?'true':'false');
      qa.title=autosaveOn
        ?('Autosaving to '+whereSaved()+' about a second after you stop '
          +'typing. Click to turn it off.')
        :'Autosave is off — your work is only written when you press '
          +'Save. Click to turn it on.';
      /* the label just changed width — re-judge the thin bar */
      requestAnimationFrame(fitQat);
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
    /* the typed word first: a paragraph still in the DOM is not in the
       deck, and Save must not report a state it did not save */
    flushTextEdits();
    var ok=lsSet(PFX+(pres.name||'untitled'),JSON.stringify(pres));
    lsSet(PFX+'last',pres.name||'untitled');
    if(!ok){
      /* DO NOT stamp a save that did not happen. This branch used to set
         saveStamp/saveKind and toast success unconditionally, so a write
         that threw on quota still rendered "saved to browser · 14:32"
         (2026-08-22). */
      status();
      toast('NOT saved — this browser is full. Use File › Download a '
        +'copy, or switch "Saved to" to a file on your computer.',9000);
      return;
    }
    saveStamp=new Date();saveKind='manual';
    status();
    toast('Kept in this browser — it also autosaves as you edit. '
      +'Switch "Saved to" to a file to keep it on your computer.');
  });
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
      /* floated so the qat's scroll floor can never clip it */
      if(open) floatMenu(btn,menu);
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
          cancelDraftWrite();   /* the save just made the draft obsolete */
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
    toast((APP.order.length===1
      ?'Downloaded. Keep it next to the .ipynb and it loads itself.'
      :'Downloaded. Load it with --deck, or save to the project instead.')
      +embNote());
  });
  menuAction('#mi-load',openDeckFile);
  window.SemDeckOpenFile=openDeckFile;   /* the rail's "+ New" row */
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
    /* PRINT THE INK. Chrome and Edge default the print dialog's
       "Background graphics" box to OFF, and everything that carries this
       deck's colour is a CSS background: the page, the slide, every shape
       fill, every gradient, every text panel. Without this declaration
       File > Export PDF on the default dark deck produced white pages
       with white text on them — only <img> figures survived, because a
       picture is content rather than decoration. The A0 poster path
       escaped by luck alone (newPoster seeds a white page).
       Both spellings: the unprefixed property is the standard, the
       -webkit- one is what Chrome and Edge actually still honour
       (2026-08-22). */
    bst.textContent='.print-page,.print-page .slide{background:'+bg
      +'!important;}@media print{html,body{background:'+bg+'!important;}}'
      +'.print-page,.print-page *{-webkit-print-color-adjust:exact!important;'
      +'print-color-adjust:exact!important;}'
      +'@media print{html,body{-webkit-print-color-adjust:exact!important;'
      +'print-color-adjust:exact!important;}}';
    root.appendChild(bst);
    outputSlides().forEach(function(ent,i){
      var s=ent.s;
      cur=ent.i;
      /* the page renders for ITS frame, and the bindings follow */
      flipForce=ent.f;
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
      paintFurniture(slideEl,i);
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
    /* put the editor back on its own frame, or every flip book on screen
       would be left showing whatever the last exported page wanted */
    flipForce=null;
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
  /* the pages an export will actually write, flip books already exploded.
     A hook rather than a guess: "one flip book of six figures becomes six
     slides" is the claim the whole feature rests on, and it is only
     checkable from outside (2026-08-22). */
  window.SemDeckRefreshImages=refreshImagesReport;   /* test hook */
  window.SemDeckLinkedImages=linkedImages;          /* test hook */
  window.SemDeckPages=outputSlides;
  window.SemDeckPrintRoot=buildPrintRoot;
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
      /* lang, because a screen reader has to pick a voice and this
         file is the artefact a colleague actually receives */
      var doc='<!doctype html><html lang="en"><head><meta charset="utf-8">'
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
      /* an item tied to a figure other than this page's does not belong
         on this page. note.frame is set by the exploding enumerator; with
         no flip book on the slide it is null and nothing is filtered. */
      if(a.fb){
        var fbk=flipById(s,a.fb);
        var atk=(note.frame!=null)?note.frame:(fbk?(fbk.at||0):0);
        if(!flipShowsFrame(s,a,atk)) return;
      }
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
      } else if(a.k==='table'){
        /* PowerPoint has a real table shape, so pptx.js grew a builder
           for it rather than flattening a table into a grid of
           rectangles - which is not much of an export for anyone who
           then wants to edit the deck (2026-08-20) */
        items.push({t:'table',x:a.x,y:a.y,w:a.w||40,h:a.h||20,
          rot:a.rot,op:a.op,rows:tableRows(a).map(function(r){
            return r.map(function(v){return v==null?'':String(v);});}),
          cols:tableCols(a),thead:!!a.thead,grid:a.grid!==0,
          sizePct:a.size||2.2,color:a.color||ink,font:fontPpt(a.font)});
      } else if(a.k==='flip'){
        /* the frame this exported page is FOR. pptxItems is handed the
           slide plus, for an exploded page, which frame it represents —
           so one flip book of six figures becomes six real PowerPoint
           slides, which is the pile of slides the user was building by
           hand (2026-08-22). A placed notebook figure already exports as
           a picture, so this reuses that path rather than inventing one. */
        var fsel=flipFrames(a)[(note.frame!=null)?note.frame:(a.at||0)];
        var fsrc=null;
        if(fsel&&fsel.src) fsrc=fsel.src;
        else if(fsel&&fsel.ref){
          var fit=resolveRef(fsel.ref);
          var fnd=fit?framePart(fit.ns,fsel.part):null;
          var fig=fnd?fnd.querySelector('img'):null;
          if(fig&&fig.src&&fig.src.indexOf('data:')===0) fsrc=fig.src;
        }
        if(fsrc) items.push({t:'image',x:a.x,y:a.y,w:a.w||40,h:a.h||32,
          rot:a.rot,op:a.op,src:fsrc,
          name:(fsel&&fsel.label)||'Figure'});
        else note.skipped++;
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
        note.frame=ent.f;
        var its=pptxItems(ent.s,note,ink,lay);
        note.frame=null;
        if(ent.s.border) its.unshift({t:'rect',x:0,y:0,w:100,h:100,
          color:ent.s.border.c||'#39a9c0',
          swPct:(ent.s.border.w||4)/SW_REF_H*100,fill:'',name:'Border'});
        return {bg:bgSolid(ent.s.bg||bg),items:its};
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
      bgChips(r1,s2.bg||'',function(v){
        apply(function(x){if(v) x.bg=v; else delete x.bg;});
      },true);
      /* the WHOLE deck's default, in the same menu as the one slide's
         override, so you can see the two against each other. It used to
         be a row in the File menu, which is where you open, save and
         export things (2026-08-20, user). */
      menuHead(menu,'Every slide');
      var r0=menuRow(menu,'bg-sw');
      bgChips(r0,(pres&&pres.pageBg)||'',function(v){
        pres.pageBg=v;markDirty();applyPageBg();applyZoom();renderSlide();
        build();
        toast('Background for every slide set');
      },false);
      /* the deck default only shows through on slides that have no
         override of their own, so on any slide that HAS one the row
         above silently did nothing at all — you set the background for
         every slide and watched the one in front of you not change
         (2026-08-22). This is the verb that clears them. */
      var push=document.createElement('button');
      push.className='dbtn vw-opt';
      push.textContent='Use this on every slide (clears per-slide ones)';
      push.title='Slides with a background of their own keep showing it '
        +'until this clears them';
      var over=(pres.slides||[]).filter(function(x){return x&&x.bg;});
      push.disabled=!over.length;
      if(over.length) push.title='Clears the background '+over.length
        +' slide'+(over.length===1?'':'s')+' set individually';
      push.addEventListener('click',function(e){
        e.stopPropagation();
        var use=s2.bg||pres.pageBg||'';
        if(use) pres.pageBg=use;
        (pres.slides||[]).forEach(function(x){if(x) delete x.bg;});
        markDirty();applyPageBg();applyZoom();renderSlide();build();
        toast('Every slide now uses the one background');
      });
      menu.appendChild(push);
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
  /* ---- OPENING A .junoview FILE ---------------------------------------
     Opening a file used to import its contents and then carry on saving
     to the BROWSER, so the file you opened never changed again and your
     work quietly went somewhere else (2026-08-20, user: "when loading
     presentation from computer, it then starts saving to browser, should
     save to the same file").
     Where the File System Access API exists we ask for a real handle, so
     Save writes straight back to the file you opened. Where it does not
     (Firefox, Safari) an <input type=file> gives contents but no handle —
     nothing can write back to it — so the target is still set to "on this
     computer" and the first Save asks once where to put it. Either way
     the answer to "where is this going?" stops being "somewhere else". */
  function openDeckFile(){
    if(window.showOpenFilePicker){
      window.showOpenFilePicker({
        types:[{description:'Junoview presentation',
          accept:{'text/html':['.html','.junoview'],
            'application/json':['.json']}}],
        multiple:false
      }).then(function(hs){
        var h=hs&&hs[0]; if(!h) return;
        return h.getFile().then(function(f){
          return f.text().then(function(txt){
            importDeckText(txt,false);
            /* the handle is what makes Save write back to this very file */
            fileHandle=h;fileName=h.name||f.name||'';
            idbPut('deckFile',h);
            setTarget('file');
            toast('Opened \u2014 Save now writes back to '+fileName);
          });
        });
      }).catch(function(){});
      return;
    }
    var fi=document.getElementById('deckfile');
    if(fi) fi.click();
  }
  (function(){
    var fi=document.getElementById('deckfile');
    if(!fi) return;
    fi.addEventListener('change',function(){
      var f=this.files&&this.files[0];
      this.value='';
      if(!f) return;
      var nm=f.name||'';
      f.text().then(function(txt){
        importDeckText(txt,false);
        /* no handle from an <input>, so we cannot write back to the file
           itself - but the DESTINATION is still "a file on your
           computer", and the first Save asks where once */
        fileName=nm;fileHandle=null;
        setTarget('file');
        toast('Opened \u2014 Save keeps it as a file on your computer');
      }).catch(function(e){
        toast('Import failed: '+((e&&e.message)||e));
      });
    });
  })();
  menuAction('#mi-discard',function(){
    cancelDraftWrite();   /* a pending write would resurrect the discard */
    lsDel(PFX+(pres.name||'untitled'));
    loadPresentation(pres.name);
    cur=0;activePane=-1;
    status();
    refresh();
  });
  /* ONE project save, shared by rename and delete. embedAssets, not the
     lean list: `projectPres` can never carry `emb` (normPres absorbs it
     into the session store), so posting it raw made a rename or a delete
     quietly strip every embedded figure out of junoview_project.json —
     the file stopped being self-contained without anything being said
     (2026-08-22). */
  function saveProject(){
    if(APP.mode==='app')
      APP.api('/api/save',{presentations:embedAssets(deep(projectPres))})
        .catch(function(){});
  }
  /* one delete, callable for ANY presentation — the File menu and the
     rail rows' bins both land here (2026-08-18, user: "an easier way to
     delete presentation ... a delete option when something is selected") */
  function deletePresByName(nm){
    if(pres&&nm===pres.name) cancelDraftWrite();
    lsDel(PFX+nm);
    /* embedded-in-a-notebook presentations come back on reload — say so,
       whichever door the delete came through */
    var wasEmbedded=nbPres.some(function(p){return p.name===nm;});
    projectPres=projectPres.filter(function(p){return p.name!==nm;});
    nbPres=nbPres.filter(function(p){return p.name!==nm;});
    saveProject();
    if(nm===pres.name){
      var names=allSaved().map(function(p){return p.name;})
        .concat(draftNames());
      names=names.filter(function(x){return x!==nm;});
      if(names.length) loadPresentation(names[0]);
      else {pres=defaultPres();source='auto';}
      cur=0;activePane=-1;
      status();refresh();
    } else renderPresTabs();
    toast(wasEmbedded
      ?('Deleted "'+nm+'" (it will return if it is embedded in a '
        +'notebook’s metadata)')
      :('Deleted "'+nm+'"'));
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
    flushDraftWrite();   /* migrate the CURRENT state, not a stale draft */
    var draft=lsGet(PFX+old);
    if(draft!=null){lsSet(PFX+nm,draft);lsDel(PFX+old);}
    /* the folder rides on the presentation object itself (p.folder), so
       it needs no separate move — but the SAVED copies are matched by
       name and do */
    projectPres.forEach(function(p){if(p.name===old) p.name=nm;});
    nbPres.forEach(function(p){if(p.name===old) p.name=nm;});
    pres.name=nm;
    saveProject();
    markDirty();status();renderPresTabs();renderPresRow();
    toast('Renamed to “'+nm+'”');
    return true;
  }
  menuAction('#mi-del',function(){
    deletePresByName(pres.name);
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
    /* ---- FIND & REPLACE: FORMATTING ------------------------------
       Text replace above answers "every 'SST' becomes 'sea surface
       temperature'". This answers "every 18pt Georgia heading becomes
       20pt Inter" — the sweep you need when a deck has to change face,
       and the one that otherwise costs an afternoon of clicking
       (TASKS T6).

       FIND is T5's criteria table, used and not duplicated: the ticked
       rows AND together, and every one of them is read off the object
       you have SELECTED. Describing a look in the abstract is a form
       nobody fills in correctly — picking an example of it is one
       click, and it is the same gesture T5 already taught.

       CHANGE is a short list of fields, not a whole look. Copying a
       whole look onto everything of a type is the Apply dialog's job
       and it already does it well; this is the surgical one — change
       exactly these fields, on exactly the things that answer this
       description, and leave the rest alone. Nothing here writes
       a.style, for the reason the Apply dialog gives: re-tagging a box
       changes what it IS, not how it looks. */
    var FMT_CHANGES=[
      /* key, label, kinds it means anything for, write(a,v) */
      ['font','Typeface','text',function(a,v){
        if(v) a.font=v; else delete a.font;}],
      ['size','Text size','text table',function(a,v){a.size=v/5.4;}],
      ['color','Colour','text arrow rect draw',function(a,v){
        a.color=v;}]
    ];
    var fmtPanel=$('#find-fmt'),mode='text';
    function fmtRef(){
      var s2=pres.slides[cur];
      var ids=selIdxs();
      return (s2&&(s2.annots||[])[ids[ids.length-1]])||null;
    }
    /* WHICH OBJECTS A SWEEP TOUCHES — and it is NOT annotsBy's rule.
       annotsBy answers "what can I select", so it leaves out hidden
       items: you cannot select what is not on the page. A sweep is a
       different question. `hide` means "hidden while EDITING, still
       shown when presenting", so an item skipped here would keep the
       old face through the whole talk — the exact failure the sweep
       exists to prevent. Fully locked items are still out: a lock is an
       explicit "not this one". */
    function sweep(crit,scope){
      var out=[];
      var ids=(scope==='deck')
        ?(pres.slides||[]).map(function(_,i){return i;}):[cur];
      ids.forEach(function(i){
        var sl=(pres.slides||[])[i]; if(!sl) return;
        (sl.annots||[]).forEach(function(a,j){
          if(!a||lockedAll(a)) return;
          if(critsMatch(a,crit)) out.push({si:i,i:j,a:a});
        });
      });
      return out;
    }
    function fmtBuild(){
      if(!fmtPanel) return;
      fmtPanel.innerHTML='';
      var ref=fmtRef();
      if(!ref){
        var p0=document.createElement('div');
        p0.className='ff-none';
        p0.textContent='Select an object on the page first \u2014 this '
          +'half describes what to find BY EXAMPLE, the same way '
          +'"select everything like this" does.';
        fmtPanel.appendChild(p0);
        return;
      }
      function head(t){menuHead(fmtPanel,t);}
      function ck(label,on){
        var l=document.createElement('label');
        l.className='find-ck';
        var b=document.createElement('input');
        b.type='checkbox';b.checked=!!on;
        l.appendChild(b);
        l.appendChild(document.createTextNode(' '+label));
        return {el:l,box:b};
      }
      /* ---- what to find ---- */
      head('find objects that are');
      var crits=[];
      SELECT_CRIT.forEach(function(c,n){
        var v=c[1](ref);
        if(v==null) return;
        /* the FIRST row (the type) starts ticked: on its own it is
           already a useful sweep, and a dialog that starts matching
           nothing reads as broken */
        var r=ck(c[2](v,ref),crits.length===0);
        crits.push({key:c[0],val:v,box:r.box});
        fmtPanel.appendChild(r.el);
        r.box.addEventListener('change',recount);
      });
      /* ---- what to change ---- */
      head('and change');
      var chs=[];
      FMT_CHANGES.forEach(function(c){
        var row=document.createElement('div');row.className='ff-row';
        var r=ck(c[1],false);
        row.appendChild(r.el);
        var inp;
        if(c[0]==='font'){
          inp=document.createElement('select');
          var o0=document.createElement('option');
          o0.value='';o0.textContent='(default)';inp.appendChild(o0);
          FONTS.forEach(function(fo){
            var o=document.createElement('option');
            o.value=fo.id;o.textContent=fo.label;inp.appendChild(o);});
          inp.value=ref.font||'';
        } else if(c[0]==='size'){
          inp=document.createElement('input');
          inp.type='number';inp.min='6';inp.max='240';
          inp.value=String(Math.round((ref.size||2.6)*5.4));
        } else {
          inp=document.createElement('input');
          inp.type='color';
          inp.value=/^#[0-9a-f]{6}$/i.test(ref.color||'')
            ?ref.color:'#ffffff';
        }
        inp.className='ff-in';
        row.appendChild(inp);
        fmtPanel.appendChild(row);
        chs.push({key:c[0],kinds:c[2],write:c[3],box:r.box,inp:inp});
        r.box.addEventListener('change',recount);
      });
      /* ---- over what ---- */
      head('over');
      var scope=document.createElement('select');
      scope.className='ff-in';scope.style.width='100%';
      [['deck','The whole deck'],['slide','This slide only']]
        .forEach(function(o){
          var e=document.createElement('option');
          e.value=o[0];e.textContent=o[1];scope.appendChild(e);});
      scope.addEventListener('change',recount);
      fmtPanel.appendChild(scope);
      /* ---- the count, and the button ---- */
      var foot=document.createElement('div');foot.className='find-foot';
      var cnt=document.createElement('span');cnt.className='find-count';
      foot.appendChild(cnt);
      var spring=document.createElement('span');
      spring.className='deck-spring';foot.appendChild(spring);
      var go=document.createElement('button');
      go.className='dbtn';go.textContent='Change them';
      foot.appendChild(go);
      fmtPanel.appendChild(foot);
      function picked(){
        return crits.filter(function(c){return c.box.checked;})
          .map(function(c){return {key:c.key,val:c.val};});
      }
      function edits(){
        return chs.filter(function(c){return c.box.checked;});
      }
      function recount(){
        var crit=picked();
        var hitn=crit.length?sweep(crit,scope.value):[];
        var sl={};hitn.forEach(function(h){sl[h.si]=1;});
        var ns=Object.keys(sl).length;
        cnt.textContent=!crit.length
          ?'tick what to find'
          :hitn.length
            ?(hitn.length+' object'+(hitn.length===1?'':'s')
              +' on '+ns+' slide'+(ns===1?'':'s'))
            :'nothing matches';
        go.disabled=!hitn.length||!edits().length;
      }
      go.addEventListener('click',function(){
        var crit=picked(),ed=edits();
        if(!crit.length||!ed.length) return;
        var hitn=sweep(crit,scope.value);
        var n=0;
        hitn.forEach(function(h){
          var did=false;
          ed.forEach(function(c){
            /* a field that means nothing for this kind is not written:
               a `size` on a shape would be a junk key that every export
               then has to ignore */
            if(c.kinds.indexOf(h.a.k)<0) return;
            var v=(c.key==='size')?(+c.inp.value||0):c.inp.value;
            if(c.key==='size'&&!(v>0)) return;
            c.write(h.a,v);did=true;
          });
          if(did) n++;
        });
        if(!n){toast('Nothing to change \u2014 those fields mean '
          +'nothing for what you matched');return;}
        markDirty();refresh();
        toast('Changed '+n+' object'+(n===1?'':'s'));
        fmtBuild();
      });
      recount();
    }
    function setMode(m){
      mode=m;
      $$('#find-pop [data-fmode]').forEach(function(el){
        el.hidden=(el.getAttribute('data-fmode')!==m);});
      if(fmtPanel) fmtPanel.hidden=(m!=='fmt');
      var bt=$('#find-m-text'),bf=$('#find-m-fmt');
      if(bt){bt.classList.toggle('on',m==='text');
        bt.setAttribute('aria-selected',String(m==='text'));}
      if(bf){bf.classList.toggle('on',m==='fmt');
        bf.setAttribute('aria-selected',String(m==='fmt'));}
      if(m==='fmt') fmtBuild();
    }
    (function(){
      var bt=$('#find-m-text'),bf=$('#find-m-fmt');
      if(bt) bt.addEventListener('click',function(){setMode('text');});
      if(bf) bf.addEventListener('click',function(){setMode('fmt');});
    })();
    function open(){
      pop.hidden=false;
      /* a re-open re-reads the selection: the whole find half is
         seeded by example, and a stale example is worse than none */
      if(mode==='fmt') fmtBuild();
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
    /* ONE door: the top bar (or Ctrl+F). The ribbon copy is gone */
    ['#qat-find'].forEach(function(sel){
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
    /* invalidation point 1 (see frameNodeCache): the notebook's cards
       changed (reload) or just became the live source (fresh open) —
       cached frame nodes for this stem must rebuild, which also refills
       frameSnaps for the next revert */
    dropFrameCache(e.detail.stem);
    registerShell(e.detail.stem,e.detail.data||{});
    if(source==='auto'&&(!pres.slides||!pres.slides.length))
      pres=defaultPres();
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });
  document.addEventListener('sem:shellclosed',function(e){
    /* invalidation point 2: frames fall back to the embedded copy */
    dropFrameCache(e.detail.stem);
    unregisterShell(e.detail.stem);
    if(!deckEl.hidden) refresh();
    else renderPresTabs();
  });

  /* embedded card snapshots from earlier sessions (IndexedDB, per scope):
     without this, a deck imported from a self-contained file kept its
     figures only until the tab closed — the drafts it left behind are
     refs-only by design, so the next session opened to empty frames. A
     copy absorbed THIS session is fresher and is never overwritten. */
  idbGet('emb:'+SCOPE).then(function(m){
    if(!m||typeof m!=='object') return;
    var added=0;
    Object.keys(m).forEach(function(k){
      var e=m[k];
      if(EMBED[k]||!e||typeof e.html!=='string'||!e.html) return;
      embStore(k,e);added++;
    });
    if(!added) return;
    if(!deckEl.hidden) refresh(); else renderPresTabs();
  }).catch(function(){});

  /* ================= THE BOOT SEQUENCE =================
     ALL of this file's load-time work runs from here, after every
     declaration and every `var` initialiser above. Never call any of it
     mid-file, and never add a sub-IIFE that executes logic at load:
     function declarations hoist but `var` initialisers do not, and a
     throw during load silently kills the rest of this IIFE — no
     handlers, no exports, no deck, and no test notices. Not
     hypothetical: on 2026-08-22 a mid-file loadPresentation(last) ran
     histReset() → syncCustomTypes() → Object.keys(STYLE_DEFAULTS)
     thousands of lines before STYLE_DEFAULTS was assigned, and the
     TypeError killed everything below it — the editor quietly stopped
     existing. These calls keep the relative order they ran in when they
     were scattered mid-file. */
  initShellRegistry();        /* every notebook the page carries */
  initFirstPresentation();    /* the presentation the page opens with */
  /* app.js paints the welcome before this file loads; redraw it now the
     SemApp.deck* hooks and the registry can answer its questions */
  if(APP.refreshChrome) APP.refreshChrome();
  renderLayoutPicker();
  renderAutosaveItem();
  renderSaveBtn();
  /* belt-and-braces: initFirstPresentation already synced the custom
     types (via histReset, or explicitly on its default branch), so this
     second pass is an idempotent no-op — it re-pins the invariant the
     2026-08-22 incident was about: the registry must be synced by the
     time boot finishes, whatever path loaded the presentation. */
  syncCustomTypes();
  status();
  renderPresTabs();
  /* the ribbon you kept: applied once here, at the tail, after every
     declaration and every group's markup is real. It must not run
     mid-file — it walks #edit-tools and calls fitEditRibbon (T11). */
  applyRibbonPrefs();
  /* both IIFEs + their route hooks are now wired — restore the URL's view */
  if(window.SemApp&&window.SemApp.applyInitialRoute)
    window.SemApp.applyInitialRoute();
})();
