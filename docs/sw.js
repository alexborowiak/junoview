/* The web build's service worker: what makes junoview.com a real,
   installable app that works with no internet.

   One visit caches everything the app needs to boot cold — this page, the
   packaged renderer, the Pyodide runtime and MathJax (fonts included) —
   so every later visit, online or not, serves from disk. The browser's
   "Install app" offer rides on this too; see web-runtime.js for the
   registration and manifest.webmanifest for the identity.

   IN TWO HALVES (2026-10-09 speed pass, load-static #10). The install
   used to download the page a second time under its other name, plus
   Plotly, the MathJax fonts and the example notebook -- about 3 MB that
   most visitors never use, on the first visit, all at once. Now the
   install takes only the app itself (CORE), which the page has just
   downloaded; the rest (WARM) is copied once Python is up, when the page
   asks (the 'warm' message), from what the browser already holds; and
   Plotly is kept the first time a page uses it (pinned() below), so a
   deck that drew a Plotly figure still presents offline. A new build
   takes over the old one's runtime files instead of fetching them again
   (activate), and its own new files at install.

   0a0407f92dcf is replaced by build_web() with a hash of junoview.zip:
   a new build retires the old cache on activate, and an unchanged package
   produces an unchanged worker, so the committed docs/ build stays
   diff-free (same rule as the zip itself). */
var VERSION = '0a0407f92dcf';
var CACHE = 'junoview-' + VERSION;

/* the app itself — if any of these fail to cache, the install fails,
   because an "offline app" that cannot even show itself is a lie. The
   page's stylesheets and scripts are files beside it, named for their
   content (render/static.py); build_web writes their names in at the
   marker. The page is './' and only './': index.html is the same page,
   and an offline navigation to it is answered with './' below. */
var CORE = ['./', 'web-worker.js', 'LICENSE', 'NOTICE',
  'THIRD_PARTY_NOTICES.html', 'manifest.webmanifest', 'icon.svg', 'core.8aa7e1037606dfef.css', 'app.d52c1951a81f55ae.css', 'deck.3a81e33334ede2ca.css', 'icons.5377b0f92bbbc947.js', 'app.63d28a914b60f86b.js', 'pptx.b8b9671325057718.js', 'deck.3f19248d422d2fb0.js'];
/* ...and a content-hashed name can never hold anything else, so a cached
   copy of one is final, like a CDN file: no refresh behind it */
var HASHED_RE = /\.[0-9a-f]{16}\.(css|js|html)$/;

/* the runtime, best-effort: a blocked CDN or a renamed font file must not
   veto anything — the page still loads those live while online.
   The Pyodide version here MUST match the parser's PYODIDE_BASE in
   web-worker.js; bump the two together. */
var PY = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
var MJ = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/';
/* plotly is only ever loaded for notebooks that carry plotly figures,
   so it is kept when one is drawn, not fetched for everyone */
var PLOTLY = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
/* what the offline promise rests on: without these no notebook opens */
var CRITICAL = ['junoview.zip',
  PY + 'pyodide.js', PY + 'pyodide.asm.js', PY + 'pyodide.asm.wasm',
  PY + 'python_stdlib.zip', PY + 'pyodide-lock.json'];
var WARM = CRITICAL.concat([
  MJ + 'tex-chtml.js'
  /* the example, rendered at build ("Try the example" has to work on a
     plane, and needs no Python to), and the notebook itself, which is
     what opens it while another document holds its name (the parser
     picks the next free one) -- served live whenever there is a
     network, see DATA_RE: build_web writes their names in at the
     marker. A build made without the example has none. */
  , 'example_climate_analysis.shell.a9349022b9db1506.html', 'example_climate_analysis.ipynb'
]);
/* MathJax's CHTML fonts load lazily per glyph through @font-face.
   Precaching the known set is what keeps equations rendering offline
   even for a glyph this visit never drew. */
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
  WARM.push(MJ + 'output/chtml/fonts/woff-v2/' + n + '.woff');
});

/* hosts whose responses may be cached. Anything else (GitHub raw
   notebooks, the GitHub API) is live data and passes straight through —
   caching a notebook here would quietly serve stale science. */
var HOSTS = ['cdn.jsdelivr.net', 'cdn.plot.ly'];

