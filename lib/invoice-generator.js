import { jsPDF } from 'jspdf'

const SUPPLIER_STATE = 'maharashtra'

function formatINR(n) {
  return 'Rs. ' + Number(n || 0).toFixed(2)
}

function computeGST(items, customerState) {
  const st = (customerState || '').toLowerCase().trim()
  const sameState = st === SUPPLIER_STATE || st === 'mh'
  let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0
  
  const parsedItems = (items || []).map(it => {
    const rate = Number(it.price_snapshot || 0)
    const qty = Number(it.quantity || 0)
    const gstPct = Number(it.products?.gst_percent ?? it.gst_percent ?? 18)
    const discount = Number(it.discount_snapshot || 0)
    const grossAmount = rate * qty
    const taxableValue = (rate - discount) * qty / (1 + gstPct / 100)
    const taxAmt = (rate - discount) * qty - taxableValue
    
    let cgst = 0, sgst = 0, igst = 0
    if (sameState) {
      cgst = taxAmt / 2
      sgst = taxAmt / 2
      totalCGST += cgst
      totalSGST += sgst
    } else {
      igst = taxAmt
      totalIGST += igst
    }
    totalTaxable += taxableValue
    
    return {
      ...it,
      gstPct,
      grossAmount,
      taxableValue,
      cgst,
      sgst,
      igst,
      total: (rate - discount) * qty
    }
  })
  
  return { sameState, totalTaxable, totalCGST, totalSGST, totalIGST, parsedItems }
}

