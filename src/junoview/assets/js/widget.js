
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

/* the chrome icon set. There is no page build here, so widget.py ships
   branding.py's icons_map() inside the synced `data` dict (key -> the
   same <svg class="bic"> markup the app's templates expand to); mount()
   refreshes the module map from the model. Soft on absence: an older
   model without the map gets the callers' text fallbacks. */
let _icnMap={};
function bic(k){return _icnMap[k]||'';}

function control(p){
  const lbl='<span class="cl">'+esc(p.name)+'</span>';
  if(p.type==='range')
    return '<label class="ctl">'+lbl+'<input data-p="'+esc(p.name)+'" type="range" min="'
      +p.min+'" max="'+p.max+'" step="'+(p.step||'any')+'" value="'+p.value
      +'"><output data-out="'+esc(p.name)+'">'+esc(p.value)+'</output></label>';
  if(p.type==='number')
    return '<label class="ctl">'+lbl+'<input data-p="'+esc(p.name)
      +'" type="number" step="'+(p.step||'any')+'" value="'+esc(p.value)+'"></label>';
  if(p.type==='select')
    return '<label class="ctl">'+lbl+'<select data-p="'+esc(p.name)+'">'
      +(p.options||[]).map(o=>'<option'+(String(o)===String(p.value)?' selected':'')
        +'>'+esc(o)+'</option>').join('')+'</select></label>';
  if(p.type==='checkbox')
    return '<label class="ctl ctl-cb"><input data-p="'+esc(p.name)+'" type="checkbox"'
      +(p.value?' checked':'')+'>'+lbl+'</label>';
  return '<label class="ctl">'+lbl+'<input data-p="'+esc(p.name)
    +'" type="text" value="'+esc(p.value)+'"></label>';
}

function shell(model){
  const d=model.get('data'); const t=esc(d.title), m=esc(d.meta);
  return '<div class="shell">'
    +'<aside class="rail"><div class="railhead"><p class="brand">semantic notebook</p>'
    +'<h1 class="railtitle">'+t+'</h1><div class="railmeta">'+m+'</div></div>'
    +(d.nav_html||'')+(d.graph_panel||'')+'</aside>'
    +'<main class="stage"><div class="toolbar"><span class="tb-title">'+t+'</span>'
    +'<div class="tb-actions">'
    +'<select class="toggle tb-layout" data-layout-select>'
    +'<option value="column">Column</option><option value="grid">Grid</option>'
    +'<option value="compact">Compact</option></select>'
    +'<button class="toggle" data-figs aria-pressed="false"><span class="tdot"></span>Figures only</button>'
    +'<button class="toggle" data-code aria-pressed="false"><span class="tdot"></span>All code</button>'
    +'<button class="toggle" data-hidden hidden><span class="tdot"></span>Hidden <span data-hidden-n></span></button>'
    +'</div></div><div class="hidden-menu" data-hidden-menu></div>'
    +'<div class="content" data-content>'+(d.stage_html||'')+'</div></main></div>';
}

