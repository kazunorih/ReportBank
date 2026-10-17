"""Keep the four displayed figures and summary evidence in one snapshot."""
import json
from pathlib import Path
from boj_financials import collect_statements
from fiscal import collect_fiscal
from lending import with_corporate

DATA = Path(__file__).parent / "data"

def integrate(chart, fetcher=None, previous=None, previous_fiscal=None):
    financials = json.loads((DATA / "boj-financials.json").read_text(encoding="utf-8"))
    rows = {row["date"]: row for row in financials["observations"]}
    sources = {s["id"]: s for s in financials["sources"]}
    if previous:
        rows.update({row["date"]: row for row in previous["observations"]})
        sources.update({s["id"]: s for s in previous["sources"]})
    if fetcher:
        rows.update({row["date"]: row for row in collect_statements(fetcher, chart["asOf"])})
        sources.update({s["id"]: s for s in fetcher.sources})
    # Same completed half-year window as the chart; preserve actual fiscal dates.
    start = chart["periods"][-60][:4] + ("-01-01" if chart["periods"][-60].endswith("06-30") else "-07-01")
    rows = [row for date, row in sorted(rows.items()) if start <= date <= chart["periods"][-1]]
    rows = [{**row, **{key: float(row[key]) for key in ("assets", "jgb", "other")}} for row in rows]
    used = {sid for row in rows for sid in row["sourceIds"]}
    financials = {"observations": rows, "sources": [s for sid, s in sources.items() if sid in used]}
    lending = with_corporate(json.loads((DATA / "lending.json").read_text(encoding="utf-8")))
    lending["observations"] = [row for row in lending["observations"] if row["date"] in chart["periods"]]
    fiscal = collect_fiscal(fetcher, chart["asOf"], previous_fiscal)
    chart.update(summaryScope="four-figures-v6", bojFinancials=financials, lending=lending, fiscal=fiscal)
    chart["sources"] = list({s["id"]: s for s in chart["sources"] + financials["sources"] + fiscal["sources"] + [lending["source"], lending["corporateSource"]]}.values())
    return chart