export async function generateInvoicePDF(order, settings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Set general document attributes
  doc.setFont('Helvetica', 'normal')

  const ml = 15 // Margin Left
  const mr = 195 // Margin Right
  const contentWidth = mr - ml // 180mm
  let y = 15 // Vertical tracker

  // 1. Header
  doc.setFontSize(16)
  doc.setFont('Helvetica', 'bold')
  doc.text('TAX INVOICE', 105, y, { align: 'center' })
  y += 6

  doc.setLineWidth(0.5)
  doc.line(ml, y, mr, y)
  y += 6

  // 2. Sold By & Order Meta Info Columns
  doc.setFontSize(9)
  // Left: Sold By Info
  doc.setFont('Helvetica', 'bold')
  doc.text('Sold By:', ml, y)
  doc.setFont('Helvetica', 'normal')
  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.text(settings.brand_name || 'AK Enterprises', ml, y)
  doc.setFont('Helvetica', 'normal')
  
  // Registered address text wrap
  const addressLines = doc.splitTextToSize(settings.company_address || settings.company_registered_address || settings.contact_address || 'Unit No. 12, Ground Floor, Industrial Area, Mumbai, Maharashtra', 80)
  addressLines.forEach(line => {
    y += 4
    doc.text(line, ml, y)
  })
  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.text(`GSTIN: ${settings.company_gstin || 'Not Configured'}`, ml, y)
  y += 4
  doc.text(`PAN: ${settings.company_pan || 'Not Configured'}`, ml, y)

  // Right: Order/Invoice Info (draw on same y level relative to Sold By)
  let rightY = 27
  doc.setFont('Helvetica', 'bold')
  doc.text(`Invoice No:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(`INV-${order.order_number}`, 150, rightY)
  
  rightY += 5
  doc.setFont('Helvetica', 'bold')
  doc.text(`Invoice Date:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(new Date(order.placed_at || Date.now()).toLocaleDateString('en-IN'), 150, rightY)

  rightY += 5
  doc.setFont('Helvetica', 'bold')
  doc.text(`Order ID:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(order.order_number, 150, rightY)

  rightY += 5
  doc.setFont('Helvetica', 'bold')
  doc.text(`Order Date:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(new Date(order.placed_at || Date.now()).toLocaleDateString('en-IN'), 150, rightY)

  y = Math.max(y, rightY) + 8

  // Draw separator line
  doc.setLineWidth(0.2)
  doc.line(ml, y, mr, y)
  y += 6

  // 3. Billing & Shipping Address side-by-side
  const colWidth = 85
  const rightColX = 110

  doc.setFont('Helvetica', 'bold')
  doc.text('Billing Address:', ml, y)
  doc.text('Shipping Address:', rightColX, y)
  doc.setFont('Helvetica', 'normal')
  
  const addr = order.address || order.addresses || {}
  const profile = order.customer_profile || {}
  const customerName = addr.full_name || 'Customer'
  const companyName = profile.company_name || addr.company_name || ''
  const customerPhone = addr.phone || ''
  const line1 = addr.line1 || ''
  const line2 = addr.line2 || ''
  const city = addr.city || ''
  const state = addr.state || ''
  const pincode = addr.pincode || ''
  const customerGST = profile.gst_number || addr.gst || ''

  let billingY = y + 4
  doc.setFont('Helvetica', 'bold')
  if (companyName) {
    doc.text(companyName, ml, billingY)
    doc.text(companyName, rightColX, billingY)
    billingY += 4
    doc.setFont('Helvetica', 'normal')
    doc.text(`Attn: ${customerName}`, ml, billingY)
    doc.text(`Attn: ${customerName}`, rightColX, billingY)
  } else {
    doc.text(customerName, ml, billingY)
    doc.text(customerName, rightColX, billingY)
  }
  doc.setFont('Helvetica', 'normal')

  const billAddrLines = []
  if (line1) billAddrLines.push(...doc.splitTextToSize(line1, 80))
  if (line2) billAddrLines.push(...doc.splitTextToSize(line2, 80))
  billAddrLines.push(...doc.splitTextToSize(`${city}, ${state} - ${pincode}`, 80))
  billAddrLines.push(`Phone: ${customerPhone}`)
  if (customerGST) {
    billAddrLines.push(`GSTIN: ${customerGST}`)
  }

  // Draw billing address lines
  let currentBillY = y + 4
  doc.setFont('Helvetica', 'bold')
  if (companyName) {
    doc.text(companyName, ml, currentBillY)
    currentBillY += 4
    doc.setFont('Helvetica', 'normal')
    doc.text(`Attn: ${customerName}`, ml, currentBillY)
  } else {
    doc.text(customerName, ml, currentBillY)
  }
  doc.setFont('Helvetica', 'normal')
  billAddrLines.forEach(line => {
    currentBillY += 4
    doc.text(line, ml, currentBillY)
  })

  // Draw shipping address lines
  let currentShipY = y + 4
  doc.setFont('Helvetica', 'bold')
  if (companyName) {
    doc.text(companyName, rightColX, currentShipY)
    currentShipY += 4
    doc.setFont('Helvetica', 'normal')
    doc.text(`Attn: ${customerName}`, rightColX, currentShipY)
  } else {
    doc.text(customerName, rightColX, currentShipY)
  }
  doc.setFont('Helvetica', 'normal')
  billAddrLines.forEach(line => {
    currentShipY += 4
    doc.text(line, rightColX, currentShipY)
  })

  y = Math.max(currentBillY, currentShipY) + 8

  // Draw separator line
  doc.line(ml, y, mr, y)
  y += 6

  // 4. GST Computation & Items Table Setup
  const customerState = addr.state || ''
  const orderItemsList = order.items || order.order_items || []
  const { sameState, totalTaxable, totalCGST, totalSGST, totalIGST, parsedItems } = computeGST(orderItemsList, customerState)

  // Draw Table Headers
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  
  // Table columns X offsets
  // Total width: 180mm
  // Desc (70) | HSN (20) | Qty (10) | Rate (20) | Taxable (20) | Tax (25) | Total (15)
  const cDesc = ml
  const cHsn = ml + 70
  const cQty = ml + 90
  const cRate = ml + 100
  const cTaxVal = ml + 120
  const cTax = ml + 140
  const cTotal = ml + 165

  doc.text('Description', cDesc, y)
  doc.text('HSN', cHsn, y)
  doc.text('Qty', cQty, y)
  doc.text('Rate', cRate, y)
  doc.text('Taxable', cTaxVal, y)
  doc.text(sameState ? 'CGST/SGST' : 'IGST', cTax, y)
  doc.text('Total', cTotal, y)
  
  y += 3
  doc.line(ml, y, mr, y)
  y += 4

  // Draw Table Rows
  doc.setFont('Helvetica', 'normal')
  let totalQty = 0

  parsedItems.forEach(it => {
    totalQty += Number(it.quantity || 0)
    
    // Split long product names
    const descLines = doc.splitTextToSize(it.product_name_snapshot || '', 68)
    const rowHeight = descLines.length * 4
    
    const requiredHeight = Math.max(rowHeight, sameState ? 8 : 5) + 12
    if (y + requiredHeight > 275) {
      doc.addPage()
      y = 15
      
      // Draw Table Headers again
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('Description', cDesc, y)
      doc.text('HSN', cHsn, y)
      doc.text('Qty', cQty, y)
      doc.text('Rate', cRate, y)
      doc.text('Taxable', cTaxVal, y)
      doc.text(sameState ? 'CGST/SGST' : 'IGST', cTax, y)
      doc.text('Total', cTotal, y)
      
      y += 3
      doc.line(ml, y, mr, y)
      y += 4
      doc.setFont('Helvetica', 'normal')
    }

    // Draw row content
    descLines.forEach((line, index) => {
      doc.text(line, cDesc, y + (index * 4))
    })

    doc.text(it.hsn_code || '—', cHsn, y)
    doc.text(String(it.quantity || 0), cQty, y)
    doc.text(formatINR(it.price_snapshot), cRate, y)
    doc.text(formatINR(it.taxableValue), cTaxVal, y)
    
    if (sameState) {
      const cgstAmt = it.cgst || 0
      const sgstAmt = it.sgst || 0
      const halfPct = Number(it.gstPct || 18) / 2
      doc.text(`C: ${halfPct}% (${cgstAmt.toFixed(1)})\nS: ${halfPct}% (${sgstAmt.toFixed(1)})`, cTax, y)
    } else {
      const igstAmt = it.igst || 0
      doc.text(`${it.gstPct}% (${igstAmt.toFixed(1)})`, cTax, y)
    }
    
    doc.text(formatINR(it.total), cTotal, y)
    
    y += Math.max(rowHeight, sameState ? 8 : 5) + 3
    doc.line(ml, y, mr, y)
    y += 4
  })

  if (y + 45 > 275) {
    doc.addPage()
    y = 15
  }

  // 5. Totals & Footer Info Block
  doc.setFont('Helvetica', 'bold')
  doc.text('Total Qty:', cHsn, y)
  doc.text(String(totalQty), cQty, y)
  doc.text(formatINR(totalTaxable), cTaxVal, y)
  
  if (sameState) {
    doc.text(`C: ${formatINR(totalCGST)}\nS: ${formatINR(totalSGST)}`, cTax, y)
  } else {
    doc.text(formatINR(totalIGST), cTax, y)
  }
  doc.text(formatINR(order.total), cTotal, y)

  y += 10
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('All values are in INR. E. & O.E.', ml, y)
  
  y += 12
  // Signature Area
  const sigX = 130
  doc.setFont('Helvetica', 'bold')
  doc.text(`For ${settings.brand_name || 'AK Enterprises'}`, sigX, y)
  y += 14
  doc.line(sigX, y, mr, y)
  y += 4
  doc.setFont('Helvetica', 'normal')
  doc.text('Authorized Signatory', sigX, y)

  // Bottom footer page info
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text(`Office: ${settings.company_address || settings.company_registered_address || settings.contact_address || 'Mumbai, MH'} | Email: ${settings.contact_email || 'support@akenterprises.com'}`, 105, 285, { align: 'center' })

  // Return the PDF arraybuffer
  return doc.output('arraybuffer')
}
