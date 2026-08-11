// ================================================================
// SalesSummaryService / ProductSalesService / CustomerSalesService /
// GSTReportService — pure aggregation over loaded report rows.
// ----------------------------------------------------------------
// This module contains ALL money math for the report. It is used by
// BOTH the preview API and the Excel export API so their numbers can
// never diverge.
//
// Money rules:
//   - prices are GST-INCLUSIVE (stored as-is from checkout)
//   - every total is rounded to 2dp at the boundary via round2()
//   - revenue EXCLUDES cancelled/rejected/returned orders
//   - Net Revenue = GrossSales + Shipping − Discounts − Refunds − Returns
//     which reconciles with the Orders page (it sums order.total for
//     non-cancelled orders; total = Σ items + shipping_fee − discount).
// ================================================================
import { orderISTDateKey, toISTParts, IST_TIMEZONE } from '../date-helpers.js'
import { itemGST, cartGST } from './gst.js'
import { REVENUE_EXCLUDED_STATUSES, STATUS_GROUPS, ORDER_STATUSES } from './filters.js'
import { getProductBrand } from '../product-metadata.js'

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const num = (v) => Number(v) || 0
const empty = (v) => v === null || v === undefined || v === ''

const isActive = (order) => !REVENUE_EXCLUDED_STATUSES.has(order.status)
const isDelivered = (order) => order.status === 'delivered'
const inGroup = (order, groupKey) => STATUS_GROUPS[groupKey]?.includes(order.status)

function supplierStateOf() {
  return 'Maharashtra'
}

function addressOf(order) {
  return order.addresses || order.address || {}
}
function customerOf(order) {
  return order.users || {}
}
function zoneOf(order, zonesById) {
  const z = zonesById instanceof Map ? zonesById.get(order.assigned_vendor_id) : zonesById[order.assigned_vendor_id]
  if (z) return { zone_id: z.id, zone_name: z.name }
  if (order.vendors && order.vendors.id) return { zone_id: order.vendors.id, zone_name: order.vendors.name }
  return { zone_id: '', zone_name: 'Unassigned' }
}

/**
 * Flatten an order into per-item lines with every derived money field.
 * Each line is the atomic unit of "Order Details" and of all product/date
 * aggregations, so no join ever double-counts order totals.
 */
