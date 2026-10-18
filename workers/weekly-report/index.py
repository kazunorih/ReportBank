"""Step Functions tasks: collect -> validate/generate -> atomic publication."""
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.types import TypeSerializer

from domain import LABELS, MODEL, SERIES, aggregate, half_years, report_date, validate_observations, validate_summary
from sources import (Fetcher, collect_boj, collect_context, collect_flat35, collect_jpx, collect_mlit,
                     collect_mof, parse_import)
from topix import collect_topix
from markets import build_markets
from integrated import integrate
from insight_config import PROMPT, chart_evidence, fingerprint, reuse_insight


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def s3():
    return boto3.client("s3")


def write_json(key, value):
    s3().put_object(Bucket=os.environ["REPORT_BUCKET"], Key=key,
                    Body=json.dumps(value, ensure_ascii=False, allow_nan=False).encode(),
                    ContentType="application/json", ServerSideEncryption="AES256")


def read_json(key):
    return json.loads(s3().get_object(Bucket=os.environ["REPORT_BUCKET"], Key=key)["Body"].read())


def table():
    return boto3.resource("dynamodb").Table(os.environ["REPORT_TABLE"])


def collect(event):
    scheduled = datetime.fromisoformat(event["scheduledTime"].replace("Z", "+00:00"))
    if scheduled.tzinfo is None or not datetime.now(timezone.utc) - timedelta(days=2) <= scheduled <= datetime.now(timezone.utc) + timedelta(minutes=5):
        raise ValueError("Use the current scheduled time; historical/future report creation is not supported")
    as_of = report_date(event["scheduledTime"])
    execution_id = hashlib.sha256(event["executionId"].encode()).hexdigest()[:24]
    prefix = f"runs/{as_of}/{execution_id}"
    if os.environ.get("REPORT_SCOPE") == "markets":
        return collect_markets(as_of, prefix)
    if table().get_item(Key={"pk": "HISTORY", "sk": as_of}, ConsistentRead=True).get("Item"):
        return {"skipped": True, "asOf": as_of, "prefix": prefix}

    def archive(source_id, raw, metadata):
        s3().put_object(Bucket=os.environ["REPORT_BUCKET"], Key=f"{prefix}/raw/{source_id}",
                       Body=raw, ServerSideEncryption="AES256")
        write_json(f"{prefix}/raw/{source_id}.json", metadata)

    fetcher = Fetcher(archive)
    datasets, failures = {}, []
    seed_path = Path(__file__).parent / "data" / "construction.csv"
    raw_seed = seed_path.read_bytes()
    seed_rows, seed_sources = parse_import(raw_seed, "construction")
    for source in seed_sources:
        source["retrievedAt"] = "2026-10-11T14:15:31Z"
    datasets["construction"] = {"observations": [row for row in seed_rows if row["date"] <= as_of],
                                 "sourceIds": [source["id"] for source in seed_sources]}
    fetcher.sources.extend(seed_sources)
    archive("seed-construction", raw_seed, {"sources": seed_sources})
    # Preserve the monthly/daily history that rolls off each publisher's download.
    previous = table().get_item(Key={"pk": "REPORT", "sk": "LATEST"}, ConsistentRead=True).get("Item")
    if previous and previous.get("collectionKey"):
        saved = read_json(previous["collectionKey"])
        datasets.update({key: value for key, value in saved["datasets"].items() if key in SERIES})
        retained_ids = {sid for key, data in saved["datasets"].items() if key in SERIES for sid in data["sourceIds"]}
        fetcher.sources.extend(source for source in saved["sources"] if source["id"] in retained_ids)
    fresh = {}
    for collector in (collect_mof, collect_boj, collect_jpx, collect_mlit, collect_flat35, collect_topix):
        try:
            fresh.update(collector(fetcher, as_of))
        except Exception as error:
            # An imported, reviewed series can cover a blocked/changed official endpoint.
            failures.append(f"{collector.__name__}: {type(error).__name__}")
            print(json.dumps({"event": "source_failed", "source": collector.__name__, "errorType": type(error).__name__}))

    # Imports provide TOPIX data, verified Flat35 numeric history, and older
    # MLIT history. Automatic observations win on overlapping dates (revisions).
    for series_id in SERIES:
        try:
            response = s3().get_object(Bucket=os.environ["REPORT_BUCKET"], Key=f"imports/{series_id}.csv")
        except ClientError as error:
            if error.response["Error"]["Code"] in ("NoSuchKey", "404"):
                continue
            raise
        raw = response["Body"].read(15 * 1024 * 1024 + 1)
        if len(raw) > 15 * 1024 * 1024:
            raise ValueError("Imported file exceeds size limit")
        observations, sources = parse_import(raw, series_id)
        # Keep the exact imported CSV and provenance for this run, including S3 version.
        archive("import-" + series_id, raw, {"versionId": response.get("VersionId"), "sources": sources})
        fetcher.sources.extend(sources)
        existing = datasets.get(series_id, {"observations": [], "sourceIds": []})
        merged = {row["date"]: row for row in existing["observations"] if row["date"] <= as_of}
        merged.update({row["date"]: row for row in observations if row["date"] <= as_of})
        datasets[series_id] = {"observations": list(merged.values()),
                               "sourceIds": list(dict.fromkeys(existing["sourceIds"] + [s["id"] for s in sources]))}
    for series_id, dataset in fresh.items():
        existing = datasets.get(series_id, {"observations": [], "sourceIds": []})
        if series_id == "topix" or (series_id == "flat35" and existing.get("method") != "range-midpoint-v1"):
            existing = {"observations": [], "sourceIds": []}  # Exclude bank/minimum-rate history.
        fresh_months = {row["date"][:7] for row in dataset["observations"]}
        merged = {row["date"]: row for row in existing["observations"] if row["date"][:7] not in fresh_months and row["date"] <= as_of}
        merged.update({row["date"]: row for row in dataset["observations"]})
        datasets[series_id] = {"observations": list(merged.values()),
                               "sourceIds": list(dict.fromkeys(dataset["sourceIds"] + existing["sourceIds"])),
                               **({"method": dataset["method"]} if "method" in dataset else {})}
    documents, context_failures = collect_context(fetcher)
    payload = {"asOf": as_of, "datasets": datasets,
               "sources": list({source["id"]: source for source in fetcher.sources}.values()),
               "documents": documents, "contextWarnings": context_failures, "collectionFailures": failures}
    write_json(f"{prefix}/collected.json", payload)
    return {"skipped": False, "asOf": as_of, "prefix": prefix}


