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

// ================================================================
// LAYOUT CONSTANTS
// ================================================================
const ML = 10, MR = 200, PW = MR - ML, MID = 105
const PAGE_TOP = 15
const PAGE_BOTTOM = 282
const BOTTOM_BLOCK_RESERVE = 45 // space needed for PAN/Recd block + signatures

function sellerBlockHeight(addrLineCount) {
  return 3 + 4 + addrLineCount * 3.5 + 1 + 3.5 + 3.5 + 3.5
}

function addrBlockHeight(lineCount, hasGst) {
  return 3 + 3.5 + 3.5 + Math.max(0, lineCount - 1) * 3.5 + 0.5 + (hasGst ? 3.5 : 0) + 3.5
}

function drawOuterBorder(doc, top, bottom) {
  doc.setLineWidth(0.3)
  doc.rect(ML, top, PW, bottom - top)
}

function drawPageTitle(doc, text) {
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(text, MID, 12, { align: 'center' })
}

function drawTableHeaderRow(doc, y, cols) {
  const { cSl, cDesc, cHsn, cQty, cEnd } = cols
  doc.line(ML, y, MR, y)
  doc.line(ML, y + 6, MR, y + 6)
  ;[cSl, cDesc, cHsn, cQty, cEnd].forEach(cx => doc.line(cx, y, cx, y + 6))
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Sl', cSl + 2, y + 2.8)
  doc.text('No.', cSl + 2, y + 5.4)
  doc.text('Description of Goods', cDesc + 2, y + 4)
  doc.text('HSN/SAC', cHsn + 2, y + 4)
  doc.text('Quantity', cQty + 2, y + 4)
  return y + 6
}

