"""BOJ financial statement balance-sheet totals, at their actual reporting dates."""
import re
from html import unescape
from sources import Html

INDEX = "https://www.boj.or.jp/about/account/index.htm"


def parse_statement(html, year, half):
    tables = re.findall(r"<table\b[^>]*>.*?</table>", html, re.S | re.I)
    if not tables:
        raise ValueError("BOJ financial statement table missing")
    table = tables[0]
    compact = re.sub(r"\s+", "", unescape("".join(Html(table).text)))
    if "億円" not in compact or "資産の部合計" not in compact:
        raise ValueError("Unexpected financial statement unit or definition")
    if ("上半期末" in compact) != half:
        raise ValueError("Unexpected financial statement period")
    amounts = {}
    for row in re.findall(r"<tr\b[^>]*>.*?</tr>", table, re.S | re.I):
        headers = [re.sub(r"\s+", "", "".join(Html(cell).text)) for cell in re.findall(r"<th\b[^>]*>(.*?)</th>", row, re.S | re.I)]
        key = next((label for label in headers if label in ("国債", "資産の部合計")), None)
        if key:
            cells = [re.sub(r"\s+", "", "".join(Html(cell).text)) for cell in re.findall(r"<td\b[^>]*>(.*?)</td>", row, re.S | re.I)]
            if len(cells) < 2 or not all(re.fullmatch(r"[\d,]+", value) for value in cells[:2]):
                raise ValueError("Unexpected financial statement balance columns")
            amounts[key] = [int(value.replace(",", "")) for value in cells[:2]]
    if set(amounts) != {"国債", "資産の部合計"}:
        raise ValueError("Missing assets or Japanese government securities")
    rows = []
    for index, stamp_year in enumerate((year - 1, year)):
        total, jgb = amounts["資産の部合計"][index], amounts["国債"][index]
        if not 0 < jgb <= total:
            raise ValueError("Invalid BOJ balance sheet")
        rows.append({"date": f"{stamp_year}-{'09-30' if half else '03-31'}",
                     "assets": total / 10000, "jgb": jgb / 10000, "other": (total - jgb) / 10000})
    return rows


def collect_statements(fetcher, as_of):
    page, index_id = fetcher.html(INDEX, "日本銀行・会計・決算（財務諸表）")
    links = sorted({href for href, _ in page.links if re.fullmatch(r"/about/account/zai\d{2}(?:05|11)a.htm", href)}, reverse=True)
    if not links:
        raise ValueError("No BOJ financial statements linked")
    observations = {}
    for href in links:
        match = re.search(r"zai(\d{2})(05|11)a", href)
        year, half = 2000 + int(match[1]), match[2] == "11"
        raw, source_id = fetcher.get("https://www.boj.or.jp" + href, f"日本銀行・{year}年{'9月末' if half else '3月末'}の財務諸表・決算概要")
        for row in parse_statement(raw.decode("utf-8-sig"), year, half):
            if row["date"] <= as_of:
                observations.setdefault(row["date"], {**row, "sourceIds": [index_id, source_id], "basis": "financial-statements"})
    return sorted(observations.values(), key=lambda row: row["date"])
