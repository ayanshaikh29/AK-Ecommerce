import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemGST, cartGST } from '../../lib/reports/gst.js'
import { isSameState } from '../../lib/gst-utils.js'

const item = (price, qty) => ({ price_snapshot: price, quantity: qty, product_name_snapshot: 'Product' })
const product = (gst, hsn) => ({ gst_percent: gst, hsn_code: hsn })

test('same-state (Maharashtra) splits CGST and SGST equally', () => {
  const g = itemGST(item(100, 2), product(12, '4820'), 'Maharashtra')
  assert.equal(g.gst_percent, 12)
  assert.equal(g.taxableValue, 178.57) // 200 / 1.12
  assert.equal(g.taxAmount, 21.43)
  assert.equal(g.igst, 0)
  assert.ok(g.cgst > 0)
  assert.equal(g.sgst, g.cgst)
})

test('cross-state uses IGST only', () => {
  const g = itemGST(item(100, 2), product(12, '4820'), 'Karnataka')
  assert.equal(g.cgst, 0)
  assert.equal(g.sgst, 0)
  assert.ok(g.igst > 0)
  assert.equal(g.igst, g.taxAmount)
})

test('zero-rate GST yields zero tax', () => {
  const g = itemGST(item(100, 1), product(0, '9999'), 'Maharashtra')
  assert.equal(g.taxAmount, 0)
  assert.equal(g.taxableValue, 100)
})

test('missing product defaults to 18% and empty HSN', () => {
  const g = itemGST(item(50, 1), null, 'Maharashtra')
  assert.equal(g.gst_percent, 18)
  assert.equal(g.hsn_code, '')
  // Half-rounding can differ by a paisa (app-wide behaviour): CGST+SGST ≈ taxAmount
  assert.ok(Math.abs(g.cgst + g.sgst - g.taxAmount) <= 0.01)
})

test('isSameState normalises case/whitespace', () => {
  assert.equal(isSameState('maharashtra ', 'Maharashtra'), true)
  assert.equal(isSameState('Karnataka', 'Maharashtra'), false)
})

test('cartGST aggregates multiple items', () => {
  const items = [
    { item: item(100, 2), product: product(12, '4820') },
    { item: item(200, 1), product: product(18, '3402') }
  ]
  const g = cartGST(items, 'Maharashtra')
  // 12% on 200 → 21.43 ; 18% on 200 → 30.51 → total 51.94
  assert.equal(g.totalGST, 51.94)
  assert.equal(g.totalCGST, g.totalSGST)
  assert.equal(g.totalIGST, 0)
  assert.equal(g.sameState, true)
})
