# 受入検査（使い方: python3 scripts/check-catalog.py data/catalog/<maker>/<series>.json <manual-pages.json>）：頁の付いていない数値・文が0件／原文の写し0件（12文字以上の連続一致）／数値が引用頁に実在
import json,re,sys
entry=json.load(open(sys.argv[1]));pages=json.load(open(sys.argv[2]))
Z=str.maketrans('０１２３４５６７８９．','0123456789.')
norm=lambda s:re.sub(r'\s+','',s).translate(Z)
ptext={i+1:norm(t) for i,t in enumerate(pages)}
# 頁対応はデータの sources.manual.bodyOffset／safetyOffset に従う
M=entry['sources']['manual']
def physical(printed):
    if isinstance(printed,str) and printed.startswith('安-'): return int(printed[2:])+M.get('safetyOffset',6)
    return int(printed)+M['bodyOffset']
problems=[];checked=0;verbatim=[]
def nums(s):
    s=norm(s);s=re.sub(r'印刷p\.\d+(?:[〜~]\d+)?','',s);s=re.sub(r'安-\d+','',s)
    return re.findall(r'\d+(?:\.\d+)?',s.replace('，',','))
for e in entry['elements']:
    for it in e['items']:
        if it.get('source')=='product': continue
        if 'printed' not in it: problems.append(('no-page',e['id'],it['label']));continue
        pp=physical(it['printed']);t=ptext.get(pp,'')
        for n in nums(it['value']):
            checked+=1
            if n not in t and n.replace(',','') not in t: problems.append(('value-not-on-page',e['id'],it['label'],n,'PDF p%d'%pp))
        for field in ('note','summary'):
            s=it.get(field) if field=='note' else None
            if not s: continue
            s=norm(s)
            for k in range(0,len(s)-11):
                frag=s[k:k+12]
                if any(frag in tx for tx in ptext.values()): verbatim.append((e['id'],it['label'],frag));break
    s=norm(e['summary'])
    for k in range(0,len(s)-11):
        frag=s[k:k+12]
        if any(frag in tx for tx in ptext.values()): verbatim.append((e['id'],'summary',frag));break
for sy in entry['symptoms']:
    pp=physical(sy['printed']);t=ptext.get(pp,'')
    for c in sy['checks']:
        if 'printed' not in c: problems.append(('no-page','symptom',c['point']))
# 数値なし文の頁：note/summary は要素頁に含まれるとみなす。手順語の検出
proc=re.compile(r'(外して|取り外し|緩め|ゆるめ|締め付け|締付け|注入し|抜き|洗い|浸し|絞)')
for e in entry['elements']:
    for it in e['items']:
        for f in ('value','note'):
            if it.get(f) and proc.search(it[f]) and not re.search(r'手順は|やり方は|方法は|点検の手順',it[f]): problems.append(('procedure-like',e['id'],it['label'],f))
out={'numbersChecked':checked,'problems':problems,'verbatim12':verbatim}
print(json.dumps(out,ensure_ascii=False,indent=1))
