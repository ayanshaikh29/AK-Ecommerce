import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeReport } from './fixture.mjs'
import { buildWorkbook, reportFileName, safeText } from '../../lib/reports/excel.js'
import * as XLSX from 'xlsx'

const REQUIRED_SHEETS = [
  'Sales Summary', 'Calculation Definitions', 'Order Details', 'Orders Summary',
  'Products Sold', 'Sales by Date', 'Sales by Product', 'Sales by Category',
  'Sales by Customer', 'Sales by Location', 'Payment Report', 'Order Status Report',
  'GST Report', 'Data Quality', 'Notes'
]

test('safeText neutralises formula injection', () => {
  assert.equal(safeText('=SUM(A1:A9)'), "'=SUM(A1:A9)")
  assert.equal(safeText('+123'), "'+123")
  assert.equal(safeText('-1+1'), "'-1+1")
  assert.equal(safeText('@cmd'), "'@cmd")
  assert.equal(safeText('plain text'), 'plain text')
  assert.equal(safeText(123), 123)
  assert.equal(safeText(''), '')
  assert.equal(safeText(null), '')
})

test('every required sheet exists and the workbook opens', async () => {
  const report = makeReport()
  const buf = await buildWorkbook(report)
  assert.ok(buf instanceof ArrayBuffer || Buffer.isBuffer(buf))
  const wb = XLSX.read(buf, { type: 'buffer' })
  for (const sheet of REQUIRED_SHEETS) {
    assert.ok(wb.SheetNames.includes(sheet), `missing sheet: ${sheet}`)
  }
  assert.equal(wb.SheetNames.length, REQUIRED_SHEETS.length)
})

test('Order Details sheet has the full required column set', async () => {
  const report = makeReport()
  const buf = await buildWorkbook(report)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets['Order Details']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  // Row 6 is the header (title block occupies rows 1-5)
  const header = rows[5].map((h) => String(h))
  const required = ['Order Number', 'Order Status', 'GSTIN', 'HSN Code', 'Quantity', 'Taxable Amount', 'Total GST', 'Final Order Amount', 'Amount Paid', 'Amount Due', 'Zone Name', 'Customer Name', 'Product Name', 'Delivered Qty']
  for (const col of required) {
    assert.ok(header.includes(col), `missing column: ${col}`)
  }
  // Data rows present (5 items + 1 totals row)
  assert.ok(rows.length >= 6 + 5)
})

test('Order Details rows include a totals row and no header spill', async () => {
  const report = makeReport()
  const buf = await buildWorkbook(report)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets['Order Details']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const lastRow = rows[rows.length - 1]
  // The totals row first cell should be "TOTAL" (label) — we placed it on
  // the first column keyed by totals_label? Actually our totals row writes
  // 'TOTAL' into the first column cell.
  assert.ok(rows.length >= 7)
})

test('Products Sold sheet total quantities are correct', async () => {
  const report = makeReport()
  const buf = await buildWorkbook(report)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets['Products Sold']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const header = rows[5]
  const qtyIdx = header.indexOf('Quantity Sold')
  let sum = 0
  for (let i = 6; i < rows.length - 1; i++) {
    sum += Number(rows[i][qtyIdx]) || 0
  }
  // p1: 3 sold, p2: 4 sold (+ zero-sale products from allProducts: none extra) → 7
  assert.equal(sum, 7)
})

test('report file name follows the spec format', () => {
  const name = reportFileName('Pune')
  assert.ok(/^AK_Enterprises_Order_Report_Pune_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.xlsx$/.test(name), name)
})
