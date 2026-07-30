import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
}

// ----------------------------------------------------
// 1. MINIMUM ORDER QUANTITY (MOQ) — DEPRECATED
// Unit-based MOQ replaced by per-category minimum order VALUE.
// Kept for backward compatibility. Returns 0 to disable unit check.
// ----------------------------------------------------
export async function getMinOrderQuantity() {
  return 0
}

export async function setMinOrderQuantity(moq) {
  // No-op: category-based MOV is now managed via categories table
  return 0
}

// ----------------------------------------------------
// 1b. CATEGORY MINIMUM ORDER VALUES (MOV)
// ----------------------------------------------------
export async function getCategoryMinOrderValues() {
  const supabase = getDb()
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, min_order_value')
    if (error) {
      console.error('[getCategoryMinOrderValues] Error:', error.message)
      return []
    }
    return data || []
  } catch (e) {
    console.error('[getCategoryMinOrderValues] Exception:', e.message)
    return []
  }
}

// ----------------------------------------------------
// 2. CUSTOMER PRODUCT PRICING
// ----------------------------------------------------
export async function getCustomerPricings(customerId) {
  const supabase = getDb()
  console.log(`[getCustomerPricings] Looking up pricing for customer_id: ${customerId}`)

  // Read from Supabase table
  let tableRows = []
  try {
    const { data, error } = await supabase
      .from('customer_product_pricing')
      .select('*')
      .eq('customer_id', customerId)
    if (error) {
      console.error(`[getCustomerPricings] Table query error for ${customerId}:`, error.message)
    } else if (Array.isArray(data)) {
      tableRows = data
      console.log(`[getCustomerPricings] Table rows for ${customerId}: ${tableRows.length} (visible: ${tableRows.filter(r => r.is_visible).length})`)
    }
  } catch (e) {
    console.error(`[getCustomerPricings] Table query exception:`, e.message)
  }

  // Also read from JSON fallback store in settings
  let jsonRows = []
  try {
    const { data: store } = await supabase
      .from('settings')
      .select('b2b_customer_pricing')
      .eq('id', 'main')
      .maybeSingle()
    const pricingList = store?.b2b_customer_pricing || []
    const allJsonIds = pricingList.map(i => i.customer_id)
    jsonRows = pricingList.filter(item => item.customer_id === customerId)
    console.log(`[getCustomerPricings] JSON store total entries: ${pricingList.length}, unique customer IDs: ${[...new Set(allJsonIds)].join(', ')}`)
    console.log(`[getCustomerPricings] JSON rows for ${customerId}: ${jsonRows.length} (visible: ${jsonRows.filter(r => r.is_visible).length})`)
  } catch (e) {
    console.error(`[getCustomerPricings] JSON store exception:`, e.message)
  }

  // Merge: table rows take priority; fill in any gaps from JSON store
  if (tableRows.length > 0) {
    const tableByProduct = new Map(tableRows.map(r => [r.product_id, r]))
    // Add any JSON rows not already in the table
    for (const jr of jsonRows) {
      if (!tableByProduct.has(jr.product_id)) {
        tableByProduct.set(jr.product_id, jr)
      }
    }
    const merged = Array.from(tableByProduct.values())
    console.log(`[getCustomerPricings] Merged result for ${customerId}: ${merged.length} rows (${merged.filter(r => r.is_visible).length} visible)`)
    return merged
  }
  console.log(`[getCustomerPricings] Final result for ${customerId}: ${jsonRows.length} JSON rows (no table rows)`)
  return jsonRows
}

export async function getCustomerVisiblePricingMap(customerId) {
  const list = await getCustomerPricings(customerId)
  const visibleMap = new Map()
  for (const item of list) {
    if (item.is_visible) {
      visibleMap.set(item.product_id, Number(item.custom_price))
    }
  }
  return visibleMap
}

