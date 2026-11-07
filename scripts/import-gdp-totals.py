"""Import official calendar-year nominal/real GDP totals, in billion yen.

python scripts/import-gdp-totals.py [--source-dir tmp/gdp-totals]
The selected release is 2026 Q2 second preliminary (2026-09-08).
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.esri.cao.go.jp/jp/sna/data/data_list/sokuhou/files/2026/qe262_2/"
FILES = {"nominal": "gaku-mcy2622.csv", "real": "gaku-jcy2622.csv"}


def parse(data, kind):
    rows = list(csv.reader(io.StringIO(data.decode("cp932"))))
    title = "Nominal, Calendar Year" if kind == "nominal" else "Real, Calendar Year"
    if not any(r and r[0] == title for r in rows) or not any(len(r) > 1 and r[1] == "GDP(Expenditure Approach)" for r in rows):
        raise ValueError("Expected calendar-year GDP levels, not fiscal-year data or growth rates")
    if kind == "real" and "Chained (2020) Yen" not in str(rows):
        raise ValueError("Expected real GDP in chained 2020 yen")
    points = {}
    for row in rows:
        match = re.fullmatch(r"(\d{4})/1-12\.", row[0]) if row else None
        if match:
            year = int(match[1])
            value = float(row[1].replace(",", "").strip())
            if year in points or value <= 0:
                raise ValueError("Duplicate year or invalid GDP")
            points[year] = value
    if list(points) != list(range(1994, 2026)):
        raise ValueError("Expected complete 1994–2025 calendar years")
    return points


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path)
    args = parser.parse_args()
    directory = args.source_dir or ROOT / "tmp/gdp-totals"
    directory.mkdir(parents=True, exist_ok=True)
    parsed, sources = {}, []
    for kind, filename in FILES.items():
        path = directory / filename
        url = BASE + "tables/" + filename
        if args.source_dir is None:
            with urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        raw = path.read_bytes()
        parsed[kind] = parse(raw, kind)
        sources.append(dict(id=kind, url=url, sha256=hashlib.sha256(raw).hexdigest()))
    result = dict(unit="10億円", realBaseYear=2020, firstYear=1994, latestYear=2025,
                  releaseDate="2026-09-08", releaseName="2026年4–6月期2次速報",
                  indexUrl=BASE + "gdemenuja.html", retrievedAt=datetime.now(timezone.utc).isoformat(),
                  points=[dict(year=y, nominal=parsed["nominal"][y], real=parsed["real"][y]) for y in parsed["nominal"]], sources=sources)
    (ROOT / "lib/reports/data/gdp-totals.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(result["points"][-1])


if __name__ == "__main__":
    main()
