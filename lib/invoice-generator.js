import { jsPDF } from 'jspdf'
import { numberToIndianWords } from './number-to-words.js'

const SUPPLIER_STATE = 'maharashtra'

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

function formatINR(n) {
  return Number(n || 0).toFixed(2)
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

    return { ...it, gstPct, grossAmount, taxableValue, cgst, sgst, igst, total: (rate - discount) * qty }
  })

  return { sameState, totalTaxable, totalCGST, totalSGST, totalIGST, parsedItems }
}

// ================================================================
// LAYOUT CONSTANTS
// ================================================================
const ML = 10, MR = 200, PW = MR - ML, MID = 120
const PAGE_TOP = 15
const PAGE_BOTTOM = 282           // last safe y before the physical page edge (A4 = 297mm)
const BOTTOM_BLOCK_RESERVE = 76   // space needed for subtotal+tax+total+words+declaration/bank/signature

// Height (mm) consumed by the seller block, given how many address lines it wraps to.
function sellerBlockHeight(addrLineCount) {
  return 3 + 4 + addrLineCount * 3.5 + 1 + 3.5 + 3.5 + 3.5
}

// Height (mm) consumed by a Consignee/Buyer block, given wrapped line count and whether a GSTIN row is shown.
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
  const { cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd } = cols
  doc.line(ML, y, MR, y)
  doc.line(ML, y + 6, MR, y + 6)
  ;[cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd].forEach(cx => doc.line(cx, y, cx, y + 6))
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Sl', cSl + 2, y + 2.8)
  doc.text('No.', cSl + 2, y + 5.4)
  doc.text('Description of Goods', cDesc + 2, y + 4)
  doc.text('HSN/SAC', cHsn + 2, y + 4)
  doc.text('Quantity', cQty + 2, y + 4)
  doc.text('Rate', cRate + 2, y + 4)
  doc.text('per', cPer + 1, y + 4)
  doc.text('Amount', cAmt + 2, y + 4)
  return y + 6
}

