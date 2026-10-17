"""Allowlisted public-source adapters and provenance-preserving CSV imports."""
import csv
import hashlib
import io
import json
import re
import unicodedata
from decimal import Decimal
from pathlib import Path
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler

from domain import SERIES, month_end, number, parse_boj, parse_mof

ALLOWED_HOSTS = {
    "www.mhlw.go.jp",
    "www.bb.mof.go.jp", "warp.ndl.go.jp",
    "www.stat-search.boj.or.jp", "www.boj.or.jp", "www.mof.go.jp",
    "www.meti.go.jp", "www.mlit.go.jp", "www.e-stat.go.jp", "www.jpx.co.jp",
    "www.flat35.com", "www.jhf.go.jp", "www.simulation.jhf.go.jp",
    "indexes.nikkei.co.jp", "www.zenginkyo.or.jp", "www.jsda.or.jp",
    "www.peajapan.org", "www.jri.co.jp", "www.jcer.or.jp",
}

CONTEXT_SOURCES = [
    ("meti", "経済産業省・経済解析室", "https://www.meti.go.jp/statistics/toppage/report/"),
    ("jba", "全国銀行協会・各種統計資料", "https://www.zenginkyo.or.jp/stats/"),
    ("jsda", "日本証券業協会・統計情報", "https://www.jsda.or.jp/shiryoshitsu/toukei/"),
    ("jpea", "日本プライベート・エクイティ協会・公表情報", "https://www.peajapan.org/"),
    ("jcer", "公益社団法人日本経済研究センター・公表情報", "https://www.jcer.or.jp/"),
    ("jhf", "住宅金融支援機構・フラット35借入金利の推移", "https://www.flat35.com/kinri/kinri_suii.html"),
]


def safe_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Source URL is outside the approved HTTPS hosts")
    return url


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        safe_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Html(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.links, self.text, self.hidden, self.anchor = [], [], 0, None
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "header", "footer"):
            self.hidden += 1
        if tag == "a":
            self.anchor = [dict(attrs).get("href", ""), ""]

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "header", "footer"):
            self.hidden = max(0, self.hidden - 1)
        if tag == "a" and self.anchor:
            self.links.append(tuple(self.anchor))
            self.anchor = None

    def handle_data(self, value):
        if not self.hidden and value.strip():
            self.text.append(value.strip())
        if self.anchor:
            self.anchor[1] += value


