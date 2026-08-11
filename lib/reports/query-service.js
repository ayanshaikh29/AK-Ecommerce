// ================================================================
// OrderReportQueryService
// ----------------------------------------------------------------
// Loads report data straight from the database. All column filters
// (dates, status, payment, zone, product, category, HSN, customer,
// location, payment method) are pushed DOWN into the PostgREST query;
// only derived filters (brand, customer type, free-text search) are
// applied in memory by the aggregation layer.
//
// Zone permission is enforced here, at the query level:
//   - zonal admin → .eq('assigned_vendor_id', vendor.id) (forced)
//   - owner       → optional zone filter, else all zones
// The zone predicate is added to the DB query BEFORE any aggregation.
// ================================================================
import { db } from '../api-auth.js'
import { normalizeFilters } from './filters.js'
import { resolveReportScope } from './permissions.js'
import { buildReport } from './aggregation.js'

const PAYMENT_CASE = { pending: 'Pending', paid: 'Paid', 'partially paid': 'Partially Paid', refunded: 'Refunded', failed: 'Failed', unpaid: 'Unpaid' }

function deliveryStatusToOrderStatuses(ds) {
  const map = {
    delivered: ['delivered'],
    shipped: ['shipped', 'out_for_delivery'],
    packed: ['packed'],
    processing: ['confirmed', 'vendor_assigned', 'vendor_accepted', 'packed', 'vendor_accepted_pending_admin_approval', 'pending_admin_approval', 'pending_vendor_acceptance', 'pending'],
    cancelled: ['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected', 'returned']
  }
  return map[String(ds).toLowerCase()] || null
}

/**
 * Run the full report pipeline for a user + raw query input.
 * Returns the same object for both preview and Excel export.
 */
export async function runReport(user, rawInput = {}) {
  const filters = normalizeFilters(rawInput)
  const scope = await resolveReportScope(user, filters.zone_id)
  const supabase = db()

  // ── 1. Reference data (small, cached per request) ──────────────
  // NOTE: PostgREST cannot embed users/vendors on orders (no FK detected
  // in the schema cache), so we load them once and attach them in JS —
  // this avoids any N+1 while keeping the relations.
  const [{ data: allProducts }, { data: categories }, { data: vendors }, { data: usersList }, { data: firstOrders }] = await Promise.all([
    supabase.from('products').select('*'),
    supabase.from('categories').select('*'),
    supabase.from('vendors').select('*'),
    supabase.from('users').select('id,email,full_name,phone,gst_number,company_name,business_name,city,state,pincode'),
    supabase.from('orders').select('user_id, placed_at').order('placed_at', { ascending: true })
  ])
  const categoriesById = new Map((categories || []).map((c) => [c.id, c]))
  const usersById = new Map((usersList || []).map((u) => [u.id, u]))
  const vendorsById = new Map((vendors || []).map((v) => [v.id, v]))
  for (const p of (allProducts || [])) {
    p.categories = categoriesById.get(p.category_id) || null
  }
  const firstOrderByUser = {}
  for (const o of (firstOrders || [])) {
    if (!firstOrderByUser[o.user_id] || o.placed_at < firstOrderByUser[o.user_id]) firstOrderByUser[o.user_id] = o.placed_at
  }

  // ── 2. Orders query with embedded relations (addresses + items) ──
  const select = ['*,', 'addresses(*),', 'order_items(*, products(*))'].join('')

  let query = supabase.from('orders').select(select)

  // Half-open date range: [start, endExclusive) — includes the whole end day.
  if (filters.startISO) query = query.gte('placed_at', filters.startISO)
  if (filters.endExclusive) query = query.lt('placed_at', filters.endExclusive)

  // Order status
  if (filters.status !== 'all') {
    if (filters.status === 'pending_approval') {
      query = query.in('status', ['vendor_accepted_pending_admin_approval', 'pending_admin_approval', 'vendor_accepted'])
    } else {
      query = query.eq('status', filters.status)
    }
  }

  // Payment status
  if (filters.payment_status !== 'all') {
    const ps = PAYMENT_CASE[String(filters.payment_status).toLowerCase()]
    if (ps) query = query.eq('payment_status', ps)
  }

  // Delivery status → order status set
  if (filters.delivery_status !== 'all') {
    const sts = deliveryStatusToOrderStatuses(filters.delivery_status)
    if (sts) query = query.in('status', sts)
  }

  // ── ZONE SCOPING (authoritative) ────────────────────────────────
  if (scope.zoneId) {
    query = query.eq('assigned_vendor_id', scope.zoneId)
  }

  // Payment method
  if (filters.payment_method !== 'all') {
    query = query.eq('payment_method', filters.payment_method)
  }

  // Customer
  if (filters.customer_id) query = query.eq('user_id', filters.customer_id)

  // Product / category / HSN (embedded-resource filters)
  if (filters.product_id) query = query.eq('order_items.product_id', filters.product_id)
  if (filters.category_id) query = query.eq('order_items.products.category_id', filters.category_id)
  if (filters.hsn_code) query = query.eq('order_items.products.hsn_code', filters.hsn_code)

  // Location (address)
  if (filters.state) query = query.eq('addresses.state', filters.state)
  if (filters.city) query = query.eq('addresses.city', filters.city)
  if (filters.pincode) query = query.eq('addresses.pincode', filters.pincode)

  // Pagination for the raw rows (preview only; export uses all rows).
  const { data: orders, error } = await query.order('placed_at', { ascending: false })
  if (error) {
    throw new Error(`Report query failed: ${error.message}`)
  }

  // Attach customer + zone (vendor) objects resolved from the reference
  // loads above, so aggregation can read them without extra queries.
  for (const o of (orders || [])) {
    o.users = usersById.get(o.user_id) || {}
    o.vendors = vendorsById.get(o.assigned_vendor_id) || null
  }

  // ── 3. Aggregate ────────────────────────────────────────────────
  return buildReport({
    orders: orders || [],
    allProducts: allProducts || [],
    categories: categories || [],
    firstOrderByUser,
    filters,
    scope
  })
}

/** Small wrapper so route handlers can catch cleanly. */
export async function getReport(user, rawInput) {
  try {
    return { ok: true, data: await runReport(user, rawInput) }
  } catch (e) {
    console.error('[Report Query Error]:', e?.message)
    return { ok: false, error: e?.message || 'Report generation failed' }
  }
}
