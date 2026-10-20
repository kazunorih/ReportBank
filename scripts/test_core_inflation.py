import importlib.util
from datetime import datetime
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("inflation", Path(__file__).with_name("import-core-inflation.py"))
inflation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inflation)


def fixture(incomplete=False, overlap=False):
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    root = ET.Element("worksheet", xmlns=ns)
    data = ET.SubElement(root, "sheetData")
    strings = ["Excluding fresh food", "Trimmed mean", "Weighted median", "Mode"]
    for index in range(1, 6):
        row = ET.SubElement(data, "row")
        if index == 4:
            for column, value in zip(("B", "N", "BG", "BH"), range(4)):
                cell = ET.SubElement(row, "c", r=f"{column}{index}", t="s")
                ET.SubElement(cell, "v").text = str(value)
    records = []
    for year in (1986, 1987):
        for month in range(1, 13):
            serial = (datetime(year, month, 1) - datetime(1899, 12, 30)).days
            record = {"A": serial, "N": month, "B": 0}
            if incomplete and year == 1987 and month == 12:
                del record["N"]
            if overlap and month == 1:
                record["O"] = 1
            if month <= 4:
                record.update({"BC": f"{year}.{month}", "BG": month, "BH": -month})
            records.append(record)
    for index, record in enumerate(records, 6):
        row = ET.SubElement(data, "row")
        for column, value in record.items():
            cell = ET.SubElement(row, "c", r=f"{column}{index}")
            ET.SubElement(cell, "v").text = str(value)
    shared = ET.Element("sst", xmlns=ns)
    for value in strings:
        ET.SubElement(ET.SubElement(shared, "si"), "t").text = value
    output = BytesIO()
    with ZipFile(output, "w") as workbook:
        workbook.writestr("xl/sharedStrings.xml", ET.tostring(shared))
        workbook.writestr("xl/worksheets/sheet1.xml", ET.tostring(root))
    return output.getvalue()


class CoreInflationTests(unittest.TestCase):
    def test_average_months_and_quarters_and_preserve_zero(self):
        rows = inflation.parse_workbook(fixture(), "1988-01-01")
        self.assertEqual(rows[-1], {"year": 1987, "core": 0, "trimmedMean": 6.5, "weightedMedian": 2.5, "mode": -2.5})

    def test_incomplete_year_is_not_annualized(self):
        rows = inflation.parse_workbook(fixture(incomplete=True), "1988-01-01")
        self.assertIsNone(rows[-1]["trimmedMean"])
        self.assertEqual(inflation.parse_workbook(fixture(), "1987-08-01")[-1]["year"], 1986)

    def test_overlapping_base_years_are_rejected(self):
        with self.assertRaises(ValueError):
            inflation.parse_workbook(fixture(overlap=True), "1988-01-01")


if __name__ == "__main__":
    unittest.main()
