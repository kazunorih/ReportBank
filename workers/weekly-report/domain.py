"""Pure transformations. No cloud access and no AI-generated statistical values."""
import calendar
import csv
import io
import math
import re
from datetime import date, datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))
MODEL = "gpt-5.6-luna"
LABELS = dict(zip(
    ("jgb3", "jgb10", "jgb30", "flat35", "topix", "marketCap", "construction", "corporateLoans", "householdLoans", "bankJgb", "publicLoans", "bojAssets", "bojJgb"),
    ("国債3年", "国債10年", "国債30年", "フラット35", "TOPIX", "東証時価総額", "建設工事受注高", "企業向け貸出", "家計向け貸出", "国債・財投債保有", "地方公共団体向け貸出", "日本銀行総資産", "日本銀行国債保有"),
))
SERIES = {
    "jgb3": ("%", "last", "財務省のコンスタント・マチュリティー金利、3年。"),
    "jgb10": ("%", "last", "財務省のコンスタント・マチュリティー金利、10年。"),
    "jgb30": ("%", "last", "財務省のコンスタント・マチュリティー金利、30年。公表開始前は欠測。"),
    "flat35": ("%", "last", "返済期間21～35年、融資率9割以下の最低金利。2017年10月以降は新機構団信付き。制度開始（2003年10月）前は欠測。"),
    "topix": ("ポイント", "last", "TOPIX（東証株価指数・配当なし）の月末終値。各半期末の値を採用。"),
    "marketCap": ("兆円", "last", "東証・内国株式の月末時価総額。市場再編による対象変更を含む。"),
    "construction": ("兆円", "sum", "建設工事受注動態統計・受注高合計。6か月すべて揃った半期のみ集計。改定値を優先。"),
    "corporateLoans": ("兆円", "last", "預金取扱機関の民間非金融法人向け貸出。金融法人は含まない。1997年末から。"),
    "householdLoans": ("兆円", "last", "預金取扱機関の家計向け貸出。個人事業主を含む。1997年末から。"),
    "bankJgb": ("兆円", "last", "預金取扱機関の国債・財投債保有残高。貸出ではない。1997年末から。"),
    "publicLoans": ("兆円", "last", "預金取扱機関の地方公共団体向け貸出。中央政府・公的企業は含まない。1997年末から。"),
    "bojAssets": ("兆円", "last", "日本銀行勘定・資産合計。現行公表系列は1998年4月から。"),
    "bojJgb": ("兆円", "last", "日本銀行勘定・国債（短期国債を含む）。現行公表系列は1998年4月から。"),
}


def month_end(year, month):
    return date(year, month, calendar.monthrange(year, month)[1]).isoformat()


def half_years(as_of):
    """Last 60 completed calendar half years, including a half closing today."""
    cutoff = date.fromisoformat(as_of)
    candidates = [date(y, m, 30 if m == 6 else 31)
                  for y in range(cutoff.year - 31, cutoff.year + 1) for m in (6, 12)]
    return [value.isoformat() for value in candidates if value <= cutoff][-60:]


def number(value):
    if value is None or str(value).strip() in ("", "-", "--", "…", "***", "NA", "N/A", "nan"):
        return None
    parsed = float(str(value).replace(",", "").strip())
    if not math.isfinite(parsed):
        raise ValueError("Non-finite observation")
    return parsed


def aggregate(observations, periods, kind):
    # A missing June/December observation must never become a stale March value.
    monthly = {}
    seen = set()
    for observation in sorted(observations, key=lambda x: x["date"]):
        day = date.fromisoformat(observation["date"])
        if day in seen:
            raise ValueError("Duplicate observation date")
        seen.add(day)
        value = number(observation["value"])
        if value is not None:
            monthly[day.isoformat()[:7]] = value
    result = []
    for period in periods:
        end = date.fromisoformat(period)
        if kind == "sum":
            keys = [f"{end.year}-{month:02}" for month in range(end.month - 5, end.month + 1)]
            result.append(round(sum(monthly[key] for key in keys), 6) if all(key in monthly for key in keys) else None)
        else:
            result.append(monthly.get(period[:7]))
    return result


