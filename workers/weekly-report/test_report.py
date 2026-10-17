import unittest
from unittest.mock import patch

from domain import (SERIES, aggregate, half_years, parse_boj, parse_mof, report_date,
                    validate_observations, validate_summary)
from sources import parse_flat35, parse_flat35_history, collect_flat35, parse_import, safe_url
from topix import parse_topix_text, parse_topix_annual
from markets import build_markets
import index as worker


class AggregationTests(unittest.TestCase):
    def test_attached_topix_workbook_uses_annual_close_not_open_high_or_low(self):
        from pathlib import Path
        rows = parse_topix_annual((Path(__file__).parent / 'data' / 'topixyear_j.xls').read_bytes())
        self.assertEqual(len(rows), 77)
        self.assertEqual(rows[0], {'date': '1949-12-31', 'value': 12.85})
        self.assertEqual(rows[-1], {'date': '2025-12-31', 'value': 3408.97})
        self.assertTrue(all(row['date'].endswith('-12-31') for row in rows))
        self.assertEqual(aggregate(rows, ['2025-06-30', '2025-12-31', '2026-06-30'], 'last'), [None, 3408.97, None])
        validate_observations('topix', rows, '2026-10-12')
        with self.assertRaises(ValueError):
            validate_observations('topix', rows, '2027-03-01')

    def test_flat35_history_midpoint_preserves_precision_and_provenance(self):
        from pathlib import Path
        content = (Path(__file__).parent / 'data' / 'flat35-range.csv').read_text(encoding='utf-8')
        rows, sources = parse_flat35_history(content)
        self.assertEqual(len(rows), 46)
        self.assertEqual(len(sources), 8)
        self.assertEqual(next(r['value'] for r in rows if r['date'] == '2005-12-31'), 2.9705)
        self.assertEqual(rows[-1]['value'], 4.345)
        for invalid in (content + content.splitlines()[1] + '\n', content.replace('2.890,3.950', '4.000,3.950'), content.replace('2.890,3.950', 'NaN,3.950')):
            with self.assertRaises(ValueError):
                parse_flat35_history(invalid)

    @patch('sources.collect_flat35_current_jhf')
    def test_flat35_current_month_overrides_seed_and_excludes_future(self, current):
        from sources import Fetcher
        current.return_value = {'flat35': {'observations': [{'date': '2026-06-01', 'value': 4.5}], 'sourceIds': ['current']}}
        data = collect_flat35(Fetcher(), '2026-06-15')['flat35']
        self.assertEqual(data['method'], 'range-midpoint-v1')
        self.assertEqual([r for r in data['observations'] if r['date'].startswith('2026-06')], [{'date': '2026-06-01', 'value': 4.5}])
        self.assertTrue(all(r['date'] <= '2026-06-15' for r in data['observations']))

    def test_topix_months_exclude_daily_and_dividend_included_columns(self):
        header = "Stock Price Index & Stock Price Average(End of Year/Month/Daily) TOPIX\n"
        rows = "30 (2018) 1 1,001.00 2,001.00\n" + "\n".join(f"{m} {1000+m}.00 {2000+m}.00" for m in range(2, 13))
        data = parse_topix_text(header + rows + "\n12.1 9999.00 8888.00\n2 9998.00 8887.00\n")
        self.assertEqual(len(data), 12)
        self.assertEqual(data[5], {"date": "2018-06-30", "value": 1006.0})
        with self.assertRaises(ValueError):
            parse_topix_text(header + "2026 1 1,000.00 2,000.00\n")

    def test_topix_uses_points_and_half_year_closing_value(self):
        # Synthetic input verifies units and aggregation, not market history.
        header = "date,value,unit,source_name,source_url\n"
        body = "2026-06-29,2800,ポイント,TOPIX,https://www.jpx.co.jp/\n2026-06-30,2810,ポイント,TOPIX,https://www.jpx.co.jp/\n"
        rows, sources = parse_import((header + body).encode(), "topix")
        self.assertEqual(SERIES["topix"][0], "ポイント")
        self.assertEqual(aggregate(rows, ["2026-06-30"], SERIES["topix"][1]), [2810])
        self.assertEqual(len(sources), 1)
        with self.assertRaises(ValueError):
            parse_import((header + body.replace("ポイント", "円")).encode(), "topix")

    def test_completed_half_years_and_japan_boundary(self):
        periods = half_years("2026-10-11")
        self.assertEqual((len(periods), periods[0], periods[-1]), (60, "1996-12-31", "2026-06-30"))
        self.assertEqual(half_years("2026-06-29")[-1], "2025-12-31")
        self.assertEqual(half_years("2026-06-30")[-1], "2026-06-30")
        extended = half_years("2026-10-17", 50)
        self.assertEqual((len(extended), extended[0], extended[-1]), (100, "1976-12-31", "2026-06-30"))
        self.assertEqual(half_years("2026-12-31", 50)[0], "1977-06-30")
        self.assertEqual(report_date("2026-10-09T14:00:00Z"), "2026-10-09")
        self.assertEqual(report_date("2026-10-09T16:00:00Z"), "2026-10-10")

    def test_stock_not_summed_or_carried_forward(self):
        rows = [{"date": "2025-06-27", "value": 12}, {"date": "2025-06-30", "value": 15}, {"date": "2025-09-30", "value": 20}]
        self.assertEqual(aggregate(rows, ["2025-06-30", "2025-12-31"], "last"), [15, None])

    def test_flow_needs_all_six_months_and_keeps_zero(self):
        rows = [{"date": f"2025-{m:02}-01", "value": 0 if m == 1 else m} for m in range(1, 7)]
        self.assertEqual(aggregate(rows, ["2025-06-30"], "sum"), [20])
        self.assertEqual(aggregate(rows[1:], ["2025-06-30"], "sum"), [None])
        with self.assertRaises(ValueError):
            aggregate(rows + rows[:1], ["2025-06-30"], "sum")

    def test_negative_yields_and_missing_values(self):
        csv = "国債金利情報\n基準日,3年,10年,30年\nH31.4.26,-0.15,0,0.6\nR1.5.7,-,0.1,0.7\n※データを取得できない場合の注記,,,\n"
        result = parse_mof(csv.encode("cp932"))
        self.assertEqual(result["jgb3"], [{"date": "2019-04-26", "value": -0.15}])
        self.assertEqual(result["jgb10"][0]["value"], 0)

    def test_boj_quarter_is_not_month_and_units_convert(self):
        payload = {"STATUS": 200, "NEXTPOSITION": None, "RESULTSET": [
            {"SERIES_CODE": "code", "UNIT_J": "億円", "FREQUENCY": "QUARTERLY",
             "VALUES": {"SURVEY_DATES": [202502, 202504], "VALUES": [12345, None]}}]}
        self.assertEqual(parse_boj(payload, {"code": "bankJgb"}), {"bankJgb": [{"date": "2025-06-30", "value": 1.2345}]})
        payload["NEXTPOSITION"] = 251
        with self.assertRaises(ValueError):
            parse_boj(payload, {"code": "bankJgb"})

    def test_future_stale_and_bad_values_rejected(self):
        for rows in ([{"date": "2027-01-01", "value": 1}], [{"date": "2020-01-01", "value": 1}], [{"date": "2026-06-30", "value": float("nan")}], [{"date": "2026-06-30", "value": -1}]):
            with self.assertRaises(ValueError):
                validate_observations("bojAssets", rows, "2026-07-01")
        validate_observations("jgb3", [{"date": "2026-06-30", "value": -0.1}], "2026-07-01")

    def test_summary_counts_unicode_and_rejects_unknown_citations(self):
        self.assertEqual(validate_summary("あ" * 400, ["mof"], {"mof"}), "あ" * 400)
        self.assertEqual(validate_summary("😀" * 400, ["mof"], {"mof"}), "😀" * 400)
        for text, ids in [("あ" * 401, ["mof"]), ("", ["mof"]), ("本文", ["fake"]), ("本文", [])]:
            with self.assertRaises(ValueError):
                validate_summary(text, ids, {"mof"})


