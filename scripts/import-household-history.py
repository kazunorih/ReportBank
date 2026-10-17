"""Normalize reviewed official reports downloaded by research-household.py."""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'workers/weekly-report'))
sys.path.insert(0, str(ROOT / '.aws-sam/reportbank-python'))
from household import parse_income, parse_unemployment, INCOME_INDEX, LABOUR_INDEX, LABOUR_XLS
sys.stdout.reconfigure(encoding='utf-8')
cache = ROOT / 'tmp/household'
sources = {}
def source(url, name, raw=None):
    sid = hashlib.sha256(url.encode()).hexdigest()[:16]
    sources[sid] = {'id': sid, 'url': url, 'name': name, 'retrievedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}
    if raw is not None:
        sources[sid]['sha256'] = hashlib.sha256(raw).hexdigest()
    return sid
income_index = source(INCOME_INDEX, '厚生労働省・国民生活基礎調査 結果の概要')
labour_index = source(LABOUR_INDEX, 'e-Stat・労働力調査 長期時系列データ 基本集計')
rows = {}
for survey in json.loads((cache / 'review.json').read_text(encoding='utf-8')):
    year = survey['surveyYear']
    found = []
    for item in survey['results']:
        raw = (cache / hashlib.sha256(item['url'].encode()).hexdigest()).read_bytes()
        try:
            row = parse_income(raw, year)
        except ValueError:
            continue
        sid = source(item['url'], f'厚生労働省・{year}年国民生活基礎調査 所得の分布（{year-1}年所得）', raw)
        row.update(incomeSourceIds=[income_index, sid], unemploymentRate=None, unemploymentSourceIds=[])
        found.append(row)
    assert found, year
    assert len({(r['averageIncome'], r['belowMeanShare']) for r in found}) == 1, year
    rows[year - 1] = found[0]
raw = (cache / 'unemployment.xlsx').read_bytes()
sid = source(LABOUR_XLS, '総務省・労働力調査 長期時系列表2-1 年平均（全国・男女計）', raw)
for item in parse_unemployment(raw):
    row = rows.setdefault(item['year'], {'year': item['year'], 'surveyYear': None, 'comparison': None, 'averageIncome': None, 'belowMeanShare': None, 'incomeSourceIds': []})
    row.update(item, unemploymentSourceIds=[labour_index, sid])
data = {'asOf': datetime.now(timezone.utc).date().isoformat(), 'observations': [rows[y] for y in sorted(rows)], 'sources': list(sources.values())}
for target in ['workers/weekly-report/data/household.json', 'lib/reports/data/household.json']:
    (ROOT / target).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print([(r['year'], r['averageIncome'], r['belowMeanShare'], r['unemploymentRate']) for r in data['observations']])
