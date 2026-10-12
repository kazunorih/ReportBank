"""Independent first chart, with only its displayed series as summary evidence."""
from domain import SERIES, LABELS, aggregate, half_years, validate_observations

MARKET_IDS = ("jgb10", "jgb30", "flat35", "topix")


def build_markets(payload):
    if payload["datasets"].get("flat35", {}).get("method") != "range-midpoint-v1":
        raise ValueError("flat35: verified range midpoint data required")
    periods = half_years(payload["asOf"])
    series, warnings = [], []
    for key in MARKET_IDS:
        data = payload["datasets"][key]
        latest = validate_observations(key, data["observations"], payload["asOf"])
        values = aggregate(data["observations"], periods, SERIES[key][1])
        if key != "flat35" and all(value is None for value in values):
            raise ValueError(f"{key}: no half-year observations")
        count = sum(value is not None for value in values)
        if key == "topix":
            warnings.append(f"TOPIX：年間四本値の年末終値を{count}年分収録。6月および未収録年の値は表示していません。")
        elif count < 60:
            warnings.append(f"{LABELS[key]}：60半期中{count}半期を収録。未取得の期間は欠測です。")
        if key == "flat35" and count == 0:
            warnings.append("フラット35は当月金利のみ取得済みです。過去の半期末金利は未収録のため、線は表示していません。")
        series.append({"id": key, "values": values, "sourceIds": data["sourceIds"],
                       "latestDate": latest, "note": SERIES[key][2]})
    used = {sid for item in series for sid in item["sourceIds"]}
    return {"asOf": payload["asOf"], "flat35Method": "range-midpoint-v1", "topixMethod": "annual-close-v1", "periods": periods, "series": series,
            "sources": [source for source in payload["sources"] if source["id"] in used], "warnings": warnings}
