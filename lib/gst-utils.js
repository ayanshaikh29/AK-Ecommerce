/**
 * GST Utility Functions for AK Enterprises
 *
 * GST Rule (Indian):
 *  - Same state as supplier → Split into CGST (half) + SGST (half)
 *  - Different state from supplier → Single IGST (full rate)
 *
 * Price assumption: prices stored are GST-INCLUSIVE.
 * Taxable value = price_inclusive / (1 + gst_rate/100)
 * Tax amount = price_inclusive - taxable_value
 */

const SUPPLIER_STATE_DEFAULT = 'Maharashtra'

/**
 * Normalize state name for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeState(state) {
  return (state || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Check if customer state matches supplier state
 */
export function isSameState(customerState, supplierState = SUPPLIER_STATE_DEFAULT) {
  return normalizeState(customerState) === normalizeState(supplierState)
}

/**
 * Calculate GST breakdown for a single item.
 * @param {number} priceInclusive - unit price inclusive of GST
 * @param {number} quantity
 * @param {number} gstPercent - GST rate (e.g. 18 for 18%)
 * @param {boolean} sameState - true → CGST+SGST, false → IGST
 * @returns {{ taxableValue, taxAmount, cgst, sgst, igst, totalAmount }}
 */
export function calculateItemGST(priceInclusive, quantity, gstPercent, sameState) {
  // Default to 18% if gstPercent is undefined, null, or invalid
  const rate = (gstPercent !== undefined && gstPercent !== null && !isNaN(Number(gstPercent))) 
    ? Number(gstPercent) 
    : 18
  const qty = Number(quantity) || 1
  const totalIncl = Number(priceInclusive) * qty

  let taxableValue, taxAmount

  if (rate === 0) {
    taxableValue = totalIncl
    taxAmount = 0
  } else {
    taxableValue = totalIncl / (1 + rate / 100)
    taxAmount = totalIncl - taxableValue
  }

  const cgst = sameState ? taxAmount / 2 : 0
  const sgst = sameState ? taxAmount / 2 : 0
  const igst = sameState ? 0 : taxAmount

  return {
    taxableValue: Math.round(taxableValue * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    cgstRate: sameState ? rate / 2 : 0,
    sgstRate: sameState ? rate / 2 : 0,
    igstRate: sameState ? 0 : rate,
    totalAmount: Math.round(totalIncl * 100) / 100,
    gstPercent: rate,
    sameState,
  }
}

/**
 * Calculate full GST breakdown for the entire cart/order.
 * @param {Array} items - each item should have { price_snapshot, quantity, gst_percent, hsn_code, product_name_snapshot }
 * @param {string} customerState
 * @param {string} supplierState
 * @returns {{ items: [], totalTaxable, totalCGST, totalSGST, totalIGST, totalTax, sameState }}
 */
export function calculateCartGST(items, customerState, supplierState = SUPPLIER_STATE_DEFAULT) {
  const sameState = isSameState(customerState, supplierState)

  let totalTaxable = 0
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0

  const breakdown = (items || []).map(item => {
    // Pass item.gst_percent if present; calculateItemGST defaults to 18% if missing
    const gstRate = (item.gst_percent !== undefined && item.gst_percent !== null) ? item.gst_percent : 18
    const gst = calculateItemGST(
      item.price_snapshot || item.price || 0,
      item.quantity || 1,
      gstRate,
      sameState
    )
    totalTaxable += gst.taxableValue
    totalCGST += gst.cgst
    totalSGST += gst.sgst
    totalIGST += gst.igst
    return {
      ...gst,
      product_name_snapshot: item.product_name_snapshot || item.name || '',
      hsn_code: item.hsn_code || '',
      product_id: item.product_id || item.id || null,
    }
  })

  const totalTax = Math.round((totalCGST + totalSGST + totalIGST) * 100) / 100

  return {
    items: breakdown,
    totalTaxable: Math.round(totalTaxable * 100) / 100,
    totalCGST: Math.round(totalCGST * 100) / 100,
    totalSGST: Math.round(totalSGST * 100) / 100,
    totalIGST: Math.round(totalIGST * 100) / 100,
    totalTax,
    sameState,
    customerState,
    supplierState,
  }
}

/**
 * Category minimum order value fallback definitions (in case database column min_order_value is not present)
 */
const DEFAULT_CATEGORY_MINIMUMS = {
  'housekeeping': 5000,
  'office-stationery': 2000,
  'ups-solutions': 0,
  'grocery': 0
}

/**
 * Validate per-category minimum order values for cart items.
 * @param {Array} cartItems - cart items with { category_id, category_name, category_slug, price_snapshot, quantity }
 * @param {Array} categories - categories with { id, name, slug, min_order_value }
 * @returns {Array} violations - array of { categoryName, currentValue, minValue, shortage } for categories not meeting minimum
 */
export function validateCategoryMinOrderValues(cartItems, categories) {
  if (!cartItems || cartItems.length === 0) return []

  const cats = (categories && categories.length > 0) ? categories : [
    { id: 'cat-hk', name: 'Housekeeping', slug: 'housekeeping', min_order_value: 5000 },
    { id: 'cat-os', name: 'Office Stationery', slug: 'office-stationery', min_order_value: 2000 },
    { id: 'cat-ups', name: 'UPS Solutions', slug: 'ups-solutions', min_order_value: 0 },
    { id: 'cat-groc', name: 'Grocery', slug: 'grocery', min_order_value: 0 }
  ]

  // Build category lookups (by id, by slug, and by normalized name)
  const catMapById = {}
  const catMapBySlug = {}
  const catMapByName = {}

  for (const cat of cats) {
    // If cat.min_order_value is missing/undefined in database, attach default rules
    const slugKey = (cat.slug || '').toLowerCase().trim()
    const fallbackMin = DEFAULT_CATEGORY_MINIMUMS[slugKey] ?? (slugKey.includes('stationery') ? 2000 : slugKey.includes('housekeeping') ? 5000 : 0)
    const enrichedCat = {
      ...cat,
      min_order_value: (cat.min_order_value !== undefined && cat.min_order_value !== null)
        ? Number(cat.min_order_value)
        : fallbackMin
    }

    if (cat.id) catMapById[cat.id] = enrichedCat
    if (cat.slug) catMapBySlug[slugKey] = enrichedCat
    if (cat.name) catMapByName[cat.name.toLowerCase().trim()] = enrichedCat
  }

  // Group cart items by category
  const categoryTotals = {}
  for (const item of cartItems) {
    let cat = null
    if (item.category_id && catMapById[item.category_id]) {
      cat = catMapById[item.category_id]
    } else if (item.category_slug && catMapBySlug[item.category_slug.toLowerCase()]) {
      cat = catMapBySlug[item.category_slug.toLowerCase()]
    } else if (item.category_name && catMapByName[item.category_name.toLowerCase().trim()]) {
      cat = catMapByName[item.category_name.toLowerCase().trim()]
    } else if (item.category && catMapByName[item.category.toLowerCase().trim()]) {
      cat = catMapByName[item.category.toLowerCase().trim()]
    }

    // Product name matching heuristic if item lacks category metadata
    if (!cat) {
      const pName = (item.product_name_snapshot || item.name || '').toLowerCase()
      if (pName.includes('pencil') || pName.includes('paper') || pName.includes('stationery') || pName.includes('pen') || pName.includes('file') || pName.includes('folder') || pName.includes('apsara')) {
        cat = catMapBySlug['office-stationery'] || Object.values(catMapBySlug).find(c => c.slug.includes('stationery'))
      } else if (pName.includes('spoon') || pName.includes('freshener') || pName.includes('lizol') || pName.includes('cleaner') || pName.includes('housekeeping')) {
        cat = catMapBySlug['housekeeping'] || Object.values(catMapBySlug).find(c => c.slug.includes('housekeeping'))
      }
    }

    if (!cat) continue

    const catKey = cat.id || cat.slug || cat.name
    if (!categoryTotals[catKey]) {
      categoryTotals[catKey] = {
        categoryId: cat.id,
        categoryName: cat.name,
        minOrderValue: cat.min_order_value,
        total: 0,
      }
    }
    categoryTotals[catKey].total += (item.price_snapshot || item.price || 0) * (item.quantity || 1)
  }

  // Check violations
  const violations = []
  for (const catKey of Object.keys(categoryTotals)) {
    const { categoryName, minOrderValue, total } = categoryTotals[catKey]
    if (minOrderValue && minOrderValue > 0 && total < minOrderValue) {
      violations.push({
        categoryName,
        currentValue: Math.round(total * 100) / 100,
        minValue: minOrderValue,
        shortage: Math.round((minOrderValue - total) * 100) / 100,
      })
    }
  }

  return violations
}
