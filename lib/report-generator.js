import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import 'jspdf-autotable'
import * as XLSXModule from 'xlsx'
const XLSX = XLSXModule.default || XLSXModule
import { getDateRange, toISTDateKey } from './date-helpers'
import { getStatusLabel } from './status-labels'

// ================================================================
// SHARED BRAND CONFIG
// ================================================================
export const REPORT_BRAND = {
  PRIMARY:    [92, 26, 26],
  GOLD:       [201, 150, 44],
  GOLD_LIGHT: [254, 249, 235],
  TEXT_DARK:  [30, 30, 30],
  TEXT_MUTED: [120, 120, 120],
  ROW_ALT:    [249, 248, 246],
  WHITE:      [255, 255, 255],
}

const STATUS_COLORS = {
  delivered:                              { bg: [220, 252, 231], text: [22, 101, 52]   },
  shipped:                                { bg: [219, 234, 254], text: [29, 78, 216]   },
  out_for_delivery:                       { bg: [224, 231, 255], text: [67, 56, 202]   },
  packed:                                 { bg: [254, 249, 195], text: [133, 77, 14]   },
  confirmed:                              { bg: [254, 215, 170], text: [154, 52, 18]   },
  pending:                                { bg: [255, 237, 213], text: [194, 65, 12]   },
  pending_vendor_acceptance:              { bg: [255, 237, 213], text: [194, 65, 12]   },
  pending_admin_approval:                 { bg: [255, 237, 213], text: [194, 65, 12]   },
  vendor_accepted_pending_admin_approval: { bg: [255, 237, 213], text: [194, 65, 12]   },
  cancelled:                              { bg: [254, 226, 226], text: [153, 27, 27]   },
  rejected:                               { bg: [254, 226, 226], text: [153, 27, 27]   },
  vendor_rejected:                        { bg: [254, 226, 226], text: [153, 27, 27]   },
  admin_rejected:                         { bg: [254, 226, 226], text: [153, 27, 27]   },
}

function safeAutoTable(doc, options) {
  try {
    const result = autoTable(doc, options)
    if (result && typeof result.finalY === 'number') return result.finalY
  } catch (err) {
    console.error('[safeAutoTable] autoTable() threw:', err.message)
  }
  if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
    return doc.lastAutoTable.finalY
  }
  const rowCount = (options.body || []).length
  return (options.startY || 50) + 10 + rowCount * 7
}

export function resolveDateRange(rangeKey, customStart, customEnd) {
  const { start, end } = getDateRange(rangeKey, customStart, customEnd)
  return { start, end }
}

// ================================================================
// HELPERS — Safe value extraction from Supabase data
// ================================================================
function safe(val, fallback = '') {
  return val !== null && val !== undefined ? val : fallback
}

