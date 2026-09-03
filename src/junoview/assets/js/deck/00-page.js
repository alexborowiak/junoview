/* ======================================================================
   deck/ — the presentation builder. ONE IIFE, one file per fragment.

   WHY FILES AND NOT MODULES. Everything here shares one closure: `pres`,
   `cur`, `mode`, `selAnnot` and several hundred functions that reach for
   them. ES modules would mean giving every one of those an export and an
   import, and they are not available anyway — a rendered page is opened
   from file:// at least as often as from a server, and `type="module"`
   is blocked there outright. So the parts are FRAGMENTS: assets.deck_js()
   concatenates them, in the fixed order named in assets/__init__.py, and
   the result is the single IIFE it always was.

   WHAT THAT COSTS, said plainly: a part does not parse on its own, so
   your editor will underline the last brace of every file and
   `node --check` on one part is meaningless. The gate that replaces it
   is stricter, not weaker — tests/test_js_contract.py assembles the
   parts and parses THAT, which is the thing that actually ships.

   WHAT IT BUYS is the one thing a 24,000-line file costs most: opening
   the part you need. The names say what is in them, and the section
   banners inside each still answer `grep "/* ----"`.

   THE SPLIT IS A RE-ARRANGEMENT AND NOTHING ELSE. It was made by cutting
   at section banners that were proved safe — each part was wrapped alone
   in a function and parsed, so a cut inside a function could not survive
   — and the parts were then concatenated and compared against the
   original file byte for byte. The rendered page's md5 did not move,
   which is the same claim from the other end (2026-08-25, TASKS T36).

   The original file's own header follows, unchanged:

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
    /* NAMED FOR EVERYTHING ON THEM (T193): both of these carry a title
       too, which "Text | panel" did not say */
    {id:'text-cell',label:'Title + text + panel',items:[
      {k:'text',x:5,y:5,w:90,h:11,text:'Title',size:5,b:1},
      {k:'text',x:5,y:23,w:40,h:60,text:'Body text',size:3},
      {k:'cell',x:49,y:20,w:47,h:76}]},
    {id:'cell-text',label:'Title + panel + text',items:[
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
  /* the layout a new slide takes, remembered per project (T193) */
  function newLayKey(){return 'jv-deck-newlay:'+SCOPE;}
  function layoutById(id){
    var hit=null;
    LAYOUTS.forEach(function(l){if(!hit&&l.id===id) hit=l;});
    return hit;
  }
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
    ['#layout-row','#layout-menu-grid','#layout-strip']
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
          /* ON HOME, A TILE MAKES A SLIDE (T202): the strip is the New
             slide gallery, and changing THIS slide's layout is the
             Design menu's job ("you can't create a new layout with the
             layouts there, you can only change the layout") */
          if(sel==='#layout-strip'){
            if(!layout.poster) lsSet(newLayKey(),layout.id);
            newVersion(layout);
            return;
          }
          var s=pres.slides[cur]; if(!s) return;
          applyLayout(s,layout);
          /* the next New slide takes this layout (T193); a poster
             template is a page, not a slide, and is not remembered */
          if(!layout.poster) lsSet(newLayKey(),layout.id);
          activePane=-1;markDirty();refresh();
          closeLayMenu();
        });
        row.appendChild(b);
      });
    });
      if(typeof syncSavedTiles==='function') syncSavedTiles();
  }
  /* the ribbon's Layouts / Page dropdowns: open one, the other closes.
     The catalog is offered from TWO places now — Design ▸ Layouts and
     Home ▸ Layout — so picking from either has to shut both. */
  function closeLayMenu(){
    [['#lay-menu','#lay-btn']]
      .forEach(function(p){
        var lm=$(p[0]),lb=$(p[1]);
        if(lm&&!lm.hidden){overlayHide(lm);
          if(lb) lb.setAttribute('aria-expanded','false');}
      });
  }
  /* the page size is a strip of tiles now (T190); nothing to close */
  function closePageMenu(){}
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
    var v=String(tokVal(bg)||'').trim();
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
    var v=String(tokVal(bg)||'').trim();
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
    /* slide > master > deck (T115): the slide's own colour still wins,
       the master fills in for every wearer that set none */
    var mbg=(typeof mastOf==='function'&&mastOf(s0)||{}).bg;
    var bg=tokVal((s0&&s0.bg)||mbg||(pres&&pres.pageBg)||'#0b141d');
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
    /* the page-size tile in use is lit (T190) */
    $$('#page-strip .page-tile').forEach(function(o){
      var on=(o.dataset.page===pg.id);
      o.classList.toggle('on',on);
      o.setAttribute('aria-pressed',on.toString());});
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
    ['#anim-clear','#anim-stagger','#anim-together','#anim-strip',
     '#anim-seq','#anim-layers'].forEach(function(id){
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
    /* the 16px of breathing room is an EDITING affordance too -- a page
       floating just clear of the chrome. In playback the page IS the
       screen, so it goes with the stage padding: aw and ah become the
       whole stage, and the 1920x1029 stage that fitted the page at
       1744x981 (88px of dead canvas each side, 24px top and bottom)
       now fits it at 1829x1029 -- full height, no dead height at all. */
    var cs=window.getComputedStyle(stage),gap=(mode==='edit')?16:0;
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
  /* `custom` is the odd one out and defaults ON: the other three are
     furniture you ask for, while your own guides are things you drew and
     would not expect to have to switch back on. It exists so that
     "get these out of my way for a minute" stops meaning "delete them" —
     which was the only way to make a guide go away (2026-08-29). */
  var guides={rulers:false,grid:false,side:false,custom:true};
  try{
    var _g=JSON.parse(localStorage.getItem(GUIDE_KEY)||'{}');
    if(_g&&typeof _g==='object'){
      guides.rulers=!!_g.rulers;guides.grid=!!_g.grid;
      guides.side=!!_g.side;guides.sideSet=!!_g.sideSet;
      if('custom' in _g) guides.custom=!!_g.custom;}
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
  /* HIDDEN MEANS HIDDEN, both halves. Asked in the two places that must
     agree — whether to draw them, and whether they still pull items onto
     themselves — because a guide you cannot see that goes on snapping is
     an invisible magnet, which is worse than either state. It is a way
     of LOOKING at the page, so it lives in the browser's view state
     beside rulers and grid, not in the deck. */
  function guidesShown(){ return guides.custom!==false; }
  function showCustomGuides(on){
    on=!!on;
    if(guidesShown()===on) return;
    guides.custom=on;saveGuides();
    if(typeof syncViewBtns==='function') syncViewBtns();
    syncGuides();
  }
  /* ONE opener for the doors onto the guide-box tool that are not the
     ribbon button (the canvas row, the ruler corner): neither of them
     can rely on the generic `.et` wiring, and neither is only reachable
     while editing. The un-hide lives in setTool, so every door gets it. */
  function armGuideBox(){
    if(mode==='edit') setTool('guide');
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
    if(mode!=='edit'||!guidesShown()||guidesEmpty(cg)){
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
      /* EDGE STRIPS AND CORNERS, not one clickable rectangle. A guide box
         is mostly empty middle, and an element taking pointer events
         across its whole area would swallow every click on the canvas
         beneath it — which, for a box drawn round the figure well, is
         most of the page. The handles are the only part that listens,
         and each one now says in `data-side` which coordinates it owns:
         't'/'r'/'b'/'l' one side, 'tl'…'br' the two they meet at, and
         'move' the grip that takes the whole box. */
      +cg.b.map(function(v,i){
        return '<i class="cg-box'+(v[1]<2.2?' cg-lowgrip':'')
          +'" data-i="'+i+'" style="left:'+v[0]
          +'%;top:'+v[1]+'%;width:'+v[2]+'%;height:'+v[3]+'%">'
          +GB_SIDES.map(function(sd){
            return '<i class="cg-edge cg-e-'+sd+'" data-side="'+sd
              +'"></i>';}).join('')
          +GB_CORNERS.map(function(sd){
            return '<i class="cg-corner cg-c-'+sd+'" data-side="'+sd
              +'"></i>';}).join('')
          +'<i class="cg-grip" data-side="move" title="Drag to move the '
          +'whole box (or hold Alt on any edge)"></i>'
          +'</i>';}).join('');
  }
  var GB_SIDES=['t','r','b','l'],GB_CORNERS=['tl','tr','bl','br'];
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
  /* ONE normaliser for a box that has just been dragged. Rounding to the
     two decimals the model stores was already done in three places; the
     un-flip is new, and is what lets a side be pulled straight through
     its opposite the way every other resize handle in the app behaves.
     A negative width must never reach the model — it would draw nothing
     and snap items to a line left of where the box appears. */
  function gbNorm(b){
    var x=b[0],y=b[1],w=b[2],h=b[3];
    if(w<0){x+=w;w=-w;}
    if(h<0){y+=h;h=-h;}
    return [x,y,w,h].map(function(v){return Math.round(v*100)/100;});
  }
  /* WHAT YOU ARE ACTUALLY MAKING, while you make it. A guide box on a
     poster is a physical area — "the figure well is 380mm across" — and
     until now the only way to learn that number was to draw the box and
     then read it off the ruler. Live only: four permanent labels would
     shout over the layout they describe. */
  function gbTip(i,b,kind){
    var slideEl=stage?stage.querySelector('.slide'):null;
    if(!slideEl) return;
    var el=slideEl.querySelector('.cg-box[data-i="'+i+'"]');
    if(!el) return;
    var t=el.querySelector('.cg-tip');
    if(!t){t=document.createElement('i');t.className='cg-tip';
      el.appendChild(t);}
    el.classList.add('cg-live');
    var mm=pageOf().mm;
    t.textContent=(kind==='pos')
      ?Math.round(b[0]/100*mm[0])+', '+Math.round(b[1]/100*mm[1])+' mm'
      :Math.round(Math.abs(b[2])/100*mm[0])+' \u00d7 '
        +Math.round(Math.abs(b[3])/100*mm[1])+' mm';
  }
  /* cleared by the layer, not by index: the gesture that ends may have
     just deleted the box it was describing, and `data-i` then names a
     different one */
  function gbTipClear(){
    var slideEl=stage?stage.querySelector('.slide'):null;
    if(!slideEl) return;
    $$('.cg-tip',slideEl).forEach(function(t){t.remove();});
    $$('.cg-box.cg-live',slideEl).forEach(function(el){
      el.classList.remove('cg-live');});
  }
  function startGuideBox(layer,p0){
    /* the same invariant, on the other kind of guide. Reached through
       setTool today, which already un-hides -- stated here anyway so
       the rule holds wherever a future door calls it from. */
    showCustomGuides(true);
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
      gbTip(idx,box);
    }
    function up(){
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      if(box[2]<GBOX_MIN||box[3]<GBOX_MIN) cg.b.splice(idx,1);
      else cg.b[idx]=gbNorm(box);
      setCustomGuides(cg);drawCustomGuides(slideEl);gbTipClear();
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
      gbTip(i,cg.b[i],'pos');
    }
    function up(){
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      var b=cg.b[i];
      /* dropped with its middle off the page: that is how a line guide is
         deleted, and a box has no business needing a new gesture */
      var cx=b[0]+b[2]/2,cy=b[1]+b[3]/2;
      if(cx<0||cx>100||cy<0||cy>100) cg.b.splice(i,1);
      else cg.b[i]=gbNorm(b);
      setCustomGuides(cg);drawCustomGuides(slideEl);gbTipClear();
    }
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
  }
  /* RESIZE, one side at a time — the half of a guide box that was never
     built. All four strips ran startGuideBoxMove, so a box could be put
     anywhere and never made to fit anything: you deleted it and drew it
     again (2026-08-29, audit T52). `side` names the coordinates this
     handle owns and nothing else moves — 'l' rewrites x AND w so the
     right edge stays put, 'r' rewrites w alone, and a corner does one of
     each. Pull a side through its opposite and gbNorm un-flips it on the
     way into the model, the way a shape's handles behave. */
  function startGuideBoxResize(ev,i,side){
    ev.preventDefault();
    var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
    var cg=customGuides(),o=cg.b[i];
    if(!o) return;
    o=o.slice();
    var sr=slideEl.getBoundingClientRect();
    var sx=ev.clientX,sy=ev.clientY;
    var west=side.indexOf('l')>=0,east=side.indexOf('r')>=0;
    var north=side.indexOf('t')>=0,south=side.indexOf('b')>=0;
    function mv(e){
      if(!sr.width||!sr.height) return;
      var dx=(e.clientX-sx)/sr.width*100,dy=(e.clientY-sy)/sr.height*100;
      var b=o.slice();
      if(west){b[0]=o[0]+dx;b[2]=o[2]-dx;}
      else if(east){b[2]=o[2]+dx;}
      if(north){b[1]=o[1]+dy;b[3]=o[3]-dy;}
      else if(south){b[3]=o[3]+dy;}
      cg.b[i]=b;
      if(pres) pres.guides=liveGuides(cg);
      drawCustomGuides(slideEl);
      gbTip(i,b);
    }
    function up(){
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      var b=gbNorm(cg.b[i]);
      /* pulled shut. The initial draw treats a box this small as a click
         rather than a drag, and a guide with no area is one you can never
         get hold of again — so the same threshold ends it here. */
      if(b[2]<GBOX_MIN||b[3]<GBOX_MIN) cg.b.splice(i,1);
      else cg.b[i]=b;
      setCustomGuides(cg);drawCustomGuides(slideEl);gbTipClear();
    }
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
  }
  function clearGuides(boxesOnly){
    var cg=customGuides();
    var n=cg.b.length+(boxesOnly?0:cg.x.length+cg.y.length);
    if(!n) return;
    /* ASK, ABOVE ONE. This was a single unconfirmed click that took every
       guide on the poster, and there was no way back at all — guides were
       outside the undo snapshot (2026-08-29, audit T52). Both halves are
       fixed, which is why the question is only asked when it is worth
       asking: one guide is a click you can obviously repeat, a page's
       worth of them is not. */
    if(n>1&&!confirm('Clear '+n+' guides?\n\n'
        +(boxesOnly?'Every guide box on this deck.'
                   :'Every guide box and every line dragged off a ruler.')
        +' Ctrl+Z brings them back.')) return;
    cg.b=[];
    if(!boxesOnly){cg.x=[];cg.y=[];}
    setCustomGuides(cg);
    drawCustomGuides(stage.querySelector('.slide'));
    toast((boxesOnly?'Guide boxes cleared':'Guides cleared')
      +' \u2014 Ctrl+Z brings them back');
  }
  /* drag a NEW guide out of a ruler, or an existing one to move/remove */
  function startGuideDrag(ev,axis,existing){
    ev.preventDefault();
    /* EVERY DOOR THAT LAYS ONE DOWN TURNS THEM BACK ON FIRST.
       setTool covers the guide-BOX tool, but the rulers call this
       directly -- and `guides.custom` and `guides.rulers` are separate
       flags, so Rulers can be on while guides are hidden. In that state
       drawCustomGuides bailed and tore the layer down while up() went
       on committing the guide to pres.guides: the drag looked like it
       had done nothing, so you did it again, and again, and a later
       Show guides revealed a pile of lines you had no memory of
       placing. An invisible line that still pulls items onto itself is
       worse than either state -- which is the rule showCustomGuides was
       written for. Found by the parallel branch's T52 (2026-08-30). */
    showCustomGuides(true);
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
         full-deck stringify + localStorage write + one undo entry, guides
         riding in the snapshot since 2026-08-29) waits for mouseup — the
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
    if(rc) rc.addEventListener('click',armGuideBox);
    if(stage) stage.addEventListener('mousedown',function(e){
      var gb=e.target.closest
        ?e.target.closest('.cg-edge,.cg-corner,.cg-grip'):null;
      if(gb&&gb.parentNode&&gb.parentNode.classList.contains('cg-box')){
        e.stopPropagation();
        var gi=+gb.parentNode.dataset.i,sd=gb.dataset.side;
        /* TWO GESTURES ON ONE BOX, and the handle decides which. The grip
           is the door; Alt or Shift on any handle is the shortcut, for
           the same reason every other drag in the editor has one. */
        if(sd==='move'||e.altKey||e.shiftKey) startGuideBoxMove(e,gi);
        else startGuideBoxResize(e,gi,sd);
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
    var bg=tokVal((pres&&pres.pageBg)||'#0b141d');
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
        var fg=tokVal(a.color)||ink;
        var against=(a.bg!==0&&a.bgc)?tokVal(a.bgc):bg;
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
  /* ---- THE REVIEW CENTRE (T142 / JVUX-09) ---------------------------
     "Is this ready?" had five separately named doors — Check (really
     print preflight), Tidy page, Standardise, Check for drift and
     Export for review — split by implementation history. This pane is
     the one answer: each existing ENGINE runs dry for its count, each
     row's button opens the existing full surface, and nothing was
     rewritten — the detail views keep every fix they have earned.
     T136's owner guarantees the surfaces can no longer stack. */
  function renderReviewPane(){
    var list=$('#reviewpane-list'),head=$('#reviewpane-count');
    if(!list) return;
    list.innerHTML='';
    var total=0;
    function cat(name,scope,count,btnLabel,fn,tip){
      total+=count;
      var row=document.createElement('div');row.className='rv-cat';
      var h=document.createElement('div');h.className='rv-cat-h';
      var nm=document.createElement('span');nm.className='rv-cat-nm';
      nm.textContent=name;h.appendChild(nm);
      var ct=document.createElement('span');
      ct.className='rv-cat-n'+(count?' has':'');
      ct.textContent=count?String(count):'clear';
      h.appendChild(ct);
      row.appendChild(h);
      var sc=document.createElement('div');sc.className='rv-cat-scope';
      sc.textContent=scope;row.appendChild(sc);
      var b=document.createElement('button');
      b.className='dbtn rv-cat-open';b.type='button';
      b.innerHTML=btnLabel;
      if(tip) b.title=tip;
      b.addEventListener('click',function(e){
        e.stopPropagation();fn();});
      row.appendChild(b);
      list.appendChild(row);
    }
    cat('Print & export readiness','this slide',preflight().length,
      bic('flag')+' Open Review',
      function(){paneShow('preflight');renderPreflight();},
      'Soft figures, items off the page or inside the margin, thin '
      +'contrast, empty frames');
    cat('Layout & spacing','this slide',tidyFindings().length,
      bic('align')+' Open Tidy page',
      function(){showTidyPane();},
      'Near-miss alignments, uneven gaps and duplicates');
    var r=standardise();
    cat('Style consistency','whole deck',
      r.findings.length+figLint().length,
      bic('scope')+' Open Mismatched text',
      function(){var b2=$('#dsg-std'); if(b2) b2.click();},
      'Headings, paragraphs, captions and figures that have drifted '
      +'apart \u2014 the Style system\u2019s drift check digs deeper');
    cat('Content & wording','whole deck',reviewLints().length,
      bic('doc')+' Export for review\u2026',
      function(){var b3=$('#mi-review'); if(b3) b3.click();},
      'What the deck SAYS, written out as markdown with its lints '
      +'riding along');
    cat('Source freshness','whole deck',staleFigures().length,
      bic('reload')+' Update figures from their sources',
      function(){var b4=$('#mi-refresh-figs'); if(b4) b4.click();},
      'Placed figures whose notebook or file has moved on \u2014 one '
      +'click re-reads them, keeping position, size and crop');
    if(head) head.textContent=total
      ?(total+' to look at, across five checks')
      :'Five checks, all clear';
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
    var btn=$('#vw-check'),pane=$('#reviewpane');
    if(btn) btn.addEventListener('click',function(){
      if(!pane) return;
      if(pane.hidden){paneShow('reviewpane');renderReviewPane();}
      else paneHide('reviewpane');
    });
    var rvc=$('#reviewpane-close');
    if(rvc) rvc.addEventListener('click',function(){
      paneHide('reviewpane');
    });
    var rvr=$('#reviewpane-rerun');
    if(rvr) rvr.addEventListener('click',renderReviewPane);
    var cl=$('#preflight-close');
    if(cl) cl.addEventListener('click',function(){
      paneHide('preflight');
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
      if(a.color) d.style.color=tokVal(a.color);
      if(a.bg!==0&&a.bgc) d.style.background=tokVal(a.bgc);
    } else if(a.k==='rect'){
      var col=tokVal(a.color)||'#ff6b57';
      d.style.borderColor=col;
      if(a.fill||a.grad) d.style.background=cssFill(a,col);
    } else if(a.k==='arrow'){
      d.classList.add('oh-line');
      d.style.borderColor=tokVal(a.color)||'#ff6b57';
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
    list.innerHTML='';
    /* Deselecting or moving to a title is not deletion. The pane follows
       the current selection now, so give that state its own honest empty
       message instead of claiming the last object disappeared. */
    if(!ohOid){
      if(ttl) ttl.textContent='This object';
      if(head) head.textContent='';
      var empty=document.createElement('div');
      empty.className='pf-ok';
      empty.textContent='Select an object to see its recent history.';
      list.appendChild(empty);
      return;
    }
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
  /* the fit height is taken from what the box is NOW: you set it by
     making the box the size you want and saying "stay this big", which
     is the only version of this anybody can predict. */
  function toggleFit(i){
    var s2=pres.slides[cur];
    var a=s2&&(s2.annots||[])[i];
    if(!a||a.k!=='text') return;
    var l=stage.querySelector('.annot-layer');
    if(a.fit==='shrink'){delete a.fit;}
    else{
      if(!a.fh){
        var r=l?annotRectPct(l,s2,i):null;
        a.fh=r?Math.round((r.b-r.t)*100)/100:12;
      }
      a.fit='shrink';
    }
    markDirty();
    if(l){renderAnnots(l,s2);paintSel(l);}
    toast(a.fit?('Shrinking to fit '+a.fh.toFixed(1)+'% of the page')
      :'Fit off — the box grows with its words again');
  }
  function clearFit(i){
    var s2=pres.slides[cur];
    var a=s2&&(s2.annots||[])[i];
    if(!a) return;
    delete a.fh;delete a.fit;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s2);paintSel(l);}
    toast('Fit height forgotten');
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
    /* selAnnot is the primary (clicked) item. A group's last array member
       is not necessarily that item, so using selIdxs().at(-1) made the
       pane jump to a different group member on its next refresh. */
    var a=s&&typeof selAnnot==='number'&&(s.annots||[])[selAnnot];
    if(!a){toast('Select an object first');return;}
    var pane=$('#objhist'); if(!pane) return;
    paneShow('objhist');
    syncInspectorPanes(true);
  }
  (function(){
    var cl=$('#objhist-close'),rr=$('#objhist-rerun');
    if(rr) rr.addEventListener('click',function(){
      syncInspectorPanes(true);
    });
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
      /* Some fixes remove the selected object without going through
         selectAnnot. Keep every selection-dependent surface honest. */
      showFmt();
      toast(n+' object'+(n===1?'':'s')+' tidied \u2014 Ctrl+Z undoes it');
      renderTidyPane();
    });
    box.appendChild(act);
    return box;
  }
  function renderTidyInto(list,head){
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
  function renderTidyOverview(){
    renderTidyInto($('#tidy-ov-body'),$('#tidy-ov-sub'));
  }
  function renderTidyPane(){
    renderTidyInto($('#tidypane-list'),$('#tidypane-count'));
    var ov=$('#tidy-ov');
    if(ov&&!ov.hidden) renderTidyOverview();
  }
  /* full screen since T209: the pane is still wired for the pane owner,
     but every door opens the view */
  function showTidyPane(){
    var ov=$('#tidy-ov');
    if(ov){
      if(!ov.hidden){overlayHide(ov);return;}
      renderTidyOverview();overlayShow($('#dsg-tidy'),ov);return;
    }
    var pane=$('#tidypane'); if(!pane) return;
    paneShow('tidypane');
    renderTidyPane();
  }
  (function(){
    var cl=$('#tidypane-close');
    if(cl) cl.addEventListener('click',function(){
      var p=$('#tidypane'); if(p) p.hidden=true;
      syncPaneDock();
    });
    var rr=$('#tidypane-rerun');
    if(rr) rr.addEventListener('click',renderTidyPane);
    var open=$('#dsg-tidy');
    if(open) open.addEventListener('click',showTidyPane);
    var ov=$('#tidy-ov');
    var oc=$('#tidy-ov-close');
    if(oc) oc.addEventListener('click',function(){overlayHide(ov);});
    var orr=$('#tidy-ov-rerun');
    if(orr) orr.addEventListener('click',renderTidyOverview);
    if(ov) ov.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('.std-chip'))
        setTimeout(function(){overlayHide(ov);},0);
    });
  })();
