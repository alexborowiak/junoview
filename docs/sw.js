/* The web build's service worker: what makes junoview.com a real,
   installable app that works with no internet.

   One visit caches everything the app needs to boot cold — this page, the
   packaged renderer, the Pyodide runtime and MathJax (fonts included) —
   so every later visit, online or not, serves from disk. The browser's
   "Install app" offer rides on this too; see web-loader.html for the
   registration and manifest.webmanifest for the identity.

   058da59d067e is replaced by build_web() with a hash of junoview.zip:
   a new build retires the old cache on activate, and an unchanged package
   produces an unchanged worker, so the committed docs/ build stays
   diff-free (same rule as the zip itself). */
var VERSION = '058da59d067e';
var CACHE = 'junoview-' + VERSION;

/* the app itself — if any of these fail to cache, the install fails,
   because an "offline app" missing its renderer is a lie */
var CORE = ['./', 'index.html', 'junoview.zip',
  'manifest.webmanifest', 'icon.svg'];

/* the runtime, best-effort: a blocked CDN or a renamed font file must not
   veto the install — the page still loads those live while online.
   The Pyodide version here MUST match the loader's script tag in
   web-loader.html; bump the two together. */
var PY = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
var MJ = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/';
var RUNTIME = [
  PY + 'pyodide.js', PY + 'pyodide.asm.js', PY + 'pyodide.asm.wasm',
  PY + 'python_stdlib.zip', PY + 'pyodide-lock.json',
  MJ + 'tex-chtml.js',
  /* plotly is only ever loaded for notebooks that carry plotly figures,
     but a deck with one should still present offline */
  'https://cdn.plot.ly/plotly-2.35.2.min.js',
  /* the demo notebook is part of the offline story ("Try the example"
     has to work on a plane). It is the ONE notebook allowed in the
     cache, and only as an offline fallback — see DATA_RE below, which
     still fetches it live whenever there is a network. Best-effort:
     a build made without the example must not fail to install. */
  'example_climate_analysis.ipynb'
];
/* MathJax's CHTML fonts load lazily per glyph through @font-face, which
   the page fetches as no-cors — opaque responses we refuse to cache at
   runtime (they carry a multi-megabyte quota padding each). Precaching
   the known set with proper CORS requests is what keeps equations
   rendering offline. */
['MathJax_AMS-Regular', 'MathJax_Calligraphic-Bold',
  'MathJax_Calligraphic-Regular', 'MathJax_Fraktur-Bold',
  'MathJax_Fraktur-Regular', 'MathJax_Main-Bold', 'MathJax_Main-Italic',
  'MathJax_Main-Regular', 'MathJax_Math-BoldItalic', 'MathJax_Math-Italic',
  'MathJax_Math-Regular', 'MathJax_SansSerif-Bold',
  'MathJax_SansSerif-Italic', 'MathJax_SansSerif-Regular',
  'MathJax_Script-Regular', 'MathJax_Size1-Regular',
  'MathJax_Size2-Regular', 'MathJax_Size3-Regular',
  'MathJax_Size4-Regular', 'MathJax_Typewriter-Regular',
  'MathJax_Vector-Bold', 'MathJax_Vector-Regular', 'MathJax_Zero'
].forEach(function(n){
  RUNTIME.push(MJ + 'output/chtml/fonts/woff-v2/' + n + '.woff');
});

/* hosts whose responses may be cached. Anything else (GitHub raw
   notebooks, the GitHub API) is live data and passes straight through —
   caching a notebook here would quietly serve stale science. */
var HOSTS = ['cdn.jsdelivr.net', 'cdn.plot.ly'];

/* DATA, not app shell. The host rule above keeps notebooks fetched from
   GitHub out of the cache, but a notebook served from our OWN origin is
   same-origin and would otherwise be cached like a stylesheet — re-run
   the notebook, reopen it, and you would get yesterday's figures.
   webOpenUrl already asks the HTTP cache for no-store; the worker honours
   the same rule: never store these, and fall back to a precached copy
   (the bundled example) only when the network is actually gone. */
var DATA_RE = /\.(ipynb|junoview)(\.html)?$/i;

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(CORE).then(function(){
      return Promise.all(RUNTIME.map(function(u){
        return c.add(u).catch(function(){});
      }));
    });
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){
      if(k.indexOf('junoview-') === 0 && k !== CACHE)
        return caches.delete(k);
    }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.protocol !== 'https:' && url.protocol !== 'http:') return;
  var mine = url.origin === self.location.origin;
  if(!mine && HOSTS.indexOf(url.hostname) < 0) return;
  e.respondWith(caches.open(CACHE).then(function(c){
    return c.match(req).then(function(hit){
      /* a notebook or saved deck: always the live copy, never stored */
      if(DATA_RE.test(url.pathname))
        return fetch(req).catch(function(){
          return hit || Response.error();
        });
      /* CDN files are version-stamped in their URLs: a hit is final.
         Our own files can change under the same name, so a hit serves
         instantly and refreshes behind it for the NEXT visit. */
      if(hit && !mine) return hit;
      var refresh = fetch(req).then(function(res){
        if(res && res.ok) c.put(req, res.clone());
        return res;
      });
      if(hit){
        e.waitUntil(refresh.catch(function(){}));
        return hit;
      }
      return refresh.catch(function(){
        /* offline and uncached: a navigation still deserves the app */
        if(req.mode === 'navigate') return c.match('./');
        return Response.error();
      });
    });
  }));
});
