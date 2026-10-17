"""MOF central-government debt and general-account initial-budget interest."""
import io
import re
import unicodedata
import json
from datetime import date
from pathlib import Path
from sources import Html

DEBT_INDEX = "https://www.mof.go.jp/jgbs/reference/gbb/data.htm"
DEBT_XLS = "https://www.mof.go.jp/jgbs/reference/gbb/suii.xls"
BUDGET_INDEX = "https://www.mof.go.jp/policy/budget/budger_workflow/budget/index.html"
BUDGET_TOTALS = "https://www.mof.go.jp/policy/budget/reference/statistics/19b.xlsx"

def compact(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value or "")))

def decode_html(raw):
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp932")

def parse_debt_html(raw):
    html = decode_html(raw)
    text = compact(" ".join(Html(html).text))
    match = re.search(r"国債及び借入金(?:並びに政府保証債務)?現在高[（(](平成|令和)(元|\d+)年(\d+)月末現在", text)
    if not match or "単位:億円" not in text:
        raise ValueError("Unexpected debt statement date or unit")
    year = (1988 if match[1] == "平成" else 2018) + (1 if match[2] == "元" else int(match[2]))
    month = int(match[3])
    # The first total is debt; the separately published government guarantees are excluded.
    amounts = []
    for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", html, re.S | re.I):
        cells = [compact("".join(Html(cell).text)) for cell in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row, re.S | re.I)]
        if "合計" in cells:
            value = cells[cells.index("合計") + 1]
            if not re.fullmatch(r"\d{1,3}(?:,\d{3})+", value):
                raise ValueError("Unexpected debt amount cell")
            amounts.append(int(value.replace(",", "")))
    if not amounts:
        raise ValueError("Missing debt total")
    from domain import month_end
    return {"date": month_end(year, month), "amount": amounts[0] / 10000}

def parse_debt_xls(raw):
    import xlrd
    sheet = xlrd.open_workbook(file_contents=raw).sheet_by_index(0)
    rows = [sheet.row_values(i) for i in range(sheet.nrows)]
    if not any("100 million yen" in str(v) for row in rows for v in row):
        raise ValueError("Unexpected debt workbook unit")
    header = next(row for row in rows if any(re.search(r"20\d{2} (March|June|September|December)", str(v)) for v in row))
    total = next(row for row in rows if any(compact(v).lower() in ("合計total", "total") for v in row))
    from domain import month_end
    output = []
    for col, cell in enumerate(header):
        match = re.search(r"(20\d{2}) (March|June|September|December)", str(cell))
        if match:
            amount = total[col]
            if not isinstance(amount, (float, int)) or amount <= 0:
                raise ValueError("Invalid debt total")
            month = {"March": 3, "June": 6, "September": 9, "December": 12}[match[2]]
            output.append({"date": month_end(int(match[1]), month), "amount": amount / 10000})
    if not output:
        raise ValueError("Empty debt workbook")
    return output

def parse_budget_totals(raw):
    import openpyxl
    book = openpyxl.load_workbook(io.BytesIO(raw), data_only=True)
    output = {}
    for sheet in book:
        match = re.fullmatch(r"([HR])(元|\d+)", compact(sheet.title))
        if not match:
            continue
        year = (1988 if match[1] == "H" else 2018) + (1 if match[2] == "元" else int(match[2]))
        rows = list(sheet.values)
        if not any("単位:千円" in compact(v) for row in rows[:3] for v in row):
            raise ValueError("Unexpected initial budget unit")
        col = next(i for row in rows[:5] for i, v in enumerate(row) if compact(v) == "当初予算")
        totals = [row[col] for row in rows if any(compact(v) == "合計" for v in row[:col])]
        if len(totals) != 1 or not isinstance(totals[0], (float, int)) or totals[0] <= 0:
            raise ValueError("Ambiguous initial budget total")
        output[year] = totals[0] / 1_000_000_000
    return output

