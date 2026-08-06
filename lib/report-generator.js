import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import 'jspdf-autotable'
import XLSX from 'xlsx'
import { getDateRange, toISTDateKey } from './date-helpers'
import { getStatusLabel } from './status-labels'

/**
 * Safe wrapper around autoTable that guarantees a finalY value.
 * Handles cases where autoTable returns undefined or doc.lastAutoTable
 * is not populated (common in Next.js server environments).
 */
function safeAutoTable(doc, options) {
  try {
    const result = autoTable(doc, options)
    // v5 returns { finalY } directly
    if (result && typeof result.finalY === 'number') return result.finalY
  } catch (err) {
    console.error('[safeAutoTable] autoTable() threw:', err.message)
  }
  // Fallback: doc.lastAutoTable is populated when the plugin is
  // attached via the side-effect import above
  if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
    return doc.lastAutoTable.finalY
  }
  // Ultimate fallback — estimate position based on rows
  const rowCount = (options.body || []).length
  const rowHeight = 7
  return (options.startY || 50) + 10 + rowCount * rowHeight
}

const PRIMARY = [180, 120, 40] // gold-ish primary color
const TEXT_DARK = [30, 30, 30]

/**
 * Resolve a named date range key (plus optional custom dates) into
 * { start: Date|null, end: Date|null }.  Reuses lib/date-helpers.js
 * which is IST-aware so "today" / "last-7-days" etc. align with the
 * Indian business day.
 */
export function resolveDateRange(rangeKey, customStart, customEnd) {
  const { start, end } = getDateRange(rangeKey, customStart, customEnd)
  return { start, end }
}

/**
 * Build aggregated report data from an array of orders.
 *
 * @param {Array} orders - Supabase order rows (with order_items, addresses, etc.)
 * @param {Object} opts
 * @param {string} opts.role - 'admin' | 'vendor'
 * @param {string} opts.reportTitle - e.g. "Sales Report"
 * @param {string} opts.entityName - vendor name or "All Orders"
 * @param {{ start: Date|null, end: Date|null }} opts.range - date bounds
 * @returns {Object} aggregated report data
 */