class Fetcher:
    def __init__(self, archive=None):
        self.archive = archive
        self.sources = []

    def get(self, url, name):
        safe_url(url)
        request = Request(url, headers={"User-Agent": "ReportBank-Weekly/1.0 (public statistics)", "Accept-Encoding": "identity"})
        with build_opener(SafeRedirect()).open(request, timeout=45) as response:
            raw = response.read(15 * 1024 * 1024 + 1)
            final_url = safe_url(response.url)
        if len(raw) > 15 * 1024 * 1024:
            raise ValueError("Source exceeds size limit")
        source_id = hashlib.sha256(final_url.encode()).hexdigest()[:16]
        source = {"id": source_id, "name": name, "url": final_url,
                  "retrievedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
        self.sources.append(source)
        if self.archive:
            self.archive(source_id, raw, source)
        return raw, source_id

    def html(self, url, name):
        raw, source_id = self.get(url, name)
        return Html(raw.decode("utf-8-sig")), source_id


def with_provenance(data, source_ids):
    return {key: {"observations": values, "sourceIds": source_ids} for key, values in data.items()}


def collect_mof(fetcher, as_of):
    result = {key: {} for key in ("jgb3", "jgb10", "jgb30")}
    ids = []
    for suffix in ("data/jgbcm_all.csv", "jgbcm.csv"):
        raw, source_id = fetcher.get("https://www.mof.go.jp/jgbs/reference/interest_rate/" + suffix, "財務省・国債金利情報")
        ids.append(source_id)
        for key, rows in parse_mof(raw).items():
            result[key].update({row["date"]: row for row in rows if row["date"] <= as_of})
    return with_provenance({key: list(rows.values()) for key, rows in result.items()}, ids)


def collect_boj(fetcher, as_of):
    result = {}
    groups = {
        "BS01": {"MABJMTA": "bojAssets", "MABJMA5": "bojJgb"},
        "FF": {"FOF_FFALA00A411": "corporateLoans", "FOF_FFALA00A430": "householdLoans",
               "FOF_FFALA00A422": "publicLoans", "FOF_FFAS120A311": "bankJgb"},
    }
    for db, codes in groups.items():
        # A 31-year request fits well under the API observation limit for these series.
        params = {"format": "json", "db": db, "code": ",".join(codes), "startDate": f"{int(as_of[:4])-31}01"}
        raw, source_id = fetcher.get("https://www.stat-search.boj.or.jp/api/v1/getDataCode?" + urlencode(params),
                                     "日本銀行・" + ("日本銀行勘定" if db == "BS01" else "資金循環統計・預金取扱機関"))
        data = parse_boj(json.loads(raw), codes)
        data = {key: [row for row in rows if row["date"] <= as_of] for key, rows in data.items()}
        result.update(with_provenance(data, [source_id]))
    return result


def parse_jpx(raw):
    import openpyxl
    workbook = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    observations = {}
    for sheet in workbook:
        rows = list(sheet.values)
        header = next((i for i, row in enumerate(rows[:15]) if any("End of Month" in str(cell) for cell in row)), None)
        if header is None:
            raise ValueError("Unknown JPX sheet layout")
        if not any("mil." in str(cell) or "百万円" in str(cell) for row in rows[:header] for cell in row):
            raise ValueError("Unknown JPX unit")
        total_column = next((i for i, cell in enumerate(rows[header]) if "Total" in str(cell)), None)
        # Older sheet has individual market sections but no total column.
        market_columns = [i for i, cell in enumerate(rows[header]) if i > 0 and cell is not None]
        for row in rows[header + 1:]:
            if not isinstance(row[0], datetime):
                continue
            if total_column is not None:
                total = number(row[total_column])
            else:
                values = [number(row[i]) for i in market_columns]
                total = sum(v for v in values if v is not None)
                if not any(v is not None for v in values):
                    continue
            if total is not None:
                observations[row[0].date().isoformat()] = total / 1000000
    if len(observations) < 360:
        raise ValueError("JPX history is unexpectedly short")
    return [{"date": stamp, "value": value} for stamp, value in sorted(observations.items())]


def collect_jpx(fetcher, as_of):
    url = "https://www.jpx.co.jp/markets/statistics-equities/misc/02.html"
    html, index_id = fetcher.html(url, "日本取引所グループ・市場別時価総額")
    link = next((href for href, _ in html.links if "historical-jika" in href and href.endswith(".xlsx")), None)
    if not link:
        raise ValueError("JPX history download not found")
    raw, source_id = fetcher.get(urljoin(url, link), "東京証券取引所・月末時価総額（長期時系列）")
    rows = [row for row in parse_jpx(raw) if row["date"] <= as_of]
    return with_provenance({"marketCap": rows}, [index_id, source_id])


def parse_flat35(html):
    """Midpoint of the published range, excluding modal/Flat20/Flat50 rates."""
    text = unicodedata.normalize("NFKC", "".join(Html(html).text))
    text = re.sub(r"\s+", "", text)
    dated = re.search(r"金利水準[（(](\d{4})年(\d{1,2})月[)）]", text)
    if not dated or "新機構団信付き" not in text:
        raise ValueError("Flat35 publication date or insurance definition not found")
    block = re.search(r"フラット35.*?借入期間[:：]21年以上35年以下(.*?)(?:フラット20|フラット50)", text)
    if not block:
        raise ValueError("Flat35 21-35 year rate table not found")
    rates = re.search(r"9割以下年([0-9]+\.[0-9]+)%[～~〜]年([0-9]+\.[0-9]+)%", block[1])
    if not rates:
        raise ValueError("Flat35 <=90% LTV minimum/maximum not found")
    low, high = map(float, rates.groups())
    if not 0 < low <= high < 30:
        raise ValueError("Flat35 rate range is invalid")
    stamp = date(int(dated[1]), int(dated[2]), 1).isoformat()
    return [{"date": stamp, "value": float((Decimal(rates[1]) + Decimal(rates[2])) / 2),
             "minimum": low, "maximum": high}]


def collect_flat35_current_jhf(fetcher, as_of):
    url = "https://www.simulation.jhf.go.jp/flat35/kinri/index.php/rates/top"
    raw, source_id = fetcher.get(url, "住宅金融支援機構・新機構団信付きフラット35の借入金利水準")
    # This official endpoint declares EUC-JP in its HTTP Content-Type.
    rows = [row for row in parse_flat35(raw.decode("euc_jp")) if row["date"] <= as_of]
    if not rows:
        raise ValueError("Flat35 rate applies to a future month")
    return with_provenance({"flat35": rows}, [source_id])


def collect_flat35(fetcher, as_of):
    raw = (Path(__file__).parent / "data" / "flat35-range.csv").read_bytes()
    rows, sources = parse_flat35_history(raw.decode("utf-8-sig"))
    fetcher.sources.extend(sources)
    if fetcher.archive:
        fetcher.archive("flat35-range-seed", raw, {"sources": sources})
    current = collect_flat35_current_jhf(fetcher, as_of)["flat35"]
    months = {row["date"][:7] for row in current["observations"]}
    rows = [row for row in rows if row["date"] <= as_of and row["date"][:7] not in months]
    return {"flat35": {"observations": rows + current["observations"],
                       "sourceIds": [s["id"] for s in sources] + current["sourceIds"],
                       "method": "range-midpoint-v1"}}


def parse_flat35_history(content):
    """Verified printed PDF labels, not estimates from chart coordinates."""
    rows, sources, dates = [], {}, set()
    for row in csv.DictReader(io.StringIO(content)):
        stamp = date.fromisoformat(row["date"]).isoformat()
        low, high = Decimal(row["minimum"]), Decimal(row["maximum"])
        if (stamp in dates or not stamp.endswith(("06-30", "12-31")) or
                not low.is_finite() or not high.is_finite() or not 0 < low <= high < 30):
            raise ValueError("Invalid Flat35 historical range")
        url = safe_url(row["source_url"])
        if urlparse(url).hostname != "www.flat35.com":
            raise ValueError("Flat35 history must reference JHF")
        source_id = hashlib.sha256(url.encode()).hexdigest()[:16]
        sources[source_id] = {"id": source_id, "url": url,
                              "name": "住宅金融支援機構・フラット35借入金利の推移（最高・最低）",
                              "retrievedAt": row["retrieved_at"]}
        dates.add(stamp)
        rows.append({"date": stamp, "value": float((low + high) / 2),
                     "minimum": float(low), "maximum": float(high)})
    if not rows:
        raise ValueError("Empty Flat35 history")
    return sorted(rows, key=lambda row: row["date"]), list(sources.values())


def parse_mlit(raw):
    import xlrd
    sheet = xlrd.open_workbook(file_contents=raw).sheet_by_index(0)
    if "受注高合計" not in "".join(str(sheet.cell_value(r, c)).replace(" ", "") for r in range(10) for c in range(sheet.ncols)):
        raise ValueError("MLIT total orders header not found")
    header_text = "".join(str(sheet.cell_value(r, c)) for r in range(10) for c in range(sheet.ncols))
    if "百万円" not in header_text:
        raise ValueError("Unknown MLIT unit")
    year = None
    result = []
    for r in range(sheet.nrows):
        if any("前年" in str(sheet.cell_value(r, c)) for c in range(min(3, sheet.ncols))):
            break  # The second table on the same sheet contains growth rates, not yen.
        label = re.sub(r"\s+", "", str(sheet.cell_value(r, 0)))
        full = re.fullmatch(r"(平成|令和)(元|\d+)年(\d+)月", label)
        short = re.fullmatch(r"(\d+)月", label)
        if full:
            era, y, month = full.groups()
            year = (1988 if era == "平成" else 2018) + (1 if y == "元" else int(y))
        elif short and year:
            month = short[1]
        else:
            continue  # Exclude fiscal-year, calendar-year and quarterly subtotal rows.
        value = number(sheet.cell_value(r, 1))
        if value is not None:
            result.append({"date": month_end(year, int(month)), "value": value / 1000000})
    if not result:
        raise ValueError("No MLIT monthly observations")
    return result


def collect_mlit(fetcher, as_of):
    # e-Stat's all-contractors / orders category. The ministry's older index can link
    # to stale releases, so discover the latest numeric table on the statistics portal.
    index_url = "https://www.e-stat.go.jp/stat-search/files?cycle=1&layout=dataset&page=1&tclass1=000001168706&tclass2=000001168707&tclass3val=0&toukei=00600130&tstat=000001015811"
    html, index_id = fetcher.html(index_url, "e-Stat・建設工事受注動態統計調査／受注高")
    link = mlit_download_link(html, index_url)
    raw, source_id = fetcher.get(link, "国土交通省・建設工事受注高時系列（全国）")
    return with_provenance({"construction": [row for row in parse_mlit(raw) if row["date"] <= as_of]}, [index_id, source_id])


def mlit_download_link(html, index_url):
    ids = []
    for href, title in html.links:
        if "受注高時系列" in unicodedata.normalize("NFKC", title):
            ids.extend(parse_qs(urlparse(href).query).get("stat_infid", []))
    for stat_id in ids:
        for href, _ in html.links:
            query = parse_qs(urlparse(href).query)
            if "file-download" in href and query.get("statInfId") == [stat_id] and query.get("fileKind") == ["0"]:
                return urljoin(index_url, href)
    raise ValueError("MLIT time series workbook not found on e-Stat")


def parse_import(raw, series_id):
    """CSV in display units. No examples with fabricated observations are shipped."""
    observations, sources = [], {}
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    if not {"date", "value", "unit", "source_name", "source_url"}.issubset(reader.fieldnames or []):
        raise ValueError("Import columns: date,value,unit,source_name,source_url")
    for row in reader:
        date.fromisoformat(row["date"])
        if row["unit"] != SERIES[series_id][0] or not row["source_name"].strip():
            raise ValueError("Import unit or source name is invalid")
        url = safe_url(row["source_url"])
        value = number(row["value"])
        if value is None:
            continue
        observations.append({"date": row["date"], "value": value})
        source_id = hashlib.sha256(url.encode()).hexdigest()[:16]
        sources[source_id] = {"id": source_id, "name": row["source_name"], "url": url,
                              "retrievedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    if len({row["date"] for row in observations}) != len(observations):
        raise ValueError("Duplicate import dates")
    return observations, list(sources.values())


def collect_context(fetcher):
    documents, failures = [], []
    for key, name, url in CONTEXT_SOURCES:
        try:
            html, source_id = fetcher.html(url, name)
            # Source content is evidence only, never instructions. Limit size and favour
            # statistics / analysis text over menus when the publishing site exposes it.
            text = "\n".join(html.text)
            documents.append({"sourceId": source_id, "text": text[:16000]})
            candidates = [(href, title) for href, title in html.links
                          if re.search(r"調査|レポート|経済|統計|投資|景気", title)
                          and href and not href.startswith("#") and len(title.strip()) >= 10]
            for href, title in candidates[:1]:
                target = urljoin(url, href)
                if target == url:
                    continue
                safe_url(target)
                raw, detail_id = fetcher.get(target, name + "：" + title.strip()[:120])
                if raw.startswith(b"%PDF"):
                    from pypdf import PdfReader
                    pages = PdfReader(io.BytesIO(raw)).pages
                    excerpt = "\n".join(page.extract_text() or "" for page in pages[:8])
                else:
                    excerpt = "\n".join(Html(raw.decode("utf-8-sig")).text)
                documents.append({"sourceId": detail_id, "text": excerpt[:16000]})
        except Exception as error:
            failures.append(f"{name}：参考資料を取得できませんでした（{type(error).__name__}）。")
    return documents, failures
