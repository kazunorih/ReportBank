"""Stage, validate and publish monthly trade snapshots; never publish a partial run."""
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ['trade.json', 'port-trade.json', 'port-trade-sources.json', 'trade-insight.json']


def expected_month(now):
    local = now.astimezone(timezone(timedelta(hours=9)))
    previous = local.replace(day=1) - timedelta(days=1)
    return previous.strftime('%Y-%m')


def validate(trade, ports, expected):
    for dataset, ids in [(trade, ['country-export', 'country-import', 'commodity-export', 'commodity-import']),
                         (ports, ['port-export', 'port-import'])]:
        if dataset['latestMonth'] != expected:
            raise ValueError(f"Required month {expected} is not published: {dataset['latestMonth']}")
        year, month = map(int, expected.split('-'))
        months = [f'{2000 + n // 12}-{n % 12 + 1:02d}' for n in range((year - 2000) * 12 + month)]
        if [c['id'] for c in dataset['charts']] != ids:
            raise ValueError('Unexpected charts')
        for chart in dataset['charts']:
            if [p['month'] for p in chart['points']] != months:
                raise ValueError('Missing or duplicate month')
            for point in chart['points']:
                values = point['values']
                if all(v is None for v in values) and chart['id'].startswith('commodity') and point['month'] < '2004-01':
                    continue
                if len(values) != len(chart['categories']) or any(type(v) is not int or v < 0 for v in values) or sum(values) != point['total']:
                    raise ValueError('Invalid amounts or residual')


def preserve_timestamp(previous, fresh):
    def evidence(value):
        return {k: v for k, v in value.items() if k != 'retrievedAt'}
    if evidence(previous) == evidence(fresh):
        fresh['retrievedAt'] = previous['retrievedAt']
    return fresh


def main():
    expected = expected_month(datetime.now(timezone.utc))
    data = ROOT / 'lib/reports/data'
    with tempfile.TemporaryDirectory(prefix='reportbank-trade-') as folder:
        stage = Path(folder)
        target = stage / 'lib/reports/data'
        target.mkdir(parents=True)
        for name in FILES + ['fdi-stock.json']:
            shutil.copy2(data / name, target / name)
        env = {**os.environ, 'REPORTBANK_DATA_ROOT': str(stage),
               'REPORTBANK_PORT_CACHE': str(ROOT / 'tmp/ports/cache'), 'PYTHONUNBUFFERED': '1',
               'REPORTBANK_REFRESH_RECENT': '1'}
        import sys
        for script in ['import-trade-history.py', 'import-port-trade.py']:
            subprocess.run([sys.executable, str(ROOT / 'scripts' / script)], env=env, check=True)
        read = lambda name: json.loads((target / name).read_text(encoding='utf-8'))
        validate(read('trade.json'), read('port-trade.json'), expected)
        for name in ['trade.json', 'port-trade.json']:
            old = json.loads((data / name).read_text(encoding='utf-8'))
            fresh = preserve_timestamp(old, read(name))
            (target / name).write_text(json.dumps(fresh, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        subprocess.run(['node', str(ROOT / 'scripts/refresh-trade-insight.mjs')], env=env, check=True)
        # Nothing touches the published snapshots until both importers and summary succeed.
        for name in FILES:
            shutil.copyfile(target / name, data / name)
    print(f'Validated monthly trade through {expected}')


if __name__ == '__main__':
    main()
