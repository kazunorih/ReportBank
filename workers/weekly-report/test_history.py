import json
import unittest
from pathlib import Path
from integrated import integrate


class HistoryTests(unittest.TestCase):
    def test_long_history_preserves_supplied_csv_and_limits_boj_to_thirty_years(self):
        root = Path(__file__).resolve().parents[2]
        chart = json.loads((root / 'lib/reports/data/markets.json').read_text(encoding='utf-8'))
        original = json.loads((Path(__file__).parent / 'data/lending.json').read_text(encoding='utf-8'))
        previous = json.loads(json.dumps(chart['bojFinancials']))
        previous['observations'].insert(0, {**previous['observations'][0], 'date': '1990-03-31'})
        result = integrate(chart, previous=previous)
        self.assertEqual(len(result['lending']['observations']), 100)
        self.assertEqual(len(result['bojFinancials']['observations']), 14)
        self.assertTrue(all(row['date'] >= '1996-07-01' for row in result['bojFinancials']['observations']))
        originals = {row['date']: row for row in original['observations']}
        for row in result['lending']['observations']:
            if row['date'] in originals:
                for key in ('domesticBankLoans', 'housingLoans'):
                    self.assertEqual(row[key], originals[row['date']][key])
            if row['date'] < '1993-06-30':
                self.assertIsNone(row['domesticCorporateLoans'])


if __name__ == '__main__':
    unittest.main()
