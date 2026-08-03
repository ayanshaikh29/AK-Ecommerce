import { jsPDF } from 'jspdf'

const STATE_GST_CODES = {
  'jammu & kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
  'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14',
  'mizoram': '15', 'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'daman & diu': '25', 'dadra & nagar haveli': '26', 'maharashtra': '27', 'andhra pradesh': '28',
  'karnataka': '29', 'goa': '30', 'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33',
  'puducherry': '34', 'andaman & nicobar islands': '35', 'telangana': '36', 'ladakh': '38'
}

function getStateGSTCode(stateName) {
  if (!stateName) return '—';
  const key = stateName.toLowerCase().replace(/[^a-z0-9\s]+/g, '').trim();
  return STATE_GST_CODES[key] || '—';
}

function getProductHsn(it) {
  if (it.hsn_code) return it.hsn_code;
  if (it.products?.hsn_code) return it.products.hsn_code;
  const desc = it.products?.description || '';
  const match = desc.match(/<!--METADATA:([\s\S]*?)-->/);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.hsn_code) return meta.hsn_code;
    } catch (e) {}
  }
  return '';
}

export async function generateChallanPDF(order, settings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const ml = 10
  const mr = 200
  const width = 190

  // Derive State Code
  const companyGst = settings.company_gstin || ''
  const companyStateCode = companyGst.slice(0, 2) || '27'
  
  const addr = order.address || order.addresses || {}
  const profile = order.customer_profile || {}
  const customerGst = profile.gst_number || addr.gst || ''
  const customerStateCode = customerGst.slice(0, 2) || getStateGSTCode(addr.state)

  // Format addresses text
  const companyAddrLines = doc.splitTextToSize(settings.company_address || settings.company_registered_address || settings.contact_address || 'Garden View Complex, Erandwana, Pune, Maharashtra - 411004', 90)
  const shipAddrLines = [
    addr.full_name || 'Customer',
    addr.line1 || '',
    addr.line2 || '',
    `${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`,
    addr.phone ? `Phone: ${addr.phone}` : ''
  ].filter(Boolean)
  
  const consigneeLines = []
  shipAddrLines.forEach(line => {
    consigneeLines.push(...doc.splitTextToSize(line, 90))
  })

  // 1. Draw Page Header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('DELIVERY NOTE', 105, 14, { align: 'center' })

  // Outer Border Box
  doc.setLineWidth(0.3)
  doc.rect(ml, 18, width, 262) // 18 to 280

  // Vertical Separator at Middle
  doc.line(105, 18, 105, 115)

  // Seller Details (Left-Top)
  let y = 22
  doc.setFontSize(10)
  doc.setFont('Helvetica', 'bold')
  doc.text(settings.brand_name || 'AK Enterprises', ml + 3, y)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  companyAddrLines.forEach(line => {
    y += 3.5
    doc.text(line, ml + 3, y)
  })
  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.text(`GSTIN/UIN   :  ${companyGst}`, ml + 3, y)
  y += 3.5
  doc.text(`State Name  :  Maharashtra, Code : ${companyStateCode}`, ml + 3, y)
  y += 3.5
  doc.text(`E-Mail: ${settings.contact_email || 'akenterprises1411@gmail.com'}`, ml + 3, y)

  // Consignee Block Divider
  doc.line(ml, 55, 105, 55)

  // Consignee (Ship to) Box
  y = 59
  doc.setFont('Helvetica', 'normal')
  doc.text('Consignee (Ship to)', ml + 3, y)
  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(consigneeLines[0] || '', ml + 3, y)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  consigneeLines.slice(1).forEach(line => {
    y += 3.5
    doc.text(line, ml + 3, y)
  })
  y += 4
  if (customerGst) {
    doc.setFont('Helvetica', 'bold')
    doc.text(`GSTIN/UIN   :  ${customerGst}`, ml + 3, y)
    y += 3.5
  }
  doc.setFont('Helvetica', 'bold')
  doc.text(`State Name  :  ${addr.state || ''}, Code : ${customerStateCode || '—'}`, ml + 3, y)

  // Buyer Block Divider
  doc.line(ml, 85, 105, 85)

  // Buyer (Bill to) Box
  y = 89
  doc.setFont('Helvetica', 'normal')
  doc.text('Buyer (Bill to)', ml + 3, y)
  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(consigneeLines[0] || '', ml + 3, y)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  consigneeLines.slice(1).forEach(line => {
    y += 3.5
    doc.text(line, ml + 3, y)
  })
  y += 4
  if (customerGst) {
    doc.setFont('Helvetica', 'bold')
    doc.text(`GSTIN/UIN   :  ${customerGst}`, ml + 3, y)
    y += 3.5
  }
  doc.setFont('Helvetica', 'bold')
  doc.text(`State Name  :  ${addr.state || ''}, Code : ${customerStateCode || '—'}`, ml + 3, y)

  // Right Grid Horizontal Lines & Metadata Info
  doc.line(105, 28, mr, 28)
  doc.line(105, 38, mr, 38)
  doc.line(105, 48, mr, 48)
  doc.line(105, 58, mr, 58)
  doc.line(105, 68, mr, 68)
  doc.line(105, 78, mr, 78)
  doc.line(105, 115, mr, 115) // divider line above table

  // Vertical divide in right grid
  doc.line(152.5, 18, 152.5, 78)

  // Fill Right Grid
  // Row 1
  doc.setFont('Helvetica', 'normal')
  doc.text('Delivery Note No.', 108, 22)
  doc.setFont('Helvetica', 'bold')
  doc.text(`${order.order_number.slice(-4)}`, 108, 26)

  doc.setFont('Helvetica', 'normal')
  doc.text('Dated', 155, 22)
  doc.setFont('Helvetica', 'bold')
  doc.text(new Date(order.placed_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'), 155, 26)

  // Row 2
  doc.setFont('Helvetica', 'normal')
  doc.text('Delivery Note', 108, 32)
  doc.text('—', 108, 36)

  doc.text('Mode/Terms of Payment', 155, 32)
  doc.setFont('Helvetica', 'bold')
  doc.text('Credit Terms', 155, 36)

  // Row 3
  doc.setFont('Helvetica', 'normal')
  doc.text('Reference No. & Date.', 108, 42)
  doc.text('—', 108, 46)

  doc.text('Other References', 155, 42)
  doc.text('—', 155, 46)

  // Row 4
  doc.text("Buyer's Order No.", 108, 52)
  doc.text('—', 108, 56)

  doc.text('Dated', 155, 52)
  doc.text('—', 155, 56)

  // Row 5
  doc.text('Dispatch Doc No.', 108, 62)
  doc.text('—', 108, 66)

  doc.text('Delivery Note Date', 155, 62)
  doc.text('—', 155, 56)

  // Row 6
  doc.text('Dispatched through', 108, 72)
  doc.text('—', 108, 76)

  doc.text('Destination', 155, 72)
  doc.setFont('Helvetica', 'bold')
  doc.text((addr.city || '—').toUpperCase(), 155, 76)

  // Row 7 (Terms of Delivery)
  doc.setFont('Helvetica', 'normal')
  doc.text('Terms of Delivery', 108, 83)
  doc.text('Delivery within 3-5 working days. Terms as per standard agreement.', 108, 88)

  // ----------------------------------------------------
  // ITEMS TABLE SECTION (Quantity only, no Rate/Amount)
  // ----------------------------------------------------
  
  // Table Header Borders
  doc.line(ml, 122, mr, 122) // Below headers

  // Table Column Coordinates
  const cSl = 10
  const cDesc = 18
  const cHsn = 130
  const cQty = 160

  doc.setFont('Helvetica', 'bold')
  doc.text('Sl\nNo.', cSl + 2, 118)
  doc.text('Description of Goods', cDesc + 2, 120)
  doc.text('HSN/SAC', cHsn + 2, 120)
  doc.text('Quantity', cQty + 2, 120)

  // Vertical Table borders
  doc.line(cDesc, 115, cDesc, 210)
  doc.line(cHsn, 115, cHsn, 210)
  doc.line(cQty, 115, cQty, 210)

  let tableY = 126
  let totalQty = 0

  const orderItemsList = order.items || order.order_items || []

  doc.setFont('Helvetica', 'normal')
  orderItemsList.forEach((it, idx) => {
    const qtyNum = Number(it.quantity || 0)
    totalQty += qtyNum

    const unitSymbol = (it.products?.unit || it.unit || 'NOS').toUpperCase()
    const descText = `${it.product_name_snapshot || ''} @${it.products?.gst_percent ?? it.gst_percent ?? 18}%`
    const descLines = doc.splitTextToSize(descText, 108)

    // Draw description lines
    doc.setFont('Helvetica', 'bold')
    descLines.forEach((line, index) => {
      doc.text(line, cDesc + 2, tableY + (index * 4))
    })
    doc.setFont('Helvetica', 'normal')

    doc.text(String(idx + 1), cSl + 3, tableY)
    doc.text(getProductHsn(it) || '—', cHsn + 2, tableY)
    
    doc.setFont('Helvetica', 'bold')
    doc.text(`${qtyNum.toFixed(3)} ${unitSymbol}`, cQty + 2, tableY)
    doc.setFont('Helvetica', 'normal')

    tableY += Math.max(descLines.length * 4, 6)
  })

  // End of items table border line
  doc.line(ml, 210, mr, 210)
  
  // Total Row
  doc.setFont('Helvetica', 'bold')
  doc.text('Total', cDesc + 2, 214)
  doc.text(`${totalQty.toFixed(3)} NOS`, cQty + 2, 214)

  // Separator
  doc.line(ml, 218, mr, 218)

  // ----------------------------------------------------
  // BOTTOM SECTION
  // ----------------------------------------------------
  doc.setFontSize(8)
  doc.setFont('Helvetica', 'normal')
  
  doc.text('E. & O.E.', mr - 18, 222)

  // Bottom grids divider
  doc.line(ml, 230, mr, 230)
  doc.line(105, 230, 105, 280) // bottom middle vertical line

  // Left Bottom (X=10 to 105)
  doc.setFont('Helvetica', 'normal')
  doc.text(`Company's PAN     :  ${settings.company_pan || 'Not Configured'}`, ml + 3, 234)
  doc.setFont('Helvetica', 'bold')
  doc.text('Recd. in Good Condition', ml + 3, 244)
  y = 265
  doc.line(ml + 3, y, ml + 53, y)
  y += 4
  doc.setFont('Helvetica', 'normal')
  doc.text("Consignee's Signature & Seal", ml + 3, y)

  // Right Bottom (X=105 to 200)
  doc.setFont('Helvetica', 'bold')
  doc.text(`for ${settings.brand_name || 'AK ENTERPRISES'}`, 145, 236, { align: 'center' })
  doc.text('Authorised Signatory', 145, 276, { align: 'center' })

  // Footer label
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('This is a Computer Generated Document', 105, 285, { align: 'center' })

  return doc.output('arraybuffer')
}
