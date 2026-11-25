"""Import Labour Force Survey original monthly series (pip install openpyxl xlrd)."""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import unicodedata
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
INDEX = 'https://www.stat.go.jp/data/roudou/sokuhou/tsuki/index.html'
SOURCES = [dict(id='main', table='1-a-1', url='https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000031831358'),
           dict(id='industry', table='1-c-3', url='https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000031831374')]


def numeric(value):
    if isinstance(value, (float, int)):
        return int(value)
    text = unicodedata.normalize('NFKC', str(value)).strip().replace(',', '')
    match = re.fullmatch(r'[<(]?\s*(\d+)\s*[>)]?', text)
    return int(match[1]) if match else None


def monthly_rows(rows):
    year = None
    for row in rows:
        if isinstance(row[0], (float, int)) and 1900 <= row[0] <= 2100:
            year = int(row[0])
        else:
            match = re.fullmatch(r'(昭和|平成|令和)\s*(\d+|元)年', str(row[0]).strip())
            if match:
                year = {'昭和': 1925, '平成': 1988, '令和': 2018}[match[1]] + (1 if match[2] == '元' else int(match[2]))
        month = re.fullmatch(r'(\d{1,2})月', str(row[1]).strip())
        if year and month:
            key = f'{year}-{int(month[1]):02d}'
            if key >= '2001-01' and numeric(row[4]) is not None:
                yield key, row


def parse(main, industries):
    if main[5][4] != '労働力人口' or main[5][7] != '就業者' or main[5][13] != '完全失業者' or '万人' not in str(main[3][4]):
        raise ValueError('Unexpected main columns or unit')
    if industries[6][8] != '製造業' or '万人' not in str(industries[3][4]):
        raise ValueError('Unexpected industry columns or unit')
    industry = dict(monthly_rows(industries))
    latest = max(industry)
    # Exclude the aggregate non-agricultural column; include agriculture and all listed major industries.
    columns = [5, *range(7, 22)]
    names = {col: (industries[5][col] if col == 5 else industries[6][col]) for col in columns}
    if any(numeric(industry[latest][c]) is None for c in columns):
        raise ValueError('Missing latest industry ranking values')
    ranking = sorted(columns, key=lambda col: -numeric(industry[latest][col]))[:5]
    points = []
    for month, row in monthly_rows(main):
        employed, unemployed, labour = (numeric(row[c]) for c in (7, 13, 4))
        # Published comparable series are independently adjusted and rounded.
        if employed is None or unemployed is None or abs(employed + unemployed - labour) > 3:
            raise ValueError(f'Inconsistent labour force total: {month}')
        detail = industry.get(month)
        values = [numeric(detail[c]) for c in ranking] if detail else [None] * 5
        if month >= '2002-01' and any(v is None for v in values):
            raise ValueError(f'Missing industry breakdown: {month}')
        if detail and abs(numeric(detail[4]) - employed) > 1:
            raise ValueError(f'Inconsistent employment across tables: {month}')
        other = employed - sum(values) if detail else None
        if other is not None and other < 0:
            raise ValueError(f'Negative employment residual: {month}')
        points.append(dict(month=month, labourForce=labour, employed=employed, unemployed=unemployed,
                           values=values, other=other, employedOnly=employed if not detail else None,
                           reconciliationGap=labour - employed - unemployed,
                           supplementaryEstimate='2011-03' <= month <= '2011-08'))
    ordinal = lambda month: int(month[:4]) * 12 + int(month[5:]) - 1
    if not points or [ordinal(p['month']) for p in points] != list(range(ordinal('2001-01'), ordinal(points[-1]['month']) + 1)):
        raise ValueError('Incomplete monthly history')
    if points[-1]['month'] != latest:
        raise ValueError('Main and industry latest months differ')
    return dict(firstMonth='2001-01', latestMonth=latest, rankingMonth=latest,
                categories=[names[c] for c in ranking], points=points)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT / 'tmp/labour')
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    books, sources = {}, []
    for source in SOURCES:
        with urlopen(source['url'], timeout=60) as response:
            raw = response.read()
        (args.source_dir / (source['id'] + '.xls')).write_bytes(raw)
        if raw[:2] == b'PK':
            import openpyxl
            book = openpyxl.load_workbook(io.BytesIO(raw), data_only=True)
            books[source['id']] = {sheet.title: list(sheet.values) for sheet in book}
        else:
            import xlrd
            book = xlrd.open_workbook(file_contents=raw)
            books[source['id']] = {sheet.name: [sheet.row_values(i) for i in range(sheet.nrows)] for sheet in book.sheets()}
        sources.append({**source, 'sha256': hashlib.sha256(raw).hexdigest()})
    output = {**parse(books['main']['原数値'], books['industry']['原数値']),
              'unit': '万人', 'indexUrl': INDEX, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'sources': sources}
    target = ROOT / 'lib/reports/data/labour-force.json'
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Imported {len(output['points'])} months through {output['latestMonth']}")


if __name__ == '__main__':
    main()