/* KEEP: the runtime files pinned to a version in their address -- they
   can never change under it, so a copy is good for as long as the pin
   is. Only these are fetched with CORS in place of a page's plain
   <script> request, carried over from the previous build's cache, or
   kept when the page reports having used them. */
function pinned(u){
  return u.indexOf(PY) === 0 || u.indexOf(MJ) === 0 || u === PLOTLY;
}

/* DATA, not app shell. The host rule above keeps notebooks fetched from
   GitHub out of the cache, but a notebook served from our OWN origin is
   same-origin and would otherwise be cached like a stylesheet — re-run
   the notebook, reopen it, and you would get yesterday's figures.
   webOpenUrl already asks the HTTP cache for no-store; the worker honours
   the same rule: never store these, and fall back to a cached copy only
   when the network is actually gone. */
var DATA_RE = /\.(ipynb|junoview)(\.html)?$/i;

/* WARM's files that belong to this build (no runtime pin in their name) */
function ownWarm(){
  return WARM.filter(function(u){ return !pinned(u); });
}

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(CORE).then(function(){
      /* A NEW BUILD OVER AN OLD ONE: this visitor has the runtime
         already (activate carries it over), so this build's own share
         of the offline copy -- the renderer, the example -- comes now,
         while the old build still serves the page, and the app works
         offline straight after the update. A first visit leaves it to
         the page's 'warm', after Python. */
      return caches.keys().then(function(keys){
        var update = keys.some(function(k){
          return k.indexOf('junoview-') === 0 && k !== CACHE;
        });
        if(!update) return;
        return Promise.all(ownWarm().map(function(u){
          return c.add(u).catch(function(){});
        }));
      });
    });
  }).then(function(){ return self.skipWaiting(); }));
});

/* a new build keeps the old build's pinned runtime files (nothing about
   them changed: their version is in their name) and drops the rest */
function carryOver(oldName, c){
  return caches.open(oldName).then(function(old){
    return old.keys().then(function(reqs){
      return Promise.all(reqs.filter(function(r){
        return pinned(r.url);
      }).map(function(r){
        return c.match(r).then(function(have){
          if(have) return;
          return old.match(r).then(function(res){
            if(res) return c.put(r, res);
          });
        });
      }));
    });
  }).catch(function(){});
}

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    var old = keys.filter(function(k){
      return k.indexOf('junoview-') === 0 && k !== CACHE;
    });
    return caches.open(CACHE).then(function(c){
      return Promise.all(old.map(function(k){
        return carryOver(k, c).then(function(){ return caches.delete(k); });
      }));
    });
  }).then(function(){ return self.clients.claim(); }));
});

/* the second half of the install, asked for by the page once Python is
   up. Best-effort per file; the answer says whether everything a
   notebook needs to open offline is now held. */
self.addEventListener('message', function(e){
  var d = e.data || {};
  if(d.type !== 'warm') return;
  var port = e.ports && e.ports[0];
  var used = (d.used || []).filter(function(u){
    return typeof u === 'string' && pinned(u.split('#')[0]);
  });
  var want = WARM.concat(used);
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(want.map(function(u){
      return c.match(u).then(function(hit){
        if(hit) return true;
        return c.add(u).then(function(){ return true; },
          function(){ return false; });
      });
    })).then(function(got){
      var ok = CRITICAL.every(function(u){ return got[want.indexOf(u)]; });
      if(port) port.postMessage({type: 'warmed', ok: ok});
    });
  }));
});

/* A pinned runtime file the page asks for without CORS (a plain
   <script> tag: Plotly, MathJax) gets an opaque answer, which is never
   kept -- it carries a multi-megabyte quota padding. Asked again with
   CORS it is an ordinary response that can be; the page runs it the
   same. If the CDN ever refuses that, the page's own request goes
   through untouched. */
function fetchFor(req, mine){
  if(!mine && req.mode === 'no-cors' && pinned(req.url))
    return fetch(new Request(req.url, {mode: 'cors', credentials: 'omit'}))
      .catch(function(){ return fetch(req); });
  return fetch(req);
}

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
      if(hit && (!mine || HASHED_RE.test(url.pathname))) return hit;
      var refresh = fetchFor(req, mine).then(function(res){
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
