"""Download and retain the BOJ financial-statement figures and provenance."""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers/weekly-report"))
from boj_financials import collect_statements
from sources import Fetcher

raw_dir = ROOT / "tmp/boj/raw"
raw_dir.mkdir(parents=True, exist_ok=True)
def archive(source_id, raw, metadata):
    (raw_dir / f"{source_id}.html").write_bytes(raw)

fetcher = Fetcher(archive)
data = {"observations": collect_statements(fetcher, datetime.now(timezone.utc).date().isoformat()), "sources": fetcher.sources}
for target in (ROOT / "lib/reports/data/boj-financials.json", ROOT / "workers/weekly-report/data/boj-financials.json"):
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
from integrated import integrate
chart_path = ROOT / "lib/reports/data/markets.json"
chart = integrate(json.loads(chart_path.read_text(encoding="utf-8")))
chart.pop("insight", None)
chart_path.write_text(json.dumps(chart, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"count": len(data["observations"]), "first": data["observations"][0], "last": data["observations"][-1]}))
