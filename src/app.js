
/*__SCHEMA__*/
/*__CONFIG__*/
(function(){
'use strict';
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Countries, currencies and shop priorities come from SW_CONFIG (injected by scripts/build.py), never from code. */
const CFG=window.SW_CONFIG||{countries:{US:{name:'United States',cur:'USD'}},currencies:{EUR:{sym:'€',dec:2},USD:{sym:'$',dec:2}},home:'US'};
const COUNTRIES=CFG.countries;
const CURS=Object.assign({EUR:{sym:'€',dec:2}},CFG.currencies||{});
const CUR=Object.fromEntries(Object.entries(CURS).map(([k,v])=>[k,v.sym||k]));
const CODES=Object.keys(COUNTRIES),HOME=CFG.home&&COUNTRIES[CFG.home]?CFG.home:CODES[0];
const FXCUR=Object.keys(CURS).filter(c=>c!=='EUR');
const NAMES=(()=>{const n=CODES.map(c=>COUNTRIES[c].name);return n.length>1?n.slice(0,-1).join(', ')+' and '+n[n.length-1]:n[0]})();
const QCUR=Object.keys(CURS).map(c=>'"'+c+'"').join('|'),QCTY=CODES.map(c=>'"'+c+'"').join('|');
const HIDDEN_DEFAULT=new Set(CFG.hiddenByDefault||[]),STORE_PRIO=CFG.storePriority||[];
const UNITS={g:['kg',1000],kg:['kg',1],ml:['l',1000],l:['l',1],pc:['pc',1],m:['100 m',100],sheet:['500 sheets',500]};
const BASE_UNITS={kg:['g','kg'],l:['ml','l'],pc:['pc'],'100 m':['m'],'500 sheets':['sheet']};
const SRC={paste:'Pasted text',dataset:'Dataset',import:'PDF import',research:'Research',photo:'Photo',manual:'Manual'};
const CATS=['Food','Household','Skincare','Dental','Grooming'];
let PREF={};try{PREF=JSON.parse(localStorage.getItem('sw.inc')||'{}')||{}}catch(x){}
const S={ex:new Set(),fOpen:false,br:{t:'prices',q:'',json:false},country:HOME,tab:'compare',q:'',cat:'All',open:new Set(),items:new Map(),retailers:new Map(),prices:[],checks:[],fx:null,auto:null,daily:false,reorder:false,org:'',kn:[],prog:[],src:[],store:'',cOpen:false,sOpen:false,hereBest:false,
  db:null,sample:null,assets:null,downloads:null,canWrite:true,imgOK:false,D:null,loaded:0,photo:null};
try{const h=localStorage.getItem('sw.home');if(h)S.home=h}catch(e){}
try{const c=localStorage.getItem('sw.c2');if(c&&(c==='ALL'||COUNTRIES[c]))S.country=c}catch(e){}

/* ---------- helpers ---------- */
const rate=c=>c==='EUR'?1:((S.fx&&S.fx.rates&&S.fx.rates[c])||null);
const toEur=(c,v)=>{if(v==null)return null;const r=rate(c);return r?v/r:null};
const home=()=>S.home&&rate(S.home)?S.home:'EUR';
const mh=v=>(v==null||!isFinite(v))?'—':money(home(),v*rate(home()));
function money(cur,v){
  if(v==null||!isFinite(v))return '—';
  const dc=(CURS[cur]||{}).dec;let d=dc!=null?dc:(Math.abs(v)>=100?0:2);
  return (CUR[cur]||cur+' ')+v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
}
const calcUnit=(a,s,u)=>(a>0&&s>0&&UNITS[u])?a/(s/UNITS[u][1]):null;
const slug=s=>(String(s).toLowerCase().normalize('NFKD').replace(/[^\w]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40))||('n'+Date.now().toString(36));
const uid=()=>'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const ageDays=r=>Math.floor((Date.now()-Date.parse(r.observed_at))/864e5);
const rel=d=>{if(!isFinite(d))return '—';if(d<=0)return 'today';if(d<31)return d+' d ago';if(d<365)return Math.round(d/30)+' mo ago';return (d/365).toFixed(1)+' y ago'};
function ago(r){
  if(r.checked_at)return 'checked '+rel(Math.floor((Date.now()-Date.parse(r.checked_at))/864e5));
  if(r.date_precision==='year')return (r.observed_at||'').slice(0,4)+', date unknown';
  return rel(ageDays(r));
}
const isStale=r=>r.checked_at?Math.floor((Date.now()-Date.parse(r.checked_at))/864e5)>90:(r.date_precision==='year'||ageDays(r)>90);
const byName=(a,b)=>String(a.name).localeCompare(String(b.name));
const pctTxt=p=>(p>0?'+':'')+(p*100).toFixed(Math.abs(p)<.1?1:0)+'%';
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},2600)}
const errTxt=e=>{const c=e&&e.code;if(c==='quota_exceeded')return 'Database is full. Delete unused rows.';if(c==='invalid_argument')return 'This view cannot write. Ask the owner for edit access.';return 'Could not save ('+(c||'error')+').'};
const NOT_DEAL=/ship|deliver|배송|운임|fee|minimum|min\.|이상 구매|option|옵션|bundle|\bx\s*\d|\d\s*x\b|pack/i,DEAL_WORD=/%|할인|off\b|1\s*\+\s*1|2\s*\+\s*1|sale|coupon|쿠폰|특가|세일|折|優惠|特價|akcia|zľava|rabatt|aktion|angebot|deal|discount|−\d|-\d/i;
const isDeal=r=>{if(!r||!r.promo)return false;const u=r.unit_price,g=r.regular_unit_price;if(g!=null&&u!=null&&g>u*1.01)return true;return !NOT_DEAL.test(r.promo)&&(DEAL_WORD.test(r.promo)||!!r.promo_until)};
const dealTxt=r=>{const u=r.unit_price,g=r.regular_unit_price;const w=(g!=null&&u!=null&&g>u*1.01)?'−'+Math.round((1-u/g)*100)+'%':String(r.promo).slice(0,40);return w+(r.promo_until?' · until '+r.promo_until.slice(5):' · no end date')};
const noteHtml=t=>{t=String(t||'').trim();if(!t)return '';const u=t.replace(/https?:\/\/\S+/g,'link');return u.length<=80?`<span class="sub">${esc(u)}</span>`:`<details class="nt"><summary>${esc(u.slice(0,70))}…</summary><span class="sub">${esc(t)}</span></details>`};
const promoState=r=>{if(!r.promo_until)return null;const t=Date.parse(r.promo_until+'T23:59:59');if(!isFinite(t))return null;const d=(t-Date.now())/864e5;return d<0?'ended':d<=3?'soon':'on'};
const effOf=r=>{if(promoState(r)==='ended')return r.regular_unit_price!=null?{ended:true,reg:true}:{ended:true,reg:false};return {ended:false,reg:false}};
const originOf=r=>r.origin||(r.source_type==='research'?'auto':'user');
const NUT=[['energy_kcal','Energy','kcal'],['protein_g','Protein','g'],['fat_g','Fat','g'],['sat_fat_g','Saturated fat','g'],['mono_fat_g','Monounsaturated fat','g'],['poly_fat_g','Polyunsaturated fat','g'],['omega3_g','Omega-3','g'],['omega6_g','Omega-6','g'],['cholesterol_mg','Cholesterol','mg'],['carbs_g','Carbohydrate','g'],['sugars_g','Sugars','g'],['fibre_g','Fibre','g'],['salt_g','Salt','g'],['sodium_mg','Sodium','mg'],['potassium_mg','Potassium','mg'],['calcium_mg','Calcium','mg'],['iron_mg','Iron','mg'],['magnesium_mg','Magnesium','mg'],['zinc_mg','Zinc','mg'],['phosphorus_mg','Phosphorus','mg'],['manganese_mg','Manganese','mg'],['selenium_ug','Selenium','µg'],['vit_a_rae_ug','Vitamin A (RAE)','µg'],['vit_c_mg','Vitamin C','mg'],['vit_d_ug','Vitamin D','µg'],['vit_e_mg','Vitamin E','mg'],['vit_k_ug','Vitamin K','µg'],['b1_mg','Vitamin B1','mg'],['b2_mg','Vitamin B2','mg'],['b3_mg','Vitamin B3','mg'],['b6_mg','Vitamin B6','mg'],['folate_ug','Folate','µg'],['b12_ug','Vitamin B12','µg']];
const NSC={generic_reference:'Reference table',label:'Product label',press_release:'Press release',estimate:'Estimate'};
const stamp=t=>{if(!t)return '';const d=new Date(t);return isFinite(d)?d.toLocaleString([], {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):String(t)};
const nutOf=it=>{for(const p of it.products||[])if(p.nutrition&&p.nutrition.values)return p.nutrition;return null};
const PRI={daily:'Daily',regular:'Regular',occasional:'Occasional'};
const prodLabel=(it,p)=>(it.products&&it.products.length>1)||p.name!==it.name?p.name:'';

/* ---------- derive ---------- */
const cmpDesc=(a,b)=>(b.observed_at||'').localeCompare(a.observed_at||'')||(b.created_at||'').localeCompare(a.created_at||'');
const rowEur=r=>{const v=toEur(r.currency,effOf(r).reg?r.regular_unit_price:r.unit_price);return v!=null?v:(r.eur_unit_price!=null?r.eur_unit_price:null)};
function derive(){
  const groups=new Map(),byItem=new Map();
  for(const p of S.prices){const k=p.product_id+'|'+p.retailer_id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)}
  for(const [k,rows] of groups){
    rows.sort(cmpDesc);
    const real=rows.filter(r=>!r.placeholder),latest=real[0]||rows[0],it=S.items.get(latest.item_id);
    if(!it)continue;
    const rt=S.retailers.get(latest.retailer_id)||{id:latest.retailer_id,name:latest.retailer_id,country:latest.country,kind:'unknown'};
    const prod=(it.products||[]).find(p=>p.id===latest.product_id)||{id:latest.product_id,name:latest.product_id};
    let pct=null;const prev=real[1];
    if(prev){const same=latest.currency===prev.currency;
      const a=same?(latest.unit_price!=null?latest.unit_price:latest.amount):latest.eur_unit_price,b=same?(prev.unit_price!=null?prev.unit_price:prev.amount):prev.eur_unit_price;
      if(a!=null&&b>0)pct=(a-b)/b}
    const o={key:k,item:it,prod,rt,rows,real,latest,pct,country:latest.country||rt.country,eff:effOf(latest),eurUnit:latest.placeholder||(effOf(latest).ended&&!effOf(latest).reg)?null:rowEur(latest)};
    if(!byItem.has(it.id))byItem.set(it.id,[]);byItem.get(it.id).push(o);
  }
  return {byItem,groups};
}
const isOff=id=>{if(id in PREF)return !PREF[id];const r=S.retailers.get(id);return !!(r&&r.needs_membership)||HIDDEN_DEFAULT.has(id)};
const sRank=id=>{const i=STORE_PRIO.indexOf(id);return i<0?99:i};
const HIDE_RT=new Set(['unspecified','online-unspecified']);
const inScope=o=>S.country==='ALL'||o.country===S.country;
function offersFor(it){
  const all=((S.D&&S.D.byItem.get(it.id))||[]).filter(inScope).filter(o=>!isOff(o.latest.retailer_id)).filter(o=>!S.org||originOf(o.latest)===S.org);
  return {all,ranked:all.filter(o=>o.eurUnit!=null).sort((a,b)=>a.eurUnit-b.eurUnit),other:all.filter(o=>o.eurUnit==null)};
}
function countryCounts(){
  const n={ALL:0};CODES.forEach(c=>n[c]=0);
  if(S.D)for(const arr of S.D.byItem.values())for(const o of arr)if(o.eurUnit!=null&&!isOff(o.latest.retailer_id)){n.ALL++;if(n[o.country]!=null)n[o.country]++}
  return n;
}

/* ---------- rendering ---------- */
const bl=b=>b||'kg';
const AS={ok:'OK',watch:'Watch',flag:'Red flag'};
const assessOf=o=>{for(const r of (o.real||[])){if(r.assess&&r.assess.note)return r.assess}return null};
const assessHtml=a=>a?`<span class="as ${a.level==='ok'?'':'w'}"><b>${AS[a.level]||'Check'}:</b> ${esc(a.note)}${a.basis?` <small>(${esc(a.basis)}${a.at?', '+esc(a.at):''})</small>`:''}</span>`:'';
function priceCell(o,big){
  const r=o.latest,b=bl(r.base_unit);
  if(r.unit_price==null){
    if(r.amount!=null)return `<div class="o-price"><span class="num">${money(r.currency,r.amount)}</span><small>pack, size unknown</small></div>`;
    return `<div class="o-price need"><b>Needs price</b></div>`;
  }
  const ev=o.eff||{},shown=ev.reg?r.regular_unit_price:r.unit_price;
  const second=ev.ended&&!ev.reg?'promo ended, re-check':r.currency===home()
    ?(r.amount!=null&&!ev.reg?`pack ${money(r.currency,r.amount)}${r.size?' · '+r.size+' '+r.size_unit:''}`:(ev.reg?'regular price':''))
    :(o.eurUnit!=null?`≈ ${mh(o.eurUnit)}/${b}`:'EUR rate missing');
  return `<div class="o-price"><span class="num">${money(r.currency,shown)}<small>/${b}</small></span><small>${esc(second)}</small></div>`;
}
function badges(o,withCty){
  const r=o.latest,out=[];
  if(withCty)out.push(`<span class="bd cty">${esc(o.country)}</span>`);
  out.push(`<span class="bd o-${originOf(r)}">${originOf(r)==='auto'?'Auto':'Yours'}</span>`);
  out.push(`<span class="bd src-${r.source_type}">${esc(SRC[r.source_type]||r.source_type)}</span>`);
  out.push(`<span class="bd${isStale(r)?' stale':''}">${esc(ago(r))}</span>`);
  const ps=promoState(r);
  if(isDeal(r)&&ps==='ended')out.push(`<span class="bd flag">Promo ended ${esc(r.promo_until)}</span>`);
  else if(isDeal(r))out.push(`<span class="bd${ps==='soon'?' flag':''}">${esc(dealTxt(r))}</span>`);
  if(r.requires_program){const pg=S.prog.find(x=>x.id===r.requires_program);out.push(`<span class="bd">Needs ${esc(pg?pg.name:r.requires_program)}</span>`)}
  if(r.flag)out.push(`<span class="bd flag">Check</span>`);
  {const a=assessOf(o);if(a&&a.level!=='ok')out.push(`<span class="bd flag">${AS[a.level]||'Watch'}</span>`)}
  if(o.pct!=null&&Math.abs(o.pct)>=.005)out.push(`<span class="${o.pct<0?'dn':'upc'}">${o.pct<0?'▼':'▲'} ${pctTxt(o.pct)}</span>`);
  return `<div class="badges">${out.join('')}</div>`;
}
function offerRow(o,rank){
  const pl=prodLabel(o.item,o.prod),kind={online:'Online',offline:'Store',both:'Store + online'}[o.rt.kind]||'';
  const rk=rank===1?`<div class="rank best">BEST</div>`:`<div class="rank">${rank||'·'}</div>`;
  return `<button class="offer" data-act="detail" data-key="${esc(o.key)}">${rk}
    <div class="o-main"><b>${esc(o.rt.name)}</b><span class="sub">${esc([pl,kind].filter(Boolean).join(' · '))}</span>${badges(o,S.country==='ALL')}</div>${priceCell(o)}</button>`;
}
const med=a=>{const t=[...a].sort((x,y)=>x-y),m=t.length>>1;return t.length%2?t[m]:(t[m-1]+t[m])/2};
function protPer(it,eu,pr){const nu=pr&&pr.nutrition,pv=nu&&nu.values&&nu.values.protein_g;if(pv==null||!eu)return null;
  if(nu.basis==='per 100 g'&&it.base_unit==='kg')return pv*10/eu;
  if(nu.basis==='per cup'&&it.base_unit==='pc')return pv/eu;return null}
function byCty(it){const m={};for(const o of (S.D.byItem.get(it.id)||[]))if(o.eurUnit!=null&&!isOff(o.latest.retailer_id)&&(!m[o.country]||o.eurUnit<m[o.country].v))m[o.country]={v:o.eurUnit,rt:o.rt.name};return m}
function spark(v){if(v.length<2)return '';const mn=Math.min(...v),mx=Math.max(...v),W=56,H=18,r=mx-mn||1;
  const pts=v.map((x,i)=>[(i/(v.length-1))*(W-4)+2,H-3-((x-mn)/r)*(H-6)]);
  return `<svg class="spk" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline fill="none" stroke="var(--fg-3)" stroke-width="1.5" points="${pts.map(q=>q.join(',')).join(' ')}"/><circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="2.4" fill="var(--tag)"/></svg>`}
