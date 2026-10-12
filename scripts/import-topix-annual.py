"""Import a supplied JPX annual XLS, preserving the original and its provenance."""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers" / "weekly-report"))
if os.environ.get("REPORT_TEST_DEPENDENCIES"):
    sys.path.insert(0, os.environ["REPORT_TEST_DEPENDENCIES"])
from topix import parse_topix_annual, ANNUAL_FILE, ANNUAL_INDEX
from domain import SERIES, aggregate

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("file", type=Path)
args = parser.parse_args()
raw = args.file.read_bytes()
rows = parse_topix_annual(raw)
stamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
sources = [{"id": hashlib.sha256(url.encode()).hexdigest()[:16], "url": url, "name": name, "retrievedAt": stamp}
           for url, name in [(ANNUAL_INDEX, "JPX・TOPIX（東証株価指数）― 指数値の推移"),
                             (ANNUAL_FILE, "JPX・TOPIX年間四本値（topixyear_j.xls、年末終値）")]]
data = {"observations": rows, "sourceIds": [s["id"] for s in sources], "method": "annual-close-v1"}
target = ROOT / "workers" / "weekly-report" / "data"
(target / "topixyear_j.xls").write_bytes(raw)
seed = {"datasets": {"topix": data}, "sources": sources,
        "originalFile": "topixyear_j.xls", "sha256": hashlib.sha256(raw).hexdigest()}
(target / "topix.json").write_text(json.dumps(seed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
path = ROOT / "lib" / "reports" / "data" / "markets.json"
chart = json.loads(path.read_text(encoding="utf-8"))
visible = [row for row in rows if row["date"] <= chart["asOf"]]
series = next(s for s in chart["series"] if s["id"] == "topix")
series.update(values=aggregate(visible, chart["periods"], "last"), sourceIds=data["sourceIds"],
              latestDate=max(r["date"] for r in visible), note=SERIES["topix"][2])
used = {sid for item in chart["series"] for sid in item["sourceIds"]}
chart["sources"] = list({s["id"]: s for s in chart["sources"] + sources if s["id"] in used}.values())
chart["warnings"] = [w for w in chart["warnings"] if not w.startswith("TOPIX：")]
count = sum(v is not None for v in series["values"])
chart["warnings"].append(f"TOPIX：年間四本値の年末終値を{count}年分収録。6月および未収録年の値は表示していません。")
chart["topixMethod"] = "annual-close-v1"
chart.pop("insight", None)  # The previous summary may cite values no longer in the chart.
path.write_text(json.dumps(chart, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"years": len(rows), "displayedYears": count, "first": rows[0], "last": rows[-1], "sha256": seed["sha256"]}))