export async function saveCustomerPricing({ customer_id, product_id, custom_price, is_visible }) {
  const supabase = getDb()
  const now = new Date().toISOString()
  console.log(`[saveCustomerPricing] Saving: customer_id=${customer_id} product_id=${product_id} price=${custom_price} visible=${is_visible}`)

  // 1. Always write to JSON store first (guaranteed to work)
  try {
    const { data: store } = await supabase
      .from('settings')
      .select('b2b_customer_pricing')
      .eq('id', 'main')
      .maybeSingle()
    let list = store?.b2b_customer_pricing || []
    const idx = list.findIndex(i => i.customer_id === customer_id && i.product_id === product_id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], custom_price: Number(custom_price), is_visible: !!is_visible, updated_at: now }
    } else {
      list.push({ id: uuidv4(), customer_id, product_id, custom_price: Number(custom_price), is_visible: !!is_visible, created_at: now, updated_at: now })
    }
    await supabase.from('settings').upsert({ id: 'main', b2b_customer_pricing: list, updated_at: now })
  } catch (jsonErr) {
    console.error('JSON store write failed:', jsonErr)
  }

  // 2. Also try Supabase table upsert (best effort)
  try {
    await supabase.from('customer_product_pricing').upsert({
      customer_id,
      product_id,
      custom_price: Number(custom_price),
      is_visible: !!is_visible,
      updated_at: now
    }, { onConflict: 'customer_id,product_id' })
  } catch (tableErr) {
    // Table may not exist yet — JSON store is the fallback
    console.log('customer_product_pricing table upsert notice:', tableErr?.message)
  }

  return true
}

export async function bulkUpdateCustomerPricing({ customer_id, product_ids, category_id, action_type, value, is_visible }) {
  const supabase = getDb()

  // Get products to update
  let productsToUpdate = []
  if (product_ids && product_ids.length > 0) {
    const { data: prods } = await supabase.from('products').select('id, price, category_id').in('id', product_ids)
    productsToUpdate = prods || []
  } else if (category_id) {
    const { data: prods } = await supabase.from('products').select('id, price, category_id').eq('category_id', category_id)
    productsToUpdate = prods || []
  } else {
    const { data: prods } = await supabase.from('products').select('id, price, category_id')
    productsToUpdate = prods || []
  }

  const existingMap = await getCustomerPricings(customer_id)
  const existingByProd = new Map(existingMap.map(e => [e.product_id, e]))

  for (const prod of productsToUpdate) {
    let customPrice = prod.price
    const current = existingByProd.get(prod.id)

    if (action_type === 'markup_percent') {
      const pct = Number(value) || 0
      customPrice = Math.round(prod.price * (1 + pct / 100))
    } else if (action_type === 'discount_percent') {
      const pct = Number(value) || 0
      customPrice = Math.round(prod.price * (1 - pct / 100))
    } else if (action_type === 'fixed_price') {
      customPrice = Number(value) || prod.price
    } else if (current) {
      customPrice = current.custom_price
    }

    const vis = is_visible !== undefined ? !!is_visible : (current ? current.is_visible : true)
    await saveCustomerPricing({
      customer_id,
      product_id: prod.id,
      custom_price: customPrice,
      is_visible: vis
    })
  }

  return true
}

// ----------------------------------------------------
// 3. STOCK MOVEMENTS & INVENTORY LEDGER
// ----------------------------------------------------
export async function getStockMovements() {
  const supabase = getDb()
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, products(name, sku)')
    .order('created_at', { ascending: false })

  if (!error && data) {
    return data.map(m => ({
      ...m,
      product_name: m.products?.name || 'Product',
      product_sku: m.products?.sku || ''
    }))
  }

  // Fallback to settings store
  const { data: store } = await supabase.from('settings').select('b2b_stock_movements').eq('id', 'main').maybeSingle()
  const list = store?.b2b_stock_movements || []

  // Join product details
  const { data: prods } = await supabase.from('products').select('id, name, sku')
  const prodMap = new Map((prods || []).map(p => [p.id, p]))

  return list.map(m => ({
    ...m,
    product_name: prodMap.get(m.product_id)?.name || 'Product',
    product_sku: prodMap.get(m.product_id)?.sku || ''
  })).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
}

