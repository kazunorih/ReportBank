"""Annual household income and unemployment, aligned to the income reference year."""
import io
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urljoin
from sources import Html

INCOME_INDEX = 'https://www.mhlw.go.jp/toukei/list/20-21kekka.html'
LABOUR_INDEX = 'https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00200531&tstat=000001226583&cycle=0&tclass1=000001226851&tclass2=000001226852&tclass3val=0'
LABOUR_XLS = 'https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000001082681'

def normalize(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text))

def decode_html(raw):
    for encoding in ('utf-8-sig', 'cp932', 'euc_jp'):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            pass
    raise ValueError('Unknown income document encoding')

def document_text(raw):
    if raw.startswith(b'%PDF'):
        from pypdf import PdfReader
        return '\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(raw)).pages)
    return ' '.join(Html(decode_html(raw)).text)

def parse_income(raw, survey_year):
    text = normalize(document_text(raw))
    match = re.search(r'(?:平均所得金額|平均額)\((\d+)万(?:(\d)千)?円\)(以下の割合|より低い世帯の割合)は(\d+\.\d+)%', text)
    if not match:
        raise ValueError('Missing all-household income/distribution statement')
    income = int(match[1]) + int(match[2] or 0) / 10
    share = float(match[4])
    if not 0 < income < 10000 or not 0 < share <= 100:
        raise ValueError('Invalid household income or share')
    return {'year': survey_year - 1, 'surveyYear': survey_year, 'averageIncome': income,
            'belowMeanShare': share, 'comparison': 'below' if match[3].startswith('より') else 'at-or-below'}

def parse_unemployment(raw):
    import openpyxl
    sheet = openpyxl.load_workbook(io.BytesIO(raw), data_only=True).worksheets[0]
    rows = list(sheet.values)
    if rows[4][2] != '男女計' or normalize(str(rows[5][12])) != '完全失業率(%)' or '全国' not in str(rows[0][2]):
        raise ValueError('Unexpected annual unemployment definition')
    result = []
    for row in rows[10:]:
        if not isinstance(row[1], (int, float)) or row[1] < 1995:
            continue
        value = row[12]
        # Keep official supplementary estimates, never calculate our own replacements.
        if isinstance(value, str):
            value = normalize(value).strip('()<>')
            if not re.fullmatch(r'\d+(?:\.\d+)?', value):
                raise ValueError('Invalid unemployment rate')
        value = float(value)
        if not 0 <= value <= 100 or (result and row[1] <= result[-1]['year']):
            raise ValueError('Invalid annual unemployment sequence')
        result.append({'year': int(row[1]), 'unemploymentRate': value})
    if not result:
        raise ValueError('Empty unemployment series')
    return result

def income_links(page, base):
    return [urljoin(base, href) for href, title in page.links
            if '所得' in title and any(word in title for word in ('分布', '各種世帯', '中央値', '年次'))]

def collect_household(fetcher, as_of, previous=None):
    seed = json.loads((Path(__file__).parent / 'data/household.json').read_text(encoding='utf-8'))
    rows = {r['year']: r for r in seed['observations']}
    sources = {s['id']: s for s in seed['sources']}
    if previous:
        previous = json.loads(json.dumps(previous, default=float))
        rows.update({int(r['year']): dict(r) for r in previous['observations']})
        sources.update({s['id']: s for s in previous['sources']})
    if fetcher:
        _, labour_index_id = fetcher.get(LABOUR_INDEX, 'e-Stat・労働力調査 長期時系列データ 基本集計')
        raw, sid = fetcher.get(LABOUR_XLS, '総務省・労働力調査 長期時系列表2-1 年平均（全国・男女計）')
        for r in parse_unemployment(raw):
            row = rows.setdefault(r['year'], {'year': r['year'], 'averageIncome': None, 'belowMeanShare': None, 'surveyYear': None, 'comparison': None, 'incomeSourceIds': []})
            row.update(r, unemploymentSourceIds=[labour_index_id, sid])
        raw, index_id = fetcher.get(INCOME_INDEX, '厚生労働省・国民生活基礎調査 結果の概要')
        page = Html(decode_html(raw))
        surveys = []
        for href, label in page.links:
            match = re.search(r'(?:19|20)\d{2}', normalize(label))
            if match and '中止' not in label:
                surveys.append((int(match[0]), urljoin(INCOME_INDEX, href)))
        if not surveys:
            raise ValueError('Missing income survey links')
        year, url = max(surveys)
        raw, survey_id = fetcher.get(url, f'厚生労働省・{year}年国民生活基礎調査')
        page = Html(decode_html(raw))
        parsed = None
        for url in income_links(page, url):
            raw, sid = fetcher.get(url, f'厚生労働省・{year}年国民生活基礎調査 所得の状況')
            parsed = parse_income(raw, year)
            break
        if parsed is None:
            raise ValueError('Missing income distribution document')
        row = rows.setdefault(year - 1, {'year': year - 1, 'unemploymentRate': None, 'unemploymentSourceIds': []})
        row.update(parsed, incomeSourceIds=[index_id, survey_id, sid])
        sources.update({s['id']: s for s in fetcher.sources})
    output = [rows[y] for y in sorted(rows) if 1995 <= y < int(as_of[:4])]
    used = {sid for r in output for sid in r['incomeSourceIds'] + r['unemploymentSourceIds']}
    return {'asOf': as_of, 'observations': output, 'sources': [sources[sid] for sid in sorted(used)]}
