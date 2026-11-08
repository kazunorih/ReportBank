"""Rebuild FIGURE03-3 from official METI yearbooks distributed by e-Stat.

Requires openpyxl and xlrd. See docs/production-statistics.md for source review.
Amounts are stored in million yen. Confidential/unknown cells remain missing.
"""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.request import urlopen

import openpyxl
import xlrd

ROOT = Path(__file__).resolve().parents[1]


def norm(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value or "")))


def money(value, factor=1):
    if isinstance(value, (int, float)):
        return float(Decimal(str(value)) * Decimal(str(factor)))
    return None


def product_name(name, table="", code=""):
    name = norm(name).replace("(自動車部品)", "").replace("(内燃機関電装品)", "")
    name = name.replace("ウェーハ", "ウエハ").replace("ウェハ", "ウエハ")
    if table == "2400":
        if code in ("0101", "0102", "0103"):
            return "乗用車"
        if code in ("0106", "0107", "0108"):
            return "トラック"
        if code in ("0112", "0113", "0114", "0115"):
            return "二輪自動車"
    if table == "legacy-auto":
        if name in ("トラック(軽自動車)", "トラック(小型自動車)", "トラック(普通自動車)"):
            return "トラック"
        if name.startswith("気筒容積"):
            return "二輪自動車"
        if "気筒容積" in name and any(name.startswith(prefix) for prefix in ("軽自動車", "小型自動車", "普通自動車")):
            return "乗用車"
        if name in ("軽自動車", "小型自動車", "普通自動車") or any(name.startswith(prefix) for prefix in ("小型自動車ガソリン", "小型自動車ディーゼル", "普通自動車ガソリン", "普通自動車ディーゼル")):
            return "トラック"
        if any(token in name for token in ("原動機付自転車", "軽二輪", "小型二輪", "二輪自動車")):
            return "二輪自動車"
    if table == "legacy-motorcycles" and any(token in name for token in ("気筒容積", "原動機付", "軽二輪", "小型二輪")):
        return "二輪自動車"
    return name


def modern(path, source):
    with path.open("rb") as stream:
        book = openpyxl.load_workbook(stream, read_only=True, data_only=True)
        rows = list(book["実数表"].values)
    year = max(int(str(v)[:4]) for v in rows[0][8:] if re.fullmatch(r"20\d{8}", str(v)))
    annual = [c for c, v in enumerate(rows[0]) if str(v) == f"{year}000000"]
    monthly = list(range(8, 20)) if year >= 2024 else [c for c, v in enumerate(rows[1]) if re.match(f"{year}年\\d+月\\(", str(v))]
    if not annual and len(monthly) != 12:
        raise ValueError(f"Missing calendar months: {year}")
    result = []
    for row in rows[2:]:
        metric, field, unit = norm(row[6]), norm(row[4]), norm(row[7])
        if "生産" not in metric or "金額" not in metric or unit not in ("百万円", "千円"):
            continue
        cosmetic = str(row[0]) == "6175" and norm(row[5]) == "全国計"
        if any(word in field for word in ("内訳", "部門", "労務", "能力", "方式")) and "段ボール" not in field and not cosmetic:
            continue
        table, code = str(row[0]), str(row[1])
        values = [money(row[c], 0.001 if unit == "千円" else 1) for c in (annual or monthly)]
        value = float(sum(Decimal(str(v)) for v in values)) if all(v is not None for v in values) else None
        result.append(dict(year=year, name="化粧品" if cosmetic else product_name(row[5], table, code), value=value, source=source,
                           locator=f"実数表:{table}/{code}/{row[2]}", rawName=norm(row[5])))
    return result


