"""Import FIGURE04 from the same official nominal-GDP workbook as FIGURE02.

python scripts/import-gdp.py [--source-dir tmp/production-sources]
Uses Python's standard library; the workbook is read without modification.
"""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
from urllib.request import urlopen
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
N = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
NAMES = ["農林水産業", "鉱業", "製造業", "電気・ガス・水道・廃棄物処理業", "建設業",
         "卸売・小売業", "運輸・郵便業", "宿泊・飲食サービス業", "情報通信業", "金融・保険業",
         "不動産業", "専門・科学技術、業務支援サービス業", "公務", "教育", "保健衛生・社会事業", "その他のサービス"]


def read_nominal(path):
    with zipfile.ZipFile(path) as book:
        strings = ["".join(t.text or "" for t in item.findall(".//m:t", N))
                   for item in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", N)]
        sheets = ET.fromstring(book.read("xl/workbook.xml")).find("m:sheets", N)
        if sheets[0].attrib["name"] != "実数":
            raise ValueError("Expected nominal amounts as first sheet")
        rows = []
        for row in ET.fromstring(book.read("xl/worksheets/sheet1.xml")).findall(".//m:row", N):
            cells = {}
            for cell in row:
                value = cell.find("m:v", N)
                if value is not None:
                    cells[re.sub(r"\d", "", cell.attrib["r"])] = strings[int(value.text)] if cell.attrib.get("t") == "s" else Decimal(value.text)
            rows.append(cells)
    return rows


def parse(rows):
    if not any("名目" in str(r.get("A", "")) for r in rows) or not any("１０億円" in str(r.get("A", "")) for r in rows):
        raise ValueError("Expected nominal GDP in billion yen")
    years = next(r for r in rows if r.get("B") == 1994)
    sectors = {}
    for row in rows:
        match = re.match(r"^\s*([０-９0-9]+)．", str(row.get("A", "")))
        if match and isinstance(row.get("B"), Decimal):
            index = int(match[1]) - 1
            if index in sectors or index not in range(16) or NAMES[index] not in str(row["A"]):
                raise ValueError("Unexpected or duplicate industry classification")
            sectors[index] = row
    if len(sectors) != 16:
        raise ValueError("Expected 16 non-overlapping industries")

    def row(label):
        return next(r for r in rows if str(r.get("A", "")).strip() == label)

    total_row = row("国内総生産")
    subtotal_row = row("小計")
    tax_row = row("輸入品に課される税・関税")
    deduction_row = row("（控除）総資本形成に係る消費税")
    discrepancy_row = row("統計上の不突合")
    points = []
    for col, year in years.items():
        if col == "A":
            continue
        amounts = {f"sector{i + 1}": sectors[i][col] for i in range(16)}
        subtotal, total = subtotal_row[col], total_row[col]
        taxes, deduction, discrepancy = tax_row[col], deduction_row[col], discrepancy_row[col]
        if abs(sum(amounts.values()) - subtotal) > Decimal("1"):
            raise ValueError(f"Industry subtotal mismatch: {year}")
        if abs(subtotal + taxes - deduction + discrepancy - total) > Decimal("0.2"):
            raise ValueError(f"GDP reconciliation mismatch: {year}")
        if min(amounts.values()) < 0:
            raise ValueError("Negative industry amount")
        points.append(dict(year=int(year), **{k: float(v) for k, v in amounts.items()}, total=float(total),
                           subtotal=float(subtotal), importTaxes=float(taxes), capitalFormationTax=float(deduction),
                           statisticalDiscrepancy=float(discrepancy)))
    if [p["year"] for p in points] != list(range(1994, points[-1]["year"] + 1)):
        raise ValueError("Incomplete annual GDP series")
    ranking = sorted(range(16), key=lambda i: points[-1][f"sector{i + 1}"], reverse=True)
    top = ranking[:10]
    for point in points:
        point["other"] = float(Decimal(str(point["total"])) - sum(Decimal(str(point[f"sector{i + 1}"])) for i in top))
        if point["other"] < 0:
            raise ValueError("Negative remaining GDP")
    return dict(unit="10億円", firstYear=points[0]["year"], latestYear=points[-1]["year"],
                rankingYear=points[-1]["year"], series=[dict(key=f"sector{i + 1}", name=NAMES[i]) for i in top],
                otherIndustries=[NAMES[i] for i in range(16) if i not in top], points=points)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path)
    args = parser.parse_args()
    production = json.loads((ROOT / "lib/reports/data/production.json").read_text(encoding="utf-8"))
    source = next(s for s in production["sources"] if s["id"] == "industry")
    directory = args.source_dir or ROOT / "tmp/gdp-sources"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "industry.xlsx"
    if args.source_dir is None:
        with urlopen(source["url"], timeout=90) as response:
            path.write_bytes(response.read())
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != source["sha256"]:
        raise ValueError("Workbook differs from FIGURE02. Refresh FIGURE02 first to keep the data vintage consistent.")
    result = parse(read_nominal(path))
    result.update(source=source, retrievedAt=production["retrievedAt"], processedAt=datetime.now(timezone.utc).isoformat())
    for point, factory in zip(result["points"], production["industry"], strict=True):
        if point["year"] != factory["year"] or any(point[k] != factory[label] for k, label in [("sector2", "mining"), ("sector3", "manufacturing"), ("sector5", "construction")]):
            raise ValueError("FIGURE02 observation mismatch")
    (ROOT / "lib/reports/data/gdp.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"GDP: {result['firstYear']}–{result['latestYear']}, {len(result['points'])} years")
    print("Top 10:", ", ".join(s["name"] for s in result["series"]))


if __name__ == "__main__":
    main()
