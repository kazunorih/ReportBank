"""Build FIGURE06 annual core inflation from the BOJ workbook (stdlib only).

Run: python scripts/import-core-inflation.py
Only complete calendar years are published. Rates are joined from the current
market chart at render time; this importer does not change other figures.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile
import json
import math
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.boj.or.jp/research/research_data/cpi/cpirev.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def parse_workbook(content, as_of):
    with ZipFile(BytesIO(content)) as workbook:
        strings = ["".join(t.text or "" for t in node.findall(".//m:t", NS))
                   for node in ET.fromstring(workbook.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        rows = []
        for row in ET.fromstring(workbook.read("xl/worksheets/sheet1.xml")).findall("m:sheetData/m:row", NS):
            values = {}
            for cell in row:
                value = cell.findtext("m:v", namespaces=NS)
                if value is not None:
                    values[re.sub(r"\d", "", cell.attrib["r"])] = strings[int(value)] if cell.attrib.get("t") == "s" else value
            rows.append(values)
    headers = rows[3]
    for column, expected in {"B": "Excluding fresh food", "N": "Trimmed mean", "BG": "Weighted median", "BH": "Mode"}.items():
        if not headers.get(column, "").startswith(expected):
            raise ValueError(f"Unexpected BOJ workbook header: {column}")

    samples = defaultdict(dict)
    for row in rows[5:]:
        if "A" in row:
            date = datetime(1899, 12, 30) + timedelta(days=float(row["A"]))
            if date.date().isoformat() <= as_of:
                for key, columns in {"core": ("B", "C", "D"), "trimmedMean": ("N", "O", "P", "Q", "R", "S")}.items():
                    available = [float(row[c]) for c in columns if c in row]
                    if len(available) > 1:
                        raise ValueError(f"Overlapping base-year data: {key}, {date}")
                    if available:
                        samples[(date.year, key)][date.month] = available[0]
        if "BC" in row and re.fullmatch(r"\d{4}\.[1-4]", row["BC"]):
            year, quarter = map(int, row["BC"].split("."))
            for key, column in (("weightedMedian", "BG"), ("mode", "BH")):
                if column in row:
                    samples[(year, key)][quarter] = float(row[column])

    last_year = int(as_of[:4]) - 1
    complete = {}
    for (year, key), observations in samples.items():
        count = 12 if key in ("core", "trimmedMean") else 4
        if year <= last_year and set(observations) == set(range(1, count + 1)):
            value = sum(observations.values()) / count
            if not math.isfinite(value):
                raise ValueError("Non-finite inflation rate")
            complete[(year, key)] = round(value, 6)
    keys = ("core", "trimmedMean", "weightedMedian", "mode")
    years = sorted({year for year, _ in complete})
    if not years or years[0] != 1986 or years[-1] < last_year - 1:
        raise ValueError("Unexpected BOJ annual coverage")
    observations = [{"year": year, **{key: complete.get((year, key)) for key in keys}}
                    for year in range(max(years[0], years[-1] - 49), years[-1] + 1)]
    return observations


def main():
    now = datetime.now(timezone.utc)
    with urlopen(URL, timeout=60) as response:
        content = response.read()
    observations = parse_workbook(content, now.date().isoformat())
    snapshot = {"retrievedAt": now.isoformat(), "sourceUrl": URL,
                "method": "complete-calendar-year-mean-yoy-v1", "observations": observations}
    target = ROOT / "lib/reports/data/core-inflation.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)
    print(f"Imported annual core indicators: {observations[0]['year']}-{observations[-1]['year']}")


if __name__ == "__main__":
    main()
