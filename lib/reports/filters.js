// ================================================================
// ReportFilterService
// ----------------------------------------------------------------
// Single place that validates + normalizes every report filter sent
// from the frontend. Whitelists are enforced here — unknown/blank
// values are dropped or rejected, never trusted.
//
// All dates are interpreted in Asia/Kolkata (IST). The date filter is
// applied as a HALF-OPEN range [startOfStartDay, startOfNextDayAfterEnd)
// so orders placed anywhere on the end date are always included.
// ================================================================
import { getDateRange, parseISTDate, IST_TIMEZONE, toISTParts, utcStartOfISTDay } from '../date-helpers.js'

export const REPORT_TIMEZONE = IST_TIMEZONE
export const CURRENCY = 'INR'

// Valid order statuses (must match the DB CHECK constraint + legacy values)
export const ORDER_STATUSES = [
  'pending',
  'pending_vendor_acceptance',
  'pending_admin_approval',
  'vendor_accepted_pending_admin_approval',
  'admin_rejected',
  'admin_confirmed',
  'confirmed',
  'vendor_assigned',
  'vendor_accepted',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'rejected',
  'cancelled',
  'vendor_rejected',
  'returned'
]

// Groups used by the KPIs / status report
export const STATUS_GROUPS = {
  pending: ['pending', 'pending_vendor_acceptance', 'pending_admin_approval', 'vendor_accepted_pending_admin_approval'],
  processing: ['confirmed', 'admin_confirmed', 'vendor_assigned', 'vendor_accepted', 'packed'],
  shipped: ['shipped', 'out_for_delivery'],
  delivered: ['delivered'],
  cancelled: ['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'],
  returned: ['returned']
}

// Statuses that NEVER contribute to revenue / products / customers
export const REVENUE_EXCLUDED_STATUSES = new Set([
  'cancelled', 'rejected', 'vendor_rejected', 'admin_rejected', 'returned'
])

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Partially Paid', 'Refunded', 'Failed', 'Unpaid']
export const PAYMENT_METHODS = ['COD', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other']

// Quick presets → getDateRange() keys (lib/date-helpers.js)
export const QUICK_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this-week', label: 'Current week' },
  { key: 'prev-week', label: 'Previous week' },
  { key: 'this-month', label: 'Current month' },
  { key: 'prev-month', label: 'Previous month' },
  { key: 'this-quarter', label: 'Current quarter' },
  { key: 'this-year', label: 'Current year' },
  { key: 'prev-year', label: 'Previous year' },
  { key: 'last-7-days', label: 'Last 7 days' },
  { key: 'last-30-days', label: 'Last 30 days' },
  { key: 'last-90-days', label: 'Last 90 days' },
  { key: 'custom', label: 'Custom range' }
]

export const GROUP_BY_OPTIONS = ['day', 'week', 'month', 'quarter', 'year']

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const bool = (v) => v === true || v === 'true' || v === '1' || v === 'on'
const asStringList = (v) => {
  if (!v) return []
  const arr = Array.isArray(v) ? v : String(v).split(',')
  return arr.map(str).filter(Boolean)
}

/**
 * Expand a preset key (incl. prev-week / this-quarter / prev-year etc.)
 * into {start, end} UTC instants via the shared IST-aware helpers.
 */
function resolveRange(range, customStart, customEnd, now = new Date()) {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
  void todayStart

  // getDateRange covers: today, yesterday, this-week, this-month,
  // last-7/30/90-days, last-6/12-months, all, custom.
  switch (range) {
    case 'prev-week': {
      const { start, end } = getDateRange('this-week', null, null, now)
      const span = end.getTime() - start.getTime() + 1
      return { start: new Date(start.getTime() - span), end: new Date(end.getTime() - span) }
    }
    case 'prev-month': {
      // Derive year/month from the IST calendar of the current month's start.
      const { start } = getDateRange('this-month', null, null, now)
      const { year, month } = toISTParts(start) // month 1-indexed, in IST
      const prevStart = utcStartOfISTDay(year, month - 1, 1)
      const prevEnd = new Date(utcStartOfISTDay(year, month, 1).getTime() - 1)
      return { start: prevStart, end: prevEnd }
    }
    case 'this-quarter': {
      const { start } = getDateRange('this-month', null, null, now)
      const { year, month } = toISTParts(start)
      const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1 // 1-indexed
      const qStart = utcStartOfISTDay(year, qStartMonth, 1)
      const qEnd = new Date(utcStartOfISTDay(year, qStartMonth + 3, 1).getTime() - 1)
      return { start: qStart, end: qEnd }
    }
    case 'this-year': {
      const { start } = getDateRange('this-month', null, null, now)
      const { year } = toISTParts(start)
      const yStart = utcStartOfISTDay(year, 1, 1)
      const yEnd = new Date(utcStartOfISTDay(year + 1, 1, 1).getTime() - 1)
      return { start: yStart, end: yEnd }
    }
    case 'prev-year': {
      const { start } = getDateRange('this-month', null, null, now)
      const { year } = toISTParts(start)
      const yStart = utcStartOfISTDay(year - 1, 1, 1)
      const yEnd = new Date(utcStartOfISTDay(year, 1, 1).getTime() - 1)
      return { start: yStart, end: yEnd }
    }
    default:
      return getDateRange(range, customStart, customEnd, now)
  }
}

