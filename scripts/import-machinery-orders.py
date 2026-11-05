"""Import JSIM monthly orders (pip install pdfplumber).

Uses table 1, not the separate export-contract or customs statistics.
Retains the newest published observation for each month, in million yen.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urljoin
from urllib.request import urlopen

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
INDEX = "https://www.jsim.or.jp/statistical-data/"


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        href = dict(attrs).get("href", "")
        if tag == "a" and re.search(r"a-1-54-00-00-00-\d{6}\.pdf$", href):
            self.urls.add(urljoin(INDEX, href))


def parse_table(text):
    text = unicodedata.normalize("NFKC", text)
    if "百万円" not in text or "内需計" not in text or "総" not in text:
        raise ValueError("Unexpected table 1 headings or units")
    year = None
    points = []
    for line in text.splitlines():
        match = re.match(r"^\s*(?:(\d{4})年)?\s*(\d{1,2})月\s+(.+)$", line)
        if not match:
            continue
        if match[1]:
            year = int(match[1])
        if year is None:
            raise ValueError("Monthly row has no year")
        values = re.findall(r"[▲△+-]?\s*\d[\d,]*(?:\.\d+)?|[―－—−-]", match[3])
        if len(values) != 16:
            raise ValueError(f"Unexpected monthly columns: {line}")
        amounts = [int(values[i].replace(",", "").strip()) for i in range(0, 16, 2)]
        manufacturing, nonmanufacturing, private, government, agents, domestic, exports, total = amounts
        if (manufacturing + nonmanufacturing != private or private + government + agents != domestic
                or domestic + exports != total or min(amounts) < 0):
            raise ValueError(f"Inconsistent monthly totals: {line}")
        points.append(dict(month=f"{year:04d}-{int(match[2]):02d}", domestic=domestic, exports=exports, total=total))
    if len(points) < 24:
        raise ValueError(f"Incomplete table: {len(points)} months")
    return points


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "tmp/machinery-orders")
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    links = Links()
    with urlopen(INDEX, timeout=60) as response:
        links.feed(response.read().decode("utf-8"))
    if not links.urls:
        raise ValueError("No monthly order reports found")

    def download(url):
        path = args.source_dir / url.rsplit("/", 1)[-1]
        if not path.exists():
            with urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        return url, path

    with ThreadPoolExecutor(max_workers=5) as pool:
        files = sorted(pool.map(download, sorted(links.urls)))
    observations = {}
    sources = []
    for url, path in files:
        report = re.search(r"(\d{6})\.pdf$", url)[1]
        report_month = f"{report[:4]}-{report[4:]}"
        with pdfplumber.open(path) as pdf:
            points = parse_table(pdf.pages[1].extract_text())
        if max(p["month"] for p in points) != report_month:
            raise ValueError(f"Report month mismatch: {url}")
        for point in points:
            observations[point["month"]] = dict(point, sourceMonth=report_month)
        sources.append(dict(month=report_month, url=url, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    months = sorted(observations)
    indices = [int(m[:4]) * 12 + int(m[5:]) for m in months]
    if indices != list(range(indices[0], indices[-1] + 1)):
        raise ValueError("Monthly series has gaps")
    result = dict(retrievedAt=datetime.now(timezone.utc).isoformat(), indexUrl=INDEX,
                  unit="百万円", firstMonth=months[0], latestMonth=months[-1],
                  points=[observations[m] for m in months], sources=sources)
    (ROOT / "lib/reports/data/machinery-orders.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(months)} months: {months[0]} to {months[-1]}, {len(sources)} reports")


if __name__ == "__main__":
    main()