class ImportTests(unittest.TestCase):
    def test_flat35_does_not_confuse_rate_ranges_or_products(self):
        # Shape of the official published table; deliberately distinct test rates.
        html = """<h2>新機構団信付きの【フラット３５】等の借入金利水準（2026年10月）</h2>
        <h3>【フラット３５】借入期間：21年以上35年以下</h3>
        <table><tr><td>９割以下</td><td>年1.230％～年4.560％</td><td>年2.000％</td></tr>
        <tr><td>９割超</td><td>年3.000％～年5.000％</td></tr></table>
        <h3>【フラット２０】借入期間：20年以下</h3><p>９割以下 年0.900％～年3.000％</p>"""
        self.assertEqual(parse_flat35(html), [{"date": "2026-10-01", "value": 2.895, "minimum": 1.23, "maximum": 4.56}])
        with self.assertRaises(ValueError):
            parse_flat35(html.replace("21年以上35年以下", "20年以下"))
        with self.assertRaises(ValueError):
            parse_flat35(html.replace("新機構団信付き", "旧条件"))

    def test_allowlist_blocks_metadata_and_redirect_hosts(self):
        for url in ("http://www.boj.or.jp/", "https://169.254.169.254/", "https://www.boj.or.jp.evil.com/", "https://user:pass@www.boj.or.jp/", "https://www.boj.or.jp:8080/"):
            with self.assertRaises(ValueError):
                safe_url(url)

    def test_import_requires_correct_units_and_provenance(self):
        csv = "date,value,unit,source_name,source_url\n2026-06-30,1.5,%,住宅金融支援機構,https://www.flat35.com/kinri/kinri_suii.html\n"
        rows, sources = parse_import(csv.encode(), "flat35")
        self.assertEqual(rows[0]["value"], 1.5)
        self.assertEqual(len(sources), 1)
        with self.assertRaises(ValueError):
            parse_import(csv.replace(",%,", ",円,").encode(), "flat35")
        with self.assertRaises(ValueError):
            parse_import((csv + csv.splitlines()[1] + "\n").encode(), "flat35")


