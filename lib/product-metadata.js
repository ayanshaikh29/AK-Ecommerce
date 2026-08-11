// ================================================================
// Product metadata extraction
// ----------------------------------------------------------------
// The live `products` table has NO `brand`, `subcategory`, or `images`
// columns. When a product is created/edited through the admin form the
// extra fields are embedded as a `<!--METADATA:{...}-->` JSON comment
// inside `products.description`. This module extracts them safely so
// reports can display Brand / Subcategory without inventing values.
// ================================================================

export function extractMetadata(prod) {
  if (!prod) return {}
  let brand = ''
  let unit = ''
  let tags = []
  let thumbnail = ''

  let cleanDescription = prod.description || ''
  const metaMatch = cleanDescription.match(/<!--METADATA:([\s\S]*?)-->/)
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1])
      brand = meta.brand || ''
      unit = meta.unit || ''
      tags = Array.isArray(meta.tags) ? meta.tags : []
      thumbnail = meta.thumbnail || ''
      cleanDescription = cleanDescription.replace(/<!--METADATA:([\s\S]*?)-->/, '').trim()
    } catch (e) {
      // Non-fatal — metadata comment is malformed; report falls back to ''
    }
  }

  return {
    brand,
    unit: prod.unit || unit,
    tags,
    thumbnail,
    hsn_code: prod.hsn_code || '',
    gst_percent: prod.gst_percent !== undefined && prod.gst_percent !== null ? Number(prod.gst_percent) : 18,
    cleanDescription
  }
}

/**
 * Brand for a product. Returns '' when unknown (report shows "Not available").
 */
export function getProductBrand(prod) {
  if (!prod) return ''
  if (prod.brand) return String(prod.brand)
  return extractMetadata(prod).brand || ''
}