def interest_from_pages(pages):
    found = []
    for page_number, text in pages:
        text = compact(text)
        pattern = r"((?:国債|公債|年金特例公債|復興債)利子(?:等)?(?:の)?支払財源の国債整理基金特別会計へ繰入れに必要な経費)(\d{1,3}(?:,\d{3}){2,})"
        for match in re.finditer(pattern, text):
            if "千円" not in text:
                raise ValueError("Unexpected interest appropriation unit")
            organization = "大蔵省" if "大蔵省所管大蔵本省" in text else "財務省" if "財務省所管財務本省" in text else None
            if organization is None:
                raise ValueError("Unknown interest appropriation organization")
            found.append({"label": match[1], "amount": int(match[2].replace(",", "")) / 1_000_000_000, "page": page_number + 1, "organization": organization})
    # FY2000 contains both ministries before/after the January 2001 reorganization.
    if not any(re.match(r"(?:国債|公債)利子", row["label"]) for row in found) or len({(row["label"], row["organization"]) for row in found}) != len(found):
        raise ValueError("Missing or duplicate interest appropriations")
    return found

def collect_fiscal(fetcher, as_of, previous=None):
    seed = json.loads((Path(__file__).parent / "data/fiscal.json").read_text(encoding="utf-8"))
    debt = {row["date"]: row for row in seed["debt"]}
    budgets = {row["fiscalYear"]: row for row in seed["budgets"]}
    sources = {s["id"]: s for s in seed["sources"]}
    if previous:
        previous = json.loads(json.dumps(previous, default=float))
        debt.update({row["date"]: row for row in previous["debt"]})
        budgets.update({int(row["fiscalYear"]): row for row in previous["budgets"]})
        sources.update({s["id"]: s for s in previous["sources"]})
    if fetcher:
        _, debt_index_id = fetcher.get(DEBT_INDEX, "財務省・国債及び借入金並びに政府保証債務現在高（統計表一覧）")
        raw, sid = fetcher.get(DEBT_XLS, "財務省・最近5年間の国債及び借入金並びに政府保証債務現在高の推移")
        debt.update({row["date"]: {**row, "sourceIds": [debt_index_id, sid]} for row in parse_debt_xls(raw)})
        _, budget_index_id = fetcher.get(BUDGET_INDEX, "財務省・予算（年度別資料）")
        raw, total_id = fetcher.get(BUDGET_TOTALS, "財務省・財政統計第19表（2）一般会計歳出当初予算及び補正予算")
        totals = parse_budget_totals(raw)
        current_fy = date.fromisoformat(as_of).year - (date.fromisoformat(as_of).month < 4)
        for year, total in totals.items():
            if year < current_fy - 49 or year > current_fy:
                continue
            existing = budgets.get(year)
            if not existing:
                url = f"https://www.bb.mof.go.jp/server/{year}/dlpdf/DL{year}11001.pdf"
                raw, interest_id = fetcher.get(url, f"財務省・{year}年度一般会計当初予算書（国債利子等の支払財源）")
                from pypdf import PdfReader
                items = interest_from_pages((i, p.extract_text()) for i, p in enumerate(PdfReader(io.BytesIO(raw)).pages))
                existing = {"fiscalYear": year, "interest": sum(item["amount"] for item in items), "components": items,
                            "sourceIds": [budget_index_id, interest_id], "basis": "initial-budget"}
            existing = {**existing, "budget": total, "interest": float(existing["interest"]),
                        "sourceIds": list(dict.fromkeys(existing["sourceIds"] + [budget_index_id, total_id]))}
            existing["share"] = existing["interest"] / total * 100
            budgets[year] = existing
        sources.update({s["id"]: s for s in fetcher.sources})
    current_fy = date.fromisoformat(as_of).year - (date.fromisoformat(as_of).month < 4)
    from domain import half_years
    periods = half_years(as_of, 50)
    debt_rows = [{**row, "amount": float(row["amount"])} for stamp, row in sorted(debt.items()) if stamp in periods]
    budget_rows = [{**row, **{k: float(row[k]) for k in ("budget", "interest", "share")}, "fiscalYear": int(year)}
                   for year, row in sorted(budgets.items()) if current_fy - 49 <= year <= current_fy]
    if not debt_rows or not budget_rows:
        raise ValueError("Missing fiscal data; publication stopped")
    for row in budget_rows:
        if not 0 < row["interest"] < row["budget"] or abs(row["share"] - row["interest"] / row["budget"] * 100) > 1e-8:
            raise ValueError("Invalid interest budget share")
    used = {sid for row in debt_rows + budget_rows for sid in row["sourceIds"]}
    return {"debt": debt_rows, "budgets": budget_rows, "sources": [sources[sid] for sid in sorted(used)]}