def fixture_payload():
    # Deliberately synthetic test observations; never used by the application.
    datasets = {}
    for key in SERIES:
        rows = [{"date": "2026-06-30", "value": 1}]
        if key == "construction":
            rows = [{"date": f"2026-{m:02}-01", "value": 1} for m in range(1, 7)]
        datasets[key] = {"observations": rows, "sourceIds": ["source"]}
        if key == "flat35":
            datasets[key]["method"] = "range-midpoint-v1"
    return {"asOf": "2026-07-01", "datasets": datasets, "contextWarnings": [],
            "sources": [{"id": "source", "name": "Test source", "url": "https://www.boj.or.jp/", "retrievedAt": "2026-07-01T00:00:00Z"}]}


class PublicationTests(unittest.TestCase):
    def test_first_chart_does_not_require_other_statistics_or_ai(self):
        payload = fixture_payload()
        payload["datasets"] = {key: value for key, value in payload["datasets"].items() if key in ("jgb3", "jgb10", "jgb30", "flat35", "topix")}
        payload["datasets"]["flat35"]["observations"] = [{"date": "2026-07-01", "value": 3.0}]
        chart = build_markets(payload)
        self.assertEqual(len(chart["series"]), 4)
        self.assertNotIn("summary", chart)
        self.assertTrue(all(v is None for v in next(s for s in chart["series"] if s["id"] == "flat35")["values"]))

    @patch.dict("os.environ", {"OPENAI_SECRET_ARN": "test-secret", "OPENAI_MODEL": "gpt-5.6-luna"})
    @patch.object(worker, "write_json")
    @patch.object(worker, "urlopen")
    @patch.object(worker.boto3, "client")
    def test_market_summary_uses_only_displayed_chart_data(self, client, urlopen, write_json):
        import io
        import json
        client.return_value.get_secret_value.return_value = {"SecretString": '{"apiKey":"test-key"}'}
        response = {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({"summary": "図表に基づくテスト本文", "sourceIds": ["source"]})}]}]}
        urlopen.return_value.__enter__.return_value = io.StringIO(json.dumps(response))
        chart = worker.integrate(build_markets(fixture_payload()))
        insight = worker.generate({"prefix": "runs/test"}, chart=chart)
        request = json.loads(urlopen.call_args.args[0].data)
        evidence = json.loads(request["input"])
        self.assertEqual({s["id"] for s in evidence["series"]}, {"jgb10", "jgb30", "flat35", "topix"})
        self.assertNotIn("latestObservations", evidence)
        self.assertNotIn("referenceDocuments", evidence)
        self.assertEqual(evidence["figure02"], chart["lending"])
        self.assertEqual(evidence["figure03"], chart["bojFinancials"])
        self.assertEqual(evidence["figure04"], chart["fiscal"])
        self.assertIn("①金利増減と貸出残高増減の関係", request["instructions"])
        self.assertIn("②政府の国債発行残高の増減と利払い費の増減", request["instructions"])
        self.assertIn("③日銀の国債保有残高の増減と民間金融機関に与える影響予測", request["instructions"])
        self.assertIn("過去50年の観測窓を主軸", request["instructions"])
        self.assertIn("1970年代から最大50年", request["instructions"])
        self.assertIn("日銀財務諸表は取得済み期間だけ", request["instructions"])
        self.assertIn("政府債務全体ではありません", request["instructions"])
        self.assertIn("分からない", request["instructions"])
        self.assertEqual(insight["model"], "gpt-5.6-luna")
        self.assertNotIn("insight", chart)

    def test_missing_series_stops_publication(self):
        payload = fixture_payload()
        del payload["datasets"]["flat35"]
        with self.assertRaisesRegex(ValueError, "flat35"):
            worker.build_report(payload)

    def test_no_future_or_backdated_reports(self):
        for stamp in ("2099-01-01T00:00:00Z", "2000-01-01T00:00:00Z", "2026-01-01T00:00:00"):
            with self.assertRaisesRegex(ValueError, "scheduled time"):
                worker.collect({"scheduledTime": stamp})

    def test_all_series_and_missing_history_preserved(self):
        report = worker.build_report(fixture_payload())
        self.assertEqual(len(report["series"]), 13)
        self.assertEqual(len(report["periods"]), 60)
        self.assertIsNone(report["series"][0]["values"][0])
        self.assertTrue(report["warnings"])

    @patch.dict("os.environ", {"REPORT_TABLE": "test"})
    @patch.object(worker.boto3, "client")
    @patch.object(worker, "read_json")
    def test_latest_and_history_published_in_one_transaction(self, read_json, client):
        report = worker.build_report(fixture_payload())
        report.update(summary="テスト本文", generatedAt="2026-07-01T00:00:00Z")
        read_json.return_value = report
        worker.publish({"prefix": "runs/test", "asOf": "2026-07-01"})
        kwargs = client.return_value.transact_write_items.call_args.kwargs
        self.assertEqual(len(kwargs["TransactItems"]), 2)
        self.assertIn("reportDate < :date", kwargs["TransactItems"][1]["Put"]["ConditionExpression"])
        self.assertEqual(kwargs["TransactItems"][0]["Put"]["ConditionExpression"], "attribute_not_exists(pk)")

    @patch.dict("os.environ", {"REPORT_TABLE": "test"})
    @patch.object(worker, "table")
    @patch.object(worker.boto3, "client")
    @patch.object(worker, "read_json")
    def test_duplicate_delivery_keeps_original_history(self, read_json, client, table):
        report = worker.build_report(fixture_payload())
        report.update(summary="テスト本文", generatedAt="2026-07-01T00:00:00Z")
        read_json.return_value = report
        class Cancelled(Exception):
            pass
        client.return_value.exceptions.TransactionCanceledException = Cancelled
        client.return_value.transact_write_items.side_effect = Cancelled()
        table.return_value.get_item.return_value = {"Item": {"summary": "既存の本文"}}
        self.assertEqual(worker.publish({"prefix": "runs/test", "asOf": "2026-07-01"})["status"], "already-published")
        self.assertEqual(client.return_value.transact_write_items.call_count, 1)

    @patch.dict("os.environ", {"REPORT_TABLE": "test"})
    @patch.object(worker, "table")
    @patch.object(worker.boto3, "client")
    @patch.object(worker, "read_json")
    def test_late_old_run_only_inserts_history(self, read_json, client, table):
        report = worker.build_report(fixture_payload())
        report.update(summary="テスト本文", generatedAt="2026-07-01T00:00:00Z")
        read_json.return_value = report
        class Cancelled(Exception):
            pass
        client.return_value.exceptions.TransactionCanceledException = Cancelled
        client.return_value.transact_write_items.side_effect = [Cancelled(), {}]
        table.return_value.get_item.side_effect = [{}, {"Item": {"reportDate": "2026-07-08"}}]
        self.assertEqual(worker.publish({"prefix": "runs/test", "asOf": "2026-07-01"})["status"], "archived-only")
        self.assertEqual(len(client.return_value.transact_write_items.call_args.kwargs["TransactItems"]), 1)


if __name__ == "__main__":
    unittest.main()
