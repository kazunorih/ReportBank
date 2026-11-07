"""Import CEMA shipment amounts, calendar years 1995 onwards (stdlib only)."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urljoin
from urllib.request import urlopen
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
INDEX = "https://www.cema.or.jp/general/statistics/index.html"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = {}

    def handle_starttag(self, tag, attrs):
        href = dict(attrs).get("href", "")
        match = re.search(r"shipment_value_Statistics_DomesticDemand_ExternalDemand_(\d{4})\.xlsx", href)
        if tag == "a" and match and int(match[1]) >= 1995:
            self.urls[int(match[1])] = urljoin(INDEX, href.split("?")[0])


def read_rows(path):
    with zipfile.ZipFile(path) as book:
        strings = ["".join(t.text or "" for t in item.findall(".//m:t", NS)) for item in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        result = []
        for row in ET.fromstring(book.read("xl/worksheets/sheet1.xml")).findall(".//m:row", NS):
            cells = {}
            for cell in row:
                value = cell.find("m:v", NS)
                if value is not None:
                    cells[re.sub(r"\d", "", cell.attrib["r"])] = strings[int(value.text)] if cell.attrib.get("t") == "s" else Decimal(value.text)
            result.append(cells)
    return result


def parse(rows, year):
    if not any("百万円" in str(r) for r in rows) or not any(r.get("A") == f"{year}年" for r in rows):
        raise ValueError(f"Unexpected unit or year: {year}")
    category = None
    groups = {}
    for row in rows:
        if isinstance(row.get("A"), str) and row.get("B") in ("国内", "輸出", "小計"):
            category = re.sub(r"\s", "", unicodedata.normalize("NFKC", row["A"]))
        if category and row.get("B") in ("国内", "輸出", "小計"):
            groups.setdefault(category, {})[row["B"]] = row
    total = groups["総合計"]["小計"]
    cols = [chr(ord("C") + i) for i in range(12)]
    months = [i + 1 for i, col in enumerate(cols) if isinstance(total.get(col), Decimal)]
    if months != list(range(1, len(months) + 1)) or not months:
        raise ValueError(f"Non-contiguous months: {year}")
    amounts = {}
    for name, group in groups.items():
        if name in ("本体合計", "総合計"):
            continue
        values = [group["小計"].get(cols[m - 1]) for m in months]
        if all(v is None or v == "" for v in values):
            continue  # Not separately reported in this historical classification.
        values = [Decimal(0) if v is None or v == "" else v for v in values]
        if any(not isinstance(v, Decimal) for v in values):
            raise ValueError(f"Missing category amount: {year} {name}")
        for m in months:
            col = cols[m - 1]
            if group["小計"].get(col) in (None, ""):
                if (group["国内"].get(col) or 0) + (group["輸出"].get(col) or 0) != 0:
                    raise ValueError(f"Missing subtotal: {year} {name}")
                continue
            if (group["国内"].get(col) or 0) + (group["輸出"].get(col) or 0) != group["小計"][col]:
                raise ValueError(f"Domestic/export mismatch: {year} {name}")
        amounts[name] = int(sum(values))
    total_value = int(sum(total[cols[m - 1]] for m in months))
    if sum(amounts.values()) != total_value:
        raise ValueError(f"Category total mismatch: {year}")
    if int(total["W"]) != total_value:
        raise ValueError(f"Calendar cumulative column mismatch: {year}")
    # Historical mini excavators were not always separately tabulated; use a
    # consistent combined excavator category without counting their subtotal twice.
    excavators = [name for name in amounts if "ショベル" in name]
    if excavators:
        amounts["油圧ショベル・ミニショベル"] = sum(amounts.pop(name) for name in excavators)
    return dict(year=year, months=len(months), total=total_value, categories=amounts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "tmp/cema")
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    links = Links()
    with urlopen(INDEX, timeout=60) as response:
        links.feed(response.read().decode("utf-8"))

    def download(item):
        year, url = item
        path = args.source_dir / f"{year}.xlsx"
        if not path.exists():
            with urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        return year, url, path

    with ThreadPoolExecutor(max_workers=5) as pool:
        files = sorted(pool.map(download, links.urls.items()))
    points, sources = [], []
    for year, url, path in files:
        points.append(parse(read_rows(path), year))
        sources.append(dict(year=year, url=url, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    if [p["year"] for p in points] != list(range(1995, points[-1]["year"] + 1)):
        raise ValueError("Missing calendar years")
    if any(p["months"] != 12 for p in points[:-1]):
        raise ValueError("Incomplete historical calendar year")
    ranking = next(p for p in reversed(points) if p["months"] == 12)
    names = sorted((name for name in ranking["categories"] if "その他" not in name), key=lambda name: ranking["categories"][name], reverse=True)[:5]
    series = [dict(key=f"category{i}", name=name) for i, name in enumerate(names)]
    for point in points:
        for item in series:
            if item["name"] not in point["categories"]:
                raise ValueError(f"Missing historical series: {point['year']} {item['name']}")
            point[item["key"]] = point["categories"][item["name"]]
        point["other"] = point["total"] - sum(point[item["key"]] for item in series)
    result = dict(indexUrl=INDEX, unit="百万円", retrievedAt=datetime.now(timezone.utc).isoformat(), rankingYear=ranking["year"], series=series, points=points, sources=sources)
    (ROOT / "lib/reports/data/construction-machinery.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {points[0]['year']}–{points[-1]['year']} ({points[-1]['months']} months in latest year)")
    print(names)


if __name__ == "__main__":
    main()
