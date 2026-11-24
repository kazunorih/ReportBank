"""Download annual average JPY/USD exchange rates for the existing GDP figures."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
INDEX = 'https://data.worldbank.org/indicator/PA.NUS.FCRF?locations=JP'


def main():
    folder = ROOT / 'lib/reports/data'
    gdp = json.loads((folder / 'gdp.json').read_text(encoding='utf-8'))
    totals = json.loads((folder / 'gdp-totals.json').read_text(encoding='utf-8'))
    first, last = gdp['firstYear'], totals['latestYear']
    url = f'https://api.worldbank.org/v2/country/JPN/indicator/PA.NUS.FCRF?format=json&date={first}:{last}&per_page=100'
    with urlopen(url, timeout=60) as response:
        raw = response.read()
    metadata, rows = json.loads(raw)
    points = []
    for row in rows:
        if row['countryiso3code'] != 'JPN' or row['indicator']['id'] != 'PA.NUS.FCRF':
            raise ValueError('Unexpected exchange rate country or indicator')
        value = row['value']
        if not isinstance(value, (int, float)) or value <= 0:
            raise ValueError(f"Missing annual average for {row['date']}")
        points.append(dict(year=int(row['date']), yenPerUsd=value))
    points.sort(key=lambda point: point['year'])
    if [p['year'] for p in points] != list(range(first, last + 1)):
        raise ValueError('Incomplete exchange rate history')
    output = dict(firstYear=first, latestYear=last, unit='JPY per USD',
                  method='calendar-year period average', indexUrl=INDEX, sourceUrl=url,
                  provider='World Bank / IMF International Financial Statistics',
                  sourceUpdatedAt=metadata.get('lastupdated'),
                  retrievedAt=datetime.now(timezone.utc).isoformat(),
                  sha256=hashlib.sha256(raw).hexdigest(), points=points)
    (folder / 'gdp-usd-exchange.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported annual average JPY/USD: {first}-{last}')


if __name__ == '__main__':
    main()
