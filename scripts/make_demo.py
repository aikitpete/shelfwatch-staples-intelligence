"""Generate the public demo dataset.
  python3 scripts/make_demo.py      -> rewrites data/demo/*.json (deterministic, seeded)

The story: one household shops a protein-first weekly basket (eggs, chicken, fish, yoghurt, oats, lentils,
produce, plus a few household basics) in three markets and wants to know where each staple is cheapest,
what a promo really saves, and which shops are worth the trouble.
Countries are real; shops, prices, programs and exchange rates are INVENTED for illustration.
Item names and reference nutrition (USDA FoodData Central) are generic public facts.
Your real data never goes in this repo (see README)."""
import datetime,json,os,random
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=f'{R}/data/demo'
rnd=random.Random(20261024)
NOW='2026-10-24T09:00:00Z';TODAY=datetime.date(2026,10,24)
cfg=json.load(open(f'{R}/data/demo-src/config.json',encoding='utf8'))
NUT=json.load(open(f'{R}/data/demo-src/nutrition.json',encoding='utf8'))
FX={'USD':1.12,'GBP':0.87,'JPY':170.0}      # per 1 EUR, indicative, invented for the demo
CTY=['US','GB','JP']
BASE={'US':0.9,'GB':1.0,'JP':1.05}            # general price level per market
SHOP={'warehouse':0.82,'discount':0.88,'super':1.0,'online':1.0,'convenience':1.22}
# (id, name, category, base_unit, priority, health, ref EUR per base unit, {country: factor}, pack sizes, nutrition id)
B=[
 ('eggs','Eggs','Food','pc','daily','core',0.32,{'US':.85,'JP':.9},[(10,'pc'),(12,'pc')],'eggs'),
 ('chicken-breast','Chicken breast','Food','kg','daily','core',9.5,{'US':.72,'JP':.95},[(500,'g'),(1000,'g')],None),
 ('beef-mince','Lean beef mince','Food','kg','regular','core',12.0,{'US':.75,'JP':1.25},[(500,'g')],'beef'),
 ('salmon','Salmon fillet','Food','kg','regular','core',22.0,{'JP':.8,'GB':1.05},[(300,'g'),(500,'g')],'salmon'),
 ('tuna','Canned tuna','Food','kg','regular','core',14.0,{'JP':.9},[(160,'g'),(240,'g')],'tuna'),
 ('greek-yoghurt','Greek yoghurt','Food','kg','daily','core',4.2,{'US':.9,'JP':1.3},[(500,'g'),(1000,'g')],'greek-yoghurt'),
 ('cottage-cheese','Cottage cheese','Food','kg','regular','core',6.0,{'JP':1.4},[(300,'g'),(500,'g')],None),
 ('milk','Whole milk','Food','l','daily','ok',1.15,{'US':.85,'JP':1.1},[(1,'l'),(2,'l')],None),
 ('oats','Rolled oats','Food','kg','daily','core',2.2,{'US':.8,'JP':1.5},[(500,'g'),(1000,'g')],'oats'),
 ('rice','Rice','Food','kg','regular','ok',2.0,{'US':.7,'JP':1.4},[(1000,'g'),(2000,'g'),(5000,'g')],None),
 ('lentils','Lentils','Food','kg','regular','core',3.5,{'US':.9,'JP':1.6},[(500,'g'),(1000,'g')],'lentils'),
 ('wholewheat-pasta','Wholewheat pasta','Food','kg','regular','ok',2.3,{'US':.8,'JP':1.2},[(500,'g')],None),
 ('broccoli','Broccoli','Food','kg','daily','core',3.5,{'JP':1.4},[(500,'g')],'broccoli'),
 ('spinach','Spinach','Food','kg','regular','core',8.0,{'JP':1.3},[(200,'g'),(300,'g')],'spinach'),
 ('bananas','Bananas','Food','kg','daily','ok',1.6,{'US':.7,'JP':1.5},[(1000,'g')],None),
 ('blueberries','Blueberries','Food','kg','regular','core',14.0,{'US':.8,'JP':1.7},[(125,'g'),(250,'g')],'blueberries'),
 ('walnuts','Walnuts','Food','kg','occasional','core',16.0,{'US':.85,'JP':1.2},[(200,'g'),(500,'g')],'walnuts'),
 ('peanut-butter','Peanut butter (100%)','Food','kg','regular','ok',6.0,{'US':.7,'JP':1.5},[(340,'g'),(454,'g')],None),
 ('olive-oil','Olive oil','Food','l','regular','ok',9.0,{'US':.95,'JP':1.3},[(500,'ml'),(1,'l')],None),
 ('coffee-beans','Coffee beans','Food','kg','daily','ok',22.0,{'US':.85,'JP':1.1},[(250,'g'),(500,'g'),(1000,'g')],None),
 ('toilet-paper','Toilet paper','Household','pc','daily','ok',0.4,{'US':.8,'JP':1.3},[(9,'pc'),(18,'pc')],None),
 ('dish-soap','Dish soap','Household','l','regular','ok',3.2,{'US':.85,'JP':1.1},[(500,'ml'),(750,'ml')],None),
 ('toothpaste','Toothpaste','Dental','kg','daily','ok',14.0,{'JP':1.1},[(75,'g'),(100,'g')],None),
 ('sunscreen','Sunscreen SPF 50','Skincare','l','regular','ok',90.0,{'US':.9,'JP':1.15},[(100,'ml'),(200,'ml')],None),
]
RET={ # id, name, kind, format
 'US':[('us-maple-market','Maple Market','both','super'),('us-value-cart','Value Cart','offline','discount'),('us-summit-club','Summit Warehouse Club','both','warehouse'),('us-greenbox','Greenbox Delivery','online','online'),('us-cornerstop','Corner Stop','offline','convenience')],
 'GB':[('gb-highfield','Highfield Stores','both','super'),('gb-penny-co','Penny & Co','offline','discount'),('gb-pantry-online','Pantry Online','online','online'),('gb-harrow-express','Harrow Express','offline','convenience')],
 'JP':[('jp-sakura-mart','Sakura Mart','both','super'),('jp-daily-yamato','Daily Yamato','offline','discount'),('jp-harvest-online','Harvest Online','online','online'),('jp-lantern-24','Lantern 24','offline','convenience')],
}
SM={r[0]:round(SHOP[r[3]]*rnd.uniform(0.96,1.05),3) for c in RET for r in RET[c]}
CUR={c:cfg['countries'][c]['cur'] for c in CTY}
items={};prices={};n=0;sort=0
for iid,name,cat,bu,pri,health,ref,f,sizes,nut in B:
    sort+=10
    prod={'id':iid+'-std','name':name}
    if nut and nut in NUT:prod['nutrition']=NUT[nut]
    items[iid]={'base_unit':bu,'category':cat,'created_at':NOW,'health':health,'name':name,'priority':pri,'products':[prod],'sort':sort,'sort_updated_at':NOW,'status':'active','updated_at':NOW}
    for c in CTY:
        cur=CUR[c];fx=FX.get(cur,1.0)
        rets=RET[c];pool=[r for r in rets if r[3]!='warehouse'];wh=[r for r in rets if r[3]=='warehouse']
        pick=rnd.sample(pool,rnd.randint(3,len(pool)))+(wh if wh and rnd.random()<0.8 and cat!='Skincare' else [])
        for rid,rname,kind,fmt in pick:
            eur_u=ref*BASE[c]*f.get(c,1.0)*SM[rid]*rnd.uniform(0.93,1.07)
            size,su=rnd.choice(sizes)
            if fmt=='warehouse':size,su=max(sizes,key=lambda s:s[0]*{'g':.001,'kg':1,'ml':.001,'l':1,'pc':1}[s[1]])
            k={'g':.001,'kg':1,'ml':.001,'l':1,'pc':1}[su]
            eur_amt=eur_u*size*k
            amount=round(eur_amt*fx,0 if cur=='JPY' else 2)
            if amount<=0:continue
            unit=amount/(size*k)
            age=rnd.choice([0,0,1,2,3,5,7,10,14,21]) if rnd.random()>0.05 else rnd.choice([100,120,150])
            auto=rnd.random()<0.5;n+=1
            rec={'amount':amount,'base_unit':bu,'checked_at':NOW,'country':c,'created_at':NOW,'currency':cur,
              'eur_amount':round(amount/fx,4),'eur_unit_price':round(unit/fx,4),'fx_per_eur':fx,'item_id':iid,
              'observed_at':str(TODAY-datetime.timedelta(days=age)),'origin':'auto' if auto else 'user','product_id':prod['id'],
              'retailer_id':rid,'size':size,'size_unit':su,'source_note':'Illustrative sample data','source_type':'research' if auto else 'manual',
              'unit_price':round(unit,4),'updated_at':NOW}
            r=rnd.random()
            if r<0.09:   # live promo
                rec.update(promo=rnd.choice(['-15%','-20%','2 for 1.5x']) if False else rnd.choice(['-15%','-20%','-25%']),promo_until=str(TODAY+datetime.timedelta(days=rnd.choice([4,9,14]))),regular_unit_price=round(unit/0.85,4))
            elif r<0.12: # promo that already ended: the app falls back to the regular price
                rec.update(promo='-20%',promo_until=str(TODAY-datetime.timedelta(days=5)),regular_unit_price=round(unit/0.8,4))
            if cat=='Food' and bu=='kg' and name in('Broccoli','Spinach','Bananas','Blueberries') and rnd.random()<0.3:rec['flag']='Nominal weight, packs vary by +/-10%'
            if fmt=='warehouse':rec['requires_program']='us-summit-club'
            prices[f'a{n:03d}']=rec
