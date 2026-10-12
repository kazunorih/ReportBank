"""Import the user's BOJ LA01 CSV without inventing missing observations."""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers" / "weekly-report"))
from lending import parse_lending_csv, CODES

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("file", type=Path)
args = parser.parse_args()
raw = args.file.read_bytes()
data = {"unit": "兆円", "originalUnit": "億円", "seriesCodes": CODES,
        "observations": parse_lending_csv(raw), "originalFile": args.file.name,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "source": {"id": "boj-la01-lending", "name": "日本銀行時系列統計データ検索サイト・貸出先別貸出金（LA01）",
                   "url": "https://www.stat-search.boj.or.jp/ssi/cgi-bin/famecgi2?cgi=$nme_a000&lstSelection=LA01",
                   "retrievedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}}
(ROOT / "workers/weekly-report/data/lending-la01.csv").write_bytes(raw)
(ROOT / "lib/reports/data/lending.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"quarters": len(data["observations"]), "first": data["observations"][0], "last": data["observations"][-1]}))
