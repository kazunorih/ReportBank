"""Import JETRO annual outward FDI stock; standard library only.

python scripts/import-fdi-stock.py
The eight largest destinations in the latest year remain fixed for all years.
"""
from datetime import datetime, timezone
from decimal import Decimal
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen
from zipfile import ZipFile
import json
import re
import unicodedata
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
INDEX = "https://www.jetro.go.jp/world/japan/stats/fdi.html"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        href = dict(attrs).get("href", "")
        if tag == "a" and re.search(r"/\d{2}fdistock01_jp\.xlsx$", href):
            self.urls.add(urljoin(INDEX, href))


def parse_workbook(content):
    with ZipFile(BytesIO(content)) as workbook:
        strings = ["".join(t.text or "" for t in node.findall("m:t", NS) + node.findall("m:r/m:t", NS))
                   for node in ET.fromstring(workbook.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        rows = {}
        for row in ET.fromstring(workbook.read("xl/worksheets/sheet1.xml")).findall("m:sheetData/m:row", NS):
            values = {}
            for cell in row:
                value = cell.findtext("m:v", namespaces=NS)
                if value is not None:
                    values[re.sub(r"\d", "", cell.attrib["r"])] = strings[int(value)] if cell.attrib.get("t") == "s" else value
            rows[int(row.attrib["r"])] = values
    if "対外直接投資残高" not in rows[2].get("B", "") or "100万ドル" not in "".join(rows[2].values()):
        raise ValueError("Unexpected JETRO series or currency")
    columns = {}
    for column, label in rows[4].items():
        match = re.fullmatch(r"(\d{2})年末r?", label)
        if match:
            year = int(match[1])
            columns[column] = (1900 if year >= 90 else 2000) + year
    years = list(columns.values())
    if not years or years != list(range(1996, years[-1] + 1)):
        raise ValueError("Expected consecutive year-end data from 1996")
    countries = {}
    totals = None
    for row in rows.values():
        if row.get("B") == "世界":
            totals = row
        if "D" in row and row["D"] != "ベルギー、ルクセンブルク":
            name = unicodedata.normalize("NFKC", row["D"]).strip()
            if name in countries:
                raise ValueError("Duplicate destination")
            countries[name] = row
    if totals is None:
        raise ValueError("Missing world total")
    latest_column = next(reversed(columns))

    def number(value):
        result = Decimal(value.replace(",", ""))
        if not result.is_finite():
            raise ValueError("Non-finite investment stock")
        return result

    ranking = sorted(countries, key=lambda name: (-number(countries[name][latest_column]), name))[:8]
    points = []
    for column, year in columns.items():
        # Original Excel is in million USD. Retain six decimal places (USD).
        values = [number(countries[name][column]).quantize(Decimal("0.000001")) for name in ranking]
        total = number(totals[column]).quantize(Decimal("0.000001"))
        other = total - sum(values)
        if total <= 0 or min(values + [other]) < 0:
            raise ValueError("Negative segment or invalid total")
        points.append({"year": year, "values": [float(value) for value in values + [other]], "total": float(total)})
    return {"firstYear": years[0], "latestYear": years[-1], "unit": "100万米ドル",
            "categories": ranking + ["その他"], "points": points}


def main():
    with urlopen(INDEX, timeout=60) as response:
        page = response.read().decode("utf-8")
    parser = Links()
    parser.feed(page)
    if len(parser.urls) != 1:
        raise ValueError("Ambiguous JETRO outward stock download")
    url = parser.urls.pop()
    if not url.startswith("https://www.jetro.go.jp/ext_images/"):
        raise ValueError("Unexpected workbook host")
    with urlopen(url, timeout=60) as response:
        snapshot = parse_workbook(response.read())
    snapshot.update({"sourceUrl": url, "sourcePage": INDEX, "retrievedAt": datetime.now(timezone.utc).isoformat()})
    target = ROOT / "lib/reports/data/fdi-stock.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)
    print(f"Imported FDI stock: {snapshot['firstYear']}-{snapshot['latestYear']}, top eight plus other")


if __name__ == "__main__":
    main()