export async function generateInvoicePDF(order, settings) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const companyGst = settings.company_gstin || ''
  const companyStateCode = companyGst.slice(0, 2) || '27'

  let addr = order.address || order.addresses || {}
  if (Array.isArray(addr)) addr = addr[0] || {}
  const profile = order.customer_profile || {}
  const customerGst = profile.gst_number || addr.gst || ''
  const customerStateCode = customerGst.slice(0, 2) || getStateGSTCode(addr.state)

  const companyAddrText = settings.company_address || settings.company_registered_address || settings.contact_address || 'GROUND FLOOR, SHOP NO 2 DAMODHAR\nAPARTMENT ,CTC NO 5, GARDEN VIEW APARTMENT\nERADWANE, PUNE'
  const companyAddrLines = wrapText(doc, companyAddrText, MID - ML - 4) // Wider wrap based on MID
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
  // This handles the case where database has duplicate address data
  const dedupedAddrLines = []
  for (const line of shipAddrLines) {
    const trimmed = line.trim().toLowerCase()
    const lastAdded = dedupedAddrLines[dedupedAddrLines.length - 1]?.trim().toLowerCase()
    if (trimmed !== lastAdded) {
      dedupedAddrLines.push(line)
    }
  }

  // BUG 2 & 3 FIX: Use custom wrapText() instead of doc.splitTextToSize()
  // wrapText respects word boundaries — never cuts mid-word, never produces duplicates
  const LEFT_MID = ML + (MID - ML) / 2
  const consigneeMaxW = LEFT_MID - ML - 4
  const buyerMaxW = MID - LEFT_MID - 4

  const consigneeLinesLeft = []
  doc.setFontSize(7.0) // Set font size for text width measurement
  dedupedAddrLines.forEach(line => { consigneeLinesLeft.push(...wrapText(doc, line, consigneeMaxW)) })

  const buyerLinesLeft = []
  dedupedAddrLines.forEach(line => { buyerLinesLeft.push(...wrapText(doc, line, buyerMaxW)) })

  // Since we always show GSTIN line (even if empty), always account for it in height
  const hasCustGst = !!customerGst

  const customerState = addr.state || ''
  const orderItemsList = order.items || order.order_items || []
  const { sameState, totalTaxable, totalCGST, totalSGST, totalIGST, parsedItems } = computeGST(orderItemsList, customerState)

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
  // Both Consignee and Buyer share the same row height (max of both)
  const addrRowH = Math.max(20, consigneeH, buyerContentH)
  // Dynamic topBottom starts at least at 45 (Invoice details (20) + Order By (10) = 45)
  const topBottom = Math.max(45, consigneeTop + addrRowH)

  // ================================================================
  // HEADER — "Tax Invoice"
  // ================================================================
  drawPageTitle(doc, 'Tax Invoice')

  // ================================================================
  // TOP SECTION dividers
  // ================================================================
  doc.setLineWidth(0.3)
  doc.line(MID, PAGE_TOP, MID, topBottom)   // vertical center divider
  doc.line(ML, consigneeTop, MID, consigneeTop)  // below seller
  doc.line(LEFT_MID, consigneeTop, LEFT_MID, topBottom)  // Consignee | Buyer vertical divider

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

  // ---- Consignee (Ship to) — LEFT quarter of left half ----
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
  // GSTIN always shown (with placeholder when empty — Tally style)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('GSTIN/UIN: ' + (customerGst || '—'), ML + 2, y); y += 3.0
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('State: ' + (addr.state || '') + (customerStateCode ? ' / ' + customerStateCode : ''), ML + 2, y)

  // ---- Buyer (Bill to) — RIGHT quarter of left half (shares same row as Consignee) ----
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
  // GSTIN always shown (with placeholder when empty — Tally style)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('GSTIN/UIN: ' + (customerGst || '—'), LEFT_MID + 2, y); y += 3.0
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('State: ' + (addr.state || '') + (customerStateCode ? ' / ' + customerStateCode : ''), LEFT_MID + 2, y)

  // ---- Right Grid (compact — 2 rows + compact Order By) ----
  // Row 1 divider: Invoice No | Dated
  doc.line(MID, PAGE_TOP + 10, MR, PAGE_TOP + 10)
  // Row 2 divider: Payment | Destination
  doc.line(MID, PAGE_TOP + 20, MR, PAGE_TOP + 20)
  // Row 3 divider: Order By bottom line (making box exactly 10mm high, Y=35 to 45)
  doc.line(MID, PAGE_TOP + 30, MR, PAGE_TOP + 30)
  // Vertical sub-divider for first two rows (centered between MID and MR)
  const gridMidX = MID + (MR - MID) / 2 // 160 when MID=120
  doc.line(gridMidX, PAGE_TOP, gridMidX, PAGE_TOP + 20)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Invoice No.', MID + 3, PAGE_TOP + 4)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('AKE-' + order.order_number, MID + 3, PAGE_TOP + 8.5)
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
  const rawFullName = profile.full_name || addr.full_name || ''
  const looksLikeCompany = rawFullName && (
    rawFullName === rawFullName.toUpperCase() ||
    /\b(LTD|PVT|GIC|INC|LLP|CORP|CO\.|COMPANY)\b/i.test(rawFullName)
  )
  const orderBy = looksLikeCompany ? (profile.full_name !== rawFullName ? profile.full_name : addr.business_name || profile.company_name || rawFullName) : (rawFullName || '—')
  doc.text(orderBy, MID + 3, PAGE_TOP + 28.5)

  // ================================================================
  // ITEMS TABLE — with page-break support
  // ================================================================
  const cols = { cSl: ML, cDesc: 18, cHsn: 110, cQty: 130, cRate: 150, cPer: 168, cAmt: 178, cEnd: MR }
  const { cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd } = cols

  let tableY = drawTableHeaderRow(doc, topBottom, cols)
  let pageTop = PAGE_TOP // top of border box on the CURRENT page

  parsedItems.forEach((it, idx) => {
    const qtyNum = Number(it.quantity || 0)
    const unitSymbol = (it.products?.unit || it.unit || 'NOS').toUpperCase()
    const descText = `${it.product_name_snapshot || ''} @${it.gstPct}%`
    const descLines = wrapText(doc, descText, 88)
    const rowH = Math.max(descLines.length * 3.5 + 2, 5)

    // Page break: if this row won't fit, close this page and continue on a new one
    if (tableY + rowH > PAGE_BOTTOM) {
      drawOuterBorder(doc, pageTop, tableY)
      doc.setFont('Helvetica', 'italic')
      doc.setFontSize(7)
      doc.text('Continued on next page...', MR, tableY + 4, { align: 'right' })
      doc.addPage()
      drawPageTitle(doc, 'Tax Invoice (Contd.)')
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`AKE-${order.order_number}`, ML, 12)
      pageTop = PAGE_TOP
      tableY = drawTableHeaderRow(doc, PAGE_TOP, cols)
    }

    doc.line(ML, tableY + rowH, MR, tableY + rowH)
    ;[cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + rowH))

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

    const taxExclusiveRate = it.price_snapshot / (1 + it.gstPct / 100)
    doc.text(formatINR(taxExclusiveRate), cRate + 2, tableY + 3.5)

    doc.text(unitSymbol, cPer + 1, tableY + 3.5)

    // Right-align amount with dynamic X position calculation to prevent overflow
    const amountStr = formatINR(it.taxableValue)
    const amountCellRight = cEnd
    const amountPadding = 2
    const amountTextWidth = doc.getTextWidth(amountStr)
    const amountXPos = amountCellRight - amountPadding - amountTextWidth
    doc.text(amountStr, amountXPos, tableY + 3.5)
    doc.setFont('Helvetica', 'normal')

    tableY += rowH
  })

  // If the remaining totals/declaration block won't fit on this page, start a fresh page for it
  if (tableY + BOTTOM_BLOCK_RESERVE > PAGE_BOTTOM) {
    drawOuterBorder(doc, pageTop, tableY)
    doc.setFont('Helvetica', 'italic')
    doc.setFontSize(7)
    doc.text('Continued on next page...', MR, tableY + 4, { align: 'right' })
    doc.addPage()
    drawPageTitle(doc, 'Tax Invoice (Contd.)')
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`AKE-${order.order_number}`, ML, 12)
    pageTop = PAGE_TOP
    tableY = PAGE_TOP
  }

  // ================================================================
  // SUBTOTAL ROW
  // ================================================================
  doc.line(ML, tableY + 5, MR, tableY + 5)
  ;[cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + 5))
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(formatINR(totalTaxable), cAmt + 18, tableY + 3.5, { align: 'right' })
  tableY += 5

  // ================================================================
  // TAX ROWS
  // ================================================================
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  if (sameState) {
    doc.line(ML, tableY + 5, MR, tableY + 5)
    ;[cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + 5))
    doc.text('CGST @ 9%', cDesc + 45, tableY + 3.5)
    doc.text('9 %', cPer + 1, tableY + 3.5)
    doc.text(formatINR(totalCGST), cAmt + 18, tableY + 3.5, { align: 'right' })
    tableY += 5

    doc.line(ML, tableY + 5, MR, tableY + 5)
    ;[cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + 5))
    doc.text('SGST @ 9%', cDesc + 45, tableY + 3.5)
    doc.text('9 %', cPer + 1, tableY + 3.5)
    doc.text(formatINR(totalSGST), cAmt + 18, tableY + 3.5, { align: 'right' })
    tableY += 5
  } else {
    doc.line(ML, tableY + 5, MR, tableY + 5)
    ;[cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + 5))
    doc.text('IGST @ 18%', cDesc + 45, tableY + 3.5)
    doc.text('18 %', cPer + 1, tableY + 3.5)
    doc.text(formatINR(totalIGST), cAmt + 18, tableY + 3.5, { align: 'right' })
    tableY += 5
  }

  // ================================================================
  // GRAND TOTAL ROW — bold border
  // ================================================================
  doc.setLineWidth(0.5)
  doc.line(ML, tableY, MR, tableY)
  doc.line(ML, tableY + 6, MR, tableY + 6)
  doc.setLineWidth(0.3)
  ;[cSl, cDesc, cHsn, cQty, cRate, cPer, cAmt, cEnd].forEach(cx => doc.line(cx, tableY, cx, tableY + 6))

  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Total', cDesc + 2, tableY + 4.5)

  // Right-align amount with dynamic X position calculation to prevent overflow
  const totalAmountStr = `Rs. ${formatINR(order.total)}`
  const cellRightEdge = cEnd
  const cellPadding = 2
  // Get text width to calculate proper X position
  const totalTextWidth = doc.getTextWidth(totalAmountStr)
  const totalXPos = cellRightEdge - cellPadding - totalTextWidth
  // If text is too wide for cell, reduce font size
  if (totalTextWidth > (cEnd - cAmt - 5)) {
    doc.setFontSize(8)
    const adjustedTextWidth = doc.getTextWidth(totalAmountStr)
    doc.text(totalAmountStr, cellRightEdge - cellPadding - adjustedTextWidth, tableY + 4.5)
    doc.setFontSize(9) // restore font size
  } else {
    doc.text(totalAmountStr, totalXPos, tableY + 4.5)
  }
  tableY += 6

  // ================================================================
  // AMOUNT IN WORDS + E.&O.E.
  // ================================================================
  doc.line(ML, tableY + 7, MR, tableY + 7)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Amount Chargeable (in words)', ML + 2, tableY + 3)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(numberToIndianWords(order.total), ML + 2, tableY + 6)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('E. & O.E.', MR - 15, tableY + 3)
  tableY += 7

  // ================================================================
  // BOTTOM SECTION: Declaration (left) | Bank Details (right)
  // Height is now derived from actual content instead of being
  // stretched to a fixed page position — this removes the large
  // empty gap that used to appear on short invoices.
  // ================================================================
  const bottomY = tableY + 47

  doc.line(ML, tableY, MR, tableY)
  doc.line(MID, tableY, MID, bottomY)

  // ---- Declaration (left) ----
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Company's PAN     :  ${settings.company_pan || 'Not Configured'}`, ML + 2, tableY + 4)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Declaration', ML + 2, tableY + 9)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  const declLines = wrapText(doc, 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', 90)
  declLines.forEach((line, idx) => { doc.text(line, ML + 2, tableY + 12.5 + idx * 3.5) })

  // ---- Bank Details (right) ----
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text("Company's Bank Details", MID + 3, tableY + 4)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Bank Name     :  ${settings.bank_name || 'ICICI BANK'}`, MID + 3, tableY + 8)
  doc.text(`A/c No.            :  ${settings.bank_account_no || '646105500575'}`, MID + 3, tableY + 12)
  doc.text(`Branch & IFS   :  ${settings.bank_branch || 'PUNE ERANDWANE'} & ${settings.bank_ifsc || 'ICIC0006461'}`, MID + 3, tableY + 16)

  // ---- Signature (right, below bank details) ----
  doc.line(MID, tableY + 20, MR, tableY + 20)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`for ${settings.brand_name || 'AK ENTERPRISES'}`, 152, tableY + 24, { align: 'center' })
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(settings.brand_name || 'AK ENTERPRISES', 152, tableY + 28, { align: 'center' })
  doc.line(120, tableY + 40, 195, tableY + 40)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Authorised Signatory', 152, tableY + 43, { align: 'center' })

  // ================================================================
  // OUTER BORDER + FOOTER (closes the box at its real content height)
  // ================================================================
  drawOuterBorder(doc, pageTop, bottomY)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('This is a Computer Generated Invoice', MID, bottomY + 4, { align: 'center' })

  return doc.output('arraybuffer')
}