def collect_markets(as_of, prefix):
    def archive(source_id, raw, metadata):
        s3().put_object(Bucket=os.environ["REPORT_BUCKET"], Key=f"{prefix}/raw/{source_id}",
                        Body=raw, ServerSideEncryption="AES256")
        write_json(f"{prefix}/raw/{source_id}.json", metadata)

    fetcher = Fetcher(archive)
    seed = json.loads((Path(__file__).parent / "data" / "topix.json").read_text(encoding="utf-8"))
    datasets = seed["datasets"]
    fetcher.sources.extend(seed["sources"])
    previous = table().get_item(Key={"pk": "CHART", "sk": "MARKETS"}, ConsistentRead=True).get("Item")
    if previous and previous.get("collectionKey"):
        saved = read_json(previous["collectionKey"])
        datasets.update(saved["datasets"])
        fetcher.sources.extend(saved["sources"])
    # Preserve reviewed midpoint observations, never mix the old bank/minimum series.
    if datasets.get("flat35", {}).get("method") != "range-midpoint-v1":
        datasets.pop("flat35", None)
    for collector in (collect_mof, collect_flat35, collect_topix):
        for key, fresh in collector(fetcher, as_of).items():
            old = datasets.get(key, {"observations": [], "sourceIds": []})
            if key == "topix":
                old = {"observations": [], "sourceIds": []}  # Workbook replaces all monthly history.
            months = {row["date"][:7] for row in fresh["observations"]}
            merged = {row["date"]: row for row in old["observations"] if row["date"][:7] not in months}
            merged.update({row["date"]: row for row in fresh["observations"]})
            datasets[key] = {"observations": list(merged.values()), "sourceIds": list(dict.fromkeys(old["sourceIds"] + fresh["sourceIds"])),
                             **({"method": fresh["method"]} if "method" in fresh else {})}
    payload = {"asOf": as_of, "datasets": datasets,
               "sources": list({source["id"]: source for source in fetcher.sources}.values())}
    previous_chart = previous.get("chart", {}) if previous else {}
    chart = integrate(build_markets(payload), fetcher, previous_chart.get("bojFinancials"), previous_chart.get("fiscal"), previous_chart.get("household"))
    if os.environ.get("GEMINI_SECRET_ARN", "").strip():
        chart["insight"] = reuse_insight(chart, previous_chart)
        if chart["insight"] is None:
            chart["insight"] = generate({"prefix": prefix}, chart=chart)
        else:
            write_json(f"{prefix}/generation-audit.json", {
                "status": "unchanged", "evidenceHash": fingerprint(chart),
                "generatedAt": chart["insight"]["generatedAt"], "model": MODEL})
    write_json(f"{prefix}/markets-collected.json", payload)
    write_json(f"{prefix}/markets.json", chart)
    table().put_item(Item=json.loads(json.dumps({"pk": "CHART", "sk": "MARKETS", "asOf": as_of,
                                               "chart": chart, "collectionKey": f"{prefix}/markets-collected.json"}), parse_float=Decimal),
                     ConditionExpression="attribute_not_exists(pk) OR asOf <= :asOf",
                     ExpressionAttributeValues={":asOf": as_of})
    # All four figures and their generated summary are published together.
    return {"skipped": True, "asOf": as_of, "prefix": prefix, "status": "markets-published"}


