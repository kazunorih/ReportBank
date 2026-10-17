"""Download official annual income reports for review; never infer missing statistics."""
import sys, json, re, unicodedata, hashlib
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'workers/weekly-report'))
sys.path.insert(0, '.aws-sam/reportbank-python')
from sources import Html
from pypdf import PdfReader
import io
sys.stdout.reconfigure(encoding='utf-8')
OUT=Path('tmp/household');OUT.mkdir(parents=True,exist_ok=True)
def get(url):
    path=OUT/hashlib.sha256(url.encode()).hexdigest()
    if not path.exists(): path.write_bytes(urlopen(url,timeout=45).read())
    raw=path.read_bytes()
    if raw.startswith(b'%PDF'): return '\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(raw)).pages)
    for enc in ('utf-8-sig','cp932','euc_jp'):
        try: return raw.decode(enc)
        except UnicodeDecodeError: pass
    raise ValueError(url)
index='https://www.mhlw.go.jp/toukei/list/20-21kekka.html'
links=Html(get(index)).links
def process(pair):
    href,label=pair
    m=re.search(r'(19|20)\d{2}',unicodedata.normalize('NFKC',label))
    if not m or int(m[0])<1996 or '中止' in label: return None
    year=int(m[0]);url=urljoin(index,href);page=Html(get(url))
    candidates=[(urljoin(url,h),t) for h,t in page.links if ('所得' in t and ('分布' in t or '各種世帯' in t or '中央値' in t or '年次' in t or '１世帯当たり' in t))]
    result=[]
    for target,title in candidates:
        text=get(target)
        if not target.endswith('.pdf'): text=' '.join(Html(text).text)
        text=unicodedata.normalize('NFKC',text);text=re.sub(r'\s+','',text)
        extracts=[text[max(0,m.start()-40):m.start()+160] for m in re.finditer('平均所得金額',text)]
        result.append({'url':target,'title':title,'extracts':extracts})
    return {'surveyYear':year,'index':url,'results':result,'links':[(urljoin(url,h),t) for h,t in page.links if '所得' in t]}
with ThreadPoolExecutor(max_workers=5) as pool:
    results=[r for r in pool.map(process,links) if r]
(OUT/'review.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('Saved',len(results),'survey years')