def legacy(path, source):
    book = xlrd.open_workbook(path, formatting_info=True)
    output = []
    for sheet in book.sheets():
        # Cosmetics production is published by geography, so use Japan total
        # once; product-type tables in this chapter report sales, not production.
        if "化粧品生産金額" in norm(sheet.name):
            national = next((r for r in range(sheet.nrows) if any(norm(sheet.cell_value(r, c)) == "全国計" for c in range(sheet.ncols))), None)
            year_cols = []
            if national is not None:
                for r in range(national):
                    for c in range(sheet.ncols):
                        match = re.fullmatch(r"平成(\d+)年", norm(sheet.cell_value(r, c)))
                        if match:
                            year_cols.append((1988 + int(match[1]), c))
                        match = re.fullmatch(r"(20\d{2})年", norm(sheet.cell_value(r, c)))
                        if match:
                            year_cols.append((int(match[1]), c))
                if year_cols:
                    year, c = max(year_cols)
                    if 2007 <= year <= 2020:
                        unit_text = norm([sheet.row_values(r) for r in range(min(national, 4))])
                        factor = .001 if "千円" in unit_text else 1
                        output.append(dict(year=year, name="化粧品", value=money(sheet.cell_value(national, c), factor), source=source, locator=f"{sheet.name}:R{national + 1}C{c + 1}", rawName="全国計"))
            continue
        dates = []
        for r in range(sheet.nrows):
            for c in range(sheet.ncols):
                cell = sheet.cell(r, c)
                fmt = book.format_map[book.xf_list[cell.xf_index].format_key].format_str or ""
                year = None
                if cell.ctype == 3 and not any(s in fmt for s in ("FY", "年度", "月")) and ("yyyy" in fmt or "年" in fmt):
                    year = xlrd.xldate_as_datetime(cell.value, book.datemode).year
                if cell.ctype == 2 and ("ggg" in fmt or re.search(r"(?:^|\])e_*$", fmt)):
                    date = xlrd.xldate_as_datetime(cell.value, book.datemode)
                    if date.month == 1 and date.day == 1 and not any(s in fmt for s in ("FY", "年度", "月")):
                        year = date.year
                match = re.fullmatch(r"\((20\d{2})CY\)", norm(cell.value))
                if match:
                    year = int(match[1])
                if year is not None and 2007 <= year <= 2020:
                    dates.append((r, c, year))
        if not dates:
            continue
        year = max(y for _, _, y in dates)
        target = min(r for r, _, y in dates if y == year)
        first = min(r for r, _, _ in dates)
        for r in range(first):
            if any(sheet.cell(r, c).ctype == 3 and "月" not in (book.format_map[book.xf_list[sheet.cell(r, c).xf_index].format_key].format_str or "") for c in range(sheet.ncols)):
                first = r
                break
        grid = [sheet.row_values(r) for r in range(first)]
        for r0, r1, c0, c1 in sheet.merged_cells:
            for r in range(r0, min(r1, first)):
                for c in range(c0, c1):
                    grid[r][c] = sheet.cell_value(r0, c0)

        left_grid = []
        for cells in grid:
            previous = ""
            filled = []
            for cell in cells:
                previous = norm(cell) or previous
                filled.append(previous)
            left_grid.append(filled)

        def near(r, c):
            return left_grid[r][c]

        for c in range(sheet.ncols):
            units = [r for r in range(first) if "金額" in norm(grid[r][c]) and any(u in norm(grid[r][c]) for u in ("百万円", "千円"))]
            if not units:
                continue
            ur = units[-1]
            production = [r for r in range(ur) if ("生産" in near(r, c) or "Production" in near(r, c)) and len(near(r, c)) < 35]
            if not production:
                continue
            pr = production[-1]
            if any(any(w in near(r, c) for w in ("販売", "出荷", "受入", "Sales", "Receipts")) and "生産" not in near(r, c) for r in range(pr, ur)):
                continue
            headers = [near(r, c) for r in range(pr)]
            valid_name = lambda v: bool(re.search("[一-龥ァ-ヶ]", v)) and len(v) < 70 and not any(w in v for w in ("目次", "統計", "月報", "年報", "Previous", "生産", "(単位", "(Unit"))
            names = [v for v in headers if valid_name(v)]
            if not names:
                continue
            name_row = max(r for r in range(pr) if valid_name(near(r, c)))
            start = max(k for k in range(c + 1) if valid_name(norm(grid[name_row][k])))
            if any(re.search(r"\(?\d+[~～-]\d+\)?", norm(grid[r][k])) for r in range(pr) for k in range(start, c + 1)):
                continue  # Only the current item's range, not an ancestor's range.
            table = "legacy-auto" if re.match(r"^40(?:\D|$)", norm(sheet.name)) else "legacy-motorcycles" if re.match(r"^42(?:\D|$)", norm(sheet.name)) else ""
            name = product_name(names[-1], table)
            value = money(sheet.cell_value(target, c), 0.001 if "千円" in norm(grid[ur][c]) else 1)
            output.append(dict(year=year, name=name, value=value, source=source, locator=f"{sheet.name}:R{target + 1}C{c + 1}", rawName=names[-1]))
        if "印刷" in sheet.name and "時系列" in sheet.name:
            for c, name in zip(range(5, 12), ["出版印刷", "商業印刷", "証券印刷", "事務用印刷", "包装印刷", "建装材印刷", "その他の印刷"]):
                if c < sheet.ncols:
                    output.append(dict(year=year, name=name, value=money(sheet.cell_value(target, c)), source=source, locator=f"{sheet.name}:R{target + 1}C{c + 1}", rawName=name))
        if "消費部門別内訳" in norm(sheet.name) and "段ボール" in norm(sheet.name):
            for ur in range(sheet.nrows):
                for c in range(sheet.ncols):
                    if norm(sheet.cell_value(ur, c)) not in ("(百万円)", "(千円)"):
                        continue
                    candidates = [r for r, _, y in dates if y == year and r > ur]
                    if candidates:
                        r = min(candidates)
                        output.append(dict(year=year, name="段ボール箱等生産金額", value=money(sheet.cell_value(r, c), .001 if "千円" in norm(sheet.cell_value(ur, c)) else 1), source=source, locator=f"{sheet.name}:R{r + 1}C{c + 1}", rawName="段ボール箱等生産金額"))
    return output


