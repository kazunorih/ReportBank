"""Validate a report CSV locally, without network access or AWS writes."""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "workers" / "weekly-report"))
from domain import JST, SERIES, aggregate, half_years, validate_observations
from sources import parse_import


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("series", choices=SERIES)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--as-of", default=datetime.now(JST).date().isoformat())
    args = parser.parse_args()
    try:
        rows, sources = parse_import(args.csv.read_bytes(), args.series)
        latest = validate_observations(args.series, rows, args.as_of)
        periods = half_years(args.as_of)
        values = aggregate(rows, periods, SERIES[args.series][1])
        if all(value is None for value in values):
            raise ValueError("No completed half-year observations")
        print(json.dumps({
            "series": args.series, "observations": len(rows), "latest": latest,
            "unit": SERIES[args.series][0], "sources": len(sources),
            "availableHalfYears": sum(value is not None for value in values),
            "missingHalfYears": [period for period, value in zip(periods, values) if value is None],
        }, ensure_ascii=True, indent=2))
        return 0
    except (ValueError, OSError) as error:
        print(f"Invalid import: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