def parse_mof(raw):
    rows = list(csv.reader(io.StringIO(raw.decode("cp932"))))
    header = next(i for i, row in enumerate(rows) if row and row[0] == "基準日")
    columns = {key: rows[header].index(f"{years}年") for key, years in (("jgb3", 3), ("jgb10", 10), ("jgb30", 30))}
    result = {key: [] for key in columns}
    for row in rows[header + 1:]:
        if not row or not row[0].strip():
            continue
        match = re.fullmatch(r"([SHR])(\d+)\.(\d+)\.(\d+)", row[0].strip())
        if not match:
            if row[0].startswith("※") and all(not cell.strip() for cell in row[1:]):
                continue
            raise ValueError("Unrecognized MOF date")
        era, year, month, day = match.groups()
        stamp = date({"S": 1925, "H": 1988, "R": 2018}[era] + int(year), int(month), int(day)).isoformat()
        for key, index in columns.items():
            value = number(row[index])
            if value is not None:
                result[key].append({"date": stamp, "value": value})
    if not all(result.values()):
        raise ValueError("MOF returned no observations")
    return result


def parse_boj(payload, codes):
    if payload.get("STATUS") != 200 or payload.get("NEXTPOSITION"):
        raise ValueError("BOJ error or truncated response")
    result = {}
    for row in payload["RESULTSET"]:
        code = row["SERIES_CODE"]
        if code not in codes:
            continue
        if row["UNIT_J"] != "億円" or row["FREQUENCY"] not in ("MONTHLY", "QUARTERLY"):
            raise ValueError("Unexpected BOJ unit or frequency")
        values = row["VALUES"]
        if len(values["SURVEY_DATES"]) != len(values["VALUES"]):
            raise ValueError("BOJ dates/values mismatch")
        observations = []
        for stamp, value in zip(values["SURVEY_DATES"], values["VALUES"]):
            stamp, value = str(stamp), number(value)
            if value is None:
                continue
            year, period = int(stamp[:4]), int(stamp[4:])
            month = period * 3 if row["FREQUENCY"] == "QUARTERLY" else period
            observations.append({"date": month_end(year, month), "value": value / 10000})
        result[codes[code]] = observations
    if set(result) != set(codes.values()) or not all(result.values()):
        raise ValueError("Missing BOJ series")
    return result


def validate_summary(text, source_ids, known_sources):
    if not isinstance(text, str) or not text.strip() or len(text) > 400:
        raise ValueError("Summary must contain 1–400 Unicode characters")
    if not source_ids or not set(source_ids).issubset(known_sources):
        raise ValueError("Unknown or missing summary citations")
    return text.strip()


def validate_observations(series_id, observations, as_of):
    if not observations:
        raise ValueError(f"{series_id}: no observations")
    latest = max(row["date"] for row in observations)
    cutoff = date.fromisoformat(as_of)
    for row in observations:
        day, value = date.fromisoformat(row["date"]), number(row["value"])
        if day > cutoff or value is None or (series_id not in ("jgb3", "jgb10", "jgb30") and value < 0):
            raise ValueError(f"{series_id}: invalid observation")
        if SERIES[series_id][0] == "%" and not -5 <= value <= 30:
            raise ValueError(f"{series_id}: invalid percentage unit")
        if series_id == "flat35" and day < date(2003, 10, 1):
            raise ValueError("Flat35 did not exist before October 2003")
    max_age = 220 if series_id in ("corporateLoans", "householdLoans", "bankJgb", "publicLoans") else 120
    if (cutoff - date.fromisoformat(latest)).days > max_age:
        raise ValueError(f"{series_id}: stale data (latest {latest})")
    return latest


def report_date(scheduled_time):
    stamp = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
    if stamp.tzinfo is None:
        raise ValueError("Scheduled time must include timezone")
    return stamp.astimezone(JST).date().isoformat()