/**
 * Normalize an arbitrary filters object (from query string or body) into a
 * validated, typed filter object ready for the query service.
 * @param {object} input raw query params / body
 * @param {Date}   [now] reference "now" (defaults to new Date()) — injectable
 *                 for deterministic tests
 */
export function normalizeFilters(input = {}, now = new Date()) {
  const f = {}

  // ---- Date range ----
  const range = str(input.range) || 'last-30-days'
  const customStart = str(input.start_date) || str(input.startDate)
  const customEnd = str(input.end_date) || str(input.endDate)
  const bounds = resolveRange(range, customStart, customEnd, now)
  const startISO = bounds.start ? bounds.start.toISOString() : null
  // Half-open upper bound: end date's next-day start. Orders on the end
  // date are included via `placed_at >= start AND placed_at < endExclusive`.
  const endExclusive = bounds.end ? new Date(bounds.end.getTime() + 1).toISOString() : null
  f.range = range
  f.startISO = startISO
  f.endExclusive = endExclusive
  f.startDate = bounds.start ? bounds.start.toISOString() : null
  f.endDate = bounds.end ? bounds.end.toISOString() : null
  f.days = bounds.days

  // ---- Status / payment / delivery ----
  f.status = str(input.status) || 'all'
  if (f.status !== 'all' && !ORDER_STATUSES.includes(f.status)) f.status = 'all'
  f.payment_status = str(input.payment_status) || 'all'
  if (f.payment_status !== 'all' && !PAYMENT_STATUSES.map((s) => s.toLowerCase()).includes(f.payment_status.toLowerCase())) f.payment_status = 'all'
  f.delivery_status = str(input.delivery_status) || 'all'

  // ---- Product / category / brand / HSN ----
  f.product_id = str(input.product_id) || str(input.product) || ''
  f.category_id = str(input.category_id) || str(input.category) || ''
  f.brand = str(input.brand) || ''
  f.hsn_code = str(input.hsn_code) || str(input.hsn) || ''

  // ---- Customer ----
  f.customer_id = str(input.customer_id) || str(input.customer) || ''
  f.customer_type = str(input.customer_type) || 'all' // new | repeat | dormant | all
  f.search = str(input.search) || '' // free-text order/customer/product search

  // ---- Location ----
  f.country = str(input.country) || ''
  f.state = str(input.state) || ''
  f.city = str(input.city) || ''
  f.pincode = str(input.pincode) || ''

  // ---- Zone ----
  f.zone_id = str(input.zone_id) || str(input.zone) || ''

  // ---- Payment method / sales source / coupon / salesperson ----
  f.payment_method = str(input.payment_method) || 'all'
  f.sales_source = str(input.sales_source) || ''
  f.coupon_code = str(input.coupon_code) || str(input.coupon) || ''
  f.salesperson = str(input.salesperson) || str(input.assigned_salesperson) || ''

  // ---- Grouping / pagination ----
  f.group_by = GROUP_BY_OPTIONS.includes(str(input.group_by)) ? str(input.group_by) : 'day'
  f.page = Math.max(1, parseInt(input.page, 10) || 1)
  f.limit = Math.min(500, Math.max(1, parseInt(input.limit, 10) || 100))
  f.exclude_inactive = bool(input.exclude_inactive)

  return f
}

/** Human-readable date-range label for workbook headers. */
export function dateRangeLabel(f) {
  if (!f.startDate || !f.endDate) return 'All Time'
  const fmt = (iso) => {
    try {
      return new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
    } catch {
      return new Date(iso).toISOString().slice(0, 10)
    }
  }
  return `${fmt(f.startDate)} – ${fmt(f.endDate)}`
}

export { parseISTDate }
