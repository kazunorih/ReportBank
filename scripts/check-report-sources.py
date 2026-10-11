"""Read-only live source smoke test. Never invokes OpenAI or writes to AWS.

python scripts/check-report-sources.py --as-of 2026-10-11
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers" / "weekly-report"))
if os.environ.get("REPORT_TEST_DEPENDENCIES"):
    sys.path.insert(0, os.environ["REPORT_TEST_DEPENDENCIES"])
from domain import SERIES, aggregate, half_years
from sources import Fetcher, collect_boj, collect_flat35, collect_jpx, collect_mlit, collect_mof

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--as-of", default=datetime.now(timezone(timedelta(hours=9))).date().isoformat())
args = parser.parse_args()
fetcher = Fetcher()
failed = False
for collector in (collect_mof, collect_boj, collect_jpx, collect_mlit, collect_flat35):
    try:
        data = collector(fetcher, args.as_of)
        for key, dataset in data.items():
            rows = dataset["observations"]
            values = aggregate(rows, half_years(args.as_of), SERIES[key][1])
            print(json.dumps({"series": key, "observations": len(rows), "first": min(r["date"] for r in rows),
                              "latest": max(r["date"] for r in rows), "halfYears": sum(v is not None for v in values)}))
    except Exception as error:
        failed = True
        print(json.dumps({"collector": collector.__name__, "error": str(error)}))
sys.exit(1 if failed else 0)