def build_report(payload):
    periods = half_years(payload["asOf"])
    missing = set(SERIES) - set(payload["datasets"])
    if missing:
        raise ValueError("Required statistics unavailable; publication stopped: " + ", ".join(sorted(missing)))
    series, warnings = [], list(payload["contextWarnings"])
    if payload.get("collectionFailures"):
        warnings.append("一部統計の再取得に失敗したため、取得日時を確認した保存済みデータまたは出典付きCSVを使用しています。")
    for key, (_, kind, note) in SERIES.items():
        dataset = payload["datasets"][key]
        latest = validate_observations(key, dataset["observations"], payload["asOf"])
        values = aggregate(dataset["observations"], periods, kind)
        if not any(value is not None for value in values):
            raise ValueError(f"{key}: no completed half-year values")
        count = sum(value is not None for value in values)
        if count < len(periods):
            warnings.append(f"{LABELS[key]}：60半期中{count}半期を収録。制度開始前・未公表・未取得の期間は欠測です。")
        series.append({"id": key, "values": values, "sourceIds": dataset["sourceIds"], "latestDate": latest, "note": note})
    warnings.append("時価総額の対象は東京証券取引所の内国株式です。他の国内取引所を合算した全国計ではありません。")
    return {"schemaVersion": 1, "date": payload["asOf"], "asOf": payload["asOf"], "periods": periods,
            "series": series, "sources": payload["sources"], "warnings": warnings, "model": MODEL}


