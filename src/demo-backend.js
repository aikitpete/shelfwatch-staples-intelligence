/* Demo backend: same small API the app uses from Claude's artifact runtime
   (db.collection().onSnapshot, db.doc().get/set/update/delete/onSnapshot),
   served from static JSON in data/demo/<collection>.json. Edits live only in this
   browser (localStorage) so the shared demo data can never be changed by visitors. */
(function(){
  var KEY='shelfwatch.demo.v1', BASE=(window.SHELFWATCH_DATA||'data/demo/');
  var COLS=['items','retailers','prices','checks','knowledge','programs','source_register','meta'];
  var M=null, subs=[], ready=null;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(M))}catch(e){}}
  function load(){
    if(ready)return ready;
    ready=(async function(){
      try{var t=localStorage.getItem(KEY);if(t){M=JSON.parse(t);return}}catch(e){}
      M={};
      await Promise.all(COLS.map(async function(c){
        try{var r=await fetch(BASE+c+'.json');M[c]=r.ok?await r.json():{}}catch(e){M[c]={}}
      }));
    })();
    return ready;
  }
  function snap(c){var o=M[c]||{};return {docs:Object.keys(o).map(function(id){return {id:id,data:function(){return JSON.parse(JSON.stringify(o[id]))}}})}}
  function dsnap(c,id){var d=(M[c]||{})[id];return {id:id,exists:!!d,data:function(){return d?JSON.parse(JSON.stringify(d)):undefined}}}
  function notify(c,id){subs.forEach(function(s){if(s.c===c&&(s.id==null||s.id===id))s.fn(s.id==null?snap(c):dsnap(c,id))})}
  function strip(o){var r={};for(var k in o){var v=o[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&v.__delete__)continue;r[k]=v}return r}
  var db={
    collection:function(c){return {onSnapshot:function(fn){var s={c:c,id:null,fn:fn};subs.push(s);load().then(function(){fn(snap(c))});return function(){subs=subs.filter(function(x){return x!==s})}}}},
    doc:function(path){var p=path.split('/'),c=p[0],id=p.slice(1).join('/');return {
      onSnapshot:function(fn){var s={c:c,id:id,fn:fn};subs.push(s);load().then(function(){fn(dsnap(c,id))});return function(){subs=subs.filter(function(x){return x!==s})}},
      get:async function(){await load();return dsnap(c,id)},
      set:async function(d){await load();(M[c]=M[c]||{})[id]=strip(d);save();notify(c,id)},
      update:async function(d){await load();var o=(M[c]=M[c]||{});o[id]=Object.assign({},o[id]||{},strip(d));save();notify(c,id)},
      delete:async function(){await load();if(M[c])delete M[c][id];save();notify(c,id)}}}
  };
  window.__shelfwatchBackend={use:async function(n){
    if(n==='db')return db;
    if(n==='user')return {can:function(){return true}};
    if(n==='downloads')return {save:async function(f){var b=new Blob([f.content||f.data||''],{type:f.type||'text/plain'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=f.name||'shelfwatch.txt';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);return {status:'saved'}}};
    return null; /* sample (photo reading) and assets are Claude-only */
  }};
  document.addEventListener('DOMContentLoaded',function(){
    var b=document.createElement('div');
    b.style.cssText='position:fixed;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);z-index:40;display:flex;justify-content:center;pointer-events:none';
    b.innerHTML='<span style="pointer-events:auto;background:#1F4FCC;color:#fff;font:600 12px system-ui;padding:6px 12px;border-radius:999px">Demo data · edits stay in this browser · <a href="#" id="sw-reset" style="color:#fff">Reset</a></span>';
    document.body.appendChild(b);
    document.getElementById('sw-reset').onclick=function(e){e.preventDefault();try{localStorage.removeItem(KEY)}catch(x){}location.reload()};
  });
})();
