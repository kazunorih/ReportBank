import unittest
from fiscal import parse_debt_html, interest_from_pages, collect_fiscal


class FiscalTests(unittest.TestCase):
    def test_debt_total_does_not_join_change_or_guarantee_columns(self):
        raw = '''国債及び借入金現在高（平成８年１２月末現在） 単位：億円
        <table><tr><td>合 計</td><td>３，４３６，８１７</td><td>123,456</td></tr></table>
        2. 政府保証債務<table><tr><td>合計</td><td>123,456</td></tr></table>'''.encode()
        self.assertEqual(parse_debt_html(raw), {"date": "1996-12-31", "amount": 343.6817})

    def test_interest_uses_current_column_and_sums_reorganized_ministries(self):
        label = "国債利子等支払財源の国債整理基金特別会計へ繰入れに必要な経費"
        rows = interest_from_pages([
            (547, f"千円 {label} 8,029,680,115 9,999,999,999 大蔵省所管大蔵本省"),
            (1119, f"千円 {label} 2,713,563,954 9,999,999,999 財務省所管財務本省"),
        ])
        self.assertAlmostEqual(sum(row["amount"] for row in rows), 10.743244069)
        with self.assertRaises(ValueError):
            interest_from_pages([(0, f"千円 {label} 8,029,680,115 財務省所管財務本省")] * 2)
        with self.assertRaises(ValueError):
            interest_from_pages([(0, "千円 年金特例公債利子等支払財源の国債整理基金特別会計へ繰入れに必要な経費 23,256,972 財務省所管財務本省")])

    def test_fiscal_window_and_publication_lag_do_not_invent_values(self):
        data = collect_fiscal(None, "2026-10-14")
        self.assertEqual(len(data["debt"]), 60)
        self.assertEqual(len(data["budgets"]), 30)
        self.assertTrue(all(300 < row["amount"] < 1500 for row in data["debt"]))
        future = collect_fiscal(None, "2027-07-01", data)
        self.assertFalse(any(row["date"] > "2026-06-30" for row in future["debt"]))
        self.assertFalse(any(row["fiscalYear"] > 2026 for row in future["budgets"]))


if __name__ == "__main__":
    unittest.main()