function safeNum(val, fallback = 0) {
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function formatDate(isoStr) {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '' }
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

function formatDateTime(isoStr) {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

// ================================================================
// buildReportData — Legacy function for backward compatibility
// ================================================================
export function buildReportData(orders, opts = {}) {
  const { role = 'admin', reportTitle = 'Sales Report', entityName = 'All Orders', range } = opts
  const orderList = Array.isArray(orders) ? orders : []

  const totalOrders    = orderList.length
  const delivered      = orderList.filter(o => o.status === 'delivered').length
  const packed         = orderList.filter(o => o.status === 'packed').length
  const shipped        = orderList.filter(o => o.status === 'shipped').length
  const outForDelivery = orderList.filter(o => o.status === 'out_for_delivery').length
  const confirmed      = orderList.filter(o => o.status === 'confirmed').length
  const pending = orderList.filter(o =>
    ['pending', 'pending_vendor_acceptance', 'pending_admin_approval',
     'vendor_accepted_pending_admin_approval'].includes(o.status)
  ).length
  const cancelled = orderList.filter(o =>
    ['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)
  ).length

  const activeOrders  = orderList.filter(o =>
    !['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)
  )
  const totalRevenue  = activeOrders.reduce((s, o) => s + (o.total || 0), 0)
  const avgOrderValue = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0

  let totalQty = 0
  orderList.forEach(o => { (o.order_items || []).forEach(it => { totalQty += it.quantity || 0 }) })

  const productCounts = {}, productRevenue = {}
  orderList.forEach(o => {
    ;(o.order_items || []).forEach(it => {
      const name = it.product_name_snapshot || 'Unknown Product'
      productCounts[name]  = (productCounts[name]  || 0) + (it.quantity || 0)
      productRevenue[name] = (productRevenue[name] || 0) + (it.price_snapshot || 0) * (it.quantity || 0)
    })
  })
  const productWise = Object.keys(productCounts)
    .map(name => ({ name, quantity: productCounts[name], revenue: productRevenue[name] }))
    .sort((a, b) => b.quantity - a.quantity)

  const customerCounts = {}, customerRevenue = {}
  orderList.forEach(o => {
    const clientName = o.customer_profile?.business_name || o.customer_profile?.company_name
      || o.addresses?.business_name || o.addresses?.full_name
      || o.customer_profile?.full_name || 'Unknown'
    customerCounts[clientName]  = (customerCounts[clientName]  || 0) + 1
    customerRevenue[clientName] = (customerRevenue[clientName] || 0) + (o.total || 0)
  })
  const customerWise = Object.keys(customerCounts)
    .map(name => ({ name, orders: customerCounts[name], revenue: customerRevenue[name] }))
    .sort((a, b) => b.revenue - a.revenue)

  const vendorCounts = {}, vendorRevenue = {}
  let vendorWise = []
  if (role === 'admin') {
    orderList.forEach(o => {
      const vName = o.vendor_name || 'Unassigned'
      vendorCounts[vName]  = (vendorCounts[vName]  || 0) + 1
      vendorRevenue[vName] = (vendorRevenue[vName] || 0) + (o.total || 0)
    })
    vendorWise = Object.keys(vendorCounts)
      .map(name => ({ name, orders: vendorCounts[name], revenue: vendorRevenue[name] }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  const monthly = {}
  orderList.forEach(o => {
    const monthKey = toISTDateKey(new Date(o.placed_at || Date.now())).slice(0, 7)
    if (!monthly[monthKey]) monthly[monthKey] = { orders: 0, revenue: 0 }
    monthly[monthKey].orders++
    if (!['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)) {
      monthly[monthKey].revenue += o.total || 0
    }
  })
  const monthlyData = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, orders: d.orders, revenue: Math.round(d.revenue * 100) / 100 }))

  let rangeLabel = 'All Time'
  if (range?.start && range?.end) {
    const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    rangeLabel = `${fmt(range.start)} to ${fmt(range.end)}`
  } else if (range?.start) {
    rangeLabel = `From ${new Date(range.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  } else if (range?.end) {
    rangeLabel = `Up to ${new Date(range.end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  return {
    reportTitle, entityName, role, rangeLabel,
    counts: { totalOrders, delivered, packed, shipped, outForDelivery, confirmed, pending, cancelled, avgOrderValue: Math.round(avgOrderValue), totalQty },
    revenue: { totalRevenue: Math.round(totalRevenue * 100) / 100 },
    productWise, customerWise, vendorWise, monthlyData,
    orders: orderList.map(o => {
      const addressObj = o.addresses || {}
      const city     = addressObj.city  || o.customer_profile?.city  || ''
      const state    = addressObj.state || o.customer_profile?.state || ''
      const location = [city, state].filter(Boolean).join(', ') || 'N/A'
      const gstin    = addressObj.gst || 'N/A'

      const itemsList = (o.order_items || []).map(it => {
        const hsn = it.products?.hsn_code || '—'
        const cat = it.products?.categories?.name || '—'
        return {
          productName: it.product_name_snapshot || 'Unknown Product',
          quantity: it.quantity || 0,
          price: it.price_snapshot || 0,
          total: (it.price_snapshot || 0) * (it.quantity || 0),
          hsn,
          category: cat
        }
      })

      return {
        orderNumber: o.order_number,
        date:     o.placed_at,
        customer: o.customer_profile?.business_name || o.customer_profile?.company_name
          || addressObj.business_name || addressObj.full_name
          || o.customer_profile?.full_name || 'Guest',
        location,
        gstin,
        vendor:   o.vendor_name || 'N/A',
        status:   o.status,
        total:    o.total || 0,
        itemsSummary: (o.order_items || []).map(it => `${it.product_name_snapshot} x${it.quantity}`).join(', '),
        items: itemsList
      }
    })
  }
}

// ================================================================
// generateReportPDF — Legacy PDF generation (backward compat)
// ================================================================
export function generateReportPDF(data, opts = {}) {
  const { PRIMARY, GOLD, GOLD_LIGHT, TEXT_DARK, TEXT_MUTED, ROW_ALT, WHITE } = REPORT_BRAND
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PW = 297, PH = 210
  const ML = 14, MR = PW - 14

  const generatedAt = new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  function drawFooter(pageNum, totalPages) {
    const y = PH - 8
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text('This is a computer-generated report. AK Enterprises - Confidential.', ML, y)
    doc.text(`Page ${pageNum} of ${totalPages}`, MR, y, { align: 'right' })
    doc.setDrawColor(220, 220, 220)
    doc.line(ML, y - 3, MR, y - 3)
  }

  function drawSectionHeading(text, y) {
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...PRIMARY)
    doc.text(text, ML, y)
    doc.setDrawColor(...PRIMARY)
    doc.setLineWidth(0.4)
    doc.line(ML, y + 1.5, MR, y + 1.5)
    doc.setLineWidth(0.2)
    doc.setDrawColor(200, 200, 200)
    return y + 6
  }

  const tableStyle = {
    theme: 'grid',
    headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: ROW_ALT },
    styles: { fontSize: 7.5, font: 'Helvetica', cellPadding: 2.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
    margin: { left: ML, right: PW - MR },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.3
  }

  // Header
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, PW, 38, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 38, PW, 1.5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(data.reportTitle || 'Sales Report', ML, 16)
  doc.setFontSize(9)
  doc.setFont('Helvetica', 'normal')
  doc.text(`${data.entityName}  |  ${data.rangeLabel}`, ML, 26)
  doc.setFontSize(7.5)
  doc.setTextColor(255, 230, 170)
  doc.text(`Generated: ${generatedAt}`, MR, 26, { align: 'right' })

  // Quick stats row
  doc.setTextColor(...WHITE)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  const qs = [
    `${data.counts.totalOrders} Orders`,
    `Rs ${data.revenue.totalRevenue.toLocaleString('en-IN')} Revenue`,
    `${data.counts.delivered} Delivered`,
    `${data.counts.pending} Pending`
  ]
  qs.forEach((s, i) => doc.text(s, ML + i * 66, 34))

  // KPI Cards
  let curY = 48
  curY = drawSectionHeading('KEY METRICS', curY)

  const kpis = [
    { label: 'Total Orders',       value: String(data.counts.totalOrders) },
    { label: 'Total Revenue',      value: `Rs ${data.revenue.totalRevenue.toLocaleString('en-IN')}` },
    { label: 'Avg Order Value',    value: `Rs ${data.counts.avgOrderValue.toLocaleString('en-IN')}` },
    { label: 'Items Sold',         value: `${data.counts.totalQty} units` },
    { label: 'Delivered',          value: String(data.counts.delivered) },
    { label: 'Shipped',            value: String(data.counts.shipped) },
    { label: 'Packed',             value: String(data.counts.packed) },
    { label: 'Pending',            value: String(data.counts.pending) },
    { label: 'Cancelled',          value: String(data.counts.cancelled) },
  ]
  const CARD_W = 63, CARD_H = 18, CARD_GAP = 3, COLS = 4
  kpis.forEach(({ label, value }, i) => {
    const col = i % COLS, row = Math.floor(i / COLS)
    const cx = ML + col * (CARD_W + CARD_GAP)
    const cy = curY + row * (CARD_H + 3)
    doc.setFillColor(...GOLD_LIGHT)
    doc.roundedRect(cx, cy, CARD_W, CARD_H, 2, 2, 'F')
    doc.setFillColor(...GOLD)
    doc.rect(cx, cy, 2, CARD_H, 'F')
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...PRIMARY)
    doc.text(value, cx + 6, cy + 10)
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(label, cx + 6, cy + 15)
  })
  curY = curY + Math.ceil(kpis.length / COLS) * (CARD_H + 3) + 6

  // Monthly Table
  curY = drawSectionHeading('MONTHLY BREAKDOWN', curY)
  const monthlyFinalY = safeAutoTable(doc, {
    ...tableStyle, startY: curY,
    head: [['Month', 'Orders', 'Revenue (INR)']],
    body: data.monthlyData.map(m => [m.month, String(m.orders), `Rs ${m.revenue.toLocaleString('en-IN')}`]),
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 40, halign: 'right' }, 2: { cellWidth: 80, halign: 'right' } }
  })
  curY = monthlyFinalY + 8

  // Product Table
  if (data.productWise.length > 0) {
    if (curY > 160) { doc.addPage(); curY = 20 }
    curY = drawSectionHeading('PRODUCT-WISE BREAKDOWN (Top 20)', curY)
    const productFinalY = safeAutoTable(doc, {
      ...tableStyle, startY: curY,
      head: [['#', 'Product', 'Qty', 'Revenue (INR)']],
      body: data.productWise.slice(0, 20).map((p, idx) => [
        String(idx + 1), p.name.length > 50 ? p.name.substring(0, 49) + '...' : p.name,
        String(p.quantity), `Rs ${p.revenue.toLocaleString('en-IN')}`
      ]),
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 140 }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 60, halign: 'right' } }
    })
    curY = productFinalY + 8
  }

  // Customer Table (admin)
  if (data.role === 'admin' && data.customerWise.length > 0) {
    if (curY > 160) { doc.addPage(); curY = 20 }
    curY = drawSectionHeading('CUSTOMER-WISE BREAKDOWN (Top 20)', curY)
    const custFinalY = safeAutoTable(doc, {
      ...tableStyle, startY: curY,
      head: [['#', 'Customer', 'Orders', 'Revenue (INR)']],
      body: data.customerWise.slice(0, 20).map((c, idx) => [
        String(idx + 1), c.name.length > 40 ? c.name.substring(0, 39) + '...' : c.name,
        String(c.orders), `Rs ${c.revenue.toLocaleString('en-IN')}`
      ]),
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 140 }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 60, halign: 'right' } }
    })
    curY = custFinalY + 8
  }

  // Vendor Table (admin)
  if (data.role === 'admin' && data.vendorWise.length > 0) {
    if (curY > 160) { doc.addPage(); curY = 20 }
    curY = drawSectionHeading('ZONAL ADMIN PERFORMANCE', curY)
    const vendorFinalY = safeAutoTable(doc, {
      ...tableStyle, startY: curY,
      head: [['#', 'Zonal Admin', 'Orders', 'Revenue (INR)']],
      body: data.vendorWise.map((v, idx) => [
        String(idx + 1), v.name.length > 40 ? v.name.substring(0, 39) + '...' : v.name,
        String(v.orders), `Rs ${v.revenue.toLocaleString('en-IN')}`
      ]),
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 140 }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 60, halign: 'right' } }
    })
    curY = vendorFinalY + 8
  }

  // Detailed Order Log
  if (data.orders.length > 0) {
    doc.addPage()
    curY = 20
    curY = drawSectionHeading(`DETAILED ORDER LOG  (${data.orders.length} orders)`, curY)
    const isAdmin = data.role === 'admin'
    const orderHead = isAdmin
      ? [['Order #', 'Date', 'Customer', 'Location', 'Zonal Admin', 'Status', 'Amount (INR)']]
      : [['Order #', 'Date', 'Customer', 'Location', 'Status', 'Amount (INR)']]

    const orderRows = data.orders.map(o => {
      const statusLabel = getStatusLabel(o.status).toUpperCase()
      const dateStr = o.date ? new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
      if (isAdmin) {
        return [o.orderNumber || '-', dateStr, (o.customer || '-').substring(0, 22), (o.location || '-').substring(0, 20), (o.vendor || '-').substring(0, 18), statusLabel, `Rs ${o.total.toLocaleString('en-IN')}`]
      }
      return [o.orderNumber || '-', dateStr, (o.customer || '-').substring(0, 25), (o.location || '-').substring(0, 22), statusLabel, `Rs ${o.total.toLocaleString('en-IN')}`]
    })

    safeAutoTable(doc, {
      ...tableStyle, startY: curY,
      head: orderHead,
      body: orderRows,
      columnStyles: isAdmin
        ? { 0: { cellWidth: 28 }, 1: { cellWidth: 26 }, 2: { cellWidth: 50 }, 3: { cellWidth: 38 }, 4: { cellWidth: 35 }, 5: { cellWidth: 40, halign: 'center' }, 6: { cellWidth: 30, halign: 'right' } }
        : { 0: { cellWidth: 32 }, 1: { cellWidth: 28 }, 2: { cellWidth: 65 }, 3: { cellWidth: 50 }, 4: { cellWidth: 50, halign: 'center' }, 5: { cellWidth: 35, halign: 'right' } },
      didParseCell: function (cellData) {
        const statusColIdx = isAdmin ? 5 : 4
        if (cellData.section === 'body' && cellData.column.index === statusColIdx) {
          const rawStatus = data.orders[cellData.row.index]?.status || ''
          const colors = STATUS_COLORS[rawStatus]
          if (colors) {
            cellData.cell.styles.fillColor = colors.bg
            cellData.cell.styles.textColor = colors.text
            cellData.cell.styles.fontStyle = 'bold'
          }
        }
      },
      margin: { left: ML, right: PW - MR, bottom: 16 }
    })
  }

  // Footers
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(p, totalPages)
  }

  return doc.output('arraybuffer')
}

