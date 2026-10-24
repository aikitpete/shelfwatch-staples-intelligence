"""Generate the public demo dataset: made-up countries, shops and prices.
  python3 scripts/make_demo.py      -> rewrites data/demo/*.json (deterministic, seeded)
Nothing here comes from a real database. Item names and USDA reference nutrition are generic public facts;
shops, prices and programs are invented. Your real data never goes in this repo (see README)."""
import json,os,random,re,statistics
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=f'{R}/data/demo'
rnd=random.Random(20261024)
NOW='2026-10-24T09:00:00Z';TODAY='2026-10-24'
cfg=json.load(open(f'{R}/data/demo-src/config.json',encoding='utf8'))
FX={'BOR':1.4,'CAS':380.0}          # per 1 EUR, invented
MULT={'AUR':1.0,'BOR':0.85,'CAS':1.2}
DROP={'kimchi','healthy-ramen','chia','pangasius'}
# base EUR unit prices (per base unit) for the invented shelf, rounded; fallback by category
FALL={('Food','kg'):9,('Food','l'):6,('Food','pc'):0.8,('Skincare','l'):320,('Household','pc'):1.5,('Dental','pc'):3,('Dental','l'):12,('Dental','kg'):8,('Grooming','pc'):1.2,('Grooming','l'):14}
SIZES={'kg':[(500,'g'),(1000,'g'),(250,'g')],'l':[(500,'ml'),(1,'l'),(250,'ml')],'pc':[(1,'pc'),(6,'pc'),(10,'pc')]}
SKIN={'Skincare'}
RET={
 'AUR':[('aur-fresh-mart','Fresh Mart','both'),('aur-value-basket','Value Basket','offline'),('aur-greenfield','Greenfield Online','online'),('aur-hyperone','HyperOne','both'),('aur-cornerplus','CornerPlus','offline')],
 'BOR':[('bor-northgate','Northgate Market','both'),('bor-daily-fresh','Daily Fresh','offline'),('bor-bulk-depot','Bulk Depot','offline'),('bor-shopline','Shopline','online')],
 'CAS':[('cas-sunmarket','Sun Market','both'),('cas-harbour-grocer','Harbour Grocer','offline'),('cas-megamart','MegaMart','both'),('cas-quickstop','QuickStop','offline')],
}
SM={r[0]:round(rnd.uniform(0.9,1.14),3) for c in RET for r in RET[c]}
items_src=json.load(open(f'{R}/data/demo-src/items.json',encoding='utf8')) if os.path.exists(f'{R}/data/demo-src/items.json') else None
assert items_src,'data/demo-src/items.json missing'
items={};prices={};n=0
for iid,it in items_src.items():
    ref=it.pop('_ref',None) if '_ref' in it else None
    items[iid]=it
    p=it['products'][0]
    ref=ref or FALL.get((it['category'],it['base_unit']),5)
    if it['category']=='Food' and it['base_unit'] in ('kg','l'):ref=min(ref,28)   # keep the invented shelf plausible
    for c,rets in RET.items():
        cur=cfg['countries'][c]['cur'];fx=FX.get(cur,1.0)
        for rid,rname,kind in rnd.sample(rets,rnd.randint(2,min(4,len(rets)))):
            eur_u=ref*MULT[c]*SM[rid]*rnd.uniform(0.88,1.12)
            size,su=(p['size'],p['size_unit']) if p.get('size') else rnd.choice(SIZES[it['base_unit']])
            mult={'g':.001,'kg':1,'ml':.001,'l':1,'pc':1}[su]
            amount_eur=eur_u*size*mult
            amount=round(amount_eur*fx,0 if cur=='CAS' else 2)
            if amount<=0:continue
            unit=amount/(size*mult)
            age=rnd.choice([0,1,2,3,5,8,14,21,30,45]) if rnd.random()>0.06 else rnd.choice([100,130,170])
            d=__import__('datetime').date(2026,10,24)-__import__('datetime').timedelta(days=age)
            auto=rnd.random()<0.5
            n+=1;pid=f'a{n:03d}'
            rec={'amount':amount,'base_unit':it['base_unit'],'checked_at':NOW,'country':c,'created_at':NOW,'currency':cur,
              'eur_amount':round(amount/fx,4),'eur_unit_price':round(unit/fx,4),'fx_per_eur':fx,'item_id':iid,'observed_at':str(d),
              'origin':'auto' if auto else 'user','product_id':p['id'],'retailer_id':rid,'size':size,'size_unit':su,
              'source_note':'Sample data','source_type':'research' if auto else 'manual','unit_price':round(unit,4),'updated_at':NOW}
            if rnd.random()<0.1:
                rec['promo']='-15%';rec['promo_until']='2026-11-07';rec['regular_unit_price']=round(unit/0.85,4)
            if rid=='cas-megamart':rec['requires_program']='cas-megamart-club'
            prices[pid]=rec
