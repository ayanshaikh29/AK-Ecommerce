export function validateInvoiceData(order, settings, isChallan = false) {
  // 1. Settings Validation
  if (!settings) {
    return { valid: false, error: 'Cannot generate document: settings not configured' }
  }
  if (!settings.brand_name) {
    return { valid: false, error: 'Cannot generate document: missing company name in settings' }
  }
  if (!settings.company_address && !settings.contact_address) {
    return { valid: false, error: 'Cannot generate document: missing company address in settings' }
  }
  if (!isChallan) {
    if (!settings.company_gstin || settings.company_gstin === 'Not Configured') {
      return { valid: false, error: 'Cannot generate invoice: missing company GSTIN in settings' }
    }
    if (!settings.company_pan || settings.company_pan === 'Not Configured') {
      return { valid: false, error: 'Cannot generate invoice: missing company PAN in settings' }
    }
  }

  // 2. Customer/Consignee Validation
  const addr = order.address || order.addresses || {}
  if (!addr.full_name) {
    return { valid: false, error: 'Cannot generate document: missing customer full name' }
  }
  if (!addr.phone) {
    return { valid: false, error: 'Cannot generate document: missing customer phone number' }
  }
  if (!addr.line1) {
    return { valid: false, error: 'Cannot generate document: customer address is incomplete (missing address line 1)' }
  }
  if (!addr.city) {
    return { valid: false, error: 'Cannot generate document: customer address is incomplete (missing city)' }
  }
  if (!addr.state) {
    return { valid: false, error: 'Cannot generate document: customer address is incomplete (missing state)' }
  }
  if (!addr.pincode) {
    return { valid: false, error: 'Cannot generate document: customer address is incomplete (missing pincode)' }
  }

  // 3. Order Items Validation
  const items = order.items || order.order_items || []
  if (items.length === 0) {
    return { valid: false, error: 'Cannot generate document: order has 0 items' }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const name = item.product_name_snapshot || ''
    if (!name) {
      return { valid: false, error: `Cannot generate document: item at index ${i + 1} is missing product name` }
    }
    if (!item.quantity || Number(item.quantity) <= 0) {
      return { valid: false, error: `Cannot generate document: item "${name}" has invalid quantity` }
    }
    if (!item.price_snapshot || Number(item.price_snapshot) <= 0) {
      return { valid: false, error: `Cannot generate document: item "${name}" has invalid price` }
    }
    if (!isChallan) {
      const hsn = item.hsn_code || (item.products && item.products.hsn_code) || ''
      if (!hsn) {
        return { valid: false, error: `Cannot generate invoice: item "${name}" is missing HSN code` }
      }
      const gst = item.gst_percent ?? (item.products && item.products.gst_percent) ?? null
      if (gst === null || gst === undefined) {
        return { valid: false, error: `Cannot generate invoice: item "${name}" is missing GST percentage` }
      }
    }
  }

  return { valid: true }
}
