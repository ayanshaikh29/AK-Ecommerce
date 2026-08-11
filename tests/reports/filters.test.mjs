import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFilters, ORDER_STATUSES, REVENUE_EXCLUDED_STATUSES } from '../../lib/reports/filters.js'
import { getDateRange, toISTParts } from '../../lib/date-helpers.js'

// Parse an ISO instant as IST calendar parts {year, month(1-indexed), day}.
const ist = (iso) => toISTParts(new Date(iso))

// Fixed "now" so tests are deterministic (2026-08-11 10:00 UTC = 15:30 IST)
const NOW = new Date('2026-08-11T10:00:00Z')

test('defaults to last-30-days when no range given', () => {
  const f = normalizeFilters({})
  assert.equal(f.range, 'last-30-days')
  assert.ok(f.startISO)
  assert.ok(f.endExclusive)
})

test('half-open range includes the ENTIRE end date', () => {
  const f = normalizeFilters({ range: 'custom', start_date: '2026-08-01', end_date: '2026-08-10' })
  const endInclusive = new Date(f.endDate).getTime()
  const endExclusiveMs = new Date(f.endExclusive).getTime()
  assert.ok(endExclusiveMs > endInclusive, 'endExclusive must be after endDate')
  // An order at 23:59:59.500 IST on the end date falls in [start, endExclusive)
  const lateOrder = new Date('2026-08-10T18:29:59.500Z').getTime() // = 23:59:59 IST
  assert.ok(lateOrder >= new Date(f.startISO).getTime())
  assert.ok(lateOrder < endExclusiveMs, 'end-date order must be included')
})

test('prev-week is exactly one week before this week', () => {
  const thisWeek = normalizeFilters({ range: 'this-week' }, NOW)
  const prevWeek = normalizeFilters({ range: 'prev-week' }, NOW)
  const span = new Date(thisWeek.endExclusive).getTime() - new Date(thisWeek.startISO).getTime()
  const prevSpan = new Date(prevWeek.endExclusive).getTime() - new Date(prevWeek.startISO).getTime()
  assert.equal(prevSpan, span)
  // Previous week ends before this week starts
  assert.ok(new Date(prevWeek.endExclusive).getTime() <= new Date(thisWeek.startISO).getTime())
})

test('prev-month returns the full previous calendar month', () => {
  const pm = normalizeFilters({ range: 'prev-month' }, NOW)
  // prev-month of Aug 2026 = July 1 .. Aug 1 (exclusive end), in IST
  assert.deepEqual({ y: ist(pm.startISO).year, m: ist(pm.startISO).month, d: ist(pm.startISO).day }, { y: 2026, m: 7, d: 1 })
  assert.deepEqual({ y: ist(pm.endExclusive).year, m: ist(pm.endExclusive).month, d: ist(pm.endExclusive).day }, { y: 2026, m: 8, d: 1 })
})

test('this-quarter spans the calendar quarter start', () => {
  const q = normalizeFilters({ range: 'this-quarter' }, NOW)
  // Q3 of 2026 = July 1 .. Oct 1 (exclusive), in IST
  assert.deepEqual({ y: ist(q.startISO).year, m: ist(q.startISO).month, d: ist(q.startISO).day }, { y: 2026, m: 7, d: 1 })
  assert.deepEqual({ y: ist(q.endExclusive).year, m: ist(q.endExclusive).month, d: ist(q.endExclusive).day }, { y: 2026, m: 10, d: 1 })
})

test('this-year and prev-year boundaries', () => {
  const y = normalizeFilters({ range: 'this-year' }, NOW)
  assert.equal(ist(y.startISO).year, 2026)
  assert.equal(ist(y.startISO).month, 1)
  assert.equal(ist(y.endExclusive).year, 2027)
  const py = normalizeFilters({ range: 'prev-year' }, NOW)
  assert.equal(ist(py.startISO).year, 2025)
  assert.equal(ist(py.endExclusive).year, 2026)
})

test('custom range bounds', () => {
  const f = normalizeFilters({ range: 'custom', start_date: '2026-08-01', end_date: '2026-08-31' })
  assert.deepEqual({ y: ist(f.startISO).year, m: ist(f.startISO).month, d: ist(f.startISO).day }, { y: 2026, m: 8, d: 1 })
  // endExclusive = Sep 1 IST
  assert.deepEqual({ y: ist(f.endExclusive).year, m: ist(f.endExclusive).month, d: ist(f.endExclusive).day }, { y: 2026, m: 9, d: 1 })
})

test('status whitelist rejects unknown statuses', () => {
  const f = normalizeFilters({ status: 'evil-status' })
  assert.equal(f.status, 'all')
  assert.ok(ORDER_STATUSES.includes('delivered'))
  assert.ok(ORDER_STATUSES.includes('pending_vendor_acceptance'))
})

test('REVENUE_EXCLUDED_STATUSES does not include pending or delivered', () => {
  assert.equal(REVENUE_EXCLUDED_STATUSES.has('pending'), false)
  assert.equal(REVENUE_EXCLUDED_STATUSES.has('delivered'), false)
  assert.equal(REVENUE_EXCLUDED_STATUSES.has('cancelled'), true)
  assert.equal(REVENUE_EXCLUDED_STATUSES.has('returned'), true)
})

test('group_by is validated', () => {
  assert.equal(normalizeFilters({ group_by: 'month' }).group_by, 'month')
  assert.equal(normalizeFilters({ group_by: 'nonsense' }).group_by, 'day')
})

test('limit and page are clamped', () => {
  assert.equal(normalizeFilters({ limit: '9999' }).limit, 500)
  assert.equal(normalizeFilters({ page: '0' }).page, 1)
})

test('this-week range helper is still deterministic via date-helpers', () => {
  const g = getDateRange('this-week', null, null, NOW)
  assert.ok(g.start)
  assert.ok(g.end >= g.start)
})
