import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('monthly', Path(__file__).with_name('refresh-monthly-trade.py'))
monthly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monthly)


class MonthlyTradeTests(unittest.TestCase):
    def test_previous_month_and_japan_year_boundary(self):
        self.assertEqual(monthly.expected_month(datetime(2027, 1, 28, 3, tzinfo=timezone.utc)), '2026-12')
        self.assertEqual(monthly.expected_month(datetime(2026, 11, 28, 3, tzinfo=timezone.utc)), '2026-10')
        self.assertEqual(monthly.expected_month(datetime(2026, 12, 31, 16, tzinfo=timezone.utc)), '2026-12')

    def test_timestamp_is_preserved_only_when_evidence_unchanged(self):
        old = {'retrievedAt': 'old', 'value': 1}
        self.assertEqual(monthly.preserve_timestamp(old, {'retrievedAt': 'new', 'value': 1})['retrievedAt'], 'old')
        self.assertEqual(monthly.preserve_timestamp(old, {'retrievedAt': 'new', 'value': 2})['retrievedAt'], 'new')

    def test_missing_detail_month_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'not published'):
            monthly.validate({'latestMonth': '2026-09'}, {}, '2026-10')

    def test_validation_rejects_bad_amounts_and_missing_months(self):
        import copy
        def dataset(ids):
            return {'latestMonth': '2000-01', 'charts': [
                {'id': key, 'categories': ['A', 'その他'], 'points': [
                    {'month': '2000-01', 'values': [60, 40], 'total': 100}
                ]} for key in ids]}
        trade = dataset(['country-export', 'country-import', 'commodity-export', 'commodity-import'])
        ports = dataset(['port-export', 'port-import'])
        monthly.validate(trade, ports, '2000-01')
        revised = copy.deepcopy(ports)
        revised['charts'][0]['points'][0]['values'] = [60, -40]
        with self.assertRaisesRegex(ValueError, 'Invalid amounts'):
            monthly.validate(trade, revised, '2000-01')
        revised = copy.deepcopy(ports)
        revised['charts'][0]['points'] = []
        with self.assertRaisesRegex(ValueError, 'Missing or duplicate'):
            monthly.validate(trade, revised, '2000-01')

    def test_collection_failure_preserves_all_published_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            data = root / 'lib/reports/data'
            data.mkdir(parents=True)
            for name in monthly.FILES + ['fdi-stock.json']:
                (data / name).write_text(json.dumps({'original': name}), encoding='utf-8')
            before = {p.name: p.read_bytes() for p in data.iterdir()}
            with patch.object(monthly, 'ROOT', root), patch.object(monthly.subprocess, 'run', side_effect=RuntimeError('source unavailable')):
                with self.assertRaises(RuntimeError):
                    monthly.main()
            self.assertEqual({p.name: p.read_bytes() for p in data.iterdir()}, before)


if __name__ == '__main__':
    unittest.main()
