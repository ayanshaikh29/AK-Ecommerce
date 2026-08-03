import { jsPDF } from 'jspdf'

export async function generateChallanPDF(order, settings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Set general document attributes
  doc.setFont('Helvetica', 'normal')

  const ml = 15 // Margin Left
  const mr = 195 // Margin Right
  let y = 15 // Vertical tracker

  // 1. Header
  doc.setFontSize(16)
  doc.setFont('Helvetica', 'bold')
  doc.text('DELIVERY CHALLAN', 105, y, { align: 'center' })
  y += 6

  doc.setLineWidth(0.5)
  doc.line(ml, y, mr, y)
  y += 6

  // 2. Consignor & Challan Info
  doc.setFontSize(9)
  // Left: Consignor Info
  doc.setFont('Helvetica', 'bold')
  doc.text('Consignor:', ml, y)
  doc.setFont('Helvetica', 'normal')
  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.text(settings.brand_name || 'AK Enterprises', ml, y)
  doc.setFont('Helvetica', 'normal')
  
  const addressLines = doc.splitTextToSize(settings.company_registered_address || settings.contact_address || 'Unit No. 12, Ground Floor, Industrial Area, Mumbai, Maharashtra', 80)
  addressLines.forEach(line => {
    y += 4
    doc.text(line, ml, y)
  })
  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.text(`GSTIN: ${settings.company_gstin || 'Not Configured'}`, ml, y)

  // Right: Challan Info
  let rightY = 27
  doc.setFont('Helvetica', 'bold')
  doc.text(`Challan No:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(`CH-${order.order_number}`, 150, rightY)
  
  rightY += 5
  doc.setFont('Helvetica', 'bold')
  doc.text(`Challan Date:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(new Date(order.placed_at || Date.now()).toLocaleDateString('en-IN'), 150, rightY)

  rightY += 5
  doc.setFont('Helvetica', 'bold')
  doc.text(`Order ID:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(order.order_number, 150, rightY)

  rightY += 5
  doc.setFont('Helvetica', 'bold')
  doc.text(`Transport Mode:`, 120, rightY)
  doc.setFont('Helvetica', 'normal')
  doc.text(order.vendor_name || 'Road Transport', 150, rightY)

  y = Math.max(y, rightY) + 8

  // Draw separator line
  doc.setLineWidth(0.2)
  doc.line(ml, y, mr, y)
  y += 6

  // 3. Consignee Info (Billing/Shipping Address)
  const rightColX = 110
  doc.setFont('Helvetica', 'bold')
  doc.text('Consignee (Shipping Address):', ml, y)
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

  let consigneeY = y + 4
  doc.setFont('Helvetica', 'bold')
  if (companyName) {
    doc.text(companyName, ml, consigneeY)
    consigneeY += 4
    doc.setFont('Helvetica', 'normal')
    doc.text(`Attn: ${customerName}`, ml, consigneeY)
  } else {
    doc.text(customerName, ml, consigneeY)
  }
  doc.setFont('Helvetica', 'normal')

  const consigneeAddrLines = [
    line1,
    line2,
    `${city}, ${state} - ${pincode}`,
    `Phone: ${customerPhone}`
  ].filter(Boolean)
  if (customerGST) {
    consigneeAddrLines.push(`GSTIN: ${customerGST}`)
  }

  consigneeAddrLines.forEach(line => {
    consigneeY += 4
    doc.text(line, ml, consigneeY)
  })

  y = consigneeY + 8

  // Draw separator line
  doc.line(ml, y, mr, y)
  y += 6

  // 4. Details of Goods Transported Table
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  
  // Table columns X offsets
  // Total width: 180mm
  // Desc (120) | HSN (30) | Qty (30)
  const cDesc = ml
  const cHsn = ml + 120
  const cQty = ml + 150

  doc.text('Description of Goods', cDesc, y)
  doc.text('HSN Code', cHsn, y)
  doc.text('Quantity (Units)', cQty, y)
  
  y += 3
  doc.line(ml, y, mr, y)
  y += 4

  // Draw Table Rows
  doc.setFont('Helvetica', 'normal')
  let totalQty = 0

  const orderItemsList = order.items || order.order_items || []
  orderItemsList.forEach(it => {
    totalQty += Number(it.quantity || 0)
    
    // Split long product names
    const descLines = doc.splitTextToSize(it.product_name_snapshot || '', 115)
    const rowHeight = descLines.length * 4
    
    // Draw row content
    descLines.forEach((line, index) => {
      doc.text(line, cDesc, y + (index * 4))
    })

    doc.text(it.hsn_code || '—', cHsn, y)
    doc.text(String(it.quantity || 0), cQty, y)
    
    y += Math.max(rowHeight, 6) + 3
    doc.line(ml, y, mr, y)
    y += 4
  })

  // 5. Totals Row
  doc.setFont('Helvetica', 'bold')
  doc.text('Total Qty:', cHsn, y)
  doc.text(String(totalQty), cQty, y)

  y += 10
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Received the above goods in good order and condition.', ml, y)
  
  y += 12
  // Signature areas (Consignee vs Consignor)
  doc.setFont('Helvetica', 'bold')
  doc.text("Consignee's Signature & Seal", ml, y)
  doc.text(`For ${settings.brand_name || 'AK Enterprises'}`, 130, y)
  y += 14
  doc.line(ml, y, ml + 50, y)
  doc.line(130, y, mr, y)
  y += 4
  doc.setFont('Helvetica', 'normal')
  doc.text('Authorized Signatory', 130, y)

  // Bottom footer page info
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text(`Office: ${settings.company_registered_address || settings.contact_address || 'Mumbai, MH'} | Email: ${settings.contact_email || 'support@akenterprises.com'}`, 105, 285, { align: 'center' })

  // Return the PDF arraybuffer
  return doc.output('arraybuffer')
}
