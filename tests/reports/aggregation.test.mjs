import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, round2 } from '../../lib/reports/aggregation.js'
import { normalizeFilters } from '../../lib/reports/filters.js'
import { orders, products, categories, firstOrderByUser, makeReport } from './fixture.mjs'

const filters = normalizeFilters({ range: 'custom', start_date: '2026-08-01', end_date: '2026-08-31' })
const scope = { isOwner: true, zoneId: '', zoneName: 'All Zones' }

test('distinct orders and active-count logic', () => {
  const r = makeReport()
  assert.equal(r.summary.totalOrders, 4)
  assert.equal(r.summary.activeOrders, 3) // cancelled o2 excluded
  assert.equal(r.orderSummaries.length, 4)
  assert.equal(r.orderDetails.length, 5)
})

test('cancelled order never contributes to revenue', () => {
  const r = makeReport()
  // o2 (total 100, cancelled) must NOT be in gross/net
  assert.equal(r.summary.grossSales, 1100) // 400 + 600 + 100
  assert.equal(r.summary.netRevenue, 1250) // 1100 + 150 shipping
  assert.equal(r.summary.totalShipping, 150)
})

test('multi-product order does NOT duplicate the order total', () => {
  const r = makeReport()
  const o1 = r.orderSummaries.find((o) => o.order_number === 'AK0001')
  assert.equal(o1.item_count, 2)
  assert.equal(o1.subtotal, 400) // 2x100 + 1x200 — not 800 (no per-line total dup)
  // Product names joined correctly
  assert.ok(o1.product_names.includes('Pen Box'))
  assert.ok(o1.product_names.includes('Cleaning Liquid'))
  assert.equal(o1.total, 550)
})

test('order-level totals appear once per order in Orders Summary', () => {
  const r = makeReport()
  const totals = r.orderSummaries.reduce((s, o) => s + o.total, 0)
  assert.equal(totals, 550 + 100 + 600 + 100)
})

test('product aggregates exclude cancelled quantity from qtySold', () => {
  const r = makeReport()
  const p1 = r.byProduct.find((p) => p.product_id === 'p1')
  assert.equal(p1.qtySold, 3) // o1(2) + o4(1); o2 cancelled NOT counted
  assert.equal(p1.qtyCancelled, 1) // o2's quantity counted as cancelled
  const p2 = r.byProduct.find((p) => p.product_id === 'p2')
  assert.equal(p2.qtySold, 4) // o1(1) + o3(3)
})

test('delivered product quantity', () => {
  const r = makeReport()
  assert.equal(r.summary.totalDeliveredProducts, 6) // o1(3) + o3(3)
  assert.equal(r.summary.deliveredOrders, 2)
})

test('status and payment KPIs', () => {
  const r = makeReport()
  assert.equal(r.summary.pendingOrders, 1)
  assert.equal(r.summary.cancelledOrders, 1)
  assert.equal(r.summary.returnedOrders, 0)
  assert.equal(r.summary.paidOrders, 2)
  assert.equal(r.summary.unpaidOrders, 2)
})

test('customer KPIs and types', () => {
  const r = makeReport()
  assert.equal(r.summary.uniqueCustomers, 2) // u1, u3 (active); u2 only cancelled
  assert.equal(r.summary.newCustomers, 2)
  const u1 = r.byCustomer.find((c) => c.customer_id === 'u1')
  assert.equal(u1.totalOrders, 2)
})

test('GST math: same-state splits CGST+SGST, cross-state uses IGST', () => {
  const r = makeReport()
  assert.ok(r.summary.totalGST > 0)
  // o1 line p1 (Maharashtra, 12%): IGST must be 0, CGST=SGST
  const mhLine = r.gstReport.find((g) => g.order_number === 'AK0001' && g.hsn_code === '4820')
  assert.equal(mhLine.igst, 0)
  assert.ok(mhLine.cgst > 0)
  assert.equal(mhLine.cgst, mhLine.sgst)
  // o2 line p1 (Karnataka, 12%): CGST=0, IGST full
  const kaLine = r.gstReport.find((g) => g.order_number === 'AK0002')
  assert.equal(kaLine.cgst, 0)
  assert.ok(kaLine.igst > 0)
})

test('reconciliation matches the Orders page logic', () => {
  const r = makeReport()
  const rec = r.reconciliation
  assert.equal(rec.ordersPageRevenue, 1250) // 550 + 600 + 100 (cancelled excluded)
  assert.equal(rec.reportNetRevenue, 1250)
  assert.equal(rec.revenueMatches, true)
})

test('date grouping by day and month (IST)', () => {
  const r = makeReport()
  // orders are at 10:00 IST on Aug 1, 2, 5, 10 → 3 distinct active days in byDate
  assert.equal(r.byDate.length, 3)
  const monthFilters = normalizeFilters({ range: 'custom', start_date: '2026-08-01', end_date: '2026-08-31', group_by: 'month' })
  const rm = buildReport({ orders, allProducts: products, categories, firstOrderByUser, filters: monthFilters, scope })
  assert.equal(rm.byDate.length, 1)
  assert.equal(rm.byDate[0].period, 'Aug 2026')
})

test('average order value is net revenue / active orders', () => {
  const r = makeReport()
  assert.equal(r.summary.avgOrderValue, round2(1250 / 3))
})

test('round2 is decimal-safe', () => {
  assert.equal(round2(0.1 + 0.2), 0.3)
  assert.equal(round2(19.995), 20)
})