retailers={}
for c,rets in RET.items():
    for rid,rname,kind,fmt in rets:
        r={'country':c,'created_at':NOW,'kind':kind,'name':rname,'starter':True,'updated_at':NOW}
        if fmt=='warehouse':r.update(needs_membership=True,note='Membership needed. Cheapest per unit but hidden by default, tick it in Stores to include.')
        retailers[rid]=r
def prog(i,c,name,rets,benefit,cost,status='unverified'):
    return {'benefit':benefit,'cost':cost,'country':c,'created_at':NOW,'expiry':'Check the terms (sample).','how':'App or card (sample).','id':i,'name':name,'note':'Illustrative sample.','retailers':rets,'source_url':None,'status':status,'updated_at':NOW,'verified_at':None}
programs={
 'us-summit-club':prog('us-summit-club','US','Summit Warehouse Club membership',['us-summit-club'],'Access to bulk prices.','Annual fee (sample)'),
 'gb-highfield-card':prog('gb-highfield-card','GB','Highfield member prices',['gb-highfield'],'Member-only prices on selected items.','Free'),
 'jp-sakura-points':prog('jp-sakura-points','JP','Sakura Mart points',['jp-sakura-mart'],'Points on every basket.','Free'),
}
def src(i,c,name,typ,status,score,note):
    return {'access':'fetch','confidence':'untested','country':c,'created_at':NOW,'created_by':'sample','evidence_url':None,'has_ean':False,'has_promo_dates':False,'has_unit_price':False,'id':i,'last_tested':None,'name':name,'needs_key':False,'needs_membership':False,'note':note,'price_scope':'national online','rank_note':'score 0-100 = coverage 30% + reliability 25% + ease 20% + freshness 15% + cost 10%','score':score,'scores':{'cost':5,'coverage':4,'ease':3,'freshness':4,'reliability':3},'status':status,'type':typ,'update_freq':'weekly','updated_at':NOW,'url':None}