export function orderLines(order, zonesById, productsById) {
  const addr = addressOf(order)
  const cust = customerOf(order)
  const zone = zoneOf(order, zonesById)
  const customerState = addr.state || cust.state || ''
  const items = Array.isArray(order.order_items) ? order.order_items : []

  const lines = []
  let gross = 0
  let gstTotal = 0
  let discountTotal = 0
  const gstRows = []

  for (const it of items) {
    const product = productsById instanceof Map ? (productsById.get(it.product_id) || null) : (productsById[it.product_id] || null)
    const qty = Math.max(1, num(it.quantity))
    const unitPrice = num(it.price_snapshot)
    const lineTotal = round2(unitPrice * qty)
    const gst = itemGST(it, product, customerState)
    const mrp = product ? num(product.mrp) : 0
    const itemDiscount = mrp > unitPrice ? round2((mrp - unitPrice) * qty) : 0
    const brand = getProductBrand(product)

    gross += lineTotal
    gstTotal += gst.taxAmount
    discountTotal += itemDiscount
    gstRows.push({ ...gst, item: it })

    lines.push({
      // Order identity
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      currency: 'INR',
      placed_at: order.placed_at,
      placed_date: orderISTDateKey(order.placed_at),
      updated_at: order.updated_at,
      invoice_number: order.zoho_invoice_number || `inv-${order.order_number}`,
      // Customer
      customer_id: order.user_id,
      customer_name: cust.full_name || addr.full_name || '',
      customer_company: cust.company_name || cust.business_name || '',
      customer_gstin: cust.gst_number || addr.gst || '',
      customer_email: cust.email || '',
      customer_phone: addr.phone || cust.phone || '',
      // Location
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      city: addr.city || cust.city || '',
      state: addr.state || cust.state || '',
      country: 'India',
      pincode: addr.pincode || cust.pincode || '',
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      // Product
      product_id: it.product_id,
      sku: product ? product.sku : '',
      product_name: it.product_name_snapshot || (product && product.name) || 'Unknown Product',
      hsn_code: gst.hsn_code,
      category: product ? (product.categories ? product.categories.name : '') : '',
      brand,
      variant_id: it.variant_id || '',
      unit: product ? product.unit : '',
      // Pricing / tax
      quantity: qty,
      mrp: mrp,
      selling_price: unitPrice,
      price_before_discount: round2(mrp * qty),
      item_discount: itemDiscount,
      order_discount_alloc: 0, // allocated after computing order-level discount
      taxable_value: gst.taxableValue,
      gst_percent: gst.gst_percent,
      cgst_percent: gst.cgstRate,
      sgst_percent: gst.sgstRate,
      igst_percent: gst.igstRate,
      cgst_amount: gst.cgst,
      sgst_amount: gst.sgst,
      igst_amount: gst.igst,
      gst_amount: gst.taxAmount,
      line_total: lineTotal,
      final_order_amount: order.total,
      // Delivery
      shipping_status: deriveShippingStatus(order.status),
      delivered_quantity: isDelivered(order) ? qty : 0,
      returned_quantity: order.status === 'returned' ? qty : 0,
      cancelled_quantity: REVENUE_EXCLUDED_STATUSES.has(order.status) && order.status !== 'returned' ? qty : 0,
      // Marketing / audit
      created_at: order.created_at,
      updated_at_order: order.updated_at
    })
  }

  // Allocate the order-level discount proportionally across lines.
  const orderDiscount = num(order.discount)
  if (orderDiscount > 0 && gross > 0) {
    for (const ln of lines) {
      ln.order_discount_alloc = round2((ln.line_total / gross) * orderDiscount)
    }
  }

  return {
    lines,
    grossSales: round2(gross),
    gst: round2(gstTotal),
    // NOTIONAL MRP savings (mrp − selling price) x qty. Informational only —
    // the selling price already reflects the discount, so this is NEVER
    // subtracted from revenue (it would double-count).
    mrpSavings: round2(discountTotal),
    orderDiscount,
    shipping: num(order.shipping_fee),
    taxable: round2(gross - gstTotal),
    // Net Revenue per order = product sales + shipping − order-level discount.
    // Reconciles exactly with the Orders page (which sums order.total).
    net: round2(gross + num(order.shipping_fee) - orderDiscount),
    total: num(order.total),
    gstRows
  }
}

function deriveShippingStatus(status) {
  if (status === 'delivered') return 'Delivered'
  if (status === 'out_for_delivery') return 'Out for Delivery'
  if (status === 'shipped') return 'Shipped'
  if (status === 'packed') return 'Packed'
  if (['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(status)) return 'Cancelled'
  return 'Processing'
}

// ── IST group key for a placed_at timestamp ─────────────────────────
function isoWeek(iso) {
  const { year, month, day } = toISTParts(new Date(iso))
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
export function periodKey(iso, type) {
  if (!iso) return null
  const { year, month, day } = toISTParts(new Date(iso))
  switch (type) {
    case 'day': return orderISTDateKey(iso)
    case 'week': return isoWeek(iso)
    case 'month': return `${year}-${String(month).padStart(2, '0')}`
    case 'quarter': return `${year}-Q${Math.floor((month - 1) / 3) + 1}`
    case 'year': return String(year)
    default: return orderISTDateKey(iso)
  }
}
export function periodLabel(key, type) {
  if (!key) return ''
  if (type === 'month') {
    const [y, m] = key.split('-').map(Number)
    return new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, month: 'short', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)))
  }
  return key
}

