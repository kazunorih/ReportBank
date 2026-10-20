"""Import monthly Customs releases from January 2000. PDF years require pdfplumber.

Run: py -3.13 scripts/import-trade-history.py
The snapshot is replaced only after all months and rankings pass validation.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urljoin
import json
import re
import unicodedata
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FIRST_MONTH = "2000-01"
ARCHIVE = "https://www.customs.go.jp/toukei/shinbun/happyou.htm"


class Releases(HTMLParser):
    def __init__(self, base_url=ARCHIVE):
        super().__init__()
        self.links = {}
        self.base_url = base_url

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        title = attrs.get("title", "")
        href = attrs.get("href", "")
        # The official archive has a typo in this XML link's title.
        if title == "206.08" and href.endswith("/201608f.xml"):
            title = "2016.08"
        if title == "a title=" and href.endswith("/200404f.pdf"):
            title = "2004.04"
        # Suffix 1/2 denotes first-ten/first-twenty-day releases, not months.
        if tag == "a" and re.fullmatch(r"20\d{2}\.\d{1,2}", title) and re.search(r"/20\d{4}[3-9f]\.(?:xml|pdf)$", href):
            year, number = title.split(".")
            month = f"{year}-{int(number):02d}"
            if month in self.links:
                if self.links[month].endswith(".xml") and href.endswith(".pdf"):
                    return
                if not (self.links[month].endswith(".pdf") and href.endswith(".xml")):
                    raise ValueError(f"Ambiguous release: {month}")
            self.links[month] = urljoin(self.base_url, href)


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "ReportBank monthly statistics importer"}), timeout=60) as response:
        return response.read()


def amount(text):
    value = (text or "").replace(",", "").strip()
    if not re.fullmatch(r"\d+", value):
        raise ValueError(f"Missing or invalid monetary value: {text!r}")
    return int(value)


def parse_release(month, url, content):
    root = ET.fromstring(content)
    title = root.findtext("sogakutsuki/title") or ""
    period = root.findtext("sogakutsuki/taishoymtonen") or ""
    match = re.fullmatch(r"(令和|平成)\s*(\d+)年\s*(\d+)月", period.strip().replace("元年", "1年"))
    if not match or f"{(2018 if match[1] == '令和' else 1988) + int(match[2]):04d}-{int(match[3]):02d}" != month:
        raise ValueError(f"Not the requested monthly release: {month}, {period}")
    result = {"month": month, "sourceUrl": url, "sourceTitle": title,
              "published": root.findtext("sogakutsuki/kohyoymd"), "series": {}}
    country_rows = root.findall("chiikikunisogaku/chiikikunisogakuinfo")
    for direction, page in (("export", "pg3"), ("import", "pg4")):
        total = amount(root.findtext(f"sogakutsuki/{direction}/sogakutonen"))
        countries = {}
        regions = []
        for row in country_rows:
            name = unicodedata.normalize("NFKC", row.findtext("chiikikuni", "")).strip()
            level = row.findtext("chiikikunikbn")
            value = amount(row.findtext(f"{direction}kagakue"))
            if level == "0" and value != total:
                raise ValueError("Country total disagrees with release total")
            if level == "1" and not name.startswith(("(", "[")):
                regions.append({"total": value, "listed": 0})
            if level == "2":
                if name in countries or not regions:
                    raise ValueError("Unexpected country hierarchy")
                countries[name] = value
                regions[-1]["listed"] += value
        # Bounds on unlisted countries prove that no omitted country can enter
        # the top five (the release lists major countries, not all countries).
        uncovered = total - sum(r["total"] for r in regions)
        if uncovered < -len(regions) or any(r["listed"] > r["total"] + len(countries) for r in regions):
            raise ValueError(f"Overlapping geographic regions: {month}, {direction}")
        bounds = [max(0, r["total"] - r["listed"]) + len(countries) for r in regions]
        result["series"][f"country-{direction}"] = {"total": total, "values": countries, "unlistedUpperBound": max(bounds) + max(0, uncovered)}
        items = {}
        section = root.find(f"shuyochiikikunihin[@name='{page}']")
        if section is None:
            raise ValueError("Missing worldwide commodity table")
        for row in section.findall("shuyochiikikunihininfo"):
            if row.findtext("shuyoshohinbunrui") == "1":
                name = re.sub(r"^\d+\s*", "", unicodedata.normalize("NFKC", row.findtext("shuyoshohin", ""))).strip()
                items[name] = amount(row.findtext("kagaku"))
        if len(items) != 9 or abs(sum(items.values()) - total) > 9:
            raise ValueError("Commodity classification or total changed")
        # The published residual is not a named commodity; combine it with
        # other unselected categories in our single residual segment.
        items.pop("その他")
        result["series"][f"commodity-{direction}"] = {"total": total, "values": items}
    return result


def parse_pdf_release(month, url, content):
    import io
    import pdfplumber
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = [unicodedata.normalize("NFKC", page.extract_text() or "") for page in pdf.pages[:4]]
    compact = lambda text: re.sub(r"\s+", "", text)
    year, number = map(int, month.split("-"))
    if f"平成{year - 1988}年{number}月分" not in compact(pages[0]):
        raise ValueError(f"Wrong PDF period: {month}")
    published = re.search(r"平成\s*\d+年\s*\d+月\s*\d+日", pages[0])
    result = {"month": month, "sourceUrl": url, "sourceTitle": f"{year}年{number}月分貿易統計（確定）", "published": published[0] if published else None, "series": {}}
    rows = {}
    for line in pages[1].splitlines():
        match = re.match(r"^(.+?)\s+([\d,]+)\s+\S+\s+([\d,]+)\s+", line)
        if match:
            name = compact(match[1])
            name = {"アメリカ": "アメリカ合衆国", "ヴィエトナム": "ベトナム"}.get(name, name)
            rows[name] = (amount(match[2]), amount(match[3]))
    if "総額" not in rows:
        raise ValueError(f"Missing PDF totals: {month}")
    # Only actual countries used by the latest ranking are needed in old PDFs.
    countries = ("中華人民共和国", "アメリカ合衆国", "台湾", "大韓民国", "香港", "オーストラリア", "ベトナム", "アラブ首長国連邦", "サウジアラビア")
    for i, direction in enumerate(("export", "import")):
        total = rows["総額"][i]
        result["series"][f"country-{direction}"] = {"total": total, "values": {name: rows[name][i] for name in countries if name in rows}, "unlistedUpperBound": 0}
        items = {}
        for line in pages[i + 2].splitlines():
            match = re.match(r"^(?:[1-9]\s+)?([^\d]+?)\s+([\d,]+)\s+", line)
            if match:
                items[compact(match[1])] = amount(match[2])
        result["series"][f"commodity-{direction}"] = {"total": total, "values": items}
    return result


def build_snapshot(releases):
    releases = sorted(releases, key=lambda row: row["month"])
    indices = [int(row["month"][:4]) * 12 + int(row["month"][5:]) - 1 for row in releases]
    first = 2000 * 12
    if not indices or indices != list(range(first, indices[-1] + 1)):
        raise ValueError("Consecutive monthly releases starting at 2000-01 are required")
    charts = []
    for key, title in (("country-export", "月次国別輸出統計"), ("country-import", "月次国別輸入統計"),
                       ("commodity-export", "月次品別輸出統計"), ("commodity-import", "月次品別輸入統計")):
        latest = releases[-1]["series"][key]
        names = sorted(latest["values"], key=lambda name: (-latest["values"][name], name))[:5]
        if key.startswith("country") and latest["unlistedUpperBound"] >= latest["values"][names[-1]]:
            raise ValueError("Cannot prove top five from listed countries; obtain all-country data")
        points = []
        for release in releases:
            series = release["series"][key]
            values = [series["values"].get(name) for name in names]
            if any(value is None for value in values):
                if not key.startswith("commodity") or release["month"] >= "2004-01":
                    raise ValueError(f"Missing category in {release['month']}: {key}")
                points.append({"month": release["month"], "values": [None] * 6, "total": series["total"]})
                continue
            other = series["total"] - sum(values)
            if other < 0:
                raise ValueError("Negative residual")
            points.append({"month": release["month"], "values": values + [other], "total": series["total"]})
        charts.append({"id": key, "title": title, "categories": names + ["その他"], "points": points})
    return {"latestMonth": releases[-1]["month"], "firstMonth": releases[0]["month"], "unit": "百万円",
            "retrievedAt": datetime.now(timezone.utc).isoformat(), "charts": charts,
            "sources": [{key: row[key] for key in ("month", "sourceUrl", "sourceTitle", "published")} for row in releases]}


def main():
    parser = Releases()
    for archive in (ARCHIVE, urljoin(ARCHIVE, "kako/happyou2.htm")):
        page = Releases(archive)
        page.feed(fetch(archive).decode("cp932"))
        parser.links.update(page.links)
    months = [month for month in sorted(parser.links) if month >= FIRST_MONTH]
    def load(month):
        url = parser.links[month]
        return (parse_pdf_release if url.endswith(".pdf") else parse_release)(month, url, fetch(url))
    with ThreadPoolExecutor(max_workers=4) as pool:
        snapshot = build_snapshot(list(pool.map(load, months)))
    target = ROOT / "lib/reports/data/trade.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)
    print(f"Imported {snapshot['firstMonth']} through {snapshot['latestMonth']}: four charts, {len(months)} months each")


if __name__ == "__main__":
    main()
