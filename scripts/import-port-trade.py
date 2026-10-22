"""Import monthly port/customs trade from e-Stat ordinary trade CSVs.

python scripts/import-port-trade.py
Old annual releases are split by port and HS section. Sum each disjoint detail
row's monthly value, never annual values or commodity subtotals. Cache parsed
source files under tmp/ports/cache so interrupted backfills can resume.
"""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request
import csv
import html
import json
import re
import time
import unicodedata
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp/ports/cache"
BASE = "https://www.e-stat.go.jp"
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
NAMES = {"100": "東京港", "104": "成田空港", "200": "横浜港", "220": "千葉港", "300": "神戸港", "400": "大阪港", "404": "関西空港", "500": "名古屋港", "604": "博多港"}


def fetch(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "ReportBank statistical chart importer"}), timeout=90) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def listing(year, month, direction, national=False):
    key = f"list-{year}-{month}-{direction}-{'national' if national else 'ports'}.json"
    path = CACHE / key
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    quarter = (month - 1) // 3 + 1
    month_filter = f"2{quarter}{quarter * 3 - 2:02d}{quarter * 3:02d}{month:02d}"
    params = {"page": 1, "layout": "datalist", "toukei": "00350300", "cycle": 1,
              "year": f"{year}0", "month": month_filter,
              "tstat": "000001013141" if national else "000001013143",
              "tclass1": "000001013189" if national else "000001013229",
              "tclass2": ("000001013190" if direction == 1 else "000001013191") if national else ("000001013230" if direction == 1 else "000001013231")}
    url = BASE + "/stat-search/files?" + urlencode(params)
    text = fetch(url).decode("utf-8")
    records = {}
    for match in re.finditer(r'<a\b[^>]*href="[^"]*stat_infid=(\d+)[^"]*"[^>]*>(.*?)</a>', text, re.S):
        sid, title = match.groups()
        title = unicodedata.normalize("NFKC", html.unescape(re.sub("<[^>]+>", "", title)))
        title = re.sub(r"\s+", " ", title).strip()
        if title:
            records[sid] = {"id": sid, "title": title, "url": BASE + f"/stat-search/file-download?statInfId={sid}&fileKind=1"}
    if not records:
        raise ValueError(f"No source files: {url}")
    result = {"page": url, "files": list(records.values())}
    path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result


def parse_detail(content, year, direction, national=False):
    rows = csv.DictReader(content.decode("cp932").replace("Value-Apl", "Value-Apr").splitlines())
    expected = ["Exp or Imp", "Year", *["Value-" + month for month in MONTHS]]
    if not rows.fieldnames or any(name not in rows.fieldnames for name in expected):
        raise ValueError("Unexpected ordinary trade CSV layout")
    values = defaultdict(lambda: [0] * 12)
    for row in rows:
        if row["Year"] != str(year) or row["Exp or Imp"] != str(direction):
            raise ValueError("Wrong year or trade direction")
        key = "TOTAL" if national else row["Custom"]
        for i, month in enumerate(MONTHS):
            text = row["Value-" + month]
            if not re.fullmatch(r"\d+", text):
                raise ValueError(f"Invalid monthly trade amount: {text!r}")
            values[key][i] += int(text)
    return dict(values)


def load_file(source, year, direction, national=False):
    path = CACHE / (source["id"] + ".json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    content = fetch(source["url"])
    result = {"values": parse_detail(content, year, direction, national), "sha256": sha256(content).hexdigest()}
    temporary = path.with_suffix(f".{uuid4().hex}.tmp")
    temporary.write_text(json.dumps(result), encoding="utf-8")
    temporary.replace(path)
    return result


def collect(files, year, direction, national=False):
    values = defaultdict(lambda: [0] * 12)
    sources = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(load_file, source, year, direction, national): source for source in files}
        for index, job in enumerate(as_completed(jobs), 1):
            result = job.result()
            for code, monthly in result["values"].items():
                values[code] = [a + b for a, b in zip(values[code], monthly)]
            sources.append({**jobs[job], "sha256": result["sha256"]})
            if len(files) > 50 and index % 50 == 0:
                print(f"{year} direction {direction}: {index}/{len(files)} files", flush=True)
    return dict(values), sorted(sources, key=lambda row: row["id"])


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    # Match the published monthly charts; do not mix incomplete newer months.
    trade = json.loads((ROOT / "lib/reports/data/trade.json").read_text(encoding="utf-8"))
    latest_year, latest_month = map(int, trade["latestMonth"].split("-"))
    charts, evidence = [], []
    for direction, name in ((1, "輸出"), (2, "輸入")):
        latest = listing(latest_year, latest_month, direction)
        latest_values, latest_sources = collect(latest["files"], latest_year, direction)
        ranking = sorted(latest_values, key=lambda code: (-latest_values[code][latest_month - 1], code))[:8]
        if any(code not in NAMES for code in ranking):
            raise ValueError(f"Port names need verification: {ranking}")
        print(f"Latest {name} top eight: {[(code, NAMES[code]) for code in ranking]}", flush=True)
        points = []
        for year in range(2000, latest_year + 1):
            month = latest_month if year == latest_year else 12
            release = latest if year == latest_year else listing(year, month, direction)
            if year == latest_year:
                ports, sources = latest_values, latest_sources
            else:
                ports, sources = collect(release["files"], year, direction)
            # Sum every disjoint port/HS/country detail, including small ports.
            # This preserves the same basis in 2000 and the latest release.
            totals = [sum(monthly[i] for monthly in ports.values()) for i in range(12)]
            national_sources = []
            if year >= 2009:
                nation = listing(year, month, direction, national=True)
                national, national_sources = collect(nation["files"], year, direction, national=True)
                if totals[:month] != national["TOTAL"][:month]:
                    raise ValueError(f"Port sums disagree with national CSV: {year}, direction {direction}")
            for i in range(month):
                selected = [ports[code][i] for code in ranking]
                total = totals[i]
                other = total - sum(selected)
                if total <= 0 or other < 0:
                    raise ValueError(f"Invalid residual: {year}-{i+1}, direction {direction}")
                points.append({"month": f"{year}-{i+1:02d}", "values": selected + [other], "total": total})
            evidence.append({"year": year, "direction": direction, "page": release["page"], "sources": sources + national_sources})
            print(f"Completed {year} {name}: {month} months", flush=True)
        charts.append({"id": "port-export" if direction == 1 else "port-import", "title": f"月次港別{name}統計（空港を含む）",
                       "categories": [NAMES[code] for code in ranking] + ["その他"], "portCodes": ranking, "points": points})
    snapshot = {"firstMonth": "2000-01", "latestMonth": trade["latestMonth"], "unit": "千円", "basis": "customs-clearance-three-digit-code",
                "retrievedAt": datetime.now(timezone.utc).isoformat(), "charts": charts,
                "sources": [{"year": row["year"], "direction": row["direction"], "page": row["page"], "fileCount": len(row["sources"])} for row in evidence]}
    audit = ROOT / "lib/reports/data/port-trade-sources.json"
    audit.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    target = ROOT / "lib/reports/data/port-trade.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)
    print("Validated and saved port-trade.json", flush=True)


if __name__ == "__main__":
    main()