function sizeLab(r){
  const n=Number(r.size),u=r.size_unit;if(!n||!u)return '';
  if(u==='g'&&n>=1000)return (n/1000)+' kg';if(u==='ml'&&n>=1000)return (n/1000)+' l';
  return n+' '+u;
}
function ladRow(o,rank,max,best){
  const r=o.latest,b=bl(r.base_unit),nopx=o.eurUnit==null,w=nopx?0:Math.max(8,Math.round(o.eurUnit/max*100));
  const ps=promoState(r),tags=[];
  if(isDeal(r)&&ps!=='ended')tags.push(`<span class="tg hot">${esc(dealTxt(r))}</span>`);
  if(r.requires_program){const pg=S.prog.find(x=>x.id===r.requires_program);tags.push(`<span class="tg">${esc(pg?pg.name:'card needed')}</span>`)}
  if(isDeal(r)&&ps==='ended')tags.push(`<span class="tg warn">promo ended</span>`);
  if(isStale(r))tags.push(`<span class="tg warn">old price</span>`);
  if(o.pct!=null&&Math.abs(o.pct)>=.005)tags.push(`<span class="${o.pct<0?'dn':'upc'}">${o.pct<0?'▼':'▲'} ${pctTxt(o.pct)}</span>`);
  const nat=!nopx&&r.currency!==home()&&r.unit_price!=null?money(r.currency,o.eff&&o.eff.reg?r.regular_unit_price:r.unit_price)+'/'+b:'';
  const vs=!nopx&&rank>1&&best?'+'+Math.round((o.eurUnit/best-1)*100)+'%':'';
  const pv=nopx?`<b class="nx">${r.amount!=null&&r.unit_price==null?'pack '+money(r.currency,r.amount):'no price'}</b>`:`<span class="num">${mh(o.eurUnit)}<small>/${b}</small></span><small>${[nat,vs].filter(Boolean).join(' · ')}</small>`;
  const pname=r.product_name||(o.prod&&o.prod.name)||'';
  const sz=sizeLab(r),pe=r.amount!=null&&!r.placeholder?money(r.currency,r.amount)+(r.currency!==home()&&toEur(r.currency,r.amount)!=null?' ≈ '+mh(toEur(r.currency,r.amount)):''):'';
  const pk=[sz,pe?'pack '+pe:''].filter(Boolean).join(' · ');
  const meta=[r.observed_at,SRC[r.source_type]||r.source_type].filter(Boolean).join(' · ');
  const img=r.image_url||(o.prod&&o.prod.image_url)||(r.asset_id?'/_blob/'+r.asset_id:'');
  return `<button class="sl${rank===1?' b':''}${nopx?' nopx':''}${img?' wi':''}" data-act="detail" data-key="${esc(o.key)}">${img?`<img class="th" alt="" loading="lazy" src="${esc(img)}">`:''}<span class="sn"><b>${esc(o.rt.name)}</b><span class="pd">${esc(pname)}</span>${pk?`<span class="pk2">${esc(pk)}</span>`:''}<span class="mt">${esc(meta)}</span>${tags.length?`<span class="tgs">${tags.join('')}</span>`:''}${nopx?'':`<span class="sb" aria-hidden="true"><i style="width:${w}%"></i></span>`}</span><span class="sv">${pv}</span></button>`;
}
const WIDE=()=>innerWidth>=820;
const isEx=id=>S.ex.has(id)!==WIDE();
let _w=WIDE();addEventListener('resize',()=>{const w=WIDE();if(w!==_w){_w=w;S.ex.clear();try{render()}catch(e){}}});
function itemCard(it){
  const {all,ranked,other}=offersFor(it);
  const open=S.open.has(it.id);
  const sub=[it.priority==='daily'?'Daily':'',it.health==='core'?'Core':it.health==='limit'?'Limit':'','per '+(it.base_unit||'kg')].filter(Boolean).join(' · ');
  if(!all.length){
    const c=byCty(it),k=Object.keys(c).sort((x,y)=>c[x].v-c[y].v);
    return `<article class="sc none"><div class="sh"><div class="sx"><b>${esc(it.name)}</b><small>${esc(sub)}</small></div><button class="btn" data-act="addfor" data-item="${esc(it.id)}">+ Price</button></div>${k.length?`<div class="hint">Not priced in ${S.country==='ALL'?'any country':esc(COUNTRIES[S.country].name)}. ${k[0]} has it at ${mh(c[k[0]].v)}/${bl(it.base_unit)}.</div>`:''}</article>`;
  }
  const e=ranked.map(o=>o.eurUnit),best=ranked[0],b=best?bl(best.latest.base_unit):bl(it.base_unit);
  const mdn=e.length>2?med(e):null,save=mdn?1-e[0]/mdn:null;
  const rowsAll=ranked.map((o,i)=>[o,i+1]).concat(other.map(o=>[o,0])),shown=open?rowsAll.length:3,max=e.length?Math.max(...e):1;
  const r0=best&&best.latest,nat=r0&&r0.currency!==home()&&r0.unit_price!=null?money(r0.currency,best.eff&&best.eff.reg?r0.regular_unit_price:r0.unit_price)+'/'+b:'';
  const head=best?`<div class="sp"><span class="num">${mh(best.eurUnit)}<small>/${b}</small></span>${nat?`<small>${nat}</small>`:''}</div>`:`<div class="sp"><small class="nx">needs a price</small></div>`;
  const facts=[];
  if(save!=null&&save>=.08)facts.push(`<span class="ft g">${Math.round(save*100)}% below the usual price</span>`);
  if(ranked.length>1){const gap=ranked[1].eurUnit/e[0]-1;if(gap>=.05)facts.push(`<span class="ft">next best +${Math.round(gap*100)}%</span>`)}
  const bnu=best&&best.prod&&best.prod.nutrition&&best.prod.nutrition.values?best.prod.nutrition:null,pe=best?protPer(it,best.eurUnit,best.prod):null;
  if(pe)facts.push(`<span class="ft p">${pe>=100?Math.round(pe):pe.toFixed(1)} g protein per €</span>`);
  if(bnu&&bnu.values.energy_kcal!=null&&bnu.basis)facts.push(`<span class="ft">${bnu.values.energy_kcal} kcal ${esc(bnu.basis.replace('per ','/'))}</span>`);
  const c=byCty(it),cheaper=Object.keys(c).filter(x=>x!==S.country&&S.country!=='ALL'&&best&&c[x].v<best.eurUnit*0.9).sort((x,y)=>c[x].v-c[y].v)[0];
  if(cheaper)facts.push(`<span class="ft">${cheaper} ${mh(c[cheaper].v)}</span>`);
  const more=rowsAll.length>3?`<button class="lk" data-act="toggle" data-id="${esc(it.id)}">${open?'Show fewer':'All '+rowsAll.length+' shops'}</button>`:'';
  const ex=isEx(it.id),bs=best?short(best.rt.name):'';
  return `<article class="sc${ex?' ex':''}"><button class="sh" data-act="cx" data-id="${esc(it.id)}" aria-expanded="${ex}"><div class="sx"><b>${esc(it.name)}</b><small>${esc(sub)}${!ex&&bs?' · '+esc(bs)+(ranked.length>1?' +'+(ranked.length-1):''):''}</small></div>${head}<span class="chv" aria-hidden="true">${ex?'▴':'▾'}</span></button>${ex?`${facts.length?`<div class="fts">${facts.join('')}</div>`:''}<div class="sls">${rowsAll.slice(0,shown).map(([o,k])=>ladRow(o,k,max,e[0])).join('')}</div><div class="sf">${more}<button class="lk" data-act="addfor" data-item="${esc(it.id)}">+ Add price</button></div>`:''}</article>`;
}
function storeList(){
  if(S.country==='ALL')return [];
  return allStores().filter(x=>!isOff(x.id)&&!HIDE_RT.has(x.id));
}
function storeCard(it){
  const {ranked}=offersFor(it);
  const mine=ranked.filter(o=>o.latest.retailer_id===S.store);
  if(!mine.length)return null;
  const m=mine[0],best=ranked[0],isBest=m.eurUnit<=best.eurUnit*1.005,b=bl(m.latest.base_unit);
  if(S.hereBest&&!isBest)return {html:'',isBest,skip:true};
  const others=ranked.filter(o=>o.latest.retailer_id!==S.store).slice(0,isBest?1:2);
  const rows=mine.map((o,i)=>[o,ranked.indexOf(o)+1]).concat(others.map(o=>[o,ranked.indexOf(o)+1]));
  const max=Math.max(...rows.map(([o])=>o.eurUnit));
  const r0=m.latest,nat=r0.currency!==home()&&r0.unit_price!=null?money(r0.currency,m.eff&&m.eff.reg?r0.regular_unit_price:r0.unit_price)+'/'+b:'';
  const gap=Math.round((m.eurUnit/best.eurUnit-1)*100);
  const verdict=isBest?`<span class="ft g">Cheapest in ${esc(COUNTRIES[S.country].name)}</span>`:`<span class="ft w">+${gap}% vs ${esc(best.rt.name)}</span>`;
  const pe=protPer(it,m.eurUnit,m.prod),pf=pe?`<span class="ft p">${pe>=100?Math.round(pe):pe.toFixed(1)} g protein per €</span>`:'';
  const sub=[it.priority==='daily'?'Daily':'',it.health==='core'?'Core':'','per '+(it.base_unit||'kg')].filter(Boolean).join(' · ');
  return {isBest,html:`<article class="sc here${isBest?' win':''}${isEx(it.id)?' ex':''}"><button class="sh" data-act="cx" data-id="${esc(it.id)}" aria-expanded="${isEx(it.id)}"><div class="sx"><b>${esc(it.name)}</b><small>${esc(sub)}</small></div><div class="sp"><span class="num">${mh(m.eurUnit)}<small>/${b}</small></span>${nat?`<small>${nat}</small>`:''}</div><span class="chv" aria-hidden="true">${S.ex.has(it.id)?'▴':'▾'}</span></button><div class="fts">${verdict}${S.ex.has(it.id)?pf:''}</div>${S.ex.has(it.id)?`<div class="sls">${rows.map(([o,k],i)=>ladRow(o,k,max,best.eurUnit)).join('')}</div>`:''}</article>`};
}
function dealsStrip(){
  const d=[];
  for(const it of S.items.values()){if(it.status==='replaced'||it.status==='not_needed')continue;
    for(const o of offersFor(it).ranked){const ps=promoState(o.latest);if(isDeal(o.latest)&&ps!=='ended')d.push({o,it,ps})}}
  if(!d.length)return '';
  d.sort((a,b)=>(a.ps==='soon'?0:1)-(b.ps==='soon'?0:1)||(a.o.latest.promo_until||'9').localeCompare(b.o.latest.promo_until||'9'));
  return `<section aria-label="Promotions"><h2 class="sec">Promotions now</h2><div class="deals">${d.slice(0,8).map(x=>`<button class="deal" data-act="detail" data-key="${esc(x.o.key)}"><b>${esc(x.it.name)}</b><span class="num">${mh(x.o.eurUnit)}<small>/${bl(x.o.latest.base_unit)}</small></span><small>${esc(x.o.rt.name)}</small><small class="${x.ps==='soon'?'warnt':''}">${esc(dealTxt(x.o.latest))}</small></button>`).join('')}</div></section>`;
}
function dashboard(){
  const live=[...S.items.values()].filter(i=>i.status!=='replaced'&&i.status!=='not_needed');
  const rows=live.map(i=>({i,o:offersFor(i)}));
  const priced=rows.filter(x=>x.o.ranked.length),daily=rows.filter(x=>x.i.priority==='daily'),dp=daily.filter(x=>x.o.ranked.length);
  const offs=rows.flatMap(x=>x.o.ranked);
  const fresh=offs.filter(o=>!isStale(o.latest)&&Math.floor((Date.now()-Date.parse(o.latest.checked_at||o.latest.observed_at))/864e5)<=30).length;
  const att=[];
  for(const o of offs){const ps=promoState(o.latest);if(ps==='soon')att.push({o,t:'Promo ends '+o.latest.promo_until,k:0});else if(isStale(o.latest))att.push({o,t:'Price older than 90 days',k:2})}
  for(const x of rows)for(const o of x.o.other)if(o.latest.placeholder||o.latest.unit_price==null)att.push({o,t:o.latest.research_attempt?'Auto search found nothing':'Needs a price',k:3});
  for(const x of daily)if(!x.o.all.length)att.push({it:x.i,t:'Daily driver without a price',k:1});
  att.sort((a,b)=>a.k-b.k);
  const cats=CATS.map(c=>{const r=rows.filter(x=>x.i.category===c);return {c,n:r.length,p:r.filter(x=>x.o.ranked.length).length}}).filter(x=>x.n);
  const yours=offs.filter(o=>originOf(o.latest)==='user').length,auto=offs.length-yours;
  const pl=rows.map(x=>({i:x.i,v:x.o.ranked[0]?protPer(x.i,x.o.ranked[0].eurUnit,x.o.ranked[0].prod):null,o:x.o.ranked[0]})).filter(x=>x.v).sort((a,b)=>b.v-a.v).slice(0,6);
  const pm=pl.length?pl[0].v:1;
  const nm=S.country==='ALL'?'all countries':COUNTRIES[S.country].name;
  const kpi=(l,v,s,m)=>`<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span>${m!=null?`<span class="meter"><i style="width:${Math.round(m*100)}%"></i></span>`:''}</div>`;
  let o=`<section class="dash" aria-label="Overview for ${esc(nm)}"><div class="kpis">${kpi('Staples priced',priced.length+'<small style="font-size:14px;color:var(--fg-3)"> / '+live.length+'</small>',nm,live.length?priced.length/live.length:0)}${kpi('Daily drivers',dp.length+'<small style="font-size:14px;color:var(--fg-3)"> / '+daily.length+'</small>','priced',daily.length?dp.length/daily.length:0)}${kpi('Fresh data',offs.length?Math.round(fresh/offs.length*100)+'%':'—','checked within 30 days',offs.length?fresh/offs.length:0)}${kpi('Needs attention',att.length,'promos, stale, missing',null)}</div>`;
  o+=`<div class="dgrid"><div class="panel2"><h3>Coverage by category</h3>${cats.map(x=>`<div class="hb"><span>${esc(x.c)}</span><span class="t"><i class="g" style="width:${x.p/x.n*100}%"></i></span><b>${x.p}/${x.n}</b></div>`).join('')}<h3 style="margin-top:4px">Who entered the prices</h3><div class="hb"><span>Yours · Auto</span><span class="t"><i style="width:${offs.length?yours/offs.length*100:0}%"></i><i class="m" style="width:${offs.length?auto/offs.length*100:0}%"></i></span><b>${yours} · ${auto}</b></div></div>`;
  o+=pl.length?`<div class="panel2"><h3>Protein per euro · best offers</h3>${pl.map(x=>`<button class="hb" style="text-align:left" data-act="detail" data-key="${esc(x.o.key)}"><span style="overflow-wrap:anywhere">${esc(x.i.name)}</span><span class="t"><i class="g" style="width:${x.v/pm*100}%"></i></span><b>${x.v>=100?Math.round(x.v):x.v.toFixed(1)} g/€</b></button>`).join('')}<span class="sub">Needs nutrition data. More fills in daily.</span></div>`:'';
  o+=`</div>`;
  if(att.length)o+=`<div class="panel2"><h3>Needs attention</h3>${att.slice(0,6).map(a=>a.o?`<button class="att" data-act="detail" data-key="${esc(a.o.key)}"><span><b>${esc(a.o.item.name)}</b> · ${esc(a.o.rt.name)}</span><span class="sub">${esc(a.t)}</span></button>`:`<button class="att" data-act="addfor" data-item="${esc(a.it.id)}"><span><b>${esc(a.it.name)}</b></span><span class="sub">${esc(a.t)}</span></button>`).join('')}${att.length>6?`<span class="sub">+ ${att.length-6} more</span>`:''}</div>`;
  return o+`</section>`;
}
function catList(c){return [...S.items.values()].filter(i=>(i.category||'Other')===c&&i.status!=='replaced'&&i.status!=='not_needed').sort((a,b)=>(a.sort??1e9)-(b.sort??1e9)||byName(a,b))}
async function moveItem(id,d){
  if(!S.db||!S.canWrite)return toast('Cannot reorder here');
  const it=S.items.get(id);if(!it)return;
  const L=catList(it.category||'Other'),i=L.findIndex(x=>x.id===id),j=i+d;if(i<0||j<0||j>=L.length)return;
  [L[i],L[j]]=[L[j],L[i]];
  const now=new Date().toISOString(),jobs=[];
  L.forEach((x,k)=>{const n=(k+1)*10;if(x.sort!==n){x.sort=n;x.updated_at=now;jobs.push(S.db.doc('items/'+x.id).update({sort:n,sort_updated_at:now,updated_at:now}))}});
  render();
  try{await Promise.all(jobs)}catch(e){toast(errTxt(e))}
}
function viewReorder(){
  const cats=[...new Set([...S.items.values()].filter(i=>i.status!=='replaced'&&i.status!=='not_needed').map(i=>i.category||'Other'))].sort((a,b)=>CATS.indexOf(a)-CATS.indexOf(b));
  let o=`<div class="banner">Use the arrows. Order is saved.</div>`;
  for(const c of cats){const L=catList(c);o+=`<h2 class="sec">${esc(c)}</h2><div class="card">${L.map((x,k)=>`<div class="rrow"><div><b>${esc(x.name)}</b><div class="sub">${esc(PRI[x.priority]||'')}</div></div><div class="mv"><button data-act="mv" data-id="${esc(x.id)}" data-d="-1" aria-label="Move ${esc(x.name)} up"${k===0?' disabled':''}>▲</button><button data-act="mv" data-id="${esc(x.id)}" data-d="1" aria-label="Move ${esc(x.name)} down"${k===L.length-1?' disabled':''}>▼</button></div></div>`).join('')}</div>`}
  return o;
}
function viewCompare(){
  if(S.reorder)return viewReorder();
  const items=[...S.items.values()].sort(byName);
  const live=items.filter(i=>i.status!=='replaced'&&i.status!=='not_needed');
  const parked=items.filter(i=>i.status==='replaced'||i.status==='not_needed');
  const q=S.q.trim().toLowerCase();
  const f=live.filter(i=>(!S.daily||i.priority==='daily')&&(S.cat==='All'||i.category===S.cat)&&(!q||i.name.toLowerCase().includes(q)||(i.products||[]).some(p=>(p.name||'').toLowerCase().includes(q))));
  let out='';
  const n=countryCounts();
  if(S.loaded>=3&&S.country!=='ALL'&&n[S.country]===0){
    const nm=COUNTRIES[S.country].name;
    out+=`<div class="empty"><b>No ${esc(nm)} prices yet</b><span>Add a shelf price by hand, photograph a tag, or queue research for ${esc(nm)}.</span><div class="btns"><button class="btn pri" data-act="add">Add a price</button><button class="btn" data-act="reqcountry">Request research for ${esc(S.country)}</button></div></div>`;
  }
  if(S.org)out+=`<div class="banner">Showing only ${S.org==='user'?'your':'auto-researched'} prices. <button class="lk" data-act="org" data-o="${S.org}">Clear</button></div>`;
  if(S.loaded>=3&&!q&&S.cat==='All'&&!S.daily)out+=dealsStrip();
  if(S.store&&S.country!=='ALL'){
    const st=storeList().find(x=>x.id===S.store),res=f.map(i=>storeCard.call(null,i)).filter(Boolean);
    const nb=res.filter(r=>r.isBest).length;
    out+=`<div class="here-sum"><div><b>${esc(st?short(st.name):"Store")}</b><span class="sub">${res.length} of ${f.length} staples priced here</span></div><div class="hs-n"><span class="num">${nb}</span><small>cheapest in ${esc(COUNTRIES[S.country].name)}</small></div><button class="chip" data-act="herebest" aria-pressed="${S.hereBest}">Best here only</button></div>`;
  }
  out+=`<div class="exall"><button class="lk" data-act="cxall">${(WIDE()?!S.ex.size:S.ex.size)?'Collapse all':'Expand all'}</button></div>`;
  const cats=[...new Set(f.map(i=>i.category||'Other'))].sort((a,b)=>CATS.indexOf(a)-CATS.indexOf(b));
  for(const c of cats){
    const list=f.filter(i=>(i.category||'Other')===c).map(i=>({i,o:offersFor(i)}));
    list.sort((a,b)=>(a.i.sort??1e9)-(b.i.sort??1e9)||byName(a.i,b.i));
    if(S.store&&S.country!=='ALL'){
      const cs=list.map(x=>({x,c:storeCard(x.i)})).filter(y=>y.c&&!y.c.skip);
      if(!cs.length)continue;
      out+=`<h2 class="sec">${esc(c)} · ${cs.length}</h2>`+cs.map(y=>y.c.html).join('');
    } else out+=`<h2 class="sec">${esc(c)} · ${list.length}</h2>`+list.map(x=>itemCard(x.i)).join('');
  }
  if(!f.length&&S.loaded>=3)out+=`<div class="empty"><b>Nothing matches</b><span>Clear the search or pick another category.</span></div>`;
  if(parked.length&&S.cat==='All'&&!q)out+=`<h2 class="sec">Parked</h2>`+parked.map(i=>`<article class="tag none"><div class="tag-head"><span class="tag-name"><b>${esc(i.name)}</b><small>${esc(i.note||i.status)}${i.replaced_by?' → '+esc((S.items.get(i.replaced_by)||{}).name||i.replaced_by):''}</small></span></div></article>`).join('');
  return out;
}
const BRT=[['prices','Prices'],['items','Items'],['stores','Stores'],['nutri','Nutrition'],['srcs','Sources']];
function brRows(){
  const t=S.br.t,q=S.br.q.toLowerCase(),nm=id=>(S.items.get(id)||{}).name||id,rn=id=>(S.retailers.get(id)||{}).name||id;
  let cols=[],rows=[],raw=[];
  if(t==='prices'){cols=['Item','Store','Price','EUR','Date','Origin','Source'];
    raw=[...S.prices].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
    rows=raw.map(p=>[nm(p.item_id),rn(p.retailer_id),p.amount==null?'—':money(p.currency,p.amount),p.eur_amount==null?'—':'€'+Number(p.eur_amount).toFixed(2),p.observed_at||'',p.origin==='auto'?'Auto':'Yours',(SRC[p.source_type]||p.source_type||'')+(p.source_url?' ↗':'')+(p.research_attempt?' (no price found)':'')]);}
  else if(t==='items'){cols=['Item','Category','Priority','Health','Products'];
    raw=[...S.items.values()].sort(byName);
    rows=raw.map(i=>[i.name,i.category||'',i.priority||'',i.health||'',(i.products||[]).map(x=>x.name).join(', ')]);}
  else if(t==='stores'){cols=['Store','Country','Kind','Prices'];
    raw=[...S.retailers.values()].sort(byName);
    const cnt={};S.prices.forEach(p=>cnt[p.retailer_id]=(cnt[p.retailer_id]||0)+1);
    rows=raw.map(r=>[r.name,r.country||'',r.kind||'',String(cnt[r.id]||0)]);}
  else if(t==='nutri'){cols=['Product','Form','kcal','Protein g','Fat g','Carbs g','Fibre g','Source'];
    raw=[];[...S.items.values()].sort(byName).forEach(i=>(i.products||[]).forEach(p=>{if(p.nutrition)raw.push(Object.assign({item:i.name,product:p.name},p.nutrition))}));
    rows=raw.map(n=>{const v=n.values||{},f=k=>v[k]==null?'—':String(v[k]);return [n.product,n.form||'',f('energy_kcal'),f('protein_g'),f('fat_g'),f('carbs_g'),f('fibre_g'),(n.scope||'')+(n.source_url?' ↗':'')]});}
  else {cols=['Source','Country','Status','Score','Access'];
    raw=[...S.src].sort((a,b)=>(b.score||0)-(a.score||0));
    rows=raw.map(r=>[r.name,r.country||'',r.status||'',String(r.score==null?'':r.score),r.access||'']);}
  const idx=[];rows.forEach((r,i)=>{if(!q||r.join(' ').toLowerCase().includes(q))idx.push(i)});
  return {cols,rows,raw,idx};
}
function brHtml(){
  const b=brRows(),n=b.idx.length,lim=200;
  let o=`<div class="sub">${n} of ${b.rows.length} rows${n>lim?' (first '+lim+')':''}</div>`;
  if(S.br.json) return o+`<pre class="brj">${esc(JSON.stringify(b.idx.slice(0,40).map(i=>b.raw[i]),null,1))}</pre>`;
  o+=`<div class="brw"><table class="brt"><thead><tr>${b.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.idx.slice(0,lim).map(i=>`<tr>${b.rows[i].map((c,j)=>`<td${j?'':' class="f"'}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return o;
}
function dataBrowser(){
  return `<h2 class="sec">Browse data</h2><div class="chips">${BRT.map(([k,l])=>`<button class="chip" data-act="brt" data-k="${k}" aria-pressed="${S.br.t===k}">${l}</button>`).join('')}<button class="chip" data-act="brj" aria-pressed="${S.br.json}">Raw JSON</button></div><input class="brq" id="brq" type="search" placeholder="Filter rows…" value="${esc(S.br.q)}" autocomplete="off"><div id="brbody">${brHtml()}</div>`;
}
function viewActivity(){
  const ch=[];
  if(S.D)for(const arr of S.D.byItem.values())for(const o of arr)if(o.pct!=null&&Math.abs(o.pct)>=.005)ch.push(o);
  ch.sort((a,b)=>cmpDesc(a.latest,b.latest));
  const recent=S.prices.filter(p=>p.source_type!=='import').sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).slice(0,15);
  const a=S.auto;
  let o=dataBrowser()+`<h2 class="sec">Data quality</h2><div class="chips"><button class="chip" data-act="org" data-o="user" aria-pressed="${S.org==='user'}">Yours only</button><button class="chip" data-act="org" data-o="auto" aria-pressed="${S.org==='auto'}">Auto only</button></div>`+dashboard()+`<div class="card"><h3>Automatic checks</h3>${a&&a.ran_at?`<dl class="kv"><dt>Last run</dt><dd>${esc(new Date(a.ran_at).toLocaleString())}</dd><dt>Result</dt><dd>${esc(a.summary||'')}</dd></dl>`:`<span class="sub">No automatic runs yet.</span>`}</div>`;
  const q=S.checks.filter(c=>c.status==='queued');
  o+=`<h2 class="sec">Requested checks (${q.length})</h2>`+(q.length?`<div class="card">${q.map(c=>`<div class="li"><div><b>${esc(c.scope==='country'?'Research for '+c.country:((S.items.get(c.item_id)||{}).name||c.item_id||'Check'))}</b><div class="sub">queued ${esc((c.requested_at||'').slice(0,10))}</div></div></div>`).join('')}</div>`:`<div class="sub">Nothing queued.</div>`);
  o+=`<h2 class="sec">Price changes</h2>`+(ch.length?`<div class="tag">${ch.slice(0,40).map(o=>`<button class="offer" style="grid-template-columns:minmax(0,1fr) auto" data-act="detail" data-key="${esc(o.key)}"><div class="o-main"><b>${esc(o.item.name)}</b><span class="sub">${esc(o.rt.name)} · ${esc(ago(o.latest))}</span></div><div class="o-price"><span class="${o.pct<0?'dn':'upc'}">${o.pct<0?'▼':'▲'} ${pctTxt(o.pct)}</span></div></button>`).join('')}</div>`:`<div class="sub">No price changes yet.</div>`);
  o+=`<h2 class="sec">Latest entries</h2>`+(recent.length?`<div class="tag">${recent.map(p=>{const it=S.items.get(p.item_id)||{name:p.item_id},rt=S.retailers.get(p.retailer_id)||{name:p.retailer_id};return `<div class="offer" style="grid-template-columns:minmax(0,1fr) auto"><div class="o-main"><b>${esc(it.name)}</b><span class="sub">${esc(rt.name)} · ${esc(SRC[p.source_type]||p.source_type)} · ${esc(p.observed_at)}</span></div><div class="o-price"><span class="num">${money(p.currency,p.unit_price!=null?p.unit_price:p.amount)}</span></div></div>`}).join('')}</div>`:`<div class="sub">Nothing added since the PDF import.</div>`);
  return o;
}
function para(t){const L=String(t||'').split('\n');let o='',ul=false;for(const l of L){if(/^- /.test(l)){if(!ul){o+='<ul>';ul=true}o+='<li>'+esc(l.slice(2))+'</li>'}else{if(ul){o+='</ul>';ul=false}if(l.trim())o+='<p>'+esc(l)+'</p>'}}return o+(ul?'</ul>':'')}
const PST={verified:'Verified',partial:'Partly verified',unverified:'Not verified'};
document.addEventListener('input',e=>{if(e.target&&e.target.id==='brq'){S.br.q=e.target.value;const b=document.getElementById('brbody');if(b)b.innerHTML=brHtml()}});
function viewGuide(){
  const kn=[...S.kn].sort((a,b)=>(a.order||9)-(b.order||9));
  let o=kn.length?kn.map(k=>`<details class="card"><summary><h3 style="display:inline">${esc(k.title||k.id)}</h3></summary><div class="sub" style="margin-top:6px">${para(k.body)}<div>Updated ${esc(k.updated||'')}</div></div></details>`).join(''):`<div class="sub">${S.loaded<3?'Loading…':'No guide documents yet.'}</div>`;
  const pg=S.prog.filter(p=>S.country==='ALL'||p.country===S.country).sort((a,b)=>String(a.country).localeCompare(b.country)||byName(a,b));
  o+=`<h2 class="sec">Programs${S.country==='ALL'?'':' · '+esc(COUNTRIES[S.country].name)}</h2>`;
  o+=pg.length?pg.map(p=>`<details class="card"><summary><b>${esc(p.name)}</b> <span class="bd${p.status==='verified'?'':' flag'}">${esc(PST[p.status]||p.status)}</span> <span class="bd cty">${esc(p.country)}</span></summary>
    <dl class="kv" style="margin-top:8px"><dt>Cost</dt><dd>${esc(p.cost||'')}</dd><dt>Benefit</dt><dd>${esc(p.benefit||'')}</dd><dt>How</dt><dd>${esc(p.how||'')}</dd><dt>Expiry</dt><dd>${esc(p.expiry||'')}</dd></dl>
    ${p.note?`<div class="sub">${esc(p.note)}</div>`:''}<div class="sub">${p.verified_at?'Read on '+esc(p.verified_at)+' · ':'Not read · '}${p.source_url?`<a href="${esc(p.source_url)}" target="_blank" rel="noopener">official page</a>`:''}</div></details>`).join(''):`<div class="sub">No programs listed for this country.</div>`;
  const sr=S.src.filter(x=>S.country==='ALL'||x.country===S.country||x.country==='ALL').sort((a,b)=>(b.score||0)-(a.score||0));
  o+=`<h2 class="sec">Sources${S.country==='ALL'?'':' · '+esc(COUNTRIES[S.country].name)}</h2><div class="sub">Score 0–100. Untested scores are estimates.</div>`;
  o+=sr.length?sr.map(x=>{const sc=x.scores||{};const bad=['blocked','down','not_useful'].includes(x.status);return `<details class="card"><summary><b>${esc(x.name)}</b> <span class="bd${x.status==='works'?'':' flag'}">${esc(x.status)}</span> <span class="bd cty">${esc(x.country)}</span> <span class="bd">${esc(x.score)}</span></summary>
    <div class="sub" style="margin-top:6px">${esc(x.note||'')}</div>
    <dl class="kv" style="margin-top:8px"><dt>Type</dt><dd>${esc(x.type)}</dd><dt>Access</dt><dd>${esc(x.access)}${x.needs_key?' · key needed':''}${x.needs_membership?' · membership':''}</dd><dt>Scope</dt><dd>${esc(x.price_scope||'')}</dd><dt>Updates</dt><dd>${esc(x.update_freq||'')}</dd><dt>Data</dt><dd>${[x.has_unit_price&&'unit price',x.has_ean&&'EAN',x.has_promo_dates&&'promo dates'].filter(Boolean).join(', ')||'basic price'}</dd><dt>Scores</dt><dd>cov ${sc.coverage} · rel ${sc.reliability} · fresh ${sc.freshness} · ease ${sc.ease} · cost ${sc.cost}</dd><dt>Evidence</dt><dd>${esc(x.confidence||'')}${x.last_tested?' · tested '+esc(x.last_tested):''}</dd></dl>
    <div class="sub">${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">site</a>`:''}${x.evidence_url?` · <a href="${esc(x.evidence_url)}" target="_blank" rel="noopener">evidence</a>`:''}</div></details>`}).join(''):`<div class="sub">No sources listed.</div>`;
  return o;
}
function viewSetup(){
  const fx=S.fx||{rates:{}},cnt=`${S.items.size} items · ${S.retailers.size} retailers · ${S.prices.length} price rows`;
  return `<div class="card"><h3>Exchange rates</h3><span class="sub">Units per 1 EUR. ${fx.date?`Set ${esc(fx.date)} by ${esc(fx.updated_by||'unknown')}.`:'Not set yet.'} ${esc(fx.source||'')}</span>
    <div class="row3">${FXCUR.map(c=>`<label class="fld"><span>${c}</span><input id="fx-${c}" inputmode="decimal" value="${esc(fx.rates[c]||'')}"></label>`).join('')}</div>
    <div class="btns"><button class="btn dark" data-act="savefx"${S.canWrite?'':' disabled'}>Save rates</button></div>
    <span class="sub">EUR is the base. Each price keeps its day's rate; lists use today's.</span></div>
  <div class="card"><h3>Move to Supabase</h3><span class="sub">${esc(cnt)}. Export, then run in Supabase SQL editor.</span>
    <div class="btns"><button class="btn pri" data-act="exp-sql">Export SQL</button><button class="btn" data-act="exp-json">Export JSON</button><button class="btn" data-act="exp-csv">Export prices CSV</button></div>
    <span class="sub">Plain-text SQL. Save as .sql.</span></div>
  <div class="card"><h3>Where data lives</h3><span class="sub">Data is stored in the built-in database. Photo reading uses your Claude account.</span></div>`;
}
const short=n=>String(n).replace(/\s*\(.*?\)\s*/g,' ').trim();
function allStores(){
  if(S.country==='ALL')return [];
  const cnt=new Map();
  if(S.D)for(const arr of S.D.byItem.values())for(const o of arr){if(o.country!==S.country||o.eurUnit==null)continue;const id=o.latest.retailer_id;cnt.set(id,(cnt.get(id)||new Set()).add(o.item.id))}
  const out=[];
  for(const r of S.retailers.values()){if(r.country!==S.country||HIDE_RT.has(r.id))continue;out.push({id:r.id,name:r.name,on:r.kind==='online',n:(cnt.get(r.id)||new Set()).size})}
  return out.sort((a,b)=>sRank(a.id)-sRank(b.id)||b.n-a.n||a.name.localeCompare(b.name));
}
function renderTop(){
  const n=countryCounts();
  const stores=storeList(),cur=S.store?stores.find(x=>x.id===S.store):null;
  const cname=S.country==='ALL'?'All countries':COUNTRIES[S.country].name;
  let seg=`<div class="pickrow"><button class="pick" data-act="cexp" aria-expanded="${S.cOpen}"><span class="pk">${S.country==='ALL'?'ALL':S.country}</span><span class="pn">${esc(cname)}</span><small>${n[S.country]} priced</small><span class="car" aria-hidden="true">${S.cOpen?'▴':'▾'}</span></button>`;
  if(S.country!=='ALL'&&S.tab==='compare')seg+=`<button class="pick two${cur?' on':''}" data-act="sexp" aria-expanded="${S.sOpen}"><span class="pl">I'm at</span><span class="pn">${esc(cur?short(cur.name):'Any store')}</span><span class="car" aria-hidden="true">${S.sOpen?'▴':'▾'}</span></button>`;
  if(S.country!=='ALL'&&S.tab==='compare'){const al=allStores(),off=al.filter(x=>isOff(x.id)).length;seg+=`<button class="pick two${off?' on':''}" data-act="fexp" aria-expanded="${S.fOpen}"><span class="pl">Stores</span><span class="pn">${off?(al.length-off)+' of '+al.length:'All'}</span><span class="car" aria-hidden="true">${S.fOpen?'▴':'▾'}</span></button>`}
  seg+=`</div>`;
  if(S.fOpen&&S.country!=='ALL')seg+=`<div class="chips stores" role="group" aria-label="Stores to include"><span class="sub" style="flex-basis:100%">Untick stores you don't use. They leave all comparisons.</span>${allStores().map(x=>`<button class="chip" data-act="stoff" data-s="${esc(x.id)}" aria-pressed="${!isOff(x.id)}">${esc(short(x.name))} <small>${x.n}</small></button>`).join('')}</div>`;
  if(S.cOpen)seg+=`<div class="seg" role="group" aria-label="Country">${[...CODES,'ALL'].map(c=>`<button data-act="country" data-c="${c}" aria-pressed="${S.country===c}">${c==='ALL'?'All':c}<small>${n[c]} priced</small></button>`).join('')}</div>`;
  if(S.sOpen)seg+=`<div class="chips stores" role="group" aria-label="Stores in ${esc(cname)}"><span class="sub" style="flex-basis:100%">Pick a shop to see only its prices.</span><button class="chip" data-act="store" data-s="" aria-pressed="${!S.store}">Any store</button>${stores.map(x=>`<button class="chip" data-act="store" data-s="${esc(x.id)}" aria-pressed="${S.store===x.id}">${esc(short(x.name))}${x.on?' <small class="on">online</small>':''} <small>${x.n}</small></button>`).join('')}${stores.length?'':'<span class="sub">No stores in this country yet. Add one from + Price.</span>'}</div>`;
  $('#seg').innerHTML=seg;
  const r=S.fx&&S.fx.rates;
  const hc=['EUR',...new Set(S.prices.map(x=>x.currency).filter(c=>c&&c!=='EUR')),'USD'].filter((c,i,A)=>A.indexOf(c)===i&&rate(c));
  $('#fxline').innerHTML=r?`<span class="hcl" role="group" aria-label="Show prices in">${hc.map(c=>`<button class="hc" data-act="home" data-c="${c}" aria-pressed="${home()===c}">${esc(CUR[c]||c)}</button>`).join('')}</span><span>1 € = ${FXCUR.map(c=>`<b>${esc(money(c,r[c]||0))}</b>`).join(' · ')}</span>`:'No FX rates set';
  const cats=['All',...new Set([...S.items.values()].map(i=>i.category).filter(Boolean))].sort((a,b)=>(a==='All'?-1:b==='All'?1:CATS.indexOf(a)-CATS.indexOf(b)));
  $('#chips').innerHTML=`<button class="chip" data-act="daily" aria-pressed="${S.daily}">Daily drivers</button><button class="chip" data-act="reorder" aria-pressed="${S.reorder}">Reorder</button>`+cats.map(c=>`<button class="chip" data-act="cat" data-c="${esc(c)}" aria-pressed="${S.cat===c}">${esc(c)}</button>`).join('');
  $('#tools').hidden=S.tab!=='compare';
  $('#nav').innerHTML=`<button data-act="tab" data-t="compare"${S.tab==='compare'?' aria-current="page"':''}>Compare</button><button class="add" data-act="add">+ Price</button><button data-act="tab" data-t="guide"${S.tab==='guide'?' aria-current="page"':''}>Guide</button><button data-act="tab" data-t="stores"${S.tab==='stores'?' aria-current="page"':''}>Stores</button><button data-act="tab" data-t="activity"${S.tab==='activity'?' aria-current="page"':''}>Data</button><button data-act="tab" data-t="setup"${S.tab==='setup'?' aria-current="page"':''}>Setup</button>`;
}
/* ---------- store stats (price related) ---------- */
const memStore=id=>{const r=S.retailers.get(id);return !!(r&&r.needs_membership)||HIDDEN_DEFAULT.has(id)};
const stOff=id=>isOff(id)&&!(S.stMem&&memStore(id)&&!(id in PREF));
function storeStats(){
  const stores=new Map(),spreads=[],cty={},cmap={};
  if(!S.D)return {list:[],spreads,cty:[]};
  const geo=a=>Math.exp(a.reduce((s,x)=>s+Math.log(x),0)/a.length);
  for(const [iid,arr] of S.D.byItem){
    const it=S.items.get(iid);if(!it)continue;
    /* best offer per store (cheapest product) */
    const best=new Map();
    for(const o of arr){
      if(o.eurUnit==null||!(o.eurUnit>0)||HIDE_RT.has(o.latest.retailer_id)||stOff(o.latest.retailer_id))continue;
      if(S.country!=='ALL'&&o.country!==S.country)continue;
      const k=o.latest.retailer_id,c=best.get(k);
      if(!c||o.eurUnit<c.eurUnit)best.set(k,o);
    }
    /* compare stores only inside their own country */
    const byC={};for(const o of best.values())(byC[o.country]=byC[o.country]||[]).push(o);
    for(const c in byC){
      const l=byC[c].sort((a,b)=>a.eurUnit-b.eurUnit);
      if(l.length<2)continue;
      const min=l[0].eurUnit,max=l[l.length-1].eurUnit,b=bl(l[0].latest.base_unit);
      spreads.push({it,country:c,lo:l[0],hi:l[l.length-1],sp:max/min-1,n:l.length,b});
      l.forEach((o,i)=>{
        const id=o.latest.retailer_id;
        let s=stores.get(id);if(!s){s={id,rt:o.rt,country:c,n:0,w:0,t3:0,last:0,ln:[],pcts:[],deals:0,wins:[],lasts:[],all:[]};stores.set(id,s)}
        const win=o.eurUnit<=min*1.005,ratio=o.eurUnit/min;
        s.n++;s.ln.push(ratio);s.all.push({it,o,ratio,rank:i+1,of:l.length});
        if(win){s.w++;const nx=l.find(x=>x.eurUnit>min*1.005);s.wins.push({it,o,gap:nx?nx.eurUnit/o.eurUnit-1:0,nx})}
        if(i<3)s.t3++;
        if(i===l.length-1&&l.length>=3){s.last++;s.lasts.push({it,o,ratio,lo:l[0]})}
        if(o.pct!=null)s.pcts.push(o.pct);
        if(isDeal(o.latest))s.deals++;
      });
    }
    /* country level: cheapest offer per country */
    const cb={};
    for(const o of arr){
      if(o.eurUnit==null||!(o.eurUnit>0)||HIDE_RT.has(o.latest.retailer_id)||stOff(o.latest.retailer_id))continue;
      if(!cb[o.country]||o.eurUnit<cb[o.country])cb[o.country]=o.eurUnit;
    }
    const cs=Object.keys(cb);
    for(const c of cs)(cmap[c]=cmap[c]||{})[iid]=cb[c];
    if(cs.length>=2){const m=Math.min(...cs.map(c=>cb[c]));for(const c of cs)(cty[c]=cty[c]||[]).push({it,ratio:cb[c]/m,v:cb[c]})}
  }
  const list=[...stores.values()].filter(s=>s.n>=3).map(s=>({...s,idx:geo(s.ln)-1,pc:s.pcts.length?s.pcts.reduce((a,b)=>a+b,0)/s.pcts.length:null,share:s.w/s.n}));
  const cl=Object.keys(cty).map(c=>{const r=cty[c],lo=r.filter(x=>x.ratio>1.005);return {c,n:r.length,w:r.length-lo.length,lose:lo.length,lidx:lo.length?geo(lo.map(x=>x.ratio))-1:0}}).filter(x=>x.n>=3);
  spreads.sort((a,b)=>b.sp-a.sp);
  return {list,spreads,cty:cl,cmap};
}
function viewStores(){
  const st=storeStats(),sort=S.stSort||'wins';
  const list=st.list.slice().sort(sort==='wins'?((a,b)=>b.share-a.share||b.w-a.w||a.idx-b.idx):((a,b)=>a.idx-b.idx||b.w-a.w));
  const maxIdx=Math.max(.2,...list.map(s=>s.idx));
  const hasMem=[...S.retailers.keys()].some(memStore);
  let h=`<h2 class="sec">Store scoreboard</h2><div class="sub">Each store's cheapest price per item, compared with the other stores in the same country. Needs 3+ shared items.</div>`;
  h+=`<div class="chips"><button class="chip" data-act="stsort" data-v="wins" aria-pressed="${sort==='wins'}">Cheapest most often</button><button class="chip" data-act="stsort" data-v="idx" aria-pressed="${sort==='idx'}">Lowest price level</button>${hasMem?`<button class="chip" data-act="stmem" aria-pressed="${!!S.stMem}">Incl. member stores</button>`:''}</div>`;
  if(!list.length)h+=`<div class="sub">Not enough shared prices yet in this scope.</div>`;
  else h+=`<div class="panel2" style="gap:12px">`+list.map(s=>{
    const r1=s.w,r23=Math.max(0,s.t3-s.w),rest=Math.max(0,s.n-s.t3);
    const pc=v=>(v/s.n*100).toFixed(1);
    return `<button class="stb" data-act="stdet" data-s="${esc(s.id)}" data-c="${s.country}"><div class="stt"><b>${esc(short(s.rt.name))}</b>${S.country==='ALL'?`<span class="pill">${s.country}</span>`:''}${memStore(s.id)?'<span class="pill">members</span>':''}<span class="stn">${s.w} of ${s.n} cheapest</span></div>`
      +`<div class="t" role="img" aria-label="${s.w} first, ${r23} top three, ${rest} lower"><i class="g" style="width:${pc(r1)}%"></i><i class="m" style="width:${pc(r23)}%"></i><i class="r" style="width:${pc(rest)}%"></i></div>`
      +`<div class="sts"><span>${s.idx<.005?'cheapest level':'<b>'+pctTxt(s.idx)+'</b> vs cheapest'}</span><span>${s.last?s.last+' priciest':'never priciest'}</span>${s.deals?`<span>${s.deals} promo</span>`:''}</div></button>`}).join('')
    +`<div class="lg"><span><i class="g"></i>cheapest</span><span><i class="m"></i>2nd–3rd</span><span><i class="r"></i>lower</span></div></div>`;
  /* spreads */
  const sp=st.spreads.filter(x=>x.sp>=.1).slice(0,8);
  if(sp.length){
    const mx=Math.max(...sp.map(x=>x.sp));
    h+=`<h2 class="sec">Where the store matters</h2><div class="sub">Items with the biggest gap between cheapest and priciest store.</div><div class="panel2">`
    +sp.map(x=>`<button class="spb" data-act="detail" data-key="${esc(x.lo.key)}"><div class="stt"><b>${esc(x.it.name)}</b><span class="stn">${S.country==='ALL'?x.country+' · ':''}${pctTxt(x.sp)}</span></div><div class="t"><i class="g" style="width:${(100/(1+mx)).toFixed(1)}%"></i><i class="r" style="width:${(100*(x.sp/(1+mx))).toFixed(1)}%"></i></div><div class="sts"><span>${esc(short(x.lo.rt.name))} <b>${mh(x.lo.eurUnit)}</b>/${x.b}</span><span>${esc(short(x.hi.rt.name))} <b>${mh(x.hi.eurUnit)}</b></span></div></button>`).join('')+`</div>`;
  }
  /* countries */
  {
    const cs=Object.keys(st.cmap).filter(c=>Object.keys(st.cmap[c]).length>=3);
    if(cs.length>=2){
      const ref=cs.includes(S.lvRef)?S.lvRef:(cs.includes(HOME)?HOME:cs[0]);
      const rows=cs.filter(c=>c!==ref).map(c=>{const ks=Object.keys(st.cmap[c]).filter(k=>st.cmap[ref][k]);const n=ks.length;
        return {c,n,idx:n>=3?Math.exp(ks.reduce((a,k)=>a+Math.log(st.cmap[c][k]/st.cmap[ref][k]),0)/n):null}}).filter(x=>x.idx!=null);
      h+=`<h2 class="sec">Price level by country</h2><div class="sub">Same items, cheapest price in each country. If a basket costs 100 in ${COUNTRIES[ref].name}, it costs:</div><div class="chips">${cs.map(c=>`<button class="chip" data-act="lvref" data-c="${c}" aria-pressed="${c===ref}">vs ${COUNTRIES[c].name}</button>`).join('')}</div>`;
      if(rows.length){const mx=Math.max(100,...rows.map(x=>x.idx*100));
        h+=`<div class="panel2"><div class="hb"><span>${COUNTRIES[ref].name}</span><div class="t"><i style="width:${(100/mx*100).toFixed(1)}%"></i></div><b>100</b></div>`+rows.sort((a,b)=>a.idx-b.idx).map(x=>`<div class="hb"><span>${COUNTRIES[x.c].name}</span><div class="t"><i class="${x.idx<1?'g':'r'}" style="width:${(x.idx*100/mx*100).toFixed(1)}%"></i></div><b>${Math.round(x.idx*100)}</b></div><div class="sub" style="margin-top:-4px">${x.n} shared items · ${x.idx<1?Math.round((1-x.idx)*100)+'% cheaper':Math.round((x.idx-1)*100)+'% more expensive'}</div>`).join('')+`</div>`;
      }else h+=`<div class="sub">Not enough items priced in both countries yet.</div>`;
    }
  }
  if(st.cty.length>=2){
    h+=`<h2 class="sec">Which country is cheapest</h2><div class="sub">For items priced in 2+ countries: in how many is each country the cheapest, and how much more expensive is it in the rest.</div><div class="panel2">`
    +st.cty.slice().sort((a,b)=>b.w/b.n-a.w/a.n).map(x=>`<div class="stb"><div class="stt"><b>${COUNTRIES[x.c].name}</b><span class="stn">cheapest on ${x.w} of ${x.n}</span></div><div class="t"><i class="g" style="width:${(x.w/x.n*100).toFixed(1)}%"></i></div><div class="sts"><span>${x.lose?'otherwise <b>'+pctTxt(x.lidx)+'</b> more expensive on average':'never more expensive'}</span></div></div>`).join('')+`</div>`;
  }
  return h;
}
function sheetStore(id,c){
  const s=storeStats().list.find(x=>x.id===id&&x.country===c);if(!s)return;
  const row=(it,o,t)=>`<button class="spb" data-act="detail" data-key="${esc(o.key)}"><div class="stt"><b>${esc(it.name)}</b><span class="stn">${t}</span></div><div class="sts"><span><b>${mh(o.eurUnit)}</b>/${bl(o.latest.base_unit)}</span>${o.latest.currency!==home()?`<span>${esc(money(o.latest.currency,o.latest.unit_price!=null?o.latest.unit_price:o.latest.amount))}</span>`:''}</div></button>`;
  let h=`<h2 class="sec" style="margin-top:0">${esc(short(s.rt.name))}</h2><div class="sub">${s.w} of ${s.n} items cheapest · ${s.idx<.005?'cheapest level':pctTxt(s.idx)+' vs cheapest'} · ${s.t3} in top 3</div>`;
  const w=s.wins.slice().sort((a,b)=>b.gap-a.gap);
  if(w.length)h+=`<h3 class="sec3">Cheapest here</h3><div class="panel2">`+w.slice(0,10).map(x=>row(x.it,x.o,x.nx?pctTxt(-x.gap/(1+x.gap))+' vs '+esc(short(x.nx.rt.name)):'')).join('')+`</div>`;
  const l=s.lasts.slice().sort((a,b)=>b.ratio-a.ratio);
  if(l.length)h+=`<h3 class="sec3">Priciest here</h3><div class="panel2">`+l.slice(0,8).map(x=>row(x.it,x.o,'+'+Math.round((x.ratio-1)*100)+'% vs '+esc(short(x.lo.rt.name)))).join('')+`</div>`;
  if(!w.length&&!l.length)h+=`<div class="sub">Always mid-pack.</div>`;
  h+=``;
  openSheet(h);
}
function render(){
  S.D=derive();
  renderTop();
  const v=$('#view');
  let h='';
  if(!S.db&&S.loaded===-1)h+=`<div class="banner">Cannot load prices here. Open in Claude, signed in.</div>`;
  else if(S.loaded<3)h+=`<div class="sub">Loading prices…</div>`;
  if(S.db&&!S.canWrite)h+=`<div class="banner">Read-only access.</div>`;
  h+=S.tab==='compare'?viewCompare():S.tab==='activity'?viewActivity():S.tab==='stores'?viewStores():S.tab==='guide'?viewGuide():viewSetup();
  v.innerHTML=h;
}
let raf=0;const sched=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;render()})};

