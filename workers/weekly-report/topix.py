"""TOPIX price index from JPX monthly statistical bulletins (table 3-1)."""
import io
import re
import unicodedata
from urllib.parse import urljoin

from domain import month_end
from sources import Html, with_provenance

INDEX = "https://www.jpx.co.jp/markets/statistics-equities/monthly/index.html"


def parse_topix_text(text):
    text = unicodedata.normalize("NFKC", text)
    compact = re.sub(r"\s+", "", text)
    if not re.search(r"StockPriceIndex(?:&StockPriceAverage)?\(EndofYear/Month/Daily\)", compact) or "TOPIX" not in compact:
        raise ValueError("JPX table 3-1 monthly TOPIX header not found")
    rows, current_year = [], None
    for line in text.splitlines():
        line = re.sub(r"^\s*\d{1,2}\s*\(((?:19|20)\d{2})\)", r"\1", line)
        if rows and re.match(r"^\s*\d{1,2}\.\d{1,2}(?:\s|$)", line):
            break  # Daily block starts with month.day; never treat days as months.
        match = re.match(r"^\s*(20\d{2}|19\d{2})\s+(\d{1,2})\s+([\d,]+\.\d{2})\s", line)
        if match:
            current_year, month, value = int(match[1]), int(match[2]), float(match[3].replace(",", ""))
        else:
            continuation = re.match(r"^\s*(\d{1,2})\s+([\d,]+\.\d{2})\s", line)
            if current_year is None or not continuation:
                continue
            month, value = int(continuation[1]), float(continuation[2].replace(",", ""))
        if current_year:
            if not 1 <= month <= 12 or value <= 0:
                raise ValueError("Invalid TOPIX month/value")
            rows.append({"date": month_end(current_year, month), "value": value})
    if len(rows) < 12 or len({row["date"] for row in rows}) != len(rows):
        raise ValueError("Incomplete or duplicate monthly TOPIX table")
    months = [int(row["date"][:4]) * 12 + int(row["date"][5:7]) for row in rows]
    if any(b != a + 1 for a, b in zip(months, months[1:])):
        raise ValueError("Nonconsecutive monthly TOPIX table")
    return rows


def collect_topix(fetcher, as_of, backfill=False):
    from pypdf import PdfReader
    raw, _ = fetcher.get(INDEX, "JPX・統計月報一覧")
    html = raw.decode("utf-8-sig")
    pages = [(INDEX, html)]
    if backfill:
        for href in dict.fromkeys(re.findall(r'<option[^>]+value="([^"]+)"', html)):
            url = urljoin(INDEX, href)
            if url != INDEX:
                content, _ = fetcher.get(url, "JPX・統計月報バックナンバー")
                pages.append((url, content.decode("utf-8-sig")))
    observations, source_ids = {}, []
    for page_url, content in pages:
        links = [(re.search(r"03_sisu(\d{2})(\d{2})\.pdf$", href), href) for href, _ in Html(content).links]
        candidates = [(f"20{m[1]}-{m[2]}-01", urljoin(page_url, href)) for m, href in links if m]
        candidates = [entry for entry in candidates if entry[0] <= as_of]
        if not candidates:
            continue
        _, url = max(candidates)
        raw, source_id = fetcher.get(url, "JPX・統計月報 3-1 株価指数（年月末・日別）")
        reader = PdfReader(io.BytesIO(raw))
        text = reader.pages[0].extract_text()
        try:
            rows = parse_topix_text(text)
        except ValueError as error:
            raise ValueError(f"{url}: {error}; header={text[:180]!r}") from error
        source_ids.append(source_id)
        for row in rows:
            if row["date"] <= as_of:
                observations.setdefault(row["date"], row)  # Newest bulletin wins.
    if not observations:
        raise ValueError("No published TOPIX monthly observations")
    return with_provenance({"topix": sorted(observations.values(), key=lambda row: row["date"])}, source_ids)