def aggregate(records):
    points = []
    for year in range(2007, 2026):
        rows = [row for row in records if row["year"] == year]
        if len(rows) < 400:
            raise ValueError(f"Insufficient annual coverage: {year} ({len(rows)} records)")
        grouped = {}
        for row in rows:
            group = grouped.setdefault(row["name"], dict(known=Decimal(0), available=0, missing=0))
            if row["value"] is None:
                group["missing"] += 1
            else:
                group["known"] += Decimal(str(row["value"]))
                group["available"] += 1
        values = {name: float(group["known"]) if group["available"] else None for name, group in grouped.items()}
        points.append(dict(year=year, categories=values, partialCategories=[name for name, g in grouped.items() if g["missing"]],
                           total=float(sum(g["known"] for g in grouped.values())), observedItems=sum(g["available"] for g in grouped.values()), missingItems=sum(g["missing"] for g in grouped.values()), sourceIds=sorted({r["source"] for r in rows})))
    latest = points[-1]
    names = sorted((name for name, value in latest["categories"].items() if value is not None and name not in latest["partialCategories"]), key=lambda name: latest["categories"][name], reverse=True)[:10]
    series = [dict(key=f"item{i}", name=name) for i, name in enumerate(names)]
    for point in points:
        for item in series:
            point[item["key"]] = point["categories"].get(item["name"])
        point["other"] = float(Decimal(str(point["total"])) - sum(Decimal(str(point[s["key"]])) for s in series if point[s["key"]] is not None))
        if point["other"] < -0.000001:
            raise ValueError(f"Negative remaining amount: {point['year']}")
    return dict(firstYear=2007, latestYear=2025, rankingYear=2025, unit="百万円", series=series, points=points)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "tmp/meti-seidou")
    args = parser.parse_args()
    sources = json.loads((ROOT / "lib/reports/data/product-production-sources.json").read_text(encoding="utf-8"))
    records = []
    for source in sources:
        print(f"Reading {source['id']} ({source['format']})", flush=True)
        path = args.source_dir / f"{source['id']}.xls"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            with urlopen(source["url"], timeout=90) as response:
                path.write_bytes(response.read())
        if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError(f"Source changed; review before refresh: {source['id']}")
        records.extend(modern(path, source["id"]) if source["format"] == "modern" else legacy(path, source["id"]))
    data = aggregate(records)
    data.update(retrievedAt=datetime.now(timezone.utc).isoformat(), indexUrl="https://www.meti.go.jp/statistics/tyo/seidou/result/ichiran/08_seidou.html", sources=sources)
    (ROOT / "lib/reports/data/product-production.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Years:", len(data["points"]), "Top 10:", ", ".join(s["name"] for s in data["series"]))


if __name__ == "__main__":
    main()