/* ---------- sheet ---------- */
function openSheet(html){const s=$('#sheet');s.innerHTML=`<div class="scrim" data-act="close"></div><div class="panel"><div class="panel-in gut">${html}</div></div>`;s.classList.add('on');const p=$('.panel',s);if(p)p.scrollTop=0}
function closeSheet(){const s=$('#sheet');s.classList.remove('on');s.innerHTML='';S.photo=null}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#sheet').classList.contains('on'))closeSheet()});

function spark(rows){
  const pts=rows.filter(r=>!r.placeholder).map(r=>({t:Date.parse(r.observed_at),v:rowEur(r)})).filter(p=>p.v!=null&&isFinite(p.t)).sort((a,b)=>a.t-b.t);
  if(pts.length<2)return '';
  const W=300,H=64,pad=6,t0=pts[0].t,t1=pts[pts.length-1].t||t0+1,vs=pts.map(p=>p.v),lo=Math.min(...vs),hi=Math.max(...vs),rg=(hi-lo)||1;
  const X=t=>pad+(t1===t0?0:(t-t0)/(t1-t0))*(W-2*pad),Y=v=>H-pad-((v-lo)/rg)*(H-2*pad);
  const d=pts.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)).join(' ');
  const last=pts[pts.length-1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="EUR unit price over time, from ${mh(pts[0].v)} to ${mh(last.v)}"><line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="var(--line)" stroke-width="1"/><path d="${d}" fill="none" stroke="var(--fg)" stroke-width="2"/><circle cx="${X(last.t).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="4" fill="var(--tag)" stroke="var(--fg)" stroke-width="1.5"/></svg>`;
}
function sheetDetail(key){
  const o=S.D&&S.D.byItem.get((S.D.groups.get(key)||[{}])[0].item_id||'')?.find(x=>x.key===key);
  if(!o)return;
  const b=bl(o.latest.base_unit),pl=prodLabel(o.item,o.prod);
  const hist=o.rows.map((r,i)=>{
    const next=o.rows[i+1];let d='';
    if(next&&!r.placeholder&&!next.placeholder){const same=r.currency===next.currency,a=same?(r.unit_price!=null?r.unit_price:r.amount):r.eur_unit_price,c=same?(next.unit_price!=null?next.unit_price:next.amount):next.eur_unit_price;
      if(a!=null&&c>0){const p=(a-c)/c;d=Math.abs(p)<.005?'<span class="sub">unchanged</span>':`<span class="${p<0?'dn':'upc'}">${p<0?'▼':'▲'} ${pctTxt(p)}</span>`}}
    const eurAt=r.eur_unit_price!=null?r.eur_unit_price:r.eur_amount;
    const link=r.source_url?`<a href="${esc(r.source_url)}" target="_blank" rel="noopener">source link</a>`:'';
    return `<div class="h-row"><div class="o-main"><b>${esc(r.observed_at)}${r.date_precision==='year'?' (year only)':''}</b>
      <div class="badges"><span class="bd o-${originOf(r)}">${originOf(r)==='auto'?'Auto':'Yours'}</span><span class="bd src-${r.source_type}">${esc(SRC[r.source_type]||r.source_type)}</span>${isDeal(r)?`<span class="bd">${esc(dealTxt(r))}</span>`:''}${r.flag?'<span class="bd flag">Check</span>':''}${d}</div>
      ${noteHtml((r.promo&&!isDeal(r)?r.promo+'. ':'')+(r.source_note||''))}${link}${r.research_attempt?noteHtml('Auto '+stamp(r.research_attempt.at)+': '+(r.research_attempt.note||r.research_attempt.result)):''}<span class="sub">${esc(stamp(r.checked_at||r.created_at))}</span>${r.flag?`<span class="sub" style="color:var(--warn)">${esc(r.flag)}</span>`:''}${assessHtml(r.assess)}
      ${r.asset_id?`<a href="/_blob/${esc(r.asset_id)}" target="_blank" rel="noopener"><img alt="Photo of the price tag" src="/_blob/${esc(r.asset_id)}"></a>`:''}</div>
      <div class="o-price">${r.placeholder?'<small>no price yet</small>':`<span class="num">${money(r.currency,r.unit_price!=null?r.unit_price:r.amount)}${r.unit_price!=null?`<small>/${bl(r.base_unit)}</small>`:''}</span><small>${r.amount!=null&&r.unit_price!=null?'pack '+money(r.currency,r.amount)+(r.size?' · '+r.size+' '+r.size_unit:''):''}</small><small>${eurAt!=null&&r.currency!==home()?'then ≈ '+mh(eurAt):''}</small>`}</div></div>`}).join('');
  openSheet(`<div class="ph"><div><h3>${esc(o.item.name)}</h3><div class="sub">${esc([pl,o.rt.name,COUNTRIES[o.country]?COUNTRIES[o.country].name:o.country].filter(Boolean).join(' · '))}</div></div><button class="x" data-act="close">Close</button></div>
    <div class="prev"><span class="num">${priceCellInline(o)}</span><span class="sub">${esc(ago(o.latest))}${o.latest.placeholder?'':' · '+esc(SRC[o.latest.source_type]||'')}</span></div>
    ${spark(o.rows)}
    <div class="btns"><button class="btn pri" data-act="addprice" data-prod="${esc(o.prod.id)}" data-ret="${esc(o.rt.id)}" data-item="${esc(o.item.id)}">Record new price</button><button class="btn" data-act="req" data-item="${esc(o.item.id)}" data-prod="${esc(o.prod.id)}" data-ret="${esc(o.rt.id)}">Request check</button>${o.rt.url?`<a class="btn" href="${esc(o.rt.url)}" target="_blank" rel="noopener">Open shop</a>`:''}</div>
    ${nutBlock(o.prod)}
    <h2 class="sec" style="margin:4px 0 0">History, newest first</h2><div class="hist">${hist}</div>`);
}
function nutBlock(prod){
  const n=prod&&prod.nutrition;
  if(!n||!n.values)return `<div class="card"><h3>Nutrition</h3><span class="sub">No nutrition data yet.</span></div>`;
  const rows=NUT.filter(x=>n.values[x[0]]!=null).map(x=>`<tr><td>${esc(x[1])}</td><td>${n.values[x[0]]} ${x[2]}</td></tr>`).join('');
  return `<div class="card"><h3>Nutrition ${esc(n.basis||'')}</h3><table class="nut">${rows}</table><span class="sub">${esc(NSC[n.scope]||n.scope||'')}${n.form?' · '+esc(n.form):''} · ${esc(n.source_name||'')} ${n.source_url?`<a href="${esc(n.source_url)}" target="_blank" rel="noopener">source</a>`:''} · read ${esc(stamp(n.retrieved_at))}</span>${n.note?`<span class="sub">${esc(n.note)}</span>`:''}</div>`;
}
function priceCellInline(o){
  const r=o.latest,b=bl(r.base_unit);
  if(r.unit_price==null)return r.amount!=null?money(r.currency,r.amount)+' pack':'Needs price';
  return money(r.currency,r.unit_price)+'/'+b+(r.currency!==home()&&o.eurUnit!=null?'  ≈ '+mh(o.eurUnit)+'/'+b:'');
}

