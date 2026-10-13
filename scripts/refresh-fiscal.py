"""Refresh official fiscal data; invalidate a summary tied to older figures."""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers/weekly-report"))
from sources import Fetcher
from fiscal import collect_fiscal
from integrated import integrate

raw_dir = ROOT / "tmp/fiscal-refresh"
raw_dir.mkdir(parents=True, exist_ok=True)
def archive(sid, raw, metadata):
    (raw_dir / sid).write_bytes(raw)
    (raw_dir / (sid + ".json")).write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")

as_of = datetime.now(timezone.utc).date().isoformat()
fiscal = collect_fiscal(Fetcher(archive), as_of)
(ROOT / "workers/weekly-report/data/fiscal.json").write_text(json.dumps(fiscal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
target = ROOT / "lib/reports/data/markets.json"
chart = json.loads(target.read_text(encoding="utf-8"))
chart = integrate(chart, previous_fiscal=fiscal)
chart.pop("insight", None)
target.write_text(json.dumps(chart, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"debtObservations": len(fiscal["debt"]), "budgetYears": len(fiscal["budgets"])}))
