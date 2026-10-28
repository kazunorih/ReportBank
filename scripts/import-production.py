"""Import official production workbooks (requires openpyxl and xlrd).

python scripts/import-production.py [--source-dir tmp/production-sources]
Without --source-dir, downloads the three workbooks into a temporary directory.
Agricultural amounts: 100 million yen; industry GDP: billion yen; rates: percent.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import tempfile
from urllib.request import urlopen

import openpyxl
import xlrd

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    dict(id="agriculture", name="農林水産省・生産農業所得統計（全国累年）", file="agriculture.xlsx",
         url="https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040426619"),
    dict(id="selfSufficiency", name="農林水産省・総合食料自給率の推移", file="self-sufficiency.xls",
         url="https://www.maff.go.jp/j/zyukyu/zikyu_ritu/attach/xls/012-7.xls"),
    dict(id="industry", name="内閣府・2024年度国民経済計算 経済活動別国内総生産（名目）", file="industry.xlsx",
         url="https://www.esri.cao.go.jp/jp/sna/data/data_list/kakuhou/files/2024/tables/2024fcm3n_jp.xlsx"),
]


def read_rows(path):
    if path.read_bytes()[:2] == b"PK":
        book = openpyxl.load_workbook(path, data_only=True)
        return {sheet.title: list(sheet.values) for sheet in book}
    book = xlrd.open_workbook(path)
    return {sheet.name: [sheet.row_values(i) for i in range(sheet.nrows)] for sheet in book.sheets()}


def number(value):
    if not isinstance(value, (int, float)):
        raise ValueError(f"Missing or invalid numeric observation: {value!r}")
    return value


def consecutive(points, start):
    years = [p["year"] for p in points]
    if not years or years != list(range(start, years[-1] + 1)):
        raise ValueError(f"Incomplete annual series from {start}: {years}")


def parse(directory):
    agriculture = read_rows(directory / SOURCES[0]["file"])["Sheet1"]
    if agriculture[5][3] != "米" or agriculture[8][1] != "億円" or "畜" not in agriculture[4][16]:
        raise ValueError("Unexpected agricultural workbook layout or unit")
    farm = []
    for row in agriculture:
        match = re.search(r"\((\d{4})\)", str(row[0]))
        if not match or int(match[1]) < 1975:
            continue
        total, rice, vegetables, livestock = [number(row[c]) for c in (1, 3, 8, 16)]
        other = total - rice - vegetables - livestock
        if min(total, rice, vegetables, livestock, other) < 0:
            raise ValueError("Negative agricultural amount")
        farm.append(dict(year=int(match[1]), total=total, rice=rice, vegetables=vegetables, livestock=livestock, other=other))
    consecutive(farm, 1975)

    food = read_rows(directory / SOURCES[1]["file"])["Sheet1"]
    rate_row = next(row for row in food if "供給熱量ベースの" in str(row[1]) and "総合食料自給率" in str(row[1]))
    if "40年度" not in str(food[4][3]) or food[3][4] != 41:
        raise ValueError("Unexpected self-sufficiency year header")
    rates = []
    for col in range(3, len(rate_row)):
        year = 1965 + col - 3
        if year < 1975 or rate_row[col] in (None, ""):
            continue
        value = number(rate_row[col])
        if not 0 <= value <= 100:
            raise ValueError("Invalid self-sufficiency percentage")
        rates.append(dict(year=year, rate=value, provisional="概算" in str(food[4][col])))
    consecutive(rates, 1975)

    industry = read_rows(directory / SOURCES[2]["file"])["実数"]
    if "名目" not in str(industry[0][0]) or "１０億円" not in str(industry[3][0]):
        raise ValueError("Expected nominal GDP in billion yen")
    rows = {key: next(r for r in industry if str(r[0]).strip().endswith(label))
            for key, label in [("mining", "２．鉱業"), ("manufacturing", "３．製造業"), ("construction", "５．建設業")]}
    factory = []
    for col, year in enumerate(industry[6]):
        if not isinstance(year, (int, float)):
            continue
        values = {key: number(row[col]) for key, row in rows.items()}
        factory.append(dict(year=int(year), **values, total=round(sum(values.values()), 1)))
    consecutive(factory, 1994)
    return dict(agriculture=farm, selfSufficiency=rates, industry=factory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        directory = args.source_dir or Path(temp)
        if args.source_dir is None:
            for source in SOURCES:
                with urlopen(source["url"], timeout=90) as response:
                    (directory / source["file"]).write_bytes(response.read())
        result = parse(directory)
        result["retrievedAt"] = datetime.now(timezone.utc).isoformat()
        result["sources"] = [{**source, "sha256": hashlib.sha256((directory / source["file"]).read_bytes()).hexdigest()} for source in SOURCES]
        output = ROOT / "lib/reports/data/production.json"
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for key in ("agriculture", "selfSufficiency", "industry"):
            print(key, len(result[key]), result[key][0], result[key][-1])


if __name__ == "__main__":
    main()
