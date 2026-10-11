"""Build a provenance-preserving monthly history from e-Stat's official files.

Run once before deployment; inspect reported gaps before uploading the CSV.
No AWS writes or generative AI calls. Numeric revisions are taken from the newer
survey year first. Earlier definitions are not silently spliced into current ones.
"""
import argparse
import csv
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers" / "weekly-report"))
if os.environ.get("REPORT_TEST_DEPENDENCIES"):
    sys.path.insert(0, os.environ["REPORT_TEST_DEPENDENCIES"])
from domain import aggregate, half_years
from sources import Fetcher, mlit_download_link, parse_mlit

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--as-of", default=date.today().isoformat())
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
fetcher = Fetcher()
observations, gaps = {}, []
year = int(args.as_of[:4])
for target_year in range(year, year - 31, -1):
    index = ("https://www.e-stat.go.jp/stat-search/files?cycle=1&layout=dataset&page=1"
             "&tclass1=000001168706&tclass2=000001168707&tclass3val=0&toukei=00600130"
             f"&tstat=000001015811&year={target_year}0")
    try:
        html, _ = fetcher.html(index, "e-Stat・建設工事受注高時系列")
        link = mlit_download_link(html, index)
        raw, _ = fetcher.get(link, "国土交通省・建設工事受注高時系列（全国）")
        rows = parse_mlit(raw)
        for row in rows:
            if row["date"] <= args.as_of:
                observations.setdefault(row["date"], {**row, "unit": "兆円", "source_name": "国土交通省・建設工事受注高時系列（全国）", "source_url": link})
        print(json.dumps({"year": target_year, "observations": len(rows)}), flush=True)
    except Exception as error:
        gaps.append(target_year)
        print(json.dumps({"year": target_year, "unavailable": str(error)}), flush=True)
    time.sleep(1)  # Respect the official portal's service; this is a one-time import.
if not observations:
    sys.exit("No verified observations; no output written")
args.output.parent.mkdir(parents=True, exist_ok=True)
with args.output.open("w", encoding="utf-8", newline="") as stream:
    writer = csv.DictWriter(stream, fieldnames=["date", "value", "unit", "source_name", "source_url"])
    writer.writeheader()
    writer.writerows(observations[key] for key in sorted(observations))
periods = half_years(args.as_of)
values = aggregate(list(observations.values()), periods, "sum")
print(json.dumps({"output": str(args.output), "monthlyObservations": len(observations),
                  "missingHalfYears": [period for period, value in zip(periods, values) if value is None],
                  "unavailableYears": gaps}))
