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
const ML = 10, MR = 200, PW = MR - ML, MID = 105
const PAGE_TOP = 15
const PAGE_BOTTOM = 282           // last safe y before the physical page edge (A4 = 297mm)
const BOTTOM_BLOCK_RESERVE = 76   // space needed for subtotal+tax+total+words+declaration/bank/signature

// Height (mm) consumed by the seller block, given how many address lines it wraps to.
function sellerBlockHeight(addrLineCount) {
  return 3 + 4 + addrLineCount * 3.5 + 1 + 3.5 + 3.5 + 3.5
}

// Height (mm) consumed by a Consignee/Buyer block, given wrapped line count and whether a GSTIN row is shown.
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
  const companyAddrLines = doc.splitTextToSize(companyAddrText, 90)
  const customerDisplayName = (profile.business_name || addr.business_name || addr.full_name || 'Customer')
  const shipAddrLines = [
    customerDisplayName,
    addr.line1 || '',
    addr.line2 || '',
    `${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`,
    addr.phone ? `Phone: ${addr.phone}` : ''
  ].filter(Boolean)
  const consigneeLines = []
  shipAddrLines.forEach(line => { consigneeLines.push(...doc.splitTextToSize(line, 90)) })
  // Since we always show GSTIN line (even if empty), always account for it in height
  const hasCustGst = true

  const customerState = addr.state || ''
  const orderItemsList = order.items || order.order_items || []
  const { sameState, totalTaxable, totalCGST, totalSGST, totalIGST, parsedItems } = computeGST(orderItemsList, customerState)

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
  const topBottom = Math.max(95, buyerTop + buyerContentH) // buyer box (and right-side grid) end here

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
  doc.line(ML, buyerTop, MID, buyerTop)          // below consignee
  // (no line below buyer — it runs down to topBottom, matching the reference layout)

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
  doc.text('Invoice No.', MID + 3, 19)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`AKE-${order.order_number}`, MID + 3, 23.5)
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
    const descLines = doc.splitTextToSize(descText, 88)
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
  const declLines = doc.splitTextToSize('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', 90)
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