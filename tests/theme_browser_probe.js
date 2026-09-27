(function(){
  'use strict';

  var SCHEMES=[
    ['dark',''],
    ['light','light'],
    ['forest','th-forest'],
    ['forest-light','light th-lforest'],
    ['forest-blue','th-forestblue'],
    ['colourful','th-colorful'],
    ['contrast-dark','th-contrast'],
    ['warm','light th-warm'],
    ['navy','th-navy'],
    ['purple','th-purple'],
    ['dim','th-dim'],
    ['contrast-light','light th-lcontrast']
  ];
  var ALL_CLASSES=[
    'light','th-forest','th-lforest','th-forestblue','th-colorful',
    'th-contrast','th-warm','th-navy','th-purple','th-dim','th-lcontrast'
  ];
  var SURFACES=[
    ['reader','.card h3','.card'],
    ['welcome','.welcome-tag','.welcome-box'],
    ['menu','.dc-mi','.dc-menu'],
    ['dialog','.odlg-path','.odlg-box'],
    ['variables','#varspane','#varspane'],
    ['tree','.tn-title','.tree-node'],
    ['editor','.rbn-tab','.edit-tools']
  ];

  function applyScheme(id){
    var found=SCHEMES.filter(function(s){return s[0]===id;})[0]||SCHEMES[0];
    var want=found[1]?found[1].split(' '):[];
    ALL_CLASSES.forEach(function(name){
      document.body.classList.toggle(name,want.indexOf(name)>=0);
    });
  }
  function rgba(value){
    var parts=value.match(/[\d.]+/g)||[];
    if(value.indexOf('color(srgb')===0){
      return [+(parts[0]||0)*255,+(parts[1]||0)*255,
        +(parts[2]||0)*255,parts[3]===undefined?1:+parts[3]];
    }
    return [+(parts[0]||0),+(parts[1]||0),+(parts[2]||0),
      parts[3]===undefined?1:+parts[3]];
  }
  function blend(front,back){
    var alpha=front[3]+back[3]*(1-front[3]);
    if(!alpha) return [0,0,0,0];
    return [
      (front[0]*front[3]+back[0]*back[3]*(1-front[3]))/alpha,
      (front[1]*front[3]+back[1]*back[3]*(1-front[3]))/alpha,
      (front[2]*front[3]+back[2]*back[3]*(1-front[3]))/alpha,
      alpha
    ];
  }
  function background(element){
    var colour=[0,0,0,0];
    for(var node=element;node;node=node.parentElement){
      colour=blend(colour,rgba(getComputedStyle(node).backgroundColor));
      if(colour[3]>.999) break;
    }
    return colour[3]>.999?colour:blend(colour,[255,255,255,1]);
  }
  function luminance(colour){
    var weight=[.2126,.7152,.0722];
    return colour.slice(0,3).map(function(value){
      value/=255;
      return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);
    }).reduce(function(total,value,index){
      return total+value*weight[index];
    },0);
  }
  function contrast(first,second){
    var a=luminance(first),b=luminance(second);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  }
  function buildTree(){
    if(document.querySelector('.tree-node')) return;
    var button=document.querySelector('#view-tree');
    if(button) button.click();
  }
  function check(){
    buildTree();
    var failures=[];
    SCHEMES.forEach(function(scheme){
      applyScheme(scheme[0]);
      SURFACES.forEach(function(surface){
        var foreground=document.querySelector(surface[1]);
        var ground=document.querySelector(surface[2]);
        if(!foreground||!ground){
          failures.push(scheme[0]+' / '+surface[0]+' is missing');
          return;
        }
        var ratio=contrast(
          rgba(getComputedStyle(foreground).color),background(ground));
        if(ratio<4.5){
          failures.push(scheme[0]+' / '+surface[0]+' = '+ratio.toFixed(2));
        }
      });
    });
    return failures;
  }
  function status(failures){
    var marker=document.createElement('div');
    marker.id='theme-matrix-status';
    marker.title=failures.join('\n');
    marker.style.cssText='position:fixed;inset:0 auto auto 0;width:64px;'
      +'height:64px;z-index:2147483647;background:'
      +(failures.length?'#ff0000':'#00ff00');
    document.body.appendChild(marker);
  }
  function sample(id){
    applyScheme(id);
    buildTree();
    var picks=[
      ['Reader','.card'],['Welcome','.welcome-id'],['Menu','.dc-menu'],
      ['Dialog','.odlg-box'],['Variables','.varpanel'],
      ['Tree / trace','.tree-node'],['Editor','.edit-tools']
    ];
    var nodes=picks.map(function(pick){
      var source=document.querySelector(pick[1]);
      return [pick[0],source&&source.cloneNode(true)];
    });
    document.body.innerHTML='';
    document.body.classList.add('theme-sample');
    var heading=document.createElement('h1');
    heading.textContent=id;
    document.body.appendChild(heading);
    var grid=document.createElement('main');
    grid.className='theme-sample-grid';
    nodes.forEach(function(pair){
      var section=document.createElement('section');
      var label=document.createElement('h2');label.textContent=pair[0];
      section.appendChild(label);
      if(pair[1]){
        pair[1].hidden=false;
        pair[1].style.display='';
        section.appendChild(pair[1]);
      }
      grid.appendChild(section);
    });
    document.body.appendChild(grid);
    var style=document.createElement('style');
    style.textContent='body.theme-sample{margin:0;padding:14px;overflow:hidden;'
      +'background:var(--paper-2);color:var(--ink);font-family:var(--sans)}'
      +'.theme-sample>h1{font:700 18px var(--sans);margin:0 0 10px}'
      +'.theme-sample-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
      +'.theme-sample-grid>section{min-width:0;height:150px;overflow:hidden;'
      +'border:1px solid var(--line);border-radius:8px;background:var(--paper);'
      +'padding:8px;position:relative}'
      +'.theme-sample-grid>section>h2{font:700 9px var(--mono);'
      +'letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);'
      +'margin:0 0 6px}'
      +'.theme-sample .card{opacity:1;transform:none;margin:0;padding:10px;'
      +'box-shadow:none}.theme-sample .card-tools{display:none}'
      +'.theme-sample .welcome-id{padding:6px}.theme-sample .welcome-hero{'
      +'font-size:18px}.theme-sample .welcome-wordmark{font-size:16px}'
      +'.theme-sample .dc-menu{display:flex!important;position:static;'
      +'width:auto;box-shadow:none}.theme-sample .odlg-box{width:auto;height:110px;'
      +'border-radius:6px}.theme-sample .varpanel{display:block!important;'
      +'max-height:112px;overflow:hidden}.theme-sample .tree-node{width:auto}'
      +'.theme-sample .edit-tools{display:flex!important;position:static;'
      +'width:900px;height:112px;overflow:hidden}.theme-sample .rbn-tabs{'
      +'display:flex!important}';
    document.head.appendChild(style);
  }

  var failures=check();
  window.themeMatrixResult={failures:failures};
  var sampleId=new URLSearchParams(location.search).get('sample');
  if(sampleId) sample(sampleId);
  else status(failures);
})();