def generate(event, chart=None):
    payload = None if chart is not None else read_json(f"{event['prefix']}/collected.json")
    report = dict(chart) if chart is not None else build_report(payload)
    configured_model = os.environ.get("GEMINI_MODEL", MODEL)
    if configured_model != MODEL:
        raise ValueError("Only the configured Gemini model is allowed")
    secret = boto3.client("secretsmanager").get_secret_value(SecretId=os.environ["GEMINI_SECRET_ARN"])
    api_key = json.loads(secret["SecretString"])["apiKey"]
    if not isinstance(api_key, str) or not api_key.strip():
        raise ValueError("Gemini API key is not configured")
    evidence = {
        "asOf": report["asOf"], "periods": report["periods"], "series": report["series"],
        "sources": report["sources"], "warnings": report["warnings"],
    }
    if payload is not None:
        evidence["latestObservations"] = {key: sorted(data["observations"], key=lambda x: x["date"])[-6:] for key, data in payload["datasets"].items()}
        evidence["referenceDocuments"] = payload["documents"]
    instructions = PROMPT
    if chart is not None:
        if chart.get("summaryScope") != "five-figures-v1":
            raise ValueError("Integrated summary requires all five figures")
        evidence = chart_evidence(chart)
    request_body = {
        "systemInstruction": {"parts": [{"text": instructions}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(evidence, ensure_ascii=False, separators=(",", ":"))}]}],
        "generationConfig": {
            "maxOutputTokens": 5000, "responseMimeType": "application/json",
            "responseSchema": {"type": "OBJECT", "properties": {
                "summary": {"type": "STRING"},
                "sourceIds": {"type": "ARRAY", "items": {"type": "STRING"}}},
                "required": ["summary", "sourceIds"]},
        },
    }
    request = Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                      data=json.dumps(request_body).encode(),
                      headers={"x-goog-api-key": api_key, "Content-Type": "application/json"}, method="POST")
    # Bounded retries are owned by Step Functions; no provider/model fallback.
    with urlopen(request, timeout=180) as response:
        result = json.load(response)
    candidates = result.get("candidates", [])
    if result.get("promptFeedback", {}).get("blockReason") or len(candidates) != 1 or candidates[0].get("finishReason") != "STOP":
        raise ValueError("Gemini response is blocked or incomplete")
    output = "".join(part.get("text", "") for part in candidates[0].get("content", {}).get("parts", []) if not part.get("thought"))
    decoded = json.loads(output)
    report["summary"] = validate_summary(decoded["summary"], decoded["sourceIds"], {s["id"] for s in report["sources"]})
    report["generatedAt"] = now()
    write_json(f"{event['prefix']}/generation-audit.json", {"responseId": result.get("responseId"), "model": result.get("modelVersion", MODEL),
                                                          "usage": result.get("usageMetadata"), "summarySourceIds": decoded["sourceIds"],
                                                          "evidenceHash": fingerprint(chart) if chart is not None else None,
                                                          "promptHash": hashlib.sha256(PROMPT.encode()).hexdigest()})
    if chart is not None:
        return {"summary": report["summary"], "generatedAt": report["generatedAt"], "model": MODEL, "sourceIds": decoded["sourceIds"], "evidenceHash": fingerprint(chart)}
    write_json(f"{event['prefix']}/report.json", report)
    return event


def publish(event):
    report = read_json(f"{event['prefix']}/report.json")
    validate_summary(report["summary"], [source["id"] for source in report["sources"]], {source["id"] for source in report["sources"]})
    if report["date"] != event["asOf"] or report["model"] != MODEL:
        raise ValueError("Publication manifest mismatch")
    if len(json.dumps(report, ensure_ascii=False).encode()) > 320000:
        raise ValueError("Report exceeds DynamoDB item budget")
    summary = {key: report[key] for key in ("date", "generatedAt", "summary", "model")}
    serializer = TypeSerializer()

    def item(value):
        return {key: serializer.serialize(val) for key, val in json.loads(json.dumps(value), parse_float=Decimal).items()}

    history = {"Put": {"TableName": os.environ["REPORT_TABLE"],
                       "Item": item({"pk": "HISTORY", "sk": report["date"], **summary, "snapshotKey": f"{event['prefix']}/report.json"}),
                       "ConditionExpression": "attribute_not_exists(pk)"}}
    latest = {"Put": {"TableName": os.environ["REPORT_TABLE"],
                      "Item": item({"pk": "REPORT", "sk": "LATEST", "reportDate": report["date"], "report": report,
                                    "collectionKey": f"{event['prefix']}/collected.json"}),
                      "ConditionExpression": "attribute_not_exists(pk) OR reportDate < :date",
                      "ExpressionAttributeValues": {":date": {"S": report["date"]}}}}
    client = boto3.client("dynamodb")
    try:
        client.transact_write_items(TransactItems=[history, latest], ClientRequestToken=hashlib.sha256(event["prefix"].encode()).hexdigest()[:36])
    except client.exceptions.TransactionCanceledException:
        # Duplicate deliveries succeed without overwriting the historical summary.
        if table().get_item(Key={"pk": "HISTORY", "sk": report["date"]}, ConsistentRead=True).get("Item"):
            return {"status": "already-published", "date": report["date"]}
        current = table().get_item(Key={"pk": "REPORT", "sk": "LATEST"}, ConsistentRead=True).get("Item")
        if current and current["reportDate"] > report["date"]:
            client.transact_write_items(TransactItems=[history])
            return {"status": "archived-only", "date": report["date"]}
        raise
    return {"status": "published", "date": report["date"]}


def handler(event, context):
    action = event["action"]
    if action == "collect":
        return collect(event)
    if action == "generate":
        return generate(event["run"])
    if action == "publish":
        return publish(event["run"])
    raise ValueError("Unknown task")
