"""Build Shelfwatch.
  python3 scripts/build.py claude   -> dist/claude/page.html  (publish as a Claude artifact; uses Claude's database)
  python3 scripts/build.py demo     -> dist/demo/index.html + dist/demo/data/demo/*.json  (static, GitHub Pages)
"""
import json,os,re,shutil,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t=sys.argv[1] if len(sys.argv)>1 else 'demo'
src=open(f'{R}/src/page.src.html',encoding='utf8').read()
schema=open(f'{R}/schema.sql',encoding='utf8').read()
# Countries, currencies and shop priorities come from a config file, never from code.
#   demo   -> data/demo-src/config.json (invented sample countries, public)
#   claude -> data/private/config.json (git-ignored, your real countries); falls back to the sample config
cfgp=f'{R}/data/private/config.json' if (t=='claude' and os.path.exists(f'{R}/data/private/config.json')) else f'{R}/data/demo-src/config.json'
if t=='claude' and 'private' not in cfgp:print('WARNING: data/private/config.json not found, using the sample countries')
cfg=json.load(open(cfgp,encoding='utf8'))
out=src.replace('/*__SCHEMA__*/','window.__SCHEMA__='+json.dumps(schema)+';').replace('/*__CONFIG__*/','window.SW_CONFIG='+json.dumps(cfg,ensure_ascii=False)+';')
d=f'{R}/dist/{t}';shutil.rmtree(d,ignore_errors=True);os.makedirs(d)
if t=='demo':
    shim=open(f'{R}/src/demo-backend.js',encoding='utf8').read()
    out=re.sub(r'<meta name="claude:viewport-fit-sides"[^>]*>\n?','',out)
    i=out.index('</style>')+len('</style>')
    head,body=out[:i],out[i:]
    out='<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'+head+'\n</head><body><script>'+shim+'</script>'+body+'\n</body></html>'
    shutil.copytree(f'{R}/data/demo',f'{d}/data/demo')
    open(f'{d}/index.html','w',encoding='utf8').write(out)
else:
    open(f'{d}/page.html','w',encoding='utf8').write(out)
print(t,len(out),'bytes')
