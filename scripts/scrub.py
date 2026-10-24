"""Turn a private dump of your Shelfwatch database into publishable demo data.
  python3 scripts/scrub.py /path/to/private/dump        # dump layout: <dir>/<collection>/<id>.json
Writes data/demo/<collection>.json. Review `git diff data/demo` before every push.
What it drops: photos (asset_id), checks/auto-check logs, personal text, goals-based guide text.
Prices, stores, links and nutrition reference values are public facts and are kept."""
import json,os,re,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=sys.argv[1]
KEEP=['items','retailers','prices','programs','source_register','meta','knowledge']
# Personal terms live in data/private/blocklist.txt (git-ignored): one regex fragment per line (names, city, email...).
_bl=[l.strip() for l in open(f'{R}/data/private/blocklist.txt',encoding='utf8')] if os.path.exists(f'{R}/data/private/blocklist.txt') else []
PERSONAL=re.compile('|'.join([r'\bmy\b',r'notion',r'\.pdf',r'\.csv']+[l for l in _bl if l]),re.I)
def rd(c):
    d=f'{src}/{c}';o={}
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.endswith('.json'):
                x=json.load(open(f'{d}/{f}',encoding='utf8'));o[f[:-5]]=x.get('data',x) if set(x)=={'data'} else x
    return o
BL=re.compile('|'.join(l for l in _bl if l) or '(?!x)',re.I)
def clean_text(t):
    if not isinstance(t,str):return t
    return BL.sub('the user',t)
out={}
for c in KEEP:
    o=rd(c)
    if c=='prices':
        for k,v in o.items():
            for f in ('asset_id','research_attempt','created_by','updated_by'):v.pop(f,None)
            if isinstance(v.get('source_note'),str) and PERSONAL.search(v['source_note']):v['source_note']='Imported from a personal list'
    elif c=='knowledge':
        o.pop('principles',None)
        for k,v in o.items():
            v['body']='\n'.join(l for l in clean_text(v.get('body','')).split('\n') if not PERSONAL.search(l) and True)
        o['principles']=json.load(open(f'{R}/data/demo-src/principles.json',encoding='utf8')) if os.path.exists(f'{R}/data/demo-src/principles.json') else {'title':'Buying principles','body':'','order':1}
    elif c in('items','retailers','programs','source_register'):
        for k,v in o.items():
            for f,val in list(v.items()):
                if isinstance(val,str):v[f]=clean_text(val)
            if isinstance(v.get('note'),str) and PERSONAL.search(v['note']):v.pop('note')
    out[c]=o
out['checks']={}
os.makedirs(f'{R}/data/demo',exist_ok=True)
for c,o in out.items():
    json.dump(o,open(f'{R}/data/demo/{c}.json','w',encoding='utf8'),ensure_ascii=False,indent=1,sort_keys=True)
    print(c,len(o))
hits=[]
for c in out:
    t=open(f'{R}/data/demo/{c}.json',encoding='utf8').read()
    for m in PERSONAL.finditer(t):hits.append((c,t[max(0,m.start()-30):m.end()+30].replace('\n',' ')))
print('REVIEW',len(hits),'possible personal strings');[print(' ',h) for h in hits[:25]]