retailers={}
for c,rets in RET.items():
    for rid,rname,kind in rets:
        r={'country':c,'created_at':NOW,'kind':kind,'name':rname,'starter':True,'updated_at':NOW}
        if rid=='cas-megamart':r.update(needs_membership=True,note='Membership needed in store (sample).')
        retailers[rid]=r
def prog(i,c,name,rets,benefit,cost):
    return {'benefit':benefit,'cost':cost,'country':c,'created_at':NOW,'expiry':'Annual (sample).','how':'App or card (sample).','id':i,'name':name,'note':'Sample program.','retailers':rets,'source_url':None,'status':'unverified','updated_at':NOW,'verified_at':None}
programs={
 'aur-fresh-club':prog('aur-fresh-club','AUR','Fresh Mart Club',['aur-fresh-mart'],'Member prices on selected items.','Free'),
 'bor-northgate-points':prog('bor-northgate-points','BOR','Northgate Points',['bor-northgate'],'Points on every basket.','Free'),
 'cas-megamart-club':prog('cas-megamart-club','CAS','MegaMart Club',['cas-megamart'],'Access to club prices.','Annual fee (sample)'),
}
def src(i,c,name,typ,status,score,note):
    return {'access':'fetch','confidence':'untested','country':c,'created_at':NOW,'created_by':'sample','evidence_url':None,'has_ean':False,'has_promo_dates':False,'has_unit_price':False,'id':i,'last_tested':None,'name':name,'needs_key':False,'needs_membership':False,'note':note,'price_scope':'national online','rank_note':'score 0-100 = coverage 30% + reliability 25% + ease 20% + freshness 15% + cost 10%','score':score,'scores':{'cost':5,'coverage':4,'ease':3,'freshness':4,'reliability':3},'status':status,'type':typ,'update_freq':'weekly','updated_at':NOW,'url':None}
source_register={
 'aur-greenfield':src('aur-greenfield','AUR','Greenfield Online','retailer','ok',82,'Sample entry.'),
 'bor-shopline':src('bor-shopline','BOR','Shopline','retailer','ok',74,'Sample entry.'),
 'cas-sunmarket':src('cas-sunmarket','CAS','Sun Market flyer','retailer','untested',60,'Sample entry. Untested scores are estimates.'),
}
principles=json.load(open(f'{R}/data/demo-src/principles.json',encoding='utf8'))
deals={'title':'Deals and promo expiry','order':2,'body':'Only price reductions are promos (percent off, multi-buy, coupon, price below the regular price). Shipping fees, minimum orders and pack options go in the note, never in the promo label. A promo is a price with an end date: record it, watch it, and drop it when it ends.\n- Store on every promo price: promo (label), promo_until (YYYY-MM-DD), regular_unit_price (the normal shelf price per unit), requires_program (loyalty program id, if a card or app is needed).\n- If promo_until is in the past, the app ranks the item at regular_unit_price. With no regular price the row leaves the ranking and shows Promo ended until re-checked.'}
knowledge={
 'principles':principles,'deals':deals,
 'health':{'title':'Health rubric','order':3,'body':'Reference nutrition per 100 g comes from USDA FoodData Central (SR Legacy) and is generic, not the retail pack label.\nA cheaper product with added sugar or heavy processing is shown but never ranked best for health.'},
 'loyalty':{'title':'Loyalty programs and cards','order':4,'body':'Use only free programs that match what is actually bought. Paid programs must save more than they cost.\nSample programs: Fresh Mart Club (AUR), Northgate Points (BOR), MegaMart Club (CAS, membership).'},
 'sources':{'title':'Where to fetch prices (sources playbook)','order':5,'body':'Prefer shop websites and flyers, then open price surveys, then photos of shelf tags. Record the source URL and date on every price. Sample data only: these shops and prices are invented.'},
}
for k,v in knowledge.items():v.setdefault('updated','2026-10-24')
meta={'fx':{'date':TODAY,'rates':FX,'source':'Sample rates (invented)','updated_by':'sample'}}
os.makedirs(D,exist_ok=True)
for name,obj in dict(items=items,retailers=retailers,prices=prices,programs=programs,source_register=source_register,knowledge=knowledge,meta=meta,checks={}).items():
    json.dump(obj,open(f'{D}/{name}.json','w',encoding='utf8'),ensure_ascii=False,indent=1,sort_keys=True)
    print(name,len(obj))