function mount(model, el){
  _icnMap=(model.get('data')||{}).icons||{};
  el.innerHTML='';
  const root=document.createElement('div');
  root.className='snb-root';
  root.style.setProperty('--snb-h', (model.get('height')||760)+'px');
  root.innerHTML=shell(model);
  el.appendChild(root);

  const $=(s,r)=>(r||root).querySelector(s);
  const $$=(s,r)=>Array.prototype.slice.call((r||root).querySelectorAll(s));
  const content=$('[data-content]');

  function vs(){return Object.assign({hidden:[],layout:'column',railCollapsed:false},
    model.get('view_state')||{});}
  function saveVs(p){const v=Object.assign(vs(),p);model.set('view_state',v);
    model.save_changes();}

  const state=vs();
  content.setAttribute('data-layout', state.layout||'column');
  const layoutSel=$('[data-layout-select]');
  if(layoutSel) layoutSel.value=state.layout||'column';
  if(state.railCollapsed){const rg=$('.railgraph');
    if(rg){rg.classList.add('collapsed');const b=$('.rg-collapse');
      if(b){b.textContent='+';b.setAttribute('aria-expanded','false');}}}

  function scrollTo(t){content.scrollTo({top:t.offsetTop-content.offsetTop-8,
    behavior:'smooth'});}
  function flash(c){c.classList.add('target-flash');
    setTimeout(()=>c.classList.remove('target-flash'),1300);}

  // hide buttons + restore the hidden set
  $$('.card').forEach(card=>{
    const head=$('.cardhead',card);
    if(head && !$('.hidebtn',head)){
      const b=document.createElement('button');
      /* the eye, not a ✕ — ✕ means CLOSE everywhere else in this app;
         hiding is the eye, same as the static page's card chrome */
      b.className='hidebtn'; b.title='Hide card';
      b.innerHTML=bic('eye')||'&#x2715;';
      b.addEventListener('click',()=>{card.classList.add('is-hidden');
        const h=new Set(vs().hidden); h.add(card.id.slice(5));
        saveVs({hidden:[...h]}); refreshHidden();});
      head.appendChild(b);
    }
  });
  (state.hidden||[]).forEach(id=>{const c=$('.card[id="card-'+id+'"]');
    if(c)c.classList.add('is-hidden');});

  const hiddenBtn=$('[data-hidden]'), hiddenMenu=$('[data-hidden-menu]');
  function refreshHidden(){
    const ids=vs().hidden||[];
    $('[data-hidden-n]').textContent=ids.length?('('+ids.length+')'):'';
    if(hiddenBtn) hiddenBtn.hidden=ids.length===0;
    if(hiddenMenu){
      hiddenMenu.innerHTML=ids.length? ids.map(id=>{
        const c=$('.card[id="card-'+id+'"]');
        const t=c?((($('.cardtitle',c)||{}).textContent)||id):id;
        return '<div class="hidrow"><span>'+esc(t)
          +'</span><button data-restore="'+esc(id)+'">Restore</button></div>';
      }).join(''):'<div class="hidempty">nothing hidden</div>';
      $$('[data-restore]',hiddenMenu).forEach(b=>b.addEventListener('click',()=>{
        const id=b.getAttribute('data-restore');
        const c=$('.card[id="card-'+id+'"]'); if(c)c.classList.remove('is-hidden');
        const h=new Set(vs().hidden); h.delete(id);
        saveVs({hidden:[...h]}); refreshHidden();}));
    }
  }
  if(hiddenBtn){hiddenBtn.addEventListener('click',()=>hiddenMenu.classList.toggle('open'));
    refreshHidden();}

  if(layoutSel) layoutSel.addEventListener('change',()=>{
    content.setAttribute('data-layout',layoutSel.value);
    saveVs({layout:layoutSel.value});});

  $$('.codetoggle').forEach(btn=>btn.addEventListener('click',()=>{
    const w=btn.closest('.codewrap'); const open=w.hasAttribute('data-open');
    if(open){w.removeAttribute('data-open');btn.setAttribute('aria-expanded','false');}
    else{w.setAttribute('data-open','');btn.setAttribute('aria-expanded','true');}}));

  const codeBtn=$('[data-code]');
  if(codeBtn) codeBtn.addEventListener('click',()=>{
    const on=codeBtn.getAttribute('aria-pressed')==='true';
    codeBtn.setAttribute('aria-pressed',String(!on));
    $$('.codewrap').forEach(w=>{if(!on)w.setAttribute('data-open','');
      else w.removeAttribute('data-open');
      const b=$('.codetoggle',w); if(b)b.setAttribute('aria-expanded',String(!on));});});

  const figBtn=$('[data-figs]');
  if(figBtn) figBtn.addEventListener('click',()=>{
    const on=figBtn.getAttribute('aria-pressed')==='true';
    figBtn.setAttribute('aria-pressed',String(!on));
    $$('.card').forEach(c=>{const k=c.dataset.kind;
      c.classList.toggle('filtered-out', !on && !(k==='figure'||k==='diagnostic'));});});

  const rgBtn=$('.rg-collapse');
  if(rgBtn) rgBtn.addEventListener('click',()=>{
    const rg=rgBtn.closest('.railgraph'); const c=rg.classList.toggle('collapsed');
    rgBtn.setAttribute('aria-expanded',String(!c)); rgBtn.textContent=c?'+':'\u2013';
    saveVs({railCollapsed:c});});

  $$('.navitem,.navsec').forEach(a=>a.addEventListener('click',e=>{
    const href=a.getAttribute('href');
    if(href && href[0]==='#'){e.preventDefault();
      const t=$('[id="'+href.slice(1)+'"]'); if(t)scrollTo(t);}}));

  $$('.provnode').forEach(g=>{
    const go=()=>{const c=$('.card[id="card-'+g.getAttribute('data-target')+'"]');
      if(c){scrollTo(c);flash(c);}};
    g.addEventListener('click',go);
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});

  $$('.depchip').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();
    const c=$('.card[data-node="'+a.getAttribute('data-dep')+'"]');
    if(c){scrollTo(c);flash(c);}}));

  const cards=$$('.card');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),
      {root:content,rootMargin:'0px 0px -6% 0px',threshold:0.04});
    cards.forEach(c=>io.observe(c));
    const navItems={},navSecs={},graphNodes={};
    $$('.navitem').forEach(a=>navItems[a.dataset.item]=a);
    $$('.navsec').forEach(a=>navSecs[a.dataset.sec]=a);
    $$('.provnode').forEach(g=>graphNodes[g.dataset.node]=g);
    const vis={};
    const spy=new IntersectionObserver(es=>{
      es.forEach(e=>{if(e.isIntersecting)vis[e.target.id]=e.intersectionRatio;
        else delete vis[e.target.id];});
      let best=null,br=-1;
      Object.keys(vis).forEach(k=>{if(vis[k]>=br){br=vis[k];best=k;}});
      if(best){const item=best.slice(5);
        $$('.navitem.active').forEach(a=>a.classList.remove('active'));
        if(navItems[item])navItems[item].classList.add('active');
        const card=$('.card[id="'+best+'"]'); const sec=card&&card.closest('.section');
        $$('.navsec.active').forEach(a=>a.classList.remove('active'));
        if(sec&&navSecs[sec.dataset.sec])navSecs[sec.dataset.sec].classList.add('active');
        const nodeId=card?card.dataset.node:'';
        $$('.provnode.active').forEach(g=>g.classList.remove('active'));
        $$('.provedge.lit').forEach(p=>p.classList.remove('lit'));
        if(nodeId&&graphNodes[nodeId]){graphNodes[nodeId].classList.add('active');
          $$('.provedge').forEach(p=>{if(p.dataset.to===nodeId||p.dataset.from===nodeId)
            p.classList.add('lit');});}}
    },{root:content,rootMargin:'-10% 0px -55% 0px',threshold:[0,0.25,0.6,1]});
    cards.forEach(c=>spy.observe(c));
  } else cards.forEach(c=>c.classList.add('in'));

  // recompute controls
  const rc=(model.get('data')||{}).recompute||{};
  Object.keys(rc).forEach(id=>{
    const card=$('.card[id="card-'+id+'"]'); if(!card)return;
    const spec=rc[id].params||[];
    const strip=document.createElement('div'); strip.className='controls';
    strip.innerHTML=spec.map(control).join('')
      +'<button class="recbtn" data-run>Recompute</button>'
      +'<span class="recstatus" data-status></span>';
    const head=$('.cardhead',card); head.insertAdjacentElement('afterend',strip);
    function gather(){const out={};spec.forEach(p=>{
      const inp=$('[data-p="'+p.name+'"]',strip); if(!inp)return;
      if(p.type==='checkbox')out[p.name]=inp.checked;
      else if(p.type==='range'||p.type==='number')out[p.name]=inp.valueAsNumber;
      else out[p.name]=inp.value;}); return out;}
    let timer=null;
    function run(){card.classList.add('recomputing');
      const st=$('[data-status]',strip); if(st)st.textContent='recomputing\u2026';
      model.send({type:'recompute',id:id,params:gather()});}
    $$('input,select',strip).forEach(inp=>{
      inp.addEventListener('input',()=>{const o=$('output[data-out="'+inp.dataset.p+'"]',strip);
        if(o)o.textContent=inp.value;});
      inp.addEventListener('change',()=>{clearTimeout(timer);timer=setTimeout(run,200);});});
    const runBtn=$('[data-run]',strip); if(runBtn)runBtn.addEventListener('click',run);
  });

  model.on('msg:custom',msg=>{
    if(!msg||msg.type!=='recomputed')return;
    const card=$('.card[id="card-'+msg.id+'"]'); if(!card)return;
    const body=$('.cardbody',card); if(body)body.innerHTML=msg.output_html;
    card.classList.remove('recomputing');
    const st=$('[data-status]',card); if(st)st.textContent='';});
}

function render({model, el}){
  mount(model, el);
  const cb=()=>mount(model, el);
  model.on('change:data', cb);
  model.on('change:height', cb);
  return ()=>{model.off('change:data', cb); model.off('change:height', cb);};
}
export default { render };