/* ---------- add price ---------- */
function unitOpts(base,sel){return (BASE_UNITS[base]||['g','kg','ml','l','pc']).map(u=>`<option value="${u}"${u===sel?' selected':''}>${u}</option>`).join('')}
function sheetAdd(pre){
  pre=pre||{};
  const items=[...S.items.values()].filter(i=>i.status!=='replaced').sort(byName);
  const cty=pre.country||(S.country==='ALL'?HOME:S.country);
  const order=[cty,...Object.keys(COUNTRIES).filter(c=>c!==cty)];
  const rets=[...S.retailers.values()];
  const retOpts=order.map(c=>{const l=rets.filter(r=>r.country===c).sort(byName);return l.length?`<optgroup label="${esc(COUNTRIES[c].name)}">${l.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</optgroup>`:''}).join('');
  openSheet(`<div class="ph"><h3>Record a price</h3><button class="x" data-act="close">Close</button></div>
  <div class="card"><div class="btns"><button class="btn dark" data-act="shoot">Photograph a tag</button><button class="btn" data-act="pick">Choose photo</button></div>
    <input id="photo-cam" type="file" accept="image/*" capture="environment" hidden><input id="photo-pick" type="file" accept="image/*" hidden>
    <div id="photo-st" class="sub">Claude reads the tag. You confirm before saving.</div><div id="photo-th"></div></div>
  <label class="fld"><span>Item</span><select id="f-item"><option value="">Choose item…</option>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}<option value="__new">+ New item…</option></select></label>
  <div id="new-item" class="sub-form" hidden><label class="fld"><span>Item name</span><input id="f-ni-name"></label><div class="row2"><label class="fld"><span>Category</span><select id="f-ni-cat">${CATS.map(c=>`<option>${c}</option>`).join('')}</select></label><label class="fld"><span>Compared per</span><select id="f-ni-base"><option value="kg">kg</option><option value="l">litre</option><option value="pc">piece</option><option value="100 m">100 m</option><option value="500 sheets">500 sheets</option></select></label></div></div>
  <label class="fld"><span>Product</span><select id="f-prod"><option value="">Choose item first</option></select></label>
  <div id="new-prod" class="sub-form" hidden><label class="fld"><span>Product name</span><input id="f-np-name"></label></div>
  <label class="fld"><span>Retailer</span><select id="f-ret"><option value="">Choose retailer…</option>${retOpts}<option value="__new">+ New retailer…</option></select></label>
  <div id="new-ret" class="sub-form" hidden><label class="fld"><span>Retailer name</span><input id="f-nr-name"></label><div class="row2"><label class="fld"><span>Country</span><select id="f-nr-country">${Object.keys(COUNTRIES).map(c=>`<option value="${c}"${c===cty?' selected':''}>${COUNTRIES[c].name}</option>`).join('')}</select></label><label class="fld"><span>Where</span><select id="f-nr-kind"><option value="offline">Store</option><option value="online">Online</option><option value="both">Both</option></select></label></div></div>
  <div class="row3"><label class="fld"><span>Pack price</span><input id="f-amount" inputmode="decimal" placeholder="0.00"></label><label class="fld"><span>Currency</span><select id="f-cur">${Object.keys(CUR).map(c=>`<option>${c}</option>`).join('')}</select></label><label class="fld"><span>Promo</span><input id="f-promo" placeholder="-10%"></label></div>
  <div class="row3"><label class="fld"><span>Pack size</span><input id="f-size" inputmode="decimal"></label><label class="fld"><span>Unit</span><select id="f-unit">${unitOpts('kg')}</select></label><label class="fld"><span>Or price per unit</span><input id="f-up" inputmode="decimal" placeholder="per kg / l / pc"></label></div>
  <div class="prev"><span class="sub" id="pv-l">Unit price</span><span class="num" id="pv">—</span></div>
  <div class="row3"><label class="fld"><span>Promo ends</span><input id="f-until" type="date"></label><label class="fld"><span>Regular price / unit</span><input id="f-reg" inputmode="decimal" placeholder="no promo"></label><label class="fld"><span>Needs program</span><select id="f-prog"><option value="">None</option>${S.prog.filter(p=>S.country==='ALL'||p.country===cty).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label></div>
  <div class="row2"><label class="fld"><span>Source</span><select id="f-src"><option value="manual">Manual entry</option><option value="photo">Photo</option><option value="research">Research</option></select></label><label class="fld"><span>Seen on</span><input id="f-date" type="date" value="${todayStr()}"></label></div>
  <label class="fld"><span>Source link</span><input id="f-url" inputmode="url" placeholder="https://…"></label>
  <label class="fld"><span>Note</span><input id="f-note" placeholder="Aisle, shelf, member price…"></label>
  <div class="btns"><button class="btn pri" id="f-save" data-act="saveprice"${S.canWrite?'':' disabled'}>Save price</button></div>`);
  const F=id=>document.getElementById(id);
  const baseOf=()=>{const v=F('f-item').value;return v==='__new'?F('f-ni-base').value:(S.items.get(v)||{}).base_unit||'kg'};
  const syncProducts=()=>{
    const v=F('f-item').value,it=S.items.get(v);F('new-item').hidden=v!=='__new';
    const prods=it?(it.products||[]):[];
    F('f-prod').innerHTML=v?`<option value="">Choose product…</option>${prods.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}<option value="__new">+ New product…</option>`:'<option value="">Choose item first</option>';
    if(v==='__new'){F('f-prod').innerHTML='<option value="__new">New product</option>'}
    if(prods.length===1)F('f-prod').value=prods[0].id;
    syncProd();
  };
  const syncProd=()=>{
    const v=F('f-prod').value,it=S.items.get(F('f-item').value);F('new-prod').hidden=v!=='__new';
    const p=it&&(it.products||[]).find(x=>x.id===v),base=baseOf(),cur=F('f-unit').value;
    F('f-unit').innerHTML=unitOpts(base,p&&p.size_unit&&BASE_UNITS[base].includes(p.size_unit)?p.size_unit:(BASE_UNITS[base].includes(cur)?cur:BASE_UNITS[base][0]));
    if(p&&p.size&&!F('f-size').value)F('f-size').value=p.size;
    preview();
  };
  let curTouched=false;
  const syncRet=()=>{
    const v=F('f-ret').value;F('new-ret').hidden=v!=='__new';
    const c=v==='__new'?F('f-nr-country').value:(S.retailers.get(v)||{}).country;
    if(c&&!curTouched)F('f-cur').value=COUNTRIES[c].cur;
  };
  const preview=()=>{
    const a=parseFloat(F('f-amount').value),s=parseFloat(F('f-size').value),u=F('f-unit').value,up0=parseFloat(F('f-up').value),cur=F('f-cur').value;
    const up=isFinite(up0)?up0:calcUnit(a,s,u),b=UNITS[u]?UNITS[u][0]:'kg';
    F('pv-l').textContent=isFinite(up0)?'Unit price as entered':'Unit price from pack';
    F('pv').textContent=up==null?'—':money(cur,up)+'/'+b+(cur!==home()&&toEur(cur,up)!=null?'  ≈ '+mh(toEur(cur,up)):'');
  };
  F('f-item').addEventListener('change',syncProducts);F('f-ni-base').addEventListener('change',syncProd);
  F('f-prod').addEventListener('change',syncProd);F('f-ret').addEventListener('change',syncRet);F('f-nr-country').addEventListener('change',syncRet);
  F('f-cur').addEventListener('change',()=>{curTouched=true;preview()});
  for(const id of ['f-amount','f-size','f-unit','f-up'])F(id).addEventListener('input',preview);
  const onFile=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)scanFile(f)};
  F('photo-cam').addEventListener('change',onFile);F('photo-pick').addEventListener('change',onFile);
  if(pre.item_id){F('f-item').value=pre.item_id;syncProducts();if(pre.product_id){F('f-prod').value=pre.product_id;syncProd()}}
  if(pre.retailer_id){F('f-ret').value=pre.retailer_id;syncRet()}
  else{const first=[...S.retailers.values()].find(r=>r.country===cty&&!r.starter);if(!pre.item_id&&first){/* leave blank so the choice is deliberate */}}
  if(!pre.retailer_id){F('f-cur').value=COUNTRIES[cty].cur}
}
async function shrink(file,max){
  let bmp;try{bmp=await createImageBitmap(file)}catch(x){bmp=await new Promise((ok,no)=>{const im=new Image(),u=URL.createObjectURL(file);im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=no;im.src=u})}
  const lg=Math.max(bmp.width,bmp.height),sh=Math.min(bmp.width,bmp.height),s=Math.min(1,Math.max((max||1600)/lg,1200/sh),4000/lg),c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(bmp.width*s));c.height=Math.max(1,Math.round(bmp.height*s));const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);cx.drawImage(bmp,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,'image/jpeg',.85));
}
async function scanFile(file){
  const F=id=>document.getElementById(id),st=F('photo-st');
  let blob;try{blob=await shrink(file)}catch(e){st.textContent='This image could not be read. Try another photo.';return}
  S.photo={blob,url:URL.createObjectURL(blob)};
  F('photo-th').innerHTML=`<div class="thumb"><img alt="Chosen photo" src="${S.photo.url}"><span class="sub">Photo attached as the source.</span></div>`;
  F('f-src').value='photo';
  if(!S.sample||!S.imgOK){st.textContent='Photo attached. Fill in the price by hand; reading photos is not available in this view.';return}
  st.textContent='Reading the tag…';
  const items=[...S.items.values()].map(i=>i.id+': '+i.name).join('\n'),rets=[...S.retailers.values()].map(r=>r.id+': '+r.name+' ('+r.country+')').join('\n');
  const prompt=`You are reading a photo of a shelf price tag or product package in a shop in ${NAMES}. Extract only what is printed.

Known items (id: name):
${items}

Known retailers (id: name):
${rets}

Reply with only one JSON object: {"item_id": string|null, "product_name": string|null, "brand": string|null, "retailer_id": string|null, "retailer_name": string|null, "price": number|null, "currency": ${QCUR}|null, "size": number|null, "size_unit": "g"|"kg"|"ml"|"l"|"pc"|null, "unit_price": number|null, "promo": string|null, "notes": string|null}
price is the pack price as sold. unit_price is the per kg, litre or piece price printed on the tag (Grundpreis, 단가, 單價) if there is one. Use item_id and retailer_id only when they clearly match a known entry. Use null for anything you cannot read. Do not guess.`;
  try{
    const o=await S.sample.json(prompt,{images:[blob],cache:false});
    applyScan(o||{});
  }catch(e){
    st.textContent=e&&e.code==='not_granted'?'Photo reading was not allowed. Fill in the price by hand.':e&&e.code==='rate_limited'?'Too many reads. Wait a moment, or fill it in by hand.':'Could not read the tag. Fill in the price by hand.';
  }
}
function applyScan(o){
  const F=id=>document.getElementById(id),st=F('photo-st');
  const set=(id,v)=>{if(v!=null&&v!=='')F(id).value=v};
  if(o.item_id&&S.items.has(o.item_id)){F('f-item').value=o.item_id;F('f-item').dispatchEvent(new Event('change'))}
  else if(o.product_name){F('f-item').value='__new';F('f-item').dispatchEvent(new Event('change'));set('f-ni-name',o.product_name)}
  if(F('f-prod').value===''&&o.product_name&&F('f-item').value&&F('f-item').value!=='__new'){F('f-prod').value='__new';F('f-prod').dispatchEvent(new Event('change'));set('f-np-name',[o.brand,o.product_name].filter(Boolean).join(' '))}
  if(F('f-item').value==='__new')set('f-np-name',[o.brand,o.product_name].filter(Boolean).join(' '));
  if(o.retailer_id&&S.retailers.has(o.retailer_id)){F('f-ret').value=o.retailer_id;F('f-ret').dispatchEvent(new Event('change'))}
  else if(o.retailer_name){F('f-ret').value='__new';F('f-ret').dispatchEvent(new Event('change'));set('f-nr-name',o.retailer_name)}
  if(o.currency&&CUR[o.currency])F('f-cur').value=o.currency;
  set('f-amount',o.price);set('f-promo',o.promo);set('f-size',o.size);
  if(o.size_unit&&[...F('f-unit').options].some(x=>x.value===o.size_unit))F('f-unit').value=o.size_unit;
  set('f-up',o.unit_price);
  const n=['Photo read by Claude, check the values.'];if(o.notes)n.push(o.notes);F('f-note').value=n.join(' ');
  F('f-amount').dispatchEvent(new Event('input'));
  st.textContent='Filled from the photo. Check every field, then save.';
}
async function savePrice(){
  const F=id=>document.getElementById(id),btn=F('f-save');
  const v=k=>F(k).value.trim(),num=k=>{const x=parseFloat(v(k).replace(',','.'));return isFinite(x)?x:null};
  const iv=v('f-item'),pv=v('f-prod'),rv=v('f-ret');
  if(!iv)return toast('Choose an item');
  if(iv==='__new'&&!v('f-ni-name'))return toast('Name the new item');
  if(!pv)return toast('Choose a product');
  if(pv==='__new'&&!v('f-np-name'))return toast('Name the new product');
  if(!rv)return toast('Choose a store');
  if(rv==='__new'&&!v('f-nr-name'))return toast('Name the store');
  const amount=num('f-amount'),size=num('f-size'),unit=v('f-unit'),upIn=num('f-up');
  if(amount==null&&upIn==null)return toast('Enter a price');
  btn.disabled=true;btn.textContent='Saving…';
  try{
    const db=S.db;let item=S.items.get(iv),itemDirty=false;
    if(iv==='__new'){let id=slug(v('f-ni-name'));while(S.items.has(id))id+='-2';item={id,name:v('f-ni-name'),category:v('f-ni-cat'),base_unit:v('f-ni-base'),status:'active',products:[],sort:(Math.max(0,...catList(v('f-ni-cat')).map(x=>x.sort||0))+10),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};itemDirty=true}
    let prod=(item.products||[]).find(p=>p.id===pv);
    if(pv==='__new'){let id=item.id+'-'+slug(v('f-np-name')),n=2;const base=id;while((item.products||[]).some(p=>p.id===id))id=base+'-'+n++;prod={id,name:v('f-np-name')};if(size!=null){prod.size=size;prod.size_unit=unit}item={...item,products:[...(item.products||[]),prod]};itemDirty=true;if(iv!=='__new')item={...item,updated_at:new Date().toISOString()}}
    let ret=S.retailers.get(rv),retDirty=false;
    if(rv==='__new'){let id=slug(v('f-nr-name')+'-'+v('f-nr-country'));while(S.retailers.has(id))id+='-2';ret={id,name:v('f-nr-name'),country:v('f-nr-country'),kind:v('f-nr-kind'),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};retDirty=true}
    if(itemDirty){const {id,...rest}=item;await db.doc('items/'+id).set(rest)}
    if(retDirty){const {id,...rest}=ret;await db.doc('retailers/'+id).set(rest)}
    let asset=null;
    if(S.photo&&S.assets){try{asset=(await S.assets.upload(S.photo.blob,{type:'image/jpeg'})).id}catch(e){toast('Price saved, photo not stored')}}
    const cur=v('f-cur'),base=item.base_unit,computed=calcUnit(amount,size,unit),up=upIn!=null?upIn:computed,fx=cur==='EUR'?null:rate(cur);
    const src=asset?'photo':v('f-src');
    const doc={item_id:item.id,product_id:prod.id,retailer_id:ret.id,country:ret.country,currency:cur,base_unit:base,observed_at:v('f-date')||todayStr(),source_type:src,origin:'user',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const regIn=num('f-reg'),opt={promo_until:v('f-until')||null,regular_unit_price:regIn,requires_program:v('f-prog')||null,amount,size:size!=null?size:null,size_unit:size!=null?unit:null,unit_price:up!=null?Math.round(up*1e6)/1e6:null,promo:v('f-promo')||null,source_url:v('f-url')||null,source_note:v('f-note')||null,asset_id:asset,fx_per_eur:fx,
      eur_amount:amount!=null&&(cur==='EUR'||fx)?Math.round(amount/(fx||1)*1e6)/1e6:null,eur_unit_price:up!=null&&(cur==='EUR'||fx)?Math.round(up/(fx||1)*1e6)/1e6:null};
    for(const k in opt)if(opt[k]!=null)doc[k]=opt[k];
    if(up==null)doc.flag='Pack size missing, no unit price';
    await db.doc('prices/'+uid()).set(doc);
    toast('Price saved');closeSheet();
    S.open.add(item.id);
  }catch(e){btn.disabled=false;btn.textContent='Save price';toast(errTxt(e))}
}

/* ---------- shelf scan: many tags per photo ---------- */
const SC={shots:[],rows:[],seq:0,text:'',pr:''};
const sid=()=>'s'+(++SC.seq);
const UNIT_GUESS={g:'kg',kg:'kg',ml:'l',l:'l',pc:'pc',m:'100 m',sheet:'500 sheets'};
function scanShell(inner){const p=$('#sheet .panel-in');if(p)p.innerHTML=inner}
function openScan(){
  SC.shots=[];SC.rows=[];SC.pr='';
  openSheet('');scanDraw();
}
function scanDraw(){
  if(!$('#sheet').classList.contains('on'))return;
  const done=SC.shots.filter(s=>s.st==='done').length,busy=SC.shots.some(s=>s.st==='reading'||s.st==='queued');
  const ev=SC.rows.map(r=>({r,e:evalRow(r)}));
  const sel=ev.filter(x=>x.r.on&&x.e.ok),clean=ev.filter(x=>x.e.ok&&!x.r.conv);
  const canPhoto=!!(S.sample&&S.imgOK);
  let h=`<div class="ph"><h3>Add prices</h3><button class="x" data-act="close">Close</button></div>
 <div class="card">${canPhoto?`<div class="btns"><button class="btn dark" data-act="sc-cam">Take photo</button><button class="btn" data-act="sc-pick">Choose photos</button><button class="btn" data-act="sc-clip">Paste</button><button class="btn" data-act="manual">Enter by hand</button></div>`:`<div class="banner">Photo reading unavailable here. Paste text or enter by hand. <button class="lk" data-act="manual">Enter by hand</button></div>`}
  ${canPhoto?`<div id="sc-paste" class="pastebox" contenteditable="true" inputmode="none" role="textbox" aria-label="Paste a photo or screenshot here" spellcheck="false">Paste or drop a photo or screenshot here<small>Paste an image (Ctrl/⌘+V, or long-press → Paste).</small></div>
  <input id="sc-cam" type="file" accept="image/*" capture="environment" hidden><input id="sc-pick" type="file" accept="image/*" multiple hidden>
  <div class="sub">Photo of shelf, tags or receipt. Nothing is saved until you accept.</div>`:''}</div>
  <div class="card"><b>Paste text instead</b><div class="sub">Paste a table, notes or LLM answer. Shelfwatch JSON imports as is.</div>
  <textarea id="sc-text" class="brq" rows="5" placeholder="Paste here…" spellcheck="false">${esc(SC.text)}</textarea>
  <div class="btns"><button class="btn dark" data-act="sc-text">Read text</button><button class="btn" data-act="sc-prompt">Copy research prompt</button></div>
  ${SC.pr?`<div class="sub">Copy blocked here. Select all and copy:</div><textarea class="brq" rows="6" readonly onfocus="this.select()">${esc(SC.pr)}</textarea>`:''}</div>`;
  if(SC.shots.length)h+=`<div class="shots">${SC.shots.map(s=>`<div class="shot ${s.st}">${s.url?`<img alt="" src="${s.url}">`:'<span class="sub">Text</span>'}<small>${s.st==='done'?s.n+' tags':s.st==='error'?'failed':s.st==='reading'?'reading…':'queued'}</small></div>`).join('')}</div>`;
  const groups=SC.shots.filter(s=>s.st==='done'||s.st==='error');
  for(const s of groups){
    const rows=ev.filter(x=>x.r.shot===s.id);
    h+=`<div class="sgrp"><div class="sg-h">${!s.sid||(s.sid==='__new'&&!(s.newName||'').trim())?`<div class="banner bad">Store needed. ${s.store_evidence?'Seen: '+esc(s.store_evidence)+'.':''}</div>`:''}<label class="fld"><span>Store for this ${s.blob?'photo':'text'}${s.sid&&s.store_evidence?' · detected: '+esc(s.store_evidence):''}</span><select data-sf="store" data-shot="${s.id}">${storeOpts(s)}</select></label>${s.sid==='__new'?`<div class="row2"><label class="fld"><span>New store name</span><input data-sf="newname" data-shot="${s.id}" value="${esc(s.newName||'')}"></label><label class="fld"><span>Country</span><select data-sf="newcty" data-shot="${s.id}">${Object.keys(COUNTRIES).map(c=>`<option value="${c}"${(s.newCty||'KR')===c?' selected':''}>${COUNTRIES[c].name}</option>`).join('')}</select></label></div>`:''}</div>
    ${s.st==='error'?`<div class="banner">${esc(s.err||'Could not read this photo.')} <button class="lk" data-act="sc-retry" data-shot="${s.id}">Try again</button></div>`:''}
    ${rows.map(x=>scanRow(x.r,x.e)).join('')||(s.st==='done'?'<div class="sub">No price tags found.</div>':'')}<div class="btns" style="padding:6px 12px"><button class="btn" data-act="sc-add" data-shot="${s.id}">+ Add item here</button></div></div>`;
  }
  if(SC.rows.length)h+=`<div class="sbar"><div><b>${sel.length}</b> selected <span class="sub">· ${clean.length} ready · ${SC.rows.length-clean.length} to check</span></div><div class="btns"><button class="btn" data-act="sc-clean">Select all ready</button><button class="btn pri" data-act="sc-save"${sel.length&&S.canWrite&&!busy?'':' disabled'}>Save ${sel.length}</button></div></div>`;
  else if(busy)h+=`<div class="sub">Reading photos…</div>`;
  scanShell(h);
}
function storeOpts(s){
  const cty=s.cty||(S.country==='ALL'?null:S.country),rets=[...S.retailers.values()];
  const order=[...(cty?[cty]:[]),...Object.keys(COUNTRIES).filter(c=>c!==cty)];
  return `<option value=""${!s.sid?' selected':''}>Choose store…</option>`+order.map(c=>{const l=rets.filter(r=>r.country===c&&!HIDE_RT.has(r.id)).sort((a,b)=>sRank(a.id)-sRank(b.id)||byName(a,b));return l.length?`<optgroup label="${esc(COUNTRIES[c].name)}">${l.map(r=>`<option value="${esc(r.id)}"${s.sid===r.id?' selected':''}>${esc(r.name)}</option>`).join('')}</optgroup>`:''}).join('')+`<option value="__new"${s.sid==='__new'?' selected':''}>+ New store…</option>`;
}
const med2=a=>{const t=[...a].sort((x,y)=>x-y),m=t.length>>1;return t.length%2?t[m]:(t[m-1]+t[m])/2};
function evalRow(r){
  const shot=SC.shots.find(s=>s.id===r.shot)||{};
  const ret=shot.sid&&shot.sid!=='__new'?S.retailers.get(shot.sid):null;
  const rcty=ret?ret.country:(shot.sid==='__new'?(shot.newCty||HOME):null);
  const item=r.item_id&&r.item_id!=='__new'?S.items.get(r.item_id):null;
  const cur=r.cur||(rcty?COUNTRIES[rcty].cur:null);
  const base=item?item.base_unit:(UNIT_GUESS[r.unit]||r.base_unit||'kg');
  autoConvert(r,item);
  const flags=[];const F=(t,sev)=>flags.push({t,sev});r._last=null;
  if(r.conv)flags.push({t:'Converted '+r.conv.from+' → '+r.conv.to,sev:1});
  const price=r.price>0?r.price:null,uconv=UNITS[r.unit];
  let comp=null;const mism=!!(uconv&&uconv[0]!==base&&r.size>0);
  if(price&&r.size>0&&uconv&&!mism)comp=calcUnit(price,r.size,r.unit);
  if(mism)F('Unit does not match '+base,2);
  const printed=r.up>0?r.up:null;
  let up=printed!=null?printed:comp;
  if(printed&&comp&&Math.abs(printed/comp-1)>.06)F('Tag unit price ≠ price ÷ size',1);
  if(!price&&!printed)F('No price read',2);
  if(up==null&&(price||printed)&&!mism)F('No unit price (size missing)',2);
  if(r.conf!=null&&r.conf<.7)F('Low confidence',1);
  if(!ret&&shot.sid!=='__new')F('Choose a store',2);
  if(shot.sid==='__new'&&!(shot.newName||'').trim())F('Name the store',2);
  if(!cur)F('Currency?',2);
  else if(rcty&&COUNTRIES[rcty].cur!==cur)F('Currency differs from store country',1);
  if(cur&&cur!=='EUR'&&!rate(cur))F('No exchange rate for '+cur,2);
  if(!item&&!(r.name||'').trim())F('Name the product',2);
  if(!item)F('New item',1);
  const dup=SC.rows.find(o=>SC.rows.indexOf(o)<SC.rows.indexOf(r)&&o.shot&&o.item_id===r.item_id&&r.item_id&&o.product_id===r.product_id&&(SC.shots.find(s=>s.id===o.shot)||{}).sid===shot.sid&&o.price===r.price);
  if(dup)F('Duplicate in this scan',1);
  const eur=up!=null&&cur?toEur(cur,up):null;
  let status='new',pct=null,verdict='',best=null;
  const cty=rcty;
  if(item&&S.D){
    const offs=(S.D.byItem.get(item.id)||[]).filter(o=>o.country===cty&&o.eurUnit!=null&&o.latest.retailer_id!==(ret&&ret.id));
    if(offs.length&&eur!=null){
      best=offs.reduce((a,b)=>b.eurUnit<a.eurUnit?b:a);
      const m=med2(offs.map(o=>o.eurUnit));
      if(eur<=best.eurUnit*1.005)verdict='cheapest';else verdict='+'+Math.round((eur/best.eurUnit-1)*100)+'% vs '+best.rt.name;
      if(eur>m*3||eur<m/3)F('Far from usual price',1);
    }else if(eur!=null)verdict='first';
    const pid=r.product_id&&(item.products||[]).some(p=>p.id===r.product_id)?r.product_id:null;
    if(ret&&pid){const rows=(S.D.groups.get(pid+'|'+ret.id)||[]).filter(x=>!x.placeholder).sort(cmpDesc);const l=rows[0];
      if(l&&l.unit_price!=null&&up!=null&&l.currency===cur){const d=up/l.unit_price-1;if(Math.abs(d)<=.01){status='same'}else{status='changed';pct=d}}
      if(status!=='new'){r._last=l.id}}
  }
  if(r.promo&&!r.until)flags.push({t:'Promo has no end date',sev:0});
  const blocking=flags.some(f=>f.sev>=2),clean=!flags.some(f=>f.sev>=1);
  return {ok:!blocking,clean,flags,mism,up,eur,cur,base,status,pct,verdict,best,item,ret,rcty};
}
const BASE_UN={kg:['g','kg'],l:['ml','l'],pc:['pc'],'100 m':['m'],'500 sheets':['sheet']};
function fixBox(r,e){
  const sz=e.flags.some(f=>/size missing|Unit does not match/.test(f.t));
  if(!sz)return '';
  const us=BASE_UN[e.base]||['g'],cur=us.includes(r.unit)?r.unit:us[us.length-1];
  const what=e.base==='pc'?'Pieces in pack?':e.base==='l'?'Volume of pack?':'Weight of pack?';
  const why=e.mism?`Read as ${esc(r.size+' '+r.unit)}; this item is per ${e.base==='pc'?'piece':e.base}. `:'No size. ';
  return `<div class="fixbox" style="grid-column:1/-1;margin-left:34px"><div class="sub">${why}${what}</div><div class="fxr"><input id="fx-s-${r.id}" inputmode="decimal" placeholder="${e.base==='pc'?'e.g. 20':'e.g. 500'}" value="${e.mism?'':(r.size??'')}"><select id="fx-u-${r.id}">${us.map(u=>`<option value="${u}"${u===cur?' selected':''}>${u==='pc'?'pieces':u}</option>`).join('')}</select><button class="btn pri" data-act="sc-fix" data-id="${r.id}">Apply</button></div></div>`;
}
function scanRow(r,e){
  const it=e.item,nm=r.name||'(unnamed tag)';
  const chips=[];
  if(e.verdict==='cheapest')chips.push('<span class="ft g">Cheapest</span>');
  else if(e.verdict==='first')chips.push('<span class="ft">First price</span>');
  else if(e.verdict)chips.push(`<span class="ft w">${esc(e.verdict)}</span>`);
  if(e.status==='same')chips.push('<span class="ft">Unchanged · refresh date</span>');
  else if(e.status==='changed')chips.push(`<span class="ft ${e.pct<0?'g':'w'}">${e.pct<0?'▼':'▲'} ${pctTxt(e.pct)} vs last</span>`);
  if(r.promo)chips.push(`<span class="ft">${esc(r.promo)}${r.until?' · until '+esc(r.until.slice(5)):''}</span>`);
  for(const f of e.flags)if(f.sev>=1)chips.push(`<span class="ft w2${f.sev>=2?' bad':''}">${esc(f.t)}</span>`);
  const sub=[it?it.name:'No match',r.size?r.size+' '+r.unit:'',r.price?money(e.cur||'EUR',r.price):''].filter(Boolean).join(' · ');
  const bl=e.flags.filter(f=>f.sev>=2).map(f=>f.t);
  const cv=r.conv?`<span class="convbox"><b>${r.conv.est?'Estimated conversion':'Converted'}:</b> ${esc(r.conv.from)} → <b>${esc(r.conv.to)}</b> per ${e.base==='pc'?'piece':e.base} (${esc(r.conv.how)}). Check, then tick. <button class="lk" data-act="sc-unconv" data-id="${r.id}">Undo</button></span>`:'';
  if(!e.ok&&!r.seen){r.seen=true;r.exp=true}
  let h=`<div class="srow${e.clean?'':' chk'}${r.on?' on':''}"><label class="ck"${e.ok?'':` data-act="sc-why" data-id="${r.id}"`}><input type="checkbox" data-sf="on" data-id="${r.id}"${r.on?' checked':''}${e.ok?'':' disabled'} aria-label="Accept ${esc(nm)}"></label>
  <button class="sbody" data-act="sc-exp" data-id="${r.id}"><b>${esc((r.brand?r.brand+' ':'')+nm)}</b><span class="sub">${esc(sub)}</span><span class="fts" style="padding:0">${chips.join('')}</span>${cv}${bl.length?`<span class="why">Fix: ${esc(bl.join('; '))}.</span>`:''}</button>
  <div class="rc"><button data-act="sc-up" data-id="${r.id}" aria-label="Move up">↑</button><button data-act="sc-down" data-id="${r.id}" aria-label="Move down">↓</button><button data-act="sc-drop" data-id="${r.id}" aria-label="Remove">✕</button></div>
  <div class="sprice">${e.eur!=null?`<span class="num">${mh(e.eur)}</span><small>/${e.base}${e.cur&&e.cur!==home()&&e.up!=null?' · '+money(e.cur,e.up):''}</small>`:'<small class="nx">no unit price</small>'}</div>${fixBox(r,e)}</div>`;
  if(r.exp){
    const items=[...S.items.values()].filter(i=>i.status!=='replaced').sort(byName);
    const prods=it?(it.products||[]):[];
    const o=(v,t,sel)=>`<option value="${esc(v)}"${sel?' selected':''}>${esc(t)}</option>`;
    h+=`<div class="sedit"><label class="fld"><span>Item</span><select data-sf="f" data-k="item_id" data-id="${r.id}">${o('','Choose…',!r.item_id)}${items.map(i=>o(i.id,i.name,r.item_id===i.id)).join('')}${o('__new','+ New item',r.item_id==='__new')}</select></label>
    ${it?`<label class="fld"><span>Product</span><select data-sf="f" data-k="product_id" data-id="${r.id}">${prods.map(p=>o(p.id,p.name,r.product_id===p.id)).join('')}${o('','+ New product from tag name',!r.product_id||!prods.some(p=>p.id===r.product_id))}</select></label>`:''}
    <label class="fld"><span>Tag name</span><input data-sf="f" data-k="name" data-id="${r.id}" value="${esc(r.name||'')}"></label>
    <div class="row3"><label class="fld"><span>Pack price</span><input inputmode="decimal" data-sf="f" data-k="price" data-id="${r.id}" value="${r.price??''}"></label><label class="fld"><span>Currency</span><select data-sf="f" data-k="cur" data-id="${r.id}">${Object.keys(CUR).map(c=>o(c,c,(e.cur||'')===c)).join('')}</select></label><label class="fld"><span>Promo</span><input data-sf="f" data-k="promo" data-id="${r.id}" value="${esc(r.promo||'')}"></label></div>
    <div class="row3"><label class="fld"><span>Size</span><input inputmode="decimal" data-sf="f" data-k="size" data-id="${r.id}" value="${r.size??''}"></label><label class="fld"><span>Unit</span><select data-sf="f" data-k="unit" data-id="${r.id}">${['g','kg','ml','l','pc','m','sheet'].map(u=>o(u,u,r.unit===u)).join('')}</select></label><label class="fld"><span>Tag unit price</span><input inputmode="decimal" data-sf="f" data-k="up" data-id="${r.id}" value="${r.up??''}"></label></div>
    <div class="btns"><button class="btn" data-act="sc-drop" data-id="${r.id}">Remove this tag</button></div></div>`;
  }
  return h;
}
function scanPrompt(shot){
  const items=[...S.items.values()].filter(i=>i.status!=='replaced'&&i.status!=='not_needed').map(i=>`${i.id} | ${i.name} | per ${i.base_unit} | ${(i.products||[]).map(p=>p.id+':'+p.name+(p.size?' '+p.size+p.size_unit:'')).join('; ')}`).join('\n');
  const rets=[...S.retailers.values()].map(r=>`${r.id} | ${r.name} | ${r.country}`).join('\n');
  const hint=S.store&&S.retailers.get(S.store)?`The person says they are currently in: ${S.retailers.get(S.store).name} (${S.retailers.get(S.store).country}).`:S.country!=='ALL'?`The person is probably in ${COUNTRIES[S.country].name}.`:'';
  return `You are reading a photo taken in a shop (or of a receipt) in ${NAMES}. Today is ${todayStr()}. ${hint}
Find EVERY price tag or priced product that is legible in the photo, however many there are, and extract only what is printed. Read the local language of each country. Also identify the store from signage, logos, tag design, bags or the receipt header.

Known items (id | name | compared per | products id:name size):
${items}

Known stores (id | name | country):
${rets}

Reply with only one JSON object:
{"store":{"retailer_id":string|null,"name":string|null,"country":${QCTY}|null,"evidence":string|null},
"tags":[{"name":string,"brand":string|null,"item_id":string|null,"product_id":string|null,"category":"Food"|"Household"|"Skincare"|"Dental"|"Grooming"|null,"size":number|null,"size_unit":"g"|"kg"|"ml"|"l"|"pc"|"m"|"sheet"|null,"price":number|null,"currency":${QCUR}|null,"unit_price":number|null,"promo":string|null,"promo_until":"YYYY-MM-DD"|null,"member_only":boolean,"confidence":number}]}
Rules: price is the pack price as sold (the member or sale price if that is what is shown, with promo text). unit_price is the printed price per kg, litre or piece (단가, 100g당, 單價, Grundpreis) normalised to per kg, per litre or per piece, or null if not printed. size is the pack content, for example 500 with unit g, or 6 with unit pc for a 6-pack. item_id and product_id only when they clearly match a known entry. Use null for anything you cannot read. For multi-buy offers (1+1, 2+1, 2 for the price of 1) report the shelf price of ONE pack as price and put the offer text in promo. Never guess a number. confidence is 0 to 1 for how sure you are the row is read correctly. Skip things that are not food, household or personal-care staples only if they are clearly unreadable.`;
}
async function scanOne(shot){
  shot.st='reading';scanDraw();
  try{
    const o=await S.sample.json(scanPrompt(shot),{images:[shot.blob],cache:false});
    const st=(o&&o.store)||{};shot.store_evidence=st.evidence||st.name||'';
    let id=st.retailer_id&&S.retailers.has(st.retailer_id)?st.retailer_id:null;
    if(!id&&st.name){const n=st.name.toLowerCase();const m=[...S.retailers.values()].find(r=>r.name.toLowerCase().includes(n)||n.includes(r.name.toLowerCase().split(' (')[0]));if(m)id=m.id}
    if(!id&&S.store&&S.retailers.has(S.store))id=S.store;
    if(!id){const prev=[...SC.shots].reverse().find(s=>s!==shot&&s.sid&&s.sid!=='__new');if(prev&&!st.name)id=prev.sid}
    if(id){shot.sid=id;shot.cty=S.retailers.get(id).country}
    else if(st.name){shot.sid='__new';shot.newName=st.name;shot.newCty=st.country||(S.country!=='ALL'?S.country:HOME);shot.cty=shot.newCty}
    else shot.sid='';
    const tags=Array.isArray(o&&o.tags)?o.tags:[];
    shot.n=tags.length;
    for(const t of tags){
      const r={id:'t'+(++SC.seq),shot:shot.id,name:t.name||'',brand:t.brand||'',item_id:t.item_id&&S.items.has(t.item_id)?t.item_id:'',product_id:t.product_id||'',category:t.category||'Food',size:t.size>0?t.size:null,unit:t.size_unit||'kg',price:t.price>0?t.price:null,cur:t.currency||null,up:t.unit_price>0?t.unit_price:null,promo:(t.promo&&isDeal({promo:t.promo,promo_until:t.promo_until}))?t.promo:'',until:t.promo_until||'',conf:typeof t.confidence==='number'?t.confidence:null,exp:false,on:false};
      const it=r.item_id&&S.items.get(r.item_id);if(it){if(!(it.products||[]).some(p=>p.id===r.product_id))r.product_id=(it.products||[]).length===1?it.products[0].id:''}
      if(t.promo&&!r.promo)r.src_note=((r.src_note?r.src_note+' · ':'')+t.promo);
  if(!r.size){const g=guessSize(r.name);if(g){r.size=g.size;r.unit=g.unit;r.guessed=true}}
      SC.rows.push(r);
    }
    for(const r of SC.rows)if(r.shot===shot.id){const e=evalRow(r);r.on=e.ok&&!r.conv}
    shot.st='done';
  }catch(e){
    shot.st='error';shot.err=e&&e.code==='not_granted'?'Photo reading was not allowed.':e&&e.code==='rate_limited'?'Too many reads. Wait a moment.':'Could not read this photo.';
  }
  scanDraw();
}
const FMT='shelfwatch-import/1';
function schemaTxt(){return `{"format":"${FMT}","records":[{"store":{"retailer_id":string|null,"name":string,"country":${QCTY}},"item_id":string|null,"item_name":string,"category":"Food"|"Household"|"Skincare"|"Dental"|"Grooming","base_unit":"kg"|"l"|"pc"|"100 m"|"500 sheets","product_id":string|null,"product_name":string,"brand":string|null,"size":number,"size_unit":"g"|"kg"|"ml"|"l"|"pc"|"m"|"sheet","price":number,"currency":${QCUR},"unit_price":number|null,"promo":string|null,"promo_until":"YYYY-MM-DD"|null,"member_only":boolean,"observed_at":"YYYY-MM-DD","source_url":string|null,"source_note":string|null,"confidence":number,"assessment":{"level":"ok"|"watch"|"flag","note":string}|null}]}`}
function knownTxt(){
  const items=[...S.items.values()].filter(i=>i.status!=='replaced'&&i.status!=='not_needed').map(i=>`${i.id} | ${i.name} | per ${i.base_unit} | ${(i.products||[]).map(p=>p.id+':'+p.name+(p.size?' '+p.size+p.size_unit:'')).join('; ')}`).join('\n');
  const rets=[...S.retailers.values()].filter(r=>!HIDE_RT.has(r.id)).sort((a,b)=>a.country.localeCompare(b.country)||sRank(a.id)-sRank(b.id)||byName(a,b)).map(r=>`${r.id} | ${r.name} | ${r.country}`).join('\n');
  return {items,rets};
}
function rulesTxt(){return `Rules:
- One record per product per store. Never merge, average or skip products; list every product you found.
- price is the pack price exactly as sold (the sale or member price if that is what shoppers pay; then put the discount in promo, e.g. "-20%" or "1+1", with promo_until if known. promo is ONLY for price reductions: put shipping fees, minimum orders, pack options and other remarks in source_note, never in promo, and member_only true if a membership is needed). For multi-buy offers (1+1, 2+1) use the shelf price of ONE pack and describe the offer in promo.
- size and size_unit are the pack content as printed (for example 2.6 kg or 2600 g, 6 pc for a 6 roll pack, 15 pc for 15 eggs). unit_price is the price per kg, per litre or per piece if it is printed on the shelf tag or page, normalised to base_unit; otherwise null (do not compute it).
- product_name is the exact name as printed on the pack, tag or page, in its original language, including brand and size text. Do not translate or shorten it.
- store.name is the shop name as shown. Use retailer_id only if the shop is in the known stores list, otherwise null. Be specific about the format of the shop (for example a hypermarket, its convenience format and its discount format are different shops).
- item_id and product_id only when they clearly match the known lists, otherwise null with item_name as a short generic staple name in English.
- observed_at is the date the price was seen. source_url is the exact page of the price, source_note a short note on how you found it (page, date, branch).
- assessment: a quick red-flag check of the product itself, only from what you see or already know (ingredients, added sugar or salt, additives, contaminants, recalls, third-party or unreliable seller, product not matching its label, clearly bad reviews if shown). level ok, watch or flag. note is ONE short sentence (max 100 characters) saying why; for ok name the main plus or caveat. Do not browse for it and do not invent reviews; null if you cannot say anything useful.
- Use null when something is not visible. Never guess a number. Prices in the currency of the country. confidence 0 to 1.
- Reply with ONLY one JSON object, in one code block, nothing before or after it, no comments, no trailing commas.`}
function researchPrompt(){
  const k=knownTxt();
  return `You are helping me build a personal price database (Shelfwatch) for staples in ${NAMES}. Today is ${todayStr()}.

TASK: [Describe what to find, for example "current shelf prices of eggs, canned tuna and brown rice at the large supermarkets in my city"]. Use only prices you can see on a real source (shop website, flyer, app, receipt). Do not estimate.

Reply in exactly this JSON format (format: ${FMT}):
${schemaTxt()}

${rulesTxt()}

Known items (id | name | compared per | products id:name size):
${k.items}

Known stores (id | name | country):
${k.rets}`;
}
function textPrompt(txt){
  const k=knownTxt();
  return `Extract price records from the text below (it may be a pasted Notion table, notes, a receipt or a chat). Today is ${todayStr()}. Keep every row; do not drop information. Reply in this JSON format (format: ${FMT}):
${schemaTxt()}

${rulesTxt()}

Known items:
${k.items}

Known stores:
${k.rets}

TEXT:
${txt}`;
}
function parseJsonLoose(t){
  t=String(t||'').trim();const m=t.match(/```(?:json)?\s*([\s\S]*?)```/);if(m)t=m[1].trim();
  try{return JSON.parse(t)}catch(e){}
  const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch(e){}}
  const c=t.indexOf('['),d=t.lastIndexOf(']');if(c>=0&&d>c){try{return JSON.parse(t.slice(c,d+1))}catch(e){}}
  return null;
}
function resolveStore(st){
  st=st||{};const out={sid:'',cty:null};
  let id=st.retailer_id&&S.retailers.has(st.retailer_id)?st.retailer_id:null;
  if(!id&&st.name){const n=String(st.name).toLowerCase().trim();const all=[...S.retailers.values()];const m=all.find(r=>r.name.toLowerCase()===n)||all.find(r=>{const rn=r.name.toLowerCase().split(' (')[0];return rn===n||(n.length>3&&(rn.includes(n)||n.includes(rn)))});if(m)id=m.id}
  if(id){out.sid=id;out.cty=S.retailers.get(id).country}
  else if(st.name){out.sid='__new';out.newName=String(st.name).trim();out.newCty=COUNTRIES[st.country]?st.country:(S.country!=='ALL'?S.country:HOME);out.cty=out.newCty}
  return out;
}
function guessSize(txt){
  const m=String(txt||'').match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|리터|L|개입|개|롤|입|매|캔|팩|봉|pcs?|ea|stk|ks)/i);
  if(!m)return null;
  const n=parseFloat(m[1].replace(',','.')),u=m[2].toLowerCase();
  const map={kg:'kg',g:'g',ml:'ml',l:'l','리터':'l',L:'l','개입':'pc','개':'pc','롤':'pc','입':'pc','매':'pc','캔':'pc','팩':'pc','봉':'pc',pc:'pc',pcs:'pc',ea:'pc',stk:'pc',ks:'pc',x:'pc'};
  return n>0&&map[u]?{size:n,unit:map[u]}:null;
}
function guessAll(txt){
  const out=[],re=/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|리터|개입|개|롤|입|매|캔|팩|봉|pcs?|ea|stk|ks|bags?|티백|포|스틱)(?![a-z])/gi;
  const map={kg:'kg',g:'g',ml:'ml',l:'l','리터':'l','개입':'pc','개':'pc','롤':'pc','입':'pc','매':'pc','캔':'pc','팩':'pc','봉':'pc',pc:'pc',pcs:'pc',ea:'pc',stk:'pc',ks:'pc',bag:'pc',bags:'pc','티백':'pc','포':'pc','스틱':'pc'};
  let m;while((m=re.exec(String(txt||'')))){const n=parseFloat(m[1].replace(',','.')),u=map[m[2].toLowerCase()];if(n>0&&u)out.push({size:n,unit:u})}
  return out;
}
const DIM={g:'w',kg:'w',ml:'v',l:'v',pc:'c'},BASE_DIM={kg:'w',l:'v',pc:'c'};
function autoConvert(r,item){
  if(!item||r.conv||r.noconv||!(r.size>0)||!UNITS[r.unit])return;
  const bd=BASE_DIM[item.base_unit],d=DIM[r.unit];if(!bd||d===bd)return;
  const o={size:r.size,unit:r.unit};let to=null,how='';
  if(d!=='c'&&bd!=='c'){to={size:r.size,unit:bd==='w'?(r.unit==='kg'||r.unit==='l'?'kg':'g'):(r.unit==='kg'||r.unit==='l'?'l':'ml')};how='assumes 1 g = 1 ml';}
  else{
    const c=guessAll(r.name).filter(x=>DIM[x.unit]===bd);
    const c2=bd!=='c'?guessAll(r.name).filter(x=>DIM[x.unit]!=='c'&&DIM[x.unit]!==bd):[];
    if(c.length){to=c[0];how=(bd==='c'?'count':'size')+' read from the product name'}
    else if(c2.length){to={size:c2[0].size,unit:bd==='w'?(c2[0].unit==='l'?'kg':'g'):(c2[0].unit==='kg'?'l':'ml')};how='size read from the product name, assumes 1 g = 1 ml'}
  }
  let est='';
  if(!to&&item.piece_g>0){
    const nm=String(r.name||'').toLowerCase();let pg=item.piece_g;
    if(item.id==='eggs'){const cls=[[/왕란|2xl/,70],[/특란|(^|[^2])xl/,64],[/대란/,56],[/중란/,48],[/소란/,40]].find(c=>c[0].test(nm));if(cls)pg=cls[1]}
    if(d!=='c'&&bd==='c'){const g=(r.unit==='kg'||r.unit==='l')?r.size*1000:r.size;to={size:Math.max(1,Math.round(g/pg)),unit:'pc'};est=` ≈ ${pg} g per piece`}
    else if(d==='c'&&bd!=='c'){const g=r.size*pg;to=bd==='w'?{size:Math.round(g),unit:'g'}:{size:Math.round(g),unit:'ml'};est=` ≈ ${pg} g per piece`}
    if(to)how='ESTIMATE:'+est+(item.piece_note?' ('+item.piece_note+')':'');
  }
  if(!to)return;
  const fmt=x=>x.size+' '+(x.unit==='pc'?'pieces':x.unit);
  r.conv={o,from:fmt(o),to:fmt(to),how,est:how.startsWith('ESTIMATE')};r.size=to.size;r.unit=to.unit;
  if(r.up)r.conv.up=r.up,r.up=null;
}
function undoConv(r){if(r.conv){r.size=r.conv.o.size;r.unit=r.conv.o.unit;if(r.conv.up)r.up=r.conv.up}r.conv=null;r.noconv=true}
function mkRow(shot,t){
  const nm=s=>String(s||'').toLowerCase().trim();
  const r={id:'t'+(++SC.seq),assess:(t.assessment&&['ok','watch','flag'].includes(t.assessment.level)&&t.assessment.note)?{level:t.assessment.level,note:String(t.assessment.note).slice(0,160),basis:'import',at:todayStr()}:null,shot:shot.id,name:t.product_name||t.name||t.item_name||'',brand:t.brand||'',item_id:t.item_id&&S.items.has(t.item_id)?t.item_id:'',product_id:t.product_id||'',category:t.category||'Food',size:+t.size>0?+t.size:null,unit:t.size_unit||'kg',price:+t.price>0?+t.price:null,cur:t.currency||null,up:+t.unit_price>0?+t.unit_price:null,promo:(t.promo&&isDeal({promo:t.promo,promo_until:t.promo_until}))?t.promo:'',until:t.promo_until||'',conf:typeof t.confidence==='number'?t.confidence:null,base_unit:t.base_unit||'',obs:/^\d{4}-\d{2}-\d{2}$/.test(t.observed_at||'')?t.observed_at:'',src_url:t.source_url||'',src_note:t.source_note||'',exp:false,on:false};
  if(t.promo&&!r.promo)r.src_note=((r.src_note?r.src_note+' · ':'')+t.promo);
  if(!r.size){const g=guessSize(r.name);if(g){r.size=g.size;r.unit=g.unit;r.guessed=true}}
  if(!r.item_id&&t.item_name){const m=[...S.items.values()].find(i=>nm(i.name)===nm(t.item_name));if(m)r.item_id=m.id}
  const it=r.item_id&&S.items.get(r.item_id);
  if(it){const ps=it.products||[];if(!ps.some(p=>p.id===r.product_id)){const m=ps.find(p=>nm(p.name)===nm(t.product_name));r.product_id=m?m.id:(ps.length===1&&!t.product_name?ps[0].id:'')}}
  return r;
}
function ingestRecords(recs,label){
  const groups=new Map();
  for(const t of recs){if(!t||typeof t!=='object')continue;const rs=resolveStore(t.store||{name:t.store_name,country:t.country,retailer_id:t.retailer_id});const key=rs.sid==='__new'?'n:'+rs.newName.toLowerCase()+rs.newCty:rs.sid||'';if(!groups.has(key))groups.set(key,{rs,list:[]});groups.get(key).list.push(t)}
  let n=0;
  for(const {rs,list} of groups.values()){
    const shot=Object.assign({id:sid(),blob:null,url:'',st:'done',n:list.length,label,store_evidence:rs.newName||''},rs);
    SC.shots.push(shot);
    for(const t of list){SC.rows.push(mkRow(shot,t));n++}
    for(const r of SC.rows)if(r.shot===shot.id){const e=evalRow(r);r.on=e.ok&&!r.conv}
  }
  return n;
}
async function scanText(){
  const txt=(SC.text||'').trim();if(!txt)return toast('Paste some text first');
  let j=parseJsonLoose(txt),recs=null;
  if(j){recs=Array.isArray(j)?j:Array.isArray(j.records)?j.records:Array.isArray(j.tags)?j.tags:null}
  if(!recs){
    if(!S.sample)return toast('That is not Shelfwatch JSON, and text reading is not available in this view');
    const b=$('[data-act=sc-text]');if(b){b.disabled=true;b.textContent='Reading…'}
    try{const o=await S.sample.json(textPrompt(txt),{cache:false});recs=Array.isArray(o)?o:o&&Array.isArray(o.records)?o.records:null}
    catch(e){toast('Could not read this text')}
    if(b){b.disabled=false;b.textContent='Read text'}
  }
  if(!recs||!recs.length)return toast('No prices found');
  const n=ingestRecords(recs,'Pasted text');SC.text='';toast(n+' record'+(n===1?'':'s')+' ready to review');scanDraw();
}
async function copyPrompt(){
  const t=researchPrompt();
  try{await navigator.clipboard.writeText(t);toast('Prompt copied.')}
  catch(e){SC.pr=t;scanDraw()}
}
document.addEventListener('input',e=>{if(e.target&&e.target.id==='sc-text')SC.text=e.target.value});
function clipImages(dt){
  const out=[];if(!dt)return out;
  for(const it of dt.items||[])if(it.kind==='file'&&/^image\//.test(it.type)){const f=it.getAsFile();if(f)out.push(f)}
  if(!out.length)for(const f of dt.files||[])if(/^image\//.test(f.type))out.push(f);
  return out;
}
function takeImages(files){
  if(!files.length)return false;
  if($('#photo-cam')){scanFile(files[0]);return true}
  if(!$('#sc-pick')){openScan();if(!$('#sc-pick'))return true}
  scanFiles(files);return true;
}
document.addEventListener('paste',e=>{const f=clipImages(e.clipboardData);if(!f.length){if(e.target&&e.target.id==='sc-paste')e.preventDefault();return}e.preventDefault();takeImages(f)});
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files')&&$('#sc-pick'))e.preventDefault()});
document.addEventListener('drop',e=>{const f=clipImages(e.dataTransfer);if(f.length){e.preventDefault();takeImages(f)}});
document.addEventListener('keydown',e=>{if(e.target&&e.target.id==='sc-paste'&&!(e.ctrlKey||e.metaKey)&&e.key.length===1)e.preventDefault()});
async function clipRead(){
  try{
    const items=await navigator.clipboard.read(),files=[];
    for(const it of items){const t=it.types.find(x=>/^image\//.test(x));if(t){const b=await it.getType(t);files.push(new File([b],'pasted.'+t.split('/')[1],{type:t}))}}
    if(files.length)return takeImages(files);
    toast('No image on the clipboard');
  }catch(x){toast('Paste blocked. Use Ctrl/⌘+V or long-press → Paste.');const b=$('#sc-paste');if(b)b.focus()}
}
async function scanFiles(files){
  const list=[...files].slice(0,12);
  for(const f of list){
    let blob;try{blob=await shrink(f,2000)}catch(e){toast('A photo could not be read');continue}
    SC.shots.push({id:sid(),blob,url:URL.createObjectURL(blob),st:'queued',n:0,sid:'',cty:null});
  }
  scanDraw();
  for(const s of SC.shots.filter(x=>x.st==='queued'))await scanOne(s);
}
async function scanSave(){
  const sel=SC.rows.map(r=>({r,e:evalRow(r)})).filter(x=>x.r.on&&x.e.ok);
  if(!sel.length||!S.canWrite)return;
  const btn=$('[data-act=sc-save]');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  const now=new Date().toISOString(),items=new Map(),rets=new Map(),assets=new Map(),jobs=[],pre=[];let nNew=0,nSame=0;
  try{
    const getItem=id=>items.get(id)||{...S.items.get(id)};
    for(const {r,e} of sel){
      const shot=SC.shots.find(s=>s.id===r.shot);
      let ret=e.ret;
      if(!ret){const key=shot.id;ret=rets.get(key);if(!ret){let id=slug(shot.newName+'-'+shot.newCty);while(S.retailers.has(id)||[...rets.values()].some(x=>x.id===id))id+='-2';ret={id,name:shot.newName.trim(),country:shot.newCty,kind:'offline',created_at:now,updated_at:now};rets.set(key,ret)}}
      let item=e.item?getItem(e.item.id):null;
      if(!item){let id=slug(r.name);while(S.items.has(id)||items.has(id))id+='-2';const cat=r.category||'Food';item={id,name:r.name||'Item',category:cat,base_unit:e.base,status:'active',priority:'regular',products:[],sort:Math.max(0,...catList(cat).map(x=>x.sort||0),...[...items.values()].filter(x=>x.category===cat).map(x=>x.sort||0))+10,created_at:now,updated_at:now,_new:true}}
      let prod=(item.products||[]).find(p=>p.id===r.product_id);
      if(!prod){let id=item.id+'-'+slug(r.name||'product'),n=2;const b=id;while((item.products||[]).some(p=>p.id===id))id=b+'-'+n++;prod={id,name:((r.brand?r.brand+' ':'')+r.name).trim()};if(r.brand)prod.brand=r.brand;if(r.size){prod.size=r.size;prod.size_unit=r.unit}item={...item,products:[...(item.products||[]),prod],updated_at:now}}
      items.set(item.id,item);
      if(e.status==='same'&&r._last){jobs.push(()=>S.db.doc('prices/'+r._last).update({checked_at:now,updated_at:now}));nSame++;continue}
      let asset=assets.get(shot.id);
      if(asset===undefined){asset=null;if(shot.blob&&S.assets){try{asset=(await S.assets.upload(shot.blob,{type:'image/jpeg'})).id}catch(x){}}assets.set(shot.id,asset)}
      const cur=e.cur,fx=cur==='EUR'?null:rate(cur),amount=r.price||null;
      const doc={item_id:item.id,product_id:prod.id,retailer_id:ret.id,country:ret.country,currency:cur,base_unit:e.base,observed_at:r.obs||todayStr(),source_type:shot.blob?'photo':'paste',origin:'user',product_name:((r.brand?r.brand+' ':'')+(r.name||'')).trim()||null,created_at:now,updated_at:now,checked_at:now,source_note:(r.src_note||(shot.blob?'Shelf scan':'Pasted text'))+(r.conv?' · converted '+r.conv.from+' to '+r.conv.to+' ('+r.conv.how+')':'')};if(r.src_url)doc.source_url=r.src_url;if(r.assess)doc.assess=r.assess;
      const opt={amount,size:r.size||null,size_unit:r.size?r.unit:null,unit_price:e.up!=null?Math.round(e.up*1e6)/1e6:null,promo:r.promo||null,promo_until:r.until||null,asset_id:asset,fx_per_eur:fx,eur_amount:amount!=null&&(cur==='EUR'||fx)?Math.round(amount/(fx||1)*1e6)/1e6:null,eur_unit_price:e.up!=null&&(cur==='EUR'||fx)?Math.round(e.up/(fx||1)*1e6)/1e6:null};
      for(const k in opt)if(opt[k]!=null)doc[k]=opt[k];
      const fl=e.flags.filter(f=>f.sev>=1).map(f=>f.t);if(fl.length)doc.flag=fl.join('; ');
      jobs.push(()=>S.db.doc('prices/'+uid()).set(doc));nNew++;
    }
    for(const it of items.values()){const {id,_new,...rest}=it;if(_new||S.items.get(id)&&JSON.stringify(S.items.get(id).products)!==JSON.stringify(it.products))pre.push(()=>_new?S.db.doc('items/'+id).set(rest):S.db.doc('items/'+id).update({products:rest.products,updated_at:now}))}
    for(const rt of rets.values()){const {id,...rest}=rt;pre.push(()=>S.db.doc('retailers/'+id).set(rest))}
    // order: retailers and items before prices
    await Promise.all(pre.map(j=>j()));await Promise.all(jobs.map(j=>j()));
    toast(`Saved ${nNew} price${nNew===1?'':'s'}${nSame?`, refreshed ${nSame}`:''}`);
    for(const {r} of sel)SC.rows=SC.rows.filter(x=>x!==r);
    if(SC.rows.length)scanDraw();else closeSheet();
  }catch(err){toast(errTxt(err));scanDraw()}
}
function scanChange(el){
  const k=el.dataset.sf,id=el.dataset.id,r=SC.rows.find(x=>x.id===id),shot=SC.shots.find(s=>s.id===el.dataset.shot);
  if(k==='on'&&r){r.on=el.checked;scanDraw();return}
  if(k==='store'&&shot){shot.sid=el.value;const rt=S.retailers.get(el.value);shot.cty=rt?rt.country:shot.cty;for(const x of SC.rows)if(x.shot===shot.id){const e=evalRow(x);x.on=e.clean&&e.ok}scanDraw();return}
  if(k==='newname'&&shot){shot.newName=el.value;scanDraw();return}
  if(k==='newcty'&&shot){shot.newCty=el.value;scanDraw();return}
  if(k==='f'&&r){
    const f=el.dataset.k,num=['price','size','up'];
    r[f]=num.includes(f)?(parseFloat(String(el.value).replace(',','.'))||null):el.value;
    if(f==='item_id'&&r.conv){undoConv(r)}
    if(f==='item_id')r.noconv=false;
    if((f==='size'||f==='unit')&&r.conv){r.conv=null;r.noconv=true}
    if(f==='item_id'){const it=S.items.get(r.item_id);r.product_id=it&&(it.products||[]).length===1?it.products[0].id:''}
    const e=evalRow(r);if(e.ok&&!r.conv&&f!=='item_id')r.on=true;
    scanDraw();
  }
}

/* ---------- actions ---------- */
async function requestCheck(d){
  if(!S.db||!S.canWrite)return toast('Cannot queue here');
  try{await S.db.doc('checks/c'+Date.now().toString(36)+Math.random().toString(36).slice(2,4)).set({scope:d.scope||'offer',item_id:d.item_id||null,product_id:d.product_id||null,retailer_id:d.retailer_id||null,country:d.country||(S.country==='ALL'?null:S.country),status:'queued',requested_at:new Date().toISOString()});toast('Check queued')}catch(e){toast(errTxt(e))}
}
async function saveFx(){
  const r={};for(const c of FXCUR){const x=parseFloat(String(document.getElementById('fx-'+c).value).replace(',','.'));if(!(x>0))return toast('Enter a rate for '+c);r[c]=x}
  try{await S.db.doc('meta/fx').set({date:todayStr(),source:'Entered by hand',rates:r,updated_by:'manual',updated_at:new Date().toISOString()});toast('Rates saved')}catch(e){toast(errTxt(e))}
}
const SQLQ=v=>v==null?'NULL':typeof v==='number'?String(v):typeof v==='boolean'?(v?'true':'false'):"'"+String(v).replace(/'/g,"''")+"'";
function buildSql(){
  const L=[window.__SCHEMA__,'','-- Data exported '+new Date().toISOString(),'begin;'];
  const ins=(t,cols,rows)=>{if(!rows.length)return;L.push(`insert into ${t} (${cols.join(', ')}) values`);L.push(rows.map(r=>'  ('+cols.map(c=>SQLQ(r[c])).join(', ')+')').join(',\n')+' on conflict do nothing;')};
  ins('retailers',['id','name','country','kind','url','note','starter','created_at','updated_at'],[...S.retailers.values()].map(r=>({...r,kind:r.kind||'unknown',starter:!!r.starter})));
  ins('items',['id','name','category','base_unit','status','replaced_by','note','priority','health','sort','created_at','updated_at','sort_updated_at'],[...S.items.values()].map(i=>({...i,status:i.status||'active'})));
  const prods=[];for(const i of S.items.values())for(const p of i.products||[])prods.push({...p,item_id:i.id,buy_in:p.buy_in?'{'+p.buy_in.join(',')+'}':null});
  ins('products',['id','item_id','name','brand','tier','usage','size','size_unit','buy_in','note'],prods);
  if(S.fx&&S.fx.rates)ins('fx_rates',['date','currency','per_eur','source'],Object.keys(S.fx.rates).map(c=>({date:S.fx.date||todayStr(),currency:c,per_eur:S.fx.rates[c],source:S.fx.source||null})));
  ins('prices',['id','item_id','product_id','retailer_id','country','currency','amount','size','size_unit','unit_price','base_unit','promo','promo_until','regular_unit_price','requires_program','flag','placeholder','origin','research_note','updated_at','checked_at','observed_at','date_precision','source_type','source_url','source_note','photo_asset','assess_level','assess_note','fx_per_eur','eur_amount','eur_unit_price','created_at'],S.prices.map(p=>({...p,assess_level:p.assess?p.assess.level:null,assess_note:p.assess?p.assess.note:null,placeholder:!!p.placeholder,origin:originOf(p),research_note:p.research_attempt?(p.research_attempt.at+': '+(p.research_attempt.note||p.research_attempt.result)):null,photo_asset:p.asset_id||null})));
  const nrows=[];for(const i of S.items.values())for(const pr of i.products||[])if(pr.nutrition)nrows.push({product_id:pr.id,basis:pr.nutrition.basis,scope:pr.nutrition.scope,form:pr.nutrition.form||null,source_name:pr.nutrition.source_name||null,source_url:pr.nutrition.source_url||null,retrieved_at:pr.nutrition.retrieved_at||null,note:pr.nutrition.note||null,vals:JSON.stringify(pr.nutrition.values||{})});
  ins('nutrition',['product_id','basis','scope','form','source_name','source_url','retrieved_at','note','vals'],nrows);
  ins('knowledge',['id','title','body','sort_order','updated','created_at','updated_at'],S.kn.map(k=>({...k,sort_order:k.order==null?null:k.order})));
  ins('programs',['id','name','country','status','cost','benefit','how','expiry','source_url','verified_at','note','retailers','created_at','updated_at'],S.prog.map(p=>({...p,retailers:p.retailers?'{'+p.retailers.join(',')+'}':null})));
  L.push('commit;');return L.join('\n');
}
function buildCsv(){
  const cols=['item','product','retailer','country','origin','recorded_at','currency','pack_price','size','unit','unit_price_native','unit_price_eur_now','base','observed_at','source_type','source_url','source_note','promo','flag'];
  const q=v=>{const s=v==null?'':String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const rows=[...S.prices].sort(cmpDesc).map(p=>{const it=S.items.get(p.item_id)||{},pr=(it.products||[]).find(x=>x.id===p.product_id)||{},rt=S.retailers.get(p.retailer_id)||{};
    return [it.name,pr.name,rt.name,p.country,originOf(p),p.created_at,p.currency,p.amount,p.size,p.size_unit,p.unit_price,rowEur(p),p.base_unit,p.observed_at,p.source_type,p.source_url,p.source_note,p.promo,p.flag].map(q).join(',')});
  return cols.join(',')+'\n'+rows.join('\n');
}
async function exportFile(kind){
  if(!S.downloads)return toast('Saving files unavailable here');
  const d=todayStr();
  const f=kind==='sql'?{filename:`shelfwatch-supabase-${d}.sql.txt`,data:buildSql()}:kind==='json'?{filename:`shelfwatch-${d}.json`,data:JSON.stringify({exported:new Date().toISOString(),fx:S.fx,items:[...S.items.values()],knowledge:S.kn,programs:S.prog,source_register:S.src,retailers:[...S.retailers.values()],prices:S.prices,checks:S.checks},null,1)}:{filename:`shelfwatch-prices-${d}.csv`,data:buildCsv()};
  try{await S.downloads.save(f);toast('Saved')}catch(e){if(!e||e.code!=='declined')toast('Could not save the file')}
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  const a=t.dataset.act;
  if(a==='country'){S.country=t.dataset.c;S.store='';S.cOpen=false;S.sOpen=false;try{localStorage.setItem('sw.c2',S.country)}catch(x){}render()}
  else if(a==='cx'){const id=t.dataset.id;if(S.ex.has(id))S.ex.delete(id);else S.ex.add(id);render()}
  else if(a==='cxall'){if(S.ex.size)S.ex.clear();else for(const i of S.items.values())S.ex.add(i.id);render()}
  else if(a==='brt'){S.br.t=t.dataset.k;S.br.q='';render()}
  else if(a==='brj'){S.br.json=!S.br.json;render()}
  else if(a==='fexp'){S.fOpen=!S.fOpen;S.cOpen=false;S.sOpen=false;render()}
  else if(a==='stoff'){const id=t.dataset.s;PREF[id]=isOff(id);if(!PREF[id]&&S.store===id)S.store='';try{localStorage.setItem('sw.inc',JSON.stringify(PREF))}catch(x){}render()}
  else if(a==='cexp'){S.cOpen=!S.cOpen;S.sOpen=false;S.fOpen=false;render()}
  else if(a==='sexp'){S.sOpen=!S.sOpen;S.cOpen=false;S.fOpen=false;render()}
  else if(a==='store'){S.store=t.dataset.s||'';S.sOpen=false;render()}
  else if(a==='herebest'){S.hereBest=!S.hereBest;render()}
  else if(a==='daily'){S.daily=!S.daily;render()}
  else if(a==='org'){S.org=S.org===t.dataset.o?'':t.dataset.o;render()}
  else if(a==='reorder'){S.reorder=!S.reorder;render()}
  else if(a==='mv')moveItem(t.dataset.id,+t.dataset.d);
  else if(a==='cat'){S.cat=t.dataset.c;render()}
  else if(a==='home'){S.home=t.dataset.c;try{localStorage.setItem('sw.home',S.home)}catch(x){}render()}
  else if(a==='lvref'){S.lvRef=t.dataset.c;render()}
  else if(a==='stsort'){S.stSort=t.dataset.v;render()}
  else if(a==='stmem'){S.stMem=!S.stMem;render()}
  else if(a==='stdet')sheetStore(t.dataset.s,t.dataset.c);
  else if(a==='tab'){S.tab=t.dataset.t;render();window.scrollTo(0,0)}
  else if(a==='toggle'){const id=t.dataset.id;S.open.has(id)?S.open.delete(id):S.open.add(id);render()}
  else if(a==='detail')sheetDetail(t.dataset.key);
  else if(a==='add')openScan();
  else if(a==='manual')sheetAdd({});
  else if(a==='sc-cam')document.getElementById('sc-cam').click();
  else if(a==='sc-clip')clipRead();
  else if(a==='sc-pick')document.getElementById('sc-pick').click();
  else if(a==='sc-exp'){const r=SC.rows.find(x=>x.id===t.dataset.id);if(r){r.exp=!r.exp;scanDraw()}}
  else if(a==='sc-unconv'){const r=SC.rows.find(x=>x.id===t.dataset.id);if(r){undoConv(r);r.on=false;scanDraw()}}
  else if(a==='sc-fix'){const r=SC.rows.find(x=>x.id===t.dataset.id);if(r){const v=parseFloat(String((document.getElementById('fx-s-'+r.id)||{}).value||'').replace(',','.'));if(!(v>0))return toast('Enter a number first');r.conv=null;r.noconv=true;r.size=v;r.unit=(document.getElementById('fx-u-'+r.id)||{}).value||r.unit;const e=evalRow(r);if(e.ok)r.on=true;scanDraw();toast(e.ok?'Fixed and ticked':'Fixed. Still to fix: '+e.flags.filter(f=>f.sev>=2).map(f=>f.t).join('; '))}}
  else if(a==='sc-why'){const r=SC.rows.find(x=>x.id===t.dataset.id);if(r){const e=evalRow(r);r.exp=true;toast('Fix: '+e.flags.filter(f=>f.sev>=2).map(f=>f.t).join('; '));scanDraw()}}
  else if(a==='sc-text')scanText();
  else if(a==='sc-prompt')copyPrompt();
  else if(a==='sc-add'){const sh=t.dataset.shot;const r={id:'t'+(++SC.seq),shot:sh,name:'',brand:'',item_id:'',product_id:'',category:'Food',size:null,unit:'kg',price:null,cur:null,up:null,promo:'',until:'',conf:1,exp:true,on:false};let at=-1;SC.rows.forEach((x,i)=>{if(x.shot===sh)at=i});if(at<0)SC.rows.push(r);else SC.rows.splice(at+1,0,r);scanDraw()}
  else if(a==='sc-up'||a==='sc-down'){const i=SC.rows.findIndex(x=>x.id===t.dataset.id);if(i>=0){const d=a==='sc-up'?-1:1,sh=SC.rows[i].shot;let k=i+d;while(k>=0&&k<SC.rows.length&&SC.rows[k].shot!==sh)k+=d;if(k>=0&&k<SC.rows.length){const x=SC.rows[i];SC.rows[i]=SC.rows[k];SC.rows[k]=x}scanDraw()}}
  else if(a==='sc-drop'){SC.rows=SC.rows.filter(x=>x.id!==t.dataset.id);scanDraw()}
  else if(a==='sc-clean'){for(const r of SC.rows){const e=evalRow(r);r.on=e.ok&&!r.conv}scanDraw()}
  else if(a==='sc-save')scanSave();
  else if(a==='sc-retry'){const sh=SC.shots.find(x=>x.id===t.dataset.shot);if(sh)scanOne(sh)}
  else if(a==='addfor')sheetAdd({item_id:t.dataset.item});
  else if(a==='addprice')sheetAdd({item_id:t.dataset.item,product_id:t.dataset.prod,retailer_id:t.dataset.ret});
  else if(a==='close')closeSheet();
  else if(a==='shoot')document.getElementById('photo-cam').click();
  else if(a==='pick')document.getElementById('photo-pick').click();
  else if(a==='saveprice')savePrice();
  else if(a==='req')requestCheck({item_id:t.dataset.item,product_id:t.dataset.prod,retailer_id:t.dataset.ret});
  else if(a==='reqcountry')requestCheck({scope:'country',country:S.country});
  else if(a==='savefx')saveFx();
  else if(a==='exp-sql')exportFile('sql');else if(a==='exp-json')exportFile('json');else if(a==='exp-csv')exportFile('csv');
});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='sc-cam'||t.id==='sc-pick'){const f=t.files;if(f&&f.length)scanFiles(f);t.value='';return}if(t.dataset&&t.dataset.sf)scanChange(t)});
$('#q').addEventListener('input',e=>{S.q=e.target.value;render()});

/* ---------- boot ---------- */
render();
(async function(){
  const claude=window.claude||window.__shelfwatchBackend;if(!claude||!claude.use){S.loaded=-1;render();return}
  const [db,user,sample,assets,downloads]=await Promise.all(['db','user','sample','assets','downloads'].map(n=>claude.use(n).catch(()=>null)));
  S.db=db;S.sample=sample;S.assets=assets;S.downloads=downloads;
  if(!db){S.loaded=-1;render();return}
  try{if(user){const w=user.can('data.write');const r=w&&typeof w.then==='function'?await w:w;if(r===false)S.canWrite=false}}catch(e){}
  try{if(sample&&sample.limits){const l=await sample.limits();S.imgOK=!!(l&&l.images)}}catch(e){}
  let n=0;const done=()=>{n++;S.loaded=Math.max(S.loaded,Math.min(n,3))};
  const fail=e=>{console.error(e);S.loaded=3;sched()};
  const sub=(c,fn)=>{let first=true;db.collection(c).onSnapshot(s=>{fn(s);if(first){first=false;done()}sched()},fail)};
  S.loaded=0;
  sub('items',s=>{S.items=new Map(s.docs.map(d=>[d.id,{id:d.id,...d.data()}]))});
  sub('retailers',s=>{S.retailers=new Map(s.docs.map(d=>[d.id,{id:d.id,...d.data()}]))});
  sub('prices',s=>{S.prices=s.docs.map(d=>({id:d.id,...d.data()}))});
  db.collection('checks').onSnapshot(s=>{S.checks=s.docs.map(d=>({id:d.id,...d.data()}));sched()},fail);
  db.collection('knowledge').onSnapshot(s=>{S.kn=s.docs.map(d=>({id:d.id,...d.data()}));sched()},fail);
  db.collection('source_register').onSnapshot(s=>{S.src=s.docs.map(d=>({id:d.id,...d.data()}));sched()},fail);
  db.collection('programs').onSnapshot(s=>{S.prog=s.docs.map(d=>({id:d.id,...d.data()}));sched()},fail);
  db.doc('meta/fx').onSnapshot(s=>{S.fx=s.exists?s.data():null;sched()},fail);
  db.doc('meta/autocheck').onSnapshot(s=>{S.auto=s.exists?s.data():null;sched()},fail);
})();
})();
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});