export async function generateChallanPDF(order, settings) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const companyGst = settings.company_gstin || ''
  const companyStateCode = companyGst.slice(0, 2) || '27'

  let addr = order.address || order.addresses || {}
  if (Array.isArray(addr)) addr = addr[0] || {}
  const profile = order.customer_profile || {}
  const customerGst = profile.gst_number || addr.gst || ''
  const customerStateCode = customerGst.slice(0, 2) || getStateGSTCode(addr.state)

  const companyAddrText = settings.company_address || settings.company_registered_address || settings.contact_address || 'GROUND FLOOR, SHOP NO 2 DAMODHAR\nAPARTMENT ,CTC NO 5, GARDEN VIEW APARTMENT\nERADWANE, PUNE'
  const companyAddrLines = doc.splitTextToSize(companyAddrText, 90)
  const customerDisplayName = (profile.business_name || addr.business_name || addr.full_name || 'Customer')

  // Defensive: Ensure phone is actually a phone number, not an email
  // If phone looks like an email (contains @), try to use profile phone or leave empty
  let displayPhone = addr.phone || ''
  if (displayPhone && displayPhone.includes('@')) {
    // Phone field contains email - this is a data issue
    // Try to get phone from user profile as fallback
    displayPhone = profile.phone || ''
  }

  const shipAddrLines = [
    customerDisplayName,
    addr.line1 || '',
    addr.line2 || '',
    `${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`,
    displayPhone ? `Phone: ${displayPhone}` : ''
  ].filter(Boolean)
  const consigneeLines = []
  shipAddrLines.forEach(line => { consigneeLines.push(...doc.splitTextToSize(line, 90)) })
  // Since we always show GSTIN line (even if empty), always account for it in height
  const hasCustGst = true

  // ================================================================
  // DYNAMIC TOP-SECTION HEIGHTS — prevents Consignee/Buyer text
  // from overlapping into the next box when the address wraps long.
  // ================================================================
  const sellerH = Math.max(23, sellerBlockHeight(companyAddrLines.length))
  const consigneeH = Math.max(20, addrBlockHeight(consigneeLines.length, hasCustGst))
  const buyerContentH = addrBlockHeight(consigneeLines.length, hasCustGst)

  const sellerTop = PAGE_TOP
  const consigneeTop = sellerTop + sellerH
  const buyerTop = consigneeTop + consigneeH
  const topBottom = Math.max(95, buyerTop + buyerContentH)

  // ================================================================
  // HEADER — "DELIVERY NOTE"
  // ================================================================
  drawPageTitle(doc, 'DELIVERY NOTE')

  // ================================================================
  // TOP SECTION dividers
  // ================================================================
  doc.setLineWidth(0.3)
  doc.line(MID, PAGE_TOP, MID, topBottom)
  doc.line(ML, consigneeTop, MID, consigneeTop)
  doc.line(ML, buyerTop, MID, buyerTop)

  // ---- Seller Details ----
  let y = sellerTop + 3
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(settings.brand_name || 'AK Enterprises', ML + 2, y)
  y += 4
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  companyAddrLines.forEach(line => { doc.text(line, ML + 2, y); y += 3.5 })
  y += 1
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`GSTIN/UIN   :  ${companyGst}`, ML + 2, y); y += 3.5
  doc.text(`State Name  :  Maharashtra, Code : ${companyStateCode}`, ML + 2, y); y += 3.5
  doc.setFont('Helvetica', 'normal')
  doc.text(`E-Mail : ${settings.contact_email || 'akenterprises1411@gmail.com'}`, ML + 2, y)

  // ---- Consignee (Ship to) ----
  y = consigneeTop + 3
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Consignee (Ship to)', ML + 2, y)
  y += 3.5
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(consigneeLines[0] || '', ML + 2, y)
  y += 3.5
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  consigneeLines.slice(1).forEach(line => { doc.text(line, ML + 2, y); y += 3.5 })
  y += 0.5
  // GSTIN/UIN line - show "GSTIN/UIN: -" when empty (Tally style)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`GSTIN/UIN: ${customerGst || '—'}`, ML + 2, y); y += 3.5
  doc.setFont('Helvetica', 'normal')
  doc.text(`State Name  :  ${addr.state || ''}, Code : ${customerStateCode || '—'}`, ML + 2, y)

  // ---- Buyer (Bill to) ----
  y = buyerTop + 3
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Buyer (Bill to)', ML + 2, y)
  y += 3.5
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(consigneeLines[0] || '', ML + 2, y)
  y += 3.5
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  consigneeLines.slice(1).forEach(line => { doc.text(line, ML + 2, y); y += 3.5 })
  y += 0.5
  // GSTIN/UIN line - show "GSTIN/UIN: -" when empty (Tally style)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`GSTIN/UIN: ${customerGst || '—'}`, ML + 2, y); y += 3.5
  doc.setFont('Helvetica', 'normal')
  doc.text(`State Name  :  ${addr.state || ''}, Code : ${customerStateCode || '—'}`, ML + 2, y)

  // ---- Right Grid ----
  ;[25, 35, 45, 55, 65, 75].forEach(ry => doc.line(MID, ry, MR, ry))
  doc.line(MID, topBottom, MR, topBottom)
  doc.line(152.5, PAGE_TOP, 152.5, 75)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Delivery Note No.', MID + 3, 19)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`${order.order_number.slice(-4)}`, MID + 3, 23.5)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Dated', 155, 19)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(new Date(order.placed_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'), 155, 23.5)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Delivery Note', MID + 3, 29); doc.text('—', MID + 3, 33)
  doc.text('Mode/Terms of Payment', 155, 29)
  doc.setFont('Helvetica', 'bold')
  doc.text('Credit Terms', 155, 33)

  doc.setFont('Helvetica', 'normal')
  doc.text('Reference No. & Date.', MID + 3, 39); doc.text('—', MID + 3, 43)
  doc.text('Other References', 155, 39); doc.text('—', 155, 43)

  doc.text("Buyer's Order No.", MID + 3, 49); doc.text('—', MID + 3, 53)
  doc.text('Dated', 155, 49); doc.text('—', 155, 53)

  doc.text('Dispatch Doc No.', MID + 3, 59); doc.text('—', MID + 3, 63)
  doc.text('Delivery Note Date', 155, 59); doc.text('—', 155, 63)

  doc.text('Dispatched through', MID + 3, 69); doc.text('—', MID + 3, 73)
  doc.text('Destination', 155, 69)
  doc.setFont('Helvetica', 'bold')
  doc.text((addr.city || '—').toUpperCase(), 155, 73)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Terms of Delivery', MID + 3, 82)

  // ================================================================
  // ITEMS TABLE — 4 columns (no Rate/Amount), with page-break support
  // ================================================================
  const cols = { cSl: ML, cDesc: 18, cHsn: 130, cQty: 160, cEnd: MR }
  const { cSl, cDesc, cHsn, cQty, cEnd } = cols

  let tableY = drawTableHeaderRow(doc, topBottom, cols)
  let pageTop = PAGE_TOP
  let totalQty = 0
  const orderItemsList = order.items || order.order_items || []

  orderItemsList.forEach((it, idx) => {
    const qtyNum = Number(it.quantity || 0)
    totalQty += qtyNum
    const unitSymbol = (it.products?.unit || it.unit || 'NOS').toUpperCase()
    const descText = `${it.product_name_snapshot || ''} @${it.products?.gst_percent ?? it.gst_percent ?? 18}%`
    const descLines = doc.splitTextToSize(descText, 108)
    const rowH = Math.max(descLines.length * 3.5 + 2, 5)

    if (tableY + rowH > PAGE_BOTTOM) {
      drawOuterBorder(doc, pageTop, tableY)
      doc.setFont('Helvetica', 'italic')
      doc.setFontSize(7)
      doc.text('Continued on next page...', MR, tableY + 4, { align: 'right' })
      doc.addPage()
      drawPageTitle(doc, 'DELIVERY NOTE (Contd.)')
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Delivery Note ${order.order_number.slice(-4)}`, ML, 12)
      pageTop = PAGE_TOP
      tableY = drawTableHeaderRow(doc, PAGE_TOP, cols)
    }

    doc.line(ML, tableY + rowH, MR, tableY + rowH)
    ;[cSl, cDesc, cHsn, cQty, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + rowH))

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(String(idx + 1), cSl + 3, tableY + 3.5)

    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(8)
    descLines.forEach((line, li) => { doc.text(line, cDesc + 2, tableY + 2.5 + li * 3.5) })
    doc.setFont('Helvetica', 'normal')

    doc.setFontSize(8)
    doc.text(getProductHsn(it) || '—', cHsn + 2, tableY + 3.5)

    doc.setFont('Helvetica', 'bold')
    doc.text(`${qtyNum.toFixed(3)} ${unitSymbol}`, cQty + 2, tableY + 3.5)
    doc.setFont('Helvetica', 'normal')

    tableY += rowH
  })

  if (tableY + BOTTOM_BLOCK_RESERVE > PAGE_BOTTOM) {
    drawOuterBorder(doc, pageTop, tableY)
    doc.setFont('Helvetica', 'italic')
    doc.setFontSize(7)
    doc.text('Continued on next page...', MR, tableY + 4, { align: 'right' })
    doc.addPage()
    drawPageTitle(doc, 'DELIVERY NOTE (Contd.)')
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Delivery Note ${order.order_number.slice(-4)}`, ML, 12)
    pageTop = PAGE_TOP
    tableY = PAGE_TOP
  }

  // ================================================================
  // TOTAL ROW — bold border
  // ================================================================
  doc.setLineWidth(0.5)
  doc.line(ML, tableY, MR, tableY)
  doc.line(ML, tableY + 6, MR, tableY + 6)
  doc.setLineWidth(0.3)
  ;[cSl, cDesc, cHsn, cQty, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + 6))

  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Total', cDesc + 2, tableY + 4.5)
  doc.text(`${totalQty.toFixed(3)} NOS`, cQty + 2, tableY + 4.5)
  tableY += 6

  // ================================================================
  // E. & O.E.
  // ================================================================
  doc.line(ML, tableY + 5, MR, tableY + 5)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('E. & O.E.', MR - 15, tableY + 3.5)
  tableY += 5

  // ================================================================
  // BOTTOM SECTION — height derived from actual content instead of
  // being stretched to a fixed page position.
  // ================================================================
  const sigY = tableY + 26
  const bottomY = sigY + 10

  doc.line(ML, tableY, MR, tableY)
  doc.line(MID, tableY, MID, bottomY)

  // ---- Left: PAN + Recd. in Good Condition ----
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Company's PAN     :  ${settings.company_pan || 'Not Configured'}`, ML + 2, tableY + 4)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Recd. in Good Condition', ML + 2, tableY + 10)

  // Consignee signature line
  doc.line(ML + 2, sigY, ML + 93, sigY)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text("Consignee's Signature & Seal", ML + 48, sigY + 3, { align: 'center' })

  // ---- Right: Authorised Signatory ----
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`for ${settings.brand_name || 'AK ENTERPRISES'}`, 152, tableY + 4, { align: 'center' })
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(settings.brand_name || 'AK ENTERPRISES', 152, tableY + 8, { align: 'center' })

  doc.line(115, sigY, 195, sigY)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Authorised Signatory', 152, sigY + 3, { align: 'center' })

  // ================================================================
  // OUTER BORDER + FOOTER
  // ================================================================
  drawOuterBorder(doc, pageTop, bottomY)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('This is a Computer Generated Document', MID, bottomY + 4, { align: 'center' })

  return doc.output('arraybuffer')
}