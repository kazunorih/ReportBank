"""Read the supplied BOJ LA01 quarterly CSV; amounts are published in 100m yen."""
import csv
import io
import re
from decimal import Decimal
from domain import month_end
from pathlib import Path
import json
import hashlib

CORPORATE_CODE = "DLLILKG84_DLLI5DS2THKL"

def with_corporate(data):
    from domain import parse_boj
    raw = (Path(__file__).parent / "data/corporate-la01.json").read_bytes()
    payload = json.loads(raw)
    series = payload["RESULTSET"]
    if len(series) != 1 or series[0]["SERIES_CODE"] != CORPORATE_CODE or series[0]["NAME_OF_TIME_SERIES_J"] != "法人計＜含金融＞／残高／銀行勘定、信託勘定、海外店勘定の合計／国内銀行":
        raise ValueError("Unexpected corporate lending definition")
    rows = parse_boj(payload, {CORPORATE_CODE: "domesticCorporateLoans"})["domesticCorporateLoans"]
    values = {row["date"]: row["value"] for row in rows}
    for row in data["observations"]:
        row["domesticCorporateLoans"] = values.get(row["date"])
        amounts = [row[key] for key in ("domesticBankLoans", "housingLoans", "domesticCorporateLoans")]
        if all(value is not None for value in amounts) and round(amounts[0] * 10000) < round(amounts[1] * 10000) + round(amounts[2] * 10000):
            raise ValueError("Lending components exceed total")
    data["corporateSource"] = {"id": "boj-la01-corporate", "name": "日本銀行・貸出先別貸出金（LA01）法人計〈含金融〉・国内銀行3勘定合算",
        "url": "https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&db=LA01&code=" + CORPORATE_CODE + "&startDate=199501&endDate=202602",
        "retrievedAt": payload["DATE"]}
    from datetime import datetime, timezone
    data["corporateSource"]["retrievedAt"] = datetime.fromisoformat(payload["DATE"]).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    data["corporateSha256"] = hashlib.sha256(raw).hexdigest()
    return data

CODES = ["LA01'DLLILKG90_DLLI5DS2T", "LA01'DLHLLKG71_DLHL2DSSL"]
NAMES = ["総貸出／残高／銀行勘定、信託勘定、海外店勘定の合計／国内銀行",
         "住宅資金／残高／個人向け貸出金／銀行勘定、信託勘定、海外店勘定の合計／国内銀行"]


def parse_lending_csv(raw):
    rows = list(csv.reader(io.StringIO(raw.decode("cp932"))))
    if len(rows) < 3 or rows[0] != ["データコード"] + CODES or rows[1] != ["系列名称"] + NAMES:
        raise ValueError("Unexpected BOJ LA01 series or column order")
    observations, previous = [], ""
    for row in rows[2:]:
        if not row:
            continue
        if len(row) != 3 or not re.fullmatch(r"\d{4}/(?:03|06|09|12)", row[0]):
            raise ValueError("Invalid quarterly lending row")
        stamp = month_end(int(row[0][:4]), int(row[0][5:]))
        if stamp <= previous:
            raise ValueError("Duplicate or unordered lending quarter")
        previous = stamp
        values = []
        for text in row[1:]:
            if not text.strip():
                values.append(None)
                continue
            value = Decimal(text)
            if not value.is_finite() or value < 0:
                raise ValueError("Invalid lending balance")
            values.append(float(value / 10000))
        if all(value is None for value in values):
            continue
        if all(value is not None for value in values) and values[1] > values[0]:
            raise ValueError("Housing loans exceed total loans")
        observations.append({"date": stamp, "domesticBankLoans": values[0], "housingLoans": values[1]})
    if not observations:
        raise ValueError("No lending observations")
    return observations