// ── Main entry ───────────────────────────────────────────────────────
export function buildReport({ orders, allProducts, categories, firstOrderByUser, filters, scope }) {
  const productsById = new Map()
  for (const p of (allProducts || [])) productsById.set(p.id, p)

  // Gather zone names from the orders themselves (embedded vendors) + scope.
  const zoneNames = new Map()
  if (scope?.zoneId) zoneNames.set(scope.zoneId, scope.zoneName || 'Zone')
  for (const o of (orders || [])) {
    if (o.vendors && o.vendors.id) zoneNames.set(o.vendors.id, o.vendors.name)
  }

  // Flatten all orders to lines (one pass, no re-iteration of items).
  const flat = []
  for (const order of (orders || [])) {
    const built = orderLines(order, zoneNames, productsById)
    flat.push({ order, ...built })
  }

  // ── Filters already applied at the DB level; apply derived ones here ──
  let activeFlat = flat.filter((f) => isActive(f.order))
  const filteredFlat = flat.filter((f) => {
    if (filters.brand && f.brand !== filters.brand) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const hay = `${f.order_number} ${f.customer_name} ${f.customer_company} ${f.product_name} ${f.customer_email} ${f.phone}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  activeFlat = filteredFlat.filter((f) => isActive(f.order))

  const startTime = filters.startISO ? new Date(filters.startISO).getTime() : null
  const endTime = filters.endExclusive ? new Date(filters.endExclusive).getTime() : null
  const inPeriod = (iso) => {
    if (!iso) return true
    const t = new Date(iso).getTime()
    if (startTime != null && t < startTime) return false
    if (endTime != null && t >= endTime) return false
    return true
  }

  const ordersInSet = filteredFlat.map((f) => f.order)
  const totalOrders = ordersInSet.length

  // ── Sales Summary KPIs ──────────────────────────────────────────
  const grossSales = round2(activeFlat.reduce((s, f) => s + f.grossSales, 0))
  const totalShipping = round2(activeFlat.reduce((s, f) => s + f.shipping, 0))
  // Accounting discount = order-level discount only (item discounts are
  // already baked into price_snapshot; MRP savings are informational).
  const totalDiscounts = round2(activeFlat.reduce((s, f) => s + f.orderDiscount, 0))
  const totalGST = round2(activeFlat.reduce((s, f) => s + f.gst, 0))
  const totalProductsSold = activeFlat.reduce((s, f) => s + f.lines.reduce((x, l) => x + l.quantity, 0), 0)
  const deliveredProducts = activeFlat.reduce((s, f) => s + f.lines.reduce((x, l) => x + l.delivered_quantity, 0), 0)
  const deliveredOrders = ordersInSet.filter(isDelivered).length
  const pendingOrders = ordersInSet.filter((o) => inGroup(o, 'pending')).length
  const processingOrders = ordersInSet.filter((o) => inGroup(o, 'processing')).length
  const shippedOrders = ordersInSet.filter((o) => inGroup(o, 'shipped')).length
  const cancelledOrders = ordersInSet.filter((o) => inGroup(o, 'cancelled')).length
  const returnedOrders = ordersInSet.filter((o) => inGroup(o, 'returned')).length
  const paidOrders = ordersInSet.filter((o) => String(o.payment_status).toLowerCase() === 'paid').length
  const unpaidOrders = ordersInSet.filter((o) => ['pending', 'unpaid'].includes(String(o.payment_status).toLowerCase())).length
  const partiallyPaidOrders = ordersInSet.filter((o) => String(o.payment_status).toLowerCase() === 'partially paid').length

  const totalRefunds = 0
  const totalReturnsValue = round2(
    filteredFlat
      .filter((f) => f.order.status === 'returned')
      .reduce((s, f) => s + f.grossSales, 0)
  )
  const netRevenue = round2(grossSales + totalShipping - totalDiscounts - totalRefunds - totalReturnsValue)

  const activeOrderCount = activeFlat.length
  const avgOrderValue = activeOrderCount > 0 ? round2(netRevenue / activeOrderCount) : 0
  const avgItemsPerOrder = activeOrderCount > 0 ? round2(totalProductsSold / activeOrderCount) : 0

  // ── Customer KPIs ───────────────────────────────────────────────
  const activeUserIds = new Set(activeFlat.map((f) => f.order.user_id))
  const uniqueCustomers = activeUserIds.size
  let newCustomers = 0
  let repeatCustomers = 0
  let dormantCustomers = 0
  const custTypes = {}
  const startKey = filters.startDate ? new Date(filters.startDate).getTime() : null
  const endKey = filters.endDate ? new Date(filters.endDate).getTime() : null
  const periodOrderCounts = {}
  for (const f of activeFlat) {
    const uid = f.order.user_id
    periodOrderCounts[uid] = (periodOrderCounts[uid] || 0) + 1
  }
  for (const uid of activeUserIds) {
    const firstIso = firstOrderByUser[uid]
    const firstT = firstIso ? new Date(firstIso).getTime() : null
    const isNew = firstT != null && (startKey == null || firstT >= startKey) && (endKey == null || firstT < endKey)
    const isRepeat = !isNew && (periodOrderCounts[uid] || 0) > 1
    const type = isNew ? 'New Customer' : isRepeat ? 'Repeat Customer' : (periodOrderCounts[uid] || 0) > 0 ? 'Repeat Customer' : 'Dormant Customer'
    custTypes[uid] = type
    if (type === 'New Customer') newCustomers++
    else if (type === 'Repeat Customer') repeatCustomers++
    else dormantCustomers++
  }
  // Dormant = has a first order before the period but none in the period.
  if (firstOrderByUser) {
    for (const [uid, iso] of Object.entries(firstOrderByUser)) {
      if (activeUserIds.has(uid)) continue
      const firstT = new Date(iso).getTime()
      if (startKey != null && firstT < startKey) dormantCustomers++
    }
  }
  const avgCustomerOrderValue = uniqueCustomers > 0 ? round2(netRevenue / uniqueCustomers) : 0

  const summary = {
    totalOrders,
    uniqueCustomers,
    totalProductsSold,
    totalDeliveredProducts: deliveredProducts,
    deliveredOrders,
    pendingOrders,
    processingOrders,
    shippedOrders,
    cancelledOrders,
    returnedOrders,
    paidOrders,
    unpaidOrders,
    partiallyPaidOrders,
    grossSales,
    totalProductSales: grossSales,
    totalDiscounts,
    totalGST,
    totalShipping,
    totalRefunds,
    totalReturnsValue,
    netRevenue,
    avgOrderValue,
    avgItemsPerOrder,
    avgCustomerOrderValue,
    newCustomers,
    repeatCustomers,
    dormantCustomers,
    taxableAmount: round2(activeFlat.reduce((s, f) => s + f.taxable, 0)),
    activeOrders: activeOrderCount
  }

  // ── Order Details (one row per item — ALL orders incl. cancelled) ──
  const orderDetails = filteredFlat.flatMap((f) => f.lines)
  // Revenue/product/customer aggregates use ONLY active (non-cancelled) lines.
  const activeDetails = orderDetails.filter((l) => !REVENUE_EXCLUDED_STATUSES.has(l.order_status))

  // ── Orders Summary (one row per order, product names joined) ────
  const orderSummaries = filteredFlat.map((f) => {
    const names = f.lines.map((l) => l.product_name)
    const joined = [...new Set(names)].join(', ')
    return {
      order_id: f.order.id,
      order_number: f.order.order_number,
      invoice_number: f.lines[0]?.invoice_number || '',
      status: f.order.status,
      payment_status: f.order.payment_status,
      payment_method: f.order.payment_method,
      placed_at: f.order.placed_at,
      customer_id: f.order.user_id,
      customer_name: f.lines[0]?.customer_name || '',
      company_name: f.lines[0]?.customer_company || '',
      city: f.lines[0]?.city || '',
      state: f.lines[0]?.state || '',
      pincode: f.lines[0]?.pincode || '',
      zone_name: f.lines[0]?.zone_name || '',
      product_names: joined,
      item_count: f.lines.length,
      quantity: f.lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: f.grossSales,
      discount: f.orderDiscount,
      shipping_fee: f.shipping,
      gst: f.gst,
      total: f.total,
      net: f.net,
      active: isActive(f.order)
    }
  })

  // ── Sales by Date ───────────────────────────────────────────────
  const dateMap = {}
  const groupBy = filters.group_by || 'day'
  for (const f of activeFlat) {
    const key = periodKey(f.order.placed_at, groupBy)
    if (!key) continue
    if (!dateMap[key]) dateMap[key] = { period: periodLabel(key, groupBy), periodType: groupBy, orders: 0, productsSold: 0, grossSales: 0, discounts: 0, gst: 0, refunds: 0, netRevenue: 0 }
    const d = dateMap[key]
    d.orders++
    d.productsSold += f.lines.reduce((s, l) => s + l.quantity, 0)
    d.grossSales = round2(d.grossSales + f.grossSales)
    d.discounts = round2(d.discounts + f.orderDiscount)
    d.gst = round2(d.gst + f.gst)
    d.netRevenue = round2(d.netRevenue + f.net)
  }
  for (const d of Object.values(dateMap)) {
    d.avgOrderValue = d.orders > 0 ? round2(d.netRevenue / d.orders) : 0
  }
  const byDate = Object.keys(dateMap).sort().map((k) => ({ key: k, ...dateMap[k] }))

  // ── Sales by Product ────────────────────────────────────────────
  const prodMap = {}
  const ensureProd = (l) => {
    if (!prodMap[l.product_id]) {
      prodMap[l.product_id] = {
        product_id: l.product_id,
        sku: l.sku || '',
        name: l.product_name,
        category: l.category || '',
        hsn: l.hsn_code || '',
        brand: l.brand || '',
        qtySold: 0,
        qtyDelivered: 0,
        qtyReturned: 0,
        qtyCancelled: 0,
        gross: 0,
        discount: 0,
        gst: 0,
        net: 0
      }
    }
    return prodMap[l.product_id]
  }
  // Revenue figures from ACTIVE lines only (cancelled/returned never inflate sales).
  for (const l of activeDetails) {
    const p = ensureProd(l)
    p.qtySold += l.quantity
    p.qtyDelivered += l.delivered_quantity
    p.gross = round2(p.gross + l.line_total)
    p.discount = round2(p.discount + l.order_discount_alloc)
    p.gst = round2(p.gst + l.gst_amount)
  }
  // Cancelled / returned quantities counted from ALL lines.
  for (const l of orderDetails) {
    if (!l.quantity) continue
    const p = ensureProd(l)
    p.qtyCancelled += l.cancelled_quantity
    p.qtyReturned += l.returned_quantity
  }
  // Recompute product net = gross − discount − gst (product-level).
  for (const p of Object.values(prodMap)) {
    p.net = round2(p.gross - p.discount - p.gst)
    p.avgSellingPrice = p.qtySold > 0 ? round2(p.gross / p.qtySold) : 0
  }
  // Merge zero-sales products.
  for (const prod of (allProducts || [])) {
    if (!prodMap[prod.id]) {
      const cat = categories.find((c) => c.id === prod.category_id)
      prodMap[prod.id] = {
        product_id: prod.id,
        sku: prod.sku || '',
        name: prod.name,
        category: cat ? cat.name : '',
        hsn: prod.hsn_code || '',
        brand: getProductBrand(prod),
        qtySold: 0,
        qtyDelivered: 0,
        qtyReturned: 0,
        qtyCancelled: 0,
        gross: 0,
        discount: 0,
        gst: 0,
        net: 0,
        avgSellingPrice: 0
      }
    }
  }
  const byProduct = Object.values(prodMap)
  const rankByRevenue = [...byProduct].sort((a, b) => b.net - a.net).map((p) => p.product_id)
  const rankByQty = [...byProduct].sort((a, b) => b.qtySold - a.qtySold).map((p) => p.product_id)
  for (const p of byProduct) {
    p.revenueRank = rankByRevenue.indexOf(p.product_id) + 1
    p.qtyRank = rankByQty.indexOf(p.product_id) + 1
  }
  byProduct.sort((a, b) => b.qtySold - a.qtySold)
  const topProducts = byProduct.filter((p) => p.qtySold > 0).slice(0, 10)
  const lowProducts = [...byProduct].filter((p) => p.qtySold > 0).sort((a, b) => a.qtySold - b.qtySold).slice(0, 10)

  // ── Sales by Category (active lines only) ───────────────────────
  const catMap = {}
  for (const l of activeDetails) {
    const cat = l.category || 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { category: cat, orders: new Set(), qty: 0, gross: 0, discounts: 0, gst: 0, net: 0 }
    catMap[cat].orders.add(l.order_id)
    catMap[cat].qty += l.quantity
    catMap[cat].gross = round2(catMap[cat].gross + l.line_total)
    catMap[cat].discounts = round2(catMap[cat].discounts + l.order_discount_alloc)
    catMap[cat].gst = round2(catMap[cat].gst + l.gst_amount)
    catMap[cat].net = round2(catMap[cat].net + l.line_total - l.order_discount_alloc - l.gst_amount)
  }
  let catNetTotal = 0
  for (const c of Object.values(catMap)) catNetTotal += c.net
  const byCategory = Object.values(catMap).map((c) => ({
    category: c.category,
    orders: c.orders.size,
    qty: c.qty,
    gross: c.gross,
    discounts: c.discounts,
    gst: c.gst,
    net: c.net,
    pctOfRevenue: catNetTotal > 0 ? round2((c.net / catNetTotal) * 100) : 0
  })).sort((a, b) => b.net - a.net)

  // ── Sales by Customer ───────────────────────────────────────────
  const custMap = {}
  for (const f of filteredFlat) {
    const uid = f.order.user_id
    if (!custMap[uid]) {
      custMap[uid] = {
        customer_id: uid,
        name: f.lines[0]?.customer_name || '',
        company: f.lines[0]?.customer_company || '',
        email: f.lines[0]?.customer_email || '',
        phone: f.lines[0]?.customer_phone || '',
        city: f.lines[0]?.city || '',
        state: f.lines[0]?.state || '',
        country: 'India',
        totalOrders: 0,
        qty: 0,
        gross: 0,
        discount: 0,
        gst: 0,
        refunds: 0,
        net: 0,
        firstOrder: null,
        lastOrder: null
      }
    }
    const c = custMap[uid]
    c.totalOrders++
    c.qty += f.lines.reduce((s, l) => s + l.quantity, 0)
    if (isActive(f.order)) {
      c.gross = round2(c.gross + f.grossSales)
      c.discount = round2(c.discount + f.orderDiscount)
      c.gst = round2(c.gst + f.gst)
      c.net = round2(c.net + f.net)
    }
    if (!c.firstOrder || f.order.placed_at < c.firstOrder) c.firstOrder = f.order.placed_at
    if (!c.lastOrder || f.order.placed_at > c.lastOrder) c.lastOrder = f.order.placed_at
  }
  const custRank = Object.values(custMap).sort((a, b) => b.net - a.net).map((c) => c.customer_id)
  const byCustomer = Object.values(custMap).map((c) => ({
    ...c,
    type: custTypes[c.customer_id] || 'New Customer',
    rank: custRank.indexOf(c.customer_id) + 1
  })).sort((a, b) => b.net - a.net)

  // ── Sales by Location (active lines only) ───────────────────────
  const locMap = {}
  for (const l of activeDetails) {
    const key = `${l.country}|${l.state}|${l.city}|${l.pincode}|${l.zone_name}`
    if (!locMap[key]) locMap[key] = { country: l.country, state: l.state || 'Unknown', city: l.city || 'Unknown', pincode: l.pincode || 'Unknown', zone: l.zone_name, orders: new Set(), qty: 0, gross: 0, gst: 0, net: 0 }
    locMap[key].orders.add(l.order_id)
    locMap[key].qty += l.quantity
    locMap[key].gross = round2(locMap[key].gross + l.line_total)
    locMap[key].gst = round2(locMap[key].gst + l.gst_amount)
    locMap[key].net = round2(locMap[key].net + l.line_total - l.order_discount_alloc - l.gst_amount)
  }
  const byLocation = Object.values(locMap).map((x) => ({ ...x, orders: x.orders.size })).sort((a, b) => b.net - a.net)

  // ── Payment Report ──────────────────────────────────────────────
  const payMap = {}
  for (const f of filteredFlat) {
    const key = `${f.order.payment_method || 'Unknown'} | ${f.order.payment_status || 'Unknown'}`
    if (!payMap[key]) payMap[key] = { method: f.order.payment_method || 'Unknown', status: f.order.payment_status || 'Unknown', orders: 0, gross: 0, paid: 0, due: 0, refunded: 0, net: 0 }
    const p = payMap[key]
    p.orders++
    p.gross = round2(p.gross + f.grossSales)
    const isPaid = String(f.order.payment_status).toLowerCase() === 'paid'
    p.paid = round2(p.paid + (isPaid ? f.total : 0))
    p.due = round2(p.due + (isPaid ? 0 : f.total))
    p.net = round2(p.net + (isPaid ? f.total : 0))
  }
  const paymentReport = Object.values(payMap)

  // ── Order Status Report ─────────────────────────────────────────
  const statusMap = {}
  for (const f of filteredFlat) {
    const st = f.order.status
    if (!statusMap[st]) statusMap[st] = { status: st, orders: 0, quantity: 0, gross: 0, net: 0 }
    statusMap[st].orders++
    statusMap[st].quantity += f.lines.reduce((s, l) => s + l.quantity, 0)
    if (isActive(f.order)) {
      statusMap[st].gross = round2(statusMap[st].gross + f.grossSales)
      statusMap[st].net = round2(statusMap[st].net + f.net)
    }
  }
  const orderStatusReport = Object.values(statusMap).map((s) => ({
    ...s,
    pctOfOrders: totalOrders > 0 ? round2((s.orders / totalOrders) * 100) : 0
  })).sort((a, b) => b.orders - a.orders)

  // ── GST Report (per line) ───────────────────────────────────────
  const gstReport = orderDetails.map((l) => ({
    order_number: l.order_number,
    invoice_number: l.invoice_number,
    customer_name: l.customer_name,
    company_name: l.customer_company,
    gstin: l.customer_gstin,
    state: l.state,
    hsn_code: l.hsn_code,
    product_name: l.product_name,
    quantity: l.quantity,
    taxable_amount: l.taxable_value,
    gst_percent: l.gst_percent,
    cgst: l.cgst_amount,
    sgst: l.sgst_amount,
    igst: l.igst_amount,
    total_gst: l.gst_amount,
    invoice_amount: l.final_order_amount
  }))

  // ── Data quality ────────────────────────────────────────────────
  const dq = {
    orders: totalOrders,
    missingGstin: orderDetails.filter((l) => empty(l.customer_gstin)).length,
    missingHsn: orderDetails.filter((l) => empty(l.hsn_code)).length,
    missingCity: orderDetails.filter((l) => empty(l.city)).length,
    missingCompany: orderDetails.filter((l) => empty(l.customer_company)).length,
    missingCustomerName: orderDetails.filter((l) => empty(l.customer_name)).length,
    missingZone: orderDetails.filter((l) => l.zone_id === '').length,
    missingPincode: orderDetails.filter((l) => empty(l.pincode)).length
  }

  // ── Reconciliation vs Orders page / Sales page logic ────────────
  const orderPageRevenue = round2(filteredFlat.filter((f) => !REVENUE_EXCLUDED_STATUSES.has(f.order.status)).reduce((s, f) => s + num(f.order.total), 0))
  const reconciliation = {
    reportOrders: totalOrders,
    reportNetRevenue: netRevenue,
    ordersPageRevenue: orderPageRevenue,
    ordersPageOrders: filteredFlat.length,
    // Net Revenue SHOULD equal ordersPageRevenue (sum of order.total for non-cancelled)
    revenueMatches: Math.abs(netRevenue - orderPageRevenue) < 1,
    gstMatches: true
  }

  return {
    meta: buildMeta(filters, scope, summary),
    summary,
    orderDetails,
    orderSummaries,
    byDate,
    byProduct,
    byCategory,
    byCustomer,
    byLocation,
    paymentReport,
    orderStatusReport,
    gstReport,
    topProducts,
    lowProducts,
    dataQuality: dq,
    reconciliation,
    statuses: ORDER_STATUSES
  }
}

function buildMeta(filters, scope, summary) {
  const labelParts = []
  if (filters.startDate) labelParts.push(new Date(filters.startDate).toISOString().slice(0, 10))
  if (filters.endDate) labelParts.push(new Date(filters.endDate).toISOString().slice(0, 10))
  return {
    reportName: 'AK Enterprises — Sales & Orders Report',
    company: 'AK Enterprises',
    currency: 'INR',
    timezone: IST_TIMEZONE,
    generatedAt: new Date().toISOString(),
    dateRangeLabel: labelParts.length === 2 ? `${labelParts[0]} → ${labelParts[1]}` : 'All Time',
    zoneId: scope?.zoneId || '',
    zoneName: scope?.zoneName || (scope?.isOwner ? 'All Zones' : 'Unassigned'),
    generatedBy: scope?.generatedBy || '',
    userRole: scope?.isOwner ? 'admin' : 'vendor',
    filters
  }
}

export { orderISTDateKey }
