"""Versioned instructions and semantic change detection for weekly insights."""
import hashlib
import json
from decimal import Decimal
from pathlib import Path

from domain import MODEL, validate_summary

PROMPT = Path(__file__).with_name("weekly-insight-prompt.txt").read_text(encoding="utf-8")
VOLATILE = {"asOf", "retrievedAt", "generatedAt", "latestDate", "sha256"}


def semantic(value):
    """Ignore collection metadata, but preserve observations, units and notes."""
    if isinstance(value, dict):
        return {key: semantic(item) for key, item in sorted(value.items()) if key not in VOLATILE}
    if isinstance(value, list):
        items = [semantic(item) for item in value]
        if items and all(isinstance(item, dict) and "id" in item for item in items):
            items.sort(key=lambda item: item["id"])
        elif items and all(isinstance(item, str) for item in items):
            items.sort()
        return items
    if isinstance(value, (float, Decimal)):
        return int(value) if value == int(value) else float(value)
    return value


def chart_evidence(chart):
    return semantic({
        "periods": chart["periods"], "series": chart["series"],
        "sources": chart["sources"], "warnings": chart["warnings"],
        "figure02": chart["lending"], "figure03": chart["bojFinancials"],
        "figure04": chart["fiscal"], "figure05": chart["household"],
        "flat35Method": chart["flat35Method"], "topixMethod": chart["topixMethod"],
    })


def fingerprint(chart):
    content = {"model": MODEL, "prompt": PROMPT, "evidence": chart_evidence(chart)}
    return hashlib.sha256(json.dumps(content, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def reuse_insight(chart, previous):
    insight = previous.get("insight") or {}
    if (insight.get("model") != MODEL or not insight.get("generatedAt")
            or insight.get("evidenceHash") != fingerprint(chart)):
        return None
    try:
        validate_summary(insight.get("summary"), insight.get("sourceIds", []),
                         {source["id"] for source in chart["sources"]})
    except (ValueError, TypeError):
        return None
    return dict(insight)
