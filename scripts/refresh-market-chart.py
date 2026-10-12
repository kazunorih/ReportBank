"""Fetch official observations and build the independent first chart. No AI/AWS calls."""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers" / "weekly-report"))
if os.environ.get("REPORT_TEST_DEPENDENCIES"):
    sys.path.insert(0, os.environ["REPORT_TEST_DEPENDENCIES"])
from domain import JST
from sources import Fetcher, collect_mof, collect_flat35
from topix import collect_topix
from markets import build_markets
from integrated import integrate

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--as-of", default=datetime.now(JST).date().isoformat())
args = parser.parse_args()
fetcher = Fetcher()
datasets = collect_mof(fetcher, args.as_of)
datasets.update(collect_flat35(fetcher, args.as_of))
datasets.update(collect_topix(fetcher, args.as_of, backfill=True))
payload = {"asOf": args.as_of, "datasets": datasets, "sources": fetcher.sources}
chart = integrate(build_markets(payload), fetcher)
target = ROOT / "lib" / "reports" / "data"
target.mkdir(parents=True, exist_ok=True)
(target / "markets.json").write_text(json.dumps(chart, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
# Keep the validated annual workbook observations as the deployment seed.
seed = {"datasets": {"topix": datasets["topix"]},
        "sources": [s for s in fetcher.sources if s["id"] in datasets["topix"]["sourceIds"]]}
(ROOT / "workers" / "weekly-report" / "data" / "topix.json").write_text(json.dumps(seed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"asOf": args.as_of, "series": [{"id": s["id"], "halfYears": sum(v is not None for v in s["values"]), "latestDate": s["latestDate"]} for s in chart["series"]]}))
