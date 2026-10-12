import unittest
from boj_financials import parse_statement

class FinancialStatementTests(unittest.TestCase):
    def test_prior_and_current_fiscal_dates_and_conversion(self):
        html = '<table><caption>億円 上半期末</caption><tr><th>資産の部合計</th><td>6,000,000</td><td>7,000,000</td></tr><tr><th>国債</th><td>4,000,000</td><td>5,000,000</td></tr><tr><th>うち長期国債</th><td>1</td><td>2</td></tr></table>'
        rows = parse_statement(html, 2025, True)
        self.assertEqual(rows, [dict(date="2024-09-30", assets=600, jgb=400, other=200), dict(date="2025-09-30", assets=700, jgb=500, other=200)])
        with self.assertRaises(ValueError):
            parse_statement(html.replace("億円", "百万円"), 2025, True)
        with self.assertRaises(ValueError):
            parse_statement(html.replace("5,000,000", "9,000,000"), 2025, True)
        with self.assertRaises(ValueError):
            parse_statement(html, 2025, False)

if __name__ == "__main__":
    unittest.main()