// ================================================================
// generateReportExcel — DEPRECATED: old legacy Excel removed.
// Use generateFullReport() instead for all new exports.
// Kept as alias for any remaining references.
// ================================================================
export function generateReportExcel(data, opts = {}) {
  console.warn('[report-generator] generateReportExcel is deprecated. Use generateFullReport() instead.')
  // Redirect to the new system
  return generateFullReport(data.orders || [], opts)
}

// ================================================================
// Professional Excel — THE ONLY EXCEL EXPORT SYSTEM
// ================================================================

/**
 * Build a normalized report dataset from raw Supabase order data.
 * Extracts customer, address, company, zonal admin, product, and payment info.
 */
export function normalizeOrderData(dbOrders, opts = {}) {
  const { role = 'admin', rangeLabel = 'All Time' } = opts
  const now = new Date()
  const generatedAt = formatDateTime(now)

  const orderRows = []
  const itemRows = []
  const customerMap = new Map()
  const zonalAdminMap = new Map()

  for (const o of (dbOrders || [])) {
    const addr = o.addresses || {}
    const userId = o.user_id || ''

    // Order-level data
    const orderRow = {
      orderNumber: safe(o.order_number),
      invoiceNumber: o.order_number ? `INV-${o.order_number}` : '',
      orderDate: formatDate(o.placed_at),
      orderTime: formatTime(o.placed_at),
      orderDateTime: formatDateTime(o.placed_at),
      orderStatus: getStatusLabel(o.status),
      rawStatus: safe(o.status),

      // Customer info
      customerName: safe(addr.full_name),
      customerEmail: safe(o.user_email),
      customerPhone: safe(addr.phone),
      customerGstin: safe(addr.gst),
      companyName: safe(addr.business_name),
      companyId: userId,

      // Shipping address
      shippingAddress: [addr.line1, addr.line2].filter(Boolean).join(', '),
      shippingCity: safe(addr.city),
      shippingDistrict: safe(addr.district),
      shippingState: safe(addr.state),
      shippingPincode: safe(addr.pincode),
      shippingCountry: safe(addr.country, 'India'),

      // Billing (same as shipping if no separate billing)
      billingAddress: [addr.line1, addr.line2].filter(Boolean).join(', '),
      billingCity: safe(addr.city),
      billingDistrict: safe(addr.district),
      billingState: safe(addr.state),
      billingPincode: safe(addr.pincode),

      // Zonal admin
      zonalAdminName: safe(o.vendor_name),
      zonalAdminId: safe(o.assigned_vendor_id),
      zonalAdminEmail: safe(o.vendor_email),

      // Payment
      paymentMethod: safe(o.payment_method, 'COD'),
      paymentStatus: safe(o.payment_status, 'Pending'),

      // Financials
      subtotal: safeNum(o.subtotal),
      discount: safeNum(o.discount),
      tax: safeNum(o.gst_amount),
      shippingCharges: safeNum(o.shipping_fee),
      grandTotal: safeNum(o.total),
    }

    orderRows.push(orderRow)

    // Track unique customers
    const custKey = o.user_id || addr.full_name || 'unknown'
    if (!customerMap.has(custKey)) {
      customerMap.set(custKey, {
        customerName: orderRow.customerName,
        customerEmail: orderRow.customerEmail,
        customerPhone: orderRow.customerPhone,
        companyName: orderRow.companyName,
        customerGstin: orderRow.customerGstin,
        address: orderRow.shippingAddress,
        city: orderRow.shippingCity,
        district: orderRow.shippingDistrict,
        state: orderRow.shippingState,
        pincode: orderRow.shippingPincode,
        totalOrders: 0,
        totalPurchaseValue: 0,
        lastOrderDate: null,
      })
    }
    const cust = customerMap.get(custKey)
    cust.totalOrders++
    if (!['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)) {
      cust.totalPurchaseValue += safeNum(o.total)
    }
    if (!cust.lastOrderDate || new Date(o.placed_at) > new Date(cust.lastOrderDate)) {
      cust.lastOrderDate = o.placed_at
    }

    // Track zonal admin performance
    const zaKey = o.vendor_name || '_unassigned'
    if (!zonalAdminMap.has(zaKey)) {
      zonalAdminMap.set(zaKey, {
        zonalAdminName: o.vendor_name || 'Unassigned',
        zone: '', // No zone column in vendors table
        totalOrders: 0,
        totalProducts: 0,
        totalQuantity: 0,
        totalSales: 0,
        deliveredOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        paidAmount: 0,
        pendingPaymentAmount: 0,
      })
    }
    const za = zonalAdminMap.get(zaKey)
    za.totalOrders++
    if (o.status === 'delivered') za.deliveredOrders++
    else if (['pending', 'pending_vendor_acceptance', 'pending_admin_approval', 'vendor_accepted_pending_admin_approval'].includes(o.status)) za.pendingOrders++
    else if (['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)) za.cancelledOrders++

    if (['paid', 'received'].includes((o.payment_status || '').toLowerCase()) || (o.status === 'delivered' && (o.payment_method || '').toLowerCase() === 'cod')) {
      za.paidAmount += safeNum(o.total)
    } else {
      za.pendingPaymentAmount += safeNum(o.total)
    }
    if (!['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)) {
      za.totalSales += safeNum(o.total)
    }

    // Product-level rows
    for (const it of (o.order_items || [])) {
      const prod = it.products || {}
      const catObj = prod.categories || {}
      const qty = safeNum(it.quantity)
      const unitPrice = safeNum(it.price_snapshot)
      const productTotal = qty * unitPrice
      const gstPercent = safeNum(prod.gst_percent, 18)
      const taxAmount = productTotal - (gstPercent > 0 ? productTotal / (1 + gstPercent / 100) : productTotal)

      itemRows.push({
        orderNumber: orderRow.orderNumber,
        invoiceNumber: orderRow.invoiceNumber,
        orderDate: orderRow.orderDate,
        customerName: orderRow.customerName,
        companyName: orderRow.companyName,
        customerGstin: orderRow.customerGstin,
        productId: safe(it.product_id),
        productName: safe(it.product_name_snapshot, 'Unknown Product'),
        sku: safe(it.sku || prod.sku),
        category: safe(catObj.name || prod.subcategory),
        variant: safe(prod.variant),
        quantity: qty,
        unitPrice,
        discount: safeNum(it.discount),
        taxRate: gstPercent,
        taxAmount: Math.round(taxAmount * 100) / 100,
        productTotal,
        orderStatus: orderRow.orderStatus,
        zonalAdmin: orderRow.zonalAdminName,
        zone: '',
      })

      za.totalProducts++
      za.totalQuantity += qty
    }
  }

  // Summary calculations
  const allStatuses = orderRows.map(r => r.rawStatus)
  const totalOrders = orderRows.length
  const delivered = allStatuses.filter(s => s === 'delivered').length
  const packed = allStatuses.filter(s => s === 'packed').length
  const shipped = allStatuses.filter(s => s === 'shipped').length
  const outForDelivery = allStatuses.filter(s => s === 'out_for_delivery').length
  const confirmed = allStatuses.filter(s => s === 'confirmed').length
  const pendingCount = allStatuses.filter(s => ['pending', 'pending_vendor_acceptance', 'pending_admin_approval', 'vendor_accepted_pending_admin_approval'].includes(s)).length
  const cancelled = allStatuses.filter(s => ['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(s)).length
  const totalProductsSold = itemRows.length
  const totalQuantity = itemRows.reduce((s, r) => s + r.quantity, 0)
  const activeOrders = orderRows.filter(r => !['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(r.rawStatus))
  const totalSales = activeOrders.reduce((s, r) => s + r.grandTotal, 0)
  const paidAmount = orderRows.filter(r => ['paid', 'received'].includes(r.paymentStatus.toLowerCase()) || (r.rawStatus === 'delivered' && r.paymentMethod.toLowerCase() === 'cod')).reduce((s, r) => s + r.grandTotal, 0)
  const pendingPayment = totalSales - paidAmount
  const uniqueCustomers = customerMap.size
  const uniqueCompanies = new Set(orderRows.filter(r => r.companyName).map(r => r.companyName)).size
  const uniqueZonalAdmins = zonalAdminMap.size
  const avgOrderValue = activeOrders.length > 0 ? Math.round(totalSales / activeOrders.length) : 0

  return {
    generatedAt,
    rangeLabel,
    role,
    summary: {
      totalOrders,
      totalProductsSold,
      totalQuantity,
      totalSales: Math.round(totalSales * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      pendingPayment: Math.round(pendingPayment * 100) / 100,
      avgOrderValue,
      delivered,
      packed,
      shipped,
      outForDelivery,
      confirmed,
      pending: pendingCount,
      cancelled,
      uniqueCustomers,
      uniqueCompanies,
      uniqueZonalAdmins,
    },
    orderRows,
    itemRows,
    customerRows: Array.from(customerValues(customerMap)).map(c => ({
      ...c,
      lastOrderDate: c.lastOrderDate ? formatDate(c.lastOrderDate) : '',
    })),
    zonalAdminRows: Array.from(zonalAdminMap.values()),
  }
}

function* customerValues(map) {
  yield* map.values()
}

/**
 * Generate a professional 5-sheet XLSX workbook from normalized data.
 */
export function generateProfessionalExcel(normalizedData, opts = {}) {
  const { role = 'admin', fileName = 'AK_Enterprises_Report' } = opts
  const { generatedAt, rangeLabel, summary, orderRows, itemRows, customerRows, zonalAdminRows } = normalizedData
  const isAdmin = role === 'admin'

  const wb = XLSX.utils.book_new()

  // ── Brand colors for headers ──
  const PRIMARY_HEX = '5C1A1A'
  const GOLD_HEX = 'C9962C'
  const HEADER_BG = { fgColor: { rgb: PRIMARY_HEX } }
  const HEADER_FONT = { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 }
  const ALT_ROW_BG = { fgColor: { rgb: 'F9F8F6' } }
  const GOLD_BG = { fgColor: { rgb: 'FEF9EB' } }



  function makeSheet(headers, data, colWidths, sheetName) {
    const aoa = [headers, ...data]
    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Column widths
    if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }))

    return ws
  }

  function formatMoney(n) {
    return Number(n || 0)
  }

  // ═══════════════════════════════════════════════════
  // SHEET 1: Report Summary
  // ═══════════════════════════════════════════════════
  const summaryAoa = [
    ['AK ENTERPRISES — REPORT SUMMARY'],
    [],
    ['Report Generated At', generatedAt],
    ['Report Period', rangeLabel],
    ['Report Type', isAdmin ? 'Owner / Admin Report' : 'Zonal Admin Report'],
    [],
    ['KEY METRICS', 'VALUE'],
    ['Total Orders', summary.totalOrders],
    ['Total Products Sold', summary.totalProductsSold],
    ['Total Quantity', summary.totalQuantity],
    ['Total Sales (INR)', summary.totalSales],
    ['Average Order Value (INR)', summary.avgOrderValue],
    ['Paid Amount (INR)', summary.paidAmount],
    ['Pending Payment (INR)', summary.pendingPayment],
    [],
    ['ORDER STATUS BREAKDOWN', 'COUNT'],
    ['Delivered', summary.delivered],
    ['Packed', summary.packed],
    ['Shipped', summary.shipped],
    ['Out for Delivery', summary.outForDelivery],
    ['Confirmed', summary.confirmed],
    ['Pending', summary.pending],
    ['Cancelled / Rejected', summary.cancelled],
  ]

  if (isAdmin) {
    summaryAoa.push(
      [],
      ['ENTITY COUNTS', 'VALUE'],
      ['Unique Customers', summary.uniqueCustomers],
      ['Unique Companies', summary.uniqueCompanies],
      ['Unique Zonal Admins', summary.uniqueZonalAdmins],
    )
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa)
  summaryWs['!cols'] = [{ wch: 32 }, { wch: 28 }]



  // Currency formatting for money cells
  const moneyRows = [9, 10, 11, 12] // Total Sales, Avg, Paid, Pending
  for (const r of moneyRows) {
    const cell = summaryWs[XLSX.utils.encode_cell({ r, c: 1 })]
    if (cell) { cell.t = 'n'; cell.z = '₹#,##0.00' }
  }

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Report Summary')

  // ═══════════════════════════════════════════════════
  // SHEET 2: Order Summary (one row per order)
  // ═══════════════════════════════════════════════════
  const orderHeaders = [
    'Order No', 'Invoice No', 'Order Date', 'Order Time',
    'Customer Name', 'Customer Email', 'Customer Phone',
    'Company Name', 'Customer GSTIN',
    'Shipping Address', 'Shipping City', 'Shipping District', 'Shipping State', 'Shipping Pincode',
    'Billing Address', 'Billing City', 'Billing District', 'Billing State', 'Billing Pincode',
  ]
  if (isAdmin) {
    orderHeaders.push('Zonal Admin', 'Zone')
  }
  orderHeaders.push(
    'Payment Method', 'Payment Status', 'Order Status',
    'Subtotal (INR)', 'Discount (INR)', 'Tax/GST (INR)', 'Shipping Charges (INR)', 'Grand Total (INR)'
  )

  const orderData = orderRows.map(r => {
    const row = [
      r.orderNumber, r.invoiceNumber, r.orderDate, r.orderTime,
      r.customerName, r.customerEmail, r.customerPhone,
      r.companyName, r.customerGstin,
      r.shippingAddress, r.shippingCity, r.shippingDistrict, r.shippingState, r.shippingPincode,
      r.billingAddress, r.billingCity, r.billingDistrict, r.billingState, r.billingPincode,
    ]
    if (isAdmin) {
      row.push(r.zonalAdminName, r.zone)
    }
    row.push(
      r.paymentMethod, r.paymentStatus, r.orderStatus,
      r.subtotal, r.discount, r.tax, r.shippingCharges, r.grandTotal
    )
    return row
  })

  const orderColWidths = [
    12, 14, 14, 12,
    22, 24, 14,
    22, 18,
    28, 16, 16, 14, 10,
    28, 16, 16, 14, 10,
  ]
  if (isAdmin) orderColWidths.push(20, 10)
  orderColWidths.push(12, 12, 14, 14, 12, 12, 14, 14)

  const orderWs = makeSheet(orderHeaders, orderData, orderColWidths, 'Order Summary')

  // Set numeric formatting for monetary columns in Order Summary
  // Column layout: [19 base cols] + [2 zonal-admin cols if admin] + [3 text cols:
  // Payment Method, Payment Status, Order Status] + [5 money cols: Subtotal,
  // Discount, Tax/GST, Shipping Charges, Grand Total]
  const orderMoneyStartCol = (isAdmin ? 19 + 2 : 19) + 3
  const moneyColIndices = [orderMoneyStartCol, orderMoneyStartCol + 1, orderMoneyStartCol + 2, orderMoneyStartCol + 3, orderMoneyStartCol + 4]
  for (const colIdx of moneyColIndices) {
    const colLetter = XLSX.utils.encode_col(colIdx)
    for (let r = 1; r <= orderData.length; r++) {
      const cellRef = `${colLetter}${r + 1}`
      if (orderWs[cellRef]) { orderWs[cellRef].t = 'n'; orderWs[cellRef].z = '₹#,##0.00' }
    }
  }

  XLSX.utils.book_append_sheet(wb, orderWs, 'Order Summary')

  // ═══════════════════════════════════════════════════
  // SHEET 3: Order Items / Product Details (one row per product per order)
  // ═══════════════════════════════════════════════════
  const itemHeaders = [
    'Order No', 'Invoice No', 'Order Date',
    'Customer Name', 'Company Name', 'Customer GSTIN',
    'Product ID', 'Product Name', 'SKU', 'Category', 'Variant',
    'Quantity', 'Unit Price (INR)', 'Discount (INR)', 'Tax Rate (%)', 'Tax Amount (INR)', 'Product Total (INR)',
    'Order Status', 'Zonal Admin', 'Zone',
  ]

  const itemData = itemRows.map(r => [
    r.orderNumber, r.invoiceNumber, r.orderDate,
    r.customerName, r.companyName, r.customerGstin,
    r.productId, r.productName, r.sku, r.category, r.variant,
    r.quantity, r.unitPrice, r.discount, r.taxRate, r.taxAmount, r.productTotal,
    r.orderStatus, r.zonalAdmin, r.zone,
  ])

  const itemColWidths = [12, 14, 14, 22, 22, 18, 12, 40, 14, 20, 12, 10, 14, 12, 10, 14, 14, 14, 20, 10]

  const itemWs = makeSheet(itemHeaders, itemData, itemColWidths, 'Order Items')

  // Set numeric formatting for money columns in Item Details
  const itemMoneyCols = [12, 13, 15, 16] // unitPrice, discount, taxAmount, productTotal (0-indexed)
  for (const colIdx of itemMoneyCols) {
    const colLetter = XLSX.utils.encode_col(colIdx)
    for (let r = 1; r <= itemData.length; r++) {
      const cellRef = `${colLetter}${r + 1}`
      if (itemWs[cellRef]) { itemWs[cellRef].t = 'n'; itemWs[cellRef].z = '₹#,##0.00' }
    }
  }
  // Tax rate as percentage
  const taxRateCol = XLSX.utils.encode_col(14)
  for (let r = 1; r <= itemData.length; r++) {
    const cellRef = `${taxRateCol}${r + 1}`
    if (itemWs[cellRef]) { itemWs[cellRef].t = 'n'; itemWs[cellRef].z = '0.00%' }
  }
  // Quantity as integer
  const qtyCol = XLSX.utils.encode_col(11)
  for (let r = 1; r <= itemData.length; r++) {
    const cellRef = `${qtyCol}${r + 1}`
    if (itemWs[cellRef]) { itemWs[cellRef].t = 'n'; itemWs[cellRef].z = '#,##0' }
  }

  XLSX.utils.book_append_sheet(wb, itemWs, 'Order Items')

  // ═══════════════════════════════════════════════════
  // SHEET 4: Customer Details
  // ═══════════════════════════════════════════════════
  const custHeaders = [
    'Customer Name', 'Email', 'Phone', 'Company Name', 'GSTIN',
    'Address', 'City', 'District', 'State', 'Pincode',
    'Total Orders', 'Total Purchase Value (INR)', 'Last Order Date',
  ]

  const custData = customerRows.map(r => [
    r.customerName, r.customerEmail, r.customerPhone, r.companyName, r.customerGstin,
    r.address, r.city, r.district, r.state, r.pincode,
    r.totalOrders, r.totalPurchaseValue, r.lastOrderDate,
  ])

  const custColWidths = [22, 24, 14, 22, 18, 28, 16, 16, 14, 10, 12, 20, 14]

  const custWs = makeSheet(custHeaders, custData, custColWidths, 'Customer Details')

  // Currency formatting
  const custMoneyCol = XLSX.utils.encode_col(11)
  for (let r = 1; r <= custData.length; r++) {
    const cellRef = `${custMoneyCol}${r + 1}`
    if (custWs[cellRef]) { custWs[cellRef].t = 'n'; custWs[cellRef].z = '₹#,##0.00' }
  }
  const custOrderCol = XLSX.utils.encode_col(10)
  for (let r = 1; r <= custData.length; r++) {
    const cellRef = `${custOrderCol}${r + 1}`
    if (custWs[cellRef]) { custWs[cellRef].t = 'n'; custWs[cellRef].z = '#,##0' }
  }

  XLSX.utils.book_append_sheet(wb, custWs, 'Customer Details')

  // ═══════════════════════════════════════════════════
  // SHEET 5: Zonal Admin Performance (admin only)
  // ═══════════════════════════════════════════════════
  if (isAdmin && zonalAdminRows.length > 0) {
    const zaHeaders = [
      'Zonal Admin', 'Zone',
      'Total Orders', 'Total Products', 'Total Quantity', 'Total Sales (INR)',
      'Delivered Orders', 'Pending Orders', 'Cancelled Orders',
      'Paid Amount (INR)', 'Pending Payment (INR)',
    ]

    const zaData = zonalAdminRows.map(r => [
      r.zonalAdminName, r.zone,
      r.totalOrders, r.totalProducts, r.totalQuantity, r.totalSales,
      r.deliveredOrders, r.pendingOrders, r.cancelledOrders,
      r.paidAmount, r.pendingPaymentAmount,
    ])

    const zaColWidths = [22, 10, 12, 14, 14, 16, 16, 14, 16, 16, 18]

    const zaWs = makeSheet(zaHeaders, zaData, zaColWidths, 'Zonal Admin Performance')

    // Currency formatting
    const zaMoneyCols = [5, 9, 10]
    for (const colIdx of zaMoneyCols) {
      const colLetter = XLSX.utils.encode_col(colIdx)
      for (let r = 1; r <= zaData.length; r++) {
        const cellRef = `${colLetter}${r + 1}`
        if (zaWs[cellRef]) { zaWs[cellRef].t = 'n'; zaWs[cellRef].z = '₹#,##0.00' }
      }
    }
    // Integer formatting
    const zaIntCols = [2, 3, 4, 6, 7, 8]
    for (const colIdx of zaIntCols) {
      const colLetter = XLSX.utils.encode_col(colIdx)
      for (let r = 1; r <= zaData.length; r++) {
        const cellRef = `${colLetter}${r + 1}`
        if (zaWs[cellRef]) { zaWs[cellRef].t = 'n'; zaWs[cellRef].z = '#,##0' }
      }
    }

    XLSX.utils.book_append_sheet(wb, zaWs, 'Zonal Admin Performance')
  }

  // Write workbook — type:'buffer' returns a Node.js Buffer (extends Uint8Array).
  // Wrap in Buffer.from() to guarantee a safe, current-context Buffer even when
  // xlsx is loaded via serverExternalPackages (avoids cross-realm prototype issues).
  const rawBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  const xlsxBuffer = Buffer.from(rawBuffer)

  // Validate: XLSX files are ZIP archives starting with PK signature (0x50, 0x4B)
  if (xlsxBuffer.length < 4 || xlsxBuffer[0] !== 0x50 || xlsxBuffer[1] !== 0x4B) {
    throw new Error('XLSX generation failed: output is not a valid ZIP/XLSX archive')
  }

  return xlsxBuffer
}

/**
 * Generate a professional Excel report from raw Supabase order data.
 * This is the main entry point for the new export system.
 */
export function generateFullReport(dbOrders, opts = {}) {
  const { role = 'admin', range = {} } = opts

  let rangeLabel = 'All Time'
  if (range?.start && range?.end) {
    const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    rangeLabel = `${fmt(range.start)} – ${fmt(range.end)}`
  }

  const normalized = normalizeOrderData(dbOrders, { role, rangeLabel })
  return generateProfessionalExcel(normalized, { role })
}