source_register={
 'us-greenbox':src('us-greenbox','US','Greenbox Delivery','retailer','ok',82,'Illustrative entry.'),
 'gb-pantry-online':src('gb-pantry-online','GB','Pantry Online','retailer','ok',78,'Illustrative entry.'),
 'jp-harvest-online':src('jp-harvest-online','JP','Harvest Online','retailer','untested',60,'Illustrative entry. Untested scores are estimates.'),
}
principles=json.load(open(f'{R}/data/demo-src/principles.json',encoding='utf8'))
knowledge={
 'about':{'title':'About this demo','order':0,'body':'The story: a household buys a protein-first weekly basket (eggs, chicken, fish, yoghurt, oats, lentils, fresh produce) plus a few household basics, and shops in three markets: the United States, the United Kingdom and Japan.\nWhat to look for:\n- Compare tab: every staple ranked per kg, per litre or per piece in EUR, with the local price beneath. Pack price is never the comparison.\n- The US is cheapest for chicken, beef and rice, Japan only for fish, and fresh produce costs the most in Japan. Switch country at the top to see the ladder change.\n- Summit Warehouse Club is often cheapest per unit but needs a membership, so it is hidden by default. Tick it under Stores to see what it would save.\n- Promotions show the discount and end date. A promo that has ended falls back to the regular price, and prices older than 90 days count as unknown.\n- Add a price with + Price: photo, pasted text or JSON. Edits stay in your browser.\nCountries are real, but every shop, price and rate here is invented for illustration.'},
 'principles':principles,
 'deals':{'title':'Deals and promo expiry','order':2,'body':'Only price reductions are promos (percent off, multi-buy, coupon, price below the regular price). Shipping fees, minimum orders and pack options go in the note, never in the promo label. A promo is a price with an end date: record it, watch it, and drop it when it ends.\n- Store on every promo price: promo (label), promo_until (YYYY-MM-DD), regular_unit_price (the normal shelf price per unit), requires_program (loyalty program id, if a card or app is needed).\n- If promo_until is in the past, the app ranks the item at regular_unit_price. With no regular price the row leaves the ranking and shows Promo ended until re-checked.'},
 'health':{'title':'Health rubric','order':3,'body':'Reference nutrition per 100 g comes from USDA FoodData Central (SR Legacy) and is generic, not the retail pack label.\nA cheaper product with added sugar or heavy processing is shown but never ranked best for health.'},
 'loyalty':{'title':'Loyalty programs and cards','order':4,'body':'Use only free programs that match what is actually bought. Paid memberships must save more than they cost.\nSample programs: Summit Warehouse Club (US, membership), Highfield member prices (GB), Sakura Mart points (JP).'},
 'sources':{'title':'Where to fetch prices (sources playbook)','order':5,'body':'Prefer shop websites and flyers, then open price surveys, then photos of shelf tags. Record the source URL and date on every price. These shops and prices are invented.'},
}
for v in knowledge.values():v.setdefault('updated','2026-10-24')
meta={'fx':{'date':str(TODAY),'rates':FX,'source':'Indicative sample rates (invented)','updated_by':'sample'}}
os.makedirs(D,exist_ok=True)
for name,obj in dict(items=items,retailers=retailers,prices=prices,programs=programs,source_register=source_register,knowledge=knowledge,meta=meta,checks={}).items():
    json.dump(obj,open(f'{D}/{name}.json','w',encoding='utf8'),ensure_ascii=False,indent=1,sort_keys=True)
    print(name,len(obj))
