"""Import annual e-Stat construction survey overview PDFs (pip install pypdf beautifulsoup4).

Amounts: prime-contractor completed work, 100 million yen. Employment: all
surveyed construction businesses (specialist + diversified), thousand persons.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urljoin
from urllib.request import urlopen

from bs4 import BeautifulSoup
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
INDEX = 'https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00600130&tstat=000001015810&cycle=8&tclass1val=0'


def parse_report(text):
    text = unicodedata.normalize('NFKC', text)
    # Preserve numeric column boundaries when removing spaces inside Japanese labels.
    text = re.sub(r'(?<=[\d,.])[^\S\n]+(?=[\d▲△-])', '|', text)
    compact = re.sub(r'[^\S\n]+', '', text)
    # First occurrence belongs to all businesses; later tables cover specialists.
    work = re.search(r'新設工事([\d,]+)[^\n]*\n維持・修繕工事([\d,]+)[^\n]*', compact)
    if not work:
        raise ValueError('Missing new construction / maintenance rows')
    new, maintenance = (int(x.replace(',', '')) for x in work.groups())
    preceding = compact[:work.start()].splitlines()
    total = int(re.search(r'[\d,]+', preceding[-1])[0].replace(',', ''))
    completed_table = re.search(r'\(1\)完成工事高(.*?)\(2\)元請完成工事高', compact, re.S)
    if not completed_table or '億円' not in completed_table[1]:
        raise ValueError('Missing completed work table or unexpected units')
    completed = int(re.search(r'合計([\d,]+)', completed_table[1])[1].replace(',', ''))
    employment = re.search(r'4\.就業者数[^\n]*\(第8表\)(.*?)(?:5\.|５)', compact, re.S)
    if not employment or '千人' not in employment[1]:
        raise ValueError('Missing employment table or unexpected units')
    workers = int(re.search(r'合計([\d,]+)', employment[1])[1].replace(',', ''))
    if min(new, maintenance, total, workers) <= 0 or completed < total or abs(new + maintenance - total) > 1:
        raise ValueError(f'Invalid amounts or totals (allow 1 unit rounding): {new}, {maintenance}, {total}, {workers}')
    return dict(newConstruction=new, maintenance=maintenance, total=total,
                maintenanceRatio=maintenance / total * 100, workers=workers, completed=completed)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT / 'tmp/construction')
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    with urlopen(INDEX, timeout=60) as response:
        soup = BeautifulSoup(response.read(), 'html.parser')
    years = sorted({int(a.get_text(strip=True)[:4]) for a in soup.select('a[href]')
                    if re.fullmatch(r'20\d{2}年度', a.get_text(strip=True)) and int(a.get_text(strip=True)[:4]) >= 2004})
    if not years or years != list(range(2004, max(years) + 1)):
        raise ValueError('Incomplete annual index')

    def read(year):
        index = f'{INDEX}&year={year}1&month=0'
        with urlopen(index, timeout=60) as response:
            page = BeautifulSoup(response.read(), 'html.parser')
        link = next(a for a in page.select('a[href]') if 'file-download' in a['href'] and 'fileKind=2' in a['href'])
        url = urljoin(INDEX, link['href'])
        path = args.source_dir / f'{year}.pdf'
        if not path.exists():
            with urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        pdf = PdfReader(path)
        texts = [p.extract_text(extraction_mode='layout') for p in pdf.pages]
        point = dict(year=year, **parse_report('\n'.join(texts)))
        source = dict(year=year, url=url, indexUrl=index, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                      workPage=next(i + 1 for i, t in enumerate(texts) if re.search(r'新\s*設\s*工\s*事\s*[０-９\d]', t)),
                      employmentPage=next(i + 1 for i, t in enumerate(texts) if re.search(r'[４4][．.]\s*就業者数', t)))
        source['completedPage'] = next(i + 1 for i, t in enumerate(texts) if re.search(r'[（(][１1][）)]\s*完成工事高', t))
        return point, source

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(read, years))
    output = dict(retrievedAt=datetime.now(timezone.utc).isoformat(), indexUrl=INDEX,
                  amountUnit='億円', employmentUnit='千人', points=[r[0] for r in results], sources=[r[1] for r in results])
    (ROOT / 'lib/reports/data/construction-work.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(years)} years: {years[0]}-{years[-1]}')


if __name__ == '__main__':
    main()