export async function addStockMovement({ product_id, movement_type, quantity, reference, notes, created_by }) {
  const supabase = getDb()
  const now = new Date().toISOString()
  const qty = Math.abs(Number(quantity) || 0)
  if (qty <= 0) throw new Error('Quantity must be greater than zero')

  // Update product stock in products table
  const { data: prod } = await supabase.from('products').select('stock_quantity, name').eq('id', product_id).maybeSingle()
  if (!prod) throw new Error('Product not found')

  let newStock = prod.stock_quantity || 0
  if (movement_type === 'intake') {
    newStock += qty
  } else if (movement_type === 'outward') {
    if (newStock < qty) {
      throw new Error(`Insufficient stock for "${prod.name}". Current stock: ${newStock}, requested outward: ${qty}`)
    }
    newStock -= qty
  } else {
    throw new Error('Invalid movement type')
  }

  // Update products table
  await supabase.from('products').update({ stock_quantity: newStock, updated_at: now }).eq('id', product_id)

  const record = {
    id: uuidv4(),
    product_id,
    movement_type,
    quantity: qty,
    reference: reference || '',
    notes: notes || '',
    created_at: now,
    created_by: created_by || null
  }

  // Try table insert first
  const { error } = await supabase.from('stock_movements').insert(record)
  if (!error) return record

  // Fallback to settings store
  const { data: store } = await supabase.from('settings').select('b2b_stock_movements').eq('id', 'main').maybeSingle()
  const list = store?.b2b_stock_movements || []
  list.push(record)
  await supabase.from('settings').upsert({ id: 'main', b2b_stock_movements: list, updated_at: now })

  return record
}

// ----------------------------------------------------
// 4. VENDORS & VENDOR PORTAL
// ----------------------------------------------------
export async function getVendorsList() {
  const supabase = getDb()
  const { data, error } = await supabase.from('vendors').select('*').order('created_at', { ascending: false })
  if (!error && data) return data

  const { data: store } = await supabase.from('settings').select('b2b_vendors').eq('id', 'main').maybeSingle()
  return store?.b2b_vendors || []
}

export async function saveVendor({ id, name, phone, email, user_id }) {
  const supabase = getDb()
  const now = new Date().toISOString()
  const vendorId = id || uuidv4()

  const record = {
    id: vendorId,
    name,
    phone: phone || '',
    email: email || '',
    user_id: user_id || null,
    updated_at: now
  }

  if (!id) record.created_at = now

  const { error } = await supabase.from('vendors').upsert(record)
  if (!error) return record

  const { data: store } = await supabase.from('settings').select('b2b_vendors').eq('id', 'main').maybeSingle()
  let list = store?.b2b_vendors || []
  const idx = list.findIndex(v => v.id === vendorId)
  if (idx >= 0) list[idx] = { ...list[idx], ...record }
  else list.push(record)

  await supabase.from('settings').upsert({ id: 'main', b2b_vendors: list, updated_at: now })
  return record
}

export async function getVendorByUserId(userId, userEmail) {
  const supabase = getDb()
  
  if (userId) {
    const { data: vById } = await supabase.from('vendors').select('*').eq('user_id', userId).maybeSingle()
    if (vById) return vById
  }

  if (userEmail) {
    const cleanEmail = userEmail.trim().toLowerCase()
    const { data: vByEmail } = await supabase.from('vendors').select('*').eq('email', cleanEmail).maybeSingle()
    if (vByEmail) {
      if (userId && !vByEmail.user_id) {
        await supabase.from('vendors').update({ user_id: userId }).eq('id', vByEmail.id)
        vByEmail.user_id = userId
      }
      return vByEmail
    }
  }

  const list = await getVendorsList()
  const matched = list.find(v => (userId && v.user_id === userId) || (userEmail && v.email?.toLowerCase() === userEmail.trim().toLowerCase()))
  if (matched) return matched

  if (userId && userEmail) {
    const { data: u } = await supabase.from('users').select('full_name, phone, role').eq('id', userId).maybeSingle()
    if (u && u.role === 'vendor') {
      const autoVendor = await saveVendor({
        name: u.full_name || 'Vendor Partner',
        email: userEmail.trim().toLowerCase(),
        phone: u.phone || '',
        user_id: userId
      })
      return autoVendor
    }
  }

  return null
}
