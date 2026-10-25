"""Read JPX consolidated simple-average market PER/PBR. No workbook edits.

Run: python scripts/import-equity-valuations.py
Legacy and current market sections remain separate series across April 2022.
"""
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urljoin
from zipfile import ZipFile
import json, math, re, xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
PAGE = 'https://www.jpx.co.jp/markets/statistics-equities/misc/04.html'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def parse(content):
    z = ZipFile(BytesIO(content))
    strings = [''.join(si.itertext()) for si in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    def sheet(number):
        result = []
        for row in E.fromstring(z.read(f'xl/worksheets/sheet{number}.xml')).findall('m:sheetData/m:row', NS):
            cells = {}
            for cell in row:
                v = cell.findtext('m:v', namespaces=NS)
                if v is not None:
                    cells[re.sub(r'\d', '', cell.attrib['r'])] = strings[int(v)] if cell.get('t') == 's' else v
            result.append(cells)
        return result
    def number(text):
        if text in (None, '', '-', '－', '＊', '*'): return None
        value = float(text)
        if not math.isfinite(value) or value < 0: raise ValueError('Invalid valuation')
        return round(value, 4)
    records = []
    groups = [(5, [('first', '東証第一部', 'I', 'J'), ('second', '東証第二部', 'N', 'O'), ('mothers', 'マザーズ', 'S', 'T'), ('jasdaq', 'JASDAQ', 'X', 'Y')]),
              (1, [('prime', 'プライム', 'D', 'E'), ('standard', 'スタンダード', 'I', 'J'), ('growth', 'グロース', 'N', 'O')])]
    for index, markets in groups:
        rows = sheet(index)
        if '連結' not in rows[0].get('A', '') or '単純' not in rows[0].get('A', ''): raise ValueError('Unexpected calculation basis')
        if any(rows[2].get(per) != 'PER' or rows[2].get(pbr) != 'PBR' for _, _, per, pbr in markets): raise ValueError('Unexpected columns')
        for row in rows:
            if not re.fullmatch(r'\d{4}', row.get('A', '')): continue
            year, month = int(row['A']), int(row['B'])
            if not 1 <= month <= 12: raise ValueError('Invalid month')
            for key, label, per, pbr in markets:
                records.append({'month': f'{year}-{month:02d}', 'market': key, 'per': number(row.get(per)), 'pbr': number(row.get(pbr))})
    keys = [(r['month'], r['market']) for r in records]
    if len(set(keys)) != len(keys): raise ValueError('Duplicate observations')
    return {'markets': [{'id': key, 'label': label} for _, markets in groups for key, label, _, _ in markets], 'observations': sorted(records, key=lambda r: (r['month'], r['market']))}

def main():
    text = urlopen(PAGE, timeout=60).read().decode('utf-8')
    link = re.search(r'href="([^"]*/longrange-perpbr\.xlsx)"', text)
    if not link: raise ValueError('Missing JPX long-range workbook')
    url = urljoin(PAGE, link.group(1))
    content = urlopen(url, timeout=60).read()
    snapshot = {**parse(content), 'basis': 'consolidated-simple-average', 'sourcePage': PAGE, 'sourceUrl': url, 'sha256': sha256(content).hexdigest(), 'retrievedAt': datetime.now(timezone.utc).isoformat()}
    target = ROOT / 'lib/reports/data/equity-valuations.json'
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(target)
    print(f"Imported {len(snapshot['observations'])} market/month observations")

if __name__ == '__main__': main()