export function buildReportData(orders, opts = {}) {
  const { role = 'admin', reportTitle = 'Sales Report', entityName = 'All Orders', range } = opts
  const orderList = Array.isArray(orders) ? orders : []

  // ---- Counts ----
  const totalOrders = orderList.length
  const delivered = orderList.filter(o => o.status === 'delivered').length
  const packed = orderList.filter(o => o.status === 'packed').length
  const shipped = orderList.filter(o => o.status === 'shipped').length
  const outForDelivery = orderList.filter(o => o.status === 'out_for_delivery').length
  const confirmed = orderList.filter(o => o.status === 'confirmed').length
  const pending = orderList.filter(o =>
    ['pending', 'pending_vendor_acceptance', 'pending_admin_approval',
     'vendor_accepted_pending_admin_approval'].includes(o.status)
  ).length
  const cancelled = orderList.filter(o =>
    ['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)
  ).length

  // ---- Revenue ----
  const activeOrders = orderList.filter(o =>
    !['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)
  )
  const totalRevenue = activeOrders.reduce((s, o) => s + (o.total || 0), 0)
  const avgOrderValue = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0

  // ---- Quantity ----
  let totalQty = 0
  orderList.forEach(o => {
    ;(o.order_items || []).forEach(it => { totalQty += it.quantity || 0 })
  })

  // ---- Product-wise breakdown ----
  const productCounts = {}
  const productRevenue = {}
  orderList.forEach(o => {
    ;(o.order_items || []).forEach(it => {
      const name = it.product_name_snapshot || 'Unknown Product'
      const qty = it.quantity || 0
      const rev = (it.price_snapshot || 0) * qty
      productCounts[name] = (productCounts[name] || 0) + qty
      productRevenue[name] = (productRevenue[name] || 0) + rev
    })
  })
  const productWise = Object.keys(productCounts)
    .map(name => ({ name, quantity: productCounts[name], revenue: productRevenue[name] }))
    .sort((a, b) => b.quantity - a.quantity)

  // ---- Customer-wise breakdown (from addresses.full_name) ----
  const customerCounts = {}
  const customerRevenue = {}
  orderList.forEach(o => {
    const clientName = o.addresses?.full_name || o.customer_profile?.full_name || 'Unknown'
    customerCounts[clientName] = (customerCounts[clientName] || 0) + 1
    customerRevenue[clientName] = (customerRevenue[clientName] || 0) + (o.total || 0)
  })
  const customerWise = Object.keys(customerCounts)
    .map(name => ({ name, orders: customerCounts[name], revenue: customerRevenue[name] }))
    .sort((a, b) => b.revenue - a.revenue)

  // ---- Vendor-wise breakdown (admin only) ----
  const vendorCounts = {}
  const vendorRevenue = {}
  let vendorWise = []
  if (role === 'admin') {
    orderList.forEach(o => {
      const vName = o.vendor_name || 'Unassigned'
      vendorCounts[vName] = (vendorCounts[vName] || 0) + 1
      vendorRevenue[vName] = (vendorRevenue[vName] || 0) + (o.total || 0)
    })
    vendorWise = Object.keys(vendorCounts)
      .map(name => ({ name, orders: vendorCounts[name], revenue: vendorRevenue[name] }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  // ---- Monthly breakdown ----
  const monthly = {}
  orderList.forEach(o => {
    const monthKey = toISTDateKey(new Date(o.placed_at || Date.now())).slice(0, 7) // YYYY-MM
    if (!monthly[monthKey]) monthly[monthKey] = { orders: 0, revenue: 0 }
    monthly[monthKey].orders++
    if (!['cancelled', 'rejected', 'vendor_rejected', 'admin_rejected'].includes(o.status)) {
      monthly[monthKey].revenue += o.total || 0
    }
  })
  const monthlyData = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, orders: d.orders, revenue: Math.round(d.revenue * 100) / 100 }))

  // ---- Format date range label ----
  let rangeLabel = 'All Time'
  if (range?.start && range?.end) {
    const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    rangeLabel = `${fmt(range.start)} – ${fmt(range.end)}`
  } else if (range?.start) {
    rangeLabel = `From ${new Date(range.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  } else if (range?.end) {
    rangeLabel = `Up to ${new Date(range.end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  return {
    reportTitle,
    entityName,
    role,
    rangeLabel,
    counts: { totalOrders, delivered, packed, shipped, outForDelivery, confirmed, pending, cancelled, avgOrderValue: Math.round(avgOrderValue), totalQty },
    revenue: { totalRevenue: Math.round(totalRevenue * 100) / 100 },
    productWise,
    customerWise,
    vendorWise,
    monthlyData,
    orders: orderList.map(o => ({
      orderNumber: o.order_number,
      date: o.placed_at,
      customer: o.addresses?.full_name || o.customer_profile?.full_name || 'Guest',
      vendor: o.vendor_name || '—',
      status: o.status,
      total: o.total || 0,
      items: (o.order_items || []).map(it => `${it.product_name_snapshot} x${it.quantity}`).join(', ')
    }))
  }
}

// ----------------------------------------------------------------
// PDF Generation
// ----------------------------------------------------------------

/**
 * Generate a formatted PDF report.  Returns an ArrayBuffer.
 */
export function generateReportPDF(data, opts = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ML = 15, MR = 195

  // ---- Cover / Title ----
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(data.reportTitle || 'Sales Report', ML, 18)
  doc.setFontSize(10)
  doc.setFont('Helvetica', 'normal')
  doc.text(`${data.entityName}  •  ${data.rangeLabel}`, ML, 28)
  doc.setFontSize(8)
  const generatedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  doc.text(`Generated: ${generatedAt}`, ML, 35)

  // ---- KPI Grid ----
  doc.setTextColor(...TEXT_DARK)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('KEY METRICS', ML, 50)
  doc.line(ML, 52, MR, 52)

  const { counts, revenue } = data
  const kpis = [
    ['Total Orders', String(counts.totalOrders)],
    ['Total Revenue', `Rs ${revenue.totalRevenue.toLocaleString('en-IN')}`],
    ['Avg Order Value', `Rs ${counts.avgOrderValue.toLocaleString('en-IN')}`],
    ['Delivered', String(counts.delivered)],
    ['Packed', String(counts.packed)],
    ['Shipped', String(counts.shipped)],
    ['Pending', String(counts.pending)],
    ['Cancelled / Rejected', String(counts.cancelled)],
    ['Total Qty Sold', `${counts.totalQty} units`]
  ]

  let kpiY = 56
  kpis.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? ML : 110
    doc.setFillColor(249, 250, 251)
    doc.rect(col, kpiY, 82, 7, 'F')
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(label, col + 2, kpiY + 4.8)
    doc.setTextColor(...PRIMARY)
    doc.setFont('Helvetica', 'bold')
    doc.text(value, col + 50, kpiY + 4.8)
    if (i % 2 === 1) kpiY += 9
  })
  if (kpis.length % 2 !== 0) kpiY += 9

  // ---- Monthly Breakdown Table ----
  let tableY = kpiY + 8
  doc.setTextColor(...TEXT_DARK)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('MONTHLY BREAKDOWN', ML, tableY)
  doc.line(ML, tableY + 2, MR, tableY + 2)

  const monthlyHeaders = [['Month', 'Orders', 'Revenue (INR)']]
  const monthlyRows = data.monthlyData.map(m => [
    m.month,
    `${m.orders} orders`,
    `Rs ${m.revenue.toLocaleString('en-IN')}`
  ])

  const monthlyTableY = safeAutoTable(doc, {
    startY: tableY + 5,
    head: monthlyHeaders,
    body: monthlyRows,
    theme: 'striped',
    headStyles: { fillColor: PRIMARY, fontSize: 8.5 },
    styles: { fontSize: 8, font: 'Helvetica' },
    margin: { left: ML, right: 210 - MR }
  })

  // ---- Product-wise Table ----
  tableY = monthlyTableY + 10
  if (data.productWise.length > 0) {
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('PRODUCT-WISE BREAKDOWN', ML, tableY)
    doc.line(ML, tableY + 2, MR, tableY + 2)

    const productTableY = safeAutoTable(doc, {
      startY: tableY + 5,
      head: [['Product', 'Quantity', 'Revenue (INR)']],
      body: data.productWise.slice(0, 15).map(p => [
        p.name.length > 30 ? p.name.substring(0, 29) + '…' : p.name,
        String(p.quantity),
        `Rs ${p.revenue.toLocaleString('en-IN')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, fontSize: 8.5 },
      styles: { fontSize: 8, font: 'Helvetica' },
      margin: { left: ML, right: 210 - MR }
    })
    tableY = productTableY + 10
  }

  // ---- Customer-wise Table (admin) ----
  if (data.role === 'admin' && data.customerWise.length > 0) {
    // Check if we need a new page
    if (tableY > 250) {
      doc.addPage()
      tableY = 20
    }
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('CUSTOMER-WISE BREAKDOWN', ML, tableY)
    doc.line(ML, tableY + 2, MR, tableY + 2)

    const customerTableY = safeAutoTable(doc, {
      startY: tableY + 5,
      head: [['Customer', 'Orders', 'Revenue (INR)']],
      body: data.customerWise.slice(0, 15).map(c => [
        c.name.length > 25 ? c.name.substring(0, 24) + '…' : c.name,
        String(c.orders),
        `Rs ${c.revenue.toLocaleString('en-IN')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, fontSize: 8.5 },
      styles: { fontSize: 8, font: 'Helvetica' },
      margin: { left: ML, right: 210 - MR }
    })
    tableY = customerTableY + 10
  }

  // ---- Vendor-wise Table (admin only) ----
  if (data.role === 'admin' && data.vendorWise.length > 0) {
    if (tableY > 250) {
      doc.addPage()
      tableY = 20
    }
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('VENDOR-WISE BREAKDOWN', ML, tableY)
    doc.line(ML, tableY + 2, MR, tableY + 2)

    const vendorTableY = safeAutoTable(doc, {
      startY: tableY + 5,
      head: [['Zonal Admin', 'Orders', 'Revenue (INR)']],
      body: data.vendorWise.map(v => [
        v.name.length > 25 ? v.name.substring(0, 24) + '…' : v.name,
        String(v.orders),
        `Rs ${v.revenue.toLocaleString('en-IN')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, fontSize: 8.5 },
      styles: { fontSize: 8, font: 'Helvetica' },
      margin: { left: ML, right: 210 - MR }
    })
    tableY = vendorTableY + 10
  }

  // ---- Detailed Orders Table ----
  if (data.orders.length > 0) {
    if (tableY > 220) {
      doc.addPage()
      tableY = 20
    }
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('DETAILED ORDER LOG', ML, tableY)
    doc.line(ML, tableY + 2, MR, tableY + 2)

    safeAutoTable(doc, {
      startY: tableY + 5,
      head: [['Order #', 'Date', 'Customer', 'Status', 'Amount']],
      body: data.orders.map(o => [
        `AKE-${o.orderNumber}`,
        o.date ? new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        (o.customer || '—').substring(0, 20),
        getStatusLabel(o.status).toUpperCase(),
        `Rs ${o.total.toLocaleString('en-IN')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, fontSize: 8 },
      styles: { fontSize: 7.5, font: 'Helvetica' },
      margin: { left: ML, right: 210 - MR }
    })
  }

  // ---- Footer ----
  const pageH = doc.internal.pageSize.height
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(156, 163, 175)
  doc.text('This is a computer-generated report. AK Enterprises — Confidential.', ML, pageH - 10)

  return doc.output('arraybuffer')
}

// ----------------------------------------------------------------
// Excel Generation
// ----------------------------------------------------------------

/**
 * Generate a formatted .xlsx workbook.  Returns a Node Buffer.
 */
export function generateReportExcel(data, opts = {}) {
  const wb = XLSX.utils.book_new()

  // ---- Summary Sheet ----
  const summaryRows = [
    [data.reportTitle || 'Sales Report'],
    [`${data.entityName}  •  ${data.rangeLabel}`],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['KEY METRICS', ''],
    ['Total Orders', data.counts.totalOrders],
    ['Total Revenue (INR)', data.revenue.totalRevenue],
    ['Avg Order Value (INR)', data.counts.avgOrderValue],
    ['Delivered', data.counts.delivered],
    ['Packed', data.counts.packed],
    ['Shipped', data.counts.shipped],
    ['Pending', data.counts.pending],
    ['Cancelled / Rejected', data.counts.cancelled],
    ['Total Qty Sold', data.counts.totalQty],
    [],
    ['MONTHLY BREAKDOWN', '', ''],
    ['Month', 'Orders', 'Revenue (INR)'],
    ...data.monthlyData.map(m => [m.month, m.orders, m.revenue]),
    [],
    ['PRODUCT-WISE BREAKDOWN', '', ''],
    ['Product', 'Quantity', 'Revenue (INR)'],
    ...data.productWise.slice(0, 20).map(p => [p.name, p.quantity, p.revenue]),
    [],
    ['CUSTOMER-WISE BREAKDOWN', '', ''],
    ['Customer', 'Orders', 'Revenue (INR)'],
    ...data.customerWise.slice(0, 20).map(c => [c.name, c.orders, c.revenue])
  ]

  if (data.role === 'admin' && data.vendorWise.length > 0) {
    summaryRows.push(
      [],
      ['VENDOR-WISE BREAKDOWN', '', ''],
      ['Zonal Admin', 'Orders', 'Revenue (INR)'],
      ...data.vendorWise.map(v => [v.name, v.orders, v.revenue])
    )
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  // Column widths
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ---- Detailed Orders Sheet ----
  const orderHeaders = [['Order #', 'Date', 'Customer', 'Vendor', 'Status', 'Amount (INR)', 'Items']]
  const orderRows = data.orders.map(o => [
    `AKE-${o.orderNumber}`,
    o.date ? new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    o.customer,
    o.vendor,
    getStatusLabel(o.status).toUpperCase(),
    o.total,
    o.items
  ])

  const detailSheet = XLSX.utils.aoa_to_sheet([...orderHeaders, ...orderRows])
  detailSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, detailSheet, 'Detailed Orders')

  // ---- Generate Buffer ----
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  return buffer
}
