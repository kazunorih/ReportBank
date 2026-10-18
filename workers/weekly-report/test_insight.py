import copy
import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

import index as worker
from insight_config import MODEL, fingerprint, reuse_insight, semantic
from markets import build_markets
from test_report import fixture_payload


class InsightTests(unittest.TestCase):
    def setUp(self):
        self.chart = worker.integrate(build_markets(fixture_payload()))

    def previous(self):
        return {"insight": {"model": MODEL, "summary": "AIの推論です。因果関係は分からない。",
                            "generatedAt": "2026-10-01T00:00:00Z", "sourceIds": ["source"],
                            "evidenceHash": fingerprint(self.chart)}}

    def test_metadata_refresh_reuses_original_date(self):
        previous = self.previous()
        self.chart["asOf"] = "2026-10-18"
        for source in self.chart["sources"]:
            source["retrievedAt"] = "2026-10-18T00:00:00Z"
        self.chart["sources"].reverse()
        self.assertEqual(reuse_insight(self.chart, previous), previous["insight"])

    def test_values_notes_periods_and_prompt_trigger_generation(self):
        previous = self.previous()
        for key in ("lending", "bojFinancials", "fiscal", "household"):
            chart = copy.deepcopy(self.chart)
            chart[key]["note"] = "改定"
            self.assertIsNone(reuse_insight(chart, previous))
        chart = copy.deepcopy(self.chart)
        chart["series"][0]["values"][-1] = 9.0
        self.assertIsNone(reuse_insight(chart, previous))
        chart = copy.deepcopy(self.chart)
        chart["periods"][0] = "1970-06-30"
        self.assertIsNone(reuse_insight(chart, previous))
        with patch("insight_config.PROMPT", "new prompt"):
            self.assertIsNone(reuse_insight(self.chart, previous))
        self.assertIsNone(reuse_insight(self.chart, {}))

    @patch.dict("os.environ", {"GEMINI_SECRET_ARN": "test-secret", "GEMINI_MODEL": MODEL})
    @patch.object(worker, "write_json")
    @patch.object(worker, "urlopen")
    @patch.object(worker.boto3, "client")
    def test_bad_responses_never_produce_publishable_result(self, client, urlopen, write):
        client.return_value.get_secret_value.return_value = {"SecretString": '{"apiKey":"test-key"}'}
        outputs = [{}, {"promptFeedback": {"blockReason": "SAFETY"}}]
        for reason, summary, sources in [("MAX_TOKENS", "本文", ["source"]),
                                          ("STOP", "あ" * 401, ["source"]),
                                          ("STOP", "本文", ["invented"])]:
            outputs.append({"candidates": [{"finishReason": reason, "content": {"parts": [
                {"text": json.dumps({"summary": summary, "sourceIds": sources})}]}}]})
        for response in outputs:
            urlopen.return_value.__enter__.return_value = io.StringIO(json.dumps(response))
            with self.assertRaises(ValueError):
                worker.generate({"prefix": "runs/test"}, self.chart)
        urlopen.side_effect = HTTPError("https://example.test", 429, "quota", {}, None)
        with self.assertRaises(HTTPError):
            worker.generate({"prefix": "runs/test"}, self.chart)
        write.assert_not_called()

    @patch.dict("os.environ", {"GEMINI_SECRET_ARN": "test-secret"})
    @patch.object(worker, "write_json")
    @patch.object(worker, "read_json")
    @patch.object(worker, "table")
    @patch.object(worker, "integrate")
    @patch.object(worker, "generate")
    def test_collection_skips_unchanged_and_keeps_publication_on_failure(self, generate, integrate, table, read, write):
        old = {**self.chart, **self.previous()}
        table.return_value.get_item.return_value = {"Item": {"chart": old}}
        integrate.return_value = copy.deepcopy(self.chart)
        with patch.object(worker, "build_markets", return_value=self.chart), patch.object(worker, "collect_mof", return_value={}), patch.object(worker, "collect_flat35", return_value={}), patch.object(worker, "collect_topix", return_value={}):
            worker.collect_markets("2026-10-18", "runs/test")
            generate.assert_not_called()
            self.assertEqual(integrate.return_value["insight"], old["insight"])
            table.return_value.put_item.reset_mock()
            integrate.return_value["household"]["note"] = "改定"
            generate.side_effect = ValueError("failed")
            with self.assertRaises(ValueError):
                worker.collect_markets("2026-10-18", "runs/failed")
            table.return_value.put_item.assert_not_called()


if __name__ == "__main__":
    unittest.main()
