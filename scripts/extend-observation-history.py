"""Import reviewed MOF historical budgets and rebuild the 50-year chart (no AI/AWS)."""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'workers/weekly-report'))
if os.environ.get('REPORT_TEST_DEPENDENCIES'):
    sys.path.insert(0, os.environ['REPORT_TEST_DEPENDENCIES'])
from sources import Fetcher, collect_mof
from markets import build_markets
from integrated import integrate
import xlrd

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--budget-xls', type=Path, required=True)
args = parser.parse_args()
data = ROOT / 'workers/weekly-report/data'
raw = args.budget_xls.read_bytes()
sheet = xlrd.open_workbook(file_contents=raw).sheet_by_index(0)
assert sheet.cell_value(0, 0) == '3. 一般会計歳出等の推移(当初予算)'
assert '億円' in sheet.cell_value(1, 25)
assert sheet.cell_value(2, 23).replace('\u3000', '') == '利払費'
fiscal = json.loads((data / 'fiscal.json').read_text(encoding='utf-8'))
sid = 'mof-budget-744-table3'
url = 'https://warp.da.ndl.go.jp/info:ndljp/pid/11217434/www.mof.go.jp/pri/publication/zaikin_geppo/hyou/g744/744_03.xls'
source = {'id': sid, 'name': '財務省・財政金融統計月報第744号 第3表 一般会計歳出等の推移（当初予算、億円単位。国立国会図書館保存）', 'url': url,
          'retrievedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}
budgets = {r['fiscalYear']: r for r in fiscal['budgets']}
for i in range(7, 27):
    row = sheet.row_values(i)
    year = 1974 + int(row[2])
    assert 1977 <= year <= 1996
    interest, budget = row[23] / 10000, row[3] / 10000
    budgets.setdefault(year, {'fiscalYear': year, 'interest': interest, 'budget': budget,
        'share': interest / budget * 100, 'basis': 'initial-budget', 'sourceIds': [sid],
        'sourceSha256': hashlib.sha256(raw).hexdigest()})
fiscal['budgets'] = [budgets[y] for y in sorted(budgets)]
fiscal['sources'] = list({s['id']: s for s in fiscal['sources'] + [source]}.values())
(data / 'fiscal.json').write_text(json.dumps(fiscal, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(data / 'budget-744-03.xls').write_bytes(raw)

target = ROOT / 'lib/reports/data/markets.json'
old = json.loads(target.read_text(encoding='utf-8'))
fetcher = Fetcher()
datasets = collect_mof(fetcher, old['asOf'])
topix = json.loads((data / 'topix.json').read_text(encoding='utf-8'))
datasets.update(topix['datasets'])
flat = next(s for s in old['series'] if s['id'] == 'flat35')
datasets['flat35'] = {'method': 'range-midpoint-v1', 'sourceIds': flat['sourceIds'],
    'observations': [{'date': d, 'value': v} for d, v in zip(old['periods'], flat['values']) if v is not None]}
chart = integrate(build_markets({'asOf': old['asOf'], 'datasets': datasets,
    'sources': list({s['id']: s for s in old['sources'] + topix['sources'] + fetcher.sources}.values())}))
# Extending the chart does not change the previously published analysis or its timestamp.
if 'insight' in old:
    chart['insight'] = old['insight']
target.write_text(json.dumps(chart, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'periods': [chart['periods'][0], chart['periods'][-1]],
    'series': {s['id']: sum(v is not None for v in s['values']) for s in chart['series']},
    'loans': len(chart['lending']['observations']), 'budgets': len(chart['fiscal']['budgets'])}))
