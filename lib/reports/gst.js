// ================================================================
// GSTReportService
// ----------------------------------------------------------------
// Report-time GST derivation. GST/HSN is NOT persisted on orders —
// it is recomputed from the CURRENT product gst_percent + the order's
// shipping state, using the same GST-inclusive math as the invoice
// generator (lib/gst-utils.js). Every workbook + the definitions sheet
// state clearly that GST values are COMPUTED AT REPORT TIME.
//
// same-state (Maharashtra) → CGST = SGST = half rate
// different state           → IGST = full rate
// ================================================================
import { calculateItemGST, isSameState } from '../gst-utils.js'
import { getProductBrand } from '../product-metadata.js'

// Supplier (our) state — matches settings.supplier_state (Maharashtra).
export const SUPPLIER_STATE = 'Maharashtra'

/**
 * Full GST breakdown for one order_item.
 * @param {object} item      order_items row
 * @param {object} product   products row (may be null)
 * @param {string} customerState
 */
export function itemGST(item, product, customerState) {
  const priceInclusive = Number(item.price_snapshot) || 0
  const qty = Math.max(1, Number(item.quantity) || 1)
  const gstPercent = product && product.gst_percent != null ? Number(product.gst_percent) : 18
  const sameState = isSameState(customerState, SUPPLIER_STATE)
  const calc = calculateItemGST(priceInclusive, qty, gstPercent, sameState)
  return {
    ...calc,
    hsn_code: (product && product.hsn_code) || '',
    gst_percent: gstPercent,
    brand: getProductBrand(product),
    product_name: item.product_name_snapshot || (product && product.name) || 'Unknown Product'
  }
}

/**
 * Aggregate GST for a set of items given a shared customer state.
 * Returns totals + per-item rows.
 */
export function cartGST(items, customerState) {
  let taxable = 0
  let cgst = 0
  let sgst = 0
  let igst = 0
  let tax = 0
  const rows = (items || []).map((it) => {
    const g = itemGST(it.item, it.product, customerState)
    taxable += g.taxableValue
    cgst += g.cgst
    sgst += g.sgst
    igst += g.igst
    tax += g.taxAmount
    return { ...g, order_item_id: it.item.id }
  })
  const round = (n) => Math.round(n * 100) / 100
  return {
    rows,
    totalTaxable: round(taxable),
    totalCGST: round(cgst),
    totalSGST: round(sgst),
    totalIGST: round(igst),
    totalGST: round(tax),
    customerState,
    supplierState: SUPPLIER_STATE,
    sameState: isSameState(customerState, SUPPLIER_STATE)
  }
}
