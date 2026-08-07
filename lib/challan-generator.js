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
// REUSABLE TEXT WRAPPING — word-boundary safe, no mid-word cuts
// ================================================================
// Replaces doc.splitTextToSize() which has known bugs:
// - can merge words without spaces ("GandhinaAhmedabad")
// - can produce duplicate lines
//
// This function splits on spaces, measures each word with
// doc.getTextWidth(), and builds lines that never exceed maxWidth.
function wrapText(doc, text, maxWidth) {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = doc.getTextWidth(testLine)
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

// ================================================================
// LAYOUT CONSTANTS
// ================================================================
const ML = 10, MR = 200, PW = MR - ML, MID = 120
const PAGE_TOP = 15
const PAGE_BOTTOM = 282
const BOTTOM_BLOCK_RESERVE = 45 // space needed for PAN/Recd block + signatures

function sellerBlockHeight(addrLineCount) {
  return 3 + 4 + addrLineCount * 3.5 + 1 + 3.5 + 3.5 + 3.5
}

function addrBlockHeight(lineCount, hasGst) {
  // 3 (top padding) + 3.2 (first line) + (lineCount - 1) * 3.0 (remaining lines) + 0.5 (gap) + 3.0 (GSTIN line) + 3.0 (State line) + 3.0 (bottom padding)
  return 3 + 3.2 + Math.max(0, lineCount - 1) * 3.0 + 0.5 + 3.0 + 3.0 + 3.0
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
  const companyAddrLines = wrapText(doc, companyAddrText, MID - ML - 4)
  const customerDisplayName = (profile.business_name || profile.company_name || addr.business_name || addr.full_name || 'Customer')

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

  // DEDUPLICATION: Remove consecutive duplicate lines (same text in line1 & line2)
  const dedupedAddrLines = []
  for (const line of shipAddrLines) {
    const trimmed = line.trim().toLowerCase()
    const lastAdded = dedupedAddrLines[dedupedAddrLines.length - 1]?.trim().toLowerCase()
    if (trimmed !== lastAdded) {
      dedupedAddrLines.push(line)
    }
  }

  // BUG 2 & 3 FIX: Use custom wrapText() instead of doc.splitTextToSize()
  const LEFT_MID = ML + (MID - ML) / 2
  const consigneeMaxW = LEFT_MID - ML - 4
  const buyerMaxW = MID - LEFT_MID - 4

  const consigneeLinesLeft = []
  doc.setFontSize(7.0)
  dedupedAddrLines.forEach(line => { consigneeLinesLeft.push(...wrapText(doc, line, consigneeMaxW)) })

  const buyerLinesLeft = []
  dedupedAddrLines.forEach(line => { buyerLinesLeft.push(...wrapText(doc, line, buyerMaxW)) })

  // Since we always show GSTIN line (even if empty), always account for it in height
  const hasCustGst = true

  // ================================================================
  // DYNAMIC TOP-SECTION HEIGHTS — prevents Consignee/Buyer text
  // from overlapping into the next box when the address wraps long.
  // ================================================================
  const sellerH = Math.max(23, sellerBlockHeight(companyAddrLines.length))
  const maxAddrLineCount = Math.max(consigneeLinesLeft.length, buyerLinesLeft.length)
  const consigneeH = Math.max(20, addrBlockHeight(maxAddrLineCount, hasCustGst))
  const buyerContentH = addrBlockHeight(maxAddrLineCount, hasCustGst)

  const sellerTop = PAGE_TOP
  const consigneeTop = sellerTop + sellerH
  const addrRowH = Math.max(20, consigneeH, buyerContentH)
  const topBottom = Math.max(45, consigneeTop + addrRowH)

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
  doc.line(LEFT_MID, consigneeTop, LEFT_MID, topBottom)

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
  doc.setFontSize(6.5)
  doc.text('Consignee (Ship to)', ML + 2, y)
  y += 3.2
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(consigneeLinesLeft[0] || '', ML + 2, y)
  y += 3.0
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  consigneeLinesLeft.slice(1).forEach(line => { doc.text(line, ML + 2, y); y += 3.0 })
  y += 0.5
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(`GSTIN/UIN: ${customerGst || '—'}`, ML + 2, y); y += 3.0
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('State: ' + (addr.state || '') + (customerStateCode ? ' / ' + customerStateCode : ''), ML + 2, y)

  // ---- Buyer (Bill to) ----
  y = consigneeTop + 3
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Buyer (Bill to)', LEFT_MID + 2, y)
  y += 3.2
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(buyerLinesLeft[0] || '', LEFT_MID + 2, y)
  y += 3.0
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  buyerLinesLeft.slice(1).forEach(line => { doc.text(line, LEFT_MID + 2, y); y += 3.0 })
  y += 0.5
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(`GSTIN/UIN: ${customerGst || '—'}`, LEFT_MID + 2, y); y += 3.0
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('State: ' + (addr.state || '') + (customerStateCode ? ' / ' + customerStateCode : ''), LEFT_MID + 2, y)

  // ---- Right Grid (compact 2 rows + compact Order By) ----
  // Row 1 divider: Delivery Note No. | Dated
  doc.line(MID, PAGE_TOP + 10, MR, PAGE_TOP + 10)
  // Row 2 divider: Payment | Destination
  doc.line(MID, PAGE_TOP + 20, MR, PAGE_TOP + 20)
  // Row 3 divider: Order By bottom line
  doc.line(MID, PAGE_TOP + 30, MR, PAGE_TOP + 30)
  
  // Vertical divider centered between MID and MR
  const gridMidX = MID + (MR - MID) / 2
  doc.line(gridMidX, PAGE_TOP, gridMidX, PAGE_TOP + 20)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Delivery Note No.', MID + 3, PAGE_TOP + 4)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(`${order.order_number.slice(-4)}`, MID + 3, PAGE_TOP + 8.5)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Dated', gridMidX + 3, PAGE_TOP + 4)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(new Date(order.placed_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'), gridMidX + 3, PAGE_TOP + 8.5)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Mode/Terms of Payment', MID + 3, PAGE_TOP + 14)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Credit Terms', MID + 3, PAGE_TOP + 18.5)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Destination', gridMidX + 3, PAGE_TOP + 14)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text((addr.city || '-').toUpperCase(), gridMidX + 3, PAGE_TOP + 18.5)

  // Compact Dynamic Order By box
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Order By', MID + 3, PAGE_TOP + 24)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7.5)
  const orderBy = profile.full_name || addr.full_name || '—'
  doc.text(orderBy, MID + 3, PAGE_TOP + 28.5)

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
    const descLines = wrapText(doc, descText, 108)
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