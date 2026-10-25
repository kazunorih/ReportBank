"""Verify JPX dash-to-zero handling without changing blank cells to zero."""
import importlib.util
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import unittest
import xml.etree.ElementTree as E

spec = importlib.util.spec_from_file_location('valuations', Path(__file__).with_name('import-equity-valuations.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ValuesTest(unittest.TestCase):
    def test_dash_zero_blank_and_asterisk_missing(self):
        ns = module.NS['m']
        tag = lambda name: f'{{{ns}}}{name}'
        strings = E.Element(tag('sst'))
        worksheet = E.Element(tag('worksheet'))
        sheet_data = E.SubElement(worksheet, tag('sheetData'))
        rows = [
            {'A': '連結総合(単純）'},
            {'H': '市場第一部', 'M': '市場第二部'},
            {'I': 'PER', 'J': 'PBR', 'N': 'PER', 'O': 'PBR'},
            {},
            {'A': '2021', 'B': '12', 'I': '-', 'J': '1.2', 'N': '－'},
            {'A': '2022', 'B': '3', 'I': '＊', 'N': '21.5', 'O': '0.7'},
        ]
        for i, cells in enumerate(rows, 1):
            row = E.SubElement(sheet_data, tag('row'))
            for column, value in cells.items():
                index = len(strings)
                E.SubElement(E.SubElement(strings, tag('si')), tag('t')).text = value
                cell = E.SubElement(row, tag('c'), {'r': f'{column}{i}', 't': 's'})
                E.SubElement(cell, tag('v')).text = str(index)
        workbook = E.Element(tag('workbook'))
        sheets = E.SubElement(workbook, tag('sheets'))
        E.SubElement(sheets, tag('sheet'), {'name': 'Consolidated(AVG)～202203', '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id': 'rId5'})
        E.SubElement(sheets, tag('sheet'), {'name': 'Consolidated(Average)', '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id': 'rId1'})
        current = E.Element(tag('worksheet'))
        current_data = E.SubElement(current, tag('sheetData'))
        for i, cells in enumerate([
            {'A': '連結総合(単純）'}, {'C': 'プライム市場', 'H': 'スタンダード市場'},
            {'D': 'PER', 'E': 'PBR', 'I': 'PER', 'J': 'PBR'}, {},
            {'A': '2022', 'B': '4', 'D': '-', 'E': '1.3', 'I': '25.8', 'J': '1'},
        ], 1):
            row = E.SubElement(current_data, tag('row'))
            for column, value in cells.items():
                index = len(strings)
                E.SubElement(E.SubElement(strings, tag('si')), tag('t')).text = value
                cell = E.SubElement(row, tag('c'), {'r': f'{column}{i}', 't': 's'})
                E.SubElement(cell, tag('v')).text = str(index)
        buffer = BytesIO()
        with ZipFile(buffer, 'w') as z:
            for path, root in [('xl/workbook.xml', workbook), ('xl/sharedStrings.xml', strings), ('xl/worksheets/sheet5.xml', worksheet), ('xl/worksheets/sheet1.xml', current)]:
                z.writestr(path, E.tostring(root))
        records = module.parse(buffer.getvalue())['observations']
        self.assertEqual(records, [
            {'month': '2021-12', 'market': 'first', 'per': 0, 'pbr': 1.2},
            {'month': '2021-12', 'market': 'second', 'per': 0, 'pbr': None},
            {'month': '2022-03', 'market': 'first', 'per': None, 'pbr': None},
            {'month': '2022-03', 'market': 'second', 'per': 21.5, 'pbr': 0.7},
            {'month': '2022-04', 'market': 'prime', 'per': 0, 'pbr': 1.3},
            {'month': '2022-04', 'market': 'standard', 'per': 25.8, 'pbr': 1},
        ])

if __name__ == '__main__': unittest.main()
